# ART-003 — Board Frame Overlay (square-first)

Status: asset ready for FIX-021 integration. No renderer/layout/gameplay code touched.

**BUILD-022 course correction (2026-09-17):** this overlay is kept in Git as a reference/
experiment asset only and is **not** wired into the main runtime scene. The approved BUILD-022
direction is that the arena background art itself is the board frame/surface -- the renderer
projects puzzle content (arrow paths, glow, selection, debug grid) directly onto the arena's own
painted stone well via FIX-021's `board-plane.js`, with no drawn panel and no second frame image
on top of it. This flat, undistorted square overlay didn't read well against the arena's
perspective-foreshortened dais (see FOUND #2 below) and was rejected for that reason. It may
still be useful later for a debug view, a generic fallback arena with no baked-in board well, or
a UI-only (non-diegetic) board presentation -- not for the current arena gameplay scene.

## Files

| File | Size | Role |
|---|---|---|
| `spikes/arrow-core/viewer/visual-proto/assets/board/board-frame-overlay.png` | 1024x1024 RGBA, ~426 KB | Runtime decor frame, transparent center |
| `spikes/arrow-core/viewer/visual-proto/assets/board/board-inner-mask.png` | 1024x1024 L, ~2 KB | Inner-window mask (255 = puzzle may draw here) |
| `build/ART-003-board-frame-overlay/board-frame-overlay.png` | 2048x2048 RGBA master | Regeneration source of truth |
| `build/ART-003-board-frame-overlay/make_frame.py` | generator | Deterministic rebuild (`seed 1571`) |
| `build/ART-003-board-frame-overlay/make_mockups.py` | mockups | Proof only, never ships to runtime |
| `build/ART-003-board-frame-overlay/mock_{dark,light,arena}_{6x6,10x10}.png` | proof | Same frame, 6x6 + 10x10 puzzle layers |

Style source (reference only, no pixels copied):
`magicarrowassets/gameplay-reference/board/ChatGPT Image Sep 17, 2026, 02_25_09 PM (1).png`
— the only empty-slab Moonlit Fortress board-well reference (rune stone frame,
braziers, dark slab, no baked arrows). Palette sampled from the approved arena
(`assets/arena-moonlit-fortress.png`): blue-slate stone ~(56,54,74), amber rune
glow ~(255,157,46). Braziers stay in the arena background art; the overlay
carries only stone + rune trim so it can sit over any scene.

## Geometry (1024 runtime space; master x2)

- Outer rect inset **28px** (56 @2048), corner radius **48px** (96 @2048).
- Inner window: **192..832** (384..1664 @2048) → **640x640** transparent square,
  corner radius 9px. Normalized: `0.1875 .. 0.8125` on both axes.
- Safe inner rect (24px glow clearance @2048 → 12px @1024):
  **204..820** (408..1640 @2048) → **616x616**, normalized `0.1992 .. 0.8008`.
  FIX-021 should fit every square board (6x6 … 10x10) inside this rect.
- No baked arrows, no grid lines, no opaque backing anywhere.

## Alpha info (measured, not assumed)

- Safe rect: **0 nonzero pixels** (fully transparent, 2048 master and 1024 runtime).
- Frame band interior: **100% alpha 255** (top-band sample 21000/21000 @2048,
  5425/5425 @1024).
- Outer edge: 2-3px AA ramp, **0 nonzero pixels** outside it (@2048; @1024 the
  ramp starts 3px above nominal, values ≤12 — resampling dust, invisible).
- No black/white fringe: edge RGB is stone, decor painted on an opaque canvas
  with alpha taken purely from geometry masks (PIL `ImageDraw` stamps ink
  alpha on RGBA canvases — first build had a checkerboard-alpha bug from
  semi-transparent fills; fixed by RGB-only painting, see generator header).

## FIX-021 integration recommendation

1. Treat the frame as **fixed decor**: position/scale it once per scene, never
   rotate it. Rotate transforms only the puzzle layer fitted into the safe rect.
2. Board placement: `inner = frame_rect mapped from normalized 0.1875..0.8125`;
   keep cell area inside normalized **0.1992..0.8008** (or load
   `board-inner-mask.png` and fit to its bbox if a code path is preferred over
   constants).
3. Wiring note: `assets.js` currently maps `boardFrame -> assets/board-frame.png`
   (drawn *behind* the canvas). This overlay is designed to sit **above** the
   puzzle layer as a frame. Suggested one-line manifest addition owned by FIX-021
   (NOT done here — renderer untouched):
   `boardFrameOverlay: 'assets/board/board-frame-overlay.png'`, rendered as a
   non-rotating foreground layer sized to the same anchor as the board.
4. Rectangular boards (legacy compat): letterbox them into the square safe rect,
   do not stretch the frame — the frame stays square per square-first policy.
5. Regeneration: `python3 build/ART-003-board-frame-overlay/make_frame.py`
   (requires Pillow); runtime 1024 files are LANCZOS downscales of the master.
