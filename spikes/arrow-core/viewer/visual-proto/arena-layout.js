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
export const BOSS_CHAR = { w: 5.6, h: 7.2 }
export const SIDE_CHAR = { w: 5.2, h: 5.2 }

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
