'use strict';
// Traffic Control: the crossroads, its four lights, the cars and the trains.
// World units match Road Rush: x runs right, y runs up the screen (north),
// z is height. The crossing is centred on (0, 0).

const RW = 40;           // road half-width: two lanes, 40 each
const LANE = 20;         // lane centre, from the road's middle
const STOP = RW + 18;    // stop line: front bumpers wait this far from the centre (a crosswalk lies between)
const RAIL_X = 205;      // the railway (Rail Crossing only), running north-south
const RAIL_BAND = 24;    // half-width of the tracks
const GATE = 40;         // crossing gates, this far either side of the tracks
const FAR = 1400;        // paths start this far out
const YELLOW = 1.1;      // seconds of amber
const CLEAR = 0.7;       // all-red pause when Space switches the lights

const HEAD = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
const ROTATE = { E: (x, y) => [x, y], N: (x, y) => [-y, x], W: (x, y) => [-x, -y], S: (x, y) => [y, -x] };
const snapHeading = (hx, hy) => (Math.abs(hx) >= Math.abs(hy) ? (hx >= 0 ? 'E' : 'W') : (hy >= 0 ? 'N' : 'S'));

// ---- Paths -----------------------------------------------------------------------
// Built for traffic heading east, then turned to face each way. Every path shares
// the same approach up to the stop line, so cars queue on it the same way.
function buildPath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1], stopS: FAR - STOP };
}
function arc(cx, cy, r, a0, a1, n = 12) {
  const out = [];
  for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
const BASE_PATHS = {
  straight: [[-FAR, -LANE], [-RW, -LANE], [RW, -LANE], [FAR, -LANE]],
  // right: a tight corner into the southbound lane
  right: [[-FAR, -LANE], [-RW, -LANE], ...arc(-RW, -RW, LANE, Math.PI / 2, 0), [-LANE, -FAR]],
  // left: a wide sweep across the crossing into the northbound lane
  left: [[-FAR, -LANE], [-RW, -LANE], ...arc(-RW, RW, RW + LANE, -Math.PI / 2, 0, 16), [LANE, FAR]],
};
const PATHS = {};
for (const h in ROTATE) {
  PATHS[h] = {};
  for (const k in BASE_PATHS) {
    PATHS[h][k] = buildPath(BASE_PATHS[k].map(([x, y]) => ROTATE[h](x, y)));
    PATHS[h][k].kind = k;
  }
}

function posAt(path, s) {
  const { pts, cum } = path;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1;
  const t = clamp((s - cum[i - 1]) / seg, 0, 1);
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, hx: (b[0] - a[0]) / seg, hy: (b[1] - a[1]) / seg };
}

