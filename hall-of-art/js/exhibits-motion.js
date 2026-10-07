'use strict';
// Hall of Art: things that move.

// 11. Particles drifting along invisible currents. Your cursor stirs them.
Exhibits.add({
  id: 'flow', name: 'Flow Field', section: 'motion', hint: 'Move through it', canvas: true,
  setup(t) {
    t.n = t.low ? 300 : t.big ? 1400 : 700;
    t.ps = Array.from({ length: t.n }, () => ({ x: Math.random() * t.W, y: Math.random() * t.H, age: Math.random() * 200 }));
    t.c.fillStyle = '#0b0d14'; t.c.fillRect(0, 0, t.W, t.H);
  },
  resize(t) { t.c.fillStyle = '#0b0d14'; t.c.fillRect(0, 0, t.W, t.H); },
  frame(t, dt, time) {
    const c = t.c;
    c.fillStyle = 'rgba(11,13,20,0.08)'; c.fillRect(0, 0, t.W, t.H);
    c.lineWidth = 1.2;
    const z = time * 0.08, B = 6, paths = [];
    for (let k = 0; k < B; k++) paths.push(new Path2D()); // colour bands across the width: one stroke each
    for (const p of t.ps) {
      let a = HA.noise(p.x * 0.006 + z, p.y * 0.006) * HA.TAU * 2;
      const dx = p.x - t.p.x, dy = p.y - t.p.y, d2 = dx * dx + dy * dy;
      let vx = Math.cos(a) * 60, vy = Math.sin(a) * 60;
      if (d2 < 9000) { const k = (1 - d2 / 9000) * 260; const d = Math.sqrt(d2) || 1; vx += (-dy / d) * k; vy += (dx / d) * k; } // swirl around the cursor
      const x0 = p.x, y0 = p.y;
      p.x += vx * dt; p.y += vy * dt; p.age += dt * 60;
      const path = paths[Math.max(0, Math.min(B - 1, Math.floor((p.x / t.W) * B)))];
      path.moveTo(x0, y0); path.lineTo(p.x, p.y);
      if (p.x < 0 || p.x > t.W || p.y < 0 || p.y > t.H || p.age > 400) { p.x = Math.random() * t.W; p.y = Math.random() * t.H; p.age = 0; }
    }
    for (let k = 0; k < B; k++) { c.strokeStyle = HA.hsl((k / B) * 120 + 180 + time * 20, 90, 62, 0.55); c.stroke(paths[k]); }
  },
});

// 12. A flock of little birds. They keep together and keep away from you.
Exhibits.add({
  id: 'boids', name: 'Flock', section: 'motion', hint: 'Chase them', canvas: true,
  setup(t) {
    const n = t.low ? 50 : t.big ? 180 : 90;
    t.b = Array.from({ length: n }, () => ({ x: Math.random() * t.W, y: Math.random() * t.H, vx: HA.rand(-60, 60), vy: HA.rand(-60, 60) }));
  },
  frame(t, dt) {
    const c = t.c, B = t.b;
    c.fillStyle = '#10243a'; c.fillRect(0, 0, t.W, t.H);
    for (const a of B) {
      let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, n = 0;
      for (const o of B) {
        if (o === a) continue;
        const dx = o.x - a.x, dy = o.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > 2500) continue;
        n++; cx += o.x; cy += o.y; ax += o.vx; ay += o.vy;
        if (d2 < 260) { sx -= dx; sy -= dy; }
      }
      if (n) { a.vx += ((cx / n - a.x) * 0.9 + (ax / n - a.vx) * 1.6 + sx * 6) * dt; a.vy += ((cy / n - a.y) * 0.9 + (ay / n - a.vy) * 1.6 + sy * 6) * dt; }
      const dx = a.x - t.p.x, dy = a.y - t.p.y, d2 = dx * dx + dy * dy;
      if (d2 < 10000) { a.vx += dx / Math.sqrt(d2 + 1) * 900 * dt; a.vy += dy / Math.sqrt(d2 + 1) * 900 * dt; }
      // steer back in from the edges
      if (a.x < 30) a.vx += 300 * dt; if (a.x > t.W - 30) a.vx -= 300 * dt;
      if (a.y < 30) a.vy += 300 * dt; if (a.y > t.H - 30) a.vy -= 300 * dt;
      const sp = Math.hypot(a.vx, a.vy), want = HA.clamp(sp, 70, 190);
      a.vx *= want / (sp || 1); a.vy *= want / (sp || 1);
    }
    c.fillStyle = '#f7f7f2';
    for (const a of B) {
      a.x += a.vx * dt; a.y += a.vy * dt;
      const ang = Math.atan2(a.vy, a.vx);
      c.save(); c.translate(a.x, a.y); c.rotate(ang);
      c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, 4); c.lineTo(-3, 0); c.lineTo(-5, -4); c.closePath(); c.fill();
      c.restore();
    }
  },
});

