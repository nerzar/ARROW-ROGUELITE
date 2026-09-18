# TASK: ASSET-002 — Generated Art Integration

STATUS: DONE
TYPE: BUILD
SIZE: M/L
AGENT: Claude / visual implementation
BASE_BRANCH: build/BUILD-026-campaign-authoring-tool
BRANCH: build/ASSET-002-generated-art-integration
START_SHA: 498cc25a88bed99b38e4bf138ea67f6cdb374f63

## Goal

Take the generated arenas and mobs from:

`C:\Users\nerza\Projects\magicarrowassets`

and make the useful ones actually usable in the current Campaign Editor and playable runtime.

This is a visual implementation task, not a research/review task.

## What matters

- Keep the source folder untouched.
- Bring the usable art into a clean project-local asset structure.
- Extend the existing data-driven `asset-catalog.js` rather than hardcoding filenames into UI code.
- Make arenas and mobs appear in the Campaign Editor selectors and preview correctly.
- For mobs, wire only states that can be inferred from the real files/filenames/structure. Do not invent animation semantics.
- Tune practical per-asset presentation defaults where needed: scale, sprite pivot / foot offset, framing/crop, shadow alignment, etc.
- Use the existing calibration/editor tools in the browser to make the imported art sit correctly in the scene.
- A mob should look grounded, not float above its shadow; an arena should be usable without obvious clipping or broken framing.
- Existing built-in assets must keep working as fallback.

You may make small renderer/catalog/editor changes needed to support the real art cleanly, but do not redesign the gameplay, arrows, or campaign model.

Do not try to calibrate every possible arena × level combination. The goal is a good reusable asset pipeline plus sensible defaults that the authoring tool can tune per level.

## Verify

In the browser prove at least:

- several imported arenas are selectable and render correctly;
- several imported mobs are selectable and render correctly;
- changing mob species updates the live preview;
- scale/pivot defaults are sane and editable;
- no broken absolute paths are stored in project data;
- existing campaign authoring still works.

Run normal typecheck/tests/build for touched code.

## Delivery

Short `RESULT / VERIFY / FOUND` plus a tiny `USER PLAYTEST` telling the user where to open the editor and what new assets to try.

Commit, push, verify remote SHA, mark DONE.

> Executed in an isolated worktree (`.worktrees/ASSET-002`, branch as above) per user instruction,
> after a first attempt's uncommitted code edits were lost to a concurrent `git checkout`/reset by
> another session sharing the main checkout. The copied asset PNG files themselves survived that
> incident (they were untracked and present in this worktree already); only the code wiring in
> `assets.js`/`board-renderer.js`/`app.js`/`calibration-editor.js`/`arena-calibration.js`/
> `asset-catalog.js` had to be redone here from scratch.

## RESULT

### 1. Asset intake (source untouched)

