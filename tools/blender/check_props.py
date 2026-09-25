"""Validates the built props by importing every FBX back into Blender.

    blender --background --factory-startup --python tools/blender/check_props.py -- [--determinism]
    python tools/blender/check_props.py [--determinism]

Checks, per asset:
  - the FBX holds exactly the manifest's LOD meshes with the recorded triangle counts, decreasing per LOD
  - two UV sets (UVBake, UVTile) and the Col colour attribute survive the round trip (and aren't black)
  - extents after re-import match the manifest (so the axis conversion and scale are right)
  - rocks and cave formations are closed with outward normals
  - boulders enclose their core (every yaw of the 1 m block) on LOD0 and LOD1 (LOD2 is reported only)
  - floor props sit on the pivot, ceiling props hang from it
  - baked textures exist, are square powers of two and in range
With --determinism, one asset per family is rebuilt twice and the FBX and PNG bytes must match.
Exits non-zero on any failure.
"""

import argparse
import filecmp
import json
import math
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import build_props  # noqa: E402
from vw import common as C, rocks  # noqa: E402

CLOSED_CATEGORIES = {"Rocks", "Cave"}


class Report:
    def __init__(self):
        self.failures, self.warnings, self.checked = [], [], 0

    def fail(self, asset, msg):
        self.failures.append(f"{asset}: {msg}")

    def warn(self, asset, msg):
        self.warnings.append(f"{asset}: {msg}")


def import_fbx(path):
    C.reset_scene()
    bpy.ops.import_scene.fbx(filepath=path, axis_forward="-Z", axis_up="Y", use_custom_normals=True)
    return {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}


def core_points():
    """Rim of the core cylinder (every yaw of the 1 m core block) at its bottom, middle and top, plus the
    centres of its end caps."""
    pts = [Vector((0, 0, 0.001)), Vector((0, 0, 0.999))]
    r = rocks.CORE_RADIUS * 0.999
    for k in range(16):
        a = 2 * math.pi * k / 16
        for z in (0.001, 0.5, 0.999):
            pts.append(Vector((math.cos(a) * r, math.sin(a) * r, z)))
    return pts


