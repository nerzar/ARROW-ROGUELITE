# TASK: TOOL-002 — Creature Presentation Defaults

STATUS: DONE
TYPE: TOOL / RUNTIME INTEGRATION
SIZE: M
AGENT: Claude / frontend + visual tooling
BASE_BRANCH: build/BUILD-031-editor-authoring-polish
BRANCH: tool/TOOL-002-creature-presentation-defaults
START_SHA: 92534550a17b8d344cdc0e458e467de8234bfbfd
RESULT_SHA: 627e093

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

## RESULT

Salvaged `.worktrees/TOOL-001`'s uncommitted follow-up polish (gallery grid, pose-slot strip,
"Current values" panel, saved Goblin Shaman pose assignment) as its own commit on
`tool/TOOL-001-creature-pose-editor`, pushed to origin.

Merged that branch onto BUILD-031 (`92534550`). One real conflict (`small-spider/idle.png`, two
different images — kept BUILD-031's), plus a non-conflicting-but-duplicate situation
`git merge` didn't flag: both branches had independently re-added the same 3 ASSET-003 species
(small-spider/toxic-demonic-spider/small-green-slime) to `asset-catalog.js`/`assets.js` with
different data (duplicate `CREATURE_CATALOG` entries; `const`/`export const` redeclared, a
SyntaxError). Kept BUILD-031's versions throughout (matching the task's compatibility
requirement); dropped TOOL-001's duplicate copies; kept TOOL-001's actual new code
(`applyPoseOverrides`, wired into `app.js`/`calibration-editor.js`).

Added `species-presentation.js`: a runtime map `species -> {pivot, scale}`, populated by
`assets.js`'s `applyPoseOverrides()` from `creature-poses.json`. Two accessors:
`speciesPivotDelta(species)` (ground-point delta vs. the Pose Editor's own no-op default pivot)
and `speciesScale(species)` (drawn-image multiplier, default 1). `board-renderer.js`'s
`drawBossArt`/`drawWolfArt` now take these as a new middle layer.

**Precedence (outermost wins, addition is order-independent so this is really "all three add
up, calibration is what the user tunes last"):**

```
ground point = ANCHOR.offsets[pose]   (enemy-visual-state.js/boss-visual-state.js, per-pose,
                                        shared across all species of that kind)
             + speciesPivotDelta(species)   (NEW — this task; 0 if unconfigured)
             + scene spritePivot            (arena-calibration.js, per-scene TOP/LEFT/RIGHT;
                                              unchanged, still the last thing the user drags)

drawn size = fit(image, footprint) * speciesScale(species)   (NEW — this task; 1 if unconfigured)
  where footprint = arenaBaseCell * actorScaleOverride[side] * defaultArenaSideScale
                     (unchanged — scene/per-side actorScale is a fully separate axis, still
                     0.1..2.0, still what the TOP/LEFT/RIGHT scale sliders control)
```

A species with nothing saved in the Pose Editor contributes `{dx:0,dy:0}`/`1` — bit-for-bit the
pre-TOOL-002 render path.

## VERIFY

- `npm run build`, `npm run typecheck`, `npm test`: 299/299 pass (291 pre-existing + 8 new in
  `test/tool-002-species-presentation.test.ts`, covering the no-op/default/merge/malformed-input
  contract of the new module).
- Browser (own worktree preview, port 5211, not the shared checkout's server):
  1. Saved a test pivot/scale for Dire Wolf via the save API.
  2. Reloaded Pose Editor — values persisted ("Loaded saved poses", correct pivot/scale shown).
  3. Campaign Editor preview — Dire Wolf visibly bigger and repositioned.
  4. Play Level (real runtime) — same bigger/repositioned Dire Wolf.
  5. Scene's own TOP actor-scale slider still visibly resized it further on top (composition
     confirmed, not overridden).
  6. Small Goblin (no saved defaults) on the same level rendered unaffected.
  7. Removed the Dire Wolf test values afterward — picking real per-species defaults is a visual
     call for the user via the Pose Editor, not something to hardcode from a verification pass.
  8. Goblin Shaman (the one species that already had a real saved pivot/scale from the TOOL-001
     session, previously inert) now renders using it in the actual Prologue boss stage
     (`index.html?mode=authored&stage=4` -> Play Level) — a small, correctly-anchored robed
     figure on the archway podium, not broken/invisible/oversized.

## FOUND

- Goblin Shaman's saved `scale: 0.4` / pivot (from the original TOOL-001 session) was **inert
  before this task** and is now **live** — this is the intended effect of the task, but it does
  change the already-accepted BUILD-031/Prologue boss's rendered size/position for the first
  time. Looked correct in a manual check (see VERIFY #8) but this is a visual call — please look
  at it in your own Prologue playtest, not just take my read of one screenshot.
- The Pose Editor's save endpoint (`serve.mjs`, pre-existing TOOL-001 code, untouched here)
  writes every species' copied pose frames to `assets/enemies/<species>/`, including bosses —
  so Goblin Shaman's frames live under `assets/enemies/goblin-shaman/`, not
  `assets/bosses/goblin-shaman/` where `SHAMAN_PACK_BASE` points. Harmless today because
  `applyPoseOverrides()` merges full paths (not filenames) into `BOSS_MANIFESTS`, so it still
  resolves correctly — but it does mean boss art now lives in two different folder conventions.
  Not fixed here (out of this task's scope); worth a follow-up if it gets confusing.
- Small-spider ships 4 usable source-folder frames (idle/attackReady/attack/hit) per the old
  ASSET-003 commit's own analysis, but BUILD-031's re-implementation only wired `idle`. Kept
  BUILD-031's version untouched per the "preserve BUILD-031" instruction; the other 3 frames are
  still on disk (`assets/enemies/small-spider/`) if someone wants to wire them up later.
- `.claude/launch.json` gained a `tool-002-creature-presentation-defaults` entry (port 5211,
  pointing at this worktree) so this branch has its own dev-server preview.

## USER PLAYTEST

User played Prologue Stage 5 live and found a real bug from the FOUND note above: the Goblin
Shaman's defeat pose was essentially never seen — reported as "death animation doesn't play".

Root cause (`board-renderer.js`'s `drawTarget`): the shared per-target death fade
(`globalAlpha 1 - deathP`) is correct for an ordinary enemy (slot should empty), but a boss's
`dead` flag (`s.won`) stays true for the rest of the encounter, so 550ms after the winning tap
the boss sat at `alpha 0` — fully invisible — for the ~150ms before the win overlay
(`scheduleWin`'s 700ms delay) covered the screen anyway. Confirmed via `window.visualDebug`
(pose state correctly reached `defeat`, `defeat.png` loaded 200 OK) before finding the alpha
math.

Fixed: a boss never fades (`deathP` forced to 0 for `t.isBoss`); it stays fully opaque, defeat
pose + the existing settle/squash transform only. Ordinary-enemy death fade unchanged. User
confirmed direction (not left as "already fine") before the fix. Build/typecheck/tests
(299/299) still pass. Pushed as a separate commit (`05c06a4`) on top of the DONE result.

User also live-tuned Goblin Shaman's species scale (0.4 -> 0.6) and Prologue Stage 5's own
actorScale/spritePivot to match, through the Pose Editor + Campaign Editor while playtesting —
committed as project content (`9739ce6`), confirming the species-default -> scene-calibration
precedence works end-to-end for a real user, not just my own test values.

Still needs: user's own look at the fixed defeat behavior (branch pushed, dev server on 5211
already serves the new code — just reload).
