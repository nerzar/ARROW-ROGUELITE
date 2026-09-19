import { type Dir, DIR_NAMES, rotateDir } from './dir.js'
import { generateLevel } from './generator.js'
import { type Arrow, type Level, levelHash, rayCells } from './level.js'
import { PRESETS, type PresetName } from './presets.js'
import { type Inventory, type ItemAction, type ItemId, ITEMS, itemNeedsTarget, itemIsPassive, type RelicId } from './items.js'
import { DX, DY } from './dir.js'
import { BoardState } from './state.js'
import { BoardTopology } from './topology.js'

/**
 * EXP-008 spike: the narrow scripted encounter of the prologue mini-boss. Deliberately not a general
 * combat system — one boss, one target side at a time, 1 arrow hit = 1 hit-unit, phases switch by
 * HP, a phase may grant Rotate charges, Rotate turns the whole board by 90°.
 *
 * EXP-010 adds the combat-pressure layer on top, per docs/COMBAT-RULES.md: the player has HP, a
 * blocked tap can cost HP (but is not a turn), and a boss phase may carry an `attackTimer` that
 * counts down every turn and hits the player at zero. A landed hit only damages the target — it
 * does NOT reset/delay the attack timer unless `attackTimer.interruptOnHit` is explicitly set
 * (docs/COMBAT-RULES.md 5: interrupt is an opt-in per-encounter rule, never a default). None of
 * this is a game-design decision by itself — every number lives in encounter-file data
 * (`blockedTapDamage`, `attackTimer.*`), not hardcoded here, and `rotate.advancesTurn` is an
 * explicit, provisional per-encounter switch, not a hardwired answer to "does Rotate cost a turn"
 * (still OPEN per docs/COMBAT-RULES.md 12). An encounter also has two standard win paths
 * (docs/COMBAT-RULES.md 8): the target is killed, or the board is fully cleared while the player is
 * still alive — running out of useful arrows against a live target is *not* an automatic loss.
 *
 * EXP-010b adds a second, independent encounter shape: `def.enemies` — simultaneous regular enemies,
 * each with its own side/HP/attackTimer, instead of one sequential `def.boss.phases` target. An
 * `EncounterDef` has exactly one of `boss` or `enemies` (checked in `checkEncounter`); which one is
 * present picks the whole state-machine branch (`tapBoss`/`tapEnemies`, etc). This is deliberately
 * NOT a merge of the two models: sequential boss phases (single target, side changes on phase
 * transition, Rotate-gated) and simultaneous enemies (independent per-enemy HP/timer, no phases) are
 * different concepts per docs/LEVEL-DESIGNER.md's brief, and forcing them into one representation
 * would have made both harder to reason about for little gain at this spike's scale (at most a
 * couple of simultaneous enemies). The boss branch is untouched EXP-010 code, moved verbatim into
 * `tapBoss`/`advanceTurn`; all EXP-008/009/010 encounters (including the seed-1571 mini-boss) keep
 * using it exactly as before.
 *
 * EXP-011 adds an attack *type* to `AttackTimer`, orthogonal to boss-mode vs enemies-mode:
 * `kind: 'normal' | 'cast'`. A `normal` attack is unchanged EXP-010 behaviour (a landed hit deals its
 * damage and never touches the timer). A `cast` attack telegraphs the same way but, when
 * `interruptible` is set, a landed hit while it is armed interrupts it: the cast's own damage never
 * fires, and the attacker's *next* attack becomes `interruptedAttack` (by convention a `normal`
 * attack with its own interval/damage) — a type change, not a numeric bonus to the cast's countdown
 * and not a full reset back into another cast. An uninterruptible cast (`interruptible` absent/false)
 * behaves exactly like a `normal` timer that merely displays as "CAST IN N" — hits do not touch it.
 * This is the general mechanism the brief asks for regular Caster enemies to reuse later; the
 * mini-boss's phase 2 (`encounters/cp-e5.json`) is simply the first `AttackTimer` to set it.
 *
 * EXP-013 (experiment, not an accepted design decision) adds a second, independent per-enemy clock —
 * `EnemyDef.ability` — and lets it change the *puzzle board's availability*, not just deal damage.
 * The one concrete ability implemented is Stone Throw: on its own `THROW IN N` countdown (ticks on
 * every legal world turn, alongside but independent of `attackTimer`), it deterministically picks one
 * currently free-and-unpinned arrow (`targetPolicy: 'free-arrow'`, lowest id, only when at least
 * `pinDuration` other playable arrows remain — see `selectAbilityTarget`) and pins it for `pinDuration` further world turns: a pinned arrow
 * cannot be tapped (no HP cost, no turn spent, no timer movement — this is not a player mistake), its
 * geometry and blocking behaviour are completely unchanged, and it becomes tappable again once its pin
 * expires. `BoardState` (`src/state.ts`) is not touched by this at all and stays pure geometric truth
 * (`canExit`/`freeArrows`); `EncounterState` adds pin state as a temporary availability overlay on top
 * — `playableArrows()` is `board.freeArrows()` minus whatever is currently pinned, and is what the
 * solver/`wouldHit` use instead of `board.freeArrows()` directly. See EXP-013-REPORT.md for the full
 * turn-order rationale (existing pins tick/expire *before* a new one can be created the same turn) and
 * the no-softlock argument.
 *
 * COMBAT-001 keeps the same per-enemy countdown machinery but stops treating Stone Throw as the
 * only possible `EnemyAbility`: the ability is now a minimal discriminated union (`stone_throw` |
 * `shield`, see `abilityKind`) with one tiny handler path per kind. The second kind, Shield, is a
 * debug/framework proof, NOT accepted Act I content: on its own countdown the enemy raises a
 * one-shot shield, the next projectile hit on that enemy is absorbed (no HP damage, no interrupt)
 * and the shield drops. Attack timers are untouched by either ability.
 */

/**
 * Fallback starting HP for callers that do not care about combat pressure (old tests, a board-only
 * `EncounterState.fromLevel(level, def)` call). Not a balance number: real runs always get an
 * explicit `playerHp` from RunState's data-driven `playerMaxHp`. Large enough that blockedTapDamage/
 * attackTimer values used anywhere in this repo cannot exhaust it by accident.
 */
export const DEFAULT_PLAYER_HP = 9999

/** +1 = 90° clockwise, -1 = 90° counter-clockwise. */
export type Turn = 1 | -1

/** EXP-011: what an `AttackTimer` currently telegraphs as. Default `'normal'` if `kind` is absent. */
export type AttackKind = 'normal' | 'cast'

/**
 * Enemy `ATTACK IN N` / `CAST IN N` telegraph. Ticks down by one every turn regardless of hit/miss
 * and hits the player at 0, then resets. A landed hit deals its damage to the target and nothing else
 * UNLESS one of the two independent opt-ins below fires:
 *
 * - `interruptOnHit` (EXP-010, legacy): N hits in the cycle reset THIS SAME countdown to `interval`
 *   without changing `kind`. Off by default, not used by any EXP-011 content; kept only because
 *   docs/COMBAT-RULES.md 5 lists "Tank needs 2 hits to interrupt" as a possible future rule shape.
 * - `kind: 'cast'` + `interruptible` (EXP-011): a landed hit while the cast is armed cancels it —
 *   its damage never fires — and the attacker's next attack becomes `interruptedAttack` instead of
 *   this same cast continuing or resetting. This is a *type* change, not a timer bonus: see the
 *   module doc comment above.
 */
export interface AttackTimer {
  /** Turns between attacks; the countdown resets to this value after every attack or interrupt. */
  interval: number
  /** Player HP lost when the countdown reaches 0. */
  damage: number
  /** Opt-in: a landed hit interrupts (resets) the countdown instead of just letting it tick down. */
  interruptOnHit?: boolean
  /** Hits needed in the current cycle to interrupt, when `interruptOnHit` is true. Default 1. */
  interruptHits?: number
  /** EXP-011: attack type telegraphed to the player. Default `'normal'`. */
  kind?: AttackKind
  /** EXP-011, `kind: 'cast'` only: a landed hit while armed interrupts this cast (see above). */
  interruptible?: boolean
  /** EXP-011: required when `interruptible` is true — the attack used after the interrupt (by
   * convention `kind: 'normal'`; nesting another interruptible cast here is not a case this spike's
   * content needs, but is not itself rejected by `checkEncounter`). */
  interruptedAttack?: AttackTimer
}

export interface BossPhase {
  /** Arena side where the boss is vulnerable during this phase. */
  side: Dir
  /** Hits (hit-units) this phase absorbs before the next phase starts. */
  hpUnits: number
  /** Rotate charges granted when this phase starts. */
  grantRotate?: number
  /** `ATTACK IN N` for this phase. Absent = this phase never attacks (e.g. a passive tutorial mob). */
  attackTimer?: AttackTimer
  label?: string
}

/**
 * EXP-013: how `EnemyAbility` picks which arrow to affect. Only `'free-arrow'` is implemented —
 * deterministically the lowest-id arrow that is currently free (`BoardState.canExit`) AND not
 * already pinned, and only when pinning it would still leave at least `pinDuration` other such
 * arrows (the no-softlock guarantee; see `EncounterState.selectAbilityTarget`). The type is a union of one so
 * that adding a second policy later (telegraphed-specific / random-safe / longest-arrow /
 * direction-specific, per the brief) is a new case in that switch, not a new field shape.
 */
export type AbilityTargetPolicy = 'free-arrow'

/**
 * COMBAT-001: minimal enemy-ability framework. An ability is its own countdown, independent of
 * `attackTimer`, plus exactly one tiny resolution per `kind` — deliberately not a generic
 * ability/scripting system. `kind` absent means legacy `'stone_throw'` so pre-framework
 * encounter JSON and tests keep working unchanged.
 */
export type AbilityKind = 'stone_throw' | 'shield' | 'shift' | 'heal'

/** EXP-013 Stone Throw: pin the selected arrow for `pinDuration` world turns. */
export interface StoneThrowAbility {
  /** Stable id, e.g. for viewer labels and logs. */
  id: string
  kind?: 'stone_throw'
  /** Ticks on every legal world turn (alongside `attackTimer`, not instead of it). */
  interval: number
  /** How the affected arrow is chosen. */
  targetPolicy: AbilityTargetPolicy
  /** World turns the pinned arrow stays illegal to tap before becoming playable again. */
  pinDuration: number
  label?: string
}

/**
 * COMBAT-001 Shield (debug/framework proof, not accepted content): when the countdown fires the
 * enemy raises a one-shot shield; the next projectile hit on that enemy is absorbed (no HP
 * damage, no interrupt) and drops the shield. No pin/targeting fields — a shield has no target.
 */
export interface ShieldAbility {
  /** Stable id, e.g. for viewer labels and logs. */
  id: string
  kind: 'shield'
  /** Ticks on every legal world turn (alongside `attackTimer`, not instead of it). */
  interval: number
  label?: string
}

/**
 * LD-007 Side Shift (provisional playtest prototype, not accepted content): on its own countdown
 * the enemy walks to the next arena side in `sides` (cyclic; it starts from wherever its own
 * `side` sits in that list, or from `sides[0]`). Nothing else changes — HP, attack timer and the
 * board are untouched; only *which arrow direction reaches it* moves. The designer intent is to
 * make direction a resource over time: the ammo you need for this enemy is different two turns
 * from now, so "wait for him to walk into my E arrows" becomes a real line. A shift is skipped
 * (countdown still resets) if the destination side is already held by another live enemy —
 * one target per side stays true.
 */
export interface ShiftAbility {
  id: string
  kind: 'shift'
  /** Ticks on every legal world turn (alongside `attackTimer`, not instead of it). */
  interval: number
  /** Arena sides visited in order, wrapping around. */
  sides: Dir[]
  /** ACT-I-003: what makes the enemy move. `'timer'` (default) = its own countdown; `'hit'` = every
   * landed, non-killing projectile hit knocks it to the next side instead (the countdown is then
   * unused). A hit-triggered shifter forces the player to alternate arrow directions to land
   * consecutive hits — "the drunkard staggers away every time you tag him". */
  trigger?: 'timer' | 'hit'
  label?: string
}

/**
 * ACT-I-003 Heal (support archetype): on its own countdown the enemy restores `amount` (default 1)
 * HP to the most wounded OTHER live enemy (lowest current HP, then lowest index), never above that
 * enemy's starting HP and never itself. Fizzles (countdown still resets) when nobody else is
 * wounded. Makes kill order a real decision: the healer is harmless but should die first.
 */
export interface HealAbility {
  id: string
  kind: 'heal'
  interval: number
  amount?: number
  label?: string
}

export type EnemyAbility = StoneThrowAbility | ShieldAbility | ShiftAbility | HealAbility

