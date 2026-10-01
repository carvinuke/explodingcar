'use strict';
// Auras (a glow that's always around you), the claw machine on the title
// screen, and the "so close" notes on the report.

// ---- Auras ---------------------------------------------------------------------------
// orbit: [glyph, colors, count, radius, speed, size]. glow: a soft light behind you.
const AURA_LOOK = {
  glow:     { glow: 'rgba(255,250,225,0.4)' },
  sparkle:  { orbit: ['star', ['#fff6b0', '#ffffff', '#ffe95c'], 6, 17, 1.6, 4], twinkle: true },
  bubbles:  { orbit: ['bubble', ['rgba(190,235,255,0.9)'], 6, 16, 1.1, 4.5], bob: 4 },
  hearts:   { orbit: ['heart', ['#ff5c8a', '#ff9fb8'], 4, 17, 1.4, 5.5], glow: 'rgba(255,120,170,0.22)' },
  leaves:   { orbit: ['leaf', ['#e8742a', '#d1401c', '#f2b705'], 5, 18, 2.2, 5], spin: true },
  petals:   { orbit: ['petal', ['#ffc4dc', '#ffb3d1', '#ffe0ec'], 7, 18, 1.2, 4.5], spin: true, bob: 5 },
  notes:    { orbit: ['note', ['#3a2a8f', '#c2185b', '#1d1d1f'], 3, 17, 1.3, 6], bob: 4 },
  frost:    { orbit: ['snowflake', ['#ffffff', '#dff3ff'], 5, 17, 1.0, 5], glow: 'rgba(170,225,255,0.3)', spin: true },
  fire:     { special: 'fire', glow: 'rgba(255,140,40,0.28)' },
  toxic:    { special: 'rise', colors: ['#8dff8a', '#5ad14a', '#c4ff6b'], glow: 'rgba(120,255,90,0.25)' },
  coins:    { orbit: ['coin', ['#ffd23f'], 5, 18, 2.0, 5.5] },
  feathers: { orbit: ['feather', ['#ffffff', '#f2f2ee'], 6, 18, 2.6, 6], spin: true },
  bats:     { orbit: ['bat', ['#3d2a52', '#2b1d3a'], 4, 19, 2.4, 7], bob: 6, glow: 'rgba(90,40,140,0.2)' },
  ghosts:   { orbit: ['ghost', ['rgba(245,245,255,0.85)'], 3, 18, 1.0, 7], bob: 5 },
  electric: { special: 'electric', glow: 'rgba(140,200,255,0.25)' },
  shadow:   { special: 'rise', colors: ['rgba(30,20,45,0.55)', 'rgba(60,40,80,0.5)'], smoke: true, glow: 'rgba(20,10,30,0.3)' },
  rainbow:  { special: 'rainbow' },
  pixels:   { special: 'pixels' },
  diamonds: { orbit: ['diamond', ['#b9f2ff', '#7fd6ef', '#ffffff'], 5, 18, 1.5, 5], glow: 'rgba(150,230,255,0.28)', twinkle: true },
  moon:     { special: 'moon', glow: 'rgba(200,210,255,0.22)' },
  sun:      { special: 'sun', glow: 'rgba(255,210,80,0.35)' },
  halo:     { special: 'halo', glow: 'rgba(255,215,90,0.25)' },
  aurora:   { special: 'aurora' },
  galaxy:   { orbit: ['star', ['#c79bff', '#7fb2ff', '#ffffff'], 7, 19, 0.9, 3.5], orbit2: ['star', ['#ff9ff0', '#ffffff'], 4, 12, -1.6, 3], glow: 'rgba(130,80,255,0.35)', twinkle: true },
  void:     { special: 'void' },
  storm:    { special: 'electric', cloud: true, glow: 'rgba(120,140,170,0.3)' },
  royal:    { orbit: ['diamond', ['#ffd23f', '#ffe98a', '#e63946'], 4, 18, 1.0, 5], glow: 'rgba(255,215,80,0.38)', special: 'halo' },
  prestige: { orbit: ['star', ['#ffd23f', '#ffffff'], 5, 19, 1.2, 4.5], orbit2: ['star', ['#c79bff', '#ffffff'], 5, 13, -1.8, 3.5], glow: 'rgba(255,230,150,0.35)', twinkle: true },
  arcade:   { special: 'arcade', glow: 'rgba(255,80,230,0.2)' },
  jackpot:  { orbit: ['coin', ['#ffd23f', '#ffe98a'], 7, 19, 2.8, 5], glow: 'rgba(255,205,60,0.45)', special: 'rise', colors: ['#ffe95c', '#fff6b0'], sparkles: true },
};

