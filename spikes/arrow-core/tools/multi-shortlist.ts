import {
  analyzeSeed,
  type Dir,
  DIR_NAMES,
  ENCOUNTER_FORMAT,
  type EncounterAction,
  type EncounterDef,
  type EncounterFile,
  EncounterState,
  generateLevel,
  type Level,
  levelHash,
  minDamageToWin,
  PRESETS,
  type PresetName,
  traceActions,
} from '../src/index.js'

/**
 * EXP-012: seed shortlist for *simultaneous* multi-enemy encounters (`def.enemies`, EXP-010b).
 *
 * Sibling of tools/cp-shortlist.ts, which only understands the single-target `boss` model. This
 * scanner builds one `enemies[]` def from the CLI specs and filters seeds by proven facts only:
 *
 * - solvable (a win exists: all mandatory enemies dead, or board cleared alive);
 * - min unavoidable damage (`minDamageToWin`) within `--max-damage`;
 * - every reported number is exhaustive (proven) or the seed is skipped, never guessed.
 *
 * Deliberately NO ranking / "fun score": candidates are returned in ascending seed order (stable
 * output — same input always yields the same list) and the final level-design pick stays with the
 * human Level Designer. The `top` option only caps how many passing seeds are returned.
 */

export interface MultiEnemySpec {
  side: Dir
  hp: number
  /** ATTACK IN N. Absent = passive enemy, never attacks. */
  interval?: number
  /** Player HP lost per attack. Absent = passive enemy. */
  damage?: number
  /**
   * Opt-in interrupt threshold (docs/COMBAT-RULES.md 5): this many landed hits on this enemy
   * within one attack cycle reset its countdown instead of ticking it down. Absent = no interrupt
   * (a hit only damages, the timer keeps ticking). This is the only "attack type" the current
   * branch supports, so it is the only one accepted here.
   */
  interruptHits?: number
}

export interface MultiScanOptions {
  preset: PresetName
  enemies: MultiEnemySpec[]
  playerHp: number
  /** Keep only seeds whose proven minimum unavoidable damage is at most this. */
  maxDamage: number
  start: number
  count: number
  /** Max candidates returned (first N passing seeds in ascending seed order). */
  top: number
  minArrows: number
  maxArrows: number
  blockedTapDamage: number
  /** Search node budget per solver call. Exhaustion => seed skipped as unproven, never guessed. */
  nodeBudget: number
}

export interface MultiSeedFacts {
  seed: number
  levelHash: string
  /** A win exists (all mandatory enemies dead, or board cleared while alive). */
  solvable: boolean
  /** `solvable` is exhaustively proven (search budget not exhausted). */
  proven: boolean
  arrows: number
  dirCounts: number[]
  initialFree: number[]
  /** Earliest turn (1-based) a hit can land on each requested side, over ALL play orders (-1: never). */
  earliestHitTurn: Record<string, number>
  /** Earliest-hit search completed within budget (all turns proven minimal). */
  earliestHitProven: boolean
  /** Proven minimum unavoidable player damage among winning paths (-1 if unwinnable). */
  minDamage: number
  minDamageProven: boolean
  /** A winning path with zero damage exists (minDamage === 0, proven). */
  cleanPath: boolean
  /** One minimum-damage winning sequence, as encounter actions. */
  exampleActions: EncounterAction[]
  /** Human-readable replay of `exampleActions`. */
  examplePath: string[]
  /**
   * First turn (1-based) the player takes damage when replaying the level's stored (canonical)
   * solution order; -1 if that order takes no damage. A cheap, order-dependent illustration of
   * "where a bad path starts hurting" — not a proof about all paths.
   */
  firstDamageTurnCanonical: number
  /** Board can be fully cleared while the player is still alive (even with enemies left standing). */
  boardClearAlive: boolean
  boardClearAliveProven: boolean
  nodesMinDamage: number
  nodesEarliestHit: number
  nodesClearAlive: number
  nodesTotal: number
}

export interface MultiCandidate extends MultiSeedFacts {
  file: EncounterFile
}

const SIDE_BY_NAME: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 }

/**
 * Parses one `--enemy` spec. Accepted forms (fields separated by `:`):
 * - `SIDE:HP` — passive enemy, never attacks;
 * - `SIDE:HP:INTERVAL:DAMAGE` — attacks every INTERVAL turns for DAMAGE;
 * - `SIDE:HP:INTERVAL:DAMAGE:INTERRUPT_HITS` — plus opt-in interrupt (see MultiEnemySpec).
 * SIDE is N/E/S/W (case-insensitive) or 0/1/2/3.
 */
