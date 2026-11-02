"""Skeleton, skin weights, facial blend shapes, LODs and the FBX export for Unity.

Skeleton: MPFB's CC0 "mixamo_unity" rig (Mixamo bone names, which Unity's Humanoid auto-mapper
recognises) fitted to the morphed body from MakeHuman's joint cubes; CC0 weights for the base mesh.
Blend shapes: MakeHuman's FACS-like expression units, renamed to ARKit-style names where they match.
Every part that must follow the face (teeth/tongue proxies, tear lines, occlusion shells, lashes, brows)
gets the same-named shape, so one weight drives all of them.
"""
from __future__ import annotations

import os

import bpy
import numpy as np

import bl
import mh

EXPRESSIONS = {
    "eye-left-closure": "eyeBlinkLeft", "eye-right-closure": "eyeBlinkRight",
    "eye-left-opened-up": "eyeWideLeft", "eye-right-opened-up": "eyeWideRight",
    "eye-left-slit": "eyeSquintLeft", "eye-right-slit": "eyeSquintRight",
    "eyebrows-left-down": "browDownLeft", "eyebrows-right-down": "browDownRight",
    "eyebrows-left-extern-up": "browOuterUpLeft", "eyebrows-right-extern-up": "browOuterUpRight",
    "eyebrows-left-inner-up": "browInnerUpLeft", "eyebrows-right-inner-up": "browInnerUpRight",
    "eyebrows-left-up": "browUpLeft", "eyebrows-right-up": "browUpRight",
    "mouth-open": "jawOpen", "mouth-corner-puller": "mouthSmile", "mouth-depression": "mouthFrown",
    "mouth-pursing": "mouthPucker", "mouth-protusion": "mouthFunnel", "mouth-compression": "mouthPress",
    "mouth-retraction": "mouthStretch", "mouth-upward-retraction": "mouthUpperUp",
    "mouth-depression-retraction": "mouthLowerDown", "mouth-elevation": "mouthShrugLower",
    "mouth-eversion": "mouthRollOut", "mouth-parling": "mouthParted", "mouth-part-later": "mouthDimple",
    "nose-left-elevation": "noseSneerLeft", "nose-right-elevation": "noseSneerRight",
    "nose-left-dilatation": "noseFlareLeft", "nose-right-dilatation": "noseFlareRight",
    "nose-compression": "noseCompress", "nose-depression": "noseDepress", "neck-platysma": "neckPlatysma",
}


def expression_deltas(hu) -> dict[str, np.ndarray]:
    """MakeHuman-space deltas for every base vertex (incl. helpers) per expression unit."""
    out = {}
    n = len(hu.mh_verts)
    for unit, name in EXPRESSIONS.items():
        path = os.path.join(mh.DATA, "targets", "expression_units", f"{unit}.target.gz")
        if os.path.exists(path):
            out[name] = mh.target_delta(n, os.path.join("expression_units", unit))
    return out


def delta_to_bl(d):
    return mh.to_blender(d)       # deltas: no ground offset


def add_body_shapes(body, hu, deltas):
    base = bl.get_coords(body)
    for name, d in deltas.items():
        bl.add_shape_key(body, name, base + delta_to_bl(d[: hu.n_body]))


def assign_body_weights(body, hu, weights):
    n = len(body.data.vertices)
    for bone, pairs in weights.items():
        if not pairs:
            continue
        idx = np.array([p[0] for p in pairs])
        w = np.array([p[1] for p in pairs])
        keep = idx < n
        if not keep.any():
            continue
        vg = body.vertex_groups.new(name=bone)
        for i, wi in zip(idx[keep], w[keep]):
            vg.add([int(i)], float(wi), "REPLACE")


def weight_matrix(weights, n_verts):
    bones = [b for b, p in weights.items() if p]
    W = np.zeros((n_verts, len(bones)), np.float32)
    for j, b in enumerate(bones):
        for i, w in weights[b]:
            if i < n_verts:
                W[i, j] = w
    return bones, W


def object_weights(ob):
    """(bones, W) from an object's vertex groups."""
    bones = [g.name for g in ob.vertex_groups]
    W = np.zeros((len(ob.data.vertices), len(bones)), np.float32)
    for v in ob.data.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    return bones, W


