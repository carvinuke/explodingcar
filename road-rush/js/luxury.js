'use strict';
// The arcade's luxury cars: supercars and limousines with lookalike names.
// Each one is a side profile (heights along its length, rear to front), a
// glasshouse profile, a side window outline, wheels, and a few hand-drawn
// details (lights, intakes, wings). Lux turns that into the side view (Road
// Rush lanes, Traffic Control east/west) and the end-on views (Boom Run,
// Traffic Control north/south), in the same blocky oblique style as the rest.
//
// Coordinates: u runs along the car from the back (0) to the front (1); z is
// height in world units. A car is LANE_D wide, like every other vehicle.

const Lux = (() => {
  const HW = 0.72 * TILE / 2; // half the car's width (Draw.LANE_D / 2)

  // ---- Smooth profiles -------------------------------------------------------------
  // A smooth line through control points [u, z] (Catmull-Rom), sampled finely.
  function smooth(pts, n = 6) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice(0, 2));
    return out;
  }
  // Height of a sampled line at u (linear between samples).
  function at(line, u) {
    if (u <= line[0][0]) return line[0][1];
    for (let i = 1; i < line.length; i++) {
      if (line[i][0] >= u) {
        const a = line[i - 1], b = line[i], k = (u - a[0]) / ((b[0] - a[0]) || 1);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return line[line.length - 1][1];
  }

  // ---- Little drawing helpers ------------------------------------------------------------
  function path(c, pts) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  }
  const fill = (c, col, pts) => { c.fillStyle = col; path(c, pts); c.fill(); };
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Surfaces lean toward or away from the light (upper left), and get lighter or darker.
  function lean(col, k) { return k >= 0 ? shade(col, Math.min(0.3, k)) : shade(col, Math.max(-0.35, k)); }

  // ---- A model, prepared once ------------------------------------------------------------
  function prep(D) {
    if (D._ready) return D;
    D.body = smooth(D.top, 5);
    D.lo = smooth(D.bottom || [[0, 6], [0.05, 3.2], [0.95, 3.2], [1, 5]], 4);
    // the glasshouse: [u, z, material of the stretch that follows] -> sampled, keeping materials
    D.cab = [];
    const C = D.cabin;
    for (let i = 0; i < C.length - 1; i++) {
      const seg = smooth([C[Math.max(0, i - 1)], C[i], C[i + 1], C[Math.min(C.length - 1, i + 2)]].map(p => p.slice(0, 2)), 4);
      // keep only the samples between C[i] and C[i + 1]
      const s = seg.filter(p => p[0] >= Math.min(C[i][0], C[i + 1][0]) - 1e-6 && p[0] <= Math.max(C[i][0], C[i + 1][0]) + 1e-6);
      const pts = C[i][3] === 'sharp' || C[i + 1][3] === 'sharp' || D.sharp ? [C[i].slice(0, 2), C[i + 1].slice(0, 2)] : s;
      for (let k = 0; k < pts.length - 1; k++) D.cab.push({ a: pts[k], b: pts[k + 1], m: C[i][2] });
    }
    D.cabLine = [D.cab[0].a].concat(D.cab.map(s => s.b));
    D.roofZ = Math.max(...D.cabLine.map(p => p[1]));
    D._ready = true;
    return D;
  }

  // Height on the glasshouse's near side, as a share from the beltline (0) to the roof (1).
  function hOf(D, u, z) {
    const zb = at(D.body, u);
    return clampN((z - zb) / ((D.roofZ - zb) || 1), 0, 1);
  }
  // How far the glasshouse is set in from the body side at a height share h.
  const insetAt = (D, h) => (D.inset || 2) + (D.tumble === undefined ? 4 : D.tumble) * h;

  // ======================================================================================
  // Side view (driving toward +x)
  // ======================================================================================
  function side(c, v) {
    const D = prep(LUX[v.type]), pal = v.pal, L = v.len, bx = -L / 2;
    const X = u => bx + u * L, B = u => at(D.body, u), Lo = u => at(D.lo, u);
    const G = pal.lit ? CarShape.GLASS : CarShape.GLASS_DEAD;
    const near = (u, z) => [X(u), P(-HW, z)];
    const ctx = { c, v, pal, L, D, X, B, Lo, near, G, lit: pal.lit, HW, top: (u, y, z) => [X(u), P(y, z)] };
    const S = D.body;

    const RS = 1.5, RF = 3.4; // how far the rounded shoulders roll down: the near one and the far one
    // softer top: the lit top and the shaded flank closer together than on the toy cars
    const topCol = mix(pal.top, pal.front, 0.22), sideCol = pal.front;
    const two = D.cabPaint ? D.cabPaint(v, pal) : null; // two-tone cars paint the glasshouse in a second colour
    ctx.topCol = topCol;
    // outline: the body and the glasshouse
    c.save();
    c.fillStyle = 'rgba(14,16,20,0.5)'; c.strokeStyle = 'rgba(14,16,20,0.38)';
    c.lineWidth = 1.4; c.lineJoin = 'round';
    path(c, [...S.map(([u, z]) => [X(u), P(HW, z - RF)]), ...D.lo.slice().reverse().map(([u, z]) => [X(u), P(-HW, z)])]);
    c.fill(); c.stroke();
    const cabSil = [...D.cabLine.map(([u, z]) => [X(u), P(HW - insetAt(D, hOf(D, u, z)), z)])];
    path(c, [[X(D.cabLine[0][0]), P(-HW, B(D.cabLine[0][0]))], ...cabSil, [X(D.cabLine[D.cabLine.length - 1][0]), P(-HW, B(D.cabLine[D.cabLine.length - 1][0]))]]);
    c.fill(); c.stroke();
    c.restore();

    // body top: strips along the car, shaded by how they lean, with rounded
    // shoulders (the far one rolls away into shadow, the near one catches the light)
    for (let i = 0; i < S.length - 1; i++) {
      const [ua, za] = S[i], [ub, zb] = S[i + 1];
      const slope = (zb - za) / ((ub - ua) * L || 1);
      const col = lean(topCol, slope * 0.35), xa = X(ua), xb = X(ub) + 0.4;
      // a rounded top: brightest at the near shoulder, falling away to the far edge
      const band = (y0, y1, d0, d1, k) => {
        c.fillStyle = k ? shade(col, k) : col;
        path(c, [[xa, P(y0, za - d0)], [xb, P(y0, zb - d0)], [xb, P(y1, zb - d1)], [xa, P(y1, za - d1)]]); c.fill();
      };
      band(HW, HW - 3.5, RF, 0.9, -0.2);
      band(HW - 3.5, 2, 0.9, 0, -0.07);
      band(2, -HW + 3, 0, 0, 0);
      band(-HW + 3, -HW, 0, RS, pal.lit ? 0.1 : 0);
    }
    if (D.topDetail) D.topDetail(ctx);
    if (pal.lit) { // the shine along the near shoulder
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 0.9;
      c.beginPath(); S.forEach(([u, z], i) => (i ? c.lineTo(X(u), P(-HW + 1.6, z - 0.4)) : c.moveTo(X(u), P(-HW + 1.6, z - 0.4)))); c.stroke();
    }

    // body side: paint that darkens toward the sills
    const zTopMax = Math.max(...S.map(p => p[1]));
    const g = c.createLinearGradient(0, P(-HW, zTopMax), 0, P(-HW, 0));
    g.addColorStop(0, shade(sideCol, pal.lit ? 0.14 : 0)); g.addColorStop(0.6, sideCol); g.addColorStop(1, pal.lower);
    c.fillStyle = g;
    path(c, [...S.map(([u, z]) => near(u, z - RS)), ...D.lo.slice().reverse().map(([u, z]) => near(u, z))]);
    c.fill();
    if (pal.lit) { // a soft reflection line along the flank
      c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1;
      c.beginPath(); S.forEach(([u, z], i) => { const p = near(u, z - 2.2); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke();
    }
    // wheel arches: round cuts in the body side, stopping at its lower edge, so
    // the tyre below the sills stays round (a dark box down to the road made
    // every tyre look flat)
    c.save();
    path(c, [...S.map(([u, z]) => near(u, z - RS)), ...D.lo.slice().reverse().map(([u, z]) => near(u, z))]);
    c.clip();
    c.fillStyle = '#0d0e11';
    for (const w of D.wheels) { const r = D.wr + 1.7; c.beginPath(); c.ellipse(X(w), P(-HW, D.wr), r, r * GZ, 0, 0, 6.2832); c.fill(); }
    c.restore();
    if (D.sideDetail) D.sideDetail(ctx, 'body');

    // the glasshouse: top surfaces...
    for (const s of D.cab) {
      const ha = hOf(D, s.a[0], s.a[1]), hb = hOf(D, s.b[0], s.b[1]);
      const ia = insetAt(D, ha), ib = insetAt(D, hb);
      const slope = (s.b[1] - s.a[1]) / ((s.b[0] - s.a[0]) * L || 1);
      let col;
      if (s.m === 'g') col = slope < -0.25 ? G.front : slope > 0.25 ? G.back : G.roof;
      else if (s.m === 'b') col = pal.lit ? '#17191e' : '#0d0d0e';
      else col = lean(two ? two.top : topCol, slope * 0.3);
      c.fillStyle = col;
      path(c, [[X(s.a[0]), P(HW - ia, s.a[1])], [X(s.b[0]) + 0.3, P(HW - ib, s.b[1])], [X(s.b[0]) + 0.3, P(-HW + ib, s.b[1])], [X(s.a[0]), P(-HW + ia, s.a[1])]]);
      c.fill();
    }
    if (D.louvres) { // slatted engine covers behind the cabin
      const [la, lb] = D.louvres, n = 6;
      c.fillStyle = pal.lit ? 'rgba(10,11,14,0.55)' : 'rgba(0,0,0,0.45)';
      for (let k = 0; k < n; k++) {
        const u = la + (lb - la) * (k + 0.3) / n, z = at(D.cabLine, u), ins = insetAt(D, hOf(D, u, z)) + 2.5;
        c.fillRect(X(u), P(HW - ins, z), Math.max(0.9, (lb - la) * L / n * 0.45), (HW * 2 - ins * 2) * GY);
      }
    }
    if (pal.lit) { // a streak of sky on the glass
      for (const s of D.cab) {
        if (s.m !== 'g' || Math.abs(s.b[1] - s.a[1]) < 0.6) continue;
        const ia = insetAt(D, hOf(D, s.a[0], s.a[1])), ib = insetAt(D, hOf(D, s.b[0], s.b[1]));
        c.fillStyle = 'rgba(215,238,255,0.12)';
        path(c, [[X(s.a[0]), P(HW - ia - 3, s.a[1])], [X(s.b[0]), P(HW - ib - 3, s.b[1])], [X(s.b[0]), P(HW - ib - 6, s.b[1])], [X(s.a[0]), P(HW - ia - 6, s.a[1])]]);
        c.fill();
      }
    }
    // ...and its near side, leaning in, with the side windows set into it
    const cabNear = (u, z) => [X(u), P(-HW + insetAt(D, hOf(D, u, z)), z)];
    const u0 = D.cabLine[0][0], u1 = D.cabLine[D.cabLine.length - 1][0];
    const base = [];
    for (let k = 0; k <= 12; k++) { const u = u0 + (u1 - u0) * k / 12; base.push([X(u), P(-HW + (D.inset || 2), B(u))]); }
    c.fillStyle = two ? two.side : shade(pal.front, pal.lit ? 0.06 : 0);
    path(c, [...base, ...D.cabLine.slice().reverse().map(([u, z]) => cabNear(u, z))]);
    c.fill();
    for (const poly of D.dlo) {
      const pts = poly.map(([u, z]) => cabNear(u, z));
      fill(c, G.side, pts);
      if (pal.lit) {
        c.save(); path(c, pts); c.clip();
        c.fillStyle = 'rgba(200,225,255,0.18)';
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        for (const f of [0.22, 0.62]) { const x = x0 + (x1 - x0) * f; path(c, [[x, y1], [x + 4, y0], [x + 6.5, y0], [x + 2.5, y1]]); c.fill(); }
        c.restore();
        if (D.chromeDlo) { c.strokeStyle = 'rgba(230,234,240,0.85)'; c.lineWidth = 0.9; path(c, pts); c.stroke(); }
      }
    }
    if (pal.lit) { c.fillStyle = 'rgba(255,255,255,0.18)'; const r = D.cabLine; c.beginPath(); r.forEach(([u, z], i) => { const p = cabNear(u, z); i ? c.lineTo(p[0], p[1] - 0.3) : c.moveTo(p[0], p[1] - 0.3); }); c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.9; c.stroke(); }
    if (D.sideDetail) D.sideDetail(ctx, 'top');
  }

  // Wheels, every frame (they turn).
  function wheelsSide(c, v, spin) {
    const D = prep(LUX[v.type]), L = v.len, lit = v.pal.lit;
    for (const w of D.wheels) wheel(c, -L / 2 + w * L, P(-HW - 0.6, D.wr), D.wr, D.rim, lit, spin, D);
  }

  function wheel(c, cx, cy, r, style, lit, spin, D) {
    const ry = r * GZ;
    c.fillStyle = '#141519'; // tyre
    c.beginPath(); c.ellipse(cx, cy, r, ry, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#22242a'; // sidewall shine
    c.beginPath(); c.ellipse(cx, cy, r - 0.8, ry - 0.8, 0, 3.6, 5.6); c.lineTo(cx, cy); c.fill();
    const rr = r * (D.rimK || 0.7), rry = rr * GZ;
    const rim = lit ? (D.rimCol || '#c9ced6') : '#45464a';
    c.fillStyle = lit ? '#2a2c32' : '#1c1c1e'; // the barrel behind the spokes
    c.beginPath(); c.ellipse(cx, cy, rr, rry, 0, 0, 6.2832); c.fill();
    if (D.caliper && lit) { // brake caliper peeking through
      c.fillStyle = D.caliper;
      c.beginPath(); c.ellipse(cx, cy, rr * 0.82, rry * 0.82, 0, -2.3, -0.9); c.lineTo(cx + Math.cos(-0.9) * rr * 0.45, cy + Math.sin(-0.9) * rry * 0.45); c.lineTo(cx + Math.cos(-2.3) * rr * 0.45, cy + Math.sin(-2.3) * rry * 0.45); c.fill();
    }
    c.strokeStyle = rim; c.fillStyle = rim; c.lineCap = 'round';
    const n = style === 'fuchs' || style === 'star' || style === 'g' ? 5 : style === 'y' ? 5 : style === 'disc' ? 0 : 10;
    if (style === 'disc') { // a smooth dish with a polished lip
      c.beginPath(); c.ellipse(cx, cy, rr, rry, 0, 0, 6.2832); c.fill();
      c.fillStyle = lit ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.2)';
      c.beginPath(); c.ellipse(cx, cy, rr * 0.55, rry * 0.55, 0, 0, 6.2832); c.fill();
    } else {
      c.lineWidth = style === 'fuchs' ? 1.7 : style === 'star' || style === 'g' ? 1.6 : 0.9;
      c.beginPath(); // every spoke in one path: one stroke per wheel
      for (let k = 0; k < n; k++) {
        const a = spin + k * 6.2832 / n;
        c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rry);
        if (style === 'y') { // the Y split at the rim
          const b = a + 0.32;
          c.moveTo(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rry * 0.55); c.lineTo(cx + Math.cos(b) * rr, cy + Math.sin(b) * rry);
        }
      }
      c.stroke();
      c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(cx, cy, rr, rry, 0, 0, 6.2832); c.stroke(); // the rim's lip
    }
    c.fillStyle = lit ? (D.capCol || '#e9ecef') : '#3a3a3c';
    c.beginPath(); c.ellipse(cx, cy, 1.2, 1.2 * GZ, 0, 0, 6.2832); c.fill();
  }

  // ======================================================================================
  // End-on: driving away (we see the back) or toward us (we see the front)
  // ======================================================================================
  function ns(c, v) {
    const D = prep(LUX[v.type]), pal = v.pal, L = v.len, toward = v.heading === 'S';
    const Y = u => (toward ? L / 2 - u * L : -L / 2 + u * L), B = u => at(D.body, u), Lo = u => at(D.lo, u);
    const G = pal.lit ? CarShape.GLASS : CarShape.GLASS_DEAD;
    const uN = toward ? 1 : 0, yN = Y(uN);
    const face = (x, z) => [x, P(yN, z)];
    const ctx = { c, v, pal, L, D, Y, B, Lo, face, G, lit: pal.lit, HW, toward, uN, top: (x, u, z) => [x, P(Y(u), z)] };
    const two = D.cabPaint ? D.cabPaint(v, pal) : null;
    const S = D.body;
    const order = S.map((p, i) => i); // far to near
    if (!toward) order.reverse();

    // wheels peeking out at the sides
    for (const w of D.wheels) {
      const y = Y(w), r = D.wr;
      for (const s of [-1, 1]) Draw.box(c, s > 0 ? HW - 2.5 : -HW - 1.5, s > 0 ? HW + 1.5 : -HW + 2.5, y - r * 0.95, y + r * 0.95, 0, r * 1.7, '#24262c', '#121317');
    }
    // outline
    let topY = Infinity;
    for (const [u, z] of S) topY = Math.min(topY, P(Y(u), z));
    for (const [u, z] of D.cabLine) topY = Math.min(topY, P(Y(u), z));
    c.fillStyle = 'rgba(14,16,20,0.55)';
    if (c.roundRect) { c.beginPath(); c.roundRect(-HW - 1.4, topY - 1.4, HW * 2 + 2.8, P(yN, 0) - topY + 1.6, 3); c.fill(); }
    else c.fillRect(-HW - 1.4, topY - 1.4, HW * 2 + 2.8, P(yN, 0) - topY + 1.6);

    // body top, far to near (a stretch that faces away has no height on screen)
    const wAt = u => HW - (D.pinch ? D.pinch(u) : 0); // narrower noses and tails
    for (let k = 0; k < order.length - 1; k++) {
      const i = order[k], j = order[k + 1]; // i far, j nearer
      const [ua, za] = S[i], [ub, zb] = S[j];
      const ya = P(Y(ua), za), yb = P(Y(ub), zb);
      if (yb <= ya + 0.01) continue;
      const k2 = (zb - za) / (Math.abs(Y(ub) - Y(ua)) || 1); // rising toward us = leaning toward us
      c.fillStyle = lean(pal.top, -k2 * 0.25);
      path(c, [[-wAt(ua), ya], [wAt(ua), ya], [wAt(ub), yb + 0.4], [-wAt(ub), yb + 0.4]]);
      c.fill();
    }
    if (pal.lit) { // sheen down the shoulders
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.fillRect(-HW + 2, topY + 2, 2.5, P(yN, B(uN)) - topY - 2);
    }
    if (D.nsDetail) D.nsDetail(ctx, 'deck');

    // the near end: bumper and fascia
    const zt = B(uN), zl = Lo(uN), wn = wAt(uN);
    const g = c.createLinearGradient(0, P(yN, zt), 0, P(yN, zl));
    g.addColorStop(0, shade(pal.front, pal.lit ? 0.08 : 0)); g.addColorStop(1, pal.lower);
    c.fillStyle = g;
    path(c, [[-wn + 1.5, P(yN, zt)], [wn - 1.5, P(yN, zt)], [wn, P(yN, zt - 1.5)], [wn, P(yN, zl)], [-wn, P(yN, zl)], [-wn, P(yN, zt - 1.5)]]);
    c.fill();
    if (D.nsDetail) D.nsDetail(ctx, 'face');

    // the glasshouse: its sides (seen from above as bands), then its top, far to near
    const C = D.cabLine;
    const wC = (u, z) => HW - insetAt(D, hOf(D, u, z));
    const wBase = HW - (D.inset || 2);
    for (const s of [-1, 1]) {
      const pts = [...C.map(([u, z]) => [s * wC(u, z), P(Y(u), z)]), ...C.slice().reverse().map(([u]) => [s * wBase, P(Y(u), B(u))])];
      fill(c, two ? two.side : shade(pal.front, pal.lit ? 0.04 : 0), pts);
      for (const poly of D.dlo) {
        const q = poly.map(([u, z]) => [s * wC(u, z), P(Y(u), z)]);
        fill(c, G.side, q);
      }
    }
    const segs = toward ? D.cab.slice() : D.cab.slice().reverse();
    for (const s of segs) {
      const [fa, fb] = toward ? [s.a, s.b] : [s.b, s.a]; // fa far, fb near
      const ya = P(Y(fa[0]), fa[1]), yb = P(Y(fb[0]), fb[1]);
      if (yb <= ya + 0.01) continue;
      const wa = wC(fa[0], fa[1]), wb = wC(fb[0], fb[1]);
      let col;
      if (s.m === 'g') col = (toward ? s.b[1] < s.a[1] : s.b[1] > s.a[1]) ? (toward ? G.front : G.back) : G.roof;
      else if (s.m === 'b') col = pal.lit ? '#17191e' : '#0d0d0e';
      else col = two ? two.top : pal.top;
      fill(c, col, [[-wa, ya], [wa, ya], [wb, yb + 0.3], [-wb, yb + 0.3]]);
    }
    if (pal.lit) { // sky streak on the near glass
      const s = (toward ? D.cab.slice().reverse() : D.cab).find(q => q.m === 'g' && (toward ? q.b[1] < q.a[1] : q.b[1] > q.a[1]));
      if (s) {
        const y0 = P(Y(s.a[0]), s.a[1]), y1 = P(Y(s.b[0]), s.b[1]);
        const w = wC(s.a[0], s.a[1]);
        c.fillStyle = 'rgba(215,238,255,0.22)';
        path(c, [[-w + 3, Math.max(y0, y1)], [-w + 6.5, Math.max(y0, y1)], [-w + 9, Math.min(y0, y1)], [-w + 5.5, Math.min(y0, y1)]]);
        c.fill();
      }
    }
    if (D.louvres && !toward) { // the slatted engine cover, seen from behind
      const [la, lb] = D.louvres, n = 6;
      c.fillStyle = pal.lit ? 'rgba(10,11,14,0.55)' : 'rgba(0,0,0,0.45)';
      for (let k = 0; k < n; k++) {
        const u = la + (lb - la) * (k + 0.3) / n, z = at(D.cabLine, u), w = wC(u, z) - 2.5;
        c.fillRect(-w, P(Y(u), z), w * 2, 0.9);
      }
    }
    if (D.nsDetail) D.nsDetail(ctx, 'top');
  }

  return { side, ns, wheelsSide, prep, at, smooth, path, fill, lean, HW };
})();

