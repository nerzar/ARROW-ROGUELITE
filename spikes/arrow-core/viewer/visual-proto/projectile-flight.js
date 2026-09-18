// BUILD-035: Projectile Flight v1 -- pure trajectory math (no DOM, no engine imports) so
// vitest can pin it and board-renderer.js can consume it directly.
//
// A freed arrow keeps flying as a real projectile: it first continues along its exit
// direction, then smoothly steers into its target's current hit-anchor. Presentation only --
// target selection, damage and combat state are untouched (the engine already resolved the
// hit; this only plays back *how* the arrow gets there).
//
// Shape (time-param t in [0,1]):
//   phase A [0, STRAIGHT_FRAC]: accelerating burst along the exit unit dir (power curve --
//     the sharp jerk right after launch, speed ramps up instead of cruising);
//   phase B [STRAIGHT_FRAC, 1]: quadratic bezier from the junction point to the target,
//     eased fast-start/soft-arrival (no mid-leg stall, gentle settle into the hit). The
//     bezier control sits on the exit ray, so position AND heading stay continuous at the
//     junction -- no visible kink.
// A miss (target null) flies the same accelerating straight line to its full length and fades.
//
// Extension point for Ricochet/Pierce/Serpent (NOT implemented here): flightPoint already
// takes a resolved {from, dir, target, straightLen} spec -- a future form can chain several
// specs (leg per target) without changing this module's contract.
export const FLIGHT_MS = 520
export const STRAIGHT_FRAC = 0.35
// Acceleration feel: phase A distance grows as t^LAUNCH_POWER (sharp jerk, ramps up);
// phase B eases fast-start/soft-arrival so the leg never stalls mid-way and settles into
// the hit. Miss legs use the same launch power.
const LAUNCH_POWER = 2.2
const MISS_POWER = 1.6

const clamp01 = (t) => Math.max(0, Math.min(1, t))
// Fast start, soft arrival: slope 2 at s=0 (no mid-leg stall after the accelerating
// phase A), slope 0 at s=1 (gentle settle into the hit-anchor).
const fastStart = (s) => 1 - (1 - clamp01(s)) * (1 - clamp01(s))

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
 * straightLen: number (px), arc?: number (px, default 0 -- raised lob bulge of phase B) }.
 * Returns { x, y, angle, speed } with angle = canvas heading
 * (radians, for ctx.rotate -- the arrow figure is drawn pointing +x) and speed in canvas
 * px per millisecond (for speed-based squash/stretch -- the renderer thins and elongates
 * the figure with speed and relaxes it into the hit).
 */
export function flightPoint(t, spec) {
  const { from, dir, target, arc } = spec
  const bulge = typeof arc === 'number' && Number.isFinite(arc) && arc > 0 ? arc : 0
  const L = spec.straightLen > 0 ? spec.straightLen : 1
  const tt = clamp01(t)
  const heading = Math.atan2(dir.y, dir.x)
  // Leg model, shared by the pose and its numeric tangent/speed below.
  const posAt = (q) => {
    if (!target) {
      const d = L * Math.pow(q, MISS_POWER)
      return { x: from.x + dir.x * d, y: from.y + dir.y * d }
    }
    if (q <= STRAIGHT_FRAC) {
      const d = L * Math.pow(q / STRAIGHT_FRAC, LAUNCH_POWER)
      return { x: from.x + dir.x * d, y: from.y + dir.y * d }
    }
    const J = { x: from.x + dir.x * L, y: from.y + dir.y * L }
    const jt = len(sub(target, J))
    // The control sits on the exit ray (heading continuity); `arc` lifts it for a lob.
    // The junction itself stays on the ray -- the exit read never bends early.
    const C = { x: J.x + dir.x * Math.max(1, jt * 0.5), y: J.y + dir.y * Math.max(1, jt * 0.5) - bulge }
    return quadBezier(J, C, target, fastStart((q - STRAIGHT_FRAC) / (1 - STRAIGHT_FRAC)))
  }
  const p = posAt(tt)
  // Numeric tangent + speed (exact at the ends, smooth everywhere in between).
  const e = 0.004
  const pa = posAt(Math.max(0, tt - e))
  const pb = posAt(Math.min(1, tt + e))
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const span = (Math.min(1, tt + e) - Math.max(0, tt - e)) || 1
  return {
    x: p.x,
    y: p.y,
    angle: dx === 0 && dy === 0 ? heading : Math.atan2(dy, dx),
    speed: Math.hypot(dx, dy) / span / FLIGHT_MS,
  }
}
