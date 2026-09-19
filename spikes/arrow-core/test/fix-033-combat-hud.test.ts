import { describe, expect, it } from 'vitest'
import { hudBoxes } from '../viewer/visual-proto/arena-layout.js'

/**
 * FIX-033: the HUD stack must stay inside the visible stage. Diagnosis (browser, all
 * sides): N/top plates render at negative canvas y on small stages (480px: up to -35px)
 * and even at 1080p -- the stack sits above the head unconditionally. The viewport clamp
 * is last-resort (runs after CAL-005 offsets and the E/W board clamp) and trims only true
 * overflow; without it the geometry is byte-identical to the legacy layout.
 *
 * Convention below mirrors the renderer: slot-relative boxes + viewport { w, h, x, y }
 * where x/y is the canvas position of the slot-relative origin.
 */
const CELL = 30

function stack({ side = 0, charW = 180, charH = 180, absX = 400, absY = 300, stageW = 1366, stageH = 768, viewport = true, extra = {} }) {
  return hudBoxes({
    slot: { x: 0, y: 0 },
    char: { x: -charW / 2, y: -charH / 2, w: charW, h: charH },
    side, fontPx: 10, lineH: 11.5, lineCount: 2, barH: 5, maxTextW: 100, cell: CELL,
    ...(viewport ? { viewport: { w: stageW, h: stageH, x: absX, y: absY } } : {}),
    ...extra,
  })
}

describe('FIX-033 viewport clamp', () => {
  it('without a viewport the geometry is exactly the legacy one', () => {
    const a = stack({ viewport: false })
    const b = stack({ viewport: false, extra: { offset: { x: 0, y: 0 } } })
    expect(b.bar).toEqual(a.bar)
    expect(b.plate).toEqual(a.plate)
    expect(b.badge).toEqual(a.badge)
    expect(b.lineY(1)).toBe(a.lineY(1))
  })

  it('a fitting stack is untouched by the clamp', () => {
    const plain = stack({ viewport: false })
    const clamped = stack({})
    expect(clamped.bar).toEqual(plain.bar)
    expect(clamped.plate).toEqual(plain.plate)
    expect(clamped.badge).toEqual(plain.badge)
  })

  it('a top-overflowing N stack shifts down into the stage, badge and lines follow', () => {
    // Tall char near the top of a short stage: legacy plate top lands above y=0.
    const legacy = stack({ viewport: false, charH: 300, absY: 120 })
    expect(legacy.plate.y + 120).toBeLessThan(0)
    const fixed = stack({ charH: 300, absY: 120 })
    expect(fixed.plate.y + 120).toBeGreaterThanOrEqual(2)
    expect(fixed.bar.y + 120).toBeGreaterThanOrEqual(2)
    // The whole stack moved as one: sizes unchanged, badge/lines track the plate.
    expect(fixed.plate.w).toBe(legacy.plate.w)
    expect(fixed.plate.h).toBe(legacy.plate.h)
    expect(fixed.badge.y - legacy.badge.y).toBeCloseTo(fixed.plate.y - legacy.plate.y, 9)
    expect(fixed.lineY(0) - legacy.lineY(0)).toBeCloseTo(fixed.plate.y - legacy.plate.y, 9)
  })

  it('an S-side stack overflowing the bottom shifts up instead', () => {
    const legacy = stack({ viewport: false, side: 2, charH: 200, absY: 740, stageH: 768 })
    expect(legacy.plate.y + legacy.plate.h + 740).toBeGreaterThan(768)
    const fixed = stack({ side: 2, charH: 200, absY: 740, stageH: 768 })
    expect(fixed.plate.y + fixed.plate.h + 740).toBeLessThanOrEqual(768 - 2)
  })

  it('a plate past the right stage edge shifts left (sizes intact)', () => {
    const legacy = stack({ viewport: false, absX: 1330, stageW: 1366 })
    expect(legacy.plate.x + legacy.plate.w + 1330).toBeGreaterThan(1366)
    const fixed = stack({ absX: 1330, stageW: 1366 })
    expect(fixed.plate.x + fixed.plate.w + 1330).toBeLessThanOrEqual(1366 - 2)
    expect(fixed.plate.w).toBe(legacy.plate.w)
  })

  it('CAL-005 offsets still apply first; the clamp only trims real overflow', () => {
    // Inward offset: no clamp engages, geometry equals offset-only.
    const a = stack({ charH: 300, absY: 200, extra: { offset: { x: 0, y: 20 } } })
    const b = stack({ viewport: false, charH: 300, absY: 200, extra: { offset: { x: 0, y: 20 } } })
    expect(a.bar).toEqual(b.bar)
    expect(a.plate).toEqual(b.plate)
  })
})
