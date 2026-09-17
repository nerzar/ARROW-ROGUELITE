# EXP-010b — Multi-Enemy Combat Pressure

> Overnight follow-up to EXP-010 (`spikes/arrow-core/EXP-010-REPORT.md`), run by Claude Sonnet 5
> without user supervision, per the user's explicit overnight brief. No game-design decision is
> claimed as final here beyond what the brief itself specified; provisional numbers stay provisional.

## 0. What was done

1. Cherry-picked EXP-010's implementation commit (`4881ab9`) onto a fresh `main` (post EXP-010's own
   corrected `docs/COMBAT-RULES.md`, plus the new `docs/BALANCE-SYSTEM.md` and
   `.orchestra/LEVEL-DESIGNER.md`) on a new branch, `exp/EXP-010b-multi-enemy`. Clean cherry-pick, no
   conflicts.
2. Added `EncounterDef.enemies` — a second, independent encounter shape alongside the existing
   `EncounterDef.boss.phases` — for simultaneous regular enemies, each with its own side/HP/attack
   timer, ticking and attacking independently of one another and of the board's puzzle state.
3. Replaced Encounter 4 entirely: the old single-target seed 1638 (6 unavoidable damage by design)
   is gone, per the brief's explicit instruction. The new E4 (seed 10, two simultaneous enemies)
   proves a **0-damage** clean path exists, and demonstrates the intended "priority, not direction"
   lesson via a natural wrong-priority path that costs 2 HP.
4. Extended `minDamageToWin`/`validateEncounter`/`traceActions` to understand both encounter shapes.
5. Extended `viewer/cp-prologue.html` to render N independent enemies (own HP bar, own `ATTACK IN N`,
   own position, own dead state, own hit-flash), verified live in-browser.
6. Added 15 new engine/content tests (`test/multi-enemy.test.ts`) plus one existing EXP-010 test
   rewritten to match E4's new (0-damage) reality. Full suite: **93/93 green** (78 pre-existing +
   15 new; zero regressions in the untouched boss-mode path, which still backs E1/E2/E3/E5 unchanged).
7. Did **not** touch E1, E2, E3, or E5's content, and did **not** rebalance the mini-boss even though
   re-verifying it under the new (0-damage) E4 revealed it still needs exactly 1 unavoidable point of
   damage — see §6 FOUND. Did not merge to `main`.

## 1. Data model: `enemies` vs `boss.phases`

`spikes/arrow-core/src/encounter.ts` now supports two mutually exclusive encounter shapes, checked in
`checkEncounter` (exactly one of `boss`/`enemies` must be present):

- **`boss: { phases: BossPhase[] }`** — unchanged EXP-008/009/010 code, moved verbatim into a private
  `tapBoss()`/`advanceTurn()` path. Sequential: one active target at a time, side may change on a
  phase transition, phase transitions may grant Rotate. Still backs E1, E2, E3, and E5 (seed 1571).
- **`enemies: EnemyDef[]`** (new) — simultaneous: every enemy exists and can attack from encounter
  start. Each has independent `hp`, `attackTimer` (interval/damage/optional interrupt), and
  `mandatory` (default `true`). New private `tapEnemies()`/`advanceEnemiesTurn()` path.

Rules implemented, per the brief and consistent with `docs/COMBAT-RULES.md`:

- A projectile hitting side X only damages the alive enemy standing on side X (if any); enemies on
  other sides are untouched by that hit.
- **Every legal (non-blocked) tap ticks every currently-alive enemy's attack timer by one**, whether
  or not that tap's hit landed on that particular enemy — this is what lets two independent clocks
  threaten the player at once.
- Two enemies can reach 0 on the same tap and both attack; damage is summed onto the player, and the
  result (`TapResult.enemyAttacks: {id, damage}[]`) reports each attack individually so the UI/trace
  can say *which* enemy hit, not just a combined number.
- Killing an enemy stops **only its own** timer, immediately, including the same turn it dies (its hp
  is already 0 by the time that turn's tick loop runs, so a dead enemy is simply skipped — no special
  case needed). Other enemies keep ticking and can still attack that same turn.
- **Win**: all *mandatory* enemies dead (an enemy explicitly marked `mandatory: false` never blocks a
  win by itself) **or** the board is fully cleared while the player is alive — the exact same
  two-path win rule as boss mode, generalized to "every enemy that matters is dead" instead of "the
  one target is dead". Verified with a dedicated test where the board clears alive while *both*
  enemies (mandatory, untouched-to-death) are still standing.
- **Loss**: player HP ≤ 0, same as always.
- Blocked taps behave identically to boss mode: HP cost, zero timer ticks, for either encounter shape.
- `rotateCharges` gets a new source for `enemies` mode: an optional flat `EncounterDef.rotateCharges`
  (no phases to grant charges from). Unused by E4 (which forbids Rotate per the brief), included for
  architectural completeness/future encounters.

