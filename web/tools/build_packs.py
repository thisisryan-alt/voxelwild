"""Build the resource packs that ship with the browser build (Settings > Block textures > Built-in packs).

Two packs, both free to redistribute:

  photoreal   "Voxelwild Photoreal": CC0 photogrammetry scans from Poly Haven (polyhaven.com) at 512x512 with
              full LabPBR data: colour, OpenGL normal, ambient occlusion, height (drives parallax occlusion
              mapping) and roughness. Ores are made here from the stone scan with mineral veins.
  soothing32  "Soothing 32" by Zughy (CC BY-SA 4.0, content.luanti.org/packages/Zughy/soothing32): the
              highest-rated texture pack on ContentDB, pixel art upscaled with hard edges.

Each pack is written as up to three strips (one square per Minecraft texture name, top to bottom) the page
decodes and feeds to the same converter as a user's own pack ZIP (src/main/respack.js):

  pack_<id>_color.webp   RGB colour, A = opacity (cutout textures) else 255
  pack_<id>_data.webp    photoreal only: greyscale columns, one per LabPBR channel, in DATA_CHANNELS order
                         (normal x, normal y, AO, height, smoothness, F0). Separate grey channels survive lossy
                         WebP (colour WebP subsamples chroma, which would mix a normal map's channels): 7 MB
                         instead of 16 MB lossless.
  packs.json             names, strips, credits, options

    python web/tools/build_packs.py            # downloads into web/tools/.pack_cache (git-ignored)
"""
import io
import json
import pathlib
import sys
import urllib.request
import zipfile

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "assets"
CACHE = pathlib.Path(__file__).resolve().parent / ".pack_cache"

# ------------------------------------------------------------------ photoreal (Poly Haven, CC0)

# Minecraft texture name -> Poly Haven asset (picked from contact sheets; see web/README.md)
PHOTOREAL = {
    "stone": "rock_surface",
    "dirt": "dirt",
    "grass_block_top": "leafy_grass",
    "sand": "sand_01",
    "gravel": "river_small_rocks",
    "snow": "snow_02",
    "bedrock": "dark_rock",
    "cobblestone": "cobblestone_floor_08",
    "oak_planks": "wood_planks",
    "bricks": "red_brick",
    "oak_log": "bark_brown_02",
    "birch_log": "tree_bark_03",
    "spruce_log": "pine_bark",
    "jungle_log": "jolcham_oak_bark_01",
    "sandstone": "old_sandstone_02",
    "red_sandstone": "red_laterite_soil_stones",
    "mud": "brown_mud_02",
}
DATA_CHANNELS = ["nx", "ny", "ao", "height", "smooth", "f0"]
MAPS = {"diff": "Diffuse", "nor_gl": "nor_gl", "ao": "AO", "disp": "Displacement", "rough": "Rough"}
SIZE = 512


def fetch(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "voxelwild-pack-builder"})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
    return path


def polyhaven(asset):
    """The 1K PNG maps of one Poly Haven texture, as float arrays halved to 512 (2x2 mean keeps it seamless)."""
    files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset}", CACHE / "polyhaven" / f"{asset}.json").read_text())
    out = {}
    for key, name in MAPS.items():
        url = files[name]["1k"]["png"]["url"]
        img = Image.open(fetch(url, CACHE / "polyhaven" / asset / url.rsplit("/", 1)[1]))
        a = np.asarray(img.convert("RGB" if key in ("diff", "nor_gl") else "I;16" if img.mode.startswith("I") else "L"), dtype=np.float64)
        if a.ndim == 2:
            a = a / (65535.0 if a.max() > 255 else 255.0)
        else:
            a = a / 255.0
        h, w = a.shape[:2]
        fy, fx = h // SIZE, w // SIZE          # per axis: some scans are 1:2 (squeezed to a square, still seamless)
        a = a[: SIZE * fy, : SIZE * fx].reshape(SIZE, fy, SIZE, fx, *a.shape[2:]).mean(axis=(1, 3))
        out[key] = a
    return out


def labpbr(m, metal=None, smooth_override=None):
    """Poly Haven maps -> (colour RGBA, _n RGBA, _s RGBA) uint8 arrays."""
    color = np.dstack([m["diff"], np.ones(m["diff"].shape[:2])])
    n = m["nor_gl"] * 2 - 1
    # height: stretch the scan's displacement to the full range (LabPBR: 1 = surface, 0 = a quarter block deep)
    d = m["disp"]
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    height = np.clip((d - lo) / max(hi - lo, 1e-4), 0, 1) * 0.94 + 0.06
    nrm = np.dstack([n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5, m["ao"], height])
    smooth = 1 - np.sqrt(np.clip(m["rough"], 0, 1)) if smooth_override is None else smooth_override
    f0 = np.full(smooth.shape, 10 / 255.0) if metal is None else np.where(metal > 0.5, 1.0, 10 / 255.0)
    spec = np.dstack([smooth, f0, np.zeros_like(smooth), np.ones_like(smooth)])
    to8 = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    return to8(color), to8(nrm), to8(spec)


