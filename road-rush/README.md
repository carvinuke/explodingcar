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

## Claw machine

The Claw Machine button on the title screen. A **Grab** costs 500 coins and a
**Gold Grab** costs 1,000 (double the odds). Watch the claw drop, grab and
carry its prize to the chute:

- **0.5%** (1% on a Gold Grab): a **Jackpot pet** you can't get anywhere else.
  The **Magnet Bot** is a permanent magnet that pulls in every coin and
  power-up nearby; the **Lucky Star** makes every coin worth double and gives
  you a shield at the start of every run.
- **10%** (20%): a claw-only cosmetic: Plushie Chick, Arcade Chick, Claw Hat,
  Prize Tickets trail, Arcade Lights and Jackpot auras, Arcade Tokens
  footprints, and the High Roller and Claw Master titles.
- Otherwise you get 100 coins back (200 on a Gold Grab).

## So close

The report at the end of a run points out what you nearly reached: "Just 70
points from your best!", "30 XP to level 5", "80 coins from a claw machine
grab", your next upgrade, or a mission you're most of the way through.

## Upgrades

The shop's Upgrades tab sells permanent upgrades for every single-player run.
Each has a few levels, and each level costs more (82 levels in all). Nothing
pops up mid-game; you buy them between runs:

- **Movement:** Faster Jump (+6% hop speed per level), Head Start (a slower
  danger line).
- **Coins:** More Coins (+15% coins on the road per level), Lucky Coins (some
  coins are worth double), Coin Magnet, Odometer (coins every 10 rows),
  Savings Account (bonus coins at the end of a run), Haggler (half-price
  roadside stands).
- **XP & score:** More XP (+10% per level), Longer Combos, Fever Pitch (combo
  fever starts sooner).
- **Traffic:** Fewer Cars (+7% space between cars per level), Slower Cars,
  Late Trains, Sunday Drivers (no reckless drivers).
- **Power-ups:** More Power-ups, Longer Power-ups.
- **Defense:** Starting Shield (up to two), Slim Fit (a smaller hitbox), Life
  Jacket (stay afloat once per biome), Lucky Charm (secret events can't kill
  you), Second Wind (come back from one death per run).
- **Luck:** Box Finder, Egg Finder, Treasure Map (more secret manholes), Extra
  Time (Time Attack).

## Golden runs and secret rooms

- **Golden runs:** about 1 run in 40 starts golden. Every car turns gold, gold
  dust drifts across the screen and every coin is worth double.
- **Secret rooms:** now and then there's a manhole on the grass with a glint of
  gold under it. Step on it and you drop into a secret vault with 9 seconds to
  grab coins, gold bars and a big gem. One in four is a treasure room with a
  mystery box at the back. The road waits for you while you're down there.

## Long-term goals

The Goals button on the title screen has three pages:

- **Biome mastery:** every biome has three stars: cross it in one run, cross
  it without grabbing a power-up, and get a x8 close-call combo in it. All
  three stars unlock that biome's reward: Country Hen, Neon City trail, Desert
  Lizard, Yeti, Sea Spray trail, Harvest Chick, Bog Frog, Maple Storm trail
  and Harbor Gull.
- **Roadex:** a collection book of everything you've seen on the road:
  vehicles, critters, secret events, power-ups, biomes, weather and
  specials. Every new entry pays 10 coins, every finished page pays 250
  and unlocks a reward (Gearhead, Little Lamb, Weirdo Magnet, Power Surge
  trail, Globetrotter, Storm Chaser trail and the Treasure Chick), and finishing the whole book unlocks the Hologram Chick.
- **Prestige:** at level 50 you can prestige. You go back to level 1 and keep
  everything you've unlocked, and you get a star next to your level and a
  permanent +5% coins and XP, up to 10 times. Prestige 1, 3, 5 and 10 unlock
  the Reborn title, the Prestige Chick, the Prestige Stars trail and the
  Immortal title.

Two more things keep going between runs:

- **Box shards:** every mystery box has a shard in it, and a mystery-box
  exclusive you already own turns into 5 more. Spend 20 shards in the shop to
  craft any exclusive you're missing.
