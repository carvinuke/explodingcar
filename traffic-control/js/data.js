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
const MIX_BIG = [['sedan', 4], ['small', 3], ['van', 2], ['pickup', 2], ['bus', 1.2], ['tanker', 0.6]];
const MIX_CITY = [['sedan', 4], ['small', 3], ['taxi', 3], ['van', 1.5], ['bus', 1], ['sports', 1], ['police', 0.4]];
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
};

// ---- Shop -------------------------------------------------------------------------
const TC_UPGRADES = {
  patience: { name: 'Patient Drivers', desc: 'Drivers wait 15% longer before honking (per level)', cost: [300, 700, 1500] },
  strike:   { name: 'Fourth Strike', desc: 'You can survive one more crash in every run', cost: [1500] },
  start:    { name: 'Head Start', desc: 'Start every run holding a random power-up', cost: [800] },
};

// Traffic light housings
const TC_LIGHTS = {
  classic: { name: 'Classic', price: 0, top: '#fcc21b', front: '#c99a10', body: '#2b2f36' },
  black:   { name: 'Midnight', price: 250, top: '#3a3d44', front: '#26282d', body: '#1c1e22' },
  retro:   { name: 'Retro Green', price: 250, top: '#3f7d4a', front: '#2c5a35', body: '#24432a' },
  neon:    { name: 'Neon', price: 600, top: '#ff4fe0', front: '#c22fae', body: '#2a1030', glow: true },
  gold:    { name: 'Solid Gold', price: 1200, top: '#ffd84a', front: '#c9a020', body: '#8a6a10', shine: true },
};

// Themes repaint the ground and scenery on every map
const TC_THEMES = {
  auto:   { name: 'Map colours', price: 0 },
  desert: { name: 'Desert', price: 400 },
  snow:   { name: 'Snow', price: 400 },
  autumn: { name: 'Autumn', price: 400 },
};

const TC_POWERS = {
  freeze: { name: 'Freeze', key: '1', desc: 'Stops every car for 3 seconds' },
  tow:    { name: 'Tow', key: '2', desc: 'Clears every wreck at once' },
  calm:   { name: 'Calm', key: '3', desc: 'Every driver gets their patience back' },
};