def toroidal_blobs(rng, size, clusters, nuggets, radius):
    """A seamless 0..1 mask of mineral nuggets grouped in clusters (distances wrap around the tile)."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    mask = np.zeros((size, size))
    for _ in range(clusters):
        cx, cy = rng.uniform(0, size, 2)
        for _ in range(rng.integers(nuggets[0], nuggets[1] + 1)):
            px, py = cx + rng.normal(0, size * 0.06), cy + rng.normal(0, size * 0.06)
            r = rng.uniform(*radius) * size
            dx = np.abs(xx - px % size); dx = np.minimum(dx, size - dx)
            dy = np.abs(yy - py % size); dy = np.minimum(dy, size - dy)
            ang = np.arctan2(dy, dx)
            rr = r * (1 + 0.12 * np.sin(ang * 2 + rng.uniform(0, 6.28)) + 0.08 * np.sin(ang * 3 + rng.uniform(0, 6.28)))  # lumpy
            mask = np.maximum(mask, np.clip(1 - np.sqrt(dx * dx + dy * dy) / rr, 0, 1))
    return np.clip(mask * 2.2, 0, 1) ** 0.8


def ore(stone, kind, seed):
    """An ore block: the stone scan with raised, lit mineral nuggets whose normals follow their bumps."""
    rng = np.random.default_rng(seed)
    params = {
        "coal_ore": ((0.07, 0.07, 0.075), 0.55, None, (5, 3, 6), (0.03, 0.06)),
        "iron_ore": ((0.66, 0.46, 0.34), 0.60, None, (4, 3, 5), (0.028, 0.05)),
        "gold_ore": ((1.00, 0.76, 0.30), 0.30, True, (4, 3, 5), (0.022, 0.042)),
        "diamond_ore": ((0.38, 0.93, 0.90), 0.08, None, (3, 3, 4), (0.022, 0.04)),
    }[kind]
    tint, rough, metal, (clusters, nmin, nmax), radius = params
    m = {k: v.copy() for k, v in stone.items()}
    blob = toroidal_blobs(rng, SIZE, clusters, (nmin, nmax), radius)
    lum = m["diff"].mean(axis=2, keepdims=True)
    # the mineral keeps the rock's grain (and the scan's own shading), so it reads as embedded, not painted on
    grain = (lum - lum.mean()) / max(lum.std(), 1e-4)
    mineral = np.asarray(tint) * np.clip(0.85 + 0.22 * grain, 0.45, 1.3)
    m["diff"] = m["diff"] * (1 - blob[..., None]) + mineral * blob[..., None]
    m["disp"] = m["disp"] + blob * 0.35
    # nugget normals from the bump's slope, added to the rock's own
    gy, gx = np.gradient(blob * 6.0)
    n = m["nor_gl"] * 2 - 1
    n[..., 0] -= gx; n[..., 1] += gy
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    m["nor_gl"] = n * 0.5 + 0.5
    m["ao"] = m["ao"] * (1 - 0.35 * (blob > 0.02) * (1 - blob))       # crevices around the nuggets
    m["rough"] = m["rough"] * (1 - blob) + rough * blob
    return labpbr(m, metal=blob if metal else None)


def build_photoreal():
    colors, normals, specs, names = [], [], [], []
    stone = None
    for name, asset in PHOTOREAL.items():
        print(f"  {name:<16} {asset}")
        m = polyhaven(asset)
        if name == "stone":
            # the scan is warm brown-grey; pull it most of the way to neutral grey like Minecraft stone
            grey = m["diff"].mean(axis=2, keepdims=True)
            m["diff"] = grey + (m["diff"] - grey) * 0.3
            stone = m
        c, n, s = labpbr(m)
        colors.append(c); normals.append(n); specs.append(s); names.append(name)
    for i, kind in enumerate(("coal_ore", "iron_ore", "gold_ore", "diamond_ore")):
        print(f"  {kind:<16} rock_surface + minerals")
        c, n, s = ore(stone, kind, 1000 + i)
        colors.append(c); normals.append(n); specs.append(s); names.append(kind)
    return names, colors, normals, specs


# ------------------------------------------------------------------ Soothing 32 (Zughy, CC BY-SA 4.0)

SOOTHING_URL = "https://content.luanti.org/packages/Zughy/soothing32/download/"
PIXEL = 256          # 16 px art, 16x nearest-neighbour: sharp pixels at the renderer's texture size

# Minecraft name -> Soothing 32 file (Minetest Game names), optionally composed
SOOTHING = {
    "stone": "default_stone", "dirt": "default_dirt", "grass_block_top": "default_grass", "sand": "default_sand",
    "gravel": "default_gravel", "snow": "default_snow", "cobblestone": "default_cobble", "oak_planks": "default_wood",
    "bricks": "default_brick", "oak_log": "default_tree", "birch_log": "default_aspen_tree",
    "spruce_log": "default_pine_tree", "jungle_log": "default_jungletree", "oak_log_top": "default_tree_top",
    "oak_leaves": "default_leaves", "spruce_leaves": "default_pine_needles", "sandstone": "default_sandstone",
    "red_sandstone": "default_desert_sandstone", "ice": "default_ice", "short_grass": "default_grass_3",
    "poppy": "flowers_rose", "dandelion": "flowers_dandelion_yellow", "dead_bush": "default_dry_shrub",
    "bedrock": ("default_stone", 0.45), "mud": ("default_dirt", 0.62),
    "coal_ore": ("default_stone", "default_mineral_coal"), "iron_ore": ("default_stone", "default_mineral_iron"),
    "gold_ore": ("default_stone", "default_mineral_gold"), "diamond_ore": ("default_stone", "default_mineral_diamond"),
}


def build_soothing():
    z = zipfile.ZipFile(fetch(SOOTHING_URL, CACHE / "soothing32.zip"))
    index = {pathlib.PurePosixPath(n).stem: n for n in z.namelist() if n.endswith(".png")}
    license_text = z.read(next(n for n in z.namelist() if n.endswith("LICENSE"))).decode()
    assert "Attribution-ShareAlike 4.0" in license_text, "Soothing 32 licence changed: check before shipping"

    def img(stem):
        return Image.open(io.BytesIO(z.read(index[stem]))).convert("RGBA")

    names, colors = [], []
    for name, src in SOOTHING.items():
        if isinstance(src, tuple) and isinstance(src[1], float):
            im = img(src[0])
            a = np.asarray(im, dtype=np.float64)
            a[..., :3] *= src[1]
            im = Image.fromarray(a.astype(np.uint8), "RGBA")
        elif isinstance(src, tuple):
            im = img(src[0]); im.alpha_composite(img(src[1]))
        else:
            im = img(src)
        im = im.resize((PIXEL, PIXEL), Image.NEAREST)
        names.append(name); colors.append(np.asarray(im, dtype=np.uint8))
        print(f"  {name:<16} {src}")
    return names, colors


# ------------------------------------------------------------------ output

def strip(tiles, path, lossless):
    im = Image.fromarray(np.concatenate(tiles, axis=0), "RGBA")
    if lossless:
        im.save(path, lossless=True, method=6, exact=True)
    else:
        im.save(path, quality=92, alpha_quality=100, method=6, exact=True)
    return path.name


def data_strip(normals, specs, path):
    """_n (RG normal, B AO, A height) and _s (R smoothness, G F0) tiles as greyscale columns, lossy."""
    rows = [np.concatenate([n[..., 0], n[..., 1], n[..., 2], n[..., 3], s[..., 0], s[..., 1]], axis=1)
            for n, s in zip(normals, specs)]
    Image.fromarray(np.concatenate(rows, axis=0), "L").save(path, quality=90, method=6)
    return path.name


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    print("Voxelwild Photoreal (Poly Haven, CC0)")
    names, colors, normals, specs = build_photoreal()
    manifest.append({
        "id": "photoreal", "name": "Voxelwild Photoreal",
        "description": "Photo-scanned rock, soil, wood and brick at 512x512 with height, normal, AO and roughness maps.",
        "credit": "Scans: Poly Haven (polyhaven.com), CC0. Ores composed from the stone scan.",
        "license": "CC0", "size": SIZE, "names": names, "opts": {"normalYDown": False, "oldPbr": False},
        "strips": {"color": strip(colors, OUT / "pack_photoreal_color.webp", False),
                   "data": data_strip(normals, specs, OUT / "pack_photoreal_data.webp")},
        "dataChannels": DATA_CHANNELS,
    })

    print("Soothing 32 (Zughy, CC BY-SA 4.0)")
    names, colors = build_soothing()
    manifest.append({
        "id": "soothing32", "name": "Soothing 32",
        "description": "Clean 16x pixel art in a 32-colour palette: the top-rated pack on ContentDB.",
        "credit": "Soothing 32 by Zughy, CC BY-SA 4.0 (content.luanti.org/packages/Zughy/soothing32). Bedrock, mud and ores composed from its stone and dirt.",
        "license": "CC-BY-SA-4.0", "size": PIXEL, "names": names, "opts": {"normalYDown": False, "oldPbr": False},
        "strips": {"color": strip(colors, OUT / "pack_soothing32_color.webp", True)},
    })

    (OUT / "packs.json").write_text(json.dumps(manifest, indent=1))
    for p in sorted(OUT.glob("pack_*.webp")):
        print(f"{p.name}: {p.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    sys.exit(main())
