'use strict';
// Hall of Art: more sculpture and physics. Falling sand, plinko, planets, dominoes,
// a jelly blob and a pane of glass.

// 39. Falling sand: pour sand and water, build with wood, then set it on fire.
const SAND = { EMPTY: 0, SAND: 1, WATER: 2, WOOD: 3, FIRE: 4, SMOKE: 5 };
Exhibits.add({
  id: 'sand', name: 'Falling Sand', section: 'physics', hint: 'Pour sand and water, build with wood, burn it', canvas: true,
  setup(t) {
    t.mat = SAND.SAND;
    const pickMat = (m, b) => { t.mat = m; for (const x of t.btns) x.classList.toggle('on', x === b); };
    t.btns = HA.tools(t, [
      ['Sand', b => pickMat(SAND.SAND, b), true], ['Water', b => pickMat(SAND.WATER, b)],
      ['Wood', b => pickMat(SAND.WOOD, b)], ['Fire', b => pickMat(SAND.FIRE, b)],
    ]);
    HA.tools(t, [['Clear', () => { t.g.fill(0); t.blip(200, 0.1, 'sine', 0.06, 0.5); }]], 'tr');
    this.make(t);
  },
  resize(t) { this.make(t); },
  make(t) {
    t.cs = Math.max(2, t.W / (t.low ? 80 : 120));
    const w = t.gw = Math.floor(t.W / t.cs), h = t.gh = Math.floor(t.H / t.cs);
    t.g = new Uint8Array(w * h);   // what's in each cell
    t.v = new Uint8Array(w * h);   // its shade (or, for fire and smoke, how long it has left)
    t.f = new Uint8Array(w * h);   // the step it last moved in
    t.off = document.createElement('canvas');
    t.off.width = w; t.off.height = h;
    t.oc = t.off.getContext('2d');
    t.img = t.oc.createImageData(w, h);
    t.n = 0; t.idleT = 2; t.pourT = 0;
    // something to start with: a wooden shelf with a heap of sand on it
    const shelf = Math.floor(h * 0.62);
    for (let x = Math.floor(w * 0.16); x < w * 0.52; x++) for (const y of [shelf, shelf + 1]) this.set(t, x, y, SAND.WOOD);
    for (let y = Math.floor(h * 0.4); y < shelf; y++) for (let x = Math.floor(w * 0.2); x < w * 0.46; x++) if (Math.abs(x - w * 0.33) < (y - h * 0.4) * 1.2 && Math.random() < 0.85) this.set(t, x, y, SAND.SAND);
  },
  set(t, x, y, m) {
    const i = y * t.gw + x;
    t.g[i] = m;
    t.v[i] = m === SAND.FIRE ? 20 + Math.random() * 25 : m === SAND.SMOKE ? 30 + Math.random() * 30 : Math.random() * 255;
  },
  paint(t, px, py) {
    const cx = Math.floor(px / t.cs), cy = Math.floor(py / t.cs), r = t.big ? 4 : 3;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= t.gw || y >= t.gh || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = y * t.gw + x, here = t.g[i];
      if (t.mat === SAND.FIRE) {
        if (here === SAND.WOOD) { this.set(t, x, y, SAND.FIRE); t.v[i] = 60 + Math.random() * 60; }
        else if (!here && Math.random() < 0.3) this.set(t, x, y, SAND.FIRE);
      } else if (!here && (t.mat === SAND.WOOD || Math.random() < 0.45)) this.set(t, x, y, t.mat);
    }
  },
  down(t, e) { if (e && e.target.closest && e.target.closest('button')) return; t.idleT = 0; this.paint(t, t.p.x, t.p.y); },
  step(t) {
    const w = t.gw, h = t.gh, g = t.g, v = t.v, f = t.f;
    const st = t.n = (t.n % 250) + 1, flip = st & 1;
    const swap = (i, j) => { const a = g[i]; g[i] = g[j]; g[j] = a; const b = v[i]; v[i] = v[j]; v[j] = b; f[j] = st; f[i] = st; };
    const free = (x, y, also) => x >= 0 && x < w && y >= 0 && y < h && (g[y * w + x] === SAND.EMPTY || g[y * w + x] === also);
    const drain0 = Math.floor(w * 0.47), drain1 = Math.ceil(w * 0.53);
    for (let y = h - 1; y >= 0; y--) {
      for (let k = 0; k < w; k++) {
        const x = flip ? k : w - 1 - k, i = y * w + x, m = g[i];
        if (m === SAND.EMPTY || m === SAND.WOOD || f[i] === st) continue;
        if (m === SAND.SAND || m === SAND.WATER) {
          // a drain in the middle of the floor, so the box never fills up
          if (y === h - 1 && x >= drain0 && x < drain1) { if (Math.random() < 0.4) g[i] = SAND.EMPTY; continue; }
          const sink = m === SAND.SAND ? SAND.WATER : -1, d = Math.random() < 0.5 ? 1 : -1;
          if (free(x, y + 1, sink)) swap(i, i + w);
          else if (free(x + d, y + 1, sink)) swap(i, i + w + d);
          else if (free(x - d, y + 1, sink)) swap(i, i + w - d);
          else if (m === SAND.WATER) { if (free(x + d, y)) swap(i, i + d); else if (free(x - d, y)) swap(i, i - d); }
        } else if (m === SAND.FIRE) {
          if (--v[i] <= 0) { g[i] = Math.random() < 0.4 ? SAND.SMOKE : SAND.EMPTY; v[i] = 40; continue; }
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const X = x + a, Y = y + b;
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const j = Y * w + X;
            if (g[j] === SAND.WOOD && Math.random() < 0.035) { g[j] = SAND.FIRE; v[j] = 60 + Math.random() * 60; f[j] = st; }
            if (g[j] === SAND.WATER) { g[i] = SAND.SMOKE; v[i] = 40; if (Math.random() < 0.5) { g[j] = SAND.SMOKE; v[j] = 40; } break; }
          }
          if (g[i] === SAND.FIRE && Math.random() < 0.4) { const d = Math.floor(Math.random() * 3) - 1; if (free(x + d, y - 1)) swap(i, i - w + d); }
        } else if (m === SAND.SMOKE) {
          if (--v[i] <= 0 || y === 0) { g[i] = SAND.EMPTY; continue; }
          const d = Math.floor(Math.random() * 3) - 1;
          if (free(x + d, y - 1)) swap(i, i - w + d);
        }
      }
    }
  },
  frame(t, dt, time) {
    // left alone, it pours by itself (sand, then water)
    t.idleT += dt;
    if (t.p.down) { t.idleT = 0; this.paint(t, t.p.x, t.p.y); }
    else if (t.idleT > 4) {
      const m = Math.floor(time / 4) % 2 ? SAND.WATER : SAND.SAND, x = Math.floor(t.gw * (0.5 + Math.sin(time * 0.6) * 0.3));
      for (const dx of [0, 1]) if (!t.g[x + dx] && Math.random() < 0.7) this.set(t, x + dx, 0, m);
    }
    this.step(t);
    const g = t.g, v = t.v, d = t.img.data;
    for (let i = 0, o = 0; i < g.length; i++, o += 4) {
      const m = g[i], s = (v[i] / 255) * 26 - 13;
      let r = 24, gg = 22, b = 32;
      if (m === SAND.SAND) { r = 226 + s; gg = 190 + s; b = 112 + s * 0.6; }
      else if (m === SAND.WATER) { r = 40; gg = 120 + s * 0.5; b = 222 + s * 0.3; }
      else if (m === SAND.WOOD) { r = 122 + s; gg = 80 + s * 0.7; b = 42 + s * 0.4; }
      else if (m === SAND.FIRE) { const k = Math.min(1, v[i] / 50); r = 255; gg = 90 + k * 150; b = 20 + k * 60; }
      else if (m === SAND.SMOKE) { const k = Math.min(1, v[i] / 60); r = gg = 24 + k * 60; b = 32 + k * 60; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    t.oc.putImageData(t.img, 0, 0);
    const c = t.c;
    c.fillStyle = '#181620'; c.fillRect(0, 0, t.W, t.H);
    c.imageSmoothingEnabled = false;
    c.drawImage(t.off, 0, 0, t.gw * t.cs, t.gh * t.cs);
    c.imageSmoothingEnabled = true;
    c.fillStyle = '#0a090e';
    c.fillRect(t.gw * 0.47 * t.cs, t.gh * t.cs - 2, t.gw * 0.06 * t.cs, 2);
  },
});

