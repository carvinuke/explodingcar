'use strict';
// Smooth follow camera with trauma-based shake and zoom punches.

const Cam = {
  reset() {
    this.x = WORLD_W / 2;
    this.y = Player.y + 0.5 * TILE;
    this.zoom = 1;
    this.punch = 0;
    this.trauma = 0;
    this.sx = this.sy = this.rot = 0;
    this.t = 0;
  },

  addTrauma(a) { this.trauma = Math.min(1, this.trauma + a); },

  update(dt, realDt) {
    const R = Renderer;
    const viewW = R.W / (R.base * this.zoom);

    // Horizontal: centre on the playfield when it fits, otherwise follow.
    let tx;
    if (viewW >= WORLD_W + TILE) tx = WORLD_W / 2 + (Player.x - WORLD_W / 2) * 0.12;
    else {
      const half = viewW / 2 - 0.6 * TILE;
      tx = clamp(Player.x, half, WORLD_W - half);
    }
    this.x = damp(this.x, tx, 5, dt);

    // Vertical: trail the player; the creeping danger line pushes from below.
    let ty = Player.y + 0.5 * TILE;
    if (Game.danger.active && Game.state === 'playing') {
      ty = Math.max(ty, Game.danger.y + (R.H * (1 - R.ANCHOR)) / (R.base * this.zoom * GY) - TILE);
    }
    this.y = damp(this.y, ty, 4, dt);

    this.zoom = damp(this.zoom, Powers.speed > 0 ? 0.94 : 1, 3, realDt);
    this.punch = damp(this.punch, 0, 5, realDt);

    this.trauma = Math.max(0, this.trauma - realDt * 1.2);
    this.t += realDt;
    const s = Settings.shake ? this.trauma * this.trauma : 0;
    this.sx = 18 * s * wobble(this.t * 31);
    this.sy = 18 * s * wobble(this.t * 27 + 40);
    this.rot = 0.04 * s * wobble(this.t * 23 + 90);
  },
};
