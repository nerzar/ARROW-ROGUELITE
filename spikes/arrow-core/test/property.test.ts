import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  BoardState,
  BoardTopology,
  computeMetrics,
  createRng,
  generateLevel,
  type GeneratorParams,
  type Level,
  levelFromJson,
  levelHash,
  levelToJson,
  peelLayers,
  PRESETS,
  replayOrder,
  solveBoard,
  validateLevel,
  verifyLevel,
} from '../src/index.js'
import { bruteForceSolvable, naiveCanExit, randomLayout, rotateLevelCW } from './helpers.js'

const seedArb = fc.integer({ min: 0, max: 0xffffffff })

/** Random, arbitrary (usually unsolvable-ish) small board. */
const layoutArb = fc
  .record({
    seed: seedArb,
    w: fc.integer({ min: 2, max: 6 }),
    h: fc.integer({ min: 2, max: 6 }),
    arrows: fc.integer({ min: 1, max: 9 }),
    len: fc.integer({ min: 2, max: 5 }),
  })
  .map((r) => randomLayout(createRng(r.seed), r.w, r.h, r.arrows, r.len))

const paramsArb: fc.Arbitrary<GeneratorParams> = fc
  .record({
    width: fc.integer({ min: 1, max: 16 }),
    height: fc.integer({ min: 2, max: 16 }),
    minLength: fc.integer({ min: 2, max: 4 }),
    extraLength: fc.integer({ min: 0, max: 14 }),
    turnChance: fc.double({ min: 0, max: 1, noNaN: true }),
    targetFill: fc.double({ min: 0.1, max: 1, noNaN: true }),
    blockSeeking: fc.double({ min: 0, max: 1, noNaN: true }),
    dirWeights: fc.option(
      fc.tuple(fc.nat(3), fc.nat(3), fc.nat(3), fc.nat(3)).filter((t) => t.some((v) => v > 0)),
      { nil: undefined },
    ),
  })
  .map((r) => ({
    width: r.width,
    height: r.height,
    minLength: r.minLength,
    maxLength: r.minLength + r.extraLength,
    turnChance: r.turnChance,
    targetFill: r.targetFill,
    blockSeeking: r.blockSeeking,
    dirWeights: r.dirWeights,
    minFill: 0,
    maxInitialFreeRatio: 1,
    minArrows: 0,
    attempts: 1,
  }))

const presetArb = fc.constantFrom('tiny', 'easy', 'medium', 'hard', 'expert' as const)

function generated(name: keyof typeof PRESETS, seed: number): Level {
  const res = generateLevel(PRESETS[name], seed)
  if (!res.level) throw new Error('no level')
  return res.level
}

