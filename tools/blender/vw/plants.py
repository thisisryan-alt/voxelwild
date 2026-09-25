"""Plants: mushroom clusters, grass clumps and flower clumps.

These use vertex colour for albedo (slot mapping "vertex"): the Col attribute holds sRGB colour and, in
alpha, the wind weight (0 at the root, 1 at the tip). For foliage slots UVTile.x is the biome-tint weight:
1 for blades (grass follows the biome palette), 0 for petals.

Blades are too thin to decimate, so grass and flower clumps build their LODs directly: LOD1 keeps every
other blade with half the segments.
"""

import math
import random

import bpy  # noqa: F401
import bmesh
from mathutils import Vector

from . import common as C
from .asset import Asset, Slot


def _finish_colors(obj):
    """Copies the float 'ColF' corner layer (sRGB intent, alpha = wind) into the byte 'Col' attribute."""
    mesh = obj.data
    # read first: adding an attribute reallocates the layers and invalidates references to them
    values = [tuple(c.color) for c in mesh.color_attributes["ColF"].data]
    mesh.color_attributes.remove(mesh.color_attributes["ColF"])
    dst = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    for d, v in zip(dst.data, values):
        d.color_srgb = v
    mesh.color_attributes.active_color = mesh.color_attributes["Col"]


def _layers(bm):
    col = bm.loops.layers.float_color.get("ColF") or bm.loops.layers.float_color.new("ColF")
    uvb = bm.loops.layers.uv.get("UVBake") or bm.loops.layers.uv.new("UVBake")
    uvt = bm.loops.layers.uv.get("UVTile") or bm.loops.layers.uv.new("UVTile")
    return col, uvb, uvt


def _paint(faces, layers, fn):
    """fn(loop) -> (r, g, b, wind, tint)."""
    col, _uvb, uvt = layers
    for f in faces:
        for loop in f.loops:
            r, g, b, a, tint = fn(loop)
            loop[col] = (r, g, b, a)
            loop[uvt].uv = (tint, 0.0)


# ------------------------------------------------------------------ mushrooms


def _mushroom(bm, layers, rng, off, base, height, cap_r, palette, segments=10):
    stem_r = cap_r * rng.uniform(0.22, 0.3)
    lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * height * 0.15
    stem_profile = []
    for k in range(5):
        t = k / 4
        r = stem_r * (1.15 - 0.3 * t + 0.1 * math.sin(t * math.pi))
        stem_profile.append((r, -0.03 + (height + 0.03) * t))
    rings = C.lathe_points(stem_profile, segments)
    rings = [[base + p + lean * ((p.z / height) ** 2) for p in ring] for ring in rings]
    _, stem_faces = C.bm_from_rings(bm, rings, close_bottom=True, close_top=False)
    stem_col, cap_col, spot_col, gill_col = palette
    _paint(stem_faces, layers, lambda l: (*[c * (0.75 + 0.25 * min(1.0, (l.vert.co.z - base.z) / height))
                                          for c in stem_col], 0.0, 0.0))

    top = base + Vector((0, 0, height)) + lean
    dome = rng.uniform(0.45, 0.8)
    cap_profile = [(cap_r * math.cos(a), cap_r * dome * math.sin(a)) for a in
                   (math.pi / 2 * (1 - k / 6) for k in range(7))]
    # rim droops below the stem top; the underside (gills) closes back to the stem
    cap_rings = C.lathe_points([(r, z - cap_r * 0.18) for r, z in reversed(cap_profile)], segments)
    cap_rings = [[top + p for p in ring] for ring in cap_rings]
    under = C.lathe_points([(cap_r * 0.98, -cap_r * 0.2), (stem_r * 1.1, -cap_r * 0.02)], segments)
    under = [[top + p for p in ring] for ring in under]
    _, cap_faces = C.bm_from_rings(bm, cap_rings, close_bottom=False, close_top=True)
    _, under_faces = C.bm_from_rings(bm, under, close_bottom=False, close_top=False)
    bmesh.ops.reverse_faces(bm, faces=cap_faces)
    spots = spot_col is not None

    def cap_fn(loop):
        p = loop.vert.co
        if spots and C.fbm((p - top) * 38.0 + off, 2) > 0.16:
            return (*spot_col, 0.0, 0.0)
        shade = 0.85 + 0.15 * min(1.0, max(0.0, (p.z - top.z) / (cap_r * 0.6)))
        return (*[c * shade for c in cap_col], 0.0, 0.0)
    _paint(cap_faces, layers, cap_fn)
    _paint(under_faces, layers, lambda l: (*gill_col, 0.0, 0.0))


