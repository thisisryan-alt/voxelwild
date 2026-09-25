"""Exports the Blender-made props (Assets/Art/Models, see props_manifest.json) for the browser build.

Run headless:  blender -b -P web/tools/export_props.py
Writes web/assets/props.bin (one vertex buffer + one index buffer for every LOD of every asset),
web/assets/props.json (draw ranges, material slots, extents) and prop_normal.webp / prop_mask.webp
(the per-asset bakes stacked as texture-array strips).

Vertex (36 bytes): float32 x,y,z | int8x4 normal | int8x4 tangent (w = bitangent sign) | uint16x2 bake UV (unorm)
                   | float32x2 material UV (UV1: metres along wood, 0..1 end grain; x = biome-tint weight on foliage)
                   | uint8x4 vertex colour (sRGB, alpha = wind weight)
Axes: Blender Z-up -> Y-up (x, z, -y), the same right-handed frame as the game.
"""
import json
import os
import struct
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "Assets", "Art", "Models")
OUT = os.path.join(ROOT, "web", "assets")


def clamp8(v):
    return max(-127, min(127, int(round(v * 127))))


def export():
    manifest = json.load(open(os.path.join(MODELS, "props_manifest.json")))
    vbuf = bytearray()
    ibuf = []
    assets = []
    bake_names = []
    vcount = 0
    for asset in manifest["assets"]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT, asset["fbx"]))
        lods = []
        for lod in asset["lods"]:
            obj = bpy.data.objects.get(lod["mesh"])
            if obj is None:
                raise RuntimeError(f"{asset['name']}: mesh {lod['mesh']} missing in FBX")
            mesh = obj.data
            mw = obj.matrix_world
            nm = mw.to_3x3().inverted().transposed()
            uv0 = mesh.uv_layers[0] if len(mesh.uv_layers) > 0 else None
            uv1 = mesh.uv_layers[1] if len(mesh.uv_layers) > 1 else None
            if uv0 is not None:
                mesh.calc_tangents(uvmap=uv0.name)
            col = mesh.color_attributes.active_color if mesh.color_attributes else None
            slot_names = [s.material.name if s.material else "" for s in obj.material_slots]
            # map FBX material names onto the manifest's slots
            slot_index = []
            for name in slot_names:
                idx = 0
                for i, s in enumerate(asset["slots"]):
                    if s["name"].lower() in name.lower():
                        idx = i
                slot_index.append(idx)
            cnormals = mesh.corner_normals
            remap = {}
            per_slot = {}
            for tri in mesh.loop_triangles:
                slot = slot_index[tri.material_index] if slot_index else 0
                for li in tri.loops:
                    loop = mesh.loops[li]
                    p = mw @ mesh.vertices[loop.vertex_index].co
                    n = (nm @ cnormals[li].vector).normalized()
                    t = (mw.to_3x3() @ loop.tangent).normalized() if uv0 is not None else n.orthogonal().normalized()
                    sign = loop.bitangent_sign if uv0 is not None else 1.0
                    a = uv0.data[li].uv if uv0 is not None else (0, 0)
                    b = uv1.data[li].uv if uv1 is not None else (0, 0)
                    if col is not None:
                        c = col.data[li].color_srgb if col.domain == "CORNER" else col.data[loop.vertex_index].color_srgb
                    else:
                        c = (1, 1, 1, 1)
                    key = (round(p.x, 5), round(p.y, 5), round(p.z, 5), clamp8(n.x), clamp8(n.y), clamp8(n.z),
                           clamp8(t.x), clamp8(t.y), clamp8(t.z), sign > 0, round(a[0], 4), round(a[1], 4),
                           round(b[0], 4), round(b[1], 4), tuple(int(round(max(0, min(1, x)) * 255)) for x in c))
                    vi = remap.get(key)
                    if vi is None:
                        vi = vcount + len(remap)
                        remap[key] = vi
                        # Z-up -> Y-up
                        vbuf += struct.pack("<3f", p.x, p.z, -p.y)
                        vbuf += struct.pack("<4b", clamp8(n.x), clamp8(n.z), clamp8(-n.y), 0)
                        vbuf += struct.pack("<4b", clamp8(t.x), clamp8(t.z), clamp8(-t.y), 127 if sign > 0 else -127)
                        # bake UV: image rows run top-down in the texture array, so flip v
                        vbuf += struct.pack("<2H", int(round(max(0, min(1, a[0])) * 65535)), int(round(max(0, min(1, 1 - a[1])) * 65535)))
                        vbuf += struct.pack("<2f", b[0], b[1])
                        vbuf += struct.pack("<4B", *key[-1])
                    per_slot.setdefault(slot, []).append(vi)
            vcount += len(remap)
            subs = []
            for slot in sorted(per_slot):
                idx = per_slot[slot]
                subs.append({"slot": slot, "first": len(ibuf), "count": len(idx)})
                ibuf.extend(idx)
            lods.append({"submeshes": subs, "triangles": sum(s["count"] for s in subs) // 3})
        tex = asset.get("textures") or {}
        bake = -1
        if tex.get("normal") and tex.get("mask"):
            bake = len(bake_names)
            bake_names.append((tex["normal"], tex["mask"]))
        assets.append({
            "name": asset["name"], "kind": asset["kind"], "variant": asset["variant"], "extents": asset["extents"],
            "hang": asset.get("hang", False), "length": (asset.get("notes") or {}).get("length"),
            "slots": asset["slots"], "lods": lods, "bake": bake,
        })
        print(f"{asset['name']}: {[l['triangles'] for l in lods]} triangles, bake {bake}")

    vbytes = bytes(vbuf)
    ibytes = struct.pack(f"<{len(ibuf)}I", *ibuf)
    with open(os.path.join(OUT, "props.bin"), "wb") as f:
        f.write(vbytes)
        f.write(ibytes)
    json.dump({"vertexBytes": len(vbytes), "vertexCount": vcount, "indexCount": len(ibuf), "stride": 36,
               "assets": assets, "bakes": [os.path.basename(n).replace("_Normal.png", "") for n, _ in bake_names]},
              open(os.path.join(OUT, "props.json"), "w"), indent=1)
    json.dump([[n, m] for n, m in bake_names], open(os.path.join(OUT, "props_bakes.tmp.json"), "w"))
    print(f"props.bin: {vcount} vertices, {len(ibuf) // 3} triangles, {(len(vbytes) + len(ibytes)) / 1048576:.2f} MB")


export()
