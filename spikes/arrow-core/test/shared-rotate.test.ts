import { describe, expect, it } from 'vitest'
import {
  checkEncounter,
  E,
  type EncounterDef,
  EncounterState,
  RunState,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * RUN-001: shared Rotate run resource.
 *
 * - Pre-boss prologue has no global charges (pool starts at 0).
 * - Prologue boss declares `winRotateReward: 2`; `RunState.advance()` claims it exactly once.
 * - Post-prologue encounters declare `rotate.useRunPool: true` and spend 1 per Rotate from the
 *   pool; the remainder carries across encounters, never regenerates on win, and is restored by
 *   `restartStep()` / wiped by `restartRun()`.
 * - Tutorial/local boss Rotate (phase `grantRotate`, `rotateCharges`) stays encounter-local and
 *   never touches the pool — mixing pool + local grants is rejected by `checkEncounter`.
 */

/** `n` independent, always-free E-hitting arrows (width 2, one per row). */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

/** Prologue boss: one E phase, 1 hp. Optional tutorial grant + optional win reward. */
const bossDef = (opts: { grantRotate?: number; winRotateReward?: number } = {}): EncounterDef => ({
  id: 'prologue-boss',
  boss: {
    id: 'miniboss',
    phases: [{ side: E, hpUnits: 1, ...(opts.grantRotate !== undefined ? { grantRotate: opts.grantRotate } : {}) }],
  },
  rotate: { allow: [1] },
  ...(opts.winRotateReward !== undefined ? { winRotateReward: opts.winRotateReward } : {}),
})

/** Act I encounter: one E enemy, 1 hp, Rotate from the shared run pool. */
const actDef = (id: string): EncounterDef => ({
  id,
  enemies: [{ id: `${id}-mob`, side: E, hp: 1 }],
  rotate: { allow: [1], useRunPool: true },
})

/** Three-arrow board shared by every step; each step gets a fresh EncounterState. */
const lvl = () => eArrows(3)

/** Full prologue -> Act I run: boss (reward 2) then three pool-backed Act I steps. */
const fullRun = () => {
  const defs = [bossDef({ winRotateReward: 2 }), actDef('act1a'), actDef('act1b'), actDef('act1c')]
  const steps = defs.map((def, i) => ({ id: `s${i}`, level: lvl(), def }))
  return new RunState({ playerMaxHp: 10 }, steps)
}

/** Win the current step by clearing its board (no attack timers anywhere here: no HP moves). */
const clearBoard = (run: RunState): void => {
  const s = run.encounter
  for (const id of [...s.playableArrows()]) {
    s.tap(id)
    if (s.over) break
  }
  expect(s.won).toBe(true)
}

describe('RUN-001: prologue has no global charges until the boss reward', () => {
  it('pre-boss run starts with an empty shared pool', () => {
    const run = fullRun()
    expect(run.rotateCharges).toBe(0)
    expect(run.rotateChargesAtEntry).toBe(0)
    expect(run.encounter.rotateCharges).toBe(0) // boss grants nothing pre-win
  })

  it('finishing the boss grants exactly 2 (claimed once by advance)', () => {
    const run = fullRun()
    run.encounter.tap(0) // E hit, boss hp 1 -> won
    expect(run.encounter.won).toBe(true)
    expect(run.advance()).toBe(true)
    expect(run.rotateCharges).toBe(2)
    expect(run.rotateChargesAtEntry).toBe(2)
  })
})

describe('RUN-001: tutorial Rotate never enters the run pool', () => {
  it('spending a phase-granted Rotate leaves the pool at 0, through the win and beyond', () => {
    const defs = [bossDef({ grantRotate: 1, winRotateReward: 2 }), actDef('act1a')]
    const run = new RunState({ playerMaxHp: 10 }, defs.map((def, i) => ({ id: `s${i}`, level: lvl(), def })))
    expect(run.encounter.rotateCharges).toBe(1) // the tutorial grant is visible locally...
    expect(run.rotateCharges).toBe(0) // ...but the shared pool is empty
    run.encounter.tap(0) // kills the 1-hp boss -> won
    expect(run.rotateCharges).toBe(0)
    expect(run.advance()).toBe(true)
    expect(run.rotateCharges).toBe(2) // exactly the win reward, nothing from the tutorial grant
  })

  it('a granted tutorial Rotate spends locally without touching a (zero) pool', () => {
    // Two-phase boss so the grant is observable mid-fight: phase 1 grants, phase 2 spends.
    const def: EncounterDef = {
      id: 'tutorial-boss',
      boss: { id: 'b', phases: [{ side: E, hpUnits: 1, grantRotate: 1 }, { side: E, hpUnits: 1 }] },
      rotate: { allow: [1] },
    }
    const run = new RunState({ playerMaxHp: 10 }, [{ id: 's0', level: lvl(), def }])
    run.encounter.tap(0) // phase 1 killed -> grant arrives
    expect(run.encounter.rotateCharges).toBe(1)
    expect(run.encounter.rotate(1)).toBe(true)
    expect(run.encounter.rotateCharges).toBe(0)
    expect(run.rotateCharges).toBe(0) // pool untouched
  })
})

describe('RUN-001: Act I spends and carries the shared pool', () => {
  it('Act I starts with 2, rotate consumes -> 1, next encounter starts with 1', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance() // boss reward claimed
    expect(run.stepIndex).toBe(1)
    expect(run.encounter.rotateCharges).toBe(2) // Act I encounter starts with 2
    expect(run.encounter.rotate(1)).toBe(true)
    expect(run.rotateCharges).toBe(1)
    expect(run.encounter.rotateCharges).toBe(1)
    clearBoard(run)
    expect(run.advance()).toBe(true)
    expect(run.stepIndex).toBe(2)
    expect(run.rotateCharges).toBe(1) // remainder carried over, not refilled
    expect(run.encounter.rotateCharges).toBe(1)
  })

  it('another rotate -> 0, and a later encounter sees 0 (disabled but present)', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance()
    run.encounter.rotate(1) // 2 -> 1
    clearBoard(run)
    run.advance()
    run.encounter.rotate(1) // 1 -> 0
    expect(run.rotateCharges).toBe(0)
    clearBoard(run)
    run.advance()
    expect(run.stepIndex).toBe(3)
    expect(run.rotateCharges).toBe(0)
    expect(run.encounter.rotateCharges).toBe(0)
    expect(run.encounter.canRotate(1)).toBe(false) // disabled...
    expect(run.encounter.def.rotate.allow).toContain(1) // ...but still present (visible UI)
  })

  it('winning without Rotate preserves the count', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance()
    clearBoard(run) // no Rotate spent
    expect(run.rotateCharges).toBe(2) // spent nothing, pool untouched by the win
    expect(run.advance()).toBe(true)
    expect(run.encounter.rotateCharges).toBe(2)
  })
})