`EncounterState.enemies` is a new public getter exposing each enemy's live `{id, side, hp, hpMax,
dead, countdown, mandatory, label}` — the multi-enemy equivalent of `hp`/`totalHp`/`bossSide` for the
single-target case, and what the viewer/analyzer read to render/reason about the fight.

Everything under `boss.phases` — including `bossSide`, `phaseIndex`, `phaseHpLeft`,
`grantedUpToPhase` — is untouched and only ever called from the boss-mode code paths, so E1/E2/E3/E5
are byte-for-byte the same encounters they were before this task, just running on old code that
happens to now live inside a `tapBoss()` method instead of directly inside `tap()`.

## 2. Files changed

- `src/encounter.ts` — `EnemyDef`, `EncounterDef.enemies`/`.rotateCharges`, `TapResult.enemyAttacks`,
  `EncounterState.enemies` getter, `tapBoss`/`tapEnemies`/`advanceEnemiesTurn`, mode-aware
  `won`/`hp`/`hits`/`wouldHit`/`rotateCharges`/`key`/`undo`/timer snapshot, `checkEncounter` XOR
  validation, JSON round-trip for `enemies`.
- `src/encounter-solver.ts` — `validateEncounter`/`traceActions` describe either shape;
  `probePhase2` explicitly guarded as boss-mode-only (throws if called on an `enemies` def — it is
  never called on one in this repo).
- `encounters/cp-e4.json` — replaced (seed 1638 single-target → seed 10 two-enemy).
- `encounters/cp-e4-shortlist.json` — **removed** (described the old, now-deleted seed-1638 design;
  keeping it would have been a stale, misleading artifact).
- `tools/cli.ts` — `cp-shortlist` restricted to `--step 3` (E4 is no longer scanner-generated content;
  HELP text and `CP_STEPS` updated to say so explicitly rather than silently keep a dead code path).
- `test/multi-enemy.test.ts` — new, 15 tests (full list in §5).
- `test/combat-pressure.test.ts` — one test rewritten: the old EXP-010 assertion "cp-e4 damage is
  intentional, not 0" is no longer true by design and has been replaced with "cp-e4 has a proven
  0-damage path", pointing at the new file for full coverage.
- `viewer/cp-prologue.js` — `drawEnemies()` (new, parallel to `drawBoss()`), `isLiveTargetSide()`
  helper shared by `drawSides`/`drawArrow`/`renderPanel`, per-enemy hit-flash tracking, enemies-aware
  status panel and intro message, `enemyAttacks`-aware attack text, and a `window.cpDebug.jumpTo()`
  debug hook (jumps `RunState` to a step **and** refreshes the module's board/def, unlike calling
  `run.debugJumpTo()` alone) used to drive the automated playtest below.
- `README.md` — EXP-010b command block and file-table rows.

## 3. Encounter 4: exact verified paths (seed 10, easy 6×7, 10 arrows: N3 E5 S1 W1)

Board facts (from `analyzeSeed`): id0 (E), id3 (N), id6 (S), id9 (W) are all free at encounter start;
tapping id3 additionally frees id2 (E) and id5 (N).

**Clean path (proven `minDamageToWin = 0`, 4 taps):**

```
tap id0  E→E  HIT   grunt_e 2->1
tap id3  N→N  HIT   grunt_n 2->1  (unlocks id2, id5)
tap id2  E→E  HIT   grunt_e 1->0  DEAD (dies same turn it would tick to 0 -- no retaliation)
tap id5  N→N  HIT   grunt_n 1->0  DEAD -> immediate WIN, 0 damage
```

**Natural wrong-priority path (verified, costs 2 HP):**

```
tap id3  N→N  HIT   grunt_n 2->1
tap id5  N→N  HIT   grunt_n 1->0  DEAD  (grunt_e untouched, now ATTACK IN 1)
tap id6  S→S  miss                ENEMY ATTACK: grunt_e -2 (any 3rd legal tap ticks it to 0)
```

Both paths were verified twice: once via `traceActions`/`minDamageToWin` (`npm run cli -- encounter
encounters/cp-e4.json --player-hp 10`) and again by clicking through the live viewer (see §7).

Backup candidate kept for a future shortlist if seed 10 plays badly in a real playtest: **seed 112**
(not implemented, per the brief). **Seed 3 was explicitly excluded** per the brief and never used.

## 4. Full prologue: `minDamageToWin` at 10 (max) entry HP

| Encounter | Shape | minDamageToWin | Notes |
|---|---|---:|---|
| E1 (seed 3874) | boss, 1 target | **0** | unchanged from EXP-010 |
| E2 (seed 300) | boss, 1 target | **0** | unchanged from EXP-010 |
| E3 (seed 522) | boss, 1 target, timer | **0** | unchanged from EXP-010 |
| E4 (seed 10) | **enemies, 2 simultaneous** | **0** | redesigned this task (was 6, EXP-010) |
| E5 (seed 1571) | boss, 2 phases, Rotate | **1** | unchanged file; see §6 FOUND |

A perfect player now enters E5 with the *full* 10/10 HP (E1-E4 all proven 0-damage), and the best
possible finish of the whole prologue is **9/10 HP** (E5's own proven 1 unavoidable point of damage).
This is a meaningfully different HP budget than EXP-010's original chain (which forced 6 damage
through E4 alone, entering E5 at 4/10) — see §6 for why this does not silently break E5.

## 5. Tests (`test/multi-enemy.test.ts`, 15 new; `test/combat-pressure.test.ts`, 1 rewritten)

- independent HP for two enemies (E hit only reduces E enemy's hp; N enemy's hp and *both* countdowns
  still tick)
- independent timers, confirmed both directions (N hit only reduces N enemy's hp)
- two enemies can attack the same turn; damage is summed (`enemyDamage`) and reported per-enemy
  (`enemyAttacks`)
- killing one enemy stops only its own attacks, immediately, even the turn it dies; the survivor
  keeps ticking and can attack that same turn
- a dead enemy stays silent on all later turns while the survivor keeps attacking on its own clock
- all mandatory enemies dead → immediate win, even with arrows left on the board
- board cleared while alive → win, even with every enemy (mandatory) still alive
- blocked tap costs HP but ticks no enemy timer
- `checkEncounter` rejects a def with neither `boss` nor `enemies`, and one with both
- cp-e4.json: the clean 4-tap path wins with 0 damage
- cp-e4.json: `minDamageToWin` proves a 0-damage path exists
- cp-e4.json: the natural wrong-priority path costs exactly 2 HP from the correct enemy
- E1-E4 all have a proven 0-damage path (single parametrized test over all four files)
- E5 is proven to require exactly 1 unavoidable damage — documented FOUND, deliberately not "fixed"
- (rewritten) cp-e4 in `combat-pressure.test.ts`: now asserts the 0-damage path instead of the old
  "damage is intentional" claim, which stopped being true when E4 was redesigned

Everything else — 78 pre-existing tests across `board.test.ts`, `prologue.test.ts`,
`encounter.test.ts`, `rng.test.ts`, `property.test.ts`, and the rest of `combat-pressure.test.ts` —
is untouched and still green, confirming the boss-mode path (E1/E2/E3/E5, and the EXP-008/009 gray
prologue) has zero behavioral change.

## 6. FOUND: E5 (mini-boss) still needs 1 unavoidable point of damage

Per the brief: *"если Encounter 5 сейчас не имеет clean path после корректной модели: не начинай сам
балансировать его до победного... зафиксируй FOUND"*. Re-ran `minDamageToWin` against the **unchanged**
`cp-e5.json` at the new, more generous entry HP (10, vs. EXP-010's assumed 4):

```
no-damage path exists:         NO (min damage 1)
min unavoidable player damage: 1   nodes 204750
```

**Why:** phase 1 (side E, 4 hp, `ATTACK IN 6`) is provably clean — 4 hits fit inside 6 turns with room
to spare. Phase 2 (side N, 5 hp, `ATTACK IN 3`, fresh window on phase change) is the problem: even
with a Rotate spent first (free, `advancesTurn: false`) and every following tap landing a hit, only 2
hits land before the countdown reaches 0 (turns 2-3 of the fresh window), because only one N-side
arrow is reliably available per turn immediately after the rotate on this board. The 3rd hit's turn
is exactly when the timer fires, 2 turns before the 5th (killing) hit. This is a property of the
board/phase-2 timing, independent of how much HP the player has entering the fight (as long as they
have enough to survive the one hit) — which is why it did not change when E4 stopped forcing 6 damage.

**Winning path (unavoidable-damage-minimizing), for reference:**

```
1-5: E-side hits (phase 1, clean, 4 turns, one miss)      -> phase 2, boss on N, +1 Rotate
6:   miss (a turn spent before rotating)
7:   rotate ccw
8-9: N-side hits (turns 2-3 of the fresh phase-2 window)  -> turn 3's tick fires -> -1 hp
10-12: remaining N-side hits                               -> WIN
```

**Minimal tuning options that would remove this 1-damage floor** (not applied — game-design decision,
requires user approval):
1. Loosen phase 2's `attackTimer.interval` from 3 to 4 (gives one more turn before the first attack).
2. Grant the phase-2 Rotate a "fresh window" that also skips one *tick*, not just resets the interval
   (i.e., the first post-rotate turn doesn't count against the countdown) — a new, explicit rule,
   not implied by any current `docs/COMBAT-RULES.md` wording.
3. Reduce phase 2's `hpUnits` from 5 to 4 (fewer hits needed inside the same window).
4. Accept 1 unavoidable damage as a deliberate "the mini-boss is not perfectly clean, and that's fine"
   design decision — `docs/COMBAT-RULES.md` requires the prologue to allow finishing *alive*, not
   necessarily always at 0 cumulative damage; re-reading `.orchestra/LEVEL-DESIGNER.md` §7, the
   stated prologue rule is "no *unavoidable* damage" for the encounters generally, and this is the one
   place in the current five where that isn't literally true — worth a direct user call, not a
   silent fix.

None of these four options has been applied. `cp-e5.json` is byte-for-byte unchanged from EXP-010.

## 7. Live viewer verification

Ran via this session's own preview server (a separate Claude Code session already had port 5177
bound to a stale worktree, so `.claude/launch.json` gained a fourth entry, `exp-010b-multi-enemy-
viewer`, on port 5181 — local-only, git-excluded, does not affect anyone else's setup):

- **Full clean run E1 → E5**: played E1 (puzzle-miss then kill), E2 (blocked-tap-aware clear), E3
  (greedy-hit clear), E4 (clean 4-tap path) via real clicks on the canvas; arrived at E5 with **10/10
  HP** (confirming §4's table live, not just via the CLI).
- **E4 clean path**: clicked id0→id3→id2→id5; panel showed `grunt_e`/`grunt_n` HP ticking down
  independently, `slow: убит` appearing the instant grunt_n died, final state `won: true`, `playerHp:
  10`.
- **E4 wrong-priority path**: reloaded to E4 (via the new `cpDebug.jumpTo(3)` hook, full HP per its
  documented reset-on-jump limitation, inherited from EXP-010's `debugJumpTo`), clicked id3→id5→id6;
  message read `#6 ↓ мимо · HP целей 2/4 · ВРАГ АТАКУЕТ: grunt_e -2 (HP игрока 8)`, panel showed
  `urgent: HP 2/2, ATTACK IN 3` (still alive, still ticking) next to `slow: убит` — exactly the
  intended "which enemy hit you, and why the other is still dangerous" readability.
