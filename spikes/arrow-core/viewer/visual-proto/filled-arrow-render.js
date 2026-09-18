// BUILD-034: filled-arrow renderer wired into the real game.
//
// What this module is: the bridge between BUILD-032's board-space filled geometry
// (filled-arrow-geom.js, copied verbatim) and this project's ALREADY CALIBRATED board plane
// (board-plane.js). The BUILD-032 demo solved its own throwaway homography from a `tilt` slider;
// the game must not do that -- it has a real per-arena calibration (PLANE_CORNERS_FRAC / a baked
// arena's own quad, plus colFracs/rowFracs), and clicks are hit-tested through exactly that
// mapping (screenToCell -> ownerAt). So here the arrow outline is built in board-space cell units
// and every one of its points is pushed through the SAME project()/rotateUV() path that
// cellToScreen uses. Visual and hitbox therefore cannot drift apart by construction.
//
// Gameplay is untouched: this module reads canExit/isPinned/arenaDir to pick colors and never
// calls anything that mutates state.

import { buildFilledArrow } from './filled-arrow-geom.js'
import { findMaterial } from './filled-arrow-materials.js'
import { project, rotateUV } from './board-plane.js'

/** Geometry knobs, in cell units -- BUILD-032's accepted defaults. */
export const ARROW_SHAPE = {
  shaftFull: 0.35,
  bend: 0.30,
  bendStyle: 'arc',
  headLen: 0.62,
  headHalf: 0.42,
}

/** Interpolate a monotonic 0..1 grid-line table at a continuous cell coordinate.
 * t is in cell units (0 = first grid line, cols = last). Integers reproduce gridLineToScreen and
 * `col + 0.5` reproduces cellToScreen exactly. Linear extrapolation past either end via the
 * boundary segment's width, so an arrowhead tip that pokes outside the board still projects
 * correctly (the head deliberately overhangs the last cell). */
function fracAt(fracs, t) {
  const n = fracs.length - 1
  if (t <= 0) return fracs[0] + t * (fracs[1] - fracs[0])
  if (t >= n) return fracs[n] + (t - n) * (fracs[n] - fracs[n - 1])
  const i = Math.floor(t)
  return fracs[i] + (t - i) * (fracs[i + 1] - fracs[i])
}

/** Continuous board-space point (cell units, origin = board top-left) -> screen px, through the
 * game's own calibrated plane and the current Rotate angle. */
export function cellPointToScreen(plane, fit, x, y, angleDeg) {
  const lu = fit.u0 + fracAt(fit.colFracs, x) * fit.gridU
  const lv = fit.v0 + fracAt(fit.rowFracs, y) * fit.gridV
  const { u, v } = rotateUV(lu, lv, angleDeg)
  return project(plane.H, u, v)
}

/** Project one board-space outline to a screen Path2D, measuring its bbox on the way (Path2D has
 * no bbox API and materials need one for their gradients). Mirrors BUILD-032's pathThroughH,
 * with applyH swapped for the calibrated projection above. */
