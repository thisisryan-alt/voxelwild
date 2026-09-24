# Architecture

## World data

- **Section:** a 32³ array of `ushort` block ids, laid out x-fastest then z then y. A section whose
  contents are a single id (open air, solid stone) keeps only that id until it is edited.
- **Column:** the unit of streaming. It holds 8 sections (y −64…191), a `ColumnSurface[32×32]` (ground
  height, ground block, biome, temperature, humidity) and a **light heightmap**, the topmost
  light-blocking y per (x,z).
- **Blocks:** a blittable `BlockDefinition` holds:
  - flags: solid, opaque, liquid, replaceable, breakable, needs-support
  - render shape: cube, cutout cube, cross, torch, liquid
  - texture layers (top, side, bottom, side overlay)
  - light emission and light opacity (0–15)
  - biome tint mode and wind weight

  Jobs read a `NativeArray<BlockDefinition>` copy.

## Column pipeline

```
Generating ──terrain job──▶ Generated ──(all 8 neighbours have terrain)──▶ Decorating ──tree job──▶ Ready
                                                                                                   │
                                            section meshable once its column and all 8 neighbours are Ready
```

1. **`ColumnGenerationJob` (Burst)** writes the whole column into one contiguous buffer:
   - **Surface field:** `TerrainNoise.SampleSurface` (pure math, shared with the main thread and tests)
     gives height, climate and biome per (x,z) over a 34×34 patch, so slopes are known at the border.
     Domain-warped continentalness sets the base height. Massif and ridge noise build mountains, and
     climate adds dunes, terraced mesas and flat swamps. Narrow bands of a low-frequency field cut
     river valleys down to below sea level.
   - **3D density:** `height − y + overhangNoise × amplitude`, with the amplitude set per biome.
     Overhang and cave noise are sampled on a 4-block lattice and trilinearly interpolated, about 64×
     cheaper than per-voxel noise.
   - **Surface rules:** a depth counter since the last air cell picks the top, filler and deep
     materials per biome (sandstone band under desert sand, striped red/tan mesa strata, mud in
     swamps, snowy grass, scree above the tree line, stone on cliffs).
   - **Caves:** a cheese threshold makes caverns, and the intersection of two noise isosurfaces makes
     spaghetti tunnels. They are kept away from the surface except at entrance patches and never
     undercut water. Carved cells below a noisy aquifer level become underground lakes.
   - **Extras:** ore clusters (random walks in depth bands, replacing only stone), cave-floor moss and
     glowcaps, and surface plants by biome with clumping noise.
2. **`DecorationJob` (Burst)** adds trees and computes the light heightmap. It gets a copy of the 3×3
   neighbouring surfaces. Tree positions come from a world-space jittered grid (at most one tree per
   5×5 cell), so spacing never depends on neighbouring voxel data. Every column applies all trees that
   can reach it, its own and its neighbours', in one global order, writing only its own blocks. A tree
   is therefore identical on both sides of a border, and regenerating a column after unload reproduces
   it exactly. Player edits are restored afterwards from the RLE store.
3. **Finish (main thread):** the buffer is split into sections. Uniform ones collapse via a Burst direct
   call, and the buffer returns to a pool.

## Lighting and meshing (Burst, one job per section)

The job receives pointers to its 27 neighbouring sections, 9 heightmaps and 9 surfaces. It copies them
into its own **64³ region**, the section plus a 16-voxel margin. Light reaches at most 15 blocks, so
every source that can affect the section or its 1-voxel shell lies inside the region and lighting is
exact. Columns referenced by an in-flight job cannot unload. A concurrent edit bumps the section
version, and the stale result is dropped.

1. **Sky light:** 15 above the heightmap. A breadth-first flood seeds from open-sky cells next to shaded
   ones and loses `max(1, opacity)` per step, so leaves dim it by 1 and water by 2. It leaks under
   overhangs and into cave mouths, and is 0 in sealed caves.
2. **Block light:** a flood from emitters (torch 14, glowcap 11).
3. **Connectivity:** a flood fill of the section's non-opaque cells. Every open region joins the faces it
   touches, which gives a 36-bit face-to-face mask for cave culling.
