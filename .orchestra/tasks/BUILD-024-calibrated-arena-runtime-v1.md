# TASK: BUILD-024 — Calibrated arena runtime v1

STATUS: DONE
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

## RESULT

1. **Scene/Encounter Presentation Metadata Contract**:
   - Added `ArenaPresentation` interface (`arena?: string; calibration?: string`) in `src/encounter.ts` (re-exported through `src/index.ts`).
   - Extended `EncounterDef` and `EncounterFile` with optional `presentation?: ArenaPresentation` metadata, decoupled from combat/puzzle rules.
   - Validated `presentation` in `checkEncounter(def)` and preserved in `encounterFromJson` / `encounterToJson`.
   - Added `resolveArenaPresentation(presentation)` in `viewer/visual-proto/arena-calibration.js` (and `.d.ts`), resolving calibration by id/arena name from `ARENA_CALIBRATIONS` with fallback to `null`.

2. **First Production Proof 5x5 Encounter**:
   - Added `square5` preset (5x5, minLength 2, maxLength 4, turnChance 0.12, targetFill 0.75, minFill 0.60, minArrows 4) to `src/presets.ts`.
   - Authored `encounters/prologue-5x5.json` (square5 seed 1107, hash `4b2681e6`) with `presentation: { arena: "prologue-5x5-good", calibration: "prologue-5x5-good" }`.
   - Proved 100% winnable puzzle sequence: Arrow 0 (East, puzzle peeling move) -> Arrow 3 (North, hits target `grunt_passive` for 1 HP -> Win).
   - Preserves exact prologue combat-pressure contract (0 blockedTapDamage, 0 rotate).

3. **Playable Visual Shell Integration (`viewer/visual-proto/app.js`)**:
   - Inserted `prologue-5x5` into `SEQUENCE_STEPS` as the first playable sequence encounter, defaulting `initialKey` to `'prologue-5x5'`.
   - In `getStep(scene)`, preserved step/encounter `presentation` metadata.
   - In `loadActiveStep()`, resolved active step presentation via `resolveArenaPresentation(step.presentation ?? step.def?.presentation)`.
   - Dynamically applied calibrated background art (`assets/arenas/prologue-act1/5x5-good.png`) when calibrated, and passed `activeCalibration` to `renderer.resize(level, activeCalibration)`.
   - When transitioning to uncalibrated/flexible encounters (e.g. `cp-e5` mini-boss or `act1-e1` rectangular encounter), `activeCalibration` is cleared (`null`), default background is automatically restored via `restoreDefaultBackground()`, and `renderer.resize(level, null)` maintains full backward compatibility.
   - Preserved `loadBakedArenaDebug()` and `loadSquareDebug()` helpers.

4. **Testing and Verification**:
   - Added test suite `test/build-024-calibrated-runtime.test.ts` (10 tests) covering:
     - `resolveArenaPresentation` metadata contract and fallbacks;
     - `prologue-5x5` encounter parsing, win proof, and serialization;
     - `board-renderer.js` calibrated quad corners, anchors, effect anchors, actor scale decoupling, and responsive scaling at 1920x1080 and 1366x768;
     - pointer `hitTest` accuracy across calibrated 5x5 board;
     - flexible scene / rectangular regression compatibility (`act1-e1`).
   - Browser verified end-to-end in headless Chrome via CDP:
     - `index.html` loads directly into `prologue-5x5` on `prologue-5x5-good`;
     - board plane aligns 5x5 corners to calibrated fractions;
     - solver taps Arrow 0 then Arrow 3 -> victory overlay displayed;
     - advancing to `cp-e5` seamlessly restores flexible background and 8x10 geometry;
     - `act1-e1` rectangular regression encounter functions properly;
     - `calibration-editor.html` loads and exports `prologue-5x5-good` with `boardSizeLocked: 5` and actor scales intact.

## VERIFY

- `npm run typecheck` -> 0 errors.
- `npm test` -> 21 test files passed (261 tests total).
- `npm run build` -> clean TypeScript build.
- Browser CDP verification in headless Chrome across 1920x1080 and 1366x768 viewports:
  - Initial load on `prologue-5x5` on `prologue-5x5-good` arena.
  - Interactive hit testing and puzzle win flow.
  - Sequence advance to `cp-e5` restoring flexible arena.
  - Rectangular scene `act1-e1` verified.
  - Calibration editor `calibration-editor.html` verified.

## FOUND

- Calibration baseline choice: confirmed `prologue-5x5-good` (`assets/arenas/prologue-act1/5x5-good.png`, `boardSizeLocked: 5`) as user-confirmed reference calibration from FIX-023 / CAL-002.
- Clean separation: presentation metadata is completely decoupled from puzzle generator and combat solver rules.
- Worktree isolation: all changes developed and tested exclusively inside `.worktrees/BUILD-024`.

