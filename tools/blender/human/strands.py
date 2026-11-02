"""Hair geometry: individual eyelash and eyebrow ribbons, and layered scalp hair cards.

Every strand or card is bound to the body surface (nearest triangle + local frame), so blend shapes on
the body (blinks, brow raises) can be re-evaluated for the hair with `Binding.evaluate`.

Ribbon/card UV convention: U across the strand(s) 0..1, V from root (0) to tip (1).
"""
from __future__ import annotations

import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import bl
import noise3d as n3

MM = 0.001


# ------------------------------------------------------------------------------------------ binding
class Surface:
    def __init__(self, co, tris):
        self.co = np.asarray(co, np.float64)
        self.tris = np.asarray(tris, np.int64)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in self.co], [tuple(t) for t in self.tris])

    def nearest(self, p):
        loc, nrm, idx, dist = self.bvh.find_nearest(Vector(p))
        return np.array(loc), np.array(nrm), idx

    def ray(self, origin, direction):
        loc, nrm, idx, dist = self.bvh.ray_cast(Vector(origin), Vector(direction))
        if loc is None:
            return None
        return np.array(loc), np.array(nrm), idx

    def frame(self, tri_idx, co=None):
        c = self.co if co is None else co
        a, b, d = c[self.tris[tri_idx, 0]], c[self.tris[tri_idx, 1]], c[self.tris[tri_idx, 2]]
        t = b - a
        t /= np.linalg.norm(t, axis=-1, keepdims=True)
        n = np.cross(b - a, d - a)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        bt = np.cross(n, t)
        return a, np.stack([t, bt, n], -1)       # origin, 3x3 columns


class Binding:
    """Vertices of a strand mesh bound rigidly to a body triangle per strand (group)."""

    def __init__(self, surface: Surface, verts, groups, tri_of_group):
        self.surface = surface
        self.groups = np.asarray(groups)          # per vertex group id
        self.tri = np.asarray(tri_of_group)[self.groups]
        o, M = surface.frame(self.tri)
        rel = np.asarray(verts) - o
        self.local = np.einsum("nji,nj->ni", M, rel)

    def evaluate(self, co):
        o, M = self.surface.frame(self.tri, np.asarray(co))
        return o + np.einsum("nij,nj->ni", M, self.local)


def _ribbon(points, widths, side_dirs, v0=0.0):
    """points (K,3) along a strand, widths (K,), side_dirs (K,3) unit -> verts (2K,3), quads, uvs."""
    K = len(points)
    left = points - side_dirs * widths[:, None] * 0.5
    right = points + side_dirs * widths[:, None] * 0.5
    verts = np.empty((2 * K, 3))
    verts[0::2] = left
    verts[1::2] = right
    quads = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(K - 1)]
    uv = np.empty((2 * K, 2))
    t = np.linspace(0, 1, K)
    uv[0::2, 0] = 0.0
    uv[1::2, 0] = 1.0
    uv[0::2, 1] = v0 + t
    uv[1::2, 1] = v0 + t
    return verts, quads, uv


class StrandBuilder:
    def __init__(self):
        self.verts, self.faces, self.uvs, self.groups, self.tris = [], [], [], [], []
        self.normals = []
        self.n = 0

    def add(self, verts, quads, uvs, tri, normal=None):
        g = len(self.tris)
        self.tris.append(tri)
        self.verts.append(verts)
        self.uvs.append(uvs)
        self.faces.extend(tuple(i + self.n for i in q) for q in quads)
        self.groups.append(np.full(len(verts), g))
        self.normals.append(np.tile(normal, (len(verts), 1)) if normal is not None and np.ndim(normal) == 1 else normal)
        self.n += len(verts)

    def build(self, name, col, surface):
        V = np.concatenate(self.verts)
        U = np.concatenate(self.uvs)
        G = np.concatenate(self.groups)
        ob = bl.mesh_object(name, V, self.faces, self.faces, U, uv_name="UV0", col=col)
        ob["binding"] = True
        if all(nrm is not None for nrm in self.normals):
            Nn = np.concatenate(self.normals)
            Nn /= np.linalg.norm(Nn, axis=1, keepdims=True)
            loops = np.array([li for f in self.faces for li in f])
            try:
                ob.data.normals_split_custom_set([tuple(Nn[i]) for i in loops])
            except Exception as e:  # pragma: no cover
                print("[strands] custom normals failed:", e)
        return ob, Binding(surface, V, G, np.array(self.tris))


