"""Numpy noise and drawing helpers for procedural texture generation (deterministic by seed)."""
from __future__ import annotations

import numpy as np


def spectral(shape, beta=2.0, seed=0, lo=0.0, hi=None):
    """Tileable 1/f^beta noise via FFT filtering. Returns zero-mean, unit-std array.

    lo/hi: band-pass limits in cycles per image (hi None = Nyquist).
    """
    rng = np.random.default_rng(seed)
    h, w = shape
    white = rng.standard_normal((h, w))
    F = np.fft.rfft2(white)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.rfftfreq(w)[None, :] * w
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    if lo > 0:
        amp *= 1.0 / (1.0 + (lo / f) ** 8)
    if hi is not None:
        amp *= 1.0 / (1.0 + (f / hi) ** 8)
    amp[0, 0] = 0.0
    out = np.fft.irfft2(F * amp, s=(h, w))
    out -= out.mean()
    s = out.std()
    return out / s if s > 0 else out


def aniso(shape, sx, sy, seed=0, beta=2.0):
    """Anisotropic tileable noise: frequencies along x scaled by sx, along y by sy (sx>sy -> streaks along y)."""
    rng = np.random.default_rng(seed)
    h, w = shape
    white = rng.standard_normal((h, w))
    F = np.fft.rfft2(white)
    fy = np.fft.fftfreq(h)[:, None] * h / sy
    fx = np.fft.rfftfreq(w)[None, :] * w / sx
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    amp[0, 0] = 0.0
    out = np.fft.irfft2(F * amp, s=(h, w))
    out -= out.mean()
    return out / out.std()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blur(a, sigma, wrap=True):
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(a, sigma, mode="wrap" if wrap else "reflect")


def srgb_to_linear(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def height_to_normal(h, strength=1.0, wrap=False):
    """Tangent-space OpenGL normal (+Y up in texture = +V) from a height map (row 0 = top)."""
    mode = "wrap" if wrap else "edge"
    hp = np.pad(h, 1, mode=mode)
    dx = (hp[1:-1, 2:] - hp[1:-1, :-2]) * 0.5
    dy = (hp[:-2, 1:-1] - hp[2:, 1:-1]) * 0.5     # +V is up (row index decreases)
    nx, ny = -dx * strength, -dy * strength
    nz = np.ones_like(h)
    n = np.stack([nx, ny, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save_png(path, arr, bits=8):
    from PIL import Image
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = np.clip(arr, 0, 1)
    if bits == 16 and a.ndim == 2:
        Image.fromarray((a * 65535 + 0.5).astype(np.uint16)).save(path)
        return
    a = (a * 255 + 0.5).astype(np.uint8)
    if a.ndim == 3 and a.shape[2] == 1:
        a = a[..., 0]
    Image.fromarray(a).save(path, optimize=False, compress_level=6)


def load_png(path):
    from PIL import Image
    im = Image.open(path)
    a = np.asarray(im).astype(np.float64)
    return a / (65535.0 if a.max() > 255 else 255.0)
