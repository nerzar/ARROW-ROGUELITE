import { describe, expect, it } from 'vitest'
import {
  appearBossVisual,
  baselinePose,
  BOSS_ANCHOR,
  BOSS_POSES,
  createBossVisual,
  manualBossPose,
  onBossGameplayEvent,
  STUNNED_HOLD_MS,
  TAUNT_HOLD_MS,
  tickBossVisual,
} from '../viewer/visual-proto/boss-visual-state.js'

/**
 * VIS-005: Goblin Taunter presentation state machine. Pure presentation logic -- no engine
 * imports, no DOM. Gameplay stays source of truth; these tests pin the pose contract.
 */

const phase1 = { won: false, phaseIndex: 0, casting: false }
const phase1Cast = { won: false, phaseIndex: 0, casting: true }
const phase2 = { won: false, phaseIndex: 1, casting: false }
const phase2Cast = { won: false, phaseIndex: 1, casting: true }
const wonSnap = { won: true, phaseIndex: 1, casting: false }

describe('VIS-005 baseline pose', () => {
  it('phase 1 idle, phase 2 angry, armed cast beats both, won is defeat', () => {
    expect(baselinePose(phase1)).toBe('idle')
    expect(baselinePose(phase2)).toBe('angry')
    expect(baselinePose(phase1Cast)).toBe('cast')
    expect(baselinePose(phase2Cast)).toBe('cast')
    expect(baselinePose(wonSnap)).toBe('defeat')
    expect(baselinePose(null)).toBe('defeat')
  })
})

describe('VIS-005 appearance', () => {
  it('taunt on appear, then back to idle (taunt is NOT a permanent idle)', () => {
    const v0 = appearBossVisual(1000)
    expect(v0.pose).toBe('taunt')
    expect(tickBossVisual(v0, 1000 + TAUNT_HOLD_MS - 1, phase1).pose).toBe('taunt')
    const v1 = tickBossVisual(v0, 1000 + TAUNT_HOLD_MS, phase1)
    expect(v1.pose).toBe('idle')
  })
})

describe('VIS-005 hit / interrupt', () => {
  it('ordinary hit -> stunned briefly -> baseline', () => {
    const v0 = onBossGameplayEvent(createBossVisual(), 'hit', 500, phase1)
    expect(v0.pose).toBe('stunned')
    expect(tickBossVisual(v0, 500 + STUNNED_HOLD_MS - 1, phase1).pose).toBe('stunned')
    expect(tickBossVisual(v0, 500 + STUNNED_HOLD_MS, phase1).pose).toBe('idle')
  })
  it('interrupt in phase 2 returns to angry, not idle', () => {
    const v0 = onBossGameplayEvent(createBossVisual(), 'interrupted', 500, phase2)
    expect(tickBossVisual(v0, 500 + STUNNED_HOLD_MS, phase2).pose).toBe('angry')
  })
  it('phase event switches baseline immediately', () => {
    const v0 = onBossGameplayEvent(appearBossVisual(0), 'phase', 100, phase2)
    expect(v0.pose).toBe('angry')
  })
  it('castStart switches to cast immediately', () => {
    const v0 = onBossGameplayEvent(createBossVisual(), 'castStart', 100, phase2Cast)
    expect(v0.pose).toBe('cast')
  })
})

describe('VIS-005 defeat is terminal', () => {
  it('won -> defeat and ticks never leave it', () => {
    const v0 = onBossGameplayEvent(createBossVisual(), 'won', 900, wonSnap)
    expect(v0.pose).toBe('defeat')
    expect(tickBossVisual(v0, 900 + 60_000, wonSnap).pose).toBe('defeat')
    // Further hits after death stay defeated.
    const v1 = onBossGameplayEvent(v0, 'hit', 1000, wonSnap)
    expect(v1.pose).toBe('defeat')
  })
  it('manual pose cannot outlive the encounter end', () => {
    const v0 = manualBossPose(createBossVisual(), 'idle', 100)
    expect(tickBossVisual(v0, 200, wonSnap).pose).toBe('defeat')
  })
})

describe('VIS-005 manual debug override', () => {
  it('sticks through ticks, cleared by the next gameplay event', () => {
    const v0 = manualBossPose(createBossVisual(), 'back', 100)
    expect(tickBossVisual(v0, 100 + 60_000, phase1).pose).toBe('back')
    const v1 = onBossGameplayEvent(v0, 'hit', 200, phase1)
    expect(v1.pose).toBe('stunned')
    expect(v1.manual).toBe(false)
  })
  it('unknown pose is ignored', () => {
    const v0 = createBossVisual()
    expect(manualBossPose(v0, 'dance', 0)).toBe(v0)
  })
})

describe('VIS-005 anchor metadata', () => {
  // PLAYTEST-002: offsets are no longer all-zero -- see BOSS_ANCHOR's own comment. Each pose has a
  // measured, non-negative dy (transparent padding correction) and a zero dx (no measured
  // horizontal asymmetry); this pins the *shape* of the contract (every pose present, dx always 0,
  // dy always a finite, non-negative number) without hardcoding the exact tuned values here, so a
  // future re-measurement/re-tune doesn't need to touch this test.
  it('bottom-center ground anchor with a per-pose padding-correction offset', () => {
    expect(BOSS_ANCHOR.anchorX).toBe(0.5)
    expect(BOSS_ANCHOR.anchorY).toBe(1.0)
    for (const pose of BOSS_POSES) {
      const off = BOSS_ANCHOR.offsets[pose]
      expect(off.dx).toBe(0)
      expect(off.dy).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(off.dy)).toBe(true)
    }
  })
})
