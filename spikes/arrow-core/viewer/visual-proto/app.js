// VIS-001: playable visual combat shell. Presentation layer only -- every rule (hit/miss, HP,
// attack timers, win/loss, Rotate) is decided by RunState/EncounterState from dist/src (the same
// engine cp-prologue.js/prologue.js/encounter.js already use). This file wires that engine to a
// 16:9 desktop shell: board-renderer.js draws the board/targets, this file owns scene loading,
// input, HUD DOM, and the win/loss overlay. No combat rule is duplicated here.
import {
  DIR_NAMES, findWin, formatAction, formatEncounterReport, generateLevel, ITEMS, PRESETS, RunState, validateEncounter,
} from '../../dist/src/index.js'
import { applyPoseOverrides, ASSET_MANIFEST, BOSS_MANIFESTS, bossSpeciesFor, ENEMY_MANIFESTS, loadAssets, loadBossPack, loadWolfPack } from './assets.js'
import { ARENA_CALIBRATIONS, getArenaCalibration, hasArenaCalibrationOverride, resolveArenaPresentation } from './arena-calibration.js'
import { createBoardRenderer } from './board-renderer.js'
import { getStep, SEQUENCE_STEPS } from './prologue-steps.js'
import { resolveActiveSceneKey } from './scene-sync.js'
import { loadCampaign, convertLevelToStep } from './campaign-model.js'
import {
  appearBossVisual, baselinePose, BOSS_POSES, manualBossPose,
  onBossGameplayEvent, readBossSnapshot, tickBossVisual,
} from './boss-visual-state.js'
import {
  appearEnemyVisual, baselinePose as enemyBaseline, ENEMY_POSES, manualEnemyPose,
  onEnemyGameplayEvent, readEnemySnapshot, tickEnemyVisual,
} from './enemy-visual-state.js'
import { FLIGHT_MS } from './projectile-flight.js'
import { createItemBar, showRewardDraft } from './items-ui.js'

const $ = (id) => document.getElementById(id)
const ui = {
  stage: $('stage'), bgLayer: $('bgLayer'), scenePick: $('scenePick'), sceneTitle: $('sceneTitle'),
  restartBtn: $('restartBtn'), hintBtn: $('hintBtn'), debugToggle: $('debugToggle'), debugPanel: $('debugPanel'),
  msgLine: $('msgLine'), canvas: $('arena'), status: $('status'), log: $('log'), report: $('report'),
  playerCard: $('playerCard'), playerHpFill: $('playerHpFill'), playerHpText: $('playerHpText'),
  rotCw: $('rotCw'), rotCcw: $('rotCcw'), rotateCharges: $('rotateCharges'),
  overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayBody: $('overlayBody'), overlayNext: $('overlayNext'), overlayRestartAll: $('overlayRestartAll'),
  bakedArenaPick: $('bakedArenaPick'), bakedArenaLoadBtn: $('bakedArenaLoadBtn'),
  arrowStylePick: $('arrowStylePick'), arrowMatPick: $('arrowMatPick'), flightStylePick: $('flightStylePick'),
  adminToggle: $('adminToggle'),
}

// BUILD-025/CAL-004: canon Prologue sequence -- now shared with calibration-editor.js via
// ./prologue-steps.js (imported above) so both always agree on the same 5 steps.
const STANDALONE_SCENES = [
  { key: 'act1-e1', title: 'Act I #1 · Двуручный рубеж (seed 22)', file: '../../encounters/act1-e1.json' },
  { key: 'act1-e2', title: 'Act I #2 · Взаимный замок (seed 112)', file: '../../encounters/act1-e2.json' },
  { key: 'act1-e3', title: 'Act I #3 · Кастер и свита (seed 25)', file: '../../encounters/act1-e3.json' },
  { key: 'cp-e1', title: 'Debug · cp-e1 flexible tiny (seed 3874)', file: '../../encounters/cp-e1.json' },
  { key: 'rock-spike', title: 'Debug · Rock-spike THROW/PIN (seed 15)', file: '../../encounters/rock-spike.json' },
]

const ALL_SCENES = [...SEQUENCE_STEPS, ...STANDALONE_SCENES]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

const renderer = createBoardRenderer(ui.canvas, ui.stage)
const assets = await loadAssets(ASSET_MANIFEST)
// TOOL-001: merge any tool-authored pose reassignments before building any pack below, so the
// playable runtime renders exactly what the Creature Pose Editor's Save wrote.
await applyPoseOverrides()
// VIS-005/VIS-008: per-pose boss packs, one per species (missing files -> null -> idle ->
// placeholder fallback, same contract for both). `bossPack` (used for rendering/debug buttons)
// is picked per scene in loadScene() via bossSpeciesFor(def.boss.id) -- boss-visual-state.js
// itself never knows which species is active. Both packs stay loaded so Goblin Taunter/King
// (the reserved Act I boss) is still reachable, e.g. via window.visualDebug.showBossPack(...).
const bossPacks = {
  'goblin-shaman': await loadBossPack(BOSS_MANIFESTS['goblin-shaman']),
  'goblin-taunter': await loadBossPack(BOSS_MANIFESTS['goblin-taunter']),
}
let bossPack = bossPacks['goblin-shaman']
let bossSpecies = 'goblin-shaman'
// VIS-006: Dire Wolf pack for ordinary enemies (same null-on-missing contract).
const wolfPack = await loadWolfPack()
// ASSET-002: one pack per ordinary-enemy species (asset-catalog.js's CREATURE_CATALOG ids),
// preloaded upfront like bossPacks above -- board-renderer.js's drawTarget picks the right one per
// enemy via its own `species` field, falling back to `wolfPack` (Dire Wolf) when unset/unknown.
const enemyPacksBySpecies = Object.fromEntries(
  await Promise.all(Object.entries(ENEMY_MANIFESTS).map(async ([species, manifest]) => [species, await loadWolfPack(manifest)])),
)
const wolfPosesLoaded = ENEMY_POSES.filter((p) => wolfPack[p]).length
applyDomAssets(assets)

