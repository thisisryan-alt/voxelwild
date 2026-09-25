"""Renders a labelled contact sheet of every prop's LOD0 for review (Cycles, CPU).

    python tools/blender/preview_props.py [--out Screenshots/props_preview.png] [--only Rock]

Each FBX is re-imported and shaded with an approximation of the in-engine material: the same scanned
texture set the slot's block layer uses (box-projected for triplanar slots, UVTile for uv slots), the baked
normal and AO maps, moss from the baked mask, and vertex colour for plants. This is a quick look for
shape and scale; the in-engine turntable (Voxelwild > Art > Capture Prop Turntables) is the quality gate.
"""

import argparse
import json
import math
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import build_props  # noqa: E402
from vw import common as C  # noqa: E402

LAYER_SOURCES = {
    "Stone": "ambientCG/Rock058/Rock058_1K-JPG",
    "Sandstone": "ambientCG/Rock053/Rock053_1K-JPG",
    "OakLog": "ambientCG/Bark014/Bark014_1K-JPG",
    "SpruceLog": "ambientCG/Bark012/Bark012_1K-JPG",
    "BirchLog": "ambientCG/Bark001/Bark001_1K-JPG",
    "LogTop": "generated/LogTop/LogTop",
}
MOSS = "ambientCG/Moss002/Moss002_1K-JPG"
TEX_ROOT = os.path.join(build_props.PROJECT, "SourceArt", "Textures")


def _img(path, non_color=False):
    for ext in (".jpg", ".png"):
        p = os.path.join(TEX_ROOT, path + ext)
        if os.path.exists(p) and os.path.getsize(p) > 1024:   # skip unfetched LFS pointers
            img = bpy.data.images.load(p, check_existing=True)
            if non_color:
                img.colorspace_settings.name = "Non-Color"
            return img
    return None