// ---- Shared bits for the models ---------------------------------------------------------
// A round lamp on the near end face.
function luxLamp(c, x, y, r, col, lit, ry) {
  c.fillStyle = lit ? col : '#2a2a2a';
  c.beginPath(); c.ellipse(x, y, r, ry || r, 0, 0, 6.2832); c.fill();
  if (lit) { c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x - r * 0.3, y - (ry || r) * 0.3, r * 0.35, (ry || r) * 0.35, 0, 0, 6.2832); c.fill(); }
}

// A rear wing across the back, side view: a slim plate with a lip, on posts
// (carbon black) or growing out of the engine lid (body colour, rubber edge).
function luxWing(x, ua, ub, z0, z1, carbon) {
  const { c, X, lit, topCol } = x, HW = Lux.HW;
  // from the side a full-width wing would read as a board standing up, so it's
  // drawn as a ridge across the tail: its top just a shade off the deck below,
  // a dark lip along each edge, and an end plate on the near side
  const top = Lux.lean(topCol, carbon ? -0.22 : -0.05);
  Lux.fill(c, top, [[X(ua), P(HW - 2, z1)], [X(ub), P(HW - 2, z1)], [X(ub), P(-HW + 2, z1)], [X(ua), P(-HW + 2, z1)]]);
  c.fillStyle = carbon ? '#16171a' : 'rgba(0,0,0,0.45)';
  c.fillRect(X(ua), P(HW - 2, z1), X(ub) - X(ua), 1); // far lip
  c.fillStyle = '#0f1013';
  c.fillRect(X(ua) - 0.4, P(-HW + 2, z1) - 0.6, X(ub) - X(ua) + 0.8, 1.4); // near lip
  if (lit) { c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(X(ua), P(-HW + 2, z1) - 1.6, X(ub) - X(ua), 0.8); }
  // the end plate (carbon) or the lid swelling up into the tail (whale tail)
  const plate = carbon ? '#16171a' : Lux.lean(topCol, -0.12);
  Lux.fill(c, plate, [[X(ua), P(-HW + 2, z1 + 0.6)], [X(ub) + 0.6, P(-HW + 2, z1 + 0.6)], [X(ub), P(-HW + 2, z0)], [X(ua) + 0.4, P(-HW + 2, z0)]]);
}
// The same wing seen from behind.
function luxWingNS(x, ua, ub, z0, z1, carbon) {
  const { c, Y, lit, pal } = x, HW = Lux.HW;
  const top = carbon ? (lit ? '#2a2c31' : '#151516') : Lux.lean(pal.top, 0.02);
  if (carbon) for (const s of [-1, 1]) Draw.box(c, s * 6 - 0.6, s * 6 + 0.6, Y((ua + ub) / 2) - 0.6, Y((ua + ub) / 2) + 0.6, z0, z1, '#121316', '#0b0b0c');
  Draw.box(c, -HW + 1.5, HW - 1.5, Y(ua), Y(ub), z1 - 1.2, z1, top, carbon ? '#0f1013' : Lux.lean(pal.front, -0.1));
  c.fillStyle = '#0f1013'; c.fillRect(-HW + 1.5, P(Y(ua), z1 - 1.2), HW * 2 - 3, 1);
}

