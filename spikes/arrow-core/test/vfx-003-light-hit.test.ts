import { describe, expect, it } from 'vitest'
import {
  LIGHT_HIT,
  camOffset,
  hashStr,
  punch,
  sparkParts,
  srand,
} from '../viewer/visual-proto/hit-fx.js'

/**
 * VFX-003: light-hit feel scheduling math. Pure helpers only -- canvas painting itself is
 * verified in the browser. Pins the lab's light-hit contract (params) and the deterministic,
 * arrival-synced building blocks the renderer consumes (punch envelope, seeded sparks,
 * decaying camera impulse).
 */
describe('VFX-003 light-hit params match the lab preset', () => {
  it('carries the lab light-hit numbers (flash/sparks/squash/camera)', () => {
    expect(LIGHT_HIT.flashDur).toBe(200)
    expect(LIGHT_HIT.flashScale).toBe(0.85)
    expect(LIGHT_HIT.sparkCount).toBe(14)
    expect(LIGHT_HIT.sparkDur).toBe(420)
    expect(LIGHT_HIT.sparkSpread).toBe(0.85)
    expect(LIGHT_HIT.sqRecoil).toBe(7)
    expect(LIGHT_HIT.sqSquash).toBe(0.10)
    expect(LIGHT_HIT.sqDur).toBe(260)
    expect(LIGHT_HIT.camAmp).toBe(2)
    expect(LIGHT_HIT.camDur).toBe(200)
    expect(LIGHT_HIT.camFreq).toBe(24)
  })
})

describe('VFX-003 punch envelope', () => {
  it('is zero outside [0,1] and peaks around 0.3', () => {
    expect(punch(-0.1)).toBe(0)
    expect(punch(0)).toBe(0)
    expect(punch(1)).toBe(0)
    expect(punch(1.5)).toBe(0)
    let peak = -1
    let peakAt = -1
    for (let i = 1; i < 100; i++) {
      const v = punch(i / 100)
      if (v > peak) {
        peak = v
        peakAt = i / 100
      }
    }
    expect(peak).toBeGreaterThan(0.9)
    expect(peakAt).toBeGreaterThanOrEqual(0.2)
    expect(peakAt).toBeLessThanOrEqual(0.4)
  })

  it('rises fast then settles (monotone up before the peak, down after)', () => {
    expect(punch(0.1)).toBeLessThan(punch(0.2))
    expect(punch(0.2)).toBeLessThan(punch(0.3))
    expect(punch(0.5)).toBeLessThan(punch(0.3))
    expect(punch(0.9)).toBeLessThan(punch(0.5))
  })
})

describe('VFX-003 deterministic sparks', () => {
  it('same seed replays identical particles (frozen frames stay stable)', () => {
    const a = sparkParts(12345, LIGHT_HIT.sparkCount, 0)
    const b = sparkParts(12345, LIGHT_HIT.sparkCount, 0)
    expect(a).toEqual(b)
    expect(a).toHaveLength(14)
  })

  it('different hits spray differently', () => {
    const a = sparkParts(1, 14, 0)
    const b = sparkParts(2, 14, 0)
    expect(a).not.toEqual(b)
  })

  it('parts stay in lab proportions (cone around base, bounded delay/gravity)', () => {
    const base = Math.PI // spraying west
    for (const s of sparkParts(777, 14, base)) {
      expect(Math.abs(s.ang - base)).toBeLessThanOrEqual(1.25)
      expect(s.spd).toBeGreaterThanOrEqual(0.25)
      expect(s.spd).toBeLessThanOrEqual(1)
      expect(s.size).toBeGreaterThanOrEqual(2)
      expect(s.size).toBeLessThanOrEqual(6.2)
      expect(s.delay).toBeGreaterThanOrEqual(0)
      expect(s.delay).toBeLessThanOrEqual(0.14)
      expect(s.g).toBeGreaterThanOrEqual(0.35)
      expect(s.g).toBeLessThanOrEqual(1.5)
      expect(typeof s.hot).toBe('boolean')
    }
  })

  it('srand is stable per seed', () => {
    const a = srand(42)
    const b = srand(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(hashStr('grunt_e')).toBe(hashStr('grunt_e'))
    expect(hashStr('grunt_e')).not.toBe(hashStr('grunt_n'))
  })
})

describe('VFX-003 camera impulse', () => {
  const shake = { at: 1000, dur: 200, amp: 2, freq: 24 }

  it('is zero outside its window', () => {
    expect(camOffset(999, [shake])).toEqual({ x: 0, y: 0 })
    expect(camOffset(1200, [shake])).toEqual({ x: 0, y: 0 })
    expect(camOffset(1500, [shake])).toEqual({ x: 0, y: 0 })
  })

  it('starts at full amplitude and decays (never exceeds amp)', () => {
    const early = camOffset(1010, [shake])
    const late = camOffset(1150, [shake])
    expect(Math.hypot(early.x, early.y)).toBeLessThanOrEqual(2.001)
    expect(Math.hypot(late.x, late.y)).toBeLessThan(Math.hypot(early.x, early.y) + 0.001)
  })

  it('is deterministic per timestamp and sums overlapping shakes', () => {
    expect(camOffset(1050, [shake])).toEqual(camOffset(1050, [shake]))
    const two = camOffset(1050, [shake, { ...shake, at: 1000 }])
    const one = camOffset(1050, [shake])
    expect(Math.hypot(two.x, two.y)).toBeCloseTo(2 * Math.hypot(one.x, one.y), 9)
  })
})
