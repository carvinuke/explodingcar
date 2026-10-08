'use strict';
// Cars for the new games, in Road Rush's blocky oblique style.
// Road Rush only ever needs cars driving left or right (Draw.vehicle); these
// add cars driving away from the camera (heading N: you see the tail lights)
// and toward it (heading S: headlights and windscreen), built from the same
// Draw.box blocks and colours. Cars.draw handles all four headings.
//
// A car: { type, len, base, pal, heading: 'E'|'W'|'N'|'S', x, wreck, wreckT,
//          police, responder, brake, blink }  (pal from Cars.palette)

const Cars = (() => {
  const box = (...a) => Draw.box(...a);
  const HW = Draw.LANE_D / 2; // half the car's width

  function palette(base) { return Draw.vehiclePalette(base); }
  function wreckPalette(base) { return Draw.wreckPalette(base); }

  // A new car of a Road Rush vehicle type.
  function make(type, base, heading) {
    const T = VEHICLE_TYPES[type];
    base = base || T.colors[(Math.random() * T.colors.length) | 0];
    return {
      kind: 'vehicle', type, base, pal: palette(base), len: T.len * TILE, heading, x: 0, y: 0, dir: 1,
      police: type === 'police', responder: !!T.responder, wreck: false, wreckT: 0,
    };
  }

  // Half the car's size along x and along y (for collisions).
  function halfSize(v) {
    const along = v.len / 2, across = HW + 1;
    return v.heading === 'E' || v.heading === 'W' ? [along, across] : [across, along];
  }

  // ---- Driving away from / toward the camera ----------------------------------
  // `u` runs along the car from the back (0) to the front (1).
  function bodyNS(c, v) {
    const T = VEHICLE_TYPES[v.type], pal = v.pal, L = v.len, t = v.type;
    if (T.lux) { Lux.ns(c, v); return; } // the luxury cars have their own shapes
    const toward = v.heading === 'S';
    const yAt = u => (toward ? L / 2 - u * L : -L / 2 + u * L); // world y of a point along the car
    const span = (u0, u1) => { const a = yAt(u0), b = yAt(u1); return a < b ? [a, b] : [b, a]; };
    const z0 = 4, zt = z0 + T.h * TILE;
    const yf = -L / 2; // the face we see (nearest the camera)

    // outline
    c.fillStyle = 'rgba(14,16,20,0.5)';
    c.fillRect(-HW - 1.5, P(L / 2, zt) - 1.5, HW * 2 + 3, P(-L / 2, 0) - P(L / 2, zt) + 2);

    // wheels peeking out at the sides
    for (const w of T.wheels) {
      const y = yAt(0.5 + w);
      box(c, -HW - 2, -HW + 2, y - 6, y + 6, 0, 11, '#24262c', '#121317');
      box(c, HW - 2, HW + 2, y - 6, y + 6, 0, 11, '#24262c', '#121317');
    }

    if (t === 'tanker') { // low chassis, a round-ish tank, cab up front
      box(c, -HW, HW, -L / 2, L / 2, z0, z0 + 8, '#4a4d55', '#33363c');
      const [ta, tb] = span(0.02, 0.74);
      box(c, -HW + 1, HW - 1, ta, tb, z0 + 8, zt - 2, pal.top, pal.front);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-HW + 4, P(tb, zt - 2), 4, (tb - ta) * GY);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(HW - 7, P(tb, zt - 2), 4, (tb - ta) * GY);
      const [ca, cb] = span(0.78, 1);
      box(c, -HW, HW, ca, cb, z0, zt + 2, '#d62828', '#a51e1e');
      if (toward) glassFront(c, pal, ca, zt - 2, zt - 13);
    } else if (!T.cab) { // vans, buses, ambulances, fire trucks: one tall box
      box(c, -HW, HW, -L / 2, L / 2, z0, zt, pal.top, pal.front);
      c.fillStyle = pal.lower;
      c.fillRect(-HW, P(yf, z0 + 5), HW * 2, 5 * GZ);
      if (toward) glassFront(c, pal, yf, zt - 3, zt - 15);
      else { // rear doors
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(-0.5, P(yf, zt - 3), 1, (zt - z0 - 10) * GZ);
        c.fillStyle = pal.glass;
        c.fillRect(-HW + 4, P(yf, zt - 4), HW - 6, 7 * GZ);
        c.fillRect(2, P(yf, zt - 4), HW - 6, 7 * GZ);
      }
      // roof details
      if (t === 'bus') {
        for (let u = 0.15; u < 0.9; u += 0.25) { const y = yAt(u); box(c, -6, 6, y - 5, y + 5, zt, zt + 3, '#d9dde3', '#a9aeb6'); }
      } else if (t === 'firetruck') {
        for (const x of [-7, 5]) box(c, x, x + 2, -L / 2 + 10, L / 2 - 14, zt, zt + 4, '#dfe3e8', '#aab0b8'); // ladder rails
        c.fillStyle = '#aab0b8';
        for (let y = -L / 2 + 14; y < L / 2 - 14; y += 8) c.fillRect(-5, P(y, zt + 4), 10, 1.2);
      } else if (t === 'ambulance') {
        c.fillStyle = '#e63946';
        const my = 0;
        c.fillRect(-2.5, P(my + 8, zt), 5, 16 * GY);
        c.fillRect(-8, P(my + 2.5, zt), 16, 5 * GY);
        c.fillRect(-HW, P(yf, z0 + 15), HW * 2, 3 * GZ); // stripe
      }
    } else { // cars and pickups: body, then the cabin
      const zb = zt;
      box(c, -HW, HW, -L / 2, L / 2, z0, zb, pal.top, pal.front);
      c.fillStyle = pal.lower;
      c.fillRect(-HW, P(yf, z0 + 5), HW * 2, 5 * GZ);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(-HW + 2, P(yf, zb - 3), HW * 2 - 4, 1.2);
      const ch = T.cab[2] * TILE;
      const [ca, cb] = span(T.cab[0], T.cab[1]);
      if (t === 'pickup') { // the open bed behind the cab
        const [ba, bb] = span(0.04, T.cab[0] - 0.02);
        c.fillStyle = pal.dark;
        c.fillRect(-HW + 3, P(bb, zb), HW * 2 - 6, (bb - ba) * GY);
      }
      // the glasshouse: sloped windscreen and rear window, side windows along the roof edges
      const cu = CarShape.cabinU(t);
      const [ra, rb] = span(cu.ur, cu.uf); // the roof, near end first
      CarShape.cabinNS(c, pal, {
        ya: ca, yb: cb, yRa: ra, yRb: rb, zb, zr: zb + ch, wb: HW - 3, wr: HW - 5.5,
        nearIsBack: !toward, glassRoof: t === 'forklift',
        paintNear: !toward && (t === 'tractor' || t === 'logtruck'),
      });
      if (t === 'sports') { // wing on two struts
        const wy = yAt(0.03);
        for (const x of [-HW + 5, HW - 7]) box(c, x, x + 2, wy - 1, wy + 1, zb, zb + 5, pal.dark, pal.dark);
        box(c, -HW + 1, HW - 1, wy - 2.5, wy + 2.5, zb + 5, zb + 7, pal.top, pal.front);
      }
      if (t === 'taxi') {
        const my = (ra + rb) / 2;
        box(c, -6, 6, my - 4, my + 4, zb + ch, zb + ch + 5, '#fff7d1', '#e8d890');
        for (let x = -HW + 2, k = 0; x < HW - 2; x += 4, k++) {
          c.fillStyle = k % 2 ? '#16181c' : '#f7f7f2';
          c.fillRect(x, P(yf, z0 + 11), 4, 2 * GZ);
        }
      }
      if (t === 'police') { // white doors band
        c.fillStyle = '#f4f4f4';
        c.fillRect(-HW, P(yf, zb - 1), HW * 2, (zb - z0 - 7) * GZ);
      }
    }

    // lights on the near face: headlights coming at you, tail lights going away
    const zl = t === 'tanker' || !T.cab ? z0 + 10 : zt - 3;
    if (toward) {
      c.fillStyle = pal.lit ? '#fff7d1' : '#3a3a3a';
      c.fillRect(-HW + 2, P(yf, zl + 2), 5, 4 * GZ);
      c.fillRect(HW - 7, P(yf, zl + 2), 5, 4 * GZ);
      c.fillStyle = 'rgba(0,0,0,0.35)'; // grille
      c.fillRect(-5, P(yf, zl + 1), 10, 3 * GZ);
    } else {
      c.fillStyle = pal.lit ? '#c41f2c' : '#3a2020';
      c.fillRect(-HW + 1, P(yf, zl + 2), 5, 4 * GZ);
      c.fillRect(HW - 6, P(yf, zl + 2), 5, 4 * GZ);
    }
  }

  function glassFront(c, pal, y, z1, z0) {
    c.fillStyle = pal.glass;
    c.fillRect(-HW + 3, P(y, z1), HW * 2 - 6, (z1 - z0) * GZ);
    if (pal.lit) {
      c.fillStyle = pal.glassHi;
      c.fillRect(-HW + 5, P(y, z1), 3, (z1 - z0) * GZ);
    }
  }

  // Things that change from frame to frame, drawn over the cached body.
  function liveNS(c, v, time) {
    const T = VEHICLE_TYPES[v.type], L = v.len;
    if (T.lux) { luxLiveNS(c, v, time); return; }
    const z0 = 4, zt = z0 + T.h * TILE, toward = v.heading === 'S', yf = -L / 2;
    const zl = v.type === 'tanker' || !T.cab ? z0 + 10 : zt - 3;
    if (v.brake && !toward && v.pal.lit) { // brake lights
      c.fillStyle = '#ff4d4d';
      c.fillRect(-HW + 1, P(yf, zl + 2.5), 5, 5 * GZ);
      c.fillRect(HW - 6, P(yf, zl + 2.5), 5, 5 * GZ);
    }
    if (v.blink && Math.sin(time * 12) > 0 && v.pal.lit) { // turn signal: -1 left, 1 right (as the driver sees it)
      const side = (toward ? -v.blink : v.blink) * (HW - 2);
      c.fillStyle = '#ffae00';
      c.fillRect(side - 2.5, P(yf, zl + 6), 5, 3 * GZ);
    }
    if ((v.police || v.responder) && (!v.wreck || v.wreckT < 5)) {
      const cab = T.cab, ch = cab ? cab[2] * TILE : 0;
      const um = cab ? (CarShape.cabinU(v.type).ur + CarShape.cabinU(v.type).uf) / 2 : 0; // the middle of the roof
      const mid = cab ? (toward ? L / 2 - um * L : -L / 2 + um * L) : (toward ? -L / 2 + 10 : L / 2 - 10);
      const z = zt + ch;
      const on = Math.sin(time * 18) > 0;
      box(c, -8, 8, mid - 3, mid + 3, z, z + 3, '#333', '#222');
      c.fillStyle = on ? '#ff2e3a' : '#5a1016';
      c.fillRect(-8, P(mid - 3, z + 3), 8, 3 * GZ);
      c.fillStyle = on ? '#1e3a8a' : '#3b82f6';
      c.fillRect(0, P(mid - 3, z + 3), 8, 3 * GZ);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = on ? 'rgba(255,40,50,0.35)' : 'rgba(60,120,255,0.35)';
      c.beginPath(); c.arc(on ? -4 : 4, P(mid, z + 4), 16, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  }

  // Brake lights and blinkers on a luxury car, where its own lamps are.
  function luxLiveNS(c, v, time) {
    const D = LUX[v.type], toward = v.heading === 'S', yf = -v.len / 2;
    if (!v.pal.lit) return;
    const zt = Lux.at(Lux.prep(D).body, toward ? 1 : 0);
    if (v.brake && !toward) {
      c.fillStyle = 'rgba(255,70,70,0.85)';
      for (const [x0, x1, dz] of D.brakeNS || [[-HW + 1, -HW + 6, 1.5], [HW - 6, HW - 1, 1.5]]) c.fillRect(x0, P(yf, zt - dz), x1 - x0, 2.6 * GZ);
    }
    if (v.blink && Math.sin(time * 12) > 0) {
      const side = (toward ? -v.blink : v.blink) * (HW - 2.5);
      c.fillStyle = '#ffae00';
      c.fillRect(side - 2, P(yf, zt - 1.5), 4, 2.4 * GZ);
    }
  }

  // ---- Any heading -----------------------------------------------------------
  // Drawn at the current origin (the car's ground centre).
  function draw(c, v, time = 0) {
    if (v.heading === 'E' || v.heading === 'W') {
      v.dir = v.heading === 'E' ? 1 : -1;
      c.save();
      if (v.dir < 0) c.scale(-1, 1);
      Draw.vehicle(c, v, 0, time);
      if (v.brake && v.pal.lit) { // brake lights at the back
        const T = VEHICLE_TYPES[v.type], zt = T.lux ? Lux.at(Lux.prep(LUX[v.type]).body, 0.01) + 0.5 : 4 + T.h * TILE;
        c.fillStyle = '#ff4d4d';
        c.fillRect(-v.len / 2 - 0.5, P(-HW, zt - 1.5), 3.5, 5 * GZ);
      }
      if (v.blink && Math.sin(time * 12) > 0 && v.pal.lit) {
        const T = VEHICLE_TYPES[v.type], zt = 4 + T.h * TILE;
        c.fillStyle = '#ffae00';
        // the signal on the near (camera) side shows for a turn toward the camera
        const nearSide = (v.heading === 'E' ? v.blink > 0 : v.blink < 0);
        c.fillRect(v.len / 2 - 6, P(nearSide ? -HW : HW - 3, zt - 2), 4, 4 * GZ);
        c.fillRect(-v.len / 2, P(nearSide ? -HW : HW - 3, zt - 2), 4, 4 * GZ);
      }
      c.restore();
      return;
    }
    const key = `ns|${v.type}|${v.len}|${v.base}|${v.heading}|${v.pal.lit}|${v.pal.top}`;
    if (!Sprites.drawKey(c, key, g => bodyNS(g, v))) bodyNS(c, v);
    liveNS(c, v, time);
  }

  // The car's shadow, at the current origin.
  function shadow(c, v, a = 0.9) {
    const [hx, hy] = halfSize(v);
    Draw.shadow(c, 3, 0, hx * 2.3, hy * 2.1, a);
  }

  // Turn a car into a burnt-out wreck.
  function wreck(v) {
    v.wreck = true;
    v.wreckT = 0;
    v.pal = wreckPalette(v.base);
    v.brake = false;
    v.blink = 0;
  }

  // ---- Trains (running along y) -----------------------------------------------
  function trainCarNS(c, car, toward, time) {
    const L = car.len, hw = 0.42 * TILE, z0 = 7, zt = 0.95 * TILE;
    const col = car.color, top = shade(col, 0.12), front = shade(col, -0.22);
    for (const w of [-0.34, -0.2, 0.2, 0.34]) box(c, -hw - 1, hw + 1, w * L - 5, w * L + 5, 0, 10, '#2a2c31', '#1b1d22');
    box(c, -hw, hw, -L / 2, L / 2, z0, zt, top, front);
    if (car.loco) {
      box(c, -hw + 4, hw - 4, toward ? -L / 2 + 4 : L / 2 - 30, toward ? -L / 2 + 30 : L / 2 - 4, zt, zt + 12, shade(col, 0.2), shade(col, -0.1));
      if (toward) {
        c.fillStyle = '#223149';
        c.fillRect(-hw + 6, P(-L / 2 + 4, zt + 10), hw * 2 - 12, 7 * GZ);
        c.fillStyle = '#fff7d1';
        c.fillRect(-4, P(-L / 2, z0 + 14), 8, 5 * GZ);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,240,190,0.35)';
        c.beginPath(); c.arc(0, P(-L / 2, z0 + 12), 22, 0, 6.2832); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.fillStyle = '#ffd23f';
      c.fillRect(-hw, P(-L / 2, z0 + 8), hw * 2, 3 * GZ);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = -L / 2 + 8; y < L / 2 - 4; y += 10) c.fillRect(-hw + 2, P(y, zt), hw * 2 - 4, 1.2);
    }
  }

  return { make, palette, wreckPalette, halfSize, draw, shadow, wreck, trainCarNS, HW };
})();
