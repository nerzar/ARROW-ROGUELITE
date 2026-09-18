# TASK: BUILD-030 — Merge Editor UX + Winnable Shaman Tail

STATUS: DONE
TYPE: INTEGRATION
SIZE: S/M
AGENT: Gemini / integration
BASE_BRANCH: build/BUILD-029-arena-import-editor-ux
BRANCH: integration/BUILD-030-editor-shaman-tail-merge
START_SHA: 658d81cf8b4861b7d03401b86a076dff440d2694

## Goal

Produce one branch containing both finished follow-up tasks on top of BUILD-028:

- BUILD-029 — readable dropdowns + Import Arena workflow;
- FIX-029 — actually winnable Stage 5 Goblin Shaman.

This is a small integration task. Do not redesign anything.

## Inputs

Editor UX / arena import:
- branch: `build/BUILD-029-arena-import-editor-ux`
- tip: `658d81cf8b4861b7d03401b86a076dff440d2694`
- code RESULT_SHA inside task: `7a73d6f74e15227ba6c1c0c89dd397f78b07f493`

Shaman fix:
- branch: `fix/FIX-029-shaman-stage-winnable`
- tip: `aec798a9682ebac6718b28bbede65b7df66dd26e`

Both descend from:
- `integration/BUILD-028-prologue-assets-authoring`
- `a915678fbd226c0d42a16852386452525ce8a6f1`

## Required result

Merge/reconcile FIX-029 into this branch while preserving all BUILD-029 editor functionality.

After integration, the branch must have:

- readable select/options in Campaign Editor;
- Import Arena from PNG/JPG/WebP through the dev server;
- imported arena persisted project-locally and restored after reload;
- existing calibration workflow intact;
- square 5-stage Prologue intact;
- Stage 5 using the FIX-029 playable Shaman content:
  - square 6x6;
  - seed 15;
  - Phase 1 TOP/North;
  - Phase 2 RIGHT/East;
  - CAST interrupt;
  - meaningful CCW Rotate;
  - real boss kill possible;
  - +2 Rotate reward;
- Stage 4 unchanged.

## Important merge rules

- Do not replace FIX-029's tuned Stage 5 campaign data with any BUILD-029 browser/import test save.
- Do not lose `campaign.customArenas[]` support from BUILD-029.
- Do not change the global rule that board-clear while alive can be a valid win elsewhere; FIX-029 solved Stage 5 by content tuning, not by changing global canon.
- Do not introduce a new arena-library architecture here.
- No merge to main.
- Work in an isolated worktree.

## Result

- Integrated `build/BUILD-029-arena-import-editor-ux` and `fix/FIX-029-shaman-stage-winnable` into `integration/BUILD-030-editor-shaman-tail-merge`.
- Preserved all BUILD-029 functionality:
  - Campaign Editor dark theme dropdown readability (`color-scheme: dark only`, styled `<option>` and `<select>` elements).
  - Dev server endpoint `POST /api/assets/import-arena` and UI button `📥 Import Arena` with project-local asset persistence and `campaign.customArenas[]` round-trip.
- Preserved all FIX-029 gameplay tuning in `campaigns/campaign.json`:
  - Stage 5 (Goblin Shaman): square 6x6, seed 15.
  - Phase 1: North/TOP (3 HP, interval 5, dmg 2).
  - Phase 2: East/RIGHT (2 HP, interval 3 CAST, interruptible into normal attack interval 4, grants +1 Rotate).
  - True boss kill (`enc.hits === enc.totalHp`, `enc.hp === 0`, `winRotateReward: 2`).
- Preserved regression test in `test/build-027-square-prologue.test.ts`. All 288 tests pass (`npm test`), typecheck and build pass cleanly.

## Found

No merge conflicts occurred during integration. Both branches modified separate files:
- BUILD-029 modified `spikes/arrow-core/tools/serve.mjs` and `viewer/visual-proto/calibration-editor.*`, `asset-catalog.*`, `campaign-model.*`.
- FIX-029 modified `spikes/arrow-core/campaigns/campaign.json` and `test/build-027-square-prologue.test.ts`.
Both feature sets coexist seamlessly without regressions.

## Verify

- `npm test`: 24 test files, 288 tests passed.
- `npm run typecheck`: 0 errors.
- `npm run build`: successful build.
- Browser UI Verification (via headless Edge & CDP on port 5190):
  1. **Campaign Editor** (`/viewer/visual-proto/calibration-editor.html`):
     - Verified dropdown styles: `<select>` `color-scheme: dark only`, background `rgba(127, 127, 127, 0.12)`, text `rgb(239, 236, 228)`.
     - Verified `<option>` elements have dark background `rgb(23, 16, 24)` and readable text `rgb(239, 236, 228)`.
     - Verified `📥 Import Arena` button and hidden file input are present in the top bar.
  2. **Playable Campaign Stage 5** (`/viewer/visual-proto/`):
     - Switched to Stage 5 (`authored-4`, seed 15).
     - Executed real arrow canvas taps and HUD Rotate CCW click:
       - Arrow 0 (North, hit 1/3) -> Arrow 1 (East, miss) -> Arrow 3 (North, hit 2/3) -> Arrow 4 (North, hit 3/3, advances Shaman to East in Phase 2, arms CAST, awards +1 Rotate) -> Arrow 7 (North, miss) -> Arrow 5 (South, miss, CAST countdown: 1) -> click `rotCcw` -> Arrow 2 (East, hit 4/5, CAST INTERRUPTED) -> Arrow 8 (East, hit 5/5, LETHAL BOSS KILL).
     - Full victory overlay appeared: *"Пролог пройден! HP на финише: 10/10. Награда за босса: +2 ROTATE"*.

## User Playtest

When running the static server (`node tools/serve.mjs 5177` from `spikes/arrow-core`):

1. **Campaign Editor URL**: `http://localhost:5177/viewer/visual-proto/calibration-editor.html`
   - *What to check*: Click the `arena` or `Level` dropdowns — options now have high-contrast readable text against dark backgrounds. Notice the new `📥 Import Arena` button in the topbar for importing custom arena images.
2. **Playable Campaign URL**: `http://localhost:5177/viewer/visual-proto/`
   - *What to check*: Select Stage 5 (Goblin Shaman). Knock out Phase 1 on North, watch the Shaman move East and start casting. Click Rotate CCW (⟲ / Q) and fire the newly-aligned East arrows to see **CAST INTERRUPTED** and defeat the boss with 10/10 HP!

