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
2. **`DecorationJob` (Burst)** adds trees, then props (see Props below), and computes the light heightmap. It gets a copy of the 3×3
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

## Props

Rocks, cave formations, dead wood and plant clumps are Blender meshes (docs/ASSET_PIPELINE.md) placed by the
generator and drawn with GPU instancing.

- **Rules:** `PropRegistry` holds one blittable `PropRule` per kind: placement (ground, cave floor, cave
  ceiling), biomes, support blocks, density with a clumping noise, candidate grid, scale range, clearance,
  footprint, and whether the prop writes a core block or barrier cells. It is data the job reads, so
  generation never depends on the art.
- **Placement** (`DecorationJob.Props.cs`, after trees): from this column's own voxels only, so it needs no
  neighbours and regenerates identically. Ground candidates are every surface cell for small props, or one
  hashed spot per `Grid`² cells for big ones; big props go first and claim a ring of cells. Cave candidates
  are open cells at least 6 blocks under the surface next to cave rock. Each placed prop records its anchor
  cell, variant, yaw, scale and the open room along its growth direction (formations shrink to the longest
  variant that fits).
- **Collision:** boulders write a stone core at their anchor, hidden inside the mesh; dead trees and fallen
  logs write `PropBarrier` cells (solid, invisible, no light blocking). Both block the player like terrain,
  and both come before the light heightmap, so cores shade the ground.
- **Light:** props are bucketed by section. When a section's mesh job finishes, `PropField` reads the voxel
  light (max over the anchor and its 6 neighbours) and climate from the job's 64³ region, which is exact and
  free. A uniform-air section is never meshed, so its props estimate light from the sky heightmap. Props
  appear only once lit.
- **Edits:** `SetBlock` asks `PropField` for props that depend on the cell (anchor, core, barriers,
  footprint, the block below or above). They are removed along with their core and barrier cells, and
  remembered so they don't come back when their column reloads.
- **Drawing:** every frame, sections hidden by cave culling are skipped, the rest are frustum-tested with a
  16 m margin for shadows, and each prop picks a LOD by distance (22 / 50 / 100 % of its kind's draw
  distance). Batches of up to 1023 go to `Graphics.DrawMeshInstanced` with a per-instance `_PropLight`
  (sky, block, temperature, humidity).
- **Shader** (`Voxelwild/Prop`): samples the terrain's block Texture2DArrays with the terrain's per-layer
  tuning, either world-space triplanar (rock, continuous with blocks) or through UV1 (bark in metres, end
  grain), or takes albedo from vertex colour (plants). The baked normal and mask add form, AO, curvature
  wear on convex edges and moss that follows the local climate. Lighting is `VoxelFragmentPBR`: the same sky
  and block light curves as the terrain. Foliage is double-sided with wind and a biome tint.

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

- **EditMode (52):**
  - coordinates and registry/manifest order
  - generation determinism, bedrock, heightmaps, caves and ores
  - forests and biome coverage over 12 km
  - mesher faces, winding, AO, edges, water, plants and leaf LOD
  - exact sky and block light values
  - region builder, raycast, physics and RLE store
  - props: registry sanity, the Blender manifest against the registry, deterministic placement, placement
    rules (support, biome, cores, barriers, footprints), edit dependencies and removal
- **PlayMode (4):** spawn and ground contact, place/break with immediate remesh, no placement inside the
  player, and torch support.
- **Capture (`-vwCapture`):**
  - tours spawn, a showcase, the overview, mountains, coast, forest interior, jungle, taiga, badlands,
    desert, swamp, river and a real cave found by scanning voxels, with torches placed through the
    gameplay code
  - reports CPU main-thread and GPU time per view, plus a surface fly-through
  - `-vwShots` filters views and `-vwToggles` switches off render features for A/B cost measurement
