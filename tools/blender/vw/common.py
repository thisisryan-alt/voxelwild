"""Shared helpers for the Voxelwild Blender generators.

Conventions (docs/ASSET_PIPELINE.md): metres, one block = 1 m, +Z up in Blender (converted to Unity's +Y
on export). Floor props have their pivot at the base centre and grow up +Z; ceiling props have their pivot
at the attachment point and hang down -Z.

Every generator is deterministic: randomness comes from random.Random(seed) and from mathutils.noise
sampled at seed-derived offsets, never from global state.
"""

import math
import random

import bpy  # first: the standalone bpy module only exposes bmesh/mathutils after bpy loads
import bmesh
from mathutils import Matrix, Vector, noise

# ------------------------------------------------------------------ scene


def reset_scene():
    """Empty scene with Cycles on the CPU (used for baking and previews)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.seed = 0
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def object_from_bmesh(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    mesh.update()
    return link(bpy.data.objects.new(name, mesh))


def select_only(*objs, active=None):
    for o in bpy.context.view_layer.objects:
        if o is not None:
            o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def delete(*objs):
    for o in objs:
        mesh = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh is not None and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    bpy.context.view_layer.update()


def duplicate(obj, name):
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.data.name = name
    copy.name = name
    return link(copy)


def triangle_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ------------------------------------------------------------------ noise


def seed_offset(seed, salt=0):
    """A stable 3D offset for sampling mathutils.noise per seed."""
    r = random.Random(seed * 7919 + salt * 104729)
    return Vector((r.uniform(-500, 500), r.uniform(-500, 500), r.uniform(-500, 500)))


def fbm(p, octaves=4, lacunarity=2.0, gain=0.5):
    """Signed fractal noise in roughly [-1, 1] (Perlin basis)."""
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        total += amp * noise.noise(p * freq, noise_basis="PERLIN_NEW")
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / norm


def ridged(p, octaves=3):
    """Ridged noise in [0, 1]: sharp creases, for cracks and strata."""
    amp, total, norm = 1.0, 0.0, 0.0
    for i in range(octaves):
        n = 1.0 - abs(noise.noise(p * (2.0 ** i), noise_basis="PERLIN_NEW"))
        total += amp * n * n
        norm += amp
        amp *= 0.5
    return total / norm


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ mesh attributes


def ensure_uv_layers(obj, names=("UVBake", "UVTile")):
    """Every exported mesh carries the same two UV sets: 0 = unique bake UV, 1 = material tiling UV."""
    uvs = obj.data.uv_layers
    for n in names:
        if uvs.get(n) is None:
            uvs.new(name=n)
    # order matters for Unity (uv0, uv1)
    return [uvs[n] for n in names]


def ensure_color(obj, default=(1.0, 1.0, 1.0, 0.0)):
    """Corner-domain byte colour 'Col': RGB albedo tint (sRGB), A wind weight."""
    mesh = obj.data
    attr = mesh.color_attributes.get("Col")
    if attr is None:
        attr = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
        for d in attr.data:
            d.color_srgb = default
    mesh.color_attributes.active_color = attr
    mesh.color_attributes.render_color_index = mesh.color_attributes.find("Col")
    return attr


def set_material_slots(obj, slot_names):
    obj.data.materials.clear()
    for n in slot_names:
        mat = bpy.data.materials.get(n) or bpy.data.materials.new(n)
        obj.data.materials.append(mat)


def smart_uv(obj, angle=66.0, margin=0.02):
    """Unique non-overlapping UVs in UVBake for baking."""
    select_only(obj)
    obj.data.uv_layers.active = obj.data.uv_layers["UVBake"]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=margin, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")


def decimate(obj, target_tris):
    """Collapse-decimates obj in place to about target_tris triangles (UV seams preserved)."""
    tris = triangle_count(obj)
    if tris <= target_tris:
        triangulate(obj)
        return obj
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = target_tris / tris
    mod.use_collapse_triangulate = True
    mod.use_symmetry = False
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    triangulate(obj)
    return obj


def triangulate(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def shade_smooth(obj, auto_angle=None):
    for p in obj.data.polygons:
        p.use_smooth = True
    if auto_angle is not None:
        # hard edges above the angle (fracture faces, cut ends) keep crisp shading
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(auto_angle):
                e.smooth = False
        bm.to_mesh(obj.data)
        bm.free()
    obj.data.update()


# ------------------------------------------------------------------ measurement


def mesh_extents(obj):
    """Pivot-relative extents that do not depend on yaw: horizontal radius, top and bottom z."""
    r, top, bottom = 0.0, -1e9, 1e9
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        r = max(r, math.hypot(p.x, p.y))
        top = max(top, p.z)
        bottom = min(bottom, p.z)
    return {"radius": round(r, 4), "top": round(top, 4), "bottom": round(bottom, 4)}


def mesh_volume(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    vol = bm.calc_volume(signed=True)
    bm.free()
    return vol


def point_inside(bvh, p, directions=((1, 0.013, 0.007), (-0.011, 1, 0.017), (0.019, -0.007, 1))):
    """Majority vote of ray-parity tests (robust against grazing hits on a closed mesh)."""
    votes = 0
    for d in directions:
        d = Vector(d).normalized()
        origin, hits = Vector(p), 0
        for _ in range(64):
            loc, _n, _i, _dist = bvh.ray_cast(origin, d)
            if loc is None:
                break
            hits += 1
            origin = loc + d * 1e-4
        votes += hits & 1
    return votes >= 2


# ------------------------------------------------------------------ geometry builders


def tube(bm, points, radii, segments, cap_start=False, cap_end=True, ring_noise=None, uv_offset=0.0):
    """Sweeps rings along a polyline with parallel-transport frames. Returns (rings, side faces, cap faces).

    UVTile is in metres: u is arc length around the tube at its base radius (the texture compresses as the
    tube tapers, like real bark), v is length along it. The one seam line is hidden in bark noise.
    ring_noise(point, angle, t) -> radial multiplier, for bark ridges or flares.
    """
    n = len(points)
    tangents = []
    for i in range(n):
        a = points[max(i - 1, 0)]
        b = points[min(i + 1, n - 1)]
        tangents.append((b - a).normalized())
    # initial normal: any vector perpendicular to the first tangent
    t0 = tangents[0]
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    normal = (ref - t0 * ref.dot(t0)).normalized()

    u_span = 2 * math.pi * max(radii[0], 1e-3)

    rings, frames = [], []
    length = 0.0
    lengths = [0.0]
    for i in range(1, n):
        length += (points[i] - points[i - 1]).length
        lengths.append(length)
    for i in range(n):
        t = tangents[i]
        if i > 0:
            # parallel transport: rotate the previous normal by the change in tangent
            prev = tangents[i - 1]
            axis = prev.cross(t)
            if axis.length > 1e-6:
                ang = math.acos(max(-1.0, min(1.0, prev.dot(t))))
                normal = (Matrix.Rotation(ang, 3, axis.normalized()) @ normal)
            normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        frames.append((normal, binormal))
        ring = []
        frac = lengths[i] / max(length, 1e-6)
        for s in range(segments):
            ang = 2 * math.pi * s / segments
            r = radii[i]
            if ring_noise is not None:
                r *= ring_noise(points[i], ang, frac)
            offset = normal * math.cos(ang) * r + binormal * math.sin(ang) * r
            ring.append(bm.verts.new(points[i] + offset))
        rings.append(ring)

    uv_bake = bm.loops.layers.uv.get("UVBake") or bm.loops.layers.uv.new("UVBake")
    uv_tile = bm.loops.layers.uv.get("UVTile") or bm.loops.layers.uv.new("UVTile")
    side_faces = []
    for i in range(n - 1):
        for s in range(segments):
            s2 = (s + 1) % segments
            f = bm.faces.new((rings[i][s], rings[i][s2], rings[i + 1][s2], rings[i + 1][s]))
            side_faces.append(f)
            us = (s / segments, (s + 1) / segments, (s + 1) / segments, s / segments)
            vs = (lengths[i], lengths[i], lengths[i + 1], lengths[i + 1])
            for loop, u, v in zip(f.loops, us, vs):
                loop[uv_tile].uv = (u * u_span + uv_offset, v)
                loop[uv_bake].uv = (u, v)

    caps = []
    for use, idx, flip in ((cap_start, 0, True), (cap_end, n - 1, False)):
        if not use:
            continue
        ring = rings[idx]
        centre = bm.verts.new(points[idx] + tangents[idx] * (0.0 if flip else radii[idx] * 0.15))
        nrm, bi = frames[idx]
        r = max(radii[idx], 1e-4)
        for s in range(segments):
            s2 = (s + 1) % segments
            verts = (centre, ring[s2], ring[s]) if flip else (centre, ring[s], ring[s2])
            f = bm.faces.new(verts)
            caps.append(f)
            for loop in f.loops:
                d = loop.vert.co - points[idx]
                # end grain: the ring image spans the cut face (LogTop is one ring per tile)
                loop[uv_tile].uv = (0.5 + d.dot(nrm) / (2.2 * r), 0.5 + d.dot(bi) / (2.2 * r))
                loop[uv_bake].uv = loop[uv_tile].uv
    return rings, side_faces, caps


def lathe_points(profile, segments, twist=0.0):
    """Revolves (radius, z) pairs around Z. Returns rings of Vectors."""
    rings = []
    for i, (r, z) in enumerate(profile):
        ring = []
        for s in range(segments):
            a = 2 * math.pi * s / segments + twist * i
            ring.append(Vector((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    return rings


def bm_from_rings(bm, rings, close_bottom=True, close_top=True):
    """Quad strip between consecutive rings, optional fan caps. Rings must share a segment count."""
    vrings = [[bm.verts.new(p) for p in ring] for ring in rings]
    seg = len(rings[0])
    faces = []
    for i in range(len(vrings) - 1):
        for s in range(seg):
            s2 = (s + 1) % seg
            faces.append(bm.faces.new((vrings[i][s], vrings[i][s2], vrings[i + 1][s2], vrings[i + 1][s])))
    if close_bottom:
        c = bm.verts.new(sum((v.co for v in vrings[0]), Vector()) / seg)
        for s in range(seg):
            faces.append(bm.faces.new((c, vrings[0][(s + 1) % seg], vrings[0][s])))
    if close_top:
        c = bm.verts.new(sum((v.co for v in vrings[-1]), Vector()) / seg)
        for s in range(seg):
            faces.append(bm.faces.new((c, vrings[-1][s], vrings[-1][(s + 1) % seg])))
    return vrings, faces