def _rot(v, axis, ang):
    axis = axis / np.linalg.norm(axis)
    return v * math.cos(ang) + np.cross(axis, v) * math.sin(ang) + axis * (axis @ v) * (1 - math.cos(ang))


# ----------------------------------------------------------------------------------------- eyelashes
def eyelashes(surface: Surface, margin, center, frame, side, name, col, seed=1):
    """margin: ordered lid-contour points (closed loop) at the anterior lid edge."""
    rng = np.random.default_rng(seed + (0 if side == "L" else 7))
    c = np.asarray(center)
    right, up, fwd = frame[:, 0], frame[:, 1], frame[:, 2]
    loc = (np.asarray(margin) - c) @ frame
    n = len(margin)
    i_med = int(np.argmin(np.abs(np.asarray(margin)[:, 0])))       # nearer the nose
    i_lat = int(np.argmax(np.abs(np.asarray(margin)[:, 0])))

    def path(a, b, step):
        res, i = [a], a
        while i != b:
            i = (i + step) % n
            res.append(i)
        return res

    p1, p2 = path(i_med, i_lat, 1), path(i_med, i_lat, -1)
    upper, lower = (p1, p2) if loc[p1, 1].mean() > loc[p2, 1].mean() else (p2, p1)
    sb = StrandBuilder()
    lat_sign = 1.0 if (np.asarray(margin)[i_lat, 0] - c[0]) > 0 else -1.0
    for lid, idx, count, base_len, extra_len, curl in (("upper", upper, 130, 5.0, 5.0, 1.0),
                                                       ("lower", lower, 55, 1.6, 2.4, 0.3)):
        pts = np.asarray(margin)[idx]
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        cum = np.concatenate([[0], np.cumsum(seg)])
        total = cum[-1]
        clump_c = None
        for k in range(count):
            s = np.clip((k + rng.uniform(-0.4, 0.4)) / (count - 1), 0.02, 0.98)
            if lid == "lower" and (s < 0.12 or s > 0.95):
                continue
            pos = np.array([np.interp(s * total, cum, pts[:, d]) for d in range(3)])
            tang = np.array([np.interp(s * total + 0.2 * MM, cum, pts[:, d]) for d in range(3)]) - pos
            tang /= np.linalg.norm(tang)
            radial = pos - c
            radial /= np.linalg.norm(radial)
            row = rng.integers(0, 3)
            root = pos + radial * (0.25 + 0.25 * row) * MM + fwd * 0.15 * MM * row
            vert = up if lid == "upper" else -up
            fan = (s - 0.35) * lat_sign * right * 0.9
            if lid == "upper":
                d0 = radial * 0.45 + fwd * 0.85 + vert * 0.15 + fan * 0.6
            else:
                d0 = radial * 0.25 + fwd * 0.95 + vert * 0.05 + fan * 0.5
            d0 += rng.normal(0, 0.08, 3)
            d0 /= np.linalg.norm(d0)
            L = (base_len + extra_len * math.sin(math.pi * s ** 0.85)) * MM * rng.uniform(0.8, 1.12)
            if lid == "upper" and s < 0.15:
                L *= 0.6 + 2.6 * s
            K = 7
            curl_axis = np.cross(d0, vert)
            if np.linalg.norm(curl_axis) < 1e-6:
                curl_axis = right
            pts_l = [root]
            d = d0.copy()
            if k % 4 == 0:
                clump_c = rng.normal(0, 0.15, 3)
            for i in range(1, K):
                # Rodrigues about cross(d0, vert): a positive angle turns the lash toward `vert`
                d = _rot(d, curl_axis, curl * 0.3 * (i / K) ** 0.8)
                bend = d + (clump_c if clump_c is not None else 0) * 0.1 * (i / K)
                pts_l.append(pts_l[-1] + bend / np.linalg.norm(bend) * L / (K - 1))
            P = np.array(pts_l)
            t = np.linspace(0, 1, K)
            widths = (0.11 * (1 - t) + 0.03 * t) * MM * (1.6 if lid == "upper" else 1.1)
            side_dirs = np.tile(tang, (K, 1))
            v, q, uv = _ribbon(P, widths, side_dirs)
            _, nrm, tri = surface.nearest(root)
            sb.add(v, q, uv, tri, normal=np.cross(tang, d0))
    return sb.build(f"{name}_Eyelashes_{side}", col, surface)


