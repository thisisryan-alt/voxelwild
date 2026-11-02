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

## Characters

`Human_Adam` (`docs/CHARACTERS.md`) is generated from CC0 data. No attribution is required; it is
given here anyway.

| Source | Used for | License |
|---|---|---|
| [MPFB2](https://github.com/makehumancommunity/mpfb2) / [MakeHuman](http://www.makehumancommunity.org) (hm08 base mesh, macro/detail/expression targets, `mixamo_unity` rig and weights, region masks) | anatomy, morphs, facial blend shapes, skeleton, skin weights | [CC0 1.0](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.ASSETS.md) |
| MakeHuman system asset pack (high-poly eye, teeth_base, tongue01) | eye socket fit, teeth and tongue meshes and textures | CC0 1.0 |
| [Poly Haven](https://polyhaven.com) HDRIs (studio_small_09 and others) | look-dev lighting only, downloaded on demand, not committed | CC0 1.0 |

The skin, iris, sclera and hair-card textures, the eyes, eyelashes, eyebrows and hair geometry, and
the Unity shaders are original to this project (`tools/blender/human/`, `Assets/Shaders/Character/`).
Spectral skin data: haemoglobin extinction (S. Prahl, OMLC), melanin and baseline absorption
(S. Jacques). The colour-model structure follows Donner & Jensen (2006) and Jimenez et al. (2010).
