import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { abilityKind, type EnemyAbility, EncounterState, findWin } from '../src/index.js'
import { abilityHud, abilityIntroHint } from '../viewer/visual-proto/ability-hud.js'
import { convertLevelToStep } from '../viewer/visual-proto/campaign-model.js'

/**
 * FIX-034: "the stone on the Matron level is visible but never blocks an arrow".
 *
 * Diagnosis: presentation desync, not a state bug. The Matron carries a `heal` ability, yet
 * app.js's encounter-intro line announced every ability (including heal/shift) as "THROW IN N
 * ... PINNED" -- so a stone that never existed "failed" to block. board-renderer.js's own
 * plate-line/chip/card drawing already differentiates heal/shift/shield/stone_throw (PRESENT-001);
 * only the intro line was still stuck on the old blanket THROW/PINNED text. The engine never pins
 * anything on the Matron level; Stone Throw encounters keep pinning as before.
 */
const campaignRaw = JSON.parse(readFileSync('campaigns/campaign.json', 'utf8'))
const matronRaw = campaignRaw.levels.find((l: { encounter?: { id?: string } }) => l.encounter?.id === 'ld7_b8_matron')
const rockRaw = campaignRaw.levels.find((l: { encounter?: { enemies?: { ability?: EnemyAbility }[] } }) =>
  l.encounter?.enemies?.some((e) => e.ability && abilityKind(e.ability) === 'stone_throw'))

describe('FIX-034: Matron encounter has no Stone Pin -- state and intro text agree', () => {
  it('Matron data carries heal, not stone_throw', () => {
    expect(matronRaw).toBeDefined()
    const kinds = matronRaw.encounter.enemies.filter((e: { ability?: unknown }) => e.ability).map((e: { ability: EnemyAbility }) => abilityKind(e.ability))
    expect(kinds).toEqual(['heal'])
  })

  it('playing the Matron level never pins an arrow (every free arrow stays tappable)', () => {
    const step = convertLevelToStep(matronRaw)
    const s = EncounterState.fromLevel(step.level, step.def, 10)
    const plan = findWin(s)
    expect(plan.win).toBe(true)
    for (const a of plan.sequence) {
      expect(s.pinnedArrows).toEqual([])
      if (a.kind === 'rotate') { s.rotate(a.turn); continue }
      if (a.kind !== 'tap') continue
      expect(s.isPinned(a.id)).toBe(false)
      const r = s.tap(a.id)
      if (r.ok) expect(r.pinnedThisTurn ?? []).toEqual([])
      else expect(r.reason).not.toBe('pinned')
    }
    expect(s.won).toBe(true)
  })

  it('intro hint never mentions THROW/PINNED for a heal-only encounter', () => {
    expect(abilityIntroHint(['heal'])).not.toContain('PINNED')
    expect(abilityIntroHint(['heal'])).toContain('HEAL')
    expect(abilityIntroHint(['shift'])).not.toContain('PINNED')
  })

  it('a real Stone Throw encounter still reads as THROW / rock / PINNED', () => {
    expect(rockRaw).toBeDefined()
    const chip = abilityHud('stone_throw', 3)
    expect(chip).toMatchObject({ kind: 'stone_throw', icon: '🪨', word: 'THROW', value: '3' })
    expect(abilityHud(undefined, 3).kind).toBe('stone_throw') // kind-less = stone_throw, like the engine
    expect(abilityIntroHint(['stone_throw'])).toContain('PINNED')
    expect(abilityHud('shield', 1, true)).toMatchObject({ icon: '🛡', word: 'SHIELD', value: 'UP' })
  })
})
