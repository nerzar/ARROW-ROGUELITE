// VIS-001: playable visual combat shell. Presentation layer only -- every rule (hit/miss, HP,
// attack timers, win/loss, Rotate) is decided by RunState/EncounterState from dist/src (the same
// engine cp-prologue.js/prologue.js/encounter.js already use). This file wires that engine to a
// 16:9 desktop shell: board-renderer.js draws the board/targets, this file owns scene loading,
// input, HUD DOM, and the win/loss overlay. No combat rule is duplicated here.
import {
  encounterFromJson, findWin, formatAction, formatEncounterReport, RunState, validateEncounter,
} from '../../dist/src/index.js'
import { ASSET_MANIFEST, loadAssets, loadBossPack, loadWolfPack } from './assets.js'
import { createBoardRenderer } from './board-renderer.js'
import {
  appearBossVisual, baselinePose, BOSS_POSES, manualBossPose,
  onBossGameplayEvent, readBossSnapshot, tickBossVisual,
} from './boss-visual-state.js'
import {
  appearEnemyVisual, baselinePose as enemyBaseline, ENEMY_POSES, manualEnemyPose,
  onEnemyGameplayEvent, readEnemySnapshot, tickEnemyVisual,
} from './enemy-visual-state.js'

const $ = (id) => document.getElementById(id)
const ui = {
  stage: $('stage'), bgLayer: $('bgLayer'), scenePick: $('scenePick'), sceneTitle: $('sceneTitle'),
  restartBtn: $('restartBtn'), hintBtn: $('hintBtn'), debugToggle: $('debugToggle'), debugPanel: $('debugPanel'),
  msgLine: $('msgLine'), canvas: $('arena'), status: $('status'), log: $('log'), report: $('report'),
  playerCard: $('playerCard'), playerHpFill: $('playerHpFill'), playerHpText: $('playerHpText'),
  rotCw: $('rotCw'), rotCcw: $('rotCcw'), rotateCharges: $('rotateCharges'),
  overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayBody: $('overlayBody'), overlayNext: $('overlayNext'),
}

// Three required scenes (VS-001): cp-e4's two simultaneous regular enemies (EXP-010b), cp-e5's
// mini-boss with an interruptible cast in phase 2 (EXP-011), and rock-spike's ATTACK IN N + THROW
// IN N + PINNED arrow (EXP-013). All three are already-accepted encounter content -- this file
// does not add/alter seeds or numbers.
const SCENES = [
  { key: 'cp-e4', title: 'Пролог · два врага одновременно (seed 10)', file: '../../encounters/cp-e4.json' },
  { key: 'cp-e5', title: 'Mini-boss · CAST/interrupt (seed 1571)', file: '../../encounters/cp-e5.json' },
  { key: 'rock-spike', title: 'Rock-spike · THROW/PIN (seed 15)', file: '../../encounters/rock-spike.json' },
]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

const renderer = createBoardRenderer(ui.canvas)
const assets = await loadAssets(ASSET_MANIFEST)
// VIS-005: per-pose boss pack (missing files -> null -> idle -> placeholder fallback).
const bossPack = await loadBossPack()
const bossPosesLoaded = BOSS_POSES.filter((p) => bossPack[p]).length
// VIS-006: Dire Wolf pack for ordinary enemies (same null-on-missing contract).
const wolfPack = await loadWolfPack()
const wolfPosesLoaded = ENEMY_POSES.filter((p) => wolfPack[p]).length
applyDomAssets(assets)

const runConfig = await fetchJson('../../encounters/cp-run-config.json').catch(() => ({ playerMaxHp: 10 }))

let run = null
let level = null
let def = null
let board = null
let hint = null
let overlayTimer = 0
let targetsBefore = []
// VIS-005: presentation-only boss pose state. Null in enemies-mode scenes (no boss to pose).
// Gameplay stays source of truth -- this is driven by engine events, never the reverse.
let bossVisual = null
const bossSnap = () => (run && def ? readBossSnapshot(run.encounter, def) : null)
// VIS-006: presentation-only per-ACTOR ordinary-enemy pose state (Map enemyId -> visual).
// Null in boss-mode scenes. Each actor ticks on its own snapshot, so a hit on one wolf never
// switches the other.
let wolfVisuals = null

