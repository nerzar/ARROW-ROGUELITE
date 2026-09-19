import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { abilitiesOf, abilityKind, type EnemyAbility, EncounterState } from '../src/index.js'
import { abilityHud, abilityIntroHint } from '../viewer/visual-proto/ability-hud.js'
import { convertLevelToStep } from '../viewer/visual-proto/campaign-model.js'

/**
 * FIX-034 (reopened with INT-ITEM-001b): "the stone on the Matron level is visible but never
 * blocks an arrow".
 *
 * By the user's decision (2026-09-19) the Matron carries TWO abilities: `heal` and the kids'
 * `kids_rocks` stone throw (`EnemyDef.abilities[]`). So the intro line must promise both HEAL
 * and THROW/PINNED, the HUD must show a chip per ability, and — the original bug report — a
 * thrown stone must really pin an arrow: the pinned arrow is not tappable until the pin expires.
 * The earlier "Matron has no stone" reading was only true for the main that lacked `dcbd231`.
 */
const campaignRaw = JSON.parse(readFileSync('campaigns/campaign.json', 'utf8'))
const matronRaw = campaignRaw.levels.find((l: { encounter?: { id?: string } }) => l.encounter?.id === 'ld7_b8_matron')
const rockRaw = campaignRaw.levels.find((l: { encounter?: { enemies?: { ability?: EnemyAbility }[] } }) =>
  l.encounter?.enemies?.some((e) => e.ability && abilityKind(e.ability) === 'stone_throw'))

describe('FIX-034 / ITEM-001b: Matron heals AND throws stones, and the stone really pins', () => {
  it('Matron data carries heal + stone_throw (kids_rocks)', () => {
    expect(matronRaw).toBeDefined()
    const matron = matronRaw.encounter.enemies.find((e: { species?: string }) => e.species === 'goblin-matron')
    expect(matron).toBeDefined()
    expect(abilitiesOf(matron).map(abilityKind)).toEqual(['heal', 'stone_throw'])
  })

  it('a thrown stone pins a free arrow, and the pinned arrow cannot be tapped until the pin expires', () => {
    const step = convertLevelToStep(matronRaw)
    const s = EncounterState.fromLevel(step.level, step.def, 10)
    const matronIdx = step.def.enemies!.findIndex((e) => e.id === 'matron_n')
    const throwIn = () => s.enemies[matronIdx].abilities.find((a) => a.kind === 'stone_throw')!.countdown
    expect(throwIn()).toBe(3)
    // Take world turns with arrows that miss the Matron (any direction is fine: the stone comes on
    // her own timer) until a stone lands. Guard against the level ending first.
    let pinned: { id: number; turnsLeft: number }[] = []
    for (let guard = 0; guard < 6 && pinned.length === 0 && !s.over; guard++) {
      const id = s.playableArrows().find((a) => s.arenaDir(a) !== s.enemies[matronIdx].side) ?? s.playableArrows()[0]
      const r = s.tap(id)
      expect(r.ok).toBe(true)
      if (r.ok && r.pinnedThisTurn?.length) pinned = r.pinnedThisTurn
    }
    expect(pinned.length).toBe(1)
    const victim = pinned[0].id
    expect(s.isPinned(victim)).toBe(true)
    expect(s.pinnedArrows).toEqual([{ id: victim, turnsLeft: 2 }])
    expect(s.playableArrows()).not.toContain(victim)
    // The original bug: the pinned arrow must NOT be releasable.
    const blocked = s.tap(victim)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe('pinned')
    expect(s.isPinned(victim)).toBe(true)
  })

  it('intro hint promises both HEAL and THROW/PINNED for the Matron, only HEAL for a heal-only healer', () => {
    const matron = matronRaw.encounter.enemies.find((e: { species?: string }) => e.species === 'goblin-matron')
    const hint = abilityIntroHint(abilitiesOf(matron).map((a) => a.kind))
    expect(hint).toContain('HEAL')
    expect(hint).toContain('PINNED')
    expect(abilityIntroHint(['heal'])).not.toContain('PINNED')
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
