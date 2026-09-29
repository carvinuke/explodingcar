'use strict';
// Day and night. The sun goes down as a run goes on; at night a darkness layer
// covers the road and only lights cut through it: headlights, street lamps,
// train and tram lamps, fires, lit windows, and a small glow around each
// player so you can always see yourself. Tail lights and signals glow on top.

const CYCLE = 200;         // seconds for a full day
const CYCLE_START = 0.12;  // runs start in the morning

// [phase, darkness 0..1, [r,g,b] tint, tint alpha]
const DAYLIGHT = [
  [0.0, 0, [255, 255, 255], 0],
  [0.4, 0, [255, 255, 255], 0],
  [0.47, 0.05, [255, 150, 60], 0.12],
  [0.53, 0.45, [120, 60, 150], 0.16],
  [0.58, 1, [20, 30, 80], 0.05],
  [0.86, 1, [20, 30, 80], 0.05],
  [0.93, 0.35, [255, 130, 150], 0.12],
  [1.0, 0, [255, 255, 255], 0],
];

const Lighting = {
  cv: null,
  g: null,
  scale: 0.5,
  sprites: {},
  flies: [],
  dark: 0,
  tint: null,

  init() {
    this.cv = document.createElement('canvas');
    this.g = this.cv.getContext('2d');
    const glow = (color, size = 64) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gr.addColorStop(0, color);
      gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.55) + ')'));
      gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      return cv;
    };
    this.sprites.white = glow('rgba(255,255,255,1)');
    this.sprites.warm = glow('rgba(255,214,140,1)');
    this.sprites.red = glow('rgba(255,40,40,1)');
    this.sprites.blue = glow('rgba(60,120,255,1)');
    this.sprites.fire = glow('rgba(255,150,50,1)');
    this.sprites.green = glow('rgba(190,255,120,1)');
    // headlight cone: narrow at the lamp, wide and faded at the far end
    const cone = document.createElement('canvas');
    cone.width = 128;
    cone.height = 64;
    const g = cone.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 128, 0);
    lg.addColorStop(0, 'rgba(255,255,255,1)');
    lg.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.filter = 'blur(4px)';
    g.beginPath();
    g.moveTo(4, 26); g.lineTo(124, 6); g.lineTo(124, 58); g.lineTo(4, 38);
    g.closePath();
    g.fill();
    this.sprites.cone = cone;
  },

  reset() {
    this.flies.length = 0;
    this.nightSeen = false;
  },

  phase() {
    if (Game.state === 'title') return 0.1;
    return (CYCLE_START + Game.time / CYCLE) % 1;
  },

  // Sample the daylight curve.
  sample(ph) {
    for (let i = 1; i < DAYLIGHT.length; i++) {
      if (ph <= DAYLIGHT[i][0]) {
        const A = DAYLIGHT[i - 1], B = DAYLIGHT[i], t = (ph - A[0]) / (B[0] - A[0]);
        return {
          dark: lerp(A[1], B[1], t),
          r: Math.round(lerp(A[2][0], B[2][0], t)), g: Math.round(lerp(A[2][1], B[2][1], t)), b: Math.round(lerp(A[2][2], B[2][2], t)),
          a: lerp(A[3], B[3], t),
        };
      }
    }
    return { dark: 0, r: 255, g: 255, b: 255, a: 0 };
  },

  // Called every frame from the game loop: trophies for surviving the night.
  update() {
    const ph = this.phase();
    this.isNight = ph > 0.58 && ph < 0.86;
    if (Game.state !== 'playing' || !Player.alive) return;
    if (this.isNight) this.nightSeen = true;
    else if (this.nightSeen && ph >= 0.9) { this.nightSeen = false; Trophies.add('nights'); }
  },

  draw(c, time) {
    const s = this.sample(this.phase());
    const R = Renderer;
    this.dark = s.dark;
    if (s.a > 0.01) {
      c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      c.fillStyle = `rgba(${s.r},${s.g},${s.b},${s.a})`;
      c.fillRect(0, 0, R.W, R.H);
    }
    if (s.dark < 0.02) return;
    const dark = s.dark;

    // ---- darkness layer with lights cut out of it ----
    const sc = this.scale, cw = Math.ceil(R.W * sc), ch = Math.ceil(R.H * sc);
    if (this.cv.width !== cw || this.cv.height !== ch) { this.cv.width = cw; this.cv.height = ch; }
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = `rgba(6,12,34,${0.66 * dark})`;
    g.fillRect(0, 0, cw, ch);
    R.applyWorld(g, true, sc);
    g.globalCompositeOperation = 'destination-out';
    this.eachLight((x, y, z, r, kind, extra) => {
      g.globalAlpha = kind === 'player' ? 0.75 : kind === 'window' ? 0 : 0.9;
      if (g.globalAlpha <= 0) return;
      if (kind === 'cone') this.cone(g, x, y, extra, 1.25);
      else this.blob(g, this.sprites.white, x, y, z, r);
    });
    // coloured glow, added into the same small layer so it takes one composite
    const gg = g;
    gg.globalCompositeOperation = 'lighter';
    const windows = [];
    this.eachLight((x, y, z, r, kind, extra) => {
      switch (kind) {
        case 'cone': gg.globalAlpha = 0.3 * dark; this.cone(gg, x, y, extra, 1); break;
        case 'lamp': gg.globalAlpha = 0.45 * dark; this.blob(gg, this.sprites.warm, x, y, 0, r); gg.globalAlpha = 0.9 * dark; this.blob(gg, this.sprites.warm, x, y, z, 10); break;
        case 'head': gg.globalAlpha = 0.9 * dark; this.blob(gg, this.sprites.warm, x, y, z, 9); break;
        case 'tail': gg.globalAlpha = 0.85 * dark; this.blob(gg, this.sprites.red, x, y, z, r); break;
        case 'red': gg.globalAlpha = dark; this.blob(gg, this.sprites.red, x, y, z, r); break;
        case 'blue': gg.globalAlpha = dark; this.blob(gg, this.sprites.blue, x, y, z, r); break;
        case 'fire': gg.globalAlpha = 0.55 * dark; this.blob(gg, this.sprites.fire, x, y, 0, r); break;
        case 'window': windows.push(extra); break;
        case 'item': gg.globalAlpha = 0.5 * dark; this.blob(gg, this.sprites.warm, x, y, z, r); break;
        default: break;
      }
    });
    if (World.zoneAt(Math.round(Cam.y / TILE)) === 'country' && !Game.weather.amt) this.fireflies(gg, time, dark);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.cv, 0, 0, cw, ch, 0, 0, c.canvas.width, c.canvas.height);
    c.globalCompositeOperation = 'lighter';
    // lit windows stay crisp
    if (windows.length) {
      R.applyWorld(c, true);
      c.globalAlpha = dark;
      for (const w of windows) w(c);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  },

  blob(c, img, x, y, z, r) {
    c.drawImage(img, x - r, P(y, z) - r * (z ? 1 : GY), r * 2, r * 2 * (z ? 1 : GY));
  },

  cone(c, x, y, dir, k) {
    c.save();
    c.translate(x, P(y, 0));
    c.scale(dir, 1);
    c.drawImage(this.sprites.cone, 0, -30 * k, 150 * k, 60 * k);
    c.restore();
  },

  fireflies(c, time, dark) {
    const R = Renderer;
    while (this.flies.length < 18) this.flies.push({ x: rand(R.x0, R.x1), y: rand(R.yBot, R.yTop), ph: rand(6.28), sp: rand(0.6, 1.4) });
    for (const f of this.flies) {
      if (f.y < R.yBot - TILE || f.y > R.yTop || f.x < R.x0 - TILE || f.x > R.x1 + TILE) { f.x = rand(R.x0, R.x1); f.y = rand(R.yBot, R.yTop); }
      f.ph += 0.016 * f.sp;
      f.x += Math.sin(f.ph * 1.3) * 0.4;
      f.y += Math.cos(f.ph) * 0.3;
      const row = World.rows.get(Math.round(f.y / TILE));
      if (!row || row.type !== 'grass') continue;
      const blinkA = Math.max(0, Math.sin(time * 2.2 * f.sp + f.ph * 3));
      c.globalAlpha = dark * blinkA;
      this.blob(c, this.sprites.green, f.x, f.y, 14 + Math.sin(f.ph * 2) * 6, 6);
    }
  },

  // Every light in view: fn(x, y, z, radius, kind, extra)
  eachLight(fn) {
    const R = Renderer;
    const x0 = R.x0 - 3 * TILE, x1 = R.x1 + 3 * TILE;
    const r0 = Math.floor(R.yBot / TILE) - 1, r1 = Math.ceil(R.yTop / TILE) + 1;
    for (let r = r1; r >= r0; r--) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.type === 'grass' || row.type === 'work') {
        for (const o of row.objs) {
          if (o.x < x0 || o.x > x1) continue;
          if (o.kind === 'lamp') {
            const hy = o.y + o.dir * 13;
            fn(o.x, hy, 57, 80, 'lamp');
          } else if (o.kind === 'building') {
            fn(o.x, o.y, 0, 0, 'window', cc => { cc.save(); cc.translate(o.x, P(o.y, 0)); Draw.buildingWindows(cc, o); cc.restore(); });
          } else if (o.kind === 'excavator') {
            fn(o.x, o.y, 44, 10, (Game.time * 4 | 0) % 2 ? 'fire' : 'lamp');
          } else if (o.kind === 'worksign') {
            if ((Game.time * 3 | 0) % 2) fn(o.x, o.y, 40, 14, 'fire');
          }
        }
      } else if (row.type === 'road') {
        for (const v of row.lane.vehicles) {
          if (v.x < x0 || v.x > x1 || v.animal || v.abducted) continue;
          const T = VEHICLE_TYPES[v.type], zt = 4 + T.h * TILE;
          if (!v.wreck) {
            const fx = v.x + v.dir * v.len / 2;
            fn(fx, v.y, 0, 0, 'cone', v.dir);
            fn(fx, v.y - 8, zt - 2, 0, 'head');
            fn(v.x - v.dir * v.len / 2, v.y - 8, zt - 2, 8, 'tail');
          } else if (v.wreckT < (v.gore ? 7 : 3.2) && !v.doused) {
            fn(v.x, v.y, 0, 2.2 * TILE, 'fire');
          }
          if ((v.police || v.responder) && (!v.wreck || v.wreckT < 5)) {
            const on = Math.sin(Game.time * 18) > 0;
            fn(v.x, v.y, zt + 14, 22, on ? 'red' : 'blue');
          }
          if (v.stalled && Math.sin(Game.time * 8) > 0) fn(v.x, v.y, zt, 16, 'fire');
        }
      } else if (row.type === 'rail') {
        const R2 = row.rail;
        if (R2.state !== 'idle' && ((Game.time * 4) | 0) % 2) {
          fn(-0.55 * TILE, row.y + 0.3 * TILE, 40, 20, 'red');
          fn(WORLD_W + 0.55 * TILE, row.y + 0.3 * TILE, 40, 20, 'red');
        }
        if (R2.state === 'train' && R2.cars) {
          fn(R2.x, row.y, 0, 0, 'cone', R2.dir);
          fn(R2.x, row.y, 0, 0, 'cone', R2.dir);
          fn(R2.x, row.y - 8, 30, 0, 'head');
        }
        if (R2.stalled && Math.sin(Game.time * 8) > 0) fn(R2.stalled.x, row.y, 20, 16, 'fire');
      }
    }
    for (const it of Items.list) {
      if (it.x > x0 && it.x < x1 && it.y > R.yBot - TILE && it.y < R.yTop) fn(it.x, it.y, 14, it.type === 'coin' ? 16 : 26, 'item');
    }
    for (const p of Game.players) {
      if (!p.gone) fn(p.x, p.y, 0, 2.3 * TILE, 'player');
    }
    FX.lights((x, y, r) => fn(x, y, 0, r, 'fire'));
    Events.lights(fn);
  },
};