// 40. Plinko: drop a ball through the pegs and see where it lands.
Exhibits.add({
  id: 'plinko', name: 'Plinko', section: 'physics', hint: 'Click along the top to drop a ball', canvas: true,
  setup(t) { t.balls = []; t.score = 0; t.landed = 0; t.autoT = 1.2; t.pops = []; this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    t.slotTop = t.H - 34;
    const rows = HA.clamp(Math.floor((t.slotTop - 60) / 22), 4, 12), gap = Math.min(t.W / 11, (t.slotTop - 60) / rows / 0.88);
    t.gap = gap;
    t.pegs = [];
    for (let r = 0; r < rows; r++) {
      const n = Math.floor(t.W / gap) - (r % 2);
      for (let k = 0; k < n; k++) t.pegs.push({ x: t.W / 2 + (k - (n - 1) / 2) * gap, y: 40 + r * gap * 0.88, flash: 0 });
    }
    t.values = [50, 20, 10, 5, 100, 5, 10, 20, 50];
    t.slotW = t.W / t.values.length;
    t.br = HA.clamp(gap * 0.2, 4, 8);
  },
  drop(t, x) {
    if (t.balls.length > 30) t.balls.shift();
    t.balls.push({ x: HA.clamp(x, 12, t.W - 12) + HA.rand(-2, 2), y: 12, vx: HA.rand(-10, 10), vy: 0, hue: Math.random() * 360, done: false, life: 1.4 });
  },
  down(t) { this.drop(t, t.p.x); t.blip(720, 0.04, 'sine', 0.05); },
  frame(t, dt) {
    t.autoT -= dt;
    if (t.autoT <= 0) { t.autoT = HA.rand(1.6, 3); this.drop(t, HA.rand(t.W * 0.2, t.W * 0.8)); }
    const r = t.br, pr = 3, sub = 3, h = dt / sub, grav = 700 * Math.max(1, t.H / 320); // a taller board falls faster
    let pinged = false;
    for (const b of t.balls) {
      if (b.done) { b.life -= dt; continue; }
      for (let s = 0; s < sub; s++) {
        b.vy += grav * h; b.x += b.vx * h; b.y += b.vy * h;
        for (const p of t.pegs) {
          const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < r + pr) {
            const nx = dx / d, ny = dy / d;
            b.x = p.x + nx * (r + pr); b.y = p.y + ny * (r + pr);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny; b.vx += HA.rand(-12, 12); }
            if (p.flash < 0.5 && !pinged) { pinged = true; t.blip(900 + p.y * 2, 0.025, 'triangle', 0.025); }
            p.flash = 1;
          }
        }
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > t.W - r) { b.x = t.W - r; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.y > t.slotTop) { // between the slot walls
          const k = HA.clamp(Math.floor(b.x / t.slotW), 0, t.values.length - 1), x0 = k * t.slotW + r + 1, x1 = (k + 1) * t.slotW - r - 1;
          if (b.x < x0) { b.x = x0; b.vx = Math.abs(b.vx) * 0.4; }
          if (b.x > x1) { b.x = x1; b.vx = -Math.abs(b.vx) * 0.4; }
          if (b.y > t.H - r - 3) {
            b.y = t.H - r - 3; b.done = true;
            const val = t.values[k];
            t.score += val; t.landed++;
            t.pops.push({ x: (k + 0.5) * t.slotW, y: t.slotTop - 6, text: `+${val}`, life: 1 });
            t.blip(val >= 100 ? 1046 : val >= 20 ? 784 : 523, val >= 100 ? 0.3 : 0.12, 'triangle', 0.08);
            break;
          }
        }
      }
    }
    t.balls = t.balls.filter(b => b.life > 0);
    const c = t.c;
    c.fillStyle = '#17142a'; c.fillRect(0, 0, t.W, t.H);
    for (const p of t.pegs) {
      p.flash = Math.max(0, p.flash - dt * 3);
      c.fillStyle = p.flash > 0 ? `rgba(255,${210 + p.flash * 45},120,1)` : '#8a84a8';
      c.beginPath(); c.arc(p.x, p.y, pr + p.flash * 1.5, 0, HA.TAU); c.fill();
    }
    c.font = `900 11px ${UI}`; c.textAlign = 'center';
    t.values.forEach((v, k) => {
      c.fillStyle = v >= 100 ? '#ff4fe0' : v >= 20 ? '#3d9bff' : '#2b2546';
      c.fillRect(k * t.slotW + 1, t.slotTop + 2, t.slotW - 2, t.H - t.slotTop - 2);
      c.fillStyle = '#f7f7f2'; c.fillText(v, (k + 0.5) * t.slotW, t.H - 8);
      c.fillStyle = '#8a84a8'; c.fillRect(k * t.slotW - 1, t.slotTop - 6, 2, t.H - t.slotTop + 6);
    });
    for (const b of t.balls) {
      c.globalAlpha = Math.min(1, b.life * 2);
      c.fillStyle = HA.hsl(b.hue, 90, 60);
      c.beginPath(); c.arc(b.x, b.y, r, 0, HA.TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(b.x - r * 0.3, b.y - r * 0.3, r * 0.35, 0, HA.TAU); c.fill();
    }
    c.globalAlpha = 1;
    for (const p of t.pops) { p.life -= dt; p.y -= 30 * dt; c.fillStyle = `rgba(255,214,64,${Math.max(0, p.life)})`; c.font = `900 15px ${UI}`; c.fillText(p.text, p.x, p.y); }
    t.pops = t.pops.filter(p => p.life > 0);
    c.textAlign = 'left'; c.fillStyle = '#f7f7f2'; c.font = `900 13px ${UI}`;
    c.fillText(`Score ${t.score}`, 10, 20);
  },
});

