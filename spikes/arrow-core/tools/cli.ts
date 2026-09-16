import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { type CpScanOptions, scanCpEncounter } from './cp-shortlist.js'
import { type PrologueStep, scanPrologueStep } from './prologue-shortlist.js'
import { scanShortlist } from './shortlist.js'
import {
  analyzeSeed,
  BoardTopology,
  computeMetrics,
  type DifficultyMetrics,
  DIR_NAMES,
  encounterFromJson,
  encounterToJson,
  formatEncounterReport,
  formatSeedAnalysis,
  generateLevel,
  type GeneratorParams,
  hashString,
  type Level,
  levelFromJson,
  type Dir,
  levelHash,
  levelToJson,
  PRESET_NAMES,
  PRESETS,
  type PresetName,
  replayOrder,
  solveBoard,
  validateEncounter,
  verifyLevel,
} from '../src/index.js'

const HELP = `arrow-core spike CLI

  gen    --preset <name> --seed <n|text> [--json] [--out file]
  verify <level.json>
  analyze --preset <name> --seed <n> [--json] [--out file]
         seed analyzer: arrows / initial free by N E S W, direction sequence, per-step dirs, branch points
  encounter <encounter.json> [--budget 2000000] [--player-hp 10] [--json]
         validator: win? win without Rotate? win with <= k Rotate? example winning sequence
  shortlist [--preset medium] [--start 1] [--count 3000] [--side1 E] [--side2 N]
         [--min-arrows 12] [--max-arrows 24] [--top 10] [--out encounters/shortlist.json]
  prologue --step 1|2|3 [--start 1] [--count 5000] [--top 8] [--out encounters/prologue-eN-shortlist.json]
         seed shortlist for one of the three single-target prologue encounters (EXP-009)
  cp-shortlist --step 3|4 [--start 1] [--count 4000] [--top 8] [--out encounters/cp-eN-shortlist.json]
         seed shortlist for the timed combat-pressure encounters E3/E4 (EXP-010), proven no-damage path
  bench  [--count 10000] [--presets tiny,easy,medium,hard,expert] [--seed 1]
         [--extra huge:500,xl:100,strict:1000|none] [--out bench-results/latest.json]

presets: ${PRESET_NAMES.join(', ')}`

function parseArgs(argv: string[]): { cmd: string; pos: string[]; opt: Record<string, string> } {
  const [cmd = 'help', ...rest] = argv
  const pos: string[] = []
  const opt: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--')) {
      const next = rest[i + 1]
      if (next === undefined || next.startsWith('--')) opt[a.slice(2)] = 'true'
      else opt[a.slice(2)] = rest[++i]
    } else pos.push(a)
  }
  return { cmd, pos, opt }
}

const parseSeed = (s: string | undefined, fallback: number): number =>
  s === undefined ? fallback : /^\d+$/.test(s) ? Number(s) >>> 0 : hashString(s)

function preset(name: string): GeneratorParams {
  if (!(name in PRESETS)) throw new Error(`unknown preset "${name}" (${PRESET_NAMES.join(', ')})`)
  return PRESETS[name as PresetName]
}

// ---------------------------------------------------------------------------------------------

export function renderAscii(level: Level): string {
  const { width: w, height: h } = level
  const grid: string[] = new Array(w * h).fill(' .')
  const heads = ['^', '>', 'v', '<']
  const step = new Map(level.solution.map((id, i) => [id, i + 1]))
  for (const a of level.arrows) {
    const label = (step.get(a.id) ?? 0).toString(36).slice(-1)
    for (const c of a.cells) grid[c] = ' ' + label
    grid[a.cells[a.cells.length - 1]] = label + heads[a.dir]
  }
  const rows: string[] = []
  for (let y = 0; y < h; y++) rows.push(grid.slice(y * w, (y + 1) * w).join(' '))
  return rows.join('\n')
}

