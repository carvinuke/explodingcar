'use strict';
// Hall of Art: more to play with. Bubble wrap and a switchboard puzzle (Living Buttons),
// fireworks, a pond and a kaleidoscope (Moving Pictures), fridge magnets and falling
// letters (Lettering).

// 32. Bubble wrap: pop every bubble and a fresh sheet rolls in.
Exhibits.add({
  id: 'bubble', name: 'Bubble Wrap', section: 'buttons', hint: 'Pop them. Drag across to pop lots', canvas: true,
  setup(t) { t.popped = 0; this.sheet(t, false); },
  resize(t) { this.sheet(t, false); },
  sheet(t, slide) {
    const r = HA.clamp(Math.min(t.W, t.H) / 9, 11, 24), dx = r * 2.3, dy = r * 2;
    // odd rows sit half a bubble to the right: the sheet is (cols - 0.5) spacings wide, plus a bubble
    const cols = Math.max(3, Math.floor((t.W - 2 * r) / dx + 0.5)), rows = Math.max(2, Math.floor((t.H - 16) / dy));
    const x0 = (t.W - (cols - 0.5) * dx) / 2, y0 = (t.H - (rows - 1) * dy) / 2;
    t.r = r;
    t.b = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) t.b.push({ x: x0 + i * dx + (j % 2) * dx / 2, y: y0 + j * dy, pop: false, t: 0 });
    t.left = t.b.length;
    t.slide = slide ? 0 : 1;
    t.refillT = 0;
    t.full = this.sprite(r, false, t.dpr);
    t.flat = this.sprite(r, true, t.dpr);
  },
  // each bubble is drawn once into a little picture
  sprite(r, popped, dpr) {
    const s = Math.ceil((r * 2 + 4) * dpr), cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d'), m = s / 2, R = r * dpr;
    if (popped) {
      g.fillStyle = 'rgba(210,235,250,0.22)';
      g.beginPath();
      for (let k = 0; k <= 12; k++) { const a = (k / 12) * HA.TAU, rr = R * (0.78 + (k % 2) * 0.12); g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); }
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = dpr;
      g.stroke();
    } else {
      const gr = g.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.1, m, m, R);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.3, 'rgba(214,240,255,0.55)');
      gr.addColorStop(1, 'rgba(150,200,235,0.35)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(m, m, R, 0, HA.TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1.2 * dpr;
      g.stroke();
    }
    return cv;
  },
  // a new sheet slides in from the right
  offset(t) { return (1 - t.slide) ** 3 * t.W; },
  pop(t, x, y) {
    const off = this.offset(t);
    for (const b of t.b) {
      if (b.pop || (b.x + off - x) ** 2 + (b.y - y) ** 2 > t.r * t.r) continue;
      b.pop = true; b.t = 0;
      t.popped++; t.left--;
      t.noise(0.05, 0.35, 2600, 'bandpass');
      t.blip(HA.rand(700, 1300), 0.03, 'square', 0.03, 0.5);
    }
  },
  down(t) { this.pop(t, t.p.x, t.p.y); },
  move(t) { if (t.p.down) this.pop(t, t.p.x, t.p.y); },
  frame(t, dt) {
    if (t.left <= 0) { t.refillT += dt; if (t.refillT > 0.7) this.sheet(t, true); }
    if (t.slide < 1) t.slide = Math.min(1, t.slide + dt * 2.2);
    const c = t.c, r = t.r, off = this.offset(t);
    c.fillStyle = '#1b2733'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = 'rgba(220,240,255,0.1)';
    c.fillRect(off + 6, 6, t.W - 12, t.H - 12);
    for (const b of t.b) {
      b.t += dt;
      const s = b.pop ? 1 + 0.25 * Math.max(0, 1 - b.t * 6) : 1;
      const img = b.pop ? t.flat : t.full, R = (r + 2) * s;
      c.drawImage(img, off + b.x - R, b.y - R, R * 2, R * 2);
      if (b.pop && b.t < 0.18) { c.strokeStyle = `rgba(255,255,255,${0.6 - b.t * 3})`; c.lineWidth = 2; c.beginPath(); c.arc(off + b.x, b.y, r * (1 + b.t * 4), 0, HA.TAU); c.stroke(); }
    }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = `800 12px ${UI}`;
    c.textAlign = 'right';
    c.fillText(`${t.popped} popped`, t.W - 10, t.H - 8);
  },
});

