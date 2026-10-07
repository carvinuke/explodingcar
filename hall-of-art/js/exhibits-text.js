'use strict';
// Hall of Art: letters that won't sit still.

// Split a word into one span per letter.
function tbLetters(el, text) {
  el.innerHTML = '';
  return [...text].map(ch => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
    return s;
  });
}

// 19. Letters scatter away from your cursor, then spring back into place.
Exhibits.add({
  id: 'scatter', name: 'Shy Letters', section: 'text', hint: 'Move through the word',
  setup(t) {
    t.el.classList.add('center');
    const w = document.createElement('div');
    w.className = 'word xl';
    t.el.appendChild(w);
    t.chars = tbLetters(w, 'SCATTER').map(el => ({ el, x: HA.spring(170, 11), y: HA.spring(170, 11), r: HA.spring(120, 9), home: null }));
  },
  frame(t, dt) {
    const s = t.el.getBoundingClientRect();
    for (const ch of t.chars) {
      if (!ch.home) { const r = ch.el.getBoundingClientRect(); ch.home = [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2]; }
      let tx = 0, ty = 0, tr = 0;
      const dx = ch.home[0] + ch.x.x - t.p.x, dy = ch.home[1] + ch.y.x - t.p.y, d = Math.hypot(dx, dy);
      if (d < 90) { const k = (1 - d / 90) * 70; tx = (dx / (d || 1)) * k; ty = (dy / (d || 1)) * k; tr = (dx > 0 ? 1 : -1) * k * 0.6; }
      const x = ch.x.step(tx, dt), y = ch.y.step(ty, dt), r = ch.r.step(tr, dt);
      ch.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
    }
  },
  resize(t) { for (const ch of t.chars) ch.home = null; },
});

// 20. Scrambled text that decodes itself. Hover or click to scramble it again.
Exhibits.add({
  id: 'decode', name: 'Decoder', section: 'text', hint: 'Hover or click to scramble',
  setup(t) {
    t.el.classList.add('center', 'dark');
    t.el.innerHTML = '<div class="decode"></div>';
    t.out = t.el.querySelector('.decode');
    t.words = ['ACCESS GRANTED', 'CAR GO BOOM', 'HELLO, HUMAN', 'TRAFFIC CONTROL', 'TOP SECRET', 'NICE TRY'];
    t.i = 0; t.k = 0; t.target = t.words[0];
    t.go = () => { t.i = (t.i + 1) % t.words.length; t.target = t.words[t.i]; t.k = 0; };
    t.el.addEventListener('pointerenter', () => t.go());
    t.el.addEventListener('click', () => { t.go(); t.blip(1400, 0.05, 'square', 0.03); });
  },
  frame(t, dt) {
    t.k = Math.min(t.target.length + 1, t.k + dt * 9);
    const glyphs = '!<>-_\\/[]{}=+*^?#0123456789ABCDEFX';
    let s = '';
    for (let i = 0; i < t.target.length; i++) {
      if (i < Math.floor(t.k) || t.target[i] === ' ') s += t.target[i];
      else s += glyphs[(Math.random() * glyphs.length) | 0];
    }
    if (t.out.textContent !== s) t.out.textContent = s;
  },
});

// 21. A word riding a wave. Your cursor makes the sea rougher.
Exhibits.add({
  id: 'wave', name: 'Wave Text', section: 'text', hint: 'Hover for a rough sea',
  setup(t) {
    t.el.classList.add('center', 'sea');
    const w = document.createElement('div');
    w.className = 'word xl wavy';
    t.el.appendChild(w);
    t.chars = tbLetters(w, 'SURF’S UP');
    t.amp = 6;
  },
  frame(t, dt, time) {
    t.amp = HA.lerp(t.amp, t.p.inside ? 22 : 6, dt * 3);
    t.chars.forEach((el, i) => {
      const y = Math.sin(time * 3 + i * 0.6) * t.amp, r = Math.cos(time * 3 + i * 0.6) * t.amp * 0.6;
      el.style.transform = `translateY(${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
    });
  },
});

// 22. Big shiny letters with a sheen that follows your cursor.
Exhibits.add({
  id: 'shimmer', name: 'Chrome', section: 'text', hint: 'Move across it',
  setup(t) {
    t.el.classList.add('center', 'dark');
    t.el.innerHTML = '<div class="chrome">BOOM</div>';
    t.w = t.el.querySelector('.chrome');
  },
  frame(t, dt, time) {
    const x = t.p.inside ? (t.p.x / t.W) * 100 : (Math.sin(time * 0.8) * 0.5 + 0.5) * 100;
    t.w.style.setProperty('--sx', `${x.toFixed(1)}%`);
  },
});

// 23. A typewriter that keeps changing its mind.
Exhibits.add({
  id: 'type', name: 'Typewriter', section: 'text', hint: 'Just watch (or click)',
  setup(t) {
    t.el.classList.add('center', 'paper');
    t.el.innerHTML = '<div class="typer"><span></span><i>|</i></div>';
    t.out = t.el.querySelector('span');
    t.lines = ['Why did the chicken cross the road?', 'To get to the other side.', 'It did not make it.', 'Traffic is a state of mind.', 'Please keep your hands inside the exhibit box.'];
    t.li = 0; t.n = 0; t.dir = 1; t.wait = 0.6;
    t.el.addEventListener('click', () => { t.dir = -1; t.wait = 0; });
  },
  frame(t, dt) {
    t.wait -= dt;
    if (t.wait > 0) return;
    const line = t.lines[t.li];
    if (t.dir > 0) {
      t.n++;
      t.wait = line[t.n - 1] === ' ' ? 0.09 : HA.rand(0.04, 0.11);
      if (t.n % 2) t.blip(HA.rand(1800, 2400), 0.015, 'square', 0.025);
      if (t.n >= line.length) { t.dir = -1; t.wait = 1.6; }
    } else {
      t.n = Math.max(0, t.n - 2);
      t.wait = 0.02;
      if (t.n === 0) { t.dir = 1; t.li = (t.li + 1) % t.lines.length; t.wait = 0.4; }
    }
    t.out.textContent = t.lines[t.li].slice(0, t.n);
  },
});
