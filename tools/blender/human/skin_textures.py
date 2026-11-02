"""Skin texture generation for the head and body tiles.

1. Bake per-texel surface data on the game UV (UV0) of the LOD0 mesh with Cycles: object-space position
   and normal, the MakeHuman UV (to read MPFB region masks), mesh AO and inner thickness.
2. Evaluate the skin in numpy at every texel's 3D position (mm), so detail is seamless across UV seams
   and lands in anatomically fixed places (head-local frame: x lateral, y up, z forward; origin between
   the eyes):
     chromophores (melanin, blood, oxygenation, epidermis thickness) -> spectral albedo (skin_model)
     pores, cross-hatched micro-relief, expression wrinkles, lip striations, knuckle creases -> height
     beard / scalp / eyebrow / body hair follicles and stubble strokes -> albedo + height
     regional roughness, cavity, translucency
3. Write engine textures: BaseColor (sRGB), Normal (OpenGL, tangent space), Mask (R AO, G roughness,
   B cavity, A translucency).
"""
from __future__ import annotations

import gc
import math
import os
import time

import bpy
import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates, gaussian_filter, zoom

import bl
import mh
import noise as nz
import noise3d as n3
import skin_model

MASKS = ("lips", "ears", "eyelids", "face", "fingernails", "toenails", "inside-mouth", "aureolae")