// 41. Planets: fling them round the sun. Click for a nice round orbit, drag to throw.
Exhibits.add({
  id: 'planets', name: 'Planets', section: 'physics', hint: 'Click for an orbit, or drag and fling', canvas: true,
  setup(t) {
    t.P = []; t.made = 0; t.aim = null; t.flashes = [];
    this.make(t);
    for (const f of [0.5, 0.8]) this.orbit(t, t.sun.x + t.R0 * f * 1.2, t.sun.y);
  },
  resize(t) { this.make(t); },
  make(t) {
    t.sun = { x: t.W / 2, y: t.H / 2, r: HA.clamp(Math.min(t.W, t.H) * 0.07, 10, 26) };
    t.R0 = Math.min(t.W, t.H) * 0.32;
    t.GM = ((HA.TAU * t.R0) / 6) ** 2 * t.R0; // an orbit at R0 takes about 6 seconds
    const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.round(t.W * t.dpr); cv.height = Math.round(t.H * t.dpr); const g = cv.getContext('2d'); g.setTransform(t.dpr, 0, 0, t.dpr, 0, 0); return [cv, g]; };
    [t.stars, t.sg] = mk();
    t.sg.fillStyle = '#05050c'; t.sg.fillRect(0, 0, t.W, t.H);
    for (let i = 0; i < (t.W * t.H) / 900; i++) { t.sg.fillStyle = `rgba(255,255,255,${HA.rand(0.2, 0.8)})`; t.sg.fillRect(HA.rand(0, t.W), HA.rand(0, t.H), 1.2, 1.2); }
    [t.trail, t.tg] = mk();
  },
  add(t, x, y, vx, vy) {
    if (t.P.length >= 16) t.P.shift();
    const r = HA.rand(3, 7);
    t.P.push({ id: ++t.made, x, y, vx, vy, r, hue: Math.random() * 360, age: 0 });
  },
  orbit(t, x, y) {
    const dx = x - t.sun.x, dy = y - t.sun.y, d = Math.max(t.sun.r + 12, Math.hypot(dx, dy)), v = Math.sqrt(t.GM / d) * HA.rand(0.95, 1.05);
    const nx = dx / (Math.hypot(dx, dy) || 1), ny = dy / (Math.hypot(dx, dy) || 1);
    this.add(t, t.sun.x + nx * d, t.sun.y + ny * d, -ny * v, nx * v);
  },
  down(t) { t.aim = { x: t.p.x, y: t.p.y }; },
  up(t) {
    const a = t.aim; t.aim = null;
    if (!a) return;
    const dx = a.x - t.p.x, dy = a.y - t.p.y;
    if (Math.hypot(dx, dy) < 10) this.orbit(t, a.x, a.y);
    else this.add(t, a.x, a.y, dx * 2.2, dy * 2.2);
    t.blip(440, 0.12, 'sine', 0.06, 1.6);
  },
  frame(t, dt) {
    const S = t.sun, sub = 4, h = dt / sub, tg = t.tg;
    tg.globalCompositeOperation = 'destination-out';
    tg.fillStyle = 'rgba(0,0,0,0.06)'; tg.fillRect(0, 0, t.W, t.H);
    tg.globalCompositeOperation = 'source-over';
    for (const p of t.P) {
      const x0 = p.x, y0 = p.y;
      for (let s = 0; s < sub; s++) {
        const dx = S.x - p.x, dy = S.y - p.y, d2 = Math.max(dx * dx + dy * dy, S.r * S.r), d = Math.sqrt(d2), a = t.GM / d2;
        p.vx += (a * dx / d) * h; p.vy += (a * dy / d) * h;
        p.x += p.vx * h; p.y += p.vy * h;
      }
      p.age += dt;
      tg.strokeStyle = HA.hsl(p.hue, 90, 65, 0.7); tg.lineWidth = Math.max(1, p.r * 0.5);
      tg.beginPath(); tg.moveTo(x0, y0); tg.lineTo(p.x, p.y); tg.stroke();
      if (Math.hypot(p.x - S.x, p.y - S.y) < S.r + p.r * 0.5) { p.gone = true; t.flashes.push({ x: S.x, y: S.y, r: S.r, life: 0.5 }); t.noise(0.3, 0.12, 500); }
      if (Math.abs(p.x - S.x) > t.W * 1.6 || Math.abs(p.y - S.y) > t.H * 1.6) p.gone = true;
    }
    // planets that touch become one
    for (let i = 0; i < t.P.length; i++) for (let j = i + 1; j < t.P.length; j++) {
      const a = t.P[i], b = t.P[j];
      if (a.gone || b.gone || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
      const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
      a.vx = (a.vx * ma + b.vx * mb) / m; a.vy = (a.vy * ma + b.vy * mb) / m;
      a.x = (a.x * ma + b.x * mb) / m; a.y = (a.y * ma + b.y * mb) / m;
      a.r = Math.min(14, Math.sqrt(m)); b.gone = true;
      t.flashes.push({ x: a.x, y: a.y, r: a.r, life: 0.4 });
      t.blip(180, 0.2, 'sine', 0.1, 0.5);
    }
    t.P = t.P.filter(p => !p.gone);
    const c = t.c;
    c.drawImage(t.stars, 0, 0, t.W, t.H);
    c.drawImage(t.trail, 0, 0, t.W, t.H);
    const gr = c.createRadialGradient(S.x, S.y, S.r * 0.2, S.x, S.y, S.r * 2.6);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.35, '#ffb020'); gr.addColorStop(0.4, 'rgba(255,140,30,0.5)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(S.x, S.y, S.r * 2.6, 0, HA.TAU); c.fill();
    for (const p of t.P) {
      c.fillStyle = HA.hsl(p.hue, 70, 55);
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, HA.TAU); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)'; // night side, away from the sun
      const a = Math.atan2(p.y - S.y, p.x - S.x);
      c.beginPath(); c.arc(p.x, p.y, p.r, a - Math.PI / 2, a + Math.PI / 2); c.fill();
    }
    for (const f of t.flashes) { f.life -= dt; c.strokeStyle = `rgba(255,230,180,${Math.max(0, f.life * 2)})`; c.lineWidth = 2; c.beginPath(); c.arc(f.x, f.y, f.r + (0.5 - f.life) * 60, 0, HA.TAU); c.stroke(); }
    t.flashes = t.flashes.filter(f => f.life > 0);
    if (t.aim) { // the slingshot
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.setLineDash([5, 5]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(t.aim.x, t.aim.y); c.lineTo(2 * t.aim.x - t.p.x, 2 * t.aim.y - t.p.y); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(t.aim.x, t.aim.y, 4, 0, HA.TAU); c.fill();
    }
  },
});