/** Resolution kind of an ability; absent `kind` is the legacy Stone Throw shape. */
export const abilityKind = (a: EnemyAbility): AbilityKind => a.kind ?? 'stone_throw'

/** ITEM-001b: every ability of an enemy — `ability` first, then `abilities` — as one list. */
export const abilitiesOf = (e: { ability?: EnemyAbility; abilities?: EnemyAbility[] }): EnemyAbility[] =>
  [...(e.ability ? [e.ability] : []), ...(e.abilities ?? [])]

/** One-line ability description for reports/viewer/debug HUD (`THROW IN N` / `SHIELD IN N`). */
export function describeAbility(a: EnemyAbility): string {
  if (abilityKind(a) === 'shield') return `SHIELD IN ${a.interval} (one-shot, absorbs next hit)`
  if (abilityKind(a) === 'shift') {
    const sh = a as ShiftAbility
    const cycle = sh.sides.map((d) => DIR_NAMES[d]).join('->')
    return sh.trigger === 'hit' ? `MOVES WHEN HIT (${cycle})` : `MOVE IN ${a.interval} (${cycle})`
  }
  if (abilityKind(a) === 'heal') return `HEAL IN ${a.interval} (+${(a as HealAbility).amount ?? 1} to most wounded ally)`
  const s = a as StoneThrowAbility
  return `THROW IN ${s.interval} (${s.targetPolicy}, pin ${s.pinDuration} turns)`
}

/**
 * EXP-010b: one of possibly several enemies alive at the same time (`def.enemies`), each with its
 * own side/HP/attackTimer, independent of every other enemy in the encounter. Unlike `BossPhase`
 * these do not sequence — all alive enemies exist and attack in parallel from encounter start.
 */
export interface EnemyFlee {
  /** Landed hits after which this enemy taunts and leaves the arena instead of dying.
   * Must be a positive integer strictly below `hp` (enforced by `checkEncounter`) — that is
   * what makes the enemy structurally unkillable: the flee always fires before death could. */
  afterHits: number
  label?: string
}

export interface EnemyDef {
  /** Stable id, e.g. for viewer labels and attack attribution. */
  id: string
  /** WAVE-001: enter at the end of a world turn once all specified conditions are met.
   * If the side is occupied, wait; eligible enemies claim it in definition order. */
  arrival?: { afterKill?: string; onTurn?: number }
  /** Arena side this enemy is vulnerable from. */
  side: Dir
  /** Hits (hit-units) this enemy absorbs before it dies. */
  hp: number
  /** Must this enemy die for `won`? Default true. An optional enemy never blocks a win by itself. */
  mandatory?: boolean
  /** `ATTACK IN N` for this enemy. Absent = this enemy never attacks. */
  attackTimer?: AttackTimer
  /** EXP-013: a board-affecting ability on its own independent countdown. Absent = none. Not
   * modeled on `BossPhase` — this spike only needs it on simultaneous enemies. */
  ability?: EnemyAbility
  /** ITEM-001b: further abilities, each on its own countdown (e.g. the Matron heals AND her kids
   * throw stones). `ability` + `abilities` are read as one list, in that order. */
  abilities?: EnemyAbility[]
  /** STORY-001: optional scripted flee (see above). Absent = this enemy fights to the death. */
  flee?: EnemyFlee
  /** ACT-I-003: granted to the player the moment this enemy dies. `heal` is capped at the
   * encounter's `playerMaxHp`; `rotate` goes to the shared run pool when the encounter uses one,
   * else to an encounter-local bonus. Undo refunds both. */
  reward?: EnemyReward
  /** ACT-I-003: temporary target — after this many world turns the enemy leaves the arena
   * (same consequences as a STORY-001 flee: can't be hit, doesn't attack, abilities stop).
   * Must be `mandatory: false` (checked), otherwise the encounter could only end by board clear. */
  expiresAfter?: number
  label?: string
}

export interface EnemyReward {
  heal?: number
  rotate?: number
}

/** Presentation/arena metadata (BUILD-024). Decouples visual theme/calibration from gameplay rules. */
export interface ArenaPresentation {
  arena?: string
  calibration?: string
}

export interface EncounterDef {
  id: string
  title?: string
  /** BUILD-024: optional presentation / arena metadata for visual shells. */
  presentation?: ArenaPresentation
  /** Sequential single-target boss (EXP-008/009/010). Exactly one of `boss`/`enemies` is set. */
  boss?: { id: string; phases: BossPhase[] }
  /** Simultaneous regular enemies (EXP-010b). Exactly one of `boss`/`enemies` is set. */
  enemies?: EnemyDef[]
  /** Which quarter turns a Rotate charge may perform, and whether spending one costs a turn. */
  rotate: {
    allow: Turn[]
    advancesTurn?: boolean
    /** RUN-001: when true, Rotate charges come from the shared run pool (RunState) instead of any
     * encounter-local grant. The pool holder is passed in (constructor/`fromLevel` 4th param) and
     * ignored entirely when this flag is absent — tutorial/local boss Rotate can never leak into
     * the global pool. Cannot be combined with `rotateCharges` or phase `grantRotate`
     * (rejected by `checkEncounter`). */
    useRunPool?: boolean
  }
  /** HP lost on a blocked tap. Default 0 (no HP consequence — EXP-009 behaviour, still used by E1). */
  blockedTapDamage?: number
  /** Rotate charges available from the start, for `enemies`-mode encounters (no phases to grant them). */
  rotateCharges?: number
  /** RUN-001: charges added to the shared run pool when this encounter is completed (claimed once
   * by `RunState.advance()`). The prologue boss sets this to 2; post-prologue encounters leave it
   * unset and spend from the pool instead. Not a per-tap/per-phase grant. */
  winRotateReward?: number
  /** ACT-I-003: HP restored (capped at the run's max) when this encounter is completed, claimed
   * once by `RunState.advance()` like `winRotateReward`. A "rest" beat between fights. */
  winHeal?: number
  /** ITEM-001: force an item card in the post-encounter draft (boss / milestone fights). */
  rewardItem?: boolean
  notes?: string
}

export type EncounterAction = { kind: 'tap'; id: number } | { kind: 'rotate'; turn: Turn } | ItemAction

/**
 * RUN-001: the shared run-level Rotate pool. A mutable holder owned by RunState and passed into
 * pool-backed encounters (`rotate.useRunPool`); spending a Rotate decrements it directly, undo
 * refunds it. Solver `clone()` gets a fresh holder seeded with the current value, so exploration
 * never drains the live run pool.
 */
export interface RotatePool {
  charges: number
}

export type TapResult =
  | { ok: false; reason: 'over' | 'gone'; blocker: -1 }
  | { ok: false; reason: 'blocked'; blocker: number; damage: number; playerHp: number; playerDead: boolean; safetyFuse?: boolean }
  /** EXP-013: `id` is geometrically free but currently pinned by an enemy ability (Stone Throw).
   * Deliberately NOT the same as `'blocked'`: no HP cost, and (like `'blocked'`) not logged/undoable
   * and not a world turn — see `tap()`. */
  | { ok: false; reason: 'pinned'; pinTurnsLeft: number; playerHp: number; playerDead: boolean }
  | {
      ok: true
      /** Direction the projectile flies in the arena (board-local dir + rotation). */
      arenaDir: Dir
      hit: boolean
      /** VFX-002: HP actually removed from the hit target by this tap (0 on a miss). Derived from
       * the real before/after HP delta, not a fixed "1 hit-unit" assumption baked into a caller —
       * the presentation layer (damage-number popup) reads this instead of computing its own guess. */
      hitDamage: number
      /** Boss mode only; always 0 in `enemies` mode (no phases to change). */
      phaseBefore: number
      phaseAfter: number
      /** Rotate charges granted by the phase this hit started. Always 0 in `enemies` mode. */
      granted: number
      /** This hit interrupted (reset) an attack timer (the active boss phase's, or the hit enemy's) —
       * fires for both the legacy `interruptOnHit` reset and an EXP-011 `castInterrupted` below. */
      interrupted: boolean
      /** EXP-011: this hit specifically interrupted a `kind: 'cast'` attack — its damage never fired
       * and the attacker's next attack became `interruptedAttack`. A narrower, UI-facing signal than
       * `interrupted` (e.g. to show "CAST INTERRUPTED" instead of a generic message). */
      castInterrupted: boolean
      /** At least one attack timer reached 0 this turn and hit the player. */
      enemyAttacked: boolean
      /** Total player damage taken this turn from enemy attacks. */
      enemyDamage: number
      /** `enemies` mode only: which enemies attacked this turn and for how much (can be more than one). */
      enemyAttacks?: { id: string; damage: number }[]
      /** EXP-013, `enemies` mode only: arrow ids whose pin expired this turn (playable again). */
      pinExpired?: number[]
      /** EXP-013, `enemies` mode only: new pins an ability created this turn. */
      pinnedThisTurn?: { id: number; turnsLeft: number }[]
      /** COMBAT-001, `enemies` mode only: enemy ids that raised their one-shot shield this turn. */
      shieldRaised?: { id: string }[]
      /** LD-007, `enemies` mode only: enemies that walked to another arena side this turn. */
      shifted?: { id: string; from: Dir; to: Dir }[]
      /** ACT-I-003, `enemies` mode only: heals performed by support enemies this turn. */
      healed?: { id: string; target: string; amount: number }[]
      /** ACT-I-003, `enemies` mode only: kill rewards granted by this tap. */
      rewards?: { id: string; heal: number; rotate: number }[]
      /** ACT-I-003, `enemies` mode only: temporary targets whose window closed this turn. */
      expired?: { id: string; label?: string }[]
      /** ITEM-001b: id of the arrow the Arrow item just put on the board (the level grew by one). */
      spawnedArrow?: number
      /** WAVE-001: enemies entering after this turn's attacks/abilities have resolved. */
      arrived?: { id: string }[]
      /** COMBAT-001, `enemies` mode only: enemy ids whose shield absorbed this turn's hit (no HP damage). */
      shieldConsumed?: { id: string }[]
      /** STORY-001, `enemies` mode only: enemies that fled the arena this turn (scripted
       * `flee` event fired — taunt beat for the presentation layer). Empty when none fled. */
      fled?: { id: string; label?: string }[]
      /** ITEM-002: Keystone Release relic triggered this tap (nearest enemy timer +1). */
      keystoneTriggered?: boolean
      /** ITEM-002: Safety Fuse relic prevented blocked tap damage this tap. */
      safetyFuse?: boolean
      /** ITEM-002: Waste Conversion relic buff applied +1 DU to this landed hit. */
      wasteConversionTriggered?: boolean
      /** ITEM-002: War Horn item buff applied +1 DU to this landed hit. */
      warHornTriggered?: boolean
      playerHp: number
      won: boolean
      lost: boolean
      playerDead: boolean
    }

/** ITEM-001: what `landEnemyHit` resolved, before the world advances. */
interface EnemyHitResolution {
  hit: boolean
  hitDamage: number
  hitTargetIdx: number
  shieldConsumed: { id: string }[]
  fled: { id: string; label?: string }[]
  rewards: { id: string; heal: number; rotate: number }[]
  shifted: { id: string; from: Dir; to: Dir }[]
}

interface TimerSnapshot {
  playerHp: number
  /** Boss mode. */
  countdown?: number
  hitsThisCycle?: number
  /** Boss mode, EXP-011: has the active phase's cast already been interrupted (switched to `interruptedAttack`)? */
  castInterrupted?: boolean
  /** Enemies mode: one entry per `def.enemies[i]`. */
  enemyHp?: number[]
  enemyCountdown?: number[]
  enemyHitsThisCycle?: number[]
  /** Enemies mode, EXP-011: one entry per `def.enemies[i]` — has that enemy's cast been interrupted? */
  enemyCastInterrupted?: boolean[]
  /** EXP-013: pin state is board-level, not mode-specific, so both modes carry it (always all-zero
   * in boss mode, which has no `ability`). One entry per board arrow id. */
  pinTurnsLeft: number[]
  /** EXP-013/ITEM-001b, enemies mode only: one entry per `def.enemies[i]`, one countdown per ability. */
  enemyAbilityCountdown?: number[][]
  /** COMBAT-001, enemies mode only: one entry per `def.enemies[i]` — that enemy's shield is up. */
  enemyShield?: boolean[]
  /** LD-007 shift, enemies mode only: one entry per `def.enemies[i]` — current arena side. */
  enemySide?: Dir[]
  enemyPending?: boolean[]
  /** ACT-I-003 */
  worldTurn: number
  bonusRotate: number
  /** ITEM-001: player ward HP (Shield item) still up. */
  ward: number
  /** ITEM-002: Pocket Gyro local Rotate charges. */
  localBonusRotate: number
  /** ITEM-002: War Horn buff primed. */
  warHornActive: boolean
  /** ITEM-002: Waste Conversion relic buff primed. */
  wasteConversionReady: boolean
  /** ITEM-002: Keystone Release relic already triggered this encounter. */
  keystoneTriggered: boolean
  /** ITEM-002: Safety Fuse relic already triggered this encounter. */
  safetyFuseUsed: boolean
}

