'use strict';
// Traffic Control: maps, levels, trophies and the shop.

const TC_STORE = makeStore('traffic.');

// Three crossroads. Rail Crossing adds a railway across the east road.
const TC_MAPS = {
  main:     { name: 'Main Street',   biome: 'town', scenery: 'town', rail: false },
  downtown: { name: 'Downtown',      biome: 'city', scenery: 'city', rail: false },
  rail:     { name: 'Rail Crossing', biome: 'farm', scenery: 'farm', rail: true },
};

// Car mixes
const MIX_EASY = [['sedan', 5], ['small', 4], ['van', 1.5], ['pickup', 1.5]];
const MIX_BIG = [['sedan', 4], ['small', 3], ['van', 2], ['pickup', 2], ['bus', 1.2], ['tanker', 0.6], ...luxMix(0.05)];
const MIX_CITY = [['sedan', 4], ['small', 3], ['taxi', 3], ['van', 1.5], ['bus', 1], ['sports', 1], ['police', 0.4], ...luxMix(0.14)];
const MIX_FARM = [['pickup', 3], ['sedan', 3], ['small', 2], ['van', 1.5], ['tanker', 0.8], ['bus', 0.6]];

// rate: cars per second across all roads. turn: chance a car turns.
// patience: seconds a driver waits before honking. ways: roads in use.
const TC_LEVELS = [
  { map: 'main', name: 'First Day', goal: 12, rate: 0.3, ways: ['E', 'S'], mix: MIX_EASY, patience: 14,
    tip: 'Tap a traffic light (or use the arrow keys) to switch it. Don\'t let two roads go at once!' },
  { map: 'main', name: 'Four Ways', goal: 16, rate: 0.36, mix: MIX_EASY, patience: 13,
    tip: 'Space switches every light at once, with a safe pause in between.' },
  { map: 'main', name: 'Big Wheels', goal: 18, rate: 0.38, mix: MIX_BIG, patience: 12,
    tip: 'Buses and tankers are slow to clear the crossing. Give them time.' },
  { map: 'main', name: 'Picking Up', goal: 22, rate: 0.46, speed: 1.1, mix: MIX_EASY, patience: 12 },
  { map: 'main', name: 'Sirens', goal: 22, rate: 0.46, mix: MIX_BIG, ambulance: 0.08, patience: 12,
    tip: 'Ambulances hate waiting. Get them a green light fast for bonus coins.' },

  { map: 'downtown', name: 'Turning Point', goal: 18, rate: 0.36, turn: 0.22, mix: MIX_CITY, patience: 12,
    tip: 'Cars with an arrow are turning. A car turning left cuts across the traffic coming the other way, so let each side go on its own.' },
  { map: 'downtown', name: 'Taxi Town', goal: 22, rate: 0.46, turn: 0.3, speed: 1.1, mix: MIX_CITY, patience: 11 },
  { map: 'downtown', name: 'Reckless', goal: 22, rate: 0.46, turn: 0.25, reckless: 0.08, mix: MIX_CITY, patience: 11,
    tip: 'Drivers with a red warning sign ignore red lights. Clear the way for them.' },
  { map: 'downtown', name: 'Downpour', goal: 24, rate: 0.48, turn: 0.25, rain: true, mix: MIX_CITY, ambulance: 0.05, patience: 11,
    tip: 'Wet roads: cars need longer to stop.' },
  { map: 'downtown', name: 'Night Shift', goal: 24, rate: 0.5, turn: 0.3, night: true, reckless: 0.05, ambulance: 0.05, mix: MIX_CITY, patience: 11 },

  { map: 'rail', name: 'Level Crossing', goal: 18, rate: 0.36, train: 32, mix: MIX_FARM, patience: 12,
    tip: 'When the bells ring a train is coming. Don\'t leave a car stuck on the tracks!' },
  { map: 'rail', name: 'Freight', goal: 22, rate: 0.42, train: 24, mix: MIX_FARM, patience: 12 },
  { map: 'rail', name: 'Rush Hour', goal: 28, rate: 0.46, turn: 0.2, train: 30, rush: true, mix: MIX_FARM, patience: 11,
    tip: 'Rush hour comes in waves. Hang on!' },
  { map: 'rail', name: 'Stormy Night', goal: 26, rate: 0.46, turn: 0.2, train: 28, rain: true, night: true, ambulance: 0.05, mix: MIX_FARM, patience: 11 },
  { map: 'rail', name: 'Total Chaos', goal: 32, rate: 0.54, turn: 0.3, train: 26, rush: true, reckless: 0.06, ambulance: 0.06, speed: 1.1, mix: MIX_BIG, patience: 10 },
];
TC_LEVELS.forEach((L, i) => { L.n = i + 1; });

