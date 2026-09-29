'use strict';
// Big J's rage stomp and the mystery egg.
//
// Rage: only Big J has it. Every close call (and every blast or crash that
// rattles him) makes him angrier. At maximum rage he leaps up and slams the
// ground, and every car around him is thrown clear.
//
// Egg: now and then an egg sits on the road. Carry it 50 rows without dying
// and it hatches into a rare pet you can't buy anywhere.

const RAGE_LEVELS = ['', 'ANNOYED', 'ANGRY', 'FURIOUS'];

const Rage = {
  RADIUS: 3.8 * TILE,
  rings: [],   // shockwaves on the ground
  cracks: [],  // cracked ground where he landed

  reset() {
    this.rings.length = 0;
    this.cracks.length = 0;
  },

  // Only Big J (player one) can rage.
  able(p) { return p.id === 0 && !!p.skin().rage; },

  add(p, amt) {
    if (!this.able(p) || !p.alive || p.stomp || Game.state !== 'playing') return;
    const before = p.rage;
    p.rage = Math.min(1, p.rage + amt);
    const lv = Math.floor(p.rage * 4), was = Math.floor(before * 4);
    Sound.growl(p.rage);
    if (p.rage >= 1 && before < 1) {
      FX.text(p.x, p.y + 50, 'MAXIMUM RAGE!', '#ff3b2f', 22);
      Cam.addTrauma(0.25);
    } else if (lv > was && RAGE_LEVELS[lv]) {
      FX.text(p.x, p.y + 50, RAGE_LEVELS[lv] + '!', lv === 3 ? '#ff3b2f' : '#ff8a5c', 13 + lv * 2);
    }
  },

  update(dt) {
    for (const r of this.rings) r.t += dt;
    while (this.rings.length && this.rings[0].t > 0.9) this.rings.shift();
    for (const k of this.cracks) k.t += dt;
    while (this.cracks.length && this.cracks[0].t > 6) this.cracks.shift();
    for (const p of Game.players) {
      if (!p.alive || !p.rage) continue;
      // boiling over: steam from the side tabs
      if (p.rage > 0.7 && Math.random() < dt * 22 * p.rage) {
        const side = chance(0.5) ? -1 : 1;
        FX.spawn('smoke', p.x + side * 13, p.y, p.z + 42, { vx: side * rand(20, 50), vz: rand(50, 90), g: -30, drag: 1.2, life: rand(0.5, 0.9), size: 3, size2: rand(8, 12), color: '#f2f2f2', alpha: 0.65 });
      }
      // maxed out: stomp the moment his feet are on solid ground
      if (p.rage >= 1 && !p.stomp && Game.state === 'playing') {
        const row = p.rowObj();
        if (!p.hop && !p.knock && !p.abduct && !p.ride && row && row.type !== 'river') p.startStomp();
      }
    }
  },

  // The slam: throw every nearby car clear and knock the ground flat.
  slam(p) {
    let n = 0;
    for (const row of World.rows.values()) {
      if (Math.abs(row.y - p.y) > this.RADIUS + TILE) continue;
      if (row.type === 'road') {
        for (const v of row.lane.vehicles) {
          if (v.wreck || v.abducted) continue;
          const dx = Math.max(0, Math.abs(v.x - p.x) - v.len / 2);
          if (Math.hypot(dx, row.y - p.y) > this.RADIUS) continue;
          if (v.animal) { Vehicles.hitAnimal(row, v, p.x, 1.4); continue; }
          Vehicles.toss(v, p.x, 1.7);
          v.vz *= 1.25;
          FX.sparks(v.x, v.y, 8, 14, ['#ffffff', '#ffd166', '#ff8a5c'], 360);
          n++;
        }
      } else if (row.type === 'rail' && row.rail.stalled && Math.abs(row.rail.stalled.x - p.x) < this.RADIUS) {
        const v = row.rail.stalled; // even a car stuck on the tracks gets flung off them
        row.rail.stalled = null;
        v.vy = 0;
        row.rail.wrecks.push(v);
        Vehicles.toss(v, p.x, 1.7);
        n++;
      }
    }
    this.rings.push({ x: p.x, y: p.y, t: 0 });
    this.rings.push({ x: p.x, y: p.y, t: -0.12 });
    const lines = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.2832 + rand(-0.2, 0.2), pts = [[0, 0]];
      let r = 0;
      for (let s = 0; s < 4; s++) { r += rand(8, 16); pts.push([Math.cos(a + rand(-0.3, 0.3)) * r, Math.sin(a + rand(-0.3, 0.3)) * r * 0.8]); }
      lines.push(pts);
    }
    this.cracks.push({ x: p.x, y: p.y, t: 0, lines });
    if (this.cracks.length > 4) this.cracks.shift();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * 6.2832;
      FX.spawn('dust', p.x, p.y, 3, { vx: Math.cos(a) * 320, vy: Math.sin(a) * 240, drag: 3.2, life: 0.8, size: 8, size2: 24, color: '#d8ccb4', alpha: 0.7 });
    }
    for (let i = 0; i < 16; i++) {
      FX.spawn('debris', p.x + rand(-10, 10), p.y + rand(-6, 6), 4, { vx: rand(-120, 120), vy: rand(-80, 80), vz: rand(200, 380), g: 1000, bounce: 0.3, drag: 0.6, life: rand(1, 1.6), size: rand(3, 6), color: pick(['#5a5f69', '#77777f', '#3a3d44', '#8a6a4a']), rot: rand(6.28), rotV: rand(-12, 12) });
    }
    FX.spawn('glow', p.x, p.y, 10, { life: 0.3, size: 40, size2: 140, color: '#ff5a2a', alpha: 0.8 });
    Cam.addTrauma(Settings.motion ? 0.4 : 0.95);
    Cam.punch += 0.12;
    FX.flashScreen(0.45, '255,70,40');
    Game.slowmo(0.3, 0.4);
    Sound.rageStomp();
    FX.text(p.x, p.y + 90, n > 1 ? `RAGE STOMP! x${n}` : 'RAGE STOMP!', '#ff3b2f', 26);
    UI.toast('t-rage', n ? `BIG J SMASHED ${n} CAR${n > 1 ? 'S' : ''}` : 'BIG J STOMPED THE GROUND', n ? `+${60 * n} points` : 'Nothing was close enough this time', 2400);
    if (n) Game.addBonus(60 * n, p);
    p.rage = 0;
    if (Game.tracksProgress()) {
      Stats.add('stomps');
      Trophies.max('stompCars', n);
    }
  },

  drawGround(c) {
    for (const k of this.cracks) {
      const a = 0.55 * (1 - smoothstep(4, 6, k.t));
      c.strokeStyle = `rgba(30,24,20,${a})`;
      c.lineWidth = 1.8;
      c.beginPath();
      for (const line of k.lines) {
        c.moveTo(k.x, P(k.y, 0));
        for (const [dx, dy] of line) c.lineTo(k.x + dx, P(k.y + dy, 0));
      }
      c.stroke();
      c.fillStyle = `rgba(30,24,20,${a * 0.5})`;
      c.beginPath(); c.ellipse(k.x, P(k.y, 0), 10, 10 * GY, 0, 0, 6.2832); c.fill();
    }
    for (const r of this.rings) {
      if (r.t < 0) continue;
      const k = r.t / 0.9, R = this.RADIUS * 1.15 * easeOutCubic(k);
      c.strokeStyle = `rgba(255,${Math.round(120 + 100 * k)},80,${0.85 * (1 - k)})`;
      c.lineWidth = 3 + 9 * (1 - k);
      c.beginPath(); c.ellipse(r.x, P(r.y, 2), R, R * GY, 0, 0, 6.2832); c.stroke();
    }
  },
};