# ------------------------------------------------------------------------------------------- baking
def _bake(ob, size, socket_fn, kind="EMIT", margin=16, samples=1):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.render.bake.margin = margin
    sc.render.bake.margin_type = "EXTEND"
    sc.render.bake.target = "IMAGE_TEXTURES"
    sc.render.bake.use_clear = True
    originals, imgs, temps = [], [], []
    for i, slot in enumerate(ob.material_slots):
        originals.append(slot.material)
        mat = bpy.data.materials.new(f"__bake_{i}")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        if kind == "EMIT":
            em = nt.nodes.new("ShaderNodeEmission")
            nt.links.new(socket_fn(nt), em.inputs[0])
            nt.links.new(em.outputs[0], out.inputs[0])
        else:
            d = nt.nodes.new("ShaderNodeBsdfDiffuse")
            nt.links.new(d.outputs[0], out.inputs[0])
        img = bpy.data.images.new(f"__bake_{kind}_{i}", size, size, alpha=True, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        nt.nodes.active = tn
        slot.material = mat
        imgs.append(img)
        temps.append(mat)
    bl.set_active(ob)
    t = time.time()
    bpy.ops.object.bake(type=kind, uv_layer="UV0", margin=margin, use_clear=True)
    print(f"[skin] bake {kind} {size}px in {time.time() - t:.1f}s")
    arrs = [bl.image_to_array(im) for im in imgs]
    for slot, mat in zip(ob.material_slots, originals):
        slot.material = mat
    for im in imgs:
        bpy.data.images.remove(im)
    for m in temps:
        bpy.data.materials.remove(m)
    return arrs


def _coverage(ob, size):
    """Exact UV0 coverage per material tile, rasterised from the polygons (no bake needed)."""
    from PIL import Image, ImageDraw
    me = ob.data
    uv = np.zeros(len(me.loops) * 2, np.float32)
    me.uv_layers["UV0"].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    mats = np.zeros(len(me.polygons), np.int32)
    me.polygons.foreach_get("material_index", mats)
    ls = np.zeros(len(me.polygons), np.int32)
    lt = np.zeros(len(me.polygons), np.int32)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    out = []
    for m in range(len(ob.material_slots)):
        im = Image.new("L", (size, size), 0)
        dr = ImageDraw.Draw(im)
        for i in np.nonzero(mats == m)[0]:
            pts = uv[ls[i]:ls[i] + lt[i]]
            dr.polygon([(float(u * size), float((1 - v) * size)) for u, v in pts], fill=255)
        out.append(np.asarray(im) > 127)
    return out


def bake_surface(ob, size=4096, size_lo=2048):
    def pos(nt):
        return nt.nodes.new("ShaderNodeTexCoord").outputs["Object"]

    def nrm(nt):
        return nt.nodes.new("ShaderNodeTexCoord").outputs["Normal"]

    def mhuv(nt):
        # (u, v, 1): B doubles as the "has data" mask including the bake margin
        n = nt.nodes.new("ShaderNodeUVMap")
        n.uv_map = "UVMap_MH"
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        comb.inputs[2].default_value = 1.0
        nt.links.new(n.outputs[0], sep.inputs[0])
        nt.links.new(sep.outputs[0], comb.inputs[0])
        nt.links.new(sep.outputs[1], comb.inputs[1])
        return comb.outputs[0]

    def one(nt):
        n = nt.nodes.new("ShaderNodeRGB")
        n.outputs[0].default_value = (1, 1, 1, 1)
        return n.outputs[0]

    def thick(nt):
        n = nt.nodes.new("ShaderNodeAmbientOcclusion")
        n.inside = True
        n.samples = 16
        n.inputs["Distance"].default_value = 0.02
        return n.outputs["AO"]

    def ao(nt):
        n = nt.nodes.new("ShaderNodeAmbientOcclusion")
        n.samples = 16
        n.inputs["Distance"].default_value = 0.06
        return n.outputs["AO"]

    P = _bake(ob, size, pos)
    N = _bake(ob, size, nrm)
    U = _bake(ob, size, mhuv)
    V = _coverage(ob, size)
    A = _bake(ob, size_lo, ao, samples=24, margin=16)
    T = _bake(ob, size_lo, thick, samples=16, margin=16)
    tiles = []
    for i in range(len(P)):
        k = size / size_lo
        tiles.append(dict(
            pos=P[i][..., :3] * 1000.0, nrm=N[i][..., :3], mhuv=U[i][..., :2],
            valid=V[i], computed=U[i][..., 2] > 0.5,
            ao=np.clip(zoom(A[i][..., 0], k, order=1), 0, 1), inside=np.clip(zoom(T[i][..., 0], k, order=1), 0, 1)))
    return tiles


# ------------------------------------------------------------------------------------- landmarks
class Landmarks:
    """Head-local frame and body joint positions (mm)."""

    def __init__(self, hu, eye_centers):
        self.O = (np.asarray(eye_centers[0]) + np.asarray(eye_centers[1])) * 0.5 * 1000.0
        self.j = {k: hu.bl_verts[v].mean(axis=0) * 1000.0 for k, v in hu.groups.items() if k.startswith("joint-")}

    def local(self, P):
        d = P - self.O
        return np.stack([d[:, 0], d[:, 2], -d[:, 1]], 1)


def _masks():
    out = {}
    for m in MASKS:
        out[m] = nz.load_png(os.path.join(mh.DATA, "masks", f"mpfb_{m}.jpg"))
    return out


def _sample_mask(mask, uv):
    h, w = mask.shape[:2]
    m = mask if mask.ndim == 2 else mask[..., 0]
    return map_coordinates(m, [(1 - uv[:, 1]) * (h - 1), uv[:, 0] * (w - 1)], order=1, mode="nearest")


def ell(L, c, r):
    return np.exp(-(((L - np.asarray(c)) / np.asarray(r)) ** 2).sum(1))


def _interp_table(x, table):
    xs = np.array([a for a, _ in table], float)
    ys = np.array([b for _, b in table], float)
    return np.interp(x, xs, ys)


def _seg_dist(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1), t


def _tangent_dir(d, N):
    d = d - N * (d * N).sum(1, keepdims=True)
    n = np.linalg.norm(d, axis=1, keepdims=True)
    return d / np.maximum(n, 1e-6)


# ---------------------------------------------------------------------------------- hair regions
# Ear position measured from the MPFB ear mask on the morphed head (head-local mm): x 67..88,
# y -49..+9, z -99..-65 (the ear's front edge is ~65 mm behind the eye plane).
EAR_C = np.array([77.0, -20.0, -82.0])
EAR_R = np.array([15.0, 32.0, 20.0])


def scalp_cover(L, P, seed):
    """Hair coverage 0..1 (scalp + sideburns) for head-local points L (mm), P (mm, for noise). Shared by
    the skin texture's hair cap and the hair-card placement so both agree on the hairline."""
    ax = np.abs(L[:, 0])
    v = L - np.array([0.0, 30.0, -20.0])
    az = np.degrees(np.arctan2(np.abs(v[:, 0]), v[:, 2]))
    el = np.degrees(np.arctan2(v[:, 1], np.hypot(v[:, 0], v[:, 2])))
    el_t = _interp_table(az, [(0, 47), (20, 47), (38, 53), (52, 44), (66, 22), (80, 2), (95, -12),
                              (110, -18), (125, -30), (145, -42), (180, -48)])
    jitter = n3.fbm(P, 6.0, 3, seed + 1) * 3.0 + n3.fbm(P, 1.5, 2, seed + 2) * 1.5
    soft = np.where(az < 60, 6.5, 3.5)            # the front hairline thins out gradually
    cov = nz.smoothstep(el_t - soft, el_t + soft, el + jitter)
    # the ear itself is removed by the caller with the exact MPFB ear mask (texture: UV mask, cards:
    # per-vertex mask); only a thin geometric margin is kept here for points behind the ear root
    d = (np.c_[ax, L[:, 1], L[:, 2]] - EAR_C) / (EAR_R * np.array([1.0, 0.85, 0.85]))
    cov *= nz.smoothstep(0.75, 0.95, np.sqrt((d * d).sum(1)) + (ax < 70) * 0.25)
    # sideburns: a strip directly in front of the ear, fading downward
    sb = np.exp(-(((L[:, 2] + 58) / 6.0) ** 2 + ((L[:, 1] + 6) / 17.0) ** 2) ** 2) * nz.smoothstep(56, 62, ax)
    cov = np.maximum(cov, nz.smoothstep(0.3, 0.8, sb + jitter * 0.04) * 0.9)
    return cov * nz.smoothstep(-200, -150, L[:, 1])


# ------------------------------------------------------------------------------------ skin fields
def skin_fields(P, N, UV, lm: Landmarks, masks, cfg, seed=0):
    """All per-texel skin quantities for a point set. P mm (Blender object space), N unit normals."""
    t0 = time.time()
    n = len(P)
    L = lm.local(P)
    x, y, z = L[:, 0], L[:, 1], L[:, 2]
    ax = np.abs(x)
    Nl = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)       # normal in the head-local frame
    m = {k: _sample_mask(v, UV) for k, v in masks.items()}
    lips = nz.smoothstep(0.08, 0.9, m["lips"]) ** 1.3
    mouth_in = nz.smoothstep(0.2, 0.8, m["inside-mouth"])
    ears = nz.smoothstep(0.2, 0.8, m["ears"])
    lids = nz.smoothstep(0.1, 0.7, m["eyelids"])
    nails = nz.smoothstep(0.2, 0.7, np.maximum(m["fingernails"], m["toenails"]))
    areola = nz.smoothstep(0.2, 0.8, m["aureolae"])
    head = nz.smoothstep(-200, -150, y)                  # above the lower neck
    face = head * nz.smoothstep(-35, -10, z) * nz.smoothstep(-135, -110, y)

    # ---------------------------------------------------------------- hair-covered regions
    scalp = scalp_cover(L, P, seed) * (1 - ears) * head
    yline = -32.0 - (60.0 - np.clip(ax, 20, 60)) * 0.7
    bj = n3.fbm(P, 7.0, 3, seed + 3) * 4.0
    cheek = nz.smoothstep(yline + 2, yline - 7, y + bj) * nz.smoothstep(14, 26, ax + bj * 0.5) * nz.smoothstep(-50, -38, z)
    cheek *= nz.smoothstep(70, 62, ax)
    # moustache: rounded at the sides, fading into the cheek stubble at the mouth corners
    mous = nz.smoothstep(31, 17, ax + bj * 0.6) * nz.smoothstep(-51, -57, y + bj * 0.3) * nz.smoothstep(-71, -65, y)
    chin = nz.smoothstep(24, 18, ax) * nz.smoothstep(-82, -87, y + bj * 0.3) * nz.smoothstep(-20, -5, z)
    beard = np.clip(cheek + mous + chin, 0, 1)
    neck_fade = nz.smoothstep(-188, -165, y + bj) * nz.smoothstep(-55, -40, z)
    under = (y < -100) * nz.smoothstep(-60, -45, z)
    beard = np.clip(beard + under * 0.9, 0, 1) * neck_fade * (1 - lips) * (1 - mouth_in) * (1 - ears)
    patch = np.clip(0.75 + 0.5 * n3.fbm(P, 9.0, 3, seed + 4), 0, 1)
    upper_sparse = nz.smoothstep(yline, yline - 16, y)
    beard *= np.where(ax > 22, patch * (0.45 + 0.55 * upper_sparse), 1.0)
    beard *= np.where(y < -112, 0.8, 1.0)

    # eyebrows (skin under the brows: follicles and a little pigment)
    u = ax - 10.0
    s_b = np.clip(u / 42.0, 0, 1)
    brow_y = 16.0 + 5.5 * np.sin(np.clip(s_b, 0, 1) * math.pi * 0.85) - 4.0 * s_b ** 3
    brow_h = 8.5 - 5.0 * s_b
    bn = n3.fbm(P, 2.5, 2, seed + 5) * 1.5
    brow = nz.smoothstep(brow_h * 0.5 + 2.5, brow_h * 0.5 - 2.0, np.abs(y - brow_y) + bn) \
        * nz.smoothstep(-1, 2, u) * nz.smoothstep(46, 40, u) * nz.smoothstep(-5, 5, z) * head

    # ---------------------------------------------------------------- chromophores
    sk = cfg
    cm0 = 0.012 + 0.11 * sk["melanin"] ** 1.4            # 0.20 -> ~0.027 + ...
    Cm = np.full(n, cm0)
    Ch = np.full(n, 0.016 + 0.012 * sk["hemoglobin"])
    S = np.full(n, sk["oxygenation"])
    T = np.ones(n)
    blot = n3.fbm(P, 25.0, 4, seed + 10)
    blot2 = n3.fbm(P, 6.0, 3, seed + 11)
    Cm *= 1.0 + 0.16 * blot + 0.07 * blot2
    Ch *= 1.0 + 0.38 * n3.fbm(P, 12.0, 4, seed + 12) + 0.15 * blot2
    # sun exposure: face, neck, forearms, hands darker; torso and inner limbs lighter
    exposure = np.maximum(face * 1.0, head * 0.7)
    Cm *= 1.0 + 0.22 * exposure - 0.05 * scalp
    # malar / nasal / ear redness
    red = (0.9 * ell(np.c_[ax, y, z], (36, -28, 22), (17, 15, 25))
           + 0.9 * ell(L, (0, -42, 40), (9, 10, 12))
           + 0.6 * ell(np.c_[ax, y, z], (15, -49, 28), (7, 6, 8))
           + 0.35 * ell(L, (0, 42, 25), (35, 18, 30))
           + 0.4 * ell(L, (0, -100, 20), (14, 10, 15))
           + 0.7 * ears + 0.5 * lids
           + 0.3 * ell(np.c_[ax, y, z], (22, -62, 25), (8, 10, 10)))
    Ch *= 1.0 + 1.6 * red * face.clip(0.3, 1) + 0.5 * ears
    # periorbital: thin, bluish-purple under the eyes, slightly pigmented
    peri = ell(np.c_[ax, y, z], (29, -13, 10), (13, 5.5, 14)) * face
    S = S - 0.36 * peri - 0.15 * lids
    Cm *= 1.0 + 0.35 * peri + 0.2 * lids
    T = T * (1 - 0.35 * peri - 0.45 * lids)
    # lips and mouth
    T = T * (1 - 0.62 * lips) * (1 - 0.75 * mouth_in)
    Ch = Ch * (1 - lips) + lips * (0.10 + 0.02 * blot2) + mouth_in * 0.14
    Cm = Cm * (1 - 0.12 * lips) * (1 - 0.8 * mouth_in)
    S = S * (1 - lips) + lips * 0.52
    # areolae, nails
    Cm *= 1.0 + 1.2 * areola
    Ch = Ch * (1 - nails) + nails * 0.05
    Cm = Cm * (1 - 0.8 * nails)
    T = T * (1 - 0.6 * nails)
    # temple veins: low-oxygen lines
    vein_w = n3.worley(P, 9.0, seed + 20)
    vein = (1 - nz.smoothstep(0.0, 0.7, vein_w[1] - vein_w[0])) * ell(np.c_[ax, y, z], (58, 20, -5), (12, 18, 20)) * 0.6
    S = S - 0.25 * vein
    Ch = Ch * (1 + 0.4 * vein)
    # freckles / sun spots and moles
    fr = n3.worley(P, 3.2, seed + 30)
    fr_mask = (fr[2] < 0.09 * sk["freckles"] / 0.12) * (1 - nz.smoothstep(0.2, 0.75, fr[0] / (0.4 + 0.8 * fr[2])))
    Cm *= 1.0 + 0.55 * fr_mask * (face + 0.5 * exposure).clip(0, 1) * (1 - lips)
    rng = np.random.default_rng(sk["seed"])
    mole = np.zeros(n)
    mole_pts = [(-38, -40, 18, 1.0), (44, -6, 0, 0.9), (-20, -96, 18, 0.7), (52, -120, -20, 1.2),
                (-30, 50, 15, 0.6), (8, -150, 20, 1.1)][: sk["moles"]]
    for (mx, my, mz, mr) in mole_pts:
        d = np.linalg.norm(L - np.array([mx, my, mz]), axis=1)
        mole = np.maximum(mole, 1 - nz.smoothstep(mr * 0.6, mr, d))
    _ = rng
    Cm = Cm + mole * 0.25

    # ---------------------------------------------------------------- height (mm)
    H = np.zeros(n)
    # pores: worley pits, size and depth by region
    pore_strength = np.clip(
        0.30 * face + 0.75 * ell(L, (0, -40, 40), (14, 16, 14)) + 0.55 * ell(np.c_[ax, y, z], (32, -35, 24), (16, 15, 20))
        + 0.35 * ell(L, (0, 40, 25), (40, 22, 30)) + 0.40 * ell(L, (0, -98, 22), (18, 14, 14)), 0, 1)
    pore_strength = np.maximum(pore_strength, 0.22) * (1 - lips) * (1 - mouth_in) * (1 - 0.85 * lids) * (1 - nails)
    pore_size = 0.07 + 0.07 * pore_strength
    F1, F2, R = n3.worley(P, 0.62, seed + 40)
    pit = (1 - nz.smoothstep(0.0, pore_size * (0.6 + 0.8 * R), F1)) ** 2
    H -= pit * (0.035 + 0.07 * pore_strength) * (R > 0.15)
    pore_dark = pit * pore_strength * (R > 0.15)
    # secondary sparse larger pores on the nose
    F1b, _, Rb = n3.worley(P, 1.1, seed + 41)
    pitb = (1 - nz.smoothstep(0.0, 0.16, F1b)) ** 2 * ell(L, (0, -42, 42), (12, 12, 12)) * (Rb > 0.4)
    H -= pitb * 0.05
    # cross-hatched micro relief (skin lines), two scales, slightly stretched along Langer-ish lines
    for cell, w, dep, sd in ((1.15, 0.07, 0.016, 50), (2.6, 0.10, 0.022, 51), (0.55, 0.04, 0.007, 52)):
        a, b, _ = n3.worley(P * np.array([1.0, 1.25, 1.0]), cell, seed + sd)
        H -= (1 - nz.smoothstep(0.0, w, b - a)) * dep * (1 - lips) * (1 - mouth_in) * (1 - nails)
    H += n3.fbm(P, 0.35, 2, seed + 60) * 0.004 + n3.fbm(P, 3.0, 3, seed + 61) * 0.015

    # expression wrinkles (static lines of a 34-year-old)
    age = sk["age_wrinkles"]

    def crease(dist, width, depth):
        return -depth * np.exp(-(dist / width) ** 2)

    for i, y0 in enumerate((37.0, 47.0, 57.0)):
        yy = y0 + 2.2 * np.sin(x / 17.0 + i * 1.7) + n3.fbm(P, 12.0, 2, seed + 70 + i) * 1.5
        ext = nz.smoothstep(46 - i * 4, 30 - i * 4, ax) * nz.smoothstep(0, 10, z)
        H += crease(y - yy, 0.45, 0.07 * age) * ext * face
    for sgn in (-1, 1):
        d, _ = _seg_dist(np.c_[x, y], np.array([5.5 * sgn, 9.0]), np.array([8.0 * sgn, 27.0]))
        H += crease(d, 0.4, 0.06 * age) * face
    # crow's feet: fan of lines from the lateral canthus
    cx, cy = 41.5, -1.5
    ang = np.degrees(np.arctan2(y - cy, ax - cx))
    rad = np.hypot(ax - cx, y - cy)
    for k, a0 in enumerate((22, 8, -8, -24, -40)):
        da = (ang - a0 - 4.0 * np.sin(rad / 4.0 + k)) * np.pi / 180 * rad
        H += crease(da, 0.32, 0.06 * age) * nz.smoothstep(4, 8, rad) * nz.smoothstep(19 - k, 12 - k, rad) * face * (ax > cx - 2)
    # infraorbital fine lines
    for r0 in (13.0, 16.5):
        d = np.hypot((ax - 29.5) / 1.25, (y + 2.0)) - r0
        H += crease(d, 0.35, 0.035 * age) * (y < -5) * nz.smoothstep(14, 22, ax) * nz.smoothstep(46, 38, ax) * face
    # nasolabial crease
    for sgn in (1,):
        d, t = _seg_dist(np.c_[ax, y], np.array([16.0, -50.0]), np.array([30.0, -86.0]))
        H += crease(d, 1.8, 0.05) * face * nz.smoothstep(0.0, 0.15, t) * nz.smoothstep(1.0, 0.8, t)
    # lip striations (vertical) and fine lip texture
    stri = np.sin((x + n3.fbm(P, 2.5, 2, seed + 80) * 1.2) * 2 * np.pi / 1.05)
    H -= lips * nz.smoothstep(0.55, 0.95, stri) * 0.03 * nz.smoothstep(0.3, 0.8, m["lips"])
    # neck rings
    for k, y0 in enumerate((-155.0, -178.0)):
        yy = y0 + 2.0 * np.sin(x / 15.0 + k) + n3.fbm(P, 15.0, 2, seed + 90 + k) * 2.0
        H += crease(y - yy, 0.6, 0.05) * nz.smoothstep(-25, 0, z) * nz.smoothstep(55, 35, ax)

    # moles are raised
    H += mole * 0.12

    # ---------------------------------------------------------------- hair follicles and stubble
    hair_alpha = np.zeros(n)
    follicle = np.zeros(n)
    stubble_shadow = beard * sk["stubble"]
    down = np.tile(np.array([0.0, 0.0, -1.0]), (n, 1))
    out_dir = np.c_[np.sign(P[:, 0]) * 0.3, np.zeros(n), -np.ones(n)]
    gdir = _tangent_dir(np.where((beard > 0.01)[:, None], out_dir, down), N)
    seg_len = 0.55 + 0.6 * sk["stubble"]
    F1s, _, Rs = n3.worley(P, 0.55, seed + 100, seg_dir=gdir, seg_len=seg_len)
    on = (Rs < beard * 0.95)
    stroke = (1 - nz.smoothstep(0.024, 0.048, F1s)) * on
    hair_alpha = np.maximum(hair_alpha, stroke * sk["stubble"])
    # scalp hair cap: strands painted along the same comb field as the hair cards, so the scalp reads as
    # hair wherever the cards thin out (the standard real-time short-hair setup)
    import strands
    cdl = strands.scalp_direction_np(L)
    cdir = _tangent_dir(np.stack([cdl[:, 0], -cdl[:, 2], cdl[:, 1]], 1), N)
    across = np.cross(N, cdir)
    u_al = (P * cdir).sum(1)
    v_ac = (P * across).sum(1)
    q = np.stack([u_al / 7.0, v_ac / 0.11, np.zeros(n)], 1)
    q2 = np.stack([u_al / 3.0, v_ac / 0.05, np.full(n, 7.3)], 1)
    strand_n = 0.65 * n3.value(q, 1.0, seed + 111) + 0.35 * n3.value(q2, 1.0, seed + 112)
    clump = n3.fbm(P, 4.0, 2, seed + 113)
    cap_cov = np.clip(scalp * (0.78 + 0.22 * nz.smoothstep(-0.3, 0.2, strand_n + 0.3 * clump)), 0, 1)
    hair_cap = cap_cov * nz.smoothstep(0.35, 0.75, scalp)
    cap_shade = 0.75 + 0.5 * nz.smoothstep(-0.6, 0.6, strand_n)
    F1c, _, Rc = n3.worley(P, 0.85, seed + 110, seg_dir=cdir, seg_len=0.9)
    sc_on = Rc < scalp * 0.97
    hair_alpha = np.maximum(hair_alpha, (1 - nz.smoothstep(0.035, 0.07, F1c)) * sc_on * 0.9)
    H += hair_cap * 0.03 * nz.smoothstep(-0.2, 0.5, strand_n)
    F1e, _, Re = n3.worley(P, 0.7, seed + 120)
    follicle = np.maximum(follicle, (1 - nz.smoothstep(0.03, 0.06, F1e)) * (Re < brow * 0.6))
    hair_dark = np.maximum(scalp * 0.85, brow * 0.6)
    H += stroke * 0.03 - follicle * 0.02

    print(f"[skin] fields for {n} texels in {time.time() - t0:.1f}s")
    return dict(Cm=Cm, Ch=Ch, S=np.clip(S, 0.3, 1.0), T=np.clip(T, 0.2, 2.4), H=H,
                hair_alpha=hair_alpha, follicle=follicle, hair_cap=hair_cap, cap_shade=cap_shade, stubble_shadow=stubble_shadow, hair_dark=hair_dark,
                pore_dark=pore_dark, lips=lips, mouth_in=mouth_in, nails=nails, face=face, scalp=scalp,
                beard=beard, ears=ears, lids=lids, mole=mole, brow=brow, pore_strength=pore_strength)


