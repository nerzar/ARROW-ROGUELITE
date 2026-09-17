import { type Dir, DIR_NAMES, rotateDir } from './dir.js'
import { generateLevel } from './generator.js'
import { type Level, levelHash } from './level.js'
import { PRESETS, type PresetName } from './presets.js'
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
 * EXP-010b: one of possibly several enemies alive at the same time (`def.enemies`), each with its
 * own side/HP/attackTimer, independent of every other enemy in the encounter. Unlike `BossPhase`
 * these do not sequence — all alive enemies exist and attack in parallel from encounter start.
 */
export interface EnemyDef {
  /** Stable id, e.g. for viewer labels and attack attribution. */
  id: string
  /** Arena side this enemy is vulnerable from. */
  side: Dir
  /** Hits (hit-units) this enemy absorbs before it dies. */
  hp: number
  /** Must this enemy die for `won`? Default true. An optional enemy never blocks a win by itself. */
  mandatory?: boolean
  /** `ATTACK IN N` for this enemy. Absent = this enemy never attacks. */
  attackTimer?: AttackTimer
  label?: string
}

export interface EncounterDef {
  id: string
  title?: string
  /** Sequential single-target boss (EXP-008/009/010). Exactly one of `boss`/`enemies` is set. */
  boss?: { id: string; phases: BossPhase[] }
  /** Simultaneous regular enemies (EXP-010b). Exactly one of `boss`/`enemies` is set. */
  enemies?: EnemyDef[]
  /** Which quarter turns a Rotate charge may perform, and whether spending one costs a turn. */
  rotate: { allow: Turn[]; advancesTurn?: boolean }
  /** HP lost on a blocked tap. Default 0 (no HP consequence — EXP-009 behaviour, still used by E1). */
  blockedTapDamage?: number
  /** Rotate charges available from the start, for `enemies`-mode encounters (no phases to grant them). */
  rotateCharges?: number
  notes?: string
}

export type EncounterAction = { kind: 'tap'; id: number } | { kind: 'rotate'; turn: Turn }

export type TapResult =
  | { ok: false; reason: 'over' | 'gone'; blocker: -1 }
  | { ok: false; reason: 'blocked'; blocker: number; damage: number; playerHp: number; playerDead: boolean }
  | {
      ok: true
      /** Direction the projectile flies in the arena (board-local dir + rotation). */
      arenaDir: Dir
      hit: boolean
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
      playerHp: number
      won: boolean
      lost: boolean
      playerDead: boolean
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
}

type Entry = ({ kind: 'tap'; id: number; hit: boolean } | { kind: 'rotate'; turn: Turn }) & { timerBefore: TimerSnapshot }

export class EncounterState {
  readonly def: EncounterDef
  readonly board: BoardState
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
  private playerHpValue: number
  /** The HP this encounter started with (constructor param), needed to replay it exactly in clone(). */
  readonly playerHpStart: number
  private readonly log: Entry[] = []

