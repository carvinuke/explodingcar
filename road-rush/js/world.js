'use strict';
// Endless world generation: rows of grass and road, streamed in ahead of the
// player and dropped once they fall behind the camera.

// Palettes that rotate every ~48 rows for a gentle change of scenery.
const BIOMES = [
  { grass: ['#94d36b', '#8acb62'], edge: '#5e8f3e', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'],
    bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'], flowers: ['#ffffff', '#ffd6e7', '#fff08a'] },
  { grass: ['#a8d66a', '#9fce60'], edge: '#6f8f3a', tree: ['#7ab648', '#5f9738', '#8fcb58', '#72ad44'],
    bush: ['#86c052', '#6aa141', '#98cf62', '#7bb44c'], flowers: ['#ffb3c7', '#ffffff', '#c9b6ff'] },
  { grass: ['#7fca7c', '#76c174'], edge: '#4b8a52', tree: ['#2f9a63', '#237a4d', '#3fb074', '#2e905b'],
    bush: ['#3fa86a', '#2f8a55', '#52bb7c', '#3c9d63'], flowers: ['#ffffff', '#9fd8ff', '#ffe08a'] },
  { grass: ['#c8cc6f', '#bfc365'], edge: '#8e8a45', tree: ['#e59a3a', '#c47c26', '#f0b24e', '#d48c30'],
    bush: ['#d0a24a', '#b0873a', '#dbb35d', '#c09441'], flowers: ['#ffffff', '#ffcf8a', '#ff9e9e'] },
];

const World = {
  rows: new Map(),
  minRow: 0,
  maxRow: 0,
  pathCol: START_COL,
  seg: null,
  laneMargin: 12 * TILE, // how far off-screen lanes extend (set on resize)

  reset() {
    this.rows.clear();
    this.pathCol = START_COL;
    this.seg = { type: 'grass', left: 0 };
    this.minRow = -16;
    this.maxRow = this.minRow - 1;
    this.ensure(30);
  },

  biome(i) { return BIOMES[Math.floor(Math.max(0, i) / 48) % BIOMES.length]; },

  ensure(upTo) {
    while (this.maxRow < upTo) this.generate(this.maxRow + 1);
  },

  cull(below) {
    while (this.minRow < below) this.rows.delete(this.minRow++);
    Items.cull(this.minRow);
  },

  // Is this grid cell off-limits for the player?
  isBlocked(col, row) {
    if (col < 0 || col >= COLS || row < 0) return true;
    const r = this.rows.get(row);
    return !r || (r.type === 'grass' && r.blocked[col]);
  },

  generate(i) {
    let row;
    if (i < 0) row = this.makeGrass(i, 'backdrop');
    else if (i < 4) row = this.makeGrass(i, 'start');
    else {
      if (this.seg.left <= 0) this.nextSegment(i);
      row = this.seg.type === 'road' ? this.makeRoad(i) : this.makeGrass(i, 'normal');
      this.seg.left--;
    }
    this.rows.set(i, row);
    this.maxRow = i;
    if (i >= 3) Items.populateRow(row);
  },

  // Alternate grass strips and road blocks; roads widen with difficulty.
  nextSegment(i) {
    const d = difficulty(i);
    if (this.seg.type === 'road') {
      this.seg = { type: 'grass', left: randInt(1, d < 0.35 ? 3 : 2) };
      return;
    }
    const maxLanes = 2 + Math.round(d * 3); // 2 -> 5
    const n = d < 0.08 ? randInt(1, 2) : randInt(1, maxLanes);
    const d0 = chance(0.5) ? 1 : -1;
    const oneWay = n > 1 && chance(0.25);
    const alternate = !oneWay && n > 2 && chance(0.35);
    const dirs = [];
    for (let k = 0; k < n; k++) {
      if (oneWay) dirs.push(d0);
      else if (alternate) dirs.push(k % 2 ? -d0 : d0);
      else dirs.push(k < Math.ceil(n / 2) ? d0 : -d0);
    }
    this.seg = { type: 'road', left: n, n, dirs, k: 0, speed: (60 + 125 * d) * rand(0.85, 1.2) };
    const prev = this.rows.get(i - 1);
    if (prev && prev.type === 'grass') this.addRoadside(prev, 1);
  },

  makeRoad(i) {
    const s = this.seg, k = s.k++, dir = s.dirs[k], d = difficulty(i);
    const lane = {
      dir,
      speed: s.speed * rand(0.85, 1.18),
      gapMin: lerp(4.2, 2.1, d) * TILE,
      gapMax: lerp(9.5, 5.2, d) * TILE,
      nextGap: 0,
      nextType: null,
      xStart: dir > 0 ? -this.laneMargin : WORLD_W + this.laneMargin,
      xEnd: dir > 0 ? WORLD_W + this.laneMargin : -this.laneMargin,
      weights: Vehicles.weightsFor(d),
      vehicles: [],
    };
    const row = {
      i, y: i * TILE, type: 'road', lane, laneIdx: k, shade: k % 2,
      markAbove: k < s.n - 1 ? (s.dirs[k + 1] === dir ? 'dash' : 'double') : 'edge',
    };
    Vehicles.populate(row);
    return row;
  },

  makeGrass(i, mode) {
    const biome = this.biome(i);
    const row = { i, y: i * TILE, type: 'grass', blocked: new Array(COLS).fill(false), objs: [], flat: [], biome };

    // A random-walk column that is never blocked guarantees a path forward:
    // each row keeps both the previous and the new path column clear.
    const keepA = this.pathCol;
    if (mode === 'normal') this.pathCol = clamp(this.pathCol + randInt(-1, 1), 0, COLS - 1);
    const keepB = this.pathCol;

    const d = difficulty(i);
    const n = mode === 'backdrop' ? randInt(3, 6) : mode === 'start' ? randInt(0, 2) : randInt(0, 2 + Math.round(d * 2));
    for (let tries = 0, placed = 0; tries < n * 3 && placed < n; tries++) {
      const col = randInt(0, COLS - 1);
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
      if (far === 1) { if (chance(0.15)) row.objs.push(this.decor('bush', col, row)); }
      else if (chance(0.22 + far * 0.07)) row.objs.push(this.decor(weighted([['tree', 6], ['bush', 2], ['rock', 1]]), col, row));
    }

    // flowers and grass tufts drawn flat on the ground
    for (let f = randInt(3, 7); f > 0; f--) {
      row.flat.push({ x: rand(-6 * TILE, WORLD_W + 6 * TILE), y: row.y + rand(-14, 14), c: chance(0.5) ? pick(biome.flowers) : null });
    }

    if (mode === 'normal') {
      const below = this.rows.get(i - 1);
      if (below && below.type === 'road') this.addRoadside(row, -1);
    }
    return row;
  },

  obstacle(col, row, mode) {
    const kind = mode === 'backdrop'
      ? weighted([['tree', 5], ['bush', 2], ['rock', 1]])
      : weighted([['tree', 5], ['bush', 3], ['rock', 2], ['sign', 0.5], ['lamp', 0.4]]);
    return this.decor(kind, col, row);
  },

  decor(kind, col, row) {
    const b = row.biome;
    const o = { kind, col, x: cellX(col), y: row.y };
    if (kind === 'tree') {
      o.tiers = weighted([[1, 4], [2, 4], [3, 2]]);
      o.size = rand(13, 16);
      const t = b.tree;
      o.pal = { top: shade(t[0], rand(-0.05, 0.05)), front: t[1], top2: t[2], front2: t[3] };
    } else if (kind === 'bush') {
      const t = b.bush;
      o.pal = { top: t[0], front: t[1], top2: t[2], front2: t[3] };
      o.flower = chance(0.4) ? pick(b.flowers) : null;
    } else if (kind === 'sign') {
      o.style = pick(['warn', 'stop', 'info']);
    } else if (kind === 'lamp') {
      o.dir = chance(0.5) ? 1 : -1;
    }
    return o;
  },

  // Street lamps and signs framing the road just outside the playable area.
  addRoadside(row, dirToRoad) {
    for (const col of [-1, COLS]) {
      row.objs = row.objs.filter(o => o.col !== col);
      if (chance(0.65)) {
        const o = this.decor('lamp', col, row);
        o.dir = dirToRoad;
        row.objs.push(o);
      } else if (chance(0.5)) {
        row.objs.push(this.decor('sign', col, row));
      }
    }
  },
};
