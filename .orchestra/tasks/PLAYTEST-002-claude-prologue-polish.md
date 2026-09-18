# TASK: PLAYTEST-002 — Claude Prologue Polish

STATUS: DONE
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

## RESULT

Reproduced the reported problems in a real Chrome-driven browser session (via `visualDebug`/`calibrationEditorDebug` hooks and `visualDebug.layout()` for exact pixel measurement) before touching code, then fixed each:

1. **Arrows unreadable / "snake" effect.** `board-renderer.js`'s `drawArrow` drew a blocked-but-aiming arrow with `ctx.setLineDash([...])` and round caps at a dash length close to the line width -- at that ratio a dashed round-capped stroke visually degenerates into a chain of beads ("caterpillar"), exactly what was reported. Removed dashing entirely (free/blocked/pinned are now conveyed by color + opacity + glow only, never dash) and added a dark outline pass under every arrow body/head/pin-marker so any arrow color reads against both bright and dark stone. Also fixed a color-priority bug where a blocked arrow that happened to aim at a live target got the brightest "aim" color (misleadingly making a blocked, weaker-should-be arrow the most eye-catching one on the board) -- aiming color now only wins the *hue*, opacity/glow still correctly reflect free-vs-blocked. Brightened `arrow`/darkened-for-contrast `arrowDim` palette entries (the old ones were close to the stone's own tone under both light/dark themes, i.e. close to invisible).
2. **Boss ("Goblin Shaman") clipped by the fixed top bar -- "floating boots".** On `prologue-5x5-good` (the one calibrated arena, used by Prologue step 1), the boss podium anchor (`anchors.top.y = 0.155`) and `actorScale.top = 1.0` were never checked with a real boss loaded (BOSS_CHAR is 6.9 cells, ~60% of stage height) -- only ~half the sprite was ever below the header. Re-tuned `anchors.top.y` (0.155 -> 0.43), `effectAnchors.top.y` (0.155 -> 0.37) and `actorScale.top` (1.0 -> 0.55); verified via `visualDebug.layout()` that the full sprite (and its HUD plate) clears the topbar with margin at both 1920x1080 and 1366x768, and doesn't reach into the board.
3. **Same clipping bug, independently, on the default/flexible arena.** Steps 2-5 of the canon Prologue sequence carry no `presentation` block and render on the old default "Moonlit Fortress" background (see FOUND below) -- and there, a boss-mode target on E (cp-e2/cp-e3/cp-e5) clipped the stage's right edge and top, and an ordinary enemy on N (cp-e4's second, simultaneous mob) pushed its own HUD name/HP plate off the top of the screen entirely (a real playability problem for cp-e4, whose whole point is choosing between two visible mobs). Added a default-arena-only per-side scale table (`DEFAULT_BOSS_SIDE_SCALE`, `DEFAULT_ENEMY_SIDE_SCALE` in `board-renderer.js`) that only kicks in when no calibration is active, verified the same way at both resolutions.
4. **Dire Wolf "floating above its own shadow".** Confirmed by scanning the actual PNGs pixel-by-pixel (canvas `getImageData`, lowest non-transparent row) -- every Dire Wolf pose has 5-24% transparent padding below the visible paws (idle 10.7%, attack-ready 12.3%, lunge/"attack" 8.0%, hit 5.1%, defeat 24.3%), which is exactly the floating gap: `anchorY: 1.0` plants the image's *bounding box* bottom at the ground point, not the visible art's bottom. Set `ENEMY_ANCHOR.offsets` (per pose, measured) to shift the drawn image down by that exact amount. Did the same for the Goblin Shaman boss pack (smaller but real padding, 2-6%). `BOSS_ANCHOR` is shared across species (goblin-shaman/goblin-taunter) per its own existing contract, so the shaman values are exact and taunter (not reachable in the canon Prologue) is an approximation -- see FOUND.
5. **Sprite pivot now calibratable, per the task's explicit ask.** Added `spritePivot` (`{top,left,right}: {dx,dy}`) to the calibration model (`arena-calibration.js`, `.d.ts`, `getArenaCalibration` merge/override logic) as an *additional*, arena-specific correction layered on top of the asset-level fix in #4 -- `board-renderer.js`'s `drawBossArt`/`drawWolfArt` add the two together. Exposed as 6 range+number inputs ("Sprite pivot / foot offset") in the calibration editor, included in Save to browser / Copy / Download JSON, defaulting to `{dx:0,dy:0}` (no arena currently needs more than the asset-level fix).
6. Updated the 5 existing tests that hardcoded the old (buggy) numbers (`prologue-5x5-good`'s old anchor/scale values, `BOSS_ANCHOR`/`ENEMY_ANCHOR` all-zero offsets) to assert the new values / the new shape-only contract; added no new test files (the fixes are presentation-layer geometry, already covered by the existing VIS-005/VIS-006/CAL-002/BUILD-024 suites' structure).

