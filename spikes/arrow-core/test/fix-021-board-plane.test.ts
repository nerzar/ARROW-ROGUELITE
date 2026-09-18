import { describe, expect, it } from 'vitest'
import {
  backdropCornersPx,
  cellToScreen,
  computeHomography,
  createBoardPlane,
  fitGrid,
  MARGIN_U,
  MARGIN_V,
  PLANE_CORNERS_FRAC,
  project,
  rotateUV,
  screenToCell,
  unproject,
} from '../viewer/visual-proto/board-plane.js'

/**
 * FIX-021: board-plane projection contract. Pure geometry -- no DOM, no engine. Pins:
 *  - the homography maps the unit square's 4 corners exactly onto the given quad, and
 *    project/unproject are exact inverses (closed-form, not iterative);
 *  - the plane's backdrop footprint (fitGrid's boxSide) is constant regardless of cols/rows or
 *    Rotate -- the "same board plane after re-fit" requirement;
 *  - screenToCell recovers exactly the (col,row) cellToScreen was given, at every quarter-turn,
 *    for both square (primary, square-first policy) and rectangular (compat/regression) boards.
 */

const STAGE_W = 1920
const STAGE_H = 1080

describe('FIX-021 homography: unit square -> quad', () => {
  const corners = { tl: [100, 50] as [number, number], tr: [400, 60] as [number, number], br: [420, 300] as [number, number], bl: [80, 290] as [number, number] }
  const H = computeHomography(corners)

  it('maps the 4 unit-square corners exactly onto the given quad', () => {
    const cases: Array<[number, number, [number, number]]> = [[0, 0, corners.tl], [1, 0, corners.tr], [1, 1, corners.br], [0, 1, corners.bl]]
    for (const [u, v, [ex, ey]] of cases) {
      const p = project(H, u, v)
      expect(p.x).toBeCloseTo(ex, 9)
      expect(p.y).toBeCloseTo(ey, 9)
    }
  })

  it('unproject is the exact inverse of project across the interior and edges', () => {
    for (let v = 0; v <= 1; v += 0.1) {
      for (let u = 0; u <= 1; u += 0.1) {
        const p = project(H, u, v)
        const back = unproject(H, p.x, p.y)
        expect(back.u).toBeCloseTo(u, 9)
        expect(back.v).toBeCloseTo(v, 9)
      }
    }
  })

  it('a pure rectangle (parallelogram case) still round-trips (affine fallback path)', () => {
    const rectCorners = { tl: [0, 0] as [number, number], tr: [200, 0] as [number, number], br: [200, 100] as [number, number], bl: [0, 100] as [number, number] }
    const Hr = computeHomography(rectCorners)
    expect(project(Hr, 0.5, 0.5)).toEqual({ x: 100, y: 50 })
    const back = unproject(Hr, 100, 50)
    expect(back.u).toBeCloseTo(0.5, 9)
    expect(back.v).toBeCloseTo(0.5, 9)
  })
})

describe('FIX-021 rotateUV: puzzle-layer spin around the plane center', () => {
  it('is identity at 0deg', () => {
    expect(rotateUV(0.2, 0.7, 0)).toEqual({ u: 0.2, v: 0.7 })
  })
  it('preserves distance from the plane center (pure rotation, no scale/shear)', () => {
    const p0 = { u: 0.8, v: 0.35 }
    const d0 = Math.hypot(p0.u - 0.5, p0.v - 0.5)
    for (const deg of [30, 90, 137, 270]) {
      const p = rotateUV(p0.u, p0.v, deg)
      expect(Math.hypot(p.u - 0.5, p.v - 0.5)).toBeCloseTo(d0, 9)
    }
  })
  it('two 90deg turns equal one 180deg turn', () => {
    const once = rotateUV(rotateUV(0.9, 0.4, 90).u, rotateUV(0.9, 0.4, 90).v, 90)
    const twice = rotateUV(0.9, 0.4, 180)
    expect(once.u).toBeCloseTo(twice.u, 9)
    expect(once.v).toBeCloseTo(twice.v, 9)
  })
  it('four 90deg turns return to the start', () => {
    let p = { u: 0.15, v: 0.62 }
    for (let i = 0; i < 4; i++) p = rotateUV(p.u, p.v, 90)
    expect(p.u).toBeCloseTo(0.15, 9)
    expect(p.v).toBeCloseTo(0.62, 9)
  })
})

