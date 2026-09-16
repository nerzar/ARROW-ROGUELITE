import { DIR_NAMES } from './dir.js'
import {
  type EncounterAction,
  type EncounterDef,
  EncounterState,
  formatAction,
  type Turn,
} from './encounter.js'
import type { Level } from './level.js'
import { createRng } from './rng.js'
import { BoardTopology } from './topology.js'

/**
 * EXP-008 encounter validator. Exhaustive depth-first search over taps and Rotates with a memo of
 * failed states. Built for one small hand-authored encounter at a time (boards of ~10–30 arrows),
 * not as the future general EncounterSolver.
 *
 * EXP-010: `EncounterState.lost` is now player-death only, and `won` also fires on "board fully
 * cleared, player still alive" (docs/COMBAT-RULES.md 7/8: running out of useful ammo against a live
 * target is not an automatic loss). So `findWin` answers "can this be finished at all" — which,
 * because dying is the only `lost` path, is the same question as "can it be finished without
 * dying". What's new here is `minDamageToWin`: "what is the least HP a perfect player loses on the
 * way to finishing this", 0 meaning a no-damage path exists (E3/E4's requirement). EXP-008's
 * ammo-based upper-bound prune was removed: it assumed "can't reach the target enough times" implied
 * death, which the board-clear-alive win path made unsound. Search is plain memoized DFS now —
 * still correct, just slower; budget exhaustion still degrades to UNKNOWN rather than a false answer.
 */

export interface WinQuery {
  /** At most this many Rotates may be used (still limited by granted charges). Default: unlimited. */
  maxRotates?: number
  /** Search node limit; if hit, the answer is not proven. Default 2 000 000. */
  nodeBudget?: number
}

export interface WinResult {
  win: boolean
  /** true: `win` is proven (a win was found, or the whole space was searched). */
  proven: boolean
  /** Winning actions from the given state (empty if none found). */
  sequence: EncounterAction[]
  nodes: number
}

const DEFAULT_BUDGET = 2_000_000

/** Searches for a win starting from `start` (not modified). */
export function findWin(start: EncounterState, q: WinQuery = {}): WinResult {
  const s = start.clone()
  const base = s.actions.length
  const maxRotates = q.maxRotates ?? Infinity
  const budget = q.nodeBudget ?? DEFAULT_BUDGET
  const failed = new Set<string>()
  let nodes = 0
  let aborted = false

  const visit = (): boolean => {
    if (s.won) return true
    if (s.over) return false
    if (++nodes > budget) {
      aborted = true
      return false
    }
    const key = s.key()
    if (failed.has(key)) return false
    const free = s.board.freeArrows()
    const tryTap = (id: number) => {
      s.tap(id)
      if (visit()) return true
      s.undo()
      return false
    }
    // Hits first: they are what the search is looking for.
    for (const id of free) if (s.wouldHit(id) && tryTap(id)) return true
    if (s.rotatesUsed < maxRotates) {
      for (const turn of s.def.rotate.allow) {
        if (!s.canRotate(turn)) continue
        // Undoing the previous Rotate never helps.
        const last = s.actions[s.actions.length - 1]
        if (last?.kind === 'rotate' && last.turn === -turn) continue
        s.rotate(turn)
        if (visit()) return true
        s.undo()
      }
    }
    for (const id of free) if (!s.wouldHit(id) && tryTap(id)) return true
    if (!aborted) failed.add(key)
    return false
  }

  const win = visit()
  return { win, proven: win || !aborted, sequence: win ? s.actions.slice(base) : [], nodes }
}

/**
 * EXP-008 had an upper-bound prune here ("not enough alive arrows can ever reach this phase's side
 * -> dead"). EXP-010 removed it: docs/COMBAT-RULES.md 7/8 made "board cleared, target still alive,
 * player survived" a valid win, so running out of useful ammo no longer proves a state is dead —
 * only `EncounterState.over` (player HP 0) does. Without that prune, `findWin`/`minDamageToWin` fall
 * back to plain memoized DFS, which is what keeps them correct under the new rule; it costs some
 * search speed, acceptable at this spike's board sizes (tiny/easy/medium, ≤ ~20 arrows).
 */

