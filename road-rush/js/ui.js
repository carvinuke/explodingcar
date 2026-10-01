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
  fog: ['FOG AHEAD', "You won't see what's coming until it's close"],
  leaves: ['FALLING LEAVES', 'Autumn is here'],
};

const UI = {
  shown: { score: -1, best: -1, coins: -1, timer: -1, p2: -1 },
  modal: null,        // 'settings' | 'warning' | 'shop' | 'trophies' | null
  returnFocus: null,
  shopTab: 'skins',
  trophyTab: 'trophies',
  goalTab: 'biomes',

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
      if (POWERUPS[k].instant) continue; // used up the moment you grab it: no HUD chip
      const def = POWERUPS[k], url = Draw.iconURL(k);
      const el = document.createElement('div');
      el.className = 'pw hidden';
      el.style.setProperty('--c', def.color);
      el.innerHTML = `<img src="${url}" alt=""><div class="pw-info"><span class="pw-name">${def.name}</span>` +
        (k === 'shield' ? '<span class="pw-pips">1 HIT</span>' : '<span class="pw-bar"><i></i></span>') + '</div>';
      this.powers.appendChild(el);
      this.chips[k] = { el, fill: el.querySelector('i'), on: false };
    }

    // Big J's rage meter and the egg you're carrying get chips too
    for (const [k, name, color] of [['rage', 'Rage', '#ff3b2f'], ['calm', 'Calm', '#5aa9ff'], ['egg', 'Egg', '#ff8ad8']]) {
      const el = document.createElement('div');
      el.className = 'pw hidden';
      el.style.setProperty('--c', color);
      el.innerHTML = `<img src="${Draw.iconURL(k)}" alt=""><div class="pw-info"><span class="pw-name">${name}</span><span class="pw-bar"><i></i></span></div>`;
      this.powers.appendChild(el);
      this.extra = this.extra || {};
      this.extra[k] = { el, fill: el.querySelector('i'), name: el.querySelector('.pw-name'), on: false, text: '' };
    }

    const stop = e => e.stopPropagation();
    for (const b of document.querySelectorAll('button')) b.addEventListener('pointerdown', stop);
    const on = (id, fn) => $(id).addEventListener('click', fn);
    on('btn-play', () => Game.start('normal'));
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
    on('btn-goals', () => this.openGoals());
    on('btn-goals-done', () => this.closeModal());
    on('btn-claw', () => this.openClaw());
    on('btn-claw-done', () => this.closeModal());
    on('btn-claw-grab', () => this.clawGrab('normal'));
    on('btn-claw-drop', () => this.clawDrop());
    on('btn-claw-claim', () => this.clawClaim());
    on('btn-claw-gold', () => this.clawGrab('gold'));
    on('btn-settings-done', () => this.closeModal());
    on('btn-shop-done', () => this.closeModal());
    on('btn-trophies-done', () => this.closeModal());
    on('admin-close', () => this.closeModal());
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
    on('set-graves', flip('graves'));
    on('set-forks', flip('forks'));
    on('set-lowgfx', () => { Settings.lowGfx = !Settings.lowGfx; Settings.save(); this.syncSettings(); Renderer.resScale = 1; Renderer.resize(); Sound.click(); });
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
    on('btn-reset-data', () => this.openReset());
    on('btn-reset-cancel', () => this.closeModal());
    on('btn-reset-ok', () => {
      const b = this.$('btn-reset-ok');
      if (!b.dataset.armed) { // a second tap, just to be sure
        b.dataset.armed = '1';
        b.textContent = 'Tap again to delete it all';
        Sound.bump();
        return;
      }
      Store.wipeProgress();
      location.reload();
    });
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
    for (const t of document.querySelectorAll('[data-gtab]')) {
      t.addEventListener('click', () => { this.goalTab = t.dataset.gtab; Sound.click(); this.renderGoals(); });
    }
    // clicking the dimmed backdrop closes a dialog
    for (const id of ['screen-settings', 'screen-warning', 'screen-reset', 'screen-shop', 'screen-trophies', 'screen-goals', 'screen-claw']) {
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

  // Settings: wipe all progress (asks first, then asks again).
  openReset() {
    const col = Shop.collection();
    this.$('reset-body').textContent = `This permanently deletes your ${Game.bank.toLocaleString()} coins, your level (${Levels.level}), `
      + `every cosmetic you own (${col.have} of ${col.total}), your trophies, stats, best scores and missions. Your settings and controls are kept. This can't be undone.`;
    const b = this.$('btn-reset-ok');
    delete b.dataset.armed;
    b.textContent = 'Delete everything';
    this.modal = 'reset';
    this.show('screen-reset', true);
    this.$('btn-reset-cancel').focus({ preventScroll: true });
  },

  openShop() {
    this.renderShop();
    this.openModal('shop', 'screen-shop', 'btn-shop-done');
  },

  openTrophies() {
    this.renderTrophies();
    this.openModal('trophies', 'screen-trophies', 'btn-trophies-done');
  },

  openGoals() {
    this.renderGoals();
    this.openModal('goals', 'screen-goals', 'btn-goals-done');
  },

  closeModal() {
    if (Input.capture) Input.capture(null);
    if (this.modal === 'reset') {
      this.show('screen-reset', false);
      this.modal = 'settings';
      this.$('btn-reset-data').focus({ preventScroll: true });
      return;
    }
    if (this.modal === 'warning') {
      this.show('screen-warning', false);
      this.modal = 'settings';
      this.syncSettings();
      this.$('set-gore').focus({ preventScroll: true });
      return;
    }
    const was = this.modal;
    for (const id of ['screen-settings', 'screen-shop', 'screen-trophies', 'screen-goals', 'screen-claw', 'screen-admin']) this.show(id, false);
    this.modal = null;
    if (was === 'admin') Admin.closed();
    this.refreshMeta();
    if (this.returnFocus && this.returnFocus.focus) this.returnFocus.focus({ preventScroll: true });
  },

  syncSettings() {
    const set = (id, v) => this.$(id).setAttribute('aria-checked', v ? 'true' : 'false');
    set('set-sound', !Sound.muted);
    set('set-shake', Settings.shake);
    set('set-ghost', Settings.ghost);
    set('set-replay', Settings.replay);
    set('set-graves', Settings.graves);
    set('set-forks', Settings.forks);
    set('set-lowgfx', Settings.lowGfx);
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
    this.$('shop-shards').textContent = Shards.n;
    const col = Shop.collection();
    this.$('shop-collection').textContent = `COLLECTION ${col.have} / ${col.total}`;
    this.$('shop-collection-fill').style.width = `${(col.have / col.total) * 100}%`;
    const labels = { skins: 'Skins', hats: 'Hats', trails: 'Trails', pets: 'Pets', auras: 'Auras', prints: 'Footprints', titles: 'Titles', sounds: 'Sounds', upgrades: 'Upgrades' };
    this.renderOutfits();
    for (const t of document.querySelectorAll('[data-tab]')) {
      t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
      const n = t.dataset.tab === 'upgrades' ? Upgrades.totals() : Shop.tabCount(t.dataset.tab);
      t.innerHTML = `<span>${labels[t.dataset.tab]}</span><small>${n.have}/${n.total}</small>`;
    }
    const grid = this.$('shop-grid');
    grid.textContent = '';
    grid.classList.toggle('upg-grid', tab === 'upgrades');
    if (tab === 'upgrades') { this.renderUpgrades(grid); return; }
    // three groups: what you own (equipped first), what's for sale (cheapest
    // first), and everything still locked at the bottom
    const yours = [], sale = [], locked = [];
    for (const id in table) {
      const item = table[id];
      if (Shop.has(tab, id)) yours.push(id);
      else if (earnedOnly(item)) locked.push(id);
      else sale.push(id);
    }
    yours.sort((a, b) => Shop.equipped(tab, b) - Shop.equipped(tab, a));
    sale.sort((a, b) => table[a].price - table[b].price);
    const rank = it => it.level ? [0, it.level] : it.mastery ? [1, 0] : it.roadex ? [2, 0] : it.unlock ? [3, 0] : it.prestige ? [4, it.prestige] : it.egg ? [5, 0] : it.box ? [6, 0] : [7, 0];
    locked.sort((a, b) => { const ra = rank(table[a]), rb = rank(table[b]); return ra[0] - rb[0] || ra[1] - rb[1]; });
    for (const [title, ids] of [['Yours', yours], ['For sale', sale], ['Locked', locked]]) {
      if (!ids.length) continue;
      const head = document.createElement('p');
      head.className = 'shop-section' + (title === 'Locked' ? ' locked' : '');
      head.innerHTML = `<span></span><small>${ids.length}</small>`;
      head.firstChild.textContent = title;
      grid.appendChild(head);
      for (const id of ids) grid.appendChild(this.shopCard(tab, id));
    }
  },

  // One item in the shop.
  shopCard(tab, id) {
    const item = SHOP_TABS[tab][id];
    const owned = Shop.has(tab, id), equipped = Shop.equipped(tab, id);
    const special = earnedOnly(item);
    const card = document.createElement('div');
    card.className = 'skin' + (equipped ? ' equipped' : '') + (special && !owned ? ' locked' : '') + (item.egg ? ' egg' : '') + (item.box ? ' boxed' : '') + (item.claw ? ' clawed' : '');
    if (tab === 'pets' && Evolve.has(id)) card.classList.add('evolved');
    if (item.rare) {
      const tag = document.createElement('span');
      tag.className = 'rarity r-' + item.rare.toLowerCase();
      tag.textContent = item.box ? 'MYSTERY BOX' : item.claw ? (tab === 'pets' ? 'JACKPOT' : 'CLAW MACHINE') : item.rare + ' · EGG';
      card.appendChild(tag);
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = 120;
    this.preview(cv, tab, id);
    if (tab === 'sounds') { // tap to hear it
      cv.classList.add('playable');
      cv.addEventListener('click', () => { Sound.init(); Sound.hopAs(id, false); });
    }
    const name = document.createElement('b');
    name.textContent = tab === 'pets' && id !== 'none' ? Evolve.name(id) : item.name;
    card.append(cv, name);
    // one short line about it (the full text is in the tooltip)
    const info = document.createElement('span');
    info.className = 'card-info';
    if (tab === 'pets' && id !== 'none' && owned) { // your pet's level, above what it does
      const lv = PetLevels.info(id), pl = document.createElement('span');
      pl.className = 'card-info petlv';
      pl.textContent = Evolve.has(id) ? 'Evolved · max level' : lv.max ? 'Level 5 (max)' : `Level ${lv.level} · ${lv.into}/${lv.need} XP`;
      card.appendChild(pl);
    }
    if (item.perk) info.textContent = item.perk;
    if (item.perk || PET_MAX[id]) card.title = [item.perk, PET_MAX[id] && tab === 'pets' ? `Level 5: ${PET_MAX[id]}` : ''].filter(Boolean).join('\n');
    if (info.textContent) card.appendChild(info);
    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const stop = el => el.addEventListener('pointerdown', e => e.stopPropagation());
    if (tab === 'pets' && owned && Evolve.can(id)) { // level 5: it can evolve
      const ev = document.createElement('button');
      ev.className = 'btn-yellow small evolve-btn';
      ev.innerHTML = `Evolve <span class="coin-ico"></span> ${EVOLVE_COST}`;
      ev.disabled = Game.bank < EVOLVE_COST;
      ev.title = 'Evolved pets grow, glow, and give +20% XP and +10% coins';
      ev.addEventListener('click', () => {
        if (!Evolve.go(id)) return;
        Sound.levelUp();
        this.toast('t-hatch', `${PETS[id].name.toUpperCase()} EVOLVED!`, `Meet Mega ${PETS[id].name}: +20% XP and +10% coins`, 3600);
        this.renderShop();
        this.refreshMeta();
      });
      stop(ev);
      foot.appendChild(ev);
    }
    const btn = document.createElement('button');
    if (equipped) {
      btn.className = 'btn-plate small';
      btn.textContent = 'Equipped';
      btn.disabled = true;
    } else if (owned) {
      btn.className = 'btn-plate small';
      btn.textContent = 'Equip';
      btn.addEventListener('click', () => { Shop.equip(tab, id); Sound.click(); this.renderShop(); });
    } else if (special) {
      const t = item.unlock && TROPHIES.find(x => x.id === item.unlock);
      const how = document.createElement('span');
      how.className = 'how';
      how.textContent = item.egg ? 'Hatch it from an egg'
        : item.claw ? 'Win it from the claw machine'
        : item.box ? 'From mystery boxes'
        : item.mastery ? `Master ${zoneName(item.mastery)} (Goals)`
        : item.roadex ? `Roadex: ${ROADEX[item.roadex].name} page`
        : item.prestige ? `Reach prestige ${item.prestige}`
        : item.level ? `Reach level ${item.level}` : `Trophy: ${t ? t.name : 'secret'}`;
      if (t) how.title = t.desc;
      foot.appendChild(how);
      if (!item.box) { card.appendChild(foot); return card; }
      btn.className = 'btn-yellow small'; // mystery-box items can be crafted from shards
      btn.innerHTML = `<span class="shard-ico"></span> ${SHARD_COST} Craft`;
      btn.disabled = Shards.n < SHARD_COST;
      btn.setAttribute('aria-label', `Craft ${item.name} for ${SHARD_COST} shards`);
      btn.addEventListener('click', () => {
        if (!Shards.craft(tab, id)) return;
        Sound.hatch();
        Shop.equip(tab, id);
        this.renderShop();
      });
    } else {
      btn.className = 'btn-yellow small';
      btn.innerHTML = `<span class="coin-ico"></span> ${item.price}`;
      btn.disabled = Game.bank < item.price;
      btn.setAttribute('aria-label', `Buy ${item.name} for ${item.price} coins`);
      btn.addEventListener('click', () => {
        if (Shop.buy(tab, id)) { Sound.powerup(); this.renderShop(); this.refreshMeta(); }
      });
    }
    stop(btn);
    foot.appendChild(btn);
    card.appendChild(foot);
    return card;
  },

  preview(cv, tab, id) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if (tab === 'titles') { this.titlePreview(g, cv, id); return; }
    if (SHOP_TABS[tab][id].box && !Shop.has(tab, id)) { this.mysteryPreview(g, cv); return; }
    if (tab === 'prints') { this.printPreview(g, cv, id); return; }
    if (tab === 'auras') { this.auraPreview(g, cv, id); return; }
    if (tab === 'sounds') { this.soundPreview(g, cv, id); return; }
    g.save();
    g.translate(cv.width * (tab === 'trails' ? 0.6 : 0.5), cv.height * 0.74);
    g.scale(2.4, 2.4);
    const skin = tab === 'skins' ? SKINS[id] : Shop.skin();
    const hat = tab === 'hats' ? (id === 'none' ? null : id) : tab === 'skins' ? null : Shop.hat;
    if (tab === 'trails') this.trailPreview(g, id);
    const eggPet = tab === 'pets' && PETS[id].egg;
    if (eggPet) { // the hatchlings get the stage to themselves
      const fly = ['phoenix', 'dragon', 'owl'].includes(id);
      g.translate(fly ? -2 : -3, fly ? 2 : -2);
      g.scale(1.25, 1.25);
      Draw.shadow(g, 0, 0, 24, 16, 0.8);
      this.petArt(g, { type: id, face: 1, z: fly ? 5 : 0, blink: 0, ph: 0 });
    } else {
      if (tab === 'pets' && id !== 'none') g.translate(-9, 0);
      Draw.shadow(g, 0, 0, 30, 24, 0.9);
      Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, skin, hat);
    }
    if (tab === 'pets' && id !== 'none' && !eggPet) {
      const pet = { type: id, face: -1, z: PETS[id].fly ? 26 : 0, blink: 0, ph: 0 };
      g.save();
      g.translate(22, 4);
      Draw.shadow(g, 0, 0, 20, 14, 0.7);
      this.petArt(g, pet);
      g.restore();
    }
    g.restore();
    const lockedPet = tab === 'pets' && PETS[id].egg && !Shop.has('pets', id);
    if (lockedPet || (tab === 'skins' && earnedOnly(SKINS[id]) && !Shop.has('skins', id))) { // locked: a padlock over a silhouette
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

  // A pet in a preview (evolved pets are bigger and glow).
  petArt(g, pet) {
    if (!Evolve.has(pet.type)) { Draw.pet(g, pet, 1); return; }
    Evolve.aura(g, pet, 1);
    g.save();
    g.scale(1.3, 1.3);
    Draw.pet(g, pet, 1);
    g.restore();
    Evolve.sparkles(g, pet, 1);
  },

  // Mystery-box items stay a mystery until you find one.
  mysteryPreview(g, cv) {
    g.save();
    g.translate(cv.width / 2, cv.height * 0.7);
    g.scale(2.6, 2.6);
    Draw.shadow(g, 0, 0, 22, 16, 0.7);
    Draw.mysteryBox(g, { phase: 0 }, 0.4);
    g.restore();
  },

  // Titles: a little sign with the words on it.
  titlePreview(g, cv, id) {
    const name = id === 'none' ? '—' : TITLES[id].name.toUpperCase();
    const W = cv.width, H = cv.height;
    g.fillStyle = '#1d1b3a';
    g.fillRect(2, H * 0.26, W - 4, H * 0.48);
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 3;
    g.strokeRect(7, H * 0.26 + 5, W - 14, H * 0.48 - 10);
    g.fillStyle = '#ffd23f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 18px ${UI_FONT}`;
    const words = name.split(' ');
    let lines = [name];
    if (g.measureText(name).width > W - 24 && words.length > 1) { // two lines
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }
    let size = 18;
    while (lines.some(l => g.measureText(l).width > W - 24) && size > 10) { size--; g.font = `900 ${size}px ${UI_FONT}`; }
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + 1 + (i - (lines.length - 1) / 2) * (size + 2)));
  },

  // Hop sounds: a speaker with sound waves (tap the card to hear it).
  soundPreview(g, cv, id) {
    const W = cv.width, H = cv.height, cx = W * 0.42, cy = H * 0.5;
    const col = id === 'none' ? '#c9ced6' : SOUNDS[id].claw ? '#ff4fe0' : SOUNDS[id].level || SOUNDS[id].unlock ? '#ffd23f' : '#7fe0ff';
    g.fillStyle = '#2b2622';
    g.beginPath(); g.arc(W / 2, cy, 46, 0, 6.2832); g.fill();
    g.fillStyle = '#f7f7f2';
    g.beginPath(); g.moveTo(cx - 20, cy - 10); g.lineTo(cx - 8, cy - 10); g.lineTo(cx + 6, cy - 24); g.lineTo(cx + 6, cy + 24); g.lineTo(cx - 8, cy + 10); g.lineTo(cx - 20, cy + 10); g.closePath(); g.fill();
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx + 8, cy, 12 + k * 10, -0.7, 0.7); g.stroke(); }
    g.fillStyle = col;
    g.font = `900 13px ${UI_FONT}`;
    g.textAlign = 'center';
    g.fillText('▶ TAP', W / 2, H - 6);
  },

  // Auras: your character with the aura around it.
  auraPreview(g, cv, id) {
    g.save();
    g.translate(cv.width * 0.5, cv.height * 0.72);
    g.scale(2.1, 2.1);
    const t = 1.3;
    if (id !== 'none') Auras.draw(g, id, t, 0, false);
    Draw.shadow(g, 0, 0, 30, 24, 0.9);
    Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, Shop.skin(), Shop.hat);
    if (id !== 'none') Auras.draw(g, id, t, 0, true);
    g.restore();
  },

  // Footprints: your character with a trail of steps behind it.
  printPreview(g, cv, id) {
    g.save();
    g.translate(cv.width * 0.5, cv.height * 0.74);
    g.scale(2.2, 2.2);
    g.translate(6, -4);
    for (let k = 0; k < 3; k++) if (id !== 'none') Prints.drawOne(g, { x: -14 + k * 2, y: -10 - k * 11, kind: id, n: k, t: 1 }, 1.2, 0.95);
    Draw.shadow(g, 0, 0, 30, 24, 0.9);
    Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, Shop.skin(), Shop.hat);
    g.restore();
  },

  // Three saved outfits: one tap to wear, one to save what you've got on now.
  renderOutfits() {
    const box = this.$('outfits');
    if (!box) return;
    box.textContent = '';
    Shop.outfits().forEach((o, i) => {
      const slot = document.createElement('div');
      slot.className = 'outfit' + (o ? '' : ' empty');
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      if (o) {
        g.translate(32, 50);
        g.scale(1.3, 1.3);
        Draw.shadow(g, 0, 0, 30, 24, 0.9);
        Draw.player(g, { facing: 'down', squash: 0, z: 0, rot: 0, flap: 0, char: 0 }, 0, SKINS[o.skins] || SKINS.chick, o.hats && o.hats !== 'none' ? o.hats : null);
      }
      const label = document.createElement('b');
      label.textContent = `Outfit ${i + 1}`;
      const wear = document.createElement('button');
      wear.className = 'btn-plate small';
      wear.textContent = 'Wear';
      wear.disabled = !o;
      wear.addEventListener('click', () => { if (Shop.wearOutfit(i)) { Sound.powerup(); this.renderShop(); } });
      const save = document.createElement('button');
      save.className = 'btn-yellow small';
      save.textContent = o ? 'Save over' : 'Save';
      save.addEventListener('click', () => { Shop.saveOutfit(i); Sound.click(); this.renderShop(); });
      for (const b of [wear, save]) b.addEventListener('pointerdown', e => e.stopPropagation());
      const btns = document.createElement('div');
      btns.className = 'outfit-btns';
      btns.append(wear, save);
      slot.append(cv, label, btns);
      box.appendChild(slot);
    });
  },

  trailPreview(g, id) {
    const dots = [[-13, 3], [-18, 8], [-11, 12], [-20, 15], [-15, 20], [-10, 24], [-19, 25]];
    const look = FX.TRAIL_LOOK[id];
    if (look) {
      dots.forEach(([x, y], i) => FX.glyph(g, look[0], x, -y * 0.8, 5 - i * 0.25, look[1][i % look[1].length], i * 0.7));
      return;
    }
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
        const un = Trophies.unlocks(t.id);
        if (un.length) {
          const u = document.createElement('em');
          u.textContent = `Unlocks: ${un.join(', ')}`;
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
    const LI = Levels.info();
    const rows = [
      ['Level', `${LI.level} (${LI.into}/${LI.need} XP)`], ['Runs played', d.runs], ['Time on the road', fmtTime(d.time)], ['Rows crossed', d.rows.toLocaleString()],
      ['Coins earned', d.coins.toLocaleString()], ['Cars wrecked near you', d.wrecks.toLocaleString()],
      ['Close calls', d.closeCalls.toLocaleString()], ['Best combo', 'x' + d.bestCombo], ['Trains dodged', d.trainDodges],
      ['Logs ridden', d.logs], ['Secret events survived', d.events],
      ['Eggs hatched', d.hatched || 0], ['Rage stomps', d.stomps || 0], ['Chickens dodged on Reverse Day', d.revDodged || 0],
      ['Two-player matches', d.versusGames],
    ];
    const bests = [['Endless', Game.bestFor('normal')], ['Hardcore', Game.bestFor('hardcore')], ['Time attack', Game.bestFor('time')]];
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

  // ---- Upgrades ------------------------------------------------------------------------
  upgradeIcon(id, size = 26) {
    const c = UPGRADE_CATS[UPGRADES[id].cat];
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="currentColor" style="color:${c.color}">${c.icon}</svg>`;
  },

  // The shop's Upgrades tab: permanent levels bought with coins.
  renderUpgrades(grid) {
    const note = document.createElement('p');
    note.className = 'upg-note';
    note.textContent = 'Permanent upgrades for every single-player run. Each one has a few levels, and each level costs more.';
    grid.appendChild(note);
    for (const cat in UPGRADE_CATS) {
      const head = document.createElement('p');
      head.className = 'upg-cat';
      head.style.setProperty('--c', UPGRADE_CATS[cat].color);
      head.textContent = UPGRADE_CATS[cat].name;
      grid.appendChild(head);
      for (const id in UPGRADES) {
        const u = UPGRADES[id];
        if (u.cat !== cat) continue;
        const lv = Upgrades.level(id), max = Upgrades.max(id), done = lv >= max;
        const row = document.createElement('div');
        row.className = 'upg-row' + (done ? ' maxed' : '');
        row.style.setProperty('--c', UPGRADE_CATS[cat].color);
        const ico = document.createElement('span');
        ico.className = 'upg-ico';
        ico.innerHTML = this.upgradeIcon(id, 24);
        const txt = document.createElement('div');
        txt.className = 'upg-txt';
        const b = document.createElement('b');
        b.textContent = u.name;
        const now = document.createElement('span');
        now.textContent = lv ? u.desc(lv) : 'Not bought yet';
        const next = document.createElement('em');
        next.textContent = done ? 'Maxed out' : `Next: ${u.desc(lv + 1)}`;
        txt.append(b, now, next);
        const pips = document.createElement('span');
        pips.className = 'upg-pips';
        pips.setAttribute('aria-label', `Level ${lv} of ${max}`);
        for (let k = 0; k < max; k++) { const i = document.createElement('i'); if (k < lv) i.className = 'on'; pips.appendChild(i); }
        const btn = document.createElement('button');
        if (done) {
          btn.className = 'btn-plate small';
          btn.textContent = 'MAX';
          btn.disabled = true;
        } else {
          const price = Upgrades.price(id);
          btn.className = 'btn-yellow small';
          btn.innerHTML = `<span class="coin-ico"></span> ${price}`;
          btn.disabled = Game.bank < price;
          btn.setAttribute('aria-label', `Upgrade ${u.name} to level ${lv + 1} for ${price} coins`);
          btn.addEventListener('click', () => { if (Upgrades.buy(id)) { Sound.powerup(); this.renderShop(); this.refreshMeta(); } });
        }
        btn.addEventListener('pointerdown', e => e.stopPropagation());
        row.append(ico, txt, pips, btn);
        grid.appendChild(row);
      }
    }
  },

  // ---- The claw machine ---------------------------------------------------------------
  openClaw() {
    this.renderClaw();
    this.openModal('claw', 'screen-claw', 'btn-claw-grab');
    const cv = this.$('claw-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = CLAW_BOX.W * dpr; cv.height = CLAW_BOX.H * dpr;
    this.clawCtx = cv.getContext('2d');
    this.clawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!ClawSim.claw || !ClawSim.busy()) ClawSim.init();
    if (!this.clawWired) { // steering: hold the arrow buttons, or tap where you want it
      this.clawWired = true;
      const hold = (id, dir) => {
        const b = this.$(id);
        b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); ClawSim.steer(dir); });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (ClawSim.claw && ClawSim.claw.dir === dir) ClawSim.steer(0); });
      };
      hold('btn-claw-left', -1);
      hold('btn-claw-right', 1);
      cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect();
        ClawSim.aimAt(((e.clientX - r.left) / r.width) * CLAW_BOX.W);
      });
    }
    let last = performance.now();
    const loop = () => {
      if (this.modal !== 'claw') return;
      const now = performance.now();
      ClawSim.update((now - last) / 1000);
      last = now;
      ClawSim.draw(this.clawCtx, now / 1000);
      const aiming = ClawSim.aiming();
      if (aiming !== this.clawAiming) { this.clawAiming = aiming; this.renderClaw(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  renderClaw() {
    this.$('claw-coins').textContent = Game.bank;
    const busy = ClawSim.busy(), aiming = ClawSim.aiming();
    for (const [tier, id] of [['normal', 'btn-claw-grab'], ['gold', 'btn-claw-gold']]) {
      const T = CLAW_TIERS[tier], b = this.$(id);
      b.innerHTML = `${T.name} <span class="coin-ico"></span> ${T.price}`;
      b.disabled = Game.bank < T.price || busy || !!this.clawPrize;
    }
    this.show('claw-pay', !aiming);
    this.show('claw-steer', aiming);
    // your record at the machine
    const d = Stats.data, grabs = d.clawGrabs || 0, wins = d.clawWins || 0;
    const owned = Claw.prizes(true).concat(Claw.prizes(false)).filter(([t, id]) => Shop.has(t, id)).length;
    const total = Claw.prizes(true).length + Claw.prizes(false).length;
    const rows = [['Grabs', grabs], ['Prizes won', wins], ['Jackpots', d.clawJackpots || 0],
      ['Coins back', (d.clawCoins || 0).toLocaleString()], ['Win rate', grabs ? `${Math.round((wins / grabs) * 100)}%` : '–'], ['Claw prizes', `${owned}/${total}`]];
    const dl = this.$('claw-stats');
    dl.textContent = '';
    for (const [k, v] of rows) {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      wrap.append(dt, dd);
      dl.appendChild(wrap);
    }
  },

  clawGrab(tier) {
    if (ClawSim.busy() || this.clawPrize || !Claw.pay(tier)) return;
    Sound.click();
    this.$('claw-result').textContent = '';
    this.$('claw-result').className = 'claw-result';
    this.refreshMeta();
    ClawSim.start(tier, type => this.clawReveal(Claw.award(type, tier)));
    this.renderClaw();
    setTimeout(() => this.$('btn-claw-drop').focus({ preventScroll: true }), 30);
  },

  clawDrop() { ClawSim.release(); },

  // Keyboard while the machine is open: left/right steer, Space/Enter/down drops.
  clawKey(e, down) {
    if (!ClawSim.aiming()) return false;
    const r = Input.route(e.code), d = r ? r.dir : ARROWS[e.code];
    if (d === 'left' || d === 'right') { e.preventDefault(); ClawSim.steer(down ? (d === 'left' ? -1 : 1) : 0); return true; }
    if (down && (d === 'down' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); ClawSim.release(); return true; }
    return false;
  },

  clawReveal(res) {
    const el = this.$('claw-result');
    this.renderClaw();
    this.refreshMeta();
    if (res.kind === 'empty') {
      el.textContent = 'The claw came up empty. Try again!';
      el.className = 'claw-result';
      Sound.bump();
      return;
    }
    el.textContent = '';
    this.clawPrize = res;
    const box = this.$('claw-win'), art = this.$('claw-win-art');
    art.textContent = '';
    if (res.kind === 'coins') {
      const coin = document.createElement('div');
      coin.className = 'big-coin';
      art.appendChild(coin);
      this.$('claw-win-title').textContent = `You won ${res.coins} coins!`;
      this.$('claw-win-sub').textContent = 'Not a prize capsule this time, but it pays you back.';
      box.className = 'claw-win';
      Sound.coin();
    } else {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 160;
      this.preview(cv, res.tab, res.id);
      art.appendChild(cv);
      const jackpot = res.kind === 'pet';
      this.$('claw-win-title').textContent = jackpot ? `JACKPOT! ${res.name}!` : `You won ${res.name}!`;
      this.$('claw-win-sub').textContent = (SHOP_TABS[res.tab][res.id].perk ? SHOP_TABS[res.tab][res.id].perk + '. ' : '') + `A claw machine only ${res.what}, now in your shop.`;
      box.className = 'claw-win ' + (jackpot ? 'jackpot' : 'cosmetic');
      if (jackpot) Sound.levelUp();
      Sound.hatch();
    }
    this.renderClaw();
    setTimeout(() => this.$('btn-claw-claim').focus({ preventScroll: true }), 30);
  },

  clawClaim() {
    this.clawPrize = null;
    this.$('claw-win').className = 'claw-win hidden';
    Sound.click();
    this.renderClaw();
    this.$('btn-claw-grab').focus({ preventScroll: true });
  },

  // ---- Goals: biome mastery, the Roadex and prestige -------------------------------
  renderGoals() {
    const tab = this.goalTab;
    for (const t of document.querySelectorAll('[data-gtab]')) t.setAttribute('aria-selected', t.dataset.gtab === tab ? 'true' : 'false');
    const body = this.$('goals-body');
    body.textContent = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const rewardName = r => r ? `${SHOP_TABS[r[0]][r[1]].name} (${{ skins: 'skin', hats: 'hat', trails: 'trail', pets: 'pet', auras: 'aura', prints: 'footprints', titles: 'title', sounds: 'hop sound' }[r[0]]})` : '';
    if (tab === 'biomes') {
      this.$('goals-progress').textContent = `★ ${Mastery.total()} / ${Mastery.max}`;
      body.appendChild(el('p', 'goals-note', 'Every biome has three stars. Earn all three to unlock its reward.'));
      const ul = el('ul', 'mastery-list');
      for (const z in ZONES) {
        const s = Mastery.stars(z), done = Mastery.done(z), seen = !!Stats.data.zones[z] || z === 'country';
        const li = el('li', done ? 'done' : '');
        li.style.setProperty('--zone', ZONES[z].bg);
        const head = el('div', 'm-head');
        head.append(el('b', '', seen ? zoneName(z) : '???'), el('span', 'm-stars', s.map(v => (v ? '★' : '☆')).join('')));
        const stars = el('ol', 'm-goals');
        MASTERY_STARS.forEach((txt, i) => stars.appendChild(el('li', s[i] ? 'got' : '', txt)));
        li.append(head, stars, el('em', '', `${done ? 'Unlocked' : 'Reward'}: ${rewardName(Mastery.reward(z))}`));
        ul.appendChild(li);
      }
      body.appendChild(ul);
    } else if (tab === 'roadex') {
      const T = Roadex.totals();
      this.$('goals-progress').textContent = `${T.have} / ${T.total}`;
      body.appendChild(el('p', 'goals-note', `Everything you see on the road goes in the book: +${ROADEX_COINS} coins for each new entry and +${ROADEX_PAGE_COINS} for each finished page.`));
      for (const page in ROADEX) {
        const n = Roadex.pageCount(page), done = n.have >= n.total;
        const sec = el('section', 'roadex-page' + (done ? ' done' : ''));
        const head = el('div', 'rx-head');
        head.append(el('b', '', ROADEX[page].name), el('span', 'rx-count', `${n.have}/${n.total}`));
        const grid = el('ul', 'rx-grid');
        for (const id in ROADEX[page].list) grid.appendChild(el('li', Roadex.has(page, id) ? 'seen' : '', Roadex.has(page, id) ? ROADEX[page].list[id] : '???'));
        sec.append(head, grid);
        const r = Roadex.reward(page);
        if (r) sec.appendChild(el('em', '', `${done ? 'Unlocked' : 'Reward'}: ${rewardName(r)}`));
        body.appendChild(sec);
      }
    } else {
      const L = Levels.info();
      this.$('goals-progress').textContent = Prestige.n ? `PRESTIGE ${Prestige.n}` : 'NO PRESTIGE YET';
      const card = el('div', 'prestige-card');
      card.append(el('div', 'p-stars', Prestige.n ? '★'.repeat(Prestige.n) : '☆'));
      card.append(el('p', '', `Reach level ${PRESTIGE_LEVEL}, then prestige: you go back to level 1 and keep everything you've unlocked. `
        + `Each prestige gives you a star and a permanent +5% coins and +5% XP (up to ${PRESTIGE_MAX} times).`));
      card.append(el('p', 'p-now', `Level ${L.level} · prestige ${Prestige.n}/${PRESTIGE_MAX} · bonus +${Math.round((Prestige.bonus() - 1) * 100)}% coins and XP`));
      const b = el('button', 'btn-yellow');
      const reset = () => { delete b.dataset.armed; b.textContent = Prestige.n >= PRESTIGE_MAX ? 'MAX PRESTIGE' : Prestige.can() ? `PRESTIGE TO ★${Prestige.n + 1}` : `Reach level ${PRESTIGE_LEVEL} to prestige`; };
      reset();
      b.disabled = !Prestige.can();
      b.addEventListener('click', () => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again: back to level 1'; Sound.bump(); return; }
        if (Prestige.go()) {
          Sound.levelUp();
          this.toast('t-golden', `PRESTIGE ${Prestige.n}!`, 'Back to level 1, with a permanent bonus', 3600);
          this.renderGoals();
          this.refreshMeta();
        }
      });
      card.appendChild(b);
      const ul = el('ul', 'p-rewards');
      for (const [lvl, t, id] of Prestige.rewards()) ul.appendChild(el('li', Prestige.n >= lvl ? 'got' : '', `★${lvl}: ${rewardName([t, id])}`));
      card.appendChild(ul);
      body.appendChild(card);
    }
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
    const hb = Game.bestFor('hardcore'), tb = Game.bestFor('time');
    this.$('best-hardcore').textContent = hb ? `Best ${hb}` : '';
    this.$('best-time').textContent = tb ? `Best ${tb}` : '';
    const w = Game.versusWins;
    this.$('vs-record').textContent = w[0] + w[1] ? `${w[0]} : ${w[1]}` : '';
    this.$('trophy-count').textContent = `${Trophies.count}/${TROPHIES.length}`;
    const L = Levels.info();
    const lv = this.$('title-level');
    lv.innerHTML = `<b>LV ${L.level}${Prestige.n ? ` ★${Prestige.n}` : ''}</b><span class="lvl-bar"><i style="width:${Math.round((L.into / L.need) * 100)}%"></i></span>`;
    this.$('goals-count').textContent = `★${Mastery.total()}`;
    lv.title = `${L.into} / ${L.need} XP to level ${L.level + 1}`;
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
    el.t1 = setTimeout(() => el.classList.add('out'), ms - 400);
    el.t2 = setTimeout(() => el.remove(), ms);
    return el;
  },

  eventToast(name, sub) { this.toast('t-event', name, sub, 3600); },
  weatherToast(type) { const [t, s] = WEATHER_SIGNS[type]; this.toast('t-weather', t, s); },
  missionDone(m, pay = m.reward) { this.toast('t-mission', `MISSION COMPLETE  +${pay}`, Missions.text(m)); },
  zoneToast(z) { this.toast('t-zone', `ENTERING ${ZONES[z].name}`, ZONES[z].sub, 3600); },
  trophyToast(t) {
    const un = Trophies.unlocks(t.id);
    this.toast('t-trophy', `TROPHY: ${t.name.toUpperCase()}`, un.length ? `${t.desc}. Unlocked: ${un.join(', ')}` : t.desc, 4000);
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
    const badge = this.$('mode-badge');
    badge.textContent = mode === 'hardcore' ? 'HARDCORE' : mode === 'time' ? 'TIME ATTACK' : '';
    badge.className = 'plate mode-badge' + (mode === 'hardcore' ? ' hardcore' : mode === 'time' ? ' time' : ' hidden');
    this.show('timer', mode === 'time');
    const title = !versus && Shop.title && TITLES[Shop.title];
    this.$('title-plate').textContent = title ? title.name : '';
    this.show('title-plate', !!title);
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
    this.toasts.classList.toggle('hidden', on); // nothing on top of the pause card
    if (on) this.show('powers', false);
    if (on) {
      this.renderMissions(this.$('pause-missions'), true);
      this.show('btn-pause-admin', Admin.unlocked);
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
    this.$('over-title').textContent = vs ? (vs.winner ? `Player ${vs.winner.id + 1} wins!` : 'Draw!') : info.cause === "Time's up" ? "Time's up" : info.golden ? 'Golden Run Over' : 'Game Over';
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
      this.$('over-coins').textContent = `${info.coins}${mult ? ` (x${mult})` : ''}${info.golden ? ' (golden x2)' : ''}${info.bonus ? ` +${info.bonus} bonus` : ''}, ${info.bank} total`;
    }
    const modeName = info.mode === 'normal' || vs ? '' : MODES[info.mode].name;
    this.$('over-mode-row').classList.toggle('hidden', !modeName);
    this.$('over-mode').textContent = modeName;
    this.$('over-new').classList.toggle('hidden', !info.newBest);
    this.$('report').classList.toggle('bloody', !!info.gore);
    this.$('btn-again').textContent = vs ? 'REMATCH' : 'PLAY AGAIN';
    const xp = info.xp, xb = this.$('over-xp');
    xb.classList.toggle('hidden', !xp);
    if (xp) {
      const a = xp.after;
      this.$('xp-level').textContent = `LEVEL ${a.level}`;
      this.$('xp-gain').textContent = `+${xp.amount} XP`;
      const fill = this.$('xp-fill');
      const from = xp.rewards.length ? 0 : xp.before.into / xp.before.need;
      fill.style.transition = 'none';
      fill.style.width = `${from * 100}%`;
      void fill.offsetWidth;
      fill.style.transition = '';
      setTimeout(() => { fill.style.width = `${(a.into / a.need) * 100}%`; }, 120);
      const ul = this.$('xp-rewards');
      ul.textContent = '';
      for (const r of xp.rewards) {
        const li = document.createElement('li');
        li.textContent = `LEVEL UP! Level ${r.level}: +${r.coins} coins` + (r.items.length ? `, unlocked: ${r.items.join(', ')}` : '');
        ul.appendChild(li);
      }
      if (!xp.rewards.length) {
        const nx = Levels.nextUnlock();
        if (nx) {
          const li = document.createElement('li');
          li.className = 'next';
          li.textContent = `Next unlock: ${nx.items.join(', ')} at level ${nx.level}`;
          ul.appendChild(li);
        }
      }
    }
    const tr = this.$('over-trophies');
    tr.textContent = '';
    for (const t of info.trophies) {
      const li = document.createElement('li');
      const un = Trophies.unlocks(t.id);
      li.textContent = un.length ? `${t.name}: ${un.join(', ')} unlocked` : t.name;
      tr.appendChild(li);
    }
    tr.classList.toggle('hidden', !info.trophies.length);
    // mystery boxes opened, and your pet levelling up
    const bx = this.$('over-boxes');
    bx.textContent = '';
    for (const r of info.boxes || []) {
      const li = document.createElement('li');
      if (r.dupe) li.textContent = `MYSTERY BOX: ${r.dupe} again, so +${r.shards} shards`;
      else if (r.coins) li.textContent = `MYSTERY BOX: ${r.coins} coins`;
      else { li.textContent = `MYSTERY BOX: ${r.name} (${r.kind})${r.rare ? ' · MYSTERY EXCLUSIVE!' : ''}`; if (r.rare) li.className = 'rare'; }
      bx.appendChild(li);
    }
    if (info.pet) {
      const li = document.createElement('li');
      li.className = 'pet';
      li.textContent = info.pet.max ? `${info.pet.name} reached level 5! Its perk got stronger: ${PET_MAX[info.pet.id] || ''}` : `${info.pet.name} reached level ${info.pet.level}`;
      bx.appendChild(li);
    }
    if ((info.boxes || []).length) {
      const li = document.createElement('li');
      li.className = 'pet';
      li.textContent = `Box shards: ${Shards.n} (craft any mystery exclusive for ${SHARD_COST} in the shop)`;
      bx.appendChild(li);
    }
    bx.classList.toggle('hidden', !bx.children.length);
    if ((info.boxes || []).length) Sound.hatch();
    // what you discovered this run: Roadex entries and biome stars
    const found = this.$('over-found');
    found.textContent = '';
    if (!vs) {
      const add = (txt, cls) => { const li = document.createElement('li'); li.textContent = txt; if (cls) li.className = cls; found.appendChild(li); };
      const names = Roadex.fresh.filter(e => e.name).map(e => e.name);
      if (names.length) add(`New in the Roadex (+${names.length * ROADEX_COINS} coins): ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''}`);
      for (const e of Roadex.fresh) if (e.page) add(e.text, 'big');
      for (const t of Mastery.fresh) add(t, 'star');
    }
    found.classList.toggle('hidden', !found.children.length);
    const close = this.$('over-close');
    close.textContent = '';
    for (const line of vs ? [] : SoClose.lines(info)) {
      const li = document.createElement('li');
      li.textContent = line;
      close.appendChild(li);
    }
    close.classList.toggle('hidden', !close.children.length);
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

    const comboOn = !versus && Player.combo > 1 && Game.time - Player.comboT < Upgrades.combo() && Game.state === 'playing';
    this.combo.classList.toggle('hidden', !comboOn);
    if (comboOn) this.combo.firstElementChild.textContent = 'x' + Player.combo;

    this.show('powers', !versus && Game.state === 'playing');
    for (const k in this.chips) {
      const ch = this.chips[k];
      const left = Powers.left(k);
      const on = k === 'shield' ? Player.shield > 0 : left > 0;
      if (k === 'shield' && Player.shield !== ch.count) {
        ch.count = Player.shield;
        const pips = ch.el.querySelector('.pw-pips');
        if (pips) pips.textContent = Player.shield > 1 ? `x${Player.shield} HITS` : '1 HIT';
      }
      if (on !== ch.on) { ch.el.classList.toggle('hidden', !on); ch.on = on; }
      if (on && ch.fill) {
        ch.fill.style.transform = `scaleX(${Math.min(1, left / POWERUPS[k].dur).toFixed(3)})`;
        ch.el.classList.toggle('ending', left < 1.5);
      }
    }

    const extra = {
      rage: Rage.able(Player) && !Rage.calmOne(Player) && Player.alive ? [Player.rage, Player.rage >= 1 ? 'Rage: MAX' : `Rage ${RAGE_LEVELS[Math.floor(Player.rage * 4)] || ''}`.trim()] : null,
      calm: Rage.able(Player) && Rage.calmOne(Player) && Player.alive ? [Player.rage, 'Calm'] : null,
      egg: Egg.carry && Player.alive ? [Egg.progress(), `Egg ${Math.min(EGG_ROWS, Egg.carry.rows)}/${EGG_ROWS}`] : null,
    };
    for (const k in this.extra) {
      const ch = this.extra[k], v = extra[k], on = !!v && !versus;
      if (on !== ch.on) { ch.el.classList.toggle('hidden', !on); ch.on = on; }
      if (!on) continue;
      ch.fill.style.transform = `scaleX(${clamp(v[0], 0, 1).toFixed(3)})`;
      if (v[1] !== ch.text) { ch.text = v[1]; ch.name.textContent = v[1]; }
      ch.el.classList.toggle('rage-full', k === 'rage' ? v[0] >= 1 : v[0] >= 0.8);
    }

    const stunned = !versus && !Settings.motion && Player.alive && Player.stun > 0.25 && Player.stun < 10;
    if (stunned !== this.stunned) { this.stunned = stunned; this.canvas.classList.toggle('stunned', stunned); }
    const mini = Events.miniAmt > 0.3;
    if (mini !== this.mini) { this.mini = mini; this.canvas.classList.toggle('mini', mini); }
  },
};
