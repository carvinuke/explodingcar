# Road Rush

*Cross. Dodge. Survive.*

An endless "cross the road" arcade game for the browser. Hop across roads,
railroad tracks, rivers and road work through the countryside, the city, the
desert, a snowy mountain pass and the beach, from morning into the night. Grab coins and
power-ups, and keep an eye out for reckless drivers, trains, wildlife and rare
secret events.

**Play it:** https://carvinuke.github.io/explodingcar/road-rush/

## Run it locally

Open `index.html` in any modern browser. There's no build step and no
dependencies, and it works straight from `file://`. The only network request
is an optional Google Font; without it the game falls back to a system font.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `W A S D` (rebindable) / arrow keys | Swipe |
| Hop forward | `W` / `↑` | Tap |
| Pause | `P` / `Esc` | Pause button |
| Skip the replay | Any key | Tap |
| Mute | `M` | Speaker button |
| Start / play again | `Space` / `Enter` | Button |
| Close a dialog | `Esc` | Tap outside it |

Game controllers work too: d-pad or left stick to move, A to hop forward or
confirm, B to close a dialog, Start to pause. In two-player mode the first
controller is player one and the second is player two; on a keyboard player one
uses `W A S D` and player two the arrow keys.

## Modes

- **Endless:** the classic run (the big PLAY button). The other modes sit in a row under it; hover or focus one to see what it does.
- **Hardcore:** starts further up the difficulty curve, with faster and denser
  traffic, a faster danger line, no power-ups, and double coins.
- **Time attack:** get as far as you can in 90 seconds. The clock starts on your
  first hop and every coin adds a second.
- **2 players:** two chickens on one road. The camera follows both; fall too far
  behind and the danger line gets you. Last chicken standing wins, and the
  match score carries over between rematches.

## The road

- **Endless world.** Ground, roads, railroads, rivers and road work are
  generated ahead of you and dropped behind you. A random-walk "safe column"
  guarantees a path through the scenery, pits and road-work gear. Railroads and
  rivers are occasional: never next to each other, and each needs a long
  stretch before it can appear again.
- **Biomes.** The first 80 rows are countryside, then every 90 rows the world
  changes, with a green "Entering…" sign at the border:
  - *Countryside:* trees and meadows; cows wander onto the road and stop
    traffic, and deer bolt across it.
  - *City:* sidewalks, hydrants, benches and tall buildings; more lanes, taxis
    and buses, trams instead of freight trains, canals with rafts, and lots of
    road work.
  - *Desert:* sand, cacti and mesas, tumbleweeds, long freight trains, no
    rivers, and dust storms that hide the road ahead.
  - *Mountain pass:* snow all the time, pines, snowmen and deer; ice floes on
    the rivers; and ice patches that keep you sliding until you hit grip or
    something solid.
  - *Beach:* sand and boardwalks, umbrellas, deck chairs, sandcastles and
    palms; lots of water crossed on lines of surfboards; and seagulls that
    swoop down to snatch coins off the ground or dive at you to steal up to 3
    of yours. A dashed ring shows where a diving gull will land, so move.
- **Day and night.** A full day lasts about three minutes. At night the road
  goes dark and only lights cut through it: headlights, street lamps, train
  lamps, fires, lit windows and a small glow around you. Tail lights and
  signals glow on top. At night some cars drive with no headlights (you only
  see their red tail lights), and drunk drivers weave along the lanes and
  lurch into the next lane without warning.
- **Road work.** Cones and barriers block cells, open pits swallow you, and an
  excavator beeps, marks the cells with hazard stripes, then swings its bucket
  across them and knocks you sideways (maybe into a pit).
- **Emergency services.** After a crash, an ambulance or fire truck races in
  with sirens, pulls up alongside and the fire truck hoses the fire out. They
  don't stop for chickens.
- **Traffic:** small cars, sedans, sports cars, pickups, vans, buses and tanker
  trucks. Normal drivers brake for the car ahead. Traffic gets faster and
  denser, and roads widen from 1–2 lanes to 5.
