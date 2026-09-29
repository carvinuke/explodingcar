'use strict';
// Visual effects: pooled particles, explosions, scorch and blood decals,
// burning fuel spills, floating text, lens splatter and full-screen flashes.
// Everything expires on its own.

const FX = (() => {
  const MAX = 1400;
  const free = [];
  const live = [];
  for (let i = 0; i < MAX; i++) free.push({});

  const blasts = [];
  const decals = [];  // scorch marks
  const gore = [];    // blood splats and bloody tyre tracks (graphic mode)
  const pools = [];   // burning fuel spills (graphic mode)
  const lens = [];    // blood on the "camera lens" (graphic mode)
  const texts = [];
  const flash = { a: 0, rgb: '255,250,235' };

  const FIRE = ['#fffbe0', '#ffe27a', '#ffc04a', '#ff8a2a', '#f0531c', '#9a2f18'];
  const BLOOD = ['#9e0b1a', '#b8111f', '#7a0612', '#c7162a'];
  const BLOOD_DECAL = ['#7d0612', '#930a18', '#6a0510'];
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
    p.trail = o.trail || false;
    p.landed = false;
    live.push(p);
    return p;
  }

  const groundZ = y => {
    const r = World.rows.get(Math.round(y / TILE));
    return r && r.type === 'grass' ? 4 : 0;
  };

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
      if (p.trail && Math.random() < dt * 28) {
        spawn('fire', p.x, p.y, p.z + 3, { vz: 25, g: -30, life: rand(0.25, 0.45), size: rand(4, 7), size2: 1 });
      }
      if (p.g > 0 && p.z < 0) {
        p.z = 0;
        if (p.kind === 'blood') { // droplets become splats where they land
          splat(p.x, p.y, p.size * rand(1.2, 2.3));
          p.life = 0;
          continue;
        }
        if (p.kind === 'gib' && !p.landed) splat(p.x, p.y, rand(3, 6));
        p.landed = true;
        if (p.bounce && p.vz < -40) {
          p.vz = -p.vz * p.bounce;
          p.vx *= 0.6; p.vy *= 0.6; p.rotV *= 0.6;
        } else {
          p.vz = 0; p.vx *= 0.85; p.vy *= 0.85; p.rotV *= 0.8;
        }
      }
    }
    for (let i = blasts.length - 1; i >= 0; i--) if ((blasts[i].t += dt) > 1.4) blasts.splice(i, 1);
    for (let i = decals.length - 1; i >= 0; i--) if ((decals[i].t += dt) > decals[i].life) decals.splice(i, 1);
    for (let i = gore.length - 1; i >= 0; i--) if ((gore[i].t += dt) > gore[i].life) gore.splice(i, 1);
    for (let i = pools.length - 1; i >= 0; i--) {
      const f = pools[i];
      f.t += dt;
      if (f.t > f.life) { pools.splice(i, 1); continue; }
      f.r = f.maxR * easeOutCubic(Math.min(1, f.t / 0.9));
      const strength = 1 - smoothstep(f.life - 2, f.life, f.t);
      for (let n = dt * 50 * strength; n > 0; n--) {
        if (Math.random() > n) break;
        const a = rand(6.2832), d = Math.sqrt(Math.random()) * f.r;
        spawn('fire', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.8, 2, {
          vz: rand(30, 80), g: -40, drag: 1, life: rand(0.3, 0.7), size: rand(6, 12), size2: 1,
        });
      }
      if (Math.random() < dt * 6 * strength) {
        spawn('smoke', f.x + rand(-f.r, f.r) * 0.6, f.y, 20, {
          vx: rand(-8, 8) + 10, vz: rand(40, 70), g: -12, drag: 0.6, life: rand(2.5, 4),
          size: rand(10, 16), size2: rand(40, 64), color: pick(['#1c1c1f', '#2a2a2e']), alpha: 0.6,
        });
      }
    }
    for (let i = lens.length - 1; i >= 0; i--) {
      const l = lens[i];
      l.t += dt;
      l.len += l.drip * dt;
      if (l.t > l.life) lens.splice(i, 1);
    }
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
    blasts.length = decals.length = gore.length = pools.length = lens.length = texts.length = 0;
    flash.a = 0;
  }

  // ---- Drawing (world transform already applied) ----------------------------
  function draw(c) {
    for (const p of live) {
      if (ADDITIVE[p.kind]) continue;
      const t = 1 - p.life / p.max;
      const sz = lerp(p.size, p.size2, t);
      const py = P(p.y, p.z);
      const fade = Math.min(1, (p.life / p.max) * 4);
      switch (p.kind) {
        case 'smoke':
        case 'dust':
          c.globalAlpha = p.alpha * (1 - t) * Math.min(1, t * 8);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, py, sz, 0, 6.2832);
          c.fill();
          break;
        case 'blood':
          c.globalAlpha = 1;
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, py, sz, 0, 6.2832);
          c.fill();
          break;
        case 'wheel':
          c.globalAlpha = fade;
          c.save();
          c.translate(p.x, py);
          c.rotate(p.rot);
          c.fillStyle = '#18191d';
          c.beginPath(); c.arc(0, 0, sz / 2, 0, 6.2832); c.fill();
          c.fillStyle = '#9aa0a8';
          c.beginPath(); c.arc(0, 0, sz * 0.22, 0, 6.2832); c.fill();
          c.fillRect(-sz * 0.45, -1, sz * 0.9, 2);
          c.restore();
          break;
        case 'panel':
          c.globalAlpha = fade;
          c.save();
          c.translate(p.x, py);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          c.fillRect(-sz / 2, -sz * 0.28, sz, sz * 0.56);
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.fillRect(-sz / 2, sz * 0.12, sz, sz * 0.16);
          c.restore();
          break;
        default: // debris, shard, confetti, feather, gib
          c.globalAlpha = p.alpha * fade;
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
        c.lineTo(p.x - p.vx * 0.035, py - P(p.vy, p.vz) * 0.035);
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
    const y0 = Renderer.yBot - TILE, y1 = Renderer.yTop;
    for (const d of gore) {
      if (d.y < y0 || d.y > y1) continue;
      c.globalAlpha = d.a * Math.min(1, (d.life - d.t) / 4);
      c.fillStyle = d.color;
      if (d.track) {
        c.fillRect(d.x - 5, P(d.y + 8, d.z) - 1, 10, 2.4);
        c.fillRect(d.x - 5, P(d.y - 7, d.z) - 1, 10, 2.4);
        continue;
      }
      const cy = P(d.y, d.z);
      c.beginPath();
      c.ellipse(d.x + d.dir * d.stretch * d.r * 0.6, cy, d.r * (1 + d.stretch), d.r * GY * 0.75, 0, 0, 6.2832);
      c.fill();
      for (const [dx, dy, r] of d.dots) {
        c.beginPath();
        c.arc(d.x + dx, cy + dy * GY, r, 0, 6.2832);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  function drawPools(c) {
    if (!pools.length) return;
    c.globalCompositeOperation = 'lighter';
    for (const f of pools) {
      const a = 1 - smoothstep(f.life - 2, f.life, f.t);
      const cy = P(f.y, 0);
      const g = c.createRadialGradient(f.x, cy, 0, f.x, cy, f.r * 1.4 + 1);
      g.addColorStop(0, `rgba(255,150,40,${0.55 * a})`);
      g.addColorStop(0.6, `rgba(255,90,20,${0.3 * a})`);
      g.addColorStop(1, 'rgba(255,60,10,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(f.x, cy, f.r * 1.4 + 1, (f.r * 1.4 + 1) * GY, 0, 0, 6.2832);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
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
        const cy = P(b.y, 16 + t * 34 * b.power);
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
      c.lineWidth = 2 + 7 * (1 - k) * b.power;
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
      const s = k < 0.12 ? lerp(1.5, 1, k / 0.12) : 1;
      c.globalAlpha = 1 - smoothstep(0.6, 1, k);
      c.font = `900 ${Math.round(t.size * s)}px ${UI_FONT}`;
      const y = P(t.y, t.z);
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(16,17,20,0.9)';
      c.strokeText(t.str, t.x, y);
      c.fillStyle = t.color;
      c.fillText(t.str, t.x, y);
    }
    c.globalAlpha = 1;
  }

  // Screen space (identity transform)
  function drawLens(c, W, H) {
    if (!lens.length) return;
    const s = Math.min(W, H) / 700;
    for (const l of lens) {
      const a = 0.88 * (1 - smoothstep(0.55, 1, l.t / l.life));
      const x = l.x * W, y = l.y * H, r = l.r * s;
      c.fillStyle = `rgba(122,6,18,${a})`;
      c.beginPath();
      c.arc(x, y, r, 0, 6.2832);
      c.fill();
      for (const [dx, dy, dr] of l.dots) {
        c.beginPath();
        c.arc(x + dx * s, y + dy * s, dr * s, 0, 6.2832);
        c.fill();
      }
      if (l.len > 0) {
        const w = r * 0.32;
        c.fillRect(x - w / 2, y, w, l.len * s);
        c.beginPath();
        c.arc(x, y + l.len * s, w * 0.75, 0, 6.2832);
        c.fill();
      }
      c.fillStyle = `rgba(255,255,255,${0.12 * a})`;
      c.beginPath();
      c.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, 6.2832);
      c.fill();
    }
  }

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

  function burst(x, y, colors, k) {
    for (let i = 0; i < 24 * k; i++) { // debris: body panels, glass, tyre bits
      const a = rand(6.2832), s = rand(60, 290) * Math.sqrt(k);
      spawn('debris', x + rand(-10, 10), y + rand(-6, 6), rand(10, 24), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(160, 430) * Math.sqrt(k),
        g: 1000, bounce: 0.35, drag: 0.6, life: rand(1.6, 2.8), size: rand(4, 9),
        color: chance(0.45) ? pick(colors) : pick(['#2a2a2e', '#4a4a50', '#77777f', '#b8c4d6']),
        rot: rand(6.28), rotV: rand(-14, 14),
      });
    }
    for (let i = 0; i < 32 * k; i++) { // fire
      const a = rand(6.2832), s = rand(10, 120) * k;
      spawn('fire', x + rand(-14, 14) * k, y + rand(-8, 8) * k, rand(6, 26), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 150) * k,
        g: -60, drag: 2, life: rand(0.35, 0.9) * Math.sqrt(k), size: rand(12, 24) * Math.sqrt(k), size2: 3,
      });
    }
    for (let i = 0; i < 26 * k; i++) { // smoke
      const a = rand(6.2832), s = rand(10, 70) * k;
      spawn('smoke', x + rand(-16, 16), y + rand(-8, 8), rand(10, 30), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 70) * k,
        g: -20, drag: 1, life: rand(1.6, 3.2) * Math.sqrt(k), size: rand(10, 18), size2: rand(34, 56) * Math.sqrt(k),
        color: k > 1 ? pick(['#1f1f22', '#2d2d31', '#3b3b40']) : pick(['#3b3b40', '#505057', '#66666e']), alpha: 0.7,
      });
    }
    for (let i = 0; i < 18; i++) { // ground dust ring
      const a = (i / 18) * 6.2832;
      spawn('dust', x, y, 3, {
        vx: Math.cos(a) * 260 * k, vy: Math.sin(a) * 200 * k, drag: 3.5,
        life: 0.7, size: 8, size2: 22 * k, color: '#d8ccb4', alpha: 0.6,
      });
    }
  }

  function carCrash(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 1 });
    decals.push({ x, y, r: 1.4 * TILE, t: 0, life: 14 });
    if (decals.length > 12) decals.shift();
    sparks(x, y, 18, 46, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff'], 520);
    burst(x, y, colors, 1);
    spawn('glow', x, y, 18, { life: 0.25, size: 60, size2: 95, color: '#fff2c0', alpha: 0.9 });
  }

  // Graphic mode: a much bigger, messier blast.
  function carCrashViolent(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 1.75 });
    decals.push({ x, y, r: 2.4 * TILE, t: 0, life: 22 });
    if (decals.length > 12) decals.shift();
    sparks(x, y, 18, 110, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff', '#ff8a2a'], 760);
    burst(x, y, colors, 1.9);
    for (let i = 0; i < 4; i++) { // wheels torn off
      spawn('wheel', x + rand(-10, 10), y + rand(-6, 6), 14, {
        vx: rand(-340, 340), vy: rand(-170, 170), vz: rand(300, 540), g: 1000, bounce: 0.5, drag: 0.35,
        life: rand(2.8, 4), size: rand(10, 13), rotV: rand(-22, 22), trail: chance(0.5),
      });
    }
    for (let i = 0; i < 9; i++) { // doors, hood, bumpers
      spawn('panel', x + rand(-12, 12), y + rand(-6, 6), 16, {
        vx: rand(-300, 300), vy: rand(-160, 160), vz: rand(260, 520), g: 1000, bounce: 0.3, drag: 0.4,
        life: rand(2.6, 3.8), size: rand(10, 18), color: pick(colors), rot: rand(6.28), rotV: rand(-16, 16), trail: chance(0.4),
      });
    }
    for (let i = 0; i < 28; i++) { // glass
      const a = rand(6.2832), s = rand(120, 380);
      spawn('shard', x, y, 20, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(120, 320), g: 900, drag: 0.8,
        life: rand(0.8, 1.4), size: rand(3, 6), color: pick(['#cfe9ff', '#9fc9ea', '#ffffff']), rotV: rand(-18, 18), alpha: 0.85,
      });
    }
    pools.push({ x, y, r: 0, maxR: 1.8 * TILE, t: 0, life: 7 });
    if (pools.length > 4) pools.shift();
    spawn('glow', x, y, 18, { life: 0.35, size: 90, size2: 150, color: '#fff2c0', alpha: 1 });
  }

  function secondaryBlast(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 0.9 });
    sparks(x, y, 20, 40, ['#fff3b0', '#ffd166', '#ff8a2a'], 520);
    burst(x, y, colors, 0.8);
    for (let i = 0; i < 3; i++) {
      spawn('panel', x, y, 16, {
        vx: rand(-260, 260), vy: rand(-140, 140), vz: rand(260, 460), g: 1000, bounce: 0.3, drag: 0.4,
        life: rand(2.4, 3.2), size: rand(9, 15), color: pick(colors), rot: rand(6.28), rotV: rand(-16, 16), trail: true,
      });
    }
  }

  function wreckFire(x, y, z) {
    spawn('fire', x + rand(-8, 8), y + rand(-6, 6), z, {
      vx: rand(-15, 15), vy: rand(-10, 10), vz: rand(40, 90),
      g: -40, drag: 1.5, life: rand(0.3, 0.6), size: rand(6, 11), size2: 2,
    });
  }

  function wreckSmoke(x, y, z, dark) {
    spawn('smoke', x + rand(-6, 6), y + rand(-4, 4), z, {
      vx: rand(-10, 10) + 8, vy: rand(-5, 5), vz: rand(35, 60) * (dark ? 1.4 : 1),
      g: -10, drag: 0.8, life: rand(1.5, 2.6) * (dark ? 1.6 : 1), size: rand(6, 10), size2: rand(20, 32) * (dark ? 1.6 : 1),
      color: dark ? pick(['#18181b', '#26262a']) : pick(['#45454b', '#5a5a61']), alpha: dark ? 0.7 : 0.55,
    });
  }

  // ---- Blood (graphic mode only) --------------------------------------------
  function splat(x, y, r, stretch = 0, dir = 1) {
    const dots = [];
    const n = r > 8 ? randInt(4, 8) : randInt(0, 2);
    for (let i = 0; i < n; i++) {
      const a = rand(6.2832), d = r * rand(0.9, 1.9);
      dots.push([Math.cos(a) * d + dir * stretch * r * 0.6, Math.sin(a) * d * 0.8, r * rand(0.12, 0.4)]);
    }
    gore.push({ x, y, z: groundZ(y), r, dots, stretch, dir, t: 0, life: 32, a: rand(0.8, 0.95), color: pick(BLOOD_DECAL) });
    if (gore.length > 280) gore.shift();
  }

  function track(x, y, a) {
    gore.push({ track: true, x, y, z: groundZ(y), t: 0, life: 12, a: 0.85 * a, color: '#7d0612', dots: null });
    if (gore.length > 280) gore.shift();
  }

  function lensSplat(n) {
    for (let i = 0; i < n; i++) {
      const r = rand(14, 58), dots = [];
      for (let k = randInt(2, 6); k > 0; k--) {
        const a = rand(6.2832), d = r * rand(1.1, 2);
        dots.push([Math.cos(a) * d, Math.sin(a) * d, r * rand(0.1, 0.3)]);
      }
      lens.push({ x: rand(0.05, 0.95), y: rand(0.05, 0.7), r, dots, drip: chance(0.6) ? rand(18, 50) : 0, len: 0, t: 0, life: rand(2.4, 3.6) });
    }
  }

  // The chick gets run over: spray, chunks, pools and a smear along the car's path.
  function roadkill(x, y, dir) {
    for (let i = 0; i < 130; i++) {
      const fwd = chance(0.75) ? 1 : -0.35;
      spawn('blood', x + rand(-6, 6), y + rand(-5, 5), rand(4, 16), {
        vx: dir * rand(60, 440) * fwd + rand(-70, 70), vy: rand(-150, 150), vz: rand(40, 360),
        g: 950, drag: 0.5, life: 3, size: rand(1.6, 4.2), color: pick(BLOOD),
      });
    }
    for (let i = 0; i < 12; i++) { // blood mist
      spawn('smoke', x, y, rand(6, 18), {
        vx: dir * rand(20, 120), vy: rand(-40, 40), vz: rand(10, 50), drag: 2,
        life: rand(0.4, 0.8), size: rand(5, 9), size2: rand(18, 28), color: '#a0101f', alpha: 0.55,
      });
    }
    for (let i = 0; i < 22; i++) { // chunks
      spawn('gib', x, y, rand(6, 16), {
        vx: dir * rand(40, 320) + rand(-60, 60), vy: rand(-120, 120), vz: rand(150, 420),
        g: 1000, bounce: 0.3, drag: 0.5, life: rand(2.4, 3.6), size: rand(3, 7),
        color: pick(['#ffd23f', '#ffe066', '#b8111f', '#8a0b16', '#fff3c4']), rot: rand(6.28), rotV: rand(-18, 18),
      });
    }
    for (let i = 0; i < 18; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-140, 140) + dir * 60, vy: rand(-90, 90), vz: rand(120, 300),
        g: 240, drag: 2.2, life: rand(1.4, 2.2), size: rand(4, 7),
        color: pick(['#fff8d6', '#ffe066', '#c7162a', '#e8b3b3']), rotV: rand(-8, 8),
      });
    }
    splat(x, y, 20);
    splat(x + dir * 22, y, 11, 2.4, dir);
    lensSplat(randInt(5, 8));
  }

  function scorch(x, y) { // singed feathers + smoke when the chick is caught in a violent blast
    for (let i = 0; i < 10; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-120, 120), vy: rand(-80, 80), vz: rand(100, 240), g: 240, drag: 2.2,
        life: rand(1, 1.6), size: rand(4, 6), color: pick(['#3a3430', '#5b534c', '#2a2522']), rotV: rand(-8, 8),
      });
    }
  }

  function puff(x, y, z) {
    spawn('smoke', x + rand(-6, 6), y + rand(-4, 4), z, {
      vz: rand(30, 55), g: -10, drag: 1, life: rand(0.8, 1.3), size: rand(3, 5), size2: rand(10, 16),
      color: '#3a3a40', alpha: 0.6,
    });
  }

  // ---- Small effects ----------------------------------------------------------
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
    spawn, update, reset, draw, drawDecals, drawPools, drawBlasts, drawTexts, drawLens, drawFlash,
    sparks, carCrash, carCrashViolent, secondaryBlast, wreckFire, wreckSmoke,
    splat, track, lensSplat, roadkill, scorch, puff,
    dust, pickup, coin, feathers, ice, shieldBreak, text, flashScreen,
    get count() { return live.length; },
  };
})();
