'use strict';
// Long-term goals: biome mastery (three stars per biome), the Roadex (a
// collection book of everything you've seen on the road), prestige (start
// again from level 1 after level 50 for permanent bonuses), box shards, and
// pet evolutions.

// ---- Biome mastery ---------------------------------------------------------------
const MASTERY_STARS = ['Cross it in one run', 'Cross it without grabbing a power-up', 'Get a x8 close-call combo in it'];
const MASTERY_COMBO = 8;
const zoneName = z => ZONES[z].name.replace(/^THE /, '').toLowerCase().replace(/(^|\s)\w/g, ch => ch.toUpperCase());

const Mastery = {
  data: {},
  cur: null,

  load() {
    const v = Store.get('mastery', {});
    this.data = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  },

  stars(z) { const s = this.data[z]; return Array.isArray(s) ? s : [0, 0, 0]; },
  count(z) { return this.stars(z).filter(Boolean).length; },
  done(z) { return this.count(z) >= 3; },
  total() { let n = 0; for (const z in ZONES) n += this.count(z); return n; },
  get max() { return Object.keys(ZONES).length * 3; },
  anyDone() { return Object.keys(ZONES).some(z => this.done(z)); },
  reward(z) { for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) if (SHOP_TABS[tab][id].mastery === z) return [tab, id]; return null; },

  startRun() {
    this.cur = Game.players.length === 1 && Game.tracksProgress() ? { zone: 'country', pw: 0 } : null;
  },

  power() { if (this.cur) this.cur.pw++; },
  combo(n) { if (this.cur && n >= MASTERY_COMBO) this.award(this.cur.zone, 2); },

  // Left a biome behind: you crossed the whole thing.
  cross(next) {
    if (!this.cur) return;
    this.award(this.cur.zone, 0);
    if (this.cur.pw === 0) this.award(this.cur.zone, 1);
    this.cur = { zone: next, pw: 0 };
  },

  award(z, i) {
    const s = this.stars(z).slice();
    if (s[i]) return;
    s[i] = 1;
    this.data[z] = s;
    Store.set('mastery', this.data);
    const n = this.count(z);
    if (n >= 3) {
      const r = this.reward(z);
      UI.toast('t-mastery', `${zoneName(z).toUpperCase()} MASTERED!`, r ? `Unlocked: ${SHOP_TABS[r[0]][r[1]].name}` : 'All three stars', 4200);
      Sound.trophy();
    } else {
      UI.toast('t-mastery', `★ ${zoneName(z).toUpperCase()} ${n}/3`, MASTERY_STARS[i], 3000);
      Sound.mission();
    }
    Trophies.check();
  },
};

// ---- Roadex -------------------------------------------------------------------------
const cap = s => s.replace(/^an? /, '').replace(/^\w/, ch => ch.toUpperCase());
const ROADEX = {
  vehicles: { name: 'Vehicles', entries: () => {
    const o = {};
    for (const k in VEHICLE_TYPES) if (!VEHICLE_TYPES[k].animal) o[k] = cap(VEHICLE_TYPES[k].name);
    o.train = 'Freight train';
    o.tram = 'Tram';
    return o;
  } },
  critters: { name: 'Critters', entries: () => ({ cow: 'Cow', sheep: 'Sheep', deer: 'Deer', weed: 'Tumbleweed', gull: 'Seagull' }) },
  events: { name: 'Secret events', entries: () => ({
    ufo: 'UFO sighting', meteor: 'Meteor shower', giant: 'Giant chicken', flood: 'Flash flood', reverse: 'Wrong way traffic',
    goose: 'Giant goose', moon: 'The moon up close', lowgrav: 'Gravity glitch', mini: 'Miniature world',
    reverseday: 'Reverse Day', tornado: 'Tornado', lightning: 'Lightning storm', drunk: 'Drunk driver',
  }) },
  powerups: { name: 'Power-ups', entries: () => { const o = {}; for (const k in POWERUPS) o[k] = POWERUPS[k].name; return o; } },
  biomes: { name: 'Biomes', entries: () => { const o = {}; for (const z in ZONES) o[z] = zoneName(z); return o; } },
  weather: { name: 'Weather', entries: () => ({ rain: 'Rain', snow: 'Snow', dust: 'Dust storm', fog: 'Fog', leaves: 'Falling leaves', night: 'Night' }) },
  upgrades: { name: 'Run upgrades', entries: () => { const o = {}; for (const k in UPGRADES) o[k] = UPGRADES[k].name; return o; } },
  specials: { name: 'Specials', entries: () => ({ box: 'Mystery box', egg: 'Mystery egg', stand: 'Roadside stand', room: 'Secret room', golden: 'Golden run', fever: 'Combo fever' }) },
};
for (const k in ROADEX) ROADEX[k].list = ROADEX[k].entries();
const ROADEX_COINS = 10;     // per new entry
const ROADEX_PAGE_COINS = 250;