function cmdGen(opt: Record<string, string>): void {
  const params = preset(opt.preset ?? 'medium')
  const seed = parseSeed(opt.seed, 1)
  const t0 = performance.now()
  const res = generateLevel(params, seed)
  const ms = performance.now() - t0
  if (!res.level) {
    console.error(`generation failed after ${res.attempts} attempts`, res.rejects)
    process.exitCode = 1
    return
  }
  const json = levelToJson(res.level)
  if (opt.out) {
    mkdirSync(dirname(opt.out), { recursive: true })
    writeFileSync(opt.out, JSON.stringify(json))
  }
  if (opt.json) {
    console.log(JSON.stringify(json))
    return
  }
  console.log(renderAscii(res.level))
  console.log(
    `\nseed=${seed} ok=${res.ok} attempts=${res.attempts} time=${ms.toFixed(2)}ms hash=${levelHash(res.level)}` +
      `\n(label = step in the stored solution, base36 last digit)`,
  )
  console.log(computeMetrics(res.level))
}

function cmdVerify(pos: string[]): void {
  const file = pos[0]
  if (!file) throw new Error('verify <level.json>')
  const level = levelFromJson(JSON.parse(readFileSync(file, 'utf8')))
  const errors = verifyLevel(level)
  const solved = solveBoard(level)
  console.log({ file, hash: levelHash(level), errors, solverSolvable: solved.solvable, stuck: solved.stuck })
  if (errors.length > 0 || !solved.solvable) process.exitCode = 1
}

function cmdAnalyze(opt: Record<string, string>): void {
  const presetName = opt.preset ?? 'medium'
  const seed = parseSeed(opt.seed, 1)
  const res = generateLevel(preset(presetName), seed)
  if (!res.ok || !res.level) throw new Error(`preset ${presetName} seed ${seed}: generation failed`)
  const a = analyzeSeed(res.level)
  if (opt.out) {
    mkdirSync(dirname(opt.out), { recursive: true })
    writeFileSync(opt.out, JSON.stringify({ preset: presetName, levelHash: levelHash(res.level), analysis: a }, null, 2))
  }
  if (opt.json) {
    console.log(JSON.stringify({ preset: presetName, levelHash: levelHash(res.level), analysis: a }))
    return
  }
  console.log(renderAscii(res.level))
  console.log(`
preset ${presetName}  hash ${levelHash(res.level)}  (ASCII label = step in stored solution)`)
  console.log(formatSeedAnalysis(a))
}

function cmdEncounter(pos: string[], opt: Record<string, string>): void {
  const file = pos[0]
  if (!file) throw new Error('encounter <encounter.json>')
  const { file: enc, level } = encounterFromJson(JSON.parse(readFileSync(file, 'utf8')))
  const t0 = performance.now()
  const report = validateEncounter(level, enc.encounter, {
    nodeBudget: Number(opt.budget ?? 2_000_000),
    playerHp: opt['player-hp'] !== undefined ? Number(opt['player-hp']) : undefined,
  })
  const ms = performance.now() - t0
  if (opt.json) {
    console.log(JSON.stringify({ file, board: enc.board, report }))
    return
  }
  console.log(renderAscii(level))
  console.log(`
${file}: ${enc.encounter.title ?? enc.encounter.id}  board ${enc.board.preset} seed ${enc.board.seed} hash ${enc.board.levelHash}`)
  console.log(`rotate allow: ${enc.encounter.rotate.allow.map((t) => (t === 1 ? 'cw' : 'ccw')).join(', ')}   validated in ${ms.toFixed(1)} ms
`)
  console.log(formatEncounterReport(report))
  if (!report.win.win || !report.win.proven || !report.winWithoutRotate.proven) process.exitCode = 1
}

const sideOf = (s: string | undefined, fallback: Dir): Dir => {
  if (s === undefined) return fallback
  const d = DIR_NAMES.indexOf(s.toUpperCase())
  if (d < 0) throw new Error(`bad side ${s}`)
  return d as Dir
}

