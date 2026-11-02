"""Procedural iris and sclera textures.

Iris: built in polar space (angle x radius) where the anatomy is natural, then resampled to the planar
disc UV used by the eye mesh (uv radius 0.49 = limbus).
  pupil and pupillary ruff, amber pupillary zone, zig-zag collarette, radial stroma fibres, crypts of
  Fuchs, contraction furrows, darker limbal ring; plus a height map for the stroma relief.
Sclera: azimuthal-equidistant map around the front pole (uv radius 0.5 = back pole). Conjunctival
vessels branch in from the periphery, mostly at the nasal and temporal corners where the eye is exposed.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates

import noise as nz


def _polar_to_disc(polar, size, r_max, uv_scale=0.49):
    """polar: (n_r, n_a[, C]) sampled over r in [0, r_max] (1 = limbus), angle [0, 2pi)."""
    n_r, n_a = polar.shape[:2]
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx + 0.5) / size - 0.5
    v = 0.5 - (yy + 0.5) / size
    r = np.sqrt(u * u + v * v) / uv_scale
    a = np.mod(np.arctan2(v, u), 2 * np.pi)
    ri = r / r_max * (n_r - 1)
    ai = a / (2 * np.pi) * n_a
    if polar.ndim == 2:
        return map_coordinates(polar, [ri, ai], order=1, mode="grid-wrap")
    return np.stack([map_coordinates(polar[..., c], [ri, ai], order=1, mode="grid-wrap")
                     for c in range(polar.shape[2])], -1)


def iris(size=2048, base=(0.30, 0.20, 0.10), outer=(0.10, 0.08, 0.05), inner=(0.55, 0.42, 0.17),
         pupil=0.263, seed=3):
    """Returns (albedo sRGB (size,size,3), height (size,size)). Colours given in linear RGB."""
    n_a, n_r, r_max = 4096, 640, 1.08
    rng = np.random.default_rng(seed)
    r = np.linspace(0, r_max, n_r)[:, None] * np.ones((1, n_a))
    a = np.linspace(0, 2 * np.pi, n_a, endpoint=False)[None, :] * np.ones((n_r, 1))

    # radial fibres: high frequency across angle, low along radius; wavy (stroma isn't straight)
    warp = nz.aniso((n_r, n_a), 1.0, 0.25, seed=seed + 1) * 0.004
    fib1 = nz.aniso((n_r, n_a), 9.0, 0.08, seed=seed + 2, beta=1.6)
    fib2 = nz.aniso((n_r, n_a), 3.0, 0.04, seed=seed + 3, beta=1.8)
    a2 = a + warp * 2 * np.pi
    _ = a2
    fibres = 0.65 * fib1 + 0.35 * fib2
    # collarette: zig-zag ring around r ~ 0.45 of the iris (measured from the pupil margin)
    zig = 0.43 + 0.035 * np.sin(a[0] * 23 + nz.aniso((1, n_a), 1, 1, seed=seed + 4)[0] * 2.0) \
        + 0.015 * nz.aniso((1, n_a), 1, 1, seed=seed + 5)[0]
    zig = zig[None, :]
    col_ring = np.exp(-((r - zig) / 0.022) ** 2)
    pupillary = nz.smoothstep(zig + 0.02, zig - 0.06, r)            # 1 inside the collarette
    # crypts: dark lens-shaped lacunae, mostly just outside the collarette
    crypt = np.zeros((n_r, n_a))
    for _ in range(int(60)):
        cr = rng.uniform(0.47, 0.78)
        ca = rng.uniform(0, 2 * np.pi)
        lr = rng.uniform(0.02, 0.06)                 # radial half-length
        la = rng.uniform(0.012, 0.035) / max(cr, 0.3)  # angular half-width (radians)
        da = np.angle(np.exp(1j * (a - ca)))
        d = ((r - cr) / lr) ** 2 + (da / la) ** 2
        crypt = np.maximum(crypt, np.exp(-d ** 2 * 1.5) * rng.uniform(0.5, 1.0))
    # contraction furrows: faint concentric rings in the outer ciliary zone
    furrow = np.zeros_like(r)
    for fr in (0.70, 0.80, 0.88):
        wob = fr + 0.006 * nz.aniso((1, n_a), 1, 1, seed=int(fr * 100))[0][None, :]
        furrow += np.exp(-((r - wob) / 0.006) ** 2) * (0.5 + 0.5 * (fib2 > 0))
    # limbal ring
    limbal = nz.smoothstep(0.80, 0.99, r)
    blob = nz.spectral((n_r, n_a), beta=2.5, seed=seed + 9)

    base = np.array(base)
    outer = np.array(outer)
    inner = np.array(inner)
    t = nz.smoothstep(pupil, 1.0, r)[..., None]
    col = base * (1 - limbal[..., None]) + outer * limbal[..., None]
    col = col * (1 - pupillary[..., None]) + inner * pupillary[..., None]
    # pigment variation: fibres lighter/darker, low-frequency blotches (a hint of green in hazel eyes)
    green = np.array([0.20, 0.22, 0.09])
    g_mask = np.clip(0.5 + 0.6 * blob, 0, 1)[..., None] * (1 - pupillary[..., None]) * (1 - limbal[..., None]) * 0.35
    col = col * (1 - g_mask) + green * g_mask
    col *= (1.0 + 0.45 * fibres[..., None])
    col *= (1.0 + 0.25 * col_ring[..., None])
    col *= (1.0 - 0.55 * crypt[..., None])
    col *= (1.0 - 0.25 * furrow[..., None])
    _ = t
    # pupillary ruff (dark brown frill) and the pupil itself
    ruff = np.exp(-((r - (pupil + 0.018 + 0.006 * fib1)) / 0.014) ** 2)
    col = col * (1 - 0.7 * ruff[..., None]) + np.array([0.03, 0.015, 0.01]) * 0.7 * ruff[..., None]
    pupil_edge = pupil + 0.004 * fib2
    pm = nz.smoothstep(pupil_edge + 0.006, pupil_edge - 0.006, r)
    col = col * (1 - pm[..., None]) + 0.004 * pm[..., None]
    # beyond the limbus (r > 1): fade to the sclera shade so the mesh step blends
    beyond = nz.smoothstep(0.985, 1.05, r)[..., None]
    col = col * (1 - beyond) + np.array([0.42, 0.40, 0.38]) * beyond
    col = np.clip(col, 0, 1)

    height = 0.5 * fibres * (1 - pm) + 0.8 * col_ring - 1.0 * crypt - 0.4 * furrow + 0.6 * pupillary
    height = height * (1 - beyond[..., 0]) - pm * 1.0
    alb = nz.linear_to_srgb(_polar_to_disc(col, size, r_max))
    hgt = _polar_to_disc(height, size, r_max)
    hgt = (hgt - hgt.min()) / (hgt.max() - hgt.min())
    return alb, hgt


def sclera(size=2048, redness=0.25, seed=11):
    """Albedo sRGB for the azimuthal-equidistant sclera map. Front pole at the centre."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx + 0.5) / size - 0.5
    v = 0.5 - (yy + 0.5) / size
    rho = np.sqrt(u * u + v * v)
    theta = rho / 0.5 * 180.0                      # degrees from the front pole
    ang = np.arctan2(v, u)
    limbus = math.degrees(math.asin(5.9 / 12.0))
    base = np.array([0.66, 0.60, 0.54])            # linear; real sclera is never white
    col = np.ones((size, size, 3)) * base
    # bluish-grey translucency near the limbus, warmer / pinker toward the periphery
    near = np.exp(-((theta - limbus) / 6.0) ** 2)[..., None]
    col = col * (1 - 0.25 * near) + np.array([0.55, 0.58, 0.62]) * 0.25 * near
    peri = nz.smoothstep(limbus + 15, 95, theta)[..., None]
    col = col * (1 - 0.35 * peri) + np.array([0.80, 0.52, 0.45]) * 0.35 * peri
    blot = nz.spectral((size, size), beta=3.0, seed=seed)[..., None]
    col *= 1 + 0.03 * blot
    # yellowish pinguecula hint at the nasal and temporal limbus
    for side in (0.0, math.pi):
        da = np.angle(np.exp(1j * (ang - side)))
        p = np.exp(-(da / 0.35) ** 2 - ((theta - (limbus + 9)) / 5.5) ** 2)[..., None]
        col = col * (1 - 0.18 * p) + np.array([0.78, 0.66, 0.42]) * 0.18 * p

    # canthal edges: the conjunctiva turns into the pink plica / caruncle where the lids meet
    for side in (0.0, math.pi):
        da = np.angle(np.exp(1j * (ang - side)))
        k = np.exp(-(da / 0.42) ** 2) * nz.smoothstep(40, 58, theta)
        col = col * (1 - 0.55 * k[..., None]) + np.array([0.62, 0.30, 0.28]) * 0.55 * k[..., None]

    # vessels: drawn supersampled, then blurred a touch (they lie under the conjunctiva)
    ss = 2
    S = size * ss
    canvas = Image.new("L", (S, S), 0)
    fine = Image.new("L", (S, S), 0)
    dr = ImageDraw.Draw(canvas)
    df = ImageDraw.Draw(fine)

    def to_px(th_deg, phi):
        rr = th_deg / 180.0 * 0.5
        return ((0.5 + rr * math.cos(phi)) * S, (0.5 - rr * math.sin(phi)) * S)

    def vessel(th, phi, width, length, depth, draw):
        pts = [to_px(th, phi)]
        heading = 0.0  # toward the limbus = decreasing theta
        for i in range(int(length)):
            heading = heading * 0.85 + rng.normal(0, 0.12)
            th -= 1.2 * math.cos(heading)
            phi += 1.2 * math.sin(heading) / max(th, 5.0) * 1.0
            if th < limbus + 2.5:
                break
            pts.append(to_px(th, phi))
            if depth < 3 and rng.random() < 0.07:
                vessel(th, phi, width * 0.65, length * 0.5, depth + 1, draw)
        wpx = max(1, int(width * ss))
        if len(pts) > 1:
            draw.line(pts, fill=int(255 * min(1.0, 0.45 + width * 0.25)), width=wpx, joint="curve")

    n_main = int(20 + 40 * redness)
    for _ in range(n_main):
        # mostly nasal/temporal (horizontal), some top/bottom
        if rng.random() < 0.8:
            phi = rng.choice([0.0, math.pi]) + rng.normal(0, 0.45)
        else:
            phi = rng.uniform(0, 2 * math.pi)
        vessel(rng.uniform(80, 100), phi, rng.uniform(1.6, 3.2), rng.uniform(25, 60), 0, dr)
    for _ in range(int(30 + 50 * redness)):
        phi = rng.uniform(0, 2 * math.pi)
        vessel(rng.uniform(limbus + 15, 85), phi, rng.uniform(0.6, 1.1), rng.uniform(5, 18), 2, df)
    vm = np.asarray(canvas.resize((size, size), Image.LANCZOS)).astype(np.float64) / 255.0
    vf = np.asarray(fine.resize((size, size), Image.LANCZOS)).astype(np.float64) / 255.0
    vm = nz.blur(vm, 0.8, wrap=False)
    vf = nz.blur(vf, 0.6, wrap=False)
    fade = nz.smoothstep(limbus + 1, limbus + 30, theta)
    vess = np.clip(vm * (0.55 + 0.45 * redness) + vf * 0.25, 0, 1) * fade
    vcol = np.array([0.42, 0.05, 0.04])
    col = col * (1 - vess[..., None] * 0.85) + vcol * vess[..., None] * 0.85
    return nz.linear_to_srgb(np.clip(col, 0, 1))


def generate(out_dir, eye_cfg):
    os.makedirs(out_dir, exist_ok=True)
    alb, h = iris(base=eye_cfg["iris"], outer=eye_cfg["iris_outer"], inner=eye_cfg["iris_inner"])
    nz.save_png(os.path.join(out_dir, "T_Human_Iris_BaseColor.png"), alb)
    nz.save_png(os.path.join(out_dir, "T_Human_Iris_Normal.png"), nz.height_to_normal(nz.blur(h, 1.0, False), 6.0))
    sc = sclera(redness=eye_cfg["sclera_redness"])
    nz.save_png(os.path.join(out_dir, "T_Human_Sclera_BaseColor.png"), sc)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import config
    import mh
    generate(os.path.join(mh.REPO, "Assets", "Art", "Textures", "Characters", "Human"), config.EYES)
