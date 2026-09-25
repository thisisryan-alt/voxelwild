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
| Stalactites, stalagmites, detailed rocks | ✅ | moved to Phase 3 (Blender meshes) |

**Stopgaps still in place** (each is replaced in the phase noted):

- ~~Water is static blocks; breaking a block next to water refills it.~~ Water flows (Phase 5). Rivers still sit
  at sea level.
- ~~Ambient is a fixed trilight and the sun angle is fixed.~~ Replaced by the day/night cycle (Phase 4).
- The HUD is IMGUI. → Phase 7/8
- ~~The sky is Unity's procedural skybox.~~ Replaced by `Voxelwild/Sky` (Phase 4).
- Trees and plants are voxel/sprite generated. Rocks, cave formations, dead wood and plant clumps now come
  from Blender (Phase 3); hero trees with leaf cards are still to come.

## Phase 3 — Art pipeline (Blender → Unity) 🟡

Built and verified on the Blender side. The Unity side is written and type-checked but has not yet run
in the editor: the gate is `./tools/unity.ps1 build`, `test -Platform EditMode`, `turntable` and a
`capture` run reviewed by eye.

| Item | Status | Notes |
|---|---|---|
| Headless Blender pipeline | ✅ | `tools/blender/` (Blender 5.x or the `bpy` module), `tools/blender.ps1 build / check / preview` |
| Rocks and boulders | ✅ | pebble clusters, stones and boulders: fractured by planes, bevelled, with cracks and strata; moss mask |
| Stalactites, stalagmites | ✅ | lathe along a bent axis with a flared root, growth bands and drip bulges; clusters |
| Dead wood | ✅ | dead trees (branch growth with roots), stumps, fallen logs; bark UVs in metres, end-grain caps |
| Grass, flower and mushroom clumps | ✅ | modelled blades and petals (vertex colour, wind weight in alpha), mushroom clusters |
| Hero trees with leaf cards | ⬜ | deferred: mixing card foliage with voxel canopies needs a style decision; the branch generator is ready for it |
| Bakes | ✅ | normal (from high poly), AO, curvature and moss mask via Cycles; deterministic margin fill |
| LODs | ✅ | decimated per LOD (hand-built subsets for blades and mushrooms), 2–3 LODs per prop |
| FBX export + manifest | ✅ | byte-stable FBX (pinned header timestamp), `Assets/Art/Models/props_manifest.json` |
| Validation | ✅ | `check_props.py`: re-import round trip, LOD budgets, closed meshes, boulder core containment, determinism |
| Import settings | 🟡 | `PropModelPostprocessor` — not yet run in Unity |
| Prop library + materials | 🟡 | `PropLibraryBuilder` → `PropLibrary.asset`, one `Voxelwild/Prop` material per slot — not yet run |
| Prop shader | 🟡 | `Voxelwild/Prop`: block-array layers (triplanar or UV), baked maps, moss, curvature wear, voxel light, instancing — not yet compiled by Unity |
| Placement | 🟡 | in `DecorationJob`, deterministic, column-local; boulder cores and `PropBarrier` collision cells — EditMode tests written, not yet run |
| Rendering | 🟡 | `PropField`: per-section buckets, exact voxel light from the mesh job, LOD by distance, GPU instancing, cave culling |
| Quality gate | 🟡 | turntables (`./tools/unity.ps1 turntable`) and the capture tour; Blender preview in `docs/images/props.png` |

Prop kinds and where they grow are data in `PropRegistry` (biomes, support blocks, density, clumping,
scale, clearance, footprint, draw distance). The art side is the library; generation never needs it.

## Phase 4 — Rendering 🟡

Written and type-checked; the sky, time-of-day and quality maths are unit-tested outside Unity
(`dotnet test tools/dotnet-tests`). Shaders have not been compiled by Unity yet.

