'use strict';
// Boom Run: modes, garage, paints, power-ups and trophies.

const BR_STORE = makeStore('boomrun.');

const BR_MODES = {
  endless:    { name: 'Endless', best: 'best', desc: 'How far can you go?' },
  checkpoint: { name: 'Checkpoint', best: 'bestcp', desc: 'Beat the clock to each checkpoint' },
  wrongway:   { name: 'Wrong Way', best: 'bestww', desc: 'Oncoming traffic. Double coins' },
};

// The garage. speed: top speed and pick-up. grip: how fast it steers.
// Perks: coins (coin multiplier), shield / shields (start with one; 2 = it comes
// back once), boostMul (boost fills faster), nearMul (close calls fill it faster),
// burnMul (boost burns slower), boomPlus (seconds more BOOM), siren.
const BR_CARS = {
  hatch:  { name: 'Hatchback', type: 'small', price: 0, speed: 1.0, grip: 1.1, color: '#ffb020', perk: 'Nippy and forgiving' },
  sedan:  { name: 'Sedan', type: 'sedan', price: 400, speed: 1.05, grip: 1.0, color: '#3a86ff', perk: 'A bit quicker all round' },
  taxi:   { name: 'Taxi', type: 'taxi', price: 900, speed: 1.06, grip: 1.05, color: '#ffc619', coins: 1.2, perk: '+20% coins' },
  pickup: { name: 'Pickup', type: 'pickup', price: 1400, speed: 1.0, grip: 0.95, color: '#e76f51', shield: true, perk: 'Starts every run with a shield' },
  sports: { name: 'Sports Car', type: 'sports', price: 2500, speed: 1.18, grip: 1.25, color: '#ff006e', perk: 'Fastest steering in the garage' },
  police: { name: 'Police Cruiser', type: 'police', price: 4000, speed: 1.14, grip: 1.15, color: '#20242c', siren: true, perk: 'Siren: traffic ahead pulls over sometimes' },
  tanker: { name: 'Fuel Tanker', type: 'tanker', price: 6000, speed: 0.95, grip: 0.8, color: '#dfe3e8', coins: 2, perk: 'Double coins. Goes up in a huge fireball' },
  // the luxury lot
  elfer:          { name: 'Elfer', type: 'elfer', price: 6500, speed: 1.2, grip: 1.42, color: '#d1202e', lux: true, perk: 'Best grip in the garage' },
  elferClassic:   { name: 'Elfer Classic', type: 'elferClassic', price: 7000, speed: 1.15, grip: 1.3, color: '#c8102e', lux: true, nearMul: 1.3, perk: 'Old-school nerve: close calls fill boost 30% faster' },
  rossoF8:        { name: 'Rosso F8', type: 'rossoF8', price: 8000, speed: 1.22, grip: 1.28, color: '#d40000', lux: true, boostMul: 1.3, perk: 'Boost fills 30% faster' },
  toroFuria:      { name: 'Toro Furia', type: 'toroFuria', price: 9000, speed: 1.24, grip: 1.3, color: '#7fd33a', lux: true, boomPlus: 2, perk: 'BOOM lasts 2 seconds longer' },
  gelande:        { name: 'Gelände', type: 'gelande', price: 9500, speed: 1.02, grip: 0.95, color: '#141518', lux: true, shield: true, shields: 2, perk: 'Starts with a shield that comes back once' },
  regent:         { name: 'Regent', type: 'regent', price: 10000, speed: 1.08, grip: 0.92, color: '#111216', lux: true, coins: 1.3, perk: '+30% coins, in comfort' },
  rossoSuperfast: { name: 'Rosso Superfast', type: 'rossoSuperfast', price: 11000, speed: 1.28, grip: 1.12, color: '#c8101e', lux: true, burnMul: 0.75, perk: 'Boost burns 25% slower' },
  toroV12:        { name: 'Toro V12', type: 'toroV12', price: 12500, speed: 1.32, grip: 1.15, color: '#ffcc12', lux: true, perk: 'A monster top speed' },
  veloce:         { name: 'Veloce', type: 'veloce', price: 15000, speed: 1.4, grip: 1.2, color: '#2a62c9', lux: true, boostMul: 1.15, perk: 'The fastest car there is' },
};

