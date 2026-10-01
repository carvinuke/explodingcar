'use strict';
// Endless world generation: rows of ground, road, railroad, river and
// construction work, streamed in ahead of the player and dropped once they
// fall behind. The world passes through biomes (countryside, city, desert,
// mountain pass), each with its own ground, scenery, hazards and weather.
// Layout uses the seeded `Gen`, so one seed always builds the same road.

// Countryside palettes rotate every ~48 rows for a gentle change of scenery.
const COUNTRY = [
  { grass: ['#94d36b', '#8acb62'], edge: '#5e8f3e', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'],
    bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'], flowers: ['#ffffff', '#ffd6e7', '#fff08a'] },
  { grass: ['#a8d66a', '#9fce60'], edge: '#6f8f3a', tree: ['#7ab648', '#5f9738', '#8fcb58', '#72ad44'],
    bush: ['#86c052', '#6aa141', '#98cf62', '#7bb44c'], flowers: ['#ffb3c7', '#ffffff', '#c9b6ff'] },
  { grass: ['#7fca7c', '#76c174'], edge: '#4b8a52', tree: ['#2f9a63', '#237a4d', '#3fb074', '#2e905b'],
    bush: ['#3fa86a', '#2f8a55', '#52bb7c', '#3c9d63'], flowers: ['#ffffff', '#9fd8ff', '#ffe08a'] },
  { grass: ['#c8cc6f', '#bfc365'], edge: '#8e8a45', tree: ['#e59a3a', '#c47c26', '#f0b24e', '#d48c30'],
    bush: ['#d0a24a', '#b0873a', '#dbb35d', '#c09441'], flowers: ['#ffffff', '#ffcf8a', '#ff9e9e'] },
];

const ZONES = {
  country: {
    name: 'THE COUNTRYSIDE', sub: 'Watch for cows and deer on the road',
    weather: [['clear', 5], ['rain', 3], ['snow', 1]], work: 0.45, rail: 1.1, river: 1.3, lanes: 0,
    bg: '#6fae55',
  },
  city: {
    name: 'THE CITY', sub: 'Heavy traffic, trams and road work',
    weather: [['clear', 5], ['rain', 3]], work: 1.4, rail: 1.2, river: 0.7, lanes: 1,
    bg: '#8f939b',
    pal: { grass: ['#c3c6cc', '#bcbfc6'], edge: '#8a8e96', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'],
           bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'], flowers: ['#ffffff'] },
  },
  desert: {
    name: 'THE DESERT', sub: 'Dust storms hide the road ahead',
    weather: [['clear', 4], ['dust', 3]], work: 0.35, rail: 1.5, river: 0, lanes: 0,
    bg: '#d9bd84',
    pal: { grass: ['#ead29b', '#e4ca91'], edge: '#b8925a', tree: ['#5f9e4a', '#437a35', '#76b35c', '#548f41'],
           bush: ['#a79a5c', '#857a45', '#b8ab6a', '#958a52'], flowers: ['#c9a36a'] },
  },
  beach: {
    name: 'THE BEACH', sub: 'Surfboards on the water. Guard your coins from the gulls',
    weather: [['clear', 5], ['rain', 2]], work: 0.3, rail: 0.6, river: 1.9, lanes: 0,
    bg: '#e9d49a',
    pal: { grass: ['#f2dfa7', '#eed99c'], edge: '#cdb277', tree: ['#3fa34d', '#2e7f3a', '#52b85e', '#38914a'],
           bush: ['#6dae55', '#548d42', '#7fc063', '#619f4b'], flowers: ['#f7f0dc'] },
  },
  farm: {
    name: 'FARMLAND', sub: 'Tall corn hides the road. Slow tractors, loose sheep',
    weather: [['clear', 5], ['rain', 2]], work: 0.2, rail: 0.8, river: 1.0, lanes: 0,
    bg: '#a9c45e',
    pal: { grass: ['#b9d46a', '#b1cc61'], edge: '#7d8f3a', tree: ['#6cae4a', '#4f8c37', '#82c15c', '#62a243'],
           bush: ['#8cc054', '#6ea041', '#9ccf64', '#7fb24c'], flowers: ['#ffe066', '#ffffff', '#ffb347'] },
  },
  swamp: {
    name: 'THE SWAMP', sub: "Lily pads sink if you don't keep moving",
    weather: [['fog', 4], ['rain', 2], ['clear', 1]], work: 0.1, rail: 0.4, river: 2.2, lanes: 0,
    bg: '#5d7a45',
    pal: { grass: ['#6f8f4a', '#688744'], edge: '#4a5e30', tree: ['#4f6b3a', '#3a522a', '#5f7d46', '#465f34'],
           bush: ['#5a7a3e', '#45602f', '#6a8a4a', '#526f39'], flowers: ['#c9d98a', '#e8d6ff'] },
  },
  autumn: {
    name: 'THE AUTUMN WOODS', sub: 'Leaf piles slow you down. Watch for logging trucks',
    weather: [['leaves', 4], ['clear', 2], ['rain', 2]], work: 0.3, rail: 0.9, river: 1.1, lanes: 0,
    bg: '#b89a5a',
    pal: { grass: ['#c9b56a', '#c1ad60'], edge: '#8e7a3d', tree: ['#e8742a', '#c25a1a', '#f2a23a', '#d1821f'],
           bush: ['#d18a3a', '#b06f2a', '#e0a050', '#c08038'], flowers: ['#e8742a', '#ffd23f', '#a8641f'] },
  },
  harbor: {
    name: 'THE HARBOR', sub: 'Ride the ferries. Forklifts on the docks',
    weather: [['clear', 3], ['rain', 3], ['fog', 1]], work: 0.4, rail: 0.7, river: 1.7, lanes: 0,
    bg: '#5a6b78',
    pal: { grass: ['#a07a52', '#9a744c'], edge: '#6b4f33', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'],
           bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'], flowers: ['#7a5a3a'] },
  },
  snow: {
    name: 'THE MOUNTAIN PASS', sub: 'Ice patches: you will slide',
    weather: [['snow', 1]], work: 0.2, rail: 1.1, river: 1.2, lanes: 0,
    bg: '#dfe8f1',
    pal: { grass: ['#f1f5fa', '#e9eff6'], edge: '#aebfd1', tree: ['#2f7a5a', '#215c43', '#3a8d68', '#2a6c50'],
           bush: ['#4f8a6c', '#3b6f55', '#5f9a7b', '#487f63'], flowers: ['#ffffff'] },
  },
};

const WEATHER_SECTION = 60; // rows per weather zone
const FIRST_ZONE = 80;      // rows of countryside before the first change
const ZONE_LEN = 90;        // rows per biome after that

const World = {
  rows: new Map(),
  minRow: 0,
  maxRow: 0,
  pathCol: START_COL,
  seg: null,
  laneMargin: 12 * TILE, // how far off-screen lanes extend (set on resize)
  speedMul: 1,
  gapMul: 1,
  powerups: true,

  reset(seed, opts = {}) {
    Gen.seed(seed);
    // biome order and weather are decided up front from their own stream,
    // so they don't depend on how far ahead rows have been generated
    const r = mulberry32(seed ^ 0x5bd1e995);
    this.zoneSeq = [];
    const others = ['city', 'desert', 'snow', 'beach', 'farm', 'swamp', 'autumn', 'harbor'];
    for (let lap = 0; lap < 12; lap++) {
      const o = others.slice();
      for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; }
      this.zoneSeq.push(...o, 'country');
    }
    this.weatherRolls = [];
    for (let k = 0; k < 200; k++) this.weatherRolls.push(r());

    this.speedMul = opts.speedMul || 1;
    this.gapMul = opts.gapMul || 1;
    this.powerups = opts.powerups !== false;
    this.rows.clear();
    this.pathCol = START_COL;
    this.seg = { type: 'grass', left: 0 };
    this.lastRail = -100;
    this.lastRiver = -100;
    this.lastWork = -100;
    this.signedZone = 'country';
    this.minRow = -16;
    this.maxRow = this.minRow - 1;
    this.ensure(30);
  },

  zoneAt(row) {
    if (row < FIRST_ZONE) return 'country';
    return this.zoneSeq[Math.floor((row - FIRST_ZONE) / ZONE_LEN) % this.zoneSeq.length];
  },

  palette(i, zone) {
    return zone === 'country' ? COUNTRY[Math.floor(Math.max(0, i) / 48) % COUNTRY.length] : ZONES[zone].pal;
  },

  weatherAt(row) {
    const sec = Math.floor(Math.max(0, row) / WEATHER_SECTION);
    if (sec === 0) return 'clear';
    const w = ZONES[this.zoneAt(row)].weather;
    let total = 0;
    for (const e of w) total += e[1];
    let x = this.weatherRolls[sec % this.weatherRolls.length] * total;
    for (const e of w) if ((x -= e[1]) <= 0) return e[0];
    return w[w.length - 1][0];
  },

  ensure(upTo) {
    while (this.maxRow < upTo) this.generate(this.maxRow + 1);
  },

  cull(below) {
    while (this.minRow < below) this.rows.delete(this.minRow++);
    Items.cull(this.minRow);
  },

  // Is this grid cell off-limits for the player? Water, track and pits are
  // walkable (and dangerous); only scenery and road-work gear block movement.
  isBlocked(col, row) {
    if (col < 0 || col >= COLS || row < 0) return true;
    const r = this.rows.get(row);
    return !r || ((r.type === 'grass' || r.type === 'work') && r.blocked[col]);
  },

  generate(i) {
    let row;
    if (i < 0) row = this.makeGrass(i, 'backdrop');
    else if (i < 4) row = this.makeGrass(i, 'start');
    else {
      if (this.seg.left <= 0) this.nextSegment(i);
      const t = this.seg.type;
      row = t === 'road' ? this.makeRoad(i) : t === 'rail' ? this.makeRail(i) : t === 'river' ? this.makeRiver(i)
        : t === 'work' ? this.makeWork(i) : this.makeGrass(i, 'normal');
      this.seg.left--;
    }
    this.rows.set(i, row);
    this.maxRow = i;
    if (i >= 3) Items.populateRow(row);
  },

  // Ground strips alternate with hazards. Roads are the norm; railroads, rivers
  // and road work are rarer, never back to back, and each needs a gap before it repeats.
  nextSegment(i) {
    const d = difficulty(i), zone = this.zoneAt(i), Z = ZONES[zone];
    if (this.seg.type !== 'grass') {
      // strips vary a lot: a one-row breather, or a wide meadow now and then
      const len = Gen.weighted([[1, 3], [2, 4], [3, 3], [4, 1.6], [5, 0.9], [6, 0.4]]);
      this.seg = { type: 'grass', left: d > 0.5 && len > 2 ? len - 1 : len };
      return;
    }
    const sinceSpecial = i - Math.max(this.lastRail, this.lastRiver);
    const railOk = i >= 14 && i - this.lastRail >= Gen.int(14, 24) && sinceSpecial >= 7;
    const riverOk = Z.river > 0 && i >= 18 && i - this.lastRiver >= Gen.int(16, 28) && sinceSpecial >= 7;
    const workOk = i >= 12 && i - this.lastWork >= Gen.int(10, 18);
    const kind = Gen.weighted([
      ['road', 6], ['rail', railOk ? Z.rail : 0], ['river', riverOk ? Z.river : 0], ['work', workOk ? Z.work : 0],
    ]);
    if (kind === 'rail') {
      this.seg = { type: 'rail', left: 1 };
      this.lastRail = i;
      return;
    }
    if (kind === 'work') {
      this.seg = { type: 'work', left: Gen.chance(0.25) ? 2 : 1 };
      this.lastWork = i;
      return;
    }
    if (kind === 'river') {
      const n = Gen.weighted([[1, 5], [2, 3], [3, d > 0.4 ? 1.2 : 0]]);
      const d0 = Gen.chance(0.5) ? 1 : -1;
      const dirs = [];
      for (let k = 0; k < n; k++) dirs.push(k % 2 ? -d0 : d0);
      this.seg = { type: 'river', left: n, n, dirs, k: 0 };
      this.lastRiver = i + n - 1;
      return;
    }
    const maxLanes = Math.min(6, 2 + Math.round(d * 3) + Z.lanes); // 2 -> 5 (6 in the city)
    const n = d < 0.08 ? Gen.int(1, 2) : Gen.int(1 + Z.lanes, maxLanes);
    const d0 = Gen.chance(0.5) ? 1 : -1;
    const oneWay = n > 1 && Gen.chance(0.25);
    const alternate = !oneWay && n > 2 && Gen.chance(0.35);
    const dirs = [];
    for (let k = 0; k < n; k++) {
      if (oneWay) dirs.push(d0);
      else if (alternate) dirs.push(k % 2 ? -d0 : d0);
      else dirs.push(k < Math.ceil(n / 2) ? d0 : -d0);
    }
    this.seg = { type: 'road', left: n, n, dirs, k: 0, speed: (60 + 125 * d) * Gen.rand(0.85, 1.2) * this.speedMul };
    const prev = this.rows.get(i - 1);
    if (prev && prev.type === 'grass') this.addRoadside(prev, 1);
  },

  // Leaf piles in the autumn woods: land in one and your next hop is slow.
  addLeaves(row) {
    let leaves = null;
    for (let k = Gen.int(0, 3); k > 0; k--) {
      const col = Gen.int(0, COLS - 1);
      if (row.blocked[col]) continue;
      leaves = leaves || new Array(COLS).fill(false);
      leaves[col] = true;
    }
    row.leaves = leaves;
  },

  // Ice patches in the mountains: land on one and you keep sliding.
  addIce(row, count) {
    if (row.zone !== 'snow' || row.i < 6) return;
    let ice = null;
    for (let k = 0; k < count; k++) {
      const col = Gen.int(0, COLS - 1);
      if (row.blocked && row.blocked[col]) continue;
      ice = ice || new Array(COLS).fill(false);
      ice[col] = true;
      if (Gen.chance(0.5) && col + 1 < COLS && !(row.blocked && row.blocked[col + 1])) ice[col + 1] = true;
    }
    row.ice = ice;
  },

  makeRoad(i) {
    const s = this.seg, k = s.k++, dir = s.dirs[k], d = difficulty(i);
    const lane = {
      dir,
      speed: s.speed * Gen.rand(0.85, 1.18),
      gapMin: lerp(4.2, 2.1, d) * TILE * this.gapMul,
      gapMax: lerp(9.5, 5.2, d) * TILE * this.gapMul,
      nextGap: 0,
      nextType: null,
      pending: null,
      xStart: dir > 0 ? -this.laneMargin : WORLD_W + this.laneMargin,
      xEnd: dir > 0 ? WORLD_W + this.laneMargin : -this.laneMargin,
      weights: Vehicles.weightsFor(d, this.zoneAt(i)),
      vehicles: [],
    };
    const row = {
      i, y: i * TILE, type: 'road', lane, laneIdx: k, shade: k % 2, zone: this.zoneAt(i),
      markAbove: k < s.n - 1 ? (s.dirs[k + 1] === dir ? 'dash' : 'double') : 'edge',
    };
    if (Gen.chance(0.35)) this.addIce(row, Gen.int(1, 2));
    Vehicles.populate(row);
    return row;
  },

  makeRail(i) {
    const dir = Gen.chance(0.5) ? 1 : -1;
    const zone = this.zoneAt(i);
    const row = {
      i, y: i * TILE, type: 'rail', objs: [], zone,
      rail: {
        dir, state: 'idle', t: Gen.rand(3, 11), x: 0, len: 0, speed: 0, cars: null, tram: zone === 'city',
        stalled: null, wrecks: [], bell: 0, horned: false, bloody: false,
      },
    };
    // crossing signals just outside the playfield
    row.objs.push({ kind: 'xing', x: -0.55 * TILE, y: row.y + 0.3 * TILE, rail: row.rail });
    row.objs.push({ kind: 'xing', x: WORLD_W + 0.55 * TILE, y: row.y + 0.3 * TILE, rail: row.rail });
    if (i > 15 && Gen.chance(0.3)) row.rail.stalled = Rail.makeStalled(row);
    return row;
  },

  makeRiver(i) {
    const s = this.seg, k = s.k++, dir = s.dirs[k], d = difficulty(i);
    const zone = this.zoneAt(i);
    const style = zone === 'snow' ? 'floe' : zone === 'city' ? 'raft' : zone === 'beach' ? 'surf'
      : zone === 'swamp' ? 'lily' : zone === 'harbor' ? 'ferry' : 'log';
    const lily = style === 'lily', ferry = style === 'ferry';
    const river = {
      dir,
      style,
      // lily pads drift slowly but sink under you; ferries are long and slow with big gaps
      speed: (32 + 55 * d) * Gen.rand(0.8, 1.3) * (lily ? 0.35 : ferry ? 0.7 : 1),
      gapMin: (lily ? lerp(0.3, 0.7, d) : ferry ? lerp(2.2, 3.2, d) : lerp(1.0, 1.6, d)) * TILE,
      gapMax: (lily ? lerp(1.0, 1.6, d) : ferry ? lerp(4, 5.5, d) : lerp(2.6, 3.4, d)) * TILE,
      lenMin: (lily ? 0.95 : ferry ? lerp(5, 4, d) : lerp(2.8, 1.8, d)) * TILE,
      lenMax: (lily ? 1.15 : ferry ? lerp(6.5, 5.2, d) : lerp(4.2, 3.0, d)) * TILE,
      nextGap: 0,
      xStart: dir > 0 ? -this.laneMargin : WORLD_W + this.laneMargin,
      xEnd: dir > 0 ? WORLD_W + this.laneMargin : -this.laneMargin,
      logs: [],
    };
    const row = { i, y: i * TILE, type: 'river', river, riverIdx: k, phase: Gen.rand(0, 60), zone };
    River.populate(row);
    return row;
  },

  // Road work: cones and barriers block cells, open pits swallow you, and an
  // excavator swings its bucket across the row.
  makeWork(i) {
    const zone = this.zoneAt(i);
    const row = {
      i, y: i * TILE, type: 'work', zone, blocked: new Array(COLS).fill(false), pit: new Array(COLS).fill(false),
      objs: [], biome: this.palette(i, zone),
    };
    const keep = this.pathCol;
    const free = c => c !== keep && !row.blocked[c] && !row.pit[c];
    // an excavator parked at one edge, swinging over the cells beside it
    if (Gen.chance(0.7)) {
      const left = Gen.chance(0.5);
      const cols = left ? [0, 1] : [COLS - 2, COLS - 1];
      if (cols.every(free)) {
        for (const c of cols) row.blocked[c] = true;
        const reach = left ? [2, 5] : [COLS - 6, COLS - 3];
        row.objs.push({
          kind: 'excavator', x: (cellX(cols[0]) + cellX(cols[1])) / 2, y: row.y, col: cols[0], side: left ? 1 : -1,
          reach, state: 'idle', t: Gen.rand(1.5, 4), swing: 0, row,
        });
      }
    }
    for (let n = Gen.int(1, 2), tries = 0; n > 0 && tries < 12; tries++) {
      const c = Gen.int(0, COLS - 1);
      if (!free(c)) continue;
      row.pit[c] = true;
      n--;
    }
    for (let n = Gen.int(1, 3), tries = 0; n > 0 && tries < 12; tries++) {
      const c = Gen.int(0, COLS - 1);
      if (!free(c)) continue;
      row.blocked[c] = true;
      row.objs.push({ kind: Gen.chance(0.55) ? 'cone' : 'barrier', col: c, x: cellX(c), y: row.y });
      n--;
    }
    for (const col of [-1, COLS]) {
      if (Gen.chance(0.7)) row.objs.push({ kind: 'worksign', col, x: cellX(col), y: row.y });
      else row.objs.push({ kind: 'cone', col, x: cellX(col), y: row.y });
    }
    return row;
  },

  makeGrass(i, mode) {
    const zone = this.zoneAt(i);
    const biome = this.palette(i, zone);
    const row = { i, y: i * TILE, type: 'grass', blocked: new Array(COLS).fill(false), objs: [], flat: [], biome, zone };
    if (zone === 'beach') row.boardwalk = Gen.chance(0.35);
    if (zone === 'swamp') row.boardwalk = Gen.chance(0.4);
    if (zone === 'harbor') row.dock = true;

    // A random-walk column that is never blocked guarantees a path forward:
    // each row keeps both the previous and the new path column clear.
    const keepA = this.pathCol;
    if (mode === 'normal') this.pathCol = clamp(this.pathCol + Gen.int(-1, 1), 0, COLS - 1);
    const keepB = this.pathCol;

    const d = difficulty(i);
    const n = mode === 'backdrop' ? Gen.int(3, 6) : mode === 'start' ? Gen.int(0, 2) : Gen.int(0, 2 + Math.round(d * 2));
    for (let tries = 0, placed = 0; tries < n * 3 && placed < n; tries++) {
      const col = Gen.int(0, COLS - 1);
      if (col === keepA || col === keepB || row.blocked[col]) continue;
      if (mode === 'start' && Math.abs(col - START_COL) < 3) continue;
      row.blocked[col] = true;
      row.objs.push(this.obstacle(col, row, mode));
      placed++;
    }

    // scenery beyond the playable edges
    for (let col = -7; col < COLS + 7; col++) {
      if (col >= 0 && col < COLS) continue;
      const far = col < 0 ? -col : col - COLS + 1;
      if (zone === 'city') {
        if (far === 1) { if (Gen.chance(0.12)) row.objs.push(this.decor(Gen.pick(['hydrant', 'bin', 'mailbox']), col, row)); }
        else if (far === 2) { if (Gen.chance(0.25)) row.objs.push(this.decor('planter', col, row)); }
        else if (far >= 3 && (col < 0 ? col === -3 || col === -6 : col === COLS + 2 || col === COLS + 5)) row.objs.push(this.decor('building', col, row));
      } else if (zone === 'beach') {
        if (far === 1) { if (Gen.chance(0.2)) row.objs.push(this.decor('umbrella', col, row)); }
        else if (far === 3 && Gen.chance(0.08)) row.objs.push(this.decor('lifeguard', col, row));
        else if (Gen.chance(0.2 + far * 0.05)) row.objs.push(this.decor(Gen.weighted([['palm', 4], ['umbrella', 2], ['chair', 1]]), col, row));
      } else if (zone === 'farm') {
        if (far <= 3) { if (Gen.chance(0.75)) row.objs.push(this.decor('corn', col, row)); } // the corn field
        else if (Gen.chance(0.2)) row.objs.push(this.decor(Gen.weighted([['tree', 3], ['hay', 2]]), col, row));
      } else if (zone === 'harbor') {
        if (far === 1) { if (Gen.chance(0.35)) row.objs.push(this.decor('bollard', col, row)); }
        else if (far === 2) { if (Gen.chance(0.3)) row.objs.push(this.decor(Gen.pick(['crate', 'barrel']), col, row)); }
        else if (far >= 3 && Gen.chance(0.45)) row.objs.push(this.decor('container', col, row));
      } else if (zone === 'swamp') {
        if (Gen.chance(0.3 + far * 0.04)) row.objs.push(this.decor(Gen.weighted([['reeds', 4], ['tree', 3], ['stump', 1.5]]), col, row));
      } else if (far === 1) {
        if (Gen.chance(0.15)) row.objs.push(this.decor(zone === 'desert' ? 'deadbush' : 'bush', col, row));
      } else if (Gen.chance(0.22 + far * 0.07)) {
        const kind = zone === 'desert' ? Gen.weighted([['cactus', 4], ['rock', 2], ['mesa', far > 3 ? 1.5 : 0]])
          : Gen.weighted([['tree', 6], ['bush', zone === 'snow' ? 0.5 : 2], ['rock', 1]]);
        row.objs.push(this.decor(kind, col, row));
      }
    }

    // flat ground detail: flowers and tufts, cracks, pebbles or sparkles
    for (let f = Gen.int(3, 7); f > 0; f--) {
      row.flat.push({ x: Gen.rand(-6 * TILE, WORLD_W + 6 * TILE), y: row.y + Gen.rand(-14, 14), c: Gen.chance(0.5) ? Gen.pick(biome.flowers) : null });
    }

    // welcome sign where a new biome begins
    if (mode === 'normal' && zone !== this.signedZone) {
      this.signedZone = zone;
      for (const col of [-1, COLS]) {
        row.objs = row.objs.filter(o => o.col !== col);
        row.objs.push({ kind: 'welcome', col, x: cellX(col), y: row.y, zone, side: col < 0 ? -1 : 1 });
      }
    }

    if (mode === 'normal') {
      this.addIce(row, Gen.int(0, 2));
      if (zone === 'autumn') this.addLeaves(row);
      const below = this.rows.get(i - 1);
      if (below && below.type === 'road') this.addRoadside(row, -1);
    }
    return row;
  },

  obstacle(col, row, mode) {
    const z = row.zone;
    let kind;
    if (mode === 'backdrop' || z === 'country') {
      kind = mode === 'backdrop'
        ? Gen.weighted([['tree', 5], ['bush', 2], ['rock', 1]])
        : Gen.weighted([['tree', 5], ['bush', 3], ['rock', 2], ['sign', 0.5], ['lamp', 0.4]]);
    } else if (z === 'city') {
      kind = Gen.weighted([['planter', 3], ['hydrant', 2], ['bin', 2], ['mailbox', 1], ['bench', 1.5], ['lamp', 1]]);
    } else if (z === 'desert') {
      kind = Gen.weighted([['cactus', 5], ['rock', 3], ['deadbush', 2], ['skull', 0.6]]);
    } else if (z === 'farm') {
      kind = Gen.weighted([['corn', 5], ['hay', 3], ['tree', 1], ['scarecrow', 0.5]]);
    } else if (z === 'swamp') {
      kind = Gen.weighted([['reeds', 4], ['stump', 2.5], ['tree', 2], ['rock', 1]]);
    } else if (z === 'autumn') {
      kind = Gen.weighted([['tree', 6], ['bush', 2], ['stump', 1.5], ['rock', 1]]);
    } else if (z === 'harbor') {
      kind = Gen.weighted([['crate', 4], ['barrel', 3], ['bollard', 2]]);
    } else if (z === 'beach') {
      kind = row.boardwalk ? Gen.weighted([['bench', 2], ['bin', 1.5], ['lamp', 1]])
        : Gen.weighted([['umbrella', 4], ['chair', 2.5], ['sandcastle', 2], ['palm', 2]]);
    } else {
      kind = Gen.weighted([['tree', 6], ['rock', 2], ['snowman', 0.7]]);
    }
    return this.decor(kind, col, row);
  },

  decor(kind, col, row) {
    const b = row.biome;
    const o = { kind, col, x: cellX(col), y: row.y };
    if (kind === 'tree' || kind === 'planter') {
      o.tiers = kind === 'planter' ? 1 : Gen.weighted([[1, 4], [2, 4], [3, 2]]);
      o.size = kind === 'planter' ? Gen.int(10, 12) : Gen.int(13, 16); // whole sizes so trees share cached sprites
      if (row.zone === 'snow') { o.tiers = Gen.int(2, 3); o.pine = true; }
      const t = b.tree;
      o.pal = { top: shade(t[0], Gen.int(-1, 1) * 0.04), front: t[1], top2: t[2], front2: t[3] };
    } else if (kind === 'bush' || kind === 'deadbush') {
      const t = b.bush;
      o.pal = { top: t[0], front: t[1], top2: t[2], front2: t[3] };
      o.flower = kind === 'bush' && row.zone === 'country' && Gen.chance(0.4) ? Gen.pick(b.flowers) : null;
    } else if (kind === 'sign') {
      o.style = Gen.pick(['warn', 'stop', 'info']);
    } else if (kind === 'lamp') {
      o.dir = Gen.chance(0.5) ? 1 : -1;
    } else if (kind === 'cactus') {
      o.h = Gen.int(13, 20) * 2;
      o.arms = Gen.int(0, 2);
      o.flip = Gen.chance(0.5) ? 1 : -1;
    } else if (kind === 'building') {
      o.h = Gen.rand(90, 190);
      o.w = Gen.rand(1.6, 2.6) * TILE;
      o.color = Gen.pick(['#7d8796', '#a0876e', '#8b6f63', '#6f7f8c', '#9a9fa8', '#b39a7c']);
      o.lit = Array.from({ length: 24 }, () => Gen.chance(0.55));
    } else if (kind === 'mesa') {
      o.h = Gen.rand(30, 60);
      o.w = Gen.rand(1.5, 2.4) * TILE;
    } else if (kind === 'rock') {
      o.zone = row.zone;
    } else if (kind === 'umbrella' || kind === 'chair') {
      o.color = Gen.pick(['#e63946', '#ffb703', '#2a9d8f', '#3a86ff', '#ff6fa5']);
    } else if (kind === 'corn') {
      o.h = Gen.int(15, 19) * 2;
    } else if (kind === 'crate' || kind === 'container') {
      o.color = Gen.pick(kind === 'crate' ? ['#b88a58', '#a57a4d', '#c79a62'] : ['#c1121f', '#2667cc', '#2a9d8f', '#e9a23b', '#6a4c93']);
      if (kind === 'container') o.stack = Gen.int(1, 3);
    } else if (kind === 'palm') {
      o.h = Gen.int(20, 29) * 2;
      o.lean = Gen.int(-3, 3) * 2;
    }
    return o;
  },

  // Street lamps and signs framing the road just outside the playable area.
  addRoadside(row, dirToRoad) {
    const lampChance = row.zone === 'city' ? 0.9 : row.zone === 'desert' ? 0.35 : 0.6;
    for (const col of [-1, COLS]) {
      if (row.objs.some(o => o.col === col && o.kind === 'welcome')) continue;
      row.objs = row.objs.filter(o => o.col !== col);
      if (Gen.chance(lampChance)) {
        const o = this.decor('lamp', col, row);
        o.dir = dirToRoad;
        row.objs.push(o);
      } else if (Gen.chance(0.5)) {
        row.objs.push(this.decor('sign', col, row));
      }
    }
  },
};
