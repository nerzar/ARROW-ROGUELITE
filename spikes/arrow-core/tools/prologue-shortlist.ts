import {
  analyzeSeed,
  type Dir,
  ENCOUNTER_FORMAT,
  type EncounterDef,
  type EncounterFile,
  EncounterState,
  findWin,
  generateLevel,
  levelHash,
  PRESETS,
  type PresetName,
} from '../src/index.js'

/**
 * EXP-009 seed shortlists for the three single-target prologue encounters (before the mini-boss).
 * Unlike the mini-boss scan in shortlist.ts, these are a single boss phase, one side, no Rotate —
 * the only question is how readable/obvious the board is. Scoring is a provisional sorting aid for
 * a human reviewer, not a balance decision; the user picks the seed by playing candidates.
 */

export type PrologueStep = 1 | 2 | 3

export interface StepScanOptions {
  preset: PresetName
  side: Dir
  hp: number
  start: number
  count: number
  top: number
}

export interface StepCandidate {
  rank: number
  score: number
  seed: number
  levelHash: string
  arrows: number
  dirCounts: number[]
  initialFree: number[]
  freeAtStart: number
  branchPoints: number
  dirBranchPoints: number
  why: string[]
  file: EncounterFile
}

export function simpleEncounterDef(id: string, title: string, side: Dir, hp: number): EncounterDef {
  return {
    id,
    title,
    boss: { id: 'target_placeholder', phases: [{ side, hpUnits: hp }] },
    rotate: { allow: [] },
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Step-specific readability filter + score. Returns null if the seed does not qualify for this step. */
function scoreStep1(side: Dir, a: ReturnType<typeof analyzeSeed>): { score: number; why: string[] } | null {
  const freeAtStart = a.initialFree.reduce((s, n) => s + n, 0)
  if (a.initialFree[side] < 1) return null // encounter 1 promises an obvious first successful shot
  const only = freeAtStart === a.initialFree[side] // the target arrow is the only free arrow
  let score = 0
  const why: string[] = []
  score += only ? 40 : 20
  why.push(only ? 'target arrow is the only free arrow at start' : 'target arrow free at start, alongside others')
  score += clamp(20 - 5 * (freeAtStart - 1), 0, 20)
  why.push(`${freeAtStart} arrow(s) free at start`)
  score += clamp(20 - 2 * (a.arrows - 3), 0, 20)
  why.push(`${a.arrows} arrows total`)
  score += clamp(20 - 4 * a.dirBranchPoints.length, 0, 20)
  why.push(`${a.dirBranchPoints.length} direction branch point(s) in the solved order`)
  if (a.dirCounts[side] === 1) {
    score += 5
    why.push('exactly one target-side arrow: no ammo left over')
  }
  return { score: Math.round(score * 10) / 10, why }
}

function scoreStep2(side: Dir, hp: number, a: ReturnType<typeof analyzeSeed>): { score: number; why: string[] } | null {
  if (a.initialFree[side] >= hp) return null // must need freeing at least one target arrow
  let score = 0
  const why: string[] = []
  if (a.initialFree[side] === 1) {
    score += 25
    why.push('one target arrow already free, one more needs freeing')
  } else {
    score += 15
    why.push('no target arrow free at start: both hits need freeing first')
  }
  score += clamp(15 - 1.5 * (a.arrows - 4), 0, 15)
  why.push(`${a.arrows} arrows total`)
  score += clamp(15 - 3 * a.dirBranchPoints.length, 0, 15)
  why.push(`${a.dirBranchPoints.length} direction branch point(s)`)
  score += a.dirCounts[side] === hp ? 10 : clamp(10 - 3 * (a.dirCounts[side] - hp), 0, 10)
  why.push(`${a.dirCounts[side]} target-side arrows for ${hp} hp`)
  return { score: Math.round(score * 10) / 10, why }
}

function scoreStep3(side: Dir, hp: number, a: ReturnType<typeof analyzeSeed>): { score: number; why: string[] } | null {
  const slack = a.dirCounts[side] - hp
  if (slack < 2) return null // "enough with margin", not a tight direction budget yet
  let score = 0
  const why: string[] = []
  score += clamp(20 - 4 * Math.abs(slack - 3), 0, 20)
  why.push(`${a.dirCounts[side]} target-side arrows for ${hp} hp (slack ${slack})`)
  score += clamp(Math.min(a.arrows, 16), 0, 16)
  why.push(`${a.arrows} arrows total: more variety to show a projectile budget`)
  score += clamp(1.5 * Math.min(a.dirBranchPoints.length, 10), 0, 15)
  why.push(`${a.dirBranchPoints.length} direction branch point(s)`)
  if (a.initialFree[side] >= 1) {
    score += 10
    why.push('target arrow already free at start')
  }
  return { score: Math.round(score * 10) / 10, why }
}

export function scanPrologueStep(
  step: PrologueStep,
  o: StepScanOptions,
  id: string,
  title: string,
  progress?: (done: number) => void,
): { scanned: number; passed: number; candidates: StepCandidate[] } {
  const params = PRESETS[o.preset]
  const found: StepCandidate[] = []
  let passed = 0
  for (let i = 0; i < o.count; i++) {
    if (progress && i % 500 === 0) progress(i)
    const seed = (o.start + i) >>> 0
    const res = generateLevel(params, seed)
    if (!res.ok || !res.level) continue
    const level = res.level
    if (level.arrows.length < 2) continue
    const a = analyzeSeed(level)
    if (a.dirCounts[o.side] < o.hp) continue

    const scored = step === 1 ? scoreStep1(o.side, a) : step === 2 ? scoreStep2(o.side, o.hp, a) : scoreStep3(o.side, o.hp, a)
    if (!scored) continue

    const def = simpleEncounterDef(id, title, o.side, o.hp)
    const start = EncounterState.fromLevel(level, def)
    const win = findWin(start, { nodeBudget: 100_000 })
    if (!win.win) continue // should not happen given the dirCounts filter, but never ship an unwinnable board
    passed++

    found.push({
      rank: 0,
      score: scored.score,
      seed,
      levelHash: levelHash(level),
      arrows: a.arrows,
      dirCounts: a.dirCounts,
      initialFree: a.initialFree,
      freeAtStart: a.initialFree.reduce((s, n) => s + n, 0),
      branchPoints: a.branchPoints.length,
      dirBranchPoints: a.dirBranchPoints.length,
      why: scored.why,
      file: { format: ENCOUNTER_FORMAT, v: 1, board: { preset: o.preset, seed, levelHash: levelHash(level) }, encounter: def },
    })
  }
  found.sort((x, y) => y.score - x.score || x.seed - y.seed)
  const candidates = found.slice(0, o.top).map((c, i) => ({ ...c, rank: i + 1 }))
  return { scanned: o.count, passed, candidates }
}
