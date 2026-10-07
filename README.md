# explodingcar
car go boom

## Play

**https://carvinuke.github.io/explodingcar/**

The front page is the **Car Go Boom arcade**. Pick one of four:

- **[Road Rush](road-rush/)**: an endless cross-the-road arcade game with
  power-ups, reckless drivers and exploding car crashes that knock you back.
- **[Traffic Control](traffic-control/)**: run a busy crossroads by switching
  the traffic lights. Let two streams of traffic meet and they go boom.
- **[Boom Run](boom-run/)**: floor it down an endless highway, weaving through
  traffic for close calls, power-ups and coins.
- **[Toy Box](toy-box/)**: a page of shiny things to poke: buttons with fun
  effects, swirling particles, bouncy physics and text that comes apart.

Coins are shared: whatever you earn in one game can be spent in any of them.

## Play on your own computer

Everything works offline, with no install:

1. Download the repository (Code → Download ZIP) and unzip it.
2. Double-click `index.html`.

That's it. If your browser keeps coins separate between the games when opened
straight from disk (some versions of Firefox do), run `play-local.bat`
(Windows) or `play-local.sh` (Mac/Linux) instead. These start a tiny local web
server with Python and open the arcade in your browser.

## Layout

- `index.html`: the arcade picker.
- `shared/`: the arcade's fonts, styles, panel art, the shared coin wallet
  (`wallet.js`) and helpers the new games share.
- `road-rush/`, `traffic-control/`, `boom-run/`, `toy-box/`: one folder per page.
  Traffic Control and Boom Run reuse Road Rush's drawing, explosion and sound
  code straight from `road-rush/js/`.
