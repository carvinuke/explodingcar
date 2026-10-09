# Traffic Control

Run a busy crossroads. Each road has its own traffic light: switch it, and let
the cars through without letting two streams of traffic meet in the middle.

## Play

Open `index.html` (or pick it from the arcade). No build step, works offline.

- **Click/tap a traffic light** (or its waiting lane) to switch it.
- **Arrow keys / WASD** switch the light for traffic going that way.
- **Space** switches every light at once, with a safe all-red pause in between.
- **1 / 2 / 3** use Freeze, Tow and Calm. **P / Esc** pauses.

## What's in it

- 15 levels over three maps (Main Street, Downtown, Rail Crossing), 3 stars
  each: no crashes for 3, one crash for 2, two for 1. Three crashes ends a shift.
- Endless Rush Hour, which keeps getting busier.
- Buses and tankers, turning cars, reckless drivers who ignore red lights,
  ambulances that want a green light right now, rain, night, rush-hour waves
  and trains with crossing gates.
- Impatient drivers: wait too long and they honk, then run the red light.
- Power-ups every 12 cars: Freeze, Tow and Calm.
- Custom Shift, once you've cleared 5 levels: lay out your own crossings, set
  the traffic, vehicles, weather and rules, and save it as a preset. The Share
  tab turns a shift into a short code like `TC1-CJFD-8K60-DV5S-DXY2-2T6J-1`; a
  friend pastes it into their own Share tab to play exactly the same shift.
- A shop (upgrades, traffic-light styles, themes) using the arcade's shared
  coins, and 14 trophies.

## Code

Drawing, explosions and sound come straight from Road Rush (`../road-rush/js/`):
`util.js`, `audio.js`, `effects.js`, `draw.js` and `vehicles.js`, with
`../shared/rr-bridge.js` standing in for the Road Rush globals they expect.
`../shared/cars.js` adds cars driving toward and away from the camera.

- `js/data.js`: maps, levels, trophies, the shop and the custom shift's options.
- `js/share.js`: share codes for custom shifts. Its field list is the code format:
  never reorder or change it (a new setting needs a new code version).
- `js/sim.js`: lanes and paths, the lights, car following, patience, crashes and trains.
- `js/view.js`: drawing. The ground and scenery are drawn once into a picture and reused.
- `js/game.js`: game flow, HUD, menus and input.
