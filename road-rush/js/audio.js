'use strict';
// Tiny WebAudio synth. Every sound is generated on the fly - no audio files.

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = Store.get('muted', false);
  let lastWhoosh = 0;
  let rainGain = null, windGain = null;
  let engineNode = null; // Boom Run's engine, made on first use

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
        // looping weather beds (silent until it rains or snows)
        const bed = (type, freq, q) => {
          const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          src.buffer = noiseBuf;
          src.loop = true;
          f.type = type;
          f.frequency.value = freq;
          f.Q.value = q;
          g.gain.value = 0;
          src.connect(f); f.connect(g); g.connect(master);
          src.start();
          return g;
        };
        rainGain = bed('highpass', 1800, 0.4);
        windGain = bed('lowpass', 380, 0.8);
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
    if (!isFinite(peak) || !isFinite(t) || !isFinite(attack) || !isFinite(dur)) peak = 0.0002, attack = attack || 0.01, dur = dur || 0.1; // a bad volume is silence, never a crash
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

    // A running engine (Boom Run): level 0..1 sets pitch and loudness, 0 is off.
    engine(level, boost) {
      if (!ctx || !master) return;
      try {
        if (!engineNode) {
          const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
          o1.type = 'sawtooth'; o2.type = 'square';
          f.type = 'lowpass'; f.Q.value = 2;
          g.gain.value = 0;
          o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
          o1.start(); o2.start();
          engineNode = { o1, o2, f, g };
        }
        const E = engineNode, now = ctx.currentTime, on = level > 0;
        E.g.gain.setTargetAtTime(on ? 0.022 + 0.018 * level + (boost ? 0.012 : 0) : 0, now, on ? 0.08 : 0.15);
        if (on) {
          const hz = 46 + level * 92 + (boost ? 22 : 0);
          E.o1.frequency.setTargetAtTime(hz, now, 0.12);
          E.o2.frequency.setTargetAtTime(hz * 1.505, now, 0.12);
          E.f.frequency.setTargetAtTime(260 + level * 820 + (boost ? 300 : 0), now, 0.12);
        }
      } catch (e) { /* no engine noise, then */ }
    },

    hop(fast) { if (ok()) tone('sine', fast ? 520 : 420, fast ? 820 : 660, 0.07, 0.07); },

    // Your hop sound from the shop (or the classic one).
    hopAs(kind, fast) {
      if (!ok()) return;
      const k = fast ? 1.25 : 1;
      switch (kind) {
        case 'squeak': tone('square', 1200 * k, 1800 * k, 0.05, 0.035); tone('sine', 1800 * k, 1300 * k, 0.07, 0.05, 0.04); return;
        case 'boing': tone('sine', 170 * k, 520 * k, 0.16, 0.11); tone('triangle', 250 * k, 620 * k, 0.12, 0.04, 0.03); return;
        case 'laser': tone('sawtooth', 1700 * k, 180, 0.12, 0.045); return;
        case 'quack': tone('sawtooth', 560, 380, 0.1, 0.05); noise('bandpass', 950, 700, 0.1, 0.06, { q: 5 }); return;
        case 'drum': tone('sine', 140, 55, 0.12, 0.2); noise('lowpass', 400, 90, 0.06, 0.12); return;
        case 'coin': tone('square', 988 * k, 0, 0.05, 0.035); tone('square', 1319 * k, 0, 0.1, 0.035, 0.05); return;
        case 'bubble': tone('sine', 380 * k, 1300 * k, 0.09, 0.09); return;
        case 'pop': noise('bandpass', 2600, 1200, 0.035, 0.18, { q: 2 }); tone('sine', 900, 280, 0.04, 0.08); return;
        case 'piano': {
          const notes = [523, 587, 659, 784, 880, 1047, 880, 784, 659, 587];
          this.pianoN = ((this.pianoN || 0) + 1) % notes.length;
          const f = notes[this.pianoN];
          tone('triangle', f, 0, 0.32, 0.09); tone('sine', f * 2, 0, 0.18, 0.025);
          return;
        }
        case 'robot': tone('square', 300 * k, 300 * k, 0.04, 0.035); tone('square', 450 * k, 450 * k, 0.04, 0.035, 0.045); return;
        case 'spring': tone('triangle', 300 * k, 950 * k, 0.07, 0.07); tone('triangle', 950 * k, 420 * k, 0.08, 0.05, 0.07); return;
        case 'whistle': tone('sine', 1400 * k, 2300 * k, 0.1, 0.055); return;
        case 'cowbell': tone('square', 560, 0, 0.13, 0.035); tone('square', 845, 0, 0.13, 0.028); return;
        case 'chip': tone('square', 440 * k, 880 * k, 0.06, 0.045); return;
        case 'meow': tone('sawtooth', 650, 1000, 0.07, 0.035); tone('sawtooth', 1000, 620, 0.12, 0.035, 0.07); return;
        case 'slime': noise('lowpass', 700, 160, 0.11, 0.16); tone('sine', 320, 140, 0.1, 0.06); return;
        case 'kazoo': tone('sawtooth', 330 * k, 360 * k, 0.12, 0.05); tone('square', 662 * k, 720 * k, 0.12, 0.012); return;
        case 'honk': tone('square', 400, 400, 0.09, 0.035); tone('square', 505, 505, 0.09, 0.028); return;
        case 'bell': tone('sine', 1568, 0, 0.45, 0.055); tone('sine', 2349, 0, 0.3, 0.025); return;
        case 'magic': [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, 0, 0.12, 0.04, i * 0.025)); return;
        case 'fanfare': tone('square', 784, 0, 0.07, 0.035); tone('square', 1047, 0, 0.14, 0.04, 0.07); return;
        case 'jackpot': [1319, 1760, 1319, 1760].forEach((f, i) => tone('triangle', f, 0, 0.06, 0.06, i * 0.04)); return;
        default: this.hop(fast);
      }
    },
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

    explosion(vol, pan, big = false) {
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
      if (big) {
        tone('sine', 62, 18, 2.2, 0.9 * vol);                                           // deep second boom
        noise('lowpass', 420, 50, 3.2, 0.7 * vol, { q: 0.5, attack: 0.05 });            // long rumble
        for (let i = 0; i < 14; i++) {                                                  // falling debris
          noise('bandpass', rand(700, 3000), 0, 0.07, 0.22 * vol, { q: 6, delay: 0.5 + Math.random() * 2, pan: pan + rand(-0.4, 0.4) });
        }
      }
    },

    splat() {
      if (!ok()) return;
      noise('bandpass', 900, 180, 0.28, 0.6, { q: 1.2 });
      tone('sine', 150, 40, 0.22, 0.35);
      for (const d of [0.04, 0.11, 0.2]) noise('bandpass', rand(300, 600), 0, 0.08, 0.25, { q: 6, delay: d });
    },

    clang(vol, pan) {
      if (!ok()) return;
      tone('square', 140, 60, 0.22, 0.12 * vol, 0, pan);
      noise('lowpass', 1600, 200, 0.2, 0.35 * vol, { pan });
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

    // weather beds: called every frame with 0..1 amounts
    ambient(rain, snow) {
      if (!ctx || !rainGain) return;
      const t = ctx.currentTime;
      rainGain.gain.setTargetAtTime(0.12 * rain, t, 0.3);
      windGain.gain.setTargetAtTime(0.18 * snow, t, 0.3);
    },

    near(combo) {
      if (!ok()) return;
      const f = 880 * Math.pow(1.122, Math.min(combo - 1, 10));
      tone('triangle', f, f * 1.5, 0.12, 0.13);
      noise('bandpass', 1200, 3000, 0.2, 0.12, { q: 1.2, attack: 0.02 });
    },

    mission() {
      if (!ok()) return;
      [659, 784, 988, 1319].forEach((f, i) => tone('square', f, 0, 0.1, 0.06, i * 0.08));
      tone('triangle', 1319, 0, 0.4, 0.12, 0.32);
    },

    eventSting() {
      if (!ok()) return;
      [392, 466, 554, 740].forEach((f, i) => tone('sawtooth', f, 0, 0.14, 0.05, i * 0.09));
      tone('sine', 1480, 740, 0.6, 0.08, 0.36);
    },

    bell(vol) {
      if (!ok()) return;
      tone('triangle', 1760, 0, 0.22, 0.12 * vol);
      tone('sine', 2637, 0, 0.18, 0.05 * vol);
    },

    trainHorn(pan, vol) {
      if (!ok()) return;
      for (const f of [311, 370, 466]) tone('sawtooth', f, f * 0.98, 1.1, 0.045 * vol, 0, pan);
      noise('lowpass', 500, 120, 1.8, 0.35 * vol, { pan, attack: 0.2 });
    },

    siren(pan) {
      if (!ok()) return;
      tone('triangle', 740, 1100, 0.42, 0.06, 0, pan);
      tone('triangle', 1100, 740, 0.42, 0.06, 0.44, pan);
    },

    splash(vol = 0.6) {
      if (!ok()) return;
      noise('bandpass', 1400, 300, 0.4, 0.5 * vol, { q: 0.8 });
      tone('sine', 300, 90, 0.2, 0.15 * vol);
    },

    screech() {
      if (!ok()) return;
      tone('sawtooth', 1900, 1500, 0.6, 0.035);
      noise('bandpass', 2600, 1800, 0.6, 0.25, { q: 6 });
    },

    ufo() {
      if (!ok()) return;
      for (let i = 0; i < 4; i++) tone('sine', 420 + i * 60, 900 - i * 80, 0.35, 0.05, i * 0.18);
    },

    laser() {
      if (!ok()) return;
      tone('sawtooth', 1800, 180, 0.3, 0.08);
      tone('square', 900, 90, 0.25, 0.04, 0.02);
    },

    whistle() {
      if (!ok()) return;
      tone('sine', 1800, 400, 1.6, 0.05);
    },

    stomp(vol) {
      if (!ok()) return;
      tone('sine', 70, 30, 0.35, 0.6 * vol);
      noise('lowpass', 400, 60, 0.3, 0.4 * vol);
    },

    cluck() {
      if (!ok()) return;
      tone('square', 330, 220, 0.12, 0.08);
      tone('square', 300, 200, 0.14, 0.08, 0.16);
    },

    honk() {
      if (!ok()) return;
      tone('sawtooth', 260, 230, 0.3, 0.08);
      tone('square', 390, 350, 0.3, 0.04);
    },

    moon() {
      if (!ok()) return;
      for (const [f, d] of [[220, 0], [330, 0.2], [440, 0.4]]) tone('sine', f, f * 1.01, 1.6, 0.06, d);
    },

    // ambulance: slow two-tone wail; fire truck: lower, with an air horn blast
    wail(pan, fire) {
      if (!ok()) return;
      const [a, b] = fire ? [520, 700] : [960, 760];
      tone('sawtooth', a, b, 0.5, 0.035, 0, pan);
      tone('sine', a, b, 0.5, 0.05, 0, pan);
      if (fire && Math.random() < 0.25) { tone('sawtooth', 180, 170, 0.5, 0.06, 0.55, pan); tone('square', 240, 230, 0.5, 0.04, 0.55, pan); }
    },

    honk2(pan) { // an annoyed driver stuck behind a cow
      if (!ok()) return;
      tone('square', 330, 0, 0.12, 0.04, 0, pan);
      tone('square', 415, 0, 0.12, 0.035, 0, pan);
    },

    moo(hurt) {
      if (!ok()) return;
      const t = hurt ? 1.3 : 1;
      tone('sawtooth', 150 * t, 110 * t, 0.7, 0.05);
      tone('sine', 150 * t, 105 * t, 0.7, 0.08);
      noise('bandpass', 500, 300, 0.6, 0.04, { q: 2 });
    },

    beep(pan) { // excavator backing up
      if (!ok()) return;
      tone('square', 1100, 0, 0.14, 0.035, 0, pan);
    },

    tramBell(vol, ding) {
      if (!ok()) return;
      tone('triangle', 1318, 0, 0.35, 0.1 * vol);
      tone('sine', 2637, 0, 0.25, 0.04 * vol);
      if (ding) { tone('triangle', 1318, 0, 0.35, 0.1 * vol, 0.22); tone('sine', 2637, 0, 0.25, 0.04 * vol, 0.22); }
    },

    slide() {
      if (!ok()) return;
      noise('highpass', 3000, 5000, 0.18, 0.08, { attack: 0.02 });
    },

    trophy() {
      if (!ok()) return;
      [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.13, i * 0.08));
      tone('sine', 1568, 2093, 0.4, 0.06, 0.34);
    },

    tick(urgent) {
      if (!ok()) return;
      tone('square', urgent ? 1320 : 880, 0, 0.05, 0.05);
    },

    whistleEnd() { // time's up
      if (!ok()) return;
      tone('square', 1760, 1740, 0.5, 0.06);
      tone('square', 1320, 1300, 0.5, 0.05, 0.05);
    },

    thunder(vol) {
      if (!ok()) return;
      noise('lowpass', 2400, 80, 1.6, 0.7 * vol, { attack: 0.005 });
      noise('lowpass', 300, 60, 2.2, 0.5 * vol, { delay: 0.12, attack: 0.08 });
      tone('sine', 55, 32, 1.4, 0.3 * vol, 0.05);
    },

    rumble(vol) { // tornado
      if (!ok()) return;
      noise('bandpass', 180, 120, 0.7, 0.3 * vol, { q: 0.7, attack: 0.2 });
      noise('highpass', 1800, 2400, 0.6, 0.06 * vol, { attack: 0.2 });
    },

    squawk() {
      if (!ok()) return;
      tone('sawtooth', 1250, 900, 0.14, 0.035);
      tone('sawtooth', 1150, 780, 0.16, 0.03, 0.17);
    },

    levelUp() {
      if (!ok()) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, 0, 0.2, 0.13, i * 0.07));
      tone('sine', 1319, 2637, 0.5, 0.06, 0.36);
    },

    growl(k) { // Big J getting angrier
      if (!ok()) return;
      tone('sawtooth', 90 + 60 * k, 60 + 40 * k, 0.25, 0.05 + 0.05 * k);
      noise('lowpass', 500, 200, 0.2, 0.08 + 0.1 * k);
    },

    rageStomp() {
      if (!ok()) return;
      tone('sine', 55, 22, 0.8, 0.8);
      tone('square', 110, 40, 0.3, 0.12);
      noise('lowpass', 900, 50, 0.7, 0.7);
      noise('highpass', 3000, 800, 0.25, 0.12, { delay: 0.02 });
    },

    crack() { // the egg is about to hatch
      if (!ok()) return;
      noise('highpass', 5000, 2500, 0.05, 0.2);
      tone('square', 1500, 800, 0.04, 0.03, 0.03);
    },

    hatch() {
      if (!ok()) return;
      noise('highpass', 6000, 2000, 0.12, 0.25);
      [659, 784, 988, 1319, 1568].forEach((f, i) => tone('triangle', f, 0, 0.22, 0.13, 0.1 + i * 0.08));
      tone('sine', 1568, 3136, 0.6, 0.06, 0.5);
    },

    fire(pan = 0) { // dragon breath
      if (!ok()) return;
      noise('bandpass', 900, 300, 0.5, 0.35, { q: 0.6, attack: 0.03, pan });
      noise('lowpass', 400, 120, 0.4, 0.2, { pan });
    },

    rebirth() { // the phoenix brings you back
      if (!ok()) return;
      noise('bandpass', 400, 2400, 0.8, 0.25, { q: 0.8, attack: 0.1 });
      [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f * 1.5, 0.3, 0.1, 0.25 + i * 0.07));
    },

    timeStop(on) {
      if (!ok()) return;
      if (on) { tone('sine', 900, 120, 0.6, 0.12); noise('lowpass', 1200, 200, 0.6, 0.15); }
      else { tone('sine', 120, 900, 0.4, 0.1); }
    },

    boing() {
      if (!ok()) return;
      tone('sine', 180, 520, 0.18, 0.12);
      tone('triangle', 260, 640, 0.14, 0.05, 0.03);
    },

    bubble() {
      if (!ok()) return;
      tone('sine', 500, 1100, 0.12, 0.08);
    },

    croak() { // swamp frogs
      if (!ok()) return;
      tone('square', 140, 110, 0.12, 0.035, 0, rand(-0.6, 0.6));
      tone('square', 150, 100, 0.12, 0.03, 0.15, rand(-0.6, 0.6));
    },

    fever(on) { // combo fever
      if (!ok()) return;
      if (on) [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, 0, 0.14, 0.11, i * 0.05));
      else tone('sine', 660, 330, 0.3, 0.08);
    },

    calm() { // Big S stops traffic
      if (!ok()) return;
      tone('sine', 220, 220, 1.2, 0.12);
      tone('sine', 330, 330, 1.2, 0.08, 0.05);
      tone('sine', 440, 440, 1.0, 0.05, 0.1);
    },

    cash() { // roadside stand
      if (!ok()) return;
      tone('square', 1200, 1200, 0.05, 0.05);
      tone('triangle', 1600, 2000, 0.25, 0.1, 0.06);
    },

    flip() { // reverse day starts or ends
      if (!ok()) return;
      tone('sine', 300, 1200, 0.35, 0.12);
      tone('sine', 1200, 300, 0.35, 0.08, 0.3);
      noise('bandpass', 800, 3000, 0.5, 0.12, { q: 1, attack: 0.1 });
    },

    thud(vol = 1, pan = 0) { // your car hits a chicken
      if (!ok()) return;
      tone('sine', 160, 60, 0.18, 0.4 * vol, 0, pan);
      noise('lowpass', 900, 200, 0.15, 0.3 * vol, { pan });
    },

    dodge(k) { // a chicken made it across
      if (!ok()) return;
      tone('triangle', 700 + k * 60, 1100 + k * 80, 0.08, 0.08);
    },

    gameOver() {
      if (!ok()) return;
      [523, 440, 349, 262].forEach((f, i) => tone('triangle', f, 0, 0.24, 0.14, 0.16 * i));
    },
  };
})();
