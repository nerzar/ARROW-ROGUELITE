import {
  analyzeSeed,
  type Dir,
  DIR_NAMES,
  ENCOUNTER_FORMAT,
  type EncounterDef,
  type EncounterFile,
  EncounterState,
  findWin,
  probePhase2,
  generateLevel,
  levelHash,
  maxHits,
  PRESETS,
  type PresetName,
} from '../src/index.js'

/**
 * EXP-008 seed shortlist for the prologue mini-boss. Scans generated boards, tries a small grid of
 * hand-shaped HP splits for the scene "boss on the familiar side → moves → Rotate", keeps boards
 * where the fight is winnable with one Rotate and provably not without it, and ranks them.
 *
 * The ranking weights are a provisional sorting aid for a human reviewer, not a balance decision.
 */

export interface ShortlistOptions {
  preset: PresetName
  start: number
  count: number
  side1: Dir
  side2: Dir
  minArrows: number
  maxArrows: number
  top: number
}

export interface Candidate {
  rank: number
  score: number
  seed: number
  levelHash: string
  arrows: number
  dirCounts: number[]
  initialFree: number[]
  dirSequence: string
  dirBranchPoints: number
  hp: [number, number]
  /** Best damage without Rotate. */
  maxHitsWithoutRotate: number
  /** Greedy sims: mean alive arrows facing the phase-2 side when phase 2 starts. */
  onSideAtPhase2: number
  /** Greedy sims: mean best supply facing the phase-2 side after one Rotate. */
  rotateSupplyAtPhase2: number
  /** Share of greedy (hit first, Rotate when useful) sims that win. */
  greedyWin: number
  /** Share of sloppy phase-1 sims (random taps) after which a win is still possible. */
  sloppyWinnable: number
  /** Share of greedy sims where Rotating this way at phase-2 start still wins. */
  turnWin: Record<string, number>
  /** HP splits that also satisfy "win with 1 Rotate, not without". */
  viableSplits: string[]
  why: string[]
  file: EncounterFile
}

export function miniBossDef(side1: Dir, side2: Dir, h1: number, h2: number): EncounterDef {
  return {
    id: 'prologue_miniboss',
    title: 'Prologue mini-boss (placeholder)',
    boss: {
      id: 'miniboss_placeholder',
      phases: [
        { side: side1, hpUnits: h1, label: 'familiar side' },
        { side: side2, hpUnits: h2, grantRotate: 1, label: 'moved: direction becomes a resource' },
      ],
    },
    rotate: { allow: [1, -1] },
  }
}

