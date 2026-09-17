import { describe, expect, it } from 'vitest'
import { DX, DY } from '../src/index.js'
import {
  BOSS_CHAR,
  BOSS_SLOT_DIST,
  charBox,
  charSize,
  faceRect,
  hudBoxes,
  rectsOverlap,
  rotatedBoardBox,
  SIDE_CHAR,
  SIDE_SLOT_DIST,
  slotCenter,
  slotDist,
  spriteMirror,
} from '../viewer/visual-proto/arena-layout.js'

/**
 * VIS-007: arena character/HUD layout contract. Pure geometry -- no DOM, no engine.
 * The renderer consumes these helpers directly; these tests pin footprints, slots,
 * HUD placement (clear of sprite-face and board) and the mirror rule.
 */

const CELL = 30
const HALF = 105 // board half in px (7-cell span)
const CX = 400
const CY = 300

function hudFor(side: number, isBoss: boolean, lineCount: number, maxTextW = 120) {
  // Mirrors the renderer: hudBoxes works slot-relative (slot = origin), absolute canvas
  // coords come from adding the absolute slot. slotAbsX/boardCx/boardHalfPx drive the
  // E/W outward clamp.
  const abs = slotCenter(CX, CY, HALF, side, isBoss, CELL, DX, DY)
  const s = charSize(isBoss)
  const rel = { x: -(s.w * CELL) / 2, y: -(s.h * CELL) / 2, w: s.w * CELL, h: s.h * CELL }
  const fontPx = Math.max(10, Math.floor(CELL * (isBoss ? 0.3 : 0.25)))
  const raw = hudBoxes({
    slot: { x: 0, y: 0 }, char: rel, side, fontPx, lineH: fontPx * 1.15, lineCount,
    barH: Math.max(5, CELL * 0.16), maxTextW, cell: CELL,
    slotAbsX: abs.x, boardCx: CX, boardHalfPx: HALF,
  })
  const off = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + abs.x, y: r.y + abs.y, w: r.w, h: r.h })
  const char = off(rel)
  const hud = { ...raw, bar: off(raw.bar), plate: off(raw.plate) }
  return { abs, char, hud, raw }
}

describe('VIS-007 footprints and slots', () => {
  it('boss footprint is larger than a side-enemy footprint, both full-size', () => {
    expect(BOSS_CHAR.h).toBeGreaterThan(SIDE_CHAR.h)
    expect(BOSS_CHAR.w).toBeGreaterThan(SIDE_CHAR.w)
    expect(SIDE_CHAR.h).toBeGreaterThanOrEqual(2.5) // a character, never an icon
    expect(slotDist(true)).toBeGreaterThan(slotDist(false))
    expect(BOSS_SLOT_DIST).toBeGreaterThan(SIDE_SLOT_DIST)
  })
  it('slots sit on the right arena side at slot distance beyond the board edge', () => {
    const n = slotCenter(CX, CY, HALF, 0, false, CELL, DX, DY)
    const e = slotCenter(CX, CY, HALF, 1, false, CELL, DX, DY)
    const w = slotCenter(CX, CY, HALF, 3, false, CELL, DX, DY)
    expect(n.x).toBe(CX)
    expect(n.y).toBeLessThan(CY)
    expect(e.y).toBe(CY)
    expect(e.x).toBeGreaterThan(CX)
    expect(w.x).toBeLessThan(CX)
    expect(e.x - CX).toBe(HALF + SIDE_SLOT_DIST * CELL)
    expect(CY - n.y).toBe(HALF + SIDE_SLOT_DIST * CELL)
  })
  it('character box is centered on the slot (ground point stable across pose swaps)', () => {
    const slot = slotCenter(CX, CY, HALF, 0, true, CELL, DX, DY)
    const box = charBox(slot, true, CELL)
    expect(box.x + box.w / 2).toBe(slot.x)
    expect(box.y + box.h / 2).toBe(slot.y)
    expect(box.w).toBe(BOSS_CHAR.w * CELL)
    expect(box.h).toBe(BOSS_CHAR.h * CELL)
  })
})