/** Expire timed holds and re-sync baselines (e.g. a newly armed attackReady telegraph).
 * Presentation only; never touches engine state. */
function tickAndSyncWolves(now) {
  if (!wolfVisuals || !run) return
  for (const e of run.encounter.enemies ?? []) {
    const snap = readEnemySnapshot(e)
    let v = wolfVisuals.get(e.id)
    if (!v) {
      wolfVisuals.set(e.id, appearEnemyVisual(now))
      continue
    }
    if (e.dead) {
      wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'defeated', now, snap))
      continue
    }
    v = tickEnemyVisual(v, now, snap)
    if (!v.manual && now >= v.holdUntil && v.pose !== enemyBaseline(snap)) {
      v = onEnemyGameplayEvent(v, 'sync', now, snap)
    }
    wolfVisuals.set(e.id, v)
  }
}
// PLAYTEST-FIX-001: tallest status stack (in text lines) among TOP (N-side) targets, so the
// renderer can reserve canvas headroom above the top panel instead of overlapping the board.
// Boss phases can move the boss to N mid-encounter, so this is the max over all phases, computed
// once per scene (a phase change never re-reserves: the superset already covers it).
let topReserve = null

function topStatusReserve(d) {
  if (d.enemies) {
    let lines = 0
    for (const e of d.enemies) {
      if (e.side !== 0) continue
      lines = Math.max(lines, 2 + (e.attackTimer ? 1 : 0) + (e.ability ? 1 : 0))
    }
    return lines > 0 ? { lines, boss: false } : null
  }
  const phases = d.boss.phases.filter((p) => p.side === 0)
  if (!phases.length) return null
  return { lines: Math.max(...phases.map((p) => 2 + (p.attackTimer ? 1 : 0))), boss: true }
}

async function loadScene(key) {
  hideOverlay()
  ui.stage.classList.remove('hit-flash')
  const scene = SCENES.find((s) => s.key === key) ?? SCENES[0]
  ui.sceneTitle.textContent = scene.title
  const raw = await fetchJson(scene.file)
  const parsed = encounterFromJson(raw)
  level = parsed.level
  def = parsed.file.encounter
  board = parsed.file.board
  run = new RunState(runConfig, [{ id: scene.key, title: scene.title, level, def }])
  topReserve = topStatusReserve(def)
  renderer.resize(level, topReserve)
  renderer.resetFx()
  hint = null
  // VIS-005: encounter appearance -- brief taunt, then the baseline (never a permanent taunt).
  bossVisual = def.boss ? appearBossVisual(performance.now()) : null
  // VIS-006: ordinary enemies appear straight in idle, one independent visual per actor.
  wolfVisuals = null
  if (def.enemies) {
    wolfVisuals = new Map()
    for (const e of run.encounter.enemies) wolfVisuals.set(e.id, appearEnemyVisual(performance.now()))
  }
  buildBossPoseButtons()
  buildWolfPoseButtons()
  targetsBefore = renderer.collectTargets(run.encounter, def)
  const hasAbility = def.enemies?.some((e) => e.ability)
  ui.msgLine.textContent = def.enemies
    ? `Враги одновременно: ${run.encounter.enemies.map((e) => e.label ?? e.id).join(', ')}.` +
      (hasAbility ? ' Следи за THROW IN N — брошенный камень временно PINNED одну стрелку.' : '')
    : `Цель: ${def.boss.id}.`
  const rep = validateEncounter(level, def, { playerHp: run.hpAtEntry })
  ui.report.textContent = formatEncounterReport(rep)
  renderPanel()
  kick()
}

function applyDomAssets(store) {
  if (store.background) {
    ui.bgLayer.style.setProperty('--bg-image', `url(${store.background.src})`)
    ui.bgLayer.classList.add('has-image')
  }
  if (store.boardFrame) {
    $('boardFrame').style.backgroundImage = `url(${store.boardFrame.src})`
    $('boardFrame').style.backgroundSize = 'contain'
    $('boardFrame').style.backgroundPosition = 'center'
    $('boardFrame').style.backgroundRepeat = 'no-repeat'
  }
  if (store.playerPortrait) {
    ui.playerCard.style.backgroundImage = `url(${store.playerPortrait.src})`
    ui.playerCard.style.backgroundSize = 'cover'
    ui.playerCard.style.backgroundPosition = 'center top'
    ui.playerCard.classList.add('has-portrait') // CSS applies the blend mode
  }
}