- **Reckless drivers and police chases.** Every 12–20 seconds a red speeder,
  sometimes with a police car and siren right behind it, rear-ends traffic
  near you. Crashes explode, and a blast knocks you back and stuns you if
  you're close. Tanker trucks go up in a huge fireball that wrecks nearby cars.
- **Railroads.** Crossing signals flash and a bell rings, then a fast freight
  train comes through. A yellow RR sign at the screen edge shows which side
  it's coming from. Sometimes a car has stalled on the tracks.
- **Rivers.** Ride the drifting logs (ice floes in the mountains, rafts in the city) across. Missing a log, or riding one off
  the edge, ends the run.
- **Weather.** Rain makes cars brake late and occasionally skid into each
  other. Snow slows traffic and whitens the ground.
- **Thunderstorms.** In heavy rain, lightning picks a cell (often right in
  front of a car, or near you), marks it with a glowing ring and a bolt icon
  for about a second, then strikes. It wrecks cars and kills chickens.
- **Tornadoes.** In rain or dust storms (not in the city or the mountains) a
  twister wanders across the road ahead. It sucks up cars, spins them around
  and flings them down as burning wrecks. If it catches you, you're carried
  off and dropped a row or two away, which might be in a river.
- **Close calls.** Hop out of a lane just before a car tears through it (or
  just behind one) for bonus points. Chain them within 3 seconds for a
  multiplier.
- **Danger line.** Dawdle too long and the red line creeping up from behind
  catches you.

## Secret events

Rare events that happen every minute or two:

