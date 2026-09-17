"""ART-003 mockups: same frame, 6x6 + 10x10 puzzle layers, dark/light/arena beds.

Local-only visual proof. No renderer/layout/gameplay code touched.
Reads ../ nothing; writes only into this build dir.
"""
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
FRAME = Image.open(os.path.join(HERE, "board-frame-overlay.png"))
ARENA = Image.open(os.path.join(
    REPO, "spikes/arrow-core/viewer/visual-proto/assets/arena-moonlit-fortress.png")).convert("RGB")

CANVAS = (1920, 1080)
FRAME_H = 940  # displayed frame height; same for every mockup


def checker(size, dark):
    w, h = size
    cell = 48
    base = (18, 20, 28) if dark else (232, 230, 226)
    alt = (34, 37, 48) if dark else (200, 197, 192)
    im = Image.new("RGB", size, base)
    d = ImageDraw.Draw(im)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=alt)
    return im


ARROWS = [(1, 0), (0, 1), (-1, 0), (0, -1)]
COLORS = [(255, 196, 110), (235, 240, 255), (150, 200, 255), (255, 150, 120)]


def draw_puzzle(base, origin, size, n, seed):
    """Glowing straight per-cell arrows fitted into the frame inner window."""
    rng = random.Random(seed)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = origin
    cell = size / n
    pad = cell * 0.24
    for gy in range(n):
        for gx in range(n):
            dx, dy = ARROWS[rng.randrange(4)]
            col = COLORS[rng.randrange(len(COLORS))]
            cx = ox + (gx + 0.5) * cell
            cy = oy + (gy + 0.5) * cell
            L = cell / 2 - pad
            x0, y0 = cx - dx * L, cy - dy * L
            x1, y1 = cx + dx * L, cy + dy * L
            wpx = max(3, int(cell * 0.10))
            d.line([x0, y0, x1, y1], fill=col + (255,), width=wpx)
            # head
            hx, hy = -dy, dx
            hs = cell * 0.16
            d.polygon([(x1 + dx * hs, y1 + dy * hs),
                       (x1 + hx * hs, y1 + hy * hs),
                       (x1 - hx * hs, y1 - hy * hs)], fill=col + (255,))
    glow = layer.filter(ImageFilter.GaussianBlur(6))
    base = Image.alpha_composite(base.convert("RGBA"), glow)
    base = Image.alpha_composite(base, layer)
    return base


def compose(bed, n, seed):
    k = FRAME_H / FRAME.size[1]
    fw = int(FRAME.size[0] * k)
    frame = FRAME.resize((fw, FRAME_H), Image.LANCZOS)
    fx = (bed.size[0] - fw) // 2
    fy = (bed.size[1] - FRAME_H) // 2
    # inner window maps from overlay coords 384..1664 of 2048
    ox = fx + 384 * k
    oy = fy + 384 * k
    size = 1280 * k
    out = bed.convert("RGBA")
    # paste order: bed -> puzzle -> frame on top (frame occludes grid edges)
    out = draw_puzzle(out, (ox, oy), size, n, seed)
    out.paste(frame, (fx, fy), frame)
    return out.convert("RGB")


def main():
    dark = checker(CANVAS, True)
    light = checker(CANVAS, False)
    arena = ARENA.resize(CANVAS, Image.LANCZOS)
    compose(dark, 6, 61).save(os.path.join(HERE, "mock_dark_6x6.png"))
    compose(light, 10, 101).save(os.path.join(HERE, "mock_light_10x10.png"))
    compose(arena, 6, 61).save(os.path.join(HERE, "mock_arena_6x6.png"))
    compose(arena, 10, 101).save(os.path.join(HERE, "mock_arena_10x10.png"))
    print("mockups written")


if __name__ == "__main__":
    main()
