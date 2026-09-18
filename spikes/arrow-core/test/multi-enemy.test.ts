import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  E,
  type EncounterDef,
  checkEncounter,
  encounterFromJson,
  EncounterState,
  minDamageToWin,
  N,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * EXP-010b: `def.enemies` — simultaneous regular enemies, independent of the sequential
 * `def.boss.phases` model (untouched, still covered by test/encounter.test.ts, test/prologue.test.ts
 * and test/combat-pressure.test.ts, all still green). Each enemy has its own hp/attackTimer/dead
 * state; every legal (non-blocked) tap ticks every alive enemy's timer, whether or not that tap hit
 * that particular enemy — this is what lets two enemies threaten the player on independent clocks.
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

// Same 3x3 fixture as test/combat-pressure.test.ts: arrow0 E (blocked by arrow2), arrow1 E (free), arrow2 N (free).
const level = levelXY(3, 3, [
  [[0, 1], [1, 1]],
  [[0, 2], [1, 2]],
  [[2, 1], [2, 0]],
])

const twoEnemyDef = (eHp: number, eInterval: number, eDamage: number, nHp: number, nInterval: number, nDamage: number): EncounterDef => ({
  id: 'me',
  enemies: [
    { id: 'e', side: E, hp: eHp, attackTimer: { interval: eInterval, damage: eDamage } },
    { id: 'n', side: N, hp: nHp, attackTimer: { interval: nInterval, damage: nDamage } },
  ],
  rotate: { allow: [] },
  blockedTapDamage: 1,
})

describe('enemies mode: independent HP and timers', () => {
  it('E hit only damages the E enemy; N enemy hp and both countdowns still tick', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(5, 2, 3, 5, 2, 4), 10)
    const r = s.tap(1) // E, free, hits the E enemy
    expect(r.ok).toBe(true)
    expect(s.enemies).toMatchObject([
      { id: 'e', hp: 4, dead: false, countdown: 1 },
      { id: 'n', hp: 5, dead: false, countdown: 1 }, // untouched hp, but timer still ticked
    ])
  })

  it('N hit only damages the N enemy (independent HP confirmed both directions)', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(5, 2, 3, 5, 2, 4), 10)
    s.tap(1) // E hit: e 5->4
    const r = s.tap(2) // N, frees after itself is tapped; hits the N enemy
    expect(r.ok).toBe(true)
    expect(s.enemies).toMatchObject([
      { id: 'e', hp: 4, dead: false }, // unaffected by the N hit
      { id: 'n', hp: 4, dead: false },
    ])
  })

  it('two enemies can attack the same turn, and damage is summed', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(5, 2, 3, 5, 2, 4), 10)
    s.tap(1) // turn 1: both countdowns 2 -> 1
    const r = s.tap(2) // turn 2: both countdowns 1 -> 0 -> both attack
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.enemyAttacked).toBe(true)
      expect(r.enemyDamage).toBe(7) // 3 + 4
      expect(r.enemyAttacks).toEqual(expect.arrayContaining([{ id: 'e', damage: 3 }, { id: 'n', damage: 4 }]))
      expect(r.playerHp).toBe(3) // 10 - 7
    }
  })
})

describe('enemies mode: killing one enemy stops only its own attacks', () => {
  it('a dead enemy never attacks again; the other keeps ticking and can attack the same turn it died', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(1, 1, 5, 5, 1, 2), 10)
    const r = s.tap(1) // E hit: e (hp 1) dies this turn -> no retaliation from e; n still alive, ticks 1 -> 0 -> attacks
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(s.enemies[0]).toMatchObject({ id: 'e', hp: 0, dead: true })
      expect(r.enemyAttacked).toBe(true)
      expect(r.enemyAttacks).toEqual([{ id: 'n', damage: 2 }]) // only n, e is dead and skipped
      expect(r.playerHp).toBe(8)
    }
  })

  it('a dead enemy stays silent on later turns even as the survivor keeps attacking on its own clock', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(1, 1, 5, 5, 3, 1), 10)
    s.tap(1) // e dies this turn (no retaliation); n countdown 3 -> 2
    const r2 = s.tap(2) // N hit; n countdown 2 -> 1, no attack yet; e stays dead throughout
    expect(r2.ok).toBe(true)
    expect(s.enemies[0]).toMatchObject({ dead: true })
  })
})