- **UFO sighting:** beams up cars (and you, if you're under it), then zaps a few.
- **Meteor shower:** three meteors aim near you. Get out of the red circles.
- **Giant chicken:** stomps across the road, kicking cars away. Don't get stepped on.
- **Flash flood:** a road fills with water, cars slow down and hydroplane into crashes.
- **Wrong way:** all traffic suddenly drives backwards.
- **Giant goose:** chases you and smashes anything in its way.
- **The moon is too close** and **Gravity glitch:** low gravity with floaty hops.
- **Miniature world:** everything shrinks into a tiny tilt-shift view.

## Progression

- **Levels and XP:** every run earns XP (rows, coins, close calls, events
  survived and new trophies; Hardcore pays 1.5x). Each level pays coins, and
  some unlock skins: Silver Chick (level 3), Robo Chick (5), Neon Chick (8),
  Diamond Chick (12), Golden Chicken (16) and a Phoenix that's always on fire
  (20). The report shows the XP you earned and your progress.
- **Shop:** spend coins on skins (Hard Hat Chick, Duck, Frog, Raccoon, and
  Big J, a grey body under a round helmet with a very unimpressed red face), hats
  (party hat, sunglasses, traffic cone, cowboy hat, top hat, crown) and hop
  trails (sparkles, bubbles, confetti, fire, rainbow).
- **Trophies:** 24 achievements, such as surviving three explosions in one run,
  a close call with a train, getting trampled by a deer, or getting picked up
  by a tornado and living. Three of them unlock skins you can't buy: the Crash
  Test Dummy, Penguin and Zombie Chick.
- **Stats:** lifetime totals in the trophy room: runs, time played, rows,
  coins, wrecks, close calls, trains dodged, best scores per mode and deaths by
  cause.
- **Missions:** three goals at a time, like crossing lanes, riding logs,
  surviving crashes or reaching a row, each paying coins.
- **Ghost:** a faint "BEST" ghost replays your best run alongside you.
  You can turn it off in Settings.

## Settings

Open **Settings** from the title screen, the pause screen or the game-over
report. Your choices are saved in the browser.

- **Sound** (also `M`) and **Screen shake**.
- **Reduced motion:** no shake, zoom punches or blur, softer flashes. It's on by
  default if your system asks for reduced motion.
- **Colorblind-friendly:** warnings use shapes and stripes, not just red: a
  striped danger line, triangle and "P" badges for speeders and police, and
  crosshairs on meteor targets.
- **Ghost of best run** and **Death replay** (a slow-motion instant replay of
  how you died, which any key or tap skips).
- **Controls:** rebind the four movement keys.
- **Graphic mode:** off by default. Turning it on shows a warning you have to
  confirm first. When it's on:
  - Every death gets cartoon gore. Getting run over flattens the chick in a
    spreading pool of blood, with body parts flying and blood on the screen.
    Every car that drives through the pool leaves red tyre tracks, and an
    ambulance arrives so the paramedics can cover you with a sheet. Trains
    obliterate you and leave a trail down the track. Piranhas turn the river
    red. The giant chicken squashes you flat and the goose tears you apart.
  - Crashes get far more violent: bigger blasts with a wider knockback, flipping
    wrecks, fuel tanks exploding afterwards, nearby cars wrecked by the blast,
    burning debris raining down, and scorched, bleeding chicks.

## Look

The interface borrows from real road signage: a green guide sign for the
title, a speed-limit plate for your best score, a blue services sign for
power-ups, an orange road-work sign for missions, a brown attraction sign for
the shop, a road-closed barricade for pause, and a traffic incident report for
game over. The UI font is Overpass, based on the Highway Gothic lettering on
US road signs.

## Code layout

Plain scripts that share a few global objects, loaded in order by `index.html`:

| File | System |
| --- | --- |
| `js/util.js` | Constants, helpers, projection `P(y, z)`, safe storage, `Settings`, seeded `Gen` |
| `js/audio.js` | `Sound`: every sound effect and weather loop synthesized with WebAudio |
| `js/effects.js` | `FX`: pooled particles, explosions, blood and scorch decals, fire, water, weather, flashes |
| `js/draw.js` | `Draw`: 2.5D box sprites for vehicles, trains, logs, scenery, skins and icons |
| `js/world.js` | `World`: endless row generation (ground, road, rail, river, road work), biomes, weather |
| `js/vehicles.js` | `Vehicles`: types, lanes, braking, skids, crashes, blasts, responders, crash director |
| `js/hazards.js` | `River` (logs), `Rail` (signals, trains, trams, stalled cars), `Work` (excavators) |
| `js/animals.js` | `Animals`: cows, deer, tumbleweeds, seagulls, paramedics |
| `js/player.js` | `Player` / `Player2`: hops, ice, log riding, knockback, stun, abduction, deaths |
| `js/powerups.js` | `Items` + `Powers`: coins, pickups and power-up timers |
| `js/progress.js` | `SKINS`, `HATS`, `TRAILS` + `Shop`, `Missions`, `Ghost` |
| `js/trophies.js` | `Stats`, `Trophies` and `Levels` |
| `js/events.js` | `Events`: secret events |
| `js/storms.js` | `Storms`: lightning and tornadoes |
| `js/camera.js` | `Cam`: follow (one or two players), shake, zoom |
| `js/lighting.js` | `Lighting`: day and night, darkness layer and lights |
| `js/renderer.js` | `Renderer`: frame composition, depth sorting, overlays |
| `js/replay.js` | `Replay`: records the last seconds and plays the death back |
| `js/input.js` | `Input`: keyboard bindings, touch and game controllers |
| `js/ui.js` | `UI`: HUD, toasts, screens, shop, trophy room, missions, settings |
| `js/game.js` | `Game`: state, modes, loop, scoring, deaths, weather and biomes |

Handy tuning knobs:
- difficulty curve: `difficulty()` in `util.js`
- what gets generated and how far apart: `nextSegment()` in `world.js`
- biome length and order: `FIRST_ZONE`, `ZONE_LEN` and `ZONES` in `world.js`
- length of a day: `CYCLE` in `lighting.js`
- mode rules: `MODES` in `game.js`
- crash frequency: the end of `Vehicles.director()`
- secret event timing and weights: `EVENT_DEFS` and `Events.end()` in `events.js`
- prices: `SKINS`, `HATS` and `TRAILS` in `progress.js`
- trophies: `TROPHIES` in `trophies.js`
- XP per level and level skins: `Levels.cost()` and `LEVEL_SKINS` in `trophies.js`
