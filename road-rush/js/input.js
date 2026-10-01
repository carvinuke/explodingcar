'use strict';
// Input: keyboard (rebindable), touch swipes and game controllers.
// Two-player mode: player one uses their movement keys (WASD by default),
// player two the arrow keys. The first controller is player one, the second
// is player two.

const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function keyLabel(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const names = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']' };
  return names[code] || code;
}

const Input = {
  capture: null, // settings: waiting for a key to bind
  pads: [],

  init() {
    addEventListener('keydown', e => this.key(e));
    addEventListener('keyup', e => { if (UI.modal === 'claw') UI.clawKey(e, false); });

    // Touch / mouse: swipe to move in that direction, tap to hop forward.
    const root = document.getElementById('game');
    let sx = 0, sy = 0, down = false;
    root.addEventListener('pointerdown', e => {
      if (Game.state === 'replay') { Game.skipReplay(); return; }
      if (e.target.closest('button') || Game.state !== 'playing') return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    root.addEventListener('pointerup', e => {
      if (!down) return;
      down = false;
      if (Game.state !== 'playing') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) < 24) Player.input(0, 1);
      else if (Math.abs(dx) > Math.abs(dy)) Player.input(sign(dx), 0);
      else Player.input(0, dy < 0 ? 1 : -1);
    });
    root.addEventListener('pointercancel', () => { down = false; });
  },

  // Which player and direction a key means right now.
  route(code) {
    const arrow = ARROWS[code];
    if (Game.players.length > 1 && Game.state !== 'title') {
      if (arrow) return { pid: 1, dir: arrow };
      // arrows belong to player two, so player one falls back to WASD if they bound arrows
      const k = Object.values(Settings.keys).some(v => ARROWS[v]) ? DEFAULT_KEYS : Settings.keys;
      for (const d in k) if (k[d] === code) return { pid: 0, dir: d };
      return null;
    }
    for (const d in Settings.keys) if (Settings.keys[d] === code) return { pid: 0, dir: d };
    if (arrow) return { pid: 0, dir: arrow };
    return null;
  },

  key(e) {
    if (this.capture) { // binding a key in settings
      e.preventDefault();
      if (e.code !== 'Escape') this.capture(e.code);
      else this.capture(null);
      return;
    }
    if (UI.modal === 'claw' && !e.repeat && UI.clawKey(e, true)) return; // steering the claw
    if (UI.modal) { // dialogs own the keyboard while open
      if (e.code === 'Escape') { e.preventDefault(); UI.closeModal(); }
      return;
    }
    if (Admin.freeCam) { // admin free camera: movement keys look around, Esc hands control back
      if (e.code === 'Escape') { e.preventDefault(); Admin.toggle('freeCam'); return; }
      if (Admin.camKey(e.code)) { e.preventDefault(); return; }
    }
    if (Game.state === 'replay') {
      if (!e.repeat && !e.metaKey && !e.ctrlKey) { e.preventDefault(); Game.skipReplay(); }
      return;
    }
    const r = this.route(e.code);
    const confirm = e.code === 'Space' || e.code === 'Enter';
    if (r || e.code === 'Space' || ARROWS[e.code]) e.preventDefault();
    if (e.code === 'KeyM' && !Object.values(Settings.keys).includes('KeyM')) { UI.toggleMute(); return; }
    if ((e.code === 'KeyP' && !Object.values(Settings.keys).includes('KeyP')) || e.code === 'Escape') { Game.togglePause(); return; }
    if (e.repeat) return;
    if (confirm) { this.confirm(); if (Game.state === 'gameover') e.preventDefault(); return; }
    if (r) this.move(r.pid, DIRS[r.dir]);
  },

  confirm() {
    if (Game.state === 'title') Game.start('normal');
    else if (Game.state === 'gameover' && Game.overT > 0.4) Game.start();
    else if (Game.state === 'paused') Game.togglePause(false);
  },

  move(pid, [dx, dy]) {
    if (Game.state === 'title') {
      Game.start('normal');
      Player.input(dx, dy);
      return;
    }
    if (Game.state !== 'playing') return;
    const p = Game.players[pid];
    if (p) p.input(dx, dy);
  },

  // ---- Game controllers ----------------------------------------------------------
  poll() {
    let list;
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return; }
    let n = 0;
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      const pid = n++;
      const prev = this.pads[pid] || { b: [], dir: null };
      const pressed = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const edge = i => pressed(i) && !prev.b[i];
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (pressed(12) || ay < -0.6) dir = 'up';
      else if (pressed(13) || ay > 0.6) dir = 'down';
      else if (pressed(14) || ax < -0.6) dir = 'left';
      else if (pressed(15) || ax > 0.6) dir = 'right';
      if (!UI.modal) {
        if (Game.state === 'replay' && (edge(0) || edge(1) || edge(9))) Game.skipReplay();
        else if (edge(9)) Game.togglePause();
        else if (edge(0)) {
          if (Game.state === 'playing') this.move(pid, DIRS.up);
          else this.confirm();
        } else if (dir && dir !== prev.dir && (Game.state === 'playing' || Game.state === 'title')) this.move(pid, DIRS[dir]);
      } else if (edge(1) || edge(9)) UI.closeModal();
      this.pads[pid] = { b: gp.buttons.map(b => b.pressed), dir };
    }
  },
};
