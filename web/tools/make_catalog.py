"""The block catalog: Minecraft's full blocks, plants and glass beyond the game's own blocks.

    python web/tools/make_catalog.py "<path>/LBPR Reload! v.6.6 for mc1.21.8.zip"

Writes web/src/shared/catalog.json: every block with its textures (Minecraft texture names, checked against the
pack; blocks whose textures are missing are left out), shape and material class. blocks.js registers them (ids from
1000), build_lbpr.py bakes their textures, the game generates their normal and material maps at load.
Texture names starting with '@dense:' are sparse leaf sprites layered into a full, tileable leaf face.
"""
import json
import re
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
              "red_mushroom", "sweet_berry_bush_stage3", "sugar_cane", "cobweb", "carrots_stage3", "potatoes_stage3",
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
    add("redstone_lamp", "glass", all="redstone_lamp")
    add("lit_redstone_lamp", "glass", all="redstone_lamp_on", emission=15, noitem=True, name="Redstone Lamp")
    add("chest", "wood", top="chest_top", side="chest_side")
    add("lit_furnace", "stone", top="furnace_top", side="furnace_front_on", bottom="furnace_top", emission=13, noitem=True, name="Furnace")
    add("barrel", "wood", top="barrel_top", side="barrel_side", bottom="barrel_bottom")
    add("bee_nest", "wood", top="bee_nest_top", side="bee_nest_front", bottom="bee_nest_bottom")
    add("beehive", "wood", top="beehive_end", side="beehive_front")
    add("fletching_table", "wood", top="fletching_table_top", side="fletching_table_front")
    add("smithing_table", "wood", top="smithing_table_top", side="smithing_table_front", bottom="smithing_table_bottom")
    add("cartography_table", "wood", top="cartography_table_top", side="cartography_table_side1")
    add("loom", "wood", top="loom_top", side="loom_front", bottom="loom_bottom")
    add("fire", "fire", all="fire_0", shape="cross", emission=15, noitem=True)
    add("soul_fire", "fire", all="soul_fire_0", shape="cross", emission=10, noitem=True)
    add("tnt_flash", "plant_block", top="@bright:tnt_top", side="@bright:tnt_side", bottom="@bright:tnt_bottom", noitem=True, name="TNT")
    add("piston", "stone", top="piston_top", side="piston_side", bottom="piston_bottom")
    add("sticky_piston", "stone", top="piston_top_sticky", side="piston_side", bottom="piston_bottom")
    add("brown_mushroom_block", "wood", all="brown_mushroom_block"); add("red_mushroom_block", "wood", all="red_mushroom_block")
    add("mushroom_stem", "wood", all="mushroom_stem")
    for k in ["tube", "brain", "bubble", "fire", "horn"]:
        add(f"{k}_coral_block", "stone", all=f"{k}_coral_block")
        add(f"dead_{k}_coral_block", "stone", all=f"dead_{k}_coral_block")
        add(f"{k}_coral", "plant", all=f"{k}_coral", shape="cross")
    blocks[:] = [b for b in blocks if b["key"] != "lily_pad"]   # a flat pad on the water (a model below)
    for k in ["ochre", "verdant", "pearlescent"]:
        add(f"{k}_froglight", "glass", top=f"{k}_froglight_top", side=f"{k}_froglight_side", emission=15)
    add("resin_block", "stone", all="resin_block")
    add("spawner", "metal", all="spawner", shape="clear", hard="unbreakable")

    models, texinfo = model_families(have, {b["key"] for b in blocks})

    # textures in first-use order
    textures = []
    for b in blocks:
        for t in (b["top"], b["side"], b["bottom"]):
            if t not in textures:
                textures.append(t)
    for m in models:
        for t in m.get("tex", []):
            if not t.startswith("B:") and t not in textures:
                textures.append(t)
    anims = {}
    from PIL import Image
    import io
    for t in list(textures):
        if t.startswith("@") or f"assets/minecraft/textures/block/{t}.png.mcmeta" not in z.namelist():
            continue
        im = Image.open(io.BytesIO(z.read(f"assets/minecraft/textures/block/{t}.png")))
        n = im.height // im.width
        if n < 2:
            continue
        meta = json.loads(z.read(f"assets/minecraft/textures/block/{t}.png.mcmeta").decode("utf-8", "ignore") or "{}").get("animation", {})
        ft = meta.get("frametime", 1)
        step = max(1, -(-n // 12))
        keep = list(range(0, n, step))[:12]
        frames = [t] + [f"@frame:{k}:{t}" for k in keep[1:]]
        textures.extend(frames[1:])
        anims[t] = dict(frames=frames, fps=round(20 / (ft * step), 2))
    OUT.write_text(json.dumps({"textures": textures, "blocks": blocks, "models": models, "texinfo": texinfo, "anims": anims}, separators=(",", ":")))
    print(f"{len(blocks)} blocks, {len(models)} shaped families, {len(textures)} textures, {len(anims)} animated -> {OUT}")


WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo", "crimson", "warped"]


def model_families(have, keys):
    """Shaped blocks (stairs, slabs, walls, fences, gates, doors, trapdoors, panes, carpets, plates, buttons, ladders, vines,
    rails, snow layers, paths, tall plants, lily pads, wall torches). mat: the full block they are cut from ('B:Name' for
    the game's own blocks, else a catalog key), whose textures they share; tex: their own Minecraft textures ('B:Name' =
    that game block's side texture, '@rot90:name' = the texture turned a quarter)."""
    out, texinfo = [], {}

    def fam(key, kind, name=None, mat=None, tex=None, **extra):
        if mat and not mat.startswith("B:") and mat not in keys:
            return
        for t in tex or []:
            base = re.sub(r"^(@rot\d+:)+", "", t)
            if not t.startswith("B:") and not base.startswith("@crop:") and base.split(":")[-1] not in have:
                return
        out.append(dict(key=key, kind=kind, name=name or title(key), **({"mat": mat} if mat else {}), **({"tex": tex} if tex else {}), **extra))
        for t in tex or []:
            if not t.startswith("B:"):
                texinfo.setdefault(t, dict(cat=extra.get("cat", "wood"), cutout=1 if extra.get("list") in ("cutout", "glow") else 0,
                                           **({"tint": extra["tint"]} if extra.get("tint") else {})))

    plank = lambda w: "B:Planks" if w == "oak" else f"{w}_planks"
    stone_like = [("stone", "B:Stone"), ("cobblestone", "B:Cobblestone"), ("mossy_cobblestone", "mossy_cobblestone"),
                  ("stone_brick", "B:StoneBricks"), ("mossy_stone_brick", "B:MossyStoneBricks"), ("smooth_stone", "smooth_stone"),
                  ("granite", "granite"), ("polished_granite", "polished_granite"), ("diorite", "diorite"), ("polished_diorite", "polished_diorite"),
                  ("andesite", "andesite"), ("polished_andesite", "polished_andesite"), ("cobbled_deepslate", "cobbled_deepslate"),
                  ("polished_deepslate", "polished_deepslate"), ("deepslate_brick", "deepslate_bricks"), ("deepslate_tile", "deepslate_tiles"),
                  ("tuff", "tuff"), ("polished_tuff", "polished_tuff"), ("tuff_brick", "tuff_bricks"), ("brick", "B:Bricks"), ("mud_brick", "mud_bricks"),
                  ("sandstone", "B:Sandstone"), ("smooth_sandstone", "smooth_sandstone"), ("cut_sandstone", "cut_sandstone"),
                  ("red_sandstone", "B:RedSandstone"), ("smooth_red_sandstone", "smooth_red_sandstone"), ("cut_red_sandstone", "cut_red_sandstone"),
                  ("prismarine", "prismarine"), ("prismarine_brick", "prismarine_bricks"), ("dark_prismarine", "dark_prismarine"),
                  ("nether_brick", "B:NetherBricks"), ("red_nether_brick", "red_nether_bricks"), ("blackstone", "B:Blackstone"),
                  ("polished_blackstone", "polished_blackstone"), ("polished_blackstone_brick", "polished_blackstone_bricks"),
                  ("end_stone_brick", "B:EndStoneBricks"), ("purpur", "B:Purpur"), ("quartz", "quartz_block"), ("smooth_quartz", "smooth_quartz"),
                  ("cut_copper", "cut_copper"), ("exposed_cut_copper", "exposed_cut_copper"), ("weathered_cut_copper", "weathered_cut_copper"),
                  ("oxidized_cut_copper", "oxidized_cut_copper"), ("resin_brick", "resin_bricks"), ("bamboo_mosaic", "bamboo_mosaic")]
    for w in WOODS:
        stone_like.append((w, plank(w)))
    for k, mat in stone_like:
        cat = "wood" if k in WOODS or k == "bamboo_mosaic" else "metal" if "copper" in k else "stone"
        if k not in ("smooth_stone", "cut_sandstone", "cut_red_sandstone"):
            fam(f"{k}_stairs", "stairs", mat=mat, cat=cat)
        fam(f"{k}_slab", "slab", mat=mat, cat=cat)
    for k, mat in [("cobblestone", "B:Cobblestone"), ("mossy_cobblestone", "mossy_cobblestone"), ("stone_brick", "B:StoneBricks"),
                   ("mossy_stone_brick", "B:MossyStoneBricks"), ("granite", "granite"), ("diorite", "diorite"), ("andesite", "andesite"),
                   ("cobbled_deepslate", "cobbled_deepslate"), ("polished_deepslate", "polished_deepslate"), ("deepslate_brick", "deepslate_bricks"),
                   ("deepslate_tile", "deepslate_tiles"), ("tuff", "tuff"), ("polished_tuff", "polished_tuff"), ("tuff_brick", "tuff_bricks"),
                   ("brick", "B:Bricks"), ("mud_brick", "mud_bricks"), ("sandstone", "B:Sandstone"), ("red_sandstone", "B:RedSandstone"),
                   ("prismarine", "prismarine"), ("nether_brick", "B:NetherBricks"), ("red_nether_brick", "red_nether_bricks"),
                   ("blackstone", "B:Blackstone"), ("polished_blackstone", "polished_blackstone"), ("polished_blackstone_brick", "polished_blackstone_bricks"),
                   ("end_stone_brick", "B:EndStoneBricks"), ("resin_brick", "resin_bricks")]:
        fam(f"{k}_wall", "wall", mat=mat, cat="stone")
    for w in WOODS:
        fam(f"{w}_fence", "fence", mat=plank(w), cat="wood")
        fam(f"{w}_fence_gate", "gate", mat=plank(w), cat="wood")
        fam(f"{w}_door", "door", tex=[f"{w}_door_lower", f"{w}_door_upper"], list="cutout", cat="wood")
        fam(f"{w}_trapdoor", "trapdoor", tex=[f"{w}_trapdoor"], list="cutout", cat="wood")
        fam(f"{w}_pressure_plate", "plate", mat=plank(w), cat="wood")
        fam(f"{w}_button", "button", mat=plank(w), cat="wood")
    fam("nether_brick_fence", "fence", mat="B:NetherBricks", cat="stone")
    for k in ["iron", "copper", "exposed_copper", "weathered_copper", "oxidized_copper"]:
        fam(f"{k}_door", "door", tex=[f"{k}_door_lower", f"{k}_door_upper"], list="cutout", cat="metal")
        fam(f"{k}_trapdoor", "trapdoor", tex=[f"{k}_trapdoor"], list="cutout", cat="metal")
    fam("stone_pressure_plate", "plate", mat="B:Stone", cat="stone")
    fam("polished_blackstone_pressure_plate", "plate", mat="polished_blackstone", cat="stone")
    fam("light_weighted_pressure_plate", "plate", mat="gold_block", cat="metal")
    fam("heavy_weighted_pressure_plate", "plate", mat="iron_block", cat="metal")
    fam("stone_button", "button", mat="B:Stone", cat="stone")
    fam("polished_blackstone_button", "button", mat="polished_blackstone", cat="stone")
    fam("glass_pane", "pane", tex=["glass"], list="cutout", cat="glass")
    for c in COLORS:
        fam(f"{c}_stained_glass_pane", "pane", tex=[f"{c}_stained_glass"], list="glow", cat="glass")
    fam("iron_bars", "pane", tex=["iron_bars"], list="cutout", cat="metal")
    for c in COLORS:
        fam(f"{c}_carpet", "carpet", mat=f"{c}_wool", cat="wool")
    fam("moss_carpet", "carpet", mat="B:Moss", cat="dirt")
    fam("pale_moss_carpet", "carpet", mat="pale_moss_block", cat="dirt")
    fam("ladder", "ladder", tex=["ladder"], list="cutout", cat="wood")
    fam("vine", "ladder", tex=["vine"], list="cutout", cat="leaves", tint="foliage")
    fam("glow_lichen", "ladder", tex=["glow_lichen"], list="cutout", cat="leaves", emission=7)
    for k in ["rail", "powered_rail", "detector_rail", "activator_rail"]:
        fam(k, "rail", tex=[k, f"@rot90:{k}"], list="cutout", cat="metal")
    fam("lily_pad", "lily", tex=["lily_pad"], list="cutout", cat="plant", tint="foliage")
    fam("snow", "snow", mat="B:Snow", cat="sand", name="Snow Layer")
    fam("dirt_path", "path", tex=["dirt_path_top", "dirt_path_side", "B:Dirt"], cat="dirt")
    fam("farmland", "path", tex=["farmland_moist", "farmland_side", "B:Dirt"], cat="dirt")
    for k, tint in [("sunflower", None), ("lilac", None), ("rose_bush", None), ("peony", None), ("tall_grass", "grass"), ("large_fern", "grass")]:
        top = "sunflower_front" if k == "sunflower" else f"{k}_top"
        fam(k, "tall", tex=[f"{k}_bottom", top], list="cutout", cat="plant", **({"tint": tint} if tint else {}))
    fam("wall_torch", "walltorch", mat="B:Torch", cat="plant")

    # ---- redstone
    dust = []
    for c in ["3c0000", "8a0000", "c81008", "ff3a1a"]:           # power 0, 1-5, 6-10, 11-15
        dust += [f"@tint:{c}:redstone_dust_dot", f"@tint:{c}:redstone_dust_line0", f"@rot90:@tint:{c}:redstone_dust_line0"]
    fam("redstone_wire", "wire", tex=dust, list="cutout", cat="plant", noitem=True, name="Redstone Dust")
    fam("redstone_torch", "rtorch", tex=["redstone_torch", "redstone_torch_off"], list="cutout", cat="plant", emission=7)
    fam("lever", "lever", tex=["lever", "B:Cobblestone"], list="cutout", cat="plant")
    rep = [f"@rot{r}:repeater" for r in (0, 90, 180, 270)] + [f"@rot{r}:repeater_on" for r in (0, 90, 180, 270)]
    fam("repeater", "repeater", tex=rep + ["smooth_stone", "redstone_torch", "redstone_torch_off"], list="cutout", cat="stone", name="Redstone Repeater")
    side = ["piston_side", "@rot90:piston_side", "@rot180:piston_side", "@rot270:piston_side"]
    fam("piston", "piston", tex=["piston_top", side[0], "piston_bottom", "piston_inner"] + side[1:], cat="stone")
    fam("sticky_piston", "piston", tex=["piston_top_sticky", side[0], "piston_bottom", "piston_inner"] + side[1:], cat="stone")
    fam("piston_head", "head", tex=["piston_top", "piston_top_sticky"] + side, cat="stone", noitem=True, name="Piston Head")
    comp = [f"@rot{r}:comparator" for r in (0, 90, 180, 270)] + [f"@rot{r}:comparator_on" for r in (0, 90, 180, 270)]
    fam("comparator", "comparator", tex=comp + ["smooth_stone", "redstone_torch", "redstone_torch_off"], list="cutout", cat="stone", name="Redstone Comparator")
    oside = ["observer_side", "@rot90:observer_side", "@rot180:observer_side", "@rot270:observer_side"]
    fam("observer", "observer", tex=["observer_front", "observer_back", "observer_back_on"] + oside, cat="stone")
    fam("dispenser", "dispenser", tex=["dispenser_front", "dispenser_front_vertical", "furnace_side", "furnace_top"], cat="stone")
    fam("dropper", "dispenser", tex=["dropper_front", "dropper_front_vertical", "furnace_side", "furnace_top"], cat="stone")
    fam("hopper", "hopper", tex=["hopper_outside", "hopper_top", "hopper_inside"], cat="metal")
    # ---- survival
    for c in COLORS:
        beds = [f"@rot{r}:@crop:entity/bed/{c}:6,6,16,16" for r in (0, 90, 180, 270)] + [f"@rot{r}:@crop:entity/bed/{c}:6,28,16,16" for r in (0, 90, 180, 270)]
        fam(f"{c}_bed", "bed", tex=beds + [f"{c}_wool", "B:Planks"], cat="wool")
    fam("wheat", "crop", tex=[f"wheat_stage{k}" for k in range(8)], list="cutout", cat="plant", noitem=True, name="Wheat Crops")
    # ---- not in Minecraft: a waystone (a fast-travel obelisk, two blocks tall) and a gravestone that keeps a death's items
    fam("waystone", "waystone", tex=["lodestone_top", "lodestone_side", "B:StoneBricks"], cat="stone", name="Waystone")
    fam("gravestone", "grave", tex=["mossy_cobblestone", "B:Cobblestone"], cat="stone", noitem=True, name="Gravestone")
    # the Skylands portal (a glowstone frame lit with water), not in Minecraft
    fam("sky_portal", "skyportal", tex=["@tint:8fc8ff:nether_portal"], list="glow", cat="glass", noitem=True, name="Skylands Portal", emission=11)
    return out, texinfo


if __name__ == "__main__":
    main()
