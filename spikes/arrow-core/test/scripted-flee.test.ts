// STORY-001: scripted flee — a reusable encounter/presentation/scripted-event layer.
// `EnemyDef.flee` declares an unkillable guest: after `afterHits` landed hits (< hp, enforced)
// it taunts and leaves the arena instead of dying. Fled is not dead: no more hits, attacks, or
// abilities — but a mandatory fled enemy still blocks the all-mandatory-dead win, so the fight
// never ends instantly and the player finishes the puzzle (board-clear win, COMBAT-RULES 7-8).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkEncounter,
  E,
  type EncounterDef,
  EncounterState,
  findWin,
  minDamageToWin,
  N,
} from '../src/index.js'
import { convertLevelToStep } from '../viewer/visual-proto/campaign-model.js'
import { levelXY } from './helpers.js'

/** `n` always-free N-hitting arrows (head on row 0, one per column — no blocking). */
const nArrows = (n: number) =>
  levelXY(n, 2, Array.from({ length: n }, (_, x) => [[x, 1], [x, 0]] as [number, number][]))

/** 2 free N arrows (cols 0-1) + 1 free E arrow (row 2): exactly clearable in 3 taps. */
const mixedLevel = () =>
  levelXY(3, 3, [
    [[0, 1], [0, 0]],
    [[1, 1], [1, 0]],
    [[0, 2], [1, 2]],
  ])

const kingDef = (over: Partial<EncounterDef> = {}): EncounterDef => ({
  id: 'flee-test',
  enemies: [{ id: 'king', side: N, hp: 3, label: 'King', flee: { afterHits: 2 } }],
  rotate: { allow: [] },
  ...over,
})

describe('STORY-001 scripted flee: validation', () => {
  it('rejects afterHits that could never fire (0, >= hp, non-integer)', () => {
    for (const afterHits of [0, 3, 99, 1.5]) {
      expect(() =>
        checkEncounter(kingDef({ enemies: [{ id: 'k', side: N, hp: 3, flee: { afterHits } }] })),
      ).toThrow()
    }
  })

  it('accepts a reachable flee (afterHits < hp)', () => {
    expect(() => checkEncounter(kingDef())).not.toThrow()
  })
})

