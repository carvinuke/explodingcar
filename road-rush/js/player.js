'use strict';
// The player: grid hops, blast knockback + stun, and a ragdoll on death.

const Player = {
  kind: 'player',

  reset() {
    this.col = START_COL;
    this.row = 0;
    this.x = cellX(START_COL);
    this.y = 0;
    this.z = 0;
    this.hop = null;
    this.queue = null;
    this.knock = null;
    this.rag = null;
    this.facing = 'up';
    this.stun = 0;
    this.alive = true;
    this.shield = false;
    this.grace = 0;
    this.squash = 0;
    this.rot = 0;
    this.flap = 0;
    this.maxRow = 0;
    this.trail = [];
    this.trailT = 0;
  },

  input(dx, dy) {
    if (!this.alive || this.knock || this.stun > 0) return;
    if (this.hop) { this.queue = [dx, dy]; return; } // buffer one move for snappy input
    this.move(dx, dy);
  },

  move(dx, dy) {
    this.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'up' : 'down';
    const nc = this.col + dx, nr = this.row + dy;
    if (World.isBlocked(nc, nr) || Vehicles.blocksCell(nc, nr)) {
      this.squash = 0.5;
      Sound.bump();
      return false;
    }
    const fast = Powers.speed > 0;
    this.hop = { fx: this.x, fy: this.y, tx: cellX(nc), ty: nr * TILE, t: 0, dur: fast ? 0.075 : 0.12 };
    this.col = nc;
    this.row = nr;
    Sound.hop(fast);
    Game.onPlayerMove();
    return true;
  },

  update(dt, time) {
    if (this.rag) { this.updateRagdoll(dt); return; }
    if (this.grace > 0) this.grace -= dt;

    if (this.knock) {
      const k = this.knock;
      k.t = Math.min(1, k.t + dt / k.dur);
      const e = easeOutQuad(k.t);
      this.x = lerp(k.fx, k.tx, e);
      this.y = lerp(k.fy, k.ty, e);
      this.z = Math.sin(Math.PI * k.t) * k.h;
      this.rot = k.spin * k.t;
      if (k.t >= 1) {
        this.knock = null;
        this.z = 0;
        this.rot = 0;
        this.squash = 0.8;
        FX.dust(this.x, this.y, 8);
        Sound.land();
      }
    } else if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / h.dur);
      const e = easeOutQuad(h.t);
      this.x = lerp(h.fx, h.tx, e);
      this.y = lerp(h.fy, h.ty, e);
      this.z = Math.sin(Math.PI * h.t) * 0.3 * TILE;
      this.flap = Math.sin(Math.PI * h.t);
      if (h.t >= 1) {
        this.hop = null;
        this.z = 0;
        this.flap = 0;
        this.squash = 0.45;
        if (Powers.speed > 0) FX.dust(this.x, this.y, 3);
        if (this.queue) {
          const q = this.queue;
          this.queue = null;
          if (this.stun <= 0) this.move(q[0], q[1]);
        }
      }
    }

    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
    this.squash = damp(this.squash, 0, 14, dt);
    if (!this.knock) this.rot = this.stun > 0 ? Math.sin(time * 16) * 0.14 * Math.min(1, this.stun / 0.5) : 0;

    // speed-boost afterimages
    if (Powers.speed > 0) {
      this.trailT -= dt;
      const last = this.trail[this.trail.length - 1];
      if (this.trailT <= 0 && (!last || Math.hypot(last.x - this.x, last.y - this.y) > 3)) {
        this.trailT = 0.02;
        this.trail.push({ x: this.x, y: this.y, z: this.z, a: 0.55 });
        if (this.trail.length > 10) this.trail.shift();
      }
    }
    for (const t of this.trail) t.a -= dt * 2.4;
    while (this.trail.length && this.trail[0].a <= 0) this.trail.shift();
  },

  // Explosion nearby: distance decides knockback and stun.
  blast(ex, ey) {
    if (!this.alive) return;
    const dx = (this.x - ex) / TILE, dy = (this.y - ey) / TILE;
    const dist = Math.hypot(dx, dy);
    if (dist > 4.6) return;
    if (Powers.invincible > 0) { FX.text(this.x, this.y, 'IMMUNE', '#e2b8ff', 15); return; }
    let cells, stun;
    if (dist < 1.6) { cells = 2; stun = 1.7; }
    else if (dist < 3.1) { cells = 1; stun = 1.0; }
    else { cells = 0; stun = 0.45; }
    let sx = 0, sy = 0;
    if (dist < 0.15) sy = -1;
    else if (Math.abs(dx) > Math.abs(dy)) sx = sign(dx);
    else sy = sign(dy);
    this.knockback(sx, sy, cells, stun);
    FX.text(this.x, this.y + 10, cells ? 'KNOCKED BACK!' : 'DAZED', '#ffe34d', 15);
  },

  knockback(sx, sy, cells, stun) {
    this.queue = null;
    this.hop = null;
    this.flap = 0;
    // snap the logical cell to wherever we are right now
    this.col = clamp(Math.round(this.x / TILE - 0.5), 0, COLS - 1);
    this.row = Math.max(0, Math.round(this.y / TILE));
    let c = this.col, r = this.row, moved = 0;
    for (let i = 0; i < cells; i++) {
      if (World.isBlocked(c + sx, r + sy)) break;
      c += sx;
      r += sy;
      moved++;
    }
    if (cells > 0) {
      const dur = 0.3 + 0.1 * moved;
      this.knock = {
        fx: this.x, fy: this.y, tx: cellX(c), ty: r * TILE, t: 0, dur,
        h: (0.45 + 0.35 * moved) * TILE,
        spin: (sx !== 0 ? sx : -sy) * Math.PI * 2,
      };
      this.col = c;
      this.row = r;
    }
    this.stun = Math.max(this.stun, stun + (this.knock ? this.knock.dur : 0));
    Sound.stun();
  },

  die(pushDir) {
    this.alive = false;
    this.hop = this.knock = this.queue = null;
    this.stun = 0;
    this.flap = 0;
    this.rag = { vx: pushDir * rand(240, 320), vy: rand(-30, 30), vz: 330, rotV: pushDir * 13, bounces: 0 };
  },

  updateRagdoll(dt) {
    const r = this.rag;
    r.vz -= 1100 * dt;
    this.x += r.vx * dt;
    this.y += r.vy * dt;
    this.z += r.vz * dt;
    this.rot += r.rotV * dt;
    if (this.z <= 0) {
      this.z = 0;
      if (r.bounces < 2 && Math.abs(r.vz) > 60) {
        r.vz = Math.abs(r.vz) * 0.38;
        r.vx *= 0.5;
        r.vy *= 0.5;
        r.rotV *= 0.5;
        r.bounces++;
        FX.dust(this.x, this.y, 6);
      } else {
        r.vz = 0;
        r.vx = damp(r.vx, 0, 8, dt);
        r.vy = damp(r.vy, 0, 8, dt);
        r.rotV = 0;
        this.rot = damp(this.rot, Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2), 10, dt);
      }
    }
  },
};
