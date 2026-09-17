import {
  analyzeSeed,
  type AttackTimer,
  type Dir,
  ENCOUNTER_FORMAT,
  type EncounterDef,
  type EncounterFile,
  EncounterState,
  generateLevel,
  hitTiming,
  levelHash,
  minDamageToWin,
  PRESETS,
  type PresetName,
} from '../src/index.js'

/**
 * EXP-010 seed shortlist for the two timed prologue encounters. A landed hit does not interrupt the
 * attack timer (docs/COMBAT-RULES.md 5) — it just ticks down every turn regardless of hit/miss and
 * fires at 0 — so how much unavoidable damage a fight costs depends only on how many turns the
 * *fastest* route to the kill takes, not on hit "gaps". `minDamageToWin` (encounter-solver.ts) proves
 * that number exactly; `hitTiming` (analyze.ts) is kept only as a cheap first look, not a gate.
 *
 * E3 wants a *proven* no-damage path (docs/COMBAT-RULES.md 10: "intended path allows a no-damage
 * clear"). E4 explicitly wants noticeable, survivable pressure — `requireNoDamage: false` and a
 * `damageRange` instead. Ranking weights are a provisional sorting aid, not a balance decision.
 */

export interface CpScanOptions {
  preset: PresetName
  side: Dir
  hp: number
  attackTimer: AttackTimer
  blockedTapDamage: number
  playerHp: number
  start: number
  count: number
  minArrows: number
  maxArrows: number
  top: number
  /** E3: require a proven 0-damage path. E4: require winnable within `damageRange`. */
  requireNoDamage: boolean
  /** E4 only: acceptable minimum-unavoidable-damage window (inclusive), e.g. [2, 3] attack cycles. */
  damageRange?: [number, number]
}

export interface CpCandidate {
  rank: number
  score: number
  seed: number
  levelHash: string
  arrows: number
  dirCounts: number[]
  initialFree: number[]
  earliestHitTurn: number
  maxGap: number
  boardClearTurns: number
  minDamageOnIntendedPath: number
  why: string[]
  file: EncounterFile
}

export function cpEncounterDef(id: string, title: string, side: Dir, hp: number, attackTimer: AttackTimer, blockedTapDamage: number): EncounterDef {
  return {
    id,
    title,
    boss: { id: 'grunt_timed', phases: [{ side, hpUnits: hp, attackTimer, label: 'ATTACK IN ' + attackTimer.interval }] },
    rotate: { allow: [] },
    blockedTapDamage,
  }
}

export function scanCpEncounter(
  o: CpScanOptions,
  id: string,
  title: string,
  progress?: (done: number) => void,
): { scanned: number; passed: number; candidates: CpCandidate[] } {
  const params = PRESETS[o.preset]
  const found: CpCandidate[] = []
  let passed = 0
  for (let i = 0; i < o.count; i++) {
    if (progress && i % 500 === 0) progress(i)
    const seed = (o.start + i) >>> 0
    const res = generateLevel(params, seed)
    if (!res.ok || !res.level) continue
    const level = res.level
    if (level.arrows.length < o.minArrows || level.arrows.length > o.maxArrows) continue
    const a = analyzeSeed(level)
    if (a.dirCounts[o.side] < o.hp) continue
    const timing = hitTiming(a, o.side)

    const def = cpEncounterDef(id, title, o.side, o.hp, o.attackTimer, o.blockedTapDamage)
    const start = EncounterState.fromLevel(level, def, o.playerHp)
    const md = minDamageToWin(start, { nodeBudget: 400_000 })
    if (!md.win || !md.proven) continue
    if (o.requireNoDamage) {
      if (md.minDamage !== 0) continue
    } else {
      const [lo, hi] = o.damageRange ?? [0, o.playerHp - 1]
      if (md.minDamage < lo || md.minDamage > hi) continue
    }
    passed++

    const why: string[] = []
    let score = 0
    const slack = a.dirCounts[o.side] - o.hp
    score += Math.max(0, 20 - 3 * Math.abs(slack - 3))
    why.push(`${a.dirCounts[o.side]} ${'NESW'[o.side]}-side arrows for ${o.hp} hp (slack ${slack})`)
    score += Math.max(0, 15 - 2 * timing.earliestHitTurn)
    why.push(`earliest possible hit (canonical order): turn ${timing.earliestHitTurn}`)
    score += Math.min(15, timing.boardClearTurns)
    why.push(`board clears in ${timing.boardClearTurns} turns along the canonical order`)
    if (o.requireNoDamage) {
      why.push('proven no-damage path exists (minDamageToWin = 0)')
    } else {
      const cycles = Math.round(md.minDamage / o.attackTimer.damage)
      score += Math.max(0, 15 - 3 * Math.abs(cycles - 2))
      why.push(`min unavoidable damage on the fastest kill path: ${md.minDamage} (~${cycles} attack cycle(s) of ${o.attackTimer.damage})`)
    }

    found.push({
      rank: 0,
      score: Math.round(score * 10) / 10,
      seed,
      levelHash: levelHash(level),
      arrows: a.arrows,
      dirCounts: a.dirCounts,
      initialFree: a.initialFree,
      earliestHitTurn: timing.earliestHitTurn,
      maxGap: timing.maxGap,
      boardClearTurns: timing.boardClearTurns,
      minDamageOnIntendedPath: md.minDamage,
      why,
      file: { format: ENCOUNTER_FORMAT, v: 1, board: { preset: o.preset, seed, levelHash: levelHash(level) }, encounter: def },
    })
  }
  found.sort((x, y) => y.score - x.score || x.seed - y.seed)
  const candidates = found.slice(0, o.top).map((c, i) => ({ ...c, rank: i + 1 }))
  return { scanned: o.count, passed, candidates }
}
