"""Builds every procedural prop: generate -> game mesh -> bake -> LODs -> FBX + textures + manifest.

Run headless through Blender (tools/blender.ps1 does this):
    blender --background --factory-startup --python tools/blender/build_props.py -- [--only Rock_Boulder]
or with the standalone bpy module (pip install bpy, Python 3.11):
    python tools/blender/build_props.py [--only Rock]

Outputs (all regenerated, deterministic for a given Blender version):
    Assets/Art/Models/<Category>/<Name>.fbx
    Assets/Art/Models/<Category>/Textures/<Name>_Normal.png, <Name>_Mask.png
    Assets/Art/Models/props_manifest.json     read by PropLibraryBuilder and the EditMode tests
"""

import argparse
import json
import os
import sys
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from vw import bake, cave, common as C, export, plants, rocks, wood  # noqa: E402

FAMILIES = rocks.GENERATORS + cave.GENERATORS + wood.GENERATORS + plants.GENERATORS
PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = "Assets/Art/Models"
MANIFEST = MODELS + "/props_manifest.json"


def seed_for(kind, variant):
    return (zlib.crc32(kind.encode()) + variant * 7919) & 0x7FFFFFFF


def game_mesh(asset):
    """LOD0 for asset, UV'd and shaded; the high-poly source stays for baking."""
    if asset.lods:
        low = asset.lods[0]
    elif asset.low is not None:
        low = asset.low
        C.decimate(low, asset.lod_tris[0])
    else:
        low = C.duplicate(asset.high, asset.name + "_LOD0")
        C.decimate(low, asset.lod_tris[0])
    if asset.core:
        rocks.enforce_core(low)
    low.name = asset.name + "_LOD0"
    low.data.name = low.name
    C.ensure_uv_layers(low)
    C.ensure_color(low)
    if not low.data.materials:
        C.set_material_slots(low, [s.name for s in asset.slots])
    if asset.bake:
        C.smart_uv(low)
    # baked normal maps expect smooth base normals; cut ends and caps keep a hard edge
    C.shade_smooth(low, auto_angle=None if asset.high is not None else 60.0)
    return low


def lod_chain(asset, low):
    if asset.lods:
        chain = asset.lods
        for i, o in enumerate(chain):
            o.name = o.data.name = f"{asset.name}_LOD{i}"
            C.ensure_uv_layers(o)
            C.shade_smooth(o)
        return chain
    chain = [low]
    for i, tris in enumerate(asset.lod_tris[1:], start=1):
        lod = C.duplicate(low, f"{asset.name}_LOD{i}")
        C.decimate(lod, tris)
        if asset.core:
            rocks.enforce_core(lod)
        C.shade_smooth(lod, auto_angle=None if asset.high is not None else 60.0)
        chain.append(lod)
    return chain


def build_one(kind, fn, variant, root):
    C.reset_scene()
    asset = fn(seed_for(kind, variant), variant)
    low = game_mesh(asset)
    rel_dir = f"{MODELS}/{asset.category}"
    tex_dir = f"{rel_dir}/Textures"
    os.makedirs(os.path.join(root, tex_dir), exist_ok=True)

    textures = {"normal": None, "mask": None}
    if asset.bake:
        paths = bake.bake_asset(asset, low, os.path.join(root, tex_dir))
        textures = {k: (os.path.relpath(v, root).replace(os.sep, "/") if v else None) for k, v in paths.items()}

    chain = lod_chain(asset, low)
    if asset.high is not None:
        C.delete(asset.high)
    fbx = f"{rel_dir}/{asset.name}.fbx"
    export.export_fbx(chain, os.path.join(root, fbx))

    entry = {
        "name": asset.name,
        "kind": asset.kind,
        "variant": asset.variant,
        "category": asset.category,
        "fbx": fbx,
        "textures": textures,
        "lods": [{"mesh": o.name, "triangles": C.triangle_count(o)} for o in chain],
        "extents": C.mesh_extents(chain[0]),
        "hang": asset.hang,
        "core": asset.core,
        "slots": [s.to_json() for s in asset.slots],
        "notes": asset.notes,
    }
    return entry


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default="", help="build only assets whose kind starts with this prefix")
    ap.add_argument("--root", default=PROJECT, help="project root (default: this repository)")
    args = ap.parse_args(argv)

    manifest_path = os.path.join(args.root, MANIFEST)
    existing = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            existing = {a["name"]: a for a in json.load(f).get("assets", [])}

    t_all = time.time()
    built = {}
    for kind, fn, count in FAMILIES:
        if not kind.startswith(args.only):
            continue
        for v in range(count):
            t = time.time()
            entry = build_one(kind, fn, v, args.root)
            built[entry["name"]] = entry
            tris = "/".join(str(l["triangles"]) for l in entry["lods"])
            print(f"[props] {entry['name']:24s} tris {tris:16s} {time.time() - t:5.1f}s", flush=True)

    # a partial build (--only) keeps the other assets' records
    kinds_built = {e["kind"] for e in built.values()}
    merged = {n: a for n, a in existing.items() if a["kind"] not in kinds_built}
    merged.update(built)
    manifest = {
        "version": 1,
        "generator": "tools/blender/build_props.py",
        "blender": bpy.app.version_string,
        "assets": [merged[n] for n in sorted(merged)],
    }
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"[props] {len(built)} assets in {time.time() - t_all:.0f}s -> {MANIFEST}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    main(argv)