Did **not** touch: puzzle/combat rules, encounter content, the "several disconnected experiments" root cause (see FOUND #1 -- that's a content decision, not a bug), goblin-taunter's own pivot values (not reachable in canon play).

## VERIFY

- `npm run typecheck`, `npm test` (274/274), `npm run build` all green after every change, not just at the end.
- All numeric fixes verified against real rendered pixel geometry via `window.visualDebug.layout()` / `window.calibrationEditorDebug`, at both 1920x1080 and 1366x768 (the two sizes the task called out), not eyeballed alone: boss/enemy char-rect and HUD-plate rects checked against the topbar's actual `getBoundingClientRect()` and the board's own rect, at every side (N/E/W) that a boss or enemy actually stands on in the canon Prologue.
- Full 5-step canon Prologue played end-to-end in the browser using the engine's own `findWin` (same solver the in-game "hint" button uses) to drive `visualDebug.tap`/`rotate`, through all 5 steps without a single engine/render error, ending on the real "Пролог пройден!" (Prologue Complete) overlay with the correct HP/Rotate-reward text.
- Death -> "Поражение" overlay -> "Повторить этап" (retry) round-trip checked directly (forced HP to 0 on step 2, confirmed the overlay and that retry resets HP and re-enters the same step).
- Calibration editor round-trip checked literally, not assumed: opened the editor, changed `actorScale.top` and a sprite-pivot slider, clicked "Save to browser", navigated to the game in the *same* browser session, confirmed the scene title shows "[custom calibration applied]" and `visualDebug.layout()` reflects the exact overridden numbers; then "Clear browser override" and confirmed it reverts to the code default. New sprite-pivot sliders update `draft`/the live preview immediately (checked via `calibrationEditorDebug.draft()`).
- Did not just trust green tests: the whole point of this task per the brief was that green tests had already coexisted with a broken experience, so every fix above was reproduced visually/numerically first, fixed, then re-verified the same way.

## FOUND

1. **The canon Prologue is visually two different arenas glued together, not a content-authoring bug I can just patch.** Only `prologue-5x5.json` (step 1) carries a `presentation`/`calibration` block; `cp-e2.json`/`cp-e3.json`/`cp-e4.json`/`cp-e5.json` (steps 2-5, 80% of the sequence, including the boss finale) carry none and always render on the old default "Moonlit Fortress" background with un-calibrated default anchors -- confirmed this is the *existing, tested, intentional* behavior (`test/build-025-prologue-flow.test.ts`'s "resolves calibrated arena for prologue-5x5 and null for uncalibrated encounters" already asserts `pres2`/`pres5` are `null`), not an oversight I introduced or should silently "fix" by force-fitting the one calibrated 5x5 baked-grid background onto boards of different sizes (cp-e2 is 4x5, cp-e3/cp-e4 are 6x7, cp-e5 is 8x10 -- none match the 5x5 grid actually painted into that art, so forcing it on would misalign the puzzle geometry against the baked tile lines). This is almost certainly the single biggest reason the build "feels like several disconnected experiments" (point 6 of the task brief). Needs either more calibrated baked-grid arenas per board size, or a deliberate decision to keep the default arena for variable-size boards and instead make *that* background feel intentional rather than like a leftover. I fixed the concrete clipping/HUD bugs on both arenas (RESULT #2/#3) but left the underlying two-backgrounds decision to the user/architect.
2. `BOSS_ANCHOR`'s sprite-pivot correction (RESULT #4) is shared across every boss species by the module's own pre-existing "no species/asset knowledge" contract; goblin-taunter's own padding differs from goblin-shaman's per-pose (checked), so its values are an approximation. Not a live bug today (goblin-taunter/King is reserved Act I content, unreachable from the canon Prologue), but should be split per-species before it ships.
3. The calibration editor's TOP preview always stands in a Dire-Wolf-sized (`SIDE_CHAR`) sprite, even for an arena whose real scenes put a full `BOSS_CHAR`-sized boss there. This is exactly how the topbar-clipping bug (RESULT #2) escaped the original CAL-001/CAL-002 calibration passes undetected. Recommend the editor's TOP preview use the boss footprint size (or both, toggleable) so this class of bug can't hide again.
4. At embedded-pane widths below ~600px the topbar wraps to 2-3 lines (flex-wrap) and can re-clip a boss that's tuned for a normal single-line topbar height. Not fixed -- not a realistic desktop playtest target (verified fine at the requested 1920x1080 and 1366x768), but worth knowing if a narrower window is ever used to test.
5. Did not verify the Stone Pin (EXP-013) rock-throw visual or the boss's CAST-interrupt beat by eye in this pass (both are exercised by existing passing unit tests and were not reported as broken) -- only the win/lose/retry/advance/complete flow and the presentation bugs actually reported were driven by hand in the browser.

## USER PLAYTEST

1. From the repo root: `cd spikes/arrow-core && npm install && npm run build && npm run viewer` (prints the exact URLs; default port 5177 unless taken).
2. Open the printed **"Playable Prologue"** URL (`http://localhost:<port>/viewer/visual-proto/`). This is the whole 5-step canon Prologue, scene picker at top-left defaults to step 1.
3. To calibrate: click **"CAL-001 calibration editor →"** in the top bar (or open `.../calibration-editor.html` directly). Pick an arena (only `prologue-5x5-good` matters for the canon Prologue today -- see FOUND #1 for why steps 2-5 don't use it).
   - Drag the cyan handles to move the 4 board corners, amber handles to move actor foot anchors, violet handles for effect/VFX anchors (or click a handle then use arrow keys, Shift+arrow = 10px).
   - **Actor scale** sliders (TOP/LEFT/RIGHT) resize that side's character independent of the grid.
   - **Sprite pivot / foot offset** sliders (new in this task) nudge a side's sprite image down/right relative to its own ground shadow, for a sprite whose art doesn't fill the bottom of its source PNG (this is now pre-corrected at the asset level for Dire Wolf/Goblin Shaman -- only touch this if a *specific arena* still looks a bit off after that).
   - Click **"Save to browser"** -- this is the only step that makes the game actually use your changes.
4. Click **"← Playable game"** (or just navigate back to the game URL) and reload -- the scene title now shows "**[custom calibration applied]**" whenever your saved override is live. If it doesn't look right, go back to the editor, adjust, Save again -- or click **"Clear browser override"** in the editor to revert to the built-in calibration.
5. Play the Prologue with mouse clicks on the arrows, **Q/E** or the on-screen buttons to Rotate, **R** to restart the current step, **H** for a hint, **D** to toggle the debug panel (shows the projected grid mesh, boss/wolf pose buttons, and the validator report). The overlay after each step offers "Следующий этап →"; after step 5 (Goblin Shaman) it shows "Пролог пройден!" with your final HP and Rotate reward.

RESULT_SHA (code): 4ce02bb
