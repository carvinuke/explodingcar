'use strict';
// Lifetime stats, trophies (achievements) and levels. Some trophies and
// levels unlock skins.

const STAT_DEFAULTS = () => ({
  runs: 0, rows: 0, coins: 0, time: 0, wrecks: 0, trainDodges: 0, closeCalls: 0, logs: 0, events: 0,
  bestCombo: 0, deathsTotal: 0, deaths: {}, zones: {}, versusGames: 0, versusWins: 0,
});

const DEATH_LABELS = {
  vehicle: 'Hit by traffic', train: 'Hit by a train', drown: 'Fell in the river', swept: 'Swept away',
  danger: 'Left behind', meteor: 'Meteors', giant: 'Giant chicken', goose: 'Giant goose', pit: 'Fell in a pit',
  responder: 'Hit by an ambulance or fire truck', lightning: 'Struck by lightning', drunk: 'Hit by a drunk driver',
};

const Stats = {
  data: STAT_DEFAULTS(),

  load() {
    const saved = Store.get('stats', null);
    this.data = Object.assign(STAT_DEFAULTS(), saved && typeof saved === 'object' ? saved : {});
    if (!this.data.deaths || typeof this.data.deaths !== 'object') this.data.deaths = {};
    if (!this.data.zones || typeof this.data.zones !== 'object') this.data.zones = {};
  },

  save() { Store.set('stats', this.data); },

  add(key, n = 1) { this.data[key] = (this.data[key] || 0) + n; },

  death(cause) {
    this.data.deaths[cause] = (this.data.deaths[cause] || 0) + 1;
    this.data.deathsTotal++;
  },

  zone(z) {
    if (this.data.zones[z]) return;
    this.data.zones[z] = true;
    this.save();
    Trophies.check();
  },

};

