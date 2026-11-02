"""Builds the Human_Adam character in Blender from CC0 MakeHuman data plus procedural detail.

Run headless, either way:
    blender --background --python tools/blender/human/build_human.py -- [--stage body|full]
    python tools/blender/human/build_human.py [--stage ...]        (with the `bpy` wheel installed)

Writes SourceArt/Characters/Human/Human_Adam.blend.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import bl  # noqa: E402
import config  # noqa: E402
import mh  # noqa: E402

OUT_DIR = os.path.join(mh.REPO, "SourceArt", "Characters", "Human")


class Human:
    """Morphed MakeHuman state shared by all build steps (MakeHuman space + Blender space)."""

    def __init__(self):
        t = time.time()
        self.base = mh.load_base()
        self.groups = mh.load_vertex_groups()
        self.mh_verts = mh.morph(self.base.verts, config.MACRO, config.DETAILS)
        bv = mh.to_blender(self.mh_verts)
        body = self.base.group_verts("body")
        self.ground = bv[body, 2].min()
        self.bl_verts = self.to_bl(self.mh_verts)
        self.body_faces = self.base.group_faces("body")
        self.n_body = int(body.max()) + 1          # body verts are 0..n_body-1, contiguous
        h = self.bl_verts[: self.n_body, 2].max()
        self.height = float(h)
        print(f"[human] morphed in {time.time() - t:.1f}s, height {h:.3f} m")

    def to_bl(self, mh_co):
        v = mh.to_blender(mh_co)
        v[..., 2] -= self.ground
        return v

    def joint(self, name):
        return self.bl_verts[self.groups[name]].mean(axis=0)


def build_body(hu: Human) -> bpy.types.Object:
    faces = [hu.base.faces[i] for i in hu.body_faces]
    fuv = [hu.base.face_uvs[i] for i in hu.body_faces]
    ob = bl.mesh_object(config.NAME + "_Body", hu.bl_verts[: hu.n_body], faces, fuv, hu.base.uvs,
                        uv_name="UVMap_MH", col=config.NAME)
    return ob


TEX_DIR = os.path.join(mh.REPO, "Assets", "Art", "Textures", "Characters", "Human")
FBX_PATH = os.path.join(mh.REPO, "Assets", "Art", "Models", "Characters", "Human", config.NAME + ".fbx")


def make_game_uv(ob, hu: Human) -> None:
    """UV0: two 0..1 tiles. Material 0 (head, 4K): head island scaled to fill the tile height, plus the
    mouth interior and nostrils beside it. Material 1 (body, 4K): torso, limbs, hands and feet."""
    fuv = [hu.base.face_uvs[i] for i in hu.body_faces]
    fvs = [hu.base.faces[i] for i in hu.body_faces]
    uvs = hu.base.uvs
    parent = np.arange(len(uvs))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for f in fuv:
        r = find(f[0])
        for t in f[1:]:
            q = find(t)
            if q != r:
                parent[q] = r
    isl = np.array([find(f[0]) for f in fuv])
    ids, counts = np.unique(isl, return_counts=True)
    info = {}
    for k, c in zip(ids, counts):
        sel = np.nonzero(isl == k)[0]
        vs = np.unique(np.concatenate([fvs[i] for i in sel]))
        ts = np.unique(np.concatenate([fuv[i] for i in sel]))
        info[k] = dict(count=c, y=hu.base.verts[vs, 1].mean(), lo=uvs[ts].min(0), hi=uvs[ts].max(0))
    head = sorted([k for k in ids if info[k]["y"] > 6.0], key=lambda k: -info[k]["count"])
    body = [k for k in ids if k not in head]
    xf = {}
    main = info[head[0]]
    k_main = 0.96 / (main["hi"][1] - main["lo"][1])
    xf[head[0]] = (main["lo"], k_main, np.array([0.02, 0.02]))
    small = head[1:]
    mouth = max(small, key=lambda k: info[k]["count"]) if small else None
    nostrils = sorted([k for k in small if k != mouth], key=lambda k: info[k]["lo"][0])
    if mouth is not None:
        xf[mouth] = (info[mouth]["lo"], 2.3, np.array([0.56, 0.62]))
    for k, u0 in zip(nostrils, (0.56, 0.77)):
        xf[k] = (info[k]["lo"], 2.3, np.array([u0, 0.30]))
    blo = np.min([info[k]["lo"] for k in body], axis=0)
    bhi = np.max([info[k]["hi"] for k in body], axis=0)
    bscale = 0.98 / (bhi - blo)
    loop_uv = []
    mats = []
    for f, k in zip(fuv, isl):
        if k in xf:
            lo, sc, off = xf[k]
            loop_uv.extend(((uvs[t] - lo) * sc + off) for t in f)
            mats.append(0)
        else:
            loop_uv.extend(((uvs[t] - blo) * bscale + 0.01) for t in f)
            mats.append(1)
    me = ob.data
    uv = me.uv_layers.new(name="UV0")
    uv.data.foreach_set("uv", np.asarray(loop_uv, np.float32).ravel())
    me.uv_layers.active = uv
    uv.active_render = True
    me.polygons.foreach_set("material_index", np.asarray(mats, np.int32))
    print(f"[uv] head islands {len(head)}, body islands {len(body)}")


def build_eyes(hu: Human, body) -> dict:
    import eyes
    import materials as mats
    out = {}
    specs = []
    # MakeHuman's lids are modelled around its high-poly eye proxy: fit a sphere to the fitted proxy
    px = mh.load_proxy("eyes_highpoly")
    pco = hu.to_bl(px.fit(hu.mh_verts))
    for side, tname in (("L", "joint-l-eye-target"), ("R", "joint-r-eye-target")):
        e = pco[pco[:, 0] > 0] if side == "L" else pco[pco[:, 0] < 0]
        A = np.c_[2 * e, np.ones(len(e))]
        x = np.linalg.lstsq(A, (e ** 2).sum(1), rcond=None)[0]
        c = x[:3]
        radius = float(np.sqrt(x[3] + c @ c)) * 0.985
        fwd = hu.joint(tname) - c
        fwd[0] *= 0.0            # primary gaze: straight ahead, keep the modelled slight downward pitch
        specs.append((side, c, fwd / np.linalg.norm(fwd), radius))
    co = bl.get_coords(body)
    faces = [tuple(pl.vertices) for pl in body.data.polygons]
    img = lambda n, cs="sRGB": bl.load_image(os.path.join(TEX_DIR, n), cs)
    m_scl = mats.sclera(img("T_Human_Sclera_BaseColor.png"))
    m_iris = mats.iris(img("T_Human_Iris_BaseColor.png"), img("T_Human_Iris_Normal.png", "Non-Color"))
    m_cor, m_wet = mats.cornea(), mats.wet()
    m_occ = mats.eye_occlusion()
    for (side, c, fwd, radius) in specs:
        near = np.linalg.norm(co - c, axis=1) < radius * 1.6
        dd = np.linalg.norm(co[near] - c, axis=1) - radius
        print(f"[eyes] {side}: R={radius*1000:.2f} mm, socket verts {near.sum()}, inside ball {(dd < 0).sum()}")
        margin, medges, mt = eyes.lid_contour(co, faces, c, radius, fwd, offset=0.35 * eyes.MM)
        loc = (margin - c) @ eyes.eye_frame(c, fwd)
        print(f"[eyes] {side}: lid contour {len(margin)} pts, opening {np.ptp(loc[:, 0]) * 1000:.1f} x "
              f"{np.ptp(loc[:, 1]) * 1000:.1f} mm")
        e = eyes.build_eye(config.NAME, c, fwd, radius, side, config.NAME, scale=hu.height / 1.75)
        e["eye"].data.materials.append(m_scl)
        e["eye"].data.materials.append(m_iris)
        e["cornea"].data.materials.append(m_cor)
        wet = eyes.build_wet_line(config.NAME, side, margin, c, radius, fwd, config.NAME)
        wet.data.materials.append(m_wet)
        occ = eyes.build_occlusion(config.NAME, side, margin, c, radius, e["frame"], config.NAME)
        occ.data.materials.append(m_occ)
        out[side] = dict(e, wet=wet, occlusion=occ, center=c, forward=fwd, margin=margin, margin_edges=medges,
                         margin_t=mt)
    return out


def build_mouth(hu: Human) -> dict:
    import materials as mats
    out = {}
    for folder, mat_fn, tex_key in (("teeth_base", mats.teeth, "diffuseTexture"), ("tongue01", mats.tongue, "diffuseTexture")):
        px = mh.load_proxy(folder)
        co = hu.to_bl(px.fit(hu.mh_verts))
        ob = bl.mesh_object(f"{config.NAME}_{folder.split('_')[0].rstrip('01').capitalize()}", co, px.obj.faces,
                            px.obj.face_uvs, px.obj.uvs, uv_name="UV0", col=config.NAME)
        mhmat = mh.load_mhmat(os.path.join(mh.DATA, "proxies", folder, px.material))
        tex = os.path.join(mh.DATA, "proxies", folder, os.path.basename(mhmat.get(tex_key, "")))
        if os.path.exists(tex):
            ob.data.materials.append(mat_fn(bl.load_image(tex)))
        out[folder] = (ob, px)
    return out


def scalp_coverage(P_mm, O_mm):
    """Hair coverage 0..1 for points (mm, Blender space): the same hairline as the skin texture."""
    from skin_textures import scalp_cover
    d = P_mm - O_mm
    L = np.stack([d[:, 0], d[:, 2], -d[:, 1]], 1)
    return scalp_cover(L, P_mm, config.SKIN["seed"])


def vertex_mask(ob, name):
    """Per-vertex value of an MPFB region mask, sampled through the MakeHuman UVs (0..1)."""
    import noise as nz
    from scipy.ndimage import map_coordinates
    me = ob.data
    uv = np.zeros(len(me.loops) * 2, np.float32)
    me.uv_layers["UVMap_MH"].data.foreach_get("uv", uv)
    vi = np.zeros(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", vi)
    acc = np.zeros((len(me.vertices), 2))
    np.add.at(acc, vi, uv.reshape(-1, 2))
    cnt = np.bincount(vi, minlength=len(me.vertices))[:, None]
    uvv = acc / np.maximum(cnt, 1)
    m = nz.load_png(os.path.join(mh.DATA, "masks", f"mpfb_{name}.jpg"))
    m = m if m.ndim == 2 else m[..., 0]
    h, w = m.shape
    v = map_coordinates(m, [(1 - uvv[:, 1]) * (h - 1), uvv[:, 0] * (w - 1)], order=1, mode="nearest")
    return np.clip((v - 0.2) / 0.4, 0, 1)


def build_hair(hu: Human, body, eyes_) -> dict:
    import materials as mats
    import strands
    me = body.data
    me.calc_loop_triangles()
    tris = np.array([tuple(t.vertices) for t in me.loop_triangles])
    co = bl.get_coords(body)
    surf = strands.Surface(co, tris)
    O = (eyes_["L"]["center"] + eyes_["R"]["center"]) * 0.5
    hc = config.HAIR
    out = {"surface": surf}
    lash_mat = mats.strand_ribbon("M_Human_Eyelashes", (0.012, 0.009, 0.007), roughness=0.35)
    brow_mat = mats.strand_ribbon("M_Human_Eyebrows", tuple(np.array(hc["color"]) * 0.8), roughness=0.4)
    for side in ("L", "R"):
        e = eyes_[side]
        ob, bind = strands.eyelashes(surf, e["margin"], e["center"], e["frame"], side, config.NAME, config.NAME)
        ob.data.materials.append(lash_mat)
        out[f"lashes_{side}"] = (ob, bind)
        ob, bind = strands.eyebrows(surf, O * 1000.0 / 1000.0, side, config.NAME, config.NAME)
        ob.data.materials.append(brow_mat)
        out[f"brows_{side}"] = (ob, bind)
    atlas = os.path.join(TEX_DIR, "T_Human_HairCards.png")
    if not os.path.exists(atlas):
        strands.hair_atlas(atlas)
    cov = scalp_coverage(co * 1000.0, O * 1000.0) * (1.0 - vertex_mask(body, "ears"))
    ob, bind = strands.hair_cards(surf, co, cov, O, config.NAME, config.NAME, hc)
    ob.data.materials.append(mats.hair_card("M_Human_Hair", bl.load_image(atlas, "Non-Color"), hc["color"]))
    out["hair"] = (ob, bind)
    print(f"[hair] cards: {len(ob.data.polygons)} quads")
    return out


def clay_material():
    mat = bl.material("Clay")
    nt = mat.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.62, 0.45, 0.36, 1)
    p.inputs["Roughness"].default_value = 0.45
    p.inputs["Subsurface Weight"].default_value = 1.0
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
    p.inputs["Subsurface Scale"].default_value = 0.006
    return mat


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="full")
    ap.add_argument("--preview", default="")
    ap.add_argument("--regen", action="store_true")
    ap.add_argument("--size", type=int, default=4096)
    ap.add_argument("--eyeshots", action="store_true")
    ap.add_argument("--nohair", action="store_true")
    ap.add_argument("--hdri", default="studio_small_09")
    ap.add_argument("--hdri-rot", dest="hdri_rot", type=float, default=0.0)
    ap.add_argument("--key", type=float, default=22.0)
    ap.add_argument("--exposure", type=float, default=-0.3)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--norender", action="store_true")
    ap.add_argument("--save-blend", dest="save_blend", action="store_true")
    ap.add_argument("--shots", default="front,34")
    ap.add_argument("--tiles", default="", help="regenerate only these skin tiles, e.g. Body")
    args = ap.parse_args(argv)

    bl.reset_scene()
    hu = Human()
    body = build_body(hu)
    if args.stage == "body":
        import lookdev
        body.data.materials.append(clay_material())
        mod = body.modifiers.new("sub", "SUBSURF")
        mod.levels = mod.render_levels = 1
        lookdev.setup_render(900, 900, samples=48)
        lookdev.world_color((0.18, 0.18, 0.2), 1.0)
        head = hu.joint("joint-head") * 0.5 + hu.joint("joint-l-eye") * 0.25 + hu.joint("joint-r-eye") * 0.25
        lookdev.studio_portrait(head, 60)
        out = args.preview or os.path.join(OUT_DIR, "_preview")
        lookdev.camera("Cam", (0.0, -0.75, head[2] + 0.02), (0, head[1], head[2] - 0.01), focal=85)
        lookdev.render(os.path.join(out, "clay_face.png"))
        lookdev.camera("Cam", (0.55, -0.55, head[2] + 0.02), (0, head[1], head[2] - 0.01), focal=85)
        lookdev.render(os.path.join(out, "clay_face34.png"))
        bpy.context.scene.render.resolution_x = 600
        lookdev.camera("Cam", (0.0, -5.5, 1.0), (0, 0, 0.92), focal=50)
        lookdev.area_light("KeyBody", (-2.5, -3.5, 2.5), (0, 0, 1.0), 900, size=2.5)
        lookdev.render(os.path.join(out, "clay_body.png"))
        return
    import materials as mats
    import rig_export as rx
    make_game_uv(body, hu)
    body.data.materials.append(bl.material("M_Human_Head"))
    body.data.materials.append(bl.material("M_Human_Body"))
    if config.OUTFIT:
        # flag body faces fully hidden under the clothes; the flag survives subdivision and the faces are
        # removed at export (no poke-through, no hidden overdraw)
        import outfit
        cov = np.zeros(hu.n_body, bool)
        cv = outfit.covered_body_verts()
        cov[cv[cv < hu.n_body]] = True
        faces_cov = np.array([all(cov[v] for v in pl.vertices) for pl in body.data.polygons], np.int32)
        attr = body.data.attributes.new("covered", "INT", "FACE")
        attr.data.foreach_set("value", faces_cov)
    rigged = args.stage == "full"
    weights = mh.load_weights("mixamo_unity")
    deltas = rx.expression_deltas(hu) if rigged else {}
    body_lod1 = None
    if rigged:
        rx.assign_body_weights(body, hu, weights)
        rx.add_body_shapes(body, hu, deltas)
        body_lod1 = body.copy()
        body_lod1.data = body.data.copy()
        bl.collection(config.NAME).objects.link(body_lod1)
    t = time.time()
    bl.subdivide_with_shapes(body, 1)
    print(f"[body] LOD0 subdivided ({len(body.data.vertices)} verts) in {time.time() - t:.0f}s")
    eyes_ = build_eyes(hu, body)
    mouth = build_mouth(hu)
    if args.stage in ("skin", "full"):
        import skin_textures
        if args.regen or not os.path.exists(os.path.join(TEX_DIR, "T_Human_Head_BaseColor.png")):
            skin_textures.generate(body, hu, [eyes_["L"]["center"], eyes_["R"]["center"]], config.SKIN, TEX_DIR,
                                   size=args.size, only=args.tiles.split(",") if args.tiles else None)
            skin_textures.detail_normal(os.path.join(TEX_DIR, "T_Human_SkinDetail_Normal.png"))
        detail = bl.load_image(os.path.join(TEX_DIR, "T_Human_SkinDetail_Normal.png"), "Non-Color")
        for i, nm in enumerate(("Head", "Body")):
            tex = dict(albedo=bl.load_image(os.path.join(TEX_DIR, f"T_Human_{nm}_BaseColor.png")),
                       normal=bl.load_image(os.path.join(TEX_DIR, f"T_Human_{nm}_Normal.png"), "Non-Color"),
                       mask=bl.load_image(os.path.join(TEX_DIR, f"T_Human_{nm}_Mask.png"), "Non-Color"),
                       detail_tiling=30.0 if nm == "Head" else 130.0)   # ~10 mm detail tile on both
            body.material_slots[i].material = mats.skin(f"M_Human_{nm}", tex, detail, sss_scale=0.0035)
    else:
        for slot in body.material_slots:
            slot.material = clay_material()
    hair = None
    if args.stage in ("skin", "full") and not args.nohair:
        hair = build_hair(hu, body, eyes_)
    clothes = build_outfit(hu, weights, args) if (config.OUTFIT and args.stage in ("skin", "full")) else None

    if rigged:
        export_character(hu, body, body_lod1, eyes_, mouth, hair, weights, deltas, args, clothes)

    if args.stage in ("eyes", "skin", "full") and not args.norender:
        render_lookdev(hu, body, eyes_, args)


def build_outfit(hu, weights, args):
    """Fitted clothes: base-resolution meshes (LOD1/2) and Catmull-Clark copies (LOD0), with weights."""
    import outfit
    import rig_export as rx
    if args.regen or not os.path.exists(os.path.join(TEX_DIR, "T_Human_Outfit_BaseColor.png")):
        outfit.generate_textures(TEX_DIR)
    base = outfit.build(hu, config.NAME, config.NAME, rx.weight_matrix(weights, len(hu.mh_verts)))
    shirt, jeans, shoes = outfit.materials(TEX_DIR)
    base["Outfit"][0].data.materials.append(shirt)
    base["Outfit"][0].data.materials.append(jeans)
    base["Shoes"][0].data.materials.append(shoes)
    out = {}
    for key, (ob, _px) in base.items():
        hi = ob.copy()
        hi.data = ob.data.copy()
        bl.collection(config.NAME).objects.link(hi)
        bl.subdivide_with_shapes(hi, 1)
        ob.hide_render = True
        out[key] = (hi, ob)
    print(f"[outfit] shirt+jeans {len(out['Outfit'][0].data.polygons)} quads, shoes {len(out['Shoes'][0].data.polygons)} quads")
    return out


def delete_covered_faces(ob):
    """Removes faces flagged 'covered' (hidden under clothing), keeping shape keys, weights and UVs."""
    import bmesh
    if "covered" not in ob.data.attributes:
        return 0
    flags = np.zeros(len(ob.data.polygons), np.int32)
    ob.data.attributes["covered"].data.foreach_get("value", flags)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    dead = [bm.faces[i] for i in np.nonzero(flags)[0]]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(dead)


def export_character(hu, body, body_lod1, eyes_, mouth, hair, weights, deltas, args, clothes=None):
    """Skeleton, weights and blend shapes for every part, LOD chain, FBX + textures into Assets/."""
    import rig_export as rx
    import eyes as eyemod
    names = set(deltas)
    n_all = len(hu.mh_verts)
    bones_all, W_all = rx.weight_matrix(weights, n_all)
    # MakeHuman weights have up to ~10 influences and aren't normalised: clamp to 4 and renormalise
    for ob in (body, body_lod1):
        rx.set_weights(ob, *rx.object_weights(ob))
    bones_b, W_b = rx.object_weights(body)
    co0 = bl.get_coords(body)
    t = time.time()
    # teeth and tongue: re-fit the proxies on every expression (jaw open moves the lower teeth)
    for folder, (ob, px) in mouth.items():
        Wp = (W_all[px.refs] * px.weights[..., None]).sum(axis=1)
        rx.set_weights(ob, bones_all, Wp)
        base = bl.get_coords(ob)
        for name, d in deltas.items():
            co = hu.to_bl(px.fit(hu.mh_verts + d))
            if np.abs(co - base).max() > 5e-5:
                bl.add_shape_key(ob, name, co)
    # eyes: rigid on the eye bones; tear lines and occlusion shells follow the lid margin
    for side in ("L", "R"):
        e = eyes_[side]
        bone = "mixamorig:LeftEye" if side == "L" else "mixamorig:RightEye"
        rx.rigid_weight(e["eye"], bone)
        rx.rigid_weight(e["cornea"], bone)
        a, b, tt = e["margin_edges"][:, 0], e["margin_edges"][:, 1], e["margin_t"]
        Wm = W_b[a] * (1 - tt[:, None]) + W_b[b] * tt[:, None]
        rx.set_weights(e["wet"], bones_b, np.tile(Wm, (3, 1)))
        rx.set_weights(e["occlusion"], bones_b, np.tile(Wm, (5, 1)))
        c, fwd, R, F = e["center"], e["forward"], e["radius"], e["frame"]
        margin_of = lambda co, a=a, b=b, tt=tt: co[a] * (1 - tt[:, None]) + co[b] * tt[:, None]
        rx.shapes_from_body(e["wet"], lambda co: eyemod.wet_line_verts(margin_of(co), c, R, fwd), body, names)
        rx.shapes_from_body(e["occlusion"], lambda co: eyemod.occlusion_verts(margin_of(co), c, R, F), body, names)
    # lashes, brows: weights of the body triangle each strand is bound to; same blend shapes as the skin
    tris = hair["surface"].tris if hair else None
    strand_parts = []
    if hair:
        for key in ("lashes_L", "lashes_R", "brows_L", "brows_R"):
            ob, bind = hair[key]
            Wv = W_b[tris[bind.tri]].mean(axis=1)
            rx.set_weights(ob, bones_b, Wv)
            rx.shapes_from_body(ob, bind.evaluate, body, names)
            strand_parts.append(ob)
        rx.rigid_weight(hair["hair"][0], "mixamorig:Head")
    print(f"[rig] weights + blend shapes for all parts in {time.time() - t:.0f}s")

    if clothes:
        # subdivision blends neighbouring weights (up to ~6 bones): clamp the LOD0 garments to 4 again
        for key in ("Outfit", "Shoes"):
            rx.set_weights(clothes[key][0], *rx.object_weights(clothes[key][0]))
        n0 = delete_covered_faces(body)
        n1 = delete_covered_faces(body_lod1)
        print(f"[outfit] removed hidden body faces: LOD0 {n0}, LOD1 {n1}")
    arm = rx.build_armature(hu, config.NAME, config.NAME)
    N = config.NAME
    lod0 = {"Body": body, "Teeth": mouth["teeth_base"][0], "Tongue": mouth["tongue01"][0]}
    for side in ("L", "R"):
        e = eyes_[side]
        lod0.update({f"Eye_{side}": e["eye"], f"Cornea_{side}": e["cornea"], f"EyeWet_{side}": e["wet"],
                     f"EyeOcclusion_{side}": e["occlusion"]})
    if clothes:
        lod0.update({"Outfit": clothes["Outfit"][0], "Shoes": clothes["Shoes"][0]})
    if hair:
        lod0.update({"Hair": hair["hair"][0], "Eyelashes_L": hair["lashes_L"][0], "Eyelashes_R": hair["lashes_R"][0],
                     "Eyebrows_L": hair["brows_L"][0], "Eyebrows_R": hair["brows_R"][0]})
    export = []
    for part, ob in lod0.items():
        ob.name = f"{N}_{part}_LOD0"
        rx.parent_to_armature(ob, arm)
        export.append(ob)
    # LOD1: base-resolution body (still has every blend shape), everything else shared with LOD0
    body_lod1.name = f"{N}_Body_LOD1"
    rx.parent_to_armature(body_lod1, arm)
    export.append(body_lod1)
    for part, ob in lod0.items():
        if part == "Body":
            continue
        if clothes and part in clothes:
            lo = clothes[part][1]                     # base-resolution garment
            lo.name = f"{N}_{part}_LOD1"
            lo.hide_render = True
            rx.parent_to_armature(lo, arm)
            export.append(lo)
            continue
        export.append(rx.linked_copy(ob, f"{N}_{part}_LOD1"))
    # LOD2: decimated body without blend shapes, eyes and hair only
    lod2 = rx.decimated_copy(body_lod1, f"{N}_Body_LOD2", 0.42)
    rx.set_weights(lod2, *rx.object_weights(lod2))      # collapses mix weights: clamp again
    rx.parent_to_armature(lod2, arm)
    export.append(lod2)
    for part in ("Eye_L", "Eye_R"):
        e2 = rx.decimated_copy(lod0[part], f"{N}_{part}_LOD2", 0.25)
        rx.set_weights(e2, *rx.object_weights(e2))
        rx.parent_to_armature(e2, arm)
        export.append(e2)
    if "Hair" in lod0:
        export.append(rx.linked_copy(lod0["Hair"], f"{N}_Hair_LOD2"))
    if clothes:
        for part in ("Outfit", "Shoes"):
            c2 = rx.decimated_copy(clothes[part][1], f"{N}_{part}_LOD2", 0.5)
            rx.set_weights(c2, *rx.object_weights(c2))
            rx.parent_to_armature(c2, arm)
            export.append(c2)
    for ob in export:
        if not ob.name.endswith("_LOD0"):
            ob.hide_render = True
    tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
    for lvl in range(3):
        objs = [o for o in export if o.name.endswith(f"_LOD{lvl}")]
        print(f"[lod] LOD{lvl}: {len(objs)} meshes, {sum(tri(o) for o in objs):,} triangles")
    rx.export_fbx(FBX_PATH, arm, export)
    copy_engine_textures()
    if args.save_blend:
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, f"{N}.blend"), compress=True)


def copy_engine_textures():
    import shutil
    for folder, src, dst in (("teeth_base", "teeth.png", "T_Human_Teeth_BaseColor.png"),
                             ("tongue01", "tongue01_diffuse.png", "T_Human_Tongue_BaseColor.png")):
        shutil.copyfile(os.path.join(mh.DATA, "proxies", folder, src), os.path.join(TEX_DIR, dst))


def render_lookdev(hu, body, eyes_, args):
    import lookdev
    lookdev.setup_render(1000, 1000, samples=args.samples)
    out = args.preview or os.path.join(OUT_DIR, "_preview")
    c = eyes_["L"]["center"]
    head = hu.joint("joint-head") * 0.5 + eyes_["L"]["center"] * 0.25 + eyes_["R"]["center"] * 0.25
    lookdev.portrait_hdri(head, args.hdri, strength=0.6, rotation=args.hdri_rot, key=args.key)
    bpy.context.scene.view_settings.exposure = args.exposure
    shots = args.shots.split(",")
    if "eye" in shots:
        bpy.context.scene.render.resolution_y = 700
        lookdev.camera("Cam", (c[0] + 0.03, c[1] - 0.16, c[2] + 0.01), (c[0], c[1], c[2]), focal=100)
        lookdev.render(os.path.join(out, "eye_close.png"))
        bpy.context.scene.render.resolution_y = 1000
    if "front" in shots:
        lookdev.camera("Cam", (0.0, -0.80, head[2] + 0.02), (0, head[1], head[2] - 0.02), focal=85)
        lookdev.render(os.path.join(out, "face_front.png"))
    if "34" in shots:
        lookdev.camera("Cam", (0.50, -0.62, head[2] + 0.03), (0, head[1], head[2] - 0.02), focal=85)
        lookdev.render(os.path.join(out, "face_34.png"))
    if "profile" in shots:
        lookdev.camera("Cam", (0.80, -0.08, head[2] + 0.02), (0, head[1], head[2] - 0.02), focal=85)
        lookdev.render(os.path.join(out, "face_profile.png"))
    if "smile" in shots and body.data.shape_keys:
        kb = body.data.shape_keys.key_blocks
        for ob in bpy.data.objects:
            if ob.type == "MESH" and ob.data.shape_keys:
                for k in ob.data.shape_keys.key_blocks:
                    if k.name in ("mouthSmile", "eyeSquintLeft", "eyeSquintRight"):
                        k.value = 0.8 if k.name == "mouthSmile" else 0.35
        _ = kb
        lookdev.camera("Cam", (0.25, -0.75, head[2] + 0.02), (0, head[1], head[2] - 0.02), focal=85)
        lookdev.render(os.path.join(out, "face_smile.png"))
        for ob in bpy.data.objects:
            if ob.type == "MESH" and ob.data.shape_keys:
                for k in ob.data.shape_keys.key_blocks:
                    k.value = 0.0 if k.name != "Basis" else k.value
    if "macro" in shots:
        # cheek / nose / eye close-up: pores, stubble, lashes, tear line
        tgt = (c[0] - 0.012, c[1] - 0.006, c[2] - 0.028)
        lookdev.camera("Cam", (c[0] + 0.07, c[1] - 0.22, c[2] - 0.005), tgt, focal=100, fstop=8.0)
        lookdev.render(os.path.join(out, "face_macro.png"))
    if "body" in shots:
        bpy.context.scene.render.resolution_x = 700
        lookdev.camera("Cam", (1.2, -4.6, 1.05), (0, 0, 0.92), focal=55)
        lookdev.render(os.path.join(out, "body.png"))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    main(argv)
