# TASK: BUILD-027 — Square Prologue Campaign

STATUS: DONE
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

## RESULT

- Rebuilt the full 5-stage Prologue as an authored campaign in `spikes/arrow-core/campaigns/campaign.json` using square-only boards (5x5, 6x6) and center-first enemy placement.
- Preserved all 5 teaching beats:
  1. **Stage 1 (5x5, seed 1107):** Passive target center/TOP (side 0), 1 HP. Direct shot kills target (0 damage).
  2. **Stage 2 (5x5, seed 1):** Target center/TOP (side 0), 2 HP, `blockedTapDamage: 1`. Teaches unlock order without penalty (0 damage).
  3. **Stage 3 (5x5, seed 4):** Target center/TOP (side 0), 3 HP, ATTACK IN 4 dmg 2. 4-turn sequence kills mob before retaliation (0 damage).
  4. **Stage 4 (6x6, seed 282):** Two enemies at once: primary slow grunt center/TOP (side 0, 2 HP, IN 5) and urgent grunt RIGHT (side 1, 2 HP, IN 3). Focusing urgent East first wins with 0 damage. Wrong path (tapping slow North first) forces East attack for 2 damage.
  5. **Stage 5 (6x6, seed 7):** Goblin Shaman boss. Phase 1 starts center/TOP (side 0, 3 HP, IN 4 dmg 2). Phase 2 shifts East (side 1, 4 HP, CAST IN 3 dmg 2, grants +1 Rotate). Player uses Rotate CCW to redirect board arrows, interrupts CAST, and wins with 10/10 HP. Awards +2 Rotate on victory.
- Extended `convertLevelToStep` in `campaign-model.js` to normalize multi-phase boss sides and string turn allowances (`cw`/`ccw`).
- Added comprehensive vitest suite `test/build-027-square-prologue.test.ts` proving square dimensions, center-first layout, solver 0-damage completion across all 5 stages, priority divergence, and full RunState sequential playthrough.

## VERIFY

- `npm run typecheck` passed cleanly (0 errors).
- `npm run build` passed cleanly.
- `npm test` passed: 24 test files, 287 tests passed (including all regression suites and the new `build-027-square-prologue.test.ts`).
- Automated headless Chrome CDP tests verified:
  - Game client `http://localhost:5177/viewer/visual-proto/index.html?mode=authored&stage=0` loads authored campaign step 1, executes tap, and advances to step 2.
  - Campaign authoring tool `http://localhost:5177/viewer/visual-proto/calibration-editor.html` loads all 5 stages in sequence from `campaigns/campaign.json`.

## FOUND

- In Stage 4, having independent countdown timers requires board generation with free exits on both sides at start to allow real player choice; seed 282 provides both free North and free East arrows, producing mathematical divergence (0 damage on urgent first vs >=2 damage on slow first).
- Boss phase direction transition from center/TOP (North) to RIGHT (East) makes the granted Rotate feel purposeful and necessary to prevent CAST detonation.

## USER PLAYTEST

Start dev server (if not already running):
```pwsh
cd spikes/arrow-core
node tools/serve.mjs
```

Open playable game in browser:
- [Playable Authored Prologue](http://localhost:5177/viewer/visual-proto/index.html?mode=authored&stage=0)
- [Campaign Authoring Editor](http://localhost:5177/viewer/visual-proto/calibration-editor.html)

Authored Stages:
1. `Этап 1 · 5x5 Чистый выстрел` (5x5, seed 1107) — Basic shot, center/TOP passive target.
2. `Этап 2 · 5x5 Ошибка стоит HP` (5x5, seed 1) — Unlock order, mistake cost.
3. `Этап 3 · 5x5 Время имеет цену` (5x5, seed 4) — ATTACK IN 4 timer pressure.
4. `Этап 4 · 6x6 Приоритет целей` (6x6, seed 282) — Two enemies (Slow TOP IN 5 vs Urgent RIGHT IN 3).
5. `Этап 5 · 6x6 Goblin Shaman` (6x6, seed 7) — Two-phase boss: starts TOP, shifts East in Phase 2 with CAST IN 3 + Rotate.

