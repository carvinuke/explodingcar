# Toy Box

A page of 31 little interactive toys: things a web page can do, just for fun.
Part of the Car Go Boom arcade. No build step, no libraries, works offline.

| Shelf | Toys |
|---|---|
| Buttons | Magnetic Button, Jelly Button, Confetti, Liquid Fill, Ripple, Glitch, Neon Sign, Hold to Explode, Clicky Keys, Morphing Icons |
| Motion | Flow Field, Flock, Lava Lamp, Warp Speed, Pendulum Wave, Spirograph, Lissajous Knot, Aurora |
| Text | Shy Letters, Decoder, Wave Text, Chrome, Typewriter |
| 3D & Physics | Holo Card, Spin the Cube, Rope, Bouncy Balls, Newton's Cradle, Cloth |
| Car Go Boom | Drift Doodle, Chain Reaction |

Every toy has a full-screen button. The page remembers which toys you've
tried (the arcade picker shows the count). Sound shares the arcade's mute.

## Kind to slow computers

- One shared frame loop, and only toys that are on screen animate.
- Heavier toys draw small and stretch up, batch their lines, or cache pictures.
- If frames get slow, toys take turns updating; if it stays slow for a few
  seconds, the page switches itself to Low graphics (fewer particles, lower
  resolution) and says so. There's a Low graphics switch at the top too.
- `prefers-reduced-motion` is respected: toys only move while you play with them.

## Code

- `js/runner.js`: the toy runner (tiles, the loop, pointer tracking, full screen, sound blips).
- `js/toys-*.js`: the toys, one `Toys.add({...})` each.
