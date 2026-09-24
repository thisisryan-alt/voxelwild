# Architecture

## World data

- **Section:** a 32³ array of `ushort` block ids, laid out x-fastest then z then y. A section whose
  contents are a single id (open air, solid stone) keeps only that id and returns its array to a pool.
  Editing it expands it again.
- **Column:** the unit of streaming. It is a vertical stack of 8 sections (y −64…191) plus a
  `ColumnSurface[32×32]` (height, top block, filler block, filler depth) shared by the section fill jobs.
- **Blocks:** `BlockId` constants and a blittable `BlockDefinition` (flags such as solid, opaque,
  liquid and replaceable, plus top, side, bottom and side-overlay texture layers). A
  `NativeArray<BlockDefinition>` copy is read by Burst jobs.

## Generation (Burst)

`TerrainNoise.SampleSurface` is pure math, so the same function runs in jobs, on the main thread (spawn
search) and in tests.

- Continentalness comes from domain-warped fBm. It maps through a piecewise curve to ocean, coast and
  inland base heights.
- The mountain mask is high continentalness combined with low erosion. It scales a broad massif fBm
  plus ridged multifractal crests.
- Hills and small detail octaves go on top.

`ColumnSurfaceJob` evaluates a 34×34 height patch, so slopes are known at the column border, and picks
surface materials. The rules: sand or gravel under water, beaches, stone on cliffs, scree above the tree
line, snow above a noisy snow line. Eight `SectionFillJob`s then run in parallel and report whether
their section came out uniform.

## Meshing (Burst)

1. `NeighborhoodBuilder.Build`, a Burst direct call, copies the section and a one-voxel shell of its
   26 neighbours into a padded 34³ buffer. The job owns its input, so live chunk memory is never read
   off-thread and unloading can't race a job.
2. `ChunkMeshJob` emits one quad per visible face into a 16-byte vertex:
   `float3 position` + `UNorm8×4` (face | convex-edge mask, texture layer, AO, side-overlay layer).
   - Voxel AO is sampled per corner from the layer in front of the face. Each quad is split along its
     brighter diagonal.
   - The edge mask marks edges whose neighbour across the edge isn't opaque. The shader bevels only
     those, so coplanar ground stays seamless while real block corners read as blocks.
   - Water goes to a second index range (submesh 1). Its free surface is lowered by 0.12.
3. Faces are deliberately not greedy-merged: each quad carries its own AO and bevel data. Greedy
   meshing is planned for far LODs (Phase 8).

## Streaming (`VoxelWorld`)

- Columns load within `viewDistance + 1` in distance order, with a per-frame budget and an in-flight
  cap. A section meshes once its own and all 8 neighbouring columns are ready, which guarantees
  seamless borders and correct AO. Columns unload beyond `viewDistance + 2`.
- Pools cover voxel arrays, columns, sections (with their GameObject and Mesh) and mesh job buffers.
- **Edits:** `SetBlock` writes the voxel, bumps the version of every section whose mesh depends on it
  (the 3×3×3 neighbourhood of the voxel), and remeshes those sections synchronously the same frame. An
  async mesh that finishes later with an older version is dropped.
- Edited sections go into `ModifiedChunkStore` (RLE) on unload and are restored on reload.
- Every section is one GameObject and MeshRenderer, with the `[terrain, water]` materials and manual
  bounds.

## Player

- `VoxelBody`: an axis-separated swept AABB that only tests cells beyond the leading face, with a
  0.001 skin. Unloaded space counts as solid.
- `PlayerController`: ground and air acceleration, a jump derived from the target height, swimming
  (buoyant drag), and flying.
- `BlockInteractor`: DDA raycast, break and place with repeat, and no placing inside the body.

## Rendering

- **`Voxelwild/Terrain`** is hand-written HLSL on the URP 17 lighting library. Its passes are
  ForwardLit, ShadowCaster, DepthOnly and DepthNormals; the last feeds SSAO and uses the same bevelled
  normals. Surface evaluation (`VoxelTerrainSurface.hlsl`):
  - UVs are world space, projected on the face's tangent and bitangent. Each layer sets its own tiling
    (natural ground spans 2–2.5 blocks per repeat; built materials align to blocks).
  - Grass on block sides is a height-map-driven ragged edge over dirt, with a contact-shadow band below.
  - Macro value noise varies brightness over large areas.
  - Bevels tilt the normal toward the exposed edges within `_BevelWidth`, fading out once they're
    under about 2 pixels, and add wear (lighter and rougher edges).
  - Voxel AO goes to indirect light, with a fraction on direct light.
- **Texture2DArrays** (albedo + height, OpenGL normal, AO/roughness/metal) are built from scanned maps.
  Per-layer tiling, normal strength, roughness scale, macro variation and tint come from
  `TerrainLayerProfile`, uploaded as global arrays. One profile drives every block material.
- **`Voxelwild/Water`** (Phase 1) does depth absorption from the camera depth texture, Fresnel
  environment reflection, a distance-aware GGX sun highlight, and distance-faded ripple normals.
- Post: ACES tonemapping, bloom, colour adjustments, white balance, vignette and SMAA.

## Verification

- EditMode tests cover pure logic and jobs.
- PlayMode tests load the real World scene.
- `ScreenshotDirector` (`-vwCapture <dir>`) runs in batch-mode play or in the player build. It waits
  for streaming, visits viewpoints, renders PNGs via `RenderPipeline.SubmitRenderRequest`, builds a
  block showcase through the real edit path, and writes streaming and frame-time stats.
