#!/usr/bin/env python3
"""
Generates assets/world.json, the Tiled (1.10 JSON) map the game loads.

The world is composed in code from four 16x16 Time Fantasy tilesets plus a
1-tile transparent "blocker" tileset used for invisible collision:

  Cloud City      gids 1..1260      (45 cols)  the floating hub town
  Dark Dimension  gids 1261..1869   (29 cols)  Education: castle island + hall
  Ashlands        gids 1870..2709   (40 cols)  Work Experience: lava plateau
  Atlantis        gids 2710..3899   (34 cols)  Personal Projects: sea floor
  Blocker         gid  3900                    invisible collision tile

Run:  python3 tools/build_map.py   (or `npm run map`)

Tile ids are the numbers on the labeled grid sheets. Cloud City labels are
already gids; the other sets use local ids wrapped with DD() / ASH() / ATL().
"""
import json
import random
from pathlib import Path

random.seed(7)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "world.json"

W, H = 96, 78  # map size in tiles (6 spare rows so the north bridge is as long as the others)
WORLD_DY = 6  # everything below the trophy room is pushed down by this at the end
T = 16  # tile size in px

CLOUD_FIRST, CLOUD_COLS, CLOUD_COUNT = 1, 45, 1260
DD_FIRST, DD_COLS, DD_COUNT = 1261, 29, 609
ASH_FIRST, ASH_COLS, ASH_COUNT = 1870, 40, 840
ATL_FIRST, ATL_COLS, ATL_COUNT = 2710, 34, 1190
BLOCK_FIRST = 3900
BLOCKER = BLOCK_FIRST


def DD(i):
    return DD_FIRST + i


def ASH(i):
    return ASH_FIRST + i


def ATL(i):
    return ATL_FIRST + i


# ----------------------------------------------------------------- layers
# Draw order: ground < ground2 < buildings < objects < collision < top
LAYER_NAMES = ["ground", "ground2", "buildings", "objects", "collision", "top"]
layers = {n: [0] * (W * H) for n in LAYER_NAMES}
collide: set[int] = set()  # gids that block movement
walkable: set[int] = set()  # gids explicitly walkable (wins over collide)
objects: list[dict] = []


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H:
        layers[layer][y * W + x] = gid


def get(layer, x, y):
    return layers[layer][y * W + x] if 0 <= x < W and 0 <= y < H else 0


def fill(layer, x0, y0, x1, y1, gid):
    """Inclusive rectangle fill. `gid` may be an int or a callable(x, y)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(layer, x, y, gid(x, y) if callable(gid) else gid)


def stamp(layer, x, y, rows, solid=True):
    for j, row in enumerate(rows):
        for i, gid in enumerate(row):
            if gid:
                put(layer, x + i, y + j, gid)
                if solid:
                    collide.add(gid)


def block(x, y):
    """Invisible collision on a tile (for sprites and thin props)."""
    put("collision", x, y, BLOCKER)


def weighted(pairs):
    gids = [g for g, _ in pairs]
    weights = [w for _, w in pairs]
    return lambda x, y: random.choices(gids, weights)[0]


def obj(name, otype, x, y, w=1, h=1, **props):
    objects.append(
        {
            "id": len(objects) + 1,
            "name": name,
            "type": otype,
            "x": x * T,
            "y": y * T,
            "width": w * T,
            "height": h * T,
            "rotation": 0,
            "visible": True,
            "point": False,
            "properties": [
                {
                    "name": k,
                    "type": "int" if isinstance(v, int) else "string",
                    "value": v,
                }
                for k, v in props.items()
            ],
        }
    )


def sign(name, x, y, gid):
    """A readable plaque/sign: solid tile + sign interaction."""
    put("objects", x, y, gid)
    collide.add(gid)
    obj(name, "sign", x, y)


def region(title, subtitle, x0, y0, x1, y1):
    """A named land: while inside, its heading (subtitle over title) is shown."""
    obj(title, "region", x0, y0, x1 - x0 + 1, y1 - y0 + 1, title=title, subtitle=subtitle)


def prop(kind, x, y):
    """Animated sprite prop (crystals / rocks) standing on tile (x, y)."""
    obj(kind, "prop", x, y, kind=kind)
    block(x, y)


# ------------------------------------------------------------- palettes
STARS = [DD(i) for i in list(range(436, 444)) + list(range(465, 473)) + list(range(494, 502)) + list(range(523, 531))]
COBBLE = [DD(i) for i in (320, 321, 322, 349, 350, 351, 378, 379, 380)]
COBBLE_TOP = [DD(291), DD(292), DD(293)]
CLIFF_MID = [DD(352), DD(353), DD(354)]
CLIFF_BOTTOM = [DD(381), DD(382), DD(383)]
CLOUD_FLOOR = weighted([(368, 40), (413, 4), (414, 2), (369, 2), (371, 2), (372, 2)])
CLOUD_FLOOR_GIDS = {368, 413, 414, 369, 371, 372}
PATH = 93  # plain white cloud used for hub walkways
SEA = ATL(379)  # deep dark water
SAND = weighted([(ATL(36), 30), (ATL(37), 6), (ATL(38), 6), (ATL(39), 6), (ATL(40), 6), (ATL(41), 6), (ATL(104), 2), (ATL(105), 2)])
SAND_GIDS = {ATL(i) for i in (36, 37, 38, 39, 40, 41, 104, 105)}
SAND_PATH = weighted([(ATL(614), 20), (ATL(615), 3), (ATL(616), 3), (ATL(617), 3), (ATL(618), 3), (ATL(619), 3), (ATL(620), 3)])
SAND_PATH_GIDS = {ATL(i) for i in range(614, 621)}
ASH_FLOOR = weighted([(ASH(129), 40), (ASH(128), 4), (ASH(130), 4), (ASH(131), 4), (ASH(50), 1), (ASH(51), 1)])
ASH_FLOOR_GIDS = {ASH(i) for i in (128, 129, 130, 131, 50, 51)}
GRAVEL = weighted([(ASH(121), 10), (ASH(122), 10), (ASH(123), 10), (ASH(124), 10), (ASH(125), 10), (ASH(126), 10)])
GRAVEL_GIDS = {ASH(i) for i in range(121, 127)}
PLAQUE = ASH(75)  # grey stone sign, used for every readable plaque

walkable.update(CLOUD_FLOOR_GIDS | {PATH, 362, 363, 364, 407, 409, 452, 453, 454})
walkable.update(COBBLE)
walkable.update(SAND_GIDS | SAND_PATH_GIDS)
walkable.update(ASH_FLOOR_GIDS | GRAVEL_GIDS)


def paved(x0, y0, x1, y1, floor_gids, gid):
    """Pave a rectangle, only over the given floor set (never over edges)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if get("ground", x, y) in floor_gids:
                put("ground", x, y, gid(x, y) if callable(gid) else gid)