function pathFromOutline(outline, toScreen) {
  const path = new Path2D()
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const track = (x, y) => {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  outline.forEach((node, i) => {
    if (node.skipped) return // consumed by the rounded-tip handler below
    const { x, y } = toScreen(node.p)
    track(x, y)
    if (i === 0) path.moveTo(x, y)
    else if (node.ctrl) {
      const c = toScreen(node.ctrl)
      track(c.x, c.y)
      path.quadraticCurveTo(c.x, c.y, x, y)
    } else if (node.ctrlTip) {
      // Rounded tip: two quadratics meeting at the tip point.
      const prev = toScreen(outline[i - 1].p)
      const nextNode = outline[i + 1]
      const next = toScreen(nextNode.p)
      path.quadraticCurveTo(prev.x + (x - prev.x) * 0.55, prev.y + (y - prev.y) * 0.55, x, y)
      path.quadraticCurveTo(next.x + (x - next.x) * 0.55, next.y + (y - next.y) * 0.55, next.x, next.y)
      track(next.x, next.y)
      nextNode.skipped = true
    } else path.lineTo(x, y)
  })
  path.closePath()
  return { path, bbox: { x0, y0, x1, y1 } }
}

/** One arrow -> one closed screen-space Path2D (shaft + rounded bends + head as a single shape).
 * `arrow` is a level arrow ({ id, cells, dir }); DX/DY come from the core so direction stays the
 * single source of truth. */
export function buildArrowPath(arrow, { plane, fit, cols }, angleDeg, DX, DY, shape = ARROW_SHAPE) {
  const geom = buildFilledArrow(arrow.cells, arrow.dir, cols, shape, DX, DY)
  for (const n of geom.outline) delete n.skipped // per-frame flag from the tip handler
  const toScreen = (p) => cellPointToScreen(plane, fit, p[0], p[1], angleDeg)
  const { path, bbox } = pathFromOutline(geom.outline, toScreen)
  return { path, bbox, tip: toScreen(geom.tip), neck: toScreen(geom.neck) }
}

/**
 * Paint one arrow. State semantics are carried over 1:1 from the stroke renderer so nothing about
 * readability regresses:
 *   - pinned  -> rock-brown body, material suppressed (a pinned arrow must read as stone, and a
 *                colourful material would hide the one state that makes a tap do nothing)
 *   - !free   -> geometrically blocked: dimmed, never invisible
 *   - aims    -> its arena side still has a live enemy: stronger glow
 *   - hover / blocked / blocker / hint / denied -> the same ring colours as before
 * A dark contrast underlay is stroked under every arrow (PLAYTEST-002: the body has to read
 * against both torch-lit and shadowed stone).
 */
export function paintFilledArrow(ctx, { path, bbox }, opts) {
  const { col, materialId, localScale, now, seed, free, pinned, aims, isHover, isBlocked, isBlocker, isHint, isDenied } = opts

  ctx.save()

  // 1. Contrast underlay -- a dark halo hugging the silhouette.
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.globalAlpha = free ? 0.6 : 0.45
  ctx.strokeStyle = col.arrowOutline
  ctx.lineWidth = Math.max(3, localScale * 0.14)
  ctx.stroke(path)
  ctx.restore()

  // 2. Body.
  ctx.globalAlpha = pinned ? 0.9 : free ? 1 : 0.75
  if (pinned) {
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = col.rockGlow
    ctx.fillStyle = col.rock
    ctx.fill(path)
    ctx.restore()
  } else {
    const material = findMaterial(materialId)
    if (material) {
      ctx.save()
      material.paint(ctx, path, bbox, { cell: localScale }, now, seed)
      ctx.restore()
      if (!free) {
        // Blocked arrows keep the material but sink toward the stone, so "can't fire yet" still
        // reads at a glance without inventing a second palette per material.
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.globalAlpha = 0.45
        ctx.fillStyle = col.arrowOutline
        ctx.fill(path)
        ctx.restore()
      }
    } else {
      ctx.save()
      ctx.shadowBlur = free ? (aims ? 16 : 9) : (aims ? 7 : 4)
      ctx.shadowColor = aims ? col.aimGlow : free ? col.freeGlow : col.mutedGlow
      ctx.fillStyle = aims ? col.aim : free ? col.arrow : col.arrowDim
      ctx.fill(path)
      ctx.restore()
    }
  }

  // 3. Aim glow -- an outer halo on the silhouette for arrows whose side still has a live enemy.
  if (aims && free && !pinned) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.28
    ctx.shadowBlur = Math.max(8, localScale * 0.35)
    ctx.shadowColor = col.aimGlow
    ctx.strokeStyle = col.aimGlow
    ctx.lineWidth = Math.max(1.5, localScale * 0.05)
    ctx.stroke(path)
    ctx.restore()
  }

  // 4. State ring.
  if (isHover || isBlocked || isBlocker || isHint || isDenied) {
    ctx.save()
    ctx.strokeStyle = isBlocked ? '#e53935'
      : isBlocker ? '#fb8c00'
        : isDenied ? col.rock
          : isHint ? '#43a047'
            : col.muted
    ctx.globalAlpha = 0.65
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, localScale * 0.11)
    ctx.stroke(path)
    ctx.restore()
  }

  ctx.restore()
}

/** Does the chosen material animate? Drives the renderer's rAF keep-alive. */
export function materialIsAnimated(materialId) {
  return !!findMaterial(materialId)?.animated
}
