import { describe, expect, it } from 'vitest'
import { E, EncounterState, type EncounterDef, N, W, checkEncounter, minDamageToWin, RunState } from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * ACT-I-003 (provisional content prototypes): Heal ability, hit-triggered Shift, kill rewards,
 * temporary (expiring) targets and the `winHeal` rest beat. Nothing here changes core Tap Away,
 * BoardState, the solver or win conditions — all of it is enemies-mode data on top of COMBAT-001.
 */

/** `n` independent, always-free, always-hitting-E arrows. */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))
const base = (enemies: EncounterDef['enemies'], extra: Partial<EncounterDef> = {}): EncounterDef => ({
  id: 'act1-003-test', enemies, rotate: { allow: [] }, ...extra,
})

describe('Heal ability', () => {
  it('heals the most wounded OTHER enemy on its countdown, never itself, capped at max hp', () => {
    const def = base([
      { id: 'matron', side: N, hp: 3, ability: { id: 'h', kind: 'heal', interval: 2 } },
      { id: 'grunt', side: E, hp: 3 },
    ])
    const s = EncounterState.fromLevel(eArrows(10), def, 10)
    s.tap(0) // grunt 2/3, heal countdown 2->1
    expect(s.enemies[1].hp).toBe(2)
    const r = s.tap(1) // grunt 1/3 -> heal fires: back to 2
    expect(r.ok && r.healed).toEqual([{ id: 'matron', target: 'grunt', amount: 1 }])
    expect(s.enemies[1].hp).toBe(2)
    s.undo()
    expect(s.enemies[1].hp).toBe(2) // before the tap: 2/3 (undo restores hp wholesale)
  })

  it('fizzles when nobody else is wounded', () => {
    const def = base([
      { id: 'matron', side: N, hp: 3, ability: { id: 'h', kind: 'heal', interval: 1 } },
      { id: 'grunt', side: W, hp: 3 },
    ])
    const s = EncounterState.fromLevel(eArrows(4), def, 10)
    const r = s.tap(0) // E miss, heal fires with nobody hurt
    expect(r.ok && r.healed).toEqual([])
  })
})

describe('Shift on hit', () => {
  it('a non-killing hit knocks the drunkard to the next side; the killing hit does not', () => {
    const def = base([{ id: 'drunk', side: E, hp: 2, ability: { id: 'w', kind: 'shift', interval: 99, sides: [E, W], trigger: 'hit' } }])
    const s = EncounterState.fromLevel(eArrows(6), def, 10)
    const r = s.tap(0)
    expect(r.ok && r.hit).toBe(true)
    expect(r.ok && r.shifted).toEqual([{ id: 'drunk', from: E, to: W }])
    expect(s.enemies[0].side).toBe(W)
    expect(s.wouldHit(1)).toBe(false) // E arrows no longer reach him
    s.undo()
    expect(s.enemies[0].side).toBe(E)
  })
})

describe('Kill rewards', () => {
  it('heal reward is capped at playerMaxHp and refunded on undo; rotate reward goes to the shared pool', () => {
    const def = base([{ id: 'loot', side: E, hp: 1, reward: { heal: 5, rotate: 1 } }], { rotate: { allow: [1], useRunPool: true } })
    const pool = { charges: 0 }
    const s = EncounterState.fromLevel(eArrows(3), def, 8, pool, 10)
    const r = s.tap(0)
    expect(r.ok && r.rewards).toEqual([{ id: 'loot', heal: 2, rotate: 1 }])
    expect(s.playerHp).toBe(10)
    expect(pool.charges).toBe(1)
    s.undo()
    expect(s.playerHp).toBe(8)
    expect(pool.charges).toBe(0)
  })

  it('the solver values a heal reward (negative damage) — an optional loot target is worth taking', () => {
    const def = base([
      { id: 'grunt', side: W, hp: 1, attackTimer: { interval: 2, damage: 2 } },
      { id: 'loot', side: E, hp: 1, mandatory: false, reward: { heal: 2 } },
    ])
    // Two E arrows and one W arrow, all free. W kills the grunt (win). Best line: loot first (+2), then W.
    const lvl = levelXY(2, 3, [[[0, 0], [1, 0]], [[0, 1], [1, 1]], [[1, 2], [0, 2]]])
    const s = EncounterState.fromLevel(lvl, def, 6, null, 10)
    const r = minDamageToWin(s)
    expect(r.win).toBe(true)
    expect(r.minDamage).toBe(-2)
  })
})

describe('Temporary target (expiresAfter)', () => {
  it('leaves the arena after N world turns, can no longer be hit and does not block the win', () => {
    const def = base([
      { id: 'grunt', side: W, hp: 5 },
      { id: 'chest', side: E, hp: 1, mandatory: false, expiresAfter: 2, reward: { heal: 1 } },
    ])
    const s = EncounterState.fromLevel(eArrows(6), def, 10)
    expect(s.enemies[1].turnsLeft).toBe(2)
    expect(s.wouldHit(0)).toBe(true)
    // spend two turns on E hits? no: the first E hit would kill it. Use blocked... there are only E arrows,
    // so kill it on turn 1 instead and verify the expiry path with a fresh state below.
    const s2 = EncounterState.fromLevel(levelXY(2, 3, [[[1, 0], [0, 0]], [[1, 1], [0, 1]], [[0, 2], [1, 2]]]), def, 10)
    s2.tap(0) // W hit grunt, turn 1
    s2.tap(1) // W hit grunt, turn 2 -> chest expires now
    expect(s2.enemies[1].expired).toBe(true)
    expect(s2.wouldHit(2)).toBe(false)
    s2.undo()
    expect(s2.enemies[1].expired).toBe(false)
    expect(s2.wouldHit(2)).toBe(true)
  })

  it('checkEncounter rejects a mandatory expiring target', () => {
    expect(() => checkEncounter(base([{ id: 'x', side: N, hp: 1, expiresAfter: 3 }]))).toThrow(/mandatory/)
  })
})

describe('winHeal rest beat', () => {
  it('advance() heals up to max HP once, like winRotateReward', () => {
    const lvl = eArrows(2)
    const step = (id: string, def: EncounterDef) => ({ id, level: lvl, def })
    const d1 = base([{ id: 'a', side: E, hp: 1 }], { winHeal: 3 })
    const d2 = base([{ id: 'b', side: E, hp: 1 }])
    const run = new RunState({ playerMaxHp: 10 }, [step('s1', d1), step('s2', d2)])
    ;(run.encounter as any).playerHpValue = 5 // simulate damage taken
    run.encounter.tap(0)
    expect(run.encounter.won).toBe(true)
    expect(run.advance()).toBe(true)
    expect(run.encounter.playerHp).toBe(8)
  })
})
