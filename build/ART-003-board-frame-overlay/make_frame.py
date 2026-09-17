"""ART-003: square-first stone board-frame overlay generator.

Style target: Moonlit Fortress (dark blue-slate stone, amber rune glow).
Output: 2048x2048 RGBA frame with a fully transparent square inner window.
The frame is static decor: it never rotates with the puzzle layer (FIX-021
owns projection/hit-testing/Rotate; this task touches no renderer code).

Source art reference (NOT copied pixel-wise, style-matched only):
  magicarrowassets/gameplay-reference/board/
    "ChatGPT Image Sep 17, 2026, 02_25_09 PM (1).png"
  (Moonlit Fortress board well: rune-etched stone frame, braziers, dark slab,
  no baked arrows -- the only empty-slab Moonlit reference in the set.)

IMPORTANT compositing rule (learned the hard way): PIL ImageDraw primitives
with a semi-transparent fill do NOT source-over blend on RGBA canvases --
they stamp the ink alpha into the destination. So ALL decor is painted on an
opaque RGB canvas; alpha comes purely from geometry masks. This keeps the
frame band at exactly 255, the window at exactly 0, and edges to a 1-2px
resampling falloff with no dark/white halo.

Geometry (final 2048px space):
  outer rect inset .... 56px, corner radius 96
  inner window ........ x 384..1664 (1280x1280, corner radius 18)
  safe inner rect ..... x 408..1640 (1232x1232, 24px glow clearance)
"""
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
S = 2048          # final size
SS = 2            # supersample factor for clean alpha edges
W = S * SS

OUTER_INSET = 56 * SS
OUTER_R = 96 * SS
INNER_X0 = 384 * SS
INNER_X1 = 1664 * SS
INNER_R = 18 * SS

STONE_TOP = (74, 80, 104)
STONE_BOT = (38, 42, 58)
MORTAR = (22, 24, 33)
TRIM = (255, 207, 125)
GLOW_RGB = (255, 157, 46)
RUNE_RGB = (255, 196, 120)

random.seed(1571)


def grad_at(y):
    t = y / W
    return tuple(int(STONE_TOP[i] + (STONE_BOT[i] - STONE_TOP[i]) * t) for i in range(3))


