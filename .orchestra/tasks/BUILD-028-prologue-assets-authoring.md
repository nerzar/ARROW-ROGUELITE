# TASK: BUILD-028 — Integrate Square Prologue + Generated Art

STATUS: DONE
TYPE: INTEGRATION/FIX
SIZE: M
AGENT: Gemini / integration
BASE_BRANCH: build/BUILD-027-square-prologue-campaign
BRANCH: integration/BUILD-028-prologue-assets-authoring
START_SHA: 6a8f781ec02f7e86e4c13dd66cc95a453c7a148d

## Goal

Produce one working branch that contains all accepted recent work:

- BUILD-026 Campaign / Level Authoring Tool;
- BUILD-027 square 5-stage Prologue campaign;
- ASSET-002 generated arenas/mobs integration.

The result should be the single practical branch the user opens next for calibration and playtest.

## Inputs

Square Prologue branch:
- `build/BUILD-027-square-prologue-campaign`
- expected tip when task was created: `6a8f781ec02f7e86e4c13dd66cc95a453c7a148d`

Generated art branch:
- `build/ASSET-002-generated-art-integration`
- expected tip when task was created: `5add852281b0f05b4f7490d9497de5a40038e78f`

Both descend from BUILD-026.

## Required result

Merge/reconcile ASSET-002 into this integration branch without losing BUILD-027's authored square Prologue.

The merged Campaign Editor must provide:

- the 5 square Prologue levels from BUILD-027;
- the imported arenas and creature species from ASSET-002;
- existing create/duplicate/delete/reorder/seed/save/play authoring workflow;
- file + localStorage persistence;
- live preview using the same renderer as playable mode.

### Important merge rule

Do NOT replace BUILD-027's canonical 5-stage `campaigns/campaign.json` with any temporary ASSET-002 browser/save test state.

After integration the default authored campaign must still be the square Prologue:
1. basic shot;
2. unlock order / mistake;
3. timer pressure;
4. two-enemy priority;
5. Goblin Shaman + direction/CAST/Rotate.

Imported art becomes available to those levels through the editor/catalog.

## Fix the known arena-switch bug

ASSET-002 found a concrete authoring bug:

When an already-calibrated level changes arena/background, the image changes but the level may keep the previous arena's calibration geometry.

Fix this in the merged branch.

Expected behavior:

- selecting a different arena immediately resolves that arena's own baseline calibration/presentation;
- board quad / actor anchors / effect anchors / scale / sprite pivot must no longer silently remain from the previous arena;
- keep gameplay/content fields intact: board seed/size, encounter, enemies, HP/timers, level identity/order;
- after the new arena baseline is loaded, the user can tune it further and Save normally;
- saved/reloaded result must preserve the chosen arena and resulting calibration.

Choose the simplest implementation that fits the existing BUILD-026 model. Do not create a second calibration system.

## Boundaries

- No new gameplay mechanics.
- No new visual redesign of arrows.
- No research/review task.
- No production-architecture rewrite.
- Do not silently change the 5 teaching beats.
- Do not merge to `main`.

## RESULT

- Successfully merged `build/ASSET-002-generated-art-integration` into `integration/BUILD-028-prologue-assets-authoring` on top of `build/BUILD-027-square-prologue-campaign`.
- Canonical 5-stage square Prologue in `campaigns/campaign.json` preserved intact (basic shot, mistake cost, timer pressure, two-enemy priority, Goblin Shaman direction/CAST/Rotate).
- 4 generated arenas (Grimskull Throne, Ironvow Bastion, Autumnfall Ruins, Demonforge Gate) and 4 enemy species (Green Slime, Small Goblin, Spider Brute, Skeleton Child) integrated into catalog and available in Campaign Editor.
- Fixed the arena-switch bug:
  - Added `changeLevelArena(levelDef, arenaIdOrPath)` to `campaign-model.js`: immediately resolves that arena's baseline calibration (`boardPlaneFrac`, `anchors`, `actorScale`, `spritePivot`) so old geometry is never silently retained on arena swap.
  - Updated `calibration-editor.js` (`ui.bgPick.onchange` and `loadLevel`) to reject stale calibration from differing arena IDs and immediately apply the chosen arena's baseline geometry.
  - Added `6x6-5` -> `boss-shadow-moon` alias in `arena-calibration.js`.
  - Ensured `executeSave` synchronizes `presentation.arena` with `background` and `calibration`.
- RESULT_SHA (code): 1cc04d9

## VERIFY

- ✅ Automated tests: 288/288 passed across 24 test files (`npm test`), including dedicated unit test in `test/build-026-campaign-authoring.test.ts` verifying `changeLevelArena` and stale geometry elimination.
- ✅ TypeScript: `npm run typecheck` and `npm run build` clean (0 errors).
- ✅ Browser verification via headless Edge CDP against local dev server:
  1. Campaign Editor opens the 5-stage square Prologue (`campaign().levels.length === 5`, stage 1 title verified).
  2. All 7 arenas in dropdown are selectable (including Ironvow Bastion, Grimskull Throne).
  3. Imported creatures selectable and update preview (Green Slime selected and rendered).
  4. Switching arena on an already-calibrated level immediately resets board plane quad from `[0.37, 0.45]` to `[0.3, 0.329]` (Ironvow baseline), eliminating stale geometry.
  5. Tuning and Save writes real project file `campaigns/campaign.json` and storage (`ok: true, fileSaved: true`).
  6. Reload restores tuned arena + calibration (`actorScale.top: 1.33`, draft id: `ironvow-6x6`).
  7. Play Level opens authored level in playable game.
  8. Play Campaign runs all 5 square Prologue stages in sequence.
  9. Stage 4 verifies two-target priority decision (slow TOP, urgent RIGHT).
  10. Stage 5 verifies Shaman CAST/interrupt + Rotate flow.

## FOUND

None. All merge criteria and bug fix behaviors verified cleanly in browser and unit tests.

## USER PLAYTEST

- Command to start:
  ```bash
  cd spikes/arrow-core && npm run viewer
  ```
- Campaign Editor URL: `http://localhost:5177/viewer/visual-proto/calibration-editor.html`
- Playable Campaign URL: `http://localhost:5177/viewer/visual-proto/index.html?mode=authored&stage=0`
- What the user should manually inspect first:
  1. In Campaign Editor, on Stage 1, change the **arena** dropdown to "Ironvow Bastion" or "Grimskull Throne" — verify the board quad and anchor handles jump immediately to the new arena's painted tiles rather than keeping the old 5x5-good boundaries.
  2. Click **Play Campaign** to play all 5 square stages sequentially through the real renderer and confirm Stage 4 (two enemies) and Stage 5 (Shaman CAST + Rotate) play through cleanly.
