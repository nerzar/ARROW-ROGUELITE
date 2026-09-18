import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SPECIES_PIVOT,
  resetSpeciesPresentation,
  setSpeciesPresentation,
  speciesPivotDelta,
  speciesScale,
} from '../viewer/visual-proto/species-presentation.js'

/**
 * TOOL-002: one default pivot + one default scale per species, the middle layer between the
 * shared ANCHOR.offsets (enemy-visual-state.js/boss-visual-state.js) and the per-scene
 * TOP/LEFT/RIGHT calibration override applied in board-renderer.js. Pins the no-op/backward-compat
 * contract (an unconfigured species must render exactly as before this layer existed) and the
 * delta math a saved Pose Editor pivot/scale resolves to.
 */
describe('species-presentation', () => {
  afterEach(() => resetSpeciesPresentation())

  it('an unconfigured species contributes a zero pivot delta and scale 1 (no-op)', () => {
    expect(speciesPivotDelta('never-touched-species')).toEqual({ dx: 0, dy: 0 })
    expect(speciesScale('never-touched-species')).toBe(1)
  })

  it('a species saved at the Pose Editor default pivot still contributes a zero delta', () => {
    setSpeciesPresentation('goblin-shaman', { pivot: { ...DEFAULT_SPECIES_PIVOT } })
    expect(speciesPivotDelta('goblin-shaman')).toEqual({ dx: 0, dy: 0 })
  })

  it('a saved pivot resolves to its delta from the Pose Editor default', () => {
    setSpeciesPresentation('dire-wolf', { pivot: { x: 0.6, y: 0.8 } })
    const delta = speciesPivotDelta('dire-wolf')
    expect(delta.dx).toBeCloseTo(0.6 - DEFAULT_SPECIES_PIVOT.x)
    expect(delta.dy).toBeCloseTo(0.8 - DEFAULT_SPECIES_PIVOT.y)
  })

  it('a saved scale is returned verbatim; an absent one defaults to 1', () => {
    setSpeciesPresentation('small-goblin', { scale: 1.4 })
    expect(speciesScale('small-goblin')).toBe(1.4)
    expect(speciesScale('spider-brute')).toBe(1)
  })

  it('setting only one of pivot/scale leaves the other at its no-op default', () => {
    setSpeciesPresentation('green-slime', { scale: 0.7 })
    expect(speciesScale('green-slime')).toBe(0.7)
    expect(speciesPivotDelta('green-slime')).toEqual({ dx: 0, dy: 0 })
  })

  it('a later call merges onto the same species instead of replacing it', () => {
    setSpeciesPresentation('goblin-taunter', { scale: 1.2 })
    setSpeciesPresentation('goblin-taunter', { pivot: { x: 0.4, y: 0.9 } })
    expect(speciesScale('goblin-taunter')).toBe(1.2)
    expect(speciesPivotDelta('goblin-taunter').dx).toBeCloseTo(0.4 - DEFAULT_SPECIES_PIVOT.x)
  })

  it('malformed pivot/scale values are ignored rather than corrupting state', () => {
    setSpeciesPresentation('toxic-demonic-spider', { pivot: { x: 'nope' } as unknown as { x: number; y: number }, scale: -5 })
    expect(speciesPivotDelta('toxic-demonic-spider')).toEqual({ dx: 0, dy: 0 })
    expect(speciesScale('toxic-demonic-spider')).toBe(1)
  })

  it('setSpeciesPresentation with no species id is a no-op', () => {
    setSpeciesPresentation('', { scale: 2 })
    setSpeciesPresentation(undefined as unknown as string, { scale: 2 })
    expect(speciesScale('')).toBe(1)
  })
})
