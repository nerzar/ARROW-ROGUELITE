import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkEncounter, E, N, W, EncounterState, encounterFromJson, minDamageToWin, validateEncounter, type EncounterDef } from '../src/index.js'
import { levelXY } from './helpers.js'

const board = levelXY(6, 6, [
  [[0, 1], [0, 0]], // N
  [[4, 2], [5, 2]], // E
  [[1, 3], [0, 3]], // W
  [[4, 4], [5, 4]], // E
  [[2, 4], [2, 5]], // S, spare arrow
])
const def = (): EncounterDef => ({
  id: 'waves', rotate: { allow: [1, -1], advancesTurn: true }, rotateCharges: 3,
  enemies: [
    { id: 'first', side: N, hp: 1 },
    { id: 'second', side: E, hp: 1, arrival: { afterKill: 'first' }, attackTimer: { interval: 2, damage: 1 }, ability: { id: 'shield', kind: 'shield', interval: 2 } },
    { id: 'third', side: W, hp: 1, arrival: { afterKill: 'second' }, attackTimer: { interval: 1, damage: 1 } },
  ],
})

describe('WAVE-001 arrivals', () => {
  it('keeps pending enemies untargetable and silent; starts fresh timers after kill', () => {
    const s = EncounterState.fromLevel(board, def())
    expect(s.wouldHit(1)).toBe(false)
    expect(s.tap(1)).toMatchObject({ ok: true, hit: false, enemyDamage: 0, arrived: [] })
    expect(s.enemies[1]).toMatchObject({ pending: true, countdown: 2, abilityCountdown: 2, shielded: false })
    expect(s.tap(0)).toMatchObject({ ok: true, arrived: [{ id: 'second' }], won: false, enemyDamage: 0 })
    expect(s.enemies[1]).toMatchObject({ pending: false, countdown: 2, abilityCountdown: 2, shielded: false })
    expect(s.wouldHit(3)).toBe(true)
  })

  it('arrives on the requested world turn, then advances attack and ability clocks', () => {
    const d = def()
    d.enemies![1].arrival = { onTurn: 2 }
    const s = EncounterState.fromLevel(board, d)
    expect(s.enemies[1].arrivesIn).toBe(2)
    s.tap(1)
    expect(s.enemies[1].arrivesIn).toBe(1)
    expect(s.tap(0)).toMatchObject({ arrived: [{ id: 'second' }] })
    s.tap(2)
    expect(s.enemies[1]).toMatchObject({ pending: false, countdown: 1, abilityCountdown: 1, shielded: false })
    expect(s.enemies[1].arrivesIn).toBeUndefined()
  })

  it('waits for an occupied side; eligible enemies claim it in definition order', () => {
    const d = def()
    d.enemies![0].side = E
    d.enemies![1].arrival = { onTurn: 1 }
    d.enemies![2].side = E
    d.enemies![2].arrival = { onTurn: 1 }
    const s = EncounterState.fromLevel(board, d)
    s.tap(0) // no hit; both arrivals must wait
    expect(s.enemies.map((e) => e.pending)).toEqual([false, true, true])
    expect(s.enemies[1].arrivesIn).toBe(0)
    expect(s.tap(1)).toMatchObject({ arrived: [{ id: 'second' }] })
    expect(s.tap(3)).toMatchObject({ arrived: [{ id: 'third' }], enemyDamage: 0 })
  })

  it('undo and clone preserve arrivals and their search key', () => {
    const s = EncounterState.fromLevel(board, def())
    const initial = s.key()
    s.tap(0)
    const after = s.key()
    expect(s.clone().key()).toBe(after)
    expect(s.clone().enemies).toEqual(s.enemies)
    expect(s.undo()).toBe(true)
    expect(s.key()).toBe(initial)
    expect(s.enemies[1].pending).toBe(true)
    s.tap(0)
    expect(s.key()).toBe(after)
  })

  it('blocked taps do not advance arrival turns', () => {
    const blocked = levelXY(3, 3, [
      [[0, 1], [1, 1]], [[0, 2], [1, 2]], [[2, 1], [2, 0]],
    ])
    const d = def()
    d.enemies![1].arrival = { onTurn: 1 }
    const s = EncounterState.fromLevel(blocked, d)
    expect(s.tap(0)).toMatchObject({ ok: false, reason: 'blocked' })
    expect(s.enemies[1]).toMatchObject({ pending: true, arrivesIn: 1 })
  })

  it('pinned taps do not advance arrival turns', () => {
    const d = def()
    d.enemies![0].hp = 10
    d.enemies![0].ability = { id: 'stone_throw', interval: 1, targetPolicy: 'free-arrow', pinDuration: 1 }
    d.enemies![1].arrival = { onTurn: 2 }
    const s = EncounterState.fromLevel(board, d)
    s.tap(4)
    expect(s.pinnedArrows).toHaveLength(1)
    const key = s.key()
    expect(s.tap(s.pinnedArrows[0].id)).toMatchObject({ ok: false, reason: 'pinned' })
    expect(s.key()).toBe(key)
    expect(s.enemies[1]).toMatchObject({ pending: true, arrivesIn: 1 })
  })

  it('only a turn-costing rotate triggers arrivals, and undo reverses it', () => {
    for (const advancesTurn of [false, true]) {
      const d = def()
      d.rotate.advancesTurn = advancesTurn
      d.enemies![1].arrival = { onTurn: 1 }
      const s = EncounterState.fromLevel(board, d)
      const key = s.key()
      s.rotate(1)
      expect(s.enemies[1].pending).toBe(!advancesTurn)
      expect(s.enemies[1].countdown).toBe(2)
      s.undo()
      expect(s.key()).toBe(key)
    }
  })

  it('requires both supplied conditions, and a flee is not a kill', () => {
    const d = def()
    d.enemies![1].arrival = { afterKill: 'first', onTurn: 2 }
    const s = EncounterState.fromLevel(board, d)
    s.tap(0)
    expect(s.enemies[1].pending).toBe(true)
    s.tap(2)
    expect(s.enemies[1].pending).toBe(false)
    d.enemies![0].hp = 2
    d.enemies![0].flee = { afterHits: 1 }
    const fleeing = EncounterState.fromLevel(board, d)
    fleeing.tap(0)
    fleeing.tap(2)
    expect(fleeing.enemies[1].pending).toBe(true)
  })

  it('pending mandatory enemies block early win, but not board-clear fail-safe', () => {
    const d = def()
    d.enemies![1].arrival = { onTurn: 99 }
    const s = EncounterState.fromLevel(board, d)
    s.tap(0)
    expect(s.won).toBe(false)
    for (const id of [1, 2, 3, 4]) s.tap(id)
    expect(s.won).toBe(true)
    expect(s.enemies[1].pending).toBe(true)
    d.enemies![1].mandatory = false
    d.enemies![2].mandatory = false
    const optional = EncounterState.fromLevel(board, d)
    optional.tap(0)
    expect(optional.won).toBe(true)
  })

  it('solves a chain across all three arena sides with zero minimum damage', () => {
    const s = EncounterState.fromLevel(board, def())
    const result = minDamageToWin(s, { maxRotates: 0 })
    expect(result).toMatchObject({ win: true, proven: true, minDamage: 0 })
    for (const action of result.sequence) s.apply(action)
    expect(s.enemies.every((e) => e.dead)).toBe(true)
    expect(s.board.cleared).toBe(false)
  })

  it('rejects unknown dependencies, cycles, empty arrival, invalid turns and duplicate ids', () => {
    for (const arrival of [{ afterKill: 'missing' }, { afterKill: 'third' }, {}, { onTurn: 0 }, { onTurn: 1.5 }]) {
      const d = def()
      d.enemies![1].arrival = arrival
      expect(() => checkEncounter(d)).toThrow()
    }
    const d = def()
    d.enemies![1].id = 'first'
    expect(() => checkEncounter(d)).toThrow(/unique/)
  })

  it('includes damage from future attackers in the proven minimum', () => {
    const d = def()
    d.enemies = [{ id: 'late', side: E, hp: 10, arrival: { onTurn: 1 }, attackTimer: { interval: 1, damage: 1 } }]
    const s = EncounterState.fromLevel(board, d)
    // Turn 1: arrival, turns 2..4: attacks, turn 5: board-clear win.
    expect(minDamageToWin(s, { maxRotates: 0 })).toMatchObject({ win: true, proven: true, minDamage: 3 })
  })

  it('audits the playable two-wave debug fixture with a proven minimum-damage path', () => {
    const raw = JSON.parse(readFileSync(new URL('../encounters/wave-001.json', import.meta.url), 'utf8'))
    const { file, level } = encounterFromJson(raw)
    const report = validateEncounter(level, file.encounter)
    expect(report.minDamageWin).toMatchObject({ win: true, proven: true, minDamage: 0 })
    expect(report.exampleTrace.join('\n')).toContain('ARRIVED:')
    const s = EncounterState.fromLevel(level, file.encounter)
    for (const action of report.minDamageWin.sequence) s.apply(action)
    expect(s.enemies.every((e) => e.dead)).toBe(true)
  })
})
