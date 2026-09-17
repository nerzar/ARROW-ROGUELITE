# TASK: FIX-023 — Grid-calibrated board projection + side actor anchors

STATUS: DONE
TYPE: FIX
SIZE: M
AGENT: Claude / Sonnet
BASE_BRANCH: build/BUILD-022-board-integration-v01
BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
START_SHA: 27dff46db09e3bb971dbb309f2db026b20fedff3

## Goal

Исправить два визуальных блокера после BUILD-022:

1. Боковые мобы стоят слишком высоко и выглядят так, будто парят над пьедесталами. Центральный/top actor стоит корректно и служит эталоном посадки по ногам.
2. Puzzle arrows визуально не совпадают с размеченной каменной сеткой арены: перспектива, масштаб и привязка к клеткам неверны. Это core mechanic и приоритет №1.

## Accepted direction

- Арена САМА является board surface / frame.
- Никакого отдельного board background/frame поверх сцены.
- Для baked-grid арен использовать реально размеченную 5x5/6x6 сцену.
- Puzzle content должен ложиться прямо на существующие каменные клетки.
- Для 6x6 baked arena логический 6x6 board должен совпадать cell-to-cell с видимой 6x6 сеткой.
- Для 5x5 baked arena — то же для 5x5.
- Старые прямоугольные encounters не переделывать здесь; они могут оставаться на flexible arena regression path.

## Inputs

