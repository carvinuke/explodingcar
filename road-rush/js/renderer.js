'use strict';
// Frame composition: ground, shadows, depth-sorted objects, effects,
// secret-event layers, day and night, weather and screen overlays.

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
    const ox = Cam.ox || 0;
    this.x0 = Cam.x - ox - halfW - TILE;
    this.x1 = Cam.x - ox + halfW + TILE;
    this.yBot = Cam.y - (this.H * (1 - this.ANCHOR)) / (k * GY) - TILE;
    this.yTop = Cam.y + (this.H * this.ANCHOR) / (k * GY) + 2 * TILE;
  },

  inViewX(x) { return x > this.x0 + TILE && x < this.x1 - TILE; },

  screenY(y, z = 0) { return this.H * this.ANCHOR + (P(y, z) + Cam.y * GY) * this.k; },
  screenX(x) { return this.W / 2 + (x - Cam.x + (Cam.ox || 0)) * this.k; },

  applyWorld(c, shake, scale = this.dpr) {
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.translate(this.W / 2 + (shake ? Cam.sx : 0), this.H * this.ANCHOR + (shake ? Cam.sy : 0));
    if (shake) c.rotate(Cam.rot);
    c.scale(this.k, this.k);
    c.translate(-Cam.x + (Cam.ox || 0), Cam.y * GY);
  },

  frame(time, dt) {
    const c = this.c;
    this.metrics();
    if (Reverse.arena) { Reverse.draw(c, time); return; }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = ZONES[World.zoneAt(Math.round(Cam.y / TILE))].bg;
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
    Storms.drawGround(c, time);
    Animals.drawGround(c, time);
    Rage.drawGround(c);

    // gather drawables, far to near
    const list = this.list;
    list.length = 0;
    const inX = (x, half) => x + half > this.x0 - TILE && x - half < this.x1 + TILE;
    for (let r = r1 + 2; r >= r0; r--) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.objs) {
        for (const o of row.objs) {
          const half = o.kind === 'building' || o.kind === 'mesa' ? o.w : TILE;
          if (inX(o.x, half)) { o.key = row.y - 12; list.push(o); }
        }
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
    Animals.drawables(list);
    Storms.drawables(list);
    Pets.drawables(list);
    for (const p of Game.players) if (!p.gone) { p.key = p.y - 10; list.push(p); }
    list.sort((a, b) => b.key - a.key);

    for (const o of list) this.shadowOf(c, o);
    for (const o of list) this.object(c, o, time);

    if (Admin.hitboxes) this.hitboxes(c);
    this.dimOutside(c);
    this.dangerZone(c);
    FX.draw(c);
    FX.drawBlasts(c);
    Events.drawSky(c, time);
    Storms.drawSky(c);
    FX.drawTexts(c);

    Lighting.draw(c, time);
    this.screen(c, time, dt);
  },

  // ---- Ground ------------------------------------------------------------------------
  ground(c, row, time) {
    const x0 = this.x0 - TILE, x1 = this.x1 + TILE, w = x1 - x0;
    const yT = row.y + TILE / 2, yB = row.y - TILE / 2;
    if (row.type === 'grass') {
      const b = row.biome, zt = 4, zone = row.zone;
      c.fillStyle = b.grass[row.i & 1];
      c.fillRect(x0, P(yT, zt), w, TILE * GY + 0.5);
      if (zone === 'city') { // sidewalk slabs
        c.fillStyle = 'rgba(0,0,0,0.07)';
        for (let x = Math.floor(x0 / TILE) * TILE; x < x1; x += TILE) c.fillRect(x, P(yT, zt), 1.2, TILE * GY);
        c.fillRect(x0, P(row.y, zt), w, 1);
      } else if (zone === 'beach' && row.boardwalk) { // boardwalk planks
        c.fillStyle = row.i & 1 ? '#c59a64' : '#caa06a';
        c.fillRect(x0, P(yT, zt), w, TILE * GY + 0.5);
        c.fillStyle = 'rgba(80,50,20,0.28)';
        for (let x = Math.floor(x0 / 10) * 10; x < x1; x += 10) c.fillRect(x, P(yT, zt), 1.2, TILE * GY);
        c.fillStyle = 'rgba(80,50,20,0.4)';
        for (let x = Math.floor(x0 / 60) * 60 + ((row.i * 23) % 60); x < x1; x += 60) {
          c.fillRect(x + 3, P(row.y + 8, zt), 1.6, 1.6);
          c.fillRect(x + 3, P(row.y - 8, zt), 1.6, 1.6);
        }
      } else if (zone === 'desert' || zone === 'beach') { // wind ripples in the sand
        c.fillStyle = 'rgba(160,110,50,0.12)';
        for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) {
          c.fillRect(x + ((row.i * 13) % 30), P(row.y + 6, zt), 14, 1.5);
          c.fillRect(x + ((row.i * 7) % 30) + 10, P(row.y - 7, zt), 10, 1.5);
        }
      } else if (zone === 'country') {
        c.fillStyle = 'rgba(255,255,255,0.045)';
        for (let col = row.i & 1; col < COLS; col += 2) c.fillRect(col * TILE, P(yT, zt), TILE, TILE * GY);
      }
      for (const f of row.flat) {
        const fy = P(f.y, zt);
        if (zone === 'city') {
          c.fillStyle = 'rgba(60,60,70,0.18)';
          c.fillRect(f.x, fy, 3, 2);
        } else if (zone === 'beach') {
          if (row.boardwalk) continue;
          c.fillStyle = f.c ? '#fff7e6' : 'rgba(200,150,110,0.6)'; // shells and pebbles
          c.fillRect(f.x, fy - 1, 3, 2);
        } else if (zone === 'desert') {
          c.fillStyle = f.c ? 'rgba(150,110,60,0.5)' : 'rgba(120,90,50,0.35)';
          c.fillRect(f.x, fy - 1, 3, 2);
        } else if (zone === 'snow') {
          c.fillStyle = f.c ? 'rgba(255,255,255,0.95)' : 'rgba(170,200,230,0.5)';
          c.fillRect(f.x, fy - 1, 2, 2);
        } else if (f.c) {
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
      if (this.snow > 0.02 && zone !== 'snow') {
        c.fillStyle = `rgba(248,252,255,${0.55 * this.snow})`;
        c.fillRect(x0, P(yT, zt), w, TILE * GY + 0.5);
      }
      if (row.ice) this.ice(c, row, zt, time);
      const below = World.rows.get(row.i - 1);
      if (below && below.type !== 'grass') { // raised bank / kerb where ground meets road, rail or water
        const deep = below.type === 'river' ? 5 : 0;
        c.fillStyle = b.edge;
        c.fillRect(x0, P(yB, zt), w, (zt + deep) * GZ + 1);
        c.fillStyle = zone === 'city' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
        c.fillRect(x0, P(yB, zt), w, 1.5);
      }
    } else if (row.type === 'road') {
      const zone = row.zone;
      c.fillStyle = zone === 'city' ? (row.shade ? '#34373e' : '#383b42') : row.shade ? '#3c4049' : '#40444d';
      c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      c.fillStyle = 'rgba(0,0,0,0.08)'; // tyre tracks
      c.fillRect(x0, P(row.y + 9, 0), w, 3);
      c.fillRect(x0, P(row.y - 7, 0), w, 3);
      if (zone === 'city' && row.i % 3 === 0) { // manhole cover
        const mx = ((row.i * 97) % COLS + 0.5) * TILE;
        c.fillStyle = '#2a2c31';
        c.beginPath(); c.ellipse(mx, P(row.y, 0), 8, 8 * GY, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(mx - 5, P(row.y, 0) - 0.5, 10, 1);
      }
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
      if (zone === 'desert') { // sand blown onto the road edges
        c.fillStyle = 'rgba(226,196,140,0.55)';
        if (row.laneIdx === 0) c.fillRect(x0, P(yB + 3, 0), w, 3 * GY);
        if (row.markAbove === 'edge') c.fillRect(x0, P(yT, 0), w, 3 * GY);
      }
      if (this.snow > 0.02) {
        c.fillStyle = `rgba(235,240,245,${0.22 * this.snow})`;
        c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      }
      if (row.ice) this.ice(c, row, 0, time);
      if (row.flood) this.water(c, row, x0, w, yT, time, row.flood * 0.8);
    } else if (row.type === 'rail') {
      const tram = row.rail.tram;
      c.fillStyle = tram ? '#8e9198' : '#857b6f';
      c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      if (tram) {
        c.fillStyle = 'rgba(0,0,0,0.07)';
        for (let x = Math.floor(x0 / TILE) * TILE; x < x1; x += TILE) c.fillRect(x, P(yT, 0), 1.2, TILE * GY);
      } else {
        c.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = Math.floor(x0 / 7) * 7; x < x1; x += 7) c.fillRect(x, P(row.y + ((x * 7) % 13) - 6, 0), 2, 2);
        c.fillStyle = '#5b4332'; // ties
        for (let x = Math.floor(x0 / 22) * 22; x < x1; x += 22) c.fillRect(x, P(row.y + 14, 1), 9, 28 * GY);
      }
      for (const ry of [8, -7]) { // rails
        c.fillStyle = tram ? '#6a6d74' : '#4d5159';
        c.fillRect(x0, P(row.y + ry, tram ? 1 : 3), w, (tram ? 1 : 3) * GZ + 1);
        c.fillStyle = '#c9ced6';
        c.fillRect(x0, P(row.y + ry, tram ? 1 : 3) - 1, w, 1.5);
      }
      if (this.snow > 0.02) {
        c.fillStyle = `rgba(245,248,252,${0.3 * this.snow})`;
        c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      }
    } else if (row.type === 'river') {
      this.water(c, row, x0, w, yT, time, 1);
    } else if (row.type === 'work') {
      c.fillStyle = row.i & 1 ? '#a88d67' : '#ae9370';
      c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      c.fillStyle = 'rgba(70,50,30,0.22)';
      for (let x = Math.floor(x0 / 9) * 9; x < x1; x += 9) c.fillRect(x + ((x * 5) % 7), P(row.y + ((x * 3) % 25) - 12, 0), 2, 2);
      // striped edges
      for (const yy of [yT - 1.5, yB + 1.5]) {
        for (let x = Math.floor(x0 / 16) * 16; x < x1; x += 16) {
          c.fillStyle = (x / 16) & 1 ? '#f26722' : '#f7f7f2';
          c.fillRect(x, P(yy, 0) - 1.5, 16, 3);
        }
      }
      for (let col = 0; col < COLS; col++) if (row.pit[col]) Draw.pit(c, cellX(col), row.y);
      // excavator about to swing: flash hazard stripes over the cells it will hit
      for (const o of row.objs) {
        const cells = o.kind === 'excavator' ? Work.warned(o) : null;
        if (!cells || ((time * 8) | 0) % 2) continue;
        const xa = cells[0] * TILE, xb = (cells[1] + 1) * TILE;
        c.save();
        c.beginPath();
        c.rect(xa, P(yT, 0), xb - xa, TILE * GY);
        c.clip();
        c.fillStyle = 'rgba(255,140,0,0.45)';
        c.fillRect(xa, P(yT, 0), xb - xa, TILE * GY);
        c.fillStyle = 'rgba(20,20,20,0.35)';
        for (let x = xa - 40; x < xb; x += 14) {
          c.beginPath();
          c.moveTo(x, P(yB, 0)); c.lineTo(x + 7, P(yB, 0)); c.lineTo(x + 7 + 26, P(yT, 0)); c.lineTo(x + 26, P(yT, 0));
          c.closePath();
          c.fill();
        }
        c.restore();
      }
    }
  },

  // Glossy ice patches (mountain pass).
  ice(c, row, z, time) {
    for (let col = 0; col < COLS; col++) {
      if (!row.ice[col]) continue;
      const x = col * TILE + 3, y = P(row.y + TILE / 2 - 4, z), h = (TILE - 8) * GY;
      c.fillStyle = 'rgba(190,230,255,0.78)';
      c.fillRect(x, y, TILE - 6, h);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      const sh = ((time * 0.6 + col * 0.37) % 1) * (TILE - 16);
      c.fillRect(x + 4 + sh, y + 3, 8, 1.5);
      c.fillRect(x + 8, y + h - 6, 12, 1.5);
      c.fillStyle = 'rgba(120,180,220,0.5)';
      c.fillRect(x, y + h - 1.5, TILE - 6, 1.5);
    }
  },

  water(c, row, x0, w, yT, time, a) {
    const style = row.river ? row.river.style : 'log';
    c.globalAlpha = a;
    c.fillStyle = style === 'surf' ? (row.i & 1 ? '#2bb3c0' : '#30bac6') : style === 'floe' ? (row.i & 1 ? '#3f79a8' : '#4380b0')
      : style === 'raft' ? (row.i & 1 ? '#2f7d86' : '#33838c')
        : this.snow > 0.5 ? '#6fa6cf' : (row.i & 1 ? '#3a82c4' : '#3d88cb');
    c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
    c.fillStyle = 'rgba(0,30,60,0.18)';
    c.fillRect(x0, P(yT, 0), w, 5);
    if (style === 'raft') { // canal wall
      c.fillStyle = '#9da1a8';
      c.fillRect(x0, P(yT, 0), w, 3);
    }
    const dir = row.river ? row.river.dir : 1, sp = row.river ? row.river.speed : 25;
    const off = ((time * sp * dir + (row.phase || 0)) % 48 + 48) % 48;
    c.fillStyle = style === 'floe' ? 'rgba(230,245,255,0.35)' : 'rgba(255,255,255,0.22)';
    for (let x = Math.floor(x0 / 48) * 48 - 48 + off; x < x0 + w; x += 48) {
      c.fillRect(x, P(row.y + 6, 0), 16, 1.5);
      c.fillRect(x + 22, P(row.y - 6, 0), 12, 1.5);
    }
    c.globalAlpha = 1;
  },

  // ---- Objects --------------------------------------------------------------------------
  shadowOf(c, o) {
    switch (o.kind) {
      case 'vehicle': {
        const s = 1 - Math.min(0.5, (o.z || 0) / 160);
        Draw.shadow(c, o.x + 3, o.y, o.len * 1.15 * s, 0.95 * TILE * s, 0.9 * o.alpha * s);
        break;
      }
      case 'traincar': Draw.shadow(c, o.x + 3, o.y, o.len * 1.1, 1.0 * TILE, 0.9); break;
      case 'tree': case 'planter': Draw.shadow(c, o.x, o.y, o.size * 2.8, o.size * 2.5, 0.85); break;
      case 'bush': case 'rock': case 'deadbush': case 'snowman': case 'bench': Draw.shadow(c, o.x, o.y, 0.8 * TILE, 0.7 * TILE, 0.7); break;
      case 'cactus': case 'palm': Draw.shadow(c, o.x, o.y, 0.6 * TILE, 0.5 * TILE, 0.7); break;
      case 'umbrella': Draw.shadow(c, o.x + 6, o.y, 1.1 * TILE, 0.8 * TILE, 0.55); break;
      case 'chair': case 'sandcastle': case 'lifeguard': Draw.shadow(c, o.x, o.y, 0.8 * TILE, 0.6 * TILE, 0.6); break;
      case 'gull': Draw.shadow(c, o.x, o.y, 0.5 * TILE * (1 - Math.min(0.6, o.z / 200)), 0.35 * TILE, 0.5); break;
      case 'lamp': case 'sign': case 'xing': case 'hydrant': case 'bin': case 'mailbox': case 'cone': case 'worksign':
        Draw.shadow(c, o.x, o.y, 0.35 * TILE, 0.3 * TILE, 0.6); break;
      case 'barrier': Draw.shadow(c, o.x, o.y, 0.9 * TILE, 0.4 * TILE, 0.6); break;
      case 'excavator': Draw.shadow(c, o.x, o.y, 2.1 * TILE, 0.95 * TILE, 0.9); break;
      case 'item': Draw.shadow(c, o.x, o.y, 0.5 * TILE, 0.4 * TILE, 0.45); break;
      case 'deer': Draw.shadow(c, o.x, o.y, 0.9 * TILE, 0.5 * TILE, 0.6 * o.alpha); break;
      case 'weed': Draw.shadow(c, o.x, o.y, o.r * 2.4, o.r * 1.8, 0.5); break;
      case 'medic': Draw.shadow(c, o.x, o.y, 0.45 * TILE, 0.35 * TILE, 0.6); break;
      case 'pet': Draw.shadow(c, o.x, o.y, (o.z > 10 ? 0.4 : 0.55) * TILE, 0.4 * TILE, o.z > 10 ? 0.35 : 0.6); break;
      case 'event': if (o.shadow) Draw.shadow(c, o.x, o.y, o.shadow[0], o.shadow[1], 0.8); break;
      case 'player': {
        if (o.flat || o.sink || o.ride) break;
        const s = 1 - Math.min(0.6, o.z / 70);
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
        if (o.alpha < 1) c.globalAlpha = Math.max(0, o.alpha);
        if (o.z) c.translate(0, P(0, o.z));
        const row = World.rows.get(Math.round(o.y / TILE));
        if (row && row.flood && !o.wreck) { // bobbing in floodwater
          c.translate(0, P(0, -3 + Math.sin(time * 3 + o.x * 0.05) * 1.5));
          c.rotate(Math.sin(time * 2.5 + o.x * 0.07) * 0.05);
        }
        if (o.rot) c.rotate(o.rot);
        c.save();
        if (o.dir < 0) c.scale(-1, 1);
        if (o.animal) Draw.cow(c, o, time);
        else Draw.vehicle(c, o, Powers.frost, time);
        c.restore();
        if (o.reckless && !o.police) Draw.warning(c, time, VEHICLE_TYPES[o.type].h * TILE + 34);
        break;
      }
      case 'traincar':
        if (o.dir < 0) c.scale(-1, 1);
        Draw.trainCar(c, o, time, (o.type === 'loco' || o.front) && o.rail.bloody);
        break;
      case 'log': Draw.log(c, o, time, Game.players.some(p => p.ride === o)); break;
      case 'xing': Draw.xing(c, o, time); break;
      case 'tree': Draw.tree(c, o, o.pine ? 1 : this.snow); break;
      case 'planter': Draw.planter(c, o); break;
      case 'bush': Draw.bush(c, o); break;
      case 'deadbush': Draw.deadbush(c, o); break;
      case 'rock': Draw.rock(c, o); break;
      case 'lamp': Draw.lamp(c, o); break;
      case 'sign': Draw.sign(c, o); break;
      case 'cactus': Draw.cactus(c, o); break;
      case 'umbrella': Draw.umbrella(c, o); break;
      case 'chair': Draw.chair(c, o); break;
      case 'sandcastle': Draw.sandcastle(c); break;
      case 'palm': Draw.palm(c, o); break;
      case 'lifeguard': Draw.lifeguard(c); break;
      case 'gull': Draw.gull(c, o, time); break;
      case 'skull': Draw.skull(c); break;
      case 'mesa': Draw.mesa(c, o); break;
      case 'building': Draw.building(c, o); break;
      case 'hydrant': Draw.hydrant(c); break;
      case 'bin': Draw.bin(c); break;
      case 'mailbox': Draw.mailbox(c); break;
      case 'bench': Draw.bench(c); break;
      case 'snowman': Draw.snowman(c); break;
      case 'cone': Draw.cone(c); break;
      case 'barrier': Draw.barrier(c, time); break;
      case 'worksign': Draw.worksign(c, time); break;
      case 'excavator': Draw.excavator(c, o, time); break;
      case 'welcome': Draw.welcome(c, o); break;
      case 'deer': c.globalAlpha = Math.max(0, o.alpha); Draw.deer(c, o, time); break;
      case 'weed': Draw.weed(c, o); break;
      case 'medic': Draw.medic(c, o, time); break;
      case 'pet': Draw.pet(c, o, time); break;
      case 'item':
        if (o.type === 'coin') Draw.coin(c, o, time);
        else if (o.type === 'egg' || o.type === 'goldegg') Draw.egg(c, o, time);
        else Draw.powerItem(c, o, time);
        break;
      case 'ghost': Draw.bestGhost(c, o.z, o.alpha); break;
      case 'event': o.draw(c, time); break;
      case 'player': this.player(c, o, time); break;
    }
    c.restore();
  },

  player(c, p, time) {
    for (const t of p.trail) {
      c.save();
      c.globalAlpha = Math.max(0, t.a) * 0.55;
      c.translate(t.x - p.x, P(t.y - p.y, 0));
      Draw.ghost(c, t.z);
      c.restore();
    }
    if (p.pw.magnet > 0) {
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
    if (p.pw.invincible > 0) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `hsla(${(time * 360) % 360}, 100%, 65%, 0.45)`;
      c.beginPath();
      c.arc(0, P(0, p.z + 14), 26, 0, 6.2832);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.3) FX.spawn('glow', p.x + rand(-14, 14), p.y + rand(-8, 8), rand(5, 30), { vz: 30, life: 0.5, size: 2.5, size2: 0.5, color: `hsl(${rand(360)},100%,75%)` });
    }
    if (p.grace > 0 && ((time * 18) | 0) % 2) c.globalAlpha = 0.4;
    if (p.pw.ghost > 0) { // see-through, with a cold glow
      c.globalAlpha = p.pw.ghost < 1 && ((time * 10) | 0) % 2 ? 0.7 : 0.4;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(150,230,255,0.25)';
      c.beginPath(); c.arc(0, P(0, p.z + 14), 22, 0, 6.2832); c.fill();
      c.restore();
    }
    const tiny = p.pw.shrink > 0 ? (p.pw.shrink < 0.4 ? lerp(1, 0.5, p.pw.shrink / 0.4) : 0.5) : 1;
    if (tiny < 1) c.scale(tiny, tiny);
    if (p.sink) c.globalAlpha = 1 - p.sink;
    if (p.ride) c.translate(0, P(0, 7));
    const sk = p.skin();
    if (sk.flames && p.alive && !p.gone && Math.random() < 0.45) { // the Phoenix is always a little on fire
      FX.spawn('fire', p.x + rand(-9, 9), p.y + rand(-5, 5), p.z + rand(8, 24), { vz: rand(25, 55), g: -25, drag: 1, life: rand(0.25, 0.5), size: rand(3, 5.5), size2: 1 });
    }
    Draw.player(c, p, time, sk, p.hat());
    if (p.id === 0 && Egg.carry && p.alive) { // carrying the egg on your head, wobbling more as it gets close
      const k = Egg.progress(), wob = Math.sin(time * (4 + k * 14)) * (0.08 + k * 0.25);
      const ez = p.z + Draw.headTop(sk) + 9 + (p.hat() ? 8 : 0) + Math.sin(time * 3) * 1.5;
      c.save();
      c.translate(0, P(0, ez));
      c.rotate(wob);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `hsla(${(time * 120) % 360},100%,70%,${0.18 + 0.2 * k})`;
      c.beginPath(); c.arc(0, 0, 12 + k * 4, 0, 6.2832); c.fill();
      c.restore();
      Draw.eggPic(c, 0, 0, 7, false, time, Math.max(0, (k - 0.78) / 0.22));
      c.restore();
    }
    c.globalAlpha = 1;
    if (p.shield) { // one bubble per stacked shield, each a little bigger
      c.save();
      c.translate(0, P(0, p.z));
      for (let k = Math.min(p.shield, 4) - 1; k >= 0; k--) {
        c.save();
        const s = 1 + k * 0.18;
        c.translate(0, P(0, 14));
        c.scale(s, s);
        c.translate(0, -P(0, 14));
        if (k) c.globalAlpha = 0.6;
        Draw.bubble(c, time + k * 0.7);
        c.restore();
      }
      if (p.shield > 1) {
        c.font = `900 9px ${UI_FONT}`;
        c.textAlign = 'center';
        c.fillStyle = '#bfe3ff';
        c.fillText('x' + p.shield, 0, P(0, 50 + Math.min(p.shield, 4) * 4));
      }
      c.restore();
    }
    if (p.stun > 0 && p.alive) Draw.stars(c, time, p.z + 36);
    const versus = Game.players.length > 1;
    if (versus && p.alive) Draw.tag(c, p.tag, p.id === 0 ? '#ff5c5c' : '#4da3ff', p.z + (p.hat() ? 50 : 42));
    if (Game.state === 'playing' && p.maxRow === 0 && p.row === 0 && !p.hop && Game.time > 0.6) {
      const touch = matchMedia('(hover: none)').matches;
      Draw.hint(c, time, versus ? (p.id === 0 ? 'W A S D' : 'ARROW KEYS') : touch ? 'TAP TO HOP' : 'PRESS ↑ TO HOP', versus ? 70 : 58);
    }
  },

  // Admin: outline exactly what can hit you.
  hitboxes(c) {
    c.lineWidth = 1.5;
    for (const row of World.rows.values()) {
      if (row.y < this.yBot - TILE || row.y > this.yTop) continue;
      if (row.type === 'road') {
        for (const v of row.lane.vehicles) {
          if (v.animal || v.abducted) continue;
          const half = v.len / 2 - 2 + 0.24 * TILE, vy = v.drunk ? v.y : row.y;
          c.strokeStyle = v.wreck ? 'rgba(255,200,0,0.9)' : 'rgba(255,40,70,0.95)';
          c.strokeRect(v.x - half, P(vy + 0.58 * TILE, 0), half * 2, 1.16 * TILE * GY);
        }
      } else if (row.type === 'rail' && row.rail.state === 'train') {
        const [a, b] = Rail.extent(row.rail);
        c.strokeStyle = 'rgba(255,40,70,0.95)';
        c.strokeRect(a - 0.2 * TILE, P(row.y + 0.5 * TILE, 0), b - a + 0.4 * TILE, TILE * GY);
      } else if (row.type === 'work') {
        c.strokeStyle = 'rgba(255,140,0,0.95)';
        for (let col = 0; col < COLS; col++) if (row.pit[col]) c.strokeRect(col * TILE + 3, P(row.y + TILE / 2 - 4, 0), TILE - 6, (TILE - 8) * GY);
      }
    }
    for (const p of Game.players) {
      if (!p.alive) continue;
      c.strokeStyle = 'rgba(80,255,140,0.95)';
      c.beginPath(); c.ellipse(p.x, P(p.y, 0), 0.24 * TILE, 0.24 * TILE * GY, 0, 0, 6.2832); c.stroke();
    }
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
    if (Settings.colorblind) { // black and yellow hazard stripes instead of a red wash
      c.save();
      c.beginPath();
      c.rect(x0, y, w, bot - y);
      c.clip();
      c.globalAlpha = 0.45 * a;
      c.fillStyle = '#fcc21b';
      c.fillRect(x0, y, w, bot - y);
      c.fillStyle = '#16181c';
      for (let x = Math.floor(x0 / 30) * 30; x < x0 + w; x += 30) {
        c.beginPath();
        c.moveTo(x, bot); c.lineTo(x + 15, bot); c.lineTo(x + 15 + (bot - y), y); c.lineTo(x + (bot - y), y);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.fillStyle = `rgba(252,194,27,${a * pulse})`;
      c.fillRect(x0, y - 3, w, 6);
      return;
    }
    c.fillStyle = `rgba(255,40,70,${0.28 * a})`;
    c.fillRect(x0, y, w, bot - y);
    c.fillStyle = `rgba(255,90,110,${0.9 * a * pulse})`;
    c.fillRect(x0, y - 2, w, 4);
  },

  // ---- Screen space ------------------------------------------------------------------------
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
    if (dz > 0) this.vignette(c, Settings.colorblind ? `rgba(252,194,27,${0.35 * dz})` : `rgba(255,40,70,${0.45 * dz * (0.7 + 0.3 * Math.sin(time * 10))})`);

    for (const row of World.rows.values()) {
      if (row.y < this.yBot || row.y > this.yTop) continue;
      // incoming train: yellow "RR" advance-warning sign at the edge it's coming from
      if (row.type === 'rail' && row.rail.state !== 'idle') {
        const R = row.rail;
        const coming = R.state === 'warn' || (R.dir > 0 ? R.x < this.x0 + TILE : R.x > this.x1 - TILE);
        if (coming) this.rrSign(c, R.dir > 0 ? 28 : W - 28, this.screenY(row.y, 10), time, R.tram);
      }
      // off-screen warning for reckless drivers about to enter the view
      if (row.type !== 'road') continue;
      for (const v of row.lane.vehicles) {
        if (!v.reckless || v.wreck || this.inViewX(v.x)) continue;
        const incoming = (v.dir > 0 && v.x < Cam.x) || (v.dir < 0 && v.x > Cam.x);
        if (!incoming) continue;
        this.edgeBadge(c, v, W, time);
      }
    }
    if (Game.state === 'playing' && Game.mode === 'time') this.clock(c, W, H, time);
    Replay.capture(dt || 0); // before the lens splatter and flashes, so the replay shows the action
    FX.drawLens(c, W, H);
    FX.drawFlash(c, W, H);
  },

  edgeBadge(c, v, W, time) {
    const sy = this.screenY(v.y, 10);
    const left = v.x < Cam.x;
    const sx = left ? 26 : W - 26;
    const s = 1 + (Settings.motion ? 0 : 0.15 * Math.sin(time * 14));
    const d = left ? -1 : 1;
    c.save();
    c.translate(sx, sy);
    c.scale(s, s);
    c.fillStyle = v.police ? '#3b82f6' : '#ff3355';
    if (Settings.colorblind && v.police) { c.fillRect(-14, -14, 28, 28); }
    else if (Settings.colorblind) {
      c.beginPath(); c.moveTo(0, -17); c.lineTo(16, 12); c.lineTo(-16, 12); c.closePath(); c.fill();
    } else {
      c.beginPath(); c.arc(0, 0, 15, 0, 6.2832); c.fill();
    }
    c.beginPath();
    c.moveTo(d * 24, 0);
    c.lineTo(d * 12, -8);
    c.lineTo(d * 12, 8);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    if (Settings.colorblind && v.police) {
      c.font = `900 16px ${UI_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('P', 0, 1);
    } else {
      c.fillRect(-2, -8, 4, 10);
      c.fillRect(-2, 4.5, 4, 3.5);
    }
    c.restore();
  },

  // Time attack: the countdown lives in the HUD; the last seconds pulse the screen edge.
  clock(c, W, H, time) {
    const left = Game.timeLeft;
    if (left > 10 || left <= 0 || !Game.timerOn) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 12);
    this.vignette(c, `rgba(255,190,40,${0.25 * pulse * (1 - left / 10)})`);
  },

  rrSign(c, x, y, time, tram) {
    const s = 1 + (Settings.motion ? 0 : 0.12 * Math.sin(time * 12));
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = '#1d1d1f';
    c.beginPath(); c.arc(0, 0, 19, 0, 6.2832); c.fill();
    c.fillStyle = '#fcc21b';
    c.beginPath(); c.arc(0, 0, 17, 0, 6.2832); c.fill();
    c.fillStyle = '#1d1d1f';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (tram) {
      c.font = `900 9px ${UI_FONT}`;
      c.fillText('TRAM', 0, 1);
    } else {
      c.strokeStyle = '#1d1d1f';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-11, -11); c.lineTo(11, 11);
      c.moveTo(11, -11); c.lineTo(-11, 11);
      c.stroke();
      c.font = `900 9px ${UI_FONT}`;
      c.fillText('R', -9, 1);
      c.fillText('R', 9, 1);
    }
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
