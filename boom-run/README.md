# Boom Run

Floor it down an endless highway, weaving through traffic. Shave past cars
for close-call combos, grab coins and power-ups, hit ramps for air time, and
try not to end up as a fireball.

## Play

Open `index.html` (or pick it from the arcade). No build step, works offline.

- **← → / A D** steer, **↑ / W** boost, **↓ / S** brake. Or drag (mouse or
  finger) and your car heads for it. Touch screens get Brake and Boost buttons.
- **P / Esc** pauses, **M** mutes, **Space** goes again from the run report.

## What's in it

- Three modes: **Endless**, **Checkpoint** (beat the clock to each green
  gantry for more time) and **Wrong Way** (all oncoming traffic, double coins).
- Speed climbs as you go, traffic gets busier and drivers start changing lanes
  (with a blinker first, and never into you). Traffic never lines up across all
  four lanes: there's always a way through, and the brakes are strong enough to
  sit behind a car.
- Close calls build a combo that multiplies the bonus.
- Power-ups: Nitro (smash straight through cars), Shield and Magnet. Ramps
  launch you over traffic. Fuel cans are worth 250.
- The scenery cycles through Road Rush's biomes: countryside, desert, snow,
  city, autumn and farmland.
- A garage of 7 cars with their own speed, grip and perks, plus paint, all
  bought with the arcade's shared coins. 12 trophies.

## Code

Drawing, explosions and sound come straight from Road Rush (`../road-rush/js/`),
with `../shared/rr-bridge.js` standing in for the Road Rush globals they expect
and `../shared/cars.js` drawing cars seen from behind.

- `js/data.js`: modes, garage, paint, power-ups and trophies.
- `js/road.js`: the player car, traffic, lane changes, close calls, pickups and checkpoints.
- `js/view.js`: drawing. The road and roadside are pre-drawn in chunks and
  slid past, so slow computers only draw the moving cars each frame.
- `js/game.js`: game flow, HUD, garage and input.
