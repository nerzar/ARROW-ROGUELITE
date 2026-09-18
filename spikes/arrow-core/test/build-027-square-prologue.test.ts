// BUILD-027: Square Prologue Campaign Verification Suite.
import { describe, expect, it } from 'vitest'
import { EncounterState, minDamageToWin, RunState } from '../src/index.js'
import { convertLevelToStep, generateBoardForLevel } from '../viewer/visual-proto/campaign-model.js'
import fs from 'fs'

describe('BUILD-027: Square Prologue Campaign', () => {
  const campaignRaw = JSON.parse(fs.readFileSync('campaigns/campaign.json', 'utf8'))
  const steps = campaignRaw.levels.map(convertLevelToStep)

  it('contains exactly 5 authored square stages', () => {
    expect(campaignRaw.levels.length).toBe(5)
    expect(steps.length).toBe(5)
    for (const lvl of campaignRaw.levels) {
      expect(lvl.board.size).toBeGreaterThanOrEqual(5)
      expect(lvl.board.size).toBeLessThanOrEqual(6)
      const gen = generateBoardForLevel(lvl)
      expect(gen.ok).toBe(true)
      expect(gen.level!.width).toBe(lvl.board.size)
      expect(gen.level!.height).toBe(lvl.board.size)
    }
  })

  it('strictly respects center-first enemy placement (side 0 / TOP)', () => {
    // STORY-001: stage 1 carries the scripted Goblin King cameo on TOP plus the real
    // target on RIGHT; stages 2-3 keep a single TOP enemy.
    const stage1 = campaignRaw.levels[0]
    expect(stage1.encounter.enemies).toBeDefined()
    expect(stage1.encounter.enemies.length).toBe(2)
    expect(stage1.encounter.enemies[0].side).toBe(0)
    expect(stage1.encounter.enemies[1].side).toBe(1)
    for (let i = 1; i < 3; i++) {
      const lvl = campaignRaw.levels[i]
      expect(lvl.encounter.enemies).toBeDefined()
      expect(lvl.encounter.enemies.length).toBe(1)
      expect(lvl.encounter.enemies[0].side).toBe(0)
    }
    const stage4 = campaignRaw.levels[3]
    expect(stage4.encounter.enemies.length).toBe(2)
    expect(stage4.encounter.enemies[0].side).toBe(0)
    expect(stage4.encounter.enemies[1].side).toBe(1)
    const stage5 = campaignRaw.levels[4]
    expect(stage5.encounter.boss).toBeDefined()
    expect(stage5.encounter.boss.phases[0].side).toBe(0)
    expect(stage5.encounter.boss.phases[1].side).toBe(1)
  })

  it('proves clean 0-damage paths exist for every stage', () => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const enc = EncounterState.fromLevel(step.level, step.def, 10, null)
      const minD = minDamageToWin(enc, { nodeBudget: 3000 })
      expect(minD.win).toBe(true)
      expect(minD.minDamage).toBe(0)
      expect(minD.sequence.length).toBeGreaterThan(0)
    }
  })

  it('Stage 4 demonstrates true multi-enemy priority divergence', () => {
    const step4 = steps[3]
    const encOptimal = EncounterState.fromLevel(step4.level, step4.def, 10, null)
    const minDOptimal = minDamageToWin(encOptimal, { nodeBudget: 1000 })
    expect(minDOptimal.win).toBe(true)
    expect(minDOptimal.minDamage).toBe(0)

    const encWrong = EncounterState.fromLevel(step4.level, step4.def, 10, null)
    let freeNorthId = -1
    for (let i = 0; i < step4.level.arrows.length; i++) {
      if (step4.level.arrows[i].dir === 0 && encWrong.board.canExit(i)) {
        freeNorthId = i
        break
      }
    }
    expect(freeNorthId).toBeGreaterThanOrEqual(0)
    encWrong.apply({ kind: 'tap', id: freeNorthId })
    const minDWrong = minDamageToWin(encWrong, { nodeBudget: 1000 })
    expect(minDWrong.minDamage).toBeGreaterThanOrEqual(2)
  })

  it('Stage 5 demonstrates Goblin Shaman CAST interrupt, Rotate usage and +2 win reward', () => {
    const step5 = steps[4]
    const enc = EncounterState.fromLevel(step5.level, step5.def, 10, null)
    expect(enc.def.winRotateReward).toBe(2)
    expect(enc.def.boss!.phases[1].grantRotate).toBe(1)
    expect(enc.def.boss!.phases[1].attackTimer!.kind).toBe('cast')
    expect(enc.def.boss!.phases[1].attackTimer!.interruptible).toBe(true)

    const minD = minDamageToWin(enc, { nodeBudget: 3000 })
    expect(minD.win).toBe(true)
    expect(minD.minDamage).toBe(0)
    const rotateAction = minD.sequence.find((a) => a.kind === 'rotate')
    expect(rotateAction).toBeDefined()

    let sawPhase1 = false
    let sawPhase2 = false
    let sawCastInterrupt = false
    for (const a of minD.sequence) {
      if (enc.phaseIndex === 0) sawPhase1 = true
      if (enc.phaseIndex === 1) sawPhase2 = true
      const res = a.kind === 'tap' ? enc.tap(a.id) : enc.rotate(a.turn)
      if (a.kind === 'tap' && (res as any).castInterrupted) {
        sawCastInterrupt = true
      }
    }
    expect(sawPhase1).toBe(true)
    expect(sawPhase2).toBe(true)
    expect(sawCastInterrupt).toBe(true)
    expect(enc.won).toBe(true)
    // Anti-cheat / regression: must be a genuine boss kill (HP reduced to 0), NOT just board-clear-alive
    expect(enc.hits).toBe(enc.totalHp)
    expect(enc.hp).toBe(0)
    expect(enc.playerHp).toBe(10)
  })

  it('plays the complete 5-stage square prologue end-to-end via RunState with 10/10 HP', () => {
    const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, steps)
    expect(run.stepIndex).toBe(0)
    expect(run.encounter.playerHp).toBe(10)

    for (let i = 0; i < steps.length; i++) {
      const win = minDamageToWin(run.encounter, { nodeBudget: 3000 })
      expect(win.win).toBe(true)
      expect(win.minDamage).toBe(0)
      for (const a of win.sequence) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)
      expect(run.encounter.playerHp).toBe(10)
      if (i < steps.length - 1) {
        const advanced = run.advance()
        expect(advanced).toBe(true)
        expect(run.stepIndex).toBe(i + 1)
      } else {
        expect(run.isLastStep).toBe(true)
      }
    }
    expect(run.encounter.playerHp).toBe(10)
  })
})
