# TASK: BUILD-026 — Campaign / Level Authoring Tool

STATUS: READY
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
