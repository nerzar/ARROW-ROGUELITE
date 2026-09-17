// FIX-021: types for the plain-JS viewer module ./board-plane.js (kept as .js so the browser
// visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export type Px = [number, number]
export interface PlaneCorners { tl: Px; tr: Px; br: Px; bl: Px }
export declare const PLANE_CORNERS_FRAC: PlaneCorners
export declare const MARGIN_U: number
export declare const MARGIN_V: number

export interface Homography { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number }
export declare function computeHomography(corners: PlaneCorners): Homography

export interface Pt { x: number; y: number }
export declare function project(H: Homography, u: number, v: number): Pt

export interface UV { u: number; v: number }
export declare function unproject(H: Homography, x: number, y: number): UV
export declare function rotateUV(u: number, v: number, angleDeg: number): UV

export interface GridFit {
  cell: number; gridU: number; gridV: number; boxSide: number
  u0: number; v0: number; boxU0: number; boxV0: number
  colFracs: number[]; rowFracs: number[]
}
export interface FitGridOpts { marginU?: number; marginV?: number; colFracs?: number[]; rowFracs?: number[] }
export declare function fitGrid(cols: number, rows: number, opts?: FitGridOpts): GridFit

export declare function planeCornersPx(stageW: number, stageH: number, cornersFrac?: PlaneCorners): PlaneCorners

export interface BoardPlane { corners: PlaneCorners; H: Homography }
export declare function createBoardPlane(stageW: number, stageH: number, cornersFrac?: PlaneCorners): BoardPlane

export declare function cellToScreen(plane: BoardPlane, fit: GridFit, col: number, row: number, angleDeg: number): Pt
export declare function gridLineToScreen(plane: BoardPlane, fit: GridFit, col: number, row: number, angleDeg: number): Pt
export declare function screenToCell(plane: BoardPlane, fit: GridFit, x: number, y: number, angleDeg: number): { col: number; row: number }

export interface PlaneCornersPt { tl: Pt; tr: Pt; br: Pt; bl: Pt }
export declare function backdropCornersPx(plane: BoardPlane, fit: GridFit): PlaneCornersPt

export declare function localCellPx(plane: BoardPlane, fit: GridFit, col: number, row: number, angleDeg: number): { u: number; v: number }
