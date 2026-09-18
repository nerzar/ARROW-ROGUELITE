// BUILD-026: Campaign & Level Authoring Tool tests.
// Tests:
//  - Square-only level generation across 5x5..10x10
//  - Center-first slot policy (TOP/0 default, then 1, then 3)
//  - Multi-enemy management, timers, and blockedTapDamage
//  - Step conversion & RunState sequence progression
//  - Presentation & calibration resolution (id and inline object)
//  - Campaign persistence round-trip

import { describe, expect, it } from 'vitest'
import { EncounterState, findWin, RunState } from '../src/index.js'
import {
  createDefaultCampaign,
  createDefaultLevel,
  getNextAvailableSide,
  generateBoardForLevel,
  convertLevelToStep,
  changeLevelArena,
} from '../viewer/visual-proto/campaign-model.js'
import { getArenaCalibration, resolveArenaPresentation } from '../viewer/visual-proto/arena-calibration.js'
import { ARENA_CATALOG, CREATURE_CATALOG, findArena, findCreature } from '../viewer/visual-proto/asset-catalog.js'

describe('BUILD-026: Campaign & Level Authoring Model', () => {
  it('creates a valid default campaign with square-only levels', () => {
    const campaign = createDefaultCampaign()
    expect(campaign.format).toBe('arrow-campaign')
    expect(campaign.v).toBe(1)
    expect(campaign.levels.length).toBeGreaterThanOrEqual(2)

    for (const lvl of campaign.levels) {
      expect(lvl.board.size).toBeGreaterThanOrEqual(5)
      expect(lvl.board.preset).toMatch(/^square-\d+$/)
      // New user decision: square-only levels
      const gen = generateBoardForLevel(lvl)
      expect(gen.ok).toBe(true)
      expect(gen.level!.width).toBe(lvl.board.size)
      expect(gen.level!.height).toBe(lvl.board.size)
    }
  })

  it('enforces center-first slot policy (side 0 is default first slot)', () => {
    // Brand new level must place its first enemy in slot 0 (TOP/center)
    const lvl = createDefaultLevel(1, 5)
    expect(lvl.encounter.enemies).toBeDefined()
    expect(lvl.encounter.enemies!.length).toBe(1)
    expect(lvl.encounter.enemies![0].side).toBe(0)

    // getNextAvailableSide tests
    expect(getNextAvailableSide([])).toBe(0) // empty -> TOP (center-first)
    expect(getNextAvailableSide([{ side: 1 }])).toBe(0) // 1 occupied -> TOP still free
    expect(getNextAvailableSide([{ side: 0 }])).toBe(1) // 0 occupied -> next is RIGHT (1)
    expect(getNextAvailableSide([{ side: 0 }, { side: 1 }])).toBe(3) // 0 and 1 occupied -> next is LEFT (3)
  })

  it('supports square sizes from 5x5 to 10x10 with solvable boards', () => {
    const sizes = [5, 6, 7, 8, 9, 10]
    for (const size of sizes) {
      const lvl = createDefaultLevel(size, size)
      const gen = generateBoardForLevel(lvl)
      expect(gen.ok, `size ${size} should generate ok`).toBe(true)
      expect(gen.level!.width).toBe(size)
      expect(gen.level!.height).toBe(size)

      const step = convertLevelToStep(lvl)
      const enc = EncounterState.fromLevel(step.level, step.def, 10, null)
      const win = findWin(enc, { nodeBudget: 1000 })
      expect(win.win, `size ${size} puzzle must have a valid win sequence`).toBe(true)
      expect(win.sequence.length).toBeGreaterThan(0)
    }
  })

  it('converts an authored level to a playable Step and runs EncounterState', () => {
    const lvl = createDefaultLevel(1, 5)
    lvl.encounter.blockedTapDamage = 1
    lvl.encounter.enemies = [
      { id: 'm_top', species: 'dire-wolf', label: 'Top Wolf', side: 0, hp: 2, attackTimer: { interval: 4, damage: 2 } },
      { id: 'm_right', species: 'dire-wolf', label: 'Right Wolf', side: 1, hp: 1, attackTimer: null },
    ]

    const step = convertLevelToStep(lvl)
    expect(step.id).toBe(lvl.id)
    expect(step.level.width).toBe(5)
    expect(step.def.enemies!.length).toBe(2)
    expect(step.def.blockedTapDamage).toBe(1)

    const encounter = EncounterState.fromLevel(step.level, step.def, 10, null)
    expect(encounter.playerHp).toBe(10)
    expect(encounter.enemies.length).toBe(2)
    expect(encounter.enemies[0].side).toBe(0)
    expect(encounter.enemies[1].side).toBe(1)
  })

  it('plays an authored 2-level sequence through RunState with state carry-over', () => {
    const campaign = createDefaultCampaign()
    const steps = campaign.levels.map(convertLevelToStep)

    const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, steps)
    expect(run.stepIndex).toBe(0)
    expect(run.encounter.playerHp).toBe(10)
    expect(run.isLastStep).toBe(false)

    // Execute winning sequence for step 0
    const win = findWin(run.encounter)
    expect(win.win).toBe(true)
    for (const a of win.sequence) run.encounter.apply(a)
    expect(run.encounter.won).toBe(true)

    // Advance to next level
    const advanced = run.advance()
    expect(advanced).toBe(true)
    expect(run.stepIndex).toBe(1)
    expect(run.encounter.playerHp).toBeGreaterThan(0)
    expect(run.isLastStep).toBe(true)
  })

  it('resolves inline calibration objects as well as calibration IDs', () => {
    // Resolution by id
    const byId = resolveArenaPresentation({ arena: 'prologue-5x5-good' })
    expect(byId).not.toBeNull()
    expect(byId!.id).toBe('prologue-5x5-good')

    // Resolution by inline object (authored level format)
    const customCalib = {
      id: 'custom-stage-1',
      background: 'assets/arenas/prologue-act1/5x5-good.png',
      boardPlaneFrac: { tl: [0.3, 0.4], tr: [0.7, 0.4], br: [0.7, 0.8], bl: [0.3, 0.8] },
      anchors: { top: { x: 0.5, y: 0.4 }, left: { x: 0.2, y: 0.6 }, right: { x: 0.8, y: 0.6 } },
      effectAnchors: { top: { x: 0.5, y: 0.35 }, left: { x: 0.2, y: 0.6 }, right: { x: 0.8, y: 0.6 } },
      actorScale: { top: 0.8, left: 1.0, right: 1.0 },
      spritePivot: { top: { dx: 0, dy: 0 }, left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } },
    }

    const inlineResolved = resolveArenaPresentation({ calibration: customCalib })
    expect(inlineResolved).not.toBeNull()
    expect(inlineResolved!.actorScale!.top).toBe(0.8)
    expect(inlineResolved!.boardPlaneFrac.tl).toEqual([0.3, 0.4])
  })

  it('data-driven catalogs provide valid arena and creature entries', () => {
    expect(ARENA_CATALOG.length).toBeGreaterThanOrEqual(3)
    expect(CREATURE_CATALOG.length).toBeGreaterThanOrEqual(5)

    const wolf = findCreature('dire-wolf')
    expect(wolf.id).toBe('dire-wolf')
    expect(wolf.defaultSide).toBe(0) // center-first!

    const shaman = findCreature('goblin-shaman')
    expect(shaman.kind).toBe('boss')

    const arena = findArena('prologue-5x5-good')
    expect(arena.suggestedSize).toBe(5)
  })

  it('BUILD-028: changing arena immediately resolves that arena baseline calibration without stale geometry', () => {
    const lvl = createDefaultLevel(1, 5)
    lvl.board.seed = 4242
    lvl.encounter.enemies![0].hp = 5

    // Initial arena is prologue-5x5-good
    expect(lvl.presentation.arena).toBe('prologue-5x5-good')
    const base5x5 = getArenaCalibration('prologue-5x5-good')!
    expect(base5x5).not.toBeNull()

    // Switch arena to Ironvow Bastion
    const ironvowCalib = changeLevelArena(lvl, 'ironvow-6x6')
    expect(lvl.presentation.arena).toBe('ironvow-6x6')
    expect(lvl.presentation.background).toBe('assets/arenas/prologue-act1/ironvow-6x6.png')

    const calib = lvl.presentation.calibration as any
    expect(calib).toBeDefined()
    expect(calib.id).toBe('ironvow-6x6')
    // Board plane corners must match Ironvow Bastion, NOT prologue-5x5-good
    expect(calib.boardPlaneFrac.tl).toEqual(ironvowCalib.boardPlaneFrac.tl)
    expect(calib.boardPlaneFrac.tl).not.toEqual(base5x5.boardPlaneFrac.tl)
    expect(calib.anchors.top).toEqual(ironvowCalib.anchors.top)
    expect(calib.actorScale).toEqual(ironvowCalib.actorScale)

    // Gameplay and content fields must remain intact
    expect(lvl.board.seed).toBe(4242)
    expect(lvl.board.size).toBe(5)
    expect(lvl.encounter.enemies![0].hp).toBe(5)

    // Switch arena to Grimskull Throne
    const grimskullCalib = changeLevelArena(lvl, 'grimskull-5x5')
    const calibGrim = lvl.presentation.calibration as any
    expect(calibGrim.id).toBe('grimskull-5x5')
    expect(calibGrim.boardPlaneFrac.tl).toEqual(grimskullCalib.boardPlaneFrac.tl)
    expect(calibGrim.boardPlaneFrac.tl).not.toEqual(ironvowCalib.boardPlaneFrac.tl)

    // User tunes calibration after switching
    calibGrim.actorScale.top = 1.25
    const step = convertLevelToStep(lvl)
    const resolved = resolveArenaPresentation((step as any).presentation)
    expect(resolved).not.toBeNull()
    expect(resolved!.actorScale!.top).toBe(1.25)
    expect(resolved!.id).toBe('grimskull-5x5')

    // 6x6-5 alias resolves to boss-shadow-moon
    const aliasResolved = resolveArenaPresentation({ arena: '6x6-5' })
    expect(aliasResolved).not.toBeNull()
    expect(aliasResolved!.id).toBe('boss-shadow-moon')
  })
})
