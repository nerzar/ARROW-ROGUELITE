import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
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

export interface BoardPatternProfile {
  seed: number
  preset: PresetName
  width: number
  height: number
  arrows: number
  hash: string
  dirCounts: [number, number, number, number] // N, E, S, W
  initialFree: [number, number, number, number]
  initialFreeCount: number
  initialFreeDirs: number
  layerCount: number
  layerCounts: number[]
  solutionLength: number
  dirSequence: string
  branchPointsCount: number
  dirBranchPointsCount: number
  maxCascade: number // max newly freed in a single move
  cascadeSteps: { step: number; arrowId: number; newlyFreed: number }[]
  bottlenecks: { arrowId: number; step: number; unlocksCount: number; downstreamCount: number }[]
  earliestDirStep: [number, number, number, number] // 1-based step when N, E, S, W first free
  crossLocks: { dirA: Dir; dirB: Dir; stepA: number; stepB: number }[]
  isForcedOpening: boolean
  isWideOpening: boolean
  hasDirectionScarcity: boolean
  scarcityDirs: Dir[]
  hasDirectionFlood: boolean
  floodDir: Dir | null
  hasDirectionSwitch: boolean
  hasLayeredGates: boolean
  hasRotateBait: boolean
  rotateCWGains: [number, number, number, number] // how counts change if rotated CW
  hasLongArrows: boolean
  maxArrowLength: number
  isSymmetric: boolean
  hasFalseTemptation: boolean
  hasDelayedPayoff: boolean
  delayedPayoffDirs: Dir[]
  isBoringLinear: boolean
  isTrivialPeel: boolean
  tags: string[]
}

