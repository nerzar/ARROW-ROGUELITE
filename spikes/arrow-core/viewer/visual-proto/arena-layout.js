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
// FIX-021: boss bumped moderately again per the approved review ("Shaman чуть увеличить").
export const BOSS_CHAR = { w: 6.9, h: 6.9 }
export const SIDE_CHAR = { w: 6.0, h: 6.0 }

// CAL-002: calibrated actor base cell magnitude as a fixed stage-height fraction.
// Proportional to stage height (responsive across 1080p, 768p, 540p), but independent
// from logical board grid size (cols x rows, span, cell px) so character footprint
// does not change when grid switches 5x5 -> 6x6 -> 8x8 -> 10x10.
// 47.2px on the baseline 960x540 stage (prologue-5x5-good approved base calibration).
export const ACTOR_BASE_CELL_FRAC = 47.2 / 540

// Slot distance from the board edge (cells). The boss stands slightly further out so its
// strike lunge never touches the board.
export const BOSS_SLOT_DIST = 5.0
export const SIDE_SLOT_DIST = 4.6

export const HUD_GAP_PX = 6

// CAL-005 follow-up: the HP bar is deliberately short (a third of the character width) --
// a full-width bar fought the plate for attention and read as a second plate, not a meter.
export const HP_BAR_FRAC = 1 / 3

// CAL-005 follow-up: ground-shadow ellipse proportions, shared by the runtime
// (board-renderer.js) and the Pose Editor mock so they stay identical. Small on purpose
// (a third of the old size) -- it must read as contact, not as a second character.
export const SHADOW_RX_FRAC = 0.14 // of character width (== old 0.42 / 3)
export const SHADOW_RY_CELL_FRAC = 0.037 // of the actor cell (== old 0.11 / 3)
export const SHADOW_RY_MIN_PX = 2

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
 * STAGE size instead of the board -- see PODIUM_GROUND.
 *
 * FIX-023: `groundOverride` (same {side: {x,y}} shape as PODIUM_GROUND) lets a caller substitute
 * a different background's own measured podium points -- PODIUM_GROUND is calibrated for the
 * flexible Moonlit Fortress art specifically and floats on any other arena image. Omitted (every
 * existing caller) reproduces the exact PODIUM_GROUND lookup this function always did. */
export function podiumSlot(side, isBoss, stageW, stageH, cell, groundOverride) {
  const g = groundOverride?.[side] ?? PODIUM_GROUND[side]
  const h = charSize(isBoss).h * cell
  return { x: g.x * stageW, y: g.y * stageH - h / 2 }
}

// FIX-021: the VFX ground anchor is deliberately NOT the character's own foot-contact point.
// PODIUM_GROUND plants the character's feet right at each podium's front lip (correct for a
// standing character); a telegraph/glow drawn at that same point has enough vertical spread
// (see drawTarget's castGlow/ellipse sizing) to spill past the lip into the vertical stair
// drop below it. EFFECT_GROUND pulls the anchor back onto the flat top of each podium instead,
// calibrated by eye against arena-moonlit-fortress.png the same way PODIUM_GROUND was.
export const EFFECT_GROUND = {
  0: { x: 0.469, y: 0.400 }, // N: center of the round back platform's flat top, clear of the front lip
  1: { x: 0.825, y: 0.560 }, // E: center of the right platform, clear of the staircase edge
  2: { x: 0.469, y: 0.900 }, // S: not used by any current encounter -- symmetric fallback
  3: { x: 0.155, y: 0.560 }, // W: center of the left platform
}

/** VFX ground anchor in canvas px -- see EFFECT_GROUND. Independent of character size/pose.
 * FIX-023: same `groundOverride` substitution contract as podiumSlot, for a non-default arena. */
