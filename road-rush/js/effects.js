'use strict';
// Visual effects: pooled particles, explosion fireballs, scorch decals,
// floating text and full-screen flashes. Everything expires on its own.

const FX = (() => {
  const MAX = 900;
  const free = [];
  const live = [];
  for (let i = 0; i < MAX; i++) free.push({});

  const blasts = [];
  const decals = [];
  const texts = [];
  const flash = { a: 0, rgb: '255,250,235' };

  const FIRE = ['#fffbe0', '#ffe27a', '#ffc04a', '#ff8a2a', '#f0531c', '#9a2f18'];
  const ADDITIVE = { fire: true, spark: true, glow: true };

  // ---- Pool -----------------------------------------------------------------
  function spawn(kind, x, y, z, o) {
    const p = free.pop();
    if (!p) return null; // pool exhausted: drop the particle rather than allocate
    p.kind = kind;
    p.x = x; p.y = y; p.z = z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 1;
    p.size = o.size || 4;
    p.size2 = o.size2 === undefined ? p.size : o.size2;
    p.color = o.color || '#fff';
    p.g = o.g || 0;
    p.drag = o.drag || 0;
    p.bounce = o.bounce || 0;
    p.rot = o.rot || 0;
    p.rotV = o.rotV || 0;
    p.alpha = o.alpha === undefined ? 1 : o.alpha;
    live.push(p);
    return p;
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life -= dt;
      if (p.life <= 0) {
        live[i] = live[live.length - 1];
        live.pop();
        free.push(p);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
      p.vz -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotV * dt;
      if (p.g > 0 && p.z < 0) {
        p.z = 0;
        if (p.bounce && p.vz < -40) {
          p.vz = -p.vz * p.bounce;
          p.vx *= 0.6; p.vy *= 0.6; p.rotV *= 0.6;
        } else {
          p.vz = 0; p.vx *= 0.85; p.vy *= 0.85; p.rotV *= 0.8;
        }
      }
    }
    for (let i = blasts.length - 1; i >= 0; i--) if ((blasts[i].t += dt) > 1.2) blasts.splice(i, 1);
    for (let i = decals.length - 1; i >= 0; i--) if ((decals[i].t += dt) > decals[i].life) decals.splice(i, 1);
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.t += dt;
      t.z += 40 * dt;
      if (t.t > t.life) texts.splice(i, 1);
    }
    flash.a = Math.max(0, flash.a - dt * 3.2);
  }

  function reset() {
    while (live.length) free.push(live.pop());
    blasts.length = decals.length = texts.length = 0;
    flash.a = 0;
  }

  // ---- Drawing (world transform already applied) ----------------------------
  function draw(c) {
    for (const p of live) {
      if (ADDITIVE[p.kind]) continue;
      const t = 1 - p.life / p.max;
      const sz = lerp(p.size, p.size2, t);
      const py = P(p.y, p.z);
      if (p.kind === 'smoke' || p.kind === 'dust') {
        c.globalAlpha = p.alpha * (1 - t) * Math.min(1, t * 8);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, py, sz, 0, 6.2832);
        c.fill();
      } else { // debris, shard, confetti, feather
        c.globalAlpha = p.alpha * Math.min(1, (p.life / p.max) * 4);
        c.fillStyle = p.color;
        c.save();
        c.translate(p.x, py);
        c.rotate(p.rot);
        c.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
        c.restore();
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (const p of live) {
      if (!ADDITIVE[p.kind]) continue;
      const t = 1 - p.life / p.max;
      const sz = lerp(p.size, p.size2, t);
      const py = P(p.y, p.z);
      if (p.kind === 'spark') {
        c.globalAlpha = 1 - t;
        c.strokeStyle = p.color;
        c.lineWidth = sz;
        c.beginPath();
        c.moveTo(p.x, py);
        c.lineTo(p.x - p.vx * 0.035, py - (P(p.vy, p.vz) * 0.035));
        c.stroke();
      } else {
        c.globalAlpha = p.kind === 'fire' ? (1 - t) * 0.9 : (1 - t) * p.alpha;
        c.fillStyle = p.kind === 'fire' ? FIRE[Math.min(FIRE.length - 1, (t * FIRE.length) | 0)] : p.color;
        c.beginPath();
        c.arc(p.x, py, Math.max(0.3, sz), 0, 6.2832);
        c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  function drawDecals(c) {
    for (const d of decals) {
      const a = 0.5 * Math.min(1, (d.life - d.t) / 3);
      c.fillStyle = `rgba(22,18,16,${a})`;
      c.beginPath();
      c.ellipse(d.x, P(d.y, 0), d.r, d.r * GY * 0.55, 0, 0, 6.2832);
      c.fill();
      c.fillStyle = `rgba(10,8,8,${a})`;
      c.beginPath();
      c.ellipse(d.x, P(d.y, 0), d.r * 0.5, d.r * GY * 0.28, 0, 0, 6.2832);
      c.fill();
    }
  }

  function drawBlasts(c) {
    c.globalCompositeOperation = 'lighter';
    for (const b of blasts) {
      const t = b.t;
      // light spilling onto the ground
      const gl = Math.max(0, 1 - t / 0.9);
      if (gl > 0) {
        const r = 3.4 * TILE * b.power, cy = P(b.y, 0);
        const g = c.createRadialGradient(b.x, cy, 0, b.x, cy, r);
        g.addColorStop(0, `rgba(255,170,70,${0.5 * gl})`);
        g.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(b.x, cy, r, r * GY, 0, 0, 6.2832);
        c.fill();
      }
      // expanding fireball
      if (t < 0.7) {
        const grow = easeOutCubic(Math.min(1, t / 0.16));
        const r = 1.4 * TILE * b.power * grow * (1 + t * 0.5);
        const a = 1 - smoothstep(0.12, 0.7, t);
        const cy = P(b.y, 16 + t * 34);
        const g = c.createRadialGradient(b.x, cy, 0, b.x, cy, r);
        g.addColorStop(0, `rgba(255,255,236,${a})`);
        g.addColorStop(0.3, `rgba(255,214,90,${a})`);
        g.addColorStop(0.65, `rgba(255,110,30,${a * 0.85})`);
        g.addColorStop(1, 'rgba(255,60,10,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(b.x, cy, r, 0, 6.2832);
        c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
    // shockwave ring on the ground
    for (const b of blasts) {
      if (b.t >= 0.45) continue;
      const k = b.t / 0.45;
      const r = 3.8 * TILE * b.power * easeOutCubic(k);
      c.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
      c.lineWidth = 2 + 7 * (1 - k);
      c.beginPath();
      c.ellipse(b.x, P(b.y, 2), r, r * GY, 0, 0, 6.2832);
      c.stroke();
    }
  }

  function drawTexts(c) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const t of texts) {
      const k = t.t / t.life;
      const s = k < 0.15 ? lerp(1.6, 1, k / 0.15) : 1;
      c.globalAlpha = 1 - smoothstep(0.6, 1, k);
      c.font = `700 ${Math.round(t.size * s)}px Fredoka, system-ui, sans-serif`;
      const y = P(t.y, t.z);
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(25,22,35,0.8)';
      c.strokeText(t.str, t.x, y);
      c.fillStyle = t.color;
      c.fillText(t.str, t.x, y);
    }
    c.globalAlpha = 1;
  }

  // Screen space (identity transform)
  function drawFlash(c, W, H) {
    if (flash.a < 0.01) return;
    c.fillStyle = `rgba(${flash.rgb},${flash.a})`;
    c.fillRect(0, 0, W, H);
  }

  // ---- Composite effects ----------------------------------------------------
  function sparks(x, y, z, n, colors, speed = 300) {
    for (let i = 0; i < n; i++) {
      const a = rand(6.2832), s = rand(0.4, 1) * speed;
      spawn('spark', x, y, z, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, vz: rand(40, 260),
        g: 700, drag: 1.5, life: rand(0.25, 0.6), size: rand(1.5, 2.8), color: pick(colors),
      });
    }
  }

  function carCrash(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 1 });
    decals.push({ x, y, r: 1.4 * TILE, t: 0, life: 14 });
    if (decals.length > 12) decals.shift();

    sparks(x, y, 18, 46, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff'], 520);
    for (let i = 0; i < 24; i++) { // debris: body panels, glass, tyre bits
      const a = rand(6.2832), s = rand(60, 290);
      spawn('debris', x + rand(-10, 10), y + rand(-6, 6), rand(10, 24), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(160, 430),
        g: 1000, bounce: 0.35, drag: 0.6, life: rand(1.6, 2.8), size: rand(4, 9),
        color: chance(0.45) ? pick(colors) : pick(['#2a2a2e', '#4a4a50', '#77777f', '#b8c4d6']),
        rot: rand(6.28), rotV: rand(-14, 14),
      });
    }
    for (let i = 0; i < 32; i++) { // fire
      const a = rand(6.2832), s = rand(10, 120);
      spawn('fire', x + rand(-14, 14), y + rand(-8, 8), rand(6, 26), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 150),
        g: -60, drag: 2, life: rand(0.35, 0.9), size: rand(12, 24), size2: 3,
      });
    }
    for (let i = 0; i < 26; i++) { // smoke
      const a = rand(6.2832), s = rand(10, 70);
      spawn('smoke', x + rand(-16, 16), y + rand(-8, 8), rand(10, 30), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 70),
        g: -20, drag: 1, life: rand(1.6, 3.2), size: rand(10, 18), size2: rand(34, 56),
        color: pick(['#3b3b40', '#505057', '#66666e']), alpha: 0.7,
      });
    }
    for (let i = 0; i < 18; i++) { // ground dust ring
      const a = (i / 18) * 6.2832;
      spawn('dust', x, y, 3, {
        vx: Math.cos(a) * 260, vy: Math.sin(a) * 200, drag: 3.5,
        life: 0.7, size: 8, size2: 22, color: '#d8ccb4', alpha: 0.6,
      });
    }
    spawn('glow', x, y, 18, { life: 0.25, size: 60, size2: 95, color: '#fff2c0', alpha: 0.9 });
  }

  function wreckFire(x, y, z) {
    spawn('fire', x + rand(-8, 8), y + rand(-6, 6), z, {
      vx: rand(-15, 15), vy: rand(-10, 10), vz: rand(40, 90),
      g: -40, drag: 1.5, life: rand(0.3, 0.6), size: rand(6, 11), size2: 2,
    });
  }

  function wreckSmoke(x, y, z) {
    spawn('smoke', x + rand(-6, 6), y + rand(-4, 4), z, {
      vx: rand(-10, 10) + 8, vy: rand(-5, 5), vz: rand(35, 60),
      g: -10, drag: 0.8, life: rand(1.5, 2.6), size: rand(6, 10), size2: rand(20, 32),
      color: pick(['#45454b', '#5a5a61']), alpha: 0.55,
    });
  }

  function dust(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = rand(6.2832), s = rand(20, 70);
      spawn('dust', x + rand(-6, 6), y + rand(-4, 4), 2, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(10, 30),
        g: -5, drag: 3, life: rand(0.35, 0.6), size: rand(3, 5), size2: rand(8, 12),
        color: '#efe6d2', alpha: 0.7,
      });
    }
  }

  function pickup(x, y, color) {
    spawn('glow', x, y, 18, { life: 0.35, size: 14, size2: 46, color, alpha: 0.8 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.2832;
      spawn('glow', x, y, 18, {
        vx: Math.cos(a) * 150, vy: Math.sin(a) * 110, vz: rand(-20, 60),
        drag: 3, life: rand(0.4, 0.7), size: 3.5, size2: 1, color,
      });
    }
    for (let i = 0; i < 14; i++) {
      spawn('confetti', x, y, 20, {
        vx: rand(-110, 110), vy: rand(-70, 70), vz: rand(150, 300),
        g: 600, drag: 1.2, life: rand(0.8, 1.3), size: rand(4, 6),
        color: pick([color, '#ffffff', '#ffe066']), rotV: rand(-12, 12),
      });
    }
  }

  function coin(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = rand(6.2832);
      spawn('glow', x, y, 14, {
        vx: Math.cos(a) * rand(40, 120), vy: Math.sin(a) * rand(30, 90), vz: rand(20, 120),
        g: 200, drag: 2, life: rand(0.3, 0.55), size: 2.5, size2: 0.5, color: '#ffd84d',
      });
    }
    spawn('glow', x, y, 14, { life: 0.25, size: 10, size2: 26, color: '#fff2a8', alpha: 0.8 });
  }

  function feathers(x, y) {
    for (let i = 0; i < 16; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-120, 120), vy: rand(-80, 80), vz: rand(120, 280),
        g: 260, drag: 2.2, life: rand(1, 1.6), size: rand(4, 7),
        color: pick(['#fff8d6', '#ffe066', '#ffffff']), rotV: rand(-8, 8),
      });
    }
  }

  function ice(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = rand(6.2832), s = rand(80, 260);
      spawn('glow', x, y, 16, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(-20, 80),
        drag: 2.5, life: rand(0.5, 0.9), size: 3, size2: 1,
        color: pick(['#dff8ff', '#8fe3ff', '#ffffff']),
      });
    }
  }

  function shieldBreak(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = rand(6.2832), s = rand(90, 240);
      spawn('shard', x, y, 16, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(80, 240),
        g: 700, drag: 0.8, life: rand(0.5, 0.9), size: rand(4, 8),
        color: pick(['#cfe9ff', '#7dc0ff', '#ffffff']), rotV: rand(-16, 16), alpha: 0.9,
      });
    }
    spawn('glow', x, y, 16, { life: 0.3, size: 20, size2: 60, color: '#8fd0ff', alpha: 0.8 });
    sparks(x, y, 14, 16, ['#ffffff', '#bfe3ff'], 320);
  }

  function text(x, y, str, color, size = 16) {
    texts.push({ x, y, z: 34, str, color, size, t: 0, life: 1.1 });
    if (texts.length > 20) texts.shift();
  }

  function flashScreen(a, rgb = '255,250,235') {
    if (a >= flash.a) { flash.a = a; flash.rgb = rgb; }
  }

  return {
    spawn, update, reset, draw, drawDecals, drawBlasts, drawTexts, drawFlash,
    sparks, carCrash, wreckFire, wreckSmoke, dust, pickup, coin, feathers, ice, shieldBreak,
    text, flashScreen,
    get count() { return live.length; },
  };
})();
