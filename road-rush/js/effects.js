'use strict';
// Visual effects: pooled particles, explosions, scorch and blood decals,
// burning fuel spills, water splashes and ripples, lasers, weather particles,
// floating text, lens splatter and full-screen flashes. Everything expires on its own.

const FX = (() => {
  const MAX = 1200;
  const free = [];
  const live = [];
  for (let i = 0; i < MAX; i++) free.push({});

  const blasts = [];
  const decals = [];      // scorch marks and craters
  const gore = [];        // blood splats, bloody/skid tyre tracks
  const bloodPools = [];  // big pools that cars drive through (graphic mode)
  const pools = [];       // burning fuel spills
  const ripples = [];     // rings on water
  const clouds = [];      // blood clouds drifting in rivers (graphic mode)
  const lasers = [];
  const lens = [];        // blood on the "camera lens" (graphic mode)
  const texts = [];
  const flash = { a: 0, rgb: '255,250,235' };
  const redPulse = { a: 0 };
  const sky = { drops: [], flakes: [] };

  const FIRE = ['#fffbe0', '#ffe27a', '#ffc04a', '#ff8a2a', '#f0531c', '#9a2f18'];
  const BLOOD = ['#9e0b1a', '#b8111f', '#7a0612', '#c7162a'];
  const BLOOD_DECAL = ['#7d0612', '#930a18', '#6a0510'];
  const ADDITIVE = { fire: true, spark: true, glow: true };
  const COSMETIC = { smoke: true, fire: true, spark: true, dust: true, glow: true, confetti: true };
  let quality = 1; // lowered automatically when the frame rate drops

  // ---- Pool -----------------------------------------------------------------
  function spawn(kind, x, y, z, o) {
    if (quality < 1 && COSMETIC[kind] && Math.random() > quality) return null;
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
    p.bleed = o.bleed || false;
    p.part = o.part || null;
    p.landed = false;
    live.push(p);
    return p;
  }

  const groundZ = y => {
    const r = World.rows.get(Math.round(y / TILE));
    return r && r.type === 'grass' ? 4 : 0;
  };
  const isWater = y => {
    const r = World.rows.get(Math.round(y / TILE));
    return !!(r && (r.type === 'river' || (r.type === 'road' && r.flood)));
  };

  function update(dt) {
    const gs = Events.gravity;
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
      p.vz -= p.g * (p.g > 0 ? gs : 1) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotV * dt;
      if (p.trail && Math.random() < dt * 28) {
        spawn('fire', p.x, p.y, p.z + 3, { vz: 25, g: -30, life: rand(0.25, 0.45), size: rand(4, 7), size2: 1 });
      }
      if (p.bleed && p.z > 2 && Math.random() < dt * 24) {
        spawn('blood', p.x, p.y, p.z, { vx: p.vx * 0.3, vy: p.vy * 0.3, vz: 0, g: 950, life: 2, size: rand(1.4, 2.6), color: pick(BLOOD) });
      }
      if (p.g > 0 && p.z < 0) {
        p.z = 0;
        if (p.kind === 'blood') { // droplets become splats where they land
          if (isWater(p.y)) cloud(p.x, p.y, p.size * 2, 0);
          else splat(p.x, p.y, p.size * rand(1.2, 2.3));
          p.life = 0;
          continue;
        }
        if (!p.landed && (p.kind === 'gib' || p.kind === 'part') && !isWater(p.y)) splat(p.x, p.y, rand(3, 7));
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
    for (let i = gore.length - 1; i >= 0; i--) {
      const d = gore[i];
      d.t += dt;
      if (d.grow && d.t < d.grow) d.r = d.r0 + (d.r1 - d.r0) * easeOutCubic(d.t / d.grow);
      if (d.t > d.life) gore.splice(i, 1);
    }
    for (let i = bloodPools.length - 1; i >= 0; i--) if ((bloodPools[i].t += dt) > 20) bloodPools.splice(i, 1);
    for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].t += dt) > ripples[i].life) ripples.splice(i, 1);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.t += dt;
      c.x += c.vx * dt;
      c.r = Math.min(c.maxR, c.r + dt * 14);
      if (c.t > c.life) clouds.splice(i, 1);
    }
    for (let i = lasers.length - 1; i >= 0; i--) if ((lasers[i].t += dt) > lasers[i].life) lasers.splice(i, 1);
    for (let i = pools.length - 1; i >= 0; i--) {
      const f = pools[i];
      f.t += dt;
      if (f.t > f.life) { pools.splice(i, 1); continue; }
      f.r = f.maxR * easeOutCubic(Math.min(1, f.t / 0.9));
      const strength = 1 - smoothstep(f.life - 2, f.life, f.t);
      for (let n = dt * 50 * strength * (f.stretch || 1); n > 0; n--) {
        if (Math.random() > n) break;
        const a = rand(6.2832), d = Math.sqrt(Math.random()) * f.r;
        spawn('fire', f.x + Math.cos(a) * d * (f.stretch || 1), f.y + Math.sin(a) * d * 0.8, 2, {
          vz: rand(30, 80), g: -40, drag: 1, life: rand(0.3, 0.7), size: rand(6, 12), size2: 1,
        });
      }
      if (Math.random() < dt * 6 * strength) {
        spawn('smoke', f.x + rand(-f.r, f.r) * 0.6 * (f.stretch || 1), f.y, 20, {
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
    redPulse.a = Math.max(0, redPulse.a - dt * 0.8);
  }

  function reset() {
    while (live.length) free.push(live.pop());
    for (const a of [blasts, decals, gore, bloodPools, pools, ripples, clouds, lasers, lens, texts]) a.length = 0;
    flash.a = 0;
    redPulse.a = 0;
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
        case 'drop':
          c.globalAlpha = p.kind === 'drop' ? 0.8 * fade : 1;
          c.fillStyle = p.color;
          if (sz < 2.6) { c.fillRect(p.x - sz, py - sz, sz * 2, sz * 2); break; } // cheap for tiny droplets
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
        case 'part': // body parts in graphic mode: cartoon blocks with a bloody end
          c.globalAlpha = fade;
          c.save();
          c.translate(p.x, py);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          c.fillRect(-sz / 2, -sz / 2, sz, sz);
          c.fillStyle = '#9e0b1a';
          c.fillRect(-sz / 2, sz * 0.15, sz, sz * 0.35);
          if (p.part === 'head') {
            c.fillStyle = '#1d1d1f';
            c.fillRect(sz * 0.05, -sz * 0.3, sz * 0.22, sz * 0.22);
            c.fillStyle = '#ff6b6b';
            c.fillRect(-sz * 0.2, -sz * 0.75, sz * 0.4, sz * 0.25);
          } else if (p.part === 'foot') {
            c.fillStyle = '#ff9f1c';
            c.fillRect(-sz * 0.6, -sz * 0.2, sz * 1.2, sz * 0.3);
          }
          c.restore();
          break;
        default: // debris, shard, confetti, feather, gib, rock
          c.globalAlpha = p.alpha * fade;
          c.fillStyle = p.color;
          if (sz < 6) { // too small for rotation to show: skip the transform
            const w = sz * (0.6 + 0.4 * Math.abs(Math.cos(p.rot)));
            c.fillRect(p.x - w / 2, py - sz * 0.3, w, sz * 0.6);
            break;
          }
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
    for (const l of lasers) {
      const a = 1 - l.t / l.life;
      c.globalAlpha = a;
      c.strokeStyle = '#ff3b6b';
      c.lineWidth = 7 * a + 2;
      c.beginPath();
      c.moveTo(l.x1, P(l.y1, l.z1));
      c.lineTo(l.x2, P(l.y2, 4));
      c.stroke();
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  function drawDecals(c) {
    const y0 = Renderer.yBot - TILE, y1 = Renderer.yTop;
    for (const d of decals) {
      if (d.y < y0 || d.y > y1) continue;
      const a = (d.a || 0.5) * Math.min(1, (d.life - d.t) / 3);
      c.fillStyle = `rgba(22,18,16,${a})`;
      c.beginPath();
      c.ellipse(d.x, P(d.y, d.z || 0), d.r, d.r * GY * 0.55, 0, 0, 6.2832);
      c.fill();
      c.fillStyle = `rgba(10,8,8,${a})`;
      c.beginPath();
      c.ellipse(d.x, P(d.y, d.z || 0), d.r * 0.5, d.r * GY * 0.28, 0, 0, 6.2832);
      c.fill();
    }
    for (const d of gore) {
      if (d.y < y0 || d.y > y1) continue;
      c.globalAlpha = d.a * Math.min(1, (d.life - d.t) / 4);
      c.fillStyle = d.color;
      if (d.track) {
        c.fillRect(d.x - (d.len || 10) / 2, P(d.y + 8, d.z) - 1, d.len || 10, 2.4);
        c.fillRect(d.x - (d.len || 10) / 2, P(d.y - 7, d.z) - 1, d.len || 10, 2.4);
        continue;
      }
      const cy = P(d.y, d.z);
      c.beginPath();
      c.ellipse(d.x + d.dir * d.stretch * d.r * 0.6, cy, d.r * (1 + d.stretch), d.r * GY * 0.75, 0, 0, 6.2832);
      c.fill();
      for (const [dx, dy, r] of d.dots) {
        c.beginPath();
        c.arc(d.x + dx * d.r / d.r1, cy + dy * GY * d.r / d.r1, r, 0, 6.2832);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    for (const r of ripples) {
      const k = r.t / r.life;
      c.strokeStyle = r.red ? `rgba(170,20,35,${0.7 * (1 - k)})` : `rgba(255,255,255,${0.6 * (1 - k)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(r.x, P(r.y, 0), r.r * (0.3 + k), r.r * (0.3 + k) * GY * 0.7, 0, 0, 6.2832);
      c.stroke();
    }
    for (const b of clouds) {
      const a = 0.55 * Math.min(1, (b.life - b.t) / 3);
      c.fillStyle = `rgba(150,12,28,${a})`;
      c.beginPath();
      c.ellipse(b.x, P(b.y, 0), b.r, b.r * GY * 0.6, 0, 0, 6.2832);
      c.fill();
    }
  }

  function drawPools(c) {
    if (!pools.length) return;
    c.globalCompositeOperation = 'lighter';
    for (const f of pools) {
      const a = 1 - smoothstep(f.life - 2, f.life, f.t);
      const cy = P(f.y, 0), s = f.stretch || 1;
      const r = f.r * 1.4 + 1;
      c.save();
      c.translate(f.x, cy);
      c.scale(s, 1);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255,150,40,${0.55 * a})`);
      g.addColorStop(0.6, `rgba(255,90,20,${0.3 * a})`);
      g.addColorStop(1, 'rgba(255,60,10,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r, r * GY, 0, 0, 6.2832);
      c.fill();
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawBlasts(c) {
    c.globalCompositeOperation = 'lighter';
    for (const b of blasts) {
      const t = b.t;
      if (t < 0) continue; // delayed follow-up blast
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
    for (const b of blasts) {
      if (b.t < 0 || b.t >= 0.45) continue;
      const k = b.t / 0.45;
      const r = 3.8 * TILE * b.power * easeOutCubic(k);
      c.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
      c.lineWidth = 2 + 7 * (1 - k) * Math.min(2, b.power);
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

  // ---- Screen space (identity transform) ----------------------------------------
  function drawWeather(c, W, H, type, amt, dt) {
    if (amt < 0.02) return;
    if (type === 'rain') {
      c.fillStyle = `rgba(40,60,90,${0.18 * amt})`;
      c.fillRect(0, 0, W, H);
      const want = Math.round(160 * amt);
      while (sky.drops.length < want) sky.drops.push({ x: rand(W), y: rand(-H, H), len: rand(12, 24), v: rand(700, 1000) });
      if (sky.drops.length > want) sky.drops.length = want;
      c.strokeStyle = 'rgba(200,220,255,0.45)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (const d of sky.drops) {
        d.y += d.v * dt;
        d.x -= d.v * 0.18 * dt;
        if (d.y > H) { d.y = rand(-40, 0); d.x = rand(W * 1.2); }
        c.moveTo(d.x, d.y);
        c.lineTo(d.x + d.len * 0.18, d.y - d.len);
      }
      c.stroke();
    } else if (type === 'dust') {
      // a dust storm: heavy haze further up the screen hides the road ahead
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(196,150,92,${0.78 * amt})`);
      g.addColorStop(0.45, `rgba(205,165,105,${0.42 * amt})`);
      g.addColorStop(1, `rgba(210,175,120,${0.12 * amt})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      const want = Math.round(120 * amt);
      while (sky.drops.length < want) sky.drops.push({ x: rand(W), y: rand(H), len: rand(20, 60), v: rand(500, 900) });
      if (sky.drops.length > want) sky.drops.length = want;
      c.strokeStyle = 'rgba(235,205,150,0.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      for (const d of sky.drops) {
        d.x += d.v * dt;
        d.y += d.v * 0.06 * dt;
        if (d.x > W + 60) { d.x = rand(-80, -10); d.y = rand(H); }
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - d.len, d.y - d.len * 0.06);
      }
      c.stroke();
    } else if (type === 'snow') {
      c.fillStyle = `rgba(220,235,255,${0.12 * amt})`;
      c.fillRect(0, 0, W, H);
      const want = Math.round(150 * amt);
      while (sky.flakes.length < want) sky.flakes.push({ x: rand(W), y: rand(-H, H), r: rand(1.2, 3.2), v: rand(40, 90), ph: rand(6.28) });
      if (sky.flakes.length > want) sky.flakes.length = want;
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      for (const f of sky.flakes) {
        f.y += f.v * dt;
        f.ph += dt * 1.5;
        f.x += Math.sin(f.ph) * 20 * dt;
        if (f.y > H) { f.y = rand(-20, 0); f.x = rand(W); }
        c.moveTo(f.x + f.r, f.y);
        c.arc(f.x, f.y, f.r, 0, 6.2832);
      }
      c.fill();
    }
  }

  function drawLens(c, W, H) {
    if (redPulse.a > 0.01) {
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(150,0,15,${0.6 * redPulse.a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
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
    for (let i = 0; i < 24 * k; i++) {
      const a = rand(6.2832), s = rand(60, 290) * Math.sqrt(k);
      spawn('debris', x + rand(-10, 10), y + rand(-6, 6), rand(10, 24), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(160, 430) * Math.sqrt(k),
        g: 1000, bounce: 0.35, drag: 0.6, life: rand(1.6, 2.8), size: rand(4, 9),
        color: chance(0.45) ? pick(colors) : pick(['#2a2a2e', '#4a4a50', '#77777f', '#b8c4d6']),
        rot: rand(6.28), rotV: rand(-14, 14),
      });
    }
    for (let i = 0; i < 32 * k; i++) {
      const a = rand(6.2832), s = rand(10, 120) * k;
      spawn('fire', x + rand(-14, 14) * k, y + rand(-8, 8) * k, rand(6, 26), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 150) * k,
        g: -60, drag: 2, life: rand(0.35, 0.9) * Math.sqrt(k), size: rand(12, 24) * Math.sqrt(k), size2: 3,
      });
    }
    for (let i = 0; i < 26 * k; i++) {
      const a = rand(6.2832), s = rand(10, 70) * k;
      spawn('smoke', x + rand(-16, 16), y + rand(-8, 8), rand(10, 30), {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(20, 70) * k,
        g: -20, drag: 1, life: rand(1.6, 3.2) * Math.sqrt(k), size: rand(10, 18), size2: rand(34, 56) * Math.sqrt(k),
        color: k > 1 ? pick(['#1f1f22', '#2d2d31', '#3b3b40']) : pick(['#3b3b40', '#505057', '#66666e']), alpha: 0.7,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * 6.2832;
      spawn('dust', x, y, 3, {
        vx: Math.cos(a) * 260 * k, vy: Math.sin(a) * 200 * k, drag: 3.5,
        life: 0.7, size: 8, size2: 22 * k, color: '#d8ccb4', alpha: 0.6,
      });
    }
  }

  function scorchMark(x, y, r, life = 14, a = 0.5) {
    decals.push({ x, y, r, t: 0, life, a, z: groundZ(y) });
    if (decals.length > 16) decals.shift();
  }

  function carCrash(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 1 });
    scorchMark(x, y, 1.4 * TILE);
    sparks(x, y, 18, 46, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff'], 520);
    burst(x, y, colors, 1);
    spawn('glow', x, y, 18, { life: 0.25, size: 60, size2: 95, color: '#fff2c0', alpha: 0.9 });
  }

  function parts(x, y, colors, n, speed = 1) {
    for (let i = 0; i < 4 * n; i++) {
      spawn('wheel', x + rand(-10, 10), y + rand(-6, 6), 14, {
        vx: rand(-340, 340) * speed, vy: rand(-170, 170) * speed, vz: rand(300, 540) * speed, g: 1000, bounce: 0.5, drag: 0.35,
        life: rand(2.8, 4), size: rand(10, 13), rotV: rand(-22, 22), trail: chance(0.5),
      });
    }
    for (let i = 0; i < 9 * n; i++) {
      spawn('panel', x + rand(-12, 12), y + rand(-6, 6), 16, {
        vx: rand(-300, 300) * speed, vy: rand(-160, 160) * speed, vz: rand(260, 520) * speed, g: 1000, bounce: 0.3, drag: 0.4,
        life: rand(2.6, 3.8), size: rand(10, 18), color: pick(colors), rot: rand(6.28), rotV: rand(-16, 16), trail: chance(0.4),
      });
    }
    for (let i = 0; i < 28 * n; i++) {
      const a = rand(6.2832), s = rand(120, 380) * speed;
      spawn('shard', x, y, 20, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(120, 320), g: 900, drag: 0.8,
        life: rand(0.8, 1.4), size: rand(3, 6), color: pick(['#cfe9ff', '#9fc9ea', '#ffffff']), rotV: rand(-18, 18), alpha: 0.85,
      });
    }
  }

  // Burning debris raining back down after a big blast.
  function debrisRain(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      spawn('debris', x + rand(-spread, spread), y + rand(-spread, spread) * 0.6, rand(160, 320), {
        vx: rand(-40, 40), vy: rand(-30, 30), vz: rand(-40, 60), g: 700, bounce: 0.25, drag: 0.3,
        life: rand(2, 3), size: rand(4, 8), color: pick(['#2a2a2e', '#4a4a50', '#8b3a2b']), rotV: rand(-10, 10), trail: true,
      });
    }
  }

  // Graphic mode: a much bigger, messier blast.
  function carCrashViolent(x, y, colors) {
    blasts.push({ x, y, t: 0, power: 1.75 });
    scorchMark(x, y, 2.4 * TILE, 22, 0.6);
    sparks(x, y, 18, 110, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff', '#ff8a2a'], 760);
    burst(x, y, colors, 1.9);
    parts(x, y, colors, 1);
    debrisRain(x, y, 14, 2 * TILE);
    pools.push({ x, y, r: 0, maxR: 1.8 * TILE, t: 0, life: 7 });
    if (pools.length > 5) pools.shift();
    spawn('glow', x, y, 18, { life: 0.35, size: 90, size2: 150, color: '#fff2c0', alpha: 1 });
  }

  // A wreck's fuel tank going up a moment after the crash.
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

  // Tanker truck: a huge fireball, a mushroom of smoke and burning fuel along the lane.
  function tankerBlast(x, y, colors, gore) {
    const k = gore ? 1.4 : 1;
    blasts.push({ x, y, t: 0, power: 2.4 * k });
    blasts.push({ x: x + rand(-20, 20), y, t: -0.12, power: 1.6 * k });
    scorchMark(x, y, 3.2 * TILE * k, 30, 0.7);
    sparks(x, y, 20, 140, ['#fff3b0', '#ffd166', '#ffb703', '#ffffff', '#ff8a2a'], 900);
    burst(x, y, colors, 2.4 * k);
    parts(x, y, colors, gore ? 1.5 : 1, 1.2);
    debrisRain(x, y, gore ? 30 : 18, 3 * TILE);
    for (let i = 0; i < 40; i++) { // mushroom column
      spawn('smoke', x + rand(-20, 20), y + rand(-10, 10), rand(20, 80), {
        vz: rand(90, 170), g: -10, drag: 0.5, life: rand(3, 5), size: rand(14, 22), size2: rand(60, 90),
        color: pick(['#1a1a1d', '#26262a', '#333338']), alpha: 0.75,
      });
    }
    pools.push({ x, y, r: 0, maxR: 1.6 * TILE, t: 0, life: gore ? 12 : 9, stretch: gore ? 3.2 : 2.2 });
    if (pools.length > 5) pools.shift();
    spawn('glow', x, y, 20, { life: 0.5, size: 140, size2: 240, color: '#fff2c0', alpha: 1 });
  }

  // A train ploughing through a stalled car.
  function trainCrash(x, y, colors, gore) {
    blasts.push({ x, y, t: 0, power: gore ? 2.2 : 1.6 });
    scorchMark(x, y, 2 * TILE, 18, 0.55);
    sparks(x, y, 16, gore ? 160 : 90, ['#fff3b0', '#ffd166', '#ffffff'], 900);
    burst(x, y, colors, gore ? 2 : 1.3);
    parts(x, y, colors, gore ? 1.4 : 0.8, 1.3);
    if (gore) debrisRain(x, y, 20, 2.5 * TILE);
    spawn('glow', x, y, 18, { life: 0.35, size: 100, size2: 170, color: '#fff2c0', alpha: 1 });
  }

  function meteorImpact(x, y, gore) {
    blasts.push({ x, y, t: 0, power: gore ? 2.6 : 2.1 });
    scorchMark(x, y, 2.2 * TILE, 40, 0.8);
    sparks(x, y, 10, 120, ['#fff3b0', '#ffd166', '#ff8a2a', '#ffffff'], 800);
    burst(x, y, ['#5b4a3f', '#3b302a', '#8a7a6a'], 2);
    for (let i = 0; i < 40; i++) { // rock and dirt
      const a = rand(6.2832), s = rand(80, 360);
      spawn('debris', x, y, 6, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(200, 520), g: 1000, bounce: 0.3, drag: 0.5,
        life: rand(1.6, 2.8), size: rand(5, 11), color: pick(['#5b4a3f', '#3b302a', '#7a6a5a', '#2a2420']), rotV: rand(-12, 12), trail: chance(0.25),
      });
    }
    if (gore) debrisRain(x, y, 24, 3 * TILE);
    pools.push({ x, y, r: 0, maxR: 1.3 * TILE, t: 0, life: 6 });
    if (pools.length > 5) pools.shift();
    spawn('glow', x, y, 10, { life: 0.4, size: 110, size2: 190, color: '#fff2c0', alpha: 1 });
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

  function laser(x1, y1, z1, x2, y2) {
    lasers.push({ x1, y1, z1, x2, y2, t: 0, life: 0.35 });
  }

  // ---- Water -----------------------------------------------------------------
  function ripple(x, y, r = 22, red = false) {
    ripples.push({ x, y, r, t: 0, life: 0.9, red });
    if (ripples.length > 40) ripples.shift();
  }

  function splash(x, y, n = 18, red = false) {
    for (let i = 0; i < n; i++) {
      const a = rand(6.2832), s = rand(40, 170);
      spawn('drop', x, y, 4, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(120, 300), g: 900, drag: 0.8,
        life: rand(0.5, 0.9), size: rand(1.5, 3.2), color: red ? pick(BLOOD) : pick(['#dff4ff', '#ffffff', '#a8dcff']),
      });
    }
    ripple(x, y, 26, red);
    ripple(x, y, 14, red);
  }

  function bubbles(x, y) {
    spawn('drop', x + rand(-8, 8), y + rand(-5, 5), 0, { vz: rand(20, 40), life: 0.5, size: rand(1.5, 3), color: '#e6f6ff' });
  }

  // ---- Blood (graphic mode only) --------------------------------------------
  function splat(x, y, r, stretch = 0, dir = 1, grow = 0) {
    const dots = [];
    const n = r > 8 ? randInt(4, 9) : randInt(0, 2);
    for (let i = 0; i < n; i++) {
      const a = rand(6.2832), d = r * rand(0.9, 1.9);
      dots.push([Math.cos(a) * d + dir * stretch * r * 0.6, Math.sin(a) * d * 0.8, r * rand(0.12, 0.4)]);
    }
    const r0 = grow ? r * 0.35 : r;
    gore.push({ x, y, z: groundZ(y), r: r0, r0: r, r1: r, dots, stretch, dir, t: 0, life: 34, a: rand(0.82, 0.95), color: pick(BLOOD_DECAL), grow });
    if (grow) gore[gore.length - 1].r0 = r0;
    if (gore.length > 280) gore.shift();
  }

  // A big pool that spreads; cars that drive through it get bloody tyres.
  function pool(x, y, r) {
    splat(x, y, r, 0, 1, 1.4);
    bloodPools.push({ x, y, r, t: 0 });
    if (bloodPools.length > 8) bloodPools.shift();
  }

  function track(x, y, a, color = '#7d0612', len = 10) {
    gore.push({ track: true, x, y, z: groundZ(y), t: 0, life: 12, a: 0.85 * a, color, dots: null, len });
    if (gore.length > 280) gore.shift();
  }

  function cloud(x, y, r, vx) {
    const row = World.rows.get(Math.round(y / TILE));
    const drift = row && row.type === 'river' ? row.river.dir * row.river.speed : 0;
    clouds.push({ x, y, r: r * 0.4, maxR: r, vx: vx || drift, t: 0, life: 9 });
    if (clouds.length > 40) clouds.shift();
  }

  function lensSplat(n) {
    for (let i = 0; i < n; i++) {
      const r = rand(14, 62), dots = [];
      for (let k = randInt(2, 6); k > 0; k--) {
        const a = rand(6.2832), d = r * rand(1.1, 2);
        dots.push([Math.cos(a) * d, Math.sin(a) * d, r * rand(0.1, 0.3)]);
      }
      lens.push({ x: rand(0.05, 0.95), y: rand(0.05, 0.7), r, dots, drip: chance(0.7) ? rand(18, 60) : 0, len: 0, t: 0, life: rand(2.6, 4) });
    }
    redPulse.a = 1;
  }

  function spray(x, y, z, dir, n, speed = 1) {
    for (let i = 0; i < n; i++) {
      const fwd = chance(0.75) ? 1 : -0.35;
      spawn('blood', x + rand(-6, 6), y + rand(-5, 5), z + rand(0, 12), {
        vx: dir * rand(60, 460) * fwd * speed + rand(-80, 80), vy: rand(-160, 160), vz: rand(40, 380),
        g: 950, drag: 0.5, life: 3, size: rand(1.6, 4.4), color: pick(BLOOD),
      });
    }
  }

  // Cartoon body parts: chunks in the skin's colours plus a head, feet and wings.
  function bodyParts(x, y, dir, skin, n, speed = 1) {
    const cols = [skin.top, skin.front, '#b8111f', '#8a0b16', '#6a0510'];
    for (let i = 0; i < n; i++) {
      spawn('gib', x, y, rand(6, 16), {
        vx: (dir * rand(40, 340) + rand(-70, 70)) * speed, vy: rand(-130, 130) * speed, vz: rand(150, 440),
        g: 1000, bounce: 0.3, drag: 0.5, life: rand(2.6, 3.8), size: rand(3, 8),
        color: pick(cols), rot: rand(6.28), rotV: rand(-18, 18), bleed: chance(0.35),
      });
    }
    const named = [['head', skin.top, 9], ['foot', skin.feet, 6], ['foot', skin.feet, 6], ['wing', skin.front, 8], ['wing', skin.front, 8]];
    for (const [part, color, size] of named) {
      spawn('part', x, y, 12, {
        vx: (dir * rand(80, 380) + rand(-90, 90)) * speed, vy: rand(-140, 140) * speed, vz: rand(220, 480),
        g: 1000, bounce: 0.35, drag: 0.4, life: rand(3.5, 5), size, color, part, rot: rand(6.28), rotV: rand(-14, 14), bleed: true,
      });
    }
  }

  function mist(x, y, dir, n) {
    for (let i = 0; i < n; i++) {
      spawn('smoke', x, y, rand(6, 18), {
        vx: dir * rand(20, 140), vy: rand(-40, 40), vz: rand(10, 60), drag: 2,
        life: rand(0.4, 0.9), size: rand(5, 9), size2: rand(18, 32), color: '#a0101f', alpha: 0.55,
      });
    }
  }

  // Run over by a car.
  function roadkill(x, y, dir, skin) {
    spray(x, y, 4, dir, 230);
    mist(x, y, dir, 14);
    bodyParts(x, y, dir, skin, 26);
    for (let i = 0; i < 16; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-140, 140) + dir * 60, vy: rand(-90, 90), vz: rand(120, 300),
        g: 240, drag: 2.2, life: rand(1.6, 2.4), size: rand(4, 7), color: pick([skin.top, skin.front, '#c7162a', '#e8b3b3']), rotV: rand(-8, 8),
      });
    }
    pool(x, y, 24);
    splat(x + dir * 24, y, 12, 2.6, dir);
    splat(x + dir * 56, y, 8, 3.2, dir);
    lensSplat(randInt(8, 12));
  }

  // Hit by a train: nothing much is left.
  function trainRoadkill(x, y, dir, skin) {
    spray(x, y, 8, dir, 320, 1.8);
    mist(x, y, dir, 22);
    bodyParts(x, y, dir, skin, 34, 1.8);
    pool(x, y, 18);
    for (let k = 1; k <= 6; k++) splat(x + dir * k * 34, y + rand(-6, 6), rand(9, 15), rand(1.5, 3), dir);
    lensSplat(randInt(12, 16));
  }

  // Crushed by something enormous (the giant chicken).
  function crushed(x, y, skin) {
    spray(x, y, 2, 1, 120);
    spray(x, y, 2, -1, 120);
    mist(x, y, 1, 10);
    bodyParts(x, y, chance(0.5) ? 1 : -1, skin, 20, 0.8);
    pool(x, y, 30);
    lensSplat(randInt(8, 12));
  }

  // River death in graphic mode.
  function piranhas(x, y, skin) {
    splash(x, y, 30, true);
    for (let i = 0; i < 5; i++) cloud(x + rand(-12, 12), y + rand(-6, 6), rand(24, 40));
    bodyParts(x, y, chance(0.5) ? 1 : -1, skin, 10, 0.5);
    spray(x, y, 6, 1, 60, 0.5);
    spray(x, y, 6, -1, 60, 0.5);
    lensSplat(randInt(4, 6));
  }

  // Graphic mode: bleeding a little after being blasted (never lethal).
  function bleed(x, y, n = 20) {
    spray(x, y, 12, chance(0.5) ? 1 : -1, n, 0.4);
    splat(x, y, rand(5, 8));
  }

  function scorch(x, y) { // singed feathers + smoke when the chick is caught in a violent blast
    for (let i = 0; i < 10; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-120, 120), vy: rand(-80, 80), vz: rand(100, 240), g: 240, drag: 2.2,
        life: rand(1, 1.6), size: rand(4, 6), color: pick(['#3a3430', '#5b534c', '#2a2522']), rotV: rand(-8, 8),
      });
    }
  }

  function puff(x, y, z, color = '#3a3a40') {
    spawn('smoke', x + rand(-6, 6), y + rand(-4, 4), z, {
      vz: rand(30, 55), g: -10, drag: 1, life: rand(0.8, 1.3), size: rand(3, 5), size2: rand(10, 16),
      color, alpha: 0.6,
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

  function feathers(x, y, skin) {
    for (let i = 0; i < 16; i++) {
      spawn('feather', x, y, 16, {
        vx: rand(-120, 120), vy: rand(-80, 80), vz: rand(120, 280),
        g: 260, drag: 2.2, life: rand(1, 1.6), size: rand(4, 7),
        color: pick([skin.top, skin.front, '#ffffff']), rotV: rand(-8, 8),
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
    if (Settings.motion) a *= 0.35;
    if (a >= flash.a) { flash.a = a; flash.rgb = rgb; }
  }


  // Graphic mode: a car ploughs through a cow.
  function beef(x, y) {
    spray(x, y, 14, 1, 160, 1.2);
    spray(x, y, 14, -1, 160, 1.2);
    mist(x, y, 1, 12);
    for (let i = 0; i < 22; i++) {
      spawn('gib', x, y, 18, {
        vx: rand(-220, 220), vy: rand(-120, 120), vz: rand(120, 360), g: 700, drag: 0.6, bounce: 0.3,
        life: rand(1.6, 2.6), size: rand(5, 10), color: pick(['#f4f1ea', '#2b2522', '#c7162a', '#e8a0a0', '#9e0b1a']),
        rotV: rand(-12, 12), bleed: chance(0.5),
      });
    }
    pool(x, y, 26);
    splat(x + 20, y, 12, 2, 1);
    splat(x - 20, y, 12, 2, -1);
  }

  // Graphic mode: whacked by an excavator bucket.
  function whack(x, y, dir) {
    spray(x, y, 16, dir, 90, 0.8);
    splat(x + dir * 10, y, rand(6, 9), 1.5, dir);
  }

  // Cosmetic trail left behind on every hop.
  function hopTrail(x, y, kind) {
    if (kind === 'sparkle') {
      for (let i = 0; i < 4; i++) spawn('glow', x + rand(-8, 8), y + rand(-5, 5), rand(6, 22), { vz: rand(10, 40), drag: 2, life: rand(0.5, 0.8), size: rand(2, 3.4), size2: 0.5, color: pick(['#fff6b0', '#ffffff', '#ffd84d']) });
    } else if (kind === 'fire') {
      for (let i = 0; i < 6; i++) spawn('fire', x + rand(-7, 7), y + rand(-4, 4), rand(2, 8), { vz: rand(30, 70), g: -30, drag: 1, life: rand(0.3, 0.55), size: rand(4, 7), size2: 1 });
    } else if (kind === 'rainbow') {
      const h = (performance.now() / 4) % 360;
      for (let i = 0; i < 5; i++) spawn('glow', x + rand(-6, 6), y + rand(-4, 4), rand(4, 14), { vz: rand(5, 20), drag: 2, life: rand(0.6, 0.9), size: 4, size2: 1, color: `hsl(${(h + i * 50) % 360},95%,65%)` });
    } else if (kind === 'bubbles') {
      for (let i = 0; i < 3; i++) spawn('smoke', x + rand(-8, 8), y + rand(-4, 4), rand(6, 16), { vz: rand(20, 45), g: -10, drag: 1, life: rand(0.7, 1.1), size: rand(2, 3), size2: rand(4, 6), color: '#bfe8ff', alpha: 0.7 });
    } else if (kind === 'confetti') {
      for (let i = 0; i < 6; i++) spawn('confetti', x, y, 14, { vx: rand(-70, 70), vy: rand(-40, 40), vz: rand(90, 170), g: 520, drag: 1.2, life: rand(0.7, 1.1), size: rand(3, 5), color: pick(['#ff5c8a', '#ffd23f', '#34c6ea', '#7ed957', '#a95cff']), rotV: rand(-12, 12) });
    }
  }

  // Tumbleweed breaks apart.
  function twigs(x, y) {
    for (let i = 0; i < 14; i++) {
      spawn('debris', x, y, 10, { vx: rand(-120, 120), vy: rand(-70, 70), vz: rand(60, 180), g: 500, drag: 1.4, life: rand(0.6, 1.1), size: rand(3, 6), color: pick(['#b08a55', '#8c6a3c', '#caa46a']), rotV: rand(-12, 12) });
    }
  }

  // Light sources for the night-time lighting pass.
  function lights(fn) {
    for (const b of blasts) if (b.t >= 0 && b.t < 1.1) fn(b.x, b.y, 4 * TILE * b.power * (1 - b.t / 1.1), 'fire');
    for (const f of pools) if (f.t < f.life - 1) fn(f.x, f.y, f.r * 2.2 + TILE, 'fire');
  }

  return {
    spawn, update, reset, draw, drawDecals, drawPools, drawBlasts, drawTexts, drawWeather, drawLens, drawFlash,
    sparks, carCrash, carCrashViolent, secondaryBlast, tankerBlast, trainCrash, meteorImpact, debrisRain, scorchMark,
    wreckFire, wreckSmoke, laser, ripple, splash, bubbles,
    splat, pool, track, cloud, lensSplat, roadkill, trainRoadkill, crushed, piranhas, bleed, scorch, puff,
    dust, pickup, coin, feathers, ice, shieldBreak, text, flashScreen, beef, whack, hopTrail, twigs, lights,
    bloodPools,
    get count() { return live.length; },
    get quality() { return quality; },
    set quality(q) { quality = clamp(q, 0.35, 1); },
  };
})();
