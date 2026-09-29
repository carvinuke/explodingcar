'use strict';
// Secret events (rare, short, weird) and the Giant Bulldozer mini-boss.

const EVENT_DEFS = {
  ufo:     { name: 'UFO SIGHTING', sub: 'Stay out of the beam', weight: 1, dur: 0 },
  meteor:  { name: 'METEOR SHOWER', sub: 'Get out of the red circles', weight: 1, dur: 0 },
  giant:   { name: 'GIANT CHICKEN', sub: "Don't get stepped on", weight: 1, dur: 0 },
  flood:   { name: 'FLASH FLOOD', sub: 'The road is under water', weight: 0.9, dur: 14 },
  reverse: { name: 'WRONG WAY', sub: 'All traffic is driving backwards', weight: 0.9, dur: 10 },
  goose:   { name: 'GIANT GOOSE', sub: 'It wants you. Keep moving', weight: 0.9, dur: 0 },
  moon:    { name: 'THE MOON IS TOO CLOSE', sub: 'Low gravity', weight: 0.8, dur: 14 },
  lowgrav: { name: 'GRAVITY GLITCH', sub: 'Everything floats', weight: 0.7, dur: 10 },
  mini:    { name: 'MINIATURE WORLD', sub: 'Everything shrank', weight: 0.8, dur: 12 },
};

const box = (...a) => Draw.box(...a);
const isPlaying = () => Game.state === 'playing' && Player.alive;
const vulnerable = () => isPlaying() && Powers.invincible <= 0;

function findRow(test, from, to) {
  for (let r = from; r <= to; r++) {
    const row = World.rows.get(r);
    if (row && test(row)) return row;
  }
  return null;
}

// Something huge passes: trees and bushes in the way are flattened.
function flattenAt(x, y, rx, ry) {
  for (const row of World.rows.values()) {
    if (row.type !== 'grass' || Math.abs(row.y - y) > ry) continue;
    row.objs = row.objs.filter(o => {
      if (o.kind === 'lamp' || o.kind === 'sign' || Math.abs(o.x - x) > rx) return true;
      if (o.col >= 0 && o.col < COLS) row.blocked[o.col] = false;
      for (let i = 0; i < 8; i++) {
        FX.spawn('confetti', o.x, o.y, 14, { vx: rand(-90, 90), vy: rand(-60, 60), vz: rand(100, 220), g: 500, drag: 1.5, life: rand(0.8, 1.3), size: rand(4, 7), color: o.pal ? o.pal.top : '#9aa0a8', rotV: rand(-10, 10) });
      }
      return false;
    });
  }
}

// Wreck every car overlapping a rectangle around (x, y).
function smashCars(x, y, rx, ry, power) {
  for (const row of World.rows.values()) {
    if (Math.abs(row.y - y) > ry) continue;
    if (row.type === 'road') {
      for (const v of row.lane.vehicles) {
        if (!v.wreck && !v.abducted && Math.abs(v.x - x) < rx + v.len / 2) Vehicles.smash(v, x, power);
      }
    } else if (row.type === 'rail' && row.rail.stalled && Math.abs(row.rail.stalled.x - x) < rx + row.rail.stalled.len / 2) {
      const v = row.rail.stalled;
      row.rail.stalled = null;
      v.vy = 0;
      row.rail.wrecks.push(v);
      Vehicles.smash(v, x, power);
    }
  }
}