function cmdShortlist(opt: Record<string, string>): void {
  const presetName = opt.preset ?? 'medium'
  preset(presetName)
  const o = {
    preset: presetName as PresetName,
    start: parseSeed(opt.start, 1),
    count: Number(opt.count ?? 3000),
    side1: sideOf(opt.side1, 1),
    side2: sideOf(opt.side2, 0),
    minArrows: Number(opt['min-arrows'] ?? 12),
    maxArrows: Number(opt['max-arrows'] ?? 24),
    top: Number(opt.top ?? 10),
  }
  const t0 = performance.now()
  const res = scanShortlist(o, (i) => process.stderr.write(`
scanned ${i}/${o.count}`))
  const sec = (performance.now() - t0) / 1000
  process.stderr.write(`
scanned ${o.count}/${o.count} in ${sec.toFixed(1)}s
`)
  const out = opt.out ?? 'encounters/shortlist.json'
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    JSON.stringify(
      {
        generatedBy: 'npm run cli -- shortlist',
        options: { ...o, side1: DIR_NAMES[o.side1], side2: DIR_NAMES[o.side2] },
        scanned: res.scanned,
        passed: res.passed,
        candidates: res.candidates.map((c) => ({ ...c, file: encounterToJson(c.file) })),
      },
      null,
      2,
    ),
  )
  console.log(
    `${presetName} seeds ${o.start}..${o.start + o.count - 1}: ${res.passed} boards pass ` +
      `"win with 1 Rotate, no win without" for ${DIR_NAMES[o.side1]} -> ${DIR_NAMES[o.side2]}
`,
  )
  const side2 = DIR_NAMES[o.side2]
  console.log(`| rank | seed | score | arrows | N/E/S/W | free0 N/E/S/W | hp | no-Rotate max | ${side2}-facing at ph.2 | after Rotate | cw / ccw wins | greedy win | sloppy ph.1 ok |`)
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const c of res.candidates) {
    console.log(
      `| ${c.rank} | ${c.seed} | ${c.score} | ${c.arrows} | ${c.dirCounts.join('/')} | ${c.initialFree.join('/')} | ` +
        `${c.hp[0]}+${c.hp[1]} | ${c.maxHitsWithoutRotate}/${c.hp[0] + c.hp[1]} | ${c.onSideAtPhase2} | ${c.rotateSupplyAtPhase2} | ` +
        `${Object.values(c.turnWin).map((v) => `${Math.round(v * 100)}%`).join(' / ')} | ` +
        `${Math.round(c.greedyWin * 100)}% | ${Math.round(c.sloppyWinnable * 100)}% |`,
    )
  }
  console.log(`
json: ${out}`)
}

const PROLOGUE_STEPS: Record<PrologueStep, { preset: PresetName; side: Dir; hp: number; id: string; title: string }> = {
  1: { preset: 'tiny', side: 1, hp: 1, id: 'prologue_e1', title: 'Prologue 1 — first shot' },
  2: { preset: 'tiny', side: 1, hp: 2, id: 'prologue_e2', title: 'Prologue 2 — free the arrow' },
  3: { preset: 'easy', side: 1, hp: 3, id: 'prologue_e3', title: 'Prologue 3 — projectile budget' },
}