/** Most hits reachable from `start` (exact unless `proven` is false). */
export function maxHits(start: EncounterState, q: WinQuery = {}): { hits: number; proven: boolean; nodes: number } {
  const s = start.clone()
  const maxRotates = q.maxRotates ?? Infinity
  const budget = q.nodeBudget ?? DEFAULT_BUDGET
  const memo = new Map<string, number>()
  let nodes = 0
  let aborted = false

  // Returns the extra hits achievable from the current state.
  const visit = (): number => {
    if (s.over) return 0
    if (++nodes > budget) {
      aborted = true
      return 0
    }
    const key = s.key()
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    let best = 0
    const cap = Math.min(s.totalHp - s.hits, s.board.remaining)
    for (const id of s.board.freeArrows()) {
      const hit = s.wouldHit(id)
      s.tap(id)
      best = Math.max(best, (hit ? 1 : 0) + visit())
      s.undo()
      if (best >= cap) break
    }
    if (best < cap && s.rotatesUsed < maxRotates) {
      for (const turn of s.def.rotate.allow) {
        if (!s.canRotate(turn)) continue
        s.rotate(turn)
        best = Math.max(best, visit())
        s.undo()
        if (best >= cap) break
      }
    }
    if (!aborted) memo.set(key, best)
    return best
  }

  const extra = visit()
  return { hits: s.hits + extra, proven: !aborted, nodes }
}

export interface MinDamageResult {
  /** A winning path was found (dying mid-path is never part of a "win": see EncounterState.over). */
  win: boolean
  /** true: `minDamage` is the exhaustively-verified minimum, not a budget-limited best-effort guess. */
  proven: boolean
  /** Minimum total player damage among winning paths found; -1 if no win was found. 0 = a perfect,
   * no-damage path exists. */
  minDamage: number
  /** One sequence that achieves `minDamage` (empty if no win was found). */
  sequence: EncounterAction[]
  nodes: number
}

/**
 * Exhaustive DFS+memo over taps/Rotates minimizing total player HP lost among all paths that reach
 * `s.won` (a path that lets the player die is not a win — it never reaches `s.won`, see
 * EncounterState.over/lost). Structurally the mirror of `maxHits`, but minimizing a cost instead of
 * maximizing a count, and reconstructing the actual best sequence (`maxHits`/`findWin` don't need to:
 * `findWin` already returns one, and `maxHits` only reports a number).
 */
export function minDamageToWin(start: EncounterState, q: WinQuery = {}): MinDamageResult {
  const s = start.clone()
  const maxRotates = q.maxRotates ?? Infinity
  const budget = q.nodeBudget ?? DEFAULT_BUDGET
  const memo = new Map<string, number>()
  const choice = new Map<string, EncounterAction>()
  let nodes = 0
  let aborted = false

  const visit = (): number => {
    if (s.won) return 0
    if (s.over) return Infinity
    if (++nodes > budget) {
      aborted = true
      return Infinity
    }
    const key = s.key()
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    let best = Infinity
    let bestAction: EncounterAction | null = null
    for (const id of s.board.freeArrows()) {
      const hpBefore = s.playerHp
      s.tap(id)
      const dmg = hpBefore - s.playerHp
      const rest = visit()
      if (rest !== Infinity && dmg + rest < best) {
        best = dmg + rest
        bestAction = { kind: 'tap', id }
      }
      s.undo()
      if (best === 0) break
    }
    if (best !== 0 && s.rotatesUsed < maxRotates) {
      for (const turn of s.def.rotate.allow) {
        if (!s.canRotate(turn)) continue
        const hpBefore = s.playerHp
        s.rotate(turn)
        const dmg = hpBefore - s.playerHp
        const rest = visit()
        if (rest !== Infinity && dmg + rest < best) {
          best = dmg + rest
          bestAction = { kind: 'rotate', turn }
        }
        s.undo()
        if (best === 0) break
      }
    }
    if (!aborted) {
      memo.set(key, best)
      if (bestAction) choice.set(key, bestAction)
    }
    return best
  }

  const total = visit()
  const win = total !== Infinity
  const sequence: EncounterAction[] = []
  if (win) {
    const t = start.clone()
    let guard = 0
    while (!t.won && guard++ < 10_000) {
      const a = choice.get(t.key())
      if (!a) break
      t.apply(a)
      sequence.push(a)
    }
  }
  return { win, proven: !aborted, minDamage: win ? total : -1, sequence, nodes }
}

export interface EncounterReport {
  totalHp: number
  phases: string[]
  grantedRotates: number
  /** Any number of Rotates (up to granted charges). */
  win: WinResult
  /** No Rotate at all. */
  winWithoutRotate: WinResult
  /** byRotates[k]: win using at most k Rotates, k = 0..grantedRotates. */
  byRotates: { maxRotates: number; win: boolean; proven: boolean; nodes: number }[]
  /** Smallest k with a win, -1 if none (or not proven). */
  minRotates: number
  /** Best damage without Rotate — how close the player gets before Rotate is needed. */
  maxHitsWithoutRotate: { hits: number; proven: boolean }
  /** Minimum player HP lost among winning paths; `minDamageWin.minDamage === 0` = a perfect path exists. */
  minDamageWin: MinDamageResult
  /** Trace of the min-damage winning sequence (falls back to `win.sequence` if that search aborted). */
  exampleTrace: string[]
}

