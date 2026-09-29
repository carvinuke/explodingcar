'use strict';
// The players: grid hops (continuous x while riding logs), sliding on ice,
// blast knockback and stun, UFO abduction, and the different ways to die.
// `Player` is player one; two-player mode adds `Player2`.

const PlayerProto = {
  kind: 'player',

  reset(col = START_COL) {
    this.col = col;
    this.row = 0;
    this.x = cellX(col);
    this.y = 0;
    this.z = 0;
    this.hop = null;
    this.queue = null;
    this.knock = null;
    this.rag = null;
    this.abduct = null;
    this.ride = null;
    this.lastLog = 0;
    this.logChain = 0;
    this.facing = 'up';
    this.lastDir = [0, 1];
    this.stun = 0;
    this.alive = true;
    this.shield = 0; // number of stacked shields
    this.grace = 0;
    this.squash = 0;
    this.rot = 0;
    this.flap = 0;
    this.maxRow = 0;
    this.trail = [];
    this.trailT = 0;
    this.char = 0;     // soot from a violent blast (graphic mode)
    this.flat = false; // run over in graphic mode
    this.gone = false; // nothing left to draw (graphic mode)
    this.sink = 0;     // drowning / falling into a pit
    this.slideT = 0;
    this.breath = 0;   // idle breathing
    this.idle = 0;
    this.blinkSeed = rand(0, 3);
    this.pw = { speed: 0, magnet: 0, invincible: 0 };
    this.leftCell = null;
    this.combo = 0;
    this.comboT = -9;
    this.streak = 0;
    this.lastMoveT = 0;
    this.bonus = 0;
    this.coins = 0;
    this.sheet = 0; // graphic mode: paramedics covered the body
  },

  get score() { return this.maxRow * 10 + this.bonus; },
  get tag() { return this.id === 0 ? 'P1' : 'P2'; },

  skin() {
    const mine = SKINS[Shop.current] || SKINS.chick;
    if (this.id === 0) return mine;
    return Shop.current === 'duck' ? SKINS.chick : SKINS.duck; // player two always looks different
  },
  hat() { return this.id === 0 ? Shop.hat : null; },
  rowObj() { return World.rows.get(this.row); },
  invincible() { return this.pw.invincible > 0; },

  input(dx, dy) {
    if (!this.alive || this.knock || this.abduct || this.stun > 0) return;
    if (this.hop) { this.queue = [dx, dy]; return; } // buffer one move for snappy input
    this.move(dx, dy);
  },

  canEnter(nc, nr) {
    return nc >= 0 && nc < COLS && !World.isBlocked(nc, nr) && !Vehicles.blocksCell(nc, nr);
  },

  move(dx, dy, slide = false) {
    this.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'up' : 'down';
    const nr = this.row + dy;
    const target = World.rows.get(nr);
    const toRiver = target && target.type === 'river';
    // on water x stays continuous (logs drift); everywhere else snap to the grid
    let tx = dx ? this.x + dx * TILE : this.x;
    const nc = Math.round(tx / TILE - 0.5);
    if (!toRiver) tx = cellX(nc);
    if (!this.canEnter(nc, nr)) {
      if (!slide) { this.squash = 0.5; Sound.bump(); }
      return false;
    }
    const lg = Events.gravity < 1 ? (1 - Events.gravity) / 0.7 : 0;
    const fast = this.pw.speed > 0;
    const from = this.rowObj();
    if (from && (from.type === 'road' || from.type === 'rail')) this.leftCell = { col: this.col, row: this.row, t: Game.time, used: false };
    this.hop = {
      fx: this.x, fy: this.y, tx, ty: nr * TILE, t: 0, slide,
      dur: slide ? 0.11 : (fast ? 0.075 : 0.12) * lerp(1, 1.7, lg),
      h: slide ? 0 : 0.3 * TILE * lerp(1, 3.2, lg),
    };
    this.col = nc;
    this.row = nr;
    this.ride = null;
    this.lastDir = [dx, dy];
    if (slide) Sound.slide();
    else {
      Sound.hop(fast);
      Cosmetics.hopTrail(this);
    }
    if (this.id === 0) Ghost.mark(Game.time, tx, nr * TILE, 'h');
    Game.onPlayerMove(this);
    return true;
  },

  update(dt, time) {
    if (this.rag) { this.updateRagdoll(dt); return; }
    if (this.sink) {
      this.sink = Math.min(1, this.sink + dt * 1.6);
      this.z = -this.sink * 18;
      const row = this.rowObj();
      if (row && row.type === 'river' && Math.random() < dt * 14) FX.bubbles(this.x, this.y);
      return;
    }
    if (this.flat || this.gone) return;
    if (this.grace > 0) this.grace -= dt;
    for (const k in this.pw) if (this.pw[k] > 0) this.pw[k] = Math.max(0, this.pw[k] - dt);
    if (this.char > 0) {
      this.char -= dt;
      if (Math.random() < dt * 7) FX.puff(this.x, this.y, this.z + 26);
    }

    if (this.abduct) this.updateAbduct(dt);
    else if (this.knock) {
      const k = this.knock;
      k.t = Math.min(1, k.t + dt / k.dur);
      const e = easeOutQuad(k.t);
      this.x = lerp(k.fx, k.tx, e);
      this.y = lerp(k.fy, k.ty, e);
      this.z = Math.sin(Math.PI * k.t) * k.h;
      this.rot = k.spin * k.t;
      if (k.t >= 1) {
        this.knock = null;
        this.z = 0;
        this.rot = 0;
        this.squash = 0.8;
        FX.dust(this.x, this.y, 8);
        Sound.land();
        if (Settings.gore) FX.bleed(this.x, this.y, 16);
        this.landed(true);
      }
    } else if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / h.dur);
      const e = h.slide ? h.t : easeOutQuad(h.t);
      this.x = lerp(h.fx, h.tx, e);
      this.y = lerp(h.fy, h.ty, e);
      this.z = Math.sin(Math.PI * h.t) * h.h;
      this.flap = h.slide ? 0.4 : Math.sin(Math.PI * h.t);
      if (h.slide && Math.random() < dt * 40) FX.spawn('dust', this.x + rand(-6, 6), this.y, 2, { vx: rand(-20, 20), vz: rand(10, 30), life: 0.35, size: 3, size2: 1, color: '#e8f6ff' });
      if (h.t >= 1) {
        this.hop = null;
        this.z = 0;
        this.flap = 0;
        this.squash = h.slide ? 0.2 : 0.45;
        if (this.pw.speed > 0) FX.dust(this.x, this.y, 3);
        this.landed(false);
        if (this.alive && !this.hop && Vehicles.justPassed(this.col, this.row)) Game.nearMiss(1, this);
        if (this.queue && this.alive && !this.hop) {
          const q = this.queue;
          this.queue = null;
          if (this.stun <= 0) this.move(q[0], q[1]);
        }
      }
    } else {
      this.riding(dt);
    }

    if (this.stun > 0) {
      this.stun = Math.max(0, this.stun - dt);
      // graphic mode: dazed and dripping
      if (Settings.gore && this.alive && Math.random() < dt * 10) {
        FX.spawn('blood', this.x + rand(-6, 6), this.y + rand(-4, 4), this.z + rand(8, 18), { vx: rand(-20, 20), vy: rand(-10, 10), vz: rand(0, 40), g: 950, life: 2, size: rand(1.4, 2.4), color: pick(['#9e0b1a', '#b8111f', '#7a0612']) });
      }
    }
    this.squash = damp(this.squash, 0, 14, dt);
    // gentle breathing while standing still
    const still = !this.hop && !this.knock && !this.abduct;
    this.idle = still ? this.idle + dt : 0;
    this.breath = still ? Math.sin(this.idle * 3.2) * 0.04 * Math.min(1, this.idle * 2) : 0;
    if (!this.knock && !this.abduct) this.rot = this.stun > 0 ? Math.sin(time * 16) * 0.14 * Math.min(1, this.stun / 0.5) : 0;

    // speed-boost afterimages
    if (this.pw.speed > 0) {
      this.trailT -= dt;
      const last = this.trail[this.trail.length - 1];
      if (this.trailT <= 0 && (!last || Math.hypot(last.x - this.x, last.y - this.y) > 3)) {
        this.trailT = 0.02;
        this.trail.push({ x: this.x, y: this.y, z: this.z, a: 0.55 });
        if (this.trail.length > 10) this.trail.shift();
      }
    }
    for (const t of this.trail) t.a -= dt * 2.4;
    while (this.trail.length && this.trail[0].a <= 0) this.trail.shift();
  },

  // Just touched down after a hop or knockback: water, pits, ice, flood, logs.
  landed(fromKnock) {
    const row = this.rowObj();
    if (!row) return;
    if (row.type === 'river') {
      const log = River.logAt(row, this.x);
      if (!log) { Game.kill('drown', { p: this }); return; }
      this.ride = log;
      if (log.id !== this.lastLog) {
        this.lastLog = log.id;
        this.logChain++;
        if (this.id === 0) {
          Missions.add('logs');
          Stats.add('logs');
          Trophies.max('logChain', this.logChain);
        }
      }
      FX.ripple(this.x, this.y, 16);
      return;
    }
    this.logChain = 0;
    if (row.type === 'work' && row.pit[this.col]) { Game.kill('pit', { p: this }); return; }
    if (row.type === 'road' && row.flood) FX.splash(this.x, this.y, 8);
    // ice: keep sliding the way you were going until you reach grip or something solid
    if (row.ice && row.ice[this.col] && !fromKnock && this.alive) {
      if (this.id === 0) Trophies.add('ice');
      const [dx, dy] = this.lastDir;
      this.queue = null;
      if (!this.move(dx, dy, true)) this.squash = 0.4;
    }
  },

  // Standing on a river row: drift with the log, or fall in.
  riding(dt) {
    const row = this.rowObj();
    if (!row || row.type !== 'river' || !this.alive) { this.ride = null; return; }
    const log = River.logAt(row, this.x);
    if (!log) { Game.kill('drown', { p: this }); return; }
    this.ride = log;
    this.x += row.river.dir * row.river.speed * Game.trafficFactor() * dt;
    this.col = clamp(Math.round(this.x / TILE - 0.5), 0, COLS - 1);
    this.slideT -= dt;
    if (this.slideT <= 0 && this.id === 0) { this.slideT = 0.2; Ghost.mark(Game.time, this.x, this.y, 's'); }
    if (this.x < -0.25 * TILE || this.x > WORLD_W + 0.25 * TILE) Game.kill('swept', { p: this });
  },

  // Caught by a tornado: spun up into the funnel and dropped a row or two away.
  startTwister(tw) {
    this.queue = null;
    this.hop = null;
    this.knock = null;
    this.ride = null;
    const opts = [this.row - 1, this.row + 1, this.row + 2].filter(r => r >= 0 && World.rows.get(r));
    this.abduct = { t: 0, phase: 'lift', ufo: tw, vz: 0, twist: true, ty: (opts.length ? pick(opts) : this.row) * TILE };
    FX.text(this.x, this.y + 30, 'WHOOOA!', '#e8e0cc', 18);
  },

  // UFO beam: float up, hang there, then get dropped.
  startAbduct(ufo) {
    this.queue = null;
    this.hop = null;
    this.knock = null;
    this.ride = null;
    this.abduct = { t: 0, phase: 'lift', ufo, vz: 0 };
    FX.text(this.x, this.y + 30, 'ABDUCTED!', '#b8ffcc', 18);
  },

  updateAbduct(dt) {
    const a = this.abduct;
    a.t += dt;
    if (a.phase === 'lift') {
      this.z = 90 * easeOutQuad(Math.min(1, a.t / 1.3));
      this.x = damp(this.x, a.ufo.x, 3, dt);
      this.rot = a.twist ? this.rot + dt * 14 : Math.sin(a.t * 6) * 0.3;
      if (a.t > (a.twist ? 1.3 : 1.6)) { a.phase = 'drop'; a.vz = 0; a.fy = this.y; Sound.whistle(); }
    } else {
      a.vz -= 1100 * Events.gravity * dt;
      this.z += a.vz * dt;
      this.rot += dt * 8;
      if (a.twist) this.y = lerp(a.fy, a.ty, clamp(1 - this.z / 90, 0, 1));
      if (this.z <= 0) {
        this.z = 0;
        this.rot = 0;
        this.abduct = null;
        this.col = clamp(Math.round(this.x / TILE - 0.5), 0, COLS - 1);
        if (a.twist) {
          this.y = a.ty;
          this.row = Math.round(this.y / TILE);
          // don't land inside a tree: slide to the nearest open cell
          for (let d = 0; d < COLS && World.isBlocked(this.col, this.row); d++) {
            const c2 = this.col + (d % 2 ? -(d + 1) / 2 : d / 2);
            if (c2 >= 0 && c2 < COLS && !World.isBlocked(c2, this.row)) this.col = c2;
          }
        }
        this.x = this.rowObj() && this.rowObj().type === 'river' ? this.x : cellX(this.col);
        this.stun = 1.3;
        this.squash = 1;
        FX.dust(this.x, this.y, 10);
        Sound.land();
        Cam.addTrauma(0.3);
        if (Settings.gore) FX.bleed(this.x, this.y, 30);
        this.landed(true);
        if (a.twist && this.alive && this.id === 0) Trophies.add('tornado');
      }
    }
  },

  // Explosion nearby: distance decides knockback and stun.
  // `scale` widens the danger zone for bigger blasts.
  blast(ex, ey, scale = 1) {
    if (!this.alive || this.abduct) return;
    const dx = (this.x - ex) / TILE, dy = (this.y - ey) / TILE;
    const dist = Math.hypot(dx, dy) / scale;
    if (dist > 4.6) return;
    if (this.invincible()) { FX.text(this.x, this.y, 'IMMUNE', '#e2b8ff', 15); return; }
    if (Settings.gore && dist < 3.1) {
      this.char = 3.5;
      FX.scorch(this.x, this.y);
    }
    let cells, stun;
    if (dist < 1.6) { cells = 2; stun = 1.7; }
    else if (dist < 3.1) { cells = 1; stun = 1.0; }
    else { cells = 0; stun = 0.45; }
    let sx = 0, sy = 0;
    if (dist < 0.15) sy = -1;
    else if (Math.abs(dx) > Math.abs(dy)) sx = sign(dx);
    else sy = sign(dy);
    this.knockback(sx, sy, cells, stun);
    FX.text(this.x, this.y + 10, cells ? 'KNOCKED BACK!' : 'DAZED', '#ffe34d', 15);
  },

  knockback(sx, sy, cells, stun) {
    this.queue = null;
    this.hop = null;
    this.ride = null;
    this.flap = 0;
    // snap the logical cell to wherever we are right now
    this.col = clamp(Math.round(this.x / TILE - 0.5), 0, COLS - 1);
    this.row = Math.max(0, Math.round(this.y / TILE));
    let c = this.col, r = this.row, moved = 0;
    for (let i = 0; i < cells; i++) {
      if (World.isBlocked(c + sx, r + sy)) break;
      c += sx;
      r += sy;
      moved++;
    }
    if (cells > 0) {
      const dur = (0.3 + 0.1 * moved) * lerp(1, 1.6, 1 - Events.gravity);
      this.knock = {
        fx: this.x, fy: this.y, tx: cellX(c), ty: r * TILE, t: 0, dur,
        h: (0.45 + 0.35 * moved) * TILE / Math.max(0.4, Events.gravity),
        spin: (sx !== 0 ? sx : -sy) * Math.PI * 2,
      };
      this.col = c;
      this.row = r;
      if (this.id === 0) Ghost.mark(Game.time, cellX(c), r * TILE, 'k');
    }
    this.stun = Math.max(this.stun, stun + (this.knock ? this.knock.dur : 0));
    Sound.stun();
  },

  // How the run ends decides what's left to see.
  die(how, dir, gore) {
    this.alive = false;
    this.hop = this.knock = this.queue = this.abduct = null;
    this.ride = null;
    this.stun = 0;
    this.flap = 0;
    this.char = 0;
    if (this.id === 0) Ghost.mark(Game.time, this.x, this.y, 'd');
    if (how === 'drown' || how === 'swept') {
      if (gore) this.gone = true;
      else this.sink = 0.01;
      return;
    }
    if (how === 'pit') { this.sink = 0.01; return; }
    if (gore && (how === 'train' || how === 'goose' || how === 'meteor' || how === 'lightning')) { this.gone = true; return; }
    if (gore) { // run over or crushed
      this.flat = true;
      this.z = 0;
      this.rot = 0;
      this.x += dir * 6;
      this.trail.length = 0;
      return;
    }
    const k = how === 'train' ? 2.6 : how === 'meteor' ? 1.8 : 1;
    this.rag = { vx: dir * rand(240, 320) * k, vy: rand(-30, 30), vz: 330 * Math.min(1.6, k), rotV: (dir || 1) * 13 * k, bounces: 0 };
  },

  updateRagdoll(dt) {
    const r = this.rag;
    r.vz -= 1100 * Events.gravity * dt;
    this.x += r.vx * dt;
    this.y += r.vy * dt;
    this.z += r.vz * dt;
    this.rot += r.rotV * dt;
    if (this.z <= 0) {
      this.z = 0;
      if (r.bounces < 2 && Math.abs(r.vz) > 60) {
        r.vz = Math.abs(r.vz) * 0.38;
        r.vx *= 0.5;
        r.vy *= 0.5;
        r.rotV *= 0.5;
        r.bounces++;
        FX.dust(this.x, this.y, 6);
      } else {
        r.vz = 0;
        r.vx = damp(r.vx, 0, 8, dt);
        r.vy = damp(r.vy, 0, 8, dt);
        r.rotV = 0;
        this.rot = damp(this.rot, Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2), 10, dt);
      }
    }
  },
};

function makePlayer(id) {
  const p = Object.create(PlayerProto);
  p.id = id;
  p.reset();
  return p;
}

const Player = makePlayer(0);
const Player2 = makePlayer(1);