const Auras = {
  // Behind you (front = false), then in front (front = true). z: your height.
  draw(c, id, time, z = 0, front = false) {
    const L = AURA_LOOK[id];
    if (!L) return;
    const cz = z + 12;
    if (!front && L.glow) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const R = 34 + Math.sin(time * 2.5) * 2; // a slow pulse
      const g = c.createRadialGradient(0, P(0, cz), 0, 0, P(0, cz), R);
      g.addColorStop(0, L.glow);
      g.addColorStop(0.55, L.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(-R, P(0, cz) - R, R * 2, R * 2);
      c.restore();
    }
    if (L.orbit) this.orbit(c, L, L.orbit, time, cz, front);
    if (L.orbit2) this.orbit(c, L, L.orbit2, time, cz, front);
    if (L.special) this.special(c, L, time, z, cz, front);
  },

  orbit(c, L, [kind, cols, n, r, speed, size], time, cz, front) {
    for (let k = 0; k < n; k++) {
      const a = time * speed + (k / n) * 6.2832;
      if ((Math.sin(a) < 0) !== front) continue; // the near half goes in front of you
      const bob = L.bob ? Math.sin(time * 2 + k * 1.7) * L.bob : 0;
      const x = Math.cos(a) * r, y = P(Math.sin(a) * r * 0.6, cz + bob);
      const s = L.twinkle ? size * (0.7 + 0.3 * Math.sin(time * 6 + k * 2.3)) : size;
      if (kind === 'bubble') {
        c.strokeStyle = cols[0];
        c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, s / 2 + (k % 2), 0, 6.2832); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.fillRect(x - s / 4, y - s / 4, 1.2, 1.2);
      } else FX.glyph(c, kind, x, y, s, cols[k % cols.length], L.spin ? a * 2 : 0);
    }
  },

  special(c, L, time, z, cz, front) {
    switch (L.special) {
      case 'fire': { // a ring of flames around your feet
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * 6.2832 + time * 0.6;
          if ((Math.sin(a) < 0) !== front) continue;
          const x = Math.cos(a) * 15, y = P(Math.sin(a) * 9, z), fl = 5 + Math.sin(time * 13 + k * 2.1) * 2.5;
          c.fillStyle = 'rgba(255,120,30,0.7)';
          c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x, y - fl * 2.4, x + 3, y); c.fill();
          c.fillStyle = 'rgba(255,230,120,0.85)';
          c.beginPath(); c.moveTo(x - 1.5, y); c.quadraticCurveTo(x, y - fl * 1.2, x + 1.5, y); c.fill();
        }
        c.restore();
        return;
      }
      case 'rise': { // bubbles, smoke or sparkles drifting up
        if (front) return;
        for (let k = 0; k < 7; k++) {
          const ph = (time * 0.6 + k * 0.143) % 1, x = Math.sin(k * 2.4 + time) * (8 + k % 3 * 4);
          const y = P((k % 3 - 1) * 4, z + ph * 34);
          c.globalAlpha = Math.sin(ph * Math.PI);
          c.fillStyle = L.colors[k % L.colors.length];
          if (L.smoke) { c.beginPath(); c.arc(x, y, 3 + ph * 5, 0, 6.2832); c.fill(); }
          else if (L.sparkles) FX.glyph(c, 'star', x, y, 3.5, L.colors[k % 2], 0);
          else { c.beginPath(); c.arc(x, y, 1.6 + (k % 2), 0, 6.2832); c.fill(); }
        }
        c.globalAlpha = 1;
        return;
      }
      case 'electric': { // little arcs crackling around you
        if (L.cloud && !front) {
          c.fillStyle = 'rgba(110,120,140,0.75)';
          for (const [x, r] of [[-7, 5], [0, 6.5], [7, 5]]) { c.beginPath(); c.arc(x + Math.sin(time) * 2, P(0, z + 42), r, 0, 6.2832); c.fill(); }
        }
        if (!front || ((time * 9) | 0) % 3 === 0) return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(190,230,255,0.9)';
        c.lineWidth = 1.2;
        const seed = (time * 9) | 0;
        for (let k = 0; k < 2; k++) {
          const a = seed * 1.7 + k * 3.1;
          let x = Math.cos(a) * 16, y = P(Math.sin(a) * 9, cz + Math.sin(a * 3) * 8);
          c.beginPath(); c.moveTo(x, y);
          for (let s = 0; s < 4; s++) { x += Math.sin(seed + s * 2.3 + k) * 5; y += 4; c.lineTo(x, y); }
          c.stroke();
        }
        c.restore();
        return;
      }
      case 'rainbow': { // a spinning rainbow ring on the ground
        if (front) return;
        c.save();
        c.lineWidth = 3;
        for (let k = 0; k < 12; k++) {
          const a0 = (k / 12) * 6.2832 + time;
          c.strokeStyle = `hsla(${(k * 30 + time * 90) % 360},95%,62%,0.8)`;
          c.beginPath(); c.ellipse(0, P(0, z + 1), 17, 17 * GY, 0, a0, a0 + 0.5); c.stroke();
        }
        c.restore();
        return;
      }
      case 'pixels': { // glitchy pixels flickering in and out
        if (!front) return;
        const seed = (time * 8) | 0;
        for (let k = 0; k < 9; k++) {
          const h = Math.sin(seed * 12.9 + k * 78.2) * 43758.5, f = h - Math.floor(h);
          const x = (f - 0.5) * 38, y = P(((k * 7) % 11 - 5) * 1.6, z + (f * 37 % 1) * 30);
          c.fillStyle = ['#ff2bd6', '#2bf4ff', '#7ed957', '#ffd23f'][k % 4];
          c.fillRect(x, y, 2.5, 2.5);
        }
        return;
      }
      case 'moon': { // a little crescent moon circling you, with stars
        const a = time * 0.9, x = Math.cos(a) * 19, y = P(Math.sin(a) * 11, cz + 6);
        if ((Math.sin(a) < 0) === front) {
          c.fillStyle = '#f4f1d0';
          c.beginPath(); c.arc(x, y, 4.5, 0, 6.2832); c.fill();
          c.fillStyle = '#5a6488';
          c.beginPath(); c.arc(x + 2, y - 1, 3.8, 0, 6.2832); c.fill();
        }
        if (front) for (let k = 0; k < 4; k++) if (Math.sin(time * 3 + k * 2) > 0.3) FX.glyph(c, 'star', Math.cos(k * 1.6) * 14, P(0, cz + 14 + k * 3), 3, '#fff6b0', 0);
        return;
      }
      case 'sun': { // rays turning slowly behind you
        if (front) return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.translate(0, P(0, cz));
        c.rotate(time * 0.5);
        c.fillStyle = 'rgba(255,200,60,0.35)';
        for (let k = 0; k < 10; k++) {
          c.rotate(0.6283);
          c.beginPath(); c.moveTo(-2.5, 12); c.lineTo(0, 26 + Math.sin(time * 4 + k) * 3); c.lineTo(2.5, 12); c.fill();
        }
        c.restore();
        return;
      }
      case 'halo': { // a golden ring floating over your head
        const y = P(0, z + 36 + Math.sin(time * 2) * 1.5);
        c.strokeStyle = '#ffd23f';
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(0, y, 9, 3, 0, front ? 0 : Math.PI, front ? Math.PI : 6.2832); c.stroke();
        return;
      }
      case 'aurora': { // shimmering curtains of colour
        if (front) return;
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          c.fillStyle = `hsla(${(140 + k * 50 + time * 30) % 360},90%,60%,0.18)`;
          c.beginPath();
          for (let x = -22; x <= 22; x += 4) c.lineTo(x, P(4, z + 38 + Math.sin(time * 2 + x * 0.2 + k) * 5));
          for (let x = 22; x >= -22; x -= 4) c.lineTo(x, P(4, z + 4 + k * 3));
          c.fill();
        }
        c.restore();
        return;
      }
      case 'void': { // a dark spiral under you
        if (front) return;
        c.save();
        const g = c.createRadialGradient(0, P(0, z), 0, 0, P(0, z), 22);
        g.addColorStop(0, 'rgba(10,0,25,0.75)');
        g.addColorStop(1, 'rgba(70,20,140,0)');
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, P(0, z), 22, 22 * GY, 0, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(170,110,255,0.6)';
        c.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) { const a = -time * 3 + k * 2.1; c.beginPath(); c.ellipse(0, P(0, z + 1), 8 + k * 5, (8 + k * 5) * GY, 0, a, a + 1.8); c.stroke(); }
        c.restore();
        return;
      }
      case 'arcade': { // a ring of chasing marquee bulbs
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * 6.2832;
          if ((Math.sin(a) < 0) !== front) continue;
          const on = (k + ((time * 10) | 0)) % 3 === 0;
          c.fillStyle = on ? ['#ff4fe0', '#4df0ff', '#ffe95c'][k % 3] : 'rgba(80,60,110,0.8)';
          c.beginPath(); c.arc(Math.cos(a) * 17, P(Math.sin(a) * 10, z + 1), on ? 2 : 1.4, 0, 6.2832); c.fill();
        }
      }
    }
  },
};