type Entry = (
  | { kind: 'tap'; id: number; hit: boolean; poolReward?: number; units?: number }
  | { kind: 'rotate'; turn: Turn; timerBefore: TimerSnapshot; spentGyro?: boolean }
  | { kind: 'item'; item: ItemId; target?: Dir; hit: boolean; poolReward?: number; slot: number; units?: number; boardBefore?: BoardState; levelBefore?: Level }
) & { timerBefore: TimerSnapshot }

export class EncounterState {
  readonly def: EncounterDef
  /** The live board. Reassigned only by the Arrow item (`spawn_arrow`), which grows the topology. */
  board: BoardState
  /** ITEM-001b: the current Level (grows with spawned arrows); undefined when built from a bare topology. */
  private levelValue: Level | undefined
  readonly totalHp: number
  /** phaseEnd[i] = total hits after which phase i is over. */
  private readonly phaseEnd: number[]
  /** grantedUpTo[i] = Rotate charges granted by phases 0..i. */
  private readonly grantedUpTo: number[]
  private rot = 0
  private hitCount = 0
  private rotates = 0
  /** Turns left in the active phase's attack cycle; Infinity when the phase has no attackTimer. Boss mode only. */
  private countdown = Infinity
  /** Landed hits accumulated toward the active attackTimer's interruptHits threshold. Boss mode only. */
  private hitsThisCycle = 0
  /** EXP-011, boss mode only: has the active phase's `kind: 'cast'` attack already been interrupted
   * (switched to `interruptedAttack`)? Reset to false on every phase change. */
  private castInterrupted = false
  /** Enemies mode: per-enemy remaining hp, countdown, interrupt-cycle hit count (index = def.enemies[i]). */
  private enemyHp: number[] = []
  private enemyCountdown: number[] = []
  private enemyHitsThisCycle: number[] = []
  /** EXP-011, enemies mode only: per-enemy, has that enemy's `kind: 'cast'` attack been interrupted? */
  private enemyCastInterrupted: boolean[] = []
  /** EXP-013: world turns left before arrow `id` becomes tappable again; 0 = not pinned. Indexed by
   * board arrow id, board-level (not mode-specific) — see the module doc comment. */
  private pinTurnsLeft: number[] = []
  /** EXP-013/ITEM-001b, enemies mode only: `def.enemies[i]`'s countdowns, one per ability (in `abilitiesOf` order). */
  private enemyAbilityCountdown: number[][] = []
  /** COMBAT-001, enemies mode only: `def.enemies[i]`'s one-shot shield is currently up. */
  private enemyShield: boolean[] = []
  /** LD-007 shift, enemies mode only: `def.enemies[i]`'s CURRENT arena side (starts at `def.side`). */
  private enemySide: Dir[] = []
  private enemyPending: boolean[] = []
  /** ACT-I-003: legal world turns elapsed (taps, plus Rotates when `rotate.advancesTurn`). */
  private worldTurn = 0
  /** ACT-I-003: Rotate charges earned from kill rewards in a non-pool encounter. */
  private bonusRotate = 0
  private playerHpValue: number
  /** ACT-I-003: cap for `reward.heal`. Defaults to the starting HP when the caller has no run. */
  readonly playerMaxHp: number
  /** ITEM-001: ward HP from the Shield item; absorbs enemy attack damage before HP. */
  private ward = 0
  /** ITEM-001: the run inventory, by handle (charges are spent here directly, undo refunds). Null = no items. */
  private readonly inventory: Inventory | null
  /** ITEM-002: owned passive relics. */
  private readonly relics: readonly RelicId[]
  /** ITEM-002: War Horn buff primed for the next landed puzzle arrow. */
  private warHornActive = false
  /** ITEM-002: Waste Conversion relic primed for the next landed hit. */
  private wasteConversionReady = false
  /** ITEM-002: Keystone Release relic triggered once per encounter. */
  private keystoneTriggered = false
  /** ITEM-002: Safety Fuse relic used once per encounter. */
  private safetyFuseUsed = false
  /** ITEM-002: Pocket Gyro encounter-local Rotate charges (does NOT touch shared pool). */
  private localBonusRotate = 0
  /** The HP this encounter started with (constructor param), needed to replay it exactly in clone(). */
  readonly playerHpStart: number
  /**
   * RUN-001: live handle on the shared run pool, or null. Set only when `def.rotate.useRunPool`
   * is true AND a holder was passed in — any other combination behaves exactly as before
   * (encounter-local grants), so tutorial Rotate stays local by construction.
   */
  private readonly rotatePool: RotatePool | null
  private readonly log: Entry[] = []

  constructor(
    topo: BoardTopology,
    def: EncounterDef,
    playerHp = DEFAULT_PLAYER_HP,
    rotatePool: RotatePool | null = null,
    playerMaxHp = playerHp,
    inventory: Inventory | null = null,
    relics: readonly RelicId[] = [],
    level?: Level,
  ) {
    checkEncounter(def)
    this.def = def
    this.board = new BoardState(topo)
    this.levelValue = level
    this.inventory = inventory
    this.relics = relics
    this.playerHpValue = playerHp
    this.playerHpStart = playerHp
    this.playerMaxHp = Math.max(playerHp, playerMaxHp)
    this.rotatePool = def.rotate.useRunPool ? rotatePool : null
    this.phaseEnd = []
    this.grantedUpTo = []
    this.pinTurnsLeft = new Array(topo.arrowCount).fill(0)
    // ITEM-002: Pocket Gyro gives +1 local Rotate if Rotate is allowed in this encounter
    if (this.inventory && this.inventory.slots.some((it) => it.id === 'pocket_gyro') && (def.rotate?.allow?.length ?? 0) > 0) {
      this.localBonusRotate = 1
    }
    if (def.enemies) {
      this.totalHp = def.enemies.reduce((s, e) => s + e.hp, 0)
      this.enemyHp = def.enemies.map((e) => e.hp)
      this.enemyCountdown = def.enemies.map((e) => e.attackTimer?.interval ?? Infinity)
      this.enemyHitsThisCycle = def.enemies.map(() => 0)
      this.enemyCastInterrupted = def.enemies.map(() => false)
      this.enemyAbilityCountdown = def.enemies.map((e) => abilitiesOf(e).map((a) => a.interval))
      this.enemyShield = def.enemies.map(() => false)
      this.enemySide = def.enemies.map((e) => e.side)
      this.enemyPending = def.enemies.map((e) => e.arrival !== undefined)
    } else {
      let hp = 0
      let granted = 0
      for (const p of def.boss!.phases) {
        hp += p.hpUnits
        granted += p.grantRotate ?? 0
        this.phaseEnd.push(hp)
        this.grantedUpTo.push(granted)
      }
      this.totalHp = hp
      this.resetPhaseTimer(0)
    }
  }

  static fromLevel(
    level: Level,
    def: EncounterDef,
    playerHp = DEFAULT_PLAYER_HP,
    rotatePool: RotatePool | null = null,
    playerMaxHp = playerHp,
    inventory: Inventory | null = null,
    relics: readonly RelicId[] = [],
  ): EncounterState {
    return new EncounterState(BoardTopology.fromLevel(level), def, playerHp, rotatePool, playerMaxHp, inventory, relics, level)
  }

  /** ITEM-001b: the level as it is now (spawned arrows included). Undefined without a source level. */
  get level(): Level | undefined {
    return this.levelValue
  }

  clone(): EncounterState {
    // ITEM-002: only non-gyro rotates spent from the pool should be refunded to the pool clone.
    const poolRotatesSpent = this.log.filter((e) => e.kind === 'rotate' && !e.spentGyro).length
    const pool = this.rotatePool ? { charges: this.rotatePool.charges + poolRotatesSpent } : null
    // ITEM-001: same trick for items — replaying the log re-spends the charges back down.
    let inv: Inventory | null = null
    if (this.inventory) {
      inv = { slots: this.inventory.slots.map((it) => ({ ...it })) }
      for (const e of this.log) if (e.kind === 'item') inv.slots[e.slot].charges++
    }
    // Spawned arrows are replayed from the log, so the clone starts from the pre-spawn topology.
    const first = this.log.find((e) => e.kind === 'item' && e.boardBefore)
    const topo0 = first && first.kind === 'item' && first.boardBefore ? first.boardBefore.topo : this.board.topo
    const level0 = first && first.kind === 'item' ? first.levelBefore : this.levelValue
    const c = new EncounterState(topo0, this.def, this.playerHpStart, pool, this.playerMaxHp, inv, this.relics, level0)
    for (const e of this.log) {
      if (e.kind === 'tap') c.tap(e.id)
      else if (e.kind === 'rotate') c.rotate(e.turn)
      else c.useItem(e.item, e.target)
    }
    return c
  }