- Fixed one real cosmetic bug found during this pass: the enemy label (`en.label`, e.g. "urgent")
  was rendered on-canvas next to the live `HP`/`ATTACK IN` text and got clipped at the pane's narrow
  width. The original single-target `drawBoss` never rendered `phase.label` on-canvas at all (only in
  the side panel) — `drawEnemies` now matches that convention, fixing the clipping at the root instead
  of just shrinking the font.
- Console and network checks: no errors at any point across the run.

## 8. Known limitations (not fixed, out of scope or explicitly deferred)

- At most one enemy per side is assumed (`targetIndexAt` returns the *first* alive match) — matches
  the brief ("если на одной стороне одна target — всё однозначно... targeting UI не нужен"). Two
  enemies sharing a side would silently only ever have the first (array order) one targetable; no
  encounter in this repo does this.
- The debug `cpDebug.jumpTo()` / the existing seed-candidate dropdown both still reset HP to max, same
  documented limitation as EXP-010's `RunState.debugJumpTo` — a real playthrough never swaps boards or
  jumps steps mid-run, so this only affects manual/automated debugging, not the real game loop.
- `tools/cp-shortlist.ts` (the seed-scanning engine) still only understands single-target `boss`-shape
  encounters; it was not extended for multi-enemy search, since E4 was hand-authored per the brief and
  no other current or planned encounter needs a multi-enemy shortlist yet. Extending it is a
  reasonably small follow-up if a future multi-enemy encounter needs seed scanning.
- E5's 1-point unavoidable-damage floor (§6) is unresolved, on purpose, pending user decision.

## 9. Scope guard — confirmed not touched

No items/Bow/weapons/relics/economy/ads/rewards/Act I/art/Phaser/production rewrite/procedural
encounter generation/new targeting UI/large cosmetic refactor. No caster archetype. No change to
`docs/**` beyond what already arrived via the corrected `main` (not authored by this task). No change
to `.orchestra/RULES.md`/`PROJECT.md`/`GIT.md`/`LEVEL-DESIGNER.md`. No merge to `main`.

## 10. Exact run command

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/cp-e4.json --player-hp 10
npm run cli -- encounter encounters/cp-e5.json --player-hp 10
node tools/serve.mjs 5180        # or any free port; npm run viewer defaults to 5177
# open http://localhost:<port>/viewer/cp-prologue.html
```
