'use strict';
// DOM UI: HUD, power-up tray, toasts, title / pause / game-over screens,
// the skin shop, missions board, and settings with the graphic-mode warning.

const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

const WEATHER_SIGNS = {
  rain: ['SLIPPERY WHEN WET', 'Cars brake late and can skid into each other'],
  snow: ['ICY ROADS', 'Traffic slows down in the snow'],
};

const UI = {
  shown: { score: -1, best: -1, coins: -1 },
  modal: null,        // 'settings' | 'warning' | 'shop' | null
  returnFocus: null,

  init() {
    const $ = id => document.getElementById(id);
    this.$ = $;
    this.hud = $('hud');
    this.score = $('score');
    this.best = $('best');
    this.coins = $('coins');
    this.powers = $('powers');
    this.btnMute = $('btn-mute');
    this.canvas = $('view');
    this.combo = $('combo');
    this.toasts = $('toasts');

    // power-up legend on the title screen + HUD chips
    const legend = $('legend');
    this.chips = {};
    for (const k in POWERUPS) {
      const def = POWERUPS[k], url = Draw.iconURL(k);
      const li = document.createElement('li');
      li.innerHTML = `<img src="${url}" alt=""><span>${def.name}</span>`;
      legend.appendChild(li);

      const el = document.createElement('div');
      el.className = 'pw hidden';
      el.style.setProperty('--c', def.color);
      el.innerHTML = `<img src="${url}" alt=""><div class="pw-info"><span class="pw-name">${def.name}</span>` +
        (k === 'shield' ? '<span class="pw-pips">1 HIT</span>' : '<span class="pw-bar"><i></i></span>') + '</div>';
      this.powers.appendChild(el);
      this.chips[k] = { el, fill: el.querySelector('i'), on: false };
    }

    const stop = e => e.stopPropagation();
    for (const b of document.querySelectorAll('button')) b.addEventListener('pointerdown', stop);
    const on = (id, fn) => $(id).addEventListener('click', fn);
    on('btn-play', () => Game.start('normal'));
    on('btn-daily', () => Game.start('daily'));
    on('btn-again', () => Game.start());
    on('btn-resume', () => Game.togglePause(false));
    on('btn-pause', () => Game.togglePause());
    on('btn-mute', () => this.toggleMute());
    for (const id of ['btn-settings', 'btn-pause-settings', 'btn-over-settings']) on(id, () => this.openSettings());
    for (const id of ['btn-shop', 'btn-over-shop']) on(id, () => this.openShop());
    on('btn-settings-done', () => this.closeModal());
    on('btn-shop-done', () => this.closeModal());
    on('set-sound', () => this.toggleMute());
    on('set-shake', () => {
      Settings.shake = !Settings.shake;
      Settings.save();
      this.syncSettings();
      Sound.click();
    });
    on('set-ghost', () => {
      Settings.ghost = !Settings.ghost;
      Settings.save();
      this.syncSettings();
      Sound.click();
    });
    on('set-gore', () => {
      if (Settings.gore) { // turning it off never needs a warning
        Settings.gore = false;
        Settings.save();
        this.syncSettings();
        Sound.click();
      } else {
        this.openWarning();
      }
    });
    on('btn-warn-cancel', () => this.closeModal());
    on('btn-warn-ok', () => {
      Settings.gore = true;
      Settings.save();
      this.closeModal();
      Sound.click();
    });
    // clicking the dimmed backdrop closes a dialog
    for (const id of ['screen-settings', 'screen-warning', 'screen-shop']) {
      $(id).addEventListener('click', e => { if (e.target.id === id) this.closeModal(); });
    }

    this.renderMute();
    this.syncSettings();
    this.refreshMeta();
  },

  // ---- Dialogs ------------------------------------------------------------------
  openSettings() {
    Sound.init();
    this.returnFocus = document.activeElement;
    this.modal = 'settings';
    this.syncSettings();
    this.show('screen-settings', true);
    this.$('set-sound').focus({ preventScroll: true });
  },

  openWarning() {
    this.modal = 'warning';
    this.show('screen-warning', true);
    this.$('btn-warn-cancel').focus({ preventScroll: true });
  },

  openShop() {
    Sound.init();
    this.returnFocus = document.activeElement;
    this.modal = 'shop';
    this.renderShop();
    this.show('screen-shop', true);
    this.$('btn-shop-done').focus({ preventScroll: true });
  },

  closeModal() {
    if (this.modal === 'warning') {
      this.show('screen-warning', false);
      this.modal = 'settings';
      this.syncSettings();
      this.$('set-gore').focus({ preventScroll: true });
      return;
    }
    this.show('screen-settings', false);
    this.show('screen-shop', false);
    this.modal = null;
    this.refreshMeta();
    if (this.returnFocus && this.returnFocus.focus) this.returnFocus.focus({ preventScroll: true });
  },

  syncSettings() {
    const set = (id, v) => this.$(id).setAttribute('aria-checked', v ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', Settings.shake);
    set('set-ghost', Settings.ghost);
    set('set-gore', Settings.gore);
    this.$('gore-badge').classList.toggle('hidden', !Settings.gore);
  },

  toggleMute() {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    this.renderMute();
    this.syncSettings();
    Sound.click();
  },

  renderMute() {
    this.btnMute.innerHTML = Sound.muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
    this.btnMute.setAttribute('aria-label', Sound.muted ? 'Unmute' : 'Mute');
    this.btnMute.classList.toggle('off', Sound.muted);
  },

  // ---- Shop ---------------------------------------------------------------------
  renderShop() {
    this.$('shop-coins').textContent = Game.bank;
    const grid = this.$('shop-grid');
    grid.textContent = '';
    for (const id in SKINS) {
      const s = SKINS[id];
      const owned = Shop.owned.includes(id), equipped = Shop.current === id;
      const card = document.createElement('div');
      card.className = 'skin' + (equipped ? ' equipped' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 120;
      this.preview(cv, s);
      const name = document.createElement('b');
      name.textContent = s.name;
      const btn = document.createElement('button');
      if (equipped) {
        btn.className = 'btn-plate small';
        btn.textContent = 'Equipped';
        btn.disabled = true;
      } else if (owned) {
        btn.className = 'btn-plate small';
        btn.textContent = 'Equip';
        btn.addEventListener('click', () => { Shop.equip(id); Sound.click(); this.renderShop(); });
      } else {
        const afford = Game.bank >= s.price;
        btn.className = 'btn-yellow small';
        btn.innerHTML = `<span class="coin-ico"></span> ${s.price}`;
        btn.disabled = !afford;
        btn.setAttribute('aria-label', `Buy ${s.name} for ${s.price} coins`);
        btn.addEventListener('click', () => {
          if (Shop.buy(id)) { Sound.powerup(); this.renderShop(); this.refreshMeta(); }
        });
      }
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      card.append(cv, name, btn);
      grid.appendChild(card);
    }
  },

  preview(cv, skin) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2, cv.height * 0.72);
    g.scale(2.6, 2.6);
    Draw.shadow(g, 0, 0, 30, 24, 0.9);
    Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, skin);
    g.restore();
  },

  // ---- Missions board -----------------------------------------------------------
  renderMissions(el, showProgress) {
    el.textContent = '';
    for (const m of Missions.active) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.className = 'm-text';
      text.textContent = Missions.text(m);
      const reward = document.createElement('span');
      reward.className = 'm-reward';
      reward.innerHTML = `<span class="coin-ico"></span> ${m.reward}`;
      li.append(text, reward);
      if (showProgress) {
        const bar = document.createElement('span');
        bar.className = 'm-bar';
        const fill = document.createElement('i');
        fill.style.transform = `scaleX(${m.fresh ? 0 : Missions.progress(m) / m.target})`;
        bar.appendChild(fill);
        li.appendChild(bar);
      }
      el.appendChild(li);
    }
  },

  refreshMeta() {
    this.$('title-best').textContent = Game.best;
    this.$('title-coins').textContent = Game.bank;
    this.$('daily-date').textContent = dayLabel(dayKey());
    const db = Store.get(Game.dailyKey(), 0);
    this.$('daily-best').textContent = db ? `Best ${db}` : 'Not played yet';
    this.$('gore-badge').classList.toggle('hidden', !Settings.gore);
    this.renderMissions(this.$('title-missions'), false);
  },

  // ---- Toasts ---------------------------------------------------------------------
  toast(cls, title, sub, ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.setAttribute('role', 'status');
    const b = document.createElement('b');
    b.textContent = title;
    el.appendChild(b);
    if (sub) {
      const s = document.createElement('span');
      s.textContent = sub;
      el.appendChild(s);
    }
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), ms - 400);
    setTimeout(() => el.remove(), ms);
  },

  eventToast(name, sub) { this.toast('t-event', name, sub, 3600); },
  weatherToast(type) { const [t, s] = WEATHER_SIGNS[type]; this.toast('t-weather', t, s); },
  missionDone(m) { this.toast('t-mission', `MISSION COMPLETE  +${m.reward}`, Missions.text(m)); },

  // ---- Screens ----------------------------------------------------------------
  show(id, on) { this.$(id).classList.toggle('hidden', !on); },

  showTitle() {
    this.refreshMeta();
    this.show('screen-title', true);
    this.show('screen-over', false);
    this.show('screen-pause', false);
    this.show('hud', false);
  },

  startRun() {
    this.show('screen-title', false);
    this.show('screen-over', false);
    this.show('screen-pause', false);
    this.show('hud', true);
    this.show('daily-badge', Game.mode === 'daily');
    this.toasts.textContent = '';
    this.shown.score = this.shown.best = this.shown.coins = -1;
  },

  showPause(on) {
    this.show('screen-pause', on);
    if (on) {
      this.renderMissions(this.$('pause-missions'), true);
      this.$('btn-resume').focus({ preventScroll: true });
    }
  },

  showGameOver(info) {
    this.$('report-no').textContent = 'No. ' + String(info.run).padStart(5, '0');
    this.$('over-cause').textContent = info.cause;
    this.$('over-rows').textContent = `${info.rows} ${info.rows === 1 ? 'row' : 'rows'}`;
    this.$('over-score').textContent = info.score;
    this.$('over-best').textContent = info.best;
    this.$('over-coins').textContent = `${info.coins} (${info.bank} total)`;
    this.$('over-mode-row').classList.toggle('hidden', !info.daily);
    this.$('over-mode').textContent = info.daily ? `Daily challenge, ${info.daily}` : '';
    this.$('over-new').classList.toggle('hidden', !info.newBest);
    this.$('report').classList.toggle('bloody', !!info.gore);
    this.renderMissions(this.$('over-missions'), true);
    this.show('screen-over', true);
    this.show('powers', false);
    setTimeout(() => this.$('btn-again').focus({ preventScroll: true }), 50);
  },

  update() {
    if (this.hud.classList.contains('hidden')) return;
    const s = this.shown;
    if (Game.score !== s.score) {
      s.score = Game.score;
      this.score.textContent = Game.score;
      this.score.classList.remove('bump');
      void this.score.offsetWidth; // restart the pop animation
      this.score.classList.add('bump');
    }
    const best = Math.max(Game.bestFor(Game.mode), Game.score);
    if (best !== s.best) { s.best = best; this.best.textContent = best; }
    if (Game.coins !== s.coins) { s.coins = Game.coins; this.coins.textContent = Game.coins; }

    const comboOn = Game.combo > 1 && Game.time - Game.comboT < 3 && Game.state === 'playing';
    this.combo.classList.toggle('hidden', !comboOn);
    if (comboOn) this.combo.firstElementChild.textContent = 'x' + Game.combo;

    this.show('powers', Game.state === 'playing' || Game.state === 'paused');
    for (const k in this.chips) {
      const ch = this.chips[k];
      const on = k === 'shield' ? Player.shield : Powers[k] > 0;
      if (on !== ch.on) { ch.el.classList.toggle('hidden', !on); ch.on = on; }
      if (on && ch.fill) {
        ch.fill.style.transform = `scaleX(${(Powers[k] / POWERUPS[k].dur).toFixed(3)})`;
        ch.el.classList.toggle('ending', Powers[k] < 1.5);
      }
    }

    const stunned = Player.alive && Player.stun > 0.25;
    if (stunned !== this.stunned) { this.stunned = stunned; this.canvas.classList.toggle('stunned', stunned); }
    const mini = Events.miniAmt > 0.3;
    if (mini !== this.mini) { this.mini = mini; this.canvas.classList.toggle('mini', mini); }
  },
};