function cmdPrologue(opt: Record<string, string>): void {
  const step = Number(opt.step ?? 1) as PrologueStep
  if (![1, 2, 3].includes(step)) throw new Error('--step must be 1, 2 or 3')
  const spec = PROLOGUE_STEPS[step]
  const o = {
    preset: spec.preset,
    side: spec.side,
    hp: spec.hp,
    start: parseSeed(opt.start, 1),
    count: Number(opt.count ?? 5000),
    top: Number(opt.top ?? 8),
  }
  const t0 = performance.now()
  const res = scanPrologueStep(step, o, spec.id, spec.title, (i) => process.stderr.write(`
scanned ${i}/${o.count}`))
  const sec = (performance.now() - t0) / 1000
  process.stderr.write(`
scanned ${o.count}/${o.count} in ${sec.toFixed(1)}s
`)
  const out = opt.out ?? `encounters/prologue-e${step}-shortlist.json`
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    JSON.stringify(
      {
        generatedBy: 'npm run cli -- prologue',
        step,
        options: { ...o, side: DIR_NAMES[o.side] },
        scanned: res.scanned,
        passed: res.passed,
        candidates: res.candidates.map((c) => ({ ...c, file: encounterToJson(c.file) })),
      },
      null,
      2,
    ),
  )
  console.log(`${spec.preset} seeds ${o.start}..${o.start + o.count - 1}: ${res.passed} boards pass readability filter for step ${step} (${DIR_NAMES[o.side]}, ${o.hp} hp)
`)
  console.log('| rank | seed | score | arrows | N/E/S/W | free0 N/E/S/W | branch/dir-branch |')
  console.log('|---|---|---|---|---|---|---|')
  for (const c of res.candidates) {
    console.log(
      `| ${c.rank} | ${c.seed} | ${c.score} | ${c.arrows} | ${c.dirCounts.join('/')} | ${c.initialFree.join('/')} | ${c.branchPoints}/${c.dirBranchPoints} |`,
    )
  }
  console.log(`
json: ${out}`)
}

// EXP-010 provisional tuning for the timed encounters — data, not a hardcoded engine rule; explicitly
// not user-approved (docs/COMBAT-RULES.md 12, Gemini-suggested starting points per the task).
const CP_STEPS: Record<3 | 4, { preset: PresetName; side: Dir; hp: number; interval: number; damage: number; id: string; title: string }> = {
  3: { preset: 'easy', side: 1, hp: 3, interval: 4, damage: 2, id: 'cp_e3', title: 'Combat pressure 3 — time has a cost' },
  4: { preset: 'easy', side: 1, hp: 5, interval: 3, damage: 3, id: 'cp_e4', title: 'Combat pressure 4 — the same size, again, harder' },
}

function cmdCpShortlist(opt: Record<string, string>): void {
  const step = Number(opt.step ?? 3) as 3 | 4
  if (![3, 4].includes(step)) throw new Error('--step must be 3 or 4')
  const spec = CP_STEPS[step]
  const playerHp = Number(opt['player-hp'] ?? 10)
  const o: CpScanOptions = {
    preset: spec.preset,
    side: spec.side,
    hp: spec.hp,
    attackTimer: { interval: spec.interval, damage: spec.damage },
    blockedTapDamage: Number(opt['blocked-damage'] ?? 1),
    playerHp,
    start: parseSeed(opt.start, 1),
    count: Number(opt.count ?? 4000),
    minArrows: Number(opt['min-arrows'] ?? 8),
    maxArrows: Number(opt['max-arrows'] ?? 18),
    top: Number(opt.top ?? 8),
    requireNoDamage: step === 3,
    damageRange: step === 4 ? [Number(opt['min-damage'] ?? 1), Number(opt['max-damage'] ?? playerHp - 1)] : undefined,
  }
  const t0 = performance.now()
  const res = scanCpEncounter(o, spec.id, spec.title, (i) => process.stderr.write(`
scanned ${i}/${o.count}`))
  const sec = (performance.now() - t0) / 1000
  process.stderr.write(`
scanned ${o.count}/${o.count} in ${sec.toFixed(1)}s
`)
  const out = opt.out ?? `encounters/cp-e${step}-shortlist.json`
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    JSON.stringify(
      {
        generatedBy: 'npm run cli -- cp-shortlist',
        step,
        options: { ...o, side: DIR_NAMES[o.side] },
        scanned: res.scanned,
        passed: res.passed,
        candidates: res.candidates.map((c) => ({ ...c, file: encounterToJson(c.file) })),
      },
      null,
      2,
    ),
  )
  console.log(
    `${spec.preset} seeds ${o.start}..${o.start + o.count - 1}: ${res.passed} boards pass "${o.requireNoDamage ? 'proven no-damage path' : `min damage in [${o.damageRange?.[0]}, ${o.damageRange?.[1]}]`}" for ` +
      `step ${step} (${DIR_NAMES[o.side]}, ${o.hp} hp, ATTACK IN ${spec.interval} dmg ${spec.damage})
`,
  )
  console.log('| rank | seed | score | arrows | N/E/S/W | earliest hit | clear turns | min damage |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const c of res.candidates) {
    console.log(
      `| ${c.rank} | ${c.seed} | ${c.score} | ${c.arrows} | ${c.dirCounts.join('/')} | ${c.earliestHitTurn} | ${c.boardClearTurns} | ${c.minDamageOnIntendedPath} |`,
    )
  }
  console.log(`
json: ${out}`)
}

