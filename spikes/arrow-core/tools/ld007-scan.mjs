// LD-007 seed scan for one encounter brief (provisional design tooling).
//
// Generates boards for a size/profile over a seed range and evaluates the SAME enemy setup on
// each, reporting the designer metrics from ld007-audit.mjs — so the shortlist is filtered by
// 0-Rotate combat agency and decision density, not only by "solver says WIN".
//
// usage:
//   node tools/ld007-scan.mjs --brief briefs/x.json --size 6 --profile short --start 1 --count 400 [--top 12] [--hp 10]
//   node tools/ld007-scan.mjs --stats --size 6 --profile short --count 300     (board-only distribution)
//
// brief JSON = an `encounter` block exactly as in campaigns/campaign.json (enemies or boss).

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const here = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const core = await import(pathToFileURL(resolve(here, '../dist/src/index.js')).href)
const { generateLevel, BoardTopology, EncounterState, minDamageToWin, DIR_NAMES, analyzeSeed, createRng } = core
const { boardParamsFor } = await import(pathToFileURL(resolve(here, '../viewer/visual-proto/board-profiles.js')).href)
const { ascii } = await import(pathToFileURL(resolve(here, './ld007-lib.mjs')).href)

const args = process.argv.slice(2)
const opt = {}
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const n = args[i + 1]; if (n === undefined || n.startsWith('--')) opt[args[i].slice(2)] = 'true'; else opt[args[i].slice(2)] = n, i++ }

const size = Number(opt.size ?? 6)
const profile = opt.profile ?? 'long'
const start = Number(opt.start ?? 1)
const count = Number(opt.count ?? 300)
const top = Number(opt.top ?? 12)
const playerHp = Number(opt.hp ?? 10)
const budget = Number(opt.budget ?? 400_000)
const SIDE = { N: 0, E: 1, S: 2, W: 3, top: 0, right: 1, left: 3 }

function normalizeDef(enc) {
  const def = JSON.parse(JSON.stringify(enc))
  if (def.enemies) def.enemies = def.enemies.map((e) => ({ ...e, side: typeof e.side === 'string' ? SIDE[e.side] : e.side }))
  if (def.boss) def.boss.phases = def.boss.phases.map((p) => ({ ...p, side: typeof p.side === 'string' ? SIDE[p.side] : p.side }))
  if (def.boss) delete def.enemies
  if (def.rotate?.allow) def.rotate.allow = def.rotate.allow.map((t) => (t === 'cw' ? 1 : t === 'ccw' ? -1 : t))
  return def
}

function boardStats(level) {
  const an = analyzeSeed(level)
  const lens = level.arrows.map((a) => a.cells.length)
  const avgLen = lens.reduce((a, b) => a + b, 0) / lens.length
  // longest run of forced moves (exactly one free arrow) along the canonical order
  let forcedRun = 0, cur = 0
  for (const st of an.steps) { if (st.freeIdsBefore.length <= 1) { cur++; forcedRun = Math.max(forcedRun, cur) } else cur = 0 }
  const dirs = an.dirCounts
  const balance = Math.min(...dirs) / Math.max(...dirs)
  return { an, arrows: level.arrows.length, avgLen, maxLen: Math.max(...lens), branch: an.branchPoints.length, dirBranch: an.dirBranchPoints.length, forcedRun, dirs, balance, initialFree: an.initialFreeIds.length }
}

function lineMetrics(level, def, actions, hp, pool) {
  const s = new EncounterState(BoardTopology.fromLevel(level), def, hp, pool ? { charges: pool } : null)
  let taps = 0, hits = 0, forced = 0, choice = 0, lastHitTurn = 0, turn = 0, options = 0
  const kills = []
  const enemyHp = () => (def.enemies ? s.enemies.map((e) => e.hp) : [s.hp])
  let prev = enemyHp()
  const dmg = []
  for (const a of actions) {
    if (a.kind === 'tap') {
      const n = s.playableArrows().length
      options += n
      if (n <= 1) forced++; else choice++
      const r = s.tap(a.id)
      taps++; turn++
      if (r.hit && r.hitDamage > 0) { hits++; lastHitTurn = turn }
      if (r.enemyAttacked) dmg.push(`t${turn}:-${r.enemyDamage}`)
      const cur = enemyHp()
      cur.forEach((v, i) => { if (v <= 0 && prev[i] > 0) kills.push(`${def.enemies ? def.enemies[i].id : 'boss'}@t${turn}`) })
      prev = cur
    } else s.rotate(a.turn)
  }
  return { taps, hits, forced, choice, lastHitTurn, tail: taps - lastHitTurn, kills, dmg, optionsMean: taps ? options / taps : 0, unlockMoves: taps - hits }
}

