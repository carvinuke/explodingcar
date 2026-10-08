'use strict';
// Hall of Art: buttons with feelings.

// 1. A button that leans toward your cursor, as if it can't help itself.
Exhibits.add({
  id: 'magnet', name: 'Magnetic Button', section: 'buttons', hint: 'Move near it',
  setup(t) {
    t.el.classList.add('center');
    t.el.innerHTML = '<button class="tb-btn magnet"><span>Come closer</span></button>';
    t.btn = t.el.querySelector('button'); t.txt = t.el.querySelector('span');
    t.sx = HA.spring(260, 16); t.sy = HA.spring(260, 16);
    t.btn.addEventListener('click', () => t.blip(990, 0.1, 'triangle'));
  },
  frame(t, dt) {
    let tx = 0, ty = 0;
    if (t.p.inside) {
      const r = t.btn.getBoundingClientRect(), s = t.el.getBoundingClientRect();
      const cx = r.left - s.left + r.width / 2, cy = r.top - s.top + r.height / 2;
      const dx = t.p.x - cx, dy = t.p.y - cy, d = Math.hypot(dx, dy);
      const pull = Math.max(0, 1 - d / 160);
      tx = dx * 0.4 * pull; ty = dy * 0.4 * pull;
    }
    const x = t.sx.step(tx, dt), y = t.sy.step(ty, dt);
    t.btn.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    t.txt.style.transform = `translate(${(x * 0.35).toFixed(2)}px, ${(y * 0.35).toFixed(2)}px)`;
  },
});

// 2. Squishy: squashes when pressed, wobbles when let go.
Exhibits.add({
  id: 'jelly', name: 'Jelly Button', section: 'buttons', hint: 'Press and let go',
  setup(t) {
    t.el.classList.add('center');
    t.el.innerHTML = '<button class="tb-btn jelly">Squish</button>';
    t.btn = t.el.querySelector('button');
    t.s = HA.spring(380, 9); t.s.x = 1; t.target = 1;
    t.btn.addEventListener('pointerdown', () => { t.target = 0.82; t.blip(220, 0.12, 'sine', 0.14, 0.6); });
    const rel = () => { if (t.target !== 1) { t.target = 1; t.s.v += 6; t.blip(330, 0.18, 'sine', 0.12, 2.2); } };
    t.btn.addEventListener('pointerup', rel);
    t.btn.addEventListener('pointerleave', rel);
  },
  frame(t, dt) {
    const k = t.s.step(t.target, dt);
    t.btn.style.transform = `scale(${(2 - k).toFixed(3)}, ${k.toFixed(3)})`;
  },
});

// 3. Confetti cannon.
Exhibits.add({
  id: 'confetti', name: 'Confetti', section: 'buttons', hint: 'Click it (a lot)', canvas: true,
  setup(t) {
    t.bits = [];
    const b = document.createElement('button');
    b.className = 'tb-btn party';
    b.textContent = 'Celebrate';
    t.el.appendChild(b);
    b.addEventListener('click', e => {
      const r = b.getBoundingClientRect(), s = t.el.getBoundingClientRect();
      const x = r.left - s.left + r.width / 2, y = r.top - s.top + r.height / 2;
      const n = t.low ? 60 : 140;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + HA.rand(-1.1, 1.1), v = HA.rand(180, 520);
        t.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: HA.rand(0, 6), vr: HA.rand(-12, 12), w: HA.rand(4, 9), h: HA.rand(3, 6), c: HA.hsl(HA.rand(0, 360), 90, 60), life: HA.rand(1.6, 2.8) });
      }
      t.blip(523, 0.08, 'square', 0.06); t.later(() => t.blip(784, 0.12, 'square', 0.06), 70);
      t.noise(0.25, 0.25);
    });
  },
  frame(t, dt) {
    const c = t.c;
    c.clearRect(0, 0, t.W, t.H);
    for (const b of t.bits) {
      b.vy += 520 * dt; b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.life -= dt;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.scale(1, Math.cos(b.r * 2));
      c.globalAlpha = Math.min(1, b.life);
      c.fillStyle = b.c; c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      c.restore();
    }
    t.bits = t.bits.filter(b => b.life > 0 && b.y < t.H + 20);
  },
});

