# explodingcar
car go boom

## Play

**https://carvinuke.github.io/explodingcar/**

The front page is the **Solarian Arcade**. Pick one of four:

- **[Road Rush](road-rush/)**: an endless cross-the-road arcade game with
  power-ups, reckless drivers and exploding car crashes that knock you back.
- **[Traffic Control](traffic-control/)**: run a busy crossroads by switching
  the traffic lights. Let two streams of traffic meet and they go boom. Clear
  5 levels to unlock Custom Shift: lay out anything from one crossing to a 3×3
  grid, tap each crossing to pick its shape and whether it runs on smart or
  timer lights, then tune the traffic, speed, turning, reckless drivers and
  patience, the mix of nine kinds of vehicle, rain, snow or fog by day, dusk or
  night, trains, the goal, a time limit, crashes allowed, the amber light and
  power-ups. Save your favourite shifts, try a ready-made idea, or roll a random
  one. Harder settings pay more.
- **[Boom Run](boom-run/)**: floor it down an endless highway. Scrape past
  traffic to fill your boost bar, burn it to go faster, and when it's full set
  off BOOM: a few seconds where every car you touch goes up, and the wrecks you
  send flying set off the cars they land on. There are no brakes: once you're
  fast you stay fast. Roadworks, oil slicks, car carriers to launch off,
  tunnels, and a garage with the luxury lot. Hyperdrive mode has no speed limit
  at all: every boost adds speed for good and the camera pulls back to keep up.
- **[Hall of Art](hall-of-art/)**: a gallery of 61 interactive exhibits:
  living buttons (bubble wrap, a switchboard puzzle, a slot machine, a panel of
  switches), moving pictures (fireworks, a koi pond, a plasma globe, the Game
  of Life, a rainy window to wipe, soap bubbles), lettering that won't sit
  still (fridge magnets, a split-flap departure board, a graffiti wall),
  sculpture and physics pieces you can drag, swing and throw (falling sand,
  plinko, pinball, a snow globe, laser mirrors, dominoes, a pane of glass), a
  Music Room (a drum machine, a theremin, wind chimes), and Road Works, where
  the arcade's real cars crash test, pose in a showroom and get a car wash.

Coins are shared: whatever you earn in one game can be spent in any of them.

Keep an eye out on every road for the luxury cars: the Elfer and Elfer
Classic, the Toro V12 and Toro Furia, the Rosso F8 and Rosso Superfast, the
Veloce, the Regent and the Gelände (lookalikes, every one).

## Play on your own computer

Everything works offline, with no install:

1. Download the repository (Code → Download ZIP) and unzip it.
2. Double-click `index.html`.

That's it. If your browser keeps coins separate between the games when opened
straight from disk (some versions of Firefox do), run `play-local.bat`
(Windows) or `play-local.sh` (Mac/Linux) instead. These start a tiny local web
server with Python and open the arcade in your browser.

## Layout

- `index.html`: the Solarian Arcade menu.
- `shared/`: the arcade's fonts, styles, menu art (`art/`, with the script that
  draws it), the shared coin wallet (`wallet.js`) and helpers the games share.
- `road-rush/`, `traffic-control/`, `boom-run/`, `hall-of-art/`: one folder per page.
  Traffic Control and Boom Run reuse Road Rush's drawing, explosion and sound
  code straight from `road-rush/js/`.