const HANDLERS = {
  // ---- UFO: hovers over a road, beams up cars (and maybe you), zaps a few, leaves ----
  ufo: {
    start(e) {
      const row = findRow(r => r.type === 'road', Player.row + 1, Player.row + 5) || World.rows.get(Player.row + 2);
      if (!row) return false;
      e.gy = row.y;
      e.row = row;
      e.x = Renderer.x0 - 6 * TILE;
      e.z = 320;
      e.tx = clamp(Player.x + rand(-1.5, 1.5) * TILE, TILE, WORLD_W - TILE);
      e.phase = 'arrive';
      e.pt = 0;
      e.zapT = 0.2;
      e.zaps = 0;
      e.grabbed = false;
      Sound.ufo();
      return true;
    },
    update(e, dt) {
      e.pt += dt;
      if (e.phase === 'arrive') {
        e.x = damp(e.x, e.tx, 2.5, dt);
        e.z = damp(e.z, 150, 2.5, dt);
        if (e.pt > 1.8) { e.phase = 'beam'; e.pt = 0; Sound.ufo(); }
      } else if (e.phase === 'beam') {
        e.x = approach(e.x, clamp(Player.x, TILE, WORLD_W - TILE), 35 * dt);
        if (e.row.type === 'road') {
          for (const v of e.row.lane.vehicles) {
            if (!v.wreck && !v.abducted && Math.abs(v.x - e.x) < 0.9 * TILE + v.len * 0.25) v.abducted = 0.001;
          }
        }
        if (!e.grabbed && vulnerable() && !Player.abduct && Math.abs(Player.x - e.x) < 0.8 * TILE && Math.abs(Player.y - e.gy) < 0.5 * TILE) {
          e.grabbed = true;
          Player.startAbduct(e);
        }
        if (e.pt > 4.5) {
          e.phase = 'zap';
          e.pt = 0;
          // let go of anything still in the beam
          if (e.row.type === 'road') {
            for (const v of e.row.lane.vehicles) {
              if (v.abducted && !v.dead) { Vehicles.wreck(v); v.vz = 0; v.secondary = Settings.gore ? 0.5 : 0; v.alpha = 1; }
            }
          }
        }
      } else if (e.phase === 'zap') {
        e.zapT -= dt;
        if (e.zapT <= 0 && e.zaps < 3) {
          e.zapT = 0.6;
          const targets = [];
          for (const row of World.rows.values()) {
            if (row.type !== 'road' || row.y < Player.y - TILE || row.y > Player.y + 6 * TILE) continue;
            for (const v of row.lane.vehicles) if (!v.wreck && !v.abducted && Renderer.inViewX(v.x)) targets.push(v);
          }
          if (targets.length) {
            const v = pick(targets);
            FX.laser(e.x, e.gy, e.z, v.x, v.y);
            Sound.laser();
            Vehicles.smash(v, e.x, 1.1);
          }
          e.zaps++;
        }
        if (e.pt > 2.2) { e.phase = 'leave'; e.pt = 0; Sound.ufo(); }
      } else {
        e.x += 520 * dt;
        e.z += 280 * dt;
        if (e.pt > 1.6) e.done = true;
      }
      // cars caught in the beam float up and vanish
      if (e.row.type === 'road') {
        for (const v of e.row.lane.vehicles) {
          if (!v.abducted || v.wreck) continue;
          v.abducted += dt;
          v.z += 85 * dt;
          v.rot += 2.4 * dt;
          v.alpha = clamp(1 - (v.z - 60) / 80, 0, 1);
          if (Math.random() < dt * 20) FX.spawn('glow', v.x + rand(-20, 20), v.y, v.z + rand(0, 20), { vz: 60, life: 0.5, size: 3, size2: 0.5, color: '#b8ffcc' });
          if (v.z > e.z - 30) v.dead = true;
        }
      }
    },
    sky(c, e, time) {
      const beam = e.phase === 'beam';
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath();
      c.ellipse(e.x, P(e.gy, 0), 40, 40 * GY * 0.5, 0, 0, 6.2832);
      c.fill();
      if (beam) {
        c.globalCompositeOperation = 'lighter';
        const top = P(e.gy, e.z - 12), bot = P(e.gy, 0), w0 = 0.45 * TILE, w1 = 0.95 * TILE;
        const g = c.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, 'rgba(150,255,190,0.35)');
        g.addColorStop(1, 'rgba(150,255,190,0.12)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(e.x - w0, top);
        c.lineTo(e.x + w0, top);
        c.lineTo(e.x + w1, bot);
        c.lineTo(e.x - w1, bot);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(170,255,200,0.3)';
        c.beginPath();
        c.ellipse(e.x, bot, w1, w1 * GY * 0.5, 0, 0, 6.2832);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.save();
      c.translate(e.x, P(e.gy, e.z) + Math.sin(time * 3) * 3);
      c.fillStyle = '#4c545e';
      c.beginPath(); c.ellipse(0, 7, 40, 11, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#b9c2cc';
      c.beginPath(); c.ellipse(0, 0, 50, 13, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#e8edf2';
      c.beginPath(); c.ellipse(0, -3, 40, 7, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(140,230,255,0.85)';
      c.beginPath(); c.arc(0, -6, 17, Math.PI, 0); c.fill();
      c.fillStyle = '#7ed957';
      c.beginPath(); c.arc(0, -10, 6, 0, 6.2832); c.fill();
      c.fillStyle = '#111';
      c.fillRect(-3, -12, 2, 3);
      c.fillRect(1, -12, 2, 3);
      const cols = ['#ff3b6b', '#ffd23f', '#34c6ea', '#7ed957'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.2832 + time * 2;
        c.fillStyle = cols[(i + ((time * 6) | 0)) % cols.length];
        c.beginPath(); c.arc(Math.cos(a) * 42, Math.sin(a) * 9 + 2, 3, 0, 6.2832); c.fill();
      }
      c.restore();
    },
  },

  // ---- Meteor shower: three impacts near you, each marked by a red circle ----
  meteor: {
    start(e) {
      e.rocks = [];
      e.next = 0.3;
      e.count = 0;
      return true;
    },
    update(e, dt) {
      e.next -= dt;
      if (e.count < 3 && e.next <= 0) {
        const tx = clamp(Player.x + rand(-2.5, 2.5) * TILE, 0.5 * TILE, WORLD_W - 0.5 * TILE);
        const ty = (Player.row + randInt(0, 3)) * TILE;
        e.rocks.push({ tx, ty, t: 0, fall: 2.1, x: tx + 380, z: 720 });
        e.count++;
        e.next = 1.5;
        Sound.whistle();
      }
      for (let i = e.rocks.length - 1; i >= 0; i--) {
        const m = e.rocks[i];
        m.t += dt;
        const k = Math.min(1, m.t / m.fall);
        m.x = lerp(m.tx + 380, m.tx, k);
        m.z = lerp(720, 0, k);
        FX.spawn('fire', m.x + rand(-6, 6), m.ty, m.z + rand(-6, 6), { vz: 30, g: -20, life: rand(0.3, 0.6), size: rand(8, 14), size2: 2 });
        if (Math.random() < 0.5) FX.spawn('smoke', m.x, m.ty, m.z, { vz: 20, g: -5, drag: 1, life: rand(0.8, 1.4), size: 6, size2: 18, color: '#3a3a40', alpha: 0.5 });
        if (k >= 1) {
          e.rocks.splice(i, 1);
          const gore = Settings.gore;
          if (vulnerable() && Math.hypot(Player.x - m.tx, Player.y - m.ty) < 0.85 * TILE) {
            Game.kill('meteor');
          }
          FX.meteorImpact(m.tx, m.ty, gore);
          flattenAt(m.tx, m.ty, 1.4 * TILE, 1.4 * TILE);
          Vehicles.blastVehicles(m.tx, m.ty, 2.2 * TILE);
          Game.onCrash(m.tx, m.ty, true, 1.8, 'meteor');
        }
      }
      if (e.count >= 3 && !e.rocks.length) e.done = true;
    },
    ground(c, e, time) {
      for (const m of e.rocks) {
        const k = Math.min(1, m.t / m.fall);
        const r = 1.2 * TILE * (0.6 + 0.4 * k);
        const pulse = 0.6 + 0.4 * Math.sin(time * 14);
        c.fillStyle = `rgba(255,40,50,${(0.12 + 0.22 * k) * pulse})`;
        c.beginPath(); c.ellipse(m.tx, P(m.ty, 2), r, r * GY, 0, 0, 6.2832); c.fill();
        c.strokeStyle = `rgba(255,60,70,${0.9 * pulse})`;
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = `rgba(0,0,0,${0.35 * k})`;
        c.beginPath(); c.ellipse(m.tx, P(m.ty, 2), 0.5 * TILE * k, 0.5 * TILE * k * GY, 0, 0, 6.2832); c.fill();
      }
    },
    sky(c, e, time) {
      for (const m of e.rocks) {
        const y = P(m.ty, m.z);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,150,60,0.4)';
        c.beginPath(); c.arc(m.x, y, 26, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#4a3b31';
        c.beginPath(); c.arc(m.x, y, 15, 0, 6.2832); c.fill();
        c.fillStyle = '#6d5a4b';
        c.beginPath(); c.arc(m.x - 4, y - 4, 5, 0, 6.2832); c.fill();
        c.fillStyle = '#2e241e';
        c.beginPath(); c.arc(m.x + 5, y + 3, 3.5, 0, 6.2832); c.fill();
      }
    },
  },

  // ---- A giant chicken stomps across the road ahead ----
  giant: {
    start(e) {
      e.y = (Player.row + randInt(2, 3)) * TILE;
      e.dir = chance(0.5) ? 1 : -1;
      e.x = e.dir > 0 ? Renderer.x0 - 3 * TILE : Renderer.x1 + 3 * TILE;
      e.speed = 115;
      e.stepT = 0.3;
      e.phase = 0;
      e.cluckT = 0.5;
      return true;
    },
    update(e, dt) {
      e.x += e.dir * e.speed * dt;
      e.phase += dt * 6;
      e.stepT -= dt;
      const near = clamp(1 - Math.abs(Player.y - e.y) / (10 * TILE), 0, 1);
      if (e.stepT <= 0) {
        e.stepT = 0.52;
        Cam.addTrauma(0.1 + 0.2 * near);
        Sound.stomp(0.4 + 0.6 * near);
        FX.dust(e.x + e.dir * 20, e.y, 10);
      }
      e.cluckT -= dt;
      if (e.cluckT <= 0) { e.cluckT = rand(1.5, 2.5); Sound.cluck(); }
      smashCars(e.x, e.y, 1.1 * TILE, 1.0 * TILE, 1.4);
      flattenAt(e.x, e.y, 1.1 * TILE, 1.0 * TILE);
      if (vulnerable() && Math.abs(Player.x - e.x) < 1.0 * TILE && Math.abs(Player.y - e.y) < 0.9 * TILE && Player.z < 30) {
        Game.kill('giant');
      }
      if ((e.dir > 0 && e.x > Renderer.x1 + 4 * TILE) || (e.dir < 0 && e.x < Renderer.x0 - 4 * TILE) || e.t > 25) e.done = true;
    },
    drawables(e, list) {
      const s = Math.sin(e.phase);
      list.push({
        kind: 'event', key: e.y - 30, x: e.x, y: e.y, shadow: [3.4 * TILE, 2 * TILE],
        draw: (c, time) => {
          c.scale(4, 4);
          Draw.player(c, { facing: e.dir > 0 ? 'right' : 'left', squash: Math.abs(s) * 0.12, flap: (s + 1) / 2, z: Math.abs(s) * 3, rot: 0, char: 0 }, time, SKINS.chick);
        },
      });
    },
  },

  // ---- Flash flood: a whole road block fills with water ----
  flood: {
    start(e) {
      const first = findRow(r => r.type === 'road', Player.row, Player.row + 10);
      if (!first) return false;
      e.rows = [];
      for (let r = first.i; ; r++) {
        const row = World.rows.get(r);
        if (!row || row.type !== 'road') break;
        e.rows.push(row);
      }
      e.nextCrash = 3;
      e.crashes = 0;
      for (const r of e.rows) r.flood = 0.01;
      Sound.splash(1);
      return true;
    },
    update(e, dt) {
      const amt = clamp(Math.min(e.t / 1.2, (e.dur - e.t) / 1.2), 0.01, 1);
      for (const r of e.rows) {
        r.flood = amt;
        for (const v of r.lane.vehicles) {
          if (!v.wreck && Math.random() < dt * 3 && Renderer.inViewX(v.x)) FX.splash(v.x - r.lane.dir * v.len / 2, v.y, 5);
        }
      }
      e.nextCrash -= dt;
      if (e.nextCrash <= 0 && e.crashes < 2) {
        e.nextCrash = 4;
        for (const r of e.rows) {
          const vs = r.lane.vehicles.filter(v => !v.wreck && !v.reckless && Renderer.inViewX(v.x));
          const dir = r.lane.dir;
          vs.sort((a, b) => (b.x - a.x) * dir);
          if (vs.length < 2) continue;
          const lead = vs[0], v = vs[1];
          if ((lead.x * dir - lead.len / 2) - (v.x * dir + v.len / 2) > 5 * TILE) continue;
          v.reckless = true;
          v.horned = true;
          v.desired = v.speed = lead.speed + 220;
          FX.text(v.x, v.y + 12, 'HYDROPLANING!', '#bfe6ff', 15);
          e.crashes++;
          break;
        }
      }
    },
    end(e) { for (const r of e.rows) r.flood = 0; },
  },

  reverse: {
    start() { Events.reverse = true; Sound.screech(); return true; },
    end() { Events.reverse = false; Sound.screech(); },
  },

  // ---- A giant goose chases you (and flattens anything in its way) ----
  goose: {
    start(e) {
      e.x = Player.x;
      e.y = Player.y - 6 * TILE;
      e.z = 0;
      e.face = 1;
      e.speed = 105 + 40 * difficulty(Player.maxRow);
      e.honkT = 0.3;
      e.leaving = false;
      e.step = 0;
      return true;
    },
    update(e, dt) {
      e.step += dt * 10;
      if (!e.leaving) {
        const dx = Player.x - e.x, dy = Player.y - e.y, dist = Math.hypot(dx, dy) || 1;
        if (Player.alive) {
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
          if (Math.abs(dx) > 4) e.face = sign(dx);
          if (dist > 9 * TILE) e.y = Player.y - 7 * TILE;
        }
        smashCars(e.x, e.y, 0.9 * TILE, 0.7 * TILE, 1.2);
        flattenAt(e.x, e.y, 0.8 * TILE, 0.6 * TILE);
        if (vulnerable() && dist < 0.75 * TILE && Player.z < 40) Game.kill('goose');
        e.honkT -= dt;
        if (e.honkT <= 0) { e.honkT = rand(1.1, 1.8); Sound.honk(); if (chance(0.4)) FX.text(e.x, e.y + 40, 'HONK!', '#ffffff', 18); }
        if (e.t > 12) { e.leaving = true; e.lt = 0; Sound.honk(); }
      } else {
        e.lt += dt;
        e.z += 180 * dt;
        e.y += 260 * dt;
        if (e.lt > 2.2) e.done = true;
      }
    },
    drawables(e, list) {
      list.push({
        kind: 'event', key: e.y - 20, x: e.x, y: e.y, shadow: [2.4 * TILE, 1.4 * TILE],
        draw: (c, time) => drawGoose(c, e, time),
      });
    },
  },

  moon: { start() { Sound.moon(); return true; } },
  lowgrav: { start() { Sound.moon(); return true; } },
  mini: { start() { return true; } },
};

function drawGoose(c, e, time) {
  c.translate(0, P(0, e.z));
  c.scale(2.6 * e.face, 2.6);
  const run = Math.sin(e.step), lift = e.leaving ? 1 : 0;
  // legs
  c.fillStyle = '#ff9f1c';
  c.fillRect(-5 + run * 3, P(-2, 8), 3, 8 * GZ);
  c.fillRect(3 - run * 3, P(-2, 8), 3, 8 * GZ);
  // body + tail + belly
  box(c, -16, 12, -9, 9, 6, 24, '#9a8f82', '#7a6f63');
  box(c, -22, -14, -5, 5, 16, 24, '#3a3632', '#2a2622');
  c.fillStyle = '#e9e4dc';
  c.fillRect(-10, P(-9, 12), 20, 6 * GZ);
  // wings (flap when flying off or running)
  const wz = 18 + (lift ? Math.sin(time * 18) * 10 : Math.abs(run) * 3);
  box(c, -12, 6, -11, -8, wz, wz + 6, '#8a7f72', '#6d6358');
  // neck, head, cheek, beak, eye
  box(c, 8, 14, -3, 3, 22, 44, '#1d1d1f', '#141416');
  box(c, 8, 20, -4, 4, 42, 51, '#1d1d1f', '#141416');
  c.fillStyle = '#f4f4f4';
  c.fillRect(10, P(-4, 47), 6, 3 * GZ);
  box(c, 20, 28, -2, 2, 43, 47, '#ff9f1c', '#e07b00');
  c.fillStyle = '#ff3b3b';
  c.fillRect(15, P(-4, 50), 2, 2);
}

// ---- Giant Bulldozer boss --------------------------------------------------
const Boss = {
  start() {
    const d = difficulty(Player.maxRow);
    const b = Events.boss = {
      x: Player.x, y: Player.y - 7 * TILE, speed: TILE * (1.35 + 0.5 * d), t: 0, phase: 'chase',
      switches: [], pressed: 0, zone: null, bloody: false, smokeT: 0, rumbleT: 0, deadT: 0,
      z: 0, vz: 0, rot: 0, rotV: 0, sink: 0,
    };
    World.ensure(Player.row + 30);
    for (const off of [5, 11, 17]) this.placeSwitch(b, Player.row + off);
    Game.danger.active = false;
    UI.bossToast('start');
    Sound.bossHorn();
  },

  placeSwitch(b, fromRow) {
    for (let r = fromRow; r < fromRow + 10; r++) {
      const row = World.rows.get(r);
      if (!row || row.type !== 'grass' || b.switches.some(s => s.row === r)) continue;
      const free = [];
      for (let c = 1; c < COLS - 1; c++) if (!row.blocked[c]) free.push(c);
      if (!free.length) continue;
      const col = pick(free);
      b.switches.push({ row: r, col, x: cellX(col), y: r * TILE, pressed: false, t: 0 });
      return;
    }
  },

  update(dt) {
    const b = Events.boss;
    b.t += dt;
    if (b.phase === 'dead') {
      b.deadT += dt;
      if (b.sink) {
        b.sink = Math.min(1, b.sink + dt * 0.6);
        if (Math.random() < dt * 20) FX.bubbles(b.x + rand(-TILE, TILE), b.y);
      } else {
        b.vz -= 1100 * Events.gravity * dt;
        b.z = Math.max(0, b.z + b.vz * dt);
        b.rot += b.rotV * dt;
        if (b.z === 0) { b.vz = 0; b.rotV *= 0.9; }
        if (Math.random() < dt * 30) FX.wreckFire(b.x + rand(-1.2, 1.2) * TILE, b.y, 40 + b.z);
        if (Math.random() < dt * 12) FX.wreckSmoke(b.x + rand(-TILE, TILE), b.y, 60 + b.z, true);
      }
      if (b.deadT > 4.5) {
        Events.boss = null;
        Events.nextBossRow = Player.maxRow + 140;
        Game.danger.y = Math.max(Game.danger.y, Player.y - 7 * TILE);
        Game.danger.active = true;
      }
      return;
    }

    // chase: grind forward toward the player, never too far behind
    const ty = Player.y - 0.4 * TILE;
    if (b.y < ty) b.y = Math.min(ty, b.y + b.speed * Game.trafficFactor() * dt);
    if (b.y < Player.y - 8 * TILE) b.y = Player.y - 8 * TILE;
    b.x = damp(b.x, clamp(Player.x, 1.5 * TILE, WORLD_W - 1.5 * TILE), 1.2, dt);

    b.smokeT -= dt;
    if (b.smokeT <= 0) { b.smokeT = 0.12; FX.puff(b.x + 27, b.y - 3, 86, '#26262a'); }
    b.rumbleT -= dt;
    if (b.rumbleT <= 0) {
      b.rumbleT = 0.6;
      const near = clamp(1 - Math.abs(Player.y - b.y) / (10 * TILE), 0, 1);
      Sound.rumble(0.3 + 0.5 * near);
      Cam.addTrauma(0.05 * near);
    }

    smashCars(b.x, b.y, 1.6 * TILE, 1.0 * TILE, 1.5);
    flattenAt(b.x, b.y, 1.6 * TILE, 1.0 * TILE);

    if (vulnerable() && Math.abs(Player.x - b.x) < 1.5 * TILE && Player.y - b.y < 0.9 * TILE && Player.y - b.y > -1.0 * TILE && Player.z < 40) {
      b.bloody = Settings.gore;
      Game.kill('bulldozer');
    }

    // detonator switches
    for (const s of b.switches) {
      s.t += dt;
      if (!s.pressed && isPlaying() && Player.row === s.row && Math.abs(Player.x - s.x) < 0.5 * TILE && !Player.hop) {
        s.pressed = true;
        b.pressed++;
        Sound.switchClick();
        FX.sparks(s.x, s.y, 12, 16, ['#ffd23f', '#ffffff'], 220);
        FX.text(s.x, s.y + 20, `SWITCH ${b.pressed}/3`, '#ffd23f', 18);
      }
    }
    // a switch left behind moves up ahead of you
    for (let i = b.switches.length - 1; i >= 0; i--) {
      const s = b.switches[i];
      if (!s.pressed && s.row < Player.row - 2) {
        b.switches.splice(i, 1);
        this.placeSwitch(b, Player.row + 5);
      }
    }
    if (!b.zone && b.pressed >= 3) {
      const row = findRow(r => r.type === 'road', Player.row + 2, Player.row + 12) || World.rows.get(Player.row + 4);
      b.zone = { row: row.i, y: row.y };
      UI.bossToast('armed');
      Sound.switchClick();
    }

    // what it drives into
    const here = World.rows.get(Math.round(b.y / TILE));
    if (here && here.type === 'river' && Math.abs(here.y - b.y) < 0.3 * TILE) return this.defeat(b, 'river');
    for (const row of World.rows.values()) {
      if (row.type !== 'rail' || row.rail.state !== 'train' || Math.abs(row.y - b.y) > 0.9 * TILE) continue;
      const [a, c] = Rail.extent(row.rail);
      if (b.x + 1.5 * TILE > a && b.x - 1.5 * TILE < c) return this.defeat(b, 'train');
    }
    if (b.zone && b.y >= b.zone.y - 0.3 * TILE) this.defeat(b, 'tnt');
  },

  defeat(b, how) {
    b.phase = 'dead';
    b.deadT = 0;
    const gore = Settings.gore;
    const y = b.zone && how === 'tnt' ? b.zone.y : b.y;
    if (how === 'river') {
      b.sink = 0.01;
      FX.splash(b.x, b.y, 60);
      FX.splash(b.x - TILE, b.y, 30);
      FX.splash(b.x + TILE, b.y, 30);
      Sound.splash(1);
    } else {
      b.vz = 520;
      b.rotV = (chance(0.5) ? 1 : -1) * 3;
      FX.tankerBlast(b.x, y, ['#ffc21a', '#3a3a3f', '#b9bec6'], gore);
      for (let k = -2; k <= 2; k++) if (k) FX.carCrash(b.x + k * 1.6 * TILE, y, ['#ffc21a', '#3a3a3f']);
      Vehicles.blastVehicles(b.x, y, 3 * TILE);
      Game.onCrash(b.x, y, true, 1.5, 'tanker');
    }
    Game.coins += 50;
    Game.addBonus(500);
    FX.text(b.x, b.y + 60, 'BULLDOZER DESTROYED! +500', '#ffd23f', 22);
    UI.bossToast('defeated', how);
    Missions.add('boss');
  },

  drawables(b, list) {
    list.push({
      kind: 'event', key: b.y - 0.8 * TILE, x: b.x, y: b.y, shadow: [3.6 * TILE, 2 * TILE],
      draw: (c, time) => this.draw(c, b, time),
    });
    for (const s of b.switches) {
      list.push({ kind: 'event', key: s.y - 8, x: s.x, y: s.y, shadow: [0.6 * TILE, 0.5 * TILE], draw: (c, time) => this.drawSwitch(c, s, time) });
    }
    if (b.zone && b.phase !== 'dead') {
      for (let col = 0; col < COLS; col += 2) {
        list.push({ kind: 'event', key: b.zone.y - 6, x: cellX(col), y: b.zone.y + 12, draw: c => this.drawTnt(c) });
      }
    }
  },

  draw(c, b, time) {
    if (b.sink) { c.globalAlpha = 1 - b.sink; c.translate(0, P(0, -b.sink * 40)); }
    if (b.z) c.translate(0, P(0, b.z));
    if (b.rot) c.rotate(b.rot);
    const W2 = 1.35 * TILE, D2 = 0.72 * TILE;
    const dead = b.phase === 'dead';
    const yel = dead ? '#4a3f2a' : '#ffc21a', yelD = dead ? '#302a1c' : '#e0a100';
    // blade (far side), then treads, body, cab
    box(c, -W2 - 10, W2 + 10, D2, D2 + 10, 0, 36, dead ? '#333' : '#c3c8cf', dead ? '#222' : '#8a9099');
    c.fillStyle = dead ? '#222' : '#1d1d1f';
    for (let x = -W2 - 10; x < W2 + 10; x += 16) c.fillRect(x, P(D2 + 10, 36), 8, 4);
    if (b.bloody) {
      c.fillStyle = '#8f0a17';
      c.fillRect(-20, P(D2 + 10, 36), 34, 6);
      c.fillRect(-8, P(D2 + 10, 34), 4, 10);
    }
    box(c, -W2 - 6, -W2 + 16, -D2, D2, 0, 16, '#2b2b2f', '#1b1b1e');
    box(c, W2 - 16, W2 + 6, -D2, D2, 0, 16, '#2b2b2f', '#1b1b1e');
    c.fillStyle = '#3d3d42';
    const off = (time * 30) % 8;
    for (let x = -W2 - 6 + off; x < -W2 + 16; x += 8) c.fillRect(x, P(-D2, 14), 3, 12 * GZ);
    for (let x = W2 - 16 + off; x < W2 + 6; x += 8) c.fillRect(x, P(-D2, 14), 3, 12 * GZ);
    box(c, -W2 + 12, W2 - 12, -D2 + 4, D2 - 4, 14, 40, yel, yelD);
    c.fillStyle = dead ? '#222' : '#1d1d1f';
    for (let x = -W2 + 14; x < W2 - 14; x += 14) c.fillRect(x, P(-D2 + 4, 22), 7, 5 * GZ);
    box(c, -20, 20, -D2 + 6, 6, 40, 72, dead ? '#3a3226' : '#ffd84d', yelD);
    c.fillStyle = dead ? '#111' : '#27354d';
    c.fillRect(-16, P(-D2 + 6, 68), 32, 20 * GZ);
    box(c, 24, 30, -6, 0, 40, 86, '#3a3a3f', '#2a2a2e');
    if (!dead) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = Math.sin(time * 12) > 0 ? 'rgba(255,150,30,0.9)' : 'rgba(255,150,30,0.25)';
      c.beginPath(); c.arc(0, P(0, 78), 5, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
  },

  drawSwitch(c, s, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6 + s.x);
    if (!s.pressed) {
      c.strokeStyle = `rgba(255,210,63,${0.5 + 0.4 * pulse})`;
      c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(0, P(0, 5), 18 + pulse * 4, (18 + pulse * 4) * GY, 0, 0, 6.2832); c.stroke();
    }
    box(c, -9, 9, -7, 7, 4, 14, '#c8102e', '#8f0a1f');
    c.fillStyle = '#fff';
    c.font = `900 5px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('TNT', 0, P(-7, 8));
    const hz = s.pressed ? 16 : 28;
    box(c, -1.5, 1.5, -1.5, 1.5, 14, hz, '#9aa0a8', '#6d737c');
    box(c, -8, 8, -2, 2, hz, hz + 3, '#2a2a2e', '#1b1b1e');
    c.fillStyle = s.pressed ? '#3ddc84' : (pulse > 0.5 ? '#ff3b3b' : '#6a1a1a');
    c.fillRect(5, P(-7, 12), 3, 3);
    if (!s.pressed) { // bouncing arrow
      const ay = P(0, 52 + Math.abs(Math.sin(time * 4)) * 8);
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(-8, ay - 6); c.lineTo(8, ay - 6); c.lineTo(0, ay + 4); c.closePath(); c.fill();
      c.strokeStyle = '#1d1d1f';
      c.lineWidth = 1.5;
      c.stroke();
    }
  },

  drawTnt(c) {
    box(c, -8, 8, -6, 6, 0, 13, '#c8102e', '#8f0a1f');
    c.fillStyle = '#fff';
    c.font = `900 5px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('TNT', 0, P(-6, 5));
    c.strokeStyle = '#1d1d1f';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, P(0, 13)); c.lineTo(4, P(0, 19)); c.stroke();
  },
};

const Events = {
  active: null,
  cd: 45,
  last: null,
  gravity: 1,
  reverse: false,
  moonAmt: 0,
  lowAmt: 0,
  miniAmt: 0,
  boss: null,
  nextBossRow: 70,

  reset() {
    if (this.active) this.end(true);
    this.active = null;
    this.cd = rand(35, 60);
    this.gravity = 1;
    this.reverse = false;
    this.moonAmt = this.lowAmt = this.miniAmt = 0;
    this.boss = null;
    this.nextBossRow = randInt(65, 85);
  },

  update(dt) {
    const a = this.active, type = a ? a.type : null;
    this.moonAmt = approach(this.moonAmt, type === 'moon' ? 1 : 0, dt * 0.7);
    this.lowAmt = approach(this.lowAmt, type === 'lowgrav' ? 1 : 0, dt * 1.2);
    this.miniAmt = approach(this.miniAmt, type === 'mini' ? 1 : 0, dt * 1.2);
    this.gravity = lerp(1, 0.3, Math.max(this.moonAmt, this.lowAmt));
    if (a) {
      a.t += dt;
      const H = HANDLERS[a.type];
      if (H.update) H.update(a, dt);
      if ((a.dur && a.t >= a.dur) || a.done) this.end();
    } else if (Game.state === 'playing' && !this.boss) {
      this.cd -= dt;
      if (this.cd <= 0) this.startRandom();
    }
    if (Game.state === 'playing' && Player.alive && !this.boss && !this.active && Player.maxRow >= this.nextBossRow) Boss.start();
    if (this.boss) Boss.update(dt);
  },

  startRandom() {
    const types = Object.keys(EVENT_DEFS).filter(t => t !== this.last);
    for (let tries = 0; tries < 4; tries++) {
      if (this.start(weighted(types.map(t => [t, EVENT_DEFS[t].weight])))) return;
    }
    this.cd = 5;
  },

  start(type) {
    const def = EVENT_DEFS[type];
    const e = { type, t: 0, dur: def.dur, done: false };
    if (HANDLERS[type].start(e) === false) return false;
    this.active = e;
    this.last = type;
    UI.eventToast(def.name, def.sub);
    Sound.eventSting();
    return true;
  },

  end(silent) {
    const a = this.active;
    if (!a) return;
    const H = HANDLERS[a.type];
    if (H.end) H.end(a);
    this.active = null;
    this.cd = rand(50, 90);
    if (!silent && Game.state === 'playing' && Player.alive) Missions.add('events');
  },

  // ---- Renderer hooks ----
  drawables(list) {
    const a = this.active;
    if (a && HANDLERS[a.type].drawables) HANDLERS[a.type].drawables(a, list);
    if (this.boss) Boss.drawables(this.boss, list);
  },

  drawGround(c, time) {
    const a = this.active;
    if (a && HANDLERS[a.type].ground) HANDLERS[a.type].ground(c, a, time);
    const b = this.boss;
    if (b && b.zone && b.phase !== 'dead') { // demolition zone hazard stripes
      const y0 = P(b.zone.y + TILE / 2, 0), h = TILE * GY;
      const x0 = Renderer.x0 - TILE, x1 = Renderer.x1 + TILE;
      c.fillStyle = `rgba(255,210,63,${0.25 + 0.15 * Math.sin(time * 8)})`;
      c.fillRect(x0, y0, x1 - x0, h);
      c.fillStyle = 'rgba(20,20,22,0.55)';
      for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) {
        c.beginPath();
        c.moveTo(x, y0 + h); c.lineTo(x + 12, y0 + h); c.lineTo(x + 24, y0); c.lineTo(x + 12, y0);
        c.closePath();
        c.fill();
      }
    }
  },

  drawSky(c, time) {
    const a = this.active;
    if (a && HANDLERS[a.type].sky) HANDLERS[a.type].sky(c, a, time);
  },

  drawScreen(c, W, H, time) {
    if (this.moonAmt > 0.01) {
      const m = this.moonAmt;
      c.fillStyle = `rgba(10,14,40,${0.35 * m})`;
      c.fillRect(0, 0, W, H);
      const R = Math.max(W, H) * 0.34;
      const cx = W * 0.5, cy = -R * 0.45 + (1 - m) * -R;
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.4);
      g.addColorStop(0, `rgba(200,210,255,${0.3 * m})`);
      g.addColorStop(1, 'rgba(200,210,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 0.55 * m; // see-through so the road ahead stays readable
      c.fillStyle = '#d9dce6';
      c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
      c.fillStyle = '#b3b8c7';
      for (const [dx, dy, r] of [[-0.3, 0.45, 0.16], [0.25, 0.6, 0.12], [0.05, 0.3, 0.08], [-0.55, 0.2, 0.1], [0.5, 0.25, 0.09]]) {
        c.beginPath(); c.arc(cx + dx * R, cy + dy * R, r * R, 0, 6.2832); c.fill();
      }
      c.globalAlpha = 1;
    }
    if (this.miniAmt > 0.01) { // tilt-shift haze at the top and bottom
      const m = this.miniAmt;
      for (const [y0, y1] of [[0, H * 0.3], [H, H * 0.7]]) {
        const g = c.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, `rgba(235,245,255,${0.35 * m})`);
        g.addColorStop(1, 'rgba(235,245,255,0)');
        c.fillStyle = g;
        c.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
      }
    }
    if (this.lowAmt > 0.01) {
      c.fillStyle = `rgba(120,80,200,${0.08 * this.lowAmt})`;
      c.fillRect(0, 0, W, H);
    }
  },
};
