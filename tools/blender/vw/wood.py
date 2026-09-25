"""Wood: dead trees (snags), stumps and fallen logs.

Branches are grown as polylines (noise-driven wobble, a slight pull toward the light, taper to a quarter of
the start radius) and child branches split off at 35-65 degrees. Each polyline is swept into a tube with
bark UVs in metres. Broken tips and saw cuts are capped; cut faces use the end-grain material. Roots flare
out and dive under the ground so the trunk never floats.

Slots: 0 Bark (a log layer mapped by UVTile), 1 EndGrain (the log-top ring scan, one ring per cap).
"""

import math
import random

import bpy  # noqa: F401
import bmesh
from mathutils import Matrix, Vector

from . import common as C
from .asset import Asset, Slot

BARK_TILING = 1.0 / 1.5     # log layers repeat every 1.5 blocks on terrain; match that on props


def _slots(layer, tint=(1.0, 1.0, 1.0)):
    return [Slot("Bark", layer=layer, mapping="uv", tiling=BARK_TILING, tint=tint, moss=0.35, roughness=1.1),
            Slot("EndGrain", layer="LogTop", mapping="uv", tiling=1.0, tint=tint)]


def _bark_noise(off, ridges):
    def f(p, ang, t):
        k = 1.0 + 0.035 * math.sin(ang * ridges + 3.0 * C.fbm(p * 0.9 + off, 2))
        return k * (1.0 + 0.05 * C.fbm(p * 1.7 + off, 2))
    return f


def _grow(rng, off, start, direction, length, radius, depth, max_depth, out, step=0.28):
    n = max(3, int(length / step))
    pts, radii = [start.copy()], [radius]
    d = direction.normalized()
    up = Vector((0, 0, 1))
    for i in range(1, n + 1):
        t = i / n
        p = pts[-1]
        wobble = Vector((C.fbm(p * 0.7 + off, 2), C.fbm(p * 0.7 + off + Vector((9.1, 0, 0)), 2),
                         0.4 * C.fbm(p * 0.7 + off + Vector((0, 7.7, 0)), 2)))
        d = (d + wobble * 0.35 + up * (0.06 if depth > 0 else 0.02)).normalized()
        pts.append(p + d * (length / n))
        radii.append(radius * (1.0 - 0.75 * t))
    out.append((pts, radii, depth))
    if depth >= max_depth:
        return
    children = rng.randint(2, 4) if depth == 0 else rng.randint(1, 3)
    for c in range(children):
        t = rng.uniform(0.35, 0.9) if depth == 0 else rng.uniform(0.3, 0.8)
        i = min(n - 1, max(1, int(t * n)))
        parent_dir = (pts[i + 1] - pts[i]).normalized()
        side = parent_dir.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 0.2))))
        if side.length < 1e-3:
            side = parent_dir.orthogonal()
        ang = math.radians(rng.uniform(35, 65))
        child_dir = Matrix.Rotation(ang, 3, side.normalized()) @ parent_dir
        child_len = length * (1.0 - t) * rng.uniform(0.6, 0.95) + 0.3
        _grow(rng, off + Vector((c * 13.1, depth * 5.3, 0)), pts[i], child_dir, child_len, radii[i] * 0.62,
              depth + 1, max_depth, out, step * 0.85)


def _roots(rng, base_radius, count, top_z=0.35, reach=(3.0, 4.5), dive=0.3):
    roots = []
    a0 = rng.uniform(0, 2 * math.pi)
    for i in range(count):
        a = a0 + 2 * math.pi * i / count + rng.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        length = base_radius * rng.uniform(*reach)
        pts = []
        for k in range(6):
            t = k / 5
            pts.append(d * (base_radius * 0.45 + length * t) + Vector((0, 0, top_z - (top_z + dive) * t ** 1.6)))
        radii = [base_radius * 0.5 * (1.0 - 0.8 * (k / 5)) for k in range(6)]
        roots.append((pts, radii))
    return roots


def _assign(faces, index):
    for f in faces:
        f.material_index = index