// Endless Rush Hour starts gentle and keeps getting busier.
function tcEndlessLevel(cars) {
  return {
    map: 'rail', name: 'Endless Rush Hour', goal: Infinity, endless: true,
    rate: 0.32 + Math.min(0.42, cars * 0.0035),
    turn: cars > 20 ? 0.25 : 0,
    reckless: cars > 60 ? 0.05 : 0,
    ambulance: cars > 12 ? 0.05 : 0,
    train: cars > 35 ? 30 : 0,
    rush: cars > 30,
    speed: 1 + Math.min(0.2, cars * 0.002),
    mix: cars > 40 ? MIX_BIG : MIX_FARM,
    patience: Math.max(9, 12 - cars * 0.02),
  };
}

// ---- Custom shifts ----------------------------------------------------------------
// Where the crossings go (world units, before the block size). Avenues are rows
// (east-west), streets are columns; crossings are numbered along the bottom row
// first, left to right.
const TC_LAYOUTS = {
  1:    { name: '1 crossing', short: '1', rows: [0], cols: [0] },
  2:    { name: '2 crossings', short: '2', rows: [0], cols: [-160, 160] },
  3:    { name: '3 in a row', short: '3', rows: [0], cols: [-320, 0, 320] },
  row4: { name: '4 in a row', short: '4', rows: [0], cols: [-480, -160, 160, 480] },
  col2: { name: '2 stacked', short: '2 up', rows: [-150, 150], cols: [0] },
  4:    { name: '2×2 grid', short: '2×2', rows: [-150, 150], cols: [-170, 170] },
  g23:  { name: '2×3 grid', short: '2×3', rows: [-150, 150], cols: [-320, 0, 320] },
  g33:  { name: '3×3 grid', short: '3×3', rows: [-300, 0, 300], cols: [-320, 0, 320] },
};
const TC_LAYOUT_ORDER = ['1', '2', '3', 'row4', 'col2', '4', 'g23', 'g33'];
const tcLayoutSize = id => TC_LAYOUTS[id].rows.length * TC_LAYOUTS[id].cols.length;
// Crossing shapes: '4' has four roads; 'TN' has none to the north, 'TS' none to
// the south (a T only fits where the street would run off the edge of the grid).
const TC_SHAPE_NAMES = { 4: '4-way', TN: 'T: no north', TS: 'T: no south' };
function tcShapesAllowed(layout, i) {
  const L = TC_LAYOUTS[layout], r = Math.floor(i / L.cols.length), out = ['4'];
  if (r === L.rows.length - 1) out.push('TN');
  if (r === 0) out.push('TS');
  return out;
}