def rounded_mask(size, rect, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(rect, radius=radius, fill=255)
    return m


def build_rgb():
    rgb = Image.new("RGB", (W, W))
    gd = ImageDraw.Draw(rgb)
    for y in range(0, W, 4):
        gd.rectangle([0, y, W, y + 4], fill=grad_at(y))

    course = 128 * SS
    rows = W // course
    # per-block tonal jitter (solid fills on opaque canvas)
    for r in range(rows):
        off = (course // 2) if (r % 2) else 0
        for cx in range(-1, W // course + 1):
            x0 = cx * course + off
            v = random.randint(-6, 6)
            base = grad_at(r * course + course // 2)
            col = tuple(max(0, min(255, c + v)) for c in base)
            gd.rectangle([x0 + 5 * SS, r * course + 5 * SS,
                          x0 + course - 5 * SS, r * course + course - 5 * SS],
                         fill=col)
    # mortar joints
    for r in range(rows + 1):
        y = r * course
        gd.line([0, y, W, y], fill=MORTAR, width=3 * SS)
        off = (course // 2) if (r % 2) else 0
        for cx in range(-1, W // course + 1):
            x = cx * course + off
            gd.line([x, y - course, x, y], fill=MORTAR, width=3 * SS)
    return rgb


def add_trims(rgb):
    t = 14 * SS
    trim_w = 6 * SS
    outer_rect = [OUTER_INSET + t, OUTER_INSET + t, W - OUTER_INSET - t, W - OUTER_INSET - t]
    inner_rect = [INNER_X0 - t - trim_w, INNER_X0 - t - trim_w,
                  INNER_X1 + t + trim_w, INNER_X1 + t + trim_w]

    def shapes(d):
        d.rounded_rectangle(outer_rect, radius=OUTER_R - t, outline=255, width=trim_w)
        d.rounded_rectangle(inner_rect, radius=INNER_R + t + trim_w, outline=255, width=trim_w)

    m = Image.new("L", (W, W), 0)
    shapes(ImageDraw.Draw(m))
    soft = m.filter(ImageFilter.GaussianBlur(14 * SS))
    rgb = Image.composite(Image.new("RGB", (W, W), GLOW_RGB), rgb,
                          soft.point(lambda v: v * 150 // 255))
    d = ImageDraw.Draw(rgb)
    d.rounded_rectangle(outer_rect, radius=OUTER_R - t, outline=TRIM, width=3 * SS)
    d.rounded_rectangle(inner_rect, radius=INNER_R + t + trim_w, outline=TRIM, width=3 * SS)
    return rgb


def diamond(d, cx, cy, r, outline, width):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)],
              outline=outline, width=width)


def add_runes(rgb):
    mid = W // 2
    band_c = (OUTER_INSET + INNER_X0) // 2
    corners = [(band_c, band_c), (W - band_c, band_c),
               (band_c, W - band_c), (W - band_c, W - band_c)]
    mids = [(mid, band_c), (mid, W - band_c)]
    r_mid, r_big = 44 * SS, 64 * SS

    m = Image.new("L", (W, W), 0)
    dm = ImageDraw.Draw(m)
    for (cx, cy) in corners:
        diamond(dm, cx, cy, r_mid, 255, 8 * SS)
    for (cx, cy) in mids:
        diamond(dm, cx, cy, r_big, 255, 9 * SS)
    soft = m.filter(ImageFilter.GaussianBlur(9 * SS))
    rgb = Image.composite(Image.new("RGB", (W, W), GLOW_RGB), rgb,
                          soft.point(lambda v: v * 170 // 255))
    d = ImageDraw.Draw(rgb)
    for (cx, cy) in corners:
        diamond(d, cx, cy, r_mid, RUNE_RGB, 5 * SS)
        diamond(d, cx, cy, r_mid // 2, RUNE_RGB, 3 * SS)
    for (cx, cy) in mids:
        diamond(d, cx, cy, r_big, RUNE_RGB, 6 * SS)
        diamond(d, cx, cy, r_big // 2, RUNE_RGB, 4 * SS)
        s = r_big // 3
        d.line([cx - s, cy, cx + s, cy], fill=RUNE_RGB, width=4 * SS)
        d.line([cx, cy - s, cx, cy + s], fill=RUNE_RGB, width=4 * SS)
    return rgb


def main():
    rgb = build_rgb()
    rgb = add_trims(rgb)
    rgb = add_runes(rgb)

    # grain: blend 5% neutral noise (opaque canvas stays opaque)
    n = Image.effect_noise((W, W), 18).convert("RGB")
    rgb = Image.blend(rgb, n, 0.05)

    rgb_small = rgb.resize((S, S), Image.LANCZOS)

    # alpha purely from geometry
    outer = rounded_mask(W, [OUTER_INSET, OUTER_INSET, W - OUTER_INSET, W - OUTER_INSET], OUTER_R)
    inner = rounded_mask(W, [INNER_X0, INNER_X0, INNER_X1, INNER_X1], INNER_R)
    band = Image.composite(Image.new("L", (W, W), 0), outer, inner)
    alpha = band.resize((S, S), Image.LANCZOS)

    overlay = Image.merge("RGBA", (*rgb_small.split(), alpha))
    # hard guarantees at final scale (kill resampling dust)
    a = overlay.split()[3]
    ad = ImageDraw.Draw(a)
    ad.rounded_rectangle([INNER_X0 // SS, INNER_X0 // SS, INNER_X1 // SS, INNER_X1 // SS],
                         radius=INNER_R // SS, fill=0)
    keep = rounded_mask(S, [OUTER_INSET // SS, OUTER_INSET // SS,
                            S - OUTER_INSET // SS, S - OUTER_INSET // SS], OUTER_R // SS)
    a = Image.composite(a, Image.new("L", (S, S), 0), keep)
    overlay.putalpha(a)
    overlay.save(os.path.join(HERE, "board-frame-overlay.png"))

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [INNER_X0 // SS, INNER_X0 // SS, INNER_X1 // SS, INNER_X1 // SS],
        radius=INNER_R // SS, fill=255)
    mask.save(os.path.join(HERE, "board-inner-mask.png"))

    # ---- verify ----
    px = a.load()
    x0, x1 = INNER_X0 // SS, INNER_X1 // SS
    bad_inside = 0
    for y in range(408, 1641, 5):
        for x in range(408, 1641, 5):
            if px[x, y] != 0:
                bad_inside += 1
    import collections
    hist = collections.Counter()
    for y in range(150, 330, 3):
        for x in range(500, 1550, 3):
            hist[px[x, y]] += 1
    total = sum(hist.values())
    print(f"size={overlay.size} mode={overlay.mode}")
    print(f"safe_rect_nonzero={bad_inside} (safe 408..1640, expect 0)")
    print(f"topband_opaque={hist.get(255,0)}/{total}={hist.get(255,0)/total:.4f} (expect ~1.0)")
    print(f"topband_non255_values={sorted(v for v in hist if v != 255)[:10]}")
    halo = sum(1 for y in range(0, 56, 2) for x in range(0, S, 7) if px[x, y] != 0)
    print(f"halo_margin_nonzero={halo} (expect 0)")
    print("inner_rect_px: 384,384,1664,1664  safe_rect_px: 408,408,1640,1640")


if __name__ == "__main__":
    main()
