# TASK: CAL-002 — Independent actor scale in calibration editor

STATUS: READY
TYPE: FIX/TOOL
SIZE: S
AGENT: Gemini / implementation
BASE_BRANCH: tool/CAL-001-arena-calibration-editor
BRANCH: fix/CAL-002-independent-actor-scale
START_SHA: 370c8d6127087753d34c7869ae1030ed84bb0578

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
