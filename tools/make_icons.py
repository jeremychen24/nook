"""Draws the app icons from a 16x16 pixel map. Run from the repo root: python tools/make_icons.py"""

import struct
import zlib
from pathlib import Path

PALETTE = {
    '.': (0x16, 0x17, 0x1A),  # charcoal background
    'a': (0xE2, 0xA6, 0x5B),  # mug
    'h': (0xF3, 0xC9, 0x8A),  # mug highlight
    'd': (0x9C, 0x6B, 0x34),  # saucer
    'c': (0x5A, 0x3A, 0x22),  # coffee
    'w': (0x8D, 0x91, 0x99),  # steam
}

ART = [
    "................",
    "................",
    "......w..w......",
    ".....w..w.......",
    "......w..w......",
    ".....w..w.......",
    "................",
    "...aaaaaaaaa....",
    "...accccccca....",
    "...ahaaaaaaaaa..",
    "...ahaaaaaaa.a..",
    "...ahaaaaaaaaa..",
    "...ahaaaaaaa....",
    "....aaaaaaa.....",
    "..ddddddddddd...",
    "................",
]
assert all(len(row) == len(ART) for row in ART)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size):
    grid = len(ART)
    scale = size // grid
    pad = (size - grid * scale) // 2
    raw = bytearray()
    for y in range(size):
        gy = (y - pad) // scale
        raw.append(0)  # no filter
        for x in range(size):
            gx = (x - pad) // scale
            ch = ART[gy][gx] if 0 <= gy < grid and 0 <= gx < grid else '.'
            raw += bytes(PALETTE[ch])
    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')


out = Path(__file__).resolve().parent.parent / 'icons'
out.mkdir(exist_ok=True)
for size in (180, 192, 512):
    (out / f'icon-{size}.png').write_bytes(png(size))
    print(f'icons/icon-{size}.png')
