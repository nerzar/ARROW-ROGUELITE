import { type Dir, DX, DY, opposite } from './dir.js'
import type { Arrow, Level } from './level.js'
import { createRng, deriveSeed, type Rng } from './rng.js'
import { BoardState } from './state.js'
import { BoardTopology } from './topology.js'
import { verifyLevel } from './verify.js'

export interface GeneratorParams {
  width: number
  height: number
  /** Arrow length in cells, >= 2. */
  minLength: number
  maxLength: number
  /** Chance to turn at each body growth step when a turn is possible. */
  turnChance: number
  /** Construction stops once this share of cells is covered. */
  targetFill: number
  /** Acceptance: minimum covered share. */
  minFill: number
  /** Acceptance: maximum share of arrows that can leave on the first move. */
  maxInitialFreeRatio: number
  /** Acceptance: minimum number of arrows. */
  minArrows: number
  /** 0..1 preference for placing new arrows on existing escape rays (creates blocking). */
  blockSeeking: number
  /** Relative weight per exit direction [N, E, S, W]; 0 forbids a direction. Default: uniform. */
  dirWeights?: readonly [number, number, number, number]
  /** Construction attempts per level before giving up. */
  attempts: number
  /** Re-check every accepted level with the independent verifier (default true). */
  verify?: boolean
}

export interface GenerateResult {
  ok: boolean
  /** The accepted level, or the closest rejected attempt when `ok` is false (null if none built). */
  level: Level | null
  attempts: number
  rejects: { fill: number; free: number; arrows: number; invariant: number }
  invariantErrors?: string[]
}

/**
 * Reverse-construction generator.
 *
 * Arrows are inserted in the reverse of their removal order: the last arrow to leave goes onto an
 * empty board first. Every insertion requires the new arrow's escape ray to be clear of everything
 * already placed, and its body may never enter its own ray. When the forward game reaches arrow k,
 * exactly the arrows inserted before it are still on the board, and its ray was clear of them, so
 * the reversed insertion order is always a valid solution: no search is needed.
 *
 * Arrows inserted later are free to land on the rays of earlier ones; that is where the puzzle
 * comes from, so placement is biased towards existing rays (`blockSeeking`).
 *
 * The principle is the well-known one used by AlenSarangSatheesh/Arrow-Escape-Game and
 * gtxPrime/arrow-escape; this implementation and its heuristics are written independently.
 */
export function generateLevel(params: GeneratorParams, seed: number): GenerateResult {
  checkParams(params)
  const rejects = { fill: 0, free: 0, arrows: 0, invariant: 0 }
  const cellCount = params.width * params.height
  let best: Level | null = null
  let bestBadness = Infinity
  let invariantErrors: string[] | undefined

  for (let attempt = 0; attempt < params.attempts; attempt++) {
    const rng = createRng(deriveSeed(seed, attempt))
    const level = buildAttempt(params, rng, seed)

    const n = level.arrows.length
    let covered = 0
    for (const a of level.arrows) covered += a.cells.length
    const fill = covered / cellCount
    const freeRatio = n === 0 ? 1 : new BoardState(BoardTopology.fromLevel(level)).freeCount / n

    const badness =
      Math.max(0, params.minFill - fill) * 10 +
      Math.max(0, freeRatio - params.maxInitialFreeRatio) * 10 +
      Math.max(0, params.minArrows - n)
    if (badness > 0) {
      if (n < params.minArrows) rejects.arrows++
      else if (fill < params.minFill) rejects.fill++
      else rejects.free++
      if (badness < bestBadness) {
        best = level
        bestBadness = badness
      }
      continue
    }

    if (params.verify !== false) {
      const errors = verifyLevel(level)
      if (errors.length > 0) {
        rejects.invariant++
        invariantErrors = errors
        continue
      }
    }
    return { ok: true, level, attempts: attempt + 1, rejects, invariantErrors }
  }
  return { ok: false, level: best, attempts: params.attempts, rejects, invariantErrors }
}

function checkParams(p: GeneratorParams): void {
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || p.width * p.height < 2) {
    throw new Error('bad board size')
  }
  if (p.minLength < 2 || p.maxLength < p.minLength) throw new Error('bad length range')
  if (p.attempts < 1) throw new Error('attempts must be >= 1')
  if (p.dirWeights && p.dirWeights.every((v) => v <= 0)) throw new Error('all directions disabled')
}

interface Placed {
  cells: number[]
  dir: Dir
}

