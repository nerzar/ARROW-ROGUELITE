// VIS-013: live arrow renderer reference spike — style definitions + pure geometry helpers.
// Pure module (no DOM, no canvas, no engine imports) so vitest can cover it and
// board-renderer.js can consume it directly. Canvas calls stay in board-renderer.js;
// everything here is data + math (colors, radii, tangent points, focus gating, spark timing).
//
// Direction (user-approved): warm fantasy gold/ivory, slightly embossed/inlaid into stone,
// dark keyline for separation, restrained warm glow — never cyberpunk neon. The richer magic
// treatment (halo, moving highlight, sparks, rune accents) runs ONLY on focused arrows
// (hover/hint), never on the whole board.

export const ARROW_STYLES = ['fantasy-flat', 'fantasy-inlaid', 'fantasy-effect']

export const DEFAULT_ARROW_STYLE = 'fantasy-flat'

export function normalizeArrowStyle(v) {
  return ARROW_STYLES.includes(v) ? v : DEFAULT_ARROW_STYLE
}

// Warm metal roles per style. `bevel`/`rune` exist only on inlaid and effect; `halo`,
// `highlight` and `spark` only on effect (flat/inlaid degrade to their static look).
// Every hex here is deliberately warm (red >= green >= blue) — see the test's warm-invariant.
export const ARROW_PALETTES = {
  'fantasy-flat': {
    keyline: '#241a10',
    bodyFree: '#d9a13b',
    bodyAimed: '#eab844',
    bodyBlocked: '#a89a80',
    core: 'rgba(255,242,214,0.55)',
    glowFree: 'rgba(255,176,66,0.22)',
    glowAimed: 'rgba(255,186,70,0.38)',
    bevel: null,
    rune: null,
    halo: null,
    highlight: null,
    spark: null,
  },
  'fantasy-inlaid': {
    keyline: '#20150c',
    bodyFree: '#e2a63e',
    bodyAimed: '#f2bd4e',
    bodyBlocked: '#97866a',
    core: 'rgba(255,236,190,0.7)',
    glowFree: 'rgba(255,178,70,0.26)',
    glowAimed: 'rgba(255,190,80,0.42)',
    bevel: '#7c4f16',
    rune: '#f5c86e',
    halo: null,
    highlight: null,
    spark: null,
  },
  // Same embossed base as inlaid, plus the focused-only magic treatment below.
  'fantasy-effect': {
    keyline: '#20150c',
    bodyFree: '#e2a63e',
    bodyAimed: '#f2bd4e',
    bodyBlocked: '#97866a',
    core: 'rgba(255,236,190,0.7)',
    glowFree: 'rgba(255,178,70,0.26)',
    glowAimed: 'rgba(255,190,80,0.42)',
    bevel: '#7c4f16',
    rune: '#f5c86e',
    halo: 'rgba(255,178,70,0.22)',
    // VIS-014: champagne/gold, not white -- the previous #fff3d0 read as a bright white dashed
    // tube rather than warm magic. This is the intensity=1 ceiling; the live effect-intensity
    // control (see DEFAULT_EFFECT_INTENSITY below) scales actual on-screen alpha well below it.
    highlight: '#f0cd8c',
    spark: '#ffd98a',
  },
}

export function arrowPalette(style) {
  return ARROW_PALETTES[normalizeArrowStyle(style)]
}

// Desired corner-rounding radius as a fraction of shaft width (renderer multiplies by lw).
export const BEND_RADIUS_FAC = 0.9

// Clamp a rounding radius so the arc never eats more than half of either adjacent segment.
// Guards (non-positive radius or segment) collapse to 0 = "no rounding, keep the kink".
export function clampBendRadius(r, lenA, lenB) {
  if (!(r > 0) || !(lenA > 0) || !(lenB > 0)) return 0
  return Math.min(r, lenA / 2, lenB / 2)
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]]
}
function len(v) {
  return Math.hypot(v[0], v[1])
}