// ---------------------------------------------------------------------------------------------
// Actions -- thin wrappers: call into EncounterState/RunState, then tell the renderer what to play.

function tap(id) {
  const s = run.encounter
  if (s.over || overlayTimer) return
  const before = renderer.collectTargets(s, def)
  const phaseBefore = bossVisual ? s.phaseIndex : -1
  const r = s.tap(id)
  hint = null
  if (!r.ok) {
    if (r.reason === 'blocked') {
      renderer.setFlash({ blocked: id, blocker: r.blocker })
      let text = `Стрелка #${id} заблокирована стрелкой #${r.blocker}.`
      if (r.damage > 0) {
        text += ` -${r.damage} HP (${r.playerHp}).`
        flashPlayerHit()
        pushLog(`blocked #${id}  -${r.damage} hp  player ${r.playerHp}`)
      }
      setMsg(text, r.playerDead)
      if (r.playerDead) scheduleGameOver()
    } else if (r.reason === 'pinned') {
      // EXP-013: rock-pinned arrow. Deliberately NOT the same feedback as a blocked tap -- no HP
      // cost, no turn spent, and the message must say so explicitly or it reads as a bug.
      renderer.onPinDenied(id)
      setMsg(`Стрелка #${id} PINNED — камень держит её ещё ${r.pinTurnsLeft} ход(а). HP не тратится, ход не идёт.`, false)
      pushLog(`tap #${id}  !! pinned (${r.pinTurnsLeft} turn(s) left)`)
    }
    renderPanel()
    kick()
    return
  }
  renderer.setFlash({ blocked: -1, blocker: -1 })
  renderer.onTapResult(level, id, r, before)
  const after = renderer.collectTargets(s, def)
  renderer.markDeaths(before, after)
  targetsBefore = after
  // VIS-006: gameplay -> per-actor presentation. Priority per actor: defeated > attack
  // (its own strike is the latest visible beat) > hit > baseline sync. Untouched actors only
  // re-sync an expired hold onto the live baseline (e.g. a newly armed attackReady telegraph).
  if (wolfVisuals) {
    const now = performance.now()
    const attacked = new Set((r.enemyAttacks ?? []).map((a) => a.id))
    for (const e of s.enemies) {
      const snap = readEnemySnapshot(e)
      const v = wolfVisuals.get(e.id)
      if (!v) continue
      if (e.dead) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'defeated', now, snap))
      else if (attacked.has(e.id)) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'attack', now, snap))
      else if (r.hit && e.side === r.arenaDir) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'hit', now, snap))
    }
    tickAndSyncWolves(now)
  }
  // VIS-005: gameplay -> presentation. Priority: won > phase change > interrupt > hit.
  // A miss with no interrupt only re-syncs an expired hold onto a newly armed cast baseline.
  if (bossVisual) {
    const now = performance.now()
    const snap = bossSnap()
    if (r.won) bossVisual = onBossGameplayEvent(bossVisual, 'won', now, snap)
    else if (s.phaseIndex !== phaseBefore) bossVisual = onBossGameplayEvent(bossVisual, 'phase', now, snap)
    else if (r.castInterrupted) bossVisual = onBossGameplayEvent(bossVisual, 'interrupted', now, snap)
    else if (r.hit) bossVisual = onBossGameplayEvent(bossVisual, 'hit', now, snap)
    else if (!bossVisual.manual && now >= bossVisual.holdUntil && bossVisual.pose !== baselinePose(snap)) {
      bossVisual = onBossGameplayEvent(bossVisual, 'castStart', now, snap)
    }
  }

  let text = `#${id} ${r.hit ? 'попадание' : 'мимо'} · HP целей ${s.hp}/${s.totalHp}`
  if (r.enemyAttacked) {
    text += ` · ВРАГ АТАКУЕТ (HP игрока ${r.playerHp})`
    flashPlayerHit()
  }
  // EXP-011: only a genuine cast interrupt gets the literal "CAST INTERRUPTED" callout -- the
  // legacy EXP-010 interruptOnHit reset (r.interrupted without r.castInterrupted) isn't a cast and
  // isn't used by any current content, but keep a generic fallback in case it ever is.
  if (r.castInterrupted) text += ' · CAST INTERRUPTED'
  else if (r.interrupted) text += ' · подготовка сбита'
  // EXP-013: Stone Throw pin/unpin this turn, enemies mode only.
  if (r.pinnedThisTurn && r.pinnedThisTurn.length) text += ` · ROCK THROWN: #${r.pinnedThisTurn.map((p) => p.id).join(', #')} pinned ${r.pinnedThisTurn[0].turnsLeft}t`
  if (r.pinExpired && r.pinExpired.length) text += ` · UNPINNED: #${r.pinExpired.join(', #')}`
  if (r.won) text = `Цель выполнена. ${text}`
  else if (r.playerDead) text = `Поражение: HP закончилось. ${text}`
  setMsg(text, r.playerDead)
  pushLog(
    `${formatAction({ kind: 'tap', id })}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` +
      (r.enemyAttacked ? `  ENEMY (player ${r.playerHp})` : '') +
      (r.castInterrupted ? '  CAST INTERRUPTED' : '') +
      (r.pinnedThisTurn && r.pinnedThisTurn.length ? `  ROCK THROWN: #${r.pinnedThisTurn.map((p) => `${p.id}(${p.turnsLeft}t)`).join(', #')}` : '') +
      (r.pinExpired && r.pinExpired.length ? `  UNPINNED: #${r.pinExpired.join(', #')}` : ''),
  )
  renderPanel()
  kick()
  if (r.won) scheduleWin()
  else if (r.playerDead) scheduleGameOver()
}

