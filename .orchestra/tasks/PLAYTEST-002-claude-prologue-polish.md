# TASK: PLAYTEST-002 — Claude Prologue Polish

STATUS: DONE
TYPE: FIX/INTEGRATION
SIZE: M/L
AGENT: Claude / primary fixer
BASE_BRANCH: build/BUILD-025-unified-prologue-playtest
BRANCH: fix/PLAYTEST-002-claude-prologue-polish
START_SHA: 548ddbeadcacfe05a096f472f27c574f0e3be0cc

## User goal

Take the current playable Prologue and make it actually usable for manual playtesting. The user can launch the game now, but the scene is not practically calibrated, some arrows are hard or impossible to see, and the current calibration workflow is not usable enough for the user to tune the scene and then play through the Prologue.

This is not a narrow patch. Treat the current branch as a working but rough integration and bring the whole Prologue playtest experience to a coherent, usable state.

## What matters most

- The user must be able to calibrate the current arena in the calibration editor and have those changes visibly affect the playable game without fighting the tooling.
- Arrow paths must be readable enough to play. Some are currently nearly invisible against the board/background; fix contrast/readability/presentation as needed.
- The playable Prologue flow must work end-to-end in the browser without console/debug-only rituals.
- Board geometry, actor placement/scale, effects, HUD and pointer hit-testing must stay aligned with the active calibration.
- Prefer practical working results over preserving awkward implementation details from earlier experiments.

## Existing pieces to inspect and reuse where useful

- CAL-001 calibration editor
- CAL-002 independent actor scale
- BUILD-024 runtime calibration integration
- BUILD-025 unified Prologue flow and browser/localStorage calibration override
- VIS-010 / VIS-011 arrow presentation work, as visual references only

Do not assume any of those are perfect. Inspect the current result in Chrome and fix what is actually wrong.

## Expected approach

Use browser playtesting heavily. Start from what the user sees now. Reproduce the bad calibration/readability issues, then improve the system until the user can:

1. open calibration editor;
2. move/resize the board and actors/effects;
3. save/apply calibration;
4. return to the game and see that exact calibration;
5. clearly see and interact with all arrows;
6. play the Prologue sequence normally.

You may change renderer/editor/CSS/runtime wiring as needed. Keep gameplay rules stable unless a clear integration bug prevents play.

## Delivery

Use an isolated worktree. Do not merge main.

When done, provide a short USER PLAYTEST section with exactly what to open and how to calibrate + start the Prologue.

Fill RESULT / VERIFY / FOUND honestly, commit, push, verify remote SHA, then mark DONE.

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
