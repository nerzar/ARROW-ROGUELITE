import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  BoardTopology,
  computeMetrics,
  type DifficultyMetrics,
  DIR_NAMES,
  generateLevel,
  type GeneratorParams,
  hashString,
  type Level,
  levelFromJson,
  levelHash,
  levelToJson,
  PRESET_NAMES,
  PRESETS,
  type PresetName,
  replayOrder,
  solveBoard,
  verifyLevel,
} from '../src/index.js'

const HELP = `arrow-core spike CLI

  gen    --preset <name> --seed <n|text> [--json] [--out file]
  verify <level.json>
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
  else console.log(HELP)
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
}
