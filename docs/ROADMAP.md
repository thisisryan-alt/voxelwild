# Roadmap

The guiding rule is **visual quality of the core environment over feature count**. Each phase ends with:
tests green, a capture run reviewed by eye, a player build, and commits on a phase branch merged by PR.

Legend: ✅ done · 🟡 partial or stopgap · ⬜ not started

---

## Phase 1 — Foundation ✅

| Item | Status | Notes |
|---|---|---|
| Unity 6.4 URP project, clean template | ✅ | Forward+, HDR, depth/opaque textures, SSAO |
| Git + LFS + GitHub, .gitignore, docs | ✅ | binary art through LFS |
| Chunk system (sections + columns) | ✅ | 32³ sections, uniform-section collapse, pooling |
| Burst generation (heightmap terrain) | ✅ | continents, oceans, beaches, hills, massifs, cliffs, scree, snow |
| Burst meshing | ✅ | face culling, voxel AO, AO diagonal flip, convex-edge flags, water submesh |
| Streaming load/unload | ✅ | distance-sorted, budgeted per frame, hysteresis |
| Custom terrain shader | ✅ | Texture2DArray PBR, bevels, grass overhang, macro variation |
| Player controller | ✅ | swept AABB voxel physics, walk/sprint/jump/swim/fly |
| Block break/place | 🟡 | instant breaking; hotbar is a debug IMGUI strip |
| Edits persist across unload | 🟡 | in-memory RLE store; disk saves arrive with world save/load (Phase 7) |
| Tests + capture tooling | ✅ | 32 EditMode, 3 PlayMode, batch + player capture |

**Stopgaps introduced in Phase 1**, each replaced in the phase noted:

- Water is static blocks. Breaking a block below sea level next to water refills it with water. → Phase 5
- The ambient comes from a fixed trilight and the sun angle is fixed. → Phase 4
- The HUD is IMGUI (crosshair, text hotbar, stats). → Phase 7/8
- The sky is Unity's procedural skybox. → Phase 4

## Phase 2 — World ⬜

- Biome system: temperature/humidity maps blended into the height function. Plains, forest, dense
  forest, mountains, snow mountains, desert, beach, swamp, jungle, canyon.
- Density-based 3D terrain for overhangs and cliffs, layered on the current height field.
- Caves: spaghetti and cheese noise tunnels, chambers, underground lakes, ore veins.
- **Voxel skylight and block light propagation.** This is needed before caves: today, underground space
  gets the same ambient as the surface.
- Rivers and lakes carved by a flow or erosion pass in the column job.
- Feature placement: trees, rocks and vegetation as structure templates plus instanced detail meshes,
  using Phase 3 assets.
- Leaves and logs as blocks (alpha-tested shader variant).

## Phase 3 — Art pipeline (Blender → Unity) ⬜

Blender 5.2.1 LTS is installed and runs headless (`blender --background --python`). Plan:

- `SourceArt/Blender/` holds .blend sources. `tools/blender/*.py` generators and exporters run headless
  from `tools/blender.ps1`.
- Procedural generators: rocks (fractured, bevelled, moss and dirt masks baked to vertex colour or
  textures), tree variants (trunk, branches, roots, leaf cards), grass, flower and mushroom clumps.
- Bakes: normal, AO and curvature. LODs by decimation with per-LOD export.
- Export FBX to `Assets/Art/Models/` with an `AssetPostprocessor` that assigns materials, LOD groups
  and import settings.
- Quality gate: each asset gets a turntable capture in Unity before it's accepted.

## Phase 4 — Rendering ⬜

- Time of day: sun and moon, moon phases, stars, colour temperature curve, ambient probe updated from
  the sky.
- Physically based sky (precomputed scattering LUT), cloud layer with cloud shadows, and a sun halo.
- Volumetric lighting: a froxel or raymarched URP renderer feature for god rays through forests and
  cave openings, plus height fog.
- Terrain shader upgrades: height-blended layer transitions, stochastic tiling, parallax near the
  camera, wetness, snow accumulation and moss.
- Quality tiers (Low → Cinematic) wired to shadows, draw distance, volumetrics, SSAO and foliage.

## Phase 5 — Water ⬜

- Cellular water simulation (levels 0–7, down-then-sideways flow) in dirty regions only, on jobs.
  Rivers, waterfalls and streams follow from it.
- Water shader: refraction from the opaque texture, SSR, shoreline foam, caustics, flow-map normals,
  and underwater fog and post.
- Buoyancy and swimming polish, splashes and ripples from entities.

## Phase 6 — Weather ⬜

- Clear, cloudy, rain, heavy rain, storm, snow, fog, thunder and wind states with blended transitions.
- Wetness and puddles driven into the terrain shader, snow accumulation, and wind fed to foliage and water.

## Phase 7 — Gameplay ⬜

- Mining time per block and tool, item drops, inventory and crafting.
- World save/load to disk (region files holding the RLE sections), world creation UI.
- Health, hunger and survival loop.

## Phase 8 — Polish ⬜

- UI Toolkit HUD, menus and settings. Audio system with footsteps by surface, ambience beds and 3D sources.
- Optimisation: greedy-meshed far LODs, BatchRendererGroup, GPU occlusion, and shader/PSO warm-up.
- VFX: block break particles, dust and mist.

---

## Known issues

| Issue | Seen | Plan |
|---|---|---|
| One 154 ms frame spike during the first fly-through in the player build | capture report | Suspected first-use D3D12 pipeline (PSO) compilation, not yet profiled. Profile, then warm up shaders or PSOs (Phase 8) |
| Faint dark line between two stacked coplanar blocks in some close-ups | showcase capture | not yet diagnosed (SMAA edge, SSAO or bevel derivative suspected) |
| Unity logs an `ArgumentOutOfRangeException` from `UnityEditor.Search` at batch-mode startup | batch logs | engine-side, unrelated to project code; harmless |
| Player build uses Mono | — | IL2CPP on ARM64 needs the VS C++ ARM64 toolchain installed |
