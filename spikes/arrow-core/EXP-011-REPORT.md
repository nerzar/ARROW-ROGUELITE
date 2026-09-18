# EXP-011 — Attack Types / Cast Interrupt

> Spike run by Claude Sonnet 5, per the user's direct brief. No game-design decision is claimed as
> final beyond what the brief itself specified; provisional numbers stay provisional (marked TUNING).

## 0. What was done

1. Worked from the final tip of `exp/EXP-010b-multi-enemy` (`c70ea85`, which by the time this task
   started already had one further commit past EXP-010b's own recorded result — a design doc commit
   unrelated to this task's files). Created `exp/EXP-011-attack-types` in a separate git worktree
   (`.worktrees/EXP-011`) rather than the shared main checkout, because the main checkout had already
   moved on to a different, concurrently-running task's branch (`exp/EXP-012-multi-encounter-analyzer`)
   by the time this task started — using a worktree avoided disturbing that other session's checkout.
2. Added `AttackTimer.kind: 'normal' | 'cast'` and an opt-in interrupt shape (`interruptible` +
   `interruptedAttack`) to the same `AttackTimer` type already shared by `BossPhase` and `EnemyDef` —
   so boss phases and simultaneous `enemies` both get the mechanism for free, per the brief's "make the
   model general enough for later Caster enemies" requirement.
3. Implemented the exact semantics the brief specified, distinct from three explicitly-rejected shapes
   (hit-adds-to-countdown, hit-fully-resets-countdown, hit-always-interrupts): a `normal` attack is
   unchanged EXP-010 behaviour (hit deals damage, timer untouched); a `cast` attack with
   `interruptible: true` has a landed hit while armed cancel the cast outright (its own damage never
   fires) and switch the attacker's *next* attack to `interruptedAttack` (by convention `kind: 'normal'`)
   — a type change, not a numeric timer bonus and not a reset back into another cast. A `cast` without
   `interruptible` behaves exactly like `normal`, just displayed as `CAST IN N`.
4. Applied this to the mini-boss's phase 2 (`encounters/cp-e5.json`, seed 1571): phase 2 now opens in
   an interruptible cast instead of a plain attack timer of the same shape. This removes the
   EXP-010b-documented FOUND (§6 of that report): the old plain `ATTACK IN 3` forced exactly 1
   unavoidable point of damage on this board, because phase 2's fresh window only allowed 2 hits to
   land before the timer fired. With the cast model, the interrupting hit costs no player HP, and
   `minDamageToWin` now proves a 0-damage path exists — verified exhaustively (not budget-limited) at
   player HP 4, 9, and 10.
5. Extended `EncounterState`/`TapResult` (`attackKind` getters, `enemies[].attackKind`,
   `castInterrupted` on `TapResult`), the CLI/report text (`describeAttackTimer`: `CAST IN N` vs
   `ATTACK IN N`, `traceActions`'s `CAST INTERRUPTED` line), and the debug viewer (`viewer/cp-prologue.js`:
   `CAST IN N` / `ATTACK IN N` on the boss box, per-enemy box, and the side panel; `CAST ПРЕРВАН
   (следующая атака — обычная)` message + log line on an interrupted cast) so the mechanic is visible,
   not just internally correct.
6. Added 13 new tests (`test/attack-types.test.ts`) covering both boss mode and enemies mode, rewrote
   the two tests that asserted the now-obsolete "E5 needs 1 unavoidable damage" / "cw Rotate is a
   guaranteed loss" behaviour to match the new, verified reality, and reran the full existing suite.
   Full suite: **106/106 green** (93 pre-EXP-011 + 13 new; zero unexpected regressions — the two
   changed assertions were expected, explained fallout of the redesign, not accidental breakage).
7. Did **not** touch items/weapons/Act I content/economy/art/Phaser/large refactors/new enemy
   archetypes beyond the test fixtures, per the brief's explicit exclusions. Did not merge to `main`.

## 1. Data model: `AttackTimer.kind` / interrupt

`spikes/arrow-core/src/encounter.ts`:

```ts
export type AttackKind = 'normal' | 'cast'

export interface AttackTimer {
  interval: number
  damage: number
  interruptOnHit?: boolean       // EXP-010 legacy, unrelated, still unused by any content
  interruptHits?: number
  kind?: AttackKind              // EXP-011, default 'normal'
  interruptible?: boolean        // EXP-011, `kind: 'cast'` only
  interruptedAttack?: AttackTimer // EXP-011, required when interruptible is true
}
```

This is deliberately the same field the brief sketched (`attack: { type, countdown/interval, damage }`,
`interrupt: { enabled, onHitDuringCast, nextAttackType: normal }`), reshaped to fit the engine's
existing single-`AttackTimer`-per-phase/enemy architecture rather than adding a parallel data
structure. `checkEncounter`/`checkAttackTimer` validate it: `kind` must be `'normal'`/`'cast'`;
`interruptible: true` requires `kind: 'cast'` and a present `interruptedAttack`; `interruptedAttack`
(when present) is itself validated recursively.

**State**: each `EncounterState` tracks one boolean per phase (`castInterrupted`) / one boolean array
per enemy (`enemyCastInterrupted[]`) — "has this phase's/enemy's cast already been interrupted?" — not
a copy of the whole post-interrupt `AttackTimer`. The *currently active* attack config is computed on
demand (`currentAttackTimer()` / `currentEnemyAttackTimer(i)`): the phase's/enemy's own `attackTimer`
until interrupted, then its `interruptedAttack` for the rest of the phase/until death. This boolean is
included in `TimerSnapshot` (undo/redo correctness) and in `key()` (solver DFS correctness — two states
with the same hp/countdown but a different active attack config, e.g. a cast vs. its post-interrupt
normal attack, must not be treated as equal by `findWin`/`minDamageToWin`'s memoization).

**Interrupt precedence** (`advanceTurn`/`advanceEnemiesTurn`, checked in this order, before any
countdown tick): (1) EXP-011 `kind: 'cast'` + `interruptible` + a hit landed on this target this turn →
interrupt, no damage, switch to `interruptedAttack`; (2) EXP-010 legacy `interruptOnHit` → reset this
same countdown, no kind change (untouched, still unused by any content); (3) plain tick, damage at 0.
A `cast` without `interruptible` never reaches branch (1) and behaves exactly like `normal`.

`TapResult` gained `castInterrupted: boolean`, narrower than the existing `interrupted: boolean` (which
now also covers this case, for callers that only care "was something interrupted"). `EncounterState`
gained `attackKind` (boss mode) and `enemies[].attackKind` (enemies mode) getters for the
viewer/analyzer to read.

## 2. Files changed

- `src/encounter.ts` — `AttackKind`, `AttackTimer.kind`/`interruptible`/`interruptedAttack`,
  `EncounterState.castInterrupted`/`enemyCastInterrupted`, `currentAttackTimer`/
  `currentEnemyAttackTimer`, cast-interrupt branch in `advanceTurn`/`advanceEnemiesTurn`,
  `attackKind` getters, `TapResult.castInterrupted`, `TimerSnapshot`/`key()` updated for the new state,
  `checkAttackTimer` validation.
- `src/encounter-solver.ts` — `describeAttackTimer` (CAST IN N vs ATTACK IN N, interruptibility, what
  it switches to), used by `validateEncounter`'s phase/enemy summary; `traceActions`'s `CAST
  INTERRUPTED` line.
- `encounters/cp-e5.json` — phase 2's `attackTimer` gained `kind: 'cast'`, `interruptible: true`,
  `interruptedAttack: { interval: 4, damage: 1, kind: 'normal' }` (TUNING, see §3). Same seed
  (1571), same board, same HP, same phase 1 — nothing else changed.
- `viewer/cp-prologue.js` — `CAST IN N` / `ATTACK IN N` on `drawBoss`, `drawEnemies`, and the side
  panel (boss + enemies branches); `CAST ПРЕРВАН (следующая атака — обычная)` UI message +
  `CAST INTERRUPTED` log line on an interrupted cast, distinct from the generic legacy-interrupt text.
- `test/attack-types.test.ts` — new, 13 tests (full list in §5).
- `test/multi-enemy.test.ts` — the old E5 FOUND test rewritten: was "proven to require exactly 1
  unavoidable damage, not 0 — documented FOUND, not fixed", now "now has a proven 0-damage path via
  the EXP-011 cast-interrupt on phase 2".
- `test/combat-pressure.test.ts` — the old "cw Rotate is a losing choice at entry HP 4" assertion
  rewritten: cw now also wins (the cast-interrupt removed the 1-damage floor that used to kill a
  greedy cw playthrough at this HP), just with much less margin than ccw (1 hp vs. 3 hp) — still
  demonstrates ccw as the better-informed choice without cw being an outright trap.
- `README.md` — EXP-011 command block and file-table rows.
- `.claude/launch.json` (repo root, shared) — added `exp-011-attack-types-viewer` on port 5183,
  appended alongside the existing entries (5177/5179/5181) rather than replacing them, since this file
  is shared across concurrently-running sessions on this machine.

## 3. Mini-boss phase 2: exact verified fix

Before (EXP-010b, `interval: 3, damage: 1`, plain `ATTACK IN N`, unchanged since EXP-010):

```
no-damage path exists:         NO (min damage 1)
min unavoidable player damage: 1   nodes 204750
```

After (EXP-011, `kind: 'cast', interruptible: true`, `interruptedAttack: { interval: 4, damage: 1,
kind: 'normal' }`):

```
no-damage path exists:         YES
min unavoidable player damage: 0   nodes 723
```

Verified with `npm run cli -- encounter encounters/cp-e5.json --player-hp <4|9|10>` — proven (not
budget-limited) at all three entry HPs, confirming the fix is a board-timing property, not an
HP-dependent coincidence (matching how the original 1-damage floor was also HP-independent, per
EXP-010b-REPORT.md §6).

**Example minimum-damage sequence** (from `npm run cli -- encounter encounters/cp-e5.json --player-hp 10`):

```
 1-5: phase 1, E-side hits (unchanged, 0 damage)             -> phase 2, boss on N, +1 Rotate
 6-7: two misses (no N-side arrow free yet on this path)
 8:   rotate ccw
 9:   N-side hit                                              CAST INTERRUPTED -> next attack: normal
10-13: remaining N-side hits (now under the normal attack's interval-4 window) -> WIN, 0 damage
```

Live-viewer verification (see §6) reproduced this exact interrupt turn manually: the boss box read
`CAST IN 3` before the hit, `CAST ПРЕРВАН (следующая атака — обычная)` appeared on landing it, boss HP
dropped 5→4 (the hit still damages the boss — only the *cast's own* damage is cancelled), player HP
stayed 10/10, and the box switched to `ATTACK IN 4`.

### TUNING (provisional, not a balance decision)

Per the brief: *"используй минимально разумные provisional значения и явно вынеси их в report как
TUNING"*. Two numbers were touched, both on phase 2 only:

- **Cast** (`interval: 3, damage: 1`) — unchanged from EXP-010b's plain-timer values; kept so the
  telegraph timing a player already saw in the pre-EXP-011 build feels the same up to the interrupt.
- **Post-interrupt normal attack** (`interval: 4, damage: 1`) — new. `4` was the *first* value tried
  (after the old `3`, which reproduces the old 1-damage floor almost by construction — that's the
  value that used to be a plain, non-interruptible timer). It was accepted because `minDamageToWin`
  immediately proved a 0-damage path at all three tested entry HPs; no further search for a "tighter"
  value (e.g. is `3` almost workable with different phase-1 play, is there a smaller value that still
  proves 0) was done, since the brief asked for minimally-adjusted provisional numbers, not an optimal
  tuning pass.

Neither boss HP nor the seed was touched, per the brief's explicit constraints.

### Side effect worth flagging (not a bug, not silently fixed)

`min Rotates needed: 0` was already true *before* this task (a Rotate-free win already existed via
board-clear-alive, just with 1 unavoidable damage — this is not new). What changed is that the
Rotate-free win is not automatically damage-free either; the proven 0-damage sequence above still uses
the granted Rotate. Separately, `test/combat-pressure.test.ts`'s pre-existing "wrong Rotate (cw) loses"
scenario (at the historical entryHp=4 stress case) no longer loses — it now wins with 1 hp of margin
instead of dying, because the cast-interrupt makes phase 2 generally more forgiving, not only along the
"correct" ccw path. This is flagged for the user/level designer's awareness, not treated as something
to compensate for: the brief's goal was specifically to remove unavoidable damage, and a
side-effect of a boss phase becoming safer in general is that a previously-fatal mistake becomes merely
costly instead. See `docs/LEVEL-DESIGNER.md` §6 G (human playtest) for where this would get a final
call.

## 4. Full prologue: `minDamageToWin` at 10 (max) entry HP

| Encounter | Shape | minDamageToWin | Notes |
|---|---|---:|---|
| E1 (seed 3874) | boss, 1 target | **0** | unchanged |
| E2 (seed 300) | boss, 1 target | **0** | unchanged |
| E3 (seed 522) | boss, 1 target, timer | **0** | unchanged |
| E4 (seed 10) | enemies, 2 simultaneous | **0** | unchanged (EXP-010b) |
| E5 (seed 1571) | boss, 2 phases, Rotate, **phase 2 now cast+interrupt** | **0** | **was 1 (EXP-010b FOUND), now fixed this task** |

A perfect player can now finish the entire prologue, E1 through the mini-boss, with **0** unavoidable
damage — the FOUND from EXP-010b-REPORT.md §6 is resolved.

## 5. Tests (`test/attack-types.test.ts`, 13 new)

- normal attack (`kind: 'normal'` and `kind` omitted) is never interrupted by a hit; timer only ticks
- cast attack, interruptible: is interrupted by a hit landed while armed
- an interrupted cast deals no damage
- the interrupt changes the attack type to normal, not just the numbers (`attackKind` before/after)
- no artificial timer bonus: the post-interrupt countdown is exactly `interruptedAttack.interval`
- the normal attack after an interrupt then lives by its own ordinary rules (ticks, not itself
  interruptible, stays `normal` — no reverting to cast)
- cast attack, not interruptible: ignores hits entirely for timer/state purposes (ticks and fires like
  a plain timer, ignoring the landed hit)
- enemies mode: the same `AttackTimer` shape works for a Caster-style simultaneous enemy (interrupt,
  no damage, type flip) — demonstrates the "general model for later Caster enemies" requirement
- enemies mode: multi-enemy normal timers are unaffected by EXP-011 (default `kind` stays `'normal'`,
  hits never interrupt) — EXP-010b regression guard
- mini-boss phase 2 (seed 1571): `minDamageToWin` proves a 0-damage winning path exists
- mini-boss phase 2: phase 2 starts in CAST mode and switches to normal on the interrupting hit
  (replays the actual `minDamageToWin` sequence and asserts both facts, plus the final 0-damage win)
- all five prologue encounters (E1-E5) have a proven 0-damage path (parametrized)

Plus two pre-existing tests rewritten to match the new, verified reality (§2); everything else across
`board.test.ts`, `prologue.test.ts`, `encounter.test.ts`, `rng.test.ts`, `property.test.ts`,
`multi-enemy.test.ts`, and the rest of `combat-pressure.test.ts` is untouched and still green — the
normal-attack path (E1-E4, all pre-EXP-011 boss/enemies content) has zero behavioral change.

## 6. Live viewer verification

Ran via a dedicated local preview server (`.claude/launch.json`, `exp-011-attack-types-viewer`, port
5183 — chosen to not collide with other concurrently-running sessions' 5177/5179/5181 entries already
in that shared file):

- Jumped to E5 via `cpDebug.jumpTo(4)`, played phase 1 to a clean kill (via direct `EncounterState`
  calls, since jumping resets to full HP — a pre-existing debug-only limitation, unrelated to this
  task), confirmed the boss box read **`CAST IN 3 · фаза 2/2`** the instant phase 2 started.
- Clicked **Rotate ccw** through the real UI (button click, not scripted), confirmed the board rotated
  270° and the boss target switched to the single free N-side arrow.
- Clicked that arrow (real click, coordinates read via `cpDebug.pointOf`): the message line showed
  **`#11 ↑ попадание · HP целей 4/9 · CAST ПРЕРВАН (следующая атака — обычная)`**, the log line showed
  `CAST INTERRUPTED`, boss HP dropped 5→4 (hit still damages the boss), player HP stayed **10/10**, and
  the boss box switched to **`HP 4/9 ATTACK IN 4 · фаза 2/2`** — every piece of the intended behaviour
  (cast interrupted, no cast damage, type switched to normal, boss still takes hit damage) visible in
  one screenshot.
- Played the rest out via a greedy (not necessarily optimal) auto-player: reached `won: true`. It cost
  1 HP in this particular greedy run (not the proven-optimal `minDamageToWin` sequence) — expected and
  consistent with the design: the *exists* claim is about a perfect player, not every possible
  playthrough; the CLI validator already exhaustively proved the 0-damage path separately (§3).
- Console/network checked: no errors at any point.

## 7. Known limitations (not fixed, out of scope or explicitly deferred)

- `interruptedAttack` only models a single cast → normal transition; nesting another interruptible
  cast inside `interruptedAttack` is not rejected by `checkAttackTimer` but is untested and not used by
  any content — the brief only asked for cast → normal, not a general FSM of attack types.
- The legacy EXP-010 `interruptOnHit`/`interruptHits` fields (full-timer-reset-on-N-hits, off by
  default, unused by any content since EXP-010) are untouched and still independent of the new
  `kind`/`interruptible` fields — left alone per the "no large refactor" constraint, since removing
  them was not asked for and they are not the mechanism this task implements.
- The debug `cpDebug.jumpTo()` still resets HP to max, same pre-existing limitation noted in every
  EXP-010/010b report — irrelevant to a real playthrough, only affects manual debugging.
- `tools/cp-shortlist.ts` (seed scanning) still does not understand `kind`/`interruptible` — irrelevant
  here since no new seed search was needed (E5's seed/board were not touched, only its phase-2 timer
  data), but a future Caster-enemy seed search would need this tool extended, same caveat EXP-010b
  already noted for multi-enemy shortlisting in general.
- No new enemy archetype (Caster) was added to any real encounter content — per the brief's explicit
  exclusion ("новые enemy archetypes сверх test fixture"); `test/attack-types.test.ts`'s enemies-mode
  cast test is a fixture proving the mechanism generalizes, not new game content.

## 8. Scope guard — confirmed not touched

No items/weapons/Act I content/economy/ads/rewards/art/Phaser/production rewrite/procedural encounter
generation/large refactor/new enemy archetype beyond the test fixture. No change to `docs/**` or
`.orchestra/RULES.md`/`PROJECT.md`/`GIT.md`/`LEVEL-DESIGNER.md`. No change to E1-E4 content or engine
paths (verified: all pre-existing E1-E4 tests pass unchanged). No boss-HP reduction, no artificial
timer bonus, no board/seed change anywhere. No merge to `main`.

## 9. Exact run command

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/cp-e5.json --player-hp 10
node tools/serve.mjs 5183        # or any free port
# open http://localhost:<port>/viewer/cp-prologue.html
```
