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
import { renderAscii } from './cli.js'
import { analyzePattern } from './pattern-miner.js'

export function inspectSeed(preset: PresetName, seed: number) {
  const params = PRESETS[preset]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) {
    console.log(`Failed to generate seed ${seed} for preset ${preset}`)
    return null
  }
  const level = res.level
  const profile = analyzePattern(level, preset)
  const a = analyzeSeed(level)
  const ascii = renderAscii(level)

  console.log(`\n=============================================================`)
  console.log(`PRESET: ${preset} | SEED: ${seed} | HASH: ${profile.hash}`)
  console.log(`SIZE: ${level.width}x${level.height} | ARROWS: ${profile.arrows} | LAYERS: ${profile.layerCount}`)
  console.log(`DIRS (N/E/S/W): ${profile.dirCounts.join('/')}`)
  console.log(`INIT FREE: ${profile.initialFree.join('/')} (total ${profile.initialFreeCount} free, ids: [${a.initialFreeIds.join(', ')}])`)
  console.log(`BRANCH POINTS: ${profile.branchPointsCount}/${profile.arrows} (dir branch: ${profile.dirBranchPointsCount})`)
  console.log(`MAX CASCADE: ${profile.maxCascade} newly freed in single move`)
  console.log(`TAGS: ${profile.tags.join(', ')}`)
  console.log(`DIR SEQUENCE: ${profile.dirSequence}`)
  console.log(`EARLIEST DIRS (N/E/S/W): ${profile.earliestDirStep.join('/')}`)
  console.log(`\nASCII MAP:`)
  console.log(ascii)

  console.log(`\nSTEP-BY-STEP CANONICAL TRACE:`)
  for (const s of a.steps) {
    const newlyStr = s.newlyFree.map((x) => `${DIR_NAMES[x.dir]}#${x.id}`).join(', ') || '—'
    const freeStr = s.freeBefore.join('/')
    console.log(
      `Step ${String(s.step).padStart(2)}: Arrow #${String(s.id).padStart(2)} (${DIR_NAMES[s.dir]}) | Free before [N/E/S/W]: ${freeStr} | Newly freed: ${newlyStr}`
    )
  }

  return { level, profile, a, ascii }
}

const [,, p = 'easy', s = '22'] = process.argv
if (process.argv[1]?.endsWith('inspect-candidate.ts')) {
  inspectSeed(p as PresetName, Number(s))
}
