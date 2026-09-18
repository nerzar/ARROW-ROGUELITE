import { describe, expect, it } from 'vitest'
import {
  E,
  type EncounterDef,
  EncounterState,
  findWin,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * PLAYTEST-FIX-001 regression: Stone Pin softlock.
 *
 * Canonical rule: with pinDuration = N, a pin may only land when at least N OTHER playable
 * arrows remain afterwards, i.e. `candidates.length >= ability.pinDuration + 1` (never hardcoded).
 * Otherwise the ability fizzles (countdown still resets). A pinned tap is never a world turn:
 * no HP cost, no timer movement.
 */

const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))

const abilityDef = (interval: number, pinDuration: number, hp = 99): EncounterDef => ({
  id: 'pin-safety-test',
  enemies: [
    {
      id: 'rock', side: E, hp,
      ability: { id: 'stone_throw', interval, targetPolicy: 'free-arrow', pinDuration },
    },
  ],
  rotate: { allow: [] },
})

/** After tapping `tapId` on a fresh `eArrows(n)` board, how many playable candidates remain. */
const candidatesAfterTap = (n: number) => n - 1

describe('Stone safety rule: durations 1/2/3, exactly-safe pins and one-less fizzles', () => {
  for (const duration of [1, 2, 3]) {
    it(`duration ${duration}: exactly pinDuration+1 candidates -> pins lowest id`, () => {
      const n = duration + 2 // after tapping id0, candidates = duration+1 (exactly safe)
      expect(candidatesAfterTap(n)).toBe(duration + 1)
      const s = EncounterState.fromLevel(eArrows(n), abilityDef(1, duration), 10)
      const r = s.tap(0)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: duration }])
      expect(s.isPinned(1)).toBe(true)
    })

    it(`duration ${duration}: one less than safe (pinDuration candidates) -> fizzles`, () => {
      const n = duration + 1 // after tapping id0, candidates = duration (one less than safe)
      expect(candidatesAfterTap(n)).toBe(duration)
      const s = EncounterState.fromLevel(eArrows(n), abilityDef(1, duration), 10)
      const r = s.tap(0)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.pinnedThisTurn ?? []).toEqual([])
      expect(s.pinnedArrows).toEqual([])
      // Countdown still resets on fizzle: the ability retries next cycle, not every turn.
      expect(s.enemies[0].abilityCountdown).toBe(1)
    })
  }
})

describe('Stone safety rule: existing pins count against the next resolution', () => {
  it('a still-pinned arrow is not a candidate: second resolution fizzles instead of double-pinning', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    const r1 = s.tap(0) // pins id1 (candidates [1,2,3,4], safe)
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: 2 }])

    // After removing id2, playable candidates are [3,4] (id1 still pinned, 1t left) -> 2 < 3 -> fizzle.
    // If the check ignored existing pins it would see 3 arrows and pin again.
    const r2 = s.tap(2)
    expect(r2.ok).toBe(true)
    if (r2.ok) expect(r2.pinnedThisTurn ?? []).toEqual([])
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 1 }])
  })
})

describe('Stone safety rule: two Stone Throwers resolve sequentially in one world turn', () => {
  const twoThrowers = (interval: number, pinDuration: number, n: number, hp = 99): { s: EncounterState; def: EncounterDef } => {
    const def: EncounterDef = {
      id: 'two-throwers',
      enemies: [
        { id: 'rock-a', side: E, hp, ability: { id: 'stone_a', interval, targetPolicy: 'free-arrow', pinDuration } },
        { id: 'rock-b', side: E, hp, ability: { id: 'stone_b', interval, targetPolicy: 'free-arrow', pinDuration } },
      ],
      rotate: { allow: [] },
    }
    return { s: EncounterState.fromLevel(eArrows(n), def, 10), def }
  }

  it('with room, both pin distinct arrows (second sees the first pin)', () => {
    const { s } = twoThrowers(1, 2, 7)
    const r = s.tap(0)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pinnedThisTurn).toEqual([
        { id: 1, turnsLeft: 2 },
        { id: 2, turnsLeft: 2 },
      ])
    }
    expect(s.pinnedArrows).toEqual([
      { id: 1, turnsLeft: 2 },
      { id: 2, turnsLeft: 2 },
    ])
  })

  it('without room, the second fizzles (does not pile onto an unsafe board)', () => {
    const { s } = twoThrowers(1, 2, 4) // after tap: {1,2,3}; first pins id1 -> {2,3} left -> second must fizzle
    const r = s.tap(0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn).toEqual([{ id: 1, turnsLeft: 2 }])
    expect(s.pinnedArrows).toEqual([{ id: 1, turnsLeft: 2 }])
  })
})

describe('Stone safety rule: the caught user softlock sequence no longer locks', () => {
  it('pinDuration=2 with two playable arrows fizzles instead of leaving only a pinned arrow', () => {
    // Old rule (>= 2) pinned here: 2 candidates -> pin one -> player plays the other -> only the
    // pinned arrow remains, pinned taps are not world turns, the pin can never expire: hard softlock.
    const s = EncounterState.fromLevel(eArrows(3), abilityDef(1, 2), 10)
    const r = s.tap(0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.pinnedThisTurn ?? []).toEqual([])
    expect(s.pinnedArrows).toEqual([])
  })

  it('full user-shaped sequence (pin, play the other, down to one arrow) always keeps a legal tap and wins', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    const hpStart = s.playerHp

    const r1 = s.tap(0) // pins id1
    expect(r1.ok).toBe(true)

    // Play every remaining playable arrow one by one; the game must never strand us with zero
    // playable arrows while neither won nor lost, and the pin must expire on its own clock.
    const order = [2, 3, 4, 1]
    for (const id of order) {
      expect(s.playableArrows().length > 0 || s.over).toBe(true)
      const r = s.tap(id)
      expect(r).toMatchObject({ ok: true })
      // World turns never cost HP by themselves here (no attackTimer in this fixture).
      expect(s.playerHp).toBe(hpStart)
    }
    expect(s.won).toBe(true)
    expect(s.playerDead).toBe(false)
  })

  it('clicking a pinned arrow costs no HP and moves no timer', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    s.tap(0) // pins id1
    const hpBefore = s.playerHp
    const cdBefore = s.enemies[0].abilityCountdown
    const r = s.tap(1)
    expect(r).toMatchObject({ ok: false, reason: 'pinned', playerHp: hpBefore, playerDead: false })
    expect(s.playerHp).toBe(hpBefore)
    expect(s.enemies[0].abilityCountdown).toBe(cdBefore)
  })
})

describe('Stone safety rule: solver never offers a dead state as a playable continuation', () => {
  it('every step of the proven winning path is a real legal tap, and no visited state is stuck', () => {
    const s = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    const win = findWin(s, { nodeBudget: 500_000 })
    expect(win).toMatchObject({ win: true, proven: true })
    expect(win.sequence.length).toBeGreaterThan(0)

    const t = EncounterState.fromLevel(eArrows(5), abilityDef(1, 2), 10)
    for (const a of win.sequence) {
      // No mid-sequence state may be dead: zero playable arrows while neither won nor lost.
      expect(t.playableArrows().length > 0 || t.over).toBe(true)
      if (a.kind !== 'tap') continue
      expect(t.playableArrows()).toContain(a.id)
      const r = t.tap(a.id)
      expect(r.ok).toBe(true) // never a 'pinned'/'blocked' rejection inside a solver path
    }
    expect(t.won).toBe(true)
  })
})