export function effectGround(side, stageW, stageH, groundOverride) {
  const g = groundOverride?.[side] ?? EFFECT_GROUND[side]
  return { x: g.x * stageW, y: g.y * stageH }
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
 * even for long labels. viewport { w, h, x, y } (optional) clamps the whole stack inside
 * the visible stage -- bar top / plate bottom / plate sides never leave the canvas.
 * Returns { bar, plate, badge } rects + the per-line
 * baseline ys in draw order. All boxes are slot-relative (the renderer draws translated);
 * viewport.x/y is the canvas position of that slot-relative origin.
 */
export function hudBoxes({ slot, char, side, fontPx, lineH, lineCount, barH, maxTextW, cell, slotAbsX, boardCx, boardHalfPx, offset, viewport }) {
  const down = side === 2 // S slot mirrors the stack below the feet
  const gap = HUD_GAP_PX
  // CAL-005: species-level HUD offset in canvas px (the renderer converts species-presentation.js's
  // footprint fractions). Shifts the whole stack -- bar, plate, badge, baselines -- by one anchor.
  // Omitted/zero reproduces exactly the geometry this function always computed.
  const ox = offset?.x ?? 0
  const oy = offset?.y ?? 0
  const barW = Math.max(10, (char.w - 14) * HP_BAR_FRAC)
  const bar = {
    x: slot.x - barW / 2 + ox,
    y: (down ? slot.y + char.h / 2 + gap : slot.y - char.h / 2 - gap - barH) + oy,
    w: barW,
    h: barH,
  }
  const plateW = maxTextW + 12
  const plateH = lineH * lineCount + fontPx * 0.5
  const plate = {
    x: slot.x - plateW / 2 + ox,
    y: down ? bar.y + bar.h + gap : bar.y - gap - plateH, // bar already carries oy, so the plate stacks with it
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
  // FIX-033: last-resort viewport clamp. Tall characters on small stages push the stack
  // above the head straight off the canvas (measured: N plates at y<0 on 480px stages and
  // even at 1080p). A plate shifted down over the sprite reads worse than a clear plate but
  // infinitely better than an invisible one -- and CAL-005 offsets still apply first, this
  // only trims true viewport overflow. Runs after the E/W board clamp, so visibility wins.
  // Omitted viewport reproduces exactly the geometry this function always computed.
  if (viewport && Number.isFinite(viewport.w) && Number.isFinite(viewport.h)) {
    const m = 2
    const ox0 = Number.isFinite(viewport.x) ? viewport.x : 0
    const oy0 = Number.isFinite(viewport.y) ? viewport.y : 0
    const top = Math.min(bar.y, plate.y) + oy0
    const bottom = Math.max(bar.y + bar.h, plate.y + plate.h) + oy0
    let dy = 0
    if (top < m) dy = m - top
    else if (bottom > viewport.h - m) dy = viewport.h - m - bottom
    if (dy !== 0) {
      bar.y += dy
      plate.y += dy
    }
    let dx = 0
    if (plate.x + ox0 < m) dx = m - (plate.x + ox0)
    else if (plate.x + plate.w + ox0 > viewport.w - m) dx = viewport.w - m - (plate.x + plate.w + ox0)
    if (dx !== 0) {
      plate.x += dx
      bar.x += dx
    }
  }
  const badge = {
    x: plate.x + plate.w - r * 0.5,
    y: (down ? plate.y + plate.h - r * 0.3 : plate.y + r * 0.3),
    r,
  }
  // Line baselines in draw order: line 0 (name) sits closest to the HP bar in both
  // orientations, details stack away from the sprite. plate.y already carries oy.
  const lineY = (i) => (down
    ? plate.y + fontPx * 0.9 + i * lineH
    : plate.y + plate.h - fontPx * 0.4 - i * lineH)
  // Text x in draw order: the renderer centers lines on the slot; the offset shifts them
  // with the plate. Exposed so bar/plate/text/badge all share the one anchor.
  const lineX = slot.x + ox
  return { bar, plate, badge, lineY, lineX }
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
