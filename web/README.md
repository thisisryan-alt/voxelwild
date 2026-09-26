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
npm test                 # 26-step gameplay test in Chrome (CSP=1 adds an artifact-like Content-Security-Policy)
node test/shots.mjs      # screenshots into test/out/
node test/dims.mjs       # the Nether's biomes and a fortress, the End, a stronghold (screenshots)
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

## Controls

WASD move · Space jump (double-tap to fly in creative) · Ctrl or double-tap W sprint · Shift fly/swim down ·
left mouse mine · right mouse place/eat · middle mouse pick block · 1–9 or wheel hotbar · E/Tab inventory ·
Q drop · F fly (creative) · F3 debug · Esc pause.
