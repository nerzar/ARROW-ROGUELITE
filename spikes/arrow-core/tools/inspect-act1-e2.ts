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

function inspectE2(presetName: PresetName, seed: number) {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return
  const level = res.level
  const a = analyzeSeed(level)

  console.log(`\n======================================================`)
  console.log(`INSPECT ACT1-E2: ${presetName} Seed ${seed} (hash: ${levelHash(level)})`)
  console.log(`Board: ${level.width}x${level.height}, Arrows: ${level.arrows.length}`)
  console.log(`Dirs (N/E/S/W): ${a.dirCounts.join('/')}`)
  console.log(`Initial free: ${a.initialFree.join('/')} (Ids: ${a.initialFreeIds.join(', ')})`)
  console.log(`ASCII:\n${renderAscii(level)}`)

  const def: EncounterDef = {
    id: `act1_e2_${presetName}_${seed}`,
    title: `Act I #2 (${presetName} ${seed})`,
    enemies: [
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'grunt_n', side: 0, hp: 2, attackTimer: { interval: 4, damage: 2 }, label: 'slow' },
    ],
    rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
    blockedTapDamage: 1,
  }

  const sNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const win = minDamageToWin(sNoRot, { nodeBudget: 300000 })
  console.log(`Clean path (0 Rotate, 0 dmg): ${win.win && win.minDamage === 0 ? 'YES' : 'NO'}`)
  if (win.win) {
    console.log(`Sequence (${win.sequence.length} taps): ${win.sequence.map(act => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot').join(' -> ')}`)
  }

  // Check the unlocking dependencies between N and E
  // Specifically: does tapping an arrow of dir N unlock an arrow of dir E, or vice-versa?
  const topo = level.arrows
  for (const act of win.sequence) {
    if (act.kind === 'tap') {
      const arr = topo[act.id]
      console.log(`  Tap #${act.id} (${DIR_NAMES[arr.dir]}): head at [${arr.cells[arr.cells.length-1] % level.width}, ${Math.floor(arr.cells[arr.cells.length-1] / level.width)}]`)
    }
  }
}

const e2Seeds: [PresetName, number][] = [
  ['square6', 2],
  ['square6', 18],
  ['square6', 41],
  ['square6', 89],
  ['square6', 115],
  ['square7', 4],
  ['square7', 15],
  ['square7', 72],
  ['square7', 95],
]

for (const [p, s] of e2Seeds) inspectE2(p, s)
