# CLAUDE.md

Personal website for Dr. Milap Jhumkhawala, built as a retro top-down 2D game.
The visitor walks a character (with Myra the cat following) around a floating
cloud town and crosses bridges into three lands: the Dark Dimension castle
(**Education**, west), the Ashlands plateau (**Work Experience**, east) and the
sunken city of Atlantis (**Personal Projects**, south). Each land has stone
plaques you read with SPACE. The castle door opens as you approach and leads
into a stone hall. Every page load starts with an intro dialog.

## Stack

- Phaser 4.0 renders the scene; `pixelArt: true`. The logical canvas is picked
  by orientation at startup (1024x768 landscape, 420x746 portrait) and scaled
  with `Scale.FIT`, so phones get a tall playfield instead of a letterboxed
  strip. The dialog box uses smaller type and a taller box under 700px wide.
- Grid Engine 2.52 (Phaser plugin, `this.gridEngine`) does tile movement,
  collision (`ge_collide` tile property), NPC follow and the
  `positionChangeFinished()` stream.
- The map is **generated**, not hand-drawn: `tools/build_map.py` writes
  `assets/world.json` (Tiled 1.10 JSON) from tile ids. Never edit `world.json`
  by hand; change the script and re-run it.
- esbuild bundles `src/main.ts` to `main.js` (gitignored build artifact).
  `tsc --noEmit` is used for type-checking only.
- The "Press Start 2P" pixel font is loaded from Google Fonts in `index.html`;
  `main.ts` waits for it (max 2.5 s) before starting the game.

## Commands

```bash
npm i                # install
npm run map          # regenerate assets/world.json from tools/build_map.py
npm run build:dev    # bundle src/main.ts -> main.js
npm run build        # minified bundle
npm run typecheck    # tsc --noEmit
npm run serve        # esbuild dev server on http://localhost:8000
```

In the Claude sandbox esbuild's `--serve` cannot bind a port. Build once and
serve the folder with `python3 -m http.server 8000 --bind 127.0.0.1` instead.
Rebuild after every source change; the static server does not rebuild, and the
browser caches `main.js` and `world.json`, so force a cache-bypassing reload.

## Git identity

This repo is committed and pushed only as **milapj**. The remote is
`git@github-milapj:milapj/website.git` (an SSH alias in `~/.ssh/config`) and
the repo-local `user.email` is `milap.jhumkhawala@gmail.com`. Never change
the global git config for this repo, and never use any other GitHub account
or identity here. For `gh` commands run `gh auth switch --user milapj` first.

## Code layout

