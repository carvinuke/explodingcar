'use strict';
// Boom Run: game flow, HUD, garage, trophies and input.

const BRGame = {
  state: 'title', // title | playing | paused | dying | over
  mode: 'endless',
  settings: { low: false, shake: true },
  input: { dir: 0, targetX: null, boost: false, brake: false, boom: false },

  init() {
    this.load();
    BRView.init(Kit.$('view'));
    FX.quality = this.settings.low ? 0.5 : 1;
    this.hooks();
    this.bind();
    Kit.unlockAudio();
    Wallet.onChange(() => this.refreshCoins());
    this.demo();
    this.showTitle();
    Kit.loop((dt, t) => this.frame(dt, t));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(true); });
    addEventListener('blur', () => { if (this.state === 'playing') this.pause(true); });
  },

  load() {
    const S = BR_STORE;
    this.settings.low = !!S.get('low', false);
    this.settings.shake = S.get('shake', true) !== false;
    this.bests = {};
    for (const m in BR_MODES) { const v = S.get(BR_MODES[m].best, 0); this.bests[m] = typeof v === 'number' ? v : 0; }
    this.owned = S.get('cars', ['hatch']);
    if (!Array.isArray(this.owned) || !this.owned.includes('hatch')) this.owned = ['hatch'];
    this.car = S.get('car', 'hatch');
    if (!this.owned.includes(this.car)) this.car = 'hatch';
    this.paints = S.get('paints', ['stock']);
    if (!Array.isArray(this.paints)) this.paints = ['stock'];
    this.paint = S.get('paint', 'stock');
    if (!BR_PAINTS[this.paint]) this.paint = 'stock';
    this.stats = Object.assign({ km: 0, runs: 0, near: 0, smash: 0, coins: 0, booms: 0 }, S.get('stats', {}) || {});
    const up = S.get('up', {}) || {};
    this.up = {};
    for (const k in BR_UPGRADES) this.up[k] = clamp(Math.floor(Number(up[k]) || 0), 0, BR_UPGRADES[k].cost.length);
    this.trophies = Kit.trophies(BR_TROPHIES, S, d => {
      Kit.toast(`🏆 ${d.name}`, 'trophy', 3000);
      Sound.trophy();
      if (this.runTrophies) this.runTrophies.push(d);
    });
  },

  paintColor() { return BR_PAINTS[this.paint].color || BR_CARS[this.car].color; },

  // ---- Runs --------------------------------------------------------------------
  // Behind the menus, a car drives itself down the highway.
  demo() {
    BRRoad.reset('endless', this.car, this.paintColor(), this.up);
    BRView.chunks = new Map(); // a new road: new scenery
    BRRoad.player.y = 600;
    BRRoad.player.v = 300;
    BRRoad.spawnY = 900;
    this.auto = true;
  },

  start(mode) {
    this.mode = mode;
    this.auto = false;
    FX.reset();
    BRRoad.reset(mode, this.car, this.paintColor(), this.up);
    BRView.chunks = new Map();
    BRRoad.player.v = 120;
    this.input.boom = false;
    this.runTrophies = [];
    this.banked = 0;
    this.state = 'playing';
    this.stats.runs++;
    Kit.hideScreens();
    Kit.$('toasts').innerHTML = '';
    Kit.$('hud').classList.remove('hidden');
    Kit.$('hud-timer').classList.toggle('hidden', mode !== 'checkpoint');
    Kit.$('hud-mode').textContent = BR_MODES[mode].name.toUpperCase();
    this.input.targetX = null;
    this.hudCache = {};
    this.hudCombo = -1;
    this.hudLow = null;
    this.chipKey = null;
    this.updateHud();
  },

  pause(on) {
    if (on && this.state === 'playing') { this.state = 'paused'; Kit.show('screen-pause'); Sound.engine(0); }
    else if (!on && this.state === 'paused') { this.state = 'playing'; Kit.hideScreens(); }
  },

  quit() {
    if (this.state === 'playing' || this.state === 'paused') this.bank(); // keep what you picked up
    Kit.$('hud').classList.add('hidden');
    this.demo();
    this.showTitle();
  },

  // Coins from the run go into the shared wallet.
  bank() {
    if (this.banked) return this.banked;
    const R = BRRoad, G = BR_CARS[this.car];
    const coins = Math.round(R.coins * (G.coins || 1) * (this.mode === 'wrongway' ? 2 : 1)) + Math.floor(R.meters / 250);
    Wallet.add(coins);
    this.banked = coins;
    this.stats.km += R.meters / 1000;
    this.stats.near += R.near;
    this.stats.smash += R.smash;
    this.stats.booms += R.booms;
    this.stats.coins += coins;
    BR_STORE.set('stats', this.stats);
    return coins;
  },

  end(reason) {
    if (this.state !== 'playing' && this.state !== 'dying') return;
    this.state = 'over';
    const R = BRRoad, score = R.score;
    const best = this.bests[this.mode] || 0, newBest = score > best;
    if (newBest) { this.bests[this.mode] = score; BR_STORE.set(BR_MODES[this.mode].best, score); }
    this.banked = 0;
    const coins = this.bank();
    this.checkTrophies();
    Kit.$('res-mode').textContent = BR_MODES[this.mode].name.toUpperCase();
    Kit.$('res-title').textContent = reason === 'time' ? 'Out of time' : 'Boom!';
    Kit.$('res-new').classList.toggle('hidden', !newBest);
    Kit.$('res-score').textContent = Kit.fmt(score);
    Kit.$('res-dist').textContent = `${(R.meters / 1000).toFixed(2)} km`;
    Kit.$('res-near').textContent = R.near;
    Kit.$('res-best').textContent = Kit.fmt(this.bests[this.mode]);
    Kit.$('res-coins').textContent = coins;
    Kit.$('res-cp-row').classList.toggle('hidden', this.mode !== 'checkpoint');
    Kit.$('res-cp').textContent = R.cpN;
    const tl = Kit.$('res-trophies');
    tl.innerHTML = '';
    for (const d of this.runTrophies) { const li = document.createElement('li'); li.textContent = `🏆 ${d.name}` + (d.coins ? ` (+${d.coins})` : ''); tl.appendChild(li); }
    Kit.$('hud').classList.add('hidden');
    Kit.show('screen-result');
  },

  checkTrophies() {
    const R = BRRoad, T = this.trophies, m = R.meters;
    if (m >= 1000) T.earn('km1');
    if (m >= 5000) T.earn('km5');
    if (m >= 10000) T.earn('km10');
    if (R.near >= 50) T.earn('near50');
    if (R.smash >= 10) T.earn('smash10');
    if (R.ramps >= 5) T.earn('ramps5');
    if (R.coins >= 100) T.earn('coins100');
    if (R.cpN >= 5) T.earn('cp5');
    if (this.mode === 'wrongway' && m >= 2000) T.earn('ww2');
    if (R.bestChain >= 5) T.earn('chain5');
    if (R.bestBoom >= 10) T.earn('boom10');
    if (R.cones >= 50) T.earn('cones50');
    if (R.razor >= 10) T.earn('razor10');
  },

  // ---- Road events ---------------------------------------------------------------
  hooks() {
    BRRoad.hooks = {
      near: (t, n, razor) => {
        if (this.auto) return;
        Sound.near(n);
        if (razor) Sound.whoosh(0.9, clamp((t.x - BRRoad.player.x) / 60, -1, 1));
        FX.text(t.x, t.y + 30, razor ? (n > 1 ? `RAZOR! x${n}` : 'RAZOR!') : n > 1 ? `CLOSE x${n}` : 'CLOSE!', razor ? '#ff7a2e' : '#ffd23f', (razor ? 15 : 13) + Math.min(6, n));
        BRView.kick = Math.max(BRView.kick, razor ? 0.5 : 0.25);
        if (n >= 10) this.trophies.earn('combo10');
        this.updateHud(true);
      },
      boomReady: () => {
        if (this.auto) return;
        Sound.powerup();
        Kit.toast(this.touchUI ? 'BOOM READY: tap BOOM!' : 'BOOM READY: press Space!', 'go', 2200);
      },
      boom: () => {
        if (this.auto) return;
        const p = BRRoad.player;
        Sound.explosion(0.6, 0);
        Sound.powerup();
        FX.flashScreen(0.35, '255,170,60');
        FX.text(p.x, p.y + 50, 'BOOM!', '#ff4f2e', 30);
        BRView.shake = 14;
        BRView.kick = 1;
      },
      boomEnd: kills => { if (!this.auto && kills > 0) FX.text(BRRoad.player.x, BRRoad.player.y + 50, `${kills} WRECKED`, '#ffd23f', 18); },
      tanker: t => {
        FX.tankerBlast(t.x, t.y, [t.car.base, '#ffb000']);
        Sound.explosion(1, clamp(t.x / 100, -1, 1), true);
        BRView.shake = 22;
      },
      cone: (it, pts) => {
        if (this.auto) return;
        Sound.thud ? Sound.thud() : Sound.land();
        if (it.kind !== 'cone') FX.text(it.x, it.y + 30, `+${pts}`, '#ffb000', 12);
      },
      oil: it => {
        if (this.auto) return;
        Sound.screech();
        FX.text(it.x, it.y + 30, 'OIL!', '#c9c9c9', 14);
        BRView.shake = 6;
      },
      coin: it => { if (!this.auto) { FX.coin(it.x, it.y); Sound.coin(); this.updateHud(); } },
      fuel: it => { FX.text(it.x, it.y + 30, '+250', '#ffd23f', 15); Sound.cash(); },
      power: it => {
        if (this.auto) return;
        FX.pickup(it.x, it.y, POWERUPS[it.type].color);
        FX.text(it.x, it.y + 40, POWERUPS[it.type].name.toUpperCase(), POWERUPS[it.type].color, 16);
        Sound.powerup();
      },
      ramp: t => { if (!this.auto) { Sound.boing(); FX.text(BRRoad.player.x, BRRoad.player.y + 40, t && t.carrier ? 'BIG AIR!' : 'AIR!', '#ffffff', 15); } },
      land: () => { FX.dust(BRRoad.player.x, BRRoad.player.y, 8); if (!this.auto) Sound.land(); },
      smash: (t, smash, chain) => {
        if (chain > 2 && FX.count > 700) FX.puff(t.x, t.y, 10, '#3a3a40'); // a big pile-up: go easy on the particles
        else FX.carCrash(t.x, t.y, [t.car.base]);
        Sound.explosion(chain > 1 ? 0.55 : 0.7, clamp(t.x / 100, -1, 1));
        BRView.shake = Math.max(BRView.shake, chain > 1 ? 10 : 8);
        if (smash && !this.auto) {
          const mul = BRRoad.player.boomT > 0 ? 2 : 1;
          FX.text(t.x, t.y + 40, chain > 1 ? `CHAIN x${chain} +${100 * chain * mul}` : `SMASH +${100 * mul}`, chain > 1 ? '#ff4f2e' : '#ff7a2e', 15 + Math.min(8, chain * 1.5));
        }
      },
      shieldBreak: () => { const p = BRRoad.player; FX.shieldBreak(p.x, p.y); Sound.shieldBreak(); },
      die: t => {
        const p = BRRoad.player;
        if (this.auto) { // the demo car never crashes for long: start it again
          FX.carCrash(p.x, p.y, [p.car.base]);
          setTimeout(() => { if (this.auto) this.demo(); }, 1200);
          return;
        }
        this.state = 'dying';
        const colors = [p.car.base, t ? t.car.base : '#888'];
        if (p.car.type === 'tanker' || (t && t.car.type === 'tanker')) FX.tankerBlast(p.x, p.y, colors);
        else FX.carCrashViolent(p.x, p.y, colors);
        Sound.explosion(1, 0, true);
        BRView.shake = 26;
        setTimeout(() => this.end('crash'), 1500);
      },
      checkpoint: add => { if (!this.auto) { Kit.toast(`CHECKPOINT +${add}s`, 'go'); Sound.mission(); } },
      timeUp: () => { if (!this.auto && this.state === 'playing') { Sound.whistleEnd(); this.end('time'); } },
      biome: () => {},
    };
  },

  // ---- Frame ----------------------------------------------------------------------
  frame(dt, t) {
    const R = BRRoad;
    if (this.state === 'playing' || this.state === 'dying') {
      R.update(dt, this.state === 'dying' ? { dir: 0, targetX: null } : this.input);
      this.input.boom = false;
      FX.update(dt);
      this.hudT = (this.hudT || 0) - dt;
      if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); }
      this.boostBar();
      const p = R.player;
      if (!p.dead && this.state === 'playing') {
        // tyre smoke when you throw it about, grit and a rumble on the gravel
        if (Math.abs(p.vx) > 210 && p.z === 0 && Math.random() < dt * 14) FX.puff(p.x - Math.sign(p.vx) * 8, p.y - 14, 3, '#d8d8d4');
        if (p.rumble && p.z === 0) { if (Math.random() < dt * 10) FX.dust(p.x, p.y - 10, 2); BRView.shake = Math.max(BRView.shake, 1.2); }
        if (p.spinT > 0 && Math.random() < dt * 20) FX.puff(p.x, p.y - 10, 4, '#cfcfcf');
      }
      Sound.engine(p.dead || this.state !== 'playing' ? 0 : clamp(p.v / 900, 0.05, 1), p.burning || p.boomT > 0);
    } else if (this.state !== 'paused') {
      Sound.engine(0);
      R.update(dt, this.autopilot());
      FX.update(dt);
    }
    // smoke from your wreck
    const p = R.player;
    if (p.dead && Math.random() < dt * 14) FX.wreckSmoke(p.x, p.y, 18, true);
    if (p.dead && Math.random() < dt * 12) FX.wreckFire(p.x, p.y, 14);
    BRView.draw(t, dt);
  },

  // The demo car steers around traffic on its own (it looks further ahead the faster it goes).
  autopilot() {
    const R = BRRoad, p = R.player, look = 90 + p.v * 0.45;
    let best = p.x, bestGap = -Infinity;
    BR_LANES.forEach((x, lane) => {
      // can't get there if a car is alongside in any lane on the way
      const lo = Math.min(x, p.x) - 24, hi = Math.max(x, p.x) + 24;
      let blocked = false, gap = 1e9;
      for (const t of R.traffic) {
        if (t.flung) continue;
        const dy = t.y - p.y;
        if (t.x > lo && t.x < hi && dy > -60 && dy < 130 && Math.abs(t.x - p.x) > 20) blocked = true;
        if (Math.abs(t.x - x) < 30 && dy > -40) gap = Math.min(gap, dy);
      }
      for (const z of R.zones) if (z.lane === lane && z.y1 > p.y - 30) gap = Math.min(gap, Math.max(0, z.y0 - p.y)); // coned off
      if (blocked) return;
      gap -= Math.abs(x - p.x) * 0.8;
      if (gap > bestGap) { bestGap = gap; best = x; }
    });
    const tooClose = bestGap < look;
    return { dir: 0, targetX: best, boost: false, brake: tooClose };
  },

  // ---- HUD -----------------------------------------------------------------------
  // Only touch the page when a number actually changes (slow computers notice).
  setText(id, v) {
    const cache = this.hudCache || (this.hudCache = {});
    if (cache[id] === v) return;
    cache[id] = v;
    Kit.$(id).textContent = v;
  },

  updateHud(bump) {
    const R = BRRoad, p = R.player;
    this.setText('hud-dist', R.meters >= 1000 ? `${(R.meters / 1000).toFixed(2)} km` : `${R.meters} m`);
    this.setText('hud-score', Kit.fmt(R.score));
    this.setText('hud-speed', `${Math.round(p.v * 0.036) * 10} km/h`);
    this.setText('hud-run-coins', String(R.coins));
    const combo = Kit.$('hud-combo');
    if (this.hudCombo !== R.combo) {
      this.hudCombo = R.combo;
      combo.classList.toggle('hidden', R.combo < 2);
      combo.querySelector('b').textContent = `x${R.combo}`;
    }
    if (bump && R.combo >= 2) { combo.classList.remove('bump'); void combo.offsetWidth; combo.classList.add('bump'); }
    if (this.mode === 'checkpoint') {
      this.setText('hud-timer-val', String(Math.ceil(R.timeLeft)));
      const low = R.timeLeft < 8;
      if (this.hudLow !== low) { this.hudLow = low; Kit.$('hud-timer').classList.toggle('low', low); }
    }
    const chips = [];
    if (p.nitroT > 0) chips.push(['speed', `NITRO ${Math.ceil(p.nitroT)}`]);
    if (p.magnetT > 0) chips.push(['magnet', `MAGNET ${Math.ceil(p.magnetT)}`]);
    if (p.shield) chips.push(['shield', 'SHIELD']);
    const key = chips.map(c => c[1]).join('|');
    if (key !== this.chipKey) {
      this.chipKey = key;
      Kit.$('hud-powers').innerHTML = chips.map(([k, txt]) => `<span class="chip" style="--c:${POWERUPS[k].color}">${txt}</span>`).join('');
    }
  },

  // The boost bar: filled every frame (a transform, so it's cheap).
  boostBar() {
    const p = BRRoad.player, bar = this.barEls || (this.barEls = { box: Kit.$('hud-boost'), fill: Kit.$('hud-boost').querySelector('i'), lbl: Kit.$('hud-boost').querySelector('span'), btn: Kit.$('btn-boom') });
    const boom = p.boomT > 0, k = boom ? p.boomT / (BOOM_SECS + (BRRoad.up.fuse || 0) + (BRRoad.G.boomPlus || 0)) : p.boost;
    const kk = Math.round(k * 100) / 100;
    if (kk !== this.barK) { this.barK = kk; bar.fill.style.transform = `scaleX(${kk})`; }
    const st = boom ? 'boom' : p.boost >= 1 ? 'ready' : p.burning ? 'burn' : '';
    if (st !== this.barSt) {
      this.barSt = st;
      bar.box.className = 'boostbar ' + st;
      bar.lbl.textContent = boom ? 'BOOM!' : st === 'ready' ? (this.touchUI ? 'BOOM READY' : 'SPACE: BOOM') : 'BOOST';
      bar.btn.classList.toggle('hidden', st !== 'ready');
    }
  },

  refreshCoins() {
    const w = Kit.fmt(Wallet.get());
    for (const id of ['title-coins', 'garage-coins']) { const el = Kit.$(id); if (el) el.textContent = w; }
  },

  // ---- Menus -------------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    Kit.show('screen-title');
    Kit.$('best-endless').textContent = this.bests.endless ? `Best ${Kit.fmt(this.bests.endless)}` : '';
    Kit.$('best-checkpoint').textContent = this.bests.checkpoint ? `Best ${Kit.fmt(this.bests.checkpoint)}` : '';
    Kit.$('best-wrongway').textContent = this.bests.wrongway ? `Best ${Kit.fmt(this.bests.wrongway)}` : '';
    Kit.$('trophy-count').textContent = `${this.trophies.count}/${this.trophies.total}`;
    Kit.$('title-car').textContent = BR_CARS[this.car].name;
    this.refreshCoins();
  },

  showGarage() {
    const body = Kit.$('garage-body'), bank = Wallet.get();
    body.innerHTML = '';
    const sec = (title) => {
      const s = document.createElement('section');
      s.className = 'shop-sec';
      s.innerHTML = `<h3>${title}</h3><div class="shop-grid"></div>`;
      body.appendChild(s);
      return s.querySelector('.shop-grid');
    };
    const buy = (price, fn) => () => {
      if (!Wallet.spend(price)) { Kit.toast('Not enough coins'); return; }
      Sound.cash();
      fn();
      this.showGarage();
    };
    // cars, each with a little picture: the everyday ones, then the luxury lot
    const grids = { plain: sec('Cars'), lux: sec('Luxury') };
    for (const id in BR_CARS) {
      const G = BR_CARS[id], own = this.owned.includes(id), on = this.car === id;
      const grid = G.lux ? grids.lux : grids.plain;
      const el = document.createElement('div');
      el.className = 'car-card' + (on ? ' equipped' : '');
      el.innerHTML = `<canvas width="120" height="90"></canvas><div class="si-txt"><b></b><em></em><span class="bars"></span></div>`;
      el.querySelector('b').textContent = G.name;
      el.querySelector('em').textContent = G.perk;
      el.querySelector('.bars').innerHTML = `<span>Speed <i style="--w:${Math.round(clamp((G.speed - 0.85) / 0.6, 0.05, 1) * 100)}%"></i></span><span>Grip <i style="--w:${Math.round(clamp((G.grip - 0.75) / 0.7, 0.05, 1) * 100)}%"></i></span>`;
      this.carPicture(el.querySelector('canvas'), id);
      const btn = document.createElement('button');
      if (on) { btn.className = 'btn-plate small'; btn.textContent = 'Driving'; btn.disabled = true; }
      else if (own) { btn.className = 'btn-yellow small'; btn.textContent = 'Drive'; btn.addEventListener('click', () => { this.car = id; BR_STORE.set('car', id); Sound.click(); this.demo(); this.showGarage(); }); }
      else {
        btn.className = 'btn-yellow small';
        btn.innerHTML = `<span class="coin-ico"></span> ${Kit.fmt(G.price)}`;
        if (bank >= G.price) btn.addEventListener('click', buy(G.price, () => {
          this.owned.push(id); BR_STORE.set('cars', this.owned); this.car = id; BR_STORE.set('car', id);
          this.trophies.earn('garage');
          if (G.lux) this.trophies.earn('supercar');
          if (Object.keys(BR_CARS).every(k => this.owned.includes(k))) this.trophies.earn('fleet');
          this.demo();
        }));
        else { btn.disabled = true; el.classList.add('poor'); }
      }
      el.appendChild(btn);
      grid.appendChild(el);
    }
    // upgrades
    const ug = sec('Upgrades');
    for (const id in BR_UPGRADES) {
      const U = BR_UPGRADES[id], lvl = this.up[id], max = U.cost.length, price = U.cost[lvl];
      const el = document.createElement('div');
      el.className = 'car-card upg';
      el.innerHTML = `<div class="si-txt"><b></b><em></em><span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div>`;
      el.querySelector('b').textContent = U.name;
      el.querySelector('em').textContent = U.desc;
      const btn = document.createElement('button');
      if (lvl >= max) { btn.className = 'btn-plate small'; btn.textContent = 'Maxed'; btn.disabled = true; }
      else {
        btn.className = 'btn-yellow small';
        btn.innerHTML = `<span class="coin-ico"></span> ${Kit.fmt(price)}`;
        if (bank >= price) btn.addEventListener('click', buy(price, () => { this.up[id] = lvl + 1; BR_STORE.set('up', this.up); this.demo(); }));
        else { btn.disabled = true; el.classList.add('poor'); }
      }
      el.appendChild(btn);
      ug.appendChild(el);
    }
    // paint
    const pg = sec('Paint');
    for (const id in BR_PAINTS) {
      const P2 = BR_PAINTS[id], own = this.paints.includes(id), on = this.paint === id;
      const b = document.createElement('button');
      b.className = 'paint' + (on ? ' on' : '') + (own ? '' : ' locked');
      b.style.setProperty('--paint', P2.color || BR_CARS[this.car].color);
      b.innerHTML = `<span class="swatch"></span><b></b><em>${on ? 'On' : own ? 'Yours' : Kit.fmt(P2.price)}</em>`;
      b.querySelector('b').textContent = P2.name;
      if (on) b.disabled = true;
      else if (own) b.addEventListener('click', () => { this.paint = id; BR_STORE.set('paint', id); Sound.click(); this.demo(); this.showGarage(); });
      else if (bank >= P2.price) b.addEventListener('click', buy(P2.price, () => { this.paints.push(id); BR_STORE.set('paints', this.paints); this.paint = id; BR_STORE.set('paint', id); this.demo(); }));
      else b.disabled = true;
      pg.appendChild(b);
    }
    this.refreshCoins();
    Kit.show('screen-garage');
  },

  carPicture(cv, id) {
    const g = cv.getContext('2d'), G = BR_CARS[id];
    const car = Cars.make(G.type, this.car === id ? this.paintColor() : G.color, 'E');
    const k = Math.min(1.9, 100 / car.len);
    g.setTransform(k, 0, 0, k, 60, 62);
    Cars.shadow(g, car, 0.8);
    Cars.draw(g, car, 0.2);
  },

  showTrophies() {
    Kit.renderTrophies(Kit.$('trophy-list'), this.trophies);
    Kit.$('trophies-count').textContent = `${this.trophies.count}/${this.trophies.total}`;
    const s = this.stats;
    Kit.$('stats').innerHTML = `<span>Driven <b>${s.km.toFixed(1)} km</b></span><span>Runs <b>${Kit.fmt(s.runs)}</b></span><span>Close calls <b>${Kit.fmt(s.near)}</b></span><span>Smashed <b>${Kit.fmt(s.smash)}</b></span><span>BOOMs <b>${Kit.fmt(s.booms || 0)}</b></span>`;
    Kit.show('screen-trophies');
  },

  showSettings() {
    const set = (id, on) => Kit.$(id).setAttribute('aria-checked', on ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', this.settings.shake);
    set('set-low', this.settings.low);
    const r = Kit.$('btn-reset');
    delete r.dataset.armed;
    r.textContent = 'Reset Boom Run progress';
    Kit.show('screen-settings');
  },

  // ---- Input -----------------------------------------------------------------------
  bind() {
    const on = (id, fn) => Kit.$(id).addEventListener('click', () => { Sound.init(); fn(); });
    on('btn-play', () => this.start('endless'));
    on('btn-checkpoint', () => this.start('checkpoint'));
    on('btn-wrongway', () => this.start('wrongway'));
    on('btn-garage', () => { Sound.click(); this.showGarage(); });
    on('btn-trophies', () => { Sound.click(); this.showTrophies(); });
    on('btn-settings', () => { Sound.click(); this.showSettings(); });
    on('btn-resume', () => this.pause(false));
    on('btn-restart', () => { this.bank(); this.banked = 0; this.start(this.mode); });
    on('btn-quit', () => this.quit());
    on('btn-pause', () => this.pause(true));
    on('btn-again', () => this.start(this.mode));
    on('btn-res-garage', () => { this.demo(); this.showGarage(); });
    on('btn-res-menu', () => { this.demo(); this.showTitle(); });
    on('btn-garage-done', () => this.showTitle());
    on('btn-trophies-done', () => this.showTitle());
    on('btn-settings-done', () => this.showTitle());
    this.syncMute = Kit.muteButton(Kit.$('btn-mute'));
    on('set-sound', () => { Sound.setMuted(!Sound.muted); this.syncMute(); this.showSettings(); });
    on('set-shake', () => { this.settings.shake = !this.settings.shake; BR_STORE.set('shake', this.settings.shake); this.showSettings(); });
    on('set-low', () => { this.settings.low = !this.settings.low; BR_STORE.set('low', this.settings.low); BRView.setLow(this.settings.low); this.showSettings(); });
    on('btn-reset', () => {
      const r = Kit.$('btn-reset');
      if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = 'Tap again to delete your cars, bests and trophies'; return; }
      const keep = { low: this.settings.low, shake: this.settings.shake };
      BR_STORE.wipe();
      BR_STORE.set('low', keep.low); BR_STORE.set('shake', keep.shake);
      this.load();
      this.demo();
      Kit.toast('Boom Run progress deleted');
      this.showSettings();
    });

    // keyboard
    const keys = new Set();
    const read = () => {
      this.input.dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      this.input.boost = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight') || this.touchBoost;
      this.input.brake = keys.has('ArrowDown') || keys.has('KeyS') || this.touchBrake;
      if (this.input.dir) this.input.targetX = null;
    };
    addEventListener('keydown', e => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause(true); else if (this.state === 'paused') this.pause(false);
        return;
      }
      if (e.code === 'KeyM') { Sound.setMuted(!Sound.muted); this.syncMute(); return; }
      if ((e.code === 'Space' || e.code === 'Enter') && this.state === 'over' && Kit.shown('screen-result') && !e.repeat) { e.preventDefault(); this.start(this.mode); return; }
      if ((e.code === 'Space' || e.code === 'KeyB') && this.state === 'playing' && !e.repeat) { e.preventDefault(); this.input.boom = true; return; }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      keys.add(e.code);
      read();
    });
    addEventListener('keyup', e => { keys.delete(e.code); read(); });
    addEventListener('blur', () => { keys.clear(); read(); });

    // drag to steer: your car heads for the finger (or mouse while held)
    const cv = Kit.$('view');
    let dragging = false;
    const toX = e => {
      const r = cv.getBoundingClientRect(), s = BRView.scale;
      const camX = clamp(BRRoad.player.x * 0.25, -20, 20);
      return (e.clientX - r.left - BRView.ox) / s + camX;
    };
    cv.addEventListener('pointerdown', e => { if (this.state !== 'playing') return; dragging = true; cv.setPointerCapture(e.pointerId); this.input.targetX = toX(e); });
    cv.addEventListener('pointermove', e => { if (dragging) this.input.targetX = toX(e); });
    const up = () => { dragging = false; this.input.targetX = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    // the BOOM button (touch) shows up when the bar is full
    Kit.$('btn-boom').addEventListener('pointerdown', e => { e.preventDefault(); if (this.state === 'playing') this.input.boom = true; });
    addEventListener('touchstart', () => { this.touchUI = true; }, { once: true, passive: true });
    // touch boost / brake buttons
    for (const [id, prop] of [['btn-boost', 'touchBoost'], ['btn-brake', 'touchBrake']]) {
      const b = Kit.$(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); this[prop] = true; read(); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { this[prop] = false; read(); });
    }
  },
};

BRGame.init();
