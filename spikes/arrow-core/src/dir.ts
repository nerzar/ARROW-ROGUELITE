/**
 * Directions are numbered clockwise so that a quarter turn is `(d + 1) & 3`.
 * Screen coordinates: y grows downwards, so N is dy = -1.
 */
export type Dir = 0 | 1 | 2 | 3

export const N: Dir = 0
export const E: Dir = 1
export const S: Dir = 2
export const W: Dir = 3

export const DIRS: readonly Dir[] = [N, E, S, W]
export const DX: readonly number[] = [0, 1, 0, -1]
export const DY: readonly number[] = [-1, 0, 1, 0]
export const DIR_NAMES: readonly string[] = ['N', 'E', 'S', 'W']

export const opposite = (d: Dir): Dir => ((d + 2) & 3) as Dir

/**
 * Board-local direction -> arena direction for a board rotated `quarterTurnsCW` times.
 *
 * Extension point for the future Rotate mechanic: a rigid rotation of the whole figure does not
 * change which arrows block which, so BoardState/BoardSolver never need to know the orientation.
 * Only an encounter layer that maps exits to arena sides does.
 */
export const rotateDir = (d: Dir, quarterTurnsCW: number): Dir => ((d + quarterTurnsCW) & 3) as Dir

/** Direction of a unit step (dx, dy), or -1 if it is not an orthogonal unit step. */
export function dirOfStep(dx: number, dy: number): Dir | -1 {
  if (dx === 0 && dy === -1) return N
  if (dx === 1 && dy === 0) return E
  if (dx === 0 && dy === 1) return S
  if (dx === -1 && dy === 0) return W
  return -1
}
