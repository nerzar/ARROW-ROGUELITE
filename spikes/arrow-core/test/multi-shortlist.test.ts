import { describe, expect, it } from 'vitest'
import {
  analyzeMultiSeed,
  multiEnemyDef,
  parseEnemySpec,
  parseSeedRange,
  scanMultiEncounter,
  type MultiScanOptions,
} from '../tools/multi-shortlist.js'
import { E, EncounterState, generateLevel, N, PRESETS } from '../src/index.js'

/**
 * EXP-012: multi-enemy encounter analyzer. Facts only — no ranking, no "fun score".
 * The tool filters seeds by proven facts (solvable, min unavoidable damage <= max) and reports
 * per-seed data; the final level-design pick stays with the human Level Designer.
 * Combat rules and hand-authored encounters are untouched (see test/multi-enemy.test.ts).
 */

const BUDGET = 200_000

const easySeed = (seed: number) => {
  const res = generateLevel(PRESETS.easy, seed)
  if (!res.ok || !res.level) throw new Error(`easy seed ${seed}: generation failed`)
  return res.level
}

/** The known multi-enemy case: easy seed 10, E (hp 2, ATTACK IN 3, dmg 2) + N (hp 2, ATTACK IN 5, dmg 2). */
const seed10Def = () =>
  multiEnemyDef(
    'probe',
    'probe',
    [
      { side: E, hp: 2, interval: 3, damage: 2 },
      { side: N, hp: 2, interval: 5, damage: 2 },
    ],
    1,
  )

const baseOptions = (over: Partial<MultiScanOptions> = {}): MultiScanOptions => ({
  preset: 'easy',
  enemies: [
    { side: E, hp: 2, interval: 3, damage: 2 },
    { side: N, hp: 2, interval: 5, damage: 2 },
  ],
  playerHp: 10,
  maxDamage: 0,
  start: 1,
  count: 60,
  top: 20,
  minArrows: 6,
  maxArrows: 24,
  blockedTapDamage: 1,
  nodeBudget: BUDGET,
  ...over,
})

describe('parseEnemySpec', () => {
  it('parses SIDE:HP:INTERVAL:DAMAGE', () => {
    expect(parseEnemySpec('E:2:3:2')).toEqual({ side: E, hp: 2, interval: 3, damage: 2 })
    expect(parseEnemySpec('n:2:5:2')).toEqual({ side: N, hp: 2, interval: 5, damage: 2 })
  })

  it('parses a passive SIDE:HP enemy (never attacks)', () => {
    expect(parseEnemySpec('N:2')).toEqual({ side: N, hp: 2 })
  })

  it('parses the opt-in interrupt form SIDE:HP:INTERVAL:DAMAGE:INTERRUPT_HITS', () => {
    expect(parseEnemySpec('E:2:3:2:2')).toEqual({ side: E, hp: 2, interval: 3, damage: 2, interruptHits: 2 })
  })

  it('rejects bad specs', () => {
    for (const bad of ['E', 'X:2:3:2', 'E:0:3:2', 'E:2:0:2', 'E:2:3:0', 'E:2:3', 'E:2:3:2:0', 'E:1.5:3:2', 'E:2:3:2:1:9']) {
      expect(() => parseEnemySpec(bad), bad).toThrow()
    }
  })
})

describe('parseSeedRange', () => {
  it('parses START:COUNT', () => {
    expect(parseSeedRange('1:5000')).toEqual({ start: 1, count: 5000 })
  })

  it('rejects bad ranges', () => {
    for (const bad of ['5000', '1:', ':5', '1:0', 'a:b', '1:2:3']) {
      expect(() => parseSeedRange(bad), bad).toThrow()
    }
  })
})

describe('seed 10 known multi-enemy case', () => {
  it('is solvable with a proven 0-damage (clean) path', () => {
    const facts = analyzeMultiSeed(easySeed(10), seed10Def(), { playerHp: 10, nodeBudget: BUDGET })
    expect(facts.seed).toBe(10)
    expect(facts).toMatchObject({
      solvable: true,
      proven: true,
      arrows: 10,
      minDamage: 0,
      minDamageProven: true,
      cleanPath: true,
      earliestHitProven: true,
    })
    expect(facts.dirCounts).toEqual([3, 5, 1, 1])
    expect(facts.initialFree).toEqual([1, 1, 1, 1])
    expect(facts.earliestHitTurn).toEqual({ E: 1, N: 1 })
  })

  it('the example winning path replays to a win with full HP', () => {
    const level = easySeed(10)
    const def = seed10Def()
    const facts = analyzeMultiSeed(level, def, { playerHp: 10, nodeBudget: BUDGET })
    expect(facts.exampleActions.length).toBeGreaterThan(0)
    expect(facts.examplePath.length).toBe(facts.exampleActions.length)
    const s = EncounterState.fromLevel(level, def, 10)
    for (const a of facts.exampleActions) s.apply(a)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBe(10)
  })

  it('reports first damage turn on the canonical (stored-solution) order', () => {
    // The canonical order kills the slow N enemy first, so the urgent E enemy fires at turn 3.
    const facts = analyzeMultiSeed(easySeed(10), seed10Def(), { playerHp: 10, nodeBudget: BUDGET })
    expect(facts.firstDamageTurnCanonical).toBe(3)
  })
})