// 42. Dominoes: draw a line of them, then knock the first one over.
Exhibits.add({
  id: 'dominoes', name: 'Dominoes', section: 'physics', hint: 'Draw a line of dominoes, then tap the first', canvas: true,
  setup(t) {
    t.D = []; t.line = 0; t.lay = null; t.idleT = 0;
    HA.tools(t, [['Stand up', () => this.stand(t)], ['Clear', () => { t.D = []; }]]);
    this.make(t);
  },
  resize(t) { this.make(t); },
  make(t) {
    t.gap = HA.clamp(t.W / 26, 10, 18);
    t.D = [];
    t.line++;
    // a wiggly line to start with
    let last = null;
    for (let s = 0; s <= 1.0001; s += 0.002) {
      const x = t.W * (0.1 + s * 0.8), y = t.H * (0.6 + Math.sin(s * HA.TAU * 1.1) * 0.18);
      if (!last) { last = [x, y]; continue; }
      if (Math.hypot(x - last[0], y - last[1]) >= t.gap) { this.put(t, x, y, Math.atan2(y - last[1], x - last[0])); last = [x, y]; }
    }
  },
  put(t, x, y, a) {
    if (t.D.length > 180) t.D.splice(0, t.D.length - 180);
    t.D.push({ x, y, a, f: 0, falling: false, dir: a, line: t.line, hue: (t.D.length * 11) % 360 });
  },
  stand(t) { for (const d of t.D) { d.f = 0; d.falling = false; d.hit = false; } t.blip(300, 0.1, 'triangle', 0.05, 1.5); },
  tip(t, d, dir) { if (d.falling) return; d.falling = true; d.dir = dir === undefined ? d.a : dir; t.idleT = 0; },
  at(t, x, y) {
    let best = null, bd = t.gap * 0.9;
    for (const d of t.D) { const k = Math.hypot(d.x - x, d.y - y); if (!d.falling && k < bd) { bd = k; best = d; } }
    return best;
  },
  down(t, e) {
    if (e && e.target.closest && e.target.closest('button')) return;
    t.lay = { last: [t.p.x, t.p.y], n: 0, moved: 0, hit: this.at(t, t.p.x, t.p.y) };
    t.line++;
  },
  move(t) {
    const L = t.lay;
    if (!L || !t.p.down) return;
    L.moved += Math.hypot(t.p.vx, t.p.vy);
    if (L.moved < 10) return;
    const dx = t.p.x - L.last[0], dy = t.p.y - L.last[1], d = Math.hypot(dx, dy);
    if (d < t.gap) return;
    const a = Math.atan2(dy, dx), n = Math.floor(d / t.gap);
    for (let k = 1; k <= n; k++) this.put(t, L.last[0] + Math.cos(a) * t.gap * k, L.last[1] + Math.sin(a) * t.gap * k, a);
    L.last = [L.last[0] + Math.cos(a) * t.gap * n, L.last[1] + Math.sin(a) * t.gap * n];
    L.n += n;
    if (L.n % 3 === 0) t.blip(500, 0.02, 'square', 0.02);
  },
  up(t) {
    const L = t.lay; t.lay = null;
    if (L && L.n < 2 && L.hit) this.tip(t, L.hit);
  },
  frame(t, dt) {
    let falling = 0;
    for (const d of t.D) {
      if (!d.falling || d.f >= 1) continue;
      falling++;
      d.f = Math.min(1, d.f + dt * (2.5 + d.f * 7));
      if (d.f > 0.45 && !d.hit) { // knock over whatever it lands on
        d.hit = true;
        const ux = Math.cos(d.dir), uy = Math.sin(d.dir);
        for (const o of t.D) {
          if (o === d || o.falling) continue;
          const rx = o.x - d.x, ry = o.y - d.y, along = rx * ux + ry * uy;
          if (along > 0 && along < t.gap * 1.7 && Math.abs(rx * uy - ry * ux) < t.gap * 0.8) {
            const same = Math.cos(o.a) * ux + Math.sin(o.a) * uy;
            this.tip(t, o, same >= 0 ? o.a : o.a + Math.PI);
          }
        }
        t.blip(HA.rand(1100, 1500), 0.015, 'square', 0.025);
      }
    }
    t.idleT = falling ? 0 : t.idleT + dt;
    if (t.idleT > 3.5 && t.D.length && t.D.every(d => d.f >= 1)) this.stand(t);
    else if (t.idleT > 5 && t.D.length && !t.p.inside) { this.tip(t, t.D.find(d => !d.falling) || t.D[0]); }
    const c = t.c, g = t.gap, w = g * 0.9, h = g * 1.7;
    c.fillStyle = '#2a2219'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < t.H; y += 24) c.fillRect(0, y, t.W, 12);
    const list = t.D.slice().sort((a, b) => a.y - b.y), th = g * 0.34;
    for (const d of list) {
      const ang = d.f * 1.4, ux = Math.cos(d.dir), uy = Math.sin(d.dir), vx = Math.cos(d.a) * th / 2, vy = Math.sin(d.a) * th / 2;
      const px = -Math.sin(d.a) * w / 2, py = Math.cos(d.a) * w / 2;
      const lx = ux * h * Math.sin(ang), ly = uy * h * Math.sin(ang) - h * Math.cos(ang); // from the foot to the top
      // the back and front faces, each a quad from the foot up to the top edge
      const quad = (ox, oy) => [[d.x + ox - px, d.y + oy - py], [d.x + ox + px, d.y + oy + py], [d.x + ox + px + lx, d.y + oy + py + ly], [d.x + ox - px + lx, d.y + oy - py + ly]];
      const back = quad(-vx, -vy), front = quad(vx, vy), poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.closePath(); c.fill(); };
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(d.x + lx * 0.5, d.y + uy * h * 0.5 * Math.sin(ang) + 3, w * 0.6, w * 0.3 + h * 0.2 * Math.sin(ang), d.a, 0, HA.TAU); c.fill();
      const col = HA.hsl(d.hue, 70, 56 - d.f * 10);
      poly(this.hull([...back, ...front]), HA.hsl(d.hue, 60, 32));
      poly([back[3], back[2], front[2], front[3]], HA.hsl(d.hue, 70, 72)); // the top edge
      poly(front, col);
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(front[0][0], front[0][1]); for (const q of front) c.lineTo(q[0], q[1]); c.closePath(); c.stroke();
      if (d.f < 0.3) { c.fillStyle = 'rgba(255,255,255,0.9)'; for (const k of [0.3, 0.72]) { c.beginPath(); c.arc(d.x + vx + lx * k, d.y + vy + ly * k, Math.max(1, g * 0.09), 0, HA.TAU); c.fill(); } }
    }
  },
  // the outline round a few points (gift wrapping; a domino is only eight points)
  hull(pts) {
    const out = [];
    let start = pts.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a));
    let p = start;
    for (let k = 0; k < 16; k++) {
      out.push(p);
      let q = pts[0] === p ? pts[1] : pts[0];
      for (const r of pts) { const cross = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); if (cross < 0 || (cross === 0 && Math.hypot(r[0] - p[0], r[1] - p[1]) > Math.hypot(q[0] - p[0], q[1] - p[1]))) q = r; }
      p = q;
      if (p === start) break;
    }
    return out;
  },
});