def _material(slot, textures, root):
    m = bpy.data.materials.new("Preview_" + slot["name"])
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8 * slot["roughness"]
    tint = slot["tint"]

    base = None
    if slot["mapping"] == "vertex":
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        base = attr.outputs["Color"]
    elif slot["layer"]:
        img = _img(LAYER_SOURCES.get(slot["layer"], "") + "_Color")
        if img is not None:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            mapping = nt.nodes.new("ShaderNodeMapping")
            s = slot["tiling"]
            mapping.inputs["Scale"].default_value = (s, s, s)
            if slot["mapping"] == "triplanar":
                tc = nt.nodes.new("ShaderNodeTexCoord")
                nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
                tex.projection = "BOX"
                tex.projection_blend = 0.25
            else:
                uv = nt.nodes.new("ShaderNodeUVMap")
                uv.uv_map = "UVTile"
                nt.links.new(uv.outputs["UV"], mapping.inputs["Vector"])
            nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
            base = tex.outputs["Color"]
    col = nt.nodes.new("ShaderNodeMix")
    col.data_type = "RGBA"
    col.blend_type = "MULTIPLY"
    col.inputs["Factor"].default_value = 1.0
    col.inputs["B"].default_value = (*tint, 1.0)
    if base is not None:
        nt.links.new(base, col.inputs["A"])
    else:
        col.inputs["A"].default_value = (0.5, 0.48, 0.45, 1.0)
    out = col.outputs["Result"]

    if textures.get("mask"):
        mask = nt.nodes.new("ShaderNodeTexImage")
        mask.image = bpy.data.images.load(os.path.join(root, textures["mask"]), check_existing=True)
        mask.image.colorspace_settings.name = "Non-Color"
        uvb = nt.nodes.new("ShaderNodeUVMap")
        uvb.uv_map = "UVBake"
        nt.links.new(uvb.outputs["UV"], mask.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(mask.outputs["Color"], sep.inputs["Color"])
        moss_img = _img(MOSS + "_Color")
        if moss_img is not None and slot["moss"] > 0:
            mt = nt.nodes.new("ShaderNodeTexImage")
            mt.image = moss_img
            mt.projection = "BOX"
            tc = nt.nodes.new("ShaderNodeTexCoord")
            nt.links.new(tc.outputs["Object"], mt.inputs["Vector"])
            f = nt.nodes.new("ShaderNodeMath")
            f.operation = "MULTIPLY"
            f.use_clamp = True
            f.inputs[1].default_value = slot["moss"] * 2.5
            nt.links.new(sep.outputs["Blue"], f.inputs[0])
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            nt.links.new(f.outputs["Value"], mix.inputs["Factor"])
            nt.links.new(out, mix.inputs["A"])
            nt.links.new(mt.outputs["Color"], mix.inputs["B"])
            out = mix.outputs["Result"]
        ao = nt.nodes.new("ShaderNodeMix")
        ao.data_type = "RGBA"
        ao.blend_type = "MULTIPLY"
        ao.inputs["Factor"].default_value = 1.0
        nt.links.new(out, ao.inputs["A"])
        nt.links.new(sep.outputs["Red"], ao.inputs["B"])
        out = ao.outputs["Result"]
    nt.links.new(out, bsdf.inputs["Base Color"])

    if textures.get("normal"):
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = bpy.data.images.load(os.path.join(root, textures["normal"]), check_existing=True)
        nimg.image.colorspace_settings.name = "Non-Color"
        uvb = nt.nodes.new("ShaderNodeUVMap")
        uvb.uv_map = "UVBake"
        nt.links.new(uvb.outputs["UV"], nimg.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.uv_map = "UVBake"
        nt.links.new(nimg.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if any(s for s in [slot.get("foliage")]):
        m.use_backface_culling = False
    return m


def render_asset(root, a, size, tile_dir):
    C.reset_scene()
    scene = bpy.context.scene
    scene.cycles.samples = 24
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.66, 0.8, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9

    bpy.ops.import_scene.fbx(filepath=os.path.join(root, a["fbx"]), axis_forward="-Z", axis_up="Y")
    objs = {o.name: o for o in scene.objects if o.type == "MESH"}
    for n, o in objs.items():
        if n != a["lods"][0]["mesh"]:
            o.hide_render = True
    obj = objs[a["lods"][0]["mesh"]]
    mats = [_material(s, a.get("textures") or {}, root) for s in a["slots"]]
    for i, slot in enumerate(obj.material_slots):
        slot.material = mats[min(i, len(mats) - 1)]

    # ground (or ceiling) block for scale: 1 m cells
    e = a["extents"]
    bpy.ops.mesh.primitive_plane_add(size=max(3.0, e["radius"] * 2.6))
    ground = bpy.context.object
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.19, 0.17, 1)
    ground.data.materials.append(gm)
    if a["hang"]:
        ground.rotation_euler = (math.pi, 0, 0)

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.5
    sun.angle = math.radians(3)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(50), 0, math.radians(35 if not a["hang"] else 180))
    scene.collection.objects.link(so)

    h = e["top"] - e["bottom"]
    centre = Vector((0, 0, (e["top"] + e["bottom"]) / 2))
    extent = max(h, e["radius"] * 2) * 0.75 + 0.1
    cam = bpy.data.cameras.new("Cam")
    cam.lens = 50
    co = bpy.data.objects.new("Cam", cam)
    scene.collection.objects.link(co)
    elev = math.radians(-18 if a["hang"] else 22)
    dist = extent / math.tan(math.radians(18)) * 1.05
    co.location = centre + Vector((math.cos(elev) * dist * 0.8, -math.cos(elev) * dist * 0.6, math.sin(elev) * dist))
    direction = centre - co.location
    co.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = co

    out = os.path.join(tile_dir, f"{a['name']}.png")
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=build_props.PROJECT)
    ap.add_argument("--out", default=os.path.join(build_props.PROJECT, "Screenshots", "props_preview.png"))
    ap.add_argument("--only", default="")
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--columns", type=int, default=6)
    args = ap.parse_args(argv)
    with open(os.path.join(args.root, build_props.MANIFEST), encoding="utf-8") as f:
        assets = [a for a in json.load(f)["assets"] if a["kind"].startswith(args.only)]
    tile_dir = tempfile.mkdtemp(prefix="vwpreview")
    tiles = [(a, render_asset(args.root, a, args.size, tile_dir)) for a in assets]
    cols = args.columns
    rows = (len(tiles) + cols - 1) // cols
    label = 18
    sheet = Image.new("RGB", (cols * args.size, rows * (args.size + label)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for i, (a, path) in enumerate(tiles):
        x, y = (i % cols) * args.size, (i // cols) * (args.size + label)
        sheet.paste(Image.open(path).convert("RGB"), (x, y))
        tris = "/".join(str(l["triangles"]) for l in a["lods"])
        draw.text((x + 4, y + args.size + 3), f"{a['name']}  {tris}", fill=(230, 230, 230))
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    sheet.save(args.out)
    print(f"[preview] {len(tiles)} props -> {args.out}")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
