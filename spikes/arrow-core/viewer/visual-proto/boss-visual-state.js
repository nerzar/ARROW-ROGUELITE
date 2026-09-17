// VIS-005: Goblin Taunter presentation state machine. Pure module (no DOM, no engine
// imports) so vitest can cover it and the canvas renderer can consume it directly.
//
// This is PRESENTATION state -- gameplay (EncounterState/RunState) stays the source of
// truth. The engine snapshot goes in, a pose name comes out. Animation timing here never
// touches simulation/game timers; holds are wall-clock presentation windows only.
//
// Poses: idle | taunt | cast | stunned | angry | defeat. `back` is an auxiliary pose
// (debug/manual only), never a gameplay baseline.
export const BOSS_POSES = ['idle', 'taunt', 'cast', 'stunned', 'angry', 'defeat', 'back']

// Presentation-only hold windows (ms). Short on purpose: they must read as a beat, not a state.
export const TAUNT_HOLD_MS = 1400
export const STUNNED_HOLD_MS = 650

// Anchor/scale model: every pose PNG is drawn "contain"-fitted into the same boss panel
// footprint, bottom-center aligned. anchorX/anchorY are fractions of the DRAWN image box;
// the ground point (panel bottom-center) never moves between poses, so a pose swap with a
// different aspect ratio (angry 1305x1206, defeat 1536x1024 vs the 1086x1448 portrait
// poses) cannot jump across the screen or change visual size. Per-pose offsets are panel-
// height fractions, applied after anchoring; all zero until a real misalignment is seen.
export const BOSS_ANCHOR = {
  anchorX: 0.5,
  anchorY: 1.0,
  scale: 1.0,
  offsets: {
    idle: { dx: 0, dy: 0 },
    taunt: { dx: 0, dy: 0 },
    cast: { dx: 0, dy: 0 },
    stunned: { dx: 0, dy: 0 },
    angry: { dx: 0, dy: 0 },
    defeat: { dx: 0, dy: 0 },
    back: { dx: 0, dy: 0 },
  },
}

/** Minimal engine snapshot the presentation needs. `casting` reads the LIVE attack kind
 * from state (an interrupt switches it to normal mid-phase), falling back to the static
 * def phase only when the state carries no kind. */
export function readBossSnapshot(s, def) {
  if (!s || !def || def.enemies) return null // enemies-mode: no boss presentation
  const phase = def.boss.phases[Math.min(s.phaseIndex, def.boss.phases.length - 1)]
  const kind = s.attackKind ?? phase?.attackTimer?.kind
  return {
    won: !!s.won,
    phaseIndex: s.phaseIndex,
    casting: !s.won && kind === 'cast' && Number.isFinite(s.countdownTurns),
  }
}

/** Baseline pose for a snapshot: defeat is terminal; an armed cast beats angry/idle. */
export function baselinePose(snap) {
  if (!snap || snap.won) return 'defeat'
  if (snap.casting) return 'cast'
  return snap.phaseIndex >= 1 ? 'angry' : 'idle'
}

export function createBossVisual() {
  return { pose: 'idle', startedAt: 0, holdUntil: 0, manual: false }
}

/** Encounter appearance: brief taunt, then the baseline. */
export function appearBossVisual(now) {
  return { pose: 'taunt', startedAt: now, holdUntil: now + TAUNT_HOLD_MS, manual: false }
}

/** Manual/debug override: sticks until the next gameplay event or manual change. */
export function manualBossPose(v, pose, now) {
  if (!BOSS_POSES.includes(pose)) return v
  return { pose, startedAt: now, holdUntil: Number.POSITIVE_INFINITY, manual: true }
}

/**
 * Gameplay events -> presentation. Any real gameplay event clears a manual override.
 * evt: 'hit' | 'interrupted' | 'phase' | 'castStart' | 'won'
 */
export function onBossGameplayEvent(v, evt, now, snap) {
  const base = baselinePose(snap)
  switch (evt) {
    case 'won':
      return { pose: 'defeat', startedAt: now, holdUntil: Number.POSITIVE_INFINITY, manual: false }
    case 'hit':
    case 'interrupted':
      if (base === 'defeat') return { pose: 'defeat', startedAt: v.startedAt, holdUntil: Number.POSITIVE_INFINITY, manual: false }
      return { pose: 'stunned', startedAt: now, holdUntil: now + STUNNED_HOLD_MS, manual: false }
    case 'phase':
    case 'castStart':
      return { pose: base, startedAt: now, holdUntil: 0, manual: false }
    default:
      return v
  }
}

/** Per-frame expiry: timed holds fall back to the live baseline; defeat/manual stick. */
export function tickBossVisual(v, now, snap) {
  if (v.manual) {
    // A manual pose still must not outlive the encounter end: defeat wins over debug.
    if (snap?.won && v.pose !== 'defeat') {
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
