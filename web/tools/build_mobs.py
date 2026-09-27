"""Mob models and skins for the browser build.

    python web/tools/build_mobs.py "<path>/LBPR Reload! v.6.6 for mc1.21.8.zip"

Geometry: Mojang's Bedrock entity models (github.com/Mojang/bedrock-samples, resource_pack/models/entity, copied to
web/tools/geo/): bones with pivots and rotations, cubes with box or per-face UVs. Skins: LB Photo Realism Reload!'s
entity textures, downscaled to half size. Writes assets/lbpr/mobs.json (condensed models, every cube's six faces
already resolved to texture rectangles) and assets/lbpr/mob_<name>.webp.
"""
import io
import json
import pathlib
import sys
import zipfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEO = ROOT / "tools" / "geo"
OUT = ROOT / "assets" / "lbpr"

# name -> (geo file, geometry id, texture, extra layers [(geometry id, texture)], model scale)
MOBS = {
    "cow": ("cow.v2", "geometry.cow.v2", "cow/temperate_cow", [], 1),
    "pig": ("pig.v3", "geometry.pig.v3", "pig/temperate_pig", [], 1),
    "sheep": ("sheep", "geometry.sheep.sheared.v1.8", "sheep/sheep", [("geometry.sheep.v1.8", "sheep/sheep_wool")], 1),
    "chicken": ("chicken", "geometry.chicken.v1.12", "chicken/temperate_chicken", [], 1),
    "wolf": ("wolf", "geometry.wolf", "wolf/wolf", [], 1),
    "wolf_tame": ("wolf", "geometry.wolf", "wolf/wolf_tame", [], 1),
    "wolf_snowy": ("wolf", "geometry.wolf", "wolf/wolf_snowy", [], 1),
    "wolf_snowy_tame": ("wolf", "geometry.wolf", "wolf/wolf_snowy_tame", [], 1),
    "wolf_woods": ("wolf", "geometry.wolf", "wolf/wolf_woods", [], 1),
    "wolf_woods_tame": ("wolf", "geometry.wolf", "wolf/wolf_woods_tame", [], 1),
    "husk": ("zombie", "geometry.zombie.v1.8", "zombie/husk", [], 1.0625),
    "skeleton": ("skeleton", "geometry.skeleton.v1.8", "skeleton/skeleton", [], 1),
    "creeper": ("creeper", "geometry.creeper.v1.8", "creeper/creeper", [], 1),
    "spider": ("spider", "geometry.spider.v1.8", "spider/spider", [], 1),
    "zombified_piglin": ("piglin", "geometry.piglin", "piglin/zombified_piglin", [], 1),
    "blaze": ("blaze", "geometry.blaze", "blaze", [], 1),
    "ghast": ("ghast", "geometry.ghast", "ghast/ghast", [], 2.5),
    "villager_farmer": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/farmer")], 1),
    "villager_toolsmith": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/toolsmith")], 1),
    "villager_butcher": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/butcher")], 1),
    "villager_shepherd": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/shepherd")], 1),
    "villager_weaponsmith": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/weaponsmith")], 1),
    "villager_fletcher": ("custom", "geometry.villager.custom", "villager/villager", [("geometry.villager.custom", "villager/type/plains"), ("geometry.villager.custom", "villager/profession/fletcher")], 1),
    "pillager": ("custom", "geometry.illager.custom", "illager/pillager", [], 1),
    "vindicator": ("custom", "geometry.illager.custom", "illager/vindicator", [], 1),
    "slime_big": ("custom", "geometry.slime.custom", "slime/slime", [], 4),
    "slime_medium": ("custom", "geometry.slime.custom", "slime/slime", [], 2),
    "slime_small": ("custom", "geometry.slime.custom", "slime/slime", [], 1),
    "king_slime": ("custom", "geometry.slime.custom", "slime/slime", [], 8),
    "inferno_spirit": ("blaze", "geometry.blaze", "blaze", [], 3),
    "hollow_king": ("skeleton", "geometry.skeleton.v1.8", "skeleton/wither_skeleton", [], 2.6),
    "storm_ghast": ("ghast", "geometry.ghast", "ghast/ghast_shooting", [], 5),
    "sky_whale": ("ghast", "geometry.ghast", "ghast/happy_ghast", [], 3.5),
    "frost_colossus": ("custom", "geometry.polarbear.custom", "bear/polarbear", [], 3),
    "moa": ("chicken", "geometry.chicken.v1.12", "chicken/temperate_chicken", [], 2.4),
    "polar_bear": ("custom", "geometry.polarbear.custom", "bear/polarbear", [], 1),
    "strider": ("custom", "geometry.strider.custom", "strider/strider", [], 1),
    "piglin_brute": ("piglin", "geometry.piglin", "piglin/piglin_brute", [], 1),
    "stray": ("skeleton", "geometry.skeleton.v1.8", "skeleton/stray", [], 1),
    "wither_skeleton": ("skeleton", "geometry.skeleton.v1.8", "skeleton/wither_skeleton", [], 1.2),
    "cave_spider": ("spider", "geometry.spider.v1.8", "spider/cave_spider", [], 0.7),
}


