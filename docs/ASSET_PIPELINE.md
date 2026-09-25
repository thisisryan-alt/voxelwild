# Asset pipeline

## Principles

- **Sources live outside `Assets/`** (`SourceArt/`), so Unity doesn't import raw scans or .blend files.
  Generated, engine-ready outputs go into `Assets/Art/`.
- **Every step is scripted and re-runnable**, from a menu item or from `tools/unity.ps1` and
  `tools/*.py`. Nothing depends on hand-tweaked import settings.
- **Binary art is Git LFS** (see `.gitattributes`): textures, .blend, .fbx, audio and fonts.
- **Quality gate:** an asset isn't done until it has been seen in-engine through a capture.

## Block textures (in use)

```
SourceArt/Textures/block_layers.json          ordered layer list (must match enum TextureLayer; test-enforced)
SourceArt/Textures/ambientCG/<id>/*.jpg       scanned CC0 sets: Color, NormalGL, Roughness, AO, Displacement, (Opacity)
        │  python tools/fetch_ambientcg.py    (layers + generator inputs listed under extraSources)
SourceArt/Textures/generated/<name>/*.png     procedural sets, same map names + Opacity / Emission / Metalness
        │  python tools/generate_textures.py  (numpy + Pillow; deterministic seeds)
        ▼
Voxelwild ▸ Art ▸ Build Block Texture Arrays  (BlockTextureArrays.cs)
        ▼
Assets/Art/Textures/Blocks/BlockAlbedo_Array.png   RGB colour, A = opacity if the set has one, else height   sRGB
                          BlockNormal_Array.png   RGB OpenGL normal                                         linear
                          BlockMask_Array.png     R AO, G roughness, B metallic, A emission                 linear
        │  BlockTextureArrayImporter: 6-column flipbook -> Texture2DArray, BC7, Kaiser mips,
        │  alpha-coverage-preserving mips (foliage keeps its density at distance), aniso 8
        ▼
Terrain.mat / Foliage.mat + TerrainLayerProfile (per-layer tiling, normal, roughness, specular, tint,
                                                  emission, translucency, biome tint, cutout)
```

### Procedural sets (`tools/generate_textures.py`)

Where no suitable scan exists, sets are generated, using real scans as ingredients where possible:

| Set | Built from |
|---|---|
| Leaves | ~300 rotated, scaled and colour-jittered copies of the scanned **Leaf001**. Normals are rotated with the sprite, and depth-ordered AO and height are included. Tileable, 83% coverage. |
| Needles | Spruce twigs drawn procedurally, with the normal from the drawn height |
| Grass tuft, poppy, dandelion, dead bush | Tapered, curved blades and petals drawn at 2× and downsampled. Folded-blade normals, colour bleed into transparent texels, transparent frame for clean mips. |
| Glowcap | Domed cave mushrooms with an emission mask on caps and spots |
| Torch, torch top | Wood stick, charred band and glowing ember (emission), laid out so world-projected UVs put the ember at the top of the 10/16-high post |
| Cactus, cactus top | Ribbed body with areoles and spines; radial top |
| Coal / iron / gold / diamond ore | The **Rock058** stone scan with clustered mineral blobs. Per-crystal faceted normals, darker halo, per-ore roughness, and metalness for gold. |
| Log top | Centre crop of the round **TreeEnd002** scan, so rings fill the face |

The generated PNGs are committed (LFS), so the project opens without Python. Regenerate after editing
the generator.

### Adding a block texture

1. Append a layer to `block_layers.json` (`ambientCG` id, or `generated` with a generator in
   `generate_textures.py`).
2. Append the same name to `enum TextureLayer`.
3. Fetch or generate the sources, then run `./tools/unity.ps1 build`.
4. Reference the layer from the block's `BlockDefinition` in `BlockRegistry`.
5. Add per-layer defaults in `WorldSceneBuilder.DefaultLayer`, or tune
   `Assets/Settings/Rendering/TerrainLayerProfile.asset`. The builder regenerates the profile only when
   the layer count changes; delete it to re-apply code defaults.

**Git LFS budget.** The three atlases total about 190 MB and change whenever a layer changes. Commit
rebuilt atlases once per phase, not on every tuning iteration.

## Props: Blender → Unity (Phase 3)

![Props from the Blender pipeline](images/props.png)

*Blender preview of every prop's LOD0 (`tools/blender/preview_props.py`), shaded with the same scans the
in-engine materials use. Labels give triangles per LOD.*

