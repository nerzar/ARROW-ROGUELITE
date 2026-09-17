// VIS-007: pure arena layout model (no DOM, no engine imports) so vitest can pin the
// character/HUD contract and board-renderer.js can consume it directly.
//
// Scene model: CHARACTER is drawn directly on the arena (no panel box, no clip), HUD is a
// separate plate near the character and never sizes the sprite. Slots ( canvas px ):
//
//   TOP (side N):    boss / frontal enemy -- the large main character
//   LEFT (side W) / RIGHT (side E): side enemies -- smaller than the boss but full
//     characters, never icons
//   board: center
//
// Gameplay direction/side semantics are untouched -- this module only maps side + kind to
// pixel boxes. All sizes below are in CELLS (multiplied by the renderer cell); gaps and
// bar heights stay px-based like the legacy layout did.

// Visual footprints (cells). Boss is the dominant top element; side enemies are clearly
// smaller yet full-size characters.
// BUILD-020 layout pass v2: bumped again per user request ("boss ещё увеличить; side enemies
// тоже немного увеличить"). The boss's ceiling is set by real headroom, not taste: its feet are
// pinned to PODIUM_GROUND[0] (y 0.40 of the stage), so its height + the HUD stack above it must
// fit above that line without reaching the topbar -- see board-renderer.js's resize().
export const BOSS_CHAR = { w: 6.4, h: 6.4 }
export const SIDE_CHAR = { w: 6.0, h: 6.0 }

// Slot distance from the board edge (cells). The boss stands slightly further out so its
// strike lunge never touches the board.
export const BOSS_SLOT_DIST = 5.0
export const SIDE_SLOT_DIST = 4.6

export const HUD_GAP_PX = 6

export function charSize(isBoss) {
  return isBoss ? { ...BOSS_CHAR } : { ...SIDE_CHAR }
}

export function slotDist(isBoss) {
  return isBoss ? BOSS_SLOT_DIST : SIDE_SLOT_DIST
}

// BUILD-020 layout pass v2: the approved Moonlit Fortress background (arena-moonlit-fortress.png,
// 1672x941, ~1:1 under the 16:9 stage via background-size:cover) has three actual painted standing
// spots -- the round mosaic platform at the back, and a floor medallion at the foot of each
// staircase -- not a symmetric ring around the board. These are fixed fractions of the STAGE
// (measured directly on the art), used instead of slotCenter's board-relative radius so a
// character's feet land on the real podium regardless of how big the board itself is drawn.
export const PODIUM_GROUND = {
  0: { x: 0.469, y: 0.445 }, // N: boss / back-row podium (round platform, front edge)
  1: { x: 0.86, y: 0.60 }, // E: right podium (foot of the right staircase)
  2: { x: 0.469, y: 0.95 }, // S: not used by any current encounter -- symmetric fallback
  3: { x: 0.14, y: 0.60 }, // W: left podium (foot of the left staircase)
}

/** Ground-anchored slot: same body-center contract charBox/drawTarget expect (the box is
 * centered on this point, offset up by half the character height), but measured from the
 * STAGE size instead of the board -- see PODIUM_GROUND. */
export function podiumSlot(side, isBoss, stageW, stageH, cell) {
  const g = PODIUM_GROUND[side]
  const h = charSize(isBoss).h * cell
  return { x: g.x * stageW, y: g.y * stageH - h / 2 }
}

// The board's own footprint: the blank stone dais in the art sits in this stage-fraction band
// (measured the same way as PODIUM_GROUND above). BOARD_FIT_HEIGHT is the fraction of the
// stage's height the square board's side should occupy -- sized to sit inside the dais at every
// board size (6x7 or 8x10) with a visible stone margin, never wider than the dais's narrowest
// (top) edge.
export const SLAB_CENTER = { x: 0.469, y: 0.6615 }
export const BOARD_FIT_HEIGHT = 0.36

/** Slot center (the character's ground-center x, body-center y) in canvas px. */
export function slotCenter(boardCx, boardCy, boardHalfPx, side, isBoss, cell, DX, DY) {
  const r = boardHalfPx + slotDist(isBoss) * cell
  return { x: boardCx + DX[side] * r, y: boardCy + DY[side] * r }
}

