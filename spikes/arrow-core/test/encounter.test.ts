import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  analyzeSeed,
  BoardState,
  E,
  type EncounterAction,
  type EncounterDef,
  encounterFromJson,
  EncounterState,
  encounterToJson,
  findWin,
  generateLevel,
  type Level,
  maxHits,
  N,
  PRESETS,
  probePhase2,
  S,
  validateEncounter,
  W,
} from '../src/index.js'
import { levelXY } from './helpers.js'

const def2 = (side1: number, hp1: number, side2: number, hp2: number, grant = 1, allow: (1 | -1)[] = [1, -1]): EncounterDef => ({
  id: 't',
  boss: {
    id: 'b',
    phases: [
      { side: side1 as 0, hpUnits: hp1 },
      { side: side2 as 0, hpUnits: hp2, grantRotate: grant },
    ],
  },
  rotate: { allow },
})

/** Reference: plain DFS over every legal action, no memo, no bounds. */
function bruteWin(level: Level, def: EncounterDef, maxRotates: number): boolean {
  const s = EncounterState.fromLevel(level, def)
  const go = (): boolean => {
    if (s.won) return true
    if (s.over) return false
    for (const id of s.board.freeArrows()) {
      s.tap(id)
      if (go()) return true
      s.undo()
    }
    if (s.rotatesUsed < maxRotates) {
      for (const t of def.rotate.allow) {
        if (!s.rotate(t)) continue
        if (go()) return true
        s.undo()
      }
    }
    return false
  }
  return go()
}

function bruteMaxHits(level: Level, def: EncounterDef, maxRotates: number): number {
  const s = EncounterState.fromLevel(level, def)
  const go = (): number => {
    if (s.over) return s.hits
    let best = s.hits
    for (const id of s.board.freeArrows()) {
      s.tap(id)
      best = Math.max(best, go())
      s.undo()
    }
    if (s.rotatesUsed < maxRotates) {
      for (const t of def.rotate.allow) {
        if (!s.rotate(t)) continue
        best = Math.max(best, go())
        s.undo()
      }
    }
    return best
  }
  return go()
}

function replayWins(level: Level, def: EncounterDef, seq: EncounterAction[]): boolean {
  const s = EncounterState.fromLevel(level, def)
  for (const a of seq) if (!s.apply(a)) return false
  return s.won
}

