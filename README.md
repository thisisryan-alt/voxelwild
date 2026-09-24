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

**Phases 1 (Foundation) and 2 (World) are complete.** See [docs/ROADMAP.md](docs/ROADMAP.md) for all
eight phases, what is still a stopgap, and known issues.

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
- **Voxel lighting:** 15-level sky light (dimmed by leaves and water, leaking under overhangs, dark in
  caves) and block light (torches, glowcaps), smooth-lit per vertex. It drives ambient, reflections and
  how much sun a surface can receive.
- **Custom shaders:** hand-written URP HLSL for terrain, foliage and water.
  - Terrain: scanned PBR layers in Texture2DArrays, bevelled block edges, grass and snow creeping over
    block sides, voxel AO plus SSAO.
  - Foliage: alpha-tested and double-sided, with wind sway and sun transmission.
  - Water: Phase 1 version.
- **Performance:**
  - Cave culling: a section-connectivity visibility graph hides sealed caves from the surface, and the
    surface from deep caves.
  - Leaf level of detail by distance.
  - Depth priming.
  - Mesh jobs copy their own input, so the main thread stays at 2–5 ms.
- **Player:** walk, sprint, jump, swim and fly on custom voxel physics. Break and place blocks,
  including torches. Plants and torches drop when their support is broken.
- **Verification:** 44 EditMode and 4 PlayMode tests. The capture tool tours every biome and a cave,
  and reports CPU/GPU time per view.

## Requirements

| | |
|---|---|
| Unity | **6000.4.11f1** (the native Windows ARM64 editor is used on Arm machines) |
| Git LFS | required: textures, scene data and screenshots are LFS objects |
| Python 3.9+ | only to rebuild source textures: `pip install -r tools/requirements.txt` (numpy, Pillow) |
| Blender 5.2 | asset pipeline from Phase 3 onwards |

## Getting started

```powershell
git lfs install
git clone https://github.com/thisisryan-alt/voxelwild.git
# open the folder in Unity Hub with 6000.4.11f1, then open Assets/Scenes/World.unity and press Play
```

### Controls

| Input | Action |
|---|---|
| WASD | move |
| Mouse | look (click the game view to capture the mouse, Esc releases it) |
| Space | jump; double-tap to toggle flying |
| Left Ctrl | sprint |
| Left Shift | descend while flying |
| F | toggle flying |
| LMB / RMB | break / place block (hold to repeat) |
| 1–9, mouse wheel | hotbar: cobblestone, stone, dirt, planks, bricks, oak log, leaves, sandstone, torch |
| F3 / F1 | stats overlay / hide HUD |

## Tooling

```powershell
./tools/unity.ps1 build                    # texture arrays + World scene, generated from code
./tools/unity.ps1 test -Platform EditMode  # 44 tests
./tools/unity.ps1 test -Platform PlayMode  # 4 tests on the real scene
./tools/unity.ps1 capture                  # batch-mode screenshots into Screenshots/
./tools/unity.ps1 player                   # Windows player into Builds/Windows/
Builds/Windows/Voxelwild.exe -vwCapture Screenshots/player            # real-GPU biome tour + CPU/GPU timings
Builds/Windows/Voxelwild.exe -vwCapture out -vwShots 08,13 -vwToggles nossao,hardshadows   # A/B a render feature
python tools/fetch_ambientcg.py            # re-download scanned CC0 materials
python tools/generate_textures.py          # regenerate procedural sets (foliage, plants, ores, torch...)
```

`WorldSceneBuilder` generates the scene, materials, sky, post-processing and URP settings. Change the
builder rather than hand-editing the scene.

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
  Scenes/         World.unity (generated by WorldSceneBuilder)
  Scripts/
    Runtime/      Voxelwild.Runtime assembly
      World/        blocks, sections/columns, VoxelWorld streaming + culling, raycast
        Generation/   terrain/biome noise, column generation job, tree decoration job
        Meshing/      Burst lighting + mesher, vertex format, region builder
      Player/       controller, voxel physics body, block interaction
      Rendering/    layer profile (material framework), environment lighting
      Diagnostics/  debug HUD, capture/perf director
    Editor/       scene builder, texture arrays, capture runner, player build
  Shaders/        Terrain/, Foliage/, Water/, Utility/, Include/ (shared HLSL)
  Settings/       URP assets, post profile, TerrainLayerProfile
  Tests/          EditMode/, PlayMode/
SourceArt/        scanned + generated source textures (later .blend files), outside Assets/
tools/            unity.ps1, fetch_ambientcg.py, generate_textures.py
docs/             ROADMAP, ARCHITECTURE, ASSET_PIPELINE, perf data, images
```

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md): phases, status, stopgaps, known issues
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): world data, generation, lighting, meshing, culling, rendering
- [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md): scanned and generated textures, Blender → Unity (Phase 3)
- [CREDITS.md](CREDITS.md): texture sources (CC0)
