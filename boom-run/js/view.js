'use strict';
// Boom Run: drawing the highway behind your car in Road Rush's oblique style.

const CHUNK = 520; // world units of road per pre-drawn chunk (a whole number of grass rows)

const BRView = {
  scale: 1, ox: 0, oy: 0, camY: 0,
  shake: 0,
  kick: 0,    // a jolt of camera pull-back (close calls, BOOM)
  pull: 0,    // how far the camera has dropped back to show more road

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
    // the camera follows your car, and drops back to show more road when you're
    // fast, boosting, or just scraped past something
    const want = (p.burning || p.boomT > 0 || p.nitroT > 0 ? 0.8 : 0) + this.kick;
    this.pull = damp(this.pull, Math.min(1.2, want), 4, dt);
    this.kick = Math.max(0, this.kick - dt * 1.6);
    const lead = clamp(p.v / 780, 0, 1) * 40 + this.pull * 38;
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

    // ramps, oil and road markings lie flat on the road
    for (const it of R.items) {
      if (it.y > top + 40 || it.y < bot - 40) continue;
      if (it.kind === 'ramp') this.ramp(c, it);
      else if (it.kind === 'oil') this.oil(c, it, time);
      else if (it.kind === 'chevron') this.chevrons(c, it);
    }

    const list = [];
    for (const t of R.traffic) if (t.y < top + 160 && t.y > bot - 60) list.push(t);
    for (const it of R.items) if (it.kind !== 'ramp' && it.kind !== 'oil' && it.kind !== 'chevron' && it.y < top && it.y > bot) list.push(it);
    for (const g of R.gantries) list.push(g);
    list.push(p);
    list.sort((a, b) => b.y - a.y);

    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, time);

    FX.draw(c);
    FX.drawBlasts(c);
    for (const tn of R.tunnels) if (tn.y0 < top + 200 && tn.y1 > bot - 200) this.tunnel(c, tn, top, bot, time);
    FX.drawTexts(c);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // speed lines at the edges when you're flying (thicker when boosting, red in BOOM)
    const fast = clamp((p.v - 430) / 380, 0, 1) + (p.nitroT > 0 || p.burning ? 0.5 : 0) + (p.boomT > 0 ? 0.8 : 0);
    if (fast > 0.05 && !this.v.low && !p.dead) this.speedLines(c, W, H, fast, time, p.boomT > 0);
    if (p.boomT > 0 && !p.dead) { // a hot rim round the screen while BOOM lasts
      c.strokeStyle = `rgba(255,${80 + 40 * Math.sin(time * 12)},40,${0.35 + 0.15 * Math.sin(time * 9)})`;
      c.lineWidth = 10;
      c.strokeRect(5, 5, W - 10, H - 10);
    }
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
    // rumble strips along both edges: they drum under your wheels
    for (let y = Math.floor(y0 / 24) * 24, k = Math.floor(y0 / 24); y < y1; y += 24, k++) {
      c.fillStyle = k & 1 ? '#d8d8d2' : '#c8402e';
      c.fillRect(-BR_ROAD - 4, P(y + 12, 0), 4, 12 * GY);
      c.fillRect(BR_ROAD, P(y + 12, 0), 4, 12 * GY);
    }
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
    // street lamps at a steady beat (you feel the speed in them), a marker every km
    for (let y = Math.ceil(y0 / 260) * 260; y < y0 + CHUNK; y += 260) for (const side of [-1, 1]) out.push({ kind: 'lamp', x: side * (BR_SHOULDER + 10), y, side });
    for (let y = Math.ceil(y0 / 10000) * 10000; y < y0 + CHUNK; y += 10000) if (y > 0) out.push({ kind: 'kmsign', x: -(BR_SHOULDER + 22), y: y + 12, km: y / 10000 });
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
      if (o.flung) { c.translate(0, -Math.sin(Math.min(1, o.flungT) * Math.PI) * 14); c.rotate(Math.sin(o.spin) * 0.6); c.globalAlpha = clamp(1.7 - o.flungT, 0, 1); }
      if (o.carrier) this.carrier(c, o, time);
      else Cars.draw(c, o.car, time);
    } else {
      const key = this.spriteKey(o);
      switch (o.kind) {
        case 'coin': Draw.coin(c, o, time); break;
        case 'power': Draw.powerItem(c, o, time); break;
        case 'fuel': this.fuel(c, o, time); break;
        case 'gantry': this.gantry(c, o); break;
        case 'welcome': Draw.welcome(c, o); break;
        case 'roadpost': Draw.box(c, -1.2, 1.2, -1.2, 1.2, 0, 10, '#f7f7f2', '#c9c9c2'); c.fillStyle = '#ff6a2a'; c.fillRect(-1.2, P(-1.2, 9), 2.4, 2); break;
        case 'lamp': this.lamp(c, o); break;
        case 'kmsign': this.kmsign(c, o); break;
        case 'cone': case 'barrel': case 'board': this.roadwork(c, o, time); break;
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
    // BOOM: a hot glow under the car
    if (p.boomT > 0 && !p.dead) {
      c.globalCompositeOperation = 'lighter';
      const r = car.len * (0.75 + 0.08 * Math.sin(time * 14));
      c.fillStyle = 'rgba(255,90,30,0.35)';
      c.beginPath(); c.ellipse(0, P(0, 2), r * 0.8, r * 0.75 * GY, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,200,80,0.25)';
      c.beginPath(); c.ellipse(0, P(0, 2), r * 0.5, r * 0.45 * GY, 0, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    // flames out the back: nitro and BOOM big and orange, boost a hot blue
    if ((p.nitroT > 0 || p.boomT > 0 || p.burning) && !p.dead) {
      c.globalCompositeOperation = 'lighter';
      const L = car.len / 2, f = 0.75 + Math.sin(time * 40) * 0.25, big = p.nitroT > 0 || p.boomT > 0;
      const flames = big ? [[30, 7, 'rgba(255,120,40,0.85)'], [20, 5, 'rgba(255,210,90,0.95)'], [11, 3, 'rgba(160,220,255,0.95)']]
        : [[18, 5, 'rgba(80,150,255,0.8)'], [11, 3, 'rgba(190,230,255,0.95)']];
      for (const [len, w, col] of flames) {
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

  // ---- Things on and beside the road -------------------------------------------------
  // A street lamp leaning over the road.
  lamp(c, o) {
    const s = -o.side, box = (...a) => Draw.box(...a);
    box(c, -2, 2, -2, 2, 0, 58, '#7a818c', '#575d68');
    box(c, s < 0 ? -18 : 0, s < 0 ? 0 : 18, -1.6, 1.6, 54, 58, '#848b96', '#5e6470');
    box(c, s * 18 - 5, s * 18 + 5, -3.5, 3.5, 50, 54, '#fff2b8', '#e6d38a');
  },

  // A green kilometre marker.
  kmsign(c, o) {
    Draw.box(c, -1.4, 1.4, -1.4, 1.4, 0, 22, '#a5abb5', '#7c828c');
    Draw.box(c, -9, 9, -2.5, -1, 22, 36, '#00704a', '#00573a');
    c.fillStyle = '#f7f7f2';
    c.font = `900 9px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${o.km} km`, 0, P(-2.5, 29));
  },

  // Cones, barrels and the arrow board: they go flying when you hit them.
  roadwork(c, o, time) {
    if (o.flying) { c.translate(0, P(0, o.z) - P(0, 0)); c.rotate(o.spin); }
    const box = (...a) => Draw.box(...a);
    if (o.kind === 'cone') Draw.cone(c);
    else if (o.kind === 'barrel') {
      box(c, -6.5, 6.5, -5.5, 5.5, 0, 17, '#f26722', '#c44c10');
      c.fillStyle = '#f7f7f2';
      for (const z of [5, 11]) c.fillRect(-6.5, P(-5.5, z + 2.4), 13, 2.4 * GZ);
      box(c, -5.5, 5.5, -4.5, 4.5, 17, 18.5, '#2b2d33', '#1b1d22');
    } else { // an arrow board on its little trailer
      for (const x of [-10, 8]) box(c, x, x + 2, -3, 3, 0, 6, '#1b1d22', '#121316');
      box(c, -13, 13, -4, 4, 5, 8, '#f26722', '#c44c10');
      box(c, -12, 12, -2.2, 0, 8, 28, '#1b1d22', '#121316');
      const on = Math.sin(time * 7) > 0;
      c.fillStyle = on ? '#ffd23f' : '#5a4a1a';
      const d = o.dir, y = P(-2.2, 18);
      for (let k = -2; k <= 2; k++) c.fillRect(k * 3.4 - 1, y - 1, 2, 2); // the shaft
      for (const [dx, dy] of [[1, -1], [2, -2], [1, 1], [2, 2]]) c.fillRect(d * 6.8 - d * dx * 2.6 - 1, y + dy * 2.6 - 1, 2, 2); // the head
    }
  },

  oil(c, o, time) {
    c.save();
    c.translate(o.x, P(o.y, 0));
    c.fillStyle = 'rgba(14,14,18,0.82)';
    c.beginPath(); c.ellipse(0, 0, o.r, o.r * 0.75 * GY, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(o.r * 0.5, o.r * 0.25 * GY, o.r * 0.55, o.r * 0.35 * GY, 0.3, 0, 6.2832); c.fill();
    // a rainbow sheen
    const g = c.createLinearGradient(-o.r, 0, o.r, 0);
    g.addColorStop(0, 'rgba(120,60,200,0.25)'); g.addColorStop(0.5, 'rgba(40,200,180,0.25)'); g.addColorStop(1, 'rgba(230,200,60,0.2)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(-o.r * 0.15, -o.r * 0.1 * GY, o.r * 0.6, o.r * 0.32 * GY, -0.2, 0, 6.2832); c.fill();
    c.restore();
  },

  // Merge arrows painted across the closing lane.
  chevrons(c, o) {
    c.save();
    c.fillStyle = 'rgba(247,247,242,0.8)';
    for (let k = 0; k < 3; k++) {
      const y = o.y + k * 40, x = o.x;
      c.beginPath();
      c.moveTo(x - o.dir * 10, P(y + 12, 0));
      c.lineTo(x + o.dir * 10, P(y, 0));
      c.lineTo(x - o.dir * 10, P(y - 12, 0));
      c.lineTo(x - o.dir * 10 + o.dir * 5, P(y, 0));
      c.closePath(); c.fill();
    }
    c.restore();
  },

  // A car carrier: a red cab, a long deck with two cars on it, and a ramp off the back.
  carrier(c, o, time) {
    const L = o.car.len, box = (...a) => Draw.box(...a), wreck = o.car.wreck;
    const hw = 13, deck = 12;
    if (!o.load) o.load = [0, 1].map(() => Cars.make(pick(['sedan', 'small', 'sports', 'taxi', 'elfer', 'rossoF8', 'toroFuria']), null, 'N'));
    const dark = wreck ? '#1c1c1e' : '#3a3d44', darkF = wreck ? '#141414' : '#26282d';
    // wheels and the deck
    for (const u of [-0.42, -0.3, 0.1, 0.3]) for (const s of [-1, 1]) box(c, s * hw - 2, s * hw + 2, u * L - 6, u * L + 6, 0, 11, '#24262c', '#121317');
    box(c, -hw, hw, -L / 2 + 8, L * 0.36, 7, deck, dark, darkF);
    // the ramp off the back: yellow and black, rising onto the deck
    for (let i = 0; i < 4; i++) {
      const ya = -L / 2 + i * 2.5, yb = ya + 2.5;
      box(c, -hw + 2, hw - 2, ya, yb, 0, 2 + i * 2.6, i % 2 ? '#ffd23f' : '#2b2f36', i % 2 ? '#c99a10' : '#1b1e23');
    }
    // the cab up front
    box(c, -hw, hw, L * 0.36, L / 2, 6, 34, wreck ? '#2a2222' : '#d62828', wreck ? '#1d1818' : '#a51e1e');
    if (!wreck) { c.fillStyle = '#223149'; c.fillRect(-hw + 3, P(L * 0.36, 31), hw * 2 - 6, 6 * GZ); }
    // two cars riding on the deck, the back one first
    for (const [k, u] of [[0, -0.22], [1, 0.12]]) {
      const car = o.load[k];
      if (wreck && !car.wreck) Cars.wreck(car);
      c.save(); c.translate(0, P(u * L, deck)); Cars.draw(c, car, time); c.restore();
    }
  },

  // A tunnel: dark inside, lamps on the walls rushing past, a portal at each end.
  tunnel(c, tn, top, bot, time) {
    const y0 = Math.max(tn.y0, bot - 40), y1 = Math.min(tn.y1, top + 80), W = BR_SHOULDER + 10;
    if (y1 <= y0) return;
    const box = (...a) => Draw.box(...a);
    c.save();
    // the gloom under the roof (an open gallery: you can still see in)
    c.fillStyle = 'rgba(8,10,16,0.5)';
    c.fillRect(-W, P(y1, 0), W * 2, (y1 - y0) * GY);
    // the walls, with a lamp every so often
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -W - 6 : W, x1 = x0 + 6;
      box(c, x0, x1, y0, y1, 0, 36, '#55585f', '#3d4046');
      c.fillStyle = '#ffe7a0';
      for (let y = Math.ceil(y0 / 70) * 70; y < y1; y += 70) c.fillRect(s < 0 ? x1 - 1 : x0 - 1, P(y + 6, 30), 2, 6 * GY + 2);
    }
    // roof beams across the road, flicking past overhead
    for (let y = Math.ceil(y0 / 90) * 90; y < y1; y += 90) box(c, -W - 2, W + 2, y - 3, y + 3, 33, 37, '#7a7e86', '#565a62');
    // portals where it starts and ends
    for (const py of [tn.y0, tn.y1]) {
      if (py < bot - 40 || py > top + 80) continue;
      box(c, -W - 10, W + 10, py - 8, py, 36, 52, '#6b6f78', '#4b4f57');
      box(c, -W - 14, -W - 4, py - 8, py, 0, 52, '#6b6f78', '#4b4f57');
      box(c, W + 4, W + 14, py - 8, py, 0, 52, '#6b6f78', '#4b4f57');
    }
    // your headlights cutting through
    const p = BRRoad.player;
    if (p.y > tn.y0 && p.y < tn.y1 && !p.dead) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,240,190,0.12)';
      c.beginPath();
      c.moveTo(p.x - 8, P(p.y + 20, 0));
      c.lineTo(p.x - 40, P(p.y + 220, 0));
      c.lineTo(p.x + 40, P(p.y + 220, 0));
      c.lineTo(p.x + 8, P(p.y + 20, 0));
      c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  },

  speedLines(c, W, H, k, time, hot) {
    c.strokeStyle = hot ? `rgba(255,150,80,${Math.min(0.45, 0.2 * k)})` : `rgba(255,255,255,${Math.min(0.38, 0.18 * k)})`;
    c.lineWidth = k > 1 ? 3 : 2;
    c.beginPath();
    for (let i = 0; i < (k > 1 ? 22 : 14); i++) {
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (W * 0.32 + ((i * 53) % (W * 0.18)));
      const y = ((i * 97 + time * 1400) % (H + 200)) - 100;
      c.moveTo(x, y);
      c.lineTo(x, y + 40 + 40 * k);
    }
    c.stroke();
  },
};
