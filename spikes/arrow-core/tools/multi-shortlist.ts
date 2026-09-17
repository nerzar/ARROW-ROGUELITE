import {
  analyzeSeed,
  type AttackKind,
  type Dir,
  DIR_NAMES,
  ENCOUNTER_FORMAT,
  type EncounterAction,
  type EncounterDef,
  type EncounterFile,
  EncounterState,
  checkEncounter,
  generateLevel,
  type Level,
  levelHash,
  minDamageToWin,
  PRESETS,
  type PresetName,
  traceActions,
} from '../src/index.js'

/**
 * EXP-014: encounter analyzer V2 for *simultaneous* multi-enemy encounters (`def.enemies`).
 *
 * Ported from EXP-012 (`exp/EXP-012-multi-encounter-analyzer`, commit 183fa59) onto the EXP-013
 * `EncounterState` (commit 32229e1 base). Two adaptations were required for correctness, not style:
 *
 * 1. Every place EXP-012 iterated `s.board.freeArrows()` (geometric truth) now iterates
 *    `s.playableArrows()` (free AND not currently pinned by Stone Throw). Tapping a pinned id
 *    returns the EXP-013 `'pinned'` rejection without logging anything, which would silently
 *    desync the DFS `s.undo()` bookkeeping — `playableArrows()` keeps the invariant "every id
 *    this file taps is a real, undoable, logged action" intact. Same reason `findWin` itself
 *    switched (see src/encounter-solver.ts).
 * 2. Enemy specs grew two EXP-011/EXP-013 dimensions: attack *kind* (`normal` vs `cast`,
 *    `interruptible` + `interruptedAttack`) and the Stone Throw *ability* (`THROW IN N`, pin
 *    duration, deterministic `free-arrow` targeting). Both are describable per `--enemy` CLI
 *    token (or full-fidelity JSON), so no hand-authored encounter file is needed per seed.
 *
 * Like EXP-012: facts only, deliberately NO ranking / "fun score". Candidates are the first `top`
 * passing seeds in ascending seed order (stable output) and the final pick stays with the human
 * Level Designer. A seed is reported only when every number is exhaustive (proven) — budget
 * exhaustion means "skipped as unproven", never a guessed answer.
 */

export interface StoneThrowSpec {
  /** `THROW IN N`: world turns between ability resolutions. */
  interval: number
  /** World turns the pinned arrow stays illegal to tap. */
  pinDuration: number
}

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
   * (a hit only damages, the timer keeps ticking). EXP-010 legacy shape, kept for compat.
   */
  interruptHits?: number
  /** EXP-011 attack type telegraphed to the player. Default `'normal'`. */
  kind?: AttackKind
  /**
   * EXP-011, `kind: 'cast'` only: a landed hit while armed cancels the cast (no damage this
   * cycle) and the enemy's next attack becomes a plain `normal` attack with the same
   * interval/damage. Set via the `cast-int` CLI token.
   */
  interruptible?: boolean
  /** EXP-013 Stone Throw ability. Absent = no ability. */
  ability?: StoneThrowSpec
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

export interface CastInterruptEvent {
  /** 1-based world turn of the interrupting hit on the example winning path. */
  turn: number
  enemyId: string
  side: string
}

