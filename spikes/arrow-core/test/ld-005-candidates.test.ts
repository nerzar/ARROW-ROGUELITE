import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  EncounterState,
  minDamageToWin,
} from '../src/index.js'

describe('LD-005: Prologue 5x5 Pack Shortlist Candidates', () => {
  const candidates = [
    { file: 'prologue-e1-candidate-a.json', maxTaps: 2, minDamage: 0 },
    { file: 'prologue-e1-candidate-b.json', maxTaps: 2, minDamage: 0 },
    { file: 'prologue-e2-candidate-a.json', maxTaps: 3, minDamage: 0 },
    { file: 'prologue-e2-candidate-b.json', maxTaps: 3, minDamage: 0 },
    { file: 'prologue-e3-candidate-a.json', maxTaps: 4, minDamage: 0 },
    { file: 'prologue-e3-candidate-b.json', maxTaps: 4, minDamage: 0 },
    { file: 'prologue-e4-candidate-a.json', maxTaps: 4, minDamage: 0 },
    { file: 'prologue-e4-candidate-b.json', maxTaps: 4, minDamage: 0 },
    { file: 'prologue-boss-candidate-a.json', maxTaps: 12, minDamage: 0 },
    { file: 'prologue-boss-candidate-b.json', maxTaps: 12, minDamage: 0 },
    { file: 'prologue-boss-candidate-7x7.json', maxTaps: 14, minDamage: 0 },
  ]

  for (const c of candidates) {
    it(`candidate ${c.file} parses, matches hash, and has proven clean path (0 damage)`, () => {
      const path = join(__dirname, '../encounters/prologue-5x5-candidates', c.file)
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      const { file, level } = encounterFromJson(raw)
      expect(level).toBeDefined()
      expect(level.width).toBe(level.height) // Must be square!

      const state = EncounterState.fromLevel(level, file.encounter, 10)
      const res = minDamageToWin(state, { nodeBudget: 500000 })
      expect(res.win).toBe(true)
      expect(res.minDamage).toBe(c.minDamage)
      expect(res.sequence.length).toBeLessThanOrEqual(c.maxTaps)
    })
  }
})
