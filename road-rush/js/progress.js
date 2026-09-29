'use strict';
// Progression: the skin shop (coins), missions (coins for goals), and the
// ghost of your best run.

// ---- Skins ------------------------------------------------------------------
// Most skins are bought with coins; a few are trophies you have to earn.
const SKINS = {
  chick:   { name: 'Chick', price: 0, kind: 'bird',
             top: '#fff1a8', front: '#ffd23f', wingTop: '#ffe066', wingFront: '#f2b705',
             comb: ['#ff6b6b', '#e04848'], beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  hardhat: { name: 'Hard Hat Chick', price: 100, kind: 'bird', hat: 'hardhat',
             top: '#fff1a8', front: '#ffd23f', wingTop: '#ffe066', wingFront: '#f2b705',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  duck:    { name: 'Duck', price: 200, kind: 'bird', bill: true,
             top: '#ffffff', front: '#e6e6e0', wingTop: '#f2f2ee', wingFront: '#d2d2ca',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  frog:    { name: 'Frog', price: 350, kind: 'frog',
             top: '#8be067', front: '#4fae45', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#3d8b37' },
  raccoon: { name: 'Raccoon', price: 500, kind: 'raccoon',
             top: '#a3a9b1', front: '#737a84', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#3a3d42' },
  penguin: { name: 'Penguin', price: 0, unlock: 'coldfeet', kind: 'bird', belly: '#f7f7f5', bill: true,
             top: '#2e3440', front: '#1e232c', wingTop: '#2a303b', wingFront: '#161a21',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  dummy:   { name: 'Crash Test Dummy', price: 0, unlock: 'crashtest', kind: 'bird', marks: true,
             top: '#ffd84a', front: '#e8b400', wingTop: '#f2c830', wingFront: '#c99a00',
             comb: null, beak: ['#9aa0a8', '#6d737c'], feet: '#3a3d42' },
  zombie:  { name: 'Zombie Chick', price: 0, unlock: 'again', kind: 'bird', zombie: true,
             top: '#b5c9a3', front: '#86a077', wingTop: '#9fb68f', wingFront: '#6f8a62',
             comb: ['#8a4545', '#6a3030'], beak: ['#c9a36a', '#a27f48'], feet: '#7a8a5a' },
  bigj:    { name: 'Big J', price: 67, kind: 'bigj',
             top: '#9a9ea8', front: '#7b7f89', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#6c7079' },
  // level rewards
  silver:  { name: 'Silver Chick', price: 0, level: 3, kind: 'bird', shine: true,
             top: '#eef1f5', front: '#b3bac4', wingTop: '#dde2e8', wingFront: '#9aa2ad',
             comb: ['#ff6b6b', '#e04848'], beak: ['#c9ced6', '#9aa2ad'], feet: '#8d95a0' },
  robo:    { name: 'Robo Chick', price: 0, level: 5, kind: 'bird', antenna: true, eyeColor: '#4df0ff',
             top: '#a9b4c2', front: '#6f7b8c', wingTop: '#8e9aab', wingFront: '#56616f',
             comb: null, beak: ['#ffb347', '#e08a10'], feet: '#56616f' },
  neon:    { name: 'Neon Chick', price: 0, level: 8, kind: 'bird', glow: 'rgba(255,70,230,0.5)',
             top: '#ff6cf2', front: '#c42bb9', wingTop: '#7df9ff', wingFront: '#2bc2d0',
             comb: ['#7df9ff', '#2bc2d0'], beak: ['#ffe95c', '#e0c020'], feet: '#7df9ff' },
  diamond: { name: 'Diamond Chick', price: 0, level: 12, kind: 'bird', shine: true, glow: 'rgba(150,230,255,0.35)',
             top: '#d9f7ff', front: '#86d4ee', wingTop: '#bdefff', wingFront: '#64bcdc',
             comb: ['#b9f2ff', '#7fd6ef'], beak: ['#eafcff', '#a7e3f5'], feet: '#86d4ee' },
  golden:  { name: 'Golden Chicken', price: 0, level: 16, kind: 'bird', shine: true, glow: 'rgba(255,210,60,0.35)',
             top: '#ffe98a', front: '#f0b400', wingTop: '#ffd84a', wingFront: '#d49a00',
             comb: ['#ff4f4f', '#d63030'], beak: ['#ffcf6b', '#f0a020'], feet: '#e89010' },
  phoenix: { name: 'Phoenix', price: 0, level: 20, kind: 'bird', flames: true, glow: 'rgba(255,120,30,0.45)',
             top: '#ffc14a', front: '#f0621c', wingTop: '#ff8a2a', wingFront: '#c8400f',
             comb: ['#ffe95c', '#ffb000'], beak: ['#ffe27a', '#f0a020'], feet: '#c8400f' },
};

const HATS = {
  none:    { name: 'No hat', price: 0 },
  party:   { name: 'Party Hat', price: 60 },
  shades:  { name: 'Sunglasses', price: 80 },
  cone:    { name: 'Traffic Cone', price: 100 },
  cowboy:  { name: 'Cowboy Hat', price: 120 },
  tophat:  { name: 'Top Hat', price: 150 },
  crown:   { name: 'Crown', price: 400 },
};

const TRAILS = {
  none:     { name: 'No trail', price: 0 },
  sparkle:  { name: 'Sparkles', price: 100 },
  bubbles:  { name: 'Bubbles', price: 120 },
  confetti: { name: 'Confetti', price: 150 },
  fire:     { name: 'Fire', price: 200 },
  rainbow:  { name: 'Rainbow', price: 300 },
};

const SHOP_TABS = { skins: SKINS, hats: HATS, trails: TRAILS };

const Shop = {
  owned: { skins: ['chick'], hats: ['none'], trails: ['none'] },
  current: 'chick',
  hat: null,
  trail: null,

  load() {
    const list = (key, table, base) => {
      const v = Store.get(key, [base]);
      const out = Array.isArray(v) ? v.filter(id => table[id]) : [];
      if (!out.includes(base)) out.unshift(base);
      return out;
    };
    this.owned = { skins: list('skins', SKINS, 'chick'), hats: list('hats', HATS, 'none'), trails: list('trails', TRAILS, 'none') };
    const cur = Store.get('skin', 'chick');
    this.current = SKINS[cur] && this.has('skins', cur) ? cur : 'chick';
    const hat = Store.get('hat', 'none'), trail = Store.get('trail', 'none');
    this.hat = HATS[hat] && this.has('hats', hat) && hat !== 'none' ? hat : null;
    this.trail = TRAILS[trail] && this.has('trails', trail) && trail !== 'none' ? trail : null;
  },

  skin() { return SKINS[this.current]; },

  // Trophy skins are yours as soon as the trophy is.
  has(tab, id) {
    const item = SHOP_TABS[tab][id];
    if (!item) return false;
    if (item.unlock) return Trophies.has(item.unlock);
    if (item.level) return Levels.level >= item.level;
    return this.owned[tab].includes(id);
  },

  equipped(tab, id) {
    if (tab === 'skins') return this.current === id;
    if (tab === 'hats') return (this.hat || 'none') === id;
    return (this.trail || 'none') === id;
  },

  buy(tab, id) {
    const item = SHOP_TABS[tab][id];
    if (!item || item.unlock || item.level || this.has(tab, id) || Game.bank < item.price) return false;
    Game.bank -= item.price;
    Store.set('coins', Game.bank);
    this.owned[tab].push(id);
    Store.set(tab, this.owned[tab]);
    this.equip(tab, id);
    return true;
  },

  equip(tab, id) {
    if (!this.has(tab, id)) return;
    if (tab === 'skins') { this.current = id; Store.set('skin', id); }
    else if (tab === 'hats') { this.hat = id === 'none' ? null : id; Store.set('hat', id); }
    else { this.trail = id === 'none' ? null : id; Store.set('trail', id); }
  },
};

// Hop trails (player one's equipped trail).
const Cosmetics = {
  hopTrail(p) {
    if (p.id !== 0 || !Shop.trail) return;
    FX.hopTrail(p.x, p.y, Shop.trail);
  },
};

// ---- Missions ----------------------------------------------------------------
const MISSION_TYPES = {
  lanes:    { text: n => `Cross ${n} lanes of traffic in one run`, targets: [10, 20, 35, 50], reward: n => 30 + n * 3 },
  streak:   { text: n => `Cross ${n} lanes in a row without stopping`, targets: [3, 5, 8], reward: n => n * 20 },
  coins:    { text: n => `Collect ${n} coins in one run`, targets: [5, 10, 20], reward: n => n * 8 },
  score:    { text: n => `Score ${n} points in one run`, targets: [300, 600, 1000, 1500], reward: n => Math.round(n / 8) },
  crashes:  { text: n => `Survive ${n} crashes near you in one run`, targets: [2, 3, 5], reward: n => n * 30 },
  combo:    { text: n => `Get a x${n} close-call combo`, targets: [2, 3, 5], reward: n => n * 30 },
  logs:     { text: n => `Ride ${n} logs in one run`, targets: [3, 6, 10], reward: n => n * 12 },
  rails:    { text: n => `Cross ${n} railroad tracks in one run`, targets: [2, 4, 6], reward: n => n * 25 },
  powerups: { text: n => `Grab ${n} power-ups in one run`, targets: [2, 3, 5], reward: n => n * 25 },
  events:   { text: n => `Survive ${n} secret event${n > 1 ? 's' : ''} in one run`, targets: [1, 2], reward: n => n * 60 },
  distance: { text: n => `Reach row ${n}`, targets: [40, 80, 120, 160], reward: n => n },
};

const Missions = {
  active: [],
  done: 0,
  stats: {},

  load() {
    this.done = Store.get('missionsDone', 0);
    const saved = Store.get('missions', []);
    this.active = (Array.isArray(saved) ? saved : []).filter(m => m && MISSION_TYPES[m.type]).slice(0, 3);
    while (this.active.length < 3) this.active.push(this.make());
    this.save();
    this.startRun();
  },

  save() {
    Store.set('missions', this.active);
    Store.set('missionsDone', this.done);
  },

  make() {
    const used = this.active.map(m => m.type);
    const types = Object.keys(MISSION_TYPES).filter(t => !used.includes(t));
    const type = pick(types);
    const T = MISSION_TYPES[type];
    const level = Math.min(T.targets.length - 1, Math.floor(this.done / 3) + randInt(0, 1));
    const target = T.targets[level];
    return { type, target, reward: T.reward(target), fresh: true };
  },

  text(m) { return MISSION_TYPES[m.type].text(m.target); },

  startRun() {
    this.stats = { lanes: 0, streak: 0, coins: 0, score: 0, crashes: 0, combo: 0, logs: 0, rails: 0, powerups: 0, events: 0, distance: 0 };
    for (const m of this.active) m.fresh = false; // new missions count from the next run
  },

  progress(m) { return Math.min(m.target, this.stats[m.type] || 0); },

  add(key, n = 1) { if (!Game.tracksProgress()) return; this.stats[key] = (this.stats[key] || 0) + n; this.check(); },
  max(key, v) { if (!Game.tracksProgress()) return; if (v > (this.stats[key] || 0)) { this.stats[key] = v; this.check(); } },

  check() {
    for (let i = 0; i < this.active.length; i++) {
      const m = this.active[i];
      if (m.fresh || (this.stats[m.type] || 0) < m.target) continue;
      this.done++;
      Game.bank += m.reward;
      Store.set('coins', Game.bank);
      UI.missionDone(m);
      Sound.mission();
      this.active[i] = this.make();
      this.save();
    }
  },
};

// ---- Ghost of your best run ---------------------------------------------------------
// Records each move as [time, x, y, kind]; plays back your best run alongside you.
const Ghost = {
  rec: [],
  play: null,
  idx: 0,
  pos: null,
  key: 'best',

  start(key) {
    this.key = key;
    this.rec = [[0, cellX(START_COL), 0, 'h']];
    this.idx = 0;
    this.pos = null;
    if (!key) { this.play = null; return; } // no ghost in two-player mode
    const saved = Settings.ghost ? Store.get('ghost.' + key, null) : null;
    this.play = Array.isArray(saved) && saved.length > 1 ? saved : null;
    this.idx = 0;
    this.pos = null;
    this.slideT = 0;
  },

  // kind: h = hop, k = knockback, s = drift on a log, d = died
  mark(t, x, y, kind) {
    if (this.key && this.rec.length < 4000) this.rec.push([Math.round(t * 100) / 100, Math.round(x), Math.round(y), kind]);
  },

  save() { if (this.key) Store.set('ghost.' + this.key, this.rec); },

  update(t) {
    const g = this.play;
    if (!g) { this.pos = null; return; }
    while (this.idx < g.length - 1 && g[this.idx + 1][0] <= t) this.idx++;
    const cur = g[this.idx], prev = g[Math.max(0, this.idx - 1)];
    if (cur[3] === 'd') {
      const fade = 1 - (t - cur[0]) / 0.8;
      this.pos = fade > 0 ? { x: cur[1], y: cur[2], z: 0, alpha: fade } : null;
      return;
    }
    const dur = cur[3] === 'k' ? 0.4 : cur[3] === 's' ? 0.2 : 0.12;
    const k = clamp((t - cur[0]) / dur, 0, 1);
    const e = cur[3] === 's' ? k : easeOutQuad(k);
    this.pos = {
      x: lerp(prev[1], cur[1], e),
      y: lerp(prev[2], cur[2], e),
      z: cur[3] === 's' ? 0 : Math.sin(Math.PI * k) * (cur[3] === 'k' ? 0.6 : 0.3) * TILE,
      alpha: 1,
    };
  },
};