export interface AbilityTriggerEvent {
  /** 1-based world turn the ability resolved on the example winning path. */
  turn: number
  enemyId: string
  pinnedId: number
  pinDuration: number
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
  /** Playable (free AND unpinned) arrow ids at encounter start — the actual legal first taps. */
  initialPlayableArrows: number[]
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
  /** Cast interrupts observed while replaying the example path (EXP-011). */
  castInterrupts: CastInterruptEvent[]
  /** Ability resolutions observed while replaying the example path (EXP-013). */
  abilityTriggers: AbilityTriggerEvent[]
  /** Distinct arrow ids ever pinned on the example path ("which arrow gets pinned"). */
  pinnedArrowIds: number[]
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
 * Parses one `--enemy` spec. Base forms (EXP-012, unchanged):
 * - `SIDE:HP` — passive enemy, never attacks;
 * - `SIDE:HP:INTERVAL:DAMAGE` — normal attack every INTERVAL turns for DAMAGE;
 * - `SIDE:HP:INTERVAL:DAMAGE:INTERRUPT_HITS` — plus opt-in legacy interrupt.
 *
 * EXP-014 keyword tokens after the base fields (any order, each at most once):
 * - `cast` — telegraph as `CAST IN N` (uninterruptible: hits never touch the timer);
 * - `cast-int` — interruptible cast: a landed hit cancels the cast, next attack is plain
 *   `normal` with the same interval/damage;
 * - `throw:I:P` — Stone Throw ability: `THROW IN I`, pins one arrow for P world turns
 *   (deterministic `free-arrow` targeting, never the last playable arrow).
 *
 * The ability-only (passive attacker + thrower) shape needs no INTERVAL/DAMAGE:
 * `N:6:throw:3:2`. SIDE is N/E/S/W (case-insensitive) or 0/1/2/3.
 */
export function parseEnemySpec(raw: string): MultiEnemySpec {
  const parts = raw.split(':')
  if (parts.length < 2) throw new Error(`bad --enemy "${raw}": expected SIDE:HP[:INTERVAL:DAMAGE[:tokens]]`)
  const sideToken = parts[0].trim().toUpperCase()
  let side: Dir
  if (sideToken in SIDE_BY_NAME) side = SIDE_BY_NAME[sideToken]
  else if (/^[0-3]$/.test(sideToken)) side = Number(sideToken) as Dir
  else throw new Error(`bad --enemy "${raw}": side must be N/E/S/W or 0-3`)

  const rest = parts.slice(1)
  const ints: number[] = []
  let i = 0
  // Positional integer prefix: HP [:INTERVAL:DAMAGE [:INTERRUPT_HITS]]. Stops at the first
  // non-integer token so keyword tails (`cast`, `throw`, ...) parse after it.
  while (i < rest.length && /^-?\d+$/.test(rest[i].trim())) {
    const n = Number(rest[i].trim())
    if (!Number.isInteger(n)) throw new Error(`bad --enemy "${raw}": HP/INTERVAL/DAMAGE/INTERRUPT_HITS must be integers`)
    ints.push(n)
    i++
  }
  if (ints.length < 1 || ints.length > 4) {
    throw new Error(`bad --enemy "${raw}": expected SIDE:HP[:INTERVAL:DAMAGE[:INTERRUPT_HITS]] before keywords`)
  }
  if (ints.some((n) => !Number.isInteger(n))) throw new Error(`bad --enemy "${raw}": HP/INTERVAL/DAMAGE/INTERRUPT_HITS must be integers`)
  const [hp, interval, damage, interruptHits] = ints
  if (hp! < 1) throw new Error(`bad --enemy "${raw}": HP must be >= 1`)

  let kind: AttackKind | undefined
  let interruptible: boolean | undefined
  let ability: StoneThrowSpec | undefined
  const seen = new Set<string>()
  while (i < rest.length) {
    const tok = rest[i].trim().toLowerCase()
    if (tok === 'cast' || tok === 'cast-int') {
      if (seen.has('cast')) throw new Error(`bad --enemy "${raw}": duplicate cast token`)
      seen.add('cast')
      kind = 'cast'
      if (tok === 'cast-int') interruptible = true
      i++
    } else if (tok === 'throw') {
      if (seen.has('throw')) throw new Error(`bad --enemy "${raw}": duplicate throw token`)
      seen.add('throw')
      const a = rest[i + 1]
      const b = rest[i + 2]
      if (a === undefined || b === undefined || !/^\d+$/.test(a.trim()) || !/^\d+$/.test(b.trim())) {
        throw new Error(`bad --enemy "${raw}": throw needs THROW_INTERVAL:PIN_DURATION, e.g. throw:3:2`)
      }
      const throwInterval = Number(a.trim())
      const pinDuration = Number(b.trim())
      if (throwInterval < 1) throw new Error(`bad --enemy "${raw}": THROW_INTERVAL must be >= 1`)
      if (pinDuration < 1) throw new Error(`bad --enemy "${raw}": PIN_DURATION must be >= 1`)
      ability = { interval: throwInterval, pinDuration }
      i += 3
    } else if (/^-?\d+$/.test(tok)) {
      throw new Error(`bad --enemy "${raw}": unexpected positional integer "${rest[i].trim()}" after keywords`)
    } else {
      throw new Error(`bad --enemy "${raw}": unknown token "${rest[i].trim()}" (expected cast, cast-int, or throw:I:P)`)
    }
  }

  if (ints.length === 2 || ints.length > 4) {
    throw new Error(`bad --enemy "${raw}": attacking enemy needs SIDE:HP:INTERVAL:DAMAGE`)
  }
  if (ints.length >= 3) {
    if (interval! < 1) throw new Error(`bad --enemy "${raw}": INTERVAL must be >= 1`)
    if (damage! < 1) throw new Error(`bad --enemy "${raw}": DAMAGE must be >= 1`)
  }
  if (ints.length === 4 && interruptHits! < 1) throw new Error(`bad --enemy "${raw}": INTERRUPT_HITS must be >= 1`)
  if (kind === 'cast' && ints.length < 3) {
    throw new Error(`bad --enemy "${raw}": cast needs an attack timer (SIDE:HP:INTERVAL:DAMAGE:cast[-int])`)
  }
  if (interruptible && kind !== 'cast') throw new Error(`bad --enemy "${raw}": interruptible requires cast`)

  const spec: MultiEnemySpec = { side, hp: hp! }
  if (interval !== undefined && damage !== undefined) {
    spec.interval = interval
    spec.damage = damage
  }
  if (interruptHits !== undefined) spec.interruptHits = interruptHits
  if (kind !== undefined) spec.kind = kind
  if (interruptible !== undefined) spec.interruptible = interruptible
  if (ability !== undefined) spec.ability = ability
  return spec
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

/**
 * Full-fidelity alternative to repeated `--enemy` strings: a JSON array of `MultiEnemySpec`
 * (e.g. for a custom `interruptedAttack` or ability tuning the token grammar cannot express).
 * Validated the same way as the token form.
 */
export function parseEnemiesJson(raw: string): MultiEnemySpec[] {
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    throw new Error('bad --enemies-json: not valid JSON (expected an array of enemy specs)')
  }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('bad --enemies-json: expected a non-empty array')
  return arr.map((e, idx) => {
    const s = e as Partial<MultiEnemySpec>
    if (typeof s !== 'object' || s === null) throw new Error(`bad --enemies-json[${idx}]: must be an object`)
    if (s.side !== 0 && s.side !== 1 && s.side !== 2 && s.side !== 3) {
      throw new Error(`bad --enemies-json[${idx}]: side must be 0/1/2/3 (N/E/S/W)`)
    }
    if (!Number.isInteger(s.hp) || (s.hp as number) < 1) throw new Error(`bad --enemies-json[${idx}]: hp must be >= 1`)
    if ((s.interval === undefined) !== (s.damage === undefined)) {
      throw new Error(`bad --enemies-json[${idx}]: interval and damage go together`)
    }
    if (s.interval !== undefined && (!Number.isInteger(s.interval) || s.interval < 1)) {
      throw new Error(`bad --enemies-json[${idx}]: interval must be >= 1`)
    }
    if (s.damage !== undefined && (!Number.isInteger(s.damage) || s.damage < 1)) {
      throw new Error(`bad --enemies-json[${idx}]: damage must be >= 1`)
    }
    if (s.interruptHits !== undefined && (!Number.isInteger(s.interruptHits) || s.interruptHits < 1)) {
      throw new Error(`bad --enemies-json[${idx}]: interruptHits must be >= 1`)
    }
    if (s.kind !== undefined && s.kind !== 'normal' && s.kind !== 'cast') {
      throw new Error(`bad --enemies-json[${idx}]: kind must be 'normal' or 'cast'`)
    }
    if (s.interruptible && s.kind !== 'cast') throw new Error(`bad --enemies-json[${idx}]: interruptible requires kind 'cast'`)
    if (s.kind === 'cast' && s.interval === undefined) {
      throw new Error(`bad --enemies-json[${idx}]: cast needs an attack timer (interval/damage)`)
    }
    if (s.ability !== undefined) {
      const a = s.ability as Partial<StoneThrowSpec>
      if (!Number.isInteger(a.interval) || (a.interval as number) < 1) {
        throw new Error(`bad --enemies-json[${idx}]: ability.interval must be >= 1`)
      }
      if (!Number.isInteger(a.pinDuration) || (a.pinDuration as number) < 1) {
        throw new Error(`bad --enemies-json[${idx}]: ability.pinDuration must be >= 1`)
      }
    }
    return s as MultiEnemySpec
  })
}

/** Builds the `enemies`-mode def shared by every scanned seed. No Rotate: priority, not direction. */
export function multiEnemyDef(
  id: string,
  title: string,
  specs: readonly MultiEnemySpec[],
  blockedTapDamage: number,
): EncounterDef {
  if (specs.length === 0) throw new Error('multi-enemy scan needs at least one --enemy')
  const def: EncounterDef = {
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
              ...(s.kind !== undefined ? { kind: s.kind } : {}),
              // EXP-011: an interrupted cast becomes a plain normal attack with the same
              // interval/damage (a type change, not a timer bonus — see src/encounter.ts).
              ...(s.interruptible ? { interruptible: true as const, interruptedAttack: { interval: s.interval, damage: s.damage, kind: 'normal' as const } } : {}),
            }
          : undefined,
      ability: s.ability
        ? {
            id: 'stone_throw',
            interval: s.ability.interval,
            targetPolicy: 'free-arrow' as const,
            pinDuration: s.ability.pinDuration,
            label: 'stone throw',
          }
        : undefined,
    })),
    rotate: { allow: [] },
    blockedTapDamage,
  }
  checkEncounter(def)
  return def
}

