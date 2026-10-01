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
  changes to one of nine biomes, with a green "Entering…" sign at the border:
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
  - *Farmland:* tall corn fields that hide what's behind them, hay bales and
    scarecrows, slow tractors, and loose sheep wandering onto the road.
  - *Swamp:* fog, reeds, stumps and creaky boardwalks. The rivers are lily
    pads that wobble and sink if you stand on one for more than a second or
    so, then bob back up later. Frogs croak, and fireflies come out at night.
  - *Autumn woods:* orange and red trees, falling leaves, logging trucks, and
    leaf piles that make your next hop slow.
  - *Harbor:* wooden docks with bollards, crates, barrels and stacked
    shipping containers; forklifts on the roads; and big slow ferries to ride
    across the water, with gulls overhead.
- **Roadside stands.** Now and then a little striped stall sits on a grass
  row selling one power-up (shield, magnet, jetpack...) for a few of this
  run's coins. Hop into it to buy, if you can afford it.
- **Combo fever.** Reach a x10 close-call combo and the screen glows gold:
  every coin is worth triple until the combo breaks.
- **Graveyard markers.** A little cross marks the spot where your last run
  ended (you can turn it off in Settings).
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
- **Traffic:** small cars, sedans, sports cars, pickups, vans, buses, tanker
  trucks, tractors, logging trucks and forklifts. Normal drivers brake for the car ahead. Traffic gets faster and
  denser, and roads widen from 1–2 lanes to 5.
- **Reckless drivers and police chases.** Every 12–20 seconds a red speeder,
  sometimes with a police car and siren right behind it, rear-ends traffic
  near you. Crashes explode, and a blast knocks you back and stuns you if
  you're close. Tanker trucks go up in a huge fireball that wrecks nearby cars.
- **Railroads.** Crossing signals flash and a bell rings, then a fast freight
  train comes through. A yellow RR sign at the screen edge shows which side
  it's coming from. Sometimes a car has stalled on the tracks.
- **Rivers.** Ride the drifting logs (ice floes in the mountains, rafts in the city, lily pads in the swamp, ferries at the harbor) across. Missing a log, or riding one off
  the edge, ends the run.
- **Weather.** Rain makes cars brake late and occasionally skid into each
  other. Snow slows traffic and whitens the ground. Fog hides the road ahead
  in the swamp and harbor, and leaves fall in the autumn woods.
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

## Reverse Day

Every couple of minutes in Endless and Hardcore, the whole screen flips over
like a card and for 20 seconds you're the car. Chickens stream across a
five-lane highway, some stop dead in the middle, and now and then a whole
flock crosses in a line with one gap to thread. Up and down change lanes,
right speeds up, left brakes. Every chicken you pass untouched is a coin
(golden chickens are worth 5, and every 10 in a row pays a bonus). Every one
you hit costs 3 coins and a point off your licence. Lose all 5 points and your
licence is revoked early. Then the world flips back, and the real road
carries on exactly where you left it.

## Big J's rage stomp

Only Big J has it. His face gets angrier with every close call, and with every
crash or blast that rattles him: the brow drops, the frown deepens, an anger
vein pops, he starts to shake and steam, and at maximum rage his eyes go
white-hot. A RAGE meter on the HUD shows how close he is. At maximum he leaps
up and slams the ground: a shockwave cracks the road and throws every car
around him clear (worth points for each one). Big S doesn't rage. He builds up
*calm* instead (a blue CALM meter): at maximum, every car on the road simply
stops for 3 seconds, and his face stays exactly `:|`.

## The egg

Now and then an egg sits on the road (single player only). Pick it up and you
carry it on your head. Get it 50 rows further without dying (the HUD counts
the rows) and it cracks open into a rare pet you can't buy anywhere. Die and
it breaks. Each egg hatches a pet you don't have yet (rares are the most
common, legendaries the rarest); once you have all twelve, eggs are full of
coins instead. A Ghostie pet makes eggs show up twice as often.

- *Phoenix Chick* (legendary): once per run, brings you back from any death,
  even the river or the danger line, and torches every car around you.
- *Baby Dragon* (epic): breathes fire on any car about to hit you.
- *Unicorn* (epic): rainbow steps appear under you on water, so you can walk
  across rivers, and every coin is worth double.
- *Golden Goose* (rare): lays a golden egg worth 10 coins every few seconds,
  and doubles your XP.
- *Time Owl* (rare): all traffic moves slower, and time slows down when a car
  is about to hit you.
- *Stone Golem* (legendary): blocks a hit every 20 seconds, as often as it
  takes (its eyes dim while it recharges).
- *Fairy* (epic): gives you a random power-up every 25 seconds.
- *Space Buddy* (epic): UFOs won't take you, and every secret event or Reverse
  Day you survive pays 50 coins.