/** Naive player: always taps a hitting arrow if one is playable (random among them), else a random
 * playable arrow; never Rotates. Mean damage over `samples` runs = "what happens if you don't plan". */
function naiveDamage(level, def, samples = 40, seed = 7) {
  const topo = BoardTopology.fromLevel(level)
  const rng = createRng(seed)
  let total = 0, deaths = 0
  for (let i = 0; i < samples; i++) {
    const s = new EncounterState(topo, def, playerHp, null)
    while (!s.over) {
      const free = s.playableArrows()
      const hits = free.filter((id) => s.wouldHit(id))
      const pool = hits.length ? hits : free
      s.tap(pool[rng.int(pool.length)])
    }
    total += playerHp - s.playerHp
    if (s.lost) deaths++
  }
  return { mean: total / samples, deathRate: deaths / samples }
}

function evaluate(level, def) {
  const st = boardStats(level)
  const targets = def.enemies ? def.enemies.map((e) => ({ id: e.id, side: e.side, hp: e.hp, mandatory: e.mandatory !== false })) : def.boss.phases.map((p, i) => ({ id: `p${i + 1}`, side: p.side, hp: p.hpUnits, mandatory: true }))
  const unkillable = targets.filter((t) => st.dirs[t.side] < t.hp).map((t) => t.id)
  const wasted = st.dirs.reduce((s, c, d) => s + (targets.some((t) => t.side === d) ? 0 : c), 0)
  const usePool = !!def.rotate.useRunPool
  const res = {}
  for (const pool of usePool ? [0, 1] : [0]) {
    const s0 = new EncounterState(BoardTopology.fromLevel(level), def, playerHp, usePool ? { charges: pool } : null)
    const r = minDamageToWin(s0, { nodeBudget: budget, maxRotates: pool })
    res[pool] = r.win ? { minDmg: r.minDamage, proven: r.proven, ...lineMetrics(level, def, r.sequence, playerHp, usePool ? pool : 0), line: r.sequence } : null
  }
  const naive = naiveDamage(level, def)
  return { st, targets, unkillable, wasted, res, naive }
}

if (opt.stats) {
  const acc = []
  for (let seed = start; seed < start + count; seed++) {
    const gen = generateLevel(boardParamsFor({ size, profile }), seed)
    if (!gen.ok) continue
    acc.push(boardStats(gen.level))
  }
  const mean = (k) => (acc.reduce((s, x) => s + x[k], 0) / acc.length).toFixed(2)
  const q = (k, p) => { const v = acc.map((x) => x[k]).sort((a, b) => a - b); return v[Math.floor(p * (v.length - 1))] }
  console.log(`size ${size} profile ${profile}: ${acc.length}/${count} generated`)
  console.log(`  arrows      mean ${mean('arrows')}  p10 ${q('arrows', 0.1)}  p90 ${q('arrows', 0.9)}`)
  console.log(`  avgLen      mean ${mean('avgLen')}  maxLen mean ${mean('maxLen')}`)
  console.log(`  branchPts   mean ${mean('branch')}  (of arrows)   dirBranch mean ${mean('dirBranch')}`)
  console.log(`  forcedRun   mean ${mean('forcedRun')}  p90 ${q('forcedRun', 0.9)}`)
  console.log(`  initialFree mean ${mean('initialFree')}`)
  console.log(`  dir balance mean ${mean('balance')}  (min/max dir count)`)
  process.exit(0)
}