  /** Quarter turns clockwise applied to the board, 0..3. */
  get rotation(): number {
    return this.rot
  }
  /** Total hits landed so far, across whichever mode is active. */
  get hits(): number {
    return this.totalHp - this.hp
  }
  get hp(): number {
    if (this.def.enemies) return this.enemyHp.reduce((a, v) => a + Math.max(0, v), 0)
    return this.totalHp - this.hitCount
  }
  get rotatesUsed(): number {
    return this.rotates
  }
  /**
   * Two standard win paths (docs/COMBAT-RULES.md 8): the target is killed, or the board is fully
   * cleared while the player is still alive. Running out of arrows that can reach a live target is
   * *not* an automatic loss — the player keeps clearing the rest of the puzzle under fire.
   * `enemies` mode: "the target is killed" generalizes to "every mandatory enemy is dead" — an
   * enemy explicitly marked `mandatory: false` never blocks a win by itself. STORY-001: a fled
   * enemy is NOT dead (it still has HP left), so a mandatory fled enemy keeps this false — the
   * encounter then ends only through the board-clear path below, never instantly on the flee.
   */
  get won(): boolean {
    if (this.def.enemies) {
      const allMandatoryDead = this.def.enemies.every((e, i) => e.mandatory === false || this.enemyHp[i] <= 0)
      return allMandatoryDead || (this.board.cleared && !this.playerDead)
    }
    return this.hitCount >= this.totalHp || (this.board.cleared && !this.playerDead)
  }
  get playerHp(): number {
    return this.playerHpValue
  }
  get playerDead(): boolean {
    return this.playerHpValue <= 0
  }
  /** Turns left before the active phase's attack fires; Infinity if this phase has no attackTimer. */
  get countdownTurns(): number {
    return this.countdown
  }
  /** EXP-011, boss mode: the active phase's current attack type ('normal'/'cast'), or undefined if
   * this phase has no attackTimer at all. After an interrupt this reflects `interruptedAttack.kind`. */
  get attackKind(): AttackKind | undefined {
    const at = this.currentAttackTimer()
    return at ? (at.kind ?? 'normal') : undefined
  }
  /** The only loss condition: the player ran out of HP. */
  get lost(): boolean {
    return this.playerDead
  }
  get over(): boolean {
    return this.won || this.lost
  }
  /** Index of the active phase; equals phases.length once the boss is dead. */
  get phaseIndex(): number {
    return phaseAt(this.phaseEnd, this.hitCount)
  }
  /** Boss mode only: the current phase's target side. */
  get bossSide(): Dir | -1 {
    const i = this.phaseIndex
    return i < this.def.boss!.phases.length ? this.def.boss!.phases[i].side : -1
  }
  /** Hits still needed to finish the active phase. Boss mode only. */
  get phaseHpLeft(): number {
    const i = this.phaseIndex
    return i < this.phaseEnd.length ? this.phaseEnd[i] - this.hitCount : 0
  }
  /**
   * RUN-001: pool-backed encounters (`rotate.useRunPool`) report the live shared pool remainder;
   * everything else is unchanged encounter-local accounting (boss mode: charges granted by phases
   * reached so far. Enemies mode: `def.rotateCharges` flat pool).
   */
  get rotateCharges(): number {
    const base = this.rotatePool
      ? this.rotatePool.charges
      : this.def.enemies
        ? (this.def.rotateCharges ?? 0) + this.bonusRotate - this.rotates
        : this.grantedUpToPhase(this.phaseIndex) - this.rotates
    return base + this.localBonusRotate
  }
  get actions(): EncounterAction[] {
    return this.log.map((e): EncounterAction => (e.kind === 'tap' ? { kind: 'tap', id: e.id } : e.kind === 'rotate' ? { kind: 'rotate', turn: e.turn } : { kind: 'item', id: e.item, target: e.target }))
  }
  /**
   * Enemies mode: current state of every enemy, for the validator/analyzer/viewer (boss mode has no
   * equivalent — its single target's state is `hp`/`totalHp`/`bossSide`/`phaseIndex`).
   */
  get enemies(): {
    id: string
    side: Dir
    hp: number
    hpMax: number
    dead: boolean
    pending: boolean
    arrivesIn?: number
    arrivesAfter?: string
    /** STORY-001: this enemy already taunted and left the arena (scripted `flee` fired).
     * Fled is not dead: it takes no more hits, attacks, or abilities, but a mandatory fled
     * enemy still blocks the all-mandatory-dead win — only a full board clear ends it. */
    fled: boolean
    /** ACT-I-003: this temporary target's `expiresAfter` ran out — it left the arena (like fled). */
    expired: boolean
    /** ACT-I-003: world turns before this temporary target leaves; undefined if it never does. */
    turnsLeft?: number
    countdown: number
    mandatory: boolean
    label?: string
    /** EXP-011: this enemy's current attack type, or undefined if it has no attackTimer. */
    attackKind?: AttackKind
    /** EXP-013: this enemy's FIRST ability countdown, or undefined if it has no ability (legacy view). */
    abilityCountdown?: number
    /** ITEM-001b: every ability with its live countdown, in definition order. */
    abilities: { kind: AbilityKind; trigger?: 'timer' | 'hit'; countdown: number; label?: string }[]
    /** COMBAT-001: this enemy's one-shot shield is currently up (absorbs the next hit). */
    shielded: boolean
  }[] {
    if (!this.def.enemies) return []
    return this.def.enemies.map((e, i) => {
      const at = this.currentEnemyAttackTimer(i)
      return {
        id: e.id,
        side: this.enemySide[i],
        hp: Math.max(0, this.enemyHp[i]),
        hpMax: e.hp,
        dead: this.enemyHp[i] <= 0,
        pending: this.enemyPending[i],
        arrivesIn: this.enemyPending[i] && e.arrival?.onTurn !== undefined ? Math.max(0, e.arrival.onTurn - this.worldTurn) : undefined,
        arrivesAfter: this.enemyPending[i] ? e.arrival?.afterKill : undefined,
        fled: this.isFled(i),
        expired: this.isExpired(i),
        turnsLeft: e.expiresAfter !== undefined ? Math.max(0, e.expiresAfter - this.worldTurn) : undefined,
        countdown: this.enemyCountdown[i],
        mandatory: e.mandatory ?? true,
        label: e.label,
        attackKind: at ? (at.kind ?? 'normal') : undefined,
        abilityCountdown: abilitiesOf(e).length ? this.enemyAbilityCountdown[i][0] : undefined,
        abilities: abilitiesOf(e).map((a, k) => ({ kind: abilityKind(a), trigger: (a as ShiftAbility).trigger, countdown: this.enemyAbilityCountdown[i][k], label: a.label })),
        shielded: this.enemyShield[i] ?? false,
      }
    })
  }
  /** EXP-013: every arrow currently pinned, ascending id. */
  get pinnedArrows(): { id: number; turnsLeft: number }[] {
    const out: { id: number; turnsLeft: number }[] = []
    for (let id = 0; id < this.pinTurnsLeft.length; id++) if (this.pinTurnsLeft[id] > 0) out.push({ id, turnsLeft: this.pinTurnsLeft[id] })
    return out
  }
  /** EXP-013: is `id` currently pinned (geometrically free but illegal to tap)? */
  isPinned(id: number): boolean {
    return (this.pinTurnsLeft[id] ?? 0) > 0
  }

  grantedUpToPhase(i: number): number {
    return this.grantedUpTo[Math.min(i, this.grantedUpTo.length - 1)]
  }
  phaseEndHits(i: number): number {
    return this.phaseEnd[i]
  }

  arenaDir(id: number): Dir {
    return rotateDir(this.board.topo.dirs[id] as Dir, this.rot)
  }

  /**
   * STORY-001: has enemy `i` already taunted and left the arena? Derived from remaining HP
   * (`hp - enemyHp[i] >= flee.afterHits`), so undo/clone/key/solver need no extra state —
   * they all restore or replay HP. `checkEncounter` guarantees `afterHits < hp`, therefore a
   * fled enemy always still has HP left: fled never coincides with dead.
   */
  private isFled(i: number): boolean {
    const flee = this.def.enemies![i].flee
    if (!flee) return false
    return this.def.enemies![i].hp - this.enemyHp[i] >= flee.afterHits
  }
  /** ACT-I-003: temporary target whose window closed. Derived from `worldTurn`, so undo/clone need no extra state. */
  private isExpired(i: number): boolean {
    const e = this.def.enemies![i].expiresAfter
    return e !== undefined && this.worldTurn >= e
  }
  /** Absent (pending, fled or expired): untargetable, silent, ability-less. */
  private isGone(i: number): boolean {
    return this.enemyPending[i] || this.isFled(i) || this.isExpired(i)
  }

  private resolveArrivals(): { id: string }[] {
    const arrived: { id: string }[] = []
    const defs = this.def.enemies!
    for (let i = 0; i < defs.length; i++) {
      if (!this.enemyPending[i] || this.isExpired(i)) continue
      const { afterKill, onTurn } = defs[i].arrival!
      if (onTurn !== undefined && this.worldTurn < onTurn) continue
      if (afterKill !== undefined && this.enemyHp[defs.findIndex((e) => e.id === afterKill)] > 0) continue
      if (this.targetIndexAt(this.enemySide[i]) >= 0) continue
      this.enemyPending[i] = false
      this.enemyCountdown[i] = defs[i].attackTimer?.interval ?? Infinity
      this.enemyAbilityCountdown[i] = abilitiesOf(defs[i]).map((a) => a.interval)
      arrived.push({ id: defs[i].id })
    }
    return arrived
  }

  /** Enemies mode: the first alive enemy standing on `side`, or -1 (at most one is expected per side
   * at this spike's scale — see docs/LEVEL-DESIGNER.md; targeting UI for several is out of scope).
   * STORY-001: fled enemies already left the arena and can no longer be hit. */
  private targetIndexAt(side: Dir): number {
    if (!this.def.enemies) return -1
    return this.def.enemies.findIndex((_e, i) => this.enemySide[i] === side && this.enemyHp[i] > 0 && !this.isGone(i))
  }

  wouldHit(id: number): boolean {
    if (this.over || !this.board.canExit(id) || this.isPinned(id)) return false
    const dir = this.arenaDir(id)
    return this.def.enemies ? this.targetIndexAt(dir) >= 0 : dir === this.bossSide
  }

  /**
   * EXP-013: `board.freeArrows()` (geometric truth) minus whatever is currently pinned (mechanical
   * availability) — what a legal tap can actually target right now. The solver and `wouldHit` use
   * this instead of `board.freeArrows()` directly; `BoardState` itself has no notion of pins.
   */
  playableArrows(): number[] {
    const out: number[] = []
    for (const id of this.board.freeArrows()) if (!this.isPinned(id)) out.push(id)
    return out
  }

  /** Alive arrows by arena direction [N, E, S, W]. `freeOnly` means playable (free AND unpinned),
   * matching `playableArrows()` — always identical to plain geometric free when no arrow is pinned. */
  aliveByArenaDir(freeOnly = false): [number, number, number, number] {
    const c: [number, number, number, number] = [0, 0, 0, 0]
    const b = this.board
    for (let id = 0; id < b.topo.arrowCount; id++) {
      if (freeOnly ? b.canExit(id) && !this.isPinned(id) : b.isAlive(id)) c[this.arenaDir(id)]++
    }
    return c
  }

  canRotate(turn: Turn): boolean {
    return !this.over && this.rotateCharges > 0 && this.def.rotate.allow.includes(turn)
  }

  hasRelic(id: RelicId): boolean {
    return this.relics.includes(id)
  }
  get isWarHornActive(): boolean {
    return this.warHornActive
  }
  get isWasteConversionReady(): boolean {
    return this.wasteConversionReady
  }
  get isSafetyFuseAvailable(): boolean {
    return this.hasRelic('safety_fuse') && !this.safetyFuseUsed
  }
  get isSafetyFuseUsed(): boolean {
    return this.safetyFuseUsed
  }
  get isKeystoneTriggered(): boolean {
    return this.keystoneTriggered
  }
  get ownedRelics(): readonly RelicId[] {
    return this.relics
  }
  get localRotateCharges(): number {
    return this.localBonusRotate
  }

  private timerSnapshot(): TimerSnapshot {
    const pinTurnsLeft = [...this.pinTurnsLeft]
    const base = {
      playerHp: this.playerHpValue,
      pinTurnsLeft,
      worldTurn: this.worldTurn,
      bonusRotate: this.bonusRotate,
      ward: this.ward,
      localBonusRotate: this.localBonusRotate,
      warHornActive: this.warHornActive,
      wasteConversionReady: this.wasteConversionReady,
      keystoneTriggered: this.keystoneTriggered,
      safetyFuseUsed: this.safetyFuseUsed,
    }
    if (this.def.enemies) {
      return {
        ...base,
        enemyHp: [...this.enemyHp],
        enemyCountdown: [...this.enemyCountdown],
        enemyHitsThisCycle: [...this.enemyHitsThisCycle],
        enemyCastInterrupted: [...this.enemyCastInterrupted],
        enemyAbilityCountdown: this.enemyAbilityCountdown.map((cds) => [...cds]),
        enemyShield: [...this.enemyShield],
        enemySide: [...this.enemySide],
        enemyPending: [...this.enemyPending],
      }
    }
    return {
      ...base,
      countdown: this.countdown,
      hitsThisCycle: this.hitsThisCycle,
      castInterrupted: this.castInterrupted,
    }
  }
  private restoreTimer(t: TimerSnapshot): void {
    this.playerHpValue = t.playerHp
    this.pinTurnsLeft = t.pinTurnsLeft
    this.worldTurn = t.worldTurn
    this.bonusRotate = t.bonusRotate
    this.ward = t.ward
    this.localBonusRotate = t.localBonusRotate ?? 0
    this.warHornActive = t.warHornActive ?? false
    this.wasteConversionReady = t.wasteConversionReady ?? false
    this.keystoneTriggered = t.keystoneTriggered ?? false
    this.safetyFuseUsed = t.safetyFuseUsed ?? false
    if (this.def.enemies) {
      this.enemyHp = t.enemyHp!
      this.enemyCountdown = t.enemyCountdown!
      this.enemyHitsThisCycle = t.enemyHitsThisCycle!
      this.enemyCastInterrupted = t.enemyCastInterrupted!
      this.enemyAbilityCountdown = t.enemyAbilityCountdown!
      this.enemyShield = t.enemyShield!
      this.enemySide = t.enemySide!
      this.enemyPending = t.enemyPending!
    } else {
      this.countdown = t.countdown!
      this.hitsThisCycle = t.hitsThisCycle!
      this.castInterrupted = t.castInterrupted!
    }
  }

  /** Resets the attack-cycle countdown for phase `i` (called on encounter start and phase change). Boss mode only. */
  private resetPhaseTimer(i: number): void {
    const at = this.def.boss!.phases[i]?.attackTimer
    this.countdown = at?.interval ?? Infinity
    this.hitsThisCycle = 0
    this.castInterrupted = false
  }

  /** Boss mode: the phase-active attack config right now — the phase's own `attackTimer`, or, once
   * `castInterrupted` flipped true, its `interruptedAttack`. Undefined if the phase has no attackTimer
   * or the boss is already dead. EXP-011. */
  private currentAttackTimer(): AttackTimer | undefined {
    const phases = this.def.boss!.phases
    const i = this.phaseIndex
    if (i >= phases.length) return undefined
    const at = phases[i].attackTimer
    if (!at) return undefined
    return this.castInterrupted && at.interruptedAttack ? at.interruptedAttack : at
  }

  /** Enemies mode equivalent of `currentAttackTimer`, per-enemy. EXP-011. */
  private currentEnemyAttackTimer(i: number): AttackTimer | undefined {
    const at = this.def.enemies![i].attackTimer
    if (!at) return undefined
    return this.enemyCastInterrupted[i] && at.interruptedAttack ? at.interruptedAttack : at
  }