# ------------------------------------------------------------------------------------------ eyebrows
def eyebrows(surface: Surface, O, side, name, col, density=1.0, seed=3):
    """Eyebrow hairs in the brow shape used by the skin texture (head-local mm around O, the point
    between the eyes). Hairs lie almost flat: up in the head, lateral in the body, down in the tail,
    upper and lower rows converging on the centre line (herringbone)."""
    rng = np.random.default_rng(seed + (0 if side == "L" else 11))
    sgn = 1.0 if side == "L" else -1.0
    O = np.asarray(O)
    to_bl = lambda lx, ly, lz: O + np.array([lx, -lz, ly]) * MM
    sb = StrandBuilder()
    count = int(330 * density)
    placed = 0
    tries = 0
    while placed < count and tries < count * 6:
        tries += 1
        u = rng.uniform(0, 42)
        sb_ = u / 42.0
        cy = 16.0 + 5.5 * math.sin(sb_ * math.pi * 0.85) - 4.0 * sb_ ** 3
        h = 8.5 - 5.0 * sb_
        dv = rng.uniform(-0.5, 0.5)
        # density falls off at the edges of the brow (soft, irregular boundary)
        edge = 1 - abs(dv) * 2
        if rng.random() > 0.25 + 0.75 * edge ** 0.6:
            continue
        if u < 4 and rng.random() > u / 4:
            continue
        lx = sgn * (10.0 + u)
        ly = cy + dv * h + rng.normal(0, 0.35)
        hit = surface.ray(to_bl(lx, ly, 80.0), np.array([0.0, 1.0, 0.0]))
        if hit is None:
            continue
        root, nrm, tri = hit
        # direction in head-local (x lateral, y up): head hairs go up, body lateral, tail lateral-down
        ang_head = math.radians(80 - 60 * min(sb_ / 0.25, 1.0))
        conv = -dv * math.radians(35) * (sb_ > 0.15)
        ang = ang_head + conv - math.radians(20) * max(0.0, sb_ - 0.7) / 0.3
        ang += rng.normal(0, math.radians(8))
        dl = np.array([sgn * math.cos(ang), math.sin(ang), 0.0])
        d = np.array([dl[0], -dl[2], dl[1]])
        d = d - nrm * (d @ nrm)
        d /= np.linalg.norm(d)
        L = (5.0 + 4.5 * min(sb_ / 0.4, 1.0) - 2.0 * max(0.0, sb_ - 0.8)) * MM * rng.uniform(0.75, 1.2)
        K = 6
        lift = math.radians(rng.uniform(10, 22))
        P = [root - nrm * 0.15 * MM]
        cur = d * math.cos(lift) + nrm * math.sin(lift)
        for i in range(1, K):
            cur = cur - nrm * 0.18 * (i / K)          # bends back toward the skin
            cur /= np.linalg.norm(cur)
            P.append(P[-1] + cur * L / (K - 1))
        P = np.array(P)
        t = np.linspace(0, 1, K)
        widths = (0.085 * (1 - t) + 0.025 * t) * MM * 1.5
        side_dir = np.cross(nrm, d)
        side_dir /= np.linalg.norm(side_dir)
        v, q, uv = _ribbon(P, widths, np.tile(side_dir, (K, 1)))
        sb.add(v, q, uv, tri, normal=nrm)
        placed += 1
    return sb.build(f"{name}_Eyebrows_{side}", col, surface)


