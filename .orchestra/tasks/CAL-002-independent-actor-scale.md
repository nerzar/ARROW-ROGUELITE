# TASK: CAL-002 — Independent actor scale in calibration editor

STATUS: DONE
TYPE: FIX/TOOL
SIZE: S
AGENT: Gemini / implementation
BASE_BRANCH: tool/CAL-001-arena-calibration-editor
BRANCH: fix/CAL-002-independent-actor-scale
START_SHA: 370c8d6127087753d34c7869ae1030ed84bb0578
RESULT_SHA: 92d21bc5ead3c0ade603d7e3fa11be7b63319a87

## User-found bug

CAL-001 is useful and was manually tested, but actor size is coupled to board/grid size. Changing the calibration editor grid from 5x5 to a larger size changes the rendered mob size. This is wrong: board logical dimensions and enemy presentation size are independent controls.

Root cause to verify first: `arena-layout.js` expresses `BOSS_CHAR` / `SIDE_CHAR` in board-cell units and `board-renderer.js` passes the current grid-derived `cell` into `podiumSlot` / `charBox` / HUD layout. Do not patch only the editor preview; production rendering must use the same corrected contract.

## Goal

Add independently editable actor scale for TOP / LEFT / RIGHT while preserving independent position anchors and independent effect anchors from CAL-001.

Changing 5x5 -> 6x6 -> 8x8 -> 10x10 must NOT change actor pixel footprint unless the user changes actor scale.

## Required calibration contract

Extend calibrated arena metadata with a simple presentation-only field, e.g.:

```js
actorScale: {
  top: 1.0,
  left: 1.0,
  right: 1.0,
}
```

Exact internal implementation may differ, but exported metadata must be explicit and human-readable.

For existing entries missing the field, use backward-compatible defaults.

Actor scale is presentation only. Do not change HP, combat, hitboxes, timers, or gameplay semantics.

## Editor UI

Add separate size controls for TOP / LEFT / RIGHT actors.

Minimum interaction:
- visible numeric value;
- slider or +/-/number input suitable for quick tuning;
- live sprite preview updates immediately;
- Reset restores loaded values;
- Copy calibration / Download JSON include actor scale;
- scale controls do NOT move anchors;
- actor anchors do NOT change scale;
- effect anchors remain independent.

Useful range: roughly 0.5x–2.0x (choose safe exact bounds/step).

Optional convenience: link LEFT+RIGHT scale, but individual values must remain possible.

## Rendering requirement

For calibrated arenas, actor size must be independent from current logical grid width/height.

Do not derive calibrated actor pixel size from `level.width`, `level.height`, or the current `geo.cell` in a way that changes when grid size changes.

Use a stable stage/arena-relative reference (or another explicit calibrated presentation reference) and multiply by `actorScale`.

Keep the old flexible/non-calibrated path backward compatible unless a safe general refactor is clearly proven.

HUD should follow the final actor box but remain independent from board grid size.

## Verify

In CAL-001 editor using the same arena and same actorScale values:
1. Capture actor rects at 5x5.
2. Switch to 6x6, 8x8, 10x10.
3. TOP/LEFT/RIGHT actor pixel width/height remain the same within rounding tolerance.
4. Change LEFT scale only: LEFT changes, TOP/RIGHT do not.
5. Change RIGHT scale only: RIGHT changes, TOP/LEFT do not.
6. Change TOP scale only: TOP changes, side actors do not.
7. Drag actor anchor after scaling: feet remain anchored to selected ground point.
8. Effect anchor remains independent.
9. Export -> reload reproduces position + scale.
10. 1920x1080 and 1366x768.

Run typecheck, full tests, build, browser verify.

## Bookkeeping fix

CAL-001 task report contains an incorrect RESULT_SHA string. The actual code commit on its branch is `481f8d3c2ef116b4ce0869155121428c3b58f385`, and the current CAL-001 branch tip/report commit is `370c8d6127087753d34c7869ae1030ed84bb0578`. Record the correct ancestry in this task's RESULT/FOUND; do not rewrite history.

## Do not

- no gameplay/balance changes;
- no arrow-art redesign;
- no arena art generation;
- no merge to main;
- do not change the user-confirmed board calibration values unless required for a proven bug.

## Delivery

Use isolated worktree from the start.
RESULT / VERIFY / FOUND -> code commit -> push -> remote SHA verify -> STATUS DONE.

## RESULT