4. **Meshing:**
   - Face-culled cubes, with voxel AO and an AO/light-aware diagonal flip, convex-edge flags for
     bevels, and smooth per-vertex light (mean of the non-opaque cells in the 2×2 front layer).
   - Cutout leaf cubes. Near the camera they keep inner faces ("fancy leaves"); far sections drop
     them.
   - Two crossed double-sided quads per plant, jittered and height-varied per block, with wind weight 0
     at the root.
   - Torch posts. Water in its own submesh.

The vertex is 24 bytes: `float3 position` plus three `UNorm8×4` attributes:

| Attribute | Contents |
|---|---|
| `TEXCOORD0` | face \| edge mask or plant UV corner, layer, AO, overlay layer |
| `TEXCOORD1` | sky light, block light, temperature, humidity |
| `TEXCOORD2` | tint mode, wind weight |

Submeshes are 0 opaque (terrain material), 1 cutout (foliage material) and 2 water.

## Visibility

- **Cave culling:** a breadth-first search over sections from the camera. It passes between two faces
  of a section only if its connectivity joins them, and never steps back toward the camera. Unreached
  sections have their renderer disabled: sealed caves from the surface, and the surface from deep
  underground. It re-runs when the camera changes section, or throttled as meshes change connectivity.
  Frustum culling and shadow casting stay with Unity, so terrain behind the camera still casts shadows.
- **Leaf LOD:** sections within 2 of the camera use fancy leaves. Crossing the threshold queues an async
  remesh.
- **Shadow pass:** plants beyond 24 m and leaves beyond 64 m skip it.

## Edits

`SetBlock` writes the voxel, updates the column heightmap (with a rescan when the top blocker is
removed), and bumps the version of every section whose light can change. That is everything within 16
blocks, plus the whole sky shaft if the heightmap moved; those sections are queued for async remesh.
Sections whose geometry depends on the voxel (its 3×3×3 neighbourhood) are meshed as parallel jobs and
completed within the same frame, so edits never show a hole.

## Rendering

- **Shared passes:** `VoxelPasses.hlsl` holds ForwardLit, ShadowCaster, DepthOnly and DepthNormals for
  both `Voxelwild/Terrain` (opaque) and `Voxelwild/Foliage` (`VOXEL_CUTOUT`: alpha-tested,
  double-sided, wind).
- **Surface** (`VoxelTerrainSurface.hlsl`):
  - world-space UVs on cube faces and per-quad UVs on plants
  - grass or snow overhang on block sides
  - macro variation
  - bevelled convex edges with wear
  - voxel AO
  - biome tint (palette over temperature × humidity, with a swamp olive)
  - emission from the mask alpha
- **Lighting** (`VoxelLighting.hlsl`): URP's PBR loop with voxel hooks:
  - Sky light scales ambient and reflections quadratically (via occlusion) and gates the sun.
  - Block light is warm irradiance through the diffuse BRDF.
  - Foliage transmission reuses the main light's shadow lookup.
  - Per-layer specular scale keeps vegetation from mirroring the sky.
- **Depth-normals prepass:** normals only (normal map plus bevels), for SSAO at half resolution. Forced
  depth priming reuses its depth, so the forward pass shades each pixel once.
- **Material framework:** `TerrainLayerProfile` holds per-layer tiling, normal strength, roughness,
  macro variation, tint, specular, emission, translucency, biome-tint and cutout flags, uploaded as
  global arrays.
- **Globals:** `EnvironmentLighting` publishes the block-light colour and wind, and refreshes the
  ambient probe.

## Verification

- **EditMode (44):**
  - coordinates and registry/manifest order
  - generation determinism, bedrock, heightmaps, caves and ores
  - forests and biome coverage over 12 km
  - mesher faces, winding, AO, edges, water, plants and leaf LOD
  - exact sky and block light values
  - region builder, raycast, physics and RLE store
- **PlayMode (4):** spawn and ground contact, place/break with immediate remesh, no placement inside the
  player, and torch support.
- **Capture (`-vwCapture`):**
  - tours spawn, a showcase, the overview, mountains, coast, forest interior, jungle, taiga, badlands,
    desert, swamp, river and a real cave found by scanning voxels, with torches placed through the
    gameplay code
  - reports CPU main-thread and GPU time per view, plus a surface fly-through
  - `-vwShots` filters views and `-vwToggles` switches off render features for A/B cost measurement
