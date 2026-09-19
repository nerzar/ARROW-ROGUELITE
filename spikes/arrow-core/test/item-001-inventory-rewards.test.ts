import { describe, expect, it } from 'vitest'
import {
  E, EncounterState, type EncounterDef, findWin, type Inventory, ITEMS, minDamageToWin, N, RunState, W,
} from '../src/index.js'
import { levelXY } from './helpers.js'

/**
 * ITEM-001: run inventory, the `item` action (Bow / Shield / Health Flask), reward draft 1-of-3,
 * solver awareness and run persistence. Numbers are BALANCE-SYSTEM baseline v0.1 (provisional).
 */

const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))
const base = (enemies: EncounterDef['enemies'], extra: Partial<EncounterDef> = {}): EncounterDef => ({
  id: 'item-test', enemies, rotate: { allow: [] }, ...extra,
})
const inv = (...ids: (keyof typeof ITEMS)[]): Inventory => ({ slots: ids.map((id) => ({ id, charges: ITEMS[id].charges })) })

describe('Bow', () => {
  it('deals 2 to the chosen live target, costs a charge and a world turn, kills grant rewards, undo refunds', () => {
    const def = base([
      { id: 'grunt', side: W, hp: 2, attackTimer: { interval: 2, damage: 1 }, reward: { heal: 1 } },
      { id: 'guard', side: E, hp: 3, attackTimer: { interval: 3, damage: 1 } },
    ])
    const i = inv('bow')
    const s = EncounterState.fromLevel(eArrows(4), def, 6, null, 10, i)
    expect(s.canUseItem('bow')).toBe(true)
    expect(s.canUseItem('bow', N)).toBe(false) // nobody on N
    expect(s.itemActions()).toEqual([{ kind: 'item', id: 'bow', target: E }, { kind: 'item', id: 'bow', target: W }])
    const r = s.useItem('bow', W)
    expect(r.ok && r.hit && r.hitDamage).toBe(2)
    expect(s.enemies[0].dead).toBe(true)
    expect(s.playerHp).toBe(7) // +1 kill reward
    expect(i.slots[0].charges).toBe(0)
    expect(s.enemies[1].countdown).toBe(2) // the world ticked (Turn Cost 1)
    expect(s.canUseItem('bow')).toBe(false)
    s.undo()
    expect(i.slots[0].charges).toBe(1)
    expect(s.enemies[0].dead).toBe(false)
    expect(s.playerHp).toBe(6)
    expect(s.enemies[1].countdown).toBe(3)
  })

  it('is absorbed by a raised enemy shield like an arrow', () => {
    const def = base([{ id: 'cap', side: E, hp: 3, ability: { id: 'sh', kind: 'shield', interval: 3 } }])
    const wArrows = levelXY(2, 4, Array.from({ length: 4 }, (_, y) => [[1, y], [0, y]] as [number, number][]))
    const s = EncounterState.fromLevel(wArrows, def, 10, null, 10, inv('bow'))
    s.tap(0); s.tap(1); s.tap(2) // three W misses: the shield rises on turn 3
    expect(s.enemies[0].shielded).toBe(true)
    const r = s.useItem('bow', E)
    expect(r.ok && r.hitDamage).toBe(0)
    expect(s.enemies[0].hp).toBe(3)
    expect(s.enemies[0].shielded).toBe(false)
  })

  it('works in boss mode and crosses a phase boundary without overshooting', () => {
    const def: EncounterDef = { id: 'boss', boss: { id: 'b', phases: [{ side: E, hpUnits: 1 }, { side: W, hpUnits: 2 }] }, rotate: { allow: [] } }
    const s = EncounterState.fromLevel(eArrows(4), def, 10, null, 10, inv('bow'))
    const r = s.useItem('bow', E)
    expect(r.ok && r.hitDamage).toBe(1) // phase 1 had 1 hp; the extra unit is not carried across
    expect(s.phaseIndex).toBe(1)
    s.undo()
    expect(s.phaseIndex).toBe(0)
    expect(s.hp).toBe(3)
  })
})