- **Pet evolutions:** a level 5 pet can evolve for 1,500 coins. Mega pets are
  bigger, glow gold with sparkles around them, and give +20% XP and +10% coins.

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
- **Shop:** 267 cosmetics in seven tabs, plus the Upgrades tab, with a collection counter at the top.
  Unlocking everything takes a day or two of playing.
  - **Auras (30):** a glow that's always around you: Soft Glow, Sparkle Cloud,
    Love Bubble, Leaf Whirl, Sakura Breeze, Frost Swirl, Flame Ring, Toxic
    Fumes, Coin Orbit, Bat Swarm, Haunted, Static Charge, Shadow Smoke,
    Rainbow Ring, Glitch Field, Diamond Dust, Moon Orbit, Solar Flare, Golden
    Halo and more, plus Northern Lights, Galaxy and The Void (levels 24, 33
    and 44), Storm Cell and Royal Glow (trophies) and the Prestige Aura.
  - **Footprints (14):** marks you leave on the ground for a few seconds:
    chicken tracks, paw prints, hearts, snow boots, stars, slime, pixels,
    flickering fire, flowers that pop up, ghostly steps, neon, rainbow and
    diamonds.
  - **Titles (22):** a title shown under your score, like Road Runner,
    Daredevil or Chicken Royalty, or earned ones like Egg Hunter, Rage
    Machine, World Traveler, Master and Legend.
  - **Outfits:** three saved slots at the top of the shop. Save what you're
    wearing (character, hat, trail, pet, footprints and title)
    and switch back to it in one tap.
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
- **Mystery boxes:** a rare purple box on the road. Grab it and it's opened on
  the report at the end of the run: coins, a cosmetic you don't have yet, or
  one of eight mystery-box exclusives you can't get any other way: the Disco
  Chick (a dance floor lights up under you), the Glitch Chick (flickers
  between dimensions), the Storm Cloud hat (your own raincloud, with
  lightning), the Black Hole trail (a vortex that pulls in coins next to
  you), the Mimic (a treasure-chest pet that eats the coins you hop past and
  gives them to you), the Midas Touch footprints (now and then a step leaves you a
  coin), and the titles The Chosen One and Lucky Duck.
- **Pet levels:** your pet earns the same XP you do each run and levels up to
  5. At level 5 its perk gets stronger: the cat blocks two hits, the phoenix
  brings you back twice, the dog fetches from further away, the duckling
  gives +40% XP, and so on (the shop card shows each pet's level and its
  level-5 upgrade).
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
  Shrink (8 seconds as a tiny chicken: a tiny hitbox, buses, vans, trucks,
  ambulances and fire trucks roll right over you, your hops are quicker, and
  every coin is worth double) and Horn (every car
  nearby slams on its brakes, even speeders), plus:
  - *Pogo Stick:* for 6 seconds every forward hop clears two rows.
  - *Time Stop:* rare. For 2.5 seconds the whole world freezes (cars, trains,
    rivers, the danger line) while you keep moving.
  - *Coin Rain:* coins tumble onto the next eight rows.
  - *Bubble:* for 6 seconds you float on water. If it runs out while you're
    still on the water, it pops.
  - *Decoy:* leaves a fake you behind for 10 seconds. The giant goose, UFOs,
    meteors and lightning go after it instead of you.
- **Trophies:** 52 achievements, such as surviving three explosions in one run,
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
- start a Reverse Day, drop an egg in front of you, hatch one on the spot,
  max out Big J's rage, spawn a roadside stand, a mystery box or a secret
  manhole, start combo fever, max every upgrade, win a claw machine Jackpot pet, make your next run
  golden, max out your pet's level, add box shards, or earn every biome star
  and fill the Roadex
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
| `js/extras.js` | `Prints` (footprints), `Boxes` (mystery boxes) and `PetLevels` |
| `js/upgrades.js` | `Upgrades` (the shop's permanent upgrades), `Golden` (golden runs) and `SecretRoom` |
| `js/claw.js` | `Auras` (drawing every aura), `Claw` (the claw machine) and `SoClose` (report notes) |
| `js/goals.js` | `Mastery` (biome stars), `Roadex`, `Prestige`, `Shards` and `Evolve` (pet evolutions) |
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