/** Character box in canvas px, centered on the slot (slot = body center). */
export function charBox(slot, isBoss, cell) {
  const s = charSize(isBoss)
  const w = s.w * cell
  const h = s.h * cell
  return { x: slot.x - w / 2, y: slot.y - h / 2, w, h }
}

/** Ground point (bottom-center of the character box): shadow/telegraph anchor. */
export function groundPoint(char) {
  return { x: char.x + char.w / 2, y: char.y + char.h }
}

/** Upper part of the sprite -- HUD must never cover this ("don't cover the face"). */
export function faceRect(char) {
  return { x: char.x, y: char.y, w: char.w, h: char.h * 0.4 }
}

/** Sprite mirror: side-profile art faces right, so RIGHT-side characters mirror to face
 * the board. Boss art is frontal and never mirrors. */
export function spriteMirror(isBoss, side) {
  return !isBoss && side === 1 ? -1 : 1
}

/**
 * HUD boxes in canvas px. The whole stack sits on the canvas-UP side of the character
 * (above the head), except the SOUTH slot where it mirrors below the feet (away from
 * the board either way, never over the sprite, never sized by it).
 *
 * Inputs: slot/char in px, side (0..3), cell, fontPx, lineH, lineCount, barH, maxTextW
 * (measured by the renderer). slotAbsX/boardCx/boardHalfPx (all canvas px) clamp E/W
 * plates outward so a wide plate never reaches the board -- the board stays clickable
 * even for long labels. Returns { bar, plate, badge } rects + the per-line
 * baseline ys in draw order. All boxes are slot-relative (the renderer draws translated).
 */
export function hudBoxes({ slot, char, side, fontPx, lineH, lineCount, barH, maxTextW, cell, slotAbsX, boardCx, boardHalfPx }) {
  const down = side === 2 // S slot mirrors the stack below the feet
  const gap = HUD_GAP_PX
  const barW = Math.max(10, char.w - 14)
  const bar = {
    x: slot.x - barW / 2,
    y: down ? slot.y + char.h / 2 + gap : slot.y - char.h / 2 - gap - barH,
    w: barW,
    h: barH,
  }
  const plateW = maxTextW + 12
  const plateH = lineH * lineCount + fontPx * 0.5
  const plate = {
    x: slot.x - plateW / 2,
    y: down ? bar.y + bar.h + gap : bar.y - gap - plateH,
    w: plateW,
    h: plateH,
  }
  // E/W plates stack vertically (mid-canvas) but are wider than the slot-to-board gap
  // can be: clamp the plate outward so its board-facing edge always clears the board.
  if ((side === 1 || side === 3) && slotAbsX !== undefined && boardCx !== undefined && boardHalfPx !== undefined) {
    const edgeGap = 4
    if (side === 1) {
      const minX = boardCx + boardHalfPx + edgeGap - slotAbsX
      if (plate.x < minX) plate.x = minX
    } else {
      const maxX = boardCx - boardHalfPx - edgeGap - plate.w - slotAbsX
      if (plate.x > maxX) plate.x = maxX
    }
  }
  const r = Math.max(9, cell * 0.2)
  const badge = {
    x: plate.x + plate.w - r * 0.5,
    y: down ? plate.y + plate.h - r * 0.3 : plate.y + r * 0.3,
    r,
  }
  // Line baselines in draw order: line 0 (name) sits closest to the HP bar in both
  // orientations, details stack away from the sprite.
  const lineY = (i) => (down
    ? plate.y + fontPx * 0.9 + i * lineH
    : plate.y + plate.h - fontPx * 0.4 - i * lineH)
  return { bar, plate, badge, lineY }
}

/** Axis-aligned rect overlap (edges touching is NOT overlap). */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Board footprint AABB after a canvas rotation (the board visually rotates in 90-degree
 * steps, plus a short animation tween -- the AABB covers the tween too). */
export function rotatedBoardBox(cx, cy, wPx, hPx, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const w = wPx * c + hPx * s
  const h = wPx * s + hPx * c
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Point inside the canvas (badge must stay on stage). */
export function insideCanvas(pt, size) {
  return pt.x >= 0 && pt.x <= size && pt.y >= 0 && pt.y <= size
}
