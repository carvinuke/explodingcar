'use strict';
// Road forks: before every new biome the road splits around a big signpost.
// One sign points left, the other right, each to a different biome. Walk past
// the sign on the side you want, and that's where the road takes you.
//
// The fork stands FORK_LEAD rows before the biome change, far enough ahead
// that none of the next biome has been built yet when you choose.

const FORK_LEAD = 72;
const FORK_COL = (COLS - 1) / 2;
const ZONE_SHORT = {
  country: 'COUNTRYSIDE', city: 'CITY', desert: 'DESERT', beach: 'BEACH', farm: 'FARMLAND',
  swamp: 'SWAMP', autumn: 'AUTUMN WOODS', harbor: 'HARBOR', snow: 'MOUNTAINS',
};

const Forks = {
  list: [],

  reset() { this.list = []; },

  isForkRow(i) {
    const f0 = FIRST_ZONE - FORK_LEAD;
    return World.forkOn && i >= 6 && i >= f0 && (i - f0) % ZONE_LEN === 0;
  },

  // Build the fork on this (grass) row: both sides open, the signpost in the middle.
  setup(row) {
    const W = World, boundary = row.i + FORK_LEAD;
    const idx = Math.floor((boundary - FIRST_ZONE) / ZONE_LEN) % W.zoneSeq.length;
    const cur = W.zoneAt(boundary - 1);
    let planned = W.zoneSeq[idx];
    const others = Object.keys(ZONES).filter(z => z !== cur);
    if (planned === cur) planned = Gen.pick(others);
    W.zoneSeq[idx] = planned;
    const alt = Gen.pick(others.filter(z => z !== planned));
    const [left, right] = Gen.chance(0.5) ? [planned, alt] : [alt, planned];
    for (let c = 0; c < COLS; c++) row.blocked[c] = false;
    row.objs = row.objs.filter(o => o.col === undefined || o.col < 0 || o.col >= COLS);
    row.blocked[FORK_COL] = true;
    row.ice = null;
    row.leaves = null;
    const f = { row: row.i, boundary, idx, left, right, chosen: null, side: null };
    row.fork = f;
    row.objs.push({ kind: 'forksign', col: FORK_COL, x: cellX(FORK_COL), y: row.y, fork: f });
    this.list.push(f);
  },

  // Walked past a sign: the side you're on picks the next biome.
  check(p) {
    if (p.id !== 0) return;
    for (const f of this.list) {
      if (f.chosen || p.maxRow <= f.row) continue;
      const side = p.col < FORK_COL ? 'left' : 'right';
      f.side = side;
      if (World.maxRow < f.boundary) World.zoneSeq[f.idx] = f[side];
      f.chosen = World.zoneSeq[f.idx];
      FX.text(p.x, p.y + 46, `TO THE ${ZONE_SHORT[f.chosen]}`, '#ffffff', 15);
      Sound.click();
    }
  },

  // The road is about to be built past a fork nobody chose at (a teleport): keep the plan.
  lock(i) {
    for (const f of this.list) if (!f.chosen && i >= f.boundary) f.chosen = World.zoneSeq[f.idx];
  },

  // The signpost: a pole with a green board pointing each way.
  draw(c, o, time) {
    const f = o.fork, box = (...a) => Draw.box(...a);
    box(c, -2, 2, -2, 2, 0, 50, '#9aa0a8', '#6d737c');
    for (const side of ['left', 'right']) {
      const s = side === 'left' ? -1 : 1, z = f[side];
      const x0 = s < 0 ? -64 : 3, x1 = s < 0 ? -3 : 64;
      const lost = f.side && f.side !== side;
      c.save();
      if (lost) c.globalAlpha = 0.45;
      box(c, x0, x1, -2.5, -0.5, 30, 50, '#0b8a5c', '#00704a');
      c.fillStyle = ZONES[z].bg; // the biome's colour along the bottom
      c.fillRect(x0 + 2, P(-2.5, 33.5), x1 - x0 - 4, 2.5 * GZ);
      c.strokeStyle = '#f7f7f2';
      c.lineWidth = 0.9;
      c.strokeRect(x0 + 1.5, P(-2.5, 48.5), x1 - x0 - 3, 14.5 * GZ);
      c.fillStyle = '#f7f7f2';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const label = ZONE_SHORT[z];
      c.font = `900 ${label.length > 9 ? 6 : 7}px ${UI_FONT}`;
      c.fillText(label, (x0 + x1) / 2 + s * 3, P(-2.5, 43));
      c.font = `900 8px ${UI_FONT}`;
      c.fillText(s < 0 ? '◀' : '▶', s < 0 ? x0 + 7 : x1 - 7, P(-2.5, 43));
      if (f.side === side) { // the way you went
        c.strokeStyle = '#ffd23f';
        c.lineWidth = 1.6;
        c.strokeRect(x0 - 0.5, P(-2.5, 50.5), x1 - x0 + 1, 21 * GZ);
      }
      c.restore();
    }
    // a little pulse on both boards until you choose
    if (!f.side) {
      c.fillStyle = `rgba(255,255,255,${0.15 + 0.15 * Math.sin(time * 4)})`;
      c.fillRect(-64, P(-2.5, 50), 128, 1);
    }
  },
};
