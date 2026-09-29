'use strict';
// Game state, modes, main loop, scoring, deaths, weather and biomes, and the
// glue between systems.

const CAUSES = {
  vehicle: (g, v) => `${g ? 'Flattened' : 'Hit'} by ${v.drunk ? 'a drunk driver' : VEHICLE_TYPES[v.type].name}`,
  train: (g, R) => (R && R.tram ? (g ? 'Obliterated by a tram' : 'Hit by a tram') : g ? 'Obliterated by a freight train' : 'Hit by a train'),
  drown: g => (g ? 'Eaten alive by piranhas' : 'Fell in the river'),
  swept: g => (g ? 'Swept downstream and eaten by piranhas' : 'Swept away by the river'),
  danger: () => 'Left behind',
  meteor: g => (g ? 'Vaporized by a meteor' : 'Hit by a meteor'),
  giant: g => (g ? 'Squashed flat by a giant chicken' : 'Stepped on by a giant chicken'),
  goose: g => (g ? 'Torn apart by the giant goose' : 'Caught by the giant goose'),
  pit: () => 'Fell into a construction pit',
  lightning: g => (g ? 'Fried by lightning' : 'Struck by lightning'),
};

const MODES = {
  normal:   { name: 'Endless', best: 'best', ghost: 'best' },
  hardcore: { name: 'Hardcore', best: 'best.hardcore', ghost: 'hardcore', offset: 90, speedMul: 1.2, gapMul: 0.8, powerups: false, coinMult: 2, danger: 1.35, crashRate: 0.75 },
  time:     { name: 'Time attack', best: 'best.time', ghost: 'time', limit: 90 },
  versus:   { name: 'Two players', players: 2 },
};

