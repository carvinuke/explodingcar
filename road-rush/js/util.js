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
const difficulty = row => 1 - Math.exp(-Math.max(0, row) / 170);

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
};

// Player settings. Graphic mode is opt-in and always starts off.
const Settings = {
  gore: false,
  shake: true,
  load() {
    const s = Store.get('settings', {}) || {};
    this.gore = s.gore === true;
    this.shake = s.shake !== false;
  },
  save() { Store.set('settings', { gore: this.gore, shake: this.shake }); },
};
Settings.load();

const UI_FONT = "Overpass, 'Arial Narrow', Arial, system-ui, sans-serif";