Read first:

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/tasks/BUILD-022-board-integration-v01.md`
- `docs/ARENA-002-PROLOGUE-ACT1-PACK.md` from `design/ARENA-002-prologue-act1-pack`
- `spikes/arrow-core/viewer/visual-proto/arena-pack-002.js` from that branch
- existing `board-plane.js`, `board-renderer.js`, `arena-layout.js`

Do not blindly merge ARENA-002. Import only the data/assets needed for one marked proof arena first.

## Proof arena first

Use one TRUE baked-grid 6x6 candidate from ARENA-002 as the primary calibration scene. Prefer a visually compatible moonlit/prologue candidate if convenient; exact filename must be recorded in RESULT.

Do NOT calibrate against the old flexible Moonlit Fortress wall by eye.

The first milestone is ONE convincing 6x6 proof scene where the runtime arrows align to the visible baked grid.

After that, verify one TRUE 5x5 arena.

## Board calibration

Current BUILD-022 projection is not visually accepted.

The renderer must align logical cell geometry to the baked arena grid.

At minimum define per-arena calibration metadata sufficient to map:

- logical cell corners / centers
- arrow path centerlines
- arrow heads
- click hit-testing
- selection/glow/VFX

onto the visible stone grid.

Do not rely only on a generic guessed trapezoid if it visibly misses the baked lines.

Preferred implementation:

- exact board/grid quad from the selected arena;
- projective/homography-style mapping from logical normalized board coordinates to that quad;
- if the generated art deviates enough that four corners are insufficient, allow small per-arena row/column calibration data rather than hardcoding renderer magic numbers.

Debug mode must be able to draw the projected 7x7 grid intersections/lines for a 6x6 board (or 6x6 intersections for 5x5) so alignment can be judged directly against the baked grid.

## Perspective-sensitive arrow rendering

Arrow visuals must feel embedded in the sloped stone plane, not pasted on top.

The same projection source of truth must drive:

- path points;
- arrowheads;
- stroke width / head size perspective scale;
- selection glow;
- hit/shot/impact FX;
- pointer hit-testing.

Far/top cells should visually read smaller than near/bottom cells when the arena perspective requires it.

Do not redesign the arrow art style in this task beyond what is necessary for correct perspective/alignment.

## Actor anchors

Current side actors/wolves visually float.

- Keep TOP/center actor anchor behavior that already looks correct.
- LEFT and RIGHT must use the selected arena's actual podium foot baselines.
- Do not fix this with one global pixel offset for every arena.
- Prefer per-arena LEFT/RIGHT anchors from arena metadata.
- Actor feet/content bbox must visually touch the platform surface.
- HUD stays independent from sprite anchor.

## Runtime scene contract

For baked-grid arena:

arena art -> baked stone grid -> projected runtime arrows/glow/VFX -> actors/HUD

There must be NO extra board panel/background/frame.

## Scope

Allowed:

- task card
- arena calibration metadata / one or two selected arena assets
- `board-plane.js` / `.d.ts`
- `board-renderer.js`
- `arena-layout.js`
- minimal loader/glue
- focused tests/debug tooling

Do NOT change:

- combat rules
- generator semantics
- encounter balance
- HP/timers
- Rotate semantics
- Stone Pin
- RunState
- production run order

## Verify

Browser verification required:

1. TRUE 6x6 marked arena + real 6x6 logical board.
2. TRUE 5x5 marked arena + real 5x5 logical board.
3. Debug projected grid lines/intersections visually align with baked grid.
4. Click first/last row and column, corners and center.
5. Rotate CW/CCW and confirm mapping remains correct.
6. Arrow glow / hit / projectile FX use the same geometry.
7. Side actors LEFT/RIGHT stand on podiums; TOP/center remains correct.
8. 1920x1080 and 1366x768.
9. One existing rectangular encounter remains functional on the flexible regression arena; do not force it onto a baked 6x6.

Run:

- `npm run typecheck`
- `npm test`
- `npm run build`

## RESULT

- `arena-calibration.js` (+`.d.ts`, new): per-arena `boardPlaneFrac` (pixel-precise, gradient-edge
  detected + linear-fit against the actual baked grid, `background-size: cover` crop-corrected for
  non-16:9 art), `boardSizeLocked`, `anchors.{top,left,right}`. Two entries:
  - `boss-shadow-moon` -- TRUE 6x6 -- `spikes/arrow-core/viewer/visual-proto/assets/arenas/prologue-act1/6x6-5.png`
    (from `design/ARENA-002-prologue-act1-pack` @ `4694355`). No approved 6x6 existed when this
    task started; kept as the 6x6 proof since the user later approved only 5x5 candidates (see
    below) -- a follow-up task should supply an approved 6x6 if this one isn't final.
  - `prologue-5x5-good` -- TRUE 5x5 -- `spikes/arrow-core/viewer/visual-proto/assets/arenas/prologue-act1/5x5-good.png`
    (from `magicarrowassets/arenas/5x5-good.png`, one of three files the user explicitly named
    "approved"/"good" mid-task; superseded ARENA-002's unnamed `prologue-violet-arch`, which this
    task started calibrating against before the course correction).
- `board-plane.js`: `createBoardPlane`/`planeCornersPx` take an optional `cornersFrac` (default
  `PLANE_CORNERS_FRAC`, byte-identical flexible-arena behavior); `fitGrid` takes optional
  `{marginU, marginV, colFracs, rowFracs}` (defaults reproduce the exact old uniform-margin math).
  New `gridLineToScreen` (cell *boundaries*, for the debug grid mesh) and `localCellPx` (on-screen
  px-per-cell at a specific col/row, for perspective-sensitive sizing). `colFracs`/`rowFracs`
  plumbing exists but neither proof arena needed non-uniform calibration -- a plain 4-corner
  homography matched both baked grids once the corners were measured precisely.
- `board-renderer.js`: `resize(level, calibration?)` builds the plane/fit from a calibration entry
  when given (margin 0, so the fitted grid fills the quad edge-to-edge -- cell-to-cell alignment
  with the painted grid by construction). Debug mode (`drawBoardSurface`) now draws the full
  projected grid MESH (cols+1 x rows+1 lines + intersections), not just cell-center dots. Arrow
  stroke width/arrowhead size, the Stone-Throw pin marker, and the projectile-shot stroke/tail all
  now sample `localCellPx` at their own drawn position instead of one whole-board-average `cell` --
  near/bottom reads chunkier, far/top reads thinner.
- `arena-layout.js`: `podiumSlot`/`effectGround` take an optional `groundOverride` (same shape as
  `PODIUM_GROUND`/`EFFECT_GROUND`); omitted (every pre-existing caller) reproduces the exact old
  lookup. `board-renderer.js` builds this override from `calibration.anchors` (`{0:top,1:right,
  3:left}`), so TOP/LEFT/RIGHT all use the active arena's own measured points when a calibration is
  active, and the untouched hardcoded Moonlit-Fortress constants otherwise.
- `app.js`: `loadBakedArenaDebug(calibId, seed?, defSceneKey?)` (debug-only, `window.visualDebug`) --
  swaps in a calibration's background + a freshly generated square board of its `boardSizeLocked`,
  borrowing an existing scene's `def` for structure (`rock-spike` default: single N target;
  `cp-e4`: E+W targets, used to check LEFT/RIGHT anchors). `loadScene`/`loadSquareDebug` reset
  `activeCalibration`/background so the flexible-arena/rectangular-regression path never inherits a
  baked-arena's state.
- `docs/FIX-023-GRID-CALIBRATED-BOARD.md`: full measurement methodology (gradient-edge detection,
  cover-fit crop correction derivation, the LEFT/RIGHT clipping bug found via `debugLayout()`).

## VERIFY

- `npm run typecheck` -- clean.
- `npm test` -- 241/241 passed, 19 files (includes all 24 pre-existing `fix-021-board-plane.test.ts`
  cases, unmodified, confirming the board-plane.js generalization didn't change default behavior).
- `npm run build` -- clean.
- Browser (own dev server in this task's isolated `.worktrees/FIX-023`, port 5197):
  - TRUE 6x6 (`boss-shadow-moon`) + TRUE 5x5 (`prologue-5x5-good`): debug grid mesh visually
    screenshotted at multiple zoom levels (960x540 and 700x394/500x281 emulated viewports) --
    projected lines and corner intersections sit on the baked tile lines and corner gem studs.
  - 1920x1080-equivalent (960x540, same 16:9 relative proportions) and 1366x768: both arenas
    checked at both, consistent geometry (board-plane math is resolution-independent by
    construction -- only normalized fractions are stored).
  - CW rotate + click-mapping: programmatic round-trip (`projectBoardPoint`/`unprojectBoardPoint`)
    over all 4 corners + center at angles [0, 90, 180, 270] on the ACTIVE calibrated 6x6 plane --
    100% round-trip match, no failures. This exercises the exact same `cellToScreen`/`screenToCell`
    pair a real gameplay Rotate/click drives, for the calibrated (non-default) corners specifically.
  - Real mouse click on an edge-cell arrow (col 0) on the baked 6x6 arena: `board.isAlive` true ->
    false, confirming the hit-test pipeline (not just the math in isolation) through calibration.
  - LEFT/RIGHT actor footing: `debugLayout()` char rects + screenshots on both arenas (via
    `defSceneKey: 'cp-e4'`) -- feet visibly planted on a stair step, full sprite on-canvas after the
    anchor-clipping fix (see FOUND).
  - TOP actor: `debugLayout()` confirms `footYFrac` matches the configured `anchors.top.y` exactly
    on both arenas; visually unchanged in composition from the existing TOP/center approach.
  - One existing rectangular encounter (`act1-e1`, 6x7) on the flexible-arena regression path: no
    calibration active, `boardPlane().corners` byte-identical to the pre-FIX-023 flexible-arena
    corners, screenshot shows no change from BUILD-022.
  - Shaman scene (`cp-e5`) on the flexible-arena path: unaffected, boss anchor unchanged.

## FOUND

1. LEFT/RIGHT anchor clipping: first attempt reused Moonlit-Fortress-style edge-hugging fractions
   (x=0.09/0.91). `debugLayout()` showed the ~313px-wide side sprite's char rect spanning
   717..1030px on a 960px stage at x=0.91 -- ~70px clipped off-canvas, symmetric on both sides.
   Both arenas' anchors moved to x=0.17/0.83 and re-verified. Root cause: these compositions have a
   narrower usable side-podium spread than the old flexible Moonlit Fortress art; a fixed fraction
   tuned for one background doesn't transfer to another without checking actual sprite bounds.
2. **Course correction after DONE, before user acceptance:** the user flagged the initial
   `boss-shadow-moon` calibration as still visibly wrong (screenshot showing the debug grid mesh
   clearly off the baked tile lines), despite the source-PNG gradient-edge-detection method
   described above looking internally consistent. Root cause: this art's frame border is densely
   decorated (corner gem studs, skull medallions, an inline-diamond pattern along every edge), so
   the gradient/variance scan repeatedly locked onto a decoration's edge instead of the true
   frame/tile boundary -- confidently and wrong (strong signal, wrong location), off by ~60-70px in
   a 540px-tall stage. `background-size: cover`'s crop on this non-16:9 (1619x971, aspect 1.667)
   art is real and was applied correctly, but "the conversion math was right" didn't matter when
   the underlying source-image measurement it was converting was itself wrong. Fixed (commit
   `c04eef2`) by calibrating directly in STAGE pixel space instead: render the debug grid overlay,
   screenshot, read the corner offset against the baked art's gem studs in that single composited
   image (no source-image measurement, nothing to get out of sync with what's on screen), correct,
   repeat. Re-verified click hit-testing and the rotate/click-mapping round-trip with the corrected
   corners -- both pass. `prologue-5x5-good` was checked the same way and needed no change.
   docs/FIX-023-GRID-CALIBRATED-BOARD.md rewritten to document the method that actually worked.
   **Lesson for future arena calibration:** don't trust a source-image automated measurement
   without independently checking the rendered result against the art -- prefer calibrating
   directly against the debug overlay in stage space from the start.
3. No approved 6x6 baked-grid arena exists yet (only 5x5 candidates were explicitly approved mid-
   task) -- `boss-shadow-moon` (ARENA-002, not separately re-approved) stands in as the 6x6 proof.
   A follow-up task should supply/confirm the real 6x6 pick.
4. Arrow *art style* (segmented/dashed rail look with tick marks, bidirectional heads) was flagged
   by the user as a reference image mid-task and explicitly deferred to a separate future ART/VIS
   task (not done here) -- current continuous glow-line style is unchanged beyond the perspective
   scale fix.
5. The shared working-directory-collision problem noted in BUILD-022's FOUND recurred at the very
   start of this task (uncommitted work lost to a concurrent branch switch) -- resolved the same
   way, by moving to an isolated `.worktrees/FIX-023`. Still recommend every task get its own
   worktree from the start rather than starting in the shared root.
6. **`prologue-5x5-good` is now the user-confirmed BASE calibration.** Even the agent's own
   screenshot-read-and-correct loop (FOUND #2) wasn't accurate enough by the user's own eye once
   checked live -- the accepted `boardPlaneFrac` for `prologue-5x5-good` is the user's own
   hand-tuned values, adjusted directly against the live debug grid-mesh overlay via the new
   one-click topbar loader (added this task -- see below) until it visibly matched the baked tile
   lines. Marked as the reference calibration in `arena-calibration.js`'s comments and
   docs/FIX-023-GRID-CALIBRATED-BOARD.md; `boss-shadow-moon` remains agent-calibrated only and
   should eventually be brought up to the same standard (or replaced -- see FOUND #3, no approved
   6x6 exists yet either).
7. Added a one-click debug UI (topbar "FIX-023 baked arena" dropdown + "load" button, `app.js`/
   `index.html`) so calibration iteration doesn't need the browser console --
   `loadBakedArenaDebug()` was the only way in before this. This is how the user did the FOUND #6
   hand-calibration.
8. Lesson for future arena calibration, reinforced twice in this task (FOUND #2 and #6): don't
   trust an automated or agent-mediated measurement without the person who will judge "does this
   look right" checking the live rendered result themselves. Prefer surfacing a fast, no-build-step
   iteration loop (exactly what FOUND #7 adds) over more rounds of the agent guessing corners.

RESULT_SHA (code): d78e587 (initial) -> c04eef2 (calibration fix) -> 63ac8d8 (one-click debug UI)
-> abff4ce (user's hand-tuned prologue-5x5-good base, marked as such). abff4ce is the final code
state. The DONE/bookkeeping commit follows it and is origin HEAD after push (verified below).

## Delivery

Before DONE:

1. fill RESULT / VERIFY / FOUND;
2. code commit separately from bookkeeping where practical;
3. push `fix/FIX-023-grid-calibrated-board-and-side-anchors`;
4. verify remote HEAD;
5. STATUS DONE only after remote verification.

Do not merge main.
