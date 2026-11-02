"""Clothing: white cotton T-shirt, washed jeans and white trainers fitted to the morphed body.

Meshes are MakeHuman's CC0 male_casualsuit06 and shoes05 proxies, fitted like the teeth (triangle
references + offsets), so the clothes follow any body shape the config produces. Textures are cleaned for
use in a game:
  - the shirt's printed MakeHuman logo is replaced by procedural off-white cotton (keeping the
    source's baked fold AO and wrinkle normals);
  - the "www.makehuman.org" watermark and everything outside the UV islands is padded away;
  - the trainers' green accents are neutralised to grey (no recognisable brand styling).
Tiling knit (jersey) and twill (denim) detail normals give the fabric weave in close-ups.
"""
from __future__ import annotations

import colorsys
import math
import os

import numpy as np
from PIL import Image, ImageDraw

import bl
import mh
import noise as nz

SUIT = "male_casualsuit06"
SHOES = "shoes05"


def _proxy_dir(name):
    return os.path.join(mh.DATA, "proxies", name)


def _load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255.0


def _uv_mask(obj, faces, size):
    im = Image.new("L", (size, size), 0)
    dr = ImageDraw.Draw(im)
    for fi in faces:
        pts = [(float(obj.uvs[t][0] * size), float((1 - obj.uvs[t][1]) * size)) for t in obj.face_uvs[fi]]
        dr.polygon(pts, fill=255)
    return np.asarray(im) > 127


def shirt_faces(obj):
    """Faces of the T-shirt (upper UV half) vs the jeans (lower half)."""
    out = []
    for fi, tuv in enumerate(obj.face_uvs):
        v = np.mean([obj.uvs[t][1] for t in tuv])
        out.append(v > 0.5)
    return np.array(out)


def suit_textures(out_dir, size=2048, seed=4):
    """Writes T_Human_Outfit_{BaseColor,Normal,Mask}.png (shirt and jeans share one UV set)."""
    from skin_textures import _fill
    d = _proxy_dir(SUIT)
    px = mh.load_proxy(SUIT)
    alb = _load_rgb(os.path.join(d, f"{SUIT}_diffuse.png"))
    nrm = _load_rgb(os.path.join(d, f"{SUIT}_normal.png"))
    ao = np.asarray(Image.open(os.path.join(d, f"{SUIT}_ao.png")).convert("L")).astype(np.float64) / 255.0
    H = alb.shape[0]
    is_shirt = shirt_faces(px.obj)
    m_shirt = _uv_mask(px.obj, np.nonzero(is_shirt)[0], H)
    m_jeans = _uv_mask(px.obj, np.nonzero(~is_shirt)[0], H)
    valid = m_shirt | m_jeans
    # shirt: procedural off-white cotton; folds from the source AO, slub/yarn variation from noise
    yarn = nz.spectral((H, H), beta=1.2, seed=seed, lo=200) * 0.012 + nz.spectral((H, H), beta=2.5, seed=seed + 1) * 0.02
    cotton = np.array([0.80, 0.79, 0.76])          # linear: an off-white tee is not paper white
    shirt = cotton[None, None, :] * (0.72 + 0.28 * ao[..., None]) * (1 + yarn[..., None])
    alb_lin = nz.srgb_to_linear(alb)
    alb_lin = np.where(m_shirt[..., None], shirt, alb_lin)
    rough = np.where(m_shirt, 0.88, 0.80) + nz.spectral((H, H), beta=2.0, seed=seed + 2) * 0.03
    mask = np.stack([ao, np.clip(rough, 0, 1), np.ones_like(ao), np.where(m_shirt, 1.0, 0.5)], -1)   # A = sheen weight
    alb_out = _fill(nz.linear_to_srgb(np.clip(alb_lin, 0, 1)), valid)
    nrm_out = _fill(nrm, valid)
    mask_out = _fill(mask, valid)
    nz.save_png(os.path.join(out_dir, "T_Human_Outfit_BaseColor.png"), alb_out)
    nz.save_png(os.path.join(out_dir, "T_Human_Outfit_Normal.png"), nrm_out)
    nz.save_png(os.path.join(out_dir, "T_Human_Outfit_Mask.png"), mask_out)


def shoe_textures(out_dir):
    d = _proxy_dir(SHOES)
    a = _load_rgb(os.path.join(d, f"{SHOES}_diffuse.png"))
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in a.reshape(-1, 3)]).reshape(a.shape)
    green = (hsv[..., 0] > 0.18) & (hsv[..., 0] < 0.48) & (hsv[..., 1] > 0.25)
    grey = a.mean(-1, keepdims=True) * np.array([0.55, 0.56, 0.58]) / 0.5
    a = np.where(green[..., None], np.clip(grey * 0.55, 0, 1), a)
    nz.save_png(os.path.join(out_dir, "T_Human_Shoes_BaseColor.png"), a)