// 43. A jelly blob: poke it, grab it, throw it.
Exhibits.add({
  id: 'blob', name: 'Jelly Blob', section: 'physics', hint: 'Poke it, grab it, throw it', canvas: true,
  setup(t) { this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    const n = t.n = t.low ? 18 : 26;
    t.R = HA.clamp(Math.min(t.W, t.H) * 0.22, 26, 90);
    t.pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * HA.TAU, x = t.W / 2 + Math.cos(a) * t.R, y = t.H * 0.45 + Math.sin(a) * t.R; t.pts.push({ x, y, ox: x, oy: y }); }
    t.seg = 2 * t.R * Math.sin(Math.PI / n);
    t.A0 = this.area(t);
    t.grab = null;
  },
  area(t) { let a = 0; const P = t.pts; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return a / 2; },
  centre(t) { let x = 0, y = 0; for (const p of t.pts) { x += p.x; y += p.y; } return { x: x / t.n, y: y / t.n }; },
  down(t) {
    const c = this.centre(t);
    if (Math.hypot(c.x - t.p.x, c.y - t.p.y) > t.R * 1.25) return;
    // hold the points on this side of the blob, keeping their offsets from the pointer
    t.grab = t.pts.map((p, i) => [i, p.x - t.p.x, p.y - t.p.y]).filter(([i, dx, dy]) => Math.hypot(dx, dy) < t.R * 1.1);
    t.blip(240, 0.08, 'sine', 0.08, 0.7);
  },
  up(t) { t.grab = null; },
  frame(t, dt) {
    const P = t.pts, n = t.n, sub = 3, h = Math.min(dt, 0.033) / sub;
    for (let s = 0; s < sub; s++) {
      for (const p of P) {
        const vx = (p.x - p.ox) * 0.995, vy = (p.y - p.oy) * 0.995;
        p.ox = p.x; p.oy = p.y;
        p.x += vx; p.y += vy + 900 * h * h;
      }
      for (let k = 0; k < 6; k++) {
        // the skin keeps its length
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = ((d - t.seg) / d) * 0.25;
          a.x += dx * diff; a.y += dy * diff; b.x -= dx * diff; b.y -= dy * diff;
        }
        // and the jelly inside pushes out to keep its size
        const A = this.area(t), push = ((t.A0 - A) / t.A0) * 0.8;
        for (let i = 0; i < n; i++) {
          const a = P[(i + n - 1) % n], b = P[(i + 1) % n], p = P[i], nx = b.y - a.y, ny = -(b.x - a.x), d = Math.hypot(nx, ny) || 1;
          p.x += (nx / d) * push * t.seg; p.y += (ny / d) * push * t.seg;
        }
        if (t.grab && t.p.down) for (const [i, dx, dy] of t.grab) { const p = P[i]; p.x = HA.lerp(p.x, t.p.x + dx, 0.3); p.y = HA.lerp(p.y, t.p.y + dy, 0.3); }
        for (const p of P) { // the walls
          if (p.y > t.H - 2) { const v = p.y - p.oy; p.y = t.H - 2; p.oy = p.y + v * 0.4; p.ox = HA.lerp(p.ox, p.x, 0.15); if (v > 6) t.thud = Math.max(t.thud || 0, v); }
          if (p.y < 2) { p.y = 2; p.oy = p.y; }
          if (p.x < 2) { const v = p.x - p.ox; p.x = 2; p.ox = p.x + v * 0.4; }
          if (p.x > t.W - 2) { const v = p.x - p.ox; p.x = t.W - 2; p.ox = p.x + v * 0.4; }
        }
      }
    }
    if (t.thud) { t.blip(90 + t.thud * 4, 0.12, 'sine', Math.min(0.15, t.thud / 80), 0.6); t.thud = 0; }
    const c = t.c, ce = this.centre(t);
    c.fillStyle = '#1a2a22'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(ce.x, t.H - 3, t.R * 0.9, 5, 0, 0, HA.TAU); c.fill();
    const gr = c.createRadialGradient(ce.x - t.R * 0.3, ce.y - t.R * 0.4, t.R * 0.1, ce.x, ce.y, t.R * 1.3);
    gr.addColorStop(0, 'rgba(190,255,170,0.95)'); gr.addColorStop(0.5, 'rgba(90,210,90,0.9)'); gr.addColorStop(1, 'rgba(30,140,60,0.95)');
    c.fillStyle = gr;
    c.beginPath();
    const mid = i => { const a = P[i % n], b = P[(i + 1) % n]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; };
    let m = mid(n - 1); c.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { m = mid(i); c.quadraticCurveTo(P[i].x, P[i].y, m[0], m[1]); }
    c.fill();
    c.strokeStyle = 'rgba(20,90,40,0.8)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(ce.x - t.R * 0.35, ce.y - t.R * 0.45, t.R * 0.22, t.R * 0.12, -0.5, 0, HA.TAU); c.fill();
    // a face that watches you
    const lx = t.p.inside ? HA.clamp((t.p.x - ce.x) / t.W, -0.5, 0.5) * 6 : 0, ly = t.p.inside ? HA.clamp((t.p.y - ce.y) / t.H, -0.5, 0.5) * 6 : 0, er = Math.max(3, t.R * 0.12);
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ce.x + s * t.R * 0.28, ce.y - t.R * 0.05, er, 0, HA.TAU); c.fill();
      c.fillStyle = '#16181c'; c.beginPath(); c.arc(ce.x + s * t.R * 0.28 + lx * 0.4, ce.y - t.R * 0.05 + ly * 0.4, er * 0.5, 0, HA.TAU); c.fill();
    }
    c.strokeStyle = '#16381e'; c.lineWidth = 2;
    c.beginPath(); c.arc(ce.x, ce.y + t.R * 0.12, t.R * 0.16, 0.2, Math.PI - 0.2); c.stroke();
  },
});