def body_fields(P, N, F, lm: Landmarks, seed=0):
    """Adds body-specific detail to fields F in place: knuckle/joint creases, palms and soles, body hair."""
    n = len(P)
    j = lm.j
    H, Cm, Ch, T = F["H"], F["Cm"], F["Ch"], F["T"]
    rough_add = np.zeros(n)

    def joint(name):
        return j.get(name)

    for side in ("l", "r"):
        sgn = 1.0 if side == "l" else -1.0
        hand = joint(f"joint-{side}-hand")
        if hand is None:
            continue
        mcp = [joint(f"joint-{side}-finger-{k}-1") for k in range(2, 6)]
        mid_dir = joint(f"joint-{side}-finger-3-4") - joint(f"joint-{side}-finger-3-1")
        mid_dir /= np.linalg.norm(mid_dir)
        knuck = mcp[3] - mcp[0]
        back = np.cross(mid_dir, knuck)
        back /= np.linalg.norm(back)
        if back[0] * sgn < 0:
            back = -back
        dorsal = nz.smoothstep(-0.2, 0.3, N @ back)
        palm = nz.smoothstep(-0.1, -0.5, N @ back)
        near_hand = nz.smoothstep(130, 100, np.linalg.norm(P - hand, axis=1))
        for k in range(1, 6):
            chain = [joint(f"joint-{side}-finger-{k}-{i}") for i in range(1, 5)]
            for i in range(1, 3):
                Jp = chain[i]
                a = chain[i + 1] - chain[i - 1]
                a /= np.linalg.norm(a)
                s = (P - Jp) @ a
                r = np.linalg.norm((P - Jp) - s[:, None] * a, axis=1)
                ring = nz.smoothstep(14, 9, r)
                for off, dep in ((-1.4, 0.035), (-0.5, 0.05), (0.5, 0.05), (1.4, 0.035)):
                    H -= np.exp(-((s - off) / 0.28) ** 2) * dep * ring * dorsal
                H -= np.exp(-(s / 0.45) ** 2) * 0.12 * ring * palm
                Cm *= 1.0 + 0.25 * np.exp(-(s / 3.0) ** 2) * ring * dorsal
        # fingertip ridges and palm skin
        ridge = np.sin(((P @ mid_dir) + n3.fbm(P, 3.0, 2, seed + 7) * 1.5) * 2 * np.pi / 0.48)
        H -= nz.smoothstep(0.3, 1.0, ridge) * 0.018 * palm * near_hand
        Cm *= 1.0 - 0.55 * palm * near_hand
        T *= 1.0 + 0.9 * palm * near_hand
        Ch *= 1.0 + 0.35 * palm * near_hand
        # palm creases: thenar (life) line, head line, heart line, in a hand-local 2D frame
        u = (P - hand) @ (knuck / np.linalg.norm(knuck))
        w = (P - hand) @ mid_dir
        wrist_to_mcp = (mcp[1] - hand) @ mid_dir
        for (a0, b0, depth) in (((20, 15), (-14, 55), 0.16), ((22, 52), (-20, 62), 0.12), ((24, 72), (-26, 68), 0.12)):
            a_ = np.array([a0[0] * -sgn, a0[1] * wrist_to_mcp / 80])
            b_ = np.array([b0[0] * -sgn, b0[1] * wrist_to_mcp / 80])
            d, _ = _seg_dist(np.c_[u, w], a_, b_)
            H -= np.exp(-(d / 0.6) ** 2) * depth * palm * near_hand
        for name in ("elbow",):
            J = joint(f"joint-{side}-{name}")
            d = np.linalg.norm(P - J, axis=1)
            el = nz.smoothstep(40, 20, d) * nz.smoothstep(0.0, 0.4, N @ np.array([0, 1.0, 0]))
            F2_, F1_, _ = n3.worley(P, 3.5, seed + 9)
            H -= (1 - nz.smoothstep(0, 0.25, F1_ - F2_)) * 0.04 * el
            Cm *= 1.0 + 0.2 * el
        J = joint(f"joint-{side}-knee")
        d = np.linalg.norm(P - J, axis=1)
        kn = nz.smoothstep(50, 25, d) * nz.smoothstep(0.0, 0.5, -N[:, 1])
        Cm *= 1.0 + 0.18 * kn
        Ch *= 1.0 + 0.25 * kn
        rough_add += 0.06 * kn
        # soles
    sole = nz.smoothstep(30, 15, P[:, 2]) * nz.smoothstep(-0.3, -0.7, N[:, 2])
    Cm *= 1.0 - 0.5 * sole
    T *= 1.0 + 0.9 * sole
    # body hair: forearms (dorsal), lower legs, a little on the chest and belly
    hair_alpha = F["hair_alpha"]
    dens = np.zeros(n)
    hdir = np.zeros((n, 3))
    hdir[:, 2] = -1.0
    for side in ("l", "r"):
        e, w = joint(f"joint-{side}-elbow"), joint(f"joint-{side}-hand")
        d, t = _seg_dist(P, e, w)
        arm = nz.smoothstep(55, 40, d) * nz.smoothstep(0.0, 0.15, t) * nz.smoothstep(1.0, 0.85, t)
        dens = np.maximum(dens, arm * 0.55)
        a = (w - e) / np.linalg.norm(w - e)
        hdir = np.where((arm > 0.01)[:, None], a, hdir)
        kn, an = joint(f"joint-{side}-knee"), joint(f"joint-{side}-ankle")
        d, t = _seg_dist(P, kn, an)
        leg = nz.smoothstep(70, 55, d) * nz.smoothstep(0.0, 0.1, t) * nz.smoothstep(1.0, 0.9, t)
        dens = np.maximum(dens, leg * 0.7)
        up = joint(f"joint-{side}-upper-leg")
        d, t = _seg_dist(P, up, kn)
        thigh = nz.smoothstep(95, 75, d) * nz.smoothstep(0.35, 0.6, t)
        dens = np.maximum(dens, thigh * 0.35)
    chest_c = (lm.j["joint-spine-3"] + lm.j["joint-spine-2"]) * 0.5
    chest = ell(P, chest_c + np.array([0, -120, 30]), (45, 80, 60)) * 0.35
    belly = ell(P, lm.j["joint-spine-1"] + np.array([0, -110, -40]), (12, 60, 70)) * 0.4
    dens = np.maximum(dens, np.maximum(chest, belly))
    hd = _tangent_dir(hdir, N)
    F1h, _, Rh = n3.worley(P, 2.2, seed + 200, seg_dir=hd, seg_len=4.0)
    strand = (1 - nz.smoothstep(0.02, 0.045, F1h)) * (Rh < dens)
    F["hair_alpha"] = np.maximum(hair_alpha, strand * 0.55)
    F["rough_add"] = rough_add