- *Frost Fox* (epic): freezes all traffic for 3 seconds every 30 seconds.
- *Treasure Mole* (rare): digs up 25 coins every 40 rows.
- *Robo Pup* (rare): fetches power-ups from far away, and they last 50% longer.
- *Lucky Cat* (rare): far more coins show up on the road.

## Progression

- **Levels and XP:** every run earns XP (rows, coins, close calls, events
  survived and new trophies; Hardcore pays 1.5x). Each level pays coins, and
  levels all the way up to 50 unlock things: Silver Chick (level 3), Robo
  Chick (5), Neon Chick (8), the Halo (10), Diamond Chick (12), the Shooting
  Stars trail (14), Golden Chicken (16), the Wizard Hat (18), a Phoenix that's
  always on fire (20), the Galaxy trail (22), Galaxy Chick (25), the Space
  Helmet (28), Lava Dino (30), the Lightning trail (32), Crystal Fox (35), the
  Crown of Fire (38), Shadow Cat (40), the Aurora trail (42), Cosmic Big J (45),
  and at level 50, Golden Big J and the Pure Gold trail. The report shows the
  XP you earned and what the next level unlocks.
- **Shop:** 159 cosmetics in four tabs, with a collection counter at the top.
  Unlocking everything takes a day or two of playing.
  - **Skins (62):** chicks in every colour, Crow, Cardinal, Blue Jay, Rubber
    Duck, Flamingo, Toucan and City Pigeon; four-legged critters (Pig, Mouse,
    Ginger Cat, Bunny, Black Cat, Puppy, Moo Cow, Fox, Bear, Tiger, Monkey,
    Koala, Panda, Dino, Robot, Alien, Lil Devil and a winged Dragon); one-offs
    (Snowman, Pumpkin, Slime, Ghost and Burger); and Big J, Big S (`:|`) and
    their cousins Big G (happy), Big O (sleepy), Big P (shocked) and Rainbow
    Big J (6,700 coins).
  - **Hats (36):** from a beanie, cap and bow up to a viking helmet, sombrero,
    mohawk, antlers, mushroom cap, tiara, jack-o-lantern and devil horns.
  - **Trails (27):** hearts, leaves, snowflakes, music notes, slime, pixels,
    cherry blossoms, ink, bats, little ghosts, coins, cash and more.
  - **Pets (34):** see below, plus the egg-only ones above.
- **Pets:** a companion that follows you around, each with a trick:
  - *Duckling:* +25% XP every run.
  - *Dog:* runs off to fetch coins near you.
  - *Cat:* nine lives, blocking one hit per run.
  - *Mini Big J:* glares at seagulls so they won't dive at you.
  - *Drone:* hovers overhead, lights up the road at night and pulls in nearby
    coins.
  - *Pigeon:* drops a coin near you every few seconds.
  - *Parrot:* squawks a warning before trains and reckless drivers arrive.
  - *Turtle:* surfaces under you if you fall in the water, then needs 12
    seconds' rest.
  - *Mini Tornado:* vacuums up every coin nearby.
  - *Pet Rock:* does absolutely nothing. It's a rock.
  - *Hamster:* 1 in 5 coins is worth double.
  - *Slimeling:* squeezes out a coin every 15 rows.
  - *Crab:* +25 coins every time you reach a new biome.
  - *Penguin Chick:* ice doesn't make you slide.
  - *Bat:* close calls are worth double points.
  - *Fox Kit:* +20% XP every run.
  - *Snail:* the danger line creeps up 15% slower.
  - *Bumblebee:* power-ups last 30% longer.
  - *Bunny:* you start every run with a shield.
  - *Panda:* missions pay 25% more.
  - *Ghostie:* eggs show up twice as often.
  - *Goldfish* (trophy): a fish in a bowl that gently pulls coins toward you.
- **More power-ups:** Jetpack (blast off and land on safe ground about 5 rows
  ahead), Ghost (cars and trains pass straight through you for 4 seconds),
  Shrink (a tiny chicken with a tiny hitbox for 7 seconds) and Horn (every car
  nearby slams on its brakes, even speeders), plus:
  - *Pogo Stick:* for 6 seconds every forward hop clears two rows.
  - *Time Stop:* rare. For 2.5 seconds the whole world freezes (cars, trains,
    rivers, the danger line) while you keep moving.
  - *Coin Rain:* coins tumble onto the next eight rows.
  - *Bubble:* for 6 seconds you float on water. If it runs out while you're
    still on the water, it pops.
  - *Decoy:* leaves a fake you behind for 10 seconds. The giant goose, UFOs,
    meteors and lightning go after it instead of you.