describe('independent timers', () => {
  it('each enemy ticks on its own clock: only the tight timer creates pressure', () => {
    const level = easySeed(10)
    const opts = { playerHp: 10, nodeBudget: BUDGET }
    // Only E attacks (N passive): killable before ATTACK IN 3 fires -> clean.
    const onlyE = analyzeMultiSeed(
      level,
      multiEnemyDef('p', 'p', [{ side: E, hp: 2, interval: 3, damage: 2 }, { side: N, hp: 2 }], 1),
      opts,
    )
    expect(onlyE).toMatchObject({ solvable: true, proven: true, minDamage: 0, cleanPath: true })
    // Only N attacks (E passive): killable before ATTACK IN 5 fires -> clean.
    const onlyN = analyzeMultiSeed(
      level,
      multiEnemyDef('p', 'p', [{ side: E, hp: 2 }, { side: N, hp: 2, interval: 5, damage: 2 }], 1),
      opts,
    )
    expect(onlyN).toMatchObject({ solvable: true, proven: true, minDamage: 0, cleanPath: true })
    // E on the tightest clock (every turn) while N stays passive: damage is unavoidable.
    const tightE = analyzeMultiSeed(
      level,
      multiEnemyDef('p', 'p', [{ side: E, hp: 2, interval: 1, damage: 1 }, { side: N, hp: 2 }], 1),
      opts,
    )
    expect(tightE).toMatchObject({ solvable: true, proven: true, cleanPath: false })
    expect(tightE.minDamage).toBeGreaterThan(0)
  })

  it('killing one enemy does not silence the other (analyzer-level)', () => {
    // Both attack every turn for 1: even the fastest kill order takes damage from the survivor.
    const facts = analyzeMultiSeed(
      easySeed(10),
      multiEnemyDef(
        'p',
        'p',
        [
          { side: E, hp: 2, interval: 1, damage: 1 },
          { side: N, hp: 2, interval: 1, damage: 1 },
        ],
        1,
      ),
      { playerHp: 10, nodeBudget: BUDGET },
    )
    expect(facts).toMatchObject({ solvable: true, proven: true, cleanPath: false })
    expect(facts.minDamage).toBeGreaterThanOrEqual(2)
  })
})

describe('filtering by max damage', () => {
  it('max-damage 0 excludes the tight-timer seed 10, max-damage 2 keeps it with minDamage 2', () => {
    const tight: MultiScanOptions = {
      ...baseOptions({ start: 10, count: 1, top: 5 }),
      enemies: [
        { side: E, hp: 2, interval: 1, damage: 1 },
        { side: N, hp: 2, interval: 5, damage: 1 },
      ],
      maxDamage: 0,
    }
    expect(scanMultiEncounter(tight, 't', 't').candidates).toEqual([])
    const loose = scanMultiEncounter({ ...tight, maxDamage: 2 }, 't', 't')
    expect(loose.candidates.map((c) => c.seed)).toEqual([10])
    expect(loose.candidates[0]).toMatchObject({ minDamage: 2, cleanPath: false })
  })

  it('every seed passing max-damage 0 also passes a looser bound with the same minDamage', () => {
    const strict = scanMultiEncounter(baseOptions({ start: 8, count: 8, top: 20 }), 't', 't')
    const loose = scanMultiEncounter(baseOptions({ start: 8, count: 8, top: 20, maxDamage: 99 }), 't', 't')
    const looseBySeed = new Map(loose.candidates.map((c) => [c.seed, c]))
    expect(strict.candidates.length).toBeGreaterThan(0)
    for (const c of strict.candidates) {
      expect(c.minDamage).toBeLessThanOrEqual(0)
      expect(looseBySeed.get(c.seed)?.minDamage).toBe(c.minDamage)
    }
  })
})

describe('deterministic results and stable output', () => {
  it('the same scan twice yields identical results', () => {
    const o = baseOptions({ start: 8, count: 8, top: 20 })
    const a = scanMultiEncounter(o, 't', 't')
    const b = scanMultiEncounter(o, 't', 't')
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('per-seed analysis is deterministic', () => {
    const level = easySeed(10)
    const def = seed10Def()
    const opts = { playerHp: 10, nodeBudget: BUDGET }
    expect(analyzeMultiSeed(level, def, opts)).toEqual(analyzeMultiSeed(level, def, opts))
  })

  it('candidates come in ascending seed order (no re-ranking) and top caps the first N', () => {
    const full = scanMultiEncounter(baseOptions({ start: 1, count: 60, top: 100 }), 't', 't')
    const seeds = full.candidates.map((c) => c.seed)
    expect(seeds.length).toBeGreaterThan(3)
    expect([...seeds].sort((x, y) => x - y)).toEqual(seeds)
    const capped = scanMultiEncounter(baseOptions({ start: 1, count: 60, top: 3 }), 't', 't')
    expect(capped.passed).toBe(full.passed)
    expect(capped.candidates.map((c) => c.seed)).toEqual(seeds.slice(0, 3))
  })
})
