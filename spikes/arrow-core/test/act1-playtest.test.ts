import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  EncounterState,
  findWin,
  minDamageToWin,
  RunState,
} from '../src/index.js'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

describe('ACT-I-001: First Three Playtest Encounters', () => {
  const e1Raw = load('act1-e1.json')
  const e2Raw = load('act1-e2.json')
  const e3Raw = load('act1-e3.json')
  const cp5Raw = load('cp-e5.json')

  const { file: f1, level: lvl1 } = encounterFromJson(e1Raw)
  const { file: f2, level: lvl2 } = encounterFromJson(e2Raw)
  const { file: f3, level: lvl3 } = encounterFromJson(e3Raw)
  const { file: f5, level: lvl5 } = encounterFromJson(cp5Raw)

  describe('Encounter structure & specifications', () => {
    it('Act I #1 (seed 22): Two-Front Stand / multi-enemy reinforcement', () => {
      expect(f1.board.preset).toBe('easy')
      expect(f1.board.seed).toBe(22)
      expect(f1.board.levelHash).toBe('6e96e567')
      expect(lvl1.arrows.length).toBe(11)
      expect(f1.encounter.enemies).toHaveLength(2)
      expect(f1.encounter.enemies![0]).toMatchObject({ id: 'grunt_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 } })
      expect(f1.encounter.enemies![1]).toMatchObject({ id: 'grunt_e', side: 1, hp: 3, attackTimer: { interval: 5, damage: 2 } })
      expect(f1.encounter.rotate.useRunPool).toBe(true)
      expect(f1.encounter.rotate.allow).toEqual([1, -1])
    })

    it('Act I #2 (seed 112): Cross-Lock', () => {
      expect(f2.board.preset).toBe('easy')
      expect(f2.board.seed).toBe(112)
      expect(f2.board.levelHash).toBe('6a5e4f2c')
      expect(lvl2.arrows.length).toBe(9)
      expect(f2.encounter.enemies).toHaveLength(2)
      expect(f2.encounter.enemies![0]).toMatchObject({ id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 } })
      expect(f2.encounter.enemies![1]).toMatchObject({ id: 'grunt_n', side: 0, hp: 2, attackTimer: { interval: 4, damage: 2 } })
      expect(f2.encounter.rotate.useRunPool).toBe(true)
      expect(f2.encounter.rotate.allow).toEqual([1, -1])
    })

    it('Act I #3 (seed 25): Caster + Grunt', () => {
      expect(f3.board.preset).toBe('easy')
      expect(f3.board.seed).toBe(25)
      expect(f3.board.levelHash).toBe('1d1342bc')
      expect(lvl3.arrows.length).toBe(10)
      expect(f3.encounter.enemies).toHaveLength(2)
      const caster = f3.encounter.enemies![0]
      expect(caster.id).toBe('caster_n')
      expect(caster.side).toBe(0)
      expect(caster.hp).toBe(3)
      expect(caster.attackTimer).toMatchObject({
        interval: 3,
        damage: 4,
        kind: 'cast',
        interruptible: true,
        interruptedAttack: { interval: 3, damage: 2, kind: 'normal' },
      })
      expect(f3.encounter.enemies![1]).toMatchObject({ id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 4, damage: 2 } })
      expect(f3.encounter.rotate.useRunPool).toBe(true)
      expect(f3.encounter.rotate.allow).toEqual([1, -1])
    })

    it('Prologue mini-boss (cp-e5) awards +2 Rotate on completion', () => {
      expect(f5.encounter.winRotateReward).toBe(2)
    })
  })

  describe('Clean solution without Rotate (0 unavoidable damage, no Rotate required)', () => {
    it('Act I #1 achieves minDamage = 0 with maxRotates = 0', () => {
      const s = EncounterState.fromLevel(lvl1, f1.encounter, 10, { charges: 0 })
      const res = minDamageToWin(s, { maxRotates: 0 })
      expect(res.win).toBe(true)
      expect(res.minDamage).toBe(0)
      expect(res.sequence.length).toBeGreaterThan(0)
      expect(res.sequence.every((a) => a.kind === 'tap')).toBe(true)
    })

    it('Act I #2 achieves minDamage = 0 with maxRotates = 0', () => {
      const s = EncounterState.fromLevel(lvl2, f2.encounter, 10, { charges: 0 })
      const res = minDamageToWin(s, { maxRotates: 0 })
      expect(res.win).toBe(true)
      expect(res.minDamage).toBe(0)
      expect(res.sequence.length).toBeGreaterThan(0)
      expect(res.sequence.every((a) => a.kind === 'tap')).toBe(true)
    })

    it('Act I #3 achieves minDamage = 0 with maxRotates = 0 (caster interrupted in clean path)', () => {
      const s = EncounterState.fromLevel(lvl3, f3.encounter, 10, { charges: 0 })
      const res = minDamageToWin(s, { maxRotates: 0 })
      expect(res.win).toBe(true)
      expect(res.minDamage).toBe(0)
      expect(res.sequence.length).toBeGreaterThan(0)
      expect(res.sequence.every((a) => a.kind === 'tap')).toBe(true)
    })
  })

  describe('Run Flow & Rotate Pool carry-over verification', () => {
    it('Full sequence: Prologue complete -> +2 Rotate -> Act I #1 -> Act I #2 -> Act I #3', () => {
      const steps = [
        { id: 'prologue-boss', level: lvl5, def: f5.encounter },
        { id: 'act1-e1', level: lvl1, def: f1.encounter },
        { id: 'act1-e2', level: lvl2, def: f2.encounter },
        { id: 'act1-e3', level: lvl3, def: f3.encounter },
      ]
      const run = new RunState({ playerMaxHp: 10 }, steps)

      // Prologue starts with 0 shared rotate charges
      expect(run.rotateCharges).toBe(0)

      // Win prologue boss
      const winBoss = findWin(run.encounter)
      expect(winBoss.win).toBe(true)
      for (const a of winBoss.sequence) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)

      // Advance claims +2 Rotate
      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(1)
      expect(run.currentStep.id).toBe('act1-e1')
      expect(run.rotateCharges).toBe(2)
      expect(run.encounter.rotateCharges).toBe(2)
      expect(run.hpAtEntry).toBe(run.encounter.playerHp)

      // REQUIRED SCENARIO:
      // Использовать Rotate в бою 1 -> в бой 2 входит 1 charge.
      // Не использовать дальше -> бой 3 видит 1 charge.
      // We execute a valid 1-rotate sequence in Fight 1 (act1-e1):
      const act1Seq = [
        { kind: 'tap' as const, id: 0 },
        { kind: 'tap' as const, id: 1 },
        { kind: 'tap' as const, id: 3 },
        { kind: 'tap' as const, id: 5 },
        { kind: 'tap' as const, id: 6 },
        { kind: 'tap' as const, id: 7 },
        { kind: 'tap' as const, id: 10 },
        { kind: 'tap' as const, id: 2 },
        { kind: 'rotate' as const, turn: 1 as const },
        { kind: 'tap' as const, id: 8 },
        { kind: 'tap' as const, id: 9 },
        { kind: 'tap' as const, id: 4 },
      ]
      for (const a of act1Seq) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)
      expect(run.rotateCharges).toBe(1) // 1 charge spent in Fight 1!

      // Advance to Act I #2 (Fight 2)
      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(2)
      expect(run.currentStep.id).toBe('act1-e2')
      expect(run.rotateCharges).toBe(1) // В бой 2 входит 1 charge!
      expect(run.encounter.rotateCharges).toBe(1)

      // Win Act I #2 (Fight 2) without using Rotate:
      const act2Seq = [
        { kind: 'tap' as const, id: 0 },
        { kind: 'tap' as const, id: 3 },
        { kind: 'tap' as const, id: 2 },
        { kind: 'tap' as const, id: 4 },
      ]
      for (const a of act2Seq) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)
      expect(run.rotateCharges).toBe(1) // Still 1 charge!

      // Advance to Act I #3 (Fight 3)
      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(3)
      expect(run.currentStep.id).toBe('act1-e3')
      expect(run.rotateCharges).toBe(1) // Бой 3 видит 1 charge!
      expect(run.encounter.rotateCharges).toBe(1)

      // Win Act I #3 (Fight 3) without using Rotate:
      const act3Seq = [
        { kind: 'tap' as const, id: 3 },
        { kind: 'tap' as const, id: 0 },
        { kind: 'tap' as const, id: 2 },
        { kind: 'tap' as const, id: 4 },
        { kind: 'tap' as const, id: 5 },
      ]
      for (const a of act3Seq) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)
      expect(run.runWon).toBe(true)
      expect(run.rotateCharges).toBe(1) // Final charge preserved
    })

    it('Starting Act I directly with initialRotateCharges: 2', () => {
      const act1Steps = [
        { id: 'act1-e1', level: lvl1, def: f1.encounter },
        { id: 'act1-e2', level: lvl2, def: f2.encounter },
        { id: 'act1-e3', level: lvl3, def: f3.encounter },
      ]
      const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 2 }, act1Steps)
      expect(run.rotateCharges).toBe(2)
      expect(run.encounter.rotateCharges).toBe(2)

      // Spending 1 in e1, then advancing
      run.encounter.rotate(-1)
      expect(run.rotateCharges).toBe(1)

      // restartStep restores the 2 charges
      run.restartStep()
      expect(run.rotateCharges).toBe(2)
      expect(run.encounter.rotateCharges).toBe(2)
    })
  })
})
