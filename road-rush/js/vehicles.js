'use strict';
// Vehicles: types, spawning, lane traffic (following / braking), skids in
// the rain, vehicle-vs-vehicle crashes, blasts that toss nearby cars, and the
// "crash director" that sends reckless drivers and police chases into traffic.

// len/h in tiles; cab = [start, end] as fractions of length from the rear, + height.
const VEHICLE_TYPES = {
  small:  { name: 'a small car',    len: 1.05, h: 0.3,  cab: [0.2, 0.8, 0.3],   speed: 1.06, wheels: [-0.28, 0.28],
            colors: ['#ff6b6b', '#4ecdc4', '#ffd166', '#a78bfa', '#f78fb3'] },
  sedan:  { name: 'a sedan',        len: 1.4,  h: 0.28, cab: [0.24, 0.7, 0.28], speed: 1.0,  wheels: [-0.3, 0.3],
            colors: ['#3a86ff', '#e63946', '#eef2f5', '#2a9d8f', '#8d99ae'] },
  sports: { name: 'a sports car',   len: 1.35, h: 0.22, cab: [0.3, 0.66, 0.22], speed: 1.22, wheels: [-0.3, 0.3],
            colors: ['#ff006e', '#fb5607', '#ffbe0b', '#00c2a8'] },
  pickup: { name: 'a pickup truck', len: 1.6,  h: 0.34, cab: [0.52, 0.82, 0.3], speed: 0.95, wheels: [-0.3, 0.3],
            colors: ['#e76f51', '#264653', '#6a994e', '#bc6c25'] },
  van:    { name: 'a van',          len: 1.7,  h: 0.62, cab: null,              speed: 0.92, wheels: [-0.32, 0.32],
            colors: ['#f4f1de', '#81b29a', '#e07a5f', '#3d405b'] },
  bus:    { name: 'a bus',          len: 2.8,  h: 0.78, cab: null,              speed: 0.8,  wheels: [-0.36, -0.2, 0.34],
            colors: ['#ffb703', '#e63946', '#219ebc'] },
  tanker: { name: 'a tanker truck', len: 2.7,  h: 0.66, cab: null,              speed: 0.85, wheels: [-0.4, -0.27, 0.12, 0.38],
            colors: ['#dfe3e8', '#c9ccd1', '#e8c547'] },
  police: { name: 'a police car',   len: 1.45, h: 0.28, cab: [0.25, 0.7, 0.28], speed: 1.25, wheels: [-0.3, 0.3],
            colors: ['#20242c'] },
};

