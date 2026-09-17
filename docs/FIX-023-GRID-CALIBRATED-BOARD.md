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

**What was tried first and didn't work:** source-PNG pixel-level edge detection (luminance
gradient/variance peaks along scanlines, smoothed to suppress texture noise, linear-fit through
the cleanest samples), with the result hand-converted from image-pixel fractions to stage
fractions through the `background-size: cover` crop math (see below). This produced a
`boss-shadow-moon` quad that *looked* internally consistent (the math checked out against its own
inputs) but was visibly wrong once rendered -- off by roughly 60-70px in a 540px-tall stage. Root
cause: this art's frame border is itself densely decorated -- corner gem studs, skull medallions,
and a repeating inline-diamond pattern along every edge -- so a gradient/variance scan repeatedly
locked onto a decoration's edge instead of the true frame/tile boundary. It did so *confidently*
(strong, clean signal at the wrong location), which is what made the error easy to miss without
an independent check.

**What actually worked:** calibrate directly in STAGE pixel space against the rendered result,
not the source image:

1. Render this module's `boardPlaneFrac` as the in-app debug grid-line MESH (`board-renderer.js`'s
   `drawBoardSurface`, gated behind the debug-panel toggle) directly over the arena art in the
   running viewer.
2. Screenshot at a precisely known viewport size (so screenshot-px -> stage-px is a known constant
   scale factor).
3. Read the pixel offset between the projected quad's corners and the baked grid's corners (the
   corner gem studs are unambiguous, high-contrast landmarks) **directly in that one composited
   image** -- both the "what we drew" and "what's actually painted" are in the same picture, so
   there's no separate coordinate space or conversion step that can silently diverge from what's
   on screen.
4. Convert the measured screenshot-px offset to a stage-fraction correction and apply it to
   `boardPlaneFrac`.
5. Re-render, re-screenshot, repeat until the corners sit on the studs and the mesh lines track the
   tile mortar cracks. `boss-shadow-moon` needed one large corrective pass (all four corners moved
   substantially) after the source-image approach's error was caught; `prologue-5x5-good`'s
   corners (inherited from a prior, differently-measured 5x5 candidate at the same resolution/
   composition) were already close and needed no correction once checked this way.

**`background-size: cover` is still real and still matters** -- `.bg-layer` (style.css) fits each
arena PNG to the forced-16:9 stage with `background-size: cover; background-position: center`,
and `boss-shadow-moon` (1619x971, aspect 1.667) is noticeably off 16:9, so it gets cropped/
stretched on display. The lesson from the failed first attempt isn't "the cover-fit math was
wrong" (it wasn't, verified independently) -- it's that calibrating in stage space sidesteps the
conversion entirely, which is more robust than getting the conversion right on paper and still
measuring the wrong source-image feature.

No per-arena row/column calibration table (`fitGrid`'s optional `colFracs`/`rowFracs`) was needed
for either arena -- a plain 4-corner homography matched the baked grid closely enough once the
corners themselves were correctly located. The plumbing for non-uniform per-row/column calibration
exists in `board-plane.js` (`fitGrid` opts, `cellToScreen`/`screenToCell`'s `colFracs`/`rowFracs`
buckets) for a future arena whose generated grid turns out to be visibly irregular.

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
