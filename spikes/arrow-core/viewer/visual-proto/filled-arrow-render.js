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

import { DEFAULTS as GEOM_DEFAULTS, buildFilledArrow } from './filled-arrow-geom.js'
import { findMaterial } from './filled-arrow-materials.js'
import { project, rotateUV } from './board-plane.js'

/** Geometry knobs, in cell units. Re-exported straight from filled-arrow-geom.js rather than
 * re-typed here: a second literal silently dropped `tipReach` when FIX-032 added it, which put the
 * old overhanging tip back. One source of truth. */
export const ARROW_SHAPE = { ...GEOM_DEFAULTS }

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

/** One arrow -> one closed screen-space Path2D (shaft + rounded bends + head as a single shape),
 * through an arbitrary board-space -> screen projection.
 *
 * FIX-032: the projection is injected rather than assumed, so the playable runtime and the
 * material gallery share this one builder instead of keeping two drifting copies. The game passes
 * its calibrated plane (buildArrowPath below); the gallery passes its own preview homography.
 * `toScreen` takes a board-space [x, y] in cell units and returns {x, y} in canvas px. */
export function buildArrowPathWith(arrow, toScreen, DX, DY, cols, shape = ARROW_SHAPE) {
  const geom = buildFilledArrow(arrow.cells, arrow.dir, cols, shape, DX, DY)
  for (const n of geom.outline) delete n.skipped // per-frame flag from the tip handler
  const { path, bbox } = pathFromOutline(geom.outline, toScreen)
  return { path, bbox, tip: toScreen(geom.tip), neck: toScreen(geom.neck) }
}

/** The playable runtime's projection: the game's own calibrated plane + current Rotate angle. */
export function buildArrowPath(arrow, { plane, fit, cols }, angleDeg, DX, DY, shape = ARROW_SHAPE) {
  return buildArrowPathWith(
    arrow,
    (p) => cellPointToScreen(plane, fit, p[0], p[1], angleDeg),
    DX, DY, cols, shape,
  )
}

/**
 * FIX-032: hover used to snap on and off — a hard ring appeared the instant the pointer crossed
 * an arrow and vanished the instant it left, which read as harsh against the soft arena art. This
 * keeps a 0..1 level per arrow so the highlight can fade in and out instead. Purely presentational:
 * the pointer still resolves to an arrow through screenToCell/ownerAt, unchanged.
 */
export function createHoverFade({ inMs = 150, outMs = 230 } = {}) {
  const levels = new Map() // arrow id -> 0..1
  let current = -1
  let last = -1
  return {
    set(id) { current = id },
    /** Advance every level toward its target. Returns true while anything is still moving, so
     * the caller can keep its rAF alive for the length of the fade. */
    tick(now) {
      const dt = last < 0 ? 16 : Math.min(64, now - last)
      last = now
      if (current !== -1 && !levels.has(current)) levels.set(current, 0)
      let moving = false
      for (const [id, v] of [...levels]) {
        const target = id === current ? 1 : 0
        const next = target === 1
          ? Math.min(1, v + dt / inMs)
          : Math.max(0, v - dt / outMs)
        if (next !== v) moving = true
        if (next === 0 && target === 0) levels.delete(id)
        else levels.set(id, next)
      }
      return moving
    },
    amount(id) { return levels.get(id) ?? 0 },
  }
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
  const { col, materialId, localScale, now, seed, free, pinned, aims, isBlocked, isBlocker, isHint, isDenied } = opts
  // FIX-032: 0..1 instead of a boolean -- see createHoverFade.
  const hover = Math.max(0, Math.min(1, opts.hover ?? (opts.isHover ? 1 : 0)))

  ctx.save()

  // 1-3. Body.
  //
  // FIX-032: the material paints itself and nothing is layered on top of it. BUILD-034 used to
  // wrap every material in a contrast underlay (a second dark rim outside the one warm-bevel
  // already draws) and wash blocked arrows with a source-atop black fill. Side by side with the
  // gallery that read as a different, thinner, duller arrow -- and the gallery is the reference
  // the user picked from. So: same painter, same input, same result on both pages.
  //
  // `free`/`pinned` still change the picture, they just do it the way the demo did:
  //   pinned -> rock body, material suppressed (a pinned arrow must read as stone: tapping it
  //             does nothing, and a bright material would hide the one state that matters)
  //   !free  -> the whole figure at 0.45 alpha, exactly the demo's blocked treatment
  // The dark contrast rim survives only on the no-material fallback path below, where nothing
  // else would separate the arrow from the stone.
  const material = pinned ? null : findMaterial(materialId)

  if (pinned) {
    ctx.globalAlpha = 0.9
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = col.rockGlow
    ctx.fillStyle = col.rock
    ctx.fill(path)
    ctx.restore()
  } else if (material) {
    ctx.globalAlpha = free ? 1 : 0.45
    ctx.save()
    material.paint(ctx, path, bbox, { cell: localScale }, now, seed)
    ctx.restore()
  } else {
    // Fallback: no material selected/known -- keep the readable plain body plus its dark rim.
    ctx.globalAlpha = free ? 1 : 0.75
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.globalAlpha = free ? 0.6 : 0.45
    ctx.strokeStyle = col.arrowOutline
    ctx.lineWidth = Math.max(3, localScale * 0.14)
    ctx.stroke(path)
    ctx.restore()
    ctx.save()
    ctx.shadowBlur = free ? (aims ? 16 : 9) : (aims ? 7 : 4)
    ctx.shadowColor = aims ? col.aimGlow : free ? col.freeGlow : col.mutedGlow
    ctx.fillStyle = aims ? col.aim : free ? col.arrow : col.arrowDim
    ctx.fill(path)
    ctx.restore()
  }
  ctx.globalAlpha = 1

  // 4. Hover -- a soft halo that fades in/out, not a hard ring snapping on. Drawn before the
  // hard state rings below so blocked/hint always win visually.
  if (hover > 0.001) {
    const e = hover * hover * (3 - 2 * hover) // smoothstep
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.34 * e
    ctx.shadowBlur = Math.max(6, localScale * 0.5) * e
    ctx.shadowColor = col.hoverGlow ?? 'rgba(255,240,205,0.9)'
    ctx.strokeStyle = col.hoverGlow ?? 'rgba(255,240,205,0.9)'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, localScale * 0.09)
    ctx.stroke(path)
    ctx.restore()
    // Gentle inner lift so the hovered arrow reads as "raised", not just outlined.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.12 * e
    ctx.fillStyle = '#ffffff'
    ctx.fill(path)
    ctx.restore()
  }

  // 5. Hard state rings -- these are information, not decoration, so they stay crisp.
  if (isBlocked || isBlocker || isHint || isDenied) {
    ctx.save()
    ctx.strokeStyle = isBlocked ? '#e53935'
      : isBlocker ? '#fb8c00'
        : isDenied ? col.rock
          : '#43a047'
    ctx.globalAlpha = 0.7
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
