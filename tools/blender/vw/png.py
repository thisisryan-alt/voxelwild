"""Minimal deterministic PNG writer (8-bit RGB/RGBA), so the bake needs nothing beyond Blender's numpy."""

import struct
import zlib

import numpy as np


def _chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, pixels):
    """pixels: uint8 array (height, width, 3 or 4), rows top to bottom."""
    a = np.ascontiguousarray(pixels, dtype=np.uint8)
    h, w, c = a.shape
    colour_type = {3: 2, 4: 6}[c]
    # filter type 1 (Sub) per row: small, fast and deterministic
    rows = a.reshape(h, w * c).astype(np.int16)
    sub = rows.copy()
    sub[:, c:] = (rows[:, c:] - rows[:, :-c]) & 0xFF
    raw = np.empty((h, w * c + 1), dtype=np.uint8)
    raw[:, 0] = 1
    raw[:, 1:] = sub.astype(np.uint8)
    data = (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, colour_type, 0, 0, 0))
            + _chunk(b"IDAT", zlib.compress(raw.tobytes(), 9))
            + _chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)
