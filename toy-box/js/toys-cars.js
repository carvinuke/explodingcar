'use strict';
// Toy Box: it's still the explodingcar arcade.

// 30. A little car that chases your cursor, drifting and leaving tyre marks.
Toys.add({
  id: 'drift', name: 'Drift Doodle', section: 'cars', hint: 'It follows you. Hold to burn rubber', canvas: true, wide: true,
  setup(t) {
    t.car = { x: t.W / 2, y: t.H / 2, a: 0, v: 0, va: 0 };
    t.marks = document.createElement('canvas');
    this.resize(t);
  },
  resize(t) {
    t.marks.width = Math.round(t.W * t.dpr); t.marks.height = Math.round(t.H * t.dpr);
    t.mc = t.marks.getContext('2d'); t.mc.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
  },
  frame(t, dt) {
    const car = t.car, tx = t.p.inside ? t.p.x : t.W / 2 + Math.cos(performance.now() / 900) * t.W * 0.3, ty = t.p.inside ? t.p.y : t.H / 2 + Math.sin(performance.now() / 700) * t.H * 0.25;
    const want = Math.atan2(ty - car.y, tx - car.x), dist = Math.hypot(tx - car.x, ty - car.y);
    let da = want - car.a; while (da > Math.PI) da -= TB.TAU; while (da < -Math.PI) da += TB.TAU;
    car.va = TB.lerp(car.va, TB.clamp(da * 5, -5, 5), dt * 6);
    car.a += car.va * dt;
    const top = t.p.down ? 420 : 260;
    car.v = TB.lerp(car.v, dist > 30 ? top : 0, dt * 2);
    // the car slides: it moves partly where it points and partly where it was going
    car.dx = TB.lerp(car.dx || 0, Math.cos(car.a) * car.v, dt * (t.p.down ? 2 : 5));
    car.dy = TB.lerp(car.dy || 0, Math.sin(car.a) * car.v, dt * (t.p.down ? 2 : 5));
    const ox = car.x, oy = car.y;
    car.x = TB.clamp(car.x + car.dx * dt, 10, t.W - 10); car.y = TB.clamp(car.y + car.dy * dt, 10, t.H - 10);
    const slip = Math.abs(Math.sin(Math.atan2(car.dy, car.dx) - car.a)) * car.v;
    if (slip > 60) { // tyre marks from the back wheels
      const m = t.mc;
      m.strokeStyle = `rgba(20,20,24,${Math.min(0.5, slip / 400)})`; m.lineWidth = 3; m.lineCap = 'round';
      for (const s of [-1, 1]) {
        const bx = -12, by = s * 7, ca = Math.cos(car.a), sa = Math.sin(car.a);
        m.beginPath();
        m.moveTo(ox + bx * ca - by * sa, oy + bx * sa + by * ca);
        m.lineTo(car.x + bx * ca - by * sa, car.y + bx * sa + by * ca);
        m.stroke();
      }
      if (Math.random() < dt * 8) t.noise(0.06, 0.04);
    }
    const c = t.c;
    c.fillStyle = '#3a3d44'; c.fillRect(0, 0, t.W, t.H);
    c.drawImage(t.marks, 0, 0, t.W, t.H);
    c.save(); c.translate(car.x, car.y); c.rotate(car.a);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-15, -8, 32, 18);
    c.fillStyle = '#16181c'; for (const [x, y] of [[-10, -9], [8, -9], [-10, 6], [8, 6]]) c.fillRect(x, y, 7, 3);
    c.fillStyle = '#ffb020'; c.beginPath(); c.roundRect(-16, -8, 32, 16, 4); c.fill();
    c.fillStyle = '#223149'; c.fillRect(-4, -6, 9, 12);
    c.fillStyle = '#fff7d1'; c.fillRect(13, -6, 3, 3); c.fillRect(13, 3, 3, 3);
    c.restore();
  },
});

