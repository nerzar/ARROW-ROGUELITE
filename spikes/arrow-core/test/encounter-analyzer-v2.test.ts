import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  analyzeMultiSeed,
  multiEnemyDef,
  parseEnemiesJson,
  parseEnemySpec,
  parseSeedRange,
  scanMultiEncounter,
  type MultiScanOptions,
} from '../tools/multi-shortlist.js'
import { E, encounterFromJson, EncounterState, generateLevel, N, PRESETS } from '../src/index.js'

/**
 * EXP-014: encounter analyzer V2 — regression.
 *
 * Ported from EXP-012 (`test/multi-shortlist.test.ts`, commit 183fa59) onto the EXP-013
 * `EncounterState`, plus the new mechanics the task requires the analyzer to understand:
 * normal/cast attacks, interruptible casts, Stone Throw (ability countdown, pin duration,
 * deterministic safe targeting). Facts only — no fun score, no AI ranking, no gameplay changes.
 */

const BUDGET = 200_000

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

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

describe('parseEnemySpec (EXP-012 base forms, unchanged)', () => {
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

describe('parseEnemySpec (EXP-014: cast + Stone Throw tokens)', () => {
  it('parses cast and interruptible cast', () => {
    expect(parseEnemySpec('E:2:4:99:cast')).toEqual({ side: E, hp: 2, interval: 4, damage: 99, kind: 'cast' })
    expect(parseEnemySpec('E:2:4:99:cast-int')).toEqual({
      side: E, hp: 2, interval: 4, damage: 99, kind: 'cast', interruptible: true,
    })
  })

  it('parses a Stone Throw ability on an attacking enemy', () => {
    expect(parseEnemySpec('N:6:5:1:throw:3:2')).toEqual({
      side: N, hp: 6, interval: 5, damage: 1, ability: { interval: 3, pinDuration: 2 },
    })
  })

  it('parses an ability-only (passive attacker) thrower', () => {
    expect(parseEnemySpec('N:6:throw:3:2')).toEqual({ side: N, hp: 6, ability: { interval: 3, pinDuration: 2 } })
  })

  it('combines legacy interrupt, cast-int and throw tokens', () => {
    expect(parseEnemySpec('E:2:3:2:2:throw:3:2')).toEqual({
      side: E, hp: 2, interval: 3, damage: 2, interruptHits: 2, ability: { interval: 3, pinDuration: 2 },
    })
    expect(parseEnemySpec('E:2:4:99:cast-int:throw:3:2')).toEqual({
      side: E, hp: 2, interval: 4, damage: 99, kind: 'cast', interruptible: true,
      ability: { interval: 3, pinDuration: 2 },
    })
  })

  it('builds the matching EncounterDef shapes (interruptedAttack + ability)', () => {
    const def = multiEnemyDef('t', 't', [parseEnemySpec('E:2:4:99:cast-int'), parseEnemySpec('N:6:throw:3:2')], 1)
    expect(def.enemies![0].attackTimer).toEqual({
      interval: 4, damage: 99, kind: 'cast', interruptible: true,
      interruptedAttack: { interval: 4, damage: 99, kind: 'normal' },
    })
    expect(def.enemies![1].attackTimer).toBeUndefined()
    expect(def.enemies![1].ability).toMatchObject({ id: 'stone_throw', interval: 3, targetPolicy: 'free-arrow', pinDuration: 2 })
  })

  it('rejects bad cast/throw tokens', () => {
    for (const bad of [
      'E:2:4:99:bogus', 'E:2:4:99:throw:3', 'E:2:4:99:throw:0:2', 'E:2:4:99:throw:3:0',
      'E:2:4:99:cast:cast', 'E:2:4:99:throw:3:2:throw:3:2', 'N:2:cast', 'E:2:3:2:2:9',
    ]) {
      expect(() => parseEnemySpec(bad), bad).toThrow()
    }
  })
})

describe('parseEnemiesJson', () => {
  it('accepts a full-fidelity spec array', () => {
    expect(parseEnemiesJson('[{"side":1,"hp":2,"interval":4,"damage":99,"kind":"cast","interruptible":true}]')).toEqual([
      { side: E, hp: 2, interval: 4, damage: 99, kind: 'cast', interruptible: true },
    ])
  })

  it('rejects bad JSON specs', () => {
    for (const bad of [
      'not-json', '[]', '{}', '[{"side":9,"hp":2}]', '[{"side":1,"hp":0}]',
      '[{"side":1,"hp":2,"interval":3}]', '[{"side":1,"hp":2,"kind":"cast"}]',
      '[{"side":1,"hp":2,"interruptible":true}]', '[{"side":1,"hp":2,"ability":{"interval":0,"pinDuration":2}}]',
    ]) {
      expect(() => parseEnemiesJson(bad), bad).toThrow()
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
    expect(facts.initialPlayableArrows).toEqual([0, 3, 6, 9])
    expect(facts.earliestHitTurn).toEqual({ E: 1, N: 1 })
    // No casts/abilities in this def: the new event streams stay empty.
    expect(facts.castInterrupts).toEqual([])
    expect(facts.abilityTriggers).toEqual([])
    expect(facts.pinnedArrowIds).toEqual([])
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

describe('caster fixture (EXP-011 cast, interruptible)', () => {
  const casterDef = (interruptible: boolean) =>
    multiEnemyDef('caster-probe', 'caster-probe', [
      { side: E, hp: 2, interval: 5, damage: 2, kind: 'cast', ...(interruptible ? { interruptible: true as const } : {}) },
      { side: N, hp: 2, interval: 5, damage: 2 },
    ], 1)

  it('an interruptible cast is broken on the example winning path (turn + enemy recorded)', () => {
    const facts = analyzeMultiSeed(easySeed(10), casterDef(true), { playerHp: 10, nodeBudget: BUDGET })
    expect(facts).toMatchObject({ solvable: true, proven: true, minDamage: 0, cleanPath: true })
    expect(facts.castInterrupts).toEqual([{ turn: 1, enemyId: 'e_0', side: 'E' }])
  })

  it('an uninterruptible cast is never broken (same board, same timers)', () => {
    const facts = analyzeMultiSeed(easySeed(10), casterDef(false), { playerHp: 10, nodeBudget: BUDGET })
    expect(facts).toMatchObject({ solvable: true, proven: true })
    expect(facts.castInterrupts).toEqual([])
  })
})

describe('rock-spike / Stone Pin fixture (EXP-013 ability)', () => {
  const rockSpike = () => {
    const { file: enc, level } = encounterFromJson(load('rock-spike.json'))
    return { def: enc.encounter, level }
  }

  it('reports ability trigger turns, pinned arrows and pin duration on the example path', () => {
    const { def, level } = rockSpike()
    const facts = analyzeMultiSeed(level, def, { playerHp: 10, nodeBudget: BUDGET })
    expect(facts).toMatchObject({ solvable: true, proven: true, minDamageProven: true })
    // THROW IN 3 resolves at world turns 3 and 6, pinning for 2 turns each time.
    expect(facts.abilityTriggers).toEqual([
      { turn: 3, enemyId: 'rockthrower', pinnedId: 5, pinDuration: 2 },
      { turn: 6, enemyId: 'rockthrower', pinnedId: 4, pinDuration: 2 },
    ])
    expect(facts.pinnedArrowIds).toEqual([4, 5])
  })

  it('the example winning path replays to a win and matches the proven min damage', () => {
    const { def, level } = rockSpike()
    const facts = analyzeMultiSeed(level, def, { playerHp: 10, nodeBudget: BUDGET })
    expect(facts.minDamage).toBe(2)
    expect(facts.cleanPath).toBe(false)
    const s = EncounterState.fromLevel(level, def, 10)
    for (const a of facts.exampleActions) s.apply(a)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBe(10 - facts.minDamage)
  })
})

describe('pin state influences the result', () => {
  const thrownDef = () =>
    multiEnemyDef('pin-probe', 'pin-probe', [
      { side: E, hp: 2, interval: 3, damage: 2 },
      { side: N, hp: 2, interval: 5, damage: 2, ability: { interval: 1, pinDuration: 4 } },
    ], 1)

  it('the same seed with an aggressive Stone Throw has worse proven min damage', () => {
    const level = easySeed(10)
    const plain = analyzeMultiSeed(level, seed10Def(), { playerHp: 10, nodeBudget: BUDGET })
    const thrown = analyzeMultiSeed(level, thrownDef(), { playerHp: 10, nodeBudget: BUDGET })
    expect(plain).toMatchObject({ solvable: true, proven: true, minDamage: 0 })
    expect(thrown).toMatchObject({ solvable: true, proven: true, minDamage: 2 })
    expect(thrown.abilityTriggers.length).toBeGreaterThan(0)
    expect(thrown.pinnedArrowIds).toEqual([0, 1, 5])
    expect(plain.abilityTriggers).toEqual([])
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

  it('per-seed analysis is deterministic (including pin/cast event streams)', () => {
    const level = easySeed(10)
    const def = multiEnemyDef('p', 'p', [
      { side: E, hp: 2, interval: 5, damage: 2, kind: 'cast', interruptible: true },
      { side: N, hp: 2, interval: 5, damage: 2, ability: { interval: 1, pinDuration: 4 } },
    ], 1)
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
