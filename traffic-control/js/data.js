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
// Where the crossings go (world units). Avenues are rows (east-west), streets are columns.
const TC_LAYOUTS = {
  1: { rows: [0], cols: [0] },
  2: { rows: [0], cols: [-160, 160] },
  3: { rows: [0], cols: [-320, 0, 320] },
  4: { rows: [-150, 150], cols: [-170, 170] },
};
// Crossing shapes, one per crossing ('TN': no road to the north, 'TS': none to the south).
// Crossings are numbered along the bottom row first, left to right.
const TC_SHAPES = {
  '4':   { 1: ['4'], 2: ['4', '4'], 3: ['4', '4', '4'], 4: ['4', '4', '4', '4'] },
  T:     { 1: ['TN'], 2: ['TN', 'TS'], 3: ['TN', 'TS', 'TN'], 4: ['4', 'TS', 'TN', '4'] },
  mixed: { 1: ['TS'], 2: ['4', 'TN'], 3: ['TS', '4', 'TN'], 4: ['4', 'TS', '4', '4'] },
};
// Which crossings go automatic first (so you keep the middle ones).
const TC_AUTO_ORDER = { 1: [0], 2: [1, 0], 3: [2, 0, 1], 4: [3, 0, 1, 2] };

const TC_CUSTOM_DEFAULT = {
  goal: 0, crossings: 2, shape: '4', auto: 0, rate: 24, speed: 1, reckless: 0, turn: 1, patience: 1,
  big: true, medic: false, lux: false, train: false, rain: false, night: false, rush: false, strikes: 3, look: 'main',
};
const TC_CUSTOM_OPTS = {
  goal: [[10, '10'], [25, '25'], [50, '50'], [100, '100'], [0, 'Endless']],
  crossings: [[1, '1'], [2, '2'], [3, '3'], [4, '2×2']],
  shape: [['4', '4-way'], ['T', 'T-junction'], ['mixed', 'Mixed']],
  turn: [[0, 'None'], [1, 'Some'], [2, 'Lots']],
  reckless: [[0, 'None'], [1, 'A few'], [2, 'Lots']],
  patience: [[0, 'Relaxed'], [1, 'Normal'], [2, 'Short']],
  strikes: [[3, '3'], [5, '5'], [0, 'Unlimited']],
  look: [['main', 'Main Street'], ['downtown', 'Downtown'], ['rail', 'Countryside']],
};

function tcCustomLevel(o) {
  const n = o.crossings, mix = [['sedan', 5], ['small', 4], ['van', 1.5], ['pickup', 1.5]];
  if (o.look === 'downtown') mix.push(['taxi', 3], ['sports', 1], ['police', 0.4]);
  if (o.look === 'rail') mix.push(['pickup', 2]);
  if (o.big) mix.push(['bus', 1.2], ['tanker', 0.6]);
  if (o.lux) mix.push(...luxMix(0.4));
  const auto = [];
  for (let i = 0; i < Math.min(o.auto, n); i++) auto[TC_AUTO_ORDER[n][i]] = true;
  const rail = !!o.train && n === 1;
  return {
    custom: true, map: o.look, name: 'Custom Shift', goal: o.goal || Infinity, endless: !o.goal,
    layout: n, shapes: TC_SHAPES[o.shape][n], auto,
    rate: o.rate / 60, speed: o.speed, turn: [0, 0.25, 0.5][o.turn], reckless: [0, 0.05, 0.14][o.reckless],
    ambulance: o.medic ? 0.07 : 0, rail, train: rail ? 28 : 0,
    rain: !!o.rain, night: !!o.night, rush: !!o.rush, mix, patience: [18, 12, 8][o.patience],
  };
}

// Coins per car for a custom shift: the harder the settings, the more it pays
// (a crossing that runs itself pays nothing).
function tcCustomPay(o) {
  const manual = o.crossings - Math.min(o.auto, o.crossings);
  if (!manual) return 0;
  let k = 0.8 * clamp(o.rate / 28, 0.4, 2.2) * (0.6 + 0.4 * o.speed);
  k *= [1, 1.25, 1.45, 1.6][manual - 1];
  k *= [1, 1.12, 1.25][o.turn] * [1, 1.15, 1.35][o.reckless] * [0.85, 1, 1.2][o.patience];
  if (o.rain) k *= 1.1;
  if (o.night) k *= 1.08;
  if (o.train && o.crossings === 1) k *= 1.15;
  if (o.medic) k *= 1.05;
  if (o.rush) k *= 1.1;
  if (o.big) k *= 1.05;
  k *= o.strikes === 3 ? 1 : o.strikes === 5 ? 0.8 : 0.3;
  return Math.round(clamp(k, 0, 2.5) * 100) / 100;
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
  grid:      { name: 'Gridmaster', desc: 'Get 50 cars through four crossings with no automatic lights', coins: 200 },
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
