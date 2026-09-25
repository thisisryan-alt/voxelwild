# Credits

## Textures

Block materials are photoscanned PBR sets from [ambientCG](https://ambientcg.com), released under
[CC0 1.0](https://docs.ambientcg.com/license/). No attribution is required; it is given here anyway.

| Layer       | ambientCG asset   |
|-------------|-------------------|
| Stone       | Rock058           |
| Dirt        | Ground103         |
| Grass (top) | Grass004          |
| Sand        | Ground080         |
| Gravel      | Ground110         |
| Snow        | Snow010A          |
| Bedrock     | Rock035           |
| Cobblestone | PavingStones151   |
| Planks      | Planks037A        |
| Bricks      | Bricks097         |
| Oak log     | Bark014           |
| Birch log   | Bark001 (lightened) |
| Spruce log  | Bark012           |
| Jungle log  | Bark015           |
| Sandstone   | Rock053           |
| Red sandstone | Rock061         |
| Mud         | Ground036         |
| Moss        | Moss002           |
| Ice         | Ice002            |

Generator inputs: **Leaf001** (composited into the leaves texture), **TreeEnd002** (log tops) and
**Rock058** (base for the four ore textures).

Needles, grass tufts, flowers, dead bush, glowcaps, cactus and torch are generated procedurally by
`tools/generate_textures.py` (original to this project).

The source maps live in `SourceArt/Textures/ambientCG/` (Git LFS) and are packed into Texture2DArrays by
`Voxelwild ▸ Art ▸ Build Block Texture Arrays`. See [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

## Props

The Phase 3 props (rocks, cave formations, dead wood, plant and mushroom clumps) are generated procedurally
by `tools/blender/` (original to this project). In-game they are textured with the scans above: rock with
Rock058, cave formations with Rock053, wood with the bark scans and the log-top set, moss with Moss002.
