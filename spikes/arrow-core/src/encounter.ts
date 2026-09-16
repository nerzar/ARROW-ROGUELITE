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
 */

/** +1 = 90° clockwise, -1 = 90° counter-clockwise. */
export type Turn = 1 | -1

export interface BossPhase {
  /** Arena side where the boss is vulnerable during this phase. */
  side: Dir
  /** Hits (hit-units) this phase absorbs before the next phase starts. */
  hpUnits: number
  /** Rotate charges granted when this phase starts. */
  grantRotate?: number
  label?: string
}

export interface EncounterDef {
  id: string
  title?: string
  boss: { id: string; phases: BossPhase[] }
  /** Which quarter turns a Rotate charge may perform. */
  rotate: { allow: Turn[] }
  notes?: string
}

export type EncounterAction = { kind: 'tap'; id: number } | { kind: 'rotate'; turn: Turn }

export type TapResult =
  | { ok: false; reason: 'over' | 'gone' | 'blocked'; blocker: number }
  | {
      ok: true
      /** Direction the projectile flies in the arena (board-local dir + rotation). */
      arenaDir: Dir
      hit: boolean
      phaseBefore: number
      phaseAfter: number
      /** Rotate charges granted by the phase this hit started. */
      granted: number
      won: boolean
      lost: boolean
    }

type Entry = { kind: 'tap'; id: number; hit: boolean } | { kind: 'rotate'; turn: Turn }

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
  private readonly log: Entry[] = []

  constructor(topo: BoardTopology, def: EncounterDef) {
    checkEncounter(def)
    this.def = def
    this.board = new BoardState(topo)
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
  }

  static fromLevel(level: Level, def: EncounterDef): EncounterState {
    return new EncounterState(BoardTopology.fromLevel(level), def)
  }

  clone(): EncounterState {
    const c = new EncounterState(this.board.topo, this.def)
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
  get won(): boolean {
    return this.hitCount >= this.totalHp
  }
  /** The board is empty and the boss survived. */
  get lost(): boolean {
    return !this.won && this.board.cleared
  }
  get over(): boolean {
    return this.won || this.board.cleared
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

  tap(id: number): TapResult {
    if (this.over) return { ok: false, reason: 'over', blocker: -1 }
    const r = this.board.tryRemove(id)
    if (!r.ok) return r
    const arenaDir = this.arenaDir(id)
    const phaseBefore = this.phaseIndex
    const hit = arenaDir === this.bossSide
    if (hit) this.hitCount++
    this.log.push({ kind: 'tap', id, hit })
    const phaseAfter = this.phaseIndex
    const granted = phaseAfter !== phaseBefore ? this.grantedUpToPhase(phaseAfter) - this.grantedUpToPhase(phaseBefore) : 0
    return { ok: true, arenaDir, hit, phaseBefore, phaseAfter, granted, won: this.won, lost: this.lost }
  }

  /** Spends one Rotate charge. Returns false if not allowed right now. */
  rotate(turn: Turn): boolean {
    if (!this.canRotate(turn)) return false
    this.rot = (this.rot + turn + 4) & 3
    this.rotates++
    this.log.push({ kind: 'rotate', turn })
    return true
  }

  apply(a: EncounterAction): boolean {
    return a.kind === 'tap' ? this.tap(a.id).ok : this.rotate(a.turn)
  }

  /** Reverts the last tap or rotate. Returns false if there is nothing to undo. */
  undo(): boolean {
    const e = this.log.pop()
    if (!e) return false
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
    return `${this.board.key()}|${this.rot}|${this.hitCount}|${this.rotates}`
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
  })
  if (!Array.isArray(def.rotate?.allow) || def.rotate.allow.some((t) => t !== 1 && t !== -1)) {
    throw new Error('rotate.allow must list 1 (cw) and/or -1 (ccw)')
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
      rotate: { allow: e.rotate.allow.map((t) => (t === 1 ? 'cw' : 'ccw')) },
    },
  }
}

export const formatAction = (a: EncounterAction): string =>
  a.kind === 'tap' ? `tap #${a.id}` : `rotate ${a.turn === 1 ? 'cw' : 'ccw'}`