// ---------------------------------------------------------------------------------------------

function quantiles(values: number[], qs: number[]): number[] {
  const s = [...values].sort((a, b) => a - b)
  return qs.map((q) => (s.length === 0 ? NaN : s[Math.min(s.length - 1, Math.floor(q * s.length))]))
}
const mean = (v: number[]) => (v.length === 0 ? NaN : v.reduce((a, b) => a + b, 0) / v.length)
const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

function histogram(values: number[], edges: number[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 0; i < edges.length - 1; i++) out[`${edges[i]}-${edges[i + 1]}`] = 0
  for (const v of values) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && (v < edges[i + 1] || i === edges.length - 2)) {
        out[`${edges[i]}-${edges[i + 1]}`]++
        break
      }
    }
  }
  return out
}

interface PresetReport {
  preset: string
  params: GeneratorParams
  count: number
  accepted: number
  failed: number
  failureRate: number
  invariantViolations: number
  independentVerifyFailures: number
  solverDisagreements: number
  determinismChecked: number
  determinismMismatches: number
  attempts: { mean: number; p50: number; p95: number; max: number }
  rejectsPerLevel: { fill: number; free: number; arrows: number }
  genMs: { mean: number; p50: number; p95: number; p99: number; max: number }
  solveMs: { mean: number; p95: number; max: number }
  metricsMs: { mean: number }
  metrics: Record<string, { mean: number; p10: number; p50: number; p90: number; min: number; max: number }>
  dirShare: Record<string, number>
  /** Share of accepted levels where at least one exit direction has zero arrows. */
  levelsMissingADirection: number
  /** Per level: smallest direction count / arrows. */
  minDirShare: { mean: number; p10: number; p50: number; p90: number; min: number; max: number }
  scoreHistogram: Record<string, number>
  depthHistogram: Record<string, number>
}

