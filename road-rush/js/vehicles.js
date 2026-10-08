'use strict';
// Vehicles: types, spawning, lane traffic (following / braking), skids in
// the rain, panic braking for deer, vehicle-vs-vehicle crashes, blasts that
// toss nearby cars, emergency responders, and the "crash director" that sends
// reckless drivers and police chases into traffic.

// len/h in tiles; cab = [start, end] as fractions of length from the rear, + height.
const VEHICLE_TYPES = {
  small:     { name: 'a small car',    len: 1.05, h: 0.3,  cab: [0.2, 0.8, 0.3],   speed: 1.06, wheels: [-0.28, 0.28],
               colors: ['#ff6b6b', '#4ecdc4', '#ffd166', '#a78bfa', '#f78fb3'] },
  sedan:     { name: 'a sedan',        len: 1.4,  h: 0.28, cab: [0.24, 0.7, 0.28], speed: 1.0,  wheels: [-0.3, 0.3],
               colors: ['#3a86ff', '#e63946', '#eef2f5', '#2a9d8f', '#8d99ae', '#2b2d42'] },
  taxi:      { name: 'a taxi',         len: 1.4,  h: 0.28, cab: [0.24, 0.7, 0.28], speed: 1.08, wheels: [-0.3, 0.3],
               colors: ['#ffc619'] },
  sports:    { name: 'a sports car',   len: 1.35, h: 0.22, cab: [0.3, 0.66, 0.22], speed: 1.22, wheels: [-0.3, 0.3],
               colors: ['#ff006e', '#fb5607', '#ffbe0b', '#00c2a8', '#1b1b1f'] },
  pickup:    { name: 'a pickup truck', len: 1.6,  h: 0.34, cab: [0.52, 0.82, 0.3], speed: 0.95, wheels: [-0.3, 0.3],
               colors: ['#e76f51', '#264653', '#6a994e', '#bc6c25'] },
  van:       { name: 'a van',          len: 1.7,  h: 0.62, cab: null,              speed: 0.92, wheels: [-0.32, 0.32],
               colors: ['#f4f1de', '#81b29a', '#e07a5f', '#3d405b'] },
  bus:       { name: 'a bus',          len: 2.8,  h: 0.78, cab: null,              speed: 0.8,  wheels: [-0.36, -0.2, 0.34],
               colors: ['#ffb703', '#e63946', '#219ebc'] },
  tanker:    { name: 'a tanker truck', len: 2.7,  h: 0.66, cab: null,              speed: 0.85, wheels: [-0.4, -0.27, 0.12, 0.38],
               colors: ['#dfe3e8', '#c9ccd1', '#e8c547'] },
  police:    { name: 'a police car',   len: 1.45, h: 0.28, cab: [0.25, 0.7, 0.28], speed: 1.25, wheels: [-0.3, 0.3],
               colors: ['#20242c'] },
  ambulance: { name: 'an ambulance',   len: 1.8,  h: 0.66, cab: null,              speed: 1.3,  wheels: [-0.32, 0.3],
               colors: ['#f6f6f2'], responder: true },
  firetruck: { name: 'a fire truck',   len: 2.6,  h: 0.66, cab: null,              speed: 1.2,  wheels: [-0.38, -0.22, 0.3],
               colors: ['#d62828'], responder: true },
  tractor:   { name: 'a tractor',      len: 1.3,  h: 0.3,  cab: [0.1, 0.48, 0.42], speed: 0.55, wheels: [-0.27, 0.3],
               colors: ['#2f8a3a', '#d62828', '#1d5fbf'], bigWheels: true },
  logtruck:  { name: 'a logging truck', len: 2.8, h: 0.3,  cab: [0.74, 0.97, 0.34], speed: 0.85, wheels: [-0.4, -0.25, 0.1, 0.36],
               colors: ['#e63946', '#264653', '#f4a261'] },
  forklift:  { name: 'a forklift',     len: 1.0,  h: 0.25, cab: [0.12, 0.62, 0.48], speed: 0.6,  wheels: [-0.28, 0.25],
               colors: ['#ffb000', '#f26722'] },
  cow:       { name: 'a cow',          len: 1.15, h: 0.5,  cab: null,              speed: 0,    wheels: [],
               colors: ['#f4f1ea'], animal: true },
};

