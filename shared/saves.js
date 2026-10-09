'use strict';
// Saves: everything the Solarian Arcade keeps in this browser (every game's progress,
// the shared coin wallet, and the settings) as one bundle that can be downloaded as a
// file, copied as a code, and restored. Each game keeps an undo copy just before it
// resets, and a restore can be undone too.
//
// A page that is open while a backup is restored in another tab reloads itself, so it
// can never write its old progress back over the restored one.

const Saves = (() => {
  // Where each game keeps its things ("toybox." is the Hall of Art's old name).
  const PREFIXES = ['roadrush.', 'traffic.', 'boomrun.', 'hall.', 'toybox.'];
  const UNDO = 'solarian.undo';           // the undo copy (one, the latest)
  const LAST = 'solarian.lastBackup';     // when you last saved a backup
  const RESTORED = 'solarian.restored';   // tells other open tabs to reload
  const GAME = 'Solarian Arcade';
  const VERSION = 1;
  const CODE_TAG = 'SOLARIAN-SAVE-1';     // then Z (compressed) or J (plain), a dot, and the data
  const MAX_CHARS = 4500000;              // browsers keep about 5 MB per site
  const MAX_FILE = 8000000;               // bigger than any real backup

  const within = (key, prefixes) => prefixes.some(p => key.startsWith(p));

  // Every saved value under these prefixes, exactly as stored.
  function collect(prefixes = PREFIXES) {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && within(k, prefixes)) out[k] = localStorage.getItem(k);
      }
    } catch (e) { /* storage blocked */ }
    return out;
  }

  // The whole arcade as a backup, keys in order (so the same progress always reads the same).
  function bundle() {
    const all = collect(), keys = {};
    for (const k of Object.keys(all).sort()) keys[k] = all[k];
    return { game: GAME, kind: 'backup', version: VERSION, saved: new Date().toISOString(), keys };
  }

  // The headline numbers in a set of saved values (for the menu, and to compare a backup with now).
  function summary(keys) {
    const read = k => { try { return typeof keys[k] === 'string' ? JSON.parse(keys[k]) : null; } catch (e) { return null; } };
    const num = v => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    const tried = read('hall.tried') || read('toybox.tried');
    return {
      coins: num(read('roadrush.coins')),
      rr: num(read('roadrush.best')),
      tc: num(read('traffic.stars')),
      br: num(read('boomrun.best')),
      ha: Array.isArray(tried) ? tried.length : 0,
    };
  }

  // ---- Reading a backup someone hands you ------------------------------------------------
  // Only the arcade's own keys get in, every value must be the JSON the games write, and the
  // whole thing must fit in the browser. (The games cope with odd values themselves.)
  function check(obj) {
    if (!obj || typeof obj !== 'object' || obj.game !== GAME || obj.kind !== 'backup' || !Number.isInteger(obj.version)) return { ok: false, error: 'not-backup' };
    if (obj.version > VERSION) return { ok: false, error: 'newer' };
    const src = obj.keys;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return { ok: false, error: 'not-backup' };
    const keys = {};
    let size = 0, skipped = 0;
    for (const k of Object.keys(src)) {
      const v = src[k];
      let good = typeof v === 'string' && k.length <= 120 && within(k, PREFIXES);
      if (good) { try { JSON.parse(v); } catch (e) { good = false; } }
      if (!good) { skipped++; continue; }
      size += k.length + v.length;
      keys[k] = v;
    }
    if (size > MAX_CHARS) return { ok: false, error: 'too-big' };
    if (!Object.keys(keys).length) return { ok: false, error: 'empty' };
    const when = Date.parse(obj.saved);
    return { ok: true, keys, saved: isFinite(when) ? when : null, skipped };
  }

  // Put these values in place of everything under the prefixes. If the browser runs out of
  // room halfway, what was there before goes back.
  function apply(keys, prefixes) {
    const before = collect(prefixes);
    try {
      for (const k of Object.keys(before)) localStorage.removeItem(k);
      for (const k of Object.keys(keys)) if (within(k, prefixes)) localStorage.setItem(k, keys[k]);
      return true;
    } catch (e) {
      try {
        for (const k of Object.keys(collect(prefixes))) localStorage.removeItem(k);
        for (const k of Object.keys(before)) localStorage.setItem(k, before[k]);
      } catch (e2) { /* nothing more we can do */ }
      return false;
    }
  }

  // ---- Undo ------------------------------------------------------------------------------
  // Keep a copy of what's under these prefixes, to bring back later (replaces the last copy).
  function keepUndo(label, prefixes = PREFIXES) {
    const copy = JSON.stringify({ label, at: Date.now(), prefixes, keys: collect(prefixes) });
    try { localStorage.setItem(UNDO, copy); return true; } catch (e) { /* maybe the old copy is in the way */ }
    try { localStorage.removeItem(UNDO); localStorage.setItem(UNDO, copy); return true; } catch (e) { return false; }
  }

  function readUndo() {
    let u;
    try { u = JSON.parse(localStorage.getItem(UNDO)); } catch (e) { return null; }
    if (!u || typeof u !== 'object' || typeof u.label !== 'string' || !isFinite(u.at) || !Array.isArray(u.prefixes) || !u.keys || typeof u.keys !== 'object') return null;
    const prefixes = u.prefixes.filter(p => PREFIXES.includes(p));
    if (!prefixes.length) return null;
    const keys = {};
    for (const k of Object.keys(u.keys)) if (typeof u.keys[k] === 'string' && within(k, prefixes)) keys[k] = u.keys[k];
    return { label: u.label.slice(0, 80), at: u.at, prefixes, keys };
  }

  // Bring back the undo copy (and keep what it replaces, so the undo can be undone).
  function undo() {
    const u = readUndo();
    if (!u) return 'none';
    if (!keepUndo('before you pressed Undo', u.prefixes)) return 'no-room';
    if (!apply(u.keys, u.prefixes)) return 'failed';
    signal();
    return 'ok';
  }

  // Replace the whole arcade with a checked backup (keeping an undo copy first).
  function restore(keys) {
    if (!keepUndo('before you restored a backup')) return 'no-room';
    if (!apply(keys, PREFIXES)) return 'failed';
    signal();
    return 'ok';
  }

  // Other open tabs reload (see the listener at the bottom).
  function signal() { try { localStorage.setItem(RESTORED, String(Date.now())); } catch (e) { /* ignore */ } }

  // ---- Files and codes -------------------------------------------------------------------
  function fileName(when = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `solarian-arcade-backup-${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}.json`;
  }

  function download(b = bundle()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const toB64 = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64 = s => {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  // Run bytes through a (de)compression stream, giving up past `cap` bytes (a code from
  // someone else could unpack to something huge).
  async function pipe(bytes, stream, cap) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > cap) { reader.cancel(); throw new Error('too big'); }
      parts.push(value);
    }
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }

  // The backup as one line of text (compressed where the browser can).
  async function encode(b = bundle()) {
    const bytes = new TextEncoder().encode(JSON.stringify(b));
    if (typeof CompressionStream === 'function') {
      try { return `${CODE_TAG}Z.${toB64(await pipe(bytes, new CompressionStream('deflate'), MAX_FILE))}`; } catch (e) { /* write it plain */ }
    }
    return `${CODE_TAG}J.${toB64(bytes)}`;
  }

  // A pasted code (or a backup file's text) back into a checked backup.
  async function decode(text) {
    const t = String(text || '').trim();
    if (t.startsWith('{')) { try { return check(JSON.parse(t)); } catch (e) { return { ok: false, error: 'broken' }; } }
    const flat = t.replace(/\s+/g, ''), at = flat.indexOf(CODE_TAG);
    if (at < 0) return { ok: false, error: 'not-backup' };
    const kind = flat[at + CODE_TAG.length], body = flat.slice(at + CODE_TAG.length + 2);
    if (flat[at + CODE_TAG.length + 1] !== '.' || !/^[A-Za-z0-9_-]+$/.test(body) || (kind !== 'Z' && kind !== 'J')) return { ok: false, error: 'broken' };
    let bytes;
    try { bytes = fromB64(body); } catch (e) { return { ok: false, error: 'broken' }; }
    if (kind === 'Z') {
      if (typeof DecompressionStream !== 'function') return { ok: false, error: 'old-browser' };
      try { bytes = await pipe(bytes, new DecompressionStream('deflate'), MAX_FILE); } catch (e) { return { ok: false, error: e.message === 'too big' ? 'too-big' : 'broken' }; }
    }
    try { return check(JSON.parse(new TextDecoder().decode(bytes))); } catch (e) { return { ok: false, error: 'broken' }; }
  }

  async function readFile(file) {
    if (!file) return { ok: false, error: 'not-backup' };
    if (file.size > MAX_FILE) return { ok: false, error: 'too-big' };
    try { return decode(await file.text()); } catch (e) { return { ok: false, error: 'broken' }; }
  }

  // When you last saved a backup (a file or a code), or null.
  function markSaved() { try { localStorage.setItem(LAST, String(Date.now())); } catch (e) { /* ignore */ } }
  function lastSaved() {
    try { const v = Number(localStorage.getItem(LAST)); return v > 0 && isFinite(v) ? v : null; } catch (e) { return null; }
  }

  return {
    PREFIXES, RESTORED, collect, bundle, summary, check, keepUndo, readUndo, undo, restore,
    download, encode, decode, readFile, markSaved, lastSaved,
  };
})();

// Copy text for the player to paste somewhere (a backup code, a share code). Falls back
// to selecting it in `field` where the browser won't let a page write to the clipboard.
async function copyText(text, field) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* try the old way */ }
  if (!field) return false;
  field.focus();
  field.select();
  try { return document.execCommand('copy'); } catch (e) { return false; }
}

// A backup was restored (or undone) in another tab: start this page over with it.
addEventListener('storage', e => { if (e.key === Saves.RESTORED) location.reload(); });
