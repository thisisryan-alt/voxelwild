# Voxelwild — browser build

A hand-written WebGL2 port of the Unity game, so it plays inside a web page (published as a Claude artifact).
It uses the same world generation, blocks, textures, props, mining/crafting rules and survival model as the
Unity project; the renderer and UI are rebuilt for the browser.

## Layout

| Path | What it is |
| --- | --- |
| `src/shared/` | Code that runs in both the page and the workers: constants, noise, terrain/biomes, column generation, trees, props placement, lighting + meshing, block/item/recipe tables |
| `src/worker.js` | World worker: generate → decorate (trees, props, heightmap) → light + mesh |
| `src/main/world.js` | Streaming, block storage, edits with relighting, water simulation, cave culling |
| `src/main/renderer.js`, `shaders.js`, `sky.js` | HDR renderer: sky model, PBR terrain, shadows, water, props, particles, post |
| `src/main/game.js`, `player.js`, `gameplay.js` | Session, player physics, interaction, items, survival, weather |
| `src/main/ui.js`, `src/index.html` | Screens, HUD, inventory/crafting, input (pointer lock, touch) |
| `src/main/audio.js` | Synthesised sound (port of `SoundSynth`), plus recorded clips and loops from the texture set |
| `tools/build_textures.py` | Packs `SourceArt` block textures into `assets/*.webp` strips (the "Voxelwild Original" texture set) |
| `tools/build_lbpr.py` | Bakes the LB Photo Realism Reload! resource pack into `assets/lbpr/` (the default texture set) |
| `tools/export_props.py` | Blender (headless) export of the prop FBX files to `assets/props.bin/json` + bake strips |
| `tools/build.mjs` | Bundles everything into `dist/` (one HTML page + assets) |
| `test/run.mjs` | End-to-end test in real Chrome with the GPU |
| `test/shots.mjs` | Fixed viewpoints, biomes, caves and props for visual checks |

## Commands

```sh
npm install
npm run build            # dist/index.html + dist/assets/
npm test                 # 28-step gameplay test in Chrome (CSP=1 adds an artifact-like Content-Security-Policy)
node test/shots.mjs      # screenshots into test/out/
node test/dims.mjs       # the Nether's biomes and a fortress, the End, a stronghold; `catalog`, `mobs` (screenshots)
node test/pack-import.mjs "<pack.zip>"   # imports a resource pack like a player, reports what it used, screenshots
node test/ui-shots.mjs   # the options screen, tab by tab
python tools/make_catalog.py "<LBPR zip>"   # the block catalog (src/shared/catalog.json)
python tools/build_mobs.py "<LBPR zip>"     # mob models (tools/geo) and skins
blender -b -P web/tools/export_props.py   # re-export props after changing the Blender assets
python tools/build_lbpr.py "<path>/LBPR Reload! v.6.6 for mc1.21.8.zip"   # re-bake the default textures
```

## Resource packs

Options ▸ Resource Packs lays two built-in packs, or any Minecraft Java resource pack ZIP (LabPBR normals, height
and specular are used; it stays in the browser), over the texture set chosen under Options ▸ Textures; blocks a
pack lacks keep that set's texture. "Default" removes the pack.

| Pack | What it is | Licence |
| --- | --- | --- |
| Voxelwild Photoreal | Poly Haven photo scans at 512×512 with normal, AO, height (parallax) and roughness; ores composed from the stone scan | CC0 |
| Soothing 32 | Zughy's pixel-art pack, the top-rated pack on ContentDB, upscaled with hard edges | CC BY-SA 4.0 |

`python web/tools/build_packs.py` downloads the sources and rebuilds `assets/pack_*.webp` and `assets/packs.json`;
`node test/packs.mjs` switches through every pack in Chrome, screenshots each and checks the choice survives a
reload. Famous commercial packs (Faithful, Patrix, Stratum, ...) can't be shipped with the game, but players who
own them can load them with *Load resource pack…*.

## Textures: LB Photo Realism Reload!