  /**
   * EXP-013, enemies mode only, called once per legal world turn (a legal tap, or a Rotate when
   * `def.rotate.advancesTurn`), after `advanceEnemiesTurn`. Order within this one call matters:
   * existing pins are ticked/expired FIRST, using the state as it stood before this turn's abilities
   * can run — a pin an ability creates later in this same call is therefore never pre-decremented on
   * its own creation turn. `pinDuration: N` then means exactly N subsequent world turns where the
   * arrow is illegal to tap (see EXP-013-REPORT.md for the worked example and the rationale for
   * placing this before ability resolution, not after, unlike the brief's initial sketch order).
   */
  private advancePinsAndAbilities(): {
    pinExpired: number[]
    pinnedThisTurn: { id: number; turnsLeft: number }[]
    shieldRaised: { id: string }[]
    shifted: { id: string; from: Dir; to: Dir }[]
    healed: { id: string; target: string; amount: number }[]
  } {
    const pinExpired: number[] = []
    for (let id = 0; id < this.pinTurnsLeft.length; id++) {
      if (this.pinTurnsLeft[id] <= 0) continue
      this.pinTurnsLeft[id]--
      if (this.pinTurnsLeft[id] <= 0) pinExpired.push(id)
    }
    const pinnedThisTurn: { id: number; turnsLeft: number }[] = []
    const shieldRaised: { id: string }[] = []
    const shifted: { id: string; from: Dir; to: Dir }[] = []
    const healed: { id: string; target: string; amount: number }[] = []
    const defs = this.def.enemies!
    for (let i = 0; i < defs.length; i++) {
      if (this.enemyHp[i] <= 0 || this.isGone(i)) continue
      const list = abilitiesOf(defs[i])
      for (let k = 0; k < list.length; k++) {
      const ability = list[k]
      if (abilityKind(ability) === 'shift' && (ability as ShiftAbility).trigger === 'hit') continue // hit-driven, see tapEnemies
      this.enemyAbilityCountdown[i][k]--
      if (this.enemyAbilityCountdown[i][k] > 0) continue
      this.enemyAbilityCountdown[i][k] = ability.interval
      if (abilityKind(ability) === 'shield') {
        // One-shot shield: raise it unless one is already up (no stacking — fizzle keeps the
        // old shield, the countdown still reset above and retries next cycle).
        if (!this.enemyShield[i]) {
          this.enemyShield[i] = true
          shieldRaised.push({ id: defs[i].id })
        }
        continue
      }
      if (abilityKind(ability) === 'shift') {
        const moved = this.shiftEnemy(i, ability as ShiftAbility)
        if (moved) shifted.push(moved)
        continue
      }
      if (abilityKind(ability) === 'heal') {
        // ACT-I-003: most wounded other live enemy; fizzle when nobody else is hurt.
        let best = -1
        for (let j = 0; j < defs.length; j++) {
          if (j === i || this.enemyHp[j] <= 0 || this.isGone(j) || this.enemyHp[j] >= defs[j].hp) continue
          if (best < 0 || this.enemyHp[j] < this.enemyHp[best]) best = j
        }
        if (best >= 0) {
          const amount = Math.min((ability as HealAbility).amount ?? 1, defs[best].hp - this.enemyHp[best])
          this.enemyHp[best] += amount
          healed.push({ id: defs[i].id, target: defs[best].id, amount })
        }
        continue
      }
      const target = this.selectAbilityTarget(ability as StoneThrowAbility)
      if (target >= 0) {
        this.pinTurnsLeft[target] = (ability as StoneThrowAbility).pinDuration
        pinnedThisTurn.push({ id: target, turnsLeft: (ability as StoneThrowAbility).pinDuration })
      }
      }
      // target < 0: fizzle -- no safe arrow to pin this cycle. The countdown still reset above, so
      // the ability simply tries again next cycle rather than retrying every turn.
    }
    return { pinExpired, pinnedThisTurn, shieldRaised, shifted, healed }
  }

  /** LD-007/ACT-I-003: walk enemy `i` to the next side in its cycle unless another live enemy holds it. */
  private shiftEnemy(i: number, ability: ShiftAbility): { id: string; from: Dir; to: Dir } | null {
    const defs = this.def.enemies!
    const sides = ability.sides
    const cur = this.enemySide[i]
    const at = sides.indexOf(cur)
    const to = sides[(at < 0 ? 0 : at + 1) % sides.length]
    const occupied = defs.some((_d, j) => j !== i && this.enemyHp[j] > 0 && !this.isGone(j) && this.enemySide[j] === to)
    if (to === cur || occupied) return null
    this.enemySide[i] = to
    return { id: defs[i].id, from: cur, to }
  }

  /**
   * EXP-013: deterministic target selection for one ability resolution. `'free-arrow'`: the lowest
   * board id among arrows that are both geometrically free (`board.freeArrows()`) and not already
   * pinned — but ONLY when `candidates.length >= ability.pinDuration + 1`, so after the pin at
   * least `pinDuration` OTHER playable arrows remain and the pin (which ticks down once per world
   * turn and is never itself a world turn when tapped) always expires before the player can run
   * out of legal taps. `playableArrows()` already returns ascending-by-id, so `[0]` is exactly
   * "lowest arrow id" tie-breaking. Returns -1 (fizzle, countdown still resets) when no candidate
   * is safe. This is the one place a future `targetPolicy` (telegraphed-specific / random-safe /
   * longest-arrow / direction-specific) would add a case, without touching anything else in this class.
   */
  private selectAbilityTarget(ability: StoneThrowAbility): number {
    switch (ability.targetPolicy) {
      case 'free-arrow': {
        const candidates = this.playableArrows()
        return candidates.length >= ability.pinDuration + 1 ? candidates[0] : -1
      }
      default:
        return -1
    }
  }

  /**
   * Advances the active phase's attack timer by one turn. `hitLanded` is whether this turn's tap
   * hit the boss (a rotate never hits). Per docs/COMBAT-RULES.md 5, a landed hit only damages the
   * target and the countdown ticks down exactly like a miss would — UNLESS the active attack config
   * opts into one of two independent interrupt shapes (checked in this order, before the countdown
   * ticks at all):
   *
   * 1. EXP-011 `kind: 'cast'` + `interruptible`: the hit cancels this cast (no damage this cycle) and
   *    the phase's active attack becomes `interruptedAttack` for the rest of the phase — a type
   *    change, not a timer bonus.
   * 2. EXP-010 legacy `interruptOnHit`: `interruptHits` hits reset the SAME countdown to `interval`
   *    without changing attack kind (no EXP-011 content turns this on).
   *
   * Returns what happened for the caller to report.
   */
  private advanceTurn(hitLanded: boolean): { interrupted: boolean; castInterrupted: boolean; attacked: boolean; damage: number } {
    const at = this.currentAttackTimer()
    if (!at) return { interrupted: false, castInterrupted: false, attacked: false, damage: 0 }
    if (at.kind === 'cast' && at.interruptible && hitLanded) {
      this.castInterrupted = true
      const next = at.interruptedAttack
      this.countdown = next?.interval ?? Infinity
      this.hitsThisCycle = 0
      return { interrupted: true, castInterrupted: true, attacked: false, damage: 0 }
    }
    if (at.interruptOnHit && hitLanded) {
      this.hitsThisCycle++
      if (this.hitsThisCycle >= (at.interruptHits ?? 1)) {
        this.countdown = at.interval
        this.hitsThisCycle = 0
        return { interrupted: true, castInterrupted: false, attacked: false, damage: 0 }
      }
    }
    this.countdown--
    if (this.countdown <= 0) {
      this.applyPlayerDamage(at.damage)
      this.countdown = at.interval
      this.hitsThisCycle = 0
      return { interrupted: false, castInterrupted: false, attacked: true, damage: at.damage }
    }
    return { interrupted: false, castInterrupted: false, attacked: false, damage: 0 }
  }

  /**
   * Enemies mode: ticks every currently-alive enemy's attack timer by one turn (docs/COMBAT-RULES.md
   * / EXP-010b brief: "each legal world turn ticks the timers of all alive attackers", independent of
   * which single enemy this turn's hit landed on, if any — `hitTargetIdx` is only used to let that one
   * enemy's own `interruptOnHit`/EXP-011 cast-interrupt fire). An enemy already at 0 hp is skipped: a
   * kill lands before this runs (see `tapEnemies`), so the enemy that died this turn never gets to
   * retaliate — same rule as the boss's "killed this turn: no retaliation", just per-enemy instead of
   * per-encounter. STORY-001: a fled enemy is likewise skipped — it already left the arena and its
   * countdown freezes (it neither attacks nor re-arms). Per-enemy interrupt precedence mirrors `advanceTurn`: EXP-011 cast-interrupt first,
   * then the EXP-010 legacy `interruptOnHit` reset, then the plain tick.
   */
  private advanceEnemiesTurn(hitTargetIdx: number): { interrupted: boolean; castInterrupted: boolean; attacked: boolean; damage: number; attacks: { id: string; damage: number }[] } {
    let interrupted = false
    let castInterrupted = false
    let attacked = false
    let damage = 0
    const attacks: { id: string; damage: number }[] = []
    for (let i = 0; i < this.enemyHp.length; i++) {
      if (this.enemyHp[i] <= 0 || this.isGone(i)) continue
      const at = this.currentEnemyAttackTimer(i)
      if (!at) continue
      if (at.kind === 'cast' && at.interruptible && i === hitTargetIdx) {
        this.enemyCastInterrupted[i] = true
        const next = at.interruptedAttack
        this.enemyCountdown[i] = next?.interval ?? Infinity
        this.enemyHitsThisCycle[i] = 0
        interrupted = true
        castInterrupted = true
        continue
      }
      if (at.interruptOnHit && i === hitTargetIdx) {
        this.enemyHitsThisCycle[i]++
        if (this.enemyHitsThisCycle[i] >= (at.interruptHits ?? 1)) {
          this.enemyCountdown[i] = at.interval
          this.enemyHitsThisCycle[i] = 0
          interrupted = true
          continue
        }
      }
      this.enemyCountdown[i]--
      if (this.enemyCountdown[i] <= 0) {
        this.applyPlayerDamage(at.damage)
        this.enemyCountdown[i] = at.interval
        this.enemyHitsThisCycle[i] = 0
        attacked = true
        damage += at.damage
        attacks.push({ id: this.def.enemies![i].id, damage: at.damage })
      }
    }
    return { interrupted, castInterrupted, attacked, damage, attacks }
  }

  /** ITEM-001: enemy attack damage goes through the ward first (Shield item), then HP. */
  private applyPlayerDamage(damage: number): void {
    const absorbed = Math.min(this.ward, damage)
    this.ward -= absorbed
    this.playerHpValue = Math.max(0, this.playerHpValue - (damage - absorbed))
  }

  /** ITEM-001: ward HP currently protecting the player (0 = none). */
  get wardHp(): number {
    return this.ward
  }

  /** ITEM-001: the live inventory slots (empty when this encounter has no run inventory). */
  get items(): readonly { slot: number; id: ItemId; charges: number }[] {
    return this.inventory ? this.inventory.slots.map((it, slot) => ({ slot, id: it.id, charges: it.charges })) : []
  }

  /** ITEM-001: can `id` be used right now (charges left, encounter running, a target if needed)? */
  canUseItem(id: ItemId, target?: Dir): boolean {
    if (this.over || !this.inventory) return false
    if (itemIsPassive(id)) return false
    const inst = this.inventory.slots.find((it) => it.id === id)
    if (!inst || inst.charges <= 0) return false
    if (!itemNeedsTarget(id)) return true
    if (ITEMS[id].effect.kind === 'spawn_arrow') {
      if (!this.levelValue) return false
      if (target === undefined) return ([0, 1, 2, 3] as Dir[]).some((d) => this.spawnPlacement(d) !== null)
      return this.spawnPlacement(target) !== null
    }
    if (target === undefined) return this.liveTargetSides().length > 0
    return this.liveTargetSides().includes(target)
  }