def detail_normals(out_dir, size=512):
    """Tileable fabric weaves: jersey knit (shirt) and 3/1 twill (denim)."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    # jersey: columns of V-shaped loops, 32 x 26 stitches per tile
    cw, rh = size / 32.0, size / 26.0
    cx = np.mod(xx, cw) / cw - 0.5
    cy = np.mod(yy, rh) / rh - 0.5
    legL = np.abs((cx + 0.22) - 0.42 * cy) / 0.16
    legR = np.abs((cx - 0.22) + 0.42 * cy) / 0.16
    h = np.exp(-legL ** 2) + np.exp(-legR ** 2)
    h += nz.spectral((size, size), beta=2.0, seed=31, lo=20) * 0.08
    nz.save_png(os.path.join(out_dir, "T_Human_KnitDetail_Normal.png"),
                nz.height_to_normal(nz.blur(h, 0.6), 1.6, wrap=True))
    # twill: diagonal wale every 8 px, broken by yarn slub
    period = size / 64.0
    t = np.mod(xx + yy, period) / period
    h = np.exp(-((t - 0.5) / 0.22) ** 2) + nz.spectral((size, size), beta=1.5, seed=32, lo=30) * 0.12
    warp = np.mod(yy, period * 0.5) / (period * 0.5)
    h += 0.25 * np.exp(-((warp - 0.5) / 0.3) ** 2)
    nz.save_png(os.path.join(out_dir, "T_Human_TwillDetail_Normal.png"),
                nz.height_to_normal(nz.blur(h, 0.6), 1.4, wrap=True))


def build(hu, name, col, weights_all):
    """Fitted outfit meshes (pre-subdivision) with skin weights. Returns {key: (object, proxy)}."""
    import rig_export as rx
    out = {}
    bones, W = weights_all
    for key, pname in (("Outfit", SUIT), ("Shoes", SHOES)):
        px = mh.load_proxy(pname)
        co = hu.to_bl(px.fit(hu.mh_verts))
        ob = bl.mesh_object(f"{name}_{key}", co, px.obj.faces, px.obj.face_uvs, px.obj.uvs, uv_name="UV0", col=col)
        if key == "Outfit":
            ob.data.polygons.foreach_set("material_index", np.where(shirt_faces(px.obj), 0, 1).astype(np.int32))
        Wp = (W[px.refs] * px.weights[..., None]).sum(axis=1)
        rx.set_weights(ob, bones, Wp)
        out[key] = (ob, px)
    return out


def covered_body_verts():
    """Base-mesh vertices hidden under the outfit (MakeHuman delete_verts of every garment)."""
    idx = []
    for pname in (SUIT, SHOES):
        px = mh.load_proxy(pname)
        if px.delete_verts is not None:
            idx.append(px.delete_verts)
    return np.unique(np.concatenate(idx)) if idx else np.zeros(0, np.int64)


def materials(tex_dir):
    """Cycles reference materials for the outfit (mirrors Voxelwild/Character/Cloth)."""
    import materials as mats

    def load(n, cs="sRGB"):
        return bl.load_image(os.path.join(tex_dir, n), cs)

    alb = load("T_Human_Outfit_BaseColor.png")
    nrm = load("T_Human_Outfit_Normal.png", "Non-Color")
    msk = load("T_Human_Outfit_Mask.png", "Non-Color")
    msk.alpha_mode = "CHANNEL_PACKED"
    # weave scale: 1 outfit UV unit is ~0.4 m, so tiling 18 gives ~0.7 mm jersey stitches, 20 gives ~0.3 mm twill
    shirt = mats.cloth("M_Human_Shirt", alb, nrm, msk, load("T_Human_KnitDetail_Normal.png", "Non-Color"),
                       detail_tiling=18.0, sheen=0.7, detail_strength=0.3)
    jeans = mats.cloth("M_Human_Jeans", alb, nrm, msk, load("T_Human_TwillDetail_Normal.png", "Non-Color"),
                       detail_tiling=20.0, sheen=0.35, detail_strength=0.4)
    shoes = mats.cloth("M_Human_Shoes", load("T_Human_Shoes_BaseColor.png"), None, None, None,
                       detail_tiling=1.0, sheen=0.1, roughness=0.55)
    return shirt, jeans, shoes


def generate_textures(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    suit_textures(out_dir)
    shoe_textures(out_dir)
    detail_normals(out_dir)
    _ = math