// ---- The simulation ----------------------------------------------------------------
const TCSim = {
  cars: [],
  lights: {},
  ways: ['E', 'W', 'N', 'S'],
  level: null,
  hooks: {},
  viewX: 300, viewY: 300, // what's visible either side of the centre (set by the view)

  reset(level, opts = {}) {
    this.level = level;
    this.map = TC_MAPS[level.map];
    this.cars = [];
    this.ways = level.ways || ['E', 'W', 'N', 'S'];
    this.lights = {};
    for (const h of ['E', 'W', 'N', 'S']) {
      const on = this.ways.includes(h);
      this.lights[h] = { state: on && (h === 'E' || h === 'W') ? 'green' : 'red', t: 0, pending: 0, change: 0, on };
    }
    this.spawnT = {};
    for (const h of this.ways) this.spawnT[h] = rand(0.3, 2.2);
    this.time = 0;
    this.through = 0;
    this.crashes = 0;
    this.honks = 0;
    this.freezeT = 0;
    this.patienceMul = opts.patienceMul || 1;
    this.rain = !!level.rain;
    this.night = !!level.night;
    this.rush = { t: level.rush ? 35 : Infinity, on: 0 };
    this.lastCrash = null;
    this.nextId = 1;
    this.train = { state: 'idle', next: level.train ? level.train * 0.6 : Infinity, t: 0, gate: 0, cars: [], head: 0, dir: 1, bell: 0 };
  },

  // Swap in the next Endless difficulty without disturbing anything on the road.
  setLevel(level) {
    const trainWas = this.level && this.level.train;
    this.level = level;
    this.rain = !!level.rain;
    this.night = !!level.night;
    if (level.rush && this.rush.t === Infinity) this.rush.t = 20;
    if (level.train && !trainWas && this.train.state === 'idle') this.train.next = 8;
  },

  // ---- Lights ----------------------------------------------------------------------
  toggle(h) {
    const L = this.lights[h];
    if (!L || !L.on) return false;
    L.pending = 0;
    if (L.state === 'green') { L.state = 'yellow'; L.t = 0; L.change++; }
    else if (L.state === 'yellow') { L.state = 'green'; L.t = 0; }
    else { L.state = 'green'; L.t = 0; }
    return true;
  },

  // Space: every green turns amber then red; every red waits for the crossing to clear, then goes green.
  swap() {
    const anyGo = this.ways.some(h => this.lights[h].state !== 'red');
    for (const h of this.ways) {
      const L = this.lights[h];
      if (L.state === 'green') { L.state = 'yellow'; L.t = 0; L.change++; L.pending = 0; }
      else if (L.state === 'red') { L.pending = anyGo ? YELLOW + CLEAR : 0.01; L.t = 0; }
    }
  },

  updateLights(dt) {
    for (const h of this.ways) {
      const L = this.lights[h];
      L.t += dt;
      if (L.state === 'yellow' && L.t >= YELLOW) { L.state = 'red'; L.t = 0; }
      if (L.pending && L.state === 'red') {
        L.pending -= dt;
        if (L.pending <= 0) { L.pending = 0; L.state = 'green'; L.t = 0; }
      }
    }
  },

  // ---- Cars ------------------------------------------------------------------------
  spawn(h) {
    const lv = this.level;
    let type = weighted(lv.mix), medic = false;
    if (lv.ambulance && chance(lv.ambulance)) { type = chance(0.3) ? 'firetruck' : 'ambulance'; medic = true; }
    const long = type === 'bus' || type === 'tanker' || type === 'firetruck';
    let turn = 0;
    if (lv.turn && chance(lv.turn)) turn = chance(long ? 0.3 : 0.5) ? -1 : 1;
    const path = PATHS[h][turn === 0 ? 'straight' : turn < 0 ? 'left' : 'right'];
    const car = Cars.make(type, null, h);
    const dist = (h === 'E' || h === 'W' ? this.viewX : this.viewY) + car.len / 2 + 30;
    car.s = FAR - dist;
    // room behind the last car on this road?
    for (const o of this.cars) {
      if (o.approach !== h || o.committed) continue;
      if (o.s - o.half - (car.s + car.len / 2) < 14) return false;
    }
    const T = VEHICLE_TYPES[type];
    Object.assign(car, {
      id: this.nextId++, path, approach: h, half: car.len / 2, turn, blink: turn,
      vmax: 100 * (lv.speed || 1) * clamp(T.speed, 0.8, 1.2) * rand(0.93, 1.07) * (medic ? 1.15 : 1),
      wait: 0, honked: 0, rage: false, medic, committed: false, alpha: 1,
      reckless: !medic && !!lv.reckless && chance(lv.reckless),
    });
    car.v = car.vmax * 0.85;
    car.patience = lv.patience * this.patienceMul * (medic ? 0.45 : 1) * rand(0.9, 1.1);
    this.place(car);
    this.cars.push(car);
    return true;
  },

  place(car) {
    const p = posAt(car.path, car.s);
    car.x = p.x; car.y = p.y; car.hx = Math.round(p.hx * 1000) / 1000; car.hy = Math.round(p.hy * 1000) / 1000;
    const h = snapHeading(p.hx, p.hy);
    car.heading = h;
    car.ax = HEAD[h][0]; car.ay = HEAD[h][1];
  },

  // How far this car can go before it must be stopped (Infinity: the road is clear).
  gapAhead(car) {
    let gap = Infinity;
    // the light
    if (!car.committed) {
      const front = car.s + car.half;
      if (front > car.path.stopS + 0.5) {
        car.committed = true;
        if (this.hooks.commit) this.hooks.commit(car);
      } else if (!car.rage && !car.reckless) {
        const L = this.lights[car.approach], d = car.path.stopS - front;
        let stop = L.state === 'red';
        if (L.state === 'yellow' && car.yellowGo !== L.change) {
          const need = (car.v * car.v) / (2 * this.decel());
          if (d > need * 1.15 + 6) stop = true;
          else car.yellowGo = L.change; // too close to stop: keep going
        }
        if (stop) gap = Math.min(gap, d);
      }
    }
    // the crossing gates
    if (this.map.rail && this.train.gate > 0.15) {
      if (car.heading === 'W') {
        const front = car.x - car.half, line = RAIL_X + GATE;
        if (front >= line - 1) gap = Math.min(gap, front - line);
      } else if (car.heading === 'E') {
        const front = car.x + car.half, line = RAIL_X - GATE;
        if (front <= line + 1) gap = Math.min(gap, line - front);
      }
    }
    // the car in front (and any wreck in the lane)
    for (const o of this.cars) {
      if (o === car || o.gone) continue;
      const rx = o.x - car.x, ry = o.y - car.y;
      const along = rx * car.ax + ry * car.ay;
      if (along <= 0 || along > 300) continue;
      const same = o.ax === car.ax && o.ay === car.ay;
      if (!(o.wreck || same || o.approach === car.approach)) continue; // cross traffic: drivers trust their green light
      const [ohx, ohy] = Cars.halfSize(o);
      const oAlong = car.ax !== 0 ? ohx : ohy, oAcross = car.ax !== 0 ? ohy : ohx;
      const lat = Math.abs(rx * car.ay - ry * car.ax);
      if (lat > Cars.HW + oAcross - 5) continue;
      gap = Math.min(gap, along - car.half - oAlong - 8);
    }
    return gap;
  },

  decel() { return this.rain ? 140 : 250; },

  updateCar(car, dt) {
    const gap = this.gapAhead(car);
    const dec = this.decel();
    let want = car.vmax;
    if (gap < 400) want = Math.min(want, Math.sqrt(2 * dec * Math.max(0, gap)));
    if (gap <= 0.5) want = 0;
    if (want > car.v) car.v = Math.min(want, car.v + 115 * dt);
    else car.v = Math.max(want, car.v - dec * 1.9 * dt);
    car.brake = want < car.vmax - 5 && car.v > 2 ? true : car.v < 3 && !car.committed;
    car.s += car.v * dt;
    if (car.blink && car.committed && car.heading !== car.approach && (Math.abs(car.x) > RW || Math.abs(car.y) > RW)) car.blink = 0; // finished turning
    const wasOnTrack = car.onTrack;
    this.place(car);
    car.onTrack = this.map.rail && Math.abs(car.x - RAIL_X) < RAIL_BAND + car.half && Math.abs(car.y) < RW;
    if (wasOnTrack && !car.onTrack && this.train.state === 'pass') {
      const T = this.train, toRoad = -T.dir * T.head; // how far the train's nose is from the road
      if (toRoad > 0 && toRoad < 420 && this.hooks.closeCall) this.hooks.closeCall(car);
    }

    // patience: waiting drivers get cross, then run the light
    if (!car.committed && car.v < 6) {
      car.wait += dt;
      if (car.wait >= car.patience) {
        if (!car.honked || car.wait - car.honked > 1.5) {
          car.honked = car.wait;
          this.honks++;
          if (this.hooks.honk) this.hooks.honk(car);
        }
        if (car.wait >= car.patience + 3 && !car.rage) { car.rage = true; if (this.hooks.rage) this.hooks.rage(car); }
      }
    }
  },

  // ---- Crashes -----------------------------------------------------------------------
  collide() {
    const cars = this.cars;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (a.gone) continue;
      const [ahx, ahy] = Cars.halfSize(a);
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (b.gone || (a.wreck && b.wreck)) continue;
        if (!a.wreck && !b.wreck && a.approach === b.approach) continue;
        const [bhx, bhy] = Cars.halfSize(b);
        if (Math.abs(a.x - b.x) < ahx + bhx - 4 && Math.abs(a.y - b.y) < ahy + bhy - 4) this.crash([a, b]);
      }
    }
  },

  crash(list, train) {
    const hit = list.filter(c => !c.wreck);
    if (!hit.length) return;
    const x = list.reduce((s, c) => s + c.x, 0) / list.length, y = list.reduce((s, c) => s + c.y, 0) / list.length;
    for (const c of hit) { Cars.wreck(c); c.v = 0; c.wreckT = 0; c.alpha = 1; }
    // crashes close together in time and place are one pile-up: one strike
    const L = this.lastCrash;
    const pile = L && this.time - L.t < 2.5 && Math.hypot(L.x - x, L.y - y) < 160;
    if (pile) { L.n += hit.length; L.t = this.time; }
    else { this.crashes++; this.lastCrash = { x, y, t: this.time, n: list.length }; }
    if (this.hooks.crash) this.hooks.crash({ x, y, cars: list, newStrike: !pile, pile: this.lastCrash.n, train: !!train, tanker: list.some(c => c.type === 'tanker') });
  },

  // ---- Trains ------------------------------------------------------------------------
  updateTrain(dt) {
    const T = this.train;
    if (!this.map.rail) return;
    if (T.state === 'idle') {
      T.gate = Math.max(0, T.gate - dt / 1.2);
      if (!this.level.train) return;
      T.next -= dt;
      if (T.next <= 0) {
        T.state = 'warn'; T.t = 0; T.dir = chance(0.5) ? 1 : -1; T.bell = 0;
        const n = randInt(3, 6);
        T.cars = [{ len: 120, color: pick(['#c8102e', '#1d4f91', '#f26722']), loco: true }];
        for (let i = 0; i < n; i++) T.cars.push({ len: 106, color: pick(['#6b3f21', '#5b616b', '#2f6b4a', '#8a5a2a', '#3d5a80']) });
        T.length = T.cars.reduce((s, c) => s + c.len + 6, 0);
        if (this.hooks.trainWarn) this.hooks.trainWarn();
      }
    } else if (T.state === 'warn') {
      T.t += dt;
      T.gate = Math.min(1, T.gate + dt / 1.2);
      if (T.t >= 4.6) {
        T.state = 'pass';
        T.head = -T.dir * (this.viewY + 80); // nose just off screen on the far side
        if (this.hooks.trainHorn) this.hooks.trainHorn();
      }
    } else if (T.state === 'pass') {
      T.head += T.dir * 360 * dt;
      T.gate = 1;
      const tail = T.head - T.dir * T.length;
      // anything on the tracks gets hit
      const y0 = Math.min(T.head, tail), y1 = Math.max(T.head, tail);
      for (const c of this.cars) {
        if (c.gone) continue;
        const [hx, hy] = Cars.halfSize(c);
        if (Math.abs(c.x - RAIL_X) < 17 + hx - 2 && c.y + hy > y0 && c.y - hy < y1) {
          if (!c.wreck) this.crash([c], true);
          c.trainHit = true;
        }
      }
      if (T.dir * tail > this.viewY + 100) { T.state = 'idle'; T.next = this.level.train * rand(0.85, 1.2); }
    }
    if (T.state !== 'idle') {
      T.bell -= dt;
      if (T.bell <= 0) { T.bell = 0.55; if (this.hooks.bell) this.hooks.bell(); }
    }
  },

  // Positions of the train's cars (for drawing), nose first.
  trainCars() {
    const T = this.train, out = [];
    if (T.state !== 'pass') return out;
    let y = T.head;
    for (const c of T.cars) {
      out.push({ car: c, x: RAIL_X, y: y - T.dir * c.len / 2, toward: T.dir < 0 });
      y -= T.dir * (c.len + 6);
    }
    return out;
  },

  // ---- Power-ups -----------------------------------------------------------------
  freeze(sec = 3) { this.freezeT = sec; },
  tow() {
    let n = 0;
    for (const c of this.cars) if (c.wreck && !c.towing) { c.towing = true; n++; }
    return n;
  },
  calm() { for (const c of this.cars) { c.wait = 0; c.honked = 0; c.rage = false; } },

  // ---- One step ------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.updateLights(dt);
    if (this.freezeT > 0) { this.freezeT -= dt; this.updateWrecks(dt); return; }

    // rush hour waves
    const R = this.rush;
    if (R.on > 0) { R.on -= dt; if (R.on <= 0 && this.hooks.rush) this.hooks.rush(false); }
    else if (this.level.rush) {
      R.t -= dt;
      if (R.t <= 0) { R.on = 12; R.t = rand(45, 60); if (this.hooks.rush) this.hooks.rush(true); }
    }

    // new cars
    const rate = this.level.rate * (R.on > 0 ? 1.8 : 1);
    for (const h of this.ways) {
      this.spawnT[h] -= dt;
      if (this.spawnT[h] <= 0) {
        const mean = this.ways.length / rate;
        this.spawnT[h] = this.spawn(h) ? Math.max(1.0, mean * (0.45 + Math.random() * 1.1)) : 0.35;
      }
    }

    for (const c of this.cars) if (!c.wreck && !c.gone) this.updateCar(c, dt);
    this.updateTrain(dt);
    this.collide();
    this.updateWrecks(dt);

    // cars that have left the screen
    for (const c of this.cars) {
      if (c.gone || c.wreck) continue;
      if (c.committed && (Math.abs(c.x) > this.viewX + c.half + 40 || Math.abs(c.y) > this.viewY + c.half + 60)) {
        c.gone = true;
        this.through++;
        if (this.hooks.through) this.hooks.through(c);
      }
    }
    this.cars = this.cars.filter(c => !c.gone);
  },

  updateWrecks(dt) {
    for (const c of this.cars) {
      if (!c.wreck) continue;
      c.wreckT += dt;
      if (c.towing) c.alpha -= dt * 2.5;
      else if (c.wreckT > 5) c.alpha -= dt * 1.2; // towed away
      if (c.alpha <= 0) c.gone = true;
    }
  },
};
