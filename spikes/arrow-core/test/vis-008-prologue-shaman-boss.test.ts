import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AttackTimer,
  E,
  type EncounterDef,
  encounterFromJson,
  EncounterState,
  N,
} from '../src/index.js'
import {
  appearEnemyVisual,
  baselinePose as enemyBaseline,
  onEnemyGameplayEvent,
  readEnemySnapshot,
} from '../viewer/visual-proto/enemy-visual-state.js'
import {
  appearBossVisual,
  baselinePose,
  onBossGameplayEvent,
  readBossSnapshot,
  STUNNED_HOLD_MS,
  TAUNT_HOLD_MS,
  tickBossVisual,
} from '../viewer/visual-proto/boss-visual-state.js'
import {
  BOSS_MANIFEST,
  BOSS_MANIFESTS,
  BOSS_PACK_BASE,
  bossSpeciesFor,
  resolveBossImage,
  SHAMAN_MANIFEST,
  SHAMAN_PACK_BASE,
} from '../viewer/visual-proto/assets.js'
import { levelXY } from './helpers.js'

/**
 * VIS-008: the user reassigned boss roles -- Goblin Shaman is now the PROLOGUE boss (cp-e5's
 * `miniboss_placeholder`), Goblin Taunter/King is reserved for the Act I boss. boss-visual-
 * state.js (VIS-005) is completely unchanged: it never knew any species, only pose names/timing
 * driven by the real engine. What VIS-008 adds is a species->pack lookup in assets.js
 * (`bossSpeciesFor`/`BOSS_MANIFESTS`) and app.js wiring that picks the pack per scene. These
 * tests cover that lookup plus the pose-mapping contract, driven by a REAL EncounterState boss
 * (docs/COMBAT-RULES.md 5/8 mechanics unchanged, same shape as the shipped cp-e5.json).
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

const VIEWER_DIR = new URL('../viewer/visual-proto/', import.meta.url)
const assetOnDisk = (relPath: string) => existsSync(new URL(relPath, VIEWER_DIR))

describe('VIS-008 asset contract: species resolution', () => {
  it('the real cp-e5.json prologue boss resolves the Shaman pack', () => {
    const { file } = encounterFromJson(load('cp-e5.json'))
    expect(file.encounter.boss!.id).toBe('miniboss_placeholder')
    expect(bossSpeciesFor(file.encounter.boss!.id)).toBe('goblin-shaman')
  })

  it('an unknown/future boss id defaults to Shaman (todays only boss scene)', () => {
    expect(bossSpeciesFor('some-future-boss')).toBe('goblin-shaman')
    expect(bossSpeciesFor(undefined)).toBe('goblin-shaman')
  })

  it('Goblin Taunter/King pack remains available separately, not deleted', () => {
    expect(BOSS_MANIFESTS['goblin-taunter']).toBe(BOSS_MANIFEST)
    expect(BOSS_MANIFESTS['goblin-shaman']).toBe(SHAMAN_MANIFEST)
    // Distinct, non-overlapping base paths -- a species swap can never accidentally draw the
    // other pack's file.
    expect(BOSS_PACK_BASE).toBe('assets/bosses/goblin-taunter/')
    expect(SHAMAN_PACK_BASE).toBe('assets/bosses/goblin-shaman/')
    for (const path of Object.values(BOSS_MANIFEST)) expect(path.startsWith(BOSS_PACK_BASE)).toBe(true)
    for (const path of Object.values(SHAMAN_MANIFEST)) expect(path.startsWith(SHAMAN_PACK_BASE)).toBe(true)
  })

  it('every Shaman pose file exists on disk at its normalized runtime path', () => {
    for (const [pose, path] of Object.entries(SHAMAN_MANIFEST)) {
      expect(assetOnDisk(path), `missing ${pose} at ${path}`).toBe(true)
    }
    // Runtime-normalized name, per the task: source "stunned - hit.png" -> stunned-hit.png.
    expect(SHAMAN_MANIFEST.stunned.endsWith('/stunned-hit.png')).toBe(true)
  })

  it('every Taunter pose file still exists on disk -- reassignment did not delete Act I assets', () => {
    for (const [pose, path] of Object.entries(BOSS_MANIFEST)) {
      expect(assetOnDisk(path), `missing ${pose} at ${path}`).toBe(true)
    }
  })

  it('missing-pose fallback stays within the SAME pack (Shaman never falls back to Taunter)', () => {
    const shamanLikePack = { idle: 'shaman-idle', cast: 'shaman-cast' } // no 'stunned'
    const taunterLikePack = { idle: 'taunter-idle', stunned: 'taunter-stunned' }
    expect(resolveBossImage(shamanLikePack as any, 'stunned') as any).toBe('shaman-idle')
    expect(resolveBossImage(taunterLikePack as any, 'stunned') as any).toBe('taunter-stunned')
    expect(resolveBossImage(shamanLikePack as any, 'stunned') as any).not.toBe('taunter-idle')
  })
})

// Same phase/attackTimer numbers as the shipped encounters/cp-e5.json (phase 1: E, interval 6
// dmg 1 normal; phase 2: N, interval 3 dmg 1 interruptible cast -> interval 4 dmg 1 normal), on a
// small always-free fixture board so the mapping is deterministic without hand-solving the real
// medium/seed-1571 layout (board generation itself is covered by prologue.test.ts).
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const normal = (interval: number, damage: number): AttackTimer => ({ interval, damage, kind: 'normal' })
const cast = (interval: number, damage: number): AttackTimer => ({
  interval, damage, kind: 'cast', interruptible: true,
  interruptedAttack: { interval: 4, damage: 1, kind: 'normal' },
})

const prologueBossDef = (): EncounterDef => ({
  id: 'cp_e5',
  boss: {
    id: 'miniboss_placeholder', // real cp-e5 id -- resolves the Shaman pack via bossSpeciesFor
    phases: [
      { side: E, hpUnits: 1, attackTimer: normal(6, 1), label: 'familiar side' },
      { side: E, hpUnits: 99, attackTimer: cast(3, 1), label: 'direction becomes a resource' },
    ],
  },
  rotate: { allow: [] },
})

describe('VIS-008 engine mapping: real EncounterState, prologue boss (Goblin Shaman)', () => {
  it('appear -> taunt -> idle (species-agnostic; same contract as VIS-005)', () => {
    const def = prologueBossDef()
    expect(bossSpeciesFor(def.boss!.id)).toBe('goblin-shaman')
    const s = EncounterState.fromLevel(eArrows(9), def, 10)
    const snap = () => readBossSnapshot(s, def)!

    let v = appearBossVisual(0)
    expect(v.pose).toBe('taunt')
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())
    expect(v.pose).toBe('idle')
  })

  it('phase 2 opens an armed CAST telegraph', () => {
    const def = prologueBossDef()
    const s = EncounterState.fromLevel(eArrows(9), def, 10)
    const snap = () => readBossSnapshot(s, def)!
    let v = appearBossVisual(0)
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())

    const r1 = s.tap(0) // kills 1hp phase 1 -> phase 2 starts
    expect(r1).toMatchObject({ ok: true, hit: true })
    expect(s.phaseIndex).toBe(1)
    expect(snap().casting).toBe(true)
    v = onBossGameplayEvent(v, 'phase', 3000, snap())
    expect(v.pose).toBe('cast')
  })

  it('a hit while the cast is armed interrupts it -> stunned, NOT the same "hit" pose treatment silently reused for a cast', () => {
    const def = prologueBossDef()
    const s = EncounterState.fromLevel(eArrows(9), def, 10)
    const snap = () => readBossSnapshot(s, def)!
    let v = appearBossVisual(0)
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())
    s.tap(0) // -> phase 2, cast armed
    v = onBossGameplayEvent(v, 'phase', 3000, snap())
    expect(v.pose).toBe('cast')

    const r2 = s.tap(1)
    expect(r2).toMatchObject({ ok: true, hit: true, castInterrupted: true })
    expect(r2.ok && r2.enemyAttacked).toBe(false) // cast damage never fired -- this IS the point
    v = onBossGameplayEvent(v, 'interrupted', 4000, snap())
    expect(v.pose).toBe('stunned')
  })

  it('after the interrupt holds off, baseline is angry -- NOT cast again (attack switched to normal)', () => {
    const def = prologueBossDef()
    const s = EncounterState.fromLevel(eArrows(9), def, 10)
    const snap = () => readBossSnapshot(s, def)!
    let v = appearBossVisual(0)
    v = tickBossVisual(v, TAUNT_HOLD_MS, snap())
    s.tap(0) // -> phase 2, cast armed
    v = onBossGameplayEvent(v, 'phase', 3000, snap())
    s.tap(1) // interrupt
    expect(snap().casting).toBe(false) // interruptedAttack.kind === 'normal'
    v = onBossGameplayEvent(v, 'interrupted', 4000, snap())
    expect(v.pose).toBe('stunned')

    v = tickBossVisual(v, 4000 + STUNNED_HOLD_MS, snap())
    expect(v.pose).toBe('angry') // phase-2 baseline, not a re-armed cast
    expect(baselinePose(snap())).toBe('angry')
  })

  it('boss defeated -> defeat, terminal', () => {
    const def: EncounterDef = {
      id: 'cp_e5',
      boss: { id: 'miniboss_placeholder', phases: [{ side: E, hpUnits: 1, attackTimer: normal(6, 1) }] },
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(eArrows(2), def, 10)
    const snap = () => readBossSnapshot(s, def)!
    let v = appearBossVisual(0)
    const r = s.tap(0)
    expect(r).toMatchObject({ ok: true, won: true })
    v = onBossGameplayEvent(v, 'won', 1000, snap())
    expect(v.pose).toBe('defeat')
    expect(tickBossVisual(v, 1000 + 60_000, snap()).pose).toBe('defeat')
  })
})

describe('VIS-008 parallel-safety: Dire Wolf (VIS-006) presentation is unaffected', () => {
  it('ordinary-enemy mapping still works untouched after the boss asset-contract change', () => {
    const twoEnemyDef: EncounterDef = {
      id: 'vis008-wolf-smoke',
      enemies: [
        { id: 'w1', side: E, hp: 2, attackTimer: { interval: 3, damage: 1 } },
        { id: 'w2', side: N, hp: 2, attackTimer: { interval: 3, damage: 1 } },
      ],
      rotate: { allow: [] },
    }
    const level = levelXY(3, 3, [[[0, 1], [1, 1]], [[0, 2], [1, 2]], [[2, 1], [2, 0]]])
    const s = EncounterState.fromLevel(level, twoEnemyDef, 10)
    const visuals = new Map(s.enemies.map((e) => [e.id, appearEnemyVisual(0)]))
    for (const e of s.enemies) expect(enemyBaseline(readEnemySnapshot(e))).toBe('idle')

    const r1 = s.tap(1) // hits w1 (side E)
    expect(r1).toMatchObject({ ok: true, hit: true })
    const w1After = s.enemies.find((e) => e.id === 'w1')!
    const v1 = onEnemyGameplayEvent(visuals.get('w1')!, 'hit', 1000, readEnemySnapshot(w1After))
    expect(v1.pose).toBe('hit')
    const w2After = s.enemies.find((e) => e.id === 'w2')!
    expect(enemyBaseline(readEnemySnapshot(w2After))).toBe('idle') // untouched actor
  })
})
