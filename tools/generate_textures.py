"""Procedural PBR texture sets for blocks that have no suitable scan.

Writes SourceArt/Textures/generated/<Name>/<Name>_{Color,Opacity,NormalGL,Roughness,AmbientOcclusion,
Displacement,Metalness,Emission}.png -- the same layout as the ambientCG sets, so the Unity texture-array
builder treats both sources identically.

    python tools/generate_textures.py            # all sets
    python tools/generate_textures.py Leaves Torch

Requires numpy + Pillow (tools/requirements.txt). Deterministic: every set uses a fixed seed.
Inputs: scanned sets fetched by tools/fetch_ambientcg.py (Leaf001, Rock058, TreeEnd002).
"""
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCANS = ROOT / "SourceArt" / "Textures" / "ambientCG"
OUT = ROOT / "SourceArt" / "Textures" / "generated"
N = 1024


# ----------------------------------------------------------------------------- helpers

def load(asset: str, suffix: str, size=N, mode="RGB") -> np.ndarray:
    files = list((SCANS / asset).glob(f"*_{suffix}.*"))
    if not files:
        raise FileNotFoundError(f"{asset} {suffix}: run tools/fetch_ambientcg.py")
    im = Image.open(files[0]).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def tile_noise(rng, size=N, scale=32.0, octaves=4) -> np.ndarray:
    """Tileable fractal noise in [0,1] via spectral filtering of white noise."""
    out = np.zeros((size, size), np.float32)
    amp, total = 1.0, 0.0
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f2 = fx * fx + fy * fy
    for o in range(octaves):
        s = scale / (2 ** o)
        white = rng.standard_normal((size, size))
        filt = np.exp(-f2 * (s * s) * (math.pi ** 2) * 2)
        layer = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
        layer = (layer - layer.mean()) / (layer.std() + 1e-8)
        out += layer * amp
        total += amp
        amp *= 0.5
    out /= total
    return np.clip(out * 0.25 + 0.5, 0, 1)


def blur_wrap(a: np.ndarray, sigma: float) -> np.ndarray:
    size_y, size_x = a.shape[:2]
    fy = np.fft.fftfreq(size_y)[:, None]
    fx = np.fft.fftfreq(size_x)[None, :]
    filt = np.exp(-(fx * fx + fy * fy) * (2 * math.pi ** 2) * sigma * sigma)
    if a.ndim == 2:
        return np.real(np.fft.ifft2(np.fft.fft2(a) * filt))
    return np.stack([np.real(np.fft.ifft2(np.fft.fft2(a[..., c]) * filt)) for c in range(a.shape[2])], -1)


def normal_from_height(h: np.ndarray, strength: float, wrap=True) -> np.ndarray:
    """OpenGL tangent-space normal (x right, y up in texture space). Image rows run downward."""
    if wrap:
        dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
        drow = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    else:
        drow, dx = np.gradient(h)
    n = np.stack([-dx * strength, drow * strength, np.ones_like(h)], -1)   # d/dv = -d/drow
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def encode_normal(n: np.ndarray) -> np.ndarray:
    return np.clip(n * 0.5 + 0.5, 0, 1)


def save(name: str, color, normal, rough, ao=None, height=None, opacity=None, metal=None, emission=None):
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    for f in d.glob("*.png"):
        f.unlink()

    def w(arr, suffix, mode):
        a = np.clip(arr, 0, 1)
        img = Image.fromarray((a * 255 + 0.5).astype(np.uint8), mode)
        img.save(d / f"{name}_{suffix}.png", optimize=True)

    w(color, "Color", "RGB")
    w(encode_normal(normal), "NormalGL", "RGB")
    w(rough, "Roughness", "L")
    if ao is not None: w(ao, "AmbientOcclusion", "L")
    if height is not None: w(height, "Displacement", "L")
    if opacity is not None: w(opacity, "Opacity", "L")
    if metal is not None: w(metal, "Metalness", "L")
    if emission is not None: w(emission, "Emission", "L")
    print(f"  {name}")