# ------------------------------------------------------------------------------------- assembly
def roughness(F):
    face, lips, mouth_in = F["face"], F["lips"], F["mouth_in"]
    r = np.full(len(face), 0.56)
    L = F.get("L")
    r = r - 0.05 * face
    r = r * (1 - lips) + lips * 0.33
    r = r * (1 - mouth_in) + mouth_in * 0.12
    r = r * (1 - F["nails"]) + F["nails"] * 0.22
    r = r + 0.10 * F["pore_dark"] + 0.04 * F["beard"] + 0.05 * F["scalp"] + F.get("rough_add", 0)
    _ = L
    return np.clip(r, 0.08, 0.9)


def _fill(img, valid):
    """Push-pull fill of undefined texels from a pyramid of valid averages: smooth, streak-free padding
    so mips and bilinear filtering never pick up undefined texels across UV island borders."""
    img = np.asarray(img, np.float64)
    squeeze = img.ndim == 2
    a = img[..., None] if squeeze else img
    w = valid.astype(np.float64)[..., None]
    levels = [(a * w, w)]
    while levels[-1][1].shape[0] > 1:
        ca, cw = levels[-1]
        h, wd = ca.shape[0] // 2 * 2, ca.shape[1] // 2 * 2
        ca, cw = ca[:h, :wd], cw[:h, :wd]
        na = ca.reshape(h // 2, 2, wd // 2, 2, -1).sum((1, 3))
        nw = cw.reshape(h // 2, 2, wd // 2, 2, 1).sum((1, 3))
        levels.append((na, nw))
    ca, cw = levels[-1]
    fill = ca / np.maximum(cw, 1e-9)
    for la, lw in reversed(levels[:-1]):
        up = np.repeat(np.repeat(fill, 2, 0), 2, 1)
        if up.shape[0] < la.shape[0] or up.shape[1] < la.shape[1]:
            up = np.pad(up, ((0, la.shape[0] - up.shape[0]), (0, la.shape[1] - up.shape[1]), (0, 0)), mode="edge")
        up = up[:la.shape[0], :la.shape[1]]
        cur = la / np.maximum(lw, 1e-9)
        k = np.clip(lw, 0, 1)
        fill = cur * k + up * (1 - k)
    out = np.where(valid[..., None], a, fill)
    return out[..., 0] if squeeze else out


def height_to_normal_uv(H, pos):
    """Tangent-space normal from a height field (mm) using the true mm-per-texel scale from the
    position map, so relief depth is physically consistent across differently scaled UV islands."""
    hp = np.pad(H, 1, mode="edge")
    pp = np.pad(pos, ((1, 1), (1, 1), (0, 0)), mode="edge")
    dhdx = (hp[1:-1, 2:] - hp[1:-1, :-2]) * 0.5
    dhdv = (hp[:-2, 1:-1] - hp[2:, 1:-1]) * 0.5
    du = np.linalg.norm(pp[1:-1, 2:] - pp[1:-1, :-2], axis=-1) * 0.5
    dv = np.linalg.norm(pp[:-2, 1:-1] - pp[2:, 1:-1], axis=-1) * 0.5
    du = np.maximum(du, 1e-3)
    dv = np.maximum(dv, 1e-3)
    nx = -dhdx / du
    ny = -dhdv / dv
    nrm = np.stack([nx, ny, np.ones_like(nx)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    return nrm * 0.5 + 0.5


def eval_fields(P, N, UV, lm, masks, cfg, body, chunk=2_500_000):
    """skin_fields (+ body_fields) in chunks: everything is pointwise in 3D, so chunking changes nothing
    but the peak memory (a 4K tile is ~10M texels)."""
    seed = cfg["seed"] + (1000 if body else 0)
    out = {}
    for s0 in range(0, len(P), chunk):
        s1 = min(len(P), s0 + chunk)
        F = skin_fields(P[s0:s1], N[s0:s1], UV[s0:s1], lm, masks, cfg, seed=seed)
        if body:
            body_fields(P[s0:s1], N[s0:s1], F, lm, seed=cfg["seed"] + 2000)
        for k, v in F.items():
            if isinstance(v, np.ndarray) and v.ndim >= 1 and len(v) == s1 - s0:
                out.setdefault(k, []).append(v.astype(np.float32))
        del F
        gc.collect()
    return {k: np.concatenate(v).astype(np.float64) for k, v in out.items()}


def generate(body_ob, hu, eye_centers, cfg, out_dir, size=4096, names=("Head", "Body"), only=None):
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.time()
    tiles = bake_surface(body_ob, size)
    lm = Landmarks(hu, eye_centers)
    masks = _masks()
    lut = skin_model.LUT(beta=cfg["melanin_type"])
    hair_col = np.array([0.035, 0.024, 0.016])
    for ti, name in enumerate(names):
        if only and name not in only:
            continue
        tile = tiles[ti]
        comp = tile["computed"]
        P = tile["pos"][comp].astype(np.float64)
        N = tile["nrm"][comp].astype(np.float64)
        N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
        UV = tile["mhuv"][comp].astype(np.float64)
        F = eval_fields(P, N, UV, lm, masks, cfg, body=(name == "Body"))
        alb = lut(F["Cm"], F["Ch"], F["S"], F["T"]).astype(np.float64)
        # five-o'clock shadow: hair shafts under the skin read as a cool grey veil
        # lips: dusky rose rather than the model's pink (vermilion is thin but pigmented in this skin type)
        lp = F["lips"][:, None]
        alb = alb * (1 - lp) + alb * np.array([0.80, 0.56, 0.52]) * lp
        sh = (F["stubble_shadow"] * 0.75)[:, None]
        alb = alb * (1 - sh) + alb * np.array([0.55, 0.58, 0.66]) * sh
        sc = (F["scalp"] * 0.25)[:, None]
        alb = alb * (1 - sc) + alb * np.array([0.6, 0.6, 0.64]) * sc
        alb *= (1 - 0.25 * F["pore_dark"])[:, None]
        a = np.clip(F["hair_alpha"], 0, 1)[:, None]
        alb = alb * (1 - a) + hair_col * a
        hc = F["hair_cap"][:, None]
        # painted cap sits under the cards' self-shadowing: darker than the card albedo to match on screen
        cap_col = np.array(cfg.get("hair_color", (0.105, 0.066, 0.040))) * 0.45 * F["cap_shade"][:, None]
        alb = alb * (1 - hc * 0.96) + cap_col * hc * 0.96
        fo = (F["follicle"] * 0.4)[:, None]
        alb = alb * (1 - fo) + hair_col * fo
        mo = (F["mole"] * 0.5)[:, None]
        alb = alb * (1 - mo) + np.array([0.09, 0.05, 0.03]) * mo
        alb = alb * (1 - F["nails"][:, None] * 0.4) + np.array([0.78, 0.60, 0.55]) * F["nails"][:, None] * 0.4
        rough = roughness(F)
        cavity = np.clip(1.0 + F["H"] / 0.06, 0.0, 1.0) ** 0.7
        hgt = F["H"]

        S = size
        full = lambda arr, fill, ch=None: _put(arr, comp, (S, S) if ch is None else (S, S, ch), fill)
        alb_img = full(alb, 0.5, 3)
        H_img = full(hgt, 0.0)
        H_img = gaussian_filter(H_img, 0.6)             # band-limit before differentiating
        nrm = height_to_normal_uv(H_img, tile["pos"])
        r_img = full(rough, 0.5)
        c_img = full(cavity, 1.0)
        ao = tile["ao"] ** 0.8
        trans = np.clip((1.0 - tile["inside"]) * 1.4, 0, 1)
        valid = tile["valid"] | comp
        alb_img = _fill(alb_img, valid)
        nrm = _fill(nrm, valid)
        mask = np.stack([_fill(ao, valid), _fill(r_img, valid), _fill(c_img, valid), _fill(trans, valid)], -1)
        nz.save_png(os.path.join(out_dir, f"T_Human_{name}_BaseColor.png"), nz.linear_to_srgb(alb_img))
        nz.save_png(os.path.join(out_dir, f"T_Human_{name}_Normal.png"), nrm)
        nz.save_png(os.path.join(out_dir, f"T_Human_{name}_Mask.png"), mask)
        print(f"[skin] wrote {name} tile ({time.time() - t0:.0f}s)")
        del F, P, N, UV, alb, alb_img, H_img, nrm, mask, r_img, c_img, ao, trans, tile
        tiles[ti] = None
        gc.collect()


def _put(arr, comp, shape, fill):
    out = np.full(shape, fill, np.float64)
    out[comp] = arr
    return out


def detail_normal(path, size=1024, seed=5):
    """Tileable micro-detail normal for extreme close-ups (skin cross-hatching), for the shader's
    second normal layer at ~20-30x tiling."""
    h = np.zeros((size, size))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    for cells, w, dep, sd in ((22, 0.05, 1.0, 1), (48, 0.06, 0.55, 2), (10, 0.05, 0.6, 3)):
        rng = np.random.default_rng(seed + sd)
        pts = rng.random((cells * cells, 2)) * size
        from scipy.spatial import cKDTree
        tiled = np.concatenate([pts + np.array([dx, dy]) * size for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
        tree = cKDTree(tiled)
        d, _ = tree.query(np.c_[xx.ravel(), yy.ravel()], k=2)
        edge = (d[:, 1] - d[:, 0]).reshape(size, size) / (size / cells)
        h -= (1 - nz.smoothstep(0.0, w * 2, edge)) * dep
    # pores: ~17 per tile side (tile ~10 mm on the head) -> 0.6 mm spacing, pits ~0.08 mm radius
    rng = np.random.default_rng(seed + 9)
    from scipy.spatial import cKDTree
    n_p = 17 * 17
    pts = rng.random((n_p, 2)) * size
    tiled = np.concatenate([pts + np.array([dx, dy]) * size for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    rad = np.tile(rng.uniform(5.0, 10.0, n_p), 9)
    d, idx = cKDTree(tiled).query(np.c_[xx.ravel(), yy.ravel()], k=1)
    pit = (1 - nz.smoothstep(0.0, 1.0, d / rad[idx])) ** 2
    h -= pit.reshape(size, size) * 1.4
    h += nz.spectral((size, size), beta=2.0, seed=seed, lo=40) * 0.15
    nz.save_png(path, nz.height_to_normal(gaussian_filter(h, 0.7, mode="wrap"), 2.0, wrap=True))
