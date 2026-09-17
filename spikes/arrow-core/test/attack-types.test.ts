import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type AttackTimer,
  E,
  type EncounterDef,
  encounterFromJson,
  EncounterState,
  minDamageToWin,
  N,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * EXP-011: `AttackTimer.kind` ('normal' | 'cast') and the cast-interrupt shape
 * (`interruptible` + `interruptedAttack`). Per the brief:
 * - a normal attack is unchanged EXP-010 behaviour: a landed hit deals damage, never touches the timer.
 * - a `kind: 'cast'` attack with `interruptible: true`: a hit landed while it is armed cancels the
 *   cast outright (no damage this cycle) and the attacker's *next* attack becomes `interruptedAttack`
 *   (by convention a normal attack) — a type change, not a numeric timer bonus and not a full reset
 *   back into another cast.
 * - a `kind: 'cast'` attack without `interruptible` behaves exactly like a normal timer that merely
 *   displays as CAST IN N: hits do not touch it.
 *
 * The model lives on the same `AttackTimer` used by both `BossPhase` and `EnemyDef`, so it is
 * reusable by ordinary simultaneous Caster enemies later, not just the mini-boss — tested in both
 * modes below.
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

/** `n` independent, always-free, always-hitting-E arrows: width 2 so a head's "beyond" cell (x=2) is
 * always out of board bounds, and each arrow lives on its own row so none can block another. Lets a
 * single boss/enemy be tapped for hits `n` times in a row without board topology getting in the way. */
const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const bossDef = (attackTimer: AttackTimer, hpUnits = 99): EncounterDef => ({
  id: 't',
  boss: { id: 'b', phases: [{ side: E, hpUnits, attackTimer }] },
  rotate: { allow: [] },
})

describe('normal attack (EXP-011 kind default/explicit)', () => {
  it('is not interrupted by a hit: timer just ticks down, damage lands only at 0', () => {
    const s = EncounterState.fromLevel(eArrows(5), bossDef({ interval: 3, damage: 5, kind: 'normal' }), 10)
    expect(s.attackKind).toBe('normal')
    const r1 = s.tap(0)
    expect(r1).toMatchObject({ ok: true, hit: true, interrupted: false, castInterrupted: false, enemyAttacked: false })
    expect(s.countdownTurns).toBe(2)
    expect(s.attackKind).toBe('normal') // still normal -- a hit never changes attack kind
  })

  it('kind omitted defaults to normal (unchanged EXP-010 behaviour)', () => {
    const s = EncounterState.fromLevel(eArrows(5), bossDef({ interval: 1, damage: 7 }), 10)
    expect(s.attackKind).toBe('normal')
    const r = s.tap(0) // hits, countdown 1 -> 0 -> fires despite the hit
    expect(r).toMatchObject({ ok: true, hit: true, interrupted: false, castInterrupted: false, enemyAttacked: true, enemyDamage: 7, playerHp: 3 })
  })
})

describe('cast attack, interruptible', () => {
  const castDef = (): EncounterDef =>
    bossDef({ interval: 3, damage: 99, kind: 'cast', interruptible: true, interruptedAttack: { interval: 2, damage: 1, kind: 'normal' } })

  it('is interrupted by a hit landed while armed', () => {
    const s = EncounterState.fromLevel(eArrows(5), castDef(), 10)
    expect(s.attackKind).toBe('cast')
    const r = s.tap(0) // hits the boss; boss is casting -> interrupted
    expect(r).toMatchObject({ ok: true, hit: true, interrupted: true, castInterrupted: true })
  })

  it('an interrupted cast deals no damage', () => {
    const s = EncounterState.fromLevel(eArrows(5), castDef(), 10)
    const r = s.tap(0)
    expect(r).toMatchObject({ enemyAttacked: false, enemyDamage: 0, playerHp: 10 })
  })

  it('the interrupt changes the attack type to normal, not just the numbers', () => {
    const s = EncounterState.fromLevel(eArrows(5), castDef(), 10)
    expect(s.attackKind).toBe('cast')
    s.tap(0)
    expect(s.attackKind).toBe('normal')
  })

  it('applies no artificial timer bonus: the post-interrupt countdown is exactly interruptedAttack.interval', () => {
    const s = EncounterState.fromLevel(eArrows(5), castDef(), 10)
    const cdBeforeInterrupt = s.countdownTurns // 3
    s.tap(0) // interrupts on turn 1, well before the cast's own countdown would reach 0
    // Not "cdBeforeInterrupt - 1" (a plain tick) and not "cdBeforeInterrupt + 1" (a bonus) --
    // exactly the configured interruptedAttack.interval, because this is a type switch, not a delta.
    expect(cdBeforeInterrupt).toBe(3)
    expect(s.countdownTurns).toBe(2)
  })

  it('the normal attack after an interrupt then lives by its own ordinary rules (ticks, is not itself interruptible)', () => {
    const s = EncounterState.fromLevel(eArrows(5), castDef(), 10)
    s.tap(0) // interrupt: cast -> normal, countdown = 2
    const r1 = s.tap(1) // hit; normal attack does not interrupt
    expect(r1).toMatchObject({ interrupted: false, castInterrupted: false, enemyAttacked: false })
    expect(s.countdownTurns).toBe(1)
    const r2 = s.tap(2) // countdown 1 -> 0 -> fires
    expect(r2).toMatchObject({ enemyAttacked: true, enemyDamage: 1, playerHp: 9 })
    expect(s.attackKind).toBe('normal') // stays normal -- no reverting to cast
  })
})