def bridge(x0, y0, x1, y1):
    fill("ground", x0, y0, x1, y1, lambda x, y: random.choice(COBBLE))


# ============================================================ 1. the void
fill("ground", 0, 0, W - 1, H - 1, lambda x, y: random.choice(STARS))
collide.update(STARS)

# the sea fills the bottom of the world; a rim marks the surface
SEA_Y = 42
fill("ground", 0, SEA_Y, W - 1, H - 1, SEA)
fill("ground", 0, SEA_Y, W - 1, SEA_Y, ATL(345))
collide.update({SEA, ATL(345)})


# ==================================================== 2. the original town
# The hub is Milap's original hand-made 20x20 Cloud City map (tools/hub.json),
# blitted in unchanged so every piece of it stays exactly as designed.
HUB = json.loads((ROOT / "tools" / "hub.json").read_text())
HUB_X, HUB_Y = 34, 20
HUB_W, HUB_H = HUB["width"], HUB["height"]
for hl in HUB["layers"]:
    if hl["type"] != "tilelayer" or hl["name"] not in layers:
        continue
    if hl["name"] == "buildings":
        continue  # the house is gone; three paths lead to the three lands
    for i, gid in enumerate(hl["data"]):
        if gid:
            put(hl["name"], HUB_X + i % HUB_W, HUB_Y + i // HUB_W, gid)
for t in HUB["tilesets"][0]["tiles"]:
    if any(p["name"] == "ge_collide" and p["value"] for p in t.get("properties", [])):
        collide.add(t["id"] + HUB["tilesets"][0]["firstgid"])


def hub(x, y):
    return HUB_X + x, HUB_Y + y


SPAWN = hub(3, 3)
MYRA = hub(5, 5)
obj("spawn-player", "spawn", *SPAWN)
obj("spawn-myra", "spawn", *MYRA)

# the original welcome sign becomes readable; house fittings are removed
for x in (3, 4):
    obj("sign-welcome", "sign", *hub(x, 1))
for (x, y) in ((8, 6), (13, 5), (13, 6)):
    put("objects", *hub(x, y), 0)

# the original corner pool becomes the town fountain in the middle of the island
POOL = [[242, 243, 244], [287, 288, 289], [332, 333, 334]]
for j, row in enumerate(POOL):
    for i, g in enumerate(row):
        put("ground", *hub(2 + i, 11 + j), 93)  # the alcove around it is white cloud
stamp("ground", *hub(9, 9), POOL)

# the Fountain of Far Voices: the angel statue and its slab stand over the
# pool, facing down the plaza; every tile of it is readable (contact details)
for (x, y) in ((10, 6), (10, 7)):
    put("objects", *hub(x, y), 0)  # the two pots that stood here
# the statue is drawn by the scene as a sprite so it can sit a few pixels
# lower than the tile grid, with its base on the pool's concrete rim
obj("statue", "statue", *hub(9, 8), dx=8, dy=8)  # centred over the 3-wide pool
# only the water opens the well: the pool tiles (rows 9-11) are the sign;
# the statue (rows 6-8) just blocks
# collision only where the statue art is: its head (centre tile of row 6)
# and its body (rows 7-8); the pool tiles are solid on their own
block(*hub(10, 6))
for x in range(9, 12):
    for y in (7, 8):
        block(*hub(x, y))
    for y in range(9, 12):
        obj("fountain", "sign", *hub(x, y))

# direction boards next to each bridge
sign("dir-education", *hub(2, 5), 873)
sign("dir-work", *hub(17, 11), 873)
sign("dir-projects", *hub(10, 15), 873)

# bridges leave the island through its cloud edge: west (rows 3-4), east
# (rows 9-10) and a pier south (cols 8-9)
WEST_Y0, WEST_Y1 = HUB_Y + 3, HUB_Y + 4
EAST_Y0, EAST_Y1 = HUB_Y + 9, HUB_Y + 10
PIER_X = HUB_X + 8

# A stone archway at the start of each path. It is drawn on the always-on-top
# layer with no collision, so the character walks underneath it in any
# direction (the arch art is a facade; solid pillars would trap the player).
ARCH = [[477, 478, 479], [522, 523, 524], [567, 0, 569]]
walkable.update({477, 478, 479, 522, 523, 524, 567, 569})


def archway(x, y):
    stamp("top", x, y, ARCH, solid=False)


archway(HUB_X, WEST_Y0 - 1)
archway(HUB_X + HUB_W - 3, EAST_Y0 - 1)
archway(PIER_X - 1, HUB_Y + HUB_H - 4)


# ======================================= 2b. the trophy room (north path)
# Dark Dimension stone hall directly north of the town, reached by a short
# bridge from the island's top edge. Technologies from src/skills.json become
# trophies (drawn by the scene); each shelf has a category plaque on the left.
SKILLS = json.loads((ROOT / "src" / "skills.json").read_text())["categories"]
NORTH_X = HUB_X + 10  # 2-wide path at hub columns 10-11, just east of the hedge
TX0, TY0, TX1, TY1 = 31, 0, 58, 18  # hall outer walls (inclusive), symmetric around the aisle
region("TECHNICAL SKILLS", "The Trophy Room of", TX0, TY0, TX1, TY1)
fill("ground", TX0 + 1, TY0 + 2, TX1 - 1, TY1 - 1, lambda x, y: random.choice(COBBLE))
fill("buildings", TX0, TY0, TX1, TY0, DD(41))
fill("buildings", TX0, TY0 + 1, TX1, TY0 + 1, DD(70))
fill("buildings", TX0, TY0 + 2, TX0, TY1, lambda x, y: DD(68 if y % 2 else 97))
fill("buildings", TX1, TY0 + 2, TX1, TY1, lambda x, y: DD(69 if y % 2 else 98))
fill("buildings", TX0 + 1, TY1, TX1 - 1, TY1, DD(41))
for x in (34, 38, 54, 58):
    put("buildings", x, TY0 + 1, DD(74 if x % 2 else 75))
for i in range(2):  # doorway in the bottom wall, straight onto the bridge
    put("buildings", NORTH_X + i, TY1, DD(189 + i))
    put("ground", NORTH_X + i, TY1, random.choice(COBBLE))
sign("dir-skills", *hub(12, 2), 873)
# a wide central aisle of blue stone from the doorway up to the showcase
AISLE_X0, AISLE_X1 = NORTH_X - 1, NORTH_X + 2
fill("ground", AISLE_X0, TY0 + 2, AISLE_X1, TY1 - 1, lambda x, y: DD(random.choice((31, 32, 33, 34, 35, 36, 37))))
walkable.update({DD(i) for i in range(31, 38)})
# showcase: Kubernetes and Databricks side by side (2x2 each) at the top of the aisle
big = [(cat, i, sk) for cat in SKILLS for i, sk in enumerate(cat["skills"]) if sk.get("big")]
for (cat, i, sk), bx in zip(big, (AISLE_X0, AISLE_X0 + 2)):
    for dx in range(2):
        for ty in (3, 2):
            block(bx + dx, ty)
            obj(f"skill-{cat['id']}-{i}", "sign", bx + dx, ty, trophy=sk["tier"], big="yes", anchor="yes" if dx == 0 and ty == 3 else "no")
for (x, y) in ((TX0 + 2, 3), (TX1 - 2, 3)):
    prop("crystal-tall", x, y)
# the rest in two blocks either side of the aisle, gold nearest the showcase,
# then silver, bronze at the back; filled row by row across both sides
TIER_RANK = {"gold": 0, "silver": 1, "bronze": 2}
rest = [(cat, i, sk) for cat in SKILLS for i, sk in enumerate(cat["skills"]) if not sk.get("big")]
rest.sort(key=lambda t: TIER_RANK[t[2]["tier"]])
LEFT = [33, 35, 37, 39, 41]
RIGHT = [48, 50, 52, 54, 56]
slots = [(x, y) for y in (5, 7, 9, 11, 13) for x in LEFT + RIGHT]
for (cat, i, sk), (x, y) in zip(rest, slots):
    block(x, y)
    obj(f"skill-{cat['id']}-{i}", "sign", x, y, trophy=sk["tier"])


# ================================================ 3. dark dimension island
DX0, DY0, DX1, DY1 = 2, 12, 19, 30  # cobblestone plateau (inclusive)
fill("ground", DX0, DY0, DX1, DY0, lambda x, y: COBBLE_TOP[x % 3])
fill("ground", DX0, DY0 + 1, DX1, DY1, lambda x, y: random.choice(COBBLE))
fill("ground", DX0, DY1 + 1, DX1, DY1 + 1, lambda x, y: CLIFF_MID[x % 3])
fill("ground", DX0, DY1 + 2, DX1, DY1 + 2, lambda x, y: CLIFF_BOTTOM[x % 3])
collide.update(COBBLE_TOP + CLIFF_MID + CLIFF_BOTTOM)

bridge(DX1 + 1, WEST_Y0, HUB_X + 1, WEST_Y1)
region("EDUCATION", "The Dark Castle of", DX0, DY0, DX1, DY1 + 2)

# the castle facade: an 8x10 pre-composed block from the sheet
CASTLE_X, CASTLE_Y = 6, 13
castle_rows = [[DD(r * DD_COLS + c) for c in range(10, 18)] for r in range(7, 17)]
for r, c in ((10, 14), (11, 14), (11, 15)):  # transparent window cells
    castle_rows[r - 7][c - 10] = 0
stamp("buildings", CASTLE_X, CASTLE_Y, castle_rows)

# The sealed 2x2 brick gate becomes a dark arched doorway. Its bottom row is
# walkable and teleports into the hall; the animated door sprite sits on top.
GATE_X = CASTLE_X + 3
GATE_Y = CASTLE_Y + 7
for j, (left, right) in enumerate(((131, 132), (160, 161), (189, 190))):
    put("buildings", GATE_X, GATE_Y + j, DD(left))
    put("buildings", GATE_X + 1, GATE_Y + j, DD(right))
collide.update({DD(131), DD(132), DD(160), DD(161)})
walkable.update({DD(189), DD(190)})
DOORSTEP_Y = GATE_Y + 3
obj("castle-door", "door", GATE_X, GATE_Y, cols=2, rows=3)

# gargoyles flanking the gate, a pool, crystals, rocks
GARGOYLE = [[DD(506), DD(507), DD(508)], [DD(535), DD(536), DD(537)], [DD(564), DD(565), DD(566)]]
stamp("objects", CASTLE_X - 3, CASTLE_Y + 7, GARGOYLE)
stamp("objects", CASTLE_X + 8, CASTLE_Y + 7, GARGOYLE)
stamp("objects", 2, 25, [[DD(i) for i in range(207, 212)], [DD(i) for i in range(236, 241)], [DD(i) for i in range(265, 270)]])
for (x, y) in ((4, 15), (15, 15), (13, 27), (17, 21)):
    prop("crystal-tall", x, y)
for (x, y) in ((8, 26), (12, 24), (10, 29), (16, 29), (3, 17)):
    prop("crystal-small", x, y)
for (x, y) in ((6, 29), (14, 29), (17, 14)):
    prop("rock-a" if x % 2 else "rock-b", x, y)

sign("sign-education", GATE_X - 2, DOORSTEP_Y, PLAQUE)

# ------------------------------------------------ the castle hall (interior)
HX0, HY0, HX1, HY1 = 73, 3, 92, 13  # outer wall rectangle
region("EDUCATION", "The Dark Castle of", HX0, HY0, HX1, HY1)
fill("ground", HX0 + 1, HY0 + 2, HX1 - 1, HY1 - 1, lambda x, y: random.choice(COBBLE))
fill("buildings", HX0, HY0, HX1, HY0, DD(41))  # wall top
fill("buildings", HX0, HY0 + 1, HX1, HY0 + 1, DD(70))  # wall face
fill("buildings", HX0, HY0 + 2, HX0, HY1, lambda x, y: DD(68 if y % 2 else 97))
fill("buildings", HX1, HY0 + 2, HX1, HY1, lambda x, y: DD(69 if y % 2 else 98))
fill("buildings", HX0, HY1, HX1, HY1, DD(41))
collide.update({DD(41), DD(70), DD(68), DD(97), DD(69), DD(98)})
EXIT_X = (HX0 + HX1) // 2  # 2-wide doorway in the bottom wall
for i, g in enumerate((189, 190)):
    put("buildings", EXIT_X + i, HY1, DD(g))
    put("ground", EXIT_X + i, HY1, random.choice(COBBLE))  # stars would block it
for x in (76, 80, 85, 89):
    put("buildings", x, HY0 + 1, DD(74 if x % 2 else 75))
stamp("objects", 81, HY0 + 2, GARGOYLE)
for (x, y) in ((75, 6), (90, 6)):
    prop("crystal-tall", x, y)
for (x, y) in ((75, 11), (90, 11)):
    prop("crystal-small", x, y)
# three medal plaques: gold (PhD) centre, silver (Master's) left, bronze
# (Bachelor's) right. Drawn as shiny sprites by the scene; the tile is blocked.
for name, medal, x in (("edu-1", "gold", 82), ("edu-2", "silver", 78), ("edu-3", "bronze", 86)):
    block(x, 8)
    obj(name, "sign", x, 8, medal=medal)

# portals: castle doorway -> hall entrance; hall doorway -> castle doorstep
for i in range(2):
    obj("to-hall", "portal", GATE_X + i, GATE_Y + 2, tx=EXIT_X + i, ty=HY1 - 1, face="up")
    obj("to-castle", "portal", EXIT_X + i, HY1, tx=GATE_X + i, ty=DOORSTEP_Y, face="down")


# ======================================================== 4. ashlands (east)
# A compact plateau: two lava lakes, a water pool, a few dead trees, and the
# two big burning plaques for the current and previous job.
AX0, AY0, AX1, AY1 = 66, 22, 83, 37
fill("ground", AX0, AY0, AX1, AY1, ASH_FLOOR)
fill("ground", AX0 - 1, AY0 - 1, AX1, AY0 - 1, ASH(61))
put("ground", AX0 - 1, AY0 - 1, ASH(60))
fill("ground", AX0 - 1, AY0, AX0 - 1, AY1, ASH(100))
fill("ground", AX0 - 1, AY1 + 1, AX1, AY1 + 1, lambda x, y: ASH(221 if x % 2 else 222))
fill("ground", AX0 - 1, AY1 + 2, AX1, AY1 + 2, lambda x, y: ASH(261 if x % 2 else 262))
collide.update({ASH(i) for i in (60, 61, 100, 221, 222, 261, 262)})


def lake(x0, y0, x1, y1, tl, t, tr, l, c, r, bl, b, br):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            top, bot, left, right = y == y0, y == y1, x == x0, x == x1
            g = tl if top and left else tr if top and right else bl if bot and left else br if bot and right else t if top else b if bot else l if left else r if right else c
            put("ground", x, y, g)
            collide.add(g)


LAVA = [ASH(i) for i in (521, 522, 523, 561, 562, 563, 601, 602, 603)]
WATER = [ASH(i) for i in (361, 362, 363, 401, 402, 403, 441, 442, 443)]
lake(67, 32, 72, 36, *LAVA)  # bottom-left, under the previous-job plaque
lake(78, 23, 82, 26, *LAVA)  # top-right
lake(78, 33, 82, 36, *WATER)

bridge(HUB_X + HUB_W - 2, EAST_Y0, AX0 - 1, EAST_Y1)
region("WORK EXPERIENCE", "The Burning Lands of", AX0 - 1, AY0 - 1, AX1, AY1 + 2)
paved(AX0, EAST_Y0, AX1 - 2, EAST_Y1, ASH_FLOOR_GIDS, GRAVEL)

TREE = [[ASH(153), ASH(154)], [ASH(193), ASH(194)], [ASH(233), ASH(234)], [ASH(273), ASH(274)], [ASH(313), ASH(314)]]


def tree(x, y, rows):
    n = len(rows)
    stamp("top", x, y, rows[: n - 2], solid=False)
    stamp("objects", x, y + n - 2, rows[n - 2:])


for (x, y) in ((68, 23), (73, 23), (74, 32)):
    tree(x, y, TREE)

sign("sign-work", AX0 + 1, EAST_Y0 - 1, ASH(72))


def big_plaque(name, x, y, fire):
    """A 2x2 plaque (sprite drawn by the scene) whose bottom-left tile is (x, y)."""
    for dx in range(2):
        for dy in (0, -1):  # readable from every side
            block(x + dx, y + dy)
            obj(name, "sign", x + dx, y + dy, fire=fire, big="yes", anchor="yes" if dx == 0 and dy == 0 else "no")


big_plaque("work-1", 75, EAST_Y0 - 1, "burning")  # current job, by the road
big_plaque("work-2", 69, 31, "smoldering")  # previous job, above the lava lake

for (x, y) in ((71, 24), (77, 31), (67, 30)):
    put("objects", x, y, ASH(random.choice((660, 661, 663))))
for (x, y) in ((76, 24), (70, 36)):
    g = ASH(random.choice((500, 502, 503, 504)))
    put("objects", x, y, g)
    collide.add(g)
stamp("objects", 80, 27, [[ASH(391), ASH(392), ASH(393)]], solid=False)
for (x, y) in ((82, 30), (83, 31)):
    g = ASH(random.choice((664, 665, 666)))
    put("objects", x, y, g)
    collide.add(g)


# ======================================================= 5. atlantis (south)
SX0, SY0, SX1, SY1 = PIER_X - 16, 56, PIER_X + 18, 69  # sand floor (inclusive)
fill("ground", SX0, SY0, SX1, SY1, SAND)
put("ground2", SX0 - 1, SY0 - 1, ATL(171))
fill("ground2", SX0, SY0 - 1, SX1, SY0 - 1, ATL(172))
put("ground2", SX1 + 1, SY0 - 1, ATL(173))
fill("ground2", SX0 - 1, SY0, SX0 - 1, SY1, ATL(205))
fill("ground2", SX1 + 1, SY0, SX1 + 1, SY1, ATL(207))
put("ground2", SX0 - 1, SY1 + 1, ATL(239))
fill("ground2", SX0, SY1 + 1, SX1, SY1 + 1, ATL(240))
put("ground2", SX1 + 1, SY1 + 1, ATL(241))
collide.update({ATL(i) for i in (171, 172, 173, 205, 207, 239, 240, 241)})

# pier from the island's south edge down into the sea, through the rim
bridge(PIER_X, HUB_Y + HUB_H - 4, PIER_X + 1, SY0 - 1)
for x in (PIER_X, PIER_X + 1):
    put("ground2", x, SY0 - 1, 0)
region("PERSONAL PROJECTS", "The Sunken City of", SX0 - 1, SY0 - 1, SX1 + 1, SY1 + 1)
paved(PIER_X, SY0, PIER_X + 1, 66, SAND_GIDS, SAND_PATH)
paved(SX0 + 6, 61, SX1 - 6, 62, SAND_GIDS, SAND_PATH)


def atl(x, y):
    """Atlantis decor coordinates relative to the pier column."""
    return PIER_X + x, y


stamp("objects", *atl(6, 57), [[ATL(477), ATL(478), ATL(478), ATL(482), ATL(483), ATL(484), ATL(478), ATL(479)],
                                [ATL(511), ATL(512), ATL(512), ATL(516), ATL(517), ATL(518), ATL(512), ATL(513)],
                                [ATL(545), ATL(546), ATL(546), ATL(550), ATL(551), ATL(552), ATL(546), ATL(547)]])
for (x, y) in ((-13, 57), (-13, 66), (15, 66)):
    stamp("objects", *atl(x, y), [[ATL(262)], [ATL(296)], [ATL(330)]])
stamp("objects", *atl(-10, 64), [[ATL(265), ATL(266)], [ATL(299), ATL(300)], [ATL(333), ATL(334)], [ATL(367), ATL(368)]])  # obelisk, 2x4
for (x, y) in ((-5, 57), (4, 57)):
    stamp("objects", *atl(x, y), [[ATL(534), ATL(535)], [ATL(568), ATL(569)]])
stamp("objects", *atl(-2, 67), [[ATL(529), ATL(530)], [ATL(563), ATL(564)]])  # open clam with pearl, 2x2
stamp("objects", *atl(12, 65), [[ATL(56), ATL(57)], [ATL(90), ATL(91)]])
stamp("objects", *atl(10, 62), [[ATL(60), ATL(61), ATL(62)]])

sign("sign-projects", *atl(2, 56), ASH(72))
PROJECT_PLAQUES = (
    ("proj-1", (-4, 59)), ("proj-2", (-1, 59)),  # dissertation, white paper (kept clear of the ruin)
    ("proj-3", (-8, 64)), ("proj-4", (-3, 64)), ("proj-5", (4, 64)), ("proj-6", (9, 64)),
    ("proj-7", (6, 66)),
)
for name, (x, y) in PROJECT_PLAQUES:
    sign(name, *atl(x, y), PLAQUE)

for (x, y) in ((-8, 58), (14, 60), (-11, 62), (16, 63)):
    stamp("objects", *atl(x, y), [[ATL(421), ATL(422)], [ATL(455), ATL(456)]])
for (x, y) in ((-1, 57), (11, 67), (-15, 60)):
    stamp("objects", *atl(x, y), [[ATL(353), ATL(354)], [ATL(387), ATL(388)]])
for (x, y) in ((-7, 67), (3, 66), (17, 58)):
    g = ATL(random.choice((323, 324, 325, 326)))
    put("objects", *atl(x, y), g)
    collide.add(g)
for (x, y) in ((-12, 60), (13, 58), (2, 63), (-15, 67), (17, 67), (-3, 62)):
    g = ATL(random.choice((217, 218, 219, 220, 221, 222)))
    put("objects", *atl(x, y), g)
    collide.add(g)
# seaweed: 82/84/116/118 fit in one tile; 83, 85-88 are two tiles tall
for (x, y) in ((-9, 59), (-2, 58), (9, 60), (-14, 64), (15, 62)):
    put("top", *atl(x, y), ATL(random.choice((82, 84, 116, 118))))
for (x, y) in ((3, 67), (-7, 62), (12, 67), (0, 63), (-11, 65)):
    t = random.choice((83, 85, 86, 87, 88))
    stamp("top", *atl(x, y), [[ATL(t)], [ATL(t + ATL_COLS)]], solid=False)

# --------------------------------- the vault under the ruin (side projects)
# The ruin's dark doorway (middle column of the 482/483/484 piece) leads down
# into a brick vault built elsewhere in the sea. Its bottom doorway tile is
# walkable and is the portal.
RUIN_DOOR_X, RUIN_DOOR_Y = PIER_X + 6 + 4, 59
walkable.add(ATL(551))
VX0, VY0, VX1, VY1 = 66, 56, 87, 66  # vault outer walls (inclusive)
region("SIDE PROJECTS", "The Forgotten Vault of", VX0, VY0, VX1, VY1)
fill("ground", VX0 + 1, VY0 + 3, VX1 - 1, VY1 - 1, SAND)
stamp("buildings", VX0, VY0, [[ATL(477)] + [ATL(478)] * (VX1 - VX0 - 1) + [ATL(479)],
                             [ATL(511)] + [ATL(512)] * (VX1 - VX0 - 1) + [ATL(513)],
                             [ATL(545)] + [ATL(546)] * (VX1 - VX0 - 1) + [ATL(547)]])
fill("buildings", VX0, VY0 + 3, VX0, VY1, ATL(511))
fill("buildings", VX1, VY0 + 3, VX1, VY1, ATL(513))
fill("buildings", VX0 + 1, VY1, VX1 - 1, VY1, ATL(478))
collide.update({ATL(i) for i in (477, 478, 479, 511, 512, 513, 545, 546, 547)})
VEXIT_X = (VX0 + VX1) // 2
for i in range(2):
    put("buildings", VEXIT_X + i, VY1, ATL(517))  # dark opening in the bottom wall
    put("ground", VEXIT_X + i, VY1, random.choice(list(SAND_GIDS)))
    obj("to-vault", "portal", RUIN_DOOR_X, RUIN_DOOR_Y, tx=VEXIT_X, ty=VY1 - 1, face="up")
    obj("to-ruin", "portal", VEXIT_X + i, VY1, tx=RUIN_DOOR_X, ty=RUIN_DOOR_Y + 1, face="down")
walkable.add(ATL(517))
del objects[-2]  # the ruin doorway is a single tile; keep one to-vault portal
# furnishings: columns in the corners, a statue on the far wall, coral, seaweed
for (x, y) in ((VX0 + 1, VY0 + 3), (VX1 - 1, VY0 + 3), (VX0 + 1, VY1 - 3), (VX1 - 1, VY1 - 3)):
    stamp("objects", x, y, [[ATL(262)], [ATL(296)], [ATL(330)]])
stamp("objects", VEXIT_X, VY0 + 3, [[ATL(534), ATL(535)], [ATL(568), ATL(569)]])
stamp("objects", VX0 + 4, VY1 - 3, [[ATL(421), ATL(422)], [ATL(455), ATL(456)]])
stamp("objects", VX1 - 5, VY1 - 3, [[ATL(353), ATL(354)], [ATL(387), ATL(388)]])
stamp("objects", VX1 - 4, VY0 + 4, [[ATL(56), ATL(57)], [ATL(90), ATL(91)]])
for (x, y) in ((VX0 + 3, VY0 + 4), (VX1 - 3, VY1 - 4), (VEXIT_X - 4, VY1 - 2), (VEXIT_X + 5, VY1 - 2)):
    put("top", x, y, ATL(random.choice((82, 84, 116, 118))))
for name, x in (("side-1", VX0 + 5), ("side-2", VEXIT_X), ("side-3", VX1 - 5)):
    sign(name, x, VY0 + 6, PLAQUE)

# =================================================== 6. shorten the paths
def shift_region(x0, y0, x1, y1, dx, dy, copy_background=False):
    """Move everything (all layers + objects + portal targets) inside the
    inclusive rectangle by (dx, dy); vacated ground becomes void or sea."""
    buf = {n: {} for n in LAYER_NAMES}
    for n in LAYER_NAMES:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                buf[n][(x, y)] = get(n, x, y)
                put(n, x, y, (SEA if y >= SEA_Y else random.choice(STARS)) if n == "ground" else 0)
        for (x, y), g in buf[n].items():
            # background void/sea is never copied, so a shifted land cannot
            # erase whatever already stands at its destination
            if not copy_background and (g == 0 or (n == "ground" and (g in STARS or g == SEA))):
                continue
            put(n, x + dx, y + dy, g)
    for o in objects:
        ox, oy = o["x"] // T, o["y"] // T
        if x0 <= ox <= x1 and y0 <= oy <= y1:
            o["x"], o["y"] = (ox + dx) * T, (oy + dy) * T
        if o["type"] == "portal":
            pr = {p["name"]: p for p in o["properties"]}
            if x0 <= pr["tx"]["value"] <= x1 and y0 <= pr["ty"]["value"] <= y1:
                pr["tx"]["value"] += dx
                pr["ty"]["value"] += dy


shift_region(0, 10, 27, 33, 8, 0)  # castle island: west bridge 16 -> 8 tiles
shift_region(65, 20, 95, 52, -7, 0)  # ashlands: east bridge 14 -> 7 tiles
shift_region(24, 54, 62, 71, 0, -10)  # atlantis: pier 20 -> 10 tiles

# push the whole world below the trophy room down, then lay the north bridge
# from the hall doorway to the island's top edge under an archway
# everything except the trophy room: the band below it, then the strips
# either side of it (the castle island's top rows and the education hall)
shift_region(0, TY1 + 1, W - 1, H - 1 - WORLD_DY, 0, WORLD_DY, copy_background=True)
shift_region(0, 0, TX0 - 1, TY1, 0, WORLD_DY, copy_background=True)
shift_region(TX1 + 1, 0, W - 1, TY1, 0, WORLD_DY, copy_background=True)
SEA_Y += WORLD_DY
HUB_Y += WORLD_DY
bridge(NORTH_X, TY1 + 1, NORTH_X + 1, HUB_Y + 2)
archway(NORTH_X - 1, HUB_Y)
fill("ground", 0, SEA_Y, W - 1, SEA_Y, lambda x, y: get("ground", x, y) if get("ground", x, y) != SEA else ATL(345))

# ============================================================ 7. write JSON
collide -= walkable


def tileset(name, firstgid, image, cols, count, img_w, img_h):
    tiles = [
        {"id": gid - firstgid, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}
        for gid in sorted(collide)
        if firstgid <= gid < firstgid + count
    ]
    return {
        "columns": cols, "firstgid": firstgid, "image": image, "imageheight": img_h, "imagewidth": img_w,
        "margin": 0, "name": name, "spacing": 0, "tilecount": count, "tileheight": T, "tilewidth": T, "tiles": tiles,
    }


tile_layers = []
for i, name in enumerate(LAYER_NAMES, start=1):
    layer = {"data": layers[name], "height": H, "id": i, "name": name, "opacity": 1, "type": "tilelayer", "visible": True, "width": W, "x": 0, "y": 0}
    if name == "top":
        layer["properties"] = [{"name": "ge_alwaysTop", "type": "bool", "value": True}]
    tile_layers.append(layer)

object_layer = {"draworder": "topdown", "id": len(LAYER_NAMES) + 1, "name": "interactions", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0}

world = {
    "compressionlevel": -1, "height": H, "width": W, "infinite": False,
    "layers": tile_layers + [object_layer],
    "nextlayerid": len(LAYER_NAMES) + 2, "nextobjectid": len(objects) + 1,
    "orientation": "orthogonal", "renderorder": "right-down", "tiledversion": "1.10.2",
    "tileheight": T, "tilewidth": T, "type": "map", "version": "1.10",
    "tilesets": [
        tileset("Cloud City", CLOUD_FIRST, "cloud_tileset.png", CLOUD_COLS, CLOUD_COUNT, 720, 448),
        tileset("Dark Dimension", DD_FIRST, "dark_dimension_tileset.png", DD_COLS, DD_COUNT, 464, 336),
        tileset("Ashlands", ASH_FIRST, "ashlands_tileset.png", ASH_COLS, ASH_COUNT, 640, 336),
        tileset("Atlantis", ATL_FIRST, "atlantis_tileset.png", ATL_COLS, ATL_COUNT, 544, 560),
        tileset("Blocker", BLOCK_FIRST, "blocker.png", 1, 1, 16, 16),
    ],
}
world["tilesets"][-1]["tiles"] = [{"id": 0, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}]

OUT.write_text(json.dumps(world, separators=(",", ":")))
print(f"wrote {OUT.relative_to(ROOT)}: {W}x{H} tiles, {len(objects)} objects, {len(collide)} colliding gids")
