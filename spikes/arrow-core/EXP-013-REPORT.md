# EXP-013 — Enemy Board Abilities / Stone Throw

> Experiment, run by Claude Sonnet 5, per the user's direct brief. **This mechanic is not accepted
> game design.** It proves the idea is implementable with a minimal, extensible mechanism and one
> concrete ability (Stone Throw); it does not decide that enemies changing the board is part of the
> game.

## 0. What was done

1. Worked from the final tip of `exp/EXP-011-attack-types` (`b325eca`, confirmed as both the local
   and `origin` tip via `git fetch --all --prune` before branching). At the time this task started the
   main checkout (`C:\Users\nerza\Projects\ARROW-ROGUELITE`) was on `main`, unrelated to this chain, and
   a different worktree (`.worktrees/EXP-011`) already existed for the base branch — this task's own
   work happened in a fresh `.worktrees/EXP-013` worktree, consistent with EXP-011's own precedent of
   not disturbing whatever else is checked out in the shared repo.
2. Added `EnemyDef.ability: EnemyAbility` — a second, independent per-enemy countdown (`THROW IN N`),
   alongside but never instead of `attackTimer`. The only resolution implemented is Stone Throw: pin
   one arrow (`targetPolicy: 'free-arrow'`, deterministic lowest id, guaranteed not to be the last
   playable arrow) for `pinDuration` world turns.
3. Kept `BoardState` (`src/state.ts`) **completely untouched** — zero lines changed. Pin state lives
   entirely in `EncounterState` as a temporary availability overlay: `pinTurnsLeft: number[]` indexed
   by arrow id. `playableArrows()` = `board.freeArrows()` minus pinned ids; this is what the solver and
   `wouldHit` use, while `board.canExit()`/`freeArrows()` keep meaning exactly what they always meant
   (pure geometric truth). A pinned arrow's body still blocks/is blocked exactly as before — verified
   directly (test: "a pinned arrow still blocks topology normally").
4. Picked one explicit turn-order and justified deviating from the brief's initial sketch by one swap
   (existing-pin tick/expire BEFORE new-ability resolution, not after — see §2). Implemented it once,
   inside `EncounterState.tap`/`rotate`, so runtime and solver share the exact same order automatically
   (the solver only ever drives state through `tap()`/`rotate()`/`undo()`, never reimplements turn
   logic).
5. Extended `encounter-solver.ts`'s three search algorithms (`findWin`, `maxHits`, `minDamageToWin`,
   plus `probePhase2`) to iterate `s.playableArrows()` instead of `s.board.freeArrows()` — necessary
   for correctness, not just accuracy: calling `s.tap(id)` on a pinned-but-geometrically-free `id`
   returns the new `'pinned'` rejection without logging anything, which would have silently desynced
   the solver's `s.undo()` bookkeeping if the pinned id were ever offered as a candidate.
