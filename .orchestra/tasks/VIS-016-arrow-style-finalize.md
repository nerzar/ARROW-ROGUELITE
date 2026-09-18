# TASK: VIS-016 — Finalize Live Arrow Visual Style

STATUS: READY
TYPE: VISUAL / RENDERER POLISH
SIZE: M
AGENT: Claude / visual implementation
BASE_BRANCH: build/BUILD-031-editor-authoring-polish
BRANCH: design/VIS-016-arrow-style-finalize
START_SHA: 92534550a17b8d344cdc0e458e467de8234bfbfd

## First action

Read:
- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/handoffs/VIS-016-arrow-style-finalize.md`

Then inspect old local arrow worktrees/stashes BEFORE editing. Preserve useful uncommitted geometry
and newer solid-fill WIP. Do not work in the shared checkout.

## Goal

Finish the visual language of the current long arrows in the real playable renderer.

Do not redesign the gameplay. Do not restart visual exploration from zero.

## Direction

Keep the corrected geometry, then make the default arrow a simple solid warm fantasy shape:
- warm gold / amber / champagne;
- attractive and readable on saturated arena art;
- no black pipes;
- no cold grey plastic heads;
- no white tube/core;
- no thick black outline;
- no permanent strong neon.

Inactive/blocked should remain readable in a quieter warm stone / ash bronze / muted gold family.

The stronger fantasy magic look is an OPTIONAL overlay for hover/targeting/firing/tutorial/special
states, not the always-on base.

Normal gameplay must not over-explain which arrows are safe/free because wrong taps are part of
the risk/reward.

## Implementation freedom

Use the existing Canvas2D renderer and corrected perspective geometry.
Do not change logical board cells, canExit, hit-testing, damage, rotation rules, encounter logic,
or campaign content.

Variants are welcome: if useful, expose 2–3 live palette/effect variants using the same geometry.

## Verify live

Check at minimum:
- normal idle arrows;
- inactive/blocked arrows;
- hover;
- hint/tutorial-style emphasis;
- firing;
- rotate;
- arrows near different parts of the perspective board;
- Stage 1 and Stage 5.

The arrowhead must stay visually aligned and the shaft cap must not show through it.

Run tests/typecheck/build after visual acceptance.

## Delivery

Short RESULT / VERIFY / FOUND.
Include:
- preview URL;
- chosen default palette/style;
- any live variant switch;
- exact local WIP/commit salvaged from the previous Claude session.

Do not merge.