// test(run, stats) -> unlocked?
const TROPHIES = [
  { id: 'baby', name: 'Baby Steps', desc: 'Reach row 10', test: r => r.row >= 10 },
  { id: 'longhaul', name: 'Long Haul', desc: 'Reach row 150 in one run', test: r => r.row >= 150 },
  { id: 'warrior', name: 'Road Warrior', desc: 'Reach row 300 in one run', test: r => r.row >= 300 },
  { id: 'crashtest', name: 'Crash Test', desc: 'Survive 3 explosions near you in one run', test: r => r.booms >= 3, skin: 'dummy' },
  { id: 'hair', name: "Hair's Breadth", desc: 'Get a x5 close-call combo', test: r => r.combo >= 5 },
  { id: 'tooclose', name: 'Too Close', desc: 'Get a close call with a train', test: r => r.trainDodge >= 1 },
  { id: 'traindodger', name: 'Train Dodger', desc: 'Cross 5 railroads in one run', test: r => r.rails >= 5 },
  { id: 'logroller', name: 'Log Roller', desc: 'Ride 6 logs in a row without touching land', test: r => r.logChain >= 6 },
  { id: 'weird', name: 'Weird Day', desc: 'Survive 3 secret events in one run', test: r => r.events >= 3 },
  { id: 'coldfeet', name: 'Cold Feet', desc: 'Reach the mountain pass', test: (r, s) => !!s.zones.snow, skin: 'penguin' },
  { id: 'beachbum', name: 'Beach Bum', desc: 'Reach the beach', test: (r, s) => !!s.zones.beach },
  { id: 'tourist', name: 'Tourist', desc: 'Visit all five biomes', test: (r, s) => ['country', 'city', 'desert', 'snow', 'beach'].every(z => s.zones[z]) },
  { id: 'twister', name: 'Twister', desc: 'Get picked up by a tornado and live', test: r => r.tornado >= 1 },
  { id: 'sober', name: 'Designated Driver', desc: 'Get a close call with a drunk driver', test: r => r.drunkClose >= 1 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Survive a whole night', test: r => r.nights >= 1 },
  { id: 'skater', name: 'Skater', desc: 'Slide on 5 ice patches in one run', test: r => r.ice >= 5 },
  { id: 'deer', name: 'Oh Deer', desc: 'Get trampled by a deer', test: r => r.deer >= 1 },
  { id: 'whacked', name: 'Hard Hat Area', desc: 'Get whacked by an excavator', test: r => r.whacked >= 1 },
  { id: 'irony', name: 'Irony', desc: 'Get run over by an ambulance or fire truck', test: r => r.irony >= 1 },
  { id: 'power', name: 'Power Hungry', desc: 'Grab all 5 kinds of power-up in one run', test: r => r.powerTypes >= 5 },
  { id: 'pocket', name: 'Pocket Money', desc: 'Collect 30 coins in one run', test: r => r.coins >= 30 },
  { id: 'savings', name: 'Savings Account', desc: 'Earn 1,000 coins in total', test: (r, s) => s.coins >= 1000 },
  { id: 'again', name: 'Try, Try Again', desc: 'Die 50 times', test: (r, s) => s.deathsTotal >= 50, skin: 'zombie' },
  { id: 'hardcore', name: 'Hardcore', desc: 'Reach row 100 in Hardcore', test: r => r.mode === 'hardcore' && r.row >= 100 },
  { id: 'speed', name: 'Speed Demon', desc: 'Reach row 60 in Time Attack', test: r => r.mode === 'time' && r.row >= 60 },
  { id: 'rivals', name: 'Friendly Rivalry', desc: 'Finish a two-player match', test: (r, s) => s.versusGames >= 1 },
  { id: 'hatch', name: 'Hatchling', desc: 'Hatch an egg', test: r => r.hatch >= 1 },
  { id: 'rage', name: 'Anger Management', desc: 'Throw 3 cars at once with Big J\'s rage stomp', test: r => r.stompCars >= 3 },
  { id: 'reborn', name: 'Rise Again', desc: 'Get brought back to life by the Phoenix Chick', test: r => r.reborn >= 1 },
  { id: 'reverse', name: 'Role Reversal', desc: 'Dodge 25 chickens in one Reverse Day', test: r => r.revDodge >= 25 },
  { id: 'gentle', name: 'Careful Driver', desc: 'Get through a Reverse Day without hitting a single chicken', test: r => r.revClean >= 1 },
];

const Trophies = {
  got: {},        // id -> timestamp
  run: {},
  fresh: [],      // unlocked during this run (for the report)

  load() {
    const saved = Store.get('trophies', {});
    this.got = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    this.startRun();
  },

  has(id) { return !!this.got[id]; },
  get count() { return TROPHIES.filter(t => this.got[t.id]).length; },

  startRun(mode = 'normal') {
    this.run = { mode, row: 0, booms: 0, combo: 0, tornado: 0, drunkClose: 0, closeCalls: 0, trainDodge: 0, rails: 0, logChain: 0, events: 0, nights: 0, ice: 0, deer: 0, whacked: 0, irony: 0, powerTypes: 0, coins: 0 };
    this.fresh = [];
  },

  // Run counters only count in single-player (and for player one).
  add(key, n = 1) {
    if (!Game.tracksProgress()) return;
    this.run[key] = (this.run[key] || 0) + n;
    this.check();
  },
  max(key, v) {
    if (!Game.tracksProgress()) return;
    if (v > (this.run[key] || 0)) { this.run[key] = v; this.check(); }
  },

  check() {
    for (const t of TROPHIES) {
      if (this.got[t.id]) continue;
      let ok = false;
      try { ok = t.test(this.run, Stats.data); } catch (e) { ok = false; }
      if (!ok) continue;
      this.got[t.id] = Date.now();
      this.fresh.push(t);
      Store.set('trophies', this.got);
      UI.trophyToast(t);
      Sound.trophy();
    }
  },
};

// ---- Levels -------------------------------------------------------------------
// Every run earns XP. Each level pays coins, and some unlock skins.
const LEVEL_SKINS = { 3: 'silver', 5: 'robo', 8: 'neon', 12: 'diamond', 16: 'golden', 20: 'phoenix' };

const Levels = {
  xp: 0,     // total XP ever earned

  load() {
    const v = Store.get('xp', 0);
    this.xp = typeof v === 'number' && v >= 0 ? v : 0;
  },

  // XP needed to go from level l to l + 1
  cost(l) { return 100 + 60 * (l - 1); },

  // { level, into, need } for a total XP amount
  info(xp = this.xp) {
    let l = 1, left = xp;
    while (left >= this.cost(l)) { left -= this.cost(l); l++; }
    return { level: l, into: left, need: this.cost(l) };
  },

  get level() { return this.info().level; },

  // XP for a finished run.
  forRun(mode, row, coins, run) {
    const base = row + coins * 2 + (run.closeCalls || 0) * 3 + (run.events || 0) * 10 + Trophies.fresh.length * 25;
    return Math.round(base * (mode === 'hardcore' ? 1.5 : mode === 'time' ? 1.2 : 1) * (Pets.has('duck') ? 1.25 : 1) * (Pets.has('goose') ? 2 : 1));
  },

  // Add XP; returns what happened, including any level-up rewards.
  award(amount) {
    const before = this.info();
    this.xp += amount;
    Store.set('xp', this.xp);
    const after = this.info();
    const rewards = [];
    for (let l = before.level + 1; l <= after.level; l++) {
      const coins = 20 * l;
      Game.bank += coins;
      rewards.push({ level: l, coins, skin: LEVEL_SKINS[l] || null });
    }
    if (rewards.length) Store.set('coins', Game.bank);
    return { amount, before, after, rewards };
  },

  // The next level that unlocks a skin, for the "next reward" hint.
  nextSkin() {
    const l = this.level;
    for (const k of Object.keys(LEVEL_SKINS).map(Number).sort((a, b) => a - b)) if (k > l) return { level: k, skin: LEVEL_SKINS[k] };
    return null;
  },
};