const brief = JSON.parse(readFileSync(opt.brief, 'utf8'))
const def = normalizeDef(brief.encounter ?? brief)
const rows = []
for (let seed = start; seed < start + count; seed++) {
  const gen = generateLevel(boardParamsFor({ size, profile }), seed)
  if (!gen.ok) continue
  const ev = evaluate(gen.level, def)
  const r0 = ev.res[0], r1 = ev.res[1]
  if (!r0) continue
  // Design score (higher = better). Deliberately NOT a solver score: rewards 0-Rotate agency
  // (kills without Rotate), choice density and short face-tank tails; penalises unkillable
  // targets, wasted ammo and forced runs. Rotate is only rewarded as an *improvement*.
  const mandatoryKills0 = r0.kills.length
  const score =
    mandatoryKills0 * 3 -
    ev.unkillable.length * 4 +
    (r0.minDmg === 0 ? 4 : -2 * r0.minDmg) -
    r0.tail * 1.0 +
    r0.choice * 0.6 -
    r0.forced * 0.4 -
    ev.wasted * 0.5 +
    ev.st.branch * 0.3 -
    ev.st.forcedRun * 0.5 +
    (r1 && r1.minDmg < r0.minDmg ? 1 : 0) +
    Math.min(4, ev.naive.mean - r0.minDmg) * 1.2 -
    (ev.naive.deathRate > 0.5 ? 3 : 0) +
    Math.min(3, r0.unlockMoves) * 1.0 +
    Math.min(4, r0.optionsMean) * 0.8
  rows.push({ seed, score, ev, r0, r1 })
}
rows.sort((a, b) => b.score - a.score)
console.log(`brief ${opt.brief}  size ${size} profile ${profile}  seeds ${start}..${start + count - 1}  evaluated ${rows.length}`)
console.log(`seed   score  arrows len  dirs N/E/S/W  unkill wasted | 0R: dmg hits kills            choice/forced tail opts unlk | naive dmg/death | 1R: dmg kills`)
for (const r of rows.slice(0, top)) {
  const d = r.ev.st.dirs
  console.log(
    `${String(r.seed).padStart(5)}  ${r.score.toFixed(1).padStart(5)}  ${String(r.ev.st.arrows).padStart(3)}  ${r.ev.st.avgLen.toFixed(1)}  ${d.join('/').padEnd(11)}  ${String(r.ev.unkillable.length).padStart(3)}   ${String(r.ev.wasted).padStart(3)}   | ${String(r.r0.minDmg).padStart(3)}  ${String(r.r0.hits).padStart(3)}  ${r.r0.kills.join(',').padEnd(26)} ${r.r0.choice}/${r.r0.forced}   ${String(r.r0.tail).padStart(3)} ${r.r0.optionsMean.toFixed(1)} ${String(r.r0.unlockMoves).padStart(2)} | ${r.ev.naive.mean.toFixed(1).padStart(4)} ${(r.ev.naive.deathRate*100).toFixed(0).padStart(3)}%  | ${r.r1 ? `${r.r1.minDmg}  ${r.r1.kills.join(',')}` : '-'}`,
  )
}
if (opt.show) {
  const r = rows.find((x) => x.seed === Number(opt.show)) ?? rows[0]
  const gen = generateLevel(boardParamsFor({ size, profile }), r.seed)
  console.log(`\nseed ${r.seed}`)
  console.log(ascii(gen.level))
  console.log('0R line:', r.r0.line.map((a) => (a.kind === 'tap' ? `#${a.id}${DIR_NAMES[gen.level.arrows[a.id].dir]}` : `R${a.turn > 0 ? 'cw' : 'ccw'}`)).join(' '), ' attacks', r.r0.dmg.join(' '))
  if (r.r1) console.log('1R line:', r.r1.line.map((a) => (a.kind === 'tap' ? `#${a.id}${DIR_NAMES[gen.level.arrows[a.id].dir]}` : `R${a.turn > 0 ? 'cw' : 'ccw'}`)).join(' '), ' attacks', r.r1.dmg.join(' '))
}