function buildAttempt(p: GeneratorParams, rng: Rng, seed: number): Level {
  const W = p.width
  const H = p.height
  const N = W * H
  const occ = new Uint8Array(N)
  const rayHits = new Int32Array(N)
  /** Highest placement index among arrows whose ray crosses the cell, -1 if none. */
  const rayMaxIdx = new Int32Array(N).fill(-1)
  const clear = new Uint8Array(4 * N)
  const rayMark = new Int32Array(N)
  const pathMark = new Int32Array(N)
  let epoch = 0

  const candCell = new Int32Array(4 * N)
  const candDir = new Uint8Array(4 * N)
  const candWeight = new Float64Array(4 * N)

  const placed: Placed[] = []
  const target = Math.max(2, Math.floor(N * p.targetFill))
  let occupied = 0
  let misses = 0

  const freeNb = (cell: number): number => {
    const x = cell % W
    const y = (cell - x) / W
    let f = 0
    if (y > 0 && occ[cell - W] === 0) f++
    if (y < H - 1 && occ[cell + W] === 0) f++
    if (x > 0 && occ[cell - 1] === 0) f++
    if (x < W - 1 && occ[cell + 1] === 0) f++
    return f
  }

  while (occupied < target) {
    computeClear(W, H, occ, clear)
    const early = occupied < target * 0.4

    let count = 0
    let total = 0
    for (let cell = 0; cell < N; cell++) {
      if (occ[cell]) continue
      const x = cell % W
      const y = (cell - x) / W
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const dw = p.dirWeights ? p.dirWeights[d] : 1
        if (dw <= 0 || !clear[d * N + cell]) continue
        const bx = x - DX[d]
        const by = y - DY[d]
        if (bx < 0 || by < 0 || bx >= W || by >= H) continue
        const back = by * W + bx
        if (occ[back]) continue

        const rayLen = d === 0 ? y : d === 2 ? H - 1 - y : d === 3 ? x : W - 1 - x
        const hits = (rayHits[cell] > 0 ? 1 : 0) + (rayHits[back] > 0 ? 1 : 0)
        let wgt = dw * (1 + p.blockSeeking * 3 * hits)
        if (early) wgt *= 1 + rayLen
        else if (rayLen === 0) wgt *= 0.15
        wgt *= 1 + 0.4 * (4 - freeNb(back))

        candCell[count] = cell
        candDir[count] = d
        candWeight[count] = wgt
        total += wgt
        count++
      }
    }
    if (count === 0) break

    let r = rng.next() * total
    let pick = 0
    while (pick < count - 1 && r >= candWeight[pick]) r -= candWeight[pick++]

    const head = candCell[pick]
    const dir = candDir[pick] as Dir
    const skew = early ? 0.6 : 1.8
    const span = p.maxLength - p.minLength + 1
    const targetLen = Math.min(p.maxLength, p.minLength + Math.floor(Math.pow(rng.next(), skew) * span))

    epoch++
    const cells = growBody(head, dir, targetLen)
    if (cells.length < p.minLength) {
      if (++misses > 30) break
      continue
    }
    for (const c of cells) occ[c] = 1
    const hx = head % W
    const hy = (head - hx) / W
    for (let x = hx + DX[dir], y = hy + DY[dir]; x >= 0 && y >= 0 && x < W && y < H; x += DX[dir], y += DY[dir]) {
      rayHits[y * W + x]++
    }
    const idx = placed.length
    for (let x = hx + DX[dir], y = hy + DY[dir]; x >= 0 && y >= 0 && x < W && y < H; x += DX[dir], y += DY[dir]) {
      rayMaxIdx[y * W + x] = idx
    }
    placed.push({ cells, dir })
    occupied += cells.length
  }

  occupied += fillHolesByTailExtension()

  return toLevel(W, H, placed, seed)

  /**
   * Holes left by construction (often single cells nobody can start an arrow in) are absorbed by
   * growing an adjacent arrow's tail into them. Growing arrow A into cell c keeps the stored
   * solution valid iff every arrow whose ray crosses c was placed before A (so leaves after A):
   * those rays find c empty again by the time they need it. A's own ray is excluded the same way.
   * It also adds dependencies: those later-leaving arrows now wait for A.
   */
  function fillHolesByTailExtension(): number {
    if (p.maxLength <= 2) return 0
    const tailOwner = new Int32Array(N).fill(-1)
    placed.forEach((a, i) => (tailOwner[a.cells[0]] = i))
    let added = 0
    let changed = true
    while (changed) {
      changed = false
      for (let cell = 0; cell < N; cell++) {
        if (occ[cell]) continue
        const x = cell % W
        const y = (cell - x) / W
        let bestOwner = -1
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d]
          const ny = y + DY[d]
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const owner = tailOwner[ny * W + nx]
          if (owner === -1 || placed[owner].cells.length >= p.maxLength) continue
          if (rayMaxIdx[cell] >= owner) continue
          if (bestOwner === -1 || rng.next() < 0.5) bestOwner = owner
        }
        if (bestOwner === -1) continue
        const a = placed[bestOwner]
        tailOwner[a.cells[0]] = -1
        a.cells.unshift(cell)
        tailOwner[cell] = bestOwner
        occ[cell] = 1
        added++
        changed = true
      }
    }
    return added
  }

  /** Grows the body backwards from the head; returns cells tail first. */
  function growBody(head: number, dir: Dir, targetLen: number): number[] {
    const free = (c: number) => occ[c] === 0 && rayMark[c] !== epoch && pathMark[c] !== epoch
    const hx = head % W
    const hy = (head - hx) / W
    for (let x = hx + DX[dir], y = hy + DY[dir]; x >= 0 && y >= 0 && x < W && y < H; x += DX[dir], y += DY[dir]) {
      rayMark[y * W + x] = epoch
    }
    const walkBack = opposite(dir)
    const back = head + DX[walkBack] + DY[walkBack] * W
    const path = [head, back]
    pathMark[head] = epoch
    pathMark[back] = epoch

    const freeCount = (c: number) => {
      const x = c % W
      const y = (c - x) / W
      let f = 0
      if (y > 0 && free(c - W)) f++
      if (y < H - 1 && free(c + W)) f++
      if (x > 0 && free(c - 1)) f++
      if (x < W - 1 && free(c + 1)) f++
      return f
    }
    const stepTo = (c: number, d: Dir): number => {
      const x = (c % W) + DX[d]
      const y = (c - (c % W)) / W + DY[d]
      if (x < 0 || y < 0 || x >= W || y >= H) return -1
      const nc = y * W + x
      return free(nc) ? nc : -1
    }

    let cur = back
    let walk = walkBack
    const extend = (nc: number, nd: Dir) => {
      path.push(nc)
      pathMark[nc] = epoch
      cur = nc
      walk = nd
    }

    while (path.length < targetLen) {
      const straight = stepTo(cur, walk)
      let turn = -1
      let turnDir = walk
      let turnScore = -Infinity
      for (const td of [((walk + 1) & 3) as Dir, ((walk + 3) & 3) as Dir]) {
        const nc = stepTo(cur, td)
        if (nc === -1) continue
        const s = (rayHits[nc] > 0 ? p.blockSeeking * 2 : 0) + 0.5 * (4 - freeCount(nc)) + rng.next() * 0.5
        if (s > turnScore) {
          turn = nc
          turnDir = td
          turnScore = s
        }
      }
      if (turn !== -1 && (straight === -1 || rng.next() < p.turnChance)) extend(turn, turnDir)
      else if (straight !== -1) extend(straight, walk)
      else break
    }

    // Swallow a dead-end pocket right behind the tail that nothing else could ever fill.
    while (path.length < p.maxLength + 2) {
      let only = -1
      let onlyDir = walk
      let options = 0
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const nc = stepTo(cur, d)
        if (nc !== -1) {
          options++
          only = nc
          onlyDir = d
        }
      }
      if (options !== 1 || freeCount(only) !== 0) break
      extend(only, onlyDir)
    }

    return path.reverse()
  }
}