def paste_wrapped(dst: np.ndarray, src: np.ndarray, alpha: np.ndarray, x: int, y: int):
    """Alpha-over src into dst at (x, y) with toroidal wrap. dst/src HxWxC float, alpha HxW."""
    h, w = alpha.shape
    ys = (np.arange(h) + y) % dst.shape[0]
    xs = (np.arange(w) + x) % dst.shape[1]
    region = dst[np.ix_(ys, xs)]
    a = alpha[..., None]
    dst[np.ix_(ys, xs)] = src * a + region * (1 - a)


def supersampled_canvas(scale=2):
    return Image.new("RGBA", (N * scale, N * scale), (0, 0, 0, 0))


def downsample(img: Image.Image) -> np.ndarray:
    return np.asarray(img.resize((N, N), Image.LANCZOS)).astype(np.float32) / 255.0


# ----------------------------------------------------------------------------- foliage

def leaves():
    """Dense broadleaf cluster built from the scanned Leaf001 (two leaves, split into sprites)."""
    rng = np.random.default_rng(11)
    src_c = load("Leaf001", "Color", 1024)
    src_a = load("Leaf001", "Opacity", 1024, "L")
    src_n = load("Leaf001", "NormalGL", 1024) * 2 - 1
    src_r = load("Leaf001", "Roughness", 1024, "L")
    sprites = []
    for x0, x1 in ((0, 512), (512, 1024)):
        a = src_a[:, x0:x1]
        rows = np.where(a.max(1) > 0.1)[0]
        cols = np.where(a.max(0) > 0.1)[0]
        sl = (slice(rows[0], rows[-1] + 1), slice(x0 + cols[0], x0 + cols[-1] + 1))
        sprites.append((src_c[sl], src_a[sl], src_n[sl], src_r[sl]))

    color = np.zeros((N, N, 3), np.float32); color[:] = (0.05, 0.08, 0.03)
    normal = np.zeros((N, N, 3), np.float32); normal[:] = (0, 0, 1)
    rough = np.full((N, N), 0.6, np.float32)
    height = np.zeros((N, N), np.float32)
    alpha = np.zeros((N, N), np.float32)
    count = 290
    for i in range(count):
        c, a, n, r = sprites[rng.integers(2)]
        size = rng.uniform(110, 190)
        angle = rng.uniform(0, 360)
        sc = size / max(a.shape)
        wpx, hpx = max(2, int(a.shape[1] * sc)), max(2, int(a.shape[0] * sc))

        def tf(arr, mode):
            im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), mode).resize((wpx, hpx), Image.LANCZOS)
            return np.asarray(im.rotate(angle, Image.BICUBIC, expand=True)).astype(np.float32) / 255.0

        ca, aa = tf(c, "RGB"), tf(a, "L")
        na = tf(n * 0.5 + 0.5, "RGB") * 2 - 1
        ra = tf(r, "L")
        t = math.radians(angle)
        nx = na[..., 0] * math.cos(t) - na[..., 1] * math.sin(t)
        ny = na[..., 0] * math.sin(t) + na[..., 1] * math.cos(t)
        tilt = rng.normal(0, 0.25, 2)
        nr = np.stack([nx + tilt[0], ny + tilt[1], np.maximum(na[..., 2], 0.2)], -1)
        nr /= np.linalg.norm(nr, axis=-1, keepdims=True)

        depth = i / count                                # later leaves sit on top
        hue = rng.normal(0, 0.06, 3) + (0.0, 0.03, -0.02)
        ca = np.clip(ca * (0.55 + 0.55 * depth) * (1 + hue), 0, 1)
        x, y = rng.integers(N), rng.integers(N)
        paste_wrapped(color, ca, aa, x, y)
        paste_wrapped(normal, nr, aa, x, y)
        paste_wrapped(rough[..., None], ra[..., None], aa, x, y)
        paste_wrapped(height[..., None], np.full(aa.shape + (1,), depth, np.float32), aa, x, y)
        a_region = np.zeros_like(alpha)
        paste_wrapped(a_region[..., None], np.ones(aa.shape + (1,), np.float32), aa, x, y)
        alpha = np.maximum(alpha, a_region)

    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    ao = np.clip(0.35 + 0.65 * height, 0, 1)
    opacity = (alpha > 0.5).astype(np.float32)
    print(f"    leaves coverage {opacity.mean():.2f}")
    save("Leaves", color, normal, np.clip(rough * 0.9 + 0.1, 0, 1), ao, height, opacity)


