import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  EncounterState,
  minDamageToWin,
} from '../src/index.js'

describe('LD-003: Square Encounter Migration Shortlist Candidates', () => {
  const candidates = [
    { file: 'prologue-boss-square-a.json', maxTaps: 14, minDamage: 0 },
    { file: 'prologue-boss-square-b.json', maxTaps: 14, minDamage: 0 },
    { file: 'act1-e1-square-a.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e1-square-b.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e2-square-a.json', maxTaps: 4, minDamage: 0 },
    { file: 'act1-e2-square-b.json', maxTaps: 4, minDamage: 0 },
    { file: 'act1-e3-square-a.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e3-square-b.json', maxTaps: 6, minDamage: 0 },
  ]

  for (const c of candidates) {
    it(`candidate ${c.file} parses, matches hash, and has proven clean path (0 damage)`, () => {
      const path = join(__dirname, '../encounters/migration-candidates', c.file)
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
