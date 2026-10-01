'use strict';
// Shared constants and small helpers used by every system.

const TILE = 40;              // world units per grid cell
const COLS = 11;              // playable columns
const WORLD_W = COLS * TILE;  // playable width in world units
const START_COL = 5;
const GY = 0.8;               // ground foreshortening (depth -> screen)
const GZ = 0.95;              // height -> screen

const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sign = v => (v < 0 ? -1 : 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeOutQuad = t => 1 - (1 - t) * (1 - t);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const smoothstep = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

// Pick from [[value, weight], ...]
function weighted(entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  let r = Math.random() * total;
  for (const e of entries) if ((r -= e[1]) <= 0) return e[0];
  return entries[entries.length - 1][0];
}

// Grid <-> world
const cellX = col => (col + 0.5) * TILE;

// Oblique projection: world (y = forward, z = up) -> screen y offset.
const P = (y, z = 0) => -(y * GY + z * GZ);

// Difficulty 0..1 by rows travelled: ramps early, then flattens out.
// Hardcore mode starts further along the curve.
const DIFF = { offset: 0 };
const difficulty = row => 1 - Math.exp(-Math.max(0, row + DIFF.offset) / 170);

// Smooth pseudo-noise in roughly [-1, 1] for camera shake.
const wobble = t => (Math.sin(t) + 0.5 * Math.sin(t * 2.3 + 1.3) + 0.25 * Math.sin(t * 4.1 + 2.1)) / 1.75;

// Colors
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
// amt < 0 darkens, amt > 0 lightens
function shade(hex, amt) {
  const f = c => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(f(r), f(g), f(b));
}
// h in degrees, s and l 0..1 -> '#rrggbb' (for the rainbow skins).
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return rgbToHex(f(0), f(8), f(4));
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(Math.round(lerp(A[0], B[0], t)), Math.round(lerp(A[1], B[1], t)), Math.round(lerp(A[2], B[2], t)));
}

// localStorage can throw (private mode, blocked storage) - never let it break the game.
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('roadrush.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('roadrush.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
  // Delete every bit of progress, keeping only settings, controls and mute.
  wipeProgress() {
    try {
      const keep = ['roadrush.settings', 'roadrush.muted'];
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('roadrush.') && !keep.includes(k)) doomed.push(k);
      }
      for (const k of doomed) localStorage.removeItem(k);
    } catch (e) { /* ignore */ }
  },
};

// Player settings. Graphic mode is opt-in and always starts off.
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const Settings = {
  gore: false,
  shake: true,
  ghost: true,
  replay: true,
  motion: false,     // reduced motion
  colorblind: false,
  keys: { ...DEFAULT_KEYS },
  load() {
    const s = Store.get('settings', {}) || {};
    let prefersReduced = false;
    try { prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    this.gore = s.gore === true;
    this.shake = s.shake !== false;
    this.ghost = s.ghost !== false;
    this.replay = s.replay !== false;
    this.motion = s.motion === undefined ? prefersReduced : s.motion === true;
    this.colorblind = s.colorblind === true;
    this.keys = { ...DEFAULT_KEYS };
    if (s.keys && typeof s.keys === 'object') {
      for (const k in DEFAULT_KEYS) if (typeof s.keys[k] === 'string') this.keys[k] = s.keys[k];
    }
  },
  save() {
    Store.set('settings', {
      gore: this.gore, shake: this.shake, ghost: this.ghost, replay: this.replay,
      motion: this.motion, colorblind: this.colorblind, keys: this.keys,
    });
  },
  // Camera shake is off when the player turned it off or asked for reduced motion.
  get shakes() { return this.shake && !this.motion; },
};
Settings.load();

// Seeded randomness for world layout (the same seed always builds the same road).
// Effects and traffic timing keep using Math.random.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Gen = {
  r: Math.random,
  seed(s) { this.r = mulberry32(s); },
  rand(a, b) { return b === undefined ? this.r() * a : a + this.r() * (b - a); },
  int(a, b) { return Math.floor(a + this.r() * (b - a + 1)); },
  chance(p) { return this.r() < p; },
  pick(arr) { return arr[(this.r() * arr.length) | 0]; },
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e[1];
    let r = this.r() * total;
    for (const e of entries) if ((r -= e[1]) <= 0) return e[0];
    return entries[entries.length - 1][0];
  },
};

const UI_FONT = "Overpass, 'Arial Narrow', Arial, system-ui, sans-serif";
