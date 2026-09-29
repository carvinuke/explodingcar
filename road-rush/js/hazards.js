'use strict';
// Hazards beyond roads.
//
// Rivers: rows of water with logs drifting across. Stand on a log to ride it;
// land in the water, or ride a log off the edge, and you're done.

const River = {
  ids: 0,

  makeLog(R, y) {
    return { kind: 'log', id: ++this.ids, len: rand(R.lenMin, R.lenMax), x: 0, y, bob: rand(6.28), dir: R.dir };
  },

  randGap(R) { return rand(R.gapMin, R.gapMax); },

  populate(row) {
    const R = row.river, dir = R.dir;
    const uStart = R.xStart * dir, uEnd = R.xEnd * dir;
    let front = uEnd - rand(0, 2 * TILE);
    for (;;) {
      const log = this.makeLog(R, row.y);
      const center = front - log.len / 2;
      if (center - log.len / 2 < uStart) break;
      log.x = center * dir;
      R.logs.push(log);
      front = center - log.len / 2 - this.randGap(R);
    }
    R.nextGap = this.randGap(R);
  },

  update(dt, fz) {
    for (const row of World.rows.values()) {
      if (row.type !== 'river') continue;
      const R = row.river, dir = R.dir, logs = R.logs;
      const dx = dir * R.speed * fz * dt;
      for (const l of logs) { l.x += dx; l.bob += dt * 2; }
      const uEnd = R.xEnd * dir;
      for (let i = logs.length - 1; i >= 0; i--) if (logs[i].x * dir - logs[i].len / 2 > uEnd) logs.splice(i, 1);
      // spawn behind the rear-most log once the gap has opened up
      const uStart = R.xStart * dir;
      let rear = null;
      for (const l of logs) if (!rear || l.x * dir < rear.x * dir) rear = l;
      const next = this.makeLog(R, row.y);
      if (!rear || (rear.x * dir - rear.len / 2) - (uStart + next.len / 2) >= R.nextGap) {
        next.x = uStart * dir;
        logs.push(next);
        R.nextGap = this.randGap(R);
      }
    }
  },

  // The log under world x, if any (the player's centre must be on it).
  logAt(row, x) {
    for (const l of row.river.logs) if (Math.abs(l.x - x) <= l.len / 2 - 2) return l;
    return null;
  },
};

