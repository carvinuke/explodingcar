'use strict';
// Traffic Control: game flow, HUD, menus, shop and trophies.

const TCGame = {
  state: 'title', // title | intro | playing | paused | over
  level: null,
  levelNo: 0,     // 1..15, or 0 for Endless
  settings: { low: false, shake: true },

  init() {
    this.load();
    TCView.init(Kit.$('view'));
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

  // Everything saved: settings, stars, upgrades, cosmetics, trophies.
  load() {
    const S = TC_STORE;
    this.settings.low = !!S.get('low', false);
    this.settings.shake = S.get('shake', true) !== false;
    this.stars = S.get('levels', {}) || {};
    this.best = S.get('best', 0) || 0;
    this.stats = Object.assign({ cars: 0, crashes: 0, medic: 0, runs: 0 }, S.get('stats', {}) || {});
    this.up = Object.assign({ patience: 0, strike: 0, start: 0 }, S.get('up', {}) || {});
    this.owned = Object.assign({ lights: ['classic'], themes: ['auto'] }, S.get('owned', {}) || {});
    this.lightStyle = S.get('light', 'classic');
    if (!TC_LIGHTS[this.lightStyle]) this.lightStyle = 'classic';
    this.theme = S.get('theme', 'auto');
    if (!TC_THEMES[this.theme]) this.theme = 'auto';
    this.usedPowers = new Set(S.get('used', []) || []);
    this.trophies = Kit.trophies(TC_TROPHIES, S, d => {
      Kit.toast(`🏆 ${d.name}`, 'trophy', 3000);
      Sound.trophy();
      if (this.runTrophies) this.runTrophies.push(d);
    });
  },

  // ---- Runs ----------------------------------------------------------------------
  // Behind the menus the crossing runs itself.
  demo() {
    this.levelNo = -1;
    this.level = Object.assign({}, TC_LEVELS[1], { rate: 0.34, patience: 99 });
    TCSim.reset(this.level);
    TCView.build(this.level.map, this.theme);
    TCView.fit();
    this.demoT = 5;
  },

  start(n) {
    this.levelNo = n;
    this.level = n > 0 ? TC_LEVELS[n - 1] : tcEndlessLevel(0);
    TCSim.reset(this.level, { patienceMul: 1 + 0.15 * this.up.patience });
    TCView.build(this.level.map, this.theme);
    TCView.fit();
    FX.reset();
    this.maxStrikes = 3 + (this.up.strike ? 1 : 0);
    this.powers = { freeze: 0, tow: 0, calm: 0 };
    if (this.up.start) this.powers[pick(['freeze', 'tow', 'calm'])]++;
    this.nextPower = 12;
    this.runCoins = 0;
    this.runMedic = 0;
    this.runTrophies = [];
    this.state = 'playing';
    this.stats.runs++;
    Kit.$('toasts').innerHTML = '';
    Kit.hideScreens();
    Kit.$('hud').classList.remove('hidden');
    Kit.$('hud-level').textContent = n > 0 ? `${n}. ${this.level.name.toUpperCase()}` : 'ENDLESS RUSH HOUR';
    this.updateHud();
  },

  intro(n) {
    const L = TC_LEVELS[n - 1];
    this.pendingLevel = n;
    Kit.$('intro-map').textContent = TC_MAPS[L.map].name.toUpperCase();
    Kit.$('intro-no').textContent = `LEVEL ${n}`;
    Kit.$('intro-name').textContent = L.name;
    const extras = [];
    if (L.turn) extras.push('turning cars');
    if (L.ambulance) extras.push('ambulances');
    if (L.reckless) extras.push('reckless drivers');
    if (L.train) extras.push('trains');
    if (L.rain) extras.push('rain');
    if (L.night) extras.push('night');
    if (L.rush) extras.push('rush hour');
    Kit.$('intro-goal').textContent = `Get ${L.goal} cars through. Three crashes and you're done.` + (extras.length ? ` Watch for ${extras.join(', ')}.` : '');
    Kit.$('intro-tip').textContent = L.tip || '';
    Kit.$('intro-tip').classList.toggle('hidden', !L.tip);
    this.state = 'intro';
    Kit.show('screen-intro');
  },

  end(won) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    const S = TCSim, n = this.levelNo;
    const crashes = S.crashes;
    let stars = 0;
    let coins = S.through;
    if (n > 0 && won) {
      stars = Math.max(1, 3 - crashes);
      coins += 10 * stars;
      const had = this.stars[n] || 0;
      if (stars > had) { this.stars[n] = stars; TC_STORE.set('levels', this.stars); }
      TC_STORE.set('stars', this.totalStars());
      Sound.levelUp();
    } else {
      if (n === 0) {
        coins += Math.floor(S.through / 25) * 10;
        if (S.through > this.best) { this.best = S.through; TC_STORE.set('best', this.best); }
      }
      Sound.gameOver();
    }
    Wallet.add(coins);
    this.runCoins = coins;
    this.stats.cars += S.through;
    this.saveStats();
    this.checkTrophies(won);

    // the report
    Kit.$('res-no').textContent = n > 0 ? `LEVEL ${n}` : 'ENDLESS';
    Kit.$('res-title').textContent = n > 0 ? (won ? (stars === 3 ? 'Perfect shift!' : 'Level clear!') : 'Gridlock!') : 'Shift over';
    Kit.$('res-stars').innerHTML = n > 0 ? [1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('') : '';
    Kit.$('res-stars').classList.toggle('hidden', n === 0);
    Kit.$('res-cars').textContent = n > 0 ? `${S.through} / ${this.level.goal}` : S.through;
    Kit.$('res-crashes').textContent = crashes;
    Kit.$('res-best-row').classList.toggle('hidden', n !== 0);
    Kit.$('res-best').textContent = this.best;
    Kit.$('res-coins').textContent = coins;
    const tl = Kit.$('res-trophies');
    tl.innerHTML = '';
    for (const d of this.runTrophies) { const li = document.createElement('li'); li.textContent = `🏆 ${d.name}` + (d.coins ? ` (+${d.coins})` : ''); tl.appendChild(li); }
    const hasNext = n > 0 && n < TC_LEVELS.length && (won || this.stars[n]);
    Kit.$('btn-next').classList.toggle('hidden', !hasNext);
    Kit.$('btn-next').textContent = 'NEXT';
    setTimeout(() => { if (this.state === 'over') { Kit.$('hud').classList.add('hidden'); Kit.show('screen-result'); } }, won ? 600 : 1300);
  },

  pause(on) {
    if (on && this.state === 'playing') { this.state = 'paused'; Kit.show('screen-pause'); }
    else if (!on && this.state === 'paused') { this.state = 'playing'; Kit.hideScreens(); }
  },

  quit() {
    Kit.$('hud').classList.add('hidden');
    this.demo();
    this.showTitle();
  },

  totalStars() { let n = 0; for (const k in this.stars) n += this.stars[k] || 0; return n; },
  unlocked(n) { return n === 1 || !!this.stars[n - 1]; },
  saveStats() { TC_STORE.set('stats', this.stats); },

  // ---- Simulation events ----------------------------------------------------------
  hooks() {
    TCSim.hooks = {
      through: car => {
        if (!this.playing()) return;
        if (TCSim.through >= this.nextPower) {
          this.nextPower += 12;
          const k = pick(['freeze', 'tow', 'calm']);
          if (this.powers[k] < 3) { this.powers[k]++; Kit.toast(`+1 ${TC_POWERS[k].name.toUpperCase()}`, 'power'); Sound.powerup(); }
        }
        if (this.levelNo === 0) {
          if (TCSim.through % 10 === 0) TCSim.setLevel(tcEndlessLevel(TCSim.through));
          if (TCSim.through === 50) this.trophies.earn('end50');
          if (TCSim.through === 150) this.trophies.earn('end150');
        }
        if (this.stats.cars + TCSim.through >= 1000) this.trophies.earn('total1000');
        this.updateHud();
        if (this.levelNo > 0 && TCSim.through >= this.level.goal) this.end(true);
      },
      commit: car => {
        if (!this.playing() || !car.medic) return;
        if (car.wait < 3.2) {
          Wallet.add(5);
          this.runCoins += 5;
          FX.text(car.x, car.y + 40, '+5 QUICK!', '#ffd23f', 15);
          Sound.coin();
          this.stats.medic++;
          if (this.stats.medic >= 10) this.trophies.earn('medic');
        }
      },
      crash: info => {
        const pan = clamp(info.x / 300, -1, 1);
        if (info.tanker) FX.tankerBlast(info.x, info.y, info.cars.map(c => c.base));
        else FX.carCrash(info.x, info.y, info.cars.map(c => c.base));
        Sound.explosion(1, pan, info.tanker || info.train);
        TCView.shake = info.tanker ? 22 : 14;
        if (!this.playing()) return;
        if (info.pile >= 3) this.trophies.earn('pileup');
        if (info.newStrike) {
          this.stats.crashes++;
          FX.text(info.x, info.y + 50, info.train ? 'TRAIN!' : 'CRASH!', '#ff5a4a', 18);
          this.updateHud(true);
          if (TCSim.crashes >= this.maxStrikes) this.end(false);
        }
      },
      honk: car => {
        Sound.honk2(clamp(car.x / 300, -1, 1));
        FX.text(car.x, car.y + 34, 'HONK!', '#ffffff', 12);
      },
      rage: car => { FX.text(car.x, car.y + 40, 'FINE THEN!', '#ff8a8a', 13); },
      rush: on => { if (this.playing()) Kit.toast(on ? 'RUSH HOUR!' : 'Rush hour is over', on ? 'warn' : ''); if (on) Sound.eventSting(); },
      trainWarn: () => { if (this.playing()) Kit.toast('TRAIN COMING', 'warn'); },
      trainHorn: () => Sound.trainHorn(0.6, 0.8),
      bell: () => Sound.bell(0.5),
      closeCall: car => {
        if (!this.playing()) return;
        FX.text(car.x, car.y + 40, 'CLOSE CALL!', '#ffd23f', 15);
        this.trophies.earn('train');
      },
    };
  },

  playing() { return this.state === 'playing' || this.state === 'paused'; },

  checkTrophies(won) {
    const n = this.levelNo, T = this.trophies;
    if (n > 0 && won) {
      T.earn('first');
      if (this.stars[n] === 3) T.earn('three');
      if (TCSim.honks === 0) T.earn('quiet');
      const all = map => TC_LEVELS.every(L => L.map !== map || this.stars[L.n]);
      if (all('main')) T.earn('main');
      if (all('downtown')) T.earn('downtown');
      if (all('rail')) T.earn('rail');
      if (this.totalStars() >= 45) T.earn('allstars');
    }
  },

  usePower(k) {
    if (this.state !== 'playing' || !this.powers[k]) return;
    if (k === 'tow' && !TCSim.cars.some(c => c.wreck)) { Kit.toast('No wrecks to tow'); return; }
    this.powers[k]--;
    if (k === 'freeze') { TCSim.freeze(3); Sound.freeze(); }
    if (k === 'tow') { TCSim.tow(); Sound.clang(1, 0); }
    if (k === 'calm') { TCSim.calm(); Sound.calm(); }
    this.usedPowers.add(k);
    TC_STORE.set('used', [...this.usedPowers]);
    if (this.usedPowers.size >= 3) this.trophies.earn('powers');
    this.updateHud();
  },

  // ---- Frame -------------------------------------------------------------------
  frame(dt, t) {
    if (this.state === 'playing') {
      TCSim.update(dt);
      FX.update(dt);
    } else if (this.state !== 'paused') {
      // the demo behind the menus switches its own lights
      this.demoT -= dt;
      if (this.demoT <= 0) { TCSim.swap(); this.demoT = 5.5; }
      TCSim.update(dt);
      FX.update(dt);
    }
    // a little smoke and fire from the wrecks
    for (const c of TCSim.cars) {
      if (!c.wreck || c.gone) continue;
      if (c.wreckT < 2.5 && Math.random() < dt * 20) FX.wreckFire(c.x, c.y, 16);
      if (Math.random() < dt * 9) FX.wreckSmoke(c.x, c.y, 18, c.wreckT < 3);
      if (c.medic && c.wreckT < 0.05) { /* sirens stop */ }
    }
    // ambulances wail as they come
    if (this.playing()) {
      this.sirenT = (this.sirenT || 0) - dt;
      if (this.sirenT <= 0 && TCSim.cars.some(c => c.medic && !c.wreck && !c.committed)) { this.sirenT = 1.1; Sound.wail(0, false); }
    }
    TCView.draw(t, dt);
  },

  // ---- HUD -----------------------------------------------------------------------
  updateHud(hit) {
    if (!this.level) return;
    Kit.$('hud-cars').textContent = this.levelNo > 0 ? `${TCSim.through}/${this.level.goal}` : TCSim.through;
    const st = Kit.$('hud-strikes');
    st.innerHTML = '';
    for (let i = 0; i < this.maxStrikes; i++) {
      const s = document.createElement('span');
      s.className = 'strike' + (i < TCSim.crashes ? ' on' : '');
      s.textContent = '✕';
      st.appendChild(s);
    }
    if (hit) { st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
    for (const b of document.querySelectorAll('.power-btn')) {
      const k = b.dataset.power, n = this.powers ? this.powers[k] : 0;
      b.querySelector('em').textContent = n;
      b.disabled = !n;
    }
    this.refreshCoins();
  },

  refreshCoins() {
    const w = Kit.fmt(Wallet.get());
    for (const id of ['hud-coins', 'title-coins', 'shop-coins']) { const el = Kit.$(id); if (el) el.textContent = w; }
  },

  // ---- Menus -----------------------------------------------------------------------
  showTitle() {
    this.state = 'title';
    Kit.show('screen-title');
    Kit.$('title-stars').textContent = this.totalStars();
    Kit.$('best-endless').textContent = this.best ? `Best ${this.best} cars` : 'How long can you last?';
    Kit.$('trophy-count').textContent = `${this.trophies.count}/${this.trophies.total}`;
    this.refreshCoins();
  },

  showLevels() {
    const body = Kit.$('levels-body');
    body.innerHTML = '';
    for (const mapId in TC_MAPS) {
      const sec = document.createElement('section');
      sec.className = 'map-sec';
      sec.innerHTML = `<h3>${TC_MAPS[mapId].name}</h3><div class="level-grid"></div>`;
      const grid = sec.querySelector('.level-grid');
      for (const L of TC_LEVELS.filter(l => l.map === mapId)) {
        const open = this.unlocked(L.n), st = this.stars[L.n] || 0;
        const b = document.createElement('button');
        b.className = 'level-btn' + (open ? '' : ' locked') + (st ? ' done' : '');
        b.disabled = !open;
        b.innerHTML = `<span class="lv-no">${L.n}</span><span class="lv-name"></span><span class="lv-stars">${open ? [1, 2, 3].map(i => `<i class="${i <= st ? 'on' : ''}">★</i>`).join('') : '🔒'}</span>`;
        b.querySelector('.lv-name').textContent = L.name;
        b.addEventListener('click', () => { Sound.click(); this.intro(L.n); });
        grid.appendChild(b);
      }
      body.appendChild(sec);
    }
    Kit.$('levels-stars').textContent = this.totalStars();
    Kit.show('screen-levels');
  },

  showShop() {
    const body = Kit.$('shop-body'), bank = Wallet.get();
    body.innerHTML = '';
    const section = (title, items) => {
      const sec = document.createElement('section');
      sec.className = 'shop-sec';
      sec.innerHTML = `<h3>${title}</h3><div class="shop-grid"></div>`;
      for (const it of items) sec.querySelector('.shop-grid').appendChild(it);
      body.appendChild(sec);
    };
    const card = (name, desc, right, onClick, state) => {
      const el = document.createElement('div');
      el.className = 'shop-item ' + (state || '');
      el.innerHTML = `<div class="si-txt"><b></b><em></em></div>`;
      el.querySelector('b').textContent = name;
      el.querySelector('em').textContent = desc;
      const btn = document.createElement('button');
      btn.className = state === 'equipped' ? 'btn-plate small' : 'btn-yellow small';
      btn.innerHTML = right;
      if (onClick) btn.addEventListener('click', onClick); else btn.disabled = true;
      el.appendChild(btn);
      return el;
    };
    const buy = (price, fn) => () => {
      if (!Wallet.spend(price)) { Kit.toast('Not enough coins'); return; }
      Sound.cash();
      fn();
      this.showShop();
    };
    // upgrades
    const ups = [];
    for (const id in TC_UPGRADES) {
      const U = TC_UPGRADES[id], lv = this.up[id], max = U.cost.length;
      const label = max > 1 ? `${U.name} ${'●'.repeat(lv)}${'○'.repeat(max - lv)}` : U.name;
      if (lv >= max) ups.push(card(label, U.desc, 'Owned', null, 'owned'));
      else {
        const price = U.cost[lv];
        ups.push(card(label, U.desc, `<span class="coin-ico"></span> ${Kit.fmt(price)}`, bank >= price ? buy(price, () => { this.up[id]++; TC_STORE.set('up', this.up); }) : null, bank >= price ? '' : 'poor'));
      }
    }
    section('Upgrades', ups);
    // light styles and themes
    const cosmetic = (table, kind, current, setCur) => {
      const out = [];
      for (const id in table) {
        const it = table[id], own = this.owned[kind].includes(id);
        if (current === id) out.push(card(it.name, 'Equipped', 'Equipped', null, 'equipped'));
        else if (own) out.push(card(it.name, 'Yours', 'Use', () => { setCur(id); Sound.click(); this.showShop(); }, 'owned'));
        else out.push(card(it.name, `${Kit.fmt(it.price)} coins`, `<span class="coin-ico"></span> ${Kit.fmt(it.price)}`,
          bank >= it.price ? buy(it.price, () => { this.owned[kind].push(id); TC_STORE.set('owned', this.owned); setCur(id); }) : null, bank >= it.price ? '' : 'poor'));
      }
      return out;
    };
    section('Traffic lights', cosmetic(TC_LIGHTS, 'lights', this.lightStyle, id => { this.lightStyle = id; TC_STORE.set('light', id); }));
    section('Themes', cosmetic(TC_THEMES, 'themes', this.theme, id => { this.theme = id; TC_STORE.set('theme', id); TCView.build(this.level.map, id); }));
    this.refreshCoins();
    Kit.show('screen-shop');
  },

  showTrophies() {
    Kit.renderTrophies(Kit.$('trophy-list'), this.trophies);
    Kit.$('trophies-count').textContent = `${this.trophies.count}/${this.trophies.total}`;
    const s = this.stats;
    Kit.$('stats').innerHTML = `<span>Cars through <b>${Kit.fmt(s.cars)}</b></span><span>Crashes <b>${Kit.fmt(s.crashes)}</b></span><span>Shifts <b>${Kit.fmt(s.runs)}</b></span><span>Ambulances rushed <b>${Kit.fmt(s.medic)}</b></span>`;
    Kit.show('screen-trophies');
  },

  showSettings() {
    const set = (id, on) => Kit.$(id).setAttribute('aria-checked', on ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', this.settings.shake);
    set('set-low', this.settings.low);
    const r = Kit.$('btn-reset');
    delete r.dataset.armed;
    r.textContent = 'Reset Traffic Control progress';
    Kit.show('screen-settings');
  },

  // ---- Input -------------------------------------------------------------------------
  bind() {
    const on = (id, fn) => Kit.$(id).addEventListener('click', () => { Sound.init(); fn(); });
    on('btn-play', () => { Sound.click(); this.showLevels(); });
    on('btn-endless', () => { Sound.click(); this.start(0); });
    on('btn-shop', () => { Sound.click(); this.showShop(); });
    on('btn-trophies', () => { Sound.click(); this.showTrophies(); });
    on('btn-settings', () => { Sound.click(); this.showSettings(); });
    on('btn-levels-back', () => this.showTitle());
    on('btn-intro-go', () => this.start(this.pendingLevel));
    on('btn-intro-back', () => this.showLevels());
    on('btn-resume', () => this.pause(false));
    on('btn-restart', () => this.start(this.levelNo));
    on('btn-quit', () => this.quit());
    on('btn-pause', () => this.pause(true));
    on('btn-next', () => { const n = this.levelNo + 1; if (n <= TC_LEVELS.length) this.intro(n); });
    on('btn-retry', () => (this.levelNo > 0 ? this.intro(this.levelNo) : this.start(0)));
    on('btn-res-menu', () => this.quit());
    on('btn-shop-done', () => this.showTitle());
    on('btn-trophies-done', () => this.showTitle());
    on('btn-settings-done', () => this.showTitle());
    on('btn-swap', () => { if (this.state === 'playing') { TCSim.swap(); Sound.click(); } });
    for (const b of document.querySelectorAll('.power-btn')) b.addEventListener('click', () => this.usePower(b.dataset.power));
    this.syncMute = Kit.muteButton(Kit.$('btn-mute'));
    on('set-sound', () => { Sound.setMuted(!Sound.muted); this.syncMute(); this.showSettings(); });
    on('set-shake', () => { this.settings.shake = !this.settings.shake; TC_STORE.set('shake', this.settings.shake); this.showSettings(); });
    on('set-low', () => { this.settings.low = !this.settings.low; TC_STORE.set('low', this.settings.low); TCView.setLow(this.settings.low); this.showSettings(); });
    on('btn-reset', () => {
      const r = Kit.$('btn-reset');
      if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = 'Tap again to delete your stars, upgrades and trophies'; return; }
      const keep = { low: this.settings.low, shake: this.settings.shake };
      TC_STORE.wipe();
      TC_STORE.set('low', keep.low); TC_STORE.set('shake', keep.shake);
      this.load();
      this.demo();
      Kit.toast('Traffic Control progress deleted');
      this.showSettings();
    });

    // tapping a light
    const cv = Kit.$('view');
    cv.addEventListener('pointerdown', e => {
      if (this.state !== 'playing') return;
      Sound.init();
      const r = cv.getBoundingClientRect();
      const h = TCView.pick(e.clientX - r.left, e.clientY - r.top);
      if (h && TCSim.toggle(h)) Sound.click();
    });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = cv.getBoundingClientRect();
      const h = this.state === 'playing' ? TCView.pick(e.clientX - r.left, e.clientY - r.top) : null;
      TCView.hover = h;
      cv.style.cursor = h ? 'pointer' : '';
    });
    cv.addEventListener('pointerleave', () => { TCView.hover = null; });

    const KEYS = { ArrowRight: 'E', KeyD: 'E', ArrowLeft: 'W', KeyA: 'W', ArrowUp: 'N', KeyW: 'N', ArrowDown: 'S', KeyS: 'S' };
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause(true); else if (this.state === 'paused') this.pause(false);
        return;
      }
      if (this.state !== 'playing') return;
      if (KEYS[e.code]) { e.preventDefault(); if (TCSim.toggle(KEYS[e.code])) Sound.click(); }
      else if (e.code === 'Space') { e.preventDefault(); TCSim.swap(); Sound.click(); }
      else if (e.code === 'Digit1') this.usePower('freeze');
      else if (e.code === 'Digit2') this.usePower('tow');
      else if (e.code === 'Digit3') this.usePower('calm');
      else if (e.code === 'KeyM') { Sound.setMuted(!Sound.muted); this.syncMute(); }
    });
  },
};

TCGame.init();
