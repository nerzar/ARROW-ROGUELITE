// LD-007 design audit (provisional design tooling, not production code).
//
// For every stage of a campaign JSON, regenerate the board exactly the way the playable viewer
// does (viewer/visual-proto/campaign-model.js: PRESETS.medium + square size override, or the
// LD-007 `board.profile` override, see boardProfiles.mjs), then report the things a level
// designer cares about that the bare validator does not:
//   - ammo per side vs enemy HP per side (structural killability at 0 Rotate);
//   - min-damage line at 0 / 1 / 2 shared Rotate charges, and which enemies that line kills;
//   - decision density: turns with a real choice, forced tail after the last hit, wasted taps.
//
// usage: node tools/ld007-audit.mjs [campaigns/campaign.json] [--only act1] [--hp 10] [--budget N]

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const here = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const core = await import(pathToFileURL(resolve(here, '../dist/src/index.js')).href)
const { generateLevel, BoardTopology, EncounterState, minDamageToWin, DIR_NAMES, analyzeSeed } = core
const { boardParamsFor } = await import(pathToFileURL(resolve(here, '../viewer/visual-proto/board-profiles.js')).href)
const { ascii } = await import(pathToFileURL(resolve(here, './ld007-lib.mjs')).href)

const args = process.argv.slice(2)
const opt = {}
const pos = []
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] ?? 'true', i++
  else pos.push(args[i])
}
const file = pos[0] ?? resolve(here, '../campaigns/campaign.json')
const only = opt.only ?? ''
const playerHp = Number(opt.hp ?? 10)
const budget = Number(opt.budget ?? 3_000_000)
const campaign = JSON.parse(readFileSync(file, 'utf8'))

const SIDE = { N: 0, E: 1, S: 2, W: 3, top: 0, right: 1, left: 3 }

function normalizeDef(enc) {
  const def = JSON.parse(JSON.stringify(enc))
  if (def.enemies) def.enemies = def.enemies.map((e) => ({ ...e, side: typeof e.side === 'string' ? SIDE[e.side] : e.side }))
  if (def.boss) def.boss.phases = def.boss.phases.map((p) => ({ ...p, side: typeof p.side === 'string' ? SIDE[p.side] : p.side }))
  if (def.enemies && def.enemies.length === 0) delete def.enemies
  if (def.boss) delete def.enemies
  if (def.rotate?.allow) def.rotate.allow = def.rotate.allow.map((t) => (t === 'cw' ? 1 : t === 'ccw' ? -1 : t))
  return def
}

/** Replay a line and collect designer metrics. */
function lineMetrics(level, def, actions, hp, pool) {
  const s = new EncounterState(BoardTopology.fromLevel(level), def, hp, pool ? { charges: pool } : null)
  let taps = 0, hits = 0, misses = 0, forced = 0, choice = 0, lastHitTurn = 0, turn = 0
  const kills = []
  const enemyHp = () => (def.enemies ? s.enemies.map((e) => e.hp) : [s.hp])
  let prev = enemyHp()
  const dmgEvents = []
  for (const a of actions) {
    if (a.kind === 'tap') {
      const playable = s.playableArrows().length
      if (playable <= 1) forced++
      else choice++
      const r = s.tap(a.id)
      taps++
      turn++
      if (r.hit && r.hitDamage > 0) { hits++; lastHitTurn = turn } else misses++
      if (r.enemyAttacked) dmgEvents.push({ turn, dmg: r.enemyDamage })
      const cur = enemyHp()
      cur.forEach((v, i) => { if (v <= 0 && prev[i] > 0) kills.push({ turn, who: def.enemies ? def.enemies[i].id : 'boss' }) })
      prev = cur
    } else {
      s.rotate(a.turn)
    }
  }
  return { taps, hits, misses, forced, choice, lastHitTurn, tail: taps - lastHitTurn, kills, dmgEvents, won: s.won, playerHp: s.playerHp }
}

