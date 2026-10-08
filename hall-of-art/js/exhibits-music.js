'use strict';
// Hall of Art: the Music Room (a drum machine), and Crash Test for the Road Works wing.

// 45. Beat Box: an eight-step drum machine. Tap the pads, press play.
const BB_ROWS = [
  { name: 'Kick', col: '#ff5a4a', play: t => t.blip(150, 0.22, 'sine', 0.4, 0.3) },
  { name: 'Snare', col: '#ffc619', play: t => { t.noise(0.16, 0.3, 1800, 'bandpass'); t.blip(190, 0.06, 'triangle', 0.06); } },
  { name: 'Hat', col: '#3fe0ff', play: t => t.noise(0.05, 0.16, 7000, 'highpass') },
  { name: 'Bleep', col: '#ff4fe0', play: (t, step) => t.blip([523, 587, 659, 784, 880, 784, 659, 587][step], 0.12, 'square', 0.04) },
];
const BB_GROOVE = ['10001010', '00100010', '10111011', '10000100'];
Exhibits.add({
  id: 'beatbox', name: 'Beat Box', section: 'music', hint: 'Tap the pads, then press play', wide: true,
  setup(t) {
    t.el.classList.add('center', 'dark');
    t.bpm = 110; t.step = -1; t.ticks = 0; t.acc = 0; t.playing = false;
    t.pat = BB_GROOVE.map(r => r.split('').map(Number));
    const cells = BB_ROWS.map((R, r) => `<span class="bb-lbl" style="--c:${R.col}">${R.name}</span>` +
      Array.from({ length: 8 }, (_, s) => `<button type="button" class="bb-cell${s % 4 === 0 ? ' beat' : ''}" style="--c:${R.col}" data-r="${r}" data-s="${s}" aria-label="${R.name} step ${s + 1}"></button>`).join('')).join('');
    t.el.innerHTML = `<div class="bb">
      <div class="bb-top">
        <button type="button" class="bb-play">&#9654; Play</button>
        <span class="bb-tempo"><button type="button" data-d="-10" aria-label="Slower">&minus;</button><b>110</b><em>BPM</em><button type="button" data-d="10" aria-label="Faster">+</button></span>
        <button type="button" class="bb-groove">Groove</button><button type="button" class="bb-clear">Clear</button>
      </div>
      <div class="bb-grid">${cells}</div></div>`;
    t.cells = [...t.el.querySelectorAll('.bb-cell')];
    t.playBtn = t.el.querySelector('.bb-play');
    t.on(t.playBtn, 'click', () => this.toggle(t));
    for (const b of t.el.querySelectorAll('.bb-tempo button')) t.on(b, 'click', () => { t.bpm = HA.clamp(t.bpm + Number(b.dataset.d), 70, 170); t.el.querySelector('.bb-tempo b').textContent = t.bpm; });
    t.on(t.el.querySelector('.bb-groove'), 'click', () => { t.pat = BB_GROOVE.map(r => r.split('').map(Number)); this.paint(t); });
    t.on(t.el.querySelector('.bb-clear'), 'click', () => { t.pat = t.pat.map(r => r.map(() => 0)); this.paint(t); });
    for (const b of t.cells) t.on(b, 'click', () => {
      const r = +b.dataset.r, s = +b.dataset.s;
      t.pat[r][s] ^= 1;
      if (t.pat[r][s]) BB_ROWS[r].play(t, s);
      this.paint(t);
    });
    this.paint(t);
  },
  paint(t) { for (const b of t.cells) b.setAttribute('aria-pressed', t.pat[+b.dataset.r][+b.dataset.s] ? 'true' : 'false'); },
  toggle(t) {
    t.playing = !t.playing;
    t.playBtn.innerHTML = t.playing ? '&#9632; Stop' : '&#9654; Play';
    t.playBtn.classList.toggle('on', t.playing);
    if (t.playing) { t.step = -1; t.acc = 60 / t.bpm / 2; }
    else for (const b of t.cells) b.classList.remove('now', 'hit');
  },
  tick(t) {
    t.step = (t.step + 1) % 8;
    t.ticks++;
    for (const b of t.cells) {
      const now = +b.dataset.s === t.step;
      b.classList.toggle('now', now);
      b.classList.toggle('hit', now && t.pat[+b.dataset.r][t.step] === 1);
    }
    BB_ROWS.forEach((R, r) => { if (t.pat[r][t.step]) R.play(t, t.step); });
  },
  frame(t, dt) {
    if (!t.playing) return;
    const len = 60 / t.bpm / 2; // eighth notes
    t.acc += dt;
    while (t.acc >= len) { t.acc -= len; this.tick(t); }
  },
});

