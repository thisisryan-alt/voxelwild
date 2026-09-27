"""Bake "LB Photo Realism Reload!" (1LotS) into the browser build's default block materials.

    python web/tools/build_lbpr.py "<path>/LBPR Reload! v.6.6 for mc1.21.8.zip"

LBPR is a 128px colour-only Java pack that leans on Minecraft's model system for its look: weighted random
texture variants per block (blockstates), OptiFine "repeat" CTM (one big seamless picture spread over 4x4 or 5x5
blocks), grey textures that Minecraft tints with the biome colour, and sprite-like leaves on extra planes. This
tool turns that into what the WebGL renderer understands:

  assets/lbpr/albedo.webp  RGB colour, A = opacity (cutout layers) or height (for parallax occlusion mapping)
  assets/lbpr/normal.webp  RGB OpenGL tangent-space normal   } generated from the colour: the pack has no
  assets/lbpr/mask.webp    R AO, G roughness, B metal, A emission } normal or specular maps
  assets/lbpr/lbpr.json    per-layer tuning, the variant table (random picks / repeat grids), credits
  assets/lbpr/items.webp   64px item icons, assets/lbpr/crack.webp  destroy stages, assets/lbpr/moon.webp
  assets/lbpr/*.ogg        the pack's sounds the game has a use for

Strips are SIZE wide and SIZE * layers tall; the first 35 layers are the game's layers (blocks.js LAYER_NAMES),
extra variant / repeat-tile layers follow.

Licence (Licence.txt in the pack): the textures may be used any way as long as the author is credited with a link
to the CurseForge page and no money is made from them. The credit ships in lbpr.json and is shown in the game.
"""
import io
import json
import pathlib
import sys
import zipfile

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "lbpr"
BUILTIN = ROOT / "assets"
SIZE = 128
SLOTS = 32
PART = 120

LAYER_NAMES = ['Stone', 'Dirt', 'GrassTop', 'Sand', 'Gravel', 'Snow', 'Bedrock', 'Cobblestone', 'Planks', 'Bricks',
               'OakLog', 'BirchLog', 'SpruceLog', 'JungleLog', 'LogTop', 'Leaves', 'Needles', 'Sandstone', 'RedSandstone', 'Mud', 'Moss', 'Ice',
               'CoalOre', 'IronOre', 'GoldOre', 'DiamondOre', 'GrassTuft', 'FlowerRed', 'FlowerYellow', 'DeadBush', 'Glowcap', 'Torch', 'TorchTop',
               'Cactus', 'CactusTop',
               # the Nether, the End and strongholds (blocks.js)
               'Lava', 'Obsidian', 'NetherPortal', 'Netherrack', 'NetherQuartzOre', 'NetherGoldOre', 'Glowstone', 'SoulSand', 'SoulSoil', 'BasaltTop',
               'BasaltSide', 'BlackstoneTop', 'Blackstone', 'Magma', 'NetherBricks', 'CrimsonNylium', 'CrimsonNyliumSide', 'WarpedNylium',
               'WarpedNyliumSide', 'CrimsonStem', 'CrimsonStemTop', 'WarpedStem', 'WarpedStemTop', 'NetherWart', 'WarpedWart', 'Shroomlight',
               'CrimsonFungus', 'WarpedFungus', 'CrimsonRoots', 'WarpedRoots', 'WeepingVines', 'TwistingVines', 'EndStone', 'EndStoneBricks', 'Purpur',
               'EndFrameTop', 'EndFrameSide', 'EndFrameEye', 'EndPortal', 'ChorusPlant', 'ChorusFlower', 'StoneBricks', 'MossyStoneBricks',
               'CrackedStoneBricks', 'LeavesExt', 'NeedlesExt']
# rows of the variant table past the layers: textures only reached through another layer
VIRTUAL = ['GrassSideOverlay', 'SnowSideOverlay']

# Minecraft's default biome colours (plains) for textures it paints grey
MC_GRASS = (0x91, 0xbd, 0x59)
MC_FOLIAGE = (0x77, 0xab, 0x2f)
MC_SPRUCE = (0x61, 0x99, 0x61)

# variant-table flags
ROT_TOP = 1      # random quarter turns on top/bottom faces
MIRROR = 2       # random horizontal mirror (side faces, plants)

T = "assets/minecraft/textures/"
CREDIT = {
    "name": "LB Photo Realism Reload!",
    "version": "6.6 for Minecraft 1.21.8",
    "author": "1LotS",
    "url": "https://www.curseforge.com/minecraft/texture-packs/lb-photo-realism-reload",
    "based_on": "LB Photo Realism (LB) and GKrond's version of LBPR",
    "licence": "Textures may be used any way with credit (link to the CurseForge page) and not for money.",
    "sounds": "freesfx.co.uk, orangefreesounds.com (edited by 1LotS)",
}


class Pack:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.names = set(self.z.namelist())

    def img(self, rel, frame=True):
        im = Image.open(io.BytesIO(self.z.read(T + rel + ".png"))).convert("RGBA")
        if frame and im.height > im.width:          # animated strip: first frame
            im = im.crop((0, 0, im.width, im.width))
        return im

    def has(self, rel):
        return T + rel + ".png" in self.names

    def raw(self, path):
        return self.z.read(path)


# ---------------------------------------------------------------- image helpers (float arrays, wrap-around)

def arr(im):
    return np.asarray(im.convert("RGBA"), dtype=np.float32) / 255.0


def to_img(a, mode="RGBA"):
    return Image.fromarray(np.clip(np.round(a * 255), 0, 255).astype(np.uint8), mode)


def fit(im, size=SIZE):
    return im if im.size == (size, size) else im.resize((size, size), Image.LANCZOS)


def blur(x, sigma):
    """Gaussian blur of a 2-D array with wrap-around edges (textures tile)."""
    if sigma <= 0:
        return x
    h, w = x.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(x) * g)).astype(np.float32)


def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def tint(a, rgb):
    a = a.copy()
    for c in range(3):
        a[..., c] *= rgb[c] / 255.0
    return a


def bleed(a):
    """Colour under transparent texels = blurred colour of the opaque ones (no dark fringes in filtering/mips)."""
    w = (a[..., 3] > 0.5).astype(np.float32)
    out = a.copy()
    s = max(1.0, a.shape[0] / 32)
    den = blur(w, s) + 1e-4
    for c in range(3):
        fill = blur(a[..., c] * w, s) / den
        far = blur(a[..., c] * w, s * 6) / (blur(w, s * 6) + 1e-4)
        k = np.clip(den * 3, 0, 1)
        fill = fill * k + far * (1 - k)
        out[..., c] = np.where(w > 0, a[..., c], fill)
    return out


