'use strict';
// Share codes for custom shifts: a whole setup in about 25 letters and digits, like
// TC1-7KQ2-M9XA-3TRB-QQ4F-ZN8, to send to a friend.
//
// Every setting is a choice from a short list or a step on a slider, so a setup is just
// those positions, packed into one big number and written in Crockford's base 32 (no
// I, L, O or U to mix up; typing them anyway reads as 1 and 0). Two check characters on
// the end catch typos.
//
// The field list below IS the version 1 format: never reorder or change it. A new
// setting means a "TC2" code, and a decoder that still reads TC1.

const TC_SHARE_B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const tcShareSteps = (lo, hi, step) => {
  const out = [];
  for (let i = 0; lo + i * step <= hi + 1e-9; i++) out.push(Math.round((lo + i * step) * 100) / 100);
  return out;
};

const TC_SHARE_V1 = [
  ['layout', ['1', '2', '3', 'row4', 'col2', '4', 'g23', 'g33']],
  ['spacing', [0.8, 1, 1.25]],
  ['look', ['main', 'downtown', 'rail']],
  ['autoMode', ['smart', 'timer']],
  ['autoGreen', tcShareSteps(4, 20, 1)],
  ['rate', tcShareSteps(10, 120, 2)],
  ['speed', tcShareSteps(0.5, 1.8, 0.1)],
  ['turn', tcShareSteps(0, 60, 5)],
  ['reckless', tcShareSteps(0, 30, 1)],
  ['patience', tcShareSteps(5, 40, 1)],
  ['rush', [false, true]],
  ['mix.cars', [0, 1, 2, 3]],
  ['mix.vans', [0, 1, 2, 3]],
  ['mix.taxis', [0, 1, 2, 3]],
  ['mix.big', [0, 1, 2, 3]],
  ['mix.sports', [0, 1, 2, 3]],
  ['mix.lux', [0, 1, 2, 3]],
  ['mix.police', [0, 1, 2, 3]],
  ['mix.farm', [0, 1, 2, 3]],
  ['mix.medic', [0, 1, 2, 3]],
  ['weather', ['clear', 'rain', 'snow', 'fog']],
  ['time', ['day', 'dusk', 'night']],
  ['train', [false, true]],
  ['trainEvery', tcShareSteps(15, 60, 1)],
  ['goal', tcShareSteps(0, 300, 5)],
  ['strikes', tcShareSteps(0, 10, 1)],
  ['limit', [0, 60, 120, 180, 300, 600]],
  ['amber', tcShareSteps(0.6, 2.5, 0.1)],
  ['powers', [0, 1, 2]],
];
const TC_SHARE_SHAPES = ['4', 'TN', 'TS']; // then, for each crossing: its shape and whether it's automatic

const tcShareGet = (o, key) => (key.startsWith('mix.') ? o.mix[key.slice(4)] : o[key]);
const tcShareSame = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b);

// Two characters from a hash of the code (FNV-1a), so a mistyped character shows.
function tcShareCheck(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return TC_SHARE_B32[h & 31] + TC_SHARE_B32[(h >>> 5) & 31];
}

// A setup (cleaned first, so it's always on the lists) as its share code.
function tcShareEncode(setup) {
  const o = tcCustomClean(setup), digits = [];
  for (const [key, list] of TC_SHARE_V1) digits.push([Math.max(0, list.findIndex(v => tcShareSame(v, tcShareGet(o, key)))), list.length]);
  for (let i = 0; i < tcLayoutSize(o.layout); i++) {
    digits.push([Math.max(0, TC_SHARE_SHAPES.indexOf(o.shapes[i])), TC_SHARE_SHAPES.length]);
    digits.push([o.autos[i] ? 1 : 0, 2]);
  }
  let n = 0n; // mixed radix, the first field in the lowest place
  for (let i = digits.length - 1; i >= 0; i--) n = n * BigInt(digits[i][1]) + BigInt(digits[i][0]);
  let body = '';
  do { body = TC_SHARE_B32[Number(n % 32n)] + body; n /= 32n; } while (n > 0n);
  const all = body + tcShareCheck('TC1' + body);
  return 'TC1-' + all.match(/.{1,4}/g).join('-');
}

// The letters and digits after "TC1" (check characters on the end) back into a setup, or
// null if they don't add up.
function tcShareUnpack(chars) {
  const flat = chars.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (flat.length < 3 || flat.length > 40 || [...flat].some(c => !TC_SHARE_B32.includes(c))) return null;
  const body = flat.slice(0, -2);
  if (tcShareCheck('TC1' + body) !== flat.slice(-2)) return null;
  let n = 0n;
  for (const c of body) n = n * 32n + BigInt(TC_SHARE_B32.indexOf(c));
  const take = size => { const d = Number(n % BigInt(size)); n /= BigInt(size); return d; };
  const o = { mix: {}, shapes: [], autos: [] };
  for (const [key, list] of TC_SHARE_V1) {
    const v = list[take(list.length)];
    if (key.startsWith('mix.')) o.mix[key.slice(4)] = v; else o[key] = v;
  }
  for (let i = 0; i < tcLayoutSize(o.layout); i++) {
    o.shapes.push(TC_SHARE_SHAPES[take(TC_SHARE_SHAPES.length)]);
    o.autos.push(take(2));
  }
  return n === 0n ? tcCustomClean(o) : null; // anything left over: more digits than a setup has
}

// A pasted code back into a setup: { ok: true, setup } or { ok: false, error: 'not-code' |
// 'typo' }. Lower case, spaces for dashes, and a whole chat message around it are fine.
function tcShareDecode(text) {
  const s = String(text || '').slice(0, 2000), tags = [...s.matchAll(/T[\s-]*C[\s-]*[1IL]/gi)];
  if (!tags.length) return { ok: false, error: 'not-code' };
  for (const m of tags) {
    const rest = s.slice(m.index + m[0].length), tries = [];
    // first, the code exactly as it's copied: dashes between the groups, nothing else
    const exact = /^-([0-9A-Z]{1,4}(?:-[0-9A-Z]{1,4})*)(?![0-9A-Z-])/i.exec(rest);
    if (exact) tries.push(exact[1]);
    // then typed out, or broken over lines: the words that follow, longest first
    const loose = /^[\s-]*([0-9A-Z][0-9A-Z\s-]*)/i.exec(rest);
    if (loose) {
      const words = loose[1].trim().split(/\s+/);
      for (let j = words.length; j > 0; j--) tries.push(words.slice(0, j).join(''));
    }
    for (const t of tries) { const setup = tcShareUnpack(t); if (setup) return { ok: true, setup }; }
  }
  return { ok: false, error: 'typo' };
}