// The vehicle groups you can dial up and down (0 none, 1 a few, 2 some, 3 lots).
const TC_MIX_GROUPS = {
  cars:   { name: 'Everyday cars', w: [0, 2, 5, 9], types: [['sedan', 0.55], ['small', 0.45]] },
  vans:   { name: 'Vans and pickups', w: [0, 1, 2.5, 5], types: [['van', 0.5], ['pickup', 0.5]] },
  taxis:  { name: 'Taxis', w: [0, 1, 3, 6], types: [['taxi', 1]] },
  big:    { name: 'Buses and tankers', sub: 'Slow to clear a crossing', w: [0, 0.6, 1.8, 4], types: [['bus', 0.65], ['tanker', 0.35]] },
  sports: { name: 'Sports cars', w: [0, 0.5, 1.5, 4], types: [['sports', 1]] },
  lux:    { name: 'Supercars', sub: 'Elfers, Toros, Rossos and more', w: [0, 0.6, 2, 5], types: null },
  police: { name: 'Police cars', w: [0, 0.3, 1, 2.5], types: [['police', 1]] },
  farm:   { name: 'Tractors and log trucks', w: [0, 0.4, 1.2, 3], types: [['tractor', 0.5], ['logtruck', 0.5]] },
  medic:  { name: 'Ambulances and fire trucks', sub: 'In a hurry: quick greens pay a bonus', w: [0, 0.04, 0.08, 0.15] },
};
const TC_MIX_LEVELS = [[0, 'None'], [1, 'Few'], [2, 'Some'], [3, 'Lots']];