- **Trophies:** 38 achievements, such as surviving three explosions in one run,
  a close call with a train, getting trampled by a deer, getting picked up
  by a tornado and living, playing 500 runs, reaching row 500, or owning 40,
  90 and finally every cosmetic. Many unlock things you can't buy: the Crash
  Test Dummy, Penguin, Zombie Chick, Old Timer and Rainbow Chick skins, the
  Eggshell and Driver Cap hats, the Earthquake, Turbo and Diamonds trails, and
  the Goldfish.
- **Stats:** lifetime totals in the trophy room: runs, time played, rows,
  coins, wrecks, close calls, trains dodged, best scores per mode and deaths by
  cause.
- **Shields stack:** grab two shields and you can take two hits; the HUD and
  the bubbles around you show how many are left.
- **Missions:** three goals at a time, like crossing lanes, riding logs,
  surviving crashes or reaching a row, each paying coins.
- **Ghost:** a faint "BEST" ghost replays your best run alongside you.
  You can turn it off in Settings.

## Settings

Open **Settings** from the title screen, the pause screen or the game-over
report. Your choices are saved in the browser.

- **Sound** (also `M`) and **Screen shake** (camera shake on crashes and hits).
- **Reduced motion:** no shake, zoom punches or blur, softer flashes. It's on by
  default if your system asks for reduced motion.
- **Colorblind-friendly:** warnings use shapes and stripes, not just red: a
  striped danger line, triangle and "P" badges for speeders and police, and
  crosshairs on meteor targets.
- **Ghost of best run** and **Death replay** (a slow-motion instant replay of
  how you died, which any key or tap skips).
- **Graveyard markers:** show where you died last run.
- **Performance mode:** lower resolution and fewer particles for slower
  computers and phones. Even with it off, the game drops its resolution by
  itself if frames start running slow, and steps back up when they're smooth.
- **Controls:** rebind the four movement keys.
- **Reset all data:** wipes your coins, levels, cosmetics, trophies, stats,
  best scores and missions (your settings and controls are kept). It shows a
  warning first, and you have to confirm twice.
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

## Admin panel

A cheat menu for testing and messing around. Tap the "EXIT 1" tab on the
title sign 7 times quickly to open it; after that it's also on the pause menu
for the rest of the session. From there you can:

- set your coins or level, or unlock every skin, hat, trail and trophy
- turn on god mode (nothing can kill you), switch off the danger line, show
  hitboxes, or use a free camera (arrow keys or WASD, Esc to exit)
- change the game speed from 0.25x to 3x
- spawn any vehicle just ahead, clear all traffic, fill the road with coins,
  blow up every car on screen, or kill yourself to see the replay
- give yourself any pet (including the egg-only ones)
- start a Reverse Day, drop an egg in front of you, hatch one on the spot, or
  max out Big J's rage
- grant any power-up, start any secret event, or summon a tornado, lightning,
  a drunk driver, a reckless driver, a cow, deer or a seagull
- force the weather or jump to morning, sunset or night
- jump to any biome, or skip 25 or 100 rows ahead
- reset all progress (it asks twice)

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
| `js/world.js` | `World`: endless row generation (ground, road, rail, river, road work), nine biomes, weather |
| `js/vehicles.js` | `Vehicles`: types, lanes, braking, skids, crashes, blasts, responders, crash director |
| `js/hazards.js` | `River` (logs), `Rail` (signals, trains, trams, stalled cars), `Work` (excavators) |
| `js/animals.js` | `Animals`: cows, deer, tumbleweeds, seagulls, paramedics |
| `js/pets.js` | `Pets`: the companion that follows you, and the egg pets' powers |
| `js/player.js` | `Player` / `Player2`: hops, ice, log riding, knockback, stun, abduction, deaths |
| `js/powerups.js` | `Items` + `Powers`: coins, pickups and power-up timers |
| `js/progress.js` | `SKINS`, `HATS`, `TRAILS` + `Shop`, `Missions`, `Ghost` |
| `js/trophies.js` | `Stats`, `Trophies` and `Levels` |
| `js/events.js` | `Events`: secret events |
| `js/storms.js` | `Storms`: lightning and tornadoes |
| `js/specials.js` | `Rage` (Big J's rage stomp and Big S's calm), `Egg` (carrying and hatching) and `Graves` (where you died last run) |
| `js/reverse.js` | `Reverse`: Reverse Day, where you drive and the chickens cross |
| `js/camera.js` | `Cam`: follow (one or two players), shake, zoom |
| `js/lighting.js` | `Lighting`: day and night, darkness layer and lights |
| `js/renderer.js` | `Renderer` + `Sprites`: frame composition, depth sorting, overlays, cached sprites for scenery and car bodies, adaptive resolution |
| `js/replay.js` | `Replay`: records the last seconds and plays the death back |
| `js/input.js` | `Input`: keyboard bindings, touch and game controllers |
| `js/admin.js` | `Admin`: the hidden admin panel |
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