const Vehicles = {
  directorT: 8,
  sirenT: 0,

  reset() {
    this.directorT = rand(6, 9);
    this.sirenT = 0;
    this.drunkT = rand(4, 8);
    this.warnedDrunk = false;
  },

  // Night only: a drunk driver weaves along a lane near the player and
  // swerves into the next lane now and then.
  drunkDirector(dt) {
    if (!Lighting.isNight || Game.state !== 'playing') return;
    this.drunkT -= dt;
    if (this.drunkT > 0) return;
    this.drunkT = rand(8, 14);
    const lead = Game.leader();
    const rows = [];
    for (let r = lead.row + 1; r <= lead.row + 6; r++) {
      const row = World.rows.get(r);
      if (row && row.type === 'road' && !row.flood && !row.lane.pending) rows.push(row);
    }
    if (!rows.length) { this.drunkT = 2; return; }
    if (!this.spawnDrunk(pick(rows))) { this.drunkT = 2; return; }
    if (!this.warnedDrunk) {
      this.warnedDrunk = true;
      UI.toast('t-weather', 'DRUNK DRIVERS OUT', 'Swerving cars can change lanes without warning', 3600);
    }
  },

  // A drunk driver enters a lane (a random one near the player if none is given).
  spawnDrunk(row) {
    if (!row) {
      const lead = Game.leader(), rows = [];
      for (let r = lead.row + 1; r <= lead.row + 6; r++) {
        const R = World.rows.get(r);
        if (R && R.type === 'road' && !R.flood) rows.push(R);
      }
      if (!rows.length) return null;
      row = pick(rows);
    }
    const v = this.spawnAtEdge(row, pick(['sedan', 'pickup', 'small', 'sedan']));
    if (!v) return null;
    v.drunk = { t: rand(6), next: rand(1.2, 2.4), from: 0, to: 0, k: 1 };
    v.desired = v.speed = row.lane.speed * 1.2 + 30;
    v.dark = chance(0.5);
    return v;
  },

  // Put a vehicle just outside the view in a gap in traffic (or null if there's no room).
  spawnAtEdge(row, type) {
    const L = row.lane, vs = L.vehicles, dir = L.dir, len = VEHICLE_TYPES[type].len * TILE;
    const edge = dir > 0 ? Renderer.x0 - 1.2 * TILE - len / 2 : Renderer.x1 + 1.2 * TILE + len / 2;
    for (let k = 0; k < 8; k++) {
      const x = edge - dir * k * 1.5 * TILE, u = x * dir;
      const clear = vs.every(v => {
        const vu = v.x * dir;
        return vu - v.len / 2 > u + len / 2 + 1.5 * TILE || vu + v.len / 2 < u - len / 2 - 1.2 * TILE;
      });
      if (!clear) continue;
      const v = this.make(L, type, row.y);
      v.x = x;
      vs.push(v);
      return v;
    }
    return null;
  },

  // Weaving, speeding up and slowing down, and lurching into the next lane.
  updateDrunk(v, row, dt) {
    const d = v.drunk;
    d.t += dt;
    if (d.k < 1) { // mid lane change
      d.k = Math.min(1, d.k + dt / 0.6);
      v.y = lerp(d.from, d.to, easeOutQuad(d.k));
    } else {
      v.y = row.y + Math.sin(d.t * 2.6) * 5; // weaving inside the lane
    }
    v.rot = Math.sin(d.t * 2.6 + 0.8) * 0.07;
    if (Renderer.inViewX(v.x) && chance(dt * 0.3)) FX.text(v.x, v.y + 22, 'HIC!', '#ffd6a0', 13);
    d.next -= dt;
    if (d.next > 0 || d.k < 1) return false;
    d.next = rand(1.4, 2.8);
    const opts = [World.rows.get(row.i - 1), World.rows.get(row.i + 1)].filter(r => r && r.type === 'road' && r.lane.dir === row.lane.dir && !r.flood);
    if (!opts.length) return false;
    const to = pick(opts), L2 = to.lane, dir = L2.dir, u = v.x * dir;
    const room = L2.vehicles.every(w => {
      const wu = w.x * dir;
      if (wu > u) return wu - w.len / 2 > u + v.len / 2 + 0.6 * TILE; // car ahead
      return u - v.len / 2 - (wu + w.len / 2) > Math.max(0.8 * TILE, w.speed * 0.45); // car behind can still stop
    });
    if (!room) return false;
    const vs = row.lane.vehicles;
    vs.splice(vs.indexOf(v), 1);
    L2.vehicles.push(v);
    d.from = v.y;
    d.to = to.y;
    d.k = 0;
    if (Renderer.inViewX(v.x)) Sound.screech(this.pan(v.x));
    return true; // it left this lane
  },

  // Spawn weights per lane; faster, bigger and more dangerous vehicles show up
  // as it gets harder. Each biome has its own mix, plus the odd luxury car.
  weightsFor(d, zone = 'country') {
    return this.baseWeights(d, zone).concat(luxWeights(d, zone));
  },

  baseWeights(d, zone) {
    const city = zone === 'city', desert = zone === 'desert', snow = zone === 'snow', beach = zone === 'beach';
    if (zone === 'farm') return [['small', 2], ['sedan', 2], ['pickup', 3], ['tractor', 3], ['van', 1], ['tanker', d > 0.2 ? 0.4 : 0]].filter(e => e[1] > 0);
    if (zone === 'autumn') return [['small', 2], ['sedan', 2.5], ['pickup', 2.5], ['logtruck', 2.2], ['van', 1], ['sports', d > 0.08 ? 0.6 : 0]].filter(e => e[1] > 0);
    if (zone === 'harbor') return [['small', 1.5], ['van', 2.5], ['pickup', 1.5], ['forklift', 3], ['tanker', d > 0.2 ? 1 : 0.3], ['bus', d > 0.2 ? 0.4 : 0]].filter(e => e[1] > 0);
    if (zone === 'swamp') return [['small', 2], ['sedan', 2], ['pickup', 3.5], ['van', 1]];
    return [
      ['small', city ? 2.5 : 3], ['sedan', 3], ['taxi', city ? 2.2 : 0],
      ['pickup', desert ? 3.2 : snow ? 2.4 : 1.8], ['van', city ? 2 : beach ? 2.6 : 1.4],
      ['sports', d > 0.08 ? (0.5 + d * 1.5) * (snow ? 0.4 : 1) : 0],
      ['bus', (d > 0.2 ? 0.4 + d * 1.2 : 0.15) * (city ? 2 : 1)],
      ['tanker', d > 0.2 ? (0.2 + d * 0.5) * (desert ? 2.2 : city ? 0.5 : 1) : 0],
    ].filter(e => e[1] > 0);
  },

  make(L, type, y) {
    const T = VEHICLE_TYPES[type];
    const base = pick(T.colors);
    const desired = L.speed * T.speed * rand(0.93, 1.07);
    const v = {
      kind: 'vehicle', type, len: T.len * TILE, x: 0, y, dir: L.dir,
      speed: desired, desired, base, pal: Draw.vehiclePalette(base),
      wreck: false, bounced: false, reckless: false, police: type === 'police', stalled: false, dead: false,
      responder: !!T.responder, animal: !!T.animal,
      rot: 0, rotV: 0, slide: 0, wreckT: 0, alpha: 1,
      side: 0, horned: false, bumped: false, fireAcc: 0, smokeAcc: 0,
      z: 0, vz: 0, flipV: 0, settle: null, gore: false, secondary: 0,
      bloody: false, bloodT: 0, trackAcc: 0, abducted: 0, panic: 0, dousing: 0, doused: false,
      dark: !T.responder && !T.animal && type !== 'police' && chance(0.18), // no headlights (you only notice at night)
      drunk: null,
    };
    if (Golden.active) Golden.paint(v); // a golden run: gold cars
    return v;
  },

  // Distance gap kept between newly spawned vehicles (never spawn overlapping).
  randGap(L) {
    let g = rand(L.gapMin, L.gapMax);
    if (chance(0.15)) g *= 1.8;
    return Math.max(g, L.speed * 0.6);
  },

  // Fill a freshly generated lane so it doesn't start empty.
  populate(row) {
    const L = row.lane, dir = L.dir;
    const uStart = L.xStart * dir, uEnd = L.xEnd * dir;
    let front = uEnd - rand(0, 4 * TILE);
    for (;;) {
      const v = this.make(L, weighted(L.weights), row.y);
      const center = front - v.len / 2;
      if (center - v.len / 2 < uStart) break;
      v.x = center * dir;
      L.vehicles.push(v);
      front = center - v.len / 2 - this.randGap(L);
    }
    L.nextGap = this.randGap(L);
  },

  // "Wrong way" secret event: the whole lane turns around.
  flipLane(L) {
    L.dir *= -1;
    const s = L.xStart;
    L.xStart = L.xEnd;
    L.xEnd = s;
    L.reversed = !L.reversed;
    for (const v of L.vehicles) {
      if (v.wreck || v.animal) continue;
      v.dir = L.dir;
      v.speed *= 0.4;
      v.reckless = false;
      if (Renderer.inViewX(v.x)) FX.dust(v.x, v.y, 4);
    }
  },

  update(dt, fz) {
    let siren = null, sirenKind = 'police';
    for (const row of World.rows.values()) {
      if (row.type !== 'road') continue;
      if (!!row.lane.reversed !== Events.reverse) this.flipLane(row.lane);
      const s = this.updateLane(row, dt, fz);
      if (s && siren === null) { siren = s.x; sirenKind = s.kind; }
    }
    this.sirenT -= dt;
    if (siren !== null && this.sirenT <= 0 && Game.state !== 'gameover') {
      this.sirenT = sirenKind === 'police' ? 0.9 : 1.1;
      if (sirenKind === 'police') Sound.siren(this.pan(siren));
      else Sound.wail(this.pan(siren), sirenKind === 'firetruck');
    }
  },

  pan(x) { return clamp((x - Cam.x) / (6 * TILE), -1, 1) * 0.7; },

  // Lane coordinate u = x * dir always increases in the direction of travel.
  // Returns a visible siren ({x, kind}) or null.
  updateLane(row, dt, fz) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (vs.length > 1) vs.sort((a, b) => (b.x - a.x) * dir); // front-most first
    const playing = Game.state === 'playing';
    const players = Game.players;
    let nearest = null;
    if (playing) for (const p of players) if (p.alive && Math.abs(row.i - p.row) <= 1 && (!nearest || Math.abs(row.i - p.row) < Math.abs(row.i - nearest.row))) nearest = p;
    const rain = Game.weather.type === 'rain' ? Game.weather.amt : 0;
    const lfz = fz * (row.flood ? 0.45 : 1);
    const brake = lerp(750, 330, rain);
    let siren = null;

    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (v.wreck) { this.updateWreck(v, dt, lfz); continue; }
      if (v.abducted || v.animal) continue; // held by the UFO beam / a cow minding its own business
      if (v.drunk && this.updateDrunk(v, row, dt)) { i--; continue; }
      const lead = i > 0 ? vs[i - 1] : null;
      let target = v.drunk ? v.desired * (0.8 + 0.35 * Math.sin(v.drunk.t * 1.1)) : v.desired;
      let hard = false;

      if (v.panic > 0) { // slammed the brakes for a deer
        v.panic -= dt;
        target = 0;
        hard = true;
      }
      if (v.mission && !v.mission.done) { // responder pulling up at a crash (or a body)
        const m = v.mission;
        const gapM = m.x * dir - (v.x * dir + v.len / 2) - 0.5 * TILE;
        if (gapM < -v.len) m.done = true; // overshot: carry on
        else target = Math.min(target, Math.max(0, gapM) * 1.8);
        if (gapM < 10 && v.speed < 12) {
          if (m.p && !m.started) { m.started = true; Animals.medics(v); }
          if (!m.p && (m.t = (m.t || 0) + dt) > 6.5) m.done = true;
        }
      }
      if (lead) {
        const gap = (lead.x * dir - lead.len / 2) - (v.x * dir + v.len / 2);
        if (v.reckless) {
          if (gap <= 0) { this.crash(row, v, lead); continue; } // reckless drivers never brake
        } else {
          const leadV = lead.wreck || lead.animal ? 0 : lead.speed;
          const stop = (v.responder && (lead.wreck || lead.responder) ? 1.3 : 0.9) * TILE;
          if (gap < stop + v.speed * 0.5) target = Math.min(target, leadV + Math.max(0, gap - stop) * 1.6);
        }
      }

      const braking = target < v.speed - 50;
      v.speed = approach(v.speed, target, (target > v.speed ? 180 : hard ? 1300 : brake) * dt);
      v.x += dir * v.speed * lfz * dt;

      if (lead && !v.reckless) { // careful drivers never overlap the car ahead...
        const maxU = lead.x * dir - lead.len / 2 - 4 - v.len / 2;
        if (v.x * dir > maxU) {
          const closing = v.speed - (lead.wreck || lead.animal ? 0 : lead.speed);
          const visible = Renderer.inViewX(v.x) && (playing || Game.state === 'title');
          // ...unless the road is wet, or the car ahead slammed its brakes, and they were going too fast to stop
          if (visible && closing > 110 && !lead.animal && ((rain > 0.5 && Game.skidCooldown <= 0) || (lead.panic > 0 && closing > 150))) {
            if (lead.panic <= 0) Game.skidCooldown = rand(7, 12);
            FX.text(v.x, v.y + 10, lead.panic > 0 ? 'PILE-UP!' : 'SKID!', '#e0f0ff', 16);
            this.crash(row, v, lead);
            continue;
          }
          v.x = maxU * dir;
          v.speed = Math.min(v.speed, lead.wreck || lead.animal ? 0 : lead.speed);
          if (lead.animal && !v.horned && chance(dt * 0.8)) { v.horned = true; Sound.honk2(this.pan(v.x)); }
        }
      }

      if ((rain > 0.3 && braking && v.speed > 90 && Math.random() < dt * 22) || (hard && v.speed > 60 && Math.random() < dt * 30)) {
        FX.track(v.x - dir * v.len * 0.32, v.y, 0.7, '#16161a');
      }

      if (Settings.gore && FX.bloodPools.length) { // tyres pick up blood from pools on the road
        for (const p of FX.bloodPools) {
          if (Math.abs(p.y - row.y) < 0.5 * TILE && Math.abs(v.x - p.x) < v.len / 2 + p.r) { v.bloodT = Math.max(v.bloodT, 1.4); break; }
        }
      }
      if (v.bloodT > 0) { // bloody tyre tracks
        v.bloodT -= dt;
        v.trackAcc += v.speed * lfz * dt;
        for (; v.trackAcc > 9; v.trackAcc -= 9) FX.track(v.x - dir * v.len * 0.32, v.y, Math.min(1, v.bloodT / 2.5));
      }

      if (v.reckless && !v.horned && Renderer.inViewX(v.x)) {
        v.horned = true;
        Sound.horn(this.pan(v.x));
      }
      if ((v.police || v.responder) && siren === null && Renderer.inViewX(v.x) && Math.abs(row.y - Cam.y) < 12 * TILE) {
        siren = { x: v.x, kind: v.police ? 'police' : v.type };
      }
      if (v.type === 'firetruck') this.douse(v, row, dt);

      // close call: a car tore through the cell a player just hopped out of
      for (const p of players) {
        const rec = p.leftCell;
        if (rec && !rec.used && rec.row === row.i && Game.time - rec.t < 0.45 && v.speed * lfz > 80 &&
            Math.abs(v.x - cellX(rec.col)) < v.len / 2 + 0.1 * TILE) {
          rec.used = true;
          Game.nearMiss(1, p);
          if (v.drunk && p.id === 0) Trophies.add('drunkClose');
        }
      }

      if (nearest) { // whoosh as a car passes the player
        const side = v.x < nearest.x ? -1 : 1;
        if (v.side && side !== v.side && v.speed * lfz > 60) {
          Sound.whoosh(clamp(v.speed / 300, 0.3, 1) * (row.i === nearest.row ? 1 : 0.6), this.pan(v.x));
        }
        v.side = side;
      } else {
        v.side = 0;
      }
    }

    const uEnd = L.xEnd * dir;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      if (v.dead || v.x * dir - v.len / 2 > uEnd) vs.splice(i, 1);
    }
    this.trySpawn(row);
    return siren;
  },

  // A stopped fire truck hoses down burning wrecks near it.
  douse(v, row, dt) {
    if (v.speed > 30) { v.dousing = 0; return; }
    let target = null;
    for (const w of row.lane.vehicles) {
      if (w.wreck && !w.doused && !w.animal && Math.abs(w.x - v.x) < 3.2 * TILE && w.wreckT < (w.gore ? 7 : 3.2) + 6) { target = w; break; }
    }
    if (!target) {
      for (const r of [World.rows.get(row.i - 1), World.rows.get(row.i + 1)]) { // a crash in the next lane
        if (!r || r.type !== 'road') continue;
        for (const w of r.lane.vehicles) {
          if (w.wreck && !w.doused && !w.animal && Math.abs(w.x - v.x) < 3.2 * TILE && w.wreckT < (w.gore ? 7 : 3.2) + 6) { target = w; break; }
        }
        if (target) break;
      }
    }
    if (!target) { v.dousing = 0; return; }
    v.dousing += dt;
    if (Math.random() < dt * 40) {
      const nx = v.x + v.dir * v.len * 0.3;
      const dx = target.x - nx;
      FX.spawn('drop', nx, v.y, 30, { vx: dx * rand(1.2, 1.6), vy: (target.y - v.y) * rand(1.2, 1.6) + rand(-12, 12), vz: rand(110, 150), g: 360, life: rand(0.6, 0.8), size: 2.4, size2: 1.4, color: '#cfeaff' });
    }
    if (v.dousing > 1.4) {
      target.doused = true;
      FX.text(target.x, target.y + 16, 'FIRE OUT', '#bfe6ff', 13);
      for (let k = 0; k < 10; k++) FX.puff(target.x + rand(-12, 12), target.y, rand(10, 30), '#e8edf2');
    }
  },

  updateWreck(v, dt, fz) {
    const g = Events.gravity;
    v.wreckT += dt;
    v.x += v.slide * fz * dt;
    v.slide *= Math.exp(-2.6 * dt);
    v.rot += v.rotV * fz * dt;
    v.rotV *= Math.exp(-3.5 * dt);

    // airborne wreck: flips, lands, bounces, settles
    if (v.z > 0 || v.vz > 0) {
      v.vz -= 1100 * g * dt;
      v.z += v.vz * dt;
      v.rot += v.flipV * dt;
      if (v.z <= 0) {
        v.z = 0;
        if (v.vz < -180) {
          v.vz = -v.vz * 0.3;
          v.flipV *= 0.4;
          if (!v.animal) FX.sparks(v.x, v.y, 4, 16, ['#fff3b0', '#ffd166', '#ffffff'], 280);
          FX.dust(v.x, v.y, 10);
          Game.onWreckLand(v);
        } else {
          v.vz = 0;
          v.flipV = 0;
          v.rotV = 0;
          v.settle = Math.round(v.rot / Math.PI) * Math.PI + rand(-0.25, 0.25);
        }
      }
    } else if (v.settle !== null) {
      v.rot = damp(v.rot, v.settle, 6, dt);
    }

    if (v.secondary && v.wreckT >= v.secondary) { // fuel tank goes up
      v.secondary = 0;
      v.vz = Math.max(v.vz, 170);
      v.rotV += rand(-3, 3);
      Game.onSecondary(v);
    }

    if (!v.bounced && !v.animal) {
      const top = 4 + VEHICLE_TYPES[v.type].h * TILE + v.z;
      if (v.wreckT < (v.gore ? 7 : 3.2) && !v.doused) {
        v.fireAcc += dt * (v.gore ? 40 : 26);
        for (; v.fireAcc > 1; v.fireAcc--) FX.wreckFire(v.x + rand(-0.3, 0.3) * v.len, v.y, top);
      }
      if (v.wreckT < (v.gore ? 10 : 6)) {
        v.smokeAcc += dt * (v.gore ? 12 : 9);
        for (; v.smokeAcc > 1; v.smokeAcc--) FX.wreckSmoke(v.x + rand(-0.25, 0.25) * v.len, v.y, top + 6, v.gore && !v.doused);
      }
    }
    // wrecks linger while the responders work, then get cleared
    const life = v.bounced ? 3.5 : v.animal ? 4 : v.gore ? 11 : 7;
    if (v.wreckT > life - 1) v.alpha = clamp(life - v.wreckT, 0, 1);
    if (v.wreckT > life) v.dead = true;
  },

  // Responders appear just outside the view (in a gap in traffic) so they
  // arrive while the crash is still on screen.
  spawnResponder(row) {
    const L = row.lane, vs = L.vehicles, dir = L.dir, T = VEHICLE_TYPES[L.pending], len = T.len * TILE;
    const edge = dir > 0 ? Renderer.x0 - 1.2 * TILE - len / 2 : Renderer.x1 + 1.2 * TILE + len / 2;
    for (let k = 0; k < 8; k++) {
      const x = edge - dir * k * 1.5 * TILE, u = x * dir;
      const clear = vs.every(v => {
        const vu = v.x * dir;
        return vu - v.len / 2 > u + len / 2 + 1.5 * TILE || vu + v.len / 2 < u - len / 2 - 1.2 * TILE;
      });
      if (!clear) continue;
      const v = this.make(L, L.pending, row.y);
      v.desired = Math.max(260, L.speed * 1.7);
      v.speed = v.desired * 0.8;
      v.x = x;
      v.mission = L.pendingFor;
      vs.push(v);
      L.pending = L.pendingFor = L.nextType = null;
      return true;
    }
    return false;
  },

  trySpawn(row) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (L.pending && this.spawnResponder(row)) return;
    if (!L.nextType) L.nextType = L.pending || weighted(L.weights);
    const len = VEHICLE_TYPES[L.nextType].len * TILE;
    const uStart = L.xStart * dir;
    let rear = null;
    for (const v of vs) if (!rear || v.x * dir < rear.x * dir) rear = v;
    if (rear && (rear.x * dir - rear.len / 2) - (uStart + len / 2) < (L.nextType === L.pending ? 1.2 * TILE : L.nextGap)) return;
    const v = this.make(L, L.nextType, row.y);
    if (v.responder) {
      v.desired = v.speed = Math.max(260, L.speed * 1.7);
      if (L.pendingFor) v.mission = L.pendingFor;
      L.pending = null;
      L.pendingFor = null;
    }
    v.x = uStart * dir;
    if (rear && !rear.wreck && !v.responder) v.speed = Math.min(v.speed, rear.speed + 20);
    vs.push(v);
    L.nextType = null;
    L.nextGap = this.randGap(L);
  },

  // Emergency services head for a crash or a body. For a crash they come up
  // the lane next to it (the crashed lane is blocked by the wreck and the queue
  // behind it) and stop alongside; for a body they come up the same lane.
  dispatch(row, kind, mission) {
    if (!row || row.type !== 'road') return;
    let lane = row;
    if (!mission.p) {
      const free = r => r && r.type === 'road' && !r.flood && !r.lane.pending && !r.lane.vehicles.some(v => v.responder && !v.wreck);
      const side = [World.rows.get(row.i - 1), World.rows.get(row.i + 1)].filter(free);
      if (side.length) lane = pick(side);
      mission.x += lane.lane.dir * 1.2 * TILE;
    }
    const L = lane.lane;
    if (L.pending || L.vehicles.some(v => v.responder && !v.wreck)) return;
    L.pending = kind;
    L.pendingFor = mission;
    L.nextType = null;
  },

  // A stopped (or frozen) vehicle, cow, stalled car or stopped train in this cell blocks movement into it.
  blocksCell(col, rowI) {
    const row = World.rows.get(rowI);
    if (!row) return false;
    const cx = cellX(col), fz = Game.trafficFactor();
    if (row.type === 'rail') return Rail.blocks(row, cx, fz);
    if (row.type !== 'road') return false;
    for (const v of row.lane.vehicles) {
      if (v.abducted || v.z > 30) continue;
      const moving = (v.wreck ? Math.abs(v.slide) : v.speed) * fz;
      if (moving >= 25) continue;
      if (Math.abs(v.x - cx) < v.len / 2 + 0.2 * TILE) return true;
    }
    return false;
  },

  // Did a car just race through this cell? (close call when hopping in right behind it)
  justPassed(col, rowI) {
    const row = World.rows.get(rowI);
    if (!row || row.type !== 'road') return false;
    const dir = row.lane.dir, cu = cellX(col) * dir;
    for (const v of row.lane.vehicles) {
      if (v.wreck || v.speed < 80) continue;
      const d = (v.x * dir - v.len / 2) - (cu + 0.25 * TILE);
      if (d > 0 && d < v.speed * 0.3) return true;
    }
    return false;
  },

  wreck(v) {
    v.wreck = true;
    v.wreckT = 0;
    v.bounced = false;
    v.reckless = false;
    v.stalled = false;
    v.abducted = 0;
    v.panic = 0;
    v.alpha = 1;
    v.gore = Settings.gore;
    if (!v.animal) v.pal = Draw.wreckPalette(v.base);
    v.settle = null;
    if (Game.state === 'playing' && Renderer.inViewX(v.x)) Stats.add('wrecks');
  },

  // Blast or impact throws a car into the air and wrecks it.
  toss(v, fromX, power = 1) {
    this.wreck(v);
    v.slide = sign(v.x - fromX) * rand(120, 260) * power;
    v.rotV = (chance(0.5) ? 1 : -1) * rand(2, 4);
    v.speed = 0;
    v.vz = rand(180, 320) * power * (Settings.gore ? 1.3 : 1);
    v.flipV = (chance(0.5) ? 1 : -1) * rand(5, 9);
  },

  // Every car within `radius` of a blast is tossed and set on fire.
  blastVehicles(x, y, radius, skip = []) {
    let n = 0;
    for (const row of World.rows.values()) {
      if (row.type !== 'road' || Math.abs(row.y - y) > radius + TILE) continue;
      for (const v of row.lane.vehicles) {
        if (v.wreck || skip.includes(v)) continue;
        const dx = Math.max(0, Math.abs(v.x - x) - v.len / 2);
        if (Math.hypot(dx, row.y - y) > radius) continue;
        if (v.animal) { this.hitAnimal(row, v, x, 1.2); continue; }
        this.toss(v, x, 1.2);
        n++;
      }
    }
    return n;
  },

  // Something big (meteor, giant, goose, laser) destroys a car outright.
  smash(v, fromX, power = 1) {
    if (v.animal) { this.hitAnimal(World.rows.get(Math.round(v.y / TILE)), v, fromX, power); return; }
    this.toss(v, fromX, power);
    if (Settings.gore) FX.carCrashViolent(v.x, v.y, [v.base, '#2a2a2e']);
    else FX.carCrash(v.x, v.y, [v.base, '#2a2a2e']);
    Game.onCrash(v.x, v.y, Settings.gore, 0.8);
    this.dispatch(World.rows.get(Math.round(v.y / TILE)), 'firetruck', { x: v.x });
  },

  // A car ploughs into a cow.
  hitAnimal(row, cow, fromX, power = 1) {
    this.toss(cow, fromX, power * 0.8);
    cow.vz = rand(260, 340);
    FX.text(cow.x, cow.y + 20, cow.sheep ? 'BAA!' : 'MOO!', '#ffffff', 22);
    if (!cow.sheep) Sound.moo(true);
    if (Settings.gore) FX.beef(cow.x, cow.y);
    else FX.dust(cow.x, cow.y, 14);
    Cam.addTrauma(0.2);
    Animals.lost(cow);
  },

  // Rear-end collision: both cars become burning wrecks.
  crash(row, a, b) {
    const dir = row.lane.dir;
    if (b.animal) { // hit a cow: the cow goes flying, the car is wrecked
      this.hitAnimal(row, b, a.x, 1.4);
      this.wreck(a);
      a.slide = dir * a.speed * 0.3;
      a.rotV = rand(-2, 2);
      a.speed = 0;
      FX.carCrash(b.x, row.y, [a.base, '#2a2a2e']);
      Game.onCrash(b.x, row.y, false, 0.8);
      this.dispatch(row, 'ambulance', { x: b.x });
      return;
    }
    const cx = (((a.x * dir + a.len / 2) + (b.x * dir - b.len / 2)) / 2) * dir;
    const bSpeed = b.wreck ? 0 : b.speed;
    const rel = Math.max(90, a.speed - bSpeed);
    const tanker = a.type === 'tanker' || b.type === 'tanker';
    this.wreck(a);
    this.wreck(b);
    b.slide = dir * (bSpeed + rel * 0.55);
    a.slide = dir * a.speed * 0.12;
    const s = chance(0.5) ? 1 : -1;
    a.rotV = s * rand(1.3, 2.2);
    b.rotV = -s * rand(1.1, 2.0);
    a.speed = b.speed = 0;
    a.x -= dir * 4;
    b.x += dir * 4;

    const violent = Settings.gore;
    if (violent || tanker) {
      b.slide *= 1.4;
      a.vz = rand(320, 400);           // the rear car gets launched and flips
      a.flipV = s * rand(8, 11);
      b.vz = rand(140, 220);
      b.flipV = -s * rand(2, 4);
      a.secondary = rand(0.3, 0.45);   // then the fuel tanks go up
      b.secondary = rand(0.6, 0.9);
    }
    if (tanker) {
      FX.tankerBlast(cx, row.y, [a.base, b.base], violent);
      this.blastVehicles(cx, row.y, (violent ? 3.4 : 2.5) * TILE, [a, b]);
      Game.onCrash(cx, row.y, true, violent ? 2.1 : 1.7, 'tanker');
    } else if (violent) {
      FX.carCrashViolent(cx, row.y, [a.base, b.base]);
      this.blastVehicles(cx, row.y, 1.3 * TILE, [a, b]);
      Game.onCrash(cx, row.y, true, 1.35);
    } else {
      FX.carCrash(cx, row.y, [a.base, b.base]);
      Game.onCrash(cx, row.y, false, 1);
    }
    this.dispatch(row, tanker || violent || chance(0.5) ? 'firetruck' : 'ambulance', { x: cx });
  },

  // Shield hit: the car is knocked back and spins out.
  bounce(v, row) {
    const dir = row.lane.dir;
    this.wreck(v);
    v.bounced = true;
    v.gore = false;
    v.pal = Draw.vehiclePalette(v.base);
    v.slide = -dir * Math.max(140, v.speed * 0.7);
    v.rotV = (chance(0.5) ? 1 : -1) * rand(2.5, 4);
    v.speed = 0;
    FX.sparks(v.x - dir * v.len / 2, v.y, 12, 18, ['#ffffff', '#bfe3ff', '#ffd166'], 280);
  },

  // Every so often, send trouble into a lane near the player, timed so it
  // rear-ends the last car in that lane while on screen: a lone reckless
  // driver, or a speeder with a police car right behind (a chain crash).
  director(dt, playerRow, fz) {
    this.directorT -= dt;
    if (this.directorT > 0) return;
    if (Upgrades.has('sunday')) { this.directorT = 2; return; } // the Sunday Drivers upgrade: nobody speeds
    const d = difficulty(Game.leader().maxRow);
    const cands = [];
    const lenR = VEHICLE_TYPES.sports.len * TILE;
    for (let r = playerRow - 2; r <= playerRow + 7; r++) {
      if (r === playerRow) continue;
      const row = World.rows.get(r);
      if (!row || row.type !== 'road' || row.flood) continue;
      const L = row.lane, vs = L.vehicles, dir = L.dir;
      if (!vs.length || vs.some(v => v.wreck || v.reckless || v.animal || v.responder)) continue;
      let t = vs[0];
      for (const v of vs) if (v.x * dir < t.x * dir) t = v; // rear-most car = target
      const uT = t.x * dir;
      const tSpeed = Math.max(40, t.speed * fz);
      const uc = rand(0.25, 0.75) * WORLD_W * dir;   // where we want the crash
      const tt = (uc - uT) / tSpeed;                 // time for target to get there
      if (tt < 1.4 || tt > 6.5) continue;
      const gapNow = (uT - t.len / 2) - (L.xStart * dir + lenR / 2);
      if (gapNow < 3 * TILE) continue;
      const vR = tSpeed + gapNow / tt;
      if (vR > 640) continue;
      const w = (1 / (1 + Math.abs(r - playerRow - 1))) * (t.type === 'tanker' ? 3 : 1);
      cands.push([{ row, vR: vR / Math.max(fz, 0.2) }, w]);
    }
    if (!cands.length) { this.directorT = 0.6; return; }
    const { row, vR } = weighted(cands);
    const L = row.lane, dir = L.dir;
    const chase = d > 0.12 && chance(0.35);
    const v = this.make(L, 'sports', row.y);
    v.reckless = true;
    v.desired = v.speed = vR;
    v.x = L.xStart;
    v.base = chase ? pick(['#ffbe0b', '#00c2a8', '#fb5607']) : '#ff2e4d';
    v.pal = Draw.vehiclePalette(v.base);
    L.vehicles.push(v);
    if (chase) {
      const cop = this.make(L, 'police', row.y);
      cop.reckless = true;
      cop.horned = true;
      cop.desired = cop.speed = vR;
      cop.x = L.xStart - dir * (v.len / 2 + cop.len / 2 + 0.6 * TILE);
      L.vehicles.push(cop);
    }
    this.directorT = (rand(12, 20) - 4 * d) * (Game.modeDef().crashRate || 1);
  },
};