const runConfig = await fetchJson('../../encounters/cp-run-config.json').catch(() => ({ playerMaxHp: 10 }))
// ITEM-001 debug: `?items=bow,shield` starts every run with those items (playtest shortcut, no effect otherwise).
{
  const q = new URLSearchParams(location.search).get('items')
  if (q) runConfig.startingItems = q.split(',').map((x) => x.trim()).filter((x) => x in ITEMS)
}
// ITEM-001: item bar (placeholder look) under the player card; the reward draft lives in the overlay.
const itemBar = createItemBar(document.querySelector('.hud-left'), {
  onUse: (id, target) => useItem(id, target),
  targetLabel: (side) => {
    const t = run ? renderer.collectTargets(run.encounter, def).find((x) => x.side === side && !x.dead && !x.fled) : null
    return t?.label ?? DIR_NAMES[side]
  },
})

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
// FIX-023: the ARENA_CALIBRATIONS entry for the currently-loaded TRUE baked-grid debug arena, or
// null on every normal/flexible-arena/rectangular-regression scene -- see loadBakedArenaDebug.
let activeCalibration = null
let authoredSteps = []
// UI-001: what the scene dropdown must show. loadScene sets kind/entryKey; loadActiveStep
// resolves the position (advance may have moved past the entry) via scene-sync.js.
let sceneKind = 'sequence'
let sceneEntryKey = null

/** UI-001: point the scene dropdown at the ACTUAL runtime scene (single source of truth).
 * Debug boards (no static option) get one reusable transient option labelled live. */
function syncScenePick() {
  const { key, transient } = resolveActiveSceneKey({
    kind: sceneKind,
    entryKey: sceneEntryKey,
    idx: run?.idx ?? 0,
    stepCount: run?.steps?.length ?? 1,
    sequenceKeys: SEQUENCE_STEPS.map((s) => s.key),
  })
  const has = [...ui.scenePick.options].some((o) => o.value === key)
  if (!transient && has) {
    ui.scenePick.value = key
    ui.scenePick.querySelector('option[data-transient]')?.remove()
    return
  }
  let opt = ui.scenePick.querySelector('option[data-transient]')
  if (!opt) {
    opt = new Option('', '__debug__')
    opt.dataset.transient = '1'
    ui.scenePick.append(opt)
  }
  opt.value = '__debug__'
  opt.textContent = `debug: ${run?.currentStep?.title ?? run?.currentStep?.id ?? key}`
  ui.scenePick.value = '__debug__'
}

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
async function loadScene(key) {
  hideOverlay()
  ui.stage.classList.remove('hit-flash')
  activeCalibration = null // flexible-arena regression path -- see loadBakedArenaDebug
  restoreDefaultBackground()
  // UI-001: remember how this run was entered so the dropdown can stay truthful on advance.
  sceneKind = key.startsWith('authored-')
    ? 'authored'
    : SEQUENCE_STEPS.some((s) => s.key === key)
      ? 'sequence'
      : 'single'
  sceneEntryKey = key

  if (key.startsWith('authored-') && authoredSteps.length > 0) {
    const authIdx = Number(key.replace('authored-', ''))
    run = new RunState({ ...runConfig, initialRotateCharges: 0 }, authoredSteps)
    if (authIdx > 0 && authIdx < authoredSteps.length) {
      run.debugJumpTo(authIdx, 0)
    }
  } else {
    const seqIdx = SEQUENCE_STEPS.findIndex((s) => s.key === key)
    if (seqIdx >= 0) {
      const steps = await Promise.all(SEQUENCE_STEPS.map(getStep))
      // All Prologue sequence steps start with 0 Rotate charges.
      // Rotate is unlocked in combat during Boss Phase 2 (+1 local) and granted on Boss win (+2 global reward).
      const initialCharges = 0
      run = new RunState({ ...runConfig, initialRotateCharges: initialCharges }, steps)
      if (seqIdx > 0) {
        run.debugJumpTo(seqIdx, initialCharges)
      }
    } else {
      const standalone = STANDALONE_SCENES.find((s) => s.key === key) ?? STANDALONE_SCENES[0]
      const step = await getStep(standalone)
      const initialCharges = standalone.key.startsWith('act1') ? 2 : 0
      run = new RunState({ ...runConfig, initialRotateCharges: initialCharges }, [step])
    }
  }
  loadActiveStep()
}

