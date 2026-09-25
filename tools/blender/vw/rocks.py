"""Rocks: pebble clusters, stones and boulders.

Shape: an icosphere displaced into a lumpy ellipsoid, then fractured by a few random planes (vertices beyond
a plane are projected onto it, which leaves flat, sharp-edged facets like split rock), softened by a light
smoothing pass (the bevel), and finished with fine noise, cracks and faint strata. The high-poly result is
baked onto a decimated game mesh.

Boulders are built around a core: the placement job writes one stone block at the prop's anchor cell, so the
player collides with the boulder like terrain. Boulders are placed at any yaw while the block stays
axis-aligned, so the mesh must enclose every rotation of that 1 m cube about the vertical axis: the cylinder of
radius sqrt(0.5) from z = 0 to 1 above the pivot. enforce_core() guarantees it and check_props.py verifies it
on LOD0 and LOD1. Placement only ever scales boulders up, which keeps the core inside.
"""

import math
import random

import bpy  # noqa: F401  (loads bmesh/mathutils in the standalone module)
import bmesh
from mathutils import Vector

from . import common as C
from .asset import Asset, Slot

CORE_CENTRE = Vector((0.0, 0.0, 0.5))
CORE_RADIUS = math.sqrt(0.5)
CORE_HALF_HEIGHT = 0.5
CORE_MARGIN = 0.07


def _rock_bmesh(bm, rng, off, radii, subdiv, planes, detail, centre=Vector()):
    """Adds one fractured rock to bm. radii = (rx, ry, rz) of the lumpy ellipsoid around centre."""
    geom = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    verts = geom["verts"]
    rx, ry, rz = radii
    off2 = off + Vector((31.7, -12.3, 7.1))
    for v in verts:
        d = v.co.normalized()
        r = 1.0 + 0.2 * C.fbm(d * 1.2 + off, 3) + 0.07 * C.fbm(d * 3.3 + off2, 3)
        v.co = Vector((d.x * rx, d.y * ry, d.z * rz)) * r

    # fracture planes: mostly steep side faces plus the odd sloping top, cut at 70-90% of the extent
    for _ in range(planes):
        a = rng.uniform(0, 2 * math.pi)
        tilt = rng.uniform(-0.25, 0.7)
        n = Vector((math.cos(a), math.sin(a), tilt)).normalized()
        support = max(v.co.dot(n) for v in verts)
        o = support * rng.uniform(0.7, 0.9)
        for v in verts:
            h = v.co.dot(n) - o
            if h > 0:
                v.co -= n * h

    # the bevel: a light smoothing pass rounds the fracture edges without losing the facets
    bmesh.ops.smooth_vert(bm, verts=verts, factor=0.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()

    size = min(rx, ry, rz)
    off3 = off + Vector((-71.3, 44.9, 13.7))
    off4 = off + Vector((5.5, 91.1, -38.2))
    strata_dir = Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 1.0)).normalized()
    for v in verts:
        p = v.co
        disp = 0.035 * C.fbm(p * (4.0 / max(size, 0.2)) + off3, 4)
        crack = C.smoothstep(0.9, 0.99, C.ridged(p * (1.8 / max(size, 0.2)) + off4, 3))
        strata = math.sin(p.dot(strata_dir) * 22.0 + 2.5 * C.fbm(p * 1.3 + off, 2))
        disp += -0.03 * crack + 0.006 * strata
        v.co = p + v.normal * disp * detail
    for v in verts:
        v.co += centre
    return verts


def _flatten_bottom(bm, z):
    for v in bm.verts:
        if v.co.z < z:
            v.co.z = z