def needles():
    """Spruce twigs: tapered needles arranged along branching stems."""
    rng = np.random.default_rng(23)
    S = 2
    col = supersampled_canvas(S)
    hgt = Image.new("L", col.size, 0)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)
    for twig in range(95):
        x0, y0 = rng.uniform(-0.1, 1.1) * N * S, rng.uniform(-0.1, 1.1) * N * S
        ang = rng.uniform(0, 2 * math.pi)
        length = rng.uniform(260, 520) * S
        depth = twig / 95
        shade = 0.45 + 0.55 * depth
        steps = int(length / (7 * S))
        for k in range(steps):
            t = k / steps
            px = x0 + math.cos(ang) * length * t
            py = y0 + math.sin(ang) * length * t
            for side in (-1, 1):
                na = ang + side * rng.uniform(0.7, 1.1)
                nl = rng.uniform(34, 52) * S * (1 - 0.4 * t)
                ex, ey = px + math.cos(na) * nl, py + math.sin(na) * nl
                g = rng.uniform(0.75, 1.1)
                cc = (int(28 * shade * g), int(72 * shade * g), int(38 * shade * g), 255)
                for ox in (-N * S, 0, N * S):
                    for oy in (-N * S, 0, N * S):
                        dc.line([(px + ox, py + oy), (ex + ox, ey + oy)], fill=cc, width=int(5 * S))
                        dh.line([(px + ox, py + oy), (ex + ox, ey + oy)], fill=int(90 + 160 * depth), width=int(5 * S))
            for ox in (-N * S, 0, N * S):
                for oy in (-N * S, 0, N * S):
                    q = (px + ox, py + oy)
                    dc.ellipse([q[0] - 4 * S, q[1] - 4 * S, q[0] + 4 * S, q[1] + 4 * S], fill=(60, 42, 26, 255))
    c = downsample(col)
    h = np.asarray(hgt.resize((N, N), Image.LANCZOS)).astype(np.float32) / 255.0
    h = blur_wrap(h, 1.2)
    opacity = (c[..., 3] > 0.5).astype(np.float32)
    rgb = c[..., :3] / np.maximum(c[..., 3:4], 1e-3)
    rgb = np.where(opacity[..., None] > 0, rgb, (0.05, 0.1, 0.05))
    print(f"    needle coverage {opacity.mean():.2f}")
    save("Needles", rgb, normal_from_height(h, 6.0), np.full((N, N), 0.62), np.clip(0.4 + 0.6 * h, 0, 1), h, opacity)


def blade(draw_c, draw_h, rng, x, base_y, height, lean, width, col_base, col_tip, S, depth):
    """One tapered, curved blade from (x, base_y) upward. Drawn as stacked trapezoid slices."""
    steps = 28
    pts = []
    for k in range(steps + 1):
        t = k / steps
        px = x + lean * (t ** 1.8)
        py = base_y - height * t
        pts.append((px, py, width * (1 - t) ** 0.8 + 0.6 * S))
    for k in range(steps):
        (x0, y0, w0), (x1, y1, w1) = pts[k], pts[k + 1]
        t = k / steps
        c = tuple(int(255 * (col_base[i] * (1 - t) + col_tip[i] * t)) for i in range(3)) + (255,)
        poly = [(x0 - w0 / 2, y0), (x0 + w0 / 2, y0), (x1 + w1 / 2, y1), (x1 - w1 / 2, y1)]
        draw_c.polygon(poly, fill=c)
        # ridge: bright centre line in the height buffer gives a folded-blade normal
        draw_h.polygon(poly, fill=int(80 + 100 * depth))
        draw_h.line([(x0, y0), (x1, y1)], fill=int(150 + 100 * depth), width=max(1, int(w0 * 0.35)))


