"""Cave formations: stalactites (hang from ceilings) and stalagmites (grow from floors).

Each is a lathe along a gently bent axis: a tapering profile with a flared root, calcite growth bands and
drip bulges, plus per-angle noise so the cross-section isn't round. Clusters add one or two smaller spikes
sharing the root. The root extends 0.1 m into the supporting block so there is never a gap at the joint.
"""

import math
import random

import bpy  # noqa: F401
import bmesh
from mathutils import Vector

from . import common as C
from .asset import Asset, Slot

ROOT_EMBED = 0.1


def _spike(bm, rng, off, length, radius, hang, base=Vector(), segments=48, rings=96):
    """One formation along -Z (hang) or +Z; radius is at the root."""
    bend = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * length * rng.uniform(0.02, 0.07)
    phase = rng.uniform(0, 6.28)
    bands = rng.uniform(5, 9)
    sign = -1.0 if hang else 1.0
    profile = []
    for i in range(rings + 1):
        t = i / rings
        # stalactites end in a drip point; stalagmites in a rounded dome
        taper = (1.0 - t) ** 1.25 if hang else (1.0 - t ** 2.4) ** 0.55
        r = radius * taper
        r *= 1.0 + 0.9 * math.exp(-t * 14.0)                      # flared root
        r *= 1.0 + 0.06 * math.sin(t * bands * math.pi + phase)   # growth bands
        r *= 1.0 + 0.1 * max(0.0, C.fbm(Vector((t * 6.0, 0, 0)) + off, 2))  # drip bulges
        z = sign * (t * length) - sign * ROOT_EMBED * (1.0 - t)
        profile.append((max(r, 0.004), z, t))

    ring_pts = []
    for r, z, t in profile:
        centre = base + Vector((0, 0, z)) + bend * (t * t)
        ring = []
        for s in range(segments):
            a = 2 * math.pi * s / segments
            d = Vector((math.cos(a), math.sin(a), 0))
            k = 1.0 + 0.12 * C.fbm(d * 1.4 + Vector((0, 0, t * 3.0)) + off, 3)
            ring.append(centre + d * r * k)
        ring_pts.append(ring)

    vrings, faces = C.bm_from_rings(bm, ring_pts, close_bottom=True, close_top=True)
    if hang:
        # rings run root (top) to tip (bottom): flip so normals point outward
        bmesh.ops.reverse_faces(bm, faces=faces)
    return [v for ring in vrings for v in ring]


def _detail(bm, off, amount):
    bm.normal_update()
    off2 = off + Vector((17.3, -8.8, 3.3))
    for v in bm.verts:
        p = v.co
        d = 0.012 * C.fbm(p * 9.0 + off2, 3) + 0.006 * math.sin(p.z * 45.0 + 4.0 * C.fbm(p * 2.0 + off, 2))
        v.co = p + v.normal * d * amount


def formation(seed, variant, hang):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    lengths = [0.7, 1.2, 1.9, 2.8] if hang else [0.5, 0.9, 1.5, 2.2]
    length = lengths[variant % len(lengths)] * rng.uniform(0.92, 1.08)
    radius = (0.08 + 0.065 * length) if hang else (0.12 + 0.09 * length)
    bm = bmesh.new()
    _spike(bm, rng, off, length, radius, hang)
    extra = rng.randint(0, 2) if variant % 2 == 0 else rng.randint(1, 2)
    for i in range(extra):
        a = rng.uniform(0, 2 * math.pi)
        d = radius * rng.uniform(0.9, 1.5)
        base = Vector((math.cos(a) * d, math.sin(a) * d, 0))
        _spike(bm, rng, C.seed_offset(seed, i + 7), length * rng.uniform(0.3, 0.6), radius * rng.uniform(0.4, 0.6),
               hang, base=base, segments=24, rings=48)
    _detail(bm, off, 1.0)
    kind = "Cave_Stalactite" if hang else "Cave_Stalagmite"
    name = f"{kind}_{variant:02d}"
    high = C.object_from_bmesh(name + "_high", bm)
    bm.free()
    return Asset(
        name=name, kind=kind, variant=variant, category="Cave", high=high,
        lod_tris=[380, 150, 48], bake_size=256, hang=hang,
        # flowstone: the sandstone scan brightened toward calcite, and wet
        slots=[Slot("Rock", layer="Sandstone", mapping="triplanar", tiling=0.7, tint=(1.05, 1.02, 0.97),
                    roughness=0.6)],
        notes={"length": round(length, 3)},
    )


def stalactite(seed, variant):
    return formation(seed, variant, hang=True)


def stalagmite(seed, variant):
    return formation(seed, variant, hang=False)


GENERATORS = [
    ("Cave_Stalactite", stalactite, 4),
    ("Cave_Stalagmite", stalagmite, 4),
]
