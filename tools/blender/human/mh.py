"""MakeHuman (hm08) data access: base mesh, morph targets, proxies, rig and weights.

Pure numpy, no bpy, so it can be unit-tested outside Blender. All data is the CC0 MakeHuman / MPFB2
asset set copied into SourceArt/Characters/Human/makehuman (see CREDITS.md).

Coordinates stay in MakeHuman space here (Y up, +Z forward, decimetres). `to_blender()` converts to
Blender space (Z up, -Y forward, metres) at the end.
"""
from __future__ import annotations

import gzip
import json
import os
from dataclasses import dataclass, field

import numpy as np

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATA = os.path.join(REPO, "SourceArt", "Characters", "Human", "makehuman")


# --------------------------------------------------------------------------------------------- mesh
@dataclass
class ObjMesh:
    verts: np.ndarray                      # (V, 3) float64
    uvs: np.ndarray                        # (T, 2)
    faces: list                            # list of vertex-index tuples
    face_uvs: list                         # list of uv-index tuples (same shape as faces)
    face_groups: np.ndarray                # (F,) int index into group_names
    group_names: list = field(default_factory=list)
    face_materials: np.ndarray | None = None
    material_names: list = field(default_factory=list)

    def group_faces(self, *names: str) -> np.ndarray:
        ids = [self.group_names.index(n) for n in names if n in self.group_names]
        return np.nonzero(np.isin(self.face_groups, ids))[0]

    def group_verts(self, *names: str) -> np.ndarray:
        fs = self.group_faces(*names)
        return np.unique(np.concatenate([np.asarray(self.faces[f]) for f in fs])) if len(fs) else np.zeros(0, int)


def load_obj(path: str) -> ObjMesh:
    verts, uvs, faces, fuvs, fgroups, fmats = [], [], [], [], [], []
    groups, mats = ["default"], ["default"]
    g = m = 0
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not line or line[0] == "#":
                continue
            parts = line.split()
            if not parts:
                continue
            tag = parts[0]
            if tag == "v":
                verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif tag == "vt":
                uvs.append((float(parts[1]), float(parts[2])))
            elif tag == "f":
                vi, ti = [], []
                for p in parts[1:]:
                    s = p.split("/")
                    vi.append(int(s[0]) - 1)
                    ti.append(int(s[1]) - 1 if len(s) > 1 and s[1] else -1)
                faces.append(tuple(vi))
                fuvs.append(tuple(ti))
                fgroups.append(g)
                fmats.append(m)
            elif tag == "g":
                name = parts[1] if len(parts) > 1 else "default"
                if name not in groups:
                    groups.append(name)
                g = groups.index(name)
            elif tag == "usemtl":
                name = parts[1] if len(parts) > 1 else "default"
                if name not in mats:
                    mats.append(name)
                m = mats.index(name)
    return ObjMesh(np.array(verts, np.float64), np.array(uvs, np.float64).reshape(-1, 2), faces, fuvs,
                   np.array(fgroups, np.int32), groups, np.array(fmats, np.int32), mats)


def load_base() -> ObjMesh:
    return load_obj(os.path.join(DATA, "base.obj"))


# ------------------------------------------------------------------------------------------ targets
_target_cache: dict[str, tuple[np.ndarray, np.ndarray]] = {}


