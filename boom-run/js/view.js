'use strict';
// Boom Run: drawing the highway behind your car in Road Rush's oblique style.

const CHUNK = 520; // world units of road per pre-drawn chunk (a whole number of grass rows)

const BRView = {
  scale: 1, ox: 0, oy: 0, camY: 0,
  shake: 0,

  init(canvas) {
    this.v = Kit.view(canvas, { low: BRGame.settings.low, onResize: () => this.fit() });
    this.fit();
    if (document.fonts) document.fonts.ready.then(() => { this.chunks = new Map(); }); // welcome-sign lettering
  },

  setLow(low) { this.v.low = low; this.v.resize(); FX.quality = low ? 0.5 : 1; },

  // Your car sits low on the screen with plenty of road visible ahead.
  fit() {
    if (!this.v) return;
    const { W, H } = this.v;
    const ahead = 660;
    this.oy = H * 0.76;
    const s = clamp(Math.min(W / 310, this.oy / (ahead * GY)), 0.55, 1.6);
    this.scale = s;
    this.ox = W / 2;
    BRRoad.viewAhead = this.oy / (s * GY);
    BRRoad.viewBehind = (H - this.oy) / (s * GY) + 40;
    BRRoad.viewX = W / 2 / s;
    Renderer.base = s;
    Renderer.dpr = this.v.dpr;
    this.chunks = new Map(); // pre-drawn road and scenery, redrawn at the new size
  },

  draw(time, dt) {
    const { c, W, H, dpr } = this.v, s = this.scale, R = BRRoad, p = R.player;
    // the camera follows your car smoothly, and drops back a little at speed
    const lead = clamp(p.v / 780, 0, 1) * 40;
    this.camY = p.y + lead;
    let sx = 0, sy = 0;
    if (this.shake > 0.3 && BRGame.settings.shake) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    this.shake = Math.max(0, this.shake - dt * 40);
    const camX = clamp(p.x * 0.25, -20, 20);
    const top = this.camY + this.oy / (s * GY) + 40, bot = this.camY - (H - this.oy) / (s * GY) - 40;
    Renderer.yTop = top; Renderer.yBot = bot;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = BIOMES[R.biomeAt(this.camY)].ground;
    c.fillRect(0, 0, W, H);
    // world transform: screen = (ox + (x - camX) s, oy + P(y - camY) s)
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (this.ox - camX * s + sx), dpr * (this.oy + this.camY * GY * s + sy));

    // the road and roadside, pre-drawn in chunks, far to near
    c.setTransform(1, 0, 0, 1, 0, 0);
    const i0 = Math.floor((bot - 40) / CHUNK), i1 = Math.floor((top + 260) / CHUNK);
    for (let i = i1; i >= i0; i--) {
      const ch = this.chunk(i);
      const dx = (this.ox - camX * s + sx) - (W / 2 + this.margin);
      const dy = (this.oy + sy) + P((i + 1) * CHUNK - this.camY, 0) * s - this.head;
      c.drawImage(ch, Math.round(dx * dpr), Math.round(dy * dpr));
    }
    for (const k of this.chunks.keys()) if (k < i0 - 1 || k > i1 + 2) this.chunks.delete(k);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (this.ox - camX * s + sx), dpr * (this.oy + this.camY * GY * s + sy));
    FX.drawDecals(c);

    // ramps lie flat on the road
    for (const it of R.items) if (it.kind === 'ramp') this.ramp(c, it);

    const list = [];
    for (const t of R.traffic) if (t.y < top + 120 && t.y > bot - 60) list.push(t);
    for (const it of R.items) if (it.kind !== 'ramp' && it.y < top && it.y > bot) list.push(it);
    for (const g of R.gantries) list.push(g);
    list.push(p);
    list.sort((a, b) => b.y - a.y);

    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, time);

    FX.draw(c);
    FX.drawBlasts(c);
    FX.drawTexts(c);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // speed lines at the edges when you're flying
    const fast = clamp((p.v - 520) / 400, 0, 1) + (p.nitroT > 0 ? 0.6 : 0);
    if (fast > 0.05 && !this.v.low && !p.dead) this.speedLines(c, W, H, fast, time);
    FX.drawFlash(c, W, H);
  },

  ground(c, x0, x1, y0, y1) {
    const R = BRRoad;
    // grass rows (alternating like Road Rush), coloured by biome
    const t = TILE;
    for (let y = Math.floor(y0 / t) * t; y < y1; y += t) {
      const B = BIOMES[R.biomeAt(y)];
      c.fillStyle = (Math.floor(y / t) & 1) ? B.ground2 : B.ground;
      c.fillRect(x0, P(y + t, 0), x1 - x0, t * GY + 0.5);
    }
    // gravel shoulders, the road, its edge lines and lane dashes
    c.fillStyle = '#8d877c';
    c.fillRect(-BR_SHOULDER, P(y1, 0), BR_SHOULDER * 2, (y1 - y0) * GY);
    c.fillStyle = '#3a3d44';
    c.fillRect(-BR_ROAD, P(y1, 0), BR_ROAD * 2, (y1 - y0) * GY);
    c.fillStyle = 'rgba(247,247,242,0.85)';
    c.fillRect(-BR_ROAD + 3, P(y1, 0), 2, (y1 - y0) * GY);
    c.fillRect(BR_ROAD - 5, P(y1, 0), 2, (y1 - y0) * GY);
    const dash = 46, gap = 34;
    for (const x of [-40, 40]) {
      c.fillStyle = 'rgba(247,247,242,0.7)';
      for (let y = Math.floor(y0 / (dash + gap)) * (dash + gap); y < y1; y += dash + gap) c.fillRect(x - 1.2, P(y + dash, 0), 2.4, dash * GY);
    }
    c.fillStyle = R.wrong ? '#f2c230' : 'rgba(247,247,242,0.7)'; // middle line: solid yellow when it's two-way
    if (R.wrong) c.fillRect(-1.5, P(y1, 0), 3, (y1 - y0) * GY);
    else for (let y = Math.floor(y0 / (dash + gap)) * (dash + gap); y < y1; y += dash + gap) c.fillRect(-1.2, P(y + dash, 0), 2.4, dash * GY);
  },

  // ---- Pre-drawn chunks -------------------------------------------------------------
  // A stretch of road with its roadside, drawn once into a picture. Scenery never
  // reaches the road (it stands well clear of the shoulders), so cars can simply
  // be drawn on top.
  chunk(i) {
    let cv = this.chunks.get(i);
    if (cv) return cv;
    const { W, dpr } = this.v, s = this.scale;
    this.margin = 40;
    this.head = Math.round(210 * s * dpr) / dpr; // room above for tall trees and buildings (whole pixels: no seams)
    const y0 = i * CHUNK, y1 = y0 + CHUNK;
    cv = document.createElement('canvas');
    cv.width = Math.ceil((W + 2 * this.margin) * dpr);
    cv.height = Math.ceil(((CHUNK + 8) * GY * s + this.head) * dpr);
    const c = cv.getContext('2d');
    // world (x, y) -> chunk pixel: x centred, the chunk's far edge at `head`
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 + this.margin), dpr * this.head - P(y1, 0) * s * dpr);
    const xr = (W / 2 + this.margin) / s;
    this.ground(c, -xr, xr, y0 - 6, y1); // overlaps the next chunk a little: no seams
    const objs = this.sceneryFor(i, xr);
    objs.sort((a, b) => b.y - a.y);
    for (const o of objs) this.shadowOf(c, o);
    for (const o of objs) this.object(c, o, 0);
    this.chunks.set(i, cv);
    return cv;
  },

  // The roadside for chunk i: the same every time for this run.
  sceneryFor(i, xr) {
    const R = BRRoad, rnd = Kit.seeded(R.seed + i * 7919);
    const r = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(r(a, b + 1)), pk = arr => arr[Math.floor(rnd() * arr.length)];
    const out = [], y0 = i * CHUNK;
    // a welcome sign where a new biome starts
    if (y0 > 0 && y0 % BR_SECTION === 0) out.push({ kind: 'welcome', zone: BR_WELCOME[R.biomeAt(y0)], x: BR_SHOULDER + 34, y: y0 + 70, side: 1 });
    for (let y = y0 + 22; y < y0 + CHUNK - 18; y += 38) {
      const biome = R.biomeAt(y), B = BIOMES[biome];
      for (const side of [-1, 1]) {
        if (rnd() < 0.18) out.push({ kind: 'roadpost', x: side * (BR_SHOULDER + 4), y });
        for (let x = BR_SHOULDER + 26 + r(0, 20); x < xr + 40; x += r(40, 70)) {
          if (rnd() < 0.45) continue;
          const o = this.decor(biome, B, side * x, y + r(-10, 10), rnd, r, ri, pk);
          if (o) out.push(o);
        }
      }
    }
    return out.filter(o => o.kind !== 'welcome' || o.y < y0 + CHUNK - 20);
  },

  decor(biome, B, x, y, rnd, r, ri, pk) {
    const tree = () => {
      const t = B.tree;
      const o = { kind: 'tree', x, y, size: ri(13, 16), tiers: ri(1, 3), pal: { top: t[0], front: t[1], top2: t[2], front2: t[3] } };
      if (biome === 'snow') { o.pine = true; o.tiers = ri(2, 3); }
      return o;
    };
    const bush = () => { const b = B.bush; return { kind: 'bush', x, y, pal: { top: b[0], front: b[1], top2: b[2], front2: b[3] }, flower: null }; };
    const roll = rnd();
    switch (biome) {
      case 'desert': return roll < 0.35 ? { kind: 'cactus', x, y, h: ri(13, 20) * 2, arms: ri(0, 2), flip: rnd() < 0.5 ? 1 : -1 } : roll < 0.55 ? { kind: 'rock', x, y, zone: 'desert' } : roll < 0.75 ? { kind: 'deadbush', x, y } : null;
      case 'snow': return roll < 0.5 ? tree() : roll < 0.58 ? { kind: 'snowman', x, y } : roll < 0.7 ? { kind: 'rock', x, y, zone: 'snow' } : null;
      case 'city':
        if (Math.abs(x) > 150 && roll < 0.3) {
          const v = ri(0, 3);
          return { kind: 'building', x, y, w: pk([1.4, 1.8, 2.2]) * TILE, h: pk([80, 110, 140, 170]), v, color: pk(['#7d8796', '#a0876e', '#8b6f63', '#6f7f8c', '#9a9fa8', '#b39a7c']), lit: BR_WINDOWS[v] };
        }
        return roll < 0.6 ? { kind: 'planter', x, y, size: ri(10, 12), tiers: 1, pal: { top: B.tree[0], front: B.tree[1], top2: B.tree[2], front2: B.tree[3] } } : null;
      case 'farm': return roll < 0.3 ? { kind: 'corn', x, y, h: 30 + ri(0, 3) * 3 } : roll < 0.45 ? tree() : roll < 0.55 ? { kind: 'hay', x, y } : roll < 0.6 ? { kind: 'scarecrow', x, y } : null;
      default: return roll < 0.45 ? tree() : roll < 0.65 ? bush() : null; // town and autumn
    }
  },

  ramp(c, it) {
    const x0 = it.x - 17, x1 = it.x + 17, y0 = it.y - RAMP_LEN / 2, y1 = it.y + RAMP_LEN / 2;
    // a wedge rising away from you, drawn as steps
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const ya = y0 + (i / steps) * (y1 - y0), yb = y0 + ((i + 1) / steps) * (y1 - y0);
      const z = ((i + 1) / steps) * 12;
      Draw.box(c, x0, x1, ya, yb, 0, z, i % 2 ? '#ffd23f' : '#2b2f36', i % 2 ? '#c99a10' : '#1b1e23');
    }
  },

  shadowOf(c, o) {
    if (o === BRRoad.player) {
      const k = 1 - Math.min(0.6, o.z / 120);
      c.save(); c.translate(o.x, P(o.y, 0)); c.globalAlpha = k; Cars.shadow(c, o.car, 0.9 * k); c.restore();
      return;
    }
    if (o.car) { c.save(); c.translate(o.x, P(o.y, 0)); Cars.shadow(c, o.car, 0.8); c.restore(); return; }
    switch (o.kind) {
      case 'tree': Draw.shadow(c, o.x, o.y, o.size * 2.8, o.size * 2.5, 0.8); break;
      case 'building': Draw.shadow(c, o.x + 10, o.y - 6, o.w * 1.1, 44, 0.8); break;
      case 'cactus': Draw.shadow(c, o.x, o.y, 0.6 * TILE, 0.5 * TILE, 0.7); break;
      case 'bush': case 'hay': case 'corn': case 'rock': Draw.shadow(c, o.x, o.y, 0.8 * TILE, 0.7 * TILE, 0.6); break;
      default: break;
    }
  },

  object(c, o, time) {
    c.save();
    c.translate(o.x, P(o.y, 0));
    if (o === BRRoad.player) this.drawPlayer(c, o, time);
    else if (o.car) {
      if (o.flung) { c.rotate(Math.sin(o.spin) * 0.4); c.globalAlpha = clamp(1.4 - o.flungT, 0, 1); }
      Cars.draw(c, o.car, time);
    } else {
      const key = this.spriteKey(o);
      switch (o.kind) {
        case 'coin': Draw.coin(c, o, time); break;
        case 'power': Draw.powerItem(c, o, time); break;
        case 'fuel': this.fuel(c, o, time); break;
        case 'gantry': this.gantry(c, o); break;
        case 'welcome': Draw.welcome(c, o); break;
        case 'roadpost': Draw.box(c, -1.2, 1.2, -1.2, 1.2, 0, 10, '#f7f7f2', '#c9c9c2'); c.fillStyle = '#ff6a2a'; c.fillRect(-1.2, P(-1.2, 9), 2.4, 2); break;
        default:
          if (!key || !Sprites.drawKey(c, key, g => this.scenery(g, o))) this.scenery(c, o);
      }
    }
    c.restore();
  },

  spriteKey(o) {
    switch (o.kind) {
      case 'tree': return `tree|${o.size}|${o.tiers}|${o.pine ? 1 : 0}|${o.pal.top}`;
      case 'bush': return `bush|${o.pal.top}`;
      case 'cactus': return `cactus|${o.h}|${o.arms}|${o.flip}`;
      case 'rock': return `rock|${o.zone}`;
      case 'planter': return `planter|${o.size}|${o.pal.top}`;
      case 'corn': return `corn|${o.h}`;
      case 'hay': case 'scarecrow': case 'snowman': case 'deadbush': return o.kind;
      case 'building': return `bld|${o.w}|${o.h}|${o.color}|${o.v}`;
      default: return null;
    }
  },

  scenery(c, o) {
    switch (o.kind) {
      case 'tree': Draw.tree(c, o, o.pine ? 1 : 0); break;
      case 'bush': Draw.bush(c, o); break;
      case 'cactus': Draw.cactus(c, o); break;
      case 'rock': Draw.rock(c, o); break;
      case 'deadbush': Draw.deadbush(c, o); break;
      case 'snowman': Draw.snowman(c, o); break;
      case 'building': Draw.building(c, o); break;
      case 'planter': Draw.planter(c, o); break;
      case 'corn': Draw.corn(c, o); break;
      case 'hay': Draw.hay(c); break;
      case 'scarecrow': Draw.scarecrow(c); break;
      default: break;
    }
  },

  drawPlayer(c, p, time) {
    if (p.z > 0) c.translate(0, P(0, p.z));
    const car = p.car;
    car.brake = BRGame.input.brake && !p.dead;
    if (!p.dead) c.rotate(p.steer * 0.05);
    // nitro flames out the back
    if (p.nitroT > 0 && !p.dead) {
      c.globalCompositeOperation = 'lighter';
      const L = car.len / 2, f = 0.75 + Math.sin(time * 40) * 0.25;
      for (const [len, w, col] of [[30, 7, 'rgba(255,120,40,0.85)'], [20, 5, 'rgba(255,210,90,0.95)'], [11, 3, 'rgba(160,220,255,0.95)']]) {
        for (const dx of [-7, 7]) {
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(dx - w / 2, P(-L, 8));
          c.lineTo(dx, P(-L - len * f, 8));
          c.lineTo(dx + w / 2, P(-L, 8));
          c.closePath(); c.fill();
        }
      }
      c.globalCompositeOperation = 'source-over';
    }
    if (p.safeT > 0 && Math.sin(time * 30) > 0) c.globalAlpha = 0.5;
    Cars.draw(c, car, time);
    c.globalAlpha = 1;
    // shield bubble
    if (p.shield && !p.dead) {
      const r = car.len * 0.62;
      c.strokeStyle = `rgba(61,155,255,${0.55 + 0.2 * Math.sin(time * 5)})`;
      c.lineWidth = 2;
      c.fillStyle = 'rgba(61,155,255,0.12)';
      c.beginPath(); c.ellipse(0, P(0, 14), r * 0.75, r * 0.7, 0, 0, 6.2832); c.fill(); c.stroke();
    }
    if (p.magnetT > 0 && !p.dead) {
      c.strokeStyle = `rgba(255,79,109,${0.3 + 0.2 * Math.sin(time * 8)})`;
      c.lineWidth = 1.5;
      const r = 40 + ((time * 60) % 40);
      c.beginPath(); c.ellipse(0, P(0, 2), r, r * GY, 0, 0, 6.2832); c.stroke();
    }
  },

  fuel(c, o, time) {
    const z = 10 + Math.sin(time * 4 + o.phase) * 2.5;
    c.translate(0, P(0, z));
    Draw.box(c, -7, 7, -5, 5, 0, 18, '#e53935', '#b52a27');
    Draw.box(c, -2.5, 2.5, -2, 2, 18, 22, '#ffd54f', '#c9a020');
    c.fillStyle = '#fff';
    c.font = `900 9px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('F', 0, P(-5, 6));
  },

  // A green overhead sign across the road: a checkpoint.
  gantry(c, o) {
    const box = (...a) => Draw.box(...a);
    for (const x of [-BR_ROAD - 8, BR_ROAD + 4]) box(c, x, x + 4, -2, 2, 0, 74, '#a5abb5', '#7c828c');
    box(c, -BR_ROAD - 8, BR_ROAD + 8, -3, 3, 70, 74, '#a5abb5', '#7c828c');
    box(c, -46, 46, -4, -2, 74, 98, '#00704a', '#00573a');
    c.strokeStyle = '#f7f7f2';
    c.lineWidth = 1.2;
    c.strokeRect(-43, P(-4, 95), 86, 18 * GZ);
    c.fillStyle = '#f7f7f2';
    c.font = `900 11px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(o.passed ? '✓ CHECKPOINT' : `CHECKPOINT ${o.n}`, 0, P(-4, 86));
  },

  speedLines(c, W, H, k, time) {
    c.strokeStyle = `rgba(255,255,255,${Math.min(0.35, 0.18 * k)})`;
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (W * 0.32 + ((i * 53) % (W * 0.18)));
      const y = ((i * 97 + time * 1400) % (H + 200)) - 100;
      c.moveTo(x, y);
      c.lineTo(x, y + 40 + 40 * k);
    }
    c.stroke();
  },
};