export function analyzePattern(level: Level, presetName: PresetName): BoardPatternProfile {
  const topo = BoardTopology.fromLevel(level)
  const a = analyzeSeed(level)
  const { layers } = peelLayers(topo)
  const state = new BoardState(topo)

  const initialFree = a.initialFree
  const initialFreeCount = a.initialFreeIds.length
  const initialFreeDirs = initialFree.filter((c) => c > 0).length

  // Cascade analysis & bottleneck tracking
  let maxCascade = 0
  const cascadeSteps: { step: number; arrowId: number; newlyFreed: number }[] = []
  const bottlenecks: { arrowId: number; step: number; unlocksCount: number; downstreamCount: number }[] = []

  // Earliest turn each direction is playable
  const earliestDirStep: [number, number, number, number] = [-1, -1, -1, -1]
  for (let d = 0; d < 4; d++) {
    if (initialFree[d] > 0) earliestDirStep[d] = 1
  }

  // Cross-lock detection
  const crossLocks: { dirA: Dir; dirB: Dir; stepA: number; stepB: number }[] = []

  // Simulate canonical solution to capture step dynamics
  for (let i = 0; i < a.steps.length; i++) {
    const s = a.steps[i]
    for (let d = 0; d < 4; d++) {
      if (earliestDirStep[d] === -1 && s.freeBefore[d] > 0) {
        earliestDirStep[d] = s.step
      }
    }

    const newlyCount = s.newlyFree.length
    if (newlyCount > maxCascade) maxCascade = newlyCount
    if (newlyCount >= 2) {
      cascadeSteps.push({ step: s.step, arrowId: s.id, newlyFreed: newlyCount })
    }

    // Bottleneck: single move frees >= 3 arrows, or frees >= 25% of remaining arrows
    const remainingCount = s.remaining.reduce((sum, n) => sum + n, 0)
    if (newlyCount >= 3 || (newlyCount >= 2 && remainingCount > 0 && newlyCount / (remainingCount + 1) >= 0.35)) {
      bottlenecks.push({
        arrowId: s.id,
        step: s.step,
        unlocksCount: newlyCount,
        downstreamCount: remainingCount,
      })
    }

    // Cross-lock: this move of dirA unlocks dirB, check if an earlier move of dirB unlocked dirA
    for (const nf of s.newlyFree) {
      if (nf.dir !== s.dir) {
        // check earlier steps
        for (let j = 0; j < i; j++) {
          const prevS = a.steps[j]
          if (prevS.dir === nf.dir && prevS.newlyFree.some((x) => x.dir === s.dir)) {
            crossLocks.push({ dirA: s.dir, dirB: nf.dir, stepA: s.step, stepB: prevS.step })
          }
        }
      }
    }
  }

  // Direction scarcity / flood
  const scarcityDirs: Dir[] = []
  let floodDir: Dir | null = null
  for (let d = 0; d < 4; d++) {
    if (a.dirCounts[d] <= 1 || (a.dirCounts[d] <= 2 && a.arrows >= 14)) {
      scarcityDirs.push(d as Dir)
    }
    if (a.dirCounts[d] / a.arrows >= 0.45) {
      floodDir = d as Dir
    }
  }
  const hasDirectionScarcity = scarcityDirs.length > 0
  const hasDirectionFlood = floodDir !== null

  // Direction switch: divide solution into halves, check if dominant directions flip
  const half = Math.floor(a.steps.length / 2)
  const firstHalfDirs = [0, 0, 0, 0]
  const secondHalfDirs = [0, 0, 0, 0]
  for (let i = 0; i < a.steps.length; i++) {
    const d = a.steps[i].dir
    if (i < half) firstHalfDirs[d]++
    else secondHalfDirs[d]++
  }
  const firstDominant = firstHalfDirs.map((c, d) => ({ d, c })).sort((a, b) => b.c - a.c)[0]
  const secondDominant = secondHalfDirs.map((c, d) => ({ d, c })).sort((a, b) => b.c - a.c)[0]
  const hasDirectionSwitch = firstDominant.d !== secondDominant.d && firstDominant.c >= 3 && secondDominant.c >= 3

  // Layered Gates: onion peel depth >= 4 for easy, >= 5 for medium, >= 6 for hard
  const minLayerThreshold = presetName === 'easy' ? 4 : presetName === 'medium' ? 5 : 6
  const hasLayeredGates = layers.length >= minLayerThreshold

  // Openings
  const isForcedOpening = initialFreeCount === 1
  const isWideOpening = initialFreeCount >= 4 && initialFreeDirs >= 3

  // Long arrows
  const arrowLengths = level.arrows.map((arr) => arr.cells.length)
  const maxArrowLength = Math.max(...arrowLengths)
  const longThreshold = presetName === 'easy' ? 4 : presetName === 'medium' ? 5 : 6
  const hasLongArrows = maxArrowLength >= longThreshold

  // Rotate Bait: CW rotation transforms [N, E, S, W] -> [E, S, W, N]
  // If one direction is scarce (<=1) and the source direction (CW source) has >= 4 arrows
  // CW: N becomes E, E becomes S, S becomes W, W becomes N
  // rotateCWGains: for target dir d, source dir is (d + 3) % 4
  const rotateCWGains: [number, number, number, number] = [
    a.dirCounts[3] - a.dirCounts[0], // new N came from W
    a.dirCounts[0] - a.dirCounts[1], // new E came from N
    a.dirCounts[1] - a.dirCounts[2], // new S came from E
    a.dirCounts[2] - a.dirCounts[3], // new W came from S
  ]
  const hasRotateBait = rotateCWGains.some((gain) => gain >= 3) && hasDirectionScarcity

  // Symmetry: check horizontal or vertical mirror of arrow origins & directions
  let symH = true
  let symV = true
  const w = level.width
  const h = level.height
  const grid = new Map<number, { dir: Dir; len: number }>()
  for (const arr of level.arrows) {
    const head = arr.cells[arr.cells.length - 1]
    grid.set(head, { dir: arr.dir, len: arr.cells.length })
  }
  // Symmetry test is conservative
  let symmetricCells = 0
  for (const [cell, info] of grid.entries()) {
    const x = cell % w
    const y = Math.floor(cell / w)
    const mirrorX = (w - 1 - x) + y * w
    const mirrorY = x + (h - 1 - y) * w
    if (grid.has(mirrorX)) symmetricCells++
  }
  const isSymmetric = symmetricCells >= level.arrows.length * 0.7 && level.arrows.length >= 8

  // Delayed Payoff: a direction exists (counts >= 2) but is only reachable after step >= 4
  const delayedPayoffDirs: Dir[] = []
  for (let d = 0; d < 4; d++) {
    if (a.dirCounts[d] >= 2 && earliestDirStep[d] >= 4) {
      delayedPayoffDirs.push(d as Dir)
    }
  }
  const hasDelayedPayoff = delayedPayoffDirs.length > 0

  // False Temptation: at start, there is a large/obvious arrow free that unlocks 0 arrows,
  // while a smaller arrow unlocks 2+ arrows
  let hasFalseTemptation = false
  if (initialFreeCount >= 2) {
    const startStepUnlocks = new Map<number, number>()
    for (let k = 0; k < Math.min(initialFreeCount, 3); k++) {
      startStepUnlocks.set(a.steps[k].id, a.steps[k].newlyFree.length)
    }
    const initialLengths = a.initialFreeIds.map((id) => {
      const arr = level.arrows.find((x) => x.id === id)!
      return { id, len: arr.cells.length }
    })
    initialLengths.sort((x, y) => y.len - x.len)
    const biggest = initialLengths[0]
    const smallest = initialLengths[initialLengths.length - 1]
    if (biggest.len >= 3 && (startStepUnlocks.get(biggest.id) ?? 0) === 0 && (startStepUnlocks.get(smallest.id) ?? 0) >= 1) {
      hasFalseTemptation = true
    }
  }

  // Boring linear conveyor: branchPoints count <= 2 on a board with >= 10 arrows
  const isBoringLinear = a.branchPoints.length <= 2 && a.arrows >= 10
  // Trivial peel: layers count <= 2 (everything is on the surface)
  const isTrivialPeel = layers.length <= 2 && a.arrows >= 8

  // Collect Tags
  const tags: string[] = []
  if (maxCascade >= 3) tags.push('CHAIN_UNLOCK')
  if (bottlenecks.length > 0) tags.push('BOTTLENECK')
  if (hasFalseTemptation) tags.push('FALSE_TEMPTATION')
  if (hasDirectionScarcity) tags.push('DIRECTION_SCARCITY')
  if (hasDirectionFlood) tags.push('DIRECTION_FLOOD')
  if (crossLocks.length > 0) tags.push('CROSS_LOCK')
  if (hasLayeredGates) tags.push('LAYERED_GATES')
  if (isWideOpening) tags.push('CHOICE_OF_OPENING')
  if (isForcedOpening) tags.push('FORCED_OPENING')
  if (hasDelayedPayoff) tags.push('DELAYED_PAYOFF')
  if (hasDirectionSwitch) tags.push('DIRECTION_SWITCH')
  if (hasRotateBait) tags.push('ROTATE_BAIT')
  if (isSymmetric) tags.push('SYMMETRIC')
  if (hasLongArrows) tags.push('LONG_PATH_REVEAL')
  if (isBoringLinear) tags.push('BORING_LINEAR')
  if (isTrivialPeel) tags.push('TRIVIAL_PEEL')

  return {
    seed: level.seed ?? 0,
    preset: presetName,
    width: level.width,
    height: level.height,
    arrows: level.arrows.length,
    hash: levelHash(level),
    dirCounts: a.dirCounts,
    initialFree,
    initialFreeCount,
    initialFreeDirs,
    layerCount: layers.length,
    layerCounts: layers.map((l) => l.length),
    solutionLength: a.order.length,
    dirSequence: a.dirSequence,
    branchPointsCount: a.branchPoints.length,
    dirBranchPointsCount: a.dirBranchPoints.length,
    maxCascade,
    cascadeSteps,
    bottlenecks,
    earliestDirStep,
    crossLocks,
    isForcedOpening,
    isWideOpening,
    hasDirectionScarcity,
    scarcityDirs,
    hasDirectionFlood,
    floodDir,
    hasDirectionSwitch,
    hasLayeredGates,
    hasRotateBait,
    rotateCWGains,
    hasLongArrows,
    maxArrowLength,
    isSymmetric,
    hasFalseTemptation,
    hasDelayedPayoff,
    delayedPayoffDirs,
    isBoringLinear,
    isTrivialPeel,
    tags,
  }
}

export interface ScanSummary {
  preset: PresetName
  scanned: number
  patternCounts: Record<string, number>
  patternSamples: Record<string, BoardPatternProfile[]>
}

export function runPatternMining(
  presetName: PresetName,
  startSeed: number,
  seedCount: number,
  maxSamplesPerPattern = 15
): ScanSummary {
  const params = PRESETS[presetName]
  const patternCounts: Record<string, number> = {}
  const patternSamples: Record<string, BoardPatternProfile[]> = {}

  for (let i = 0; i < seedCount; i++) {
    const seed = (startSeed + i) >>> 0
    const res = generateLevel(params, seed)
    if (!res.ok || !res.level) continue
    const profile = analyzePattern(res.level, presetName)

    for (const tag of profile.tags) {
      patternCounts[tag] = (patternCounts[tag] ?? 0) + 1
      if (!patternSamples[tag]) patternSamples[tag] = []
      if (patternSamples[tag].length < maxSamplesPerPattern) {
        patternSamples[tag].push(profile)
      }
    }
  }

  return {
    preset: presetName,
    scanned: seedCount,
    patternCounts,
    patternSamples,
  }
}
