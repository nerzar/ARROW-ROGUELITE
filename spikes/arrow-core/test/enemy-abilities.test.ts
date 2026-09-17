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
 * EXP-013 (experiment, not accepted design): `EnemyDef.ability` — a board-affecting ability on its
 * own `THROW IN N` countdown, independent of `attackTimer`. The one concrete resolution implemented
 * is Stone Throw: deterministically pin one currently free-and-unpinned arrow (`targetPolicy:
 * 'free-arrow'`, lowest id, never the last playable arrow) for `pinDuration` world turns. A pinned
 * arrow is geometrically unchanged (still blocks/is blocked exactly as before) but cannot be tapped:
 * no HP cost, no timer movement, not a world turn. See src/encounter.ts's module doc comment and
 * EXP-013-REPORT.md for the full model and turn-order rationale.
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

/** `n` independent, always-free, always-hitting-E arrows (width 2 so a head's "beyond" cell is
 * always out of bounds; one per row so none can block another) -- same trick as test/attack-types.test.ts. */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const abilityDef = (interval: number, pinDuration: number, hp = 99): EncounterDef => ({
  id: 'ability-test',
  enemies: [
    {
      id: 'rock', side: E, hp,
      ability: { id: 'stone_throw', interval, targetPolicy: 'free-arrow', pinDuration },
    },
  ],
  rotate: { allow: [] },
})

describe('Stone Throw: timing', () => {
  it('triggers exactly at the configured world turn, not before', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(2, 2), 10)
    const r1 = s.tap(0) // turn 1: countdown 2 -> 1, no pin yet
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.pinnedThisTurn ?? []).toEqual([])
    expect(s.enemies[0].abilityCountdown).toBe(1)
    expect(s.pinnedArrows).toEqual([])

    const r2 = s.tap(1) // turn 2: countdown 1 -> 0 -> resolves
    expect(r2.ok).toBe(true)
    if (r2.ok) expect(r2.pinnedThisTurn).toEqual([{ id: 2, turnsLeft: 2 }])
    expect(s.pinnedArrows).toEqual([{ id: 2, turnsLeft: 2 }])
    expect(s.enemies[0].abilityCountdown).toBe(2) // reset to interval
  })

  it('a blocked tap does not advance the ability timer (not a world turn)', () => {
    // Same 3x3 fixture as test/combat-pressure.test.ts / test/attack-types.test.ts: arrow0 E blocked
    // by arrow2, arrow1 E free, arrow2 N free.
    const level = levelXY(3, 3, [
      [[0, 1], [1, 1]],
      [[0, 2], [1, 2]],
      [[2, 1], [2, 0]],
    ])
    const def = abilityDef(1, 2)
    def.blockedTapDamage = 1
    const s = EncounterState.fromLevel(level, def, 10)
    const before = s.enemies[0].abilityCountdown
    const r = s.tap(0) // blocked by arrow2
    expect(r).toMatchObject({ ok: false, reason: 'blocked' })
    expect(s.enemies[0].abilityCountdown).toBe(before) // untouched
    expect(s.pinnedArrows).toEqual([])
  })
})

describe('Stone Throw: a Rotate that advances the turn also ticks pins/abilities', () => {
  it('resolves the ability and ticks existing pins on a Rotate turn, same as a tap turn', () => {
    const def: EncounterDef = { ...abilityDef(2, 2), rotate: { allow: [1], advancesTurn: true }, rotateCharges: 5 }
    const s = EncounterState.fromLevel(eArrows(5), def, 10)
    s.tap(0) // turn 1: countdown 2 -> 1
    expect(s.rotate(1)).toBe(true) // turn 2 (a Rotate): countdown 1 -> 0 -> resolves
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 2 }]) // lowest of remaining [1,2,3,4]
    expect(s.rotate(1)).toBe(true) // turn 3 (another Rotate): ticks the pin 2 -> 1
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 1 }])
  })
})