def over(dst, src, dx=0, dy=0, rot=0, flip=False):
    """src composited over dst with a wrap-around offset (keeps the result tileable)."""
    s = src
    if flip:
        s = s[:, ::-1]
    s = np.rot90(s, rot)
    s = np.roll(s, (dy, dx), axis=(0, 1))
    a = s[..., 3:4]
    out = dst.copy()
    out[..., :3] = s[..., :3] * a + dst[..., :3] * dst[..., 3:4] * (1 - a)
    out[..., 3:4] = a + dst[..., 3:4] * (1 - a)
    out[..., :3] /= np.maximum(out[..., 3:4], 1e-4)
    return out


# ---------------------------------------------------------------- generated surface maps

def surface_maps(a, m):
    """Height, normal, AO, roughness from the colour. m: material dict (see MATERIALS)."""
    L = lum(a)
    if m.get("height_from") == "red":           # bricks: the bricks are red, the mortar grey and lighter
        L = a[..., 0] - (a[..., 1] + a[..., 2]) * 0.5
    if m.get("invert"):
        L = -L
    alpha = a[..., 3]
    if m.get("cutout"):
        L = L * 0.6 + alpha * 0.4                # sprites: the silhouette carries most of the shape
    detail = L - blur(L, a.shape[0] / 10)
    broad = L - blur(L, a.shape[0] / 3)
    hsrc = detail * (1 - m.get("broad", 0.35)) + broad * m.get("broad", 0.35)
    hsrc = blur(hsrc, m.get("soft", 0.7))
    z = (hsrc - hsrc.mean()) / (hsrc.std() + 1e-5)
    h = np.clip(0.62 + 0.19 * z, 0.0, 1.0)
    # normal (OpenGL: green = up the texture = toward row 0)
    s = m.get("normal", 1.5) * a.shape[0] / 128.0
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * s * 4
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * s * 4
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    # cavity AO
    cav = np.clip(blur(h, a.shape[0] / 24) - h, 0, None)
    ao = np.clip(1.0 - cav * m.get("ao", 2.2), 0.3, 1.0)
    # roughness: base, crevices rougher, bright/raised bits a little smoother
    r = np.clip(m.get("rough", 0.85) + (0.5 - h) * m.get("rough_var", 0.2), 0.04, 1.0)
    return h, n, ao, r