// 4. A button that fills with liquid while you hover, and sloshes.
Exhibits.add({
  id: 'liquid', name: 'Liquid Fill', section: 'buttons', hint: 'Hover, then click', canvas: true,
  setup(t) { t.level = 0; t.slosh = 0; t.ph = 0; },
  down(t) { t.slosh = 1; t.blip(180, 0.25, 'sine', 0.15, 0.5); },
  frame(t, dt, time) {
    const c = t.c, W = t.W, H = t.H, bw = Math.min(220, W * 0.7), bh = 64, bx = (W - bw) / 2, by = (H - bh) / 2;
    const over = t.p.inside && t.p.x > bx && t.p.x < bx + bw && t.p.y > by && t.p.y < by + bh;
    t.level = HA.lerp(t.level, over || t.p.down ? 1 : 0, 1 - Math.exp(-3 * dt));
    t.slosh *= Math.exp(-2.2 * dt);
    t.ph += dt * (3 + t.slosh * 8);
    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.roundRect(bx, by, bw, bh, 32); c.clip();
    c.fillStyle = '#1b2a4a'; c.fillRect(bx, by, bw, bh);
    const surf = by + bh * (1 - t.level * 1.08) + 4;
    for (const [col, off, amp] of [['#2e8bff', 0, 1], ['#59c2ff', 1.7, 0.7]]) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(bx, by + bh);
      for (let x = 0; x <= bw; x += 6) c.lineTo(bx + x, surf + Math.sin(x * 0.045 + t.ph + off) * (4 + t.slosh * 10) * amp);
      c.lineTo(bx + bw, by + bh); c.closePath(); c.fill();
    }
    c.restore();
    c.strokeStyle = '#59c2ff'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(bx, by, bw, bh, 32); c.stroke();
    c.fillStyle = '#fff'; c.font = `900 20px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t.level > 0.6 ? 'Full!' : 'Fill me up', W / 2, H / 2 + 1);
  },
});

// 5. Ripples spread from wherever you press.
Exhibits.add({
  id: 'ripple', name: 'Ripple', section: 'buttons', hint: 'Click anywhere on it',
  setup(t) {
    t.el.classList.add('center');
    t.el.innerHTML = '<button class="tb-btn ripple">Make waves</button>';
    const b = t.el.querySelector('button');
    b.addEventListener('pointerdown', e => {
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'wave';
      s.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`;
      b.appendChild(s);
      t.later(() => s.remove(), 750);
      t.blip(1200, 0.06, 'sine', 0.06, 0.7);
    });
  },
});

// 6. A glitchy button that tears into red, green and blue when you hover.
Exhibits.add({
  id: 'glitch', name: 'Glitch', section: 'buttons', hint: 'Hover over it',
  setup(t) {
    t.el.classList.add('center', 'dark');
    t.el.innerHTML = '<button class="tb-btn glitch" data-text="SYSTEM ERROR">SYSTEM ERROR</button>';
    t.btn = t.el.querySelector('button');
    t.btn.addEventListener('click', () => { t.noise(0.18, 0.3); t.blip(80, 0.2, 'square', 0.08, 3); });
  },
  frame(t) {
    const on = t.p.inside || Math.random() < 0.01;
    t.btn.classList.toggle('on', on);
    if (on) {
      const a = Math.random() * 100, b = a + Math.random() * 30;
      t.btn.style.setProperty('--cut', `inset(${a.toFixed(0)}% 0 ${(100 - b).toFixed(0)}% 0)`);
      t.btn.style.setProperty('--gx', `${((Math.random() - 0.5) * 10).toFixed(1)}px`);
    }
  },
});

// 7. A neon sign that buzzes and flickers. Click to switch it off and on.
Exhibits.add({
  id: 'neon', name: 'Neon Sign', section: 'buttons', hint: 'Click to switch',
  setup(t) {
    t.el.classList.add('center', 'brick');
    t.el.innerHTML = '<button class="neon on" aria-pressed="true">OPEN 24/7</button>';
    t.btn = t.el.querySelector('button');
    t.on = true;
    t.btn.addEventListener('click', () => {
      t.on = !t.on;
      t.btn.classList.toggle('on', t.on);
      t.btn.setAttribute('aria-pressed', t.on);
      t.blip(t.on ? 120 : 90, 0.25, 'sawtooth', 0.05, t.on ? 1.02 : 0.9);
    });
  },
  frame(t) {
    if (!t.on) return;
    const f = Math.random();
    t.btn.classList.toggle('flick', f < 0.03);
  },
});

