import { DX, DY, dirOfStep } from './dir.js'
import type { Level } from './level.js'

/**
 * Independent checks. Deliberately written without BoardTopology/BoardState so that a bug in the
 * incremental machinery cannot hide itself: the generator's output is re-checked by this code.
 */

export const MAX_SIDE = 256

/** Structural validity. Returns a list of human-readable problems; empty means valid. */
export function validateLevel(level: Level, opts: { requireSolution?: boolean } = {}): string[] {
  const errors: string[] = []
  const { width: w, height: h, arrows } = level
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > MAX_SIDE || h > MAX_SIDE) {
    return [`bad dimensions ${w}x${h}`]
  }
  const owner = new Int32Array(w * h).fill(-1)

  arrows.forEach((a, index) => {
    if (a.id !== index) errors.push(`arrow at index ${index} has id ${a.id}`)
    if (a.cells.length < 2) {
      errors.push(`arrow ${index}: length ${a.cells.length} < 2`)
      return
    }
    for (let i = 0; i < a.cells.length; i++) {
      const c = a.cells[i]
      if (!Number.isInteger(c) || c < 0 || c >= w * h) {
        errors.push(`arrow ${index}: cell ${c} out of bounds`)
        return
      }
      if (owner[c] === index) errors.push(`arrow ${index}: revisits cell ${c}`)
      else if (owner[c] !== -1) errors.push(`arrow ${index}: overlaps arrow ${owner[c]} at cell ${c}`)
      owner[c] = index
      if (i > 0) {
        const p = a.cells[i - 1]
        if (dirOfStep((c % w) - (p % w), Math.floor(c / w) - Math.floor(p / w)) === -1) {
          errors.push(`arrow ${index}: cells ${p} -> ${c} are not orthogonally adjacent`)
        }
      }
    }
    const head = a.cells[a.cells.length - 1]
    const neck = a.cells[a.cells.length - 2]
    const d = dirOfStep((head % w) - (neck % w), Math.floor(head / w) - Math.floor(neck / w))
    if (d !== a.dir) errors.push(`arrow ${index}: dir ${a.dir} does not match its last segment`)
  })

  if (errors.length === 0) {
    for (const a of arrows) {
      const head = a.cells[a.cells.length - 1]
      let x = (head % w) + DX[a.dir]
      let y = Math.floor(head / w) + DY[a.dir]
      while (x >= 0 && y >= 0 && x < w && y < h) {
        if (owner[y * w + x] === a.id) {
          errors.push(`arrow ${a.id}: body lies on its own escape ray, it can never leave`)
          break
        }
        x += DX[a.dir]
        y += DY[a.dir]
      }
    }
  }

  const sol = level.solution
  if (sol.length > 0 || opts.requireSolution) {
    const seen = new Uint8Array(arrows.length)
    if (sol.length !== arrows.length) errors.push(`solution has ${sol.length} steps for ${arrows.length} arrows`)
    for (const id of sol) {
      if (!Number.isInteger(id) || id < 0 || id >= arrows.length) errors.push(`solution: bad id ${id}`)
      else if (seen[id]++) errors.push(`solution: id ${id} repeated`)
    }
  }
  return errors
}

export type ReplayResult = { ok: true } | { ok: false; step: number; id: number; reason: string }

/**
 * Plays `order` from scratch with a plain occupancy grid, walking every ray cell by cell.
 * `ok` means the order is legal at every step and clears the board.
 */
export function replayOrder(level: Level, order: readonly number[]): ReplayResult {
  const { width: w, height: h, arrows } = level
  const owner = new Int32Array(w * h).fill(-1)
  for (const a of arrows) for (const c of a.cells) owner[c] = a.id
  const gone = new Uint8Array(arrows.length)

  for (let step = 0; step < order.length; step++) {
    const id = order[step]
    const a = arrows[id]
    if (!a) return { ok: false, step, id, reason: 'unknown arrow' }
    if (gone[id]) return { ok: false, step, id, reason: 'already removed' }
    const head = a.cells[a.cells.length - 1]
    let x = (head % w) + DX[a.dir]
    let y = Math.floor(head / w) + DY[a.dir]
    while (x >= 0 && y >= 0 && x < w && y < h) {
      const o = owner[y * w + x]
      if (o !== -1) return { ok: false, step, id, reason: `blocked by arrow ${o}` }
      x += DX[a.dir]
      y += DY[a.dir]
    }
    for (const c of a.cells) owner[c] = -1
    gone[id] = 1
  }
  if (order.length !== arrows.length) {
    return { ok: false, step: order.length, id: -1, reason: `board not cleared (${arrows.length - order.length} left)` }
  }
  return { ok: true }
}

/** Full acceptance check for a generated level: structure + stored solution replays. */
export function verifyLevel(level: Level): string[] {
  const errors = validateLevel(level, { requireSolution: true })
  if (errors.length > 0) return errors
  const r = replayOrder(level, level.solution)
  return r.ok ? [] : [`solution step ${r.step} (arrow ${r.id}): ${r.reason}`]
}