// FIX-021 debug-only: render a freshly generated SQUARE board (not a saved encounter) purely to
// visually check the board-plane fit at the square-first policy's target sizes (6x6..10x10). No
// new encounter content is added -- the level is generated in memory with the same deterministic
// generator every other scene uses, and reuses rock-spike's minimal single-enemy def (same
// structural requirements: level + def, independent of board size) just so a full, valid
// EncounterState/RunState exists to drive the renderer. Never wired to any UI control.
//
// FIX-031: both debug loaders below used to end with `stepCache.set(step.id, step)`. That was a
// leftover from CAL-004, which moved the step cache into ./prologue-steps.js as a module-private
// Map -- app.js never imported it, so the line threw `stepCache is not defined` and killed the
// loader before it could swap the arena. The line was also pointless: that cache is keyed by
// `scene.key` and only ever read by getStep(), whereas these debug steps are synthesised here,
// keyed by `step.id`, and handed straight to `new RunState(...)`. Nothing could ever read them
// back, so writing them would only have polluted the scene cache with non-scene keys. Deleted
// rather than re-imported -- do not "restore" it.
async function loadSquareDebug(n, seed = 1) {
  activeCalibration = null // flexible-arena regression path -- see loadBakedArenaDebug
  const base = await getStep(STANDALONE_SCENES.find((s) => s.key === 'rock-spike'))
  const gen = generateLevel({ ...PRESETS.medium, width: n, height: n, minArrows: Math.max(4, Math.round(n * n * 0.12)) }, seed)
  if (!gen.ok || !gen.level) return { ok: false, attempts: gen.attempts, rejects: gen.rejects }
  const step = {
    id: `debug-square-${n}`, title: `FIX-021 debug -- square ${n}x${n} (seed ${seed})`,
    level: gen.level, def: base.def, board: { preset: `square-${n}`, seed },
  }
  run = new RunState(runConfig, [step])
  restoreDefaultBackground()
  sceneKind = 'debug' // UI-001: synthesised board, no static dropdown option
  sceneEntryKey = null
  loadActiveStep()
  return { ok: true, width: gen.level.width, height: gen.level.height, arrows: gen.level.arrows.length }
}

// FIX-023 debug-only: render a freshly generated SQUARE board matching a TRUE baked-grid arena's
// boardSizeLocked, with that arena's own calibrated board-plane corners/margin (arena-
// calibration.js) and its own background art swapped in -- proof that the projected logical grid
// lines up cell-to-cell with the painted grid, not a guessed generic trapezoid. Never wired to any
// UI control; restoreDefaultBackground()/activeCalibration=null on every other load path undoes
// the background swap, so normal scenes (including the flexible-arena rectangular regression) are
// never left on a baked-arena image.
async function loadBakedArenaDebug(calibId, seed = 1, defSceneKey = 'rock-spike') {
  const calib = getArenaCalibration(calibId)
  if (!calib) return { ok: false, reason: `unknown calibration id ${calibId}` }
  const n = calib.boardSizeLocked
  // FIX-023: `defSceneKey` picks which existing scene's `def` this debug board borrows (level/
  // board are still freshly generated) -- 'rock-spike' (default) has a single N-side target,
  // 'cp-e4' has both E and W side enemies, so LEFT/RIGHT podium-anchor calibration can be checked
  // visually without a real encounter authored against this arena's board size.
  const base = await getStep(STANDALONE_SCENES.find((s) => s.key === defSceneKey) ?? STANDALONE_SCENES.find((s) => s.key === 'rock-spike'))
  const gen = generateLevel({ ...PRESETS.medium, width: n, height: n, minArrows: Math.max(4, Math.round(n * n * 0.12)) }, seed)
  if (!gen.ok || !gen.level) return { ok: false, attempts: gen.attempts, rejects: gen.rejects }
  const step = {
    id: `debug-baked-${calibId}`, title: `FIX-023 debug -- ${calibId} baked ${n}x${n} (seed ${seed})`,
    level: gen.level, def: base.def, board: { preset: `baked-${calibId}`, seed },
    presentation: { calibration: calibId },
  }
  // FIX-031: `run` is swapped only AFTER the background await, together with loadActiveStep().
  // It used to be assigned before it, which left a window -- the length of an image load -- where
  // the render loop saw the NEW run against the OLD scene's `def`/`bossVisual`. A pending rAF
  // firing inside that window crashed in readBossSnapshot ("Cannot read properties of undefined
  // (reading 'phases')") when the two disagreed about whether the scene has a boss. Keeping the
  // two assignments adjacent means no frame can ever observe a half-swapped scene.
  activeCalibration = calib
  const img = await loadImageEl(calib.background)
  if (img) {
    ui.bgLayer.style.setProperty('--bg-image', `url(${img.src})`)
    ui.bgLayer.classList.add('has-image')
  }
  run = new RunState(runConfig, [step])
  sceneKind = 'debug' // UI-001: synthesised baked board, no static dropdown option
  sceneEntryKey = null
  loadActiveStep()
  return { ok: true, width: gen.level.width, height: gen.level.height, arrows: gen.level.arrows.length, calibration: calibId }
}

