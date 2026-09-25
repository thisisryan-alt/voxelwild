# Voxelwild

A block-based sandbox in the spirit of Minecraft, built with Unity 6 (URP). It aims for modern,
realistic environment rendering: scanned PBR materials, custom shaders, voxel light and atmosphere.
The world stays readable as blocks.

![Forest interior](docs/images/forest.png)

| | |
|---|---|
| ![Forest from above](docs/images/forest-aerial.png) | ![Badlands](docs/images/badlands.png) |
| ![Snowy taiga](docs/images/taiga.png) | ![Torch-lit cave](docs/images/cave.png) |
| ![Overview](docs/images/overview.png) | ![Desert coast](docs/images/desert.png) |

*All images are unedited frames from the Windows ARM64 player build (`-vwCapture`), Phase 2.*

## Status

**Phases 1 (Foundation) and 2 (World) are complete and verified in Unity. Phases 3–8 are all written but
none has been run in the Unity editor yet:**

- 3: art pipeline
- 4: rendering
- 5: water
- 6: weather
- 7: gameplay
- 8: menus, audio, effects

Their engine-free logic (sky, weather, water simulation, items, crafting, survival, save format, sound
synthesis) is unit-tested with `dotnet test`. Everything else is type-checked against the Unity reference
assemblies. The next step is an editor pass: build the scenes, run both test suites and a capture, and fix what
they find. See [docs/ROADMAP.md](docs/ROADMAP.md) for all eight phases, what is still a stopgap, and the known
issues.

## Features

- **Streamed world:** 32³ sections in columns (y −64…191). A Burst-compiled pipeline builds each column:
  terrain → trees → lit meshes, all on worker threads.
- **Biomes:** ocean, beach, river, plains, forest, dense forest, jungle, savanna, swamp, desert, badland
  mesas, taiga, snowy taiga, tundra, mountains and snowy peaks. They come from continentalness,
  erosion, temperature and humidity fields, with dithered borders and biome-tinted grass and leaves.
- **3D terrain:** overhangs; spaghetti tunnels and caverns; flooded underground lakes; ore clusters by
  depth (coal, iron, gold, diamond); moss and bioluminescent glowcaps on cave floors.
- **Trees and plants:** oak, big oak, birch, spruce, tall spruce, jungle and giant 2×2 jungle trees,
  bushes, swamp oaks, cacti, tall grass, flowers and dead bushes. Trees cross column borders seamlessly
  and deterministically.
- **Props (Phase 3):** 34 Blender-generated props in 11 kinds: pebbles, stones and boulders; stalactites and
  stalagmites; dead trees, stumps and fallen logs; grass, flower and mushroom clumps. Each has baked normal,
  AO, curvature and moss maps and 2–3 LODs. They are placed by the generator per biome and cave, and lit by
  the voxel grid. Boulders hide a stone core and wood has invisible barrier cells, so both collide like
  terrain. Breaking what a prop rests on removes it.

  ![Props](docs/images/props.png)
- **Voxel lighting:** 15-level sky light (dimmed by leaves and water, leaking under overhangs, dark in
  caves) and block light (torches, glowcaps), smooth-lit per vertex. It drives ambient, reflections and
  how much sun a surface can receive.
- **Custom shaders:** hand-written URP HLSL for terrain, foliage and water.
  - Terrain: scanned PBR layers in Texture2DArrays, bevelled block edges, grass and snow creeping over
    block sides, voxel AO plus SSAO.
  - Foliage: alpha-tested and double-sided, with wind sway and sun transmission.
  - Water: refraction, absorption, caustics, flow-mapped ripples, foam and waterfalls (Phase 5).
  - Sky: physically based scattering, sun, moon phases, stars and a cloud layer that casts shadows (Phase 4).
- **Time and weather (Phases 4, 6):** 20-minute days; weather cycles through clear, cloudy, rain, storms with
  lightning, and fog. Ground gets wet, puddles form, snow settles and melts; rain and snow stop under roofs.
  Quality presets run from Low to Cinematic.
- **Flowing water (Phase 5):** a cellular simulation: water falls, spreads over ground, refills from two
  sources, and retreats. Springs in cliffs become waterfalls.
- **Survival and creative (Phase 7):**
  - Survival: timed mining with tools and tiers, item drops, a 36-slot inventory and crafting, health,
    hunger, breath, fall damage and death.
  - Creative: flying, instant breaking, every block.
  - Worlds save to disk and autosave.
