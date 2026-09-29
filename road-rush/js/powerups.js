'use strict';
// Collectibles (coins + power-up pickups) and the active power-up timers.

const POWERUPS = {
  shield:     { name: 'Shield',     color: '#3d9bff', dur: 0, weight: 1.2 },
  speed:      { name: 'Speed',      color: '#ffb319', dur: 6, weight: 1.0 },
  magnet:     { name: 'Magnet',     color: '#ff4f6d', dur: 8, weight: 1.0 },
  freeze:     { name: 'Freeze',     color: '#34c6ea', dur: 5, weight: 0.9 },
  invincible: { name: 'Invincible', color: '#a95cff', dur: 5, weight: 0.6 },
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
    const free = [];
    for (let c = 0; c < COLS; c++) if (row.type !== 'grass' || !row.blocked[c]) free.push(c);
    if (!free.length) return;
    if (row.i > 8 && chance(0.05)) {
      this.add(weighted(Object.keys(POWERUPS).map(k => [k, POWERUPS[k].weight])), pick(free), row.i);
      return;
    }
    if (chance(row.type === 'grass' ? 0.3 : 0.18)) {
      const c = pick(free);
      if (row.type === 'grass' && chance(0.3)) {
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
    const magnet = Powers.magnet > 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      const dx = p.x - it.x, dy = p.y - it.y;
      const dist = Math.hypot(dx, dy);
      if (magnet && dist < MAGNET_RANGE) {
        const step = Math.min(dist, (it.pulled ? 560 : 280) * dt);
        it.pulled = true;
        if (dist > 0) { it.x += (dx / dist) * step; it.y += (dy / dist) * step; }
      }
      if (dist < 0.55 * TILE && p.alive && p.z < 24) {
        this.list.splice(i, 1);
        if (it.type === 'coin') Game.addCoin(it);
        else Powers.grant(it.type, it);
      }
    }
  },
};

const Powers = {
  speed: 0,
  magnet: 0,
  freeze: 0,
  invincible: 0,
  frost: 0, // 0..1 eased freeze amount

  reset() {
    this.speed = this.magnet = this.freeze = this.invincible = 0;
    this.frost = 0;
  },

  grant(type, it) {
    const def = POWERUPS[type];
    if (type === 'shield') Player.shield = true;
    else this[type] = def.dur;
    if (type === 'freeze') { FX.ice(it.x, it.y); Sound.freeze(); }
    Sound.powerup();
    FX.pickup(it.x, it.y, def.color);
    FX.text(it.x, it.y + 14, def.name.toUpperCase() + '!', def.color, 19);
    Cam.punch += 0.05;
    Game.addBonus(50);
  },

  update(dt) {
    for (const k of ['speed', 'magnet', 'freeze', 'invincible']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    this.frost = approach(this.frost, this.freeze > 0 ? 1 : 0, dt * 3);
  },

  // Traffic speed multiplier (freeze brings everything to a crawl).
  get traffic() { return 1 - 0.97 * this.frost; },
};
