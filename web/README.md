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
| `src/main/audio.js` | Synthesised sound (port of `SoundSynth`) |
| `tools/build_textures.py` | Packs `SourceArt` block textures into `assets/*.webp` strips |
| `tools/export_props.py` | Blender (headless) export of the prop FBX files to `assets/props.bin/json` + bake strips |
| `tools/build.mjs` | Bundles everything into `dist/` (one HTML page + assets) |
| `test/run.mjs` | End-to-end test in real Chrome with the GPU |
| `test/shots.mjs` | Fixed viewpoints, biomes, caves and props for visual checks |

## Commands

```sh
npm install
npm run build            # dist/index.html + dist/assets/
npm test                 # 19-step gameplay test in Chrome (CSP=1 adds an artifact-like Content-Security-Policy)
node test/shots.mjs      # screenshots into test/out/
blender -b -P web/tools/export_props.py   # re-export props after changing the Blender assets
```

## Controls

WASD move · Space jump (double-tap to fly in creative) · Ctrl or double-tap W sprint · Shift fly/swim down ·
left mouse mine · right mouse place/eat · middle mouse pick block · 1–9 or wheel hotbar · E/Tab inventory ·
Q drop · F fly (creative) · F3 debug · Esc pause.