// ---- The claw machine -------------------------------------------------------------------
// A grab costs coins. Most grabs win coins back; some win a claw-only cosmetic,
// and a very lucky few win a claw-only Jackpot pet.
const CLAW_TIERS = {
  normal: { name: 'Grab', price: 500, pet: 0.005, cosmetic: 0.10, coins: 100 },
  gold:   { name: 'Gold Grab', price: 1000, pet: 0.01, cosmetic: 0.20, coins: 200 },
};

const Claw = {
  prizes(petsOnly) {
    const out = [];
    for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) {
      const it = SHOP_TABS[tab][id];
      if (it.claw && (tab === 'pets') === !!petsOnly) out.push([tab, id]);
    }
    return out;
  },
  unowned(petsOnly) { return this.prizes(petsOnly).filter(([t, id]) => !Shop.has(t, id)); },

  // Pay and roll. Returns what you won (or null if you can't afford it).
  grab(tier) {
    const T = CLAW_TIERS[tier];
    if (!T || Game.bank < T.price) return null;
    Game.bank -= T.price;
    const r = Math.random();
    let res;
    const pets = this.unowned(true), cos = this.unowned(false);
    if (r < T.pet && pets.length) res = this.win(pick(pets), 'pet');
    else if (r < T.pet + T.cosmetic && (cos.length || pets.length)) res = this.win(pick(cos.length ? cos : pets), cos.length ? 'cosmetic' : 'pet');
    else {
      Game.bank += T.coins;
      res = { kind: 'coins', coins: T.coins };
    }
    Store.set('coins', Game.bank);
    Stats.add('clawGrabs');
    if (res.kind !== 'coins') Stats.add('clawWins');
    if (res.kind === 'pet') Stats.add('clawJackpots');
    Stats.save();
    Trophies.check();
    return res;
  },

  win([tab, id], kind) {
    Shop.grant(tab, id);
    const what = { skins: 'skin', hats: 'hat', trails: 'trail', pets: 'pet', auras: 'aura', prints: 'footprints', titles: 'title' }[tab];
    return { kind, tab, id, name: SHOP_TABS[tab][id].name, what };
  },
};