// 8. Hold to charge it up. Let go too soon and it fizzles. Hold long enough and...
Exhibits.add({
  id: 'charge', name: 'Hold to Explode', section: 'buttons', hint: 'Press and hold', canvas: true,
  setup(t) { t.k = 0; t.parts = []; t.boomT = 0; t.grow = 1; t.toneT = 0; },
  down(t) { if (t.boomT <= 0) t.holding = true; },
  up(t) { t.holding = false; },
  frame(t, dt, time) {
    const c = t.c, W = t.W, H = t.H, cx = W / 2, cy = H / 2;
    if (t.holding && t.boomT <= 0) {
      t.k = Math.min(1, t.k + dt / 1.6);
      t.toneT -= dt;
      if (t.toneT <= 0) { t.toneT = 0.08; t.blip(200 + t.k * 900, 0.07, 'square', 0.04); }
      if (t.k >= 1) {
        t.holding = false; t.boomT = 1.6; t.k = 0; t.grow = 0;
        const n = t.low ? 70 : 160;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * HA.TAU, v = HA.rand(80, 520);
          t.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: HA.rand(0.6, 1.4), s: HA.rand(2, 7), hue: HA.rand(10, 55) });
        }
        t.noise(0.9, 0.5); t.blip(70, 0.6, 'sine', 0.3, 0.4);
      }
    } else t.k = Math.max(0, t.k - dt * 2);
    t.boomT -= dt;
    if (t.boomT <= 0) t.grow = Math.min(1, t.grow + dt * 3);
    c.clearRect(0, 0, W, H);
    // flash
    if (t.boomT > 1.35) { c.fillStyle = `rgba(255,240,200,${(t.boomT - 1.35) * 3})`; c.fillRect(0, 0, W, H); }
    // the button
    if (t.grow > 0) {
      const shake = t.k * t.k * 5, r = (42 + t.k * 12) * t.grow;
      const x = cx + (Math.random() - 0.5) * shake, y = cy + (Math.random() - 0.5) * shake;
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2);
      g.addColorStop(0, `rgba(255,${200 - t.k * 160},60,${0.25 + t.k * 0.5})`); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, HA.TAU); c.fill();
      c.fillStyle = `hsl(${40 - t.k * 40}, 95%, ${55 - t.k * 8}%)`;
      c.beginPath(); c.arc(x, y, r, 0, HA.TAU); c.fill();
      c.strokeStyle = '#16181c'; c.lineWidth = 4; c.stroke();
      // charge ring
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + t.k * HA.TAU); c.stroke();
      c.fillStyle = '#16181c'; c.font = `900 ${Math.round(16 * t.grow)}px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t.k > 0.75 ? '!!!' : t.k > 0 ? 'HOLD...' : 'HOLD', x, y + 1);
    }
    // blast
    for (const p of t.parts) {
      p.vx *= 0.96; p.vy = p.vy * 0.96 + 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      c.fillStyle = `hsl(${p.hue}, 100%, ${50 + p.life * 25}%)`;
      c.beginPath(); c.arc(p.x, p.y, p.s * (0.5 + p.life), 0, HA.TAU); c.fill();
    }
    c.globalAlpha = 1;
    t.parts = t.parts.filter(p => p.life > 0);
    if (t.boomT > 0.4) { c.fillStyle = '#fff'; c.font = `900 ${Math.round(40 + (1.6 - t.boomT) * 30)}px ${UI}`; c.textAlign = 'center'; c.fillText('BOOM', cx, cy - 50); }
  },
});

// 9. Chunky keyboard keys you can press.
Exhibits.add({
  id: 'keys', name: 'Clicky Keys', section: 'buttons', hint: 'Press the keys',
  setup(t) {
    t.el.classList.add('center');
    const notes = { C: 523, A: 440, R: 392, G: 349, O: 330 };
    t.el.innerHTML = '<div class="keys">' + Object.keys(notes).map(k => `<button class="key" data-k="${k}">${k}</button>`).join('') + '</div>';
    for (const b of t.el.querySelectorAll('.key')) {
      b.addEventListener('pointerdown', () => { b.classList.add('down'); t.blip(notes[b.dataset.k], 0.16, 'triangle', 0.14); t.blip(2400, 0.02, 'square', 0.03); });
      for (const ev of ['pointerup', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('down'));
    }
  },
});

// 10. Icons that melt into each other.
Exhibits.add({
  id: 'morph', name: 'Morphing Icons', section: 'buttons', hint: 'Click to change',
  setup(t) {
    t.el.classList.add('center');
    const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    // every shape is three four-point pieces, so any two can blend
    t.shapes = [
      [[[30, 20], [80, 50], [80, 50], [30, 80]], sq(80, 50, 80, 50), sq(30, 50, 30, 50)],     // play
      [sq(28, 22, 44, 78), sq(56, 22, 72, 78), sq(50, 50, 50, 50)],                             // pause
      [sq(22, 26, 78, 36), sq(22, 45, 78, 55), sq(22, 64, 78, 74)],                             // menu
      [[[26, 33], [33, 26], [74, 67], [67, 74]], [[67, 26], [74, 33], [33, 74], [26, 67]], sq(50, 50, 50, 50)], // close
      [[[22, 52], [30, 44], [44, 58], [36, 66]], [[36, 66], [70, 30], [78, 38], [44, 74]], sq(50, 50, 50, 50)], // tick
    ];
    t.i = 0; t.from = t.shapes[0]; t.k = 1;
    t.el.innerHTML = '<button class="tb-btn morph" aria-label="Change icon"><svg viewBox="0 0 100 100"><path fill="currentColor"/></svg></button>';
    t.path = t.el.querySelector('path');
    t.el.querySelector('button').addEventListener('click', () => {
      t.from = t.cur || t.shapes[t.i];
      t.i = (t.i + 1) % t.shapes.length; t.k = 0;
      t.blip(500 + t.i * 90, 0.09, 'sine', 0.1, 1.4);
    });
  },
  frame(t, dt) {
    t.k = Math.min(1, t.k + dt * 3.5);
    const e = 1 - Math.pow(1 - t.k, 3), to = t.shapes[t.i];
    t.cur = t.from.map((piece, a) => piece.map((pt, b) => [HA.lerp(pt[0], to[a][b][0], e), HA.lerp(pt[1], to[a][b][1], e)]));
    t.path.setAttribute('d', t.cur.map(piece => 'M' + piece.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z').join(''));
  },
});