```
tools/blender/vw/rocks.py, cave.py, wood.py, plants.py   procedural generators (deterministic per seed)
tools/blender/build_props.py                             generate -> game mesh -> bake -> LODs -> FBX + manifest
        │  ./tools/blender.ps1 build [-Only Rock_Boulder]      (Blender 5.x headless, or python + the bpy module)
        ▼
Assets/Art/Models/<Category>/<Name>.fbx                 LOD meshes <Name>_LOD0..n, material slots by name
Assets/Art/Models/<Category>/Textures/<Name>_Normal.png  tangent-space normal, OpenGL (high-poly sources only)
                                     <Name>_Mask.png    R AO, G curvature (0.5 flat), B moss mask
Assets/Art/Models/props_manifest.json                   kinds, variants, LOD triangles, extents, slots
        │  ./tools/blender.ps1 check [-Determinism]      re-import every FBX and validate it
        │  PropModelPostprocessor                        import settings (metres, axis baked, MikkTSpace)
        ▼
Voxelwild ▸ Art ▸ Build Prop Library (PropLibraryBuilder; part of ./tools/unity.ps1 build)
        ▼
Assets/Art/Models/PropLibrary.asset + <Category>/Materials/<Name>_<Slot>.mat (Voxelwild/Prop)
        ▼
PropRegistry rules -> DecorationJob places props -> PropField lights, culls and instances them
```

### Conventions

- Units: metres; one block is 1 m. +Z up in Blender, converted on export so objects import with identity
  transforms.
- Pivots: floor props at the base centre, growing up; ceiling props at the attachment point, hanging down.
  Roots and bases extend 0.1–0.35 m below the pivot so nothing floats on uneven ground.
- Naming: `<Category>_<Name>_<Variant>` (for example `Rock_Boulder_02`), LOD meshes `_LOD0…_LODn`. The kind
  (`Rock_Boulder`) is what `PropRegistry` places.
- Every mesh has two UV sets: UV0 `UVBake` (unique, for the baked maps) and UV1 `UVTile` (bark in metres,
  end grain 0–1; for foliage UV1.x is the biome-tint weight). The `Col` colour attribute holds sRGB albedo
  for vertex-coloured slots and the wind weight in alpha.
- Material slots name the look, not a texture. Each slot in the manifest says which block layer it samples
  (`Stone`, `Sandstone`, `OakLog`, `LogTop`…), how (`triplanar`, `uv`, `vertex`), its tiling, tint, moss
  and roughness. Props share the terrain's Texture2DArrays and per-layer tuning, so a boulder is the same
  stone as the blocks beside it.
- Boulders enclose a core: the placement job writes a stone block at the anchor, hidden inside the mesh,
  so the player collides with it like terrain. The mesh encloses every yaw of that block (a cylinder of
  radius √0.5, 1 m tall) on LOD0 and LOD1; `check_props.py` verifies it. Dead trees and fallen logs get
  invisible `PropBarrier` cells instead.

### Generators

| Kind | Variants | Built from | LOD triangles |
|---|---|---|---|
| Rock_Pebbles | 4 | 4–7 small fractured rocks | ~420 / 160 / 48 |
| Rock_Stone | 4 | lumpy ellipsoid, 3–5 fracture planes, bevel pass, cracks, strata | 560 / 200 / 60 |
| Rock_Boulder | 4 | as stones, larger, around the core | 1400 / 520 / 160 |
| Cave_Stalactite | 4 | lathe on a bent axis: flared root, growth bands, drip point; 0.7–2.8 m | 380 / 150 / 48 |
| Cave_Stalagmite | 4 | as stalactites with a rounded dome; 0.5–2.2 m | 380 / 150 / 48 |
| Tree_Dead | 3 | recursive branch growth (wobble, taper, 35–65° splits), flared roots | 1200–1700 / 650 / 220 |
| Tree_Stump | 2 | saw-cut trunk with root flares, end-grain top | 670 / 320 / 100 |
| Tree_FallenLog | 2 | bowed log, snapped side branches, end grain both ends (oak, birch) | 500 / 400 / 120 |
| Plant_Mushrooms | 3 | brown cluster, fly agaric, pale tall cluster; vertex colour | 240–1680, LODs regenerated |
| Plant_GrassClump | 2 | 30 curved, twisted blades | 240 / 60 |
| Plant_FlowerClump | 2 | blades plus daisy-like heads (white, violet) | 192 / 100 |

High-poly sources (rocks, formations) are baked onto a decimated game mesh. Wood and plants bake AO,
curvature and moss from the game mesh itself and use the bark scan's normal map.

### Determinism

The same Blender version produces byte-identical FBX and PNG files: seeds come from the kind name, the FBX
header timestamp is pinned, and bake margins are filled in numpy rather than by Cycles (whose margin fill
varies with thread timing). `check_props.py --determinism` rebuilds one prop per family twice and compares
bytes. Commit rebuilt props once per change of a generator, like the texture atlases.

### Requirements

- Blender 5.x (developed against 5.2; also runs on the `bpy` 5.0 module from PyPI with Python 3.11). The build
  and check use only numpy, which Blender bundles.
- `preview_props.py` additionally needs Pillow and the scanned texture sets fetched through LFS.

### Adding a prop kind

1. Write a generator in `tools/blender/vw/` returning an `Asset` (see `asset.py`) and list it in the module's
   `GENERATORS`.
2. Add a rule with the same kind name to `PropRegistry` (placement, biomes, support blocks, density, scale,
   clearance). Append only: kind ids are stored with generated props.
3. `./tools/blender.ps1 build -Only <Kind>`, then `check` and `preview`.
4. `./tools/unity.ps1 build`, `test -Platform EditMode` (the manifest test checks the registry against the
   build) and `turntable`; review the strip in `Screenshots/turntables/`, then a capture run.
