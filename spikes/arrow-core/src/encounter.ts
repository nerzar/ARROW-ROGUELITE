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

/**
 * Enemy `ATTACK IN N` telegraph. Ticks down by one every turn regardless of hit/miss and hits the
 * player at 0, then resets. A landed hit deals its damage to the target and nothing else UNLESS
 * `interruptOnHit` is set — that is a separate, explicit opt-in (docs/COMBAT-RULES.md 5), off by
 * default, and not used by any EXP-010 prologue encounter.
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

export interface EncounterDef {
  id: string
  title?: string
  boss: { id: string; phases: BossPhase[] }
  /** Which quarter turns a Rotate charge may perform, and whether spending one costs a turn. */
  rotate: { allow: Turn[]; advancesTurn?: boolean }
  /** HP lost on a blocked tap. Default 0 (no HP consequence — EXP-009 behaviour, still used by E1). */
  blockedTapDamage?: number
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
      phaseBefore: number
      phaseAfter: number
      /** Rotate charges granted by the phase this hit started. */
      granted: number
      /** This hit interrupted (reset) the active phase's attack timer. */
      interrupted: boolean
      /** The active phase's attack timer reached 0 this turn and hit the player. */
      enemyAttacked: boolean
      enemyDamage: number
      playerHp: number
      won: boolean
      lost: boolean
      playerDead: boolean
    }