// Upgrades (levels, cost per level)
const BR_UPGRADES = {
  tank:   { name: 'Bigger Tank', desc: 'Boost fills 15% faster (per level)', cost: [400, 900, 1800] },
  fuse:   { name: 'Long Fuse', desc: 'BOOM lasts a second longer (per level)', cost: [600, 1400] },
  magnet: { name: 'Strong Magnet', desc: 'Magnets pull coins from 50% further away', cost: [700] },
};

const BR_PAINTS = {
  stock:  { name: 'Stock', price: 0, color: null },
  red:    { name: 'Fire Red', price: 150, color: '#e63946' },
  blue:   { name: 'Racing Blue', price: 150, color: '#1d4f91' },
  green:  { name: 'Lime', price: 150, color: '#7ed957' },
  purple: { name: 'Grape', price: 150, color: '#7b2cbf' },
  black:  { name: 'Midnight', price: 250, color: '#1b1b1f' },
  white:  { name: 'Pearl', price: 250, color: '#f4f1de' },
  pink:   { name: 'Bubblegum', price: 250, color: '#ff8fc8' },
  gold:   { name: 'Solid Gold', price: 1500, color: '#ffd84a' },
  matte:  { name: 'Matte Black', price: 400, color: '#2a2b2e' },
  sunset: { name: 'Sunset Orange', price: 400, color: '#ff6a1a' },
  candy:  { name: 'Candy Purple', price: 600, color: '#9b2fd1' },
  chrome: { name: 'Chrome', price: 2500, color: '#dfe3e8' },
};

// Road Rush draws power-up pickups from a POWERUPS table: these are Boom Run's.
const POWERUPS = {
  speed:  { name: 'Nitro', color: '#ffb319', dur: 5 },
  shield: { name: 'Shield', color: '#3d9bff', dur: 0 },
  magnet: { name: 'Magnet', color: '#ff4f6d', dur: 8 },
};
for (const k in POWERUPS) POWERUPS[k].dark = shade(POWERUPS[k].color, -0.3);

// Scenery changes as you go: the same biomes as Road Rush.
const BR_BIOMES = ['town', 'desert', 'snow', 'city', 'autumn', 'farm'];
const BR_SECTION = 2600; // world units per biome
const BR_WELCOME = { town: 'country', desert: 'desert', snow: 'snow', city: 'city', autumn: 'autumn', farm: 'farm' };

const BR_TROPHIES = {
  km1:     { name: 'On the Road', desc: 'Drive 1 km in one run', coins: 25 },
  km5:     { name: 'Long Haul', desc: 'Drive 5 km in one run', coins: 100 },
  km10:    { name: 'Cross Country', desc: 'Drive 10 km in one run', coins: 250 },
  combo10: { name: 'Hair Trigger', desc: 'Reach a x10 close-call combo', coins: 100 },
  near50:  { name: 'Threading the Needle', desc: '50 close calls in one run', coins: 100 },
  smash10: { name: 'Bowling', desc: 'Smash 10 cars in one run', coins: 100 },
  ramps5:  { name: 'Air Time', desc: 'Jump 5 ramps in one run', coins: 75 },
  coins100: { name: 'Pockets Full', desc: 'Pick up 100 coins in one run', coins: 100 },
  cp5:     { name: 'Beat the Clock', desc: 'Reach 5 checkpoints in one run', coins: 100 },
  ww2:     { name: 'Salmon', desc: 'Drive 2 km in Wrong Way', coins: 150 },
  garage:  { name: 'New Wheels', desc: 'Buy a car', coins: 25 },
  fleet:   { name: 'Fleet Owner', desc: 'Own every car in the garage', coins: 500 },
  chain5:  { name: 'Domino Effect', desc: 'Set off a chain of 5 cars', coins: 100 },
  boom10:  { name: 'Rampage', desc: 'Wreck 10 cars in one BOOM', coins: 150 },
  cones50: { name: 'Cone Crusher', desc: 'Smash 50 cones and barrels in one run', coins: 75 },
  razor10: { name: "Razor's Edge", desc: '10 razor-close calls in one run', coins: 100 },
  supercar: { name: 'Supercar Owner', desc: 'Buy a luxury car', coins: 100 },
};
