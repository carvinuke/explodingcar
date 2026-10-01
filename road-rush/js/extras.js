'use strict';
// Death effects, footprints, mystery boxes and pet levels.

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
          const look = { hearts: ['heart', '#ff5c8a'], stars: ['star', '#ffe95c'], slime: ['drop', '#7ed957'], pixel: ['pixel', ['#ff5c8a', '#34c6ea', '#7ed957', '#ffd23f'][f.n % 4]], ghost: ['ghost', 'rgba(240,240,255,0.8)'], tokens: ['coin', '#c79bff'] }[f.kind];
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
    const tabName = { skins: 'skin', hats: 'hat', trails: 'trail', pets: 'pet', auras: 'aura', prints: 'footprints', titles: 'title' }[tab];
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
