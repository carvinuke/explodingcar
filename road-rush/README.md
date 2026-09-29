# Road Rush

*Cross. Dodge. Survive.*

An endless "cross the road" arcade game for the browser. Hop across roads,
railroad tracks and rivers, grab coins and power-ups, and keep an eye out for
reckless drivers, freight trains and rare secret events.

**Play it:** https://carvinuke.github.io/explodingcar/road-rush/

## Run it locally

Open `index.html` in any modern browser. There's no build step and no
dependencies, and it works straight from `file://`. The only network request
is an optional Google Font; without it the game falls back to a system font.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `W A S D` / arrow keys | Swipe |
| Hop forward | `W` / `↑` | Tap |
| Pause | `P` / `Esc` | Pause button |
| Mute | `M` | Speaker button |
| Start / play again | `Space` / `Enter` | Button |
| Close a dialog | `Esc` | Tap outside it |

## The road

- **Endless world.** Grass, roads, railroads and rivers are generated ahead of
  you and dropped behind you. A random-walk "safe column" guarantees a path
  through the trees and rocks. Railroads and rivers are occasional: never next
  to each other, and each needs a long stretch before it can appear again.
  Grass strips vary from one-row breathers to wide meadows.
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
- **Rivers.** Ride the drifting logs across. Missing a log, or riding one off
  the edge, ends the run.
- **Weather.** Rain makes cars brake late and occasionally skid into each
  other. Snow slows traffic and whitens the ground.
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

- **Skin shop:** spend coins on the Hard Hat Chick, Duck, Frog and Raccoon.
- **Missions:** three goals at a time, like crossing lanes, riding logs,
  surviving crashes or reaching a row, each paying coins.
- **Daily challenge:** the same layout for everyone each day (by UTC date),
  with its own best score.
- **Ghost:** a faint "BEST" ghost replays your best run alongside you.
  You can turn it off in Settings.

## Settings

Open **Settings** from the title screen, the pause screen or the game-over
report. Your choices are saved in the browser.

- **Sound** (also `M`) and **Screen shake**.
- **Ghost of best run.**
- **Graphic mode:** off by default. Turning it on shows a warning you have to
  confirm first. When it's on:
  - Every death gets cartoon gore. Getting run over flattens the chick in a
    spreading pool of blood, with body parts flying and blood on the screen.
    Every car that drives through the pool leaves red tyre tracks. Trains
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
| `js/world.js` | `World`: endless row generation (grass, road, rail, river), biomes, weather zones |
| `js/vehicles.js` | `Vehicles`: types, lanes, braking, skids, crashes, blasts, crash director |
| `js/hazards.js` | `River` (logs) and `Rail` (signals, trains, stalled cars) |
| `js/player.js` | `Player`: hops, log riding, knockback, stun, abduction, deaths |
| `js/powerups.js` | `Items` + `Powers`: coins, pickups and power-up timers |
| `js/progress.js` | `SKINS` + `Shop`, `Missions`, `Ghost` |
| `js/events.js` | `Events`: secret events |
| `js/camera.js` | `Cam`: follow, shake, zoom |
| `js/renderer.js` | `Renderer`: frame composition, depth sorting, lighting, overlays |
| `js/ui.js` | `UI`: HUD, toasts, screens, shop, missions, settings |
| `js/game.js` | `Game`: state, modes, loop, input, scoring, deaths, weather |

Handy tuning knobs:
- difficulty curve: `difficulty()` in `util.js`
- what gets generated and how far apart: `nextSegment()` in `world.js`
- crash frequency: the end of `Vehicles.director()`
- secret event timing and weights: `EVENT_DEFS` and `Events.end()` in `events.js`
- skin prices: `SKINS` in `progress.js`
