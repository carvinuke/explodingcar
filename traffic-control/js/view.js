'use strict';
// Traffic Control: drawing the crossroads in Road Rush's oblique style.
// LIGHT_POS is relative to a crossing's middle.

const LIGHT_POS = {}; // where each road's traffic light stands (driver's right, before the stop line)
for (const h in ROTATE) LIGHT_POS[h] = ROTATE[h](-STOP - 8, -RW - 14);
const ARROWS = { E: '→', W: '←', N: '↑', S: '↓' };

// Seeded random numbers, so each map's scenery is always laid out the same.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TCView = {
  scale: 1, ox: 0, oy: 0, cx: 0,
  shake: 0,
  hover: null,
  scenery: [],

  init(canvas) {
    this.v = Kit.view(canvas, { low: TCGame.settings.low, onResize: () => this.fit() });
    this.fit();
    if (document.fonts) document.fonts.ready.then(() => { this.dirty = true; }); // road lettering
  },

  setLow(low) { this.v.low = low; this.v.resize(); FX.quality = low ? 0.5 : 1; },

  // Fit the crossings to the screen, leaving room for the HUD at the top and bottom.
  fit() {
    if (!this.v) return;
    const { W, H } = this.v;
    const rail = TCSim.rail, cols = TCSim.cols || [0], rows = TCSim.rows || [0];
    const spanX = (Math.max(...cols) - Math.min(...cols)) / 2, spanY = (Math.max(...rows) - Math.min(...rows)) / 2;
    const needX = (rail ? 272 : 180) + spanX, needY = 170 + spanY;
    const top = 70, bottom = 96;
    const s = clamp(Math.min(W / (2 * needX), (H - top - bottom) / (2 * needY * GY + 90)), spanX || spanY ? 0.3 : 0.42, 1.7);
    this.scale = s;
    this.cx = rail ? 56 : 0; // shift right a little so the railway fits
    this.ox = W / 2 - this.cx * s;
    this.oy = top + (H - top - bottom) / 2 + 26 * s;
    TCSim.viewX = Math.max(this.ox, W - this.ox) / s;
    TCSim.viewY = Math.max(this.oy, H - this.oy) / (s * GY);
    Renderer.base = s;
    Renderer.dpr = this.v.dpr;
    Renderer.yTop = this.oy / (s * GY) + 40;
    Renderer.yBot = -(H - this.oy) / (s * GY) - 40;
    this.dirty = true;
  },

  // Screen point (CSS px) to the ground (z = 0).
  toWorld(sx, sy) { return { x: (sx - this.ox) / this.scale, y: -(sy - this.oy) / (this.scale * GY) }; },
  toScreen(x, y, z = 0) { return { x: this.ox + x * this.scale, y: this.oy + P(y, z) * this.scale }; },

  // Which light did the player tap? { n: crossing, h: road }, or null.
  pick(sx, sy) {
    let best = null, bestD = Infinity;
    const reach = Math.max(42 * this.scale, 24);
    for (const N of TCSim.nodes) for (const h of N.ways) {
      // the light itself
      const lp = LIGHT_POS[h], head = this.toScreen(N.x + lp[0], N.y + lp[1], 80);
      const d = Math.hypot(sx - head.x, sy - head.y);
      if (d < reach && d < bestD) { best = { n: N.i, h }; bestD = d; }
    }
    if (best) return best;
    // or anywhere on that road's waiting lane
    const w = this.toWorld(sx, sy), back = TCSim.nodes.length > 1 ? 150 : 190;
    for (const N of TCSim.nodes) for (const h of N.ways) {
      const [lx, ly] = INVERSE[h](w.x - N.x, w.y - N.y);
      if (lx > -STOP - back && lx < -RW + 6 && ly > -RW - 36 && ly < 8) return { n: N.i, h };
    }
    return null;
  },

  // A street's extent north-south (col k): open ends run off the map.
  colSpan(k) {
    const col = TCSim.nodes.filter(n => n.k === k);
    const lo = col[0], hi = col[col.length - 1];
    return [lo.sides.S ? -1e5 : lo.y - RW, hi.sides.N ? 1e5 : hi.y + RW];
  },

  // ---- Scenery ---------------------------------------------------------------------
  build(mapId, themeId) {
    const map = TC_MAPS[mapId];
    const biomeId = themeId && themeId !== 'auto' ? themeId : map.biome;
    this.biome = BIOMES[biomeId] || TC_THEME_BIOMES[biomeId] || BIOMES.town;
    this.snow = biomeId === 'snow';
    this.beach = biomeId === 'beach';
    this.neon = biomeId === 'neon';
    const nodes = TCSim.nodes, rows = TCSim.rows, cols = TCSim.cols, rail = TCSim.rail, multi = nodes.length > 1;
    const spans = cols.map((x, k) => this.colSpan(k));
    const R = seeded(mapId.length * 977 + 13 + (multi ? nodes.length * 31 + nodes.filter(n => !n.sides.N || !n.sides.S).length * 7 : 0));
    const list = [];
    const clear = (x, y, r) => {
      for (const ry of rows) if (Math.abs(y - ry) < RW + 26 + r) return false;
      for (let k = 0; k < cols.length; k++) if (Math.abs(x - cols[k]) < RW + 26 + r && y > spans[k][0] - 26 - r && y < spans[k][1] + 26 + r) return false;
      if (rail && Math.abs(x - RAIL_X) < 46 + r) return false;
      for (const N of nodes) for (const h in LIGHT_POS) if (Math.hypot(x - N.x - LIGHT_POS[h][0], y - N.y - LIGHT_POS[h][1]) < 22 + r) return false;
      return true;
    };
    // the avenue just north of a point (the one a tall thing here would hide), or null
    const northRow = y => { let best = null; for (const ry of rows) if (ry > y && (best === null || ry < best)) best = ry; return best; };
    const tree = (x, y) => {
      const t = this.biome.tree;
      const o = { kind: 'tree', x, y, size: 13 + Math.floor(R() * 4), tiers: 1 + Math.floor(R() * 3), pal: { top: t[0], front: t[1], top2: t[2], front2: t[3] } };
      if (this.snow) { o.pine = true; o.tiers = 2 + Math.floor(R() * 2); }
      return o;
    };
    const bush = (x, y) => { const b = this.biome.bush; return { kind: 'bush', x, y, pal: { top: b[0], front: b[1], top2: b[2], front2: b[3] }, flower: null }; };
    // in front of an east-west road, anything tall would hide the cars: cap heights
    const fits = (y, h) => { const ry = northRow(y); return ry === null || P(y - ry, h) > (RW + 16) * GY; };
    const scene = map.scenery;
    const GX = multi ? 1400 : 760, GYR = multi ? 1600 : 620;
    for (let gx = -GX; gx <= GX; gx += 46) {
      for (let gy = -GYR; gy <= GYR; gy += 42) {
        const x = gx + (R() - 0.5) * 18, y = gy + (R() - 0.5) * 14;
        const near = rows.some(ry => y < ry && y > ry - 130); // in front of an east-west road: keep it low so cars stay visible
        const roll = R();
        let o = null;
        if (scene === 'city') {
          if (!near && roll < 0.42 && clear(x, y, 34) && rows.every(ry => Math.abs(y - ry) > 90) && (cols.every(cx => Math.abs(x - cx) > 120) || northRow(y) === null)) {
            const pal = this.neon ? ['#2b2547', '#35204a', '#1f2c4a', '#3a2a55', '#2a3150', '#402a4a'] : ['#7d8796', '#a0876e', '#8b6f63', '#6f7f8c', '#9a9fa8', '#b39a7c'];
            o = { kind: 'building', x, y, w: (1.4 + R()) * TILE, h: 70 + R() * 110, color: pal[Math.floor(R() * 6)] };
            o.lit = Array.from({ length: 24 }, () => R() < 0.55);
          } else if (roll < 0.5 && clear(x, y, 12)) o = { kind: 'planter', x, y, size: 10 + Math.floor(R() * 3), tiers: 1, pal: { top: this.biome.tree[0], front: this.biome.tree[1], top2: this.biome.tree[2], front2: this.biome.tree[3] } };
          else if (roll < 0.56 && clear(x, y, 10)) o = { kind: R() < 0.5 ? 'bench' : 'bin', x, y };
        } else if (scene === 'farm') {
          if (!near && roll < 0.22 && clear(x, y, 18)) o = tree(x, y);
          else if (roll < 0.36 && clear(x, y, 16)) o = this.snow ? { kind: 'snowman', x, y } : { kind: 'corn', x, y, h: 30 + Math.floor(R() * 4) * 3 };
          else if (roll < 0.42 && clear(x, y, 14)) o = { kind: 'hay', x, y };
          else if (roll < 0.47 && clear(x, y, 12)) o = bush(x, y);
          else if (roll < 0.48 && !near && clear(x, y, 12)) o = { kind: 'scarecrow', x, y };
        } else {
          if (!near && roll < 0.3 && clear(x, y, 18)) o = tree(x, y);
          else if (roll < 0.42 && clear(x, y, 12)) o = bush(x, y);
          else if (roll < 0.45 && clear(x, y, 10)) o = { kind: R() < 0.5 ? 'mailbox' : 'hydrant', x, y };
        }
        if (o && o.kind === 'building' && northRow(y) !== null) o.h = Math.min(o.h, (northRow(y) - y - RW - 20) * GY / GZ);
        if (o && o.kind === 'building' && o.h < 40) o = null;
        if (o && o.kind === 'tree' && !fits(y, 14 + o.tiers * 21)) o = null;
        if (o && this.beach) o = this.beachy(o, R);
        if (o) list.push(o);
      }
    }
    // street lamps on the corners
    for (const N of nodes) {
      for (const [dx, dy, dir] of [[-RW - 30, RW + 46, 1], [RW + 30, RW + 46, -1], [-RW - 30, -RW - 110, 1], [RW + 30, -RW - 110, -1]]) {
        const x = N.x + dx, y = N.y + dy;
        if (!rail || Math.abs(x - RAIL_X) > 60) list.push({ kind: 'lamp', x, y, dir });
      }
    }
    this.scenery = list;
    this.dirty = true;
  },

  // The Beach theme: palms for trees, parasols and deckchairs for the street furniture.
  beachy(o, R) {
    const cols = ['#e63946', '#3a86ff', '#ffbe0b', '#2ec4b6', '#ff006e'];
    if (o.kind === 'tree') return { kind: 'palm', x: o.x, y: o.y, h: 40 + Math.floor(R() * 14), lean: (R() - 0.5) * 12 };
    if (o.kind === 'mailbox' || o.kind === 'hydrant' || o.kind === 'bin') return { kind: R() < 0.6 ? 'umbrella' : 'chair', x: o.x, y: o.y, color: cols[Math.floor(R() * cols.length)] };
    if (o.kind === 'corn' || o.kind === 'hay') return R() < 0.5 ? { kind: 'sandcastle', x: o.x, y: o.y } : { kind: 'umbrella', x: o.x, y: o.y, color: cols[Math.floor(R() * cols.length)] };
    if (o.kind === 'scarecrow') return { kind: 'lifeguard', x: o.x, y: o.y };
    return o;
  },

  // The ground and scenery never move: draw them once into a picture and reuse it.
  renderBg() {
    const { W, H, dpr } = this.v, s = this.scale, m = 24, B = this.biome || BIOMES.town;
    const cv = this.bg || (this.bg = document.createElement('canvas'));
    cv.width = Math.round((W + 2 * m) * dpr);
    cv.height = Math.round((H + 2 * m) * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = B.ground;
    c.fillRect(0, 0, W + 2 * m, H + 2 * m);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (this.ox + m), dpr * (this.oy + m));
    const x0 = -(this.ox + m) / s, x1 = (W + m - this.ox) / s;
    const yTop = (this.oy + m) / (s * GY), yBot = -(H + m - this.oy) / (s * GY);
    this.ground(c, B, x0, x1, yBot, yTop);
    const list = this.scenery.filter(o => o.x > x0 - 90 && o.x < x1 + 90 && o.y < yTop + 240 && o.y > yBot - 20).sort((a, b) => b.y - a.y);
    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, 0);
    this.bgMargin = m;
    this.dirty = false;
  },

  // ---- Drawing ---------------------------------------------------------------------
  draw(time, dt) {
    const { c, W, H, dpr } = this.v;
    const s = this.scale;
    let sx = 0, sy = 0;
    if (this.shake > 0.3 && TCGame.settings.shake) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    this.shake = Math.max(0, this.shake - dt * 40);

    if (this.dirty || !this.bg) this.renderBg();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const m = this.bgMargin;
    c.drawImage(this.bg, Math.round((sx - m) * dpr), Math.round((sy - m) * dpr));
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (this.ox + sx), dpr * (this.oy + sy));

    const x0 = -this.ox / s - 20, x1 = (W - this.ox) / s + 20;
    const yTop = this.oy / (s * GY) + 20, yBot = -(H - this.oy) / (s * GY) - 20;
    this.hoverLane(c);
    this.selected(c, time);
    FX.drawDecals(c);
    FX.drawPools(c);

    // everything that moves or lights up, far to near (the scenery is in the background picture)
    const list = [];
    for (const N of TCSim.nodes) for (const h of N.ways) list.push({ kind: 'signal', n: N.i, h, x: N.x + LIGHT_POS[h][0], y: N.y + LIGHT_POS[h][1] });
    if (TCSim.rail) {
      list.push({ kind: 'xing', x: RAIL_X + GATE + 4, y: RW + 14, side: 1 });
      list.push({ kind: 'xing', x: RAIL_X - GATE - 4, y: -RW - 14, side: -1 });
    }
    for (const car of TCSim.cars) if (!car.gone) list.push(car);
    for (const t of TCSim.trainCars()) list.push({ kind: 'train', ...t });
    list.sort((a, b) => b.y - a.y);

    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, time);
    for (const car of TCSim.cars) if (!car.gone && !car.wreck) this.overhead(c, car, time);

    FX.draw(c);
    FX.drawBlasts(c);
    FX.drawTexts(c);

    // night: darkness with headlights and lamps
    if (TCSim.night) this.nightLayer(c, time, x0, x1, yBot, yTop);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (TCSim.rain && !this.v.low) FX.drawWeather(c, W, H, 'rain', 0.85, dt);
    else if (TCSim.rain) { c.fillStyle = 'rgba(40,60,90,0.16)'; c.fillRect(0, 0, W, H); }
    if (TCSim.freezeT > 0) {
      c.fillStyle = `rgba(170,225,255,${0.16 + 0.06 * Math.sin(time * 6)})`;
      c.fillRect(0, 0, W, H);
    }
    FX.drawFlash(c, W, H);
  },

  ground(c, B, x0, x1, y0, y1) {
    // grass rows, alternating like Road Rush
    const t = TILE;
    c.fillStyle = B.ground2;
    for (let y = Math.floor(y0 / t) * t; y < y1; y += 2 * t) c.fillRect(x0, P(y + t, 0), x1 - x0, t * GY);

    const ROAD = '#3a3d44';
    const WALK = this.neon ? '#3b3555' : this.snow ? '#e6eaee' : this.beach ? '#efe6cf' : '#cfcac0';
    const WALKF = this.neon ? '#29243f' : this.snow ? '#b9c2cc' : this.beach ? '#cbbf9f' : '#a9a398';
    const box = (...a) => Draw.box(...a);
    const nodes = TCSim.nodes, rows = TCSim.rows, cols = TCSim.cols;
    const spans = cols.map((x, k) => { const [a, b] = this.colSpan(k); return [Math.max(a, y0), Math.min(b, y1)]; });
    const at = (r, k) => nodes.find(n => n.r === r && n.k === k);
    // pieces of [a, b] left after cutting out the given gaps
    const cut = (a, b, gaps) => {
      const out = [];
      let p = a;
      for (const [g0, g1] of gaps.slice().sort((u, v) => u[0] - v[0])) {
        if (g1 <= p || g0 >= b) continue;
        if (g0 > p) out.push([p, g0]);
        p = Math.max(p, g1);
      }
      if (p < b) out.push([p, b]);
      return out;
    };
    // where streets meet an avenue on one side (north: +1, south: -1)
    const streetGaps = (r, side, pad) => cols.map((cx, k) => [cx, at(r, k)]).filter(([, n]) => n.sides[side > 0 ? 'N' : 'S']).map(([cx]) => [cx - RW - pad, cx + RW + pad]);

    // sidewalks (a raised curb along each road), far ones first
    const walks = [];
    rows.forEach((ry, r) => {
      for (const side of [1, -1]) {
        const ya = side > 0 ? ry + RW : ry - RW - 14, yb = ya + 14;
        for (const [a, b] of cut(x0, x1, streetGaps(r, side, 0))) walks.push([a, b, ya, yb]);
      }
    });
    cols.forEach((cx, k) => {
      const [ya, yb] = spans[k];
      for (const [a, b] of cut(ya, yb, rows.map(ry => [ry - RW, ry + RW]))) {
        walks.push([cx - RW - 14, cx - RW, a, b]);
        walks.push([cx + RW, cx + RW + 14, a, b]);
      }
    });
    walks.sort((u, v) => v[3] - u[3]);
    for (const [a, b, ya, yb] of walks) box(c, a, b, ya, yb, 0, 3, WALK, WALKF);

    // railway bed (under the road)
    const rail = TCSim.rail;
    if (rail) {
      c.fillStyle = '#8d877c';
      c.fillRect(RAIL_X - 30, P(y1, 0), 60, (y1 - y0) * GY);
      for (let y = Math.floor(y0 / 16) * 16; y < y1; y += 16) {
        if (Math.abs(y) < RW + 4) continue;
        box(c, RAIL_X - 22, RAIL_X + 22, y - 3, y + 3, 0, 2, '#7a5a3e', '#5e4430');
      }
    }

    // the roads
    c.fillStyle = ROAD;
    for (const ry of rows) c.fillRect(x0, P(ry + RW, 0), x1 - x0, 2 * RW * GY);
    cols.forEach((cx, k) => { const [ya, yb] = spans[k]; if (yb > ya) c.fillRect(cx - RW, P(yb, 0), 2 * RW, (yb - ya) * GY); });

    // centre lines (double yellow) and edge lines
    c.fillStyle = '#f2c230';
    const hLine = (xa, xb, y, w = 1.6) => { if (xb > xa) c.fillRect(xa, P(y + w / 2, 0), xb - xa, w * GY); };
    const vLine = (x, ya, yb, w = 1.6) => { if (yb > ya) c.fillRect(x - w / 2, P(yb, 0), w, (yb - ya) * GY); };
    rows.forEach(ry => {
      for (const d of [-2.2, 2.2]) for (const [a, b] of cut(x0, x1, cols.map(cx => [cx - STOP - 2, cx + STOP + 2]))) hLine(a, b, ry + d);
    });
    cols.forEach((cx, k) => {
      for (const d of [-2.2, 2.2]) for (const [a, b] of cut(spans[k][0], spans[k][1], rows.map(ry => [ry - STOP - 2, ry + STOP + 2]))) vLine(cx + d, a, b);
    });
    if (rail) { c.fillStyle = ROAD; c.fillRect(RAIL_X - 26, P(RW, 0), 52, 2 * RW * GY); }
    c.fillStyle = 'rgba(255,255,255,0.7)';
    rows.forEach((ry, r) => {
      for (const side of [1, -1]) for (const [a, b] of cut(x0, x1, streetGaps(r, side, 14))) hLine(a, b, ry + side * (RW - 3), 1.4);
    });
    cols.forEach((cx, k) => {
      for (const d of [-RW + 3, RW - 3]) for (const [a, b] of cut(spans[k][0], spans[k][1], rows.map(ry => [ry - RW - 14, ry + RW + 14]))) vLine(cx + d, a, b, 1.4);
    });

    // stop lines and crosswalks, on every road into every crossing
    c.fillStyle = '#f7f7f2';
    for (const N of nodes) {
      for (const h of ['E', 'W', 'N', 'S']) {
        if (!N.sides[SIDE_BACK[h]]) continue;
        const T = (x, y) => { const [a, b] = ROTATE[h](x, y); return [a + N.x, b + N.y]; };
        // stop line across the incoming lane
        this.rect(c, T(-STOP + 1, -RW), T(-STOP + 5, 0));
        // zebra stripes across the whole road
        for (let k = -RW + 4; k < RW - 2; k += 9) this.rect(c, T(-RW - 15, k), T(-RW - 3, k + 5));
      }
    }

    // rails across everything (and their crossing on the road)
    if (rail) {
      for (const dx of [-10, 10]) {
        c.fillStyle = '#6f757e';
        c.fillRect(RAIL_X + dx - 1.6, P(y1, 2.2), 3.2, (y1 - y0) * GY);
        c.fillStyle = '#c3c8cf';
        c.fillRect(RAIL_X + dx - 1.6, P(y1, 2.2), 1.2, (y1 - y0) * GY);
      }
      // warning stripes on the road either side of the tracks
      c.fillStyle = 'rgba(247,247,242,0.85)';
      for (const gx of [RAIL_X - GATE + 4, RAIL_X + GATE - 6]) c.fillRect(gx, P(RW, 0), 2.2, 2 * RW * GY);
      c.fillStyle = 'rgba(247,247,242,0.5)';
      for (const gx of [RAIL_X - GATE - 14, RAIL_X + GATE + 10]) {
        c.font = `900 9px ${UI_FONT}`;
        c.textAlign = 'center';
        c.save(); c.translate(gx, P(gx < RAIL_X ? -LANE : LANE, 0)); c.scale(1, GY);
        c.fillText('RXR', 0, 3);
        c.restore();
      }
    }

  },

  // The waiting lane glows softly under the mouse.
  hoverLane(c) {
    const H = this.hover, N = H && TCSim.nodes[H.n];
    if (!N || N.auto || !N.lights[H.h] || !N.lights[H.h].on) return;
    const len = TCSim.nodes.length > 1 ? 110 : 150;
    const a = ROTATE[H.h](-STOP - len, -RW + 1), b = ROTATE[H.h](-STOP + 5, -1);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    this.rect(c, [a[0] + N.x, a[1] + N.y], [b[0] + N.x, b[1] + N.y]);
  },

  // With several crossings, a dashed frame shows which one the keys work on.
  selected(c, time) {
    if (TCSim.nodes.length < 2 || TCGame.state !== 'playing') return;
    const N = TCSim.nodes[TCSim.sel];
    if (!N || N.auto) return;
    const r = RW + 3, x0 = N.x - r, y1 = P(N.y + r, 0), w = 2 * r, h = 2 * r * GY;
    c.save();
    c.strokeStyle = `rgba(255,214,64,${0.7 + 0.25 * Math.sin(time * 5)})`;
    c.lineWidth = 2.4;
    c.setLineDash([7, 5]);
    c.lineDashOffset = -time * 14;
    c.strokeRect(x0, y1, w, h);
    c.restore();
  },

  // An axis-aligned rectangle on the ground between two corner points.
  rect(c, a, b) {
    const xa = Math.min(a[0], b[0]), xb = Math.max(a[0], b[0]), ya = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]);
    c.fillRect(xa, P(yb, 0), xb - xa, (yb - ya) * GY);
  },

  shadowOf(c, o) {
    switch (o.kind) {
      case 'vehicle': {
        c.save(); c.translate(o.x, P(o.y, 0)); c.globalAlpha = o.alpha; Cars.shadow(c, o, 0.85); c.restore();
        break;
      }
      case 'tree': Draw.shadow(c, o.x, o.y, o.size * 2.8, o.size * 2.5, 0.8); break;
      case 'planter': Draw.shadow(c, o.x, o.y, o.size * 2.6, o.size * 2.2, 0.7); break;
      case 'building': Draw.shadow(c, o.x + 10, o.y - 6, o.w * 1.1, 44, 0.8); break;
      case 'train': Draw.shadow(c, o.x + 4, o.y, 44, o.car.len * 1.05, 0.9); break;
      case 'bush': case 'hay': case 'corn': Draw.shadow(c, o.x, o.y, 0.8 * TILE, 0.7 * TILE, 0.6); break;
      case 'palm': Draw.shadow(c, o.x + o.lean, o.y, 40, 24, 0.6); break;
      case 'umbrella': Draw.shadow(c, o.x, o.y, 38, 18, 0.5); break;
      default: break;
    }
  },

  object(c, o, time) {
    c.save();
    c.translate(o.x, P(o.y, 0));
    switch (o.kind) {
      case 'vehicle':
        if (o.alpha < 1) c.globalAlpha = Math.max(0, o.alpha);
        Cars.draw(c, o, time);
        break;
      case 'train': Cars.trainCarNS(c, o.car, o.toward, time); break;
      case 'signal': this.signal(c, o, time); break;
      case 'xing': this.crossing(c, o, time); break;
      case 'tree': Draw.tree(c, o, this.snow ? 1 : 0); break;
      case 'bush': Draw.bush(c, o); break;
      case 'planter': Draw.planter(c, o); break;
      case 'building': Draw.building(c, o); break;
      case 'lamp': Draw.lamp(c, o); break;
      case 'bench': Draw.bench(c); break;
      case 'bin': Draw.bin(c); break;
      case 'hydrant': Draw.hydrant(c); break;
      case 'mailbox': Draw.mailbox(c); break;
      case 'hay': Draw.hay(c); break;
      case 'corn': Draw.corn(c, o); break;
      case 'scarecrow': Draw.scarecrow(c); break;
      case 'snowman': Draw.snowman(c, o); break;
      case 'palm': Draw.palm(c, o); break;
      case 'umbrella': Draw.umbrella(c, o); break;
      case 'chair': Draw.chair(c, o); break;
      case 'sandcastle': Draw.sandcastle(c); break;
      case 'lifeguard': Draw.lifeguard(c); break;
      default: break;
    }
    c.restore();
  },

  // A traffic light: pole, housing, three lamps and a plate saying which traffic it runs.
  signal(c, o, time) {
    const h = o.h, N = TCSim.nodes[o.n], L = N.lights[h], style = TC_LIGHTS[TCGame.lightStyle] || TC_LIGHTS.classic;
    const box = (...a) => Draw.box(...a);
    const pole = style.pole || '#7d838c';
    if (style.stripes) for (let z = 0; z < 58; z += 8) { const col = (z / 8) % 2 ? '#d7263d' : pole; box(c, -2, 2, -2, 2, z, Math.min(58, z + 8), col, shade(col, -0.22)); }
    else box(c, -2, 2, -2, 2, 0, 58, pole, shade(pole, -0.25));
    box(c, -9, 9, -6, 6, 58, 100, style.body, shade(style.body, -0.3));
    if (style.stripes) for (const z of [70, 84]) box(c, -9.2, 9.2, -6.2, 6.2, z, z + 3, '#ffffff', '#dcdcdc');
    box(c, -10, 10, -7, -6, 57, 101, style.top, style.front);
    const lamps = [['red', 93, '#ff2e3a', 'rgba(255,60,60,'], ['yellow', 79, '#ffc619', 'rgba(255,200,40,'], ['green', 65, '#2ee66b', 'rgba(60,240,120,']];
    const flashRed = L.pending && Math.sin(time * 14) > 0;
    for (const [state, z, col, glowCol] of lamps) {
      const y = P(-7, z);
      const lit = L.state === state || (state === 'red' && L.state === 'red');
      c.fillStyle = '#0d0f12';
      c.beginPath(); c.arc(0, y, 6, 0, 6.2832); c.fill();
      c.globalAlpha = lit ? 1 : 0.17;
      c.fillStyle = col;
      c.beginPath(); c.arc(0, y, 4.8, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
      if (lit) {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = glowCol + (style.glow ? '0.5)' : '0.35)');
        c.beginPath(); c.arc(0, y, style.glow ? 17 : 12, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      box(c, -6.5, 6.5, -10, -7, z + 5.5, z + 6.8, style.body, shade(style.body, -0.3)); // visor
      if (state === 'red' && flashRed) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(0, y, 3, 0, 6.2832); c.fill(); }
    }
    if (style.shine) { c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-8, P(-7, 99), 2, 40 * GZ); }
    // the plate: which way this light sends traffic (and its arrow key); "A" on a crossing that runs itself
    const py = P(-7, 115);
    const hover = this.hover && this.hover.n === o.n && this.hover.h === h && !N.auto;
    const sel = TCSim.nodes.length > 1 && TCSim.sel === o.n && !N.auto;
    c.fillStyle = hover ? '#fcc21b' : N.auto ? '#3d5a80' : '#16181c';
    c.beginPath(); c.roundRect ? c.roundRect(-10, py - 10, 20, 18, 4) : c.rect(-10, py - 10, 20, 18); c.fill();
    c.strokeStyle = sel ? '#ffd640' : '#f7f7f2';
    c.lineWidth = sel ? 2.4 : 1.4;
    c.stroke();
    c.fillStyle = hover ? '#16181c' : '#f7f7f2';
    c.font = `900 ${N.auto ? 11 : 13}px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(N.auto ? 'A' : ARROWS[h], 0, py);
    if (hover) { // a ring that says "tap me"
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, P(-7, 79), 24 + Math.sin(time * 6) * 1.5, 0, 6.2832); c.stroke();
    }
  },

  // Railway crossing: a post with flashing lamps and a gate arm across one lane.
  crossing(c, o, time) {
    const T = TCSim.train, box = (...a) => Draw.box(...a);
    box(c, -2, 2, -2, 2, 0, 50, '#d9dde3', '#a9aeb6');
    // crossbuck
    c.save(); c.translate(0, P(-3, 46));
    for (const a of [0.6, -0.6]) { c.save(); c.rotate(a); c.fillStyle = '#f7f7f2'; c.fillRect(-13, -2.2, 26, 4.4); c.strokeStyle = '#16181c'; c.lineWidth = 0.8; c.strokeRect(-13, -2.2, 26, 4.4); c.restore(); }
    c.restore();
    const active = T.state !== 'idle';
    for (const [dx, ph] of [[-5, 0], [5, Math.PI]]) {
      const on = active && Math.sin(time * 9 + ph) > 0;
      c.fillStyle = '#16181c'; c.beginPath(); c.arc(dx, P(-3, 34), 3.6, 0, 6.2832); c.fill();
      c.fillStyle = on ? '#ff2e3a' : '#5a1016'; c.beginPath(); c.arc(dx, P(-3, 34), 2.6, 0, 6.2832); c.fill();
      if (on) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,50,50,0.35)'; c.beginPath(); c.arc(dx, P(-3, 34), 10, 0, 6.2832); c.fill(); c.globalCompositeOperation = 'source-over'; }
    }
    // gate arm: swings from upright (raised) to flat across the lane (lowered)
    const g = T.gate, len = RW + 10, ang = (1 - g) * Math.PI * 0.45;
    const n = 9, dir = -o.side; // toward the road's middle
    for (let i = 0; i < n; i++) {
      const r0 = (i / n) * len, r1 = ((i + 1) / n) * len;
      const yA = dir * r0 * Math.cos(ang), yB = dir * r1 * Math.cos(ang);
      const zA = 20 + r0 * Math.sin(ang), zB = 20 + r1 * Math.sin(ang);
      const col = i % 2 ? '#f7f7f2' : '#e63946';
      box(c, -1.6, 1.6, Math.min(yA, yB) - 1, Math.max(yA, yB) + 1, Math.min(zA, zB), Math.max(zA, zB) + 2.6, col, shade(col, -0.25));
    }
  },

  // Patience meter, turn arrow and warning sign above a car.
  overhead(c, car, time) {
    const T = VEHICLE_TYPES[car.type];
    const top = 4 + T.h * TILE + (T.cab ? T.cab[2] * TILE : 0) + 10;
    c.save();
    c.translate(car.x, P(car.y, 0));
    if (car.reckless) Draw.warning(c, time, top + 8);
    else if (car.rage) {
      const y = P(0, top + 8) + Math.sin(time * 14) * 1.5;
      c.fillStyle = '#ff3355'; c.beginPath(); c.arc(0, y, 8, 0, 6.2832); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-1.4, y - 5, 2.8, 6); c.fillRect(-1.4, y + 2.5, 2.8, 2.4);
    } else if (!car.committed && car.wait > car.patience * 0.4) {
      const k = clamp(car.wait / car.patience, 0, 1);
      const y = P(0, top);
      c.fillStyle = 'rgba(14,16,20,0.75)';
      c.fillRect(-14, y - 3, 28, 6);
      c.fillStyle = k < 0.65 ? '#7be07b' : k < 0.85 ? '#ffc619' : '#ff4d4d';
      c.fillRect(-13, y - 2, 26 * (1 - k) + 0.5, 4);
      if (k >= 1) { c.fillStyle = '#ff4d4d'; c.font = `900 9px ${UI_FONT}`; c.textAlign = 'center'; c.fillText('HONK', 0, y - 7); }
    }
    if (car.blink && car.turnS >= 0 && car.s + car.half <= car.turnS + 1 && car.s > car.turnS - 260) {
      const exit = car.path.pts[car.path.pts.length - 1], prev = car.path.pts[car.path.pts.length - 2];
      const eh = snapHeading(exit[0] - prev[0], exit[1] - prev[1]);
      const y = P(0, top + (car.reckless || car.rage ? 26 : 12));
      c.fillStyle = 'rgba(14,16,20,0.75)';
      c.beginPath(); c.arc(0, y, 8, 0, 6.2832); c.fill();
      c.fillStyle = '#ffae00';
      c.font = `900 11px ${UI_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(ARROWS[eh], 0, y + 0.5);
    }
    c.restore();
  },

  // ---- Night ------------------------------------------------------------------------
  nightLayer(c, time, x0, x1, y0, y1) {
    c.fillStyle = 'rgba(8,12,32,0.62)';
    c.fillRect(x0, P(y1, 0), x1 - x0, (y1 - y0) * GY);
    c.globalCompositeOperation = 'lighter';
    if (!this.cone) this.cone = this.makeCone();
    for (const car of TCSim.cars) {
      if (car.gone || car.wreck) continue;
      const [hx, hy] = HEAD[car.heading];
      const fx = car.x + hx * car.half, fy = car.y + hy * car.half;
      c.save();
      c.translate(fx, P(fy, 0));
      c.scale(1, GY);
      c.rotate(Math.atan2(-hy, hx));
      c.globalAlpha = 0.55;
      c.drawImage(this.cone, 0, -30, 110, 60);
      c.restore();
    }
    c.globalAlpha = 1;
    for (const o of this.scenery) if (o.kind === 'lamp') this.glow(c, o.x + o.dir * 13, o.y, 46, '255,214,140', 0.5);
    for (const N of TCSim.nodes) for (const h of N.ways) {
      const L = N.lights[h], [x, y] = LIGHT_POS[h];
      const col = L.state === 'green' ? '60,240,120' : L.state === 'yellow' ? '255,200,40' : '255,60,60';
      this.glow(c, N.x + x, N.y + y - 4, 20, col, 0.55);
    }
    c.globalCompositeOperation = 'source-over';
  },

  // A soft pool of light on the ground (a cached gradient per colour).
  glow(c, x, y, r, rgb, a) {
    this.glows = this.glows || {};
    let img = this.glows[rgb];
    if (!img) {
      img = document.createElement('canvas');
      img.width = img.height = 64;
      const g = img.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},0.9)`);
      gr.addColorStop(0.45, `rgba(${rgb},0.35)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      this.glows[rgb] = img;
    }
    c.globalAlpha = a;
    c.drawImage(img, x - r, P(y, 0) - r * GY, r * 2, r * 2 * GY);
    c.globalAlpha = 1;
  },

  makeCone() {
    const cv = document.createElement('canvas');
    cv.width = 220; cv.height = 120;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 220, 0);
    gr.addColorStop(0, 'rgba(255,240,190,0.85)');
    gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 50); g.lineTo(220, 0); g.lineTo(220, 120); g.lineTo(0, 70); g.closePath(); g.fill();
    return cv;
  },
};

const INVERSE = { E: (x, y) => [x, y], N: (x, y) => [y, -x], W: (x, y) => [-x, -y], S: (x, y) => [-y, x] };
