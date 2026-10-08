'use strict';
// Hall of Art: 3D and physics.

// 24. A holographic card that tilts toward your cursor, with a glare that follows.
Exhibits.add({
  id: 'tilt', name: 'Holo Card', section: 'physics', hint: 'Move over the card',
  setup(t) {
    t.el.classList.add('center', 'deep');
    t.el.innerHTML = '<div class="holo"><div class="holo-in"><b>RARE</b><span>Solarian Arcade</span><em>No. 001</em></div><div class="holo-glare"></div></div>';
    t.card = t.el.querySelector('.holo');
    t.rx = HA.spring(160, 14); t.ry = HA.spring(160, 14);
  },
  frame(t, dt) {
    const r = t.card.getBoundingClientRect(), s = t.el.getBoundingClientRect();
    let tx = 0, ty = 0, gx = 50, gy = 30;
    if (t.p.inside) {
      const x = (t.p.x - (r.left - s.left)) / r.width, y = (t.p.y - (r.top - s.top)) / r.height;
      ty = (HA.clamp(x, 0, 1) - 0.5) * 30; tx = -(HA.clamp(y, 0, 1) - 0.5) * 24;
      gx = HA.clamp(x, 0, 1) * 100; gy = HA.clamp(y, 0, 1) * 100;
    }
    const a = t.rx.step(tx, dt), b = t.ry.step(ty, dt);
    t.card.style.transform = `rotateX(${a.toFixed(2)}deg) rotateY(${b.toFixed(2)}deg)`;
    t.card.style.setProperty('--gx', `${gx.toFixed(1)}%`);
    t.card.style.setProperty('--gy', `${gy.toFixed(1)}%`);
    t.card.style.setProperty('--hue', `${(gx * 2.4).toFixed(0)}deg`);
  },
});

// 25. A cube you can spin. Flick it and it keeps going.
Exhibits.add({
  id: 'cube', name: 'Spin the Cube', section: 'physics', hint: 'Drag and flick',
  setup(t) {
    t.el.classList.add('center', 'deep');
    const faces = [['front', '🚗'], ['back', '💥'], ['left', '🚦'], ['right', '🐔'], ['top', '⭐'], ['bottom', '🪙']];
    t.el.innerHTML = '<div class="cube-wrap"><div class="cube">' + faces.map(([f, e]) => `<div class="face ${f}">${e}</div>`).join('') + '</div></div>';
    t.cube = t.el.querySelector('.cube');
    t.ax = -20; t.ay = 30; t.vx = 0; t.vy = 25;
  },
  move(t) { if (t.p.down) { t.vy = t.p.vx * 30; t.vx = -t.p.vy * 30; } },
  frame(t, dt) {
    if (!t.p.down) { t.vx *= Math.exp(-0.8 * dt); t.vy = HA.lerp(t.vy, Math.abs(t.vy) < 25 ? 25 * Math.sign(t.vy || 1) : t.vy, dt); t.vy *= Math.exp(-0.5 * dt); if (Math.abs(t.vy) < 25) t.vy = 25 * Math.sign(t.vy || 1); }
    t.ax += t.vx * dt; t.ay += t.vy * dt;
    t.cube.style.transform = `rotateX(${t.ax.toFixed(2)}deg) rotateY(${t.ay.toFixed(2)}deg)`;
  },
});

// 26. A rope. Grab it anywhere and swing it about.
Exhibits.add({
  id: 'rope', name: 'Rope', section: 'physics', hint: 'Grab and swing', canvas: true,
  setup(t) { this.make(t); },
  make(t) {
    const n = 22, seg = (t.H * 0.75) / n;
    t.seg = seg;
    t.pts = Array.from({ length: n + 1 }, (_, i) => ({ x: t.W / 2, y: 16 + i * seg, ox: t.W / 2, oy: 16 + i * seg }));
    t.grab = -1;
  },
  resize(t) { this.make(t); },
  down(t) {
    let best = -1, bd = 40;
    t.pts.forEach((p, i) => { const d = Math.hypot(p.x - t.p.x, p.y - t.p.y); if (i && d < bd) { bd = d; best = i; } });
    t.grab = best;
    if (best > 0) t.blip(300, 0.06, 'triangle', 0.08);
  },
  up(t) { t.grab = -1; },
  frame(t, dt) {
    const P = t.pts, g = 900 * dt * dt;
    for (let i = 1; i < P.length; i++) {
      const p = P[i], vx = (p.x - p.ox) * 0.995, vy = (p.y - p.oy) * 0.995;
      p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + g;
    }
    if (t.grab > 0 && t.p.down) { P[t.grab].x = t.p.x; P[t.grab].y = t.p.y; }
    P[0].x = t.W / 2; P[0].y = 16;
    for (let k = 0; k < 12; k++) {
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - t.seg) / d * 0.5;
        if (i > 0) { a.x += dx * diff; a.y += dy * diff; }
        b.x -= dx * diff; b.y -= dy * diff;
      }
      if (t.grab > 0 && t.p.down) { P[t.grab].x = t.p.x; P[t.grab].y = t.p.y; }
    }
    const c = t.c;
    c.fillStyle = '#16181f'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = '#5b616b'; c.fillRect(t.W / 2 - 20, 8, 40, 8);
    c.strokeStyle = '#c99a5b'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(P[0].x, P[0].y); for (const p of P) c.lineTo(p.x, p.y); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; c.setLineDash([4, 6]); c.stroke(); c.setLineDash([]);
    const e = P[P.length - 1];
    c.fillStyle = '#e63946'; c.beginPath(); c.arc(e.x, e.y, 12, 0, HA.TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(e.x - 4, e.y - 4, 4, 0, HA.TAU); c.fill();
  },
});

