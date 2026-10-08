'use strict';
// Boom Run: the highway, its traffic, pickups and scenery. World units match
// Road Rush: x runs right, y runs up the screen (the way you drive), z is up.
//
// The loop: weave close past traffic to fill the boost bar, burn it to go
// faster, and when it's full set off BOOM: a few seconds where every car you
// touch goes up, and the wrecks you send flying set off the cars they hit.
// You never slow down: the speed you build up stays with you.

const BR_LANES = [-60, -20, 20, 60];
const BR_ROAD = 80;       // road half-width
const BR_SHOULDER = 98;   // edge of the gravel
const RAMP_LEN = 34;
const BR_WINDOWS = [0, 1, 2, 3].map(k => Array.from({ length: 24 }, (_, i) => ((i * 7 + k * 5) % 9) < 5));
const BOOM_SECS = 6;      // how long BOOM lasts (plus the Long Fuse upgrade)

const BRRoad = {
  player: null,
  traffic: [],
  items: [],
  gantries: [],
  zones: [],     // roadworks and merges: a lane closed between y0 and y1
  tunnels: [],
  hooks: {},
  viewAhead: 700,  // world units visible ahead of the player (set by the view)
  viewBehind: 260,
  viewX: 300,

  reset(mode, garage, paint, up = {}) {
    this.mode = mode;
    this.wrong = mode === 'wrongway';
    this.hyper = mode === 'hyper'; // Hyperdrive: no speed limit at all
    const G = BR_CARS[garage] || BR_CARS.hatch;
    this.G = G;
    this.up = up;
    const car = Cars.make(G.type, paint || G.color, 'N');
    this.player = {
      x: 20, y: 0, z: 0, vz: 0, vx: 0, v: 0, car, dead: false,
      shield: !!G.shield, shields: G.shields || 0, nitroT: 0, magnetT: 0, safeT: 0, steer: 0,
      boost: 0, boomT: 0, burning: false, spinT: 0, spinDir: 1, rumble: false,
    };
    this.traffic = [];
    this.items = [];
    this.gantries = [];
    this.zones = [];
    this.tunnels = [];
    this.carrierAt = 0;
    this.seed = (Math.random() * 1e9) >>> 0; // lays out the scenery
    this.spawnY = 300;
    this.itemY = 500;
    this.powerY = 1600;
    this.rampY = 1800;
    this.featY = 1300;
    this.cpY = 3000;
    this.cpN = 0;
    this.time = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bonus = 0;
    this.coins = 0;
    this.near = 0;
    this.razor = 0;
    this.smash = 0;
    this.ramps = 0;
    this.cones = 0;
    this.bestChain = 0;
    this.booms = 0;
    this.boomKills = 0;
    this.bestBoom = 0;
    this.timeLeft = mode === 'checkpoint' ? 35 : Infinity;
    this.welcomed = 0;
    this.topV = 0;
  },

  get dist() { return Math.max(0, this.player.y); },
  get meters() { return Math.floor(this.dist / 10); },
  get score() { return this.meters + this.bonus; },
  biomeAt(y) { return BR_BIOMES[Math.floor(Math.max(0, y) / BR_SECTION) % BR_BIOMES.length]; },
  inTunnel(y) { return this.tunnels.some(t => y > t.y0 && y < t.y1); },
  // the lane is coned off here
  closed(lane, y, pad = 0) { return this.zones.some(z => z.lane === lane && y > z.y0 - pad && y < z.y1 + pad); },

  // How fast the road wants you to go right now. Hyperdrive just keeps climbing.
  cruise() {
    const d = this.dist, G = this.G;
    const base = this.hyper ? 560 + this.time * 12 : this.wrong ? Math.min(560, 250 + d * 0.01) : Math.min(820, 330 + d * 0.014);
    return base * G.speed;
  },
  get kmh() { return Math.round(this.player.v * 0.036) * 10; },

  // Boost fills from close calls, air, takedowns and the gravel.
  fill(amount) {
    const p = this.player;
    if (p.boomT > 0 || p.dead) return;
    const was = p.boost;
    p.boost = Math.min(1, p.boost + amount * (this.G.boostMul || 1) * (1 + 0.15 * (this.up.tank || 0)));
    if (was < 1 && p.boost >= 1 && this.hooks.boomReady) this.hooks.boomReady();
  },

  // Space (or the BOOM button) with a full bar.
  boom() {
    const p = this.player;
    if (p.dead || p.boost < 1 || p.boomT > 0) return false;
    p.boost = 0;
    p.boomT = BOOM_SECS + (this.up.fuse || 0) + (this.G.boomPlus || 0);
    p.boomKills = 0;
    this.booms++;
    if (this.hooks.boom) this.hooks.boom();
    return true;
  },

  // ---- One step ----------------------------------------------------------------
  update(dt, input) {
    const p = this.player;
    this.time += dt;
    if (p.dead) { this.updateTraffic(dt); return; }
    if (input.boom) this.boom();

    // speed: cruise, plus boost, nitro and BOOM. In Hyperdrive they push your
    // speed up for good instead of lifting it a set amount over the cruise.
    let want = this.cruise();
    p.burning = false;
    if (input.boost && p.boomT <= 0) {
      if (p.boost > 0) { // burning the bar
        want = this.hyper ? Math.max(want, p.v) + 200 * dt : want * 1.3;
        p.burning = true;
        p.boost = Math.max(0, p.boost - dt * 0.3 * (this.G.burnMul || 1));
      }
    }
    // (you keep the speed these give you, so they're gentler than a one-off burst would be)
    if (p.nitroT > 0) want = this.hyper ? Math.max(want, p.v) + 150 * dt : want * 1.35;
    if (p.boomT > 0) want = this.hyper ? Math.max(want, p.v) + 100 * dt : want * 1.25;
    if (input.brake) want = Math.min(want * 0.6, 150); // only the demo car behind the menus brakes
    // you never slow down (the demo car aside, and when the clock runs out)
    else if (!input.auto && this.timeLeft > 0) want = Math.max(want, p.v);
    if (this.timeLeft <= 0) want = 0; // out of time: roll to a stop
    const acc = want > p.v ? (p.burning || p.boomT > 0 ? 520 : 260) * this.G.speed * (this.hyper ? 1.6 : 1) : 520;
    p.v = want > p.v ? Math.min(want, p.v + acc * dt) : Math.max(want, p.v - acc * dt);
    p.y += p.v * dt;
    this.topV = Math.max(this.topV, p.v);
    const gravel = Math.abs(p.x) > BR_ROAD - 2;

    // steering: keys push sideways, a finger or mouse pulls toward a point. On oil you slide.
    const steer = 320 * this.G.grip;
    let vx;
    if (p.spinT > 0) {
      p.spinT -= dt;
      vx = p.vx + p.spinDir * 260 * dt * 6;
    } else if (input.targetX !== null && input.targetX !== undefined) vx = clamp((input.targetX - p.x) * 9, -steer, steer);
    else vx = input.dir * steer;
    p.vx = damp(p.vx, vx, p.spinT > 0 ? 3 : 16, dt);
    const [hw] = Cars.halfSize(p.car);
    p.x = clamp(p.x + p.vx * dt, -BR_SHOULDER + hw + 1, BR_SHOULDER - hw - 1);
    p.steer = p.spinT > 0 ? Math.sin(p.spinT * 14) * 2 : p.vx / steer;
    p.rumble = gravel;
    if (gravel && p.z === 0) this.fill(dt * 0.05); // driving on the edge pays a little

    // jumping off a ramp
    if (p.z > 0 || p.vz > 0) {
      p.vz -= 560 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z > 0) this.fill(dt * 0.22);
      if (p.z === 0 && p.vz < 0) { p.vz = 0; p.ramp = null; if (this.hooks.land) this.hooks.land(); }
    }

    // timers
    if (p.nitroT > 0) p.nitroT -= dt;
    if (p.magnetT > 0) p.magnetT -= dt;
    if (p.safeT > 0) p.safeT -= dt;
    if (p.shieldBackT > 0) { p.shieldBackT -= dt; if (p.shieldBackT <= 0) p.shield = true; }
    if (p.boomT > 0) { p.boomT -= dt; if (p.boomT <= 0 && this.hooks.boomEnd) this.hooks.boomEnd(p.boomKills); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.timeLeft !== Infinity) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0 && p.v < 5 && this.hooks.timeUp) this.hooks.timeUp();
    }

    this.features();
    this.spawn();
    this.updateTraffic(dt);
    this.breakWalls();
    this.makeWay();
    this.collide();
    this.pickups(dt);
    this.checkpoints();
    this.cull();

    // welcome signs mark each new biome
    const sec = Math.floor(p.y / BR_SECTION);
    if (sec > this.welcomed) { this.welcomed = sec; if (this.hooks.biome) this.hooks.biome(this.biomeAt(p.y)); }
  },

  // ---- Things on the road ---------------------------------------------------------------
  // Roadworks, merges, oil, car carriers and tunnels, laid out well ahead of you
  // (before the roadside gets drawn), never closing more than one lane at a time.
  features() {
    const p = this.player, top = p.y + this.viewAhead + 900;
    while (this.featY < top) {
      const y = this.featY;
      // (in Hyperdrive they're spaced by time, not distance, or they'd come thick and fast)
      this.featY += rand(900, 1500) * (this.hyper ? Math.max(1, p.v / 520) : Math.max(0.6, 1.2 - this.dist / 20000));
      if (this.wrong && chance(0.5)) continue;
      const roll = Math.random();
      if (roll < 0.3) { // roadworks: cones down one lane, an arrow board at the start
        const lane = chance(0.5) ? 0 : 3, len = rand(320, 560);
        this.zones.push({ kind: 'works', lane, y0: y, y1: y + len });
        const x = BR_LANES[lane];
        this.items.push({ kind: 'board', x, y: y - 30, dir: lane === 0 ? 1 : -1 });
        for (let yy = y; yy < y + len; yy += 34) this.items.push({ kind: 'cone', x: x + (lane === 0 ? 14 : -14) * Math.min(1, (yy - y) / 120), y: yy });
      } else if (roll < 0.45) { // a lane merge: barrels and chevrons
        const lane = chance(0.5) ? 1 : 2, len = rand(240, 380);
        this.zones.push({ kind: 'merge', lane, y0: y, y1: y + len });
        const x = BR_LANES[lane];
        for (let yy = y; yy < y + len; yy += 40) this.items.push({ kind: 'barrel', x, y: yy });
        this.items.push({ kind: 'chevron', x, y: y - 90, dir: lane === 1 ? -1 : 1 });
      } else if (roll < 0.62) { // an oil slick
        this.items.push({ kind: 'oil', x: pick(BR_LANES) + rand(-6, 6), y, r: rand(16, 22) });
      } else if (roll < 0.8 && !this.wrong) { // a car carrier with a ramp off the back
        this.carrierAt = y;
      } else if (!this.tunnels.some(t => y - t.y1 < 600)) { // a tunnel
        this.tunnels.push({ y0: y, y1: y + rand(520, 900) });
      }
    }
  },

  // ---- Traffic --------------------------------------------------------------------
  // cars per 1000 units of road (Hyperdrive: fewer, spread out by time)
  density() { return this.hyper ? Math.min(6, 3 + this.time / 45) : Math.min(11, 4 + this.dist / 1800); },

  spawn() {
    const p = this.player, top = p.y + this.viewAhead + 160;
    while (this.spawnY < top) {
      this.spawnY += rand(0.6, 1.4) * 1000 / this.density();
      const y = this.spawnY;
      const lanes = BR_LANES.map((x, i) => i).filter(i => this.laneFree(BR_LANES[i], y, 120) && !this.closed(i, y, 160));
      // always leave a way through: never block more than three lanes in one band
      const busy = BR_LANES.filter(x => this.traffic.some(t => Math.abs(t.x - x) < 20 && Math.abs(t.y - y) < 100)).length;
      if (!lanes.length || busy >= 3) continue;
      const lane = pick(lanes);
      if (this.carrierAt && y > this.carrierAt) { // the car carrier takes this slot
        this.carrierAt = 0;
        const car = Cars.make('tanker', '#d62828', 'N');
        car.len = 2.9 * TILE;
        this.traffic.push({ car, carrier: true, x: BR_LANES[lane], y, lane, targetX: BR_LANES[lane], v: rand(110, 140), changeT: 99, blinkT: 0, ahead: true, near: false, rel: y - p.y });
        continue;
      }
      const type = weighted(this.dist > 4000
        ? [['sedan', 4], ['small', 3], ['van', 2], ['pickup', 2], ['taxi', 1.5], ['bus', 1.2], ['tanker', 0.6], ['sports', 0.8], ['police', 0.3], ...luxMix(0.12)]
        : [['sedan', 4], ['small', 3], ['van', 1.5], ['pickup', 1.5], ['taxi', 1], ['bus', 0.6], ...luxMix(0.04)]);
      const car = Cars.make(type, null, this.wrong ? 'S' : 'N');
      const slow = type === 'bus' || type === 'tanker' ? 0.75 : VEHICLE_TYPES[type].lux ? 1.25 : 1; // supercars cruise quicker
      this.traffic.push({
        car, x: BR_LANES[lane], y, lane, targetX: BR_LANES[lane],
        v: (this.wrong ? -rand(100, 170) : rand(120, 210)) * slow,
        changeT: rand(2, 6), blinkT: 0, ahead: true, near: false, rel: y - p.y,
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
      if (t.flung) { // knocked flying: it tumbles, and takes out whatever it lands on
        t.x += t.fvx * dt; t.y += t.fvy * dt; t.spin += dt * 6; t.flungT += dt;
        t.fvx *= Math.exp(-1.6 * dt); t.fvy *= Math.exp(-0.8 * dt);
        if (t.flungT < 1.1) this.chainHits(t);
        continue;
      }
      if (t.dead) continue;
      // keep a gap to the car in front in the same lane
      let v = t.v;
      for (const o of this.traffic) {
        if (o === t || o.flung || Math.abs(o.x - t.x) > 26) continue;
        const ahead = this.wrong ? t.y - o.y : o.y - t.y;
        if (ahead > 0 && ahead < (t.car.len + o.car.len) / 2 + 30) v = this.wrong ? Math.max(v, o.v) : Math.min(v, o.v);
      }
      // a closed lane ahead: move over, or wait at the cones
      const lane = BR_LANES.indexOf(t.targetX);
      if (!this.wrong && lane >= 0 && this.closed(lane, t.y + 140, 0) && !this.closed(lane, t.y, 0)) {
        const opts = [lane - 1, lane + 1].filter(i => i >= 0 && i < BR_LANES.length && !this.closed(i, t.y + 140, 0) && this.laneFree(BR_LANES[i], t.y, 70));
        if (opts.length) { t.next = pick(opts); t.lane = t.next; t.targetX = BR_LANES[t.next]; t.car.blink = BR_LANES[t.next] > t.x ? 1 : -1; }
        else {
          const z = this.zones.find(q => q.lane === lane && t.y + 140 > q.y0);
          if (z) v = Math.min(v, Math.max(0, (z.y0 - 40 - t.y - t.car.len / 2) * 2));
        }
      }
      if (t.hurryT > 0) { t.hurryT -= dt; v = Math.max(v, t.hurry); } // getting out of your way
      else if (t.easeT > 0) { t.easeT -= dt; v *= 0.55; }
      t.y += v * dt;
      // the odd lane change, with a blinker first (later in the run)
      if (!this.wrong && !this.hyper && !p.dead && this.dist > 1200 && !t.carrier) {
        t.changeT -= dt;
        if (t.changeT <= 0 && t.blinkT <= 0 && t.targetX === t.x) {
          t.changeT = rand(3, 8) * Math.max(0.5, 1.6 - this.dist / 8000);
          const opts = [t.lane - 1, t.lane + 1].filter(i => i >= 0 && i < BR_LANES.length && this.laneFree(BR_LANES[i], t.y, 90) && !this.closed(i, t.y, 160));
          if (opts.length && (t.y - p.y > Math.max(150, (p.v - t.v) * 1.6) || t.y < p.y - 80)) { t.next = pick(opts); t.blinkT = 0.9; t.car.blink = BR_LANES[t.next] > t.x ? 1 : -1; }
        }
        if (t.blinkT > 0) {
          t.blinkT -= dt;
          if (t.blinkT <= 0) {
            // look again before moving over: never cut into you or another car (the
            // faster you're coming up behind, the further back it checks)
            const nx = BR_LANES[t.next], closing = Math.max(0, p.v - t.v) * 1.1 + 80;
            const youThere = Math.abs(p.x - nx) < 34 && t.y - p.y > -70 && t.y - p.y < closing;
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

  // A wreck in flight that lands on another car sets that one off too.
  chainHits(t) {
    const [ax, ay] = Cars.halfSize(t.car);
    for (const o of this.traffic) {
      if (o === t || o.flung || o.dead) continue;
      const [bx, by] = Cars.halfSize(o.car);
      if (Math.abs(o.x - t.x) < ax + bx - 2 && Math.abs(o.y - t.y) < ay + by - 2) {
        this.fling(o, true, t);
        t.fvx *= 0.6;
      }
    }
    // a fuel tanker goes up in a ball that takes out everything nearby
    if (t.car.type === 'tanker' && !t.carrier && !t.blasted && t.flungT > 0.15) {
      t.blasted = true;
      for (const o of this.traffic) if (!o.flung && !o.dead && Math.hypot(o.x - t.x, o.y - t.y) < 95) this.fling(o, true, t);
      if (this.hooks.tanker) this.hooks.tanker(t);
    }
  },

  // Never let traffic line up across every lane: there must always be a way
  // through. If four lanes are blocked in one stretch, the car at the back eases off.
  breakWalls() {
    const T = this.traffic.filter(t => !t.flung && !t.dead);
    for (const c of T) {
      const band = T.filter(o => Math.abs(o.y - c.y) < (o.car.len + c.car.len) / 2 + 60);
      const lanes = new Set(band.map(o => BR_LANES.indexOf(o.targetX)));
      for (const z of this.zones) if (c.y > z.y0 - 60 && c.y < z.y1 + 60) lanes.add(z.lane);
      if (lanes.size < BR_LANES.length) continue;
      const back = band.reduce((a, o) => (this.wrong ? (o.y > a.y ? o : a) : (o.y < a.y ? o : a)));
      back.easeT = Math.max(back.easeT || 0, 1.2);
    }
  },

  // There are no brakes, so a car could box you in: one alongside on each side
  // (or the edge of the road) and a slow one dead ahead. When that happens, the
  // car ahead gets out of the way: it moves over if it can, or puts its foot down.
  makeWay() {
    const p = this.player;
    if (p.dead || this.wrong) return;
    let lane = 0;
    BR_LANES.forEach((x, i) => { if (Math.abs(x - p.x) < Math.abs(BR_LANES[lane] - p.x)) lane = i; });
    const way = d => lane + d >= 0 && lane + d < BR_LANES.length && this.laneFree(BR_LANES[lane + d], p.y, 46);
    if (way(-1) || way(1)) return;
    for (const t of this.traffic) {
      if (t.flung || t.dead || t.carrier || t.targetX !== BR_LANES[lane]) continue; // only the car in your lane
      const gap = t.y - p.y;
      if (gap <= 0 || gap > Math.max(150, (p.v - t.v) * 1.3)) continue;
      // (never into a lane you're in or swerving across)
      const opts = [t.lane - 1, t.lane + 1].filter(i => i >= 0 && i < BR_LANES.length && Math.abs(BR_LANES[i] - p.x) > 34 && this.laneFree(BR_LANES[i], t.y, 60));
      if (opts.length && t.x === t.targetX) { t.lane = pick(opts); t.targetX = BR_LANES[t.lane]; t.car.blink = BR_LANES[t.lane] > t.x ? 1 : -1; }
      t.hurry = p.v + 30; t.hurryT = 0.6; // and keeps ahead of you while it does (for as long as you're boxed in)
    }
  },

  // ---- Hits and close calls ----------------------------------------------------------
  collide() {
    const p = this.player;
    const [phx, phy] = Cars.halfSize(p.car);
    for (const t of this.traffic) {
      if (t.flung || t.dead) continue;
      const [thx, thy] = Cars.halfSize(t.car);
      const dx = Math.abs(t.x - p.x), dy = Math.abs(t.y - p.y);
      // where it was a frame ago: at speed you can go from behind it to past it in one step
      const rel = t.y - p.y, was = t.rel === undefined ? rel : t.rel;
      t.rel = rel;
      // close calls: the moment a car drops behind you, how close were you?
      const ahead = t.y > p.y, passed = t.ahead && !ahead;
      if (passed) {
        const gap = dx - phx - thx;
        if (gap < 16 && gap > -2 && p.z < 4 && !t.near && p.boomT <= 0) {
          t.near = true;
          const razor = gap < 6;
          this.combo++;
          this.comboT = 2.6;
          this.near++;
          if (razor) this.razor++;
          this.bonus += (razor ? 40 : 20) * Math.min(10, this.combo);
          this.fill((razor ? 0.13 : 0.07) * (this.G.nearMul || 1));
          if (this.hooks.near) this.hooks.near(t, this.combo, razor);
        }
      }
      t.ahead = ahead;
      // a car carrier: its ramp at the back launches you over it
      if (t.carrier && p.z < 4 && dx < thx + phx - 4) {
        const nose = phy + thy - rel, nose0 = phy + thy - was; // how far your nose is up its ramp (now, and a frame ago)
        if ((nose > 0 && nose < 26) || (nose0 <= 0 && nose >= 26)) { this.launch(380, t); continue; }
      }
      if (p.z > 8 || (t === p.ramp && p.z > 0)) continue; // flying over it (or off the back of it)
      // overlapping it, or gone right through it since the last frame (fast, on a slow computer)
      if (dx < phx + thx - 3 && (dy < phy + thy - 3 || passed)) {
        if (p.boomT > 0 || p.nitroT > 0 || p.safeT > 0) { this.fling(t, true, null); }
        else if (p.shield) {
          p.shield = false;
          if (p.shields > 1) { p.shields--; p.shieldBackT = 6; } // the Gelande's spare comes back
          p.safeT = 1.2;
          this.fling(t, false, null);
          if (this.hooks.shieldBreak) this.hooks.shieldBreak();
        } else {
          this.die(t);
          return;
        }
      }
    }
  },

  // src: the wreck that hit it (a chain), or null when you did.
  fling(t, smash, src) {
    const p = this.player;
    t.flung = true;
    t.flungT = 0;
    t.spin = 0;
    const from = src || p;
    t.fvx = Math.sign(t.x - from.x || (Math.random() - 0.5)) * rand(160, 280);
    t.fvy = src ? src.fvy * 0.7 + rand(-40, 60) : p.v * 0.7;
    t.chain = src ? (src.chain || 1) + 1 : 1;
    Cars.wreck(t.car);
    if (smash) {
      this.smash++;
      const mul = p.boomT > 0 ? 2 : 1;
      this.bonus += 100 * t.chain * mul;
      this.coins += t.chain >= 3 ? 2 : 1;
      this.bestChain = Math.max(this.bestChain, t.chain);
      if (p.boomT > 0) { p.boomKills = (p.boomKills || 0) + 1; this.boomKills++; this.bestBoom = Math.max(this.bestBoom, p.boomKills); }
      else this.fill(0.08);
    }
    if (this.hooks.smash) this.hooks.smash(t, smash, t.chain);
  },

  launch(vz, t) {
    const p = this.player;
    if (p.z > 0.2) return;
    p.vz = vz;
    p.z = 0.1;
    p.ramp = t; // (what you went up: you can't hit it on the way off)
    this.ramps++;
    this.bonus += 50;
    if (this.hooks.ramp) this.hooks.ramp(t);
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
    // coins: short lines, trails that weave between the lanes, now and then a fuel can
    while (this.itemY < top) {
      this.itemY += rand(320, 620) * (this.hyper ? Math.max(1, p.v / 600) : 1);
      const roll = Math.random();
      if (roll < 0.12) this.items.push({ kind: 'fuel', x: pick(BR_LANES), y: this.itemY, phase: rand(6) });
      else if (roll < 0.4 && this.dist > 600) { // a weave across two lanes
        const a = randInt(0, 2), xa = BR_LANES[a], xb = BR_LANES[a + 1], n = randInt(8, 12);
        for (let i = 0; i < n; i++) this.items.push({ kind: 'coin', x: lerp(xa, xb, 0.5 - 0.5 * Math.cos(i / (n - 1) * Math.PI * 2)), y: this.itemY + i * 30, phase: i * 0.6 });
        this.itemY += n * 30;
      } else {
        const x = pick(BR_LANES), n = randInt(4, 7);
        for (let i = 0; i < n; i++) this.items.push({ kind: 'coin', x, y: this.itemY + i * 34, phase: i * 0.6 });
      }
    }
    while (this.powerY < top) {
      this.powerY += rand(1500, 2300) * (this.hyper ? Math.max(1, p.v / 600) : 1);
      this.items.push({ kind: 'power', type: pick(['speed', 'shield', 'magnet']), x: pick(BR_LANES), y: this.powerY, phase: rand(6) });
    }
    while (this.rampY < top) {
      this.rampY += rand(2200, 3200);
      const x = pick(BR_LANES);
      if (this.laneFree(x, this.rampY, 60) && !this.closed(BR_LANES.indexOf(x), this.rampY, 80)) this.items.push({ kind: 'ramp', x, y: this.rampY });
    }
    const [hw, hl] = Cars.halfSize(p.car);
    const pull = 170 * (1 + 0.5 * (this.up.magnet || 0));
    for (const it of this.items) {
      if (it.taken) continue;
      if (it.flying) { it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vz -= 500 * dt; it.spin += dt * 10; if (it.z < -20) it.taken = true; continue; }
      if (it.kind === 'ramp') {
        if (p.z === 0 && Math.abs(it.x - p.x) < 20 + hw - 6 && p.y > it.y - RAMP_LEN / 2 && p.y < it.y + RAMP_LEN / 2) {
          it.taken = true;
          this.launch(250, it);
        }
        continue;
      }
      if (it.kind === 'oil') {
        if (p.z === 0 && p.spinT <= 0 && Math.abs(it.x - p.x) < it.r + hw * 0.4 && Math.abs(it.y - p.y) < it.r * 0.7 + hl * 0.5) {
          p.spinT = 0.8;
          p.spinDir = chance(0.5) ? 1 : -1;
          it.hit = true;
          if (this.hooks.oil) this.hooks.oil(it);
        }
        continue;
      }
      if (it.kind === 'chevron') continue;
      if (it.kind === 'cone' || it.kind === 'barrel' || it.kind === 'board') { // smash them out of the way
        if (p.z < 10 && Math.abs(it.x - p.x) < hw + 6 && Math.abs(it.y - p.y) < hl + 6) {
          it.flying = true;
          it.z = 0; it.spin = 0;
          it.vx = Math.sign(it.x - p.x || 1) * rand(60, 150);
          it.vy = p.v * 0.9 + rand(0, 80);
          it.vz = rand(160, 260);
          const pts = it.kind === 'board' ? 25 : it.kind === 'barrel' ? 10 : 5;
          this.bonus += pts;
          this.cones++;
          this.fill(0.02);
          if (this.hooks.cone) this.hooks.cone(it, pts);
        }
        continue;
      }
      // the magnet pulls coins in
      if (p.magnetT > 0 && it.kind === 'coin') {
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < pull && d > 1) { it.x += (dx / d) * 420 * dt; it.y += (dy / d) * 420 * dt + p.v * dt * 0.6; }
      }
      if (Math.abs(it.x - p.x) < hw + 10 && Math.abs(it.y - p.y) < hl + 12 && p.z < 30) {
        it.taken = true;
        if (it.kind === 'coin') { this.coins++; if (this.hooks.coin) this.hooks.coin(it); }
        else if (it.kind === 'fuel') { this.bonus += 250; this.fill(0.15); if (this.hooks.fuel) this.hooks.fuel(it); }
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
    this.traffic = this.traffic.filter(t => t.y > low - 200 && (!t.flung || t.flungT < 1.6));
    this.items = this.items.filter(i => !i.taken && i.y > low);
    this.gantries = this.gantries.filter(g => g.y > low);
    this.zones = this.zones.filter(z => z.y1 > low);
    this.tunnels = this.tunnels.filter(t => t.y1 > low - 400);
  },
};
