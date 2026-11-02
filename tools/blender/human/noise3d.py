"""Vectorised 3D noise for texel point clouds (positions in mm): hashed value noise and Worley cells."""
from __future__ import annotations

import numpy as np

OFFS = np.array([(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)], np.int64)


def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = h & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x7FEB352D) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 0x846CA68B) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def _u01(h):
    return (h & 0xFFFFFF).astype(np.float64) / float(0x1000000)


def value(P, scale, seed=0):
    """Smooth value noise in [-1, 1]; P (N,3) mm, scale = feature size in mm."""
    Q = P / scale
    i = np.floor(Q).astype(np.int64)
    f = Q - i
    w = f * f * (3 - 2 * f)
    out = np.zeros(len(P))
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = _u01(_hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)) * 2 - 1
                wx = w[:, 0] if dx else 1 - w[:, 0]
                wy = w[:, 1] if dy else 1 - w[:, 1]
                wz = w[:, 2] if dz else 1 - w[:, 2]
                out += h * wx * wy * wz
    return out


def fbm(P, scale, octaves=4, seed=0, gain=0.5, lac=2.03):
    out = np.zeros(len(P))
    amp, s, norm = 1.0, scale, 0.0
    for o in range(octaves):
        out += amp * value(P, s, seed + o * 101)
        norm += amp
        amp *= gain
        s /= lac
    return out / norm


def worley(P, cell, seed=0, jitter=0.9, seg_dir=None, seg_len=0.0, chunk=1_500_000):
    """Worley noise. Returns F1, F2 (mm), and a per-feature random value in [0,1) for the nearest point.

    seg_dir (N,3) unit + seg_len (mm or per-point array): distance to a short segment starting at each
    feature point instead (used for stubble / hair strokes).
    """
    N = len(P)
    F1 = np.empty(N)
    F2 = np.empty(N)
    R1 = np.empty(N)
    for s0 in range(0, N, chunk):
        s1 = min(N, s0 + chunk)
        Q = P[s0:s1] / cell
        base = np.floor(Q).astype(np.int64)
        b1 = np.full(s1 - s0, np.inf)
        b2 = np.full(s1 - s0, np.inf)
        r1 = np.zeros(s1 - s0)
        sd = None if seg_dir is None else seg_dir[s0:s1]
        sl = seg_len[s0:s1] / cell if isinstance(seg_len, np.ndarray) else seg_len / cell
        for o in OFFS:
            c = base + o
            h = _hash(c[:, 0], c[:, 1], c[:, 2], seed)
            jx = _u01(h)
            jy = _u01(_hash(c[:, 0], c[:, 1], c[:, 2], seed + 17))
            jz = _u01(_hash(c[:, 0], c[:, 1], c[:, 2], seed + 31))
            fp = c + 0.5 + jitter * (np.stack([jx, jy, jz], 1) - 0.5)
            d = Q - fp
            if sd is not None:
                t = np.clip((d * sd).sum(1), 0.0, sl)
                d = d - sd * t[:, None]
            dist = np.sqrt((d * d).sum(1))
            closer = dist < b1
            b2 = np.where(closer, b1, np.minimum(b2, dist))
            r1 = np.where(closer, _u01(_hash(c[:, 0], c[:, 1], c[:, 2], seed + 57)), r1)
            b1 = np.where(closer, dist, b1)
        F1[s0:s1] = b1 * cell
        F2[s0:s1] = b2 * cell
        R1[s0:s1] = r1
    return F1, F2, R1


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)
