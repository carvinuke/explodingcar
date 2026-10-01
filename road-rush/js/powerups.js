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
  shrink:     { name: 'Shrink',     color: '#7ed957', dur: 8, weight: 0.8 },                // tiny: big vehicles roll right over you, quicker hops, double coins
  horn:       { name: 'Horn',       color: '#ffd23f', dur: 0, weight: 0.8, instant: true }, // everything nearby slams its brakes
  pogo:       { name: 'Pogo Stick', color: '#ff5c8a', dur: 6, weight: 0.7 },                 // forward hops go two rows
  timestop:   { name: 'Time Stop',  color: '#b07aff', dur: 2.5, weight: 0.35 },              // the whole world freezes, you don't
  coinrain:   { name: 'Coin Rain',  color: '#f0b400', dur: 0, weight: 0.6, instant: true }, // coins fall on the road ahead
  bubble:     { name: 'Bubble',     color: '#5ad1ff', dur: 6, weight: 0.6 },                 // float across water
  decoy:      { name: 'Decoy',      color: '#ff9f1c', dur: 10, weight: 0.5 },                // a fake chicken draws the danger
};
for (const k in POWERUPS) POWERUPS[k].dark = shade(POWERUPS[k].color, -0.3);

const MAGNET_RANGE = 3.8 * TILE;
// What roadside stands sell, and for how many of this run's coins.
const STAND_OFFERS = [['shield', 8], ['magnet', 5], ['speed', 4], ['ghost', 7], ['pogo', 6], ['bubble', 6], ['jetpack', 9], ['invincible', 12], ['decoy', 5]];

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
    // a mystery egg, now and then (the roll always happens, so the road stays the same for a seed)
    if (Pets.has('luckycat') && Math.random() < Pets.up(0.35, 0.55)) this.add('coin', pick(free), row.i); // far more coins
    if (Gen.chance(0.014 * (Pets.perk('eggLuck') || 1) * (1 + 0.4 * Upgrades.n('eggscout'))) && Egg.canSpawn(row.i) && !this.list.some(it => it.type === 'egg')) {
      this.add('egg', Gen.pick(free), row.i);
      return;
    }
    // a mystery box, rarely
    if (Gen.chance(0.009 * (1 + 0.5 * Upgrades.n('treasure'))) && Boxes.canSpawn(row.i)) {
      this.add('box', Gen.pick(free), row.i);
      return;
    }
    // a secret manhole: drop into a vault full of coins
    if (Gen.chance(0.0055 * (1 + 0.6 * Upgrades.n('map'))) && row.type === 'grass' && SecretRoom.canSpawn(row.i) && !this.list.some(it => it.type === 'manhole')) {
      this.add('manhole', Gen.pick(free), row.i);
      return;
    }
    // a roadside stand selling one power-up for this run's coins
    if (Gen.chance(0.022 * (Upgrades.has('haggler') ? 2 : 1)) && row.type === 'grass' && row.i > 20 && Game.players.length === 1) {
      const inner = free.filter(c => c > 0 && c < COLS - 1);
      if (inner.length) {
        const [offer, full] = Gen.pick(STAND_OFFERS);
        const price = Upgrades.has('haggler') ? Math.ceil(full / 2) : full;
        this.list.push({ kind: 'item', type: 'stand', x: cellX(Gen.pick(inner)), y: row.i * TILE, row: row.i, phase: rand(0, 6.28), offer, price, sold: false, warned: false });
        return;
      }
    }
    if (row.i > 8 && World.powerups && Gen.chance(0.05 * (1 + 0.15 * Upgrades.n('surge')))) {
      this.add(Gen.weighted(Object.keys(POWERUPS).map(k => [k, POWERUPS[k].weight])), Gen.pick(free), row.i);
      return;
    }
    if (Gen.chance(Math.min(0.9, (row.type === 'grass' ? 0.3 : 0.18) * (1 + 0.15 * Upgrades.n('coinmore'))))) {
      const c = Gen.pick(free);
      if (row.type === 'grass' && Gen.chance(0.3)) {
        for (let k = -1; k <= 1; k++) if (free.includes(c + k)) this.add('coin', c + k, row.i);
      } else {
        this.add('coin', c, row.i);
      }
    }
  },

  // Standing in a roadside stand: buy what it sells if you can afford it.
  shop(it, p, dist) {
    if (it.sold || p.id !== 0) return;
    if (dist > 0.5 * TILE || !p.alive || p.z > 24 || p.hop) { if (dist > 0.9 * TILE) it.warned = false; return; }
    if (p.coins >= it.price) {
      p.coins -= it.price;
      Game.coins = p.coins;
      it.sold = true;
      Sound.cash();
      FX.text(it.x, it.y + 52, `-${it.price} COINS`, '#ffd23f', 14);
      Powers.grant(it.offer, it, p);
      Roadex.see('specials', 'stand');
    } else if (!it.warned) {
      it.warned = true;
      Sound.bump();
      FX.text(it.x, it.y + 52, `NEED ${it.price} COINS`, '#ff9a9a', 14);
    }
  },

  cull(minRow) {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].row < minRow) this.list.splice(i, 1);
  },

  update(dt, p) {
    const magbot = p.id === 0 && Pets.has('magbot'); // the Magnet Bot: a magnet that never runs out
    const magnet = p.pw.magnet > 0 || magbot;
    const range = p.pw.magnet > 0 ? MAGNET_RANGE : MAGNET_RANGE * Pets.up(0.85, 1.15);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      if (!it) continue; // picking up an egg clears the other eggs mid-loop
      const dx = p.x - it.x, dy = p.y - it.y;
      const dist = Math.hypot(dx, dy);
      if (it.type === 'stand') { this.shop(it, p, dist); continue; }
      if (it.type === 'manhole') { // step on it (not mid-hop) and down you go
        if (p.id === 0 && dist < 0.4 * TILE && p.alive && !p.hop && !p.knock && p.z < 4 && Game.state === 'playing') SecretRoom.enter(p, it);
        continue;
      }
      if (it.type === 'coin' && p.id === 0 && Upgrades.has('pmagnet') && dist < (1 + 0.5 * Upgrades.n('pmagnet')) * TILE && dist > 1) { // Pocket Magnet
        const s = Math.min(dist, 200 * dt);
        it.x += (dx / dist) * s; it.y += (dy / dist) * s;
      }
      if (it.type === 'coin' && p.id === 0 && Shop.trail === 'blackhole' && dist < 1.6 * TILE && dist > 1) { // the black hole trail pulls coins in
        const s = Math.min(dist, 220 * dt);
        it.x += (dx / dist) * s; it.y += (dy / dist) * s;
      }
      if (magnet && dist < range && (!it.pulled || it.pulled === p)) {
        const step = Math.min(dist, (it.pulled ? 560 : 280) * dt);
        it.pulled = p;
        if (dist > 0) { it.x += (dx / dist) * step; it.y += (dy / dist) * step; }
      }
      if (dist < 0.55 * TILE && p.alive && p.z < 24) {
        if (it.type === 'egg' && (p.id !== 0 || Egg.carry)) continue; // one egg at a time
        this.list.splice(i, 1);
        if (it.type === 'coin') Game.addCoin(it, p);
        else if (it.type === 'goldegg') Game.addCoin(it, p, 10);
        else if (it.type === 'egg') Egg.pickup(p, it);
        else if (it.type === 'box') Boxes.pickup(p, it);
        else Powers.grant(it.type, it, p);
      }
    }
  },
};

