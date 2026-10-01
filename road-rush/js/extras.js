'use strict';
// Death effects, footprints, mystery boxes and pet levels.

// ---- Death effects: played where you got hit (player one's equipped one) ----
const DeathFX = {
  ghosts: [], // spirits floating up
  holes: [],  // black holes swallowing what's left

  reset() { this.ghosts.length = 0; this.holes.length = 0; },

  play(p) {
    const id = p.id === 0 ? Shop.death : null;
    if (!id) return;
    const x = p.x, y = p.y, sk = p.skin();
    const burst = (part, colors, n, o = {}) => {
      for (let i = 0; i < n; i++) {
        const a = rand(6.2832), s = rand(60, 220) * (o.speed || 1);
        FX.spawn('glyph', x, y, o.z || 14, { part, color: pick(colors), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(80, 260) * (o.up || 1), g: o.g === undefined ? 500 : o.g, drag: o.drag || 1, bounce: o.bounce || 0, life: rand(0.9, 1.6), size: o.size || rand(4, 7), size2: o.size2, rotV: rand(-10, 10), alpha: o.alpha });
      }
    };
    switch (id) {
      case 'confetti':
        for (let i = 0; i < 70; i++) FX.spawn('confetti', x, y, 14, { vx: rand(-200, 200), vy: rand(-120, 120), vz: rand(150, 380), g: 520, drag: 1.4, life: rand(1.2, 2), size: rand(3, 6), color: pick(['#ff5c8a', '#ffd23f', '#34c6ea', '#7ed957', '#a95cff']), rotV: rand(-14, 14) });
        Sound.cash();
        break;
      case 'hearts':
        burst('heart', ['#ff5c8a', '#ff2d55', '#ff9fb8'], 24, { g: -40, drag: 1.6, up: 0.5, size: 7, size2: 3 });
        break;
      case 'pixels':
        burst('pixel', [sk.top, sk.front, '#ffffff', '#1d1d1f'], 40, { size: 4, speed: 1.2 });
        FX.text(x, y + 40, 'GAME OVER', '#ff5c8a', 20);
        break;
      case 'bubbles':
        for (let i = 0; i < 26; i++) FX.spawn('smoke', x + rand(-14, 14), y + rand(-8, 8), rand(6, 30), { vz: rand(30, 90), vx: rand(-20, 20), g: -10, drag: 0.8, life: rand(1, 1.8), size: rand(3, 5), size2: rand(6, 10), color: '#bfe8ff', alpha: 0.75 });
        Sound.bubble();
        break;
      case 'coins':
        burst('coin', ['#ffd23f', '#f0b400'], 30, { bounce: 0.45, g: 700, size: 7 });
        Sound.coin();
        break;
      case 'smoke':
        for (let i = 0; i < 30; i++) FX.spawn('smoke', x + rand(-10, 10), y + rand(-6, 6), rand(4, 26), { vx: rand(-60, 60), vy: rand(-30, 30), vz: rand(10, 50), g: -10, drag: 2, life: rand(0.9, 1.5), size: rand(6, 10), size2: rand(18, 26), color: pick(['#9a9aa2', '#b8b8c0', '#7d7d86']), alpha: 0.85 });
        p.gone = true; // vanished
        FX.text(x, y + 40, 'POOF', '#e8e8f0', 18);
        break;
      case 'ghost':
        this.ghosts.push({ kind: 'deathghost', x, y, z: 10, t: 0, sk });
        break;
      case 'stone': case 'golden': case 'ice':
        p.statue = id;
        if (id === 'ice') FX.ice(x, y);
        if (id === 'golden') for (let i = 0; i < 20; i++) FX.spawn('glow', x + rand(-14, 14), y + rand(-8, 8), rand(6, 30), { vz: 30, life: 0.8, size: 3, size2: 0.4, color: '#ffe98a' });
        Sound.clang(0.7, 0);
        break;
      case 'lightning':
        FX.spawn('glyph', x, y, 60, { part: 'bolt', color: '#fff6b0', life: 0.35, size: 60, size2: 50 });
        FX.sparks(x, y, 10, 30, ['#ffffff', '#fff6b0', '#bfe8ff'], 380);
        FX.flashScreen(0.6, '255,250,200');
        Sound.thunder(0.9);
        break;
      case 'fireworks':
        for (let k = 0; k < 4; k++) {
          const bx = x + rand(-40, 40), by = y + rand(-20, 30), col = pick([['#ff5c8a', '#ffd6e7'], ['#ffd23f', '#fff6b0'], ['#34c6ea', '#bfe8ff'], ['#7ed957', '#e0ffd0']]);
          FX.sparks(bx, by, rand(70, 110), 40, col, 260);
          FX.spawn('glow', bx, by, 90, { life: 0.3, size: 20, size2: 60, color: col[0], alpha: 0.7 });
        }
        Sound.explosion(0.5, 0);
        break;
      case 'rainbow':
        for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.2832; FX.spawn('glow', x, y, 14, { vx: Math.cos(a) * 220, vy: Math.sin(a) * 160, drag: 2.5, life: 1, size: 6, size2: 1, color: `hsl(${i * 7.5},95%,65%)` }); }
        break;
      case 'blackhole':
        this.holes.push({ x, y, t: 0 });
        p.gone = true;
        Sound.whoosh(1, 0);
        break;
      case 'supernova': { // wrecks every car on screen
        FX.flashScreen(1, '255,255,255');
        FX.spawn('glow', x, y, 20, { life: 0.6, size: 60, size2: 600, color: '#fff6d0', alpha: 0.9 });
        let n = 0;
        for (const row of World.rows.values()) {
          if (row.type !== 'road' || row.y < Renderer.yBot || row.y > Renderer.yTop) continue;
          for (const v of row.lane.vehicles) {
            if (v.wreck || v.animal || !Renderer.inViewX(v.x)) continue;
            Vehicles.toss(v, x, 1.6);
            if (n++ < 6) FX.carCrash(v.x, v.y, [v.base, '#2a2a2e']);
          }
        }
        Sound.explosion(1, 0, true);
        Cam.addTrauma(1);
        FX.text(x, y + 50, 'SUPERNOVA', '#fff6d0', 26);
        break;
      }
    }
  },

  update(dt) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      g.z += dt * 40;
      g.x += Math.sin(g.t * 3) * 0.6;
      if (g.t > 3) this.ghosts.splice(i, 1);
    }
    for (let i = this.holes.length - 1; i >= 0; i--) if ((this.holes[i].t += dt) > 1.6) this.holes.splice(i, 1);
  },

  drawables(list) {
    for (const g of this.ghosts) { g.key = g.y - 9; list.push(g); }
  },

  drawGround(c, time) {
    for (const h of this.holes) { // swells, spins, then snaps shut
      const k = h.t < 1.1 ? easeOutCubic(h.t / 1.1) : 1 - (h.t - 1.1) / 0.5;
      const r = 30 * Math.max(0, k);
      if (r <= 0.5) continue;
      const cy = P(h.y, 1);
      const g = c.createRadialGradient(h.x, cy, 0, h.x, cy, r);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.6, 'rgba(40,10,80,0.9)');
      g.addColorStop(1, 'rgba(120,60,200,0)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(h.x, cy, r, r * GY, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(190,140,255,0.6)';
      c.lineWidth = 1.5;
      for (let k2 = 0; k2 < 3; k2++) {
        const a = time * 6 + k2 * 2.1;
        c.beginPath(); c.ellipse(h.x, cy, r * (0.5 + k2 * 0.2), r * GY * (0.5 + k2 * 0.2), 0, a, a + 2); c.stroke();
      }
    }
  },
};

