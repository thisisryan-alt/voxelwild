"""Pack the block texture layers into three WebP strips for the browser build.

Same sources and layer order as the Unity Texture2DArrays (SourceArt/Textures/block_layers.json):
  albedo.webp  RGB colour, A = opacity for cutout sets, else height
  normal.webp  RGB OpenGL tangent-space normal
  mask.webp    R AO, G roughness, B metallic, A emission
Each strip is SIZE wide and SIZE * layers tall (layer 0 at the top), uploaded with texImage3D.

    python web/tools/build_textures.py [--size 256]
"""
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "SourceArt" / "Textures"
OUT = ROOT / "web" / "assets"


def find(folder: pathlib.Path, suffix: str):
    for f in sorted(folder.iterdir()):
        if f.stem.lower().endswith(suffix.lower()):
            return f
    return None


def load(folder, suffix, size, mode, fallback):
    f = find(folder, suffix)
    if f is None:
        if fallback is None:
            sys.exit(f"{folder}: missing *{suffix}")
        return Image.new(mode, (size, size), fallback)
    return Image.open(f).convert(mode).resize((size, size), Image.LANCZOS)


def main():
    size = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 256
    manifest = json.loads((SRC / "block_layers.json").read_text())
    layers = manifest["layers"]
    n = len(layers)
    albedo = Image.new("RGBA", (size, size * n))
    normal = Image.new("RGB", (size, size * n))
    mask = Image.new("RGBA", (size, size * n))
    for i, layer in enumerate(layers):
        d = SRC / layer["source"] / layer["id"]
        color = load(d, "_Color", size, "RGB", None)
        has_opacity = find(d, "_Opacity") is not None
        a = load(d, "_Opacity" if has_opacity else "_Displacement", size, "L", 128)
        if has_opacity:
            # alpha-tested sprites: bleed colour into transparent texels so filtering never pulls in black
            px = color.load(); ap = a.load()
            blurred = color.resize((max(1, size // 16),) * 2, Image.BILINEAR).resize((size, size), Image.BILINEAR)
            bp = blurred.load()
            for y in range(size):
                for x in range(size):
                    if ap[x, y] < 128:
                        px[x, y] = bp[x, y]
        r, g, b = color.split()
        albedo.paste(Image.merge("RGBA", (r, g, b, a)), (0, i * size))
        normal.paste(load(d, "_NormalGL", size, "RGB", (128, 128, 255)), (0, i * size))
        ao = load(d, "_AmbientOcclusion", size, "L", 255)
        rough = load(d, "_Roughness", size, "L", 200)
        metal = load(d, "_Metalness", size, "L", 0)
        emis = load(d, "_Emission", size, "L", 0)
        mask.paste(Image.merge("RGBA", (ao, rough, metal, emis)), (0, i * size))
        print(f"  {i:2d} {layer['name']:<13} {'opacity' if has_opacity else 'height '}")
    OUT.mkdir(parents=True, exist_ok=True)
    # exact: keep RGB under zero alpha (mask data under emission=0, bled colour under transparent foliage)
    albedo.save(OUT / "albedo.webp", quality=90, alpha_quality=100, method=6, exact=True)
    # data textures must not go through lossy YUV 4:2:0 (it mixes channels and bends normals)
    normal.save(OUT / "normal.webp", lossless=True, method=6, exact=True)
    mask.save(OUT / "mask.webp", lossless=True, method=6, exact=True)
    names = [l["name"] for l in layers]
    (OUT / "layers.json").write_text(json.dumps({"size": size, "layers": names}))
    for f in ("albedo.webp", "normal.webp", "mask.webp"):
        print(f"{f}: {(OUT / f).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
