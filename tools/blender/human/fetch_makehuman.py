"""Fetch the CC0 MakeHuman / MPFB2 source data used by the human generator.

The repository keeps only what the current character (config.py) needs. Run this to restore the full
set after changing macro parameters (gender, age, ethnicity...) or detail targets:

    python tools/blender/human/fetch_makehuman.py            # fetch what is missing
    python tools/blender/human/fetch_makehuman.py --all      # every macro/detail/expression target

Sources (all CC0, see CREDITS.md):
  - MPFB2 (github.com/makehumancommunity/mpfb2): base mesh, morph targets, rig + weights, region masks
  - MakeHuman system asset pack (mirror1.makehuman.net): eye, teeth, tongue and clothing proxies
Needs git on PATH for the MPFB2 sparse checkout. Stdlib only otherwise.
"""
from __future__ import annotations

import io
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / "SourceArt" / "Characters" / "Human" / "makehuman"
MPFB_REPO = "https://github.com/makehumancommunity/mpfb2"
ASSET_PACK = "https://mirror1.makehuman.net/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip"
PROXIES = {
    "eyes_highpoly": ("eyes/high-poly", ("high-poly.mhclo", "high-poly.obj")),
    "teeth_base": ("teeth/teeth_base", ("teeth_base.mhclo", "teeth_base.obj", "teeth.mhmat", "teeth.png")),
    "tongue01": ("tongue/tongue01", ("tongue01.mhclo", "tongue01.obj", "tongue01.mhmat", "tongue01_diffuse.png")),
    "male_casualsuit06": ("clothes/male_casualsuit06", ("male_casualsuit06.mhclo", "male_casualsuit06.obj",
                                                        "male_casualsuit06.mhmat", "male_casualsuit06_diffuse.png",
                                                        "male_casualsuit06_normal.png", "male_casualsuit06_ao.png")),
    "shoes05": ("clothes/shoes05", ("shoes05.mhclo", "shoes05.obj", "shoes05.mhmat", "shoes05_diffuse.png")),
}


def needed_targets() -> set[str]:
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    import config  # noqa: E402
    import mh  # noqa: E402
    rel = {t for t, _ in mh.macro_targets(config.MACRO)} | set(config.DETAILS)
    return {r + ".target.gz" for r in rel}


def fetch_mpfb(full: bool) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        print(f"[mpfb2] sparse checkout of {MPFB_REPO}")
        subprocess.check_call(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", MPFB_REPO, tmp])
        subprocess.check_call(["git", "-C", tmp, "sparse-checkout", "set", "src/mpfb/data"])
        src = pathlib.Path(tmp) / "src" / "mpfb" / "data"
        DATA.mkdir(parents=True, exist_ok=True)
        shutil.copy(src / "3dobjs" / "base.obj", DATA / "base.obj")
        for f in ("basemesh_vertex_groups.json", "hm08.mirror"):
            shutil.copy(src / "mesh_metadata" / f, DATA / f)
        (DATA / "rig").mkdir(exist_ok=True)
        for f in ("rig.mixamo_unity.json", "weights.mixamo_unity.json"):
            shutil.copy(src / "rigs" / "standard" / f, DATA / "rig" / f)
        (DATA / "masks").mkdir(exist_ok=True)
        for m in ("lips", "ears", "eyelids", "face", "fingernails", "toenails", "inside-mouth", "aureolae"):
            shutil.copy(src / "textures" / f"mpfb_{m}.jpg", DATA / "masks" / f"mpfb_{m}.jpg")
        units = src / "targets" / "expression" / "units" / "caucasian"
        shutil.copytree(units, DATA / "targets" / "expression_units", dirs_exist_ok=True)
        tsrc = src / "targets"
        want = None if full else needed_targets()
        n = 0
        for p in tsrc.rglob("*.target.gz"):
            rel = p.relative_to(tsrc).as_posix()
            if rel.startswith("expression/"):
                continue
            if want is not None and rel not in want:
                continue
            dst = DATA / "targets" / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(p, dst)
            n += 1
        print(f"[mpfb2] {n} targets")


def fetch_proxies() -> None:
    missing = [k for k, (_, files) in PROXIES.items() if not all((DATA / "proxies" / k / f).exists() for f in files)]
    if not missing:
        print("[assets] proxies present")
        return
    print(f"[assets] downloading {ASSET_PACK}")
    data = urllib.request.urlopen(ASSET_PACK, timeout=600).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        for key in missing:
            folder, files = PROXIES[key]
            dst = DATA / "proxies" / key
            dst.mkdir(parents=True, exist_ok=True)
            for f in files:
                match = [n for n in names if n.replace("\\", "/").endswith(f"{folder}/{f}")]
                if not match:
                    sys.exit(f"{folder}/{f} not found in the asset pack")
                (dst / f).write_bytes(z.read(match[0]))
    print(f"[assets] {', '.join(missing)}")


if __name__ == "__main__":
    full = "--all" in sys.argv
    if full or not (DATA / "base.obj").exists() or not all((DATA / "targets" / t).exists() for t in needed_targets()):
        fetch_mpfb(full)
    fetch_proxies()
    os.chdir(ROOT)
