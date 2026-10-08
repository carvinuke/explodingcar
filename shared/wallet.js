'use strict';
// The arcade's coin wallet, shared by every game. It lives in Road Rush's
// original coin slot (localStorage "roadrush.coins") so nobody loses coins.
// Every change re-reads the stored value first, so two games open in two
// tabs never overwrite each other's coins.
const Wallet = (() => {
  const KEY = 'roadrush.coins';
  const subs = [];

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (e) { return 0; }
  }
  function write(n) {
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* storage blocked: coins last this visit only */ }
    for (const f of subs) f(n);
  }

  // another tab (or game) changed the wallet
  addEventListener('storage', e => { if (e.key === KEY || e.key === null) { const n = read(); for (const f of subs) f(n); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const n = read(); for (const f of subs) f(n); } });

  return {
    get: read,
    add(n) {
      n = Math.max(0, Math.floor(n) || 0);
      const v = read() + n;
      write(v);
      return v;
    },
    spend(n) {
      n = Math.max(0, Math.floor(n) || 0);
      const v = read();
      if (v < n) return false;
      write(v - n);
      return true;
    },
    onChange(fn) { subs.push(fn); },
  };
})();

// A tiny per-game storage helper: Store-like, with the game's own prefix.
function makeStore(prefix) {
  return {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(prefix + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    // Typed reads: a damaged or hand-edited save gives the fallback instead of
    // stopping a game from starting (or turning its numbers into nonsense).
    num(key, fallback = 0, min = 0, max = 1e12) {
      const v = this.get(key, fallback);
      return typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
    },
    list(key) { const v = this.get(key, []); return Array.isArray(v) ? v : []; },
    obj(key) { const v = this.get(key, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; },
    wipe() {
      try {
        const doomed = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) doomed.push(k);
        }
        for (const k of doomed) localStorage.removeItem(k);
      } catch (e) { /* ignore */ }
    },
  };
}