// Tangent points where a rounded corner of radius r meets the straight segments around
// vertex p1 (neighbors p0, p2). Returns null when there is nothing to round: zero radius,
// degenerate segments, a (near-)straight run (arcTo would draw a line anyway), or a
// (near-)U-turn (tangent distance collapses to zero). Otherwise { a, b }: a on p0->p1,
// b on p1->p2, and the renderer draws lineTo(a) + quadraticCurveTo(p1, b).
export function cornerTrim(p0, p1, p2, r) {
  const dA = sub(p1, p0)
  const dB = sub(p2, p1)
  const lenA = len(dA)
  const lenB = len(dB)
  if (!(r > 0) || !(lenA > 0) || !(lenB > 0)) return null
  const vA = [dA[0] / lenA, dA[1] / lenA]
  const vB = [dB[0] / lenB, dB[1] / lenB]
  const dot = Math.min(1, Math.max(-1, vA[0] * vB[0] + vA[1] * vB[1]))
  const theta = Math.acos(dot) // 0 = straight, PI = U-turn
  if (theta < 1e-3 || theta > Math.PI - 1e-3) return null
  const t = Math.min(r / Math.tan(theta / 2), lenA / 2, lenB / 2)
  if (!(t > 0)) return null
  return {
    a: [p1[0] - vA[0] * t, p1[1] - vA[1] * t],
    b: [p1[0] + vB[0] * t, p1[1] + vB[1] * t],
  }
}

// Focus language for one arrow (presentation only — gameplay state stays the source of
// truth; the caller feeds it hover/hint/aims/free/pinned/blocked it already computes).
// - 'effect': hover or hint — the ONLY case that may run animated magic (fantasy-effect).
// - 'charged': free and aiming at a live target — stronger gold, always static.
// - 'plain': everything else, including blocked and pinned (quiet; pinned keeps its own
//   distinct rock feedback drawn elsewhere, never magical).
export function arrowFocus({ hover = false, hint = false, aimed = false, free = false, pinned = false, blocked = false } = {}) {
  if (pinned || blocked) return 'plain'
  if (hover || hint) return 'effect'
  if (free && aimed) return 'charged'
  return 'plain'
}

// Deterministic spark slots gliding along the shaft (fraction 0..1 of path length).
// Pure function of wall-clock + arrow id: same inputs always give the same slots
// (no Math.random anywhere — no flicker between frames), different ids phase apart.
export const SPARK_PERIOD_MS = 2600

// VIS-014: live, developer-tunable effect strength (halo/highlight/spark alpha together) for
// fantasy-effect's magic overlay -- see board-renderer.js's `effectIntensity` and app.js's
// query param / debug slider / visualDebug hook. The palette's own alpha (halo/highlight/spark
// above) is the intensity=1 ceiling; this multiplies it down, restrained by default.
export const DEFAULT_EFFECT_INTENSITY = 0.25

export function normalizeEffectIntensity(v) {
  // Unset (missing query param -> null/undefined, or an empty string) must fall back to the
  // default, NOT coerce to 0 -- Number(null) and Number('') are both 0, which is a real,
  // deliberately-chosen "effect off" value elsewhere, so treating "unset" the same way would
  // silently default the live effect to invisible instead of its intended restrained default.
  if (v === null || v === undefined || v === '') return DEFAULT_EFFECT_INTENSITY
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_EFFECT_INTENSITY
}

export function sparkParams(nowMs, arrowId, slotCount = 3) {
  const out = []
  const n = Math.max(1, Math.floor(slotCount))
  for (let k = 0; k < n; k++) {
    const u = (((nowMs / SPARK_PERIOD_MS) + arrowId * 0.61803398875 + k / n) % 1 + 1) % 1
    // Fade in/out at the path ends so sparks never pop at the tail or the head.
    const alpha = Math.sin(u * Math.PI)
    out.push({ u, size: 0.8 + 0.5 * Math.sin((u + k) * Math.PI), alpha: 0.35 + 0.65 * alpha })
  }
  return out
}
