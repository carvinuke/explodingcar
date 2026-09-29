# Road Rush

*Cross. Dodge. Survive.*

An endless "cross the road" arcade game for the browser. Hop across busy roads,
grab coins and power-ups, and keep an eye on reckless drivers. When one of them
rear-ends another car, it explodes, and if you're close the blast knocks you
back and stuns you.

## Run it

Open `index.html` in any modern browser. There's no build step and no
dependencies. It also works straight from `file://`. The only network request
is an optional Google Font, and the game falls back to the system font without it.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `W A S D` / arrow keys | Swipe |
| Hop forward | `W` / `↑` | Tap |
| Pause | `P` / `Esc` | Pause button |
| Mute | `M` | Speaker button |
| Start / play again | `Space` / `Enter` | Button |

## How it plays

- **Endless world.** Grass strips and roads are generated ahead of you and
  dropped behind you. A random-walk "safe column" guarantees there is always a
  path forward through the trees and rocks.
- **Difficulty ramps gradually.** Traffic speeds up, gaps shrink, roads widen
  from 1–2 lanes to 5, and sports cars and buses show up more often.
- **Six vehicle types:** small car, sedan, sports car, pickup, van, bus. Each
  has its own size, speed and colors. Normal drivers brake for the car ahead.
- **Vehicle crashes.** Every 12–20 seconds a *reckless driver* (red, with a
  `!` badge and a horn) speeds into a lane near you and rear-ends the traffic
  ahead. You get a fireball, a shockwave, smoke, sparks, debris, fire, a camera
  shake, a brief slow-motion and burning wrecks that spin out. Blast effects
  depend on distance:
  - under ~1.5 tiles: knocked back 2 cells, long stun
  - under ~3 tiles: knocked back 1 cell, short stun
  - under ~4.5 tiles: dazed briefly
  - farther: shake only

  Explosions never kill you directly. Landing in traffic might.
- **Death.** You die if a moving vehicle hits you, or if you dawdle and the red
  danger line creeping up from behind catches you. Death plays a ragdoll tumble
  in slow motion, then shows the game-over screen.
- **Power-ups** (bright orbs):
  - **Shield:** survives one hit and bounces the car away.
  - **Speed:** faster hops with a motion trail.
  - **Magnet:** pulls nearby coins and power-ups to you.
  - **Freeze:** traffic stops, frozen in ice.
  - **Invincible:** immune to cars and blasts.
- **Score.** 10 points per new row, +25 per coin and +50 per power-up. Your
  best score and total coins are saved in the browser.
- **Time of day.** The light shifts from day to dusk to night as you travel,
  with glowing street lamps and headlights at night.

## Code layout

Plain scripts that share a few global objects, loaded in order by `index.html`:

| File | System |
| --- | --- |
| `js/util.js` | Constants, math/color helpers, projection `P(y, z)`, safe storage |
| `js/audio.js` | `Sound`: every sound effect synthesized with WebAudio, plus mute |
| `js/effects.js` | `FX`: pooled particles, explosions, scorch marks, floating text, flashes |
| `js/draw.js` | `Draw`: 2.5D box primitives and sprites for vehicles, scenery, player, items, icons |
| `js/world.js` | `World`: endless row generation, biomes, obstacles, guaranteed path |
| `js/vehicles.js` | `Vehicles`: types, spawning, lane following, crashes, crash director |
| `js/player.js` | `Player`: grid hops, input buffer, knockback, stun, ragdoll |
| `js/powerups.js` | `Items` + `Powers`: coins, pickups and active power-up timers |
| `js/camera.js` | `Cam`: smooth follow, trauma shake, zoom punch |
| `js/renderer.js` | `Renderer`: frame composition, depth sorting, lighting, overlays |
| `js/ui.js` | `UI`: HUD, power-up tray, title / pause / game-over screens |
| `js/game.js` | `Game`: state machine, main loop, input, scoring, collisions |

Handy tuning knobs:
- difficulty curve: `difficulty()` in `util.js`
- lane speeds and gaps: `nextSegment()` and `makeRoad()` in `world.js`
- crash frequency: the end of `Vehicles.director()`
- blast radii: `Player.blast()`
- power-up durations and spawn weights: `POWERUPS`
