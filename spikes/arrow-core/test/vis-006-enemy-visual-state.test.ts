import { describe, expect, it } from 'vitest'
import {
  appearEnemyVisual,
  ATTACK_READY_IN,
  baselinePose,
  createEnemyVisual,
  ENEMY_ANCHOR,
  ENEMY_ATTACK_HOLD_MS,
  ENEMY_HIT_HOLD_MS,
  ENEMY_POSES,
  manualEnemyPose,
  onEnemyGameplayEvent,
  readEnemySnapshot,
  tickEnemyVisual,
} from '../viewer/visual-proto/enemy-visual-state.js'

/**
 * VIS-006: Dire Wolf (ordinary enemy) presentation state machine. Pure presentation logic --
 * no engine imports, no DOM. Gameplay stays source of truth; these tests pin the pose contract.
 * One visual object PER ACTOR: independence between actors is covered here and in the
 * engine-mapping suite.
 */

const idleSnap = { dead: false, countdown: 3, attackKind: 'normal' as const }
const readySnap = { dead: false, countdown: 1, attackKind: 'normal' as const }
const zeroSnap = { dead: false, countdown: 0, attackKind: 'normal' as const }
const noTimerSnap = { dead: false, countdown: Infinity, attackKind: undefined }
const deadSnap = { dead: true, countdown: 3, attackKind: 'normal' as const }

describe('VIS-006 baseline pose', () => {
  it('idle far from attack, attackReady when the countdown is near 0, defeat when dead', () => {
    expect(baselinePose(idleSnap)).toBe('idle')
    expect(baselinePose(readySnap)).toBe('attackReady')
    expect(baselinePose(zeroSnap)).toBe('attackReady')
    expect(baselinePose(noTimerSnap)).toBe('idle')
    expect(baselinePose(deadSnap)).toBe('defeat')
    expect(baselinePose(null)).toBe('defeat')
  })
  it('telegraph threshold is documented and tight (no early attackReady)', () => {
    expect(ATTACK_READY_IN).toBe(1)
    expect(baselinePose({ dead: false, countdown: 2, attackKind: 'normal' })).toBe('idle')
  })
})

describe('VIS-006 snapshot reading', () => {
  it('reads a live engine enemy entry; null in, null out', () => {
    expect(readEnemySnapshot({ dead: false, countdown: 2, attackKind: 'normal' })).toEqual({
      dead: false, countdown: 2, attackKind: 'normal',
    })
    expect(readEnemySnapshot(null)).toBe(null)
  })
})

describe('VIS-006 appearance', () => {
  it('ordinary enemies appear straight in idle (no boss taunt)', () => {
    const v = appearEnemyVisual(1000)
    expect(v.pose).toBe('idle')
    expect(tickEnemyVisual(v, 1000 + 60_000, idleSnap).pose).toBe('idle')
  })
})

describe('VIS-006 hit', () => {
  it('hit -> hit briefly -> live baseline', () => {
    const v0 = onEnemyGameplayEvent(createEnemyVisual(), 'hit', 500, idleSnap)
    expect(v0.pose).toBe('hit')
    expect(tickEnemyVisual(v0, 500 + ENEMY_HIT_HOLD_MS - 1, idleSnap).pose).toBe('hit')
    expect(tickEnemyVisual(v0, 500 + ENEMY_HIT_HOLD_MS, idleSnap).pose).toBe('idle')
  })
  it('hit while the telegraph is armed returns to attackReady, not idle', () => {
    const v0 = onEnemyGameplayEvent(createEnemyVisual(), 'hit', 500, readySnap)
    expect(tickEnemyVisual(v0, 500 + ENEMY_HIT_HOLD_MS, readySnap).pose).toBe('attackReady')
  })
})

describe('VIS-006 attack', () => {
  it('attack -> attack briefly -> live baseline', () => {
    const v0 = onEnemyGameplayEvent(createEnemyVisual(), 'attack', 700, idleSnap)
    expect(v0.pose).toBe('attack')
    expect(tickEnemyVisual(v0, 700 + ENEMY_ATTACK_HOLD_MS - 1, idleSnap).pose).toBe('attack')
    expect(tickEnemyVisual(v0, 700 + ENEMY_ATTACK_HOLD_MS, idleSnap).pose).toBe('idle')
  })
})

