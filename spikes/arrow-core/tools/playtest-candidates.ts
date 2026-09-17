import {
  analyzeSeed,
  BoardTopology,
  BoardState,
  DIR_NAMES,
  type Dir,
  generateLevel,
  type Level,
  levelHash,
  peelLayers,
  PRESETS,
  type PresetName,
  solveBoard,
} from '../src/index.js'
import { analyzePattern, type BoardPatternProfile } from './pattern-miner.js'

export interface CandidatePlaytest {
  seed: number
  preset: PresetName
  pattern: string
  title: string
  arrows: number
  size: string
  dirCounts: string
  initialFree: string
  intendedPath: string
  alternatePath: string
  naturalMistake: string
  recoveryPossibility: string
  visualReadability: string
  bestEnemyPairing: string
  whyInteresting: string
  bossSuitability: string
  profile: BoardPatternProfile
}

export function playtestBoard(
  preset: PresetName,
  seed: number,
  pattern: string,
  title: string,
  pairing: string,
  bossSuitability = 'None'
): CandidatePlaytest {
  const params = PRESETS[preset]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) throw new Error(`Cannot gen ${preset} ${seed}`)
  const level = res.level
  const topo = BoardTopology.fromLevel(level)
  const a = analyzeSeed(level)
  const profile = analyzePattern(level, preset)

  // Explore paths
  const state = new BoardState(topo)
  const initialFree = state.freeArrows()

  // Intended path is canonical
  const intendedPath = a.steps.map((s) => `${DIR_NAMES[s.dir]}#${s.id}`).join(' -> ')

  // Check alternative first moves
  let alternatePath = 'Single linear opening'
  if (initialFree.length > 1) {
    // Pick second free arrow
    const alt0 = initialFree[1]
    const stateAlt = new BoardState(topo)
    const newly: number[] = []
    stateAlt.remove(alt0, newly)
    const nextFree = stateAlt.freeArrows()
    alternatePath = `${DIR_NAMES[topo.dirs[alt0]]}#${alt0} -> then ${nextFree.map((id) => `${DIR_NAMES[topo.dirs[id]]}#${id}`).join(', ')}`
  }

  // Identify natural mistake
  let naturalMistake = 'Mindless peel of outer arrows'
  const freeLengths = initialFree.map((id) => ({ id, len: level.arrows.find((a) => a.id === id)!.cells.length }))
  freeLengths.sort((x, y) => y.len - x.len)
  if (freeLengths.length >= 2 && freeLengths[0].len > freeLengths[1].len) {
    naturalMistake = `Greedy click on long Arrow #${freeLengths[0].id} (len ${freeLengths[0].len}) which opens 0 subsequent arrows, delaying tempo.`
  }

  const recoveryPossibility =
    profile.branchPointsCount >= profile.arrows * 0.5
      ? 'High recovery: board has multiple branch points; an error loses tempo/HP but does not hard-lock.'
      : 'Low/Tight recovery: highly linear dependency; a wrong move wastes 2+ turns and risks heavy timer damage.'

  const visualReadability =
    profile.maxArrowLength >= 5
      ? `Distinct silhouettes: dominant long arrows (max len ${profile.maxArrowLength}) create clear visual landmarks.`
      : `Compact mesh: uniform arrow lengths (max len ${profile.maxArrowLength}), requires closer inspection of heads.`

  return {
    seed,
    preset,
    pattern,
    title,
    arrows: level.arrows.length,
    size: `${level.width}x${level.height}`,
    dirCounts: profile.dirCounts.join('/'),
    initialFree: profile.initialFree.join('/'),
    intendedPath,
    alternatePath,
    naturalMistake,
    recoveryPossibility,
    visualReadability,
    bestEnemyPairing: pairing,
    whyInteresting: profile.tags.join(', '),
    bossSuitability,
    profile,
  }
}