// ---- "So close" notes for the report ------------------------------------------------------
const SoClose = {
  lines(info) {
    const out = [];
    if (!info.newBest && info.best > 0 && info.score >= info.best * 0.75) out.push(`Just ${info.best - info.score} points from your best!`);
    const xp = info.xp;
    if (xp && !xp.rewards.length) {
      const left = xp.after.need - xp.after.into;
      if (left <= xp.after.need * 0.3) out.push(`${left} XP to level ${xp.after.level + 1}`);
    }
    let cheap = null;
    for (const id in UPGRADES) {
      if (Upgrades.level(id) >= Upgrades.max(id)) continue;
      const pr = Upgrades.price(id);
      if (!cheap || pr < cheap[1]) cheap = [id, pr];
    }
    if (cheap && cheap[1] > Game.bank && cheap[1] - Game.bank <= 300) out.push(`${cheap[1] - Game.bank} coins from your next upgrade (${UPGRADES[cheap[0]].name})`);
    const claw = CLAW_TIERS.normal.price;
    if (Game.bank < claw && claw - Game.bank <= 200) out.push(`${claw - Game.bank} coins from a claw machine grab`);
    for (const m of Missions.active) {
      const pr = Missions.progress(m);
      if (!m.fresh && pr < m.target && pr >= m.target * 0.6) { out.push(`Almost there: ${Missions.text(m)} (${pr}/${m.target})`); break; }
    }
    return out.slice(0, 3);
  },
};
