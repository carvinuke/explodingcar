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
      roof: shade(base, 0.1), roofFront: shade(base, -0.06), // roofs close to the body colour: a pale roof reads as a slab
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
  // Everything about a car that doesn't move: drawn once per look and cached.
  function vehicleBody(c, v) {
    const T = VEHICLE_TYPES[v.type];
    if (T.lux) { Lux.side(c, v); return; } // the luxury cars have their own shapes
    const L = v.len, hy = LANE_D / 2, pal = v.pal;
    const z0 = 4, zt = z0 + T.h * TILE;
    const fx = L / 2, bx = -L / 2;
    const cab = T.cab, ch = cab ? cab[2] * TILE : 0;
    const x0 = cab ? bx + cab[0] * L : 0, x1 = cab ? bx + cab[1] * L : 0;

    // crisp dark outline around the silhouette
    c.fillStyle = 'rgba(14,16,20,0.5)';
    c.fillRect(bx - 1.5, P(hy, zt) - 1.5, L + 3, P(-hy, 0) - P(hy, zt) + 2);

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
    } else if (t === 'ambulance') {
      pane(c, pal, fx - 16, fx - 4, -hy, zt - 4, zt - 14);
      c.fillStyle = '#d62828'; // stripe and cross
      c.fillRect(bx, P(-hy, zt - 17), L - 18, 4 * GZ);
      const cx = bx + (L - 18) * 0.45, cy = P(-hy, zt - 9);
      c.fillRect(cx - 5, cy - 1.8, 10, 3.6);
      c.fillRect(cx - 1.8, cy - 5, 3.6, 10);
      c.fillStyle = pal.dark; // rear doors
      c.fillRect(bx + 1, P(-hy, zt - 3), 1.2, (zt - z0 - 6) * GZ);
      c.fillRect(fx - 20, P(-hy, zt - 2), 1.2, (zt - z0 - 6) * GZ);
      c.fillStyle = pal.roof;
      c.fillRect(bx + 4, P(hy - 4, zt), L - 20, (LANE_D - 8) * GY);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 12, P(hy - 3, zt), 9, (LANE_D - 6) * GY);
      c.fillStyle = '#d62828';
      c.fillRect(bx + 8, P(3, zt), L - 30, 3 * GY);
    } else if (t === 'firetruck') {
      const cx0 = fx - 0.28 * L;
      box(c, cx0, fx, -hy + 1, hy - 1, zt, zt + 6, pal.roof, pal.front); // raised cab roof
      pane(c, pal, cx0 + 4, fx - 4, -hy, zt + 3, zt - 9);
      c.fillStyle = pal.glassTop;
      c.fillRect(fx - 7, P(hy - 3, zt + 6), 6, (LANE_D - 6) * GY);
      c.fillStyle = '#f7f7f2'; // white stripe
      c.fillRect(bx, P(-hy, zt - 16), L, 2.5 * GZ);
      c.fillStyle = pal.dark; // equipment lockers
      for (let x = bx + 6; x < cx0 - 10; x += 16) c.fillRect(x, P(-hy, zt - 3), 12, 9 * GZ);
      // ladder along the roof
      c.fillStyle = '#c3c8cf';
      c.fillRect(bx + 2, P(4, zt + 4), cx0 - bx + 8, 1.6);
      c.fillRect(bx + 2, P(-4, zt + 4), cx0 - bx + 8, 1.6);
      for (let x = bx + 4; x < cx0 + 8; x += 6) c.fillRect(x, P(4, zt + 4), 1.4, 8 * GY);
      box(c, bx + 6, bx + 16, -6, 6, zt, zt + 4, '#9aa1ab', '#6d737c'); // hose reel
    } else if (cab) {
      if (t === 'pickup') { // open bed with raised walls
        c.fillStyle = pal.dark;
        c.fillRect(bx + 3, P(hy - 3, zt), x0 - bx - 6, (LANE_D - 6) * GY);
        box(c, bx + 1, x0 - 2, hy - 3, hy - 1, zt, zt + 4, pal.top, pal.front);
        box(c, bx + 1, bx + 3, -hy + 1, hy - 1, zt, zt + 4, pal.top, pal.front);
        if (v.base.charCodeAt(2) % 2) box(c, bx + 7, bx + 19, -6, 4, zt, zt + 8, '#c7955e', '#9c6f3f'); // cargo crate
      }
      if (t === 'logtruck') { // a stack of logs on the bed
        c.fillStyle = pal.dark;
        c.fillRect(bx, P(hy, zt), x0 - bx - 2, LANE_D * GY);
        for (const [y0, y1, z] of [[-hy + 1, -1, zt], [1, hy - 1, zt], [-hy / 2, hy / 2, zt + 7]]) {
          box(c, bx + 2, x0 - 4, y0, y1, z, z + 7, '#a8754a', '#7a522c');
          c.fillStyle = '#d9b38a';
          c.fillRect(x0 - 6, P(y1, z + 7), 2, (y1 - y0) * GY);
        }
        for (const x of [bx + 8, x0 - 14]) box(c, x, x + 2, -hy, -hy + 2, zt, zt + 14, '#3a3d44', '#26282d');
      }
      if (t === 'forklift') { // mast and forks out front
        box(c, fx - 2, fx + 1, -hy + 3, -hy + 6, z0, zt + ch + 6, '#3a3d44', '#26282d');
        box(c, fx - 2, fx + 1, hy - 6, hy - 3, z0, zt + ch + 6, '#3a3d44', '#26282d');
        box(c, fx, fx + 12, -hy + 4, -hy + 6, z0 + 1, z0 + 2.5, '#9aa0a8', '#6d737c');
        box(c, fx, fx + 12, hy - 6, hy - 4, z0 + 1, z0 + 2.5, '#9aa0a8', '#6d737c');
        box(c, bx - 2, bx + 6, -hy + 2, hy - 2, z0 + 2, zt + 4, '#3a3d44', '#26282d'); // counterweight
      }
      if (t === 'tractor') { // exhaust stack and hood grille
        box(c, x1 + 4, x1 + 6.5, -2, 0.5, zt, zt + ch + 6, '#3a3d44', '#26282d');
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let x = x1 + 3; x < fx - 2; x += 3) c.fillRect(x, P(-hy, zt - 2), 1.2, (zt - z0 - 6) * GZ);
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
      // the glasshouse: raked windscreen and rear window, roof in the body colour,
      // big side windows set into the pillars
      const cu = CarShape.cabinU(t), R = cu.R;
      const xr1 = bx + cu.ur * L, xf1 = bx + cu.uf * L;
      const pil = (xr1 + xf1) / 2 - 1.5;
      CarShape.cabinSide(c, pal, {
        xr0: x0, xr1, xf1, xf0: x1, zb: zt, zr: zt + ch, hy, inset: 2.5, tumble: t === 'tractor' || t === 'forklift' || t === 'logtruck' ? 1.5 : 4.5,
        pillarA: R.pa, pillarC: R.pc, bPillar: R.b ? pil + 1.5 : null,
        glassRoof: t === 'forklift', paintBack: t === 'tractor' || t === 'logtruck',
      });
      box(c, x1 - 2, x1 + 1, -hy - 1.5, -hy + 1, zt + 0.5, zt + 3.5, pal.front, pal.dark); // side mirror
      if (t === 'sports') { // rear wing on two struts
        c.fillStyle = pal.dark;
        c.fillRect(bx + 2, P(-hy + 4, zt + 5), 1.5, 5 * GZ);
        box(c, bx, bx + 4, -hy + 2, hy - 2, zt + 5, zt + 7, pal.top, pal.front);
      }
      if (t === 'taxi') { // roof sign and checker stripe
        const mx = (xr1 + xf1) / 2;
        box(c, mx - 6, mx + 6, -5, 5, zt + ch, zt + ch + 5, '#fff7d1', '#e8d890');
        c.fillStyle = '#16181c';
        c.font = `900 4px ${UI_FONT}`;
        c.textAlign = 'center';
        c.fillText('TAXI', mx, P(-5, zt + ch + 2.2));
        for (let x = bx + 3, k = 0; x < fx - 3; x += 4, k++) {
          c.fillStyle = k % 2 ? '#16181c' : '#f7f7f2';
          c.fillRect(x, P(-hy, z0 + 11), 4, 2 * GZ);
          c.fillStyle = k % 2 ? '#f7f7f2' : '#16181c';
          c.fillRect(x, P(-hy, z0 + 9), 4, 2 * GZ);
        }
      }
      // door seam and handle
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(pil + 1, P(-hy, zt - 1), 1, (zt - z0 - 7) * GZ);
      c.fillStyle = pal.trim;
      c.fillRect(pil - 5, P(-hy, zt - 4), 3, 1.2);
      c.fillRect(pil + 4, P(-hy, zt - 4), 3, 1.2);
    }

  }

  function vehicle(c, v, frost, time = 0) {
    const T = VEHICLE_TYPES[v.type];
    const L = v.len, hy = LANE_D / 2, pal = v.pal;
    const z0 = 4, zt = z0 + T.h * TILE;
    const fx = L / 2, bx = -L / 2;
    const cab = T.cab, ch = cab ? cab[2] * TILE : 0;
    const x0 = cab ? bx + cab[0] * L : 0, x1 = cab ? bx + cab[1] * L : 0;
    const spin = (v.x * v.dir) / 5;

    const key = `veh|${v.type}|${L}|${v.base}|${pal.top}|${pal.lit}`;
    if (!Sprites.drawKey(c, key, g => vehicleBody(g, v))) vehicleBody(c, v);
    const t = v.type;

    // police and responders: a flashing light bar (keeps flashing on the wreck for a bit)
    if (v.police || v.responder) {
      if (pal.lit && v.police) {
        c.fillStyle = '#f4f4f4';
        c.fillRect(x0, P(-hy, zt - 1), x1 - x0, (T.h * TILE - 7) * GZ);
        c.fillStyle = '#1d4f91';
        c.fillRect((x0 + x1) / 2 - 2, P(-hy, zt - 5), 4, 4);
        box(c, fx - 1, fx + 3, -hy + 3, hy - 3, z0 + 2, z0 + 9, '#2a2a2e', '#1b1b1e'); // push bar
      }
      if (!v.wreck || v.wreckT < 5) {
        const on = Math.sin(time * 18) > 0;
        const cu = cab ? CarShape.cabinU(t) : null, mx = cu ? bx + (cu.ur + cu.uf) / 2 * L : 0; // on the middle of the roof
        box(c, mx - 7, mx + 7, -5, 5, zt + ch, zt + ch + 3, '#333', '#222');
        c.fillStyle = on ? '#ff2e3a' : '#5a1016';
        c.fillRect(mx - 7, P(5, zt + ch + 3), 7, 10 * GY);
        c.fillStyle = on ? '#1e3a8a' : '#3b82f6';
        c.fillRect(mx, P(5, zt + ch + 3), 7, 10 * GY);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = on ? 'rgba(255,40,50,0.35)' : 'rgba(60,120,255,0.35)';
        c.beginPath(); c.arc(mx + (on ? -4 : 4), P(0, zt + ch + 4), 16, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }

    // wheels
    const big = t === 'sports' || t === 'bus' || t === 'tanker' || t === 'tractor' || t === 'logtruck';
    if (T.lux) Lux.wheelsSide(c, v, spin);
    else for (const w of T.wheels) wheel(c, pal, w * L, hy, spin, big);

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

    // lights: headlights and indicators up front, tail lights behind (the luxury cars draw their own)
    const hl = pal.lit && !v.dark ? '#fff7d1' : v.dark && pal.lit ? '#7d7a6c' : '#3a3a3a';
    if (!T.lux) {
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
    }
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
    const shrink = o.pine ? 0.62 : 0.7;
    for (let i = 0; i < o.tiers; i++) {
      const h = o.pine ? (i === 0 ? 18 : 14) : i === 0 ? 22 : 16;
      box(c, -s, s, -s * 0.9, s * 0.9, z, z + h, i % 2 ? p.top2 : p.top, i % 2 ? p.front2 : p.front);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(-s, P(s * 0.9, z + h), s * 2, 2);
      if (snow > 0.05) { // snow cap
        c.globalAlpha = snow;
        box(c, -s - 1, s + 1, -s * 0.9 - 1, s * 0.9 + 1, z + h, z + h + 3, '#fbfdff', '#dfe9f3');
        c.globalAlpha = 1;
      }
      z += h;
      s *= shrink;
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

  function rock(c, o) {
    const zone = o && o.zone;
    if (zone === 'desert') {
      box(c, -12, 11, -9, 8, 0, 11, '#d49a6a', '#a8704a');
      box(c, -6, 5, -5, 4, 11, 16, '#e0ab7e', '#b57d55');
      c.fillStyle = 'rgba(120,60,30,0.25)';
      c.fillRect(-12, P(-9, 6), 23, 1.5);
      return;
    }
    box(c, -11, 10, -9, 8, 0, 9, '#c3c7cf', '#8f949e');
    box(c, -6, 4, -5, 4, 9, 13, '#d4d8df', '#a3a8b1');
    if (zone === 'snow') box(c, -7, 5, -6, 5, 13, 15, '#fbfdff', '#dfe9f3');
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

  // ---- Critters: four-legged characters built from options on the skin ------------
  // ears, snout, tail, pattern, eyes, horns, spikes, antennae, wings.
  const INK = '#1d1d1f';
  const now = () => performance.now() / 1000;

  function twinkles(c, hw, D, top, lift, time) { // galaxy speckles
    const pts = [[-0.6, -0.4, 0.8], [0.4, 0.3, 0.2], [-0.2, 0.6, 0.5], [0.7, -0.6, 0.9], [0.1, -0.1, 0.35]];
    for (const [x, y, ph] of pts) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 2.4 + ph * 7));
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.fillRect(x * hw - 0.8, P(y * D, top) - 0.8, 1.6, 1.6);
      c.fillRect(x * hw * 0.8 - 0.7, P(-D, lift + (top - lift) * (0.3 + ph * 0.6)) - 0.7, 1.4, 1.4);
    }
  }

  function glint(c, x, y, time, seed) {
    if (((time * 1.3 + (seed || 0)) % 2.2) >= 0.18) return;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,255,220,0.9)';
    starPath(c, x, y, 5, 1.2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  function aura(c, color, z, time, r = 19) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = color;
    c.beginPath(); c.arc(0, P(0, z), r + Math.sin(time * 3) * 1.5, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  function critter(c, p, time, sk, hat) {
    const W = 11, D = 10, H = 19, lift = 3;
    const sq = p.squash + (p.breath || 0);
    const hw = W * (1 + sq * 0.18), h = H * (1 - sq * 0.22), top = lift + h;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    const belly = mix(sk.top, '#ffffff', 0.45), dark = shade(sk.front, -0.25);
    const pc = sk.patternColor || dark;
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, lift + h / 2);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
    if (sk.glow) aura(c, sk.glow, lift + h * 0.55, time);
    // tail (behind the body)
    const tz = lift + h * 0.45;
    const tailCol = sk.tailColor || sk.front;
    c.lineCap = 'round';
    switch (sk.tail) {
      case 'thin':
      case 'mouse':
      case 'devil': {
        const wag = Math.sin(time * 5 + (p.blinkSeed || 0)) * 2;
        c.strokeStyle = sk.tail === 'mouse' ? '#ff9fb5' : sk.tail === 'devil' ? '#2b0a0a' : tailCol;
        c.lineWidth = sk.tail === 'thin' ? 2.8 : 1.6;
        c.beginPath();
        c.moveTo(0, P(D - 1, tz));
        c.quadraticCurveTo(6 + wag, P(D + 6, tz + 4), 3 + wag, P(D + 5, tz + 14));
        c.stroke();
        if (sk.tail === 'devil') { // spade tip
          c.fillStyle = '#2b0a0a';
          const tx = 3 + wag, ty = P(D + 5, tz + 14);
          c.beginPath(); c.moveTo(tx, ty - 4); c.lineTo(tx + 3, ty + 1); c.lineTo(tx - 3, ty + 1); c.closePath(); c.fill();
        } else if (sk.tailTip) {
          c.strokeStyle = sk.tailTip;
          c.beginPath(); c.moveTo(3.5 + wag, P(D + 5.5, tz + 10)); c.lineTo(3 + wag, P(D + 5, tz + 14)); c.stroke();
        }
        break;
      }
      case 'bushy':
        box(c, -3, 3, D - 1, D + 4, tz - 2, tz + 4, sk.top, sk.front);
        box(c, -3.5, 3.5, D + 3, D + 8, tz + 2, tz + 9, sk.top, sk.front);
        box(c, -3, 3, D + 7, D + 10, tz + 8, tz + 12, sk.tailTip || '#ffffff', shade(sk.tailTip || '#ffffff', -0.12));
        break;
      case 'puff':
        box(c, -3, 3, D - 1, D + 3, tz, tz + 5, '#ffffff', '#e8e8ee');
        break;
      case 'curly':
        c.strokeStyle = sk.front;
        c.lineWidth = 1.8;
        c.beginPath(); c.arc(0, P(D + 2, tz + 2), 3, 0, 5.5); c.stroke();
        break;
      case 'stub':
        box(c, -2.5, 2.5, D - 1, D + 3, tz, tz + 4, sk.top, sk.front);
        break;
      case 'dino':
        box(c, -4, 4, D - 1, D + 5, lift + 2, lift + 10, sk.top, sk.front);
        box(c, -3, 3, D + 4, D + 9, lift + 1, lift + 7, sk.top, sk.front);
        box(c, -2, 2, D + 8, D + 12, lift, lift + 4, sk.top, sk.front);
        if (sk.spikes) for (const [y, z] of [[D + 2, lift + 10], [D + 6.5, lift + 7]]) box(c, -1, 1, y - 1, y + 1, z, z + 3, sk.spikes, shade(sk.spikes, -0.2));
        break;
    }
    // paws
    c.fillStyle = sk.feet;
    for (const fx of [-7, 3]) box(c, fx, fx + 4, D - 5, D - 1, 0, lift + 1, sk.feet, shade(sk.feet, -0.2));
    for (const fx of [-7, 3]) box(c, fx, fx + 4, -D - 1, -D + 3, 0, lift + 1, sk.feet, shade(sk.feet, -0.2));
    // wings (dragons)
    if (sk.wingTop) {
      const wz = lift + h * 0.5 + (p.flap || 0) * 6;
      for (const s of [-1, 1]) {
        const a = s < 0 ? -hw - 7 : hw, b = s < 0 ? -hw : hw + 7;
        box(c, a, b, -2, 6, wz, wz + 3, sk.wingTop, sk.wingFront);
        box(c, s < 0 ? -hw - 10 : hw + 6, s < 0 ? -hw - 6 : hw + 10, 0, 5, wz + 3, wz + 9, sk.wingTop, sk.wingFront);
      }
    }
    // body outline, then the body
    c.fillStyle = 'rgba(30,22,10,0.4)';
    c.fillRect(-hw - 1.2, P(D, top) - 1.2, hw * 2 + 2.4, P(-D, lift) - P(D, top) + 2.4);
    if (sk.pattern === 'panda') { // black arms
      for (const s of [-1, 1]) box(c, s < 0 ? -hw - 1.5 : hw, s < 0 ? -hw : hw + 1.5, -6, 4, lift + 1, lift + h * 0.6, INK, '#111');
    }
    box(c, -hw, hw, -D, D, lift, top, sk.top, sk.front);
    // markings
    if (sk.pattern !== 'panda' && sk.pattern !== 'rivets') {
      c.fillStyle = mix(sk.front, belly, 0.55);
      c.fillRect(-hw * 0.55, P(-D, lift + h * 0.5), hw * 1.1, h * 0.4 * GZ);
    }
    c.fillStyle = pc;
    if (sk.pattern === 'stripes') {
      for (const y of [-5, 0, 5]) c.fillRect(-hw, P(y, top) - 0.8, hw * 2, 1.6);
      for (const x of [-hw, hw - 2.2]) for (const z of [top - 3, top - 8, top - 13]) c.fillRect(x, P(-D, z), 2.2, 2.2 * GZ);
    } else if (sk.pattern === 'spots') {
      for (const [x, y, w, d] of [[-7, 4, 5, 3], [2, -4, 6, 3], [4, 5, 3, 2]]) c.fillRect(x, P(y, top) - d * GY, w, d * GY);
      for (const [x, z, w, d] of [[-hw + 1, top - 4, 5, 4], [hw - 6, lift + 5, 4, 3]]) c.fillRect(x, P(-D, z), w, d * GZ);
    } else if (sk.pattern === 'rivets') {
      c.fillStyle = shade(sk.front, -0.35);
      for (const x of [-hw + 1.5, hw - 2.5]) for (const z of [top - 2, lift + 2.5]) c.fillRect(x, P(-D, z), 1.2, 1.2);
      c.fillRect(-hw, P(0, top) - 0.4, hw * 2, 0.8);
    } else if (sk.pattern === 'lava') {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = pc;
      c.lineWidth = 1.2;
      c.globalAlpha = 0.7 + 0.3 * Math.sin(time * 3);
      c.beginPath();
      c.moveTo(-hw + 2, P(-D, top - 3)); c.lineTo(-3, P(-D, top - 8)); c.lineTo(1, P(-D, lift + 5)); c.lineTo(hw - 3, P(-D, lift + 2));
      c.moveTo(-hw + 1, P(4, top)); c.lineTo(-1, P(-2, top)); c.lineTo(hw - 2, P(3, top));
      c.stroke();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    if (sk.spikes) { // down the back
      for (const y of [-5, -1, 3, 7]) {
        box(c, -1.6, 1.6, y - 1.4, y + 1.4, top, top + 3, sk.spikes, shade(sk.spikes, -0.2));
        box(c, -0.8, 0.8, y - 0.7, y + 0.7, top + 3, top + 5, sk.spikes, shade(sk.spikes, -0.2));
      }
    }
    // ears and horns (tall ears tuck under a hat)
    const earCol = sk.earColor || sk.top, earF = sk.earColor ? shade(sk.earColor, -0.2) : sk.front, inner = sk.earIn || shade(sk.front, -0.1);
    const ears = sk.ears;
    if (ears && !(hat && ['cat', 'fox', 'bunny', 'round', 'pig'].includes(ears))) {
      for (const s of [-1, 1]) {
        const ex = s < 0 ? -hw + 1 : hw - 6;
        if (ears === 'cat' || ears === 'fox') {
          const tall = ears === 'fox' ? 1.4 : 1;
          box(c, ex, ex + 5, -2, 3, top, top + 3 * tall, earCol, earF);
          box(c, ex + 1, ex + 4, -1.5, 2.5, top + 3 * tall, top + 5.5 * tall, earCol, earF);
          box(c, ex + 1.8, ex + 3.2, -1, 2, top + 5.5 * tall, top + 7.5 * tall, earCol, earF);
          c.fillStyle = inner;
          c.fillRect(ex + 1.5, P(-2, top + 4 * tall), 2, 3 * tall * GZ);
        } else if (ears === 'bunny') {
          const flop = Math.sin(time * 2 + s) * 0.6;
          box(c, ex + 0.5, ex + 4, -1, 2, top, top + 12 + flop, earCol, earF);
          c.fillStyle = inner;
          c.fillRect(ex + 1.5, P(-1, top + 11 + flop), 1.6, 9 * GZ);
        } else if (ears === 'round') {
          box(c, ex, ex + 5, 0, 4, top, top + 4, earCol, earF);
          c.fillStyle = sk.earIn || shade(earCol, 0.25);
          c.fillRect(ex + 1.5, P(0, top + 3), 2, 2 * GZ);
        } else if (ears === 'pig') {
          box(c, ex, ex + 5, -4, 0, top, top + 3, earCol, earF);
        } else if (ears === 'mouse' || ears === 'koala' || ears === 'monkey') {
          const r = ears === 'mouse' ? 5.5 : ears === 'koala' ? 5 : 3.6;
          const ox = ears === 'monkey' ? s * (hw + 2) : s * (hw - 2), oz = ears === 'monkey' ? top - 7 : top + 3;
          c.fillStyle = shade(earCol, -0.15);
          c.beginPath(); c.arc(ox, P(1, oz), r, 0, 6.2832); c.fill();
          c.fillStyle = earCol;
          c.beginPath(); c.arc(ox, P(1, oz) - 0.6, r - 0.8, 0, 6.2832); c.fill();
          c.fillStyle = inner;
          c.beginPath(); c.arc(ox, P(1, oz) - 0.3, r * 0.55, 0, 6.2832); c.fill();
        } else if (ears === 'dog') {
          box(c, s < 0 ? -hw - 2 : hw, s < 0 ? -hw : hw + 2, -6, 0, top - 11, top - 1, earCol, earF);
        } else if (ears === 'cow') {
          box(c, s < 0 ? -hw - 4 : hw, s < 0 ? -hw : hw + 4, -3, 1, top - 4, top - 1.5, sk.top, sk.front);
        }
      }
    }
    if (sk.horns) {
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -hw + 1.5 : hw - 4.5;
        box(c, x0, x0 + 3, -4, -1, top, top + 3, sk.horns, shade(sk.horns, -0.25));
        box(c, x0 + s * 1 + 0.5, x0 + s * 1 + 2.5, -3.5, -1.5, top + 3, top + 5.5, sk.horns, shade(sk.horns, -0.25));
      }
    }
    if (sk.antenna) {
      c.fillStyle = '#56616f';
      c.fillRect(-0.8, P(0, top + 9), 1.6, 9 * GZ);
      c.fillStyle = Math.sin(time * 5) > 0 ? '#ff3b3b' : '#7a1c1c';
      c.beginPath(); c.arc(0, P(0, top + 10), 2.2, 0, 6.2832); c.fill();
    }
    if (sk.antennae) {
      c.strokeStyle = sk.antennae;
      c.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        const bob = Math.sin(time * 4 + s) * 1.2;
        c.beginPath(); c.moveTo(s * 3, P(0, top)); c.lineTo(s * 6 + bob, P(0, top + 9)); c.stroke();
        c.fillStyle = '#e9ff7a';
        c.beginPath(); c.arc(s * 6 + bob, P(0, top + 9.5), 2, 0, 6.2832); c.fill();
      }
    }
    // face
    const ez = top - 7;
    const eyeCol = sk.eyeColor || INK;
    const eye = (ex, size = 1) => {
      if (sk.eyes === 'glow') {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = eyeCol;
        c.globalAlpha = 0.45;
        c.beginPath(); c.arc(ex + 1.75, P(-D, ez - 2), 4, 0, 6.2832); c.fill();
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = blink ? shade(eyeCol, -0.3) : '#ffffff';
        c.fillRect(ex, P(-D, ez), 3.5, (blink ? 1 : 3.5) * GZ);
        return;
      }
      if (sk.eyes === 'big') {
        const cx = ex + 1.75, cy = P(-D, ez - 2);
        if (blink) { c.fillStyle = INK; c.fillRect(ex - 0.5, cy, 4.5, 1.2); return; }
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(cx, cy, 2.9 * size, 0, 6.2832); c.fill();
        c.fillStyle = sk.eyeColor || INK;
        c.beginPath(); c.arc(cx + 0.3, cy + 0.3, 1.6 * size, 0, 6.2832); c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(cx - 0.6, cy - 1.2, 1.1, 1.1);
        return;
      }
      c.fillStyle = eyeCol;
      if (blink) { c.fillRect(ex, P(-D, ez - 2), 3.5, 1.2); return; }
      c.fillRect(ex, P(-D, ez), 3.5, 4.5 * GZ);
      c.fillStyle = '#fff';
      c.fillRect(ex + 0.6, P(-D, ez) + 0.6, 1.4, 1.4);
    };
    const snoutCol = sk.snoutColor || belly;
    if (p.facing === 'down') {
      if (sk.snout === 'monkey') { // pale face
        c.fillStyle = snoutCol;
        c.fillRect(-hw * 0.75, P(-D, ez + 3), hw * 1.5, 13 * GZ);
      }
      if (sk.pattern === 'panda') {
        c.fillStyle = INK;
        for (const ex of [-8, 3]) { c.beginPath(); c.ellipse(ex + 2.5, P(-D, ez - 2), 3.8, 3.2, 0, 0, 6.2832); c.fill(); }
      }
      if (sk.pattern === 'patch') {
        c.fillStyle = pc;
        c.fillRect(1.5, P(-D, ez + 2.5), 7, 8 * GZ);
      }
      if (sk.eyes === 'visor') {
        c.fillStyle = '#1d2430';
        c.fillRect(-hw + 1.5, P(-D, ez + 1.5), hw * 2 - 3, 6 * GZ);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = eyeCol;
        const sweep = Math.sin(time * 2.5) * (hw - 5);
        c.fillRect(sweep - 3, P(-D, ez), 6, 3 * GZ);
        c.globalCompositeOperation = 'source-over';
      } else if (sk.eyes === 'one') {
        const cy = P(-D, ez - 1.5);
        if (blink) { c.fillStyle = INK; c.fillRect(-4, cy, 8, 1.4); }
        else {
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(0, cy, 4.6, 0, 6.2832); c.fill();
          c.fillStyle = INK;
          c.beginPath(); c.arc(Math.sin(time * 0.8) * 1.2, cy + 0.4, 2.4, 0, 6.2832); c.fill();
          c.fillStyle = '#ffffff';
          c.fillRect(-1.6, cy - 2.2, 1.6, 1.6);
        }
      } else {
        eye(-7); eye(3.5);
      }
      if (sk.cheeks) {
        c.fillStyle = 'rgba(255,120,140,0.5)';
        c.fillRect(-10, P(-D, ez - 6), 3, 2);
        c.fillRect(7, P(-D, ez - 6), 3, 2);
      }
      const nz = ez - 5;
      switch (sk.snout) {
        case 'cat': {
          c.fillStyle = sk.nose || '#ff8fa3';
          c.beginPath(); c.moveTo(-1.6, P(-D, nz + 1)); c.lineTo(1.6, P(-D, nz + 1)); c.lineTo(0, P(-D, nz - 0.6)); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(30,30,30,0.55)';
          c.lineWidth = 0.7;
          c.beginPath();
          for (const s of [-1, 1]) {
            c.moveTo(s * 3, P(-D, nz)); c.lineTo(s * (hw + 3), P(-D, nz + 1.2));
            c.moveTo(s * 3, P(-D, nz - 1)); c.lineTo(s * (hw + 3), P(-D, nz - 2));
          }
          c.stroke();
          break;
        }
        case 'dog':
          box(c, -3.5, 3.5, -D - 3, -D, nz - 4, nz + 1, snoutCol, shade(snoutCol, -0.15));
          box(c, -1.6, 1.6, -D - 3.2, -D - 1.5, nz - 0.5, nz + 1.2, sk.nose || INK, '#000');
          break;
        case 'pig':
          box(c, -4, 4, -D - 2.5, -D, nz - 4, nz + 1.5, sk.snoutColor || mix(sk.top, '#ff8fb0', 0.4), shade(sk.snoutColor || mix(sk.top, '#ff8fb0', 0.4), -0.15));
          c.fillStyle = shade(sk.front, -0.45);
          c.fillRect(-2.2, P(-D - 2.5, nz - 0.5), 1.4, 2);
          c.fillRect(0.8, P(-D - 2.5, nz - 0.5), 1.4, 2);
          break;
        case 'fox':
          box(c, -3, 3, -D - 4, -D, nz - 3.5, nz + 0.5, '#ffffff', '#e6e6e6');
          box(c, -1.2, 1.2, -D - 4.2, -D - 3, nz - 0.5, nz + 1, sk.nose || INK, '#000');
          break;
        case 'monkey':
          c.fillStyle = shade(snoutCol, -0.35);
          c.fillRect(-1.8, P(-D, nz), 1.2, 1.2);
          c.fillRect(0.6, P(-D, nz), 1.2, 1.2);
          c.fillRect(-3, P(-D, nz - 3), 6, 1);
          break;
        case 'koala':
          c.fillStyle = '#2b2b2b';
          c.beginPath(); c.ellipse(0, P(-D, nz), 3, 3.8, 0, 0, 6.2832); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(-1.5, P(-D, nz + 2), 1.2, 1.2);
          break;
      }
    } else if (p.facing !== 'up') {
      const s = p.facing === 'right' ? 1 : -1;
      if (sk.eyes === 'visor') {
        c.fillStyle = '#1d2430';
        c.fillRect(s > 0 ? hw - 9 : -hw, P(-D, ez + 1.5), 9, 6 * GZ);
        c.fillStyle = eyeCol;
        c.fillRect(s > 0 ? hw - 5 : -hw + 1, P(-D, ez), 4, 3 * GZ);
      } else if (sk.eyes === 'one') {
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(s * 4, P(-D, ez - 1.5), 3.8, 0, 6.2832); c.fill();
        c.fillStyle = INK;
        c.beginPath(); c.arc(s * 5.5, P(-D, ez - 1.2), 2, 0, 6.2832); c.fill();
      } else eye(s > 0 ? hw - 7 : -hw + 3.5);
      if (['dog', 'pig', 'fox'].includes(sk.snout)) {
        const col = sk.snout === 'fox' ? '#ffffff' : sk.snout === 'pig' ? (sk.snoutColor || mix(sk.top, '#ff8fb0', 0.4)) : snoutCol;
        box(c, s > 0 ? hw : -hw - 4, s > 0 ? hw + 4 : -hw, -3, 3, ez - 9, ez - 4, col, shade(col, -0.15));
      }
    }
    if (sk.stars) twinkles(c, hw, D, top, lift, time);
    if (sk.shine) glint(c, hw - 3, P(-D, top - 3), time, p.blinkSeed);
    if (hat) drawHat(c, hat, hw, D, top, p.facing, ez + 1);
    c.restore();
  }

  // ---- One-off characters ----------------------------------------------------------
  function faceDots(c, p, D, ez, blink, ink = INK, gap = 7) {
    if (p.facing === 'up') return;
    const s = p.facing === 'right' ? 1 : p.facing === 'left' ? -1 : 0;
    c.fillStyle = ink;
    for (const ex of s ? [s * gap * 0.6] : [-gap / 2 - 1.5, gap / 2 - 1.5]) {
      if (blink) c.fillRect(ex, P(-D, ez - 2), 3, 1.2);
      else {
        c.fillRect(ex, P(-D, ez), 3, 4 * GZ);
        c.fillStyle = '#fff';
        c.fillRect(ex + 0.5, P(-D, ez) + 0.5, 1.2, 1.2);
        c.fillStyle = ink;
      }
    }
  }

  function begin(c, p, pivot) {
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, pivot);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
  }

  function ghostSkin(c, p, time, sk, hat) {
    const sq = p.squash + (p.breath || 0), bob = Math.sin(time * 3 + (p.blinkSeed || 0)) * 1.6;
    const hw = 11 * (1 + sq * 0.15), D = 9, h = 22 * (1 - sq * 0.2), lift = 5 + bob, top = lift + h;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    begin(c, p, lift + h / 2);
    c.globalAlpha *= 0.9;
    aura(c, 'rgba(200,220,255,0.18)', lift + h * 0.5, time, 20);
    box(c, -hw, hw, -D, D, lift, top, sk.top, sk.front);
    box(c, -hw + 2.5, hw - 2.5, -D + 2, D - 2, top, top + 3, sk.top, sk.front);
    c.fillStyle = sk.front; // the wavy hem
    const n = 4, w = (hw * 2) / n;
    for (let k = 0; k < n; k++) {
      c.beginPath(); c.arc(-hw + w * (k + 0.5), P(-D, lift), w / 2, 0, Math.PI); c.fill();
    }
    for (const s of [-1, 1]) { // little arms
      const wave = Math.sin(time * 4 + s) * 2 + (p.flap || 0) * 5;
      box(c, s < 0 ? -hw - 3 : hw, s < 0 ? -hw : hw + 3, -3, 3, lift + h * 0.45 + wave, lift + h * 0.45 + wave + 5, sk.top, sk.front);
    }
    const ez = top - 7;
    if (p.facing !== 'up') {
      faceDots(c, p, D, ez, blink, '#2b2b40', 9);
      if (p.facing === 'down') {
        c.fillStyle = '#2b2b40';
        c.beginPath(); c.ellipse(0, P(-D, ez - 7), 1.8, 2.4, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,140,170,0.45)';
        c.fillRect(-10, P(-D, ez - 5), 3, 2);
        c.fillRect(7, P(-D, ez - 5), 3, 2);
      }
    }
    if (hat) drawHat(c, hat, hw - 2, D - 2, top + 3, p.facing, ez + 1);
    c.restore();
  }

  function slimeSkin(c, p, time, sk, hat) {
    const sq = p.squash + (p.breath || 0) + Math.sin(time * 4 + (p.blinkSeed || 0)) * 0.04;
    const rw = 13 * (1 + sq * 0.3), rh = 14 * (1 - sq * 0.35);
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    begin(c, p, rh / 2);
    const cy = P(-2, rh * 0.62);
    c.fillStyle = 'rgba(20,60,20,0.35)';
    c.beginPath(); c.ellipse(0, cy + 1, rw + 1.2, rh * 0.85 + 1.2, 0, 0, 6.2832); c.fill();
    const g = c.createLinearGradient(0, cy - rh, 0, cy + rh);
    g.addColorStop(0, sk.top);
    g.addColorStop(1, sk.front);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, cy, rw, rh * 0.85, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; // bubbles inside
    for (const [bx, by, br] of [[-5, 4, 1.6], [6, 2, 1.1], [2, 6, 0.9]]) { c.beginPath(); c.arc(bx, cy + by, br, 0, 6.2832); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(-rw * 0.45, cy - rh * 0.45, 2.8, 1.6, -0.5, 0, 6.2832); c.fill();
    if (p.facing !== 'up') {
      const s = p.facing === 'right' ? 1 : p.facing === 'left' ? -1 : 0;
      c.fillStyle = INK;
      for (const ex of s ? [s * 5] : [-5, 4]) {
        if (blink) c.fillRect(ex - 1, cy - 2, 3, 1);
        else { c.beginPath(); c.ellipse(ex, cy - 2, 1.5, 2.2, 0, 0, 6.2832); c.fill(); }
      }
      if (!s) { c.beginPath(); c.arc(0, cy + 2, 2, 0.15, Math.PI - 0.15); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
    }
    if (hat) drawHat(c, hat, rw * 0.7, 7, rh * 1.2, p.facing, rh * 0.7);
    c.restore();
  }

  function snowmanSkin(c, p, time, sk, hat) {
    const sq = p.squash + (p.breath || 0), k = 1 - sq * 0.2;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    begin(c, p, 14);
    const z1 = 11 * k, z2 = 21 * k, z3 = 30 * k;
    box(c, -11, 11, -9, 9, 0, z1, sk.top, sk.front);
    box(c, -8, 8, -7, 7, z1, z2, sk.top, sk.front);
    box(c, -6.5, 6.5, -6, 6, z2, z3, sk.top, sk.front);
    c.fillStyle = '#2b2b2b';
    for (const z of [z1 + 2.5, z1 + 6.5]) c.fillRect(-1, P(-7, z), 2, 2); // buttons
    box(c, -8.5, 8.5, -7.5, 7.5, z2 - 1.5, z2 + 1.2, '#e63946', '#b8222e'); // scarf
    box(c, 3, 6, -8, -7.5, z2 - 8, z2 - 1.5, '#e63946', '#b8222e');
    c.strokeStyle = '#6b4a2a'; // stick arms
    c.lineWidth = 1.4;
    const wave = (p.flap || 0) * 5;
    c.beginPath();
    c.moveTo(-8, P(0, z2 - 4)); c.lineTo(-15, P(0, z2 + 2 + wave));
    c.moveTo(8, P(0, z2 - 4)); c.lineTo(15, P(0, z2 + 2 + wave));
    c.stroke();
    if (p.facing !== 'up') {
      faceDots(c, { facing: p.facing }, 6, z3 - 3, blink, '#2b2b2b', 6);
      if (p.facing === 'down') box(c, -1, 1, -11, -6, z3 - 6.5, z3 - 4.5, '#ff8c1a', '#e06a00');
      else { const s = p.facing === 'right' ? 1 : -1; box(c, s > 0 ? 6.5 : -11.5, s > 0 ? 11.5 : -6.5, -1, 1, z3 - 6.5, z3 - 4.5, '#ff8c1a', '#e06a00'); }
    }
    if (hat) drawHat(c, hat, 6.5, 6, z3, p.facing, z3 - 3);
    c.restore();
  }

  function pumpkinSkin(c, p, time, sk, hat) {
    const sq = p.squash + (p.breath || 0), k = 1 - sq * 0.22;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    begin(c, p, 10);
    for (const fx of [-6, 3]) box(c, fx, fx + 3.5, -2, 2, 0, 3, '#3f6b27', '#2d4f1c');
    const top = 3 + 17 * k;
    box(c, -12, 12, -10, 10, 3, top, sk.top, sk.front);
    c.fillStyle = shade(sk.front, -0.18); // ridges
    for (const x of [-6.5, 0, 6.5]) c.fillRect(x - 0.6, P(-10, top), 1.2, (top - 3) * GZ);
    for (const x of [-6.5, 0, 6.5]) c.fillRect(x - 0.6, P(10, top), 1.2, 20 * GY);
    box(c, -1.5, 1.5, -1.5, 1.5, top, top + 5, '#5a8f3a', '#3f6b27');
    box(c, 1.5, 6, -1, 1, top + 1, top + 2.5, '#7fb85a', '#5a8f3a');
    if (p.facing === 'down') {
      const ez = top - 5;
      c.fillStyle = '#3a1a00';
      for (const ex of [-6, 3]) {
        c.beginPath(); c.moveTo(ex, P(-10, ez - (blink ? 2 : 4))); c.lineTo(ex + 3, P(-10, ez)); c.lineTo(ex + 6, P(-10, ez - (blink ? 2 : 4))); c.closePath(); c.fill();
      }
      c.beginPath(); // jagged grin
      c.moveTo(-7, P(-10, ez - 7));
      for (let i = 0; i <= 6; i++) c.lineTo(-7 + i * (14 / 6), P(-10, ez - (i % 2 ? 9.5 : 7.5)));
      c.lineTo(7, P(-10, ez - 11)); c.lineTo(-7, P(-10, ez - 11)); c.closePath(); c.fill();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,200,60,${0.25 + 0.1 * Math.sin(time * 9)})`;
      c.fillRect(-6, P(-10, ez - 8), 12, 2);
      c.globalCompositeOperation = 'source-over';
    } else if (p.facing !== 'up') {
      const s = p.facing === 'right' ? 1 : -1;
      c.fillStyle = '#3a1a00';
      c.beginPath(); c.moveTo(s * 5, P(-10, top - 9)); c.lineTo(s * 8, P(-10, top - 5)); c.lineTo(s * 11, P(-10, top - 9)); c.closePath(); c.fill();
    }
    if (hat) drawHat(c, hat, 10, 8, top, p.facing, top - 5);
    c.restore();
  }

  function burgerSkin(c, p, time, sk, hat) {
    const sq = p.squash + (p.breath || 0), k = 1 - sq * 0.22;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    begin(c, p, 12);
    for (const fx of [-6, 3]) box(c, fx, fx + 3.5, -2, 2, 0, 3, '#c9802f', '#a8641f');
    let z = 3;
    const layer = (hgt, a, b, inset = 0) => { box(c, -12 + inset, 12 - inset, -10 + inset, 10 - inset, z, z + hgt * k, a, b); z += hgt * k; };
    layer(4, '#e8a24a', '#c9802f');            // bottom bun
    layer(4, '#6b3a1e', '#4a2612', -0.5);      // patty
    layer(1.5, '#ffd23f', '#f0b400');          // cheese
    c.fillStyle = '#f0b400';
    for (const x of [-8, 1, 6]) c.fillRect(x, P(-10, z - 1.5), 2.5, 3.5);
    c.fillStyle = '#5ad14a'; // lettuce frill
    c.beginPath(); c.moveTo(-12.5, P(-10.5, z));
    for (let i = 0; i <= 10; i++) c.lineTo(-12.5 + i * 2.5, P(-10.5, z + (i % 2 ? 2 : 0)));
    c.lineTo(12.5, P(-10.5, z - 1)); c.lineTo(-12.5, P(-10.5, z - 1)); c.closePath(); c.fill();
    z += 1;
    layer(2, '#e63946', '#b8222e', 1);         // tomato
    layer(6, '#f0b25a', '#d4903a');            // top bun
    box(c, -9, 9, -7, 7, z, z + 3 * k, '#f0b25a', '#d4903a');
    const top = z + 3 * k;
    c.fillStyle = '#fff6e0'; // sesame
    for (const [x, y] of [[-5, 2], [0, -3], [4, 3], [-2, 5], [6, -2]]) c.fillRect(x, P(y, top) - 0.6, 1.8, 1.1);
    if (p.facing !== 'up') faceDots(c, p, 10, z - 1, blink, INK, 8);
    if (hat) drawHat(c, hat, 9, 7, top, p.facing, z - 1);
    c.restore();
  }

  // Rough height of the top of a character's head (for things carried on it).
  function headTop(sk) {
    switch (sk.kind) {
      case 'bigj': return 50;
      case 'snowman': return 32;
      case 'ghost': return 32;
      case 'burger': return 28;
      case 'slime': return 18;
      case 'pumpkin': return 25;
      case 'critter': return sk.ears === 'bunny' ? 34 : 24;
      default: return 27;
    }
  }

  // Rainbow skins cycle through every colour.
  function rainbowize(sk, time) {
    const h = time * 80;
    return {
      ...sk, top: hslHex(h, 0.9, 0.78), front: hslHex(h, 0.85, 0.56), wingTop: hslHex(h + 60, 0.9, 0.72), wingFront: hslHex(h + 60, 0.85, 0.5),
      comb: [hslHex(h + 180, 0.9, 0.65), hslHex(h + 180, 0.85, 0.5)], feet: hslHex(h + 120, 0.8, 0.58),
    };
  }

  function player(c, p, time, skin, hat) {
    const base = skin || SKINS.chick;
    if (p.flat) {
      pancake(c, base);
      if (p.sheet > 0) sheet(c, p.sheet);
      return;
    }
    const soot = p.char > 0 ? Math.min(1, p.char / 1.5) * 0.8 : 0;
    let sk = palette(base, soot);
    if (base.rainbow) sk = rainbowize(sk, time);
    switch (sk.kind) {
      case 'bigj': bigJ(c, p, time, sk, hat, soot); return;
      case 'critter': critter(c, p, time, sk, hat); return;
      case 'ghost': ghostSkin(c, p, time, sk, hat); return;
      case 'slime': slimeSkin(c, p, time, sk, hat); return;
      case 'snowman': snowmanSkin(c, p, time, sk, hat); return;
      case 'pumpkin': pumpkinSkin(c, p, time, sk, hat); return;
      case 'burger': burgerSkin(c, p, time, sk, hat); return;
    }
    const frog = sk.kind === 'frog', coon = sk.kind === 'raccoon', bird = sk.kind === 'bird';
    const W = frog ? 13 : 11, D = 10, H = frog ? 16 : coon ? 19 : 22, lift = 3;
    const sq = p.squash + (p.breath || 0);
    const hw = W * (1 + sq * 0.18), h = H * (1 - sq * 0.22);
    const top = lift + h;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    const belly = sk.belly || mix(sk.top, '#ffffff', 0.45), dark = shade(sk.front, -0.25);
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, lift + h / 2);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
    if (sk.glow) { // aura for the fancy level skins
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = sk.glow;
      c.beginPath(); c.arc(0, P(0, lift + h * 0.55), 19 + Math.sin(time * 3) * 1.5, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
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
    if (sk.belly) { // penguin: a big white front
      c.fillStyle = sk.belly;
      c.fillRect(-hw * 0.7, P(-D, lift + h * 0.72), hw * 1.4, h * 0.7 * GZ);
    } else if (!frog) { // lighter belly
      c.fillStyle = mix(sk.front, belly, 0.55);
      c.fillRect(-hw * 0.55, P(-D, lift + h * 0.55), hw * 1.1, h * 0.45 * GZ);
    } else { // frog spots
      c.fillStyle = dark;
      for (const [sx, sy] of [[-6, 4], [4, -2], [-1, 7], [7, 5]]) c.fillRect(sx, P(sy, top) - 1, 3, 2.4);
      c.fillStyle = belly;
      c.fillRect(-hw + 2, P(-D, lift + 6), hw * 2 - 4, 4 * GZ);
    }
    if (sk.marks) { // crash-test target markers
      for (const [mx, mz] of [[-hw * 0.45, lift + h * 0.7], [hw * 0.45, lift + h * 0.3]]) {
        const my = P(-D, mz);
        c.fillStyle = '#16181c';
        c.beginPath(); c.arc(mx, my, 3.2, 0, 6.2832); c.fill();
        c.fillStyle = '#ffd84a';
        c.beginPath(); c.moveTo(mx, my); c.arc(mx, my, 3.2, 0, Math.PI / 2); c.fill();
        c.beginPath(); c.moveTo(mx, my); c.arc(mx, my, 3.2, Math.PI, Math.PI * 1.5); c.fill();
      }
    }
    if (sk.zombie) { // stitches and a patch
      c.fillStyle = '#4d5a44';
      c.fillRect(-hw + 2, P(-D, lift + h * 0.4), hw * 1.2, 1);
      for (let x = -hw + 3; x < -hw + 2 + hw * 1.2; x += 3) c.fillRect(x, P(-D, lift + h * 0.4) - 1.5, 1, 4);
      c.fillStyle = '#9ab08b';
      c.fillRect(hw - 7, P(D - 4, top) - 1, 5, 4);
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
    if (sk.antenna) { // robot antenna with a blinking tip
      c.fillStyle = '#56616f';
      c.fillRect(-0.8, P(0, top + 10), 1.6, 10 * GZ);
      c.fillStyle = Math.sin(time * 5) > 0 ? '#ff3b3b' : '#7a1c1c';
      c.beginPath(); c.arc(0, P(0, top + 11), 2.2, 0, 6.2832); c.fill();
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
    if (sk.hat === 'hardhat' && !hat) {
      box(c, -hw - 2, hw + 2, -D - 2, D + 1, top, top + 2, '#ffd23f', '#e0a100');
      box(c, -hw + 2, hw - 2, -D + 2, D - 2, top + 2, top + 8, '#ffe066', '#f2b705');
      c.fillStyle = '#e0a100';
      c.fillRect(-1, P(-D + 2, top + 8), 2, 6 * GZ);
    }
    if (sk.shine && ((time * 1.3 + (p.blinkSeed || 0)) % 2.2) < 0.18) { // golden glint
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,255,220,0.9)';
      starPath(c, hw - 3, P(-D, top - 3), 5, 1.2);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    // face
    const ez = top - 6;
    const eye = ex => {
      c.fillStyle = sk.eyeColor || '#1d1d1f';
      if (blink) { c.fillRect(ex, P(-D, ez - 2), 3.5, 1.2); return; }
      c.fillRect(ex, P(-D, ez), 3.5, 4.5 * GZ);
      c.fillStyle = '#fff';
      c.fillRect(ex + 0.6, P(-D, ez) + 0.6, 1.4, 1.4);
    };
    const mask = x0 => { c.fillStyle = '#1f2125'; c.fillRect(x0, P(-D, ez + 3), hw * 2 - 2, 7 * GZ); };
    const bill = sk.bill ? 3 : 0, bb = sk.bigBeak ? 2 : 0;
    const beak = (x0, x1, y0, y1) => {
      box(c, x0, x1, y0, y1, top - 11 - bb, top - 8 + bb, sk.beak[0], sk.beak[1]);
      box(c, x0 + 0.5, x1 - 0.5, y0 + 0.5, y1, top - 13 - bb, top - 11 - bb, sk.beak[1], shade(sk.beak[1], -0.2));
    };
    if (p.facing === 'down') {
      if (coon) mask(-hw + 1);
      if (frog) {
        c.fillStyle = '#2d6b2a';
        c.fillRect(-7, P(-D, top - 8), 14, 1.5);
      } else {
        eye(-7); eye(3.5);
      }
      if (sk.beak) beak(-3 - bill - bb, 3 + bill + bb, -D - 5 - bb * 2, -D);
      if (sk.glasses) { // round specs
        c.strokeStyle = '#3a3a3a';
        c.lineWidth = 1;
        for (const ex of [-5.25, 5.25]) { c.beginPath(); c.arc(ex, P(-D - 0.5, ez - 2), 3.4, 0, 6.2832); c.stroke(); }
        c.beginPath(); c.moveTo(-1.9, P(-D - 0.5, ez - 2)); c.lineTo(1.9, P(-D - 0.5, ez - 2)); c.stroke();
      }
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
      if (sk.beak) beak(s > 0 ? hw : -hw - 6 - bill - bb * 2, s > 0 ? hw + 6 + bill + bb * 2 : -hw, -3, 3);
      if (coon) box(c, s > 0 ? hw : -hw - 4, s > 0 ? hw + 4 : -hw, -3, 3, ez - 7, ez - 3, mix(sk.top, '#ffffff', 0.5), sk.top);
    }
    if (sk.zombie && p.facing === 'down' && !blink) { // one droopy eye
      c.fillStyle = '#e8e8d0';
      c.fillRect(3, P(-D, ez), 4.5, 5 * GZ);
      c.fillStyle = '#1d1d1f';
      c.fillRect(4.5, P(-D, ez - 2), 1.5, 1.5);
    }
    if (sk.stars) twinkles(c, hw, D, top, lift, time);
    if (hat) drawHat(c, hat, hw, D, top + (frog ? 4 : 0), p.facing, ez);
    c.restore();
  }

  // Big J: a grey body under a round helmet with a red, very unimpressed face.
  function bigJ(c, p, time, sk, hat, soot) {
    const sq = p.squash + (p.breath || 0), lift = 3;
    const blink = ((time + (p.blinkSeed || 0)) % 3.3) < 0.12;
    const G = sk.top, GF = sk.front, dark = shade(GF, -0.25);
    const faceCol = sk.face === 'rainbow' ? hslHex(time * 90, 0.9, 0.55) : sk.face || '#ff1a1a';
    const red = soot ? mix(faceCol, '#2a2522', soot) : faceCol, ink = sk.ink || '#1d1b3a';
    c.save();
    c.translate(0, P(0, p.z));
    if (p.rot) {
      const pv = P(0, 16);
      c.translate(0, pv);
      c.rotate(p.rot);
      c.translate(0, -pv);
    }
    if (sk.glow) aura(c, sk.glow, 26, time, 22);
    // legs and body
    for (const fx of [-6, 3]) {
      box(c, fx, fx + 3.5, -2, 2, 0, lift + 2, sk.feet, dark);
      c.fillStyle = dark;
      c.fillRect(fx - 1, P(-4, 0.8), 5.5, 1.6);
    }
    const bh = 12 * (1 - sq * 0.2);
    c.fillStyle = 'rgba(20,20,24,0.35)';
    c.fillRect(-9.2, P(6, lift + bh) - 1.2, 18.4, P(-6, lift) - P(6, lift + bh) + 2.4);
    box(c, -8, 8, -6, 6, lift, lift + bh, G, GF);
    const flap = (p.flap || 0) * 4;
    box(c, -11, -8, -3, 3, lift + 3 + flap, lift + 9 + flap, G, GF); // arms
    box(c, 8, 11, -3, 3, lift + 3 + flap, lift + 9 + flap, G, GF);
    // helmet head
    const R = 12 * (1 + sq * 0.12), hz = lift + bh + 11;
    const s = p.facing === 'right' ? 1 : p.facing === 'left' ? -1 : 0;
    const rage = sk.neutral ? 0 : Math.min(1, p.rage || 0); // Big J boils over with every close call
    const shake = rage > 0.45 ? (rage - 0.45) * 2.4 : 0;
    const cx = shake ? Math.sin(time * 61) * shake : 0, cy = P(-3, hz) + (shake ? Math.cos(time * 47) * shake * 0.6 : 0);
    c.fillStyle = '#80838c'; // side tabs and the top tab
    c.fillRect(cx - R - 3.2, cy - 3.5, 4.5, 7);
    c.fillRect(cx + R - 1.3, cy - 3.5, 4.5, 7);
    c.fillRect(cx - 6, cy - R - 3.2, 12, 5);
    c.fillStyle = 'rgba(20,20,24,0.35)';
    c.beginPath(); c.arc(cx, cy, R + 1.2, 0, 6.2832); c.fill();
    c.fillStyle = '#7d808a';
    c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
    c.fillStyle = '#979aa3';
    c.beginPath(); c.arc(cx, cy, R - 1.4, 0, 6.2832); c.fill();
    c.fillStyle = '#6c6f78';
    c.beginPath(); c.arc(cx, cy, R - 2.6, 0, 6.2832); c.fill();
    if (p.facing === 'up') { // the back of the helmet
      c.fillStyle = '#8a8d96';
      c.beginPath(); c.arc(cx, cy, R - 3.2, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(cx - 0.6, cy - R + 3.5, 1.2, 2 * R - 7);
    } else {
      const fx = cx + s * 2.2;
      if (sk.neutral && (p.rage || 0) > 0.25) { // Big S: a cool blue calm, face unchanged
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(90,150,255,${0.1 + 0.25 * p.rage})`;
        c.beginPath(); c.arc(fx, cy, R + 2 + p.rage * 5, 0, 6.2832); c.fill();
        c.restore();
      }
      if (rage > 0.25) { // a hot red glow around the face
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(255,40,20,${(0.12 + 0.3 * rage) * (0.75 + 0.25 * Math.sin(time * (6 + rage * 10)))})`;
        c.beginPath(); c.arc(fx, cy, R + 3 + rage * 4, 0, 6.2832); c.fill();
        c.restore();
      }
      c.fillStyle = rage > 0 ? mix(red, '#c80000', rage * 0.55) : red;
      c.beginPath(); c.arc(fx, cy, R - 3.2, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.beginPath(); c.arc(fx - 3, cy - 3, 3, 0, 6.2832); c.fill();
      c.strokeStyle = ink;
      c.fillStyle = ink;
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      if (sk.stars) { // a little night sky in the face
        for (const [dx, dy, ph] of [[-4, -4, 0.1], [4, -2, 0.6], [-1, 4, 0.3], [5, 4, 0.9], [-5, 2, 0.5]]) {
          c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 2 + ph * 6));
          c.fillStyle = '#ffffff';
          c.fillRect(fx + dx - 0.6, cy + dy - 0.6, 1.2, 1.2);
        }
        c.globalAlpha = 1;
        c.fillStyle = ink;
      }
      if (sk.faceStyle === 'happy') { // Big G: ^ ^ and a big grin
        for (const ex of [-2.1, 2.1]) {
          c.beginPath();
          if (blink) { c.moveTo(fx + ex - 1.3, cy - 1); c.lineTo(fx + ex + 1.3, cy - 1); }
          else c.arc(fx + ex, cy - 0.4, 1.4, Math.PI * 1.1, Math.PI * 1.9);
          c.stroke();
        }
        c.beginPath(); c.arc(fx, cy + 1.6, 3.6, 0.2, Math.PI - 0.2); c.stroke();
      } else if (sk.faceStyle === 'shock') { // Big P: :O
        for (const ex of [-2.4, 2.4]) {
          c.beginPath(); c.arc(fx + ex, cy - 1.6, blink ? 0.5 : 1.3, 0, 6.2832); c.fill();
          c.beginPath(); c.moveTo(fx + ex - 1.4, cy - 4.8); c.lineTo(fx + ex + 1.4, cy - 5.4 + (ex > 0 ? 0 : 0.6)); c.stroke();
        }
        c.beginPath(); c.ellipse(fx, cy + 3.6, 1.8, 2.4, 0, 0, 6.2832); c.stroke();
      } else if (sk.faceStyle === 'sleepy') { // Big O: half asleep
        for (const ex of [-2.4, 2.4]) { c.beginPath(); c.moveTo(fx + ex - 1.5, cy - 0.6); c.lineTo(fx + ex + 1.5, cy + 0.2); c.stroke(); }
        c.beginPath(); c.moveTo(fx - 1.5, cy + 4); c.lineTo(fx + 1.5, cy + 4); c.stroke();
        const zt = (time * 0.6) % 1;
        c.globalAlpha = 1 - zt;
        c.font = `900 ${5 + zt * 3}px ${UI_FONT}`;
        c.fillText('z', fx + R * 0.6 + zt * 4, cy - R * 0.7 - zt * 8);
        c.globalAlpha = 1;
      } else if (sk.neutral) { // Big S: :|  two eyes and a flat mouth, no feelings at all
        if (blink) {
          c.fillRect(fx - 3.2, cy - 1, 2.2, 0.8);
          c.fillRect(fx + 1, cy - 1, 2.2, 0.8);
        } else {
          c.fillRect(fx - 2.9, cy - 3, 1.6, 3.4);
          c.fillRect(fx + 1.3, cy - 3, 1.6, 3.4);
        }
        c.beginPath(); // the |
        c.moveTo(fx - 3.2, cy + 4.4); c.lineTo(fx + 3.2, cy + 4.4);
        c.stroke();
      } else {
        const w = 2.3 + rage * 1.4, top = cy - 6.2 - rage * 0.8;
        c.lineWidth = 1.3 + rage * 0.9;
        c.beginPath(); // the V, steeper and heavier the angrier he gets
        c.moveTo(fx - w, top); c.lineTo(fx, cy - 2.6 + rage * 0.9); c.lineTo(fx + w, top);
        c.stroke();
        const eh = 1.7 * (1 - rage * 0.45);
        if (rage >= 1) c.fillStyle = '#fff4d6'; // maxed out: the eyes go white-hot
        if (blink && rage < 1) {
          c.fillRect(fx - 3.2, cy, 2.2, 0.8);
          c.fillRect(fx + 1, cy, 2.2, 0.8);
        } else {
          c.fillRect(fx - 2.9 - rage * 0.3, cy - 0.9 + rage * 0.6, 1.7 + rage * 0.4, eh);
          c.fillRect(fx + 1.2 - rage * 0.1, cy - 0.9 + rage * 0.6, 1.7 + rage * 0.4, eh);
        }
        c.fillStyle = ink;
        c.lineWidth = 1.3 + rage * 0.6;
        c.beginPath(); // frown
        c.arc(fx, cy + 6.4 + rage * 1.4, 3.4 + rage * 1.2, Math.PI * (1.18 - rage * 0.06), Math.PI * (1.82 + rage * 0.06));
        c.stroke();
        if (rage >= 0.5) { // the throbbing anger vein
          const vx = fx + R * 0.42, vy = cy - R * 0.4, vs = 1.6 + Math.sin(time * 14) * 0.35;
          c.strokeStyle = '#5c0000';
          c.lineWidth = 1.1;
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2 + Math.PI / 4;
            c.beginPath();
            c.arc(vx + Math.cos(a) * vs * 1.5, vy + Math.sin(a) * vs * 1.5, vs, a + Math.PI * 0.75, a + Math.PI * 1.25);
            c.stroke();
          }
        }
      }
      c.lineCap = 'butt';
    }
    if (sk.shine) glint(c, 7, cy - 6, time, p.blinkSeed);
    if (hat) drawHat(c, hat, 9, 6, hz + R / GZ - 1, p.facing, hz);
    c.restore();
  }

  function drawHat(c, hat, hw, D, top, facing, ez) {
    switch (hat) {
      case 'party': {
        const cols = ['#ff5c8a', '#ffd23f', '#34c6ea'];
        for (let i = 0; i < 4; i++) {
          const w = 7 - i * 1.7;
          box(c, -w, w, -w * 0.8, w * 0.8, top + i * 4, top + i * 4 + 4, cols[i % 3], shade(cols[i % 3], -0.25));
        }
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(0, P(0, top + 18), 2.6, 0, 6.2832); c.fill();
        break;
      }
      case 'shades':
        if (facing === 'up') { c.fillStyle = '#16181c'; c.fillRect(-hw, P(D, ez + 1), hw * 2, 1.5); break; }
        if (facing === 'down') {
          c.fillStyle = '#16181c';
          c.fillRect(-9, P(-D - 0.5, ez + 4), 7.5, 5 * GZ);
          c.fillRect(1.5, P(-D - 0.5, ez + 4), 7.5, 5 * GZ);
          c.fillRect(-2, P(-D - 0.5, ez + 3), 4, 1.3);
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.fillRect(-8, P(-D - 0.5, ez + 3.5), 2, 1.2);
          c.fillRect(2.5, P(-D - 0.5, ez + 3.5), 2, 1.2);
        } else {
          const s = facing === 'right' ? 1 : -1;
          c.fillStyle = '#16181c';
          c.fillRect(s > 0 ? hw - 8 : -hw, P(-D, ez + 4), 8, 5 * GZ);
          c.fillRect(-hw, P(-D, ez + 3), hw * 2, 1.2);
        }
        break;
      case 'cone':
        box(c, -9, 9, -8, 8, top, top + 2.5, '#f26722', '#c44c10');
        box(c, -6, 6, -5, 5, top + 2.5, top + 8, '#f26722', '#c44c10');
        box(c, -4.5, 4.5, -4, 4, top + 8, top + 11, '#f7f7f2', '#d6d6d0');
        box(c, -3, 3, -2.5, 2.5, top + 11, top + 17, '#f26722', '#c44c10');
        break;
      case 'cowboy':
        box(c, -hw - 4, hw + 4, -D - 2, D + 2, top, top + 2, '#9c6b3f', '#7a512c');
        box(c, -6, 6, -5, 5, top + 2, top + 9, '#b07c4a', '#8a5d33');
        c.fillStyle = '#5a3a1e';
        c.fillRect(-6, P(-5, top + 4), 12, 2 * GZ);
        break;
      case 'tophat':
        box(c, -hw - 3, hw + 3, -D - 2, D + 2, top, top + 1.8, '#26272b', '#16171a');
        box(c, -7, 7, -6, 6, top + 1.8, top + 16, '#2c2d32', '#1b1c20');
        c.fillStyle = '#c8102e';
        c.fillRect(-7, P(-6, top + 5), 14, 3 * GZ);
        break;
      case 'beanie':
        box(c, -hw + 1, hw - 1, -D + 1, D - 1, top, top + 5, '#e63946', '#c1121f');
        box(c, -hw, hw, -D, D, top, top + 2.2, '#c1121f', '#9b0e19');
        box(c, -2, 2, -2, 2, top + 5, top + 8, '#ffffff', '#e6e6e6');
        break;
      case 'cap':
        box(c, -4, 4, D - 1, D + 6, top, top + 1.5, '#2667cc', '#1d4f9e');
        box(c, -hw + 1, hw - 1, -D + 1, D - 1, top, top + 4.5, '#3a86ff', '#2667cc');
        box(c, -1, 1, -1, 1, top + 4.5, top + 5.5, '#2667cc', '#1d4f9e');
        break;
      case 'bow':
        box(c, -8, -1.5, -2.5, 2.5, top + 0.5, top + 6, '#ff5c8a', '#d63a6a');
        box(c, 1.5, 8, -2.5, 2.5, top + 0.5, top + 6, '#ff5c8a', '#d63a6a');
        box(c, -1.8, 1.8, -2, 2, top + 1.5, top + 5, '#ff8fb0', '#e05a85');
        break;
      case 'headband':
        box(c, 3, 5, D + 0.5, D + 6, top - 4.5, top - 2.5, '#e63946', '#b8222e');
        box(c, -1, 1, D + 0.5, D + 5, top - 5.5, top - 3.5, '#e63946', '#b8222e');
        c.fillStyle = '#e63946'; // just the band across the forehead and sides
        c.fillRect(-hw - 0.5, P(-D - 0.5, top - 1.2), hw * 2 + 1, 2.6 * GZ);
        c.fillStyle = '#b8222e';
        c.fillRect(-hw - 0.5, P(D, top - 1.2), 1.2, (2 * D) * GY);
        c.fillRect(hw - 0.7, P(D, top - 1.2), 1.2, (2 * D) * GY);
        break;
      case 'beret':
        box(c, -hw - 1, hw - 2, -D - 0.5, D - 1, top, top + 2.5, '#2b2d42', '#1d1f30');
        box(c, -1, 1, -1, 1, top + 2.5, top + 4, '#2b2d42', '#1d1f30');
        break;
      case 'bucket':
        box(c, -hw - 3, hw + 3, -D - 3, D + 3, top, top + 1.5, '#c9b38a', '#a8946e');
        box(c, -hw + 1, hw - 1, -D + 1, D - 1, top + 1.5, top + 7, '#d8c39a', '#b8a37a');
        c.fillStyle = '#8a7650';
        c.fillRect(-hw + 1, P(-D + 1, top + 3), hw * 2 - 2, 1.2 * GZ);
        break;
      case 'headphones':
        box(c, -hw - 2, hw + 2, -1.5, 1.5, top, top + 2.5, '#2b2d33', '#1a1b1f');
        for (const s of [-1, 1]) {
          box(c, s < 0 ? -hw - 2.5 : hw + 0.5, s < 0 ? -hw - 0.5 : hw + 2.5, -1.5, 1.5, ez + 2, top + 2.5, '#2b2d33', '#1a1b1f');
          box(c, s < 0 ? -hw - 3.5 : hw - 0.5, s < 0 ? -hw + 0.5 : hw + 3.5, -3.5, 3.5, ez - 5, ez + 2, '#ff5c8a', '#d63a6a');
        }
        break;
      case 'flowers': {
        box(c, -hw, hw, -D, D, top, top + 1, '#5aa648', '#3f8a37');
        const cols = ['#ff6fa5', '#ffd23f', '#ffffff', '#7fd6ff', '#c79bff'];
        let k = 0;
        for (const [x, y] of [[-hw + 1, -D + 1], [0, -D], [hw - 3, -D + 1], [-hw, 0], [hw - 2, 0], [-hw + 2, D - 3], [hw - 4, D - 3]]) {
          const col = cols[k++ % cols.length];
          box(c, x, x + 3, y, y + 3, top + 1, top + 3, col, shade(col, -0.2));
          c.fillStyle = '#ffd23f';
          c.fillRect(x + 1, P(y + 1.5, top + 3) - 0.6, 1.2, 1.2);
        }
        break;
      }
      case 'chef':
        box(c, -hw + 1, hw - 1, -D + 1, D - 1, top, top + 4, '#ffffff', '#e6e6e6');
        box(c, -hw - 1, hw + 1, -D - 1, D + 1, top + 4, top + 11, '#ffffff', '#ececec');
        box(c, -hw + 1, hw - 1, -D + 1, D - 1, top + 11, top + 13, '#ffffff', '#ececec');
        break;
      case 'fez':
        box(c, -5, 5, -4.5, 4.5, top, top + 8, '#c1121f', '#9b0e19');
        c.strokeStyle = '#1d1d1f';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, P(0, top + 8)); c.lineTo(4, P(-4.5, top + 4)); c.stroke();
        box(c, 3.2, 5, -5, -3.5, top + 1.5, top + 4.5, '#1d1d1f', '#000');
        break;
      case 'grad':
        box(c, -5, 5, -5, 5, top, top + 3, '#1d1d1f', '#111');
        box(c, -10, 10, -10, 10, top + 3, top + 4.5, '#26272b', '#16171a');
        c.strokeStyle = '#ffd23f';
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, P(0, top + 4.5)); c.lineTo(9, P(-9, top + 4.5)); c.lineTo(9, P(-9, top - 3)); c.stroke();
        box(c, 8, 10, -10, -8, top - 5, top - 2.5, '#ffd23f', '#e0a800');
        break;
      case 'catears':
      case 'bunnyears': {
        const bunny = hat === 'bunnyears', col = bunny ? '#ffffff' : '#3a3a44', cf = bunny ? '#e6e6ee' : '#24242c';
        box(c, -hw, hw, -1.5, 1.5, top, top + 1.5, col, cf);
        for (const s of [-1, 1]) {
          const ex = s < 0 ? -hw + 1 : hw - 5;
          if (bunny) {
            box(c, ex + 0.5, ex + 4, -1, 2, top + 1.5, top + 13, col, cf);
            c.fillStyle = '#ffb3c7';
            c.fillRect(ex + 1.5, P(-1, top + 12), 1.6, 9 * GZ);
          } else {
            box(c, ex, ex + 4.5, -1, 2, top + 1.5, top + 4.5, col, cf);
            box(c, ex + 1, ex + 3.5, -0.5, 1.5, top + 4.5, top + 7, col, cf);
            c.fillStyle = '#ff9fb5';
            c.fillRect(ex + 1.4, P(-1, top + 5), 1.8, 2.6 * GZ);
          }
        }
        break;
      }
      case 'propeller': {
        const cols = ['#ff5c8a', '#ffd23f', '#34c6ea', '#7ed957'];
        box(c, -hw + 1, hw - 1, -D + 1, 0, top, top + 4, cols[0], shade(cols[0], -0.25));
        box(c, -hw + 1, hw - 1, 0, D - 1, top, top + 4, cols[2], shade(cols[2], -0.25));
        box(c, -0.8, 0.8, -0.8, 0.8, top + 4, top + 7, '#9aa0a8', '#6d737c');
        const a = now() * 18, w = Math.abs(Math.cos(a)) * 9 + 1;
        c.fillStyle = cols[1];
        c.fillRect(-w, P(0, top + 7.5) - 1, w * 2, 2);
        c.fillStyle = cols[3];
        const w2 = Math.abs(Math.sin(a)) * 9 + 1;
        c.fillRect(-w2, P(0, top + 7.5) - 0.6, w2 * 2, 1.2);
        break;
      }
      case 'pirate':
        box(c, -hw - 3, hw + 3, -D - 1, D + 1, top, top + 2, '#1d1d1f', '#111');
        box(c, -hw + 1, hw - 1, -D + 2, D - 1, top + 2, top + 8, '#26272b', '#16171a');
        box(c, -hw - 2, hw + 2, -D - 1.5, -D, top + 2, top + 7, '#26272b', '#16171a');
        if (facing !== 'up') {
          c.fillStyle = '#f7f7f2'; // skull and crossbones
          c.beginPath(); c.arc(0, P(-D - 1.5, top + 5), 1.8, 0, 6.2832); c.fill();
          c.fillRect(-2.5, P(-D - 1.5, top + 3), 5, 0.9);
        }
        break;
      case 'viking':
        box(c, -hw, hw, -D, D, top - 1, top + 5, '#9aa0a8', '#6d737c');
        box(c, -hw + 2, hw - 2, -D + 2, D - 2, top + 5, top + 7, '#aab0b8', '#7d838c');
        c.fillStyle = '#c9a227';
        c.fillRect(-hw - 0.5, P(-D - 0.5, top + 1.2), hw * 2 + 1, 2.2 * GZ);
        c.fillRect(-1, P(-D - 0.5, top + 5), 2, 4 * GZ);
        for (const s of [-1, 1]) {
          box(c, s < 0 ? -hw - 4 : hw, s < 0 ? -hw : hw + 4, -2, 2, top + 2, top + 5, '#f2e6c9', '#d4c39a');
          box(c, s < 0 ? -hw - 6 : hw + 3, s < 0 ? -hw - 3 : hw + 6, -1.5, 1.5, top + 5, top + 10, '#f2e6c9', '#d4c39a');
        }
        break;
      case 'santa':
        box(c, -hw - 1, hw + 1, -D - 1, D + 1, top, top + 2.5, '#ffffff', '#e6e6e6');
        box(c, -hw + 0.5, hw - 0.5, -D + 0.5, D - 0.5, top + 2.5, top + 6, '#d62828', '#a81e1e');
        box(c, -hw + 3, hw - 4, -D + 3, D - 3, top + 6, top + 10, '#d62828', '#a81e1e');
        box(c, -1, 4, -2.5, 2.5, top + 10, top + 13, '#d62828', '#a81e1e');
        box(c, 3, 7, -2, 2, top + 11, top + 15, '#ffffff', '#e6e6e6');
        break;
      case 'sombrero':
        box(c, -hw - 9, hw + 9, -D - 8, D + 8, top, top + 1.5, '#e9c46a', '#c9a227');
        box(c, -6, 6, -6, 6, top + 1.5, top + 10, '#f4d58d', '#d4b46a');
        c.fillStyle = '#e63946';
        c.fillRect(-6, P(-6, top + 4), 12, 2 * GZ);
        c.fillStyle = '#2a9d8f';
        c.fillRect(-6, P(-6, top + 2.6), 12, 0.9 * GZ);
        break;
      case 'mohawk':
        for (const y of [-7, -3.5, 0, 3.5, 7]) {
          const ht = 7 - Math.abs(y) * 0.4;
          box(c, -1.5, 1.5, y - 1.5, y + 1.5, top, top + ht, '#ff2d95', '#c41d72');
        }
        break;
      case 'antlers':
        for (const s of [-1, 1]) {
          const x = s * 4;
          box(c, x - 1, x + 1, -1, 1, top, top + 8, '#8a5d33', '#6b4526');
          box(c, x + s * 1, x + s * 4, -1, 1, top + 5, top + 6.5, '#8a5d33', '#6b4526');
          box(c, x + s * 3, x + s * 5, -1, 1, top + 6.5, top + 11, '#8a5d33', '#6b4526');
          box(c, x - s * 0.5, x + s * 1.5, -1, 1, top + 8, top + 12, '#8a5d33', '#6b4526');
        }
        break;
      case 'mushroom':
        box(c, -hw - 3, hw + 3, -D - 3, D + 3, top + 1, top + 6, '#e63946', '#b8222e');
        box(c, -hw, hw, -D, D, top + 6, top + 9, '#e63946', '#b8222e');
        c.fillStyle = '#ffffff';
        for (const [x, y] of [[-6, 2], [3, -4], [5, 5], [-2, -6]]) c.fillRect(x, P(y, top + 9) - 1, 3, 2);
        for (const x of [-hw, -2, hw - 2]) c.fillRect(x, P(-D - 3, top + 4.5), 3, 2.5);
        break;
      case 'tiara':
        box(c, -7, 7, -D + 1, -D + 3, top, top + 2, '#ffd23f', '#d9a400');
        for (const [x, h] of [[-6, 3], [-3, 4], [0, 6], [3, 4], [6, 3]]) box(c, x - 0.8, x + 0.8, -D + 1.2, -D + 2.8, top + 2, top + 2 + h, '#ffe066', '#d9a400');
        c.fillStyle = '#ff5c8a';
        c.beginPath(); c.arc(0, P(-D + 1, top + 3), 1.4, 0, 6.2832); c.fill();
        break;
      case 'pumpkinhat':
        box(c, -hw, hw, -D, D, top, top + 10, '#ff9a2a', '#e0761a');
        c.fillStyle = shade('#e0761a', -0.18);
        for (const x of [-5, 0, 5]) c.fillRect(x - 0.5, P(-D, top + 10), 1, 10 * GZ);
        box(c, -1.2, 1.2, -1.2, 1.2, top + 10, top + 13, '#5a8f3a', '#3f6b27');
        if (facing === 'down') {
          c.fillStyle = '#3a1a00';
          for (const ex of [-6, 2]) { c.beginPath(); c.moveTo(ex, P(-D, top + 5)); c.lineTo(ex + 2, P(-D, top + 8)); c.lineTo(ex + 4, P(-D, top + 5)); c.closePath(); c.fill(); }
          c.fillRect(-5, P(-D, top + 3.5), 10, 1.5);
        }
        break;
      case 'horns':
        for (const s of [-1, 1]) {
          box(c, s < 0 ? -6 : 3, s < 0 ? -3 : 6, -2, 1, top, top + 3, '#c41e1e', '#8a1010');
          box(c, s < 0 ? -7 : 4.5, s < 0 ? -4.5 : 7, -1.5, 0.5, top + 3, top + 6, '#c41e1e', '#8a1010');
          box(c, s < 0 ? -8 : 6.5, s < 0 ? -6.5 : 8, -1, 0, top + 6, top + 8, '#c41e1e', '#8a1010');
        }
        break;
      case 'halo': {
        const hz = top + 9 + Math.sin(now() * 3) * 1;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,230,120,0.4)';
        c.lineWidth = 5;
        c.beginPath(); c.ellipse(0, P(0, hz), 8, 3, 0, 0, 6.2832); c.stroke();
        c.restore();
        c.strokeStyle = '#ffd84a';
        c.lineWidth = 2;
        c.beginPath(); c.ellipse(0, P(0, hz), 8, 3, 0, 0, 6.2832); c.stroke();
        break;
      }
      case 'wizard': {
        box(c, -hw - 4, hw + 4, -D - 3, D + 3, top, top + 1.5, '#3a2a8f', '#2a1e6b');
        let w = hw - 1;
        for (let i = 0; i < 4; i++) {
          box(c, -w + i, w + i, -w * 0.8, w * 0.8, top + 1.5 + i * 4.5, top + 6 + i * 4.5, '#4b37b0', '#3a2a8f');
          w *= 0.7;
        }
        c.fillStyle = '#ffd23f';
        starPath(c, -2, P(-D + 2, top + 5), 2.4, 1);
        c.fill();
        break;
      }
      case 'astro': {
        const cy = P(-1, ez + 1), r = hw + 5;
        c.fillStyle = 'rgba(180,230,255,0.22)';
        c.beginPath(); c.arc(0, cy, r, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(230,248,255,0.85)';
        c.lineWidth = 1.5;
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.ellipse(-r * 0.45, cy - r * 0.45, 2.4, 4, -0.6, 0, 6.2832); c.fill();
        c.fillStyle = '#c9d1dc';
        c.fillRect(-r * 0.8, cy + r * 0.72, r * 1.6, 3);
        c.fillStyle = '#9aa0a8';
        c.fillRect(-0.6, cy - r - 5, 1.2, 5);
        c.fillStyle = Math.sin(now() * 4) > 0 ? '#ff3b3b' : '#7a1c1c';
        c.beginPath(); c.arc(0, cy - r - 5.5, 1.6, 0, 6.2832); c.fill();
        break;
      }
      case 'flamecrown': {
        const t = now();
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 5; k++) {
          const x = -6 + k * 3, fl = Math.sin(t * 9 + k * 1.7) * 2;
          c.fillStyle = ['rgba(255,226,122,0.85)', 'rgba(255,138,42,0.8)'][k % 2];
          c.beginPath(); c.moveTo(x - 2, P(-6, top + 5)); c.quadraticCurveTo(x + fl, P(-6, top + 12), x + 0.5 + fl * 0.5, P(-6, top + 15 + fl)); c.quadraticCurveTo(x + 1.5, P(-6, top + 9), x + 2, P(-6, top + 5)); c.fill();
        }
        c.restore();
        box(c, -8, 8, -7, 7, top, top + 5, '#ff8a2a', '#c8400f');
        for (const x of [-7, -1.5, 4]) box(c, x, x + 3, -7, -4, top + 5, top + 8, '#ffb000', '#c8400f');
        c.fillStyle = '#fff4b8';
        c.fillRect(-1.5, P(-7, top + 3) - 1, 3, 2.5);
        break;
      }
      case 'clawhat': { // a cap with a tiny claw machine claw on top
        const t = now(), open = 0.4 + 0.4 * Math.abs(Math.sin(t * 1.6));
        box(c, -hw + 0.5, hw - 0.5, -D + 0.5, D - 0.5, top, top + 4, '#ff4fe0', '#c42bb9');
        box(c, -hw + 1, hw - 1, -D - 5, -D + 1, top, top + 1.5, '#c42bb9', '#8a1f84');
        c.fillStyle = '#9aa0a8';
        c.fillRect(-0.6, P(0, top + 15), 1.2, 11 * GZ);
        box(c, -3, 3, -2, 2, top + 12, top + 15, '#c9d1dc', '#8d97a6');
        c.strokeStyle = '#c9d1dc';
        c.lineWidth = 1.4;
        c.beginPath();
        for (const s of [-1, 1]) { c.moveTo(s * 2.5, P(0, top + 12)); c.lineTo(s * (2.5 + open * 4), P(0, top + 8)); c.lineTo(s * (1 + open * 2), P(0, top + 5)); }
        c.stroke();
        c.fillStyle = '#4df0ff';
        c.fillRect(-1, P(-2, top + 14) - 1, 2, 2);
        break;
      }
      case 'raincloud': { // your own little storm
        const t = now(), cz = top + 16 + Math.sin(t * 2) * 1;
        c.fillStyle = '#9aa3b5';
        for (const [x, r] of [[-6, 5], [0, 6.5], [6, 5], [-2, 4.5]]) { c.beginPath(); c.arc(x, P(0, cz + (x === 0 ? 2 : 0)), r, 0, 6.2832); c.fill(); }
        c.fillStyle = '#b8c0d0';
        for (const [x, r] of [[-5, 3.5], [1, 4.5]]) { c.beginPath(); c.arc(x, P(0, cz + 3), r, 0, 6.2832); c.fill(); }
        c.strokeStyle = 'rgba(150,200,255,0.8)';
        c.lineWidth = 1;
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          const ph = (t * 2.2 + k * 0.37) % 1, x = -7 + k * 3.5;
          c.moveTo(x, P(0, cz - 4 - ph * 14)); c.lineTo(x - 0.8, P(0, cz - 7 - ph * 14));
        }
        c.stroke();
        if ((t % 3.1) < 0.12) { // a little flash of lightning
          c.fillStyle = '#fff6b0';
          c.beginPath(); c.moveTo(1, P(0, cz - 3)); c.lineTo(-2, P(0, cz - 9)); c.lineTo(0.5, P(0, cz - 9)); c.lineTo(-1.5, P(0, cz - 15)); c.lineTo(3, P(0, cz - 7.5)); c.lineTo(0.5, P(0, cz - 7.5)); c.closePath(); c.fill();
        }
        break;
      }
      case 'eggshell':
        box(c, -hw - 0.5, hw + 0.5, -D - 0.5, D + 0.5, top, top + 5, '#fff6e6', '#e9dcc4');
        box(c, -hw + 2, hw - 2, -D + 2, D - 2, top + 5, top + 8, '#fff6e6', '#e9dcc4');
        c.fillStyle = '#e9dcc4'; // jagged rim
        for (let x = -hw; x < hw; x += 3) { c.beginPath(); c.moveTo(x, P(-D - 0.5, top)); c.lineTo(x + 1.5, P(-D - 0.5, top - 2)); c.lineTo(x + 3, P(-D - 0.5, top)); c.fill(); }
        c.fillStyle = '#7fd6ff';
        c.fillRect(-4, P(-D - 0.5, top + 3.5), 2, 2);
        c.fillStyle = '#ff8ad8';
        c.fillRect(3, P(-D - 0.5, top + 2.5), 2, 2);
        break;
      case 'drivercap':
        box(c, -hw + 1, hw - 1, -D - 5, -D + 1, top, top + 1.5, '#111', '#000');
        box(c, -hw + 0.5, hw - 0.5, -D + 0.5, D - 0.5, top, top + 4, '#2b2d42', '#1d1f30');
        c.fillStyle = '#ffd23f';
        c.fillRect(-1.5, P(-D + 0.5, top + 3), 3, 2);
        break;
      case 'crown': {
        box(c, -8, 8, -7, 7, top, top + 5, '#ffd23f', '#d9a400');
        for (const x of [-7, -1.5, 4]) box(c, x, x + 3, -7, -4, top + 5, top + 9, '#ffe066', '#d9a400');
        c.fillStyle = '#e63946';
        c.fillRect(-1.5, P(-7, top + 3) - 1, 3, 2.5);
        c.fillStyle = '#34c6ea';
        c.fillRect(-6.5, P(-7, top + 3) - 1, 2.5, 2.5);
        c.fillRect(4, P(-7, top + 3) - 1, 2.5, 2.5);
        break;
      }
    }
  }

  // Graphic mode: the paramedics' sheet over what's left.
  function sheet(c, a) {
    c.globalAlpha = a;
    box(c, -17, 17, -13, 13, 0, 4, '#f4f4f0', '#d6d6d0');
    c.fillStyle = 'rgba(160,10,25,0.75)';
    c.fillRect(-8, P(5, 4), 12, 6 * GY);
    c.fillRect(5, P(-3, 4), 6, 4 * GY);
    c.fillRect(-14, P(-6, 4), 4, 3 * GY);
    c.globalAlpha = 1;
  }

  // First-move hint floating above the player.
  function hint(c, time, text, z = 58) {
    const y = P(0, z) + Math.sin(time * 4) * 2.5;
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

  // A mystery box: opened on the report at the end of the run.
  function mysteryBox(c, it, time) {
    const z = 6 + Math.abs(Math.sin(time * 3 + it.phase)) * 5;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(170,110,255,${0.25 + 0.1 * Math.sin(time * 5)})`;
    c.beginPath(); c.arc(0, P(0, z + 8), 20, 0, 6.2832); c.fill();
    c.restore();
    c.translate(0, P(0, z));
    c.rotate(Math.sin(time * 2 + it.phase) * 0.08);
    box(c, -8, 8, -7, 7, 0, 13, '#a95cff', '#7a35cc');
    box(c, -9, 9, -8, 8, 13, 16, '#bf7dff', '#8a45dd');
    c.fillStyle = '#ffd23f'; // ribbon
    c.fillRect(-1.5, P(-7, 13), 3, 13 * GZ);
    c.fillRect(-1.5, P(8, 16), 3, 16 * GY);
    c.fillRect(-9, P(1, 16) - 1, 18, 2);
    box(c, -5, -1, -1.5, 1.5, 16, 19, '#ffd23f', '#e0a800');
    box(c, 1, 5, -1.5, 1.5, 16, 19, '#ffd23f', '#e0a800');
    c.fillStyle = '#ffffff';
    c.font = `900 8px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('?', -4.5, P(-7, 5));
  }

  // Where you died last run.
  function grave(c) {
    c.fillStyle = 'rgba(70,50,30,0.35)';
    c.beginPath(); c.ellipse(0, P(0, 0), 10, 10 * GY, 0, 0, 6.2832); c.fill();
    box(c, -1.6, 1.6, -1.2, 1.2, 0, 15, '#e8e8f0', '#b8b8c4');
    box(c, -5, 5, -1.2, 1.2, 9, 12, '#e8e8f0', '#b8b8c4');
    c.fillStyle = '#ff6b8a';
    c.fillRect(-4, P(-2, 1) - 1, 2.5, 2.5);
    c.fillStyle = '#ffd23f';
    c.fillRect(2, P(-3, 1) - 1, 2.2, 2.2);
  }

  // A roadside stand: walk in to buy what's on the sign with this run's coins.
  function stand(c, it, time) {
    const sold = it.sold;
    for (const x of [-12, 10]) box(c, x, x + 2, -1, 1, 0, 26, '#8a5d33', '#6b4526');
    box(c, -13, 13, -5, 2, 0, 9, '#c9985f', '#946a3b');
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(-13, P(-5, 6), 26, 1.2);
    for (let k = 0; k < 6; k++) box(c, -14 + k * 28 / 6, -14 + (k + 1) * 28 / 6, -7, 3, 26, 29, k % 2 ? '#ffffff' : '#e63946', k % 2 ? '#e6e6e6' : '#b8222e');
    if (sold) {
      c.fillStyle = '#16181c';
      c.fillRect(-9, P(-5.5, 7.5), 18, 5);
      c.fillStyle = '#ffd23f';
      c.font = `900 4.5px ${UI_FONT}`;
      c.textAlign = 'center';
      c.fillText('SOLD', 0, P(-5.5, 7.5) + 3.8);
      return;
    }
    const def = POWERUPS[it.offer];
    const cy = P(0, 38 + Math.sin(time * 3 + it.phase) * 2);
    c.fillStyle = def.dark;
    c.beginPath(); c.arc(0, cy + 1.5, 8, 0, 6.2832); c.fill();
    c.fillStyle = def.color;
    c.beginPath(); c.arc(0, cy, 8, 0, 6.2832); c.fill();
    icon(c, it.offer, 0, cy, 5, '#fff');
    c.fillStyle = '#ffd23f';
    c.fillRect(-9, P(-5.5, 7.5), 18, 5);
    c.fillStyle = '#16181c';
    c.font = `900 4.5px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText(`${it.price} COINS`, 0, P(-5.5, 7.5) + 3.8);
  }

  // A mystery egg (carry it 50 rows) or a golden egg laid by the goose (10 coins).
  function eggShape(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r * 1.3);
    c.bezierCurveTo(x + r * 0.95, y - r * 1.25, x + r * 1.05, y + r * 0.9, x, y + r);
    c.bezierCurveTo(x - r * 1.05, y + r * 0.9, x - r * 0.95, y - r * 1.25, x, y - r * 1.3);
    c.closePath();
  }
  function egg(c, it, time) {
    const gold = it.type === 'goldegg';
    const z = 14 + Math.sin(time * 3 + it.phase) * 3, cy = P(0, z);
    const pulse = (time * 0.9 + it.phase) % 1;
    c.strokeStyle = gold ? '#ffd23f' : '#ff8ad8';
    c.globalAlpha = 0.7 * (1 - pulse);
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, P(0, 1), 8 + pulse * 18, (8 + pulse * 18) * GY, 0, 0, 6.2832); c.stroke();
    c.globalAlpha = 1;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = gold ? 'rgba(255,210,60,0.3)' : `hsla(${(time * 120) % 360},100%,70%,0.3)`;
    c.beginPath(); c.arc(0, cy, 20, 0, 6.2832); c.fill();
    c.restore();
    c.rotate(Math.sin(time * 5 + it.phase) * 0.12);
    eggPic(c, 0, cy, gold ? 7 : 8.5, gold, time, 0);
  }
  // `crack` 0..1: how close it is to hatching.
  function eggPic(c, x, y, r, gold, time, crack) {
    c.fillStyle = gold ? '#c98a00' : '#d9c7a6';
    eggShape(c, x, y + 1.5, r); c.fill();
    c.fillStyle = gold ? '#ffd23f' : '#fff6e6';
    eggShape(c, x, y, r); c.fill();
    if (!gold) { // speckles in every colour
      const dots = [[-0.4, -0.5, '#ff5c8a'], [0.35, -0.2, '#34c6ea'], [-0.2, 0.35, '#7ed957'], [0.3, 0.5, '#a78bfa'], [0.05, -0.9, '#ffb000']];
      for (const [dx, dy, col] of dots) { c.fillStyle = col; c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.16, 0, 6.2832); c.fill(); }
    }
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.55, r * 0.18, r * 0.35, -0.3, 0, 6.2832); c.fill();
    if (crack > 0) {
      c.strokeStyle = '#3a2a1a';
      c.lineWidth = 1;
      c.beginPath();
      const n = 2 + Math.floor(crack * 5);
      c.moveTo(x - r * 0.9, y - r * 0.1);
      for (let k = 1; k <= n; k++) c.lineTo(x - r * 0.9 + (k / n) * r * 1.8 * Math.min(1, crack * 1.4), y - r * 0.1 + (k % 2 ? -1 : 1) * r * 0.22);
      c.stroke();
    }
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
      case 'jetpack': // two tanks and a flame
        c.fillRect(x - r * 0.62, y - r * 0.85, r * 0.5, r * 1.15);
        c.fillRect(x + r * 0.12, y - r * 0.85, r * 0.5, r * 1.15);
        poly(c, x, y + r * 0.35, r, [[-0.55, 0], [-0.35, 0.65], [-0.15, 0], [0.15, 0], [0.35, 0.65], [0.55, 0]]);
        c.fill();
        break;
      case 'ghost': // a little sheet ghost
        c.beginPath();
        c.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0);
        c.lineTo(x + r * 0.7, y + r * 0.85);
        for (let k = 0; k < 3; k++) c.lineTo(x + r * (0.47 - k * 0.47), y + r * (k % 2 ? 0.85 : 0.5));
        c.lineTo(x - r * 0.7, y + r * 0.85);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.beginPath(); c.arc(x - r * 0.27, y - r * 0.25, r * 0.15, 0, 6.2832); c.arc(x + r * 0.27, y - r * 0.25, r * 0.15, 0, 6.2832); c.fill();
        break;
      case 'shrink': // arrows pointing in
        c.lineWidth = r * 0.22;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          c.beginPath();
          c.moveTo(x + sx * r * 0.9, y + sy * r * 0.9);
          c.lineTo(x + sx * r * 0.3, y + sy * r * 0.3);
          c.moveTo(x + sx * r * 0.3, y + sy * r * 0.62);
          c.lineTo(x + sx * r * 0.3, y + sy * r * 0.3);
          c.lineTo(x + sx * r * 0.62, y + sy * r * 0.3);
          c.stroke();
        }
        break;
      case 'pogo': // a spring
        c.lineWidth = r * 0.2;
        c.beginPath();
        c.moveTo(x - r * 0.5, y + r * 0.8);
        for (let k = 0; k < 5; k++) c.lineTo(x + (k % 2 ? 0.5 : -0.5) * r, y + r * (0.5 - k * 0.3));
        c.stroke();
        c.fillRect(x - r * 0.7, y + r * 0.75, r * 1.4, r * 0.25);
        c.fillRect(x - r * 0.15, y - r, r * 0.3, r * 0.35);
        break;
      case 'timestop': // an hourglass
        poly(c, x, y, r, [[-0.65, -0.9], [0.65, -0.9], [0.1, 0], [0.65, 0.9], [-0.65, 0.9], [-0.1, 0]]);
        c.fill();
        c.fillRect(x - r * 0.8, y - r, r * 1.6, r * 0.2);
        c.fillRect(x - r * 0.8, y + r * 0.8, r * 1.6, r * 0.2);
        break;
      case 'coinrain': // a cloud dropping coins
        c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, 6.2832); c.arc(x + r * 0.25, y - r * 0.45, r * 0.48, 0, 6.2832); c.arc(x + r * 0.6, y - r * 0.2, r * 0.3, 0, 6.2832); c.fill();
        c.fillRect(x - r * 0.75, y - r * 0.35, r * 1.5, r * 0.35);
        for (const [dx, dy] of [[-0.45, 0.45], [0.15, 0.75], [0.55, 0.35]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.17, 0, 6.2832); c.fill(); }
        break;
      case 'bubble':
        c.lineWidth = r * 0.16;
        c.beginPath(); c.arc(x, y, r * 0.8, 0, 6.2832); c.stroke();
        c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.2, 0, 6.2832); c.fill();
        break;
      case 'decoy': // a little chick with a question mark
        c.fillRect(x - r * 0.55, y - r * 0.25, r * 1.1, r * 1.05);
        c.fillRect(x - r * 0.2, y - r * 0.5, r * 0.4, r * 0.25);
        c.font = `900 ${r * 0.9}px ${UI_FONT}`;
        c.textAlign = 'center';
        c.fillText('?', x + r * 0.6, y - r * 0.35);
        break;
      case 'rage': // Big J's angry V and frown
        c.lineWidth = r * 0.26;
        c.beginPath(); c.moveTo(x - r * 0.7, y - r * 0.75); c.lineTo(x, y - r * 0.15); c.lineTo(x + r * 0.7, y - r * 0.75); c.stroke();
        c.fillRect(x - r * 0.62, y - r * 0.02, r * 0.3, r * 0.26);
        c.fillRect(x + r * 0.32, y - r * 0.02, r * 0.3, r * 0.26);
        c.beginPath(); c.arc(x, y + r * 0.95, r * 0.5, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
        break;
      case 'calm': // :|
        c.fillRect(x - r * 0.45, y - r * 0.55, r * 0.22, r * 0.5);
        c.fillRect(x + r * 0.23, y - r * 0.55, r * 0.22, r * 0.5);
        c.fillRect(x - r * 0.5, y + r * 0.3, r, r * 0.18);
        break;
      case 'egg':
        eggShape(c, x, y + r * 0.15, r * 0.72);
        c.fill();
        break;
      case 'horn': // a trumpet horn
        poly(c, x, y, r, [[-0.9, -0.25], [-0.3, -0.25], [0.8, -0.85], [0.8, 0.85], [-0.3, 0.25], [-0.9, 0.25]]);
        c.fill();
        c.lineWidth = r * 0.14;
        c.beginPath(); c.arc(x + r * 0.8, y, r * 0.35, -0.9, 0.9); c.stroke();
        break;
    }
    c.restore();
  }

  const HUD_ICONS = { rage: { color: '#e0231a', dark: '#8a0f0a' }, calm: { color: '#1a6bff', dark: '#0f3f99' }, egg: { color: '#ff8ad8', dark: '#b04c94' } };
  function iconURL(type, size = 56) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const r = size / 2, def = POWERUPS[type] || HUD_ICONS[type];
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
    if (car.type === 'tram') {
      const white = '#f4f4f0', whiteF = '#d6d6d0';
      box(c, bx + 1, fx - 1, -hy, hy, z0, zt - 4, white, whiteF);
      c.fillStyle = col; // livery skirt
      c.fillRect(bx + 1, P(-hy, z0 + 9), L - 2, 7 * GZ);
      c.fillStyle = '#2b3a52'; // window band
      c.fillRect(bx + 6, P(-hy, zt - 9), L - 12, 12 * GZ);
      c.fillStyle = 'rgba(210,235,255,0.3)';
      for (let x = bx + 8; x < fx - 8; x += 14) c.fillRect(x, P(-hy, zt - 9), 5, 12 * GZ);
      c.fillStyle = shade(col, -0.2); // doors
      c.fillRect(-7, P(-hy, zt - 7), 14, (zt - z0 - 12) * GZ);
      c.fillStyle = shade(white, -0.05);
      c.fillRect(bx + 4, P(hy - 3, zt - 4), L - 8, (2 * hy - 6) * GY);
      if (car.front) {
        c.fillStyle = '#2b3a52';
        c.fillRect(fx - 6, P(hy - 3, zt - 4), 5, (2 * hy - 6) * GY);
        c.fillStyle = '#fff5c2';
        c.fillRect(fx - 3, P(-hy, z0 + 16), 3, 4 * GZ);
        // pantograph
        c.strokeStyle = '#3a3d44';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(-10, P(0, zt - 4)); c.lineTo(0, P(0, zt + 12)); c.lineTo(10, P(0, zt - 4));
        c.moveTo(-8, P(0, zt + 12)); c.lineTo(8, P(0, zt + 12));
        c.stroke();
      }
      if (bloody) {
        c.fillStyle = '#8f0a17';
        c.fillRect(fx - 10, P(-hy, zt - 14), 9, 12 * GZ);
      }
    } else if (car.type === 'loco') {
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
    if (l.style === 'floe') { // ice floe
      box(c, -L / 2, L / 2, -hy, hy, -3, 5, '#eef8ff', '#b3d6ec');
      c.fillStyle = 'rgba(120,170,210,0.45)';
      c.fillRect(-L / 4, P(2, 5), L / 3, 1.2);
      c.fillRect(L / 8, P(-6, 5), L / 4, 1.2);
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-L / 2 - 2, P(-hy, 0), L + 4, 2);
      return;
    }
    if (l.style === 'lily') { // a lily pad: wobbles, then sinks if you stand on it too long
      const load = l.load || 0, sunk = l.sinkT || 0;
      const sinkA = sunk ? Math.max(0, 1 - sunk / 0.6) : 1;
      if (sinkA <= 0) return;
      c.globalAlpha = sinkA;
      const wob = load > 0.3 ? Math.sin(time * (14 + load * 20)) * load * 1.5 : 0;
      c.translate(wob, P(0, -load * 3 - (sunk ? 5 * (1 - sinkA) : 0)));
      const r = L * 0.5;
      c.fillStyle = '#3f7d34';
      c.beginPath(); c.ellipse(0, P(0, 0.5), r, r * GY * 0.9, 0, 0.35, 6.2832 - 0.1); c.lineTo(0, P(0, 0.5)); c.fill();
      c.fillStyle = load > 0.55 ? '#7da84a' : '#5fae4a';
      c.beginPath(); c.ellipse(0, P(0, 2), r - 1, (r - 1) * GY * 0.9, 0, 0.35, 6.2832 - 0.1); c.lineTo(0, P(0, 2)); c.fill();
      c.strokeStyle = 'rgba(40,90,30,0.5)';
      c.lineWidth = 0.8;
      c.beginPath(); for (const a of [1.2, 2.4, 3.6, 4.8]) { c.moveTo(0, P(0, 2)); c.lineTo(Math.cos(a) * r * 0.8, P(Math.sin(a) * r * 0.8, 2)); } c.stroke();
      if ((l.id % 3) === 0) { c.fillStyle = '#ffb3d1'; c.beginPath(); c.arc(r * 0.35, P(-r * 0.3, 4), 2.6, 0, 6.2832); c.fill(); c.fillStyle = '#ffe066'; c.fillRect(r * 0.35 - 0.6, P(-r * 0.3, 4) - 0.6, 1.2, 1.2); }
      c.globalAlpha = 1;
      return;
    }
    if (l.style === 'ferry') { // a small ferry boat with a cabin
      box(c, -L / 2, L / 2, -hy - 1, hy + 1, -4, 7, '#f4f4f0', '#c9cdd4');
      c.fillStyle = '#2667cc';
      c.fillRect(-L / 2, P(-hy - 1, 3), L, 2.5 * GZ);
      c.fillStyle = '#c1121f';
      c.fillRect(-L / 2, P(-hy - 1, -1), L, 2 * GZ);
      c.fillStyle = '#b88a58'; // deck planks
      c.fillRect(-L / 2 + 3, P(hy - 1, 7), L - 6, (2 * hy - 2) * GY);
      c.fillStyle = 'rgba(80,50,20,0.25)';
      for (let x = -L / 2 + 8; x < L / 2 - 4; x += 8) c.fillRect(x, P(hy - 1, 7), 1, (2 * hy - 2) * GY);
      const cx = (l.dir || 1) * L * 0.28;
      box(c, cx - 12, cx + 12, -4, hy - 1, 7, 20, '#ffffff', '#dfe3ea');
      c.fillStyle = '#4f73a0';
      for (const x of [cx - 9, cx - 2, cx + 5]) c.fillRect(x, P(-4, 17), 5, 4 * GZ);
      box(c, cx - 3, cx + 3, 0, 5, 20, 27, '#e63946', '#b8222e'); // funnel
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-L / 2 - 3, P(-hy - 1, -1), L + 6, 2);
      return;
    }
    if (l.style === 'bubble') { // a big soap bubble holding you up
      const a = Math.max(0, Math.min(1, l.fade));
      const wob = Math.sin(time * 6) * 0.06;
      c.globalAlpha = a * (a < 0.55 && ((time * 12) | 0) % 2 ? 0.4 : 1);
      c.fillStyle = 'rgba(190,235,255,0.35)';
      c.beginPath(); c.ellipse(0, P(0, 2), L * 0.55 * (1 + wob), hy * GY * 1.1 * (1 - wob), 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.ellipse(-L * 0.25, P(4, 3), 4, 2, -0.3, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
      return;
    }
    if (l.style === 'rainbow') { // the unicorn's rainbow: a step of light on the water
      const a = Math.max(0, Math.min(1, l.fade === undefined ? 1 : l.fade));
      c.globalAlpha = a;
      const cols = ['#ff5c8a', '#ffb000', '#ffe95c', '#7ed957', '#34c6ea', '#a78bfa'];
      const band = (2 * hy) / cols.length;
      cols.forEach((col, k) => {
        c.fillStyle = col;
        c.fillRect(-L / 2, P(hy - k * band, 3), L, band * GY + 0.5);
      });
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(-L / 2, P(hy, 3), L, 1.5);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,255,255,${0.12 + 0.08 * Math.sin(time * 5)})`;
      c.fillRect(-L / 2 - 3, P(hy + 3, 3), L + 6, (2 * hy + 6) * GY);
      c.restore();
      c.globalAlpha = 1;
      return;
    }
    if (l.style === 'turtle') { // your pet turtle, surfaced
      box(c, -L / 2, L / 2, -hy + 2, hy - 2, -3, 6, '#5a8f3a', '#3f6b27');
      c.fillStyle = '#7fb85a';
      for (const [sx, sy] of [[-6, 3], [4, -4], [5, 5], [-5, -5]]) c.fillRect(sx - 2.5, P(sy, 6) - 2, 5, 4);
      box(c, L / 2 - 1, L / 2 + 7, -4, 4, -1, 5, '#8cc26b', '#6a9c4d');
      c.fillStyle = '#1d1d1f';
      c.fillRect(L / 2 + 4, P(-4, 4), 1.5, 1.5);
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-L / 2 - 2, P(-hy, 0), L + 4, 2);
      return;
    }
    if (l.style === 'surf') { // a line of surfboards, nose to tail
      const cols = ['#ff6fa5', '#ffd23f', '#34c6ea', '#7ed957', '#ff8a3d', '#ffffff'];
      const n = Math.max(1, Math.round(L / 34)), w = L / n;
      for (let k = 0; k < n; k++) {
        const x0 = -L / 2 + k * w + 1, col = cols[(l.id + k) % cols.length];
        c.fillStyle = shade(col, -0.25);
        roundRect(c, x0, P(hy - 4, 3) , w - 2, (2 * hy - 8) * GY + 3, 7);
        c.fillStyle = col;
        roundRect(c, x0, P(hy - 4, 4), w - 2, (2 * hy - 8) * GY, 7);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x0 + 3, P(0, 4) - 0.5, w - 8, 1.2);
      }
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-L / 2 - 2, P(-hy, 0), L + 4, 2);
      return;
    }
    if (l.style === 'raft') { // wooden raft
      box(c, -L / 2, L / 2, -hy, hy, -3, 6, '#c9985f', '#946a3b');
      c.fillStyle = 'rgba(70,45,20,0.4)';
      for (let x = -L / 2 + 9; x < L / 2 - 2; x += 9) c.fillRect(x, P(hy, 6), 1.2, 2 * hy * GY);
      c.fillStyle = '#6b4a2a';
      c.fillRect(-L / 2 + 4, P(hy, 6), 3, 2 * hy * GY);
      c.fillRect(L / 2 - 7, P(hy, 6), 3, 2 * hy * GY);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-L / 2 - 2, P(-hy, 0), L + 4, 2);
      return;
    }
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

  // ---- Biome scenery -------------------------------------------------------------
  function cactus(c, o) {
    const h = o.h, G = '#5aa34a', GF = '#3f7f35';
    box(c, -4.5, 4.5, -4, 4, 0, h, G, GF);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(-1, P(-4, h - 2), 1.2, (h - 6) * GZ);
    const arms = [[o.flip * 1, h * 0.42, h * 0.3], [-o.flip * 1, h * 0.58, h * 0.22]];
    for (let i = 0; i < o.arms; i++) {
      const [s, z, len] = arms[i];
      const x0 = s > 0 ? 4.5 : -12, x1 = s > 0 ? 12 : -4.5;
      box(c, x0, x1, -3, 3, z, z + 6, G, GF);
      const ax = s > 0 ? 8 : -12;
      box(c, ax, ax + 4.5, -3, 3, z + 6, z + 6 + len, G, GF);
    }
    c.fillStyle = '#ff7eb6';
    c.fillRect(-2, P(0, h + 1), 4, 2);
  }

  function deadbush(c, o) {
    c.strokeStyle = '#8c6a3c';
    c.lineWidth = 1.6;
    c.beginPath();
    for (const [x, z] of [[-10, 10], [-4, 14], [3, 13], [9, 9], [0, 16], [-7, 6], [7, 5]]) {
      c.moveTo(0, P(0, 1));
      c.lineTo(x, P(0, z));
    }
    c.stroke();
    c.fillStyle = 'rgba(140,106,60,0.5)';
    c.fillRect(-6, P(0, 1) - 1, 12, 2);
  }

  function skull(c) {
    box(c, -7, 7, -5, 5, 0, 7, '#f1ece0', '#cfc7b4');
    box(c, -4, 4, -8, -5, 0, 5, '#f1ece0', '#cfc7b4');
    c.fillStyle = '#3a3230';
    c.fillRect(-4, P(-5, 5), 2.5, 2.5);
    c.fillRect(1.5, P(-5, 5), 2.5, 2.5);
    box(c, -12, -7, -2, 1, 5, 7, '#f1ece0', '#cfc7b4');
    box(c, 7, 12, -2, 1, 5, 7, '#f1ece0', '#cfc7b4');
    box(c, -13, -11, -2, 1, 7, 11, '#f1ece0', '#cfc7b4');
    box(c, 11, 13, -2, 1, 7, 11, '#f1ece0', '#cfc7b4');
  }

  function mesa(c, o) {
    const w = o.w, h = o.h;
    box(c, -w / 2, w / 2, -18, 18, 0, h, '#e3a06b', '#b8693f');
    c.fillStyle = 'rgba(120,50,20,0.22)';
    for (let z = 10; z < h - 4; z += 11) c.fillRect(-w / 2, P(-18, z), w, 2.5);
    box(c, -w / 2 + 6, w / 2 - 10, -12, 12, h, h + 5, '#eab081', '#c77a4d');
  }

  function planter(c, o) {
    box(c, -12, 12, -10, 10, 0, 8, '#bdb6aa', '#98918a');
    c.fillStyle = '#5b4332';
    c.fillRect(-10, P(8, 8), 20, 16 * GY);
    box(c, -2, 2, -2, 2, 8, 16, '#9a6b4a', '#77502f');
    const p = o.pal, s = o.size;
    box(c, -s, s, -s * 0.9, s * 0.9, 14, 32, p.top, p.front);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(-s, P(s * 0.9, 32), s * 2, 2);
  }

  function hydrant(c) {
    box(c, -6, 6, -6, 6, 0, 3, '#c9302c', '#9c211e');
    box(c, -4.5, 4.5, -4.5, 4.5, 3, 15, '#e63946', '#b82832');
    box(c, -7.5, 7.5, -2, 2, 8, 11, '#e63946', '#b82832');
    box(c, -3, 3, -3, 3, 15, 19, '#f2f2ee', '#c9c9c2');
  }

  function bin(c) {
    box(c, -7, 7, -6, 6, 0, 17, '#3c6e47', '#2c5436');
    box(c, -8, 8, -7, 7, 17, 20, '#4a8456', '#35613f');
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (const x of [-4, 0, 4]) c.fillRect(x, P(-6, 15), 1.2, 12 * GZ);
  }

  function mailbox(c) {
    box(c, -1.5, 1.5, -1.5, 1.5, 0, 6, '#2a3f6a', '#1d2d4d');
    box(c, -7, 7, -6, 6, 6, 24, '#2e5aa8', '#23447f');
    box(c, -6, 6, -5, 5, 24, 27, '#3a6cc0', '#2a5190');
    c.fillStyle = '#16181c';
    c.fillRect(-4, P(-6, 20), 8, 1.8);
    c.fillStyle = '#f7f7f2';
    c.fillRect(-4, P(-6, 14), 8, 3 * GZ);
  }

  function bench(c) {
    for (const x of [-13, 11]) box(c, x, x + 2, -6, 5, 0, 8, '#3a3d44', '#26282d');
    box(c, -15, 15, -7, 3, 8, 10, '#b07c4a', '#8a5d33');
    box(c, -15, 15, 3, 6, 10, 20, '#b07c4a', '#8a5d33');
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(-15, P(-2, 10), 30, 1);
  }

  function snowman(c) {
    box(c, -10, 10, -9, 9, 0, 13, '#fbfdff', '#dfe9f3');
    box(c, -7, 7, -6, 6, 13, 23, '#fbfdff', '#dfe9f3');
    box(c, -5, 5, -4.5, 4.5, 23, 31, '#fbfdff', '#dfe9f3');
    c.fillStyle = '#c8102e'; // scarf
    c.fillRect(-7, P(-6, 24), 14, 2.5 * GZ);
    c.fillRect(2, P(-6, 22), 3, 6 * GZ);
    c.fillStyle = '#1d1d1f';
    c.fillRect(-3, P(-4.5, 29), 1.8, 1.8);
    c.fillRect(1.5, P(-4.5, 29), 1.8, 1.8);
    for (const z of [19, 16]) c.fillRect(-0.9, P(-6, z), 1.8, 1.8);
    c.fillStyle = '#ff8c1a';
    c.fillRect(-0.8, P(-4.5, 27), 1.6, 4);
    c.strokeStyle = '#6b4a2a';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-7, P(0, 19)); c.lineTo(-15, P(0, 25));
    c.moveTo(7, P(0, 19)); c.lineTo(15, P(0, 24));
    c.stroke();
  }

  function building(c, o) {
    const w = o.w, h = o.h, col = o.color;
    box(c, -w / 2, w / 2, -16, 16, 0, h, shade(col, 0.12), shade(col, -0.12));
    // windows on the front face (lit ones drawn again by the night lighting)
    c.fillStyle = 'rgba(40,55,80,0.55)';
    let i = 0;
    for (let z = 14; z < h - 10; z += 16) {
      for (let x = -w / 2 + 6; x < w / 2 - 10; x += 13, i++) c.fillRect(x, P(-16, z + 9), 7, 8 * GZ);
    }
    c.fillStyle = shade(col, -0.3); // door and roof ledge
    c.fillRect(-5, P(-16, 12), 10, 12 * GZ);
    box(c, -w / 2 - 1, w / 2 + 1, -17, 17, h, h + 2, shade(col, 0.2), shade(col, -0.2));
    box(c, -w / 4, -w / 4 + 12, -6, 6, h + 2, h + 8, '#9aa0a8', '#6d737c');
  }

  function buildingWindows(c, o) {
    const w = o.w, h = o.h;
    c.fillStyle = '#ffd98a';
    let i = 0;
    for (let z = 14; z < h - 10; z += 16) {
      for (let x = -w / 2 + 6; x < w / 2 - 10; x += 13, i++) if (o.lit[i % o.lit.length]) c.fillRect(x, P(-16, z + 9), 7, 8 * GZ);
    }
  }


  // ---- Beach -------------------------------------------------------------------
  function umbrella(c, o) {
    box(c, -1.2, 1.2, -1.2, 1.2, 0, 34, '#e8e4da', '#c9c4b8');
    const cy = P(0, 36);
    c.fillStyle = 'rgba(20,20,24,0.35)';
    c.beginPath(); c.ellipse(0, cy + 1, 21, 9, 0, Math.PI, 0); c.fill();
    for (let k = 0; k < 6; k++) { // striped canopy
      c.fillStyle = k % 2 ? '#fbfbf6' : o.color;
      c.beginPath();
      c.moveTo(0, cy - 8);
      c.ellipse(0, cy, 20, 8, 0, Math.PI + (k / 6) * Math.PI, Math.PI + ((k + 1) / 6) * Math.PI);
      c.closePath();
      c.fill();
    }
    c.fillStyle = shade(o.color, -0.3);
    c.fillRect(-20, cy - 0.5, 40, 1.5);
  }

  function chair(c, o) {
    for (const x of [-9, 7]) box(c, x, x + 2, -8, 6, 0, 5, '#b8bec8', '#8d949e');
    box(c, -10, 10, -8, 2, 5, 7, o.color, shade(o.color, -0.25));
    box(c, -10, 10, 2, 5, 7, 18, o.color, shade(o.color, -0.25));
    c.fillStyle = 'rgba(255,255,255,0.45)';
    for (let x = -8; x < 10; x += 5) c.fillRect(x, P(2, 7), 2, 10 * GY);
  }

  function sandcastle(c) {
    const S = '#e2c27f', SF = '#c4a05c';
    box(c, -12, 12, -9, 9, 0, 8, S, SF);
    box(c, -8, 8, -6, 6, 8, 16, S, SF);
    for (const x of [-12, 8]) box(c, x, x + 4, -9, -5, 8, 14, S, SF);
    box(c, -3, 3, -3, 3, 16, 22, S, SF);
    c.fillStyle = '#7a5a2a';
    c.fillRect(-2, P(-6, 13), 4, 5 * GZ);
    c.fillStyle = '#e63946';
    c.fillRect(0, P(0, 30), 5, 3);
    c.fillStyle = '#6b4a2a';
    c.fillRect(-0.4, P(0, 30), 0.8, 8 * GZ);
  }

  function palm(c, o) {
    const h = o.h, lean = o.lean;
    for (let k = 0; k < 7; k++) { // segmented trunk, leaning
      const z0 = (k / 7) * h, x = (lean * k) / 7;
      box(c, x - 3, x + 3, -3, 3, z0, z0 + h / 7 + 0.5, k % 2 ? '#a57a4d' : '#b88a58', '#8a6238');
    }
    const tx = lean, tz = h;
    c.fillStyle = '#2e8b3e';
    for (let k = 0; k < 6; k++) { // fronds
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const ex = tx + Math.cos(a) * 22, ey = P(Math.sin(a) * 12, tz - 7);
      c.beginPath();
      c.moveTo(tx, P(0, tz + 2));
      c.quadraticCurveTo(tx + Math.cos(a) * 12, P(Math.sin(a) * 6, tz + 6), ex, ey);
      c.quadraticCurveTo(tx + Math.cos(a) * 12, P(Math.sin(a) * 6, tz), tx, P(0, tz - 1));
      c.fill();
    }
    c.fillStyle = '#6b4a2a';
    for (const [dx, dz] of [[-2, -1], [2, -2], [0, -3]]) { c.beginPath(); c.arc(tx + dx, P(0, tz + dz), 2.2, 0, 6.2832); c.fill(); }
  }

  function lifeguard(c) {
    for (const [x, y] of [[-10, -8], [8, -8], [-10, 6], [8, 6]]) box(c, x, x + 2, y, y + 2, 0, 30, '#f7f7f2', '#d6d6d0');
    box(c, -13, 13, -11, 11, 30, 33, '#c9985f', '#946a3b');
    box(c, -11, 11, -2, 9, 33, 48, '#e63946', '#b82832');
    box(c, -13, 13, -12, 12, 48, 51, '#f7f7f2', '#d6d6d0');
    c.fillStyle = '#f7f7f2';
    c.font = `900 5px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('LIFEGUARD', 0, P(-2, 42));
  }


  // ---- Pets ----------------------------------------------------------------------
  function pet(c, o, time) {
    c.save();
    c.translate(0, P(0, o.z));
    if (o.type === 'minij') { // a tiny, equally unimpressed Big J
      c.scale(0.5, 0.5);
      bigJ(c, { facing: o.face > 0 ? 'right' : 'left', squash: 0, z: 0, rot: 0, flap: 0, char: 0, blinkSeed: o.blink }, time, SKINS.bigj, null, 0);
      c.restore();
      return;
    }
    if (o.type === 'drone') {
      box(c, -6, 6, -5, 5, 0, 4, '#3a3d44', '#26282d');
      box(c, -2.5, 2.5, -2, 2, 4, 6, '#5a5f69', '#3a3d44');
      const spin = time * 40;
      for (const [rx, ry] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
        c.fillStyle = '#26282d';
        c.fillRect(rx - 1, P(ry, 4) - 1, 2, 2);
        c.fillStyle = 'rgba(200,210,225,0.55)';
        const w = 5 * Math.abs(Math.cos(spin + rx));
        c.fillRect(rx - w, P(ry, 5) - 0.6, w * 2, 1.2);
      }
      c.fillStyle = Math.sin(time * 6) > 0 ? '#4df0ff' : '#1b6a78';
      c.fillRect(-1, P(-5, 2) - 1, 2, 2);
      c.restore();
      return;
    }
    if (o.type === 'twister') { // a small swirling funnel
      for (let k = 0; k < 7; k++) {
        const f = k / 6, r = 3 + f * 11, wob = Math.sin(time * 8 + f * 5) * (1 + f * 3);
        c.globalAlpha = 0.75 - f * 0.3;
        c.fillStyle = k % 2 ? '#8a8174' : '#a39a8a';
        c.beginPath(); c.ellipse(wob, P(0, f * 30), r, r * 0.35, 0, 0, 6.2832); c.fill();
      }
      c.globalAlpha = 1;
      c.restore();
      return;
    }
    c.scale(o.face, 1);
    // ---- new pets (all facing +x here) ----
    const quad = (L) => { // a little four-legged animal
      const t = L.top, f = L.front, leg = L.leg || f;
      for (const lx of [-6, -3, 3, 6]) box(c, lx - 1, lx + 1, -3, -1, 0, 4, leg, shade(leg, -0.2));
      if (L.tail === 'bushy') {
        box(c, -12, -7, -2, 2, 7, 11, t, f);
        box(c, -15, -11, -2, 2, 9, 13, L.tip || '#ffffff', shade(L.tip || '#ffffff', -0.12));
      } else if (L.tail === 'puff') box(c, -10, -7, -1.5, 1.5, 7, 10, '#ffffff', '#e6e6ee');
      else if (L.tail === 'stub') box(c, -10, -7, -1, 1, 8, 10, t, f);
      box(c, -8, 8, -4, 4, 4, 10, t, f);
      if (L.belly) { c.fillStyle = L.belly; c.fillRect(-4, P(-4, 8), 8, 3 * GZ); }
      box(c, 6, 13, -3.5, 3.5, 8, 15, L.head || t, L.headF || f);
      const ec = L.ear || t, ef = shade(ec, -0.2);
      if (L.ears === 'bunny') { box(c, 7, 9, -2, 0, 15, 23, ec, ef); box(c, 10, 12, -2, 0, 15, 22, ec, ef); c.fillStyle = '#ffb3c7'; c.fillRect(7.5, P(-2, 22), 1, 6 * GZ); }
      else if (L.ears === 'fox' || L.ears === 'cat') { for (const ex of [7, 10.5]) { box(c, ex, ex + 2.5, -2, 1, 15, 17.5, ec, ef); box(c, ex + 0.6, ex + 1.9, -1.5, 0.5, 17.5, L.ears === 'fox' ? 20 : 19, ec, ef); } }
      else if (L.ears === 'round') { for (const ex of [6.5, 10.5]) box(c, ex, ex + 2.6, -2, 1, 15, 17.5, ec, ef); }
      if (L.patch) { c.fillStyle = L.patch; c.fillRect(9, P(-3.5, 14.5), 3.5, 3 * GZ); }
      c.fillStyle = L.eye || '#1d1d1f';
      c.fillRect(10, P(-3.5, 13.5), 1.6, 1.6);
      c.fillStyle = L.nose || '#1d1d1f';
      c.fillRect(12.6, P(-2, 12), 1.4, 1.4);
    };
    const wings = (col, flap, y = -6, size = 1) => {
      c.fillStyle = col;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(-1, y); c.lineTo(-7 * size, y - 6 * size * (s > 0 ? 1 : 0.6) - flap * s); c.lineTo(3, y - 1); c.closePath(); c.fill();
      }
    };
    switch (o.type) {
      case 'mimic': { // a treasure chest with teeth
        const chomp = Math.abs(Math.sin(time * (o.fetch ? 14 : 3))) * (o.fetch ? 0.6 : 0.2);
        for (const lx of [-5, 4]) box(c, lx - 1, lx + 1, -3, 3, 0, 2, '#6b4526', '#4d311b');
        box(c, -8, 8, -5, 5, 2, 9, '#a8754a', '#7a522c');
        c.fillStyle = '#ffd23f';
        c.fillRect(-8, P(-5, 9), 16, 1.4);
        c.fillRect(-1, P(-5, 7), 2, 3);
        c.save();
        c.translate(0, P(4, 9));
        c.rotate(-chomp);
        c.translate(0, -P(4, 9));
        box(c, -8.5, 8.5, -5.5, 4.5, 9, 14, '#b88a58', '#8a6238');
        c.fillStyle = '#ffd23f';
        c.fillRect(-8.5, P(-5.5, 9.5), 17, 1.4);
        c.fillStyle = '#ffffff'; // teeth
        for (let x = -7; x < 8; x += 2.5) { c.beginPath(); c.moveTo(x, P(-5.5, 9)); c.lineTo(x + 1.2, P(-5.5, 7.5)); c.lineTo(x + 2.4, P(-5.5, 9)); c.fill(); }
        c.restore();
        c.fillStyle = '#c0102c';
        c.fillRect(-6, P(-5, 9) + 0.5, 12, 1.5 * chomp * 6);
        c.fillStyle = '#ffd23f';
        c.fillRect(3, P(-5.5, 13), 1.6, 1.6);
        c.fillRect(6, P(-5.5, 13), 1.6, 1.6);
        break;
      }
      case 'turtle': {
        const step = Math.sin(time * 6) * 0.8;
        for (const lx of [-5, 4]) box(c, lx - 1.5, lx + 1.5, -3.5, 3.5, 0, 2.5 + step * (lx > 0 ? 1 : -1), '#8cc26b', '#6a9c4d');
        box(c, 6, 11, -2.5, 2.5, 1.5, 6, '#8cc26b', '#6a9c4d');
        c.fillStyle = '#1d1d1f';
        c.fillRect(9, P(-2.5, 5), 1.3, 1.3);
        box(c, -7, 7, -5, 5, 2, 8, '#5a8f3a', '#3f6b27');
        box(c, -5, 5, -3.5, 3.5, 8, 10, '#6aa84a', '#4f7f33');
        c.fillStyle = '#7fb85a';
        for (const [sx, sy] of [[-4, 2], [2, -2], [3, 3]]) c.fillRect(sx - 1.5, P(sy, 10) - 1, 3, 2);
        break;
      }
      case 'rock':
        box(c, -6, 6, -4, 4, 0, 6, '#9aa0a8', '#6d737c');
        box(c, -4, 3, -2.5, 2.5, 6, 9, '#aab0b8', '#7d838c');
        c.fillStyle = '#ffffff'; // googly eyes
        for (const ex of [-2, 2.5]) { c.beginPath(); c.arc(ex, P(-4, 5), 1.8, 0, 6.2832); c.fill(); }
        c.fillStyle = '#1d1d1f';
        for (const ex of [-2, 2.5]) { c.beginPath(); c.arc(ex + Math.sin(time * 3) * 0.6, P(-4, 4.6), 0.9, 0, 6.2832); c.fill(); }
        c.restore();
        return;
      case 'hamster': {
        box(c, -7, 7, -4.5, 4.5, 1, 10, '#e8b07a', '#c98d55');
        c.fillStyle = '#fff3e0';
        c.fillRect(-2, P(-4.5, 7), 9, 6 * GZ);
        for (const ex of [1, 5]) box(c, ex, ex + 2.5, -1, 1.5, 10, 12, '#e8b07a', '#c98d55');
        c.fillStyle = '#ffb3c7';
        c.fillRect(6.5, P(-4.5, 6), 1.5, 1.5);
        c.fillStyle = '#1d1d1f';
        c.fillRect(4, P(-4.5, 8), 1.6, 1.6);
        c.fillStyle = 'rgba(255,140,160,0.5)';
        c.fillRect(1, P(-4.5, 5.5), 2.5, 1.5);
        break;
      }
      case 'bunny': quad({ top: '#f4f1f6', front: '#d8d2de', ears: 'bunny', tail: 'puff', nose: '#ff8fa3' }); break;
      case 'fox': quad({ top: '#ff8a3d', front: '#e0601a', leg: '#3a2a20', ears: 'fox', tail: 'bushy', belly: '#ffffff' }); break;
      case 'frostfox':
        quad({ top: '#e8fbff', front: '#9fd8f0', leg: '#7fc4e0', ears: 'fox', tail: 'bushy', tip: '#ffffff', eye: '#2f7fd6', nose: '#2f7fd6' });
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(150,220,255,${0.2 + 0.1 * Math.sin(time * 4)})`;
        c.beginPath(); c.arc(2, P(0, 10), 14, 0, 6.2832); c.fill();
        c.restore();
        if (o.x !== undefined && Math.random() < 0.15) FX.spawn('glow', o.x + rand(-10, 10), o.y + rand(-4, 4), rand(4, 18), { vz: -10, life: 0.6, size: 1.6, size2: 0.4, color: '#e8fbff' });
        break;
      case 'panda':
        quad({ top: '#f4f4f4', front: '#d9d9d9', leg: '#1d1d1f', ears: 'round', ear: '#1d1d1f', patch: '#1d1d1f', eye: '#ffffff', tail: 'stub' });
        break;
      case 'robopup':
        quad({ top: '#c9d1dc', front: '#8d97a6', leg: '#5a6370', ears: 'round', ear: '#5a6370', eye: Math.sin(time * 5) > 0 ? '#ff3b3b' : '#ff9a9a', nose: '#3a3f48', tail: 'stub' });
        c.fillStyle = '#5a6370';
        c.fillRect(9, P(0, 21), 1, 6 * GZ);
        c.fillStyle = '#4df0ff';
        c.beginPath(); c.arc(9.5, P(0, 21.5), 1.4, 0, 6.2832); c.fill();
        break;
      case 'mole':
        for (const lx of [-5, 4]) box(c, lx - 1.5, lx + 1.5, -3, 3, 0, 3, '#f2b5a0', '#d9957d');
        box(c, -8, 7, -4, 4, 2, 9, '#6b4a3a', '#4f3529');
        box(c, 6, 11, -2.5, 2.5, 3.5, 8, '#6b4a3a', '#4f3529');
        c.fillStyle = '#ff8fa3';
        c.beginPath(); c.arc(11.5, P(-2.5, 6), 1.8, 0, 6.2832); c.fill();
        c.fillStyle = '#1d1d1f';
        c.fillRect(8, P(-2.5, 7.5), 1.2, 1);
        box(c, -3, 5, -3.5, 3.5, 9, 11.5, '#ffd23f', '#e0a800'); // tiny mining helmet
        box(c, 4.5, 6.5, -1.5, 1.5, 9.5, 11, '#ffffff', '#e6e6e6');
        break;
      case 'luckycat': {
        const wave = Math.sin(time * 6) * 2.5;
        box(c, -5, 5, -4, 4, 0, 11, '#ffffff', '#e6e6ee');
        c.fillStyle = '#e63946';
        c.fillRect(-5, P(-4, 11), 10, 1.6 * GZ);
        c.fillStyle = '#ffd23f';
        c.beginPath(); c.arc(0, P(-4, 9.3), 1.4, 0, 6.2832); c.fill();
        box(c, -5.5, 5.5, -4.5, 4.5, 11, 19, '#ffffff', '#e6e6ee');
        for (const ex of [-5, 2.5]) { box(c, ex, ex + 2.5, -2, 1, 19, 21.5, '#ffffff', '#e6e6ee'); c.fillStyle = '#ff9fb5'; c.fillRect(ex + 0.6, P(-2, 21), 1.2, 1.6); }
        c.fillStyle = '#1d1d1f';
        c.fillRect(-3, P(-4.5, 15.6), 1.6, 0.9);
        c.fillRect(1.5, P(-4.5, 15.6), 1.6, 0.9);
        c.fillStyle = '#ff8fa3';
        c.fillRect(-0.6, P(-4.5, 14), 1.2, 1);
        box(c, 5, 7.5, -2, 1, 12 + wave, 17 + wave, '#ffffff', '#e6e6ee'); // the waving paw
        c.fillStyle = '#ffd23f';
        c.beginPath(); c.arc(-6.5, P(-4, 6), 2.6, 0, 6.2832); c.fill();
        c.fillStyle = '#c98a00';
        c.fillRect(-7, P(-4, 7), 1, 2);
        break;
      }
      case 'penguin': {
        const flap = Math.sin(time * 9) * 1.5;
        for (const fx of [-2, 2]) box(c, fx - 1, fx + 2, -2, 0, 0, 1.5, '#ff9f1c', '#e07b00');
        box(c, -4, 4, -3, 3, 1, 13, '#2e3440', '#1e232c');
        c.fillStyle = '#f7f7f5';
        c.fillRect(-1, P(-3, 11), 5, 9 * GZ);
        box(c, -5.5, -4, -2, 2, 5 + flap, 10 + flap, '#2a303b', '#161a21');
        box(c, 4, 7.5, -1, 1, 9, 10.5, '#ffb347', '#ff8c1a');
        c.fillStyle = '#1d1d1f';
        c.fillRect(2, P(-3, 12), 1.4, 1.4);
        break;
      }
      case 'bat': {
        const flap = Math.sin(time * 16) * 5;
        c.fillStyle = '#3d2a52';
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(0, -4); c.lineTo(s * 4, -9 - flap * 0.6); c.lineTo(s * 9, -7 - flap); c.lineTo(s * 8, -3); c.lineTo(s * 6, -4.5); c.lineTo(s * 4, -2.5); c.closePath(); c.fill();
        }
        c.fillStyle = '#4b3466';
        c.beginPath(); c.ellipse(0, -4, 3.5, 4, 0, 0, 6.2832); c.fill();
        c.beginPath(); c.moveTo(-2.5, -7); c.lineTo(-2, -10.5); c.lineTo(-0.5, -7.5); c.fill();
        c.beginPath(); c.moveTo(2.5, -7); c.lineTo(2, -10.5); c.lineTo(0.5, -7.5); c.fill();
        c.fillStyle = '#ffd23f';
        c.fillRect(-1.8, -5.5, 1.2, 1.2);
        c.fillRect(0.8, -5.5, 1.2, 1.2);
        c.fillStyle = '#ffffff';
        c.fillRect(-0.9, -2.6, 0.7, 1);
        c.fillRect(0.4, -2.6, 0.7, 1);
        break;
      }
      case 'bee': {
        const flap = Math.abs(Math.sin(time * 30)) * 4;
        c.fillStyle = 'rgba(220,240,255,0.7)';
        c.beginPath(); c.ellipse(-1, -8 - flap * 0.5, 3, 4 + flap * 0.3, -0.4, 0, 6.2832); c.fill();
        c.beginPath(); c.ellipse(2, -8 - flap * 0.5, 2.6, 3.6 + flap * 0.3, 0.4, 0, 6.2832); c.fill();
        c.fillStyle = '#ffd23f';
        c.beginPath(); c.ellipse(0, -4, 5.5, 3.6, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#1d1d1f';
        for (const x of [-2.5, 0.5]) c.fillRect(x, -7.4, 1.6, 6.8);
        c.beginPath(); c.moveTo(-5.5, -4); c.lineTo(-8, -3.6); c.lineTo(-5.4, -3); c.fill();
        c.beginPath(); c.arc(4.6, -4.4, 2.3, 0, 6.2832); c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(5, -5.4, 1, 1);
        break;
      }
      case 'snail': {
        const ext = Math.sin(time * 2) * 1;
        box(c, -6, 9 + ext, -2.5, 2.5, 0, 3, '#c9d98a', '#a5b866');
        c.fillStyle = '#a5b866';
        c.fillRect(7 + ext, P(0, 3), 1, 6 * GZ);
        c.fillRect(9 + ext, P(0, 3), 1, 5 * GZ);
        c.fillStyle = '#1d1d1f';
        c.fillRect(6.6 + ext, P(0, 9.5), 1.6, 1.6);
        c.fillRect(8.6 + ext, P(0, 8.5), 1.6, 1.6);
        const sx = -1, sy = P(0, 9);
        c.fillStyle = '#b0703a';
        c.beginPath(); c.arc(sx, sy, 6.5, 0, 6.2832); c.fill();
        c.strokeStyle = '#7a4a22';
        c.lineWidth = 1.2;
        c.beginPath();
        for (let a = 0; a < 12; a += 0.3) { const r = 6 - a * 0.45; if (r < 0.5) break; c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
        c.stroke();
        break;
      }
      case 'crab': {
        const snap = Math.abs(Math.sin(time * 6)) * 1.5;
        c.strokeStyle = '#c41e1e';
        c.lineWidth = 1.2;
        for (const lx of [-5, -2, 2, 5]) { c.beginPath(); c.moveTo(lx, P(0, 3)); c.lineTo(lx * 1.5, P(-3, 0)); c.stroke(); }
        box(c, -6, 6, -4, 4, 2, 7, '#ff5a4f', '#d1261c');
        for (const s of [-1, 1]) {
          box(c, s * 7 - 1.5, s * 7 + 1.5, -3, 0, 6, 9, '#ff5a4f', '#d1261c');
          box(c, s * 8 - 1.5, s * 8 + 1.5, -3, 0, 9 + snap, 12 + snap, '#ff5a4f', '#d1261c');
        }
        c.fillStyle = '#1d1d1f';
        for (const ex of [-2, 1.5]) { c.fillRect(ex, P(-2, 7), 1, 3 * GZ); c.fillRect(ex - 0.4, P(-2, 10.5), 1.8, 1.8); }
        break;
      }
      case 'slime': {
        const bounce = Math.abs(Math.sin(time * 5)) * 4, sq = 1 + (1 - bounce / 4) * 0.15;
        const cy = P(0, 4 + bounce);
        c.fillStyle = '#4ad94a';
        c.beginPath(); c.ellipse(0, cy, 6 * sq, 5 / sq, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#8dff8a';
        c.beginPath(); c.ellipse(-1, cy - 1.5, 4.5 * sq, 3 / sq, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#1d1d1f';
        c.fillRect(1, cy - 1.5, 1.4, 2);
        c.fillRect(3.5, cy - 1.5, 1.4, 2);
        break;
      }
      case 'ghostie': {
        c.globalAlpha *= 0.85;
        c.fillStyle = '#f7f7fb';
        c.beginPath();
        c.arc(0, -10, 6, Math.PI, 0);
        c.lineTo(6, -2);
        for (let k = 0; k < 4; k++) c.lineTo(6 - (k + 0.5) * 3, k % 2 ? -2 : 0 + Math.sin(time * 6 + k) * 0.8);
        c.lineTo(-6, -2);
        c.closePath();
        c.fill();
        c.fillStyle = '#2b2b40';
        c.beginPath(); c.ellipse(0.5, -10, 1.1, 1.5, 0, 0, 6.2832); c.ellipse(3.5, -10, 1.1, 1.5, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,140,170,0.5)';
        c.fillRect(4.5, -8, 1.6, 1);
        break;
      }
      case 'goldfish': {
        const cy = P(0, 9);
        box(c, -4, 4, -3, 3, 0, 1.5, '#9aa0a8', '#6d737c');
        c.fillStyle = 'rgba(120,200,255,0.35)';
        c.beginPath(); c.arc(0, cy, 8, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(70,160,230,0.45)';
        c.beginPath(); c.arc(0, cy, 8, 0.25, Math.PI - 0.25); c.fill();
        const fx = Math.sin(time * 1.8) * 3, dir = Math.cos(time * 1.8) > 0 ? 1 : -1;
        c.fillStyle = '#ff8a1a';
        c.beginPath(); c.ellipse(fx, cy + 1.5, 2.6, 1.6, 0, 0, 6.2832); c.fill();
        c.beginPath(); c.moveTo(fx - dir * 2, cy + 1.5); c.lineTo(fx - dir * 4.5, cy - 0.3); c.lineTo(fx - dir * 4.5, cy + 3.3); c.fill();
        c.strokeStyle = 'rgba(230,248,255,0.85)';
        c.lineWidth = 1;
        c.beginPath(); c.arc(0, cy, 8, 0, 6.2832); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fillRect(-5, cy - 5, 1.5, 3);
        break;
      }
      case 'golem': {
        const step = Math.sin(time * 6) * 1;
        for (const lx of [-4, 1]) box(c, lx, lx + 3.5, -2.5, 2.5, 0, 6 + (lx < 0 ? step : -step), '#7d8088', '#5d6068');
        box(c, -6, 6, -4, 4, 6, 17, '#8d9098', '#6d7078');
        c.fillStyle = '#5aa648';
        c.fillRect(-5, P(-4, 16), 4, 2);
        c.fillRect(2, P(4, 17) , 3, 2);
        for (const s of [-1, 1]) box(c, s < 0 ? -9 : 6, s < 0 ? -6 : 9, -2, 2, 7, 15, '#7d8088', '#5d6068');
        box(c, -4, 4, -3.5, 3.5, 17, 23, '#9a9da6', '#7a7d86');
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = o.ready === false ? '#2f6a72' : '#4df0ff'; // dim while it recharges
        c.fillRect(0.5, P(-3.5, 21), 1.8, 1.6);
        c.fillRect(3, P(-3.5, 21), 1.2, 1.6);
        c.fillStyle = o.ready === false ? 'rgba(77,240,255,0.06)' : 'rgba(77,240,255,0.3)';
        c.beginPath(); c.arc(2, P(-3.5, 20.3), 3.5, 0, 6.2832); c.fill();
        c.restore();
        break;
      }
      case 'fairy': {
        const flap = Math.abs(Math.sin(time * 22)) * 3;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(255,170,240,${0.3 + 0.1 * Math.sin(time * 5)})`;
        c.beginPath(); c.arc(0, -8, 11, 0, 6.2832); c.fill();
        c.restore();
        c.fillStyle = 'rgba(210,240,255,0.75)';
        c.beginPath(); c.ellipse(-3, -11 - flap, 3, 5, -0.5, 0, 6.2832); c.fill();
        c.beginPath(); c.ellipse(-2, -6 + flap * 0.3, 2.2, 3.4, 0.6, 0, 6.2832); c.fill();
        c.fillStyle = '#ff7ad1';
        c.beginPath(); c.moveTo(0, -10); c.lineTo(3.5, -3); c.lineTo(-3.5, -3); c.closePath(); c.fill();
        c.fillStyle = '#ffe0c4';
        c.beginPath(); c.arc(0, -12, 2.4, 0, 6.2832); c.fill();
        c.fillStyle = '#ffd23f';
        c.fillRect(-2.4, -15, 4.8, 1.6);
        c.strokeStyle = '#ffe9a0';
        c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(2, -8); c.lineTo(6, -12); c.stroke();
        c.fillStyle = '#ffffff';
        starPath(c, 6, -12.5, 2, 0.8);
        c.fill();
        if (o.x !== undefined && Math.random() < 0.3) FX.spawn('glow', o.x + rand(-6, 6), o.y + rand(-3, 3), o.z + rand(0, 10), { vz: -15, life: 0.6, size: 1.6, size2: 0.3, color: pick(['#ffd6f5', '#fff6b0', '#bfe8ff']) });
        break;
      }
      case 'magbot': { // a little flying robot with a horseshoe magnet
        const bob = Math.sin(time * 3) * 1.5, y = -8 + bob;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = `rgba(255,90,120,${0.25 + 0.2 * Math.sin(time * 5)})`;
        c.lineWidth = 1;
        for (let k = 0; k < 2; k++) { const r = 8 + ((time * 14 + k * 6) % 12); c.beginPath(); c.arc(0, y + 9, r, 0.3, Math.PI - 0.3); c.stroke(); }
        c.restore();
        c.fillStyle = '#c9d1dc';
        c.fillRect(-5, y - 6, 10, 7);
        c.fillStyle = '#8d97a6';
        c.fillRect(-5, y, 10, 1.5);
        c.fillStyle = '#4df0ff';
        c.fillRect(-3, y - 4, 2, 2); c.fillRect(1, y - 4, 2, 2);
        c.fillStyle = '#9aa0a8';
        c.fillRect(-0.5, y - 9, 1, 3);
        c.fillStyle = Math.sin(time * 5) > 0 ? '#ff3b3b' : '#7a1c1c';
        c.fillRect(-1, y - 10, 2, 2);
        c.lineWidth = 3; // the magnet
        c.strokeStyle = '#e63946';
        c.beginPath(); c.arc(0, y + 5, 4, 0, Math.PI); c.stroke();
        c.fillStyle = '#e8ecf2';
        c.fillRect(-5.5, y + 2.5, 3, 2.5); c.fillRect(2.5, y + 2.5, 3, 2.5);
        break;
      }
      case 'luckystar': { // a smiling star that twinkles
        const bob = Math.sin(time * 2.5) * 2, y = -8 + bob;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,220,90,0.3)';
        c.beginPath(); c.arc(0, y, 11, 0, 6.2832); c.fill();
        c.restore();
        c.save();
        c.translate(0, y);
        c.rotate(Math.sin(time * 1.5) * 0.2);
        c.fillStyle = '#ffd23f';
        starPath(c, 0, 0, 8, 3.8);
        c.fill();
        c.fillStyle = '#fff3b0';
        starPath(c, -1, -1, 3.5, 1.6);
        c.fill();
        c.fillStyle = '#1d1d1f';
        c.fillRect(-2.5, -1.5, 1.2, 1.6); c.fillRect(1.3, -1.5, 1.2, 1.6);
        c.fillRect(-1.2, 1.5, 2.4, 0.8);
        c.restore();
        if (((time * 3) | 0) % 4 === 0) FX.glyph(c, 'star', 9, y - 7, 3, '#ffffff', 0);
        break;
      }
      case 'alien': {
        const tilt = Math.sin(time * 2) * 0.12;
        c.rotate(tilt);
        c.fillStyle = 'rgba(180,255,170,0.45)';
        c.beginPath(); c.arc(0, -8, 5, Math.PI, 0); c.fill();
        c.fillStyle = '#7ed957';
        c.beginPath(); c.arc(0, -8, 2.6, 0, 6.2832); c.fill();
        c.fillStyle = '#1d1d1f';
        c.beginPath(); c.ellipse(1, -8.4, 1, 1.4, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#9aa0a8';
        c.beginPath(); c.ellipse(0, -7, 10, 3, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#6d737c';
        c.beginPath(); c.ellipse(0, -6, 10, 2, 0, 0, Math.PI); c.fill();
        for (let k = 0; k < 5; k++) {
          c.fillStyle = (Math.floor(time * 6) + k) % 5 === 0 ? '#ffd23f' : '#4df0ff';
          c.fillRect(-8 + k * 4 - 0.8, -6.2, 1.6, 1.4);
        }
        break;
      }
    }
    if (['mimic', 'turtle', 'rock', 'hamster', 'bunny', 'fox', 'frostfox', 'panda', 'robopup', 'mole', 'luckycat', 'penguin', 'bat', 'bee', 'snail', 'crab', 'slime', 'ghostie', 'goldfish', 'golem', 'fairy', 'alien', 'magbot', 'luckystar'].includes(o.type)) { c.restore(); return; }
    if (o.type === 'phoenix') { // a tiny firebird with a burning tail
      const flap = Math.sin(time * 16) * 5, fl = Math.sin(time * 23);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,140,40,0.28)';
      c.beginPath(); c.arc(0, -4, 14, 0, 6.2832); c.fill();
      c.restore();
      for (let k = 0; k < 3; k++) { // tail flames
        c.fillStyle = ['#ffe27a', '#ff8a2a', '#e8401a'][k];
        c.beginPath();
        c.moveTo(-4, -4 + k);
        c.quadraticCurveTo(-12 - k * 2, -9 - fl * 2 + k * 3, -17 - k * 2 + fl, -2 + k * 2);
        c.quadraticCurveTo(-10, -1 + k, -4, -2);
        c.fill();
      }
      c.fillStyle = '#e0521c';
      c.beginPath(); c.moveTo(-2, -5); c.lineTo(-10, -6 - flap); c.lineTo(3, -3); c.closePath(); c.fill();
      c.fillStyle = '#ff9a2a';
      c.beginPath(); c.ellipse(0, -4, 7, 4, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#ffc14a';
      c.beginPath(); c.arc(6, -8, 3.6, 0, 6.2832); c.fill();
      c.fillStyle = '#ffe95c'; // crest
      c.beginPath(); c.moveTo(4, -11); c.lineTo(3 + fl, -16); c.lineTo(7, -11.5); c.lineTo(8 - fl, -15); c.lineTo(8.5, -10); c.closePath(); c.fill();
      c.fillStyle = '#ffd23f';
      c.fillRect(9, -8.5, 3, 1.6);
      c.fillStyle = '#1d1d1f';
      c.fillRect(6.8, -9.4, 1.3, 1.3);
      c.fillStyle = '#ff7a1a';
      c.beginPath(); c.moveTo(1, -5); c.lineTo(-7, -4 + flap); c.lineTo(4, -3); c.closePath(); c.fill();
      c.restore();
      return;
    }
    if (o.type === 'dragon') { // a little purple dragon, flapping hard to keep up
      const flap = Math.sin(time * 12) * 6;
      c.fillStyle = '#5b2a86';
      c.beginPath(); c.moveTo(-3, -7); c.lineTo(-8, -18 - flap); c.lineTo(-1, -14 - flap * 0.6); c.lineTo(3, -7); c.closePath(); c.fill();
      c.strokeStyle = '#7d3cb5';
      c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-6, -4); c.quadraticCurveTo(-13, -2, -15, -7); c.stroke();
      c.fillStyle = '#7d3cb5';
      c.beginPath(); c.moveTo(-15, -7); c.lineTo(-18, -9); c.lineTo(-16, -4); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(-1, -5, 7.5, 4.6, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#c9a2f0';
      c.beginPath(); c.ellipse(0, -3.4, 5, 2.4, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#7d3cb5';
      c.beginPath(); c.ellipse(7, -9, 4.6, 3.8, 0, 0, 6.2832); c.fill();
      c.fillRect(9, -9, 5, 3.2); // snout
      c.fillStyle = '#ffd23f'; // horns
      c.beginPath(); c.moveTo(5, -12); c.lineTo(3.5, -16); c.lineTo(7, -12.5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(8, -12.5); c.lineTo(8, -16.5); c.lineTo(10, -12); c.closePath(); c.fill();
      c.fillStyle = '#fff';
      c.fillRect(7.6, -11, 2.4, 2.4);
      c.fillStyle = '#1d1d1f';
      c.fillRect(8.8, -10.6, 1.2, 1.6);
      c.fillRect(12.5, -8.2, 1, 1);
      c.fillStyle = '#6a2f9a';
      c.beginPath(); c.moveTo(-1, -7); c.lineTo(-5, -15 + flap); c.lineTo(2, -12 + flap * 0.6); c.lineTo(4, -7); c.closePath(); c.fill();
      if (o.breath > 0) { // a lick of flame at the mouth
        c.fillStyle = '#ffb000';
        c.beginPath(); c.arc(15, -7.5, 2.4, 0, 6.2832); c.fill();
      }
      c.restore();
      return;
    }
    if (o.type === 'owl') { // round, wide-eyed and always watching the traffic
      const flap = Math.sin(time * 9) * 4;
      c.fillStyle = '#6b4a2a';
      c.beginPath(); c.moveTo(-5, -7); c.lineTo(-13, -8 - flap); c.lineTo(-4, -3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(5, -7); c.lineTo(13, -8 - flap); c.lineTo(4, -3); c.closePath(); c.fill();
      c.fillStyle = '#8a6239';
      c.beginPath(); c.ellipse(0, -7, 7, 8, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#e8d6b0';
      c.beginPath(); c.ellipse(0, -4, 4.5, 4.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#8a6239'; // ear tufts
      c.beginPath(); c.moveTo(-6, -12); c.lineTo(-6, -17); c.lineTo(-2.5, -13.5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(6, -12); c.lineTo(6, -17); c.lineTo(2.5, -13.5); c.closePath(); c.fill();
      for (const ex of [-2.8, 2.8]) {
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(ex, -10, 2.7, 0, 6.2832); c.fill();
        c.fillStyle = '#ffc619';
        c.beginPath(); c.arc(ex + 0.4, -10, 1.8, 0, 6.2832); c.fill();
        c.fillStyle = '#1d1d1f';
        c.beginPath(); c.arc(ex + 0.6, -10, 0.9, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#ff9f1c';
      c.beginPath(); c.moveTo(-1, -8); c.lineTo(1, -8); c.lineTo(0, -5.8); c.closePath(); c.fill();
      c.restore();
      return;
    }
    if (o.type === 'unicorn') { // white pony, rainbow mane, golden horn
      const trot = Math.sin(time * 14) * 1.2;
      for (const lx of [-6, -3, 4, 7]) box(c, lx - 1, lx + 1, -3, -1, 0, 6 + (lx > 0 ? trot : -trot) * 0.3, '#ececf4', '#c9c9d6');
      box(c, -8, 9, -4, 4, 6, 13, '#ffffff', '#dcdcea');
      box(c, 7, 10, -2.5, 2.5, 11, 18, '#ffffff', '#dcdcea'); // neck
      box(c, 8, 16, -3, 3, 16, 21, '#ffffff', '#dcdcea'); // head
      c.fillStyle = '#ffb3c7';
      c.fillRect(14, P(-3, 17), 2, 2);
      c.fillStyle = '#1d1d1f';
      c.fillRect(12, P(-3, 20), 1.5, 1.5);
      c.fillStyle = '#ffd23f'; // horn
      c.beginPath(); c.moveTo(11, P(0, 21)); c.lineTo(14.5, P(0, 31)); c.lineTo(13.5, P(0, 21)); c.closePath(); c.fill();
      const mane = ['#ff5c8a', '#ffb000', '#ffe95c', '#7ed957', '#34c6ea', '#a78bfa'];
      mane.forEach((col, k) => { // mane down the neck, tail at the back
        c.fillStyle = col;
        c.fillRect(6 + k * 0.6, P(0, 21 - k * 1.6), 2.5, 2);
        c.fillRect(-10 - (k % 3), P(0, 12 - k * 1.3 + trot * 0.4), 3, 2);
      });
      if (o.x !== undefined && Math.random() < 0.25) FX.spawn('glow', o.x + rand(-10, 10), o.y + rand(-4, 4), rand(4, 20), { vz: 20, life: 0.5, size: 2, size2: 0.4, color: `hsl(${rand(360)},100%,75%)` });
      c.restore();
      return;
    }
    if (o.type === 'goose') { // solid gold, and knows it
      const bob = Math.sin(time * 6) * 0.8;
      for (const fx of [-2, 2]) { c.fillStyle = '#ff9f1c'; c.fillRect(fx, P(-2, 1.5), 2.5, 1.5 * GZ + 1); }
      box(c, -7, 6, -4.5, 4.5, 1.5, 10, '#ffe98a', '#e0a800');
      box(c, 3, 6, -2, 2, 9, 19 + bob, '#ffe98a', '#e0a800'); // neck
      box(c, 3, 9, -2.5, 2.5, 17 + bob, 21.5 + bob, '#ffe98a', '#e0a800'); // head
      box(c, 9, 12, -1.5, 1.5, 18 + bob, 19.5 + bob, '#ff9f1c', '#e07b00');
      box(c, -10, -6, -2.5, 2.5, 6, 9, '#ffe98a', '#e0a800'); // tail
      c.fillStyle = '#1d1d1f';
      c.fillRect(6.5, P(-2.5, 20.5 + bob), 1.4, 1.4);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      const gl = ((time * 0.8) % 1) * 18 - 9;
      c.fillRect(gl, P(0, 9), 1.6, 5); // a glint runs along the body
      c.restore();
      return;
    }
    if (o.type === 'pigeon' || o.type === 'parrot') { // small flapping birds
      const parrot = o.type === 'parrot', flap = Math.sin(time * 18) * 4;
      const body = parrot ? '#e63946' : '#8d93a3', wing = parrot ? '#3a86ff' : '#6d7282';
      c.fillStyle = wing;
      c.beginPath(); c.moveTo(-2, -4); c.lineTo(-9, -4 - flap); c.lineTo(3, -2); c.closePath(); c.fill();
      c.fillStyle = body;
      c.beginPath(); c.ellipse(0, -3, 6, 3.4, 0, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(5, -6, 2.8, 0, 6.2832); c.fill();
      if (!parrot) { c.fillStyle = '#5fbf8f'; c.fillRect(3, -4.5, 3, 1.4); } // shiny neck
      else { c.fillStyle = '#ffd23f'; c.fillRect(-7, -2.5, 4, 2); } // yellow tail
      c.fillStyle = parrot ? '#2b2b2b' : '#e8a0a0';
      c.fillRect(7.5, -6.5, 2.6, 1.6);
      c.fillStyle = '#1d1d1f';
      c.fillRect(5.2, -7, 1.1, 1.1);
      c.fillStyle = wing;
      c.beginPath(); c.moveTo(1, -4); c.lineTo(-6, -4 + flap); c.lineTo(4, -2); c.closePath(); c.fill();
      c.restore();
      return;
    }
    if (o.type === 'duck') {
      for (const fx of [-3, 1]) { c.fillStyle = '#ff9f1c'; c.fillRect(fx, P(-2, 1.5), 2.5, 1.5 * GZ + 1); }
      box(c, -5, 5, -4, 4, 1.5, 9, '#ffe66d', '#f2c230');
      box(c, 1, 6, -3, 3, 7, 13, '#ffe66d', '#f2c230');
      box(c, 6, 9, -1.5, 1.5, 9, 10.5, '#ff9f1c', '#e07b00');
      c.fillStyle = '#1d1d1f';
      c.fillRect(4, P(-3, 11.5), 1.4, 1.4);
      box(c, -7, -4, -2, 2, 6, 8, '#fff1a8', '#f2c230');
    } else if (o.type === 'dog') {
      const wag = Math.sin(time * 16) * 3;
      for (const lx of [-6, -3, 3, 6]) box(c, lx - 1, lx + 1, -3, -1, 0, 5, '#9c6b3f', '#7a512c');
      box(c, -8, 8, -4, 4, 5, 11, '#b07c4a', '#8a5d33');
      c.fillStyle = '#f2e6d4';
      c.fillRect(-4, P(-4, 8), 7, 3 * GZ);
      box(c, 6, 13, -3.5, 3.5, 9, 16, '#b07c4a', '#8a5d33');
      box(c, 12, 15, -2, 2, 10, 13, '#8a5d33', '#6b4526');
      c.fillStyle = '#1d1d1f';
      c.fillRect(14, P(-2, 13), 1.6, 1.6);
      c.fillRect(10, P(-3.5, 15), 1.4, 1.4);
      box(c, 7, 9, -3.5, -2, 14, 17, '#6b4526', '#4d311b'); // ear
      c.strokeStyle = '#8a5d33';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, P(0, 10)); c.lineTo(-12, P(wag, 15)); c.stroke();
    } else if (o.type === 'cat') {
      const tail = Math.sin(time * 3) * 2;
      for (const lx of [-5, 4]) box(c, lx - 1, lx + 1, -3, -1, 0, 4, '#e0913a', '#b8702a');
      box(c, -7, 7, -4, 4, 4, 10, '#f0a24a', '#c9802f');
      c.fillStyle = '#b8702a';
      for (const sx of [-4, 0]) c.fillRect(sx, P(4, 10) - 0.5, 2, 5 * GY);
      box(c, 4, 11, -3.5, 3.5, 8, 15, '#f0a24a', '#c9802f');
      c.fillStyle = '#c9802f';
      for (const ex of [5, 9]) { c.beginPath(); c.moveTo(ex, P(0, 15)); c.lineTo(ex + 1, P(0, 19)); c.lineTo(ex + 2, P(0, 15)); c.closePath(); c.fill(); }
      c.fillStyle = '#2e7d32';
      c.fillRect(8, P(-3.5, 13), 1.6, 1.6);
      c.fillStyle = '#ffb3c7';
      c.fillRect(10.5, P(-3.5, 11), 1.2, 1);
      c.strokeStyle = '#c9802f';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-7, P(0, 8)); c.quadraticCurveTo(-11, P(0, 12), -10 + tail, P(0, 17)); c.stroke();
    }
    c.restore();
  }

  // ---- Road work -----------------------------------------------------------------
  function pit(c, x, y) {
    const hw = TILE / 2 - 3, yt = P(y + TILE / 2 - 4, 0), h = (TILE - 8) * GY;
    c.fillStyle = '#1a1512';
    c.fillRect(x - hw, yt, hw * 2, h);
    c.fillStyle = '#3a2d22'; // far wall of the hole
    c.fillRect(x - hw, yt, hw * 2, h * 0.45);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(x - hw, yt + h * 0.45, hw * 2, 2);
    for (let k = 0; k < 6; k++) { // hazard stripes around the edge
      c.fillStyle = k % 2 ? '#16181c' : '#fcc21b';
      c.fillRect(x - hw + k * (hw / 3), yt + h - 2, hw / 3, 2.5);
      c.fillRect(x - hw + k * (hw / 3), yt - 1, hw / 3, 2.5);
    }
  }

  function cone(c) {
    box(c, -8, 8, -7, 7, 0, 2, '#f26722', '#c44c10');
    box(c, -5.5, 5.5, -4.5, 4.5, 2, 8, '#f26722', '#c44c10');
    box(c, -4, 4, -3.5, 3.5, 8, 12, '#f7f7f2', '#d6d6d0');
    box(c, -2.5, 2.5, -2, 2, 12, 18, '#f26722', '#c44c10');
  }

  function barrier(c, time) {
    for (const x of [-14, 12]) box(c, x, x + 2, -4, 4, 0, 16, '#d6d6d0', '#a9a9a2');
    for (let k = 0; k < 6; k++) {
      c.fillStyle = k % 2 ? '#f7f7f2' : '#f26722';
      c.fillRect(-16 + k * (32 / 6), P(-4, 16), 32 / 6, 7 * GZ);
    }
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(-16, P(-4, 9), 32, 1);
    const on = Math.sin(time * 6) > 0;
    box(c, -3, 3, -2, 2, 16, 20, on ? '#ffd23f' : '#8a6a10', on ? '#e0a100' : '#6a500c');
  }

  function worksign(c, time) {
    box(c, -1.5, 1.5, -1.5, 1.5, 0, 32, '#a5abb5', '#7c828c');
    const cy = P(-2, 42);
    c.fillStyle = '#16181c';
    poly(c, 0, cy, 14, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
    c.fill();
    c.fillStyle = '#f26722';
    poly(c, 0, cy, 12, [[0, -1], [1, 0], [0, 1], [-1, 0]]);
    c.fill();
    c.fillStyle = '#16181c';
    c.font = `900 4.2px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('ROAD', 0, cy - 2.4);
    c.fillText('WORK', 0, cy + 2.6);
    if (Math.sin(time * 5) > 0) {
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(0, cy - 16, 2.5, 0, 6.2832); c.fill();
    }
  }

  // Excavator parked at the edge of a work row; its bucket swings across the row.
  function excavator(c, o, time) {
    const s = o.side, Y = '#f2b705', YF = '#c78f00';
    // tracks and body
    box(c, -36, 36, -15, 15, 0, 9, '#2c2e33', '#1c1d21');
    c.fillStyle = '#4a4d55';
    for (let x = -34; x < 34; x += 6) c.fillRect(x, P(-15, 7), 3, 5 * GZ);
    box(c, -28, 28, -12, 12, 9, 26, Y, YF);
    const cx0 = s > 0 ? -28 : 4, cx1 = s > 0 ? -4 : 28; // cab on the far side from the arm
    box(c, cx0, cx1, -11, 9, 26, 44, Y, YF);
    c.fillStyle = '#27354d';
    c.fillRect(cx0 + 3, P(-11, 41), cx1 - cx0 - 6, 12 * GZ);
    c.fillStyle = 'rgba(210,235,255,0.35)';
    c.fillRect(cx0 + 3, P(-11, 41), 3, 12 * GZ);
    box(c, s > 0 ? 6 : -26, s > 0 ? 26 : -6, -10, 8, 26, 32, '#3a3d44', '#26282d'); // engine cover
    c.fillStyle = '#16181c';
    c.font = `900 5px ${UI_FONT}`;
    c.textAlign = 'center';
    c.fillText('DIG CO', (cx0 + cx1) / 2, P(-12, 18));
    const on = o.state === 'warn' || o.state === 'swing' ? Math.sin(time * 16) > 0 : Math.sin(time * 3) > 0.6;
    box(c, (cx0 + cx1) / 2 - 3, (cx0 + cx1) / 2 + 3, -3, 3, 44, 48, on ? '#ff9f1c' : '#7a4a10', on ? '#e07b00' : '#5a3508');

    // arm: boom from the pivot to an elbow, stick down to the bucket
    const pivot = [s * 16, 30];
    const idle = [s * 30, 58];
    const [a, b] = Work.span(o);
    const startRel = a - o.x, endRel = b - o.x;
    let bucket;
    if (o.state === 'idle') bucket = idle;
    else if (o.state === 'warn') { const k = easeOutQuad(clamp(1 - o.t / 1.1, 0, 1)); bucket = [lerp(idle[0], startRel, k), lerp(idle[1], 40, k)]; }
    else if (o.state === 'swing') bucket = [(o.bx || a) - o.x, 10];
    else { const k = easeOutQuad(clamp(1 - o.t / 1.0, 0, 1)); bucket = [lerp(endRel, idle[0], k), lerp(10, idle[1], k)]; }
    const elbow = [lerp(pivot[0], bucket[0], 0.55), Math.max(pivot[1], bucket[1]) + 26];
    const pt = q => [q[0], P(0, q[1])];
    c.lineCap = 'round';
    for (const [w, col] of [[13, '#1c1d21'], [9.5, Y]]) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(...pt(pivot)); c.lineTo(...pt(elbow)); c.lineTo(...pt([bucket[0], bucket[1] + 8]));
      c.stroke();
    }
    c.lineCap = 'butt';
    c.fillStyle = '#3a3d44'; // elbow pin
    c.beginPath(); c.arc(elbow[0], P(0, elbow[1]), 3, 0, 6.2832); c.fill();
    box(c, bucket[0] - 9, bucket[0] + 9, -8, 8, bucket[1], bucket[1] + 10, '#3a3d44', '#26282d');
    c.fillStyle = '#c3c8cf';
    for (let k = -7; k <= 5; k += 4) c.fillRect(bucket[0] + k, P(-8, bucket[1]), 2, 3);
  }

  // Green guide sign where a new biome starts.
  function welcome(c, o) {
    const name = { country: 'COUNTRYSIDE', city: 'CITY LIMITS', desert: 'DESERT', snow: 'MOUNTAIN PASS', beach: 'THE BEACH',
      farm: 'FARMLAND', swamp: 'THE SWAMP', autumn: 'AUTUMN WOODS', harbor: 'THE HARBOR' }[o.zone] || ZONES[o.zone].name;
    c.translate(o.side * 18, 0);
    for (const x of [-26, 24]) box(c, x, x + 2.5, -2, 2, 0, 44, '#a5abb5', '#7c828c');
    const y0 = P(-3, 76), y1 = P(-3, 42);
    c.fillStyle = '#16181c';
    c.fillRect(-36, y0 - 1.5, 72, y1 - y0 + 3);
    c.fillStyle = '#00704a';
    c.fillRect(-35, y0, 70, y1 - y0);
    c.strokeStyle = '#f7f7f2';
    c.lineWidth = 1.2;
    c.strokeRect(-33, y0 + 2, 66, y1 - y0 - 4);
    c.fillStyle = '#f7f7f2';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `800 5.5px ${UI_FONT}`;
    c.fillText('ENTERING', 0, y0 + 9);
    c.font = `900 ${name.length > 11 ? 7.5 : 9}px ${UI_FONT}`;
    c.fillText(name, 0, y0 + 20);
  }

  // ---- Animals and people ----------------------------------------------------------
  // Cow standing in a lane (drawn facing +x).
  // ---- New biome scenery -------------------------------------------------------
  function hay(c) {
    box(c, -14, 14, -9, 9, 0, 14, '#e9c46a', '#c9a23b');
    c.fillStyle = 'rgba(120,80,20,0.35)';
    for (const x of [-7, 0, 7]) c.fillRect(x - 0.6, P(-9, 14), 1.2, 14 * GZ);
    c.fillStyle = 'rgba(255,240,180,0.5)';
    for (let k = 0; k < 6; k++) c.fillRect(-12 + k * 4.5, P(-4 + (k % 3) * 4, 14), 3, 1);
  }

  function corn(c, o) {
    const h = o.h || 34;
    for (const [x, y, k] of [[-8, -4, 0], [3, 2, 1], [-2, -7, 2], [8, -3, 1], [-6, 5, 2]]) {
      const hh = h - k * 4;
      box(c, x - 1, x + 1, y - 1, y + 1, 0, hh, '#7fb84a', '#5f9437');
      c.fillStyle = '#6aa43f';
      for (const z of [hh * 0.35, hh * 0.6, hh * 0.85]) {
        c.beginPath(); c.moveTo(x, P(y, z)); c.lineTo(x + (k % 2 ? 7 : -7), P(y, z - 4)); c.lineTo(x, P(y, z - 2)); c.fill();
      }
      box(c, x - 1.6, x + 1.6, y - 1.6, y + 1.6, hh * 0.55, hh * 0.55 + 5, '#ffd23f', '#e0a800'); // a cob
      c.fillStyle = '#d9c47a';
      c.fillRect(x - 0.5, P(y, hh + 3), 1, 3 * GZ);
    }
  }

  function scarecrow(c) {
    box(c, -1, 1, -1, 1, 0, 30, '#8a5d33', '#6b4526');
    box(c, -12, 12, -1, 1, 20, 22, '#8a5d33', '#6b4526');
    box(c, -6, 6, -3, 3, 12, 24, '#4a7bd1', '#3a62a8');
    c.fillStyle = '#e9c46a';
    for (const x of [-12, 10]) c.fillRect(x, P(-1, 19), 3, 4);
    box(c, -4, 4, -3.5, 3.5, 24, 31, '#f2d9a0', '#d9bd80');
    c.fillStyle = '#1d1d1f';
    c.fillRect(-2.5, P(-3.5, 29), 1.5, 1.5);
    c.fillRect(1, P(-3.5, 29), 1.5, 1.5);
    box(c, -7, 7, -6, 6, 31, 32.5, '#8a6a3a', '#6b502a');
    box(c, -4, 4, -3.5, 3.5, 32.5, 37, '#9a7a4a', '#7a5d33');
  }

  function reeds(c) {
    for (const [x, y, h] of [[-6, -3, 22], [-2, 2, 28], [3, -5, 24], [7, 1, 19], [0, -1, 16]]) {
      box(c, x - 0.7, x + 0.7, y - 0.7, y + 0.7, 0, h, '#6a8a3a', '#4f6b2a');
      if (h > 18) box(c, x - 1.6, x + 1.6, y - 1.6, y + 1.6, h - 6, h, '#7a4a22', '#5a3416'); // cattail
    }
    c.fillStyle = 'rgba(40,70,40,0.35)';
    c.beginPath(); c.ellipse(0, P(0, 0), 12, 12 * GY, 0, 0, 6.2832); c.fill();
  }

  function stump(c) {
    box(c, -8, 8, -7, 7, 0, 9, '#8a6040', '#6b4526');
    c.fillStyle = '#c9a070';
    c.beginPath(); c.ellipse(0, P(0, 9), 7, 6 * GY, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(110,70,40,0.6)';
    c.lineWidth = 0.8;
    for (const r of [2, 4.5]) { c.beginPath(); c.ellipse(0, P(0, 9), r, r * 0.85 * GY, 0, 0, 6.2832); c.stroke(); }
    c.fillStyle = '#6a9a4a';
    c.fillRect(4, P(-7, 6), 4, 3);
  }

  function crate(c, o) {
    const col = o.color || '#b88a58', f = shade(col, -0.22);
    box(c, -10, 10, -9, 9, 0, 17, col, f);
    c.fillStyle = shade(col, -0.35);
    c.fillRect(-10, P(-9, 17), 20, 1.6);
    c.fillRect(-10, P(-9, 1.6), 20, 1.6);
    c.save();
    c.beginPath(); c.rect(-10, P(-9, 17), 20, 17 * GZ); c.clip();
    c.lineWidth = 1.6;
    c.strokeStyle = shade(col, -0.35);
    c.beginPath(); c.moveTo(-10, P(-9, 17)); c.lineTo(10, P(-9, 0)); c.stroke();
    c.restore();
  }

  function barrel(c) {
    box(c, -7, 7, -6, 6, 0, 18, '#3a86ff', '#2667cc');
    c.fillStyle = '#1d4f9e';
    for (const z of [4, 14]) c.fillRect(-7, P(-6, z + 1), 14, 2 * GZ);
    c.fillStyle = '#5aa0ff';
    c.beginPath(); c.ellipse(0, P(0, 18), 6.5, 5.5 * GY, 0, 0, 6.2832); c.fill();
  }

  function bollard(c) {
    box(c, -4, 4, -4, 4, 0, 10, '#2b2d33', '#1a1b1f');
    box(c, -5.5, 5.5, -5.5, 5.5, 10, 12, '#3a3d44', '#26282d');
    c.strokeStyle = '#d9c39a'; // mooring rope
    c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(0, P(0, 7), 5, 3, 0, 0, 6.2832); c.stroke();
  }

  function container(c, o) {
    const col = o.color || '#c1121f', f = shade(col, -0.25);
    for (let k = 0; k < (o.stack || 1); k++) {
      const z = k * 26;
      box(c, -38, 38, -16, 16, z, z + 26, col, f);
      c.fillStyle = shade(col, -0.35);
      for (let x = -35; x < 36; x += 5) c.fillRect(x, P(-16, z + 24), 1.4, 22 * GZ);
    }
  }

  function sheep(c, v, time) {
    const hy = 9, z0 = 7, zt = 20;
    for (const [lx, ly] of [[-10, -6], [-10, 4], [7, -6], [7, 4]]) box(c, lx, lx + 3, ly, ly + 2.5, 0, z0, '#2b2522', '#1a1614');
    box(c, -13, 11, -hy, hy, z0, zt, '#f7f5ee', '#dcd8cc');
    c.fillStyle = '#ffffff'; // fluffy bumps
    for (const [x, y] of [[-8, 3], [-1, -4], [5, 4], [-5, -6], [2, 0]]) { c.beginPath(); c.arc(x, P(y, zt + 1), 3.6, 0, 6.2832); c.fill(); }
    const bob = Math.sin(time * 2.2 + v.x * 0.1) * 0.8;
    box(c, 11, 18, -4, 4, zt - 8 + bob, zt + bob, '#2b2522', '#1a1614');
    c.fillStyle = '#f7f5ee';
    c.fillRect(12, P(-4, zt + 1 + bob), 6, 2.5);
    c.fillStyle = '#ffffff';
    c.fillRect(15.5, P(-4, zt - 3 + bob), 1.4, 1.4);
    box(c, 10, 12, -6, -4, zt - 4 + bob, zt - 2 + bob, '#2b2522', '#1a1614');
    box(c, 10, 12, 4, 6, zt - 4 + bob, zt - 2 + bob, '#2b2522', '#1a1614');
    if (v.wreck && v.gore) {
      c.fillStyle = '#9e0b1a';
      c.fillRect(-6, P(-hy, zt - 2), 12, 8 * GZ);
    }
  }

  function cow(c, v, time) {
    if (v.sheep) { sheep(c, v, time); return; }
    const hy = 11, z0 = 9, zt = 24;
    const W = '#f4f1ea', WF = '#d8d2c6', B = '#2b2522';
    for (const [lx, ly] of [[-13, -8], [-13, 6], [11, -8], [11, 6]]) box(c, lx, lx + 4, ly, ly + 3, 0, z0, W, WF);
    c.fillStyle = B;
    for (const [lx, ly] of [[-13, -8], [11, -8]]) c.fillRect(lx, P(ly, 2), 4, 2 * GZ);
    box(c, -17, 15, -hy, hy, z0, zt, W, WF);
    c.fillStyle = B; // spots
    const sp = v.spots || [[-6, 2], [4, -4], [-12, -2]];
    for (const [sx, sy] of sp) c.fillRect(sx, P(sy, zt) - 2, 7, 5);
    c.fillRect(-10, P(-hy, zt - 3), 8, 7 * GZ);
    c.fillRect(6, P(-hy, zt - 6), 6, 6 * GZ);
    c.fillStyle = '#f2a0a8'; // udder
    c.fillRect(-3, P(-hy + 2, z0), 7, 2.5 * GZ);
    box(c, -19, -17, -1, 1, zt - 10, zt - 1, WF, B); // tail
    const bob = Math.sin(time * 2 + v.x * 0.1) * 1;
    box(c, 15, 25, -6, 6, zt - 6 + bob, zt + 5 + bob, W, WF); // head
    box(c, 22, 27, -5, 5, zt - 6 + bob, zt - 1 + bob, '#f2a0a8', '#d9848c'); // snout
    c.fillStyle = B;
    c.fillRect(19, P(-6, zt + 2 + bob), 2.5, 2.5);
    box(c, 16, 18, -8, -6, zt + 5 + bob, zt + 9 + bob, '#e8e0cc', '#c9bfa8');
    box(c, 16, 18, 6, 8, zt + 5 + bob, zt + 9 + bob, '#e8e0cc', '#c9bfa8');
    if (v.wreck && v.gore) {
      c.fillStyle = '#9e0b1a';
      c.fillRect(-8, P(-hy, zt - 2), 14, 9 * GZ);
      c.fillRect(-4, P(4, zt) - 2, 10, 5);
    }
  }

  // Deer bolting across the road (moving up or down the screen).
  function deer(c, d, time) {
    const up = d.vy > 0, z = d.z, B = '#b07742', BF = '#8a5a30', BD = shade(BF, -0.2);
    const leg = Math.sin(d.ph) * 4;
    for (const [lx, ly, ph] of [[-7, -11, 1], [4, -11, -1], [-7, 8, -1], [4, 8, 1]]) {
      box(c, lx, lx + 3, ly + ph * leg, ly + ph * leg + 3, z, z + 13, BF, BD);
    }
    box(c, -9, 9, -13, 13, z + 12, z + 25, B, BF);
    c.fillStyle = '#f2e6d4'; // pale belly
    c.fillRect(-6, P(-13, z + 17), 12, 5 * GZ);
    const hy0 = up ? 9 : -19, hy1 = hy0 + 10;
    box(c, -3, 3, up ? 7 : -15, up ? 13 : -9, z + 22, z + 30, B, BF); // neck
    box(c, -5.5, 5.5, hy0, hy1, z + 28, z + 38, B, BF); // head
    box(c, -9, -5, hy0 + 3, hy0 + 6, z + 35, z + 39, BF, BD); // ears
    box(c, 5, 9, hy0 + 3, hy0 + 6, z + 35, z + 39, BF, BD);
    if (!up) { // face: eyes and a dark nose
      c.fillStyle = '#1d1d1f';
      c.fillRect(-4, P(hy0, z + 35), 2.2, 2.2);
      c.fillRect(1.8, P(hy0, z + 35), 2.2, 2.2);
      box(c, -2, 2, hy0 - 2, hy0, z + 28, z + 31, '#2b2522', '#1d1d1f');
    } else { // white tail flag
      box(c, -3, 3, -16, -13, z + 19, z + 27, '#ffffff', '#e6e6e0');
    }
    if (d.buck) {
      c.strokeStyle = '#e3cfab';
      c.lineWidth = 2;
      c.lineCap = 'round';
      c.beginPath();
      const hz = z + 38, hy = hy0 + 5;
      for (const s of [-1, 1]) {
        c.moveTo(s * 3, P(hy, hz));
        c.lineTo(s * 9, P(hy, hz + 11));
        c.lineTo(s * 13, P(hy, hz + 13));
        c.moveTo(s * 7, P(hy, hz + 7));
        c.lineTo(s * 3, P(hy, hz + 12));
      }
      c.stroke();
      c.lineCap = 'butt';
    }
  }

  function weed(c, w) {
    c.save();
    c.translate(0, P(0, w.z + w.r));
    c.rotate(w.rot);
    c.strokeStyle = '#a07a45';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(0, 0, w.r, 0, 6.2832);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05;
      c.moveTo(Math.cos(a) * w.r, Math.sin(a) * w.r);
      c.lineTo(Math.cos(a + 2.2) * w.r * 0.8, Math.sin(a + 2.2) * w.r * 0.8);
    }
    c.stroke();
    c.strokeStyle = 'rgba(120,90,50,0.6)';
    c.beginPath();
    c.arc(0, 0, w.r * 0.55, 0.5, 5);
    c.stroke();
    c.restore();
  }

  // Paramedic (graphic mode).
  function medic(c, m, time) {
    const kneel = !m.moving, step = m.moving ? Math.sin(m.ph) * 2 : 0;
    if (kneel) {
      box(c, -5, 5, -3, 5, 0, 5, '#2e6b4a', '#23523a');
      box(c, -5, 5, -4, 4, 5, 15, '#3b8a5f', '#2c6a48');
    } else {
      box(c, -4, -1, -2 + step, 1 + step, 0, 10, '#2e6b4a', '#23523a');
      box(c, 1, 4, -2 - step, 1 - step, 0, 10, '#2e6b4a', '#23523a');
      box(c, -5, 5, -3, 3, 10, 21, '#3b8a5f', '#2c6a48');
    }
    const top = kneel ? 15 : 21;
    c.fillStyle = '#f7f7f2';
    c.fillRect(-1.5, P(-3, top - 3), 3, 3);
    box(c, -4, 4, -3.5, 3.5, top, top + 8, '#f0c9a0', '#d6a878');
    box(c, -4.5, 4.5, -4, 4, top + 7, top + 9, '#f7f7f2', '#d6d6d0');
    c.fillStyle = '#1d1d1f';
    c.fillRect(-2.5, P(-3.5, top + 5), 1.5, 1.5);
    c.fillRect(1, P(-3.5, top + 5), 1.5, 1.5);
  }

  // Seagull (flying, or grabbing something).
  function gull(c, g, time) {
    c.save();
    c.translate(0, P(0, g.z));
    c.scale(g.face, 1);
    const flap = Math.sin(g.ph) * 7;
    c.fillStyle = '#c9ced6'; // wings
    c.beginPath(); c.moveTo(-2, -6); c.lineTo(-16, -6 - flap); c.lineTo(-6, -3); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(2, -6); c.lineTo(14, -6 - flap); c.lineTo(6, -3); c.closePath(); c.fill();
    c.fillStyle = '#3a3d44';
    c.fillRect(-16, -7 - flap, 3, 2);
    c.fillRect(12, -7 - flap, 3, 2);
    c.fillStyle = '#fbfbf6'; // body and head
    c.beginPath(); c.ellipse(0, -5, 9, 4.5, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(8, -8, 3.6, 0, 6.2832); c.fill();
    c.fillStyle = '#ffb000';
    c.fillRect(11, -8.5, 4.5, 1.8);
    c.fillStyle = '#16181c';
    c.fillRect(8.6, -9.4, 1.4, 1.4);
    if (g.carry) { // the loot
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(15, -6.5, 2.6, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  // "P1" / "P2" tag over a player's head in two-player mode.
  function tag(c, text, color, z) {
    const y = P(0, z);
    c.font = `900 8px ${UI_FONT}`;
    c.fillStyle = color;
    c.fillRect(-9, y - 6, 18, 11);
    c.beginPath(); c.moveTo(-3, y + 5); c.lineTo(3, y + 5); c.lineTo(0, y + 9); c.closePath(); c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, y);
  }

  return {
    LANE_D, box, shadow, vehiclePalette, wreckPalette, vehicle, warning,
    hay, corn, scarecrow, reeds, stump, crate, barrel, bollard, container,
    tree, bush, rock, lamp, sign, player, hint, ghost, bestGhost, stars, bubble, coin, powerItem, icon, iconURL, egg, eggPic, headTop, grave, stand, mysteryBox,
    trainCar, log, xing,
    cactus, deadbush, skull, mesa, planter, hydrant, bin, mailbox, bench, snowman, building, buildingWindows,
    pit, cone, barrier, worksign, excavator, welcome, cow, deer, weed, medic, tag,
    umbrella, chair, sandcastle, palm, lifeguard, gull, pet,
  };
})();
