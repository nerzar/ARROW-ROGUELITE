import { type EncounterDef, EncounterState } from './encounter.js'
import type { Level } from './level.js'

/**
 * EXP-010: a thin run-level wrapper around the per-encounter EncounterState, needed because HP now
 * persists across encounters (docs/COMBAT-RULES.md 1) while the board/boss/timer state does not.
 * RunState owns nothing about combat rules itself — it only tracks *which* step is active, the HP
 * snapshot each step started with (for a debug restart), and swaps in a fresh EncounterState with
 * that snapshot when a step is (re)started or completed.
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
    return EncounterState.fromLevel(step.level, step.def, this.entryHp)
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
   * Returns false (no-op) if the current step is not won yet, or it was the last step.
   */
  advance(): boolean {
    if (!this.encounterState.won || this.isLastStep) return false
    this.entryHp = this.encounterState.playerHp
    this.idx++
    this.encounterState = this.buildEncounterState()
    return true
  }

  /** Restarts only the active step, HP reset to the snapshot it began with. */
  restartStep(): void {
    this.encounterState = this.buildEncounterState()
  }

  /** Restarts the whole run: back to step 0 with full max HP. */
  restartRun(): void {
    this.idx = 0
    this.entryHp = this.config.playerMaxHp
    this.encounterState = this.buildEncounterState()
  }

  /** Jumps to an arbitrary step for debugging, HP reset to max. Not part of a normal playthrough. */
  debugJumpTo(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.steps.length) throw new Error(`bad step index ${stepIndex}`)
    this.idx = stepIndex
    this.entryHp = this.config.playerMaxHp
    this.encounterState = this.buildEncounterState()
  }
}
