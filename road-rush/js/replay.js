'use strict';
// Instant replay: keeps the last couple of seconds of the screen around the
// player (cropped and scaled down), then plays the death back in slow motion
// with a zoom before the game-over report. Any key or tap skips it.

const Replay = {
  FPS: 30,
  CAP: 72,          // frames kept (about 2.4 s)
  BEFORE: 1.3,      // seconds of footage before the death
  AFTER: 0.9,       // and after
  frames: [],
  times: [],
  head: 0,
  n: 0,
  clock: 0,
  acc: 0,
  deathT: null,
  active: false,

  init() {
    this.view = document.getElementById('replay');
    this.vg = this.view.getContext('2d');
  },

  reset() {
    this.head = this.n = 0;
    this.clock = this.acc = 0;
    this.deathT = null;
    this.focus = null;
    this.stop();
  },

  frameSize() {
    const big = Renderer.W * Renderer.dpr > 1100;
    return big ? [480, 360] : [360, 270];
  },

  // Called after every rendered frame.
  capture(realDt) {
    if (!Settings.replay || (Game.state !== 'playing' && Game.state !== 'dying')) return;
    this.clock += realDt;
    this.acc += realDt;
    if (this.acc < 1 / this.FPS) return;
    this.acc = Math.min(this.acc - 1 / this.FPS, 1 / this.FPS);
    if (this.deathT !== null && this.clock > this.deathT + this.AFTER) return;
    const [tw, th] = this.frameSize();
    let cv = this.frames[this.head];
    if (!cv || cv.width !== tw) {
      cv = document.createElement('canvas');
      cv.width = tw;
      cv.height = th;
      this.frames[this.head] = cv;
    }
    const R = Renderer, dpr = R.dpr;
    const f = this.focus || Cam.focus();
    const cropW = Math.min(R.W, R.H * 4 / 3) * 0.62, cropH = cropW * 0.75;
    let cx = R.screenX(f.x), cy = R.screenY(f.y, 16);
    cx = clamp(cx, cropW / 2, R.W - cropW / 2);
    cy = clamp(cy, cropH / 2, R.H - cropH / 2);
    try {
      cv.getContext('2d').drawImage(R.canvas, (cx - cropW / 2) * dpr, (cy - cropH / 2) * dpr, cropW * dpr, cropH * dpr, 0, 0, tw, th);
    } catch (e) { return; }
    this.times[this.head] = this.clock;
    this.head = (this.head + 1) % this.CAP;
    this.n = Math.min(this.CAP, this.n + 1);
  },

  markDeath(p) {
    this.deathT = this.clock;
    this.focus = { x: p.x, y: p.y };
  },

  // Frames in time order.
  ordered() {
    const out = [];
    for (let k = 0; k < this.n; k++) {
      const i = (this.head - this.n + k + this.CAP) % this.CAP;
      out.push([this.times[i], this.frames[i]]);
    }
    return out;
  },

  start() {
    if (!Settings.replay || this.deathT === null || this.n < 12) return false;
    const all = this.ordered().filter(([t]) => t >= this.deathT - this.BEFORE && t <= this.deathT + this.AFTER);
    if (all.length < 12) return false;
    this.clip = all;
    this.t0 = all[0][0];
    this.t1 = all[all.length - 1][0];
    this.pt = this.t0;
    this.hold = 0;
    this.active = true;
    this.view.classList.remove('hidden');
    this.resize();
    return true;
  },

  stop() {
    this.active = false;
    this.clip = null;
    if (this.view) this.view.classList.add('hidden');
  },

  resize() {
    const dpr = Renderer.dpr;
    this.view.width = Math.round(Renderer.W * dpr);
    this.view.height = Math.round(Renderer.H * dpr);
  },

  // Returns true when the replay has finished.
  update(realDt) {
    if (!this.active) return true;
    const near = Math.abs(this.pt - this.deathT);
    const speed = lerp(0.28, 1, smoothstep(0.12, 0.5, near)); // slow motion around the moment of death
    if (this.pt < this.t1) this.pt = Math.min(this.t1, this.pt + realDt * speed);
    else this.hold += realDt;
    this.draw();
    return this.hold > 0.45;
  },

  draw() {
    const g = this.vg, W = this.view.width, H = this.view.height, clip = this.clip;
    if (this.view.width !== Math.round(Renderer.W * Renderer.dpr)) this.resize();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0c0f';
    g.fillRect(0, 0, W, H);
    // find the two frames around the playhead and cross-fade them
    let i = 0;
    while (i < clip.length - 2 && clip[i + 1][0] <= this.pt) i++;
    const [ta, a] = clip[i], [tb, b] = clip[Math.min(clip.length - 1, i + 1)];
    const mixT = tb > ta ? clamp((this.pt - ta) / (tb - ta), 0, 1) : 0;
    const zoom = 1 + (Settings.motion ? 0.05 : 0.22) * smoothstep(-0.6, 0.1, this.pt - this.deathT);
    const bar = H * 0.09;
    const availW = W * 0.94, availH = H - bar * 2 - H * 0.04;
    const fit = Math.min(availW / a.width, availH / a.height);
    const dw = a.width * fit, dh = a.height * fit;
    g.save();
    g.beginPath();
    g.rect((W - dw) / 2, (H - dh) / 2, dw, dh);
    g.clip();
    g.translate(W / 2, H / 2);
    g.scale(zoom, zoom);
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 1;
    g.drawImage(a, -dw / 2, -dh / 2, dw, dh);
    if (mixT > 0 && b !== a) {
      g.globalAlpha = mixT;
      g.drawImage(b, -dw / 2, -dh / 2, dw, dh);
    }
    g.restore();
    // film look: scanlines and a vignette
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.12)';
    const step = Math.max(2, Math.round(3 * Renderer.dpr));
    for (let y = (H - dh) / 2; y < (H + dh) / 2; y += step) g.fillRect((W - dw) / 2, y, dw, 1);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(dw, dh) * 0.35, W / 2, H / 2, Math.max(dw, dh) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, Settings.gore && Game.goreDeath ? 'rgba(90,0,10,0.55)' : 'rgba(0,0,0,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // letterbox and labels
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, bar);
    g.fillRect(0, H - bar, W, bar);
    const dpr = Renderer.dpr, fs = Math.round(clamp(W / dpr / 30, 14, 26) * dpr);
    g.font = `900 ${fs}px ${UI_FONT}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const blink = Math.sin(performance.now() / 180) > 0;
    g.fillStyle = blink ? '#ff2e3a' : '#5a1016';
    g.beginPath(); g.arc(24 * dpr + fs * 0.35, bar / 2, fs * 0.32, 0, 6.2832); g.fill();
    g.fillStyle = '#f7f7f2';
    g.fillText('INSTANT REPLAY', 24 * dpr + fs, bar / 2);
    g.textAlign = 'right';
    g.font = `700 ${Math.round(fs * 0.62)}px ${UI_FONT}`;
    g.fillStyle = '#c9ced6';
    g.fillText(this.pt < this.deathT + 0.05 && Math.abs(this.pt - this.deathT) < 0.5 ? 'SLOW MOTION' : Game.cause.toUpperCase(), W - 24 * dpr, bar / 2);
    g.fillText('Press any key or tap to skip', W - 24 * dpr, H - bar / 2);
  },
};