export function validateEncounter(
  level: Level,
  def: EncounterDef,
  q: Pick<WinQuery, 'nodeBudget'> & { playerHp?: number } = {},
): EncounterReport {
  const start = new EncounterState(BoardTopology.fromLevel(level), def, q.playerHp)
  const granted = def.boss.phases.reduce((s, p) => s + (p.grantRotate ?? 0), 0)
  const byRotates = []
  let minRotates = -1
  let winWithoutRotate: WinResult | null = null
  for (let k = 0; k <= granted; k++) {
    const r = findWin(start, { ...q, maxRotates: k })
    if (k === 0) winWithoutRotate = r
    byRotates.push({ maxRotates: k, win: r.win, proven: r.proven, nodes: r.nodes })
    if (r.win && minRotates < 0) minRotates = k
  }
  const win = findWin(start, q)
  const noRot = maxHits(start, { ...q, maxRotates: 0 })
  const minDamageWin = minDamageToWin(start, q)
  const bestSequence = minDamageWin.win ? minDamageWin.sequence : win.win ? win.sequence : []
  return {
    totalHp: start.totalHp,
    phases: def.boss.phases.map(
      (p, i) =>
        `${i + 1}: side ${DIR_NAMES[p.side]}, ${p.hpUnits} hp${p.grantRotate ? `, grants Rotate ×${p.grantRotate}` : ''}` +
        (p.attackTimer ? `, ATTACK IN ${p.attackTimer.interval} (dmg ${p.attackTimer.damage}, interrupt ${p.attackTimer.interruptHits ?? 1} hit(s))` : ''),
    ),
    grantedRotates: granted,
    win,
    winWithoutRotate: winWithoutRotate as WinResult,
    byRotates,
    minRotates,
    maxHitsWithoutRotate: { hits: noRot.hits, proven: noRot.proven },
    minDamageWin,
    exampleTrace: bestSequence.length ? traceActions(level, def, bestSequence, start.playerHpStart) : [],
  }
}

/** Replays actions through a fresh EncounterState and describes every step, including combat pressure. */
export function traceActions(level: Level, def: EncounterDef, actions: readonly EncounterAction[], playerHp?: number): string[] {
  const s = EncounterState.fromLevel(level, def, playerHp)
  const lines: string[] = []
  actions.forEach((a, i) => {
    const n = String(i + 1).padStart(3)
    if (a.kind === 'rotate') {
      const hpBefore = s.playerHp
      const ok = s.rotate(a.turn)
      let text = `${n}. ${formatAction(a)}${ok ? '' : '  !! illegal'}  -> rotation ${s.rotation * 90}°, charges ${s.rotateCharges}`
      if (ok && s.playerHp !== hpBefore) text += `  ENEMY ATTACK -${hpBefore - s.playerHp} hp (player ${s.playerHp})`
      lines.push(text)
      return
    }
    const local = DIR_NAMES[level.arrows[a.id].dir]
    const r = s.tap(a.id)
    if (!r.ok) {
      const dmg = r.reason === 'blocked' ? `  -${r.damage} hp (player ${r.playerHp})` : ''
      lines.push(`${n}. ${formatAction(a)}  !! ${r.reason}${dmg}`)
      return
    }
    let text = `${n}. ${formatAction(a).padEnd(8)} ${local}->${DIR_NAMES[r.arenaDir]}  ${r.hit ? 'HIT ' : 'miss'}  hp ${s.hp}/${s.totalHp}`
    if (r.interrupted) text += '  interrupt (attack timer reset)'
    if (r.enemyAttacked) text += `  ENEMY ATTACK -${r.enemyDamage} hp (player ${r.playerHp})`
    if (r.phaseAfter !== r.phaseBefore) {
      text += r.won ? '  => WIN' : `  => phase ${r.phaseAfter + 1}, boss on ${DIR_NAMES[s.bossSide as number]}`
      if (r.granted) text += `, Rotate +${r.granted}`
    }
    if (r.playerDead) text += '  => PLAYER DEAD'
    lines.push(text)
  })
  return lines
}

