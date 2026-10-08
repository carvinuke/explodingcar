'use strict';
// Hall of Art: Slot Machine and Switch Panel (Living Buttons), Plasma Globe, Game of
// Life, Rainy Window and Soap Bubbles (Moving Pictures), Departure Board and Graffiti
// Wall (Lettering).

// ---- Slot Machine ---------------------------------------------------------------------
const SLOT_STRIP = ['cherry', 'lemon', 'bell', 'cherry', 'bar', 'lemon', 'seven', 'cherry', 'star', 'bell', 'lemon', 'car', 'cherry', 'bar', 'star', 'lemon'];
const SLOT_PAY = { cherry: 5, lemon: 8, bell: 12, bar: 20, star: 30, seven: 50, car: 100 };

Exhibits.add({
  id: 'slots', name: 'Slot Machine', section: 'buttons', hint: 'Pull the lever down (or press Spin)', canvas: true,
  setup(t) {
    t.coins = 20; t.parts = []; t.lever = 0; t.leverV = 0; t.grab = null; t.auto = 0;
    t.msg = 'PULL THE LEVER'; t.flash = 0; t.tickT = 0; t.bulbs = 0;
    t.reels = [0, 1, 2].map(() => ({ pos: Math.floor(Math.random() * SLOT_STRIP.length), v: 0, state: 'still' }));
    HA.tools(t, [['Spin', () => this.pull(t)]], 'br');
  },
  geo(t) {
    const lw = HA.clamp(t.W * 0.13, 34, 70), x0 = t.W * 0.06, top = t.H * 0.24;
    const w = t.W - lw - x0 * 2.2, h = Math.min(t.H * 0.5, w * 0.62);
    return { x0, top, w, h, row: h / 3, col: w / 3, lx: t.W - lw * 0.62, ly0: top - 6, len: t.H * 0.36, lw };
  },
  // the lever pulled all the way (by hand or by the Spin button) sets the reels going
  pull(t) { if (t.reels.every(r => r.state === 'still') && t.grab === null) { t.auto = 1; } },
  spin(t) {
    if (!t.reels.every(r => r.state === 'still')) return;
    if (t.coins <= 0) { t.coins = 20; }
    t.coins--;
    const lucky = Math.random() < 0.22, sym = SLOT_STRIP[Math.floor(Math.random() * SLOT_STRIP.length)];
    t.reels.forEach((r, i) => { r.state = 'spin'; r.v = 0; r.want = lucky ? sym : SLOT_STRIP[Math.floor(Math.random() * SLOT_STRIP.length)]; r.stopT = 0.8 + i * 0.45; });
    t.msg = 'GOOD LUCK!';
    t.blip(140, 0.12, 'square', 0.05, 0.6);
    t.noise(0.18, 0.05, 900);
  },
  down(t, e) {
    if (e && e.target.closest && e.target.closest('button')) return;
    const G = this.geo(t), kx = G.lx, ky = G.ly0 + G.len * (0.12 + 0.76 * t.lever);
    if (Math.hypot(t.p.x - kx, t.p.y - ky) < 30 && t.reels.every(r => r.state === 'still')) { t.grab = t.p.y - G.len * 0.76 * t.lever; return; }
    // a tap on the reels spins them too
    if (t.p.x < G.x0 + G.w && t.p.y > G.top && t.p.y < G.top + G.h) this.pull(t);
  },
  move(t) { if (t.grab !== null) { const G = this.geo(t); t.lever = HA.clamp((t.p.y - t.grab) / (G.len * 0.76), 0, 1); } },
  up(t) {
    if (t.grab === null) return;
    t.grab = null;
    if (t.lever > 0.7) this.spin(t);
  },
  frame(t, dt, time) {
    const c = t.c, G = this.geo(t), N = SLOT_STRIP.length;
    // the lever: pulled by the Spin button, or springing back after you let go
    if (t.auto > 0) {
      t.lever = Math.min(1, t.lever + dt * 5);
      if (t.lever >= 1) { t.auto = 0; this.spin(t); }
    } else if (t.grab === null) {
      t.leverV += (-t.lever * 180 - t.leverV * 14) * dt;
      t.lever = Math.max(0, t.lever + t.leverV * dt);
    }
    // the reels
    let spinning = false;
    for (const r of t.reels) {
      if (r.state === 'spin') {
        spinning = true;
        r.v = Math.min(22, r.v + dt * 60);
        r.pos += r.v * dt;
        r.stopT -= dt;
        if (r.stopT <= 0) {
          const start = Math.ceil(r.pos) + 2;
          let d = 0;
          while (d < N && SLOT_STRIP[(start + d) % N] !== r.want) d++;
          r.from = r.pos; r.to = start + d; r.k = 0; r.dur = 0.35 + (r.to - r.pos) * 0.035; r.state = 'stop';
        }
      } else if (r.state === 'stop') {
        spinning = true;
        r.k = Math.min(1, r.k + dt / r.dur);
        const k = r.k - 1, e = 1 + 2.2 * k * k * k + 1.2 * k * k; // ease out with a little bounce
        r.pos = r.from + (r.to - r.from) * e;
        if (r.k >= 1) {
          r.pos = r.to % N; r.state = 'still';
          t.blip(180, 0.07, 'square', 0.05, 0.5);
          if (t.reels.every(q => q.state === 'still')) this.score(t);
        }
      }
    }
    if (spinning) { t.tickT -= dt; if (t.tickT <= 0) { t.tickT = 0.07; t.blip(1400, 0.015, 'square', 0.012); } }
    t.flash = Math.max(0, t.flash - dt);
    t.bulbs += dt * (t.flash > 0 ? 14 : 3);

    // the cabinet
    const bg = c.createLinearGradient(0, 0, 0, t.H);
    bg.addColorStop(0, '#9b1626'); bg.addColorStop(1, '#5a0a14');
    c.fillStyle = bg; c.fillRect(0, 0, t.W, t.H);
    // marquee and its chasing bulbs
    c.fillStyle = '#2a0610'; c.fillRect(G.x0, 6, G.w, G.top - 16);
    c.fillStyle = '#ffd23f'; c.font = `900 ${Math.round(HA.clamp((G.top - 16) * 0.62, 10, 40))}px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('LUCKY  7', G.x0 + G.w / 2, 6 + (G.top - 16) / 2 + 1);
    const nb = Math.max(8, Math.floor(G.w / 18));
    for (let i = 0; i < nb; i++) {
      const on = (Math.floor(t.bulbs) + i) % 3 === 0;
      c.fillStyle = on ? '#fff3b0' : '#7a4a10';
      c.beginPath(); c.arc(G.x0 + (i + 0.5) * (G.w / nb), G.top - 6, 2.4, 0, HA.TAU); c.fill();
    }
    // reel window
    c.fillStyle = '#c9cdd4'; c.fillRect(G.x0 - 5, G.top - 1, G.w + 10, G.h + 10);
    for (let i = 0; i < 3; i++) {
      const x = G.x0 + i * G.col, r = t.reels[i];
      c.save();
      c.beginPath(); c.rect(x + 2, G.top + 4, G.col - 4, G.h); c.clip();
      const g = c.createLinearGradient(0, G.top, 0, G.top + G.h);
      g.addColorStop(0, '#9aa0a8'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#9aa0a8');
      c.fillStyle = g; c.fillRect(x, G.top, G.col, G.h + 8);
      const base = Math.floor(r.pos);
      for (let k = -2; k <= 2; k++) {
        const idx = base - k, y = G.top + 4 + G.h / 2 + (r.pos - idx) * G.row;
        this.symbol(c, SLOT_STRIP[((idx % N) + N) % N], x + G.col / 2, y, Math.min(G.col * 0.6, G.row * 0.82), r.state === 'spin' && r.v > 12);
      }
      c.restore();
    }
    // the pay line
    c.fillStyle = t.flash > 0 && Math.floor(time * 12) % 2 ? '#ffd23f' : 'rgba(255,40,60,0.75)';
    c.fillRect(G.x0 - 5, G.top + 4 + G.h / 2 - 1, G.w + 10, 2);
    // coins and message
    c.fillStyle = '#16181c'; c.fillRect(G.x0, G.top + G.h + 14, G.w, Math.max(18, t.H - (G.top + G.h + 22)));
    const fs = Math.round(HA.clamp(t.H * 0.07, 10, 26));
    c.font = `900 ${fs}px ${UI}`; c.textBaseline = 'middle';
    const my = G.top + G.h + 14 + Math.max(18, t.H - (G.top + G.h + 22)) / 2;
    c.textAlign = 'left'; c.fillStyle = '#ff5a4a'; c.fillText(`COINS ${t.coins}`, G.x0 + 8, my);
    c.textAlign = 'right'; c.fillStyle = t.flash > 0 ? '#ffd23f' : '#f7f7f2'; c.fillText(t.msg, G.x0 + G.w - 8, my);
    // the lever
    const kx = G.lx, ky = G.ly0 + G.len * (0.12 + 0.76 * t.lever);
    c.fillStyle = '#3a3d44'; c.fillRect(kx - 6, G.ly0 + G.len * 0.5, 12, G.len * 0.5);
    c.strokeStyle = '#d9dde3'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(kx, G.ly0 + G.len * 0.75); c.lineTo(kx, ky); c.stroke();
    const kg = c.createRadialGradient(kx - 4, ky - 4, 1, kx, ky, 11);
    kg.addColorStop(0, '#ff9a9a'); kg.addColorStop(1, '#c4001d');
    c.fillStyle = kg; c.beginPath(); c.arc(kx, ky, 11, 0, HA.TAU); c.fill();
    // coins pouring out after a win
    for (const p of t.parts) {
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.spin += dt * 8;
      c.fillStyle = '#ffcc33';
      c.beginPath(); c.ellipse(p.x, p.y, 5 * Math.abs(Math.cos(p.spin)) + 1, 5, 0, 0, HA.TAU); c.fill();
    }
    t.parts = t.parts.filter(p => p.life > 0 && p.y < t.H + 20);
    c.textBaseline = 'alphabetic';
  },
  score(t) {
    const s = t.reels.map(r => SLOT_STRIP[Math.round(r.pos) % SLOT_STRIP.length]);
    let win = 0;
    if (s[0] === s[1] && s[1] === s[2]) win = SLOT_PAY[s[0]];
    else if (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]) win = 2;
    if (!win) { t.msg = 'TRY AGAIN'; return; }
    t.coins += win;
    t.msg = win >= 50 ? `JACKPOT +${win}` : win > 2 ? `WIN +${win}` : 'PAIR +2';
    t.flash = win > 2 ? 2.2 : 0.8;
    const n = Math.min(t.low ? 20 : 50, win * 2), G = this.geo(t);
    for (let i = 0; i < n; i++) t.parts.push({ x: G.x0 + G.w / 2 + HA.rand(-20, 20), y: G.top + G.h + 16, vx: HA.rand(-160, 160), vy: HA.rand(-380, -120), life: 2.5, spin: Math.random() * 6 });
    const notes = win > 2 ? [523, 659, 784, 1047, 1319] : [659, 880];
    notes.forEach((f, i) => t.later(() => t.blip(f, 0.16, 'triangle', 0.07), i * 90));
  },
  // the reel pictures, drawn small and simple
  symbol(c, kind, x, y, s, blur) {
    c.save(); c.translate(x, y);
    if (blur) c.globalAlpha = 0.55;
    const u = s / 40;
    c.scale(u, u);
    if (kind === 'cherry') {
      c.strokeStyle = '#2f8a2f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, 4); c.quadraticCurveTo(-4, -14, 6, -16); c.moveTo(9, 6); c.quadraticCurveTo(8, -8, 6, -16); c.stroke();
      for (const [cx, cy] of [[-9, 8], [9, 10]]) { c.fillStyle = '#d0102a'; c.beginPath(); c.arc(cx, cy, 8, 0, HA.TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(cx - 3, cy - 3, 2.2, 0, HA.TAU); c.fill(); }
    } else if (kind === 'lemon') {
      c.fillStyle = '#ffd400'; c.beginPath(); c.ellipse(0, 0, 16, 11, -0.3, 0, HA.TAU); c.fill();
      c.beginPath(); c.ellipse(-15, 5, 3, 2, -0.3, 0, HA.TAU); c.ellipse(15, -5, 3, 2, -0.3, 0, HA.TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-5, -5, 5, 2.5, -0.3, 0, HA.TAU); c.fill();
    } else if (kind === 'bell') {
      c.fillStyle = '#f2b705'; c.beginPath(); c.moveTo(-15, 10); c.quadraticCurveTo(-13, -16, 0, -16); c.quadraticCurveTo(13, -16, 15, 10); c.closePath(); c.fill();
      c.fillRect(-17, 8, 34, 5); c.beginPath(); c.arc(0, 15, 4, 0, HA.TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-8, -10, 3, 16);
    } else if (kind === 'bar') {
      c.fillStyle = '#16181c'; c.fillRect(-18, -9, 36, 18);
      c.fillStyle = '#fff'; c.font = `900 13px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BAR', 0, 1);
    } else if (kind === 'seven') {
      c.font = `900 36px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = '#3a0008'; c.strokeText('7', 0, 2); c.fillStyle = '#e8102a'; c.fillText('7', 0, 2);
    } else if (kind === 'star') {
      c.fillStyle = '#ffb300'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 17; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill();
    } else if (kind === 'car') {
      c.fillStyle = '#1f6fd1'; c.beginPath(); c.moveTo(-18, 6); c.lineTo(-18, -2); c.lineTo(-9, -3); c.lineTo(-4, -11); c.lineTo(8, -11); c.lineTo(13, -3); c.lineTo(18, -1); c.lineTo(18, 6); c.closePath(); c.fill();
      c.fillStyle = '#bfe3ff'; c.fillRect(-3, -9, 6, 5); c.fillRect(4, -9, 5, 5);
      c.fillStyle = '#16181c'; for (const wx of [-10, 10]) { c.beginPath(); c.arc(wx, 7, 4.5, 0, HA.TAU); c.fill(); }
    }
    c.restore();
  },
});

// ---- Switch Panel ---------------------------------------------------------------------
// Six kinds of switch; flip them all on and the bulb lights up.
const SW_KINDS = ['toggle', 'rocker', 'slide', 'push', 'knob', 'key'];

Exhibits.add({
  id: 'switches', name: 'Switch Panel', section: 'buttons', hint: 'Flip every switch on', canvas: true,
  setup(t) {
    t.sw = SW_KINDS.map(kind => ({ kind, on: false, a: 0, knob: 0, drag: null }));
    t.glow = 0; t.allOn = false; t.hum = 0;
  },
  geo(t) {
    const bulbW = Math.min(t.W * 0.24, 120), gw = t.W - bulbW - 18, cols = 3, rows = 2;
    const cw = gw / cols, ch = (t.H - 16) / rows;
    return { bulbW, cw, ch, cols, rows, u: Math.min(cw, ch) / 100 };
  },
  cell(t, i) { const G = this.geo(t); return { x: 8 + (i % G.cols) * G.cw + G.cw / 2, y: 8 + Math.floor(i / G.cols) * G.ch + G.ch / 2, u: G.u }; },
  at(t) {
    const G = this.geo(t);
    for (let i = 0; i < t.sw.length; i++) { const C = this.cell(t, i); if (Math.abs(t.p.x - C.x) < G.cw / 2 && Math.abs(t.p.y - C.y) < G.ch / 2) return i; }
    return -1;
  },
  set(t, s, on) {
    if (s.on === on) return;
    s.on = on;
    const f = { toggle: 1800, rocker: 900, slide: 1300, push: 600, knob: 1500, key: 700 }[s.kind];
    t.blip(f, 0.03, 'square', 0.05);
    t.noise(0.04, 0.06, f * 1.5, 'bandpass');
    const all = t.sw.every(x => x.on);
    if (all && !t.allOn) [392, 523, 659, 784].forEach((n, i) => t.later(() => t.blip(n, 0.18, 'triangle', 0.06), 100 + i * 80));
    if (!all && t.allOn) t.blip(220, 0.3, 'sawtooth', 0.04, 0.5);
    t.allOn = all;
  },
  down(t) {
    const i = this.at(t);
    if (i < 0) return;
    const s = t.sw[i], C = this.cell(t, i);
    if (s.kind === 'slide') { s.drag = { x0: t.p.x, a0: s.a }; return; }
    if (s.kind === 'knob') { s.drag = { cx: C.x, cy: C.y }; this.turn(t, s); return; }
    this.set(t, s, !s.on);
  },
  move(t) {
    for (const s of t.sw) {
      if (!s.drag) continue;
      if (s.kind === 'slide') {
        const span = 46 * this.geo(t).u;
        s.a = HA.clamp(s.drag.a0 + (t.p.x - s.drag.x0) / span, 0, 1);
        this.set(t, s, s.a > 0.5);
      } else if (s.kind === 'knob') this.turn(t, s);
    }
  },
  // the knob turns through five clicks; the last two count as on
  turn(t, s) {
    const a = Math.atan2(t.p.y - s.drag.cy, t.p.x - s.drag.cx) + Math.PI / 2; // 0 = straight up
    const ang = ((a + Math.PI) % HA.TAU + HA.TAU) % HA.TAU - Math.PI;
    const k = HA.clamp(Math.round((ang + 2.36) / 1.18), 0, 4);
    if (k !== s.knob) { s.knob = k; t.blip(1200 + k * 120, 0.02, 'square', 0.04); }
    this.set(t, s, k >= 3);
  },
  up(t) {
    for (const s of t.sw) {
      if (s.drag && s.kind === 'slide') { s.a = s.on ? 1 : 0; t.blip(1000, 0.02, 'square', 0.03); }
      s.drag = null;
    }
  },
  frame(t, dt, time) {
    const c = t.c, G = this.geo(t);
    // brushed metal
    const bg = c.createLinearGradient(0, 0, t.W, t.H);
    bg.addColorStop(0, '#5d6672'); bg.addColorStop(0.5, '#808a96'); bg.addColorStop(1, '#4e5661');
    c.fillStyle = bg; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < t.H; y += 3) c.fillRect(0, y, t.W, 1);
    for (let i = 0; i < t.sw.length; i++) {
      const s = t.sw[i], C = this.cell(t, i);
      if (s.kind !== 'slide') s.a += ((s.on ? 1 : 0) - s.a) * Math.min(1, dt * 22);
      else if (!s.drag) s.a += ((s.on ? 1 : 0) - s.a) * Math.min(1, dt * 22);
      c.save(); c.translate(C.x, C.y); c.scale(C.u, C.u);
      this.draw(c, s, time);
      // its little lamp
      c.fillStyle = s.on ? '#3cff7a' : '#2a3a30';
      c.beginPath(); c.arc(0, 40, 4, 0, HA.TAU); c.fill();
      if (s.on) { c.fillStyle = 'rgba(60,255,122,0.25)'; c.beginPath(); c.arc(0, 40, 9, 0, HA.TAU); c.fill(); }
      c.restore();
    }
    // the bulb: brighter for every switch that's on, blazing when they all are
    const frac = t.sw.filter(s => s.on).length / t.sw.length;
    t.glow += ((t.allOn ? 1 : frac * 0.35) - t.glow) * Math.min(1, dt * 6);
    const bx = t.W - G.bulbW / 2 - 6, by = t.H * 0.42, br = Math.min(G.bulbW * 0.3, t.H * 0.2);
    if (t.glow > 0.05) {
      const halo = c.createRadialGradient(bx, by, 1, bx, by, br * 3.2);
      halo.addColorStop(0, `rgba(255,220,120,${0.6 * t.glow})`); halo.addColorStop(1, 'rgba(255,220,120,0)');
      c.fillStyle = halo; c.fillRect(bx - br * 3.2, by - br * 3.2, br * 6.4, br * 6.4);
    }
    const flick = t.allOn ? 0.92 + 0.08 * Math.sin(time * 37) : 1;
    c.fillStyle = `rgba(${Math.round(180 + 75 * t.glow)},${Math.round(180 + 60 * t.glow)},${Math.round(170 - 40 * t.glow)},${0.55 + 0.45 * t.glow * flick})`;
    c.beginPath(); c.arc(bx, by, br, 0, HA.TAU); c.fill();
    c.strokeStyle = t.glow > 0.5 ? '#fff6c8' : '#c8bfa8'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(bx - br * 0.35, by + br * 0.2); c.lineTo(bx - br * 0.15, by - br * 0.25); c.lineTo(bx, by + br * 0.1); c.lineTo(bx + br * 0.15, by - br * 0.25); c.lineTo(bx + br * 0.35, by + br * 0.2); c.stroke();
    c.fillStyle = '#9aa0a8'; c.fillRect(bx - br * 0.45, by + br * 0.85, br * 0.9, br * 0.5);
    c.fillStyle = '#6b7079'; for (let k = 0; k < 3; k++) c.fillRect(bx - br * 0.45, by + br * (0.95 + k * 0.14), br * 0.9, 1.5);
    c.font = `900 ${Math.round(HA.clamp(t.W / 34, 9, 16))}px ${UI}`; c.textAlign = 'center';
    c.fillStyle = t.allOn ? '#ffe9a0' : 'rgba(255,255,255,0.55)';
    c.fillText(t.allOn ? 'ALL ON!' : `${Math.round(frac * t.sw.length)} / ${t.sw.length}`, bx, by + br * 1.9);
  },
  draw(c, s, time) {
    const a = s.a;
    if (s.kind === 'toggle') {
      c.fillStyle = '#2b2f36'; c.beginPath(); c.arc(0, 0, 18, 0, HA.TAU); c.fill();
      c.fillStyle = '#c9cdd4'; c.beginPath(); c.arc(0, 0, 11, 0, HA.TAU); c.fill();
      // seen face on, the lever tips from down (off) to up (on), pointing at you on the way
      const ty = HA.lerp(20, -20, a);
      c.strokeStyle = '#e8ebef'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, ty); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, ty, 5.5, 0, HA.TAU); c.fill();
      c.fillStyle = '#16181c'; c.font = `900 9px ${UI}`; c.textAlign = 'center'; c.fillText('ON', 0, -26); c.fillText('OFF', 0, 33);
    } else if (s.kind === 'rocker') {
      c.fillStyle = '#16181c'; c.fillRect(-20, -26, 40, 52);
      const tilt = HA.lerp(-1, 1, a);
      c.fillStyle = s.on ? '#e8102a' : '#7a0a16'; c.fillRect(-15, -22, 30, 44);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-15, tilt > 0 ? -22 : 0, 30, 22);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-15, tilt > 0 ? 0 : -22, 30, 22);
      c.fillStyle = '#fff'; c.font = `900 11px ${UI}`; c.textAlign = 'center'; c.fillText('I', 0, -8); c.fillText('O', 0, 16);
    } else if (s.kind === 'slide') {
      c.fillStyle = '#16181c'; c.fillRect(-32, -9, 64, 18);
      c.fillStyle = s.on ? '#3d9bff' : '#4a5260'; c.fillRect(-30, -7, (a * 60) + 2, 14);
      const kx = -23 + a * 46;
      c.fillStyle = '#eef1f5'; c.fillRect(kx - 9, -14, 18, 28);
      c.fillStyle = '#9aa0a8'; for (let k = -1; k <= 1; k++) c.fillRect(kx + k * 4 - 0.75, -9, 1.5, 18);
      c.fillStyle = '#16181c'; c.font = `900 9px ${UI}`; c.textAlign = 'center'; c.fillText('SLIDE', 0, -20);
    } else if (s.kind === 'push') {
      c.fillStyle = '#16181c'; c.beginPath(); c.arc(0, 0, 22, 0, HA.TAU); c.fill();
      const depth = a * 4;
      c.fillStyle = s.on ? '#ffb000' : '#c98a00';
      c.beginPath(); c.arc(0, depth, 17, 0, HA.TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(-5, depth - 5, 6, 0, HA.TAU); c.fill();
      if (s.on) { c.strokeStyle = 'rgba(255,200,60,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 25, 0, HA.TAU); c.stroke(); }
    } else if (s.kind === 'knob') {
      for (let k = 0; k <= 4; k++) { const ang = -2.36 + k * 1.18 - Math.PI / 2; c.fillStyle = k <= s.knob ? (k >= 3 ? '#3cff7a' : '#ffd23f') : '#2a2d33'; c.beginPath(); c.arc(Math.cos(ang) * 28, Math.sin(ang) * 28, 3, 0, HA.TAU); c.fill(); }
      const g = c.createRadialGradient(-5, -5, 2, 0, 0, 20);
      g.addColorStop(0, '#5d6672'); g.addColorStop(1, '#1c1f24');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 20, 0, HA.TAU); c.fill();
      const ang = -2.36 + s.knob * 1.18 - Math.PI / 2;
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 6); c.lineTo(Math.cos(ang) * 17, Math.sin(ang) * 17); c.stroke();
    } else if (s.kind === 'key') {
      c.fillStyle = '#c9a227'; c.beginPath(); c.arc(0, 0, 20, 0, HA.TAU); c.fill();
      c.fillStyle = '#8a6a10'; c.beginPath(); c.arc(0, 0, 15, 0, HA.TAU); c.fill();
      c.save(); c.rotate(a * Math.PI / 2);
      c.fillStyle = '#e8ebef'; c.fillRect(-3, -16, 6, 32);
      c.beginPath(); c.arc(0, -16, 8, 0, HA.TAU); c.fill();
      c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(0, -16, 3, 0, HA.TAU); c.fill();
      c.restore();
      c.fillStyle = '#16181c'; c.font = `900 9px ${UI}`; c.textAlign = 'center'; c.fillText('OFF', -24, -18); c.fillText('ON', 26, 4);
    }
  },
});

// ---- Plasma Globe ---------------------------------------------------------------------
Exhibits.add({
  id: 'plasma', name: 'Plasma Globe', section: 'motion', hint: 'Touch the glass', canvas: true,
  setup(t) {
    t.el.classList.add('dark');
    const n = t.low ? 6 : 9;
    t.arcs = Array.from({ length: n }, (_, i) => ({ a: (i / n) * HA.TAU + HA.rand(-0.3, 0.3), drift: HA.rand(-0.6, 0.6), seed: Math.random() * 100, hue: HA.rand(270, 320) }));
    t.zapT = 0;
  },
  frame(t, dt, time) {
    const c = t.c, cx = t.W / 2, cy = t.H * 0.46, R = Math.min(t.W * 0.4, t.H * 0.4);
    c.fillStyle = '#07060c'; c.fillRect(0, 0, t.W, t.H);
    // the base
    c.fillStyle = '#1c1b22'; c.beginPath(); c.moveTo(cx - R * 0.55, t.H); c.lineTo(cx - R * 0.35, cy + R * 0.9); c.lineTo(cx + R * 0.35, cy + R * 0.9); c.lineTo(cx + R * 0.55, t.H); c.closePath(); c.fill();
    // inside the glass
    const inner = c.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
    inner.addColorStop(0, 'rgba(120,40,160,0.35)'); inner.addColorStop(1, 'rgba(20,8,40,0.6)');
    c.fillStyle = inner; c.beginPath(); c.arc(cx, cy, R, 0, HA.TAU); c.fill();
    // where's the finger? on (or near) the glass, the arcs reach for it
    const dx = t.p.x - cx, dy = t.p.y - cy, d = Math.hypot(dx, dy), touching = t.p.inside && d < R * 1.25 && d > R * 0.2;
    const ta = Math.atan2(dy, dx);
    let near = [];
    if (touching) near = t.arcs.map((A, i) => [Math.abs(Math.atan2(Math.sin(A.a - ta), Math.cos(A.a - ta))), i]).sort((p, q) => p[0] - q[0]).slice(0, t.p.down ? 3 : 2).map(p => p[1]);
    if (touching && t.p.down) { t.zapT -= dt; if (t.zapT <= 0) { t.zapT = HA.rand(0.04, 0.14); t.noise(0.05, 0.035, 4200, 'highpass'); } }
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round'; c.lineCap = 'round';
    t.arcs.forEach((A, i) => {
      const grab = near.includes(i);
      if (grab) A.a += Math.atan2(Math.sin(ta - A.a), Math.cos(ta - A.a)) * Math.min(1, dt * 14);
      else A.a += (A.drift + (HA.noise(time * 0.4, A.seed) - 0.5) * 2.4) * dt;
      const ex = cx + Math.cos(A.a) * R * 0.97, ey = cy + Math.sin(A.a) * R * 0.97;
      const M = t.low ? 8 : 12, pts = [];
      const nx = -(ey - cy) / R, ny = (ex - cx) / R;
      for (let k = 0; k <= M; k++) {
        const u = k / M, env = Math.sin(Math.PI * u);
        const off = ((HA.noise(time * 3 + A.seed, k * 0.6) - 0.5) * 0.5 + (Math.random() - 0.5) * 0.08) * R * env * (grab ? 0.6 : 1);
        pts.push([cx + (ex - cx) * u + nx * off, cy + (ey - cy) * u + ny * off]);
      }
      const passes = t.low ? [[2.2, 0.85]] : [[9, 0.07], [4, 0.2], [1.6, 0.9]];
      for (const [w, al] of passes) {
        c.strokeStyle = HA.hsl(grab ? A.hue - 40 : A.hue, 95, w < 2 ? 85 : 60, al * (grab ? 1.3 : 1));
        c.lineWidth = w * (grab ? 1.5 : 1);
        c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      }
      // where it touches the glass
      const g = c.createRadialGradient(ex, ey, 0, ex, ey, grab ? 26 : 12);
      g.addColorStop(0, HA.hsl(A.hue, 90, 75, grab ? 0.8 : 0.45)); g.addColorStop(1, HA.hsl(A.hue, 90, 50, 0));
      c.fillStyle = g; c.fillRect(ex - 26, ey - 26, 52, 52);
    });
    // the electrode
    const core = c.createRadialGradient(cx, cy, 1, cx, cy, R * 0.16);
    core.addColorStop(0, 'rgba(255,240,255,0.95)'); core.addColorStop(0.4, 'rgba(220,120,255,0.7)'); core.addColorStop(1, 'rgba(120,40,200,0)');
    c.fillStyle = core; c.beginPath(); c.arc(cx, cy, R * 0.16, 0, HA.TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
    // the glass
    c.strokeStyle = 'rgba(200,190,255,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, 0, HA.TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = R * 0.06;
    c.beginPath(); c.arc(cx, cy, R * 0.86, -2.6, -1.9); c.stroke();
  },
});

// ---- Game of Life ---------------------------------------------------------------------
Exhibits.add({
  id: 'life', name: 'Game of Life', section: 'motion', hint: 'Draw living cells and watch them grow', canvas: true,
  setup(t) {
    t.run = true; t.acc = 0; t.gen = 0; t.idle = 0;
    const [pause] = HA.tools(t, [
      ['Pause', b => { t.run = !t.run; b.textContent = t.run ? 'Pause' : 'Play'; b.classList.toggle('on', !t.run); }],
      ['Random', () => this.seed(t)],
      ['Clear', () => { t.cells.fill(0); t.age.fill(0); t.idle = -6; }],
    ], 'tl');
    t.pauseBtn = pause;
    this.make(t);
  },
  resize(t) { this.make(t); },
  make(t) {
    t.cs = (t.big ? 9 : 7) + (t.low ? 3 : 0);
    t.cols = Math.max(8, Math.floor(t.W / t.cs)); t.rows = Math.max(6, Math.floor(t.H / t.cs));
    t.cells = new Uint8Array(t.cols * t.rows); t.next = new Uint8Array(t.cols * t.rows);
    t.age = new Float32Array(t.cols * t.rows); t.trail = new Float32Array(t.cols * t.rows);
    this.seed(t);
  },
  seed(t) {
    for (let i = 0; i < t.cells.length; i++) { t.cells[i] = Math.random() < 0.22 ? 1 : 0; t.age[i] = 0; }
    // and a few gliders heading off
    for (let g = 0; g < 3; g++) this.stamp(t, Math.floor(Math.random() * t.cols), Math.floor(Math.random() * t.rows), [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]);
    t.hist = []; t.idle = 0;
  },
  stamp(t, x, y, shape) { for (const [dx, dy] of shape) t.cells[((y + dy) % t.rows) * t.cols + ((x + dx) % t.cols)] = 1; },
  step(t) {
    const W = t.cols, H = t.rows, a = t.cells, b = t.next;
    let pop = 0, hash = 0;
    for (let y = 0; y < H; y++) {
      const ym = ((y - 1 + H) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const xm = (x - 1 + W) % W, xp = (x + 1) % W;
        const n = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        const i = y0 + x, alive = a[i] ? n === 2 || n === 3 : n === 3;
        b[i] = alive ? 1 : 0;
        if (alive) { pop++; hash = (hash * 31 + i) | 0; t.age[i] = a[i] ? t.age[i] + 1 : 0; }
        else if (a[i]) t.trail[i] = 1;
      }
    }
    t.cells = b; t.next = a; t.gen++;
    // a world that's died out or stuck in a loop starts again (unless you're drawing)
    t.hist.push(hash); if (t.hist.length > 30) t.hist.shift();
    const loop = t.hist.filter(h => h === hash).length > 3;
    if ((pop < t.cells.length * 0.015 || loop) && t.idle > 4) this.seed(t);
  },
  paint(t) {
    const steps = Math.max(1, Math.ceil(Math.hypot(t.p.vx, t.p.vy) / (t.cs * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const x = Math.floor((t.p.x - t.p.vx * (s / steps)) / t.cs), y = Math.floor((t.p.y - t.p.vy * (s / steps)) / t.cs);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < t.cols && cy < t.rows) { t.cells[cy * t.cols + cx] = 1; t.age[cy * t.cols + cx] = 0; }
      }
    }
  },
  down(t, e) { if (e && e.target.closest && e.target.closest('button')) return; t.drawing = true; this.paint(t); t.blip(500, 0.03, 'sine', 0.03); },
  move(t) { if (t.drawing && t.p.down) this.paint(t); },
  up(t) { t.drawing = false; },
  frame(t, dt) {
    t.idle = t.drawing ? 0 : t.idle + dt;
    if (t.run) { t.acc += dt; const every = 0.1; while (t.acc > every) { t.acc -= every; this.step(t); } }
    const c = t.c, s = t.cs;
    c.fillStyle = '#0c0f1a'; c.fillRect(0, 0, t.W, t.H);
    for (let i = 0; i < t.cells.length; i++) {
      const x = (i % t.cols) * s, y = Math.floor(i / t.cols) * s;
      if (t.cells[i]) {
        const a = Math.min(40, t.age[i]);
        c.fillStyle = `hsl(${185 + a * 3},90%,${66 - a * 0.5}%)`;
        c.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
      } else if (t.trail[i] > 0.02) {
        t.trail[i] *= Math.exp(-dt * 3);
        c.fillStyle = `rgba(120,80,220,${t.trail[i] * 0.4})`;
        c.fillRect(x + 1, y + 1, s - 2, s - 2);
      }
    }
  },
});

// ---- Rainy Window ---------------------------------------------------------------------
Exhibits.add({
  id: 'window', name: 'Rainy Window', section: 'motion', hint: 'Wipe the steamed-up glass', canvas: true,
  setup(t) { t.drops = []; t.refogT = 0; this.make(t); },
  resize(t) { this.make(t); },
  make(t) {
    // the city at night, out of focus (drawn once)
    const bg = t.bg || (t.bg = document.createElement('canvas'));
    bg.width = t.W; bg.height = t.H;
    const g = bg.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, t.H);
    sky.addColorStop(0, '#0d1430'); sky.addColorStop(1, '#2a1d3c');
    g.fillStyle = sky; g.fillRect(0, 0, t.W, t.H);
    const cols = ['255,190,90', '255,120,80', '120,200,255', '255,230,160', '200,120,255', '255,90,140'];
    for (let i = 0; i < (t.low ? 26 : 50); i++) {
      const x = Math.random() * t.W, y = t.H * (0.35 + Math.random() * 0.65), r = HA.rand(6, 26), col = cols[i % cols.length];
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},0.55)`); rg.addColorStop(0.7, `rgba(${col},0.25)`); rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // the condensation, at a low resolution (it's soft anyway)
    t.fs = t.low ? 5 : 3;
    const fog = t.fog || (t.fog = document.createElement('canvas'));
    fog.width = Math.ceil(t.W / t.fs); fog.height = Math.ceil(t.H / t.fs);
    t.fc = fog.getContext('2d');
    t.fc.fillStyle = '#b9c4d6'; t.fc.fillRect(0, 0, fog.width, fog.height);
    // a message someone left earlier
    t.fc.globalCompositeOperation = 'destination-out';
    t.fc.font = `900 ${Math.round(t.H / t.fs * 0.28)}px ${UI}`; t.fc.textAlign = 'center'; t.fc.textBaseline = 'middle';
    t.fc.fillStyle = 'rgba(0,0,0,0.85)'; t.fc.fillText('HI :)', fog.width * 0.5, fog.height * 0.42);
    t.fc.globalCompositeOperation = 'source-over';
  },
  wipe(t, x, y, r) {
    const f = t.fc, s = t.fs, g = f.createRadialGradient(x / s, y / s, 0, x / s, y / s, r / s);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.globalCompositeOperation = 'destination-out';
    f.fillStyle = g; f.fillRect((x - r) / s, (y - r) / s, (r * 2) / s, (r * 2) / s);
    f.globalCompositeOperation = 'source-over';
  },
  down(t) { t.wiping = true; this.wipe(t, t.p.x, t.p.y, 18); t.noise(0.12, 0.03, 1500); },
  move(t) {
    if (!t.p.down || !t.wiping) return;
    const d = Math.hypot(t.p.vx, t.p.vy), n = Math.max(1, Math.ceil(d / 6));
    for (let k = 0; k < n; k++) this.wipe(t, t.p.x - t.p.vx * (k / n), t.p.y - t.p.vy * (k / n), 18);
    if (d > 8 && Math.random() < 0.15) t.noise(0.08, 0.02, 1800);
  },
  up(t) { t.wiping = false; },
  frame(t, dt) {
    const c = t.c;
    // the glass steams up again, slowly
    t.refogT -= dt;
    if (t.refogT <= 0) { t.refogT = 0.15; t.fc.fillStyle = 'rgba(185,196,214,0.03)'; t.fc.fillRect(0, 0, t.fog.width, t.fog.height); }
    // raindrops land, grow, and some run down the glass, clearing a trail
    if (Math.random() < dt * (t.low ? 8 : 16)) {
      const d = { x: Math.random() * t.W, y: Math.random() * t.H, r: HA.rand(1.2, 3.2), v: 0, wob: Math.random() * 6 };
      t.drops.push(d); this.wipe(t, d.x, d.y, d.r * 2.2);
    }
    for (const d of t.drops) {
      if (d.r > 3.4) {
        d.v = Math.min(160, d.v + 260 * dt);
        d.wob += dt * 5;
        const ox = d.x;
        d.x += Math.sin(d.wob) * 8 * dt; d.y += d.v * dt;
        this.wipe(t, d.x, d.y, d.r * 1.6);
        if (Math.random() < dt * 4) { t.drops.push({ x: ox, y: d.y - d.r * 2, r: HA.rand(0.8, 1.6), v: 0, wob: 0 }); d.r *= 0.97; }
        for (const o of t.drops) if (o !== d && !o.gone && o.r <= d.r && Math.abs(o.x - d.x) < d.r + o.r && Math.abs(o.y - d.y) < d.r + o.r) { o.gone = true; d.r = Math.min(7, Math.hypot(d.r, o.r)); }
      } else d.r += dt * 0.25;
    }
    t.drops = t.drops.filter(d => !d.gone && d.y < t.H + 10);
    if (t.drops.length > 140) t.drops.splice(0, t.drops.length - 140);
    c.drawImage(t.bg, 0, 0, t.W, t.H);
    c.globalAlpha = 0.82; c.imageSmoothingEnabled = true;
    c.drawImage(t.fog, 0, 0, t.W, t.H);
    c.globalAlpha = 1;
    // the drops: clear beads of water, dark along the bottom edge, with a glint of light
    for (const d of t.drops) {
      c.fillStyle = 'rgba(205,220,255,0.22)'; c.beginPath(); c.arc(d.x, d.y, d.r, 0, HA.TAU); c.fill();
      c.strokeStyle = 'rgba(15,20,40,0.45)'; c.lineWidth = Math.max(0.8, d.r * 0.35);
      c.beginPath(); c.arc(d.x, d.y, d.r * 0.8, 0.3, Math.PI - 0.3); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(d.x - d.r * 0.35, d.y - d.r * 0.4, Math.max(0.6, d.r * 0.28), 0, HA.TAU); c.fill();
    }
    // the frame of the window
    c.fillStyle = '#1b1612'; c.fillRect(0, t.H / 2 - 3, t.W, 6); c.fillRect(t.W / 2 - 3, 0, 6, t.H);
  },
});