describe('VIS-007 HUD placement', () => {
  it('TOP/Boss HUD sits fully above the sprite, clear of the face', () => {
    const { char, hud } = hudFor(0, true, 3)
    expect(hud.plate.y + hud.plate.h).toBeLessThanOrEqual(char.y)
    expect(hud.bar.y + hud.bar.h).toBeLessThanOrEqual(char.y)
    expect(rectsOverlap(hud.plate, faceRect(char))).toBe(false)
  })
  it('S-side HUD mirrors below the feet, clear of the face', () => {
    const { char, hud } = hudFor(2, false, 2)
    expect(hud.plate.y).toBeGreaterThanOrEqual(char.y + char.h)
    expect(hud.bar.y).toBeGreaterThanOrEqual(char.y + char.h)
    expect(rectsOverlap(hud.plate, faceRect(char))).toBe(false)
  })
  it.each([1, 3])('side %i HUD stacks above the sprite, clear of the face', (side) => {
    const { char, hud } = hudFor(side, false, 3)
    expect(hud.plate.y + hud.plate.h).toBeLessThanOrEqual(char.y)
    expect(rectsOverlap(hud.plate, faceRect(char))).toBe(false)
  })
  it('HUD plate clears the board footprint on every side', () => {
    const board = { x: CX - HALF, y: CY - HALF, w: HALF * 2, h: HALF * 2 }
    for (const side of [0, 1, 2, 3]) {
      const { char, hud } = hudFor(side, side === 0, 3)
      expect(rectsOverlap(hud.plate, board)).toBe(false)
      expect(rectsOverlap(char, board)).toBe(false)
    }
  })
  it('E/W plates clamp outward (board-facing edge clears the board even when wide)', () => {
    const board = { x: CX - HALF, y: CY - HALF, w: HALF * 2, h: HALF * 2 }
    const e = hudFor(1, false, 3, 200)
    expect(e.hud.plate.x).toBeGreaterThanOrEqual(board.x + board.w)
    const w = hudFor(3, false, 3, 200)
    expect(w.hud.plate.x + w.hud.plate.w).toBeLessThanOrEqual(board.x)
    // Real-width plates stay centered (no clamp needed).
    const real = hudFor(1, false, 3, 60)
    expect(real.raw.plate.x).toBeCloseTo(-(60 + 12) / 2, 8)
  })
  it('line baselines stay inside the plate in both orientations', () => {
    for (const side of [0, 1, 2, 3]) {
      const { raw } = hudFor(side, false, 4)
      for (let i = 0; i < 4; i++) {
        expect(raw.lineY(i)).toBeGreaterThan(raw.plate.y)
        expect(raw.lineY(i)).toBeLessThan(raw.plate.y + raw.plate.h)
      }
    }
  })
})

describe('VIS-007 mirror rule', () => {
  it('RIGHT-side ordinary art mirrors to face the board; everything else stays put', () => {
    expect(spriteMirror(false, 1)).toBe(-1)
    expect(spriteMirror(false, 3)).toBe(1)
    expect(spriteMirror(false, 0)).toBe(1)
    expect(spriteMirror(false, 2)).toBe(1)
    expect(spriteMirror(true, 1)).toBe(1) // frontal boss art never mirrors
  })
})

describe('VIS-007 rect helpers', () => {
  it('overlap ignores edge-touching', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
  })
  it('rotated board box is identity at 0deg and swaps at 90deg', () => {
    expect(rotatedBoardBox(100, 100, 60, 40, 0)).toEqual({ x: 70, y: 80, w: 60, h: 40 })
    const r90 = rotatedBoardBox(100, 100, 60, 40, 90)
    expect(r90.w).toBeCloseTo(40, 8)
    expect(r90.h).toBeCloseTo(60, 8)
  })
})
