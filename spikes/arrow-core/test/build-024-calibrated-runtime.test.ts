import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  encounterFromJson,
  encounterToJson,
  EncounterState,
  findWin,
  generateLevel,
  levelHash,
  PRESETS,
  type Level,
} from '../src/index.js'
import {
  ARENA_CALIBRATIONS,
  getArenaCalibration,
  resolveArenaPresentation,
} from '../viewer/visual-proto/arena-calibration.js'
// @ts-ignore
import { createBoardRenderer } from '../viewer/visual-proto/board-renderer.js'

const loadJson = (relPath: string) =>
  JSON.parse(readFileSync(new URL(relPath, import.meta.url), 'utf8'))

function makeMockCanvasAndStage(w = 960, h = 540) {
  const canvas = {
    width: w,
    height: h,
    style: { width: `${w}px`, height: `${h}px` },
    getContext: () => ({
      save() {},
      restore() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      ellipse() {},
      stroke() {},
      fill() {},
      fillRect() {},
      clearRect() {},
      strokeRect() {},
      fillText() {},
      measureText: () => ({ width: 10 }),
      drawImage() {},
      setLineDash() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    }),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: w,
      bottom: h,
      width: w,
      height: h,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  } as unknown as HTMLCanvasElement

  const stage = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: w,
      bottom: h,
      width: w,
      height: h,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  } as unknown as HTMLElement

  return { canvas, stage }
}

describe('BUILD-024: resolveArenaPresentation metadata contract', () => {
  it('resolves null when presentation is missing, null, or empty', () => {
    expect(resolveArenaPresentation(null)).toBeNull()
    expect(resolveArenaPresentation(undefined)).toBeNull()
    expect(resolveArenaPresentation({})).toBeNull()
    expect(resolveArenaPresentation({ arena: 'nonexistent-arena' })).toBeNull()
  })

  it('resolves prologue-5x5-good base calibration via arena or calibration field', () => {
    const viaArena = resolveArenaPresentation({ arena: 'prologue-5x5-good' })
    const viaCalib = resolveArenaPresentation({ calibration: 'prologue-5x5-good' })

    expect(viaArena).not.toBeNull()
    expect(viaArena).toEqual(viaCalib)
    expect(viaArena?.id).toBe('prologue-5x5-good')
    expect(viaArena?.boardSizeLocked).toBe(5)
    expect(viaArena?.background).toBe('assets/arenas/prologue-act1/5x5-good.png')
    expect(viaArena?.boardPlaneFrac).toEqual({
      tl: [0.37, 0.45],
      tr: [0.63, 0.45],
      br: [0.655, 0.818],
      bl: [0.348, 0.820],
    })
    expect(viaArena?.anchors).toEqual({
      top: { x: 0.5, y: 0.155 },
      left: { x: 0.17, y: 0.62 },
      right: { x: 0.83, y: 0.62 },
    })
    expect(viaArena?.effectAnchors).toEqual({
      top: { x: 0.5, y: 0.155 },
      left: { x: 0.17, y: 0.62 },
      right: { x: 0.83, y: 0.62 },
    })
    expect(viaArena?.actorScale).toEqual({
      top: 1.0,
      left: 1.0,
      right: 1.0,
    })
  })

  it('resolves boss-shadow-moon calibration accurately', () => {
    const calib = resolveArenaPresentation({ arena: 'boss-shadow-moon' })
    expect(calib?.id).toBe('boss-shadow-moon')
    expect(calib?.boardSizeLocked).toBe(6)
  })
})

describe('BUILD-024: prologue-5x5 production proof encounter', () => {
  const raw = loadJson('../encounters/prologue-5x5.json')

  it('parses correctly with encounterFromJson and validates contract', () => {
    const { file, level } = encounterFromJson(raw)
    expect(file.format).toBe('arrow-core-encounter')
    expect(file.v).toBe(1)
    expect(file.presentation?.arena).toBe('prologue-5x5-good')
    expect(file.encounter.presentation?.arena).toBe('prologue-5x5-good')
    expect(file.encounter.id).toBe('prologue_5x5')
    expect(file.board.preset).toBe('square5')
    expect(level.width).toBe(5)
    expect(level.height).toBe(5)
    expect(levelHash(level)).toBe('4b2681e6')
  })

  it('is fully winnable via clean puzzle sequence', () => {
    const { file, level } = encounterFromJson(raw)
    const state = EncounterState.fromLevel(level, file.encounter)
    const res = findWin(state)
    expect(res.win).toBe(true)
    expect(res.proven).toBe(true)
    expect(res.sequence).toEqual([
      { kind: 'tap', id: 0 },
      { kind: 'tap', id: 3 },
    ])
  })

  it('round-trips through encounterToJson without losing presentation metadata', () => {
    const { file } = encounterFromJson(raw)
    const exported = encounterToJson(file) as typeof raw
    expect(exported.presentation?.arena).toBe('prologue-5x5-good')
    expect(exported.encounter.presentation?.arena).toBe('prologue-5x5-good')
  })
})

