import type { Level } from './level.js'
import { BoardState } from './state.js'
import { BoardTopology } from './topology.js'

export interface SolveResult {
  solvable: boolean
  /** A legal removal order. Complete iff `solvable`; otherwise the longest greedy prefix. */
  order: number[]
  /** Arrows left when the solver got stuck (empty if solvable). They block each other in a cycle. */
  stuck: number[]
}

/**
 * BoardSolver — pure Tap Away solvability.
 *
 * Removing an arrow only ever empties cells, so an arrow that can leave stays able to leave. Hence
 * the set of removable arrows only grows, any greedy order reaches the same final state, and
 * "greedy gets stuck" <=> "no order clears the board". A work-list over newly freed arrows makes
 * this O(total body length + total ray length). Technique follows sergev/goarrows (MIT).
 *
 * This solver knows nothing about encounters. An EncounterSolver should reuse BoardState
 * (freeArrows / remove / undo / clone) to search over *which* legal order is best for targets.
 */
export function solveBoard(input: Level | BoardTopology): SolveResult {
  const topo = input instanceof BoardTopology ? input : BoardTopology.fromLevel(input)
  const state = new BoardState(topo)
  const queue = state.freeArrows()
  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    if (state.canExit(id)) state.remove(id, queue)
  }
  const stuck: number[] = []
  if (!state.cleared) for (let id = 0; id < topo.arrowCount; id++) if (state.isAlive(id)) stuck.push(id)
  return { solvable: state.cleared, order: [...state.removed], stuck }
}

export interface Layers {
  solvable: boolean
  /** layers[k] = arrows removable once every arrow in layers[0..k-1] is gone ("onion peel"). */
  layers: number[][]
}

/**
 * Peels the board layer by layer. The number of layers is the length of the longest dependency
 * chain: arrow A in layer k has some blocker in layer k-1 that must go first.
 */
export function peelLayers(input: Level | BoardTopology): Layers {
  const topo = input instanceof BoardTopology ? input : BoardTopology.fromLevel(input)
  const state = new BoardState(topo)
  const layers: number[][] = []
  let current = state.freeArrows()
  while (current.length > 0) {
    layers.push(current)
    const next: number[] = []
    for (const id of current) state.remove(id, next)
    current = next.filter((id) => state.canExit(id))
  }
  return { solvable: state.cleared, layers }
}