const Vehicles = {
  directorT: 8,
  sirenT: 0,

  reset() {
    this.directorT = rand(6, 9);
    this.sirenT = 0;
  },

  // Spawn weights per lane; faster, bigger and more dangerous vehicles show up as it gets harder.
  weightsFor(d) {
    return [
      ['small', 3], ['sedan', 3], ['pickup', 1.8], ['van', 1.4],
      ['sports', d > 0.08 ? 0.5 + d * 1.5 : 0],
      ['bus', d > 0.2 ? 0.4 + d * 1.2 : 0.15],
      ['tanker', d > 0.2 ? 0.2 + d * 0.5 : 0],
    ].filter(e => e[1] > 0);
  },

  make(L, type, y) {
    const T = VEHICLE_TYPES[type];
    const base = pick(T.colors);
    const desired = L.speed * T.speed * rand(0.93, 1.07);
    return {
      kind: 'vehicle', type, len: T.len * TILE, x: 0, y, dir: L.dir,
      speed: desired, desired, base, pal: Draw.vehiclePalette(base),
      wreck: false, bounced: false, reckless: false, police: type === 'police', stalled: false, dead: false,
      rot: 0, rotV: 0, slide: 0, wreckT: 0, alpha: 1,
      side: 0, horned: false, bumped: false, fireAcc: 0, smokeAcc: 0,
      z: 0, vz: 0, flipV: 0, settle: null, gore: false, secondary: 0,
      bloody: false, bloodT: 0, trackAcc: 0, abducted: 0,
    };
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
      if (v.wreck) continue;
      v.dir = L.dir;
      v.speed *= 0.4;
      v.reckless = false;
      if (Renderer.inViewX(v.x)) FX.dust(v.x, v.y, 4);
    }
  },

  update(dt, fz) {
    let siren = null;
    for (const row of World.rows.values()) {
      if (row.type !== 'road') continue;
      if (!!row.lane.reversed !== Events.reverse) this.flipLane(row.lane);
      const s = this.updateLane(row, dt, fz);
      if (s !== null && siren === null) siren = s;
    }
    this.sirenT -= dt;
    if (siren !== null && this.sirenT <= 0 && Game.state !== 'gameover') {
      this.sirenT = 0.9;
      Sound.siren(this.pan(siren));
    }
  },

  pan(x) { return clamp((x - Cam.x) / (6 * TILE), -1, 1) * 0.7; },

  // Lane coordinate u = x * dir always increases in the direction of travel.
  // Returns the x of a visible police car (for the siren), or null.
  updateLane(row, dt, fz) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (vs.length > 1) vs.sort((a, b) => (b.x - a.x) * dir); // front-most first
    const playing = Game.state === 'playing';
    const nearPlayer = playing && Math.abs(row.i - Player.row) <= 1;
    const rain = Game.weather.type === 'rain' ? Game.weather.amt : 0;
    const lfz = fz * (row.flood ? 0.45 : 1);
    const brake = lerp(750, 330, rain);
    const rec = Game.leftCell;
    let siren = null;

    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (v.wreck) { this.updateWreck(v, dt, lfz); continue; }
      if (v.abducted) continue; // held by the UFO beam
      const lead = i > 0 ? vs[i - 1] : null;
      let target = v.desired;

      if (lead) {
        const gap = (lead.x * dir - lead.len / 2) - (v.x * dir + v.len / 2);
        if (v.reckless) {
          if (gap <= 0) { this.crash(row, v, lead); continue; } // reckless drivers never brake
        } else {
          const leadV = lead.wreck ? 0 : lead.speed;
          const stop = 0.9 * TILE;
          if (gap < stop + v.speed * 0.5) target = Math.min(target, leadV + Math.max(0, gap - stop) * 1.6);
        }
      }

      const braking = target < v.speed - 50;
      v.speed = approach(v.speed, target, (target > v.speed ? 180 : brake) * dt);
      v.x += dir * v.speed * lfz * dt;

      if (lead && !v.reckless) { // careful drivers never overlap the car ahead...
        const maxU = lead.x * dir - lead.len / 2 - 4 - v.len / 2;
        if (v.x * dir > maxU) {
          const closing = v.speed - (lead.wreck ? 0 : lead.speed);
          // ...unless the road is wet and they were going too fast to stop
          if (rain > 0.5 && closing > 110 && Game.skidCooldown <= 0 && Renderer.inViewX(v.x) && (playing || Game.state === 'title')) {
            Game.skidCooldown = rand(7, 12);
            FX.text(v.x, v.y + 10, 'SKID!', '#e0f0ff', 16);
            this.crash(row, v, lead);
            continue;
          }
          v.x = maxU * dir;
          v.speed = Math.min(v.speed, lead.wreck ? 0 : lead.speed);
        }
      }

      if (rain > 0.3 && braking && v.speed > 90 && Math.random() < dt * 22) {
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
      if (v.police && siren === null && Renderer.inViewX(v.x) && Math.abs(row.y - Player.y) < 12 * TILE) siren = v.x;

      // close call: a car tore through the cell the player just hopped out of
      if (rec && !rec.used && rec.row === row.i && Game.time - rec.t < 0.45 && v.speed * lfz > 80 &&
          Math.abs(v.x - cellX(rec.col)) < v.len / 2 + 0.1 * TILE) {
        rec.used = true;
        Game.nearMiss(1);
      }

      if (nearPlayer) { // whoosh as a car passes the player
        const side = v.x < Player.x ? -1 : 1;
        if (v.side && side !== v.side && v.speed * lfz > 60) {
          Sound.whoosh(clamp(v.speed / 300, 0.3, 1) * (row.i === Player.row ? 1 : 0.6), this.pan(v.x));
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
          FX.sparks(v.x, v.y, 4, 16, ['#fff3b0', '#ffd166', '#ffffff'], 280);
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

    if (!v.bounced) {
      const top = 4 + VEHICLE_TYPES[v.type].h * TILE + v.z;
      if (v.wreckT < (v.gore ? 7 : 3.2)) {
        v.fireAcc += dt * (v.gore ? 40 : 26);
        for (; v.fireAcc > 1; v.fireAcc--) FX.wreckFire(v.x + rand(-0.3, 0.3) * v.len, v.y, top);
      }
      if (v.wreckT < (v.gore ? 10 : 6)) {
        v.smokeAcc += dt * (v.gore ? 12 : 9);
        for (; v.smokeAcc > 1; v.smokeAcc--) FX.wreckSmoke(v.x + rand(-0.25, 0.25) * v.len, v.y, top + 6, v.gore);
      }
    }
    const life = v.bounced ? 3.5 : v.gore ? 11 : 7;
    if (v.wreckT > life - 1) v.alpha = clamp(life - v.wreckT, 0, 1);
    if (v.wreckT > life) v.dead = true;
  },

  trySpawn(row) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (!L.nextType) L.nextType = weighted(L.weights);
    const len = VEHICLE_TYPES[L.nextType].len * TILE;
    const uStart = L.xStart * dir;
    let rear = null;
    for (const v of vs) if (!rear || v.x * dir < rear.x * dir) rear = v;
    if (rear && (rear.x * dir - rear.len / 2) - (uStart + len / 2) < L.nextGap) return;
    const v = this.make(L, L.nextType, row.y);
    v.x = uStart * dir;
    if (rear && !rear.wreck) v.speed = Math.min(v.speed, rear.speed + 20);
    vs.push(v);
    L.nextType = null;
    L.nextGap = this.randGap(L);
  },

  // A stopped (or frozen) vehicle, stalled car or stopped train in this cell blocks movement into it.
  blocksCell(col, rowI) {
    const row = World.rows.get(rowI);
    if (!row) return false;
    const cx = cellX(col), fz = Game.trafficFactor();
    if (row.type === 'rail') return Rail.blocks(row, cx, fz);
    if (row.type !== 'road') return false;
    for (const v of row.lane.vehicles) {
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
    v.alpha = 1;
    v.gore = Settings.gore;
    v.pal = Draw.wreckPalette(v.base);
    v.settle = null;
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
        this.toss(v, x, 1.2);
        n++;
      }
    }
    return n;
  },

  // Something big (meteor, giant, goose, laser) destroys a car outright.
  smash(v, fromX, power = 1) {
    this.toss(v, fromX, power);
    if (Settings.gore) FX.carCrashViolent(v.x, v.y, [v.base, '#2a2a2e']);
    else FX.carCrash(v.x, v.y, [v.base, '#2a2a2e']);
    Game.onCrash(v.x, v.y, Settings.gore, 0.8);
  },

  // Rear-end collision: both cars become burning wrecks.
  crash(row, a, b) {
    const dir = row.lane.dir;
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
    const d = difficulty(Player.maxRow);
    const cands = [];
    const lenR = VEHICLE_TYPES.sports.len * TILE;
    for (let r = playerRow - 2; r <= playerRow + 7; r++) {
      if (r === playerRow) continue;
      const row = World.rows.get(r);
      if (!row || row.type !== 'road' || row.flood) continue;
      const L = row.lane, vs = L.vehicles, dir = L.dir;
      if (!vs.length || vs.some(v => v.wreck || v.reckless)) continue;
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
    this.directorT = rand(12, 20) - 4 * d;
  },
};
