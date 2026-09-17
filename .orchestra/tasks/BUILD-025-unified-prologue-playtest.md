# TASK: BUILD-025 — Unified Prologue Playtest

STATUS: DONE
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

---

## RESULT

Implemented full Unified Prologue Playtest integration. All 5 Prologue encounters are wired as a linear sequence accessible from a single normal entry point with no console helpers required.

### Changes made

**`spikes/arrow-core/viewer/visual-proto/app.js`**
- `SEQUENCE_STEPS` = 5-step Prologue (prologue-5x5 → cp-e2 → cp-e3 → cp-e4 → cp-e5); all start with 0 Rotate charges
- `STANDALONE_SCENES` = act1-e1, act1-e2, act1-e3 (start with 2 Rotate), cp-e1 debug, rock-spike debug
- `showOverlay('won')` handles 3 cases: last Prologue step → "Пролог пройден!" + "+2 ROTATE"; mid-sequence → "Следующий этап →"; standalone → "Победа!"
- `showOverlay('dead')` adds secondary "Начать пролог сначала" button calling `run.restartRun()`
- `hideOverlay` hides restartAll button on close
- Scene dropdown grouped: Prologue steps, separator, Standalone/Debug scenes
- `window.visualDebug` extended: `.advance()`, `.restartRun()`, `.restartStep()`
- `sceneTitle` shows `[custom calibration applied]` badge when localStorage override is active
- Import of `hasArenaCalibrationOverride` added

**`spikes/arrow-core/viewer/visual-proto/arena-calibration.js`**
- `getArenaCalibration()` merges localStorage overrides (key: `arena_calibration_override_<id>`)
- New exports: `saveArenaCalibrationOverride(id, cal)`, `clearArenaCalibrationOverride(id)`, `hasArenaCalibrationOverride(id)`

**`spikes/arrow-core/viewer/visual-proto/arena-calibration.d.ts`**
- Added type declarations for 3 new override functions

**`spikes/arrow-core/viewer/visual-proto/calibration-editor.html`**
- Added "Save to browser" (`#saveStorageBtn`) and "Clear browser override" (`#clearStorageBtn`) buttons
- Added "← Playable game" link back to `index.html`

**`spikes/arrow-core/viewer/visual-proto/calibration-editor.js`**
- Imports and wires save/clear localStorage override buttons

**`spikes/arrow-core/viewer/visual-proto/index.html`**
- Title: "Arrow-Roguelite · Prologue Playtest"; Brand: "Prologue Playtest"
- Overlay buttons container with `overlayNext` + `overlayRestartAll` (hidden by default)

**`spikes/arrow-core/viewer/visual-proto/style.css`**
- `.overlay-buttons`, `.overlay-buttons button`, `.overlay button.secondary-btn` styles

**`spikes/arrow-core/tools/serve.mjs`**
- Root and `/viewer/` both redirect to `/viewer/visual-proto/` (main playtest entry)

**`spikes/arrow-core/viewer/index.html`**
- "▶ Playable Prologue (Visual Shell)" link added at top of hub page

**`spikes/arrow-core/test/build-025-prologue-flow.test.ts`** (NEW)
- 13 focused integration tests: encounter specs & canon validation (5), end-to-end RunState playthrough (1), restarts & state isolation (2), Stone Pin and Blocked Tap rules (3), calibration resolution + localStorage override (2)

### 5-step Prologue design

| Step | Scene | Board | Enemies | Key mechanic | HP/Rotate |
|------|-------|-------|---------|-------------|-----------|
| 1 | prologue-5x5 | 5×5 calibrated | 1 HP N (normal) | Basic arrow-path solve | starts 10 HP, 0 Rotate |
| 2 | cp-e2 | 4×5 tiny | 2 HP E (normal) | Blocked tap costs HP | carries HP, 0 Rotate |
| 3 | cp-e3 | 6×7 easy | 3 HP E (timer 4 dmg 2) | Time has a cost | carries HP, 0 Rotate |
| 4 | cp-e4 | 6×7 easy | 2 simultaneous (E IN 3 + N IN 5) | Priority decision | carries HP, 0 Rotate |
| 5 | cp-e5 | 8×10 medium | Goblin Shaman boss (Phase1 E 4HP → Phase2 N 5HP CAST IN 3) | CAST interrupt; +1 Rotate grant; +2 Rotate on win | carries HP, 0→1 Rotate |