// 44. A pane of glass: tap to crack it. Keep tapping.
Exhibits.add({
  id: 'glass', name: 'Glass', section: 'physics', hint: 'Tap the glass. Then tap it again', canvas: true,
  setup(t) { t.breaks = 0; t.shards = []; this.make(t); this.fresh(t, 1); },
  resize(t) { this.make(t); this.fresh(t, 1); },
  make(t) {
    t.pane = { x: 18, y: 16, w: t.W - 36, h: t.H - 32 };
    const cv = t.view = document.createElement('canvas');
    cv.width = Math.round(t.W * t.dpr); cv.height = Math.round(t.H * t.dpr);
    const g = cv.getContext('2d');
    g.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, t.H);
    sky.addColorStop(0, '#7fc8ff'); sky.addColorStop(1, '#ffd9a8');
    g.fillStyle = sky; g.fillRect(0, 0, t.W, t.H);
    g.fillStyle = '#6d8f5e';
    g.beginPath(); g.moveTo(0, t.H * 0.75);
    for (let x = 0; x <= t.W; x += 20) g.lineTo(x, t.H * (0.7 + Math.sin(x * 0.02) * 0.05));
    g.lineTo(t.W, t.H); g.lineTo(0, t.H); g.fill();
  },
  fresh(t, at) { t.cracks = []; t.hits = 0; t.broken = false; t.paneIn = at; },
  inPane(t, x, y) { const P = t.pane; return x > P.x && x < P.x + P.w && y > P.y && y < P.y + P.h; },
  down(t) {
    if (t.broken || t.paneIn < 1 || !this.inPane(t, t.p.x, t.p.y)) return;
    t.hits++;
    if (t.hits >= 4) { this.shatter(t, t.p.x, t.p.y); return; }
    this.crack(t, t.p.x, t.p.y);
    t.blip(HA.rand(2200, 3200), 0.07, 'sine', 0.06);
    t.noise(0.12, 0.12, 4000, 'highpass');
  },
  crack(t, x, y) {
    const n = 6 + Math.floor(Math.random() * 4), reach = Math.max(t.W, t.H) * HA.rand(0.25, 0.55), ends = [];
    for (let k = 0; k < n; k++) {
      let a = (k / n) * HA.TAU + HA.rand(-0.3, 0.3), px = x, py = y, len = 0;
      const line = [[px, py]];
      while (len < reach * HA.rand(0.5, 1) && this.inPane(t, px, py)) { const s = HA.rand(6, 14); a += HA.rand(-0.35, 0.35); px += Math.cos(a) * s; py += Math.sin(a) * s; len += s; line.push([px, py]); }
      t.cracks.push(line);
      ends.push(line[Math.min(2, line.length - 1)]);
    }
    t.cracks.push([...ends, ends[0]]); // the little web round the hit
  },
  shatter(t, x, y) {
    const P = t.pane, cols = t.low ? 5 : 8, rows = t.low ? 4 : 6, pts = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      pts.push([P.x + (i / cols) * P.w + (edge ? 0 : HA.rand(-0.35, 0.35) * P.w / cols), P.y + (j / rows) * P.h + (edge ? 0 : HA.rand(-0.35, 0.35) * P.h / rows)]);
    }
    const at = (i, j) => pts[j * (cols + 1) + i];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      for (const tri of [[at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)]]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, d = Math.hypot(cx - x, cy - y) + 20;
        t.shards.push({ pts: tri.map(([px, py]) => [px - cx, py - cy]), x: cx, y: cy, vx: ((cx - x) / d) * HA.rand(80, 260), vy: ((cy - y) / d) * HA.rand(60, 200) - HA.rand(20, 120), a: 0, va: HA.rand(-6, 6) });
      }
    }
    t.broken = true; t.breaks++; t.cracks = [];
    t.noise(0.8, 0.3, 3500, 'highpass');
    for (let k = 0; k < 6; k++) t.later(() => t.blip(HA.rand(2500, 4200), 0.06, 'sine', 0.04), 60 + k * HA.rand(50, 110));
  },
  frame(t, dt) {
    for (const s of t.shards) { s.vy += 1100 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; }
    t.shards = t.shards.filter(s => s.y < t.H + 80);
    if (t.broken && !t.shards.length) this.fresh(t, 0);
    if (t.paneIn < 1) t.paneIn = Math.min(1, t.paneIn + dt * 1.6);
    const c = t.c, P = t.pane, off = -((1 - t.paneIn) ** 2) * t.H;
    c.drawImage(t.view, 0, 0, t.W, t.H);
    if (!t.broken) {
      c.save(); c.translate(0, off);
      c.fillStyle = 'rgba(190,225,255,0.2)'; c.fillRect(P.x, P.y, P.w, P.h);
      c.fillStyle = 'rgba(255,255,255,0.18)'; // reflections
      c.beginPath(); c.moveTo(P.x + P.w * 0.15, P.y); c.lineTo(P.x + P.w * 0.32, P.y); c.lineTo(P.x + P.w * 0.08, P.y + P.h); c.lineTo(P.x - P.w * 0.09 + 1, P.y + P.h); c.closePath(); c.fill();
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [col, w, dy] of [['rgba(40,60,80,0.35)', 2.2, 1], ['rgba(255,255,255,0.9)', 1.1, 0]]) {
        c.strokeStyle = col; c.lineWidth = w;
        c.beginPath();
        for (const line of t.cracks) { c.moveTo(line[0][0], line[0][1] + dy); for (const [x, y] of line) c.lineTo(x, y + dy); }
        c.stroke();
      }
      c.restore();
    }
    for (const s of t.shards) {
      c.save(); c.translate(s.x, s.y); c.rotate(s.a);
      c.fillStyle = 'rgba(200,230,255,0.35)'; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(s.pts[0][0], s.pts[0][1]); c.lineTo(s.pts[1][0], s.pts[1][1]); c.lineTo(s.pts[2][0], s.pts[2][1]); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    // the window frame
    c.strokeStyle = '#f2ece0'; c.lineWidth = 10;
    c.strokeRect(P.x - 5, P.y - 5, P.w + 10, P.h + 10);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
    c.strokeRect(P.x, P.y, P.w, P.h);
    if (t.hits && !t.broken) { c.fillStyle = 'rgba(22,24,28,0.7)'; c.font = `800 12px ${UI}`; c.textAlign = 'right'; c.fillText(`${4 - t.hits} more`, P.x + P.w - 6, P.y + P.h - 6); }
  },
});