// 33. A switchboard: every switch flips its light and the ones next to it. Turn them all off.
Exhibits.add({
  id: 'switchboard', name: 'Switchboard', section: 'buttons', hint: 'Turn every light off', canvas: true,
  setup(t) { t.solves = 0; this.deal(t); },
  resize(t) { this.deal(t); },
  deal(t) {
    t.n = Math.min(t.W, t.H) < 260 ? 4 : 5;
    t.g = new Array(t.n * t.n).fill(0);
    // scramble a solved board, so every puzzle can be solved
    while (t.g.every(v => !v)) for (let k = 0; k < t.n * 2 + 1; k++) this.flip(t, Math.floor(Math.random() * t.n), Math.floor(Math.random() * t.n));
    t.moves = 0;
    t.win = 0;
    t.lamps = null;
  },
  flip(t, i, j) {
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + a, y = j + b;
      if (x >= 0 && x < t.n && y >= 0 && y < t.n) t.g[y * t.n + x] ^= 1;
    }
  },
  geo(t) {
    const top = 28, s = Math.min((t.W - 24) / t.n, (t.H - top - 10) / t.n);
    return { s, x0: (t.W - s * t.n) / 2, y0: top + (t.H - top - 10 - s * t.n) / 2 };
  },
  // the lamp, lit and unlit, drawn once at this size
  lamp(s, on, dpr) {
    const cv = document.createElement('canvas'), n = Math.ceil(s * dpr);
    cv.width = cv.height = n;
    const g = cv.getContext('2d'), m = n / 2, R = n * 0.36;
    g.fillStyle = '#2a2d34'; g.beginPath(); g.roundRect(n * 0.06, n * 0.06, n * 0.88, n * 0.88, n * 0.14); g.fill();
    g.fillStyle = '#16181c'; g.beginPath(); g.arc(m, m, R + n * 0.05, 0, HA.TAU); g.fill();
    const gr = g.createRadialGradient(m - R * 0.3, m - R * 0.35, R * 0.1, m, m, R);
    if (on) { gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.35, '#ffd23f'); gr.addColorStop(1, '#e08a00'); }
    else { gr.addColorStop(0, '#5a5040'); gr.addColorStop(1, '#2b2620'); }
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, R, 0, HA.TAU); g.fill();
    return cv;
  },
  down(t) {
    if (t.win > 0) return;
    const { s, x0, y0 } = this.geo(t), i = Math.floor((t.p.x - x0) / s), j = Math.floor((t.p.y - y0) / s);
    if (i < 0 || j < 0 || i >= t.n || j >= t.n) return;
    this.flip(t, i, j);
    t.moves++;
    t.blip(t.g[j * t.n + i] ? 520 : 330, 0.05, 'square', 0.05);
    if (t.g.every(v => !v)) {
      t.win = 1.6; t.solves++;
      [523, 659, 784, 1047].forEach((f, k) => t.later(() => t.blip(f, 0.14, 'triangle', 0.08), k * 110));
    }
  },
  frame(t, dt, time) {
    if (t.win > 0) { t.win -= dt; if (t.win <= 0) this.deal(t); }
    const { s, x0, y0 } = this.geo(t), c = t.c;
    if (!t.lamps || t.lamps.s !== s) t.lamps = { s, on: this.lamp(s, true, t.dpr), off: this.lamp(s, false, t.dpr) };
    c.fillStyle = '#121419'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = '#1f232a'; c.fillRect(x0 - 8, y0 - 8, s * t.n + 16, s * t.n + 16);
    for (let j = 0; j < t.n; j++) for (let i = 0; i < t.n; i++) {
      // solved: a light show runs round the board
      const on = t.win > 0 ? Math.sin(time * 14 - (i + j) * 0.9) > 0.3 : t.g[j * t.n + i];
      const x = x0 + i * s, y = y0 + j * s;
      c.drawImage(on ? t.lamps.on : t.lamps.off, x, y, s, s);
      if (on && !t.low) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,190,60,0.18)'; c.beginPath(); c.arc(x + s / 2, y + s / 2, s * 0.55, 0, HA.TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    }
    c.fillStyle = '#f7f7f2';
    c.font = `800 13px ${UI}`;
    c.textAlign = 'left'; c.fillText(t.win > 0 ? 'Lights out!' : `Moves ${t.moves}`, 12, 19);
    c.textAlign = 'right'; c.fillStyle = '#9a93ab'; c.fillText(`Solved ${t.solves}`, t.W - 12, 19);
  },
});