def set_weights(ob, bones, W, max_influences=4, min_weight=0.01):
    ob.vertex_groups.clear()
    W = np.asarray(W, np.float32).copy()
    # keep the strongest influences and renormalise (Unity: 4 bones per vertex)
    if W.shape[1] > max_influences:
        order = np.argsort(-W, axis=1)
        mask = np.zeros_like(W, bool)
        np.put_along_axis(mask, order[:, :max_influences], True, axis=1)
        W = np.where(mask, W, 0)
    W[W < min_weight] = 0
    s = W.sum(1, keepdims=True)
    W = np.where(s > 0, W / np.maximum(s, 1e-8), 0)
    groups = {}
    for j, b in enumerate(bones):
        idx = np.nonzero(W[:, j] > 0)[0]
        if len(idx) == 0:
            continue
        vg = groups.get(b) or ob.vertex_groups.new(name=b)
        groups[b] = vg
        for i in idx:
            vg.add([int(i)], float(W[i, j]), "REPLACE")


def rigid_weight(ob, bone):
    ob.vertex_groups.clear()
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")


def build_armature(hu, name, col):
    rig = mh.load_rig("mixamo_unity")
    arm = bpy.data.armatures.new(name + "_Skeleton")
    ob = bpy.data.objects.new(name, arm)
    bl.collection(col).objects.link(ob)
    bl.set_active(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones
    for bname, spec in rig.items():
        b = eb.new(bname)
        b.head = hu.to_bl(mh.joint_position(spec["head"], hu.mh_verts, hu.groups))
        b.tail = hu.to_bl(mh.joint_position(spec["tail"], hu.mh_verts, hu.groups))
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + type(b.head)((0, 0, 0.01))
        b.roll = spec.get("roll", 0.0)
    for bname, spec in rig.items():
        if spec.get("parent"):
            eb[bname].parent = eb[spec["parent"]]
            eb[bname].use_connect = bool(spec.get("use_connect", False))
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def parent_to_armature(ob, arm):
    ob.parent = arm
    mod = ob.modifiers.get("Armature") or ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    mod.use_deform_preserve_volume = False


def shapes_from_body(target_ob, eval_fn, body, names, eps=5e-5):
    """Adds shape keys to target_ob: for each body shape key, eval_fn(body_key_coords) -> target coords."""
    keys = body.data.shape_keys
    if keys is None:
        return 0
    base = bl.get_coords(target_ob)
    added = 0
    for kb in keys.key_blocks[1:]:
        if kb.name not in names:
            continue
        co = np.zeros(len(kb.data) * 3, np.float32)
        kb.data.foreach_get("co", co)
        tco = eval_fn(co.reshape(-1, 3).astype(np.float64))
        if np.abs(tco - base).max() > eps:
            bl.add_shape_key(target_ob, kb.name, tco)
            added += 1
    return added


def decimated_copy(ob, name, ratio, keep_shapes=False):
    me = ob.data.copy()
    cp = ob.copy()
    cp.data = me
    cp.name = name
    for c in ob.users_collection:
        c.objects.link(cp)
    if not keep_shapes and me.shape_keys:
        cp.shape_key_clear()
    if ratio < 1.0:
        mod = cp.modifiers.new("dec", "DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        for m in list(cp.modifiers):
            if m.type == "ARMATURE":
                cp.modifiers.remove(m)
        bl.set_active(cp)
        bpy.ops.object.modifier_apply(modifier="dec")
    return cp


def linked_copy(ob, name):
    cp = ob.copy()
    cp.name = name
    for c in ob.users_collection:
        c.objects.link(cp)
    return cp


def export_fbx(path, arm, objects):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    arm.select_set(True)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.fbx(
        filepath=path, use_selection=True, object_types={"ARMATURE", "MESH"},
        apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y",
        bake_space_transform=False, use_mesh_modifiers=False, mesh_smooth_type="FACE", use_tspace=True,
        use_triangles=False, add_leaf_bones=False, primary_bone_axis="Y", secondary_bone_axis="X",
        armature_nodetype="NULL", use_armature_deform_only=True, bake_anim=False, path_mode="STRIP",
        embed_textures=False, use_custom_props=False, colors_type="LINEAR")
    print(f"[export] {path}")