6. Created `encounters/rock-spike.json`, a standalone debug encounter (easy 6×7, seed 15) — **not**
   added to the accepted prologue chain (`viewer/cp-prologue.js`'s `STEPS` array untouched) or to any
   Act I content. Built a separate, deliberately small single-encounter debug viewer
   (`viewer/rock-spike.html` + `viewer/rock-spike.js`, modeled on `cp-prologue.js`'s enemies-mode
   rendering but without its `RunState`/multi-step/candidate-picker machinery) rather than touching the
   prologue viewer — one link added from `cp-prologue.html`'s header for discoverability.
7. Added 18 new tests (`test/enemy-abilities.test.ts`) covering the full brief checklist (§5). Full
   suite: **124/124 green** (106 pre-EXP-013 + 18 new; zero regressions in existing content/paths).
8. Did **not** implement permanent rocks, dynamic geometry mutation, new board shapes, a second
   ability, an item system, Act I content, random targeting, animation/art, physics, a scripting
   language, an ECS, or a large refactor — per the brief's explicit exclusions. Did not merge to
   `main`.

## 1. Pin-state model

`spikes/arrow-core/src/encounter.ts`:

```ts
export type AbilityTargetPolicy = 'free-arrow'

export interface EnemyAbility {
  id: string
  interval: number            // THROW IN N; ticks on every legal world turn
  targetPolicy: AbilityTargetPolicy
  pinDuration: number          // world turns the pinned arrow stays illegal to tap
  label?: string
}
```

`EnemyDef.ability?: EnemyAbility` — not added to `BossPhase`; this spike only needed it on
simultaneous enemies, per the brief's own example ("1 обычный enemy").

**State**, all in `EncounterState`, board-level (not mode-specific, though only `enemies` mode can
currently populate it):

- `pinTurnsLeft: number[]` — one entry per board arrow id, 0 = not pinned. This *is* "which arrows are
  pinned, how many turns are left" in one structure; "when a pin appeared" is recoverable from the
  action log if ever needed, and wasn't worth a separate field for this spike's scope.
- `enemyAbilityCountdown: number[]` — one entry per `def.enemies[i]`, `Infinity` if that enemy has no
  ability.

**"Free" vs "playable"**, exactly as the brief asked to keep separate:

```ts
playableArrows(): number[] {                 // mechanical availability (EncounterState)
  const out: number[] = []
  for (const id of this.board.freeArrows())   // geometric truth (BoardState, untouched)
    if (!this.isPinned(id)) out.push(id)
  return out
}
```

`wouldHit()` and the three solver search functions use `playableArrows()`/`wouldHit()`; nothing about
`BoardState` itself changed, so `canExit`/`freeArrows`/blocking/topology are exactly what they were
before this task for every existing encounter (E1–E5, cp-e4, rock-spike's own blocked-arrow test
fixture) — a pinned arrow's own `canExit` stays `true` the whole time it's pinned (it is not
geometrically removed or blocked, just mechanically un-tappable), and it continues to block whatever
it always blocked.

**Snapshot/undo/key**: `pinTurnsLeft` (and `enemyAbilityCountdown` in enemies mode) are part of
`TimerSnapshot`, so `undo()` fully reverts a pin the same way it already reverted attack-timer/cast
state. `key()` was extended to include both — this is not cosmetic: two states can have an identical
`board.key()` (same alive set) and identical hp/countdown but differ only by which arrow is pinned, and
the solver's memoization would otherwise treat them as the same search node (verified directly in
"key() distinguishes an otherwise-identical state that differs only by an active pin").

## 2. Turn order (and the one deviation from the brief's sketch)

Implemented, once, inside `tap()`'s `enemies`-mode branch and mirrored in `rotate()` when
`def.rotate.advancesTurn`:

```
1. player makes a legal action (tap that exits the board, or a Rotate that advancesTurn)
2. projectile/hit/kill resolves (board + enemy hp mutate)
3. if the encounter is already won this turn -> stop (no retaliation, no timer movement at all --
   the existing "killed this turn: no retaliation" rule, unchanged since EXP-010)
4. normal attack/cast timers advance/resolve (unchanged EXP-010/EXP-011 code)
5. EXISTING pins tick down by one; any that reach 0 expire (become playable again)
6. enemy ability timers advance; a timer reaching 0 resolves NOW -- may create a NEW pin
7. evaluate win/loss (via getters; nothing further to do here)
```

The brief's initial sketch put "ability timers advance/resolve" (step 5) *before* "temporary board
effects tick/expire" (step 6). This was swapped for a concrete reason, not a stylistic preference:
if a brand-new pin created this turn were *also* ticked down in the same call (because tick ran after
creation), `pinDuration: N` would functionally mean "blocked for N−1 further turns", off by one from
what the number says and from what a level designer configuring `pinDuration: 2` would expect. Worked
example with the order actually implemented (tick-before-create):

```
turn T:   ability fires, pins arrow X at turnsLeft=2 (not ticked this same turn -- it didn't exist
          yet when step 5 ran)
turn T+1: step 5 ticks X: 2 -> 1 (still pinned; player cannot tap X this whole turn)
turn T+2: step 5 ticks X: 1 -> 0 -> expires (still pinned when the player chooses this turn's action
          in step 1, since step 1 runs before step 5; becomes tappable starting turn T+3)
```

Net effect: `pinDuration: 2` reliably means "illegal to tap for exactly 2 further world turns after
the one it was created on" — verified directly (test: "expires deterministically after pinDuration
world turns"), and the live browser session (§6) reproduced this exact count.

This is the one deterministic order, shared identically by runtime and solver, because both only ever
call into `EncounterState.tap()`/`rotate()` — there is no second, parallel implementation of turn
resolution anywhere in `encounter-solver.ts`.

## 3. Solver changes

