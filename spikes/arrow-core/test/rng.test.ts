import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed, hashString, shuffleInPlace } from '../src/index.js'

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(123)
    const b = createRng(123)
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next())
  })

  it('golden sequence (guards against accidental algorithm changes)', () => {
    const r = createRng(1)
    const seq = [r.next(), r.next(), r.next()].map((v) => Math.floor(v * 1e9))
    expect(seq).toMatchInlineSnapshot(`
      [
        263228221,
        603402067,
        701973445,
      ]
    `)
    expect(hashString('arrow')).toMatchInlineSnapshot(`4286143457`)
    expect(deriveSeed(1, 2, 3)).toMatchInlineSnapshot(`3137912731`)
  })

  it('neighbouring seeds diverge immediately', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
    expect(deriveSeed(5, 0)).not.toBe(deriveSeed(5, 1))
    expect(deriveSeed(5, 1)).not.toBe(deriveSeed(6, 0))
  })

  it('stays in range with a sane distribution', () => {
    const r = createRng(99)
    const buckets = new Array(10).fill(0)
    let sum = 0
    const n = 100_000
    for (let i = 0; i < n; i++) {
      const v = r.next()
      expect(v >= 0 && v < 1).toBe(true)
      sum += v
      buckets[r.int(10)]++
    }
    expect(sum / n).toBeCloseTo(0.5, 2)
    for (const b of buckets) expect(Math.abs(b - n / 10)).toBeLessThan(n / 100)
  })

  it('shuffle is a permutation', () => {
    const arr = shuffleInPlace(createRng(3), Array.from({ length: 50 }, (_, i) => i))
    expect([...arr].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i))
  })
})