PALETTES = [
    # stem, cap, spots, gills (sRGB)
    ((0.82, 0.76, 0.66), (0.42, 0.27, 0.15), None, (0.55, 0.45, 0.35)),          # brown cluster
    ((0.9, 0.88, 0.8), (0.7, 0.09, 0.05), (0.95, 0.93, 0.86), (0.9, 0.86, 0.76)),  # fly agaric
    ((0.86, 0.84, 0.78), (0.8, 0.72, 0.58), None, (0.5, 0.45, 0.42)),              # pale, tall
]


def mushrooms(seed, variant):
    """Clusters are many tiny shells that collapse-decimation can't reduce, so each LOD is regenerated from the
    same seed with fewer segments."""
    lods = [_mushroom_cluster(seed, variant, segments, lod) for lod, segments in enumerate((10, 6, 4))]
    return Asset(
        name=f"Plant_Mushrooms_{variant:02d}", kind="Plant_Mushrooms", variant=variant, category="Plants",
        lods=lods, bake=False, slots=[Slot("Fungus", mapping="vertex", roughness=0.8)],
    )


def _mushroom_cluster(seed, variant, segments, lod):
    rng = random.Random(seed)
    off = C.seed_offset(seed)
    palette = PALETTES[variant % len(PALETTES)]
    bm = bmesh.new()
    layers = _layers(bm)
    scratch = bmesh.new()
    scratch_layers = _layers(scratch)
    count = {0: rng.randint(5, 7), 1: rng.randint(1, 3), 2: rng.randint(4, 6)}[variant % 3]
    tall = variant % 3 == 2
    placed = []
    for i in range(count):
        size = rng.uniform(0.6, 1.0) if i == 0 else rng.uniform(0.35, 0.8)
        height = (0.22 if tall else 0.12 if variant % 3 == 0 else 0.2) * size
        cap_r = (0.05 if tall else 0.07 if variant % 3 == 0 else 0.1) * size
        for _ in range(30):
            a = rng.uniform(0, 2 * math.pi)
            d = 0.0 if i == 0 else rng.uniform(0.05, 0.22)
            base = Vector((math.cos(a) * d, math.sin(a) * d, 0))
            if all((base - p).length > (cap_r + pr) * 0.9 for p, pr in placed):
                break
        placed.append((base, cap_r))
        # the far LOD keeps only the three largest-first mushrooms (same random stream, so same layout)
        target = (bm, layers) if lod < 2 or i < 3 else (scratch, scratch_layers)
        _mushroom(target[0], target[1], rng, off, base, height, cap_r, palette, segments)
    obj = C.object_from_bmesh(f"Plant_Mushrooms_{variant:02d}_LOD{lod}", bm)
    bm.free()
    scratch.free()
    _finish_colors(obj)
    C.set_material_slots(obj, ["Fungus"])
    return obj


# ------------------------------------------------------------------ grass and flowers


def _blade(bm, layers, rng, base, height, width, segments, colour_base, colour_tip, tint=1.0):
    a = rng.uniform(0, 2 * math.pi)
    out = Vector((math.cos(a), math.sin(a), 0))
    side = Vector((-out.y, out.x, 0))
    bend = rng.uniform(0.15, 0.55)
    twist = rng.uniform(-0.6, 0.6)
    rows = []
    for k in range(segments + 1):
        t = k / segments
        centre = base + out * (bend * height * t * t) + Vector((0, 0, height * t * (1.0 - 0.25 * bend * t)))
        w = width * (1.0 - t ** 1.5) + 0.002
        s = (side * math.cos(twist * t) + out * math.sin(twist * t)) * w * 0.5
        rows.append((bm.verts.new(centre - s), bm.verts.new(centre + s), t))
    faces = []
    for k in range(segments):
        l0, r0, _ = rows[k]
        l1, r1, _ = rows[k + 1]
        faces.append(bm.faces.new((l0, r0, r1, l1)))
    heights = {v: t for l, r, t in rows for v in (l, r)}

    def fn(loop):
        t = heights[loop.vert]
        c = [C.lerp(b, tip, t) for b, tip in zip(colour_base, colour_tip)]
        return (*c, t ** 1.5, tint)
    _paint(faces, layers, fn)
    return faces


