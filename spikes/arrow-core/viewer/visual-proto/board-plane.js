// FIX-021: small board-plane projection layer. The stone dais painted in the arena background
// is a trapezoid (foreshortened: narrower at the top/far edge, wider at the bottom/near edge),
// not an axis-aligned rectangle -- drawing the puzzle board as a plain upright rect on top of it
// is what made it read as a "floating card" instead of part of the masonry. This module owns the
// mapping between the logical rectangular board (rows/cols, gameplay space) and that trapezoid:
//
//   project(H, u, v)   logical/normalized board point (0..1, 0..1) -> screen px
//   unproject(H, x, y) screen px (pointer) -> logical/normalized board point
//
// The trapezoid is fixed in screen space (4 corner points, calibrated once against the actual
// background art -- see PLANE_CORNERS_FRAC below) and NEVER rotates. Rotate only turns the
// logical content (grid dots, arrows) by spinning its normalized (u,v) point around the plane's
// own center (0.5, 0.5) before projecting -- see rotateUV. That keeps "the stone plate doesn't
// spin, only the puzzle layer does, and it always re-fits into the same plane" true by
// construction: the plane's homography and its backdrop footprint are rotation-independent, only
// the per-point (u,v) fed into project() changes.
//
// project()/unproject() implement a full projective (homography) mapping of the unit square onto
// an arbitrary quadrilateral -- the standard closed-form 4-point mapping (Heckbert, "Fundamentals
// of Texture Mapping and Image Warping", 1989, ss. 4), not a cheaper bilinear approximation: for a
// trapezoid with parallel top/bottom edges (this one) it makes every axis-aligned grid line and
// arrow segment project as a straight line, so canvas can draw them with plain moveTo/lineTo.
// unproject() solves the same mapping for (u,v) given (x,y) -- a 2x2 linear solve, no iteration.

// FIX-021 USER ADDENDUM: square-first content policy. Target board sizes are square (6x6..10x10);
// rectangular boards remain a supported compatibility case, not the tuned default. The corners
// below and MARGIN_U/MARGIN_V were calibrated by eye against arena-moonlit-fortress.png (the only
// arena background currently wired in) so a square grid fills the dais with a uniform stone
// margin; rectangular grids inset further on two sides of the same fixed footprint (see fitGrid).
export const PLANE_CORNERS_FRAC = {
  tl: [0.412, 0.460],
  tr: [0.585, 0.460],
  br: [0.745, 0.885],
  bl: [0.250, 0.885],
}

// Normalized-space inset between the outer stone quad and the board's own footprint square (see
// fitGrid) -- a small uniform margin so the puzzle content never touches the carved edge.
export const MARGIN_U = 0.05
export const MARGIN_V = 0.045

/** Unit-square (0,0)-(1,0)-(1,1)-(0,1) -> quadrilateral (tl,tr,br,bl) homography, closed form. */
export function computeHomography(corners) {
  const [x0, y0] = corners.tl
  const [x1, y1] = corners.tr
  const [x2, y2] = corners.br
  const [x3, y3] = corners.bl
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  let a, b, c, d, e, f, g, h
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // Degenerate to affine (parallelogram) -- exact, no perspective term.
    a = x1 - x0; b = x2 - x1; c = x0
    d = y1 - y0; e = y2 - y1; f = y0
    g = 0; h = 0
  } else {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    h = (dx1 * dy3 - dx3 * dy1) / det
    a = x1 - x0 + g * x1
    b = x3 - x0 + h * x3
    c = x0
    d = y1 - y0 + g * y1
    e = y3 - y0 + h * y3
    f = y0
  }
  return { a, b, c, d, e, f, g, h }
}

/** Logical/normalized board point -> screen px. */
export function project(H, u, v) {
  const denom = H.g * u + H.h * v + 1
  return { x: (H.a * u + H.b * v + H.c) / denom, y: (H.d * u + H.e * v + H.f) / denom }
}

