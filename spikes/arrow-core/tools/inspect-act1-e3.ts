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

function inspectE3(presetName: PresetName, seed: number) {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return
  const level = res.level
  const a = analyzeSeed(level)

  console.log(`\n======================================================`)
  console.log(`INSPECT ACT1-E3: ${presetName} Seed ${seed} (hash: ${levelHash(level)})`)
  console.log(`Board: ${level.width}x${level.height}, Arrows: ${level.arrows.length}`)
  console.log(`Dirs (N/E/S/W): ${a.dirCounts.join('/')}`)
  console.log(`Initial free: ${a.initialFree.join('/')} (Ids: ${a.initialFreeIds.join(', ')})`)
  console.log(`ASCII:\n${renderAscii(level)}`)

  const def: EncounterDef = {
    id: `act1_e3_${presetName}_${seed}`,
    title: `Act I #3 (${presetName} ${seed})`,
    enemies: [
      {
        id: 'caster_n',
        side: 0,
        hp: 3,
        attackTimer: {
          interval: 3,
          damage: 4,
          kind: 'cast',
          interruptible: true,
          interruptedAttack: { interval: 3, damage: 2, kind: 'normal' },
        },
        label: 'caster',
      },
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 4, damage: 2 }, label: 'grunt' },
    ],
    rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
    blockedTapDamage: 1,
  }

  const sNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const win = minDamageToWin(sNoRot, { nodeBudget: 300000 })
  console.log(`Clean path (0 Rotate, 0 dmg): ${win.win && win.minDamage === 0 ? 'YES' : 'NO'}`)
  if (win.win) {
    const seq = win.sequence.map(act => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot')
    console.log(`Sequence (${win.sequence.length} taps): ${seq.join(' -> ')}`)
    const firstNStep = win.sequence.findIndex(act => act.kind === 'tap' && level.arrows[act.id].dir === 0) + 1
    console.log(`  First North hit at step: ${firstNStep} (Cast interrupted at step ${firstNStep} before turn 3 expires)`)
  }

  // Test Mistake: what if player ignores Caster and taps only East arrows or non-interrupting arrows?
  const sMistake = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const freeNonN = sMistake.playableArrows().filter(id => level.arrows[id].dir !== 0)
  if (freeNonN.length >= 3) {
    sMistake.tap(freeNonN[0])
    sMistake.tap(freeNonN[1])
    sMistake.tap(freeNonN[2]) // turn 3 reached without hitting Caster! Cast fires!
    const mRes = minDamageToWin(sMistake, { nodeBudget: 100000 })
    console.log(`Missed cast interrupt test: minDamage=${mRes.minDamage} (Damage taken: ${mRes.minDamage > 0})`)
  }
}

const e3Seeds: [PresetName, number][] = [
  ['square7', 7],
  ['square7', 8],
  ['square7', 10],
  ['square7', 11],
  ['square7', 25],
  ['square7', 38],
  ['square8', 19],
  ['square8', 56],
  ['square8', 114],
]

for (const [p, s] of e3Seeds) inspectE3(p, s)