// 34. Fireworks over the city: click to send one up, hold for the finale.
Exhibits.add({
  id: 'fireworks', name: 'Fireworks', section: 'motion', hint: 'Click to launch, hold for a finale', canvas: true,
  setup(t) { t.rockets = []; t.sparks = []; t.autoT = 0.6; t.holdT = 0; t.finT = 0; this.resize(t); },
  resize(t) {
    // the skyline, drawn once
    const cv = t.sky = document.createElement('canvas');
    cv.width = Math.round(t.W * t.dpr); cv.height = Math.round(t.H * t.dpr);
    const g = cv.getContext('2d');
    g.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    let x = 0, k = 0;
    while (x < t.W) {
      const w = 18 + ((k * 37) % 30), h = 18 + ((k * 53) % 46);
      g.fillStyle = '#0b0c16'; g.fillRect(x, t.H - h, w, h);
      g.fillStyle = 'rgba(255,214,120,0.35)';
      for (let wy = t.H - h + 6; wy < t.H - 6; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) if ((wx * 7 + wy * 3 + k) % 5 === 0) g.fillRect(wx, wy, 2, 3);
      x += w + 2; k++;
    }
    t.c.fillStyle = '#05060d'; t.c.fillRect(0, 0, t.W, t.H);
  },
  launch(t, x, y) {
    t.rockets.push({ x: HA.clamp(x + HA.rand(-30, 30), 10, t.W - 10), y: t.H + 4, tx: x, ty: y, hue: Math.random() * 360, kind: ['ball', 'ring', 'willow', 'crackle'][Math.floor(Math.random() * 4)] });
    t.noise(0.3, 0.04, 1600, 'highpass');
  },
  burst(t, r) {
    const n = t.low ? 40 : 90, cap = t.low ? 500 : 1400;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * HA.TAU + Math.random() * 0.2, v = r.kind === 'ring' ? 150 : HA.rand(40, 170);
      t.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: HA.rand(0.9, 1.6) * (r.kind === 'willow' ? 1.6 : 1), hue: r.hue + HA.rand(-20, 20), kind: r.kind });
    }
    if (t.sparks.length > cap) t.sparks.splice(0, t.sparks.length - cap);
    t.noise(0.5, 0.2, 700);
    t.blip(HA.rand(70, 110), 0.25, 'sine', 0.1, 0.5);
  },
  down(t) { this.launch(t, t.p.x, Math.min(t.p.y, t.H * 0.85)); t.holdT = 0; },
  frame(t, dt) {
    if (t.p.down) {
      t.holdT += dt;
      if (t.holdT > 0.45) { t.finT -= dt; if (t.finT <= 0) { t.finT = t.low ? 0.25 : 0.12; this.launch(t, t.p.x + HA.rand(-t.W * 0.3, t.W * 0.3), HA.rand(t.H * 0.12, t.H * 0.5)); } }
    } else {
      t.autoT -= dt;
      if (t.autoT <= 0) { t.autoT = HA.rand(1.2, 2.6); this.launch(t, HA.rand(t.W * 0.15, t.W * 0.85), HA.rand(t.H * 0.15, t.H * 0.45)); }
    }
    const c = t.c;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(5,6,13,0.24)'; c.fillRect(0, 0, t.W, t.H);
    c.globalCompositeOperation = 'lighter';
    for (const r of t.rockets) {
      const py = r.y;
      r.y -= 520 * dt;
      r.x = HA.lerp(r.x, r.tx, dt * 2);
      c.strokeStyle = 'rgba(255,220,160,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(r.x, py + 10); c.lineTo(r.x, r.y); c.stroke();
      if (r.y <= r.ty) { r.done = true; this.burst(t, r); }
    }
    t.rockets = t.rockets.filter(r => !r.done);
    for (const s of t.sparks) {
      const drag = s.kind === 'willow' ? 0.97 : 0.985;
      s.vx *= drag; s.vy = s.vy * drag + (s.kind === 'willow' ? 35 : 70) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.kind === 'crackle' && s.life < 0.6 && Math.random() < 0.5) continue; // flicker
      const a = Math.max(0, Math.min(1, s.life));
      c.fillStyle = `hsla(${s.hue},100%,${60 + a * 25}%,${a})`;
      c.fillRect(s.x - 1.2, s.y - 1.2, 2.4, 2.4);
    }
    t.sparks = t.sparks.filter(s => s.life > 0);
    c.globalCompositeOperation = 'source-over';
    c.drawImage(t.sky, 0, 0, t.W, t.H);
  },
});

