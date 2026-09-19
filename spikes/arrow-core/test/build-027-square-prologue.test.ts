// BUILD-027 + ACT-I-002: authored campaign smoke/regression suite.
import { describe, expect, it } from 'vitest'
import { EncounterState, minDamageToWin, RunState } from '../src/index.js'
import { convertLevelToStep, generateBoardForLevel } from '../viewer/visual-proto/campaign-model.js'
import fs from 'fs'

describe('Authored Prologue + Act I campaign', () => {
  const campaignRaw = JSON.parse(fs.readFileSync('campaigns/campaign.json', 'utf8'))
  const prologueRaw = campaignRaw.levels.slice(0, 5)
  const prologueSteps = prologueRaw.map(convertLevelToStep)
  const act1Raw = campaignRaw.levels.filter((l: any) => String(l.id).startsWith('act1-stage-'))

  it('keeps the 5-stage square Prologue and adds 8 Act I playtest stages', () => {
    expect(prologueRaw.map((l: any) => l.id)).toEqual([
      'prologue-stage-1','prologue-stage-2','prologue-stage-3','prologue-stage-4','prologue-stage-5',
    ])
    expect(act1Raw.length).toBe(8)
    for (const lvl of campaignRaw.levels) {
      expect(lvl.board.size).toBeGreaterThanOrEqual(5)
      expect(lvl.board.size).toBeLessThanOrEqual(6)
      const gen = generateBoardForLevel(lvl)
      expect(gen.ok).toBe(true)
      expect(gen.level!.width).toBe(lvl.board.size)
      expect(gen.level!.height).toBe(lvl.board.size)
    }
  })

  it('preserves the user-authored Prologue actor layout', () => {
    const stage1 = prologueRaw[0]
    expect(stage1.encounter.enemies).toBeDefined()
    expect(stage1.encounter.enemies.length).toBe(1)
    expect(stage1.encounter.enemies[0].id).toBe('goblin_king')
    expect(stage1.encounter.enemies[0].side).toBe(0)

    for (let i = 1; i < 3; i++) {
      expect(prologueRaw[i].encounter.enemies.length).toBe(1)
      expect(prologueRaw[i].encounter.enemies[0].side).toBe(0)
    }

    const stage4Sides = prologueRaw[3].encounter.enemies.map((e: any) => e.side).sort()
    expect(stage4Sides).toEqual([0, 1])

    const stage5 = prologueRaw[4]
    expect(stage5.encounter.boss.phases[0].side).toBe(0)
    expect(stage5.encounter.boss.phases[1].side).toBe(1)
  })

  it('keeps clean 0-damage paths for the first four Prologue teaching stages', () => {
    for (let i = 0; i < 4; i++) {
      const enc = EncounterState.fromLevel(prologueSteps[i].level, prologueSteps[i].def, 10, null)
      const minD = minDamageToWin(enc, { nodeBudget: 3000 })
      expect(minD.win).toBe(true)
      expect(minD.minDamage).toBe(0)
    }
  })

  it('Stage 5 teleports into an animated interruptible CAST and is still winnable', () => {
    const step5 = prologueSteps[4]
    const phase2 = step5.def.boss!.phases[1]
    expect(phase2.hpUnits).toBe(3)
    expect(phase2.attackTimer!.kind).toBe('cast')
    expect(phase2.attackTimer!.interruptible).toBe(true)
    expect(step5.def.winRotateReward).toBe(2)

    const enc = EncounterState.fromLevel(step5.level, step5.def, 10, null)
    const win = minDamageToWin(enc, { nodeBudget: 10000 })
    expect(win.win).toBe(true)
  })

  it('Act I content converts to engine steps and contains the intended progression beats', () => {
    const steps = act1Raw.map(convertLevelToStep)
    expect(steps.length).toBe(8)

    const rock = steps.find((s: any) => s.id === 'act1-stage-4')!
    expect(rock.def.enemies.some((e: any) => e.ability?.id === 'stone_throw')).toBe(true)

    const exam = steps.find((s: any) => s.id === 'act1-stage-7')!
    expect(exam.def.enemies.some((e: any) => e.attackTimer?.kind === 'cast')).toBe(true)
    expect(exam.def.enemies.some((e: any) => e.ability?.id === 'stone_throw')).toBe(true)

    const king = steps.find((s: any) => s.id === 'act1-stage-8')!
    expect(king.def.boss!.id).toBe('goblin-king')
    expect(king.def.boss!.phases.length).toBe(2)
  })

  it('plays the 5-stage Prologue end-to-end without requiring Act I to be balance-final', () => {
    const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, prologueSteps)
    for (let i = 0; i < prologueSteps.length; i++) {
      const win = minDamageToWin(run.encounter, { nodeBudget: 10000 })
      expect(win.win).toBe(true)
      for (const a of win.sequence) run.encounter.apply(a)
      expect(run.encounter.won).toBe(true)
      if (i < prologueSteps.length - 1) expect(run.advance()).toBe(true)
    }
  })
})