// ---- Footprints ----------------------------------------------------------------
const Prints = {
  list: [],
  reset() { this.list.length = 0; },

  step(p) {
    if (p.id !== 0 || !Shop.print || !p.alive) return;
    const row = p.rowObj();
    if (!row || row.type === 'river') return;
    this.list.push({ x: p.x, y: p.y, kind: Shop.print, t: 0, face: p.facing, n: this.n = (this.n || 0) + 1 });
    if (this.list.length > 40) this.list.shift();
    if (Shop.print === 'midas' && chance(0.06) && Game.state === 'playing') Game.giveCoins(1, p, 'MIDAS +1', '#ffd23f');
  },

  update(dt) {
    for (const f of this.list) f.t += dt;
    while (this.list.length && this.list[0].t > 3.2) this.list.shift();
  },

  draw(c, time) {
    for (const f of this.list) this.drawOne(c, f, time, Math.min(1, (3.2 - f.t) / 0.8));
  },

  drawOne(c, f, time, a) {
    {
      c.save();
      c.globalAlpha = a;
      c.translate(f.x, P(f.y, 0.5));
      c.scale(1, GY);
      const side = f.n % 2 ? -4 : 4;
      switch (f.kind) {
        case 'tracks':
        case 'snow': {
          c.strokeStyle = f.kind === 'snow' ? 'rgba(235,245,255,0.9)' : 'rgba(60,40,20,0.55)';
          c.lineWidth = f.kind === 'snow' ? 3 : 1.4;
          for (const dx of [-4, 4]) {
            c.beginPath();
            c.moveTo(dx, 4); c.lineTo(dx, -2);
            c.moveTo(dx, -2); c.lineTo(dx - 3, -6); c.moveTo(dx, -2); c.lineTo(dx, -7); c.moveTo(dx, -2); c.lineTo(dx + 3, -6);
            c.stroke();
          }
          break;
        }
        case 'paws':
          c.fillStyle = 'rgba(60,40,30,0.5)';
          for (const dx of [-5, 5]) {
            c.beginPath(); c.ellipse(dx, 1, 2.6, 2.2, 0, 0, 6.2832); c.fill();
            for (const [tx, ty] of [[-2.2, -3], [0, -4], [2.2, -3]]) { c.beginPath(); c.arc(dx + tx, ty, 1, 0, 6.2832); c.fill(); }
          }
          break;
        case 'flames': {
          c.globalCompositeOperation = 'lighter';
          for (const dx of [-4, 4]) {
            const fl = Math.sin(time * 14 + dx + f.n) * 1.5;
            c.fillStyle = 'rgba(255,140,40,0.7)';
            c.beginPath(); c.moveTo(dx - 3, 3); c.quadraticCurveTo(dx, -8 - fl, dx + 3, 3); c.fill();
            c.fillStyle = 'rgba(255,230,120,0.8)';
            c.beginPath(); c.moveTo(dx - 1.5, 3); c.quadraticCurveTo(dx, -3 - fl, dx + 1.5, 3); c.fill();
          }
          break;
        }
        case 'flowers': {
          const grow = Math.min(1, f.t * 3);
          const col = ['#ff6fa5', '#ffd23f', '#ffffff', '#c79bff'][f.n % 4];
          c.fillStyle = col;
          for (let k = 0; k < 5; k++) { const ang = k * 1.256; c.beginPath(); c.arc(side + Math.cos(ang) * 2.6 * grow, Math.sin(ang) * 2.6 * grow, 1.8 * grow, 0, 6.2832); c.fill(); }
          c.fillStyle = '#ffd23f';
          c.beginPath(); c.arc(side, 0, 1.3 * grow, 0, 6.2832); c.fill();
          break;
        }
        case 'neon':
        case 'rainbow':
        case 'midas':
        case 'diamond': {
          c.globalCompositeOperation = f.kind === 'midas' ? 'source-over' : 'lighter';
          const col = f.kind === 'neon' ? '#ff4fe0' : f.kind === 'rainbow' ? `hsl(${(f.n * 50) % 360},95%,62%)` : f.kind === 'midas' ? '#ffd23f' : '#9fe7ff';
          c.fillStyle = col;
          for (const dx of [-4, 4]) { c.beginPath(); c.ellipse(dx, 0, 2.8, 4.2, 0, 0, 6.2832); c.fill(); }
          if (f.kind !== 'neon') {
            c.fillStyle = 'rgba(255,255,255,0.7)';
            if (((time * 3 + f.n) % 2) < 0.25) c.fillRect(side - 0.8, -2, 1.6, 1.6);
          }
          break;
        }
        default: { // hearts, stars, slime, pixel, ghost: glyphs
          const look = { hearts: ['heart', '#ff5c8a'], stars: ['star', '#ffe95c'], slime: ['drop', '#7ed957'], pixel: ['pixel', ['#ff5c8a', '#34c6ea', '#7ed957', '#ffd23f'][f.n % 4]], ghost: ['ghost', 'rgba(240,240,255,0.8)'] }[f.kind];
          if (look) for (const dx of [-4, 4]) FX.glyph(c, look[0], dx, 0, 6, look[1], 0);
        }
      }
      c.restore();
    }
  },
};

