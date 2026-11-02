"""Eyes built to anatomical proportions (all lengths scaled from a 12 mm reference eyeball radius).

Per eye:
  <name>_Eye_L/R      sclera + recessed iris + pupil (opaque). Sclera is a sphere; the iris is a slightly
                      conical disc ~0.6 mm behind the limbus with the pupil as a real cavity.
  <name>_Cornea_L/R   the wet outer shell: a 7.8 mm radius corneal cap blended onto a shell just above
                      the sclera. Transparent; gives the cornea bulge, the moving specular highlight and
                      (in Cycles) real refraction of the iris.
  <name>_EyeWet_L/R   tear meniscus: a thin wet strip that bridges the lid margin and the eyeball.
  <name>_EyeOcclusion_L/R  soft shadow shell for real-time engines (hidden in path-traced renders).
"""
from __future__ import annotations

import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import bl

MM = 0.001


def eye_frame(center, forward):
    f = np.asarray(forward, float)
    f /= np.linalg.norm(f)
    up = np.array([0.0, 0.0, 1.0])
    right = np.cross(f, up)
    right /= np.linalg.norm(right)
    up = np.cross(right, f)
    return np.stack([right, up, f], axis=1)  # columns: x (right), y (up), z (forward)


def _lathe(profile, segments, close_axis_start=False, close_axis_end=False):
    """profile: list of (r, z). Returns verts (N,3) in local frame and quad faces, plus ring/segment ids."""
    verts, faces = [], []
    rings = len(profile)
    for (r, z) in profile:
        for s in range(segments):
            a = 2 * math.pi * s / segments
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(rings - 1):
        for s in range(segments):
            a = i * segments + s
            b = i * segments + (s + 1) % segments
            c = (i + 1) * segments + (s + 1) % segments
            d = (i + 1) * segments + s
            faces.append((a, b, c, d))
    verts = np.array(verts)
    return verts, faces


