import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  E,
  type EncounterDef,
  encounterFromJson,
  EncounterState,
  findWin,
  minDamageToWin,
  N,
  RunState,
  W,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * EXP-010 combat-pressure engine tests. docs/COMBAT-RULES.md corrections mid-task, honored here:
 * a landed hit only damages the target and never resets/delays the attack timer by default
 * (interrupt is `attackTimer.interruptOnHit`, opt-in, off for every EXP-010 prologue encounter);
 * running out of useful arrows against a live target is not a loss — the only loss is player HP 0,
 * and clearing the board alive is a second, equally valid win.
 */

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

// Same 3x3 fixture as test/encounter.test.ts: arrow0 E (blocked by arrow2), arrow1 E (free), arrow2 N (free).
const level = levelXY(3, 3, [
  [[0, 1], [1, 1]],
  [[0, 2], [1, 2]],
  [[2, 1], [2, 0]],
])

const timedDef = (damage: number, interval = 2, side: number = E): EncounterDef => ({
  id: 't',
  boss: { id: 'b', phases: [{ side: side as 0 | 1 | 2 | 3, hpUnits: 5, attackTimer: { interval, damage } }] },
  rotate: { allow: [] },
  blockedTapDamage: 1,
})

describe('blocked tap', () => {
  it('damages HP and does not advance the turn (attack timer untouched)', () => {
    const s = EncounterState.fromLevel(level, timedDef(3, 2), 10)
    const countdownBefore = s.countdownTurns
    const r = s.tap(0) // arrow0 (E) is blocked by arrow2
    expect(r).toMatchObject({ ok: false, reason: 'blocked', blocker: 2, damage: 1, playerHp: 9, playerDead: false })
    expect(s.countdownTurns).toBe(countdownBefore) // no turn passed
  })
})