def geometries(path):
    d = json.loads(path.read_text())
    out = {}
    for k, v in d.items():
        if k == "format_version":
            continue
        if isinstance(v, list):
            for g in v:
                desc = g["description"]
                out[desc["identifier"]] = dict(bones=g["bones"], tw=desc.get("texture_width", 64), th=desc.get("texture_height", 64))
        else:
            ident, _, parent = k.partition(":")
            out[ident] = dict(bones=v.get("bones", []), tw=v.get("texturewidth"), th=v.get("textureheight"), parent=parent or None)
    # inheritance (sheep: the woolly model extends the sheared one)
    for ident, g in out.items():
        if g.get("parent"):
            base = out[g["parent"]]
            names = {b["name"] for b in g["bones"]}
            g["bones"] = g["bones"] + [b for b in base["bones"] if b["name"] not in names]
            g["tw"] = g["tw"] or base["tw"]; g["th"] = g["th"] or base["th"]
    for g in out.values():
        g["tw"] = g["tw"] or 64; g["th"] = g["th"] or 32
    return out


def faces(cube, tw, th, mirror):
    """Six faces (east, west, up, down, south, north) as [u0, v0, u1, v1] in texture fractions."""
    w, h, d = cube["size"]
    uv = cube.get("uv", [0, 0])
    if isinstance(uv, dict):
        res = {}
        for f in ("east", "west", "up", "down", "south", "north"):
            if f in uv:
                u, v = uv[f]["uv"]; su, sv = uv[f].get("uv_size", [0, 0])
                res[f] = [u / tw, v / th, (u + su) / tw, (v + sv) / th]
            else:
                res[f] = None
        return res
    u, v = uv
    # box UV (Blockbench's convention): east at u, north at u+d, west at u+d+w, south at u+2d+w; up/down above
    res = {
        "east": [u, v + d, u + d, v + d + h], "north": [u + d, v + d, u + d + w, v + d + h],
        "west": [u + d + w, v + d, u + 2 * d + w, v + d + h], "south": [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
        "up": [u + d + w, v + d, u + d, v], "down": [u + d + 2 * w, v, u + d + w, v + d],
    }
    if mirror:
        res["east"], res["west"] = res["west"], res["east"]
        for f in res:
            a = res[f]; res[f] = [a[2], a[1], a[0], a[3]]
    return {f: [a[0] / tw, a[1] / th, a[2] / tw, a[3] / th] for f, a in res.items()}


def condense(g):
    bones = []
    for b in g["bones"]:
        cubes = []
        for c in b.get("cubes", []):
            mirror = c.get("mirror", b.get("mirror", False))
            cubes.append(dict(o=c["origin"], s=c["size"], inf=c.get("inflate", 0), r=c.get("rotation"), p=c.get("pivot"),
                              f=faces(c, g["tw"], g["th"], mirror)))
        bones.append(dict(name=b["name"], parent=b.get("parent"), pivot=b.get("pivot", [0, 0, 0]),
                          rot=b.get("rotation") or [0, 0, 0], bind=b.get("bind_pose_rotation"), cubes=cubes, hide=bool(b.get("neverRender"))))
    return bones


def main():
    z = zipfile.ZipFile(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    out = {}
    for name, (file, ident, tex, extra, scale) in MOBS.items():
        geos = geometries(GEO / f"{file}.json")
        layers = []
        for gid, t in [(ident, tex)] + extra:
            im = Image.open(io.BytesIO(z.read(f"assets/minecraft/textures/entity/{t}.png"))).convert("RGBA")
            im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
            fn = f"mob_{t.split('/')[-1]}.webp"
            im.save(OUT / fn, quality=92, alpha_quality=100, method=6)
            g = dict(geos[gid])
            g["th"] = g["tw"] * im.height / im.width   # UVs are in the model's pixel units; the skin may be taller (64 x 64 husk)
            layers.append(dict(bones=condense(g), texture=fn))
        out[name] = dict(layers=layers, scale=scale)
        print(f"{name}: {sum(len(l['bones']) for l in layers)} bones")
    (OUT / "mobs.json").write_text(json.dumps(out, separators=(",", ":")))


if __name__ == "__main__":
    main()