def enforce_core(obj_or_bm, margin=CORE_MARGIN):
    """Pushes any vertex that lies inside the core cylinder (plus margin) out to it, radially from its
    centre. The rock is star-shaped around the core centre, so this makes the mesh enclose the cylinder."""
    verts = obj_or_bm.verts if isinstance(obj_or_bm, bmesh.types.BMesh) else obj_or_bm.data.vertices
    pushed = 0
    for v in verts:
        d = v.co - CORE_CENTRE
        L = d.length
        if L < 1e-6:
            continue
        u = d / L
        horizontal = math.hypot(u.x, u.y)
        t = min(CORE_RADIUS / max(horizontal, 1e-9), CORE_HALF_HEIGHT / max(abs(u.z), 1e-9))
        need = t + margin
        if L < need:
            v.co = CORE_CENTRE + u * need
            pushed += 1
    return pushed


def boulder(seed, variant):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    rx = rng.uniform(1.05, 1.3)
    ry = rng.uniform(0.95, 1.2)
    rz = rng.uniform(0.85, 1.0)
    bm = bmesh.new()
    lift = rz * rng.uniform(0.62, 0.72)          # about a fifth to a third sits below ground
    _rock_bmesh(bm, rng, off, (rx, ry, rz), 7, rng.randint(4, 6), 1.3, centre=Vector((0, 0, lift)))
    _flatten_bottom(bm, -0.35)
    pushed = enforce_core(bm)
    high = C.object_from_bmesh(f"Rock_Boulder_{variant:02d}_high", bm)
    bm.free()
    return Asset(
        name=f"Rock_Boulder_{variant:02d}", kind="Rock_Boulder", variant=variant, category="Rocks",
        high=high, lod_tris=[1400, 520, 160], bake_size=512,
        slots=[Slot("Rock", layer="Stone", mapping="triplanar", tiling=0.45, moss=0.55)],
        core=True, notes={"coreVerticesPushed": pushed},
    )


def stone(seed, variant):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    rx = rng.uniform(0.32, 0.55)
    ry = rng.uniform(0.28, 0.5)
    rz = rng.uniform(0.2, 0.36)
    bm = bmesh.new()
    _rock_bmesh(bm, rng, off, (rx, ry, rz), 6, rng.randint(3, 5), 0.55, centre=Vector((0, 0, rz * 0.55)))
    _flatten_bottom(bm, -0.12)
    high = C.object_from_bmesh(f"Rock_Stone_{variant:02d}_high", bm)
    bm.free()
    return Asset(
        name=f"Rock_Stone_{variant:02d}", kind="Rock_Stone", variant=variant, category="Rocks",
        high=high, lod_tris=[560, 200, 60], bake_size=256,
        slots=[Slot("Rock", layer="Stone", mapping="triplanar", tiling=0.45, moss=0.45)],
    )


def pebbles(seed, variant):
    rng = random.Random(seed)
    bm = bmesh.new()
    count = rng.randint(4, 7)
    placed = []
    for i in range(count):
        r = rng.uniform(0.07, 0.2) if i else rng.uniform(0.16, 0.24)
        for _ in range(40):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0.0, 0.45) if i else 0.0
            c = Vector((math.cos(a) * d, math.sin(a) * d, 0))
            if all((c - p).length > (r + pr) * 0.8 for p, pr in placed):
                break
        placed.append((c, r))
        rr = (r * rng.uniform(0.9, 1.3), r * rng.uniform(0.8, 1.1), r * rng.uniform(0.5, 0.75))
        c.z = rr[2] * 0.45
        _rock_bmesh(bm, rng, C.seed_offset(seed, i + 1), rr, 4, rng.randint(2, 4), 0.25, centre=c)
    _flatten_bottom(bm, -0.06)
    high = C.object_from_bmesh(f"Rock_Pebbles_{variant:02d}_high", bm)
    bm.free()
    return Asset(
        name=f"Rock_Pebbles_{variant:02d}", kind="Rock_Pebbles", variant=variant, category="Rocks",
        high=high, lod_tris=[420, 160, 48], bake_size=256,
        slots=[Slot("Rock", layer="Stone", mapping="triplanar", tiling=0.6, moss=0.2)],
    )


GENERATORS = [
    ("Rock_Pebbles", pebbles, 4),
    ("Rock_Stone", stone, 4),
    ("Rock_Boulder", boulder, 4),
]