def grass_tuft():
    rng = np.random.default_rng(31)
    S = 2
    col, hgt = supersampled_canvas(S), Image.new("L", (N * S, N * S), 0)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)
    base = N * S - 6 * S
    for i in range(95):
        depth = i / 95
        x = rng.normal(0.5, 0.2) * N * S
        x = min(max(x, 0.08 * N * S), 0.92 * N * S)
        h = rng.uniform(0.35, 0.9) * N * S * (1 - 0.35 * abs(x / (N * S) - 0.5) * 2)
        lean = rng.normal(0, 0.12) * N * S
        g = rng.uniform(0.8, 1.15)
        cb = (0.05 * g, 0.11 * g, 0.03)
        ct = (0.36 * g, 0.52 * g, 0.16 + rng.uniform(0, 0.08))
        cb = tuple(v * (0.55 + 0.45 * depth) for v in cb)
        blade(dc, dh, rng, x, base, h, lean, rng.uniform(16, 28) * S, cb, ct, S, depth)
    finish_sprite("GrassTuft", col, hgt, rough=0.72)


def flower(name, petal_color, center_color, petals, petal_len, petal_w, seed, stems=3):
    rng = np.random.default_rng(seed)
    S = 2
    col, hgt = supersampled_canvas(S), Image.new("L", (N * S, N * S), 0)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)
    base = N * S - 6 * S
    for i in range(18):  # a few leaves / grass at the base
        x = rng.normal(0.5, 0.15) * N * S
        blade(dc, dh, rng, x, base, rng.uniform(0.15, 0.4) * N * S, rng.normal(0, 0.1) * N * S,
              rng.uniform(18, 30) * S, (0.05, 0.12, 0.04), (0.25, 0.45, 0.14), S, i / 18)
    for s in range(stems):
        x = (0.3 + 0.4 * s / max(1, stems - 1) + rng.normal(0, 0.04)) * N * S
        top = rng.uniform(0.25, 0.42) * N * S
        lean = rng.normal(0, 0.05) * N * S
        blade(dc, dh, rng, x, base, base - top, lean, 9 * S, (0.08, 0.2, 0.06), (0.2, 0.42, 0.12), S, 0.6)
        cx, cy = x + lean, top
        for p in range(petals):
            a = 2 * math.pi * p / petals + rng.uniform(-0.15, 0.15)
            l = petal_len * S * rng.uniform(0.85, 1.1)
            px, py = cx + math.cos(a) * l * 0.55, cy + math.sin(a) * l * 0.45
            box = [px - l * 0.55, py - petal_w * S, px + l * 0.55, py + petal_w * S]
            petal = Image.new("RGBA", col.size, (0, 0, 0, 0))
            ImageDraw.Draw(petal).ellipse(box, fill=tuple(int(255 * v * rng.uniform(0.85, 1.05)) for v in petal_color) + (255,))
            petal = petal.rotate(-math.degrees(a), center=(px, py), resample=Image.BICUBIC)
            col.alpha_composite(petal)
            hp = Image.new("L", col.size, 0)
            ImageDraw.Draw(hp).ellipse(box, fill=200)
            hgt.paste(hp.rotate(-math.degrees(a), center=(px, py)), (0, 0), hp.rotate(-math.degrees(a), center=(px, py)))
        r = petal_len * 0.28 * S
        dc.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(255 * v) for v in center_color) + (255,))
        dh.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    finish_sprite(name, col, hgt, rough=0.6)


def dead_bush():
    rng = np.random.default_rng(41)
    S = 2
    col, hgt = supersampled_canvas(S), Image.new("L", (N * S, N * S), 0)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)

    def branch(x, y, ang, length, width, depth):
        if depth > 6 or length < 14 * S:
            return
        ex, ey = x + math.cos(ang) * length, y - math.sin(ang) * length
        shade = rng.uniform(0.8, 1.1)
        dc.line([(x, y), (ex, ey)], fill=(int(96 * shade), int(66 * shade), int(40 * shade), 255), width=int(width))
        dh.line([(x, y), (ex, ey)], fill=int(120 + 18 * depth), width=int(width))
        for _ in range(2 if depth < 5 else 1):
            branch(ex, ey, ang + rng.uniform(-0.7, 0.7), length * rng.uniform(0.55, 0.8), max(2 * S, width * 0.7), depth + 1)

    for _ in range(5):
        branch(N * S * rng.uniform(0.4, 0.6), N * S - 6 * S, math.pi / 2 + rng.uniform(-0.6, 0.6), N * S * 0.22, 14 * S, 0)
    finish_sprite("DeadBush", col, hgt, rough=0.85)


