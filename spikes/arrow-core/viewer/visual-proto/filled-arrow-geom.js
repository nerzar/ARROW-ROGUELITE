// BUILD-032: pure board-space geometry + homography. No DOM — unit-testable in node.
// Board-space units are cells, origin = board top-left.

// FIX-032: `tipReach` and `headLen` are now two independent numbers.
// They used to be the same 0.62: the tip was hardcoded at 0.62 cells forward of the last cell's
// CENTRE and the neck was walked back by `headLen`, which put the neck exactly on that centre. A
// cell half-width is 0.5, so the tip stuck out 0.12 cells past the board edge on an outer row.
// Shrinking the reach alone used to shorten the head by the same amount, i.e. change the accepted
// BUILD-032/033 silhouette. Now `tipReach` (how far forward the point sits) and `headLen` (how
// long the head is) move separately: at 0.50/0.62 the tip lands exactly on the board edge while
// the head keeps its full 0.62 length, with the neck sitting 0.12 cells behind the cell centre.
export const DEFAULTS = {
  shaftFull: 0.35,
  bend: 0.30,
  bendStyle: 'arc',
  tipReach: 0.50,
  tailExtend: 0,
  headLen: 0.62,
  headHalf: 0.42,
}

export function cellCenter(c, w) {
  const x = c % w
  return [x + 0.5, ((c - x) / w) + 0.5]
}

/** Cut corners of a centerline; returns dense sampled points. */
export function roundCenterline(pts, bend, style) {
  if (pts.length < 3 || bend <= 0.001) return pts.slice()
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const d1 = norm(sub(p, pts[i - 1]))
    const d2 = norm(sub(pts[i + 1], p))
    const l1 = dist(p, pts[i - 1])
    const l2 = dist(pts[i + 1], p)
    const r = Math.min(bend, l1 / 2, l2 / 2)
    const a = add(p, scale(d1, -r))
    const b = add(p, scale(d2, r))
    out.push(a)
    if (style === 'arc') {
      for (let k = 1; k <= 8; k++) {
        const t = k / 8
        out.push(lerp(lerp(a, p, t), lerp(p, b, t), t))
      }
    } else {
      out.push(b) // chamfer: straight cut
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Single closed outline (shaft + bends + head) in cell units. */
export function buildFilledArrow(cells, dir, w, o, DX, DY) {
  const hw = o.shaftFull / 2
  const centers = cells.map((c) => cellCenter(c, w))
  const dv = [DX[dir], DY[dir]]
  const perp = [-dv[1], dv[0]]
  const head = centers[centers.length - 1]
  const tip = add(head, scale(dv, o.tipReach ?? 0.62))
  const neck = add(tip, scale(dv, -o.headLen))
  // FIX-032b: `tailExtend` pushes the very start of the shaft further back along its own
  // direction, in cell units. The tip inset alone just made the whole arrow shorter; extending the
  // tail by a comparable amount keeps its mass while the point stops short of the grid line.
  const spinePts = [...centers.slice(0, -1), neck]
  const tailExtend = o.tailExtend ?? 0
  if (tailExtend > 0) {
    if (spinePts.length >= 2) {
      const t0 = norm(sub(spinePts[1], spinePts[0]))
      spinePts[0] = add(spinePts[0], scale(t0, -tailExtend))
    } else {
      // Single-cell arrow: the spine is just the neck, so give it a stub of shaft to sit on.
      spinePts.unshift(add(spinePts[0], scale(dv, -tailExtend)))
    }
  }
  const spine = roundCenterline(spinePts, o.bend, o.bendStyle)
  const left = []
  const right = []
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i]
    const pPrev = spine[Math.max(0, i - 1)]
    const pNext = spine[Math.min(spine.length - 1, i + 1)]
    const t = norm(sub(pNext, pPrev))
    const n = [-t[1], t[0]]
    left.push(add(p, scale(n, hw)))
    right.push(add(p, scale(n, -hw)))
  }
  const neckL = add(neck, scale(perp, o.headHalf))
  const neckR = add(neck, scale(perp, -o.headHalf))
  const tail = spine[0]
  const t0 = norm(sub(spine[1] ?? add(tail, [1, 0]), tail))
  const tn = [-t0[1], t0[0]]
  const outline = []
  outline.push({ p: add(tail, scale(t0, -hw * 0.9)), cap: true })
  outline.push({ p: add(tail, scale(tn, hw)), ctrl: add(tail, add(scale(t0, -hw * 1.1), scale(tn, hw))) })
  for (const p of left) outline.push({ p })
  outline.push({ p: neckL })
  outline.push({ p: tip, ctrlTip: true })
  outline.push({ p: neckR })
  for (let i = right.length - 1; i >= 0; i--) outline.push({ p: right[i] })
  outline.push({ p: add(tail, scale(tn, -hw)), ctrl: add(tail, add(scale(t0, -hw * 1.1), scale(tn, -hw))) })
  return { outline, tip, tail, neck, neckL, neckR }
}

/** Solve a 3x3 homography from 4 point correspondences (h33 = 1). */
export function solveHomography(src, dst) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  const h = solve8(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

function solve8(A, b) {
  const n = 8
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / d
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => r[n] / (M[i][i] || 1e-12))
}

export function applyH(H, p) {
  const w = H[6] * p[0] + H[7] * p[1] + H[8]
  return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w]
}

export function invertH(H) {
  const [a, b, c, d, e, f, g, h, i] = H
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g
  const det = a * A + b * B + c * C || 1e-12
  return [
    A / det, (c * h - b * i) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, (c * d - a * f) / det,
    C / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ]
}

/** Signed polygon area of an outline (for sanity checks). */
export function outlineArea(outline) {
  let s = 0
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i].p
    const [x1, y1] = outline[(i + 1) % outline.length].p
    s += x0 * y1 - x1 * y0
  }
  return Math.abs(s) / 2
}

export function add(a, b) { return [a[0] + b[0], a[1] + b[1]] }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1]] }
export function scale(a, s) { return [a[0] * s, a[1] * s] }
export function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }
export function norm(a) { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l] }
export function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }
