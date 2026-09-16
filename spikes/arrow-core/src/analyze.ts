import { type Dir, DIR_NAMES } from './dir.js'
import type { Level } from './level.js'
import { peelLayers } from './solver.js'
import { BoardState } from './state.js'
import { BoardTopology } from './topology.js'

/** Counts per exit direction, indexed [N, E, S, W]. */
export type DirCounts = [number, number, number, number]

export interface AnalyzedStep {
  /** 1-based step in the analyzed order. */
  step: number
  id: number
  dir: Dir
  /** Free arrows by direction right before this move. */
  freeBefore: DirCounts
  /** Free arrow ids right before this move. */
  freeIdsBefore: number[]
  /** More than one arrow was free: the player had a real choice here. */
  branch: boolean
  /** Number of distinct directions among the free arrows before the move. */
  dirChoice: number
  /** Arrows that became free because of this removal. */
  newlyFree: { id: number; dir: Dir }[]
  newlyFreeDirs: DirCounts
  /** Alive arrows by direction after the move. */
  remaining: DirCounts
}

/**
 * Seed-level facts an encounter designer needs before putting targets around a board: ammo per
 * side, when each side becomes reachable and where the player gets to choose.
 */
export interface SeedAnalysis {
  width: number
  height: number
  seed?: number
  arrows: number
  dirCounts: DirCounts
  initialFree: DirCounts
  initialFreeIds: number[]
  /** The analyzed removal order: the level's stored (generator) solution. */
  order: number[]
  /** Direction letters of `order`, e.g. "EEWNS…". */
  dirSequence: string
  steps: AnalyzedStep[]
  /** Steps (1-based) where more than one arrow was free. */
  branchPoints: number[]
  /** Steps (1-based) where free arrows pointed in at least two different directions. */
  dirBranchPoints: number[]
  /** Order-independent: arrows per onion-peel layer by direction. layerDirs[k] = counts of layer k. */
  layerDirs: DirCounts[]
  /** Order-independent: first peel layer in which each direction has a free arrow (-1: none). */
  firstLayerByDir: [number, number, number, number]
}

const zero = (): DirCounts => [0, 0, 0, 0]

export function countByDir(topo: BoardTopology, ids: Iterable<number>): DirCounts {
  const c = zero()
  for (const id of ids) c[topo.dirs[id]]++
  return c
}

function aliveByDir(state: BoardState): DirCounts {
  const c = zero()
  for (let id = 0; id < state.topo.arrowCount; id++) if (state.isAlive(id)) c[state.topo.dirs[id]]++
  return c
}

/** Analyzes `order` (default: the level's stored solution). Throws if the order is not legal. */
export function analyzeSeed(level: Level, order: readonly number[] = level.solution): SeedAnalysis {
  const topo = BoardTopology.fromLevel(level)
  const state = new BoardState(topo)
  const initialFreeIds = state.freeArrows()
  const steps: AnalyzedStep[] = []
  const newly: number[] = []

  order.forEach((id, i) => {
    const freeIdsBefore = state.freeArrows()
    if (!state.canExit(id)) throw new Error(`step ${i + 1}: arrow ${id} cannot exit`)
    const freeBefore = countByDir(topo, freeIdsBefore)
    newly.length = 0
    state.remove(id, newly)
    steps.push({
      step: i + 1,
      id,
      dir: topo.dirs[id] as Dir,
      freeBefore,
      freeIdsBefore,
      branch: freeIdsBefore.length > 1,
      dirChoice: freeBefore.filter((n) => n > 0).length,
      newlyFree: newly.map((a) => ({ id: a, dir: topo.dirs[a] as Dir })),
      newlyFreeDirs: countByDir(topo, newly),
      remaining: aliveByDir(state),
    })
  })

  const { layers } = peelLayers(topo)
  const layerDirs = layers.map((l) => countByDir(topo, l))
  const firstLayerByDir = [0, 1, 2, 3].map((d) => layerDirs.findIndex((c) => c[d] > 0)) as SeedAnalysis['firstLayerByDir']

  return {
    width: level.width,
    height: level.height,
    seed: level.seed,
    arrows: level.arrows.length,
    dirCounts: countByDir(topo, level.arrows.map((a) => a.id)),
    initialFree: countByDir(topo, initialFreeIds),
    initialFreeIds,
    order: [...order],
    dirSequence: order.map((id) => DIR_NAMES[topo.dirs[id]]).join(''),
    steps,
    branchPoints: steps.filter((s) => s.branch).map((s) => s.step),
    dirBranchPoints: steps.filter((s) => s.dirChoice > 1).map((s) => s.step),
    layerDirs,
    firstLayerByDir,
  }
}