describe('FIX-021 fitGrid: rotation-invariant board-plane footprint', () => {
  it('the backdrop square side is constant regardless of cols/rows (square-first primary sizes)', () => {
    const sides = [6, 7, 8, 9, 10].map((n) => fitGrid(n, n).boxSide)
    for (const s of sides) expect(s).toBeCloseTo(sides[0], 12)
  })
  it('the backdrop square side does not change when cols/rows swap (Rotate compatibility case)', () => {
    const a = fitGrid(6, 7)
    const b = fitGrid(7, 6) // what an engine-side dimension swap on Rotate would look like
    expect(b.boxSide).toBeCloseTo(a.boxSide, 12)
  })
  it('the fitted grid box never exceeds the fixed backdrop square', () => {
    for (const [cols, rows] of [[6, 6], [10, 10], [6, 7], [12, 10], [10, 12], [7, 6]] as const) {
      const fit = fitGrid(cols, rows)
      expect(fit.gridU).toBeLessThanOrEqual(fit.boxSide + 1e-9)
      expect(fit.gridV).toBeLessThanOrEqual(fit.boxSide + 1e-9)
      expect(fit.gridU).toBeGreaterThan(0)
      expect(fit.gridV).toBeGreaterThan(0)
    }
  })
  it('a square board fills the fixed backdrop square edge to edge (no wasted margin)', () => {
    for (const n of [6, 7, 8, 9, 10]) {
      const fit = fitGrid(n, n)
      expect(fit.gridU).toBeCloseTo(fit.boxSide, 12)
      expect(fit.gridV).toBeCloseTo(fit.boxSide, 12)
    }
  })
  it('margins are positive and small (a visible but not excessive stone border)', () => {
    expect(MARGIN_U).toBeGreaterThan(0)
    expect(MARGIN_U).toBeLessThan(0.15)
    expect(MARGIN_V).toBeGreaterThan(0)
    expect(MARGIN_V).toBeLessThan(0.15)
  })
})

describe('FIX-021 plane calibration sanity', () => {
  it('plane corners form a proper (non-self-intersecting, downward) trapezoid inside the stage', () => {
    const { tl, tr, br, bl } = PLANE_CORNERS_FRAC
    for (const [u, v] of [tl, tr, br, bl]) {
      expect(u).toBeGreaterThan(0); expect(u).toBeLessThan(1)
      expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1)
    }
    expect(tl[1]).toBeCloseTo(tr[1], 6) // top edge horizontal
    expect(bl[1]).toBeCloseTo(br[1], 6) // bottom edge horizontal
    expect(tl[1]).toBeLessThan(bl[1]) // top is above bottom
    expect(tr[0] - tl[0]).toBeLessThan(br[0] - bl[0]) // top narrower than bottom (foreshortened)
  })
})

describe('FIX-021 click mapping: screenToCell inverts cellToScreen exactly', () => {
  const plane = createBoardPlane(STAGE_W, STAGE_H)

  it.each([
    ['square 6x6', 6, 6],
    ['square 8x8', 8, 8],
    ['square 10x10', 10, 10],
    ['rectangular 6x7', 6, 7],
    ['rectangular 8x10', 8, 10],
    ['rectangular 12x10', 12, 10],
    ['rectangular 10x12', 10, 12],
  ] as const)('%s: every cell round-trips at every quarter-turn', (_label, cols, rows) => {
    const fit = fitGrid(cols, rows)
    for (const angle of [0, 90, 180, 270]) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = cellToScreen(plane, fit, col, row, angle)
          const back = screenToCell(plane, fit, p.x, p.y, angle)
          expect(back.col).toBe(col)
          expect(back.row).toBe(row)
        }
      }
    }
  })

  it('corners and center of a square board click-map correctly after CW and CCW rotation', () => {
    const fit = fitGrid(8, 8)
    const corners: Array<[number, number]> = [[0, 0], [7, 0], [0, 7], [7, 7], [3, 3], [4, 4]]
    for (const angle of [-270, -90, 0, 90, 180, 270]) {
      for (const [col, row] of corners) {
        const p = cellToScreen(plane, fit, col, row, angle)
        const back = screenToCell(plane, fit, p.x, p.y, angle)
        expect(back.col).toBe(col)
        expect(back.row).toBe(row)
      }
    }
  })

  it('a point outside the board resolves outside the [0,cols)x[0,rows) index range', () => {
    const fit = fitGrid(6, 6)
    const outside = screenToCell(plane, fit, 5, 5, 0) // far corner of the stage, well off the dais
    expect(outside.col < 0 || outside.col >= 6 || outside.row < 0 || outside.row >= 6).toBe(true)
  })
})

describe('FIX-021 backdrop: fixed, non-rotating plate', () => {
  const plane = createBoardPlane(STAGE_W, STAGE_H)

  it('the backdrop quad is identical regardless of the puzzle layer\'s rotation angle', () => {
    // fitGrid/backdropCornersPx never take an angle -- this test pins that contract: whatever
    // angle the content is drawn at, the plate itself is computed the same way every time.
    const fit = fitGrid(6, 7)
    const a = backdropCornersPx(plane, fit)
    const b = backdropCornersPx(plane, fitGrid(7, 6)) // same footprint, dims "swapped"
    for (const k of ['tl', 'tr', 'br', 'bl'] as const) {
      expect(a[k].x).toBeCloseTo(b[k].x, 9)
      expect(a[k].y).toBeCloseTo(b[k].y, 9)
    }
  })

  it('the backdrop is a proper trapezoid matching the plane corners direction', () => {
    const fit = fitGrid(8, 8)
    const b = backdropCornersPx(plane, fit)
    expect(b.tr.x - b.tl.x).toBeLessThan(b.br.x - b.bl.x)
    expect(b.tl.y).toBeLessThan(b.bl.y)
  })
})