/**
 * Earliest turn (1-based) each of `sides` can first be hit, over every legal play order.
 * Exhaustive DFS with memo in fixed (id-ascending) tap order, so the result is deterministic.
 * Stops early only on budget exhaustion (`earliestHitProven: false`).
 * EXP-014: iterates `playableArrows()` (pin-aware), not `board.freeArrows()`.
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
    for (const id of s.playableArrows()) {
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
 * EXP-014: iterates `playableArrows()` (pin-aware), not `board.freeArrows()`.
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
    for (const id of s.playableArrows()) {
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

/**
 * Replays an example winning path and records the EXP-011/EXP-013 combat events on it:
 * cast interrupts (which turn, which enemy) and Stone Throw resolutions (which turn, which
 * enemy threw, which arrow got pinned, for how long). Deterministic for fixed inputs.
 * `turn` is the 1-based world-turn index (a Rotate only counts when it advances the turn).
 */
export function replayCombatEvents(
  level: Level,
  def: EncounterDef,
  actions: readonly EncounterAction[],
  playerHp?: number,
): { castInterrupts: CastInterruptEvent[]; abilityTriggers: AbilityTriggerEvent[] } {
  const s = EncounterState.fromLevel(level, def, playerHp)
  const castInterrupts: CastInterruptEvent[] = []
  const abilityTriggers: AbilityTriggerEvent[] = []
  let turn = 0
  for (const a of actions) {
    if (a.kind === 'rotate') {
      s.rotate(a.turn)
      if (def.rotate.advancesTurn) turn++
      continue
    }
    turn++
    const dir = s.arenaDir(a.id)
    const target = s.enemies.find((e) => !e.dead && e.side === dir)
    const cdBefore = new Map(s.enemies.map((e) => [e.id, e.abilityCountdown]))
    const aliveBefore = new Set(s.enemies.filter((e) => !e.dead).map((e) => e.id))
    const r = s.tap(a.id)
    if (!r.ok) continue
    if (r.castInterrupted && target) {
      castInterrupts.push({ turn, enemyId: target.id, side: DIR_NAMES[target.side] })
    }
    if (r.pinnedThisTurn && r.pinnedThisTurn.length > 0) {
      // Ability resolution order is enemy-index order, and `pinnedThisTurn` concatenates in
      // that order — so pin j belongs to thrower j. A thrower is an alive ability-owner whose
      // countdown wrapped this turn (was 1, fired, reset to its interval).
      const throwers = (def.enemies ?? [])
        .filter((e) => aliveBefore.has(e.id) && e.ability && cdBefore.get(e.id) === 1)
        .map((e) => e.id)
      r.pinnedThisTurn.forEach((p, j) => {
        abilityTriggers.push({
          turn,
          enemyId: throwers[Math.min(j, throwers.length - 1)] ?? 'unknown',
          pinnedId: p.id,
          pinDuration: p.turnsLeft,
        })
      })
    }
  }
  return { castInterrupts, abilityTriggers }
}

