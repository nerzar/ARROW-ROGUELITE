# FIX-023 — Grid-Calibrated Board Projection + Side Actor Anchors

Calibration data and methodology for the two TRUE baked-grid proof arenas wired in this task.
Runtime module: `spikes/arrow-core/viewer/visual-proto/arena-calibration.js`.

## Why per-arena calibration, not the old generic trapezoid

FIX-021/BUILD-022's `PLANE_CORNERS_FRAC` (`board-plane.js`) is a single hand-picked quad
calibrated against the flexible Moonlit Fortress dais, which has no baked grid at all -- any
inset within reason "reads fine" on it. ARENA-002's candidates instead paint an *exact* grid
(6x6 or 5x5 tiles with visible mortar lines) directly into the art. For the projected logical
board to align cell-to-cell with those painted lines, the plane's 4 corners must sit precisely on
the grid's own outer edge, and `fitGrid`'s margin must be **0** (the flexible arena's margin
exists only to leave stone breathing room around a boardless dais -- here it would visibly pull
the projected grid inward, off the baked lines).

## Measurement method

1. **Pixel-level edge detection**: loaded the candidate PNG into an offscreen canvas in the
   browser, computed luminance, smoothed it (moving-average, window ~3-4px) to suppress stone
   texture/crack noise, then found the steepest luminance-gradient peak in the left/right (or
   top/bottom) half of several scanlines -- the ornate metal frame band is reliably brighter than
   the dark tile interior, so its inner edge shows up as a strong derivative peak independent of
   the tile's own absolute brightness (which varies row to row with in-scene lighting).
2. **Linear fit through the cleanest samples**: plotted several scanlines' detected edges,
   discarded obvious outliers (occasional decorative elements -- skulls, banners, gems -- break
   the gradient-peak heuristic on a given row), and fit a line through the rest to get the four
   corner intersections (the frame's left/right edges are straight but not vertical; top/bottom
   are horizontal).
3. **`background-size: cover` correction**: `.bg-layer` (style.css) fits the arena PNG to the
   stage with `background-size: cover; background-position: center`. The stage is forced to
   exactly 16:9. When a candidate's own aspect ratio isn't 16:9, cover scales the image to match
   stage width (or height) and **crops the overflow, centered** -- so a raw `imgPixelY / imgHeight`
   fraction is *not* the on-screen stage fraction. `boss-shadow-moon` (1619x971, aspect 1.667) is
   scaled to stage width and loses ~3.1% of its height off the top and bottom equally; the visible
   middle stretches by a `stageAspect / imgAspect ≈ 1.066` factor. Left uncorrected, this misplaces
   the plane by several percent of stage height -- exactly what an initial by-eye pass without this
   correction produced (grid rendered visibly too low/short vs. the baked lines). `prologue-5x5-good`
   (1672x941, aspect 1.777) is within 0.06% of 16:9, so the correction is negligible there.
4. **Final visual pass**: rendered the projected grid MESH (not just cell-center dots) via the new
   debug overlay (`board-renderer.js`'s `drawBoardSurface`, gated behind the debug-panel toggle)
   directly over the baked art and screenshotted at a few zoom levels to confirm the lines sit on
   the painted mortar lines and the four corners land on the frame's corner gem studs.

No per-arena row/column calibration table (`fitGrid`'s optional `colFracs`/`rowFracs`) was needed
for either arena -- a plain 4-corner homography matched the baked grid closely enough once the
corners themselves were measured precisely and the cover-fit crop was accounted for. The plumbing
for non-uniform per-row/column calibration exists in `board-plane.js` (`fitGrid` opts,
`cellToScreen`/`screenToCell`'s `colFracs`/`rowFracs` buckets) for a future arena whose generated
grid turns out to be visibly irregular.

## Selected arenas

| id | file | size | source |
|---|---|---|---|
| `boss-shadow-moon` | `assets/arenas/prologue-act1/6x6-5.png` | 6x6 | ARENA-002 pack (`design/ARENA-002-prologue-act1-pack`, commit `4694355`) |
| `prologue-5x5-good` | `assets/arenas/prologue-act1/5x5-good.png` | 5x5 | `magicarrowassets/arenas/5x5-good.png` -- explicitly user-approved mid-task, superseding ARENA-002's `prologue-violet-arch` |

`boss-shadow-moon` was picked over ARENA-002's other 6x6 candidates for its thematic fit with the
existing "moonlit" naming and because no 6x6 candidate had an explicit approval marker at the time
this task started; the user later approved a set of 5x5 candidates by filename
(`*-good.png`/`*-approved*.png`) mid-task, and `5x5-good.png` (clean daylight lighting, high
contrast tile/mortar edges) was chosen from that set as the 5x5 proof arena. No approved 6x6
candidate exists yet -- a follow-up task should supply one if `boss-shadow-moon` isn't the final
pick.

## Side actor anchor clipping (a real bug the calibration process caught)

The first pass at LEFT/RIGHT anchors reused Moonlit-Fortress-like edge-hugging fractions
(`x: 0.09` / `0.91`). Measured via `debugLayout()` (the same per-frame layout record VIS-007
already exposes for automated checks), the side character's char rect at `x=0.91` on a 960px-wide
stage spanned **717..1030px** -- roughly 70px of a ~313px-wide sprite clipped off the canvas edge,
symmetrically on both sides. `arena-layout.js`'s `SIDE_CHAR` footprint (6 cells, large relative to
these compositions' narrower usable width) means the anchor's `x` fraction needs to stay within
roughly `[0.5 - halfWidthFrac, 0.5 + halfWidthFrac]` of center, not hug the true edge. Both arenas'
LEFT/RIGHT anchors were moved to `x: 0.17` / `0.83`, re-verified via `debugLayout()` (full sprite
back on stage) and a screenshot (feet visibly on a stair step, not floating or clipped).

## Reproducing/updating this calibration

`window.visualDebug.loadBakedArenaDebug(calibrationId, seed?, defSceneKey?)` (browser console, in
the visual-proto viewer) loads a calibration entry's background + a freshly generated square board
of its `boardSizeLocked`, using an existing scene's `def` for structure (`'rock-spike'` for a
single N-side target, `'cp-e4'` for E+W side targets to check LEFT/RIGHT anchors). Toggle the
debug panel (`d` key or the "debug" button) to overlay the projected grid mesh, or call
`window.visualDebug.layout()` for exact per-actor screen rects.
