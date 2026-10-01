'use strict';
// Progression: the skin shop (coins), missions (coins for goals), and the
// ghost of your best run.

// ---- Skins ------------------------------------------------------------------
// Most skins are bought with coins; some are level rewards and a few are
// trophies you have to earn.
// bird: a chick with wings, comb and beak. critter: a four-legged body with
// ears, snout, tail and pattern options. bigj: the helmet guy. ghost, slime,
// snowman, pumpkin and burger are one-offs.
const bird = (name, price, top, front, wingTop, wingFront, more = {}) => ({
  name, price, kind: 'bird', top, front, wingTop, wingFront,
  comb: ['#ff6b6b', '#e04848'], beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c', ...more,
});
const critter = (name, price, top, front, feet, more = {}) => ({
  name, price, kind: 'critter', top, front, wingTop: null, wingFront: null, comb: null, beak: null, feet, ...more,
});
const bigFace = (name, price, face, more = {}) => ({
  name, price, kind: 'bigj', face, top: '#9a9ea8', front: '#7b7f89', wingTop: null, wingFront: null, comb: null, beak: null, feet: '#6c7079', ...more,
});
const oneOff = (name, price, kind, top, front, more = {}) => ({
  name, price, kind, top, front, wingTop: null, wingFront: null, comb: null, beak: null, feet: front, ...more,
});