# --------------------------------------------------------------------------------------- hair cards
def hair_atlas(path, size=2048, variants=8, seed=21):
    """Card texture atlas: `variants` columns of strand clumps. R root->tip, G per-strand brightness,
    A coverage (Unity preserves alpha coverage in the mips). V=0 (bottom row) is the root."""
    from PIL import Image, ImageDraw
    rng = np.random.default_rng(seed)
    ss = 2
    W, H = size * ss, size * ss
    cov = Image.new("L", (W, H), 0)
    bri = Image.new("L", (W, H), 0)
    dc, db = ImageDraw.Draw(cov), ImageDraw.Draw(bri)
    col_w = W / variants
    for vi in range(variants):
        x0 = vi * col_w
        sparse = vi >= variants - 2                     # last two columns: sparse (hairline, flyaways)
        n_strands = 60 if sparse else 190
        for s in range(n_strands):
            # clumped: strands gather toward a few clump centres toward the tip
            clump = rng.integers(0, 5)
            cx = x0 + col_w * (0.2 + 0.6 * (clump + 0.5) / 5)
            # strands thin out toward the card's side edges so cards have no hard borders
            rx = x0 + col_w * float(np.clip(0.5 + rng.normal(0, 0.2), 0.03, 0.97))
            length = rng.uniform(0.55, 1.0) if not sparse else rng.uniform(0.3, 0.9)
            wav_a = rng.uniform(0.0, 0.012) * col_w
            wav_f = rng.uniform(0.8, 2.2)
            ph = rng.uniform(0, 6.28)
            pts = []
            K = 40
            for i in range(K + 1):
                t = i / K * length
                x = rx + (cx - rx) * (t ** 1.6) * 0.6 + wav_a * math.sin(t * wav_f * 6.28 + ph) * 7
                y = H - t * H
                pts.append((x, y))
            wpx = max(1, int(round(rng.uniform(0.9, 1.8) * ss)))
            b = int(rng.uniform(150, 255))
            for i in range(K):
                taper = 1.0 - (i / K) ** 3
                wi = max(1, int(round(wpx * (0.4 + 0.6 * taper))))
                dc.line([pts[i], pts[i + 1]], fill=255, width=wi)
                db.line([pts[i], pts[i + 1]], fill=b, width=wi)
    cov = np.asarray(cov.resize((size, size), Image.LANCZOS)).astype(np.float64) / 255.0
    bri = np.asarray(bri.resize((size, size), Image.LANCZOS)).astype(np.float64) / 255.0
    bri = np.where(cov > 0.02, bri / np.maximum(cov, 1e-3), 0.8)
    rt = np.linspace(1, 0, size)[:, None] * np.ones((1, size))      # row 0 = top = tip
    img = np.stack([rt, np.clip(bri, 0, 1), np.zeros_like(rt), np.clip(cov, 0, 1)], -1)
    import noise as nz
    nz.save_png(path, img)
    return variants


def scalp_direction(L, part_x=22.0):
    """Comb direction (head-local) for a root at L (mm): side part on the character's left."""
    x, y, z = L
    back = np.array([0.0, 0.0, -1.0])
    down = np.array([0.0, -1.0, 0.0])
    away = np.array([1.0 if x > part_x else -1.0, 0.0, 0.0])
    top_w = float(np.clip((y - 30.0) / 30.0, 0, 1))
    side_w = float(np.clip((abs(x) - 45.0) / 20.0, 0, 1)) * (1 - top_w * 0.7)
    back_w = float(np.clip((-z - 60.0) / 30.0, 0, 1))
    d_top = back * 0.75 + away * (0.45 if x > part_x else 0.65) + np.array([0, 0.25, 0]) * float(z > 0)
    d_side = down * 0.8 + back * 0.6
    d_back = down * 1.0 + np.array([np.sign(x) * 0.15, 0, 0])
    d = d_top * top_w + d_side * side_w + d_back * back_w
    if np.linalg.norm(d) < 1e-6:
        d = back
    return d / np.linalg.norm(d)


