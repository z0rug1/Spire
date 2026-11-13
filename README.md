# Spire

A one-thumb climbing adventure up a single colossal tower, built for phones in portrait mode.
Plain HTML, CSS and JavaScript: no build step, no dependencies, no image or audio files.

**Play:** https://z0rug1.github.io/Spire/ (once GitHub Pages is switched on, see below)

<p>
  <img src="docs/title.png" width="19%" alt="Title screen">
  <img src="docs/roots.png" width="19%" alt="The Roots">
  <img src="docs/works.png" width="19%" alt="The Works">
  <img src="docs/gardens.png" width="19%" alt="The Gardens">
  <img src="docs/crown.png" width="19%" alt="The Crown">
</p>

## The game

You are a courier from the Roots, the lowest floors of a tower nearly eight kilometres tall.
The water that flows down from the Crown is failing, and nobody has heard from the Crown in a
generation. You climb the outside of the tower to find out why.

- **Four districts**, each with its own look, hazards and tool: the Roots, the Works (grapple line),
  the Gardens (seed-silk glider) and the Crown (magnet gloves).
- **17 camps** that save your climb, tell the story and sell upgrades for the chalk you collect.
- **Three faction choices** that change the epilogue, and **three endings**, one of them hidden.
- **Pitons** to set your own checkpoint mid-wall, a **lift** between camps you have reached, and
  chalk marks left on the wall wherever you fell.

## Controls

| Action | Touch | Mouse |
| --- | --- | --- |
| Leap | Pull back like a billiards cue (drag away from where you want to go), release | Same, with the left button |
| Grapple (the Works onward) | Tap a ring; if it is out of reach, leap first and tap mid-air | Click |
| Glide (the Gardens onward) | Hold a finger down mid-air; it steers toward your finger | Hold the button |
| Magnet plates (the Crown) | Leap onto a steel plate; the gloves catch at the top of the hop | Same |
| Piton | Piton button, bottom left | `P` |
| Pause | Pause button | `Esc` |

The dotted arc shows where a leap will take you and rings the hold it will catch. The ring around
the climber is your grip: it drains while you hang and refills on ledges. Pulling back keeps your
finger off the route so you can see the arc; if you prefer to drag forward instead, there is an
aim toggle on the title screen and in the pause menu.

## Put it online with GitHub Pages

1. Open the repository on GitHub, then **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick **main** and **/ (root)**, and save.
3. After a minute the game is live at `https://<your-username>.github.io/Spire/`.

On a phone, open that address and use *Add to Home Screen* to get a fullscreen, portrait icon.

To run it locally, open `index.html` in a browser. Nothing needs a server.

## Project layout

```
index.html            page shell, HUD and menus
css/style.css         all styling
js/core.js            physics, tools, hazards and tower generation (no DOM, also runs in Node)
js/story.js           camp dialogue, choices, upgrades, endings
js/render.js          canvas renderer; every piece of art is drawn in code
js/audio.js           sound effects and ambience synthesized with WebAudio
js/game.js            input, camps, saving, the main loop
tests/verify.js       an automated climber that proves the tower can be climbed
```

## Tests

```
node tests/verify.js        # add -v for a leap-by-leap log
```

The tower is generated from a fixed seed (`SEED` in `js/core.js`), so everyone climbs the same wall.
The test sends a bot from the first camp to the summit with base stats and no upgrades, and fails
if there is any gap it cannot cross. Run it after changing physics constants, district settings or
the seed.

## Tuning

Most of the feel lives in the `C` block at the top of `js/core.js` (gravity, leap power, grip drain,
grapple range, glide speed) and in `DISTRICTS` just below it (hold spacing, how often ledges appear,
which hazards each district uses). In the browser console, `Spire.dev.warp(8)` jumps to camp 8 with
the right tools unlocked.

## Scope

This is a complete 2D game from first camp to ending, at solo-project scale rather than studio
scale. Progress is stored in the browser's local storage on the device you play on. There is
no online play: the "marks left by other climbers" are your own falls.
