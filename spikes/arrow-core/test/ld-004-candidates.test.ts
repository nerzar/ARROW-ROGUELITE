import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  EncounterState,
  minDamageToWin,
} from '../src/index.js'

describe('LD-004: Act I Encounters 4–8 Square Pack Candidates', () => {
  const candidates = [
    { file: 'act1-e4-square-a.json', maxTaps: 4, minDamage: 0 },
    { file: 'act1-e4-square-b.json', maxTaps: 4, minDamage: 0 },
    { file: 'act1-e5-square-a.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e5-square-b.json', maxTaps: 4, minDamage: 0 },
    { file: 'act1-e6-square-a.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e6-square-b.json', maxTaps: 5, minDamage: 0 },
    { file: 'act1-e7-square-a.json', maxTaps: 7, minDamage: 0 },
    { file: 'act1-e7-square-b.json', maxTaps: 7, minDamage: 0 },
    { file: 'act1-e8-square-a.json', maxTaps: 6, minDamage: 0 },
    { file: 'act1-e8-square-b.json', maxTaps: 6, minDamage: 0 },
  ]

  for (const c of candidates) {
    it(`candidate ${c.file} parses, matches hash, and has proven clean path (0 damage)`, () => {
      const path = join(__dirname, '../encounters/act1-square-pack', c.file)
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      const { file, level } = encounterFromJson(raw)
      expect(level).toBeDefined()
      expect(level.width).toBe(level.height) // Must be strictly square!

      // Verify clean path without Rotate (Rotate x0)
      const stateNoRot = EncounterState.fromLevel(level, { ...file.encounter, rotate: { allow: [] } }, 10)
      const res = minDamageToWin(stateNoRot, { nodeBudget: 500000 })
      expect(res.win).toBe(true)
      expect(res.minDamage).toBe(c.minDamage)
      expect(res.sequence.length).toBeLessThanOrEqual(c.maxTaps)
    })
  }
})
