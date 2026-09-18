# TASK: FIX-029 — Make Prologue Shaman Stage Actually Winnable

STATUS: DONE
TYPE: FIX
SIZE: M
AGENT: Gemini / gameplay logic
BASE_BRANCH: integration/BUILD-028-prologue-assets-authoring
BRANCH: fix/FIX-029-shaman-stage-winnable
START_SHA: a915678fbd226c0d42a16852386452525ce8a6f1

## Goal

Fix the current authored Prologue Stage 5 so a real player can actually complete it in the playable browser flow.

The user manually played the merged BUILD-028 result and reports that the final Goblin Shaman stage is not passable.

Treat this as a real gameplay bug even though earlier solver/browser automation reported success.

## Keep the intended lesson

Stage 5 should still teach/show:

- Goblin Shaman starts in the center/TOP slot;
- direction matters;
- boss changes side / phase in a readable way;
- CAST can be interrupted;
- Rotate is introduced/used meaningfully;
- winning the Prologue still awards the intended Rotate reward.

Square-board-only policy remains.

## Investigate the real mismatch

Do not assume the previous engine solver path represents what a player can actually do through the UI.

Find the exact reason the live stage is unwinnable or practically unwinnable.

Check, as applicable:
- actual free-arrow sequence in the rendered authored board;
- when Rotate charges are granted and when the UI allows use;
- phase transition side/direction;
- remaining arrow-direction budget after phase 1;
- CAST countdown and interrupt timing;
- boss HP;
- world-turn advancement rules;
- any mismatch between `findWin()` / internal state actions and real clickable UI actions;
- whether the previous automated path used an action that is unavailable or non-obvious to the player.

## Fix

Make the smallest content/runtime fix that restores a clear real-player winning path.

Prefer content tuning first when possible:
- seed;
- square size;
- phase HP;
- timers;
- Rotate grant timing/amount;
- phase side;
- exact arrow distribution.

Only change runtime logic if there is an actual runtime/UI mismatch.

Do not remove the intended Shaman lesson just to make it trivially pass.

The Prologue should retain a clean, understandable winning path without requiring hidden knowledge.

## Verification — important

Do NOT count an internal solver-only proof as sufficient.

Verify all of these:

1. Stage 5 is still square.
2. The intended Shaman phases/CAST/Rotate lesson still exists.
3. A winning sequence exists through the same public actions the player has in the browser.
4. Exercise that sequence in the actual playable browser UI, using real arrow taps / Rotate controls rather than directly mutating engine state.
5. Record the winning sequence at a human level in the task card (not a giant raw coordinate log).
6. Full 5-stage campaign still advances and completes.
7. Existing Stage 4 priority lesson remains unchanged.

Run normal tests/typecheck/build. Add a regression test that would have caught the specific failure if practical.

## Boundaries

- No arena/art/editor work.
- No new gameplay mechanic.
- No redesign of Prologue stages 1-4.
- No merge to main.
- Work in an isolated worktree; do not use the shared checkout.

## Result

- Stage 5 tuned in `spikes/arrow-core/campaigns/campaign.json`:
  - Retained square 6x6 board policy.
  - Authored seed updated from 7 to 15.
  - Shaman Phase 1 (North/TOP): 3 HP, attack timer interval 5, damage 2 (ample reaction window for the player).
  - Shaman Phase 2 (East/RIGHT): 2 HP, grants +1 Rotate charge, casts interruptible CAST (interval 3, damage 2), followed by normal attack (interval 4, damage 2).
  - Win awards +2 Rotate charges to the global pool.
- Added regression test in `spikes/arrow-core/test/build-027-square-prologue.test.ts` verifying that Stage 5 win requires a true boss kill (`enc.hits === enc.totalHp` and `enc.hp === 0`), verifying the cast interrupt trigger, rather than false-positive board clear.
- All 288 tests pass (`npm test`), `npm run typecheck`, and `npm run build` pass cleanly.
- End-to-end browser UI playtest verified via CDP with actual canvas pointer events and HUD rotate button clicks, culminating in full campaign victory overlay ("Пролог пройден! HP: 10/10").

## Found