// 35. A pond: touch the water and the ripples spread (the koi don't like it).
Exhibits.add({
  id: 'pond', name: 'Pond', section: 'motion', hint: 'Touch the water', canvas: true,
  setup(t) { this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    const cell = t.low ? 6 : 4;
    t.gw = HA.clamp(Math.round(t.W / cell), 40, t.low ? 70 : 120);
    t.gh = HA.clamp(Math.round(t.H / cell), 30, t.low ? 46 : 84);
    t.h1 = new Float32Array(t.gw * t.gh);
    t.h2 = new Float32Array(t.gw * t.gh);
    t.off = document.createElement('canvas');
    t.off.width = t.gw; t.off.height = t.gh;
    t.oc = t.off.getContext('2d');
    t.img = t.oc.createImageData(t.gw, t.gh);
    t.koi = Array.from({ length: t.big ? 7 : 4 }, (_, i) => ({ x: HA.rand(30, t.W - 30), y: HA.rand(30, t.H - 30), a: Math.random() * HA.TAU, v: 30, fear: 0, ph: Math.random() * 9, spots: i % 2 }));
    t.pads = Array.from({ length: 3 }, (_, i) => ({ x: t.W * (0.18 + i * 0.32) + HA.rand(-20, 20), y: HA.rand(t.H * 0.2, t.H * 0.8), r: HA.rand(13, 20), a: Math.random() * HA.TAU }));
    t.acc = 0; t.rainT = 1; t.lastX = -1e4; t.lastY = -1e4;
    t.fish = HA.clamp(Math.min(t.W, t.H) / 240, 1, 2.2); // bigger koi in a bigger pond
  },
  drop(t, x, y, s) {
    const gx = Math.round((x / t.W) * (t.gw - 1)), gy = Math.round((y / t.H) * (t.gh - 1));
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = gx + i, Y = gy + j;
      if (X > 0 && Y > 0 && X < t.gw - 1 && Y < t.gh - 1) t.h1[Y * t.gw + X] -= s * (i || j ? 0.5 : 1);
    }
    for (const k of t.koi) { const d = Math.hypot(k.x - x, k.y - y); if (d < 110) { k.fear = 1; k.a = Math.atan2(k.y - y, k.x - x); } }
  },
  down(t) { this.drop(t, t.p.x, t.p.y, 260); t.lastX = t.p.x; t.lastY = t.p.y; t.blip(HA.rand(300, 500), 0.14, 'sine', 0.06, 0.6); },
  move(t) {
    if (!t.p.down || Math.hypot(t.p.x - t.lastX, t.p.y - t.lastY) < 8) return;
    this.drop(t, t.p.x, t.p.y, 110); t.lastX = t.p.x; t.lastY = t.p.y;
  },
  step(t) {
    const w = t.gw, h = t.gh, a = t.h1, b = t.h2;
    for (let y = 1; y < h - 1; y++) for (let x = 1, i = y * w + 1; x < w - 1; x++, i++) b[i] = ((a[i - 1] + a[i + 1] + a[i - w] + a[i + w]) / 2 - b[i]) * 0.984;
    t.h1 = b; t.h2 = a;
  },
  frame(t, dt, time) {
    t.acc += dt;
    for (let n = 0; t.acc > 1 / 60 && n < 3; n++) { this.step(t); t.acc -= 1 / 60; }
    if (t.acc > 0.1) t.acc = 0;
    t.rainT -= dt;
    if (t.rainT <= 0) { t.rainT = HA.rand(0.5, 1.6); if (!t.p.down) this.drop(t, HA.rand(0, t.W), HA.rand(0, t.H), 70); }
    // the water: shaded by the slope of the surface
    const w = t.gw, h = t.gh, H1 = t.h1, d = t.img.data;
    for (let y = 0; y < h; y++) {
      const deep = y / h;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const sx = x > 0 && x < w - 1 ? H1[i + 1] - H1[i - 1] : 0, sy = y > 0 && y < h - 1 ? H1[i + w] - H1[i - w] : 0;
        const sh = HA.clamp(sx * 0.7 + sy * 0.5, -70, 90), o = i * 4;
        d[o] = HA.clamp(22 + sh * 0.9 - deep * 10, 0, 255);
        d[o + 1] = HA.clamp(96 + sh - deep * 34, 0, 255);
        d[o + 2] = HA.clamp(122 + sh * 0.9 - deep * 30, 0, 255);
        d[o + 3] = 255;
      }
    }
    t.oc.putImageData(t.img, 0, 0);
    const c = t.c;
    c.imageSmoothingEnabled = true;
    c.drawImage(t.off, 0, 0, t.W, t.H);
    // the koi
    for (const k of t.koi) {
      k.fear = Math.max(0, k.fear - dt * 0.8);
      k.a += Math.sin(time * 0.7 + k.ph) * dt * 0.9;
      const m = 26; // turn back from the edges
      if (k.x < m || k.x > t.W - m || k.y < m || k.y > t.H - m) { const want = Math.atan2(t.H / 2 - k.y, t.W / 2 - k.x); let da = want - k.a; while (da > Math.PI) da -= HA.TAU; while (da < -Math.PI) da += HA.TAU; k.a += da * dt * 3; }
      k.v = HA.lerp(k.v, 28 + k.fear * 150, dt * 4);
      k.x += Math.cos(k.a) * k.v * dt; k.y += Math.sin(k.a) * k.v * dt;
      const gx = HA.clamp(Math.round((k.x / t.W) * (w - 1)), 1, w - 2), gy = HA.clamp(Math.round((k.y / t.H) * (h - 1)), 1, h - 2), gi = gy * w + gx;
      const rx = (H1[gi + 1] - H1[gi - 1]) * 0.06, ry = (H1[gi + w] - H1[gi - w]) * 0.06; // bent by the ripples
      c.save(); c.translate(k.x + rx, k.y + ry); c.rotate(k.a); c.scale(t.fish, t.fish);
      const sw = Math.sin(time * (6 + k.fear * 14) + k.ph) * 0.45;
      c.globalAlpha = 0.9;
      c.fillStyle = '#ff7a1a';
      c.beginPath(); c.moveTo(-11, 0); c.lineTo(-19, -6 + sw * 6); c.lineTo(-19, 6 + sw * 6); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(0, 0, 12, 5, 0, 0, HA.TAU); c.fill();
      c.fillStyle = '#fff4e6';
      if (k.spots) { c.beginPath(); c.ellipse(2, -1, 4, 2.5, 0.4, 0, HA.TAU); c.fill(); }
      else { c.beginPath(); c.ellipse(-4, 1, 3, 2, 0, 0, HA.TAU); c.fill(); }
      c.restore();
    }
    c.globalAlpha = 1;
    // lily pads float on top
    for (const p of t.pads) {
      const gx = HA.clamp(Math.round((p.x / t.W) * (w - 1)), 1, w - 2), gy = HA.clamp(Math.round((p.y / t.H) * (h - 1)), 1, h - 2), bob = H1[gy * w + gx] * 0.02;
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(p.x + 3, p.y + 3, p.r, 0, HA.TAU); c.fill();
      c.fillStyle = '#4caf50';
      c.beginPath(); c.moveTo(p.x, p.y + bob); c.arc(p.x, p.y + bob, p.r, p.a + 0.35, p.a + HA.TAU - 0.35); c.closePath(); c.fill();
      c.strokeStyle = '#2e7d32'; c.lineWidth = 1; c.stroke();
    }
  },
});