def _flower(bm, layers, rng, base, height, petal_col, centre_col, petals=7):
    # stem
    _blade(bm, layers, rng, base, height, 0.008, 3, (0.2, 0.32, 0.12), (0.32, 0.45, 0.18))
    head = base + Vector((0, 0, height))
    r = rng.uniform(0.035, 0.055)
    centre = bm.verts.new(head + Vector((0, 0, 0.004)))
    ring = []
    for k in range(petals * 2):
        a = 2 * math.pi * k / (petals * 2)
        rr = r if k % 2 == 0 else r * 0.45
        ring.append(bm.verts.new(head + Vector((math.cos(a) * rr, math.sin(a) * rr, -0.004 * (k % 2)))))
    faces = [bm.faces.new((centre, ring[k], ring[(k + 1) % len(ring)])) for k in range(len(ring))]
    wind = 1.0

    def fn(loop):
        if loop.vert is centre:
            return (*centre_col, wind, 0.0)
        return (*petal_col, wind, 0.0)
    _paint(faces, layers, fn)


GRASS = [((0.16, 0.26, 0.08), (0.52, 0.66, 0.26)), ((0.2, 0.28, 0.1), (0.62, 0.66, 0.3))]
FLOWERS = [((0.95, 0.94, 0.9), (0.95, 0.75, 0.15)), ((0.55, 0.36, 0.82), (0.95, 0.85, 0.3))]


def _clump(name, kind, variant, seed, blades, flowers):
    lods = []
    for lod in range(2):
        rng = random.Random(seed)           # same layout for both LODs
        bm = bmesh.new()
        layers = _layers(bm)
        scratch = bmesh.new()
        scratch_layers = _layers(scratch)
        base_col, tip_col = GRASS[variant % len(GRASS)]
        for i in range(blades):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0, 0.2) ** 0.8
            base = Vector((math.cos(a) * d, math.sin(a) * d, -0.02))
            h = rng.uniform(0.3, 0.68)
            w = rng.uniform(0.025, 0.04)
            jitter = rng.uniform(0.85, 1.1)
            if lod == 1 and i % 2 == 1:
                # consume the same random numbers the blade would have, so the kept blades match LOD0
                _blade(scratch, scratch_layers, rng, base, h, w, 1, base_col, tip_col)
                continue
            _blade(bm, layers, rng, base, h, w * (1.4 if lod else 1.0), 4 if lod == 0 else 2,
                   [c * jitter for c in base_col], [c * jitter for c in tip_col])
        for i in range(flowers):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0.02, 0.16)
            petal, centre = FLOWERS[variant % len(FLOWERS)]
            _flower(bm, layers, rng, Vector((math.cos(a) * d, math.sin(a) * d, -0.02)), rng.uniform(0.3, 0.5),
                    petal, centre, petals=6 if lod else 7)
        obj = C.object_from_bmesh(f"{name}_LOD{lod}", bm)
        bm.free()
        scratch.free()
        _finish_colors(obj)
        C.set_material_slots(obj, ["Foliage"])
        lods.append(obj)
    return Asset(
        name=name, kind=kind, variant=variant, category="Plants", lods=lods, bake=False,
        slots=[Slot("Foliage", mapping="vertex", foliage=True, roughness=0.9)],
    )


def grass_clump(seed, variant):
    return _clump(f"Plant_GrassClump_{variant:02d}", "Plant_GrassClump", variant, seed, 30, 0)


def flower_clump(seed, variant):
    return _clump(f"Plant_FlowerClump_{variant:02d}", "Plant_FlowerClump", variant, seed, 14, 4)


GENERATORS = [
    ("Plant_Mushrooms", mushrooms, 3),
    ("Plant_GrassClump", grass_clump, 2),
    ("Plant_FlowerClump", flower_clump, 2),
]
