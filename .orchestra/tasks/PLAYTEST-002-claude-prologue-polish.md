# TASK: PLAYTEST-002 — Claude Prologue Polish

STATUS: READY
TYPE: FIX/INTEGRATION
SIZE: M/L
AGENT: Claude / primary fixer
BASE_BRANCH: build/BUILD-025-unified-prologue-playtest
BRANCH: fix/PLAYTEST-002-claude-prologue-polish
START_SHA: 548ddbeadcacfe05a096f472f27c574f0e3be0cc

## Goal

Make the current playable Prologue actually usable for the user's own calibration and end-to-end playtest.

This is the current practical project priority.

## What is wrong now

- Calibration exists, but the workflow is still awkward enough that the user cannot comfortably tune the scene and immediately test it.
- Some arrow paths are hard or nearly impossible to read against the board/background.
- The integrated Prologue is technically playable, but not yet a coherent user-facing playtest experience.

## Required result

The user must be able to:
1. open the calibration editor;
2. move/resize the board and tune actor/effect placement/scale;
3. save/apply calibration without fighting copy/paste/debug rituals;
4. return to the normal playable game and see the same calibration;
5. clearly see and interact with every arrow needed to play;
6. play the current Prologue sequence end-to-end without console helpers or branch/page hopping.

Board geometry, actor placement/scale, effects, HUD and pointer hit-testing must stay aligned with the active calibration.

## Existing pieces

Reuse only as useful:
- CAL-001 calibration editor;
- CAL-002 independent actor scale;
- BUILD-024 runtime calibration integration;
- BUILD-025 unified Prologue + browser/local calibration override;
- VIS-010 / VIS-011 as arrow visual references, not automatically accepted final art.

Do not reread every old task-card unless a concrete implementation question requires it. Start from what the current playable build actually does.

## Boundaries

- Preserve current gameplay canon from `PROJECT.md`.
- Do not invent new enemies/mechanics or rebalance encounters unless fixing an objectively broken/unplayable integration.
- Practical renderer/editor/CSS/runtime fixes are allowed.
- Arrow readability may be improved enough for playtest, but do not silently declare a final arrow-art direction.
- No merge to `main`.
- Do not touch a shared/dirty checkout; use an isolated worktree if another agent is using the repo.

## Verify

Check the result in a browser, using whatever browser/tool is convenient.

Prove at minimum:
- calibration editor -> save/apply -> playable game round-trip;
- board/input alignment after calibration;
- readable/interactable arrows;
- full Prologue progression, win/lose/retry and Shaman boss flow;
- current gameplay canon remains intact;
- sane layout around 1920x1080 and 1366x768;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Do enough browser testing to prove these points; do not keep looping once the criteria are met.

## Delivery

Use short `RESULT / VERIFY / FOUND`.

Include a short `USER PLAYTEST` section with exactly:
- what the user opens/runs;
- how to calibrate and save;
- how to return to/start the Prologue;
- what still needs the user's visual/game-feel judgement.

Commit, push, verify remote delivery, mark DONE and stop.