// 36. A kaleidoscope: everything you draw is mirrored eight ways.
Exhibits.add({
  id: 'kaleido', name: 'Kaleidoscope', section: 'motion', hint: 'Draw anything', canvas: true,
  setup(t) { t.hue = Math.random() * 360; t.idleT = 3; t.drawn = 0; this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    t.ink = document.createElement('canvas');
    t.ink.width = Math.round(t.W * t.dpr); t.ink.height = Math.round(t.H * t.dpr);
    t.ic = t.ink.getContext('2d');
    t.ic.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    t.last = null;
  },
  seg(t, x0, y0, x1, y1, w) {
    const g = t.ic, cx = t.W / 2, cy = t.H / 2, n = t.low ? 6 : 8;
    g.save();
    g.translate(cx, cy);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = HA.hsl(t.hue, 95, 60, 0.9);
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k * HA.TAU) / n, ca = Math.cos(a), sa = Math.sin(a);
      for (const m of [1, -1]) {
        const ax = x0 - cx, ay = (y0 - cy) * m, bx = x1 - cx, by = (y1 - cy) * m;
        g.moveTo(ax * ca - ay * sa, ax * sa + ay * ca);
        g.lineTo(bx * ca - by * sa, bx * sa + by * ca);
      }
    }
    g.stroke();
    g.restore();
    t.drawn++;
  },
  down(t) { t.last = [t.p.x, t.p.y]; t.idleT = 0; },
  frame(t, dt, time) {
    const g = t.ic;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(8,6,16,${t.low ? 0.07 : 0.035})`;
    g.fillRect(0, 0, t.W, t.H);
    t.hue = (t.hue + dt * 40) % 360;
    let x = 0, y = 0, on = false;
    if (t.p.down) { x = t.p.x; y = t.p.y; on = true; t.idleT = 0; }
    else {
      t.idleT += dt;
      if (t.idleT > 2.5) { // doodles by itself
        x = t.W / 2 + Math.sin(time * 1.3) * Math.cos(time * 0.37) * t.W * 0.32;
        y = t.H / 2 + Math.cos(time * 1.7) * t.H * 0.3;
        on = true;
      }
    }
    if (on) { if (t.last) this.seg(t, t.last[0], t.last[1], x, y, t.p.down ? 3.5 : 2.2); t.last = [x, y]; } else t.last = null;
    const c = t.c;
    c.fillStyle = '#08060f'; c.fillRect(0, 0, t.W, t.H);
    c.drawImage(t.ink, 0, 0, t.W, t.H);
  },
});

// 37. Fridge magnets: push the words around and write something.
const MAG_WORDS = ['the', 'a', 'my', 'your', 'car', 'road', 'chicken', 'boom', 'neon', 'night', 'drive', 'fast', 'slow', 'tiny', 'giant',
  'sunny', 'dream', 'crash', 'love', 'wild', 'is', 'and', 'of', 'on', 'in', 'with', 'under', 'I', 'you', 'we', 'go', 'goes', 'sing',
  'dance', 'glow', 'loud', 'sweet', 'moon', 'star', 'coin', 'arcade', 'again', 'never', 'always', 'very', 'soft', 'fire', 'rain', '!',
  '?', 's', 'ing', 'like', 'beep', 'honk', 'yes', 'no', 'home', 'lost', 'gold', 'shiny', 'over', 'who', 'what'];
Exhibits.add({
  id: 'magnets', name: 'Fridge Magnets', section: 'text', hint: 'Drag the words about',
  setup(t) {
    t.el.classList.add('fridge');
    t.el.innerHTML = '<div class="fridge-handle"></div>';
    HA.tools(t, [['Shuffle', () => { this.deal(t); t.blip(500, 0.06, 'triangle', 0.06); }]], 'br');
    t.z = 1;
    this.deal(t);
  },
  deal(t) {
    for (const m of t.el.querySelectorAll('.mag')) m.remove();
    const pool = MAG_WORDS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const n = t.big ? 36 : 14;
    let x = 14, y = 14;
    t.tiles = [];
    for (const w of pool.slice(0, n)) {
      const el = document.createElement('div');
      el.className = 'mag' + (Math.random() < 0.2 ? ' alt' : '');
      el.textContent = w;
      el.style.setProperty('--r', `${HA.rand(-6, 6).toFixed(1)}deg`);
      t.el.appendChild(el);
      const ww = el.offsetWidth;
      if (x + ww > t.W - 40) { x = 14; y += 36; }
      if (y > t.H - 40) { el.remove(); break; }
      el.style.left = `${x + HA.rand(-3, 3)}px`;
      el.style.top = `${y + HA.rand(-3, 3)}px`;
      x += ww + HA.rand(8, 16);
      t.tiles.push(el);
    }
  },
  down(t, e) {
    const m = e && e.target.closest && e.target.closest('.mag');
    if (!m) return;
    t.drag = { el: m, dx: t.p.x - m.offsetLeft, dy: t.p.y - m.offsetTop };
    m.style.zIndex = ++t.z;
    m.classList.add('held');
    t.blip(320, 0.03, 'square', 0.03);
  },
  move(t) {
    if (!t.drag || !t.p.down) return;
    const m = t.drag.el;
    m.style.left = `${HA.clamp(t.p.x - t.drag.dx, 0, t.W - m.offsetWidth)}px`;
    m.style.top = `${HA.clamp(t.p.y - t.drag.dy, 0, t.H - m.offsetHeight)}px`;
  },
  up(t) {
    if (!t.drag) return;
    t.drag.el.classList.remove('held');
    t.drag.el.style.setProperty('--r', `${HA.rand(-5, 5).toFixed(1)}deg`);
    t.blip(170, 0.06, 'sine', 0.1);
    t.drag = null;
  },
  resize(t) {
    for (const m of t.el.querySelectorAll('.mag')) {
      m.style.left = `${HA.clamp(m.offsetLeft, 0, Math.max(0, t.W - m.offsetWidth))}px`;
      m.style.top = `${HA.clamp(m.offsetTop, 0, Math.max(0, t.H - m.offsetHeight))}px`;
    }
  },
});

// 38. Falling letters: type and they drop in, pile up, and can be thrown about.
Exhibits.add({
  id: 'falling', name: 'Falling Letters', section: 'text', hint: 'Type (or tap) to drop letters', canvas: true,
  setup(t) {
    t.L = []; t.cursor = 0.1; t.held = null;
    HA.tools(t, [['ABC', () => this.drop(t, String.fromCharCode(65 + Math.floor(Math.random() * 26)))]], 'tr');
    t.on(window, 'keydown', e => {
      if (!(t.p.inside || t.big) || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      if (!t.big && Exhibits.bigEx) return; // the grid rests while something is full screen
      if (e.key === ' ') { t.cursor += 0.06; e.preventDefault(); return; }
      this.drop(t, e.key.toUpperCase());
    });
    'HALL OF ART'.split('').forEach((ch, i) => { if (ch !== ' ') t.later(() => this.drop(t, ch, 0.12 + i * 0.075), 250 + i * 110); });
  },
  drop(t, ch, fx) {
    if (t.L.length >= (t.low ? 40 : 70)) t.L.shift();
    const r = HA.clamp(t.W / 24, 12, 24);
    const x = (fx !== undefined ? fx : t.cursor) * t.W;
    if (fx === undefined) { t.cursor += 0.07; if (t.cursor > 0.9) t.cursor = 0.1; }
    t.L.push({ ch, x: HA.clamp(x, r, t.W - r), y: -r, vx: HA.rand(-20, 20), vy: 0, r, a: HA.rand(-0.3, 0.3), va: 0, hue: (t.L.length * 47) % 360 });
    t.blip(380 + (ch.charCodeAt(0) % 12) * 45, 0.05, 'triangle', 0.05);
  },
  down(t, e) {
    if (e && e.target.closest && e.target.closest('button')) return;
    t.held = t.L.find(l => Math.hypot(l.x - t.p.x, l.y - t.p.y) < l.r + 4) || null;
    if (!t.held) this.drop(t, String.fromCharCode(65 + Math.floor(Math.random() * 26)), t.p.x / t.W);
  },
  up(t) { if (t.held) { t.held.vx = t.p.vx * 50; t.held.vy = t.p.vy * 50; t.held.va = t.p.vx * 0.3; t.held = null; } },
  frame(t, dt) {
    const L = t.L, W = t.W, H = t.H;
    for (const l of L) {
      if (l === t.held) { l.x = t.p.x; l.y = t.p.y; l.vx = 0; l.vy = 0; continue; }
      l.vy += 900 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.a += l.va * dt;
      if (l.y > H - l.r) { l.y = H - l.r; if (l.vy > 150) t.blip(200 + 400 / l.r, 0.03, 'sine', 0.04); l.vy *= -0.35; l.vx *= 0.9; l.va = l.vx / l.r; }
      if (l.x < l.r) { l.x = l.r; l.vx *= -0.5; }
      if (l.x > W - l.r) { l.x = W - l.r; l.vx *= -0.5; }
      l.va *= 0.98;
    }
    for (let k = 0; k < 2; k++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) {
        const nx = dx / d, ny = dy / d, o = (m - d) / 2;
        if (a !== t.held) { a.x -= nx * o; a.y -= ny * o; }
        if (b !== t.held) { b.x += nx * o; b.y += ny * o; }
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const q = -1.3 * rv / 2; a.vx -= q * nx; a.vy -= q * ny; b.vx += q * nx; b.vy += q * ny; }
      }
    }
    const c = t.c;
    c.fillStyle = '#f4efe2'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const l of L) {
      c.save(); c.translate(l.x, l.y); c.rotate(l.a);
      c.font = `900 ${Math.round(l.r * 1.9)}px ${UI}`;
      c.lineWidth = 4; c.strokeStyle = '#16181c'; c.lineJoin = 'round';
      c.strokeText(l.ch, 0, l.r * 0.12);
      c.fillStyle = HA.hsl(l.hue, 80, 55);
      c.fillText(l.ch, 0, l.r * 0.12);
      c.restore();
    }
    c.textBaseline = 'alphabetic';
  },
});
