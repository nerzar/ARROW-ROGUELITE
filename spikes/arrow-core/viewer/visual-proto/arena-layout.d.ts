// VIS-007: types for the plain-JS viewer module ./arena-layout.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface CharSize { w: number; h: number }
export declare const BOSS_CHAR: CharSize
export declare const SIDE_CHAR: CharSize
export declare const BOSS_SLOT_DIST: number
export declare const SIDE_SLOT_DIST: number
export declare const HUD_GAP_PX: number
export declare function charSize(isBoss: boolean): CharSize
export declare function slotDist(isBoss: boolean): number
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export declare function slotCenter(boardCx: number, boardCy: number, boardHalfPx: number, side: number, isBoss: boolean, cell: number, DX: readonly number[], DY: readonly number[]): Pt
export interface PodiumGround { x: number; y: number }
export declare const PODIUM_GROUND: Record<number, PodiumGround>
export declare function podiumSlot(side: number, isBoss: boolean, stageW: number, stageH: number, cell: number, groundOverride?: Record<number, PodiumGround>): Pt
export declare const EFFECT_GROUND: Record<number, PodiumGround>
export declare function effectGround(side: number, stageW: number, stageH: number, groundOverride?: Record<number, PodiumGround>): Pt
export declare function charBox(slot: Pt, isBoss: boolean, cell: number): Rect
export declare function groundPoint(char: Rect): Pt
export declare function faceRect(char: Rect): Rect
export declare function spriteMirror(isBoss: boolean, side: number): number
export interface HudInput { slot: Pt; char: Rect; side: number; fontPx: number; lineH: number; lineCount: number; barH: number; maxTextW: number; cell: number; slotAbsX?: number; boardCx?: number; boardHalfPx?: number }
export interface Badge { x: number; y: number; r: number }
export interface HudBoxes { bar: Rect; plate: Rect; badge: Badge; lineY: (i: number) => number }
export declare function hudBoxes(input: HudInput): HudBoxes
export declare function rectsOverlap(a: Rect, b: Rect): boolean
export declare function rotatedBoardBox(cx: number, cy: number, wPx: number, hPx: number, angleDeg: number): Rect
export declare function insideCanvas(pt: Pt, size: number): boolean