| Item | Status | Notes |
|---|---|---|
| Time of day | 🟡 | `DayNightCycle`: 20-minute days, sun path tilted 35° south, moon opposite with an 8-day phase cycle, sun ↔ moon light hand-over, trilight ambient and fog keyed for day, dusk and night. T / Shift+T / P |
| Colour temperature | 🟡 | the sun's colour comes from atmospheric transmittance (deep orange at the horizon), blended to the Phase 2 daylight colour once it is high |
| Physically based sky | 🟡 | `Voxelwild/Sky`: single-scattering Rayleigh + Mie table (64×64, built once at startup by `AtmosphereModel`), limb-darkened sun and halo, moon with phase, twinkling stars, horizon blended into the fog |
| Clouds and cloud shadows | 🟡 | one density field at 300 m drawn by the sky and sampled along the sun direction by every lit shader; drifts with `_VoxelWind` |
| Height fog | 🟡 | exponential height fog pooling around sea level, plus sun-tinted fog when looking toward the sun, on top of URP's distance fog |
| Volumetric god rays | ⬜ | needs a URP RenderGraph pass; left for the Phase 8 renderer work |
| Stochastic tiling | 🟡 | per layer (natural ground), switched by quality preset |
| Wetness, puddles, snow cover | 🟡 | shader hooks on terrain and props (`_VoxelWeather`), driven by Phase 6 weather |
| Parallax near the camera | ⬜ | not started |
| Quality presets | 🟡 | Low → Cinematic (`QualityPresets`), F4 cycles, remembered; High is the Phase 2 reference; captures use High unless `-vwQuality` |

Captures pin the clock (`-vwTime`, default 0.45: mid-morning, close to the old fixed sun).

## Phase 5 — Water 🟡

The simulation is unit-tested outside Unity; meshing, world integration and the shader are written and
type-checked but not yet run in Unity.

| Item | Status | Notes |
|---|---|---|
| Cellular water | 🟡 | `WaterSimulation`: sources (level 8) and flowing levels 1–7 as block ids; falls before it spreads, spreads only over solid ground or sources, two sources make a third, flows retreat when fed no more; evaluated only where something changed, 4 ticks/s, capped per tick, waits at unloaded terrain |
| World integration | 🟡 | `SetBlockDeferred` writes water without a same-frame remesh; player edits wake the water around them; the "refill broken blocks with water" stopgap is gone |
| Springs and waterfalls | 🟡 | at most one spring per hilly column opens in a cliff face (or a cave wall); the simulation turns it into a waterfall on load |
| Elevated rivers | ⬜ | rivers are still carved at sea level; springs give running water on slopes |
| Meshing | 🟡 | per-corner surface heights averaged over neighbouring cells (continuous slopes), flow direction per vertex |
| Water shader | 🟡 | refraction through the opaque texture, per-channel absorption, caustics on the bottom, flow-mapped ripples, waterfall streaks, shore/rapids/waterfall foam, surface visible from below |
| Screen-space reflections | ⬜ | reflections still come from the sky probe |
| Underwater | 🟡 | `UnderwaterEffects`: close fog in the water's colour, dimmed at night |
| Splashes and ripples from entities | 🟡 | the player falling into water throws spray and makes a splash (Phase 8); no surface ripples yet |

## Phase 6 — Weather 🟡

The weather model is unit-tested outside Unity; the system, particles and shader hooks are written and
type-checked but not yet run in Unity.

| Item | Status | Notes |
|---|---|---|
| Weather states | 🟡 | `WeatherModel`: clear, cloudy, rain, heavy rain, storm, fog as a seeded Markov chain (4–12 minutes each), blended over a minute |
| Snow | 🟡 | precipitation falls as snow where the local biome temperature or altitude is cold |
| Clouds, light, fog, wind | 🟡 | weather drives cloud cover and density, sun/moon strength, height fog and fog range, wind and gusts (foliage sway and cloud drift follow) |
| Wetness, puddles, snow cover | 🟡 | lag the sky: wet after a minute of rain, puddles only on soaked ground, snow settles and melts with warmth and sun; terrain and props darken, gloss, pool and whiten (Phase 4 shader hooks) |
| Rain and snow particles | 🟡 | around the camera, drifting with the wind, stopped under roofs and canopies (sky heightmap) |
| Thunder and lightning | 🟡 | strikes every ~14 s in storms: ambient and light flash, then thunder (Phase 8 audio) after a delay set by the strike's distance |

