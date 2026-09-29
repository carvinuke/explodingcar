'use strict';
// Admin panel (a cheat menu). Open it by tapping the "EXIT 1" tab on the
// title sign 7 times. Once opened it's also on the pause menu for the rest
// of the session.

const Admin = {
  unlocked: false,
  god: false,
  noDanger: false,
  weather: null, // forced weather type, or null
  taps: 0,
  lastTap: 0,
  pausedIt: false,

  init() {
    const tab = document.querySelector('.exit-tab');
    tab.addEventListener('pointerdown', e => e.stopPropagation());
    tab.addEventListener('click', () => this.tap(tab));
    UI.$('btn-pause-admin').addEventListener('click', () => this.open());
    UI.$('screen-admin').addEventListener('click', e => { if (e.target.id === 'screen-admin') UI.closeModal(); });
    this.build();
  },

  tap(tab) {
    const now = performance.now();
    this.taps = now - this.lastTap < 1500 ? this.taps + 1 : 1;
    this.lastTap = now;
    tab.classList.remove('tapped');
    void tab.offsetWidth;
    tab.classList.add('tapped');
    if (this.taps >= 7) {
      this.taps = 0;
      this.unlocked = true;
      Sound.init();
      Sound.trophy();
      this.open();
    }
  },

  open() {
    if (!this.unlocked) return;
    this.refresh();
    UI.openModal('admin', 'screen-admin', 'admin-close');
  },

  // Closing the panel resumes a run it paused.
  closed() {
    if (this.pausedIt && Game.state === 'paused') Game.togglePause(false);
    this.pausedIt = false;
  },

  // Actions that need a run in progress start one (paused behind the panel).
  ensureRun() {
    if (Game.state === 'title' || Game.state === 'gameover') {
      Game.start('normal');
      Game.togglePause(true);
      this.pausedIt = true;
    } else if (Game.state === 'playing') {
      Game.togglePause(true);
      this.pausedIt = true;
    }
    return Game.state === 'paused';
  },

  flash(msg) {
    const el = UI.$('admin-status');
    el.textContent = msg;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    Sound.click();
  },

  // ---- Actions ------------------------------------------------------------------
  setCoins(n) {
    Game.bank = Math.max(0, Math.min(1e9, Math.floor(n)));
    Store.set('coins', Game.bank);
    UI.refreshMeta();
    this.flash(`Coins set to ${Game.bank.toLocaleString()}`);
  },

  setLevel(l) {
    l = Math.max(1, Math.min(200, Math.floor(l)));
    let xp = 0;
    for (let k = 1; k < l; k++) xp += Levels.cost(k);
    Levels.xp = xp;
    Store.set('xp', xp);
    UI.refreshMeta();
    this.flash(`Level set to ${l}`);
  },

  unlockAll() {
    for (const tab in SHOP_TABS) {
      Shop.owned[tab] = Object.keys(SHOP_TABS[tab]).filter(id => !SHOP_TABS[tab][id].unlock && !SHOP_TABS[tab][id].level);
      Store.set(tab, Shop.owned[tab]);
    }
    for (const t of TROPHIES) if (!Trophies.got[t.id]) Trophies.got[t.id] = Date.now();
    Store.set('trophies', Trophies.got);
    if (Levels.level < 20) this.setLevel(20);
    UI.refreshMeta();
    this.flash('Unlocked every skin, hat, trail and trophy');
  },

  resetProgress(btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = 'Tap again to wipe everything';
      setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Reset all progress'; }, 3000);
      return;
    }
    for (const k of ['coins', 'xp', 'skins', 'hats', 'trails', 'skin', 'hat', 'trail', 'trophies', 'stats', 'best', 'best.hardcore', 'best.time', 'missions', 'missionsDone', 'runs', 'ghost.best', 'ghost.hardcore', 'ghost.time']) {
      try { localStorage.removeItem('roadrush.' + k); } catch (e) { /* ignore */ }
    }
    location.reload();
  },

  power(type) {
    if (!this.ensureRun()) return;
    for (const p of Game.players) if (p.alive) Powers.grant(type, { x: p.x, y: p.y }, p);
    this.flash(`${POWERUPS[type].name} granted`);
  },

  maxPowers() {
    if (!this.ensureRun()) return;
    for (const p of Game.players) {
      if (!p.alive) continue;
      p.shield = true;
      for (const k of ['speed', 'magnet', 'invincible']) p.pw[k] = 60;
    }
    this.flash('Every power-up for 60 seconds');
  },

  event(type) {
    if (!this.ensureRun()) return;
    Events.end(true);
    this.after(() => { Events.start(type); });
    this.flash(`${EVENT_DEFS[type].name} coming up`);
  },

  // Run something the moment the game resumes (so it happens on screen).
  after(fn) {
    const wait = () => { if (Game.state === 'playing') fn(); else setTimeout(wait, 50); };
    wait();
  },

  hazard(kind) {
    if (!this.ensureRun()) return;
    const run = {
      tornado: () => Storms.spawnTwister(),
      lightning: () => { for (let k = 0; k < 3; k++) Storms.mark(); },
      drunk: () => Vehicles.spawnDrunk(),
      cow: () => Animals.spawnCow() || this.flash('No road ahead for a cow'),
      deer: () => Animals.spawnDeer() || this.flash('No road ahead for deer'),
      gull: () => Animals.spawnGull(),
      crash: () => { Vehicles.directorT = 0; },
    }[kind];
    this.after(run);
    this.flash({ tornado: 'Tornado incoming', lightning: 'Lightning incoming', drunk: 'Drunk driver incoming', cow: 'Cow incoming', deer: 'Deer incoming', gull: 'Seagull incoming', crash: 'Reckless driver incoming' }[kind]);
  },

  setWeather(type) {
    this.weather = type === 'auto' ? null : type;
    this.flash(type === 'auto' ? 'Weather back to normal' : `Weather: ${type}`);
  },

  setTime(ph) {
    if (!this.ensureRun()) return;
    // Game.time drives the day; jump it to the requested phase of the current day
    const cur = (CYCLE_START + Game.time / CYCLE) % 1;
    let d = ph - cur;
    if (d < 0) d += 1;
    Game.time += d * CYCLE;
    this.flash({ 0.2: 'Morning', 0.5: 'Sunset', 0.7: 'Night' }[ph] || 'Time changed');
  },

  // Jump ahead: into a biome, or a number of rows.
  teleportTo(row) {
    const p = Player;
    World.ensure(row + 30);
    let r = row;
    while (World.rows.get(r) && World.rows.get(r).type !== 'grass') r++;
    const R = World.rows.get(r);
    let col = p.col;
    if (World.isBlocked(col, r)) for (let c = 0; c < COLS; c++) if (!World.isBlocked(c, r)) { col = c; break; }
    for (const q of Game.players) {
      q.hop = q.knock = q.queue = q.abduct = null;
      q.ride = null;
      q.row = r;
      q.col = q === p ? col : clamp(col + 1, 0, COLS - 1);
      q.x = cellX(q.col);
      q.y = R.y;
      q.z = 0;
      q.maxRow = Math.max(q.maxRow, r);
    }
    Game.danger.y = Math.max(Game.danger.y, (r - 7) * TILE);
    Cam.y = p.y + 0.5 * TILE;
    World.cull(r - 25);
    Game.updateScore();
  },

  goZone(z) {
    if (!this.ensureRun()) return;
    let r = Math.max(Player.row + 1, FIRST_ZONE);
    if (z === 'country' && World.zoneAt(Player.row) === 'country') { this.flash('Already in the countryside'); return; }
    while (World.zoneAt(r) !== z && r < Player.row + 3000) r++;
    this.teleportTo(r + 3);
    this.flash(`Jumped to ${ZONES[z].name.toLowerCase()}`);
  },

  skip(n) {
    if (!this.ensureRun()) return;
    this.teleportTo(Player.row + n);
    this.flash(`Jumped ${n} rows ahead`);
  },

  toggle(key) {
    this[key] = !this[key];
    this.refresh();
    this.flash(`${key === 'god' ? 'God mode' : 'No danger line'} ${this[key] ? 'on' : 'off'}`);
  },

  // Called every frame by the game.
  update() {
    if (!this.god) return;
    for (const p of Game.players) {
      if (!p.alive) continue;
      p.pw.invincible = Math.max(p.pw.invincible, 0.5);
      p.x = clamp(p.x, 0.3 * TILE, WORLD_W - 0.3 * TILE); // can't be swept away
    }
  },

  // ---- Panel ---------------------------------------------------------------------
  build() {
    const box = UI.$('admin-body');
    const section = title => {
      const h = document.createElement('p');
      h.className = 'admin-head';
      h.textContent = title;
      const row = document.createElement('div');
      row.className = 'admin-row';
      box.append(h, row);
      return row;
    };
    const btn = (row, label, fn, cls = '') => {
      const b = document.createElement('button');
      b.className = 'admin-btn ' + cls;
      b.textContent = label;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', () => fn(b));
      row.appendChild(b);
      return b;
    };
    const numberField = (row, id, placeholder, label, fn) => {
      const wrap = document.createElement('label');
      wrap.className = 'admin-field';
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      input.id = id;
      input.min = '0';
      input.placeholder = placeholder;
      input.inputMode = 'numeric';
      input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fn(Number(input.value) || 0); });
      wrap.append(span, input);
      row.appendChild(wrap);
      btn(row, 'Set', () => fn(Number(input.value) || 0), 'go');
    };

    let r = section('Toggles');
    this.godBtn = btn(r, 'God mode', () => this.toggle('god'), 'flip');
    this.dangerBtn = btn(r, 'No danger line', () => this.toggle('noDanger'), 'flip');

    r = section('Coins');
    numberField(r, 'admin-coins', 'e.g. 5000', 'Amount', n => this.setCoins(n));
    for (const n of [1000, 10000, 1000000]) btn(r, `+${n.toLocaleString()}`, () => this.setCoins(Game.bank + n));

    r = section('Level and unlocks');
    numberField(r, 'admin-level', 'e.g. 20', 'Level', n => this.setLevel(n));
    btn(r, 'Unlock everything', () => this.unlockAll(), 'gold');

    r = section('Power-ups (now)');
    for (const k in POWERUPS) btn(r, POWERUPS[k].name, () => this.power(k));
    btn(r, 'All of them', () => this.maxPowers(), 'gold');

    r = section('Secret events');
    for (const k in EVENT_DEFS) btn(r, EVENT_DEFS[k].name.replace(/^THE /, '').toLowerCase().replace(/^\w/, ch => ch.toUpperCase()).replace(/^Ufo/, 'UFO'), () => this.event(k));

    r = section('Hazards');
    for (const [k, label] of [['tornado', 'Tornado'], ['lightning', 'Lightning'], ['drunk', 'Drunk driver'], ['crash', 'Reckless driver'], ['cow', 'Cow'], ['deer', 'Deer'], ['gull', 'Seagull']]) btn(r, label, () => this.hazard(k));

    r = section('Weather and time');
    for (const w of ['auto', 'clear', 'rain', 'snow', 'dust']) btn(r, w === 'auto' ? 'Weather: auto' : w[0].toUpperCase() + w.slice(1), () => this.setWeather(w));
    for (const [ph, label] of [[0.2, 'Morning'], [0.5, 'Sunset'], [0.7, 'Night']]) btn(r, label, () => this.setTime(ph));

    r = section('Travel');
    for (const z of Object.keys(ZONES)) btn(r, ZONES[z].name.replace(/^THE /, '').toLowerCase().replace(/^\w/, ch => ch.toUpperCase()), () => this.goZone(z));
    btn(r, '+25 rows', () => this.skip(25));
    btn(r, '+100 rows', () => this.skip(100));

    r = section('Danger zone');
    btn(r, 'Reset all progress', b => this.resetProgress(b), 'danger');
  },

  refresh() {
    this.godBtn.setAttribute('aria-pressed', this.god ? 'true' : 'false');
    this.dangerBtn.setAttribute('aria-pressed', this.noDanger ? 'true' : 'false');
    UI.$('admin-coins').value = Game.bank;
    UI.$('admin-level').value = Levels.level;
    UI.$('admin-status').textContent = `Coins ${Game.bank.toLocaleString()} · Level ${Levels.level}`;
  },
};
