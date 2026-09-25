"""Builds test/fixtures/labpbr-test-pack.zip: a small synthetic LabPBR resource pack (128x, POM heights,
DirectX-style normals, specular) used to exercise the resource-pack import. Not a real pack's art."""
import io, json, math, os, random, zipfile
from PIL import Image

R = 128
random.seed(7)
OUT = os.path.join(os.path.dirname(__file__), 'fixtures', 'labpbr-test-pack.zip')


def cells(n):
    pts = [(random.random() * R, random.random() * R) for _ in range(n)]
    h = [[0.0] * R for _ in range(R)]
    for y in range(R):
        for x in range(R):
            d1 = d2 = 1e9
            for px, py in pts:
                for ox in (-R, 0, R):
                    for oy in (-R, 0, R):
                        d = math.hypot(x - px - ox, y - py - oy)
                        if d < d1: d1, d2 = d, d1
                        elif d < d2: d2 = d
            h[y][x] = min(1.0, (d2 - d1) / 9.0)
    return h


def maps(height, base, grey=False, alpha=None, smooth=70, f0=12):
    col = Image.new('RGBA', (R, R)); nrm = Image.new('RGBA', (R, R)); spc = Image.new('RGBA', (R, R))
    for y in range(R):
        for x in range(R):
            hv = height[y][x]
            n = random.random() * 0.12
            if grey:
                v = int(max(0, min(255, (0.55 + 0.35 * hv + n) * 255))); c = (v, v, v)
            else:
                c = tuple(int(max(0, min(255, b * (0.6 + 0.45 * hv + n)))) for b in base)
            a = 255 if alpha is None else alpha[y][x]
            col.putpixel((x, y), c + (a,))
            dx = height[y][(x + 1) % R] - height[y][x - 1]
            dy = height[(y + 1) % R][x] - height[y - 1][x]
            nx, ny, nz = -dx * 3, dy * 3, 1.0          # DirectX: +y points down the image
            l = math.sqrt(nx * nx + ny * ny + nz * nz); nx, ny = nx / l, ny / l
            nrm.putpixel((x, y), (int((nx * 0.5 + 0.5) * 255), int((ny * 0.5 + 0.5) * 255), int(200 + 55 * hv), max(1, int(hv * 255))))
            spc.putpixel((x, y), (smooth, f0, 0, 255))
    return col, nrm, spc


def png(img):
    b = io.BytesIO(); img.save(b, 'PNG'); return b.getvalue()


h = cells(18)
flat = [[0.5 + 0.1 * math.sin(x * 0.3) * math.cos(y * 0.2) for x in range(R)] for y in range(R)]
holes = [[255 if (x * 7 + y * 13) % 11 > 2 else 0 for x in range(R)] for y in range(R)]
files = {}
for name, args in {
    'stone': (h, (140, 138, 132)), 'cobblestone': (h, (120, 118, 112)), 'dirt': (flat, (120, 86, 58)),
    'grass_block_top': (flat, None, True), 'oak_leaves': (flat, None, True, holes),
}.items():
    col, nrm, spc = maps(*args)
    files[f'TestPack/assets/minecraft/textures/block/{name}.png'] = png(col)
    files[f'TestPack/assets/minecraft/textures/block/{name}_n.png'] = png(nrm)
    files[f'TestPack/assets/minecraft/textures/block/{name}_s.png'] = png(spc)
files['TestPack/pack.mcmeta'] = json.dumps({'pack': {'pack_format': 34, 'description': 'Synthetic LabPBR test pack'}}).encode()
files['TestPack/pack.png'] = png(Image.new('RGB', (64, 64), (90, 120, 80)))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in files.items(): z.writestr(k, v)
print(OUT, os.path.getsize(OUT))