interface TimerSnapshot {
  countdown: number
  hitsThisCycle: number
  playerHp: number
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
  /** Turns left in the active phase's attack cycle; Infinity when the phase has no attackTimer. */
  private countdown = Infinity
  /** Landed hits accumulated toward the active attackTimer's interruptHits threshold. */
  private hitsThisCycle = 0
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
    let hp = 0
    let granted = 0
    this.phaseEnd = []
    this.grantedUpTo = []
    for (const p of def.boss.phases) {
      hp += p.hpUnits
      granted += p.grantRotate ?? 0
      this.phaseEnd.push(hp)
      this.grantedUpTo.push(granted)
    }
    this.totalHp = hp
    this.resetPhaseTimer(0)
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
  get hits(): number {
    return this.hitCount
  }
  get hp(): number {
    return this.totalHp - this.hitCount
  }
  get rotatesUsed(): number {
    return this.rotates
  }
  /**
   * Two standard win paths (docs/COMBAT-RULES.md 8): the target is killed, or the board is fully
   * cleared while the player is still alive. Running out of arrows that can reach a live target is
   * *not* an automatic loss — the player keeps clearing the rest of the puzzle under fire.
   */
  get won(): boolean {
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
  get bossSide(): Dir | -1 {
    const i = this.phaseIndex
    return i < this.def.boss.phases.length ? this.def.boss.phases[i].side : -1
  }
  /** Hits still needed to finish the active phase. */
  get phaseHpLeft(): number {
    const i = this.phaseIndex
    return i < this.phaseEnd.length ? this.phaseEnd[i] - this.hitCount : 0
  }
  get rotateCharges(): number {
    return this.grantedUpToPhase(this.phaseIndex) - this.rotates
  }
  get actions(): EncounterAction[] {
    return this.log.map((e) => (e.kind === 'tap' ? { kind: 'tap', id: e.id } : { kind: 'rotate', turn: e.turn }))
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

  wouldHit(id: number): boolean {
    return !this.over && this.board.canExit(id) && this.arenaDir(id) === this.bossSide
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
    return { countdown: this.countdown, hitsThisCycle: this.hitsThisCycle, playerHp: this.playerHpValue }
  }
  private restoreTimer(t: TimerSnapshot): void {
    this.countdown = t.countdown
    this.hitsThisCycle = t.hitsThisCycle
    this.playerHpValue = t.playerHp
  }

  /** Resets the attack-cycle countdown for phase `i` (called on encounter start and phase change). */
  private resetPhaseTimer(i: number): void {
    const at = this.def.boss.phases[i]?.attackTimer
    this.countdown = at?.interval ?? Infinity
    this.hitsThisCycle = 0
  }

  /**
   * Advances the active phase's attack timer by one turn. `hitLanded` is whether this turn's tap
   * hit the boss (a rotate never hits). Per docs/COMBAT-RULES.md 5, a landed hit only damages the
   * target and the countdown ticks down exactly like a miss would — UNLESS this phase's
   * `attackTimer.interruptOnHit` explicitly opts in, in which case reaching `interruptHits` resets
   * the cycle instead of ticking it down (no EXP-010 prologue encounter turns this on). Returns
   * what happened for the caller to report.
   */
  private advanceTurn(hitLanded: boolean): { interrupted: boolean; attacked: boolean; damage: number } {
    const at = this.def.boss.phases[Math.min(this.phaseIndex, this.def.boss.phases.length - 1)]?.attackTimer
    if (!at || this.phaseIndex >= this.def.boss.phases.length) return { interrupted: false, attacked: false, damage: 0 }
    if (at.interruptOnHit && hitLanded) {
      this.hitsThisCycle++
      if (this.hitsThisCycle >= (at.interruptHits ?? 1)) {
        this.countdown = at.interval
        this.hitsThisCycle = 0
        return { interrupted: true, attacked: false, damage: 0 }
      }
    }
    this.countdown--
    if (this.countdown <= 0) {
      this.playerHpValue = Math.max(0, this.playerHpValue - at.damage)
      this.countdown = at.interval
      this.hitsThisCycle = 0
      return { interrupted: false, attacked: true, damage: at.damage }
    }
    return { interrupted: false, attacked: false, damage: 0 }
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
    const timerBefore = this.timerSnapshot()
    const arenaDir = this.arenaDir(id)
    const phaseBefore = this.phaseIndex
    const hit = arenaDir === this.bossSide
    if (hit) this.hitCount++
    this.log.push({ kind: 'tap', id, hit, timerBefore })
    const phaseAfter = this.phaseIndex
    const granted = phaseAfter !== phaseBefore ? this.grantedUpToPhase(phaseAfter) - this.grantedUpToPhase(phaseBefore) : 0

    let interrupted = false
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
      attacked = res.attacked
      enemyDamage = res.damage
    }
    return {
      ok: true, arenaDir, hit, phaseBefore, phaseAfter, granted,
      interrupted, enemyAttacked: attacked, enemyDamage,
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
    if (this.def.rotate.advancesTurn) this.advanceTurn(false)
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
      if (e.hit) this.hitCount--
    } else {
      this.rot = (this.rot - e.turn + 4) & 3
      this.rotates--
    }
    return true
  }

  /** Search key: alive set + everything that affects the future. */
  key(): string {
    const c = Number.isFinite(this.countdown) ? this.countdown : 'inf'
    return `${this.board.key()}|${this.rot}|${this.hitCount}|${this.rotates}|${c}|${this.hitsThisCycle}|${this.playerHpValue}`
  }
}

function phaseAt(phaseEnd: readonly number[], hits: number): number {
  let i = 0
  while (i < phaseEnd.length && hits >= phaseEnd[i]) i++
  return i
}

export function checkEncounter(def: EncounterDef): void {
  const phases = def.boss?.phases
  if (!Array.isArray(phases) || phases.length === 0) throw new Error('encounter needs at least one boss phase')
  phases.forEach((p, i) => {
    if (![0, 1, 2, 3].includes(p.side)) throw new Error(`phase ${i}: bad side`)
    if (!Number.isInteger(p.hpUnits) || p.hpUnits < 1) throw new Error(`phase ${i}: hpUnits must be a positive integer`)
    if (p.grantRotate !== undefined && (!Number.isInteger(p.grantRotate) || p.grantRotate < 0)) {
      throw new Error(`phase ${i}: bad grantRotate`)
    }
    if (p.attackTimer) {
      const at = p.attackTimer
      if (!Number.isInteger(at.interval) || at.interval < 1) throw new Error(`phase ${i}: attackTimer.interval must be a positive integer`)
      if (!Number.isInteger(at.damage) || at.damage < 1) throw new Error(`phase ${i}: attackTimer.damage must be a positive integer`)
      if (at.interruptHits !== undefined && (!Number.isInteger(at.interruptHits) || at.interruptHits < 1)) {
        throw new Error(`phase ${i}: attackTimer.interruptHits must be a positive integer`)
      }
    }
  })
  if (!Array.isArray(def.rotate?.allow) || def.rotate.allow.some((t) => t !== 1 && t !== -1)) {
    throw new Error('rotate.allow must list 1 (cw) and/or -1 (ccw)')
  }
  if (def.blockedTapDamage !== undefined && (!Number.isInteger(def.blockedTapDamage) || def.blockedTapDamage < 0)) {
    throw new Error('blockedTapDamage must be a non-negative integer')
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
    boss: {
      ...j.encounter.boss,
      phases: j.encounter.boss.phases.map((p) => ({
        ...p,
        side: typeof p.side === 'string' ? SIDE_BY_NAME[p.side as string] : p.side,
      })),
    },
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
      boss: { ...e.boss, phases: e.boss.phases.map((p) => ({ ...p, side: DIR_NAMES[p.side] })) },
      rotate: { ...e.rotate, allow: e.rotate.allow.map((t) => (t === 1 ? 'cw' : 'ccw')) },
    },
  }
}

export const formatAction = (a: EncounterAction): string =>
  a.kind === 'tap' ? `tap #${a.id}` : `rotate ${a.turn === 1 ? 'cw' : 'ccw'}`
