import type { Level } from './level.js'
import { peelLayers } from './solver.js'
import { BoardState } from './state.js'
import { BoardTopology } from './topology.js'

/**
 * Basic, provisional difficulty metrics. None of them is validated against players yet; the
 * composite `score` is a placeholder for sorting and histograms, not a balance decision.
 */
export interface DifficultyMetrics {
  width: number
  height: number
  arrows: number
  fill: number
  avgLength: number
  maxLength: number
  /** Average number of 90° turns per arrow. */
  turnsPerArrow: number
  /** Arrow count per exit direction [N, E, S, W] — the raw "ammo per side" of an encounter. */
  dirCounts: [number, number, number, number]
  initialFree: number
  initialFreeRatio: number
  /** Longest dependency chain (number of onion-peel layers). */
  depth: number
  widestLayer: number
  /** Mean number of distinct arrows sitting on an arrow's escape ray at the start. */
  avgBlockers: number
  /** Replaying the stored solution: mean of freeArrows / remainingArrows before each move. */
  meanFreeRatio: number
  /** Replaying the stored solution: moves where exactly one arrow was free. */
  forcedMoves: number
  /** Provisional 0..100 composite. */
  score: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function computeMetrics(level: Level, topo = BoardTopology.fromLevel(level)): DifficultyMetrics {
  const n = level.arrows.length
  const w = level.width
  let cells = 0
  let maxLength = 0
  let turns = 0
  const dirCounts: [number, number, number, number] = [0, 0, 0, 0]
  for (const a of level.arrows) {
    cells += a.cells.length
    if (a.cells.length > maxLength) maxLength = a.cells.length
    dirCounts[a.dir]++
    for (let i = 2; i < a.cells.length; i++) {
      const d1 = a.cells[i - 1] - a.cells[i - 2]
      const d2 = a.cells[i] - a.cells[i - 1]
      if (d1 !== d2) turns++
    }
  }

  const state = new BoardState(topo)
  const initialFree = state.freeCount
  let blockerSum = 0
  for (let id = 0; id < n; id++) blockerSum += state.blockers(id).length

  let freeRatioSum = 0
  let forcedMoves = 0
  for (const id of level.solution) {
    const f = state.freeCount
    freeRatioSum += f / state.remaining
    if (f === 1) forcedMoves++
    if (!state.canExit(id)) break
    state.remove(id)
  }

  const { layers } = peelLayers(topo)
  const depth = layers.length
  const initialFreeRatio = n === 0 ? 1 : initialFree / n
  const meanFreeRatio = n === 0 ? 1 : freeRatioSum / n

  const score =
    100 *
    clamp01(
      0.35 * (1 - initialFreeRatio) +
        0.25 * (1 - meanFreeRatio) +
        0.25 * Math.min(depth / 12, 1) +
        0.15 * Math.min(n / 60, 1),
    )

  return {
    width: w,
    height: level.height,
    arrows: n,
    fill: cells / (w * level.height),
    avgLength: n === 0 ? 0 : cells / n,
    maxLength,
    turnsPerArrow: n === 0 ? 0 : turns / n,
    dirCounts,
    initialFree,
    initialFreeRatio,
    depth,
    widestLayer: layers.reduce((m, l) => Math.max(m, l.length), 0),
    avgBlockers: n === 0 ? 0 : blockerSum / n,
    meanFreeRatio,
    forcedMoves,
    score: Math.round(score * 10) / 10,
  }
}
