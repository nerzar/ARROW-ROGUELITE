# TASK: FIX-029 — Make Prologue Shaman Stage Actually Winnable

STATUS: READY
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

## Delivery

Short `RESULT / VERIFY / FOUND`.

Include `USER PLAYTEST` with:
- how Stage 5 now works;
- what the player should do to exercise CAST interrupt + Rotate;
- no spoiler-heavy full solution unless necessary.

Commit, push, verify remote SHA, mark DONE.