export function parseEnemySpec(raw: string): MultiEnemySpec {
  const parts = raw.split(':')
  if (parts.length < 2 || parts.length > 5) {
    throw new Error(`bad --enemy "${raw}": expected SIDE:HP[:INTERVAL:DAMAGE[:INTERRUPT_HITS]]`)
  }
  const sideToken = parts[0].trim().toUpperCase()
  let side: Dir
  if (sideToken in SIDE_BY_NAME) side = SIDE_BY_NAME[sideToken]
  else if (/^[0-3]$/.test(sideToken)) side = Number(sideToken) as Dir
  else throw new Error(`bad --enemy "${raw}": side must be N/E/S/W or 0-3`)
  const ints = parts.slice(1).map((p) => Number(p))
  if (ints.some((n) => !Number.isInteger(n))) {
    throw new Error(`bad --enemy "${raw}": HP/INTERVAL/DAMAGE/INTERRUPT_HITS must be integers`)
  }
  const [hp, interval, damage, interruptHits] = ints
  if (hp! < 1) throw new Error(`bad --enemy "${raw}": HP must be >= 1`)
  if (parts.length === 2) return { side, hp: hp! }
  if (parts.length !== 4 && parts.length !== 5) {
    throw new Error(`bad --enemy "${raw}": attacking enemy needs SIDE:HP:INTERVAL:DAMAGE`)
  }
  if (interval! < 1) throw new Error(`bad --enemy "${raw}": INTERVAL must be >= 1`)
  if (damage! < 1) throw new Error(`bad --enemy "${raw}": DAMAGE must be >= 1`)
  if (parts.length === 5) {
    if (interruptHits! < 1) throw new Error(`bad --enemy "${raw}": INTERRUPT_HITS must be >= 1`)
    return { side, hp: hp!, interval: interval!, damage: damage!, interruptHits: interruptHits! }
  }
  return { side, hp: hp!, interval: interval!, damage: damage! }
}

/** Parses a `--seeds START:COUNT` range (e.g. `1:5000`). */
export function parseSeedRange(raw: string): { start: number; count: number } {
  const m = /^(\d+):(\d+)$/.exec(raw.trim())
  if (!m) throw new Error(`bad --seeds "${raw}": expected START:COUNT, e.g. 1:5000`)
  const start = Number(m[1]) >>> 0
  const count = Number(m[2])
  if (count < 1) throw new Error(`bad --seeds "${raw}": COUNT must be >= 1`)
  return { start, count }
}

/** Builds the `enemies`-mode def shared by every scanned seed. No Rotate: priority, not direction. */
export function multiEnemyDef(
  id: string,
  title: string,
  specs: readonly MultiEnemySpec[],
  blockedTapDamage: number,
): EncounterDef {
  if (specs.length === 0) throw new Error('multi-enemy scan needs at least one --enemy')
  return {
    id,
    title,
    enemies: specs.map((s, i) => ({
      id: `${DIR_NAMES[s.side].toLowerCase()}_${i}`,
      side: s.side,
      hp: s.hp,
      attackTimer:
        s.interval !== undefined && s.damage !== undefined
          ? {
              interval: s.interval,
              damage: s.damage,
              ...(s.interruptHits !== undefined
                ? { interruptOnHit: true as const, interruptHits: s.interruptHits }
                : {}),
            }
          : undefined,
    })),
    rotate: { allow: [] },
    blockedTapDamage,
  }
}

/**
 * Earliest turn (1-based) each of `sides` can first be hit, over every legal play order.
 * Exhaustive DFS with memo in fixed (id-ascending) tap order, so the result is deterministic.
 * Stops early only on budget exhaustion (`earliestHitProven: false`).
 */
export function earliestHitTurns(
  start: EncounterState,
  sides: readonly Dir[],
  nodeBudget: number,
): { turns: Record<string, number>; proven: boolean; nodes: number } {
  const s = start.clone()
  const wanted = new Set(sides)
  const best = new Map<Dir, number>()
  const seen = new Map<string, number>()
  let nodes = 0
  let aborted = false

  const visit = (depth: number): void => {
    if (aborted || s.over) return
    if (++nodes > nodeBudget) {
      aborted = true
      return
    }
    const key = s.key()
    const prev = seen.get(key)
    if (prev !== undefined && prev <= depth) return
    seen.set(key, depth)
    if (best.size === wanted.size) {
      // Every side already hit at turn 1 — cannot do better. Otherwise keep searching: a later
      // state may still hit a remaining side earlier than its current best? No: depth only grows,
      // so once all wanted sides are recorded at depths <= current depth, remaining paths can only
      // tie or lose. Prune only when every recorded best <= depth.
      let prune = true
      for (const d of wanted) {
        const b = best.get(d)
        if (b === undefined || b > depth) {
          prune = false
          break
        }
      }
      if (prune) return
    }
    for (const id of s.board.freeArrows()) {
      const hitSide = s.wouldHit(id) ? s.arenaDir(id) : -1
      s.tap(id)
      if (hitSide >= 0 && wanted.has(hitSide as Dir)) {
        const cur = best.get(hitSide as Dir)
        if (cur === undefined || depth + 1 < cur) best.set(hitSide as Dir, depth + 1)
      }
      visit(depth + 1)
      s.undo()
      if (aborted) return
    }
  }

  visit(0)
  const turns: Record<string, number> = {}
  for (const d of sides) turns[DIR_NAMES[d]] = best.get(d) ?? -1
  return { turns, proven: !aborted, nodes }
}