// ---- Soap Bubbles ---------------------------------------------------------------------
Exhibits.add({
  id: 'bubbles', name: 'Soap Bubbles', section: 'motion', hint: 'Hold to blow, move to let go, tap to pop', canvas: true,
  setup(t) { t.bubbles = []; t.drops = []; t.grow = null; t.autoT = 0.5; },
  pop(t, b) {
    b.gone = true;
    for (let i = 0; i < (t.low ? 6 : 12); i++) { const a = Math.random() * HA.TAU; t.drops.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * HA.rand(40, 120), vy: Math.sin(a) * HA.rand(40, 120), life: 0.4 }); }
    t.noise(0.05, 0.05, 5000, 'highpass');
    t.blip(1600 + Math.random() * 600, 0.03, 'sine', 0.03);
  },
  down(t) {
    for (const b of t.bubbles) if (!b.gone && Math.hypot(b.x - t.p.x, b.y - t.p.y) < b.r) { this.pop(t, b); return; }
    t.grow = { x: t.p.x, y: t.p.y, r: 4, vx: 0, vy: 0, hue: Math.random() * 360, life: HA.rand(6, 12), wob: Math.random() * 6 };
  },
  release(t, vx, vy) {
    const g = t.grow;
    if (!g) return;
    t.grow = null;
    if (g.r < 5) return;
    g.vx = vx; g.vy = vy - 20;
    t.bubbles.push(g);
    if (t.bubbles.length > (t.low ? 24 : 50)) this.pop(t, t.bubbles.find(b => !b.gone));
  },
  up(t) { this.release(t, t.p.vx * 20, t.p.vy * 20); },
  frame(t, dt, time) {
    const c = t.c, P = t.p;
    // the wand: hold still and the bubble grows; sweep it and the bubble lets go
    if (t.grow) {
      t.grow.x = P.x; t.grow.y = P.y;
      const sp = Math.hypot(P.vx, P.vy);
      if (sp > 9) { this.release(t, P.vx * 25, P.vy * 25); if (P.down) t.grow = { x: P.x, y: P.y, r: 3, vx: 0, vy: 0, hue: Math.random() * 360, life: HA.rand(5, 10), wob: Math.random() * 6 }; }
      else t.grow.r = Math.min(Math.min(t.W, t.H) * 0.22, t.grow.r + dt * 26);
    }
    // nobody about: the wand blows a few by itself
    t.autoT -= dt;
    if (t.autoT <= 0 && !P.down) {
      t.autoT = HA.rand(0.8, 2);
      t.bubbles.push({ x: t.W * 0.12, y: t.H * 0.85, r: HA.rand(8, 26), vx: HA.rand(30, 90), vy: HA.rand(-60, -20), hue: Math.random() * 360, life: HA.rand(5, 9), wob: Math.random() * 6 });
    }
    for (const b of t.bubbles) {
      if (b.gone) continue;
      b.life -= dt; b.wob += dt * 2;
      b.vx += (HA.noise(time * 0.3, b.hue) - 0.5) * 40 * dt; b.vy += (-6 + Math.sin(b.wob) * 8) * dt;
      b.vx *= Math.exp(-0.6 * dt); b.vy *= Math.exp(-0.6 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -b.r || b.x > t.W + b.r || b.y < -b.r * 2 || b.y > t.H + b.r) this.pop(t, b);
      // a sweep of the empty wand through a bubble pops it too
      if (!t.grow && P.inside && Math.hypot(P.vx, P.vy) > 4 && Math.hypot(b.x - P.x, b.y - P.y) < b.r * 0.9) this.pop(t, b);
    }
    t.bubbles = t.bubbles.filter(b => !b.gone);
    // a sky
    const sky = c.createLinearGradient(0, 0, 0, t.H);
    sky.addColorStop(0, '#5fb0ff'); sky.addColorStop(1, '#b8e0ff');
    c.fillStyle = sky; c.fillRect(0, 0, t.W, t.H);
    c.fillStyle = '#7cc461'; c.fillRect(0, t.H * 0.9, t.W, t.H * 0.1);
    const all = t.grow ? [...t.bubbles, t.grow] : t.bubbles;
    for (const b of all) {
      const h = (b.hue + time * 40) % 360, r = b.r * (1 + Math.sin(b.wob * 2) * 0.02);
      const g = c.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.1, b.x, b.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.03)');
      g.addColorStop(0.72, HA.hsl(h, 90, 75, 0.08));
      g.addColorStop(0.92, HA.hsl(h + 70, 95, 70, 0.32));
      g.addColorStop(1, HA.hsl(h + 140, 95, 85, 0.6));
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r, 0, HA.TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = Math.max(1, r * 0.06);
      c.beginPath(); c.arc(b.x, b.y, r * 0.78, -2.5, -1.7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(b.x + r * 0.42, b.y + r * 0.38, Math.max(0.8, r * 0.06), 0, HA.TAU); c.fill();
    }
    for (const d of t.drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 300 * dt; d.life -= dt; c.fillStyle = `rgba(255,255,255,${d.life * 2})`; c.fillRect(d.x, d.y, 2, 2); }
    t.drops = t.drops.filter(d => d.life > 0);
    // the wand
    if (P.inside) {
      c.strokeStyle = '#ff4fa0'; c.lineWidth = 3;
      c.beginPath(); c.arc(P.x, P.y, t.grow ? Math.max(10, t.grow.r * 0.6) : 10, 0, HA.TAU); c.stroke();
      c.beginPath(); c.moveTo(P.x + 8, P.y + 8); c.lineTo(P.x + 34, P.y + 40); c.stroke();
    }
  },
});

