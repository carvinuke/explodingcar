'use strict';
// Game state, main loop, input, scoring and the glue between systems.

const Game = {
  state: 'title', // title | playing | paused | dying | gameover
  time: 0,
  timeScale: 1,
  slow: { t: 0, scale: 1 },
  score: 0,
  bonus: 0,
  coins: 0,
  best: Store.get('best', 0),
  bank: Store.get('coins', 0),
  danger: { y: -7 * TILE, active: false },
  deathT: 0,
  overT: 0,
  cause: '',
  newBest: false,

  init() {
    Renderer.init(document.getElementById('view'));
    UI.init();
    this.bindInput();
    this.reset();
    UI.showTitle();
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  reset() {
    FX.reset();
    Items.reset();
    Powers.reset();
    Vehicles.reset();
    World.reset();
    Player.reset();
    Cam.reset();
    Renderer.metrics();
    this.score = this.bonus = this.coins = 0;
    this.danger.y = -7 * TILE;
    this.danger.active = false;
    this.timeScale = 1;
    this.slow.t = 0;
    this.deathT = this.overT = 0;
    this.newBest = false;
  },

  start() {
    Sound.init();
    Sound.click();
    if (this.state !== 'title') this.reset();
    this.state = 'playing';
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
      const mv = MOVES[e.code];
      const confirm = e.code === 'Space' || e.code === 'Enter';
      if (mv || e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyM') { UI.toggleMute(); return; }
      if (e.code === 'KeyP' || e.code === 'Escape') { this.togglePause(); return; }
      if (e.repeat) return;
      if (this.state === 'title' && (confirm || mv)) {
        this.start();
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
    if (Player.row > Player.maxRow) {
      Player.maxRow = Player.row;
      this.updateScore();
    }
  },

  updateScore() { this.score = Player.maxRow * 10 + this.bonus; },

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
  },

  onCrash(x, y) {
    const p = Player;
    const dist = Math.hypot(p.x - x, p.y - y) / TILE;
    const near = clamp(1 - dist / 12, 0, 1);
    Cam.addTrauma(0.3 + 0.65 * near);
    Cam.punch += 0.03 + 0.05 * near;
    FX.flashScreen(0.18 + 0.4 * near);
    FX.text(x, y + 20, 'CRASH!', '#ffcf40', 24);
    Sound.explosion(0.4 + 0.6 * near, Vehicles.pan(x));
    if (this.state === 'playing') {
      if (dist < 7) this.slowmo(0.3, 0.35);
      p.blast(x, y);
    }
  },

  slowmo(scale, dur) {
    this.slow.scale = scale;
    this.slow.t = Math.max(this.slow.t, dur);
  },

  checkHits() {
    const p = Player;
    if (!p.alive || p.z > 0.45 * TILE) return;
    const fz = Powers.traffic;
    const pr = Math.round(p.y / TILE);
    for (let r = pr - 1; r <= pr + 1; r++) {
      const row = World.rows.get(r);
      if (!row || row.type !== 'road' || Math.abs(row.y - p.y) > 0.58 * TILE) continue;
      for (const v of row.lane.vehicles) {
        if (Math.abs(v.x - p.x) > v.len / 2 - 2 + 0.24 * TILE) continue;
        if (v.wreck) { // a sliding wreck shoves you aside instead of killing you
          if (!v.bumped && !p.knock && Math.abs(v.slide) * fz > 40) {
            v.bumped = true;
            p.knockback(sign(v.slide), 0, 1, 0.8);
            FX.text(p.x, p.y + 10, 'OOF!', '#ffe34d', 15);
          }
          continue;
        }
        if (v.speed * fz < 25) continue;
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
    this.kill(`Hit by ${VEHICLE_TYPES[v.type].name}`, row.lane.dir);
  },

  kill(cause, pushDir) {
    if (!Player.alive) return;
    Player.die(pushDir);
    this.state = 'dying';
    this.deathT = 0;
    this.cause = cause;
    Sound.hit();
    Cam.addTrauma(0.7);
    Cam.punch += 0.08;
    FX.flashScreen(0.35, '255,90,90');
    FX.feathers(Player.x, Player.y);
    this.slowmo(0.25, 0.9);
    this.updateScore();
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      Store.set('best', this.best);
    }
    this.bank += this.coins;
    Store.set('coins', this.bank);
  },

  gameOver() {
    this.state = 'gameover';
    this.overT = 0;
    Sound.gameOver();
    UI.showGameOver({ cause: this.cause, score: this.score, best: this.best, newBest: this.newBest, coins: this.coins, bank: this.bank });
  },

  // The creeping danger line: dawdle too long and it catches you.
  updateDanger(dt) {
    if (!this.danger.active) return;
    const d = difficulty(Player.maxRow);
    this.danger.y += TILE * (0.3 + 0.45 * d) * dt;
    this.danger.y = Math.max(this.danger.y, (Player.maxRow - 7) * TILE);
    if (Player.alive && !Player.knock && Player.y < this.danger.y) this.kill('Left behind!', 0);
  },

  dangerProximity() {
    if (!this.danger.active || this.state !== 'playing') return 0;
    return clamp(1 - (Player.y - this.danger.y) / (4 * TILE), 0, 1);
  },

  // ---- Loop ------------------------------------------------------------------
  update(dt, realDt) {
    this.time += dt;
    Renderer.metrics();
    const playing = this.state === 'playing';
    if (playing) Powers.update(dt);
    const fz = Powers.traffic;

    Player.update(dt, this.time);
    Vehicles.update(dt, fz);
    if ((playing || this.state === 'title') && Powers.freeze <= 0) Vehicles.director(dt, Player.row);
    if (playing) {
      this.checkHits();
      Items.update(dt, Player);
      this.updateDanger(dt);
    }
    FX.update(dt);
    Cam.update(dt, realDt);

    World.ensure(Math.ceil(Renderer.yTop / TILE) + 14);
    World.cull(Math.floor(Math.min(Renderer.yBot, this.danger.y) / TILE) - 4);

    if (this.state === 'dying') {
      this.deathT += realDt;
      if (this.deathT > 1.25) this.gameOver();
    } else if (this.state === 'gameover') {
      this.overT += realDt;
    }
    UI.update();
  },

  loop(now) {
    const realDt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.state !== 'paused') {
      if (this.slow.t > 0) {
        this.slow.t -= realDt;
        this.timeScale = this.slow.scale;
      } else {
        this.timeScale = damp(this.timeScale, 1, 6, realDt);
      }
      this.update(realDt * this.timeScale, realDt);
    }
    Renderer.frame(this.time);
    requestAnimationFrame(t => this.loop(t));
  },
};

Game.init();
