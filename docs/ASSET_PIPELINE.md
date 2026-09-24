# Asset pipeline

## Principles

- **Sources live outside `Assets/`** (`SourceArt/`), so Unity doesn't import raw scans or .blend files.
  Generated, engine-ready outputs go into `Assets/Art/`.
- **Every step is scripted and re-runnable**, from a menu item or from `tools/unity.ps1` and
  `tools/*.py`. Nothing depends on hand-tweaked import settings.
- **Binary art is Git LFS** (see `.gitattributes`): textures, .blend, .fbx, audio and fonts.
- **Quality gate:** an asset isn't done until it has been seen in-engine through a capture.

## Block textures (Phase 1, in use)

```
SourceArt/Textures/block_layers.json      ordered layer list (must match enum TextureLayer)
SourceArt/Textures/ambientCG/<id>/*.jpg   Color, NormalGL, Roughness, AmbientOcclusion, Displacement
        │  python tools/fetch_ambientcg.py        (re-download; CC0, 1K JPG sets)
        ▼
Voxelwild ▸ Art ▸ Build Block Texture Arrays   (BlockTextureArrays.cs)
        ▼
Assets/Art/Textures/Blocks/BlockAlbedo_Array.png   RGB colour, A height        sRGB
                          BlockNormal_Array.png   RGB OpenGL normal           linear
                          BlockMask_Array.png     R AO, G rough, B metal      linear
        │  BlockTextureArrayImporter (AssetPostprocessor): 4-column flipbook → Texture2DArray,
        │  BC7, Kaiser mips, aniso 8, max size 16384
        ▼
Terrain.mat (_AlbedoArray/_NormalArray/_MaskArray) + TerrainLayerProfile (per-layer tuning)
```

To add a block texture:

1. Append a layer to `block_layers.json`.
2. Append the same name to `enum TextureLayer`. An EditMode test enforces that the order matches.
3. Run the fetch tool, then `./tools/unity.ps1 build`.
4. Reference the layer from the block's `BlockDefinition`.
5. Tune it in `Assets/Settings/Rendering/TerrainLayerProfile.asset`.

The builder creates the profile only when it's missing, so manual tuning is preserved.

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
Prefabs placed by world generation (Phase 2 feature placement)
```

The conventions are fixed now so that Phase 3 assets drop straight in:

- Units: metres. One block is 1 m. Up axis is +Z in Blender and is converted on export.
- Naming: `<Category>_<Name>_<Variant>` (for example `Rock_Boulder_03`). LOD meshes use the `_LOD0…_LODn`
  suffix, which Unity turns into an LODGroup automatically.
- Materials use the same packed channels as terrain (albedo+height, normal GL, AO/rough/metal), so the
  same shader family can render props.
- Textures are baked from high-poly to game mesh in Blender (normal, AO, curvature). Curvature drives
  edge wear in the shader rather than being painted in.
