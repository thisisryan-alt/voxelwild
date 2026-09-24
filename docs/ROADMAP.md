# Roadmap

The guiding rule is **visual quality of the core environment over feature count**. Each phase ends with:
tests green, a capture run reviewed by eye, a player build with measured frame times, and commits on a
phase branch merged by PR.

Legend: ✅ done · 🟡 partial or stopgap · ⬜ not started

---

## Phase 1 — Foundation ✅

| Item | Status | Notes |
|---|---|---|
| Unity 6.4 URP project, clean template | ✅ | Forward+, HDR, depth/opaque textures, SSAO |
| Git + LFS + GitHub, .gitignore, docs | ✅ | binary art through LFS |
| Chunk system (sections + columns) | ✅ | 32³ sections, uniform-section collapse, pooling |
| Burst generation and meshing | ✅ | superseded and extended in Phase 2 |
| Streaming load/unload | ✅ | distance-sorted, budgeted per frame, hysteresis |
| Custom terrain shader | ✅ | Texture2DArray PBR, bevels, grass overhang, macro variation |
| Player controller | ✅ | swept AABB voxel physics, walk/sprint/jump/swim/fly |
| Block break/place | 🟡 | instant breaking; hotbar is a debug IMGUI strip |
| Edits persist across unload | 🟡 | in-memory RLE store; disk saves arrive with world save/load (Phase 7) |
| Tests + capture tooling | ✅ | EditMode, PlayMode, batch + player capture |

## Phase 2 — World ✅

| Item | Status | Notes |
|---|---|---|
| Biome system | ✅ | 19 biomes from continentalness/erosion/temperature/humidity; dithered borders; biome-tinted grass and leaves |
| Mountains, cliffs, canyons | ✅ | massif + ridge mountains, stone cliffs by slope, terraced badland mesas with strata, river-cut valleys |
| Overhangs | ✅ | 3D density noise on a coarse lattice (4 blocks), trilinearly interpolated |
| Caves | ✅ | spaghetti tunnels, cheese caverns, surface entrances, flooded aquifer lakes |
| Ores | ✅ | coal, iron, gold, diamond clusters in depth bands |
| Rivers and lakes | 🟡 | river channels and lowland lakes at sea level; no elevated rivers or waterfalls until the water simulation (Phase 5) |
| Trees | ✅ | 9 voxel tree types, deterministic across column borders |
| Vegetation | ✅ | tall grass, flowers, dead bushes, cacti; cave moss and bioluminescent glowcaps |
| Voxel lighting | ✅ | sky light + block light, BFS over a 64³ region per mesh, smooth per-vertex light |
| Foliage rendering | ✅ | alpha-tested double-sided shader, wind, sun transmission, alpha-clipped shadows |
| Culling and performance | ✅ | section visibility graph (cave culling), leaf LOD, depth priming, in-job region copy |
| Stalactites, stalagmites, detailed rocks | ⬜ | moved to Phase 3 (Blender meshes) |

**Stopgaps still in place** (each is replaced in the phase noted):

- Water is static blocks. Rivers sit at sea level. Breaking a block next to water refills it. → Phase 5
- Ambient is a fixed trilight and the sun angle is fixed. → Phase 4
- The HUD is IMGUI. → Phase 7/8
- The sky is Unity's procedural skybox. → Phase 4
- Trees and plants are voxel/sprite generated. Hero trees, rocks and cave formations come from Blender.
  → Phase 3

## Phase 3 — Art pipeline (Blender → Unity) ⬜

Blender 5.2.1 LTS is installed and runs headless (`blender --background --python`). Plan:

- `SourceArt/Blender/` holds .blend sources. `tools/blender/*.py` generators and exporters run headless
  from `tools/blender.ps1`.
- Procedural generators:
  - rocks and boulders (fractured, bevelled, moss and dirt masks)
  - stalactites and stalagmites
  - hero tree variants (trunk, branches, roots, leaf cards) to mix with voxel trees near the camera
  - grass, flower and mushroom clumps