// ---- Mystery boxes: picked up during a run, opened on the report ---------------
const Boxes = {
  run: 0,
  results: [],

  reset() { this.run = 0; this.results = []; },

  canSpawn(rowI) { return Game.players.length === 1 && rowI > 15; },

  pickup(p, it) {
    if (p.id !== 0) return;
    this.run++;
    FX.pickup(it.x, it.y, '#a95cff');
    FX.text(it.x, it.y + 22, 'MYSTERY BOX!', '#c79bff', 18);
    Sound.powerup();
    Roadex.see('specials', 'box');
    if (Game.tracksProgress()) Stats.add('boxes');
  },

  // Open everything picked up this run. Coins go to the bank, cosmetics are yours.
  open() {
    this.results = [];
    for (let k = 0; k < this.run; k++) this.results.push(this.roll());
    if (this.run && Game.tracksProgress()) Trophies.max('boxesRun', this.run);
    this.run = 0;
    return this.results;
  },

  roll() {
    const unowned = filter => {
      const out = [];
      for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) {
        const it = SHOP_TABS[tab][id];
        if (id !== 'none' && filter(it) && !Shop.has(tab, id)) out.push([tab, id]);
      }
      return out;
    };
    Shards.add(1); // every box has a shard in it
    const r = Math.random();
    if (r < 0.22) { // a mystery exclusive: a duplicate turns into shards
      const all = [];
      for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) if (SHOP_TABS[tab][id].box) all.push([tab, id]);
      const [tab, id] = pick(all);
      if (!Shop.has(tab, id)) return this.give([tab, id], true);
      Shards.add(5);
      return { dupe: SHOP_TABS[tab][id].name, shards: 6 };
    }
    const normal = unowned(it => !it.box && !it.egg && !it.level && !it.unlock && it.price > 0 && it.price <= 2000);
    if (r < 0.6 && normal.length) return this.give(pick(normal), false);
    const coins = randInt(5, 30) * 10;
    Game.bank += coins;
    Store.set('coins', Game.bank);
    return { coins, shards: 1 };
  },

  give([tab, id], rare) {
    Shop.grant(tab, id);
    const tabName = { skins: 'skin', hats: 'hat', trails: 'trail', pets: 'pet', deaths: 'death effect', prints: 'footprints', titles: 'title' }[tab];
    return { tab, id, name: SHOP_TABS[tab][id].name, kind: tabName, rare, shards: 1 };
  },
};