### USER PLAYTEST — launch steps

1. In worktree `C:\Users\nerza\Projects\ARROW-ROGUELITE\.worktrees\BUILD-025\spikes\arrow-core` run:
   ```
   node tools/serve.mjs
   ```
2. Open `http://localhost:3000` → auto-redirects to Prologue Playtest page.
3. (Optional) To tune calibration first: open `http://localhost:3000/viewer/visual-proto/calibration-editor.html`, adjust, click **"Save to browser"**, return via "← Playable game" link, reload. Badge `[custom calibration applied]` confirms override is active.
4. Play Prologue steps 1–5 using only the UI (tap arrows, win/retry overlays).
5. After Step 5 boss: "Пролог пройден!" overlay shows +2 ROTATE reward.
6. Report back with what to change next.

**What to manually check / tune:**
- Board corners and actor anchors on Step 1 (prologue-5x5) via calibration editor if the layout looks off at your display.
- Arrow overlap on the tiny 4×5 board (Step 2) — arrows may look cramped.
- Timer countdown text readability on Step 3.
- Two-enemy layout on Step 4 (grunt East + grunt North).
- Shaman boss Phase 2 CAST indicator visibility on Step 5.
- "Начать пролог сначала" secondary button after dying (resets to Step 1, full HP, 0 Rotate).

---

## VERIFY

- `npm run typecheck` → **0 errors** ✅
- `npm test` → **274 tests passed (22 test files, 0 failures)** ✅
- `npm run build` → **clean build, 0 errors** ✅
- Headless CDP browser verification → **9/9 checks passed** ✅
  1. Root redirect → `/viewer/visual-proto/`
  2. Initial state: title/brand correct, 5 steps, 10 HP, 0 Rotate
  3. Step 1 win: arrow-path solve works, overlay "Следующий этап →" shown
  4. Step 2 (cp-e2): blocked tap costs HP; restartStep restores 10 HP; puzzle solvable
  5. Step 3 (cp-e3): timed encounter solved
  6. Step 4 (cp-e4): 2 simultaneous enemies (grunt_e + grunt_n) solved
  7. Step 5 (cp-e5): Goblin Shaman Phase1→Phase2 CAST→interrupt→normal, "Пролог пройден!" + +2 ROTATE
  8. 1920×1080 and 1366×768 viewport layout sanity
  9. Calibration editor: "Save to browser" + "Clear browser override" buttons functional

All 13 new integration tests pass.
Canon rules preserved: Stone Pin (no turn/damage on pinned tap), CAST interrupt (switches to normal attack), concurrent timers, board-clear-alive win.

---

## FOUND

1. **Rotate pool is encounter-local in Phase 2, not RunState-visible until advance()**: `rotateCharges` in `RunState` shows 0 at Phase 2 entry (the `grantRotate: 1` in Phase 2 is encounter-local to `EncounterState`). Only on `run.advance()` does `winRotateReward: 2` flow into `RunState`. This is correct implemented behavior — documented here for future reference.

2. **cp-e2 blocked arrow is Arrow #3 (seed 300, 4×5 board)**: Index 3 arrow is blocked at scenario start. Tapping it with `blockedTapDamage: 1` correctly deducts 1 HP without advancing world turn or resetting timers. Verified in headless test.

3. **No discrepancy between code and docs found**: All COMBAT-RULES.md canon rules (CAST interrupt, Stone Pin, hit-does-not-reset-timer, board-clear-alive) were confirmed to be implemented correctly in `src/encounter.ts`. No silent divergence encountered.

4. **Calibration localStorage override is additive, not atomic**: `getArenaCalibration()` deep-merges the localStorage patch over the code default. If a user saves a partial override (e.g. only board corners), actor anchors still come from code. This is intentional and safe for the tuning workflow.

5. **Arrow visuals are temporary** (as noted in task): Arrow rendering was not changed; the existing temporary visuals are preserved per spec.
