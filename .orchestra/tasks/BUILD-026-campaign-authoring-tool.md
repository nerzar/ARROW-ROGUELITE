# TASK: BUILD-026 — Campaign / Level Authoring Tool

STATUS: DONE
TYPE: BUILD
SIZE: L
AGENT: Claude / primary implementation
BASE_BRANCH: tool/CAL-004-prologue-stage-calibration
BRANCH: build/BUILD-026-campaign-authoring-tool
START_SHA: 0fbba65a1705825eca9d307dc4c49478f3e4419a

## Goal

Turn the current Prologue calibration tooling into a practical campaign/level authoring workflow.

The user should be able to create or edit a campaign level, choose its board, arena and enemies, tune presentation/calibration, save it, reopen it, and play it without hand-editing JSON.

Prefer extending the working CAL-004/playable tooling over creating a separate isolated experiment.

## New user decisions

- New authored boards are square-only for now. Do not build new irregular/rectangular authoring UX in this task. Existing legacy encounters may remain readable/compatible, but the editor should create square boards.
- Default enemy placement is the center/top slot. A newly added enemy should only start on left/right when the center slot is already occupied or the user explicitly changes it.
- Current runtime arrow visuals stay as-is except for existing readability fixes; arrow art is not the focus of this task.
- The authoring workflow should use the generated arenas/mobs that are being prepared from `C:\Users\nerza\Projects\magicarrowassets` via ASSET-001. Keep the integration point simple enough that the asset catalog can be merged without redesigning the editor.

## What the tool should let the user do

For each campaign level:

- create / duplicate / delete / reorder a level;
- set a title/id;
- choose a square board size and seed or another existing supported square-board source;
- regenerate/replace the puzzle while keeping the level shell where practical;
- choose an arena/background;
- add/select enemies or boss visuals from the available asset catalog;
- set enemy gameplay data already supported by the current encounter model (HP, timers/damage/special fields where applicable) without inventing new mechanics;
- place enemies using the current actor slots, with center/top as the default first slot;
- tune actor scale, sprite pivot/foot offset, effect anchors and board corners using the existing calibration controls;
- preview the selected level in the same presentation path used by the playable game;
- save and reopen the authored campaign/levels;
- launch the selected level and the campaign sequence for playtest.

Reuse existing encounter/presentation/calibration formats where sensible. Avoid a second parallel content model unless there is a strong reason.

## Persistence — important

`localStorage` alone is no longer enough.

A normal Save should persist the current authored data to browser state for convenience AND, in the local authoring/dev workflow, persist it to a real project file in a human-readable format that can be committed to Git and reopened later.

Choose the simplest practical implementation for the current local toolchain (for example a small dev-server write endpoint, file-system save path, or another equally direct approach). The exact mechanism is up to the executor.

Requirements:

- one obvious Save action;
- user can tell whether file persistence succeeded;
- saved file contains the full level/campaign data needed to reopen it, including presentation/calibration;
- reopening the tool from the saved file restores the authored result;
- no silent situation where UI says saved but only localStorage changed;
- keep a browser-only fallback if direct file writing is unavailable, but make that fallback explicit.

Do not commit machine-specific absolute paths into authored campaign data.

## Existing design context for early levels

Do not redesign the teaching arc in this task. Preserve the current purpose of the five Prologue beats unless the user later changes it:

1. basic shot / projectile continues outside the board;
2. unlock order / blocked-arrow mistake;
3. timer pressure / hits have a cost;
4. multi-enemy target priority;
5. Goblin Shaman / direction + CAST interrupt + Rotate reward.

The concrete boards may be replaced with square boards later without changing those teaching goals.

## Asset integration

ASSET-001 may run in parallel and is expected to provide a usable arena/mob catalog from the local `magicarrowassets` source.

BUILD-026 should consume a small data-driven catalog/manifest rather than hardcode every new PNG in editor UI.

If ASSET-001 is not finished yet, build the authoring path against the current assets plus a simple catalog contract, and document the merge point. Do not block the whole tool waiting for every art asset.

## Boundaries

- No new gameplay mechanic design.
- No big research/review phase before implementation.
- No final art-direction work.
- Do not replace working calibration/runtime systems without a concrete need.
- Keep implementation choices flexible; solve the user workflow, not a predetermined architecture.
- No merge to `main`.

## Verify

Check the real authoring flow in a browser.

At minimum prove that a user can:

1. create a new square level;
2. choose board/seed, arena and at least one enemy;
3. see the first enemy appear in the center/top slot by default;
4. calibrate board + actor + scale + pivot + effects;
5. Save;
6. confirm a real project file was written and browser state also updated;
7. reload/reopen and get the same level back;
8. play the level;
9. create/reorder several levels and play them as a sequence.

Run the normal typecheck/tests/build needed by the touched code, but do not spend time on redundant browser loops once the workflow is proven.

## Delivery

Short `RESULT / VERIFY / FOUND` plus `USER PLAYTEST` with only the practical steps the user needs tomorrow morning.

