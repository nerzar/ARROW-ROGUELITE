import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkEncounter,
  E,
  type EncounterDef,
  encounterFromJson,
  EncounterState,
  findWin,
  minDamageToWin,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * COMBAT-001 (framework proof, not accepted content): `EnemyAbility kind: 'shield'` — a second
 * resolution through the same generic countdown machinery as Stone Throw. On its own `SHIELD IN N`
 * countdown the enemy raises a one-shot shield; the next projectile hit on that enemy is absorbed
 * (no HP damage, no interrupt) and drops the shield. Attack timers keep their own rules.
 */

/** `n` independent, always-free, always-hitting-E arrows — same trick as enemy-abilities.test.ts. */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const shieldDef = (interval: number, hp = 99): EncounterDef => ({
  id: 'shield-test',
  enemies: [
    {
      id: 'guard', side: E, hp,
      ability: { id: 'shield', kind: 'shield', interval },
    },
  ],
  rotate: { allow: [] },
})

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

describe('Shield: timing', () => {
  it('triggers exactly at the configured world turn, not before', () => {
    const s = EncounterState.fromLevel(eArrows(5), shieldDef(2), 10)
    expect(s.enemies[0].shielded).toBe(false)

    const r1 = s.tap(0) // turn 1: countdown 2 -> 1, no shield yet
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.shieldRaised ?? []).toEqual([])
    expect(s.enemies[0].abilityCountdown).toBe(1)
    expect(s.enemies[0].shielded).toBe(false)

    const r2 = s.tap(1) // turn 2: countdown 1 -> 0 -> raises
    expect(r2.ok).toBe(true)
    if (r2.ok) expect(r2.shieldRaised).toEqual([{ id: 'guard' }])
    expect(s.enemies[0].shielded).toBe(true)
    expect(s.enemies[0].abilityCountdown).toBe(2) // reset to interval
  })

  it('a blocked tap does not advance the shield timer (not a world turn)', () => {
    const level = levelXY(3, 3, [
      [[0, 1], [1, 1]],
      [[0, 2], [1, 2]],
      [[2, 1], [2, 0]],
    ])
    const def = shieldDef(1)
    def.blockedTapDamage = 1
    const s = EncounterState.fromLevel(level, def, 10)
    const before = s.enemies[0].abilityCountdown
    const r = s.tap(0) // blocked
    expect(r).toMatchObject({ ok: false, reason: 'blocked' })
    expect(s.enemies[0].abilityCountdown).toBe(before)
    expect(s.enemies[0].shielded).toBe(false)
  })
})

describe('Shield: absorb exactly one hit, then damage is normal again', () => {
  it('the next hit is absorbed (no HP damage) and drops the shield; the following hit damages', () => {
    // interval 2: after the absorb the countdown (2 -> 1) does NOT refire the same turn, so the
    // dropped shield stays observable. (With interval 1 the end-of-turn resolution would raise a
    // fresh shield immediately — correct framework behaviour, just not observable as a drop.)
    const s = EncounterState.fromLevel(eArrows(6), shieldDef(2), 10)
    const t1 = s.tap(0) // turn 1: countdown 2 -> 1, no shield yet
    expect(t1.ok).toBe(true)
    if (t1.ok) expect(t1.shieldRaised ?? []).toEqual([])
    const t2 = s.tap(1) // turn 2: countdown 1 -> 0 -> raises
    expect(t2.ok).toBe(true)
    if (t2.ok) expect(t2.shieldRaised).toEqual([{ id: 'guard' }])
    expect(s.enemies[0].shielded).toBe(true)

    const hpBefore = s.enemies[0].hp
    const r1 = s.tap(2) // turn 3: absorbed, countdown 2 -> 1, no refire
    expect(r1.ok).toBe(true)
    if (r1.ok) {
      expect(r1.hit).toBe(true) // the projectile reached the enemy — the shield took it
      expect(r1.hitDamage).toBe(0)
      expect(r1.shieldConsumed).toEqual([{ id: 'guard' }])
    }
    expect(s.enemies[0].hp).toBe(hpBefore) // no HP damage
    expect(s.enemies[0].shielded).toBe(false) // dropped
    expect(s.enemies[0].abilityCountdown).toBe(1)

    const r2 = s.tap(3) // turn 4: normal damage again (then the countdown refires and raises anew)
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.hit).toBe(true)
      expect(r2.hitDamage).toBe(1)
      expect(r2.shieldConsumed ?? []).toEqual([])
    }
    expect(s.enemies[0].hp).toBe(hpBefore - 1)
  })

  it('does not stack: firing again while the shield is up fizzles and keeps the single shield', () => {
    // id3 is a free N arrow on a board whose enemy stands on E: tapping it is a legal world-turn
    // miss, so the raised shield survives until the countdown refires and must fizzle.
    const level = levelXY(3, 5, [
      [[0, 2], [1, 2]], // id0: E, free
      [[0, 3], [1, 3]], // id1: E, free
      [[0, 4], [1, 4]], // id2: E, free
      [[2, 1], [2, 0]], // id3: N, free, misses the E enemy
    ])
    const s = EncounterState.fromLevel(level, shieldDef(1), 10)
    expect(s.playableArrows()).toEqual([0, 1, 2, 3])
    s.tap(0) // turn 1: hit, raises
    expect(s.enemies[0].shielded).toBe(true)
    const r = s.tap(3) // turn 2: miss, countdown fires again while shielded
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.hit).toBe(false)
      expect(r.shieldRaised ?? []).toEqual([]) // fizzle, no second shield
      expect(r.shieldConsumed ?? []).toEqual([])
    }
    expect(s.enemies[0].shielded).toBe(true) // still exactly one shield up
    expect(s.enemies[0].abilityCountdown).toBe(1) // countdown still reset, retries next cycle
  })
})

