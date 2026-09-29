'use strict';
// Weather surprises.
// - Thunderstorms: during heavy rain, lightning marks a cell (a glowing ring
//   and a bolt icon) for a second, then strikes it. It kills anything there.
// - Tornadoes: in rain or dust storms a twister crosses the road ahead. It
//   lifts cars and flings them down nearby, and a player it catches gets
//   carried off and dropped a row or two away.

const Storms = {
  bolts: [],
  twisters: [],
  flying: [],

  reset() {
    this.bolts.length = this.twisters.length = this.flying.length = 0;
    this.strikeT = rand(3, 6);
    this.twistT = rand(25, 45);
    this.stormWarned = false;
  },

  update(dt) {
    const playing = Game.state === 'playing';
    const w = Game.weather;
    // lightning
    if (playing && w.type === 'rain' && w.amt > 0.6) {
      this.strikeT -= dt;
      if (this.strikeT <= 0) { this.strikeT = rand(3.5, 7.5); this.mark(); }
    }
    // tornadoes
    const zone = World.zoneAt(Game.leader().maxRow + 3);
    if (playing && (w.type === 'rain' || w.type === 'dust') && w.amt > 0.5 && zone !== 'city' && zone !== 'snow' && !this.twisters.length) {
      this.twistT -= dt;
      if (this.twistT <= 0) { this.twistT = rand(40, 70); this.spawnTwister(); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= b.warn && !b.struck) this.strike(b);
      if (b.t > b.warn + 0.35) this.bolts.splice(i, 1);
    }
    for (let i = this.twisters.length - 1; i >= 0; i--) if (this.updateTwister(this.twisters[i], dt)) this.twisters.splice(i, 1);
    for (let i = this.flying.length - 1; i >= 0; i--) if (this.updateFlying(this.flying[i], dt)) this.flying.splice(i, 1);
  },

  // ---- Lightning -----------------------------------------------------------------
  mark() {
    let x, y;
    const cars = [];
    for (const row of World.rows.values()) {
      if (row.type !== 'road' || row.y < Renderer.yBot + TILE || row.y > Renderer.yTop - 3 * TILE) continue;
      for (const v of row.lane.vehicles) if (!v.wreck && !v.animal && Renderer.inViewX(v.x)) cars.push(v);
    }
    if (cars.length && chance(0.45)) { // strike ahead of a moving car
      const v = pick(cars);
      x = clamp(v.x + v.dir * v.speed * 1.1, 0.5 * TILE, WORLD_W - 0.5 * TILE);
      y = v.y;
      x = cellX(clamp(Math.round(x / TILE - 0.5), 0, COLS - 1));
    } else { // near a player
      const p = Game.target();
      x = cellX(clamp(p.col + randInt(-2, 2), 0, COLS - 1));
      y = (p.row + randInt(0, 3)) * TILE;
    }
    this.bolts.push({ x, y, t: 0, warn: 1.15, struck: false, seed: rand(1000) });
    FX.flashScreen(0.1, '200,215,255'); // distant flicker
    if (!this.stormWarned) {
      this.stormWarned = true;
      UI.toast('t-weather', 'THUNDERSTORM', 'Lightning strikes where the ground glows', 3600);
    }
  },

  strike(b) {
    b.struck = true;
    const near = clamp(1 - Math.hypot(Cam.x - b.x, Cam.y - b.y) / TILE / 12, 0.2, 1);
    Sound.thunder(near);
    FX.flashScreen(0.55 * near, '225,235,255');
    Cam.addTrauma(0.35 * near);
    FX.scorchMark(b.x, b.y, 16, 12, 0.6);
    FX.sparks(b.x, b.y, 4, 26, ['#ffffff', '#cfe3ff', '#fff3b0'], 360);
    flattenAt(b.x, b.y, 0.4 * TILE, 0.4 * TILE);
    const row = World.rows.get(Math.round(b.y / TILE));
    if (row && row.type === 'road') {
      for (const v of row.lane.vehicles) {
        if (!v.wreck && !v.abducted && Math.abs(v.x - b.x) < v.len / 2 + 8) Vehicles.smash(v, b.x, 0.9);
      }
    }
    for (const p of Game.players) {
      if (!p.alive || p.z > 40 || Math.abs(p.x - b.x) > 0.55 * TILE || Math.abs(p.y - b.y) > 0.5 * TILE) continue;
      if (p.invincible() || p.grace > 0) continue;
      if (p.shield) { p.shield = false; p.grace = 1.3; FX.shieldBreak(p.x, p.y); Sound.shieldBreak(); continue; }
      Game.kill('lightning', { p, dir: chance(0.5) ? 1 : -1 });
    }
  },

  // ---- Tornadoes -------------------------------------------------------------------
  spawnTwister() {
    const lead = Game.leader();
    const dir = chance(0.5) ? 1 : -1;
    const y = (lead.row + randInt(2, 4)) * TILE;
    this.twisters.push({
      x: dir > 0 ? Renderer.x0 - 2 * TILE : Renderer.x1 + 2 * TILE, y, y0: y, dir,
      speed: rand(55, 75), t: 0, spin: 0, rumble: 0, carried: [],
    });
    UI.toast('t-event', 'TORNADO!', 'Stay out of its path', 3600);
    Sound.eventSting();
  },

  updateTwister(tw, dt) {
    tw.t += dt;
    tw.spin += dt * 9;
    tw.x += tw.dir * tw.speed * dt;
    tw.y = tw.y0 + Math.sin(tw.t * 0.7) * 1.3 * TILE; // wanders back and forth across a few rows
    tw.rumble -= dt;
    const near = clamp(1 - Math.hypot(Cam.x - tw.x, Cam.y - tw.y) / TILE / 12, 0, 1);
    if (tw.rumble <= 0) { tw.rumble = 0.55; Sound.rumble(0.35 + 0.5 * near); }
    Cam.addTrauma(dt * 0.25 * near);
    if (chance(dt * 30)) {
      const a = rand(6.28), r = rand(10, 30);
      FX.spawn('dust', tw.x + Math.cos(a) * r, tw.y + Math.sin(a) * r * 0.5, 2, { vx: -Math.sin(a) * 90, vy: Math.cos(a) * 50, vz: rand(30, 80), g: -20, drag: 1.2, life: rand(0.6, 1), size: rand(4, 6), size2: rand(10, 16), color: '#9c8f7e', alpha: 0.6 });
    }
    flattenAt(tw.x, tw.y, 0.8 * TILE, 0.6 * TILE);
    // suck up cars
    for (const row of World.rows.values()) {
      if (row.type !== 'road' || Math.abs(row.y - tw.y) > 0.9 * TILE) continue;
      const vs = row.lane.vehicles;
      for (let i = vs.length - 1; i >= 0; i--) {
        const v = vs[i];
        if (v.abducted || v.dead || v.z > 10 || Math.abs(v.x - tw.x) > 1.1 * TILE + v.len / 2) continue;
        vs.splice(i, 1);
        this.flying.push({ v, tw, t: 0, ang: rand(6.28), r: rand(18, 32), phase: 'up', life: rand(1.2, 2.2) });
      }
    }
    // and players
    for (const p of Game.players) {
      if (!p.alive || p.abduct || p.invincible() || Game.state !== 'playing') continue;
      if (Math.abs(p.x - tw.x) > 0.8 * TILE || Math.abs(p.y - tw.y) > 0.6 * TILE) continue;
      p.startTwister(tw);
    }
    return (tw.dir > 0 && tw.x > Renderer.x1 + 3 * TILE) || (tw.dir < 0 && tw.x < Renderer.x0 - 3 * TILE) || tw.t > 30;
  },

  // A car caught in the funnel: spirals up, then gets flung down nearby.
  updateFlying(f, dt) {
    const v = f.v;
    f.t += dt;
    if (f.phase === 'up') {
      f.ang += dt * 6;
      v.x = f.tw.x + Math.cos(f.ang) * f.r;
      v.y = f.tw.y + Math.sin(f.ang) * f.r * 0.4;
      v.z = Math.min(140, v.z + dt * 110);
      v.rot += dt * 7;
      if (f.t > f.life) {
        f.phase = 'fling';
        f.vx = Math.cos(f.ang) * rand(120, 200) + f.tw.dir * 60;
        f.vy = Math.sin(f.ang) * rand(40, 90);
        f.vz = 60;
      }
      return false;
    }
    f.vz -= 700 * dt;
    v.x += f.vx * dt;
    v.y += f.vy * dt;
    v.z += f.vz * dt;
    v.rot += dt * 9;
    if (v.z > 0) return false;
    // crash down: explode, and leave a wreck on whatever road is below
    v.z = 0;
    const row = World.rows.get(Math.round(v.y / TILE));
    if (row && row.type === 'road') {
      v.y = row.y;
      v.dir = row.lane.dir;
      row.lane.vehicles.push(v);
      Vehicles.toss(v, v.x - f.vx, 0.5);
    } else {
      v.dead = true;
    }
    if (Settings.gore) FX.carCrashViolent(v.x, v.y, [v.base, '#2a2a2e']);
    else FX.carCrash(v.x, v.y, [v.base, '#2a2a2e']);
    Game.onCrash(v.x, v.y, Settings.gore, 0.8);
    return true;
  },

  // ---- Drawing -------------------------------------------------------------------------
  drawables(list) {
    for (const f of this.flying) if (f.v.z > 0 || f.phase === 'up') { f.v.key = f.v.y - 14; list.push(f.v); }
    for (const tw of this.twisters) {
      list.push({ kind: 'event', key: tw.y - 20, x: tw.x, y: tw.y, shadow: [2.2 * TILE, 1.2 * TILE], draw: (c, time) => this.drawTwister(c, tw, time) });
    }
  },

  drawTwister(c, tw, time) {
    const layers = 16;
    // dust skirt at the base
    c.fillStyle = 'rgba(120,105,85,0.45)';
    c.beginPath(); c.ellipse(0, P(0, 3), 34, 34 * GY * 0.6, 0, 0, 6.2832); c.fill();
    for (let k = 0; k < layers; k++) {
      const f = k / (layers - 1);
      const z = f * 230, r = 8 + f * f * 70;
      const wob = Math.sin(tw.spin * 0.6 + f * 4) * (5 + f * 16);
      const cy = P(0, z);
      c.globalAlpha = 0.55 + 0.3 * (1 - f);
      c.fillStyle = k % 2 ? '#5f574c' : '#72695c';
      c.beginPath(); c.ellipse(wob, cy, r, r * 0.34, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(210,200,180,0.5)';
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(wob, cy, r * 0.8, r * 0.26, 0, tw.spin + k, tw.spin + k + 2); c.stroke();
    }
    c.globalAlpha = 1;
    // debris whirling around the funnel
    for (let k = 0; k < 10; k++) {
      const a = tw.spin * 1.3 + k * 0.63, z = 20 + ((k * 37) % 160), r = 14 + z * 0.3;
      const x = Math.cos(a) * r, y = P(Math.sin(a) * r * 0.3, z);
      c.fillStyle = ['#3a2f25', '#6b4a2a', '#2e8b3e', '#9aa0a8'][k % 4];
      c.fillRect(x - 2.5, y - 1.5, 5, 3);
    }
  },

  // Warning rings on the ground where lightning is about to hit.
  drawGround(c, time) {
    for (const b of this.bolts) {
      if (b.struck) continue;
      const k = b.t / b.warn, pulse = 0.55 + 0.45 * Math.sin(time * 22);
      const cy = P(b.y, 2), r = 0.55 * TILE;
      c.fillStyle = `rgba(200,225,255,${(0.15 + 0.35 * k) * pulse})`;
      c.beginPath(); c.ellipse(b.x, cy, r, r * GY, 0, 0, 6.2832); c.fill();
      c.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`;
      c.lineWidth = 2.5;
      c.stroke();
      // bolt icon, so it doesn't rely on colour
      c.fillStyle = `rgba(255,236,120,${0.7 + 0.3 * pulse})`;
      c.beginPath();
      c.moveTo(b.x + 3, cy - 11); c.lineTo(b.x - 5, cy + 1); c.lineTo(b.x, cy + 1);
      c.lineTo(b.x - 3, cy + 11); c.lineTo(b.x + 6, cy - 2); c.lineTo(b.x + 1, cy - 2);
      c.closePath();
      c.fill();
    }
  },

  // The bolt itself (drawn over everything in the world).
  drawSky(c) {
    for (const b of this.bolts) {
      if (!b.struck) continue;
      const a = 1 - (b.t - b.warn) / 0.35;
      if (a <= 0) continue;
      const top = P(b.y, 700), bot = P(b.y, 0);
      const pts = [[b.x, bot]];
      let x = b.x;
      const n = 9;
      for (let k = 1; k < n; k++) {
        x += Math.sin(b.seed + k * 12.7) * 12;
        pts.push([x, lerp(bot, top, k / n)]);
      }
      pts.push([x, top]);
      c.globalCompositeOperation = 'lighter';
      for (const [w, col] of [[10, `rgba(140,180,255,${0.35 * a})`], [3.5, `rgba(255,255,255,${a})`]]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
        c.stroke();
      }
      c.fillStyle = `rgba(210,230,255,${0.5 * a})`;
      c.beginPath(); c.ellipse(b.x, bot, 40, 40 * GY, 0, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  },

  lights(fn) {
    for (const b of this.bolts) {
      if (!b.struck) fn(b.x, b.y, 0, 0.9 * TILE, 'lamp');
      else fn(b.x, b.y, 0, 6 * TILE, 'lamp');
    }
  },
};