// 13. A lava lamp: blobs that stretch, merge and split. Click to add heat.
Exhibits.add({
  id: 'lava', name: 'Lava Lamp', section: 'motion', hint: 'Click to add a blob', canvas: true,
  setup(t) {
    t.blobs = Array.from({ length: 7 }, () => ({ x: HA.rand(0.2, 0.8), y: HA.rand(0.1, 0.9), r: HA.rand(0.09, 0.15), vy: HA.rand(-0.08, 0.08), ph: Math.random() * 6 }));
    t.grid = document.createElement('canvas');
  },
  down(t) {
    if (t.blobs.length < 14) t.blobs.push({ x: t.p.x / t.W, y: t.p.y / t.H, r: 0.1, vy: -0.12, ph: 0 });
    t.blip(160, 0.3, 'sine', 0.12, 0.7);
  },
  frame(t, dt, time) {
    const gw = t.low ? 60 : 96, gh = Math.round(gw * t.H / t.W);
    const g = t.grid;
    if (g.width !== gw || g.height !== gh) { g.width = gw; g.height = gh; t.img = g.getContext('2d').createImageData(gw, gh); }
    for (const b of t.blobs) {
      b.ph += dt; b.y += (b.vy + Math.sin(b.ph * 0.7) * 0.05) * dt;
      if (b.y < 0.1) b.vy = Math.abs(b.vy) + 0.02; if (b.y > 0.9) b.vy = -Math.abs(b.vy) - 0.02;
      b.x += Math.sin(b.ph * 0.5) * 0.02 * dt;
    }
    const d = t.img.data, aspect = t.W / t.H;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const x = i / gw, y = j / gh;
        let f = 0;
        for (const b of t.blobs) { const dx = (x - b.x) * aspect, dy = y - b.y; f += (b.r * b.r) / (dx * dx + dy * dy + 1e-4); }
        const o = (j * gw + i) * 4;
        if (f > 1) { const k = Math.min(1, (f - 1) * 1.5); d[o] = 255; d[o + 1] = 70 + k * 120 + y * 40; d[o + 2] = 60 + (1 - y) * 80; d[o + 3] = 255; }
        else { d[o] = 40 + y * 30; d[o + 1] = 10; d[o + 2] = 50 + y * 20; d[o + 3] = 255; }
      }
    }
    g.getContext('2d').putImageData(t.img, 0, 0);
    t.c.imageSmoothingEnabled = true;
    t.c.drawImage(g, 0, 0, t.W, t.H);
  },
});

// 14. Stars rushing past. Hold for warp speed.
Exhibits.add({
  id: 'warp', name: 'Warp Speed', section: 'motion', hint: 'Hold to go faster', canvas: true,
  setup(t) {
    t.s = Array.from({ length: t.low ? 150 : 400 }, () => ({ x: HA.rand(-1, 1), y: HA.rand(-1, 1), z: Math.random() }));
    t.speed = 0.15;
  },
  down(t) { t.blip(120, 0.6, 'sawtooth', 0.04, 4); },
  frame(t, dt) {
    const c = t.c, W = t.W, H = t.H;
    t.speed = HA.lerp(t.speed, t.p.down ? 1.6 : 0.15, 1 - Math.exp(-2.5 * dt));
    c.fillStyle = `rgba(4,5,14,${t.p.down ? 0.35 : 0.9})`; c.fillRect(0, 0, W, H);
    const cx = W / 2 + (t.p.inside ? (t.p.x - W / 2) * 0.15 : 0), cy = H / 2 + (t.p.inside ? (t.p.y - H / 2) * 0.15 : 0);
    c.lineCap = 'round';
    const bands = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], k = Math.min(W, H) * 0.5;
    for (const s of t.s) {
      const z0 = s.z;
      s.z -= t.speed * dt;
      if (s.z <= 0.01) { s.x = HA.rand(-1, 1); s.y = HA.rand(-1, 1); s.z = 1; continue; }
      const path = bands[Math.min(3, Math.floor((1 - s.z) * 4))];
      path.moveTo(cx + (s.x / z0) * k, cy + (s.y / z0) * k); path.lineTo(cx + (s.x / s.z) * k, cy + (s.y / s.z) * k);
    }
    bands.forEach((path, i) => { c.strokeStyle = `rgba(${200 + 14 * i},225,255,${0.25 + i * 0.25})`; c.lineWidth = 0.6 + i * 0.6; c.stroke(path); });
  },
});