# pom: relief depth in blocks. Textures cover one block (tile 1), so the parallax shift is not divided by a
# multi-block tiling as with the game's own art: keep it shallow or grazing views smear.
MATERIALS = {
    'Stone': dict(rough=0.82, normal=1.8, pom=0.025),
    'Dirt': dict(rough=0.95, normal=1.6, pom=0.02, rot=ROT_TOP),
    'GrassTop': dict(rough=0.92, normal=1.3, pom=0.012, rot=ROT_TOP, biome=1),
    'Sand': dict(rough=0.9, normal=1.1, pom=0.012),
    'Gravel': dict(rough=0.85, normal=2.4, pom=0.03, broad=0.2),
    'Snow': dict(rough=0.72, normal=0.9, pom=0.008, rot=ROT_TOP),
    'Bedrock': dict(rough=0.8, normal=2.8, pom=0.035),
    'Cobblestone': dict(rough=0.8, normal=2.6, pom=0.045, broad=0.55, ao=3.0),
    'Planks': dict(rough=0.68, normal=1.2, pom=0.012),
    'Bricks': dict(rough=0.82, normal=2.0, pom=0.035, height_from="red", broad=0.6, ao=3.0),
    'OakLog': dict(rough=0.82, normal=2.2, pom=0.02),
    'BirchLog': dict(rough=0.7, normal=1.6, pom=0),
    'SpruceLog': dict(rough=0.82, normal=2.2, pom=0.02),
    'JungleLog': dict(rough=0.82, normal=2.2, pom=0.02),
    'LogTop': dict(rough=0.7, normal=1.3, pom=0.012, rot=ROT_TOP),
    'Leaves': dict(rough=0.75, normal=1.4, cutout=1, biome=1, trans=0.9, spec=0.4, rot=ROT_TOP | MIRROR),
    'Needles': dict(rough=0.8, normal=1.4, cutout=1, biome=1, trans=0.5, spec=0.3, rot=ROT_TOP | MIRROR),
    'Sandstone': dict(rough=0.85, normal=1.6, pom=0.02, broad=0.5),
    'RedSandstone': dict(rough=0.85, normal=1.6, pom=0.02, broad=0.5),
    'Mud': dict(rough=0.42, normal=1.2, pom=0.015, rough_var=0.35, rot=ROT_TOP),
    'Moss': dict(rough=0.95, normal=1.6, pom=0.012, rot=ROT_TOP),
    'Ice': dict(rough=0.08, normal=0.5, pom=0.0, spec=1.0),
    'CoalOre': dict(rough=0.8, normal=2.0, pom=0.025),
    'IronOre': dict(rough=0.8, normal=2.0, pom=0.025),
    'GoldOre': dict(rough=0.8, normal=2.0, pom=0.025),
    'DiamondOre': dict(rough=0.8, normal=2.0, pom=0.025),
    'GrassTuft': dict(rough=0.75, normal=1.0, cutout=1, biome=1, trans=1.0, spec=0.3, rot=MIRROR),
    'FlowerRed': dict(rough=0.6, normal=1.0, cutout=1, trans=0.7, spec=0.5, rot=MIRROR),
    'FlowerYellow': dict(rough=0.6, normal=1.0, cutout=1, trans=0.7, spec=0.5, rot=MIRROR),
    'DeadBush': dict(rough=0.8, normal=1.0, cutout=1, trans=0.4, spec=0.4, rot=MIRROR),
    'Glowcap': dict(builtin=True, cutout=1, emission=5, trans=0.4),
    'Torch': dict(rough=0.7, normal=1.0, emission=9),
    'TorchTop': dict(rough=0.7, normal=0.5, emission=9),
    'Cactus': dict(rough=0.55, normal=1.8, pom=0.015),
    'CactusTop': dict(rough=0.55, normal=1.4, pom=0.012, rot=ROT_TOP),
    'Lava': dict(rough=0.55, normal=1.3, emission=3, glow=0.3),
    'Obsidian': dict(rough=0.22, normal=1.2, pom=0.012, spec=1.6),
    'NetherPortal': dict(rough=0.4, normal=0.6, cutout=1, emission=4, glow=0.0),
    'Netherrack': dict(rough=0.85, normal=2.0, pom=0.02),
    'NetherQuartzOre': dict(rough=0.75, normal=2.0, pom=0.02),
    'NetherGoldOre': dict(rough=0.75, normal=2.0, pom=0.02),
    'Glowstone': dict(rough=0.6, normal=1.6, emission=3.2, glow=0.3),
    'SoulSand': dict(rough=0.95, normal=1.8, pom=0.02),
    'SoulSoil': dict(rough=0.95, normal=1.6, pom=0.015),
    'BasaltTop': dict(rough=0.8, normal=1.6, pom=0.015, rot=ROT_TOP),
    'BasaltSide': dict(rough=0.8, normal=2.0, pom=0.02),
    'BlackstoneTop': dict(rough=0.8, normal=1.6, pom=0.015, rot=ROT_TOP),
    'Blackstone': dict(rough=0.8, normal=1.8, pom=0.02),
    'Magma': dict(rough=0.7, normal=1.8, pom=0.015, emission=3, glow=0.35),
    'NetherBricks': dict(rough=0.8, normal=1.8, pom=0.025, broad=0.55, ao=3.0),
    'CrimsonNylium': dict(rough=0.9, normal=1.4, pom=0.012, rot=ROT_TOP),
    'CrimsonNyliumSide': dict(rough=0.9, normal=1.6, pom=0.015),
    'WarpedNylium': dict(rough=0.9, normal=1.4, pom=0.012, rot=ROT_TOP),
    'WarpedNyliumSide': dict(rough=0.9, normal=1.6, pom=0.015),
    'CrimsonStem': dict(rough=0.8, normal=2.0, pom=0.015),
    'CrimsonStemTop': dict(rough=0.75, normal=1.3, pom=0.01, rot=ROT_TOP),
    'WarpedStem': dict(rough=0.8, normal=2.0, pom=0.015),
    'WarpedStemTop': dict(rough=0.75, normal=1.3, pom=0.01, rot=ROT_TOP),
    'NetherWart': dict(rough=0.9, normal=1.5, pom=0.012),
    'WarpedWart': dict(rough=0.9, normal=1.5, pom=0.012),
    'Shroomlight': dict(rough=0.7, normal=1.4, emission=3.5, glow=0.2),
    'CrimsonFungus': dict(rough=0.7, normal=1.0, cutout=1, trans=0.5, rot=MIRROR),
    'WarpedFungus': dict(rough=0.7, normal=1.0, cutout=1, trans=0.5, rot=MIRROR),
    'CrimsonRoots': dict(rough=0.8, normal=1.0, cutout=1, trans=0.6, rot=MIRROR),
    'WarpedRoots': dict(rough=0.8, normal=1.0, cutout=1, trans=0.6, rot=MIRROR),
    'WeepingVines': dict(rough=0.8, normal=1.0, cutout=1, trans=0.6, rot=MIRROR),
    'TwistingVines': dict(rough=0.8, normal=1.0, cutout=1, trans=0.6, rot=MIRROR),
    'EndStone': dict(rough=0.85, normal=1.6, pom=0.02, rot=ROT_TOP),
    'EndStoneBricks': dict(rough=0.75, normal=1.6, pom=0.02, broad=0.55),
    'Purpur': dict(rough=0.7, normal=1.5, pom=0.015, broad=0.55),
    'EndFrameTop': dict(rough=0.6, normal=1.4, pom=0.01),
    'EndFrameSide': dict(rough=0.65, normal=1.6, pom=0.015),
    'EndFrameEye': dict(rough=0.45, normal=1.4, pom=0.01, emission=2, glow=0.5),
    'EndPortal': dict(rough=1.0, normal=0.0),
    'ChorusPlant': dict(rough=0.7, normal=1.5, cutout=1, trans=0.3),
    'ChorusFlower': dict(rough=0.6, normal=1.4, cutout=1, trans=0.4),
    'StoneBricks': dict(rough=0.82, normal=1.8, pom=0.025, broad=0.55, ao=3.0),
    'MossyStoneBricks': dict(rough=0.88, normal=1.8, pom=0.025, broad=0.55, ao=3.0),
    'CrackedStoneBricks': dict(rough=0.85, normal=2.0, pom=0.03, broad=0.55, ao=3.0),
    'LeavesExt': dict(rough=0.75, normal=1.4, cutout=1, biome=1, trans=0.9, spec=0.4),
    'NeedlesExt': dict(rough=0.8, normal=1.4, cutout=1, biome=1, trans=0.5, spec=0.3),
}
# Nether, End and stronghold layers: pack texture (first animation frame), made opaque where the block is a full cube
SIMPLE = {
    'Lava': "block/lava_still", 'Obsidian': "block/obsidian", 'NetherPortal': "block/nether_portal", 'Netherrack': "block/netherrack",
    'NetherQuartzOre': "block/nether_quartz_ore", 'NetherGoldOre': "block/nether_gold_ore", 'Glowstone': "block/glowstone",
    'SoulSand': "block/soul_sand", 'SoulSoil': "block/soul_soil", 'BasaltTop': "block/basalt_top", 'BasaltSide': "block/basalt_side",
    'BlackstoneTop': "block/blackstone_top", 'Blackstone': "block/blackstone", 'Magma': "block/magma", 'NetherBricks': "block/nether_bricks",
    'CrimsonNylium': "block/crimson_nylium", 'CrimsonNyliumSide': "block/crimson_nylium_side", 'WarpedNylium': "block/warped_nylium",
    'WarpedNyliumSide': "block/warped_nylium_side", 'CrimsonStem': "block/crimson_stem", 'CrimsonStemTop': "block/crimson_stem_top",
    'WarpedStem': "block/warped_stem", 'WarpedStemTop': "block/warped_stem_top", 'NetherWart': "block/nether_wart_block",
    'WarpedWart': "block/warped_wart_block", 'Shroomlight': "block/shroomlight", 'CrimsonFungus': "block/crimson_fungus",
    'WarpedFungus': "block/warped_fungus", 'CrimsonRoots': "block/crimson_roots", 'WarpedRoots': "block/warped_roots",
    'WeepingVines': "block/weeping_vines_plant", 'TwistingVines': "block/twisting_vines_plant", 'EndStone': "block/end_stone",
    'EndStoneBricks': "block/end_stone_bricks", 'Purpur': "block/purpur_block", 'EndFrameTop': "block/end_portal_frame_top",
    'EndFrameSide': "block/end_portal_frame_side", 'EndPortal': "block/obsidian", 'ChorusPlant': "block/chorus_plant",
    'ChorusFlower': "block/chorus_flower", 'StoneBricks': "block/stone_bricks", 'MossyStoneBricks': "block/mossy_stone_bricks",
    'CrackedStoneBricks': "block/cracked_stone_bricks",
}
# animations: (texture, frames to keep, frames per second after thinning)
ANIMS = {'Lava': ("block/lava_still", 20, 10), 'NetherPortal': ("block/nether_portal", 32, 5), 'Magma': ("block/magma", 3, 1.3),
         'CrimsonStem': ("block/crimson_stem", 6, 4), 'WarpedStem': ("block/warped_stem", 6, 4)}


# ---------------------------------------------------------------- composed textures