/**
 * EXP-010: fast, order-dependent timing facts for one side, along the *canonical* (generator)
 * solve order only — a cheap pre-filter for shortlisting E3/E4-style timed encounters, not a proof.
 * The real, exhaustive "does a no-damage path exist / what is the minimum unavoidable damage"
 * question — over every possible play order, with the actual attackTimer wired in — is answered by
 * `minDamageToWin` in encounter-solver.ts; this only tells a scanner "is this seed even worth trying".
 */
export interface TimedSideAnalysis {
  side: Dir
  /** Turn (1-based) at which this side first has a free arrow along the analyzed order; -1 if never. */
  earliestHitTurn: number
  /** Turns (1-based) at which at least one arrow of this side is free — legal "hit or interrupt" turns. */
  hitOpportunityTurns: number[]
  /** Largest gap in turns between one opportunity and the next (or from turn 1 to the first one). */
  maxGap: number
  /** Total turns to fully clear the board along the analyzed order (docs/COMBAT-RULES.md 11). */
  boardClearTurns: number
  /** Would a countdown of this length always have had a chance to land a hit, along this order? */
  fitsCountdown(countdown: number): boolean
}

export function hitTiming(a: SeedAnalysis, side: Dir): TimedSideAnalysis {
  const hitOpportunityTurns = a.steps.filter((s) => s.freeBefore[side] > 0).map((s) => s.step)
  const earliestHitTurn = hitOpportunityTurns[0] ?? -1
  let maxGap = 0
  if (earliestHitTurn > 0) {
    maxGap = earliestHitTurn - 1
    for (let i = 1; i < hitOpportunityTurns.length; i++) {
      maxGap = Math.max(maxGap, hitOpportunityTurns[i] - hitOpportunityTurns[i - 1])
    }
  }
  return {
    side,
    earliestHitTurn,
    hitOpportunityTurns,
    maxGap,
    boardClearTurns: a.steps.length,
    fitsCountdown: (countdown: number) => earliestHitTurn > 0 && maxGap <= countdown,
  }
}

export const fmtDirs = (c: readonly number[]): string => DIR_NAMES.map((n, d) => `${n}${c[d]}`).join(' ')

/** Plain-text report for the CLI. */
export function formatSeedAnalysis(a: SeedAnalysis): string {
  const newlyText = (s: AnalyzedStep) =>
    s.newlyFree.length === 0 ? '—' : s.newlyFree.map((f) => `${DIR_NAMES[f.dir]}#${f.id}`).join(' ')
  const lines = [
    `board ${a.width}x${a.height}  seed ${a.seed ?? '—'}  arrows ${a.arrows}`,
    `arrows by dir     ${fmtDirs(a.dirCounts)}`,
    `initial free      ${fmtDirs(a.initialFree)}   ids [${a.initialFreeIds.join(', ')}]`,
    `first peel layer  ${DIR_NAMES.map((n, d) => `${n}${a.firstLayerByDir[d] < 0 ? '-' : a.firstLayerByDir[d]}`).join(' ')}` +
      `   (0 = free at start, order-independent)`,
    `layers by dir     ${a.layerDirs.map((c, k) => `L${k}[${fmtDirs(c)}]`).join('  ')}`,
    '',
    `canonical order (stored solution): ${a.order.join(' ')}`,
    `direction sequence:                ${a.dirSequence}`,
    '',
    'step  id  dir | free before (N E S W) | branch | newly free        | remaining (N E S W)',
    '----  --  --- | --------------------- | ------ | ----------------- | -------------------',
  ]
  for (const s of a.steps) {
    lines.push(
      `${String(s.step).padStart(4)}  ${String(s.id).padStart(2)}   ${DIR_NAMES[s.dir]}  | ` +
        `${s.freeBefore.map((n) => String(n).padStart(2)).join(' ')}  (${String(s.freeIdsBefore.length).padStart(2)} free)  | ` +
        `${s.branch ? (s.dirChoice > 1 ? `dir×${s.dirChoice}` : 'yes  ') : '  —  '}  | ` +
        `${newlyText(s).padEnd(17)} | ${s.remaining.map((n) => String(n).padStart(2)).join(' ')}`,
    )
  }
  lines.push(
    '',
    `branch points (>1 free):        ${a.branchPoints.length}/${a.steps.length}  [${a.branchPoints.join(', ')}]`,
    `direction branch points (>1 dir): ${a.dirBranchPoints.length}/${a.steps.length}  [${a.dirBranchPoints.join(', ')}]`,
  )
  return lines.join('\n')
}
