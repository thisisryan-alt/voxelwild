"""Cycles bakes onto the game mesh's UVBake layout.

Outputs per asset, written as 8-bit PNGs with no colour management (the data is linear):
  <Name>_Normal.png   tangent-space normal, OpenGL (+Y), from the high-poly source (only when there is one)
  <Name>_Mask.png     R ambient occlusion, G curvature (0.5 = flat, >0.5 convex edges), B moss mask, A 1

With a high-poly source every map is baked selected-to-active from it; otherwise AO, curvature and the moss
mask are baked from the game mesh itself and the normal map is omitted (the material uses a flat normal).
"""

import bpy
import numpy as np

from . import common as C
from .png import write_png

SAMPLES_AO = 64


def _image(name, size):
    img = bpy.data.images.new(name, size, size, alpha=True, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    return img


def _target_nodes(obj, img):
    """Every material of the bake target gets an active image node pointing at img (Cycles bakes into it)."""
    for mat in obj.data.materials:
        mat.use_nodes = True
        nt = mat.node_tree
        node = nt.nodes.get("BakeTarget") or nt.nodes.new("ShaderNodeTexImage")
        node.name = "BakeTarget"
        node.image = img
        nt.nodes.active = node


def _emission_material(name, build):
    """A material whose emission is build(nt) -> socket; used to bake data (curvature, moss) via EMIT."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(build(nt), em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def _curvature(nt):
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.44
    mr.inputs["From Max"].default_value = 0.56
    nt.links.new(geo.outputs["Pointiness"], mr.inputs["Value"])
    return mr.outputs["Result"]


def _moss(nt):
    """Moss grows on up-facing, sheltered (non-convex) surfaces, broken up by noise."""
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep.inputs["Vector"])
    up = nt.nodes.new("ShaderNodeMapRange")
    up.inputs["From Min"].default_value = 0.15
    up.inputs["From Max"].default_value = 0.85
    nt.links.new(sep.outputs["Z"], up.inputs["Value"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.5
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(geo.outputs["Position"], noise.inputs["Vector"])
    nmr = nt.nodes.new("ShaderNodeMapRange")
    nmr.inputs["From Min"].default_value = 0.4
    nmr.inputs["From Max"].default_value = 0.62
    nt.links.new(noise.outputs["Fac"], nmr.inputs["Value"])
    convex = nt.nodes.new("ShaderNodeMapRange")
    convex.inputs["From Min"].default_value = 0.56
    convex.inputs["From Max"].default_value = 0.44   # inverted: convex edges get less moss
    nt.links.new(geo.outputs["Pointiness"], convex.inputs["Value"])
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    nt.links.new(up.outputs["Result"], m1.inputs[0])
    nt.links.new(nmr.outputs["Result"], m1.inputs[1])
    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    m2.use_clamp = True
    nt.links.new(m1.outputs["Value"], m2.inputs[0])
    nt.links.new(convex.outputs["Result"], m2.inputs[1])
    return m2.outputs["Value"]


def _with_materials(obj, mat):
    """Temporarily replaces every slot of obj with mat; returns a restore function."""
    saved = [s.material for s in obj.material_slots]
    if not saved:
        obj.data.materials.append(mat)
        return lambda: obj.data.materials.clear()
    for s in obj.material_slots:
        s.material = mat

    def restore():
        for s, m in zip(obj.material_slots, saved):
            s.material = m
    return restore


def _pixels(img):
    size = img.size[0]
    a = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    # Blender rows run bottom-up; image files top-down
    return np.flipud(a.reshape(size, size, 4))


def _bake(kind, source, target, img, extrusion, distance):
    scene = bpy.context.scene
    bake = scene.render.bake
    # no Cycles margin: its fill varies with thread timing. _coverage/_dilate below do it deterministically.
    bake.margin = 0
    bake.use_clear = True
    bake.target = "IMAGE_TEXTURES"
    _target_nodes(target, img)
    if source is not None:
        C.select_only(source, target, active=target)
        bake.use_selected_to_active = True
        bake.cage_extrusion = extrusion
        bake.max_ray_distance = distance
    else:
        C.select_only(target)
        bake.use_selected_to_active = False
    if kind == "NORMAL":
        bake.normal_space = "TANGENT"
        bake.normal_r, bake.normal_g, bake.normal_b = "POS_X", "POS_Y", "POS_Z"   # OpenGL
    scene.cycles.samples = SAMPLES_AO if kind == "AO" else 1
    bpy.ops.object.bake(type=kind)
    return _pixels(img)


def _coverage(obj, size):
    """Texels whose centre lies inside a UVBake triangle (top-down rows, like _pixels)."""
    mesh = obj.data
    uv = mesh.uv_layers["UVBake"].data
    cov = np.zeros((size, size), dtype=bool)
    centres = (np.arange(size) + 0.5) / size
    for poly in mesh.polygons:
        loops = list(poly.loop_indices)
        for k in range(1, len(loops) - 1):
            tri = np.array([uv[loops[0]].uv, uv[loops[k]].uv, uv[loops[k + 1]].uv], dtype=np.float64)
            lo = np.clip(np.floor(tri.min(axis=0) * size - 0.5).astype(int), 0, size - 1)
            hi = np.clip(np.ceil(tri.max(axis=0) * size + 0.5).astype(int), 0, size - 1)
            xs, ys = np.meshgrid(centres[lo[0]:hi[0] + 1], centres[lo[1]:hi[1] + 1])
            (x0, y0), (x1, y1), (x2, y2) = tri
            det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(det) < 1e-14:
                continue
            a = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / det
            b = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / det
            inside = (a >= 0) & (b >= 0) & (a + b <= 1)
            cov[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] |= inside
    return np.flipud(cov)


def _dilate(values, cov, iterations):
    """Grows covered texels outward by averaging covered neighbours, one ring per iteration."""
    v = values.copy()
    c = cov.copy()
    h, w = c.shape
    for _ in range(iterations):
        vp = np.pad(v, ((1, 1), (1, 1), (0, 0)))
        cp = np.pad(c, 1)
        acc = np.zeros_like(v)
        cnt = np.zeros((h, w), dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                sc = cp[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                acc += vp[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] * sc[..., None]
                cnt += sc
        grow = ~c & (cnt > 0)
        if not grow.any():
            break
        v[grow] = acc[grow] / cnt[grow][:, None]
        c |= grow
    return v, c


def bake_asset(asset, low, out_dir, extrusion=0.06, distance=0.25):
    """Bakes asset maps for the LOD0 mesh `low`. Returns {"normal": path or None, "mask": path}."""
    size = asset.bake_size
    src = asset.high
    scale = max(1.0, C.mesh_extents(low)["radius"])
    extrusion *= scale
    distance *= scale
    img = _image(asset.name + "_bake", size)

    normal = None
    if src is not None:
        normal = _bake("NORMAL", src, low, img, extrusion, distance)
    ao = _bake("AO", src, low, img, extrusion, distance)[..., 0]

    data_src = src if src is not None else low
    curv_mat = _emission_material("VW_Curvature", _curvature)
    restore = _with_materials(data_src, curv_mat)
    # the bake target keeps its own slots (with the image node) when baking from a separate source
    curv = _bake("EMIT", src, low, img, extrusion, distance)[..., 0] if src is not None else None
    restore()
    if src is None:
        # self-bake: the target itself must carry the emission and the image node
        restore = _with_materials(low, curv_mat)
        curv = _bake("EMIT", None, low, img, extrusion, distance)[..., 0]
        restore()

    moss_mat = _emission_material("VW_Moss", _moss)
    if src is not None:
        restore = _with_materials(src, moss_mat)
        moss = _bake("EMIT", src, low, img, extrusion, distance)[..., 0]
    else:
        restore = _with_materials(low, moss_mat)
        moss = _bake("EMIT", None, low, img, extrusion, distance)[..., 0]
    restore()

    # islands grow by a margin so bilinear filtering and the first mips never read outside them; texels
    # beyond that get neutral values (no black AO or tilted normals bleeding in at lower mips)
    cov = _coverage(low, size)
    margin = max(4, size // 32)
    data = np.stack([ao, curv, moss], axis=-1)
    if normal is not None:
        data = np.concatenate([data, normal[..., :3]], axis=-1)
    data, grown = _dilate(data, cov, margin)
    data[~grown] = [1.0, 0.5, 0.0, 0.5, 0.5, 1.0][:data.shape[-1]]
    ao, curv, moss = data[..., 0], data[..., 1], data[..., 2]
    if normal is not None:
        normal = data[..., 3:6]

    paths = {"normal": None, "mask": None}
    base = f"{out_dir}/{asset.name}"
    if normal is not None:
        n8 = (np.clip(normal, 0, 1) * 255 + 0.5).astype(np.uint8)
        write_png(base + "_Normal.png", n8)
        paths["normal"] = base + "_Normal.png"
    mask = np.stack([ao, curv, moss, np.ones_like(ao)], axis=-1)
    m8 = (np.clip(mask, 0, 1) * 255 + 0.5).astype(np.uint8)
    write_png(base + "_Mask.png", m8)
    paths["mask"] = base + "_Mask.png"
    bpy.data.images.remove(img)
    return paths
