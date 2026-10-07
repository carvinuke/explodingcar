'use strict';
// Boom Run: modes, garage, paints, power-ups and trophies.

const BR_STORE = makeStore('boomrun.');

const BR_MODES = {
  endless:    { name: 'Endless', best: 'best', desc: 'How far can you go?' },
  checkpoint: { name: 'Checkpoint', best: 'bestcp', desc: 'Beat the clock to each checkpoint' },
  wrongway:   { name: 'Wrong Way', best: 'bestww', desc: 'Oncoming traffic. Double coins' },
};

// The garage. speed: top speed and pick-up. grip: how fast it steers.
const BR_CARS = {
  hatch:  { name: 'Hatchback', type: 'small', price: 0, speed: 1.0, grip: 1.1, color: '#ffb020', perk: 'Nippy and forgiving' },
  sedan:  { name: 'Sedan', type: 'sedan', price: 400, speed: 1.05, grip: 1.0, color: '#3a86ff', perk: 'A bit quicker all round' },
  taxi:   { name: 'Taxi', type: 'taxi', price: 900, speed: 1.06, grip: 1.05, color: '#ffc619', coins: 1.2, perk: '+20% coins' },
  pickup: { name: 'Pickup', type: 'pickup', price: 1400, speed: 1.0, grip: 0.95, color: '#e76f51', shield: true, perk: 'Starts every run with a shield' },
  sports: { name: 'Sports Car', type: 'sports', price: 2500, speed: 1.18, grip: 1.25, color: '#ff006e', perk: 'Fastest steering in the garage' },
  police: { name: 'Police Cruiser', type: 'police', price: 4000, speed: 1.14, grip: 1.15, color: '#20242c', siren: true, perk: 'Siren: traffic ahead pulls over sometimes' },
  tanker: { name: 'Fuel Tanker', type: 'tanker', price: 6000, speed: 0.95, grip: 0.8, color: '#dfe3e8', coins: 2, perk: 'Double coins. Goes up in a huge fireball' },
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
  smash10: { name: 'Bowling', desc: 'Smash 10 cars with Nitro in one run', coins: 100 },
  ramps5:  { name: 'Air Time', desc: 'Jump 5 ramps in one run', coins: 75 },
  coins100: { name: 'Pockets Full', desc: 'Pick up 100 coins in one run', coins: 100 },
  cp5:     { name: 'Beat the Clock', desc: 'Reach 5 checkpoints in one run', coins: 100 },
  ww2:     { name: 'Salmon', desc: 'Drive 2 km in Wrong Way', coins: 150 },
  garage:  { name: 'New Wheels', desc: 'Buy a car', coins: 25 },
  fleet:   { name: 'Fleet Owner', desc: 'Own every car in the garage', coins: 500 },
};