Inspected `C:\Users\nerza\Projects\magicarrowassets` (65 arena PNGs, 10 creature folders). Picked a
curated, quality-checked subset rather than importing everything wholesale (per the task's "do not
calibrate every combination" guidance):

**Arenas** (all real baked-tile-grid stone-dais art, verified by eye before copying) →
`spikes/arrow-core/viewer/visual-proto/assets/arenas/prologue-act1/`:
- `grimskull-5x5.png` (from `5x5-goblin-apprroved-2.png`, painted 5x5 grid)
- `ironvow-6x6.png` (from `6x6-7.png`, painted 6x6 grid)
- `autumnfall-8x7.png` (from `8x7.png`, painted 8x7 grid)
- `demonforge-10x8.png` (from `10x8.png`, painted 10x8 grid)

**Creatures** → `spikes/arrow-core/viewer/visual-proto/assets/enemies/<species>/`:
- `green-slime`, `small-goblin`: full clean named pose sets (idle/angry/taunt/cast/stun(-hit)/
  death/back) copied in full for future use, even though only idle/hit/defeat are wired into the
  runtime pipeline today (see below).
- `spider-brute`, `skeleton-child`: only ONE usable clean frame existed in each source folder (the
  rest of each folder is either an ungrouped raw batch with no pose semantics, or — in both
  folders' first file — a labeled multi-pose *reference/concept sheet* with visible text and
  branding baked into the image, not an individually usable sprite). Copied that one frame as
  `idle.png`; did not crop the reference sheets into synthetic sprites (would be new art
  production, out of scope).
- Left the existing `dire-wolf` and `goblin-king`(→`goblin-taunter`) assets untouched — both are
  already-integrated, already-working packs from an earlier pass; `magicarrowassets`' own
  `dire_wolf` folder now only contains a newer *raw, unorganized* batch that is not an improvement
  over the current working set, so it was not re-imported.

### 2. Data-driven catalog (`asset-catalog.js`)

Added the 4 new arenas to `ARENA_CATALOG` with a `calibrationId` pointing at a new dedicated
`arena-calibration.js` entry each (see below). `CREATURE_CATALOG` already listed all 4 new species
(added by BUILD-026 in anticipation) — they simply had no backing files/manifests until now.

### 3. Per-species ordinary-enemy rendering (`assets.js`, `board-renderer.js`)

Found and fixed a real gap: the enemies-array render pipeline (`board-renderer.js`) only ever used
ONE globally-loaded pack (Dire Wolf) for every non-boss target, regardless of each enemy's own
`species` field — so picking any other creature in the authoring tool's "Creature" dropdown had
**zero visual effect** before this change.

- `assets.js`: added `ENEMY_MANIFESTS` (species -> pose manifest) for green-slime/small-goblin/
  spider-brute/skeleton-child, mapping only literal filename matches into `ENEMY_POSES`' `idle`/
  `hit`/`defeat` slots (`hit` <- stun/stun-hit, `defeat` <- death — both direct semantic matches,
  not inventions). `attackReady`/`attack` have no matching source file for these species and are
  deliberately left unmapped; the existing pose->idle graceful-degradation (already used by every
  other pack for any missing pose) covers it honestly instead of guessing.
  - Also added `goblin-shaman`/`goblin-taunter` to the same map (reusing their existing BOSS pose
    manifests): CREATURE_CATALOG lists them as selectable "Boss" creatures, but the campaign editor
    always authors `def.enemies` (array shape), so a boss species placed in an enemy slot goes
    through this same ordinary-enemy pipeline — without this it silently fell back to the Dire Wolf
    sprite despite the "(Boss)" label. Confirmed fixed in the browser (see VERIFY).
- `board-renderer.js`: `collectTargets` now reads `species` off the matching raw `def.enemies` entry
  (not part of the engine's own stripped-down `EncounterState.enemies` accessor) and attaches it to
  each render target; `drawTarget` picks `view.wolf.packsBySpecies[t.species]` before falling back
  to the single shared `view.wolf.pack` (Dire Wolf) for any enemy with no/unknown species — so every
  existing encounter with no `species` field renders exactly as before.
- `app.js` and `calibration-editor.js`: both preload one pack per catalog species up front
  (mirroring the existing `bossPacks` preload pattern) and pass `packsBySpecies` through the render
  loop's `wolf` view object.

### 4. Per-arena calibration (`arena-calibration.js`)

Added 4 new `ARENA_CALIBRATIONS` entries (`grimskull-5x5`, `ironvow-6x6`, `autumnfall-8x7`,
`demonforge-10x8`), each with its own `boardPlaneFrac`/`anchors`/`effectAnchors`/`actorScale`/
`spritePivot` — started from `prologue-5x5-good`/`boss-shadow-moon`'s already-proven quad shape
(same composition: dais board, camera slightly above) and adjusted by eye against each image's own
painted grid, then checked live in the browser. Verified all 4 resolve correctly via
`getArenaCalibration()`.

## VERIFY

Browser (isolated worktree's own dev server, port 5205):

- ✅ all 4 new arenas appear in the campaign editor's arena dropdown and render as the stage
  background with no broken image / clipping (Grimskull Throne, Ironvow Bastion, Autumnfall Ruins,
  Demonforge Gate all screenshotted);
- ✅ all 4 new creatures (Green Slime, Small Goblin, Spider Brute, Skeleton Child) selectable in the
  "Creature" dropdown and each shows its own real sprite standing on the board the moment it's
  selected — changing the dropdown live-updates the preview immediately, no reload needed;
- ✅ found + fixed: Goblin Shaman/Goblin Taunter ("Boss" creatures) previously still showed the Dire
  Wolf sprite when picked in an enemy slot — now shows their real portrait;
- ✅ existing built-in Dire Wolf still renders correctly (regression check, fresh page load);
- ✅ Save writes the real file (`campaigns/campaign.json`) — UI shows "✓ Saved to
  campaigns/campaign.json & storage"; verified on disk the level's `enemies[0].species` and
  `presentation.background` recorded correctly, and grepped the whole file for any `C:\` / absolute
  path — none found;
- ✅ reload-from-file round-trip: reloaded the page cold, editor correctly showed "Loaded from file"
  with the previously-saved Green Slime + Ironvow Bastion state restored;
- ✅ "Play Level" opens the real playable game with the authored level, correct arena + creature
  rendered;
- ✅ existing canon Prologue (all 5 stages) still plays through end-to-end and wins via a full
  engine-driven `findWin()` run, no console errors beyond the same pre-existing placeholder-asset
  404s that predate this task;
- ✅ `npm run typecheck` / `npm test` (23 files, 281 tests) / `npm run build` all clean in the
  worktree.

## FOUND

- **Arena dropdown doesn't re-sync calibration geometry on swap.** Selecting a new arena in the
  authoring tool only patches `presentation.background`/`.arena` on whatever calibration object the
  level already has — it does NOT re-resolve `arenaInfo.calibrationId` for an *already-calibrated*
  level (that id-lookup path only fires once, the first time a level's `presentation.calibration` is
  still `null`). Practically: picking e.g. Ironvow Bastion for a level that started as
  `prologue-5x5-good` keeps using `prologue-5x5-good`'s board-plane quad/anchors on the new
  background, not `ironvow-6x6`'s own entry — visually close-enough by luck (same composition
  family) but not actually using the new arena's calibration. My 4 new calibration entries ARE
  correctly used by a level created fresh with that arena from the start (verified via
  `getArenaCalibration()`); the gap is specifically in the *already-calibrated level, swap arena
  afterward* path. This is `campaign-model.js`/`calibration-editor.js`'s level-resolution logic, not
  an asset problem — left unfixed as it borders on the campaign-model redesign this task is scoped
  away from; flagging for a follow-up (e.g. an explicit "match calibration to arena" button, or
  re-resolving on every arena change).
- **`spider-brute`/`skeleton-child` are idle-only.** Their source folders have no organized pose set
  to draw `hit`/`defeat` from without inventing semantics (see RESULT #1) — every pose besides idle
  falls back to idle for these two. Not a bug, just a content ceiling until better-organized source
  art exists for them.
- Per CAL-004's own earlier FOUND: none of the 4 new arenas' painted grid size exactly matches every
  square board size (autumnfall-8x7/demonforge-10x8 in particular) — same pre-existing caveat, not
  new to this task.

## USER PLAYTEST

1. Open the campaign editor: `npm run viewer` from `spikes/arrow-core` (or via the existing
   `.claude/launch.json` dev-server config), then
   `http://localhost:<port>/viewer/visual-proto/calibration-editor.html`.
2. On the current level, try the **arena** dropdown — pick "Grimskull Throne", "Ironvow Bastion",
   "Autumnfall Ruins" or "Demonforge Gate" and watch the background swap live.
3. In the **Creature** dropdown for Enemy 1, try "Green Slime (Enemy)", "Small Goblin (Enemy)",
   "Spider Brute (Enemy)" and "Skeleton Child (Enemy)" — each should show its own real sprite
   standing on the board immediately.
4. Also try "Goblin Shaman (Boss)" / "Goblin Taunter / King (Boss)" in that same slot — now shows
   the real boss portrait instead of a wolf.
5. Click **Save** — should show "✓ Saved to campaigns/campaign.json & storage". Reload the page to
   confirm it comes back exactly as saved.
6. Click **Play Level** to see the authored creature/arena in the real playable game.