function audit(stage) {
  const size = stage.board.size ?? 5
  const seed = Number(stage.board.seed ?? 1)
  const params = boardParamsFor(stage.board)
  const gen = generateLevel(params, seed)
  if (!gen.ok) return console.log(`### ${stage.id}: GEN FAIL\n`)
  const level = gen.level
  const def = normalizeDef(stage.encounter)
  const an = analyzeSeed(level)
  const lens = level.arrows.map((a) => a.cells.length)
  const avg = (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(2)

  console.log(`### ${stage.id} — ${stage.title}`)
  console.log(`board ${size}x${size} seed ${seed} profile=${stage.board.profile ?? 'long(default)'}  arrows ${level.arrows.length}  avgLen ${avg}  maxLen ${Math.max(...lens)}`)
  console.log(ascii(level))
  console.log(`dirs N${an.dirCounts[0]} E${an.dirCounts[1]} S${an.dirCounts[2]} W${an.dirCounts[3]}  initialFree N${an.initialFree[0]} E${an.initialFree[1]} S${an.initialFree[2]} W${an.initialFree[3]}  branchPoints ${an.branchPoints.length}/${an.arrows}  dirBranch ${an.dirBranchPoints.length}`)
  const targets = def.enemies ? def.enemies.map((e) => ({ id: e.id, side: e.side, hp: e.hp, timer: e.attackTimer, ability: e.ability })) : def.boss.phases.map((p, i) => ({ id: `phase${i + 1}`, side: p.side, hp: p.hpUnits, timer: p.attackTimer }))
  for (const t of targets) {
    const ammo = an.dirCounts[t.side]
    const flag = ammo >= t.hp ? 'ok' : `UNKILLABLE@0R (ammo ${ammo} < hp ${t.hp})`
    const tm = t.timer ? `${t.timer.kind === 'cast' ? 'CAST' : 'ATK'} IN ${t.timer.interval} dmg ${t.timer.damage}` : 'passive'
    console.log(`  ${t.id.padEnd(14)} side ${DIR_NAMES[t.side]}  hp ${t.hp}  ${tm.padEnd(18)} ammo ${ammo}  ${flag}${t.ability ? `  ability ${t.ability.kind ?? 'stone_throw'}/${t.ability.interval}` : ''}`)
  }
  const wasted = an.dirCounts.reduce((s, c, d) => s + (targets.some((t) => t.side === d) ? 0 : c), 0)
  console.log(`  arrows pointing at NO target: ${wasted}/${an.arrows}`)

  for (const pool of [0, 1, 2]) {
    const usePool = !!def.rotate.useRunPool
    if (pool > 0 && !usePool) { console.log(`  Rotate ${pool}: (encounter has no run pool)`); break }
    const start = new EncounterState(BoardTopology.fromLevel(level), def, playerHp, usePool ? { charges: pool } : null)
    const r = minDamageToWin(start, { nodeBudget: budget, maxRotates: pool })
    if (!r.win) { console.log(`  Rotate<=${pool}: NO WIN (proven ${r.proven})`); continue }
    const m = lineMetrics(level, def, r.sequence, playerHp, usePool ? pool : 0)
    const rot = r.sequence.filter((a) => a.kind === 'rotate').length
    console.log(`  Rotate<=${pool}: minDmg ${r.minDamage}${r.proven ? '' : ' (unproven)'}  used ${rot}R  taps ${m.taps} hits ${m.hits} miss ${m.misses}  choiceTurns ${m.choice} forcedTurns ${m.forced}  lastHit t${m.lastHitTurn} tail ${m.tail}  kills [${m.kills.map((k) => `${k.who}@t${k.turn}`).join(', ')}]  enemyAttacks [${m.dmgEvents.map((d) => `t${d.turn}:-${d.dmg}`).join(' ')}]`)
    if (pool === 0) console.log(`     line: ${r.sequence.map((a) => (a.kind === 'tap' ? `#${a.id}${DIR_NAMES[level.arrows[a.id].dir]}` : `R${a.turn > 0 ? 'cw' : 'ccw'}`)).join(' ')}`)
  }
  console.log()
}

for (const st of campaign.levels) {
  if (only && !st.id.includes(only)) continue
  audit(st)
}
