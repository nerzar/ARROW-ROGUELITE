import { describe, expect, it } from 'vitest'
import {
  E,
  type EncounterDef,
  EncounterState,
  N,
} from '../src/index.js'
import { levelXY } from './helpers.js'
import {
  appearEnemyVisual,
  baselinePose,
  ENEMY_HIT_HOLD_MS,
  ENEMY_ATTACK_HOLD_MS,
  onEnemyGameplayEvent,
  readEnemySnapshot,
  tickEnemyVisual,
  type EnemyVisual,
} from '../viewer/visual-proto/enemy-visual-state.js'

/**
 * VIS-006: the per-actor presentation machine driven by the REAL engine (source of truth).
 * Pose decisions go through readEnemySnapshot + the visual reducer. The local `driveTap`
 * router mirrors app.js tap() attribution exactly (defeated > attack > hit, then baseline
 * sync) -- engine rules themselves are covered by the EXP suites; here they are only the
 * event source. Any drift between this mirror and app.js is caught by the browser verify
 * (window.visualDebug.wolf()) in the task card.
 */

// Same 3x3 fixture as multi-enemy.test.ts: arrow1 E (free), arrow2 N (free).
const level = levelXY(3, 3, [
  [[0, 1], [1, 1]],
  [[0, 2], [1, 2]],
  [[2, 1], [2, 0]],
])

const twoEnemyDef = (eHp: number, eInterval: number, nHp: number, nInterval: number): EncounterDef => ({
  id: 'vis006',
  enemies: [
    { id: 'e', side: E, hp: eHp, attackTimer: { interval: eInterval, damage: 1 } },
    { id: 'n', side: N, hp: nHp, attackTimer: { interval: nInterval, damage: 1 } },
  ],
  rotate: { allow: [] },
  blockedTapDamage: 1,
})

const appearAll = (s: EncounterState, now: number): Map<string, EnemyVisual> => {
  const m = new Map<string, EnemyVisual>()
  for (const e of s.enemies) m.set(e.id, appearEnemyVisual(now))
  return m
}

const snapOf = (s: EncounterState, id: string) => readEnemySnapshot(s.enemies.find((e) => e.id === id))!

/** app.js tap() attribution mirror (see module docstring). */
function driveTap(visuals: Map<string, EnemyVisual>, s: EncounterState, r: any, now: number) {
  const attacked = new Set<string>((r.enemyAttacks ?? []).map((a: { id: string }) => a.id))
  for (const e of s.enemies) {
    const snap = readEnemySnapshot(e)!
    const v = visuals.get(e.id)!
    if (e.dead) visuals.set(e.id, onEnemyGameplayEvent(v, 'defeated', now, snap))
    else if (attacked.has(e.id)) visuals.set(e.id, onEnemyGameplayEvent(v, 'attack', now, snap))
    else if (r.hit && e.side === r.arenaDir) visuals.set(e.id, onEnemyGameplayEvent(v, 'hit', now, snap))
  }
  for (const e of s.enemies) {
    if (e.dead) continue
    const snap = readEnemySnapshot(e)!
    let v = tickEnemyVisual(visuals.get(e.id)!, now, snap)
    if (!v.manual && now >= v.holdUntil && v.pose !== baselinePose(snap)) {
      v = onEnemyGameplayEvent(v, 'sync', now, snap)
    }
    visuals.set(e.id, v)
  }
}

const pose = (m: Map<string, EnemyVisual>, id: string) => m.get(id)!.pose

describe('VIS-006 engine mapping: two-enemy independence', () => {
  it('a hit on one wolf never switches the other; telegraph arms per actor', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(3, 3, 3, 3), 10)
    const v = appearAll(s, 0)
    expect(pose(v, 'e')).toBe('idle')
    expect(pose(v, 'n')).toBe('idle')

    // Turn 1: E hit. Both countdowns 3 -> 2.
    const r1 = s.tap(1)
    expect(r1).toMatchObject({ ok: true, hit: true })
    driveTap(v, s, r1, 1000)
    expect(pose(v, 'e')).toBe('hit')
    expect(pose(v, 'n')).toBe('idle') // untouched actor stays put
    v.set('e', tickEnemyVisual(v.get('e')!, 1000 + ENEMY_HIT_HOLD_MS, snapOf(s, 'e')))
    expect(pose(v, 'e')).toBe('idle') // countdown 2: no telegraph yet

    // Turn 2: N hit. Both countdowns 2 -> 1 -> telegraph baseline arms for BOTH actors.
    const r2 = s.tap(2)
    expect(r2).toMatchObject({ ok: true, hit: true })
    driveTap(v, s, r2, 2000)
    expect(pose(v, 'n')).toBe('hit')
    expect(pose(v, 'e')).toBe('attackReady') // expired hold re-synced onto the live baseline
    v.set('n', tickEnemyVisual(v.get('n')!, 2000 + ENEMY_HIT_HOLD_MS, snapOf(s, 'n')))
    expect(pose(v, 'n')).toBe('attackReady')
  })
})

describe('VIS-006 engine mapping: kill and attack', () => {
  it('killing blow -> defeat terminal for that actor only', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(1, 5, 3, 5), 10)
    const v = appearAll(s, 0)
    const r1 = s.tap(1) // E hit kills e (hp 1); the dead enemy never retaliates
    expect(r1).toMatchObject({ ok: true, hit: true })
    driveTap(v, s, r1, 1000)
    expect(pose(v, 'e')).toBe('defeat')
    expect(pose(v, 'n')).toBe('idle')
    // A later turn (N hit) still cannot revive the defeated actor.
    const r2 = s.tap(2)
    expect(r2).toMatchObject({ ok: true, hit: true })
    driveTap(v, s, r2, 2000)
    expect(pose(v, 'e')).toBe('defeat')
    expect(pose(v, 'n')).toBe('hit')
  })

  it('enemy strike -> attack briefly -> live baseline (attackReady on interval 1)', () => {
    const s = EncounterState.fromLevel(level, twoEnemyDef(3, 1, 3, 9), 10)
    const v = appearAll(s, 0)
    // Turn 1: E hit (e 3 -> 2), then e ticks 1 -> 0 and strikes back.
    const r1 = s.tap(1)
    expect(r1).toMatchObject({ ok: true, hit: true })
    if (!r1.ok) throw new Error('tap failed')
    expect(r1.enemyAttacks).toEqual([{ id: 'e', damage: 1 }])
    driveTap(v, s, r1, 1000)
    expect(pose(v, 'e')).toBe('attack') // own strike beats the landed hit
    expect(pose(v, 'n')).toBe('idle') // countdown 8: far from telegraph
    v.set('e', tickEnemyVisual(v.get('e')!, 1000 + ENEMY_ATTACK_HOLD_MS, snapOf(s, 'e')))
    expect(pose(v, 'e')).toBe('attackReady') // interval 1: strikes again next turn
  })
})