def build_eye(name, center, forward, radius, side, col, scale=1.0):
    """radius: eyeball (sclera) radius in metres, fitted to the socket. The cornea and iris use absolute
    anatomical sizes times `scale` (body-size factor), independent of the socket fit."""
    s = scale
    R = radius
    r_iris = 5.9 * MM * s
    r_pupil = 1.55 * MM * s
    z_limbus = math.sqrt(R * R - r_iris * r_iris)
    z_iris = z_limbus - 0.55 * MM * s          # iris root sits behind the limbus
    z_iris_inner = z_iris + 0.35 * MM * s      # iris bulges forward toward the pupil (lens behind it)
    seg = 64

    # ---- inner eye: sclera from back pole to limbus, then iris disc, then pupil cavity
    prof_sclera = []
    n_scl = 28
    theta_l = math.acos(z_limbus / R)
    for i in range(n_scl + 1):
        t = math.pi - (math.pi - theta_l) * i / n_scl     # from back (pi) to limbus
        prof_sclera.append((max(R * math.sin(t), 1e-5), R * math.cos(t)))
    prof_iris = []
    n_iris = 12
    for i in range(1, n_iris + 1):
        u = i / n_iris
        r = r_iris + (r_pupil - r_iris) * u
        # slight S-curve: recess at the root, forward at the collarette, back at the pupil margin
        z = z_iris + (z_iris_inner - z_iris) * math.sin(u * math.pi * 0.5) ** 1.3
        prof_iris.append((r, z))
    # the limbus step: from sclera edge down to the iris root
    prof_step = [(r_iris * 0.995, z_limbus - 0.25 * MM * s), (r_iris * 0.99, z_iris)]
    prof_pupil = [(r_pupil * 0.9, z_iris_inner - 0.5 * MM * s), (r_pupil * 0.5, z_iris_inner - 1.2 * MM * s),
                  (1e-5, z_iris_inner - 1.4 * MM * s)]
    profile = prof_sclera + prof_step + prof_iris + prof_pupil
    v, f = _lathe(profile, seg)
    n_rings = len(profile)
    iris_ring0 = len(prof_sclera)                   # first ring after sclera (step)
    pupil_ring0 = len(prof_sclera) + len(prof_step) + len(prof_iris) - 1
    # materials per face ring: 0 sclera, 1 iris (step + iris + pupil, pupil is black in the texture)
    mats = []
    for i in range(n_rings - 1):
        mats += [0 if i < iris_ring0 - 1 else 1] * seg
    # UVs: sclera -> azimuthal equidistant around the front pole (whole sphere in a disc);
    #      iris -> planar disc projection, pupil cavity -> center of the iris map.
    nv = len(v)
    uv_s = np.zeros((nv, 2))
    uv_i = np.zeros((nv, 2))
    for k, (x, y, z) in enumerate(v):
        th = math.acos(max(-1.0, min(1.0, z / R)))
        rho = th / math.pi * 0.5
        a = math.atan2(y, x)
        uv_s[k] = (0.5 + rho * math.cos(a), 0.5 + rho * math.sin(a))
        # iris/pupil: planar, radius r_iris -> 0.49 of the map (pupil cavity collapses to the centre)
        uv_i[k] = (0.5 + x / r_iris * 0.49, 0.5 + y / r_iris * 0.49)
    uvs = np.concatenate([uv_s, uv_i])
    uv_faces = [tuple(fi) if m == 0 else tuple(i + nv for i in fi) for fi, m in zip(f, mats)]
    M = eye_frame(center, forward)
    world = np.asarray(center) + v @ M.T
    eye = bl.mesh_object(f"{name}_Eye_{side}", world, f, uv_faces, uvs, uv_name="UV0", col=col)
    eye.data.polygons.foreach_set("material_index", np.array(mats, np.int32))

    # ---- cornea / wet shell
    Rc = 7.8 * MM * s
    zc_check = z_limbus - math.sqrt(Rc * Rc - r_iris * r_iris)
    print(f"[eyes] cornea apex {1000 * (zc_check + Rc):.2f} mm from centre (ball {1000 * R:.2f} mm)")
    zc = z_limbus - math.sqrt(Rc * Rc - r_iris * r_iris)
    shell_gap = 0.06 * MM * s
    prof = []
    n_sh = 40
    theta_max = math.radians(85)              # visible opening is ~50 deg; the rest stays behind the lids
    for i in range(n_sh + 1):
        t = theta_max * (1 - i / n_sh)          # from the rim to the front pole
        x = (R + shell_gap) * math.sin(t)
        z_sh = (R + shell_gap) * math.cos(t)
        r = x
        if r < r_iris * 1.25:
            # corneal cap, blended over 1.0..1.25 * r_iris into the scleral shell
            zcap = zc + math.sqrt(max(Rc * Rc - min(r, Rc) ** 2, 0.0))
            w = np.clip((r_iris * 1.25 - r) / (r_iris * 0.25), 0, 1)
            w = w * w * (3 - 2 * w)
            z_sh = max(z_sh, z_sh * (1 - w) + zcap * w)
        prof.append((max(r, 1e-5), z_sh))
    vs, fs = _lathe(prof, seg)
    uvc = np.stack([0.5 + vs[:, 0] / (R * 2.2), 0.5 + vs[:, 1] / (R * 2.2)], axis=1)
    cornea = bl.mesh_object(f"{name}_Cornea_{side}", np.asarray(center) + vs @ M.T, fs, fs, uvc, uv_name="UV0", col=col)

    for ob in (eye, cornea):
        ob["eye_center"] = list(map(float, center))
        ob["eye_forward"] = list(map(float, forward))
        ob["eye_radius"] = float(R)
    return {"eye": eye, "cornea": cornea, "frame": M, "radius": R, "r_iris": r_iris}