// 15. Pendulums with slightly different lengths: they drift in and out of patterns.
Exhibits.add({
  id: 'pendulum', name: 'Pendulum Wave', section: 'motion', hint: 'Click to restart it', canvas: true,
  setup(t) { t.t0 = 0; },
  down(t) { t.t0 = 0; t.blip(660, 0.2, 'triangle', 0.1); },
  frame(t, dt) {
    const c = t.c, W = t.W, H = t.H, n = 15;
    t.t0 += dt;
    c.fillStyle = '#14161c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5b616b'; c.fillRect(W * 0.08, 14, W * 0.84, 4);
    for (let i = 0; i < n; i++) {
      const x0 = W * 0.1 + (W * 0.8) * (i / (n - 1));
      const period = 60 / (51 + i); // all line up again every 60 seconds
      const a = 0.5 * Math.cos(HA.TAU * t.t0 / period);
      const y = 18 + (H - 60) * 0.92 * Math.cos(a) * 0.98, x = x0 + Math.sin(a) * (H - 60) * 0.92 * 0.6;
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, 18); c.lineTo(x, y); c.stroke();
      c.fillStyle = HA.hsl(i * 24, 85, 60);
      c.beginPath(); c.arc(x, y, Math.min(9, W / 60), 0, HA.TAU); c.fill();
    }
  },
});

// 16. A spirograph that draws itself. Click for a new pattern.
Exhibits.add({
  id: 'spiro', name: 'Spirograph', section: 'motion', hint: 'Click for a new pattern', canvas: true,
  setup(t) { this.reset(t); },
  reset(t) {
    t.R = HA.rand(0.32, 0.42); t.r = HA.rand(0.08, 0.3) * (Math.random() < 0.5 ? 1 : -1); t.d = HA.rand(0.05, 0.25);
    t.th = 0; t.hue = Math.random() * 360; t.last = null;
    t.c.fillStyle = '#0f1218'; t.c.fillRect(0, 0, t.W, t.H);
  },
  down(t) { this.reset(t); t.blip(440, 0.15, 'sine', 0.1, 2); },
  resize(t) { this.reset(t); },
  frame(t, dt) {
    const c = t.c, S = Math.min(t.W, t.H), cx = t.W / 2, cy = t.H / 2;
    c.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      t.th += 0.035;
      const { R, r, d } = t, k = (R - r) / r;
      const x = cx + ((R - r) * Math.cos(t.th) + d * Math.cos(k * t.th)) * S, y = cy + ((R - r) * Math.sin(t.th) - d * Math.sin(k * t.th)) * S;
      if (t.last) { c.strokeStyle = HA.hsl(t.hue + t.th * 4, 90, 62, 0.8); c.beginPath(); c.moveTo(t.last[0], t.last[1]); c.lineTo(x, y); c.stroke(); }
      t.last = [x, y];
    }
    if (t.th > 400) { c.fillStyle = 'rgba(15,18,24,0.02)'; c.fillRect(0, 0, t.W, t.H); }
  },
});

