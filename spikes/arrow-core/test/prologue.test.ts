import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { encounterFromJson, EncounterState, findWin, maxHits } from '../src/index.js'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

describe('EXP-009 gray prologue encounters 1-3 (single target, no Rotate)', () => {
  for (const [step, file, hp] of [
    [1, 'prologue-e1.json', 1],
    [2, 'prologue-e2.json', 2],
    [3, 'prologue-e3.json', 3],
  ] as const) {
    it(`encounter ${step}: provisional board is winnable and matches its hp`, () => {
      const { file: enc, level } = encounterFromJson(load(file))
      expect(enc.encounter.boss!.phases).toHaveLength(1)
      expect(enc.encounter.boss!.phases[0].hpUnits).toBe(hp)
      expect(enc.encounter.rotate.allow).toHaveLength(0)
      const r = findWin(EncounterState.fromLevel(level, enc.encounter))
      expect(r).toMatchObject({ win: true, proven: true })
    })

    it(`encounter ${step}: shortlist has 5-10 candidates, every one winnable`, () => {
      const sl = load(`prologue-e${step}-shortlist.json`)
      expect(sl.candidates.length).toBeGreaterThanOrEqual(5)
      expect(sl.candidates.length).toBeLessThanOrEqual(10)
      for (const c of sl.candidates) {
        const { file: enc, level } = encounterFromJson(c.file)
        const r = findWin(EncounterState.fromLevel(level, enc.encounter))
        expect(r).toMatchObject({ win: true, proven: true })
      }
    })
  }
})

describe('EXP-009 gray prologue encounter 4 (mini-boss, seed 1571)', () => {
  it('matches the user-chosen board and phases exactly', () => {
    const { file: enc } = encounterFromJson(load('prologue-e4-miniboss.json'))
    expect(enc.board).toMatchObject({ preset: 'medium', seed: 1571 })
    expect(enc.encounter.boss!.phases).toEqual([
      { side: 1, hpUnits: 4, label: 'familiar side' },
      { side: 0, hpUnits: 5, grantRotate: 1, label: 'moved: direction becomes a resource' },
    ])
    expect(enc.encounter.rotate.allow.sort()).toEqual([-1, 1])
  })

  it('killing the boss needs the one granted Rotate', () => {
    const { file: enc, level } = encounterFromJson(load('prologue-e4-miniboss.json'))
    const start = EncounterState.fromLevel(level, enc.encounter)
    // EXP-010: this EXP-009 file carries no attackTimer/blockedTapDamage, so nothing can hurt the
    // player and "board cleared alive" (docs/COMBAT-RULES.md 8) is trivially reachable even at
    // maxRotates 0. The original claim was about *killing*; that part is unchanged and checked below
    // (see encounters/cp-e5.json for the EXP-010 combat-pressure version of this same seed/boss).
    expect(findWin(start, { maxRotates: 0 }).win).toBe(true)
    expect(maxHits(start, { maxRotates: 0 }).hits).toBeLessThan(start.totalHp)
    expect(maxHits(start, { maxRotates: 1 }).hits).toBe(start.totalHp)
  })

  it('under natural (hit-first) phase-1 play, only one Rotate direction lets phase 2 be fully killed', () => {
    const { file: enc, level } = encounterFromJson(load('prologue-e4-miniboss.json'))
    const def = enc.encounter
    const s = EncounterState.fromLevel(level, def)
    while (s.phaseIndex === 0 && !s.over) {
      const free = s.board.freeArrows()
      s.tap(free.find((id) => s.wouldHit(id)) ?? free[0])
    }
    expect(s.phaseIndex).toBe(1)
    expect(s.rotateCharges).toBe(1)

    // EXP-010: without HP pressure, both directions still "win" via board-clear-alive (see above);
    // the meaningful EXP-009 distinction — cw cannot land the remaining N hits, ccw can — survives
    // as a hit-count claim.
    const cw = s.clone()
    cw.rotate(1)
    expect(maxHits(cw, { maxRotates: 0 }).hits).toBeLessThan(s.totalHp)

    const ccw = s.clone()
    ccw.rotate(-1)
    expect(maxHits(ccw, { maxRotates: 0 }).hits).toBe(s.totalHp)
  })
})