describe('Shield: attack timers stay independent', () => {
  it('an absorbed hit never interrupts, a real hit follows the current rules', () => {
    const def: EncounterDef = {
      id: 'shield-interrupt',
      enemies: [
        {
          id: 'guard', side: E, hp: 99,
          attackTimer: { interval: 5, damage: 1, interruptOnHit: true },
          ability: { id: 'shield', kind: 'shield', interval: 2 },
        },
      ],
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(eArrows(6), def, 10)
    // Turns 1-2 are real damaging hits (shield raises only at end of turn 2): the current
    // interruptOnHit rule fires and the 5-cycle resets.
    s.tap(0)
    expect(s.enemies[0].countdown).toBe(5)
    s.tap(1)
    expect(s.enemies[0].countdown).toBe(5)
    expect(s.enemies[0].shielded).toBe(true)

    const r1 = s.tap(2) // turn 3: absorbed — must NOT reset the 5-cycle
    expect(r1.ok).toBe(true)
    if (r1.ok) {
      expect(r1.shieldConsumed).toEqual([{ id: 'guard' }])
      expect(r1.interrupted).toBe(false)
    }
    expect(s.enemies[0].countdown).toBe(4) // plain tick, not a reset to 5

    const r2 = s.tap(3) // turn 4: real hit — current interruptOnHit rule applies
    expect(r2.ok).toBe(true)
    if (r2.ok) expect(r2.interrupted).toBe(true)
    expect(s.enemies[0].countdown).toBe(5)
  })
})

describe('Shield: state key and undo', () => {
  it('key() distinguishes an otherwise-identical state that differs only by a raised shield', () => {
    const withShield = EncounterState.fromLevel(eArrows(5), shieldDef(1), 10)
    withShield.tap(0) // raises immediately
    expect(withShield.enemies[0].shielded).toBe(true)

    const noAbilityDef: EncounterDef = {
      id: 'no-ability',
      enemies: [{ id: 'guard', side: E, hp: 99 }],
      rotate: { allow: [] },
    }
    const withoutShield = EncounterState.fromLevel(eArrows(5), noAbilityDef, 10)
    withoutShield.tap(0)

    // Same alive set, same hp, same player hp — differ ONLY in shield state.
    expect(withShield.hp).toBe(withoutShield.hp)
    expect(withShield.playerHp).toBe(withoutShield.playerHp)
    expect(withShield.key()).not.toBe(withoutShield.key())
  })

  it('undo fully restores shield state, and redo reproduces it deterministically', () => {
    const s = EncounterState.fromLevel(eArrows(5), shieldDef(1), 10)
    s.tap(0)
    expect(s.enemies[0].shielded).toBe(true)
    const keyBeforeUndo = s.key()
    expect(s.undo()).toBe(true)
    expect(s.enemies[0].shielded).toBe(false)
    expect(s.enemies[0].abilityCountdown).toBe(1)
    expect(s.board.isAlive(0)).toBe(true)
    s.tap(0)
    expect(s.key()).toBe(keyBeforeUndo)
  })
})

describe('Framework: Stone Throw and Shield coexist without sharing state', () => {
  it('both resolve through the same countdown machinery, each keeping its own state', () => {
    const def: EncounterDef = {
      id: 'mixed',
      enemies: [
        { id: 'rock', side: E, hp: 99, ability: { id: 'stone_throw', interval: 1, targetPolicy: 'free-arrow', pinDuration: 2 } },
        { id: 'guard', side: E, hp: 99, ability: { id: 'shield', kind: 'shield', interval: 1 } },
      ],
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(eArrows(7), def, 10)
    const r = s.tap(0)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: 2 }])
      expect(r.shieldRaised).toEqual([{ id: 'guard' }])
    }
    // No cross-contamination: the thrower is not shielded, the guard holds the shield.
    expect(s.enemies[0].shielded).toBe(false)
    expect(s.enemies[1].shielded).toBe(true)
    expect(s.isPinned(1)).toBe(true)

    // Turn 2: the stone ability keeps working on its own clock (pins id3 next — candidates
    // [3,4,5,6], 4 >= pinDuration 2 + 1) while the already-shielded guard fizzles. Neither half
    // disturbs the other.
    const r2 = s.tap(2)
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.pinnedThisTurn).toEqual([{ id: 3, turnsLeft: 2 }])
      expect(r2.shieldRaised ?? []).toEqual([])
    }
    expect(s.enemies[1].shielded).toBe(true)
    expect(s.pinnedArrows).toEqual([
      { id: 1, turnsLeft: 1 },
      { id: 3, turnsLeft: 2 },
    ])
  })
})

