import {
  analyzeSeed,
  DIR_NAMES,
  type EncounterDef,
  EncounterState,
  generateLevel,
  levelHash,
  minDamageToWin,
  PRESETS,
  type PresetName,
} from '../src/index.js'
import { renderAscii } from './cli.js'

function inspectE1(presetName: PresetName, seed: number) {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return
  const level = res.level
  const a = analyzeSeed(level)

  console.log(`\n======================================================`)
  console.log(`INSPECT ACT1-E1: ${presetName} Seed ${seed} (hash: ${levelHash(level)})`)
  console.log(`Board: ${level.width}x${level.height}, Arrows: ${level.arrows.length}`)
  console.log(`Dirs (N/E/S/W): ${a.dirCounts.join('/')}`)
  console.log(`Initial free: ${a.initialFree.join('/')} (Ids: ${a.initialFreeIds.join(', ')})`)
  console.log(`ASCII:\n${renderAscii(level)}`)

  const def: EncounterDef = {
    id: `act1_e1_${presetName}_${seed}`,
    title: `Act I #1 (${presetName} ${seed})`,
    enemies: [
      { id: 'grunt_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'grunt_e', side: 1, hp: 3, attackTimer: { interval: 5, damage: 2 }, label: 'slow' },
    ],
    rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
    blockedTapDamage: 1,
  }

  // Check 0 Rotate clean win
  const sNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const win = minDamageToWin(sNoRot, { nodeBudget: 300000 })
  console.log(`Clean path (0 Rotate, 0 dmg): ${win.win && win.minDamage === 0 ? 'YES' : 'NO'}`)
  if (win.win) {
    console.log(`Sequence (${win.sequence.length} taps): ${win.sequence.map(act => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot').join(' -> ')}`)
  }

  // Test Mistake: Player attacks East first!
  const sMistake = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const freeE = sMistake.playableArrows().filter((id) => level.arrows[id].dir === 1)
  console.log(`Free E on start: ${freeE.map(id => `#${id}`).join(', ')}`)
  if (freeE.length > 0) {
    sMistake.tap(freeE[0])
    const freeE2 = sMistake.playableArrows().filter((id) => level.arrows[id].dir === 1)
    if (freeE2.length > 0) sMistake.tap(freeE2[0])
    const mRes = minDamageToWin(sMistake, { nodeBudget: 100000 })
    console.log(`Mistake path (shoot E first): win=${mRes.win}, minDamage=${mRes.minDamage} (Player punished: ${mRes.minDamage > 0})`)
  }

  // Test Rotate rescue
  if (freeE.length > 0) {
    const sRescue = EncounterState.fromLevel(level, def, 10)
    sRescue.tap(freeE[0])
    // Player made mistake, can Rotate rescue them with 0 damage?
    const rRes = minDamageToWin(sRescue, { nodeBudget: 100000 })
    console.log(`Rotate rescue after 1st mistake: minDamage=${rRes.minDamage}, usedRotate=${rRes.sequence.some(a => a.kind === 'rotate')}`)
  }
}

const e1Seeds: [PresetName, number][] = [
  ['square6', 57],
  ['square6', 350],
  ['square6', 380],
  ['square7', 112],
  ['square7', 143],
  ['square7', 162],
  ['square7', 225],
  ['square8', 42],
  ['square8', 101],
]

for (const [p, s] of e1Seeds) inspectE1(p, s)
