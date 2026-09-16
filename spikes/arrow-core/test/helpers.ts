import { type Dir, DX, DY, dirOfStep } from '../src/dir.js'
import type { Arrow, Level } from '../src/level.js'
import type { Rng } from '../src/rng.js'
import { BoardState } from '../src/state.js'

/** Builds an arrow from (x, y) points tail first; direction comes from the last segment. */
export function arrowXY(width: number, id: number, pts: [number, number][]): Arrow {
  const [hx, hy] = pts[pts.length - 1]
  const [nx, ny] = pts[pts.length - 2]
  const dir = dirOfStep(hx - nx, hy - ny)
  if (dir === -1) throw new Error('bad fixture')
  return { id, dir, cells: pts.map(([x, y]) => y * width + x) }
}

export function levelXY(width: number, height: number, arrows: [number, number][][], solution: number[] = []): Level {
  return { width, height, arrows: arrows.map((pts, id) => arrowXY(width, id, pts)), solution }
}

/**
 * Random, *not necessarily solvable* layout: self-avoiding random walks dropped anywhere, with
 * arbitrary head directions — including heads pointing into their own body. Used to test the
 * solver against brute force on boards the generator would never produce.
 */
export function randomLayout(rng: Rng, width: number, height: number, maxArrows: number, maxLen: number): Level {
  const occ = new Uint8Array(width * height)
  const arrows: Arrow[] = []
  for (let tries = 0; tries < maxArrows * 6 && arrows.length < maxArrows; tries++) {
    let cell = rng.int(width * height)
    if (occ[cell]) continue
    const path = [cell]
    const used = new Set(path)
    const len = 2 + rng.int(Math.max(1, maxLen - 1))
    while (path.length < len) {
      const x = cell % width
      const y = (cell - x) / width
      const opts: number[] = []
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nc = ny * width + nx
        if (!occ[nc] && !used.has(nc)) opts.push(nc)
      }
      if (opts.length === 0) break
      cell = opts[rng.int(opts.length)]
      path.push(cell)
      used.add(cell)
    }
    if (path.length < 2) continue
    for (const c of path) occ[c] = 1
    const head = path[path.length - 1]
    const neck = path[path.length - 2]
    const dir = dirOfStep((head % width) - (neck % width), Math.floor(head / width) - Math.floor(neck / width)) as Dir
    arrows.push({ id: arrows.length, dir, cells: path })
  }
  return { width, height, arrows, solution: [] }
}

/** Exhaustive search with memoization. Exponential; small boards only. */
export function bruteForceSolvable(level: Level): boolean {
  const state = BoardState.fromLevel(level)
  const dead = new Set<string>()
  const rec = (): boolean => {
    if (state.cleared) return true
    const key = state.key()
    if (dead.has(key)) return false
    for (const id of state.freeArrows()) {
      state.remove(id)
      const ok = rec()
      state.undo()
      if (ok) return true
    }
    dead.add(key)
    return false
  }
  return rec()
}

/** Rigid 90° clockwise rotation of the whole figure: (x, y) -> (H-1-y, x), directions turn too. */
export function rotateLevelCW(level: Level): Level {
  const { width: w, height: h } = level
  const nw = h
  return {
    width: nw,
    height: w,
    solution: [...level.solution],
    arrows: level.arrows.map((a) => ({
      id: a.id,
      dir: ((a.dir + 1) & 3) as Dir,
      cells: a.cells.map((c) => {
        const x = c % w
        const y = (c - x) / w
        return x * nw + (h - 1 - y)
      }),
    })),
  }
}

/** Blocking computed the dumbest possible way, for cross-checking BoardState. */
export function naiveCanExit(level: Level, alive: boolean[], id: number): boolean {
  const { width: w, height: h } = level
  const owner = new Int32Array(w * h).fill(-1)
  level.arrows.forEach((a) => {
    if (alive[a.id]) for (const c of a.cells) owner[c] = a.id
  })
  const a = level.arrows[id]
  const head = a.cells[a.cells.length - 1]
  for (let x = (head % w) + DX[a.dir], y = Math.floor(head / w) + DY[a.dir]; x >= 0 && y >= 0 && x < w && y < h; x += DX[a.dir], y += DY[a.dir]) {
    if (owner[y * w + x] !== -1) return false
  }
  return true
}
