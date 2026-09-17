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

interface Spec {
  enc: number
  title: string
  pattern: string
  preset: PresetName
  seed: number
  enemies: EncounterDef['enemies']
  rotate?: EncounterDef['rotate']
  notes: string
}

const CANDIDATES: Spec[] = [
  // --- ENCOUNTER 4: The Stonethrower (Bottleneck) ---
  {
    enc: 4,
    title: 'Act I #4 — Cand A (square6 seed 78)',
    pattern: 'BOTTLENECK',
    preset: 'square6',
    seed: 78,
    enemies: [
      {
        id: 'thrower_w',
        side: 3,
        hp: 3,
        attackTimer: { interval: 4, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Square 6x6 compact. Key bottleneck: South arrow #7 must be removed on turn 1 to unlock West arrows #6 and #8.',
  },
  {
    enc: 4,
    title: 'Act I #4 — Cand B (square7 seed 11)',
    pattern: 'BOTTLENECK',
    preset: 'square7',
    seed: 11,
    enemies: [
      {
        id: 'thrower_w',
        side: 3,
        hp: 3,
        attackTimer: { interval: 4, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Square 7x7 spacious dais. Bottleneck: #0(W) hits, then #1(N) unlocks #4(W) and #6(W). Stone Throw on turn 3 pins East #3 safely.',
  },
  {
    enc: 4,
    title: 'Act I #4 — Cand C (square7 seed 24)',
    pattern: 'BOTTLENECK',
    preset: 'square7',
    seed: 24,
    enemies: [
      {
        id: 'thrower_w',
        side: 3,
        hp: 3,
        attackTimer: { interval: 4, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Square 7x7. Bottleneck: North #0 must be removed first to unlock #8(W), bypassing East arrows.',
  },

  // --- ENCOUNTER 5: Pincer Quarry (Choice of Opening) ---
  {
    enc: 5,
    title: 'Act I #5 — Cand A (square7 seed 20)',
    pattern: 'CHOICE OF OPENING',
    preset: 'square7',
    seed: 20,
    enemies: [
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      {
        id: 'thrower_n',
        side: 0,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Choice of Opening: 5 arrows free across 3 directions (N1, E1, W3). Starting with West or North allows Grunt E to hit on turn 3.',
  },
  {
    enc: 5,
    title: 'Act I #5 — Cand B (square7 seed 30)',
    pattern: 'CHOICE OF OPENING',
    preset: 'square7',
    seed: 30,
    enemies: [
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      {
        id: 'thrower_n',
        side: 0,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Choice of Opening: 5 arrows free across N3, E1, S1. Player must identify the urgent East defense among the wide fan of North arrows.',
  },
  {
    enc: 5,
    title: 'Act I #5 — Cand C (square8 seed 86)',
    pattern: 'CHOICE OF OPENING',
    preset: 'square8',
    seed: 86,
    enemies: [
      { id: 'grunt_e', side: 1, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      {
        id: 'thrower_n',
        side: 0,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Square 8x8 rich arena. 5 free arrows across all 4 directions on start (N1, E1, S1, W2). 4 taps clean.',
  },

  // --- ENCOUNTER 6: Arcane Siege (Delayed Payoff) ---
  {
    enc: 6,
    title: 'Act I #6 — Cand A (square8 seed 1)',
    pattern: 'DELAYED PAYOFF',
    preset: 'square8',
    seed: 1,
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
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Delayed Payoff: Caster CAST IN 3 is interrupted on turn 3 second-to-second via #0(W)->#1(W)->#2(N).',
  },
  {
    enc: 6,
    title: 'Act I #6 — Cand B (square8 seed 21)',
    pattern: 'DELAYED PAYOFF',
    preset: 'square8',
    seed: 21,
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
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Delayed Payoff: 14 arrows, Dirs 9/1/0/4. First North hit at step 3 exactly interrupts the lethal cast.',
  },
  {
    enc: 6,
    title: 'Act I #6 — Cand C (square8 seed 46)',
    pattern: 'DELAYED PAYOFF',
    preset: 'square8',
    seed: 46,
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
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 5, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Square 8x8 (17 arrows). Interleaved sequence with exact step 3 interrupt on Caster.',
  },

  // --- ENCOUNTER 7: Crossfire Triad (Direction Scarcity / False Temptation) ---
  {
    enc: 7,
    title: 'Act I #7 — Cand A (square8 seed 12)',
    pattern: 'DIRECTION SCARCITY',
    preset: 'square8',
    seed: 12,
    enemies: [
      { id: 'fast_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'heavy_e', side: 1, hp: 2, attackTimer: { interval: 5, damage: 2 }, label: 'heavy' },
      {
        id: 'thrower_s',
        side: 2,
        hp: 2,
        attackTimer: { interval: 7, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Direction Scarcity on West: exactly 3 West arrows on board, 1 free on start. Tight triage: West -> East -> South.',
  },
  {
    enc: 7,
    title: 'Act I #7 — Cand B (square9 seed 28)',
    pattern: 'DIRECTION SCARCITY',
    preset: 'square9',
    seed: 28,
    enemies: [
      { id: 'fast_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'heavy_e', side: 1, hp: 2, attackTimer: { interval: 5, damage: 2 }, label: 'heavy' },
      {
        id: 'thrower_s',
        side: 2,
        hp: 2,
        attackTimer: { interval: 7, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'Direction Scarcity: 3 West arrows total. Starts with #9(S) unlocking #7(W) and #10(W) to kill Fast W before turn 3.',
  },
  {
    enc: 7,
    title: 'Act I #7 — Cand C (square8 seed 78)',
    pattern: 'FALSE TEMPTATION',
    preset: 'square8',
    seed: 78,
    enemies: [
      { id: 'fast_w', side: 3, hp: 2, attackTimer: { interval: 3, damage: 2 }, label: 'urgent' },
      { id: 'heavy_e', side: 1, hp: 2, attackTimer: { interval: 5, damage: 2 }, label: 'heavy' },
      {
        id: 'thrower_s',
        side: 2,
        hp: 2,
        attackTimer: { interval: 7, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        label: 'thrower',
      },
    ],
    notes: 'False Temptation: 2 East arrows free on start tempt the player to hit the heavy flank, leading to Fast W hitting on turn 3.',
  },

  // --- ENCOUNTER 8: The Vanguard Bastion (Layered Gates / Recovery Board) ---
  {
    enc: 8,
    title: 'Act I #8 — Cand A (square9 seed 12)',
    pattern: 'LAYERED GATES',
    preset: 'square9',
    seed: 12,
    enemies: [
      { id: 'chieftain_n', side: 0, hp: 3, attackTimer: { interval: 5, damage: 2 }, mandatory: true },
      {
        id: 'caster_e',
        side: 1,
        hp: 3,
        attackTimer: {
          interval: 3,
          damage: 4,
          kind: 'cast',
          interruptible: true,
          interruptedAttack: { interval: 4, damage: 2, kind: 'normal' },
        },
        mandatory: true,
      },
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 6, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        mandatory: false,
      },
    ],
    notes: 'Pre-Boss Crucible: 5 concentric peel layers, 95% branch ratio. Chieftain & Caster mandatory; Thrower W artillery support.',
  },
  {
    enc: 8,
    title: 'Act I #8 — Cand B (square9 seed 40)',
    pattern: 'LAYERED GATES',
    preset: 'square9',
    seed: 40,
    enemies: [
      { id: 'chieftain_n', side: 0, hp: 3, attackTimer: { interval: 5, damage: 2 }, mandatory: true },
      {
        id: 'caster_e',
        side: 1,
        hp: 3,
        attackTimer: {
          interval: 3,
          damage: 4,
          kind: 'cast',
          interruptible: true,
          interruptedAttack: { interval: 4, damage: 2, kind: 'normal' },
        },
        mandatory: true,
      },
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 6, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        mandatory: false,
      },
    ],
    notes: 'Pre-Boss Crucible: 5 peel layers, 89% branch ratio. Step 3 interrupt on Caster, Chieftain defeated turn 4, Caster defeated turn 6.',
  },
  {
    enc: 8,
    title: 'Act I #8 — Cand C (square10 seed 23)',
    pattern: 'LAYERED GATES',
    preset: 'square10',
    seed: 23,
    enemies: [
      { id: 'chieftain_n', side: 0, hp: 3, attackTimer: { interval: 5, damage: 2 }, mandatory: true },
      {
        id: 'caster_e',
        side: 1,
        hp: 3,
        attackTimer: {
          interval: 3,
          damage: 4,
          kind: 'cast',
          interruptible: true,
          interruptedAttack: { interval: 4, damage: 2, kind: 'normal' },
        },
        mandatory: true,
      },
      {
        id: 'thrower_w',
        side: 3,
        hp: 2,
        attackTimer: { interval: 6, damage: 2 },
        ability: { id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' },
        mandatory: false,
      },
    ],
    notes: 'Grand 10x10 Pre-Boss arena (22 arrows, 7 concentric layers!). Deep onion fortress with 91% branch points.',
  },
]

async function runEvaluation() {
  console.log('=== EVALUATING SHORTLIST CANDIDATES FOR ACT I 4-8 ===\n')

  for (const s of CANDIDATES) {
    const level = generateLevel(PRESETS[s.preset], s.seed).level!
    const a = analyzeSeed(level)
    const hash = levelHash(level)

    const def: EncounterDef = {
      id: `eval_${s.preset}_${s.seed}`,
      title: s.title,
      enemies: s.enemies,
      rotate: { allow: [1, -1], advancesTurn: false, useRunPool: true },
      blockedTapDamage: 1,
    }

    // Solve with 0 Rotate
    const s0 = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
    const m0 = minDamageToWin(s0, { nodeBudget: 300000 })

    // Solve with 1 Rotate
    const s1 = EncounterState.fromLevel(level, def, 10)
    const m1 = minDamageToWin(s1, { maxRotates: 1, nodeBudget: 300000 })

    // Replay clean sequence
    const replay = EncounterState.fromLevel(level, { ...def, rotate: { allow: [] } }, 10)
    let pinnedArrowId = -1
    for (const act of m0.sequence) {
      if (act.kind === 'tap') {
        replay.tap(act.id)
        if (replay.pinnedArrows.length > 0 && pinnedArrowId === -1) {
          pinnedArrowId = replay.pinnedArrows[0].id
        }
      }
    }

    console.log(`--------------------------------------------------------------------------------`)
    console.log(`[E${s.enc}] ${s.title}`)
    console.log(`Preset: ${s.preset} (${level.width}x${level.height}) | Seed: ${s.seed} | Hash: ${hash}`)
    console.log(`Arrows: ${level.arrows.length} | Dirs (N/E/S/W): ${a.dirCounts.join('/')} | Free on start: ${a.initialFree.join('/')}`)
    console.log(`Layers: ${a.layerDirs.length} | Branch Ratio: ${(a.branchPoints.length / a.arrows).toFixed(2)} | Pattern: ${s.pattern}`)
    console.log(`Solvable 0 Rotate: ${m0.win} | minDamage: ${m0.minDamage} | Taps to win: ${m0.sequence.length}`)
    console.log(`First Pin: #${pinnedArrowId} (${pinnedArrowId >= 0 ? DIR_NAMES[level.arrows[pinnedArrowId].dir] : 'none'})`)
    console.log(`Clean Sequence (0 Rot): ${m0.sequence.map((act) => act.kind === 'tap' ? `#${act.id}(${DIR_NAMES[level.arrows[act.id].dir]})` : 'Rot').join(' -> ')}`)
    console.log(`Notes: ${s.notes}`)
    console.log()
  }
}

runEvaluation().catch(console.error)
