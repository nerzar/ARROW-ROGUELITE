// TOOL-002: one default pivot + one default scale per species -- the middle layer between the
// shared per-pose ANCHOR.offsets (enemy-visual-state.js's ENEMY_ANCHOR / boss-visual-state.js's
// BOSS_ANCHOR, both originally measured around a single species) and the per-scene TOP/LEFT/RIGHT
// calibration override (arena-calibration.js's spritePivot/actorScale, applied in
// board-renderer.js). Populated at runtime from the Creature Pose Editor's saved
// creature-poses.json (assets.js's applyPoseOverrides() calls setSpeciesPresentation for every
// species entry it reads) -- a species absent here (fresh checkout, or never touched in the
// editor) renders exactly as it did before this layer existed.
//
// Composition, most specific wins last:
//   ground point = ANCHOR.offsets[pose]  +  speciesPivotDelta(species)  +  scene spritePivot
//   drawn size   = fit(image, footprint) *  speciesScale(species)      (footprint itself already
//                  carries the scene's own actorScale/per-side multiplier -- an independent axis)
// Addition is order-independent, so the scene calibration value a user tunes in the Campaign
// Editor is always the final, undiluted adjustment on top of whatever the species default is.

// Pose Editor's own no-op default pivot (pose-editor.js's DEFAULT_PIVOT) -- kept in sync
// deliberately. A species saved at exactly this value contributes a zero delta.
export const DEFAULT_SPECIES_PIVOT = { x: 0.5, y: 0.92 }

const presentation = {} // species -> { pivot?: {x,y}, scale?: number }

/** Called by assets.js's applyPoseOverrides() for every species in creature-poses.json.
 * Ignores fields that aren't a well-formed pivot/scale rather than clearing a previous value. */
export function setSpeciesPresentation(species, { pivot, scale } = {}) {
  if (!species) return
  const entry = { ...presentation[species] }
  if (pivot && typeof pivot.x === 'number' && typeof pivot.y === 'number') entry.pivot = pivot
  if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) entry.scale = scale
  if (Object.keys(entry).length === 0) return
  presentation[species] = entry
}

/** Ground-point delta (dx,dy -- same footprint-fraction units as ANCHOR.offsets) contributed by
 * this species' saved pivot. No saved pivot, or saved at the Pose Editor's own default -> {0,0}. */
export function speciesPivotDelta(species) {
  const p = presentation[species]?.pivot
  if (!p) return { dx: 0, dy: 0 }
  return { dx: p.x - DEFAULT_SPECIES_PIVOT.x, dy: p.y - DEFAULT_SPECIES_PIVOT.y }
}

/** Drawn-image scale multiplier for this species. No saved scale -> 1 (no-op). */
export function speciesScale(species) {
  const s = presentation[species]?.scale
  return typeof s === 'number' && s > 0 ? s : 1
}

/** Test/debug helper -- clears all runtime-registered species presentation. */
export function resetSpeciesPresentation() {
  for (const k of Object.keys(presentation)) delete presentation[k]
}