def glowcap():
    """Bioluminescent cave mushrooms: caps and gill spots emit."""
    rng = np.random.default_rng(53)
    S = 2
    col, hgt = supersampled_canvas(S), Image.new("L", (N * S, N * S), 0)
    emi = Image.new("L", (N * S, N * S), 0)
    dc, dh, de = ImageDraw.Draw(col), ImageDraw.Draw(hgt), ImageDraw.Draw(emi)
    base = N * S - 6 * S
    for i in range(5):
        x = (0.18 + 0.64 * i / 4 + rng.normal(0, 0.03)) * N * S
        h = rng.uniform(0.12, 0.34) * N * S
        w = rng.uniform(44, 64) * S
        dc.rectangle([x - w / 2, base - h, x + w / 2, base], fill=(210, 220, 200, 255))
        dh.rectangle([x - w / 2, base - h, x + w / 2, base], fill=140)
        cw, ch = rng.uniform(170, 250) * S, rng.uniform(120, 170) * S
        cy = base - h
        # domed cap: stacked ellipses from the rim upward give a rounded silhouette and height
        for k in range(12):
            t = k / 11
            ww, hh = cw * (1 - 0.55 * t * t), ch * 0.5 * (1 - t)
            yc = cy - ch * 0.45 * t
            box = [x - ww / 2, yc - hh, x + ww / 2, yc + hh * 0.35]
            shade = 0.75 + 0.25 * t
            dc.ellipse(box, fill=(int(40 * shade), int(190 * shade), int(200 * shade), 255))
            dh.ellipse(box, fill=int(150 + 100 * t))
            de.ellipse(box, fill=int(110 + 60 * t))
        for _ in range(9):   # bright spots
            sx = x + rng.uniform(-0.38, 0.38) * cw
            sy = cy - rng.uniform(0.1, 0.55) * ch
            r = rng.uniform(6, 14) * S
            dc.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(190, 255, 245, 255))
            de.ellipse([sx - r, sy - r, sx + r, sy + r], fill=255)
        dc.rectangle([x - cw / 2 + 8 * S, cy - 4 * S, x + cw / 2 - 8 * S, cy + 8 * S], fill=(120, 250, 235, 255))
        de.rectangle([x - cw / 2 + 8 * S, cy - 4 * S, x + cw / 2 - 8 * S, cy + 8 * S], fill=255)
    e = np.asarray(emi.resize((N, N), Image.LANCZOS)).astype(np.float32) / 255.0
    finish_sprite("Glowcap", col, hgt, rough=0.45, emission=blur_wrap(e, 1.0))


def finish_sprite(name, col, hgt, rough, emission=None):
    c = downsample(col)
    h = np.asarray(hgt.resize((N, N), Image.LANCZOS)).astype(np.float32) / 255.0
    h = blur_wrap(h, 1.5)
    opacity = (c[..., 3] > 0.5).astype(np.float32)
    rgb = c[..., :3] / np.maximum(c[..., 3:4], 1e-3)
    # bleed colour into transparent texels so mips don't pull in black fringes
    bleed = blur_wrap(rgb * opacity[..., None], 6) / np.maximum(blur_wrap(opacity, 6)[..., None], 1e-3)
    rgb = np.where(opacity[..., None] > 0, rgb, np.clip(bleed, 0, 1))
    # keep a transparent frame so the repeat-wrapped mips don't bleed the base row into the top
    opacity[:4, :] = 0; opacity[:, :4] = 0; opacity[:, -4:] = 0
    ao = np.clip(0.45 + 0.55 * (1 - np.linspace(1, 0, N))[:, None] * np.ones((1, N)), 0, 1)   # darker near the ground
    save(name, rgb, normal_from_height(h, 5.0, wrap=False), np.full((N, N), rough), ao, h, opacity, emission=emission)


# ----------------------------------------------------------------------------- solid blocks