// ---- Departure Board ------------------------------------------------------------------
const FLAP_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:-!?'&/";
const FLAP_PLACES = ['ROAD RUSH', 'BOOM RUN', 'TRAFFIC CTRL', 'HALL OF ART', 'SOLARIAN', 'OLD TOWN', 'HARBOUR', 'MOONBASE', 'NORTH POLE', 'AIRPORT', 'CITY CENTRE', 'LAVA LAMP', 'THE BEACH', 'CHICKEN FARM'];
const FLAP_STATUS = ['ON TIME', 'BOARDING', 'DELAYED', 'GATE 7', 'GATE 12', 'CANCELLED', 'DEPARTED', 'LAST CALL'];

Exhibits.add({
  id: 'flapboard', name: 'Departure Board', section: 'text', hint: 'Type a message (or press Write)', canvas: true,
  setup(t) {
    t.typed = ''; t.nextT = 2; t.clackT = 0; t.hour = 9; t.min = 0;
    // touch screens: a hidden box to type into
    const inp = document.createElement('input');
    inp.className = 'ex-hidden-input'; inp.type = 'text'; inp.maxLength = 40; inp.setAttribute('aria-label', 'Message for the board'); inp.autocomplete = 'off'; inp.spellcheck = false;
    t.el.appendChild(inp);
    t.inp = inp;
    t.on(inp, 'input', () => { t.typed = this.clean(inp.value).slice(0, t.cols); inp.value = t.typed; this.message(t); });
    HA.tools(t, [['Write', () => { inp.value = t.typed; inp.focus(); }]], 'tr');
    t.on(window, 'keydown', e => {
      if (document.activeElement === inp || !(t.p.inside || t.big) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') { t.typed = t.typed.slice(0, -1); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === 'Escape') { t.typed = ''; }
      else if (e.key.length === 1 && FLAP_CHARS.includes(e.key.toUpperCase())) { if (e.key === ' ') e.preventDefault(); t.typed = (t.typed + e.key.toUpperCase()).slice(0, t.cols); }
      else return;
      this.message(t);
    });
    this.make(t);
  },
  clean(s) { return s.toUpperCase().split('').filter(ch => FLAP_CHARS.includes(ch)).join(''); },
  resize(t) { this.make(t); },
  make(t) {
    t.cw = HA.clamp(Math.floor(t.W / (t.big ? 30 : 19)), 12, 40); t.chh = Math.round(t.cw * 1.45);
    t.cols = Math.max(6, Math.floor((t.W - 16) / (t.cw + 2)));
    t.rows = Math.max(2, Math.floor((t.H - 36) / (t.chh + 4)));
    t.cells = Array.from({ length: t.rows * t.cols }, () => ({ cur: 0, target: 0, k: 0 }));
    t.lines = [];
    for (let r = 0; r < t.rows - 1; r++) this.line(t, r, this.departure(t));
    this.message(t);
  },
  departure(t) {
    t.min += 5 + Math.floor(Math.random() * 3) * 5;
    if (t.min >= 60) { t.min -= 60; t.hour = (t.hour % 23) + 1; }
    const time = `${String(t.hour).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
    // somewhere that isn't on the board already
    const shown = (t.lines || []).join('|'), free = FLAP_PLACES.filter(p => !shown.includes(p.slice(0, 6)));
    const place = (free.length ? free : FLAP_PLACES)[Math.floor(Math.random() * (free.length || FLAP_PLACES.length))], st = FLAP_STATUS[Math.floor(Math.random() * FLAP_STATUS.length)];
    if (t.cols >= 26) { const w = t.cols - 16; return `${time} ${place.slice(0, w).padEnd(w)} ${st}`; }
    if (t.cols >= 15) return `${time} ${place.slice(0, t.cols - 6)}`;
    return place;
  },
  line(t, r, text) {
    const s = text.slice(0, t.cols).padEnd(t.cols);
    (t.lines || (t.lines = []))[r] = s;
    for (let k = 0; k < t.cols; k++) t.cells[r * t.cols + k].target = Math.max(0, FLAP_CHARS.indexOf(s[k]));
  },
  // the bottom row is yours
  message(t) {
    const touch = matchMedia('(hover: none)').matches;
    this.line(t, t.rows - 1, t.typed || (touch ? 'PRESS WRITE' : 'TYPE HERE'));
  },
  down(t, e) {
    if (e && e.target.closest && e.target.closest('button, input')) return;
    // a tap on a flap turns it on by one
    const k = Math.floor((t.p.x - t.ox) / (t.cw + 2)), r = Math.floor((t.p.y - t.oy) / (t.chh + 4));
    if (k >= 0 && k < t.cols && r >= 0 && r < t.rows) { const cell = t.cells[r * t.cols + k]; cell.target = (cell.target + 1) % FLAP_CHARS.length; }
  },
  frame(t, dt) {
    t.nextT -= dt;
    if (t.nextT <= 0) { t.nextT = HA.rand(3.5, 7); this.line(t, Math.floor(Math.random() * (t.rows - 1)), this.departure(t)); }
    let clacks = 0;
    for (const cell of t.cells) {
      if (cell.cur === cell.target && cell.k === 0) continue;
      cell.k += dt / 0.045;
      if (cell.k >= 1) { cell.k = 0; cell.cur = (cell.cur + 1) % FLAP_CHARS.length; clacks++; }
    }
    t.clackT -= dt;
    if (clacks && t.clackT <= 0) { t.clackT = 0.045; t.noise(0.02, Math.min(0.06, 0.012 * clacks), 2600, 'bandpass'); }
    const c = t.c, cw = t.cw, ch = t.chh;
    c.fillStyle = '#121316'; c.fillRect(0, 0, t.W, t.H);
    t.ox = Math.round((t.W - t.cols * (cw + 2)) / 2); t.oy = 28;
    c.fillStyle = '#ffd23f'; c.font = `900 ${Math.round(HA.clamp(t.W / 32, 10, 18))}px ${UI}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('DEPARTURES', t.ox, 15);
    c.textAlign = 'center';
    c.font = `800 ${Math.round(ch * 0.72)}px ${UI}`;
    for (let r = 0; r < t.rows; r++) for (let k = 0; k < t.cols; k++) {
      const cell = t.cells[r * t.cols + k], x = t.ox + k * (cw + 2), y = t.oy + r * (ch + 4);
      const cur = FLAP_CHARS[cell.cur], next = FLAP_CHARS[(cell.cur + 1) % FLAP_CHARS.length], mine = r === t.rows - 1;
      c.fillStyle = mine ? '#1d2a22' : '#25272c'; c.fillRect(x, y, cw, ch);
      const ink = mine ? '#7dffb0' : '#f7f2e2';
      if (cell.k === 0) this.half(c, cur, x, y, cw, ch, 0, ink, 1);
      else {
        // behind: the next character's top half and this one's bottom half; in front, the falling flap
        this.half(c, next, x, y, cw, ch, -1, ink, 1);
        this.half(c, cur, x, y, cw, ch, 1, ink, 1);
        if (cell.k < 0.5) this.half(c, cur, x, y, cw, ch, -1, ink, 1 - cell.k * 2, true);
        else this.half(c, next, x, y, cw, ch, 1, ink, (cell.k - 0.5) * 2, true);
      }
      c.fillStyle = '#0b0b0d'; c.fillRect(x, y + ch / 2 - 0.75, cw, 1.5);
    }
    c.textBaseline = 'alphabetic';
  },
  // half a flap (-1 top, 1 bottom, 0 both), squashed towards the hinge by `sc`
  half(c, ch, x, y, w, h, side, ink, sc, flap) {
    c.save();
    c.beginPath();
    if (side < 0) c.rect(x, y, w, h / 2); else if (side > 0) c.rect(x, y + h / 2, w, h / 2); else c.rect(x, y, w, h);
    c.clip();
    if (side !== 0 && sc < 1) { c.translate(0, y + h / 2); c.scale(1, Math.max(0.02, sc)); c.translate(0, -(y + h / 2)); }
    if (flap) { c.fillStyle = '#2c2f35'; c.fillRect(x, y, w, h); }
    c.fillStyle = ink; c.fillText(ch, x + w / 2, y + h / 2 + h * 0.04);
    c.restore();
  },
  destroy(t) { if (t.inp) t.inp.blur(); },
});

// ---- Graffiti Wall --------------------------------------------------------------------
const SPRAY_CANS = [['#ff3fa4', 'Pink'], ['#ffd23f', 'Yellow'], ['#2ee6ff', 'Cyan'], ['#8bff3a', 'Lime'], ['#ff7a1a', 'Orange'], ['#f7f7f2', 'White'], ['#16181c', 'Black']];

Exhibits.add({
  id: 'graffiti', name: 'Graffiti Wall', section: 'text', hint: 'Spray paint the wall', canvas: true,
  setup(t) {
    t.col = SPRAY_CANS[0][0]; t.drips = []; t.hissT = 0; t.washT = 0;
    const btns = HA.tools(t, SPRAY_CANS.map(([col, name], i) => ['', b => { t.col = col; btns.forEach(x => x.classList.remove('on')); b.classList.add('on'); }, i === 0]), 'bl');
    btns.forEach((b, i) => { b.classList.add('swatch'); b.style.background = SPRAY_CANS[i][0]; b.setAttribute('aria-label', SPRAY_CANS[i][1] + ' paint'); });
    HA.tools(t, [['Wash', () => { t.washT = 0.7; t.noise(0.6, 0.06, 1200); }]], 'tr');
    this.make(t);
  },
  resize(t) { this.make(t); },
  make(t) {
    // bricks (drawn once)
    const wall = t.wall || (t.wall = document.createElement('canvas'));
    wall.width = t.W; wall.height = t.H;
    const g = wall.getContext('2d');
    g.fillStyle = '#5b5550'; g.fillRect(0, 0, t.W, t.H);
    const bw = 44, bh = 18;
    for (let y = 0, row = 0; y < t.H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < t.W; x += bw) {
      const v = Math.floor(Math.random() * 24);
      g.fillStyle = `rgb(${142 + v},${70 + v / 2},${58 + v / 3})`;
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
    const grime = g.createLinearGradient(0, 0, 0, t.H);
    grime.addColorStop(0, 'rgba(0,0,0,0.25)'); grime.addColorStop(0.6, 'rgba(0,0,0,0)'); grime.addColorStop(1, 'rgba(30,20,10,0.35)');
    g.fillStyle = grime; g.fillRect(0, 0, t.W, t.H);
    const paint = t.paint || (t.paint = document.createElement('canvas'));
    paint.width = t.W; paint.height = t.H;
    t.pc = paint.getContext('2d');
    t.wet = new Float32Array(Math.ceil(t.W / 8) * Math.ceil(t.H / 8));
    // somebody's been here already
    const pc = t.pc, fs = Math.round(Math.min(t.H * 0.5, t.W * 0.24));
    pc.save(); pc.translate(t.W * 0.5, t.H * 0.5); pc.rotate(-0.08);
    pc.font = `900 ${fs}px ${UI}`; pc.textAlign = 'center'; pc.textBaseline = 'middle';
    pc.lineJoin = 'round'; pc.lineWidth = fs * 0.16; pc.strokeStyle = '#16181c'; pc.strokeText('ART', 0, 0);
    const fill = pc.createLinearGradient(0, -fs / 2, 0, fs / 2);
    fill.addColorStop(0, '#ffd23f'); fill.addColorStop(1, '#ff3fa4');
    pc.fillStyle = fill; pc.fillText('ART', 0, 0);
    pc.lineWidth = fs * 0.03; pc.strokeStyle = 'rgba(255,255,255,0.8)'; pc.strokeText('ART', -fs * 0.02, -fs * 0.03);
    pc.restore();
  },
  spray(t, x, y, amt) {
    const pc = t.pc, r = HA.clamp(Math.min(t.W, t.H) * 0.035, 7, 22);
    pc.globalAlpha = 0.5;
    pc.fillStyle = t.col;
    const n = Math.round((t.low ? 24 : 48) * amt);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * HA.TAU, d = Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * r * 0.45; // a soft, round spray
      const s = HA.rand(0.6, 1.8);
      pc.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s);
    }
    pc.globalAlpha = 0.12;
    pc.beginPath(); pc.arc(x, y, r * 0.55, 0, HA.TAU); pc.fill();
    pc.globalAlpha = 1;
    // too much in one place and it runs
    const gx = Math.floor(x / 8), gy = Math.floor(y / 8), cols = Math.ceil(t.W / 8);
    if (gx >= 0 && gy >= 0 && gx < cols) {
      const i = gy * cols + gx;
      t.wet[i] = (t.wet[i] || 0) + amt;
      if (t.wet[i] > 6 && Math.random() < 0.25) { t.wet[i] = 3; t.drips.push({ x: x + HA.rand(-r * 0.4, r * 0.4), y: y + r * 0.3, v: HA.rand(14, 30), w: HA.rand(1.6, 3), life: HA.rand(0.8, 2), col: t.col }); }
    }
  },
  down(t, e) { if (e && e.target.closest && e.target.closest('button')) return; t.spraying = true; this.spray(t, t.p.x, t.p.y, 1); },
  move(t) {
    if (!t.spraying || !t.p.down) return;
    const d = Math.hypot(t.p.vx, t.p.vy), n = Math.max(1, Math.ceil(d / 5));
    for (let k = 0; k < n; k++) this.spray(t, t.p.x - t.p.vx * (k / n), t.p.y - t.p.vy * (k / n), 1 / Math.max(1, n * 0.6));
  },
  up(t) { t.spraying = false; },
  frame(t, dt) {
    if (t.spraying && t.p.down) {
      this.spray(t, t.p.x, t.p.y, dt * 14); // holding still keeps the paint coming
      t.hissT -= dt;
      if (t.hissT <= 0) { t.hissT = 0.09; t.noise(0.11, 0.025, 5200, 'highpass'); }
    }
    for (const d of t.drips) {
      const y0 = d.y;
      d.y += d.v * dt; d.v *= Math.exp(-0.8 * dt); d.life -= dt; d.w *= Math.exp(-0.3 * dt);
      t.pc.strokeStyle = d.col; t.pc.lineWidth = d.w; t.pc.lineCap = 'round'; t.pc.globalAlpha = 0.85;
      t.pc.beginPath(); t.pc.moveTo(d.x, y0); t.pc.lineTo(d.x, d.y); t.pc.stroke();
      t.pc.globalAlpha = 1;
    }
    t.drips = t.drips.filter(d => d.life > 0);
    for (let i = 0; i < t.wet.length; i++) if (t.wet[i] > 0) t.wet[i] = Math.max(0, t.wet[i] - dt * 2);
    if (t.washT > 0) {
      t.washT -= dt;
      t.pc.globalCompositeOperation = 'destination-out'; t.pc.fillStyle = 'rgba(0,0,0,0.2)'; t.pc.fillRect(0, 0, t.W, t.H);
      t.pc.globalCompositeOperation = 'source-over';
      if (t.washT <= 0) t.pc.clearRect(0, 0, t.W, t.H);
    }
    const c = t.c;
    c.drawImage(t.wall, 0, 0, t.W, t.H);
    c.drawImage(t.paint, 0, 0, t.W, t.H);
    // the can's nozzle where you're pointing
    if (t.p.inside) {
      c.strokeStyle = t.col; c.lineWidth = 2; c.globalAlpha = 0.8;
      c.beginPath(); c.arc(t.p.x, t.p.y, 6, 0, HA.TAU); c.stroke();
      c.globalAlpha = 1;
    }
  },
});