describe('STORY-001 scripted flee: engine', () => {
  it('fires after exactly afterHits hits; the enemy survives and the fight goes on', () => {
    const s = EncounterState.fromLevel(nArrows(3), kingDef({ enemies: [
      { id: 'king', side: N, hp: 3, flee: { afterHits: 2 } },
      { id: 'mob', side: E, hp: 1 },
    ] }), 10)
    const r1 = s.tap(0)
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.fled ?? []).toEqual([])
    expect(s.enemies[0]).toMatchObject({ hp: 2, dead: false, fled: false })
    expect(s.won).toBe(false)

    const r2 = s.tap(1)
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.hit).toBe(true)
      expect(r2.fled).toEqual([{ id: 'king', label: undefined }])
    }
    expect(s.enemies[0]).toMatchObject({ hp: 1, dead: false, fled: true })
    expect(s.won).toBe(false) // fled is not dead: no instant win
  })

  it('a fled enemy can no longer be hit, attacked by, or tick its timer', () => {
    const s = EncounterState.fromLevel(nArrows(4), kingDef({ enemies: [
      { id: 'king', side: N, hp: 3, attackTimer: { interval: 2, damage: 1 }, flee: { afterHits: 2 } },
    ] }), 10)
    s.tap(0) // hit 1: countdown 2 -> 1
    expect(s.enemies[0].countdown).toBe(1)
    s.tap(1) // hit 2: flees — no retaliation, no tick
    expect(s.enemies[0].fled).toBe(true)
    expect(s.enemies[0].countdown).toBe(1) // frozen, not re-armed
    expect(s.playerHp).toBe(10)
    const r3 = s.tap(2) // N arrow into an empty side: a miss, timer still frozen
    expect(r3.ok).toBe(true)
    if (r3.ok) {
      expect(r3.hit).toBe(false)
      expect(r3.enemyAttacked).toBe(false)
    }
    expect(s.wouldHit(3)).toBe(false)
    expect(s.playerHp).toBe(10)
  })

  it('a mandatory fled enemy only yields to the board-clear win', () => {
    const s = EncounterState.fromLevel(mixedLevel(), kingDef({ enemies: [
      { id: 'king', side: N, hp: 3, flee: { afterHits: 2 } },
      { id: 'mob', side: E, hp: 1 },
    ] }), 10)
    s.tap(0) // king 2/3
    s.tap(1) // king 1/3, fled
    expect(s.enemies[0].fled).toBe(true)
    expect(s.won).toBe(false)
    s.tap(2) // mob dies — still no win: the mandatory king fled, never died
    expect(s.enemies[1].dead).toBe(true)
    expect(s.won).toBe(true) // ...because the board is now fully cleared while alive
    expect(s.board.cleared).toBe(true)
    expect(s.playerHp).toBe(10)
  })

  it('a non-mandatory fled guest never decides the encounter by itself', () => {
    const def = kingDef({ enemies: [
      { id: 'king', side: N, hp: 3, mandatory: false, flee: { afterHits: 2 } },
      { id: 'mob', side: E, hp: 1 },
    ] })
    const early = EncounterState.fromLevel(mixedLevel(), def, 10)
    early.tap(2) // mob dies first: instant win, the king never even got hit
    expect(early.won).toBe(true)

    const s = EncounterState.fromLevel(mixedLevel(), def, 10)
    s.tap(0)
    const r = s.tap(1)
    expect(r.ok && r.fled).toEqual([{ id: 'king', label: undefined }])
    expect(s.won).toBe(false) // mob still alive — the flee alone wins nothing
  })

  it('undo restores the pre-flee state (un-flees)', () => {
    const s = EncounterState.fromLevel(nArrows(3), kingDef(), 10)
    s.tap(0)
    s.tap(1)
    expect(s.enemies[0].fled).toBe(true)
    expect(s.undo()).toBe(true)
    expect(s.enemies[0]).toMatchObject({ hp: 2, fled: false })
    expect(s.wouldHit(2)).toBe(true)
  })

  it('clone and key follow fled state (solver-safe)', () => {
    const s = EncounterState.fromLevel(nArrows(3), kingDef(), 10)
    const keyBefore = s.key()
    s.tap(0)
    s.tap(1)
    expect(s.key()).not.toBe(keyBefore)
    const c = s.clone()
    expect(c.enemies[0].fled).toBe(true)
    expect(c.key()).toBe(s.key())
  })

  it('the solver still finds the win through the flee', () => {
    const s = EncounterState.fromLevel(mixedLevel(), kingDef({ enemies: [
      { id: 'king', side: N, hp: 3, flee: { afterHits: 2 } },
      { id: 'mob', side: E, hp: 1 },
    ] }), 10)
    const w = findWin(s, { nodeBudget: 50_000 })
    expect(w.win).toBe(true)
  })
})

describe('STORY-001: stage-1 Goblin King beat end-to-end (campaign.json)', () => {
  const campaignRaw = JSON.parse(readFileSync('campaigns/campaign.json', 'utf8'))
  const stage1Raw = campaignRaw.levels[0]
  const step = convertLevelToStep(stage1Raw)

  it('stage 1 fields only the unkillable King, cleared via board-clear win', () => {
    expect(stage1Raw.id).toBe('prologue-stage-1')
    expect(step.def.enemies!.length).toBe(1)
    const [king] = step.def.enemies!
    expect(king.id).toBe('goblin_king')
    expect(king.side).toBe(0)
    expect(king.flee).toMatchObject({ afterHits: 2 })
    expect(king.flee!.afterHits).toBeLessThan(king.hp) // structurally unkillable
    expect(() => checkEncounter(step.def)).not.toThrow()
  })

  it('plays the scripted beat: 2 hits -> taunt/flee -> fight goes on -> puzzle win', () => {
    const s = EncounterState.fromLevel(step.level, step.def, 10, null)
    const win = minDamageToWin(s, { nodeBudget: 3000 })
    expect(win.win).toBe(true)
    expect(win.minDamage).toBe(0)

    const play = EncounterState.fromLevel(step.level, step.def, 10, null)
    let fledAt = -1
    win.sequence.forEach((a, i) => {
      const r = a.kind === 'tap' ? play.tap(a.id) : a.kind === 'rotate' ? (play.rotate(a.turn), null) : null
      if (a.kind === 'tap' && r && r.ok && (r.fled ?? []).length > 0 && fledAt < 0) fledAt = i
    })
    expect(fledAt).toBeGreaterThanOrEqual(0) // the beat always fires on the winning line
    expect(fledAt).toBeLessThan(win.sequence.length - 1) // ...and never on the last move: the fight goes on
    expect(play.won).toBe(true)
    expect(play.playerHp).toBe(10)
    const king = play.enemies.find((e) => e.id === 'goblin_king')!
    expect(king.fled).toBe(true)
    expect(king.hp).toBeGreaterThan(0) // fled, never killed
  })
})
