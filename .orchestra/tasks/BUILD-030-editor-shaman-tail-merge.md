# TASK: BUILD-030 — Merge Editor UX + Winnable Shaman Tail

STATUS: READY
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

## Verify

Keep verification lean but real:

1. Campaign Editor opens with readable dropdown options.
2. Existing imported-arena workflow is still present.
3. `campaigns/campaign.json` contains the canonical 5-stage campaign and Stage 5 FIX-029 tuning (seed 15 etc.).
4. Stage 5 can be completed through real browser UI actions, including Rotate and CAST interrupt, ending with boss HP 0.
5. Full campaign completes.
6. Save/reload still preserves authored/imported arena data.
7. Normal tests/typecheck/build pass.

Do not run research or a separate review.

## Delivery

Short `RESULT / VERIFY / FOUND` plus `USER PLAYTEST` with:
- Campaign Editor URL;
- Playable Campaign URL;
- only the two things the user should check manually: arena import/dropdown readability and Stage 5 Shaman.

Commit, push, verify remote SHA, mark DONE.
