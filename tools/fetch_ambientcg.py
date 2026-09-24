"""Download the CC0 ambientCG materials listed in SourceArt/Textures/block_layers.json.

Only the maps the terrain pipeline uses are kept (Color, NormalGL, Roughness,
AmbientOcclusion, Displacement). Stdlib only, so it runs on any Python 3.9+.

    python tools/fetch_ambientcg.py            # fetch missing materials
    python tools/fetch_ambientcg.py --force    # re-download everything
"""
import io
import json
import pathlib
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "SourceArt" / "Textures" / "block_layers.json"
OUT = ROOT / "SourceArt" / "Textures" / "ambientCG"
KEEP = ("_Color.", "_NormalGL.", "_Roughness.", "_AmbientOcclusion.", "_Displacement.", "_Metalness.", "_Opacity.")
UA = {"User-Agent": "Mozilla/5.0 (voxelwild asset fetch)"}


def fetch(asset_id: str, resolution: str, force: bool) -> None:
    dest = OUT / asset_id
    if dest.exists() and any(dest.iterdir()) and not force:
        print(f"  {asset_id}: present")
        return
    url = f"https://ambientcg.com/get?file={asset_id}_{resolution}-JPG.zip"
    print(f"  {asset_id}: downloading {url}")
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
    dest.mkdir(parents=True, exist_ok=True)
    kept = 0
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in z.namelist():
            if any(k in name for k in KEEP):
                (dest / pathlib.Path(name).name).write_bytes(z.read(name))
                kept += 1
    if kept == 0:
        sys.exit(f"{asset_id}: archive contained no usable maps")


def main() -> None:
    force = "--force" in sys.argv
    manifest = json.loads(MANIFEST.read_text())
    res = f"{manifest['resolution'] // 1024}K"
    for layer in manifest["layers"]:
        if layer["source"] == "ambientCG":
            fetch(layer["id"], res, force)


if __name__ == "__main__":
    main()
