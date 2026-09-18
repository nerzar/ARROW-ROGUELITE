# TASK: TOOL-002 — Creature Presentation Defaults

STATUS: READY
TYPE: TOOL / RUNTIME INTEGRATION
SIZE: M
AGENT: Claude / frontend + visual tooling
BASE_BRANCH: build/BUILD-031-editor-authoring-polish
BRANCH: tool/TOOL-002-creature-presentation-defaults
START_SHA: 92534550a17b8d344cdc0e458e467de8234bfbfd

## First action

Read:
- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/handoffs/TOOL-002-creature-presentation-defaults.md`

Before any branch switching, inspect `.worktrees/TOOL-001` and preserve its uncommitted follow-up
edits.

Do not work in the shared checkout.

## Goal

Bring the accepted TOOL-001 Pose Editor onto the accepted BUILD-031 base and make saved
per-species presentation defaults actually affect the real runtime.

## Required result

### 1. Integrate TOOL-001 without regressing BUILD-031

Bring over the Pose Editor functionality from TOOL-001 while preserving:
- BUILD-031 full 10-creature catalog;
- Arena Default workflow;
- imported-arena persistence;
- actor scale lower bound 0.1;
- the user's calibrated campaign content.

Resolve overlap in `asset-catalog.js` / `assets.js` carefully instead of taking one branch
wholesale.

### 2. Preserve local TOOL-001 refinements

If still present locally, include:
- equal clean source-gallery grid;
- live "current values" panel;
- any other clearly related unfinished Pose Editor polish from the interrupted session.

### 3. Make species presentation defaults real

Pose Editor currently saves pivot/scale but runtime ignores them.

Implement a small data-driven per-species default presentation layer:
- one default pivot per species;
- one default scale per species;
- saved through the Pose Editor/project-local manifest;
- used by Campaign Editor preview and playable runtime.

Keep existing per-scene TOP/LEFT/RIGHT calibration controls. They remain the final adjustment and
must not be removed or silently reset.

Do not build a per-pose rigging system in this task.

### 4. Compatibility

Existing species without saved defaults must render exactly as before.
Existing pose assignments must keep working.
Goblin Shaman / Goblin Taunter / Dire Wolf must not regress.

## Verify in browser

1. Open Pose Editor.
2. Select a species and change its default scale/pivot.
3. Save.
4. Reload Pose Editor: values persist.
5. Open Campaign Editor: same species visibly uses the saved defaults.
6. Play Level: runtime uses the same defaults.
7. Per-scene TOP/LEFT/RIGHT calibration can still adjust the result further.
8. Another species without overrides remains unchanged.

Run tests/typecheck/build.

## Delivery

Short RESULT / VERIFY / FOUND / USER PLAYTEST.
Document the final precedence/order between:
- legacy asset/pose correction;
- species default;
- arena/side calibration.

Do not merge.