describe('enemies mode: win conditions', () => {
  it('all mandatory enemies dead is an immediate win, even with arrows left on the board', () => {
    const s = EncounterState.fromLevel(level, { ...twoEnemyDef(1, 99, 1, 1, 99, 1) }, 10)
    s.tap(1) // kill e
    expect(s.won).toBe(false) // n still alive
    const r = s.tap(2) // kill n
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.won).toBe(true)
    expect(s.won).toBe(true)
    expect(s.board.cleared).toBe(false) // arrow0 never tapped -- win came from kills, not board-clear
  })

  it('board cleared while alive is a win even if every enemy (mandatory) is still alive', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(10, 99, 1, 10, 99, 1), 10)
    s.tap(1) // E hit, e 10 -> 9
    s.tap(2) // N hit, n 10 -> 9, unlocks arrow0
    const r = s.tap(0) // E hit, e 9 -> 8; board now fully cleared
    expect(r.ok).toBe(true)
    expect(s.board.cleared).toBe(true)
    expect(s.enemies.every((e) => !e.dead)).toBe(true) // both enemies still very much alive
    expect(s.won).toBe(true)
    expect(s.playerDead).toBe(false)
  })
})

describe('enemies mode: blocked tap', () => {
  it('costs HP but ticks no enemy timer', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(5, 2, 3, 5, 2, 4), 10)
    const before = s.enemies.map((e) => e.countdown)
    const r = s.tap(0) // arrow0 is blocked by arrow2 until arrow2 is tapped
    expect(r).toMatchObject({ ok: false, reason: 'blocked', damage: 1, playerHp: 9 })
    expect(s.enemies.map((e) => e.countdown)).toEqual(before)
  })
})

describe('checkEncounter: exactly one of boss/enemies', () => {
  it('rejects a def with neither', () => {
    expect(() => checkEncounter({ id: 'x', rotate: { allow: [] } } as EncounterDef)).toThrow()
  })
  it('rejects a def with both', () => {
    const bad: EncounterDef = {
      id: 'x',
      boss: { id: 'b', phases: [{ side: E, hpUnits: 1 }] },
      enemies: [{ id: 'e', side: E, hp: 1 }],
      rotate: { allow: [] },
    }
    expect(() => checkEncounter(bad)).toThrow()
  })
})

describe('cp-e4.json: two simultaneous enemies (seed 10), replacing the old single-target seed 1638', () => {
  it('the clean priority-aware path wins with 0 damage', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e4.json'))
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    for (const id of [0, 3, 2, 5]) s.tap(id)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBe(10)
  })

  it('minDamageToWin proves a 0-damage path exists', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e4.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    expect(md).toMatchObject({ win: true, proven: true, minDamage: 0 })
  })

  it('the natural wrong-priority path (kill the slow N enemy first) costs HP from the urgent E enemy', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e4.json'))
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    s.tap(3) // N hit
    s.tap(5) // N hit: n dead, e untouched and now down to ATTACK IN 1
    expect(s.enemies).toMatchObject([{ id: 'grunt_e', dead: false }, { id: 'grunt_n', dead: true }])
    const before = s.playerHp
    const r = s.tap(6) // any further legal tap ticks grunt_e's countdown to 0
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.enemyAttacked).toBe(true)
      expect(r.enemyAttacks).toEqual([{ id: 'grunt_e', damage: 2 }])
    }
    expect(s.playerHp).toBe(before - 2)
  })
})

describe('prologue encounters 1-5: minDamageToWin at full (10) entry HP', () => {
  it('E1-E4 all have a proven 0-damage path', () => {
    for (const name of ['cp-e1.json', 'cp-e2.json', 'cp-e3.json', 'cp-e4.json']) {
      const { file: enc, level: lvl } = encounterFromJson(load(name))
      const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
      const md = minDamageToWin(start, { nodeBudget: 500_000 })
      expect(md, name).toMatchObject({ win: true, proven: true, minDamage: 0 })
    }
  })

  /**
   * EXP-011: E5 (seed 1571) used to be a documented FOUND — EXP-010b proved phase 2's plain
   * `ATTACK IN 3` forced exactly 1 unavoidable point of damage (its fresh window only allows 2 hits
   * before the timer fires; see EXP-010b-REPORT.md §6). EXP-011 fixes this not by touching HP/seed/
   * timer-bonus tricks, but by giving phase 2 an interruptible `kind: 'cast'` attack: a hit landed
   * while it is armed cancels it (no damage) and switches the boss to a normal attack with its own
   * (more generous) interval. This is now a proven 0-damage path, not a FOUND.
   */
  it('E5 (mini-boss) now has a proven 0-damage path via the EXP-011 cast-interrupt on phase 2', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e5.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    expect(md).toMatchObject({ win: true, proven: true, minDamage: 0 })
  })
})