// 46. Crash Test: the arcade's real cars (supercars too), into a concrete barrier.
const CT_TYPES = ['elfer', 'elferClassic', 'toroV12', 'toroFuria', 'rossoF8', 'rossoSuperfast', 'veloce', 'regent', 'gelande',
  'small', 'sedan', 'sports', 'taxi', 'police', 'pickup', 'van', 'bus'];
Exhibits.add({
  id: 'crashtest', name: 'Crash Test', section: 'cars', hint: 'Pick a car, pull it back, let go', canvas: true, wide: true,
  setup(t) {
    t.k = 0; t.state = 'loading'; t.parts = []; t.shake = 0; t.tests = 0;
    const bar = document.createElement('div');
    bar.className = 'ex-tools bl ct-bar';
    bar.innerHTML = '<button type="button" class="ex-tool" aria-label="Previous car">&#9664;</button><span class="ct-name">Loading…</span><button type="button" class="ex-tool" aria-label="Next car">&#9654;</button>';
    t.el.appendChild(bar);
    const [prev, next] = bar.querySelectorAll('button');
    t.on(prev, 'click', () => this.pick(t, -1));
    t.on(next, 'click', () => this.pick(t, 1));
    t.label = bar.querySelector('.ct-name');
  },
  carName(type) { const n = VEHICLE_TYPES[type].name.replace(/^an? /, ''); return n[0].toUpperCase() + n.slice(1); },
  pick(t, d) {
    if (t.state === 'loading' || t.state === 'drive') return;
    t.k = (t.k + d + CT_TYPES.length) % CT_TYPES.length;
    this.fresh(t);
    t.blip(620, 0.04, 'square', 0.03);
  },
  fresh(t) {
    t.car = Cars.make(CT_TYPES[t.k], null, 'E');
    t.state = 'ready'; t.pull = 0; t.x = -0.5; t.v = 0; t.crumple = 0; t.afterT = 0;
    t.label.textContent = this.carName(CT_TYPES[t.k]);
  },
  geo(t) {
    const s = HA.clamp(Math.min((t.W * 0.17) / 64, (t.H * 0.3) / 40), 0.6, 3.2);
    return { s, ground: t.H * 0.7, start: t.W * 0.26, wall: t.W * 0.84, maxPull: t.W * 0.16 };
  },
  down(t, e) {
    if (t.state !== 'ready' || (e && e.target.closest && e.target.closest('button'))) return;
    const G = this.geo(t), cx = G.start + t.x * G.s;
    if (Math.abs(t.p.x - cx) > (t.car.len / 2) * G.s + 40) return;
    t.state = 'pull'; t.pull0 = t.p.x;
  },
  move(t) { if (t.state === 'pull') t.pull = HA.clamp(t.pull0 - t.p.x, 0, this.geo(t).maxPull); },
  up(t) {
    if (t.state !== 'pull') return;
    const G = this.geo(t);
    if (t.pull < 8) { t.state = 'ready'; t.pull = 0; return; }
    const k = t.pull / G.maxPull;
    t.state = 'drive'; t.power = k;
    t.x = -t.pull / G.s; t.pull = 0; // off it goes from where it was pulled back to
    t.v = (0.7 + 2.6 * k) * t.W; // pixels a second
    t.kmh = Math.round(30 + k * 170);
    t.blip(120, 0.5, 'sawtooth', 0.06, 3);
    t.noise(0.4, 0.08, 2500, 'bandpass');
  },
  crash(t) {
    const G = this.geo(t), k = t.power;
    t.state = 'crashed'; t.tests++;
    Cars.wreck(t.car);
    t.crumple = Math.min(0.32, 0.08 + k * 0.26);
    t.v = -t.v * 0.12;
    t.shake = 6 + k * 14;
    t.afterT = 0;
    const n = t.low ? 18 : 40, boom = t.kmh >= 80, base = t.car.base;
    for (let i = 0; i < n; i++) { // bits of car and glass
      const a = Math.PI + HA.rand(-1.3, 1.3);
      t.parts.push({ x: G.wall - 4, y: G.ground - HA.rand(8, 40) * G.s * 0.6, vx: Math.cos(a) * HA.rand(80, 380) * (0.5 + k), vy: -HA.rand(80, 320) * (0.4 + k), life: HA.rand(0.8, 1.6), col: Math.random() < 0.3 ? '#cfe8ff' : base, size: HA.rand(2, 5), g: 900, kind: 'bit' });
    }
    if (boom) for (let i = 0; i < (t.low ? 14 : 34); i++) { // the fireball
      t.parts.push({ x: G.wall - HA.rand(0, 40), y: G.ground - HA.rand(5, 50) * G.s * 0.5, vx: HA.rand(-120, 40), vy: -HA.rand(30, 160), life: HA.rand(0.5, 1.1), size: HA.rand(10, 24) * G.s * 0.5, g: -40, kind: 'fire' });
    }
    t.noise(0.7, 0.4, boom ? 600 : 1200);
    t.blip(70, 0.5, 'sine', 0.2, 0.4);
    if (boom) t.later(() => { t.noise(0.9, 0.35, 400); t.blip(50, 0.7, 'sine', 0.2, 0.5); }, 90);
  },
  frame(t, dt, time) {
    const c = t.c, G = this.geo(t);
    // the cars load once this piece is actually on screen
    if (t.state === 'loading' && !t.asked && (t.visible || t.big)) {
      t.asked = true;
      HA.loadCars().then(() => { if (!t.dead) this.fresh(t); }).catch(() => { t.state = 'failed'; t.label.textContent = 'No cars today'; });
    }
    if (t.state === 'ready' && t.x < 0) t.x = Math.min(0, t.x + (dt * 320) / G.s); // rolling in
    if (t.state === 'drive') {
      t.x += (t.v * dt) / G.s;
      const front = G.start + (t.x + t.car.len / 2) * G.s;
      if (front >= G.wall) { t.x = (G.wall - G.start) / G.s - t.car.len / 2; this.crash(t); }
    } else if (t.state === 'crashed') {
      t.x += (t.v * dt) / G.s; t.v *= Math.exp(-4 * dt);
      t.afterT += dt;
      if (Math.random() < dt * 10) t.parts.push({ x: G.wall - 10 * G.s, y: G.ground - 18 * G.s, vx: HA.rand(-20, 10), vy: -HA.rand(30, 60), life: 1.4, size: HA.rand(6, 12), g: -10, kind: 'smoke' });
      if (t.afterT > 2.8) { this.fresh(t); t.x = -(G.start / G.s + t.car.len); }
    }
    t.shake = Math.max(0, t.shake - dt * 30);
    const sx = (Math.random() - 0.5) * t.shake, sy = (Math.random() - 0.5) * t.shake;
    c.save(); c.translate(sx, sy);
    // the test hall
    const wall = c.createLinearGradient(0, 0, 0, G.ground);
    wall.addColorStop(0, '#2b3038'); wall.addColorStop(1, '#4a515c');
    c.fillStyle = wall; c.fillRect(-20, -20, t.W + 40, G.ground + 20);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < t.W; x += 60) c.fillRect(x, 0, 2, G.ground - 40);
    c.fillStyle = '#fcc21b'; c.font = `900 ${Math.round(HA.clamp(t.W / 30, 12, 22))}px ${UI}`; c.textAlign = 'left';
    c.fillText('CRASH TEST', 14, 28);
    const road = 34 * 0.8 * G.s; // (Road Rush's ground squash, GY)
    c.fillStyle = '#3a3d44'; c.fillRect(-20, G.ground - road, t.W + 40, t.H - G.ground + road + 20);
    c.fillStyle = 'rgba(247,247,242,0.7)';
    for (let x = 0; x < G.wall; x += 34) c.fillRect(x, G.ground - 1, 18, 2);
    if (t.state === 'loading' || t.state === 'failed' || !t.car) {
      c.fillStyle = '#f7f7f2'; c.textAlign = 'center'; c.font = `800 14px ${UI}`;
      c.fillText(t.state === 'failed' ? 'The cars could not be loaded' : 'Loading the cars…', t.W / 2, G.ground - 40);
      c.restore();
      return;
    }
    Renderer.base = G.s; Renderer.dpr = t.dpr; // sharp cached car pictures at this size
    // the barrier, in Road Rush's blocks
    c.save(); c.translate(G.wall, G.ground); c.scale(G.s, G.s);
    Draw.box(c, 0, 34, -22, 22, 0, 30, '#a9a59a', '#8f8b80');
    for (let i = 0; i < 6; i++) { const col = i % 2 ? '#16181c' : '#fcc21b'; Draw.box(c, 2 + i * 5, 7 + i * 5, -22.6, -22, 16, 24, col, col); } // hazard stripes facing us
    Draw.box(c, -1, 35, -23, 23, 30, 32, '#c4c0b5', '#9a968b');
    c.restore();
    // the car (shortened from the front when it's crumpled)
    const car = t.car, cx = G.start + t.x * G.s - (t.state === 'pull' ? t.pull : 0);
    c.save(); c.translate(cx, G.ground); c.scale(G.s, G.s);
    Cars.shadow(c, car, 0.8);
    c.translate(-car.len / 2, 0); c.scale(1 - t.crumple, 1); c.translate(car.len / 2, 0);
    Cars.draw(c, car, time);
    c.restore();
    // pulling back: a strap to the car's tail, and how hard it'll hit
    if (t.state === 'pull' || t.state === 'ready') {
      const tail = cx - (car.len / 2) * G.s;
      if (t.state === 'pull') {
        c.strokeStyle = '#fcc21b'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(G.start - (car.len / 2) * G.s - 30, G.ground); c.lineTo(tail, G.ground - 6); c.stroke();
        const k = t.pull / G.maxPull;
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(t.W / 2 - 60, 40, 120, 8);
        c.fillStyle = k > 0.3 ? '#ff5a4a' : '#7be07b'; c.fillRect(t.W / 2 - 60, 40, 120 * k, 8);
        c.fillStyle = '#f7f7f2'; c.textAlign = 'center'; c.font = `800 12px ${UI}`;
        c.fillText(`${Math.round(30 + k * 170)} km/h`, t.W / 2, 64);
      } else if (t.x >= 0) {
        c.fillStyle = `rgba(247,247,242,${0.5 + 0.4 * Math.sin(time * 4)})`; c.textAlign = 'center'; c.font = `800 13px ${UI}`;
        c.fillText('◀ pull back', Math.max(46, cx - (car.len / 2) * G.s - 50), G.ground - 30);
      }
    }
    // flying bits, fire and smoke
    for (const p of t.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.kind === 'bit' && p.y > G.ground + 6) { p.y = G.ground + 6; p.vy *= -0.3; p.vx *= 0.6; }
      const a = Math.max(0, Math.min(1, p.life));
      if (p.kind === 'fire') { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,${120 + a * 120},40,${a * 0.8})`; c.beginPath(); c.arc(p.x, p.y, p.size * (1.4 - a * 0.5), 0, HA.TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
      else if (p.kind === 'smoke') { c.fillStyle = `rgba(60,60,66,${a * 0.4})`; c.beginPath(); c.arc(p.x, p.y, p.size * (2 - a), 0, HA.TAU); c.fill(); }
      else { c.globalAlpha = a; c.fillStyle = p.col; c.fillRect(p.x, p.y, p.size, p.size); c.globalAlpha = 1; }
    }
    t.parts = t.parts.filter(p => p.life > 0);
    c.restore();
    if (t.state === 'crashed') { // the result
      const stars = Math.max(1, Math.min(5, Math.ceil(t.kmh / 40)));
      c.fillStyle = 'rgba(22,24,28,0.8)'; c.fillRect(t.W / 2 - 92, 38, 184, 44);
      c.fillStyle = '#fcc21b'; c.textAlign = 'center'; c.font = `900 18px ${UI}`;
      c.fillText(`IMPACT ${t.kmh} km/h`, t.W / 2, 60);
      c.fillStyle = '#ff5a4a'; c.font = `900 12px ${UI}`;
      c.fillText('💥'.repeat(stars), t.W / 2, 76);
    }
  },
});