// Railroads: crossing signals flash and a bell rings, then a fast train roars
// through. Sometimes a car has stalled on the tracks.
const Rail = {
  makeStalled(row) {
    const type = Gen.pick(['sedan', 'van', 'pickup', 'small']);
    const v = Vehicles.make({ speed: 0, dir: Gen.chance(0.5) ? 1 : -1 }, type, row.y);
    v.speed = v.desired = 0;
    v.stalled = true;
    v.x = cellX(Gen.int(1, COLS - 2));
    return v;
  },

  update(dt, fz) {
    for (const row of World.rows.values()) if (row.type === 'rail') this.updateRow(row, dt, fz);
  },

  visible(row) { return row.y > Renderer.yBot - TILE && row.y < Renderer.yTop; },

  updateRow(row, dt, fz) {
    const R = row.rail, d = difficulty(row.i);
    for (const w of R.wrecks) {
      Vehicles.updateWreck(w, dt, fz);
      w.y += (w.vy || 0) * dt;
      w.vy = (w.vy || 0) * Math.exp(-1.8 * dt);
    }
    if (R.wrecks.length) R.wrecks = R.wrecks.filter(w => !w.dead);

    if (R.state === 'idle') {
      R.t -= dt;
      if (R.t <= 0) { R.state = 'warn'; R.t = 2.3; R.bell = 0; }
      return;
    }

    // bell while the signals flash
    R.bell -= dt;
    if (R.bell <= 0) {
      R.bell = 0.42;
      if (this.visible(row) && Game.state !== 'gameover') {
        const near = clamp(1 - Math.abs(row.y - Player.y) / (10 * TILE), 0.15, 1);
        Sound.bell(0.6 * near);
      }
    }

    if (R.state === 'warn') {
      R.t -= dt;
      if (R.t <= 0) this.startTrain(row, d);
      return;
    }

    // train rolling through
    R.x += R.dir * R.speed * fz * dt;
    if (!R.horned && this.visible(row) && R.x > Renderer.x0 - 8 * TILE && R.x < Renderer.x1 + 8 * TILE) {
      R.horned = true;
      Sound.trainHorn(Vehicles.pan(R.x), clamp(1 - Math.abs(row.y - Player.y) / (12 * TILE), 0.2, 1));
    }
    if (R.stalled) {
      const s = R.stalled;
      const reached = R.dir > 0 ? R.x >= s.x - s.len / 2 : R.x <= s.x + s.len / 2;
      if (reached) this.hitStalled(row);
    }
    // near miss: the player stepped off these tracks just before the train came through
    const rec = Game.leftCell;
    if (rec && !rec.used && rec.row === row.i && Game.time - rec.t < 0.9) {
      const [a, b] = this.extent(R);
      const cx = cellX(rec.col);
      if (cx > a && cx < b) { rec.used = true; Game.nearMiss(2); }
    }
    const rear = R.x - R.dir * R.len;
    const xEnd = R.dir > 0 ? WORLD_W + World.laneMargin + TILE : -World.laneMargin - TILE;
    if ((R.dir > 0 && rear > xEnd) || (R.dir < 0 && rear < xEnd)) {
      R.state = 'idle';
      R.t = rand(8, 16) - 3 * d; // trains are an occasional scare, not a conveyor belt
      R.cars = null;
      R.horned = false;
    }
  },

  startTrain(row, d) {
    const R = row.rail;
    R.state = 'train';
    R.speed = (820 + 300 * d) * rand(0.9, 1.1);
    const cars = [{ type: 'loco', len: 2.5 * TILE, color: pick(['#c8102e', '#1d4f91', '#2f6f4f', '#e0a100']) }];
    for (let n = randInt(3, 6 + Math.round(d * 3)); n > 0; n--) {
      cars.push({ type: pick(['box', 'box', 'tank', 'hopper']), len: 2.1 * TILE, color: pick(['#8b3a2b', '#5d6b73', '#2d4b6b', '#7a6a3a', '#3f5f4a']) });
    }
    let off = 0;
    for (const c of cars) {
      c.kind = 'traincar';
      c.off = off + c.len / 2;
      c.dir = R.dir;
      c.y = row.y;
      c.rail = R;
      off += c.len + 0.22 * TILE;
    }
    R.len = off;
    R.cars = cars;
    R.x = R.dir > 0 ? -(World.laneMargin + TILE) : WORLD_W + World.laneMargin + TILE;
  },

  // [left, right] world x covered by the train
  extent(R) {
    const a = R.x, b = R.x - R.dir * R.len;
    return [Math.min(a, b), Math.max(a, b)];
  },

  // The train ploughs through a car stalled on the tracks.
  hitStalled(row) {
    const R = row.rail, v = R.stalled;
    R.stalled = null;
    const gore = Settings.gore;
    v.stalled = false;
    v.wreck = true;
    v.wreckT = 0;
    v.gore = gore;
    v.pal = Draw.wreckPalette(v.base);
    v.slide = R.dir * R.speed * 0.9;
    v.vz = rand(430, 560);
    v.flipV = R.dir * rand(9, 14);
    v.vy = -rand(55, 95);
    v.settle = null;
    v.secondary = gore ? 0.45 : 0;
    R.wrecks.push(v);
    const x = v.x - R.dir * v.len / 2;
    FX.trainCrash(x, row.y, [v.base, R.cars ? R.cars[0].color : '#555'], gore);
    Game.onCrash(x, row.y, true, 1.6);
  },

  // Is a (stopped/frozen) train or a stalled car occupying this cell?
  blocks(row, cx, fz) {
    const R = row.rail;
    if (R.stalled && Math.abs(R.stalled.x - cx) < R.stalled.len / 2 + 0.2 * TILE) return true;
    if (R.state === 'train' && R.speed * fz < 25) {
      const [a, b] = this.extent(R);
      if (cx > a - 0.2 * TILE && cx < b + 0.2 * TILE) return true;
    }
    return false;
  },
};
