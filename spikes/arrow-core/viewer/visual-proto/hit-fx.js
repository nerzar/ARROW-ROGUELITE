// VFX-003: light-hit feel -- pure scheduling/math helpers (no DOM, no engine imports) so
// vitest can pin them and board-renderer.js can consume them directly.
//
// Ports the VFX-001 lab's `light-hit` preset contract (flash/sparks/squash/camera numbers)
// onto the game's own fx pattern: every effect below is scheduled at the same arrival
// timestamp (`now + FLIGHT_MS`, the existing `fx.hitT`), as one more field on the same
// per-target `fx` object -- exactly how `fx.dmgText` (VFX-002) already works. The next lab
// effect (enemy recoil, hit sparks variants, ...) attaches the same way, no new system.
export const LIGHT_HIT = {
  flashDur: 200,
  flashScale: 0.85,
  sparkCount: 14,
  sparkDur: 420,
  sparkSpread: 0.85,
  sqRecoil: 7,
  sqSquash: 0.10,
  sqDur: 260,
  camAmp: 2,
  camDur: 200,
  camFreq: 24,
}

export const clamp01 = (t) => Math.max(0, Math.min(1, t))
export const easeOutCubic = (p) => 1 - (1 - p) ** 3

/** Same LCG the lab and the material pack use: stable per-seed values, so a frozen frame
 * is byte-identical across reloads. */
export function srand(s) {
  let v = (s >>> 0) || 1
  return () => (v = (v * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

/** "Punch" shape: most of the displacement happens fast, then it settles back to 0.
 * 0 at p=0, peak at p=0.3, 0 at p=1. Drives squash/recoil. */
export function punch(p) {
  if (p <= 0 || p >= 1) return 0
  const easeOutQuint = (x) => 1 - (1 - x) ** 5
  return p < 0.3 ? easeOutCubic(p / 0.3) : 1 - easeOutQuint((p - 0.3) / 0.7)
}

/** Short string hash for per-hit spark seeds (djb2, deterministic). */
export function hashStr(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** Precomputed spark particles (lab `FX.sparks` logic, unitless proportions -- the renderer
 * multiplies by its own charCell). Spray cone centers on baseAng (radians, canvas space);
 * the caller passes the back-along-incoming direction so debris flies back at the arrow.
 * Deterministic per seed: same hit replays byte-identical particles every frame. */
export function sparkParts(seed, count, baseAng) {
  const rnd = srand(seed)
  const parts = []
  for (let i = 0; i < count; i++) {
    parts.push({
      ang: baseAng + (rnd() * 2 - 1) * 1.25,
      spd: 0.25 + rnd() * 0.75,
      size: 2 + rnd() * 4.2,
      delay: rnd() * 0.14,
      g: 0.35 + rnd() * 1.15,
      hot: rnd() < 0.3,
    })
  }
  return parts
}

/** Camera impulse: pure function of absolute time (like the lab -- deliberately NOT of any
 * warped/display clock). Decaying oscillation, deterministic per shake list. Each shake:
 * { at, dur, amp, freq }. Returns the canvas-px world offset for `now`. */
export function camOffset(now, shakes) {
  let x = 0
  let y = 0
  for (const s of shakes) {
    const p = (now - s.at) / s.dur
    if (p < 0 || p >= 1) continue
    const amp = s.amp * (1 - p) ** 2
    const ph = ((now - s.at) / 1000) * s.freq * 2 * Math.PI
    x += Math.sin(ph) * amp
    y += Math.cos(ph * 1.37) * amp * 0.7
  }
  return { x, y }
}
