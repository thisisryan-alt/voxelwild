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

## Built-in resource packs (browser build)

Selectable in Settings ▸ Block textures. Built by `web/tools/build_packs.py`.

- **Voxelwild Photoreal**: photogrammetry scans from [Poly Haven](https://polyhaven.com), all **CC0**:
  rock_surface, dirt, leafy_grass, sand_01, river_small_rocks, snow_02, dark_rock, cobblestone_floor_08,
  wood_planks, red_brick, bark_brown_02, tree_bark_03, pine_bark, jolcham_oak_bark_01, old_sandstone_02,
  red_laterite_soil_stones, brown_mud_02. The ore textures are composed from rock_surface in this project.
- **Soothing 32** by **Zughy**, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  ([ContentDB](https://content.luanti.org/packages/Zughy/soothing32/),
  [source](https://gitlab.com/zughy-friends-minetest/soothing-32)). Changes: renamed to Minecraft texture
  names, upscaled 16× with nearest-neighbour; bedrock and mud are darkened copies of its stone and dirt; the
  ores are its mineral overlays composited on its stone. The adapted textures
  (`web/assets/pack_soothing32_color.webp`) are shared under the same licence.

## LB Photo Realism Reload! (browser build default textures)

[LB Photo Realism Reload!](https://www.curseforge.com/minecraft/texture-packs/lb-photo-realism-reload) v6.6 for
Minecraft 1.21.8 by **1LotS**, based on LB Photo Realism and GKrond's version of LBPR. Licence (the pack's
Licence.txt): the textures may be used any way with credit and a link to the CurseForge page, and no money may be
made from them. Its sounds come from freesfx.co.uk and orangefreesounds.com, edited by 1LotS.
Baked by `web/tools/build_lbpr.py` into `web/assets/lbpr/` (block textures with generated normal, height, AO and
roughness maps, item icons, destroy stages, the full moon, rain, water, grass-step, stone-break and pop sounds).

## Mob models (browser build)

The mobs' geometry (bones, cubes, texture coordinates) comes from Mojang's Bedrock entity models in
[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples) (`resource_pack/models/entity`), copied to
`web/tools/geo/` and condensed by `web/tools/build_mobs.py`. Their skins are LB Photo Realism Reload!'s entity
textures (see above).
