# HANDOFF — TOOL-002 Creature Presentation Defaults

## Previous work

TOOL-001 is complete remotely:
- branch: `tool/TOOL-001-creature-pose-editor`
- code RESULT_SHA: `c9c8d0a46a8875e2a65650d2a49711c732965efe`
- report HEAD: `1e680ddc87b4f256b3849350dc83e07b4e745767`

It added:
- `pose-editor.html/css/js`;
- source-frame gallery from `magicarrowassets/creatures/<species>`;
- pose assignment;
- preview;
- pivot/scale controls;
- project-local `creature-poses.json`;
- runtime pose override loading.

BUILD-031 is accepted by the user and is now the base for new work:
- branch: `build/BUILD-031-editor-authoring-polish`
- HEAD: `92534550a17b8d344cdc0e458e467de8234bfbfd`

BUILD-031 independently contains the full 10-creature catalog, arena defaults, lower actor scale,
and imported-arena persistence. Preserve it.

## Critical local-state warning

The previous Claude continued TOOL-001 locally after its DONE commit and hit the session limit.

Before editing:
1. inspect `.worktrees/TOOL-001`;
2. run `git status`, `git diff`, `git stash list`;
3. preserve/salvage local uncommitted refinements before creating or switching worktrees.

Known local follow-up edits from that session:
- fixed Pose Editor gallery CSS to a clean equal-column grid;
- added a "current values" information panel;
- wired live refresh of that values table;
- possibly additional partial edits immediately before the session limit.

Do not lose these.

## Key architectural finding

TOOL-001 currently saves `pivot` and `scale` into `creature-poses.json`, but runtime does not
use them. They are inert metadata outside Pose Editor.

Existing runtime presentation:
- `ENEMY_ANCHOR.offsets` is one shared table for ordinary enemies, originally measured around
  Dire Wolf;
- `BOSS_ANCHOR.offsets` is one shared table for bosses, originally measured around Goblin Shaman;
- comments already acknowledge Goblin Taunter differs and per-species split is future debt;
- Campaign Editor has per-scene/per-side TOP/LEFT/RIGHT anchor/scale/pivot calibration.

## Chosen direction from the previous chat

Keep the solution simple:
- one default pivot per species (not a new per-pose pivot editor);
- one default scale per species;
- KEEP the existing per-scene TOP/LEFT/RIGHT calibration system as-is.

Runtime composition should be conceptually:

`asset pose correction + species default presentation + arena/side calibration override`

The exact math/representation is implementation choice, but scene calibration must remain the
final author-controlled adjustment.

Do not turn Pose Editor into a huge rigging tool.

## Goal of continuation

Make Pose Editor's saved presentation values actually matter in the live Campaign Editor/playable
runtime, while keeping existing level/arena calibration intact and additive/overridable.

Also preserve the useful local UI refinements described above.
