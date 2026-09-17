// VIS-001: playable visual combat shell. Presentation layer only -- every rule (hit/miss, HP,
// attack timers, win/loss, Rotate) is decided by RunState/EncounterState from dist/src (the same
// engine cp-prologue.js/prologue.js/encounter.js already use). This file wires that engine to a
// 16:9 desktop shell: board-renderer.js draws the board/targets, this file owns scene loading,
// input, HUD DOM, and the win/loss overlay. No combat rule is duplicated here.
import {
  encounterFromJson, findWin, formatAction, formatEncounterReport, RunState, validateEncounter,
} from '../../dist/src/index.js'
import { ASSET_MANIFEST, loadAssets } from './assets.js'
import { createBoardRenderer } from './board-renderer.js'

const $ = (id) => document.getElementById(id)
const ui = {
  stage: $('stage'), bgLayer: $('bgLayer'), scenePick: $('scenePick'), sceneTitle: $('sceneTitle'),
  restartBtn: $('restartBtn'), hintBtn: $('hintBtn'), debugToggle: $('debugToggle'), debugPanel: $('debugPanel'),
  msgLine: $('msgLine'), canvas: $('arena'), status: $('status'), log: $('log'), report: $('report'),
  playerCard: $('playerCard'), playerHpFill: $('playerHpFill'), playerHpText: $('playerHpText'),
  rotCw: $('rotCw'), rotCcw: $('rotCcw'), rotateCharges: $('rotateCharges'),
  overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayBody: $('overlayBody'), overlayNext: $('overlayNext'),
}

// Two required scenes (VIS-001): the seed-10 multi-enemy prologue encounter and the seed-1571
// mini-boss, both already accepted content from EXP-010b -- this file does not add/alter seeds.
const SCENES = [
  { key: 'cp-e4', title: 'Пролог · два врага одновременно (seed 10)', file: '../../encounters/cp-e4.json' },
  { key: 'cp-e5', title: 'Mini-boss (seed 1571)', file: '../../encounters/cp-e5.json' },
]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

const renderer = createBoardRenderer(ui.canvas)
const assets = await loadAssets(ASSET_MANIFEST)
applyDomAssets(assets)

const runConfig = await fetchJson('../../encounters/cp-run-config.json').catch(() => ({ playerMaxHp: 10 }))

let run = null
let level = null
let def = null
let board = null
let hint = null
let overlayTimer = 0
let targetsBefore = []

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
  renderer.resize(level)
  renderer.resetFx()
  hint = null
  targetsBefore = renderer.collectTargets(run.encounter, def)
  ui.msgLine.textContent = def.enemies
    ? `Враги одновременно: ${run.encounter.enemies.map((e) => e.label ?? e.id).join(', ')}.`
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
}

// ---------------------------------------------------------------------------------------------
// Actions -- thin wrappers: call into EncounterState/RunState, then tell the renderer what to play.

function tap(id) {
  const s = run.encounter
  if (s.over || overlayTimer) return
  const before = renderer.collectTargets(s, def)
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

  let text = `#${id} ${r.hit ? 'попадание' : 'мимо'} · HP целей ${s.hp}/${s.totalHp}`
  if (r.enemyAttacked) {
    text += ` · ВРАГ АТАКУЕТ (HP игрока ${r.playerHp})`
    flashPlayerHit()
  }
  if (r.interrupted) text += ' · подготовка сбита'
  if (r.won) text = `Цель выполнена. ${text}`
  else if (r.playerDead) text = `Поражение: HP закончилось. ${text}`
  setMsg(text, r.playerDead)
  pushLog(`${formatAction({ kind: 'tap', id })}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` + (r.enemyAttacked ? `  ENEMY (player ${r.playerHp})` : ''))
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
  const animating = renderer.frame(now, { s: run.encounter, def, level, assets, hint })
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
  ui.status.textContent = [
    `${def.title ?? def.id}`,
    `board ${board.preset} seed ${board.seed} (${level.width}x${level.height}, ${level.arrows.length} стрел)`,
    `состояние: ${s.playerDead ? 'ПОРАЖЕНИЕ' : s.won ? 'ЦЕЛЬ ВЫПОЛНЕНА' : 'бой'}`,
    `HP целей: ${s.hp}/${s.totalHp}`,
  ].join('\n')
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
window.addEventListener('resize', () => { if (level) { renderer.resize(level); kick() } })
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
  loadScene,
}