describe('EncounterState', () => {
  // Three free arrows side by side: E, E and N (heads on the right / top edge).
  //  row 0: ..^   arrow 2 points N from (2,1)->(2,0)
  //  row 1: >>.   arrow 0 (0,1)->(1,1) E is blocked by arrow 2's body at (2,1)
  //  row 2: >>.   arrow 1 (0,2)->(1,2) E is free
  const level = levelXY(3, 3, [
    [[0, 1], [1, 1]],
    [[0, 2], [1, 2]],
    [[2, 1], [2, 0]],
  ])

  it('hits, switches phase by HP, grants Rotate, rotates arena directions, wins', () => {
    const s = EncounterState.fromLevel(level, def2(E, 1, N, 2))
    expect(s.bossSide).toBe(E)
    expect(s.rotateCharges).toBe(0)
    expect(s.canRotate(1)).toBe(false)

    const blocked = s.tap(0)
    expect(blocked).toEqual({ ok: false, reason: 'blocked', blocker: 2 })

    const r1 = s.tap(1)
    expect(r1).toMatchObject({ ok: true, hit: true, arenaDir: E, phaseBefore: 0, phaseAfter: 1, granted: 1, won: false })
    expect(s.bossSide).toBe(N)
    expect(s.rotateCharges).toBe(1)

    const r2 = s.tap(2)
    expect(r2).toMatchObject({ ok: true, hit: true, arenaDir: N })
    expect(s.hp).toBe(1)

    // Arrow 0 points E; boss is N. Rotating ccw turns E into N.
    expect(s.wouldHit(0)).toBe(false)
    expect(s.rotate(-1)).toBe(true)
    expect(s.arenaDir(0)).toBe(N)
    expect(s.rotateCharges).toBe(0)
    const r3 = s.tap(0)
    expect(r3).toMatchObject({ ok: true, hit: true, won: true })
    expect(s.won).toBe(true)
    expect(s.tap(0)).toMatchObject({ ok: false, reason: 'over' })
    expect(s.rotate(1)).toBe(false)
  })

  it('undo restores hp, phase, charges and rotation exactly', () => {
    const s = EncounterState.fromLevel(level, def2(E, 1, N, 2))
    const k0 = s.key()
    s.tap(1)
    const k1 = s.key()
    s.rotate(1)
    s.tap(2)
    expect(s.undo()).toBe(true)
    expect(s.undo()).toBe(true)
    expect(s.key()).toBe(k1)
    expect(s.rotateCharges).toBe(1)
    expect(s.undo()).toBe(true)
    expect(s.key()).toBe(k0)
    expect(s.phaseIndex).toBe(0)
    expect(s.rotateCharges).toBe(0)
    expect(s.undo()).toBe(false)
  })

  it('loses when the board is empty and the boss survives', () => {
    const s = EncounterState.fromLevel(level, def2(W, 1, S, 1))
    for (const id of [1, 2, 0]) expect(s.tap(id).ok).toBe(true)
    expect(s.lost).toBe(true)
    expect(s.over).toBe(true)
  })

  it('Rotate does not change which arrows are free', () => {
    const lvl = generateLevel(PRESETS.medium, 7).level as Level
    const def: EncounterDef = { id: 't', boss: { id: 'b', phases: [{ side: E, hpUnits: 5, grantRotate: 2 }] }, rotate: { allow: [1] } }
    const s = EncounterState.fromLevel(lvl, def)
    const before = s.board.freeArrows()
    s.rotate(1)
    s.rotate(1)
    expect(s.board.freeArrows()).toEqual(before)
    expect(s.rotation).toBe(2)
  })
})

describe('encounter validator', () => {
  const smallCase = fc
    .record({
      seed: fc.integer({ min: 0, max: 0xffffffff }),
      side1: fc.integer({ min: 0, max: 3 }),
      side2: fc.integer({ min: 0, max: 3 }),
      hp1: fc.integer({ min: 1, max: 3 }),
      hp2: fc.integer({ min: 1, max: 3 }),
      grant: fc.integer({ min: 0, max: 2 }),
      allow: fc.constantFrom<(1 | -1)[]>([1, -1], [1], [-1]),
    })
    .map((r) => {
      const level = generateLevel(PRESETS.tiny, r.seed).level as Level
      return { level, def: def2(r.side1, r.hp1, r.side2, r.hp2, r.grant, r.allow) }
    })
    .filter(({ level }) => level.arrows.length <= 7)

  it('findWin agrees with plain brute force, and its sequences replay to a win', () => {
    fc.assert(
      fc.property(smallCase, fc.integer({ min: 0, max: 2 }), ({ level, def }, maxRotates) => {
        const expected = bruteWin(level, def, maxRotates)
        const got = findWin(EncounterState.fromLevel(level, def), { maxRotates })
        expect(got.proven).toBe(true)
        expect(got.win).toBe(expected)
        if (got.win) {
          expect(replayWins(level, def, got.sequence)).toBe(true)
          expect(got.sequence.filter((a) => a.kind === 'rotate').length).toBeLessThanOrEqual(maxRotates)
        }
      }),
      { numRuns: 250 },
    )
  })

  it('maxHits agrees with brute force', () => {
    fc.assert(
      fc.property(smallCase, fc.integer({ min: 0, max: 1 }), ({ level, def }, maxRotates) => {
        const got = maxHits(EncounterState.fromLevel(level, def), { maxRotates })
        expect(got.proven).toBe(true)
        expect(got.hits).toBe(bruteMaxHits(level, def, maxRotates))
      }),
      { numRuns: 150 },
    )
  })

  it('findWin from a mid-fight state returns only the remaining actions', () => {
    const level = generateLevel(PRESETS.medium, 2908).level as Level
    const def = def2(E, 4, N, 5)
    const s = EncounterState.fromLevel(level, def)
    const full = findWin(s)
    expect(full.win).toBe(true)
    s.apply(full.sequence[0])
    const rest = findWin(s)
    expect(rest.win).toBe(true)
    const t = EncounterState.fromLevel(level, def)
    for (const a of [full.sequence[0], ...rest.sequence]) expect(t.apply(a)).toBe(true)
    expect(t.won).toBe(true)
  })
})