const EGG_ROWS = 50;

const Egg = {
  carry: null, // { start, rows, cracks } while player one has the egg

  reset() { this.carry = null; },

  // Single player only (pets are player one's), never in the first stretch.
  canSpawn(rowI) { return Game.players.length === 1 && rowI > 25 && !this.carry; },

  pickup(p, it) {
    if (p.id !== 0 || this.carry) return;
    this.carry = { start: p.maxRow, rows: 0, cracks: 0 };
    // every other egg on the road disappears: you can only carry one
    for (let i = Items.list.length - 1; i >= 0; i--) if (Items.list[i].type === 'egg') Items.list.splice(i, 1);
    FX.pickup(it.x, it.y, '#ff8ad8');
    FX.text(it.x, it.y + 20, 'AN EGG!', '#ff8ad8', 20);
    UI.toast('t-hatch', 'YOU FOUND AN EGG', `Carry it ${EGG_ROWS} rows without dying and it hatches`, 3400);
    Sound.powerup();
    if (Game.tracksProgress()) Stats.add('eggs');
  },

  // 0..1, how close the egg is to hatching.
  progress() { return this.carry ? Math.min(1, this.carry.rows / EGG_ROWS) : 0; },

  update() {
    const e = this.carry;
    if (!e || Game.state !== 'playing' || !Player.alive) return;
    e.rows = Player.maxRow - e.start;
    // the last ten rows: it starts cracking
    const left = EGG_ROWS - e.rows;
    if (left <= 10 && left > 0 && e.cracks < 11 - left) {
      e.cracks = 11 - left;
      Sound.crack();
      if (left <= 3) FX.text(Player.x, Player.y + 60, left === 1 ? 'IT\'S HATCHING!' : `${left}...`, '#ff8ad8', 16);
    }
    if (e.rows >= EGG_ROWS) this.hatch(Player);
  },

  // Out it comes. You get a pet you don't have yet, or a pile of coins if you have them all.
  hatch(p) {
    this.carry = null;
    const fresh = EGG_PETS.filter(id => !Shop.has('pets', id));
    const x = p.x, y = p.y;
    for (let i = 0; i < 26; i++) {
      const a = rand(6.2832), s = rand(80, 220);
      FX.spawn('shard', x, y, 40, { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(120, 300), g: 800, drag: 0.8, life: rand(0.6, 1.1), size: rand(3, 7), color: pick(['#fff6e6', '#ffe9c9', '#ff8ad8', '#7fd6ff']), rotV: rand(-16, 16) });
    }
    for (let i = 0; i < 40; i++) FX.spawn('glow', x + rand(-20, 20), y + rand(-12, 12), rand(10, 60), { vz: rand(20, 80), life: rand(0.6, 1.2), size: rand(2, 4), size2: 0.5, color: `hsl(${rand(360)},100%,75%)` });
    FX.spawn('glow', x, y, 40, { life: 0.4, size: 30, size2: 120, color: '#ffe9a0', alpha: 0.9 });
    FX.flashScreen(0.5, '255,230,160');
    Game.slowmo(0.35, 0.6);
    Cam.addTrauma(0.3);
    Sound.hatch();
    if (Game.tracksProgress()) Stats.add('hatched');
    if (!fresh.length) { // you've hatched them all: a golden jackpot instead
      const n = 150;
      p.coins += n;
      Game.coins = p.coins;
      Game.addBonus(500, p);
      FX.text(x, y + 40, `JACKPOT! +${n} COINS`, '#ffd23f', 24);
      UI.toast('t-hatch', 'THE EGG WAS FULL OF GOLD', `You have every egg pet already. +${n} coins`, 4200);
      return;
    }
    const id = pick(fresh), def = PETS[id];
    Shop.grant('pets', id);
    Shop.equip('pets', id);
    Pets.pop(x, y);
    FX.text(x, y + 40, `${def.name.toUpperCase()}!`, '#ffd23f', 24);
    UI.toast('t-hatch', `IT HATCHED: ${def.name.toUpperCase()}`, `${def.rare} · ${def.perk}`, 5200);
    Trophies.add('hatch');
  },

  // Died with the egg: it breaks.
  lose(p) {
    if (!this.carry || p.id !== 0) return;
    this.carry = null;
    FX.text(p.x, p.y + 56, 'THE EGG BROKE', '#fff6e6', 15);
    for (let i = 0; i < 12; i++) {
      FX.spawn('shard', p.x, p.y, 36, { vx: rand(-140, 140), vy: rand(-90, 90), vz: rand(80, 220), g: 800, drag: 0.8, life: rand(0.5, 0.9), size: rand(3, 6), color: pick(['#fff6e6', '#ffe9c9', '#ffd23f']), rotV: rand(-16, 16) });
    }
  },
};