// ---- The models -------------------------------------------------------------------------
const LUX = {
  // A 911 (992-style): the fastback that slopes all the way to the tail, round
  // headlights up on the front wings, louvres on the engine lid, a light bar across the back.
  elfer: {
    top: [[0, 10.6], [0.03, 13.2], [0.12, 14.2], [0.3, 14.8], [0.62, 15], [0.8, 14.2], [0.94, 12.4], [1, 9.4]],
    bottom: [[0, 6.2], [0.04, 3.4], [0.95, 3.4], [1, 5.6]],
    cabin: [[0.1, 14.4, 'p'], [0.24, 17.6, 'p'], [0.31, 19.6, 'g'], [0.44, 22.2, 'p'], [0.52, 22.4, 'p'], [0.56, 21.8, 'g'], [0.66, 15.1, 'p']],
    dlo: [[[0.35, 15.6], [0.39, 19.6], [0.47, 21.2], [0.55, 21], [0.6, 18.4], [0.63, 15.6]]],
    inset: 2.2, tumble: 4.2,
    wheels: [0.22, 0.79], wr: 6.3, rim: 'multi', rimK: 0.74, rimCol: '#d5d9df', caliper: '#e8b400',
    sideDetail(x, phase) {
      const { c, near, lit } = x;
      if (phase === 'body') {
        // door line and handle, side intake ahead of the rear wheel
        c.fillStyle = 'rgba(0,0,0,0.25)';
        let p = near(0.4, 14); c.fillRect(p[0], p[1], 0.8, 7.5 * GZ);
        p = near(0.47, 12.6); c.fillRect(p[0], p[1], 3.2, 1);
        // tail light wrapping round the corner, headlight on the wing
        p = near(0.005, 12.4); c.fillStyle = lit ? '#d1202e' : '#3a2020'; c.fillRect(p[0], p[1], 2.4, 2.2);
        p = near(0.96, 12.2); c.fillStyle = lit ? '#fff3c9' : '#3a3a3a';
        c.beginPath(); c.ellipse(p[0], p[1], 2.4, 1.6, -0.25, 0, 6.2832); c.fill();
        p = near(0.9, 9.6); c.fillStyle = lit ? '#ffae00' : '#3a3020'; c.fillRect(p[0], p[1], 1.6, 1);
      }
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      // engine lid louvres
      c.fillStyle = lit ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.4)';
      for (let k = 0; k < 4; k++) { const u = 0.04 + k * 0.018; c.fillRect(X(u), P(5, B(u)), 0.9, 10 * GY); }
      // the bonnet sits lower between the round wings
      c.fillStyle = 'rgba(0,0,0,0.08)';
      Lux.fill(c, c.fillStyle, [[X(0.68), P(6.5, B(0.68))], [X(0.95), P(6.5, B(0.95))], [X(0.95), P(-6.5, B(0.95))], [X(0.68), P(-6.5, B(0.68))]]);
    },
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN, top, D } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        // the light bar right across, the plate and twin exhausts
        let a = face(-13, zt - 1.2), b = face(13, zt - 3);
        c.fillStyle = lit ? '#c41f2c' : '#3a2020'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        if (lit) { c.fillStyle = '#ff5a5f'; c.fillRect(a[0], a[1] + 0.3, b[0] - a[0], 0.7); }
        a = face(-4, zt - 4.5); c.fillStyle = lit ? '#e9e6d8' : '#333'; c.fillRect(a[0], a[1], 8, 2.6);
        c.fillStyle = '#16171b'; a = face(-12, 6.4); c.fillRect(a[0], a[1], 24, 2.4);
        for (const s of [-1, 1]) { const e = face(s * 7, 4.6); c.fillStyle = lit ? '#a9adb3' : '#333'; c.beginPath(); c.ellipse(e[0], e[1], 1.6, 1.3, 0, 0, 6.2832); c.fill(); c.fillStyle = '#0b0b0c'; c.beginPath(); c.ellipse(e[0], e[1], 0.9, 0.7, 0, 0, 6.2832); c.fill(); }
      }
      if (phase === 'face' && toward) {
        // three dark intakes below the bumper line
        c.fillStyle = '#121317';
        let a = face(-12.5, 7.4); c.fillRect(a[0], a[1], 6, 2.6);
        a = face(6.5, 7.4); c.fillRect(a[0], a[1], 6, 2.6);
        a = face(-4, 6.8); c.fillRect(a[0], a[1], 8, 2);
        c.fillStyle = lit ? '#ffae00' : '#3a3020'; a = face(-12.5, 8.4); c.fillRect(a[0], a[1], 2.5, 0.9); a = face(10, 8.4); c.fillRect(a[0], a[1], 2.5, 0.9);
      }
      if (phase === 'deck' && toward) {
        // the round headlights, up on the wings
        for (const s of [-1, 1]) {
          const p = top(s * 9.5, 0.955, B(0.955));
          luxLamp(c, p[0], p[1], 3.3, '#fff3c9', lit, 2.6);
          if (lit) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(p[0], p[1], 2.2, 1.6, 0, 0, 6.2832); c.stroke(); }
        }
      }
      if (phase === 'deck' && !toward) {
        // engine lid louvres, seen from behind
        c.fillStyle = lit ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.4)';
        for (let k = 0; k < 4; k++) { const u = 0.035 + k * 0.016, p = top(-6, u, B(u)); c.fillRect(p[0], p[1], 12, 0.8); }
      }
    },
  },
  // A 911 Turbo from the eighties: whale-tail wing, chrome-ringed windows,
  // round lights, five-petal wheels.
  elferClassic: {
    top: [[0, 11.4], [0.025, 14], [0.12, 14.6], [0.3, 15.1], [0.62, 15.4], [0.8, 14.7], [0.95, 12.9], [1, 10.2]],
    bottom: [[0, 6.6], [0.035, 3.8], [0.96, 3.8], [1, 6]],
    cabin: [[0.14, 14.7, 'p'], [0.26, 18.4, 'p'], [0.32, 20.2, 'g'], [0.43, 23, 'p'], [0.53, 23.2, 'p'], [0.58, 22.4, 'g'], [0.665, 15.4, 'p']],
    dlo: [[[0.355, 16.2], [0.38, 20.4], [0.47, 22], [0.56, 21.8], [0.6, 18.8], [0.64, 16.2]]],
    chromeDlo: true, inset: 2.2, tumble: 4,
    wheels: [0.215, 0.8], wr: 5.9, rim: 'fuchs', rimK: 0.72, rimCol: '#dfe2e6', capCol: '#1b1c20', caliper: '#c41f2c',
    pinch: u => (u > 0.9 ? (u - 0.9) * 22 : 0),
    sideDetail(x, phase) {
      const { c, near, X, lit } = x;
      if (phase === 'body') {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        let p = near(0.41, 14.4); c.fillRect(p[0], p[1], 0.8, 8 * GZ);
        p = near(0.49, 13); c.fillStyle = lit ? '#dfe2e6' : '#444'; c.fillRect(p[0], p[1], 3, 0.9);
        c.fillStyle = '#16171b'; // black rubber bumpers
        p = near(0, 8.4); c.fillRect(p[0] - 0.5, p[1], X(0.08) - X(0), 2.4);
        p = near(0.93, 8.4); c.fillRect(p[0], p[1], X(1) - X(0.93) + 0.5, 2.4);
        p = near(0.004, 12.6); c.fillStyle = lit ? '#c8202c' : '#3a2020'; c.fillRect(p[0], p[1], 2.2, 2);
        p = near(0.965, 12.2); c.fillStyle = lit ? '#fff3c9' : '#3a3a3a'; c.beginPath(); c.ellipse(p[0], p[1], 2.2, 1.7, 0, 0, 6.2832); c.fill();
      }
      if (phase === 'top') luxWing(x, 0.01, 0.15, 14.2, 16.4, false); // the whale tail
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      c.fillStyle = 'rgba(0,0,0,0.08)';
      Lux.fill(c, c.fillStyle, [[X(0.69), P(6.5, B(0.69))], [X(0.95), P(6.5, B(0.95))], [X(0.95), P(-6.5, B(0.95))], [X(0.69), P(-6.5, B(0.69))]]);
      if (lit) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(X(0.7), P(-7.5, B(0.7)), X(0.94) - X(0.7), 0.8); }
    },
    brakeNS: [[-13, 13, 1.6]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN, top } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        let a = face(-13, zt - 1), b = face(13, zt - 3.4);
        c.fillStyle = lit ? '#b81d29' : '#3a2020'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        c.fillStyle = lit ? '#e8323e' : '#3a2020'; c.fillRect(a[0], a[1], 5, b[1] - a[1]); c.fillRect(b[0] - 5, a[1], 5, b[1] - a[1]);
        c.fillStyle = '#16171b'; a = face(-13.5, 8.6); c.fillRect(a[0], a[1], 27, 2.6); // rubber bumper
        a = face(-4, 7.6); c.fillStyle = lit ? '#e9e6d8' : '#333'; c.fillRect(a[0], a[1], 8, 2.2);
        const e = face(-9, 4.8); c.fillStyle = lit ? '#a9adb3' : '#333'; c.beginPath(); c.ellipse(e[0], e[1], 1.5, 1.2, 0, 0, 6.2832); c.fill();
      }
      if (phase === 'face' && toward) {
        c.fillStyle = '#16171b'; let a = face(-13.5, 8.6); c.fillRect(a[0], a[1], 27, 2.6);
        c.fillStyle = lit ? '#ffae00' : '#3a3020'; a = face(-12, 7.2); c.fillRect(a[0], a[1], 3, 1.2); a = face(9, 7.2); c.fillRect(a[0], a[1], 3, 1.2);
      }
      if (phase === 'deck' && toward) {
        for (const s of [-1, 1]) {
          const p = top(s * 9.5, 0.96, B(0.96));
          c.fillStyle = lit ? '#e6e8eb' : '#333'; c.beginPath(); c.ellipse(p[0], p[1], 3.6, 2.9, 0, 0, 6.2832); c.fill();
          luxLamp(c, p[0], p[1], 2.8, '#fff3c9', lit, 2.2);
        }
      }
      if (phase === 'top' && !toward) luxWingNS(x, 0.01, 0.15, 14.2, 16.8, false); // the whale tail
      if (phase === 'deck' && toward) {} // (the tail is far away: hidden behind the roof)
    },
  },

  // An Aventador-style V12: a razor-flat wedge, Y-shaped lights, huge side
  // intakes, a hexagon exhaust and a wing that stands up at speed.
  toroV12: {
    top: [[0, 11.2], [0.025, 12.8], [0.15, 13.2], [0.35, 13.6], [0.56, 13.1], [0.74, 11.2], [0.9, 8.6], [1, 6.2]],
    bottom: [[0, 5.6], [0.04, 2.8], [0.96, 2.6], [1, 4.2]],
    cabin: [[0.15, 13.3, 'p'], [0.33, 17.4, 'g'], [0.4, 18.8, 'p'], [0.47, 19, 'g'], [0.75, 11.1, 'p']], louvres: [0.17, 0.31],
    dlo: [[[0.39, 14.2], [0.42, 17.8], [0.48, 18.4], [0.6, 15.8], [0.67, 13.4]]],
    inset: 1.8, tumble: 4.6,
    wheels: [0.2, 0.815], wr: 6.8, rim: 'y', rimK: 0.75, rimCol: '#2a2c32', capCol: '#c9ced6', caliper: '#e8b400',
    pinch: u => (u > 0.86 ? (u - 0.86) * 26 : u < 0.03 ? (0.03 - u) * 40 : 0),
    sideDetail(x, phase) {
      const { c, near, X, lit } = x;
      if (phase === 'body') {
        // the big side intake behind the door, and its sharp crease
        Lux.fill(c, '#111215', [near(0.26, 11.8), near(0.37, 12.8), near(0.39, 7.2), near(0.3, 5.6), near(0.24, 7.6)]);
        Lux.fill(c, 'rgba(0,0,0,0.22)', [near(0.4, 12.8), near(0.7, 10.8), near(0.7, 9.8), near(0.42, 11.4)]);
        c.fillStyle = 'rgba(0,0,0,0.28)'; const p = near(0.5, 12.6); c.fillRect(p[0], p[1], 0.8, 7.4 * GZ);
        // Y-shaped lamps front and back
        c.strokeStyle = lit ? '#fff6d8' : '#3a3a3a'; c.lineWidth = 1;
        let q = near(0.955, 8.6); c.beginPath(); c.moveTo(q[0] - 2.6, q[1] - 1.4); c.lineTo(q[0], q[1]); c.lineTo(q[0] + 2.2, q[1] - 1.6); c.moveTo(q[0], q[1]); c.lineTo(q[0] + 0.4, q[1] + 1.8); c.stroke();
        c.strokeStyle = lit ? '#e32533' : '#3a2020';
        q = near(0.03, 11.2); c.beginPath(); c.moveTo(q[0] - 1, q[1] - 1.2); c.lineTo(q[0] + 1.6, q[1]); c.lineTo(q[0] - 1, q[1] + 1.2); c.stroke();
        Lux.fill(c, '#111215', [near(0.0, 5), near(0.07, 4.2), near(0.07, 3), near(0.0, 3.6)]); // diffuser
      }
      if (phase === 'top') luxWing(x, 0.015, 0.1, 12.8, 15, true);
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      // a raised spine down the bonnet, and the hexagon louvres on the engine cover
      c.fillStyle = 'rgba(0,0,0,0.14)';
      Lux.fill(c, c.fillStyle, [[X(0.76), P(4, B(0.76))], [X(0.96), P(2, B(0.96))], [X(0.96), P(-2, B(0.96))], [X(0.76), P(-4, B(0.76))]]);
      if (lit) { c.fillStyle = 'rgba(255,255,255,0.14)'; Lux.fill(c, c.fillStyle, [[X(0.76), P(-4, B(0.76))], [X(0.96), P(-2, B(0.96))], [X(0.96), P(-3, B(0.96))], [X(0.76), P(-5, B(0.76))]]); }
    },
    brakeNS: [[-13, -6, 2.4], [6, 13, 2.4]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        // Y tail lamps, mesh, the hexagon exhaust and the diffuser fins
        c.strokeStyle = lit ? '#e32533' : '#3a2020'; c.lineWidth = 1.3;
        for (const s of [-1, 1]) { const p = face(s * 9.5, zt - 2.6); c.beginPath(); c.moveTo(p[0] - s * 3.4, p[1] - 1.6); c.lineTo(p[0], p[1]); c.lineTo(p[0] + s * 2.6, p[1] - 1.8); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] + 2.2); c.stroke(); }
        let a = face(-6, zt - 1.2), b = face(6, 5.4);
        c.fillStyle = '#16171b'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        const e = face(0, 6.6); c.fillStyle = lit ? '#b8bcc2' : '#333';
        c.beginPath(); for (let k = 0; k < 6; k++) { const ang = k * Math.PI / 3; c.lineTo(e[0] + Math.cos(ang) * 3, e[1] + Math.sin(ang) * 2.4); } c.closePath(); c.fill();
        c.fillStyle = '#0b0b0c'; c.beginPath(); for (let k = 0; k < 6; k++) { const ang = k * Math.PI / 3; c.lineTo(e[0] + Math.cos(ang) * 2, e[1] + Math.sin(ang) * 1.5); } c.closePath(); c.fill();
        c.fillStyle = '#111215'; a = face(-13, 4.2); c.fillRect(a[0], a[1], 26, 1.8);
      }
      if (phase === 'face' && toward) {
        // huge black intakes, Y daytime lamps in sharp headlights, a pointed nose
        c.fillStyle = '#111215';
        for (const s of [-1, 1]) { const p = face(s * 9.6, 4.4); Lux.fill(c, '#111215', [[p[0] - 3.6, p[1]], [p[0] + 3.6, p[1]], [p[0] + s * 2.6, p[1] - 3.2], [p[0] - s * 3.8, p[1] - 2.6]]); }
        const p = face(0, 4); c.fillRect(p[0] - 4, p[1] - 1.6, 8, 1.6);
      }
      if (phase === 'deck' && toward) {
        for (const s of [-1, 1]) {
          const a = x.top(s * 10.5, 0.93, B(0.93)), b = x.top(s * 6, 0.985, B(0.985));
          Lux.fill(c, lit ? '#1d2027' : '#151515', [[a[0] - 3, a[1]], [a[0] + 3, a[1]], [b[0] + 2, b[1]], [b[0] - 2, b[1]]]);
          c.strokeStyle = lit ? '#fff6d8' : '#3a3a3a'; c.lineWidth = 0.9;
          c.beginPath(); c.moveTo(a[0] - s * 2, a[1]); c.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); c.lineTo(b[0] + s * 1.5, b[1]); c.stroke();
        }
      }
      if (phase === 'top' && !toward) luxWingNS(x, 0.015, 0.1, 12.8, 15.4, true);
    },
  },

  // A Huracán-style V10: a smaller, sharper wedge with hexagon details.
  toroFuria: {
    top: [[0, 11.6], [0.025, 13.1], [0.15, 13.4], [0.36, 13.8], [0.6, 13.2], [0.78, 11.4], [0.92, 9], [1, 6.8]],
    bottom: [[0, 5.8], [0.04, 2.9], [0.96, 2.8], [1, 4.4]],
    cabin: [[0.17, 13.5, 'p'], [0.32, 17.2, 'g'], [0.42, 19.4, 'p'], [0.5, 19.6, 'g'], [0.73, 12, 'p']], louvres: [0.19, 0.3],
    dlo: [[[0.36, 14.6], [0.41, 18.4], [0.5, 18.8], [0.6, 16.2], [0.69, 13.8]]],
    inset: 1.8, tumble: 4.4,
    wheels: [0.2, 0.81], wr: 6.4, rim: 'y', rimK: 0.75, rimCol: '#cfd3d9', capCol: '#2a2c32', caliper: '#2bbf4f',
    pinch: u => (u > 0.88 ? (u - 0.88) * 24 : 0),
    sideDetail(x, phase) {
      const { c, near, lit } = x;
      if (phase === 'body') {
        Lux.fill(c, '#111215', [near(0.27, 11.6), near(0.36, 12.4), near(0.37, 8), near(0.3, 6.6)]); // hexagon-ish intake
        Lux.fill(c, 'rgba(0,0,0,0.2)', [near(0.38, 12.6), near(0.72, 10.6), near(0.72, 9.8), near(0.4, 11.6)]);
        c.fillStyle = 'rgba(0,0,0,0.28)'; const p = near(0.49, 12.8); c.fillRect(p[0], p[1], 0.8, 7.4 * GZ);
        c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; let q = near(0.94, 9.8); Lux.fill(c, c.fillStyle, [[q[0] - 3, q[1] - 0.6], [q[0] + 2.4, q[1] + 0.3], [q[0] + 2.4, q[1] + 1.2], [q[0] - 3, q[1] + 0.6]]);
        c.fillStyle = lit ? '#e32533' : '#3a2020'; q = near(0.005, 11.6); c.fillRect(q[0], q[1], 2.2, 1.2);
        Lux.fill(c, '#111215', [near(0.0, 5.2), near(0.08, 4.2), near(0.08, 3), near(0.0, 3.6)]);
      }
    },
    topDetail(x) {
      const { c, X, B } = x;
      c.fillStyle = 'rgba(0,0,0,0.12)';
      Lux.fill(c, c.fillStyle, [[X(0.77), P(5, B(0.77))], [X(0.97), P(3, B(0.97))], [X(0.97), P(-3, B(0.97))], [X(0.77), P(-5, B(0.77))]]);
      c.fillStyle = 'rgba(0,0,0,0.3)'; // ducktail lip
      c.fillRect(X(0), P(Lux.HW - 2, B(0.02)), X(0.03) - X(0), (Lux.HW * 2 - 4) * GY);
    },
    brakeNS: [[-13, -5, 2.2], [5, 13, 2.2]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        c.fillStyle = lit ? '#d81f2c' : '#3a2020';
        for (const s of [-1, 1]) { const p = face(s * 9.4, zt - 1.6); Lux.fill(c, c.fillStyle, [[p[0] - 3.6, p[1]], [p[0] + 3.6, p[1]], [p[0] + 3.6 - s * 1.4, p[1] + 1.6], [p[0] - 3.6, p[1] + 1.6]]); }
        c.fillStyle = '#16171b'; const a = face(-7, zt - 3.4); c.fillRect(a[0], a[1], 14, (zt - 3.4 - 5) * GZ);
        for (const s of [-1, 1]) { const e = face(s * 3.4, 5.6); c.fillStyle = lit ? '#b8bcc2' : '#333'; c.beginPath(); c.ellipse(e[0], e[1], 2, 1.5, 0, 0, 6.2832); c.fill(); c.fillStyle = '#0b0b0c'; c.beginPath(); c.ellipse(e[0], e[1], 1.2, 0.9, 0, 0, 6.2832); c.fill(); }
      }
      if (phase === 'face' && toward) {
        for (const s of [-1, 1]) { const p = face(s * 9.6, 4.4); Lux.fill(c, '#111215', [[p[0] - 3.4, p[1]], [p[0] + 3.4, p[1]], [p[0] + s * 2.2, p[1] - 3], [p[0] - s * 3.4, p[1] - 2.4]]); }
      }
      if (phase === 'deck' && toward) {
        for (const s of [-1, 1]) {
          const a = x.top(s * 10.5, 0.94, B(0.94)), b = x.top(s * 6.5, 0.99, B(0.99));
          Lux.fill(c, lit ? '#1d2027' : '#151515', [[a[0] - 2.6, a[1]], [a[0] + 2.6, a[1]], [b[0] + 2, b[1]], [b[0] - 2, b[1]]]);
          c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; c.fillRect(Math.min(a[0], b[0]) + 1, (a[1] + b[1]) / 2 - 0.4, 3, 0.8);
        }
      }
    },
  },

  // An F8-style mid-engine V8: curvy, with side scoops and twin round lamps a side.
  rossoF8: {
    top: [[0, 11], [0.03, 13.5], [0.14, 14.4], [0.3, 14.2], [0.55, 13.6], [0.74, 12.4], [0.9, 10.4], [1, 7.8]],
    bottom: [[0, 6], [0.04, 3.2], [0.96, 3], [1, 4.8]],
    cabin: [[0.15, 14.3, 'p'], [0.3, 17.6, 'g'], [0.42, 20.2, 'p'], [0.5, 20.4, 'g'], [0.71, 12.8, 'p']], louvres: [0.17, 0.28],
    dlo: [[[0.35, 15.2], [0.39, 18.8], [0.47, 19.8], [0.57, 18.2], [0.66, 14.4]]],
    inset: 2, tumble: 4.4,
    wheels: [0.205, 0.8], wr: 6.4, rim: 'star', rimK: 0.75, rimCol: '#d0d4da', capCol: '#e8b400', caliper: '#f2c200',
    pinch: u => (u > 0.9 ? (u - 0.9) * 20 : 0),
    sideDetail(x, phase) {
      const { c, near, lit } = x;
      if (phase === 'body') {
        // the scoop that sweeps into the rear wing, the door line
        Lux.fill(c, '#111215', [near(0.25, 12.6), near(0.34, 13), near(0.36, 9.2), near(0.31, 7.6), near(0.27, 9.6)]);
        Lux.fill(c, 'rgba(255,255,255,0.12)', [near(0.36, 13.2), near(0.62, 12.4), near(0.62, 11.8), near(0.37, 12.4)]);
        c.fillStyle = 'rgba(0,0,0,0.28)'; let p = near(0.48, 13.2); c.fillRect(p[0], p[1], 0.8, 7.6 * GZ);
        c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; p = near(0.935, 11); Lux.fill(c, c.fillStyle, [[p[0] - 3.4, p[1] - 0.4], [p[0] + 2.6, p[1] + 0.8], [p[0] + 2.6, p[1] + 1.6], [p[0] - 3.4, p[1] + 0.6]]);
        c.fillStyle = lit ? '#e32533' : '#3a2020'; p = near(0.008, 12); c.beginPath(); c.ellipse(p[0] + 1, p[1], 1.3, 1.1, 0, 0, 6.2832); c.fill();
        Lux.fill(c, '#111215', [near(0.0, 5.4), near(0.08, 4.4), near(0.08, 3.2), near(0.0, 3.8)]);
      }
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      // the twin vents on the bonnet and the louvred engine cover
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (const y of [-5, 3]) Lux.fill(c, c.fillStyle, [[X(0.84), P(y + 2, B(0.84))], [X(0.92), P(y + 2, B(0.92))], [X(0.92), P(y, B(0.92))], [X(0.84), P(y, B(0.84))]]);
      if (lit) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(X(0.72), P(-8, B(0.72)), X(0.9) - X(0.72), 0.8); }
    },
    brakeNS: [[-13, -5, 2], [5, 13, 2]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        for (const s of [-1, 1]) for (const k of [0, 1]) { // twin round lamps each side
          const p = face(s * (11 - k * 4.4), zt - 2.2);
          luxLamp(c, p[0], p[1], 1.9, '#e0202d', lit, 1.6);
        }
        c.fillStyle = '#16171b'; let a = face(-12, 6.2); c.fillRect(a[0], a[1], 24, 3);
        for (const s of [-1, 1]) { const e = face(s * 2.4, 7.4); c.fillStyle = lit ? '#b8bcc2' : '#333'; c.beginPath(); c.ellipse(e[0], e[1], 1.7, 1.4, 0, 0, 6.2832); c.fill(); c.fillStyle = '#0b0b0c'; c.beginPath(); c.ellipse(e[0], e[1], 1, 0.8, 0, 0, 6.2832); c.fill(); }
      }
      if (phase === 'face' && toward) {
        c.fillStyle = '#121316'; let a = face(-8, 6.4); c.fillRect(a[0], a[1], 16, 2.6);
        for (const s of [-1, 1]) { a = face(s * 11, 6); c.fillRect(a[0] - 2, a[1], 4, 2.2); }
      }
      if (phase === 'deck' && toward) {
        for (const s of [-1, 1]) {
          const a = x.top(s * 11, 0.92, B(0.92)), b = x.top(s * 7.5, 0.975, B(0.975));
          Lux.fill(c, lit ? '#1d2027' : '#151515', [[a[0] - 2.4, a[1]], [a[0] + 2.4, a[1]], [b[0] + 1.8, b[1]], [b[0] - 1.8, b[1]]]);
          c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; c.fillRect(Math.min(a[0], b[0]) + 0.6, (a[1] + b[1]) / 2 - 0.5, 3.4, 1);
        }
      }
    },
  },

  // An 812-style front-engine V12 GT: a long, long bonnet and a fastback.
  rossoSuperfast: {
    top: [[0, 11.6], [0.03, 14], [0.12, 14.6], [0.3, 14.8], [0.48, 15], [0.7, 14.2], [0.9, 12.4], [1, 9.4]],
    bottom: [[0, 6.2], [0.035, 3.4], [0.96, 3.2], [1, 5.4]],
    cabin: [[0.1, 14.5, 'p'], [0.22, 17.6, 'g'], [0.32, 21, 'p'], [0.41, 21.2, 'g'], [0.54, 14.9, 'p']],
    dlo: [[[0.25, 15.8], [0.29, 19.6], [0.37, 20.6], [0.45, 19.4], [0.51, 15.8]]],
    inset: 2, tumble: 4.4,
    wheels: [0.19, 0.77], wr: 6.4, rim: 'star', rimK: 0.75, rimCol: '#3a3d44', capCol: '#e8b400', caliper: '#f2c200',
    pinch: u => (u > 0.9 ? (u - 0.9) * 20 : 0),
    sideDetail(x, phase) {
      const { c, near, lit } = x;
      if (phase === 'body') {
        Lux.fill(c, '#111215', [near(0.6, 11.6), near(0.64, 12.4), near(0.66, 9), near(0.62, 8)]); // the vent behind the front wheel
        Lux.fill(c, 'rgba(255,255,255,0.12)', [near(0.12, 12.8), near(0.6, 12.8), near(0.6, 12.2), near(0.12, 12.2)]);
        c.fillStyle = 'rgba(0,0,0,0.28)'; let p = near(0.36, 13.6); c.fillRect(p[0], p[1], 0.8, 8 * GZ);
        c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; p = near(0.94, 12.2); Lux.fill(c, c.fillStyle, [[p[0] - 3.6, p[1] - 0.4], [p[0] + 2.6, p[1] + 0.8], [p[0] + 2.6, p[1] + 1.6], [p[0] - 3.6, p[1] + 0.6]]);
        c.fillStyle = lit ? '#e32533' : '#3a2020'; p = near(0.006, 12.4); c.beginPath(); c.ellipse(p[0] + 1, p[1], 1.3, 1.1, 0, 0, 6.2832); c.fill();
      }
    },
    topDetail(x) {
      const { c, X, B } = x;
      c.fillStyle = 'rgba(0,0,0,0.3)'; // bonnet vents
      for (const y of [-6, 3.5]) Lux.fill(c, c.fillStyle, [[X(0.66), P(y + 2.4, B(0.66))], [X(0.78), P(y + 2.4, B(0.78))], [X(0.78), P(y, B(0.78))], [X(0.66), P(y, B(0.66))]]);
    },
    brakeNS: [[-13, -5, 2], [5, 13, 2]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && !toward) {
        for (const s of [-1, 1]) for (const k of [0, 1]) { const p = face(s * (11 - k * 4.4), zt - 2.2); luxLamp(c, p[0], p[1], 1.9, '#e0202d', lit, 1.6); }
        c.fillStyle = '#16171b'; const a = face(-12, 6.2); c.fillRect(a[0], a[1], 24, 3);
        for (const s of [-1, 1]) for (const k of [0, 1]) { const e = face(s * (7 + k * 3.2), 4.8); c.fillStyle = lit ? '#b8bcc2' : '#333'; c.beginPath(); c.ellipse(e[0], e[1], 1.3, 1.1, 0, 0, 6.2832); c.fill(); }
      }
      if (phase === 'face' && toward) {
        c.fillStyle = '#121316'; const a = face(-9, 7); c.fillRect(a[0], a[1], 18, 3.2);
        c.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = -8; k < 9; k += 2) { const q = face(k, 7); c.fillRect(q[0], q[1], 0.6, 3); }
      }
      if (phase === 'deck' && toward) {
        for (const s of [-1, 1]) {
          const a = x.top(s * 11, 0.93, B(0.93)), b = x.top(s * 7.5, 0.98, B(0.98));
          Lux.fill(c, lit ? '#1d2027' : '#151515', [[a[0] - 2.4, a[1]], [a[0] + 2.4, a[1]], [b[0] + 1.8, b[1]], [b[0] - 1.8, b[1]]]);
          c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; c.fillRect(Math.min(a[0], b[0]) + 0.6, (a[1] + b[1]) / 2 - 0.5, 3.4, 1);
        }
      }
    },
  },

  // A Chiron-style hypercar: two-tone with the great C curve on its side,
  // a horseshoe grille, and a light bar right across the back.
  veloce: {
    top: [[0, 12.2], [0.03, 14.4], [0.2, 15.2], [0.45, 15.3], [0.65, 14.8], [0.85, 12.8], [0.97, 10.4], [1, 8.8]],
    bottom: [[0, 6.4], [0.04, 3.2], [0.96, 3], [1, 5]],
    cabin: [[0.19, 15.2, 'p'], [0.33, 18.4, 'g'], [0.42, 20.6, 'p'], [0.52, 20.8, 'g'], [0.69, 14.7, 'p']],
    dlo: [[[0.37, 16], [0.4, 19.4], [0.5, 20], [0.6, 18], [0.66, 15.8]]],
    inset: 2, tumble: 4.4,
    wheels: [0.21, 0.81], wr: 6.6, rim: 'multi', rimK: 0.76, rimCol: '#cfd3d9', capCol: '#1b2a4a', caliper: '#1d3f8a',
    pinch: u => (u > 0.92 ? (u - 0.92) * 20 : 0),
    dark: base => shade(base, -0.62), // the second colour: the base, deep and dark
    cabPaint(v, pal) { const d = pal.lit ? shade(v.base, -0.62) : pal.dark; return { top: shade(d, 0.1), side: d }; },
    sideDetail(x, phase) {
      const { c, near, X, lit, v, pal } = x;
      if (phase === 'body') {
        // the front half in the deep second colour, up to the C
        const dk = lit ? shade(v.base, -0.62) : pal.dark;
        const B = x.B, Lo = x.Lo, pts = [];
        for (let k = 0; k <= 10; k++) { const u = 0.47 + k * 0.053; pts.push(near(Math.min(1, u), B(Math.min(1, u)) - 1.3)); }
        for (let k = 10; k >= 0; k--) { const u = 0.47 + k * 0.053; pts.push(near(Math.min(1, u), Lo(Math.min(1, u)))); }
        Lux.fill(c, dk, pts);
        // the C itself, in polished metal
        c.strokeStyle = lit ? '#e2e5ea' : '#444'; c.lineWidth = 1.5;
        c.beginPath();
        const a = near(0.35, 14.6), m = near(0.3, 9), b = near(0.4, 4.4);
        c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0] - 2, m[1], b[0], b[1]); c.stroke();
        Lux.fill(c, '#0f1013', [near(0.31, 12.8), near(0.345, 13.6), near(0.335, 8), near(0.31, 7.6)]); // the intake inside the C
        c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; let p = near(0.95, 10.6); Lux.fill(c, c.fillStyle, [[p[0] - 3, p[1]], [p[0] + 2.4, p[1] + 0.4], [p[0] + 2.4, p[1] + 1.4], [p[0] - 3, p[1] + 1]]);
        c.fillStyle = lit ? '#e32533' : '#3a2020'; p = near(0.004, 12.4); c.fillRect(p[0], p[1], 2, 1);
      }
    },
    topDetail(x) {
      const { c, X, B, lit, v, pal } = x;
      const dk = lit ? shade(v.base, -0.55) : pal.dark;
      Lux.fill(c, dk, [[X(0.47), P(Lux.HW - 3, B(0.47))], [X(1), P(Lux.HW - 3, B(1))], [X(1), P(-Lux.HW, B(1) - 1.3)], [X(0.47), P(-Lux.HW, B(0.47) - 1.3)]]);
      // the spine running down the middle, nose to tail
      c.fillStyle = lit ? 'rgba(230,234,240,0.55)' : 'rgba(0,0,0,0.3)';
      Lux.fill(c, c.fillStyle, [[X(0.7), P(0.6, B(0.7))], [X(0.99), P(0.6, B(0.99))], [X(0.99), P(-0.6, B(0.99))], [X(0.7), P(-0.6, B(0.7))]]);
    },
    brakeNS: [[-13, 13, 1.4]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN, v, pal } = x;
      const zt = B(uN);
      if (phase === 'deck' && toward) { // the deep front half and the spine
        const dk = lit ? shade(v.base, -0.55) : pal.dark;
        const a = x.top(0, 0.47, B(0.47)), b = x.top(0, 1, B(1));
        Lux.fill(c, dk, [[-Lux.HW + 1, a[1]], [Lux.HW - 1, a[1]], [Lux.HW - 1, b[1]], [-Lux.HW + 1, b[1]]]);
        c.fillStyle = lit ? 'rgba(230,234,240,0.55)' : 'rgba(0,0,0,0.3)'; c.fillRect(-0.6, a[1], 1.2, b[1] - a[1]);
        for (const s of [-1, 1]) for (const k of [0, 1]) { const p = x.top(s * (10.5 - k * 3), 0.975, B(0.975)); luxLamp(c, p[0], p[1], 1.4, '#eef6ff', lit, 1.1); }
      }
      if (phase === 'face' && toward) {
        const dk = lit ? shade(v.base, -0.62) : pal.dark;
        let a = face(-Lux.HW, zt), b = face(Lux.HW, 3); c.fillStyle = dk; c.fillRect(a[0] + 1, a[1], b[0] - a[0] - 2, b[1] - a[1]);
        // the horseshoe grille
        const h = face(0, 6.4);
        c.fillStyle = lit ? '#e2e5ea' : '#444'; c.beginPath(); c.ellipse(h[0], h[1], 4.4, 3.8, 0, Math.PI, 0); c.lineTo(h[0] + 4.4, h[1] + 2.6); c.lineTo(h[0] - 4.4, h[1] + 2.6); c.closePath(); c.fill();
        c.fillStyle = '#121418'; c.beginPath(); c.ellipse(h[0], h[1], 3.3, 2.8, 0, Math.PI, 0); c.lineTo(h[0] + 3.3, h[1] + 2); c.lineTo(h[0] - 3.3, h[1] + 2); c.closePath(); c.fill();
        c.fillStyle = '#121418'; for (const s of [-1, 1]) { a = face(s * 10.5, 6.2); c.fillRect(a[0] - 2.4, a[1], 4.8, 2.6); }
      }
      if (phase === 'face' && !toward) {
        let a = face(-13, zt - 1.4), b = face(13, zt - 2.6);
        c.fillStyle = lit ? '#d81f2c' : '#3a2020'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        c.fillStyle = '#121316'; a = face(-12, 7.6); c.fillRect(a[0], a[1], 24, 3.4);
        c.fillStyle = lit ? '#b8bcc2' : '#333'; a = face(-4.5, 6.8); c.fillRect(a[0], a[1], 9, 2.2);
        c.fillStyle = '#0b0b0c'; for (const k of [-3, -1, 1, 3]) { const e = face(k, 5.8); c.fillRect(e[0] - 0.7, e[1] - 0.6, 1.4, 1.2); }
      }
    },
  },

  // A Phantom-style limousine: long and stately, an upright chrome grille,
  // two-tone paint, coach doors and chrome round the windows.
  regent: {
    top: [[0, 15.2], [0.02, 18.2], [0.15, 18.8], [0.3, 19], [0.65, 19.2], [0.8, 19.1], [0.975, 18.6], [1, 16]],
    bottom: [[0, 7.2], [0.03, 4.4], [0.97, 4.4], [1, 6.8]],
    cabin: [[0.12, 18.9, 'p'], [0.2, 25.8, 'g'], [0.26, 28.6, 'p'], [0.6, 28.8, 'p'], [0.665, 26.4, 'g'], [0.74, 19.2, 'p']],
    dlo: [[[0.205, 20.4], [0.24, 26.2], [0.42, 27.4], [0.42, 20.4]], [[0.44, 20.4], [0.44, 27.4], [0.62, 27.2], [0.69, 20.4]]],
    chromeDlo: true, inset: 2, tumble: 3.6, sharp: false,
    wheels: [0.18, 0.835], wr: 6.6, rim: 'disc', rimK: 0.74, rimCol: '#d7dbe0', capCol: '#1b1c20',
    cabPaint(v, pal) {
      if (!pal.lit) return null;
      const light = parseInt(v.base.slice(1, 3), 16) > 140; // a dark top over a light body, or silver over dark
      const col = light ? '#2a2e36' : '#c7cbd2';
      return { top: shade(col, 0.08), side: col };
    },
    sideDetail(x, phase) {
      const { c, near, lit, X, v } = x;
      if (phase === 'body') {
        c.strokeStyle = lit ? 'rgba(235,238,242,0.9)' : '#444'; c.lineWidth = 0.8; // the chrome coachline
        c.beginPath(); for (let k = 0; k <= 20; k++) { const u = 0.03 + k * 0.047, p = near(Math.min(0.98, u), x.B(Math.min(0.98, u)) - 2.6); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.3)'; // coach doors: hinged at the front and the back, meeting in the middle
        for (const u of [0.43, 0.2, 0.69]) { const p = near(u, 18.4); c.fillRect(p[0], p[1], 0.8, 12 * GZ); }
        c.fillStyle = lit ? '#e6e8eb' : '#444'; // handles meet in the middle
        for (const u of [0.405, 0.455]) { const p = near(u, 16.2); c.fillRect(p[0], p[1], 2.2, 0.9); }
        c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; let p = near(0.96, 15.4); c.fillRect(p[0], p[1], 3.4, 1.8);
        c.fillStyle = lit ? '#cf2a32' : '#3a2020'; p = near(0, 16.2); c.fillRect(p[0], p[1], 1.8, 3.6);
        c.fillStyle = lit ? '#cfd3d9' : '#333'; p = near(0.99, 13); c.fillRect(p[0] - 1, p[1], 1.6, 4.2); // grille edge
      }
      if (phase === 'top') { // the little silver figure on the bonnet
        const p = [X(0.975), P(0, x.B(0.975))];
        c.fillStyle = lit ? '#e6e8eb' : '#444';
        c.fillRect(p[0] - 0.4, p[1] - 3.4, 0.9, 3.4);
        Lux.fill(c, c.fillStyle, [[p[0] + 0.4, p[1] - 3.4], [p[0] - 1.8, p[1] - 4.4], [p[0] - 1.6, p[1] - 2.6]]);
      }
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      if (lit) { c.fillStyle = 'rgba(230,234,240,0.5)'; c.fillRect(X(0.76), P(0.6, B(0.8)), X(0.985) - X(0.76), 1.2 * GY); } // polished bonnet strip
    },
    brakeNS: [[-13, -10, 3], [10, 13, 3]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && toward) {
        // the tall chrome grille, slim lamps either side, a deep bumper
        let a = face(-5, zt + 1.4), b = face(5, 8);
        c.fillStyle = lit ? '#e6e8eb' : '#444'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        c.fillStyle = lit ? '#9ea4ad' : '#2a2a2a'; for (let k = -4; k <= 4; k += 1.3) { const q = face(k, zt); c.fillRect(q[0], q[1], 0.6, b[1] - q[1] - 0.6); }
        for (const s of [-1, 1]) { a = face(s * 10.5, zt - 1.6); c.fillStyle = lit ? '#fff6d8' : '#3a3a3a'; c.fillRect(a[0] - 3.4, a[1], 6.8, 1.8); }
        c.fillStyle = lit ? '#cfd3d9' : '#333'; a = face(-13, 7.2); c.fillRect(a[0], a[1], 26, 0.8);
      }
      if (phase === 'top' && toward) { // the figure on the bonnet, in front of the grille
        const p = x.top(0, 0.985, B(0.985));
        c.fillStyle = lit ? '#e6e8eb' : '#444'; c.fillRect(p[0] - 0.5, p[1] - 3.6, 1, 3.6);
        Lux.fill(c, c.fillStyle, [[p[0], p[1] - 3.6], [p[0] - 1.6, p[1] - 4.6], [p[0] + 1.6, p[1] - 4.6]]);
      }
      if (phase === 'face' && !toward) {
        for (const s of [-1, 1]) { const a = face(s * 11.5, zt - 1); c.fillStyle = lit ? '#cf2a32' : '#3a2020'; c.fillRect(a[0] - 1.6, a[1], 3.2, 5.4); }
        c.fillStyle = lit ? '#cfd3d9' : '#333'; let a = face(-8, zt - 3.4); c.fillRect(a[0], a[1], 16, 0.8);
        a = face(-4, zt - 5.2); c.fillStyle = lit ? '#e9e6d8' : '#333'; c.fillRect(a[0], a[1], 8, 2.4);
        for (const s of [-1, 1]) { const e = face(s * 9, 6); c.fillStyle = lit ? '#cfd3d9' : '#333'; c.fillRect(e[0] - 2, e[1], 4, 1.2); }
      }
    },
  },

  // A G-Wagon-style off-roader: a brick on big wheels. Round lamps, wing-top
  // indicators, a spare wheel on the back door.
  gelande: {
    top: [[0, 19.4], [0.012, 21], [0.2, 21.2], [0.6, 21.4], [0.75, 21.2], [0.985, 20.8], [1, 19]],
    bottom: [[0, 8.4], [0.02, 6.4], [0.98, 6.4], [1, 8.4]],
    cabin: [[0.015, 21, 'g'], [0.035, 33.4, 'p'], [0.66, 33.6, 'g'], [0.705, 21.3, 'p']],
    dlo: [[[0.05, 22.6], [0.05, 31.8], [0.235, 32], [0.235, 22.6]], [[0.255, 22.6], [0.255, 32], [0.445, 32], [0.445, 22.6]], [[0.465, 22.6], [0.465, 32], [0.64, 32.2], [0.685, 22.6]]],
    inset: 1.4, tumble: 1.2, sharp: true,
    wheels: [0.19, 0.81], wr: 7.4, rim: 'g', rimK: 0.66, rimCol: '#2f3238', capCol: '#c9ced6', caliper: null,
    sideDetail(x, phase) {
      const { c, near, X, lit } = x;
      if (phase === 'body') {
        // running board, door seams and handles, the side strip
        c.fillStyle = '#16171b'; let p = near(0.25, 7.4); c.fillRect(p[0], p[1], X(0.75) - X(0.25), 1.6);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        for (const u of [0.245, 0.455, 0.705]) { p = near(u, 21); c.fillRect(p[0], p[1], 0.8, 13 * GZ); }
        c.fillStyle = lit ? '#cfd3d9' : '#333'; for (const u of [0.42, 0.66]) { p = near(u, 17.6); c.fillRect(p[0], p[1], 2.4, 0.9); }
        c.fillStyle = 'rgba(0,0,0,0.35)'; p = near(0.02, 13.4); c.fillRect(p[0], p[1], X(0.98) - X(0.02), 1.4);
        // the spare wheel on the back door, standing proud
        const sp = [X(0) - 2.6, P(-Lux.HW + 6, 15)];
        c.fillStyle = '#141519'; c.fillRect(sp[0], sp[1] - 6.8, 2.8, 13.6);
        c.fillStyle = lit ? '#2a2c32' : '#1c1c1e'; c.fillRect(sp[0] - 0.4, sp[1] - 4.6, 1, 9.2);
        c.fillStyle = lit ? '#fff3c9' : '#3a3a3a'; p = near(0.985, 17.4); c.fillRect(p[0] - 1, p[1], 2, 3);
        c.fillStyle = lit ? '#cf2a32' : '#3a2020'; p = near(0, 15); c.fillRect(p[0], p[1], 1.6, 3.4);
      }
    },
    topDetail(x) {
      const { c, X, B, lit } = x;
      // indicators on top of the front wings
      c.fillStyle = lit ? '#ffae00' : '#3a3020';
      for (const y of [-11, 9]) Draw.box(c, X(0.94), X(0.975), y, y + 2, B(0.95), B(0.95) + 1.6, lit ? '#ffc04d' : '#3a3020', lit ? '#d98a00' : '#2a2010');
      c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(X(0.72), P(9, B(0.8)), X(0.98) - X(0.72), 18 * GY);
    },
    brakeNS: [[-13, -10, 5], [10, 13, 5]],
    nsDetail(x, phase) {
      const { c, face, toward, lit, B, uN } = x;
      const zt = B(uN);
      if (phase === 'face' && toward) {
        for (const s of [-1, 1]) { const p = face(s * 9.6, zt - 4.6); c.fillStyle = lit ? '#d6d9dd' : '#333'; c.beginPath(); c.ellipse(p[0], p[1], 3.4, 3.1, 0, 0, 6.2832); c.fill(); luxLamp(c, p[0], p[1], 2.6, '#fff3c9', lit, 2.4); }
        let a = face(-5.4, zt - 1.4), b = face(5.4, zt - 8.4);
        c.fillStyle = '#16171b'; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        c.fillStyle = lit ? '#cfd3d9' : '#333'; for (const k of [0, 1, 2]) { const q = face(-5, zt - 2.6 - k * 2.2); c.fillRect(q[0], q[1], 10, 0.8); }
        c.fillStyle = '#16171b'; a = face(-Lux.HW, 9.6); c.fillRect(a[0], a[1], Lux.HW * 2, 3);
      }
      if (phase === 'face' && !toward) {
        // the spare wheel cover, the slim lamps low on the corners
        const p = face(0, zt - 6.6);
        c.fillStyle = '#141519'; c.beginPath(); c.ellipse(p[0], p[1], 6.6, 6.2, 0, 0, 6.2832); c.fill();
        c.fillStyle = lit ? '#2f3238' : '#1c1c1e'; c.beginPath(); c.ellipse(p[0], p[1], 5.2, 4.9, 0, 0, 6.2832); c.fill();
        c.strokeStyle = lit ? '#cfd3d9' : '#333'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(p[0], p[1], 3.2, 3, 0, 0, 6.2832); c.stroke();
        for (const s of [-1, 1]) { const a = face(s * 12, zt - 9); c.fillStyle = lit ? '#cf2a32' : '#3a2020'; c.fillRect(a[0] - 1.4, a[1], 2.8, 4.6); }
        c.fillStyle = '#16171b'; const a = face(-Lux.HW, 9.6); c.fillRect(a[0], a[1], Lux.HW * 2, 3);
      }
    },
  },
};