def scalp_direction_np(L, part_x=22.0):
    """Vectorised scalp_direction for (N,3) head-local points; returns (N,3) unit vectors."""
    x, y, z = L[:, 0], L[:, 1], L[:, 2]
    n = len(L)
    right_of_part = x > part_x
    top_w = np.clip((y - 30.0) / 30.0, 0, 1)
    side_w = np.clip((np.abs(x) - 45.0) / 20.0, 0, 1) * (1 - top_w * 0.7)
    back_w = np.clip((-z - 60.0) / 30.0, 0, 1)
    away = np.where(right_of_part, 1.0, -1.0)
    d_top = np.stack([away * np.where(right_of_part, 0.45, 0.65), 0.25 * (z > 0), -0.75 * np.ones(n)], 1)
    d_side = np.stack([np.zeros(n), -0.8 * np.ones(n), -0.6 * np.ones(n)], 1)
    d_back = np.stack([np.sign(x) * 0.15, -np.ones(n), np.zeros(n)], 1)
    d = d_top * top_w[:, None] + d_side * side_w[:, None] + d_back * back_w[:, None]
    d[np.linalg.norm(d, axis=1) < 1e-6] = (0, 0, -1)
    return d / np.linalg.norm(d, axis=1, keepdims=True)


def scalp_length(L, cfg):
    x, y, z = L
    top = float(np.clip((y - 35.0) / 25.0, 0, 1)) * float(np.clip((abs(x) - 0) / 1, 0, 1) if False else 1)
    side_fade = float(np.clip((y + 20.0) / 50.0, 0, 1))
    top_len = cfg["top_length"] * (1.0 + 0.15 * float(z > 0) - 0.25 * float(z < -60))
    side_len = cfg["side_length"] * (0.45 + 0.55 * side_fade)
    back_len = cfg["back_length"] * (0.35 + 0.65 * float(np.clip((y + 60.0) / 70.0, 0, 1)))
    base = side_len if abs(x) > 40 or z < -40 else top_len
    base = back_len if z < -55 and y < 40 else base
    return top * top_len + (1 - top) * base