def load_target(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Returns (indices, deltas) of a .target or .target.gz file."""
    if path in _target_cache:
        return _target_cache[path]
    opener = gzip.open if path.endswith(".gz") else open
    idx, dlt = [], []
    with opener(path, "rt") as fh:
        for line in fh:
            line = line.strip()
            if not line or line[0] == "#":
                continue
            p = line.split()
            idx.append(int(p[0]))
            dlt.append((float(p[1]), float(p[2]), float(p[3])))
    res = (np.array(idx, np.int64), np.array(dlt, np.float64).reshape(-1, 3))
    _target_cache[path] = res
    return res


def target_path(rel: str) -> str:
    p = os.path.join(DATA, "targets", rel)
    if not p.endswith(".target.gz") and not p.endswith(".target"):
        p += ".target.gz"
    return p


def apply_target(verts: np.ndarray, rel: str, weight: float) -> None:
    if abs(weight) < 1e-6:
        return
    idx, d = load_target(target_path(rel))
    np.add.at(verts, idx, d * weight)


def target_delta(nverts: int, rel: str, weight: float = 1.0) -> np.ndarray:
    out = np.zeros((nverts, 3))
    apply_target(out, rel, weight)
    return out


# ------------------------------------------------------------------------------------ macro morphs
@dataclass
class Macro:
    """MakeHuman macro parameters, 0..1 like the MakeHuman sliders.

    age: 0 = 1 yr, 0.1875 = 11 yrs, 0.5 = 25 yrs, 1.0 = 90 yrs.
    """
    gender: float = 1.0
    age: float = 0.5
    muscle: float = 0.5
    weight: float = 0.5
    height: float = 0.5
    proportions: float = 0.5
    african: float = 1 / 3
    asian: float = 1 / 3
    caucasian: float = 1 / 3

    @staticmethod
    def age_from_years(years: float) -> float:
        if years < 1:
            return 0.0
        if years < 11:
            return (years - 1) / (11 - 1) * 0.1875
        if years < 25:
            return 0.1875 + (years - 11) / (25 - 11) * (0.5 - 0.1875)
        return 0.5 + (years - 25) / (90 - 25) * 0.5


def _gender_w(m: Macro):
    return {"female": 1.0 - m.gender, "male": m.gender}


def _age_w(m: Macro):
    a = m.age
    w = {"baby": 0.0, "child": 0.0, "young": 0.0, "old": 0.0}
    if a < 0.1875:
        w["child"] = a / 0.1875
        w["baby"] = 1 - w["child"]
    elif a < 0.5:
        w["young"] = (a - 0.1875) / (0.5 - 0.1875)
        w["child"] = 1 - w["young"]
    else:
        w["old"] = (a - 0.5) / 0.5
        w["young"] = 1 - w["old"]
    return w


def _tri_w(v: float, lo: str, mid: str, hi: str):
    if v < 0.5:
        return {lo: (0.5 - v) * 2, mid: 1 - (0.5 - v) * 2, hi: 0.0}
    return {lo: 0.0, mid: 1 - (v - 0.5) * 2, hi: (v - 0.5) * 2}


def macro_targets(m: Macro) -> list[tuple[str, float]]:
    """The weighted macro target list, matching MakeHuman's MacroModifier combination rules."""
    out = []
    gw, aw = _gender_w(m), _age_w(m)
    mw = _tri_w(m.muscle, "minmuscle", "averagemuscle", "maxmuscle")
    ww = _tri_w(m.weight, "minweight", "averageweight", "maxweight")
    total = m.african + m.asian + m.caucasian
    races = {"african": m.african / total, "asian": m.asian / total, "caucasian": m.caucasian / total}
    for g, gv in gw.items():
        for a, av in aw.items():
            if gv * av < 1e-6:
                continue
            for r, rv in races.items():
                out.append((f"macrodetails/{r}-{g}-{a}", rv * gv * av))
            for mu, muv in mw.items():
                for we, wev in ww.items():
                    w = gv * av * muv * wev
                    if w < 1e-6:
                        continue
                    out.append((f"macrodetails/universal-{g}-{a}-{mu}-{we}", w))
                    hmax, hmin = max(0.0, m.height - 0.5) * 2, max(0.0, 0.5 - m.height) * 2
                    if hmax > 0:
                        out.append((f"macrodetails/height/{g}-{a}-{mu}-{we}-maxheight", w * hmax))
                    if hmin > 0:
                        out.append((f"macrodetails/height/{g}-{a}-{mu}-{we}-minheight", w * hmin))
                    if a != "baby":
                        pi, pu = max(0.0, m.proportions - 0.5) * 2, max(0.0, 0.5 - m.proportions) * 2
                        if pi > 0:
                            out.append((f"macrodetails/proportions/{g}-{a}-{mu}-{we}-idealproportions", w * pi))
                        if pu > 0:
                            out.append((f"macrodetails/proportions/{g}-{a}-{mu}-{we}-uncommonproportions", w * pu))
    return [(t, w) for t, w in out if w > 1e-6]


def morph(base: np.ndarray, macro: Macro, details: dict[str, float] | None = None) -> np.ndarray:
    v = base.copy()
    for rel, w in macro_targets(macro):
        apply_target(v, rel, w)
    for rel, w in (details or {}).items():
        apply_target(v, rel, w)
    return v


# ------------------------------------------------------------------------------------------ proxies
@dataclass
class Proxy:
    name: str
    obj: ObjMesh
    refs: np.ndarray        # (N, 3) base vertex indices
    weights: np.ndarray     # (N, 3)
    offsets: np.ndarray     # (N, 3)
    scales: dict            # axis -> (v0, v1, ref)
    material: str = ""
    delete_verts: np.ndarray | None = None

    def fit(self, human: np.ndarray) -> np.ndarray:
        """Proxy vertex positions on a morphed human (MakeHuman space)."""
        size = np.ones(3)
        for i, ax in enumerate("xyz"):
            if ax in self.scales:
                a, b, ref = self.scales[ax]
                size[i] = abs(human[a, i] - human[b, i]) / ref
        p = (human[self.refs] * self.weights[..., None]).sum(axis=1)
        return p + self.offsets * size


def load_proxy(folder: str) -> Proxy:
    d = os.path.join(DATA, "proxies", folder)
    mhclo = [f for f in os.listdir(d) if f.endswith(".mhclo")][0]
    refs, wts, offs, scales = [], [], [], {}
    objfile, material = None, ""
    delete = []
    mode = None
    with open(os.path.join(d, mhclo), encoding="utf-8", errors="replace") as fh:
        for line in fh:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            p = s.split()
            # vertex lines may follow other keyword lines after "verts N" (e.g. shoes: material, weights file)
            if mode == "verts" and len(p) in (1, 9) and p[0].lstrip("-").isdigit():
                if len(p) == 9:
                    refs.append([int(p[0]), int(p[1]), int(p[2])])
                    wts.append([float(p[3]), float(p[4]), float(p[5])])
                    offs.append([float(p[6]), float(p[7]), float(p[8])])
                    continue
                refs.append([int(p[0])] * 3)
                wts.append([1.0, 0.0, 0.0])
                offs.append([0.0, 0.0, 0.0])
                continue
            if mode == "delete_verts" and p[0][0].isdigit():
                # "12 15 - 20 31-33": singles and inclusive ranges, with or without spaces round '-'
                toks = " ".join(p).replace("-", " - ").split()
                i = 0
                while i < len(toks):
                    if i + 2 < len(toks) and toks[i + 1] == "-":
                        delete.extend(range(int(toks[i]), int(toks[i + 2]) + 1))
                        i += 3
                    else:
                        delete.append(int(toks[i]))
                        i += 1
                continue
            if mode != "verts" or p[0] == "delete_verts":
                mode = None
            if p[0] == "verts":
                mode = "verts"
            elif p[0] == "delete_verts":
                mode = "delete_verts"
            elif p[0] == "obj_file":
                objfile = p[1]
            elif p[0] == "material":
                material = p[1]
            elif p[0] in ("x_scale", "y_scale", "z_scale"):
                scales[p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
    obj = load_obj(os.path.join(d, objfile))
    return Proxy(folder, obj, np.array(refs), np.array(wts), np.array(offs), scales, material,
                 np.array(delete, np.int64) if delete else None)


def load_mhmat(path: str) -> dict:
    out = {}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            k, _, v = s.partition(" ")
            out[k] = v.strip()
    return out


# ------------------------------------------------------------------------------------ rig, weights
def load_rig(name: str = "mixamo_unity") -> dict:
    with open(os.path.join(DATA, "rig", f"rig.{name}.json")) as fh:
        return json.load(fh)


def load_weights(name: str = "mixamo_unity") -> dict:
    with open(os.path.join(DATA, "rig", f"weights.{name}.json")) as fh:
        return json.load(fh)["weights"]


def load_vertex_groups() -> dict[str, np.ndarray]:
    with open(os.path.join(DATA, "basemesh_vertex_groups.json")) as fh:
        raw = json.load(fh)
    out = {}
    for name, ranges in raw.items():
        idx = []
        for r in ranges:
            if isinstance(r, list) and len(r) == 2:
                idx.extend(range(r[0], r[1] + 1))
            elif isinstance(r, int):
                idx.append(r)
        out[name] = np.array(idx, np.int64)
    return out


def joint_position(spec: dict, verts: np.ndarray, groups: dict[str, np.ndarray]) -> np.ndarray:
    """Evaluates an MPFB rig joint spec ('CUBE', 'MEAN', 'VERTEX', 'XYZ') against MakeHuman-space verts."""
    st = spec.get("strategy")
    if st == "CUBE":
        return verts[groups[spec["cube_name"]]].mean(axis=0)
    if st == "MEAN":
        return verts[np.asarray(spec["vertex_indices"])].mean(axis=0)
    if st == "VERTEX":
        return verts[int(spec["vertex_index"])].copy()
    if st == "XYZ":
        idx = spec["vertex_indices"]
        return np.array([verts[idx[0], 0], verts[idx[1], 1], verts[idx[2], 2]])
    raise ValueError(f"unknown joint strategy {st}")


# ------------------------------------------------------------------------------------- conversion
SCALE = 0.1  # decimetres -> metres


def to_blender(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, np.float64)
    return np.stack([v[..., 0], -v[..., 2], v[..., 1]], axis=-1) * SCALE


def mirror_table() -> np.ndarray:
    """Index of the mirrored vertex for every base vertex (identity on the midline)."""
    pairs = {}
    with open(os.path.join(DATA, "hm08.mirror")) as fh:
        for line in fh:
            p = line.split()
            if len(p) >= 2:
                pairs[int(p[0])] = int(p[1])
    n = max(pairs) + 1
    out = np.arange(n)
    for a, b in pairs.items():
        out[a] = b
    return out