export function formatEncounterReport(r: EncounterReport): string {
  const yn = (w: { win: boolean; proven: boolean }) => (w.win ? 'YES' : w.proven ? 'NO' : 'UNKNOWN (budget)')
  return [
    `boss HP ${r.totalHp}; phases:`,
    ...r.phases.map((p) => `  ${p}`),
    `Rotate charges granted in total: ${r.grantedRotates}`,
    '',
    `win exists (any Rotates):      ${yn(r.win)}   nodes ${r.win.nodes}`,
    `win without Rotate:            ${yn(r.winWithoutRotate)}   nodes ${r.winWithoutRotate.nodes}`,
    ...r.byRotates.map((b) => `win with <= ${b.maxRotates} Rotate:          ${yn(b)}   nodes ${b.nodes}`),
    `min Rotates needed:            ${r.minRotates < 0 ? '—' : r.minRotates}`,
    `max damage without Rotate:     ${r.maxHitsWithoutRotate.hits}/${r.totalHp}${r.maxHitsWithoutRotate.proven ? '' : ' (not proven)'}`,
    '',
    `no-damage path exists:         ${r.minDamageWin.win ? (r.minDamageWin.minDamage === 0 ? 'YES' : `NO (min damage ${r.minDamageWin.minDamage})`) : r.minDamageWin.proven ? 'NO (unwinnable)' : 'UNKNOWN (budget)'}`,
    `min unavoidable player damage: ${r.minDamageWin.win ? r.minDamageWin.minDamage : '—'}${r.minDamageWin.proven ? '' : ' (not proven optimal)'}   nodes ${r.minDamageWin.nodes}`,
    '',
    'example winning sequence (minimum damage):',
    ...(r.exampleTrace.length ? r.exampleTrace : ['  (none)']),
  ].join('\n')
}

export type PlayPolicy = 'greedy' | 'sloppy'

export interface Phase2Probe {
  policy: PlayPolicy
  samples: number
  /** Share of simulated phase-1 playthroughs after which a win is still possible. */
  winnableAtPhase2: number
  /** Share of full simulated playthroughs that win (policy continues through phase 2). */
  simulatedWin: number
  /** Mean alive arrows already pointing at the phase-2 side when phase 2 starts. */
  meanOnSideAtPhase2: number
  /** Mean over samples of the best alive supply towards the phase-2 side after one allowed Rotate. */
  meanBestRotateSupply: number
  /** Per allowed turn: share of samples where "Rotate this way right now" still leads to a win. */
  turnWinShare: { turn: Turn; share: number }[]
}

/**
 * Simulates players who do not plan ahead through phase 1 and looks at the moment phase 2 starts.
 * greedy: tap a hitting arrow if one is free, else Rotate if that makes a free arrow hit, else a
 * random free arrow. sloppy: same, but phase 1 taps uniformly random free arrows, ignoring hits.
 * Deterministic for a given seed.
 */
export function probePhase2(level: Level, def: EncounterDef, policy: PlayPolicy, samples = 30, seed = 1): Phase2Probe {
  const topo = BoardTopology.fromLevel(level)
  const rng = createRng(seed)
  const pick = <T>(xs: T[]) => xs[rng.int(xs.length)]
  const side2 = def.boss.phases[Math.min(1, def.boss.phases.length - 1)].side
  let winnable = 0
  let wins = 0
  let onSide = 0
  let rotateSupply = 0
  let reached = 0
  const turnWins = def.rotate.allow.map((turn) => ({ turn, wins: 0 }))

  for (let i = 0; i < samples; i++) {
    const s = new EncounterState(topo, def)
    let probed = false
    while (!s.over) {
      if (!probed && s.phaseIndex > 0) {
        probed = true
        reached++
        if (findWin(s, { nodeBudget: 200_000 }).win) winnable++
        onSide += s.aliveByArenaDir()[side2]
        let best = 0
        for (const tw of turnWins) {
          if (!s.canRotate(tw.turn)) continue
          s.rotate(tw.turn)
          best = Math.max(best, s.aliveByArenaDir()[side2])
          if (findWin(s, { maxRotates: 0, nodeBudget: 200_000 }).win) tw.wins++
          s.undo()
        }
        rotateSupply += best
      }
      const free = s.board.freeArrows()
      if (policy === 'sloppy' && s.phaseIndex === 0) {
        s.tap(pick(free))
        continue
      }
      const hits = free.filter((id) => s.wouldHit(id))
      if (hits.length > 0) {
        s.tap(pick(hits))
        continue
      }
      const turn = def.rotate.allow.find((t) => {
        if (!s.canRotate(t)) return false
        s.rotate(t)
        const good = free.some((id) => s.wouldHit(id))
        s.undo()
        return good
      })
      if (turn !== undefined) s.rotate(turn)
      else s.tap(pick(free))
    }
    if (s.won) wins++
  }
  const per = (v: number) => (reached === 0 ? 0 : v / reached)
  return {
    policy,
    samples,
    winnableAtPhase2: samples === 0 ? 0 : winnable / samples,
    simulatedWin: samples === 0 ? 0 : wins / samples,
    meanOnSideAtPhase2: per(onSide),
    meanBestRotateSupply: per(rotateSupply),
    turnWinShare: turnWins.map((t) => ({ turn: t.turn, share: per(t.wins) })),
  }
}
