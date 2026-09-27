"""Mob models written from Minecraft Java's model definitions (ModelPart pivots, boxes and rotations), converted to
the Bedrock geometry format the game reads (tools/geo/custom.json):

    python web/tools/make_geo.py

Java model space has y pointing down from 24 px above the feet; Bedrock's has y up from the feet. A Java part at
pivot (px, py, pz) with a box (x, y, z, w, h, d) becomes a Bedrock bone pivot (px, 24 - py, pz) and a cube origin
(px + x, 24 - (py + y + h), pz + z). Rotations (radians, applied z-y-x) become degrees [x, -y, -z].
"""
import json
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent / "geo" / "custom.json"


def part(name, pivot, boxes, rot=(0, 0, 0)):
    px, py, pz = pivot
    cubes = []
    for b in boxes:
        u, v, x, y, z, w, h, d = b[:8]
        inflate = b[8] if len(b) > 8 else 0
        mirror = b[9] if len(b) > 9 else False
        c = {"origin": [px + x, 24 - (py + y + h), pz + z], "size": [w, h, d], "uv": [u, v]}
        if inflate:
            c["inflate"] = inflate
        if mirror:
            c["mirror"] = True
        cubes.append(c)
    bone = {"name": name, "pivot": [px, 24 - py, pz], "cubes": cubes}
    if any(rot):
        bone["rotation"] = [round(math.degrees(rot[0]), 3), round(-math.degrees(rot[1]), 3), round(-math.degrees(rot[2]), 3)]
    return bone


def geometry(ident, tw, th, bones):
    return {"description": {"identifier": ident, "texture_width": tw, "texture_height": th}, "bones": bones}


def humanoid_head():
    return [part("head", (0, 0, 0), [(0, 0, -4, -10, -4, 8, 10, 8), (32, 0, -4, -10, -4, 8, 10, 8, 0.51)]),
            part("nose", (0, -2, 0), [(24, 0, -1, -1, -6, 2, 4, 2)])]


GEOS = [
    # villager: robe, crossed arms
    geometry("geometry.villager.custom", 64, 64, humanoid_head() + [
        part("body", (0, 0, 0), [(16, 20, -4, 0, -3, 8, 12, 6), (0, 38, -4, 0, -3, 8, 20, 6, 0.5)]),
        part("arms", (0, 3, -1), [(44, 22, -8, -2, -2, 4, 8, 4), (44, 22, 4, -2, -2, 4, 8, 4, 0, True), (40, 38, -4, 2, -2, 8, 4, 4)], rot=(-0.75, 0, 0)),
        part("rightLeg", (-2, 12, 0), [(0, 22, -2, 0, -2, 4, 12, 4)]),
        part("leftLeg", (2, 12, 0), [(0, 22, -2, 0, -2, 4, 12, 4, 0, True)]),
    ]),
    # illagers (pillager, vindicator): the same head and body, arms free
    geometry("geometry.illager.custom", 64, 64, humanoid_head() + [
        part("body", (0, 0, 0), [(16, 20, -4, 0, -3, 8, 12, 6), (0, 38, -4, 0, -3, 8, 18, 6, 0.5)]),
        part("rightArm", (-5, 2, 0), [(40, 46, -3, -2, -2, 4, 12, 4)]),
        part("leftArm", (5, 2, 0), [(40, 46, -1, -2, -2, 4, 12, 4, 0, True)]),
        part("rightLeg", (-2, 12, 0), [(0, 22, -2, 0, -2, 4, 12, 4)]),
        part("leftLeg", (2, 12, 0), [(0, 22, -2, 0, -2, 4, 12, 4, 0, True)]),
    ]),
    # slime: a jelly cube round an inner cube with eyes and a mouth
    geometry("geometry.slime.custom", 64, 32, [
        part("inner", (0, 0, 0), [(0, 16, -3, 17, -3, 6, 6, 6), (32, 0, -3.25, 18, -3.5, 2, 2, 2), (32, 4, 1.25, 18, -3.5, 2, 2, 2), (32, 8, 0, 21, -3.5, 1, 1, 1)]),
        part("cube", (0, 0, 0), [(0, 0, -4, 16, -4, 8, 8, 8)]),
    ]),
    # polar bear
    geometry("geometry.polarbear.custom", 128, 64, [
        part("head", (0, 10, -16), [(0, 0, -3.5, -3, -3, 7, 7, 7), (0, 44, -2.5, 1, -6, 5, 3, 3), (26, 0, -4.5, -4, -1, 2, 2, 1), (26, 0, 2.5, -4, -1, 2, 2, 1, 0, True)]),
        part("body", (-2, 9, 12), [(0, 19, -5, -13, -7, 14, 14, 11), (39, 0, -4, -25, -7, 12, 12, 10)], rot=(math.pi / 2, 0, 0)),
        part("leg0", (-4.5, 14, 6), [(50, 22, -2, 0, -2, 4, 10, 8)]),
        part("leg1", (4.5, 14, 6), [(50, 22, -2, 0, -2, 4, 10, 8)]),
        part("leg2", (-3.5, 14, -8), [(50, 40, -2, 0, -2, 4, 10, 6)]),
        part("leg3", (3.5, 14, -8), [(50, 40, -2, 0, -2, 4, 10, 6)]),
    ]),
    # strider: a body on two long legs
    geometry("geometry.strider.custom", 64, 128, [
        part("body", (0, 1, 0), [(0, 0, -8, -6, -8, 16, 14, 16)]),
        part("rightLeg", (-4, 8, 0), [(0, 32, -2, 0, -2, 4, 16, 4)]),
        part("leftLeg", (4, 8, 0), [(0, 55, -2, 0, -2, 4, 16, 4)]),
    ]),
]

OUT.write_text(json.dumps({"format_version": "1.12.0", "minecraft:geometry": GEOS}, indent=1))
print(f"{len(GEOS)} geometries -> {OUT}")
