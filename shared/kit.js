'use strict';
// Small helpers the new arcade games share: a canvas that stays sharp but
// cheap, a frame loop that sleeps when the tab is hidden, screens, toasts,
// trophies and shop bookkeeping.

const Kit = {
  $(id) { return document.getElementById(id); },
  fmt(n) { return Math.floor(n).toLocaleString(); },

  // Seeded random numbers (0..1): the same seed always gives the same sequence.
  seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // ---- Canvas -----------------------------------------------------------------
  // Pixel ratio is capped at 1.5 (1 on low graphics) to stay fast on slow computers.
  view(canvas, opts = {}) {
    const v = {
      canvas, c: canvas.getContext('2d', { alpha: false }), W: 1, H: 1, dpr: 1, low: !!opts.low,
      resize() {
        const cap = v.low ? 1 : 1.5;
        v.dpr = Math.min(cap, window.devicePixelRatio || 1);
        v.W = Math.max(1, canvas.clientWidth || window.innerWidth);
        v.H = Math.max(1, canvas.clientHeight || window.innerHeight);
        canvas.width = Math.round(v.W * v.dpr);
        canvas.height = Math.round(v.H * v.dpr);
        if (opts.onResize) opts.onResize(v);
      },
    };
    addEventListener('resize', () => v.resize());
    v.resize();
    return v;
  },

  // ---- Frame loop -------------------------------------------------------------
  loop(step) {
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      step(dt, now / 1000);
      requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    requestAnimationFrame(frame);
  },

  // ---- Screens ------------------------------------------------------------------
  show(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.toggle('hidden', el.id !== id);
  },
  hideScreens() { for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden'); },
  shown(id) { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); },

  // ---- Toasts -------------------------------------------------------------------
  toast(text, cls = '', ms = 2200) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
  },

  // ---- Mute button (the mute setting is shared with Road Rush) ------------------
  ICON_ON: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  ICON_OFF: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  muteButton(btn) {
    const sync = () => {
      btn.innerHTML = Sound.muted ? Kit.ICON_OFF : Kit.ICON_ON;
      btn.setAttribute('aria-label', Sound.muted ? 'Unmute' : 'Mute');
      btn.classList.toggle('off', Sound.muted);
    };
    btn.addEventListener('click', () => { Sound.init(); Sound.setMuted(!Sound.muted); sync(); });
    sync();
    return sync;
  },

  // ---- Trophies -----------------------------------------------------------------
  // defs: { id: { name, desc, coins } }. Earned ids are kept in store under 'trophies'.
  trophies(defs, store, onEarn) {
    const got = new Set((store.get('trophies', []) || []).filter(id => defs[id]));
    return {
      defs,
      has(id) { return got.has(id); },
      get count() { return got.size; },
      get total() { return Object.keys(defs).length; },
      earn(id) {
        if (!defs[id] || got.has(id)) return false;
        got.add(id);
        store.set('trophies', [...got]);
        if (defs[id].coins) Wallet.add(defs[id].coins);
        if (onEarn) onEarn(defs[id], id);
        return true;
      },
      reset() { got.clear(); },
    };
  },

  // Fill a trophy list element.
  renderTrophies(el, T) {
    el.innerHTML = '';
    for (const id in T.defs) {
      const d = T.defs[id], li = document.createElement('li');
      li.className = T.has(id) ? 'got' : '';
      li.innerHTML = `<span class="tro-ico">${T.has(id) ? '★' : '☆'}</span><span class="tro-txt"><b></b><em></em></span><span class="tro-coins">${d.coins ? '+' + d.coins : ''}</span>`;
      li.querySelector('b').textContent = d.name;
      li.querySelector('em').textContent = d.desc;
      el.appendChild(li);
    }
  },

  // Sound needs a tap or key press before browsers let it play.
  unlockAudio() {
    const go = () => { Sound.init(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
    addEventListener('pointerdown', go);
    addEventListener('keydown', go);
  },
};