const SKINS = {
  chick:   { name: 'Chick', price: 0, kind: 'bird',
             top: '#fff1a8', front: '#ffd23f', wingTop: '#ffe066', wingFront: '#f2b705',
             comb: ['#ff6b6b', '#e04848'], beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  hardhat: { name: 'Hard Hat Chick', price: 100, kind: 'bird', hat: 'hardhat',
             top: '#fff1a8', front: '#ffd23f', wingTop: '#ffe066', wingFront: '#f2b705',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  duck:    { name: 'Duck', price: 200, kind: 'bird', bill: true,
             top: '#ffffff', front: '#e6e6e0', wingTop: '#f2f2ee', wingFront: '#d2d2ca',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  frog:    { name: 'Frog', price: 350, kind: 'frog',
             top: '#8be067', front: '#4fae45', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#3d8b37' },
  raccoon: { name: 'Raccoon', price: 500, kind: 'raccoon',
             top: '#a3a9b1', front: '#737a84', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#3a3d42' },
  penguin: { name: 'Penguin', price: 0, unlock: 'coldfeet', kind: 'bird', belly: '#f7f7f5', bill: true,
             top: '#2e3440', front: '#1e232c', wingTop: '#2a303b', wingFront: '#161a21',
             comb: null, beak: ['#ffb347', '#ff8c1a'], feet: '#ff9f1c' },
  dummy:   { name: 'Crash Test Dummy', price: 0, unlock: 'crashtest', kind: 'bird', marks: true,
             top: '#ffd84a', front: '#e8b400', wingTop: '#f2c830', wingFront: '#c99a00',
             comb: null, beak: ['#9aa0a8', '#6d737c'], feet: '#3a3d42' },
  zombie:  { name: 'Zombie Chick', price: 0, unlock: 'again', kind: 'bird', zombie: true,
             top: '#b5c9a3', front: '#86a077', wingTop: '#9fb68f', wingFront: '#6f8a62',
             comb: ['#8a4545', '#6a3030'], beak: ['#c9a36a', '#a27f48'], feet: '#7a8a5a' },
  bigj:    { name: 'Big J', price: 67, kind: 'bigj', rage: true,
             top: '#9a9ea8', front: '#7b7f89', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#6c7079' },
  bigs:    { name: 'Big S', price: 67, kind: 'bigj', face: '#1a6bff', neutral: true,
             top: '#9a9ea8', front: '#7b7f89', wingTop: null, wingFront: null,
             comb: null, beak: null, feet: '#6c7079' },
  // more birds
  pinkchick: bird('Bubblegum Chick', 150, '#ffd1e3', '#ff8fbf', '#ffb3d1', '#ef6fa8'),
  bluechick: bird('Blueberry Chick', 150, '#cfe8ff', '#5aa9ff', '#9fd0ff', '#3d8be0'),
  mintchick: bird('Mint Chick', 175, '#d9fff0', '#5fe0b0', '#a8f5d8', '#3cc495'),
  lavender:  bird('Lavender Chick', 175, '#eadcff', '#a98bff', '#cdb8ff', '#8a6be6'),
  pigeon:    bird('City Pigeon', 250, '#b8bec9', '#8d94a3', '#a2a9b6', '#6d7482', { comb: null, beak: ['#e8a0a0', '#c47c7c'], feet: '#e07a7a' }),
  crow:      bird('Crow', 300, '#3a3d48', '#22242c', '#30333d', '#181a20', { comb: null, beak: ['#8a8f99', '#5d626c'], feet: '#2b2d33', eyeColor: '#f0c419' }),
  cardinal:  bird('Cardinal', 350, '#ff5a4f', '#d1261c', '#e8443a', '#b01d15', { comb: ['#ff5a4f', '#d1261c'] }),
  bluejay:   bird('Blue Jay', 350, '#7ec3ff', '#2f7fd6', '#4f9fef', '#1f62b0', { comb: ['#7ec3ff', '#2f7fd6'], belly: '#eef4fb' }),
  rubberduck: bird('Rubber Duck', 400, '#ffe14d', '#f5c400', '#ffd84a', '#e0b000', { comb: null, bill: true, beak: ['#ff8c1a', '#e06a00'], feet: '#ff8c1a' }),
  flamingo:  bird('Flamingo', 450, '#ffb3c8', '#ff7aa2', '#ff98b8', '#e86690', { comb: null, beak: ['#3a3a3a', '#1a1a1a'], feet: '#ff7aa2' }),
  toucan:    bird('Toucan', 600, '#2b2d33', '#17191d', '#24262c', '#111215', { comb: null, belly: '#fff3c4', beak: ['#ff9f1c', '#f05a28'], bigBeak: true, eyeColor: '#7fe0ff' }),
  // critters
  pig:      critter('Pig', 350, '#ffc2d1', '#f2a0b6', '#e58aa3', { ears: 'pig', snout: 'pig', tail: 'curly' }),
  mouse:    critter('Mouse', 300, '#c5c9d1', '#9aa0aa', '#ff9fb5', { ears: 'mouse', earIn: '#ffb3c7', snout: 'cat', nose: '#ff8fa3', tail: 'mouse' }),
  cat:      critter('Ginger Cat', 400, '#ffb066', '#f08a2a', '#d9751f', { ears: 'cat', earIn: '#ffc4c4', snout: 'cat', nose: '#ff8fa3', tail: 'thin', pattern: 'stripes', patternColor: '#c9661a' }),
  bunny:    critter('Bunny', 450, '#f4f1f6', '#d8d2de', '#f4f1f6', { ears: 'bunny', earIn: '#ffb3c7', snout: 'cat', nose: '#ff8fa3', tail: 'puff', cheeks: true }),
  blackcat: critter('Black Cat', 500, '#3a3a44', '#24242c', '#1c1c22', { ears: 'cat', earIn: '#ff9fb5', snout: 'cat', nose: '#ff9fb5', tail: 'thin', eyeColor: '#9dff5c' }),
  puppy:    critter('Puppy', 600, '#e8c08f', '#c99a62', '#f5e6d0', { ears: 'dog', earColor: '#8a5d33', snout: 'dog', nose: '#1d1d1f', tail: 'stub', pattern: 'patch', patternColor: '#8a5d33' }),
  cow:      critter('Moo Cow', 650, '#f7f7f2', '#dcdcd4', '#2b2b2b', { ears: 'cow', horns: '#e8dcc0', snout: 'pig', snoutColor: '#ffb3c7', pattern: 'spots', patternColor: '#1f1f22', tail: 'thin' }),
  fox:      critter('Fox', 700, '#ff8a3d', '#e0601a', '#3a2a20', { ears: 'fox', earIn: '#3a2a20', snout: 'fox', nose: '#1d1d1f', tail: 'bushy', tailTip: '#ffffff' }),
  bear:     critter('Bear', 800, '#a8724a', '#7f5332', '#5a3a22', { ears: 'round', earIn: '#d9a77e', snout: 'dog', nose: '#1d1d1f', tail: 'stub' }),
  tiger:    critter('Tiger', 900, '#ffab40', '#f07c10', '#fff3e0', { ears: 'cat', earIn: '#ffffff', snout: 'cat', nose: '#ff8fa3', tail: 'thin', tailTip: '#2b1d10', pattern: 'stripes', patternColor: '#2b1d10' }),
  monkey:   critter('Monkey', 1000, '#9c6b3f', '#7a512c', '#5a3a1e', { ears: 'monkey', earIn: '#f2d2a9', snout: 'monkey', snoutColor: '#f2d2a9', tail: 'thin' }),
  koala:    critter('Koala', 1100, '#aeb4bd', '#8a909a', '#6d737c', { ears: 'koala', earIn: '#f2f2f2', snout: 'koala' }),
  panda:    critter('Panda', 1500, '#f4f4f4', '#d9d9d9', '#1d1d1f', { ears: 'round', earColor: '#1d1d1f', snout: 'dog', nose: '#1d1d1f', pattern: 'panda', tail: 'stub' }),
  dino:     critter('Dino', 1800, '#7ed957', '#4fae45', '#3d8b37', { spikes: '#f2c230', tail: 'dino', eyes: 'big' }),
  robot:    critter('Robot', 2200, '#c9d1dc', '#8d97a6', '#5a6370', { eyes: 'visor', eyeColor: '#ff3b3b', antenna: true, pattern: 'rivets' }),
  alien:    critter('Alien', 3000, '#9bff7a', '#5fd94a', '#3faa30', { eyes: 'one', antennae: '#9bff7a', glow: 'rgba(140,255,120,0.25)' }),
  devil:    critter('Lil Devil', 3500, '#ff4a4a', '#c41e1e', '#2b0a0a', { horns: '#1d1d1f', tail: 'devil', eyeColor: '#ffd23f', glow: 'rgba(255,40,40,0.25)' }),
  dragon:   critter('Dragon', 4000, '#ff5a4f', '#c8281e', '#8a1a12', { spikes: '#ffd23f', tail: 'dino', horns: '#ffe9a0', wingTop: '#ff8a5c', wingFront: '#d1401c', eyes: 'big', glow: 'rgba(255,90,40,0.3)' }),
  // one-offs
  snowman:  oneOff('Snowman', 900, 'snowman', '#ffffff', '#dfe9f3'),
  pumpkin:  oneOff('Pumpkin', 1100, 'pumpkin', '#ff9a2a', '#e0761a'),
  slime:    oneOff('Slime', 1200, 'slime', '#8dff8a', '#4ad94a'),
  ghost:    oneOff('Ghost', 1500, 'ghost', '#f7f7fb', '#dcdce8'),
  burger:   oneOff('Burger', 2500, 'burger', '#e8a24a', '#c9802f'),
  // Big J's cousins
  bigg:     bigFace('Big G', 670, '#22c55e', { faceStyle: 'happy' }),
  bigo:     bigFace('Big O', 670, '#ff8a1a', { faceStyle: 'sleepy' }),
  bigp:     bigFace('Big P', 670, '#a855f7', { faceStyle: 'shock' }),
  rainbowj: bigFace('Rainbow Big J', 6700, 'rainbow', { rage: true, glow: 'rgba(255,255,255,0.18)' }),
  // trophy skins
  oldtimer: bird('Old Timer', 0, '#f2f2ee', '#cfcfc6', '#e2e2dc', '#b8b8ae', { unlock: 'veteran', glasses: true, comb: ['#d9a0a0', '#b88080'] }),
  rainbowchick: bird('Rainbow Chick', 0, '#ffffff', '#ffffff', '#ffffff', '#ffffff', { unlock: 'completionist', rainbow: true, glow: 'rgba(255,255,255,0.3)' }),
  // level rewards
  silver:  { name: 'Silver Chick', price: 0, level: 3, kind: 'bird', shine: true,
             top: '#eef1f5', front: '#b3bac4', wingTop: '#dde2e8', wingFront: '#9aa2ad',
             comb: ['#ff6b6b', '#e04848'], beak: ['#c9ced6', '#9aa2ad'], feet: '#8d95a0' },
  robo:    { name: 'Robo Chick', price: 0, level: 5, kind: 'bird', antenna: true, eyeColor: '#4df0ff',
             top: '#a9b4c2', front: '#6f7b8c', wingTop: '#8e9aab', wingFront: '#56616f',
             comb: null, beak: ['#ffb347', '#e08a10'], feet: '#56616f' },
  neon:    { name: 'Neon Chick', price: 0, level: 8, kind: 'bird', glow: 'rgba(255,70,230,0.5)',
             top: '#ff6cf2', front: '#c42bb9', wingTop: '#7df9ff', wingFront: '#2bc2d0',
             comb: ['#7df9ff', '#2bc2d0'], beak: ['#ffe95c', '#e0c020'], feet: '#7df9ff' },
  diamond: { name: 'Diamond Chick', price: 0, level: 12, kind: 'bird', shine: true, glow: 'rgba(150,230,255,0.35)',
             top: '#d9f7ff', front: '#86d4ee', wingTop: '#bdefff', wingFront: '#64bcdc',
             comb: ['#b9f2ff', '#7fd6ef'], beak: ['#eafcff', '#a7e3f5'], feet: '#86d4ee' },
  golden:  { name: 'Golden Chicken', price: 0, level: 16, kind: 'bird', shine: true, glow: 'rgba(255,210,60,0.35)',
             top: '#ffe98a', front: '#f0b400', wingTop: '#ffd84a', wingFront: '#d49a00',
             comb: ['#ff4f4f', '#d63030'], beak: ['#ffcf6b', '#f0a020'], feet: '#e89010' },
  phoenix: { name: 'Phoenix', price: 0, fly: true, level: 20, kind: 'bird', flames: true, glow: 'rgba(255,120,30,0.45)',
             top: '#ffc14a', front: '#f0621c', wingTop: '#ff8a2a', wingFront: '#c8400f',
             comb: ['#ffe95c', '#ffb000'], beak: ['#ffe27a', '#f0a020'], feet: '#c8400f' },
  galaxy:  bird('Galaxy Chick', 0, '#5b3fbf', '#2e1f73', '#7b5be0', '#3a2a8f', { level: 25, stars: true, glow: 'rgba(150,100,255,0.35)', comb: ['#ff7af5', '#d24ad0'], beak: ['#ffd23f', '#e0a800'], feet: '#ff7af5' }),
  lava:    critter('Lava Dino', 0, '#3a2a26', '#1f1614', '#1f1614', { level: 30, spikes: '#ff7a1a', tail: 'dino', pattern: 'lava', patternColor: '#ff6a00', eyeColor: '#ffb000', eyes: 'big', glow: 'rgba(255,100,20,0.35)' }),
  crystalfox: critter('Crystal Fox', 0, '#d9f7ff', '#86d4ee', '#64bcdc', { level: 35, ears: 'fox', earIn: '#ffffff', snout: 'fox', nose: '#3d8be0', tail: 'bushy', tailTip: '#ffffff', shine: true, glow: 'rgba(150,230,255,0.4)' }),
  shadow:  critter('Shadow Cat', 0, '#2a2440', '#16121f', '#0e0b15', { level: 40, ears: 'cat', earIn: '#b46bff', snout: 'cat', nose: '#b46bff', tail: 'thin', eyes: 'glow', eyeColor: '#c58bff', glow: 'rgba(150,60,255,0.3)' }),
  cosmicj: bigFace('Cosmic Big J', 0, '#2a1a6b', { level: 45, ink: '#e9dcff', stars: true, rage: true, glow: 'rgba(140,100,255,0.3)' }),
  goldj:   bigFace('Golden Big J', 0, '#ffd23f', { level: 50, top: '#ffe98a', front: '#f0b400', feet: '#d49a00', shine: true, rage: true, glow: 'rgba(255,210,60,0.4)' }),
};

const HATS = {
  none:    { name: 'No hat', price: 0 },
  party:   { name: 'Party Hat', price: 60 },
  shades:  { name: 'Sunglasses', price: 80 },
  cone:    { name: 'Traffic Cone', price: 100 },
  cowboy:  { name: 'Cowboy Hat', price: 120 },
  tophat:  { name: 'Top Hat', price: 150 },
  crown:   { name: 'Crown', price: 400 },
  beanie:  { name: 'Beanie', price: 80 },
  cap:     { name: 'Backwards Cap', price: 90 },
  bow:     { name: 'Big Bow', price: 100 },
  headband: { name: 'Ninja Headband', price: 120 },
  beret:   { name: 'Beret', price: 140 },
  bucket:  { name: 'Bucket Hat', price: 150 },
  headphones: { name: 'Headphones', price: 200 },
  flowers: { name: 'Flower Crown', price: 220 },
  chef:    { name: 'Chef Hat', price: 250 },
  fez:     { name: 'Fez', price: 260 },
  grad:    { name: 'Graduation Cap', price: 300 },
  catears: { name: 'Cat Ears', price: 300 },
  bunnyears: { name: 'Bunny Ears', price: 320 },
  propeller: { name: 'Propeller Cap', price: 350 },
  pirate:  { name: 'Pirate Hat', price: 400 },
  viking:  { name: 'Viking Helmet', price: 450 },
  santa:   { name: 'Santa Hat', price: 450 },
  sombrero: { name: 'Sombrero', price: 500 },
  mohawk:  { name: 'Mohawk', price: 550 },
  antlers: { name: 'Antlers', price: 600 },
  mushroom: { name: 'Mushroom Cap', price: 650 },
  tiara:   { name: 'Tiara', price: 800 },
  pumpkinhat: { name: 'Jack-o-Lantern', price: 900 },
  horns:   { name: 'Devil Horns', price: 1000 },
  halo:    { name: 'Halo', price: 0, level: 10 },
  wizard:  { name: 'Wizard Hat', price: 0, level: 18 },
  astro:   { name: 'Space Helmet', price: 0, level: 28 },
  flamecrown: { name: 'Crown of Fire', price: 0, level: 38 },
  eggshell: { name: 'Eggshell', price: 0, unlock: 'hatch' },
  drivercap: { name: 'Driver Cap', price: 0, unlock: 'reverse' },
};

const TRAILS = {
  none:     { name: 'No trail', price: 0 },
  sparkle:  { name: 'Sparkles', price: 100 },
  bubbles:  { name: 'Bubbles', price: 120 },
  confetti: { name: 'Confetti', price: 150 },
  fire:     { name: 'Fire', price: 200 },
  rainbow:  { name: 'Rainbow', price: 300 },
  smoke:    { name: 'Smoke Puffs', price: 120 },
  feathers: { name: 'Feathers', price: 140 },
  hearts:   { name: 'Hearts', price: 150 },
  leaves:   { name: 'Autumn Leaves', price: 160 },
  snow:     { name: 'Snowflakes', price: 180 },
  notes:    { name: 'Music Notes', price: 220 },
  slime:    { name: 'Slime', price: 240 },
  pixels:   { name: 'Pixels', price: 250 },
  petals:   { name: 'Cherry Blossoms', price: 260 },
  ink:      { name: 'Ink Splats', price: 280 },
  bats:     { name: 'Bats', price: 300 },
  ghosts:   { name: 'Little Ghosts', price: 350 },
  coins:    { name: 'Coin Shower', price: 400 },
  money:    { name: 'Cash', price: 500 },
  stars:    { name: 'Shooting Stars', price: 0, level: 14 },
  galaxy:   { name: 'Galaxy', price: 0, level: 22 },
  lightning: { name: 'Lightning', price: 0, level: 32 },
  aurora:   { name: 'Aurora', price: 0, level: 42 },
  gold:     { name: 'Pure Gold', price: 0, level: 50 },
  quake:    { name: 'Earthquake', price: 0, unlock: 'rage' },
  turbo:    { name: 'Turbo', price: 0, unlock: 'marathon' },
  diamonds: { name: 'Diamonds', price: 0, unlock: 'hoarder' },
};

// Pets follow you around, and each one has a trick.
const PETS = {
  none:  { name: 'No pet', price: 0 },
  duck:  { name: 'Duckling', price: 120, perk: '+25% XP every run', xp: 1.25 },
  dog:   { name: 'Dog', price: 200, perk: 'Fetches coins near you' },
  cat:   { name: 'Cat', price: 400, perk: 'Blocks one hit per run (nine lives)' },
  minij: { name: 'Mini Big J', price: 250, perk: 'Glares at seagulls so they leave you alone' },
  drone: { name: 'Drone', price: 500, fly: true, perk: 'Lights up the night and pulls in coins' },
  pigeon: { name: 'Pigeon', price: 180, fly: true, perk: 'Drops a coin near you every few seconds' },
  parrot: { name: 'Parrot', price: 300, fly: true, perk: 'Squawks a warning before trains and reckless drivers arrive' },
  turtle: { name: 'Turtle', price: 450, perk: 'Surfaces under you if you fall in the water (then needs a rest)' },
  twister: { name: 'Mini Tornado', price: 600, perk: 'A little whirlwind that vacuums up every coin nearby' },
  rock:    { name: 'Pet Rock', price: 5, perk: 'Does absolutely nothing. It is a rock' },
  hamster: { name: 'Hamster', price: 350, perk: 'Lucky: 1 in 5 coins is worth double', luck: 0.2 },
  slime:   { name: 'Slimeling', price: 400, perk: 'Squeezes out a coin every 15 rows', rowCoins: 15 },
  crab:    { name: 'Crab', price: 450, perk: '+25 coins every time you reach a new biome', zoneCoins: 25 },
  penguin: { name: 'Penguin Chick', price: 500, perk: "Ice doesn't make you slide", grip: true },
  bat:     { name: 'Bat', price: 650, fly: true, perk: 'Close calls are worth double points', closeBonus: 2 },
  fox:     { name: 'Fox Kit', price: 700, perk: '+20% XP every run', xp: 1.2 },
  snail:   { name: 'Snail', price: 800, perk: 'The danger line creeps up 15% slower', danger: 0.85 },
  bee:     { name: 'Bumblebee', price: 900, fly: true, perk: 'Power-ups last 30% longer', powerBoost: 1.3 },
  bunny:   { name: 'Bunny', price: 1200, perk: 'You start every run with a shield', startShield: 1 },
  panda:   { name: 'Panda', price: 1500, perk: 'Missions pay 25% more', missionBonus: 1.25 },
  ghostie: { name: 'Ghostie', price: 2000, fly: true, perk: 'Eggs show up twice as often', eggLuck: 2 },
  goldfish: { name: 'Goldfish', price: 0, unlock: 'collector', perk: 'A fish in a bowl. Coins near you drift toward you', magnet: 1.6 },
  // egg-only: can't be bought, only hatched (carry an egg 50 rows without dying)
  phoenix: { name: 'Phoenix Chick', price: 0, egg: true, rare: 'LEGENDARY', perk: 'Once per run, brings you back from any death and torches every car around you' },
  dragon:  { name: 'Baby Dragon', price: 0, fly: true, egg: true, rare: 'EPIC', perk: 'Breathes fire on any car about to hit you' },
  unicorn: { name: 'Unicorn', price: 0, egg: true, rare: 'EPIC', perk: 'You can walk on water, and every coin is worth double' },
  golem:   { name: 'Stone Golem', price: 0, egg: true, rare: 'LEGENDARY', perk: 'Blocks a hit every 20 seconds, as many times as it takes' },
  fairy:   { name: 'Fairy', price: 0, fly: true, egg: true, rare: 'EPIC', perk: 'Gives you a random power-up every 25 seconds' },
  alien:   { name: 'Space Buddy', price: 0, fly: true, egg: true, rare: 'EPIC', perk: "UFOs won't take you, and every secret event or Reverse Day pays 50 coins" },
  frostfox: { name: 'Frost Fox', price: 0, egg: true, rare: 'EPIC', perk: 'Freezes all traffic for 3 seconds every 30 seconds' },
  goose:   { name: 'Golden Goose', price: 0, egg: true, rare: 'RARE', perk: 'Lays a golden egg worth 10 coins every few seconds, and doubles your XP', xp: 2 },
  owl:     { name: 'Time Owl', price: 0, fly: true, egg: true, rare: 'RARE', perk: 'All traffic moves slower, and time slows down when a car is about to hit you' },
  mole:    { name: 'Treasure Mole', price: 0, egg: true, rare: 'RARE', perk: 'Digs up treasure worth 25 coins every 40 rows' },
  robopup: { name: 'Robo Pup', price: 0, egg: true, rare: 'RARE', perk: 'Fetches power-ups from far away, and they last 50% longer', powerBoost: 1.5 },
  luckycat: { name: 'Lucky Cat', price: 0, egg: true, rare: 'RARE', perk: 'Far more coins show up on the road' },
};
const EGG_PETS = Object.keys(PETS).filter(k => PETS[k].egg);

// How you go when you get hit (on top of the usual crash).
const DEATHS = {
  none:      { name: 'Classic', price: 0 },
  confetti:  { name: 'Party Popper', price: 150 },
  hearts:    { name: 'Heartbreak', price: 200 },
  pixels:    { name: 'Game Over', price: 250 },
  bubbles:   { name: 'Bubble Pop', price: 250 },
  coins:     { name: 'Jackpot', price: 350 },
  smoke:     { name: 'Ninja Vanish', price: 450 },
  ghost:     { name: 'Spirit', price: 500 },
  stone:     { name: 'Statue', price: 600 },
  ice:       { name: 'Frozen Solid', price: 700 },
  lightning: { name: 'Thunderstruck', price: 800 },
  fireworks: { name: 'Fireworks', price: 900 },
  rainbow:   { name: 'Rainbow Blast', price: 1000 },
  blackhole: { name: 'Black Hole', price: 1500 },
  golden:    { name: 'Golden Statue', price: 0, unlock: 'legend' },
  supernova: { name: 'Supernova', price: 0, box: true, rare: 'MYSTERY', perk: 'A blinding blast that wrecks every car on screen' },
};

// Marks you leave on the ground for a few seconds.
const PRINTS = {
  none:    { name: 'No footprints', price: 0 },
  tracks:  { name: 'Chicken Tracks', price: 100 },
  paws:    { name: 'Paw Prints', price: 150 },
  hearts:  { name: 'Heart Steps', price: 180 },
  snow:    { name: 'Snow Boots', price: 200 },
  stars:   { name: 'Star Steps', price: 220 },
  slime:   { name: 'Slime', price: 250 },
  pixel:   { name: 'Pixel Steps', price: 300 },
  flames:  { name: 'Fire Steps', price: 350 },
  flowers: { name: 'Flower Steps', price: 350 },
  ghost:   { name: 'Ghost Steps', price: 380 },
  neon:    { name: 'Neon', price: 400 },
  rainbow: { name: 'Rainbow Steps', price: 450 },
  diamond: { name: 'Diamond Steps', price: 0, level: 26 },
  midas:   { name: 'Midas Touch', price: 0, box: true, rare: 'MYSTERY', perk: 'Your steps turn gold, and now and then one leaves a coin behind' },
};

// A title under your score.
const TITLES = {
  none:     { name: 'No title', price: 0 },
  runner:   { name: 'Road Runner', price: 200 },
  dancer:   { name: 'Lane Dancer', price: 300 },
  speedy:   { name: 'Speed Demon', price: 400 },
  coiner:   { name: 'Coin Collector', price: 500 },
  daredevil: { name: 'Daredevil', price: 800 },
  royalty:  { name: 'Chicken Royalty', price: 1500 },
  pro:      { name: 'Pro', price: 0, level: 15 },
  master:   { name: 'Master', price: 0, level: 30 },
  grand:    { name: 'Grandmaster', price: 0, level: 45 },
  hairs:    { name: "Hair's Breadth", price: 0, unlock: 'hair' },
  owl:      { name: 'Night Owl', price: 0, unlock: 'nightowl' },
  hunter:   { name: 'Egg Hunter', price: 0, unlock: 'hatch' },
  rager:    { name: 'Rage Machine', price: 0, unlock: 'rage' },
  survivor: { name: 'Survivor', price: 0, unlock: 'reborn' },
  careful:  { name: 'Careful Driver', price: 0, unlock: 'gentle' },
  marathon: { name: 'Marathon Runner', price: 0, unlock: 'marathon' },
  tourist:  { name: 'World Traveler', price: 0, unlock: 'tourist' },
  veteran:  { name: 'Veteran', price: 0, unlock: 'veteran' },
  collector: { name: 'Collector', price: 0, unlock: 'collector' },
  legend:   { name: 'Legend', price: 0, unlock: 'legend' },
  chosen:   { name: 'The Chosen One', price: 0, box: true, rare: 'MYSTERY' },
  lucky:    { name: 'Lucky Duck', price: 0, box: true, rare: 'MYSTERY' },
};

// Mystery-box exclusives in the older tabs.
Object.assign(SKINS, {
  disco:  bird('Disco Chick', 0, '#e8ecf2', '#b8c0cc', '#d0d6de', '#9aa2ad', { box: true, rare: 'MYSTERY', disco: true, shine: true, perk: 'A dance floor lights up wherever you stand' }),
  glitch: bird('Glitch Chick', 0, '#7df9ff', '#2bc2d0', '#ff6cf2', '#c42bb9', { box: true, rare: 'MYSTERY', glitch: true, perk: 'Flickers between dimensions' }),
});
Object.assign(HATS, {
  raincloud: { name: 'Storm Cloud', price: 0, box: true, rare: 'MYSTERY', perk: 'Your own little raincloud, with the odd flash of lightning' },
});
Object.assign(TRAILS, {
  blackhole: { name: 'Black Hole', price: 0, box: true, rare: 'MYSTERY', perk: 'A swirling vortex that pulls in coins next to you' },
});
Object.assign(PETS, {
  mimic: { name: 'Mimic', price: 0, box: true, rare: 'MYSTERY', perk: 'A hungry treasure chest that eats the coins you hop past (and gives them to you)' },
});

// Rewards for long-term goals: biome mastery (all three stars), Roadex pages,
// prestige, and the new trophies.
Object.assign(SKINS, {
  hen:        bird('Country Hen', 0, '#c46a32', '#9a4a1f', '#b0582a', '#7f3a16', { mastery: 'country' }),
  lizard:     critter('Desert Lizard', 0, '#d9b45a', '#b08a3a', '#8a6a2a', { mastery: 'desert', spikes: '#c46a32', tail: 'dino', eyes: 'big' }),
  yeti:       critter('Yeti', 0, '#f4f8ff', '#cfdcef', '#9fb2cc', { mastery: 'snow', ears: 'round', earIn: '#9fd0ff', snout: 'monkey', snoutColor: '#bfe2ff', glow: 'rgba(200,235,255,0.3)' }),
  harvest:    bird('Harvest Chick', 0, '#f2d27a', '#d9a83a', '#e8c460', '#b8902a', { mastery: 'farm', comb: ['#7fb84a', '#5f9437'], beak: ['#ff9f1c', '#e07a00'] }),
  bogfrog:    { name: 'Bog Frog', price: 0, mastery: 'swamp', kind: 'frog', top: '#7a9a3a', front: '#4f6b2a', wingTop: null, wingFront: null, comb: null, beak: null, feet: '#3a5220', eyeColor: '#ffd23f' },
  harborgull: bird('Harbor Gull', 0, '#ffffff', '#dfe3ea', '#c9ced8', '#9aa2ad', { mastery: 'harbor', comb: null, beak: ['#ffd23f', '#e0a800'], feet: '#ffb000' }),
  lamb:       critter('Little Lamb', 0, '#f7f5ee', '#dcd8cc', '#2b2522', { roadex: 'critters', ears: 'round', earIn: '#ffc4c4', snout: 'cat', nose: '#2b2522', tail: 'puff', cheeks: true }),
  treasure:   bird('Treasure Chick', 0, '#ffe066', '#c79bff', '#ffd23f', '#a95cff', { roadex: 'specials', shine: true, glow: 'rgba(200,150,255,0.3)', comb: ['#ff5c8a', '#d63a6a'] }),
  prestigechick: bird('Prestige Chick', 0, '#ffffff', '#e8e0ff', '#fff2b0', '#ffd23f', { prestige: 3, stars: true, shine: true, glow: 'rgba(255,240,180,0.45)', comb: ['#ffd23f', '#e0a800'], beak: ['#ffe98a', '#f0b400'] }),
  hologram:   bird('Hologram Chick', 0, '#bff8ff', '#5fd8f0', '#9ff0ff', '#3cb8d8', { unlock: 'roadexall', shine: true, glow: 'rgba(120,240,255,0.45)', comb: ['#9ff0ff', '#5fd8f0'], beak: ['#e8fdff', '#9ff0ff'], feet: '#5fd8f0' }),
});
Object.assign(TRAILS, {
  neoncity: { name: 'Neon City', price: 0, mastery: 'city' },
  seaspray: { name: 'Sea Spray', price: 0, mastery: 'beach' },
  maple:    { name: 'Maple Storm', price: 0, mastery: 'autumn' },
  surge:    { name: 'Power Surge', price: 0, roadex: 'powerups' },
  storm:    { name: 'Storm Chaser', price: 0, roadex: 'weather' },
  prestige: { name: 'Prestige Stars', price: 0, prestige: 5 },
});
Object.assign(TITLES, {
  gearhead:  { name: 'Gearhead', price: 0, roadex: 'vehicles' },
  weirdo:    { name: 'Weirdo Magnet', price: 0, roadex: 'events' },
  globe:     { name: 'Globetrotter', price: 0, roadex: 'biomes' },
  minmaxer:  { name: 'Min-Maxer', price: 0, roadex: 'upgrades' },
  reborn:    { name: 'Reborn', price: 0, prestige: 1 },
  immortal:  { name: 'Immortal', price: 0, prestige: 10 },
  goldchild: { name: 'Golden Child', price: 0, unlock: 'golden' },
  sewerrat:  { name: 'Sewer Rat', price: 0, unlock: 'spelunker' },
  theory:    { name: 'Theorycrafter', price: 0, unlock: 'buildmaster' },
  ranger:    { name: 'Park Ranger', price: 0, unlock: 'biomemaster' },
  carto:     { name: 'Cartographer', price: 0, unlock: 'cartographer' },
  evolver:   { name: 'Evolutionist', price: 0, unlock: 'evolution' },
});

// Earned, not bought.
const earnedOnly = it => !!(it.unlock || it.level || it.egg || it.box || it.mastery || it.roadex || it.prestige);

// What each pet's perk becomes at level 5 (shown in the shop).
const PET_MAX = {
  duck: '+40% XP', dog: 'Fetches from much further away', cat: 'Blocks two hits per run', minij: 'UFOs are too scared to take you either',
  drone: 'A stronger coin pull', pigeon: 'Drops coins far more often', parrot: 'Warns you from further away', turtle: 'Rests half as long',
  twister: 'A much wider vacuum', rock: 'Still does nothing (proudly)', hamster: '1 in 3 coins is worth double', slime: 'A coin every 10 rows',
  crab: '+50 coins per new biome', penguin: 'Still no sliding (it was already perfect)', bat: 'Close calls are worth triple', fox: '+35% XP',
  snail: 'The danger line is 22% slower', bee: 'Power-ups last 50% longer', bunny: 'Start every run with two shields', panda: 'Missions pay 40% more',
  ghostie: 'Eggs show up three times as often', goldfish: 'A much stronger coin pull', phoenix: 'Brings you back twice per run',
  dragon: 'Breathes fire much more often', unicorn: 'Coins are worth triple', goose: 'Lays golden eggs much faster', owl: 'Slows time more often',
  golem: 'Recharges in 14 seconds', fairy: 'A power-up every 18 seconds', alien: 'Events pay 100 coins', frostfox: 'Freezes traffic every 22 seconds',
  mole: 'Treasure every 30 rows', robopup: 'Fetches power-ups from across the screen', luckycat: 'Even more coins on the road',
  mimic: 'Eats coins from further away',
};

const SHOP_TABS = { skins: SKINS, hats: HATS, trails: TRAILS, pets: PETS, deaths: DEATHS, prints: PRINTS, titles: TITLES };
// Which Shop field holds each tab's equipped item, and its storage key.
const SLOTS = {
  skins: ['current', 'skin', 'chick'], hats: ['hat', 'hat'], trails: ['trail', 'trail'], pets: ['pet', 'pet'],
  deaths: ['death', 'death'], prints: ['print', 'print'], titles: ['title', 'title'],
};

const Shop = {
  owned: { skins: ['chick'], hats: ['none'], trails: ['none'], pets: ['none'], deaths: ['none'], prints: ['none'], titles: ['none'] },
  current: 'chick',
  hat: null,
  trail: null,
  pet: null,
  death: null,
  print: null,
  title: null,

  load() {
    const list = (key, table, base) => {
      const v = Store.get(key, [base]);
      const out = Array.isArray(v) ? v.filter(id => table[id]) : [];
      if (!out.includes(base)) out.unshift(base);
      return out;
    };
    this.owned = {};
    for (const tab in SHOP_TABS) this.owned[tab] = list(tab, SHOP_TABS[tab], tab === 'skins' ? 'chick' : 'none');
    for (const tab in SLOTS) {
      const [field, key, base] = SLOTS[tab];
      const id = Store.get(key, base || 'none');
      const ok = SHOP_TABS[tab][id] && this.has(tab, id);
      this[field] = tab === 'skins' ? (ok ? id : 'chick') : ok && id !== 'none' ? id : null;
    }
  },

  skin() { return SKINS[this.current]; },

  // How much of the shop you own (everything but the "none" slots).
  collection() {
    let have = 0, total = 0;
    for (const tab in SHOP_TABS) for (const id in SHOP_TABS[tab]) {
      if (id === 'none') continue;
      total++;
      if (this.has(tab, id)) have++;
    }
    return { have, total };
  },
  tabCount(tab) {
    let have = 0, total = 0;
    for (const id in SHOP_TABS[tab]) { if (id === 'none') continue; total++; if (this.has(tab, id)) have++; }
    return { have, total };
  },

  // Trophy skins are yours as soon as the trophy is.
  has(tab, id) {
    const item = SHOP_TABS[tab][id];
    if (!item) return false;
    if (item.unlock) return Trophies.has(item.unlock);
    if (item.level) return Levels.level >= item.level || Prestige.n > 0; // prestige keeps your level rewards
    if (item.mastery) return Mastery.done(item.mastery);
    if (item.roadex) return Roadex.pageDone(item.roadex);
    if (item.prestige) return Prestige.n >= item.prestige;
    return this.owned[tab].includes(id);
  },

  equipped(tab, id) { return (this[SLOTS[tab][0]] || 'none') === id; },

  buy(tab, id) {
    const item = SHOP_TABS[tab][id];
    if (!item || earnedOnly(item) || this.has(tab, id) || Game.bank < item.price) return false;
    Game.bank -= item.price;
    Store.set('coins', Game.bank);
    this.owned[tab].push(id);
    Store.set(tab, this.owned[tab]);
    this.equip(tab, id);
    Trophies.check(); // collection trophies
    return true;
  },

  // Hatched from an egg: yours for good.
  grant(tab, id) {
    if (this.owned[tab].includes(id)) return;
    this.owned[tab].push(id);
    Store.set(tab, this.owned[tab]);
    Trophies.check();
  },

  equip(tab, id) {
    if (!this.has(tab, id)) return;
    const [field, key] = SLOTS[tab];
    this[field] = tab === 'skins' ? id : id === 'none' ? null : id;
    Store.set(key, id);
    if (tab === 'pets' && (Game.state === 'playing' || Game.state === 'paused')) Pets.reset();
  },

  // ---- Outfits: three saved looks you can switch between in one tap ----
  outfits() {
    const v = Store.get('outfits', null);
    return Array.isArray(v) && v.length === 3 ? v : [null, null, null];
  },
  saveOutfit(i) {
    const o = this.outfits();
    o[i] = {};
    for (const tab in SLOTS) o[i][tab] = this[SLOTS[tab][0]] || 'none';
    Store.set('outfits', o);
  },
  wearOutfit(i) {
    const o = this.outfits()[i];
    if (!o) return false;
    for (const tab in SLOTS) if (o[tab] && this.has(tab, o[tab])) this.equip(tab, o[tab]);
    return true;
  },
};

// Hop trails (player one's equipped trail).
const Cosmetics = {
  hopTrail(p) {
    if (p.id !== 0 || !Shop.trail) return;
    FX.hopTrail(p.x, p.y, Shop.trail);
  },
};

// ---- Missions ----------------------------------------------------------------
const MISSION_TYPES = {
  lanes:    { text: n => `Cross ${n} lanes of traffic in one run`, targets: [10, 20, 35, 50], reward: n => 30 + n * 3 },
  streak:   { text: n => `Cross ${n} lanes in a row without stopping`, targets: [3, 5, 8], reward: n => n * 20 },
  coins:    { text: n => `Collect ${n} coins in one run`, targets: [5, 10, 20], reward: n => n * 8 },
  score:    { text: n => `Score ${n} points in one run`, targets: [300, 600, 1000, 1500], reward: n => Math.round(n / 8) },
  crashes:  { text: n => `Survive ${n} crashes near you in one run`, targets: [2, 3, 5], reward: n => n * 30 },
  combo:    { text: n => `Get a x${n} close-call combo`, targets: [2, 3, 5], reward: n => n * 30 },
  logs:     { text: n => `Ride ${n} logs in one run`, targets: [3, 6, 10], reward: n => n * 12 },
  rails:    { text: n => `Cross ${n} railroad tracks in one run`, targets: [2, 4, 6], reward: n => n * 25 },
  powerups: { text: n => `Grab ${n} power-ups in one run`, targets: [2, 3, 5], reward: n => n * 25 },
  events:   { text: n => `Survive ${n} secret event${n > 1 ? 's' : ''} in one run`, targets: [1, 2], reward: n => n * 60 },
  distance: { text: n => `Reach row ${n}`, targets: [40, 80, 120, 160], reward: n => n },
};

const Missions = {
  active: [],
  done: 0,
  stats: {},

  load() {
    this.done = Store.get('missionsDone', 0);
    const saved = Store.get('missions', []);
    this.active = (Array.isArray(saved) ? saved : []).filter(m => m && MISSION_TYPES[m.type]).slice(0, 3);
    while (this.active.length < 3) this.active.push(this.make());
    this.save();
    this.startRun();
  },

  save() {
    Store.set('missions', this.active);
    Store.set('missionsDone', this.done);
  },

  make() {
    const used = this.active.map(m => m.type);
    const types = Object.keys(MISSION_TYPES).filter(t => !used.includes(t));
    const type = pick(types);
    const T = MISSION_TYPES[type];
    const level = Math.min(T.targets.length - 1, Math.floor(this.done / 3) + randInt(0, 1));
    const target = T.targets[level];
    return { type, target, reward: T.reward(target), fresh: true };
  },

  text(m) { return MISSION_TYPES[m.type].text(m.target); },

  startRun() {
    this.stats = { lanes: 0, streak: 0, coins: 0, score: 0, crashes: 0, combo: 0, logs: 0, rails: 0, powerups: 0, events: 0, distance: 0 };
    for (const m of this.active) m.fresh = false; // new missions count from the next run
  },

  progress(m) { return Math.min(m.target, this.stats[m.type] || 0); },

  add(key, n = 1) { if (!Game.tracksProgress()) return; this.stats[key] = (this.stats[key] || 0) + n; this.check(); },
  max(key, v) { if (!Game.tracksProgress()) return; if (v > (this.stats[key] || 0)) { this.stats[key] = v; this.check(); } },

  check() {
    for (let i = 0; i < this.active.length; i++) {
      const m = this.active[i];
      if (m.fresh || (this.stats[m.type] || 0) < m.target) continue;
      this.done++;
      const pay = Math.round(m.reward * (Pets.perk('missionBonus') || 1)); // the panda haggles
      Game.bank += pay;
      Store.set('coins', Game.bank);
      UI.missionDone(m, pay);
      Sound.mission();
      this.active[i] = this.make();
      this.save();
    }
  },
};

// ---- Ghost of your best run ---------------------------------------------------------
// Records each move as [time, x, y, kind]; plays back your best run alongside you.
const Ghost = {
  rec: [],
  play: null,
  idx: 0,
  pos: null,
  key: 'best',

  start(key) {
    this.key = key;
    this.rec = [[0, cellX(START_COL), 0, 'h']];
    this.idx = 0;
    this.pos = null;
    if (!key) { this.play = null; return; } // no ghost in two-player mode
    const saved = Settings.ghost ? Store.get('ghost.' + key, null) : null;
    this.play = Array.isArray(saved) && saved.length > 1 ? saved : null;
    this.idx = 0;
    this.pos = null;
    this.slideT = 0;
  },

  // kind: h = hop, k = knockback, s = drift on a log, d = died
  mark(t, x, y, kind) {
    if (this.key && this.rec.length < 4000) this.rec.push([Math.round(t * 100) / 100, Math.round(x), Math.round(y), kind]);
  },

  save() { if (this.key) Store.set('ghost.' + this.key, this.rec); },

  update(t) {
    const g = this.play;
    if (!g) { this.pos = null; return; }
    while (this.idx < g.length - 1 && g[this.idx + 1][0] <= t) this.idx++;
    const cur = g[this.idx], prev = g[Math.max(0, this.idx - 1)];
    if (cur[3] === 'd') {
      const fade = 1 - (t - cur[0]) / 0.8;
      this.pos = fade > 0 ? { x: cur[1], y: cur[2], z: 0, alpha: fade } : null;
      return;
    }
    const dur = cur[3] === 'k' ? 0.4 : cur[3] === 's' ? 0.2 : 0.12;
    const k = clamp((t - cur[0]) / dur, 0, 1);
    const e = cur[3] === 's' ? k : easeOutQuad(k);
    this.pos = {
      x: lerp(prev[1], cur[1], e),
      y: lerp(prev[2], cur[2], e),
      z: cur[3] === 's' ? 0 : Math.sin(Math.PI * k) * (cur[3] === 'k' ? 0.6 : 0.3) * TILE,
      alpha: 1,
    };
  },
};
