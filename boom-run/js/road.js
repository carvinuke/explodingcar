'use strict';
// Boom Run: the highway, its traffic, pickups and scenery. World units match
// Road Rush: x runs right, y runs up the screen (the way you drive), z is up.

const BR_LANES = [-60, -20, 20, 60];
const BR_ROAD = 80;       // road half-width
const BR_SHOULDER = 98;   // edge of the gravel
const RAMP_LEN = 34;
const BR_WINDOWS = [0, 1, 2, 3].map(k => Array.from({ length: 24 }, (_, i) => ((i * 7 + k * 5) % 9) < 5));

const BRRoad = {
  player: null,
  traffic: [],
  items: [],
  gantries: [],
  hooks: {},
  viewAhead: 700,  // world units visible ahead of the player (set by the view)
  viewBehind: 260,
  viewX: 300,

  reset(mode, garage, paint) {
    this.mode = mode;
    this.wrong = mode === 'wrongway';
    const G = BR_CARS[garage] || BR_CARS.hatch;
    this.G = G;
    const car = Cars.make(G.type, paint || G.color, 'N');
    this.player = {
      x: 20, y: 0, z: 0, vz: 0, vx: 0, v: 0, car, dead: false,
      shield: !!G.shield, nitroT: 0, magnetT: 0, safeT: 0, steer: 0, boost: 0,
    };
    this.traffic = [];
    this.items = [];
    this.gantries = [];
    this.seed = (Math.random() * 1e9) >>> 0; // lays out the scenery
    this.spawnY = 300;
    this.itemY = 500;
    this.powerY = 1600;
    this.rampY = 1800;
    this.cpY = 3000;
    this.cpN = 0;
    this.time = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bonus = 0;
    this.coins = 0;
    this.near = 0;
    this.smash = 0;
    this.ramps = 0;
    this.timeLeft = mode === 'checkpoint' ? 35 : Infinity;
    this.welcomed = 0;
  },

  get dist() { return Math.max(0, this.player.y); },
  get meters() { return Math.floor(this.dist / 10); },
  get score() { return this.meters + this.bonus; },
  biomeAt(y) { return BR_BIOMES[Math.floor(Math.max(0, y) / BR_SECTION) % BR_BIOMES.length]; },

  // How fast the road wants you to go right now.
  cruise() {
    const d = this.dist, G = this.G;
    const base = this.wrong ? Math.min(520, 230 + d * 0.008) : Math.min(780, 300 + d * 0.011);
    return base * G.speed;
  },

  // ---- One step ----------------------------------------------------------------
  update(dt, input) {
    const p = this.player;
    this.time += dt;
    if (p.dead) { this.updateTraffic(dt); return; }

    // speed: cruise, plus boost or brake, plus nitro
    let want = this.cruise();
    if (input.boost) want *= 1.18;
    if (input.brake) want = Math.min(want * 0.6, 150); // hard enough to sit behind traffic
    if (p.nitroT > 0) want *= 1.45;
    if (this.timeLeft <= 0) want = 0; // out of time: roll to a stop
    const acc = want > p.v ? 260 * this.G.speed : 520;
    p.v = want > p.v ? Math.min(want, p.v + acc * dt) : Math.max(want, p.v - acc * dt);
    p.y += p.v * dt;

    // steering: keys push sideways, a finger or mouse pulls toward a point
    const steer = 320 * this.G.grip;
    let vx;
    if (input.targetX !== null && input.targetX !== undefined) vx = clamp((input.targetX - p.x) * 9, -steer, steer);
    else vx = input.dir * steer;
    p.vx = damp(p.vx, vx, 16, dt);
    const [hw] = Cars.halfSize(p.car);
    p.x = clamp(p.x + p.vx * dt, -BR_ROAD + hw + 2, BR_ROAD - hw - 2);
    p.steer = p.vx / steer;

    // jumping off a ramp
    if (p.z > 0 || p.vz > 0) {
      p.vz -= 560 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0 && p.vz < 0) { p.vz = 0; if (this.hooks.land) this.hooks.land(); }
    }

    // timers
    if (p.nitroT > 0) p.nitroT -= dt;
    if (p.magnetT > 0) p.magnetT -= dt;
    if (p.safeT > 0) p.safeT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.timeLeft !== Infinity) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0 && p.v < 5 && this.hooks.timeUp) this.hooks.timeUp();
    }

    this.spawn();
    this.updateTraffic(dt);
    this.breakWalls();
    this.collide();
    this.pickups(dt);
    this.checkpoints();
    this.cull();

    // welcome signs mark each new biome
    const sec = Math.floor(p.y / BR_SECTION);
    if (sec > this.welcomed) { this.welcomed = sec; if (this.hooks.biome) this.hooks.biome(this.biomeAt(p.y)); }
  },

  // ---- Traffic --------------------------------------------------------------------
  density() { return Math.min(10, 2.4 + this.dist / 2200); }, // cars per 1000 units of road

  spawn() {
    const p = this.player, top = p.y + this.viewAhead + 160;
    while (this.spawnY < top) {
      this.spawnY += rand(0.6, 1.4) * 1000 / this.density();
      const y = this.spawnY;
      const lanes = BR_LANES.map((x, i) => i).filter(i => this.laneFree(BR_LANES[i], y, 120));
      // always leave a way through: never block more than three lanes in one band
      const busy = BR_LANES.filter(x => this.traffic.some(t => Math.abs(t.x - x) < 20 && Math.abs(t.y - y) < 100)).length;
      if (!lanes.length || busy >= 3) continue;
      const lane = pick(lanes);
      const type = weighted(this.dist > 4000
        ? [['sedan', 4], ['small', 3], ['van', 2], ['pickup', 2], ['taxi', 1.5], ['bus', 1.2], ['tanker', 0.6], ['sports', 0.8], ['police', 0.3]]
        : [['sedan', 4], ['small', 3], ['van', 1.5], ['pickup', 1.5], ['taxi', 1], ['bus', 0.6]]);
      const car = Cars.make(type, null, this.wrong ? 'S' : 'N');
      const slow = type === 'bus' || type === 'tanker' ? 0.75 : 1;
      this.traffic.push({
        car, x: BR_LANES[lane], y, lane, targetX: BR_LANES[lane],
        v: (this.wrong ? -rand(100, 170) : rand(120, 210)) * slow,
        changeT: rand(2, 6), blinkT: 0, ahead: true, near: false,
      });
    }
  },

  laneFree(x, y, gap) {
    for (const t of this.traffic) if (Math.abs(t.targetX - x) < 20 && Math.abs(t.y - y) < gap + t.car.len / 2) return false;
    return true;
  },

  updateTraffic(dt) {
    const p = this.player;
    for (const t of this.traffic) {
      if (t.flung) { // knocked off the road by nitro or a shield
        t.x += t.fvx * dt; t.y += t.fvy * dt; t.spin += dt * 6; t.flungT += dt;
        continue;
      }
      // keep a gap to the car in front in the same lane
      let v = t.v;
      for (const o of this.traffic) {
        if (o === t || o.flung || Math.abs(o.x - t.x) > 26) continue;
        const ahead = this.wrong ? t.y - o.y : o.y - t.y;
        if (ahead > 0 && ahead < (t.car.len + o.car.len) / 2 + 30) v = this.wrong ? Math.max(v, o.v) : Math.min(v, o.v);
      }
      if (t.easeT > 0) { t.easeT -= dt; v *= 0.55; }
      t.y += v * dt;
      // the odd lane change, with a blinker first (later in the run)
      if (!this.wrong && !p.dead && this.dist > 1200) {
        t.changeT -= dt;
        if (t.changeT <= 0 && t.blinkT <= 0 && t.targetX === t.x) {
          t.changeT = rand(3, 8) * Math.max(0.5, 1.6 - this.dist / 8000);
          const opts = [t.lane - 1, t.lane + 1].filter(i => i >= 0 && i < BR_LANES.length && this.laneFree(BR_LANES[i], t.y, 90));
          if (opts.length && Math.abs(t.y - p.y) > 150) { t.next = pick(opts); t.blinkT = 0.9; t.car.blink = BR_LANES[t.next] > t.x ? 1 : -1; }
        }
        if (t.blinkT > 0) {
          t.blinkT -= dt;
          if (t.blinkT <= 0) {
            // look again before moving over: never cut into you or another car
            const nx = BR_LANES[t.next];
            const youThere = Math.abs(p.x - nx) < 34 && Math.abs(p.y - t.y) < 130;
            if (!youThere && this.laneFree(nx, t.y, 80)) { t.lane = t.next; t.targetX = nx; }
            else t.car.blink = 0;
          }
        }
      }
      if (t.x !== t.targetX) {
        const step = 55 * dt;
        t.x = Math.abs(t.targetX - t.x) <= step ? t.targetX : t.x + Math.sign(t.targetX - t.x) * step;
        if (t.x === t.targetX) t.car.blink = 0;
      }
      // police siren: cars just ahead pull over to the side
      if (this.G.siren && !p.dead && t.ahead && t.y - p.y < 260 && t.y - p.y > 60 && !t.pulled && Math.abs(t.x - p.x) < 30 && chance(dt * 1.2)) {
        const side = t.lane < 2 ? 0 : BR_LANES.length - 1;
        if (side !== t.lane && this.laneFree(BR_LANES[side], t.y, 80)) { t.lane = side; t.targetX = BR_LANES[side]; t.car.blink = side > 1 ? 1 : -1; t.pulled = true; }
      }
    }
  },

  // Never let traffic line up across every lane: there must always be a way
  // through. If four lanes are blocked in one stretch, the car at the back eases off.
  breakWalls() {
    const T = this.traffic.filter(t => !t.flung && !t.dead);
    for (const c of T) {
      const band = T.filter(o => Math.abs(o.y - c.y) < (o.car.len + c.car.len) / 2 + 60);
      const lanes = new Set(band.map(o => BR_LANES.indexOf(o.targetX)));
      if (lanes.size < BR_LANES.length) continue;
      const back = band.reduce((a, o) => (this.wrong ? (o.y > a.y ? o : a) : (o.y < a.y ? o : a)));
      back.easeT = Math.max(back.easeT || 0, 1.2);
    }
  },

  // ---- Hits and close calls ----------------------------------------------------------
  collide() {
    const p = this.player;
    const [phx, phy] = Cars.halfSize(p.car);
    for (const t of this.traffic) {
      if (t.flung) continue;
      const [thx, thy] = Cars.halfSize(t.car);
      const dx = Math.abs(t.x - p.x), dy = Math.abs(t.y - p.y);
      // close calls: the moment a car drops behind you, how close were you?
      const ahead = t.y > p.y;
      if (t.ahead && !ahead) {
        const gap = dx - phx - thx;
        if (gap < 16 && gap > -2 && p.z < 4 && !t.near) {
          t.near = true;
          this.combo++;
          this.comboT = 2.6;
          this.near++;
          this.bonus += 20 * Math.min(10, this.combo);
          if (this.hooks.near) this.hooks.near(t, this.combo);
        }
      }
      t.ahead = ahead;
      if (p.z > 8) continue; // flying over it
      if (dx < phx + thx - 3 && dy < phy + thy - 3) {
        if (p.nitroT > 0 || p.safeT > 0) { this.fling(t, true); }
        else if (p.shield) {
          p.shield = false;
          p.safeT = 1.2;
          this.fling(t, false);
          if (this.hooks.shieldBreak) this.hooks.shieldBreak();
        } else {
          this.die(t);
          return;
        }
      }
    }
  },

  fling(t, smash) {
    const p = this.player;
    t.flung = true;
    t.flungT = 0;
    t.spin = 0;
    t.fvx = Math.sign(t.x - p.x || 1) * rand(160, 260);
    t.fvy = p.v * 0.6;
    Cars.wreck(t.car);
    if (smash) { this.smash++; this.bonus += 100; }
    if (this.hooks.smash) this.hooks.smash(t, smash);
  },

  die(t) {
    const p = this.player;
    p.dead = true;
    p.v = 0;
    Cars.wreck(p.car);
    if (t) { Cars.wreck(t.car); t.v = 0; t.dead = true; }
    if (this.hooks.die) this.hooks.die(t);
  },

  // ---- Pickups -------------------------------------------------------------------
  pickups(dt) {
    const p = this.player, top = p.y + this.viewAhead + 120;
    // coins in short lines, now and then a fuel can
    while (this.itemY < top) {
      this.itemY += rand(320, 620);
      const x = pick(BR_LANES), n = randInt(4, 7);
      if (chance(0.12)) this.items.push({ kind: 'fuel', x, y: this.itemY, phase: rand(6) });
      else for (let i = 0; i < n; i++) this.items.push({ kind: 'coin', x, y: this.itemY + i * 34, phase: i * 0.6 });
    }
    while (this.powerY < top) {
      this.powerY += rand(1500, 2300);
      this.items.push({ kind: 'power', type: pick(['speed', 'shield', 'magnet']), x: pick(BR_LANES), y: this.powerY, phase: rand(6) });
    }
    while (this.rampY < top) {
      this.rampY += rand(2200, 3200);
      const x = pick(BR_LANES);
      if (this.laneFree(x, this.rampY, 60)) this.items.push({ kind: 'ramp', x, y: this.rampY });
    }
    const [hw, hl] = Cars.halfSize(p.car);
    for (const it of this.items) {
      if (it.taken) continue;
      if (it.kind === 'ramp') {
        if (p.z === 0 && Math.abs(it.x - p.x) < 20 + hw - 6 && p.y > it.y - RAMP_LEN / 2 && p.y < it.y + RAMP_LEN / 2) {
          it.taken = true;
          p.vz = 250;
          p.z = 0.1;
          this.ramps++;
          this.bonus += 50;
          if (this.hooks.ramp) this.hooks.ramp(it);
        }
        continue;
      }
      // the magnet pulls coins in
      if (p.magnetT > 0 && it.kind === 'coin') {
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < 170 && d > 1) { it.x += (dx / d) * 420 * dt; it.y += (dy / d) * 420 * dt + p.v * dt * 0.6; }
      }
      if (Math.abs(it.x - p.x) < hw + 10 && Math.abs(it.y - p.y) < hl + 12 && p.z < 30) {
        it.taken = true;
        if (it.kind === 'coin') { this.coins++; if (this.hooks.coin) this.hooks.coin(it); }
        else if (it.kind === 'fuel') { this.bonus += 250; if (this.hooks.fuel) this.hooks.fuel(it); }
        else if (it.kind === 'power') {
          if (it.type === 'speed') p.nitroT = POWERUPS.speed.dur;
          if (it.type === 'shield') p.shield = true;
          if (it.type === 'magnet') p.magnetT = POWERUPS.magnet.dur;
          if (this.hooks.power) this.hooks.power(it);
        }
      }
    }
  },

  // ---- Checkpoints (Checkpoint mode) ---------------------------------------------
  checkpoints() {
    if (this.mode !== 'checkpoint') return;
    const p = this.player;
    while (this.cpY < p.y + this.viewAhead + 200) { this.gantries.push({ kind: 'gantry', y: this.cpY, x: 0, n: this.gantries.length + 1 }); this.cpY += 3000; }
    for (const g of this.gantries) {
      if (!g.passed && p.y > g.y) {
        g.passed = true;
        this.cpN++;
        const add = Math.max(10, 20 - this.cpN);
        this.timeLeft += add;
        if (this.hooks.checkpoint) this.hooks.checkpoint(add);
      }
    }
  },

  cull() {
    const low = this.player.y - this.viewBehind - 120;
    this.traffic = this.traffic.filter(t => t.y > low - 200 && (!t.flung || t.flungT < 1.4));
    this.items = this.items.filter(i => !i.taken && i.y > low);
    this.gantries = this.gantries.filter(g => g.y > low);
  },
};