  /**
   * ITEM-001b: where a conjured arrow pointing `arenaDir` would go, or null. The arrow is 2 cells
   * (tail + head), both empty, with a clear ray from the head to the edge — so it is free the
   * moment it appears and can never soft-lock the board (it only ever adds a removable arrow).
   * Preference: shortest ray (least blocking of others), then not lying on any live arrow's ray,
   * then lowest cell index. Board-local direction = arena direction minus the current rotation.
   */
  spawnPlacement(arenaDir: Dir): { cells: number[]; dir: Dir } | null {
    if (!this.levelValue) return null
    const dir = rotateDir(arenaDir, -this.rot)
    const { width: w, height: h } = this.levelValue
    const topo = this.board.topo
    const occupied = (c: number) => this.board.ownerAt(c) !== -1
    // Cells under some live arrow's ray (placing there blocks that arrow until ours leaves).
    const onRay = new Uint8Array(w * h)
    for (let id = 0; id < topo.arrowCount; id++) {
      if (!this.board.isAlive(id)) continue
      for (let i = topo.rayStart[id]; i < topo.rayStart[id + 1]; i++) onRay[topo.rayCells[i]] = 1
    }
    // Dense boards (short profile fills ~90 % of the cells) often have no room for a 2-cell arrow;
    // a single-cell arrow is then conjured instead (the renderer draws those fine).
    let best: { cells: number[]; dir: Dir; score: number } | null = null
    for (let head = 0; head < w * h; head++) {
      if (occupied(head)) continue
      const ray = rayCells(w, h, head, dir)
      if (ray.some(occupied)) continue
      const tx = (head % w) - DX[dir]
      const ty = Math.floor(head / w) - DY[dir]
      const tail = tx < 0 || ty < 0 || tx >= w || ty >= h ? -1 : ty * w + tx
      const twoCell = tail >= 0 && !occupied(tail)
      const cells = twoCell ? [tail, head] : [head]
      const score = (twoCell ? 0 : 100) + ray.length * 10 + (cells.some((c) => onRay[c]) ? 5 : 0)
      if (!best || score < best.score) best = { cells, dir, score }
    }
    return best ? { cells: best.cells, dir: best.dir } : null
  }

  /** ITEM-001b: grows the level/topology by one arrow, keeping the alive set. Returns the new arrow id. */
  private spawnArrow(placement: { cells: number[]; dir: Dir }): number {
    const old = this.levelValue!
    const id = old.arrows.length
    const arrow: Arrow = { id, cells: placement.cells, dir: placement.dir }
    const level: Level = { width: old.width, height: old.height, arrows: [...old.arrows, arrow], solution: [], seed: old.seed }
    const topo = BoardTopology.fromLevel(level)
    const board = new BoardState(topo)
    for (let a = 0; a < id; a++) if (!this.board.isAlive(a)) board.remove(a)
    this.levelValue = level
    this.board = board
    this.pinTurnsLeft.push(0)
    return id
  }

  /** ITEM-001: arena sides that currently hold a hittable target. */
  liveTargetSides(): Dir[] {
    if (this.over) return []
    if (this.def.enemies) return ([0, 1, 2, 3] as Dir[]).filter((d) => this.targetIndexAt(d) >= 0)
    return this.bossSide >= 0 ? [this.bossSide as Dir] : []
  }

  /** ITEM-001: every legal item action from this state (for the solver and the UI). */
  itemActions(): ItemAction[] {
    if (this.over || !this.inventory) return []
    const out: ItemAction[] = []
    const seen = new Set<ItemId>()
    for (const it of this.inventory.slots) {
      if (it.charges <= 0 || seen.has(it.id) || itemIsPassive(it.id)) continue
      seen.add(it.id)
      if (ITEMS[it.id].effect.kind === 'spawn_arrow') {
        // Only directions that reach a live target are worth conjuring for the solver/UI.
        for (const d of this.liveTargetSides()) if (this.spawnPlacement(d)) out.push({ kind: 'item', id: it.id, target: d })
      } else if (itemNeedsTarget(it.id)) for (const d of this.liveTargetSides()) out.push({ kind: 'item', id: it.id, target: d })
      else out.push({ kind: 'item', id: it.id })
    }
    return out
  }

  /**
   * ITEM-001: uses an item. A `damage` item is a projectile hit on `target` with every downstream
   * rule of an arrow hit (shield absorb, cast interrupt, kill reward, hit-shift); `turnCost: 1`
   * items then advance the world exactly like a successful tap. `ward`/`heal` are free actions:
   * no world turn, timers untouched. Logged and undoable like tap/rotate.
   */
  useItem(id: ItemId, target?: Dir): TapResult {
    if (this.over) return { ok: false, reason: 'over', blocker: -1 }
    if (!this.canUseItem(id, target)) return { ok: false, reason: 'gone', blocker: -1 }
    const def = ITEMS[id]
    const slot = this.inventory!.slots.findIndex((it) => it.id === id && it.charges > 0)
    const timerBefore = this.timerSnapshot()
    const entry: Entry = { kind: 'item', item: id, target, hit: false, slot, timerBefore }
    this.inventory!.slots[slot].charges--
    if (def.effect.kind === 'ward') {
      this.ward = Math.max(this.ward, def.effect.absorb)
      this.log.push(entry)
      return this.freeActionResult()
    }
    if (def.effect.kind === 'heal') {
      this.playerHpValue = Math.min(this.playerMaxHp, this.playerHpValue + def.effect.hp)
      this.log.push(entry)
      return this.freeActionResult()
    }
    if (def.effect.kind === 'spawn_arrow') {
      const placement = this.spawnPlacement(target as Dir)!
      entry.boardBefore = this.board
      entry.levelBefore = this.levelValue
      const newId = this.spawnArrow(placement)
      this.log.push(entry)
      const res = this.freeActionResult()
      if (res.ok) res.spawnedArrow = newId
      return res
    }
    if (def.effect.kind === 'buff') {
      this.warHornActive = true
      this.log.push(entry)
      return this.freeActionResult()
    }
    if (def.effect.kind === 'passive') {
      return { ok: false, reason: 'gone', blocker: -1 }
    }
    // damage (Bow, Frost Dart)
    const dir = target as Dir
    if (this.def.enemies) {
      const targetIdx = this.targetIndexAt(dir)
      const res = this.landEnemyHit(dir, def.effect.du, entry)
      if (def.effect.timerBonus && targetIdx >= 0 && this.enemyHp[targetIdx] > 0) {
        this.enemyCountdown[targetIdx] += def.effect.timerBonus
      }
      this.log.push(entry)
      return this.finishEnemiesTurn(dir, res, def.turnCost === 1)
    }
    if (def.effect.timerBonus && !this.won && Number.isFinite(this.countdown)) {
      this.countdown += def.effect.timerBonus
    }
    return this.landBossHitAndAdvance(dir, def.effect.du, entry, def.turnCost === 1)
  }

  /** A logged free action (ward/heal): nothing in the world moved. */
  private freeActionResult(): TapResult {
    return {
      ok: true, arenaDir: 0, hit: false, hitDamage: 0, phaseBefore: this.phaseIndex, phaseAfter: this.phaseIndex, granted: 0,
      interrupted: false, castInterrupted: false, enemyAttacked: false, enemyDamage: 0,
      playerHp: this.playerHpValue, won: this.won, lost: this.lost, playerDead: this.playerDead,
    }
  }

  tap(id: number): TapResult {
    if (this.over) return { ok: false, reason: 'over', blocker: -1 }
    if (this.isPinned(id)) {
      // EXP-013: a rock-pinned arrow. Deliberately checked BEFORE board.tryRemove and BEFORE any
      // logging: no HP cost (this is not a puzzle mistake), no timer/ability movement, not a world
      // turn, and (like a blocked tap) not undoable individually -- there is nothing to undo.
      return { ok: false, reason: 'pinned', pinTurnsLeft: this.pinTurnsLeft[id], playerHp: this.playerHpValue, playerDead: this.playerDead }
    }
    const timerBefore = this.timerSnapshot()
    const freed: number[] = []
    const r = this.board.tryRemove(id, freed)
    if (!r.ok) {
      if (r.reason === 'gone') return r as { ok: false; reason: 'gone'; blocker: -1 }
      let damage = this.def.blockedTapDamage ?? 0
      let safetyFuse = false
      if (damage > 0 && this.hasRelic('safety_fuse') && !this.safetyFuseUsed) {
        this.safetyFuseUsed = true
        damage = 0
        safetyFuse = true
      }
      this.playerHpValue = Math.max(0, this.playerHpValue - damage)
      return { ok: false, reason: 'blocked', blocker: r.blocker, damage, playerHp: this.playerHpValue, playerDead: this.playerDead, safetyFuse }
    }
    let keystoneTriggered = false
    if (freed.length >= 2 && this.hasRelic('keystone_release') && !this.keystoneTriggered) {
      this.keystoneTriggered = true
      keystoneTriggered = true
      if (this.def.enemies) {
        let bestIdx = -1
        let minCd = Infinity
        for (let i = 0; i < this.def.enemies.length; i++) {
          if (this.enemyHp[i] > 0 && !this.isGone(i) && Number.isFinite(this.enemyCountdown[i])) {
            if (this.enemyCountdown[i] < minCd) {
              minCd = this.enemyCountdown[i]
              bestIdx = i
            }
          }
        }
        if (bestIdx >= 0) {
          this.enemyCountdown[bestIdx]++
        }
      } else if (Number.isFinite(this.countdown)) {
        this.countdown++
      }
    }
    return this.def.enemies ? this.tapEnemies(id, timerBefore, keystoneTriggered) : this.tapBoss(id, timerBefore, keystoneTriggered)
  }

  /** Everything a projectile landing on `arenaDir` does to the enemies (no world advance). */
  private landEnemyHit(arenaDir: Dir, du: number, entry: Entry & { kind: 'tap' | 'item' }): EnemyHitResolution {
    const targetIdx = this.targetIndexAt(arenaDir)
    // COMBAT-001: a raised shield absorbs exactly one projectile hit — HP is untouched and the
    // shield drops. The projectile still reached the enemy (`hit: true`, `hitDamage: 0`), but for
    // timer purposes this turn counts as a non-hit on that enemy: a blocked hit never interrupts.
    const shielded = targetIdx >= 0 && this.enemyShield[targetIdx]
    if (shielded) this.enemyShield[targetIdx] = false
    const shieldConsumed = shielded ? [{ id: this.def.enemies![targetIdx].id }] : []
    const hitTargetIdx = shielded ? -1 : targetIdx
    const hit = targetIdx >= 0
    const hpBefore = hit && !shielded ? this.enemyHp[targetIdx] : 0
    if (hit && !shielded) this.enemyHp[targetIdx] = Math.max(0, this.enemyHp[targetIdx] - du)
    const hitDamage = hit && !shielded ? hpBefore - this.enemyHp[targetIdx] : 0
    entry.hit = hit
    // STORY-001: a hit target could never have been fled before this tap (targetIndexAt skips
    // fled), so a fled check right after the decrement is exactly "fled this turn".
    const hitEnemy = hit ? this.def.enemies![targetIdx] : undefined
    const fled = hit && this.isFled(targetIdx) ? [{ id: hitEnemy!.id, label: hitEnemy!.label }] : []
    // ACT-I-003: kill reward, granted before the world ticks (a heal can't be "eaten" by this
    // turn's enemy attack ordering — the kill resolved first).
    const rewards: { id: string; heal: number; rotate: number }[] = []
    if (hit && !shielded && this.enemyHp[targetIdx] <= 0 && hitEnemy!.reward) {
      const heal = Math.max(0, Math.min(hitEnemy!.reward.heal ?? 0, this.playerMaxHp - this.playerHpValue))
      const rotate = hitEnemy!.reward.rotate ?? 0
      this.playerHpValue += heal
      if (rotate > 0) {
        if (this.rotatePool) {
          this.rotatePool.charges += rotate
          entry.poolReward = rotate
        } else this.bonusRotate += rotate
      }
      rewards.push({ id: hitEnemy!.id, heal, rotate })
    }
    // ACT-I-003: hit-triggered shift — a landed, non-killing hit knocks the target to its next side.
    const shifted: { id: string; from: Dir; to: Dir }[] = []
    if (hit && !shielded && this.enemyHp[targetIdx] > 0 && !this.isFled(targetIdx)) {
      const ab = abilitiesOf(hitEnemy!).find((a) => abilityKind(a) === 'shift' && (a as ShiftAbility).trigger === 'hit')
      if (ab) {
        const moved = this.shiftEnemy(targetIdx, ab as ShiftAbility)
        if (moved) shifted.push(moved)
      }
    }
    return { hit, hitDamage, hitTargetIdx, shieldConsumed, fled, rewards, shifted }
  }

  private tapEnemies(id: number, timerBefore: TimerSnapshot, keystoneTriggered = false): TapResult {
    const arenaDir = this.arenaDir(id)
    const entry: Entry = { kind: 'tap', id, hit: false, timerBefore }
    const targetIdx = this.targetIndexAt(arenaDir)
    const hit = targetIdx >= 0
    let du = 1
    let warHornTriggered = false
    let wasteConversionTriggered = false
    if (!hit) {
      if (this.hasRelic('waste_conversion')) {
        this.wasteConversionReady = true
      }
    } else {
      if (this.warHornActive) {
        du += 1
        this.warHornActive = false
        warHornTriggered = true
      }
      if (this.wasteConversionReady) {
        du += 1
        this.wasteConversionReady = false
        wasteConversionTriggered = true
      }
    }
    const res = this.landEnemyHit(arenaDir, du, entry)
    this.log.push(entry)
    const out = this.finishEnemiesTurn(arenaDir, res, true)
    if (out.ok) {
      if (keystoneTriggered) out.keystoneTriggered = true
      if (warHornTriggered) out.warHornTriggered = true
      if (wasteConversionTriggered) out.wasteConversionTriggered = true
    }
    return out
  }