const TC_CUSTOM_DEFAULT = {
  v: 2,
  layout: '2', spacing: 1, look: 'main', shapes: [], autos: [], autoMode: 'smart', autoGreen: 10,
  rate: 24, speed: 1, turn: 25, reckless: 0, patience: 12, rush: false,
  mix: { cars: 2, vans: 1, taxis: 0, big: 1, sports: 0, lux: 0, police: 0, farm: 0, medic: 0 },
  weather: 'clear', time: 'day', train: false, trainEvery: 28,
  goal: 0, strikes: 3, limit: 0, amber: 1.1, powers: 1,
};
const TC_CUSTOM_OPTS = {
  layout: TC_LAYOUT_ORDER.map(k => [k, TC_LAYOUTS[k].short]),
  spacing: [[0.8, 'Short'], [1, 'Normal'], [1.25, 'Long']],
  look: [['main', 'Main Street'], ['downtown', 'Downtown'], ['rail', 'Countryside']],
  autoMode: [['smart', 'Smart'], ['timer', 'Timer']],
  weather: [['clear', 'Clear'], ['rain', 'Rain'], ['snow', 'Snow'], ['fog', 'Fog']],
  time: [['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']],
  limit: [[0, 'Off'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']],
  powers: [[0, 'Off'], [1, 'Normal'], [2, 'Lots']],
};
// Sliders: [min, max, step]
const TC_CUSTOM_RANGES = {
  autoGreen: [4, 20, 1], rate: [10, 120, 2], speed: [0.5, 1.8, 0.1], turn: [0, 60, 5], reckless: [0, 30, 1],
  patience: [5, 40, 1], trainEvery: [15, 60, 1], goal: [0, 300, 5], strikes: [0, 10, 1], amber: [0.6, 2.5, 0.1],
};

// Anything odd (old saves, hand-edited storage) falls back to the defaults, and
// the per-crossing lists always match the layout.
function tcCustomClean(src) {
  const D = TC_CUSTOM_DEFAULT, o = Object.assign({}, D, src || {}, { v: 2 });
  for (const k in TC_CUSTOM_OPTS) if (!TC_CUSTOM_OPTS[k].some(([v]) => v === o[k])) o[k] = D[k];
  for (const k in TC_CUSTOM_RANGES) {
    const [lo, hi, step] = TC_CUSTOM_RANGES[k], n = Number(o[k]);
    o[k] = Number.isFinite(n) ? clamp(Math.round((n - lo) / step) * step + lo, lo, hi) : D[k];
    o[k] = Math.round(o[k] * 100) / 100;
  }
  const mix = {};
  for (const g in TC_MIX_GROUPS) { const n = o.mix && o.mix[g]; mix[g] = [0, 1, 2, 3].includes(n) ? n : D.mix[g]; }
  o.mix = mix;
  const n = tcLayoutSize(o.layout), shapes = [], autos = [];
  for (let i = 0; i < n; i++) {
    const sh = Array.isArray(o.shapes) ? o.shapes[i] : '4';
    shapes.push(tcShapesAllowed(o.layout, i).includes(sh) ? sh : '4');
    autos.push(Array.isArray(o.autos) && o.autos[i] ? 1 : 0);
  }
  o.shapes = shapes;
  o.autos = autos;
  o.train = !!o.train;
  o.rush = !!o.rush;
  return o;
}

// Settings saved before the crossing editor (crossings + a shape preset + how many automatic).
function tcCustomMigrate(old) {
  const n = [1, 2, 3, 4].includes(old.crossings) ? old.crossings : 2;
  const SHAPES = {
    4:     { 1: ['4'], 2: ['4', '4'], 3: ['4', '4', '4'], 4: ['4', '4', '4', '4'] },
    T:     { 1: ['TN'], 2: ['TN', 'TS'], 3: ['TN', 'TS', 'TN'], 4: ['4', 'TS', 'TN', '4'] },
    mixed: { 1: ['TS'], 2: ['4', 'TN'], 3: ['TS', '4', 'TN'], 4: ['4', 'TS', '4', '4'] },
  };
  const ORDER = { 1: [0], 2: [1, 0], 3: [2, 0, 1], 4: [3, 0, 1, 2] }, autos = [];
  for (let i = 0; i < Math.min(old.auto | 0, n); i++) autos[ORDER[n][i]] = 1;
  return tcCustomClean({
    layout: String(n), shapes: (SHAPES[old.shape] || SHAPES[4])[n], autos, look: old.look,
    rate: old.rate, speed: old.speed, turn: [0, 25, 50][old.turn], reckless: [0, 5, 14][old.reckless], patience: [18, 12, 8][old.patience],
    mix: { cars: 2, vans: 1, taxis: old.look === 'downtown' ? 2 : 0, big: old.big === false ? 0 : 1, sports: old.look === 'downtown' ? 1 : 0, lux: old.lux ? 2 : 0, police: 0, farm: 0, medic: old.medic ? 2 : 0 },
    weather: old.rain ? 'rain' : 'clear', time: old.night ? 'night' : 'day', train: old.train, rush: old.rush,
    goal: old.goal, strikes: old.strikes,
  });
}

function tcCustomLevel(o) {
  const L = TC_LAYOUTS[o.layout], n = tcLayoutSize(o.layout), sp = o.spacing, mix = [];
  for (const g in TC_MIX_GROUPS) {
    const G = TC_MIX_GROUPS[g], w = G.w[o.mix[g]];
    if (!w || g === 'medic') continue;
    const types = G.types || Object.keys(LUX_TYPES).map(k => [k, 1 / Object.keys(LUX_TYPES).length]);
    for (const [t, k] of types) mix.push([t, w * k]);
  }
  if (!mix.length) mix.push(['sedan', 5], ['small', 4]);
  const rail = !!o.train && n === 1, snow = o.weather === 'snow', fog = o.weather === 'fog';
  return {
    custom: true, map: o.look, name: 'Custom Shift', goal: o.goal || Infinity, endless: !o.goal,
    layout: o.layout, grid: { rows: L.rows.map(y => y * sp), cols: L.cols.map(x => x * sp) },
    shapes: o.shapes.slice(0, n), auto: o.autos.slice(0, n).map(Boolean),
    timer: o.autoMode === 'timer' ? o.autoGreen : 0, autoMax: o.autoGreen,
    rate: o.rate / 60, speed: o.speed * (snow ? 0.85 : fog ? 0.9 : 1), turn: o.turn / 100, reckless: o.reckless / 100,
    ambulance: TC_MIX_GROUPS.medic.w[o.mix.medic], rail, train: rail ? o.trainEvery : 0,
    rain: o.weather === 'rain', snow, fog, dusk: o.time === 'dusk', night: o.time === 'night',
    rush: o.rush, mix, patience: o.patience,
  };
}

// Coins per car for a custom shift: the harder the settings, the more it pays
// (a crossing that runs itself pays nothing).
function tcCustomPay(o) {
  const n = tcLayoutSize(o.layout), manual = n - o.autos.slice(0, n).filter(Boolean).length;
  if (!manual) return 0;
  let k = 0.8 * clamp(o.rate / 28, 0.4, 2.6) * (0.6 + 0.4 * o.speed);
  k *= [1, 1.25, 1.45, 1.6, 1.72, 1.82, 1.9, 1.96, 2][manual - 1];
  k *= (1 + o.turn / 200) * (1 + o.reckless / 40) * clamp(1.2 - (o.patience - 8) / 50, 0.8, 1.2);
  k *= { clear: 1, rain: 1.1, snow: 1.18, fog: 1.12 }[o.weather] * { day: 1, dusk: 1.04, night: 1.08 }[o.time];
  if (o.amber < 1.1) k *= 1 + (1.1 - o.amber) * 0.25;
  if (o.spacing < 1) k *= 1.08;
  if (o.train && n === 1) k *= 1.1 + (60 - o.trainEvery) / 300;
  if (o.rush) k *= 1.1;
  k *= 1 + 0.03 * o.mix.big + 0.03 * o.mix.medic + 0.02 * o.mix.farm;
  k *= [1, 1, 0.85][o.powers] * (o.powers === 0 ? 1.15 : 1);
  k *= o.strikes === 0 ? 0.3 : [1.3, 1.3, 1.15, 1, 0.92, 0.8, 0.72, 0.66, 0.6, 0.55, 0.5][o.strikes];
  return Math.round(clamp(k, 0, 3) * 100) / 100;
}

// Ready-made ideas for the Presets tab.
const TC_CUSTOM_IDEAS = {
  sunday:  { name: 'Sunday Drive', desc: 'One quiet crossing in the sun', o: { layout: '1', rate: 14, turn: 10, patience: 20, mix: { cars: 3, vans: 1 }, goal: 30 } },
  blizzard: { name: 'Blizzard', desc: 'Two crossings, snow and dusk', o: { layout: '2', weather: 'snow', time: 'dusk', rate: 26, turn: 20, look: 'rail', mix: { cars: 2, vans: 2, farm: 1 }, goal: 50 } },
  bigcity: { name: 'Big City Nights', desc: 'A 2×3 grid, half of it automatic', o: { layout: 'g23', autos: [1, 0, 1, 0, 1, 0], look: 'downtown', time: 'night', rate: 50, turn: 30, mix: { cars: 2, taxis: 3, sports: 1, police: 1, lux: 1, medic: 1 }, goal: 100 } },
  gridlock: { name: 'Total Gridlock', desc: 'Nine crossings, all yours', o: { layout: 'g33', spacing: 0.8, rate: 70, turn: 30, reckless: 5, patience: 10, mix: { cars: 3, vans: 2, taxis: 1, big: 2, lux: 1, medic: 1 }, strikes: 5 } },
  railway: { name: 'Express Line', desc: 'A train every 15 seconds', o: { layout: '1', look: 'rail', train: true, trainEvery: 15, rate: 30, mix: { cars: 2, vans: 2, farm: 2 }, goal: 60 } },
  foggy:   { name: 'Pea Souper', desc: 'Thick fog on 4 in a row', o: { layout: 'row4', weather: 'fog', rate: 34, turn: 20, mix: { cars: 3, vans: 1, big: 1 }, goal: 80 } },
};

// An idea as a full setup (vehicle groups it doesn't name are off).
function tcCustomIdea(id) {
  const I = TC_CUSTOM_IDEAS[id], mix = {};
  for (const g in TC_MIX_GROUPS) mix[g] = 0;
  return tcCustomClean(Object.assign({}, I.o, { mix: Object.assign(mix, I.o.mix) }));
}

// One line about a setup (for the save slots).
function tcCustomSummary(o) {
  const bits = [TC_LAYOUTS[o.layout].name, `${o.rate} cars/min`];
  if (o.weather !== 'clear') bits.push(o.weather[0].toUpperCase() + o.weather.slice(1));
  if (o.time !== 'day') bits.push(o.time[0].toUpperCase() + o.time.slice(1));
  bits.push(o.goal ? `Goal ${o.goal}` : 'Endless');
  return bits.join(' · ');
}

// A random setup that's still playable.
function tcCustomRandom() {
  const r = (a, b, step = 1) => Math.round(rand(a, b) / step) * step;
  const layout = pick(TC_LAYOUT_ORDER), n = tcLayoutSize(layout);
  const o = {
    layout, spacing: pick([0.8, 1, 1, 1.25]), look: pick(['main', 'downtown', 'rail']),
    shapes: [], autos: [], autoMode: chance(0.7) ? 'smart' : 'timer', autoGreen: r(6, 14),
    rate: r(16, 18 + n * 8, 2), speed: r(0.8, 1.3, 0.1), turn: r(0, 45, 5), reckless: chance(0.4) ? r(2, 12) : 0, patience: r(8, 20),
    rush: chance(0.3), mix: {}, weather: pick(['clear', 'clear', 'rain', 'snow', 'fog']), time: pick(['day', 'day', 'dusk', 'night']),
    train: n === 1 && chance(0.4), trainEvery: r(20, 45), goal: chance(0.3) ? 0 : r(20, 120, 5), strikes: pick([3, 3, 5, 0]),
    limit: chance(0.25) ? pick([120, 180, 300]) : 0, amber: 1.1, powers: pick([1, 1, 2, 0]),
  };
  for (let i = 0; i < n; i++) { o.shapes.push(pick(tcShapesAllowed(layout, i))); o.autos.push(n > 2 && chance(0.3) ? 1 : 0); }
  for (const g in TC_MIX_GROUPS) o.mix[g] = g === 'cars' ? r(1, 3) : chance(0.45) ? r(1, 3) : 0;
  return tcCustomClean(o);
}
const TC_CUSTOM_UNLOCK = 5; // levels to clear first

// ---- Trophies -------------------------------------------------------------------
const TC_TROPHIES = {
  first:     { name: 'Green Light', desc: 'Clear your first level', coins: 50 },
  three:     { name: 'Perfect Shift', desc: 'Get 3 stars on a level', coins: 50 },
  main:      { name: 'Main Street', desc: 'Clear every Main Street level', coins: 100 },
  downtown:  { name: 'Downtown', desc: 'Clear every Downtown level', coins: 150 },
  rail:      { name: 'Rail Crossing', desc: 'Clear every Rail Crossing level', coins: 200 },
  allstars:  { name: 'Traffic Legend', desc: 'Get all 45 stars', coins: 500 },
  end50:     { name: 'Rush Hour', desc: 'Get 50 cars through in one Endless run', coins: 75 },
  end150:    { name: 'Gridlock Who?', desc: 'Get 150 cars through in one Endless run', coins: 200 },
  total1000: { name: 'Thousand Cars', desc: 'Get 1,000 cars through in total', coins: 150 },
  medic:     { name: 'Lights and Sirens', desc: 'Rush 10 ambulances through', coins: 100 },
  pileup:    { name: 'Pile-Up', desc: 'Wreck 3 cars in one pile-up', coins: 25 },
  powers:    { name: 'Tool Belt', desc: 'Use Freeze, Tow and Calm', coins: 50 },
  quiet:     { name: 'Nobody Honked', desc: 'Clear a level without a single honk', coins: 75 },
  train:     { name: 'Close Call', desc: 'A car clears the tracks just before the train', coins: 75 },
  custom:    { name: 'Town Planner', desc: 'Finish a custom shift with a goal', coins: 50 },
  grid:      { name: 'Gridmaster', desc: 'Get 50 cars through four or more crossings with no automatic lights', coins: 200 },
  wave:      { name: 'Ride the Wave', desc: 'Use a Green Wave', coins: 25 },
};

// ---- Shop -------------------------------------------------------------------------
const TC_UPGRADES = {
  patience: { name: 'Patient Drivers', desc: 'Drivers wait 15% longer before honking (per level)', cost: [300, 700, 1500] },
  strike:   { name: 'Fourth Strike', desc: 'You can survive one more crash in every run', cost: [1500] },
  start:    { name: 'Head Start', desc: 'Start every run holding a random power-up', cost: [800] },
  amber:    { name: 'Quick Amber', desc: 'Amber lights last 0.3 seconds less, so switching is quicker', cost: [900] },
  towing:   { name: 'Tow Service', desc: 'Wrecks get towed away sooner on their own (per level)', cost: [500, 1200] },
  fares:    { name: 'Bonus Fares', desc: '+10% coins from every shift (per level)', cost: [600, 1300, 2500] },
};

// Traffic light housings
const TC_LIGHTS = {
  classic: { name: 'Classic', price: 0, top: '#fcc21b', front: '#c99a10', body: '#2b2f36' },
  black:   { name: 'Midnight', price: 250, top: '#3a3d44', front: '#26282d', body: '#1c1e22' },
  retro:   { name: 'Retro Green', price: 250, top: '#3f7d4a', front: '#2c5a35', body: '#24432a' },
  neon:    { name: 'Neon', price: 600, top: '#ff4fe0', front: '#c22fae', body: '#2a1030', glow: true },
  gold:    { name: 'Solid Gold', price: 1200, top: '#ffd84a', front: '#c9a020', body: '#8a6a10', shine: true },
  chrome:  { name: 'Chrome', price: 800, top: '#eef1f5', front: '#a9b2bd', body: '#5d6672', pole: '#c9cfd7', shine: true },
  oldtown: { name: 'Old Town', price: 700, top: '#d6ab52', front: '#a37f30', body: '#5b3b22', pole: '#2f4a3a' },
  candy:   { name: 'Candy Cane', price: 900, top: '#ffffff', front: '#dcdcdc', body: '#d7263d', pole: '#f7f7f2', stripes: true },
};

// Themes repaint the ground and scenery on every map
const TC_THEMES = {
  auto:   { name: 'Map colours', price: 0 },
  desert: { name: 'Desert', price: 400 },
  snow:   { name: 'Snow', price: 400 },
  autumn: { name: 'Autumn', price: 400 },
  beach:  { name: 'Beach', price: 600 },
  neon:   { name: 'Neon Night', price: 900 },
};
// Ground and plant colours for the themes Road Rush's own biome table doesn't have
const TC_THEME_BIOMES = {
  beach: { name: 'Beach', ground: '#f0dca2', ground2: '#ead598', edge: '#cdb277', tree: ['#3fa34d', '#2e7f3a', '#52b85e', '#38914a'], bush: ['#6dae55', '#548d42', '#7fc063', '#619f4b'] },
  neon:  { name: 'Neon', ground: '#221d3a', ground2: '#262043', edge: '#151229', tree: ['#ff4fd8', '#b12f99', '#ff7fe6', '#d23cb8'], bush: ['#3fe0ff', '#1f9bb8', '#7ff0ff', '#2cbad8'] },
};

const TC_POWERS = {
  freeze: { name: 'Freeze', key: '1', desc: 'Stops every car for 3 seconds' },
  tow:    { name: 'Tow', key: '2', desc: 'Clears every wreck at once' },
  calm:   { name: 'Calm', key: '3', desc: 'Every driver gets their patience back' },
  wave:   { name: 'Green Wave', key: '4', desc: 'Every light runs itself safely for 10 seconds' },
};
