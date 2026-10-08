'use strict';
// Hall of Art: the runner. Every exhibit is a tile; exhibits only animate while their tile
// is on screen (one shared frame loop), and any exhibit can open full screen.
//
// An exhibit: Exhibits.add({ id, name, section, hint, canvas?, setup(t), frame?(t, dt, time),
//                   resize?(t), down?(t), up?(t), move?(t), destroy?(t), still? })
// `t` is that exhibit's own instance: t.el (the stage), t.c / t.W / t.H for canvas
// exhibits, t.p (the pointer: x, y, down, inside, vx, vy), t.low, t.big, t.blip().
// Listeners on anything outside the stage go through t.on(target, type, fn), and
// timers through t.later(fn, ms): both are cleaned up when the exhibit stops, so
// restarting exhibits or opening them full screen never piles up old copies.

const HALL_STORE = makeStore('hall.');
// bring over anything saved back when this page was called the Toy Box
try {
  for (const k of ['tried', 'low']) {
    const old = localStorage.getItem('toybox.' + k);
    if (old !== null && localStorage.getItem('hall.' + k) === null) localStorage.setItem('hall.' + k, old);
  }
} catch (e) { /* storage blocked */ }
const UI = "Overpass, 'Arial Narrow', Arial, system-ui, sans-serif";
const HALL_WINGS = {
  buttons: { name: 'Living Buttons', sub: 'Press them. Hold them. Hover over them.' },
  motion:  { name: 'Moving Pictures', sub: 'Pieces that move on their own, and move more when you touch them.' },
  text:    { name: 'Lettering', sub: 'Words that refuse to sit still.' },
  physics: { name: 'Sculpture & Physics', sub: 'Drag, drop, swing and throw.' },
  music:   { name: 'Music Room', sub: 'Make some noise.' },
  cars:    { name: 'Road Works', sub: 'Pieces from the arcade\u2019s own roads.' },
};

