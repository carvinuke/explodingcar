'use strict';
// DOM UI: HUD, power-up tray, title / pause / game-over screens,
// and the settings screen with its graphic-mode warning.

const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

const UI = {
  shown: { score: -1, best: -1, coins: -1 },
  modal: null,        // 'settings' | 'warning' | null
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
    on('btn-play', () => Game.start());
    on('btn-again', () => Game.start());
    on('btn-resume', () => Game.togglePause(false));
    on('btn-pause', () => Game.togglePause());
    on('btn-mute', () => this.toggleMute());
    on('btn-settings', () => this.openSettings());
    on('btn-pause-settings', () => this.openSettings());
    on('btn-over-settings', () => this.openSettings());
    on('btn-settings-done', () => this.closeModal());
    on('set-sound', () => this.toggleMute());
    on('set-shake', () => {
      Settings.shake = !Settings.shake;
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
    for (const id of ['screen-settings', 'screen-warning']) {
      $(id).addEventListener('click', e => { if (e.target.id === id) this.closeModal(); });
    }

    this.renderMute();
    this.syncSettings();
    this.refreshMeta();
  },

  // ---- Settings ---------------------------------------------------------------
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

  closeModal() {
    if (this.modal === 'warning') {
      this.show('screen-warning', false);
      this.modal = 'settings';
      this.syncSettings();
      this.$('set-gore').focus({ preventScroll: true });
      return;
    }
    this.show('screen-settings', false);
    this.modal = null;
    this.refreshMeta();
    if (this.returnFocus && this.returnFocus.focus) this.returnFocus.focus({ preventScroll: true });
  },

  syncSettings() {
    const set = (id, v) => this.$(id).setAttribute('aria-checked', v ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', Settings.shake);
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

  refreshMeta() {
    this.$('title-best').textContent = Game.best;
    this.$('title-coins').textContent = Game.bank;
    this.$('gore-badge').classList.toggle('hidden', !Settings.gore);
  },

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
    this.shown.score = this.shown.best = this.shown.coins = -1;
  },

  showPause(on) {
    this.show('screen-pause', on);
    if (on) this.$('btn-resume').focus({ preventScroll: true });
  },

  showGameOver(info) {
    this.$('report-no').textContent = 'No. ' + String(info.run).padStart(5, '0');
    this.$('over-cause').textContent = info.cause;
    this.$('over-rows').textContent = `${info.rows} ${info.rows === 1 ? 'row' : 'rows'}`;
    this.$('over-score').textContent = info.score;
    this.$('over-best').textContent = info.best;
    this.$('over-coins').textContent = `${info.coins} (${info.bank} total)`;
    this.$('over-new').classList.toggle('hidden', !info.newBest);
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
    const best = Math.max(Game.best, Game.score);
    if (best !== s.best) { s.best = best; this.best.textContent = best; }
    if (Game.coins !== s.coins) { s.coins = Game.coins; this.coins.textContent = Game.coins; }

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
  },
};