- **Title screen, sound and effects (Phase 8):**
  - Menus: a title screen with world create/load/delete, a pause menu and settings.
  - Sound: synthesised in code (no audio files): footsteps per surface, mining and breaking, thunder, and
    wind, rain, birds, crickets, caves and underwater.
  - Effects: block debris, splashes and falling leaves.
- **Performance:**
  - Cave culling: a section-connectivity visibility graph hides sealed caves from the surface, and the
    surface from deep caves.
  - Leaf level of detail by distance.
  - Depth priming.
  - Mesh jobs copy their own input, so the main thread stays at 2–5 ms.
- **Player:** walk, sprint, jump, swim and fly on custom voxel physics. Break and place blocks,
  including torches. Plants and torches drop when their support is broken.
- **Verification:**
  - Unity tests: 96 EditMode and 5 PlayMode. 48 of the EditMode tests are engine-free and also run with
    `dotnet test tools/dotnet-tests`.
  - Captures: the capture tool tours every biome and a cave, and reports CPU/GPU time per view.
  - Props: `tools/blender/check_props.py` re-imports and validates every prop.

## Requirements

| | |
|---|---|
| Unity | **6000.4.11f1** (the native Windows ARM64 editor is used on Arm machines) |
| Git LFS | required: textures, scene data and screenshots are LFS objects |
| Python 3.9+ | only to rebuild source textures: `pip install -r tools/requirements.txt` (numpy, Pillow) |
| Blender 5.x | prop pipeline (`tools/blender.ps1`); developed against 5.2, also runs on the `bpy` 5.0 module |

## Getting started

```powershell
git lfs install
git clone https://github.com/thisisryan-alt/voxelwild.git
# open the folder in Unity Hub with 6000.4.11f1, run Voxelwild > Build All once,
# then open Assets/Scenes/MainMenu.unity and press Play
```

Playing `Assets/Scenes/World.unity` directly starts an unsaved creative sandbox, as the tests and captures
do.

### Finish setup in one step (Windows)

With Unity 6000.4.11f1 installed through Unity Hub, close Unity and double-click **`Finish.bat`** in the
project folder. It gets the latest code, rebuilds the generated textures, props and scenes, runs both test
suites, takes the screenshot tour, builds the game into `Builds/Windows/Voxelwild.exe`, then starts it.
It takes roughly 30–60 minutes. Everything it did and every error is in `Logs/finish-report.txt`.

### Controls

| Input | Action |
|---|---|
| WASD | move |
| Mouse | look (click the game view to capture the mouse) |
| Space | jump; double-tap to toggle flying (creative) |
| Left Ctrl | sprint |
| Left Shift | descend while flying |
| F | toggle flying (creative) |
| LMB | break (creative) or hold to mine (survival) |
| RMB | place the held block, or eat held food |
| 1–9, mouse wheel | select a hotbar slot |
| E / Tab | inventory and crafting (creative: block palette) |
| Esc | pause menu (closes the inventory first) |
| F5 | save |
| F3 / F1 | statistics overlay / hide all HUD |
| T, Shift+T / P | time +1 hour, −1 hour / pause time |
| F4 / Y | next quality preset / next weather |

Command line: `-vwWorld name [-vwNew] [-vwSeed n] [-vwMode Survival|Creative]` plays a saved world directly.

## Tooling

```powershell
./tools/blender.ps1 build                  # generate, bake, LOD and export every prop (~2 min)
./tools/blender.ps1 check -Determinism     # re-import and validate every prop; rebuild twice and compare
./tools/blender.ps1 preview                # labelled contact sheet of every prop (needs Pillow)
./tools/unity.ps1 build                    # texture arrays + prop library + World and MainMenu scenes, from code
./tools/unity.ps1 test -Platform EditMode  # 96 tests
tools/ci/fetch_mathematics.sh /tmp/um     # Unity.Mathematics for the checks below (no Unity needed for any of them)
dotnet test tools/dotnet-tests -p:MathematicsSrc=/tmp/um/package/Unity.Mathematics   # the 48 engine-free tests
tools/cscheck/run.sh /tmp/um/package/Unity.Mathematics                               # type-check runtime, editor tools, tests
tools/shadercheck/setup.sh && python3 tools/shadercheck/check_shaders.py \
    --graphics tools/shadercheck/.cache/graphics --dxc tools/shadercheck/.cache/dxc/bin/dxc   # compile every shader pass (DXC, URP 17.4)
./tools/unity.ps1 turntable                # prop turntables into Screenshots/turntables/ (quality gate)
./tools/unity.ps1 test -Platform PlayMode  # 5 tests on the real scene
./tools/unity.ps1 capture                  # batch-mode screenshots into Screenshots/
./tools/unity.ps1 player                   # Windows player into Builds/Windows/
Builds/Windows/Voxelwild.exe -vwCapture Screenshots/player            # real-GPU biome tour + CPU/GPU timings
Builds/Windows/Voxelwild.exe -vwCapture out -vwShots 08,13 -vwToggles nossao,hardshadows   # A/B a render feature (also: noprops)
python tools/fetch_ambientcg.py            # re-download scanned CC0 materials
python tools/generate_textures.py          # regenerate procedural sets (foliage, plants, ores, torch...)
```