const Exhibits = {
  list: [],
  live: [],   // running instances
  low: false,
  still: matchMedia('(prefers-reduced-motion: reduce)').matches,

  add(def) { this.list.push(def); },

  // ---- Sound: tiny synth blips (shared mute with the other games) ----------------
  audio: null,
  get muted() { try { return JSON.parse(localStorage.getItem('roadrush.muted')) === true; } catch (e) { return false; } },
  setMuted(m) { try { localStorage.setItem('roadrush.muted', JSON.stringify(m)); } catch (e) { /* ignore */ } },
  blip(freq = 660, dur = 0.08, type = 'sine', vol = 0.12, slide = 0) {
    if (this.muted) return;
    try {
      if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
      const a = this.audio, o = a.createOscillator(), g = a.createGain(), now = a.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g); g.connect(a.destination);
      o.start(now); o.stop(now + dur + 0.02);
    } catch (e) { /* no audio */ }
  },
  noise(dur = 0.3, vol = 0.2, freq = 900, type = 'lowpass') {
    if (this.muted) return;
    try {
      if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
      const a = this.audio, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
      const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
      f.type = type; f.frequency.value = freq;
      s.buffer = buf; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(a.destination); s.start();
    } catch (e) { /* no audio */ }
  },

  // ---- Instances ----------------------------------------------------------------
  // Start an exhibit inside `stage` (a tile, or the full-screen view).
  start(def, stage, big) {
    const ac = new AbortController(), timers = new Set();
    const t = {
      def, el: stage, big: !!big, low: this.low, visible: !big ? false : true, awakeT: 0,
      p: { x: -1e4, y: -1e4, down: false, inside: false, vx: 0, vy: 0, lx: 0, ly: 0 },
      blip: (...a) => this.blip(...a), noise: (...a) => this.noise(...a),
      ac, timers,
      on: (target, type, fn, opts) => target.addEventListener(type, fn, Object.assign({}, opts, { signal: ac.signal })),
      later: (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); if (!t.dead) fn(); }, ms);
        timers.add(id);
        return id;
      },
    };
    stage.innerHTML = '';
    // back to the plain stage: the full-screen view is shared by every exhibit,
    // and each one adds its own backdrop classes (brick, paper, dark...)
    if (stage.dataset.base === undefined) stage.dataset.base = stage.className;
    stage.className = stage.dataset.base;
    if (def.canvas) {
      t.cv = document.createElement('canvas');
      t.cv.className = 'ex-cv';
      stage.appendChild(t.cv);
      t.c = t.cv.getContext('2d');
    }
    this.size(t);
    this.pointer(t);
    this.live.push(t);
    try { def.setup(t); } catch (err) { this.broke(t, err); }
    return t;
  },

  stop(t) {
    this.live = this.live.filter(x => x !== t);
    t.dead = true;
    if (t.def.destroy) { try { t.def.destroy(t); } catch (err) { /* already going */ } }
    t.ac.abort(); // every listener the runner or the exhibit added through t.on
    for (const id of t.timers) clearTimeout(id);
    t.timers.clear();
  },

  // An exhibit that throws stops on its own (the rest of the hall keeps going)
  // and offers to start again.
  broke(t, err) {
    if (t.broken) return;
    t.broken = true;
    console.error(`Hall of Art: "${t.def.name}" stopped`, err);
    const el = t.el;
    el.classList.add('broken');
    const b = document.createElement('button');
    b.className = 'ex-restart';
    b.textContent = 'Tap to restart this piece';
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (t.big) { this.stop(t); this.bigEx = this.start(t.def, el, true); return; }
      this.stop(t);
      const nt = this.start(t.def, el, false);
      el._ex = nt;
      nt.visible = t.visible;
    }, { signal: t.ac.signal });
    el.appendChild(b);
  },

  size(t) {
    const r = t.el.getBoundingClientRect();
    t.W = Math.max(1, Math.round(r.width));
    t.H = Math.max(1, Math.round(r.height));
    t.dpr = Math.min(this.low ? 1 : 1.5, window.devicePixelRatio || 1);
    if (t.cv) {
      t.cv.width = Math.round(t.W * t.dpr);
      t.cv.height = Math.round(t.H * t.dpr);
      t.c.setTransform(t.dpr, 0, 0, t.dpr, 0, 0);
    }
  },

  pointer(t) {
    const el = t.el, p = t.p, on = (type, fn) => t.on(el, type, fn);
    const at = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const safe = fn => e => { if (t.broken || t.dead) return; try { fn(e); } catch (err) { this.broke(t, err); } };
    on('pointerdown', safe(e => {
      [p.x, p.y] = at(e); p.lx = p.x; p.ly = p.y;
      p.down = true; p.inside = true;
      t.awakeT = 3;
      // Hold on to the pointer for dragging, but not when the press is on a button
      // or link: capturing would steal its click (and its pointerup) from it.
      if (!e.target.closest('button, a, input, select, textarea, [data-free]')) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      Exhibits.tried(t.def.id);
      if (t.def.down) t.def.down(t, e);
    }));
    on('pointermove', safe(e => {
      const [x, y] = at(e);
      p.vx = x - p.x; p.vy = y - p.y;
      p.x = x; p.y = y; p.inside = true;
      t.awakeT = 3;
      if (t.def.move) t.def.move(t, e);
    }));
    const up = safe(e => { if (!p.down) return; p.down = false; if (t.def.up) t.def.up(t, e); });
    on('pointerup', up);
    on('pointercancel', up);
    on('pointerleave', () => { p.inside = false; if (!p.down) { p.x = -1e4; p.y = -1e4; } });
  },

  // ---- The loop ----------------------------------------------------------------
  run() {
    let last = performance.now(), avg = 16, frameNo = 0;
    const step = now => {
      const raw = Math.max(0, now - last); // the first frame's timestamp can be a hair before `last`
      const dt = Math.min(0.05, raw / 1000);
      last = now;
      const time = now / 1000;
      // a slow computer: exhibits take turns, each updating every other frame
      avg = avg * 0.95 + Math.min(100, raw) * 0.05;
      const turns = avg > 24;
      frameNo++;
      // still struggling after a few seconds: switch to low graphics by itself (once)
      this.slowT = avg > 28 && !this.low ? (this.slowT || 0) + dt : 0;
      if (this.slowT > 3 && !this.autoLow) {
        this.autoLow = true;
        this.low = true;
        document.getElementById('set-low').setAttribute('aria-checked', 'true');
        this.restartAll();
        const note = document.getElementById('auto-low');
        if (note) { note.classList.remove('hidden'); setTimeout(() => note.classList.add('hidden'), 6000); }
      }
      requestAnimationFrame(step); // first, so one bad frame can never stop the loop
      let n = 0;
      for (const t of this.live.slice()) {
        n++;
        if (turns && !t.big && (n + frameNo) % 2 && t.drawnOnce) continue;
        if (!t.def.frame || t.dead || t.broken) continue;
        if (!t.visible && t.drawnOnce) continue; // off screen: rest (but draw once, so nothing starts blank)
        if (this.bigEx && !t.big) continue; // the grid rests while one exhibit is full screen
        if (this.still && !t.big && t.awakeT <= 0 && t.drawnOnce) continue; // reduced motion: only while you play
        t.awakeT -= dt;
        try { t.def.frame(t, turns && !t.big ? Math.min(0.05, dt * 2) : dt, time); } catch (err) { this.broke(t, err); }
        t.drawnOnce = true;
        t.p.vx *= 0.8; t.p.vy *= 0.8;
      }
    };
    requestAnimationFrame(step);
  },

  // ---- Exhibits you've tried (the arcade picker shows how many) -----------------------
  triedSet: null,
  tried(id) {
    if (!this.triedSet) this.triedSet = new Set(HALL_STORE.get('tried', []) || []);
    if (this.triedSet.has(id)) return;
    this.triedSet.add(id);
    HALL_STORE.set('tried', [...this.triedSet]);
    const n = document.getElementById('tried-count');
    if (n) n.textContent = this.triedSet.size;
    const tile = document.querySelector(`.tile[data-id="${id}"]`);
    if (tile) tile.classList.add('tried');
  },

  // ---- Page ---------------------------------------------------------------------
  build() {
    this.low = !!HALL_STORE.get('low', false);
    this.triedSet = new Set(HALL_STORE.get('tried', []) || []);
    const main = document.getElementById('exhibits');
    const io = new IntersectionObserver(entries => {
      for (const en of entries) { const t = en.target._ex; if (t) t.visible = en.isIntersecting; }
    }, { threshold: 0.15 });
    this.io = io;
    // lay out every shelf first, then start the exhibits (they measure their tiles)
    const made = [];
    for (const sid in HALL_WINGS) {
      const S = HALL_WINGS[sid], defs = this.list.filter(d => d.section === sid);
      if (!defs.length) continue;
      const sec = document.createElement('section');
      sec.className = 'shelf';
      sec.innerHTML = `<header class="shelf-head"><h2></h2><p></p></header><div class="tiles"></div>`;
      sec.querySelector('h2').textContent = S.name;
      sec.querySelector('p').textContent = S.sub;
      const grid = sec.querySelector('.tiles');
      for (const d of defs) {
        const tile = document.createElement('article');
        tile.className = 'tile' + (this.triedSet.has(d.id) ? ' tried' : '') + (d.wide ? ' wide' : '');
        tile.dataset.id = d.id;
        tile.innerHTML = `<div class="stage"></div><footer><b></b><span></span><button class="grow" aria-label="Open full screen" title="Full screen">⤢</button></footer>`;
        tile.querySelector('b').textContent = d.name;
        tile.querySelector('span').textContent = d.hint || '';
        tile.querySelector('.grow').addEventListener('click', () => this.open(d));
        grid.appendChild(tile);
        made.push([d, tile.querySelector('.stage')]);
      }
      main.appendChild(sec);
    }
    for (const [d, stage] of made) {
      const t = this.start(d, stage, false);
      stage._ex = t;
      io.observe(stage);
    }
    document.getElementById('tried-count').textContent = this.triedSet.size;
    document.getElementById('exhibit-count').textContent = this.list.length;

    // keep sizes right
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        for (const t of this.live) {
          this.size(t);
          if (t.def.resize && !t.broken) { try { t.def.resize(t); } catch (err) { this.broke(t, err); } }
        }
      }, 120);
    });

    // full screen view
    document.getElementById('big-close').addEventListener('click', () => this.close());
    addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });

    // settings in the header
    const low = document.getElementById('set-low');
    const syncLow = () => low.setAttribute('aria-checked', this.low ? 'true' : 'false');
    syncLow();
    low.addEventListener('click', () => { this.low = !this.low; HALL_STORE.set('low', this.low); syncLow(); this.restartAll(); });
    const mute = document.getElementById('btn-mute');
    const syncMute = () => { mute.textContent = this.muted ? 'Sound off' : 'Sound on'; mute.classList.toggle('off', this.muted); };
    syncMute();
    mute.addEventListener('click', () => { this.setMuted(!this.muted); syncMute(); if (!this.muted) this.blip(880, 0.08); });
    this.run();
  },

  restartAll() {
    for (const t of this.live.slice()) {
      if (t.big) continue;
      this.stop(t);
      const nt = this.start(t.def, t.el, false);
      t.el._ex = nt;
      nt.visible = t.visible;
    }
  },

  open(def) {
    const box = document.getElementById('big'), stage = document.getElementById('big-stage');
    document.getElementById('big-name').textContent = def.name;
    document.getElementById('big-hint').textContent = def.hint || '';
    box.classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (this.bigEx) this.stop(this.bigEx);
    this.bigEx = this.start(def, stage, true);
    this.tried(def.id);
    document.getElementById('big-close').focus();
  },

  close() {
    const box = document.getElementById('big');
    if (box.classList.contains('hidden')) return;
    box.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (this.bigEx) { this.stop(this.bigEx); this.bigEx = null; }
    document.getElementById('big-stage').innerHTML = '';
  },
};

