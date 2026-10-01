'use strict';
// Run upgrades: every 40 rows the game stops at a checkpoint and you pick one
// of three upgrades for the rest of the run. Most stack. Also golden runs
// (about 1 run in 40 everything turns gold and coins are worth double) and
// secret rooms (a rare manhole drops you into a vault full of coins).

const UPGRADE_CATS = {
  power:   { name: 'Power-ups', color: '#a95cff', icon: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  traffic: { name: 'Traffic',   color: '#3d9bff', icon: '<path d="M5 11l2-5h10l2 5v6h-2v2h-3v-2H10v2H7v-2H5zm2.5 0h9l-1.2-3H8.7zM7 13v2h2v-2zm8 0v2h2v-2z"/>' },
  coins:   { name: 'Coins',     color: '#e0a800', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="#fff" stroke-width="1.6" fill="none"/>' },
  defense: { name: 'Defense',   color: '#2fa84f', icon: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>' },
  move:    { name: 'Movement',  color: '#ff7a1a', icon: '<path d="M4 18h9l7-3v-3l-6 1-3-7H7l1 5-4 2z"/>' },
  score:   { name: 'Score',     color: '#ff4f8a', icon: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"/>' },
  luck:    { name: 'Luck',      color: '#17b5c9', icon: '<path d="M12 11c-1-4-6-5-6-1s5 3 6 1zm0 0c4-1 5-6 1-6s-3 5-1 6zm0 0c1 4 6 5 6 1s-5-3-6-1zm0 0c-4 1-5 6-1 6s3-5 1-6zm0 0l3 10" stroke="currentColor" stroke-width="1.2"/>' },
};

const TIER_WEIGHT = { common: 3, rare: 1.6, epic: 0.6 };

// max: how many times it stacks. ok(): whether it can be offered right now.
const UPGRADES = {
  // power-ups
  surge:      { name: 'Power Surge', cat: 'power', tier: 'common', max: 3, desc: 'Power-ups show up 60% more often', ok: () => World.powerups },
  lasting:    { name: 'Long Lasting', cat: 'power', tier: 'common', max: 3, desc: 'Power-ups last 40% longer', ok: () => World.powerups },
  overcharge: { name: 'Overcharged', cat: 'power', tier: 'common', max: 3, desc: 'Every power-up you grab also pays 5 coins' , ok: () => World.powerups },
  carepkg:    { name: 'Care Package', cat: 'power', tier: 'rare', max: 2, desc: 'A free random power-up every 30 rows (every 20 at x2)' },
  rocket:     { name: 'Rocket Boots', cat: 'power', tier: 'epic', max: 1, desc: 'A free jetpack every 45 rows' },
  // traffic
  slowcars:   { name: 'Speed Bumps', cat: 'traffic', tier: 'common', max: 3, desc: 'All traffic drives 10% slower' },
  slowtrains: { name: 'Late Trains', cat: 'traffic', tier: 'common', max: 2, desc: 'Trains and trams run 25% slower' },
  airhorn:    { name: 'Air Horn', cat: 'traffic', tier: 'rare', max: 1, desc: 'Every 15 rows you honk, and every car nearby slams its brakes' },
  sunday:     { name: 'Sunday Drivers', cat: 'traffic', tier: 'rare', max: 1, desc: 'No more reckless drivers or police chases' },
  // coins
  coinmore:   { name: 'Loose Change', cat: 'coins', tier: 'common', max: 3, desc: '50% more coins on the road' },
  piggy:      { name: 'Piggy Bank', cat: 'coins', tier: 'common', max: 3, desc: '1 in 4 coins is worth double' },
  pmagnet:    { name: 'Pocket Magnet', cat: 'coins', tier: 'common', max: 3, desc: 'Coins near you drift toward you' },
  interest:   { name: 'Interest', cat: 'coins', tier: 'rare', max: 3, desc: "At every checkpoint, get 10% of this run's coins" },
  odometer:   { name: 'Odometer', cat: 'coins', tier: 'common', max: 3, desc: '+1 coin every 10 rows' },
  haggler:    { name: 'Haggler', cat: 'coins', tier: 'rare', max: 1, desc: 'Roadside stands are half price and twice as common' },
  // defense
  bodyguard:  { name: 'Bodyguard', cat: 'defense', tier: 'common', max: 9, desc: 'Get two shields right now' },
  shieldzone: { name: 'Shield Factory', cat: 'defense', tier: 'rare', max: 1, desc: 'A free shield every time you reach a new biome' },
  secondwind: { name: 'Second Wind', cat: 'defense', tier: 'epic', max: 1, desc: 'Once, come back from any death' },
  slim:       { name: 'Slim Fit', cat: 'defense', tier: 'rare', max: 2, desc: 'A smaller hitbox against traffic' },
  lifejacket: { name: 'Life Jacket', cat: 'defense', tier: 'rare', max: 1, desc: 'Falling in the water keeps you afloat, once per biome' },
  charm:      { name: 'Lucky Charm', cat: 'defense', tier: 'epic', max: 1, desc: "Meteors, giants, the goose and lightning can't kill you" },
  // movement
  quickfeet:  { name: 'Quick Feet', cat: 'move', tier: 'common', max: 2, desc: 'You hop 15% faster' },
  headstart:  { name: 'Head Start', cat: 'move', tier: 'common', max: 3, desc: 'The danger line creeps up 20% slower' },
  // score
  bookworm:   { name: 'Bookworm', cat: 'score', tier: 'common', max: 3, desc: '+30% XP for this run' },
  steady:     { name: 'Steady Hands', cat: 'score', tier: 'common', max: 2, desc: 'Close-call combos last 50% longer' },
  feverpitch: { name: 'Fever Pitch', cat: 'score', tier: 'rare', max: 1, desc: 'Combo fever starts at x6 instead of x10' },
  daredevil:  { name: 'Daredevil', cat: 'score', tier: 'rare', max: 1, desc: 'Close calls pay a coin and double points' },
  // luck
  treasure:   { name: 'Treasure Hunter', cat: 'luck', tier: 'rare', max: 1, desc: 'Mystery boxes show up three times as often' },
  eggscout:   { name: 'Egg Scout', cat: 'luck', tier: 'rare', max: 1, desc: 'Eggs show up twice as often' },
  map:        { name: 'Treasure Map', cat: 'luck', tier: 'rare', max: 1, desc: 'Secret manholes show up three times as often' },
  bestfriend: { name: 'Best Friend', cat: 'luck', tier: 'rare', max: 1, desc: "Your pet acts like it's level 5", ok: () => !!Shop.pet && !PetLevels.maxed(Shop.pet) },
  sunny:      { name: 'Sunny Days', cat: 'luck', tier: 'common', max: 1, desc: 'Clear skies for the rest of the run' },
  gambler:    { name: 'Gambler', cat: 'luck', tier: 'epic', max: 1, desc: 'Get two more random upgrades right now' },
  extratime:  { name: 'Extra Time', cat: 'luck', tier: 'common', max: 9, desc: '+15 seconds on the clock', ok: () => Game.mode === 'time' },
};

const CHECKPOINT = 40; // rows between upgrade picks

const Upgrades = {
  picks: {},
  order: [],
  next: CHECKPOINT,
  offer: null,
  wind: false,      // Second Wind used
  jacketZone: null, // the biome the life jacket was last used in

  reset() {
    this.picks = {};
    this.order = [];
    this.next = CHECKPOINT;
    this.offer = null;
    this.wind = false;
    this.jacketZone = null;
  },

  allowed() { return Game.players.length === 1 && Game.tracksProgress(); },
  n(id) { return this.picks[id] || 0; },
  has(id) { return !!this.picks[id]; },
  get count() { return this.order.length; },

  // Can this one be offered right now?
  avail(id) {
    const u = UPGRADES[id];
    return this.n(id) < u.max && (!u.ok || u.ok());
  },

  // Three different upgrades, rarer tiers less often.
  roll(k = 3, not = []) {
    const pool = Object.keys(UPGRADES).filter(id => this.avail(id) && !not.includes(id));
    const out = [];
    while (out.length < k && pool.length) {
      const id = weighted(pool.map(i => [i, TIER_WEIGHT[UPGRADES[i].tier]]));
      out.push(id);
      pool.splice(pool.indexOf(id), 1);
    }
    return out;
  },

  // Called whenever player one reaches a new row.
  onRow(p) {
    if (!this.allowed() || p.id !== 0 || Game.state !== 'playing') return;
    const r = p.maxRow;
    if (this.has('odometer') && r % 10 === 0) Game.giveCoins(this.n('odometer'), p, `ODOMETER +${this.n('odometer')}`);
    if (this.has('carepkg') && r % (this.n('carepkg') > 1 ? 20 : 30) === 0) {
      const types = Object.keys(POWERUPS).filter(k => k !== 'jetpack');
      Powers.grant(pick(types), { x: p.x, y: p.y }, p, true);
      FX.text(p.x, p.y + 60, 'CARE PACKAGE!', '#c79bff', 15);
    }
    if (this.has('airhorn') && r % 15 === 0) Powers.horn(p);
    if (this.has('rocket') && r % 45 === 0 && !p.hop && !p.ride) Powers.grant('jetpack', { x: p.x, y: p.y }, p, true);
    if (r >= this.next) {
      this.next += CHECKPOINT;
      this.open(p);
    }
  },

  open(p = Player) {
    if (this.has('interest') && p.coins > 0) {
      const n = Math.max(1, Math.round(p.coins * 0.1 * this.n('interest')));
      Game.giveCoins(n, p, `INTEREST +${n}`, '#7ed957');
    }
    this.offer = this.roll();
    if (!this.offer.length) return;
    Game.state = 'upgrade';
    Sound.mission();
    UI.showUpgrade(this.offer, p.maxRow);
  },

  choose(i) {
    if (Game.state !== 'upgrade' || !this.offer || !this.offer[i]) return;
    const id = this.offer[i];
    this.offer = null;
    UI.showUpgrade(null);
    Game.state = 'playing';
    Game.last = performance.now();
    this.apply(id);
    Sound.powerup();
  },

  apply(id, quiet = false) {
    this.picks[id] = this.n(id) + 1;
    this.order.push(id);
    Roadex.see('upgrades', id);
    const p = Player;
    if (!quiet) FX.text(p.x, p.y + 44, UPGRADES[id].name.toUpperCase() + (this.n(id) > 1 ? ` x${this.n(id)}` : ''), UPGRADE_CATS[UPGRADES[id].cat].color, 18);
    if (id === 'bodyguard') { p.shield += 2; FX.text(p.x, p.y + 26, `x${p.shield} SHIELDS`, '#8fd0ff', 15); }
    if (id === 'extratime') Game.timeLeft = Math.min(120, Game.timeLeft + 15);
    if (id === 'haggler') for (const it of Items.list) if (it.type === 'stand' && !it.sold) it.price = Math.ceil(it.price / 2);
    if (id === 'gambler') {
      for (const g of this.roll(2, ['gambler'])) {
        this.apply(g, true);
        UI.toast('t-upgrade', `GAMBLER: ${UPGRADES[g].name.toUpperCase()}`, UPGRADES[g].desc, 3200);
      }
    }
    if (Game.tracksProgress()) {
      Trophies.max('upgrades', this.order.length);
      Stats.add('upgrades');
    }
  },

  // ---- Hooks for the other systems ----
  traffic() { return 1 - 0.1 * this.n('slowcars'); },
  trains() { return 1 - 0.25 * this.n('slowtrains'); },
  danger() { return 1 - 0.2 * this.n('headstart'); },
  powerBoost() { return 1 + 0.4 * this.n('lasting'); },
  hop() { return 1 - 0.15 * this.n('quickfeet'); },
  xp() { return 1 + 0.3 * this.n('bookworm'); },
  combo() { return 3 * (1 + 0.5 * this.n('steady')); },
  fever() { return this.has('feverpitch') ? 6 : 10; },
  slim() { return this.n('slim'); },

  // Second Wind: back on your feet somewhere safe.
  saves(p, source) {
    if (p.id !== 0 || !this.has('secondwind') || this.wind) return false;
    this.wind = true;
    Pets.respawn(p);
    for (let i = 0; i < 40; i++) {
      const a = rand(6.2832), sp = rand(60, 220);
      FX.spawn('glow', p.x, p.y, rand(4, 24), { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rand(30, 120), drag: 2, life: rand(0.5, 0.9), size: rand(3, 6), size2: 0.5, color: pick(['#ffffff', '#9fe7ff', '#7ed957']) });
    }
    FX.flashScreen(0.5, '200,255,220');
    Cam.addTrauma(0.4);
    Game.slowmo(0.35, 0.6);
    Sound.rebirth();
    FX.text(p.x, p.y + 44, 'SECOND WIND!', '#7ed957', 20);
    UI.toast('t-upgrade', 'SECOND WIND', 'Back on your feet. That was your one', 3200);
    return true;
  },

  // Lucky Charm: secret events can't kill you.
  shrugs(p, source) {
    if (p.id !== 0 || !this.has('charm') || !['meteor', 'giant', 'goose', 'lightning'].includes(source)) return false;
    if (p.grace <= 0) {
      FX.shieldBreak(p.x, p.y);
      FX.text(p.x, p.y + 30, 'LUCKY CHARM!', '#7ed957', 17);
      Sound.shieldBreak();
    }
    p.grace = Math.max(p.grace, 1.5);
    return true;
  },

  // Life jacket: a float under you, once per biome.
  jacket(p, row) {
    if (p.id !== 0 || !this.has('lifejacket') || Admin.god) return null;
    const z = World.zoneAt(p.row);
    if (this.jacketZone === z) return null;
    this.jacketZone = z;
    const ring = { kind: 'log', id: ++River.ids, len: 0.95 * TILE, x: p.x, y: row.y, bob: 0, dir: row.river.dir, style: 'turtle' };
    row.river.logs.push(ring);
    FX.text(p.x, p.y + 30, 'LIFE JACKET!', '#ff9f1c', 16);
    FX.splash(p.x, p.y, 10);
    return ring;
  },
};

// ---- Golden runs -----------------------------------------------------------------
const GOLD_CARS = ['#ffd23f', '#f0b400', '#ffe066', '#e8a800'];

const Golden = {
  active: false,
  force: false,

  reset() { this.active = false; },

  roll() {
    this.active = Game.players.length === 1 && Game.tracksProgress() && (this.force || Math.random() < 1 / 40);
    this.force = false;
    if (!this.active) return;
    for (const row of World.rows.values()) { // everything already on the road turns gold too
      if (row.type !== 'road') continue;
      for (const v of row.lane.vehicles) this.paint(v);
    }
    UI.toast('t-golden', 'GOLDEN RUN!', 'Everything turned to gold. Coins are worth double', 4200);
    Sound.fever(true);
    FX.flashScreen(0.4, '255,215,80');
    Roadex.see('specials', 'golden');
    Stats.add('goldenRuns');
    Trophies.add('golden');
  },

  paint(v) {
    if (v.animal || v.responder || v.police) return;
    v.base = pick(GOLD_CARS);
    v.pal = Draw.vehiclePalette(v.base);
  },

  mult() { return this.active ? 2 : 1; },

  // Golden edges and drifting sparkles.
  drawScreen(c, W, H, time) {
    if (!this.active || Game.state === 'title') return;
    Renderer.vignette(c, `rgba(255,205,60,${0.22 + 0.05 * Math.sin(time * 2)})`);
    c.fillStyle = 'rgba(255,220,100,0.05)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,240,170,0.8)';
    for (let k = 0; k < 18; k++) {
      const x = ((k * 137.5 + time * (12 + (k % 5) * 4)) % (W + 20)) - 10;
      const y = ((k * 91.3 - time * (18 + (k % 3) * 9)) % H + H) % H;
      const s = 1.5 + (k % 3) + Math.sin(time * 4 + k) * 0.8;
      c.fillRect(x - s / 2, y - s / 2, s, s);
    }
  },
};

// ---- Secret rooms ------------------------------------------------------------------
// A manhole on the grass: step on it and you drop into a vault for 9 seconds.
const ROOM = { COLS: 9, ROWS: 6, DUR: 9, FADE: 0.45 };

const SecretRoom = {
  active: false,
  phase: 'off', // off | in | play | out
  t: 0,
  cells: [],
  texts: [],

  canSpawn(rowI) { return Game.players.length === 1 && rowI > 25 && !Reverse.active; },

  reset() {
    this.active = false;
    this.phase = 'off';
    this.cells.length = 0;
    this.texts.length = 0;
  },

  // Is the room what's on screen (rather than the road)?
  get shown() {
    if (!this.active) return false;
    if (this.phase === 'in') return this.t >= ROOM.FADE;
    if (this.phase === 'out') return this.t < ROOM.FADE;
    return true;
  },

  enter(p, it) {
    if (this.active || p.id !== 0) return;
    this.active = true;
    this.phase = 'in';
    this.t = 0;
    this.hole = it;
    this.got = 0;
    this.kind = chance(0.25) ? 'treasure' : 'vault';
    this.build();
    this.pc = Math.floor(ROOM.COLS / 2);
    this.pr = 0;
    this.hop = null;
    this.facing = 'up';
    p.queue = null;
    Sound.whistle();
    Roadex.see('specials', 'room');
    if (Game.tracksProgress()) { Stats.add('rooms'); Trophies.check(); }
  },

  build() {
    this.cells.length = 0;
    this.texts.length = 0;
    const mid = Math.floor(ROOM.COLS / 2);
    const gem = [randInt(0, ROOM.COLS - 1), randInt(3, ROOM.ROWS - 1)];
    for (let r = 0; r < ROOM.ROWS; r++) {
      for (let c = 0; c < ROOM.COLS; c++) {
        if (r === 0 && c === mid) continue; // the ladder
        let type = null;
        if (this.kind === 'treasure' && r === ROOM.ROWS - 1 && c === mid) type = 'box';
        else if (c === gem[0] && r === gem[1]) type = 'gem';
        else if (chance(0.1)) type = 'bar';
        else if (chance(0.55)) type = 'coin';
        if (type) this.cells.push({ c, r, type, phase: rand(6.28), x: (c - mid) * TILE, y: r * TILE });
      }
    }
  },

  input(dx, dy) {
    if (this.phase !== 'play') return;
    if (this.hop) { this.queue = [dx, dy]; return; }
    this.move(dx, dy);
  },

  move(dx, dy) {
    this.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'up' : 'down';
    const nc = this.pc + dx, nr = this.pr + dy;
    if (nc < 0 || nc >= ROOM.COLS || nr < 0 || nr >= ROOM.ROWS) { Sound.bump(); return; }
    this.hop = { fc: this.pc, fr: this.pr, t: 0 };
    this.pc = nc;
    this.pr = nr;
    Sound.hop(false);
  },

  // Grab whatever is on the cell you landed on.
  collect() {
    const i = this.cells.findIndex(o => o.c === this.pc && o.r === this.pr);
    if (i < 0) return;
    const o = this.cells.splice(i, 1)[0];
    const mid = Math.floor(ROOM.COLS / 2);
    const x = (this.pc - mid) * TILE, y = this.pr * TILE;
    if (o.type === 'box') {
      Boxes.pickup(Player, { x, y });
      this.texts.push({ x, y, s: 'MYSTERY BOX!', color: '#c79bff', t: 0 });
      return;
    }
    const base = o.type === 'gem' ? 20 : o.type === 'bar' ? 5 : 1;
    const n = base * (Game.modeDef().coinMult || 1) * Golden.mult();
    Player.coins += n;
    Game.coins = Player.coins;
    this.got += n;
    Trophies.max('coins', Player.coins);
    Missions.add('coins', base);
    this.texts.push({ x, y, s: `+${n}`, color: o.type === 'gem' ? '#9fe7ff' : '#ffd23f', t: 0 });
    if (o.type === 'gem') Sound.cash(); else Sound.coin();
  },

  update(dt) {
    this.t += dt;
    for (let i = this.texts.length - 1; i >= 0; i--) if ((this.texts[i].t += dt) > 0.8) this.texts.splice(i, 1);
    if (this.phase === 'in') {
      if (this.t >= ROOM.FADE * 2) { this.phase = 'play'; this.t = 0; }
      return;
    }
    if (this.phase === 'play') {
      if (this.hop) {
        this.hop.t += dt / 0.11;
        if (this.hop.t >= 1) {
          this.hop = null;
          this.collect();
          if (this.queue) { const q = this.queue; this.queue = null; this.move(q[0], q[1]); }
        }
      }
      if (this.t >= ROOM.DUR || !this.cells.length) { this.phase = 'out'; this.t = 0; Sound.whistle(); }
      return;
    }
    if (this.phase === 'out' && this.t >= ROOM.FADE * 2) this.finish();
  },

  finish() {
    this.active = false;
    this.phase = 'off';
    const it = this.hole;
    const k = Items.list.indexOf(it);
    if (k >= 0) Items.list.splice(k, 1);
    Player.grace = Math.max(Player.grace, 1.5);
    Player.queue = null;
    UI.toast('t-room', 'SECRET ROOM', this.got ? `You grabbed ${this.got} coins down there` : 'Nothing but rats', 3200);
    FX.dust(Player.x, Player.y, 10);
  },

  // The manhole on the road: an iron lid with a faint glint of gold under it.
  drawHole(c, o, time) {
    const y = P(0, 4.5);
    c.fillStyle = '#2b2d33';
    c.beginPath(); c.ellipse(0, y, 15, 15 * GY, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#5a5f69';
    c.beginPath(); c.ellipse(0, y - 1, 13, 13 * GY, 0, 0, 6.2832); c.fill();
    c.strokeStyle = '#3e424a';
    c.lineWidth = 1;
    for (const r of [5, 9]) { c.beginPath(); c.ellipse(0, y - 1, r, r * GY, 0, 0, 6.2832); c.stroke(); }
    c.beginPath(); c.moveTo(-13, y - 1); c.lineTo(13, y - 1); c.moveTo(0, y - 1 - 13 * GY); c.lineTo(0, y - 1 + 13 * GY); c.stroke();
    const k = (Math.sin(time * 2.5 + o.phase) + 1) / 2;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,210,80,${0.12 + 0.18 * k})`;
    c.beginPath(); c.ellipse(0, y - 1, 16, 16 * GY, 0, 0, 6.2832); c.fill();
    c.restore();
    if (((time * 1.3 + o.phase) % 2) < 0.18) { c.fillStyle = '#fff6b0'; c.fillRect(6, y - 6, 2, 2); }
  },

  // A black fade between the road and the room.
  fade() {
    if (!this.active) return 0;
    if (this.phase === 'in') return clamp(1 - Math.abs(this.t - ROOM.FADE) / ROOM.FADE, 0, 1);
    if (this.phase === 'out') return clamp(1 - Math.abs(this.t - ROOM.FADE) / ROOM.FADE, 0, 1);
    return 0;
  },

  drawFade(c, W, H) {
    const a = this.fade();
    if (a <= 0) return;
    c.fillStyle = `rgba(0,0,0,${a})`;
    c.fillRect(0, 0, W, H);
  },

  draw(c, time) {
    const R = Renderer, W = R.W, H = R.H;
    const mid = Math.floor(ROOM.COLS / 2);
    const gold = this.kind === 'treasure';
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.fillStyle = '#0e0c0b';
    c.fillRect(0, 0, W, H);
    const k = Math.min(W / ((ROOM.COLS + 2) * TILE), H / ((ROOM.ROWS + 4) * TILE * GY + 60));
    c.translate(W / 2, H * 0.56);
    c.scale(k, k);
    c.translate(0, (ROOM.ROWS - 1) * TILE * GY * 0.5);
    const x0 = (-mid - 0.5) * TILE, x1 = (mid + 0.5) * TILE, yB = -0.5 * TILE, yT = (ROOM.ROWS - 0.5) * TILE;
    // floor
    for (let r = ROOM.ROWS - 1; r >= 0; r--) {
      for (let col = 0; col < ROOM.COLS; col++) {
        const even = (r + col) & 1;
        c.fillStyle = gold ? (even ? '#4a3a5e' : '#41334f') : (even ? '#57504a' : '#4c4641');
        c.fillRect((col - mid - 0.5) * TILE, P((r + 0.5) * TILE, 0), TILE + 0.5, TILE * GY + 0.5);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let r = 0; r <= ROOM.ROWS; r++) c.fillRect(x0, P((r - 0.5) * TILE, 0) - 0.5, x1 - x0, 1);
    // walls: the back and the two sides, brick
    const wallTop = gold ? '#6b5a80' : '#7a6a5c', wallFront = gold ? '#4f4163' : '#5e5046';
    Draw.box(c, x0 - 0.4 * TILE, x0, yB, yT + 0.4 * TILE, 0, 1.4 * TILE, wallTop, wallFront);
    Draw.box(c, x1, x1 + 0.4 * TILE, yB, yT + 0.4 * TILE, 0, 1.4 * TILE, wallTop, wallFront);
    Draw.box(c, x0, x1, yT, yT + 0.4 * TILE, 0, 1.4 * TILE, wallTop, wallFront);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let z = 8; z < 1.4 * TILE; z += 8) c.fillRect(x0, P(yT, z), x1 - x0, 1);
    for (let z = 0, n = 0; z < 1.4 * TILE; z += 8, n++) for (let x = x0 + (n & 1 ? 8 : 0); x < x1; x += 16) c.fillRect(x, P(yT, z + 8), 1, 8 * GZ);
    // torches on the back wall
    for (const tx of [x0 + 1.5 * TILE, x1 - 1.5 * TILE]) {
      const fl = Math.sin(time * 13 + tx) * 1.5;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(tx, P(yT, 40), 0, tx, P(yT, 40), 70);
      g.addColorStop(0, 'rgba(255,170,60,0.4)');
      g.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = g;
      c.fillRect(tx - 70, P(yT, 40) - 70, 140, 140);
      c.restore();
      c.fillStyle = '#3a2a1a';
      c.fillRect(tx - 1.5, P(yT, 36), 3, 10);
      c.fillStyle = '#ff9a2a';
      c.beginPath(); c.ellipse(tx, P(yT, 40) - fl, 3.5, 6 + fl, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#ffe27a';
      c.beginPath(); c.ellipse(tx, P(yT, 39) - fl, 1.8, 3.5, 0, 0, 6.2832); c.fill();
    }
    // light falling through the manhole onto the ladder
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,250,220,0.10)';
    c.beginPath(); c.ellipse(0, P(0, 0), 20, 20 * GY, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,250,220,0.05)';
    c.beginPath(); c.moveTo(-26, P(0, 0)); c.lineTo(-10, -H); c.lineTo(10, -H); c.lineTo(26, P(0, 0)); c.fill();
    c.restore();
    // where you came down: a drain grate in a pool of light
    c.fillStyle = '#2b2d33';
    c.beginPath(); c.ellipse(0, P(0, 0.5), 13, 13 * GY, 0, 0, 6.2832); c.fill();
    c.strokeStyle = '#5a5f69';
    c.lineWidth = 1.2;
    for (let x = -9; x <= 9; x += 4.5) { c.beginPath(); c.moveTo(x, P(-9, 0.5)); c.lineTo(x, P(9, 0.5)); c.stroke(); }

    // loot and you, back to front
    const list = this.cells.slice();
    const h = this.hop, e = h ? easeOutQuad(Math.min(1, h.t)) : 1;
    const px = h ? lerp((h.fc - mid) * TILE, (this.pc - mid) * TILE, e) : (this.pc - mid) * TILE;
    const py = h ? lerp(h.fr * TILE, this.pr * TILE, e) : this.pr * TILE;
    const pz = h ? Math.sin(Math.PI * Math.min(1, h.t)) * 0.3 * TILE : 0;
    list.push({ type: 'me', x: px, y: py - 0.1 });
    list.sort((a, b) => b.y - a.y);
    for (const o of list) {
      c.save();
      c.translate(o.x, P(o.y, 0));
      if (o.type === 'me') {
        Draw.shadow(c, 0, 0, 26, 20, 0.8);
        Draw.player(c, { facing: this.facing, squash: 0, z: pz, rot: 0, flap: h ? 1 : 0, char: 0, blinkSeed: 0 }, time, Shop.skin(), Shop.hat);
      } else if (o.type === 'coin') Draw.coin(c, o, time);
      else if (o.type === 'box') Draw.mysteryBox(c, o, time);
      else if (o.type === 'bar') {
        Draw.shadow(c, 0, 0, 22, 14, 0.6);
        Draw.box(c, -9, 9, -5, 5, 2, 9, '#ffe066', '#e0a800');
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fillRect(-6, P(-5, 9) + 1, 5, 1.5);
      } else if (o.type === 'gem') {
        const z = 14 + Math.sin(time * 3 + o.phase) * 3;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(120,220,255,0.3)';
        c.beginPath(); c.arc(0, P(0, z), 18, 0, 6.2832); c.fill();
        c.restore();
        FX.glyph(c, 'diamond', 0, P(0, z), 11, '#9fe7ff', 0);
      }
      c.restore();
    }
    // floating numbers
    c.textAlign = 'center';
    c.font = `900 14px ${UI_FONT}`;
    for (const tx of this.texts) {
      c.globalAlpha = 1 - tx.t / 0.8;
      c.fillStyle = '#1d1b18';
      c.fillText(tx.s, tx.x + 1, P(tx.y, 30 + tx.t * 40) + 1);
      c.fillStyle = tx.color;
      c.fillText(tx.s, tx.x, P(tx.y, 30 + tx.t * 40));
    }
    c.globalAlpha = 1;

    // the clock and the haul, in screen space
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const left = this.phase === 'play' ? 1 - this.t / ROOM.DUR : this.phase === 'in' ? 1 : 0;
    const bw = Math.min(320, W - 60), bx = (W - bw) / 2, by = 22 + (R.safeTop || 0);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(bx - 4, by - 4, bw + 8, 46);
    c.fillStyle = gold ? '#c79bff' : '#ffd23f';
    c.textAlign = 'center';
    c.font = `900 15px ${UI_FONT}`;
    c.fillText(gold ? 'SECRET TREASURE ROOM' : 'SECRET VAULT', W / 2, by + 13);
    c.fillStyle = '#2a2622';
    c.fillRect(bx, by + 24, bw, 10);
    c.fillStyle = left < 0.25 ? '#ff5a4f' : '#7ed957';
    c.fillRect(bx, by + 24, bw * clamp(left, 0, 1), 10);
    c.font = `800 13px ${UI_FONT}`;
    c.fillStyle = '#ffe9b0';
    c.fillText(`Grab what you can! +${this.got} coins`, W / 2, H - 28);
    this.drawFade(c, W, H);
  },
};
