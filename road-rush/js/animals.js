'use strict';
// Wildlife and people on the road:
// - cows wander into a lane and stop traffic until they move on
// - deer bolt across a road; drivers slam their brakes and pile up behind them
// - tumbleweeds roll across the desert
// - seagulls on the beach snatch coins off the ground, and dive at you to steal yours
// - graphic mode: paramedics cover the body with a sheet

const Animals = {
  cows: [],
  deer: [],
  weeds: [],
  crew: [],
  gulls: [],

  reset() {
    this.cows.length = this.deer.length = this.weeds.length = this.crew.length = this.gulls.length = 0;
    this.gullT = rand(3, 6);
    this.t = rand(14, 24);
    this.weedT = 1;
  },

  // A road segment (consecutive road rows) between rows a..b, or null.
  findRoad(a, b) {
    for (let r = a; r <= b; r++) {
      const row = World.rows.get(r), below = World.rows.get(r - 1);
      if (!row || row.type !== 'road' || !below || below.type === 'road') continue;
      let top = r;
      while (World.rows.get(top + 1) && World.rows.get(top + 1).type === 'road') top++;
      return [r, top];
    }
    return null;
  },

  update(dt) {
    const playing = Game.state === 'playing';
    const lead = Game.leader();
    const zone = World.zoneAt(lead.maxRow + 4);
    if (playing) {
      this.t -= dt;
      if (this.t <= 0) {
        const ok = zone === 'country' ? (chance(0.5) ? this.spawnCow() : this.spawnDeer())
          : zone === 'farm' ? this.spawnCow(true)
            : zone === 'snow' || zone === 'autumn' ? this.spawnDeer() : false;
        this.t = ok ? (zone === 'farm' ? rand(9, 16) : rand(18, 32)) : 3;
      }
      if (zone === 'swamp' && chance(dt * 0.35)) Sound.croak();
    }
    if (playing && zone === 'harbor') {
      this.gullT -= dt;
      if (this.gullT <= 0) { this.gullT = rand(6, 11); this.spawnGull(); }
    }
    if (zone === 'desert' || this.weeds.length) {
      this.weedT -= dt;
      if (zone === 'desert' && this.weedT <= 0) { this.weedT = rand(1.2, 3.5); this.spawnWeed(); }
    }
    for (let i = this.cows.length - 1; i >= 0; i--) if (this.updateCow(this.cows[i], dt)) this.cows.splice(i, 1);
    for (let i = this.deer.length - 1; i >= 0; i--) if (this.updateDeer(this.deer[i], dt)) this.deer.splice(i, 1);
    for (let i = this.weeds.length - 1; i >= 0; i--) if (this.updateWeed(this.weeds[i], dt)) this.weeds.splice(i, 1);
    for (let i = this.crew.length - 1; i >= 0; i--) if (this.updateMedic(this.crew[i], dt)) this.crew.splice(i, 1);
    if (playing && zone === 'beach') {
      this.gullT -= dt;
      if (this.gullT <= 0) { this.gullT = rand(4, 8); this.spawnGull(); }
    }
    for (let i = this.gulls.length - 1; i >= 0; i--) if (this.updateGull(this.gulls[i], dt)) this.gulls.splice(i, 1);
  },

  // ---- Cows -------------------------------------------------------------------
  spawnCow(sheep = false) {
    const lead = Game.leader();
    const seg = this.findRoad(lead.row + 2, lead.row + 8);
    if (!seg) return false;
    const up = chance(0.5);
    const startRow = up ? seg[0] - 1 : seg[1] + 1;
    const col = randInt(1, COLS - 2);
    const cow = Vehicles.make({ speed: 0, dir: chance(0.5) ? 1 : -1 }, 'cow', startRow * TILE);
    cow.speed = cow.desired = 0;
    cow.x = cellX(col);
    cow.walk = { dy: up ? 1 : -1, row: startRow, lane: null, t: 0, wait: rand(0.5, 1.2), fy: cow.y, ty: cow.y, moving: false, leaving: false };
    cow.spots = [[rand(-12, 6), rand(-8, 6)], [rand(-4, 10), rand(-6, 8)], [rand(-14, 12), rand(-6, 6)]];
    cow.alpha = 0;
    if (sheep) { cow.sheep = true; cow.len = 1.0 * TILE; }
    this.cows.push(cow);
    if (!sheep) Sound.moo();
    return true;
  },

  // Is there room (and time) for a cow to step into this lane at x?
  laneClear(row, x, len) {
    const L = row.lane, dir = L.dir, u = x * dir;
    for (const v of L.vehicles) {
      if (Math.abs(v.x - x) < (v.len + len) / 2 + 6) return false;
      const du = u - len / 2 - (v.x * dir + v.len / 2); // distance in front of an oncoming car
      if (!v.wreck && du > -len && du < v.speed * 0.9 + 1.6 * TILE) return false;
    }
    for (const p of Game.players) if (p.alive && p.row === row.i && Math.abs(p.x - x) < 0.8 * TILE) return false;
    return true;
  },

  updateCow(cow, dt) {
    const w = cow.walk;
    if (cow.wreck || cow.dead) return true; // the lane owns it now
    if (cow.abducted) return false;        // beamed up by a UFO
    cow.alpha = Math.min(1, cow.alpha + dt * 2);
    if (w.moving) {
      w.t = Math.min(1, w.t + dt / 0.8);
      cow.y = lerp(w.fy, w.ty, easeOutQuad(w.t));
      if (w.t >= 1) { w.moving = false; w.wait = rand(1.6, 3.4); }
      return false;
    }
    if (w.leaving) {
      cow.alpha -= dt * 0.8;
      return cow.alpha <= 0;
    }
    w.wait -= dt;
    if (w.wait > 0) {
      if (w.lane && chance(dt * 0.25)) { if (!cow.sheep) Sound.moo(); FX.text(cow.x, cow.y + 26, cow.sheep ? 'BAA' : 'MOO', '#ffffff', 13); }
      return false;
    }
    const nextI = w.row + w.dy;
    const next = World.rows.get(nextI);
    if (!next) return true;
    if (next.type !== 'road') { // done crossing: wander off
      if (w.lane) {
        const vs = w.lane.lane.vehicles, k = vs.indexOf(cow);
        if (k >= 0) vs.splice(k, 1);
      }
      w.lane = null;
      w.row = nextI;
      w.fy = cow.y;
      w.ty = next.y;
      w.t = 0;
      w.moving = true;
      w.leaving = true;
      return false;
    }
    if (!this.laneClear(next, cow.x, cow.len)) { w.wait = 0.25; return false; }
    if (w.lane) {
      const vs = w.lane.lane.vehicles, k = vs.indexOf(cow);
      if (k >= 0) vs.splice(k, 1);
    }
    cow.dir = next.lane.dir;
    next.lane.vehicles.push(cow);
    w.lane = next;
    w.row = nextI;
    w.fy = cow.y;
    w.ty = next.y;
    w.t = 0;
    w.moving = true;
    return false;
  },

  lost(cow) {
    const k = this.cows.indexOf(cow);
    if (k >= 0) this.cows.splice(k, 1);
  },

  // ---- Deer ---------------------------------------------------------------------
  spawnDeer() {
    const lead = Game.leader();
    const seg = this.findRoad(lead.row + 1, lead.row + 6);
    if (!seg) return false;
    const up = chance(0.5);
    const y0 = (up ? seg[0] - 1 : seg[1] + 1) * TILE;
    const n = weighted([[1, 2], [2, 3], [3, 2]]);
    const x0 = cellX(randInt(1, COLS - 2));
    for (let k = 0; k < n; k++) {
      this.deer.push({
        kind: 'deer', x: x0 + rand(-14, 14), y: y0 - (up ? 1 : -1) * k * 0.9 * TILE, z: 0, vy: (up ? 1 : -1) * rand(6, 7.5) * TILE,
        delay: k * 0.3, ph: rand(6.28), buck: k === 0 && chance(0.6), alive: true, dist: 0, span: (seg[1] - seg[0] + 3.5) * TILE,
        hitP: [], alpha: 1,
      });
    }
    FX.text(x0, y0 + 30, 'DEER!', '#ffe9b0', 16);
    return true;
  },

  updateDeer(d, dt) {
    if (d.delay > 0) { d.delay -= dt; return false; }
    if (!d.alive) { d.alpha -= dt; return d.alpha <= 0; }
    const step = d.vy * dt;
    d.y += step;
    d.dist += Math.abs(step);
    d.ph += dt * 14;
    d.z = Math.abs(Math.sin(d.ph * 0.5)) * 14;
    if (d.dist > d.span) { d.alpha -= dt * 3; return d.alpha <= 0; }

    const row = World.rows.get(Math.round(d.y / TILE));
    if (row && row.type === 'road') {
      const L = row.lane, dir = L.dir, u = d.x * dir;
      for (const v of L.vehicles) {
        if (v.wreck || v.animal || v.abducted) continue;
        const du = u - (v.x * dir + v.len / 2); // how far in front of the car the deer is
        if (du > -v.len && du < 0.25 * TILE && v.speed > 60) { this.deerHit(d, v, row); return false; }
        if (du > 0 && du < 5 * TILE + v.speed * 0.4 && v.panic <= 0 && v.speed > 40) {
          v.panic = 1.1;
          if (Renderer.inViewX(v.x)) { Sound.screech(Vehicles.pan(v.x)); FX.text(v.x, v.y + 14, 'SCREECH!', '#ffffff', 13); }
        }
      }
    }
    for (const p of Game.players) {
      if (!p.alive || d.hitP.includes(p) || p.z > 20 || p.abduct) continue;
      if (Math.abs(p.x - d.x) > 0.55 * TILE || Math.abs(p.y - d.y) > 0.45 * TILE) continue;
      d.hitP.push(p);
      if (p.invincible() || p.grace > 0) continue;
      FX.text(p.x, p.y + 12, 'TRAMPLED!', '#ffe9b0', 15);
      p.knockback(p.x < d.x ? -1 : p.x > d.x ? 1 : (chance(0.5) ? 1 : -1), 0, 1, 0.7);
      if (Settings.gore) FX.bleed(p.x, p.y, 10);
      if (p.id === 0) Trophies.add('deer');
    }
    return false;
  },

  deerHit(d, v, row) {
    d.alive = false;
    d.alpha = 0;
    Vehicles.wreck(v);
    v.slide = row.lane.dir * v.speed * 0.3;
    v.rotV = rand(-2.5, 2.5);
    v.speed = 0;
    if (Settings.gore) FX.beef(d.x, row.y);
    else FX.dust(d.x, row.y, 14);
    FX.carCrash(d.x, row.y, [v.base, '#8a5a36']);
    Game.onCrash(d.x, row.y, false, 0.7);
    Vehicles.dispatch(row, 'ambulance', { x: d.x });
  },

  // ---- Tumbleweeds ------------------------------------------------------------
  spawnWeed() {
    const r0 = Math.ceil(Renderer.yBot / TILE), r1 = Math.floor(Renderer.yTop / TILE) - 2;
    if (r1 <= r0) return;
    const row = World.rows.get(randInt(r0, r1));
    if (!row || (row.type !== 'grass' && row.type !== 'road')) return;
    const dir = chance(0.5) ? 1 : -1;
    this.weeds.push({
      kind: 'weed', x: dir > 0 ? Renderer.x0 - TILE : Renderer.x1 + TILE, y: row.y + rand(-8, 8), z: 0, vz: 0,
      vx: dir * rand(90, 170), r: rand(8, 11), rot: 0,
    });
  },

  updateWeed(w, dt) {
    w.x += w.vx * dt;
    w.rot += (w.vx / w.r) * dt;
    w.vz -= 900 * dt;
    w.z += w.vz * dt;
    if (w.z <= 0) { w.z = 0; w.vz = rand(80, 200); }
    if (w.x < Renderer.x0 - 3 * TILE || w.x > Renderer.x1 + 3 * TILE) return true;
    const row = World.rows.get(Math.round(w.y / TILE));
    if (row && row.type === 'road') {
      for (const v of row.lane.vehicles) {
        if (!v.wreck && v.speed > 40 && Math.abs(v.x - w.x) < v.len / 2 + w.r) { FX.twigs(w.x, w.y); return true; }
      }
    }
    return false;
  },

  // ---- Paramedics (graphic mode) ----------------------------------------------------
  // The ambulance has pulled up next to the body: two medics bring a sheet.
  medics(amb) {
    const m = amb.mission;
    const rear = amb.x - amb.dir * amb.len * 0.45;
    for (const off of [-9, 9]) {
      this.crew.push({ kind: 'medic', x: rear, y: amb.y + off, z: 0, tx: m.x - amb.dir * 10, ty: m.y + off, state: 'out', t: 0, amb, m, home: rear, ph: rand(6) });
    }
  },

  updateMedic(c, dt) {
    c.t += dt;
    c.ph += dt * 10;
    const walkTo = (x, y) => {
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
      if (d < 2) return true;
      const s = Math.min(d, 55 * dt);
      c.x += (dx / d) * s;
      c.y += (dy / d) * s;
      c.face = dx >= 0 ? 1 : -1;
      return false;
    };
    if (c.state === 'out') { if (walkTo(c.tx, c.ty)) { c.state = 'kneel'; c.t = 0; } }
    else if (c.state === 'kneel') {
      if (c.t > 1.2 && c.m.p) c.m.p.sheet = Math.min(1, c.m.p.sheet + dt * 2);
      if (c.t > 2.2) c.state = 'back';
    } else if (c.state === 'back') {
      if (walkTo(c.home, c.amb.y + (c.ty - c.m.y))) {
        c.m.back = (c.m.back || 0) + 1;
        if (c.m.back >= 2) c.m.done = true; // the ambulance drives off once both are back
        return true;
      }
    }
    c.moving = c.state !== 'kneel';
    return false;
  },

  // ---- Seagulls -------------------------------------------------------------------
  spawnGull() {
    const lead = Game.leader();
    const coins = Items.list.filter(it => it.type === 'coin' && it.row > lead.row && it.row < lead.row + 7 && !it.gull);
    let tx, ty, coin = null;
    if (coins.length && chance(0.55)) {
      coin = pick(coins);
      coin.gull = true;
      tx = coin.x;
      ty = coin.y;
    } else { // dive at a player, aiming where they stand now
      const p = Game.target();
      if (!p.alive) return;
      if (p.id === 0 && Pets.has('minij')) { FX.text(p.x, p.y + 40, 'GLARE', '#ff6b6b', 13); return; } // too scared
      tx = p.x;
      ty = p.y;
    }
    const side = chance(0.5) ? 1 : -1;
    this.gulls.push({
      kind: 'gull', x: tx + side * 7 * TILE, y: ty + 4 * TILE, z: 170, fx: tx + side * 7 * TILE, fy: ty + 4 * TILE,
      tx, ty, t: 0, dur: 1.7, phase: 'in', coin, carry: false, face: -side, ph: rand(6),
    });
    Sound.squawk();
  },

  updateGull(g, dt) {
    g.t += dt;
    g.ph += dt * (g.phase === 'in' ? 14 : 18);
    if (g.phase === 'in') {
      const k = Math.min(1, g.t / g.dur), e = easeOutQuad(k);
      g.x = lerp(g.fx, g.tx, e);
      g.y = lerp(g.fy, g.ty, e);
      g.z = lerp(170, 6, e);
      if (k < 1) return false;
      g.phase = 'out';
      g.t = 0;
      if (g.coin) { // snatch the coin if it's still there
        const i = Items.list.indexOf(g.coin);
        if (i >= 0) { Items.list.splice(i, 1); g.carry = true; FX.text(g.x, g.y + 16, 'STOLEN!', '#ffffff', 14); Sound.squawk(); }
      } else {
        let hit = false;
        for (const p of Game.players) {
          if (!p.alive || Math.abs(p.x - g.x) > 0.6 * TILE || Math.abs(p.y - g.y) > 0.5 * TILE || p.z > 30) continue;
          hit = true;
          const n = Math.min(3, p.coins);
          if (n > 0) {
            p.coins -= n;
            if (p.id === 0) Game.coins = p.coins;
            g.carry = true;
            FX.text(p.x, p.y + 24, `-${n} COIN${n > 1 ? 'S' : ''}`, '#ffd23f', 16);
          } else {
            FX.text(p.x, p.y + 24, 'PECK!', '#ffffff', 14);
          }
          p.squash = 0.6;
          Sound.squawk();
        }
        if (!hit) FX.text(g.x, g.y + 16, 'MISSED', '#ffffff', 12);
      }
      g.fx = g.x;
      g.fy = g.y;
      return false;
    }
    const k = Math.min(1, g.t / 1.3);
    g.x = g.fx - g.face * k * 7 * TILE;
    g.y = g.fy + k * 3 * TILE;
    g.z = 6 + k * 180;
    return k >= 1;
  },

  // Where a diving gull will land (so you can get out of the way).
  drawGround(c, time) {
    for (const g of this.gulls) {
      if (g.phase !== 'in' || g.coin) continue;
      const k = Math.min(1, g.t / g.dur), pulse = 0.6 + 0.4 * Math.sin(time * 16);
      c.strokeStyle = `rgba(255,255,255,${0.35 + 0.5 * k * pulse})`;
      c.lineWidth = 2;
      c.setLineDash([5, 5]);
      c.beginPath(); c.ellipse(g.tx, P(g.ty, 4), 0.5 * TILE, 0.5 * TILE * GY, 0, 0, 6.2832); c.stroke();
      c.setLineDash([]);
    }
  },

  drawables(list) {
    for (const g of this.gulls) { g.key = g.y - 12; list.push(g); }
    for (const c of this.cows) if (!c.walk.lane || c.walk.leaving) { c.key = c.y - 14; list.push(c); }
    for (const d of this.deer) if (d.delay <= 0 && d.alpha > 0) { d.key = d.y - 11; list.push(d); }
    for (const w of this.weeds) { w.key = w.y - 9; list.push(w); }
    for (const c of this.crew) { c.key = c.y - 10.5; list.push(c); }
  },
};
