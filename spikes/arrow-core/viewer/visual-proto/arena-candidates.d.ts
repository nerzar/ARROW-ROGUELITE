// ARENA-001: types for the plain-JS viewer module ./arena-candidates.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export declare const ARENA_CANDIDATE_BASE: string
export interface NormPt { x: number; y: number }
export interface BoardPlane { tl: NormPt; tr: NormPt; br: NormPt; bl: NormPt }
export interface ArenaAnchors { top: NormPt; left: NormPt; right: NormPt }
export interface BakedGrid { cols: number; rows: number }
export interface ArenaCandidate {
  id: string
  file: string
  theme: string
  nominalSize: number | null
  bakedGrid: BakedGrid | null
  boardSizeLocked: number | null
  boardSizeFlexible: boolean
  tutorialOnly?: boolean
  boardPlane: BoardPlane
  anchors: ArenaAnchors
  risks: string
}
export declare const ARENA_CANDIDATES: ArenaCandidate[]
export declare function getArenaCandidate(id: string): ArenaCandidate | null
