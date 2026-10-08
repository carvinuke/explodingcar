'use strict';
// Hall of Art: Pinball, Snow Globe and Laser Mirrors (Sculpture & Physics), Theremin
// and Wind Chimes (Music Room), Showroom and Car Wash (Road Works).

// ---- Pinball --------------------------------------------------------------------------
// The table is laid out in its own units (300 x 400) and scaled to fit.
const PB_W = 300, PB_H = 400, PB_R = 7;
const PB_FLIP = { L: { x: 80, y: 344, rest: 0.52, up: -0.45 }, R: { x: 194, y: 344, rest: Math.PI - 0.52, up: Math.PI + 0.45 } };
const PB_LEN = 46;

Exhibits.add({
  id: 'pinball', name: 'Pinball', section: 'physics', hint: 'Tap left or right for the flippers (or Z and M)', canvas: true,
  setup(t) {
    t.best = Number(HALL_STORE.get('pinball', 0)) || 0;
    t.fa = { L: 0, R: 0 }; t.touches = new Map(); t.keys = { L: false, R: false, P: false };
    t.idle = 99; t.plunge = 0; t.flash = {}; t.botT = { L: 0, R: 0 }; t.overT = 0;
    this.build(t);
    this.newGame(t);
    const lift = e => { const k = t.touches.get(e.pointerId); t.touches.delete(e.pointerId); if (k === 'P') this.launch(t); };
    t.on(t.el, 'pointerup', lift);
    t.on(t.el, 'pointercancel', lift);
    t.on(window, 'keydown', e => this.key(t, e, true));
    t.on(window, 'keyup', e => this.key(t, e, false));
  },
  build(t) {
    const W = [];
    const seg = (ax, ay, bx, by, kind = 'wall') => W.push({ ax, ay, bx, by, kind });
    seg(12, PB_H, 12, 90); seg(288, 90, 288, PB_H); seg(262, PB_H, 262, 130);
    for (let i = 0; i < 14; i++) { // the arch over the top
      const a0 = Math.PI + (i / 14) * Math.PI, a1 = Math.PI + ((i + 1) / 14) * Math.PI;
      seg(150 + Math.cos(a0) * 138, 90 + Math.sin(a0) * 76, 150 + Math.cos(a1) * 138, 90 + Math.sin(a1) * 76);
    }
    seg(12, 300, 74, 340); seg(262, 300, 200, 340); // guides down to the flippers
    seg(38, 250, 62, 312, 'sling'); seg(236, 250, 212, 312, 'sling');
    t.walls = W;
    t.bumpers = [{ x: 105, y: 150, r: 17 }, { x: 195, y: 150, r: 17 }, { x: 150, y: 206, r: 17 }];
    t.targets = [120, 150, 180].map(x => ({ x, y: 72, up: true }));
  },
  newGame(t) {
    t.balls = 3; t.score = 0; t.over = false;
    for (const g of t.targets) g.up = true;
    this.serve(t);
  },
  serve(t) { t.ball = { x: 275, y: 378, vx: 0, vy: 0, r: PB_R, inLane: true }; t.plunge = 0; },
  launch(t) {
    const b = t.ball;
    if (!b || !b.inLane || b.y < 360) { t.plunge = 0; return; }
    b.vy = -(420 + 560 * Math.max(0.25, t.plunge)); b.inLane = false; t.plunge = 0;
    t.noise(0.2, 0.06, 1800);
  },
  geo(t) { const s = Math.min(t.W / PB_W, t.H / PB_H) * 0.98; return { s, ox: (t.W - PB_W * s) / 2, oy: (t.H - PB_H * s) / 2 }; },
  down(t, e) {
    t.idle = 0;
    if (t.over) { this.newGame(t); return; }
    const G = this.geo(t), tx = (t.p.x - G.ox) / G.s, ty = (t.p.y - G.oy) / G.s;
    const side = tx > 262 && ty > 280 && t.ball && t.ball.inLane ? 'P' : t.p.x < t.W / 2 ? 'L' : 'R';
    t.touches.set(e ? e.pointerId : 0, side);
    if (side !== 'P') t.blip(110, 0.05, 'square', 0.05);
  },
  key(t, e, on) {
    if (!(t.p.inside || t.big) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, side = ['z', 'Z', 'a', 'A', 'ArrowLeft'].includes(k) ? 'L' : ['m', 'M', 'l', 'L', '/', 'ArrowRight'].includes(k) ? 'R' : [' ', 'ArrowDown', 'Enter'].includes(k) ? 'P' : null;
    if (!side) return;
    e.preventDefault();
    if (on && !e.repeat) { t.idle = 0; if (t.over) { this.newGame(t); return; } if (side !== 'P') t.blip(110, 0.05, 'square', 0.05); }
    if (side === 'P' && t.keys.P && !on) this.launch(t);
    t.keys[side] = on;
  },
  held(t, side) { if (t.keys[side]) return true; for (const v of t.touches.values()) if (v === side) return true; return false; },
  hitSeg(b, ax, ay, bx, by, rad, e, fx) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const u = HA.clamp(((b.x - ax) * dx + (b.y - ay) * dy) / L2, 0, 1), px = ax + dx * u, py = ay + dy * u;
    let nx = b.x - px, ny = b.y - py;
    const d = Math.hypot(nx, ny), R = b.r + rad;
    if (d >= R || d === 0) return 0;
    nx /= d; ny /= d;
    b.x = px + nx * R; b.y = py + ny * R;
    // a moving flipper: bounce off it as it moves
    const svx = fx ? -fx.w * (py - fx.y) : 0, svy = fx ? fx.w * (px - fx.x) : 0;
    const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    return { nx, ny, vn };
  },
  // the little computer player that keeps the table going while nobody's playing
  bot(t, dt) {
    const b = t.ball;
    for (const side of ['L', 'R']) {
      t.botT[side] -= dt;
      const F = PB_FLIP[side], near = b && !b.inLane && b.y > 300 && b.vy > -20 && Math.abs(b.x - (F.x + (side === 'L' ? 22 : -22))) < 34;
      if (near && t.botT[side] <= -0.3) t.botT[side] = 0.18;
      t.keys[side] = t.botT[side] > 0;
    }
    if (b && b.inLane && b.vy === 0) { t.plunge += dt * 0.8; if (t.plunge > 0.7 + Math.random() * 0.3) this.launch(t); }
    if (t.over && (t.overT += dt) > 3) { t.overT = 0; this.newGame(t); }
  },
  frame(t, dt) {
    t.idle += dt;
    if (t.idle > 8) { this.bot(t, dt); t.botOn = true; }
    else if (t.botOn) { t.botOn = false; t.keys.L = t.keys.R = t.keys.P = false; } // you've taken over
    if (t.ball && t.ball.inLane && (this.held(t, 'P'))) t.plunge = Math.min(1, t.plunge + dt * 1.3);
    const sub = 6, h = dt / sub, b = t.ball;
    for (let s = 0; s < sub; s++) {
      // flippers swing up fast and drop back a little slower
      const fl = {};
      for (const side of ['L', 'R']) {
        const F = PB_FLIP[side], was = t.fa[side], want = this.held(t, side) ? 1 : 0;
        t.fa[side] = want ? Math.min(1, was + h * 14) : Math.max(0, was - h * 8);
        const ang = HA.lerp(F.rest, F.up, t.fa[side]);
        fl[side] = { x: F.x, y: F.y, ang, w: ((F.up - F.rest) * (t.fa[side] - was)) / h };
      }
      t.fl = fl;
      if (!b || t.over) continue;
      if (!b.inLane || b.vy !== 0) {
        b.vy += 520 * h;
        b.x += b.vx * h; b.y += b.vy * h;
      }
      // the plunger lane: the ball sits on the plunger until it's sent off
      if (b.x > 262 && b.y >= 378 && b.vy >= 0) { b.y = 378; b.vy = 0; b.vx = 0; b.x = 275; b.inLane = true; }
      for (const w of t.walls) {
        const r = this.hitSeg(b, w.ax, w.ay, w.bx, w.by, 0, w.kind === 'sling' ? 0.3 : 0.45);
        if (r && w.kind === 'sling' && r.vn < -60) { b.vx += r.nx * 240; b.vy += r.ny * 240; this.add(t, 10); t.flash[w.ax] = 0.2; t.blip(700, 0.04, 'square', 0.05); }
      }
      for (const side of ['L', 'R']) {
        const F = fl[side], tx = F.x + Math.cos(F.ang) * PB_LEN, ty = F.y + Math.sin(F.ang) * PB_LEN;
        this.hitSeg(b, F.x, F.y, tx, ty, 5.5, 0.35, F);
      }
      for (const B of t.bumpers) {
        const dx = b.x - B.x, dy = b.y - B.y, d = Math.hypot(dx, dy);
        if (d < B.r + b.r && d > 0) {
          const nx = dx / d, ny = dy / d, sp = Math.max(380, Math.hypot(b.vx, b.vy));
          b.x = B.x + nx * (B.r + b.r); b.y = B.y + ny * (B.r + b.r);
          b.vx = nx * sp; b.vy = ny * sp;
          B.flash = 0.25; this.add(t, 100);
          t.blip(500 + B.x, 0.06, 'square', 0.05, 1.6);
        }
      }
      for (const g of t.targets) {
        if (g.up && Math.abs(b.x - g.x) < 10 + b.r && Math.abs(b.y - g.y) < 4 + b.r) {
          g.up = false; b.vy = Math.abs(b.vy) * 0.6 + 40; this.add(t, 250);
          t.blip(1046, 0.12, 'triangle', 0.06);
          if (t.targets.every(q => !q.up)) { this.add(t, 1000); [784, 988, 1175, 1568].forEach((f, i) => t.later(() => t.blip(f, 0.12, 'triangle', 0.06), i * 80)); t.later(() => { for (const q of t.targets) q.up = true; }, 1500); }
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 900) { b.vx *= 900 / sp; b.vy *= 900 / sp; }
    }
    // down the middle and gone
    if (b && !t.over && b.y > PB_H + 12) {
      t.balls--;
      t.blip(300, 0.5, 'sawtooth', 0.04, 0.4);
      if (t.balls <= 0) {
        t.over = true; t.ball = null;
        if (t.score > t.best) { t.best = t.score; HALL_STORE.set('pinball', t.best); }
      } else this.serve(t);
    }
    this.draw(t);
  },
  add(t, n) { t.score += n; },
  draw(t) {
    const c = t.c, G = this.geo(t), s = G.s;
    c.fillStyle = '#0d0b1c'; c.fillRect(0, 0, t.W, t.H);
    c.save(); c.translate(G.ox, G.oy); c.scale(s, s);
    // the playfield
    const pf = c.createLinearGradient(0, 0, 0, PB_H);
    pf.addColorStop(0, '#1f2a6b'); pf.addColorStop(1, '#3a1c5c');
    c.fillStyle = pf;
    c.beginPath(); c.moveTo(12, PB_H); c.lineTo(12, 90); c.ellipse(150, 90, 138, 76, 0, Math.PI, 0); c.lineTo(288, PB_H); c.closePath(); c.fill();
    // the score, written on the glass
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'center'; c.font = `900 22px ${UI}`;
    c.fillText(t.score.toLocaleString('en'), 150, 46);
    c.font = `800 10px ${UI}`; c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillText(t.over ? `GAME OVER · BEST ${t.best.toLocaleString('en')}` : `BALL ${4 - t.balls} OF 3 · BEST ${t.best.toLocaleString('en')}`, 150, 60);
    c.lineCap = 'round';
    for (const w of t.walls) {
      c.strokeStyle = w.kind === 'sling' ? ((t.flash[w.ax] || 0) > 0 ? '#fff' : '#ff4fa0') : '#c9d2ff';
      c.lineWidth = w.kind === 'sling' ? 4 : 3;
      c.beginPath(); c.moveTo(w.ax, w.ay); c.lineTo(w.bx, w.by); c.stroke();
    }
    for (const k in t.flash) t.flash[k] -= 1 / 60;
    for (const B of t.bumpers) {
      B.flash = Math.max(0, (B.flash || 0) - 1 / 60);
      c.fillStyle = B.flash > 0 ? '#ffffff' : '#ffb000';
      c.beginPath(); c.arc(B.x, B.y, B.r, 0, HA.TAU); c.fill();
      c.fillStyle = '#e8102a'; c.beginPath(); c.arc(B.x, B.y, B.r * 0.62, 0, HA.TAU); c.fill();
      c.fillStyle = '#fff'; c.font = `900 9px ${UI}`; c.fillText('100', B.x, B.y + 3);
    }
    for (const g of t.targets) { c.fillStyle = g.up ? '#3cff7a' : 'rgba(60,255,122,0.2)'; c.fillRect(g.x - 9, g.y - 3, 18, 6); }
    // the plunger
    c.fillStyle = '#9aa0a8'; c.fillRect(268, 386 + t.plunge * 12, 14, PB_H - 386);
    c.strokeStyle = '#c9cdd4'; c.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const y = 388 + t.plunge * 12 + k * 3; c.beginPath(); c.moveTo(268, y); c.lineTo(282, y + 1.5); c.stroke(); }
    // flippers
    if (t.fl) for (const side of ['L', 'R']) {
      const F = t.fl[side];
      c.strokeStyle = '#f7f7f2'; c.lineWidth = 11;
      c.beginPath(); c.moveTo(F.x, F.y); c.lineTo(F.x + Math.cos(F.ang) * PB_LEN, F.y + Math.sin(F.ang) * PB_LEN); c.stroke();
      c.strokeStyle = '#e8102a'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(F.x, F.y); c.lineTo(F.x + Math.cos(F.ang) * PB_LEN * 0.9, F.y + Math.sin(F.ang) * PB_LEN * 0.9); c.stroke();
    }
    // the ball
    const b = t.ball;
    if (b) {
      const g = c.createRadialGradient(b.x - 2.5, b.y - 2.5, 0.5, b.x, b.y, b.r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c9cdd4'); g.addColorStop(1, '#5d6672');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, HA.TAU); c.fill();
    }
    if (t.over) { c.fillStyle = '#ffd23f'; c.font = `900 20px ${UI}`; c.fillText('TAP TO PLAY', 150, 290); }
    c.restore();
  },
});

// ---- Snow Globe -----------------------------------------------------------------------
Exhibits.add({
  id: 'snowglobe', name: 'Snow Globe', section: 'physics', hint: 'Grab it and give it a shake', canvas: true,
  setup(t) {
    t.el.classList.add('deep');
    t.off = { x: 0, y: 0, vx: 0, vy: 0 }; t.grab = null; t.swirl = 0.6; t.shhT = 0; t.idle = 0; t.prevV = { x: 0, y: 0 };
    this.make(t);
  },
  resize(t) { this.make(t); },
  make(t) {
    t.R = Math.min(t.W * 0.34, t.H * 0.36);
    t.flakes = [];
    for (let i = 0; i < (t.low ? 110 : 240); i++) {
      const falling = i % 3 === 0, x = HA.rand(-0.8, 0.8) * t.R;
      t.flakes.push({ x, y: falling ? HA.rand(-0.8, 0.3) * t.R : this.ground(t, x) - Math.random() * 3, vx: 0, vy: 0, r: HA.rand(0.9, 2.1), rest: !falling });
    }
  },
  // the snowy mound inside (relative to the globe's middle)
  ground(t, x) { return t.R * 0.42 - Math.cos(HA.clamp(x / (t.R * 0.9), -1, 1) * Math.PI / 2) * t.R * 0.07; },
  centre(t) { return { x: t.W / 2 + t.off.x, y: t.H * 0.43 + t.off.y }; },
  down(t) {
    const C = this.centre(t);
    t.idle = 0;
    if (Math.hypot(t.p.x - C.x, t.p.y - C.y) < t.R * 1.15) t.grab = { x: t.p.x - t.off.x, y: t.p.y - t.off.y };
  },
  up(t) {
    if (t.grab && Math.hypot(t.off.x, t.off.y) < 4) { t.off.vx += HA.rand(-260, 260); t.off.vy -= 180; } // just a tap: a little knock
    t.grab = null;
  },
  frame(t, dt, time) {
    const O = t.off, R = t.R;
    t.idle += dt;
    if (t.grab) {
      let nx = t.p.x - t.grab.x, ny = t.p.y - t.grab.y;
      const d = Math.hypot(nx, ny), max = R * 0.4;
      if (d > max) { nx *= max / d; ny *= max / d; }
      O.vx = (nx - O.x) / Math.max(dt, 1e-3); O.vy = (ny - O.y) / Math.max(dt, 1e-3);
      O.x = nx; O.y = ny;
    } else {
      // nobody about: now and then it gets a nudge, so the snow never stays down for good
      if (t.idle > 12) { t.idle = 0; O.vx += HA.rand(-200, 200); O.vy -= 120; }
      O.vx += (-O.x * 70 - O.vx * 7) * dt; O.vy += (-O.y * 70 - O.vy * 7) * dt;
      O.x += O.vx * dt; O.y += O.vy * dt;
    }
    // how hard the globe is being shaken (in its own frame the snow feels it the other way)
    const ax = (O.vx - t.prevV.x) / Math.max(dt, 1e-3), ay = (O.vy - t.prevV.y) / Math.max(dt, 1e-3);
    t.prevV = { x: O.vx, y: O.vy };
    const A = Math.min(30000, Math.hypot(ax, ay));
    t.swirl = Math.min(1.5, t.swirl * Math.exp(-0.45 * dt) + A * 0.00002);
    if (A > 3000) { t.shhT -= dt; if (t.shhT <= 0) { t.shhT = 0.12; t.noise(0.14, Math.min(0.05, A / 300000), 1400); } }
    const sink = 22 * (R / 100);
    for (const f of t.flakes) {
      if (f.rest) {
        if (A > 2500 && Math.random() < 0.5) { f.rest = false; f.vx = -ax * 0.012 + HA.rand(-40, 40); f.vy = -ay * 0.012 - HA.rand(20, 80); }
        else continue;
      }
      const ang = HA.noise(f.x * 0.025 + time * 0.3, f.y * 0.025) * HA.TAU * 2;
      f.vx += (-ax * 0.004 + Math.cos(ang) * 90 * t.swirl) * dt;
      f.vy += (-ay * 0.004 + Math.sin(ang) * 90 * t.swirl + sink) * dt;
      f.vx *= Math.exp(-2.4 * dt); f.vy *= Math.exp(-2.4 * dt);
      f.x += f.vx * dt; f.y += f.vy * dt;
      const d = Math.hypot(f.x, f.y), lim = R * 0.93;
      if (d > lim) { f.x *= lim / d; f.y *= lim / d; const rv = (f.vx * f.x + f.vy * f.y) / lim; if (rv > 0) { f.vx -= 1.4 * rv * f.x / lim; f.vy -= 1.4 * rv * f.y / lim; } }
      const gy = this.ground(t, f.x);
      if (f.y > gy - f.r && Math.abs(f.vx) + Math.abs(f.vy) < 40 && Math.abs(f.x) < R * 0.86) { f.y = gy - Math.random() * 2.5; f.rest = true; }
      else if (f.y > gy + 2 && Math.abs(f.x) < R * 0.86) f.vy -= 60 * dt;
    }
    // drawing
    const c = t.c, C = this.centre(t);
    c.clearRect(0, 0, t.W, t.H);
    // the stand
    const by = t.H * 0.43 + R * 0.86;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(t.W / 2, by + R * 0.42, R * 0.95, R * 0.12, 0, 0, HA.TAU); c.fill();
    const wood = c.createLinearGradient(0, by, 0, by + R * 0.42);
    wood.addColorStop(0, '#8a5a2a'); wood.addColorStop(1, '#4f3014');
    c.fillStyle = wood;
    c.beginPath(); c.moveTo(C.x - R * 0.7, by); c.lineTo(C.x + R * 0.7, by); c.lineTo(C.x + R * 0.9, by + R * 0.4); c.lineTo(C.x - R * 0.9, by + R * 0.4); c.closePath(); c.fill();
    c.fillStyle = '#d6ab52'; c.fillRect(C.x - R * 0.3, by + R * 0.14, R * 0.6, R * 0.14);
    c.fillStyle = '#5b3b22'; c.font = `900 ${Math.max(7, Math.round(R * 0.09))}px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SOLARIAN', C.x, by + R * 0.215);
    c.textBaseline = 'alphabetic';
    // inside the glass
    c.save();
    c.beginPath(); c.arc(C.x, C.y, R, 0, HA.TAU); c.clip();
    const sky = c.createRadialGradient(C.x, C.y - R * 0.3, R * 0.1, C.x, C.y, R);
    sky.addColorStop(0, '#2d4580'); sky.addColorStop(1, '#0d1533');
    c.fillStyle = sky; c.fillRect(C.x - R, C.y - R, R * 2, R * 2);
    c.translate(C.x, C.y);
    // the little scene: snow, a house with its light on, trees and a car
    c.fillStyle = '#eef3ff';
    c.beginPath(); c.moveTo(-R, R);
    for (let x = -R; x <= R; x += R / 12) c.lineTo(x, this.ground(t, x));
    c.lineTo(R, R); c.closePath(); c.fill();
    const u = R / 100;
    c.fillStyle = '#c94a3a'; c.fillRect(-18 * u, 14 * u, 34 * u, 24 * u);
    c.fillStyle = '#f7f7f2'; c.beginPath(); c.moveTo(-23 * u, 15 * u); c.lineTo(-1 * u, -4 * u); c.lineTo(21 * u, 15 * u); c.closePath(); c.fill();
    c.fillStyle = '#ffd56b'; c.fillRect(-11 * u, 21 * u, 8 * u, 7 * u);
    c.fillStyle = '#5b3b22'; c.fillRect(5 * u, 24 * u, 7 * u, 14 * u);
    for (const [tx, sc] of [[-48, 1], [40, 0.85], [58, 0.65]]) {
      c.fillStyle = '#2e7d4a';
      for (let k = 0; k < 3; k++) { const w = (16 - k * 4) * sc * u, y = (38 - k * 11) * sc * u + (1 - sc) * 22 * u; c.beginPath(); c.moveTo(tx * u - w, y); c.lineTo(tx * u, y - 14 * sc * u); c.lineTo(tx * u + w, y); c.closePath(); c.fill(); }
    }
    c.fillStyle = '#1f6fd1'; c.fillRect(-46 * u, 30 * u, 22 * u, 7 * u); c.fillRect(-42 * u, 25 * u, 12 * u, 6 * u);
    c.fillStyle = '#16181c'; c.beginPath(); c.arc(-41 * u, 38 * u, 3 * u, 0, HA.TAU); c.arc(-29 * u, 38 * u, 3 * u, 0, HA.TAU); c.fill();
    // the snow
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (const f of t.flakes) { c.moveTo(f.x + f.r, f.y); c.arc(f.x, f.y, f.r, 0, HA.TAU); }
    c.fill();
    c.restore();
    // the glass
    c.strokeStyle = 'rgba(220,235,255,0.5)'; c.lineWidth = 2;
    c.beginPath(); c.arc(C.x, C.y, R, 0, HA.TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = R * 0.07;
    c.beginPath(); c.arc(C.x, C.y, R * 0.84, -2.7, -1.95); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(C.x + R * 0.45, C.y - R * 0.5, R * 0.05, 0, HA.TAU); c.fill();
  },
});

// ---- Laser Mirrors --------------------------------------------------------------------
Exhibits.add({
  id: 'lasers', name: 'Laser Mirrors', section: 'physics', hint: 'Drag the mirrors (turn them by their ends) to light every crystal', canvas: true,
  setup(t) {
    t.el.classList.add('dark');
    t.solved = 0; t.winT = 0; t.drag = null; t.sparks = [];
    const n = t.big ? 4 : 3;
    t.mirrors = Array.from({ length: n }, (_, i) => ({ x: 0.3 + (i * 0.55) / Math.max(1, n - 1), y: i % 2 ? 0.3 : 0.68, a: i % 2 ? -Math.PI / 4 : Math.PI / 4 }));
    this.puzzle(t);
    t.on(t.el, 'wheel', e => {
      const m = this.near(t, t.p.x, t.p.y);
      if (!m) return;
      e.preventDefault();
      m.m.a += Math.sign(e.deltaY) * (Math.PI / 24);
      t.blip(900, 0.02, 'square', 0.02);
    }, { passive: false });
  },
  puzzle(t) {
    t.ey = HA.rand(0.25, 0.75);
    t.targets = [];
    let tries = 0;
    while (t.targets.length < 3 && tries++ < 200) {
      const g = { x: HA.rand(0.35, 0.92), y: HA.rand(0.14, 0.86), lit: false, glow: 0 };
      if (t.targets.every(o => Math.hypot(o.x - g.x, (o.y - g.y) * 0.7) > 0.2) && Math.abs(g.y - t.ey) > 0.08) t.targets.push(g);
    }
  },
  half(t) { return HA.clamp(Math.min(t.W, t.H) * 0.11, 16, 46); },
  ends(t, m) { const h = this.half(t), x = m.x * t.W, y = m.y * t.H; return [x - Math.cos(m.a) * h, y - Math.sin(m.a) * h, x + Math.cos(m.a) * h, y + Math.sin(m.a) * h]; },
  near(t, px, py) {
    let best = null;
    for (const m of t.mirrors) {
      const [x0, y0, x1, y1] = this.ends(t, m);
      if (Math.hypot(px - x0, py - y0) < 14) return { m, mode: 'turn', end: -1 };
      if (Math.hypot(px - x1, py - y1) < 14) return { m, mode: 'turn', end: 1 };
      const dx = x1 - x0, dy = y1 - y0, u = HA.clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy), 0, 1);
      if (Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u)) < 14) best = { m, mode: 'move', ox: px - m.x * t.W, oy: py - m.y * t.H };
    }
    return best;
  },
  down(t) { t.drag = this.near(t, t.p.x, t.p.y); if (t.drag) t.blip(600, 0.03, 'sine', 0.04); },
  move(t) {
    const D = t.drag;
    if (!D || !t.p.down) return;
    if (D.mode === 'move') { D.m.x = HA.clamp((t.p.x - D.ox) / t.W, 0.06, 0.97); D.m.y = HA.clamp((t.p.y - D.oy) / t.H, 0.06, 0.94); }
    else D.m.a = Math.atan2(t.p.y - D.m.y * t.H, t.p.x - D.m.x * t.W) + (D.end < 0 ? Math.PI : 0);
  },
  up(t) { t.drag = null; },
  // the beam: off the mirrors (both faces), lighting any crystal it passes through
  trace(t) {
    let px = 14, py = t.ey * t.H, dx = 1, dy = 0;
    const pts = [[px, py]];
    for (const g of t.targets) g.lit = false;
    for (let bounce = 0; bounce < 16; bounce++) {
      let best = Infinity, hit = null;
      for (const m of t.mirrors) {
        const [x0, y0, x1, y1] = this.ends(t, m), ex = x1 - x0, ey = y1 - y0;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const s = ((x0 - px) * ey - (y0 - py) * ex) / den, u = ((x0 - px) * dy - (y0 - py) * dx) / den;
        if (s > 0.5 && u >= 0 && u <= 1 && s < best) { best = s; hit = m; }
      }
      // or the edge of the room
      let wall = Infinity;
      if (dx > 0) wall = Math.min(wall, (t.W - px) / dx); if (dx < 0) wall = Math.min(wall, -px / dx);
      if (dy > 0) wall = Math.min(wall, (t.H - py) / dy); if (dy < 0) wall = Math.min(wall, -py / dy);
      const len = Math.min(best, wall), qx = px + dx * len, qy = py + dy * len;
      for (const g of t.targets) {
        const gx = g.x * t.W, gy = g.y * t.H, u = HA.clamp((gx - px) * dx + (gy - py) * dy, 0, len);
        if (Math.hypot(px + dx * u - gx, py + dy * u - gy) < 11) g.lit = true;
      }
      pts.push([qx, qy]);
      if (!hit || best > wall) break;
      const nx = -Math.sin(hit.a), ny = Math.cos(hit.a), dot = dx * nx + dy * ny;
      dx -= 2 * dot * nx; dy -= 2 * dot * ny;
      px = qx; py = qy;
    }
    return pts;
  },
  frame(t, dt, time) {
    const c = t.c, pts = this.trace(t);
    const all = t.targets.every(g => g.lit);
    if (all && t.winT <= 0) {
      t.winT = 2.4; t.solved++;
      for (const g of t.targets) for (let i = 0; i < (t.low ? 8 : 18); i++) { const a = Math.random() * HA.TAU, v = HA.rand(40, 200); t.sparks.push({ x: g.x * t.W, y: g.y * t.H, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: HA.rand(0.4, 1) }); }
      [659, 784, 988, 1319].forEach((f, i) => t.later(() => t.blip(f, 0.2, 'triangle', 0.06), i * 90));
    }
    if (t.winT > 0) { t.winT -= dt; if (t.winT <= 0) this.puzzle(t); }
    c.fillStyle = '#07080e'; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = 'rgba(120,140,255,0.05)';
    for (let x = 0; x < t.W; x += 24) c.fillRect(x, 0, 1, t.H);
    for (let y = 0; y < t.H; y += 24) c.fillRect(0, y, t.W, 1);
    // crystals
    for (const g of t.targets) {
      g.glow += ((g.lit ? 1 : 0) - g.glow) * Math.min(1, dt * 10);
      const x = g.x * t.W, y = g.y * t.H;
      if (g.glow > 0.05) {
        const h = c.createRadialGradient(x, y, 0, x, y, 30);
        h.addColorStop(0, `rgba(80,240,255,${0.5 * g.glow})`); h.addColorStop(1, 'rgba(80,240,255,0)');
        c.fillStyle = h; c.fillRect(x - 30, y - 30, 60, 60);
      }
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4 + time * (g.lit ? 1.5 : 0.3));
      c.fillStyle = g.lit ? '#bff8ff' : '#2a3a50'; c.fillRect(-7, -7, 14, 14);
      c.strokeStyle = g.lit ? '#50f0ff' : '#5d7a99'; c.lineWidth = 2; c.strokeRect(-7, -7, 14, 14);
      c.restore();
    }
    // the beam
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [w, col] of t.low ? [[2.5, 'rgba(255,60,90,0.9)']] : [[9, 'rgba(255,40,80,0.12)'], [4, 'rgba(255,60,90,0.35)'], [1.6, 'rgba(255,210,220,0.95)']]) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    const [ex, ey] = pts[pts.length - 1];
    if (Math.random() < 0.6) t.sparks.push({ x: ex, y: ey, vx: HA.rand(-60, 60), vy: HA.rand(-60, 60), life: 0.3 });
    for (const s of t.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; c.fillStyle = `rgba(255,150,170,${Math.min(1, s.life * 2)})`; c.fillRect(s.x - 1, s.y - 1, 2, 2); }
    t.sparks = t.sparks.filter(s => s.life > 0);
    c.globalCompositeOperation = 'source-over';
    // the emitter
    c.fillStyle = '#3a3d44'; c.fillRect(0, t.ey * t.H - 9, 16, 18);
    c.fillStyle = '#ff3050'; c.fillRect(12, t.ey * t.H - 3, 4, 6);
    // mirrors
    const hover = t.drag || (t.p.inside ? this.near(t, t.p.x, t.p.y) : null);
    for (const m of t.mirrors) {
      const [x0, y0, x1, y1] = this.ends(t, m), on = hover && hover.m === m;
      c.strokeStyle = '#1c2230'; c.lineWidth = 7; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = on ? '#ffffff' : '#c9d6e8'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      for (const [x, y] of [[x0, y0], [x1, y1]]) { c.fillStyle = on && hover.mode === 'turn' ? '#ffd23f' : '#5d7a99'; c.beginPath(); c.arc(x, y, 5, 0, HA.TAU); c.fill(); }
    }
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `800 11px ${UI}`; c.textAlign = 'right';
    c.fillText(t.winT > 0 ? 'ALL LIT!' : `${t.targets.filter(g => g.lit).length} / ${t.targets.length} lit · solved ${t.solved}`, t.W - 10, t.H - 10);
  },
});

// ---- Theremin -------------------------------------------------------------------------
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

Exhibits.add({
  id: 'theremin', name: 'Theremin', section: 'music', hint: 'Hold and move: across for pitch, up for volume', canvas: true,
  setup(t) {
    t.el.classList.add('dark');
    t.snap = false; t.wave = 'sine'; t.freq = 440; t.vol = 0; t.trail = []; t.phase = 0;
    HA.tools(t, [
      ['Smooth', b => { t.snap = !t.snap; b.textContent = t.snap ? 'Notes' : 'Smooth'; b.classList.toggle('on', t.snap); }],
      ['Sine', b => {
        const W = ['sine', 'triangle', 'sawtooth', 'square'];
        t.wave = W[(W.indexOf(t.wave) + 1) % W.length];
        b.textContent = { sine: 'Sine', triangle: 'Soft', sawtooth: 'Buzz', square: 'Square' }[t.wave];
        if (t.osc) t.osc.type = t.wave;
      }],
    ], 'tl');
  },
  // the sound, made the first time you play
  voice(t) {
    if (t.osc || Exhibits.muted) return;
    try {
      if (!Exhibits.audio) Exhibits.audio = new (window.AudioContext || window.webkitAudioContext)();
      const a = Exhibits.audio;
      if (a.state === 'suspended') a.resume();
      const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = t.wave; o.frequency.value = t.freq; g.gain.value = 0;
      lfo.frequency.value = 5.5; lg.gain.value = 0;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(a.destination);
      o.start(); lfo.start();
      Object.assign(t, { osc: o, gain: g, lfo, lfoGain: lg });
    } catch (e) { /* no sound here */ }
  },
  down(t, e) { if (e && e.target.closest && e.target.closest('button')) return; this.voice(t); },
  // let go: quiet at once (even if the piece has scrolled away and stopped drawing)
  up(t) { if (t.gain) t.gain.gain.setTargetAtTime(0, Exhibits.audio.currentTime, 0.06); },
  pitch(t, x) {
    let f = 110 * Math.pow(2, (4 * HA.clamp(x, 0, t.W)) / t.W);
    if (t.snap) {
      const semis = 12 * Math.log2(f / 110), oct = Math.floor(semis / 12), inOct = semis - oct * 12;
      let bestN = 0, bd = 99;
      for (const n of [0, 2, 4, 7, 9, 12]) if (Math.abs(n - inOct) < bd) { bd = Math.abs(n - inOct); bestN = n; }
      f = 110 * Math.pow(2, (oct * 12 + bestN) / 12);
    }
    return f;
  },
  frame(t, dt, time) {
    const c = t.c, playing = t.p.down && t.p.inside && !Exhibits.muted;
    if (playing) {
      t.freq = this.pitch(t, t.p.x);
      t.vol = Math.pow(HA.clamp(1 - t.p.y / t.H, 0, 1), 1.4) * 0.22;
      t.trail.push({ x: t.p.x, y: t.p.y, life: 1 });
    } else t.vol = 0;
    if (t.osc) {
      const now = Exhibits.audio.currentTime;
      t.osc.frequency.setTargetAtTime(t.freq, now, t.snap ? 0.035 : 0.012);
      t.gain.gain.setTargetAtTime(t.vol, now, playing ? 0.04 : 0.09);
      t.lfoGain.gain.setTargetAtTime(playing ? t.freq * 0.007 : 0, now, 0.2);
    }
    c.fillStyle = '#090713'; c.fillRect(0, 0, t.W, t.H);
    // the notes along the bottom (every C, and the notes you can land on)
    c.font = `800 10px ${UI}`; c.textAlign = 'center';
    for (let n = 0; n <= 48; n++) {
      const f = 110 * Math.pow(2, n / 12), x = (Math.log2(f / 110) / 4) * t.W, note = (n + 9) % 12;
      if (note === 0) { c.fillStyle = 'rgba(160,140,255,0.22)'; c.fillRect(x, 0, 1, t.H); c.fillStyle = 'rgba(200,190,255,0.6)'; c.fillText('C' + (Math.floor((n + 9) / 12) + 2), x, t.H - 6); }
      else if (t.snap && [0, 2, 4, 7, 9].includes(n % 12)) { c.fillStyle = 'rgba(120,255,200,0.12)'; c.fillRect(x, 0, 1, t.H); }
    }
    // the wave itself
    const amp = (t.vol / 0.22) * t.H * 0.32, cyc = t.freq / 55;
    t.phase += dt * cyc * 2;
    if (amp > 0.5) {
      c.globalCompositeOperation = 'lighter';
      const hue = 280 - Math.log2(t.freq / 110) * 45;
      for (const [w, al] of t.low ? [[2, 0.9]] : [[8, 0.12], [3, 0.35], [1.4, 0.95]]) {
        c.strokeStyle = HA.hsl(hue, 95, 65, al); c.lineWidth = w;
        c.beginPath();
        for (let x = 0; x <= t.W; x += 3) {
          const ph = (x / t.W) * cyc + t.phase, fr = ph - Math.floor(ph);
          const v = t.wave === 'square' ? (fr < 0.5 ? 1 : -1) : t.wave === 'sawtooth' ? fr * 2 - 1 : t.wave === 'triangle' ? 1 - 4 * Math.abs(fr - 0.5) : Math.sin(ph * HA.TAU);
          const y = t.H / 2 + v * amp;
          x ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    } else { c.strokeStyle = 'rgba(160,140,255,0.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, t.H / 2); c.lineTo(t.W, t.H / 2); c.stroke(); }
    for (const p of t.trail) { p.life -= dt * 1.5; c.fillStyle = `rgba(255,200,255,${Math.max(0, p.life) * 0.5})`; c.beginPath(); c.arc(p.x, p.y, 3 * p.life + 1, 0, HA.TAU); c.fill(); }
    t.trail = t.trail.filter(p => p.life > 0);
    // what's playing (along the bottom, clear of the buttons)
    c.textAlign = 'center'; c.fillStyle = '#f0e6ff'; c.font = `900 ${Math.round(HA.clamp(t.W / 22, 12, 24))}px ${UI}`;
    const ty = t.H - 24;
    if (Exhibits.muted) { c.font = `800 12px ${UI}`; c.fillText('Sound is off (turn it on at the top of the page)', t.W / 2, ty); }
    else if (playing) {
      const m = Math.round(12 * Math.log2(t.freq / 440)) + 69;
      c.fillText(`${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1} · ${Math.round(t.freq)} Hz`, t.W / 2, ty);
    } else { c.font = `800 12px ${UI}`; c.fillStyle = 'rgba(240,230,255,0.6)'; c.fillText('hold down anywhere to play', t.W / 2, ty); }
  },
  destroy(t) {
    try { if (t.osc) { t.gain.gain.value = 0; t.osc.stop(); t.lfo.stop(); t.osc.disconnect(); t.gain.disconnect(); t.lfo.disconnect(); t.lfoGain.disconnect(); } } catch (e) { /* already gone */ }
    t.osc = null;
  },
});

// ---- Wind Chimes ----------------------------------------------------------------------
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66]; // a pentatonic run up from C5

Exhibits.add({
  id: 'chimes', name: 'Wind Chimes', section: 'music', hint: 'Brush through the chimes', canvas: true,
  setup(t) {
    t.n = t.low ? 5 : 7;
    t.tubes = Array.from({ length: t.n }, () => ({ th: HA.rand(-0.05, 0.05), w: 0, glow: 0, last: 0 }));
    t.rings = [];
    HA.tools(t, [['Gust of wind', () => this.gust(t)]], 'tr');
  },
  geo(t) {
    const top = t.H * 0.14, x0 = t.W * 0.2, x1 = t.W * 0.8, str = t.H * 0.1, wid = HA.clamp(t.W * 0.024, 6, 16);
    return { top, str, wid, tube: i => ({ ax: HA.lerp(x0, x1, i / (t.n - 1)), len: t.H * HA.lerp(0.6, 0.32, i / (t.n - 1)) }) };
  },
  gust(t) {
    t.tubes.forEach((T, i) => t.later(() => { T.w += HA.rand(0.6, 1.6) * (Math.random() < 0.5 ? -1 : 1); }, i * 60 + Math.random() * 200));
    t.noise(0.8, 0.04, 700);
  },
  ring(t, i, vol) {
    const T = t.tubes[i], now = performance.now();
    T.glow = Math.max(T.glow, Math.min(1, vol * 2));
    if (Exhibits.muted || vol < 0.03 || now - T.last < 90) return;
    t.rings = t.rings.filter(x => now - x < 1000);
    if (t.rings.length > 14) return;
    T.last = now; t.rings.push(now);
    try {
      if (!Exhibits.audio) Exhibits.audio = new (window.AudioContext || window.webkitAudioContext)();
      const a = Exhibits.audio, at = a.currentTime, f = CHIME_NOTES[i];
      if (a.state === 'suspended') a.resume();
      for (const [m, amp, dec] of [[1, 1, 2.6], [2.76, 0.45, 1.4], [5.4, 0.22, 0.7], [8.93, 0.1, 0.35]]) {
        const o = a.createOscillator(), g = a.createGain();
        o.frequency.value = f * m;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.min(1, vol) * amp * 0.1 + 0.0002, at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
        o.connect(g); g.connect(a.destination);
        o.start(at); o.stop(at + dec + 0.05);
      }
    } catch (e) { /* no sound here */ }
  },
  frame(t, dt, time) {
    const G = this.geo(t), g = 900 * Math.max(0.6, t.H / 260);
    // a breath of wind keeps them moving a little
    t.tubes.forEach((T, i) => {
      const P = G.tube(i), L = G.str + P.len / 2;
      T.w += (-(g / L) * Math.sin(T.th) - 0.35 * T.w + (HA.noise(time * 0.4, i * 3.1) - 0.5) * 0.9) * dt;
      T.th += T.w * dt;
      T.glow = Math.max(0, T.glow - dt * 1.2);
      // a hand (or mouse) brushing through
      if (t.p.inside && Math.abs(t.p.vx) > 0.5) {
        const sx = P.ax + Math.sin(T.th) * G.str, sy = G.top + Math.cos(T.th) * G.str;
        const ex = P.ax + Math.sin(T.th) * (G.str + P.len), ey = G.top + Math.cos(T.th) * (G.str + P.len);
        const dx = ex - sx, dy = ey - sy, u = HA.clamp(((t.p.x - sx) * dx + (t.p.y - sy) * dy) / (dx * dx + dy * dy), 0, 1);
        if (Math.hypot(t.p.x - (sx + dx * u), t.p.y - (sy + dy * u)) < G.wid / 2 + 8 && performance.now() - (T.touched || 0) > 140) {
          T.touched = performance.now();
          const kick = HA.clamp(t.p.vx * 0.05, -2.4, 2.4);
          T.w += kick;
          this.ring(t, i, Math.abs(kick) * 0.45);
        }
      }
    });
    // neighbours clink together
    for (let i = 0; i + 1 < t.n; i++) {
      const A = t.tubes[i], B = t.tubes[i + 1], PA = G.tube(i), PB = G.tube(i + 1);
      const r = G.str + PB.len; // down to the shorter one's bottom
      const gap = PB.ax + r * Math.sin(B.th) - (PA.ax + r * Math.sin(A.th)) - G.wid;
      if (gap < 0) {
        const rel = r * (A.w - B.w);
        if (rel > 0) {
          const dw = 0.8 * (A.w - B.w);
          A.w -= dw; B.w += dw;
          const vol = HA.clamp(rel / 300, 0, 1);
          this.ring(t, i, vol); this.ring(t, i + 1, vol);
        }
        A.th += gap / (2 * r); B.th -= gap / (2 * r);
      }
    }
    // drawing
    const c = t.c, sky = c.createLinearGradient(0, 0, 0, t.H);
    sky.addColorStop(0, '#2b2d5a'); sky.addColorStop(0.65, '#b0607a'); sky.addColorStop(1, '#f0a37a');
    c.fillStyle = sky; c.fillRect(0, 0, t.W, t.H);
    c.strokeStyle = '#3b2a1c'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(t.W / 2, 0); c.lineTo(t.W / 2, G.top - 6); c.stroke();
    c.fillStyle = '#7a4f2a'; c.fillRect(t.W * 0.14, G.top - 7, t.W * 0.72, 9);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(t.W * 0.14, G.top - 7, t.W * 0.72, 2);
    t.tubes.forEach((T, i) => {
      const P = G.tube(i);
      c.save(); c.translate(P.ax, G.top); c.rotate(-T.th);
      c.strokeStyle = 'rgba(30,20,30,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, G.str); c.stroke();
      const mg = c.createLinearGradient(-G.wid / 2, 0, G.wid / 2, 0);
      mg.addColorStop(0, '#8a8f99'); mg.addColorStop(0.35, '#f4f6fa'); mg.addColorStop(0.7, '#b9bfca'); mg.addColorStop(1, '#6b707a');
      c.fillStyle = mg; c.fillRect(-G.wid / 2, G.str, G.wid, P.len);
      if (T.glow > 0.02) { c.fillStyle = `rgba(255,240,200,${T.glow * 0.6})`; c.fillRect(-G.wid / 2 - 2, G.str - 2, G.wid + 4, P.len + 4); }
      c.restore();
    });
  },
});

// ---- Showroom -------------------------------------------------------------------------
const SHOW_TYPES = ['elfer', 'elferClassic', 'toroV12', 'toroFuria', 'rossoF8', 'rossoSuperfast', 'veloce', 'regent', 'gelande',
  'sports', 'sedan', 'small', 'taxi', 'police', 'pickup', 'van', 'bus', 'ambulance', 'firetruck', 'tractor'];
const SHOW_TURN = ['E', 'S', 'W', 'N'];
const SHOW_EXTRA = ['#c9a227', '#e75480', '#2a2b30', '#f4f4f0'];

Exhibits.add({
  id: 'showroom', name: 'Showroom', section: 'cars', hint: 'Pick a car and a paint; drag to turn it', canvas: true, wide: true,
  setup(t) {
    t.k = 0; t.h = 0; t.state = 'loading'; t.turn = null; t.idle = 0; t.lights = false; t.spin = 0;
    const bar = document.createElement('div');
    bar.className = 'ex-tools bl ct-bar';
    bar.innerHTML = '<button type="button" class="ex-tool" aria-label="Previous car">&#9664;</button><span class="ct-name">Loading…</span><button type="button" class="ex-tool" aria-label="Next car">&#9654;</button>';
    t.el.appendChild(bar);
    const [prev, next] = bar.querySelectorAll('button');
    t.on(prev, 'click', () => this.pick(t, -1));
    t.on(next, 'click', () => this.pick(t, 1));
    t.label = bar.querySelector('.ct-name');
    HA.tools(t, [
      ['Lights', b => { t.lights = !t.lights; b.classList.toggle('on', t.lights); t.blip(1400, 0.02, 'square', 0.03); }],
      ['Honk', () => { t.blip(392, 0.28, 'square', 0.035); t.blip(494, 0.28, 'square', 0.035); }],
    ], 'tr');
    t.paints = document.createElement('div');
    t.paints.className = 'ex-tools br paints';
    t.el.appendChild(t.paints);
  },
  carName(type) { const n = VEHICLE_TYPES[type].name.replace(/^an? /, ''); return n[0].toUpperCase() + n.slice(1); }, // (not `name`: that's the piece's own)
  pick(t, d) {
    if (t.state !== 'ready') return;
    t.k = (t.k + d + SHOW_TYPES.length) % SHOW_TYPES.length;
    this.fresh(t);
    t.blip(620, 0.04, 'square', 0.03);
  },
  fresh(t, base) {
    const type = SHOW_TYPES[t.k];
    t.car = Cars.make(type, base || null, SHOW_TURN[t.h]);
    t.state = 'ready';
    t.label.textContent = this.carName(type);
    // the paint pots for this car
    t.paints.innerHTML = '';
    const cols = [...new Set([...(VEHICLE_TYPES[type].colors || []).slice(0, 5), ...SHOW_EXTRA])];
    for (const col of cols) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ex-tool swatch' + (col === t.car.base ? ' on' : ''); b.style.background = col;
      b.setAttribute('aria-label', 'Paint ' + col);
      t.on(b, 'click', () => { this.fresh(t, col); t.noise(0.25, 0.04, 3000, 'highpass'); });
      t.paints.appendChild(b);
    }
  },
  turnCar(t, dir) {
    if (!t.car || t.turn) return;
    t.turn = { k: 0, dir, swapped: false };
    t.blip(300, 0.06, 'sine', 0.03);
  },
  down(t, e) { if (e && e.target.closest && e.target.closest('button')) return; t.idle = 0; t.dragX = t.p.x; },
  move(t) {
    if (!t.p.down || t.dragX === undefined) return;
    t.idle = 0;
    const dx = t.p.x - t.dragX;
    if (Math.abs(dx) > 46) { this.turnCar(t, dx > 0 ? 1 : -1); t.dragX = t.p.x; }
  },
  up(t) { t.dragX = undefined; },
  frame(t, dt, time) {
    const c = t.c;
    if (t.state === 'loading' && !t.asked && (t.visible || t.big)) {
      t.asked = true;
      HA.loadCars().then(() => { if (!t.dead) this.fresh(t); }).catch(() => { t.state = 'failed'; t.label.textContent = 'No cars today'; });
    }
    t.idle += dt;
    if (t.state === 'ready' && t.idle > 4) { t.idle = 1.6; this.turnCar(t, 1); }
    if (t.turn) {
      t.turn.k += dt / 0.34;
      if (t.turn.k >= 0.5 && !t.turn.swapped) { t.turn.swapped = true; t.h = (t.h + t.turn.dir + 4) % 4; t.car.heading = SHOW_TURN[t.h]; }
      if (t.turn.k >= 1) t.turn = null;
    }
    t.spin += dt * 0.6;
    // the room and its spotlights (drawn once for this size)
    const ground = t.H * (t.W < 520 ? 0.6 : 0.7), cx = t.W / 2; // (narrow: up a little, clear of the paints)
    if (!t.room || t.room.width !== Math.round(t.W * t.dpr) || t.room.height !== Math.round(t.H * t.dpr)) {
      const room = t.room || (t.room = document.createElement('canvas'));
      room.width = Math.round(t.W * t.dpr); room.height = Math.round(t.H * t.dpr);
      const g = room.getContext('2d');
      g.scale(t.dpr, t.dpr);
      const bg = g.createLinearGradient(0, 0, 0, t.H);
      bg.addColorStop(0, '#191726'); bg.addColorStop(0.62, '#2c2840'); bg.addColorStop(0.63, '#1b1a24'); bg.addColorStop(1, '#0e0d14');
      g.fillStyle = bg; g.fillRect(0, 0, t.W, t.H);
      g.globalCompositeOperation = 'lighter';
      for (const sx of [0.2, 0.8]) {
        const sg = g.createLinearGradient(0, 0, 0, ground);
        sg.addColorStop(0, 'rgba(255,240,210,0.0)'); sg.addColorStop(1, 'rgba(255,240,210,0.12)');
        g.fillStyle = sg; g.beginPath(); g.moveTo(t.W * sx - 6, 0); g.lineTo(t.W * sx + 6, 0); g.lineTo(cx + (sx < 0.5 ? 40 : 90), ground); g.lineTo(cx - (sx < 0.5 ? 90 : 40), ground); g.closePath(); g.fill();
      }
    }
    c.drawImage(t.room, 0, 0, t.W, t.H);
    c.font = `900 ${Math.round(HA.clamp(t.W / 26, 12, 30))}px ${UI}`; c.textAlign = 'center';
    c.fillStyle = '#ff4fe0'; c.globalAlpha = 0.85 + 0.15 * Math.sin(time * 7) * Math.sin(time * 3);
    c.fillText('SHOWROOM', t.W / 2, t.H * 0.14);
    c.globalAlpha = 1;
    if (t.state !== 'ready') {
      c.fillStyle = '#f7f7f2'; c.font = `800 14px ${UI}`;
      c.fillText(t.state === 'failed' ? 'The cars could not be loaded' : 'Loading the cars…', cx, ground);
      return;
    }
    const car = t.car, T = VEHICLE_TYPES[car.type];
    const s = HA.clamp(Math.min((t.W * 0.42) / (2.8 * TILE), (t.H * 0.36) / (1.8 * TILE * GY)), 0.6, 3.4);
    // the turntable
    const rx = Math.max(car.len * 0.62, 1.1 * TILE) * s + 10, ry = rx * GY;
    c.fillStyle = '#3d3a4f'; c.beginPath(); c.ellipse(cx, ground + 6, rx, ry, 0, 0, HA.TAU); c.fill();
    c.fillStyle = '#5b5772'; c.beginPath(); c.ellipse(cx, ground, rx, ry, 0, 0, HA.TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) { const a = t.spin + (k * Math.PI) / 3; c.beginPath(); c.moveTo(cx, ground); c.lineTo(cx + Math.cos(a) * rx, ground + Math.sin(a) * ry); c.stroke(); }
    // the car (squashing as it swings round to its next side)
    Renderer.base = s; Renderer.dpr = t.dpr;
    const sq = t.turn ? Math.max(0.08, Math.abs(Math.cos(t.turn.k * Math.PI))) : 1;
    c.save(); c.translate(cx, ground); c.scale(s * sq, s);
    Cars.shadow(c, car, 0.7);
    Cars.draw(c, car, time);
    c.restore();
    if (t.lights && !t.turn) {
      const h = car.heading, L = (car.len / 2) * s;
      const spots = h === 'E' ? [[cx + L, ground - 8 * s]] : h === 'W' ? [[cx - L, ground - 8 * s]] : h === 'S' ? [[cx - 9 * s, ground + L * GY - 6 * s], [cx + 9 * s, ground + L * GY - 6 * s]] : [];
      c.globalCompositeOperation = 'lighter';
      for (const [x, y] of spots) {
        const g = c.createRadialGradient(x, y, 0, x, y, 34 * s * 0.6 + 10);
        g.addColorStop(0, 'rgba(255,250,220,0.85)'); g.addColorStop(1, 'rgba(255,250,220,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 34 * s * 0.6 + 10, 0, HA.TAU); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    // the card on the stand
    c.textAlign = 'left'; c.fillStyle = '#f7f7f2'; c.font = `900 ${Math.round(HA.clamp(t.W / 40, 11, 18))}px ${UI}`;
    c.fillText(this.carName(car.type).toUpperCase(), 12, 24);
    c.font = `800 ${Math.round(HA.clamp(t.W / 60, 9, 13))}px ${UI}`; c.fillStyle = 'rgba(247,247,242,0.7)';
    c.fillText(`TOP SPEED ${Math.round((160 * (T.speed || 1)) / 10) * 10} KM/H${T.lux ? ' · LUXURY' : ''}`, 12, 42);
  },
});

// ---- Car Wash -------------------------------------------------------------------------
const WASH_TYPES = ['sedan', 'small', 'sports', 'taxi', 'pickup', 'van', 'elfer', 'elferClassic', 'toroV12', 'rossoF8', 'veloce', 'regent', 'gelande', 'police', 'bus'];

Exhibits.add({
  id: 'carwash', name: 'Car Wash', section: 'cars', hint: 'Scrub the mud off', canvas: true, wide: true,
  setup(t) { t.state = 'loading'; t.foam = []; t.sparkles = []; t.scrubT = 0; t.brush = 0; t.washed = 0; t.k = Math.floor(Math.random() * WASH_TYPES.length); t.checkT = 0; },
  resize(t) { if (t.state !== 'loading' && t.state !== 'failed') this.next(t, true); },
  geo(t, car) {
    const s = HA.clamp(Math.min((t.W * 0.55) / car.len, (t.H * 0.55) / (1.2 * TILE)), 0.7, 4.5);
    return { s, ground: t.H * 0.74, cx: t.W / 2 };
  },
  // the next car rolls in, filthy
  next(t, same) {
    if (!same) t.k = (t.k + 1 + Math.floor(Math.random() * (WASH_TYPES.length - 1))) % WASH_TYPES.length;
    const car = t.car = Cars.make(WASH_TYPES[t.k], null, 'E'), G = this.geo(t, car);
    // its outline, to keep the mud on the car
    const sil = document.createElement('canvas');
    sil.width = t.W; sil.height = t.H;
    const sc = sil.getContext('2d');
    Renderer.base = G.s; Renderer.dpr = 1;
    sc.translate(G.cx, G.ground); sc.scale(G.s, G.s); Cars.draw(sc, car, 0);
    const mud = t.mud || (t.mud = document.createElement('canvas'));
    mud.width = t.W; mud.height = t.H;
    const m = t.mc = mud.getContext('2d');
    const x0 = G.cx - (car.len / 2) * G.s, x1 = G.cx + (car.len / 2) * G.s, top = G.ground - 50 * G.s, bot = G.ground + 16 * G.s;
    t.box = [x0 - 4, top, x1 - x0 + 8, bot - top];
    for (let i = 0; i < (t.low ? 60 : 130); i++) {
      const x = HA.rand(x0, x1), y = HA.lerp(top, bot, Math.pow(Math.random(), 0.6)), r = HA.rand(4, 16) * G.s * 0.5 + 3;
      m.fillStyle = ['rgba(107,74,43,0.95)', 'rgba(125,90,54,0.9)', 'rgba(90,61,34,0.95)'][i % 3];
      m.beginPath(); m.ellipse(x, y, r, r * HA.rand(0.5, 0.9), Math.random() * 3, 0, HA.TAU); m.fill();
    }
    m.fillStyle = 'rgba(90,61,34,0.9)';
    for (let i = 0; i < 160; i++) m.fillRect(HA.rand(x0, x1), HA.rand(top, bot), HA.rand(1, 3), HA.rand(1, 3));
    m.globalCompositeOperation = 'destination-in';
    m.drawImage(sil, 0, 0);
    m.globalCompositeOperation = 'source-over';
    t.sample = t.sample || document.createElement('canvas');
    t.sample.width = 48; t.sample.height = 20;
    t.mud0 = this.dirt(t);
    t.x = same ? 0 : -t.W * 0.75; t.v = 0;
    t.state = same ? 'dirty' : 'in';
  },
  // how much mud is left (an average over a tiny copy of it)
  dirt(t) {
    const g = t.sample.getContext('2d', { willReadFrequently: true }), [bx, by, bw, bh] = t.box;
    g.clearRect(0, 0, 48, 20);
    g.drawImage(t.mud, bx, by, bw, bh, 0, 0, 48, 20);
    const d = g.getImageData(0, 0, 48, 20).data;
    let a = 0;
    for (let i = 3; i < d.length; i += 4) a += d[i];
    return a;
  },
  scrub(t, x, y) {
    const r = HA.clamp(Math.min(t.W, t.H) * 0.07, 12, 34), m = t.mc, g = m.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    m.globalCompositeOperation = 'destination-out';
    m.fillStyle = g; m.fillRect(x - r, y - r, r * 2, r * 2);
    m.globalCompositeOperation = 'source-over';
    if (t.foam.length < (t.low ? 60 : 140)) t.foam.push({ x: x + HA.rand(-r, r) * 0.6, y: y + HA.rand(-r, r) * 0.6, r: HA.rand(2, 6), life: HA.rand(0.8, 1.8), vy: HA.rand(5, 25) });
  },
  down(t) { if (t.state === 'dirty') { t.scrubbing = true; this.scrub(t, t.p.x, t.p.y); } },
  move(t) {
    if (!t.scrubbing || !t.p.down || t.state !== 'dirty') return;
    const d = Math.hypot(t.p.vx, t.p.vy), n = Math.max(1, Math.ceil(d / 8));
    for (let k = 0; k < n; k++) this.scrub(t, t.p.x - t.p.vx * (k / n), t.p.y - t.p.vy * (k / n));
    t.scrubT -= 1 / 60;
    if (t.scrubT <= 0) { t.scrubT = 0.12; t.noise(0.12, 0.05, 2200, 'bandpass'); }
  },
  up(t) { t.scrubbing = false; },
  frame(t, dt, time) {
    const c = t.c;
    if (t.state === 'loading' && !t.asked && (t.visible || t.big)) {
      t.asked = true;
      HA.loadCars().then(() => { if (!t.dead) this.next(t); }).catch(() => { t.state = 'failed'; });
    }
    // the bay (drawn once for this size)
    if (!t.bay || t.bay.width !== Math.round(t.W * t.dpr) || t.bay.height !== Math.round(t.H * t.dpr)) {
      const bay = t.bay || (t.bay = document.createElement('canvas'));
      bay.width = Math.round(t.W * t.dpr); bay.height = Math.round(t.H * t.dpr);
      const g = bay.getContext('2d');
      g.scale(t.dpr, t.dpr);
      const wall = g.createLinearGradient(0, 0, 0, t.H);
      wall.addColorStop(0, '#1b4965'); wall.addColorStop(0.74, '#2a6f97'); wall.addColorStop(0.741, '#3a3d44'); wall.addColorStop(1, '#2b2e34');
      g.fillStyle = wall; g.fillRect(0, 0, t.W, t.H);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      for (let x = 0; x < t.W; x += 26) g.fillRect(x, 0, 1.5, t.H * 0.74);
      for (let y = 0; y < t.H * 0.74; y += 26) g.fillRect(0, y, t.W, 1.5);
      g.fillStyle = '#ffd23f'; g.font = `900 ${Math.round(HA.clamp(t.W / 30, 12, 26))}px ${UI}`; g.textAlign = 'center';
      g.fillText('CAR WASH', t.W / 2, t.H * 0.12);
    }
    c.drawImage(t.bay, 0, 0, t.W, t.H);
    c.textAlign = 'right'; c.font = `800 11px ${UI}`; c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText(`WASHED ${t.washed}`, t.W - 10, 18);
    // the big spinning brushes at the sides
    t.brush += dt * (t.scrubbing ? 14 : 3);
    for (const bx of [t.W * 0.05, t.W * 0.95]) {
      const bw = Math.max(16, t.W * 0.05), bh = t.H * 0.62, by = t.H * 0.12;
      c.fillStyle = '#2f6fd1'; c.fillRect(bx - bw / 2, by, bw, bh);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      for (let k = 0; k < 6; k++) { const y = by + (((t.brush * 20 + k * (bh / 6)) % bh)); c.fillRect(bx - bw / 2, y, bw, 3); }
    }
    if (t.state === 'loading' || t.state === 'failed' || !t.car) {
      c.textAlign = 'center'; c.fillStyle = '#f7f7f2'; c.font = `800 14px ${UI}`;
      c.fillText(t.state === 'failed' ? 'The cars could not be loaded' : 'Loading the cars…', t.W / 2, t.H * 0.55);
      return;
    }
    const car = t.car, G = this.geo(t, car);
    if (t.state === 'in') { t.x = Math.min(0, t.x + dt * t.W * 0.9 * Math.max(0.15, -t.x / (t.W * 0.75))); if (t.x >= -0.5) { t.x = 0; t.state = 'dirty'; } }
    else if (t.state === 'out') { t.v += dt * t.W * 1.5; t.x += t.v * dt; if (t.x > t.W) this.next(t); }
    else if (t.state === 'clean') { t.cleanT -= dt; if (t.cleanT <= 0) { t.state = 'out'; t.v = 0; t.blip(160, 0.4, 'sawtooth', 0.04, 2); } }
    else if (t.state === 'dirty') {
      t.checkT -= dt;
      if (t.checkT <= 0) {
        t.checkT = 0.3;
        if (this.dirt(t) < t.mud0 * 0.05) {
          t.state = 'clean'; t.cleanT = 2.2; t.washed++;
          t.mc.clearRect(0, 0, t.W, t.H);
          const [bx, by, bw, bh] = t.box;
          for (let i = 0; i < 14; i++) t.sparkles.push({ x: bx + Math.random() * bw, y: by + Math.random() * bh * 0.7, life: HA.rand(0.8, 2), ph: Math.random() * 6 });
          [784, 988, 1319].forEach((f, i) => t.later(() => t.blip(f, 0.2, 'triangle', 0.06), i * 100));
        }
      }
    }
    // the car and its mud
    Renderer.base = G.s; Renderer.dpr = t.dpr;
    c.save(); c.translate(G.cx + t.x, G.ground); c.scale(G.s, G.s);
    Cars.shadow(c, car, 0.8);
    Cars.draw(c, car, time);
    c.restore();
    const [bx, by, bw, bh] = t.box; // (only the patch the car is in)
    c.drawImage(t.mud, bx, by, bw, bh, bx + t.x, by, bw, bh);
    // foam and sparkle
    for (const f of t.foam) {
      f.life -= dt; f.y += f.vy * dt;
      c.fillStyle = `rgba(255,255,255,${Math.min(0.9, f.life)})`;
      c.beginPath(); c.arc(f.x + t.x, f.y, f.r, 0, HA.TAU); c.fill();
      c.strokeStyle = `rgba(160,200,255,${Math.min(0.6, f.life * 0.6)})`; c.lineWidth = 1; c.stroke();
    }
    t.foam = t.foam.filter(f => f.life > 0);
    for (const s of t.sparkles) {
      s.life -= dt; s.ph += dt * 6;
      const k = Math.max(0, Math.sin(s.ph)) * Math.min(1, s.life), r = 3 + k * 7;
      c.strokeStyle = `rgba(255,255,255,${k})`; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(s.x + t.x - r, s.y); c.lineTo(s.x + t.x + r, s.y); c.moveTo(s.x + t.x, s.y - r); c.lineTo(s.x + t.x, s.y + r); c.stroke();
    }
    t.sparkles = t.sparkles.filter(s => s.life > 0);
    if (t.state === 'clean') { c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = `900 ${Math.round(HA.clamp(t.W / 26, 14, 30))}px ${UI}`; c.fillText('SPARKLING!', t.W / 2, t.H * 0.3); }
    // the sponge
    if (t.p.inside && t.state === 'dirty') {
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#a87800'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect ? c.roundRect(t.p.x - 14, t.p.y - 9, 28, 18, 5) : c.rect(t.p.x - 14, t.p.y - 9, 28, 18); c.fill(); c.stroke();
    }
  },
});
