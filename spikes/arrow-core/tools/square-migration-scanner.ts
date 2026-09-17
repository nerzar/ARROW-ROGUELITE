import {
  analyzeSeed,
  BoardState,
  BoardTopology,
  DIR_NAMES,
  type Dir,
  type EncounterDef,
  EncounterState,
  generateLevel,
  type GeneratorParams,
  type Level,
  levelHash,
  minDamageToWin,
  findWin,
  PRESETS,
  type PresetName,
} from '../src/index.js'

export interface CandidateScanResult {
  preset: PresetName
  seed: number
  hash: string
  arrows: number
  dirCounts: [number, number, number, number] // N, E, S, W
  initialFree: [number, number, number, number]
  cleanPath: boolean
  minDamage: number
  sequence: string[]
  details: any
}

// -----------------------------------------------------------------------------
// 1. Scan Prologue Boss Candidates
// -----------------------------------------------------------------------------

export function testPrologueBossCandidate(
  presetName: PresetName,
  seed: number,
): CandidateScanResult | null {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return null
  const level = res.level

  const def: EncounterDef = {
    id: `prologue_boss_${presetName}_${seed}`,
    title: `Prologue Boss Square (${presetName} ${seed})`,
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

  const a = analyzeSeed(level)
  const nArrows = a.dirCounts[0]
  const eArrows = a.dirCounts[1]
  const sArrows = a.dirCounts[2]
  const wArrows = a.dirCounts[3]

  // We need at least 4 E arrows for phase 1
  if (eArrows < 4) return null
  // We want North arrows alone to NOT be enough for Phase 2 (5 hp), or barely 1-3 arrows
  if (nArrows >= 5) return null // If board already has 5+ N arrows, Rotate isn't necessary!

  // First: check without Rotate
  const stateNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const winNoRot = findWin(stateNoRot, { nodeBudget: 100000 })

  // Now check with Rotate (budget 500k)
  const stateWithRot = EncounterState.fromLevel(level, def, 10)
  const minDmg = minDamageToWin(stateWithRot, { nodeBudget: 500000 })
  if (!minDmg.win || minDmg.minDamage !== 0) return null // must have clean 0-damage path

  // Check Rotate divergence / meaningful choice:
  // Simulate phase 1: tap E arrows until phase 1 ends (4 hits on E).
  const statePhase1 = EncounterState.fromLevel(level, def, 10)
  let phase1Taps = 0
  while (statePhase1.phaseIndex === 0 && phase1Taps < 10) {
    const freeE = statePhase1.playableArrows().find((id) => level.arrows[id].dir === 1)
    if (freeE === undefined) {
      const anyFree = statePhase1.playableArrows()[0]
      if (anyFree === undefined) break
      statePhase1.tap(anyFree)
    } else {
      statePhase1.tap(freeE)
    }
    phase1Taps++
  }

  let rotateDifference = false
  let cwResult = false
  let ccwResult = false

  if (statePhase1.phaseIndex === 1) {
    const sCW = statePhase1.clone()
    if (sCW.canRotate(1)) {
      sCW.rotate(1)
      const wCW = minDamageToWin(sCW, { maxRotates: 0, nodeBudget: 100000 })
      cwResult = wCW.win && wCW.minDamage === 0
    }
    const sCCW = statePhase1.clone()
    if (sCCW.canRotate(-1)) {
      sCCW.rotate(-1)
      const wCCW = minDamageToWin(sCCW, { maxRotates: 0, nodeBudget: 100000 })
      ccwResult = wCCW.win && wCCW.minDamage === 0
    }
    if (cwResult !== ccwResult) {
      rotateDifference = true
    }
  }

  return {
    preset: presetName,
    seed,
    hash: levelHash(level),
    arrows: level.arrows.length,
    dirCounts: [nArrows, eArrows, sArrows, wArrows],
    initialFree: a.initialFree,
    cleanPath: true,
    minDamage: 0,
    sequence: minDmg.sequence.map(
      (act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : `Rot(${act.turn > 0 ? 'cw' : 'ccw'})`
    ),
    details: {
      nArrows,
      eArrows,
      sArrows,
      wArrows,
      winNoRot: winNoRot.win,
      rotateDifference,
      cwResult,
      ccwResult,
    },
  }
}

// -----------------------------------------------------------------------------
// 2. Scan Act I #1 (Two-Front Stand)
// Urgent W (hp 2, interval 3, dmg 2), Slow E (hp 3, interval 5, dmg 2)
// -----------------------------------------------------------------------------

export function testAct1E1Candidate(
  presetName: PresetName,
  seed: number,
): CandidateScanResult | null {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return null
  const level = res.level

  const a = analyzeSeed(level)
  const nArrows = a.dirCounts[0]
  const eArrows = a.dirCounts[1]
  const sArrows = a.dirCounts[2]
  const wArrows = a.dirCounts[3]

  if (wArrows < 2 || eArrows < 3) return null
  if (a.initialFree[3] >= 2) return null // Initial free W must be < 2!

  const def: EncounterDef = {
    id: `act1_e1_${presetName}_${seed}`,
    title: `Act I #1 Square (${presetName} ${seed})`,
    enemies: [
      { id: 'grunt_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'grunt_e', side: 1, hp: 3, attackTimer: { interval: 5, damage: 2 }, label: 'slow' },
    ],
    rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
    blockedTapDamage: 1,
  }

  const stateNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const minDmg = minDamageToWin(stateNoRot, { nodeBudget: 300000 })
  if (!minDmg.win || minDmg.minDamage !== 0) return null

  let mistakeDamages = false
  const sMistake = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const freeE = sMistake.playableArrows().filter((id) => level.arrows[id].dir === 1)
  if (freeE.length >= 2) {
    sMistake.tap(freeE[0])
    sMistake.tap(freeE[1])
    const rest = minDamageToWin(sMistake, { nodeBudget: 100000 })
    if (rest.minDamage > 0) {
      mistakeDamages = true
    }
  }

  return {
    preset: presetName,
    seed,
    hash: levelHash(level),
    arrows: level.arrows.length,
    dirCounts: [nArrows, eArrows, sArrows, wArrows],
    initialFree: a.initialFree,
    cleanPath: true,
    minDamage: 0,
    sequence: minDmg.sequence.map(
      (act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : `Rot`
    ),
    details: {
      initialFreeW: a.initialFree[3],
      initialFreeE: a.initialFree[1],
      mistakeDamages,
      tapsToWin: minDmg.sequence.length,
    },
  }
}

// -----------------------------------------------------------------------------
// 3. Scan Act I #2 (Cross-Lock)
// Urgent E (hp 2, interval 3, dmg 2), Slow N (hp 2, interval 4, dmg 2)
// -----------------------------------------------------------------------------

export function testAct1E2Candidate(
  presetName: PresetName,
  seed: number,
): CandidateScanResult | null {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return null
  const level = res.level

  const a = analyzeSeed(level)
  const nArrows = a.dirCounts[0]
  const eArrows = a.dirCounts[1]
  const sArrows = a.dirCounts[2]
  const wArrows = a.dirCounts[3]

  if (eArrows < 2 || nArrows < 2) return null
  if (a.initialFree[1] >= 2 || a.initialFree[0] >= 2) return null

  const def: EncounterDef = {
    id: `act1_e2_${presetName}_${seed}`,
    title: `Act I #2 Square (${presetName} ${seed})`,
    enemies: [
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'grunt_n', side: 0, hp: 2, attackTimer: { interval: 4, damage: 2 }, label: 'slow' },
    ],
    rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
    blockedTapDamage: 1,
  }

  const stateNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const minDmg = minDamageToWin(stateNoRot, { nodeBudget: 300000 })
  if (!minDmg.win || minDmg.minDamage !== 0) return null

  const seqDirs = minDmg.sequence.map((act) => act.kind === 'tap' ? level.arrows[act.id].dir : -1)
  const hasN = seqDirs.includes(0)
  const hasE = seqDirs.includes(1)
  if (!hasN || !hasE) return null

  const firstE = seqDirs.indexOf(1)
  const lastE = seqDirs.lastIndexOf(1)
  const firstN = seqDirs.indexOf(0)
  const lastN = seqDirs.lastIndexOf(0)
  const isInterleaved = (firstN < lastE && lastE > firstE) || (firstE < lastN && lastN > firstN)

  return {
    preset: presetName,
    seed,
    hash: levelHash(level),
    arrows: level.arrows.length,
    dirCounts: [nArrows, eArrows, sArrows, wArrows],
    initialFree: a.initialFree,
    cleanPath: true,
    minDamage: 0,
    sequence: minDmg.sequence.map(
      (act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : `Rot`
    ),
    details: {
      isInterleaved,
      firstN,
      firstE,
      lastN,
      lastE,
      tapsToWin: minDmg.sequence.length,
    },
  }
}

// -----------------------------------------------------------------------------
// 4. Scan Act I #3 (Caster Awakens)
// Caster N (hp 3, CAST IN 3 dmg 4, interruptible -> NORM IN 3 dmg 2), Grunt E (hp 2, interval 4, dmg 2)
// -----------------------------------------------------------------------------

export function testAct1E3Candidate(
  presetName: PresetName,
  seed: number,
): CandidateScanResult | null {
  const params = PRESETS[presetName]
  const res = generateLevel(params, seed)
  if (!res.ok || !res.level) return null
  const level = res.level

  const a = analyzeSeed(level)
  const nArrows = a.dirCounts[0]
  const eArrows = a.dirCounts[1]
  const sArrows = a.dirCounts[2]
  const wArrows = a.dirCounts[3]

  if (nArrows < 3 || eArrows < 2) return null

  const def: EncounterDef = {
    id: `act1_e3_${presetName}_${seed}`,
    title: `Act I #3 Square (${presetName} ${seed})`,
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

  const stateNoRot = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
  const minDmg = minDamageToWin(stateNoRot, { nodeBudget: 300000 })
  if (!minDmg.win || minDmg.minDamage !== 0) return null

  const seqDirs = minDmg.sequence.map((act) => act.kind === 'tap' ? level.arrows[act.id].dir : -1)
  const stepFirstN = seqDirs.indexOf(0) + 1

  return {
    preset: presetName,
    seed,
    hash: levelHash(level),
    arrows: level.arrows.length,
    dirCounts: [nArrows, eArrows, sArrows, wArrows],
    initialFree: a.initialFree,
    cleanPath: true,
    minDamage: 0,
    sequence: minDmg.sequence.map(
      (act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : `Rot`
    ),
    details: {
      stepFirstN,
      tapsToWin: minDmg.sequence.length,
    },
  }
}
