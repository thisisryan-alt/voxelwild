"""The block catalog: Minecraft's full blocks, plants and glass beyond the game's own blocks.

    python web/tools/make_catalog.py "<path>/LBPR Reload! v.6.6 for mc1.21.8.zip"

Writes web/src/shared/catalog.json: every block with its textures (Minecraft texture names, checked against the
pack; blocks whose textures are missing are left out), shape and material class. blocks.js registers them (ids from
1000), build_lbpr.py bakes their textures, the game generates their normal and material maps at load.
Texture names starting with '@dense:' are sparse leaf sprites layered into a full, tileable leaf face.
"""
import json
import pathlib
import sys
import zipfile

OUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "shared" / "catalog.json"
COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown",
          "green", "red", "black"]


def title(key):
    return " ".join(w.capitalize() for w in key.replace("_", " ").split())


def main():
    z = zipfile.ZipFile(sys.argv[1])
    have = {n[len("assets/minecraft/textures/block/"):-4] for n in z.namelist()
            if n.startswith("assets/minecraft/textures/block/") and n.endswith(".png") and n.count("/") == 4}
    blocks = []

    def add(key, cat, all=None, top=None, side=None, bottom=None, shape="cube", name=None, **extra):
        side = side or all
        top = top or all or side
        bottom = bottom or top
        for t in (top, side, bottom):
            if not t.startswith("@") and t not in have:
                return
            if t.startswith("@dense:") and t[7:] not in have:
                return
        blocks.append(dict(key=key, name=name or title(key), cat=cat, shape=shape, top=top, side=side, bottom=bottom, **extra))

    # ---- stone
    for k in ["granite", "polished_granite", "diorite", "polished_diorite", "andesite", "polished_andesite", "calcite", "tuff",
              "polished_tuff", "tuff_bricks", "chiseled_tuff", "dripstone_block", "smooth_stone", "chiseled_stone_bricks",
              "mossy_cobblestone", "cobbled_deepslate", "polished_deepslate", "deepslate_bricks", "cracked_deepslate_bricks",
              "deepslate_tiles", "cracked_deepslate_tiles", "chiseled_deepslate", "smooth_basalt", "polished_blackstone",
              "polished_blackstone_bricks", "cracked_polished_blackstone_bricks", "chiseled_polished_blackstone", "gilded_blackstone",
              "red_nether_bricks", "chiseled_nether_bricks", "cracked_nether_bricks", "quartz_bricks", "prismarine", "prismarine_bricks",
              "dark_prismarine", "mud_bricks", "packed_mud", "resin_bricks", "chiseled_resin_bricks", "amethyst_block", "budding_amethyst",
              "end_stone_bricks", "terracotta", "chiseled_copper", "cut_copper", "copper_block", "exposed_copper", "weathered_copper",
              "oxidized_copper", "exposed_cut_copper", "weathered_cut_copper", "oxidized_cut_copper", "exposed_chiseled_copper",
              "weathered_chiseled_copper", "oxidized_chiseled_copper", "netherite_block", "coal_block", "iron_block", "gold_block",
              "diamond_block", "emerald_block", "lapis_block", "redstone_block", "raw_iron_block", "raw_copper_block", "raw_gold_block"]:
        cat = "metal" if k.endswith("_block") and k.split("_")[0] in ("netherite", "iron", "gold", "diamond", "emerald", "lapis", "redstone", "coal") else \
              "metal" if "copper" in k or k.startswith("raw_") else "stone"
        add(k, cat, all=k)
    add("deepslate", "stone", top="deepslate_top", side="deepslate")
    add("chiseled_tuff_bricks", "stone", top="chiseled_tuff_bricks_top", side="chiseled_tuff_bricks")
    add("polished_basalt", "stone", top="polished_basalt_top", side="polished_basalt_side")
    add("ancient_debris", "stone", top="ancient_debris_top", side="ancient_debris_side", hard="obsidian")
    add("lodestone", "metal", top="lodestone_top", side="lodestone_side")
    add("crying_obsidian", "stone", all="crying_obsidian", emission=10, hard="obsidian")
    add("quartz_block", "stone", top="quartz_block_top", side="quartz_block_side", bottom="quartz_block_bottom")
    add("chiseled_quartz_block", "stone", top="chiseled_quartz_block_top", side="chiseled_quartz_block")
    add("quartz_pillar", "stone", top="quartz_pillar_top", side="quartz_pillar")
    add("smooth_quartz", "stone", all="quartz_block_bottom", name="Smooth Quartz Block")
    add("purpur_pillar", "stone", top="purpur_pillar_top", side="purpur_pillar")
    add("chiseled_sandstone", "stone", top="sandstone_top", side="chiseled_sandstone")
    add("cut_sandstone", "stone", top="sandstone_top", side="cut_sandstone")
    add("smooth_sandstone", "stone", all="sandstone_top")
    add("chiseled_red_sandstone", "stone", top="red_sandstone_top", side="chiseled_red_sandstone")
    add("cut_red_sandstone", "stone", top="red_sandstone_top", side="cut_red_sandstone")
    add("smooth_red_sandstone", "stone", all="red_sandstone_top")
    # ---- ores
    for k, tier in [("copper_ore", 2), ("lapis_ore", 2), ("redstone_ore", 3), ("emerald_ore", 3)]:
        add(k, "ore", all=k, tier=tier)
    for k, tier in [("coal", 1), ("iron", 2), ("copper", 2), ("gold", 3), ("redstone", 3), ("emerald", 3), ("lapis", 2), ("diamond", 3)]:
        add(f"deepslate_{k}_ore", "ore", all=f"deepslate_{k}_ore", tier=tier)
    # ---- soils, sands, ice
    add("coarse_dirt", "dirt", all="coarse_dirt"); add("rooted_dirt", "dirt", all="rooted_dirt"); add("clay", "dirt", all="clay")
    add("podzol", "dirt", top="podzol_top", side="podzol_side", bottom="dirt")
    add("mycelium", "dirt", top="mycelium_top", side="mycelium_side", bottom="dirt")
    add("red_sand", "sand", all="red_sand"); add("powder_snow", "sand", all="powder_snow")
    add("suspicious_sand", "sand", all="suspicious_sand_0"); add("suspicious_gravel", "sand", all="suspicious_gravel_0")
    add("packed_ice", "ice", all="packed_ice"); add("blue_ice", "ice", all="blue_ice")
    add("pale_moss_block", "dirt", all="pale_moss_block"); add("sculk", "dirt", all="sculk")
    add("mud_block_mangrove_roots", "dirt", top="muddy_mangrove_roots_top", side="muddy_mangrove_roots_side", name="Muddy Mangrove Roots")
    # ---- colours
    for c in COLORS:
        add(f"{c}_wool", "wool", all=f"{c}_wool")
        add(f"{c}_concrete", "stone", all=f"{c}_concrete")
        add(f"{c}_concrete_powder", "sand", all=f"{c}_concrete_powder")
        add(f"{c}_terracotta", "stone", all=f"{c}_terracotta")
        add(f"{c}_glazed_terracotta", "stone", all=f"{c}_glazed_terracotta")
        add(f"{c}_stained_glass", "glass", all=f"{c}_stained_glass", shape="glass")
    add("glass", "glass", all="glass", shape="clear")
    add("tinted_glass", "glass", all="tinted_glass", shape="glass")
    for s in ["", "exposed_", "weathered_", "oxidized_"]:
        add(f"{s}copper_grate", "metal", all=f"{s}copper_grate", shape="clear")
    # ---- wood
    woods = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"]
    for w in woods:
        if w not in ("oak",):
            add(f"{w}_planks", "wood", all=f"{w}_planks")
        if w not in ("oak", "spruce", "birch", "jungle"):
            add(f"{w}_log", "wood", top=f"{w}_log_top", side=f"{w}_log")
        add(f"stripped_{w}_log", "wood", top=f"stripped_{w}_log_top", side=f"stripped_{w}_log")
        add(f"{w}_wood", "wood", all=f"{w}_log")
        add(f"stripped_{w}_wood", "wood", all=f"stripped_{w}_log")
    for w in ["crimson", "warped"]:
        add(f"{w}_planks", "wood", all=f"{w}_planks")
        add(f"stripped_{w}_stem", "wood", top=f"stripped_{w}_stem_top", side=f"stripped_{w}_stem")
    add("bamboo_planks", "wood", all="bamboo_planks"); add("bamboo_mosaic", "wood", all="bamboo_mosaic")
    add("bamboo_block", "wood", top="bamboo_block_top", side="bamboo_block")
    add("stripped_bamboo_block", "wood", top="stripped_bamboo_block_top", side="stripped_bamboo_block")
    add("mangrove_roots", "wood", top="mangrove_roots_top", side="mangrove_roots_side", shape="clear")
    for w, tint in [("acacia", "foliage"), ("dark_oak", "foliage"), ("mangrove", "foliage"), ("cherry", None), ("pale_oak", None),
                    ("azalea", None), ("flowering_azalea", None), ("birch", "birch")]:
        extra = {"tint": tint} if tint else {}
        add(f"{w}_leaves", "leaves", all=f"@dense:{w}_leaves_better", shape="leaves", **extra)
    # ---- plants (crossed sprites)
    for k in ["oak_sapling", "spruce_sapling", "birch_sapling", "jungle_sapling", "acacia_sapling", "dark_oak_sapling", "cherry_sapling",
              "pale_oak_sapling", "mangrove_propagule", "allium", "azure_bluet", "blue_orchid", "cornflower", "orange_tulip", "pink_tulip",
              "red_tulip", "white_tulip", "wither_rose", "torchflower", "fern", "short_dry_grass", "tall_dry_grass", "brown_mushroom",
              "red_mushroom", "sweet_berry_bush_stage3", "sugar_cane", "cobweb", "wheat_stage7", "carrots_stage3", "potatoes_stage3",
              "beetroots_stage3", "nether_sprouts", "hanging_roots", "firefly_bush", "lily_pad", "kelp_plant_static", "seagrass",
              "tumbleweed", "spore_blossom", "open_eyeblossom_flower"]:
        name = {"sweet_berry_bush_stage3": "Sweet Berry Bush", "wheat_stage7": "Wheat", "carrots_stage3": "Carrots", "potatoes_stage3": "Potatoes",
                "beetroots_stage3": "Beetroots", "kelp_plant_static": "Kelp", "open_eyeblossom_flower": "Open Eyeblossom"}.get(k)
        tint = {"fern": "grass", "sugar_cane": None}.get(k)
        extra = {"tint": tint} if tint else {}
        if k == "firefly_bush":
            extra["emission"] = 4
        add(k, "plant", all=k, shape="cross", name=name, **extra)
    # ---- blocks with faces
    add("crafting_table", "wood", top="crafting_table_top", side="crafting_table_front", bottom="oak_planks")
    add("furnace", "stone", top="furnace_top", side="furnace_front", bottom="furnace_top")
    add("blast_furnace", "stone", top="blast_furnace_top", side="blast_furnace_front", bottom="blast_furnace_top")
    add("smoker", "stone", top="smoker_top", side="smoker_front", bottom="smoker_bottom")
    add("pumpkin", "wood", top="pumpkin_top", side="pumpkin_side")
    add("carved_pumpkin", "wood", top="pumpkin_top", side="carved_pumpkin")
    add("jack_o_lantern", "wood", top="pumpkin_top", side="jack_o_lantern", emission=15)
    add("melon", "wood", top="melon_top", side="melon_side")
    add("hay_block", "plant_block", top="hay_block_top", side="hay_block_side", name="Hay Bale")
    add("dried_kelp_block", "plant_block", top="dried_kelp_top", side="dried_kelp_side", bottom="dried_kelp_bottom")
    add("sponge", "plant_block", all="sponge"); add("wet_sponge", "plant_block", all="wet_sponge")
    add("bone_block", "stone", top="bone_block_top", side="bone_block_side")
    add("sea_lantern", "glass", all="sea_lantern", emission=15)
    add("honeycomb_block", "plant_block", all="honeycomb_block")
    add("slime_block", "plant_block", all="slime_block", shape="glass")
    add("honey_block", "plant_block", top="honey_block_top", side="honey_block_side", bottom="honey_block_bottom", shape="glass")
    add("target", "plant_block", top="target_top", side="target_side")
    add("tnt", "plant_block", top="tnt_top", side="tnt_side", bottom="tnt_bottom", name="TNT")
    add("note_block", "wood", all="note_block")
    add("jukebox", "wood", top="jukebox_top", side="jukebox_side")
    add("redstone_lamp", "glass", all="redstone_lamp_on", emission=15)
    add("barrel", "wood", top="barrel_top", side="barrel_side", bottom="barrel_bottom")
    add("bee_nest", "wood", top="bee_nest_top", side="bee_nest_front", bottom="bee_nest_bottom")
    add("beehive", "wood", top="beehive_end", side="beehive_front")
    add("fletching_table", "wood", top="fletching_table_top", side="fletching_table_front")
    add("smithing_table", "wood", top="smithing_table_top", side="smithing_table_front", bottom="smithing_table_bottom")
    add("cartography_table", "wood", top="cartography_table_top", side="cartography_table_side1")
    add("loom", "wood", top="loom_top", side="loom_front", bottom="loom_bottom")
    add("observer", "stone", top="observer_top", side="observer_front")
    add("dispenser", "stone", top="furnace_top", side="dispenser_front")
    add("dropper", "stone", top="furnace_top", side="dropper_front")
    add("piston", "stone", top="piston_top", side="piston_side", bottom="piston_bottom")
    add("sticky_piston", "stone", top="piston_top_sticky", side="piston_side", bottom="piston_bottom")
    add("brown_mushroom_block", "wood", all="brown_mushroom_block"); add("red_mushroom_block", "wood", all="red_mushroom_block")
    add("mushroom_stem", "wood", all="mushroom_stem")
    for k in ["tube", "brain", "bubble", "fire", "horn"]:
        add(f"{k}_coral_block", "stone", all=f"{k}_coral_block")
        add(f"dead_{k}_coral_block", "stone", all=f"dead_{k}_coral_block")
        add(f"{k}_coral", "plant", all=f"{k}_coral", shape="cross")
    for k in ["ochre", "verdant", "pearlescent"]:
        add(f"{k}_froglight", "glass", top=f"{k}_froglight_top", side=f"{k}_froglight_side", emission=15)
    add("resin_block", "stone", all="resin_block")
    add("spawner", "metal", all="spawner", shape="clear", hard="unbreakable")

    # textures in first-use order
    textures = []
    for b in blocks:
        for t in (b["top"], b["side"], b["bottom"]):
            if t not in textures:
                textures.append(t)
    OUT.write_text(json.dumps({"textures": textures, "blocks": blocks}, separators=(",", ":")))
    print(f"{len(blocks)} blocks, {len(textures)} textures -> {OUT}")


if __name__ == "__main__":
    main()
