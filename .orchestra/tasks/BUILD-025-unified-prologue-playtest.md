# TASK: BUILD-025 — Unified Prologue Playtest

STATUS: READY
TYPE: BUILD/INTEGRATION
SIZE: M
AGENT: Gemini / primary implementation
BASE_BRANCH: build/BUILD-024-calibrated-arena-runtime-v1
BRANCH: build/BUILD-025-unified-prologue-playtest
START_SHA: ea357d59e5af68f354e8bf447648a064cdf17d57

## Goal

Give the user one coherent playable build of the current game state so they can tune arena/actor sizing, play the Prologue end-to-end, and then decide what to do next.

This is an integration/playtest task, not a new-feature sprint.

The result must be launchable through the normal playable entry point. The user should not need console helpers, branch hopping, or manual debug setup to experience the current Prologue flow.

## Current baseline

BUILD-024 already provides:
- normal runtime arena presentation metadata;
- user-confirmed calibrated `prologue-5x5-good` scene;
- CAL-001/CAL-002 board/actor/effect calibration contract;
- independent actor scale;
- flexible/rectangular fallback compatibility.

Use BUILD-024 as the integration spine.

## Required work

### 1. Audit current playable Prologue path

Do a quick recon of current DONE runtime/gameplay work available in this branch ancestry and repository.

Identify the current intended Prologue sequence and make all already-implemented Prologue encounters/mechanics reachable in one normal linear playthrough.

Do NOT invent missing mechanics, rebalance encounters, or rewrite content merely to make the sequence longer.

If some completed task branch contains runtime code that is clearly part of the current Prologue but is not in BUILD-024 ancestry, first document it in FOUND and integrate only if:
- it is already DONE;
- it does not contradict later accepted behavior;
- the integration is low-risk and technically required for the current Prologue.

Do not merge unrelated experiments, design-only branches, or visual research.

### 2. One normal playtest entry point

Opening the normal visual/playable prototype should start or clearly expose one coherent Prologue playtest flow.

The user must be able to play forward without:
- calling `loadBakedArenaDebug()`;
- manually changing scene keys in console;
- opening multiple HTML pages to continue progression;
- switching Git branches.

A small dev-only scene selector may remain available, but the normal path must work by itself.

### 3. Preserve current gameplay canon

Do not change established rules while integrating.

Preserve at minimum:
- long-path arrow puzzle behavior;
- concurrent enemy timers;
- board-clear-alive is a valid win even if target survives;
- hit does not reset enemy timer by default;
- CAST -> hit during cast -> interrupt cancels cast -> enemy switches to normal attack;
- Stone Pin pinned-tap: no HP damage, no world turn, timers unchanged;
- Rotate as shared run resource after Prologue boss reward, if that flow is already implemented in current code;
- Goblin Shaman as Prologue boss.

If code and docs disagree, do not silently choose a new rule. Record the discrepancy in FOUND and preserve the latest already-implemented accepted behavior.

### 4. Calibration/user-tuning usability

The user explicitly plans to tune sizes/positions before the playthrough.

Keep calibration editor working from this branch and ensure the same calibration metadata used by runtime can be edited/exported without drift.

Do not build CAL-003 arena-import workflow here.

The user should be able to:
- open calibration editor;
- adjust board corners / actor anchors / effect anchors / actor scales;
- copy/export the calibration;
- apply the values in the normal source-of-truth entry;
- reload playtest and see the same result.

If there is a simple existing safe way to reduce the manual copy/paste loop without broad new tooling, small glue is acceptable. Do not expand scope into a new asset pipeline.

### 5. Playtest presentation consistency

For every Prologue scene that uses calibrated presentation metadata:
- board projection uses its calibration;
- actors use actor anchors and actorScale;
- effects use effect anchors;
- HUD follows final actor boxes;
- input/hit-testing aligns with projected board;
- resize 1920x1080 and 1366x768 remains sane.

Scenes with no calibration must continue through the flexible path.

Current arrow visuals are temporary and NOT accepted by the user. Do not redesign arrows in BUILD-025.

### 6. End-of-Prologue handoff

At the end of the currently implemented Prologue flow, show a clear stable end state / completion screen / next-step placeholder using existing UI patterns.

Do not invent Act I content just to continue.

The purpose is that the user can say: "I played the Prologue; here is what we change next."

## Verify

Manual/browser verify the normal flow from start to current Prologue end.

At minimum verify:
1. normal launch requires no console helper;
2. all current intended Prologue encounters are reachable in order;
3. win/lose/retry progression works;
4. Shaman boss flow works if currently implemented;
5. CAST interrupt behavior is preserved;
6. Stone Pin no-turn pinned tap behavior is preserved;
7. Rotate/resource state is preserved according to current implemented Prologue rules;
8. calibrated scene board/input alignment is correct;
9. actor sizes do not change when logical board size changes unless actorScale changes;
10. effect anchors remain independent;
11. flexible scene fallback still works;
12. rectangular regression scene still works;
13. calibration editor still loads and exports the same source-of-truth calibration;
14. 1920x1080 and 1366x768;
15. complete one full Prologue run manually/headlessly as far as practical.

Run:
- `npm run typecheck`
- `npm test`
- `npm run build`

Add focused tests for any integration glue that could regress scene progression, state carry-over, or presentation resolution.

## Do not

- no new arena PNG pipeline;
- no CAL-003 work;
- no arrow visual redesign;
- no new enemies/mechanics;
- no balance pass unless fixing an objectively broken/unwinnable integration;
- no Act I expansion;
- no merge to main;
- no work in shared checkout;
- do not treat design/mockup branches as runtime code.

## Delivery

Use isolated worktree from the start.
Quick recon -> short integration plan -> implementation.

RESULT / VERIFY / FOUND -> code commit -> push -> remote SHA verify -> STATUS DONE.

The final RESULT must include a short "USER PLAYTEST" section with exact launch steps and what the user should manually tune/check before reporting back.
