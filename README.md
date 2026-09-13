# Dr. Milap Jhumkhawala — the website that is a game

A retro top-down world you walk through. Explore the cloud town with Myra the
cat and cross the bridges into three lands: a dark castle for my **Education**,
the ashlands for my **Work Experience** and a sunken city for my **Personal
Projects**.

Built with [Phaser 3](https://phaser.io) and
[Grid Engine](https://github.com/Annoraaq/grid-engine), in TypeScript.

## Run it locally

```bash
npm i
npm run serve      # http://localhost:8000
```

## Change things

- Words (intro, signs, doors, Myra): `src/content.ts`
- The world layout: `tools/build_map.py`, then `npm run map`
- Game logic: `src/scenes/WorldScene.ts`, dialog UI: `src/ui/DialogBox.ts`

## Controls

Arrow keys or WASD to walk. Face a sign or plaque and press SPACE to read it.
Walk up to the castle door and it opens; walk through to enter.

## Credits

Pixel art by [finalbossblues](https://finalbossblues.itch.io) (Time Fantasy:
Cloud City, Dark Dimension, Ashlands and Atlantis tilesets, character sprites) and the Liberated
Pixel Cup cat from OpenGameArt. Full list in [CREDITS.md](CREDITS.md).
