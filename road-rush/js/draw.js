'use strict';
// Low-poly "2.5D" drawing primitives and sprites.
// Everything is drawn in projected world units around a local origin at an
// object's ground centre: x is world x, screen y is P(y, z).

const Draw = (() => {
  const LANE_D = 0.72 * TILE; // vehicle depth (across the lane)
  let shadowImg = null;

  // A box with a lit top face and a shaded front face.
  function box(c, x0, x1, y0, y1, z0, z1, top, front) {
    const yt = P(y1, z1), yb = P(y0, z1);
    c.fillStyle = top;
    c.fillRect(x0, yt, x1 - x0, yb - yt);
    c.fillStyle = front;
    c.fillRect(x0, yb, x1 - x0, P(y0, z0) - yb);
  }

  function poly(c, x, y, r, pts) {
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(x + px * r, y + py * r) : c.moveTo(x + px * r, y + py * r)));
    c.closePath();
  }

  function starPath(c, x, y, R, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }

  // ---- Shadows -------------------------------------------------------------
  function makeShadow() {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.24)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return s;
  }

  // Absolute world coordinates. Light comes from the upper left.
  function shadow(c, x, y, w, d, a = 1) {
    if (!shadowImg) shadowImg = makeShadow();
    c.globalAlpha = a;
    c.drawImage(shadowImg, x - w / 2 + 4, P(y + d / 2 - 3, 0), w, d * GY);
    c.globalAlpha = 1;
  }

  // ---- Vehicles ------------------------------------------------------------
  function vehiclePalette(base) {
    return {
      top: shade(base, 0.14), front: shade(base, -0.2), dark: shade(base, -0.45),
      roof: shade(base, 0.26), glass: '#27354d', glassTop: '#4a6a93', lit: true,
    };
  }

  function wreckPalette(base) {
    const b = mix(base, '#2b2522', 0.72);
    return {
      top: shade(b, 0.08), front: shade(b, -0.25), dark: '#141212',
      roof: shade(b, 0.12), glass: '#111113', glassTop: '#1d1d20', lit: false,
    };
  }

  // Drawn facing +x; the renderer mirrors it for leftbound traffic.
  function vehicle(c, v, frost, time = 0) {
    const T = VEHICLE_TYPES[v.type];
    const L = v.len, hy = LANE_D / 2, pal = v.pal;
    const z0 = 4, zt = z0 + T.h * TILE;
    const fx = L / 2, bx = -L / 2;

    box(c, bx, fx, -hy, hy, z0, zt, pal.top, pal.front);
    c.fillStyle = pal.dark;
    c.fillRect(bx, P(-hy, z0 + 3), L, 3 * GZ);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(bx, P(hy, zt), L, 2);

    const cab = T.cab;
    if (v.type === 'bus') {
      const wz1 = zt - 5, wz0 = zt - 15;
      c.fillStyle = pal.glass;
      for (let x = bx + 8; x < fx - 18; x += 14) c.fillRect(x, P(-hy, wz1), 10, (wz1 - wz0) * GZ);
      c.fillRect(fx - 11, P(-hy, wz1), 9, (wz1 - wz0) * GZ);
      c.fillStyle = pal.roof;
      c.fillRect(bx + 6, P(hy - 5, zt), L - 12, (LANE_D - 10) * GY);
      c.fillStyle = pal.dark;
      c.fillRect(bx, P(-hy, z0 + 10), L, 3 * GZ);
    } else if (v.type === 'tanker') {
      // cab up front, a long rounded tank behind it
      const cx0 = fx - 0.26 * L;
      c.fillStyle = pal.dark;
      c.fillRect(bx, P(hy, zt), L, LANE_D * GY);
      box(c, bx + 2, cx0 - 3, -hy + 1, hy - 1, z0 + 4, zt + 4, '#eef1f4', '#b9bec6');
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(bx + 2, P(hy * 0.2, zt + 4), cx0 - bx - 5, 3 * GY);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(bx + 2, P(-hy + 1, z0 + 12), cx0 - bx - 5, 5 * GZ);
      if (pal.lit) { // flammable placard
        const px = (bx + cx0) / 2, py = P(-hy + 1, zt - 6);
        c.fillStyle = '#c8102e';
        poly(c, px, py, 7, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(px - 1, py - 3, 2, 5);
      }
      box(c, cx0, fx, -hy + 2, hy - 2, zt - 2, zt + 10, pal.roof, pal.front);
      c.fillStyle = pal.glass;
      c.fillRect(cx0 + 4, P(-hy + 2, zt + 8), fx - cx0 - 8, 8 * GZ);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 6, P(hy - 2, zt + 10), 5, (LANE_D - 4) * GY);
    } else if (v.type === 'van') {
      c.fillStyle = pal.glass;
      c.fillRect(fx - 17, P(-hy, zt - 4), 13, 9 * GZ);
      c.fillStyle = pal.roof;
      c.fillRect(bx + 4, P(hy - 4, zt), L - 16, (LANE_D - 8) * GY);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 9, P(hy - 3, zt), 6, (LANE_D - 6) * GY);
      c.fillStyle = pal.dark;
      c.fillRect(bx + 6, P(-hy, zt - 8), L - 30, 2 * GZ);
    } else if (cab) {
      const x0 = bx + cab[0] * L, x1 = bx + cab[1] * L, ch = cab[2] * TILE;
      if (v.type === 'pickup') { // open bed
        c.fillStyle = pal.dark;
        c.fillRect(bx + 4, P(hy - 4, zt), x0 - bx - 8, (LANE_D - 8) * GY);
      }
      if (v.type === 'sports' && pal.lit) { // racing stripes
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.fillRect(bx, P(4, zt), L, 2.5 * GY);
        c.fillRect(bx, P(-1, zt), L, 2.5 * GY);
      }
      box(c, x0, x1, -hy + 3, hy - 3, zt, zt + ch, pal.roof, pal.front);
      c.fillStyle = pal.glass;
      c.fillRect(x0 + 3, P(-hy + 3, zt + ch - 2), x1 - x0 - 6, (ch - 4) * GZ);
      c.fillStyle = pal.front;
      c.fillRect((x0 + x1) / 2 - 1.5, P(-hy + 3, zt + ch - 2), 3, (ch - 4) * GZ);
      c.fillStyle = pal.glassTop;
      c.fillRect(x1 - 7, P(hy - 3, zt + ch), 6, (LANE_D - 6) * GY);
      c.fillRect(x0 + 1, P(hy - 3, zt + ch), 3, (LANE_D - 6) * GY);
      if (v.type === 'sports') box(c, bx, bx + 5, -hy + 1, hy - 1, zt + 5, zt + 8, pal.dark, pal.dark);
    }

    // wheels
    for (const w of T.wheels) {
      const cx = w * L;
      c.fillStyle = '#1b1d22';
      c.fillRect(cx - 6, P(-hy - 0.5, 10), 12, 10 * GZ);
      c.fillStyle = '#8a8f99';
      c.fillRect(cx - 2, P(-hy - 0.5, 6.5), 4, 3 * GZ);
    }

    // graphic mode: the car that ran the chick over keeps the evidence
    if (v.bloody) {
      c.fillStyle = '#8f0a17';
      c.fillRect(fx - 10, P(-hy, z0 + 11), 10, 8 * GZ);
      c.fillRect(fx - 16, P(-hy, z0 + 7), 5, 3 * GZ);
      c.fillRect(fx - 7, P(-hy, z0 + 3), 2, 5 * GZ);
      c.fillRect(fx - 3, P(-hy, z0 + 4), 2, 7 * GZ);
      c.fillRect(fx - 7, P(hy - 5, zt), 7, 6 * GY);
      c.fillRect(fx - 14, P(-hy + 9, zt), 4, 3 * GY);
      c.fillRect(fx - 20, P(2, zt), 3, 2 * GY);
    }

    // police: black-and-white doors and a flashing light bar (keeps flashing on the wreck for a bit)
    if (v.police) {
      const x0 = bx + cab[0] * L, x1 = bx + cab[1] * L, ch = cab[2] * TILE;
      if (pal.lit) {
        c.fillStyle = '#f4f4f4';
        c.fillRect(x0, P(-hy, zt - 1), x1 - x0, (T.h * TILE - 4) * GZ);
      }
      if (!v.wreck || v.wreckT < 5) {
        const on = Math.sin(time * 18) > 0;
        box(c, -8, 8, -5, 5, zt + ch, zt + ch + 3, '#333', '#222');
        c.fillStyle = on ? '#ff2e3a' : '#5a1016';
        c.fillRect(-8, P(5, zt + ch + 3), 8, 10 * GY);
        c.fillStyle = on ? '#1e3a8a' : '#3b82f6';
        c.fillRect(0, P(5, zt + ch + 3), 8, 10 * GY);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = on ? 'rgba(255,40,50,0.35)' : 'rgba(60,120,255,0.35)';
        c.beginPath(); c.arc(on ? -4 : 4, P(0, zt + ch + 4), 16, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }

    // lights
    c.fillStyle = pal.lit ? '#fff5c2' : '#3a3a3a';
    c.fillRect(fx - 4, P(-hy, zt - 2), 4, 5 * GZ);
    c.fillRect(fx - 3, P(hy - 3, zt), 3, 5 * GY);
    c.fillRect(fx - 3, P(-hy + 8, zt), 3, 5 * GY);
    c.fillStyle = pal.lit ? '#ff4d4d' : '#3a2020';
    c.fillRect(bx, P(-hy, zt - 2), 3, 5 * GZ);
    if (v.stalled && Math.sin(time * 8) > 0) { // hazard lights on a car stalled on the tracks
      c.fillStyle = '#ffae00';
      c.fillRect(fx - 4, P(-hy, zt - 2), 4, 5 * GZ);
      c.fillRect(bx, P(-hy, zt - 2), 4, 5 * GZ);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,170,0,0.35)';
      c.beginPath(); c.arc(fx - 2, P(-hy, zt), 10, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(bx + 2, P(-hy, zt), 10, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }

    // frozen in a block of ice
    if (frost > 0.01 && !v.wreck) {
      c.globalAlpha = 0.45 * frost;
      box(c, bx - 2, fx + 2, -hy - 1, hy + 1, 0, zt + (cab ? cab[2] * TILE : 0) + 3, '#e2f8ff', '#a8e4f7');
      c.globalAlpha = 1;
    }
  }

  // Red warning badge above a reckless driver (not mirrored).
  function warning(c, time, z) {
    const bob = Math.sin(time * 10) * 2;
    const y = P(0, z) + bob;
    c.fillStyle = '#ff3355';
    c.beginPath();
    c.moveTo(0, y - 11);
    c.lineTo(10, y + 7);
    c.lineTo(-10, y + 7);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(-1.5, y - 4, 3, 6);
    c.fillRect(-1.5, y + 3.5, 3, 2.5);
  }

  // ---- Scenery -------------------------------------------------------------
  function tree(c, o, snow = 0) {
    box(c, -4, 4, -4, 4, 0, 14, '#9a6b4a', '#77502f');
    const p = o.pal;
    let z = 12, s = o.size;
    for (let i = 0; i < o.tiers; i++) {
      const h = i === 0 ? 22 : 16;
      box(c, -s, s, -s * 0.9, s * 0.9, z, z + h, i % 2 ? p.top2 : p.top, i % 2 ? p.front2 : p.front);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(-s, P(s * 0.9, z + h), s * 2, 2);
      if (snow > 0.05) { // snow cap
        c.globalAlpha = snow;
        box(c, -s - 1, s + 1, -s * 0.9 - 1, s * 0.9 + 1, z + h, z + h + 3, '#fbfdff', '#dfe9f3');
        c.globalAlpha = 1;
      }
      z += h;
      s *= 0.7;
    }
  }

  function bush(c, o) {
    const p = o.pal;
    box(c, -13, 13, -10, 10, 0, 12, p.top, p.front);
    box(c, -7, 5, -6, 5, 12, 17, p.top2, p.front2);
    if (o.flower) {
      c.fillStyle = o.flower;
      c.fillRect(-10, P(5, 12), 3, 3);
      c.fillRect(6, P(-3, 12), 3, 3);
      c.fillRect(-2, P(3, 17), 3, 3);
    }
  }

  function rock(c) {
    box(c, -11, 10, -9, 8, 0, 9, '#c3c7cf', '#8f949e');
    box(c, -6, 4, -5, 4, 9, 13, '#d4d8df', '#a3a8b1');
  }

  function lamp(c, o) {
    box(c, -2.5, 2.5, -2.5, 2.5, 0, 66, '#6d7482', '#4e5461');
    const s = o.dir;
    box(c, -2, 2, s < 0 ? -14 : 0, s < 0 ? 0 : 14, 62, 66, '#7d8493', '#5b6170');
    const hy = s * 13;
    box(c, -5, 5, hy - 5, hy + 5, 56, 62, '#fff2b8', '#e6d38a');
  }

  function sign(c, o) {
    box(c, -1.5, 1.5, -1.5, 1.5, 0, 36, '#a5abb5', '#7c828c');
    const cy = P(-2, 44);
    if (o.style === 'warn') {
      c.fillStyle = '#222';
      poly(c, 0, cy, 12, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
      c.fill();
      c.fillStyle = '#ffcc00';
      poly(c, 0, cy, 10, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
      c.fill();
      c.fillStyle = '#222';
      c.fillRect(-1, cy - 5, 2, 5.5);
      c.fillRect(-1, cy + 2, 2, 2);
    } else if (o.style === 'stop') {
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(0, cy, 10, 0, 6.2832); c.fill();
      c.fillStyle = '#e63946';
      c.beginPath(); c.arc(0, cy, 8.5, 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.fillRect(-5.5, cy - 1.5, 11, 3);
    } else {
      c.fillStyle = '#fff';
      c.fillRect(-9, cy - 9, 18, 18);
      c.fillStyle = '#2f7de1';
      c.fillRect(-7.5, cy - 7.5, 15, 15);
      c.fillStyle = '#fff';
      poly(c, 0, cy, 6, [[0, -1], [0.8, 0], [0.3, 0], [0.3, 1], [-0.3, 1], [-0.3, 0], [-0.8, 0]]);
      c.fill();
    }
  }

  // ---- Player (skins: chick, hard-hat chick, duck, frog, raccoon) ---------------
  // Graphic mode: what's left after a car goes over it.
  function pancake(c, sk) {
    box(c, -15, 15, -12, 12, 0, 2.5, sk.top, sk.front);
    c.fillStyle = '#9e0b1a';
    c.fillRect(-9, P(6, 2.5), 11, 7 * GY);
    c.fillRect(4, P(-2, 2.5), 7, 5 * GY);
    c.fillRect(-14, P(-4, 2.5), 5, 4 * GY);
    c.fillRect(-2, P(-8, 2.5), 12, 3 * GY);
    if (sk.comb) { c.fillStyle = sk.comb[0]; c.fillRect(-3, P(11, 2.5), 7, 3 * GY); }
    if (sk.beak) { c.fillStyle = sk.beak[1]; c.fillRect(11, P(2, 2.5), 6, 4 * GY); }
    c.strokeStyle = '#1d1d1f';
    c.lineWidth = 1.4;
    for (const ex of [2, 8]) {
      const ey = P(6, 2.5);
      c.beginPath();
      c.moveTo(ex - 2, ey - 2); c.lineTo(ex + 2, ey + 2);
      c.moveTo(ex + 2, ey - 2); c.lineTo(ex - 2, ey + 2);
      c.stroke();
    }
  }

  const SOOT = '#2a2522';
  function palette(sk, soot) {
    if (!soot) return sk;
    const out = { ...sk };
    for (const k of ['top', 'front', 'wingTop', 'wingFront', 'feet']) if (sk[k]) out[k] = mix(sk[k], SOOT, soot);
    if (sk.comb) out.comb = sk.comb.map(v => mix(v, SOOT, soot));
    if (sk.beak) out.beak = sk.beak.map(v => mix(v, SOOT, soot));
    return out;
  }

  function player(c, p, time, skin) {
    const base = skin || SKINS.chick;
    if (p.flat) { pancake(c, base); return; }
    const soot = p.char > 0 ? Math.min(1, p.char / 1.5) * 0.8 : 0;
    const sk = palette(base, soot);
    const frog = sk.kind === 'frog', coon = sk.kind === 'raccoon';
    const W = frog ? 13 : 11, D = 10, H = frog ? 16 : coon ? 20 : 22, lift = 3;
    const sq = p.squash;
    const hw = W * (1 + sq * 0.18), h = H * (1 - sq * 0.22);
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, lift + h / 2);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
    // feet
    c.fillStyle = sk.feet;
    c.fillRect(-7, P(-D + 2, lift), 4, lift * GZ + 1);
    c.fillRect(3, P(-D + 2, lift), 4, lift * GZ + 1);
    // raccoon tail sticks out the back
    if (coon) {
      for (let i = 0; i < 4; i++) box(c, -3, 3, D + i * 4, D + i * 4 + 4, lift + 4, lift + 10, i % 2 ? '#2b2e33' : sk.top, i % 2 ? '#1d1f23' : sk.front);
    }
    // body
    box(c, -hw, hw, -D, D, lift, lift + h, sk.top, sk.front);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(-hw, P(-D, lift + 5), hw * 2, 5 * GZ);
    const top = lift + h;
    // wings (birds only)
    if (sk.wingTop) {
      const wz = lift + h * 0.35 + (p.flap || 0) * 6;
      box(c, -hw - 3, -hw, -5, 5, wz, wz + 8, sk.wingTop, sk.wingFront);
      box(c, hw, hw + 3, -5, 5, wz, wz + 8, sk.wingTop, sk.wingFront);
    }
    if (sk.comb) box(c, -3, 3, -2, 4, top, top + 5, sk.comb[0], sk.comb[1]);
    if (coon) { // ears
      box(c, -hw, -hw + 5, 0, 5, top, top + 5, sk.top, sk.front);
      box(c, hw - 5, hw, 0, 5, top, top + 5, sk.top, sk.front);
    }
    if (frog) { // bulging eyes on top
      for (const ex of [-hw + 1, hw - 8]) {
        box(c, ex, ex + 7, -D + 1, -D + 7, top, top + 5, '#ffffff', '#e2e2e2');
        c.fillStyle = '#1d1d1f';
        c.fillRect(ex + 2, P(-D + 1, top + 4), 3, 3 * GZ);
      }
    }
    if (sk.hat === 'hardhat') {
      box(c, -hw - 2, hw + 2, -D - 2, D + 1, top, top + 2, '#ffd23f', '#e0a100');
      box(c, -hw + 2, hw - 2, -D + 2, D - 2, top + 2, top + 8, '#ffe066', '#f2b705');
      c.fillStyle = '#e0a100';
      c.fillRect(-1, P(-D + 2, top + 8), 2, 6 * GZ);
    }
    // face
    const ez = top - 6;
    const eye = ex => {
      c.fillStyle = '#1d1d1f';
      c.fillRect(ex, P(-D, ez), 3.5, 4.5 * GZ);
      c.fillStyle = '#fff';
      c.fillRect(ex + 0.6, P(-D, ez) + 0.6, 1.3, 1.3);
    };
    const mask = x0 => { c.fillStyle = '#1f2125'; c.fillRect(x0, P(-D, ez + 3), hw * 2 - 2, 7 * GZ); };
    const bill = sk.bill ? 3 : 0;
    const beak = (x0, x1, y0, y1) => box(c, x0, x1, y0, y1, top - 13, top - 8, sk.beak[0], sk.beak[1]);
    if (p.facing === 'down') {
      if (coon) mask(-hw + 1);
      if (frog) {
        c.fillStyle = '#2d6b2a';
        c.fillRect(-7, P(-D, top - 8), 14, 1.5);
      } else {
        eye(-7); eye(3.5);
      }
      if (sk.beak) beak(-3 - bill, 3 + bill, -D - 5, -D);
      if (coon) { c.fillStyle = '#1d1d1f'; c.fillRect(-2, P(-D, ez - 5), 4, 3 * GZ); }
      if (sk.kind === 'bird') {
        c.fillStyle = 'rgba(255,120,120,0.45)';
        c.fillRect(-10, P(-D, ez - 5), 3, 2);
        c.fillRect(7, P(-D, ez - 5), 3, 2);
      }
    } else if (p.facing === 'up') {
      if (sk.kind === 'bird') box(c, -4, 4, -D - 3, -D, lift + 4, lift + 10, '#ffffff', mix(sk.front, '#ffffff', 0.4)); // tail
    } else {
      const s = p.facing === 'right' ? 1 : -1;
      if (coon) mask(-hw + 1);
      if (!frog) eye(s > 0 ? hw - 7 : -hw + 3.5);
      if (sk.beak) beak(s > 0 ? hw : -hw - 6 - bill, s > 0 ? hw + 6 + bill : -hw, -3, 3);
    }
    c.restore();
  }

  // Speed-boost afterimage
  function ghost(c, z) {
    box(c, -11, 11, -10, 10, 3 + z, 25 + z, 'rgba(255,214,107,0.9)', 'rgba(255,179,25,0.9)');
  }

  // Your best run, hopping along beside you
  function bestGhost(c, z, alpha) {
    c.globalAlpha = 0.38 * alpha;
    box(c, -10, 10, -9, 9, 3 + z, 24 + z, '#e6f3ff', '#9cc8ee');
    c.fillStyle = '#34557a';
    c.fillRect(-6, P(-9, 18 + z), 3, 4);
    c.fillRect(3, P(-9, 18 + z), 3, 4);
    c.globalAlpha = 0.7 * alpha;
    c.fillStyle = '#ffffff';
    c.font = `900 8px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('BEST', 0, P(0, 40 + z));
    c.globalAlpha = 1;
  }

  function stars(c, time, z) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * 2 * Math.PI) / 3;
      const x = Math.cos(a) * 14, y = P(Math.sin(a) * 7, z);
      starPath(c, x, y, 4.5, 2);
      c.fillStyle = '#ffe34d';
      c.fill();
      c.strokeStyle = 'rgba(120,80,0,0.6)';
      c.lineWidth = 1;
      c.stroke();
    }
  }

  function bubble(c, time) {
    const r = 23 + Math.sin(time * 6) * 1.2, cy = P(0, 14);
    c.fillStyle = 'rgba(90,170,255,0.16)';
    c.beginPath(); c.arc(0, cy, r, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(150,210,255,0.85)';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, cy, r - 4, time * 2, time * 2 + 0.9); c.stroke();
  }

  // ---- Collectibles ------------------------------------------------------------
  function coin(c, it, time) {
    const z = 12 + Math.sin(time * 4 + it.phase) * 3;
    const w = Math.max(1.5, Math.abs(Math.cos(time * 3 + it.phase)) * 9);
    const cy = P(0, z);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,200,60,0.22)';
    c.beginPath(); c.arc(0, cy, 16, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#c98a00';
    c.beginPath(); c.ellipse(0, cy, w, 9, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#ffd23f';
    c.beginPath(); c.ellipse(0, cy, Math.max(0.5, w - 2), 7, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#fff4b8';
    c.fillRect(-w * 0.4, cy - 4, Math.max(1, w * 0.3), 7);
  }

  function powerItem(c, it, time) {
    const def = POWERUPS[it.type];
    const z = 18 + Math.sin(time * 3 + it.phase) * 3;
    const cy = P(0, z);
    const pulse = (time * 1.2 + it.phase) % 1;
    c.strokeStyle = def.color;
    c.globalAlpha = 0.7 * (1 - pulse);
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, P(0, 1), 8 + pulse * 16, (8 + pulse * 16) * GY, 0, 0, 6.2832); c.stroke();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = def.color;
    c.globalAlpha = 0.3;
    c.beginPath(); c.arc(0, cy, 21, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = def.dark;
    c.beginPath(); c.arc(0, cy + 2, 12, 0, 6.2832); c.fill();
    c.fillStyle = def.color;
    c.beginPath(); c.arc(0, cy, 12, 0, 6.2832); c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.stroke();
    icon(c, it.type, 0, cy, 7.5, '#fff');
  }

  // ---- Power-up icons (also rendered into HUD images) --------------------------
  function icon(c, type, x, y, r, color) {
    c.save();
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    switch (type) {
      case 'shield':
        poly(c, x, y, r, [[0, -0.95], [0.8, -0.6], [0.7, 0.25], [0, 0.95], [-0.7, 0.25], [-0.8, -0.6]]);
        c.fill();
        break;
      case 'speed':
        poly(c, x, y, r, [[0.2, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.25, 1], [0.55, -0.18], [0.05, -0.18]]);
        c.fill();
        break;
      case 'magnet':
        c.lineWidth = r * 0.42;
        c.lineCap = 'butt';
        c.beginPath();
        c.moveTo(x - r * 0.52, y - r * 0.85);
        c.lineTo(x - r * 0.52, y);
        c.arc(x, y, r * 0.52, Math.PI, 0, true);
        c.lineTo(x + r * 0.52, y - r * 0.85);
        c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.fillRect(x - r * 0.73, y - r * 0.9, r * 0.42, r * 0.32);
        c.fillRect(x + r * 0.31, y - r * 0.9, r * 0.42, r * 0.32);
        break;
      case 'freeze':
        c.lineWidth = r * 0.17;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3 + Math.PI / 2;
          const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
          c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
          for (const s of [1, -1]) {
            const bx = x + dx * 0.55 * s, by = y + dy * 0.55 * s, pa = a + (s > 0 ? 0 : Math.PI);
            for (const t of [0.65, -0.65]) {
              c.beginPath();
              c.moveTo(bx, by);
              c.lineTo(bx + Math.cos(pa + t) * r * 0.35, by + Math.sin(pa + t) * r * 0.35);
              c.stroke();
            }
          }
        }
        break;
      case 'invincible':
        starPath(c, x, y, r, r * 0.45);
        c.fill();
        break;
    }
    c.restore();
  }

  function iconURL(type, size = 56) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const r = size / 2, def = POWERUPS[type];
    g.fillStyle = def.dark;
    g.beginPath(); g.arc(r, r + 2, r - 3, 0, 6.2832); g.fill();
    g.fillStyle = def.color;
    g.beginPath(); g.arc(r, r, r - 3, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = size * 0.05;
    g.stroke();
    icon(g, type, r, r, r * 0.52, '#fff');
    return cv.toDataURL();
  }

  // ---- Trains, logs, crossing signals -----------------------------------------------
  // Drawn facing +x; the renderer mirrors for leftbound trains.
  function trainCar(c, car, time, bloody) {
    const L = car.len, hy = 0.4 * TILE, bx = -L / 2, fx = L / 2;
    const z0 = 7, zt = 0.95 * TILE;
    const col = car.color, top = shade(col, 0.12), front = shade(col, -0.22);
    // bogies
    c.fillStyle = '#1b1d22';
    for (const w of [-0.34, -0.2, 0.2, 0.34]) c.fillRect(w * L - 6, P(-hy - 0.5, 10), 12, 10 * GZ);
    if (car.type === 'loco') {
      box(c, bx, fx, -hy, hy, z0, zt - 8, top, front);
      box(c, fx - 0.3 * L, fx - 4, -hy + 2, hy - 2, zt - 8, zt + 6, shade(col, 0.2), front);
      c.fillStyle = '#27354d';
      c.fillRect(fx - 0.3 * L + 4, P(-hy + 2, zt + 3), 0.3 * L - 12, 8 * GZ);
      c.fillStyle = '#f7f7f2';
      c.fillRect(bx, P(-hy, zt - 20), L, 3 * GZ);
      box(c, bx + 10, bx + 18, -4, 4, zt - 8, zt + 2, '#2a2a2e', '#1b1b1e');
      c.fillStyle = '#fff5c2';
      c.fillRect(fx - 4, P(-hy, zt - 12), 4, 6 * GZ);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,240,180,0.4)';
      c.beginPath(); c.arc(fx, P(-hy, zt - 9), 14, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
      if (bloody) {
        c.fillStyle = '#8f0a17';
        c.fillRect(fx - 12, P(-hy, zt - 22), 12, 14 * GZ);
        c.fillRect(fx - 20, P(-hy, 18), 6, 4 * GZ);
        c.fillRect(fx - 8, P(hy - 6, zt - 8), 8, 8 * GY);
      }
    } else if (car.type === 'tank') {
      c.fillStyle = '#2a2a2e';
      c.fillRect(bx + 4, P(-hy + 4, z0 + 4), L - 8, 4 * GZ);
      box(c, bx + 6, fx - 6, -hy + 3, hy - 3, z0 + 6, zt - 4, top, front);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(bx + 6, P(0, zt - 4), L - 12, 3 * GY);
      box(c, -6, 6, -4, 4, zt - 4, zt, shade(col, 0.2), front);
    } else if (car.type === 'hopper') {
      box(c, bx + 2, fx - 2, -hy, hy, z0, zt - 6, top, front);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = bx + 10; x < fx - 6; x += 16) c.fillRect(x, P(-hy, zt - 8), 3, (zt - z0 - 10) * GZ);
      c.fillStyle = '#3b2f28';
      c.fillRect(bx + 4, P(hy - 2, zt - 6), L - 8, (2 * hy - 4) * GY);
    } else { // box car
      box(c, bx + 2, fx - 2, -hy, hy, z0, zt, top, front);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(-10, P(-hy, zt - 4), 20, (zt - z0 - 8) * GZ);
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(bx + 2, P(hy, zt), L - 4, 2);
    }
  }

  function log(c, l, time, ridden) {
    const L = l.len, hy = 0.34 * TILE, bob = Math.sin(l.bob) * 1.2 - (ridden ? 1.5 : 0);
    c.translate(0, P(0, bob));
    box(c, -L / 2, L / 2, -hy, hy, -3, 8, '#a8754a', '#7a522c');
    c.fillStyle = 'rgba(60,35,15,0.35)';
    for (let x = -L / 2 + 8; x < L / 2 - 6; x += 13) c.fillRect(x, P(hy - 3, 8), 7, 1.5);
    c.fillRect(-L / 2 + 3, P(-hy, 5), L - 6, 1.5);
    c.fillStyle = '#d9b38a';
    c.fillRect(L / 2 - 3, P(hy, 8), 3, (2 * hy) * GY);
    c.fillStyle = '#c49a6c';
    c.fillRect(-L / 2, P(hy, 8), 3, (2 * hy) * GY);
    // water line
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(-L / 2 - 2, P(-hy, 0), L + 4, 2);
  }

  // Railroad crossing signal: crossbuck plus two alternating red lights.
  function xing(c, o, time) {
    const R = o.rail, active = R.state !== 'idle';
    box(c, -2, 2, -2, 2, 0, 58, '#d9dde3', '#a9aeb6');
    c.save();
    c.translate(0, P(-3, 52));
    for (const a of [0.6, -0.6]) {
      c.save();
      c.rotate(a);
      c.fillStyle = '#1d1d1f';
      c.fillRect(-14, -3, 28, 6);
      c.fillStyle = '#f7f7f2';
      c.fillRect(-13, -2, 26, 4);
      c.restore();
    }
    c.restore();
    box(c, -12, 12, -2, 1, 36, 40, '#2a2a2e', '#1b1b1e');
    const on = active && Math.sin(time * 9) > 0;
    const lights = [[-9, on], [9, active && !on]];
    for (const [lx, lit] of lights) {
      c.fillStyle = '#1b1b1e';
      c.beginPath(); c.arc(lx, P(-2, 38), 5, 0, 6.2832); c.fill();
      c.fillStyle = lit ? '#ff2e3a' : '#5a1016';
      c.beginPath(); c.arc(lx, P(-2, 38), 3.4, 0, 6.2832); c.fill();
      if (lit) {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,40,50,0.45)';
        c.beginPath(); c.arc(lx, P(-2, 38), 14, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }
  }

  return {
    LANE_D, box, shadow, vehiclePalette, wreckPalette, vehicle, warning,
    tree, bush, rock, lamp, sign, player, ghost, bestGhost, stars, bubble, coin, powerItem, icon, iconURL,
    trainCar, log, xing,
  };
})();
