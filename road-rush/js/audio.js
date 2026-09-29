'use strict';
// Tiny WebAudio synth. Every sound is generated on the fly - no audio files.

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = Store.get('muted', false);
  let lastWhoosh = 0;

  // Must be called from a user gesture (browsers block audio until then).
  function init() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.knee.value = 12;
        comp.ratio.value = 5;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.75;
        master.connect(comp);
        comp.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      ctx = null;
    }
  }

  const ok = () => ctx && !muted && ctx.state === 'running';

  function out(node, pan) {
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      p.connect(master);
    } else {
      node.connect(master);
    }
  }

  function envelope(param, t, attack, peak, dur) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(type, f0, f1, dur, vol, delay = 0, pan = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    envelope(g.gain, t, 0.006, vol, dur);
    o.connect(g);
    out(g, pan);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(filter, f0, f1, dur, vol, { q = 1, delay = 0, pan = 0, attack = 0.005 } = {}) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    envelope(g.gain, t, attack, vol, dur);
    s.connect(f);
    f.connect(g);
    out(g, pan);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  return {
    init,
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      Store.set('muted', m);
      if (master) master.gain.value = m ? 0 : 0.75;
    },

    hop(fast) { if (ok()) tone('sine', fast ? 520 : 420, fast ? 820 : 660, 0.07, 0.07); },
    bump() { if (ok()) tone('sine', 170, 90, 0.09, 0.12); },
    land() { if (ok()) noise('lowpass', 700, 120, 0.14, 0.25); },
    click() { if (ok()) tone('sine', 660, 990, 0.06, 0.08); },

    coin() {
      if (!ok()) return;
      tone('triangle', 988, 0, 0.08, 0.16);
      tone('triangle', 1319, 0, 0.24, 0.16, 0.07);
    },

    powerup() {
      if (!ok()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.15, i * 0.055));
      tone('sine', 1047, 2093, 0.3, 0.07, 0.22);
    },

    freeze() {
      if (!ok()) return;
      tone('sine', 2400, 600, 0.5, 0.08);
      noise('highpass', 4000, 0, 0.5, 0.12, { attack: 0.05 });
    },

    whoosh(vol, pan) {
      if (!ok()) return;
      const now = ctx.currentTime;
      if (now - lastWhoosh < 0.09) return;
      lastWhoosh = now;
      noise('bandpass', 380, 1400, 0.34, 0.22 * vol, { q: 0.8, pan, attack: 0.1 });
    },

    horn(pan) {
      if (!ok()) return;
      for (const d of [0, 0.22]) {
        tone('square', 370, 0, 0.16, 0.05, d, pan);
        tone('square', 466, 0, 0.16, 0.045, d, pan);
      }
    },

    explosion(vol, pan) {
      if (!ok()) return;
      noise('lowpass', 5000, 110, 1.7, 0.95 * vol, { q: 0.6, pan, attack: 0.003 });  // roar
      tone('sine', 130, 30, 1.0, 0.9 * vol, 0, pan);                                 // boom
      tone('triangle', 75, 28, 1.3, 0.5 * vol);                                        // sub
      tone('square', 196, 110, 0.18, 0.12 * vol, 0, pan);                              // metal clank
      tone('square', 262, 140, 0.14, 0.1 * vol, 0, pan);
      noise('highpass', 2600, 0, 0.3, 0.35 * vol, { pan });                             // glass
      for (let i = 0; i < 6; i++) {                                                     // crackle
        noise('bandpass', rand(1500, 4200), 0, 0.05, 0.18 * vol, { q: 5, delay: 0.25 + Math.random() * 0.9, pan });
      }
    },

    shieldBreak() {
      if (!ok()) return;
      noise('highpass', 3200, 0, 0.3, 0.3);
      tone('triangle', 1700, 280, 0.32, 0.16);
      tone('sine', 900, 1900, 0.16, 0.08, 0.04);
    },

    hit() {
      if (!ok()) return;
      tone('square', 280, 55, 0.35, 0.16);
      noise('lowpass', 1400, 180, 0.3, 0.55);
    },

    stun() {
      if (!ok()) return;
      [0, 0.11, 0.22].forEach(d => tone('sine', 1900, 2700, 0.09, 0.05, d));
    },

    gameOver() {
      if (!ok()) return;
      [523, 440, 349, 262].forEach((f, i) => tone('triangle', f, 0, 0.24, 0.14, 0.16 * i));
    },
  };
})();
