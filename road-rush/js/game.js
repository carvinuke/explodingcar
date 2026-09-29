'use strict';
// Game state, main loop, input, scoring, deaths, weather and the glue between systems.

const CAUSES = {
  vehicle: (g, v) => `${g ? 'Flattened' : 'Hit'} by ${VEHICLE_TYPES[v.type].name}`,
  train: g => (g ? 'Obliterated by a freight train' : 'Hit by a train'),
  drown: g => (g ? 'Eaten alive by piranhas' : 'Fell in the river'),
  swept: g => (g ? 'Swept downstream and eaten by piranhas' : 'Swept away by the river'),
  danger: () => 'Left behind',
  meteor: g => (g ? 'Vaporized by a meteor' : 'Hit by a meteor'),
  giant: g => (g ? 'Squashed flat by a giant chicken' : 'Stepped on by a giant chicken'),
  goose: g => (g ? 'Torn apart by the giant goose' : 'Caught by the giant goose'),
};

const Game = {
  state: 'title', // title | playing | paused | dying | gameover
  mode: 'normal', // normal | daily
  time: 0,
  timeScale: 1,
  slow: { t: 0, scale: 1 },
  score: 0,
  bonus: 0,
  coins: 0,
  best: Store.get('best', 0),
  bank: Store.get('coins', 0),
  runs: Store.get('runs', 0),
  danger: { y: -7 * TILE, active: false },
  weather: { type: 'clear', amt: 0 },
  skidCooldown: 0,
  leftCell: null,
  combo: 0,
  comboT: -9,
  streak: 0,
  lastMoveT: 0,
  lastBoom: -9,
  deathT: 0,
  overT: 0,
  cause: '',
  newBest: false,
  goreDeath: false,

  init() {
    Renderer.init(document.getElementById('view'));
    Missions.load();
    UI.init();
    this.bindInput();
    this.reset((Math.random() * 4294967296) >>> 0);
    UI.showTitle();
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  reset(seed) {
    FX.reset();
    Items.reset();
    Powers.reset();
    Vehicles.reset();
    Events.reset();
    World.reset(seed);
    Player.reset();
    Cam.reset();
    Renderer.metrics();
    this.score = this.bonus = this.coins = 0;
    this.danger.y = -7 * TILE;
    this.danger.active = false;
    this.weather.type = 'clear';
    this.weather.amt = 0;
    this.skidCooldown = 0;
    this.leftCell = null;
    this.combo = 0;
    this.comboT = -9;
    this.streak = 0;
    this.timeScale = 1;
    this.slow.t = 0;
    this.deathT = this.overT = 0;
    this.newBest = false;
    this.goreDeath = false;
  },

  dailyKey() { return 'daily.' + dayKey(); },
  bestFor(mode) { return mode === 'daily' ? Store.get(this.dailyKey(), 0) : this.best; },

  start(mode = this.mode) {
    Sound.init();
    Sound.click();
    const fresh = this.state !== 'title' || mode !== this.mode || mode === 'daily';
    this.mode = mode;
    if (fresh) this.reset(mode === 'daily' ? hashSeed('roadrush-' + dayKey()) : (Math.random() * 4294967296) >>> 0);
    this.state = 'playing';
    this.time = 0;
    this.lastMoveT = 0;
    this.runs = Store.get('runs', 0) + 1;
    Store.set('runs', this.runs);
    Missions.startRun();
    Ghost.start(mode === 'daily' ? this.dailyKey() : 'best');
    UI.startRun();
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

  // ---- Input ---------------------------------------------------------------
  bindInput() {
    const MOVES = {
      ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
    };
    addEventListener('keydown', e => {
      if (UI.modal) { // dialogs own the keyboard while open
        if (e.code === 'Escape') { e.preventDefault(); UI.closeModal(); }
        return;
      }
      const mv = MOVES[e.code];
      const confirm = e.code === 'Space' || e.code === 'Enter';
      if (mv || e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyM') { UI.toggleMute(); return; }
      if (e.code === 'KeyP' || e.code === 'Escape') { this.togglePause(); return; }
      if (e.repeat) return;
      if (this.state === 'title' && (confirm || mv)) {
        this.start('normal');
        if (mv) Player.input(mv[0], mv[1]);
        return;
      }
      if (this.state === 'gameover' && confirm && this.overT > 0.4) { e.preventDefault(); this.start(); return; }
      if (this.state === 'paused' && confirm) { this.togglePause(false); return; }
      if (mv && this.state === 'playing') Player.input(mv[0], mv[1]);
    });

    // Touch / mouse: swipe to move in that direction, tap to hop forward.
    const root = document.getElementById('game');
    let sx = 0, sy = 0, down = false;
    root.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || this.state !== 'playing') return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    root.addEventListener('pointerup', e => {
      if (!down) return;
      down = false;
      if (this.state !== 'playing') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) < 24) Player.input(0, 1);
      else if (Math.abs(dx) > Math.abs(dy)) Player.input(sign(dx), 0);
      else Player.input(0, dy < 0 ? 1 : -1);
    });
    root.addEventListener('pointercancel', () => { down = false; });

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.togglePause(true); });
    addEventListener('blur', () => this.togglePause(true));
  },

  // ---- Events from other systems -------------------------------------------------
  onPlayerMove() {
    this.danger.active = true;
    const gap = this.time - this.lastMoveT;
    this.lastMoveT = this.time;
    if (Player.row > Player.maxRow) {
      Player.maxRow = Player.row;
      Missions.max('distance', Player.maxRow);
      const row = World.rows.get(Player.row);
      if (row && row.type === 'road') {
        Missions.add('lanes');
        this.streak = gap < 0.9 || this.streak === 0 ? this.streak + 1 : 1;
        Missions.max('streak', this.streak);
      } else if (row && row.type === 'rail') {
        Missions.add('rails');
      }
      this.updateScore();
    }
  },

  updateScore() {
    this.score = Player.maxRow * 10 + this.bonus;
    Missions.max('score', this.score);
  },

  addBonus(n) {
    this.bonus += n;
    this.updateScore();
  },

  addCoin(it) {
    this.coins++;
    this.addBonus(25);
    FX.coin(it.x, it.y);
    FX.text(it.x, it.y + 6, '+25', '#ffd23f', 15);
    Sound.coin();
    Missions.add('coins');
  },

  // A car (or train) missed by a hair. Chains within 3s build a multiplier.
  nearMiss(mult = 1) {
    if (this.state !== 'playing' || !Player.alive) return;
    this.combo = this.time - this.comboT < 3 ? this.combo + 1 : 1;
    this.comboT = this.time;
    const pts = 15 * this.combo * mult;
    this.addBonus(pts);
    FX.text(Player.x, Player.y + 26, this.combo > 1 ? `CLOSE CALL x${this.combo}  +${pts}` : `CLOSE CALL +${pts}`, '#7fe0ff', 14 + Math.min(8, this.combo));
    Sound.near(this.combo);
    Missions.max('combo', this.combo);
  },

  onCrash(x, y, violent, power = 1) {
    const p = Player;
    const dist = Math.hypot(p.x - x, p.y - y) / TILE;
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
      p.blast(x, y, power);
      if (p.alive && dist < 6) Missions.add('crashes');
    }
  },

  // Graphic mode: a wreck's fuel tank explodes a moment after the crash.
  onSecondary(v) {
    const dist = Math.hypot(Player.x - v.x, Player.y - v.y) / TILE;
    const near = clamp(1 - dist / 14, 0, 1);
    FX.secondaryBlast(v.x, v.y, [v.base, '#2a2a2e']);
    Cam.addTrauma(0.25 + 0.35 * near);
    Cam.punch += 0.03;
    FX.flashScreen(0.2 + 0.25 * near);
    Sound.explosion(0.35 + 0.4 * near, Vehicles.pan(v.x));
    if (this.state === 'playing' && dist < 2) Player.blast(v.x, v.y, 0.8);
  },

  onWreckLand(v) {
    const near = clamp(1 - Math.hypot(Player.x - v.x, Player.y - v.y) / TILE / 12, 0, 1);
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
    const p = Player;
    if (!p.alive || p.z > 0.45 * TILE) return;
    const fz = this.trafficFactor();
    const pr = Math.round(p.y / TILE);
    for (let r = pr - 1; r <= pr + 1; r++) {
      const row = World.rows.get(r);
      if (!row) continue;
      if (row.type === 'rail') {
        const R = row.rail;
        if (Math.abs(row.y - p.y) > 0.5 * TILE || R.state !== 'train' || R.speed * fz < 25) continue;
        const [a, b] = Rail.extent(R);
        if (p.x < a - 0.2 * TILE || p.x > b + 0.2 * TILE) continue;
        if (Powers.invincible > 0 || p.grace > 0) continue;
        if (p.shield) { // the shield can't stop a train, but it can throw you clear
          p.shield = false;
          p.grace = 1.3;
          FX.shieldBreak(p.x, p.y);
          Sound.shieldBreak();
          p.knockback(0, p.y >= row.y ? 1 : -1, 1, 1.0);
          continue;
        }
        this.kill('train', { dir: R.dir, rail: R });
        return;
      }
      if (row.type !== 'road' || Math.abs(row.y - p.y) > 0.58 * TILE) continue;
      for (const v of row.lane.vehicles) {
        if (v.abducted || v.z > 30) continue;
        if (Math.abs(v.x - p.x) > v.len / 2 - 2 + 0.24 * TILE) continue;
        if (v.wreck) { // a sliding wreck shoves you aside instead of killing you
          if (!v.bumped && !p.knock && Math.abs(v.slide) * fz > 40) {
            v.bumped = true;
            p.knockback(sign(v.slide), 0, 1, 0.8);
            FX.text(p.x, p.y + 10, 'OOF!', '#ffe34d', 15);
          }
          continue;
        }
        if (v.speed * fz * (row.flood ? 0.45 : 1) < 25) continue;
        this.vehicleHit(v, row);
        return;
      }
    }
  },

  vehicleHit(v, row) {
    const p = Player;
    if (Powers.invincible > 0 || p.grace > 0) return;
    if (p.shield) {
      p.shield = false;
      p.grace = 1.3;
      Vehicles.bounce(v, row);
      FX.shieldBreak(p.x, p.y);
      FX.text(p.x, p.y + 14, 'SHIELD SAVED YOU!', '#8fd0ff', 17);
      Sound.shieldBreak();
      Cam.addTrauma(0.45);
      Cam.punch += 0.04;
      return;
    }
    this.kill('vehicle', { dir: row.lane.dir, vehicle: v });
  },

  kill(source, opts = {}) {
    const p = Player;
    if (!p.alive || this.state !== 'playing') return;
    const gore = Settings.gore && source !== 'danger';
    const dir = opts.dir || 0;
    const v = opts.vehicle || null;
    const skin = p.skin();
    this.cause = source === 'vehicle' ? CAUSES.vehicle(gore, v) : CAUSES[source](gore);
    this.goreDeath = gore;
    p.die(source, dir, gore);
    this.state = 'dying';
    this.deathT = 0;

    if (source === 'drown' || source === 'swept') {
      Sound.splash(1);
      if (gore) { FX.piranhas(p.x, p.y, skin); Sound.splat(); }
      else FX.splash(p.x, p.y, 24);
    } else {
      Sound.hit();
      if (gore) {
        Sound.splat();
        if (source === 'train') { FX.trainRoadkill(p.x, p.y, dir, skin); if (opts.rail) opts.rail.bloody = true; }
        else if (source === 'giant') FX.crushed(p.x, p.y, skin);
        else if (source === 'meteor') { FX.trainRoadkill(p.x, p.y, chance(0.5) ? 1 : -1, skin); FX.scorch(p.x, p.y); }
        else if (source !== 'danger') FX.roadkill(p.x, p.y, dir || (chance(0.5) ? 1 : -1), skin);
        if (v) { v.bloody = true; v.bloodT = 2.6; }
        FX.flashScreen(0.5, '200,20,30');
      } else {
        FX.flashScreen(0.35, '255,90,90');
        FX.feathers(p.x, p.y, skin);
      }
    }
    Cam.addTrauma(gore ? 0.85 : 0.7);
    Cam.punch += gore ? 0.1 : 0.08;
    this.slowmo(0.25, 0.9);

    this.updateScore();
    const prevBest = this.bestFor(this.mode);
    this.newBest = this.score > prevBest;
    if (this.newBest) {
      if (this.mode === 'daily') Store.set(this.dailyKey(), this.score);
      else { this.best = this.score; Store.set('best', this.best); }
      Ghost.save();
    }
    this.bank += this.coins;
    Store.set('coins', this.bank);
  },

  gameOver() {
    this.state = 'gameover';
    this.overT = 0;
    Sound.gameOver();
    UI.showGameOver({
      cause: this.cause, score: this.score, best: this.bestFor(this.mode), newBest: this.newBest,
      coins: this.coins, bank: this.bank, rows: Player.maxRow, run: this.runs,
      daily: this.mode === 'daily' ? dayLabel(dayKey()) : null, gore: this.goreDeath,
    });
  },

  // The creeping danger line: dawdle too long and it catches you.
  updateDanger(dt) {
    if (!this.danger.active) return;
    const d = difficulty(Player.maxRow);
    this.danger.y += TILE * (0.3 + 0.45 * d) * dt;
    this.danger.y = Math.max(this.danger.y, (Player.maxRow - 7) * TILE);
    if (Player.alive && !Player.knock && !Player.abduct && Player.y < this.danger.y) this.kill('danger');
  },

  dangerProximity() {
    if (!this.danger.active || this.state !== 'playing') return 0;
    return clamp(1 - (Player.y - this.danger.y) / (4 * TILE), 0, 1);
  },

  updateWeather(dt) {
    const w = this.weather;
    const want = World.weatherAt(Math.max(0, Player.maxRow + 4));
    if (w.type !== want) {
      w.amt = approach(w.amt, 0, dt * 0.6);
      if (w.amt === 0) {
        w.type = want;
        if (want !== 'clear' && this.state === 'playing') UI.weatherToast(want);
      }
    } else {
      w.amt = approach(w.amt, want === 'clear' ? 0 : 1, dt * 0.4);
    }
    Sound.ambient(w.type === 'rain' ? w.amt : 0, w.type === 'snow' ? w.amt : 0);
  },

  // ---- Loop ------------------------------------------------------------------
  update(dt, realDt) {
    this.time += dt;
    Renderer.metrics();
    const playing = this.state === 'playing';
    if (playing) Powers.update(dt);
    const fz = this.trafficFactor();
    this.skidCooldown -= dt;

    River.update(dt, fz);
    Events.update(dt);
    Player.update(dt, this.time);
    Vehicles.update(dt, fz);
    Rail.update(dt, fz);
    if ((playing || this.state === 'title') && Powers.freeze <= 0) Vehicles.director(dt, Player.row, fz);
    if (playing) {
      this.checkHits();
      Items.update(dt, Player);
      this.updateDanger(dt);
      Ghost.update(this.time);
      if (this.time - this.lastMoveT > 0.9) this.streak = 0;
    }
    this.updateWeather(dt);
    FX.update(dt);
    Cam.update(dt, realDt);

    World.ensure(Math.ceil(Renderer.yTop / TILE) + 14);
    World.cull(Math.floor(Math.min(Renderer.yBot, this.danger.y) / TILE) - 4);

    if (this.state === 'dying') {
      this.deathT += realDt;
      if (this.deathT > 1.35) this.gameOver();
    } else if (this.state === 'gameover') {
      this.overT += realDt;
    }
    UI.update();
  },

  loop(now) {
    const raw = Math.max(0, (now - this.last) / 1000);
    const realDt = Math.min(0.05, raw);
    this.last = now;
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
      this.update(realDt * this.timeScale, realDt);
    }
    Renderer.frame(this.time, realDt);
    requestAnimationFrame(t => this.loop(t));
  },
};

Game.init();