// ---- Pet levels: your pet earns XP with you; level 5 upgrades its perk ----------
const PET_LEVELS = [0, 150, 400, 900, 1800]; // total XP to reach levels 1..5

const PetLevels = {
  xp: {},
  load() {
    const v = Store.get('petxp', {});
    this.xp = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  },
  level(id) {
    const x = this.xp[id] || 0;
    let l = 1;
    while (l < PET_LEVELS.length && x >= PET_LEVELS[l]) l++;
    return l;
  },
  maxed(id) { return this.level(id) >= 5; },
  // { level, into, need } for the shop card
  info(id) {
    const l = this.level(id), x = this.xp[id] || 0;
    if (l >= 5) return { level: 5, max: true };
    return { level: l, into: x - PET_LEVELS[l - 1], need: PET_LEVELS[l] - PET_LEVELS[l - 1] };
  },
  // A run's XP goes to the pet that was out. Returns a level-up note, if any.
  award(id, amount) {
    if (!id || id === 'none' || amount <= 0) return null;
    const before = this.level(id);
    this.xp[id] = (this.xp[id] || 0) + amount;
    Store.set('petxp', this.xp);
    const after = this.level(id);
    return after > before ? { id, name: PETS[id].name, level: after, max: after >= 5 } : null;
  },
};
