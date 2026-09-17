# Board-mutating enemy abilities — feasibility analysis

> ROLE: mechanics feasibility analyst. Read-only analysis — no production/core code was changed,
> no implementation was done, no mechanic was selected. This report gives engineering facts so the
> user can make the design call.

- Branch: `design/enemy-board-abilities` (analysis/design branch, separate from all `exp/` work).
- Baseline analyzed: `main` HEAD `c972cd1` = post-EXP-010b-merge, pre-EXP-011-merge.
  Verified: `spikes/arrow-core/src|tools|test` are byte-identical between `574067f` (EXP-010b
  implementation) and HEAD (`git diff 574067f HEAD` shows no changes there), so every line
  reference below matches the EXP-010b code the team already accepted.
- Sources read in full: `src/state.ts` (BoardState), `src/topology.ts` (BoardTopology),
  `src/generator.ts` (reverse-construction generator), `src/encounter.ts` + `src/encounter-solver.ts`
  (EXP-010b version), `src/level.ts` (Level/rayCells/hash), `src/solver.ts` (greedy BoardSolver,
  peelLayers), `src/verify.ts` (independent verifier), `EXP-010b-REPORT.md`, `EXP-011-REPORT.md`
  (from unmerged branch `exp/EXP-011-attack-types`, commit `570aa27`), `docs/COMBAT-RULES.md`
  (unchanged since `6b2f537` — the version read is current).
- EXP-011 caveat (moving baseline): EXP-011 adds `AttackTimer.kind: 'normal'|'cast'`,
  `interruptible`/`interruptedAttack`, plus per-phase/per-enemy `castInterrupted` booleans that are
  already part of `TimerSnapshot` and `key()`. Any mutation state below composes *additively* with
  those fields (same snapshot/restore pattern). Nothing below conflicts with EXP-011, but the
  `key()` additions in §1–§5 assume the EXP-010b `key()` as base; on an EXP-011 codebase append the
  same fields next to `castInterrupted`.

## 0. Shared vocabulary (verified, not assumed)

- **Blocking rule** (`state.ts:9-16`): arrow `id` can leave iff every cell on its straight escape
  ray (head-exclusive, to the edge) is empty. Maintained incrementally: `rayBlock[id]` = #occupied
  ray cells; `owner[cell]` = arrow id or `-1`.
- **Monotonicity** (`solver.ts:13-23`): removing an arrow only empties cells, so the free set only
  grows along any path. Consequence: greedy is complete ("stuck ⟺ unsolvable"), and `peelLayers`
  onion layers are order-independent. *Every* claim about "monotonic solvability" below is relative
  to this property.
- **Reverse-generator guarantee** (`generator.ts:43-57`): arrows are inserted in reverse removal
  order; each insertion requires the new arrow's ray to be clear of everything placed so far. The
  reversed insertion order (stored as `level.solution`) is therefore always a valid replay — *under
  the current blocking rule*. `verifyLevel` re-checks this independently of BoardState/Topology.
- **Turn/clock** (`encounter.ts`, EXP-010b): every *successful* tap ticks all alive enemies' timers
  by 1; blocked taps cost HP but tick nothing; Rotate ticks only if `def.rotate.advancesTurn`.
  "K turns" durations below are measured in this world-turn clock unless stated otherwise.
- **Win/loss** (COMBAT-RULES.md §7–8): kill all mandatory targets, *or* clear the board alive.
  Loss = player HP ≤ 0. So two distinct failure modes matter per mechanic: **puzzle-softlock**
  (no legal move, board uncleared — clock frozen) vs **combat-loss** (timers kill the player;
  quantifiable by `minDamageToWin`, not a softlock).
- **Undo** (`encounter.ts`): `log[]` of `{kind, id/hit/turn, timerBefore: TimerSnapshot}`; undo pops,
  restores timers from snapshot, calls `board.undo()`. Any new mutable state must ride in
  `TimerSnapshot` to keep this correct — the pattern already exists, it just needs extending.