def cactus():
    rng = np.random.default_rng(61)
    u = np.linspace(0, 1, N, endpoint=False)[None, :] * np.ones((N, 1))
    ribs = 0.5 + 0.5 * np.cos(u * 2 * math.pi * 8)
    n = tile_noise(rng, scale=40)
    h = ribs * 0.8 + n * 0.2
    col = np.stack([0.12 + 0.12 * ribs, 0.3 + 0.2 * ribs, 0.12 + 0.06 * ribs], -1) * (0.85 + 0.3 * n[..., None])
    # areoles with spines along rib crests
    img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    hi = Image.fromarray((h * 255).astype(np.uint8))
    dh = ImageDraw.Draw(hi)
    for k in range(8):
        cx = (k + 0.0) / 8 * N
        for j in range(10):
            cy = (j + 0.5 * (k % 2)) / 10 * N
            d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(215, 205, 160))
            dh.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=255)
            for s in range(4):
                a = rng.uniform(0, 2 * math.pi)
                d.line([cx, cy, cx + math.cos(a) * 22, cy + math.sin(a) * 22], fill=(235, 225, 190), width=2)
    col = np.asarray(img).astype(np.float32) / 255
    h = np.asarray(hi).astype(np.float32) / 255
    save("Cactus", col, normal_from_height(blur_wrap(h, 1.5), 5.0), 0.45 + 0.3 * (1 - ribs), None, h)

    # top: ribs converge on the centre
    yy, xx = np.mgrid[0:N, 0:N] / N - 0.5
    ang = np.arctan2(yy, xx)
    r = np.sqrt(xx * xx + yy * yy)
    ribs_t = 0.5 + 0.5 * np.cos(ang * 8)
    ht = np.clip(ribs_t * 0.6 + (0.5 - r) * 0.8, 0, 1)
    colt = np.stack([0.14 + 0.1 * ribs_t, 0.34 + 0.18 * ribs_t, 0.13 + 0.05 * ribs_t], -1) * (0.9 + 0.2 * tile_noise(rng, scale=30)[..., None])
    save("CactusTop", colt, normal_from_height(ht, 4.0), np.full((N, N), 0.55), None, ht)


def torch():
    """Side: wood stick with charred band and glowing ember at the top of the (5/8-high) torch.
    Top: glowing ember. Sampled via world projection, so v == local block height."""
    rng = np.random.default_rng(71)
    v = np.linspace(1, 0, N)[:, None] * np.ones((1, N))          # row 0 is the top (v = 1)
    grain = tile_noise(rng, scale=6, octaves=3)
    streak = blur_wrap(rng.random((N, N)).astype(np.float32), 0.5)
    streak = np.repeat(streak[:1, :], N, 0) * 0.5 + grain * 0.5
    wood = np.stack([0.42, 0.27, 0.14]) * (0.75 + 0.5 * streak[..., None])
    char = np.stack([0.06, 0.05, 0.045]) * np.ones((N, N, 3))
    ember = np.stack([1.0, 0.62, 0.22]) * (0.85 + 0.3 * grain[..., None])
    t_char = np.clip((v - 0.50) / 0.03, 0, 1)[..., None]
    t_ember = np.clip((v - 0.575) / 0.02, 0, 1)[..., None]
    col = wood * (1 - t_char) + char * t_char
    col = col * (1 - t_ember) + ember * t_ember
    emission = np.clip((v - 0.56) / 0.04, 0, 1) * (0.7 + 0.3 * grain)
    h = streak * 0.6 + t_ember[..., 0] * 0.3
    rough = np.where(v > 0.56, 0.9, 0.7)
    save("Torch", col, normal_from_height(h, 3.0, wrap=False), rough, None, h, emission=emission)

    g = tile_noise(rng, scale=10)
    top = np.stack([np.ones_like(g), 0.55 + 0.25 * g, 0.18 + 0.1 * g], -1)
    save("TorchTop", top, normal_from_height(g, 2.0), np.full((N, N), 0.9), None, g, emission=0.8 + 0.2 * g)