export function scanShortlist(o: ShortlistOptions, progress?: (done: number) => void): { scanned: number; passed: number; candidates: Candidate[] } {
  const params = PRESETS[o.preset]
  const found: Candidate[] = []
  let passed = 0
  for (let i = 0; i < o.count; i++) {
    if (progress && i % 250 === 0) progress(i)
    const seed = (o.start + i) >>> 0
    const res = generateLevel(params, seed)
    if (!res.ok || !res.level) continue
    const level = res.level
    const a = analyzeSeed(level)
    if (a.arrows < o.minArrows || a.arrows > o.maxArrows) continue
    if (a.initialFree[o.side1] < 1) continue

    const viable: { h1: number; h2: number; def: EncounterDef }[] = []
    for (let h1 = 2; h1 <= 4; h1++) {
      if (a.dirCounts[o.side1] < h1) continue
      for (let h2 = 2; h2 <= 6; h2++) {
        const def = miniBossDef(o.side1, o.side2, h1, h2)
        const start = EncounterState.fromLevel(level, def)
        const without = findWin(start, { maxRotates: 0, nodeBudget: 300_000 })
        if (without.win || !without.proven) continue
        if (!findWin(start, { maxRotates: 1, nodeBudget: 300_000 }).win) continue
        viable.push({ h1, h2, def })
      }
    }
    if (viable.length === 0) continue
    passed++

    // Longest fight first, then a longer familiar phase.
    viable.sort((x, y) => y.h1 + y.h2 - (x.h1 + x.h2) || y.h1 - x.h1)
    const best = viable.find((v) => v.h1 >= 3 && v.h1 + v.h2 <= 9) ?? viable[0]
    const start = EncounterState.fromLevel(level, best.def)
    const total = best.h1 + best.h2
    const noRot = maxHits(start, { maxRotates: 0, nodeBudget: 500_000 }).hits
    const greedy = probePhase2(level, best.def, 'greedy', 30, seed)
    const sloppy = probePhase2(level, best.def, 'sloppy', 30, seed)
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const onSide = greedy.meanOnSideAtPhase2
    const shortage = best.h2 - onSide
    const slack = greedy.meanBestRotateSupply - best.h2
    const goodTurns = greedy.turnWinShare.filter((t) => t.share >= 0.5).length

    // Provisional weights: a sorting aid for the human reviewer, not a balance decision.
    const why: string[] = []
    let score = 0
    score += 25 * sloppy.winnableAtPhase2
    why.push(`careless phase 1 still winnable: ${pct(sloppy.winnableAtPhase2)}`)
    score += 15 * greedy.simulatedWin
    why.push(`hit-greedy player + Rotate wins: ${pct(greedy.simulatedWin)}`)
    score += onSide >= 1 && shortage >= 2 ? 15 : shortage >= 2 ? 8 : 0
    why.push(`phase 2 starts with ${onSide.toFixed(1)} arrows facing ${DIR_NAMES[o.side2]} for ${best.h2} hp`)
    // Enough ammo after Rotate to feel the fix, but not so much that phase 2 stops being a puzzle.
    score += slack >= 2 && slack <= 4 ? 15 : slack >= 1 ? 10 : slack >= 0 ? 3 : 0
    why.push(`after the best Rotate ${greedy.meanBestRotateSupply.toFixed(1)} arrows face ${DIR_NAMES[o.side2]}`)
    score += a.initialFree[o.side1] >= 2 ? 10 : 5
    why.push(`${a.initialFree[o.side1]} ${DIR_NAMES[o.side1]} arrows free at start`)
    score += goodTurns >= 2 ? 5 : goodTurns === 1 ? 2 : 0
    why.push(`Rotate right at phase 2 still wins: ${greedy.turnWinShare.map((t) => `${t.turn === 1 ? 'cw' : 'ccw'} ${pct(t.share)}`).join(', ')}`)
    score += 10 * (a.dirBranchPoints.length / Math.max(1, a.steps.length))
    if (total >= 7 && total <= 9) score += 5
    why.push(`without Rotate at most ${noRot}/${total} damage`)

    found.push({
      rank: 0,
      score: Math.round(score * 10) / 10,
      seed,
      levelHash: levelHash(level),
      arrows: a.arrows,
      dirCounts: a.dirCounts,
      initialFree: a.initialFree,
      dirSequence: a.dirSequence,
      dirBranchPoints: a.dirBranchPoints.length,
      hp: [best.h1, best.h2],
      maxHitsWithoutRotate: noRot,
      onSideAtPhase2: Math.round(onSide * 10) / 10,
      rotateSupplyAtPhase2: Math.round(greedy.meanBestRotateSupply * 10) / 10,
      greedyWin: greedy.simulatedWin,
      sloppyWinnable: sloppy.winnableAtPhase2,
      turnWin: Object.fromEntries(greedy.turnWinShare.map((t) => [t.turn === 1 ? 'cw' : 'ccw', Math.round(t.share * 100) / 100])),
      viableSplits: viable.map((v) => `${v.h1}+${v.h2}`),
      why,
      file: {
        format: ENCOUNTER_FORMAT,
        v: 1,
        board: { preset: o.preset, seed, levelHash: levelHash(level) },
        encounter: best.def,
      },
    })
  }
  found.sort((x, y) => y.score - x.score || x.seed - y.seed)
  const candidates = found.slice(0, o.top).map((c, i) => ({ ...c, rank: i + 1 }))
  return { scanned: o.count, passed, candidates }
}
