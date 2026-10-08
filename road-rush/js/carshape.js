'use strict';
// Sloped car shapes for the blocky oblique style.
// Draw.box can only make boxes, which turns every cabin into a pale slab with
// the windows painted on. These draw a car's glasshouse (and, for the fancier
// cars, the whole body) from a side profile: a list of heights along its length.
// Sloped parts (windscreens, rear windows, hoods) become real slanted surfaces,
// shaded by which way they face, with the side glass set into the pillars.
//
// Two views, matching the rest of the arcade:
//   side: the car runs along x (Road Rush lanes, Traffic Control east/west);
//         we see its near side (y = -half width) and everything on top.
//   ns:   the car runs along y (Boom Run, Traffic Control north/south);
//         we see its near end (front or back) and everything on top.

const CarShape = (() => {
  // Screen y of a world point on the car (x is screen x as is).
  const sy = (y, z) => P(y, z);

  function quad(c, a, b, d, e) {
    c.beginPath();
    c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]);
    c.closePath();
    c.fill();
  }
  function poly(c, pts) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  }

  // Glass colours: a windscreen faces forward (away from the light, which comes
  // from the upper left), a rear window faces back toward it.
  const GLASS = { side: '#26374f', front: '#2b4161', back: '#3d5b80', roof: '#22324a', dark: '#141a24' };
  const GLASS_DEAD = { side: '#111113', front: '#1a1a1d', back: '#202024', roof: '#18181b', dark: '#0d0d0e' };

  // ---- Side view: a cabin on a flat body ---------------------------------------
  // The cabin is a tapered block: its base sits on the body at the beltline, and
  // the roof is narrower (real cars lean their side glass in), so from this angle
  // the side windows lean back and read tall, and the roof stays a modest strip.
  // o: { xr0, xr1, xf1, xf0 (rear base, roof rear, roof front, front base),
  //      zb (beltline), zr (roof), hy (body half width), inset (base inset), tumble
  //      (how much narrower the roof is on each side), pillarA, pillarC,
  //      bPillar (x of the B-pillar, or null), glassRoof, paintBack }
  function cabinSide(c, pal, o) {
    const { xr0, xr1, xf1, xf0, zb, zr, hy } = o;
    const tb = o.tumble === undefined ? 4 : o.tumble;
    const yN0 = -hy + o.inset, yF0 = hy - o.inset, yN1 = yN0 + tb, yF1 = yF0 - tb;
    const G = pal.lit ? GLASS : GLASS_DEAD;
    const S = (x, y, z) => [x, sy(y, z)];
    // a crisp dark outline around the whole glasshouse
    c.fillStyle = 'rgba(14,16,20,0.55)';
    poly(c, [[xr0 - 1.2, sy(yN0, zb) + 0.6], [xr0 - 1.2, sy(yF0, zb)], [xr1 - 0.8, sy(yF1, zr) - 1.2], [xf1 + 0.8, sy(yF1, zr) - 1.2], [xf0 + 1.2, sy(yF0, zb)], [xf0 + 1.2, sy(yN0, zb) + 0.6]]);
    c.fill();

    // rear window and windscreen: the slanted ends, from the roof down to the body
    c.fillStyle = o.paintBack ? pal.top : G.back;
    quad(c, S(xr1, yN1, zr), S(xr1, yF1, zr), S(xr0, yF0, zb), S(xr0, yN0, zb));
    c.fillStyle = G.front;
    quad(c, S(xf1, yN1, zr), S(xf1, yF1, zr), S(xf0, yF0, zb), S(xf0, yN0, zb));
    // the roof, in the body colour
    c.fillStyle = o.glassRoof ? G.roof : pal.top;
    quad(c, S(xr1, yF1, zr), S(xf1, yF1, zr), S(xf1, yN1, zr), S(xr1, yN1, zr));
    if (pal.lit) {
      if (!o.glassRoof) { // a soft sheen along the roof
        c.fillStyle = 'rgba(255,255,255,0.1)';
        c.fillRect(xr1 + 1.5, sy(yF1 - 2, zr), xf1 - xr1 - 3, 2.4 * GY);
      }
      // a streak of sky across the windscreen and the rear window
      c.fillStyle = 'rgba(215,238,255,0.3)';
      const m = 0.42, xw = xf1 + (xf0 - xf1) * m, zw = zr + (zb - zr) * m, xw2 = xf1 + (xf0 - xf1) * (m + 0.18), zw2 = zr + (zb - zr) * (m + 0.18);
      quad(c, S(xw, yF1 - 1, zw), S(xw2, yF1 - 1, zw2), S(xw2, yN1 + 1, zw2), S(xw, yN1 + 1, zw));
      if (!o.paintBack) {
        c.fillStyle = 'rgba(255,255,255,0.16)';
        const xb2 = xr1 + (xr0 - xr1) * 0.5, zb2 = zr + (zb - zr) * 0.5;
        quad(c, S(xb2, yF1 - 1, zb2), S(xb2 + 1.6, yF1 - 1, zb2), S(xb2 + 1.6, yN1 + 1, zb2), S(xb2, yN1 + 1, zb2));
      }
    }

    // the near side, leaning in toward the roof: painted pillars around big side windows
    c.fillStyle = pal.front;
    quad(c, S(xr0, yN0, zb), S(xr1, yN1, zr), S(xf1, yN1, zr), S(xf0, yN0, zb));
    if (pal.lit) { c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(xr1, sy(yN1, zr) - 0.6, xf1 - xr1, 1.1); } // lit roof edge
    // a point on the near side: h runs from the beltline (0) up to the roof (1)
    const at = (x, h) => S(x, yN0 + (yN1 - yN0) * h, zb + (zr - zb) * h);
    const rearX = h => xr0 + (xr1 - xr0) * h + o.pillarC, frontX = h => xf0 + (xf1 - xf0) * h - o.pillarA;
    const h0 = 0.07, h1 = 0.9;
    if (frontX(h1) - rearX(h1) > 2) {
      const win = [at(rearX(h0), h0), at(rearX(h1), h1), at(frontX(h1), h1), at(frontX(h0), h0)];
      c.fillStyle = G.side;
      poly(c, win); c.fill();
      if (pal.lit) { // a pale diagonal reflection in each pane
        c.save(); poly(c, win); c.clip();
        c.fillStyle = 'rgba(200,225,255,0.2)';
        for (const f of [0.18, 0.6]) {
          const x = rearX(h0) + (frontX(h0) - rearX(h0)) * f, a = at(x, h0), b = at(x + 3.5, h1);
          quad(c, a, b, [b[0] + 2.8, b[1]], [a[0] + 2.8, a[1]]);
        }
        c.restore();
      }
      if (o.bPillar !== null && o.bPillar !== undefined) {
        const bp = o.bPillar, a = at(bp - 0.8, 0), b = at(bp - 0.8 + (xr1 - xr0) * 0.15, 1);
        c.fillStyle = pal.lit ? '#121419' : '#0c0c0d';
        quad(c, a, b, [b[0] + 1.6, b[1]], [a[0] + 1.6, a[1]]);
      }
    }
  }

  // ---- Driving away from / toward the camera: a cabin on a flat body ---------------
  // o: { ya, yb (world y of the cabin's base, near and far end), yRa, yRb (roof),
  //      zb, zr, wb (half width at the base), wr (half width at the roof),
  //      nearIsBack (true when we see the car's back) }
  function cabinNS(c, pal, o) {
    const G = pal.lit ? GLASS : GLASS_DEAD;
    const { ya, yb, yRa, yRb, zb, zr, wb, wr } = o;
    // outline
    c.fillStyle = 'rgba(14,16,20,0.5)';
    poly(c, [[-wb - 1.2, sy(ya, zb) + 0.6], [-wb - 1.2, sy(yb, zb)], [-wr - 1, sy(yRb, zr) - 1.2], [wr + 1, sy(yRb, zr) - 1.2], [wb + 1.2, sy(yb, zb)], [wb + 1.2, sy(ya, zb) + 0.6]]);
    c.fill();
    // the side windows, seen from above as dark bands along the roof edges
    for (const s of [-1, 1]) {
      c.fillStyle = G.side;
      poly(c, [[s * wb, sy(ya, zb)], [s * wb, sy(yb, zb)], [s * wr, sy(yRb, zr)], [s * wr, sy(yRa, zr)]]);
      c.fill();
      if (pal.lit) { // B-pillar and the top of the door
        const ym = (ya + yb) / 2, yr = (yRa + yRb) / 2;
        c.fillStyle = pal.front;
        quad(c, [s * wb, sy(ym - 1, zb)], [s * wb, sy(ym + 1, zb)], [s * wr, sy(yr + 1, zr)], [s * wr, sy(yr - 1, zr)]);
      }
    }
    // far to near: far glass, roof, near glass (a surface facing away has no height on screen: skip it)
    const strip = (y1, z1, w1, y2, z2, w2, col) => {
      if (sy(y1, z1) <= sy(y2, z2) + 0.01) return false; // facing away from us
      c.fillStyle = col;
      quad(c, [-w2, sy(y2, z2)], [w2, sy(y2, z2)], [w1, sy(y1, z1)], [-w1, sy(y1, z1)]);
      return true;
    };
    const farGlass = o.nearIsBack ? G.front : G.back, nearGlass = o.nearIsBack ? G.back : G.front;
    strip(yRb, zr, wr, yb, zb, wb, farGlass);
    strip(yRa, zr, wr, yRb, zr, wr, o.glassRoof ? G.roof : pal.top);
    if (pal.lit && !o.glassRoof) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(-wr + 2, sy(yRb, zr), 3, (yRb - yRa) * GY); }
    const drew = strip(ya, zb, wb, yRa, zr, wr, o.paintNear ? pal.front : nearGlass);
    if (drew && pal.lit && !o.paintNear) { // a streak of sky across the near glass
      c.fillStyle = 'rgba(210,235,255,0.25)';
      const y0 = sy(ya, zb), y1 = sy(yRa, zr);
      quad(c, [-wb + 3, y0], [-wb + 7, y0], [-wr + 9, y1], [-wr + 5, y1]);
    }
  }

  // How raked each cabin is: the share of the cabin's length taken by the rear
  // window slope and by the windscreen slope, the C- and A-pillar widths, and
  // whether there's a B-pillar (two rows of doors).
  const RAKE = {
    small:    { rear: 0.14, front: 0.32, pc: 2.2, pa: 0.9, b: true },   // a hatchback: steep tail
    sedan:    { rear: 0.24, front: 0.3, pc: 2.4, pa: 0.9, b: true },
    taxi:     { rear: 0.24, front: 0.3, pc: 2.4, pa: 0.9, b: true },
    police:   { rear: 0.24, front: 0.3, pc: 2.4, pa: 0.9, b: true },
    sports:   { rear: 0.38, front: 0.38, pc: 2, pa: 0.8, b: false }, // a low fastback
    pickup:   { rear: 0.05, front: 0.28, pc: 1.4, pa: 0.9, b: false },
    tractor:  { rear: 0.04, front: 0.08, pc: 1.2, pa: 1.2, b: false },
    logtruck: { rear: 0.04, front: 0.14, pc: 1.2, pa: 1, b: false },
    forklift: { rear: 0.05, front: 0.05, pc: 1.2, pa: 1.2, b: false },
  };
  // Where the cabin's base and roof start and end along the car, from the back (0) to the front (1).
  function cabinU(type) {
    const T = VEHICLE_TYPES[type], cab = T.cab, R = RAKE[type] || RAKE.sedan, du = cab[1] - cab[0];
    return { u0: cab[0], ur: cab[0] + R.rear * du, uf: cab[1] - R.front * du, u1: cab[1], h: cab[2] * TILE, R };
  }

  return { cabinSide, cabinNS, cabinU, RAKE, quad, poly, GLASS, GLASS_DEAD };
})();
