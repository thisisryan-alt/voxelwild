"""Small bpy helpers shared by the human generator scripts."""
from __future__ import annotations

import bpy
import bmesh
import numpy as np


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.objects, bpy.data.curves):
        for item in list(c):
            c.remove(item)


def collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name: str, verts, faces, uv_faces=None, uvs=None, uv_name="UVMap", col: str | None = None,
                smooth: bool = True) -> bpy.types.Object:
    """Builds a mesh object from numpy verts (V,3) and a list of polygons (any arity)."""
    me = bpy.data.meshes.new(name)
    verts = np.asarray(verts, np.float64)
    loop_counts = np.array([len(f) for f in faces], np.int32)
    loop_starts = np.concatenate([[0], np.cumsum(loop_counts)[:-1]]).astype(np.int32)
    loop_verts = np.concatenate([np.asarray(f, np.int32) for f in faces]).astype(np.int32)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(len(loop_verts))
    me.loops.foreach_set("vertex_index", loop_verts)
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", loop_starts)
    me.polygons.foreach_set("loop_total", loop_counts)
    if uv_faces is not None and uvs is not None:
        uv = me.uv_layers.new(name=uv_name)
        loop_uv_idx = np.concatenate([np.asarray(f, np.int64) for f in uv_faces])
        uv.data.foreach_set("uv", np.asarray(uvs, np.float32)[loop_uv_idx].ravel())
    me.update(calc_edges=True)
    me.validate(clean_customdata=False)
    if smooth:
        me.polygons.foreach_set("use_smooth", np.ones(len(faces), bool))
    ob = bpy.data.objects.new(name, me)
    (collection(col) if col else bpy.context.scene.collection).objects.link(ob)
    return ob


def get_coords(ob: bpy.types.Object) -> np.ndarray:
    me = ob.data
    out = np.zeros(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", out)
    return out.reshape(-1, 3).astype(np.float64)


def set_coords(ob: bpy.types.Object, co: np.ndarray) -> None:
    ob.data.vertices.foreach_set("co", np.asarray(co, np.float32).ravel())
    ob.data.update()


def add_shape_key(ob: bpy.types.Object, name: str, co: np.ndarray) -> bpy.types.ShapeKey:
    if ob.data.shape_keys is None:
        ob.shape_key_add(name="Basis", from_mix=False)
    sk = ob.shape_key_add(name=name, from_mix=False)
    sk.data.foreach_set("co", np.asarray(co, np.float32).ravel())
    sk.value = 0.0          # Blender 5.x creates keys at 1.0; the FBX would carry that as the default weight
    return sk


def set_active(ob: bpy.types.Object) -> None:
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_modifiers(ob: bpy.types.Object) -> None:
    set_active(ob)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def subdivide_with_shapes(ob: bpy.types.Object, levels: int = 1) -> None:
    """Catmull-Clark subdivision that keeps shape keys (Blender can't apply modifiers on keyed meshes).

    Each key is evaluated through the same Subsurf modifier on a temporary copy; the topology of the
    result is identical for every key, so the subdivided coordinates can be written back as keys.
    """
    keys = ob.data.shape_keys
    names, key_cos = [], []
    if keys:
        basis = keys.key_blocks[0]
        for kb in keys.key_blocks:
            co = np.zeros(len(kb.data) * 3, np.float32)
            kb.data.foreach_get("co", co)
            names.append(kb.name)
            key_cos.append(co.reshape(-1, 3))
            _ = basis
        ob.shape_key_clear()
    deps = []
    for co in key_cos[1:]:
        tmp = ob.copy()
        tmp.data = ob.data.copy()
        bpy.context.scene.collection.objects.link(tmp)
        set_coords(tmp, co)
        mod = tmp.modifiers.new("sub", "SUBSURF")
        mod.levels = mod.render_levels = levels
        mod.uv_smooth = "PRESERVE_BOUNDARIES"
        mod.boundary_smooth = "ALL"
        deps.append(tmp)
    if key_cos:
        set_coords(ob, key_cos[0])
    mod = ob.modifiers.new("sub", "SUBSURF")
    mod.levels = mod.render_levels = levels
    mod.uv_smooth = "PRESERVE_BOUNDARIES"
    mod.boundary_smooth = "ALL"
    apply_modifiers(ob)
    if key_cos:
        dg = bpy.context.evaluated_depsgraph_get()
        evaluated = []
        for tmp in deps:
            ev = tmp.evaluated_get(dg)
            m = ev.to_mesh()
            co = np.zeros(len(m.vertices) * 3, np.float32)
            m.vertices.foreach_get("co", co)
            evaluated.append(co.reshape(-1, 3))
            ev.to_mesh_clear()
        ob.shape_key_add(name=names[0], from_mix=False)
        for name, co in zip(names[1:], evaluated):
            add_shape_key(ob, name, co)
        for tmp in deps:
            me = tmp.data
            bpy.data.objects.remove(tmp)
            bpy.data.meshes.remove(me)


def material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat


def load_image(path: str, colorspace: str = "sRGB", name: str | None = None) -> bpy.types.Image:
    img = bpy.data.images.load(path, check_existing=True)
    if name:
        img.name = name
    img.colorspace_settings.name = colorspace
    return img


def image_from_array(name: str, arr: np.ndarray, colorspace: str = "sRGB", float_buffer: bool = False) -> bpy.types.Image:
    """arr: (H, W, C) float 0..1, row 0 = top (PIL convention). Blender images are bottom-up."""
    h, w = arr.shape[:2]
    c = arr.shape[2] if arr.ndim == 3 else 1
    rgba = np.ones((h, w, 4), np.float32)
    if c == 1:
        rgba[..., :3] = arr.reshape(h, w, 1)
    else:
        rgba[..., :c] = arr[..., :c]
    img = bpy.data.images.get(name)
    if img is None or img.size[0] != w or img.size[1] != h:
        if img:
            bpy.data.images.remove(img)
        img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=float_buffer)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.pack()
    return img


def image_to_array(img: bpy.types.Image) -> np.ndarray:
    w, h = img.size
    px = np.zeros(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[::-1].copy()


def bm_from_object(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    return bm
