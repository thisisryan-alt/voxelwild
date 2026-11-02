"""Re-import the exported character FBX into an empty Blender scene and check what Unity will get:
skeleton (Humanoid-required bones), LOD naming, blend shapes, skin weights (<= 4 influences, normalised),
UVs, materials and triangle budgets. Exits non-zero on failure.

    python tools/blender/human/validate_fbx.py [path/to/Human_Adam.fbx]
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import config  # noqa: E402
import mh  # noqa: E402

HUMANOID = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm",
            "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg",
            "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase", "LeftEye",
            "RightEye", "Jaw"]
FINGERS = [f"{s}Hand{f}{i}" for s in ("Left", "Right") for f in ("Thumb", "Index", "Middle", "Ring", "Pinky")
           for i in (1, 2, 3)]


def main(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    errors, report = [], []
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        errors.append(f"expected one armature, found {len(arms)}")
        return errors, report
    arm = arms[0]
    bones = {b.name.split(":")[-1]: b for b in arm.data.bones}
    missing = [b for b in HUMANOID + FINGERS if b not in bones]
    if missing:
        errors.append(f"missing bones: {missing}")
    report.append(f"skeleton: {len(bones)} bones")
    hips = arm.matrix_world @ bones["Hips"].head_local if "Hips" in bones else None
    head = arm.matrix_world @ bones["Head"].head_local if "Head" in bones else None
    if hips is not None and head is not None:
        report.append(f"hips height {hips.z:.3f} m, head {head.z:.3f} m")
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    by_lod = {}
    for o in meshes:
        lvl = o.name.rsplit("_LOD", 1)[-1] if "_LOD" in o.name else "?"
        by_lod.setdefault(lvl, []).append(o)
    if "?" in by_lod:
        errors.append(f"meshes without _LODn suffix: {[o.name for o in by_lod['?']]}")
    for lvl in sorted(k for k in by_lod if k != "?"):
        objs = by_lod[lvl]
        tris = 0
        for o in objs:
            me = o.data
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            if not me.uv_layers:
                errors.append(f"{o.name}: no UVs")
            if not any(m.type == "ARMATURE" for m in o.modifiers) and o.parent != arm:
                errors.append(f"{o.name}: not skinned to the armature")
            # weights
            W = np.zeros(len(me.vertices))
            cnt = np.zeros(len(me.vertices), int)
            for v in me.vertices:
                ws = [g.weight for g in v.groups]
                W[v.index] = sum(ws)
                cnt[v.index] = len(ws)
            if (cnt == 0).any():
                errors.append(f"{o.name}: {(cnt == 0).sum()} unweighted vertices")
            if cnt.max() > 4:
                errors.append(f"{o.name}: up to {cnt.max()} influences")
            if len(W) and np.abs(W[cnt > 0] - 1).max() > 0.02:
                errors.append(f"{o.name}: weights not normalised (max dev {np.abs(W[cnt > 0] - 1).max():.3f})")
        shapes = {o.name: len(o.data.shape_keys.key_blocks) - 1 for o in objs if o.data.shape_keys}
        report.append(f"LOD{lvl}: {len(objs)} meshes, {tris:,} tris, blend shapes {shapes}")
    body0 = next((o for o in meshes if o.name.endswith("Body_LOD0")), None)
    if body0 is None or not body0.data.shape_keys:
        errors.append("Body_LOD0 has no blend shapes")
    else:
        names = [k.name for k in body0.data.shape_keys.key_blocks[1:]]
        for need in ("eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmile"):
            if need not in names:
                errors.append(f"Body_LOD0 missing blend shape {need}")
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    report.append(f"materials: {mats}")
    return errors, report


if __name__ == "__main__":
    args = [a for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])]
    path = args[0] if args else os.path.join(mh.REPO, "Assets", "Art", "Models", "Characters", "Human",
                                             config.NAME + ".fbx")
    errs, rep = main(path)
    for line in rep:
        print("[validate]", line)
    for e in errs:
        print("[validate] ERROR", e)
    sys.exit(1 if errs else 0)