describe('RUN-001: restarts', () => {
  it('restartStep restores the encounter-entry count', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance() // entry pool for act1a: 2
    expect(run.encounter.rotate(1)).toBe(true)
    expect(run.rotateCharges).toBe(1)
    run.restartStep()
    expect(run.stepIndex).toBe(1)
    expect(run.rotateCharges).toBe(2) // back to entry snapshot
    expect(run.encounter.rotateCharges).toBe(2)
    expect(run.encounter.board.remaining).toBe(3) // board rebuilt too
  })

  it('restartRun resets progression; replaying the boss grants 2 again', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance()
    run.encounter.rotate(1)
    clearBoard(run)
    run.advance()
    run.restartRun()
    expect(run.stepIndex).toBe(0)
    expect(run.rotateCharges).toBe(0)
    expect(run.rotateChargesAtEntry).toBe(0)
    expect(run.encounter.playerHp).toBe(10)
    run.encounter.tap(0) // replay the boss
    expect(run.advance()).toBe(true)
    expect(run.rotateCharges).toBe(2) // reward granted again, exactly once
  })
})

describe('RUN-001: solver clones never drain the live pool', () => {
  it('clone() replays spend without double-charging, and undo refunds', () => {
    const run = fullRun()
    run.encounter.tap(0)
    run.advance()
    const s = run.encounter
    expect(s.rotate(1)).toBe(true) // pool 2 -> 1
    const c = s.clone()
    expect(c.rotateCharges).toBe(1) // same remainder, not double-spent
    expect(run.rotateCharges).toBe(1) // live pool untouched by the clone
    expect(c.rotate(1)).toBe(true) // clone spends its own holder...
    expect(c.rotateCharges).toBe(0)
    expect(run.rotateCharges).toBe(1) // ...live pool still untouched
    expect(s.undo()).toBe(true) // refund the live rotate
    expect(run.rotateCharges).toBe(2)
  })
})

describe('RUN-001: validation rejects pool/local-grant mixing', () => {
  it('useRunPool + rotateCharges is rejected', () => {
    const def: EncounterDef = { ...actDef('x'), rotateCharges: 1 }
    expect(() => checkEncounter(def)).toThrow()
  })

  it('useRunPool + phase grantRotate is rejected', () => {
    const def: EncounterDef = {
      id: 'x',
      boss: { id: 'b', phases: [{ side: E, hpUnits: 1, grantRotate: 1 }] },
      rotate: { allow: [1], useRunPool: true },
    }
    expect(() => checkEncounter(def)).toThrow()
  })

  it('a pool-backed def without local grants is accepted', () => {
    expect(() => checkEncounter(actDef('ok'))).not.toThrow()
    expect(() => checkEncounter(bossDef({ winRotateReward: 2 }))).not.toThrow()
  })

  it('winRotateReward must be a non-negative integer', () => {
    expect(() => checkEncounter(bossDef({ winRotateReward: -1 }))).toThrow()
    expect(() => checkEncounter(bossDef({ winRotateReward: 1.5 }))).toThrow()
  })
})