/** Full fact sheet for one seed under one multi-enemy def. Deterministic for fixed inputs. */
export function analyzeMultiSeed(
  level: Level,
  def: EncounterDef,
  opts: { playerHp: number; nodeBudget: number },
): MultiSeedFacts {
  const a = analyzeSeed(level)
  const start = EncounterState.fromLevel(level, def, opts.playerHp)
  const initialPlayableArrows = start.playableArrows()
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
  const events = exampleActions.length ? replayCombatEvents(level, def, exampleActions, opts.playerHp) : { castInterrupts: [], abilityTriggers: [] }
  return {
    seed: level.seed ?? -1,
    levelHash: levelHash(level),
    solvable: md.win,
    proven: md.proven,
    arrows: a.arrows,
    dirCounts: [...a.dirCounts],
    initialFree: [...a.initialFree],
    initialPlayableArrows,
    earliestHitTurn: eh.turns,
    earliestHitProven: eh.proven,
    minDamage: md.win ? md.minDamage : -1,
    minDamageProven: md.proven,
    cleanPath: md.win && md.proven && md.minDamage === 0,
    exampleActions,
    examplePath: exampleActions.length ? traceActions(level, def, exampleActions, opts.playerHp) : [],
    castInterrupts: events.castInterrupts,
    abilityTriggers: events.abilityTriggers,
    pinnedArrowIds: [...new Set(events.abilityTriggers.map((t) => t.pinnedId))].sort((x, y) => x - y),
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