// Little helpers the exhibits share.
const HA = {
  rand: (a, b) => a + Math.random() * (b - a),
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  TAU: Math.PI * 2,
  hsl: (h, s = 90, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`,
  // a gentle 2D value-noise, good enough for flow fields
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
    const s = v => v * v * (3 - 2 * v);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },
  // a spring for DOM exhibits: call step(target, dt) each frame
  spring(k = 220, damping = 14) {
    return { x: 0, v: 0, step(target, dt) { const f = -k * (this.x - target) - damping * this.v; this.v += f * dt; this.x += this.v * dt; return this.x; } };
  },
  // A row of small buttons in a corner of the stage ('tl', 'tr', 'bl', 'br'):
  // items are [label, onClick(button), pressed?]. Returns the buttons.
  tools(t, items, where = 'tl') {
    const bar = document.createElement('div');
    bar.className = 'ex-tools ' + where;
    const btns = items.map(([label, fn, on]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex-tool' + (on ? ' on' : '');
      b.textContent = label;
      t.on(b, 'click', () => fn(b));
      bar.appendChild(b);
      return b;
    });
    t.el.appendChild(bar);
    return btns;
  },
  // Road Rush's real car drawings, loaded the first time an exhibit asks for them
  // (plain script tags, so it works straight from the folder too).
  carsReady: null,
  loadCars() {
    if (!this.carsReady) this.carsReady = new Promise((ok, fail) => {
      const files = ['../road-rush/js/util.js', '../shared/rr-bridge.js', '../road-rush/js/draw.js', '../road-rush/js/carshape.js',
        '../road-rush/js/vehicles.js', '../road-rush/js/luxury.js', '../shared/cars.js'];
      const next = i => {
        if (i >= files.length) { ok(); return; }
        const s = document.createElement('script');
        s.src = files[i];
        s.onload = () => next(i + 1);
        s.onerror = () => { this.carsReady = null; fail(new Error('could not load ' + files[i])); };
        document.head.appendChild(s);
      };
      next(0);
    });
    return this.carsReady;
  },
};
