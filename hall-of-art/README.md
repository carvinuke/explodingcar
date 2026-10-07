# Hall of Art

A gallery of 31 interactive exhibits: things a web page can do, just for the
fun of it. Part of the Solarian Arcade. No build step, no libraries, works offline.

| Wing | Exhibits |
|---|---|
| Living Buttons | Magnetic Button, Jelly Button, Confetti, Liquid Fill, Ripple, Glitch, Neon Sign, Hold to Explode, Clicky Keys, Morphing Icons |
| Moving Pictures | Flow Field, Flock, Lava Lamp, Warp Speed, Pendulum Wave, Spirograph, Lissajous Knot, Aurora |
| Lettering | Shy Letters, Decoder, Wave Text, Chrome, Typewriter |
| Sculpture & Physics | Holo Card, Spin the Cube, Rope, Bouncy Balls, Newton's Cradle, Cloth |
| Road Works | Drift Doodle, Chain Reaction |

Every exhibit has a full-screen button. The page remembers which exhibits
you've explored (the arcade menu shows the count; progress from when this page
was the Toy Box carries over). Sound shares the arcade's mute.

## Kind to slow computers

- One shared frame loop, and only exhibits that are on screen animate.
- Heavier exhibits draw small and stretch up, batch their lines, or cache pictures.
- If frames get slow, exhibits take turns updating; if it stays slow for a few
  seconds, the page switches itself to Low graphics (fewer particles, lower
  resolution) and says so. There's a Low graphics switch at the top too.
- `prefers-reduced-motion` is respected: exhibits only move while you interact.

## Code

- `js/runner.js`: the exhibit runner (tiles, the loop, pointer tracking, full screen, sound blips).
- `js/exhibits-*.js`: the exhibits, one `Exhibits.add({...})` each.
