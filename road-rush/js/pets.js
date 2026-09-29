'use strict';
// Pets: a little companion that follows player one around. Each has a trick:
// - Duckling: +25% XP every run
// - Dog: runs off to fetch coins near you
// - Cat: nine lives, blocks one hit per run
// - Mini Big J: glares at seagulls so they won't steal from you
// - Drone: hovers overhead, lights up the night and pulls in nearby coins
// - Pigeon: drops a coin near you every few seconds
// - Parrot: squawks a warning before trains and reckless drivers arrive
// - Turtle: surfaces under you if you fall in the water, then needs a rest
// - Mini Tornado: vacuums up every coin nearby

const Pets = {
  pet: null,

  reset() {
    const type = Shop.pet;
    if (!type) { this.pet = null; return; }
    this.pet = {
      kind: 'pet', type, x: Player.x - 0.7 * TILE, y: Player.y - 0.6 * TILE, z: 0,
      hopT: 0, face: 1, fetch: null, catUsed: false, ph: rand(6), blink: rand(3),
      dropT: rand(4, 7), turtleT: 0, warned: new Set(),
    };
  },

  has(type) { return !!(this.pet && this.pet.type === type) && Game.players.length === 1; },

  update(dt) {
    const pet = this.pet;
    if (!pet) return;
    const p = Player;
    pet.ph += dt;
    const flying = pet.type === 'drone' || pet.type === 'pigeon' || pet.type === 'parrot' || pet.type === 'twister';
    const active = Game.state === 'playing' && p.alive;
    if (pet.turtleT > 0) pet.turtleT -= dt;
    // the pigeon drops coins
    if (pet.type === 'pigeon' && active) {
      pet.dropT -= dt;
      if (pet.dropT <= 0) {
        pet.dropT = rand(5, 8);
        const r = p.row + randInt(1, 3), R = World.rows.get(r);
        if (R && R.type !== 'river') {
          const free = [];
          for (let c = 0; c < COLS; c++) if (!World.isBlocked(c, r) && !(R.type === 'work' && R.pit[c]) && Math.abs(c - p.col) <= 3) free.push(c);
          if (free.length) {
            const c = pick(free);
            Items.add('coin', c, r);
            FX.text(pet.x, pet.y + 30, 'COO!', '#e6e6ee', 12);
          }
        }
      }
    }
    // the parrot warns you
    if (pet.type === 'parrot' && active) {
      for (let r = p.row + 1; r <= p.row + 5; r++) {
        const R = World.rows.get(r);
        if (!R) continue;
        if (R.type === 'rail' && R.rail.state === 'warn' && !pet.warned.has(R)) {
          pet.warned.add(R);
          FX.text(pet.x, pet.y + 40, R.rail.tram ? 'SQUAWK! TRAM!' : 'SQUAWK! TRAIN!', '#ff6b6b', 15);
          Sound.squawk();
        } else if (R.type === 'rail' && R.rail.state === 'idle') pet.warned.delete(R);
        if (R.type === 'road') {
          for (const v of R.lane.vehicles) {
            if (!v.reckless || v.parrotWarned) continue;
            v.parrotWarned = true;
            FX.text(pet.x, pet.y + 40, 'SQUAWK! SPEEDER!', '#ffd23f', 15);
            Sound.squawk();
          }
        }
      }
    }
    // the mini tornado vacuums coins
    if (pet.type === 'twister' && active) {
      for (const it of Items.list) {
        if (it.type !== 'coin') continue;
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < 4.2 * TILE && d > 1) { const s = Math.min(d, 330 * dt); it.x += (dx / d) * s; it.y += (dy / d) * s; }
      }
      if (Math.random() < dt * 20) FX.spawn('dust', pet.x + rand(-6, 6), pet.y, 2, { vx: rand(-30, 30), vz: rand(20, 50), g: -10, drag: 1.5, life: 0.5, size: 2, size2: 6, color: '#b7ae9e', alpha: 0.5 });
    }
    // where to be: a little behind and beside the player
    let tx = p.x - (p.facing === 'left' ? -1 : 1) * 0.65 * TILE, ty = p.y - 0.55 * TILE;
    let speed = 7;
    // the dog fetches coins
    if (pet.type === 'dog' && Game.state === 'playing' && p.alive) {
      if (pet.fetch && !Items.list.includes(pet.fetch)) pet.fetch = null;
      if (!pet.fetch) {
        let best = null, bd = 3.2 * TILE;
        for (const it of Items.list) {
          if (it.type !== 'coin' || it.gull) continue;
          const d = Math.hypot(it.x - p.x, it.y - p.y);
          if (d < bd) { bd = d; best = it; }
        }
        pet.fetch = best;
      }
      if (pet.fetch) {
        tx = pet.fetch.x;
        ty = pet.fetch.y;
        speed = 11;
        if (Math.hypot(pet.fetch.x - pet.x, pet.fetch.y - pet.y) < 0.35 * TILE) {
          const it = pet.fetch;
          Items.list.splice(Items.list.indexOf(it), 1);
          pet.fetch = null;
          Game.addCoin(it, p);
          FX.text(pet.x, pet.y + 18, 'WOOF!', '#ffe9b0', 12);
        }
      }
    }
    // the drone pulls in coins like a small magnet
    if (pet.type === 'drone' && Game.state === 'playing' && p.alive) {
      for (const it of Items.list) {
        if (it.type !== 'coin') continue;
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < 2.2 * TILE && d > 1) { const s = Math.min(d, 200 * dt); it.x += (dx / d) * s; it.y += (dy / d) * s; }
      }
    }
    const dx = tx - pet.x, dy = ty - pet.y, dist = Math.hypot(dx, dy);
    if (dist > 12 * TILE) { pet.x = tx; pet.y = ty; } // left far behind: catch up instantly
    pet.x = damp(pet.x, tx, speed, dt);
    pet.y = damp(pet.y, ty, speed, dt);
    if (Math.abs(dx) > 2) pet.face = sign(dx);
    // little hops while moving (the drone just bobs)
    if (pet.type === 'twister') pet.z = 0;
    else if (flying) pet.z = (pet.type === 'drone' ? 34 : 28) + Math.sin(pet.ph * (pet.type === 'drone' ? 3 : 7)) * 4;
    else {
      if (dist > 6 && pet.hopT <= 0) pet.hopT = 0.22;
      if (pet.hopT > 0) {
        pet.hopT = Math.max(0, pet.hopT - dt);
        pet.z = Math.sin(Math.PI * (1 - pet.hopT / 0.22)) * 7;
      } else pet.z = 0;
    }
  },

  // Cat: nine lives. Returns true if the cat took the hit instead.
  saves(p, source) {
    if (p.id !== 0 || !this.has('cat') || this.pet.catUsed) return false;
    if (source === 'danger' || source === 'drown' || source === 'swept' || source === 'pit') return false;
    this.pet.catUsed = true;
    p.grace = 1.6;
    FX.shieldBreak(p.x, p.y);
    FX.text(p.x, p.y + 30, 'NINE LIVES!', '#ffd6a0', 18);
    Sound.shieldBreak();
    Cam.addTrauma(0.4);
    return true;
  },

  // Turtle: pops up under you in the water. Returns a floating platform (or null).
  turtleCatch(p, row) {
    const pet = this.pet;
    if (p.id !== 0 || !this.has('turtle') || pet.turtleT > 0) return null;
    pet.turtleT = 12;
    const shell = { kind: 'log', id: ++River.ids, len: 0.95 * TILE, x: p.x, y: row.y, bob: 0, dir: row.river.dir, style: 'turtle' };
    row.river.logs.push(shell);
    FX.text(p.x, p.y + 30, 'TURTLE SAVE!', '#7ed957', 16);
    FX.splash(p.x, p.y, 10);
    return shell;
  },

  drawables(list) {
    const pet = this.pet;
    if (!pet || Game.state === 'title' || Game.players.length > 1) return;
    pet.key = pet.y - 9;
    list.push(pet);
  },
};
