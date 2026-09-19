import { describe, expect, it } from 'vitest'
import {
  E, EncounterState, type EncounterDef, findWin, type Inventory, ITEMS, minDamageToWin, N, RELICS, type RelicId, RunState, S, W,
} from '../src/index.js'
import { levelXY } from './helpers.js'

const eArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[0, y], [1, y]] as [number, number][]))
const wArrows = (n: number) => levelXY(2, n, Array.from({ length: n }, (_, y) => [[1, y], [0, y]] as [number, number][]))

const base = (enemies: EncounterDef['enemies'], extra: Partial<EncounterDef> = {}): EncounterDef => ({
  id: 'item2-test', enemies, rotate: { allow: [] }, ...extra,
})

const inv = (...ids: (keyof typeof ITEMS)[]): Inventory => ({
  slots: ids.map((id) => ({ id, charges: ITEMS[id].charges })),
})

describe('ITEM-002: Frost Dart', () => {
  it('deals 1 DU, costs 1 turn, adds +2 to target countdown, consumes charge, undo refunds', () => {
    const def = base([
      { id: 'grunt', side: W, hp: 2, attackTimer: { interval: 2, damage: 1 } },
      { id: 'guard', side: E, hp: 3, attackTimer: { interval: 3, damage: 1 } },
    ])
    const s = EncounterState.fromLevel(eArrows(4), def, 10, null, 10, inv('frost_dart'))
    expect(s.canUseItem('frost_dart')).toBe(true)
    expect(s.itemActions()).toEqual([
      { kind: 'item', id: 'frost_dart', target: E },
      { kind: 'item', id: 'frost_dart', target: W },
    ])

    // Grunt is at countdown 2. Frost Dart deals 1 DU (hp: 2 -> 1).
    // World ticks: grunt 2 - 1 = 1, guard 3 - 1 = 2.
    // Target delay +2 applied to grunt: grunt countdown becomes 1 + 2 = 3.
    const r = s.useItem('frost_dart', W)
    expect(r.ok && 'hit' in r && r.hit && 'hitDamage' in r && r.hitDamage === 1).toBe(true)
    expect(s.enemies[0].hp).toBe(1)
    expect(s.enemies[0].countdown).toBe(3)
    expect(s.enemies[1].countdown).toBe(2)
    expect(s.items[0]?.charges).toBe(0)
    expect(s.canUseItem('frost_dart')).toBe(false)

    // Undo should restore everything
    s.undo()
    expect(s.items[0]?.charges).toBe(1)
    expect(s.enemies[0].hp).toBe(2)
    expect(s.enemies[0].countdown).toBe(2)
    expect(s.enemies[1].countdown).toBe(3)
  })

  it('prevents immediate enemy attack by adding +2 after countdown decrements to 0', () => {
    // Enemy has interval 2. Arrow 0 points E (misses West enemy).
    // After 1 tap, enemy countdown ticks 2 -> 1.
    const def = base([{ id: 'g', side: W, hp: 3, attackTimer: { interval: 2, damage: 4 } }])
    const s = EncounterState.fromLevel(eArrows(3), def, 10, null, 10, inv('frost_dart'))
    expect(s.enemies[0].countdown).toBe(2)

    // Tap arrow 0 (E miss): 1 turn passes, enemy countdown ticks to 1
    s.tap(0)
    expect(s.enemies[0].countdown).toBe(1)

    // Enemy is on the brink (countdown 1). Another normal turn would trigger an attack!
    // Frost Dart hits W enemy: applies +2 timer bonus, advances turn (-1).
    // Net result: countdown becomes 1 + 2 - 1 = 2, preventing the attack!
    const r = s.useItem('frost_dart', W)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.enemyAttacked).toBe(false)
    }
    expect(s.playerHp).toBe(10) // no damage taken!
    expect(s.enemies[0].countdown).toBe(2)
  })
})

