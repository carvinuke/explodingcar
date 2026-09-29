'use strict';
// Progression: the skin shop (coins), missions (coins for goals), and the
// ghost of your best run.

// ---- Skins ------------------------------------------------------------------
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
};

const Shop = {
  owned: [],
  current: 'chick',

  load() {
    const owned = Store.get('skins', ['chick']);
    this.owned = Array.isArray(owned) ? owned.filter(id => SKINS[id]) : ['chick'];
    if (!this.owned.includes('chick')) this.owned.unshift('chick');
    const cur = Store.get('skin', 'chick');
    this.current = this.owned.includes(cur) ? cur : 'chick';
  },

  skin() { return SKINS[this.current]; },

  buy(id) {
    const s = SKINS[id];
    if (!s || this.owned.includes(id) || Game.bank < s.price) return false;
    Game.bank -= s.price;
    Store.set('coins', Game.bank);
    this.owned.push(id);
    Store.set('skins', this.owned);
    this.equip(id);
    return true;
  },

  equip(id) {
    if (!this.owned.includes(id)) return;
    this.current = id;
    Store.set('skin', id);
  },
};
Shop.load();

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

  add(key, n = 1) { this.stats[key] = (this.stats[key] || 0) + n; this.check(); },
  max(key, v) { if (v > (this.stats[key] || 0)) { this.stats[key] = v; this.check(); } },

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
    const saved = Settings.ghost ? Store.get('ghost.' + key, null) : null;
    this.play = Array.isArray(saved) && saved.length > 1 ? saved : null;
    this.idx = 0;
    this.pos = null;
    this.slideT = 0;
  },

  // kind: h = hop, k = knockback, s = drift on a log, d = died
  mark(t, x, y, kind) {
    if (this.rec.length < 4000) this.rec.push([Math.round(t * 100) / 100, Math.round(x), Math.round(y), kind]);
  },

  save() { Store.set('ghost.' + this.key, this.rec); },

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
