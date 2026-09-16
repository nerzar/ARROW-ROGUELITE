import { describe, expect, it } from 'vitest'
import {
  BoardState,
  computeMetrics,
  E,
  levelFromJson,
  levelHash,
  levelToJson,
  peelLayers,
  replayOrder,
  S,
  solveBoard,
  validateLevel,
  verifyLevel,
} from '../src/index.js'
import { levelXY } from './helpers.js'

describe('blocking / ray logic', () => {
  // 4x3:  row 1 holds arrow 0 pointing E; arrow 1 stands in column 3 pointing S, on 0's ray.
  const level = levelXY(4, 3, [
    [[0, 1], [1, 1]],
    [[3, 0], [3, 1]],
  ])

  it('an arrow is free iff its straight ray to the edge is empty', () => {
    const s = BoardState.fromLevel(level)
    expect(level.arrows[0].dir).toBe(E)
    expect(level.arrows[1].dir).toBe(S)
    expect(s.canExit(1)).toBe(true)
    expect(s.canExit(0)).toBe(false)
    expect(s.firstBlocker(0)).toBe(1)
    expect(s.blockers(0)).toEqual([1])
    expect(s.freeCount).toBe(1)
  })

  it('tryRemove reports the blocker and never mutates on a blocked tap', () => {
    const s = BoardState.fromLevel(level)
    expect(s.tryRemove(0)).toEqual({ ok: false, reason: 'blocked', blocker: 1 })
    expect(s.remaining).toBe(2)
    expect(s.tryRemove(1)).toEqual({ ok: true })
    expect(s.tryRemove(1)).toEqual({ ok: false, reason: 'gone', blocker: -1 })
    expect(s.canExit(0)).toBe(true)
    expect(s.tryRemove(0)).toEqual({ ok: true })
    expect(s.cleared).toBe(true)
    expect(s.removed).toEqual([1, 0])
  })

  it('undo restores the exact previous state', () => {
    const s = BoardState.fromLevel(level)
    const before = { key: s.key(), free: s.freeCount, left: s.remaining }
    s.remove(1)
    expect(s.undo()).toBe(1)
    expect({ key: s.key(), free: s.freeCount, left: s.remaining }).toEqual(before)
    expect(s.canExit(0)).toBe(false)
    expect(s.undo()).toBe(-1)
  })

  it('remove() throws on an illegal move', () => {
    expect(() => BoardState.fromLevel(level).remove(0)).toThrow()
  })

  it('a head on the border pointing outwards has an empty ray and is always free', () => {
    const l = levelXY(3, 1, [[[1, 0], [2, 0]]])
    expect(BoardState.fromLevel(l).canExit(0)).toBe(true)
  })

  it('an arrow whose own body lies on its ray can never leave', () => {
    // 3x2: tail (2,1) -> (2,0) -> (1,0) -> (0,0) -> (0,1) -> head (1,1) pointing E at its own tail.
    const l = levelXY(3, 2, [[[2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [1, 1]]])
    const s = BoardState.fromLevel(l)
    expect(s.canExit(0)).toBe(false)
    expect(s.firstBlocker(0)).toBe(0)
    expect(solveBoard(l)).toMatchObject({ solvable: false, stuck: [0] })
    expect(validateLevel(l).join()).toMatch(/own escape ray/)
  })

  it('two arrows facing each other deadlock', () => {
    const l = levelXY(4, 1, [
      [[0, 0], [1, 0]],
      [[3, 0], [2, 0]],
    ])
    expect(validateLevel(l)).toEqual([])
    expect(solveBoard(l)).toEqual({ solvable: false, order: [], stuck: [0, 1] })
    expect(peelLayers(l)).toEqual({ solvable: false, layers: [] })
  })
})

describe('solver, layers, metrics on a known chain', () => {
  // 5x1 row: three arrows all pointing E, each blocked by the next.  0 -> 1 -> 2 -> edge
  const chain = levelXY(
    7,
    1,
    [
      [[0, 0], [1, 0]],
      [[2, 0], [3, 0]],
      [[4, 0], [5, 0]],
    ],
    [2, 1, 0],
  )

  it('finds the only order', () => {
    expect(solveBoard(chain)).toEqual({ solvable: true, order: [2, 1, 0], stuck: [] })
    expect(replayOrder(chain, [2, 1, 0])).toEqual({ ok: true })
    expect(replayOrder(chain, [1, 2, 0])).toMatchObject({ ok: false, step: 0, reason: 'blocked by arrow 2' })
    expect(replayOrder(chain, [2, 1])).toMatchObject({ ok: false })
  })

  it('peels one arrow per layer', () => {
    expect(peelLayers(chain).layers).toEqual([[2], [1], [0]])
  })

  it('metrics', () => {
    const m = computeMetrics(chain)
    expect(m).toMatchObject({
      arrows: 3,
      initialFree: 1,
      depth: 3,
      forcedMoves: 3,
      dirCounts: [0, 3, 0, 0],
      avgBlockers: 1,
      maxLength: 2,
      turnsPerArrow: 0,
    })
    expect(m.fill).toBeCloseTo(6 / 7)
  })
})

describe('validation', () => {
  const ok = levelXY(3, 3, [[[0, 0], [1, 0]]], [0])

  it('accepts a good level', () => {
    expect(verifyLevel(ok)).toEqual([])
  })

  const broken: [string, object, RegExp][] = [
    ['overlap', { arrows: [ok.arrows[0], { id: 1, dir: E, cells: [0, 1] }], solution: [] }, /overlaps/],
    ['gap', { arrows: [{ id: 0, dir: E, cells: [0, 2] }], solution: [] }, /adjacent/],
    ['row wrap', { arrows: [{ id: 0, dir: E, cells: [2, 3] }], solution: [] }, /adjacent/],
    ['wrong dir', { arrows: [{ id: 0, dir: S, cells: [0, 1] }], solution: [] }, /last segment/],
    ['out of bounds', { arrows: [{ id: 0, dir: E, cells: [8, 9] }], solution: [] }, /out of bounds/],
    ['too short', { arrows: [{ id: 0, dir: E, cells: [0] }], solution: [] }, /length/],
    ['bad id', { arrows: [{ id: 5, dir: E, cells: [0, 1] }], solution: [] }, /has id/],
    ['solution repeats', { solution: [0, 0] }, /solution/],
    ['solution short', { solution: [] }, /solution has 0 steps/],
  ]
  for (const [name, patch, re] of broken) {
    it(`rejects: ${name}`, () => {
      expect(verifyLevel({ ...ok, ...patch }).join('\n')).toMatch(re)
    })
  }
})

describe('serialization', () => {
  it('round-trips and keeps the hash', () => {
    const l = { ...levelXY(4, 3, [[[0, 1], [1, 1]], [[3, 0], [3, 1]]], [1, 0]), seed: 7 }
    const back = levelFromJson(JSON.parse(JSON.stringify(levelToJson(l))))
    expect(back).toEqual(l)
    expect(levelHash(back)).toBe(levelHash(l))
  })

  it('rejects foreign JSON', () => {
    expect(() => levelFromJson({ format: 'x' })).toThrow()
    expect(() => levelFromJson({ format: 'arrow-core-level', v: 99 })).toThrow()
  })
})
