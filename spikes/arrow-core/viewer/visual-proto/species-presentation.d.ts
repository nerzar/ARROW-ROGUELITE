// TOOL-002: types for the plain-JS viewer module ./species-presentation.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface SpeciesPivot { x: number; y: number }
export declare const DEFAULT_SPECIES_PIVOT: SpeciesPivot
export interface SpeciesXy { x: number; y: number }
export declare function setSpeciesPresentation(
  species: string,
  entry?: { pivot?: SpeciesPivot | null; scale?: number | null; hudOffset?: SpeciesXy | null; hudScale?: number | null; shadowOffset?: SpeciesXy | null },
): void
export interface PivotDelta { dx: number; dy: number }
export declare function speciesPivotDelta(species: string): PivotDelta
export declare function speciesScale(species: string): number
export declare function speciesHudOffset(species: string): SpeciesXy
export declare function speciesHudScale(species: string): number
export declare function speciesShadowOffset(species: string): SpeciesXy
export declare function resetSpeciesPresentation(): void
