import { describe, expect, it } from 'vitest'
import { E, EncounterState, type EncounterDef, N, W, checkEncounter, minDamageToWin } from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * LD-007 (provisional prototype, not accepted content): `EnemyAbility kind: 'shift'` — the enemy
 * walks to the next arena side in its `sides` cycle on its own countdown. Only the target side
 * moves; HP, attack timer and board are untouched.
 */

/** `n` independent, always-free, always-hitting-E arrows. */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const def = (interval: number, extra: Partial<EncounterDef> = {}): EncounterDef => ({
  id: 'shift-test',
  enemies: [{ id: 'skirmisher', side: N, hp: 9, ability: { id: 'walk', kind: 'shift', interval, sides: [N, E, W] } }],
  rotate: { allow: [] },
  ...extra,
})

describe('Shift: timing and cycle', () => {
  it('moves N -> E -> W -> N on its own countdown, once per interval', () => {
    const s = EncounterState.fromLevel(eArrows(12), def(2), 10)
    expect(s.enemies[0].side).toBe(N)
    expect(s.enemies[0].abilityCountdown).toBe(2)
    s.tap(0)
    expect(s.enemies[0].side).toBe(N)
    const r = s.tap(1)
    expect(r.ok && r.shifted).toEqual([{ id: 'skirmisher', from: N, to: E }])
    expect(s.enemies[0].side).toBe(E)
    s.tap(2); s.tap(3)
    expect(s.enemies[0].side).toBe(W)
    s.tap(4); s.tap(5)
    expect(s.enemies[0].side).toBe(N)
  })

  it('E arrows only hit while the enemy stands on E; undo restores the side', () => {
    const s = EncounterState.fromLevel(eArrows(12), def(2), 10)
    expect(s.wouldHit(0)).toBe(false)
    s.tap(0); s.tap(1) // now on E
    expect(s.wouldHit(2)).toBe(true)
    const r = s.tap(2)
    expect(r.ok && r.hit).toBe(true)
    expect(s.enemies[0].hp).toBe(8)
    s.undo(); s.undo()
    expect(s.enemies[0].side).toBe(N)
    expect(s.wouldHit(1)).toBe(false)
  })

  it('does not step onto a side held by another live enemy', () => {
    const d = def(1, {
      enemies: [
        { id: 'skirmisher', side: N, hp: 9, ability: { id: 'walk', kind: 'shift', interval: 1, sides: [N, E] } },
        { id: 'guard', side: E, hp: 1 },
      ],
    })
    const s = EncounterState.fromLevel(eArrows(6), d, 10)
    s.tap(0) // guard dies (E hit) -> then abilities resolve: E now free? guard died THIS turn -> side is free
    expect(s.enemies[1].dead).toBe(true)
    expect(s.enemies[0].side).toBe(E)
  })

  it('checkEncounter rejects a shift with fewer than two sides', () => {
    expect(() => checkEncounter(def(1, { enemies: [{ id: 'x', side: N, hp: 1, ability: { id: 'w', kind: 'shift', interval: 1, sides: [N] } }] }))).toThrow(/sides/)
  })

  it('solver sees the moving side (a win exists only because the enemy walks into E)', () => {
    const d = def(1, { enemies: [{ id: 'skirmisher', side: N, hp: 2, ability: { id: 'walk', kind: 'shift', interval: 1, sides: [N, E] } }] })
    const r = minDamageToWin(EncounterState.fromLevel(eArrows(6), d, 10))
    expect(r.win).toBe(true)
  })
})
