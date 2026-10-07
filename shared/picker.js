'use strict';
// The Solarian Arcade menu: fills in the wallet and each game's best, and turns
// the hovered panel toward the cursor.

(() => {
  const read = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  };
  const num = v => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const $ = id => document.getElementById(id);

  // ---- Numbers ------------------------------------------------------------------
  function refresh() {
    $('wallet').textContent = Wallet.get().toLocaleString();
    $('stat-rr').textContent = num(read('roadrush.best', 0)).toLocaleString();
    $('stat-tc').textContent = num(read('traffic.stars', 0)).toLocaleString();
    $('stat-br').textContent = num(read('boomrun.best', 0)).toLocaleString();
    const seen = read('hall.tried', null) || read('toybox.tried', []); // the Hall of Art used to be the Toy Box
    $('stat-ha').textContent = Array.isArray(seen) ? seen.length : 0;
  }
  refresh();
  Wallet.onChange(refresh);
  addEventListener('pageshow', refresh); // coming back with the browser's Back button

  // ---- Turn toward the cursor -------------------------------------------------
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  for (const panel of document.querySelectorAll('.panel')) {
    let frame = 0, ev = null;
    const apply = () => {
      frame = 0;
      if (!ev) return;
      const r = panel.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      const px = x - 0.5, py = y - 0.5;
      panel.style.setProperty('--ry', `${(px * 16).toFixed(2)}deg`);
      panel.style.setProperty('--rx', `${(-py * 11).toFixed(2)}deg`);
      panel.style.setProperty('--px', px.toFixed(3));
      panel.style.setProperty('--py', py.toFixed(3));
      panel.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      panel.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    panel.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || still.matches) return;
      ev = e;
      if (!frame) frame = requestAnimationFrame(apply);
    });
    panel.addEventListener('pointerleave', () => {
      ev = null;
      for (const k of ['--rx', '--ry', '--px', '--py', '--mx', '--my']) panel.style.removeProperty(k);
    });
  }
})();
