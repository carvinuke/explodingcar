'use strict';
// Traffic Control and Boom Run borrow Road Rush's drawing, explosion and sound
// code straight from ../road-rush/js (util, audio, effects, draw, vehicles).
// Those files reach for a few of Road Rush's own globals while they run; these
// are the stand-ins. Each game keeps Renderer up to date every frame.

// The road under a particle (Road Rush checks for grass and water): always plain ground here.
const World = { rows: { get() { return null; } } };

// Road Rush's gravity-glitch event scales falling particles; normal here.
const Events = { gravity: 1 };

// What's on screen, in world units, and the drawing scale.
const Renderer = { base: 1, dpr: 1, yTop: 1e9, yBot: -1e9 };

// A cache of pre-drawn sprites (cars mostly), so slow computers redraw a
// picture instead of every little box each frame. Same idea as Road Rush's.
const Sprites = {
  cache: new Map(),
  scale: 0,
  MAX: 220,
  scratch: null,
  off: false, // low graphics can switch caching off if it ever misbehaves

  drawKey(c, key, fn) {
    if (this.off) return false;
    const s = Math.round(Renderer.base * Renderer.dpr * 4) / 4;
    if (s <= 0) return false;
    if (s !== this.scale) { this.cache.clear(); this.scale = s; }
    let spr = this.cache.get(key);
    if (spr) { this.cache.delete(key); this.cache.set(key, spr); }
    else {
      spr = this.make(fn, s);
      if (!spr) return false;
      this.cache.set(key, spr);
      if (this.cache.size > this.MAX) this.cache.delete(this.cache.keys().next().value);
    }
    if (spr.w) c.drawImage(spr.img, spr.ox, spr.oy, spr.w, spr.h);
    return true;
  },

  // Draw into a roomy scratch canvas, then crop to what was actually drawn.
  make(fn, s) {
    const HW = 90, UP = 170, DOWN = 90;
    const W = Math.ceil(HW * 2 * s), H = Math.ceil((UP + DOWN) * s);
    if (!this.scratch) { this.scratch = document.createElement('canvas'); this.sg = this.scratch.getContext('2d', { willReadFrequently: true }); }
    const cv = this.scratch, g = this.sg;
    if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(s, 0, 0, s, HW * s, UP * s);
    try { fn(g); } catch (e) { return null; }
    let data;
    try { data = g.getImageData(0, 0, W, H).data; } catch (e) { return null; } // file:// can taint in some browsers
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
    if (x1 < 0) return { w: 0 };
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
    const img = document.createElement('canvas');
    img.width = x1 - x0 + 1;
    img.height = y1 - y0 + 1;
    img.getContext('2d').drawImage(cv, x0, y0, img.width, img.height, 0, 0, img.width, img.height);
    return { img, ox: x0 / s - HW, oy: y0 / s - UP, w: img.width / s, h: img.height / s };
  },
};

// Road Rush's biome colours, for the new games' scenery.
const BIOMES = {
  town:   { name: 'Town',   ground: '#6fae55', ground2: '#69a650', edge: '#4f8a3c', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'], bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'] },
  city:   { name: 'City',   ground: '#8f939b', ground2: '#898d95', edge: '#6f737b', tree: ['#56a846', '#3f8a37', '#6cc255', '#50a043'], bush: ['#62b44e', '#4b953d', '#77c75f', '#5aa648'] },
  desert: { name: 'Desert', ground: '#d9bd84', ground2: '#d3b77d', edge: '#b8925a', tree: ['#5f9e4a', '#437a35', '#76b35c', '#548f41'], bush: ['#a79a5c', '#857a45', '#b8ab6a', '#958a52'] },
  snow:   { name: 'Snow',   ground: '#dfe8f1', ground2: '#d8e2ec', edge: '#aebfd1', tree: ['#2f7a5a', '#215c43', '#3a8d68', '#2a6c50'], bush: ['#4f8a6c', '#3b6f55', '#5f9a7b', '#487f63'] },
  autumn: { name: 'Autumn', ground: '#c9b56a', ground2: '#c3af63', edge: '#8e7a3d', tree: ['#e8742a', '#c25a1a', '#f2a23a', '#d1821f'], bush: ['#c97a35', '#a65f25', '#d98f45', '#b86f2e'] },
  farm:   { name: 'Farm',   ground: '#a9c45e', ground2: '#a3be57', edge: '#7d8f3a', tree: ['#6cae4a', '#4f8c37', '#82c15c', '#62a243'], bush: ['#8cc054', '#6ea041', '#9ccf64', '#7fb24c'] },
};
