# TASK: BUILD-028 — Integrate Square Prologue + Generated Art

STATUS: READY
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

## Verify

Check the merged result in a browser.

Prove at minimum:

1. Campaign Editor opens the 5-stage square Prologue.
2. Imported arenas are selectable.
3. Imported mobs/boss visuals are selectable and actually change the preview.
4. Changing arena on an already-calibrated level switches to the new arena's calibration baseline instead of retaining stale geometry.
5. Save writes the real project file and localStorage.
6. Reload restores arena + calibration + encounter data.
7. Play Level works.
8. Play Campaign runs all 5 square Prologue stages in sequence.
9. Stage 4 still has the intended two-target priority decision.
10. Stage 5 still has Shaman CAST/interrupt + Rotate flow.

Run normal typecheck/tests/build. Avoid redundant browser loops after the integration is proven.

## Delivery

Short `RESULT / VERIFY / FOUND`.

Add `USER PLAYTEST` with only:
- command to start;
- Campaign Editor URL;
- Playable Campaign URL;
- what the user should manually inspect first.

Commit, push, verify remote SHA, mark DONE.