| File | Role |
|---|---|
| `src/main.ts` | Phaser game config, font wait, exposes `window.game` for console debugging |
| `src/scenes/WorldScene.ts` | Loads assets, builds the tilemap, creates the player and Myra, wires input, signs, portals, zone banners, the animated castle door, floating crystal sprites and Myra's bubble |
| `src/ui/DialogBox.ts` | Retro dialog box fixed to the camera: speaker tab, typewriter text, bobbing "more" triangle. SPACE / ENTER / click finishes typing, advances, then closes |
| `src/ui/SpeechBubble.ts` | Small world-space bubble that follows a sprite (Myra's "Feed me?") |
| `src/ui/TouchPad.ts` | On-screen D-pad + action button for touch devices (semi-transparent white, bottom-right, only shown when the device has a coarse pointer). Holding a pad button sets `held`, which `WorldScene.update` treats like a held key |
| `src/ui/WellForm.ts` | The Well of Sending contact form (an HTML overlay in `index.html`). POSTs to `WELL_ENDPOINT` from `content.ts` (a form-to-email service, no server needed) or falls back to a mailto: letter when the endpoint is empty. Disables the game's keyboard while open |
| `src/content.ts` | **All words**: `INTRO_DIALOG`, `MYRA_BUBBLES` and the `INTERACTIONS` record keyed by plaque/sign id (merged with the generated trophy dialogs). Edit this to change what anything says |
| `src/skills.json` + `src/skills.ts` | The trophy room's single source of truth: technologies grouped by category (categories only order them; they are not shown in-game), their tier (gold/silver/bronze) and `big` for the two showcase trophies. The generator reads the JSON to place trophies; `skills.ts` turns it into dialogs |
| `tools/build_map.py` | World generator (see below) |
| `assets/` | Tilesets, sprite sheets and the generated `world.json` |

## Map objects (written by build_map.py, read by WorldScene.readObjects)

| type | meaning |
|---|---|
| `sign` | readable tile: face it and press SPACE, or walk into it; `name` is the id in `content.ts`. Extra props draw effects: `medal` (gold/silver/bronze plaque), `fire` (burning/smoldering), `trophy` (+ `big`) |
| `portal` | stepping on it teleports to (`tx`,`ty`) facing `face`; Myra reappears one step behind |
| `region` | rectangle (width/height in tiles) naming a land (`title`); the land's name is shown as one big heading at the top of the screen for as long as the player is inside, and fades out on leaving |
| `door` | animated Dark Dimension door sprite covering `cols` x `rows` tiles; opens when the player reaches the row below it |
| `prop` | animated sprite from the floating-rocks sheet (`kind`: crystal-tall, crystal-small, rock-a, rock-b); the tile is blocked with an invisible Blocker tile |
| `spawn` | `spawn-player` / `spawn-myra` |

Myra's bubble is automatic: whenever she and the player face each other and
she is standing still, the next line of `MYRA_BUBBLES` appears above her.
SPACE while facing her opens her full dialog.

## Map facts (tile coordinates, 16 px tiles, drawn at 3x = 48 px)

- Map is 96x78. Rows 0-47 are starry void, rows 48-77 are dark sea. Both
  collide. The lands are generated at their "long bridge" positions and then
  pulled toward the hub by `shift_region()` at the end of the script (castle
  +8 x, ashlands -7 x, atlantis -10 y); finally everything below the trophy
  room (y >= 19) is pushed down by `WORLD_DY` = 6 rows so the north bridge is
  as long as the others. **All coordinates below are the final ones, i.e.
  the pre-shift numbers in the script plus 6 in y** (except the trophy room).
- Cloud hub: Milap's original hand-made 20x20 map (`tools/hub.json`), blitted
  in at offset (34,20) in the script, (34,26) final, without its `buildings`
  layer (the house is gone) and without the two pots by the fountain. The
  angel statue (2x3) and its slab (3x1) stand over the pool as the Well of
  Sending (sign id `fountain`); closing its dialog opens the contact form. Its tileset collision flags are reused. Spawn is
  the original (3,3) = (37,29) final. Four paths leave it, each under a
  passable archway drawn on the `top` layer with no collision: west bridge
  rows 29-30, east bridge rows 35-36, south pier columns 42-43, north bridge
  columns 44-45 (y 19-28). Never put solid arch tiles across a path.
- Education: cobblestone island x 10-27, y 12-30; castle facade at (14,13)
  with the 2-wide doorway at x 17-18, y 20-22 (bottom row walkable = portal),
  doorstep y 23. Bridge y 23-24 from x 28 to 35 (8 tiles). The hall is at x 73-92,
  y 3-13 with its exit doorway at x 82-83, y 13 (portal back).
- Work Experience: compact ash plateau x 59-76, y 28-43 (final) with two
  lava lakes and a water pool; bridge y 35-36 from x 52 to 58; gravel road
  y 35-36. Two 2x2 plaques drawn by the scene (`fire` + `big` props, the
  anchor tile is the bottom-left): `work-1` burning by the road, `work-2`
  ashen and smouldering above the bottom-left lava lake.
- Personal Projects: sand floor x 26-60, y 46-59 inside a teal rock rim; pier
  x 42-43 from the hub's south edge (y 36) down to y 45 (10 tiles); plaques
  `proj-1` (dissertation) and `proj-2` (white paper, has a `link`). Atlantis
  decor is placed relative to `PIER_X` via `atl()`. The green brick ruin's
  dark doorway at (52,49) is a portal down to the vault.
- Technical Skills: Dark Dimension hall x 31-58, y 0-18 directly north of the
  town (the only area NOT pushed down by `WORLD_DY`). Path: 2-wide bridge at
  x 44-45 from the hall doorway (y 18) down to the island's top edge (y 28)
  under an archway; columns 8-9 of the island are blocked by the hedge, hence
  columns 10-11. Inside: a 4-wide blue-stone aisle (x 43-46) from the doorway
  to the showcase, where Kubernetes and Databricks stand side by side as 2x2
  trophies at (43-44, 2-3) and (45-46, 2-3). The other 44 trophies sit in
  two blocks (columns 33-41 and 48-56, rows 5, 7, 9, 11, 13), sorted gold
  first, then silver, then bronze, filled row by row across both sides. No
  plaques in the room; trophy ids are `skill-<category>-<index>`.
- Side Projects vault: brick room x 66-87, y 56-66 in the sea, region
  "SIDE PROJECTS"; plaques `side-1..3` (placeholders); exit doorway at
  x 76-77, y 66 portals back to (52,50) in front of the ruin.
- Tileset gid ranges: Cloud City 1-1260 (45 cols), Dark Dimension 1261-1869
  (`DD()`, 29 cols), Ashlands 1870-2709 (`ASH()`, 40 cols), Atlantis
  2710-3899 (`ATL()`, 34 cols), Blocker 3900. Labeled grid sheets can be
  regenerated with PIL to look up a tile.
- Layers in draw order: ground, ground2, buildings, objects, collision, top
  (`ge_alwaysTop`, used for tree canopies, seaweed and the three archways).

## Sprite completeness

Every multi-tile object must be stamped whole. Sprites in these sheets often
span more tiles than they look (the Ashlands dead tree is 2x5, the big tree
4x6, spiky rocks 3x2, red roots 3x1, the Atlantis obelisk 2x4, the open clam
2x2, five seaweed sprites 1x2). Before placing a new object, zoom the sheet
with PIL at 6x with a labeled grid and check which tiles its pixels touch, or
run a connected-pixel audit as was done on 2026-09-13.

## Assets and credit

All tilesets are Time Fantasy packs by finalbossblues (free packs, credit
required). Myra's sprite is "LPC Rat, Cat and Dog" from OpenGameArt. See
`CREDITS.md`; keep it updated when adding art.