  /** World advance after a projectile resolved (`advanceWorld` false = free action, e.g. a 0-cost item). */
  private finishEnemiesTurn(arenaDir: Dir, res: EnemyHitResolution, advanceWorld: boolean): TapResult {
    const { hit, hitDamage, hitTargetIdx, shieldConsumed, fled, rewards } = res
    let shifted = res.shifted
    let interrupted = false
    let castInterrupted = false
    let attacked = false
    let enemyDamage = 0
    let enemyAttacks: { id: string; damage: number }[] = []
    let pinExpired: number[] = []
    let pinnedThisTurn: { id: number; turnsLeft: number }[] = []
    let shieldRaised: { id: string }[] = []
    let healed: { id: string; target: string; amount: number }[] = []
    const expired: { id: string; label?: string }[] = []
    let arrived: { id: string }[] = []
    if (!this.won && advanceWorld) {
      // Not everyone required is dead yet (and the board isn't cleared alive): the world keeps
      // ticking for every enemy still standing, same rule as the boss's per-turn advance.
      const res = this.advanceEnemiesTurn(hitTargetIdx)
      interrupted = res.interrupted
      castInterrupted = res.castInterrupted
      attacked = res.attacked
      enemyDamage = res.damage
      enemyAttacks = res.attacks
      const pinRes = this.advancePinsAndAbilities()
      pinExpired = pinRes.pinExpired
      pinnedThisTurn = pinRes.pinnedThisTurn
      shieldRaised = pinRes.shieldRaised
      shifted = shifted.concat(pinRes.shifted)
      healed = pinRes.healed
      // ACT-I-003: the world turn is over — temporary targets whose window just closed leave now.
      const before = this.def.enemies!.map((_e, i) => this.isExpired(i))
      this.worldTurn++
      this.def.enemies!.forEach((e, i) => {
        if (!before[i] && this.isExpired(i) && this.enemyHp[i] > 0 && !this.isFled(i)) expired.push({ id: e.id, label: e.label })
      })
      arrived = this.resolveArrivals()
    }
    return {
      ok: true, arenaDir, hit, hitDamage, phaseBefore: 0, phaseAfter: 0, granted: 0,
      interrupted, castInterrupted, enemyAttacked: attacked, enemyDamage, enemyAttacks,
      pinExpired, pinnedThisTurn, shieldRaised, shifted, healed, rewards, expired, shieldConsumed, fled, arrived,
      playerHp: this.playerHpValue, won: this.won, lost: this.lost, playerDead: this.playerDead,
    }
  }

  private tapBoss(id: number, timerBefore: TimerSnapshot, keystoneTriggered = false): TapResult {
    const arenaDir = this.arenaDir(id)
    const entry: Entry = { kind: 'tap', id, hit: false, timerBefore }
    const hit = arenaDir === this.bossSide
    let du = 1
    let warHornTriggered = false
    let wasteConversionTriggered = false
    if (!hit) {
      if (this.hasRelic('waste_conversion')) {
        this.wasteConversionReady = true
      }
    } else {
      if (this.warHornActive) {
        du += 1
        this.warHornActive = false
        warHornTriggered = true
      }
      if (this.wasteConversionReady) {
        du += 1
        this.wasteConversionReady = false
        wasteConversionTriggered = true
      }
    }
    const out = this.landBossHitAndAdvance(arenaDir, du, entry, true)
    if (out.ok) {
      if (keystoneTriggered) out.keystoneTriggered = true
      if (warHornTriggered) out.warHornTriggered = true
      if (wasteConversionTriggered) out.wasteConversionTriggered = true
    }
    return out
  }

  /** Boss mode: a projectile of `du` hit-units lands on `arenaDir`, then (optionally) the world advances. */
  private landBossHitAndAdvance(arenaDir: Dir, du: number, entry: Entry & { kind: 'tap' | 'item' }, advanceWorld: boolean): TapResult {
    const phaseBefore = this.phaseIndex
    const hit = arenaDir === this.bossSide
    const hpBefore = this.hp
    // A multi-unit hit (Bow) stops at the phase boundary: the excess is not carried into a phase
    // that may stand on another side. A plain arrow (du 1) behaves exactly as before.
    const units = hit ? Math.min(du, this.phaseHpLeft) : 0
    if (hit) this.hitCount += units
    const hitDamage = hit ? hpBefore - this.hp : 0
    entry.hit = hit
    entry.units = units
    this.log.push(entry)
    const phaseAfter = this.phaseIndex
    const granted = phaseAfter !== phaseBefore ? this.grantedUpToPhase(phaseAfter) - this.grantedUpToPhase(phaseBefore) : 0

    let interrupted = false
    let castInterrupted = false
    let attacked = false
    let enemyDamage = 0
    if (this.won) {
      // Killed this turn: no retaliation, no timer processing (docs/COMBAT-RULES.md 8).
    } else if (phaseAfter !== phaseBefore) {
      // Moved to a new phase without dying: that phase's attack cycle starts fresh, uncharged by this tap.
      this.resetPhaseTimer(phaseAfter)
    } else if (advanceWorld) {
      const res = this.advanceTurn(hit)
      interrupted = res.interrupted
      castInterrupted = res.castInterrupted
      attacked = res.attacked
      enemyDamage = res.damage
    }
    if (!this.won && advanceWorld) this.worldTurn++
    return {
      ok: true, arenaDir, hit, hitDamage, phaseBefore, phaseAfter, granted,
      interrupted, castInterrupted, enemyAttacked: attacked, enemyDamage,
      playerHp: this.playerHpValue, won: this.won, lost: this.lost, playerDead: this.playerDead,
    }
  }

  /**
   * Spends one Rotate charge. Returns false if not allowed right now. Whether this costs a turn
   * (and can therefore tick the attack timer / trigger an enemy attack) is `def.rotate.advancesTurn`
   * — an explicit, provisional per-encounter switch, not a hardwired rule (docs/COMBAT-RULES.md 11).
   */
  rotate(turn: Turn): boolean {
    if (!this.canRotate(turn)) return false
    const timerBefore = this.timerSnapshot()
    this.rot = (this.rot + turn + 4) & 3
    let spentGyro = false
    if (this.localBonusRotate > 0) {
      this.localBonusRotate--
      spentGyro = true
    } else {
      this.rotates++
      if (this.rotatePool) {
        this.rotatePool.charges--
      }
    }
    this.log.push({ kind: 'rotate', turn, timerBefore, spentGyro })
    if (this.def.rotate.advancesTurn) {
      if (this.def.enemies) {
        this.advanceEnemiesTurn(-1)
        this.advancePinsAndAbilities()
      } else {
        this.advanceTurn(false)
      }
      this.worldTurn++
      if (this.def.enemies) this.resolveArrivals()
    }
    return true
  }

  apply(a: EncounterAction): boolean {
    if (a.kind === 'tap') return this.tap(a.id).ok
    if (a.kind === 'rotate') return this.rotate(a.turn)
    return this.useItem(a.id, a.target).ok
  }

  /** Reverts the last tap or rotate. Returns false if there is nothing to undo. Blocked taps are not
   * logged (as before EXP-010) and so cannot be undone individually — restart the encounter instead. */
  undo(): boolean {
    const e = this.log.pop()
    if (!e) return false
    this.restoreTimer(e.timerBefore)
    if (e.kind === 'tap') {
      this.board.undo()
      // Boss mode only: hitCount is derived state, not part of the timer snapshot. Enemies mode's
      // equivalent (per-enemy hp) is restored wholesale by restoreTimer above.
      if (!this.def.enemies && e.hit) this.hitCount -= e.units ?? 1
      // ACT-I-003: refund a kill reward that went into the shared pool.
      if (e.poolReward && this.rotatePool) this.rotatePool.charges -= e.poolReward
    } else if (e.kind === 'item') {
      // ITEM-001: refund the charge; a Bow kill reward that went to the pool is refunded too.
      if (this.inventory) this.inventory.slots[e.slot].charges++
      if (e.boardBefore) {
        // ITEM-001b: a spawned arrow is un-conjured — the old board object was never mutated.
        this.board = e.boardBefore
        this.levelValue = e.levelBefore
        this.pinTurnsLeft = this.pinTurnsLeft.slice(0, this.board.topo.arrowCount)
      }
      // Boss mode: hitCount is derived state, undo exactly the units this item landed.
      if (!this.def.enemies && e.hit) this.hitCount -= e.units ?? 0
      if (e.poolReward && this.rotatePool) this.rotatePool.charges -= e.poolReward
    } else {
      this.rot = (this.rot - e.turn + 4) & 3
      if (!e.spentGyro) {
        this.rotates--
        if (this.rotatePool) {
          this.rotatePool.charges++
        }
      }
    }
    return true
  }

  /** Search key: alive set + everything that affects the future. Includes `castInterrupted`/
   * `enemyCastInterrupted` (EXP-011): two states with the same hp/countdown but a different active
   * attack config (e.g. cast vs. its post-interrupt normal attack) must not be treated as equal.
   * EXP-013: also includes `pinTurnsLeft`/`enemyAbilityCountdown` -- `board.key()` only encodes the
   * alive set (geometric truth) and has no notion of pins, so two states with the same alive set but
   * a different pinned arrow (different playable-arrow set) MUST NOT collide here, or the solver
   * would treat a pinned and an unpinned board as the same search node.
   * COMBAT-001: also includes `enemyShield` — a shielded and an unshielded enemy take a different
   * number of future hits to kill. */
  key(): string {
    const pin = this.pinTurnsLeft.join(',')
    const buffState = `${this.warHornActive ? 1 : 0}|${this.wasteConversionReady ? 1 : 0}|${this.keystoneTriggered ? 1 : 0}|${this.localBonusRotate}`
    if (this.def.enemies) {
      const cd = this.enemyCountdown.map((c) => (Number.isFinite(c) ? c : 'inf')).join(',')
      const ci = this.enemyCastInterrupted.map((b) => (b ? 1 : 0)).join(',')
      const ac = this.enemyAbilityCountdown.map((cds) => cds.join('/')).join(',')
      const sh = this.enemyShield.map((b) => (b ? 1 : 0)).join(',')
      const sd = this.enemySide.join(',')
      const pending = this.enemyPending.map((b) => b ? 1 : 0).join(',')
      return `${this.board.key()}|${this.rot}|${this.rotates}|E|${this.enemyHp.join(',')}|${cd}|${this.enemyHitsThisCycle.join(',')}|${ci}|${ac}|${sh}|${sd}|${pin}|${this.playerHpValue}|${this.worldTurn}|${this.bonusRotate}|${pending}|${this.ward}|${this.itemKey()}|${buffState}`
    }
    const c = Number.isFinite(this.countdown) ? this.countdown : 'inf'
    return `${this.board.key()}|${this.rot}|${this.hitCount}|${this.rotates}|${c}|${this.hitsThisCycle}|${this.castInterrupted ? 1 : 0}|${pin}|${this.playerHpValue}|${this.ward}|${this.itemKey()}|${buffState}`
  }

  private itemKey(): string {
    return this.inventory ? this.inventory.slots.map((it) => `${it.id}:${it.charges}`).join(',') : ''
  }
}

function phaseAt(phaseEnd: readonly number[], hits: number): number {
  let i = 0
  while (i < phaseEnd.length && hits >= phaseEnd[i]) i++
  return i
}

function checkAttackTimer(at: AttackTimer, label: string): void {
  if (!Number.isInteger(at.interval) || at.interval < 1) throw new Error(`${label}: attackTimer.interval must be a positive integer`)
  if (!Number.isInteger(at.damage) || at.damage < 1) throw new Error(`${label}: attackTimer.damage must be a positive integer`)
  if (at.interruptHits !== undefined && (!Number.isInteger(at.interruptHits) || at.interruptHits < 1)) {
    throw new Error(`${label}: attackTimer.interruptHits must be a positive integer`)
  }
  if (at.kind !== undefined && at.kind !== 'normal' && at.kind !== 'cast') {
    throw new Error(`${label}: attackTimer.kind must be 'normal' or 'cast'`)
  }
  if (at.interruptible) {
    if (at.kind !== 'cast') throw new Error(`${label}: attackTimer.interruptible requires kind 'cast'`)
    if (!at.interruptedAttack) throw new Error(`${label}: attackTimer.interruptible requires interruptedAttack`)
  }
  if (at.interruptedAttack) checkAttackTimer(at.interruptedAttack, `${label}.interruptedAttack`)
}

