// ARENA-002: types for the plain-JS viewer module ./arena-pack-002.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export declare const ARENA_PACK_002_BASE: string
export interface NormPt { x: number; y: number }
export interface BoardPlane { tl: NormPt; tr: NormPt; br: NormPt; bl: NormPt }
export interface ArenaAnchors { top: NormPt; left: NormPt; right: NormPt }
export interface BakedGrid { cols: number; rows: number }
export interface ArenaPack002Entry {
  id: string
  file: string
  theme: string
  nominalSize: number | null
  bakedGrid: BakedGrid | null
  boardSizeLocked: number | null
  boardSizeFlexible: boolean
  slot: 'prologue' | 'prologue-boss' | 'act1-goblin'
  reuseFrom?: string
  boardPlane: BoardPlane
  anchors: ArenaAnchors
  bossSpace: string
  risks: string
}
export declare const ARENA_PACK_002: ArenaPack002Entry[]
export declare function getArenaPack002(id: string): ArenaPack002Entry | null