describe('seed analyzer', () => {
  it('per-step direction bookkeeping is consistent with BoardState', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.constantFrom('easy', 'medium', 'hard'), (seed, preset) => {
        const level = generateLevel(PRESETS[preset as 'easy'], seed).level as Level
        const a = analyzeSeed(level)
        const state = BoardState.fromLevel(level)
        expect(a.dirCounts.reduce((x, y) => x + y, 0)).toBe(level.arrows.length)
        expect(a.initialFree.reduce((x, y) => x + y, 0)).toBe(state.freeCount)
        expect(a.dirSequence.length).toBe(level.solution.length)
        expect(a.layerDirs.flat().reduce((x, y) => x + y, 0)).toBe(level.arrows.length)
        let remaining = [...a.dirCounts]
        for (const st of a.steps) {
          const before = new Set(state.freeArrows())
          expect(st.freeIdsBefore).toEqual([...before])
          state.remove(st.id)
          const newly = state.freeArrows().filter((id) => !before.has(id))
          expect(st.newlyFree.map((f) => f.id).sort((x, y) => x - y)).toEqual(newly)
          remaining = remaining.map((n, d) => n - (d === st.dir ? 1 : 0))
          expect(st.remaining).toEqual(remaining)
          expect(st.branch).toBe(before.size > 1)
        }
        expect(remaining).toEqual([0, 0, 0, 0])
      }),
      { numRuns: 60 },
    )
  })
})

describe('encounter files', () => {
  it('provisional prologue mini-boss: winnable with one Rotate, provably not without', () => {
    const raw = JSON.parse(readFileSync(new URL('../encounters/prologue-miniboss.json', import.meta.url), 'utf8'))
    const { file, level } = encounterFromJson(raw)
    const r = validateEncounter(level, file.encounter)
    expect(r.win.win).toBe(true)
    expect(r.winWithoutRotate).toMatchObject({ win: false, proven: true })
    expect(r.minRotates).toBe(1)
    expect(replayWins(level, file.encounter, r.win.sequence)).toBe(true)
    // Round trip through the human-readable form.
    expect(encounterFromJson(encounterToJson(file)).file.encounter).toEqual(file.encounter)
  })

  it('detects generator drift through levelHash', () => {
    const raw = JSON.parse(readFileSync(new URL('../encounters/prologue-miniboss.json', import.meta.url), 'utf8'))
    raw.board.levelHash = '00000000'
    expect(() => encounterFromJson(raw)).toThrow(/board drift/)
  })

  it('shortlist candidates all satisfy the Rotate gate', () => {
    const sl = JSON.parse(readFileSync(new URL('../encounters/shortlist.json', import.meta.url), 'utf8'))
    expect(sl.candidates.length).toBeGreaterThanOrEqual(5)
    expect(sl.candidates.length).toBeLessThanOrEqual(10)
    for (const c of sl.candidates) {
      const { file, level } = encounterFromJson(c.file)
      const start = EncounterState.fromLevel(level, file.encounter)
      expect(findWin(start, { maxRotates: 0 })).toMatchObject({ win: false, proven: true })
      expect(findWin(start, { maxRotates: 1 }).win).toBe(true)
    }
  })

  it('phase-2 probe is deterministic for a seed', () => {
    const level = generateLevel(PRESETS.medium, 2908).level as Level
    const def = def2(E, 4, N, 5)
    expect(probePhase2(level, def, 'sloppy', 10, 5)).toEqual(probePhase2(level, def, 'sloppy', 10, 5))
  })
})
