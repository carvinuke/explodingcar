'use strict';
// Reverse Day: every so often the whole game flips over. For 20 seconds
// you're the car, and chickens stream across a five-lane highway.
// Up/down change lanes, right speeds up, left brakes. Every chicken you
// pass untouched is worth coins; every one you hit costs coins and a point
// off your licence. Lose all five points and the day ends early.

const REV = {
  LANES: 5,
  Y0: -60000,           // the highway lives far away from the real road
  DUR: 20,
  FLIP: 1.0,            // seconds for the flip in and out
  CRUISE: 250, MIN: 150, MAX: 400,
  POINTS: 5,
};

const TREE_PAL = { top: '#56a846', front: '#3f8a37', top2: '#6cc255', front2: '#50a043' };
const BUSH_PAL = { top: '#62b44e', front: '#4b953d', top2: '#77c75f', front2: '#5aa648' };
const CHICK_SKINS = ['chick', 'chick', 'chick', 'chick', 'duck', 'hardhat', 'penguin', 'silver', 'raccoon', 'frog'];

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fill();
}

const Reverse = {
  active: false,
  phase: 'off',   // off | in | play | out
  t: 0,
  cd: 90,
  car: null,
  chicks: [],
  decor: [],
  res: null,

  reset() {
    if (this.active) this.finish(true);
    this.active = false;
    this.phase = 'off';
    this.cd = rand(80, 120);
    this.chicks.length = 0;
    this.decor.length = 0;
    this.setFlip(1);
  },

  // Only in single-player Endless and Hardcore (Time Attack needs its clock).
  allowed() { return Game.players.length === 1 && (Game.mode === 'normal' || Game.mode === 'hardcore'); },

  // Is the flipped world what's on screen right now?
  get arena() {
    if (!this.active) return false;
    if (this.phase === 'in') return this.t >= this.FLIP_HALF;
    if (this.phase === 'out') return this.t < this.FLIP_HALF;
    return true;
  },
  FLIP_HALF: REV.FLIP / 2,

  update(dt) {
    if (!this.active) {
      if (Game.state !== 'playing' || !this.allowed()) return;
      this.cd -= dt;
      if (this.cd > 0) return;
      const p = Player, row = p.rowObj();
      const calm = p.alive && !p.hop && !p.knock && !p.abduct && !p.stomp && !p.ride && p.stun <= 0 && row && row.type === 'grass' && !Events.active && Game.slow.t <= 0;
      if (calm) this.start();
      return;
    }
    this.t += dt;
    if (this.phase === 'in') {
      this.setFlip(Math.abs(Math.cos(Math.PI * this.t / REV.FLIP)));
      if (this.t >= REV.FLIP) { this.phase = 'play'; this.t = 0; this.setFlip(1); }
      this.updateArena(dt * 0.3);
    } else if (this.phase === 'play') {
      this.updateArena(dt);
      if (this.t >= REV.DUR || this.res.points <= 0) this.end();
    } else if (this.phase === 'out') {
      this.setFlip(Math.abs(Math.cos(Math.PI * this.t / REV.FLIP)));
      if (this.t < this.FLIP_HALF) this.updateArena(dt * 0.3);
      if (this.t >= REV.FLIP) this.finish();
    }
  },

  // Squash the canvas like a card turning over.
  setFlip(k) {
    const el = Renderer.canvas;
    if (!el) return;
    const v = k >= 0.999 ? '' : `scaleY(${Math.max(0.02, k).toFixed(3)})`;
    if (el.style.transform !== v) el.style.transform = v;
  },

  start() {
    this.active = true;
    this.phase = 'in';
    this.t = 0;
    const sk = Player.skin();
    const car = Vehicles.make({ speed: REV.CRUISE, dir: 1 }, 'sports', REV.Y0 + 2 * TILE);
    car.base = sk.kind === 'bigj' ? (sk.face && sk.face[0] === '#' ? sk.face : '#ff4fa3') : sk.rainbow ? '#ff4fa3' : sk.front;
    car.pal = Draw.vehiclePalette(car.base);
    car.dark = false;
    car.x = 0;
    this.car = car;
    this.lane = 2;
    this.speed = REV.CRUISE;
    this.want = REV.CRUISE;
    this.wob = 0;
    this.chicks.length = 0;
    this.spawnT = 0.4;
    this.waveT = 4;
    this.res = { dodged: 0, hit: 0, coins: 0, streak: 0, points: REV.POINTS };
    this.decor.length = 0;
    this.decorX = -6 * TILE;
    this.fillDecor();
    Player.queue = null;
    Sound.flip();
    Sound.eventSting();
    Roadex.see('events', 'reverseday');
    // a head start: a few chickens already on the road
    for (let k = 0; k < 4; k++) this.spawn(this.car.x + (6 + k * 3) * TILE, true);
  },

  // Out of time (or licence points): flip back.
  end() {
    if (this.phase !== 'play') return;
    this.phase = 'out';
    this.t = 0;
    Sound.flip();
  },

  finish(silent) {
    this.active = false;
    this.phase = 'off';
    this.cd = rand(110, 170);
    this.setFlip(1);
    this.chicks.length = 0;
    if (silent || !this.res) return;
    const r = this.res;
    Player.grace = Math.max(Player.grace, 2);
    const title = r.points <= 0 ? 'LICENCE REVOKED' : 'BACK TO NORMAL';
    UI.toast('t-reverse', title, `Dodged ${r.dodged} · hit ${r.hit} · ${r.coins >= 0 ? '+' : ''}${r.coins} coins`, 4200);
    if (Pets.has('alien')) Game.giveCoins(Pets.up(50, 100), Player, `SPACE BUDDY +${Pets.up(50, 100)}`, '#9bff7a');
    if (Game.tracksProgress()) {
      Stats.add('revDodged', r.dodged);
      Trophies.max('revDodge', r.dodged);
      if (r.hit === 0 && r.dodged > 0 && r.points > 0) Trophies.add('revClean');
      Missions.add('events');
      Trophies.add('events');
      Stats.add('events');
    }
  },

  input(dx, dy) {
    if (this.phase !== 'play' && this.phase !== 'in') return;
    if (dy) {
      const nl = clamp(this.lane + dy, 0, REV.LANES - 1);
      if (nl !== this.lane) { this.lane = nl; Sound.hop(false); }
      else Sound.bump();
    }
    if (dx) {
      this.want = clamp(this.want + dx * 75, REV.MIN, REV.MAX);
      if (dx > 0) Sound.whoosh(0.4, 0);
      else Sound.screech();
    }
  },

  laneY(l) { return REV.Y0 + l * TILE; },

  // A chicken appears at one verge and hops across. `mid` puts it already partway over.
  spawn(x, mid = false, opts = {}) {
    const up = opts.up !== undefined ? opts.up : chance(0.5);
    const lane = mid ? randInt(0, REV.LANES - 1) : up ? -1 : REV.LANES;
    const golden = !opts.plain && chance(0.07);
    const kind = golden ? 'golden' : pick(CHICK_SKINS);
    const pace = opts.pace || rand(0.28, 0.55);
    this.chicks.push({
      x, y: this.laneY(lane), lane, dir: up ? 1 : -1, z: 0,
      hop: null, wait: mid ? rand(0, 0.3) : rand(0, 0.6), pace,
      pause: !opts.plain && chance(0.2) ? randInt(1, 3) : -1, // some stop dead in the road
      skin: SKINS[kind], golden, facing: up ? 'up' : 'down',
      squash: 0, rot: 0, flap: 0, char: 0, blinkSeed: rand(3),
      state: 'cross', passed: false, vx: 0, vz: 0,
    });
  },

  // A line of chickens crossing together, with one gap to thread.
  wave(x) {
    const up = chance(0.5), gap = randInt(0, REV.LANES - 1);
    for (let l = 0; l < REV.LANES; l++) {
      if (l === gap) continue;
      this.spawn(x + rand(-0.3, 0.3) * TILE, false, { up, plain: true, pace: 0.9 });
      const ch = this.chicks[this.chicks.length - 1];
      ch.lane = l;
      ch.y = this.laneY(l);
      ch.wait = 99; // they hold the line, then all move off together
      ch.hold = 3.4;
    }
    FX.text(x, this.laneY(2), 'FLOCK!', '#ffd23f', 22);
  },

  fillDecor() {
    const ahead = this.car.x + 30 * TILE;
    while (this.decorX < ahead) {
      this.decorX += rand(0.8, 2.2) * TILE;
      for (const side of [-1, 1]) {
        if (chance(0.35)) continue;
        const y = side < 0 ? this.laneY(-1) - rand(0.3, 1.8) * TILE : this.laneY(REV.LANES) + rand(0.3, 1.8) * TILE;
        const kind = chance(0.6) ? 'tree' : 'bush';
        this.decor.push({ kind, x: this.decorX + rand(-10, 10), y, tiers: randInt(1, 3), size: rand(13, 16), pal: kind === 'tree' ? TREE_PAL : BUSH_PAL, flower: kind === 'bush' && chance(0.4) ? pick(['#ff6b6b', '#ffd23f', '#ffffff']) : null });
      }
    }
    const behind = this.car.x - 16 * TILE;
    while (this.decor.length && this.decor[0].x < behind) this.decor.shift();
  },

  updateArena(dt) {
    const car = this.car, r = this.res;
    this.speed = damp(this.speed, this.want, 3, dt);
    this.want = damp(this.want, REV.CRUISE, 0.25, dt); // drifts back to cruising speed
    car.x += this.speed * dt;
    car.speed = this.speed;
    car.y = damp(car.y, this.laneY(this.lane), 14, dt);
    this.wob = damp(this.wob, 0, 5, dt);
    car.rot = this.wob * Math.sin(Game.time * 30) + (this.laneY(this.lane) - car.y) * -0.004;
    this.fillDecor();
    if (Math.random() < dt * 30 * (this.speed / REV.MAX)) { // exhaust
      FX.spawn('smoke', car.x - car.len / 2 - 2, car.y, 8, { vx: -40, vz: rand(10, 30), g: -10, drag: 1, life: 0.5, size: 3, size2: 7, color: '#b8b8c0', alpha: 0.5 });
    }

    // more chickens the longer it goes on
    if (this.phase === 'play') {
      const heat = clamp(this.t / REV.DUR, 0, 1);
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = lerp(0.62, 0.33, heat) * rand(0.7, 1.3) * (REV.CRUISE / Math.max(REV.MIN, this.speed));
        this.spawn(car.x + rand(9, 13) * TILE);
      }
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = rand(4.5, 6.5); this.wave(car.x + 12 * TILE); }
    }

    for (const ch of this.chicks) {
      if (ch.state === 'hit') { // flying off the bonnet
        ch.x += ch.vx * dt;
        ch.vz -= 900 * dt;
        ch.z = Math.max(0, ch.z + ch.vz * dt);
        ch.rot += dt * 14;
        ch.vx = damp(ch.vx, 0, 1.5, dt);
        continue;
      }
      if (ch.hold !== undefined) { // a flock waits, then goes all at once
        ch.hold -= dt;
        if (ch.hold <= 0) { ch.wait = 0; delete ch.hold; }
      }
      if (ch.hop) {
        const h = ch.hop;
        h.t = Math.min(1, h.t + dt / 0.16);
        ch.y = lerp(h.fy, h.ty, easeOutQuad(h.t));
        ch.z = Math.sin(Math.PI * h.t) * 9;
        ch.flap = Math.sin(Math.PI * h.t);
        if (h.t >= 1) { ch.hop = null; ch.z = 0; ch.flap = 0; ch.squash = 0.4; }
      } else if (ch.state === 'cross') {
        ch.wait -= dt;
        if (ch.wait <= 0) {
          const nl = ch.lane + ch.dir;
          if (nl < -1 || nl > REV.LANES) ch.state = 'safe';
          else {
            ch.lane = nl;
            ch.hop = { fy: ch.y, ty: this.laneY(nl), t: 0 };
            ch.wait = ch.pace;
            if (ch.pause === nl) { ch.wait = rand(0.9, 1.5); ch.pause = -1; } // stops dead, right in front of you
          }
        }
      }
      ch.squash = damp(ch.squash, 0, 12, dt);
      if (this.phase === 'out') continue;
      // hit?
      const onRoad = ch.lane >= 0 && ch.lane < REV.LANES;
      if (onRoad && ch.z < 12 && Math.abs(ch.y - car.y) < 0.55 * TILE && Math.abs(ch.x - car.x) < car.len / 2 + 6) {
        this.hitChick(ch);
        continue;
      }
      // passed it untouched
      if (!ch.passed && ch.x < car.x - car.len / 2 - 6) {
        ch.passed = true;
        const n = ch.golden ? 5 : 1;
        r.dodged++;
        r.streak++;
        this.pay(n, ch.x, ch.y, ch.golden ? `GOLDEN! +${n}` : `+${n}`, ch.golden ? '#ffd23f' : '#9ff28a');
        Sound.dodge(Math.min(10, r.streak % 12));
        if (r.streak % 10 === 0) {
          this.pay(3, car.x, car.y, `${r.streak} CLEAN! +3`, '#7fe0ff');
          Sound.coin();
        }
      }
    }
    // tidy up: chickens far behind the car
    for (let i = this.chicks.length - 1; i >= 0; i--) if (this.chicks[i].x < car.x - 14 * TILE) this.chicks.splice(i, 1);
  },

  pay(n, x, y, text, color) {
    const p = Player;
    const before = p.coins;
    p.coins = Math.max(0, p.coins + n);
    Game.coins = p.coins;
    this.res.coins += p.coins - before;
    if (n > 0) Game.addBonus(10 * n, p);
    FX.text(x, y + 10, text, color, n > 1 || n < 0 ? 18 : 14);
  },

  hitChick(ch) {
    const r = this.res, car = this.car;
    ch.state = 'hit';
    ch.passed = true;
    ch.vx = this.speed * 1.2 + 120;
    ch.vz = rand(260, 360);
    r.hit++;
    r.streak = 0;
    r.points--;
    this.pay(-3, ch.x, ch.y, r.points > 0 ? `-3  (${r.points} POINT${r.points > 1 ? 'S' : ''} LEFT)` : 'LICENCE REVOKED!', '#ff6b6b');
    if (Settings.gore) FX.bleed(ch.x, ch.y, 24);
    FX.feathers(ch.x, ch.y, ch.skin);
    Sound.thud(1, 0);
    Sound.cluck();
    Cam.addTrauma(0.35);
    FX.flashScreen(0.2, '255,90,90');
    this.want = Math.max(REV.MIN, this.want - 60);
    this.speed *= 0.8;
    this.wob = 0.12;
    car.bloody = Settings.gore;
    car.bloodT = 2;
  },

  // ---- Drawing -------------------------------------------------------------
  draw(c, time) {
    const R = Renderer, W = R.W, H = R.H, car = this.car;
    const k = R.base * (W < 600 ? 0.98 : 0.82);
    this.k = k;
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.fillStyle = '#6fae55';
    c.fillRect(0, 0, W, H);
    const camX = car.x + (W * 0.18) / k, camY = this.laneY(2);
    c.translate(W / 2 + Cam.sx, H * 0.56 + Cam.sy);
    c.rotate(Cam.rot);
    c.scale(k, k);
    c.translate(-camX, camY * GY);
    const x0 = camX - W / 2 / k - TILE, x1 = camX + W / 2 / k + TILE, w = x1 - x0;

    // verges, hard shoulder, lanes (far to near)
    for (let l = REV.LANES + 3; l >= -4; l--) {
      const y = this.laneY(l), yT = y + TILE / 2;
      if (l < 0 || l >= REV.LANES) {
        c.fillStyle = (l & 1) ? '#7ccf5a' : '#74c552';
        c.fillRect(x0, P(yT, 4), w, TILE * GY + 0.5);
        if (l === -1) { c.fillStyle = '#5f9c45'; c.fillRect(x0, P(yT - TILE, 4), w, 4 * GZ); }
      } else {
        c.fillStyle = '#4a4d57';
        c.fillRect(x0, P(yT, 0), w, TILE * GY + 0.5);
      }
    }
    c.fillStyle = '#f2f2f2'; // edge lines
    c.fillRect(x0, P(this.laneY(REV.LANES) - TILE / 2 + 3, 0), w, 2);
    c.fillRect(x0, P(this.laneY(-1) + TILE / 2 - 1, 0), w, 2);
    c.fillStyle = 'rgba(255,255,255,0.75)'; // dashes between lanes
    for (let l = 0; l < REV.LANES - 1; l++) {
      const yy = P(this.laneY(l) + TILE / 2, 0);
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) c.fillRect(x, yy - 1, 30, 2);
    }
    FX.drawDecals(c);

    // everything that stands up, far to near
    const list = [];
    for (const d of this.decor) if (d.x > x0 - TILE && d.x < x1 + TILE) list.push(d);
    for (const ch of this.chicks) if (ch.x > x0 - TILE && ch.x < x1 + TILE) list.push(ch);
    list.push(car);
    list.sort((a, b) => b.y - a.y);
    for (const o of list) {
      c.save();
      c.translate(o.x, P(o.y, 0));
      if (o === car) {
        Draw.shadow(c, 0, 0, car.len + 8, 30, 1);
        if (car.rot) c.rotate(car.rot);
        Draw.vehicle(c, car, 0, time);
        // you, driving, head out of the sunroof
        c.translate(2, P(0, 14));
        c.scale(0.62, 0.62);
        Draw.player(c, { facing: 'right', squash: 0, z: 0, rot: 0, flap: 0, char: 0, blinkSeed: 0, rage: 0 }, time, Player.skin(), Player.hat());
      } else if (o.kind === 'tree') {
        Draw.shadow(c, 0, 0, o.size * 2, o.size * 1.6, 0.6);
        Draw.tree(c, o, 0);
      } else if (o.kind === 'bush') {
        Draw.bush(c, o);
      } else {
        Draw.shadow(c, 0, 0, 20, 16, 0.6);
        if (o.golden) {
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = `rgba(255,210,60,${0.25 + 0.1 * Math.sin(time * 8)})`;
          c.beginPath(); c.arc(0, P(0, o.z + 12), 18, 0, 6.2832); c.fill();
          c.restore();
        }
        Draw.player(c, o, time, o.golden ? SKINS.golden : o.skin, null);
      }
      c.restore();
    }
    FX.draw(c);
    FX.drawTexts(c);

    // screen overlay: timer, licence points, dodged count
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const r = this.res, left = this.phase === 'play' ? Math.max(0, REV.DUR - this.t) : this.phase === 'in' ? REV.DUR : 0;
    const bw = Math.min(360, W - 32), bx = (W - bw) / 2, by = Math.max(84, H * 0.13);
    c.fillStyle = 'rgba(29,27,58,0.88)';
    rrect(c, bx, by, bw, 58, 9);
    c.strokeStyle = '#ffd23f';
    c.lineWidth = 2;
    c.strokeRect(bx + 4, by + 4, bw - 8, 50);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd23f';
    c.font = `900 15px ${UI_FONT}`;
    c.fillText(`REVERSE DAY  ·  ${Math.ceil(left)}s`, W / 2, by + 20);
    c.font = `800 12px ${UI_FONT}`;
    c.fillStyle = '#f7f7f2';
    const line = `DODGED ${r.dodged}  ·  ${r.coins >= 0 ? '+' : ''}${r.coins} COINS  ·  LICENCE `;
    const tw = c.measureText(line).width, gx = W / 2 - (tw + REV.POINTS * 10) / 2;
    c.textAlign = 'left';
    c.fillText(line, gx, by + 41);
    for (let i = 0; i < REV.POINTS; i++) {
      c.fillStyle = i < r.points ? '#7ed957' : 'rgba(255,255,255,0.18)';
      c.fillRect(gx + tw + i * 10, by + 36, 7, 10);
    }
    c.textAlign = 'center';
    // timer bar
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(bx + 10, by + 50, bw - 20, 3);
    c.fillStyle = left < 5 ? '#ff6b6b' : '#ffd23f';
    c.fillRect(bx + 10, by + 50, (bw - 20) * (left / REV.DUR), 3);
    if (this.phase === 'play' && this.t < 3) { // how to drive
      const touch = matchMedia('(hover: none)').matches;
      c.globalAlpha = Math.min(1, (3 - this.t) * 1.5);
      c.fillStyle = 'rgba(29,27,58,0.8)';
      const hw = Math.min(300, W - 40);
      rrect(c, W / 2 - hw / 2, H - 120, hw, 34, 8);
      c.fillStyle = '#fff';
      c.font = `800 13px ${UI_FONT}`;
      c.fillText(touch ? 'SWIPE UP / DOWN TO CHANGE LANES' : '↑ ↓ CHANGE LANES   ·   → FASTER   ·   ← BRAKE', W / 2, H - 103);
      c.globalAlpha = 1;
    }
    FX.drawFlash(c, W, H);
  },
};
