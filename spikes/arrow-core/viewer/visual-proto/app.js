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

// ACT-I-001 prototype sequence: Prologue complete (reward +2 Rotate) -> Act I #1 -> Act I #2 -> Act I #3.
// HP and shared Rotate pool persist across all sequence encounters.
const SEQUENCE_STEPS = [
  { key: 'cp-e5', title: 'Пролог · Mini-boss (seed 1571)', file: '../../encounters/cp-e5.json' },
  { key: 'act1-e1', title: 'Act I #1 · Двуручный рубеж (seed 22)', file: '../../encounters/act1-e1.json' },
  { key: 'act1-e2', title: 'Act I #2 · Взаимный замок (seed 112)', file: '../../encounters/act1-e2.json' },
  { key: 'act1-e3', title: 'Act I #3 · Кастер и свита (seed 25)', file: '../../encounters/act1-e3.json' },
]

const STANDALONE_SCENES = [
  { key: 'cp-e4', title: 'Debug · два врага одновременно (seed 10)', file: '../../encounters/cp-e4.json' },
  { key: 'rock-spike', title: 'Debug · Rock-spike THROW/PIN (seed 15)', file: '../../encounters/rock-spike.json' },
]

const ALL_SCENES = [...SEQUENCE_STEPS, ...STANDALONE_SCENES]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

const stepCache = new Map()
async function getStep(scene) {
  if (stepCache.has(scene.key)) return stepCache.get(scene.key)
  const raw = await fetchJson(scene.file)
  const parsed = encounterFromJson(raw)
  const step = {
    id: scene.key,
    title: scene.title,
    level: parsed.level,
    def: parsed.file.encounter,
    board: parsed.file.board,
  }
  stepCache.set(scene.key, step)
  return step
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
// VIS-007: per-side arena slot reserve (N = top, S = bottom) so the renderer can fit
// the character + HUD stack between the slot and the canvas edge. Boss phases can move
// the boss between sides mid-encounter, so this is the max over all phases per side,
// computed once per scene (a phase change never re-reserves: the superset covers it).
// E/W slots never need a margin reserve (their HUD stacks vertically, mid-canvas).
let slotReserve = null

function slotStatusReserve(d) {
  const pick = (dir) => {
    if (d.enemies) {
      const es = d.enemies.filter((e) => e.side === dir)
      if (!es.length) return null
      return {
        lines: Math.max(...es.map((e) => 2 + (e.attackTimer ? 1 : 0) + (e.ability ? 1 : 0))),
        big: false,
      }
    }
    const phases = d.boss.phases.filter((p) => p.side === dir)
    if (!phases.length) return null
    return { lines: Math.max(...phases.map((p) => 2 + (p.attackTimer ? 1 : 0))), big: true }
  }
  const top = pick(0)
  const bottom = pick(2)
  return top || bottom ? { top, bottom } : null
}

async function loadScene(key) {
  hideOverlay()
  ui.stage.classList.remove('hit-flash')
  const seqIdx = SEQUENCE_STEPS.findIndex((s) => s.key === key)
  if (seqIdx >= 0) {
    const steps = await Promise.all(SEQUENCE_STEPS.map(getStep))
    if (seqIdx === 0) {
      run = new RunState({ ...runConfig, initialRotateCharges: 0 }, steps)
    } else {
      run = new RunState({ ...runConfig, initialRotateCharges: 2 }, steps)
      run.debugJumpTo(seqIdx, 2)
    }
  } else {
    const standalone = STANDALONE_SCENES.find((s) => s.key === key) ?? STANDALONE_SCENES[0]
    const step = await getStep(standalone)
    run = new RunState(runConfig, [step])
  }
  loadActiveStep()
}

function loadActiveStep() {
  hideOverlay()
  ui.stage.classList.remove('hit-flash')
  const step = run.currentStep
  level = step.level
  def = step.def
  board = step.board ?? { preset: 'unknown', seed: 0 }
  ui.scenePick.value = step.id
  ui.sceneTitle.textContent = step.title ?? step.id
  slotReserve = slotStatusReserve(def)
  renderer.resize(level, slotReserve)
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
    : `Цель: ${def.boss?.id ?? 'boss'}.`
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
    ui.overlayNext.textContent = 'Заново'
    ui.overlayNext.onclick = () => {
      hideOverlay()
      run.restartStep()
      loadActiveStep()
    }
  } else {
    const isSeq = run.steps.length > 1
    const isLast = !isSeq || run.isLastStep
    ui.overlayTitle.textContent = isLast ? 'Победа!' : 'Цель выполнена'
    const reward = def.winRotateReward ?? 0
    let body = `HP на финише: ${run.encounter.playerHp}/${run.maxHp}.`
    if (reward > 0) {
      body += ` Награда: +${reward} ROTATE (общий ресурс забега: ${run.rotateCharges + reward}).`
    } else if (isSeq) {
      body += ` Rotate осталось: ${run.rotateCharges}.`
    }
    ui.overlayBody.textContent = body
    if (isSeq && !run.isLastStep) {
      ui.overlayNext.textContent = 'Далее →'
      ui.overlayNext.onclick = () => {
        hideOverlay()
        run.advance()
        loadActiveStep()
      }
    } else {
      ui.overlayNext.textContent = 'Заново'
      ui.overlayNext.onclick = () => {
        hideOverlay()
        loadScene(ui.scenePick.value)
      }
    }
  }
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
  // RUN-001: the count is pool-backed for post-prologue encounters (EncounterState reports the
  // live shared pool via the same getter), encounter-local otherwise. At 0 the buttons stay
  // visible but disabled (disabled comes from canRotate below); the label always shows the count.
  ui.rotateCharges.textContent = def.rotate.allow.length === 0 ? '' : `Rotate ×${s.rotateCharges}`
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
ui.restartBtn.onclick = () => {
  if (run && run.steps.length > 1) {
    run.restartStep()
    loadActiveStep()
  } else {
    loadScene(ui.scenePick.value)
  }
}
ui.hintBtn.onclick = showHint
ui.debugToggle.onclick = () => ui.debugPanel.classList.toggle('hidden')
ui.scenePick.onchange = () => loadScene(ui.scenePick.value)
window.addEventListener('resize', () => { if (level) { renderer.resize(level, slotReserve); kick() } })
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === 'q') rotate(-1)
  else if (k === 'e') rotate(1)
  else if (k === 'r') {
    if (run && run.steps.length > 1) {
      run.restartStep()
      loadActiveStep()
    } else {
      loadScene(ui.scenePick.value)
    }
  }
  else if (k === 'h') showHint()
  else if (k === 'd') ui.debugPanel.classList.toggle('hidden')
  else return
  ev.preventDefault()
})

for (const scene of ALL_SCENES) ui.scenePick.append(new Option(scene.title, scene.key))
const initialKey = new URLSearchParams(location.hash.slice(1)).get('scene') ?? 'act1-e1'
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
  layout: () => renderer.debugLayout(), // VIS-007: per-frame arena layout (canvas coords)
}