def dense_leaves(p, main, extra):
    """LBPR leaves are sparse sprites for its multi-plane models; our leaves are cutout cubes, so layer a few
    wrapped copies into a denser, still tileable face."""
    a = arr(fit(p.img(main)))
    b = arr(fit(p.img(extra))) if extra else a
    out = a.copy()
    for dx, dy, rot, flip, src in [(64, 64, 1, False, b), (32, 96, 2, True, a), (96, 32, 3, False, b), (0, 64, 0, True, a)]:
        if (out[..., 3] > 0.5).mean() > 0.78:
            break
        # add behind (darker, as inner foliage) so the top sprite stays crisp
        back = src.copy(); back[..., :3] *= 0.72
        back = np.roll(np.rot90(back[:, ::-1] if flip else back, rot), (dy, dx), axis=(0, 1))
        out = over(np.ascontiguousarray(back), out)
    return out


def tips(alpha, n):
    """x positions and top rows of the n highest stem tips in a sprite."""
    cols = []
    H, W = alpha.shape
    for x in range(W):
        ys = np.nonzero(alpha[:, x] > 0.5)[0]
        if len(ys):
            cols.append((ys[0], x))
    cols.sort()
    picked = []
    for y, x in cols:
        if all(abs(x - px) > W // 6 for _, px in picked):
            picked.append((y, x))
        if len(picked) == n:
            break
    return picked


def flower(p, stems, leaves, blossom, heads=3, head_px=44):
    """A cross-plant sprite from LBPR's model parts: stems, a leaf rosette at the foot, blossoms on the tips."""
    out = np.zeros((SIZE, SIZE, 4), np.float32)
    st = arr(fit(p.img(stems)))
    out = over(out, st)
    if leaves:
        lf = arr(p.img(leaves).resize((SIZE // 2, SIZE // 2), Image.LANCZOS))
        canvas = np.zeros_like(out)
        canvas[SIZE // 2:, SIZE // 4:SIZE // 4 + SIZE // 2] = lf
        out = over(out, canvas)
    bl = p.img(blossom)
    bw = bl.width // 2
    quads = [bl.crop((x, y, x + bw, y + bw)) for y in (0, bw) for x in (0, bw)]
    for i, (y, x) in enumerate(tips(st[..., 3], heads)):
        q = quads[i % 4]
        bb = q.getbbox()
        if bb:
            q = q.crop(bb)
        k = head_px / max(q.size)
        q = q.resize((max(1, int(q.width * k)), max(1, int(q.height * k))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE))
        canvas.paste(q, (int(x - q.width / 2), int(y - q.height * 0.55)))
        out = over(out, arr(canvas))
    return out


def torch_texture(p):
    """LBPR's torch picture squeezed onto the game's torch box (u 7..9/16, v 6..16/16 of the block, like Minecraft)."""
    im = p.img("block/torch")
    bb = im.getbbox()
    crop = im.crop(bb)
    x0, x1, y0, y1 = SIZE * 7 // 16, SIZE * 9 // 16, SIZE * 6 // 16, SIZE
    body = crop.resize((x1 - x0, y1 - y0), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE))
    canvas.paste(body, (x0, y0))
    a = arr(canvas)
    a = bleed(a)
    a[..., 3] = 1
    # top face: the flame's colour
    top = np.asarray(crop.crop((0, 0, crop.width, max(1, crop.height // 6))).convert("RGBA"), np.float32) / 255
    w = top[..., 3:4]
    flame = (top[..., :3] * w).sum((0, 1)) / max(1e-4, w.sum())
    t = np.ones((SIZE, SIZE, 4), np.float32)
    t[..., :3] = flame
    return a, t


def flame_emission(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    warm = np.clip((r - b) * 2.0, 0, 1) * np.clip((lum(a) - 0.35) * 2.5, 0, 1)
    return np.clip(warm * 1.3, 0, 1)


def opaque(a, under):
    out = a.copy()
    k = a[..., 3:4]
    out[..., :3] = a[..., :3] * k + np.array(under, np.float32)[None, None] / 255 * (1 - k)
    out[..., 3] = 1
    return out


def snow_side_overlay(p):
    a = arr(fit(p.img("block/grass_block_snow")))
    L = lum(a)
    sat = (a[..., :3].max(-1) - a[..., :3].min(-1)) / np.maximum(a[..., :3].max(-1), 1e-3)
    snow = (L > 0.55) & (sat < 0.25)
    # the snow is the top band: keep it where it connects to row 0
    rows = snow.mean(1)
    cut = next((y for y in range(SIZE) if rows[y] < 0.15), SIZE // 3)
    alpha = np.zeros((SIZE, SIZE), np.float32)
    alpha[:cut] = 1
    alpha[cut:cut + SIZE // 6] = snow[cut:cut + SIZE // 6]
    alpha = np.clip(blur(alpha, 0.8) * 1.4 - 0.2, 0, 1)
    a[..., 3] = alpha
    return bleed(a)


# ---------------------------------------------------------------- layer sources

def weighted_slots(entries):
    """[(tex_index, weight)] -> SLOTS texture indices, proportional (each entry at least one slot)."""
    total = sum(w for _, w in entries)
    counts = [max(1, round(w / total * SLOTS)) for _, w in entries]
    while sum(counts) > SLOTS:
        counts[counts.index(max(counts))] -= 1
    while sum(counts) < SLOTS:
        counts[counts.index(max(counts))] += 1
    out = []
    for (t, _), c in zip(entries, counts):
        out += [t] * c
    # interleave so neighbouring hash values do not favour one variant
    return [out[(i * 13) % SLOTS] for i in range(SLOTS)]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    p = Pack(sys.argv[1])
    textures = []          # list of float RGBA arrays (SIZE x SIZE); index = texture layer
    materials = []         # parallel: material dict used for its maps
    names = []

    def add(a, mat, name):
        textures.append(a); materials.append(mat); names.append(name)
        return len(textures) - 1

    table = {}             # row name -> dict(mode, w, h, flags, slots, side)
    base = {}

    def colour(rel, layer):
        a = arr(fit(p.img(rel)))
        if layer == 'GrassTop':
            a = tint(a, MC_GRASS)
        return a

    # 1) the 35 base layers (layer i = texture i)
    builtin = None
    for i, name in enumerate(LAYER_NAMES):
        m = MATERIALS[name]
        if name == 'Stone': a = colour("block/stone", name)
        elif name == 'Dirt': a = colour("block/dirt", name)
        elif name == 'GrassTop': a = colour("block/grass_block_top", name)
        elif name == 'Sand': a = colour("block/sand", name)
        elif name == 'Gravel': a = colour("block/gravel", name)
        elif name == 'Snow': a = colour("block/snow", name)
        elif name == 'Bedrock': a = opaque(arr(fit(p.img("block/bedrock"))), (30, 30, 30))
        elif name == 'Cobblestone': a = opaque(arr(fit(p.img("block/cobblestone"))), (60, 60, 60))
        elif name == 'Planks': a = colour("block/oak_planks", name)
        elif name == 'Bricks': a = colour("block/bricks", name)
        elif name == 'OakLog': a = opaque(arr(fit(p.img("block/oak_log"))), (60, 45, 30))
        elif name == 'BirchLog': a = opaque(arr(fit(p.img("block/birch_log"))), (200, 200, 190))
        elif name == 'SpruceLog': a = colour("block/spruce_log", name)
        elif name == 'JungleLog': a = opaque(arr(fit(p.img("block/jungle_log"))), (70, 55, 35))
        elif name == 'LogTop': a = colour("block/oak_log_top", name)
        elif name == 'Leaves': a = bleed(tint(dense_leaves(p, "block/oak_leaves_branches", "block/oak_leaves_better"), MC_FOLIAGE))
        elif name == 'Needles': a = bleed(tint(dense_leaves(p, "block/spruce_leaves", None), MC_SPRUCE))
        elif name == 'Sandstone': a = opaque(arr(fit(p.img("block/sandstone"))), (200, 180, 130))
        elif name == 'RedSandstone': a = opaque(arr(fit(p.img("block/red_sandstone"))), (170, 90, 40))
        elif name == 'Mud': a = colour("block/mud", name)
        elif name == 'Moss': a = colour("block/moss_block", name)
        elif name == 'Ice': a = opaque(arr(fit(p.img("block/ice"))), (170, 200, 230))
        elif name == 'CoalOre': a = colour("block/coal_ore", name)
        elif name == 'IronOre': a = colour("block/iron_ore", name)
        elif name == 'GoldOre': a = colour("block/gold_ore", name)
        elif name == 'DiamondOre': a = colour("block/diamond_ore", name)
        elif name == 'GrassTuft': a = bleed(tint(arr(fit(p.img("block/grass"))), MC_GRASS))
        elif name == 'FlowerRed': a = bleed(flower(p, "block/poppy_stems1", "block/poppy_leaves_1", "block/poppy_blossom", heads=3))
        elif name == 'FlowerYellow': a = bleed(flower(p, "block/dandelion_stems_1", "block/dandelion_leaves", "block/dandelion_blossom", heads=3, head_px=40))
        elif name == 'DeadBush': a = bleed(arr(fit(p.img("block/dead_bush"))))
        elif name == 'Glowcap':
            builtin = builtin or load_builtin()
            a = None
        elif name == 'Torch': a, torch_top = torch_texture(p)
        elif name == 'TorchTop': a = torch_top
        elif name == 'Cactus': a = bleed(opaque(bleed(arr(fit(p.img("block/cactus_side")))), (60, 110, 50)))
        elif name == 'CactusTop': a = opaque(arr(fit(p.img("block/cactus_top"))), (60, 110, 50))
        elif name == 'LeavesExt': a = bleed(tint(arr(fit(p.img("block/oak_leaves_better"))), MC_FOLIAGE))
        elif name == 'NeedlesExt': a = bleed(tint(arr(fit(p.img("block/spruce_leaves_better"))), MC_SPRUCE))
        elif name == 'EndFrameEye':
            # the frame top with the eye set in it
            a = arr(fit(p.img("block/end_portal_frame_top")))
            a = over(a, arr(fit(p.img("block/end_portal_frame_eye"))))
            a[..., 3] = 1
        elif name in SIMPLE:
            a = arr(fit(p.img(SIMPLE[name])))
            if not m.get("cutout"):
                avg = (a[..., :3] * a[..., 3:4]).sum((0, 1)) / max(1e-4, a[..., 3].sum())
                a = opaque(a, tuple(int(v * 255) for v in avg))
            else:
                a = bleed(a)
        if a is None:
            add(None, m, name)
        else:
            add(a, m, name)
        base[name] = i

    def variants(layer, rels, weights, prep=None):
        """rels: pack texture paths, or ready arrays; weights[0] is the base layer's."""
        m = MATERIALS[layer]
        entries = [(base[layer], weights[0])]
        for k, (rel, w) in enumerate(zip(rels, weights[1:])):
            if isinstance(rel, str):
                a = arr(fit(p.img(rel)))
                a = prep(a) if prep else a
            else:
                a = rel
            entries.append((add(a, m, f"{layer}:{k + 1}"), w))
        table[layer] = dict(mode=1, flags=m.get("rot", 0), slots=weighted_slots(entries))

    def repeat(layer, folder, w, h):
        """OptiFine method=repeat: tile (x mod w, y mod h); maps are computed on the whole mosaic so they stay seamless."""
        m = MATERIALS[layer]
        tiles = [arr(fit(Image.open(io.BytesIO(p.raw(f"assets/minecraft/optifine/ctm/{folder}/{k}.png"))).convert("RGBA")))
                 for k in range(w * h)]
        mosaic = np.zeros((h * SIZE, w * SIZE, 4), np.float32)
        for k, t in enumerate(tiles):
            y, x = divmod(k, w)
            mosaic[y * SIZE:(y + 1) * SIZE, x * SIZE:(x + 1) * SIZE] = t
        idx = []
        for k in range(w * h):
            y, x = divmod(k, w)
            idx.append(add(("mosaic", mosaic, x, y), m, f"{layer}:repeat{k}"))
        table[layer] = dict(mode=2, w=w, h=h, flags=0, slots=idx + [idx[0]] * (SLOTS - len(idx)))

    repeat('Stone', 'stone', 4, 4)
    repeat('Sand', 'sand', 5, 5)
    repeat('Gravel', 'gravel', 4, 4)
    variants('Dirt', ["block/random/dirt/dirt_clay", "block/random/dirt/dirt_gravel1", "block/random/dirt/dirt_gravel2"], [50, 1, 1, 1])
    variants('GrassTop', [f"block/random/grass_block_top/grass_block_top{k}" for k in (1, 2, 3)], [14, 14, 7, 7], lambda a: tint(a, MC_GRASS))
    variants('Cobblestone', [f"block/random/cobblestone/cobblestone{k}" for k in (1, 2, 3, 4)], [1, 1, 1, 1, 1], lambda a: opaque(a, (60, 60, 60)))
    variants('OakLog', [f"block/random/oak_log/oak_log_{k}" for k in (2, 3, 4)], [1, 1, 1, 1], lambda a: opaque(a, (60, 45, 30)))
    grass = [("block/random/grass/grass2", 60), ("block/random/grass/grass3", 100), ("block/random/grass/grass4", 68),
             ("block/random/grass/grass5", 68), ("block/random/grass/grass6", 68), ("block/random/grass/grass7", 60),
             ("block/random/grass/grass8", 60), ("block/random/grass/grass9", 300), ("block/random/grass/grass10", 80),
             ("block/random/grass/grass11", 40), ("block/random/grass/grass12", 40)]
    variants('GrassTuft', [g for g, _ in grass], [100] + [w for _, w in grass], lambda a: bleed(tint(a, MC_GRASS)))
    variants('Leaves', [bleed(tint(dense_leaves(p, "block/oak_leaves_better", "block/oak_leaves_branches"), MC_FOLIAGE))], [3, 1])
    variants('DeadBush', ["block/dry_branch1"], [5, 1], bleed)
    for layer in ('Snow', 'Mud', 'Moss', 'LogTop', 'CactusTop', 'Planks', 'Needles', 'FlowerRed', 'FlowerYellow'):
        flags = MATERIALS[layer].get("rot", 0)
        if layer == 'Planks':
            flags = MIRROR                 # LBPR: cube_mirrored_all half the time
        if flags:
            table[layer] = dict(mode=1, flags=flags, slots=[base[layer]] * SLOTS)

    # animated layers: frames thinned to fit 32 slots, blended in the shader
    def frames(rel):
        im = p.img(rel, frame=False)
        w = im.width
        return [im.crop((0, k * w, w, (k + 1) * w)) for k in range(im.height // w)]
    for layer, (rel, keep, fps) in ANIMS.items():
        m = MATERIALS[layer]
        fr = frames(rel)
        step = max(1, len(fr) // keep)
        fr = fr[::step][:keep]
        idx = [base[layer]]
        for k, f in enumerate(fr[1:]):
            a = arr(fit(f))
            a = bleed(a) if m.get("cutout") else opaque(a, (80, 20, 10))
            idx.append(add(a, m, f"{layer}:frame{k + 1}"))
        table[layer] = dict(mode=3, w=len(idx), h=int(round(fps * 10)), flags=0, slots=idx + [idx[0]] * (SLOTS - len(idx)))

    # height bands (OptiFine method=fixed with min/maxHeight): netherrack and nether bricks lit by the lava sea
    def ctm(folder, name):
        return arr(fit(Image.open(io.BytesIO(p.raw(f"assets/minecraft/optifine/ctm/{folder}/{name}.png"))).convert("RGBA")))
    ALL, SIDES, BOTTOM = 7, 1, 4
    glow_n = add(opaque(ctm("netherrack", "netherrack_glow"), (90, 30, 25)), MATERIALS['Netherrack'], "Netherrack:glow")
    lava_n = add(opaque(ctm("netherrack", "netherrack_lava"), (120, 40, 20)), dict(MATERIALS['Netherrack'], emission=1.5, glow=0.45), "Netherrack:lava")
    table['Netherrack'] = dict(mode=4, w=2, flags=0, slots=[base['Netherrack']] * SLOTS, bands=[[glow_n, 35, 38, ALL], [lava_n, 0, 34, ALL]])
    above_b = add(opaque(ctm("nether_bricks", "nether_bricks_above"), (60, 20, 20)), MATERIALS['NetherBricks'], "NetherBricks:above")
    lava_b = add(opaque(ctm("nether_bricks", "nether_bricks_lava"), (90, 30, 20)), dict(MATERIALS['NetherBricks'], emission=1.5, glow=0.45), "NetherBricks:lava")
    table['NetherBricks'] = dict(mode=4, w=3, flags=0, slots=[base['NetherBricks']] * SLOTS,
                                 bands=[[above_b, 33, 33, SIDES], [lava_b, 33, 33, BOTTOM], [lava_b, 0, 32, ALL]])

    # virtual rows: grass and snow side overlays (Minecraft-style fringe over the dirt side)
    ov = [add(bleed(tint(arr(fit(p.img("block/grass_block_side_overlay"))), MC_GRASS)), MATERIALS['GrassTop'], "GrassSideOverlay")]
    for k in range(1, 6):
        ov.append(add(bleed(tint(arr(fit(p.img(f"block/random/grass_block_overlay/grass_block_side_overlay{k}"))), MC_GRASS)),
                      MATERIALS['GrassTop'], f"GrassSideOverlay{k}"))
    table['GrassSideOverlay'] = dict(mode=1, flags=MIRROR, slots=weighted_slots([(t, 1) for t in ov]))
    sn = add(snow_side_overlay(p), MATERIALS['Snow'], "SnowSideOverlay")
    table['SnowSideOverlay'] = dict(mode=1, flags=MIRROR, slots=[sn] * SLOTS)
    table.setdefault('GrassTop', dict(mode=0, flags=0, slots=[base['GrassTop']] * SLOTS))['side'] = 'GrassSideOverlay'
    table.setdefault('Snow', dict(mode=0, flags=0, slots=[base['Snow']] * SLOTS))['side'] = 'SnowSideOverlay'

    # 2) maps
    n = len(textures)
    if n > 255:
        sys.exit(f"{n} texture layers: more than the variant table can address")
    A = np.zeros((SIZE * n, SIZE, 4), np.float32)
    N = np.zeros((SIZE * n, SIZE, 3), np.float32)
    M = np.zeros((SIZE * n, SIZE, 4), np.float32)
    mosaic_maps = {}
    builtin = builtin or load_builtin()
    for i, (t, m, nm) in enumerate(zip(textures, materials, names)):
        sl = slice(i * SIZE, (i + 1) * SIZE)
        if t is None:                                   # the game's own art (Glowcap)
            A[sl], N[sl], M[sl] = builtin(LAYER_NAMES.index(nm))
            continue
        if isinstance(t, tuple):                         # a tile of a repeat mosaic
            _, mosaic, x, y = t
            key = id(mosaic)
            if key not in mosaic_maps:
                mosaic_maps[key] = (mosaic,) + surface_maps(mosaic, m)
            mo, h, nn, ao, r = mosaic_maps[key]
            ys, xs = slice(y * SIZE, (y + 1) * SIZE), slice(x * SIZE, (x + 1) * SIZE)
            a = mo[ys, xs]; h = h[ys, xs]; nn = nn[ys, xs]; ao = ao[ys, xs]; r = r[ys, xs]
        else:
            a = t
            h, nn, ao, r = surface_maps(a, m)
        cut = m.get("cutout")
        A[sl, :, :3] = a[..., :3]
        A[sl, :, 3] = a[..., 3] if cut else np.maximum(h, 1 / 255)
        N[sl] = nn * 0.5 + 0.5
        emis = np.zeros_like(h)
        if m.get("glow") is not None:
            L = lum(a)
            emis = np.clip((L - m["glow"]) / max(0.05, 1 - m["glow"]) * 1.6, 0, 1) if nm.split(':')[0] != 'EndFrameEye' else \
                np.clip((a[..., 1] - a[..., 0]) * 3, 0, 1)
        if nm in ('Torch', 'TorchTop'):
            emis = flame_emission(a) if nm == 'Torch' else np.ones_like(h)
        metal = np.zeros_like(h)
        if nm.startswith('GoldOre') or nm.startswith('NetherGoldOre'):
            rr, gg, bb = a[..., 0], a[..., 1], a[..., 2]
            metal = np.clip(((rr + gg) * 0.5 - bb - 0.25) * 4, 0, 1)
            r = r * (1 - metal * 0.6)
        if nm.startswith('DiamondOre') or nm.startswith('Ice'):
            sat = a[..., 2] - a[..., 0]
            r = r * (1 - np.clip(sat * 3, 0, 0.7))
        M[sl] = np.stack([ao, r, metal, emis], -1)

    OUT.mkdir(parents=True, exist_ok=True)
    # WebP is limited to 16383 px a side: strips of at most PART layers (albedo.webp, albedo.1.webp, ...)
    parts = (n + PART - 1) // PART
    for k in range(parts):
        sl = slice(k * PART * SIZE, min(n, (k + 1) * PART) * SIZE)
        sfx = "" if k == 0 else f".{k}"
        to_img(A[sl]).save(OUT / f"albedo{sfx}.webp", quality=92, alpha_quality=100, method=6, exact=True)
        to_img(N[sl], "RGB").save(OUT / f"normal{sfx}.webp", lossless=True, method=6, exact=True)
        to_img(M[sl]).save(OUT / f"mask{sfx}.webp", lossless=True, method=6, exact=True)

    # 3) tuning (renderer uLP/uLT/uLP2/uLP3) and the variant table
    tuning = []
    for name in LAYER_NAMES:
        m = MATERIALS[name]
        t = dict(tile=1, normal=1, rough=1, macro=0.05 if not m.get("cutout") else 0.12, tint=[1, 1, 1], spec=m.get("spec", 1),
                 emission=m.get("emission", 0), trans=m.get("trans", 0), biome=m.get("biome", 0), cutout=m.get("cutout", 0),
                 pom=m.get("pom", 0))
        if name == 'Glowcap':
            t.update(tile=1, macro=0)
        tuning.append(t)
    rows = []
    for name in LAYER_NAMES + VIRTUAL:
        e = table.get(name)
        if name in LAYER_NAMES and e is None:
            e = dict(mode=0, flags=0, slots=[LAYER_NAMES.index(name)] * SLOTS)
        rows.append(dict(name=name, mode=e["mode"], w=e.get("w", 1), h=e.get("h", 1), flags=e["flags"], slots=e["slots"],
                         side=(LAYER_NAMES + VIRTUAL).index(e["side"]) if e.get("side") else 255, **({"bands": e["bands"]} if e.get("bands") else {})))

    # 3b) the block catalog (src/shared/catalog.json): colour only, in parts of PART textures; normal and material maps
    # are generated in the browser (shared/surface.js)
    catalog = json.loads((ROOT / "src" / "shared" / "catalog.json").read_text())
    tints = {}
    for b in catalog["blocks"]:
        for t in (b["top"], b["side"], b["bottom"]):
            if b.get("tint"):
                tints[t] = {"foliage": MC_FOLIAGE, "grass": MC_GRASS, "birch": (0x80, 0xa7, 0x55), "spruce": MC_SPRUCE}[b["tint"]]
    for t, info in catalog.get("texinfo", {}).items():
        if info.get("tint"):
            tints[t] = {"foliage": MC_FOLIAGE, "grass": MC_GRASS}[info["tint"]]
    def texture_expr(p, t):
        """'@rotN:x' turns x by N degrees, '@tint:rrggbb:x' multiplies a grey texture, '@crop:path:x,y,w,h' cuts a
        rectangle (in 64-pixel units) out of any texture (entity textures), otherwise a block texture."""
        if t.startswith("@rot"):
            n, rest = t[4:].split(":", 1)
            return np.ascontiguousarray(np.rot90(texture_expr(p, rest), -int(n) // 90))
        if t.startswith("@tint:"):
            c, rest = t[6:].split(":", 1)
            a = texture_expr(p, rest).copy()
            g = a[..., :3].mean(axis=2, keepdims=True)
            rgb = np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255
            a[..., :3] = np.clip(g / max(g.max(), 1e-3) * rgb, 0, 1)
            return a
        if t.startswith("@frame:"):
            k, rest = t[7:].split(":", 1)
            im = p.img("block/" + rest, frame=False)
            w = im.width
            return arr(fit(im.crop((0, int(k) * w, w, (int(k) + 1) * w))))
        if t.startswith("@bright:"):
            a = texture_expr(p, t[8:]).copy()
            a[..., :3] = a[..., :3] * 0.35 + 0.65
            return a
        if t.startswith("@crop:"):
            path, rect = t[6:].rsplit(":", 1)
            x, y, w, h = [int(v) for v in rect.split(",")]
            im = Image.open(io.BytesIO(p.raw(T + path + ".png"))).convert("RGBA")
            k = im.width / 64
            im = im.crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k)))
            return arr(fit(im))
        return arr(fit(p.img("block/" + t)))

    cat = []
    for t in catalog["textures"]:
        if t.startswith("@dense:"):
            a = dense_leaves(p, "block/" + t[7:], None)
        else:
            a = texture_expr(p, t)
        if t in tints:
            a = tint(a, tints[t])
        if a[..., 3].min() < 0.99:
            a = bleed(a)
        cat.append(a)
    cparts = (len(cat) + PART - 1) // PART
    for k in range(cparts):
        strip = np.concatenate(cat[k * PART:(k + 1) * PART], axis=0)
        to_img(strip).save(OUT / f"catalog{'' if k == 0 else '.' + str(k)}.webp", quality=90, alpha_quality=100, method=6, exact=True)

    # 4) items, crack stages, moon, sounds
    items = {"Stick": "stick", "Coal": "coal", "IronChunk": "raw_iron", "GoldChunk": "raw_gold", "Diamond": "diamond",
             "Apple": "apple", "Berries": "sweet_berries", "Flint": "flint", "FlintAndSteel": "flint_and_steel", "NetherQuartz": "quartz",
             "GlowstoneDust": "glowstone_dust", "EyeOfEnder": "ender_eye", "RawCopper": "raw_copper", "Emerald": "emerald",
             "LapisLazuli": "lapis_lazuli", "Redstone": "redstone", "Beef": "beef", "Porkchop": "porkchop", "Mutton": "mutton",
             "RawChicken": "chicken", "Feather": "feather", "Leather": "leather", "RottenFlesh": "rotten_flesh", "Bone": "bone", "Arrow": "arrow",
             "Gunpowder": "gunpowder", "String": "string", "GoldNugget": "gold_nugget", "BlazeRod": "blaze_rod", "GhastTear": "ghast_tear",
             "WoodenSword": "wooden_sword", "StoneSword": "stone_sword", "IronSword": "iron_sword", "DiamondSword": "diamond_sword"}
    for tier in ("wooden", "stone", "iron", "diamond"):
        for tool in ("pickaxe", "axe", "shovel", "hoe"):
            items[f"{tier.capitalize()}{tool.capitalize()}"] = f"{tier}_{tool}"
    items.update({"IronIngot": "iron_ingot", "GoldIngot": "gold_ingot", "CopperIngot": "copper_ingot", "CookedBeef": "cooked_beef",
                  "CookedPorkchop": "cooked_porkchop", "CookedMutton": "cooked_mutton", "CookedChicken": "cooked_chicken", "Charcoal": "charcoal",
                  "Bread": "bread", "Wheat": "wheat", "WheatSeeds": "wheat_seeds"})
    for mi, m in enumerate(["leather", "golden", "iron", "diamond"]):
        for pi, pc in enumerate(["helmet", "chestplate", "leggings", "boots"]):
            items[f"{m.capitalize()}{pc.capitalize()}"] = f"{m}_{pc}"
    # shaped blocks that show as flat items in Minecraft (key 'fam:<family>')
    for w in ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo", "crimson", "warped",
              "iron", "copper", "exposed_copper", "weathered_copper", "oxidized_copper"]:
        items[f"fam:{w}_door"] = f"{w}_door"
    items.update({"FlameBlade": "golden_sword", "BoneGreatsword": "netherite_sword", "CloudBottle": "glass_bottle", "BlazingCore": "fire_charge",
                  "BoneCrown": "bone_meal", "StormTear": "ghast_tear", "Frostbrand": "amethyst_shard", "FrozenHeart": "heart_of_the_sea",
                  "FishingRod": "fishing_rod", "Cod": "cod", "Salmon": "salmon", "CookedCod": "cooked_cod", "CookedSalmon": "cooked_salmon",
                  "GoldenApple": "golden_apple", "EnchantedGoldenApple": "golden_apple", "Totem": "totem_head", "BoneMeal": "bone_meal"})
    items.update({"Backpack": "bundle", "GrapplingHook": "lead", "SlimeCrown": "golden_helmet", "SleepingBag": "green_bundle"})
    items.update({"SlimeBall": "slime_ball", "Bow": "bow", "Bucket": "bucket", "WaterBucket": "water_bucket", "LavaBucket": "lava_bucket", "fam:comparator": "comparator",
                  "fam:hopper": "hopper"})
    items.update({"fam:repeater": "repeater", "fam:redstone_torch": "block/redstone_torch", "fam:lever": "block/lever",
                  "fam:ladder": "block/ladder", "fam:rail": "block/rail", "fam:powered_rail": "block/powered_rail",
                  "fam:detector_rail": "block/detector_rail", "fam:activator_rail": "block/activator_rail", "fam:red_bed": "red_bed"})
    good = {}
    for key, name in items.items():
        try:
            good[key] = p.img(name if name.startswith("block/") else "item/" + name)
        except Exception:
            print("no item texture", name)
    for key in list(good):
        if key.startswith("Leather") and key != "Leather":        # undyed leather armour is brown
            a = np.asarray(good[key].convert("RGBA"), dtype=np.float32)
            a[..., :3] *= np.array([0xa0, 0x65, 0x40], dtype=np.float32) / 255 * 1.6
            good[key] = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    keys = list(good)
    strip = Image.new("RGBA", (64, 64 * len(keys)))
    for k, key in enumerate(keys):
        im = good[key].resize((64, 64), Image.LANCZOS)
        strip.paste(im, (0, k * 64))
    strip.save(OUT / "items.webp", quality=92, alpha_quality=100, method=6)

    # the end portal's star layers
    stars = Image.open(io.BytesIO(p.raw(T + "entity/end_portal.png"))).convert("RGBA")
    stars.resize((256, 256), Image.LANCZOS).save(OUT / "stars.webp", quality=92, method=6)

    crack = Image.new("RGBA", (SIZE, SIZE * 10))
    for k in range(10):
        crack.paste(fit(p.img(f"block/destroy_stage_{k}")), (0, k * SIZE))
    crack.save(OUT / "crack.webp", lossless=True, method=6)

    moon = Image.open(io.BytesIO(p.raw(T + "environment/moon_phases.png"))).convert("RGBA")
    cw = moon.width // 4
    full = moon.crop((0, 0, cw, cw))
    disc = np.asarray(full.convert("L")) > 30          # the full moon's disc, cropped tight
    ys, xs = np.nonzero(disc)
    full.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).resize((128, 128), Image.LANCZOS).save(OUT / "moon.webp", quality=92, method=6)

    sounds = {"rain": ["ambient/weather/rain1", "ambient/weather/rain2"], "stoneBreak": ["break/stone1", "break/stone2", "break/stone3"],
              "grassStep": ["step/grass1"], "pop": ["random/pop2", "random/pop3"], "water": ["liquid/water"],
              "waterfall": ["liquid/waterfall"]}
    for group in sounds.values():
        for s in group:
            (OUT / (s.replace("/", "_") + ".ogg")).write_bytes(p.raw(f"assets/minecraft/sounds/{s}.ogg"))
    sound_files = {k: [s.replace("/", "_") + ".ogg" for s in v] for k, v in sounds.items()}

    meta = dict(size=SIZE, layers=n, parts=parts, baseLayers=len(LAYER_NAMES), catalog=dict(count=len(cat), parts=cparts), slots=SLOTS, names=names, tuning=tuning, variants=rows, items=keys, sounds=sound_files,
                credit=CREDIT, licence=p.raw("Licence.txt").decode("utf-8", "replace").strip())
    (OUT / "lbpr.json").write_text(json.dumps(meta, indent=1))
    for f in sorted(OUT.iterdir()):
        print(f"{f.name}: {f.stat().st_size / 1e6:.2f} MB")
    print(f"{n} texture layers ({n - len(LAYER_NAMES)} variant / repeat tiles)")


def load_builtin():
    """The game's own texture strips, for layers LBPR has no counterpart for (Glowcap)."""
    al = np.asarray(Image.open(BUILTIN / "albedo.webp").convert("RGBA"), np.float32) / 255
    no = np.asarray(Image.open(BUILTIN / "normal.webp").convert("RGB"), np.float32) / 255
    ma = np.asarray(Image.open(BUILTIN / "mask.webp").convert("RGBA"), np.float32) / 255
    s = al.shape[1]

    def get(i):
        sl = slice(i * s, (i + 1) * s)
        f = lambda x, mode: np.asarray(to_img(x[sl], mode).resize((SIZE, SIZE), Image.LANCZOS), np.float32) / 255
        return f(al, "RGBA"), f(no, "RGB"), f(ma, "RGBA")
    return get


if __name__ == "__main__":
    main()