describe('VIS-006 sync', () => {
  it('sync snaps an expired pose onto the live baseline immediately (telegraph arming)', () => {
    const v0 = onEnemyGameplayEvent(createEnemyVisual(), 'sync', 100, readySnap)
    expect(v0.pose).toBe('attackReady')
  })
})

describe('VIS-006 defeat is terminal', () => {
  it('defeated -> defeat and ticks never leave it', () => {
    const v0 = onEnemyGameplayEvent(createEnemyVisual(), 'defeated', 900, deadSnap)
    expect(v0.pose).toBe('defeat')
    expect(tickEnemyVisual(v0, 900 + 60_000, deadSnap).pose).toBe('defeat')
    // Further hits/attacks after death stay defeated.
    expect(onEnemyGameplayEvent(v0, 'hit', 1000, deadSnap).pose).toBe('defeat')
    expect(onEnemyGameplayEvent(v0, 'attack', 1000, deadSnap).pose).toBe('defeat')
  })
  it('manual pose cannot outlive its actor', () => {
    const v0 = manualEnemyPose(createEnemyVisual(), 'idle', 100)
    expect(tickEnemyVisual(v0, 200, deadSnap).pose).toBe('defeat')
  })
})

describe('VIS-006 actors are independent', () => {
  it('an event on one actor leaves the other actor untouched', () => {
    const a = onEnemyGameplayEvent(createEnemyVisual(), 'hit', 500, idleSnap)
    const b = createEnemyVisual()
    expect(a.pose).toBe('hit')
    expect(b.pose).toBe('idle')
    // Ticks advance each actor on its own snapshot.
    expect(tickEnemyVisual(a, 500 + ENEMY_HIT_HOLD_MS, idleSnap).pose).toBe('idle')
    expect(tickEnemyVisual(b, 500 + ENEMY_HIT_HOLD_MS, idleSnap).pose).toBe('idle')
    const dead = onEnemyGameplayEvent(createEnemyVisual(), 'defeated', 900, deadSnap)
    expect(dead.pose).toBe('defeat')
    expect(tickEnemyVisual(b, 900 + 60_000, idleSnap).pose).toBe('idle')
  })
})

describe('VIS-006 manual debug override', () => {
  it('sticks through ticks, cleared by the next gameplay event', () => {
    const v0 = manualEnemyPose(createEnemyVisual(), 'attackReady', 100)
    expect(tickEnemyVisual(v0, 100 + 60_000, idleSnap).pose).toBe('attackReady')
    const v1 = onEnemyGameplayEvent(v0, 'hit', 200, idleSnap)
    expect(v1.pose).toBe('hit')
    expect(v1.manual).toBe(false)
  })
  it('unknown pose is ignored', () => {
    const v0 = createEnemyVisual()
    expect(manualEnemyPose(v0, 'dance', 0)).toBe(v0)
  })
})

describe('VIS-006 anchor metadata', () => {
  // PLAYTEST-002: offsets are no longer all-zero -- see ENEMY_ANCHOR's own comment (Dire Wolf's
  // source PNGs have real transparent padding below the visible paws, which read as the wolf
  // floating above its own ground shadow). Same shape-only contract as VIS-005's version of this
  // test: every pose present, dx always 0, dy always finite and non-negative.
  it('bottom-center ground anchor with a per-pose padding-correction offset', () => {
    expect(ENEMY_ANCHOR.anchorX).toBe(0.5)
    expect(ENEMY_ANCHOR.anchorY).toBe(1.0)
    for (const pose of ENEMY_POSES) {
      const off = ENEMY_ANCHOR.offsets[pose]
      expect(off.dx).toBe(0)
      expect(off.dy).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(off.dy)).toBe(true)
    }
  })
  it('exactly the five ordinary poses, no boss-specific states', () => {
    expect([...ENEMY_POSES]).toEqual(['idle', 'attackReady', 'attack', 'hit', 'defeat'])
  })
})