describe('solver properties (arbitrary boards)', () => {
  it('greedy solver agrees with exhaustive search', () => {
    fc.assert(
      fc.property(layoutArb, (level) => {
        expect(solveBoard(level).solvable).toBe(bruteForceSolvable(level))
      }),
      { numRuns: 600 },
    )
  })

  it('a solvable verdict comes with an order the independent replayer accepts; a stuck set is truly stuck', () => {
    fc.assert(
      fc.property(layoutArb, (level) => {
        const r = solveBoard(level)
        if (r.solvable) {
          expect(replayOrder(level, r.order)).toEqual({ ok: true })
        } else {
          expect(r.stuck.length).toBeGreaterThan(0)
          const alive = level.arrows.map((a) => r.stuck.includes(a.id))
          for (const id of r.stuck) expect(naiveCanExit(level, alive, id)).toBe(false)
          expect(replayOrder(level, r.order).ok).toBe(false) // legal prefix, but board not cleared
        }
      }),
      { numRuns: 400 },
    )
  })

  it('monotonicity: removing an arrow never blocks an arrow that was free', () => {
    fc.assert(
      fc.property(layoutArb, seedArb, (level, seed) => {
        const rng = createRng(seed)
        const s = BoardState.fromLevel(level)
        for (;;) {
          const free = s.freeArrows()
          if (free.length === 0) break
          s.remove(free[rng.int(free.length)])
          for (const id of free) if (s.isAlive(id)) expect(s.canExit(id)).toBe(true)
        }
      }),
      { numRuns: 400 },
    )
  })

  it('incremental BoardState matches naive recomputation under random remove/undo', () => {
    fc.assert(
      fc.property(layoutArb, seedArb, (level, seed) => {
        const rng = createRng(seed)
        const s = BoardState.fromLevel(level)
        for (let op = 0; op < 40; op++) {
          const free = s.freeArrows()
          if (free.length > 0 && (s.removed.length === 0 || rng.next() < 0.65)) s.remove(free[rng.int(free.length)])
          else s.undo()
          const alive = level.arrows.map((a) => s.isAlive(a.id))
          let freeCount = 0
          for (const a of level.arrows) {
            const expected = alive[a.id] && naiveCanExit(level, alive, a.id)
            expect(s.canExit(a.id)).toBe(expected)
            if (expected) freeCount++
          }
          expect(s.freeCount).toBe(freeCount)
          expect(s.remaining).toBe(alive.filter(Boolean).length)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('clone is independent', () => {
    fc.assert(
      fc.property(layoutArb, (level) => {
        const s = BoardState.fromLevel(level)
        const c = s.clone()
        const free = s.freeArrows()
        if (free.length > 0) {
          s.remove(free[0])
          expect(c.isAlive(free[0])).toBe(true)
          expect(c.remaining).toBe(level.arrows.length)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('Rotate readiness: rigid 90° rotation preserves blocking relation and solvability', () => {
    fc.assert(
      fc.property(layoutArb, (level) => {
        const rot = rotateLevelCW(level)
        expect(validateLevel(rot)).toEqual(validateLevel(level).length === 0 ? [] : expect.any(Array))
        const a = BoardState.fromLevel(level)
        const b = BoardState.fromLevel(rot)
        for (const arrow of level.arrows) expect(b.blockers(arrow.id)).toEqual(a.blockers(arrow.id))
        expect(solveBoard(rot).solvable).toBe(solveBoard(level).solvable)
      }),
      { numRuns: 300 },
    )
  })
})

describe('generator properties', () => {
  it('every constructed board is valid and its stored solution replays — for arbitrary params, accepted or not', () => {
    fc.assert(
      fc.property(paramsArb, seedArb, (params, seed) => {
        const res = generateLevel({ ...params, verify: false }, seed)
        expect(res.ok).toBe(true) // acceptance thresholds are disabled in paramsArb
        const level = res.level as Level
        expect(verifyLevel(level)).toEqual([])
        expect(solveBoard(level).solvable).toBe(true)
        if (params.dirWeights) for (const a of level.arrows) expect(params.dirWeights[a.dir]).toBeGreaterThan(0)
        for (const a of level.arrows) expect(a.cells.length).toBeLessThanOrEqual(params.maxLength + 2)
      }),
      { numRuns: 1500 },
    )
  })

  it('presets: accepted, verified, deterministic, canonical ids, sane metrics', () => {
    fc.assert(
      fc.property(presetArb, seedArb, (name, seed) => {
        const res = generateLevel(PRESETS[name], seed)
        const level = res.level as Level
        expect(verifyLevel(level)).toEqual([])
        expect(levelHash(generated(name, seed))).toBe(levelHash(level))
        // A rare acceptance failure is a measured rate (see bench), not a bug; skip threshold checks.
        if (!res.ok) return

        const heads = level.arrows.map((a) => a.cells[a.cells.length - 1])
        expect(heads).toEqual([...heads].sort((x, y) => x - y))

        const m = computeMetrics(level)
        const p = PRESETS[name]
        expect(m.fill).toBeGreaterThanOrEqual(p.minFill)
        expect(m.fill).toBeLessThanOrEqual(1)
        expect(m.initialFreeRatio).toBeLessThanOrEqual(p.maxInitialFreeRatio)
        expect(m.initialFree).toBeGreaterThanOrEqual(1)
        expect(m.dirCounts.reduce((x, y) => x + y, 0)).toBe(m.arrows)
        expect(m.depth).toBeGreaterThanOrEqual(1)
        expect(m.score).toBeGreaterThanOrEqual(0)
        expect(m.score).toBeLessThanOrEqual(100)
      }),
      { numRuns: 500 },
    )
  })

  it('layer depth equals the longest blocker chain computed independently', () => {
    fc.assert(
      fc.property(presetArb, seedArb, (name, seed) => {
        const level = generated(name, seed)
        const s = BoardState.fromLevel(level)
        const memo = new Map<number, number>()
        const layerOf = (id: number): number => {
          const cached = memo.get(id)
          if (cached !== undefined) return cached
          const bl = s.blockers(id)
          const v = bl.length === 0 ? 0 : 1 + Math.max(...bl.map(layerOf))
          memo.set(id, v)
          return v
        }
        const { solvable, layers } = peelLayers(BoardTopology.fromLevel(level))
        expect(solvable).toBe(true)
        layers.forEach((layer, k) => {
          for (const id of layer) expect(layerOf(id)).toBe(k)
        })
      }),
      { numRuns: 200 },
    )
  })

  it('solution survives rotation and JSON round-trip', () => {
    fc.assert(
      fc.property(presetArb, seedArb, (name, seed) => {
        const level = generated(name, seed)
        const rot = rotateLevelCW(rotateLevelCW(rotateLevelCW(level)))
        expect(verifyLevel(rot)).toEqual([])
        const back = levelFromJson(JSON.parse(JSON.stringify(levelToJson(level))))
        expect(levelHash(back)).toBe(levelHash(level))
        expect(verifyLevel(back)).toEqual([])
      }),
      { numRuns: 200 },
    )
  })
})

describe('generator sweeps', () => {
  it('golden level hashes (seed -> identical level across versions and machines)', () => {
    const hashes = (['tiny', 'medium', 'expert'] as const).map((n) => `${n}:${levelHash(generated(n, 42))}`)
    expect(hashes).toMatchInlineSnapshot(`
      [
        "tiny:a7523f57",
        "medium:5b5e66e7",
        "expert:b98b11d9",
      ]
    `)
  })

  it('large presets stay valid', () => {
    for (const name of ['huge', 'xl'] as const) {
      for (let seed = 0; seed < 8; seed++) {
        const res = generateLevel(PRESETS[name], seed)
        expect(res.level).not.toBeNull()
        expect(verifyLevel(res.level as Level)).toEqual([])
      }
    }
  })

  it('dirWeights can restrict a board to one exit side', () => {
    const res = generateLevel({ ...PRESETS.easy, dirWeights: [0, 1, 0, 0], maxInitialFreeRatio: 1, minFill: 0 }, 5)
    expect(res.ok).toBe(true)
    expect(new Set(res.level?.arrows.map((a) => a.dir))).toEqual(new Set([1]))
  })
})