describe('Stone Throw: pin blocks tapping, not geometry', () => {
  it('a pinned arrow cannot be tapped, costs no HP, and does not advance any timer', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    const r1 = s.tap(0) // resolves immediately (interval 1): pins id1 (lowest of remaining [1,2,3,4])
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: 2 }])
    const hpBefore = s.playerHp
    const cdBefore = s.enemies[0].abilityCountdown
    const r2 = s.tap(1) // pinned
    expect(r2).toMatchObject({ ok: false, reason: 'pinned', pinTurnsLeft: 2, playerHp: hpBefore, playerDead: false })
    expect(s.playerHp).toBe(hpBefore)
    expect(s.enemies[0].abilityCountdown).toBe(cdBefore) // not advanced by the rejected tap
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 2 }]) // unchanged by the rejected tap
  })

  it('a pinned arrow still blocks topology normally, and geometric freedom (canExit) is unaffected by the pin', () => {
    // Custom fixture (width 3, 4 rows): id0 (N, blocker) blocks id1 (E) exactly like the classic 3x3
    // fixture, but with the blocker at the LOWEST id so Stone Throw's deterministic lowest-id
    // selection targets it; id2/id3 are independent free fillers so there are always >=2 candidates
    // at resolution time (id0 stays a safe pick).
    const level = levelXY(3, 4, [
      [[2, 1], [2, 0]], // id0: N, blocks id1's ray
      [[0, 1], [1, 1]], // id1: E, blocked by id0's body at (2,1)
      [[0, 2], [1, 2]], // id2: E, free filler
      [[0, 3], [1, 3]], // id3: E, free filler
    ])
    const s = EncounterState.fromLevel(level, abilityDef(1, 2), 10)
    expect(s.board.canExit(1)).toBe(false) // blocked by id0, before any pin
    const r = s.tap(2) // consumes a filler turn; candidates after = [0, 3] -> pins id0 (lowest)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn).toEqual([{ id: 0, turnsLeft: 2 }])
    expect(s.isPinned(0)).toBe(true)
    expect(s.board.canExit(0)).toBe(true) // still geometrically free -- the pin is a separate veto
    expect(s.board.canExit(1)).toBe(false) // still blocked by id0's (unmoved) body
    expect(s.playableArrows()).toEqual([3]) // another free, unpinned arrow remains playable
  })
})

describe('Stone Throw: pin expiry', () => {
  it('expires deterministically after pinDuration world turns, then the arrow becomes playable again', () => {
    const s = EncounterState.fromLevel(eArrows(7), abilityDef(3, 2), 10)
    s.tap(0) // turn 1: countdown 3 -> 2
    s.tap(1) // turn 2: countdown 2 -> 1
    const r3 = s.tap(2) // turn 3: countdown 1 -> 0 -> pins id3 (lowest of [3,4,5,6]), countdown -> 3
    expect(r3.ok).toBe(true)
    if (r3.ok) expect(r3.pinnedThisTurn).toEqual([{ id: 3, turnsLeft: 2 }])

    const r4 = s.tap(4) // turn 4: tick id3's pin 2 -> 1 (still pinned); ability countdown 3 -> 2
    expect(r4.ok).toBe(true)
    if (r4.ok) expect(r4.pinExpired ?? []).toEqual([])
    expect(s.isPinned(3)).toBe(true)
    expect(s.pinnedArrows).toEqual([{ id: 3, turnsLeft: 1 }])

    const r5 = s.tap(5) // turn 5: tick id3's pin 1 -> 0 -> EXPIRES; ability countdown 2 -> 1 (no refire yet)
    expect(r5.ok).toBe(true)
    if (r5.ok) expect(r5.pinExpired).toEqual([3])
    expect(s.isPinned(3)).toBe(false)
    expect(s.pinnedArrows).toEqual([])

    const r6 = s.tap(3) // now tappable again, like any other arrow
    expect(r6).toMatchObject({ ok: true, hit: true })
  })
})

describe('Stone Throw: deterministic target selection', () => {
  it('always picks the lowest-id currently free-and-unpinned arrow, never something else', () => {
    const s = EncounterState.fromLevel(eArrows(6), abilityDef(1, 2), 10)
    const r = s.tap(0) // candidates after removal: [1,2,3,4,5] -> must pick 1, not any other
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: 2 }])
  })

  it('is reproducible: replaying the same action sequence on a fresh state yields the same target', () => {
    const build = () => {
      const s = EncounterState.fromLevel(eArrows(6), abilityDef(1, 2), 10)
      s.tap(0)
      return s
    }
    const a = build()
    const b = build()
    expect(a.pinnedArrows).toEqual(b.pinnedArrows)
  })
})

describe('Stone Throw: no-softlock guarantee', () => {
  it('never pins the only playable arrow -- fizzles instead and leaves it tappable', () => {
    const s = EncounterState.fromLevel(eArrows(2), abilityDef(1, 2), 10)
    const r = s.tap(0) // only id1 remains free -> pinning it would leave 0 playable -> must fizzle
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn ?? []).toEqual([])
    expect(s.pinnedArrows).toEqual([])
    const r2 = s.tap(1) // still perfectly tappable
    expect(r2).toMatchObject({ ok: true, hit: true })
  })

  it('fizzles safely (no crash, no pin) when there is no free-and-unpinned candidate at all', () => {
    const s = EncounterState.fromLevel(eArrows(3), abilityDef(1, 2), 10)
    s.tap(0) // candidates [1,2] -> pins id1 (lowest)
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 2 }])
    const r = s.tap(2) // only remaining playable arrow; after removal candidates = [] (id1 pinned)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn ?? []).toEqual([]) // fizzle: zero candidates
    expect(s.won).toBe(false) // id1 (mandatory, alive, pinned) still stands between here and a win
  })
})

