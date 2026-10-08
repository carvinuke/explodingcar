'use strict';
// Traffic Control: the crossings, their lights, the cars and the trains.
// World units match Road Rush: x runs right, y runs up the screen (north),
// z is height. The levels have one crossing, centred on (0, 0); a custom level
// can have up to nine, on east-west avenues (rows) and north-south streets (cols).

const RW = 40;           // road half-width: two lanes, 40 each
const LANE = 20;         // lane centre, from the road's middle
const STOP = RW + 18;    // stop line: front bumpers wait this far from the centre (a crosswalk lies between)
const RAIL_X = 205;      // the railway (Rail Crossing only), running north-south
const RAIL_BAND = 24;    // half-width of the tracks
const GATE = 40;         // crossing gates, this far either side of the tracks
const FAR = 2400;        // paths start this far out
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

// A path through the network, made from the single-crossing path shapes: built
// at the crossing where the car turns (or any crossing on its line), so it starts
// and ends far off screen and runs straight through every other crossing.
function pathAt(kind, h, cx, cy) {
  const p = buildPath(BASE_PATHS[kind].map(([x, y]) => { const [a, b] = ROTATE[h](x, y); return [a + cx, b + cy]; }));
  p.kind = kind;
  return p;
}
// How far along a path a point lies (the point sits on the path).
function sOnPath(path, x, y) {
  const { pts, cum } = path;
  let best = 0, bd = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
    if (d < bd) { bd = d; best = cum[i - 1] + Math.sqrt(L2) * t; }
  }
  return best;
}
const TURN_TO = { left: { E: 'N', N: 'W', W: 'S', S: 'E' }, right: { E: 'S', S: 'W', W: 'N', N: 'E' } };
const SIDE_BACK = { E: 'W', W: 'E', N: 'S', S: 'N' }; // a car heading E comes in from the west side

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
  nodes: [],     // the crossings: { x, y, sides: {N,E,S,W}, ways, lights: {E,W,N,S}, auto }
  entries: [],   // where traffic comes in: { id, h, n (the crossing its path is built at) }
  sel: 0,        // the crossing your keys work on
  lights: {},    // the first crossing's lights (one-crossing levels)
  ways: ['E', 'W', 'N', 'S'],
  level: null,
  hooks: {},
  viewX: 300, viewY: 300, // what's visible either side of the centre (set by the view)

  reset(level, opts = {}) {
    this.level = level;
    this.map = TC_MAPS[level.map];
    this.rail = level.rail !== undefined ? !!level.rail : !!this.map.rail;
    this.cars = [];
    this.yellow = opts.yellow || YELLOW;
    this.towTime = opts.towTime || 5;
    this.waveT = 0;
    this.buildNetwork(level);
    this.spawnT = {};
    for (const e of this.entries) this.spawnT[e.id] = rand(0.3, 2.2);
    this.time = 0;
    this.through = 0;
    this.crashes = 0;
    this.honks = 0;
    this.freezeT = 0;
    this.patienceMul = opts.patienceMul || 1;
    this.rain = !!level.rain;
    this.night = !!level.night;
    this.snow = !!level.snow; // (custom shifts: snow, fog and dusk too)
    this.fog = !!level.fog;
    this.dusk = !!level.dusk;
    this.rush = { t: level.rush ? 35 : Infinity, on: 0 };
    this.lastCrash = null;
    this.nextId = 1;
    this.train = { state: 'idle', next: level.train ? level.train * 0.6 : Infinity, t: 0, gate: 0, cars: [], head: 0, dir: 1, bell: 0 };
  },

  // The crossings and where traffic enters. A level's own `ways` (one crossing)
  // or a custom level's layout, shapes and automatic lights.
  buildNetwork(level) {
    const L = level.grid || TC_LAYOUTS[level.layout || 1]; // (a custom grid comes spaced out already)
    this.nodes = [];
    L.rows.forEach((y, r) => L.cols.forEach((x, k) => {
      const sides = { N: true, E: true, S: true, W: true };
      const shape = level.shapes ? level.shapes[this.nodes.length] : '4';
      if (shape === 'TN') sides.N = false; // a T: the street stops here (only ever on the outside of the grid)
      if (shape === 'TS') sides.S = false;
      const ways = this.nodes.length === 0 && level.ways ? level.ways : ['E', 'W', 'N', 'S'].filter(h => sides[SIDE_BACK[h]]);
      const lights = {};
      for (const h of ['E', 'W', 'N', 'S']) {
        const on = ways.includes(h);
        lights[h] = { state: on && (h === 'E' || h === 'W') ? 'green' : 'red', t: 0, pending: 0, change: 0, on };
      }
      const auto = !!(level.auto && level.auto[this.nodes.length]);
      if (auto) for (const h of ways) lights[h].state = h === ways[0] ? 'green' : 'red'; // one road at a time
      this.nodes.push({ i: this.nodes.length, x, y, r, k, sides, ways, lights, auto, phase: auto ? ways[0] : null, greenT: 0, lastGo: {}, autoT: 3 + this.nodes.length * 1.3 });
    }));
    this.cols = L.cols;
    this.rows = L.rows;
    this.lights = this.nodes[0].lights;
    this.ways = this.nodes[0].ways;
    this.sel = Math.max(0, this.nodes.findIndex(n => !n.auto));
    // traffic comes in at both ends of every avenue, and at every street end that reaches the edge
    this.entries = [];
    const add = (h, n) => this.entries.push({ id: h + n, h, n });
    if (this.nodes.length === 1) for (const h of this.ways) add(h, 0);
    else {
      L.rows.forEach((y, r) => {
        const row = this.nodes.filter(n => n.r === r);
        add('E', row[0].i);
        add('W', row[row.length - 1].i);
      });
      L.cols.forEach((x, k) => {
        const col = this.nodes.filter(n => n.k === k);
        if (col[0].sides.S) add('N', col[0].i);
        if (col[col.length - 1].sides.N) add('S', col[col.length - 1].i);
      });
    }
  },

  // The crossings a car heading h meets after crossing n (not counting n), in order.
  ahead(n, h) {
    const N = this.nodes[n], out = [];
    for (const o of this.nodes) {
      if (o === N) continue;
      if ((h === 'E' || h === 'W') && o.r !== N.r) continue;
      if ((h === 'N' || h === 'S') && o.k !== N.k) continue;
      const d = (o.x - N.x) * HEAD[h][0] + (o.y - N.y) * HEAD[h][1];
      if (d > 0) out.push([d, o]);
    }
    return out.sort((a, b) => a[0] - b[0]).map(p => p[1]);
  },
  // The crossings a car heading h passes before reaching n.
  behind(n, h) { return this.ahead(n, SIDE_BACK[h]).reverse(); },
  // Can a car heading h leave crossing n and drive straight off the map?
  clearTo(n, h) {
    if (!this.nodes[n].sides[h]) return false;
    for (const o of this.ahead(n, h)) if (!o.sides[SIDE_BACK[h]] || !o.sides[h]) return false;
    return true;
  },

  // A route for a car coming in on entry e: straight through, or one turn at one crossing.
  route(e, turnWanted, longVehicle) {
    const line = [...this.behind(e.n, e.h), this.nodes[e.n], ...this.ahead(e.n, e.h)];
    // where it turns: a crossing on its line it can turn out of
    let turnAt = null, kind = 'straight';
    const options = [];
    for (const n of line) for (const k of ['left', 'right']) {
      const h2 = TURN_TO[k][e.h];
      if (n.ways.includes(e.h) && this.clearTo(n.i, h2)) options.push([n, k]);
      if (!n.sides[e.h]) break; // the road ends here
    }
    // a street that ends at a T: it has to turn there
    const end = line.find(n => !n.sides[e.h]);
    if (end) {
      const opts = options.filter(([n]) => n === end);
      if (opts.length) [turnAt, kind] = pick(opts);
    } else if (turnWanted && options.length) {
      const fair = options.filter(([, k]) => !longVehicle || k === 'right' || Math.random() < 0.6);
      [turnAt, kind] = pick(fair.length ? fair : options);
    }
    const at = turnAt || this.nodes[e.n];
    const path = pathAt(kind, e.h, at.x, at.y);
    // the lights it meets, in order
    const idx = line.indexOf(at), visits = line.slice(0, idx + 1).map(n => [n, e.h]);
    if (kind === 'straight') for (const n of line.slice(idx + 1)) visits.push([n, e.h]);
    else for (const n of this.ahead(at.i, TURN_TO[kind][e.h])) visits.push([n, TURN_TO[kind][e.h]]);
    const stops = this.makeStops(path, visits);
    const turnStop = turnAt && stops.find(st => st.n === turnAt.i);
    // (only cars before their first light count as queued on the road they come in on)
    return { path, stops, first: stops[0].s, turnS: turnStop ? turnStop.s : -1, turnNode: turnAt ? turnAt.i : -1, turn: kind === 'straight' ? 0 : kind === 'left' ? -1 : 1 };
  },

  // Stop lines along a path, and for each, the lane it leads into and how many cars fit there.
  makeStops(path, visits) {
    const stops = [];
    for (const [n, h] of visits) {
      if (!n.ways.includes(h)) continue;
      const [sx, sy] = ROTATE[h](-STOP, -LANE);
      stops.push({ s: sOnPath(path, n.x + sx, n.y + sy), n: n.i, h });
    }
    stops.sort((a, b) => a.s - b.s);
    stops.forEach((st, i) => {
      const N = this.nodes[st.n];
      let out = st.s + 8; // where it comes out past the far crosswalk
      while (out < path.len) { const q = posAt(path, out); if (Math.max(Math.abs(q.x - N.x), Math.abs(q.y - N.y)) > RW + 14) break; out += 4; }
      const q = posAt(path, out + 1);
      st.link = st.n + snapHeading(q.hx, q.hy);
      st.cap = i + 1 < stops.length ? stops[i + 1].s - out : Infinity;
    });
    return stops;
  },
  // Room in the lane past this light? Counts the cars already in it, and the ones
  // queued ahead at the same light (they'll get there first). An empty lane always has room.
  // At an automatic crossing, a car that's waited much longer for the same lane at
  // another light has first call on it (or a bus could wait forever behind small cars
  // slipping into every gap).
  roomAfter(car, st) {
    let used = 0;
    const me = st.s - (car.s + car.half), fair = this.nodes[st.n].auto, mine = car.stuckT || 0;
    for (const o of this.cars) {
      if (o === car || o.gone) continue;
      const os = o.stops && o.stops[o.si];
      if (o.link === st.link || (os && !o.wreck && os.n === st.n && os.h === st.h && os.link === st.link && os.s - (o.s + o.half) < me)) used += o.len + 6;
      else if (fair && os && !o.wreck && os.link === st.link && o.stuckT > 10 && o.stuckT > mine + 5 && os.s - (o.s + o.half) < 40) used += o.len + 6;
    }
    return used === 0 || used + car.len + 6 <= st.cap;
  },
  // A turning driver stuck waiting for room gives up and goes straight on, or
  // round the other corner (where the road ends in a T, say), if there's room that way.
  reroute(car) {
    const N = this.nodes[car.turnNode];
    car.fullT = 0;
    const other = car.turn < 0 ? 'right' : 'left';
    for (const [kind, h2] of [['straight', car.h0], [other, TURN_TO[other][car.h0]]]) {
      if (!this.clearTo(N.i, h2)) continue;
      const path = pathAt(kind, car.h0, N.x, N.y);
      const stops = this.makeStops(path, [[N, car.h0], ...this.ahead(N.i, h2).map(n => [n, h2])]);
      if (!stops.length || stops[0].n !== N.i || !this.roomAfter(car, stops[0])) continue;
      const turn = kind === 'straight' ? 0 : kind === 'left' ? -1 : 1;
      Object.assign(car, { path, stops, si: 0, first: stops[0].s, turn, blink: turn, turnNode: turn ? N.i : -1, turnS: turn ? stops[0].s : -1 });
      car.s = sOnPath(path, car.x, car.y);
      this.place(car);
      return;
    }
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
  toggle(h, n = this.sel) {
    const N = this.nodes[n];
    if (!N || N.auto) return false;
    const L = N.lights[h];
    if (!L || !L.on) return false;
    L.pending = 0;
    if (L.state === 'green') { L.state = 'yellow'; L.t = 0; L.change++; }
    else if (L.state === 'yellow') { L.state = 'green'; L.t = 0; }
    else { L.state = 'green'; L.t = 0; }
    return true;
  },

  // Space: every green turns amber then red; every red waits for the crossing to clear, then goes green.
  swap(n = this.sel) {
    const N = this.nodes[n];
    if (!N || N.auto) return false;
    const anyGo = N.ways.some(h => N.lights[h].state !== 'red');
    for (const h of N.ways) {
      const L = N.lights[h];
      if (L.state === 'green') { L.state = 'yellow'; L.t = 0; L.change++; L.pending = 0; }
      else if (L.state === 'red') { L.pending = anyGo ? this.yellow + CLEAR : 0.01; L.t = 0; }
    }
    return true;
  },

  // ---- Lights that run themselves (automatic crossings, and every crossing in a Green Wave):
  // one road at a time, so nothing can cross anything; the road that's waited
  // longest with cars on it goes next, and a green stays on while cars keep coming.

  // Cars coming up to a light (none, if the one at the front has no room past the
  // crossing: its green comes once there's room, so other roads can't starve it).
  queueAt(N, h, near = 240, moving = 0) {
    let n = 0, head = null, headD = Infinity;
    for (const c of this.cars) {
      const st = c.stops && c.stops[c.si];
      if (!st || c.wreck || st.n !== N.i || st.h !== h) continue;
      const d = st.s - (c.s + c.half);
      if (d < headD) { headD = d; head = c; }
      if (d < near && (c.v > moving || d < 40)) n++;
    }
    if (!head) return n;
    const st = head.stops[head.si];
    return head.held || (st.cap < Infinity && headD < 160 && !this.roomAfter(head, st)) ? 0 : n;
  },
  setPhase(N, h) {
    const othersGo = N.ways.some(k => k !== h && N.lights[k].state !== 'red');
    for (const k of N.ways) {
      const L = N.lights[k];
      if (k === h) {
        if (L.state === 'yellow') { L.state = 'green'; L.t = 0; }
        else if (L.state === 'red' && !L.pending) { L.pending = othersGo ? this.yellow + CLEAR : 0.01; L.t = 0; }
      } else {
        L.pending = 0;
        if (L.state === 'green') { L.state = 'yellow'; L.t = 0; L.change++; }
      }
    }
    if (N.phase !== h) { N.phase = h; N.greenT = 0; }
  },
  autoStep(N, dt) {
    N.greenT = (N.greenT || 0) + dt;
    if (N.phase) N.lastGo[N.phase] = this.time;
    // a custom shift's timer lights: every road gets the same green in turn, cars or not
    const timer = N.auto && this.level.timer;
    if (timer) {
      if (N.greenT < timer + this.yellow + CLEAR) return;
      const ways = N.ways;
      this.setPhase(N, ways[(ways.indexOf(N.phase) + 1) % ways.length]);
      return;
    }
    N.autoT -= dt;
    if (N.autoT > 0) return;
    N.autoT = 0.4;
    const cur = N.phase;
    // keep the green while cars are still coming (up to a limit)
    if (cur && N.greenT < (this.level.autoMax || 10) && this.queueAt(N, cur, 120, 15) > 0) return;
    let best = null, score = 0;
    for (const h of N.ways) {
      if (h === cur) continue;
      const q = this.queueAt(N, h);
      const sc = q && q + (this.time - (N.lastGo[h] || 0)) / 4;
      if (sc > score) { score = sc; best = h; }
    }
    if (best) { this.setPhase(N, best); N.autoT = 3.6; }
    else if (cur) this.setPhase(N, cur); // nobody else waiting: stay green
  },
  // The Green Wave power: every crossing runs itself for a while.
  wave(sec = 10) {
    this.waveT = sec;
    for (const N of this.nodes) {
      if (N.auto) continue;
      let best = N.ways[0], most = -1;
      for (const h of N.ways) { const q = this.queueAt(N, h) + (N.lights[h].state === 'green' ? 0.5 : 0); if (q > most) { most = q; best = h; } }
      N.phase = null;
      this.setPhase(N, best);
      N.autoT = 2.5;
    }
  },

  updateLights(dt) {
    if (this.waveT > 0) this.waveT -= dt;
    for (const N of this.nodes) {
      const self = N.auto || this.waveT > 0;
      if (self) this.autoStep(N, dt);
      for (const h of N.ways) {
        const L = N.lights[h];
        L.t += dt;
        if (L.state === 'yellow' && L.t >= this.yellow) { L.state = 'red'; L.t = 0; }
        if (L.pending && L.state === 'red') {
          L.pending -= dt;
          // a light that runs itself also waits for the crossing to be empty
          if (L.pending <= 0 && self && this.boxBusy(N, h)) L.pending = 0.05;
          if (L.pending <= 0) { L.pending = 0; L.state = 'green'; L.t = 0; }
        }
      }
    }
  },
  // Is anything in the crossing, or about to be (too fast to stop for its red)?
  boxBusy(N, h) {
    const dec = this.decel() * 1.9;
    for (const c of this.cars) {
      if (c.wreck || c.gone) continue;
      const [hx, hy] = Cars.halfSize(c);
      if (Math.abs(c.x - N.x) < RW + hx - 2 && Math.abs(c.y - N.y) < RW + hy - 2) return true;
      const st = c.stops && c.stops[c.si];
      if (st && st.n === N.i && st.h !== h && c.v > 10 && st.s - (c.s + c.half) < (c.v * c.v) / (2 * dec) + 6) return true;
    }
    return false;
  },

  // ---- Cars ------------------------------------------------------------------------
  spawn(e) {
    const lv = this.level, h = e.h;
    let type = weighted(lv.mix), medic = false;
    if (lv.ambulance && chance(lv.ambulance)) { type = chance(0.3) ? 'firetruck' : 'ambulance'; medic = true; }
    const long = type === 'bus' || type === 'tanker' || type === 'firetruck';
    let R;
    if (!lv.custom) { // the classic crossing: exactly as it always was
      let turn = 0;
      if (lv.turn && chance(lv.turn)) turn = chance(long ? 0.3 : 0.5) ? -1 : 1;
      const path = PATHS[h][turn === 0 ? 'straight' : turn < 0 ? 'left' : 'right'];
      R = { path, stops: [{ s: path.stopS, n: 0, h }], first: path.stopS, turnS: path.stopS, turn, turnNode: turn ? 0 : -1 };
    } else R = this.route(e, !!(lv.turn && chance(lv.turn)), long);
    const path = R.path;
    const car = Cars.make(type, null, h);
    // start just off the screen edge it comes in from
    const N = this.nodes[R.turnNode >= 0 ? R.turnNode : e.n], u = HEAD[h];
    const edge = (h === 'E' || h === 'W' ? this.viewX : this.viewY) + car.len / 2 + 30;
    car.s = FAR - edge - (N.x * u[0] + N.y * u[1]);
    // room behind the last car on this road?
    if (!lv.custom) {
      for (const o of this.cars) {
        if (o.stream !== e.id || o.s + o.half > o.first + 0.5) continue;
        if (o.s - o.half - (car.s + car.len / 2) < 14) return false;
      }
    } else { // (a network's paths are built at different crossings, so measure on the map)
      const at = posAt(path, car.s);
      for (const o of this.cars) {
        if (o.stream !== e.id || o.si > 0) continue;
        if ((o.x - at.x) * u[0] + (o.y - at.y) * u[1] - o.half - car.len / 2 < 14) return false;
      }
    }
    const T = VEHICLE_TYPES[type];
    Object.assign(car, {
      id: this.nextId++, path, stops: R.stops, first: R.first, si: 0, stream: e.id, approach: h, h0: h, turnNode: R.turnNode, turnS: R.turnS,
      half: car.len / 2, turn: R.turn, blink: R.turn,
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
    // the next light on its way
    let st = car.stops[car.si], lineD = Infinity, mayGo = false;
    car.held = false;
    if (st) {
      const front = car.s + car.half;
      if (front > st.s + 0.5) {
        car.link = st.link;
        car.si++;
        car.committed = car.si >= car.stops.length;
        if (car.si === 1 && !car.didCommit) { car.didCommit = true; if (this.hooks.commit) this.hooks.commit(car); }
        if (car.si < car.stops.length) { car.wait = 0; car.honked = 0; car.rage = false; } // a fresh light, a fresh temper
        st = null;
      } else if (!car.rage && !car.reckless) {
        const L = this.nodes[st.n].lights[st.h], d = st.s - front;
        let stop = L.state === 'red';
        if (L.state === 'yellow' && car.yellowGo !== L.change) {
          const need = (car.v * car.v) / (2 * this.decel());
          if (d > need * 1.15 + 6) stop = true;
          else car.yellowGo = L.change; // too close to stop: keep going
        }
        if (stop) gap = Math.min(gap, d);
        else if (car.v * car.v <= 2 * this.decel() * 1.9 * Math.max(0, d) + 30) { lineD = Math.max(0, d); mayGo = true; } // (still able to stop at the line)
      }
    }
    // the crossing gates
    if (this.rail && this.train.gate > 0.15) {
      if (car.heading === 'W') {
        const front = car.x - car.half, line = RAIL_X + GATE;
        if (front >= line - 1) gap = Math.min(gap, front - line);
      } else if (car.heading === 'E') {
        const front = car.x + car.half, line = RAIL_X - GATE;
        if (front <= line + 1) gap = Math.min(gap, line - front);
      }
    }
    // the car in front (and any wreck in the lane)
    let leadGap = Infinity;
    const net = this.level.custom, myNext = car.stops[car.si], myLast = car.stops[car.si - 1];
    for (const o of this.cars) {
      if (o === car || o.gone) continue;
      const rx = o.x - car.x, ry = o.y - car.y;
      const along = rx * car.ax + ry * car.ay;
      if (along <= 0 || along > 300) continue;
      const same = o.ax === car.ax && o.ay === car.ay;
      // in a network, cars from other roads share lanes: one that came through the
      // same side of the crossing as us is just ahead in our lane, even mid-turn
      const oLast = net && o.stops[o.si - 1];
      const ours = oLast && ((myNext && myNext.n === oLast.n && myNext.h === oLast.h) || (myLast && myLast.n === oLast.n && myLast.h === oLast.h));
      if (!(o.wreck || same || o.stream === car.stream || ours)) continue; // cross traffic: drivers trust their green light
      const [ohx, ohy] = Cars.halfSize(o);
      const oAlong = car.ax !== 0 ? ohx : ohy, oAcross = car.ax !== 0 ? ohy : ohx;
      const lat = Math.abs(rx * car.ay - ry * car.ax);
      if (lat > Cars.HW + oAcross - 5) continue;
      const g = along - car.half - oAlong - 8;
      if (g < leadGap) leadGap = g;
    }
    gap = Math.min(gap, leadGap);
    // custom shifts: green, but don't drive into a crossing without room on the far side
    // (checked even while following another car through)
    if (mayGo && st.cap < Infinity && lineD < 160 && !this.roomAfter(car, st)) {
      if (lineD <= gap) car.held = true;
      gap = Math.min(gap, lineD);
    }
    return gap;
  },

  decel() { return this.rain ? 140 : this.snow ? 115 : 250; },

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
    car.stuckT = car.v < 6 && car.si < car.stops.length ? (car.stuckT || 0) + dt : 0; // (how long it's been waiting at a light)
    if (car.held && car.v < 6) car.fullT = (car.fullT || 0) + dt; // waiting for room past a green...
    else if (car.v > 6) car.fullT = 0; // (...and a red in between doesn't reset it)
    // a turning driver stuck for room gives up: after 8 s held at a green, or (at a crossing
    // that runs itself, which won't waste a green on it) after a long wait for room
    const ts = car.turn && car.stops[car.si];
    if (ts && ts.n === car.turnNode && (car.fullT > 8
      || (car.stuckT > 12 && this.nodes[ts.n].auto && car.stuckT % 2 < dt && !this.roomAfter(car, ts)))) this.reroute(car);
    if (car.blink && car.heading !== car.h0) { // finished turning?
      const T = this.nodes[Math.max(0, car.turnNode)];
      if (Math.abs(car.x - T.x) > RW || Math.abs(car.y - T.y) > RW) car.blink = 0;
    }
    const wasOnTrack = car.onTrack;
    this.place(car);
    car.onTrack = this.rail && Math.abs(car.x - RAIL_X) < RAIL_BAND + car.half && Math.abs(car.y) < RW;
    if (wasOnTrack && !car.onTrack && this.train.state === 'pass') {
      const T = this.train, toRoad = -T.dir * T.head; // how far the train's nose is from the road
      if (toRoad > 0 && toRoad < 420 && this.hooks.closeCall) this.hooks.closeCall(car);
    }

    // patience: waiting drivers get cross, then run the light (not at a crossing that runs itself)
    if (car.si < car.stops.length && car.v < 6 && !this.nodes[car.stops[car.si].n].auto) {
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
        if (!a.wreck && !b.wreck && a.stream === b.stream) continue;
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
    if (!this.rail) return;
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
    for (const e of this.entries) {
      this.spawnT[e.id] -= dt;
      if (this.spawnT[e.id] <= 0) {
        const mean = this.entries.length / rate;
        this.spawnT[e.id] = this.spawn(e) ? Math.max(1.0, mean * (0.45 + Math.random() * 1.1)) : 0.35;
      }
    }

    for (const c of this.cars) if (!c.wreck && !c.gone) this.updateCar(c, dt);
    this.updateTrain(dt);
    this.collide();
    this.updateWrecks(dt);

    // cars that have left the screen
    for (const c of this.cars) {
      if (c.gone || c.wreck) continue;
      if (c.si >= c.stops.length && (Math.abs(c.x) > this.viewX + c.half + 40 || Math.abs(c.y) > this.viewY + c.half + 60)) {
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
      else if (c.wreckT > this.towTime) c.alpha -= dt * 1.2; // towed away
      if (c.alpha <= 0) c.gone = true;
    }
  },
};