// Register them as vehicle types (Road Rush's table), so every game can use them.
// name: how Road Rush says it ('a ...'); len: in tiles; h and cab: rough body and
// cabin heights for the bits of the games that only need a ballpark (frost, markers).
const LUX_TYPES = {
  elfer:          { name: 'an Elfer', len: 1.5, h: 0.28, cab: [0.1, 0.66, 0.2], speed: 1.32,
                    colors: ['#d1202e', '#c9ccd1', '#f2d13a', '#1f6fd1', '#1c1d21', '#e9e6dd'] },
  elferClassic:   { name: 'an Elfer Classic', len: 1.44, h: 0.28, cab: [0.14, 0.66, 0.2], speed: 1.24,
                    colors: ['#c8102e', '#f2efe6', '#111114', '#e3b505', '#6b7a3c', '#8fb6dc'] },
  toroV12:        { name: 'a Toro V12', len: 1.62, h: 0.25, cab: [0.15, 0.75, 0.15], speed: 1.42,
                    colors: ['#9bd427', '#ff7a1a', '#ffcc12', '#7a3bd1', '#f2f2ee', '#18191d'] },
  toroFuria:      { name: 'a Toro Furia', len: 1.52, h: 0.25, cab: [0.17, 0.73, 0.16], speed: 1.38,
                    colors: ['#7fd33a', '#ff8a00', '#2d5bd7', '#8a8f97', '#ffd400', '#d4142d'] },
  rossoF8:        { name: 'a Rosso F8', len: 1.56, h: 0.26, cab: [0.15, 0.71, 0.16], speed: 1.36,
                    colors: ['#d40000', '#f7d117', '#141416', '#f4f4f0', '#1d3f8a', '#b8bcc2'] },
  rossoSuperfast: { name: 'a Rosso Superfast', len: 1.7, h: 0.27, cab: [0.1, 0.54, 0.17], speed: 1.38,
                    colors: ['#c8101e', '#30343b', '#f7d117', '#f2efe9', '#0d2a5c'] },
  veloce:         { name: 'a Veloce', len: 1.62, h: 0.28, cab: [0.19, 0.69, 0.14], speed: 1.48,
                    colors: ['#2a62c9', '#c41e3a', '#e8b400', '#8a8f97', '#f2f2ee'] },
  regent:         { name: 'a Regent', len: 2, h: 0.38, cab: [0.12, 0.74, 0.25], speed: 1.04,
                    colors: ['#111216', '#e9e9ea', '#4a0f1d', '#2c3a4e', '#b9bdc4'] },
  gelande:        { name: 'a Gelände', len: 1.55, h: 0.43, cab: [0.02, 0.7, 0.31], speed: 1.08,
                    colors: ['#141518', '#f1f1ee', '#5b6650', '#8a8f97', '#b5a37a'] },
};
for (const k in LUX_TYPES) LUX_TYPES[k].wheels = []; // Lux draws their wheels
for (const k in LUX_TYPES) VEHICLE_TYPES[k] = Object.assign({ lux: true }, LUX_TYPES[k]);

// Road Rush: how often each luxury car turns up in a lane. Rare at first, more as
// it gets harder; most at home in the city and by the beach. The off-roader
// likes the rough places the supercars avoid.
function luxWeights(d, zone) {
  if (d <= 0.1) return [];
  const base = 0.03 + d * 0.08;
  const mul = { city: 2.2, beach: 1.8, desert: 0.9, autumn: 0.6, snow: 0.3, farm: 0.3, harbor: 0.4, swamp: 0.25 }[zone] || 1;
  const rough = zone === 'snow' || zone === 'farm' || zone === 'desert' || zone === 'swamp';
  return Object.keys(LUX_TYPES).map(k => [k, base * mul * (k === 'gelande' && rough ? 6 : 1)]);
}

// Traffic Control and Boom Run: a luxury mix to add to a traffic mix.
function luxMix(each) { return Object.keys(LUX_TYPES).map(k => [k, each]); }