/** clear[d*N + cell] = 1 iff every cell strictly beyond `cell` in direction d is empty. */
function computeClear(W: number, H: number, occ: Uint8Array, clear: Uint8Array): void {
  const N = W * H
  for (let x = 0; x < W; x++) {
    clear[0 * N + x] = 1
    for (let y = 1; y < H; y++) {
      const c = y * W + x
      clear[0 * N + c] = occ[c - W] === 0 && clear[0 * N + c - W] ? 1 : 0
    }
    clear[2 * N + (H - 1) * W + x] = 1
    for (let y = H - 2; y >= 0; y--) {
      const c = y * W + x
      clear[2 * N + c] = occ[c + W] === 0 && clear[2 * N + c + W] ? 1 : 0
    }
  }
  for (let y = 0; y < H; y++) {
    const row = y * W
    clear[3 * N + row] = 1
    for (let x = 1; x < W; x++) {
      const c = row + x
      clear[3 * N + c] = occ[c - 1] === 0 && clear[3 * N + c - 1] ? 1 : 0
    }
    clear[1 * N + row + W - 1] = 1
    for (let x = W - 2; x >= 0; x--) {
      const c = row + x
      clear[1 * N + c] = occ[c + 1] === 0 && clear[1 * N + c + 1] ? 1 : 0
    }
  }
}

/** Canonical ids sorted by head cell, so ids leak nothing about the solution order. */
function toLevel(width: number, height: number, placed: Placed[], seed: number): Level {
  const order = placed.map((_, i) => i).sort((a, b) => {
    const pa = placed[a].cells
    const pb = placed[b].cells
    return pa[pa.length - 1] - pb[pb.length - 1]
  })
  const newId = new Int32Array(placed.length)
  const arrows: Arrow[] = order.map((pi, id) => {
    newId[pi] = id
    return { id, cells: placed[pi].cells, dir: placed[pi].dir }
  })
  const solution: number[] = []
  for (let i = placed.length - 1; i >= 0; i--) solution.push(newId[i])
  return { width, height, arrows, solution, seed }
}
