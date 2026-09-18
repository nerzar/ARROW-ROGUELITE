import { describe, expect, it } from 'vitest'
import {
  ARENA_CALIBRATIONS,
  getArenaCalibration,
  type ArenaCalibration,
} from '../viewer/visual-proto/arena-calibration.js'
import {
  ACTOR_BASE_CELL_FRAC,
  BOSS_CHAR,
  SIDE_CHAR,
  groundPoint,
} from '../viewer/visual-proto/arena-layout.js'
// @ts-ignore
import { createBoardRenderer } from '../viewer/visual-proto/board-renderer.js'
import { generateLevel, PRESETS, EncounterState, type EncounterDef, N, E, W } from '../src/index.js'

function makeMockCanvasAndStage(stageW = 960, stageH = 540) {
  const baseTarget: any = {
    measureText: (t: string) => ({ width: t.length * 7 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    // VIS-016: the arrow renderer's 'bevel' fill material shades the body with a linear gradient.
    createLinearGradient: () => ({ addColorStop() {} }),
  }
  const dummyCtx: any = new Proxy(baseTarget, {
    get(target, prop) {
      if (prop in target) return target[prop]
      return () => {}
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  })
  const canvas: any = {
    width: stageW,
    height: stageH,
    style: {},
    getContext: () => dummyCtx,
  }
  const stageEl: any = {
    getBoundingClientRect: () => ({
      width: stageW,
      height: stageH,
      top: 0,
      left: 0,
      right: stageW,
      bottom: stageH,
    }),
  }
  return { canvas, stageEl, dummyCtx }
}

const PREVIEW_DEF: EncounterDef = {
  id: 'cal-002-test',
  enemies: [
    { id: 'top_mob', side: N, hp: 1, mandatory: false, label: 'TOP' },
    { id: 'right_mob', side: E, hp: 1, mandatory: false, label: 'RIGHT' },
    { id: 'left_mob', side: W, hp: 1, mandatory: false, label: 'LEFT' },
  ],
  rotate: { allow: [] },
  blockedTapDamage: 0,
}

function makeLevel(size: number) {
  for (let seed = 1; seed <= 10; seed++) {
    const gen = generateLevel(
      { ...PRESETS.medium, width: size, height: size, minArrows: Math.max(4, Math.round(size * size * 0.12)) },
      seed,
    )
    if (gen.ok && gen.level) return gen.level
  }
  throw new Error(`could not generate level of size ${size}`)
}

describe('CAL-002 arena calibration metadata', () => {
  // PLAYTEST-002: top is no longer 1.0 on either arena -- a full-size boss on the N podium
  // clipped the fixed topbar at that scale (reported in playtest, fixed in the browser and
  // verified via visualDebug.layout()); see arena-calibration.js's own comment on `anchors.top`.
  it('prologue-5x5-good and boss-shadow-moon have actorScale.top reduced to fit the boss under the topbar, left/right left at 1.0', () => {
    const p = ARENA_CALIBRATIONS['prologue-5x5-good']
    expect(p).toBeDefined()
    expect(p.actorScale).toEqual({ top: 0.55, left: 1.0, right: 1.0 })

    const b = ARENA_CALIBRATIONS['boss-shadow-moon']
    expect(b).toBeDefined()
    expect(b.actorScale).toEqual({ top: 0.55, left: 1.0, right: 1.0 })
  })

  it('getArenaCalibration provides backward-compatible defaults when actorScale is omitted', () => {
    const fakeCalib: any = {
      id: 'fake',
      background: 'fake.png',
      boardSizeLocked: 5,
      boardPlaneFrac: { tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] },
      anchors: { top: { x: 0.5, y: 0.1 }, left: { x: 0.1, y: 0.5 }, right: { x: 0.9, y: 0.5 } },
      effectAnchors: { top: { x: 0.5, y: 0.1 }, left: { x: 0.1, y: 0.5 }, right: { x: 0.9, y: 0.5 } },
    }
    ARENA_CALIBRATIONS['fake'] = fakeCalib
    try {
      const retrieved = getArenaCalibration('fake')
      expect(retrieved).not.toBeNull()
      expect(retrieved!.actorScale).toEqual({ top: 1.0, left: 1.0, right: 1.0 })
    } finally {
      delete ARENA_CALIBRATIONS['fake']
    }
  })

  it('ACTOR_BASE_CELL_FRAC matches the approved prologue-5x5-good base ratio', () => {
    expect(ACTOR_BASE_CELL_FRAC).toBeCloseTo(47.2 / 540, 6)
  })
})

describe('CAL-002 independent actor scale in board-renderer', () => {
  it('actor pixel footprint remains identical across 5x5, 6x6, 8x8, 10x10 grids', () => {
    const { canvas, stageEl } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stageEl)
    const calib = getArenaCalibration('prologue-5x5-good')!

    const sizes = [5, 6, 8, 10]
    const snapshots: Record<number, { top: any; left: any; right: any }> = {}

    for (const n of sizes) {
      const level = makeLevel(n)
      const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)
      renderer.resize(level, calib)
      renderer.frame(0, {
        s,
        def: PREVIEW_DEF,
        level,
        assets: {},
        hint: null,
        boss: null,
        debug: false,
      })
      const layout = renderer.debugLayout()
      const top = layout.find((e: any) => e.side === 0)!.char
      const right = layout.find((e: any) => e.side === 1)!.char
      const left = layout.find((e: any) => e.side === 3)!.char
      snapshots[n] = { top, left, right }
    }

    const base = snapshots[5]
    for (const n of [6, 8, 10]) {
      const cur = snapshots[n]
      expect(cur.top.w).toBeCloseTo(base.top.w, 4)
      expect(cur.top.h).toBeCloseTo(base.top.h, 4)

      expect(cur.left.w).toBeCloseTo(base.left.w, 4)
      expect(cur.left.h).toBeCloseTo(base.left.h, 4)

      expect(cur.right.w).toBeCloseTo(base.right.w, 4)
      expect(cur.right.h).toBeCloseTo(base.right.h, 4)
    }
  })

  it('changing LEFT scale only affects LEFT actor; TOP and RIGHT remain untouched', () => {
    const { canvas, stageEl } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stageEl)
    const baseCalib = getArenaCalibration('prologue-5x5-good')!
    const level = makeLevel(5)
    const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)

    renderer.resize(level, baseCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const baseLayout = renderer.debugLayout()
    const baseTop = baseLayout.find((e: any) => e.side === 0)!.char
    const baseRight = baseLayout.find((e: any) => e.side === 1)!.char
    const baseLeft = baseLayout.find((e: any) => e.side === 3)!.char

    // PLAYTEST-002: spread baseCalib.actorScale first (top is no longer 1.0 -- see that
    // calibration's own comment) so this override only touches `left`, matching the test's intent.
    const modifiedCalib: ArenaCalibration = {
      ...baseCalib,
      actorScale: { ...baseCalib.actorScale!, left: 1.4 },
    }
    renderer.resize(level, modifiedCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const modLayout = renderer.debugLayout()
    const modTop = modLayout.find((e: any) => e.side === 0)!.char
    const modRight = modLayout.find((e: any) => e.side === 1)!.char
    const modLeft = modLayout.find((e: any) => e.side === 3)!.char

    expect(modLeft.w).toBeCloseTo(baseLeft.w * 1.4, 4)
    expect(modLeft.h).toBeCloseTo(baseLeft.h * 1.4, 4)

    expect(modTop.w).toBeCloseTo(baseTop.w, 4)
    expect(modTop.h).toBeCloseTo(baseTop.h, 4)
    expect(modRight.w).toBeCloseTo(baseRight.w, 4)
    expect(modRight.h).toBeCloseTo(baseRight.h, 4)
  })

  it('changing RIGHT scale only affects RIGHT actor; TOP and LEFT remain untouched', () => {
    const { canvas, stageEl } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stageEl)
    const baseCalib = getArenaCalibration('prologue-5x5-good')!
    const level = makeLevel(5)
    const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)

    renderer.resize(level, baseCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const baseLayout = renderer.debugLayout()
    const baseTop = baseLayout.find((e: any) => e.side === 0)!.char
    const baseRight = baseLayout.find((e: any) => e.side === 1)!.char
    const baseLeft = baseLayout.find((e: any) => e.side === 3)!.char

    // PLAYTEST-002: same fix as the LEFT-scale test above -- preserve base top/left, only override right.
    const modifiedCalib: ArenaCalibration = {
      ...baseCalib,
      actorScale: { ...baseCalib.actorScale!, right: 0.75 },
    }
    renderer.resize(level, modifiedCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const modLayout = renderer.debugLayout()
    const modTop = modLayout.find((e: any) => e.side === 0)!.char
    const modRight = modLayout.find((e: any) => e.side === 1)!.char
    const modLeft = modLayout.find((e: any) => e.side === 3)!.char

    expect(modRight.w).toBeCloseTo(baseRight.w * 0.75, 4)
    expect(modRight.h).toBeCloseTo(baseRight.h * 0.75, 4)
    expect(modTop.w).toBeCloseTo(baseTop.w, 4)
    expect(modTop.h).toBeCloseTo(baseTop.h, 4)
    expect(modLeft.w).toBeCloseTo(baseLeft.w, 4)
    expect(modLeft.h).toBeCloseTo(baseLeft.h, 4)
  })

  it('changing TOP scale only affects TOP actor; LEFT and RIGHT remain untouched', () => {
    const { canvas, stageEl } = makeMockCanvasAndStage(960, 540)
    const renderer = createBoardRenderer(canvas, stageEl)
    const baseCalib = getArenaCalibration('prologue-5x5-good')!
    const level = makeLevel(5)
    const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)

    renderer.resize(level, baseCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const baseLayout = renderer.debugLayout()
    const baseTop = baseLayout.find((e: any) => e.side === 0)!.char
    const baseRight = baseLayout.find((e: any) => e.side === 1)!.char
    const baseLeft = baseLayout.find((e: any) => e.side === 3)!.char

    const modifiedCalib: ArenaCalibration = {
      ...baseCalib,
      actorScale: { ...baseCalib.actorScale!, top: 1.6 },
    }
    renderer.resize(level, modifiedCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const modLayout = renderer.debugLayout()
    const modTop = modLayout.find((e: any) => e.side === 0)!.char
    const modRight = modLayout.find((e: any) => e.side === 1)!.char
    const modLeft = modLayout.find((e: any) => e.side === 3)!.char

    // PLAYTEST-002: base top scale is no longer 1.0 (see prologue-5x5-good's own comment), so the
    // expected ratio is 1.6 / baseCalib's own top scale, not a bare 1.6x.
    const topRatio = 1.6 / baseCalib.actorScale!.top
    expect(modTop.w).toBeCloseTo(baseTop.w * topRatio, 4)
    expect(modTop.h).toBeCloseTo(baseTop.h * topRatio, 4)
    expect(modRight.w).toBeCloseTo(baseRight.w, 4)
    expect(modRight.h).toBeCloseTo(baseRight.h, 4)
    expect(modLeft.w).toBeCloseTo(baseLeft.w, 4)
    expect(modLeft.h).toBeCloseTo(baseLeft.h, 4)
  })

  it('feet remain anchored to the calibrated ground point across different scales', () => {
    const stageW = 960
    const stageH = 540
    const { canvas, stageEl } = makeMockCanvasAndStage(stageW, stageH)
    const renderer = createBoardRenderer(canvas, stageEl)
    const baseCalib = getArenaCalibration('prologue-5x5-good')!
    const level = makeLevel(5)
    const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)

    const testScales = [0.5, 0.8, 1.0, 1.25, 1.7, 2.0]
    for (const sc of testScales) {
      const calib: ArenaCalibration = {
        ...baseCalib,
        actorScale: { top: sc, left: sc, right: sc },
      }
      renderer.resize(level, calib)
      renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
      const layout = renderer.debugLayout()

      for (const entry of layout) {
        const sideKey = entry.side === 0 ? 'top' : entry.side === 1 ? 'right' : 'left'
        const expectedAnchor = calib.anchors[sideKey]
        const expectedFeetX = expectedAnchor.x * stageW
        const expectedFeetY = expectedAnchor.y * stageH

        const feet = groundPoint(entry.char)
        expect(feet.x).toBeCloseTo(expectedFeetX, 4)
        const idle = Math.sin(entry.side * 1.7) * 1.6; expect(feet.y - idle).toBeCloseTo(expectedFeetY, 4)
      }
    }
  })

  it('effect anchors remain independent of actor anchor and actor scale', () => {
    const stageW = 960
    const stageH = 540
    const { canvas, stageEl } = makeMockCanvasAndStage(stageW, stageH)
    const renderer = createBoardRenderer(canvas, stageEl)
    const baseCalib = getArenaCalibration('prologue-5x5-good')!
    const level = makeLevel(5)
    const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)

    const customCalib: ArenaCalibration = {
      ...baseCalib,
      anchors: {
        top: { x: 0.5, y: 0.155 },
        left: { x: 0.17, y: 0.62 },
        right: { x: 0.83, y: 0.62 },
      },
      effectAnchors: {
        top: { x: 0.48, y: 0.12 },
        left: { x: 0.15, y: 0.58 },
        right: { x: 0.85, y: 0.58 },
      },
      actorScale: { top: 1.5, left: 0.7, right: 1.2 },
    }

    renderer.resize(level, customCalib)
    renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
    const layout = renderer.debugLayout()

    for (const entry of layout) {
      const sideKey = entry.side === 0 ? 'top' : entry.side === 1 ? 'right' : 'left'
      const effExpected = customCalib.effectAnchors[sideKey]
      expect(entry.effectAnchor.x).toBeCloseTo(effExpected.x * stageW, 4)
      expect(entry.effectAnchor.y).toBeCloseTo(effExpected.y * stageH, 4)
    }
  })

  it('scales proportionally across 1920x1080 and 1366x768 resolutions while staying grid-size invariant', () => {
    const resolutions = [
      { w: 1920, h: 1080, ratio: 1080 / 540 },
      { w: 1366, h: 768, ratio: 768 / 540 },
    ]

    for (const res of resolutions) {
      const { canvas, stageEl } = makeMockCanvasAndStage(res.w, res.h)
      const renderer = createBoardRenderer(canvas, stageEl)
      const calib = getArenaCalibration('prologue-5x5-good')!

      let baseFootprint: any = null
      for (const n of [5, 6, 8, 10]) {
        const level = makeLevel(n)
        const s = EncounterState.fromLevel(level, PREVIEW_DEF, 9999, null)
        renderer.resize(level, calib)
        renderer.frame(0, { s, def: PREVIEW_DEF, level, assets: {}, hint: null, boss: null, debug: false })
        const layout = renderer.debugLayout()
        const top = layout.find((e: any) => e.side === 0)!.char
        const left = layout.find((e: any) => e.side === 3)!.char
        const right = layout.find((e: any) => e.side === 1)!.char

        if (!baseFootprint) {
          baseFootprint = { top, left, right }
          expect(left.w).toBeCloseTo(283.2 * res.ratio, 1)
        } else {
          expect(top.w).toBeCloseTo(baseFootprint.top.w, 4)
          expect(left.w).toBeCloseTo(baseFootprint.left.w, 4)
          expect(right.w).toBeCloseTo(baseFootprint.right.w, 4)
        }
      }
    }
  })
})