function rotate(turn) {
  const s = run.encounter
  if (overlayTimer || !s.canRotate(turn)) return
  const from = s.rotation * 90
  const hpBefore = s.playerHp
  const before = renderer.collectTargets(s, def)
  s.rotate(turn)
  hint = null
  renderer.onRotateStart(from, from + turn * 90)
  let text = `Доска повернута ${turn === 1 ? 'по часовой' : 'против часовой'}.`
  if (s.playerHp !== hpBefore) {
    text += ` ВРАГ АТАКУЕТ: -${hpBefore - s.playerHp} HP (${s.playerHp})`
    flashPlayerHit()
    renderer.onRotateEnemyAttack()
  }
  renderer.markDeaths(before, renderer.collectTargets(s, def))
  // VIS-006: a rotate can tick enemy timers (telegraphs may arm); re-sync baselines only.
  tickAndSyncWolves(performance.now())
  setMsg(text, false)
  pushLog(`${formatAction({ kind: 'rotate', turn })}  → ${s.rotation * 90}°`)
  renderPanel()
  kick()
  if (s.playerDead) scheduleGameOver()
}

function showHint() {
  const s = run.encounter
  if (s.over || overlayTimer) return
  const r = findWin(s, { nodeBudget: 500_000 })
  if (!r.win) {
    setMsg(r.proven ? 'Победа из этого состояния уже невозможна.' : 'Не удалось найти подсказку в пределах бюджета.', true)
    return
  }
  hint = r.sequence[0]
  setMsg(`Подсказка: ${hint.kind === 'tap' ? `стрелка #${hint.id}` : `Rotate ${hint.turn === 1 ? 'cw' : 'ccw'}`}.`, false)
  kick()
}

function flashPlayerHit() {
  ui.stage.classList.remove('hit-flash')
  void ui.stage.offsetWidth // restart the CSS animation
  ui.stage.classList.add('hit-flash')
  setTimeout(() => ui.stage.classList.remove('hit-flash'), 260) // animation has no fill-mode: forwards, so it must be removed explicitly or it freezes at opacity 1
  ui.playerCard.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 })
}

function setMsg(text, bad) {
  ui.msgLine.textContent = text
  ui.msgLine.classList.toggle('bad', !!bad)
}

let log = []
function pushLog(line) {
  log.push(line)
  ui.log.textContent = log.map((l, i) => `${String(i + 1).padStart(2)}. ${l}`).join('\n')
}

// ---------------------------------------------------------------------------------------------
// Transitions

