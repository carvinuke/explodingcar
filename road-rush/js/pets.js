'use strict';
// Pets: a little companion that follows player one around. Each has a trick:
// - Duckling: +25% XP every run
// - Dog: runs off to fetch coins near you
// - Cat: nine lives, blocks one hit per run
// - Mini Big J: glares at seagulls so they won't steal from you
// - Drone: hovers overhead, lights up the night and pulls in nearby coins

const Pets = {
  pet: null,

  reset() {
    const type = Shop.pet;
    if (!type) { this.pet = null; return; }
    this.pet = {
      kind: 'pet', type, x: Player.x - 0.7 * TILE, y: Player.y - 0.6 * TILE, z: 0,
      hopT: 0, face: 1, fetch: null, catUsed: false, ph: rand(6), blink: rand(3),
    };
  },

  has(type) { return !!(this.pet && this.pet.type === type) && Game.players.length === 1; },

  update(dt) {
    const pet = this.pet;
    if (!pet) return;
    const p = Player;
    pet.ph += dt;
    const flying = pet.type === 'drone';
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
    if (flying) pet.z = 34 + Math.sin(pet.ph * 3) * 4;
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

  drawables(list) {
    const pet = this.pet;
    if (!pet || Game.state === 'title' || Game.players.length > 1) return;
    pet.key = pet.y - 9;
    list.push(pet);
  },
};