/** Screen px (pointer) -> logical/normalized board point. Inverse of project(). */
export function unproject(H, x, y) {
  const A11 = H.a - H.g * x, A12 = H.b - H.h * x, B1 = x - H.c
  const A21 = H.d - H.g * y, A22 = H.e - H.h * y, B2 = y - H.f
  const det = A11 * A22 - A12 * A21
  if (Math.abs(det) < 1e-12) return { u: 0, v: 0 }
  return { u: (B1 * A22 - A12 * B2) / det, v: (A11 * B2 - B1 * A21) / det }
}

/** Rotate a normalized point by a multiple of 90 degrees around the plane's own center (0.5,
 * 0.5) -- this is the ONLY place Rotate's visual spin happens; the plane/homography itself is
 * never touched. angleDeg > 0 matches the existing CW-positive convention (board-renderer.js). */
export function rotateUV(u, v, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const du = u - 0.5, dv = v - 0.5
  return { u: 0.5 + du * cos - dv * sin, v: 0.5 + du * sin + dv * cos }
}

/**
 * Fit a cols x rows logical grid into a fixed, rotation-invariant square footprint inside the
 * plane's normalized space. The footprint square's side is constant (doesn't depend on cols/rows
 * or on Rotate) so the backdrop never changes shape/size -- only `cell`/`gridU`/`gridV` (the
 * content's own bounding box within that fixed square) depend on the current orientation's
 * cols/rows. Mirrors the legacy pixel-space `cell = fitHeight / max(w,h)` sizing, just in
 * normalized units.
 */
export function fitGrid(cols, rows) {
  const availU = 1 - 2 * MARGIN_U
  const availV = 1 - 2 * MARGIN_V
  const boxSide = Math.min(availU, availV)
  const span = Math.max(cols, rows)
  const cell = boxSide / span
  const gridU = cols * cell
  const gridV = rows * cell
  return {
    cell, gridU, gridV, boxSide,
    u0: 0.5 - gridU / 2, v0: 0.5 - gridV / 2,
    boxU0: 0.5 - boxSide / 2, boxV0: 0.5 - boxSide / 2,
  }
}

/** Plane corners in screen px for the given stage size. */
export function planeCornersPx(stageW, stageH) {
  const px = ([u, v]) => [u * stageW, v * stageH]
  return {
    tl: px(PLANE_CORNERS_FRAC.tl), tr: px(PLANE_CORNERS_FRAC.tr),
    br: px(PLANE_CORNERS_FRAC.br), bl: px(PLANE_CORNERS_FRAC.bl),
  }
}

/** Convenience bundle: homography + corners for the current stage size. */
export function createBoardPlane(stageW, stageH) {
  const corners = planeCornersPx(stageW, stageH)
  return { corners, H: computeHomography(corners) }
}

/** Logical cell (col,row) center, in the given rotation, projected to screen px. */
export function cellToScreen(plane, fit, col, row, angleDeg) {
  const lu = fit.u0 + (col + 0.5) * fit.cell
  const lv = fit.v0 + (row + 0.5) * fit.cell
  const { u, v } = rotateUV(lu, lv, angleDeg)
  return project(plane.H, u, v)
}

/** Screen px (pointer) -> logical (col,row), inverse of cellToScreen. */
export function screenToCell(plane, fit, x, y, angleDeg) {
  const { u, v } = unproject(plane.H, x, y)
  const { u: lu, v: lv } = rotateUV(u, v, -angleDeg)
  return { col: Math.floor((lu - fit.u0) / fit.cell), row: Math.floor((lv - fit.v0) / fit.cell) }
}

/** The plane's fixed (never-rotating) backdrop quad corners, in screen px. */
export function backdropCornersPx(plane, fit) {
  const c = (u, v) => project(plane.H, u, v)
  const u0 = fit.boxU0, v0 = fit.boxV0, u1 = u0 + fit.boxSide, v1 = v0 + fit.boxSide
  return { tl: c(u0, v0), tr: c(u1, v0), br: c(u1, v1), bl: c(u0, v1) }
}