const Game = {
  state: 'title', // title | playing | paused | dying | replay | gameover
  mode: 'normal',
  players: [Player],
  time: 0,
  timeScale: 1,
  slow: { t: 0, scale: 1 },
  score: 0,
  coins: 0,
  best: Store.get('best', 0),
  bank: Store.get('coins', 0),
  runs: Store.get('runs', 0),
  danger: { y: -7 * TILE, active: false },
  weather: { type: 'clear', amt: 0 },
  zone: 'country',
  skidCooldown: 0,
  lastBoom: -9,
  deathT: 0,
  overT: 0,
  cause: '',
  newBest: false,
  goreDeath: false,
  timeLeft: 0,
  timerOn: false,
  versusWins: [0, 0],
  winner: null,

  init() {
    Stats.load();
    Trophies.load();
    Levels.load();
    Shop.load();
    Renderer.init(document.getElementById('view'));
    Lighting.init();
    Replay.init();
    Missions.load();
    UI.init();
    Admin.init();
    Input.init();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.togglePause(true); });
    addEventListener('blur', () => this.togglePause(true));
    addEventListener('resize', () => { if (Replay.active) Replay.resize(); });
    this.reset((Math.random() * 4294967296) >>> 0);
    UI.showTitle();
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  modeDef(mode = this.mode) { return MODES[mode] || MODES.normal; },
  tracksProgress() { return this.mode !== 'versus'; },

  // The player furthest ahead (the world, traffic and events follow them).
  leader() {
    let best = null;
    for (const p of this.players) if (p.alive && (!best || p.maxRow > best.maxRow)) best = p;
    return best || this.players[0];
  },
  // Who a secret event picks on.
  target() {
    const alive = this.players.filter(p => p.alive);
    return alive.length ? pick(alive) : Player;
  },

  reset(seed) {
    const M = this.modeDef();
    DIFF.offset = M.offset || 0;
    this.players = M.players === 2 ? [Player, Player2] : [Player];
    FX.reset();
    Items.reset();
    Powers.reset();
    Vehicles.reset();
    Events.reset();
    Animals.reset();
    Storms.reset();
    Lighting.reset();
    Replay.reset();
    World.reset(seed, { speedMul: M.speedMul, gapMul: M.gapMul, powerups: M.powerups });
    if (this.players.length > 1) { Player.reset(3); Player2.reset(7); }
    else Player.reset(START_COL);
    Pets.reset();
    Cam.reset();
    Cam.ox = 0;
    Renderer.metrics();
    this.score = this.coins = 0;
    this.danger.y = -7 * TILE;
    this.danger.active = false;
    this.weather.type = 'clear';
    this.weather.amt = 0;
    this.zone = 'country';
    this.skidCooldown = 0;
    this.timeScale = 1;
    this.slow.t = 0;
    this.deathT = this.overT = 0;
    this.newBest = false;
    this.goreDeath = false;
    this.timeLeft = M.limit || 0;
    this.timerOn = false;
    this.winner = null;
    this.xpInfo = null;
    this.lastTick = 99;
  },

  bestFor(mode) {
    if (mode === 'normal') return this.best;
    const key = this.modeDef(mode).best;
    return key ? Store.get(key, 0) : 0;
  },
  setBest(mode, v) {
    if (mode === 'normal') { this.best = v; Store.set('best', v); }
    else if (this.modeDef(mode).best) Store.set(this.modeDef(mode).best, v);
  },

  start(mode = this.mode) {
    Sound.init();
    Sound.click();
    const fresh = this.state !== 'title' || mode !== this.mode;
    this.mode = mode;
    if (fresh) this.reset((Math.random() * 4294967296) >>> 0);
    this.state = 'playing';
    this.time = 0;
    for (const p of this.players) p.lastMoveT = 0;
    if (this.tracksProgress()) {
      this.runs = Store.get('runs', 0) + 1;
      Store.set('runs', this.runs);
      Stats.add('runs');
    }
    Pets.reset();
    Missions.startRun();
    Trophies.startRun(mode);
    const M = this.modeDef();
    Ghost.start(this.tracksProgress() ? M.ghost : null);
    UI.startRun();
  },

  // Back to the title screen with a fresh road.
  toTitle() {
    Replay.stop();
    this.mode = 'normal';
    this.reset((Math.random() * 4294967296) >>> 0);
    this.state = 'title';
    this.time = 0;
    UI.showTitle();
  },

  togglePause(force) {
    if (this.state === 'playing' && force !== false) {
      this.state = 'paused';
      UI.showPause(true);
    } else if (this.state === 'paused' && force !== true) {
      this.state = 'playing';
      UI.showPause(false);
      this.last = performance.now();
    }
  },

  // ---- Events from other systems -------------------------------------------------
  onPlayerMove(p) {
    this.danger.active = true;
    if (this.mode === 'time' && !this.timerOn) this.timerOn = true;
    const gap = this.time - p.lastMoveT;
    p.lastMoveT = this.time;
    if (p.row > p.maxRow) {
      p.maxRow = p.row;
      const row = World.rows.get(p.row);
      if (p.id === 0) {
        Missions.max('distance', p.maxRow);
        Trophies.max('row', p.maxRow);
        if (this.tracksProgress()) Stats.add('rows');
      }
      if (row && row.type === 'road') {
        p.streak = gap < 0.9 || p.streak === 0 ? p.streak + 1 : 1;
        if (p.id === 0) {
          Missions.add('lanes');
          Missions.max('streak', p.streak);
        }
      } else if (row && row.type === 'rail' && p.id === 0) {
        Missions.add('rails');
        Trophies.add('rails');
      }
      this.updateScore();
    }
  },

  updateScore() {
    this.score = Player.score;
    Missions.max('score', this.score);
  },

  addBonus(n, p = Player) {
    p.bonus += n;
    this.updateScore();
  },

  addCoin(it, p = Player) {
    const k = this.modeDef().coinMult || 1;
    p.coins += k;
    if (p.id === 0) this.coins = p.coins;
    this.addBonus(25, p);
    FX.coin(it.x, it.y);
    FX.text(it.x, it.y + 6, this.mode === 'time' ? '+1s' : k > 1 ? `+25  x${k}` : '+25', '#ffd23f', 15);
    if (this.mode === 'time' && this.timerOn) this.timeLeft = Math.min(99, this.timeLeft + 1);
    Sound.coin();
    if (p.id === 0) {
      Missions.add('coins');
      Trophies.max('coins', p.coins);
    }
  },

  // A car (or train) missed by a hair. Chains within 3s build a multiplier.
  nearMiss(mult = 1, p = Player) {
    if (this.state !== 'playing' || !p.alive) return;
    p.combo = this.time - p.comboT < 3 ? p.combo + 1 : 1;
    p.comboT = this.time;
    const pts = 15 * p.combo * mult;
    this.addBonus(pts, p);
    FX.text(p.x, p.y + 26, p.combo > 1 ? `CLOSE CALL x${p.combo}  +${pts}` : `CLOSE CALL +${pts}`, '#7fe0ff', 14 + Math.min(8, p.combo));
    Sound.near(p.combo);
    if (p.id === 0) {
      Missions.max('combo', p.combo);
      Trophies.max('combo', p.combo);
      if (this.tracksProgress()) Trophies.run.closeCalls++;
      if (this.tracksProgress()) {
        Stats.add('closeCalls');
        if (p.combo > Stats.data.bestCombo) Stats.data.bestCombo = p.combo;
      }
    }
  },

  onCrash(x, y, violent, power = 1) {
    let dist = Infinity;
    for (const p of this.players) if (p.alive) dist = Math.min(dist, Math.hypot(p.x - x, p.y - y) / TILE);
    if (dist === Infinity) dist = Math.hypot(Cam.x - x, Cam.y - y) / TILE;
    const near = clamp(1 - dist / (violent ? 16 : 12), 0, 1);
    const repeat = this.time - this.lastBoom < 0.25; // many at once (meteor, giant): keep it bearable
    this.lastBoom = this.time;
    Cam.addTrauma((violent ? 0.55 + 0.45 * near : 0.3 + 0.65 * near) * (repeat ? 0.4 : 1));
    Cam.punch += (violent ? 0.06 + 0.07 * near : 0.03 + 0.05 * near) * (repeat ? 0.3 : 1);
    FX.flashScreen((violent ? 0.45 + 0.4 * near : 0.18 + 0.4 * near) * (repeat ? 0.4 : 1));
    if (!repeat) FX.text(x, y + 20, power > 1.6 ? 'KABOOM!' : 'CRASH!', '#ffcf40', violent ? 30 : 24);
    Sound.explosion(Math.min(1, (violent ? 0.6 + 0.5 * near : 0.4 + 0.6 * near) * (repeat ? 0.45 : 1)), Vehicles.pan(x), violent || power > 1.6);
    if (this.state === 'playing') {
      if (dist < (violent ? 9 : 7) && !repeat) this.slowmo(violent ? 0.22 : 0.3, violent ? 0.55 : 0.35);
      for (const p of this.players) {
        p.blast(x, y, power);
        if (p.id === 0 && p.alive && Math.hypot(p.x - x, p.y - y) / TILE < 6) {
          Missions.add('crashes');
          Trophies.add('booms');
        }
      }
    }
  },

  // Graphic mode: a wreck's fuel tank explodes a moment after the crash.
  onSecondary(v) {
    let dist = Infinity;
    for (const p of this.players) dist = Math.min(dist, Math.hypot(p.x - v.x, p.y - v.y) / TILE);
    const near = clamp(1 - dist / 14, 0, 1);
    FX.secondaryBlast(v.x, v.y, [v.base, '#2a2a2e']);
    Cam.addTrauma(0.25 + 0.35 * near);
    Cam.punch += 0.03;
    FX.flashScreen(0.2 + 0.25 * near);
    Sound.explosion(0.35 + 0.4 * near, Vehicles.pan(v.x));
    if (this.state === 'playing') {
      for (const p of this.players) if (Math.hypot(p.x - v.x, p.y - v.y) / TILE < 2) p.blast(v.x, v.y, 0.8);
    }
  },

  onWreckLand(v) {
    const near = clamp(1 - Math.hypot(Cam.x - v.x, Cam.y - v.y) / TILE / 12, 0, 1);
    Cam.addTrauma(0.12 + 0.2 * near);
    Sound.clang(0.5 + 0.5 * near, Vehicles.pan(v.x));
  },

  slowmo(scale, dur) {
    this.slow.scale = scale;
    this.slow.t = Math.max(this.slow.t, dur);
  },

  // Traffic speed multiplier: freeze power-up and snow.
  trafficFactor() {
    return Powers.traffic * (this.weather.type === 'snow' ? 1 - 0.3 * this.weather.amt : 1);
  },

  checkHits() {
    for (const p of this.players) if (p.alive) this.checkPlayer(p);
  },

  checkPlayer(p) {
    if (p.z > 0.45 * TILE) return;
    const fz = this.trafficFactor();
    const pr = Math.round(p.y / TILE);
    for (let r = pr - 1; r <= pr + 1; r++) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.type === 'rail') {
        const R = row.rail;
        if (p.pw.ghost > 0) continue; // ghosts don't get hit by trains
        if (Math.abs(row.y - p.y) > 0.5 * TILE || R.state !== 'train' || R.speed * fz < 25) continue;
        const [a, b] = Rail.extent(R);
        const tm = p.pw.shrink > 0 ? 0.05 * TILE : 0.2 * TILE;
        if (p.x < a - tm || p.x > b + tm) continue;
        if (p.invincible() || p.grace > 0) continue;
        if (p.shield) { // the shield can't stop a train, but it can throw you clear
          p.shield--; // shields stack: one breaks per hit
          p.grace = 1.3;
          FX.shieldBreak(p.x, p.y);
          Sound.shieldBreak();
          p.knockback(0, p.y >= row.y ? 1 : -1, 1, 1.0);
          continue;
        }
        this.kill('train', { p, dir: R.dir, rail: R });
        return;
      }
      if (row.type !== 'road') continue;
      for (const v of row.lane.vehicles) {
        if (p.pw.ghost > 0 && !v.wreck) continue; // ghost: cars drive straight through you
        const small = p.pw.shrink > 0;
        if (Math.abs((v.drunk ? v.y : row.y) - p.y) > (small ? 0.42 : 0.58) * TILE) continue; // drunk drivers weave between lanes
        if (v.abducted || v.z > 30 || v.animal) continue;
        if (Math.abs(v.x - p.x) > v.len / 2 - 2 + (small ? 0.08 : 0.24) * TILE) continue;
        if (v.wreck) { // a sliding wreck shoves you aside instead of killing you
          if (!v.bumped && !p.knock && Math.abs(v.slide) * fz > 40) {
            v.bumped = true;
            p.knockback(sign(v.slide), 0, 1, 0.8);
            FX.text(p.x, p.y + 10, 'OOF!', '#ffe34d', 15);
          }
          continue;
        }
        if (v.speed * fz * (row.flood ? 0.45 : 1) < 25) continue;
        this.vehicleHit(v, row, p);
        return;
      }
    }
  },

  vehicleHit(v, row, p) {
    if (p.invincible() || p.grace > 0) return;
    if (p.shield) {
      p.shield--; // shields stack: one breaks per hit
      p.grace = 1.3;
      Vehicles.bounce(v, row);
      FX.shieldBreak(p.x, p.y);
      FX.text(p.x, p.y + 14, p.shield ? `SHIELD SAVED YOU! (${p.shield} LEFT)` : 'SHIELD SAVED YOU!', '#8fd0ff', 17);
      Sound.shieldBreak();
      Cam.addTrauma(0.45);
      Cam.punch += 0.04;
      return;
    }
    this.kill('vehicle', { p, dir: row.lane.dir, vehicle: v, row });
  },

  kill(source, opts = {}) {
    const p = opts.p || Player;
    if (!p.alive || Admin.god) return;
    if (this.state === 'playing' && Pets.saves(p, source)) return; // the cat takes the hit
    const sameMoment = this.state === 'dying' && this.deathT === 0 && this.players.length > 1;
    if (this.state !== 'playing' && !sameMoment) return;
    const gore = Settings.gore && source !== 'danger' && source !== 'pit';
    const dir = opts.dir || 0;
    const v = opts.vehicle || null;
    const skin = p.skin();
    const cause = source === 'vehicle' ? CAUSES.vehicle(gore, v) : CAUSES[source](gore, opts.rail);
    p.die(source, dir, gore);

    if (source === 'drown' || source === 'swept') {
      Sound.splash(1);
      if (gore) { FX.piranhas(p.x, p.y, skin); Sound.splat(); }
      else FX.splash(p.x, p.y, 24);
    } else if (source === 'pit') {
      Sound.whistle();
      FX.dust(p.x, p.y, 12);
    } else {
      Sound.hit();
      if (gore) {
        Sound.splat();
        if (source === 'train') { FX.trainRoadkill(p.x, p.y, dir, skin); if (opts.rail) opts.rail.bloody = true; }
        else if (source === 'giant') FX.crushed(p.x, p.y, skin);
        else if (source === 'meteor' || source === 'lightning') { FX.trainRoadkill(p.x, p.y, chance(0.5) ? 1 : -1, skin); FX.scorch(p.x, p.y); }
        else if (source !== 'danger') FX.roadkill(p.x, p.y, dir || (chance(0.5) ? 1 : -1), skin);
        if (v) { v.bloody = true; v.bloodT = 4; }
        // everything close by gets splattered
        for (const row of World.rows.values()) {
          if (row.type !== 'road' || Math.abs(row.y - p.y) > 2.5 * TILE) continue;
          for (const w of row.lane.vehicles) {
            if (w.animal || Math.abs(w.x - p.x) > 2.5 * TILE + w.len / 2) continue;
            w.bloody = true;
            w.bloodT = Math.max(w.bloodT, 2.5);
          }
        }
        FX.flashScreen(0.7, '200,20,30');
        // the paramedics come for the body
        if (source === 'vehicle' && opts.row && !v.responder) Vehicles.dispatch(opts.row, 'ambulance', { x: p.x, y: p.y, p });
      } else {
        FX.flashScreen(0.35, '255,90,90');
        FX.feathers(p.x, p.y, skin);
      }
    }
    Cam.addTrauma(gore ? 1 : 0.7);
    Cam.punch += gore ? 0.1 : 0.08;
    this.slowmo(gore ? 0.18 : 0.25, gore ? 1.3 : 0.9);

    const statKey = source === 'vehicle' && v && v.responder ? 'responder' : source === 'vehicle' && v && v.drunk ? 'drunk' : source;
    if (p.id === 0 && this.tracksProgress()) {
      Stats.death(statKey);
      if (statKey === 'responder') Trophies.add('irony');
    }

    if (this.players.length > 1) { // two players: the other one wins
      if (sameMoment) { // both at once: a draw
        if (this.winner) this.versusWins[this.winner.id]--;
        this.winner = null;
        this.cause = 'Both chickens went down together';
        return;
      }
      const other = this.players.find(q => q !== p);
      this.winner = other.alive ? other : null;
      this.cause = `${p.tag}: ${cause}`;
      this.goreDeath = gore;
      Replay.markDeath(p);
      this.endRun();
      return;
    }
    this.cause = cause;
    this.goreDeath = gore;
    Replay.markDeath(p);
    this.endRun();
  },

  // Time attack: the clock ran out.
  timeUp() {
    if (this.state !== 'playing') return;
    this.cause = "Time's up";
    this.goreDeath = false;
    Sound.whistleEnd();
    FX.text(Player.x, Player.y + 30, 'TIME!', '#ffd23f', 30);
    FX.flashScreen(0.3);
    this.slowmo(0.35, 0.6);
    Player.stun = 99; // freeze in place
    this.endRun();
  },

  endRun() {
    this.state = 'dying';
    this.deathT = 0;
    if (this.players.length > 1) {
      if (this.winner) this.versusWins[this.winner.id]++;
      Stats.add('versusGames');
      Stats.save();
      Trophies.check();
      return;
    }
    this.updateScore();
    const prevBest = this.bestFor(this.mode);
    this.newBest = this.score > prevBest;
    if (this.newBest) {
      this.setBest(this.mode, this.score);
      Ghost.save();
    }
    this.bank += this.coins;
    Store.set('coins', this.bank);
    Stats.add('coins', this.coins);
    Stats.save();
    Trophies.check();
    this.xpInfo = Levels.award(Levels.forRun(this.mode, Player.maxRow, this.coins, Trophies.run));
  },

  gameOver() {
    this.state = 'gameover';
    this.overT = 0;
    Replay.stop();
    const versusRun = this.players.length > 1;
    if (!versusRun && this.xpInfo && this.xpInfo.rewards.length) Sound.levelUp();
    else Sound.gameOver();
    const versus = this.players.length > 1;
    UI.showGameOver({
      cause: this.cause, score: this.score, best: this.bestFor(this.mode), newBest: this.newBest,
      coins: this.coins, bank: this.bank, rows: Player.maxRow, run: this.runs, mode: this.mode,
      gore: this.goreDeath,
      versus: versus ? { winner: this.winner, wins: this.versusWins, rows: this.players.map(p => p.maxRow), scores: this.players.map(p => p.score) } : null,
      trophies: Trophies.fresh.slice(), xp: versusRun ? null : this.xpInfo,
    });
  },

  skipReplay() {
    if (this.state !== 'replay') return;
    this.gameOver();
    this.overT = 0.2;
  },

  // The creeping danger line: dawdle too long and it catches you.
  updateDanger(dt) {
    if (!this.danger.active || Admin.noDanger) return;
    const lead = this.leader();
    const d = difficulty(lead.maxRow);
    this.danger.y += TILE * (0.3 + 0.45 * d) * (this.modeDef().danger || 1) * dt;
    this.danger.y = Math.max(this.danger.y, (lead.maxRow - 7) * TILE);
    for (const p of this.players) {
      if (p.alive && !p.knock && !p.abduct && p.y < this.danger.y) this.kill('danger', { p });
    }
  },

  dangerProximity() {
    if (!this.danger.active || this.state !== 'playing') return 0;
    let y = Infinity;
    for (const p of this.players) if (p.alive) y = Math.min(y, p.y);
    if (y === Infinity) return 0;
    return clamp(1 - (y - this.danger.y) / (4 * TILE), 0, 1);
  },

  updateWeather(dt) {
    const w = this.weather;
    const want = Admin.weather || World.weatherAt(Math.max(0, this.leader().maxRow + 4));
    if (w.type !== want) {
      w.amt = approach(w.amt, 0, dt * 0.6);
      if (w.amt === 0) {
        w.type = want;
        if (want !== 'clear' && this.state === 'playing') UI.weatherToast(want);
      }
    } else {
      w.amt = approach(w.amt, want === 'clear' ? 0 : 1, dt * 0.4);
    }
    Sound.ambient(w.type === 'rain' ? w.amt : 0, w.type === 'snow' || w.type === 'dust' ? w.amt : 0);
  },

  // Entering a new biome.
  updateZone() {
    const z = World.zoneAt(this.leader().maxRow);
    if (z === this.zone) return;
    this.zone = z;
    if (this.state !== 'playing') return;
    UI.zoneToast(z);
    if (this.tracksProgress()) Stats.zone(z);
  },

  updateTimer(dt) {
    if (this.mode !== 'time' || !this.timerOn || this.state !== 'playing') return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    const s = Math.ceil(this.timeLeft);
    if (s <= 10 && s !== this.lastTick && s > 0) { this.lastTick = s; Sound.tick(s <= 3); }
    if (this.timeLeft <= 0) this.timeUp();
  },

  // ---- Loop ------------------------------------------------------------------
  update(dt, realDt) {
    this.time += dt;
    Renderer.metrics();
    const playing = this.state === 'playing';
    if (playing) {
      Powers.update(dt);
      if (this.tracksProgress()) Stats.data.time += dt;
    }
    const fz = this.trafficFactor();
    this.skidCooldown -= dt;

    River.update(dt, fz);
    Events.update(dt);
    for (const p of this.players) p.update(dt, this.time);
    Vehicles.update(dt, fz);
    Rail.update(dt, fz);
    Work.update(dt);
    Animals.update(dt);
    Pets.update(dt);
    Storms.update(dt);
    Vehicles.drunkDirector(dt);
    if ((playing || this.state === 'title') && Powers.freeze <= 0) Vehicles.director(dt, this.leader().row, fz);
    if (playing) {
      this.checkHits();
      for (const p of this.players) if (p.alive) Items.update(dt, p);
      this.updateDanger(dt);
      if (this.tracksProgress()) Ghost.update(this.time);
      for (const p of this.players) if (this.time - p.lastMoveT > 0.9) p.streak = 0;
      this.updateTimer(dt);
    }
    this.updateWeather(dt);
    this.updateZone();
    Lighting.update();
    Admin.update();
    FX.update(dt);
    Cam.update(dt, realDt);
    // game over on a wide screen: slide the scene right so the report sits beside it
    const wide = this.state === 'gameover' && Renderer.W >= 980;
    Cam.ox = damp(Cam.ox || 0, wide ? (Renderer.W * 0.2) / Renderer.k : 0, 3, realDt);

    World.ensure(Math.ceil(Renderer.yTop / TILE) + 14);
    World.cull(Math.floor(Math.min(Renderer.yBot, this.danger.y) / TILE) - 4);

    if (this.state === 'dying') {
      this.deathT += realDt;
      if (this.deathT > 1.35) {
        if (Replay.start()) { this.state = 'replay'; UI.showReplay(); }
        else this.gameOver();
      }
    } else if (this.state === 'gameover') {
      this.overT += realDt;
    }
    UI.update();
  },

  loop(now) {
    const raw = Math.max(0, (now - this.last) / 1000);
    const realDt = Math.min(0.05, raw);
    this.last = now;
    Input.poll();
    // adaptive effects quality: fewer cosmetic particles while frames run slow
    if (raw > 0 && raw < 0.5) {
      this.frameAvg = lerp(this.frameAvg || 1 / 60, raw, 0.05);
      if (this.frameAvg > 1 / 45) FX.quality -= 0.01;
      else if (this.frameAvg < 1 / 56) FX.quality += 0.002;
    }
    if (this.state !== 'paused') {
      if (this.slow.t > 0) {
        this.slow.t -= realDt;
        this.timeScale = this.slow.scale;
      } else {
        this.timeScale = damp(this.timeScale, 1, 6, realDt);
      }
      this.update(realDt * this.timeScale * Admin.speed, realDt);
    }
    if (Admin.freeCam) Admin.moveCam(realDt);
    Renderer.frame(this.time, realDt);
    if (this.state === 'replay' && Replay.update(realDt)) this.gameOver();
    requestAnimationFrame(t => this.loop(t));
  },
};

Game.init();
