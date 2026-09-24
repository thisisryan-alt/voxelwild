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

## Blender → Unity (Phase 3, planned)

Blender 5.2.1 LTS is installed and can run headless. The planned layout:

```
SourceArt/Blender/<category>/<asset>.blend        hand-authored hero assets
tools/blender/generate_<kind>.py                  procedural generators (rocks, trees, plants…)
tools/blender/export_fbx.py                       applies modifiers, LOD chain, exports FBX
tools/blender.ps1                                 runs Blender --background --python <script>
        ▼
Assets/Art/Models/<category>/<asset>_LOD{0..n}.fbx
        │  ModelImporter postprocessor: scale, tangents, materials from naming, LODGroup
        ▼
Instanced detail meshes placed by DecorationJob (props, rocks, cave formations, hero trees)
```

The conventions are fixed now so that Phase 3 assets drop straight in:

- Units: metres. One block is 1 m. Up axis is +Z in Blender and is converted on export.
- Naming: `<Category>_<Name>_<Variant>` (for example `Rock_Boulder_03`). LOD meshes use the `_LOD0…_LODn`
  suffix, which Unity turns into an LODGroup automatically.
- Materials use the same packed channels as terrain (albedo+height, normal GL, AO/rough/metal), so the
  same shader family can render props.
- Textures are baked from high-poly to game mesh in Blender (normal, AO, curvature). Curvature drives
  edge wear in the shader rather than being painted in.
