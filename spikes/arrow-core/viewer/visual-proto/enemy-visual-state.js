// VIS-006: Dire Wolf (ordinary enemy) presentation state machine. Pure module (no DOM,
// no engine imports) so vitest can cover it and the canvas renderer can consume it directly.
//
// This is PRESENTATION state -- gameplay (EncounterState) stays the source of truth. The
// engine snapshot goes in, a pose name comes out. Holds are wall-clock presentation windows
// only and never touch simulation/game timers.
//
// Deliberately NOT a copy of the boss-specific machine (boss-visual-state.js): an ordinary
// enemy has no phases, no cast telegraph, no taunt -- just idle / attackReady / attack /
// hit / defeat. One visual state object PER ACTOR (see app.js: a Map enemyId -> visual), so
// a hit on one wolf never switches the other. The only shared convention with the boss is
// the bottom-center ground anchor model (ENEMY_ANCHOR).
//
// Poses: idle | attackReady | attack | hit | defeat.
export const ENEMY_POSES = ['idle', 'attackReady', 'attack', 'hit', 'defeat']

// Presentation-only hold windows (ms). Short on purpose: they must read as a beat, not a state.
export const ENEMY_ATTACK_HOLD_MS = 450
export const ENEMY_HIT_HOLD_MS = 500

// Attack telegraph threshold: a finite countdown this close to 0 reads as "about to strike".
export const ATTACK_READY_IN = 1

// Anchor/scale model: every pose PNG is drawn "contain"-fitted into the same enemy panel
// footprint, bottom-center aligned. anchorX/anchorY are fractions of the DRAWN image box;
// the ground point (panel bottom-center) never moves between poses, so a pose swap with a
// different aspect ratio cannot jump across the screen or change visual size. Per-pose
// offsets are panel-height fractions, applied after anchoring.
//
// PLAYTEST-002: these were all zero, which plants the ground shadow at the image's own bottom
// bounding-box edge -- correct only if the visible art reaches that edge with no transparent
// padding underneath. It doesn't: the Dire Wolf source PNGs (assets/enemies/dire-wolf/*.png) all
// have real transparent margin below the visible paws, so the wolf read as floating above its own
// shadow (reported in playtest). Values below are measured directly from each pose's own PNG
// (scan for the lowest non-transparent pixel row, as a fraction of image height) and shift the
// drawn image down by exactly that much so the visible feet -- not the image's bounding box --
// land on the ground point. This is a base/asset-level correction (same for every arena); a
// per-arena calibration can still layer a further dx/dy on top via `spritePivot` if one arena's
// own anchor placement needs additional tuning (see arena-calibration.js and board-renderer.js's
// drawWolfArt, which adds the two together).
export const ENEMY_ANCHOR = {
  anchorX: 0.5,
  anchorY: 1.0,
  scale: 1.0,
  offsets: {
    idle: { dx: 0, dy: 0.107 },
    attackReady: { dx: 0, dy: 0.123 },
    attack: { dx: 0, dy: 0.080 },
    hit: { dx: 0, dy: 0.051 },
    defeat: { dx: 0, dy: 0.243 },
  },
}

/** Minimal per-enemy engine snapshot the presentation needs. `enemy` is one entry of
 * `EncounterState.enemies` (already carries dead/countdown/attackKind). */
export function readEnemySnapshot(enemy) {
  if (!enemy) return null
  return {
    dead: !!enemy.dead,
    countdown: enemy.countdown,
    attackKind: enemy.attackKind,
  }
}

/** Baseline pose for a snapshot: defeat is terminal; a countdown near 0 telegraphs. */
export function baselinePose(snap) {
  if (!snap || snap.dead) return 'defeat'
  if (Number.isFinite(snap.countdown) && snap.countdown <= ATTACK_READY_IN) return 'attackReady'
  return 'idle'
}

export function createEnemyVisual() {
  return { pose: 'idle', startedAt: 0, holdUntil: 0, manual: false }
}

/** Ordinary enemy appearance: straight to idle (no boss taunt). */
export function appearEnemyVisual(now) {
  return { pose: 'idle', startedAt: now, holdUntil: 0, manual: false }
}

/** Manual/debug override: sticks until the next gameplay event or manual change. */
export function manualEnemyPose(v, pose, now) {
  if (!ENEMY_POSES.includes(pose)) return v
  return { pose, startedAt: now, holdUntil: Number.POSITIVE_INFINITY, manual: true }
}

/**
 * Gameplay events -> presentation. Any real gameplay event clears a manual override.
 * evt: 'hit' | 'attack' | 'defeated' | 'sync'
 */
export function onEnemyGameplayEvent(v, evt, now, snap) {
  const base = baselinePose(snap)
  switch (evt) {
    case 'defeated':
      return { pose: 'defeat', startedAt: now, holdUntil: Number.POSITIVE_INFINITY, manual: false }
    case 'hit':
      if (base === 'defeat') return { pose: 'defeat', startedAt: v.startedAt, holdUntil: Number.POSITIVE_INFINITY, manual: false }
      return { pose: 'hit', startedAt: now, holdUntil: now + ENEMY_HIT_HOLD_MS, manual: false }
    case 'attack':
      if (base === 'defeat') return { pose: 'defeat', startedAt: v.startedAt, holdUntil: Number.POSITIVE_INFINITY, manual: false }
      return { pose: 'attack', startedAt: now, holdUntil: now + ENEMY_ATTACK_HOLD_MS, manual: false }
    case 'sync':
      return { pose: base, startedAt: now, holdUntil: 0, manual: false }
    default:
      return v
  }
}

/** Per-frame expiry: timed holds fall back to the live baseline; defeat/manual stick. */
export function tickEnemyVisual(v, now, snap) {
  if (v.manual) {
    // A manual pose still must not outlive its actor: defeat wins over debug.
    if (snap?.dead && v.pose !== 'defeat') {
      return { pose: 'defeat', startedAt: now, holdUntil: Number.POSITIVE_INFINITY, manual: false }
    }
    return v
  }
  if (v.holdUntil === Number.POSITIVE_INFINITY) return v // defeat terminal
  if (now < v.holdUntil) return v
  const base = baselinePose(snap)
  if (v.pose === base) return v
  return { pose: base, startedAt: now, holdUntil: 0, manual: false }
}