function benchPreset(name: string, count: number, baseSeed: number): PresetReport {
  const params = preset(name)
  const genMs: number[] = []
  const solveMs: number[] = []
  const metricsMs: number[] = []
  const attempts: number[] = []
  const metrics: DifficultyMetrics[] = []
  const rejects = { fill: 0, free: 0, arrows: 0 }
  let failed = 0
  let invariant = 0
  let verifyFail = 0
  let solverDisagree = 0
  let detChecked = 0
  let detMismatch = 0

  // Warm up the JIT so the first preset is not penalised.
  for (let i = 0; i < 20; i++) generateLevel(params, 0xdead + i)

  for (let i = 0; i < count; i++) {
    const seed = (baseSeed + i) >>> 0
    let t = performance.now()
    const res = generateLevel(params, seed)
    genMs.push(performance.now() - t)
    attempts.push(res.attempts)
    rejects.fill += res.rejects.fill
    rejects.free += res.rejects.free
    rejects.arrows += res.rejects.arrows
    invariant += res.rejects.invariant
    if (!res.ok || !res.level) {
      failed++
      continue
    }
    const level = res.level

    // Independent re-check outside the generator (the generator already did one).
    if (verifyLevel(level).length > 0) verifyFail++

    t = performance.now()
    const topo = BoardTopology.fromLevel(level)
    const solved = solveBoard(topo)
    solveMs.push(performance.now() - t)
    if (!solved.solvable || !replayOrder(level, solved.order).ok) solverDisagree++

    t = performance.now()
    metrics.push(computeMetrics(level, topo))
    metricsMs.push(performance.now() - t)

    if (i % 50 === 0) {
      detChecked++
      const again = generateLevel(params, seed)
      if (!again.level || levelHash(again.level) !== levelHash(level)) detMismatch++
    }
  }

  const pick = (k: keyof DifficultyMetrics) => metrics.map((m) => m[k] as number)
  const summarize = (v: number[]) => {
    const [p10, p50, p90] = quantiles(v, [0.1, 0.5, 0.9])
    return { mean: r3(mean(v)), p10: r3(p10), p50: r3(p50), p90: r3(p90), min: r3(Math.min(...v)), max: r3(Math.max(...v)) }
  }
  const metricKeys: (keyof DifficultyMetrics)[] = [
    'arrows', 'fill', 'avgLength', 'maxLength', 'turnsPerArrow', 'initialFree', 'initialFreeRatio',
    'depth', 'widestLayer', 'avgBlockers', 'meanFreeRatio', 'forcedMoves', 'score',
  ]
  const dirTotals = [0, 0, 0, 0]
  let missingDir = 0
  const minDirShare: number[] = []
  for (const m of metrics) {
    for (let d = 0; d < 4; d++) dirTotals[d] += m.dirCounts[d]
    if (m.dirCounts.includes(0)) missingDir++
    minDirShare.push(Math.min(...m.dirCounts) / m.arrows)
  }
  const dirSum = dirTotals.reduce((a, b) => a + b, 0) || 1

  const [g50, g95, g99] = quantiles(genMs, [0.5, 0.95, 0.99])
  const [a50, a95] = quantiles(attempts, [0.5, 0.95])
  const [s95] = quantiles(solveMs, [0.95])
  return {
    preset: name,
    params,
    count,
    accepted: count - failed,
    failed,
    failureRate: r3(failed / count),
    invariantViolations: invariant,
    independentVerifyFailures: verifyFail,
    solverDisagreements: solverDisagree,
    determinismChecked: detChecked,
    determinismMismatches: detMismatch,
    attempts: { mean: r2(mean(attempts)), p50: a50, p95: a95, max: Math.max(...attempts) },
    rejectsPerLevel: { fill: r2(rejects.fill / count), free: r2(rejects.free / count), arrows: r2(rejects.arrows / count) },
    genMs: { mean: r3(mean(genMs)), p50: r3(g50), p95: r3(g95), p99: r3(g99), max: r3(Math.max(...genMs)) },
    solveMs: { mean: r3(mean(solveMs)), p95: r3(s95), max: r3(Math.max(...solveMs)) },
    metricsMs: { mean: r3(mean(metricsMs)) },
    metrics: Object.fromEntries(metricKeys.map((k) => [k, summarize(pick(k))])),
    dirShare: Object.fromEntries(DIR_NAMES.map((n, d) => [n, r3(dirTotals[d] / dirSum)])),
    levelsMissingADirection: r3(missingDir / Math.max(1, metrics.length)),
    minDirShare: summarize(minDirShare),
    scoreHistogram: histogram(pick('score'), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    depthHistogram: histogram(pick('depth'), [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 40, 1000]),
  }
}

function cmdBench(opt: Record<string, string>): void {
  const count = Number(opt.count ?? 10000)
  const names = (opt.presets ?? 'tiny,easy,medium,hard,expert').split(',')
  const baseSeed = parseSeed(opt.seed, 1)
  const extra = (opt.extra ?? 'huge:500,xl:100,strict:1000')
    .split(',')
    .filter((s) => s && s !== 'none')
    .map((s) => {
      const [n, c] = s.split(':')
      return { name: n, count: Number(c) }
    })

  const perPreset = Math.floor(count / names.length)
  const plan = names.map((n, i) => ({ name: n, count: perPreset + (i < count - perPreset * names.length ? 1 : 0) }))

  const t0 = performance.now()
  const reports: PresetReport[] = []
  for (const p of plan) {
    process.stderr.write(`bench ${p.name} x${p.count} ... `)
    const r = benchPreset(p.name, p.count, baseSeed)
    process.stderr.write(`${(r.genMs.mean * r.count / 1000).toFixed(1)}s, failure ${(r.failureRate * 100).toFixed(1)}%\n`)
    reports.push(r)
  }
  const mainWall = (performance.now() - t0) / 1000
  const extraReports: PresetReport[] = []
  for (const p of extra) {
    process.stderr.write(`bench (stress) ${p.name} x${p.count} ... `)
    const r = benchPreset(p.name, p.count, baseSeed)
    process.stderr.write(`failure ${(r.failureRate * 100).toFixed(1)}%\n`)
    extraReports.push(r)
  }

  const all = [...reports]
  const total = all.reduce((s, r) => s + r.count, 0)
  const summary = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    baseSeed,
    mainLevels: total,
    mainAccepted: all.reduce((s, r) => s + r.accepted, 0),
    mainFailed: all.reduce((s, r) => s + r.failed, 0),
    mainWallSeconds: r2(mainWall),
    levelsPerSecond: r2(total / mainWall),
    invariantViolations: [...all, ...extraReports].reduce((s, r) => s + r.invariantViolations, 0),
    independentVerifyFailures: [...all, ...extraReports].reduce((s, r) => s + r.independentVerifyFailures, 0),
    solverDisagreements: [...all, ...extraReports].reduce((s, r) => s + r.solverDisagreements, 0),
    determinismMismatches: [...all, ...extraReports].reduce((s, r) => s + r.determinismMismatches, 0),
    presets: reports,
    stress: extraReports,
  }

  const out = opt.out ?? 'bench-results/latest.json'
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(summary, null, 2))

  const row = (r: PresetReport) =>
    `| ${r.preset} | ${r.params.width}x${r.params.height} | ${r.count} | ${(r.failureRate * 100).toFixed(2)}% | ` +
    `${r.attempts.mean} / ${r.attempts.p95} | ${r.genMs.mean} / ${r.genMs.p95} / ${r.genMs.max} | ${r.solveMs.mean} | ` +
    `${r.metrics.arrows.p50} | ${r.metrics.fill.p50} | ${r.metrics.initialFreeRatio.p50} | ${r.metrics.depth.p50} | ` +
    `${r.metrics.score.p10} / ${r.metrics.score.p50} / ${r.metrics.score.p90} |`
  console.log(
    [
      `levels=${total} accepted=${summary.mainAccepted} failed=${summary.mainFailed} wall=${summary.mainWallSeconds}s ` +
        `(${summary.levelsPerSecond}/s incl. verify+solve+metrics)`,
      `invariantViolations=${summary.invariantViolations} verifyFailures=${summary.independentVerifyFailures} ` +
        `solverDisagreements=${summary.solverDisagreements} determinismMismatches=${summary.determinismMismatches}`,
      '',
      '| preset | size | levels | failure | attempts mean/p95 | gen ms mean/p95/max | solve ms | arrows p50 | fill p50 | free0 p50 | depth p50 | score p10/p50/p90 |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...reports.map(row),
      ...extraReports.map((r) => row({ ...r, preset: `${r.preset} (stress)` })),
      '',
      `json: ${out}`,
    ].join('\n'),
  )
}

// ---------------------------------------------------------------------------------------------

const { cmd, pos, opt } = parseArgs(process.argv.slice(2))
try {
  if (cmd === 'gen') cmdGen(opt)
  else if (cmd === 'verify') cmdVerify(pos)
  else if (cmd === 'bench') cmdBench(opt)
  else if (cmd === 'analyze') cmdAnalyze(opt)
  else if (cmd === 'encounter') cmdEncounter(pos, opt)
  else if (cmd === 'shortlist') cmdShortlist(opt)
  else if (cmd === 'prologue') cmdPrologue(opt)
  else if (cmd === 'cp-shortlist') cmdCpShortlist(opt)
  else console.log(HELP)
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
}