describe('ITEM-002: Pocket Gyro', () => {
  it('is passive (cannot be clicked directly), grants +1 encounter-local rotate if rotate is allowed', () => {
    const def = base([{ id: 'g', side: W, hp: 2 }], { rotate: { allow: [1, -1], useRunPool: true } })
    const sharedPool = { charges: 0 }
    const s = EncounterState.fromLevel(eArrows(2), def, 10, sharedPool, 10, inv('pocket_gyro'))

    expect(s.canUseItem('pocket_gyro')).toBe(false)
    expect(s.itemActions().some((a) => a.id === 'pocket_gyro')).toBe(false)

    // Shared pool has 0, but Pocket Gyro grants +1 local rotate!
    expect(s.rotateCharges).toBe(1)
    expect(s.canRotate(1)).toBe(true)

    // Rotate CW: consumes the local bonus rotate
    const r = s.rotate(1)
    expect(r).toBe(true)
    expect(sharedPool.charges).toBe(0) // shared pool was NOT touched or corrupted!
    expect(s.rotateCharges).toBe(0)
    expect(s.canRotate(1)).toBe(false)

    // Undo refunds the local bonus rotate
    s.undo()
    expect(s.rotateCharges).toBe(1)
    expect(s.canRotate(1)).toBe(true)
    expect(sharedPool.charges).toBe(0)
  })

  it('does not inflate or pollute shared rotate pool across clone()', () => {
    const def = base([{ id: 'g', side: W, hp: 2 }], { rotate: { allow: [1], useRunPool: true } })
    const sharedPool = { charges: 1 }
    const s = EncounterState.fromLevel(eArrows(2), def, 10, sharedPool, 10, inv('pocket_gyro'))
    expect(s.rotateCharges).toBe(2) // 1 from pool + 1 from gyro

    const cloned = s.clone()
    // Cloned state must NOT have double-counted or leaked into shared pool
    expect(cloned.rotateCharges).toBe(2)
    expect(sharedPool.charges).toBe(1)
  })

  it('does not grant rotate if encounter forbids rotation', () => {
    const def = base([{ id: 'g', side: W, hp: 2 }], { rotate: { allow: [] } })
    const s = EncounterState.fromLevel(eArrows(2), def, 10, null, 10, inv('pocket_gyro'))
    expect(s.canRotate(1)).toBe(false)
  })
})

describe('ITEM-002: War Horn', () => {
  it('primes a buff for turnCost: 0; next landed puzzle arrow deals +1 DU; misses do not consume it', () => {
    const def = base([{ id: 'g', side: E, hp: 4 }])
    // Arrow 0 points E (lands on enemy). Arrow 1 points W (misses).
    const lvl = levelXY(2, 2, [
      [[0, 0], [1, 0]], // points E -> hits E
      [[1, 1], [0, 1]], // points W -> misses
    ])
    const s = EncounterState.fromLevel(lvl, def, 10, null, 10, inv('war_horn'))
    expect(s.isWarHornActive).toBe(false)

    // Activate War Horn (turnCost: 0, no enemy ticks)
    const r = s.useItem('war_horn')
    expect(r.ok).toBe(true)
    expect(s.isWarHornActive).toBe(true)
    expect(s.items[0]?.charges).toBe(0)

    // Arrow 1 is a miss (points W)
    const missTap = s.tap(1)
    expect(missTap.ok && 'hit' in missTap && !missTap.hit).toBe(true)
    // Buff must NOT be consumed by a miss!
    expect(s.isWarHornActive).toBe(true)

    // Arrow 0 is a hit (points E). Normal hit = 1 DU. With War Horn = 2 DU!
    const hitTap = s.tap(0)
    expect(hitTap.ok && 'hit' in hitTap && hitTap.hit).toBe(true)
    if (hitTap.ok && 'hitDamage' in hitTap) {
      expect(hitTap.hitDamage).toBe(2)
    }
    expect(s.enemies[0].hp).toBe(2)
    // Buff is now consumed
    expect(s.isWarHornActive).toBe(false)

    // Undo hitTap: buff restored
    s.undo()
    expect(s.isWarHornActive).toBe(true)
    expect(s.enemies[0].hp).toBe(4)

    // Undo missTap and item use: charges restored
    s.undo()
    s.undo()
    expect(s.isWarHornActive).toBe(false)
    expect(s.items[0]?.charges).toBe(1)
  })

  it('item attacks (bow/frost dart) do not consume or benefit from War Horn buff', () => {
    const def = base([{ id: 'g', side: E, hp: 5 }])
    const lvl = eArrows(2)
    const s = EncounterState.fromLevel(lvl, def, 10, null, 10, inv('war_horn', 'bow'))
    s.useItem('war_horn')
    expect(s.isWarHornActive).toBe(true)

    // Fire bow: deals normal 2 DU, does NOT consume War Horn
    const bowR = s.useItem('bow', E)
    expect(bowR.ok && bowR.hitDamage).toBe(2)
    expect(s.enemies[0].hp).toBe(3)
    expect(s.isWarHornActive).toBe(true)
  })
})