- **Solver memo** (`encounter-solver.ts`): `findWin` keeps a failed-`key()` set; `minDamageToWin`
  memoizes best-cost per `key()` + reconstructs via `choice`. `BoardState.key()` covers the alive
  set only; `EncounterState.key()` adds rotation, HP/counters, timers, player HP. Any mutation
  dimension missing from `key()` produces false memo hits (wrong proven answers) — the single
  most dangerous integration bug class for all five mechanics.

Assumptions flagged per class below are load-bearing: each "answer" is conditional on the stated
reading. Where a fork exists (e.g. static vs dynamic obstacles), both variants are analyzed.

---

## 1. Temporary arrow pin

**Reading:** an enemy ability pins specific arrow ids for K world turns. A pinned arrow cannot be
tapped even if its ray is clear. Pins expire automatically as the world-turn clock advances.
Telegraphed (which arrows, how long). Expiry is clock-driven, not action-driven.

- **Structures touched:** `BoardState`: needs a pinned set + clock. Concretely `pinnedRem: Int32Array(n)`
  (remaining pin turns, 0 = unpinned) decremented on every world-turn tick, consulted in `canExit`
  (and therefore `freeArrows`, `tryRemove`). Plus a turn counter if durations are stored absolute
  (relative countdowns avoid a separate clock — see `key()`).
- **New BoardTopology?** No. Topology is geometry-only (`topology.ts:10-23`); pins are pure dynamic
  state.
- **Overlay over EncounterState?** Partially. `EncounterState.tap()` could reject pinned ids *before*
  calling `board.tryRemove`, and `freeArrows`/`wouldHit` call sites could filter through a pin map
  kept in `EncounterState`. Feasible but leaky: `tryRemove`, `canExit`, `freeArrows`,
  `firstBlocker`/`blockers` (used by traces/viewer) all need wrapping, and any missed call site
  silently plays by the old rules. BoardState-level support (one `pinnedRem` check inside `canExit`)
  is cleaner and total. Verdict: overlay is possible, BoardState-level is safer; no topology change
  either way.
- **Monotonic solvability:** weakened, not destroyed. Pins temporarily *shrink* the free set, but
  expiry only *adds* options, and every legal tap advances the expiry clock. Greedy BoardSolver is
  no longer complete as-is (it cannot "wait out" a pin except by tapping elsewhere, which may not
  exist). With a "wait" action (pass: advance clock, no board change) greedy-plus-wait stays
  complete *provided a legal tap-or-wait always exists* — true iff "no legal tap" states are given
  the wait move. Without a wait action, completeness is lost.
- **Reverse-generator assumption:** broken in general. The stored solution may schedule a pinned
  arrow exactly when it is pinned → `replayOrder` fails. Generator output stays *board*-solvable;
  the solvability guarantee must move to an encounter-aware (pin-aware) EncounterSolver, the same
  direction EXP-010 already pushed with board-clear-alive, but stronger: here even the canonical
  order can be illegal.
- **Solver complexity:** state space × pin configurations. Pin countdowns are small bounded ints;
  branching factor unchanged (taps only, plus wait if added). Memo still works with the extended
  key. Cost driver is the extra dimension in `key()`, not branching. Waiting needs a bound (waiting
  past max remaining pin duration is useless) to keep the wait self-loop finite — memo on key makes
  it terminate anyway (wait changes countdowns → new key; at all-zero countdowns wait is a no-op
  self-loop that memo prunes only if coded to skip no-op waits — must handle explicitly).
- **Undo:** yes. Snapshot `pinnedRem` (+ clock if absolute) in `TimerSnapshot`, same pattern as
  `enemyCountdown` today.
- **Softlock:** yes, possible. Hard case: all remaining arrows pinned simultaneously with no legal
  tap → clock cannot advance → frozen, board uncleared. Softer case: pins force an order that wastes
  the kill window → combat-loss (not a softlock; `minDamageToWin` quantifies it).
