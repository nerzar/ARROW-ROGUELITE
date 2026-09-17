import { describe, expect, it } from 'vitest'
import {
  type AttackTimer,
  type Dir,
  E,
  type EncounterDef,
  EncounterState,
} from '../src/index.js'
import { levelXY } from './helpers.js'
import {
  appearBossVisual,
  baselinePose,
  onBossGameplayEvent,
  readBossSnapshot,
  STUNNED_HOLD_MS,
  TAUNT_HOLD_MS,
  tickBossVisual,
} from '../viewer/visual-proto/boss-visual-state.js'

/**
 * VIS-005: the presentation machine driven by the REAL engine (source of truth).
 * Pose decisions go through readBossSnapshot + the visual reducer, exactly like app.js does.
 * Engine rules themselves are covered by the EXP suites; here they are only the event source.
 */

/** `n` independent, always-free E-hitting arrows (same shape as attack-types.test.ts). */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const bossDef = (phases: { side: Dir; hpUnits: number; attackTimer: AttackTimer }[]): EncounterDef => ({
  id: 'vis005',
  boss: { id: 'goblin-taunter', phases },
  rotate: { allow: [] },
})

const normal = (interval: number, damage: number): AttackTimer => ({ interval, damage, kind: 'normal' })
const cast = (interval: number, damage: number): AttackTimer => ({
  interval, damage, kind: 'cast', interruptible: true,
  interruptedAttack: { interval: 4, damage: 1, kind: 'normal' },
})

describe('VIS-005 engine mapping: phase-1 hit', () => {
  it('appear -> taunt -> idle; ordinary hit -> stunned -> idle', () => {
    const def = bossDef([{ side: E, hpUnits: 99, attackTimer: normal(6, 1) }])
    const s = EncounterState.fromLevel(eArrows(5), def, 10)
    const snap = () => readBossSnapshot(s, def)!

    expect(baselinePose(snap())).toBe('idle')
    let v = appearBossVisual(0)
    expect(v.pose).toBe('taunt')
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())
    expect(v.pose).toBe('idle')

    const r = s.tap(0)
    expect(r).toMatchObject({ ok: true, hit: true, castInterrupted: false })
    v = onBossGameplayEvent(v, 'hit', 2000, snap())
    expect(v.pose).toBe('stunned')
    v = tickBossVisual(v, 2000 + STUNNED_HOLD_MS, snap())
    expect(v.pose).toBe('idle')
  })
})

describe('VIS-005 engine mapping: phase 2 cast + interrupt', () => {
  it('phase advance -> cast baseline; interrupt -> stunned -> angry', () => {
    // Both phases on E so the same E-aimed fixture arrows hit in each phase (side movement
    // is engine behaviour covered elsewhere; the mapping only needs phaseIndex/casting/won).
    const def = bossDef([
      { side: E, hpUnits: 1, attackTimer: normal(6, 1) },
      { side: E, hpUnits: 99, attackTimer: cast(3, 1) },
    ])
    const s = EncounterState.fromLevel(eArrows(9), def, 10)
    const snap = () => readBossSnapshot(s, def)!

    let v = appearBossVisual(0)
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())
    expect(v.pose).toBe('idle')

    const r1 = s.tap(0)
    expect(r1).toMatchObject({ ok: true, hit: true })
    expect(s.phaseIndex).toBe(1)
    expect(snap().casting).toBe(true)
    v = onBossGameplayEvent(v, 'phase', 3000, snap())
    expect(v.pose).toBe('cast')

    const r2 = s.tap(1)
    expect(r2).toMatchObject({ ok: true, hit: true, castInterrupted: true })
    expect(snap().casting).toBe(false) // interrupt switched the attack to normal
    v = onBossGameplayEvent(v, 'interrupted', 4000, snap())
    expect(v.pose).toBe('stunned')
    v = tickBossVisual(v, 4000 + STUNNED_HOLD_MS, snap())
    expect(v.pose).toBe('angry') // phase-2 baseline, not idle
  })
})

describe('VIS-005 engine mapping: defeat is terminal', () => {
  it('killing blow -> defeat, never idle again', () => {
    const def = bossDef([{ side: E, hpUnits: 1, attackTimer: normal(6, 1) }])
    const s = EncounterState.fromLevel(eArrows(2), def, 10)
    const snap = () => readBossSnapshot(s, def)!

    let v = appearBossVisual(0)
    const r = s.tap(0)
    expect(r).toMatchObject({ ok: true, won: true })
    v = onBossGameplayEvent(v, 'won', 1000, snap())
    expect(v.pose).toBe('defeat')
    expect(tickBossVisual(v, 1000 + 60_000, snap()).pose).toBe('defeat')
  })
})
