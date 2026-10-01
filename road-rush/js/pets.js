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
// Hatched from eggs only (see specials.js):
// - Phoenix Chick: once per run, brings you back from any death in a burst of fire
// - Baby Dragon: breathes fire on cars that are about to hit you
// - Unicorn: rainbow steps let you walk on water; coins are worth double
// - Golden Goose: lays golden eggs worth 10 coins; double XP
// - Time Owl: slower traffic, and bullet time when a car is about to hit you

const Pets = {
  pet: null,

  reset() {
    const type = Shop.pet;
    if (!type) { this.pet = null; return; }
    this.pet = {
      kind: 'pet', type, x: Player.x - 0.7 * TILE, y: Player.y - 0.6 * TILE, z: 0,
      hopT: 0, face: 1, fetch: null, catUsed: false, ph: rand(6), blink: rand(3),
      dropT: rand(4, 7), turtleT: 0, warned: new Set(),
      reborn: false, fireT: 0, breath: 0, flame: null, layT: rand(5, 7), owlT: 0,
      golemT: 0, fairyT: 25, frostT: 30, ready: true,
    };
  },

  // A pet's passive perk from its PETS entry (luck, xp, grip...), if one is out.
  perk(key) {
    if (!this.pet || Game.players.length > 1) return undefined;
    const d = PETS[this.pet.type];
    return d ? d[key] : undefined;
  },

  // A pet just hatched right here: start it at the egg, not somewhere behind you.
  pop(x, y) {
    this.reset();
    if (!this.pet) return;
    this.pet.x = x;
    this.pet.y = y;
    this.pet.z = 20;
  },

  has(type) { return !!(this.pet && this.pet.type === type) && Game.players.length === 1; },

  update(dt) {
    const pet = this.pet;
    if (!pet) return;
    const p = Player;
    pet.ph += dt;
    const flying = pet.type === 'twister' || !!(PETS[pet.type] && PETS[pet.type].fly);
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
    // the dragon torches cars that are about to hit you
    if (pet.type === 'dragon') this.dragon(pet, p, dt, active);
    // the golden goose lays golden eggs
    if (pet.type === 'goose' && active) {
      pet.layT -= dt;
      if (pet.layT <= 0) {
        pet.layT = rand(6, 9);
        const r = p.row + randInt(1, 2), R = World.rows.get(r);
        if (R && R.type !== 'river') {
          const free = [];
          for (let c = 0; c < COLS; c++) if (!World.isBlocked(c, r) && !(R.type === 'work' && R.pit[c]) && Math.abs(c - p.col) <= 2) free.push(c);
          if (free.length) {
            Items.add('goldegg', pick(free), r);
            FX.text(pet.x, pet.y + 30, 'HONK! A GOLDEN EGG!', '#ffd23f', 13);
            Sound.honk();
          }
        }
      }
      if (Math.random() < dt * 6) FX.spawn('glow', pet.x + rand(-8, 8), pet.y + rand(-4, 4), rand(4, 18), { vz: 20, life: 0.5, size: 2, size2: 0.4, color: '#ffe98a' });
    }
    // the owl slows time when a car is about to hit you
    if (pet.type === 'owl') {
      if (pet.owlT > 0) pet.owlT -= dt;
      else if (active && !p.hop && this.threat(p, 0.5)) {
        pet.owlT = 4;
        Game.slowmo(0.25, 0.75);
        FX.text(pet.x, pet.y + 36, 'HOO! LOOK OUT!', '#9fe7ff', 14);
        Sound.whoosh(0.6, 0);
      }
    }
    // the golem recharges its block
    if (pet.golemT > 0) pet.golemT -= dt;
    pet.ready = pet.golemT <= 0;
    // the fairy hands out power-ups
    if (pet.type === 'fairy' && active) {
      pet.fairyT -= dt;
      if (pet.fairyT <= 0) {
        pet.fairyT = 25;
        const types = Object.keys(POWERUPS);
        Powers.grant(pick(types), { x: p.x, y: p.y }, p);
        FX.text(pet.x, pet.y + 40, 'A GIFT!', '#ff9fe0', 14);
      }
    }
    // the frost fox freezes all traffic
    if (pet.type === 'frostfox' && active) {
      pet.frostT -= dt;
      if (pet.frostT <= 0) {
        pet.frostT = 30;
        Powers.freeze = Math.max(Powers.freeze, 3);
        FX.ice(p.x, p.y);
        Sound.freeze();
        FX.text(pet.x, pet.y + 36, 'FROST BREATH!', '#bfe8ff', 15);
      }
    }
    // the robo pup fetches power-ups from far away
    if (pet.type === 'robopup' && active) {
      for (const it of Items.list) {
        if (it.type === 'coin' || it.type === 'egg' || it.type === 'goldegg' || it.type === 'stand') continue;
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < 6 * TILE && d > 1) { const s = Math.min(d, 260 * dt); it.x += (dx / d) * s; it.y += (dy / d) * s; }
      }
    }
    // a gentle coin pull (goldfish)
    const mg = PETS[pet.type] && PETS[pet.type].magnet;
    if (mg && active) {
      for (const it of Items.list) {
        if (it.type !== 'coin') continue;
        const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
        if (d < mg * TILE && d > 1) { const s = Math.min(d, 120 * dt); it.x += (dx / d) * s; it.y += (dy / d) * s; }
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

  // The closest car in your own row heading at you and less than `secs` away.
  threat(p, secs) {
    const R = World.rows.get(p.row);
    if (!R || R.type !== 'road') return null;
    const fz = Game.trafficFactor();
    let best = null, bd = Infinity;
    for (const v of R.lane.vehicles) {
      if (v.wreck || v.animal || v.abducted || v.speed * fz < 25) continue;
      const gap = (p.x - v.x) * v.dir - v.len / 2; // distance from its front bumper to you
      if (gap < -0.2 * TILE || gap > v.speed * fz * secs + 0.3 * TILE) continue;
      if (gap < bd) { bd = gap; best = v; }
    }
    return best;
  },

  dragon(pet, p, dt, active) {
    if (pet.breath > 0) pet.breath -= dt;
    if (pet.fireT > 0) pet.fireT -= dt;
    const f = pet.flame;
    if (f) { // the stream of fire races to the car, then it goes up
      f.t += dt;
      const k = Math.min(1, f.t / 0.22), v = f.v;
      const hx = lerp(pet.x + pet.face * 12, v.x, k), hy = lerp(pet.y, v.y, k), hz = lerp(pet.z + 6, 14, k);
      for (let n = 0; n < 4; n++) FX.spawn('fire', hx + rand(-4, 4), hy + rand(-3, 3), hz + rand(-3, 3), { vx: rand(-30, 30), vz: rand(10, 50), g: -40, drag: 2, life: rand(0.2, 0.4), size: rand(6, 11), size2: 2 });
      if (k >= 1) {
        pet.flame = null;
        if (!v.wreck && !v.abducted) {
          Vehicles.toss(v, pet.x, 1.1);
          v.secondary = Settings.gore ? rand(0.3, 0.5) : 0;
          FX.carCrash(v.x, v.y, [v.base, '#2a2a2e']);
          Cam.addTrauma(0.3);
          FX.flashScreen(0.15, '255,150,60');
          Sound.explosion(0.5, Vehicles.pan(v.x));
          FX.text(v.x, v.y + 24, 'TORCHED!', '#ff7a1a', 18);
          Game.addBonus(40, p);
          if (Game.tracksProgress()) Stats.add('wrecks');
        }
      }
      return;
    }
    if (!active || pet.fireT > 0) return;
    // anything about to hit you (mid-hop, `row` is already the row you're landing in)
    const v = this.threat(p, 0.9);
    if (!v) return;
    pet.fireT = 2.2;
    pet.breath = 0.4;
    pet.face = sign(v.x - pet.x) || 1;
    pet.flame = { v, t: 0 };
    Sound.fire(Vehicles.pan(v.x));
    FX.text(pet.x, pet.y + 34, 'FWOOSH!', '#ff9a2a', 14);
  },

  // Unicorn (rainbow steps) or the Bubble power-up: wherever you land on water, something holds you up.
  waterWalk(p, row) {
    if (!p.alive) return null;
    if (p.pw.bubble > 0) return River.addStep(p, row, 'bubble');
    if (p.id !== 0 || !this.has('unicorn')) return null;
    for (let i = 0; i < 10; i++) FX.spawn('glow', p.x + rand(-14, 14), p.y + rand(-6, 6), rand(2, 10), { vz: rand(20, 60), life: 0.6, size: 2.5, size2: 0.4, color: `hsl(${rand(360)},100%,75%)` });
    return River.addStep(p, row, 'rainbow');
  },

  // Phoenix Chick: whatever killed you, you rise again (once per run).
  rebirth(p) {
    const pet = this.pet;
    pet.reborn = true;
    const ox = p.x, oy = p.y;
    // somewhere safe: the first grass row from here on, clear of the danger line
    const from = Math.max(p.row, Math.ceil(Game.danger.y / TILE) + 3);
    World.ensure(from + 16);
    let row = from;
    for (let r = from; r < from + 14; r++) {
      const R = World.rows.get(r);
      if (R && R.type === 'grass') { row = r; break; }
    }
    let col = clamp(p.col, 0, COLS - 1);
    for (let d = 0; d < COLS * 2 && World.isBlocked(col, row); d++) {
      const c2 = p.col + (d % 2 ? -(d + 1) / 2 : d / 2);
      if (c2 >= 0 && c2 < COLS && !World.isBlocked(c2, row)) col = c2;
    }
    p.hop = p.knock = p.queue = p.abduct = p.rag = null;
    p.ride = null;
    p.stun = p.sink = 0;
    p.z = p.rot = 0;
    p.flat = p.gone = false;
    p.col = col;
    p.row = row;
    p.x = cellX(col);
    p.y = row * TILE;
    p.grace = 2.5;
    p.squash = 1;
    if (row > p.maxRow) Game.onPlayerMove(p);
    pet.x = p.x;
    pet.y = p.y - 0.5 * TILE;
    // ashes where you fell, fire where you rise
    for (let i = 0; i < 16; i++) FX.spawn('smoke', ox + rand(-8, 8), oy + rand(-5, 5), rand(4, 16), { vz: rand(20, 60), g: -15, drag: 1, life: rand(1, 1.6), size: 4, size2: 14, color: '#4a4a50', alpha: 0.6 });
    for (let i = 0; i < 60; i++) {
      const a = rand(6.2832), sp = rand(40, 200);
      FX.spawn('fire', p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 4, rand(0, 30), { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rand(40, 220), g: -40, drag: 1.8, life: rand(0.4, 0.9), size: rand(8, 16), size2: 2 });
    }
    FX.spawn('glow', p.x, p.y, 20, { life: 0.5, size: 40, size2: 160, color: '#ffb040', alpha: 0.9 });
    const n = Vehicles.blastVehicles(p.x, p.y, 3.2 * TILE);
    FX.flashScreen(0.65, '255,150,40');
    Cam.addTrauma(0.6);
    Game.slowmo(0.3, 0.7);
    Sound.rebirth();
    FX.text(p.x, p.y + 44, 'REBORN FROM THE ASHES!', '#ffb040', 20);
    UI.toast('t-hatch', 'THE PHOENIX BROUGHT YOU BACK', n ? `and torched ${n} car${n > 1 ? 's' : ''} while it was at it` : 'Once per run. Make it count', 3600);
    Trophies.add('reborn');
  },

  // Cat: nine lives. Golem: a block every 20 seconds. Phoenix: rebirth.
  // Returns true if the pet saved you.
  saves(p, source) {
    if (p.id === 0 && this.has('phoenix') && !this.pet.reborn) { this.rebirth(p); return true; }
    const physical = !(source === 'danger' || source === 'drown' || source === 'swept' || source === 'pit');
    if (p.id === 0 && this.has('golem') && this.pet.golemT <= 0 && physical) {
      this.pet.golemT = 20;
      p.grace = 1.6;
      FX.shieldBreak(p.x, p.y);
      FX.text(p.x, p.y + 30, 'GOLEM BLOCK!', '#9fe7ff', 18);
      Sound.shieldBreak();
      Sound.stomp(0.6);
      Cam.addTrauma(0.4);
      return true;
    }
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
