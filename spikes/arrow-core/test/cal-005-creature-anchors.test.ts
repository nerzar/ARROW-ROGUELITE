import { afterEach, describe, expect, it } from 'vitest'
import {
  resetSpeciesPresentation,
  setSpeciesPresentation,
  speciesHudOffset,
  speciesPivotDelta,
  speciesScale,
  speciesShadowOffset,
} from '../viewer/visual-proto/species-presentation.js'
import { hudBoxes } from '../viewer/visual-proto/arena-layout.js'

/**
 * CAL-005: species-level HUD offset + shadow offset, and the hudBoxes offset anchor.
 * Pins the no-op/backward-compat contract (entries saved before CAL-005 have neither key
 * and must render exactly as before) and the one-anchor-moves-everything HUD contract
 * (bar, plate, badge, text baselines shift together).
 */
describe('CAL-005 species HUD/shadow offsets', () => {
  afterEach(() => resetSpeciesPresentation())

  it('an unconfigured species contributes zero HUD and shadow offsets (no-op)', () => {
    expect(speciesHudOffset('never-touched-species')).toEqual({ x: 0, y: 0 })
    expect(speciesShadowOffset('never-touched-species')).toEqual({ x: 0, y: 0 })
  })

  it('a pre-CAL-005 entry shape (pivot/scale only) still resolves zero offsets', () => {
    // Same object shape creature-poses.json entries had before CAL-005 added the keys.
    setSpeciesPresentation('goblin-shaman', { pivot: { x: 0.49, y: 0.9 }, scale: 0.8 })
    expect(speciesHudOffset('goblin-shaman')).toEqual({ x: 0, y: 0 })
    expect(speciesShadowOffset('goblin-shaman')).toEqual({ x: 0, y: 0 })
    // ...and the old fields keep working untouched.
    expect(speciesScale('goblin-shaman')).toBe(0.8)
    expect(speciesPivotDelta('goblin-shaman').dx).toBeCloseTo(0.49 - 0.5)
  })

  it('saved HUD/shadow offsets round-trip verbatim, including negatives', () => {
    setSpeciesPresentation('dire-wolf', { hudOffset: { x: 0.05, y: -0.12 }, shadowOffset: { x: -0.03, y: 0.07 } })
    expect(speciesHudOffset('dire-wolf')).toEqual({ x: 0.05, y: -0.12 })
    expect(speciesShadowOffset('dire-wolf')).toEqual({ x: -0.03, y: 0.07 })
  })

  it('offsets merge with pivot/scale across calls instead of replacing them', () => {
    setSpeciesPresentation('goblin-taunter', { scale: 1.2 })
    setSpeciesPresentation('goblin-taunter', { hudOffset: { x: 0.02, y: 0.04 } })
    setSpeciesPresentation('goblin-taunter', { shadowOffset: { x: 0.01, y: -0.01 } })
    setSpeciesPresentation('goblin-taunter', { pivot: { x: 0.4, y: 0.9 } })
    expect(speciesScale('goblin-taunter')).toBe(1.2)
    expect(speciesHudOffset('goblin-taunter')).toEqual({ x: 0.02, y: 0.04 })
    expect(speciesShadowOffset('goblin-taunter')).toEqual({ x: 0.01, y: -0.01 })
    expect(speciesPivotDelta('goblin-taunter').dx).toBeCloseTo(0.4 - 0.5)
  })

  it('malformed offsets are ignored rather than corrupting state', () => {
    setSpeciesPresentation('small-goblin', {
      hudOffset: { x: 'nope', y: 0 } as unknown as { x: number; y: number },
      shadowOffset: { x: Number.NaN, y: Number.POSITIVE_INFINITY } as unknown as { x: number; y: number },
    })
    expect(speciesHudOffset('small-goblin')).toEqual({ x: 0, y: 0 })
    expect(speciesShadowOffset('small-goblin')).toEqual({ x: 0, y: 0 })
  })

  it('an explicit zero offset is a no-op identical to an absent one', () => {
    setSpeciesPresentation('green-slime', { hudOffset: { x: 0, y: 0 }, shadowOffset: { x: 0, y: 0 } })
    expect(speciesHudOffset('green-slime')).toEqual({ x: 0, y: 0 })
    expect(speciesShadowOffset('green-slime')).toEqual({ x: 0, y: 0 })
  })
})

describe('CAL-005 hudBoxes offset anchor', () => {
  const base = {
    slot: { x: 0, y: 0 },
    char: { x: -90, y: -90, w: 180, h: 180 },
    side: 0, fontPx: 10, lineH: 11.5, lineCount: 3,
    barH: 5, maxTextW: 100, cell: 30,
  }

  it('an omitted offset reproduces the legacy geometry exactly', () => {
    const legacy = hudBoxes({ ...base })
    const zero = hudBoxes({ ...base, offset: { x: 0, y: 0 } })
    expect(zero.bar).toEqual(legacy.bar)
    expect(zero.plate).toEqual(legacy.plate)
    expect(zero.badge).toEqual(legacy.badge)
    expect(zero.lineY(0)).toBe(legacy.lineY(0))
    expect(zero.lineX).toBe(legacy.lineX)
  })

  it('one offset moves bar, plate, badge and text together', () => {
    const plain = hudBoxes({ ...base })
    const moved = hudBoxes({ ...base, offset: { x: 12, y: -8 } })
    for (const box of ['bar', 'plate'] as const) {
      expect(moved[box].x - plain[box].x).toBe(12)
      expect(moved[box].y - plain[box].y).toBe(-8)
      expect(moved[box].w).toBe(plain[box].w)
      expect(moved[box].h).toBe(plain[box].h)
    }
    expect(moved.badge.x - plain.badge.x).toBe(12)
    expect(moved.badge.y - plain.badge.y).toBe(-8)
    expect(moved.lineY(0) - plain.lineY(0)).toBe(-8)
    expect(moved.lineY(2) - plain.lineY(2)).toBe(-8)
    expect(moved.lineX - plain.lineX).toBe(12)
  })

  it('text x defaults to the slot center when no offset is given', () => {
    expect(hudBoxes({ ...base }).lineX).toBe(0)
    expect(hudBoxes({ ...base, slot: { x: 5, y: 7 } }).lineX).toBe(5)
  })

  it('the offset also applies on the mirrored S-side stack', () => {
    const plain = hudBoxes({ ...base, side: 2 })
    const moved = hudBoxes({ ...base, side: 2, offset: { x: -4, y: 20 } })
    expect(moved.plate.y).toBeGreaterThanOrEqual(plain.plate.y)
    expect(moved.plate.x - plain.plate.x).toBe(-4)
    expect(moved.lineY(1) - plain.lineY(1)).toBe(20)
  })
})