// 17. A glowing 3D knot that turns. Drag to spin it.
Exhibits.add({
  id: 'knot', name: 'Lissajous Knot', section: 'motion', hint: 'Drag to spin', canvas: true,
  setup(t) { t.rx = 0.4; t.ry = 0; t.vx = 0.25; t.vy = 0.35; },
  move(t) { if (t.p.down) { t.vy = t.p.vx * 0.2; t.vx = t.p.vy * 0.2; } },
  frame(t, dt, time) {
    const c = t.c, W = t.W, H = t.H, S = Math.min(W, H) * 0.36;
    t.ry += t.vy * dt; t.rx += t.vx * dt;
    if (!t.p.down) { t.vy = HA.lerp(t.vy, 0.35, dt * 0.5); t.vx = HA.lerp(t.vx, 0.25, dt * 0.5); }
    c.fillStyle = '#090b12'; c.fillRect(0, 0, W, H);
    const N = 360, pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * HA.TAU;
      let x = Math.sin(3 * a + 0.5), y = Math.sin(2 * a), z = Math.sin(5 * a + time * 0.3) * 0.6;
      const cy = Math.cos(t.ry), sy = Math.sin(t.ry); [x, z] = [x * cy - z * sy, x * sy + z * cy];
      const cx = Math.cos(t.rx), sx = Math.sin(t.rx); [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const k = 2.4 / (2.4 + z);
      pts.push([W / 2 + x * S * k, H / 2 + y * S * k, z]);
    }
    // far parts first, near parts last and brighter (a few batches, not one stroke per segment)
    c.lineCap = 'round';
    const bands = [[], [], [], []];
    for (let i = 1; i < pts.length; i++) bands[Math.max(0, Math.min(3, Math.floor((pts[i][2] + 1) * 2)))].push(i);
    for (let b = 3; b >= 0; b--) {
      const z = b / 2 - 1 + 0.25;
      c.strokeStyle = HA.hsl(280 - b * 10, 90, 55 + (1 - z) * 12, 0.9);
      c.lineWidth = 2 + (1 - z) * 1.6;
      c.beginPath();
      for (const i of bands[b]) { c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); }
      c.stroke();
    }
  },
});

// 18. Northern lights: soft curtains of colour that sway with your cursor.
Exhibits.add({
  id: 'aurora', name: 'Aurora', section: 'motion', hint: 'Move side to side', canvas: true, wide: true,
  setup(t) { t.sway = 0; t.stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * 0.6, Math.random()]); },
  frame(t, dt, time) {
    const c = t.c, W = t.W, H = t.H;
    t.sway = HA.lerp(t.sway, t.p.inside ? (t.p.x / W - 0.5) * 2 : Math.sin(time * 0.2) * 0.4, dt * 1.5);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#02030a'); sky.addColorStop(1, '#0b1a2a');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (const [x, y, k] of t.stars) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(time * 1.5 + k * 9))})`; c.fillRect(x * W, y * H, 1.5, 1.5); }
    // the curtains are drawn small and stretched up: soft edges for free, and cheap
    const sw = 96, sh = Math.max(24, Math.round(sw * H / W));
    if (!t.soft || t.soft.width !== sw || t.soft.height !== sh) { t.soft = document.createElement('canvas'); t.soft.width = sw; t.soft.height = sh; }
    const g2 = t.soft.getContext('2d');
    g2.clearRect(0, 0, sw, sh);
    g2.globalCompositeOperation = 'lighter';
    const bands = [[140, 0.0], [170, 1.8], [290, 3.1]], N = 32;
    for (const [hue, off] of bands) {
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N;
        const top = sh * (0.2 + 0.12 * Math.sin(u * 5 + time * 0.5 + off) + 0.08 * Math.sin(u * 13 - time * 0.8 + off) + t.sway * 0.1 * Math.sin(u * 3 + off));
        const len = sh * (0.35 + 0.15 * Math.sin(u * 7 + time * 0.7 + off));
        const gr = g2.createLinearGradient(0, top, 0, top + len);
        gr.addColorStop(0, `hsla(${hue},90%,60%,0)`); gr.addColorStop(0.25, `hsla(${hue},90%,62%,0.32)`); gr.addColorStop(1, `hsla(${hue},90%,60%,0)`);
        g2.fillStyle = gr;
        g2.fillRect((i / N) * sw, top, sw / N + 0.5, len);
      }
    }
    c.globalCompositeOperation = 'lighter';
    c.imageSmoothingEnabled = true;
    c.drawImage(t.soft, 0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#05070c';
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, H - 18 - Math.abs(Math.sin(x * 0.03)) * 18 - (x % 60 < 20 ? 14 : 0));
    c.lineTo(W, H); c.closePath(); c.fill();
  },
});
