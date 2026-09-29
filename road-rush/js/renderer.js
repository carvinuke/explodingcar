'use strict';
// Frame composition: ground, shadows, depth-sorted objects, effects,
// secret-event layers, time-of-day lighting, weather and screen overlays.

// Time-of-day keyframes by progress: [phase, [r,g,b], overlay alpha]
const SKY = [
  [0.0, [255, 255, 255], 0],
  [0.42, [255, 255, 255], 0],
  [0.52, [255, 140, 60], 0.13],
  [0.62, [90, 50, 140], 0.25],
  [0.7, [12, 22, 60], 0.38],
  [0.86, [12, 22, 60], 0.38],
  [0.94, [255, 120, 150], 0.13],
  [1.0, [255, 255, 255], 0],
];

const Renderer = {
  ANCHOR: 0.64, // player's vertical position on screen (0 = top)
  list: [],

  init(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.resize();
    addEventListener('resize', () => this.resize());
  },

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    // Show at least ~10 columns and ~15 rows whatever the aspect ratio.
    this.base = Math.min(this.W / (10 * TILE), this.H / (15 * TILE * GY));
    const viewW = this.W / (this.base * 0.45); // room for the miniature-world zoom-out
    World.laneMargin = Math.max(8 * TILE, (viewW - WORLD_W) / 2 + 4 * TILE);
    if (Cam.x !== undefined) this.metrics();
  },

  metrics() {
    const k = this.base * Cam.zoom * (1 + Cam.punch);
    this.k = k;
    const halfW = this.W / 2 / k;
    this.x0 = Cam.x - halfW - TILE;
    this.x1 = Cam.x + halfW + TILE;
    this.yBot = Cam.y - (this.H * (1 - this.ANCHOR)) / (k * GY) - TILE;
    this.yTop = Cam.y + (this.H * this.ANCHOR) / (k * GY) + 2 * TILE;
  },

  inViewX(x) { return x > this.x0 + TILE && x < this.x1 - TILE; },

  screenY(y, z = 0) { return this.H * this.ANCHOR + (P(y, z) + Cam.y * GY) * this.k; },

  applyWorld(c, shake) {
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(this.W / 2 + (shake ? Cam.sx : 0), this.H * this.ANCHOR + (shake ? Cam.sy : 0));
    if (shake) c.rotate(Cam.rot);
    c.scale(this.k, this.k);
    c.translate(-Cam.x, Cam.y * GY);
  },

  frame(time, dt) {
    const c = this.c;
    this.metrics();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#6fae55';
    c.fillRect(0, 0, this.W, this.H);

    this.applyWorld(c, true);
    const r0 = Math.floor(this.yBot / TILE) - 1;
    const r1 = Math.ceil(this.yTop / TILE) + 1;
    this.snow = Game.weather.type === 'snow' ? Game.weather.amt : 0;

    for (let r = r1; r >= r0; r--) {
      const row = World.rows.get(r);
      if (row) this.ground(c, row, time);
    }
    FX.drawDecals(c);
    FX.drawPools(c);
    Events.drawGround(c, time);

    // gather drawables, far to near
    const list = this.list;
    list.length = 0;
    const inX = (x, half) => x + half > this.x0 - TILE && x - half < this.x1 + TILE;
    for (let r = r1 + 2; r >= r0; r--) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.type === 'grass' || row.type === 'rail') {
        for (const o of row.objs) if (inX(o.x, TILE)) { o.key = row.y - 12; list.push(o); }
      }
      if (row.type === 'road') {
        for (const v of row.lane.vehicles) if (inX(v.x, v.len / 2)) { v.key = row.y - 14; list.push(v); }
      } else if (row.type === 'river') {
        for (const l of row.river.logs) if (inX(l.x, l.len / 2)) { l.key = row.y + 2; list.push(l); }
      } else if (row.type === 'rail') {
        const R = row.rail;
        if (R.stalled && inX(R.stalled.x, R.stalled.len)) { R.stalled.key = row.y - 14; list.push(R.stalled); }
        for (const w of R.wrecks) { w.key = w.y - 14; list.push(w); }
        if (R.state === 'train' && R.cars) {
          for (const car of R.cars) {
            car.x = R.x - R.dir * car.off;
            if (inX(car.x, car.len / 2)) { car.key = row.y - 15; list.push(car); }
          }
        }
      }
    }
    for (const it of Items.list) {
      if (it.y > this.yBot - TILE && it.y < this.yTop) { it.key = it.y - 4; list.push(it); }
    }
    const g = Ghost.pos;
    if (g && Game.state === 'playing') list.push({ kind: 'ghost', x: g.x, y: g.y, z: g.z, alpha: g.alpha, key: g.y - 10.5 });
    Events.drawables(list);
    if (!Player.gone) { Player.key = Player.y - 10; list.push(Player); }
    list.sort((a, b) => b.key - a.key);

    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, time);

    this.dimOutside(c);
    this.dangerZone(c);
    FX.draw(c);
    FX.drawBlasts(c);
    Events.drawSky(c, time);
    FX.drawTexts(c);

    this.lighting(c, time);
    this.screen(c, time, dt);
  },

  ground(c, row, time) {
    const x0 = this.x0 - TILE, x1 = this.x1 + TILE, w = x1 - x0;
    const yT = row.y + TILE / 2, yB = row.y - TILE / 2;
    if (row.type === 'grass') {
      const b = row.biome, zt = 4;
      c.fillStyle = b.grass[row.i & 1];
      c.fillRect(x0, P(yT, zt), w, TILE * GY + 0.5);
      c.fillStyle = 'rgba(255,255,255,0.045)';
      for (let col = row.i & 1; col < COLS; col += 2) c.fillRect(col * TILE, P(yT, zt), TILE, TILE * GY);
      for (const f of row.flat) {
        const fy = P(f.y, zt);
        if (f.c) {
          c.fillStyle = f.c;
          c.fillRect(f.x, fy - 1, 3, 3);
          c.fillRect(f.x + 4, fy + 1, 3, 3);
          c.fillStyle = 'rgba(255,220,80,0.9)';
          c.fillRect(f.x + 1, fy, 1, 1);
        } else {
          c.fillStyle = 'rgba(40,90,30,0.28)';
          c.fillRect(f.x, fy - 4, 2, 4);
          c.fillRect(f.x + 3, fy - 5, 2, 5);
          c.fillRect(f.x + 6, fy - 3, 2, 3);
        }
      }
      if (this.snow > 0.02) {
        c.fillStyle = `rgba(248,252,255,${0.55 * this.snow})`;
        c.fillRect(x0, P(yT, zt), w, TILE * GY + 0.5);
      }
      const below = World.rows.get(row.i - 1);
      if (below && below.type !== 'grass') { // raised bank where grass meets road, rail or water
        const deep = below.type === 'river' ? 5 : 0;
        c.fillStyle = b.edge;
        c.fillRect(x0, P(yB, zt), w, (zt + deep) * GZ + 1);
        c.fillStyle = 'rgba(255,255,255,0.14)';
        c.fillRect(x0, P(yB, zt), w, 1.5);
      }
    } else if (row.type === 'road') {
      c.fillStyle = row.shade ? '#3c4049' : '#40444d';
      c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      c.fillStyle = 'rgba(0,0,0,0.08)'; // tyre tracks
      c.fillRect(x0, P(row.y + 9, 0), w, 3);
      c.fillRect(x0, P(row.y - 7, 0), w, 3);
      const yt = P(yT, 0);
      if (row.markAbove === 'dash') {
        c.fillStyle = 'rgba(255,255,255,0.7)';
        for (let x = Math.floor(x0 / (2 * TILE)) * 2 * TILE; x < x1; x += 2 * TILE) c.fillRect(x + 0.3 * TILE, yt - 1.5, 0.9 * TILE, 3);
      } else if (row.markAbove === 'double') {
        c.fillStyle = '#f2c230';
        c.fillRect(x0, yt - 3.5, w, 2);
        c.fillRect(x0, yt + 0.5, w, 2);
      }
      c.fillStyle = 'rgba(255,255,255,0.55)';
      if (row.laneIdx === 0) c.fillRect(x0, P(yB + 4, 0) - 1, w, 2);
      if (row.markAbove === 'edge') c.fillRect(x0, P(yT - 4, 0) - 1, w, 2);
      if (this.snow > 0.02) {
        c.fillStyle = `rgba(235,240,245,${0.22 * this.snow})`;
        c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      }
      if (row.flood) this.water(c, row, x0, w, yT, time, row.flood * 0.8);
    } else if (row.type === 'rail') {
      c.fillStyle = '#857b6f';
      c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = Math.floor(x0 / 7) * 7; x < x1; x += 7) c.fillRect(x, P(row.y + ((x * 7) % 13) - 6, 0), 2, 2);
      c.fillStyle = '#5b4332'; // ties
      for (let x = Math.floor(x0 / 22) * 22; x < x1; x += 22) c.fillRect(x, P(row.y + 14, 1), 9, 28 * GY);
      for (const ry of [8, -7]) { // rails
        c.fillStyle = '#4d5159';
        c.fillRect(x0, P(row.y + ry, 3), w, 3 * GZ + 1);
        c.fillStyle = '#c9ced6';
        c.fillRect(x0, P(row.y + ry, 3) - 1, w, 1.5);
      }
      if (this.snow > 0.02) {
        c.fillStyle = `rgba(245,248,252,${0.3 * this.snow})`;
        c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      }
    } else if (row.type === 'river') {
      this.water(c, row, x0, w, yT, time, 1);
    }
  },

  water(c, row, x0, w, yT, time, a) {
    c.globalAlpha = a;
    c.fillStyle = this.snow > 0.5 ? '#6fa6cf' : (row.i & 1 ? '#3a82c4' : '#3d88cb');
    c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
    c.fillStyle = 'rgba(0,30,60,0.18)';
    c.fillRect(x0, P(yT, 0), w, 5);
    const dir = row.river ? row.river.dir : 1, sp = row.river ? row.river.speed : 25;
    const off = ((time * sp * dir + (row.phase || 0)) % 48 + 48) % 48;
    c.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = Math.floor(x0 / 48) * 48 - 48 + off; x < x0 + w; x += 48) {
      c.fillRect(x, P(row.y + 6, 0), 16, 1.5);
      c.fillRect(x + 22, P(row.y - 6, 0), 12, 1.5);
    }
    c.globalAlpha = 1;
  },

  shadowOf(c, o) {
    switch (o.kind) {
      case 'vehicle': {
        const s = 1 - Math.min(0.5, (o.z || 0) / 160);
        Draw.shadow(c, o.x + 3, o.y, o.len * 1.15 * s, 0.95 * TILE * s, 0.9 * o.alpha * s);
        break;
      }
      case 'traincar': Draw.shadow(c, o.x + 3, o.y, o.len * 1.1, 1.0 * TILE, 0.9); break;
      case 'tree': Draw.shadow(c, o.x, o.y, o.size * 2.8, o.size * 2.5, 0.85); break;
      case 'bush': case 'rock': Draw.shadow(c, o.x, o.y, 0.8 * TILE, 0.7 * TILE, 0.7); break;
      case 'lamp': case 'sign': case 'xing': Draw.shadow(c, o.x, o.y, 0.35 * TILE, 0.3 * TILE, 0.6); break;
      case 'item': Draw.shadow(c, o.x, o.y, 0.5 * TILE, 0.4 * TILE, 0.45); break;
      case 'event': if (o.shadow) Draw.shadow(c, o.x, o.y, o.shadow[0], o.shadow[1], 0.8); break;
      case 'player': {
        if (Player.flat || Player.sink || Player.ride) break;
        const s = 1 - Math.min(0.6, Player.z / 70);
        Draw.shadow(c, o.x, o.y, 0.75 * TILE * s, 0.62 * TILE * s, 0.9);
        break;
      }
    }
  },

  object(c, o, time) {
    c.save();
    c.translate(o.x, P(o.y, 0));
    switch (o.kind) {
      case 'vehicle': {
        if (o.alpha < 1) c.globalAlpha = o.alpha;
        if (o.z) c.translate(0, P(0, o.z));
        const row = World.rows.get(Math.round(o.y / TILE));
        if (row && row.flood && !o.wreck) { // bobbing in floodwater
          c.translate(0, P(0, -3 + Math.sin(time * 3 + o.x * 0.05) * 1.5));
          c.rotate(Math.sin(time * 2.5 + o.x * 0.07) * 0.05);
        }
        if (o.rot) c.rotate(o.rot);
        c.save();
        if (o.dir < 0) c.scale(-1, 1);
        Draw.vehicle(c, o, Powers.frost, time);
        c.restore();
        if (o.reckless && !o.police) Draw.warning(c, time, VEHICLE_TYPES[o.type].h * TILE + 34);
        break;
      }
      case 'traincar':
        if (o.dir < 0) c.scale(-1, 1);
        Draw.trainCar(c, o, time, o.type === 'loco' && o.rail.bloody);
        break;
      case 'log': Draw.log(c, o, time, Player.ride === o); break;
      case 'xing': Draw.xing(c, o, time); break;
      case 'tree': Draw.tree(c, o, this.snow); break;
      case 'bush': Draw.bush(c, o); break;
      case 'rock': Draw.rock(c, o); break;
      case 'lamp': Draw.lamp(c, o); break;
      case 'sign': Draw.sign(c, o); break;
      case 'item':
        if (o.type === 'coin') Draw.coin(c, o, time);
        else Draw.powerItem(c, o, time);
        break;
      case 'ghost': Draw.bestGhost(c, o.z, o.alpha); break;
      case 'event': o.draw(c, time); break;
      case 'player': this.player(c, time); break;
    }
    c.restore();
  },

  player(c, time) {
    const p = Player;
    for (const t of p.trail) {
      c.save();
      c.globalAlpha = Math.max(0, t.a) * 0.55;
      c.translate(t.x - p.x, P(t.y - p.y, 0));
      Draw.ghost(c, t.z);
      c.restore();
    }
    if (Powers.magnet > 0) {
      c.save();
      c.strokeStyle = 'rgba(255,90,120,0.45)';
      c.lineWidth = 2;
      c.setLineDash([8, 10]);
      c.lineDashOffset = -time * 30;
      c.beginPath();
      c.ellipse(0, P(0, 1), MAGNET_RANGE, MAGNET_RANGE * GY, 0, 0, 6.2832);
      c.stroke();
      c.restore();
    }
    if (Powers.invincible > 0) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `hsla(${(time * 360) % 360}, 100%, 65%, 0.45)`;
      c.beginPath();
      c.arc(0, P(0, p.z + 14), 26, 0, 6.2832);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.3) FX.spawn('glow', p.x + rand(-14, 14), p.y + rand(-8, 8), rand(5, 30), { vz: 30, life: 0.5, size: 2.5, size2: 0.5, color: `hsl(${rand(360)},100%,75%)` });
    }
    if (p.grace > 0 && ((time * 18) | 0) % 2) c.globalAlpha = 0.4;
    if (p.sink) c.globalAlpha = 1 - p.sink;
    if (p.ride) c.translate(0, P(0, 7));
    Draw.player(c, p, time, p.skin());
    c.globalAlpha = 1;
    if (p.shield) {
      c.save();
      c.translate(0, P(0, p.z));
      Draw.bubble(c, time);
      c.restore();
    }
    if (p.stun > 0 && p.alive) Draw.stars(c, time, p.z + 36);
  },

  dimOutside(c) {
    const top = P(this.yTop + 3 * TILE, 0), bot = P(this.yBot - 3 * TILE, 0);
    c.fillStyle = 'rgba(16,24,40,0.3)';
    if (this.x0 < 0) c.fillRect(this.x0 - 3 * TILE, top, -this.x0 + 3 * TILE, bot - top);
    if (this.x1 > WORLD_W) c.fillRect(WORLD_W, top, this.x1 + 3 * TILE - WORLD_W, bot - top);
  },

  dangerZone(c) {
    const a = Game.dangerProximity();
    if (a <= 0) return;
    const y = P(Game.danger.y, 0), bot = P(this.yBot - 3 * TILE, 0);
    const x0 = this.x0 - 3 * TILE, w = this.x1 - this.x0 + 6 * TILE;
    const pulse = 0.75 + 0.25 * Math.sin(Game.time * 10);
    c.fillStyle = `rgba(255,40,70,${0.28 * a})`;
    c.fillRect(x0, y, w, bot - y);
    c.fillStyle = `rgba(255,90,110,${0.9 * a * pulse})`;
    c.fillRect(x0, y - 2, w, 4);
  },

  sky() {
    const ph = ((Player.maxRow + 20) / 170) % 1;
    for (let i = 1; i < SKY.length; i++) {
      if (ph <= SKY[i][0]) {
        const A = SKY[i - 1], B = SKY[i];
        const t = (ph - A[0]) / (B[0] - A[0]);
        return {
          r: Math.round(lerp(A[1][0], B[1][0], t)),
          g: Math.round(lerp(A[1][1], B[1][1], t)),
          b: Math.round(lerp(A[1][2], B[1][2], t)),
          a: lerp(A[2], B[2], t),
        };
      }
    }
    return { r: 255, g: 255, b: 255, a: 0 };
  },

  lighting(c, time) {
    const s = this.sky();
    if (s.a < 0.01) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = `rgba(${s.r},${s.g},${s.b},${s.a})`;
    c.fillRect(0, 0, this.W, this.H);
    const night = clamp((s.a - 0.1) / 0.28, 0, 1) * (s.b > s.r ? 1 : 0.4);
    if (night < 0.05) return;

    this.applyWorld(c, true);
    c.globalCompositeOperation = 'lighter';
    const r0 = Math.floor(this.yBot / TILE) - 1, r1 = Math.ceil(this.yTop / TILE) + 1;
    for (let r = r1; r >= r0; r--) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.type === 'grass') {
        for (const o of row.objs) {
          if (o.kind !== 'lamp' || o.x < this.x0 - TILE || o.x > this.x1 + TILE) continue;
          const hy = o.y + o.dir * 13;
          const gx = o.x, gy = P(hy, 0);
          const g = c.createRadialGradient(gx, gy, 0, gx, gy, 70);
          g.addColorStop(0, `rgba(255,214,140,${0.45 * night})`);
          g.addColorStop(1, 'rgba(255,200,120,0)');
          c.fillStyle = g;
          c.beginPath();
          c.ellipse(gx, gy, 70, 70 * GY, 0, 0, 6.2832);
          c.fill();
          c.fillStyle = `rgba(255,240,190,${0.8 * night})`;
          c.beginPath();
          c.arc(gx, P(hy, 57), 6, 0, 6.2832);
          c.fill();
        }
      } else if (row.type === 'road') {
        for (const v of row.lane.vehicles) {
          if (v.wreck || v.x < this.x0 - 3 * TILE || v.x > this.x1 + 3 * TILE) continue;
          const fx = v.x + v.dir * v.len / 2, reach = 110 * v.dir;
          const g = c.createLinearGradient(fx, 0, fx + reach, 0);
          g.addColorStop(0, `rgba(255,240,190,${0.4 * night})`);
          g.addColorStop(1, 'rgba(255,240,190,0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(fx, P(v.y - 8, 0));
          c.lineTo(fx + reach, P(v.y - 26, 0));
          c.lineTo(fx + reach, P(v.y + 26, 0));
          c.lineTo(fx, P(v.y + 8, 0));
          c.closePath();
          c.fill();
        }
      }
    }
    c.globalCompositeOperation = 'source-over';
  },

  screen(c, time, dt) {
    const W = this.W, H = this.H;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    FX.drawWeather(c, W, H, Game.weather.type, Game.weather.amt, dt || 0.016);
    Events.drawScreen(c, W, H, time);

    if (Powers.frost > 0.01) {
      c.fillStyle = `rgba(150,220,255,${0.08 * Powers.frost})`;
      c.fillRect(0, 0, W, H);
      this.vignette(c, `rgba(210,245,255,${0.55 * Powers.frost})`);
    }
    const dz = Game.dangerProximity();
    if (dz > 0) this.vignette(c, `rgba(255,40,70,${0.45 * dz * (0.7 + 0.3 * Math.sin(time * 10))})`);

    for (const row of World.rows.values()) {
      if (row.y < this.yBot || row.y > this.yTop) continue;
      // incoming train: yellow "RR" advance-warning sign at the edge it's coming from
      if (row.type === 'rail' && row.rail.state !== 'idle') {
        const R = row.rail;
        const coming = R.state === 'warn' || (R.dir > 0 ? R.x < this.x0 + TILE : R.x > this.x1 - TILE);
        if (coming) this.rrSign(c, R.dir > 0 ? 28 : W - 28, this.screenY(row.y, 10), time);
      }
      // off-screen warning for reckless drivers about to enter the view
      if (row.type !== 'road') continue;
      for (const v of row.lane.vehicles) {
        if (!v.reckless || v.wreck || this.inViewX(v.x)) continue;
        const incoming = (v.dir > 0 && v.x < Cam.x) || (v.dir < 0 && v.x > Cam.x);
        if (!incoming) continue;
        const sy = this.screenY(v.y, 10);
        const left = v.x < Cam.x;
        const sx = left ? 26 : W - 26;
        const s = 1 + 0.15 * Math.sin(time * 14);
        c.save();
        c.translate(sx, sy);
        c.scale(s, s);
        c.fillStyle = v.police ? '#3b82f6' : '#ff3355';
        c.beginPath();
        c.arc(0, 0, 15, 0, 6.2832);
        c.fill();
        c.beginPath();
        const d = left ? -1 : 1;
        c.moveTo(d * 24, 0);
        c.lineTo(d * 12, -8);
        c.lineTo(d * 12, 8);
        c.closePath();
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(-2, -8, 4, 10);
        c.fillRect(-2, 4.5, 4, 3.5);
        c.restore();
      }
    }
    FX.drawLens(c, W, H);
    FX.drawFlash(c, W, H);
  },

  rrSign(c, x, y, time) {
    const s = 1 + 0.12 * Math.sin(time * 12);
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = '#1d1d1f';
    c.beginPath(); c.arc(0, 0, 19, 0, 6.2832); c.fill();
    c.fillStyle = '#fcc21b';
    c.beginPath(); c.arc(0, 0, 17, 0, 6.2832); c.fill();
    c.strokeStyle = '#1d1d1f';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-11, -11); c.lineTo(11, 11);
    c.moveTo(11, -11); c.lineTo(-11, 11);
    c.stroke();
    c.fillStyle = '#1d1d1f';
    c.font = `900 9px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('R', -9, 1);
    c.fillText('R', 9, 1);
    c.restore();
  },

  vignette(c, color) {
    const W = this.W, H = this.H;
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  },
};