def eye_hole_loops(body_ob, eye_centers):
    """Boundary loops of the body mesh around each eye centre (the lid margins), ordered."""
    bm = bmesh.new()
    bm.from_mesh(body_ob.data)
    bm.verts.ensure_lookup_table()
    boundary = [e for e in bm.edges if e.is_boundary]
    adj = {}
    for e in boundary:
        a, b = e.verts[0].index, e.verts[1].index
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    seen, loops = set(), []
    for start in adj:
        if start in seen:
            continue
        loop = [start]
        seen.add(start)
        prev, cur = None, start
        while True:
            nxt = [n for n in adj[cur] if n != prev and n not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        loops.append(loop)
    co = np.array([v.co[:] for v in bm.verts])
    bm.free()
    out = []
    for c in eye_centers:
        best = min(loops, key=lambda lp: np.linalg.norm(co[lp].mean(axis=0) - c))
        out.append(best)
    return out, co


def lid_contour(co, faces, center, radius, forward, offset=0.0):
    """Ordered closed curve where the lid surface meets the eyeball sphere (|p - c| = radius + offset).

    Returns (points (N,3), edges (N,2) vertex pairs, t (N,)) so the curve can be re-evaluated on any
    deformed copy of the mesh (blend shapes): p = co[a] * (1 - t) + co[b] * t.
    """
    co = np.asarray(co)
    c = np.asarray(center)
    fwd = np.asarray(forward)
    near = np.linalg.norm(co - c, axis=1) < radius * 2.2
    d = np.linalg.norm(co - c, axis=1) - (radius + offset)
    seg_adj = {}
    for f in faces:
        if not all(near[i] for i in f):
            continue
        cross = []
        n = len(f)
        for k in range(n):
            a, b = f[k], f[(k + 1) % n]
            if (d[a] < 0) != (d[b] < 0):
                cross.append((min(a, b), max(a, b)))
        if len(cross) == 2:
            e1, e2 = cross
            seg_adj.setdefault(e1, []).append(e2)
            seg_adj.setdefault(e2, []).append(e1)
    loops, seen = [], set()
    for start in seg_adj:
        if start in seen:
            continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = [e for e in seg_adj[cur] if e != prev and e not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        if len(loop) > 8:
            loops.append(loop)
    if not loops:
        raise RuntimeError("no lid contour found")

    def pts(loop):
        e = np.array(loop)
        t = d[e[:, 0]] / (d[e[:, 0]] - d[e[:, 1]])
        return co[e[:, 0]] * (1 - t[:, None]) + co[e[:, 1]] * t[:, None], e, t

    # the visible margin is the most forward loop
    best = max(loops, key=lambda lp: ((pts(lp)[0] - c) @ fwd).mean())
    return pts(best)


def split_lids(loop, co, center, frame):
    """Splits a lid-margin loop at its medial/lateral corners into upper and lower lid polylines.

    Returns (upper, lower), each ordered from the medial (nasal) to the lateral corner.
    """
    loc = (co[loop] - center) @ frame        # local eye coords: x right(screen-left for L), y up, z fwd
    xs = loc[:, 0]
    i_min, i_max = int(np.argmin(xs)), int(np.argmax(xs))
    n = len(loop)

    def walk(a, b, step):
        res, i = [a], a
        while i != b:
            i = (i + step) % n
            res.append(i)
        return res

    p1, p2 = walk(i_min, i_max, 1), walk(i_min, i_max, -1)
    up1 = loc[p1, 1].mean()
    up2 = loc[p2, 1].mean()
    upper, lower = (p1, p2) if up1 > up2 else (p2, p1)
    # order medial -> lateral: medial corner is the one closer to the face midline (|world x| smaller)
    wx_min = abs(co[loop[i_min]][0])
    wx_max = abs(co[loop[i_max]][0])
    if wx_max < wx_min:
        upper, lower = upper[::-1], lower[::-1]
    return [loop[i] for i in upper], [loop[i] for i in lower]


def wet_line_verts(margin_co, center, radius, forward, width=0.9 * MM):
    """Tear meniscus rows: lid margin (row 0) -> eyeball surface (row 2); the middle row sags toward the
    corner between lid and ball, like a concave water surface. Width tapers at the canthi."""
    pts = np.asarray(margin_co)
    c = np.asarray(center)
    fwd = np.asarray(forward)
    apex = c + fwd * radius
    M = eye_frame(c, fwd)
    loc = (pts - c) @ M
    half_w = max(np.ptp(loc[:, 0]) * 0.5, 1e-4)
    xn = np.abs(loc[:, 0] - (loc[:, 0].max() + loc[:, 0].min()) * 0.5) / half_w
    taper = 1.0 - 0.8 * np.clip((xn - 0.65) / 0.35, 0, 1)
    rows = [[], [], []]
    for p, tp in zip(pts, taper):
        d = p - c
        dn = d / np.linalg.norm(d)
        on_ball = c + dn * (radius + 0.04 * MM)
        to_apex = apex - on_ball
        to_apex -= dn * (to_apex @ dn)
        L = np.linalg.norm(to_apex)
        inner = on_ball + (to_apex / L) * min(width * tp, L * 0.5) if L > 1e-6 else on_ball
        inner = c + (inner - c) / np.linalg.norm(inner - c) * (radius + 0.04 * MM)
        outer = p + dn * 0.15 * MM
        mid = (outer + inner) * 0.5
        mid = c + (mid - c) / np.linalg.norm(mid - c) * (radius + 0.12 * MM)
        rows[0].append(outer)
        rows[1].append(mid)
        rows[2].append(inner)
    return np.array(rows).reshape(-1, 3)


def _ring_faces(n, rings):
    faces = []
    for r in range(rings - 1):
        for i in range(n):
            a = r * n + i
            b = r * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    return faces


def build_wet_line(name, side, margin_co, center, radius, forward, col, width=0.9 * MM):
    n = len(margin_co)
    verts = wet_line_verts(margin_co, center, radius, forward, width)
    faces = _ring_faces(n, 3)
    uv = np.array([[i / n, r / 2] for r in range(3) for i in range(n)])
    return bl.mesh_object(f"{name}_EyeWet_{side}", verts, faces, faces, uv, uv_name="UV0", col=col)


def occlusion_verts(margin_co, center, radius, frame, rings=5):
    pts = np.asarray(margin_co)
    c = np.asarray(center)
    c2 = c + frame[:, 2] * radius        # front pole
    verts = []
    for r in range(rings):
        t = r / (rings - 1)
        for p in pts:
            q = p * (1 - t * 0.8) + c2 * (t * 0.8)
            d = q - c
            verts.append(c + d / np.linalg.norm(d) * (radius + 0.35 * MM + 0.3 * MM * (1 - t)))
    return np.array(verts)


def build_occlusion(name, side, margin_co, center, radius, frame, col, rings=5):
    """Eye occlusion shell for real-time: covers the visible eyeball, V = 0 at the lid margin, 1 at the
    centre. Vertex colour R = 1 under the upper lid (stronger shadow), 0 under the lower lid."""
    pts = np.asarray(margin_co)
    n = len(pts)
    verts = occlusion_verts(pts, center, radius, frame, rings)
    faces = _ring_faces(n, rings)
    uv = np.array([[i / n, r / (rings - 1)] for r in range(rings) for i in range(n)])
    ob = bl.mesh_object(f"{name}_EyeOcclusion_{side}", verts, faces, faces, uv, uv_name="UV0", col=col)
    loc = (pts - np.asarray(center)) @ frame
    up = np.clip(loc[:, 1] / max(loc[:, 1].max(), 1e-6), 0, 1)
    up = np.tile(up, rings)
    attr = ob.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    rgba = np.stack([up, up, up, np.ones_like(up)], 1).astype(np.float32)
    attr.data.foreach_set("color", rgba.ravel())
    return ob