describe('checkEncounter / checkAbility validation for the framework', () => {
  it('rejects an unknown ability kind', () => {
    const def: EncounterDef = {
      id: 'bad',
      enemies: [{ id: 'e', side: E, hp: 1, ability: { id: 'a', kind: 'fireball' as never, interval: 1 } }],
      rotate: { allow: [] },
    }
    expect(() => checkEncounter(def)).toThrow()
  })

  it('rejects pin fields on a shield ability (a shield has no target)', () => {
    const def: EncounterDef = {
      id: 'bad',
      enemies: [{ id: 'e', side: E, hp: 1, ability: { id: 'a', kind: 'shield', interval: 1, pinDuration: 2 } as never }],
      rotate: { allow: [] },
    }
    expect(() => checkEncounter(def)).toThrow()
  })

  it('still rejects a stone_throw without pin fields (legacy shape unchanged)', () => {
    const def: EncounterDef = {
      id: 'bad',
      enemies: [{ id: 'e', side: E, hp: 1, ability: { id: 'a', interval: 1, targetPolicy: 'free-arrow' } as never }],
      rotate: { allow: [] },
    }
    expect(() => checkEncounter(def)).toThrow()
  })
})

describe('shield-spike.json: the debug Shield encounter', () => {
  it('the solver proves it is winnable', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('shield-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const win = findWin(start, { nodeBudget: 500_000 })
    expect(win).toMatchObject({ win: true, proven: true })
  })

  it('minDamageToWin finds a small, proven, survivable damage floor', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('shield-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    expect(md.win).toBe(true)
    expect(md.proven).toBe(true)
    expect(md.minDamage).toBeGreaterThanOrEqual(0)
    expect(md.minDamage).toBeLessThan(10)
  })

  it('the winning sequence, replayed, actually reaches won with positive player HP', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('shield-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    for (const a of md.sequence) s.apply(a)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBeGreaterThan(0)
  })

  it('the shield actually fires at least once along the winning path (the spike is not vacuous)', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('shield-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    let sawShield = false
    for (const a of md.sequence) {
      if (a.kind === 'tap') {
        const r = s.tap(a.id)
        if (r.ok && ((r.shieldRaised && r.shieldRaised.length) || (r.shieldConsumed && r.shieldConsumed.length))) sawShield = true
      } else if (a.kind === 'rotate') {
        s.rotate(a.turn)
      }
    }
    expect(sawShield).toBe(true)
  })
})
