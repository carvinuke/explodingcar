'use strict';
// Traffic Control: game flow, HUD, menus, shop and trophies.

const TCGame = {
  state: 'title', // title | intro | playing | paused | over
  level: null,
  levelNo: 0,     // 1..15, 0 for Endless, or 'custom'
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
    this.up = Object.assign({ patience: 0, strike: 0, start: 0, amber: 0, towing: 0, fares: 0 }, S.get('up', {}) || {});
    // custom shift settings (saves from before the crossing editor are converted)
    const cur = S.get('custom2', null), old = S.get('custom', null);
    this.custom = cur && typeof cur === 'object' ? tcCustomClean(cur) : old && typeof old === 'object' ? tcCustomMigrate(old) : tcCustomClean({});
    const slots = S.get('slots', []);
    this.slots = [0, 1, 2].map(i => (Array.isArray(slots) && slots[i] && typeof slots[i] === 'object' ? tcCustomClean(slots[i]) : null));
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
    this.isCustom = n === 'custom';
    this.level = this.isCustom ? tcCustomLevel(this.custom) : n > 0 ? TC_LEVELS[n - 1] : tcEndlessLevel(0);
    this.pay = this.isCustom ? tcCustomPay(this.custom) : 1;
    TCSim.reset(this.level, {
      patienceMul: 1 + 0.15 * this.up.patience,
      yellow: this.isCustom ? this.custom.amber : this.up.amber ? YELLOW - 0.3 : YELLOW, // (a custom shift sets its own amber)
      towTime: [5, 3.6, 2.4][this.up.towing] || 5,
    });
    // snow on a custom shift brings snowy ground with it (unless you've picked a theme)
    TCView.build(this.level.map, this.isCustom && this.level.snow && this.theme === 'auto' ? 'snow' : this.theme);
    TCView.fit();
    FX.reset();
    const extra = this.up.strike ? 1 : 0;
    this.maxStrikes = this.isCustom ? (this.custom.strikes ? this.custom.strikes + extra : Infinity) : 3 + extra;
    // power-ups: one every 12 cars (a custom shift can have none, or one every 6)
    this.powerEvery = this.isCustom ? [0, 12, 6][this.custom.powers] : 12;
    this.powers = { freeze: 0, tow: 0, calm: 0, wave: 0 };
    if (this.up.start && this.powerEvery) this.powers[pick(Object.keys(TC_POWERS))]++;
    this.nextPower = this.powerEvery || Infinity;
    Kit.$('hud').classList.toggle('no-powers', !this.powerEvery);
    this.timeLeft = this.isCustom ? this.custom.limit : 0;
    this.shownTime = -1;
    Kit.$('hud-time').classList.toggle('hidden', !this.timeLeft);
    this.runCoins = 0;
    this.runMedic = 0;
    this.runTrophies = [];
    this.state = 'playing';
    this.stats.runs++;
    Kit.$('toasts').innerHTML = '';
    Kit.hideScreens();
    Kit.$('hud').classList.remove('hidden');
    Kit.$('hud-level').textContent = this.isCustom ? `CUSTOM · ${this.crossingsLabel()}` : n > 0 ? `${n}. ${this.level.name.toUpperCase()}` : 'ENDLESS RUSH HOUR';
    const manual = TCSim.nodes.filter(N => !N.auto).length;
    Kit.$('swap-txt').textContent = TCSim.nodes.length > 1 ? 'SWITCH' : 'SWITCH ALL';
    Kit.$('btn-nextx').classList.toggle('hidden', manual < 2);
    this.updateHud();
    if (this.isCustom && TCSim.nodes.length > 1) {
      if (!manual) Kit.toast('Every crossing runs itself. Sit back!');
      else if (manual > 1) Kit.toast(matchMedia('(hover: none)').matches ? 'Tap a light to work its crossing' : 'Tab (or tap a light) picks a crossing', '', 3200);
    }
  },

  crossingsLabel() { return TC_LAYOUTS[this.level.layout || 1].name.toUpperCase(); },
  cleared() { return TC_LEVELS.filter(L => this.stars[L.n]).length; },

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

  // why: 'time' when a custom shift's time limit runs out
  end(won, why) {
    if (this.state !== 'playing') return;
    this.state = 'over';
    const S = TCSim, n = this.levelNo, custom = this.isCustom;
    const crashes = S.crashes;
    let stars = 0;
    let coins = S.through;
    if (custom) {
      coins = Math.round(S.through * this.pay);
      if (won) { coins += Math.round(this.level.goal * 0.5 * this.pay); Sound.levelUp(); }
      else if (why === 'time' && this.level.endless) Sound.levelUp(); // a timed shift with no goal just ends
      else Sound.gameOver();
    } else if (n > 0 && won) {
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
    coins = Math.round(coins * (1 + 0.1 * this.up.fares));
    Wallet.add(coins);
    this.runCoins = coins;
    this.stats.cars += S.through;
    this.saveStats();
    this.checkTrophies(won);

    // the report
    const goal = this.level.goal < Infinity ? this.level.goal : 0;
    Kit.$('res-no').textContent = custom ? 'CUSTOM' : n > 0 ? `LEVEL ${n}` : 'ENDLESS';
    Kit.$('res-title').textContent = custom ? (won ? 'Shift complete!' : why === 'time' ? (this.level.endless ? 'Time\'s up!' : 'Out of time!') : crashes >= this.maxStrikes ? 'Gridlock!' : 'Shift over')
      : n > 0 ? (won ? (stars === 3 ? 'Perfect shift!' : 'Level clear!') : 'Gridlock!') : 'Shift over';
    Kit.$('res-stars').innerHTML = n > 0 ? [1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('') : '';
    Kit.$('res-stars').classList.toggle('hidden', !(n > 0));
    Kit.$('res-cars').textContent = goal ? `${S.through} / ${goal}` : S.through;
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
    if (on && this.state === 'playing') {
      this.state = 'paused';
      Kit.$('btn-endshift').classList.toggle('hidden', !(this.isCustom || this.levelNo === 0));
      Kit.show('screen-pause');
    }
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
          this.nextPower += this.powerEvery;
          const k = pick(Object.keys(TC_POWERS));
          if (this.powers[k] < 3) { this.powers[k]++; Kit.toast(`+1 ${TC_POWERS[k].name.toUpperCase()}`, 'power'); Sound.powerup(); }
        }
        if (this.levelNo === 0) {
          if (TCSim.through % 10 === 0) TCSim.setLevel(tcEndlessLevel(TCSim.through));
          if (TCSim.through === 50) this.trophies.earn('end50');
          if (TCSim.through === 150) this.trophies.earn('end150');
        }
        if (this.stats.cars + TCSim.through >= 1000) this.trophies.earn('total1000');
        if (this.isCustom && TCSim.through >= 50 && TCSim.nodes.length >= 4 && !TCSim.nodes.some(N => N.auto)) this.trophies.earn('grid');
        this.updateHud();
        if ((this.levelNo > 0 || this.isCustom) && TCSim.through >= this.level.goal) this.end(true);
      },
      commit: car => {
        if (!this.playing() || !car.medic || TCSim.nodes[car.stops[0].n].auto) return;
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
    if (this.isCustom && won) T.earn('custom');
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
    if (k === 'wave') { TCSim.wave(10); Sound.powerup(); Kit.toast('GREEN WAVE', 'go'); this.trophies.earn('wave'); }
    this.usedPowers.add(k);
    TC_STORE.set('used', [...this.usedPowers]);
    if (['freeze', 'tow', 'calm'].every(p => this.usedPowers.has(p))) this.trophies.earn('powers');
    this.updateHud();
  },

  // ---- Frame -------------------------------------------------------------------
  frame(dt, t) {
    if (this.state === 'playing') {
      TCSim.update(dt);
      FX.update(dt);
      if (this.timeLeft > 0) { // a custom shift's time limit
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        this.hudTime();
        if (this.timeLeft <= 0) this.end(false, 'time');
      }
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
    Kit.$('hud-cars').textContent = this.level.goal < Infinity ? `${TCSim.through}/${this.level.goal}` : TCSim.through;
    const st = Kit.$('hud-strikes');
    st.innerHTML = '';
    if (this.maxStrikes === Infinity || this.maxStrikes > 6) { // unlimited (or lots): just count them
      const s = document.createElement('span');
      s.className = 'strike-count';
      s.textContent = this.maxStrikes === Infinity ? `✕ ${TCSim.crashes}` : `✕ ${TCSim.crashes} / ${this.maxStrikes}`;
      st.appendChild(s);
    } else for (let i = 0; i < this.maxStrikes; i++) {
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

  hudTime() {
    const sec = Math.ceil(this.timeLeft);
    if (sec === this.shownTime) return;
    this.shownTime = sec;
    const el = Kit.$('hud-time');
    el.querySelector('b').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    el.classList.toggle('low', sec <= 10);
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
    const open = this.cleared() >= TC_CUSTOM_UNLOCK, cb = Kit.$('btn-custom');
    cb.classList.toggle('locked', !open);
    cb.setAttribute('aria-disabled', open ? 'false' : 'true');
    Kit.$('custom-sub').textContent = open ? 'Build your own crossings' : `🔒 Clear ${TC_CUSTOM_UNLOCK} levels to unlock (${this.cleared()}/${TC_CUSTOM_UNLOCK})`;
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

  // ---- Custom shift ------------------------------------------------------------------
  // Six tabs of settings. Every change is saved straight away.
  showCustom(tab) {
    if (this.cleared() < TC_CUSTOM_UNLOCK) { Kit.toast(`Clear ${TC_CUSTOM_UNLOCK} levels to unlock custom shifts`); return; }
    if (tab) this.customTab = tab;
    const T = this.customTab || (this.customTab = 'map');
    const o = this.custom, body = Kit.$('custom-body'), scr = Kit.$('screen-custom');
    // redrawing keeps your place: the scroll position and the focused control
    const top = scr.scrollTop, fk = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    body.innerHTML = '';
    const n = tcLayoutSize(o.layout);
    const save = () => { Object.assign(o, tcCustomClean(o)); TC_STORE.set('custom2', o); this.showCustom(); };
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const button = (text, fk, onClick, cls) => {
      const b = el('button', cls, text);
      b.type = 'button';
      if (fk) b.dataset.fk = fk;
      b.addEventListener('click', () => { Sound.click(); onClick(); });
      return b;
    };

    const tabs = el('div', 'opt-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Custom shift settings');
    for (const [id, name] of [['map', 'Map'], ['traffic', 'Traffic'], ['cars', 'Vehicles'], ['weather', 'Weather'], ['rules', 'Rules'], ['presets', 'Presets']]) {
      const b = button(name, 'tab-' + id, () => this.showCustom(id));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', id === T ? 'true' : 'false');
      tabs.appendChild(b);
    }
    body.appendChild(tabs);
    const panel = el('div', 'opt-panel');
    panel.setAttribute('role', 'tabpanel');
    body.appendChild(panel);

    const sec = title => { const e = el('section', 'opt-sec'); e.appendChild(el('h3', null, title)); panel.appendChild(e); return e; };
    const row = (parent, label, sub) => {
      const r = el('div', 'opt-row'), l = el('span', 'opt-lbl', label);
      if (sub) l.appendChild(el('em', null, sub));
      r.appendChild(l);
      parent.appendChild(r);
      return r;
    };
    // a row of choices: opts are [value, text, disabled?]
    const choice = (parent, label, opts, cur, onPick, sub, fkBase) => {
      const r = row(parent, label, sub), g = el('div', 'seg');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', label);
      for (const [v, text, off] of opts) {
        const b = button(text, `${fkBase}=${v}`, () => onPick(v));
        b.setAttribute('aria-pressed', cur === v ? 'true' : 'false');
        b.disabled = !!off;
        g.appendChild(b);
      }
      r.appendChild(g);
      return r;
    };
    const seg = (parent, label, key, opts, sub) => choice(parent, label, opts, o[key], v => { o[key] = v; save(); }, sub, key);
    // a slider; `ends` maps a value past the top of the range to 0 (for "Endless", "No limit")
    const slider = (parent, label, key, fmt, sub, ends) => {
      const [min, max, step] = TC_CUSTOM_RANGES[key], lo = ends ? min + step : min, hi = ends ? max + step : max;
      const r = row(parent, label, sub), w = el('label', 'opt-range');
      w.innerHTML = `<input type="range" min="${lo}" max="${hi}" step="${step}"><output></output>`;
      const inp = w.querySelector('input'), out = w.querySelector('output');
      inp.value = ends && !o[key] ? hi : o[key];
      inp.dataset.fk = key;
      inp.setAttribute('aria-label', label);
      const show = () => { out.textContent = fmt(o[key]); inp.setAttribute('aria-valuetext', out.textContent); };
      show();
      inp.addEventListener('input', () => {
        const v = Math.round(Number(inp.value) * 100) / 100;
        o[key] = ends && v >= hi ? 0 : v;
        show();
        TC_STORE.set('custom2', o);
        this.customPay();
      });
      r.appendChild(w);
    };
    const toggles = (parent, items) => {
      const g = el('div', 'opt-grid');
      for (const [key, label, sub, disabled] of items) {
        const r = el('div', 'toggle-row'), l = el('span', null, label);
        if (sub) l.appendChild(el('em', 'sub', sub));
        const t = button('', key, () => { o[key] = !o[key]; save(); }, 'toggle');
        t.setAttribute('role', 'switch');
        t.setAttribute('aria-label', label);
        t.setAttribute('aria-checked', o[key] && !disabled ? 'true' : 'false');
        t.disabled = !!disabled;
        if (disabled) t.style.opacity = 0.4;
        r.append(l, t);
        g.appendChild(r);
      }
      parent.appendChild(g);
    };

    if (T === 'map') {
      const lay = sec('Layout');
      const cramped = n > 4 || o.layout === 'row4' ? (innerWidth < 700 ? ': best on a big screen' : '') : '';
      choice(lay, 'Crossings', TC_CUSTOM_OPTS.layout, o.layout, v => { o.layout = v; this.customSel = 0; save(); }, TC_LAYOUTS[o.layout].name + cramped, 'layout');
      seg(lay, 'Block size', 'spacing', TC_CUSTOM_OPTS.spacing, n === 1 ? 'Only matters with more than one crossing' : o.spacing < 1 ? 'Less room to queue between crossings' : o.spacing > 1 ? 'More room to queue, smaller cars' : 'Room to queue between crossings');
      seg(lay, 'Look', 'look', TC_CUSTOM_OPTS.look);
      this.crossingEditor(sec('Each crossing'), o, save, { el, button, choice });
      const au = sec('Automatic lights');
      seg(au, 'How they work', 'autoMode', TC_CUSTOM_OPTS.autoMode, o.autoMode === 'smart' ? 'Sensors: the road with cars waiting goes next' : 'Every road gets a turn, cars or not');
      slider(au, o.autoMode === 'smart' ? 'Longest green' : 'Green time', 'autoGreen', v => `${v} s`);
    } else if (T === 'traffic') {
      const tr = sec('Traffic');
      slider(tr, 'Cars per minute', 'rate', v => `${v}`);
      slider(tr, 'Car speed', 'speed', v => `${v.toFixed(1)}×`);
      slider(tr, 'Turning', 'turn', v => `${v}%`, 'Cars that turn at a crossing');
      slider(tr, 'Reckless drivers', 'reckless', v => `${v}%`, 'They run red lights');
      slider(tr, 'Patience', 'patience', v => `${v} s`, 'How long drivers wait before they honk');
      toggles(tr, [['rush', 'Rush hour waves', 'Bursts of extra traffic']]);
    } else if (T === 'cars') {
      const mx = sec('Vehicle mix');
      for (const g in TC_MIX_GROUPS) {
        const G = TC_MIX_GROUPS[g];
        choice(mx, G.name, TC_MIX_LEVELS, o.mix[g], v => { o.mix[g] = v; save(); }, G.sub, 'mix-' + g);
      }
      const none = Object.keys(TC_MIX_GROUPS).every(g => g === 'medic' || !o.mix[g]);
      if (none) panel.appendChild(el('p', 'hint', 'Everything is at None, so you get everyday cars.'));
    } else if (T === 'weather') {
      const we = sec('Weather');
      seg(we, 'Weather', 'weather', TC_CUSTOM_OPTS.weather, { clear: 'Dry roads', rain: 'Wet roads: cars need longer to stop', snow: 'Ice: slower cars that take ages to stop', fog: 'You only see cars once they get close' }[o.weather]);
      seg(we, 'Time of day', 'time', TC_CUSTOM_OPTS.time, { day: 'Bright and clear', dusk: 'Sunset light', night: 'Dark: watch for headlights' }[o.time]);
      const tr = sec('Trains');
      toggles(tr, [['train', 'Railway crossing', n > 1 ? 'One crossing only' : 'Trains cross the east road', n > 1]]);
      if (n === 1 && o.train) slider(tr, 'A train every', 'trainEvery', v => `${v} s`);
    } else if (T === 'rules') {
      const go = sec('Goal');
      slider(go, 'Cars to get through', 'goal', v => (v ? `${v}` : 'Endless'), null, true);
      seg(go, 'Time limit', 'limit', TC_CUSTOM_OPTS.limit, o.limit ? (o.goal ? 'Reach the goal before time runs out' : 'Get as many through as you can') : 'Play as long as you like');
      slider(go, 'Crashes allowed', 'strikes', v => (v ? `${v}` : 'No limit'), 'The shift ends when you reach it', true);
      const li = sec('Lights and power-ups');
      slider(li, 'Amber light', 'amber', v => `${v.toFixed(1)} s`, 'Shorter is harder: cars caught by it keep going');
      seg(li, 'Power-ups', 'powers', TC_CUSTOM_OPTS.powers, ['None at all', 'One every 12 cars', 'One every 6 cars'][o.powers]);
    } else if (T === 'presets') {
      const sl = sec('Your saved shifts');
      this.slots.forEach((slot, i) => {
        const r = row(sl, `Slot ${i + 1}`, slot ? tcCustomSummary(slot) : 'Empty'), g = el('div', 'seg');
        const load = button('Load', `load${i}`, () => { Object.assign(o, tcCustomClean(slot)); this.customSel = 0; save(); Kit.toast(`Loaded slot ${i + 1}`); });
        load.disabled = !slot;
        g.append(load, button('Save here', `save${i}`, () => {
          this.slots[i] = tcCustomClean(o);
          TC_STORE.set('slots', this.slots);
          this.showCustom();
          Kit.toast(`Saved to slot ${i + 1}`);
        }));
        r.appendChild(g);
      });
      const id = sec('Ideas'), grid = el('div', 'idea-grid');
      for (const k in TC_CUSTOM_IDEAS) {
        const I = TC_CUSTOM_IDEAS[k], b = button('', 'idea-' + k, () => { Object.assign(o, tcCustomIdea(k)); this.customSel = 0; save(); Kit.toast(I.name); }, 'idea');
        b.append(el('b', null, I.name), el('em', null, I.desc));
        grid.appendChild(b);
      }
      id.appendChild(grid);
      const sh = sec('Shake it up'), acts = el('div', 'seg');
      acts.append(
        button('🎲 Random shift', 'random', () => { Object.assign(o, tcCustomRandom()); this.customSel = 0; save(); }),
        button('Back to normal', 'reset', () => { Object.assign(o, tcCustomClean({})); this.customSel = 0; save(); }),
      );
      sh.appendChild(acts);
    }

    const pay = el('p', 'pay-line');
    pay.id = 'custom-payline';
    panel.appendChild(pay);
    this.customPay();
    this.refreshCoins();
    if (this.state !== 'custom') { this.state = 'custom'; Kit.show('screen-custom'); }
    scr.scrollTop = top;
    if (fk) { const f = body.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f && !f.disabled) f.focus(); }
  },

  // The map of the crossings: tap one, then pick its shape and who runs its lights.
  crossingEditor(parent, o, save, { el, button, choice }) {
    const L = TC_LAYOUTS[o.layout], n = tcLayoutSize(o.layout);
    if (!(this.customSel >= 0 && this.customSel < n)) this.customSel = 0;
    const sel = this.customSel, wrap = el('div', 'xed'), map = el('div', 'xmap');
    map.style.setProperty('--cols', L.cols.length);
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', 'Crossings (north at the top)');
    for (let r = L.rows.length - 1; r >= 0; r--) for (let k = 0; k < L.cols.length; k++) { // north row first
      const i = r * L.cols.length + k, sh = o.shapes[i], auto = !!o.autos[i];
      const b = button('', 'x' + i, () => { this.customSel = i; this.showCustom(); }, 'xcell' + (auto ? ' auto' : ''));
      b.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
      b.setAttribute('aria-label', `Crossing ${i + 1}: ${TC_SHAPE_NAMES[sh]}, ${auto ? 'automatic' : 'yours'}`);
      b.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect class="rd" x="0" y="14" width="40" height="12"/>'
        + (sh !== 'TN' ? '<rect class="rd" x="14" y="0" width="12" height="20"/>' : '')
        + (sh !== 'TS' ? '<rect class="rd" x="14" y="20" width="12" height="20"/>' : '')
        + '<rect class="ln" x="0" y="19.4" width="40" height="1.2"/><circle class="lt" cx="31" cy="8" r="4"/></svg>'
        + `<span>${i + 1}</span>` + (auto ? '<em>AUTO</em>' : '');
      map.appendChild(b);
    }
    wrap.appendChild(map);
    const side = el('div', 'xside');
    side.appendChild(el('b', 'xtitle', `Crossing ${sel + 1}`));
    const allowed = tcShapesAllowed(o.layout, sel);
    choice(side, 'Shape', ['4', 'TN', 'TS'].map(v => [v, TC_SHAPE_NAMES[v], !allowed.includes(v)]), o.shapes[sel], v => { o.shapes[sel] = v; save(); },
      allowed.length < 3 ? 'A T only fits on the edge of the map' : null, 'shape');
    choice(side, 'Lights', [[0, 'You'], [1, 'Automatic']], o.autos[sel] ? 1 : 0, v => { o.autos[sel] = v; save(); }, null, 'auto');
    if (n > 1) {
      const all = el('div', 'seg');
      all.append(
        button('All yours', 'allmine', () => { o.autos = o.autos.map(() => 0); save(); }),
        button('All automatic', 'allauto', () => { o.autos = o.autos.map(() => 1); save(); }),
        button('All 4-way', 'all4', () => { o.shapes = o.shapes.map(() => '4'); save(); }),
      );
      side.appendChild(all);
    }
    wrap.appendChild(side);
    parent.appendChild(wrap);
    parent.appendChild(el('p', 'hint', n > 1 ? 'Tap a crossing on the map to change it. Automatic crossings never crash, but pay nothing.' : 'Automatic crossings never crash, but pay nothing.'));
  },

  customPay() {
    const k = tcCustomPay(this.custom), el = Kit.$('custom-payline');
    const fares = 1 + 0.1 * this.up.fares;
    Kit.$('custom-pay').textContent = k ? `${(k * fares).toFixed(1)} COINS / CAR` : 'NO COINS';
    if (!el) return;
    el.classList.toggle('none', !k);
    el.textContent = !k ? 'Every crossing runs itself, so this shift pays no coins. Make a crossing yours to earn.'
      : `Pays about ${(k * fares).toFixed(1)} coins per car` + (this.custom.goal ? `, plus ${Math.round(this.custom.goal * 0.5 * k * fares)} for reaching the goal.` : '.') + ' Harder settings pay more.';
  },

  // Tab: the next crossing you work by hand.
  nextCrossing() {
    const N = TCSim.nodes;
    for (let i = 1; i <= N.length; i++) {
      const k = (TCSim.sel + i) % N.length;
      if (!N[k].auto) { if (k !== TCSim.sel) Sound.click(); TCSim.sel = k; return; }
    }
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
    on('btn-custom', () => { Sound.click(); this.showCustom(); });
    on('btn-custom-go', () => { Sound.click(); this.start('custom'); });
    on('btn-custom-back', () => this.showTitle());
    on('btn-endshift', () => { Kit.hideScreens(); this.state = 'playing'; this.end(false); });
    on('btn-nextx', () => this.nextCrossing());
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
    on('btn-retry', () => (this.isCustom ? this.start('custom') : this.levelNo > 0 ? this.intro(this.levelNo) : this.start(0)));
    on('btn-res-menu', () => this.quit());
    on('btn-shop-done', () => this.showTitle());
    on('btn-trophies-done', () => this.showTitle());
    on('btn-settings-done', () => this.showTitle());
    on('btn-swap', () => { if (this.state === 'playing' && TCSim.swap()) Sound.click(); });
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
      const p = TCView.pick(e.clientX - r.left, e.clientY - r.top);
      if (!p) return;
      if (TCSim.nodes[p.n].auto) { if (TCSim.nodes.length > 1) Kit.toast('That crossing runs itself'); return; }
      TCSim.sel = p.n;
      if (TCSim.toggle(p.h, p.n)) Sound.click();
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
      else if (e.code === 'Space') { e.preventDefault(); if (TCSim.swap()) Sound.click(); }
      else if (e.code === 'Tab') { e.preventDefault(); this.nextCrossing(); }
      else if (e.code === 'Digit1') this.usePower('freeze');
      else if (e.code === 'Digit2') this.usePower('tow');
      else if (e.code === 'Digit3') this.usePower('calm');
      else if (e.code === 'Digit4') this.usePower('wave');
      else if (e.code === 'KeyM') { Sound.setMuted(!Sound.muted); this.syncMute(); }
    });
  },
};

TCGame.init();