// 27. Click to drop bouncy balls. Drag them and throw them.
Exhibits.add({
  id: 'balls', name: 'Bouncy Balls', section: 'physics', hint: 'Click to add, drag to throw', canvas: true,
  setup(t) { t.b = []; for (let i = 0; i < 6; i++) this.add(t, HA.rand(30, t.W - 30), HA.rand(20, t.H / 2)); t.held = null; },
  add(t, x, y) {
    if (t.b.length > 40) t.b.shift();
    const r = HA.rand(10, 22);
    t.b.push({ x, y, vx: HA.rand(-80, 80), vy: 0, r, hue: Math.random() * 360 });
  },
  down(t) {
    t.held = t.b.find(b => Math.hypot(b.x - t.p.x, b.y - t.p.y) < b.r + 4) || null;
    if (!t.held) { this.add(t, t.p.x, t.p.y); t.blip(600, 0.08, 'sine', 0.1, 1.5); }
  },
  up(t) { if (t.held) { t.held.vx = t.p.vx * 50; t.held.vy = t.p.vy * 50; t.held = null; } },
  frame(t, dt) {
    const B = t.b, W = t.W, H = t.H;
    for (const b of B) {
      if (b === t.held) { b.x = t.p.x; b.y = t.p.y; b.vx = 0; b.vy = 0; continue; }
      b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H - b.r) { b.y = H - b.r; if (b.vy > 120) t.blip(220 + 600 / b.r, 0.04, 'sine', Math.min(0.08, b.vy / 6000)); b.vy *= -0.78; b.vx *= 0.98; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.78; }
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.8; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.8; }
    }
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) {
        const nx = dx / d, ny = dy / d, o = (m - d) / 2;
        a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const k = -1.8 * rv / 2; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; }
      }
    }
    const c = t.c;
    c.fillStyle = '#1a1626'; c.fillRect(0, 0, W, H);
    for (const b of B) {
      if (!b.img) { // each ball is drawn once into a little picture, then reused
        const img = b.img = document.createElement('canvas'), s = Math.ceil(b.r * 2 * 2);
        img.width = img.height = s;
        const g = img.getContext('2d'), r = s / 2, gr = g.createRadialGradient(r * 0.65, r * 0.6, r * 0.1, r, r, r);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, HA.hsl(b.hue, 90, 65)); gr.addColorStop(1, HA.hsl(b.hue, 80, 38));
        g.fillStyle = gr; g.beginPath(); g.arc(r, r, r, 0, HA.TAU); g.fill();
      }
      c.drawImage(b.img, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
  },
});