`spikes/arrow-core/src/encounter-solver.ts`: every place that iterated `s.board.freeArrows()`
(`findWin`, `maxHits`, `minDamageToWin`, `probePhase2`) now iterates `s.playableArrows()`. This is a
minimal, surgical change — no new search algorithm, no new pruning logic, no generalized ability
solver. The reasoning (documented in the module's own doc comment now): `board.freeArrows()` still
includes a pinned arrow (it *is* geometrically free), and blindly calling `s.tap(id)` on it would
return the `'pinned'` rejection — which, unlike `'blocked'`, was deliberately designed to **not** log
anything (there is nothing to undo for a pin rejection, same as for a blocked tap) — so the very next
`s.undo()` in the DFS would pop the *previous* logged action instead, silently corrupting the search.
`playableArrows()` keeps the pre-existing invariant "every id these functions ever tap is a real,
logged, undoable action" intact without touching the DFS algorithms themselves.

`s.key()` and `s.wouldHit()` already carry pin awareness on their own (§1), so this one substitution
was the complete fix — verified by the full existing 106-test suite staying green (nothing about
E1–E5/cp-e4/EXP-011's cast-interrupt behavior changed) plus `rock-spike.json` proving solvable,
no-softlock, with a small finite `minDamageToWin`.

## 4. Spike encounter (`encounters/rock-spike.json`)

Board: `easy` preset, seed 15 (6×7, 11 arrows: N4 E1 S4 W2; initially free N2 E1 S1 W1 — ids 0,1 N; 3
E; 8 S; 9 W). One enemy, `rockthrower`, side N:

```json
{
  "id": "rockthrower", "side": "N", "hp": 6,
  "attackTimer": { "interval": 5, "damage": 1 },
  "ability": { "id": "stone_throw", "interval": 3, "targetPolicy": "free-arrow", "pinDuration": 2 }
}
```

`hp: 6` deliberately exceeds the board's total N-arrow supply (4), so the fight can only end by
**board-clear-alive** (docs/COMBAT-RULES.md 8's second win path) — the encounter is a full 11-turn
puzzle-clear, long enough for Stone Throw to fire twice and meaningfully interact with priority, not a
4-tap kill that ends before the ability matters (an `hp: 3` first draft did exactly that and was
rejected for being too short to demonstrate anything — see §7 FOUND). No Rotate in this encounter.

### Example path (greedy hit-first play, exactly reproduced by both the CLI validator and a live
browser session, §6)

```
turn 1: tap #1  N HIT   enemy 5/6
turn 2: tap #3  N HIT   enemy 4/6
turn 3: tap #0  W miss  enemy 4/6   ROCK THROWN: #5 pinned (2 turns) -- #5 was the exact N arrow
                                     the player would tap next
turn 4: tap #8  E miss  enemy 4/6   (forced detour: #5 is unavailable)
turn 5: tap #6  S miss  enemy 4/6   ENEMY ATTACK -1 (player 9)   UNPINNED: #5
turn 6: tap #5  N HIT   enemy 3/6   ROCK THROWN: #4 pinned (2 turns)  (second Stone Throw)
turn 7: tap #7  N HIT   enemy 2/6
turn 8: tap #9  S miss  enemy 2/6   UNPINNED: #4
turn 9: tap #4  S miss  enemy 2/6
turn 10: tap #10 W miss  enemy 2/6   ENEMY ATTACK -1 (player 8)
turn 11: tap #2  S miss  enemy 2/6   board cleared -> WIN
```

Final: `won: true, playerHp: 8/10, enemyHp: 2/6` (enemy survives, board-clear-alive win — a legitimate
outcome per docs/COMBAT-RULES.md 8, same as any other encounter in this repo). This is exactly the
brief's requested demonstration: at turn 3 the player has a clearly good, obvious free N arrow (#5);
Stone Throw disables precisely that arrow; the player must read the board, pick a worse-looking move
for two turns, and only then resume the original plan. The 2 HP lost over the whole 11-turn fight comes
entirely from the *normal* `attackTimer` (interval 5, unrelated to the pin mechanic) firing twice in a
long fight — Stone Throw itself never deals damage, matching the brief ("damage не главное").

### Softlock safeguards (verified, not just argued)

- `selectAbilityTarget` only ever returns a candidate when `playableArrows().length >= 2` at
  resolution time (after the current turn's own board mutation and after existing pins have already
  ticked/expired that same turn) — pinning would then still leave at least one other tappable arrow.
  With 0 or 1 candidates, it fizzles (`-1`): no pin, ability countdown still resets to `interval` (so it
  simply tries again next cycle instead of retrying every single turn).
- Verified directly: a 2-arrow fixture where the *only* remaining candidate is guaranteed to fizzle
  rather than being pinned (test: "never pins the only playable arrow"), and a 3-arrow fixture reaching
  genuinely zero candidates (the sole remaining unpinned-or-alive arrow is itself already pinned) also
  fizzles cleanly with no crash (test: "fizzles safely... when there is no free-and-unpinned candidate
  at all").
- On `rock-spike.json` itself: `findWin`/`minDamageToWin` (exhaustive DFS over `playableArrows()`)
  both prove a win exists — an actual softlock would show up as `findWin.win === false` with
  `proven === true`, which it is not.

## 5. Tests (`test/enemy-abilities.test.ts`, 18 new)

Every item from the brief's checklist, plus two extras (Rotate-driven ticking, and
`checkEncounter`/`checkAbility` validation):

- Stone Throw triggers at correct world turn (not one turn early)
- a blocked tap does not advance the ability timer
- a Rotate that `advancesTurn` also ticks pins/resolves abilities (same as a tap turn)
- a pinned arrow cannot be tapped
- a pinned arrow click does not damage the player, and does not advance any timer
- a pinned arrow still blocks topology normally; its own `canExit` stays `true` throughout (pin is a
  separate mechanical veto, not a geometric change)
- another free, unpinned arrow remains playable after a pin
- pin expires deterministically after exactly `pinDuration` further world turns
- the expired arrow becomes tappable again immediately
- target selection is deterministic (always the lowest free-and-unpinned id) and reproducible
  (identical action sequence -> identical target, on independently constructed states)
- the ability never pins the only playable arrow into a softlock
- the ability fizzles safely (no pin, no crash) when there is no valid target at all
- `key()` distinguishes an otherwise-identical state that differs only by an active pin
- `undo()` fully restores pin state, including making a previously-pinned arrow tappable again, and
  redoing the same action reproduces the identical state/key
- `checkEncounter` rejects an unknown `targetPolicy` and a non-positive `interval`/`pinDuration`
- `rock-spike.json`: the solver proves it winnable
- `rock-spike.json`: `minDamageToWin` is small, proven, and clearly survivable (not an
  unavoidable-damage grind)
- `rock-spike.json`: the winning sequence, replayed, actually reaches `won` with positive HP, and the
  ability genuinely fires at least once along that path (the spike is not vacuous)

Everything else — all 106 pre-EXP-013 tests across `board.test.ts`, `prologue.test.ts`,
`encounter.test.ts`, `combat-pressure.test.ts`, `multi-enemy.test.ts`, `attack-types.test.ts`,
`rng.test.ts`, and `property.test.ts` — is untouched and still green: **124/124** total.

## 6. Live viewer verification

New standalone debug viewer (`viewer/rock-spike.html` + `viewer/rock-spike.js`), separate from
`cp-prologue.html`/`.js` (untouched except for one added nav link). Ran via a dedicated local preview
server (port 5185, `.claude/launch.json`, chosen to not collide with the other concurrently-running
sessions' entries already in that shared file).

- Loaded `rock-spike.html`: boss box read **`HP 6/6  ATTACK IN 5  THROW IN 3`** immediately — both
  countdowns visible and clearly distinct, per the brief's viewer requirement.
- Replayed the greedy path from §4 via real DOM click events dispatched at the exact canvas
  coordinates `rsDebug.pointOf(id)` reports for each arrow (the `computer` tool's on-screen click
  coordinates didn't line up with this environment's actual viewport scale reliably enough for pixel
  clicking, so verification used dispatched `MouseEvent`s through the *same* `arrowAt`/`tap` code path
  a real click drives — not a shortcut around it).
- After turn 3: message read **exactly** `"КАМЕНЬ: #5 pinned на 2 хода"`; the panel showed
  `pinned arrows: #5 (2t)`; the screenshot showed arrow #5 rendered in a distinct rock-brown color with
  a `🪨2` marker at its head, visually unmistakable from every other arrow.
- Clicking the pinned arrow directly (`tap(5)` while pinned): player HP, enemy HP, and the ability
  countdown were all confirmed *unchanged* (`hpUnchanged`/`enemyHpUnchanged`/`countdownUnchanged` all
  `true`), and the message read **exactly** `"Стрелка #5 PINNED / BLOCKED BY ROCK — камень держит её
  ещё 2 ход(а). Это не ошибка игрока: HP не тратится, ход не идёт."`
- Finishing the full 11-turn sequence live matched the CLI/solver trace exactly:
  `won: true, playerHp: 8, enemyHp: 2`, including the second Stone Throw (`#4`, turn 6) and both
  `UNPINNED` events.
- Console/network checked at every step: no errors.

## 7. Known limitations / FOUND (not fixed, out of scope or explicitly deferred)

1. **FOUND, self-corrected within this task**: a first draft of `rock-spike.json` used `hp: 3`
   (exactly the N-side supply needed to kill the enemy). The solver's own minimum-damage path finished
   in 4 taps, before Stone Throw's `THROW IN 3` had any real chance to matter (the pin landed the same
   turn as the kill). This technically satisfied "solvable, no softlock" but did not satisfy the
   brief's actual design intent ("игрок видит хорошую свободную arrow, но моб временно выключает её").
   Fixed by raising `hp` to 6 (forcing a full board-clear-alive win, ~11 turns) — not a mechanic change,
   a content-only fix, caught and corrected before this report, not left as an open FOUND.
2. `EnemyAbility` is not modeled on `BossPhase` — only `EnemyDef` (simultaneous enemies) can carry one.
   Extending sequential boss phases to also carry abilities is a natural next step if this experiment
   is accepted, but wasn't needed for the brief's "1 обычный enemy" spike and would have added surface
   area (per-phase pin-state bookkeeping across phase transitions) with no encounter to justify it yet.
3. `targetPolicy` has exactly one implementation (`'free-arrow'`). The type/switch is structured so a
   second policy (telegraphed-specific / random-safe / longest-arrow / direction-specific, all named in
   the brief) is a new `case` in `selectAbilityTarget`, not a new field shape — but none of those are
   implemented, per the brief's explicit "сейчас НЕ реализовывать всё это."
4. The softlock guard is a simple, cheap, *local* check ("would this specific pin leave zero
   immediately-playable arrows?") — not a full forward-solvability re-check ("could the whole encounter
   still be won after this pin, several turns from now?"). For a single Stone Throw with a short
   `pinDuration` this is sufficient (and `rock-spike.json`'s own solvability is separately, exhaustively
   proven by `minDamageToWin`), but a future ability with a much longer pin, multiple simultaneous
   pins, or interaction with Rotate/board topology could in principle create a state that passes this
   local check yet is still unsolvable a few turns later. Not observed on any encounter in this repo;
   flagged as a scaling limit of the minimal guard, not a bug in it.
5. `tools/cp-shortlist.ts` (seed scanning) does not understand `ability`/pins — irrelevant here (seed
   15 was hand-picked and manually verified, not scanned), same caveat already on record from
   EXP-010b/EXP-011 for their own respective new content shapes.
6. No JSON round-trip changes were needed for `ability` (it has no `Dir` fields, so
   `encounterFromJson`/`encounterToJson`'s existing `{...en}` spreads already carry it through
   correctly) — confirmed by `rock-spike.json` loading and validating cleanly through the normal file
   pipeline, not a special case.

## 8. Scope guard — confirmed not touched

No permanent rocks, no dynamic geometry mutation, no new board shapes, no second ability, no item
system, no Act I content, no random targeting (target selection is fully deterministic, no RNG added to
combat state anywhere), no animation/art beyond a plain color + emoji marker in the debug viewer, no
physics, no generalized scripting language, no ECS, no large refactor. `BoardState`/`BoardTopology`/the
generator are byte-for-byte unchanged. The accepted prologue chain (`cp-e1..cp-e5.json`,
`viewer/cp-prologue.js`'s `STEPS`) and all EXP-011 behavior are unchanged (confirmed: 106/106
pre-existing tests still pass verbatim). No change to `docs/**` or
`.orchestra/RULES.md`/`PROJECT.md`/`GIT.md`/`LEVEL-DESIGNER.md`. No merge to `main`.

## 9. Exact run command

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/rock-spike.json --player-hp 10
node tools/serve.mjs 5185        # or any free port
# open http://localhost:<port>/viewer/rock-spike.html
```
