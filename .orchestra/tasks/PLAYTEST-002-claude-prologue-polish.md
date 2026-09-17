# TASK: PLAYTEST-002 — Claude Prologue Polish

STATUS: READY
TYPE: FIX/INTEGRATION
SIZE: M/L
AGENT: Claude / primary fixer
BASE_BRANCH: build/BUILD-025-unified-prologue-playtest
BRANCH: fix/PLAYTEST-002-claude-prologue-polish
START_SHA: 548ddbeadcacfe05a096f472f27c574f0e3be0cc

## User goal

Take the current playable Prologue and make it actually usable for manual playtesting. The user can launch the game now, but the scene is not practically calibrated, some arrows are hard or impossible to see, and the current calibration workflow is not usable enough for the user to tune the scene and then play through the Prologue.

This is not a narrow patch. Treat the current branch as a working but rough integration and bring the whole Prologue playtest experience to a coherent, usable state.

## What matters most

- The user must be able to calibrate the current arena in the calibration editor and have those changes visibly affect the playable game without fighting the tooling.
- Arrow paths must be readable enough to play. Some are currently nearly invisible against the board/background; fix contrast/readability/presentation as needed.
- The playable Prologue flow must work end-to-end in the browser without console/debug-only rituals.
- Board geometry, actor placement/scale, effects, HUD and pointer hit-testing must stay aligned with the active calibration.
- Prefer practical working results over preserving awkward implementation details from earlier experiments.

## Existing pieces to inspect and reuse where useful

- CAL-001 calibration editor
- CAL-002 independent actor scale
- BUILD-024 runtime calibration integration
- BUILD-025 unified Prologue flow and browser/localStorage calibration override
- VIS-010 / VIS-011 arrow presentation work, as visual references only

Do not assume any of those are perfect. Inspect the current result in Chrome and fix what is actually wrong.

## Expected approach

Use browser playtesting heavily. Start from what the user sees now. Reproduce the bad calibration/readability issues, then improve the system until the user can:

1. open calibration editor;
2. move/resize the board and actors/effects;
3. save/apply calibration;
4. return to the game and see that exact calibration;
5. clearly see and interact with all arrows;
6. play the Prologue sequence normally.

You may change renderer/editor/CSS/runtime wiring as needed. Keep gameplay rules stable unless a clear integration bug prevents play.

## Delivery

Use an isolated worktree. Do not merge main.

When done, provide a short USER PLAYTEST section with exactly what to open and how to calibrate + start the Prologue.

Fill RESULT / VERIFY / FOUND honestly, commit, push, verify remote SHA, then mark DONE.