  constructor(topo: BoardTopology, def: EncounterDef, playerHp = DEFAULT_PLAYER_HP) {
    checkEncounter(def)
    this.def = def
    this.board = new BoardState(topo)
    this.playerHpValue = playerHp
    this.playerHpStart = playerHp
    this.phaseEnd = []
    this.grantedUpTo = []
    if (def.enemies) {
      this.totalHp = def.enemies.reduce((s, e) => s + e.hp, 0)
      this.enemyHp = def.enemies.map((e) => e.hp)
      this.enemyCountdown = def.enemies.map((e) => e.attackTimer?.interval ?? Infinity)
      this.enemyHitsThisCycle = def.enemies.map(() => 0)
      this.enemyCastInterrupted = def.enemies.map(() => false)
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

  static fromLevel(level: Level, def: EncounterDef, playerHp = DEFAULT_PLAYER_HP): EncounterState {
    return new EncounterState(BoardTopology.fromLevel(level), def, playerHp)
  }

  clone(): EncounterState {
    const c = new EncounterState(this.board.topo, this.def, this.playerHpStart)
    for (const e of this.log) {
      if (e.kind === 'tap') c.tap(e.id)
      else c.rotate(e.turn)
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
   * enemy explicitly marked `mandatory: false` never blocks a win by itself.
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
  /** Boss mode: charges granted by phases reached so far. Enemies mode: `def.rotateCharges` flat pool. */
  get rotateCharges(): number {
    if (this.def.enemies) return (this.def.rotateCharges ?? 0) - this.rotates
    return this.grantedUpToPhase(this.phaseIndex) - this.rotates
  }
  get actions(): EncounterAction[] {
    return this.log.map((e) => (e.kind === 'tap' ? { kind: 'tap', id: e.id } : { kind: 'rotate', turn: e.turn }))
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
    countdown: number
    mandatory: boolean
    label?: string
    /** EXP-011: this enemy's current attack type, or undefined if it has no attackTimer. */
    attackKind?: AttackKind
  }[] {
    if (!this.def.enemies) return []
    return this.def.enemies.map((e, i) => {
      const at = this.currentEnemyAttackTimer(i)
      return {
        id: e.id,
        side: e.side,
        hp: Math.max(0, this.enemyHp[i]),
        hpMax: e.hp,
        dead: this.enemyHp[i] <= 0,
        countdown: this.enemyCountdown[i],
        mandatory: e.mandatory ?? true,
        label: e.label,
        attackKind: at ? (at.kind ?? 'normal') : undefined,
      }
    })
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

  /** Enemies mode: the first alive enemy standing on `side`, or -1 (at most one is expected per side
   * at this spike's scale — see docs/LEVEL-DESIGNER.md; targeting UI for several is out of scope). */
  private targetIndexAt(side: Dir): number {
    if (!this.def.enemies) return -1
    return this.def.enemies.findIndex((e, i) => e.side === side && this.enemyHp[i] > 0)
  }

  wouldHit(id: number): boolean {
    if (this.over || !this.board.canExit(id)) return false
    const dir = this.arenaDir(id)
    return this.def.enemies ? this.targetIndexAt(dir) >= 0 : dir === this.bossSide
  }

  /** Alive arrows by arena direction [N, E, S, W]. */
  aliveByArenaDir(freeOnly = false): [number, number, number, number] {
    const c: [number, number, number, number] = [0, 0, 0, 0]
    const b = this.board
    for (let id = 0; id < b.topo.arrowCount; id++) {
      if (freeOnly ? b.canExit(id) : b.isAlive(id)) c[this.arenaDir(id)]++
    }
    return c
  }

  canRotate(turn: Turn): boolean {
    return !this.over && this.rotateCharges > 0 && this.def.rotate.allow.includes(turn)
  }

  private timerSnapshot(): TimerSnapshot {
    if (this.def.enemies) {
      return {
        playerHp: this.playerHpValue,
        enemyHp: [...this.enemyHp],
        enemyCountdown: [...this.enemyCountdown],
        enemyHitsThisCycle: [...this.enemyHitsThisCycle],
        enemyCastInterrupted: [...this.enemyCastInterrupted],
      }
    }
    return {
      playerHp: this.playerHpValue,
      countdown: this.countdown,
      hitsThisCycle: this.hitsThisCycle,
      castInterrupted: this.castInterrupted,
    }
  }
  private restoreTimer(t: TimerSnapshot): void {
    this.playerHpValue = t.playerHp
    if (this.def.enemies) {
      this.enemyHp = t.enemyHp!
      this.enemyCountdown = t.enemyCountdown!
      this.enemyHitsThisCycle = t.enemyHitsThisCycle!
      this.enemyCastInterrupted = t.enemyCastInterrupted!
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
      this.playerHpValue = Math.max(0, this.playerHpValue - at.damage)
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
   * per-encounter. Per-enemy interrupt precedence mirrors `advanceTurn`: EXP-011 cast-interrupt first,
   * then the EXP-010 legacy `interruptOnHit` reset, then the plain tick.
   */
  private advanceEnemiesTurn(hitTargetIdx: number): { interrupted: boolean; castInterrupted: boolean; attacked: boolean; damage: number; attacks: { id: string; damage: number }[] } {
    let interrupted = false
    let castInterrupted = false
    let attacked = false
    let damage = 0
    const attacks: { id: string; damage: number }[] = []
    for (let i = 0; i < this.enemyHp.length; i++) {
      if (this.enemyHp[i] <= 0) continue
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
        this.playerHpValue = Math.max(0, this.playerHpValue - at.damage)
        this.enemyCountdown[i] = at.interval
        this.enemyHitsThisCycle[i] = 0
        attacked = true
        damage += at.damage
        attacks.push({ id: this.def.enemies![i].id, damage: at.damage })
      }
    }
    return { interrupted, castInterrupted, attacked, damage, attacks }
  }

  tap(id: number): TapResult {
    if (this.over) return { ok: false, reason: 'over', blocker: -1 }
    const r = this.board.tryRemove(id)
    if (!r.ok) {
      if (r.reason === 'gone') return r as { ok: false; reason: 'gone'; blocker: -1 }
      const damage = this.def.blockedTapDamage ?? 0
      this.playerHpValue = Math.max(0, this.playerHpValue - damage)
      return { ok: false, reason: 'blocked', blocker: r.blocker, damage, playerHp: this.playerHpValue, playerDead: this.playerDead }
    }
    return this.def.enemies ? this.tapEnemies(id) : this.tapBoss(id)
  }

  private tapEnemies(id: number): TapResult {
    const timerBefore = this.timerSnapshot()
    const arenaDir = this.arenaDir(id)
    const targetIdx = this.targetIndexAt(arenaDir)
    const hit = targetIdx >= 0
    if (hit) this.enemyHp[targetIdx] = Math.max(0, this.enemyHp[targetIdx] - 1)
    this.log.push({ kind: 'tap', id, hit, timerBefore })

    let interrupted = false
    let castInterrupted = false
    let attacked = false
    let enemyDamage = 0
    let enemyAttacks: { id: string; damage: number }[] = []
    if (!this.won) {
      // Not everyone required is dead yet (and the board isn't cleared alive): the world keeps
      // ticking for every enemy still standing, same rule as the boss's per-turn advance.
      const res = this.advanceEnemiesTurn(targetIdx)
      interrupted = res.interrupted
      castInterrupted = res.castInterrupted
      attacked = res.attacked
      enemyDamage = res.damage
      enemyAttacks = res.attacks
    }
    return {
      ok: true, arenaDir, hit, phaseBefore: 0, phaseAfter: 0, granted: 0,
      interrupted, castInterrupted, enemyAttacked: attacked, enemyDamage, enemyAttacks,
      playerHp: this.playerHpValue, won: this.won, lost: this.lost, playerDead: this.playerDead,
    }
  }

  private tapBoss(id: number): TapResult {
    const timerBefore = this.timerSnapshot()
    const arenaDir = this.arenaDir(id)
    const phaseBefore = this.phaseIndex
    const hit = arenaDir === this.bossSide
    if (hit) this.hitCount++
    this.log.push({ kind: 'tap', id, hit, timerBefore })
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
    } else {
      const res = this.advanceTurn(hit)
      interrupted = res.interrupted
      castInterrupted = res.castInterrupted
      attacked = res.attacked
      enemyDamage = res.damage
    }
    return {
      ok: true, arenaDir, hit, phaseBefore, phaseAfter, granted,
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
    this.rotates++
    this.log.push({ kind: 'rotate', turn, timerBefore })
    if (this.def.rotate.advancesTurn) {
      if (this.def.enemies) this.advanceEnemiesTurn(-1)
      else this.advanceTurn(false)
    }
    return true
  }

  apply(a: EncounterAction): boolean {
    return a.kind === 'tap' ? this.tap(a.id).ok : this.rotate(a.turn)
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
      if (!this.def.enemies && e.hit) this.hitCount--
    } else {
      this.rot = (this.rot - e.turn + 4) & 3
      this.rotates--
    }
    return true
  }

  /** Search key: alive set + everything that affects the future. Includes `castInterrupted`/
   * `enemyCastInterrupted` (EXP-011): two states with the same hp/countdown but a different active
   * attack config (e.g. cast vs. its post-interrupt normal attack) must not be treated as equal. */
  key(): string {
    if (this.def.enemies) {
      const cd = this.enemyCountdown.map((c) => (Number.isFinite(c) ? c : 'inf')).join(',')
      const ci = this.enemyCastInterrupted.map((b) => (b ? 1 : 0)).join(',')
      return `${this.board.key()}|${this.rot}|${this.rotates}|E|${this.enemyHp.join(',')}|${cd}|${this.enemyHitsThisCycle.join(',')}|${ci}|${this.playerHpValue}`
    }
    const c = Number.isFinite(this.countdown) ? this.countdown : 'inf'
    return `${this.board.key()}|${this.rot}|${this.hitCount}|${this.rotates}|${c}|${this.hitsThisCycle}|${this.castInterrupted ? 1 : 0}|${this.playerHpValue}`
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
      if (![0, 1, 2, 3].includes(e.side)) throw new Error(`enemy ${i}: bad side`)
      if (!Number.isInteger(e.hp) || e.hp < 1) throw new Error(`enemy ${i}: hp must be a positive integer`)
      if (e.attackTimer) checkAttackTimer(e.attackTimer, `enemy ${i}`)
    })
  }
  if (!Array.isArray(def.rotate?.allow) || def.rotate.allow.some((t) => t !== 1 && t !== -1)) {
    throw new Error('rotate.allow must list 1 (cw) and/or -1 (ccw)')
  }
  if (def.blockedTapDamage !== undefined && (!Number.isInteger(def.blockedTapDamage) || def.blockedTapDamage < 0)) {
    throw new Error('blockedTapDamage must be a non-negative integer')
  }
  if (def.rotateCharges !== undefined && (!Number.isInteger(def.rotateCharges) || def.rotateCharges < 0)) {
    throw new Error('rotateCharges must be a non-negative integer')
  }
}

// ---------------------------------------------------------------------------------------------
// File format: a hand-authored encounter pinned to a generated board.

export const ENCOUNTER_FORMAT = 'arrow-core-encounter'

export interface EncounterFile {
  format: typeof ENCOUNTER_FORMAT
  v: 1
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
  const def: EncounterDef = {
    ...j.encounter,
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
  return { file: { ...j, encounter: def }, level: res.level }
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
  a.kind === 'tap' ? `tap #${a.id}` : `rotate ${a.turn === 1 ? 'cw' : 'ccw'}`
