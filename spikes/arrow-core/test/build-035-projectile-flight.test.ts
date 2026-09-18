import { describe, expect, it } from 'vitest'
import {
  FLIGHT_MS,
  STRAIGHT_FRAC,
  flightPoint,
  straightLen,
} from '../viewer/visual-proto/projectile-flight.js'

/**
 * BUILD-035: Projectile Flight v1 trajectory math. Pure geometry -- no DOM, no engine.
 * Pins the presentation contract: exit straight along the freed direction, then steer
 * smoothly (no kink) into the target's hit-anchor; a miss flies straight and fades.
 */
const FROM = { x: 100, y: 200 }
const EAST = { x: 1, y: 0 }
const TARGET = { x: 400, y: 120 }

function spec(target = TARGET) {
  return { from: FROM, dir: EAST, target, straightLen: straightLen(FROM, target) }
}

describe('BUILD-035 flight constants', () => {
  it('flight lasts a readable beat and the straight phase is a real first segment', () => {
    expect(FLIGHT_MS).toBeGreaterThanOrEqual(300)
    expect(FLIGHT_MS).toBeLessThanOrEqual(800)
    expect(STRAIGHT_FRAC).toBeGreaterThan(0)
    expect(STRAIGHT_FRAC).toBeLessThan(0.6)
  })
  it('straight length scales with distance but stays bounded', () => {
    const near = straightLen(FROM, { x: 130, y: 200 })
    const mid = straightLen(FROM, TARGET)
    const far = straightLen(FROM, { x: 3000, y: 200 })
    expect(near).toBeGreaterThanOrEqual(30)
    expect(mid).toBeGreaterThan(near)
    expect(far).toBeLessThanOrEqual(200)
  })
})

describe('BUILD-035 hit leg', () => {
  it('t=0 sits at the exit cell, heading along the exit direction', () => {
    const p = flightPoint(0, spec())
    expect(p.x).toBeCloseTo(FROM.x, 9)
    expect(p.y).toBeCloseTo(FROM.y, 9)
    expect(p.angle).toBeCloseTo(0, 9) // +x
    expect(p.speed).toBeGreaterThanOrEqual(0)
  })
  it('t=1 lands exactly on the hit-anchor', () => {
    const p = flightPoint(1, spec())
    expect(p.x).toBeCloseTo(TARGET.x, 6)
    expect(p.y).toBeCloseTo(TARGET.y, 6)
  })
  it('the straight phase is exactly collinear with the exit ray', () => {
    for (const t of [0.05, 0.15, 0.3]) {
      const p = flightPoint(t, spec())
      expect(p.y).toBeCloseTo(FROM.y, 9)
      expect(p.x).toBeGreaterThan(FROM.x)
      expect(p.angle).toBeCloseTo(0, 9)
    }
  })
  it('position and heading are continuous across the junction (no kink)', () => {
    const e = 0.002
    const a = flightPoint(STRAIGHT_FRAC - e, spec())
    const b = flightPoint(STRAIGHT_FRAC + e, spec())
    // Window is 2e of unit time; the accelerating leg covers a few px there (no teleport).
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(4)
    // Heading just after the junction still follows the exit ray (bezier control sits on it).
    expect(Math.abs(b.angle)).toBeLessThan(0.15)
  })
  it('speed ramps up after launch (acceleration, not cruise)', () => {
    const s = spec()
    const vEarly = flightPoint(0.05, s).speed
    const vLate = flightPoint(0.3, s).speed
    expect(vEarly).toBeGreaterThanOrEqual(0)
    expect(vLate).toBeGreaterThan(vEarly)
  })
  it('speed settles softly into the hit (no full-speed slam)', () => {
    const s = spec()
    const vCruise = flightPoint(0.6, s).speed
    const vEnd = flightPoint(0.99, s).speed
    expect(vEnd).toBeLessThan(vCruise)
    expect(vEnd).toBeGreaterThanOrEqual(0)
  })
  it('speed stays finite everywhere, including the junction and degenerate legs', () => {
    const s = spec()
    for (const t of [0, STRAIGHT_FRAC - 0.002, STRAIGHT_FRAC, STRAIGHT_FRAC + 0.002, 0.7, 1]) {
      const v = flightPoint(t, s).speed
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })
  it('the steered phase actually bends toward the target', () => {
    const mid = flightPoint(0.65, spec())
    // Target is above the exit ray (y 120 < 200): the curve must already be climbing.
    expect(mid.y).toBeLessThan(FROM.y)
    expect(mid.x).toBeGreaterThan(FROM.x)
  })
  it('a target directly behind still resolves without NaN', () => {
    const behind = { from: FROM, dir: EAST, target: { x: 40, y: 200 }, straightLen: 30 }
    for (const t of [0, 0.35, 0.6, 1]) {
      const p = flightPoint(t, behind)
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.angle)).toBe(true)
    }
    const end = flightPoint(1, behind)
    expect(end.x).toBeCloseTo(40, 6)
  })
  it('time outside [0,1] clamps to the endpoints', () => {
    expect(flightPoint(-0.5, spec()).x).toBeCloseTo(FROM.x, 9)
    const end = flightPoint(1.5, spec())
    expect(end.x).toBeCloseTo(TARGET.x, 6)
    expect(end.y).toBeCloseTo(TARGET.y, 6)
  })
})

describe('BUILD-035 miss leg', () => {
  it('a miss flies straight along the exit ray, accelerating away', () => {
    const s = { from: FROM, dir: EAST, target: null, straightLen: 300 }
    let prevX = FROM.x
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const p = flightPoint(t, s)
      expect(p.y).toBeCloseTo(FROM.y, 9)
      expect(p.x).toBeCloseTo(FROM.x + 300 * Math.pow(t, 1.6), 6)
      expect(p.x).toBeGreaterThanOrEqual(prevX)
      prevX = p.x
      expect(p.angle).toBeCloseTo(0, 9)
    }
  })
})

describe('BUILD-035 lob arc', () => {
  const arced = { from: FROM, dir: EAST, target: TARGET, straightLen: straightLen(FROM, TARGET), arc: 80 }

  it('endpoints are unchanged by the arc', () => {
    const a = flightPoint(0, arced)
    expect(a.x).toBeCloseTo(FROM.x, 9)
    const b = flightPoint(1, arced)
    expect(b.x).toBeCloseTo(TARGET.x, 6)
    expect(b.y).toBeCloseTo(TARGET.y, 6)
  })

  it('the arc bulges the steered leg upward, never the exit phase', () => {
    const flat = flightPoint(0.6, spec())
    const lob = flightPoint(0.6, arced)
    expect(lob.y).toBeLessThan(flat.y)
    // Exit phase stays on the ray even with an arc set.
    expect(flightPoint(0.2, arced).y).toBeCloseTo(FROM.y, 9)
  })

  it('arc 0 (or omitted) reproduces the flat trajectory exactly', () => {
    const explicit = { ...spec(), arc: 0 }
    for (const t of [0.4, 0.6, 0.85]) {
      const a = flightPoint(t, spec())
      const b = flightPoint(t, explicit)
      expect(b.x).toBeCloseTo(a.x, 9)
      expect(b.y).toBeCloseTo(a.y, 9)
    }
  })

  it('a miss ignores the arc', () => {
    const s = { from: FROM, dir: EAST, target: null, straightLen: 300, arc: 80 }
    expect(flightPoint(0.7, s).y).toBeCloseTo(FROM.y, 9)
  })
})