describe('cast attack, not interruptible', () => {
  it('ignores hits entirely for timer/state purposes -- ticks and fires like a plain timer', () => {
    const def = bossDef({ interval: 1, damage: 5, kind: 'cast' }) // interruptible omitted -> false
    const s = EncounterState.fromLevel(eArrows(5), def, 10)
    expect(s.attackKind).toBe('cast')
    const r = s.tap(0) // hits; countdown 1 -> 0 -> fires anyway, no interrupt available
    expect(r).toMatchObject({ ok: true, hit: true, interrupted: false, castInterrupted: false, enemyAttacked: true, enemyDamage: 5, playerHp: 5 })
    expect(s.attackKind).toBe('cast') // never switched -- there was nothing to switch to
  })
})

describe('enemies mode: the same AttackTimer shape works for a Caster-style simultaneous enemy', () => {
  const casterDef = (): EncounterDef => ({
    id: 'caster',
    enemies: [
      {
        id: 'caster',
        side: E,
        hp: 99,
        attackTimer: { interval: 3, damage: 99, kind: 'cast', interruptible: true, interruptedAttack: { interval: 2, damage: 1, kind: 'normal' } },
      },
    ],
    rotate: { allow: [] },
  })

  it('a hit during the cast interrupts it: no damage, attack type flips to normal', () => {
    const s = EncounterState.fromLevel(eArrows(5), casterDef(), 10)
    expect(s.enemies[0].attackKind).toBe('cast')
    const r = s.tap(0)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.castInterrupted).toBe(true)
      expect(r.enemyAttacked).toBe(false)
      expect(r.enemyDamage).toBe(0)
    }
    expect(s.enemies[0].attackKind).toBe('normal')
    expect(s.enemies[0].countdown).toBe(2)
  })

  it('multi-enemy normal timers are unaffected by EXP-011: default kind stays normal, hits never interrupt', () => {
    const def: EncounterDef = {
      id: 'two',
      enemies: [
        { id: 'e', side: E, hp: 99, attackTimer: { interval: 2, damage: 3 } },
        { id: 'n', side: N, hp: 99, attackTimer: { interval: 2, damage: 4 } },
      ],
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(eArrows(5), def, 10)
    expect(s.enemies.map((e) => e.attackKind)).toEqual(['normal', 'normal'])
    const r = s.tap(0) // hits e; both timers tick 2 -> 1 regardless
    expect(r.ok).toBe(true)
    expect(s.enemies.map((e) => e.countdown)).toEqual([1, 1])
  })
})

describe('mini-boss phase 2 (seed 1571): cast-interrupt removes the EXP-010b 1-damage floor', () => {
  it('minDamageToWin proves a 0-damage winning path exists', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e5.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 1_000_000 })
    expect(md).toMatchObject({ win: true, proven: true, minDamage: 0 })
  })

  it('phase 2 starts in CAST mode and switches to normal on the interrupting hit', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e5.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 1_000_000 })
    const s = EncounterState.fromLevel(lvl, enc.encounter, 10)
    let sawCast = false
    let sawCastInterrupted = false
    for (const a of md.sequence) {
      if (a.kind === 'tap') {
        if (s.phaseIndex === 1 && s.attackKind === 'cast') sawCast = true
        const r = s.tap(a.id)
        if (r.ok && r.castInterrupted) sawCastInterrupted = true
      } else {
        s.rotate(a.turn)
      }
    }
    expect(sawCast).toBe(true)
    expect(sawCastInterrupted).toBe(true)
    expect(s.won).toBe(true)
    expect(s.playerHp).toBe(10)
  })
})

describe('prologue encounters 1-5: minDamageToWin at full (10) entry HP, all zero after EXP-011', () => {
  it('E1-E5 all have a proven 0-damage path', () => {
    for (const name of ['cp-e1.json', 'cp-e2.json', 'cp-e3.json', 'cp-e4.json', 'cp-e5.json']) {
      const { file: enc, level: lvl } = encounterFromJson(load(name))
      const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
      const md = minDamageToWin(start, { nodeBudget: 1_000_000 })
      expect(md, name).toMatchObject({ win: true, proven: true, minDamage: 0 })
    }
  })
})
