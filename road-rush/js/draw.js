'use strict';
// Low-poly "2.5D" drawing primitives and sprites.
// Everything is drawn in projected world units around a local origin at an
// object's ground centre: x is world x, screen y is P(y, z).

const Draw = (() => {
  const LANE_D = 0.72 * TILE; // vehicle depth (across the lane)
  let shadowImg = null;

  // A box with a lit top face and a shaded front face.
  function box(c, x0, x1, y0, y1, z0, z1, top, front) {
    const yt = P(y1, z1), yb = P(y0, z1), ybot = P(y0, z0), w = x1 - x0;
    c.fillStyle = top;
    c.fillRect(x0, yt, w, yb - yt);
    c.fillStyle = front;
    c.fillRect(x0, yb, w, ybot - yb);
    if (w > 3 && ybot - yb > 2.5) { // lit top edge and a soft contact shade at the base
      c.fillStyle = 'rgba(255,255,255,0.16)';
      c.fillRect(x0, yb - 0.6, w, 1.2);
      c.fillStyle = 'rgba(0,0,0,0.14)';
      c.fillRect(x0, ybot - 1.6, w, 1.6);
    }
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
      top: shade(base, 0.16), front: shade(base, -0.14), lower: shade(base, -0.34), dark: shade(base, -0.52),
      roof: shade(base, 0.3), roofFront: shade(base, -0.06),
      glass: '#223149', glassTop: '#4f73a0', glassHi: 'rgba(210,235,255,0.35)',
      trim: '#cfd4db', trimFront: '#9aa1ab', lit: true,
    };
  }

  function wreckPalette(base) {
    const b = mix(base, '#2b2522', 0.72);
    return {
      top: shade(b, 0.08), front: shade(b, -0.25), lower: shade(b, -0.4), dark: '#141212',
      roof: shade(b, 0.12), roofFront: shade(b, -0.15),
      glass: '#111113', glassTop: '#1d1d20', glassHi: 'rgba(0,0,0,0)',
      trim: '#3a3634', trimFront: '#2a2624', lit: false,
    };
  }

  function roundRect(c, x, y, w, h, r) {
    if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
    else c.fillRect(x, y, w, h);
  }

  // A glass pane on the side (front face) with a diagonal reflection.
  function pane(c, pal, x0, x1, y, z1, z0) {
    const top = P(y, z1), h = (z1 - z0) * GZ;
    c.fillStyle = pal.glass;
    c.fillRect(x0, top, x1 - x0, h);
    if (pal.lit) {
      c.fillStyle = pal.glassHi;
      c.beginPath();
      c.moveTo(x0 + 2, top + h);
      c.lineTo(x0 + Math.min(7, (x1 - x0) * 0.45), top);
      c.lineTo(x0 + Math.min(10, (x1 - x0) * 0.6), top);
      c.lineTo(x0 + 5, top + h);
      c.closePath();
      c.fill();
    }
  }

  function wheel(c, pal, cx, hy, spin, big) {
    const w = big ? 14 : 12, h = 10;
    c.fillStyle = '#0f1115'; // wheel arch
    c.fillRect(cx - w / 2 - 2, P(-hy, 13), w + 4, 9 * GZ);
    c.fillStyle = '#1c1e23';
    roundRect(c, cx - w / 2, P(-hy - 0.5, h), w, h * GZ, 3);
    const hy2 = P(-hy - 0.5, h / 2);
    c.fillStyle = pal.lit ? '#c3c8cf' : '#4a4a4a';
    c.beginPath(); c.arc(cx, hy2, 3.2, 0, 6.2832); c.fill();
    c.strokeStyle = '#2a2d33';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + Math.cos(spin) * 3, hy2 + Math.sin(spin) * 3);
    c.lineTo(cx - Math.cos(spin) * 3, hy2 - Math.sin(spin) * 3);
    c.stroke();
  }

  // Drawn facing +x; the renderer mirrors it for leftbound traffic.
  function vehicle(c, v, frost, time = 0) {
    const T = VEHICLE_TYPES[v.type];
    const L = v.len, hy = LANE_D / 2, pal = v.pal;
    const z0 = 4, zt = z0 + T.h * TILE;
    const fx = L / 2, bx = -L / 2;
    const cab = T.cab, ch = cab ? cab[2] * TILE : 0;
    const x0 = cab ? bx + cab[0] * L : 0, x1 = cab ? bx + cab[1] * L : 0;
    const spin = (v.x * v.dir) / 5;

    // crisp dark outline around the silhouette
    c.fillStyle = 'rgba(14,16,20,0.5)';
    c.fillRect(bx - 1.5, P(hy, zt) - 1.5, L + 3, P(-hy, 0) - P(hy, zt) + 2);
    if (cab) c.fillRect(x0 - 1.5, P(hy - 3, zt + ch) - 1.5, x1 - x0 + 3, P(-hy + 3, zt) - P(hy - 3, zt + ch) + 2);

    // body: upper paint, darker rocker panel, bumpers
    box(c, bx, fx, -hy, hy, z0, zt, pal.top, pal.front);
    c.fillStyle = pal.lower;
    c.fillRect(bx, P(-hy, z0 + 5), L, 5 * GZ);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(bx + 2, P(-hy, zt - 3), L - 4, 1.2);
    box(c, fx - 1.5, fx + 1.5, -hy + 1, hy - 1, z0 + 1, z0 + 8, pal.trim, pal.trimFront);
    box(c, bx - 1.5, bx + 1.5, -hy + 1, hy - 1, z0 + 1, z0 + 8, pal.trim, pal.trimFront);

    const t = v.type;
    if (t === 'bus') {
      const wz1 = zt - 5, wz0 = zt - 15;
      for (let x = bx + 20; x < fx - 14; x += 15) pane(c, pal, x, x + 11, -hy, wz1, wz0);
      pane(c, pal, fx - 12, fx - 3, -hy, wz1, wz0);
      c.fillStyle = pal.dark; // door
      c.fillRect(bx + 6, P(-hy, zt - 4), 10, (zt - z0 - 6) * GZ);
      c.fillStyle = pal.glass;
      c.fillRect(bx + 7, P(-hy, zt - 5), 3.5, 10 * GZ);
      c.fillRect(bx + 11.5, P(-hy, zt - 5), 3.5, 10 * GZ);
      c.fillStyle = pal.roof;
      c.fillRect(bx + 4, P(hy - 4, zt), L - 8, (LANE_D - 8) * GY);
      box(c, -14, 2, -6, 6, zt, zt + 4, pal.trim, pal.trimFront); // roof AC units
      box(c, bx + 14, bx + 26, -5, 5, zt, zt + 3, pal.trim, pal.trimFront);
      c.fillStyle = '#16181c'; // destination sign
      c.fillRect(fx - 4, P(hy - 3, zt), 4, (LANE_D - 6) * GY);
      if (pal.lit) { c.fillStyle = '#ffb000'; c.fillRect(fx - 3, P(hy - 6, zt), 2, (LANE_D - 12) * GY); }
      c.fillStyle = pal.dark;
      c.fillRect(bx, P(-hy, z0 + 11), L, 2.5 * GZ);
    } else if (t === 'van') {
      pane(c, pal, fx - 19, fx - 5, -hy, zt - 4, zt - 13);
      pane(c, pal, bx + 6, bx + 20, -hy, zt - 4, zt - 13);
      c.fillStyle = pal.dark; // sliding door
      c.fillRect(bx + 26, P(-hy, zt - 2), 1.2, (zt - z0 - 6) * GZ);
      c.fillRect(fx - 24, P(-hy, zt - 2), 1.2, (zt - z0 - 6) * GZ);
      c.fillStyle = pal.trim;
      c.fillRect(fx - 30, P(-hy, zt - 15), 4, 1.5);
      c.fillStyle = pal.roof;
      c.fillRect(bx + 4, P(hy - 4, zt), L - 16, (LANE_D - 8) * GY);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 10, P(hy - 3, zt), 8, (LANE_D - 6) * GY);
      c.fillStyle = pal.glassHi;
      c.fillRect(fx - 10, P(hy - 3, zt), 2, (LANE_D - 6) * GY);
      c.fillStyle = 'rgba(20,20,24,0.55)'; // roof rack
      for (const rx of [bx + 10, bx + 22, bx + 34]) c.fillRect(rx, P(hy - 3, zt + 2), 2, (LANE_D - 6) * GY);
    } else if (t === 'tanker') {
      const cx0 = fx - 0.26 * L;
      c.fillStyle = pal.dark;
      c.fillRect(bx, P(hy, zt), L, LANE_D * GY);
      const tankTop = pal.lit ? '#f1f3f6' : '#3a3a3a', tankFront = pal.lit ? '#b9bec6' : '#262626';
      box(c, bx + 2, cx0 - 3, -hy + 1, hy - 1, z0 + 4, zt + 5, tankTop, tankFront);
      if (pal.lit) {
        c.fillStyle = 'rgba(255,255,255,0.7)'; // rounded-tank highlight
        c.fillRect(bx + 2, P(hy * 0.25, zt + 5), cx0 - bx - 5, 3 * GY);
        c.fillStyle = 'rgba(0,0,0,0.1)';
        c.fillRect(bx + 2, P(-hy + 1, z0 + 12), cx0 - bx - 5, 6 * GZ);
        c.fillStyle = '#9aa1ab'; // tank bands
        for (let x = bx + 12; x < cx0 - 8; x += 18) c.fillRect(x, P(-hy + 1, zt + 5), 2, (zt - z0 + 1) * GZ);
        const px = (bx + cx0) / 2, py = P(-hy + 1, zt - 6);
        c.fillStyle = '#c8102e';
        poly(c, px, py, 7, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(px - 1, py - 3, 2, 5);
      }
      box(c, cx0, fx, -hy + 2, hy - 2, zt - 2, zt + 10, pal.roof, pal.front);
      pane(c, pal, cx0 + 4, fx - 4, -hy + 2, zt + 8, zt);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 6, P(hy - 2, zt + 10), 5, (LANE_D - 4) * GY);
      c.fillStyle = pal.trim; // grill
      c.fillRect(fx - 3, P(-hy, zt - 4), 3, 8 * GZ);
    } else if (cab) {
      if (t === 'pickup') { // open bed with raised walls
        c.fillStyle = pal.dark;
        c.fillRect(bx + 3, P(hy - 3, zt), x0 - bx - 6, (LANE_D - 6) * GY);
        box(c, bx + 1, x0 - 2, hy - 3, hy - 1, zt, zt + 4, pal.top, pal.front);
        box(c, bx + 1, bx + 3, -hy + 1, hy - 1, zt, zt + 4, pal.top, pal.front);
        if (v.base.charCodeAt(2) % 2) box(c, bx + 7, bx + 19, -6, 4, zt, zt + 8, '#c7955e', '#9c6f3f'); // cargo crate
      }
      if (t === 'sedan' || t === 'police') { // trunk and hood seams
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(x0 - 8, P(hy - 2, zt), 1, (LANE_D - 4) * GY);
        c.fillRect(x1 + 9, P(hy - 2, zt), 1, (LANE_D - 4) * GY);
      }
      if (t === 'sports') {
        c.fillStyle = 'rgba(0,0,0,0.3)'; // hood vents
        c.fillRect(x1 + 5, P(3, zt), 6, 1.2);
        c.fillRect(x1 + 5, P(-2, zt), 6, 1.2);
        if (pal.lit) {
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(bx, P(4, zt), L, 2.2 * GY);
          c.fillRect(bx, P(-1, zt), L, 2.2 * GY);
        }
      }
      // cabin with side windows, B-pillar, windscreen and roof
      box(c, x0, x1, -hy + 3, hy - 3, zt, zt + ch, pal.roof, pal.roofFront);
      const pil = (x0 + x1) / 2 - 1.5;
      pane(c, pal, x0 + 3, pil, -hy + 3, zt + ch - 2, zt + 2);
      pane(c, pal, pil + 3, x1 - 4, -hy + 3, zt + ch - 2, zt + 2);
      c.fillStyle = pal.glassTop;
      c.fillRect(x1 - 7, P(hy - 3, zt + ch), 6, (LANE_D - 6) * GY);
      c.fillRect(x0 + 1, P(hy - 3, zt + ch), 3, (LANE_D - 6) * GY);
      c.fillStyle = pal.glassHi;
      c.fillRect(x1 - 7, P(hy - 3, zt + ch), 1.5, (LANE_D - 6) * GY);
      box(c, x1 - 3, x1, -hy - 1.5, -hy + 1, zt + 1, zt + 4, pal.front, pal.dark); // side mirror
      if (t === 'sports') { // rear wing on two struts
        c.fillStyle = pal.dark;
        c.fillRect(bx + 2, P(-hy + 4, zt + 5), 1.5, 5 * GZ);
        box(c, bx, bx + 4, -hy + 2, hy - 2, zt + 5, zt + 7, pal.top, pal.front);
      }
      // door seam and handle
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(pil + 1, P(-hy, zt - 1), 1, (zt - z0 - 7) * GZ);
      c.fillStyle = pal.trim;
      c.fillRect(pil - 5, P(-hy, zt - 4), 3, 1.2);
      c.fillRect(pil + 4, P(-hy, zt - 4), 3, 1.2);
    }

    // police: black-and-white doors and a flashing light bar (keeps flashing on the wreck for a bit)
    if (v.police) {
      if (pal.lit) {
        c.fillStyle = '#f4f4f4';
        c.fillRect(x0, P(-hy, zt - 1), x1 - x0, (T.h * TILE - 7) * GZ);
        c.fillStyle = '#1d4f91';
        c.fillRect((x0 + x1) / 2 - 2, P(-hy, zt - 5), 4, 4);
        box(c, fx - 1, fx + 3, -hy + 3, hy - 3, z0 + 2, z0 + 9, '#2a2a2e', '#1b1b1e'); // push bar
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

    // wheels
    const big = t === 'sports' || t === 'bus' || t === 'tanker';
    for (const w of T.wheels) wheel(c, pal, w * L, hy, spin, big);

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

    // lights: headlights and indicators up front, tail lights behind
    const hl = pal.lit ? '#fff7d1' : '#3a3a3a';
    c.fillStyle = hl;
    c.fillRect(fx - 4, P(-hy, zt - 2), 4, 4 * GZ);
    c.fillRect(fx - 3.5, P(hy - 2.5, zt), 3.5, 4.5 * GY);
    c.fillRect(fx - 3.5, P(-hy + 7, zt), 3.5, 4.5 * GY);
    c.fillStyle = pal.lit ? '#ffae00' : '#3a3020';
    c.fillRect(fx - 7, P(-hy, zt - 3), 2.5, 2.5 * GZ);
    c.fillStyle = pal.lit ? '#ff3b3b' : '#3a2020';
    c.fillRect(bx, P(-hy, zt - 2), 3, 4 * GZ);
    c.fillRect(bx, P(hy - 2.5, zt), 3, 4.5 * GY);
    c.fillRect(bx, P(-hy + 7, zt), 3, 4.5 * GY);
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
      box(c, bx - 2, fx + 2, -hy - 1, hy + 1, 0, zt + ch + 3, '#e2f8ff', '#a8e4f7');
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
    const frog = sk.kind === 'frog', coon = sk.kind === 'raccoon', bird = sk.kind === 'bird';
    const W = frog ? 13 : 11, D = 10, H = frog ? 16 : coon ? 19 : 22, lift = 3;
    const sq = p.squash + (p.breath || 0);
    const hw = W * (1 + sq * 0.18), h = H * (1 - sq * 0.22);
    const top = lift + h;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    const belly = mix(sk.top, '#ffffff', 0.45), dark = shade(sk.front, -0.25);
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, lift + h / 2);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
    // outline
    c.fillStyle = 'rgba(30,22,10,0.4)';
    c.fillRect(-hw - 1.2, P(D, top) - 1.2, hw * 2 + 2.4, P(-D, lift) - P(D, top) + 2.4);
    // feet with toes
    c.fillStyle = sk.feet;
    for (const fx of [-6, 4]) {
      c.fillRect(fx - 1, P(-D + 2, lift), 4, lift * GZ + 1);
      c.fillRect(fx - 2, P(-D - 1, 0.8), 6, 1.6);
    }
    // tails behind the body
    if (coon) {
      for (let i = 0; i < 4; i++) box(c, -3, 3, D + i * 4, D + i * 4 + 4, lift + 4, lift + 10, i % 2 ? '#2b2e33' : sk.top, i % 2 ? '#1d1f23' : sk.front);
    } else if (bird) {
      box(c, -4, 4, D - 1, D + 3, top - 8, top - 1, sk.bill ? '#ffffff' : belly, sk.front);
    }
    // body
    box(c, -hw, hw, -D, D, lift, top, sk.top, sk.front);
    if (!frog) { // lighter belly
      c.fillStyle = mix(sk.front, belly, 0.55);
      c.fillRect(-hw * 0.55, P(-D, lift + h * 0.55), hw * 1.1, h * 0.45 * GZ);
    } else { // frog spots
      c.fillStyle = dark;
      for (const [sx, sy] of [[-6, 4], [4, -2], [-1, 7], [7, 5]]) c.fillRect(sx, P(sy, top) - 1, 3, 2.4);
      c.fillStyle = belly;
      c.fillRect(-hw + 2, P(-D, lift + 6), hw * 2 - 4, 4 * GZ);
    }
    // wings with darker feather tips (birds)
    if (sk.wingTop) {
      const wz = lift + h * 0.35 + (p.flap || 0) * 6;
      for (const s of [-1, 1]) {
        const a = s < 0 ? -hw - 3 : hw, b = s < 0 ? -hw : hw + 3;
        box(c, a, b, -5, 5, wz, wz + 8, sk.wingTop, sk.wingFront);
        c.fillStyle = shade(sk.wingFront, -0.2);
        c.fillRect(a, P(-5, wz + 2), 3, 2 * GZ);
      }
    }
    // comb (three lobes)
    if (sk.comb) {
      box(c, -4, -1, -1, 3, top, top + 3.5, sk.comb[0], sk.comb[1]);
      box(c, -1, 2, -2, 4, top, top + 5.5, sk.comb[0], sk.comb[1]);
      box(c, 2, 5, -1, 3, top, top + 3, sk.comb[0], sk.comb[1]);
    }
    if (coon) { // ears with dark inners
      for (const ex of [-hw, hw - 5]) {
        box(c, ex, ex + 5, 0, 5, top, top + 5, sk.top, sk.front);
        c.fillStyle = '#2b2e33';
        c.fillRect(ex + 1.5, P(0, top + 4), 2, 3 * GZ);
      }
    }
    if (frog) { // bulging eyes on top
      for (const ex of [-hw + 1, hw - 8]) {
        box(c, ex, ex + 7, -D + 1, -D + 7, top, top + 5, '#ffffff', '#e2e2e2');
        c.fillStyle = '#1d1d1f';
        c.fillRect(ex + 2, P(-D + 1, top + (blink ? 2 : 4)), 3, (blink ? 1 : 3) * GZ);
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
      if (blink) { c.fillRect(ex, P(-D, ez - 2), 3.5, 1.2); return; }
      c.fillRect(ex, P(-D, ez), 3.5, 4.5 * GZ);
      c.fillStyle = '#fff';
      c.fillRect(ex + 0.6, P(-D, ez) + 0.6, 1.4, 1.4);
    };
    const mask = x0 => { c.fillStyle = '#1f2125'; c.fillRect(x0, P(-D, ez + 3), hw * 2 - 2, 7 * GZ); };
    const bill = sk.bill ? 3 : 0;
    const beak = (x0, x1, y0, y1) => {
      box(c, x0, x1, y0, y1, top - 11, top - 8, sk.beak[0], sk.beak[1]);
      box(c, x0 + 0.5, x1 - 0.5, y0 + 0.5, y1, top - 13, top - 11, sk.beak[1], shade(sk.beak[1], -0.2));
    };
    if (p.facing === 'down') {
      if (coon) mask(-hw + 1);
      if (frog) {
        c.fillStyle = '#2d6b2a';
        c.fillRect(-7, P(-D, top - 8), 14, 1.5);
      } else {
        eye(-7); eye(3.5);
      }
      if (sk.beak) beak(-3 - bill, 3 + bill, -D - 5, -D);
      if (coon) {
        box(c, -3, 3, -D - 3, -D, ez - 7, ez - 3, mix(sk.top, '#ffffff', 0.5), sk.top); // snout
        c.fillStyle = '#1d1d1f';
        c.fillRect(-1.5, P(-D - 3, ez - 3) - 0.5, 3, 2);
      }
      if (bird) {
        c.fillStyle = 'rgba(255,120,120,0.45)';
        c.fillRect(-10, P(-D, ez - 5), 3, 2);
        c.fillRect(7, P(-D, ez - 5), 3, 2);
      }
    } else if (p.facing !== 'up') {
      const s = p.facing === 'right' ? 1 : -1;
      if (coon) mask(-hw + 1);
      if (!frog) eye(s > 0 ? hw - 7 : -hw + 3.5);
      if (sk.beak) beak(s > 0 ? hw : -hw - 6 - bill, s > 0 ? hw + 6 + bill : -hw, -3, 3);
      if (coon) box(c, s > 0 ? hw : -hw - 4, s > 0 ? hw + 4 : -hw, -3, 3, ez - 7, ez - 3, mix(sk.top, '#ffffff', 0.5), sk.top);
    }
    c.restore();
  }

  // First-move hint floating above the player.
  function hint(c, time, touch) {
    const y = P(0, 58) + Math.sin(time * 4) * 2.5;
    const text = touch ? 'TAP TO HOP' : 'PRESS \u2191 TO HOP';
    c.font = `900 8px ${UI_FONT}`;
    const w = c.measureText(text).width + 14;
    c.fillStyle = 'rgba(14,16,20,0.45)';
    c.fillRect(-w / 2 + 1.5, y - 7.5, w, 15);
    c.fillStyle = '#f7f7f2';
    c.fillRect(-w / 2, y - 9, w, 15);
    c.strokeStyle = '#16181c';
    c.lineWidth = 1.2;
    c.strokeRect(-w / 2 + 1.5, y - 7.5, w - 3, 12);
    c.fillStyle = '#16181c';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, y - 1);
    c.beginPath(); c.moveTo(-4, y + 6); c.lineTo(4, y + 6); c.lineTo(0, y + 10); c.closePath();
    c.fillStyle = '#f7f7f2';
    c.fill();
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
    tree, bush, rock, lamp, sign, player, hint, ghost, bestGhost, stars, bubble, coin, powerItem, icon, iconURL,
    trainCar, log, xing,
  };
})();