- **Proving absence:** two sufficient designs (prove by construction + verify by search):
  (a) ability-level invariant — never pin the *last* legal move (max simultaneously pinned ≤
  freeCount − 1), checkable per-state; or (b) add an always-legal `wait` action — then softlock is
  impossible by construction (wait advances pins to expiry), leaving only combat-loss, which the
  existing `minDamageToWin` machinery already proves bounds for. Exhaustive proof = pin-aware
  EncounterSolver over the extended space reporting no stuck states (requires wait in the action
  set to distinguish "stuck" from "dead").
- **Minimal `key()` addition:** per-arrow remaining pin turns (`pinRem[n]`, small ints). No clock
  needed with relative encoding.
- **Analyzer extension:** moderate. Static `analyzeSeed` output stays valid for the *unpinned*
  board; `hitTiming` (canonical-order timing) becomes misleading and must be replaced by
  solver-derived timing — the EXP-012 `earliestHitTurns` exhaustive pattern is directly reusable.
  `minDamageToWin` needs pin-aware state + key. No new action types if wait is solver-only.
- **Tests most at risk:** `board.test.ts` (`canExit`/`key` equality — any `key()` format change
  breaks pinned expectations), `property.test.ts` (greedy-completeness/solver-agreement/replay
  properties assume unpinned rules), `encounter.test.ts` + `combat-pressure.test.ts` (undo/snapshot
  round-trips), EXP-012 `multi-shortlist.test.ts` node-count assertions (solver search shape changes
  once pins enter the key).

## 2. Obstacle occupying cell / blocking escape ray

**Reading (two variants):** (S) *static* — obstacle cells fixed for the whole encounter (known at
generation/load); (D) *dynamic* — enemy places/removes blockers mid-fight. Both block rays exactly
like arrow bodies but are never arrows (never tapped out, never owned).

- **Structures touched:** cell occupancy encoding. Today `owner = -1` means empty and `rayBlock`
  counts non-`-1` ray cells (`state.ts:34-41`). Obstacles need a new sentinel (e.g. `-2`) or a
  parallel obstacle bitmask; `rayBlock` init must count obstacle cells; `firstBlocker`/`blockers`
  return arrow ids — obstacle hits need a representation (new code or sentinel passthrough).
  `remove()` must never free obstacle cells (it only clears its own body cells today — safe by
  construction as long as obstacle cells are never listed in any `bodyCells`).