- Bakes: normal, AO and curvature. LODs by decimation, exported per LOD.
- Export FBX to `Assets/Art/Models/` with an `AssetPostprocessor` that assigns materials, LOD groups and
  import settings. Props are placed by the decoration job as instanced detail meshes.
- Quality gate: each asset gets a turntable capture in Unity before it's accepted.

## Phase 4 — Rendering ⬜

- Time of day: sun and moon, moon phases, stars, colour temperature curve, ambient probe updated from
  the sky.
- Physically based sky (scattering LUT), cloud layer with cloud shadows, and a sun halo.
- Volumetric lighting: god rays through forests and cave openings, height fog.
- Terrain shader upgrades: height-blended transitions, stochastic tiling, parallax near the camera,
  wetness, snow accumulation.
- **Quality presets (Low → Cinematic):** render scale, shadow distance, cascades and soft-shadow
  quality, SSAO resolution, view distance, leaf LOD distance, plant density. The capture tool's
  `-vwToggles` already measures what each of these costs.

## Phase 5 — Water ⬜

- Cellular water simulation (levels, down-then-sideways flow) in dirty regions only, on jobs.
  Elevated rivers, waterfalls and springs follow from it.
- Water shader: refraction, SSR, shoreline foam, caustics, flow-map normals, underwater fog and post.
- Buoyancy and swimming polish, splashes and ripples from entities.

## Phase 6 — Weather ⬜

- Clear, cloudy, rain, heavy rain, storm, snow, fog, thunder and wind states with blended transitions.
- Wetness and puddles in the terrain shader, snow accumulation, and wind (already a global:
  `_VoxelWind`) driven by weather.

## Phase 7 — Gameplay ⬜

- Mining time per block and tool, item drops, inventory and crafting.
- World save/load to disk (region files holding the RLE sections), world creation UI.
- Health, hunger and survival loop.

## Phase 8 — Polish ⬜

- UI Toolkit HUD, menus and settings. Audio with surface footsteps, ambience beds and 3D sources.
- Optimisation:
  - draw-call reduction (BatchRendererGroup or merged section meshes)
  - greedy-meshed far LODs
  - GPU occlusion
  - shader/PSO warm-up
- VFX: block break particles, dust, mist, falling leaves.

---

## Known issues

| Issue | Seen | Plan |
|---|---|---|
| Dense forest aerial views are GPU-heavy: 26–31 ms GPU on the Adreno X1-85 at 1600×900 | capture report | Quality presets (Phase 4) and draw-call work (Phase 8). SSAO and shadows are the largest costs, per the `-vwToggles` A/B runs |
| Frame time sits 2–8 ms above GPU time in busy views, which points at render-thread overhead from roughly 14k draws (sections × 3 submeshes × several passes) | capture report | BatchRendererGroup or merged meshes (Phase 8) |
| Steep slopes and cliffs read as vertical "combs" of alternating stone and grass columns | badlands capture | Slope-smoothed surface rules, plus Phase 3 cliff/rock meshes |
| Undersides of leaf canopies can look like a flat grey sheet at grazing angles | forest captures | Revisit with Phase 4 lighting; consider per-face normal jitter for leaves |
| Stone scan (Rock058) has rust-coloured veins that read orange under torch light | cave capture | Tint or swap the stone layer during Phase 4 art direction |
| One frame spike (~150–250 ms) after large teleports | capture report | Suspected first-use pipeline (PSO) compilation plus streaming bursts. Profile, then add shader warm-up (Phase 8) |
| The capture tool's river viewpoint can land on a nearby hill | capture harness | Improve viewpoint selection; rivers are visible in the forest-aerial capture |
| Faint dark line between two stacked coplanar blocks in some close-ups | Phase 1 | Not yet diagnosed |
| Unity logs an `ArgumentOutOfRangeException` from `UnityEditor.Search` at batch-mode startup | batch logs | Engine-side; harmless |
| Player build uses Mono | — | IL2CPP on ARM64 needs the VS C++ ARM64 toolchain |