// Freeze is shared (it stops all traffic); the others belong to whoever grabbed them.
const Powers = {
  freeze: 0,
  frost: 0, // 0..1 eased freeze amount
  stop: 0,  // time stop: seconds left
  decoy: null,
  seen: new Set(), // power-up types grabbed this run (player one)

  reset() {
    this.freeze = 0;
    this.frost = 0;
    this.stop = 0;
    this.decoy = null;
    this.seen = new Set();
  },

  // `free`: handed out, not grabbed (doesn't count against biome mastery).
  grant(type, it, p = Player, free = false) {
    const def = POWERUPS[type];
    if (type === 'shield') { // shields stack
      p.shield++;
      if (p.shield > 1) { FX.text(it.x, it.y + 32, `x${p.shield} SHIELDS`, def.color, 16); }
    }
    else if (type === 'freeze') { this.freeze = def.dur * this.boost(p); FX.ice(it.x, it.y); Sound.freeze(); }
    else if (type === 'jetpack') p.jetpack();
    else if (type === 'horn') this.horn(p);
    else if (type === 'timestop') { this.stop = def.dur * this.boost(p); Sound.timeStop(true); FX.flashScreen(0.35, '200,170,255'); }
    else if (type === 'coinrain') this.coinRain(p);
    else if (type === 'decoy') this.placeDecoy(p, def.dur * this.boost(p));
    else p.pw[type] = def.dur * this.boost(p);
    Sound.powerup();
    FX.pickup(it.x, it.y, def.color);
    FX.text(it.x, it.y + 14, def.name.toUpperCase() + '!', def.color, 19);
    Cam.punch += 0.05;
    Game.addBonus(50, p);
    if (p.id === 0) {
      if (!free) Mastery.power();
      Roadex.see('powerups', type);
      Missions.add('powerups');
      this.seen.add(type);
      Trophies.max('powerTypes', this.seen.size);
    }
  },

  // Bee and Robo Pup make power-ups last longer.
  boost(p) { return p.id === 0 ? (Pets.perk('powerBoost') || 1) * Upgrades.powerBoost() : 1; },

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

  // Coin Rain: coins tumble onto the next eight rows.
  coinRain(p) {
    World.ensure(p.row + 12);
    let n = 0;
    for (let r = p.row + 1; r <= p.row + 8; r++) {
      const R = World.rows.get(r);
      if (!R || R.type === 'river') continue;
      for (let k = 0; k < 2; k++) {
        const c = clamp(p.col + randInt(-3, 3), 0, COLS - 1);
        if (World.isBlocked(c, r) || (R.type === 'work' && R.pit[c]) || this.coinAt(c, r)) continue;
        this.dropCoin(c, r, n++ * 0.05);
      }
    }
    FX.text(p.x, p.y + 40, 'COIN RAIN!', '#ffd23f', 20);
  },
  coinAt(c, r) { return Items.list.some(it => it.row === r && Math.abs(it.x - cellX(c)) < 4); },
  dropCoin(c, r, delay) {
    Items.add('coin', c, r);
    FX.spawn('glyph', cellX(c), r * TILE, 90 + delay * 400, { part: 'coin', color: '#ffd23f', vz: -60, g: 700, life: 0.55 + delay, size: 7, rotV: 8 });
  },

  // Decoy: a fake you, left where you're standing. Big trouble goes after it.
  placeDecoy(p, dur) {
    this.decoy = { kind: 'decoy', x: p.x, y: p.y, row: p.row, maxRow: p.maxRow, alive: true, z: 0, t: dur, max: dur, facing: p.facing };
    FX.text(p.x, p.y + 30, 'DECOY!', '#ff9f1c', 18);
    FX.dust(p.x, p.y, 8);
  },
  popDecoy(why) {
    const d = this.decoy;
    if (!d) return;
    d.alive = false;
    this.decoy = null;
    FX.feathers(d.x, d.y, Player.skin());
    FX.text(d.x, d.y + 26, why || 'POOF!', '#ffe9b0', 15);
    Sound.cluck();
  },

  // Seconds left on a power-up for the HUD (player one).
  left(type) {
    if (type === 'freeze') return this.freeze;
    if (type === 'timestop') return this.stop;
    if (type === 'decoy') return this.decoy ? this.decoy.t : 0;
    return Player.pw[type] || 0;
  },

  update(dt) {
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.stop > 0) {
      this.stop = Math.max(0, this.stop - dt);
      if (this.stop === 0) { Sound.timeStop(false); FX.text(Player.x, Player.y + 40, 'TIME RESUMES', '#d6c2ff', 16); }
    }
    this.frost = approach(this.frost, this.freeze > 0 ? 1 : 0, dt * 3);
    const d = this.decoy;
    if (d) {
      d.t -= dt;
      if (d.t <= 0) { this.popDecoy(); return; }
      // a car in its lane runs it down
      const R = World.rows.get(d.row);
      if (R && R.type === 'road' && this.stop <= 0) {
        for (const v of R.lane.vehicles) if (!v.wreck && v.speed > 25 && Math.abs(v.x - d.x) < v.len / 2 + 6) { this.popDecoy('SPLAT! (NOT YOU)'); return; }
      }
      // the giant goose catches it
      const e = Events.active;
      if (e && e.type === 'goose' && e.x !== undefined && Math.hypot(e.x - d.x, e.y - d.y) < 0.75 * TILE) this.popDecoy('GOBBLED!');
    }
  },

  drawables(list) {
    const d = this.decoy;
    if (d && Game.state !== 'title') { d.key = d.y - 10; list.push(d); }
  },

  // Traffic speed multiplier (freeze brings everything to a crawl, time stop stops it dead).
  get traffic() { return this.stop > 0 ? 0 : 1 - 0.97 * this.frost; },
};