describe('Stone Throw: state key and undo', () => {
  it('key() distinguishes an otherwise-identical state that differs only by an active pin', () => {
    const withAbility = EncounterState.fromLevel(eArrows(4), abilityDef(2, 2), 10)
    withAbility.tap(0) // countdown 2 -> 1, no pin yet
    withAbility.tap(1) // countdown 1 -> 0 -> pins id2 (lowest of remaining [2,3])
    expect(withAbility.pinnedArrows.length).toBeGreaterThan(0)

    const noAbilityDef: EncounterDef = {
      id: 'no-ability',
      enemies: [{ id: 'rock', side: E, hp: 99 }], // same enemy, no ability at all
      rotate: { allow: [] },
    }
    const withoutAbility = EncounterState.fromLevel(eArrows(4), noAbilityDef, 10)
    withoutAbility.tap(0)
    withoutAbility.tap(1)

    // Same alive set, same rotation, same player hp, same hit count -- differ ONLY in pin state.
    expect(withAbility.hp).toBe(withoutAbility.hp)
    expect(withAbility.playerHp).toBe(withoutAbility.playerHp)
    expect(withAbility.key()).not.toBe(withoutAbility.key())
  })

  it('undo fully restores pin state, including making the previously-pinned arrow tappable again', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    s.tap(0) // pins id1
    expect(s.isPinned(1)).toBe(true)
    const keyBeforeUndo = s.key()
    expect(s.undo()).toBe(true)
    expect(s.isPinned(1)).toBe(false)
    expect(s.pinnedArrows).toEqual([])
    expect(s.board.isAlive(0)).toBe(true) // the tap itself was also undone
    // Redoing the exact same action reproduces the exact same state (determinism through undo/redo).
    s.tap(0)
    expect(s.key()).toBe(keyBeforeUndo)
  })
})

describe('checkEncounter / checkAbility validation', () => {
  it('rejects an unknown targetPolicy', () => {
    const def: EncounterDef = {
      id: 'bad',
      enemies: [{ id: 'e', side: E, hp: 1, ability: { id: 'a', interval: 1, targetPolicy: 'random-safe' as never, pinDuration: 1 } }],
      rotate: { allow: [] },
    }
    expect(() => checkEncounter(def)).toThrow()
  })

  it('rejects a non-positive pinDuration or interval', () => {
    const bad = (patch: Partial<{ interval: number; pinDuration: number }>): EncounterDef => ({
      id: 'bad',
      enemies: [{ id: 'e', side: E, hp: 1, ability: { id: 'a', interval: 1, targetPolicy: 'free-arrow', pinDuration: 1, ...patch } }],
      rotate: { allow: [] },
    })
    expect(() => checkEncounter(bad({ interval: 0 }))).toThrow()
    expect(() => checkEncounter(bad({ pinDuration: 0 }))).toThrow()
  })
})

describe('rock-spike.json: the debug spike encounter', () => {
  it('the solver proves it is winnable', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('rock-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const win = findWin(start, { nodeBudget: 500_000 })
    expect(win).toMatchObject({ win: true, proven: true })
  })

  it('minDamageToWin finds a small, proven, survivable damage floor (not an unavoidable-damage grind)', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('rock-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    expect(md.win).toBe(true)
    expect(md.proven).toBe(true)
    expect(md.minDamage).toBeGreaterThanOrEqual(0)
    expect(md.minDamage).toBeLessThan(10) // clearly survivable, nowhere near lethal
  })

  it('the winning sequence, replayed, actually reaches won with positive player HP', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('rock-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    for (const a of md.sequence) s.apply(a)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBeGreaterThan(0)
  })

  it('the ability actually fires at least once along the winning path (the spike is not vacuous)', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('rock-spike.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    let sawPin = false
    for (const a of md.sequence) {
      if (a.kind === 'tap') {
        const r = s.tap(a.id)
        if (r.ok && r.pinnedThisTurn && r.pinnedThisTurn.length) sawPin = true
      } else {
        s.rotate(a.turn)
      }
    }
    expect(sawPin).toBe(true)
  })
})