function loadImageEl(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function restoreDefaultBackground() {
  if (assets.background) {
    ui.bgLayer.style.setProperty('--bg-image', `url(${assets.background.src})`)
    ui.bgLayer.classList.add('has-image')
  }
}

function loadActiveStep() {
  hideOverlay()
  ui.stage.classList.remove('hit-flash')
  const step = run.currentStep
  level = step.level
  def = step.def
  board = step.board ?? { preset: 'unknown', seed: 0 }
  syncScenePick() // UI-001: dropdown follows the actual runtime scene (advance included)
  ui.sceneTitle.textContent = step.title ?? step.id

  // BUILD-024: resolve calibrated arena through ordinary scene/runtime presentation metadata.
  // If the active step carries presentation (or def.presentation), resolve it via arena-calibration.
  // If found, activeCalibration is set and its calibrated background art is displayed;
  // otherwise activeCalibration is cleared (null) and the default flexible background is restored.
  const pres = step.presentation ?? def.presentation ?? null
  const calib = resolveArenaPresentation(pres)
  activeCalibration = calib
  const overrideActive = calib && hasArenaCalibrationOverride(calib.id)
  ui.sceneTitle.textContent = (step.title ?? step.id) + (overrideActive ? ' [custom calibration applied]' : '')
  if (calib) {
    loadImageEl(calib.background).then((img) => {
      if (img && activeCalibration === calib) {
        ui.bgLayer.style.setProperty('--bg-image', `url(${img.src})`)
        ui.bgLayer.classList.add('has-image')
      }
    })
  } else {
    restoreDefaultBackground()
  }

  renderer.resize(level, activeCalibration)
  renderer.resetFx()
  hint = null
  // VIS-008: which species pack this scene's boss uses (null in enemies-mode scenes).
  bossSpecies = def.boss ? bossSpeciesFor(def.boss.id) : bossSpecies
  bossPack = bossPacks[bossSpecies]
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
  // STORY-001: scripted-flee intro — the encounter opens with an unkillable guest. Generic:
  // any enemy carrying `flee` announces itself, so the next such event needs no new code.
  const fleeGuests = (def.enemies ?? []).filter((e) => e.flee)
  const fleeIntro = fleeGuests.length
    ? ` 👑 ${fleeGuests.map((e) => e.label ?? e.id).join(', ')} нельзя убить: после ${fleeGuests[0].flee.afterHits} попаданий он дразнит, затем показывает зад и сбегает — бой продолжится, чисти board до конца.`
    : ''
  ui.msgLine.textContent = def.enemies
    ? `Враги одновременно: ${run.encounter.enemies.map((e) => e.label ?? e.id).join(', ')}.` +
      (hasAbility ? ' Следи за THROW IN N — брошенный камень временно PINNED одну стрелку.' : '') + fleeIntro
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
  // STORY-001: advance previously-fled enemies one beat first (taunt -> back -> away),
  // then stamp new flees — a fresh flee always plays the full sequence from the taunt.
  const fledStep = renderer.markFledAdvance(after)
  const fledAway = fledStep.away
  const fledBack = fledStep.back
  renderer.markFled(before, after)
  targetsBefore = after
  // BUILD-035: the monster's hit reaction starts when the projectile ARRIVES, not when the
  // player taps. Pose events, death fade (markDeaths) and the win overlay all wait out the
  // flight; the renderer already holds the pre-tap HP presentation until then (pendingHp)
  // and the flash/shake are stamped at arrival. Misses have no arrival to wait for.
  // Arrival order is preserved naturally: each tap's reaction fires on its own timer, and a
  // stale fire (restart/scene change since) is dropped by the encounter identity guard.
  const enc = s
  const defAtTap = def
  const wolfMap = wolfVisuals
  const attacked = new Set((r.enemyAttacks ?? []).map((a) => a.id))
  const fireImpact = () => {
    if (!run || run.encounter !== enc || def !== defAtTap) return
    renderer.markDeaths(before, after)
    // VIS-006: gameplay -> per-actor presentation. Priority per actor: defeated > attack
    // (its own strike is the latest visible beat) > hit > baseline sync. Untouched actors only
    // re-sync an expired hold onto the live baseline (e.g. a newly armed attackReady telegraph).
    if (wolfMap && wolfVisuals === wolfMap) {
      const now = performance.now()
      for (const e of enc.enemies) {
        const snap = readEnemySnapshot(e)
        const v = wolfMap.get(e.id)
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
      else if (enc.phaseIndex !== phaseBefore) bossVisual = onBossGameplayEvent(bossVisual, 'phase', now, snap)
      else if (r.castInterrupted) bossVisual = onBossGameplayEvent(bossVisual, 'interrupted', now, snap)
      else if (r.hit) bossVisual = onBossGameplayEvent(bossVisual, 'hit', now, snap)
      else if (!bossVisual.manual && now >= bossVisual.holdUntil && bossVisual.pose !== baselinePose(snap)) {
        bossVisual = onBossGameplayEvent(bossVisual, 'castStart', now, snap)
      }
    }
    if (r.won) scheduleWin()
  }
  if (r.hit) setTimeout(fireImpact, FLIGHT_MS)
  else fireImpact()

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
  if (r.shieldRaised && r.shieldRaised.length) text += ` · SHIELD UP: ${r.shieldRaised.map((x) => x.id).join(', ')}`
  if (r.shieldConsumed && r.shieldConsumed.length) text += ` · SHIELD BLOCKED: ${r.shieldConsumed.map((x) => x.id).join(', ')}`
  // LD-007 provisional: Side Shift ability.
  if (r.shifted && r.shifted.length) text += ` · MOVED: ${r.shifted.map((x) => `${x.id} ${DIR_NAMES[x.from]}→${DIR_NAMES[x.to]}`).join(', ')}`
  // ACT-I-003: support heals, kill rewards, expired temporary targets.
  if (r.healed && r.healed.length) text += ` · HEALED: ${r.healed.map((x) => `${x.target} +${x.amount} (${x.id})`).join(', ')}`
  if (r.rewards && r.rewards.length) text += ` · LOOT: ${r.rewards.map((x) => [x.heal ? `+${x.heal} HP` : '', x.rotate ? `+${x.rotate} Rotate` : ''].filter(Boolean).join(' ') || '—').join(', ')}`
  if (r.expired && r.expired.length) text += ` · GONE: ${r.expired.map((x) => x.label ?? x.id).join(', ')}`
  if (r.won) text = `Цель выполнена. ${text}`
  else if (r.playerDead) text = `Поражение: HP закончилось. ${text}`
  // STORY-001: scripted flee in three beats. This tap's flee only taunts (one turn);
  // whoever taunted before moons now (back slide, one turn); whoever mooned before leaves.
  // The engine keeps fled enemies "alive", so only a later kill / full board clear wins.
  if (r.fled && r.fled.length) {
    for (const f of r.fled) text += ` · 👑 ${f.label ?? f.id} дразнит! Покажет зад и сбежит через 2 хода.`
  }
  if (fledBack.length) {
    for (const id of fledBack) {
      const e = s.enemies.find((x) => x.id === id)
      text += ` · 👑 ${e?.label ?? id} показывает зад! Сбежит на следующем ходу.`
    }
  }
  if (fledAway.length) {
    for (const id of fledAway) {
      const e = s.enemies.find((x) => x.id === id)
      text += ` · 👑 ${e?.label ?? id} сбежал! Бой продолжается — чисти board до конца.`
    }
  }
  setMsg(text, r.playerDead)
  pushLog(
    `${formatAction({ kind: 'tap', id })}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` +
      (r.enemyAttacked ? `  ENEMY (player ${r.playerHp})` : '') +
      (r.castInterrupted ? '  CAST INTERRUPTED' : '') +
      (r.fled && r.fled.length ? `  FLED: ${r.fled.map((f) => f.id).join(', ')}` : '') +
      (fledBack.length ? `  FLED-BACK: ${fledBack.join(', ')}` : '') +
      (fledAway.length ? `  FLED-AWAY: ${fledAway.join(', ')}` : '') +
      (r.pinnedThisTurn && r.pinnedThisTurn.length ? `  ROCK THROWN: #${r.pinnedThisTurn.map((p) => `${p.id}(${p.turnsLeft}t)`).join(', #')}` : '') +
      (r.pinExpired && r.pinExpired.length ? `  UNPINNED: #${r.pinExpired.join(', #')}` : ''),
  )
  renderPanel()
  kick()
  // BUILD-035: the win overlay waits inside fireImpact (after arrival); a loss has no
  // projectile, so it stays immediate.
  if (r.playerDead) scheduleGameOver()
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

// ITEM-001: use an inventory item. Free actions (Shield/Flask) just refresh the panel; a Bow
// shot reuses the tap's post-hit presentation path minus the arrow flight (no board arrow moved).
function useItem(id, target) {
  const s = run.encounter
  if (s.over || overlayTimer) return
  const before = renderer.collectTargets(s, def)
  const phaseBefore = bossVisual ? s.phaseIndex : -1
  const r = s.useItem(id, target)
  hint = null
  if (!r.ok) {
    setMsg('Предмет сейчас нельзя использовать.', true)
    return
  }
  const label = ITEMS[id].label
  const after = renderer.collectTargets(s, def)
  const attacked = new Set((r.enemyAttacks ?? []).map((a) => a.id))
  if (r.hit) {
    renderer.markDeaths(before, after)
    renderer.markFled(before, after)
    targetsBefore = after
    if (wolfVisuals) {
      const now = performance.now()
      for (const e of s.enemies) {
        const snap = readEnemySnapshot(e)
        const v = wolfVisuals.get(e.id)
        if (!v) continue
        if (e.dead) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'defeated', now, snap))
        else if (attacked.has(e.id)) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'attack', now, snap))
        else if (e.side === target) wolfVisuals.set(e.id, onEnemyGameplayEvent(v, 'hit', now, snap))
      }
      tickAndSyncWolves(now)
    }
    if (bossVisual) {
      const now = performance.now()
      const snap = bossSnap()
      if (r.won) bossVisual = onBossGameplayEvent(bossVisual, 'won', now, snap)
      else if (s.phaseIndex !== phaseBefore) bossVisual = onBossGameplayEvent(bossVisual, 'phase', now, snap)
      else if (r.castInterrupted) bossVisual = onBossGameplayEvent(bossVisual, 'interrupted', now, snap)
      else bossVisual = onBossGameplayEvent(bossVisual, 'hit', now, snap)
    }
  }
  let text = `${label}`
  if (r.hit) text += ` · попадание (${r.hitDamage}) · HP целей ${s.hp}/${s.totalHp}`
  if (id === 'shield') text += ` · щит ${s.wardHp}`
  if (id === 'health_flask') text += ` · HP игрока ${s.playerHp}`
  if (r.enemyAttacked) {
    text += ` · ВРАГ АТАКУЕТ (HP игрока ${r.playerHp})`
    flashPlayerHit()
  }
  if (r.castInterrupted) text += ' · CAST INTERRUPTED'
  if (r.rewards && r.rewards.length) text += ` · LOOT: ${r.rewards.map((x) => [x.heal ? `+${x.heal} HP` : '', x.rotate ? `+${x.rotate} Rotate` : ''].filter(Boolean).join(' ') || '—').join(', ')}`
  setMsg(text, false)
  pushLog(`item ${id}${target !== undefined ? ` -> ${DIR_NAMES[target]}` : ''}${r.hit ? `  HIT ${r.hitDamage}` : ''}  player ${s.playerHp}${s.wardHp ? ` ward ${s.wardHp}` : ''}`)
  renderPanel()
  kick()
  if (r.won) scheduleWin()
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
  setMsg(`Подсказка: ${hint.kind === 'tap' ? `стрелка #${hint.id}` : hint.kind === 'rotate' ? `Rotate ${hint.turn === 1 ? 'cw' : 'ccw'}` : `предмет ${ITEMS[hint.id].label}${hint.target !== undefined ? ` → ${DIR_NAMES[hint.target]}` : ''}`}.`, false)
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
    ui.overlayNext.textContent = 'Повторить этап'
    ui.overlayNext.onclick = () => {
      hideOverlay()
      run.restartStep()
      loadActiveStep()
    }
    if (ui.overlayRestartAll) {
      const isAuthored = run.steps.length > 0 && run.steps[0]?.id?.startsWith('stage-')
      ui.overlayRestartAll.style.display = run.steps.length > 1 ? 'inline-block' : 'none'
      ui.overlayRestartAll.textContent = isAuthored ? 'Начать кампанию сначала' : 'Начать пролог сначала'
      ui.overlayRestartAll.onclick = () => {
        hideOverlay()
        run.restartRun()
        loadActiveStep()
      }
    }
  } else {
    const isSeq = run.steps.length > 1
    const isLast = !isSeq || run.isLastStep
    const reward = def.winRotateReward ?? 0
    const isAuthored = run.steps.length > 0 && run.steps[0]?.id?.startsWith('stage-')
    if (ui.overlayRestartAll) ui.overlayRestartAll.style.display = 'none'

    if (isSeq && isLast) {
      if (isAuthored) {
        ui.overlayTitle.textContent = 'Кампания пройдена!'
        ui.overlayBody.textContent = `HP на финише: ${run.encounter.playerHp}/${run.maxHp}. Все этапы авторской кампании успешно завершены!`
        ui.overlayNext.textContent = 'В редактор кампании →'
        ui.overlayNext.onclick = () => {
          window.location.href = './calibration-editor.html'
        }
      } else {
        ui.overlayTitle.textContent = 'Пролог пройден!'
        let body = `HP на финише: ${run.encounter.playerHp}/${run.maxHp}. `
        if (reward > 0) {
          body += `Награда за босса: +${reward} ROTATE (общий пул: ${run.rotateCharges + reward}). `
        }
        body += 'Все 5 этапов текущего пролога успешно завершены! Теперь обсуждаем дальнейшие изменения.'
        ui.overlayBody.textContent = body
        ui.overlayNext.textContent = 'Пройти пролог заново'
        ui.overlayNext.onclick = () => {
          hideOverlay()
          run.restartRun()
          loadActiveStep()
        }
      }
    } else if (isSeq) {
      const showNext = () => {
        ui.overlayTitle.style.display = ''
        ui.overlayBody.style.display = ''
        ui.overlayNext.style.display = ''
        ui.overlayTitle.textContent = 'Этап пройден'
        let body = `HP: ${run.encounter.playerHp}/${run.maxHp}.`
        if (run.rotateCharges > 0) {
          body += ` Rotate осталось: ${run.rotateCharges}.`
        }
        body += ` Золото: ${run.gold}.`
        if (run.inventory.length) body += ` Предметы: ${run.inventory.map((it) => ITEMS[it.id].label).join(', ')}.`
        ui.overlayBody.textContent = body
        ui.overlayNext.textContent = 'Следующий этап →'
        ui.overlayNext.onclick = () => {
          hideOverlay()
          run.advance()
          loadActiveStep()
        }
      }
      // ITEM-001: the reward draft comes first; the usual "next step" card follows the pick.
      if (run.rewardPending) {
        ui.overlayTitle.style.display = 'none'
        ui.overlayBody.style.display = 'none'
        ui.overlayNext.style.display = 'none'
        showRewardDraft(ui.overlay.querySelector('.card'), run, { onDone: showNext })
      } else showNext()
    } else {
      ui.overlayTitle.textContent = 'Победа!'
      ui.overlayBody.textContent = `HP на финише: ${run.encounter.playerHp}/${run.maxHp}.`
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
  if (ui.overlayRestartAll) ui.overlayRestartAll.style.display = 'none'
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
    wolf: wolfVisuals ? { pack: wolfPack, packsBySpecies: enemyPacksBySpecies, visuals: wolfVisuals } : null,
    // BUILD-022: board alignment dots/outline are debug-only -- a normal playthrough shows only
    // puzzle content (arrows/glow/selection/shots) directly on the arena's own stone surface.
    debug: !ui.debugPanel.classList.contains('hidden'),
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
  itemBar.render(run)
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
  // VIS-005/VIS-008: boss presentation state (debug-panel only -- gameplay state is the engine's).
  if (def.boss) {
    const loaded = BOSS_POSES.filter((p) => bossPack[p]).length
    statusLines.push(`boss art: ${bossSpecies} ${loaded}/${BOSS_POSES.length} poses loaded`)
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
// UI-001: clean game view -- one explicit switch hides the admin chrome (baked-arena debug,
// external links, debug toggle + panel) without losing dev access. Sticks in localStorage,
// ?clean=1 / ?clean=0 overrides on load. Campaign/Pose editors are separate pages, untouched.
const CLEAN_KEY = 'ar_playable_clean'
function applyCleanMode(clean) {
  document.body.classList.toggle('clean', clean)
  try { localStorage.setItem(CLEAN_KEY, clean ? '1' : '0') } catch {}
  if (ui.adminToggle) ui.adminToggle.textContent = clean ? '🛠' : '⚙'
  if (ui.adminToggle) ui.adminToggle.title = clean ? 'Show admin UI' : 'Hide admin UI (clean game view)'
}
function initCleanMode(queryParams, hashParams) {
  const param = queryParams.get('clean') ?? hashParams.get('clean')
  let stored = null
  try { stored = localStorage.getItem(CLEAN_KEY) } catch {}
  applyCleanMode(param !== null ? param !== '0' : stored === '1')
}
if (ui.adminToggle) ui.adminToggle.onclick = () => applyCleanMode(!document.body.classList.contains('clean'))
ui.scenePick.onchange = () => loadScene(ui.scenePick.value)
window.addEventListener('resize', () => { if (level) { renderer.resize(level, activeCalibration); kick() } })
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

// Populate campaign steps if available
const loadedCampaignInfo = await loadCampaign()
if (loadedCampaignInfo?.campaign?.levels?.length > 0) {
  try {
    authoredSteps = loadedCampaignInfo.campaign.levels.map(convertLevelToStep)
  } catch (e) {
    console.warn('Failed to parse authored campaign steps', e)
  }
}

for (const scene of SEQUENCE_STEPS) ui.scenePick.append(new Option(scene.title, scene.key))

if (authoredSteps.length > 0) {
  const cSep = new Option('── Авторская кампания ──', '')
  cSep.disabled = true
  ui.scenePick.append(cSep)
  authoredSteps.forEach((s, idx) => {
    ui.scenePick.append(new Option(`${idx + 1}. ${s.title}`, `authored-${idx}`))
  })
}

const sep = new Option('── Standalone / Debug ──', '')
sep.disabled = true
ui.scenePick.append(sep)
for (const scene of STANDALONE_SCENES) ui.scenePick.append(new Option(scene.title, scene.key))

const queryParams = new URLSearchParams(location.search)
const hashParams = new URLSearchParams(location.hash.slice(1))
const mode = queryParams.get('mode') ?? hashParams.get('mode')
const stageParam = queryParams.get('stage') ?? hashParams.get('stage')
initCleanMode(queryParams, hashParams) // UI-001: ?clean=1 starts in clean game view

// BUILD-035: projectile flight style switcher. Painting only -- same trajectory sync
// (FLIGHT_MS arrival timing) for every style. ?flight=lob starts with the lob arc.
// Dropdown in the debug panel + window.visualDebug.setFlightStyle for automation.
{
  const flightParam = queryParams.get('flight') ?? hashParams.get('flight')
  if (flightParam) renderer.setFlightStyle(flightParam)
  if (ui.flightStylePick) {
    for (const id of renderer.listFlightStyles()) ui.flightStylePick.append(new Option(id, id))
    ui.flightStylePick.value = renderer.getFlightStyle()
    ui.flightStylePick.onchange = () => { renderer.setFlightStyle(ui.flightStylePick.value); kick() }
  }
}
// BUILD-034: arrow presentation selector. Debug/QA only -- it picks how arrows are PAINTED and
// has no gameplay effect (hit-testing goes through screenToCell/ownerAt either way).
//   ?arrow=<materialId>   one of renderer.listArrowMaterials() -- default `warm-bevel`
//   ?arrowStyle=stroke    fall back to the legacy stroke renderer
// The same two knobs are exposed as dropdowns in the debug panel, and as
// window.__arrows for console/automation use.
{
  const styleParam = queryParams.get('arrowStyle') ?? hashParams.get('arrowStyle')
  const matParam = queryParams.get('arrow') ?? hashParams.get('arrow')
  if (styleParam) renderer.setArrowStyle(styleParam)
  if (matParam) renderer.setArrowMaterial(matParam)
  if (ui.arrowStylePick) {
    for (const id of ['filled', 'stroke']) ui.arrowStylePick.append(new Option(id, id))
    ui.arrowStylePick.value = renderer.getArrowStyle()
    ui.arrowStylePick.onchange = () => { renderer.setArrowStyle(ui.arrowStylePick.value); kick() }
  }
  if (ui.arrowMatPick) {
    for (const m of renderer.listArrowMaterials()) {
      ui.arrowMatPick.append(new Option(`${m.name}${m.animated ? ' ✦' : ''} — ${m.vibe}`, m.id))
    }
    ui.arrowMatPick.value = renderer.getArrowMaterial()
    ui.arrowMatPick.onchange = () => { renderer.setArrowMaterial(ui.arrowMatPick.value); kick() }
  }
  window.__arrows = {
    list: () => renderer.listArrowMaterials(),
    setMaterial: (id) => { renderer.setArrowMaterial(id); if (ui.arrowMatPick) ui.arrowMatPick.value = renderer.getArrowMaterial(); kick(); return renderer.getArrowMaterial() },
    setStyle: (st) => { renderer.setArrowStyle(st); if (ui.arrowStylePick) ui.arrowStylePick.value = renderer.getArrowStyle(); kick(); return renderer.getArrowStyle() },
    get: () => ({ style: renderer.getArrowStyle(), material: renderer.getArrowMaterial() }),
    geometry: () => renderer.arrowGeometry(),
  }
}

let initialKey = queryParams.get('scene') ?? hashParams.get('scene')
if (mode === 'authored' && authoredSteps.length > 0) {
  const stIdx = Number(stageParam ?? 0)
  initialKey = `authored-${stIdx}`
}
if (!initialKey) initialKey = 'prologue-5x5'

ui.scenePick.value = initialKey
await loadScene(initialKey)

// FIX-023: one-click UI for loadBakedArenaDebug (previously console-only) -- picks a calibration
// id from arena-calibration.js and loads it with cp-e4's def (E+W side targets, so LEFT/RIGHT
// anchors are visible alongside TOP), auto-opening the debug panel so the grid-mesh overlay shows
// immediately for calibration comparison against the baked art.
if (ui.bakedArenaPick && ui.bakedArenaLoadBtn) {
  for (const calib of Object.values(ARENA_CALIBRATIONS)) {
    ui.bakedArenaPick.append(new Option(`${calib.id} (${calib.boardSizeLocked}x${calib.boardSizeLocked})`, calib.id))
  }
  ui.bakedArenaLoadBtn.onclick = async () => {
    const id = ui.bakedArenaPick.value
    if (!id) return
    ui.debugPanel.classList.remove('hidden')
    const r = await loadBakedArenaDebug(id, 1, 'cp-e4')
    if (!r.ok) setMsg(`FIX-023 debug: не удалось загрузить ${id} (${r.reason ?? 'generator failed'})`, true)
  }
}

// Debug hook for automated checks, same convention as encounterDebug/prologueDebug/cpDebug.
window.visualDebug = {
  run: () => run,
  state: () => run.encounter,
  // Same convention as calibration-editor.js's calibrationEditorDebug.getLayout() -- the
  // renderer's own view of what it's drawing, for automated checks (VS-001/VIS-007's
  // "player + boss/enemies -> layout rect" contract, same idea as debugLayout()).
  debugTargets: () => renderer.collectTargets(run.encounter, def),
  authoredSteps: () => authoredSteps,
  tap,
  rotate,
  findWin: (opts) => findWin(run.encounter, opts),
  loadScene,
  advance: () => {
    const ok = run.advance()
    if (ok) loadActiveStep()
    return ok
  },
  restartRun: () => {
    run.restartRun()
    loadActiveStep()
  },
  restartStep: () => {
    run.restartStep()
    loadActiveStep()
  },
  boss: () => bossVisual, // VIS-005: current presentation pose state (null in enemies mode)
  bossSpecies: () => (bossVisual ? bossSpecies : null), // VIS-008: which pack is currently active
  setBossPose: (pose) => { // VIS-005: manual debug override, same as the debug-panel buttons
    if (bossVisual) {
      bossVisual = manualBossPose(bossVisual, pose, performance.now())
      renderPanel()
      kick()
    }
    return bossVisual
  },
  // VIS-008: debug-only species swap so Goblin Taunter/King (reserved Act I boss) stays
  // reachable without a UI control -- does not touch which pack a scene loads by default.
  showBossPack: (species) => {
    if (bossVisual && bossPacks[species]) {
      bossSpecies = species
      bossPack = bossPacks[species]
      buildBossPoseButtons()
      renderPanel()
      kick()
    }
    return bossSpecies
  },
  wolf: () => wolfVisuals ? Object.fromEntries([...wolfVisuals].map(([id, w]) => [id, w.pose])) : null, // VIS-006: per-actor poses (null in boss mode)
  fled: () => run.encounter.enemies.filter((e) => e.fled).map((e) => e.id), // STORY-001: which enemies already fled (empty when none)
  setWolfPose: (id, pose) => { // VIS-006: manual debug override per actor
    if (wolfVisuals?.has(id)) {
      wolfVisuals.set(id, manualEnemyPose(wolfVisuals.get(id), pose, performance.now()))
      renderPanel()
      kick()
    }
    return wolfVisuals?.get(id) ?? null
  },
  layout: () => renderer.debugLayout(), // VIS-007: per-frame arena layout (canvas coords)
  // BUILD-035: live projectile shots + hit-anchors (debug/QA only -- no gameplay effect).
  shots: () => renderer.debugShots(),
  anchors: () => renderer.debugAnchors(),
  // BUILD-035: flight style switcher (painting only, same trajectory sync every style).
  setFlightStyle: (st) => { renderer.setFlightStyle(st); if (ui.flightStylePick) ui.flightStylePick.value = renderer.getFlightStyle(); kick(); return renderer.getFlightStyle() },
  // UI-001: clean game view switch (hides admin chrome; dev access kept via the ⚙ button).
  setCleanMode: (clean) => { applyCleanMode(!!clean); kick(); return document.body.classList.contains('clean') },
  // FIX-021: board-plane projection debug API -- corners/logical fit + point projection, so
  // browser checks can verify click mapping and plane geometry without eyeballing pixels.
  boardPlane: () => renderer.boardPlane(),
  projectBoardPoint: (col, row, angleDeg) => renderer.projectBoardPoint(col, row, angleDeg),
  unprojectBoardPoint: (x, y, angleDeg) => renderer.unprojectBoardPoint(x, y, angleDeg),
  // FIX-021: square-first policy visual QA -- see loadSquareDebug's own comment.
  loadSquareDebug,
  // FIX-023: TRUE baked-grid calibration visual QA -- see loadBakedArenaDebug's own comment.
  loadBakedArenaDebug,
}