// 28. Newton's cradle: pull a ball back and let go.
Exhibits.add({
  id: 'cradle', name: "Newton's Cradle", section: 'physics', hint: 'Drag an end ball out', canvas: true,
  setup(t) { t.n = 5; t.a = new Array(5).fill(0); t.v = new Array(5).fill(0); t.a[0] = -0.7; t.grab = -1; },
  geo(t) { const r = Math.min(18, t.W / 14), L = t.H * 0.55, x0 = t.W / 2 - (t.n - 1) * r; return { r, L, x0, top: t.H * 0.14 }; },
  down(t) {
    const { r, L, x0, top } = this.geo(t);
    for (const i of [0, t.n - 1]) {
      const bx = x0 + i * 2 * r + Math.sin(t.a[i]) * L, by = top + Math.cos(t.a[i]) * L;
      if (Math.hypot(bx - t.p.x, by - t.p.y) < r * 1.8) t.grab = i;
    }
  },
  up(t) { t.grab = -1; },
  frame(t, dt) {
    const { r, L, x0, top } = this.geo(t), n = t.n;
    const steps = 8, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        if (i === t.grab) {
          const ax = x0 + i * 2 * r;
          let a = Math.atan2(t.p.x - ax, t.p.y - top);
          a = i === 0 ? HA.clamp(a, -1.2, 0) : HA.clamp(a, 0, 1.2);
          t.a[i] = a; t.v[i] = 0;
          continue;
        }
        t.v[i] += -9.8 / (L / 100) * Math.sin(t.a[i]) * h * 0.9;
        t.v[i] *= 0.9997;
        t.a[i] += t.v[i] * h;
      }
      // touching balls swap speeds (perfectly elastic)
      for (let i = 0; i < n - 1; i++) {
        const xa = x0 + i * 2 * r + Math.sin(t.a[i]) * L, xb = x0 + (i + 1) * 2 * r + Math.sin(t.a[i + 1]) * L;
        if (xb - xa < 2 * r - 0.1 && t.v[i] > t.v[i + 1]) {
          const tmp = t.v[i]; t.v[i] = t.v[i + 1]; t.v[i + 1] = tmp;
          if (Math.abs(tmp) > 0.3 && s === 0) t.blip(1800, 0.03, 'triangle', Math.min(0.1, Math.abs(tmp) * 0.04));
        }
      }
    }
    const c = t.c;
    c.fillStyle = '#121418'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = '#5b616b'; c.fillRect(x0 - r * 3, top - 6, (n - 1) * 2 * r + r * 6, 6);
    for (let i = 0; i < n; i++) {
      const ax = x0 + i * 2 * r, bx = ax + Math.sin(t.a[i]) * L, by = top + Math.cos(t.a[i]) * L;
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(ax, top); c.lineTo(bx, by); c.stroke();
      const g = c.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#c9ced6'); g.addColorStop(1, '#4b515c');
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, r, 0, HA.TAU); c.fill();
    }
  },
});

// 29. A sheet of cloth hanging from a rail. Drag it about; drag fast to tear it.
Exhibits.add({
  id: 'cloth', name: 'Cloth', section: 'physics', hint: 'Drag it, rip it, click to re-hang', canvas: true, wide: true,
  setup(t) { this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    const cols = t.low ? 18 : 26, rows = t.low ? 10 : 14;
    const y0 = 18, sp = Math.min(Math.min(t.W * 0.86, 520) / cols, (t.H - y0 - 24) / (rows * 0.8)); // fits the stage both ways
    const w = sp * cols, x0 = (t.W - w) / 2;
    t.sp = sp;
    t.pts = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const x = x0 + i * sp, y = y0 + j * sp * 0.8;
      t.pts.push({ x, y, ox: x, oy: y, pin: j === 0 && i % 3 === 0 });
    }
    t.links = [];
    const id = (i, j) => j * (cols + 1) + i;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      if (i < cols) t.links.push([id(i, j), id(i + 1, j), sp]);
      if (j < rows) t.links.push([id(i, j), id(i, j + 1), sp * 0.8]);
    }
    t.cols = cols; t.rows = rows; t.idOf = id;
  },
  down(t) { if (t.p.y < 14) this.make(t); },
  frame(t, dt) {
    const P = t.pts, g = 700 * dt * dt;
    for (const p of P) {
      if (p.pin) continue;
      const vx = (p.x - p.ox) * 0.985, vy = (p.y - p.oy) * 0.985;
      p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + g;
      if (t.p.down) {
        const dx = p.x - t.p.x, dy = p.y - t.p.y, d = dx * dx + dy * dy;
        if (d < 900) { p.ox = p.x - t.p.vx * 0.6; p.oy = p.y - t.p.vy * 0.6; }
      }
    }
    for (let k = 0; k < 3; k++) {
      for (const L of t.links) {
        if (L.cut) continue;
        const a = P[L[0]], b = P[L[1]], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (d > L[2] * 3.2) { L.cut = true; continue; } // pulled too far: it tears
        const diff = (d - L[2]) / d * 0.5;
        if (!a.pin) { a.x += dx * diff; a.y += dy * diff; }
        if (!b.pin) { b.x -= dx * diff; b.y -= dy * diff; }
      }
    }
    const c = t.c;
    c.fillStyle = '#14161c'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = '#7d838c'; c.fillRect(0, 12, t.W, 5);
    c.lineWidth = 1.4;
    const bands = [new Path2D(), new Path2D(), new Path2D()]; // relaxed, stretched, about to tear
    for (const L of t.links) {
      if (L.cut) continue;
      const a = P[L[0]], b = P[L[1]];
      const stretch = Math.hypot(b.x - a.x, b.y - a.y) / L[2];
      const path = bands[stretch < 1.25 ? 0 : stretch < 2 ? 1 : 2];
      path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
    }
    ['#ff6fb5', '#ffb86b', '#fff06b'].forEach((col, i) => { c.strokeStyle = col; c.stroke(bands[i]); });
  },
});
