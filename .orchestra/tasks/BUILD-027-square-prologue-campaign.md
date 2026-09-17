# TASK: BUILD-027 — Square Prologue Campaign

STATUS: READY
TYPE: BUILD
SIZE: M/L
AGENT: Gemini / gameplay-content implementation
BASE_BRANCH: build/BUILD-026-campaign-authoring-tool
BRANCH: build/BUILD-027-square-prologue-campaign
START_SHA: 498cc25a88bed99b38e4bf138ea67f6cdb374f63

## Goal

Rebuild the current 5-step Prologue as square-only authored levels using the BUILD-026 campaign workflow.

This is content + gameplay/data work. Do not spend time on visual asset polish; ASSET-002 owns that in parallel.

## User decisions

- New Prologue boards are square only for now.
- No irregular/rectangular board shapes.
- First enemy starts in the center/TOP slot by default.
- LEFT/RIGHT are used when center is already occupied, or later during an encounter if a mechanic intentionally moves a boss/target.
- Keep the current 5-beat teaching arc.
- Use the existing engine/solver/analyzer; do not invent a new level system.

## Teaching beats to preserve

1. **Basic shot** — the player sees that a freed arrow leaves the board and hits the outside target.
2. **Unlock order / mistake** — blocked-arrow interaction matters; the player learns to free arrows in the right order.
3. **Timer pressure** — enemy attack timing makes turns matter.
4. **Multi-enemy priority** — two enemies create a real target-priority decision.
5. **Goblin Shaman** — direction becomes important; CAST interrupt is demonstrated; Rotate reward remains part of the Prologue finish.

## Content requirements

Choose practical square sizes/seeds (prefer simple 5x5/6x6-style progression unless a larger square is genuinely needed).

For every level:

- use a reproducible square board seed;
- keep it solvable;
- keep the encounter readable;
- preserve a clean no-damage path for the Prologue where current canon requires it;
- make the lesson of that stage actually visible in play, not just in metadata;
- avoid long mechanical cleanup after the interesting decision is over.

Placement:

- Stage 1: one enemy, center/TOP.
- Stage 2: one enemy, center/TOP.
- Stage 3: one enemy, center/TOP.
- Stage 4: first/primary enemy center/TOP; second enemy RIGHT or LEFT.
- Stage 5: Shaman starts center/TOP. A later phase may move/change side if needed for the direction/Rotate lesson.

Use the BUILD-026 authored campaign format and write the result to the real project campaign file. Make this square 5-step campaign playable through the existing authored campaign path. If minimal wiring is needed so this becomes the practical Prologue playtest, do it without re-architecting the runtime.

Do not touch generated-art importing/pivot tuning unless absolutely necessary; ASSET-002 owns that.

## Verify

Use the existing solver/analyzer and browser playtest.

Prove:

- all five boards are square;
- all five load/play in sequence;
- center-first placement is respected;
- Stage 4 really contains a two-target priority decision;
- Stage 5 still demonstrates Shaman CAST/interrupt + direction/Rotate reward;
- no stage is accidentally unwinnable;
- the campaign file reloads correctly.

Run normal typecheck/tests/build for touched code. Avoid separate research/review work.

## Delivery

Short `RESULT / VERIFY / FOUND` plus `USER PLAYTEST` with only the URL/run command and the 5 stage names/sizes.

Commit, push, verify remote SHA, mark DONE.