describe('BUILD-024: board-renderer calibrated runtime integration', () => {
  const raw = loadJson('../encounters/prologue-5x5.json')
  const { file, level } = encounterFromJson(raw)
  const calib = resolveArenaPresentation(file.encounter.presentation)!

  it('configures board-renderer with calibrated quad and anchors at 960x540', () => {
    const { canvas, stage } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stage)
    const geo = renderer.resize(level, calib)

    expect(geo.calibration).toBe(calib)
    expect(geo.w).toBe(5)
    expect(geo.h).toBe(5)
    expect(geo.fit.boxSide).toBe(1)

    expect(geo.groundOverride[0]).toEqual({ x: 0.5, y: 0.155 })
    expect(geo.groundOverride[1]).toEqual({ x: 0.83, y: 0.62 })
    expect(geo.groundOverride[3]).toEqual({ x: 0.17, y: 0.62 })

    expect(geo.effectGroundOverride[0]).toEqual({ x: 0.5, y: 0.155 })
    expect(geo.effectGroundOverride[1]).toEqual({ x: 0.83, y: 0.62 })
    expect(geo.effectGroundOverride[3]).toEqual({ x: 0.17, y: 0.62 })

    expect(geo.actorScaleOverride[0]).toBe(1.0)
    expect(geo.actorScaleOverride[1]).toBe(1.0)
    expect(geo.actorScaleOverride[3]).toBe(1.0)

    const expectedBaseCell = 540 * (47.2 / 540)
    expect(geo.actorBaseCell).toBeCloseTo(expectedBaseCell, 4)
  })

  it('configures board-renderer with responsive scale at 1920x1080 and 1366x768', () => {
    for (const [w, h] of [[1920, 1080], [1366, 768]] as const) {
      const { canvas, stage } = makeMockCanvasAndStage(w, h)
      const renderer = createBoardRenderer(canvas, stage)
      const geo = renderer.resize(level, calib)

      expect(geo.stageW).toBe(w)
      expect(geo.stageH).toBe(h)
      expect(geo.actorBaseCell).toBeCloseTo(h * (47.2 / 540), 3)

      const plane = renderer.boardPlane()!
      expect(plane.cols).toBe(5)
      expect(plane.rows).toBe(5)
      expect(plane.corners.tl[0]).toBeCloseTo(w * 0.37, 3)
      expect(plane.corners.tl[1]).toBeCloseTo(h * 0.45, 3)
      expect(plane.corners.tr[0]).toBeCloseTo(w * 0.63, 3)
      expect(plane.corners.tr[1]).toBeCloseTo(h * 0.45, 3)
      expect(plane.corners.br[0]).toBeCloseTo(w * 0.655, 3)
      expect(plane.corners.br[1]).toBeCloseTo(h * 0.818, 3)
      expect(plane.corners.bl[0]).toBeCloseTo(w * 0.348, 3)
      expect(plane.corners.bl[1]).toBeCloseTo(h * 0.820, 3)
    }
  })

  it('hitTest maps accurately across the 5x5 calibrated board', () => {
    const { canvas, stage } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stage)
    renderer.resize(level, calib)
    const state = EncounterState.fromLevel(level, file.encounter)

    const a0 = level.arrows[0]
    for (const c of a0.cells) {
      const col = c % 5
      const row = Math.floor(c / 5)
      const p = renderer.projectBoardPoint(col, row, 0)!
      const hit = renderer.hitTest(p.x, p.y, state, level)
      expect(hit).toBe(0)
    }

    const a3 = level.arrows[3]
    for (const c of a3.cells) {
      const col = c % 5
      const row = Math.floor(c / 5)
      const p = renderer.projectBoardPoint(col, row, 0)!
      const hit = renderer.hitTest(p.x, p.y, state, level)
      expect(hit).toBe(3)
    }

    expect(renderer.hitTest(10, 10, state, level)).toBe(-1)
    expect(renderer.hitTest(900, 10, state, level)).toBe(-1)
  })

  it('keeps existing uncalibrated / flexible scenes and rectangular encounters functional', () => {
    const act1Raw = loadJson('../encounters/act1-e1.json')
    const { file: act1File, level: act1Level } = encounterFromJson(act1Raw)
    expect(act1File.encounter.presentation).toBeUndefined()

    const pres = resolveArenaPresentation(act1File.encounter.presentation)
    expect(pres).toBeNull()

    const { canvas, stage } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stage)
    const geo = renderer.resize(act1Level, pres)

    expect(geo.calibration).toBeNull()
    expect(geo.groundOverride).toBeUndefined()
    expect(geo.effectGroundOverride).toBeUndefined()
    expect(geo.actorBaseCell).toBe(geo.cell)
    expect(geo.w).toBe(6)
    expect(geo.h).toBe(7)

    const state = EncounterState.fromLevel(act1Level, act1File.encounter)
    const a0 = act1Level.arrows[0]
    const c0 = a0.cells[0]
    const col = c0 % 6
    const row = Math.floor(c0 / 6)
    const p = renderer.projectBoardPoint(col, row, 0)!
    expect(renderer.hitTest(p.x, p.y, state, act1Level)).toBe(0)
  })
})