def check_asset(root, a, rep):
    name = a["name"]
    path = os.path.join(root, a["fbx"])
    if not os.path.exists(path):
        rep.fail(name, f"missing {a['fbx']}")
        return
    objs = import_fbx(path)
    expected = [l["mesh"] for l in a["lods"]]
    if sorted(objs) != sorted(expected):
        rep.fail(name, f"meshes {sorted(objs)} != manifest {expected}")
        return
    tris = []
    for lod in a["lods"]:
        o = objs[lod["mesh"]]
        # bake the import transform in so measurements are in the mesh's own space
        o.data.transform(o.matrix_world)
        o.matrix_world.identity()
        t = C.triangle_count(o)
        tris.append(t)
        if t != lod["triangles"]:
            rep.fail(name, f"{lod['mesh']} has {t} triangles, manifest says {lod['triangles']}")
        uv = [u.name for u in o.data.uv_layers]
        if uv[:2] != ["UVBake", "UVTile"]:
            rep.fail(name, f"{lod['mesh']} UV sets {uv}")
        col = o.data.color_attributes.get("Col")
        if col is None:
            rep.fail(name, f"{lod['mesh']} lost its Col attribute")
        elif any(s["mapping"] == "vertex" for s in a["slots"]):
            mean = sum(sum(d.color[:3]) for d in col.data) / max(1, 3 * len(col.data))
            if mean < 0.03:
                rep.fail(name, f"{lod['mesh']} vertex colours are black (mean {mean:.3f})")
    if any(b >= a_ for a_, b in zip(tris, tris[1:])):
        rep.fail(name, f"LOD triangles not decreasing: {tris}")

    lod0 = objs[expected[0]]
    ext = C.mesh_extents(lod0)
    for k in ("radius", "top", "bottom"):
        if abs(ext[k] - a["extents"][k]) > 0.01:
            rep.fail(name, f"extent {k} {ext[k]} != manifest {a['extents'][k]} (axis or scale conversion?)")

    if a["hang"]:
        if not (0.0 < ext["top"] <= 0.2 and ext["bottom"] < -0.3):
            rep.fail(name, f"ceiling prop should hang from the pivot: top {ext['top']} bottom {ext['bottom']}")
    elif not (ext["bottom"] <= 0.0 < ext["top"]):
        rep.fail(name, f"floor prop should rest on the pivot: top {ext['top']} bottom {ext['bottom']}")

    if a["category"] in CLOSED_CATEGORIES:
        for lod in a["lods"]:
            o = objs[lod["mesh"]]
            bm = bmesh.new()
            bm.from_mesh(o.data)
            open_edges = sum(1 for e in bm.edges if len(e.link_faces) != 2)
            vol = bm.calc_volume(signed=True)
            bm.free()
            if open_edges:
                rep.fail(name, f"{lod['mesh']} is not closed ({open_edges} open edges)")
            if vol <= 0:
                rep.fail(name, f"{lod['mesh']} has inward normals (volume {vol:.4f})")

    if a["core"]:
        for i, lod in enumerate(a["lods"]):
            o = objs[lod["mesh"]]
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bvh = BVHTree.FromBMesh(bm)
            outside = [p for p in core_points() if not C.point_inside(bvh, p)]
            bm.free()
            if outside:
                msg = f"{lod['mesh']}: core pokes through at {len(outside)} of {len(core_points())} test points"
                (rep.fail if i < 2 else rep.warn)(name, msg)

    for key, tex in (a.get("textures") or {}).items():
        if tex is None:
            continue
        p = os.path.join(root, tex)
        if not os.path.exists(p):
            rep.fail(name, f"missing texture {tex}")
            continue
        im = bpy.data.images.load(p)
        im.colorspace_settings.name = "Non-Color"
        w, h = im.size
        if w != h or w & (w - 1):
            rep.fail(name, f"{tex} is {w}x{h}, expected a square power of two")
        if key == "normal":
            blue = sum(im.pixels[:][2::4]) / (w * h)
            if blue < 0.7:
                rep.fail(name, f"{tex} does not look like a tangent-space normal map (mean blue {blue:.2f})")
        bpy.data.images.remove(im)
    rep.checked += 1


def check_determinism(rep):
    """Builds one asset per family twice in scratch roots; outputs must be byte-identical."""
    picks = {}
    for kind, fn, count in build_props.FAMILIES:
        picks.setdefault(kind.split("_")[0], (kind, fn))
    for kind, fn in picks.values():
        roots = [tempfile.mkdtemp(prefix="vwdet"), tempfile.mkdtemp(prefix="vwdet")]
        entries = [build_props.build_one(kind, fn, 0, r) for r in roots]
        e = entries[0]
        files = [e["fbx"]] + [t for t in e["textures"].values() if t]
        for f in files:
            if not filecmp.cmp(os.path.join(roots[0], f), os.path.join(roots[1], f), shallow=False):
                rep.fail(e["name"], f"{f} differs between two identical builds")
        if entries[0] != entries[1]:
            rep.fail(e["name"], "manifest entries differ between two identical builds")


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=build_props.PROJECT)
    ap.add_argument("--determinism", action="store_true")
    args = ap.parse_args(argv)

    with open(os.path.join(args.root, build_props.MANIFEST), encoding="utf-8") as f:
        manifest = json.load(f)
    rep = Report()
    for a in manifest["assets"]:
        check_asset(args.root, a, rep)
    kinds = {}
    for a in manifest["assets"]:
        kinds.setdefault(a["kind"], []).append(a["variant"])
    for kind, fn, count in build_props.FAMILIES:
        if sorted(kinds.get(kind, [])) != list(range(count)):
            rep.fail(kind, f"manifest variants {sorted(kinds.get(kind, []))}, generator makes {count}")
    if args.determinism:
        check_determinism(rep)

    for w in rep.warnings:
        print("[check] warning:", w)
    for f in rep.failures:
        print("[check] FAIL:", f)
    print(f"[check] {rep.checked} assets checked, {len(rep.failures)} failures, {len(rep.warnings)} warnings")
    sys.exit(1 if rep.failures else 0)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