// 31. A car park of little cars. Click one and it blows up... and takes its neighbours with it.
Toys.add({
  id: 'carpark', name: 'Chain Reaction', section: 'cars', hint: 'Click a car', canvas: true,
  setup(t) { this.fill(t); },
  resize(t) { this.fill(t); },
  fill(t) {
    t.cars = []; t.parts = []; t.rings = [];
    const cols = Math.max(3, Math.floor(t.W / 46)), rows = Math.max(2, Math.floor(t.H / 40));
    const gx = t.W / cols, gy = t.H / rows;
    const colors = ['#e63946', '#3a86ff', '#ffbe0b', '#2a9d8f', '#f4f1de', '#8338ec', '#fb5607'];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      t.cars.push({ x: gx * (i + 0.5), y: gy * (j + 0.5), col: colors[(i * 3 + j * 5) % colors.length], boomT: -1, dead: false });
    }
    t.resetT = 0;
  },
  down(t) {
    const hit = t.cars.find(c => !c.dead && c.boomT < 0 && Math.abs(c.x - t.p.x) < 18 && Math.abs(c.y - t.p.y) < 12);
    if (hit) hit.boomT = 0;
  },
  frame(t, dt) {
    const c = t.c;
    for (const car of t.cars) {
      if (car.boomT < 0 || car.dead) continue;
      car.boomT += dt;
      if (car.boomT > 0.12) {
        car.dead = true;
        t.rings.push({ x: car.x, y: car.y, r: 4, life: 0.5 });
        const n = t.low ? 10 : 22;
        for (let i = 0; i < n; i++) { const a = Math.random() * TB.TAU, v = TB.rand(40, 220); t.parts.push({ x: car.x, y: car.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: TB.rand(0.4, 0.9), hue: TB.rand(10, 50), s: TB.rand(2, 5) }); }
        t.noise(0.35, 0.18); t.blip(TB.rand(60, 110), 0.3, 'sine', 0.12, 0.5);
        // neighbours catch fire
        for (const o of t.cars) if (!o.dead && o.boomT < 0 && Math.hypot(o.x - car.x, o.y - car.y) < 62 && Math.random() < 0.8) o.boomT = -0.0001 - Math.random() * 0.25, o.fuse = true;
      }
    }
    for (const o of t.cars) if (o.fuse && o.boomT < 0) { o.boomT += dt; if (o.boomT >= 0) { o.fuse = false; o.boomT = 0; } }
    if (t.cars.every(o => o.dead || o.boomT < 0 && !o.fuse) && t.cars.some(o => o.dead)) { t.resetT += dt; if (t.resetT > 2.5) this.fill(t); }
    c.fillStyle = '#2b2f36'; c.fillRect(0, 0, t.W, t.H);
    c.strokeStyle = 'rgba(247,247,242,0.35)'; c.lineWidth = 1.5;
    for (const car of t.cars) { c.strokeRect(car.x - 20, car.y - 14, 40, 28); }
    for (const car of t.cars) {
      if (car.dead) { c.fillStyle = '#141416'; c.beginPath(); c.ellipse(car.x, car.y, 16, 10, 0, 0, TB.TAU); c.fill(); continue; }
      const shake = car.boomT >= 0 || car.fuse ? (Math.random() - 0.5) * 3 : 0;
      c.fillStyle = car.col; c.beginPath(); c.roundRect(car.x - 14 + shake, car.y - 8, 28, 16, 4); c.fill();
      c.fillStyle = 'rgba(20,30,50,0.85)'; c.fillRect(car.x - 4 + shake, car.y - 6, 9, 12);
    }
    c.globalCompositeOperation = 'lighter';
    for (const r of t.rings) { r.r += 260 * dt; r.life -= dt; c.strokeStyle = `rgba(255,200,90,${Math.max(0, r.life * 1.6)})`; c.lineWidth = 3; c.beginPath(); c.arc(r.x, r.y, r.r, 0, TB.TAU); c.stroke(); }
    for (const p of t.parts) { p.vx *= 0.95; p.vy *= 0.95; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; c.fillStyle = `hsla(${p.hue},100%,${50 + p.life * 30}%,${Math.max(0, p.life)})`; c.beginPath(); c.arc(p.x, p.y, p.s * (0.6 + p.life), 0, TB.TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    t.parts = t.parts.filter(p => p.life > 0); t.rings = t.rings.filter(r => r.life > 0);
  },
});