const ABILITY_TARGET_POLICIES: readonly AbilityTargetPolicy[] = ['free-arrow']
const ABILITY_KINDS: readonly AbilityKind[] = ['stone_throw', 'shield', 'shift', 'heal']

function checkAbility(a: EnemyAbility, label: string): void {
  if (typeof a.id !== 'string' || a.id.length === 0) throw new Error(`${label}: ability.id must be a non-empty string`)
  if (a.kind !== undefined && !ABILITY_KINDS.includes(a.kind)) {
    throw new Error(`${label}: unknown ability.kind ${String(a.kind)}`)
  }
  if (!Number.isInteger(a.interval) || a.interval < 1) throw new Error(`${label}: ability.interval must be a positive integer`)
  if (abilityKind(a) === 'shield') {
    // A shield has no target: pin fields must not sneak in under a shield kind.
    const s = a as unknown as Record<string, unknown>
    if (s['targetPolicy'] !== undefined) throw new Error(`${label}: shield ability must not set targetPolicy`)
    if (s['pinDuration'] !== undefined) throw new Error(`${label}: shield ability must not set pinDuration`)
    return
  }
  if (abilityKind(a) === 'shift') {
    const sh = a as ShiftAbility
    if (!Array.isArray(sh.sides) || sh.sides.length < 2 || sh.sides.some((d) => ![0, 1, 2, 3].includes(d))) {
      throw new Error(`${label}: shift ability needs sides = at least two of 0..3`)
    }
    if (sh.trigger !== undefined && sh.trigger !== 'timer' && sh.trigger !== 'hit') throw new Error(`${label}: shift.trigger must be 'timer' or 'hit'`)
    return
  }
  if (abilityKind(a) === 'heal') {
    const h = a as HealAbility
    if (h.amount !== undefined && (!Number.isInteger(h.amount) || h.amount < 1)) throw new Error(`${label}: heal.amount must be a positive integer`)
    return
  }
  const st = a as StoneThrowAbility
  if (!Number.isInteger(st.pinDuration) || st.pinDuration < 1) throw new Error(`${label}: ability.pinDuration must be a positive integer`)
  if (!ABILITY_TARGET_POLICIES.includes(st.targetPolicy)) {
    throw new Error(`${label}: unknown ability.targetPolicy ${String(st.targetPolicy)}`)
  }
}

export function checkEncounter(def: EncounterDef): void {
  const hasBoss = !!def.boss
  const hasEnemies = !!def.enemies && def.enemies.length > 0
  if (hasBoss === hasEnemies) throw new Error('encounter needs exactly one of boss (sequential phases) or enemies (simultaneous)')
  if (hasBoss) {
    const phases = def.boss!.phases
    if (!Array.isArray(phases) || phases.length === 0) throw new Error('encounter needs at least one boss phase')
    phases.forEach((p, i) => {
      if (![0, 1, 2, 3].includes(p.side)) throw new Error(`phase ${i}: bad side`)
      if (!Number.isInteger(p.hpUnits) || p.hpUnits < 1) throw new Error(`phase ${i}: hpUnits must be a positive integer`)
      if (p.grantRotate !== undefined && (!Number.isInteger(p.grantRotate) || p.grantRotate < 0)) {
        throw new Error(`phase ${i}: bad grantRotate`)
      }
      if (p.attackTimer) checkAttackTimer(p.attackTimer, `phase ${i}`)
    })
  } else {
    def.enemies!.forEach((e, i) => {
      if (typeof e.id !== 'string' || !e.id || def.enemies!.findIndex((other) => other.id === e.id) !== i) throw new Error(`enemy ${i}: id must be non-empty and unique`)
      if (e.arrival !== undefined) {
        const a = e.arrival
        if (!a || typeof a !== 'object' || (a.afterKill === undefined && a.onTurn === undefined)) throw new Error(`enemy ${i}: arrival needs afterKill or onTurn`)
        if (a.onTurn !== undefined && (!Number.isInteger(a.onTurn) || a.onTurn < 1)) throw new Error(`enemy ${i}: arrival.onTurn must be a positive integer`)
        if (a.afterKill !== undefined && !def.enemies!.some((other) => other.id === a.afterKill)) throw new Error(`enemy ${i}: arrival.afterKill references unknown id ${a.afterKill}`)
      }
      if (![0, 1, 2, 3].includes(e.side)) throw new Error(`enemy ${i}: bad side`)
      if (!Number.isInteger(e.hp) || e.hp < 1) throw new Error(`enemy ${i}: hp must be a positive integer`)
      if (e.attackTimer) checkAttackTimer(e.attackTimer, `enemy ${i}`)
      if (e.ability) checkAbility(e.ability, `enemy ${i}`)
      if (e.abilities !== undefined) {
        if (!Array.isArray(e.abilities)) throw new Error(`enemy ${i}: abilities must be an array`)
        e.abilities.forEach((a, k) => checkAbility(a, `enemy ${i} ability ${k}`))
      }
      if (e.reward !== undefined) {
        if (e.reward.heal !== undefined && (!Number.isInteger(e.reward.heal) || e.reward.heal < 0)) throw new Error(`enemy ${i}: reward.heal must be a non-negative integer`)
        if (e.reward.rotate !== undefined && (!Number.isInteger(e.reward.rotate) || e.reward.rotate < 0)) throw new Error(`enemy ${i}: reward.rotate must be a non-negative integer`)
      }
      if (e.expiresAfter !== undefined) {
        if (!Number.isInteger(e.expiresAfter) || e.expiresAfter < 1) throw new Error(`enemy ${i}: expiresAfter must be a positive integer`)
        if (e.mandatory !== false) throw new Error(`enemy ${i}: expiresAfter requires mandatory: false (a vanished mandatory target could only end by board clear)`)
      }
      if (e.flee !== undefined) {
        // STORY-001: the flee must be reachable before death could take the enemy — otherwise
        // the scripted event could never fire and the "unkillable" contract would be a lie.
        if (!Number.isInteger(e.flee.afterHits) || e.flee.afterHits < 1) {
          throw new Error(`enemy ${i}: flee.afterHits must be a positive integer`)
        }
        if (e.flee.afterHits >= e.hp) {
          throw new Error(`enemy ${i}: flee.afterHits (${e.flee.afterHits}) must be below hp (${e.hp}) so the flee fires before death`)
        }
      }
    })
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const visitArrival = (e: EnemyDef): void => {
      if (visiting.has(e.id)) throw new Error(`arrival.afterKill dependency cycle at ${e.id}`)
      if (visited.has(e.id)) return
      visiting.add(e.id)
      if (e.arrival?.afterKill !== undefined) visitArrival(def.enemies!.find((other) => other.id === e.arrival!.afterKill)!)
      visiting.delete(e.id)
      visited.add(e.id)
    }
    def.enemies!.forEach(visitArrival)
  }
  if (!Array.isArray(def.rotate?.allow) || def.rotate.allow.some((t) => t !== 1 && t !== -1)) {
    throw new Error('rotate.allow must list 1 (cw) and/or -1 (ccw)')
  }
  if (def.rotate.useRunPool !== undefined && typeof def.rotate.useRunPool !== 'boolean') {
    throw new Error('rotate.useRunPool must be a boolean')
  }
  if (def.rotate.useRunPool) {
    // RUN-001: a pool-backed encounter must not also carry encounter-local grants — mixing the
    // two would let local Rotate leak into (or double-count against) the shared run pool.
    if (def.rotateCharges !== undefined) {
      throw new Error('rotate.useRunPool cannot be combined with rotateCharges (encounter-local grant)')
    }
    if (def.boss && def.boss.phases.some((p) => (p.grantRotate ?? 0) > 0)) {
      throw new Error('rotate.useRunPool cannot be combined with phase grantRotate (encounter-local grant)')
    }
  }
  if (def.winRotateReward !== undefined && (!Number.isInteger(def.winRotateReward) || def.winRotateReward < 0)) {
    throw new Error('winRotateReward must be a non-negative integer')
  }
  if (def.winHeal !== undefined && (!Number.isInteger(def.winHeal) || def.winHeal < 0)) {
    throw new Error('winHeal must be a non-negative integer')
  }
  if (def.blockedTapDamage !== undefined && (!Number.isInteger(def.blockedTapDamage) || def.blockedTapDamage < 0)) {
    throw new Error('blockedTapDamage must be a non-negative integer')
  }
  if (def.rotateCharges !== undefined && (!Number.isInteger(def.rotateCharges) || def.rotateCharges < 0)) {
    throw new Error('rotateCharges must be a non-negative integer')
  }
  if (def.presentation !== undefined) {
    if (typeof def.presentation !== 'object' || def.presentation === null) {
      throw new Error('presentation must be an object')
    }
    if (def.presentation.arena !== undefined && typeof def.presentation.arena !== 'string') {
      throw new Error('presentation.arena must be a string')
    }
    if (def.presentation.calibration !== undefined && typeof def.presentation.calibration !== 'string') {
      throw new Error('presentation.calibration must be a string')
    }
  }
}

// ---------------------------------------------------------------------------------------------
// File format: a hand-authored encounter pinned to a generated board.

export const ENCOUNTER_FORMAT = 'arrow-core-encounter'

export interface EncounterFile {
  format: typeof ENCOUNTER_FORMAT
  v: 1
  /** BUILD-024: optional presentation / arena metadata at file level. */
  presentation?: ArenaPresentation
  /** The board is regenerated from preset + seed; `levelHash` catches generator drift. */
  board: { preset: PresetName; seed: number; levelHash: string }
  encounter: EncounterDef
}

const SIDE_BY_NAME: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 }

/** Accepts sides as 0..3 or "N"/"E"/"S"/"W", and turns as 1/-1 or "cw"/"ccw". */
export function encounterFromJson(raw: unknown): { file: EncounterFile; level: Level } {
  const j = raw as EncounterFile
  if (!j || j.format !== ENCOUNTER_FORMAT) throw new Error('not an arrow-core encounter')
  if (j.v !== 1) throw new Error(`unsupported encounter version ${String(j.v)}`)
  const { preset, seed, levelHash: expected } = j.board ?? ({} as EncounterFile['board'])
  if (!(preset in PRESETS)) throw new Error(`unknown preset ${String(preset)}`)
  const res = generateLevel(PRESETS[preset], seed >>> 0)
  if (!res.ok || !res.level) throw new Error(`preset ${preset} seed ${seed}: generation failed`)
  const hash = levelHash(res.level)
  if (expected && hash !== expected) {
    throw new Error(`board drift: preset ${preset} seed ${seed} now hashes to ${hash}, file expects ${expected}`)
  }
  const presentation = j.encounter?.presentation ?? j.presentation
  const def: EncounterDef = {
    ...j.encounter,
    presentation,
    boss: j.encounter.boss
      ? {
          ...j.encounter.boss,
          phases: j.encounter.boss.phases.map((p) => ({
            ...p,
            side: typeof p.side === 'string' ? SIDE_BY_NAME[p.side as string] : p.side,
          })),
        }
      : undefined,
    enemies: j.encounter.enemies
      ? j.encounter.enemies.map((en) => ({
          ...en,
          side: typeof en.side === 'string' ? SIDE_BY_NAME[en.side as string] : en.side,
        }))
      : undefined,
    rotate: {
      ...j.encounter.rotate,
      allow: j.encounter.rotate.allow.map((t) => ((t as unknown) === 'cw' ? 1 : (t as unknown) === 'ccw' ? -1 : t)),
    },
  }
  checkEncounter(def)
  return { file: { ...j, presentation, encounter: def }, level: res.level }
}

export function encounterToJson(file: EncounterFile): unknown {
  const e = file.encounter
  return {
    ...file,
    encounter: {
      ...e,
      boss: e.boss ? { ...e.boss, phases: e.boss.phases.map((p) => ({ ...p, side: DIR_NAMES[p.side] })) } : undefined,
      enemies: e.enemies ? e.enemies.map((en) => ({ ...en, side: DIR_NAMES[en.side] })) : undefined,
      rotate: { ...e.rotate, allow: e.rotate.allow.map((t) => (t === 1 ? 'cw' : 'ccw')) },
    },
  }
}

export const formatAction = (a: EncounterAction): string =>
  a.kind === 'tap' ? `tap #${a.id}` : a.kind === 'rotate' ? `rotate ${a.turn === 1 ? 'cw' : 'ccw'}` : `item ${a.id}${a.target !== undefined ? ` -> ${DIR_NAMES[a.target]}` : ''}`