GitHub Actions (`.github/workflows/checks.yml`) runs the engine-free tests, the type check and the shader
compile on every push. The Unity test suites run too once `UNITY_LICENSE`, `UNITY_EMAIL` and
`UNITY_PASSWORD` secrets are added; that job has not been run yet.

`WorldSceneBuilder` generates both scenes, the materials, sky, post-processing, UI panel settings and URP
settings. Change the builder rather than hand-editing a scene.

## Performance (Phase 2)

Windows ARM64 player, Snapdragon X Plus (X1P64100) and Adreno X1-85, 1600×900. View distance is
10 columns (320 m), with SSAO, 4 soft shadow cascades and SMAA. The main thread costs 2–4 ms everywhere;
the scene is GPU-bound. Full data: [docs/perf-phase2.txt](docs/perf-phase2.txt).

| View | GPU (p50) | Frame (avg) | Triangles |
|---|---|---|---|
| Spawn (forest edge) | 16.4 ms | 18.3 ms | 1.9 M |
| Forest interior | 18.2 ms | 20.1 ms | 3.9 M |
| Desert / badlands aerial | 16–18 ms | 20–22 ms | 2.5–3.0 M |
| Snowy taiga aerial | 26.4 ms | 31.5 ms | 4.2 M |
| Dense forest aerial | 30.9 ms | 37.4 ms | 4.5 M |
| Cave (5 torches) | 11.0 ms | 12.7 ms | 0.4 M |
| Surface fly-through at ~20 m/s | 14.7 ms | 17.6 ms | 1.4 M |

Full view distance streams in about 2.3 s from a cold start.

## Project layout

```
Assets/
  Art/            Materials, Texture2DArray atlases (generated)
    Models/         props: FBX + baked maps per category, props_manifest.json, PropLibrary (generated)
  Scenes/         MainMenu.unity, World.unity (generated by WorldSceneBuilder)
  UI/             runtime theme + panel settings (generated)
  Scripts/
    Runtime/      Voxelwild.Runtime assembly
      World/        blocks, sections/columns, VoxelWorld streaming + culling, raycast
        Generation/   terrain/biome noise, column generation job, tree decoration job
        Meshing/      Burst lighting + mesher, vertex format, region builder
        Props/        prop rules (PropRegistry), library, runtime field (light, edits, instanced drawing)
        Water/        water simulation
      Player/       controller, voxel physics body, block interaction, underwater effects
      Environment/  sky and atmosphere models, day/night cycle, weather model and system
      Rendering/    layer profile, environment lighting, quality presets, block particles, shader warm-up
      Gameplay/     items, mining, inventory, crafting, survival, saves, session, dropped items, icons, settings
      Audio/        sound synthesis, game audio
      UI/           HUD, inventory, pause menu, title screen, settings (UI Toolkit)
      Diagnostics/  debug overlay, capture/perf director
    Editor/       scene builder, texture arrays, prop import + library + turntables, capture runner, player build
  Shaders/        Terrain/, Foliage/, Props/, Water/, Sky/, Weather/, Utility/, Include/ (shared HLSL)
  Settings/       URP assets, post profile, TerrainLayerProfile
  Tests/          EditMode/, PlayMode/
SourceArt/        scanned + generated source textures (later .blend files), outside Assets/
tools/            unity.ps1, blender.ps1, fetch_ambientcg.py, generate_textures.py
  dotnet-tests/   runs the engine-free tests outside Unity
  cscheck/        type-checks the Unity C# outside Unity (reference assemblies + stubs)
  shadercheck/    compiles every shader pass with DXC against URP 17.4's shader libraries
  ci/             helpers for the GitHub Actions checks
  blender/        prop generators (vw/), build_props.py, check_props.py, preview_props.py
docs/             ROADMAP, ARCHITECTURE, ASSET_PIPELINE, perf data, images
```

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md): phases, status, stopgaps, known issues
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): world data, generation, lighting, meshing, culling, rendering,
  environment, water, gameplay, interface, sound and effects
- [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md): scanned and generated textures, Blender props → Unity
- [CREDITS.md](CREDITS.md): texture sources (CC0)
