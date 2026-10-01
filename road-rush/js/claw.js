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

// ---- The claw machine's insides: real 2D physics -----------------------------------------
// Capsules fall, roll and pile up; the claw pushes into the pile, closes on a
// real capsule, carries it to the chute and lets go.
const CLAW_BOX = { W: 360, H: 270, L: 8, R: 352, FLOOR: 252, DIV: 74, DIV_TOP: 168, CHUTE_X: 40 };
const CAPSULE_COLS = ['#ff5c8a', '#34c6ea', '#ffd23f', '#7ed957', '#a95cff', '#ff9f1c', '#ff6cf2', '#4df0b0'];

const ClawSim = {
  balls: [],
  claw: null,

  init() {
    const B = CLAW_BOX;
    this.balls = [];
    for (let k = 0; k < 30; k++) this.add(rand(B.DIV + 20, B.R - 16), rand(-300, 120));
    this.claw = { x: 200, y: 34, open: 1, state: 'idle', t: 0, held: null, tx: 200, onDone: null };
    for (let i = 0; i < 360; i++) this.step(1 / 120); // let the pile settle before you see it
  },

  add(x, y) {
    const r = rand(11, 13.5);
    this.balls.push({ x, y, vx: rand(-20, 20), vy: 0, r, m: r * r, a: rand(6.28), va: 0, col: pick(CAPSULE_COLS), held: false, prize: null, gone: false });
  },

  // Start a grab. kind: 'pet' | 'cosmetic' | 'coins'. onDone runs when the prize lands in the chute.
  grab(kind, onDone) {
    const B = CLAW_BOX;
    // aim at one of the capsules near the top of the pile
    const cands = this.balls.filter(b => !b.gone && b.x > B.DIV + 22 && b.x < B.R - 18).sort((a, b) => a.y - b.y).slice(0, 8);
    const target = cands.length ? pick(cands) : null;
    Object.assign(this.claw, { state: 'move', t: 0, tx: target ? target.x : rand(B.DIV + 40, B.R - 40), kind, onDone, target, held: null });
  },

  busy() { return this.claw && this.claw.state !== 'idle'; },

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    this.moveClaw(dt);
    const n = 3;
    for (let i = 0; i < n; i++) this.step(dt / n);
  },

  moveClaw(dt) {
    const C = this.claw, B = CLAW_BOX;
    C.t += dt;
    const toward = (v, to, sp) => (Math.abs(to - v) <= sp * dt ? to : v + Math.sign(to - v) * sp * dt);
    switch (C.state) {
      case 'idle':
        C.x = 215 + Math.sin(performance.now() / 1300) * 40;
        C.y = toward(C.y, 34, 120);
        C.open = toward(C.open, 1, 3);
        break;
      case 'move':
        C.x = toward(C.x, C.tx, 170);
        if (C.x === C.tx) { C.state = 'down'; C.t = 0; }
        break;
      case 'down': { // stop when the prongs reach the pile (or the floor)
        C.y += 130 * dt;
        let hit = C.y + 34 >= B.FLOOR - 6;
        for (const b of this.balls) if (!b.gone && Math.abs(b.x - C.x) < 10 && C.y + 30 > b.y - b.r * 0.2) hit = true;
        if (hit || C.t > 2.5) { C.state = 'close'; C.t = 0; }
        break;
      }
      case 'close':
        C.open = toward(C.open, 0, 3.5);
        if (C.t > 0.35) {
          // grab the capsule closest to the jaws
          let best = null, bd = 1e9;
          for (const b of this.balls) {
            if (b.gone) continue;
            const d = Math.hypot(b.x - C.x, b.y - (C.y + 26));
            if (d < bd) { bd = d; best = b; }
          }
          if (best) {
            best.held = true;
            best.prize = C.kind;
            if (C.kind === 'coins') best.col = '#ffd23f';
            C.held = best;
          }
          C.state = 'up'; C.t = 0;
        }
        break;
      case 'up':
        C.y = toward(C.y, 34, 110);
        if (C.y === 34) { C.state = 'carry'; C.t = 0; }
        break;
      case 'carry':
        C.x = toward(C.x, B.CHUTE_X, 150);
        if (C.x === B.CHUTE_X) { C.state = 'drop'; C.t = 0; }
        break;
      case 'drop':
        C.open = toward(C.open, 1, 4);
        if (C.t > 0.15 && C.held) { C.drop = C.held; C.held.held = false; C.held.vx = 0; C.held.vy = 40; C.held = null; }
        if (C.t > 4) { if (C.drop) C.drop.gone = true; this.finish(); } // (just in case it got stuck)
        break;
    }
    if (C.held) { // the capsule hangs in the jaws
      const b = C.held;
      b.x = C.x; b.y = C.y + 28 + b.r * 0.4; b.vx = b.vy = 0; b.va *= 0.9;
    }
  },

  finish() {
    const C = this.claw;
    C.state = 'idle';
    const cb = C.onDone;
    C.onDone = null;
    if (cb) cb();
  },

  step(dt) {
    const B = CLAW_BOX, C = this.claw, G = 950;
    const live = this.balls.filter(b => !b.gone);
    for (const b of live) {
      if (b.held) continue;
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
    }
    for (let it = 0; it < 3; it++) {
      // capsule against capsule
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = rr - d;
        const ia = a.held ? 0 : 1 / a.m, ib = b.held ? 0 : 1 / b.m, sum = ia + ib;
        if (!sum) continue;
        a.x -= nx * over * (ia / sum); a.y -= ny * over * (ia / sum);
        b.x += nx * over * (ib / sum); b.y += ny * over * (ib / sum);
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const j = (-(1 + 0.15) * rv) / sum;
          a.vx -= j * ia * nx; a.vy -= j * ia * ny;
          b.vx += j * ib * nx; b.vy += j * ib * ny;
          // a bit of friction along the contact, which also sets them spinning
          const tx = -ny, ty = nx, rt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
          const jt = clamp(-rt / sum * 0.3, -Math.abs(j) * 0.4, Math.abs(j) * 0.4);
          a.vx -= jt * ia * tx; a.vy -= jt * ia * ty;
          b.vx += jt * ib * tx; b.vy += jt * ib * ty;
        }
      }
      for (const b of live) {
        if (b.held) continue;
        // the walls and the floor
        if (b.x - b.r < B.L) { b.x = B.L + b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x + b.r > B.R) { b.x = B.R - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        if (b.y + b.r > B.FLOOR) {
          b.y = B.FLOOR - b.r;
          if (b.vy > 0) b.vy = -b.vy * 0.2;
          b.vx *= 0.96;
          b.va = b.vx / b.r; // rolling
        }
        // the chute's divider wall (a box from DIV-4 to DIV+4, DIV_TOP down)
        const cx = clamp(b.x, B.DIV - 4, B.DIV + 4), cy = clamp(b.y, B.DIV_TOP, B.FLOOR);
        const ddx = b.x - cx, ddy = b.y - cy, dd = Math.hypot(ddx, ddy);
        if (dd < b.r && dd > 0) {
          const nx = ddx / dd, ny = ddy / dd;
          b.x += nx * (b.r - dd); b.y += ny * (b.r - dd);
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 1.3 * vn * nx; b.vy -= 1.3 * vn * ny; }
        }
        // the claw's jaws push capsules aside on the way down
        if (C && (C.state === 'down' || C.state === 'close') && !b.prize) {
          for (const s of [-1, 1]) {
            const px = C.x + s * (6 + C.open * 9), py = C.y + 24;
            const ex = b.x - px, ey = b.y - py, ed = Math.hypot(ex, ey), rr = b.r + 4;
            if (ed < rr && ed > 0 && b !== C.held) { b.x += (ex / ed) * (rr - ed); b.y += (ey / ed) * (rr - ed); b.vx += (ex / ed) * 30; }
          }
        }
      }
    }
    for (const b of live) {
      b.vx *= 0.999;
      b.va *= 0.985;
      // dropped down the chute: it's yours
      if (b.prize && !b.held && b.x < B.DIV && b.y > B.FLOOR - b.r - 4) {
        b.gone = true;
        if (C.state === 'drop') this.finish();
      }
    }
    if (this.balls.length > 40) this.balls = this.balls.filter(b => !b.gone);
  },

  // A refill capsule drops in from the top after a win.
  refill() { this.add(rand(CLAW_BOX.DIV + 40, CLAW_BOX.R - 30), -20); },

  draw(c, now) {
    const B = CLAW_BOX, W = B.W, H = B.H, C = this.claw;
    // back wall
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3a1f6e');
    bg.addColorStop(1, '#1a0d33');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 14; x < W; x += 22) for (let y = 30; y < H; y += 22) { c.beginPath(); c.arc(x + ((y / 22) % 2) * 11, y, 1.5, 0, 6.2832); c.fill(); }
    // spotlight on the pile
    const sp = c.createRadialGradient(215, 210, 10, 215, 210, 170);
    sp.addColorStop(0, 'rgba(255,200,255,0.16)');
    sp.addColorStop(1, 'rgba(255,200,255,0)');
    c.fillStyle = sp;
    c.fillRect(0, 0, W, H);
    // floor
    c.fillStyle = '#120a22';
    c.fillRect(B.DIV, B.FLOOR, W - B.DIV, H - B.FLOOR);
    c.fillStyle = '#ff4fe0';
    c.fillRect(B.DIV, B.FLOOR, W - B.DIV, 1.5);
    // the chute: a dark hole with a glowing rim and a PRIZE sign
    const cg = c.createLinearGradient(0, B.DIV_TOP, 0, H);
    cg.addColorStop(0, '#0b0616');
    cg.addColorStop(1, '#000');
    c.fillStyle = cg;
    c.fillRect(B.L, B.DIV_TOP, B.DIV - B.L - 4, H - B.DIV_TOP);
    c.fillStyle = '#ff4fe0';
    c.fillRect(B.L, B.DIV_TOP - 3, B.DIV - B.L + 4, 3);
    c.save();
    c.font = `900 11px ${UI_FONT}`;
    c.textAlign = 'center';
    c.shadowColor = '#4df0ff';
    c.shadowBlur = 8;
    c.fillStyle = ((now * 2) | 0) % 2 ? '#4df0ff' : '#bff8ff';
    c.fillText('PRIZE', (B.L + B.DIV) / 2, B.DIV_TOP + 22);
    c.fillText('▼', (B.L + B.DIV) / 2, B.DIV_TOP + 36);
    c.restore();
    // the divider
    const dg = c.createLinearGradient(B.DIV - 4, 0, B.DIV + 4, 0);
    dg.addColorStop(0, '#8d97a6'); dg.addColorStop(0.5, '#e8ecf2'); dg.addColorStop(1, '#6d737c');
    c.fillStyle = dg;
    c.fillRect(B.DIV - 4, B.DIV_TOP, 8, B.FLOOR - B.DIV_TOP);
    // shadows under the capsules on the floor
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (const b of this.balls) if (!b.gone && b.y > B.FLOOR - b.r - 3 && b.x > B.DIV) { c.beginPath(); c.ellipse(b.x, B.FLOOR + 1, b.r * 0.9, 2.5, 0, 0, 6.2832); c.fill(); }
    // capsules
    for (const b of this.balls) if (!b.gone && b !== (C && C.held)) this.capsule(c, b, now);
    // rail, carriage, cable
    c.fillStyle = '#5a5f69';
    c.fillRect(0, 16, W, 5);
    c.fillStyle = '#c9d1dc';
    c.fillRect(0, 15, W, 1.5);
    const mg = c.createLinearGradient(C.x - 11, 0, C.x + 11, 0);
    mg.addColorStop(0, '#8d97a6'); mg.addColorStop(0.5, '#f4f6fa'); mg.addColorStop(1, '#8d97a6');
    c.fillStyle = mg;
    c.fillRect(C.x - 11, 11, 22, 12);
    c.fillStyle = '#4df0ff';
    c.fillRect(C.x - 2, 15, 4, 3);
    c.strokeStyle = '#d9dee6';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(C.x - 1, 23); c.lineTo(C.x - 1, C.y); c.moveTo(C.x + 1, 23); c.lineTo(C.x + 1, C.y); c.stroke();
    if (C.held) this.capsule(c, C.held, now);
    this.drawClaw(c, C);
    // glass: reflections and a frame
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.beginPath(); c.moveTo(250, 0); c.lineTo(282, 0); c.lineTo(212, H); c.lineTo(180, H); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.04)';
    c.beginPath(); c.moveTo(296, 0); c.lineTo(306, 0); c.lineTo(236, H); c.lineTo(226, H); c.fill();
    // marquee bulbs
    for (let k = 0; k < 18; k++) {
      const on = (k + ((now * 8) | 0)) % 3 === 0, col = ['#ff4fe0', '#4df0ff', '#ffe95c'][k % 3];
      if (on) { c.save(); c.shadowColor = col; c.shadowBlur = 8; }
      c.fillStyle = on ? col : '#4a3a6a';
      c.beginPath(); c.arc(10 + k * 20, 6, 3, 0, 6.2832); c.fill();
      if (on) c.restore();
    }
  },

  // A two-tone prize capsule: clear top, coloured bottom, rolling as it moves.
  capsule(c, b, now) {
    c.save();
    c.translate(b.x, b.y);
    if (b.prize === 'pet' || b.prize === 'cosmetic') { // the winner glows
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, b.r * 0.5, 0, 0, b.r * 2.2);
      g.addColorStop(0, b.prize === 'pet' ? `hsla(${(now * 220) % 360},100%,65%,0.7)` : 'rgba(200,140,255,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, b.r * 2.2, 0, 6.2832); c.fill();
      c.restore();
    }
    c.rotate(b.a);
    const col = b.prize === 'pet' ? `hsl(${(now * 220) % 360},90%,58%)` : b.prize === 'cosmetic' ? '#a95cff' : b.col;
    // bottom half
    c.fillStyle = col;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI); c.fill();
    // top half: clear plastic with something inside
    c.fillStyle = 'rgba(235,245,255,0.55)';
    c.beginPath(); c.arc(0, 0, b.r, Math.PI, 0); c.fill();
    c.fillStyle = shade(col, -0.15);
    c.beginPath(); c.arc(0, -b.r * 0.15, b.r * 0.38, Math.PI, 0); c.fill(); // the toy peeking out
    // the seam
    c.fillStyle = shade(col, -0.3);
    c.fillRect(-b.r, -1, b.r * 2, 2);
    // outline
    c.strokeStyle = 'rgba(20,10,40,0.55)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, b.r, 0, 6.2832); c.stroke();
    if (b.prize === 'coins') { c.fillStyle = '#fff4b8'; c.font = `900 ${b.r}px ${UI_FONT}`; c.textAlign = 'center'; c.fillText('$', 0, b.r * 0.8); }
    c.restore();
    // a shine that doesn't roll
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(b.x - b.r * 0.4, b.y - b.r * 0.45, b.r * 0.28, b.r * 0.18, -0.6, 0, 6.2832); c.fill();
  },

  drawClaw(c, C) {
    const x = C.x, y = C.y, sp = 5 + C.open * 10;
    // hub
    const hg = c.createLinearGradient(x - 10, 0, x + 10, 0);
    hg.addColorStop(0, '#8d97a6'); hg.addColorStop(0.5, '#f4f6fa'); hg.addColorStop(1, '#7a828f');
    c.fillStyle = hg;
    c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + 10, y); c.lineTo(x + 7, y + 10); c.lineTo(x - 7, y + 10); c.closePath(); c.fill();
    c.fillStyle = '#ff4fe0';
    c.fillRect(x - 7, y + 3, 14, 2);
    // three prongs: two sides and one at the back
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [s, back] of [[0, true], [-1, false], [1, false]]) {
      c.strokeStyle = back ? '#8d97a6' : '#e8ecf2';
      c.lineWidth = back ? 2.5 : 3.2;
      c.beginPath();
      if (back) { c.moveTo(x, y + 9); c.lineTo(x, y + 22); c.lineTo(x + 2, y + 30); }
      else { c.moveTo(x + s * 6, y + 9); c.lineTo(x + s * sp, y + 20); c.lineTo(x + s * (sp - 5 - C.open * 2), y + 32); }
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x - 3, y + 2, 1.5, 0, 6.2832); c.fill();
  },
};
