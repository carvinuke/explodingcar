'use strict';
// DOM UI: HUD, power-up tray, toasts, title / pause / game-over screens,
// the shop, trophy room and stats, missions board, and settings with key
// rebinding and the graphic-mode warning.

const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

const WEATHER_SIGNS = {
  rain: ['SLIPPERY WHEN WET', 'Cars brake late and can skid into each other'],
  snow: ['ICY ROADS', 'Traffic slows down in the snow'],
  dust: ['DUST STORM', "You can't see far ahead. Listen for horns"],
};

const UI = {
  shown: { score: -1, best: -1, coins: -1, timer: -1, p2: -1 },
  modal: null,        // 'settings' | 'warning' | 'shop' | 'trophies' | null
  returnFocus: null,
  shopTab: 'skins',
  trophyTab: 'trophies',

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

    // HUD power-up chips
    this.chips = {};
    for (const k in POWERUPS) {
      const def = POWERUPS[k], url = Draw.iconURL(k);
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
    on('btn-hardcore', () => Game.start('hardcore'));
    on('btn-time', () => Game.start('time'));
    on('btn-versus', () => Game.start('versus'));
    on('btn-again', () => Game.start());
    on('btn-resume', () => Game.togglePause(false));
    on('btn-pause', () => Game.togglePause());
    on('btn-mute', () => this.toggleMute());
    on('btn-pause-menu', () => { Sound.click(); Game.toTitle(); });
    on('btn-over-menu', () => { Sound.click(); Game.toTitle(); });
    for (const id of ['btn-settings', 'btn-pause-settings', 'btn-over-settings']) on(id, () => this.openSettings());
    for (const id of ['btn-shop', 'btn-over-shop']) on(id, () => this.openShop());
    on('btn-trophies', () => this.openTrophies());
    on('btn-settings-done', () => this.closeModal());
    on('btn-shop-done', () => this.closeModal());
    on('btn-trophies-done', () => this.closeModal());
    on('set-sound', () => this.toggleMute());
    const flip = key => () => {
      Settings[key] = !Settings[key];
      Settings.save();
      this.syncSettings();
      Sound.click();
    };
    on('set-shake', flip('shake'));
    on('set-ghost', flip('ghost'));
    on('set-replay', flip('replay'));
    on('set-motion', flip('motion'));
    on('set-colorblind', flip('colorblind'));
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
    for (const b of document.querySelectorAll('.key-btn')) b.addEventListener('click', () => this.bindKey(b));
    on('btn-keys-reset', () => {
      Settings.keys = { ...DEFAULT_KEYS };
      Settings.save();
      this.syncSettings();
      Sound.click();
    });
    const hint = $('mode-hint');
    for (const m of document.querySelectorAll('.mode-btn')) {
      const showHint = () => { hint.textContent = m.dataset.hint; };
      const clear = () => { hint.innerHTML = '&nbsp;'; };
      m.addEventListener('pointerenter', showHint);
      m.addEventListener('focus', showHint);
      m.addEventListener('pointerleave', clear);
      m.addEventListener('blur', clear);
    }
    for (const t of document.querySelectorAll('[data-tab]')) {
      t.addEventListener('click', () => { this.shopTab = t.dataset.tab; Sound.click(); this.renderShop(); });
    }
    for (const t of document.querySelectorAll('[data-ttab]')) {
      t.addEventListener('click', () => { this.trophyTab = t.dataset.ttab; Sound.click(); this.renderTrophies(); });
    }
    // clicking the dimmed backdrop closes a dialog
    for (const id of ['screen-settings', 'screen-warning', 'screen-shop', 'screen-trophies']) {
      $(id).addEventListener('click', e => { if (e.target.id === id) this.closeModal(); });
    }

    this.renderMute();
    this.syncSettings();
    this.refreshMeta();
  },

  // ---- Dialogs ------------------------------------------------------------------
  openModal(name, id, focusId) {
    Sound.init();
    this.returnFocus = document.activeElement;
    this.modal = name;
    this.show(id, true);
    const f = this.$(focusId);
    if (f) f.focus({ preventScroll: true });
    this.$(id).scrollTop = 0;
  },

  openSettings() {
    this.syncSettings();
    this.openModal('settings', 'screen-settings', 'set-sound');
  },

  openWarning() {
    this.modal = 'warning';
    this.show('screen-warning', true);
    this.$('btn-warn-cancel').focus({ preventScroll: true });
  },

  openShop() {
    this.renderShop();
    this.openModal('shop', 'screen-shop', 'btn-shop-done');
  },

  openTrophies() {
    this.renderTrophies();
    this.openModal('trophies', 'screen-trophies', 'btn-trophies-done');
  },

  closeModal() {
    if (Input.capture) Input.capture(null);
    if (this.modal === 'warning') {
      this.show('screen-warning', false);
      this.modal = 'settings';
      this.syncSettings();
      this.$('set-gore').focus({ preventScroll: true });
      return;
    }
    for (const id of ['screen-settings', 'screen-shop', 'screen-trophies']) this.show(id, false);
    this.modal = null;
    this.refreshMeta();
    if (this.returnFocus && this.returnFocus.focus) this.returnFocus.focus({ preventScroll: true });
  },

  syncSettings() {
    const set = (id, v) => this.$(id).setAttribute('aria-checked', v ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', Settings.shake);
    set('set-ghost', Settings.ghost);
    set('set-replay', Settings.replay);
    set('set-motion', Settings.motion);
    set('set-colorblind', Settings.colorblind);
    set('set-gore', Settings.gore);
    this.$('gore-badge').classList.toggle('hidden', !Settings.gore);
    document.documentElement.classList.toggle('reduce-motion', Settings.motion);
    for (const b of document.querySelectorAll('.key-btn')) {
      const d = b.dataset.dir;
      b.textContent = keyLabel(Settings.keys[d]);
      b.setAttribute('aria-label', `${d} key: ${keyLabel(Settings.keys[d])}. Press to change`);
      b.classList.remove('listening');
      const kb = this.$('kb-' + d);
      if (kb) kb.textContent = keyLabel(Settings.keys[d]);
    }
  },

  // Wait for the next key press and bind it to this direction.
  bindKey(btn) {
    const dir = btn.dataset.dir;
    btn.textContent = 'Press a key';
    btn.classList.add('listening');
    Input.capture = code => {
      Input.capture = null;
      const reserved = ['Escape', 'Space', 'Enter', 'Tab', 'KeyP', 'KeyM'];
      if (code && !reserved.includes(code)) {
        for (const d in Settings.keys) if (Settings.keys[d] === code && d !== dir) Settings.keys[d] = Settings.keys[dir]; // swap
        Settings.keys[dir] = code;
        Settings.save();
        Sound.click();
      }
      this.syncSettings();
      btn.focus({ preventScroll: true });
    };
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
    const tab = this.shopTab, table = SHOP_TABS[tab];
    this.$('shop-coins').textContent = Game.bank;
    for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
    const grid = this.$('shop-grid');
    grid.textContent = '';
    for (const id in table) {
      const item = table[id];
      const owned = Shop.has(tab, id), equipped = Shop.equipped(tab, id);
      const card = document.createElement('div');
      card.className = 'skin' + (equipped ? ' equipped' : '') + (item.unlock && !owned ? ' locked' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 120;
      this.preview(cv, tab, id);
      const name = document.createElement('b');
      name.textContent = item.name;
      card.append(cv, name);
      const btn = document.createElement('button');
      if (equipped) {
        btn.className = 'btn-plate small';
        btn.textContent = 'Equipped';
        btn.disabled = true;
      } else if (owned) {
        btn.className = 'btn-plate small';
        btn.textContent = 'Equip';
        btn.addEventListener('click', () => { Shop.equip(tab, id); Sound.click(); this.renderShop(); });
      } else if (item.unlock) {
        const t = TROPHIES.find(x => x.id === item.unlock);
        const how = document.createElement('span');
        how.className = 'unlock';
        how.textContent = `Trophy: ${t ? t.desc : 'secret'}`;
        card.appendChild(how);
        btn.className = 'btn-plate small';
        btn.textContent = 'Locked';
        btn.disabled = true;
      } else {
        const afford = Game.bank >= item.price;
        btn.className = 'btn-yellow small';
        btn.innerHTML = `<span class="coin-ico"></span> ${item.price}`;
        btn.disabled = !afford;
        btn.setAttribute('aria-label', `Buy ${item.name} for ${item.price} coins`);
        btn.addEventListener('click', () => {
          if (Shop.buy(tab, id)) { Sound.powerup(); this.renderShop(); this.refreshMeta(); }
        });
      }
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      card.appendChild(btn);
      grid.appendChild(card);
    }
  },

  preview(cv, tab, id) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width * (tab === 'trails' ? 0.6 : 0.5), cv.height * 0.74);
    g.scale(2.4, 2.4);
    const skin = tab === 'skins' ? SKINS[id] : Shop.skin();
    const hat = tab === 'hats' ? (id === 'none' ? null : id) : tab === 'skins' ? null : Shop.hat;
    if (tab === 'trails') this.trailPreview(g, id);
    Draw.shadow(g, 0, 0, 30, 24, 0.9);
    Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, skin, hat);
    g.restore();
    if (tab === 'skins' && SKINS[id].unlock && !Shop.has('skins', id)) { // locked: a padlock over a silhouette
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(20,14,10,0.78)';
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#f7f7f2';
      g.fillRect(50, 58, 20, 16);
      g.strokeStyle = '#f7f7f2';
      g.lineWidth = 3;
      g.beginPath(); g.arc(60, 58, 6, Math.PI, 0); g.stroke();
    }
  },

  trailPreview(g, id) {
    const dots = [[-13, 3], [-18, 8], [-11, 12], [-20, 15], [-15, 20], [-10, 24], [-19, 25]];
    dots.forEach(([x, y], i) => {
      const py = -y * 0.8;
      if (id === 'sparkle') { g.fillStyle = i % 2 ? '#fff6b0' : '#ffd84d'; g.fillRect(x - 1.5, py - 1.5, 3, 3); }
      else if (id === 'bubbles') { g.strokeStyle = '#8fd0ff'; g.lineWidth = 1; g.beginPath(); g.arc(x, py, 2 + (i % 3), 0, 6.28); g.stroke(); }
      else if (id === 'confetti') { g.fillStyle = ['#ff5c8a', '#ffd23f', '#34c6ea', '#7ed957'][i % 4]; g.fillRect(x - 2, py - 1, 4, 2.5); }
      else if (id === 'fire') { g.fillStyle = ['#ffe27a', '#ff8a2a', '#f0531c'][i % 3]; g.beginPath(); g.arc(x, py, 3 - i * 0.2, 0, 6.28); g.fill(); }
      else if (id === 'rainbow') { g.fillStyle = `hsl(${i * 50},95%,62%)`; g.beginPath(); g.arc(x, py, 2.6, 0, 6.28); g.fill(); }
    });
  },

  // ---- Trophy room ---------------------------------------------------------------
  renderTrophies() {
    const tab = this.trophyTab;
    for (const t of document.querySelectorAll('[data-ttab]')) t.setAttribute('aria-selected', t.dataset.ttab === tab ? 'true' : 'false');
    this.$('trophy-progress').textContent = `${Trophies.count} / ${TROPHIES.length}`;
    const list = this.$('trophy-list'), stats = this.$('stats-panel');
    list.classList.toggle('hidden', tab !== 'trophies');
    stats.classList.toggle('hidden', tab !== 'stats');
    if (tab === 'trophies') {
      list.textContent = '';
      for (const t of TROPHIES) {
        const got = Trophies.has(t.id);
        const li = document.createElement('li');
        li.className = got ? 'got' : '';
        const cup = document.createElement('span');
        cup.className = 'cup';
        cup.setAttribute('aria-hidden', 'true');
        const txt = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = t.name;
        const s = document.createElement('span');
        s.textContent = t.desc;
        txt.append(b, s);
        if (t.skin) {
          const u = document.createElement('em');
          u.textContent = `Unlocks the ${SKINS[t.skin].name} skin`;
          txt.appendChild(u);
        }
        const st = document.createElement('i');
        st.textContent = got ? 'Earned' : 'Locked';
        li.append(cup, txt, st);
        list.appendChild(li);
      }
      return;
    }
    const d = Stats.data;
    const fmtTime = s => {
      const m = Math.floor(s / 60), h = Math.floor(m / 60);
      return h ? `${h}h ${m % 60}m` : `${m}m ${Math.floor(s % 60)}s`;
    };
    const rows = [
      ['Runs played', d.runs], ['Time on the road', fmtTime(d.time)], ['Rows crossed', d.rows.toLocaleString()],
      ['Coins earned', d.coins.toLocaleString()], ['Cars wrecked near you', d.wrecks.toLocaleString()],
      ['Close calls', d.closeCalls.toLocaleString()], ['Best combo', 'x' + d.bestCombo], ['Trains dodged', d.trainDodges],
      ['Logs ridden', d.logs], ['Secret events survived', d.events], ['Daily challenges', d.dailies.length],
      ['Two-player matches', d.versusGames],
    ];
    const bests = [['Endless', Game.bestFor('normal')], ['Hardcore', Game.bestFor('hardcore')], ['Time attack', Game.bestFor('time')], ['Today’s daily', Game.bestFor('daily')]];
    stats.textContent = '';
    const mk = (cls, pairs, title) => {
      const h = document.createElement('p');
      h.className = 'stats-title';
      h.textContent = title;
      const dl = document.createElement('dl');
      dl.className = cls;
      for (const [k, v] of pairs) {
        const wrap = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        wrap.append(dt, dd);
        dl.appendChild(wrap);
      }
      stats.append(h, dl);
    };
    mk('stat-grid', bests, 'Best scores');
    mk('stat-grid', rows, 'All time');
    // deaths by cause, as bars
    const h = document.createElement('p');
    h.className = 'stats-title';
    h.textContent = `Deaths by cause (${d.deathsTotal})`;
    stats.appendChild(h);
    const causes = Object.entries(d.deaths).sort((a, b) => b[1] - a[1]);
    const max = causes.length ? causes[0][1] : 1;
    const ul = document.createElement('ul');
    ul.className = 'death-bars';
    if (!causes.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No deaths yet. Impressive.';
      ul.appendChild(li);
    }
    for (const [k, n] of causes) {
      const li = document.createElement('li');
      const lab = document.createElement('span');
      lab.textContent = DEATH_LABELS[k] || k;
      const bar = document.createElement('span');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(4, (n / max) * 100)}%`;
      bar.appendChild(fill);
      const num = document.createElement('b');
      num.textContent = n;
      li.append(lab, bar, num);
      ul.appendChild(li);
    }
    stats.appendChild(ul);
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
    const db = Store.get(Game.dailyKey(), 0);
    this.$('daily-best').textContent = db ? `Best ${db}` : dayLabel(dayKey());
    const hb = Game.bestFor('hardcore'), tb = Game.bestFor('time');
    this.$('best-hardcore').textContent = hb ? `Best ${hb}` : '';
    this.$('best-time').textContent = tb ? `Best ${tb}` : '';
    const w = Game.versusWins;
    this.$('vs-record').textContent = w[0] + w[1] ? `${w[0]} : ${w[1]}` : '';
    this.$('trophy-count').textContent = `${Trophies.count}/${TROPHIES.length}`;
    this.$('gore-badge').classList.toggle('hidden', !Settings.gore);
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
  zoneToast(z) { this.toast('t-zone', `ENTERING ${ZONES[z].name}`, ZONES[z].sub, 3600); },
  trophyToast(t) {
    this.toast('t-trophy', `TROPHY: ${t.name.toUpperCase()}`, t.skin ? `${t.desc}. New skin: ${SKINS[t.skin].name}` : t.desc, 4000);
  },

  // ---- Screens ----------------------------------------------------------------
  show(id, on) { this.$(id).classList.toggle('hidden', !on); },

  showTitle() {
    this.refreshMeta();
    this.show('screen-title', true);
    this.show('screen-over', false);
    this.show('screen-pause', false);
    this.show('hud', false);
    this.$('btn-play').focus({ preventScroll: true });
  },

  startRun() {
    const versus = Game.players.length > 1, mode = Game.mode;
    this.show('screen-title', false);
    this.show('screen-over', false);
    this.show('screen-pause', false);
    this.show('hud', true);
    this.show('daily-badge', mode === 'daily');
    const badge = this.$('mode-badge');
    badge.textContent = mode === 'hardcore' ? 'HARDCORE' : mode === 'time' ? 'TIME ATTACK' : '';
    badge.className = 'plate mode-badge' + (mode === 'hardcore' ? ' hardcore' : mode === 'time' ? ' time' : ' hidden');
    this.show('timer', mode === 'time');
    this.show('p2-plate', versus);
    this.show('best-plate', !versus);
    this.show('coin-plate', !versus);
    this.show('vs-tally', versus);
    this.$('score-lbl').textContent = versus ? 'P1 ROWS' : 'SCORE';
    this.$('score-plate').classList.toggle('p1', versus);
    if (versus) this.$('vs-tally').textContent = `WINS  P1 ${Game.versusWins[0]} : ${Game.versusWins[1]} P2`;
    this.toasts.textContent = '';
    for (const k in this.shown) this.shown[k] = -1;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  },

  showPause(on) {
    this.show('screen-pause', on);
    if (on) {
      this.renderMissions(this.$('pause-missions'), true);
      this.show('pause-missions', Game.tracksProgress());
      this.$('btn-resume').focus({ preventScroll: true });
    }
  },

  showReplay() {
    this.show('hud', false);
  },

  showGameOver(info) {
    const vs = info.versus;
    this.show('hud', false);
    this.$('report-no').textContent = 'No. ' + String(info.run).padStart(5, '0');
    this.$('over-title').textContent = vs ? (vs.winner ? `Player ${vs.winner.id + 1} wins!` : 'Draw!') : info.cause === "Time's up" ? "Time's up" : 'Game Over';
    this.$('over-cause').textContent = info.cause;
    for (const id of ['over-rows-row', 'over-score-row', 'over-best-row', 'over-coins-row']) this.show(id, !vs);
    for (const id of ['over-p1-row', 'over-p2-row', 'over-tally-row']) this.show(id, !!vs);
    if (vs) {
      this.$('over-p1').textContent = `${vs.rows[0]} rows`;
      this.$('over-p2').textContent = `${vs.rows[1]} rows`;
      this.$('over-tally').textContent = `P1 ${vs.wins[0]} : ${vs.wins[1]} P2`;
    } else {
      this.$('over-rows').textContent = `${info.rows} ${info.rows === 1 ? 'row' : 'rows'}`;
      this.$('over-score').textContent = info.score;
      this.$('over-best').textContent = info.best;
      const mult = MODES[info.mode].coinMult;
      this.$('over-coins').textContent = `${info.coins}${mult ? ` (x${mult})` : ''}, ${info.bank} total`;
    }
    const modeName = info.daily ? `Daily challenge, ${info.daily}` : info.mode === 'normal' || vs ? '' : MODES[info.mode].name;
    this.$('over-mode-row').classList.toggle('hidden', !modeName);
    this.$('over-mode').textContent = modeName;
    this.$('over-new').classList.toggle('hidden', !info.newBest);
    this.$('report').classList.toggle('bloody', !!info.gore);
    this.$('btn-again').textContent = vs ? 'REMATCH' : 'PLAY AGAIN';
    const tr = this.$('over-trophies');
    tr.textContent = '';
    for (const t of info.trophies) {
      const li = document.createElement('li');
      li.textContent = t.skin ? `${t.name}: ${SKINS[t.skin].name} skin unlocked` : t.name;
      tr.appendChild(li);
    }
    tr.classList.toggle('hidden', !info.trophies.length);
    this.show('over-missions', !vs);
    if (!vs) this.renderMissions(this.$('over-missions'), true);
    this.show('screen-over', true);
    this.show('powers', false);
    this.$('screen-over').scrollTop = 0;
    setTimeout(() => this.$('btn-again').focus({ preventScroll: true }), 50);
  },

  update() {
    if (this.hud.classList.contains('hidden')) return;
    const s = this.shown;
    const versus = Game.players.length > 1;
    const shownScore = versus ? Player.maxRow : Game.score;
    if (shownScore !== s.score) {
      s.score = shownScore;
      this.score.textContent = shownScore;
      this.score.classList.remove('bump');
      void this.score.offsetWidth; // restart the pop animation
      this.score.classList.add('bump');
    }
    if (versus) {
      if (Player2.maxRow !== s.p2) { s.p2 = Player2.maxRow; this.$('p2-score').textContent = Player2.maxRow; }
    } else {
      const best = Math.max(Game.bestFor(Game.mode), Game.score);
      if (best !== s.best) { s.best = best; this.best.textContent = best; }
      if (Game.coins !== s.coins) { s.coins = Game.coins; this.coins.textContent = Game.coins; }
    }
    if (Game.mode === 'time') {
      const t = Math.ceil(Game.timeLeft);
      if (t !== s.timer) {
        s.timer = t;
        this.$('timer-val').textContent = t;
        this.$('timer').classList.toggle('low', t <= 10);
      }
    }

    const comboOn = !versus && Player.combo > 1 && Game.time - Player.comboT < 3 && Game.state === 'playing';
    this.combo.classList.toggle('hidden', !comboOn);
    if (comboOn) this.combo.firstElementChild.textContent = 'x' + Player.combo;

    this.show('powers', !versus && (Game.state === 'playing' || Game.state === 'paused'));
    for (const k in this.chips) {
      const ch = this.chips[k];
      const left = Powers.left(k);
      const on = k === 'shield' ? Player.shield : left > 0;
      if (on !== ch.on) { ch.el.classList.toggle('hidden', !on); ch.on = on; }
      if (on && ch.fill) {
        ch.fill.style.transform = `scaleX(${(left / POWERUPS[k].dur).toFixed(3)})`;
        ch.el.classList.toggle('ending', left < 1.5);
      }
    }

    const stunned = !versus && !Settings.motion && Player.alive && Player.stun > 0.25 && Player.stun < 10;
    if (stunned !== this.stunned) { this.stunned = stunned; this.canvas.classList.toggle('stunned', stunned); }
    const mini = Events.miniAmt > 0.3;
    if (mini !== this.mini) { this.mini = mini; this.canvas.classList.toggle('mini', mini); }
  },
};
