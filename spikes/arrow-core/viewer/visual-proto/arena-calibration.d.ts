// FIX-023: types for the plain-JS viewer module ./arena-calibration.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface FracPt { x: number; y: number }
export interface FracCorners { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] }

export interface ArenaCalibration {
  id: string
  background: string
  boardSizeLocked: number
  boardPlaneFrac: FracCorners
  anchors: { top: FracPt; left: FracPt; right: FracPt }
}

export declare const ARENA_CALIBRATIONS: Record<string, ArenaCalibration>
export declare function getArenaCalibration(id: string): ArenaCalibration | null