describe('ITEM-002: Waste Conversion (Relic)', () => {
  it('arrow into empty side primes buff; next hit deals +1 DU; misses do not stack', () => {
    const def = base([{ id: 'g', side: E, hp: 5 }])
    // Arrow 0 points W (miss). Arrow 1 points W (miss). Arrow 2 points E (hit).
    const lvl = levelXY(2, 3, [
      [[1, 0], [0, 0]], // W
      [[1, 1], [0, 1]], // W
      [[0, 2], [1, 2]], // E
    ])
    const relics: RelicId[] = ['waste_conversion']
    const s = EncounterState.fromLevel(lvl, def, 10, null, 10, null, relics)
    expect(s.isWasteConversionReady).toBe(false)

    // Miss 1: primes Waste Conversion
    s.tap(0)
    expect(s.isWasteConversionReady).toBe(true)

    // Miss 2: must NOT stack
    s.tap(1)
    expect(s.isWasteConversionReady).toBe(true)

    // Hit with Arrow 2: normal 1 DU + 1 DU bonus = 2 DU
    const hitR = s.tap(2)
    expect(hitR.ok && hitR.hitDamage).toBe(2)
    expect(s.enemies[0].hp).toBe(3)
    expect(s.isWasteConversionReady).toBe(false)

    // Undo hit
    s.undo()
    expect(s.isWasteConversionReady).toBe(true)
    expect(s.enemies[0].hp).toBe(5)
  })
})

describe('ITEM-002: Keystone Release (Relic)', () => {
  it('delays nearest live enemy countdown by +1 when a tap frees >= 2 arrows, triggers once per encounter', () => {
    const def = base([
      { id: 'g1', side: E, hp: 4, attackTimer: { interval: 3, damage: 1 } },
      { id: 'g2', side: W, hp: 4, attackTimer: { interval: 5, damage: 1 } },
    ])
    // 4x4 board:
    // Arrow 0 points North (free to exit).
    // Arrow 1 and Arrow 2 both point West into Arrow 0's cells.
    // Removing Arrow 0 frees both Arrow 1 and Arrow 2 simultaneously!
    const lvl = levelXY(4, 4, [
      [[1, 1], [1, 0]], // #0: points North, exits at (1, -1)
      [[3, 0], [2, 0]], // #1: points West into (1, 0)
      [[3, 1], [2, 1]], // #2: points West into (1, 1)
    ])

    const relics: RelicId[] = ['keystone_release']
    const s = EncounterState.fromLevel(lvl, def, 10, null, 10, null, relics)
    expect(s.isKeystoneTriggered).toBe(false)
    expect(s.enemies[0].countdown).toBe(3) // g1
    expect(s.enemies[1].countdown).toBe(5) // g2

    // Tap arrow 0. World ticks: g1 countdown 3 -> 2.
    // Arrow 0 frees arrow 1 AND arrow 2 (>= 2 freed!).
    // Keystone triggers: nearest live enemy (g1 countdown 2) gets +1 -> 3.
    const tapR = s.tap(0)
    expect(tapR.ok).toBe(true)
    expect(s.isKeystoneTriggered).toBe(true)
    expect(s.enemies[0].countdown).toBe(3) // 3 - 1 + 1 = 3
    expect(s.enemies[1].countdown).toBe(4) // 5 - 1 = 4

    // Undo restores triggered flag and countdown
    s.undo()
    expect(s.isKeystoneTriggered).toBe(false)
    expect(s.enemies[0].countdown).toBe(3)
    expect(s.enemies[1].countdown).toBe(5)
  })
})

describe('ITEM-002: Safety Fuse (Relic)', () => {
  it('first blocked tap in encounter deals 0 HP damage; subsequent blocked taps deal normal penalty', () => {
    const def = base([{ id: 'g', side: E, hp: 5 }], { blockedTapDamage: 2 })
    // Arrow 0 points East into (2, 0), which is occupied by Arrow 1
    const lvl = levelXY(3, 3, [
      [[0, 0], [1, 0]], // #0: points East into (2, 0)
      [[2, 1], [2, 0]], // #1: occupies (2, 0)
    ])
    const relics: RelicId[] = ['safety_fuse']
    const s = EncounterState.fromLevel(lvl, def, 10, null, 10, null, relics)
    expect(s.isSafetyFuseUsed).toBe(false)

    // Tap blocked arrow 0: normal blocked tap penalty is 2 HP.
    // Safety Fuse absorbs it completely!
    const r1 = s.tap(0)
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.reason).toBe('blocked')
    }
    expect(s.isSafetyFuseUsed).toBe(true)
    expect(s.playerHp).toBe(10) // 0 damage!

    // Second blocked tap: Safety Fuse is spent; takes 2 HP damage.
    const r2 = s.tap(0)
    expect(r2.ok).toBe(false)
    if (!r2.ok) {
      expect(r2.reason).toBe('blocked')
    }
    expect(s.playerHp).toBe(8)
  })
})

