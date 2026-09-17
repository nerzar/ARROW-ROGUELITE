import {
  analyzeSeed,
  BoardState,
  BoardTopology,
  DIR_NAMES,
  type Dir,
  type EncounterDef,
  EncounterState,
  generateLevel,
  type Level,
  levelHash,
  minDamageToWin,
  findWin,
  PRESETS,
  type PresetName,
} from '../src/index.js'
import { renderAscii } from './cli.js'

function inspectBoss(presetName: PresetName, seed: number) {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) {
    console.log(`Failed to generate ${presetName} ${seed}`)
    return
  }
  const level = res.level
  const a = analyzeSeed(level)

  console.log(`\n======================================================`)
  console.log(`INSPECT BOSS: ${presetName} Seed ${seed} (hash: ${levelHash(level)})`)
  console.log(`Board: ${level.width}x${level.height}, Arrows: ${level.arrows.length}`)
  console.log(`Dirs (N/E/S/W): ${a.dirCounts.join('/')}`)
  console.log(`Initial free: ${a.initialFree.join('/')} (Ids: ${a.initialFreeIds.join(', ')})`)
  console.log(`ASCII:\n${renderAscii(level)}`)

  const def: EncounterDef = {
    id: `prologue_boss_${presetName}_${seed}`,
    title: `Prologue Boss (${presetName} ${seed})`,
    boss: {
      id: 'goblin-shaman',
      phases: [
        { side: 1, hpUnits: 4, attackTimer: { interval: 6, damage: 1 }, label: 'Phase 1: E' },
        {
          side: 0,
          hpUnits: 5,
          grantRotate: 1,
          attackTimer: {
            interval: 3,
            damage: 1,
            kind: 'cast',
            interruptible: true,
            interruptedAttack: { interval: 4, damage: 1, kind: 'normal' },
          },
          label: 'Phase 2: N (cast)',
        },
      ],
    },
    rotate: { allow: [1, -1], advancesTurn: false },
    blockedTapDamage: 1,
    winRotateReward: 2,
  }

  // Check no-rotate win
  const sNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const noRotRes = findWin(sNoRot, { nodeBudget: 100000 })
  console.log(`Win without Rotate: ${noRotRes.win ? 'YES (WARNING: Rotate not mandatory for finish)' : 'NO (PROVEN: Rotate mandatory)'}`)

  // Check overall min damage with Rotate
  const sWithRot = EncounterState.fromLevel(level, def, 10)
  const winRot = minDamageToWin(sWithRot, { nodeBudget: 500000 })
  console.log(`Clean path with Rotate (0 damage): ${winRot.win && winRot.minDamage === 0 ? 'YES' : 'NO'}`)
  if (winRot.win) {
    console.log(`Example winning sequence:`)
    console.log(`  ${winRot.sequence.map((act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : `Rot(${act.turn > 0 ? 'cw' : 'ccw'})`).join(' -> ')}`)
  }

  // Phase 1 natural peel test
  const sPhase1 = EncounterState.fromLevel(level, def, 10)
  const p1Actions: number[] = []
  while (sPhase1.phaseIndex === 0) {
    const freeE = sPhase1.playableArrows().find((id) => level.arrows[id].dir === 1)
    if (freeE !== undefined) {
      p1Actions.push(freeE)
      sPhase1.tap(freeE)
    } else {
      const anyFree = sPhase1.playableArrows()[0]
      if (anyFree === undefined) break
      p1Actions.push(anyFree)
      sPhase1.tap(anyFree)
    }
  }

  console.log(`Natural Phase 1 peel: ${p1Actions.map(id => `#${id}(${DIR_NAMES[level.arrows[id].dir]})`).join(' -> ')}`)
  console.log(`At start of Phase 2: HP remaining = ${sPhase1.playerHp}, phase = ${sPhase1.phaseIndex}`)

  if (sPhase1.phaseIndex === 1) {
    // Test Rotate CW
    const sCW = sPhase1.clone()
    sCW.rotate(1)
    const resCW = minDamageToWin(sCW, { maxRotates: 0, nodeBudget: 200000 })
    console.log(`  Rotate CW after natural P1: win=${resCW.win}, minDamage=${resCW.minDamage}`)
    if (resCW.win) {
      console.log(`    CW Seq: ${resCW.sequence.map(act => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot').join(' -> ')}`)
    }

    // Test Rotate CCW
    const sCCW = sPhase1.clone()
    sCCW.rotate(-1)
    const resCCW = minDamageToWin(sCCW, { maxRotates: 0, nodeBudget: 200000 })
    console.log(`  Rotate CCW after natural P1: win=${resCCW.win}, minDamage=${resCCW.minDamage}`)
    if (resCCW.win) {
      console.log(`    CCW Seq: ${resCCW.sequence.map(act => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot').join(' -> ')}`)
    }
  }
}

const seedsToInspect: [PresetName, number][] = [
  ['square8', 228],
  ['square8', 388],
  ['square8', 455],
  ['square8', 489],
  ['square7', 12],
  ['square7', 31],
  ['square7', 98],
  ['square8', 397],
  ['square8', 257],
]

for (const [p, s] of seedsToInspect) {
  inspectBoss(p, s)
}
