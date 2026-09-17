# TASK: CAL-003 — Arena import workflow in calibration editor

STATUS: READY
TYPE: TOOL
SIZE: S/M
AGENT: Laguna S 2.1 / implementation
BASE_BRANCH: fix/CAL-002-independent-actor-scale
BRANCH: tool/CAL-003-arena-import-workflow
START_SHA: 697c748757094f792016952bd2a19562bcd5f3d0

## Goal

Make the calibration editor usable for a brand-new arena PNG without first editing source files by hand.

The user should be able to open the editor, load/drop a local PNG, create a new draft calibration entry, calibrate board/actors/effects/scales, then export a paste-ready calibration entry. This is a tooling workflow only; no combat or arrow-art changes.

## Required workflow

1. Add `Import arena PNG` (file picker and/or drag-drop) to the standalone calibration editor.
2. Imported image is shown immediately as the arena background using a local object URL; do not require committing/copying the PNG first just to calibrate it.
3. Ask/provide controls for a new calibration id and target asset filename/path (human-readable, sanitized suggestion is fine).
4. Create an in-memory draft calibration for the imported image. Never mutate existing `ARENA_CALIBRATIONS` entries just by importing.
5. New draft starts from a sensible selectable template: clone current calibration geometry by default, with explicit choice/reset to a safe baseline if useful. Do not guess arena-specific geometry automatically and do not overwrite the user-confirmed `prologue-5x5-good` values.
6. Existing CAL-001/CAL-002 controls must work on the imported arena:
   - TL/TR/BR/BL board corners;
   - TOP/LEFT/RIGHT actor anchors;
   - TOP/LEFT/RIGHT effect anchors;
   - TOP/LEFT/RIGHT actorScale;
   - grid size 5x5..10x10;
   - live grid/arrows/sprites;
   - keyboard nudging/reset.
7. `Copy calibration` / JSON export must produce a NEW paste-ready entry using the new id and a repository-relative background path, not the temporary object URL/blob URL.
8. Provide a clear suggested asset destination (for example under the existing arena asset folder) and include it in the export/help text so the user knows where to copy the PNG into the repo.
9. Revoke old object URLs when replacing/removing imports.

## Optional convenience

If safely possible without adding a server/backend, add:
- `Download calibration JSON` with the new id;
- a one-click filename suggestion from the imported PNG name;
- duplicate-id warning against `ARENA_CALIBRATIONS`;
- `Clone current calibration as new` even without importing a new image.

Do NOT attempt unsafe browser writes into the repository. If direct source-file persistence would require a backend or broad filesystem permission, keep the workflow export-based and document the limitation.

## Preserve

Do not break:
- existing arena dropdown;
- CAL-002 actor scale invariance;
- existing Reset semantics;
- existing Copy/Download for registered arenas;
- production renderer;
- flexible arena path.

Imported draft state is editor-only until the user explicitly exports/copies it.

## Verify

Browser verification:
1. Open calibration editor.
2. Import an arbitrary local PNG.
3. Preview switches to that PNG without editing source files.
4. Create id `test-arena-import` and target filename/path.
5. Move all four board corners.
6. Move one actor anchor and one effect anchor independently.
7. Change LEFT actorScale only.
8. Switch 5x5 -> 8x8; actor footprint remains invariant as guaranteed by CAL-002.
9. Export contains the new id, repository-relative background path, board geometry, anchors, effectAnchors and actorScale; it contains NO `blob:` URL.
10. Reset behaves predictably for the imported draft.
11. Import a second PNG; first object URL is revoked and editor continues working.
12. Existing `prologue-5x5-good` still loads unchanged.
13. 1920x1080 and 1366x768.

Run:
- `npm run typecheck`
- `npm test`
- `npm run build`

## Do not

- no gameplay/balance changes;
- no arrow visual redesign;
- no arena auto-calibration guesses;
- no production runtime integration in this task;
- no merge to main;
- no edits in shared checkout.

## Delivery

Use an isolated worktree from the start.
RESULT / VERIFY / FOUND -> code commit -> push -> remote SHA verify -> STATUS DONE.