The default block textures, item icons, mining cracks, moon and several sounds come from
[LB Photo Realism Reload!](https://www.curseforge.com/minecraft/texture-packs/lb-photo-realism-reload) v6.6
by **1LotS** (based on LB Photo Realism and GKrond's version of LBPR; sounds from freesfx.co.uk and
orangefreesounds.com). Its licence allows any use with credit and a link to the CurseForge page, and no money
made from it; the game shows the credit under Options > Textures. "Voxelwild Original" switches back to the
game's own photographic materials, and players can still load their own Java resource pack on top.

LBPR is a 128px colour-only pack built around Minecraft's model system, so `build_lbpr.py` translates:

| In the pack | In the game |
| --- | --- |
| Weighted random models per block (blockstates) | Variant table: 32 weighted slots per layer, picked per block by a hash in the shader, with random quarter turns on top faces and mirroring |
| OptiFine CTM `method=repeat` (stone 4x4, gravel 4x4, sand 5x5) | Repeat mode: one tile per layer, chosen by block position, so a big seamless picture spans several blocks |
| Grey textures Minecraft tints (grass, foliage, spruce) | Minecraft's default biome colour baked in; the game's biome tint varies it |
| Grass/snow side overlay with alpha | Side-overlay rows: the fringe drawn over the dirt side like Minecraft |
| Sprite leaves for extra model planes | Several wrapped copies layered into a denser, still tileable cube face |
| Multi-part flower models (stems, leaves, blossoms) | Composed into one cross-plant sprite |
| No normal/height/specular maps | Height from the colour (detail + broad high-pass), normals, cavity AO and roughness generated; gentle POM |

Not carried over: OptiFine connected glass, random mob skins, custom entity models, animated water/lava
(the game's water shader stays), the pack's sky/cloud pictures (the game's sky is physically based) and the
swamp ambience (10 MB).

## The Nether and the End

| | How | What's there |
| --- | --- | --- |
| **Obsidian** | Lava meets water: a lava source sets to obsidian, flowing lava to cobblestone. Lava lakes fill caves below y -54, and obsidian already lines them where aquifers rest on them. Mine it with a diamond pickaxe. | |
| **The Nether** | Build an obsidian frame (2x3 to 21x21 inside), light it with **Flint and Steel** (iron + flint; flint drops from gravel), stand in it for 4 s. Distances are 1:8; the other end is found (portals are remembered) or built. | y 0-127 between bedrock, caverns over a lava sea at y 31: nether wastes, crimson and warped forests (huge fungi, vines, roots), soul sand valleys (basalt pillars), basalt deltas (columns, magma, lava pools). Glowstone, quartz and gold ores, lava falls, nether brick fortresses. Biome fog, spores and ash. |
| **Strongholds** | Three, 450-800 blocks from the origin, buried around y -24..6. Throw an **Eye of Ender** (2 nether quartz + glowstone dust) and it flies toward the nearest. | Stone-brick portal room with twelve end portal frames over a lava pit, corridors out to the sides. |
| **The End** | Put eyes into all twelve frames; the portal opens (a starfield). | Main island ringed by ten obsidian pillars, an open exit portal home in the middle (no dragon), an end gateway at its edge to the outer islands beyond 1000 blocks (chorus plants, purpur towers). |

Lava burns (and keeps you burning a few seconds), magma hurts unless you sneak, soul sand slows you. Dying outside the
overworld sends you back to your spawn. Every dimension keeps its own edits in the save.

Not like Minecraft (yet): no mobs (so no blazes, endermen, piglins or dragon: eyes are crafted from Nether
materials and the exit portal is open from the start), no fire blocks, no buckets, no bastions or end ships.

## Blocks, mobs, packs, sky

- **Block catalog**: 365 of Minecraft's full blocks, plants and glass on top of the game's own (stones and deepslate,
  ores, metals, copper, 16 colours of wool / concrete / terracotta / glazed terracotta / stained glass, every wood,
  flowers, crops, corals, froglights, workstations). Colour from LBPR, normal and material maps generated at load.
  World generation places deepslate below y 0, stone pockets, the extra ores, acacia / dark oak / cherry trees,
  flower fields, ferns, berries, mushrooms, pumpkins and sugar cane. Slabs, stairs, doors, fences and other
  non-cube shapes are not in yet.
- **Mobs**: cow, pig, sheep, chicken, wolf, husk, skeleton, creeper, spider, zombified piglin, blaze and ghast, with
  Mojang's Bedrock models (github.com/Mojang/bedrock-samples) and LBPR's skins; walking, head-tracking, attacking,
  arrows, fireballs, creeper explosions, drops, swords. No enderman or zombie (the pack has no skins for them).
- **Resource packs** import like in Minecraft with OptiFine: blockstate random variants, CTM repeat / random / height
  bands, animations, biome tints, grass side overlay, items, destroy stages, moon, sounds, and generated relief for
  packs without PBR maps (`src/main/packconv.js`).
- **Far terrain** out to 2 km, **fluffy leaves**, a moonlit **night** with god rays and the Milky Way, and options for
  always-day / always-night / a fixed hour, weather lock, and a tabbed options screen.

## Shaped blocks and graphics

`tools/make_catalog.py` also writes 280 shaped block families into `catalog.json` (`models`): stairs, slabs (double slabs
when stacked), walls, fences, fence gates, doors, trapdoors, glass panes and iron bars, carpets, pressure plates,
buttons, ladders, vines, glow lichen, rails, snow layers, dirt paths, farmland, tall flowers, lily pads and wall
torches. `src/shared/shapes.js` gives each state (facing, half, open) its boxes; `blocks.js` registers one block id per
state after the catalog (`FAMS`, `FAM`), with mining, drops and recipes from the block each one is cut from. The mesher
draws the boxes with world-aligned textures; the player collides with them (with a 0.6 block step-up and climbable
ladders and vines), rays pick them precisely, and right-click opens doors, trapdoors and gates. Texture names
`@rot90:x` are baked turned a quarter (east-west rails). `node test/shapes.mjs` builds a showcase of every family in
the sky, screenshots it and checks stairs, slabs, doors and picking.

Rendering: volumetric clouds are ray-marched at quarter resolution (Options > Quality > Cloud Style), ambient
occlusion is screen-space at half resolution with a depth-aware blur, and the tone-mapped image goes through FXAA and
contrast-adaptive sharpening. Shadows use 12 rotated Poisson taps; textures use 16x anisotropy and a slight mip bias.

## Redstone and survival

`src/main/redstone.js` runs circuits at 10 ticks a second over the components the player placed (`meta.redstone`, per
dimension): dust with power 0..15 (one level lost per block, up and down block edges), redstone torches (inverters,
one-tick delay), levers, buttons (1 s / 1.5 s pulses), pressure plates (player, mobs, items), repeaters (1..4 ticks,
right-click to change), redstone blocks, lamps, pistons and sticky pistons (push 12 blocks, pull one), TNT (and chain
reactions) and doors / trapdoors / gates that follow their power. Strong and weak power follow Minecraft's rules.

Blocks with a screen: the crafting table unlocks every recipe (the inventory alone crafts recipes of up to four items),
furnaces, smokers and blast furnaces smelt with fuel while their chunk is loaded, chests and barrels hold 27 stacks;
contents live in `meta.blockData` and spill when the block is broken or blown up. Recipes accept ingredient groups
(`planks`, `logs`, `wool`, `stone`, `coal`). Survival: raw ores smelt into ingots (iron tools, armour, rails need
ingots), cooked food, charcoal, hoes and farmland, wheat that grows from seeds (grass drops them), bread, beds that set
the respawn point and sleep through the night, and leather / gold / iron / diamond armour (Minecraft's defence points,
worn out by hits). `node test/redstone.mjs` builds test circuits and checks furnaces, crops, beds and armour.

Also: comparators (compare / subtract, read how full a container is), observers (a two-tick pulse when the block they
watch changes), dispensers (arrows, TNT, fire, buckets; anything else is dropped) and droppers (feed a container in
front), hoppers (pull from above, collect items, push into what they point at; furnaces take ores from above and fuel
from the side), fire (flint and steel; burns wood, wool and leaves, spreads, rain puts it out, netherrack burns forever),
buckets, a bow (hold to draw), beds in all sixteen colours and stairs that form inner and outer corners. Animated
textures from the pack (fire, sea lanterns, seagrass, prismarine, lit furnaces, redstone) are baked as frames
(`@frame:k:name`) and played by variant rows; primed TNT flashes; fires, furnaces and redstone give off embers and
smoke; leaves sway in gusts that roll across the forest and drop drifting leaves. `node test/more.mjs` checks these.

Worlds can start in the Nether (by a portal home), the End or as superflat (bedrock, dirt, grass; `flat` in the world
meta, passed to the generator), from the new-world screen or the title's sandbox buttons; creative players travel
between dimensions from the pause menu. Resolution: Options > Video > Resolution renders 4K (the default), 1440p,
1080p, 720p or native device pixels; slow frames are split into physics sub-steps so the game keeps real-time speed.
The player is lifted out of anything it ends up inside (`VoxelBody.unstick`), small redstone parts are aimed at by
roomier boxes (`pickBoxes`), and strays, wither skeletons and cave spiders join the mobs. Tests: `node test/ground.mjs`
(collision stress, respawn into built-up spawn), `test/piston-real.mjs`, `test/dims-start.mjs`.

## Structures and more mobs

`src/shared/structures.js` places villages (roads, a well, houses with stair roofs, beds and chests, farms, lamps; styles
for plains, taiga, savanna, desert and snowy biomes), pillager outposts, desert pyramids (a TNT-trapped treasure pit)
and wells, igloos, ruined portals, swamp huts, underground dungeons with spawners, and Nether bastions. Every kind has a
region grid with at most one per region, planned from the seed only, so each column builds its share (like strongholds)
and the game can use the same plans: villagers, pillagers and piglin brutes keep their structures populated, dungeon
spawners spawn their monster near the player, and chests found in a structure fill with its loot when first opened.
Villagers (six professions) trade by right-click. New mobs: villagers, pillagers, vindicators, slimes (they hop and
split), polar bears, striders (they walk on lava), piglin brutes; their models are written from Minecraft Java's model
definitions by `tools/make_geo.py` (Java pivots and boxes converted to Bedrock geometry, `tools/geo/custom.json`).
Ghasts are smaller and rare. Tests: `node test/structures.mjs`, `test/structures2.mjs`.

## Beyond Minecraft

Features Minecraft does not have, picked from the most downloaded mods and from other survival games:
a minimap with coordinates, biome and season, mobs and waypoints, and a full map on M that remembers explored land
(Xaero's Minimap, `src/main/minimap.js`); a panel naming the block or mob under the crosshair, the tool it needs,
a mob's health and a container's contents (Jade); felling whole trees with an axe and mining whole ore veins with a
pickaxe, sneak for one block (Timber, Veinminer); gravestones that keep everything on death and put it back in place
(Gravestone mods); waystones, a fast-travel network, one by every village well and craftable (Waystones); backpacks,
a grappling hook, double doors, Sort buttons, auto-walk on R (Quark, Terraria); Rested by a fire under a roof:
double healing, half the hunger, quicker mining (Valheim); seasons that turn leaves orange and gold, fade winter
and change crop growth (Serene Seasons, Vintage Story); a dodge dash on a double-tapped A or D and a summonable boss,
King Slime, with a health bar (Terraria); tips on loading and pause screens; fuller item tooltips (AppleSkin).
All can be switched off under Options > Controls and Sky & Time. `node test/extras.mjs`, `test/boss.mjs`,
`test/seasons.mjs` check them.

## Controls

WASD move · Space jump (double-tap to fly in creative) · Ctrl or double-tap W sprint · Shift fly/swim down ·
left mouse mine · right mouse place/eat · middle mouse pick block · 1–9 or wheel hotbar · E/Tab inventory ·
Q drop · F fly (creative) · F3 debug · Esc pause.