Decoupled actor presentation size from board logical grid dimensions across both production rendering (`board-renderer.js`) and the calibration editor (`calibration-editor.js`).

1. **Arena Calibration Contract**:
   - Extended `ArenaCalibration` interface with `actorScale?: ActorScale` (`{ top: number, left: number, right: number }`) and optional `actorBaseCellFrac?: number`.
   - Updated `prologue-5x5-good` and `boss-shadow-moon` in `arena-calibration.js` with explicit default `actorScale: { top: 1.0, left: 1.0, right: 1.0 }`.
   - `getArenaCalibration()` provides backward-compatible fallback for any calibration lacking `actorScale`.
   - Exported `ACTOR_BASE_CELL_FRAC = 47.2 / 540` from `arena-layout.js` (preserving the exact 47.2px baseline established on the 960x540 canvas).

2. **Board Renderer Geometry Decoupling**:
   - In `board-renderer.js`, `actorBaseCell` is computed as `stageH * (calibration.actorBaseCellFrac ?? ACTOR_BASE_CELL_FRAC)` for calibrated arenas (falling back to grid cell for uncalibrated arenas).
   - In `drawTarget()`, mob sizing computes `charCell = (g.actorBaseCell ?? cell) * scale` and feeds it into `podiumSlot()`, character sprite dimensions, lunge vectors, ground shadows, telegraphs, and HUD layout (`hudBoxes`).
   - Sprite bottom (feet anchor) strictly pins to the calibrated anchor `g.y * stageH` regardless of scale, because `podiumSlot()` centers the character at `g.y * stageH - charH / 2`.
   - Effect anchors remain strictly independent of actor scale.

3. **Calibration Editor UI**:
   - Added `Actor scale` section in `calibration-editor.html` with range sliders and number inputs for TOP, LEFT, and RIGHT (range: 0.5x–2.0x, step: 0.05).
   - Added "Link LEFT + RIGHT" toggle to synchronize side mob scales while allowing individual adjustments when unchecked.
   - Updated `syncScaleInputs()`, values table, `Reset` button (reverts scales to loaded baseline), `Copy calibration`, and `Download JSON` (includes formatted `actorScale`).
   - Exposed `window.calibrationEditorDebug` helper methods (`setActorScale`, `getLayout`, `draft`, `exportObject`) for testing.

4. **Automated & Visual Test Suite**:
   - Added `test/cal-002-actor-scale.test.ts` verifying:
     - Calibrated metadata defaults and backward compatibility.
     - Grid size invariance (5x5, 6x6, 8x8, 10x10 footprint is invariant).
     - Isolated scale changes (LEFT affects only LEFT, RIGHT only RIGHT, TOP only TOP).
     - Feet grounding stability across scales.
     - Effect anchor independence.
     - Resolution scaling invariance across 1920x1080 and 1366x768.

## VERIFY

1. **Vitest test suite**:
   - Ran `npm test` -> 20 test files passed (251 passed tests, including 10 new tests in `test/cal-002-actor-scale.test.ts`).
2. **TypeScript typecheck & build**:
   - Ran `npm run typecheck` -> 0 errors.
   - Ran `npm run build` -> clean build.
3. **Headless Chrome CDP browser verification**:
   - Automated CDP script connected to running `calibration-editor.html`:
     - Verified actor rect invariance when switching grid 5x5 -> 6x6 -> 8x8 -> 10x10 (`topW: 119.18`, `leftW: 119.18`, `rightW: 119.18` constant across all sizes).
     - Verified slider controls, live sprite resizing, and LEFT+RIGHT link synchronization.
     - Verified `Reset` restores values to `1.00`.
     - Verified exported JSON and `buildExportObject()` contain correct `actorScale`.
     - Verified dynamic viewport resizing at 1920x1080 and 1366x768 without layout breakage.

## FOUND / Bookkeeping Note

- **Ancestry Verification**:
  - `BASE_BRANCH`: `tool/CAL-001-arena-calibration-editor`
  - CAL-001 code commit: `481f8d3c2ef116b4ce0869155121428c3b58f385`
  - CAL-001 report/task commit: `370c8d6127087753d34c7869ae1030ed84bb0578` (the actual tip of `tool/CAL-001-arena-calibration-editor` and `START_SHA` of this task).
  - No git history rewriting occurred.
- **Isolated Worktree**:
  - All work performed exclusively inside `.worktrees/CAL-002` on branch `fix/CAL-002-independent-actor-scale`. Main checkout was left untouched.

