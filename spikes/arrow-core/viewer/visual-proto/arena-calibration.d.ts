// FIX-023: types for the plain-JS viewer module ./arena-calibration.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface FracPt { x: number; y: number }
export interface FracCorners { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] }

export interface ActorScale { top: number; left: number; right: number }
export interface SpritePivotOffset { dx: number; dy: number }
export interface SpritePivot { top: SpritePivotOffset; left: SpritePivotOffset; right: SpritePivotOffset }

export interface ArenaCalibration {
  id: string
  background: string
  boardSizeLocked: number
  boardPlaneFrac: FracCorners
  anchors: { top: FracPt; left: FracPt; right: FracPt }
  /** CAL-001: independent VFX/telegraph ground anchor, same shape as `anchors`. */
  effectAnchors: { top: FracPt; left: FracPt; right: FracPt }
  /** CAL-002: presentation-only scale per actor, independent from board size and grid size. */
  actorScale?: ActorScale
  /** Optional override for stage-relative base cell fraction (defaults to 47.2 / 540). */
  actorBaseCellFrac?: number
  /** PLAYTEST-002: per-side sprite pivot/foot-offset correction (fractions of the character's own
   * footprint box), independent of `anchors`/`actorScale`. Defaults to {dx:0, dy:0} per side. */
  spritePivot?: SpritePivot
}

export declare const ARENA_CALIBRATIONS: Record<string, ArenaCalibration>
export declare function getArenaCalibration(id: string): ArenaCalibration | null
export declare function saveArenaCalibrationOverride(id: string, calibration: unknown): boolean
export declare function clearArenaCalibrationOverride(id: string): boolean
export declare function hasArenaCalibrationOverride(id: string): boolean
export declare function resolveArenaPresentation(presentation: { arena?: string; calibration?: string | ArenaCalibration | object } | null | undefined): ArenaCalibration | null