describe('ITEM-002: Solver Awareness', () => {
  it('solver uses Frost Dart to delay enemy deadline and secure a win', () => {
    // Player has 1 HP. Enemy has 1 HP and attackTimer interval: 1, damage: 2.
    // Board has 1 arrow pointing into empty space (W miss).
    // If player taps arrow: E enemy attacks and kills player.
    // If player uses Frost Dart on E enemy: deals 1 damage to enemy (kills enemy!) and wins!
    const def = base([{ id: 'boss', side: E, hp: 1, attackTimer: { interval: 1, damage: 5 } }])
    const lvl = wArrows(1)
    const s = EncounterState.fromLevel(lvl, def, 1, null, 10, inv('frost_dart'))

    const res = findWin(s)
    expect(res.win).toBe(true)
    expect(res.sequence[0]).toEqual({ kind: 'item', id: 'frost_dart', target: E })
  })

  it('solver uses Pocket Gyro extra rotate to solve an otherwise impossible board', () => {
    // 2 arrows point W into empty side. Enemy on N (hp: 1) attacks for lethal damage on turn 1.
    // Board requires CW rotate to point N and kill enemy before it attacks.
    // Shared rotate pool is 0. Without gyro: tapping misses (board not cleared), enemy attacks and kills player (loss).
    // With gyro: solver rotates CW and kills enemy (win)!
    const def = base([{ id: 'g', side: N, hp: 1, attackTimer: { interval: 1, damage: 10 } }], { rotate: { allow: [1], useRunPool: true } })
    const lvl = wArrows(2)
    const withoutGyro = EncounterState.fromLevel(lvl, def, 10, { charges: 0 }, 10, null)
    expect(findWin(withoutGyro).win).toBe(false)

    const withGyro = EncounterState.fromLevel(lvl, def, 10, { charges: 0 }, 10, inv('pocket_gyro'))
    const res = findWin(withGyro)
    expect(res.win).toBe(true)
    expect(res.sequence[0]).toEqual({ kind: 'rotate', turn: 1 })
  })
})

describe('ITEM-002: RunState, Reward Draft & Relic Persistence', () => {
  const lvl = eArrows(2)
  const step = (id: string, def: EncounterDef) => ({ id, level: lvl, def })

  it('adds relics to run.relics and preserves them through encounter transitions and serialization', () => {
    const s1 = step('s1', base([{ id: 'g', side: E, hp: 2 }]))
    const s2 = step('s2', base([{ id: 'g', side: E, hp: 2 }]))
    const run = new RunState({ playerMaxHp: 10, startingRelics: ['safety_fuse'] }, [s1, s2])

    expect(run.relics).toEqual(['safety_fuse'])
    expect(run.encounter.hasRelic('safety_fuse')).toBe(true)

    // Win step 1
    run.encounter.tap(0); run.encounter.tap(1)
    expect(run.encounter.won).toBe(true)

    // Choose relic if offered, or add relic directly
    run.addRelic('waste_conversion')
    expect(run.relics).toEqual(['safety_fuse', 'waste_conversion'])

    // Advance to step 2
    run.advance()
    expect(run.encounter.hasRelic('safety_fuse')).toBe(true)
    expect(run.encounter.hasRelic('waste_conversion')).toBe(true)

    // Save and restore
    const json = run.toJSON()
    const restored = RunState.fromJSON(run.config, [s1, s2], json)
    expect(restored.relics).toEqual(['safety_fuse', 'waste_conversion'])
    expect(restored.encounter.hasRelic('waste_conversion')).toBe(true)
  })

  it('draft offers unowned relics and unowned items with weights', () => {
    const s1 = step('s1', base([{ id: 'g', side: E, hp: 2 }]))
    const s2 = step('s2', base([{ id: 'g', side: E, hp: 2 }]))
    const run = new RunState({ playerMaxHp: 10, itemChance: 1.0 }, [s1, s2])
    run.encounter.tap(0); run.encounter.tap(1)

    const offers = run.rewardOffers()
    expect(offers.length).toBe(3)
    // Offer 3 should be an unowned item or relic
    const card3 = offers[2]
    expect(card3.kind === 'item' || card3.kind === 'relic').toBe(true)

    // If card3 is a relic, choosing it adds to relics
    if (card3.kind === 'relic') {
      const rid = card3.id
      run.chooseReward(2)
      expect(run.hasRelic(rid)).toBe(true)
    }
  })
})