- **New BoardTopology?** (S): effectively yes, but as an *extension*, not a new class — obstacles
  are static geometry, so they belong in `initialOwner` (sentinel) with ray precomputation
  unchanged (rays are geometric; `rayCells`/`rayByCellStart` don't care what occupies a cell).
  (D): state-level (placement changes at runtime; topology stays clean).
- **Overlay over EncounterState?** (S): no overlay needed — bake into topology at construction
  (requires a Level-format extension or a sidecar obstacle list passed to `BoardTopology.fromLevel`
  — a format decision, not a runtime one). (D): no clean overlay — mid-fight placement must mutate
  `rayBlock` (private incremental state); `EncounterState` cannot do this from outside. Requires a
  `BoardState` API (`addObstacle`/`removeObstacle` with ray propagation).
- **Monotonic solvability:** (S): preserved. Obstacle cells never empty, but they are constant, so
  along any path the free set still only grows. Greedy stays complete; `peelLayers` stays valid.
  This is the *only* class of the five that can keep the greedy proof intact. (D): broken — free
  set can shrink mid-path (walls appear). Same regime as pins from there on.
- **Reverse-generator assumption:** (S): survives *iff the generator is obstacle-aware*. Insertion
  rule "new arrow's ray clear of placed" must also require "ray clear of obstacle cells"
  (`computeClear`/`growBody` in `generator.ts` treat `occ` uniformly — obstacles would slot into
  `occ` naturally). Post-generation arbitrary obstacles break the stored solution. So: generator
  must co-design (or at least ingest) obstacle layout, or every encounter needs solver re-proof.
  (D): broken in general (same as pins).
- **Solver complexity:** (S): unchanged — same DFS, fewer initially-free cells; if anything,
  slightly *smaller* search. (D): pins-regime (state × obstacle configurations).
- **Undo:** (S): nothing to undo (constant). (D): snapshot obstacle set.
- **Softlock:** (S): provable by construction — run greedy `solveBoard` on the obstacle-aware board;
  complete-by-proof ⇒ no stuck states, exactly today's argument. (D): permanent walls can truly
  wall off all moves with *no clock remedy* (unlike pins, walls don't expire) → genuine permanent
  softlock possible. Placement constraints ("only on cells of already-removed arrows") do NOT
  suffice — live rays cross those empty cells too. Only per-encounter exhaustive solver proof, or a
  "walls expire" rule (which collapses (D) into the pin regime).
- **Proving absence:** (S): `solveBoard` green = proof (already the codebase's proof method).
  (D): exhaustive EncounterSolver proof per encounter, or expiring walls + the §1 remedies.
- **Minimal `key()` addition:** (S): none (constant). (D): obstacle cell set (bitmask over W·H, or
  sorted cell list).
- **Analyzer extension:** (S): trivial — `analyzeSeed`/`hitTiming`/EXP-012 facts all work unchanged
  through `BoardState` (they never assume *why* a cell is occupied). (D): same as pins
  (moderate–hard).
- **Tests most at risk:** `verify.ts`-backed tests (`replayOrder`/`validateLevel` assume arrows-only
  occupancy; obstacle sentinel needs threading), `board.test.ts` (`ownerAt`/`firstBlocker`/`blockers`
  expectations), `test/helpers.ts` `naiveCanExit` (brute-force cross-check must learn obstacles or
  every property test comparing against it breaks), generator tests (`levelHash` changes if the
  format gains obstacles; determinism fixtures), `property.test.ts` generator↔verifier agreement.

## 3. Destructible obstacle

**Reading:** §2(S) placement + removal. Primary variant: tapping the obstacle directly is a new
action ("bash") — costs one world turn (ticks enemy timers), deals 1 HP to the obstacle, yields no
projectile. Alternatives noted where they change the analysis (adjacency-triggered damage;
limited bash charges).

- **Structures touched:** §2(S) occupancy work + obstacle HP map (group id → hp; groups since one
  obstacle may cover several cells) + a new encounter-level action path. `BoardState` needs a
  cell-unblock API (`damageObstacle`/`clearObstacleCells` with `rayBlock`-decrement propagation —
  the same loops as `remove()`, `state.ts:146-154`) plus its inverse for undo. `EncounterAction`
  gains a variant; `TapResult` (or a sibling result type) must describe bash turns (timer ticked,
  no hit, obstacle HP delta).
- **New BoardTopology?** Same as §2(S): obstacle *layout* is static geometry (topology extension);
  obstacle *HP* is dynamic state. Spawned-mid-fight obstacles add the §2(D) state dimension.
- **Overlay over EncounterState?** Partially. HP bookkeeping + the bash action + timer tick can live
  in `EncounterState`, but unblocking cells cannot — there is currently no API to empty arbitrary
  cells (`remove()` is arrow-scoped). A new `BoardState` method is required; pure overlay is
  insufficient.
- **Monotonic solvability:** bash only ever empties cells, so arrow-removal monotonicity is
  preserved *once bash is available as a fallback*. Greedy board solver stays complete for the arrow
  part. New consideration is combat-time, not solvability: bash ticks enemy timers, so the
  *encounter* solver must weigh bash timing (aword tradeoff, not a completeness question).
- **Reverse-generator assumption:** notably *restored*. If every obstacle is bashable, the stored
  solution stays valid as a fallback order (bash through whatever blocks it) — arbitrary static
  obstacles cannot invalidate the solution, they only add turn costs. This is the strongest
  generator story of the five: verification degrades gracefully to "solution + bashes", and
  `minDamageToWin` absorbs the cost numerically. (Caveat: limited bash charges reintroduce the
  §2(D) regime — see softlock.)
- **Solver complexity:** +1 action type (bash per live obstacle). Branching +(#obstacles) at states
  where bash is useful. Termination is safe: bash strictly decreases obstacle HP (new key each
  time); at 0 HP cells free (progress); bashing rubble is impossible by construction. Memo on
  (alive, obstacle-HP, timers) prunes loops. Modest growth, no new infinity hazards with unlimited
  bash.
- **Undo:** yes. Snapshot obstacle-HP vector in `TimerSnapshot` + board-level cell-restore for the
  unblocked cells (extend `history` or a parallel obstacle-history; must interleave correctly with
  arrow undo order — order matters because `board.undo()` is LIFO on a single history stack).
- **Softlock:** none from the puzzle side with *unlimited* bash (bash terminates, arrows stay
  clearable per §2(S) argument). With *limited bash charges*: K charges vs K+1 blocking obstacles
  can strand the board → softlock returns, solver-proof required (charges in key, see below).
- **Proving absence:** unlimited bash → constructive proof (bash-all-then-greedy-solve; mechanize as
  a solver pre-pass). Limited charges → exhaustive EncounterSolver proof with charges as state.
- **Minimal `key()` addition:** obstacle HP vector (per group). Plus charges-remaining if bash is
  limited.
- **Analyzer extension:** medium. New action in solver paths (`findWin`/`minDamageToWin`/
  earliest-hit); example traces show bashes (`traceActions` format work); static pre-filters keep
  working (they under-approximate: ignore bash, still sound as necessity checks).
- **Tests most at risk:** `EncounterAction` exhaustiveness (any switch over action kinds),
  `traceActions`/report-text tests, `TapResult` shape assertions, undo-order tests (interleaved
  arrow/obstacle history), viewer input tests (clicks on non-arrow cells are currently meaningless —
  bash needs a new hit-target path in `viewer/*.js`), `attack-types`-era `enemyAttacks` text tests
  (bash turns produce a new trace line shape).

## 4. Temporarily forbidden direction

**Reading:** for K world turns, arrows facing arena direction D cannot be tapped. Primary variant:
tapping one is an illegal move (rejected, no cost — like `rotate` when charges are missing, not
like a blocked tap). Harsher variant (forbidden tap = blocked-tap damage) noted below. Open design
question flagged, not decided: **arena vs board-local direction** (with Rotate in play they differ;
`arenaDir = rotateDir(local, rot)`). Analysis assumes arena (player-facing telegraph), local only
changes which arrows the filter matches.

- **Structures touched:** tiny dynamic state: 4 small counters (`forbidRem[4]`) + clock (relative
  encoding avoids one). *No* board invariants touched — `owner`/`rayBlock`/`alive`/`history` are
  unaware the rule exists. The check needs each arrow's *arena* dir → needs `rot`, which lives in
  `EncounterState`, not `BoardState` (clean separation today: board never knows orientation).
- **New BoardTopology?** No. Nothing geometric changes.
- **Overlay over EncounterState?** Yes — best fit of the five for pure overlay. Forbid check is a
  filter over `freeArrows`/`wouldHit`/pre-`tap()` interception plus the hit-attribution paths
  (`targetIndexAt`/boss-side comparison already operate arena-side, so they compose). No
  incremental board state to keep consistent. If the harsher variant (damage on forbidden tap) is
  chosen, the damage bookkeeping still lives naturally in `EncounterState.tap()` next to
  `blockedTapDamage`. Verdict: full overlay feasible with zero `BoardState` changes — provided all
  tap entry points (`tap`, `apply`, viewer-driven calls) funnel through the filter.
- **Monotonic solvability:** same shape as pins (§1): options shrink temporarily, expiry restores
  them, clock advances on taps. Greedy incomplete without wait; complete with wait + no-stuck-states.
  Coarser granularity than pins (whole directions, not ids) — the "leave ≥1 legal move" invariant
  is easier to state, telegraph, and check (≥1 free arrow outside forbidden dirs).
- **Reverse-generator assumption:** broken in general (stored solution can schedule a forbidden-dir
  step). Same consequence as §1: board-solvable stays true, encounter-solvability needs solver
  proof. Mitigation unique to this class: forbid windows are *direction*-shaped, so a cheap
  necessary pre-filter survives (per-side supply counts — the EXP-012 demand check pattern:
  "enough total arrows of allowed dirs" stays meaningful even when timing doesn't).
- **Solver complexity:** state × 4 small counters — the smallest state blowup of the dynamic
  classes. Branching unchanged (+ wait if added). Memo straightforward.
- **Undo:** yes — snapshot 4 counters in `TimerSnapshot` (same size class as one enemy countdown).
- **Softlock:** yes, possible (all free arrows face forbidden dirs, no legal tap → frozen clock).
  Same two remedies as §1 (leave-one-legal invariant, or wait action). Note the interaction: wait
  ticks enemy timers, so wait removes *softlock* but the cost lands in HP — `minDamageToWin`
  remains the right tool; "softlock-free" and "damage-free" are different claims, do not conflate.
- **Proving absence:** same as §1 (per-state legal-move invariant, or wait + exhaustive
  no-stuck-states proof). Additionally cheap static necessary condition: at cast time, forbidden
  dirs cover < all dirs holding free arrows.
- **Minimal `key()` addition:** 4 remaining-turn counters. Smallest of all five.
- **Analyzer extension:** easiest dynamic of the five. EXP-012 already computes exhaustive
  per-side earliest-hit (`earliestHitTurns`) — the exact primitive this mechanic perturbs; extend it
  with 4 counters (cheap). `minDamageToWin` key +4 ints. Static supply pre-filters keep working.
- **Tests most at risk:** direction-dependent helpers (`wouldHit`, `aliveByArenaDir`, arena-dir
  trace lines in `traceActions` — a tap can now be *legal-board / illegal-encounter*, a new
  rejection reason the tests never exercise), combat-pressure trace/golden tests, Rotate tests (the
  arena-vs-local decision changes expectations — must be settled before touching them), viewer
  side panel (needs a "forbidden" telegraph) and arrow gray-out rendering.

## 5. Arrow direction mutation

**Reading:** an enemy changes an arrow's direction (e.g. N→E) — its escape ray AND its projectile
side change; body cells stay put. Variants: permanent vs revert-after-K-turns. Analysis covers
both; where they differ it is stated.

- **Structures touched:** the effective-direction mapping + `rayBlock` consistency. `topo.dirs`
  cannot simply be mutated: `BoardTopology` is *shared* across states/clones (`state.ts:59`,
  `topology.ts:5-9` — sharing is the documented reason clones are cheap). Per-state effective dirs
  are required: sparse override map (`id → dir`) or a per-state dir vector, consulted wherever
  `topo.dirs` is read (`canExit` is ray-based so it follows automatically *once `rayBlock` is
  patched*; `arenaDir`, `wouldHit`, `aliveByArenaDir`, analyzer code read dirs directly).
  On mutate/unmutate, the arrow's own `rayBlock` must be recomputed from the `owner` grid against
  the new ray (O(ray length) — negligible at W·H ≤ 168). Other arrows' `rayBlock`s are untouched
  (mutated arrow's *body* didn't move, so their rays see the same occupancy). `firstBlocker`/
  `blockers` follow automatically (they walk the geometric ray from `topo.rayCells` — note: the
  walk must use the *effective* dir's ray, i.e. either all-dir ray tables in topology or on-the-fly
  `rayCells()` from `level.ts:34-44`).
- **New BoardTopology?** No new class. Two implementation shapes, both inside existing classes:
  (a) precompute rays for all 4 dirs per arrow (4× ray memory — still tiny), or (b) compute
  `rayCells()` on the fly per mutation (simpler, costs microseconds). Either way `BoardState` gains
  effective-dir state; topology stays the shared immutable geometry source.
- **Overlay over EncounterState?** No clean overlay. The free set itself changes (new rays unblock
  some arrows and block others) — that is `rayBlock`/`canExit` internals, unreachable from outside
  `BoardState`. Requires a `BoardState` change (effective dirs + rayBlock patch). Deepest
  board-layer change of the five.
- **Monotonic solvability:** strongly broken — the only class here that breaks it *both ways,
  permanently*. Mutation can free arrows (fine) and *re-block* previously free ones (fatal to
  greediness), with no expiry remedy in the permanent variant. `peelLayers` becomes meaningless
  mid-mutation (layers are order-independent only under fixed topology). Even temporary mutation
  breaks layer analysis during its window, and removals made under mutated rays need not be legal
  under original rays, so revert does not trivially restore the pre-mutation solvability argument.
- **Reverse-generator assumption:** broken in general, both variants. Stored solution assumes fixed
  dirs/rays. Encounter-aware re-validation always required; no fallback order survives arbitrary
  mutation (unlike §3's bash, there is no universal "push through" action).
- **Solver complexity:** branching unchanged (taps only), but the state space multiplies by
  dir-configurations (4^k for k simultaneously-mutated arrows; typically 1 → ~×4) AND — worse —
  *all* static precomputation dies: `hitTiming`, `layerDirs`, `firstLayerByDir`,
  `aliveByArenaDir` caches, EXP-012 supply pre-filters become path-dependent. Mutation events are
  enemy-clock-driven (deterministic given a path — reproducible in search), so exhaustive search
  stays *correct*; it just loses every cheap prune the codebase currently enjoys. Highest solver
  cost of the five in practice, via lost prunes rather than branching.
- **Undo:** yes. Snapshot the override map + recompute (or restore) the patched `rayBlock` entries.
  Simplest correct: on undo, restore old dir and recompute that arrow's `rayBlock` from the owner
  grid (owner grid needs no repair — bodies never move).
- **Softlock:** yes — and this is the *only* class that can turn a solvable board *permanently*
  unsolvable with no clock remedy: mutation can create ray cycles (A blocks B blocks A) that never
  existed. Revert-variants still softlock *within* the window (frozen clock if zero legal taps and
  no wait action).
- **Proving absence:** strongest implementable strategy of the five, unique to this class: **gate
  every mutation (and every revert) through greedy `solveBoard` under the resulting rules from the
  current alive set** — O(total body + ray length), microseconds, cheap enough to run in production
  at every mutation event, not just in analysis. Gate = "enemy mutates only into still-solvable
  boards". Between gated events, arrow removals only empty cells, so solvability under the *current*
  rules is preserved; the next gate re-proves under the next rules. Exhaustive EncounterSolver proof
  remains the alternative (stronger claim: covers combat-loss too; more expensive).
- **Minimal `key()` addition:** effective dirs of mutated arrows — sparse `id → dir` map, or a full
  `n`-byte vector (n ≤ ~40, simplest). Revert-timers too if temporary (per-arrow remaining turns,
  same encoding as §1 pins).
- **Analyzer extension:** hardest of the five. All static analysis (`analyzeSeed` steps,
  `dirSequence`, `branchPoints`, `layerDirs`, `hitTiming`, EXP-012 demand prefilters) becomes
  order-and-mutation-path-dependent. Only fully encounter-aware exhaustive search (the EXP-012
  `earliestHitTurns`/`minDamageToWin` pattern, extended with mutation events) stays sound. Static
  pre-filters lose nearly all power.
- **Tests most at risk:** the widest blast radius — *everything board-level*: `board.test.ts`
  (`canExit`/`key`/`clone`/rayBlock invariants), `property.test.ts` (`naiveCanExit` in
  `test/helpers.ts` reads `level` dirs — must thread effective dirs through every cross-check),
  topology-sharing tests (mutation must never leak across `clone()`s sharing one topology — a new
  aliasing-hazard test would be mandatory), `arenaDir`/`wouldHit`/`aliveByArenaDir` encounter
  tests, `levelHash` (hash covers dirs — mutated dirs must NOT feed the hash, or encounter-file
  drift checks in `encounterFromJson` false-positive), `verify.ts` (`validateLevel` requires
  dir-matches-last-segment — mutated dirs violate it; verifier must use base dirs — document the
  split explicitly).

---

## 6. Comparative table

Effort/risk ordering is by *engineering cost to prototype safely* (state size, proof burden, blast
radius) — it is **not a game-design pick** and says nothing about which mechanic is more fun.
` Generator impact` = what happens to the reverse-construction guarantee. `Softlock risk` = can the
*puzzle* freeze with no legal move (combat-loss is separate and always quantifiable via
`minDamageToWin`).

| Mechanic | Runtime complexity (per tap) | Solver complexity | Generator impact | Softlock risk | Viewer complexity | Prototype-effort order¹ |
|---|---|---|---|---|---|---|
| 4. Forbidden direction (temporary) | O(1): 4 counters tick + arena-dir filter | state × 4 small counters; branching unchanged (+wait) | stored solution can be illegal → needs solver proof; supply pre-filters survive | possible (all moves forbidden); cured by leave-one-legal invariant or wait | low: side telegraph + gray-out dirs | 1st (cheapest) |
| 2S. Static obstacle | O(1): same incremental loops, denser board | unchanged (slightly smaller search) | survives iff generator is obstacle-aware (`occ`-level change); else solver proof | none — greedy `solveBoard` green = proof | low: render blocked cells | 2nd |
| 1. Temporary pin | O(1): countdown tick + `canExit` check | state × pin-countdowns; branching unchanged (+wait) | stored solution can be illegal → needs solver proof | possible (all pinned, frozen clock); same cures as 4 | low–med: per-arrow badge + countdown | 3rd |
| 3. Destructible obstacle | O(1) + O(ray) on bash (same loops as `remove`) | +1 action type (bash per obstacle); modest branching growth; terminates | *restored*: bash-all fallback keeps stored solution valid; cost absorbed by `minDamageToWin` | none with unlimited bash (constructive proof); returns with limited charges | med: obstacle HP pips + new click-target path (non-arrow cells) | 4th |
| 2D. Dynamic obstacle (placed mid-fight) | O(ray) on place/remove | pins-regime × obstacle configurations | broken in general → solver proof per encounter | **high**: permanent walls, no clock remedy; needs exhaustive proof or expiring walls (= pin regime) | med: spawn telegraph + animation | 5th |
| 5. Direction mutation | O(ray length) on mutate/revert (recompute one `rayBlock`) | branching same, but ×4^k configs AND all static prunes die (worst practical cost) | broken in general, always needs re-proof; no fallback order exists | **highest**: can create permanent ray cycles on a solvable board | med: re-render head + ray preview; high *readability* risk (arrow shows N, flies E) | 6th (last) |

¹ "Prototype-effort order" answers "what is cheapest to prototype *safely*" (implementation +
proof + test blast radius), not "what should the game include". No mechanic is selected here.

Two cross-cutting facts the table compresses:

- **Key-size ladder** (memo memory + false-hit risk if skipped): 2S: +0 → 4: +4 ints → 1: +n small
  ints → 3: +obstacle-HP vector (+charges) → 2D: +cell bitmask → 5: +dir vector (+revert timers).
  The EXP-011 precedent (`castInterrupted` booleans into snapshot + key) is the template for all of
  them.
- **Undo ladder:** all feasible via the existing `TimerSnapshot` pattern; §3 additionally needs an
  interleaved board-history entry (LIFO order with arrow undos); §5 needs `rayBlock` recompute on
  undo (cheap, no owner-grid repair needed since bodies never move).

## 7. What this report deliberately does not do

No mechanic selected, no numbers tuned, no `docs/` rule changed, no code written. Open design
questions found during analysis (for the user, not decided here): arena-vs-local direction for §4
under Rotate; whether forbidden taps (§4) cost HP; bash targeting shape and charges (§3);
permanent vs reverting mutation (§5); whether a `wait` action is an acceptable explicit rule (it is
currently *not* a rule — COMBAT-RULES.md §12 lists turn-cost questions as OPEN, and wait would join
that list). The `wait` action appears above purely as a proof device: every "cured by wait" claim
is conditional on wait becoming an explicit, user-approved rule.
