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
  function vehicle(c, v, frost) {
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

    // lights
    c.fillStyle = pal.lit ? '#fff5c2' : '#3a3a3a';
    c.fillRect(fx - 4, P(-hy, zt - 2), 4, 5 * GZ);
    c.fillRect(fx - 3, P(hy - 3, zt), 3, 5 * GY);
    c.fillRect(fx - 3, P(-hy + 8, zt), 3, 5 * GY);
    c.fillStyle = pal.lit ? '#ff4d4d' : '#3a2020';
    c.fillRect(bx, P(-hy, zt - 2), 3, 5 * GZ);

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
  function tree(c, o) {
    box(c, -4, 4, -4, 4, 0, 14, '#9a6b4a', '#77502f');
    const p = o.pal;
    let z = 12, s = o.size;
    for (let i = 0; i < o.tiers; i++) {
      const h = i === 0 ? 22 : 16;
      box(c, -s, s, -s * 0.9, s * 0.9, z, z + h, i % 2 ? p.top2 : p.top, i % 2 ? p.front2 : p.front);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(-s, P(s * 0.9, z + h), s * 2, 2);
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

  // ---- Player (a chunky little chick) ---------------------------------------
  function player(c, p, time) {
    const W = 11, D = 10, H = 22, lift = 3;
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
    c.fillStyle = '#ff9f1c';
    c.fillRect(-7, P(-D + 2, lift), 4, lift * GZ + 1);
    c.fillRect(3, P(-D + 2, lift), 4, lift * GZ + 1);
    // body
    box(c, -hw, hw, -D, D, lift, lift + h, '#fff1a8', '#ffd23f');
    c.fillStyle = 'rgba(214,150,0,0.22)';
    c.fillRect(-hw, P(-D, lift + 5), hw * 2, 5 * GZ);
    // wings
    const wz = lift + h * 0.35 + (p.flap || 0) * 6;
    box(c, -hw - 3, -hw, -5, 5, wz, wz + 8, '#ffe066', '#f2b705');
    box(c, hw, hw + 3, -5, 5, wz, wz + 8, '#ffe066', '#f2b705');
    // comb
    const top = lift + h;
    box(c, -3, 3, -2, 4, top, top + 5, '#ff6b6b', '#e04848');
    // face
    const ez = top - 6;
    const eye = ex => {
      c.fillStyle = '#1d1d1f';
      c.fillRect(ex, P(-D, ez), 3.5, 4.5 * GZ);
      c.fillStyle = '#fff';
      c.fillRect(ex + 0.6, P(-D, ez) + 0.6, 1.3, 1.3);
    };
    const beak = (x0, x1, y0, y1) => box(c, x0, x1, y0, y1, top - 13, top - 8, '#ffb347', '#ff8c1a');
    if (p.facing === 'down') {
      eye(-7); eye(3.5);
      beak(-3, 3, -D - 5, -D);
      c.fillStyle = 'rgba(255,120,120,0.45)';
      c.fillRect(-10, P(-D, ez - 5), 3, 2);
      c.fillRect(7, P(-D, ez - 5), 3, 2);
    } else if (p.facing === 'up') {
      box(c, -4, 4, -D - 3, -D, lift + 4, lift + 10, '#ffffff', '#f3e3a0'); // tail
    } else {
      const s = p.facing === 'right' ? 1 : -1;
      eye(s > 0 ? hw - 7 : -hw + 3.5);
      beak(s > 0 ? hw : -hw - 6, s > 0 ? hw + 6 : -hw, -3, 3);
    }
    c.restore();
  }

  function ghost(c, z) {
    box(c, -11, 11, -10, 10, 3 + z, 25 + z, 'rgba(255,214,107,0.9)', 'rgba(255,179,25,0.9)');
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

  return {
    LANE_D, box, shadow, vehiclePalette, wreckPalette, vehicle, warning,
    tree, bush, rock, lamp, sign, player, ghost, stars, bubble, coin, powerItem, icon, iconURL,
  };
})();