describe('Shield item (ward)', () => {
  it('absorbs up to 2 damage of enemy attacks, is a free action, does not stack, undo restores', () => {
    const def = base([{ id: 'g', side: W, hp: 9, attackTimer: { interval: 1, damage: 3 } }])
    const s = EncounterState.fromLevel(eArrows(4), def, 10, null, 10, inv('shield'))
    const r = s.useItem('shield')
    expect(r.ok && !r.enemyAttacked).toBe(true) // free action: no tick
    expect(s.wardHp).toBe(2)
    s.tap(0) // E miss -> attack 3: ward eats 2, HP -1
    expect(s.playerHp).toBe(9)
    expect(s.wardHp).toBe(0)
    s.undo(); s.undo()
    expect(s.playerHp).toBe(10)
    expect(s.wardHp).toBe(0)
  })
})

describe('Health Flask', () => {
  it('heals 3 capped at max, free action, one charge per run', () => {
    const def = base([{ id: 'g', side: W, hp: 9 }])
    const i = inv('health_flask')
    const s = EncounterState.fromLevel(eArrows(3), def, 8, null, 10, i)
    expect(s.useItem('health_flask').ok).toBe(true)
    expect(s.playerHp).toBe(10)
    expect(s.canUseItem('health_flask')).toBe(false)
  })
})

describe('Solver with items', () => {
  it('finds the Bow line when no arrow of the right direction exists; maxItems: 0 forbids it', () => {
    // Only E arrows; the mandatory enemy stands on W.
    const def = base([{ id: 'g', side: W, hp: 2, attackTimer: { interval: 1, damage: 3 } }])
    const withBow = () => EncounterState.fromLevel(eArrows(2), def, 3, null, 10, inv('bow'))
    const w = findWin(withBow())
    expect(w.win).toBe(true)
    expect(w.sequence[0]).toEqual({ kind: 'item', id: 'bow', target: W })
    const bare = minDamageToWin(withBow(), { maxItems: 0 })
    expect(bare.win).toBe(false) // 2 E misses at 3 dmg each kill a 3 HP player
    const md = minDamageToWin(withBow())
    expect(md.win).toBe(true)
    expect(md.minDamage).toBe(0)
  })

  it('values the Shield as damage prevention', () => {
    const def = base([{ id: 'g', side: W, hp: 5, attackTimer: { interval: 1, damage: 2 } }])
    const lvl = eArrows(2) // two E misses: the first one triggers the attack, the second clears the board
    const md = minDamageToWin(EncounterState.fromLevel(lvl, def, 10, null, 10, inv('shield')))
    expect(md.minDamage).toBe(0)
    expect(md.sequence.some((a) => a.kind === 'item' && a.id === 'shield')).toBe(true)
  })
})

