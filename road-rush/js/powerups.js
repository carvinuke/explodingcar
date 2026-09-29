'use strict';
// Collectibles (coins + power-up pickups) and the active power-up timers.

const POWERUPS = {
  shield:     { name: 'Shield',     color: '#3d9bff', dur: 0, weight: 1.2 },
  speed:      { name: 'Speed',      color: '#ffb319', dur: 6, weight: 1.0 },
  magnet:     { name: 'Magnet',     color: '#ff4f6d', dur: 8, weight: 1.0 },
  freeze:     { name: 'Freeze',     color: '#34c6ea', dur: 5, weight: 0.9 },
  invincible: { name: 'Invincible', color: '#a95cff', dur: 5, weight: 0.6 },
  jetpack:    { name: 'Jetpack',    color: '#ff7a1a', dur: 0, weight: 0.7, instant: true }, // fly 5 rows ahead
  ghost:      { name: 'Ghost',      color: '#9fe7ff', dur: 4, weight: 0.7 },                // cars pass straight through you
  shrink:     { name: 'Shrink',     color: '#7ed957', dur: 7, weight: 0.8 },                // tiny chicken, tiny hitbox
  horn:       { name: 'Horn',       color: '#ffd23f', dur: 0, weight: 0.8, instant: true }, // everything nearby slams its brakes
};
for (const k in POWERUPS) POWERUPS[k].dark = shade(POWERUPS[k].color, -0.3);

const MAGNET_RANGE = 3.8 * TILE;

const Items = {
  list: [],

  reset() { this.list.length = 0; },

  add(type, col, row) {
    this.list.push({ kind: 'item', type, x: cellX(col), y: row * TILE, row, phase: rand(0, 6.28), pulled: false });
  },

  populateRow(row) {
    if (row.type === 'river') return; // nothing floats
    const free = [];
    for (let c = 0; c < COLS; c++) {
      if ((row.type === 'grass' || row.type === 'work') && row.blocked[c]) continue;
      if (row.type === 'work' && row.pit[c]) continue;
      free.push(c);
    }
    if (!free.length) return;
    if (row.i > 8 && World.powerups && Gen.chance(0.05)) {
      this.add(Gen.weighted(Object.keys(POWERUPS).map(k => [k, POWERUPS[k].weight])), Gen.pick(free), row.i);
      return;
    }
    if (Gen.chance(row.type === 'grass' ? 0.3 : 0.18)) {
      const c = Gen.pick(free);
      if (row.type === 'grass' && Gen.chance(0.3)) {
        for (let k = -1; k <= 1; k++) if (free.includes(c + k)) this.add('coin', c + k, row.i);
      } else {
        this.add('coin', c, row.i);
      }
    }
  },

  cull(minRow) {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].row < minRow) this.list.splice(i, 1);
  },

  update(dt, p) {
    const magnet = p.pw.magnet > 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      const dx = p.x - it.x, dy = p.y - it.y;
      const dist = Math.hypot(dx, dy);
      if (magnet && dist < MAGNET_RANGE && (!it.pulled || it.pulled === p)) {
        const step = Math.min(dist, (it.pulled ? 560 : 280) * dt);
        it.pulled = p;
        if (dist > 0) { it.x += (dx / dist) * step; it.y += (dy / dist) * step; }
      }
      if (dist < 0.55 * TILE && p.alive && p.z < 24) {
        this.list.splice(i, 1);
        if (it.type === 'coin') Game.addCoin(it, p);
        else Powers.grant(it.type, it, p);
      }
    }
  },
};

// Freeze is shared (it stops all traffic); the others belong to whoever grabbed them.
const Powers = {
  freeze: 0,
  frost: 0, // 0..1 eased freeze amount
  seen: new Set(), // power-up types grabbed this run (player one)

  reset() {
    this.freeze = 0;
    this.frost = 0;
    this.seen = new Set();
  },

  grant(type, it, p = Player) {
    const def = POWERUPS[type];
    if (type === 'shield') { // shields stack
      p.shield++;
      if (p.shield > 1) { FX.text(it.x, it.y + 32, `x${p.shield} SHIELDS`, def.color, 16); }
    }
    else if (type === 'freeze') { this.freeze = def.dur; FX.ice(it.x, it.y); Sound.freeze(); }
    else if (type === 'jetpack') p.jetpack();
    else if (type === 'horn') this.horn(p);
    else p.pw[type] = def.dur;
    Sound.powerup();
    FX.pickup(it.x, it.y, def.color);
    FX.text(it.x, it.y + 14, def.name.toUpperCase() + '!', def.color, 19);
    Cam.punch += 0.05;
    Game.addBonus(50, p);
    if (p.id === 0) {
      Missions.add('powerups');
      this.seen.add(type);
      Trophies.max('powerTypes', this.seen.size);
    }
  },

  // Horn: every car near you slams on its brakes (even reckless drivers).
  horn(p) {
    Sound.honk2(0);
    Sound.horn(0);
    FX.text(p.x, p.y + 36, 'HOOOONK!', '#ffd23f', 22);
    Cam.addTrauma(0.2);
    for (let k = 0; k < 3; k++) FX.spawn('glow', p.x, p.y, 20, { life: 0.5 + k * 0.15, size: 20 + k * 20, size2: 120 + k * 50, color: '#ffe27a', alpha: 0.16 });
    for (const row of World.rows.values()) {
      if (row.type !== 'road' || Math.abs(row.y - p.y) > 3.5 * TILE) continue;
      for (const v of row.lane.vehicles) {
        if (v.wreck || v.animal || Math.abs(v.x - p.x) > 7 * TILE) continue;
        v.reckless = false;
        v.panic = 1.6;
      }
    }
  },

  // Seconds left on a power-up for the HUD (player one).
  left(type) { return type === 'freeze' ? this.freeze : Player.pw[type] || 0; },

  update(dt) {
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    this.frost = approach(this.frost, this.freeze > 0 ? 1 : 0, dt * 3);
  },

  // Traffic speed multiplier (freeze brings everything to a crawl).
  get traffic() { return 1 - 0.97 * this.frost; },
};