function scheduleWin() {
  overlayTimer = setTimeout(() => showOverlay('won'), 700)
}
function scheduleGameOver() {
  overlayTimer = setTimeout(() => showOverlay('dead'), 700)
}
function showOverlay(kind) {
  overlayTimer = 0
  ui.overlay.classList.add('show')
  if (kind === 'dead') {
    ui.overlayTitle.textContent = 'Поражение'
    ui.overlayBody.textContent = 'HP игрока закончилось.'
  } else {
    ui.overlayTitle.textContent = 'Цель выполнена'
    ui.overlayBody.textContent = `HP на финише: ${run.encounter.playerHp}/${run.maxHp}.`
  }
  ui.overlayNext.textContent = 'restart'
  ui.overlayNext.onclick = () => { hideOverlay(); loadScene(ui.scenePick.value) }
}
function hideOverlay() {
  if (overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = 0
  ui.overlay.classList.remove('show')
}

// ---------------------------------------------------------------------------------------------
// Render loop

let raf = 0
function kick() {
  if (!raf) raf = requestAnimationFrame(frame)
}
function frame(now) {
  raf = 0
  if (!run) return
  // VIS-005: expire timed holds (taunt/stunned) back to the live baseline. Presentation only.
  if (bossVisual) bossVisual = tickBossVisual(bossVisual, now, bossSnap())
  // VIS-006: same for per-actor wolf holds; feeds the renderer below.
  tickAndSyncWolves(now)
  const animating = renderer.frame(now, {
    s: run.encounter, def, level, assets, hint,
    boss: bossVisual ? { pack: bossPack, visual: bossVisual } : null,
    wolf: wolfVisuals ? { pack: wolfPack, visuals: wolfVisuals } : null,
  })
  if (animating) kick()
}

function renderPanel() {
  const s = run.encounter
  const max = run.maxHp
  const hp = s.playerHp
  ui.playerHpFill.style.width = `${Math.max(0, (hp / max) * 100)}%`
  ui.playerHpFill.classList.toggle('low', hp / max <= 0.3)
  ui.playerHpText.textContent = `${hp}/${max}`
  ui.rotCw.disabled = !s.canRotate(1) || def.rotate.allow.length === 0
  ui.rotCcw.disabled = !s.canRotate(-1) || def.rotate.allow.length === 0
  ui.rotCw.style.visibility = def.rotate.allow.includes(1) ? 'visible' : 'hidden'
  ui.rotCcw.style.visibility = def.rotate.allow.includes(-1) ? 'visible' : 'hidden'
  ui.rotateCharges.textContent = def.rotate.allow.length === 0 ? '' : s.rotateCharges > 0 ? `Rotate ×${s.rotateCharges}` : s.rotatesUsed ? 'Rotate использован' : 'Rotate не получен'
  const statusLines = [
    `${def.title ?? def.id}`,
    `board ${board.preset} seed ${board.seed} (${level.width}x${level.height}, ${level.arrows.length} стрел)`,
    `состояние: ${s.playerDead ? 'ПОРАЖЕНИЕ' : s.won ? 'ЦЕЛЬ ВЫПОЛНЕНА' : 'бой'}`,
    `HP целей: ${s.hp}/${s.totalHp}`,
  ]
  // EXP-013: pin turns remaining, simple debug-panel badge per the VS-001 brief (the premium
  // per-arrow rock marker on the board is the primary, always-visible cue -- this is the backup).
  if (def.enemies?.some((e) => e.ability)) {
    const pinned = s.pinnedArrows
    statusLines.push(`pinned arrows: ${pinned.length ? pinned.map((p) => `#${p.id} (${p.turnsLeft}t)`).join(', ') : '—'}`)
  }
  // VIS-005: boss presentation state (debug-panel only -- gameplay state is the engine's).
  if (def.boss) {
    statusLines.push(`boss art: ${bossPosesLoaded}/${BOSS_POSES.length} poses loaded`)
    if (bossVisual) statusLines.push(`boss pose: ${bossVisual.pose}${bossVisual.manual ? ' (manual)' : ''}`)
  }
  // VIS-006: per-actor wolf presentation state (same debug-panel-only contract).
  if (def.enemies && wolfVisuals) {
    statusLines.push(`wolf art: ${wolfPosesLoaded}/${ENEMY_POSES.length} poses loaded`)
    for (const [id, w] of wolfVisuals) statusLines.push(`wolf ${id}: ${w.pose}${w.manual ? ' (manual)' : ''}`)
  }
  ui.status.textContent = statusLines.join('\n')
}

// VIS-005: prototype-only visual-state control. Debug-only: real gameplay events still drive
// the pose automatically (any tap event clears a manual override).
function buildBossPoseButtons() {
  const row = $('bossPoseRow')
  if (!row) return
  row.replaceChildren()
  if (!bossVisual) {
    row.textContent = '— (no boss in this scene)'
    return
  }
  for (const pose of BOSS_POSES) {
    const b = document.createElement('button')
    b.textContent = pose
    b.title = `debug: force boss pose ${pose}`
    b.disabled = !bossPack[pose]
    b.onclick = () => {
      bossVisual = manualBossPose(bossVisual, pose, performance.now())
      renderPanel()
      kick()
    }
    row.append(b)
  }
}

// VIS-006: prototype-only per-actor visual-state control. One button group per enemy id;
// a manual pose sticks until the next gameplay event for that actor (same contract as boss).
function buildWolfPoseButtons() {
  const row = $('wolfPoseRow')
  if (!row) return
  row.replaceChildren()
  if (!wolfVisuals) {
    row.textContent = '— (no ordinary enemies in this scene)'
    return
  }
  for (const [id] of wolfVisuals) {
    const label = document.createElement('span')
    label.textContent = `${id}:`
    label.className = 'muted'
    row.append(label)
    for (const pose of ENEMY_POSES) {
      const b = document.createElement('button')
      b.textContent = pose
      b.title = `debug: force wolf ${id} pose ${pose}`
      b.disabled = !wolfPack[pose]
      b.onclick = () => {
        wolfVisuals.set(id, manualEnemyPose(wolfVisuals.get(id), pose, performance.now()))
        renderPanel()
        kick()
      }
      row.append(b)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Input

function arrowAt(ev) {
  return renderer.hitTest(ev.clientX, ev.clientY, run.encounter, level)
}
ui.canvas.addEventListener('pointermove', (ev) => {
  renderer.setHover(arrowAt(ev))
  kick()
})
ui.canvas.addEventListener('pointerleave', () => {
  renderer.setHover(-1)
  kick()
})
ui.canvas.addEventListener('click', (ev) => {
  const id = arrowAt(ev)
  if (id !== -1) tap(id)
})
ui.rotCw.onclick = () => rotate(1)
ui.rotCcw.onclick = () => rotate(-1)
ui.restartBtn.onclick = () => loadScene(ui.scenePick.value)
ui.hintBtn.onclick = showHint
ui.debugToggle.onclick = () => ui.debugPanel.classList.toggle('hidden')
ui.scenePick.onchange = () => loadScene(ui.scenePick.value)
window.addEventListener('resize', () => { if (level) { renderer.resize(level, topReserve); kick() } })
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === 'q') rotate(-1)
  else if (k === 'e') rotate(1)
  else if (k === 'r') loadScene(ui.scenePick.value)
  else if (k === 'h') showHint()
  else if (k === 'd') ui.debugPanel.classList.toggle('hidden')
  else return
  ev.preventDefault()
})

for (const scene of SCENES) ui.scenePick.append(new Option(scene.title, scene.key))
const initialKey = new URLSearchParams(location.hash.slice(1)).get('scene') ?? SCENES[0].key
ui.scenePick.value = initialKey
await loadScene(initialKey)

// Debug hook for automated checks, same convention as encounterDebug/prologueDebug/cpDebug.
window.visualDebug = {
  run: () => run,
  state: () => run.encounter,
  tap,
  rotate,
  loadScene,
  boss: () => bossVisual, // VIS-005: current presentation pose state (null in enemies mode)
  setBossPose: (pose) => { // VIS-005: manual debug override, same as the debug-panel buttons
    if (bossVisual) {
      bossVisual = manualBossPose(bossVisual, pose, performance.now())
      renderPanel()
      kick()
    }
    return bossVisual
  },
  wolf: () => wolfVisuals ? Object.fromEntries([...wolfVisuals].map(([id, w]) => [id, w.pose])) : null, // VIS-006: per-actor poses (null in boss mode)
  setWolfPose: (id, pose) => { // VIS-006: manual debug override per actor
    if (wolfVisuals?.has(id)) {
      wolfVisuals.set(id, manualEnemyPose(wolfVisuals.get(id), pose, performance.now()))
      renderPanel()
      kick()
    }
    return wolfVisuals?.get(id) ?? null
  },
}
