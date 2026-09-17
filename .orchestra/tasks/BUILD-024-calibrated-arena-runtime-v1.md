# TASK: BUILD-024 — Calibrated arena runtime v1

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: Gemini / implementation
BASE_BRANCH: fix/CAL-002-independent-actor-scale
BRANCH: build/BUILD-024-calibrated-arena-runtime-v1
START_SHA: 697c748757094f792016952bd2a19562bcd5f3d0

## Goal

Take the calibration system out of debug-only/proof mode and wire one user-confirmed calibrated arena into the normal playable runtime path end-to-end.

CAL-001/CAL-002 already provide:
- per-arena board plane calibration;
- independent TOP/LEFT/RIGHT actor anchors;
- independent effect anchors;
- independent actor scale;
- calibration editor/export.

The next step is to make a normal playable encounter select and use a calibrated arena through ordinary scene/runtime metadata, without relying on `loadBakedArenaDebug()` or manual debug-only loaders.

## Scope

Implement the minimal production scene contract needed for one calibrated 5x5 arena.

Use the user-confirmed `prologue-5x5-good` calibration as the first production proof unless a newer explicit user-confirmed calibration already exists in this branch ancestry; if so, document the choice in RESULT.

A normal playable scene/encounter must be able to resolve:
- arena/background id;
- calibration id;
- board size lock if needed for that scene;
- actor anchors;
- effect anchors;
- actor scale;

through one clear metadata path.

Do not duplicate calibration geometry in encounter code or renderer magic numbers.

## Runtime requirements

1. A normal playable prologue encounter can load the calibrated arena without any debug helper.
2. `board-renderer.js` receives the correct calibration through the same ordinary render path used during play.
3. Grid/arrow projection, pointer hit-testing, actors, HUD and VFX all use that active calibration.
4. Actor scale from CAL-002 is honored.
5. Changing logical square size for debug/test does not change calibrated actor footprint.
6. Existing flexible/un-calibrated scenes remain functional and backward compatible.
7. Existing rectangular regression encounter remains functional.

## Scene metadata

Prefer one simple explicit presentation field on scene/encounter configuration instead of hidden branching, e.g. an arena/presentation block. Exact naming is up to implementation after recon.

Avoid coupling game rules to art metadata.

Presentation metadata must not change:
- HP;
- timers;
- combat rules;
- Rotate;
- Stone Pin;
- encounter semantics.

## First production proof

Use one actual playable prologue encounter and one calibrated 5x5 arena.

The point of this task is not to redesign the prologue or change level balance. Keep the existing encounter logic/seed unless a tiny adapter is required.

The resulting screen may still use the CURRENT arrow visual language. Arrow ART is explicitly out of scope because VIS-011/user review is still deciding the final visual direction.

Do not block this task on arrow-style approval.

## Debug/editor compatibility

Do not break:
- CAL-001 calibration editor;
- CAL-002 actor scale controls;
- `loadBakedArenaDebug()` if it remains useful as a debug helper.

Production runtime and calibration editor must consume the same calibration metadata contract.

## Verify

Browser verify at minimum:
1. normal playable prologue scene uses `prologue-5x5-good` through ordinary runtime path;
2. board geometry aligns with its stored calibration;
3. TOP/LEFT/RIGHT actors stand on their configured anchors;
4. actor scales match calibration metadata;
5. effects use effect anchors, independent from actor anchors;
6. click first/last row+column, corners, center;
7. rotate mapping remains correct;
8. 1920x1080 and 1366x768;
9. one flexible existing scene still works;
10. one rectangular existing encounter still works;
11. calibration editor still loads/exports the same entry.

Run:
- `npm run typecheck`
- `npm test`
- `npm run build`

## Do not

- no arrow visual redesign;
- no gameplay/balance changes;
- no new enemy mechanics;
- no arena art generation;
- no merge to main;
- do not delete old flexible path;
- do not hardcode the user calibration a second time in app/encounter logic.

## Delivery

Use isolated worktree from the start.
Quick recon first, then short plan, then implementation.
RESULT / VERIFY / FOUND -> code commit -> push -> remote SHA verify -> STATUS DONE.