Y cycles the weather. Captures hold clear weather unless `-vwWeather Storm` (etc.) is given.

## Phase 7 — Gameplay 🟡

The rules (items, mining times, inventory, crafting, survival stats, region files) are unit-tested outside
Unity. The Unity side (session, dropped items, icons, HUD) is written and type-checked but not yet run in
Unity. There is one new PlayMode test: dropped items are picked up.

| Item | Status | Notes |
|---|---|---|
| Items | 🟡 | `ItemRegistry`: every block is an item (same id), plus sticks, coal, iron and gold chunks, diamonds, apples, berries, and wooden/stone/iron/diamond pickaxes, axes and shovels (ids 256+) |
| Mining | 🟡 | `Mining.BreakSeconds` from block hardness, the right tool type and its tier; ores need a high enough pickaxe tier to drop anything; tools wear out |
| Drops | 🟡 | `Drops`: stone → cobblestone, grass → dirt, ores → chunks/coal/diamond, oak and jungle leaves sometimes drop apples, tall grass sometimes drops berries, dead bushes and some leaves drop sticks, fallen-log props drop logs, ice drops nothing. Items fall, settle and are picked up within 1.6 m; they despawn after 5 minutes |
| Inventory | 🟡 | 36 slots with a 9-slot hotbar, stacks of 64 (tools don't stack). The E/Tab screen has click-to-move slots |
| Crafting | 🟡 | shapeless recipes: planks from any log, sticks, torches, sandstone, bricks, and 12 tools. Recipes you can't make yet are greyed out |
| Survival | 🟡 | Health 20, hunger 20 and breath 10. Walking, sprinting and jumping drain hunger. A full belly regenerates health and an empty one starves you. Falls further than 3 blocks hurt unless you land in water, and you drown once your breath runs out. On death you drop everything and respawn at your spawn point |
| Creative | 🟡 | no damage or hunger, flying allowed, instant breaking, infinite blocks. The inventory screen becomes a block palette |
| Saves | 🟡 | `{persistentDataPath}/saves/{name}/`: `world.json` (seed, mode, time, weather, player, inventory, removed props) and `regions/r.X.Z.bin` (16×16-column regions of edited sections, `VWRG` v1). Writes are atomic (temp file then replace). F5 saves; it also autosaves every 5 minutes and on quit |
| HUD | 🟡 | UI Toolkit (`GameHud`): icon hotbar with counts and tool wear, health/hunger/breath bars, mining progress, toasts, death screen. Block icons are rendered from the real terrain materials |

Editor Play, tests and captures run an unsaved creative sandbox, as before. `-vwWorld name [-vwNew] [-vwSeed n]
[-vwMode Survival|Creative]` plays a saved world. Worlds are picked and created on the Phase 8 title screen.

## Phase 8 — Polish 🟡

Sound synthesis, settings and the save helpers are unit-tested outside Unity. The menus, audio playback,
particles and warm-up are written and type-checked but not yet run in Unity.

| Item | Status | Notes |
|---|---|---|
| Title screen | 🟡 | `MainMenu` scene (first in the build): continue the last world, world list (mode, seed, day, play time, last saved) with play and delete, new world (name, seed or seed words, survival/creative), an unsaved creative sandbox, settings. The live sky turns slowly behind it at dawn |
| Pause menu | 🟡 | Esc: time and sound stop. Resume, settings, save, save and quit to title, quit |
| Settings | 🟡 | graphics preset, field of view, mouse sensitivity, invert Y, master/effects/ambience volume, frame-rate counter. Applied at once and saved to `settings.json` (the preset to the existing preference) |
| Loading screen | 🟡 | covers world generation, with the world name and a count of ready columns |
| HUD | 🟡 | Phase 7 `GameHud` (UI Toolkit). The IMGUI overlay only shows the F3 statistics now |
| Audio | 🟡 | every sound is synthesised at startup on a worker thread (`SoundSynth`), so no audio files are needed. Footsteps for 10 surfaces, mining strikes, breaking, placing, landing, splashes, pickups, damage, UI clicks, and thunder after each lightning flash (delayed by distance). Ambience beds: wind (altitude, weather), rain (muffled under cover), birds by day, crickets at night, a cave drone deep underground, underwater |
| Block debris | 🟡 | coloured cubes burst from broken blocks and chip off while mining, in the block's own colour (from its icon), and settle on the ground |
| Splashes | 🟡 | spray when the player falls into water, scaled by the fall height |
| Falling leaves | 🟡 | drift down from canopies around the player, on the wind, and settle on the ground |
| Dust, mist | ⬜ | not started |
| Pipeline warm-up | 🟡 | `ShaderWarmup` draws every world material (terrain, foliage, water, items, particles, every prop LOD, instanced) through the real camera while the loading screen is up, to remove first-use hitches (the known ~200 ms spike). Needs measuring on the player build |
| Draw-call reduction | ⬜ | BatchRendererGroup or merged section meshes; greedy-meshed far LODs; GPU occlusion. The largest remaining performance item (see known issues) |

---

## Known issues

| Issue | Seen | Plan |
|---|---|---|
| Dense forest aerial views are GPU-heavy: 26–31 ms GPU on the Adreno X1-85 at 1600×900 | capture report | Quality presets (Phase 4) and draw-call work (Phase 8). SSAO and shadows are the largest costs, per the `-vwToggles` A/B runs |
| Frame time sits 2–8 ms above GPU time in busy views, which points at render-thread overhead from roughly 14k draws (sections × 3 submeshes × several passes) | capture report | BatchRendererGroup or merged meshes (Phase 8) |
| Steep slopes and cliffs read as vertical "combs" of alternating stone and grass columns | badlands capture | Slope-smoothed surface rules; Phase 3 rocks break up the ground but cliff meshes are not built yet |
| Props are drawn with `Graphics.DrawMeshInstanced` from `LateUpdate` (one call per mesh LOD and submesh) | Phase 3 | Fold into the BatchRendererGroup work (Phase 8) |
| Boulder LOD2 can let a corner of its stone core show (2 of 50 test points) | `check_props.py` | Same scan as the boulder, seen from 60 m+; tighten if it shows in captures |
| Blender preview renders the violet flower clump nearly white | `docs/images/props.png` | Check in the turntable; raise petal saturation if it holds in-engine |
| Undersides of leaf canopies can look like a flat grey sheet at grazing angles | forest captures | Revisit with Phase 4 lighting; consider per-face normal jitter for leaves |
| Stone scan (Rock058) has rust-coloured veins that read orange under torch light | cave capture | Tint or swap the stone layer during Phase 4 art direction |
| One frame spike (~150–250 ms) after large teleports | capture report | Suspected first-use pipeline (PSO) compilation plus streaming bursts. `ShaderWarmup` (Phase 8) targets the PSO part; re-measure |
| The capture tool's river viewpoint can land on a nearby hill | capture harness | Improve viewpoint selection; rivers are visible in the forest-aerial capture |
| Faint dark line between two stacked coplanar blocks in some close-ups | Phase 1 | Not yet diagnosed |
| Unity logs an `ArgumentOutOfRangeException` from `UnityEditor.Search` at batch-mode startup | batch logs | Engine-side; harmless |
| Player build uses Mono | — | IL2CPP on ARM64 needs the VS C++ ARM64 toolchain |
| Phases 3–8 have not been run in the Unity editor | — | Everything since Phase 2 was written without an editor: engine-free logic is unit-tested, the rest is type-checked against Unity reference assemblies. Next step: `./tools/unity.ps1 build`, both test suites, a capture run, and fixing what they find |