def hair_cards(surface: Surface, body_co, scalp_weight, O, name, col, cfg, variants=8, seed=31):
    """Layered cards following the scalp. scalp_weight: per body-vertex hair coverage 0..1."""
    rng = np.random.default_rng(seed)
    O = np.asarray(O)
    to_local = lambda p: np.array([p[0] - O[0], p[2] - O[2], -(p[1] - O[1])]) * 1000.0
    to_bl_dir = lambda d: np.array([d[0], -d[2], d[1]])
    # roots are sampled uniformly by scalp AREA (MakeHuman's mesh is dense at the ears and face and sparse
    # on the crown, so sampling vertices would leave the top of the head bald)
    stris = surface.tris
    co = surface.co
    tw = scalp_weight[stris].mean(axis=1)
    area = 0.5 * np.linalg.norm(np.cross(co[stris[:, 1]] - co[stris[:, 0]], co[stris[:, 2]] - co[stris[:, 0]]), axis=1)
    prob = area * np.clip((tw - 0.55) / 0.3, 0, 1)
    prob /= prob.sum()

    def sample_roots(k):
        ti = rng.choice(len(stris), size=k, p=prob)
        r1, r2 = rng.random(k), rng.random(k)
        flip = r1 + r2 > 1
        r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
        a_, b_, c_ = co[stris[ti, 0]], co[stris[ti, 1]], co[stris[ti, 2]]
        return a_ + (b_ - a_) * r1[:, None] + (c_ - a_) * r2[:, None], tw[ti]
    sb = StrandBuilder()
    layers = [  # (count, height mm, width mm, length scale, variant pool)
        (520, 1.2, 13.0, 0.80, range(0, variants - 2)),
        (520, 3.2, 11.0, 1.00, range(0, variants - 2)),
        (380, 5.5, 8.5, 1.05, range(0, variants - 2)),
        (220, 2.0, 7.0, 0.55, range(variants - 2, variants)),   # hairline / fringe sparse
    ]
    for li, (count, height, width, lscale, pool) in enumerate(layers):
        roots, rw = sample_roots(count)
        for p0, wroot in zip(roots, rw):
            loc, nrm, tri = surface.nearest(p0)
            L = to_local(loc)
            if li == 3:
                # sparse cards only along the front hairline and the nape
                if wroot > 0.8 and rng.random() < 0.85:
                    continue
            length = scalp_length(L, cfg) * lscale * rng.uniform(0.75, 1.15)
            # the short taper on the sides and nape is carried by the painted hair cap; cards there only
            # read as flakes
            if length < (0.010 if li < 3 else 0.006):
                continue
            K = 7 if length > 0.02 else 4
            d = to_bl_dir(scalp_direction(L))
            d += rng.normal(0, 0.12, 3)
            pts, nrms = [], []
            p = loc + nrm * height * float(np.clip(length / 0.03, 0.3, 1.0)) * MM
            n0 = nrm
            for i in range(K):
                ls, ln, ti_ = surface.nearest(p)
                # stop at folds and where the card leaves the hair-covered scalp (ears, face, neck)
                if i > 1 and (ln @ n0 < 0.55 or tw[ti_] < 0.3):
                    break
                pts.append(p.copy())
                nrms.append(ln)
                d = d - ln * (d @ ln)
                d /= np.linalg.norm(d)
                dl = to_bl_dir(scalp_direction(to_local(ls)))
                d = d * 0.7 + dl * 0.3
                d /= np.linalg.norm(d)
                step = length / (K - 1)
                p = p + d * step
                ls2, ln2, _ = surface.nearest(p)
                t = (i + 1) / (K - 1)
                # volume: longer hair stands off the scalp more in the middle of its run; short side and
                # back hair lies close to the head
                hump = min(0.16 * length / MM, 9.0) if length > 0.02 else 0.4
                flat = float(np.clip(length / 0.03, 0.3, 1.0))
                h = (height * flat + hump * math.sin(t * math.pi * 0.85)) * MM
                p = ls2 + ln2 * h
            if len(pts) < 3:
                continue
            K = len(pts)
            P = np.array(pts)
            Nn = np.array(nrms)
            tang = np.gradient(P, axis=0)
            tang /= np.linalg.norm(tang, axis=1, keepdims=True)
            side_dirs = np.cross(Nn, tang)
            side_dirs /= np.linalg.norm(side_dirs, axis=1, keepdims=True)
            # random twist about the strand so some cards stand edge-on and break up the silhouette
            twist = rng.normal(0, math.radians((22 if length > 0.025 else 8) if li < 3 else 30))
            side_dirs = side_dirs * math.cos(twist) + Nn * math.sin(twist)
            t = np.linspace(0, 1, K)
            narrow = float(np.clip(length / 0.04, 0.4, 1.0))      # short hair: narrow cards
            widths = width * narrow * MM * (1.0 - 0.55 * t ** 1.5) * rng.uniform(0.8, 1.2)
            v, q, uv = _ribbon(P, widths, side_dirs)
            vi = int(rng.choice(list(pool)))
            uv[:, 0] = (vi + 0.02 + uv[:, 0] * 0.96) / variants
            # always map the full root->tip range so every card ends in tapered tips, never blunt
            uv[:, 1] = uv[:, 1] * rng.uniform(0.92, 1.0)
            normals = np.repeat(Nn, 2, axis=0)
            sb.add(v, q, uv, tri, normal=normals)
    return sb.build(f"{name}_Hair", col, surface)