describe('turns and the attack timer', () => {
  it('a legal hit still advances the turn (ticks the countdown down)', () => {
    const s = EncounterState.fromLevel(level, timedDef(3, 2), 10) // boss on E, interval 2
    const r = s.tap(1) // E, free, hits
    expect(r).toMatchObject({ ok: true, hit: true })
    expect(s.countdownTurns).toBe(1) // 2 -> 1, not interrupted (no interruptOnHit)
  })

  it('a legal miss also advances the turn', () => {
    const s = EncounterState.fromLevel(level, timedDef(3, 2, W), 10) // boss on W; E arrows miss
    const r = s.tap(1) // E, misses a W-side boss
    expect(r).toMatchObject({ ok: true, hit: false })
    expect(s.countdownTurns).toBe(1)
  })

  it('by default a hit does NOT interrupt/reset the countdown (docs/COMBAT-RULES.md 5)', () => {
    const s = EncounterState.fromLevel(level, timedDef(3, 1), 10) // interval 1: would-be "last turn"
    const r = s.tap(1) // E, hits, countdown 1 -> 0 -> attack fires despite the hit
    expect(r).toMatchObject({ ok: true, hit: true, interrupted: false, enemyAttacked: true, enemyDamage: 3, playerHp: 7 })
  })

  it('opt-in interruptOnHit resets the countdown instead of letting it fire (never used by E1-E5)', () => {
    const def: EncounterDef = {
      id: 't', boss: { id: 'b', phases: [{ side: E, hpUnits: 5, attackTimer: { interval: 1, damage: 100, interruptOnHit: true } }] },
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(level, def, 10)
    const r = s.tap(1) // E, hits; interruptOnHit means this saves the player on the last turn
    expect(r).toMatchObject({ ok: true, hit: true, interrupted: true, enemyAttacked: false, enemyDamage: 0, playerHp: 10 })
  })

  it('enemy attack damages the player and resets the countdown to the full interval', () => {
    const s = EncounterState.fromLevel(level, timedDef(4, 1, W), 10) // boss W, E arrows always miss
    const r = s.tap(1)
    expect(r).toMatchObject({ enemyAttacked: true, enemyDamage: 4, playerHp: 6 })
    expect(s.countdownTurns).toBe(1) // reset to interval, not stuck at/below 0
  })

  it('killing the target the same turn prevents any retaliation, even at countdown 0', () => {
    const def: EncounterDef = {
      id: 't', boss: { id: 'b', phases: [{ side: E, hpUnits: 1, attackTimer: { interval: 1, damage: 999 } }] },
      rotate: { allow: [] },
    }
    const s = EncounterState.fromLevel(level, def, 10)
    const r = s.tap(1) // E, 1 hp -> kill
    expect(r).toMatchObject({ hit: true, won: true, enemyAttacked: false, playerHp: 10 })
  })
})

describe('win/loss conditions (docs/COMBAT-RULES.md 7-8)', () => {
  it('player death is the only loss condition', () => {
    const s = EncounterState.fromLevel(level, timedDef(10, 1, W), 5) // one-shot on first miss
    const r = s.tap(1) // E miss vs W boss -> attack fires for 10, hp 5 -> 0
    expect(r).toMatchObject({ playerHp: 0, playerDead: true, lost: true, won: false })
    expect(s.over).toBe(true)
  })

  it('clearing the board with the target still alive is a win, as long as the player survives', () => {
    // Mild timer: clearing 3 arrows at interval 5 never fires the attack.
    const s = EncounterState.fromLevel(level, timedDef(3, 5, W), 10) // W boss, all arrows point E/N: no hits possible
    for (const id of [1, 2, 0]) expect(s.tap(id).ok).toBe(true) // arrow0 frees only after arrow2
    expect(s.won).toBe(true)
    expect(s.lost).toBe(false)
  })
})

describe('RunState (HP across encounters)', () => {
  const defs: EncounterDef[] = [
    { id: 'a', boss: { id: 'b', phases: [{ side: E, hpUnits: 5, attackTimer: { interval: 2, damage: 3 } }] }, rotate: { allow: [] } },
    { id: 'b', boss: { id: 'b', phases: [{ side: N, hpUnits: 1 }] }, rotate: { allow: [] } },
  ]
  const steps = defs.map((def, i) => ({ id: `s${i}`, level, def }))

  it('HP persists from one encounter into the next', () => {
    const run = new RunState({ playerMaxHp: 10 }, steps)
    expect(run.encounter.playerHp).toBe(10)
    run.encounter.tap(1) // E hit vs E boss (only 2 of 3 arrows are E: 5 hp is never reached), countdown 2 -> 1
    run.encounter.tap(2) // N miss, frees arrow0, countdown 1 -> 0 -> attack for 3 (board not clear yet)
    run.encounter.tap(0) // E hit; board now clear -> won alive; a win ends the encounter, no further attack
    expect(run.encounter.playerHp).toBe(7)
    expect(run.encounter.won).toBe(true)
    const hpBeforeAdvance = run.encounter.playerHp
    expect(run.advance()).toBe(true)
    expect(run.stepIndex).toBe(1)
    expect(run.hpAtEntry).toBe(hpBeforeAdvance)
    expect(run.encounter.playerHp).toBe(hpBeforeAdvance) // carried over, not reset to max
  })

  it('restartStep() restores the HP snapshot the step began with, not full HP', () => {
    const run = new RunState({ playerMaxHp: 10 }, steps)
    run.encounter.tap(1)
    run.encounter.tap(2)
    run.encounter.tap(0) // takes 3 damage, board clears -> won
    run.advance() // now on step 1, entry HP = 7
    run.encounter.tap(1) // E miss vs the step's N boss: legal, mutates state, no HP change
    run.restartStep()
    expect(run.stepIndex).toBe(1)
    expect(run.encounter.playerHp).toBe(7) // back to the step-1 entry snapshot, not 10
  })

  it('restartRun() resets to step 0 with full max HP', () => {
    const run = new RunState({ playerMaxHp: 10 }, steps)
    run.encounter.tap(1)
    run.encounter.tap(2)
    run.encounter.tap(0)
    run.advance()
    run.restartRun()
    expect(run.stepIndex).toBe(0)
    expect(run.encounter.playerHp).toBe(10)
    expect(run.hpAtEntry).toBe(10)
  })
})

describe('EXP-010 prologue encounter files', () => {
  it('cp-e1: passive mob, no HP consequence, a two-move puzzle-then-kill sequence', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e1.json'))
    expect(enc.encounter.blockedTapDamage).toBe(0)
    expect(enc.encounter.boss!.phases[0].attackTimer).toBeUndefined()
    const r = findWin(EncounterState.fromLevel(lvl, enc.encounter))
    expect(r.win).toBe(true)
    expect(r.sequence).toHaveLength(2) // E puzzle-miss, then the N kill
  })

  it('cp-e3: a proven no-damage path exists on the intended kill objective', () => {
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e3.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 500_000 })
    expect(md).toMatchObject({ win: true, proven: true, minDamage: 0 })
  })

  it('cp-e4: EXP-010b redesign (two simultaneous enemies, seed 10) has a proven 0-damage path', () => {
    // Replaces EXP-010's single-target seed 1638 (6 unavoidable damage by design). The overnight
    // brief removed that encounter for having unavoidable damage in the prologue; see
    // test/multi-enemy.test.ts for the full cp-e4 coverage (clean path, wrong-priority path, engine).
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e4.json'))
    const start = EncounterState.fromLevel(lvl, enc.encounter, 10)
    const md = minDamageToWin(start, { nodeBudget: 800_000 })
    expect(md).toMatchObject({ win: true, proven: true, minDamage: 0 })
  })

  it('cp-e5: winnable via either Rotate at the HP the old (pre-EXP-011) prologue chain produced; ccw still leaves more margin', () => {
    // EXP-011 update: this test's entryHp=4 premise is a leftover from EXP-010's original chain math
    // (10 max HP - 6 unavoidable from cp-e4's *old* single-target design) -- already stale once
    // EXP-010b made cp-e4 itself 0-damage, kept only as a fixed low-HP stress scenario. Before
    // EXP-011, cw (the "wrong" Rotate) was a proven loss at this HP (see EXP-010-REPORT.md); EXP-011's
    // cast-interrupt on phase 2 (removing the 1-damage floor, see EXP-010b-REPORT.md §6) makes phase 2
    // generally more forgiving, so a greedy cw playthrough now survives too -- just with much less
    // margin (1 hp vs. ccw's 3), which still demonstrates ccw as the better-informed choice on this
    // board without cw being an outright trap.
    const { file: enc, level: lvl } = encounterFromJson(load('cp-e5.json'))
    const entryHp = 4
    const s = EncounterState.fromLevel(lvl, enc.encounter, entryHp)
    while (s.phaseIndex === 0 && !s.over) {
      const free = s.board.freeArrows()
      s.tap(free.find((id) => s.wouldHit(id)) ?? free[0])
    }
    expect(s.rotateCharges).toBe(1)
    const ccw = s.clone()
    ccw.rotate(-1)
    while (!ccw.over) {
      const free = ccw.board.freeArrows()
      if (free.length === 0) break
      ccw.tap(free.find((id) => ccw.wouldHit(id)) ?? free[0])
    }
    expect(ccw.won).toBe(true)
    expect(ccw.playerHp).toBe(3)

    const cw = s.clone()
    cw.rotate(1)
    while (!cw.over) {
      const free = cw.board.freeArrows()
      if (free.length === 0) break
      cw.tap(free.find((id) => cw.wouldHit(id)) ?? free[0])
    }
    expect(cw.won).toBe(true)
    expect(cw.playerHp).toBe(1) // survives, but with far less margin than ccw
  })
})
