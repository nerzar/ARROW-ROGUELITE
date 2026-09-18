import { describe, expect, it } from 'vitest'
import { E, type EncounterDef, EncounterState, N, W } from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * VFX-002: `TapResult.hitDamage` is the real HP delta a landed hit applied to its target this
 * tap (0 on a miss) -- the damage-number popup's source of truth, so the presentation layer never
 * hardcodes/guesses a value. Derived from the actual before/after HP in both `EncounterState`
 * branches (sequential boss phases and simultaneous enemies), not a separate "1 hit-unit" constant,
 * so it stays correct if either branch's per-hit damage ever stops being exactly 1.
 */

// Same 3x3 fixture used across test/combat-pressure.test.ts and test/multi-enemy.test.ts:
// arrow0 E (blocked by arrow2), arrow1 E (free), arrow2 N (free).
const level = levelXY(3, 3, [
  [[0, 1], [1, 1]],
  [[0, 2], [1, 2]],
  [[2, 1], [2, 0]],
])

describe('TapResult.hitDamage (boss mode)', () => {
  const bossDef = (side: number = E): EncounterDef => ({
    id: 'b',
    boss: { id: 'boss', phases: [{ side: side as 0 | 1 | 2 | 3, hpUnits: 5 }] },
    rotate: { allow: [] },
    blockedTapDamage: 1,
  })

  it('a landed hit reports the real hp delta (1) and matches hp before/after', () => {
    const s = EncounterState.fromLevel(level, bossDef(E), 10)
    const hpBefore = s.hp
    const r = s.tap(1) // E, free, hits the boss
    expect(r).toMatchObject({ ok: true, hit: true, hitDamage: 1 })
    expect(hpBefore - s.hp).toBe((r as { hitDamage: number }).hitDamage)
  })

  it('a miss reports zero damage', () => {
    const s = EncounterState.fromLevel(level, bossDef(W), 10) // boss on W; E arrows miss
    const r = s.tap(1) // E, misses
    expect(r).toMatchObject({ ok: true, hit: false, hitDamage: 0 })
  })

  it('a blocked tap (no TapResult ok:true at all) carries no hitDamage field', () => {
    const s = EncounterState.fromLevel(level, bossDef(E), 10)
    const r = s.tap(0) // arrow0 (E) is blocked by arrow2
    expect(r.ok).toBe(false)
    expect((r as Record<string, unknown>).hitDamage).toBeUndefined()
  })
})

describe('TapResult.hitDamage (enemies mode)', () => {
  const twoEnemyDef: EncounterDef = {
    id: 'me',
    enemies: [
      { id: 'e', side: E, hp: 5 },
      { id: 'n', side: N, hp: 5 },
    ],
    rotate: { allow: [] },
    blockedTapDamage: 1,
  }

  it('a landed hit reports the real hp delta (1) for the hit enemy only', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef, 10)
    const r = s.tap(1) // E, free, hits the E enemy
    expect(r).toMatchObject({ ok: true, hit: true, hitDamage: 1 })
    expect(s.enemies).toMatchObject([{ id: 'e', hp: 4 }, { id: 'n', hp: 5 }])
  })

  it('a hit on an already-dead side (miss) reports zero damage', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef, 10)
    s.tap(1) // e: 5 -> 4
    const r = s.tap(2) // N, hits n, not e
    expect(r).toMatchObject({ ok: true, hit: true, hitDamage: 1 })
    expect(s.enemies).toMatchObject([{ id: 'e', hp: 4 }, { id: 'n', hp: 4 }])
  })
})