describe('RunState: inventory, reward draft, persistence', () => {
  const lvl = eArrows(2)
  const step = (id: string, def: EncounterDef) => ({ id, level: lvl, def })
  const d = () => base([{ id: 'a', side: E, hp: 1 }])

  it('draft = gold + (heal|rotate) + rare item/big gold; deterministic; forced item via rewardItem; recharge', () => {
    const forced = () => base([{ id: 'a', side: E, hp: 1 }], { rewardItem: true })
    const mk = () => new RunState({ playerMaxHp: 10, runSeed: 7 }, [step('s1', forced()), step('s2', d()), step('s3', d())])
    const run = mk()
    expect(run.rewardPending).toBe(false)
    run.encounter.tap(0)
    expect(run.rewardPending).toBe(true)
    const offers = run.rewardOffers()
    expect(offers.length).toBe(3)
    expect(offers[0]).toEqual({ kind: 'gold', amount: 8 }) // base 8 + 2*0
    expect(offers[1]).toEqual({ kind: 'rotate', charges: 1 }) // full HP -> rotate, not heal
    expect(offers[2].kind).toBe('item') // forced by rewardItem
    expect(run.rewardOffers()).toBe(offers)
    const again = mk()
    again.encounter.tap(0)
    expect(again.rewardOffers()).toEqual(offers)
    expect(run.chooseReward(2)).toBe(true)
    expect(run.inventory.length).toBe(1)
    run.advance()
    // s2: not forced; card 3 is an item only by chance, card 1 is always gold, scaled by step.
    run.encounter.tap(0)
    const o2 = run.rewardOffers()
    expect(o2[0]).toEqual({ kind: 'gold', amount: 10 })
    expect(['item', 'gold']).toContain(o2[2].kind)
    run.chooseReward(0)
    expect(run.gold).toBe(10)
    run.advance()
    expect(run.inventory[0].charges).toBe(ITEMS[run.inventory[0].id].charges) // recharged on entry
  })

  it('items are rare: over many seeds the third card is an item roughly itemChance of the time', () => {
    let items = 0
    const N = 200
    for (let seed = 1; seed <= N; seed++) {
      const run = new RunState({ playerMaxHp: 10, runSeed: seed, itemChance: 0.3 }, [step('s1', d()), step('s2', d())])
      run.encounter.tap(0)
      if (run.rewardOffers()[2].kind === 'item') items++
    }
    expect(items / N).toBeGreaterThan(0.18)
    expect(items / N).toBeLessThan(0.42)
  })

  it('gold is kept across steps, reset by restartStep to the entry value, and saved', () => {
    const run = new RunState({ playerMaxHp: 10, runSeed: 2 }, [step('s1', d()), step('s2', d()), step('s3', d())])
    run.encounter.tap(0)
    run.chooseReward(0)
    expect(run.gold).toBe(8)
    run.advance()
    run.encounter.tap(0)
    run.chooseReward(0)
    expect(run.gold).toBe(18)
    run.restartStep()
    expect(run.gold).toBe(8)
    const back = RunState.fromJSON({ playerMaxHp: 10 }, [step('s1', d()), step('s2', d()), step('s3', d())], JSON.parse(JSON.stringify(run.toJSON())))
    expect(back.gold).toBe(8)
    expect(back.stepIndex).toBe(1)
  })

  it('heal reward applies on advance, rotate reward goes to the pool, no reward on excluded steps', () => {
    const run = new RunState({ playerMaxHp: 10, runSeed: 3, noRewardAfter: ['s1'] }, [step('s1', d()), step('s2', d()), step('s3', d())])
    run.encounter.tap(0)
    expect(run.rewardPending).toBe(false)
    run.advance()
    ;(run.encounter as any).playerHpValue = 4
    run.encounter.tap(0)
    const offers = run.rewardOffers()
    const heal = offers.findIndex((o) => o.kind === 'heal')
    const rot = offers.findIndex((o) => o.kind === 'rotate')
    if (heal >= 0) {
      run.chooseReward(heal)
      run.advance()
      expect(run.encounter.playerHp).toBe(7)
    } else if (rot >= 0) {
      const before = run.rotateCharges
      run.chooseReward(rot)
      expect(run.rotateCharges).toBe(before + 1)
    }
  })

  it('a full inventory needs a replace slot; restartStep restores charges; toJSON/fromJSON round-trips', () => {
    const run = new RunState({ playerMaxHp: 10, startingItems: ['bow', 'shield', 'health_flask'] }, [step('s1', d()), step('s2', d())])
    expect(run.inventoryFull).toBe(true)
    expect(run.addItem('bow')).toBe(false)
    run.encounter.useItem('health_flask')
    expect(run.inventory[2].charges).toBe(0)
    run.restartStep() // back to the entry snapshot: flask charge restored
    expect(run.inventory[2].charges).toBe(1)
    expect(run.addItem('bow', 1)).toBe(true)
    expect(run.inventory[1].id).toBe('bow')
    run.encounter.useItem('health_flask')
    run.encounter.tap(0)
    run.skipReward()
    run.advance()
    const save = JSON.parse(JSON.stringify(run.toJSON()))
    const back = RunState.fromJSON({ playerMaxHp: 10 }, [step('s1', d()), step('s2', d())], save)
    expect(back.stepIndex).toBe(1)
    expect(back.inventory.map((i) => i.id)).toEqual(['bow', 'bow', 'health_flask'])
    expect(back.inventory[2].charges).toBe(0) // run-scoped charge stays spent
    expect(back.inventory[0].charges).toBe(1)
  })
})
