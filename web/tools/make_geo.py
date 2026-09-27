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


def part(name, pivot, boxes, rot=(0, 0, 0), parent=None):
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
    if parent:
        bone["parent"] = parent
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
    # fox (Java FoxModel; the tail's parent turn folded into its own pose)
    geometry("geometry.fox.custom", 48, 32, [
        part("head", (-1, 16.5, -3), [(1, 5, -3, -2, -5, 8, 6, 6), (8, 1, -3, -4, -4, 2, 2, 1), (15, 1, 3, -4, -4, 2, 2, 1), (6, 18, -1, 2.01, -8, 4, 2, 3)]),
        part("body", (0, 16, -6), [(24, 15, -3, 3.999, -3.5, 6, 11, 6)], rot=(math.pi / 2, 0, 0)),
        part("leg0", (-5, 17.5, 7), [(13, 24, 2, 0.5, -1, 2, 6, 2)]),
        part("leg1", (-1, 17.5, 7), [(4, 24, 2, 0.5, -1, 2, 6, 2)]),
        part("leg2", (-5, 17.5, 0), [(13, 24, 2, 0.5, -1, 2, 6, 2)]),
        part("leg3", (-1, 17.5, 0), [(4, 24, 2, 0.5, -1, 2, 6, 2)]),
        part("foxtail", (-4, 17, 9), [(30, 0, 2, 0, -1, 4, 9, 5)], rot=(math.pi / 2 - 0.05236, 0, 0)),
    ]),
    # squid (Java SquidModel, lifted so the tentacles end at the feet)
    geometry("geometry.squid.custom", 64, 32, [
        part("body", (0, -2, 0), [(0, 0, -6, -8, -6, 12, 16, 12)]),
    ] + [part(f"tentacles_{i}", (round(math.cos(i * math.pi / 4) * 5, 3), 5, round(math.sin(i * math.pi / 4) * 5, 3)), [(48, 0, -1, 0, -1, 2, 18, 2)],
              rot=(0, i * -math.pi / 4 + math.pi / 2, 0)) for i in range(8)]),
    # panda (Java PandaModel)
    geometry("geometry.panda.custom", 64, 64, [
        part("head", (0, 11.5, -17), [(0, 6, -6.5, -5, -4, 13, 10, 9), (45, 16, -3.5, 0, -6, 7, 5, 2), (52, 25, -8.5, -8, -1, 5, 4, 1), (52, 25, 3.5, -8, -1, 5, 4, 1)]),
        part("body", (0, 10, 0), [(0, 25, -9.5, -13, -6.5, 19, 26, 13)], rot=(math.pi / 2, 0, 0)),
        part("leg0", (-5.5, 15, 9), [(40, 0, -3, 0, -3, 6, 9, 6)]),
        part("leg1", (5.5, 15, 9), [(40, 0, -3, 0, -3, 6, 9, 6)]),
        part("leg2", (-5.5, 15, -9), [(40, 0, -3, 0, -3, 6, 9, 6)]),
        part("leg3", (5.5, 15, -9), [(40, 0, -3, 0, -3, 6, 9, 6)]),
    ]),
    # rabbit (Java RabbitModel)
    geometry("geometry.rabbit.custom", 64, 32, [
        part("lhfoot", (3, 17.5, 3.7), [(26, 24, -1, 5.5, -3.7, 2, 1, 7)]),
        part("rhfoot", (-3, 17.5, 3.7), [(8, 24, -1, 5.5, -3.7, 2, 1, 7)]),
        part("lhaunch", (3, 17.5, 3.7), [(30, 15, -1, 0, 0, 2, 4, 5)], rot=(-0.349, 0, 0)),
        part("rhaunch", (-3, 17.5, 3.7), [(16, 15, -1, 0, 0, 2, 4, 5)], rot=(-0.349, 0, 0)),
        part("body", (0, 19, 8), [(0, 0, -3, -2, -10, 6, 5, 10)], rot=(-0.349, 0, 0)),
        part("lfleg", (3, 17, -1), [(8, 15, -1, 0, -1, 2, 7, 2)], rot=(-0.192, 0, 0)),
        part("rfleg", (-3, 17, -1), [(0, 15, -1, 0, -1, 2, 7, 2)], rot=(-0.192, 0, 0)),
        part("head", (0, 16, -1), [(32, 0, -2.5, -4, -5, 5, 4, 5), (32, 9, -0.5, -2.5, -5.5, 1, 1, 1)]),
        part("rear", (0, 16, -1), [(52, 0, -2.5, -9, -1, 2, 5, 1)], rot=(0, -0.2618, 0), parent="head"),
        part("lear", (0, 16, -1), [(58, 0, 0.5, -9, -1, 2, 5, 1)], rot=(0, 0.2618, 0), parent="head"),
        part("rtail", (0, 20, 7), [(52, 6, -1.5, -1.5, 0, 3, 3, 2)], rot=(-0.349, 0, 0)),
    ]),
    # phantom (Java PhantomModel, lowered to the feet; wing tips hang off the wings)
    geometry("geometry.phantom.custom", 64, 64, [
        part("body", (0, 20, 0), [(0, 8, -3, -2, -8, 5, 3, 9)], rot=(-0.1, 0, 0)),
        part("tailbase", (0, 18, 1), [(3, 20, -2, 0, 0, 3, 2, 6)], parent="body"),
        part("tailtip", (0, 18.5, 7), [(4, 29, -1, 0, 0, 1, 1, 6)], parent="tailbase"),
        part("wing0", (2, 18, -8), [(23, 12, 0, 0, 0, 6, 2, 9)], rot=(0, 0, 0.1), parent="body"),
        part("wing0tip", (8, 18, -8), [(16, 24, 0, 0, 0, 13, 1, 9)], rot=(0, 0, 0.1), parent="wing0"),
        part("wing1", (-3, 18, -8), [(23, 12, -6, 0, 0, 6, 2, 9, 0, True)], rot=(0, 0, -0.1), parent="body"),
        part("wing1tip", (-9, 18, -8), [(16, 24, -13, 0, 0, 13, 1, 9, 0, True)], rot=(0, 0, -0.1), parent="wing1"),
        part("head", (0, 21, -7), [(0, 0, -4, -2, -5, 7, 3, 5)], rot=(0.2, 0, 0), parent="body"),
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