const Roadex = {
  seen: {},

  load() {
    const v = Store.get('roadex', {});
    this.seen = {};
    for (const page in ROADEX) {
      const arr = v && Array.isArray(v[page]) ? v[page].filter(id => ROADEX[page].list[id]) : [];
      this.seen[page] = new Set(arr);
    }
  },

  save() {
    const o = {};
    for (const page in this.seen) o[page] = [...this.seen[page]];
    Store.set('roadex', o);
  },

  has(page, id) { return this.seen[page].has(id); },
  pageCount(page) { return { have: this.seen[page].size, total: Object.keys(ROADEX[page].list).length }; },
  pageDone(page) { const n = this.pageCount(page); return n.have >= n.total; },
  allDone() { return Object.keys(ROADEX).every(p => this.pageDone(p)); },
  totals() {
    let have = 0, total = 0;
    for (const p in ROADEX) { const n = this.pageCount(p); have += n.have; total += n.total; }
    return { have, total };
  },
  reward(page) { for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) if (SHOP_TABS[tab][id].roadex === page) return [tab, id]; return null; },

  // Something showed up during a run: write it in the book.
  see(page, id) {
    const s = this.seen[page];
    if (!s || s.has(id) || !ROADEX[page].list[id]) return;
    if (Game.state !== 'playing' && Game.state !== 'upgrade') return;
    if (!Game.tracksProgress()) return;
    s.add(id);
    this.save();
    Game.bank += ROADEX_COINS;
    Store.set('coins', Game.bank);
    if (this.pageDone(page)) {
      Game.bank += ROADEX_PAGE_COINS;
      Store.set('coins', Game.bank);
      const r = this.reward(page);
      UI.toast('t-roadex', `ROADEX PAGE COMPLETE: ${ROADEX[page].name.toUpperCase()}`, `+${ROADEX_PAGE_COINS} coins` + (r ? `. Unlocked: ${SHOP_TABS[r[0]][r[1]].name}` : ''), 4200);
      Sound.trophy();
      Trophies.check();
    } else {
      UI.roadexToast(ROADEX[page].list[id], `${ROADEX[page].name} ${s.size}/${this.pageCount(page).total} · +${ROADEX_COINS} coins`);
    }
  },
};

// ---- Prestige ----------------------------------------------------------------------
const PRESTIGE_MAX = 10;
const PRESTIGE_LEVEL = 50;

const Prestige = {
  n: 0,
  load() { const v = Store.get('prestige', 0); this.n = typeof v === 'number' && v >= 0 ? Math.min(PRESTIGE_MAX, v) : 0; },
  can() { return Levels.level >= PRESTIGE_LEVEL && this.n < PRESTIGE_MAX; },
  // +5% coins and XP for every prestige
  bonus() { return 1 + 0.05 * this.n; },
  go() {
    if (!this.can()) return false;
    this.n++;
    Store.set('prestige', this.n);
    Levels.xp = 0;
    Store.set('xp', 0);
    Trophies.check();
    return true;
  },
  rewards() {
    const out = [];
    for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) if (SHOP_TABS[tab][id].prestige) out.push([SHOP_TABS[tab][id].prestige, tab, id]);
    return out.sort((a, b) => a[0] - b[0]);
  },
};

// ---- Box shards: duplicates aren't wasted ------------------------------------------
const SHARD_COST = 20;

const Shards = {
  n: 0,
  load() { const v = Store.get('shards', 0); this.n = typeof v === 'number' && v >= 0 ? v : 0; },
  add(k) { this.n += k; Store.set('shards', this.n); },
  craft(tab, id) {
    const item = SHOP_TABS[tab][id];
    if (!item || !item.box || Shop.has(tab, id) || this.n < SHARD_COST) return false;
    this.n -= SHARD_COST;
    Store.set('shards', this.n);
    Shop.grant(tab, id);
    Stats.add('crafted');
    Stats.save();
    Trophies.check();
    return true;
  },
};

// ---- Pet evolution ----------------------------------------------------------------
// A level 5 pet can evolve: it grows, glows, and gives +20% XP and +10% coins.
const EVOLVE_COST = 1500;

const Evolve = {
  list: [],
  load() { const v = Store.get('evolved', []); this.list = Array.isArray(v) ? v.filter(id => PETS[id]) : []; },
  has(id) { return !!id && this.list.includes(id); },
  can(id) { return id !== 'none' && Shop.has('pets', id) && PetLevels.maxed(id) && !this.has(id); },
  go(id) {
    if (!this.can(id) || Game.bank < EVOLVE_COST) return false;
    Game.bank -= EVOLVE_COST;
    Store.set('coins', Game.bank);
    this.list.push(id);
    Store.set('evolved', this.list);
    Trophies.check();
    return true;
  },
  name(id) { return (this.has(id) ? 'Mega ' : '') + PETS[id].name; },
  active() { return Game.players.length === 1 && this.has(Shop.pet); },

  // The evolved glow and orbiting sparkles (drawn under the pet).
  aura(c, o, time) {
    const z = o.z + 9;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, P(0, z), 0, 0, P(0, z), 24);
    g.addColorStop(0, 'rgba(255,220,110,0.45)');
    g.addColorStop(1, 'rgba(255,220,110,0)');
    c.fillStyle = g;
    c.fillRect(-24, P(0, z) - 24, 48, 48);
    c.restore();
    for (let k = 0; k < 3; k++) {
      const a = time * 2.4 + k * 2.094;
      const front = Math.sin(a) < 0;
      if (front) continue;
      FX.glyph(c, 'star', Math.cos(a) * 15, P(Math.sin(a) * 9, z + 4 + Math.sin(time * 3 + k) * 3), 4, k % 2 ? '#ffe95c' : '#ffffff', a);
    }
  },
  sparkles(c, o, time) { // the half of the orbit in front of the pet
    const z = o.z + 9;
    for (let k = 0; k < 3; k++) {
      const a = time * 2.4 + k * 2.094;
      if (Math.sin(a) >= 0) continue;
      FX.glyph(c, 'star', Math.cos(a) * 15, P(Math.sin(a) * 9, z + 4 + Math.sin(time * 3 + k) * 3), 4, k % 2 ? '#ffe95c' : '#ffffff', a);
    }
  },
};