/**
 * Can the board be fully cleared with the player still alive — even if mandatory enemies are left
 * standing (docs/COMBAT-RULES.md 7/8: running out of useful ammo is not an automatic loss)?
 * Dedicated DFS: the goal is `board.cleared && !playerDead`, independent of kill progress.
 */
export function canClearBoardAlive(
  start: EncounterState,
  nodeBudget: number,
): { possible: boolean; proven: boolean; nodes: number } {
  const s = start.clone()
  const failed = new Set<string>()
  let nodes = 0
  let aborted = false

  const visit = (): boolean => {
    if (s.board.cleared && !s.playerDead) return true
    if (s.over) return false
    if (++nodes > nodeBudget) {
      aborted = true
      return false
    }
    const key = s.key()
    if (failed.has(key)) return false
    for (const id of s.board.freeArrows()) {
      s.tap(id)
      if (visit()) return true
      s.undo()
    }
    if (!aborted) failed.add(key)
    return false
  }

  const possible = visit()
  return { possible, proven: possible || !aborted, nodes }
}

/** Full fact sheet for one seed under one multi-enemy def. Deterministic for fixed inputs. */
export function analyzeMultiSeed(
  level: Level,
  def: EncounterDef,
  opts: { playerHp: number; nodeBudget: number },
): MultiSeedFacts {
  const a = analyzeSeed(level)
  const start = EncounterState.fromLevel(level, def, opts.playerHp)
  const md = minDamageToWin(start, { nodeBudget: opts.nodeBudget })

  const sides = [...new Set((def.enemies ?? []).map((e) => e.side))]
  const eh = earliestHitTurns(start, sides, opts.nodeBudget)
  const clear = canClearBoardAlive(start, opts.nodeBudget)

  // Canonical-order illustration: replay the stored solution, note first damage turn.
  let firstDamageTurnCanonical = -1
  {
    const t = EncounterState.fromLevel(level, def, opts.playerHp)
    level.solution.forEach((id, i) => {
      if (firstDamageTurnCanonical >= 0 || t.over) return
      const before = t.playerHp
      const r = t.tap(id)
      if (r.ok && t.playerHp < before) firstDamageTurnCanonical = i + 1
    })
  }

  const exampleActions = md.win ? md.sequence : []
  return {
    seed: level.seed ?? -1,
    levelHash: levelHash(level),
    solvable: md.win,
    proven: md.proven,
    arrows: a.arrows,
    dirCounts: [...a.dirCounts],
    initialFree: [...a.initialFree],
    earliestHitTurn: eh.turns,
    earliestHitProven: eh.proven,
    minDamage: md.win ? md.minDamage : -1,
    minDamageProven: md.proven,
    cleanPath: md.win && md.proven && md.minDamage === 0,
    exampleActions,
    examplePath: exampleActions.length ? traceActions(level, def, exampleActions, opts.playerHp) : [],
    firstDamageTurnCanonical,
    boardClearAlive: clear.possible,
    boardClearAliveProven: clear.proven,
    nodesMinDamage: md.nodes,
    nodesEarliestHit: eh.nodes,
    nodesClearAlive: clear.nodes,
    nodesTotal: md.nodes + eh.nodes + clear.nodes,
  }
}

export function scanMultiEncounter(
  o: MultiScanOptions,
  id: string,
  title: string,
  progress?: (done: number) => void,
): { scanned: number; passed: number; unproven: number; candidates: MultiCandidate[] } {
  const params = PRESETS[o.preset]
  const def = multiEnemyDef(id, title, o.enemies, o.blockedTapDamage)
  // Cheap necessary prefilter: total HP demanded from each side must exist as arrows on that side.
  const demand = [0, 0, 0, 0]
  for (const e of o.enemies) demand[e.side] += e.hp
  const found: MultiCandidate[] = []
  let passed = 0
  let unproven = 0
  for (let i = 0; i < o.count; i++) {
    if (progress && i % 250 === 0) progress(i)
    const seed = (o.start + i) >>> 0
    const res = generateLevel(params, seed)
    if (!res.ok || !res.level) continue
    const level = res.level
    if (level.arrows.length < o.minArrows || level.arrows.length > o.maxArrows) continue
    const a = analyzeSeed(level)
    if (demand.some((need, d) => a.dirCounts[d as Dir] < need)) continue

    const facts = analyzeMultiSeed(level, def, { playerHp: o.playerHp, nodeBudget: o.nodeBudget })
    if (!facts.solvable || !facts.proven || !facts.minDamageProven) {
      unproven++
      continue
    }
    if (facts.minDamage > o.maxDamage) continue
    passed++
    if (found.length < o.top) {
      found.push({
        ...facts,
        file: {
          format: ENCOUNTER_FORMAT,
          v: 1,
          board: { preset: o.preset, seed, levelHash: levelHash(level) },
          encounter: def,
        },
      })
    }
  }
  // Ascending seed order = stable output by construction (scan order), no re-sorting by score.
  return { scanned: o.count, passed, unproven, candidates: found }
}
