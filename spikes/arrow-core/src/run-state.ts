import { type EncounterDef, EncounterState, type RotatePool } from './encounter.js'
import type { Level } from './level.js'

/**
 * EXP-010: a thin run-level wrapper around the per-encounter EncounterState, needed because HP now
 * persists across encounters (docs/COMBAT-RULES.md 1) while the board/boss/timer state does not.
 * RunState owns nothing about combat rules itself — it only tracks *which* step is active, the HP
 * snapshot each step started with (for a debug restart), and swaps in a fresh EncounterState with
 * that snapshot when a step is (re)started or completed.
 *
 * RUN-001: RunState additionally owns the shared Rotate pool (`rotateCharges`, minimum
 * `playerHp`/`rotateCharges` per the task — no other run resources yet, and charges are never
 * duplicated into the presentation layer). The pool starts at 0 (pre-boss prologue has no global
 * charges), grows only via a completed step's `def.winRotateReward` (prologue boss: +2, claimed
 * exactly once by `advance()`), and is spent 1-per-Rotate by pool-backed encounters
 * (`rotate.useRunPool`). Tutorial/local boss Rotate stays encounter-local and never touches this
 * pool. Refill beyond win rewards is UNKNOWN (no regeneration here).
 */

export interface RunStep {
  /** Stable id for debug/logging and viewer selection, e.g. "e1". */
  id: string
  title?: string
  level: Level
  def: EncounterDef
}

export interface RunConfig {
  /** Data-driven, provisional (see docs/GAME-CONCEPT.md / COMBAT-RULES.md: exact numbers are OPEN). */
  playerMaxHp: number
}

export class RunState {
  readonly config: RunConfig
  readonly steps: readonly RunStep[]
  private idx = 0
  /** HP the player had when the *current* step began; what `restartStep()` returns to. */
  private entryHp: number
  /** Shared Rotate charges the run had when the *current* step began; what `restartStep()` returns to. */
  private entryRotate = 0
  /** The live shared Rotate pool. Passed by handle (not by value) into pool-backed encounters. */
  private readonly rotatePool: RotatePool = { charges: 0 }
  private encounterState: EncounterState

  constructor(config: RunConfig, steps: readonly RunStep[]) {
    if (steps.length === 0) throw new Error('RunState needs at least one step')
    this.config = config
    this.steps = steps
    this.entryHp = config.playerMaxHp
    this.encounterState = this.buildEncounterState()
  }

  private buildEncounterState(): EncounterState {
    const step = this.steps[this.idx]
    return EncounterState.fromLevel(step.level, step.def, this.entryHp, this.rotatePool)
  }

  get stepIndex(): number {
    return this.idx
  }
  get currentStep(): RunStep {
    return this.steps[this.idx]
  }
  /** The live per-encounter combat state: tap/rotate/undo and all EXP-008/010 getters live here. */
  get encounter(): EncounterState {
    return this.encounterState
  }
  /** HP snapshot the current step started with (what a restart of this step returns to). */
  get hpAtEntry(): number {
    return this.entryHp
  }
  /** Shared Rotate charges right now (the run pool). Pre-boss prologue: 0. */
  get rotateCharges(): number {
    return this.rotatePool.charges
  }
  /** Shared Rotate charges the current step started with (what a restart of this step returns to). */
  get rotateChargesAtEntry(): number {
    return this.entryRotate
  }
  get maxHp(): number {
    return this.config.playerMaxHp
  }
  get isFirstStep(): boolean {
    return this.stepIndex === 0
  }
  get isLastStep(): boolean {
    return this.stepIndex === this.steps.length - 1
  }
  /** The whole run is cleared: the last step's encounter is won. */
  get runWon(): boolean {
    return this.isLastStep && this.encounterState.won
  }
  /** The run has failed: the active encounter ended without being won (death or empty board). */
  get runLost(): boolean {
    return this.encounterState.lost
  }

  /**
   * Moves on to the next step, carrying over the HP the player finished the current step with.
   * Also claims the completed step's `winRotateReward` (e.g. prologue boss +2) into the shared
   * pool exactly once — `advance()` is a one-way gate (no-op unless the current step is won),
   * so a reward can never be granted twice. Returns false (no-op) if the current step is not
   * won yet, or it was the last step.
   */
  advance(): boolean {
    if (!this.encounterState.won || this.isLastStep) return false
    this.rotatePool.charges += this.steps[this.idx].def.winRotateReward ?? 0
    this.entryHp = this.encounterState.playerHp
    this.entryRotate = this.rotatePool.charges
    this.idx++
    this.encounterState = this.buildEncounterState()
    return true
  }

  /** Restarts only the active step, HP and shared Rotate charges reset to the snapshots it began with. */
  restartStep(): void {
    this.rotatePool.charges = this.entryRotate
    this.encounterState = this.buildEncounterState()
  }

  /** Restarts the whole run: back to step 0 with full max HP and an empty Rotate pool. */
  restartRun(): void {
    this.idx = 0
    this.entryHp = this.config.playerMaxHp
    this.entryRotate = 0
    this.rotatePool.charges = 0
    this.encounterState = this.buildEncounterState()
  }

  /** Jumps to an arbitrary step for debugging, HP reset to max. Not part of a normal playthrough. */
  debugJumpTo(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.steps.length) throw new Error(`bad step index ${stepIndex}`)
    this.idx = stepIndex
    this.entryHp = this.config.playerMaxHp
    this.entryRotate = this.rotatePool.charges
    this.encounterState = this.buildEncounterState()
  }
}