1. **The False-Positive Solver Illusion**:
   `EncounterState.won` has dual win conditions: `this.hitCount >= this.totalHp || (this.board.cleared && !this.playerDead)`.
   In previous seed 7, board 6x6 had only 8 total arrows. Phase 1 took 4 arrows to clear (Arrows 0, 1, 2, 5), leaving only 4 arrows for Phase 2.
   Phase 2 required 4 HP, but rotating CCW left only ONE single arrow (Arrow 6) pointing East. The solver tapped Arrow 6 (boss went from 4 to 3 HP, CAST was interrupted), and then tapped the remaining 3 arrows into the void. Because the board was cleared and player was alive, the engine declared a win even though the Shaman was still alive at 3 HP!
2. **Actual Playability Mismatch**:
   A human player naturally tries to defeat the boss by landing hits. Because only 1 arrow pointed East after rotation, the boss could never be killed, leaving the player with 0 rotate charges and no arrows capable of reaching the boss.
3. **The Solution (Seed 15 Tuning)**:
   Seed 15 produces a 9-arrow square 6x6 board with 4 North, 1 East, 4 South arrows:
   - Phase 1 (3 HP, North): Arrows 0, 3, 4 easily hit North (with Arrow 1 peeling off to East).
   - Phase 2 (2 HP, East): Boss shifts to East and starts CAST (interval 3). Peeling off free arrows reveals South-pointing arrows (Arrows 2 & 8).
   - Rotating CCW (-90°) turns both South arrows into East arrows!
   - Arrow 2 strikes East, interrupting CAST.
   - Arrow 8 strikes East, dealing lethal damage (Boss HP goes to 0). Total HP: 5, Total hits: 5.

## Verify

- `npm test`: 24 test files, 288 tests passed.
- `npm run typecheck`: 0 errors.
- `npm run build`: successful build.
- Browser UI Playtest via CDP:
  1. Loaded visual-proto viewer on `http://localhost:5188/viewer/visual-proto/`.
  2. Selected Stage 5 (`authored-4`).
  3. Dispatched pointermove and click events on the canvas for Arrow 0 -> hit North (Boss HP: 4).
  4. Dispatched click on Arrow 1 -> East miss.
  5. Dispatched click on Arrow 3 -> hit North (Boss HP: 3).
  6. Dispatched click on Arrow 4 -> hit North (Boss HP: 2, Phase 1 complete, enters Phase 2, +1 Rotate granted).
  7. Dispatched click on Arrow 7 -> North miss.
  8. Dispatched click on Arrow 5 -> South miss (Boss CAST countdown: 1).
  9. Clicked DOM HUD button `rotCcw` -> board rotates CCW, remaining South arrows now point East.
  10. Dispatched click on Arrow 2 -> hits East, triggers `castInterrupted`, deals 1 damage (Boss HP: 1).
  11. Dispatched click on Arrow 8 -> hits East, deals 1 damage, defeating Goblin Shaman (Boss HP: 0).
  12. Overlay displays: "Пролог пройден! HP на финише: 10/10. Награда за босса: +2 ROTATE (общий пул: 2)".

## User Playtest

- **How Stage 5 now works**:
  - The Goblin Shaman begins at the TOP (North) of a 6x6 arena with 3 HP and an Attack timer of 5 turns.
  - When Phase 1 is defeated, the Shaman teleports to the RIGHT (East) with 2 HP, grants +1 Rotate charge, and immediately begins channeling a powerful CAST attack (CAST IN 3 turns, dealing 2 damage).
- **What the player should do**:
  1. *Phase 1 (North)*: Tap free arrows pointing North to hit the boss (peel any blocking East arrow if needed). Three hits will advance the Shaman to Phase 2.
  2. *Phase 2 (East & CAST)*: The boss is now on the East side. Notice that the board only has downward (South) pointing arrows available.
  3. *Rotate*: Click the counter-clockwise rotation button (⟲ or Q). This turns the South-pointing arrows so they now face East directly toward the channeling Shaman.
  4. *Interrupt & Defeat*: Tap the free East-facing arrow to strike the boss—this immediately triggers **"CAST INTERRUPTED"**, canceling the incoming 2 damage and resetting the boss's attack! Tap the remaining East arrow to deliver the final lethal blow.
  5. *Victory*: The Shaman falls, granting +2 Rotate charges to your run pool.

