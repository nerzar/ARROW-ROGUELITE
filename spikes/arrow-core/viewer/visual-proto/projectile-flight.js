// BUILD-035: Projectile Flight v1 -- pure trajectory math (no DOM, no engine imports) so
// vitest can pin it and board-renderer.js can consume it directly.
//
// A freed arrow keeps flying as a real projectile: it first continues along its exit
// direction, then smoothly steers into its target's current hit-anchor. Presentation only --
// target selection, damage and combat state are untouched (the engine already resolved the
// hit; this only plays back *how* the arrow gets there).
//
// Shape (time-param t in [0,1]):
//   phase A [0, STRAIGHT_FRAC]: straight line along the exit unit dir (the honest exit read);
//   phase B [STRAIGHT_FRAC, 1]: quadratic bezier from the junction point to the target,
//     eased with smootherstep. The bezier control sits on the exit ray, so position AND
//     heading are continuous at the junction -- no visible kink.
// A miss (target null) flies the same straight phase A line to its full length and fades.
//
// Extension point for Ricochet/Pierce/Serpent (NOT implemented here): flightPoint already
// takes a resolved {from, dir, target, straightLen} spec -- a future form can chain several
// specs (leg per target) without changing this module's contract.
export const FLIGHT_MS = 520
export const STRAIGHT_FRAC = 0.35

const clamp01 = (t) => Math.max(0, Math.min(1, t))
const smootherstep = (t) => {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y }
}

function len(v) {
  return Math.hypot(v.x, v.y)
}

/** Straight-phase length for a hit leg: a fixed share of the remaining distance, clamped
 * so close targets still read an exit beat and far targets don't overshoot the junction. */
export function straightLen(from, target) {
  const d = len(sub(target, from))
  return Math.min(200, Math.max(30, d * 0.3))
}

function quadBezier(p0, p1, p2, u) {
  const a = (1 - u) * (1 - u)
  const b = 2 * (1 - u) * u
  const c = u * u
  return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y }
}

/**
 * Projectile pose at time t. spec: { from: {x,y} (exit cell center, canvas px),
 * dir: {x,y} (exit unit vector, canvas px), target: {x,y} | null (hit-anchor, canvas px),
 * straightLen: number (px) }. Returns { x, y, angle } with angle = canvas heading (radians,
 * for ctx.rotate -- the arrow figure is drawn pointing +x).
 */
export function flightPoint(t, spec) {
  const { from, dir, target } = spec
  const L = spec.straightLen > 0 ? spec.straightLen : 1
  const tt = clamp01(t)
  const heading = Math.atan2(dir.y, dir.x)
  if (!target || tt <= STRAIGHT_FRAC) {
    const d = target ? L * (tt / STRAIGHT_FRAC) : L * tt
    return { x: from.x + dir.x * d, y: from.y + dir.y * d, angle: heading }
  }
  const J = { x: from.x + dir.x * L, y: from.y + dir.y * L }
  const jt = len(sub(target, J))
  const C = { x: J.x + dir.x * Math.max(1, jt * 0.5), y: J.y + dir.y * Math.max(1, jt * 0.5) }
  const u = smootherstep((tt - STRAIGHT_FRAC) / (1 - STRAIGHT_FRAC))
  const p = quadBezier(J, C, target, u)
  // Numeric tangent for the heading (exact at the ends, smooth everywhere in between).
  const e = 0.004
  const pa = quadBezier(J, C, target, smootherstep(Math.max(0, (tt - e - STRAIGHT_FRAC) / (1 - STRAIGHT_FRAC))))
  const pb = quadBezier(J, C, target, smootherstep(Math.min(1, (tt + e - STRAIGHT_FRAC) / (1 - STRAIGHT_FRAC))))
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  return { x: p.x, y: p.y, angle: dx === 0 && dy === 0 ? heading : Math.atan2(dy, dx) }
}
