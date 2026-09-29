'use strict';
// Vehicles: types, spawning, lane traffic (following / braking),
// vehicle-vs-vehicle crashes and the "crash director" that occasionally
// sends a reckless driver into traffic near the player.

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
};

const Vehicles = {
  directorT: 8,

  reset() { this.directorT = rand(6, 9); },

  // Spawn weights per lane; faster and bigger vehicles show up as it gets harder.
  weightsFor(d) {
    return [
      ['small', 3], ['sedan', 3], ['pickup', 1.8], ['van', 1.4],
      ['sports', d > 0.08 ? 0.5 + d * 1.5 : 0],
      ['bus', d > 0.2 ? 0.4 + d * 1.2 : 0.15],
    ].filter(e => e[1] > 0);
  },

  make(L, type, y) {
    const T = VEHICLE_TYPES[type];
    const base = pick(T.colors);
    const desired = L.speed * T.speed * rand(0.93, 1.07);
    return {
      kind: 'vehicle', type, len: T.len * TILE, x: 0, y, dir: L.dir,
      speed: desired, desired, base, pal: Draw.vehiclePalette(base),
      wreck: false, bounced: false, reckless: false, dead: false,
      rot: 0, rotV: 0, slide: 0, wreckT: 0, alpha: 1,
      side: 0, horned: false, bumped: false, fireAcc: 0, smokeAcc: 0,
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

  update(dt, fz) {
    for (const row of World.rows.values()) if (row.type === 'road') this.updateLane(row, dt, fz);
  },

  pan(x) { return clamp((x - Cam.x) / (6 * TILE), -1, 1) * 0.7; },

  // Lane coordinate u = x * dir always increases in the direction of travel.
  updateLane(row, dt, fz) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (vs.length > 1) vs.sort((a, b) => (b.x - a.x) * dir); // front-most first
    const nearPlayer = Game.state === 'playing' && Math.abs(row.i - Player.row) <= 1;

    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (v.wreck) { this.updateWreck(v, dt, fz); continue; }
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

      v.speed = approach(v.speed, target, (target > v.speed ? 180 : 750) * dt);
      v.x += dir * v.speed * fz * dt;

      if (lead && !v.reckless) { // careful drivers never overlap the car ahead
        const maxU = lead.x * dir - lead.len / 2 - 4 - v.len / 2;
        if (v.x * dir > maxU) {
          v.x = maxU * dir;
          v.speed = Math.min(v.speed, lead.wreck ? 0 : lead.speed);
        }
      }

      if (v.reckless && !v.horned && Renderer.inViewX(v.x)) {
        v.horned = true;
        Sound.horn(this.pan(v.x));
      }

      if (nearPlayer) { // whoosh as a car passes the player
        const side = v.x < Player.x ? -1 : 1;
        if (v.side && side !== v.side && v.speed * fz > 60) {
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
  },

  updateWreck(v, dt, fz) {
    v.wreckT += dt;
    v.x += v.slide * fz * dt;
    v.slide *= Math.exp(-2.6 * dt);
    v.rot += v.rotV * fz * dt;
    v.rotV *= Math.exp(-3.5 * dt);
    if (!v.bounced) {
      const top = 4 + VEHICLE_TYPES[v.type].h * TILE;
      if (v.wreckT < 3.2) {
        v.fireAcc += dt * 26;
        for (; v.fireAcc > 1; v.fireAcc--) FX.wreckFire(v.x + rand(-0.3, 0.3) * v.len, v.y, top);
      }
      if (v.wreckT < 6) {
        v.smokeAcc += dt * 9;
        for (; v.smokeAcc > 1; v.smokeAcc--) FX.wreckSmoke(v.x + rand(-0.25, 0.25) * v.len, v.y, top + 6);
      }
    }
    const life = v.bounced ? 3.5 : 7;
    if (v.wreckT > life - 1) v.alpha = clamp(life - v.wreckT, 0, 1);
    if (v.wreckT > life) v.dead = true;
  },

  trySpawn(row) {
    const L = row.lane, vs = L.vehicles, dir = L.dir;
    if (!L.nextType) L.nextType = weighted(L.weights);
    const len = VEHICLE_TYPES[L.nextType].len * TILE;
    const uStart = L.xStart * dir;
    const rear = vs.length ? vs[vs.length - 1] : null;
    if (rear && (rear.x * dir - rear.len / 2) - (uStart + len / 2) < L.nextGap) return;
    const v = this.make(L, L.nextType, row.y);
    v.x = uStart * dir;
    if (rear && !rear.wreck) v.speed = Math.min(v.speed, rear.speed + 20);
    vs.push(v);
    L.nextType = null;
    L.nextGap = this.randGap(L);
  },

  // A stopped (or frozen) vehicle occupying this cell blocks movement into it.
  blocksCell(col, rowI) {
    const row = World.rows.get(rowI);
    if (!row || row.type !== 'road') return false;
    const cx = cellX(col), fz = Powers.traffic;
    for (const v of row.lane.vehicles) {
      const moving = (v.wreck ? Math.abs(v.slide) : v.speed) * fz;
      if (moving >= 25) continue;
      if (Math.abs(v.x - cx) < v.len / 2 + 0.2 * TILE) return true;
    }
    return false;
  },

  // Rear-end collision: both cars become burning wrecks.
  crash(row, a, b) {
    const dir = row.lane.dir;
    const cx = (((a.x * dir + a.len / 2) + (b.x * dir - b.len / 2)) / 2) * dir;
    const bSpeed = b.wreck ? 0 : b.speed;
    const rel = Math.max(90, a.speed - bSpeed);
    for (const v of [a, b]) {
      v.wreck = true;
      v.wreckT = 0;
      v.bounced = false;
      v.reckless = false;
      v.alpha = 1;
      v.pal = Draw.wreckPalette(v.base);
    }
    b.slide = dir * (bSpeed + rel * 0.55);
    a.slide = dir * a.speed * 0.12;
    const s = chance(0.5) ? 1 : -1;
    a.rotV = s * rand(1.3, 2.2);
    b.rotV = -s * rand(1.1, 2.0);
    a.speed = b.speed = 0;
    a.x -= dir * 4;
    b.x += dir * 4;
    FX.carCrash(cx, row.y, [a.base, b.base]);
    Game.onCrash(cx, row.y);
  },

  // Shield hit: the car is knocked back and spins out.
  bounce(v, row) {
    const dir = row.lane.dir;
    v.wreck = true;
    v.bounced = true;
    v.wreckT = 0;
    v.reckless = false;
    v.slide = -dir * Math.max(140, v.speed * 0.7);
    v.rotV = (chance(0.5) ? 1 : -1) * rand(2.5, 4);
    v.speed = 0;
    FX.sparks(v.x - dir * v.len / 2, v.y, 12, 18, ['#ffffff', '#bfe3ff', '#ffd166'], 280);
  },

  // Every so often, send a speeding driver into a lane near the player, timed
  // so it rear-ends the last car in that lane while on screen.
  director(dt, playerRow) {
    this.directorT -= dt;
    if (this.directorT > 0) return;
    const d = difficulty(Player.maxRow);
    const cands = [];
    const lenR = VEHICLE_TYPES.sports.len * TILE;
    for (let r = playerRow - 2; r <= playerRow + 7; r++) {
      if (r === playerRow) continue;
      const row = World.rows.get(r);
      if (!row || row.type !== 'road') continue;
      const L = row.lane, vs = L.vehicles, dir = L.dir;
      if (!vs.length || vs.some(v => v.wreck || v.reckless)) continue;
      const t = vs[vs.length - 1];                   // rear-most car = target
      const uT = t.x * dir;
      const uc = rand(0.25, 0.75) * WORLD_W * dir;   // where we want the crash
      const tt = (uc - uT) / Math.max(40, t.speed);  // time for target to get there
      if (tt < 1.4 || tt > 6.5) continue;
      const gapNow = (uT - t.len / 2) - (L.xStart * dir + lenR / 2);
      if (gapNow < 3 * TILE) continue;
      const vR = t.speed + gapNow / tt;
      if (vR > 640) continue;
      cands.push([{ row, vR }, 1 / (1 + Math.abs(r - playerRow - 1))]);
    }
    if (!cands.length) { this.directorT = 0.6; return; }
    const { row, vR } = weighted(cands);
    const L = row.lane;
    const v = this.make(L, 'sports', row.y);
    v.reckless = true;
    v.desired = v.speed = vR;
    v.x = L.xStart;
    v.base = '#ff2e4d';
    v.pal = Draw.vehiclePalette(v.base);
    L.vehicles.push(v);
    this.directorT = rand(12, 20) - 4 * d;
  },
};