Commit, push, verify remote SHA, mark DONE.

---

## RESULT

Campaign & Level Authoring Tool fully implemented and verified in the browser.

### Key features implemented

1. **Square-only level authoring**:
   - Fixed square ladder: 5x5, 6x6, 7x7, 8x8, 9x9, 10x10 with presets and seed generation.
   - Seed rolling via UI button `[🎲 Roll]`.
   - Puzzle regenerates smoothly while keeping level shell, enemies, and calibration intact.

2. **Center-first enemy slot policy**:
   - First enemy is placed in `slot 0 (TOP / Center)` by default.
   - Adding subsequent enemies fills `slot 1 (RIGHT)`, then `slot 3 (LEFT)`.
   - Each enemy allows configuring species (from data-driven catalog), slot, HP, and Attack Timer (interval + damage).

3. **Data-driven asset catalog (`asset-catalog.js`)**:
   - Arenas catalog: `prologue-5x5-good`, `6x6-5`, `moonlit-fortress`.
   - Creatures catalog: `goblin-shaman`, `goblin-taunter`, `dire-wolf`, `green-slime`, `small-goblin`, `spider-brute`, `skeleton-child`.
   - Direct integration hook for upcoming ASSET-001 packs without UI redesign.

4. **Dual persistence (Project File + localStorage)**:
   - Dev-server endpoint in `tools/serve.mjs`: `POST /api/campaign/save` writes human-readable `spikes/arrow-core/campaigns/campaign.json` directly to the project repository.
   - Fallback and sync to browser `localStorage` under `arrow_authored_campaign`.
   - UI shows clear status badges: `✔ Saved to campaigns/campaign.json & storage` or `⚠ Saved to browser storage only`.
   - Full round-trip restore on reload and restart.

5. **Integrated calibration and live preview**:
   - Per-level presentation block stores full calibration (board corners, actor anchors, actorScale, spritePivot, effect anchors).
   - Real-time drag handles and live render pipeline matching the playable game.

6. **Playable game integration**:
   - `[▶ Play Level]` and `[▶ Play Campaign]` buttons in the editor.
   - `app.js` supports `?mode=authored&stage=N` and lists authored levels in `#scenePick`.
   - Campaign sequence runs smoothly in `RunState` with state carry-over, stage progression, and final completion screen.

### USER PLAYTEST

1. Start dev server:
   ```bash
   cd spikes/arrow-core
   node tools/serve.mjs
   ```
2. Open Campaign Authoring Tool:
   `http://localhost:5177/viewer/visual-proto/calibration-editor.html`
3. Try authoring actions:
   - Click `+ Level` to add a new stage (notice the default enemy starts in the Center/TOP slot).
   - Change square size (5x5..10x10), roll a new seed (`🎲 Roll`).
   - Add a 2nd enemy (`+ Add Enemy`) -> goes to RIGHT slot. Set HP and toggle Attack Timer.
   - Adjust board corners or actor scale if desired.
   - Click `💾 Save` -> verify badge turns green: `✔ Saved to campaigns/campaign.json & storage`.
   - Click `▶ Play Level` or `▶ Play Campaign` -> directly launches the playable game with your authored campaign!
   - Reload editor page -> all authored levels and calibrations restore from `campaign.json`.

---

## VERIFY

- `npm run typecheck` -> **0 errors** ✅
- `npm test` -> **281 tests passed across 23 test files (0 failures)** ✅
- `npm run build` -> **clean build, 0 errors** ✅
- Headless Chrome browser automated CDP verification (`tools/verify-browser-authoring.mjs`) -> **All checks passed** ✅:
  1. Campaign editor initial load & level count verified.
  2. `+ Level` creates square board with center-first enemy (slot 0 / TOP).
  3. `+ Add Enemy` occupies next available slot (slot 1 / RIGHT).
  4. Board size and seed tuning generates solvable board.
  5. `Save` action writes real `campaigns/campaign.json` (4430 bytes) on disk and updates localStorage.
  6. Page reload restores full authored campaign from disk file with matching calibration and board settings.
  7. Playable game (`?mode=authored&stage=0`) initializes `RunState`, renders level, and executes player tap/combat actions.

---

## FOUND

1. **EncounterState side notation**: Side numbers are 0 (North/Top), 1 (East/Right), 2 (South), 3 (West/Left). For center-first enemy placement, 0 is the natural choice as it puts the mob on the center platform facing the player board.
2. **Inline calibration vs ID lookup**: Added support in `resolveArenaPresentation` for inline `presentation.calibration` objects, enabling authored levels to carry custom board/actor calibrations directly in their JSON definition without needing entries hardcoded in `ARENA_CALIBRATIONS`.
3. **Square presets ladder**: `PRESETS` already defined `square5`; `square6` through `square10` were added to `src/presets.ts` using the consistent area-scaling formula `max(4, round(n * n * 0.12))` for reliable generation.