def ores():
    base_c = load("Rock058", "Color")
    base_n = load("Rock058", "NormalGL") * 2 - 1
    base_r = load("Rock058", "Roughness", mode="L")
    base_h = load("Rock058", "Displacement", mode="L")
    base_ao = load("Rock058", "AmbientOcclusion", mode="L")
    specs = [
        # name, seed, blob count, blob size px, colour, colour var, roughness, metal, facet strength
        ("CoalOre", 81, 26, 38, (0.035, 0.033, 0.032), 0.2, 0.35, 0.0, 6.0),
        ("IronOre", 82, 22, 30, (0.66, 0.44, 0.30), 0.25, 0.62, 0.15, 5.0),
        ("GoldOre", 83, 20, 24, (1.0, 0.77, 0.33), 0.12, 0.28, 1.0, 7.0),
        ("DiamondOre", 84, 14, 22, (0.45, 0.93, 0.95), 0.1, 0.06, 0.0, 10.0),
    ]
    yy, xx = np.mgrid[0:N, 0:N]
    for name, seed, count, size, colour, var, rough, metal, facet in specs:
        rng = np.random.default_rng(seed)
        field = np.zeros((N, N), np.float32)
        crystal_id = np.zeros((N, N), np.float32)
        for k in range(count):
            cx, cy = rng.uniform(0, N), rng.uniform(0, N)
            # clusters: a few sub-blobs around each centre
            for s in range(rng.integers(3, 7)):
                px, py = cx + rng.normal(0, size * 0.9), cy + rng.normal(0, size * 0.9)
                r = size * rng.uniform(0.35, 0.8)
                dx = (xx - px + N / 2) % N - N / 2
                dy = (yy - py + N / 2) % N - N / 2
                blob = np.exp(-(dx * dx + dy * dy) / (2 * r * r))
                crystal_id = np.where(blob > field, rng.random(), crystal_id)
                field = np.maximum(field, blob)
        noise = tile_noise(rng, scale=5, octaves=2)
        mask = np.clip((field + (noise - 0.5) * 0.5 - 0.45) * 8, 0, 1)
        tone = 1 + (crystal_id - 0.5) * var * 2
        col = base_c * (1 - mask[..., None]) + (np.array(colour) * tone[..., None]) * mask[..., None]
        col = col * (1 - 0.35 * np.clip((field - 0.25) * 4, 0, 1) * (1 - mask))[..., None]  # darker halo in host rock
        # faceted crystals: per-crystal flat normal tilt plus a raised rim
        ang = crystal_id * 2 * math.pi
        facet_n = np.stack([np.cos(ang) * 0.35, np.sin(ang) * 0.35, np.ones_like(ang)], -1)
        facet_n /= np.linalg.norm(facet_n, axis=-1, keepdims=True)
        rim_n = normal_from_height(blur_wrap(mask, 1.5), facet)
        ore_n = facet_n + rim_n - np.array([0, 0, 1])
        n = base_n * (1 - mask[..., None]) + ore_n * mask[..., None]
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        r = base_r * (1 - mask) + rough * mask
        m = metal * mask
        h = np.clip(base_h * (1 - mask) + (0.65 + 0.2 * crystal_id) * mask, 0, 1)
        save(name, col, n, r, base_ao, h, metal=m)


def log_top():
    """Tree rings: centre crop of the round TreeEnd002 scan so rings fill the whole face."""
    for suffix, mode in (("Color", "RGB"), ("NormalGL", "RGB"), ("Roughness", "L"), ("AmbientOcclusion", "L"), ("Displacement", "L")):
        files = list((SCANS / "TreeEnd002").glob(f"*_{suffix}.*"))
        if not files:
            continue
        im = Image.open(files[0]).convert(mode)
        w, h = im.size
        c = int(min(w, h) * 0.58)
        box = ((w - c) // 2, (h - c) // 2, (w + c) // 2, (h + c) // 2)
        im = im.crop(box).resize((N, N), Image.LANCZOS)
        d = OUT / "LogTop"
        d.mkdir(parents=True, exist_ok=True)
        im.save(d / f"LogTop_{suffix}.png", optimize=True)
    print("  LogTop")


GENERATORS = {
    "Leaves": leaves,
    "Needles": needles,
    "GrassTuft": grass_tuft,
    "FlowerRed": lambda: flower("FlowerRed", (0.78, 0.07, 0.05), (0.08, 0.06, 0.05), 5, 120, 46, 91),
    "FlowerYellow": lambda: flower("FlowerYellow", (1.0, 0.78, 0.12), (0.85, 0.55, 0.05), 22, 70, 9, 92, stems=4),
    "DeadBush": dead_bush,
    "Glowcap": glowcap,
    "Cactus": cactus,
    "Torch": torch,
    "Ores": ores,
    "LogTop": log_top,
}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(GENERATORS)
    for key in wanted:
        GENERATORS[key]()
