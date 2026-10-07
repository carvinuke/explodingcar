'use strict';
// The Solarian Arcade menu art: four floating-island dioramas, drawn with Road
// Rush's own drawing code. To redraw them, open road-rush/index.html, load
// shared/cars.js and this file, then call makeDioramas('base') and
// makeDioramas('props') and lay each props picture over its base (800x1000,
// transparent). The results are shared/art/*-island.webp.
window.makeDioramas = function (LAYER) {
  const BASE = LAYER === 'base';
  Settings.noCache = true;
  const W = 800, H = 1000;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return [cv, cv.getContext('2d')]; };
  const B = (c, ...a) => Draw.box(c, ...a);
  const at = (c, x, y, fn) => { c.save(); c.translate(x, P(y, 0)); fn(); c.restore(); };
  const glow = (c, x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const tree = (pal, size = 15, tiers = 2, pine = false) => ({ size, tiers, pine, pal: { top: pal[0], front: pal[1], top2: pal[2], front2: pal[3] } });
  const TOWN_TREE = ['#56a846', '#3f8a37', '#6cc255', '#50a043'];

  // A floating island: the slab, a grassy lip, dirt bands, and stepped rock underneath.
  function island(c, x0, x1, y0, y1, depth, top, lip, earth = ['#7a5a40', '#5e4430', '#4a3628', '#3a2b20']) {
    // hanging rock: clusters of blocks under the slab, longest in the middle
    const n = 9, span = x1 - x0;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, mid = 1 - Math.abs(u - 0.5) * 2;
      const w = span / n * (0.9 + ((k * 7) % 3) * 0.25);
      const x = Math.max(x0 + 3, Math.min(x1 - 3 - w, x0 + u * span - w / 2)); // stay under the island
      const hang = 10 + mid * mid * 70 + ((k * 13) % 4) * 6;
      const back = 4 + ((k * 5) % 3) * 6;
      B(c, x, x + w, y0 + back, y1 - 30, -depth - hang, -depth, shade(earth[2], 0.08), earth[2]);
      B(c, x + w * 0.2, x + w * 0.8, y0 + back + 6, y1 - 50, -depth - hang - 12 - mid * 22, -depth - hang + 1, shade(earth[3], 0.08), earth[3]);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, P(y0 + back, -depth - hang + 3), w, 3 * GZ);
    }
    B(c, x0, x1, y0, y1, -depth, 0, top, earth[0]);
    // grass lip and dirt bands on the front face
    c.fillStyle = lip; c.fillRect(x0, P(y0, 0), x1 - x0, 8 * GZ);
    c.fillStyle = shade(lip, -0.25); c.fillRect(x0, P(y0, -8), x1 - x0, 2.5 * GZ);
    c.fillStyle = earth[1]; c.fillRect(x0, P(y0, -24), x1 - x0, (depth - 24) * GZ);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x0, P(y0, -24), x1 - x0, 2);
    for (let i = 0; i < 30; i++) { // pebbles
      const x = x0 + 6 + ((i * 53) % (x1 - x0 - 12)), z = -12 - ((i * 37) % (depth - 14));
      c.fillStyle = i % 3 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)';
      c.fillRect(x, P(y0, z), 3 + (i % 3), 2.4);
    }
    // light from the upper left: a bright top edge, a shaded right end
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x0, P(y1, 0), x1 - x0, 1.6);
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = g; c.fillRect(x0, P(y1, 0), x1 - x0, P(y0, -depth) - P(y1, 0));
  }
  const strip = (c, x0, x1, ya, yb, col) => { c.fillStyle = col; c.fillRect(x0, P(yb, 0), x1 - x0, (yb - ya) * GY); };
  const sorted = (c, list) => {
    list.sort((a, b) => b.y - a.y);
    if (BASE) { for (const o of list) if (o.shadow) o.shadow(); }
    else for (const o of list) at(c, o.x, o.y, () => o.draw());
  };
  const car = (type, base, heading) => Cars.make(type, base, heading);
  const out = {};

  // ---- Road Rush: the chick on the verge, traffic on two lanes ----------------------------
  {
    const [cv, c] = mk();
    c.translate(400, 560); c.scale(2.45, 2.45);
    const x0 = -135, x1 = 135, y0 = -105, y1 = 105;
    if (BASE) {
      island(c, x0, x1, y0, y1, 44, '#6fae55', '#5f9e47');
      strip(c, x0, x1, 65, 105, '#69a650');
      strip(c, x0, x1, -15, 65, '#3a3d44');
      strip(c, x0, x1, -55, -15, '#6fae55');
      strip(c, x0, x1, -105, -55, '#69a650');
      c.fillStyle = 'rgba(247,247,242,0.75)';
      for (let x = x0 + 4; x < x1 - 10; x += 26) c.fillRect(x, P(26.5, 0), 13, 3 * GY);
      c.fillStyle = 'rgba(247,247,242,0.9)'; c.fillRect(x0, P(63, 0), x1 - x0, 1.8 * GY); c.fillRect(x0, P(-13, 0), x1 - x0, 1.8 * GY);
    }
    const red = car('sedan', '#e63946', 'E'), bus = car('bus', '#ffb703', 'W');
    const items = [
      { x: -70, y: 92, draw: () => Draw.tree(c, tree(TOWN_TREE, 15, 3)), shadow: () => Draw.shadow(c, -70, 92, 42, 37, 0.8) },
      { x: 10, y: 88, draw: () => Draw.tree(c, tree(TOWN_TREE, 14, 2)), shadow: () => Draw.shadow(c, 10, 88, 40, 35, 0.8) },
      { x: 95, y: 92, draw: () => Draw.tree(c, tree(TOWN_TREE, 16, 3)), shadow: () => Draw.shadow(c, 95, 92, 44, 38, 0.8) },
      { x: -115, y: 80, draw: () => Draw.bush(c, { pal: { top: '#62b44e', front: '#4b953d', top2: '#77c75f', front2: '#5aa648' }, flower: '#ffe066' }) },
      { x: -55, y: 46, draw: () => Cars.draw(c, red, 0.3), shadow: () => { c.save(); c.translate(-55, P(46, 0)); Cars.shadow(c, red, 0.9); c.restore(); } },
      { x: 70, y: 5, draw: () => Cars.draw(c, bus, 0.3), shadow: () => { c.save(); c.translate(70, P(5, 0)); Cars.shadow(c, bus, 0.9); c.restore(); } },
      { x: -105, y: -35, draw: () => Draw.lamp(c, { dir: 1 }) },
      { x: 70, y: -38, draw: () => Draw.hydrant(c) },
      ...[-30, -8, 14].map((x, i) => ({ x, y: -36, draw: () => Draw.coin(c, { phase: i * 1.2 }, 0.4) })),
      { x: -8, y: -82, draw: () => { c.translate(0, P(0, 10)); Draw.player(c, { facing: 'down', squash: -0.12, z: 0, rot: 0, flap: 0.6, char: 0 }, 0.4, SKINS.chick, 'none'); }, shadow: () => Draw.shadow(c, -8, -82, 26, 20, 0.7) },
    ];
    sorted(c, items);
    out.rr = cv.toDataURL('image/webp', 0.9);
  }

  // ---- Traffic Control: a crossroads island with its lights ------------------------------------
  {
    const [cv, c] = mk();
    c.translate(400, 545); c.scale(2.35, 2.35);
    const x0 = -135, x1 = 135, y0 = -115, y1 = 115, R = 30;
    if (BASE) {
    island(c, x0, x1, y0, y1, 44, '#8f939b', '#7e838c', ['#6f737b', '#5b6068', '#4b5058', '#3d4148']);
    // grass corners, sidewalks, the two roads
    for (const [xa, xb, ya, yb] of [[x0, -R - 10, R + 10, y1], [R + 10, x1, R + 10, y1], [x0, -R - 10, y0, -R - 10], [R + 10, x1, y0, -R - 10]]) strip(c, xa, xb, ya, yb, '#6fae55');
    strip(c, x0, x1, -R, R, '#3a3d44');
    c.fillStyle = '#3a3d44'; c.fillRect(-R, P(y1, 0), 2 * R, (y1 - y0) * GY);
    c.fillStyle = '#f2c230';
    c.fillRect(x0, P(1.5, 0), -R - 14 - x0, 1.4 * GY); c.fillRect(R + 14, P(1.5, 0), x1 - R - 14, 1.4 * GY);
    c.fillRect(-1, P(y1, 0), 2, (y1 - R - 14) * GY); c.fillRect(-1, P(-R - 14, 0), 2, (y1 - R - 14) * GY);
    c.fillStyle = '#f7f7f2';
    for (let k = -R + 3; k < R - 2; k += 7) { c.fillRect(-R - 13, P(k + 4, 0), 10, 4 * GY); c.fillRect(R + 3, P(k + 4, 0), 10, 4 * GY); c.fillRect(k, P(R + 13, 0), 4, 10 * GY); c.fillRect(k, P(-R - 3, 0), 4, 10 * GY); }
    }
    const signal = (state) => {
      B(c, -1.6, 1.6, -1.6, 1.6, 0, 44, '#7d838c', '#5b6069');
      B(c, -7, 7, -5, 5, 44, 78, '#2b2f36', '#1b1e23');
      B(c, -8, 8, -6, -5, 43, 79, '#fcc21b', '#c99a10');
      [['red', 72, '#ff2e3a'], ['yellow', 61, '#ffc619'], ['green', 50, '#2ee66b']].forEach(([s, z, col]) => {
        const y = P(-6, z), on = s === state;
        c.fillStyle = '#0d0f12'; c.beginPath(); c.arc(0, y, 4.6, 0, 6.2832); c.fill();
        c.globalAlpha = on ? 1 : 0.2; c.fillStyle = col; c.beginPath(); c.arc(0, y, 3.6, 0, 6.2832); c.fill(); c.globalAlpha = 1;
        if (on) { c.globalCompositeOperation = 'lighter'; glow(c, 0, y, 20, col.replace('#', '') && (s === 'green' ? 'rgba(60,240,120,0.55)' : 'rgba(255,60,60,0.55)')); c.globalCompositeOperation = 'source-over'; }
      });
    };
    const taxi = car('taxi', null, 'S'), blue = car('sedan', '#3a86ff', 'E'), van = car('van', '#e07a5f', 'N'), amb = car('ambulance', null, 'W');
    const cs = (v, x, y) => ({ x, y, draw: () => Cars.draw(c, v, 0.2), shadow: () => { c.save(); c.translate(x, P(y, 0)); Cars.shadow(c, v, 0.9); c.restore(); } });
    const items = [
      { x: -95, y: 85, draw: () => Draw.tree(c, tree(TOWN_TREE, 15, 3)), shadow: () => Draw.shadow(c, -95, 85, 42, 37, 0.8) },
      { x: 92, y: 88, draw: () => Draw.tree(c, tree(TOWN_TREE, 14, 2)), shadow: () => Draw.shadow(c, 92, 88, 40, 35, 0.8) },
      { x: -105, y: -85, draw: () => Draw.bush(c, { pal: { top: '#62b44e', front: '#4b953d', top2: '#77c75f', front2: '#5aa648' }, flower: null }) },
      { x: 105, y: -90, draw: () => Draw.bench(c) },
      { x: -R - 12, y: -R - 12, draw: () => signal('green') },
      { x: R + 12, y: R + 12, draw: () => signal('red') },
      cs(taxi, -15, 78), cs(blue, -60, -15), cs(van, 15, -78), cs(amb, 92, 15),
    ];
    sorted(c, items);
    out.tc = cv.toDataURL('image/webp', 0.9);
  }

  // ---- Boom Run: a stretch of desert highway, a car flying off a ramp, a wreck going up -------------
  {
    const [cv, c] = mk();
    c.translate(400, 560); c.scale(2.05, 2.05);
    const x0 = -150, x1 = 150, y0 = -140, y1 = 140, R = 44;
    if (BASE) {
    island(c, x0, x1, y0, y1, 40, '#d9bd84', '#c9a86a', ['#b98d55', '#9c7444', '#7f5d37', '#664a2c']);
    strip(c, -R - 8, R + 8, y0, y1, '#8d877c');
    strip(c, -R, R, y0, y1, '#3a3d44');
    c.fillStyle = 'rgba(247,247,242,0.85)'; c.fillRect(-R + 2, P(y1, 0), 1.8, (y1 - y0) * GY); c.fillRect(R - 3.8, P(y1, 0), 1.8, (y1 - y0) * GY);
    for (let y = y0 + 4; y < y1; y += 30) c.fillRect(-1, P(y + 16, 0), 2, 16 * GY);
    // ramp
    for (let i = 0; i < 6; i++) B(c, -36, -4, -118 + i * 5, -113 + i * 5, 0, (i + 1) * 2.2, i % 2 ? '#ffd23f' : '#2b2f36', i % 2 ? '#c99a10' : '#1b1e23');
    }
    const me = car('sports', '#ffb020', 'N'), van = car('van', '#81b29a', 'N'), taxi = car('taxi', null, 'N'), wreck = car('pickup', '#e76f51', 'N');
    Cars.wreck(wreck);
    const cs = (v, x, y) => ({ x, y, draw: () => Cars.draw(c, v, 0.2), shadow: () => { c.save(); c.translate(x, P(y, 0)); Cars.shadow(c, v, 0.9); c.restore(); } });
    const fire = () => { // the wreck going up in flames
      c.globalCompositeOperation = 'lighter'; glow(c, 0, P(0, 30), 70, 'rgba(255,120,30,0.5)'); c.globalCompositeOperation = 'source-over';
      const puff = (x, z, r, a, b) => { const g = c.createRadialGradient(x - r * 0.3, P(0, z) - r * 0.35, r * 0.1, x, P(0, z), r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, P(0, z), r, 0, 6.2832); c.fill(); };
      for (let i = 0; i < 7; i++) puff(-14 + i * 5, 52 + (i % 3) * 8, 13 - (i % 3), '#5a5e66', '#25272c');
      for (let i = 0; i < 8; i++) puff(-12 + i * 3.4, 24 + (i % 4) * 6, 11 - (i % 3) * 2, '#ffd25a', '#e8501c');
      puff(-2, 26, 7, '#fffbe0', '#ffb43a');
    };
    const items = [
      ...[[-72, 120], [70, 80], [-80, 20], [76, -40], [-74, -100], [80, 130], [-120, 70], [118, 10], [-118, -40], [122, -110], [-125, 125], [110, 115]].map(([x, y], i) => ({ x, y, draw: () => (i % 3 === 2 ? Draw.rock(c, { zone: 'desert' }) : Draw.cactus(c, { h: 30 + (i % 3) * 6, arms: i % 3, flip: i % 2 ? 1 : -1 })) })),
      cs(taxi, 20, 115), cs(van, -20, 42),
      { x: 22, y: 62, draw: () => { Cars.draw(c, wreck, 0.2); fire(); } },
      ...[0, 1, 2, 3, 4].map(i => ({ x: -20, y: -30 + i * 14, draw: () => { c.translate(0, P(0, 30 + Math.sin(i / 4 * Math.PI) * 14)); Draw.coin(c, { phase: i }, 0.3); } })),
      { x: -20, y: -78, shadow: () => Draw.shadow(c, -20, -80, 30, 46, 0.6), draw: () => {
        c.translate(0, P(0, 22)); c.rotate(-0.04);
        c.globalCompositeOperation = 'lighter';
        for (const [len, w, col] of [[34, 6, 'rgba(255,120,40,0.85)'], [24, 4.5, 'rgba(255,210,90,0.95)'], [12, 3, 'rgba(160,220,255,0.95)']]) for (const dx of [-7, 7]) {
          c.fillStyle = col; c.beginPath(); c.moveTo(dx - w / 2, P(-me.len / 2, 9)); c.lineTo(dx, P(-me.len / 2 - len, 9)); c.lineTo(dx + w / 2, P(-me.len / 2, 9)); c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
        Cars.draw(c, me, 0.2);
      } },
    ];
    sorted(c, items);
    // speed streaks
    if (BASE) c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.4; c.lineCap = 'round';
    if (BASE) for (let i = 0; i < 6; i++) { const x = -60 + i * 22; c.beginPath(); c.moveTo(x, P(-150 - i * 6, 2)); c.lineTo(x, P(-130 - i * 6, 2)); c.stroke(); }
    out.br = cv.toDataURL('image/webp', 0.9);
  }

  // ---- Hall of Art: a little gallery floating in the dark -------------------------------------------
  {
    const [cv, c] = mk();
    c.translate(400, 565); c.scale(2.4, 2.4);
    const x0 = -130, x1 = 130, y0 = -100, y1 = 100;
    if (BASE) {
    island(c, x0, x1, y0, y1, 42, '#efe9f7', '#d9d0ea', ['#9b8bbd', '#7d6ca3', '#64548a', '#4d4070']);
    // checkered marble floor
    for (let y = y0; y < y1; y += 20) for (let x = x0; x < x1; x += 20) if (((x - x0) / 20 + (y - y0) / 20) % 2 === 0) { c.fillStyle = '#ddd4ec'; c.fillRect(x, P(y + 20, 0), 20, 20 * GY); }
    // the back wall with three framed pieces
    B(c, x0, x1, y1 - 14, y1, 0, 112, '#3b2a5c', '#f4f0fa');
    c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x0, P(y1 - 14, 10), x1 - x0, 10 * GZ);
    const frame = (xa, xb, za, zb, paint) => {
      const ya = P(y1 - 14, zb), h = (zb - za) * GZ;
      c.fillStyle = '#c9a020'; c.fillRect(xa - 3, ya - 3, xb - xa + 6, h + 6);
      c.fillStyle = '#7a5c10'; c.fillRect(xa - 1, ya - 1, xb - xa + 2, h + 2);
      c.save(); c.beginPath(); c.rect(xa, ya, xb - xa, h); c.clip(); paint(xa, ya, xb - xa, h); c.restore();
    };
    frame(-112, -52, 40, 96, (x, y, w, h) => { // aurora
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#05070f'); g.addColorStop(1, '#0b1a2a'); c.fillStyle = g; c.fillRect(x, y, w, h);
      c.globalCompositeOperation = 'lighter';
      for (const [hue, o] of [[150, 0], [280, 2]]) { c.strokeStyle = `hsla(${hue},90%,60%,0.6)`; c.lineWidth = 7; c.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; const yy = y + h * (0.35 + 0.15 * Math.sin(u * 6 + o)); i ? c.lineTo(x + u * w, yy) : c.moveTo(x, yy); } c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    });
    frame(-30, 30, 50, 100, (x, y, w, h) => { // spirograph
      c.fillStyle = '#0f1218'; c.fillRect(x, y, w, h);
      c.lineWidth = 0.8;
      for (let th = 0; th < 60; th += 0.06) { const R = 0.36, r = 0.13, d = 0.17, k = (R - r) / r; const px = x + w / 2 + ((R - r) * Math.cos(th) + d * Math.cos(k * th)) * h, py = y + h / 2 + ((R - r) * Math.sin(th) - d * Math.sin(k * th)) * h; c.fillStyle = `hsl(${th * 12},90%,62%)`; c.fillRect(px, py, 0.9, 0.9); }
    });
    frame(52, 112, 40, 96, (x, y, w, h) => { // neon sign
      c.fillStyle = '#2a1918'; c.fillRect(x, y, w, h);
      c.font = `900 15px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff4fe0'; c.shadowBlur = 8; c.fillStyle = '#fff2fb'; c.fillText('ART', x + w / 2, y + h / 2); c.shadowBlur = 0;
    });
    }
    const pedestal = (fn) => () => { B(c, -12, 12, -10, 10, 0, 40, '#ffffff', '#ded6ea'); B(c, -14, 14, -12, 12, 40, 44, '#f4f0fa', '#cfc6df'); c.translate(0, P(0, 44)); fn(); };
    const orb = () => {
      c.globalCompositeOperation = 'lighter'; glow(c, 0, P(0, 13), 34, 'rgba(255,90,230,0.45)'); c.globalCompositeOperation = 'source-over';
      const g = c.createRadialGradient(-4, P(0, 17), 1, 0, P(0, 13), 13); g.addColorStop(0, '#fff'); g.addColorStop(0.2, '#ff7ce8'); g.addColorStop(1, '#8e1f9c');
      c.fillStyle = g; c.beginPath(); c.arc(0, P(0, 13), 13, 0, 6.2832); c.fill();
    };
    const cube = () => { c.translate(0, P(0, 2)); c.rotate(-0.12); B(c, -10, 10, -9, 9, 0, 19, '#ffd84a', '#5b3a9e'); c.fillStyle = '#3d9bff'; c.fillRect(10, P(9, 19), 3, 19 * GZ); };
    const rope = () => { // velvet rope between two gold posts
      for (const x of [-60, 60]) { B(c, x - 1.5, x + 1.5, -1.5, 1.5, 0, 26, '#ffd84a', '#c9a020'); c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(x, P(0, 28), 3.2, 0, 6.2832); c.fill(); }
      c.strokeStyle = '#b3122e'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-60, P(0, 24)); c.quadraticCurveTo(0, P(0, 6), 60, P(0, 24)); c.stroke();
    };
    const items = [
      { x: -70, y: 30, draw: pedestal(orb), shadow: () => Draw.shadow(c, -70, 30, 34, 30, 0.6) },
      { x: 70, y: 30, draw: pedestal(cube), shadow: () => Draw.shadow(c, 70, 30, 34, 30, 0.6) },
      { x: 0, y: 46, draw: () => { B(c, -16, 16, -2, 2, 0, 58, '#5b3a9e', '#3b2468'); c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `900 9px ${UI_FONT}`; c.textAlign = 'center'; c.fillText('HALL', 0, P(-2, 46)); c.fillText('OF ART', 0, P(-2, 34)); } },
      { x: 0, y: -60, draw: rope },
    ];
    sorted(c, items);
    // spotlights from above
    if (!BASE) {
    c.globalCompositeOperation = 'lighter';
    for (const x of [-70, 70]) {
      const g = c.createLinearGradient(0, P(30, 160), 0, P(30, 40)); g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(1, 'rgba(255,240,210,0.22)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, P(30, 170)); c.lineTo(x + 6, P(30, 170)); c.lineTo(x + 24, P(30, 44)); c.lineTo(x - 24, P(30, 44)); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    }
    out.ha = cv.toDataURL('image/webp', 0.9);
  }
  return out;
};