def dead_tree(seed, variant):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    height = rng.uniform(3.2, 5.6)
    r0 = rng.uniform(0.15, 0.22)
    lean = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 1.0))
    branches = []
    _grow(rng, off, Vector((0, 0, -0.25)), lean, height, r0, 0, 2, branches, step=0.3)
    bm = bmesh.new()
    noise_fn = _bark_noise(off, 9)
    for pts, radii, depth in branches:
        segs = 12 if depth == 0 else (8 if depth == 1 else 6)
        if depth == 0:
            # trunk flare near the ground
            radii = [r * (1.0 + 0.45 * math.exp(-max(0.0, p.z) * 2.5)) for p, r in zip(pts, radii)]
        _, sides, caps = C.tube(bm, pts, radii, segs, cap_end=True, ring_noise=noise_fn)
        _assign(sides, 0)
        _assign(caps, 1 if depth == 0 else 0)   # the snapped trunk top shows end grain
    for pts, radii in _roots(rng, r0, rng.randint(4, 5)):
        _, sides, caps = C.tube(bm, pts, radii, 6, cap_end=True, ring_noise=noise_fn)
        _assign(sides, 0)
        _assign(caps, 0)
    low = C.object_from_bmesh(f"Tree_Dead_{variant:02d}", bm)
    bm.free()
    C.set_material_slots(low, ["Bark", "EndGrain"])
    return Asset(
        name=f"Tree_Dead_{variant:02d}", kind="Tree_Dead", variant=variant, category="Wood",
        low=low, lod_tris=[1800, 650, 220], bake_size=512,
        slots=_slots("OakLog", tint=(0.92, 0.9, 0.86)),
        notes={"height": round(height, 3)},
    )


def stump(seed, variant):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    r0 = rng.uniform(0.26, 0.34)
    h = rng.uniform(0.45, 0.8)
    pts = [Vector((0, 0, -0.25 + (h + 0.25) * k / 6)) for k in range(7)]
    radii = [r0 * (1.0 + 0.5 * math.exp(-max(0.0, p.z) * 4.0)) for p in pts]
    bm = bmesh.new()
    noise_fn = _bark_noise(off, 11)
    _, sides, caps = C.tube(bm, pts, radii, 16, cap_end=True, ring_noise=noise_fn)
    _assign(sides, 0)
    _assign(caps, 1)
    for rp, rr in _roots(rng, r0, rng.randint(5, 6), top_z=0.32, reach=(1.5, 2.2), dive=0.22):
        _, sides, caps = C.tube(bm, rp, rr, 7, cap_end=True, ring_noise=noise_fn)
        _assign(sides, 0)
        _assign(caps, 0)
    layer = "OakLog" if variant % 2 == 0 else "SpruceLog"
    low = C.object_from_bmesh(f"Tree_Stump_{variant:02d}", bm)
    bm.free()
    C.set_material_slots(low, ["Bark", "EndGrain"])
    return Asset(
        name=f"Tree_Stump_{variant:02d}", kind="Tree_Stump", variant=variant, category="Wood",
        low=low, lod_tris=[900, 320, 100], bake_size=256, slots=_slots(layer),
        notes={"height": round(h, 3)},
    )


def fallen_log(seed, variant):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    length = rng.uniform(3.0, 3.8)
    r0 = rng.uniform(0.22, 0.3)
    n = 14
    bow = rng.uniform(-0.12, 0.12)
    pts = []
    for k in range(n + 1):
        t = k / n
        x = -length / 2 + length * t
        pts.append(Vector((x, bow * math.sin(t * math.pi), r0 * 0.85 - 0.04 * math.sin(t * math.pi))))
    radii = [r0 * (1.0 - 0.12 * t) for t in (k / n for k in range(n + 1))]
    bm = bmesh.new()
    noise_fn = _bark_noise(off, 10)
    _, sides, caps = C.tube(bm, pts, radii, 14, cap_start=True, cap_end=True, ring_noise=noise_fn)
    _assign(sides, 0)
    _assign(caps, 1)
    # a couple of snapped side branches
    for i in range(rng.randint(1, 3)):
        k = rng.randint(3, n - 3)
        side = Vector((0, rng.choice((-1, 1)), rng.uniform(0.3, 1.0))).normalized()
        start = pts[k]
        blen = rng.uniform(0.3, 0.7)
        bp = [start + side * (blen * j / 3) for j in range(4)]
        br = [radii[k] * 0.35 * (1.0 - 0.4 * j / 3) for j in range(4)]
        _, s2, c2 = C.tube(bm, bp, br, 6, cap_end=True)
        _assign(s2, 0)
        _assign(c2, 1)
    layer = "OakLog" if variant % 2 == 0 else "BirchLog"
    low = C.object_from_bmesh(f"Tree_FallenLog_{variant:02d}", bm)
    bm.free()
    C.set_material_slots(low, ["Bark", "EndGrain"])
    return Asset(
        name=f"Tree_FallenLog_{variant:02d}", kind="Tree_FallenLog", variant=variant, category="Wood",
        low=low, lod_tris=[1100, 400, 120], bake_size=512, slots=_slots(layer),
        notes={"length": round(length, 3), "axis": "x"},
    )


GENERATORS = [
    ("Tree_Dead", dead_tree, 3),
    ("Tree_Stump", stump, 2),
    ("Tree_FallenLog", fallen_log, 2),
]
