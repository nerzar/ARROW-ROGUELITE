import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  EncounterState,
  findWin,
  minDamageToWin,
  RunState,
  type RunStep,
} from '../src/index.js'
import {
  ARENA_CALIBRATIONS,
  clearArenaCalibrationOverride,
  getArenaCalibration,
  hasArenaCalibrationOverride,
  resolveArenaPresentation,
  saveArenaCalibrationOverride,
} from '../viewer/visual-proto/arena-calibration.js'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../encounters/${name}`, import.meta.url), 'utf8'))

describe('BUILD-025: Unified Prologue Playtest Flow', () => {
  const e1Raw = load('prologue-5x5.json')
  const e2Raw = load('cp-e2.json')
  const e3Raw = load('cp-e3.json')
  const e4Raw = load('cp-e4.json')
  const e5Raw = load('cp-e5.json')

  const parsed1 = encounterFromJson(e1Raw)
  const parsed2 = encounterFromJson(e2Raw)
  const parsed3 = encounterFromJson(e3Raw)
  const parsed4 = encounterFromJson(e4Raw)
  const parsed5 = encounterFromJson(e5Raw)

  const steps: RunStep[] = [
    { id: 'prologue-5x5', title: 'Пролог 1 · 5x5 Чистый выстрел', level: parsed1.level, def: parsed1.file.encounter },
    { id: 'cp-e2', title: 'Пролог 2 · Ошибка стоит HP', level: parsed2.level, def: parsed2.file.encounter },
    { id: 'cp-e3', title: 'Пролог 3 · Время имеет цену', level: parsed3.level, def: parsed3.file.encounter },
    { id: 'cp-e4', title: 'Пролог 4 · Два врага одновременно', level: parsed4.level, def: parsed4.file.encounter },
    { id: 'cp-e5', title: 'Пролог 5 · Goblin Shaman', level: parsed5.level, def: parsed5.file.encounter },
  ]

  describe('1. Encounter specifications & canon validation', () => {
    it('Step 1 (prologue-5x5): 5x5 board, calibrated presentation, 1 HP N target, 0 blockedTapDamage', () => {
      expect(parsed1.level.width).toBe(5)
      expect(parsed1.level.height).toBe(5)
      expect(parsed1.file.presentation?.calibration).toBe('prologue-5x5-good')
      expect(parsed1.file.encounter.blockedTapDamage).toBe(0)
      expect(parsed1.file.encounter.rotate.allow).toEqual([])
      expect(parsed1.file.encounter.boss?.phases[0].hpUnits).toBe(1)
      expect(parsed1.file.encounter.boss?.phases[0].side).toBe(0) // North
    })

    it('Step 2 (cp-e2): 4x5 board, 2 HP E target, introduces blockedTapDamage 1', () => {
      expect(parsed2.level.width).toBe(4)
      expect(parsed2.level.height).toBe(5)
      expect(parsed2.file.encounter.blockedTapDamage).toBe(1)
      expect(parsed2.file.encounter.rotate.allow).toEqual([])
      expect(parsed2.file.encounter.boss?.phases[0].hpUnits).toBe(2)
      expect(parsed2.file.encounter.boss?.phases[0].side).toBe(1) // East
    })

    it('Step 3 (cp-e3): 6x7 board, 3 HP E target, ATTACK IN 4 timer with 2 dmg', () => {
      expect(parsed3.level.width).toBe(6)
      expect(parsed3.level.height).toBe(7)
      expect(parsed3.file.encounter.blockedTapDamage).toBe(1)
      expect(parsed3.file.encounter.boss?.phases[0].hpUnits).toBe(3)
      expect(parsed3.file.encounter.boss?.phases[0].attackTimer).toMatchObject({ interval: 4, damage: 2 })
    })

    it('Step 4 (cp-e4): 6x7 board, two simultaneous enemies (urgent East vs slow North)', () => {
      expect(parsed4.level.width).toBe(6)
      expect(parsed4.level.height).toBe(7)
      expect(parsed4.file.encounter.enemies).toHaveLength(2)
      const [eEast, eNorth] = parsed4.file.encounter.enemies!
      expect(eEast).toMatchObject({ id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 } })
      expect(eNorth).toMatchObject({ id: 'grunt_n', side: 0, hp: 2, attackTimer: { interval: 5, damage: 2 } })
      expect(parsed4.file.encounter.rotate.allow).toEqual([])
    })

    it('Step 5 (cp-e5): 8x10 board, Goblin Shaman boss with Phase 1 -> Phase 2 CAST and +2 win reward', () => {
      expect(parsed5.level.width).toBe(8)
      expect(parsed5.level.height).toBe(10)
      expect(parsed5.file.encounter.boss?.phases).toHaveLength(2)
      const [p1, p2] = parsed5.file.encounter.boss!.phases
      expect(p1).toMatchObject({ side: 1, hpUnits: 4, attackTimer: { interval: 6, damage: 1 } })
      expect(p2).toMatchObject({
        side: 0,
        hpUnits: 5,
        grantRotate: 1,
        attackTimer: {
          interval: 3,
          damage: 1,
          kind: 'cast',
          interruptible: true,
          interruptedAttack: { interval: 4, damage: 1, kind: 'normal' },
        },
      })
      expect(parsed5.file.encounter.rotate.allow).toEqual([1, -1])
      expect(parsed5.file.encounter.winRotateReward).toBe(2)
    })
  })

  describe('2. End-to-end Prologue playthrough via RunState', () => {
    it('plays from Step 1 to Step 5 to completion without death', () => {
      const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, steps)
      expect(run.stepIndex).toBe(0)
      expect(run.rotateCharges).toBe(0)
      expect(run.isFirstStep).toBe(true)

      // Step 1: prologue-5x5 (Arrow 0 East peeling move -> Arrow 3 North kills 1 HP mob)
      const s1 = run.encounter
      const r1a = s1.tap(0)
      expect(r1a.ok).toBe(true)
      expect((r1a as any).hit).toBe(false)
      const r1b = s1.tap(3)
      expect(r1b.ok).toBe(true)
      expect((r1b as any).hit).toBe(true)
      expect(s1.won).toBe(true)
      expect(s1.playerHp).toBe(10)

      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(1)
      expect(run.currentStep.id).toBe('cp-e2')

      // Step 2: cp-e2 (Arrow 1 -> Arrow 0 -> Arrow 2 -> Arrow 3)
      const s2 = run.encounter
      s2.tap(1)
      s2.tap(0)
      s2.tap(2)
      const r2Last = s2.tap(3)
      expect((r2Last as any).won).toBe(true)
      expect(s2.won).toBe(true)
      expect(s2.playerHp).toBe(10)

      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(2)
      expect(run.currentStep.id).toBe('cp-e3')

      // Step 3: cp-e3 (findWin provides winning sequence)
      const s3 = run.encounter
      const win3 = findWin(s3, { nodeBudget: 100_000 })
      expect(win3.win).toBe(true)
      for (const act of win3.sequence) {
        if (act.kind === 'tap') s3.tap(act.id)
      }
      expect(s3.won).toBe(true)
      expect(s3.playerHp).toBe(10)

      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(3)
      expect(run.currentStep.id).toBe('cp-e4')

      // Step 4: cp-e4 (priority: 0 East -> 3 North -> 2 East kills grunt_e -> 5 North kills grunt_n)
      const s4 = run.encounter
      s4.tap(0)
      s4.tap(3)
      s4.tap(2)
      s4.tap(5)
      expect(s4.won).toBe(true)
      expect(s4.playerHp).toBe(10)

      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(4)
      expect(run.isLastStep).toBe(true)
      expect(run.currentStep.id).toBe('cp-e5')

      // Step 5: cp-e5 (Shaman boss: Phase 1 East -> Phase 2 North with CAST interrupt)
      const s5 = run.encounter
      // Complete Phase 1 (East 4 HP)
      while (s5.phaseIndex === 0 && !s5.over) {
        const free = s5.board.freeArrows()
        const aim = free.find((id) => s5.wouldHit(id)) ?? free[0]
        s5.tap(aim)
      }
      expect(s5.phaseIndex).toBe(1)
      expect(s5.rotateCharges).toBe(1) // +1 granted by phase 2
      expect(s5.attackKind).toBe('cast') // enters CAST

      // Rotate CCW to bring North-pointing arrows to bear
      s5.rotate(-1)
      const freeP2 = s5.board.freeArrows()
      const hitCast = freeP2.find((id) => s5.wouldHit(id))!
      const castTapRes = s5.tap(hitCast)
      expect(castTapRes.ok).toBe(true)
      expect((castTapRes as any).castInterrupted).toBe(true)
      expect(s5.attackKind).toBe('normal') // switched to normal attack after interrupt

      // Finish remaining hits to kill boss
      while (!s5.over) {
        const free = s5.board.freeArrows()
        if (free.length === 0) break
        const nextTap = free.find((id) => s5.wouldHit(id)) ?? free[0]
        s5.tap(nextTap)
      }
      expect(s5.won).toBe(true)
      expect(run.runWon).toBe(true)

      // Claim winRotateReward
      expect(run.isLastStep).toBe(true)
      expect(run.advance()).toBe(false)
      expect(run.currentStep.def.winRotateReward).toBe(2)
    })
  })

  describe('3. Restarts & state isolation', () => {
    it('restartStep resets HP and Rotate charges to entry snapshot', () => {
      const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, steps)
      run.debugJumpTo(1, 0) // jump to cp-e2
      expect(run.encounter.playerHp).toBe(10)

      // Make a mistake on blocked arrow
      const res = run.encounter.tap(3) // arrow 3 is blocked in cp-e2
      expect(res.ok).toBe(false)
      expect((res as any).damage).toBe(1)
      expect(run.encounter.playerHp).toBe(9)

      // Restart step resets HP back to entry (10)
      run.restartStep()
      expect(run.encounter.playerHp).toBe(10)
      expect(run.stepIndex).toBe(1)
    })

    it('restartRun resets to step 0 with full HP and initial pool', () => {
      const run = new RunState({ playerMaxHp: 10, initialRotateCharges: 0 }, steps)
      run.debugJumpTo(3, 0)
      expect(run.stepIndex).toBe(3)

      run.restartRun()
      expect(run.stepIndex).toBe(0)
      expect(run.currentStep.id).toBe('prologue-5x5')
      expect(run.encounter.playerHp).toBe(10)
      expect(run.rotateCharges).toBe(0)
    })
  })

  describe('4. Stone Pin and Blocked Tap Combat Rules Preservation', () => {
    it('Stone Pin tap causes no HP damage and does not advance world turn', () => {
      const rockRaw = load('rock-spike.json')
      const parsedRock = encounterFromJson(rockRaw)
      const s = EncounterState.fromLevel(parsedRock.level, parsedRock.file.encounter, 10)

      // Advance 3 turns so enemy ability Stone Throw triggers
      const free = s.board.freeArrows()
      s.tap(free[0])
      const free2 = s.board.freeArrows()
      s.tap(free2[0])
      const free3 = s.board.freeArrows()
      const r3 = s.tap(free3[0])
      expect(r3.ok).toBe(true)
      expect((r3 as any).pinnedThisTurn?.length).toBeGreaterThan(0)

      const pinnedId = (r3 as any).pinnedThisTurn[0].id
      const hpBefore = s.playerHp
      const actionsBefore = s.actions.length

      // Tapping the pinned arrow
      const pinTapRes = s.tap(pinnedId)
      expect(pinTapRes.ok).toBe(false)
      expect((pinTapRes as any).reason).toBe('pinned')
      expect(s.playerHp).toBe(hpBefore) // 0 HP damage
      expect(s.actions.length).toBe(actionsBefore) // 0 actions logged / no turn taken
    })

    it('Blocked tap in E1 (prologue-5x5) deals 0 damage per tutorial contract', () => {
      const s1 = EncounterState.fromLevel(parsed1.level, parsed1.file.encounter, 10)
      const rBlocked = s1.tap(3) // arrow 3 is blocked by arrow 0 at start
      expect(rBlocked.ok).toBe(false)
      expect((rBlocked as any).reason).toBe('blocked')
      expect((rBlocked as any).damage).toBe(0)
      expect(s1.playerHp).toBe(10)
    })

    it('Blocked tap in E2 (cp-e2) deals 1 damage but does not advance countdown', () => {
      const s2 = EncounterState.fromLevel(parsed2.level, parsed2.file.encounter, 10)
      const rBlocked = s2.tap(3) // arrow 3 is blocked at start
      expect(rBlocked.ok).toBe(false)
      expect((rBlocked as any).reason).toBe('blocked')
      expect((rBlocked as any).damage).toBe(1)
      expect(s2.playerHp).toBe(9)
    })
  })

  describe('5. Presentation & calibration resolution', () => {
    // CAL-004: every canon Prologue step now carries its own independent presentation/calibration
    // (previously only Step 1 did; Steps 2-5 resolved to null and fell back to the shared flexible
    // default -- see arena-calibration.js's CAL-004 comment on the new entries).
    it('resolves an independent calibration for every Prologue step', () => {
      const pres1 = resolveArenaPresentation(parsed1.file.presentation)
      expect(pres1).not.toBeNull()
      expect(pres1?.id).toBe('prologue-5x5-good')
      expect(pres1?.boardSizeLocked).toBe(5)

      const pres2 = resolveArenaPresentation(parsed2.file.presentation)
      expect(pres2).not.toBeNull()
      expect(pres2?.id).toBe('prologue-2')

      const pres3 = resolveArenaPresentation(parsed3.file.presentation)
      expect(pres3).not.toBeNull()
      expect(pres3?.id).toBe('prologue-3')

      const pres4 = resolveArenaPresentation(parsed4.file.presentation)
      expect(pres4).not.toBeNull()
      expect(pres4?.id).toBe('prologue-4')

      const pres5 = resolveArenaPresentation(parsed5.file.presentation)
      expect(pres5).not.toBeNull()
      expect(pres5?.id).toBe('prologue-5')

      // Every step's calibration id is distinct -- a browser override or hand-tune of one must
      // never bleed into another (this task's core requirement).
      const ids = [pres1, pres2, pres3, pres4, pres5].map((p) => p!.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('localStorage calibration override helper functions properly', () => {
      const id = 'prologue-5x5-good'
      const base = getArenaCalibration(id)
      expect(base).not.toBeNull()

      // Mock localStorage
      const storage: Record<string, string> = {}
      const mockStorage = {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v },
        removeItem: (k: string) => { delete storage[k] },
      }
      const globalAny = globalThis as any
      const origStorage = globalAny.localStorage
      globalAny.localStorage = mockStorage

      try {
        expect(hasArenaCalibrationOverride(id)).toBe(false)

        // Save override
        const override = {
          actorScale: { top: 1.35, left: 1.25, right: 1.25 },
        }
        expect(saveArenaCalibrationOverride(id, override)).toBe(true)
        expect(hasArenaCalibrationOverride(id)).toBe(true)

        // getArenaCalibration reflects override
        const loaded = getArenaCalibration(id)
        expect(loaded?.actorScale?.top).toBe(1.35)
        expect(loaded?.actorScale?.left).toBe(1.25)
        // Original quad is preserved
        expect(loaded?.boardPlaneFrac).toEqual(base?.boardPlaneFrac)

        // Clear override
        expect(clearArenaCalibrationOverride(id)).toBe(true)
        expect(hasArenaCalibrationOverride(id)).toBe(false)
        const reverted = getArenaCalibration(id)
        // PLAYTEST-002: code default is 0.55, not 1.0 -- see arena-calibration.js's own comment on
        // prologue-5x5-good's actorScale.top (a full-size boss clipped the fixed topbar at 1.0).
        expect(reverted?.actorScale?.top).toBe(0.55)
      } finally {
        globalAny.localStorage = origStorage
      }
    })
  })
})
