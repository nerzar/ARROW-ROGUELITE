// BUILD-026: Campaign & Level Authoring Tool + Arena Calibration Editor.
// Extends CAL-004 calibration tooling into a complete authoring environment.
// Supports:
//  - Square-only boards (5x5, 6x6, 7x7, 8x8, 9x9, 10x10) + seed rolling
//  - Center-first enemy placement (TOP/center slot 0 default)
//  - Multi-enemy management with HP, attack timers, and species from data-driven asset catalog
//  - Full arena presentation and calibration (board corners, actor anchors, scale, sprite pivot, effect anchors)
//  - Level ordering: create, duplicate, delete, move up/down
//  - Dual persistence: real project file (POST /api/campaign/save -> campaigns/campaign.json) + localStorage fallback
//  - Direct launch into playable game for single level or full campaign playtest.

import { EncounterState, generateLevel, PRESETS } from '../../dist/src/index.js'
import { applyPoseOverrides, ASSET_MANIFEST, BOSS_MANIFESTS, bossSpeciesFor, ENEMY_MANIFESTS, loadAssets, loadBossPack, loadWolfPack } from './assets.js'
import {
  ARENA_CALIBRATIONS, clearArenaCalibrationOverride, getArenaCalibration,
  hasArenaCalibrationOverride, saveArenaCalibrationOverride,
} from './arena-calibration.js'
import { createBoardRenderer } from './board-renderer.js'
import { appearEnemyVisual, readEnemySnapshot, tickEnemyVisual } from './enemy-visual-state.js'
import { appearBossVisual, readBossSnapshot, tickBossVisual } from './boss-visual-state.js'
import { getStep, SEQUENCE_STEPS } from './prologue-steps.js'
import { ARENA_CATALOG, CREATURE_CATALOG, findArena, findCreature, registerArena } from './asset-catalog.js'
import {
  createDefaultCampaign, createDefaultLevel, generateBoardForLevel,
  getNextAvailableSide, convertLevelToStep, saveCampaign, loadCampaign,
  changeLevelArena, getArenaBaseline,
} from './campaign-model.js'

const $ = (id) => document.getElementById(id)
const ui = {
  stagePick: $('stagePick'), bgPick: $('bgPick'), saveArenaDefaultBtn: $('saveArenaDefaultBtn'), arenaPick: $('arenaPick'), gridSizePick: $('gridSizePick'),
  toggleGrid: $('toggleGrid'), toggleArrows: $('toggleArrows'), toggleSprites: $('toggleSprites'), toggleEffect: $('toggleEffect'),
  resetBtn: $('resetBtn'), saveStorageBtn: $('saveStorageBtn'), clearStorageBtn: $('clearStorageBtn'), copyBtn: $('copyBtn'), downloadBtn: $('downloadBtn'),
  newLevelBtn: $('newLevelBtn'), saveBadge: $('saveBadge'), playLevelBtn: $('playLevelBtn'), playCampaignBtn: $('playCampaignBtn'),
  importArenaBtn: $('importArenaBtn'), importArenaInput: $('importArenaInput'), importArenaStatus: $('importArenaStatus'),
  authorLevelTitle: $('authorLevelTitle'), authorBoardSize: $('authorBoardSize'), authorBoardSeed: $('authorBoardSeed'), rollSeedBtn: $('rollSeedBtn'),
  authorBlockedTap: $('authorBlockedTap'), btnDupLevel: $('btnDupLevel'), btnDelLevel: $('btnDelLevel'), btnMoveUp: $('btnMoveUp'), btnMoveDown: $('btnMoveDown'),
  authorEnemiesList: $('authorEnemiesList'), authorAddEnemyBtn: $('authorAddEnemyBtn'),
  scaleTop: $('scaleTop'), scaleTopNum: $('scaleTopNum'),
  scaleLeft: $('scaleLeft'), scaleLeftNum: $('scaleLeftNum'),
  scaleRight: $('scaleRight'), scaleRightNum: $('scaleRightNum'),
  linkSideScale: $('linkSideScale'),
  pivotTopX: $('pivotTopX'), pivotTopXNum: $('pivotTopXNum'),
  pivotTopY: $('pivotTopY'), pivotTopYNum: $('pivotTopYNum'),
  pivotLeftX: $('pivotLeftX'), pivotLeftXNum: $('pivotLeftXNum'),
  pivotLeftY: $('pivotLeftY'), pivotLeftYNum: $('pivotLeftYNum'),
  pivotRightX: $('pivotRightX'), pivotRightXNum: $('pivotRightXNum'),
  pivotRightY: $('pivotRightY'), pivotRightYNum: $('pivotRightYNum'),
  stage: $('stage'), bgLayer: $('bgLayer'), canvas: $('arena'), handlesLayer: $('handlesLayer'),
  selectedInfo: $('selectedInfo'), valuesTable: $('valuesTable'), exportText: $('exportText'), copyStatus: $('copyStatus'),
}

// ---------------------------------------------------------------------------------------------
// Geometry / Handles Contract

function cornerDef(key, label, short) {
  return {
    kind: 'corner', key, label, short, fmt: 'arr',
    getRaw: (d) => d.boardPlaneFrac[key],
    setRaw: (d, v) => { d.boardPlaneFrac[key] = v },
  }
}
function anchorDef(key, label, short) {
  return {
    kind: 'actor', key, label, short, fmt: 'obj',
    getRaw: (d) => d.anchors[key],
    setRaw: (d, v) => { d.anchors[key] = v },
  }
}
function effectDef(key, label, short) {
  return {
    kind: 'effect', key, label, short, fmt: 'obj',
    getRaw: (d) => d.effectAnchors[key],
    setRaw: (d, v) => { d.effectAnchors[key] = v },
  }
}

const HANDLE_DEFS = [
  cornerDef('tl', 'TL board corner', 'TL'),
  cornerDef('tr', 'TR board corner', 'TR'),
  cornerDef('br', 'BR board corner', 'BR'),
  cornerDef('bl', 'BL board corner', 'BL'),
  anchorDef('top', 'TOP actor anchor', 'T'),
  anchorDef('left', 'LEFT actor anchor', 'L'),
  anchorDef('right', 'RIGHT actor anchor', 'R'),
  effectDef('top', 'TOP effect anchor', 'T'),
  effectDef('left', 'LEFT effect anchor', 'L'),
  effectDef('right', 'RIGHT effect anchor', 'R'),
]

const clamp01 = (n) => Math.max(0, Math.min(1, n))
const deepClone = (v) => JSON.parse(JSON.stringify(v))

function fracXY(def, d) {
  const v = def.getRaw(d)
  return def.fmt === 'arr' ? { x: v[0], y: v[1] } : { x: v.x, y: v.y }
}
function writeFracXY(def, d, x, y) {
  x = clamp01(x); y = clamp01(y)
  def.setRaw(d, def.fmt === 'arr' ? [x, y] : { x, y })
}

// ---------------------------------------------------------------------------------------------
// Global authoring state

let campaign = null
let currentLevelIndex = 0
let draft = null
let original = null
let level = null
let def = null
let encounterState = null
let wolfVisuals = null
let bossVisual = null
let bossPack = null
let selected = null

const renderer = createBoardRenderer(ui.canvas, ui.stage)
const assets = await loadAssets(ASSET_MANIFEST)
// TOOL-001: merge any tool-authored pose reassignments before building packs below, so the
// editor's own preview reflects them immediately (same reason app.js does this too).
await applyPoseOverrides()
const wolfPack = await loadWolfPack()
// ASSET-002: same per-species preload as app.js, so the campaign editor's own preview shows the
// real chosen creature, not always Dire Wolf.
const enemyPacksBySpecies = Object.fromEntries(
  await Promise.all(Object.entries(ENEMY_MANIFESTS).map(async ([species, manifest]) => [species, await loadWolfPack(manifest)])),
)
const bossPacks = {
  'goblin-shaman': await loadBossPack(BOSS_MANIFESTS['goblin-shaman']),
  'goblin-taunter': await loadBossPack(BOSS_MANIFESTS['goblin-taunter']),
}

// ---------------------------------------------------------------------------------------------
// Visual state derivations

function setupActorVisuals() {
  bossVisual = null
  bossPack = null
  wolfVisuals = null
  if (def.boss) {
    bossPack = bossPacks[bossSpeciesFor(def.boss.id)] ?? bossPacks['goblin-shaman']
    bossVisual = appearBossVisual(performance.now())
  } else if (def.enemies) {
    wolfVisuals = new Map()
    for (const e of encounterState.enemies) {
      wolfVisuals.set(e.id, appearEnemyVisual(performance.now()))
    }
  }
}

function setBackground(src) {
  if (src) {
    ui.bgLayer.style.setProperty('--bg-image', `url(${src})`)
    ui.bgLayer.classList.add('has-image')
  } else {
    ui.bgLayer.style.removeProperty('--bg-image')
    ui.bgLayer.classList.remove('has-image')
  }
}

function applyCalibration(calib) {
  draft = deepClone(calib)
  original = deepClone(calib)
  setBackground(draft.background)
  syncBgPick()
  syncScaleInputs()
  syncPivotInputs()
}

function syncBgPick() {
  ensureBgPickOptions()
  const currentLevel = campaign?.levels?.[currentLevelIndex]
  const targetBg = draft?.background || currentLevel?.presentation?.background
  const targetArena = currentLevel?.presentation?.arena || draft?.id
  const match = ARENA_CATALOG.find((a) => (targetBg && a.path === targetBg) || (targetArena && (a.id === targetArena || a.path === targetArena)))
  if (match) ui.bgPick.value = match.path
}

// ---------------------------------------------------------------------------------------------
// Level loading and authoring logic

async function loadLevel(idx) {
  if (!campaign || !campaign.levels || campaign.levels.length === 0) return
  if (idx < 0) idx = 0
  if (idx >= campaign.levels.length) idx = campaign.levels.length - 1
  currentLevelIndex = idx

  const levelDef = campaign.levels[idx]

  // 1. Build Step & Board
  let step
  try {
    step = convertLevelToStep(levelDef)
  } catch (err) {
    console.error('Board generation error, rolling fallback seed', err)
    levelDef.board.seed = 1000 + idx * 77
    step = convertLevelToStep(levelDef)
  }

  level = step.level
  def = step.def
  encounterState = EncounterState.fromLevel(level, def, 9999, null)
  setupActorVisuals()
  renderer.resetFx()

  // 2. Resolve Calibration
  const arenaInfo = findArena(levelDef.presentation?.arena || levelDef.presentation?.background)
  let calib = levelDef.presentation?.calibration
  if (typeof calib === 'string') {
    calib = getArenaCalibration(calib)
  }
  const isValid = calib && typeof calib === 'object' && calib.boardPlaneFrac && calib.anchors &&
    ((calib.background && calib.background === arenaInfo.path) ||
     (calib.id && (calib.id === arenaInfo.id || (arenaInfo.calibrationId && calib.id === arenaInfo.calibrationId))))

  if (!isValid) {
    calib = getArenaBaseline(arenaInfo, campaign)
  }
  // Ensure background path and id match selected arena
  calib = {
    ...deepClone(calib),
    id: calib.id || arenaInfo.id || arenaInfo.calibrationId || 'prologue-5x5-good',
    background: arenaInfo.path,
  }
  applyCalibration(calib)

  // 3. Sync UI inputs
  ui.authorLevelTitle.value = levelDef.title || `Этап ${idx + 1}`
  ui.authorBoardSize.value = String(levelDef.board.size || 5)
  ui.authorBoardSeed.value = String(levelDef.board.seed || 1000)
  ui.authorBlockedTap.value = String(levelDef.encounter.blockedTapDamage ?? 1)
  ui.stagePick.value = String(idx)

  renderEnemiesList()

  renderer.resize(level, draft)
  positionHandles()
  refreshPanels()
}

function renderEnemiesList() {
  const levelDef = campaign.levels[currentLevelIndex]
  if (!levelDef || !levelDef.encounter.enemies) {
    ui.authorEnemiesList.innerHTML = '<div class="muted small">No enemies defined</div>'
    return
  }

  const slotLabels = { 0: 'TOP (Center)', 1: 'RIGHT (East)', 3: 'LEFT (West)' }
  ui.authorEnemiesList.innerHTML = levelDef.encounter.enemies.map((e, i) => {
    const creature = findCreature(e.species)
    return `
      <div class="enemy-card" data-idx="${i}">
        <div class="enemy-card-header">
          <span>Enemy ${i + 1}</span>
          <span class="slot-badge">${slotLabels[e.side] ?? 'Slot ' + e.side}</span>
          ${levelDef.encounter.enemies.length > 1 ? `<button type="button" class="del-enemy-btn" data-del="${i}" title="Remove enemy">✕</button>` : ''}
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label>Creature</label>
            <select class="enemy-creature-select" data-idx="${i}">
              ${CREATURE_CATALOG.map((c) => `<option value="${c.id}" ${c.id === (e.species ?? creature.id) ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Slot</label>
            <select class="enemy-slot-select" data-idx="${i}">
              <option value="0" ${Number(e.side) === 0 ? 'selected' : ''}>TOP (Center)</option>
              <option value="1" ${Number(e.side) === 1 ? 'selected' : ''}>RIGHT</option>
              <option value="3" ${Number(e.side) === 3 ? 'selected' : ''}>LEFT</option>
            </select>
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label>HP</label>
            <input type="number" min="1" max="99" class="enemy-hp-input" data-idx="${i}" value="${e.hp ?? 2}">
          </div>
          <div class="form-group">
            <label class="chk" style="margin-top:16px;">
              <input type="checkbox" class="enemy-timer-chk" data-idx="${i}" ${e.attackTimer ? 'checked' : ''}> Attack Timer
            </label>
          </div>
        </div>
        ${e.attackTimer ? `
        <div class="timer-box">
          <div class="form-row-2">
            <div class="form-group">
              <label>Interval (turns)</label>
              <input type="number" min="1" max="20" class="enemy-interval-input" data-idx="${i}" value="${e.attackTimer.interval ?? 4}">
            </div>
            <div class="form-group">
              <label>Damage</label>
              <input type="number" min="1" max="20" class="enemy-dmg-input" data-idx="${i}" value="${e.attackTimer.damage ?? 2}">
            </div>
          </div>
        </div>` : ''}
      </div>
    `
  }).join('')

  // Wire enemy card events
  ui.authorEnemiesList.querySelectorAll('.del-enemy-btn').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute('data-del'))
      levelDef.encounter.enemies.splice(idx, 1)
      rebuildCurrentLevel()
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-creature-select').forEach((sel) => {
    sel.onchange = () => {
      const idx = Number(sel.getAttribute('data-idx'))
      const c = findCreature(sel.value)
      const target = levelDef.encounter.enemies[idx]
      target.species = c.id
      target.label = c.label
      target.hp = c.defaultHp
      target.attackTimer = c.defaultTimer ? { ...c.defaultTimer } : null
      renderEnemiesList()
      rebuildCurrentLevel()
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-slot-select').forEach((sel) => {
    sel.onchange = () => {
      const idx = Number(sel.getAttribute('data-idx'))
      levelDef.encounter.enemies[idx].side = Number(sel.value)
      rebuildCurrentLevel()
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-hp-input').forEach((inp) => {
    inp.onchange = () => {
      const idx = Number(inp.getAttribute('data-idx'))
      levelDef.encounter.enemies[idx].hp = Math.max(1, Number(inp.value) || 1)
      rebuildCurrentLevel()
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-timer-chk').forEach((chk) => {
    chk.onchange = () => {
      const idx = Number(chk.getAttribute('data-idx'))
      if (chk.checked) {
        levelDef.encounter.enemies[idx].attackTimer = { interval: 4, damage: 2 }
      } else {
        levelDef.encounter.enemies[idx].attackTimer = null
      }
      renderEnemiesList()
      rebuildCurrentLevel()
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-interval-input').forEach((inp) => {
    inp.onchange = () => {
      const idx = Number(inp.getAttribute('data-idx'))
      if (levelDef.encounter.enemies[idx].attackTimer) {
        levelDef.encounter.enemies[idx].attackTimer.interval = Math.max(1, Number(inp.value) || 1)
        rebuildCurrentLevel()
      }
    }
  })

  ui.authorEnemiesList.querySelectorAll('.enemy-dmg-input').forEach((inp) => {
    inp.onchange = () => {
      const idx = Number(inp.getAttribute('data-idx'))
      if (levelDef.encounter.enemies[idx].attackTimer) {
        levelDef.encounter.enemies[idx].attackTimer.damage = Math.max(1, Number(inp.value) || 1)
        rebuildCurrentLevel()
      }
    }
  })
}

function rebuildCurrentLevel() {
  const levelDef = campaign.levels[currentLevelIndex]
  levelDef.presentation.calibration = buildExportObject()
  levelDef.presentation.background = draft.background
  loadLevel(currentLevelIndex)
  markUnsaved()
}

function updateStagePickOptions() {
  ui.stagePick.innerHTML = ''
  campaign.levels.forEach((l, i) => {
    const size = l.board?.size ?? 5
    const seed = l.board?.seed ?? ''
    const opt = new Option(`${i + 1}. ${l.title} (${size}x${size}, s:${seed})`, String(i))
    ui.stagePick.append(opt)
  })
  ui.stagePick.value = String(currentLevelIndex)
}

function markUnsaved() {
  ui.saveBadge.className = 'save-badge unsaved'
  ui.saveBadge.textContent = 'Unsaved'
}

// ---------------------------------------------------------------------------------------------
// Handles DOM Layer

const handleEls = new Map()

function createHandles() {
  ui.handlesLayer.innerHTML = ''
  handleEls.clear()
  for (const d of HANDLE_DEFS) {
    const el = document.createElement('div')
    el.className = `handle ${d.kind}`
    el.tabIndex = 0
    el.dataset.key = d.key
    el.dataset.kind = d.kind
    el.textContent = d.short
    el.title = `${d.label} (${d.key})`
    wireHandleEvents(el, d)
    ui.handlesLayer.append(el)
    handleEls.set(d, el)
  }
}

function positionHandles() {
  if (!draft) return
  const rect = ui.stage.getBoundingClientRect()
  const w = rect.width, h = rect.height
  const showEffect = ui.toggleEffect.checked
  for (const [d, el] of handleEls) {
    if (d.kind === 'effect' && !showEffect) {
      el.classList.add('hidden-toggle')
      continue
    }
    el.classList.remove('hidden-toggle')
    const { x, y } = fracXY(d, draft)
    el.style.left = `${Math.round(x * w)}px`
    el.style.top = `${Math.round(y * h)}px`
  }
}

function wireHandleEvents(el, d) {
  let dragging = false
  function updateFromPointer(ev) {
    const rect = ui.stage.getBoundingClientRect()
    const x = (ev.clientX - rect.left) / rect.width
    const y = (ev.clientY - rect.top) / rect.height
    writeFracXY(d, draft, x, y)
    positionHandles()
    renderer.resize(level, draft)
    refreshPanels()
    markUnsaved()
  }
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    el.setPointerCapture(ev.pointerId)
    dragging = true
    selectHandle(d)
  })
  el.addEventListener('pointermove', (ev) => {
    if (dragging) updateFromPointer(ev)
  })
  function endDrag(ev) {
    if (!dragging) return
    dragging = false
    try { el.releasePointerCapture(ev.pointerId) } catch {}
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('keydown', (ev) => {
    const step = (ev.shiftKey ? 10 : 1) / (ev.key.startsWith('ArrowLeft') || ev.key.startsWith('ArrowRight') ? ui.stage.clientWidth : ui.stage.clientHeight)
    let { x, y } = fracXY(d, draft)
    if (ev.key === 'ArrowLeft') x -= step
    else if (ev.key === 'ArrowRight') x += step
    else if (ev.key === 'ArrowUp') y -= step
    else if (ev.key === 'ArrowDown') y += step
    else return
    ev.preventDefault()
    writeFracXY(d, draft, x, y)
    positionHandles()
    renderer.resize(level, draft)
    refreshPanels()
    markUnsaved()
  })
}

function selectHandle(d) {
  selected = d
  for (const [def, el] of handleEls) {
    el.classList.toggle('selected', def === d)
  }
  refreshPanels()
}

// ---------------------------------------------------------------------------------------------
// Panels and Export

function buildExportObject() {
  return {
    id: draft.id,
    background: draft.background,
    boardSizeLocked: draft.boardSizeLocked,
    boardPlaneFrac: {
      tl: [draft.boardPlaneFrac.tl[0], draft.boardPlaneFrac.tl[1]],
      tr: [draft.boardPlaneFrac.tr[0], draft.boardPlaneFrac.tr[1]],
      br: [draft.boardPlaneFrac.br[0], draft.boardPlaneFrac.br[1]],
      bl: [draft.boardPlaneFrac.bl[0], draft.boardPlaneFrac.bl[1]],
    },
    anchors: {
      top: { x: draft.anchors.top.x, y: draft.anchors.top.y },
      left: { x: draft.anchors.left.x, y: draft.anchors.left.y },
      right: { x: draft.anchors.right.x, y: draft.anchors.right.y },
    },
    effectAnchors: {
      top: { x: draft.effectAnchors.top.x, y: draft.effectAnchors.top.y },
      left: { x: draft.effectAnchors.left.x, y: draft.effectAnchors.left.y },
      right: { x: draft.effectAnchors.right.x, y: draft.effectAnchors.right.y },
    },
    actorScale: {
      top: draft.actorScale.top,
      left: draft.actorScale.left,
      right: draft.actorScale.right,
    },
    spritePivot: {
      top: { dx: draft.spritePivot.top.dx, dy: draft.spritePivot.top.dy },
      left: { dx: draft.spritePivot.left.dx, dy: draft.spritePivot.left.dy },
      right: { dx: draft.spritePivot.right.dx, dy: draft.spritePivot.right.dy },
    },
  }
}

function refreshPanels() {
  if (!draft) return
  if (selected) {
    const { x, y } = fracXY(selected, draft)
    const rect = ui.stage.getBoundingClientRect()
    ui.selectedInfo.innerHTML = `<strong>${selected.label}</strong><br>` +
      `Frac: (${x.toFixed(4)}, ${y.toFixed(4)})<br>` +
      `Px: (${Math.round(x * rect.width)}, ${Math.round(y * rect.height)})`
  }
  let table = '<tr><th>Handle</th><th>X</th><th>Y</th></tr>'
  for (const d of HANDLE_DEFS) {
    const { x, y } = fracXY(d, draft)
    const selClass = d === selected ? ' class="row-selected"' : ''
    table += `<tr${selClass}><td>${d.label}</td><td>${x.toFixed(3)}</td><td>${y.toFixed(3)}</td></tr>`
  }
  ui.valuesTable.innerHTML = table
  ui.exportText.value = JSON.stringify(buildExportObject(), null, 2)
}

function syncScaleInputs() {
  const s = draft.actorScale
  ui.scaleTop.value = String(s.top)
  ui.scaleTopNum.value = s.top.toFixed(2)
  ui.scaleLeft.value = String(s.left)
  ui.scaleLeftNum.value = s.left.toFixed(2)
  ui.scaleRight.value = String(s.right)
  ui.scaleRightNum.value = s.right.toFixed(2)
}

function wireScaleEvents() {
  function onScaleChange(side, val) {
    val = Math.max(0.1, Math.min(2.0, Math.round(val * 100) / 100))
    draft.actorScale[side] = val
    if (side === 'top') {
      ui.scaleTop.value = String(val)
      ui.scaleTopNum.value = val.toFixed(2)
    } else if (side === 'left') {
      ui.scaleLeft.value = String(val)
      ui.scaleLeftNum.value = val.toFixed(2)
      if (ui.linkSideScale.checked) {
        draft.actorScale.right = val
        ui.scaleRight.value = String(val)
        ui.scaleRightNum.value = val.toFixed(2)
      }
    } else if (side === 'right') {
      ui.scaleRight.value = String(val)
      ui.scaleRightNum.value = val.toFixed(2)
      if (ui.linkSideScale.checked) {
        draft.actorScale.left = val
        ui.scaleLeft.value = String(val)
        ui.scaleLeftNum.value = val.toFixed(2)
      }
    }
    renderer.resize(level, draft)
    refreshPanels()
    markUnsaved()
  }
  ui.scaleTop.addEventListener('input', () => onScaleChange('top', Number(ui.scaleTop.value)))
  ui.scaleTopNum.addEventListener('input', () => onScaleChange('top', Number(ui.scaleTopNum.value)))
  ui.scaleLeft.addEventListener('input', () => onScaleChange('left', Number(ui.scaleLeft.value)))
  ui.scaleLeftNum.addEventListener('input', () => onScaleChange('left', Number(ui.scaleLeftNum.value)))
  ui.scaleRight.addEventListener('input', () => onScaleChange('right', Number(ui.scaleRight.value)))
  ui.scaleRightNum.addEventListener('input', () => onScaleChange('right', Number(ui.scaleRightNum.value)))
}

function syncPivotInputs() {
  const p = draft.spritePivot
  const set = (rangeEl, numEl, v) => { rangeEl.value = String(v); numEl.value = v.toFixed(3) }
  set(ui.pivotTopX, ui.pivotTopXNum, p.top.dx)
  set(ui.pivotTopY, ui.pivotTopYNum, p.top.dy)
  set(ui.pivotLeftX, ui.pivotLeftXNum, p.left.dx)
  set(ui.pivotLeftY, ui.pivotLeftYNum, p.left.dy)
  set(ui.pivotRightX, ui.pivotRightXNum, p.right.dx)
  set(ui.pivotRightY, ui.pivotRightYNum, p.right.dy)
}

function wirePivotEvents() {
  function onPivotChange(side, axis, val, rangeEl, numEl) {
    val = Math.max(-0.3, Math.min(0.3, Math.round(val * 1000) / 1000))
    draft.spritePivot[side][axis] = val
    rangeEl.value = String(val)
    numEl.value = val.toFixed(3)
    renderer.resize(level, draft)
    refreshPanels()
    markUnsaved()
  }
  const wire = (side, axis, rangeEl, numEl) => {
    rangeEl.addEventListener('input', () => onPivotChange(side, axis, Number(rangeEl.value), rangeEl, numEl))
    numEl.addEventListener('input', () => onPivotChange(side, axis, Number(numEl.value), rangeEl, numEl))
  }
  wire('top', 'dx', ui.pivotTopX, ui.pivotTopXNum)
  wire('top', 'dy', ui.pivotTopY, ui.pivotTopYNum)
  wire('left', 'dx', ui.pivotLeftX, ui.pivotLeftXNum)
  wire('left', 'dy', ui.pivotLeftY, ui.pivotLeftYNum)
  wire('right', 'dx', ui.pivotRightX, ui.pivotRightXNum)
  wire('right', 'dy', ui.pivotRightY, ui.pivotRightYNum)
}

// ---------------------------------------------------------------------------------------------
// Toolbar and Authoring Actions Wiring

// Arena picker
// BUILD-029: appends any ARENA_CATALOG entries (built-in or user-imported via registerArena)
// that don't have an <option> yet, instead of a one-shot forEach — so imports and rehydrated
// customArenas from a loaded campaign become selectable without a page reload.
function ensureBgPickOptions() {
  const currentVal = ui.bgPick.value
  const known = new Set(Array.from(ui.bgPick.options).map((o) => o.value))
  for (const a of ARENA_CATALOG) {
    if (!known.has(a.path)) ui.bgPick.append(new Option(a.label, a.path))
  }
  if (currentVal && Array.from(ui.bgPick.options).some((o) => o.value === currentVal)) {
    ui.bgPick.value = currentVal
  }
}
ensureBgPickOptions()

// BUILD-029: re-registers arenas the user previously imported (stored on the campaign itself)
// into the shared ARENA_CATALOG + bgPick options, so a reload doesn't lose the ability to
// re-select an imported arena for another level.
function rehydrateCustomArenas() {
  for (const entry of campaign?.customArenas ?? []) {
    registerArena(entry)
    if (entry.defaultCalibration) {
      if (!campaign.arenaDefaults) campaign.arenaDefaults = {}
      campaign.arenaDefaults[entry.id] = entry.defaultCalibration
      campaign.arenaDefaults[entry.path] = entry.defaultCalibration
    }
  }
  // Also scan all campaign.levels in case an arena or background is referenced but not yet in customArenas
  for (const lvl of campaign?.levels ?? []) {
    const arenaVal = lvl.presentation?.arena
    const bgVal = lvl.presentation?.background
    if (bgVal && !ARENA_CATALOG.find((a) => a.path === bgVal || a.id === arenaVal)) {
      const entry = {
        id: arenaVal || `imported-${Date.now()}`,
        label: `Imported: ${bgVal.split('/').pop()}`,
        path: bgVal,
        suggestedSize: lvl.board?.size ?? 5,
        calibrationId: null,
      }
      registerArena(entry)
      if (!campaign.customArenas) campaign.customArenas = []
      if (!campaign.customArenas.find((a) => a.path === bgVal || a.id === entry.id)) {
        campaign.customArenas.push(entry)
      }
    }
  }
  ensureBgPickOptions()
}

ui.bgPick.onchange = () => {
  const currentLevel = campaign.levels[currentLevelIndex]
  let newCalib
  if (currentLevel) {
    newCalib = changeLevelArena(currentLevel, ui.bgPick.value, campaign)
  } else {
    const arenaInfo = findArena(ui.bgPick.value)
    const baseline = getArenaBaseline(arenaInfo, campaign)
    newCalib = {
      ...deepClone(baseline),
      id: arenaInfo.id || arenaInfo.calibrationId || 'prologue-5x5-good',
      background: arenaInfo.path,
    }
  }
  applyCalibration(newCalib)
  renderer.resize(level, draft)
  positionHandles()
  refreshPanels()
  markUnsaved()
}

// BUILD-029: Import Arena — pick a local image, write it into the project as a real asset
// (via the dev-server), register it in the same ARENA_CATALOG the built-in arenas live in, and
// apply it to the current level using the existing arena-change/calibration path so the user
// can immediately drag corners/anchors to calibrate it by hand.
function readFileAsDataUrl(file) {
  return new Promise((resolvePromise, rejectPromise) => {
    const reader = new FileReader()
    reader.onload = () => resolvePromise(String(reader.result))
    reader.onerror = () => rejectPromise(reader.error ?? new Error('failed to read file'))
    reader.readAsDataURL(file)
  })
}

function slugifyArenaName(name) {
  const base = String(name).replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'arena'
}

function setImportStatus(kind, text) {
  ui.importArenaStatus.className = kind ? `import-status ${kind}` : 'import-status'
  ui.importArenaStatus.textContent = text
}

async function importArenaFile(file) {
  setImportStatus('', `Importing "${file.name}"…`)
  const dataUrl = await readFileAsDataUrl(file)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  let path = null
  let savedToFile = false
  try {
    const res = await fetch('/api/assets/import-arena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, dataBase64: base64 }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok && data.path) {
      path = data.path
      savedToFile = true
    }
  } catch {
    // dev-server unreachable — fall through to the explicit browser-only fallback below.
  }

  // Explicit fallback (BUILD-026 precedent): if the project file couldn't be written, keep the
  // arena usable this session via an inline dataURL rather than silently failing, but say so.
  if (!path) path = dataUrl

  const currentBoardSize = campaign?.levels?.[currentLevelIndex]?.board?.size ?? 5
  const entry = {
    id: `imported-${slugifyArenaName(file.name)}-${Date.now()}`,
    label: savedToFile ? `Imported: ${file.name}` : `Imported (session only): ${file.name}`,
    path,
    suggestedSize: currentBoardSize,
    calibrationId: null,
  }
  registerArena(entry)
  ensureBgPickOptions()

  if (!campaign.customArenas) campaign.customArenas = []
  if (savedToFile) {
    // Only persist entries that point at a real project file — an inline dataURL fallback would
    // bloat campaign.json with embedded image bytes, so that case stays session-only by design.
    campaign.customArenas.push(entry)
  }

  ui.bgPick.value = entry.path
  ui.bgPick.onchange()

  setImportStatus(
    savedToFile ? 'ok' : 'warn',
    savedToFile
      ? `Imported "${file.name}" -> now drag the board corners/anchors to calibrate, then Save.`
      : `Import server unavailable — using "${file.name}" for this browser session only (not written to a project file). Calibrate now; Save will not keep the image itself.`,
  )
  markUnsaved()
}

ui.importArenaBtn.onclick = () => ui.importArenaInput.click()
ui.importArenaInput.onchange = async () => {
  const file = ui.importArenaInput.files?.[0]
  ui.importArenaInput.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    setImportStatus('warn', 'Please choose an image file (PNG/JPEG/WEBP).')
    return
  }
  try {
    await importArenaFile(file)
  } catch (err) {
    setImportStatus('warn', `Import failed: ${err.message ?? err}`)
  }
}

// Stage / Level selector
ui.stagePick.onchange = () => {
  const idx = Number(ui.stagePick.value)
  if (!Number.isNaN(idx)) loadLevel(idx)
}

// Title change
ui.authorLevelTitle.oninput = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (levelDef) {
    levelDef.title = ui.authorLevelTitle.value
    updateStagePickOptions()
    markUnsaved()
  }
}

// Board Size change (Square-only)
ui.authorBoardSize.onchange = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (levelDef) {
    const s = Number(ui.authorBoardSize.value)
    levelDef.board.size = s
    levelDef.board.preset = `square-${s}`
    rebuildCurrentLevel()
    updateStagePickOptions()
  }
}

// Board Seed change & Roll
ui.authorBoardSeed.onchange = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (levelDef) {
    levelDef.board.seed = Number(ui.authorBoardSeed.value) || 1
    rebuildCurrentLevel()
    updateStagePickOptions()
  }
}
ui.rollSeedBtn.onclick = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (levelDef) {
    levelDef.board.seed = Math.floor(Math.random() * 9000) + 1000
    ui.authorBoardSeed.value = String(levelDef.board.seed)
    rebuildCurrentLevel()
    updateStagePickOptions()
  }
}

// Blocked Tap Damage
ui.authorBlockedTap.onchange = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (levelDef) {
    levelDef.encounter.blockedTapDamage = Number(ui.authorBlockedTap.value)
    markUnsaved()
  }
}

// + Add Enemy (STRICT RULE: center/top is default first slot)
ui.authorAddEnemyBtn.onclick = () => {
  const levelDef = campaign.levels[currentLevelIndex]
  if (!levelDef.encounter.enemies) levelDef.encounter.enemies = []
  if (levelDef.encounter.enemies.length >= 3) {
    alert('Maximum 3 actor slots (TOP, RIGHT, LEFT) supported')
    return
  }
  const nextSide = getNextAvailableSide(levelDef.encounter.enemies)
  const defaultCreature = findCreature('dire-wolf')
  levelDef.encounter.enemies.push({
    id: `mob_${Date.now() % 10000}`,
    species: defaultCreature.id,
    label: defaultCreature.label,
    side: nextSide, // center-first slot!
    hp: defaultCreature.defaultHp,
    attackTimer: defaultCreature.defaultTimer ? { ...defaultCreature.defaultTimer } : null,
  })
  rebuildCurrentLevel()
}

// + Level
ui.newLevelBtn.onclick = () => {
  const newIdx = campaign.levels.length + 1
  const newLvl = createDefaultLevel(newIdx, 5)
  campaign.levels.push(newLvl)
  updateStagePickOptions()
  loadLevel(campaign.levels.length - 1)
  markUnsaved()
}

// Duplicate Level
ui.btnDupLevel.onclick = () => {
  const current = campaign.levels[currentLevelIndex]
  if (!current) return
  const dup = deepClone(current)
  dup.id = `stage-${campaign.levels.length + 1}`
  dup.title = `${current.title} (Copy)`
  dup.board.seed = Number(current.board.seed) + 11
  campaign.levels.splice(currentLevelIndex + 1, 0, dup)
  updateStagePickOptions()
  loadLevel(currentLevelIndex + 1)
  markUnsaved()
}

// Delete Level
ui.btnDelLevel.onclick = () => {
  if (campaign.levels.length <= 1) {
    alert('Cannot delete the last remaining level')
    return
  }
  campaign.levels.splice(currentLevelIndex, 1)
  const nextIdx = Math.min(currentLevelIndex, campaign.levels.length - 1)
  updateStagePickOptions()
  loadLevel(nextIdx)
  markUnsaved()
}

// Move Up
ui.btnMoveUp.onclick = () => {
  if (currentLevelIndex <= 0) return
  const temp = campaign.levels[currentLevelIndex]
  campaign.levels[currentLevelIndex] = campaign.levels[currentLevelIndex - 1]
  campaign.levels[currentLevelIndex - 1] = temp
  currentLevelIndex--
  updateStagePickOptions()
  loadLevel(currentLevelIndex)
  markUnsaved()
}

// Move Down
ui.btnMoveDown.onclick = () => {
  if (currentLevelIndex >= campaign.levels.length - 1) return
  const temp = campaign.levels[currentLevelIndex]
  campaign.levels[currentLevelIndex] = campaign.levels[currentLevelIndex + 1]
  campaign.levels[currentLevelIndex + 1] = temp
  currentLevelIndex++
  updateStagePickOptions()
  loadLevel(currentLevelIndex)
  markUnsaved()
}

// ---------------------------------------------------------------------------------------------
// Persistence Actions

async function executeSave() {
  const currentLevel = campaign.levels[currentLevelIndex]
  if (currentLevel) {
    const arenaInfo = findArena(draft.background)
    currentLevel.presentation = {
      ...currentLevel.presentation,
      arena: arenaInfo?.id ?? currentLevel.presentation?.arena ?? draft.id,
      background: draft.background,
      calibration: buildExportObject(),
    }
  }
  ui.saveBadge.className = 'save-badge'
  ui.saveBadge.textContent = 'Saving...'

  const res = await saveCampaign(campaign)
  if (res.fileSaved) {
    ui.saveBadge.className = 'save-badge saved-file'
    ui.saveBadge.textContent = `✔ Saved to ${res.filePath} & storage`
  } else if (res.storageSaved) {
    ui.saveBadge.className = 'save-badge saved-storage'
    ui.saveBadge.textContent = '⚠ Saved to browser storage only'
  } else {
    ui.saveBadge.className = 'save-badge unsaved'
    ui.saveBadge.textContent = '✕ Save failed'
  }
  return res
}

ui.saveStorageBtn.onclick = executeSave

ui.saveArenaDefaultBtn.onclick = async () => {
  const currentLevel = campaign.levels[currentLevelIndex]
  const arenaInfo = findArena(draft.background || currentLevel?.presentation?.arena)
  if (!arenaInfo) return

  const exportCalib = buildExportObject()
  if (!campaign.arenaDefaults) campaign.arenaDefaults = {}
  campaign.arenaDefaults[arenaInfo.id] = deepClone(exportCalib)
  campaign.arenaDefaults[arenaInfo.path] = deepClone(exportCalib)

  const customEntry = campaign.customArenas?.find((a) => a.id === arenaInfo.id || a.path === arenaInfo.path)
  if (customEntry) {
    customEntry.defaultCalibration = deepClone(exportCalib)
  }
  arenaInfo.defaultCalibration = deepClone(exportCalib)
  saveArenaCalibrationOverride(arenaInfo.id, exportCalib)

  if (currentLevel) {
    currentLevel.presentation = {
      ...currentLevel.presentation,
      arena: arenaInfo.id,
      background: arenaInfo.path,
      calibration: deepClone(exportCalib),
    }
  }

  await executeSave()
  ui.saveBadge.className = 'save-badge saved-file'
  ui.saveBadge.textContent = `★ Default saved for ${arenaInfo.label}`
  setTimeout(() => {
    if (ui.saveBadge.textContent.startsWith('★ Default saved')) {
      ui.saveBadge.textContent = 'Saved'
    }
  }, 3500)
}

ui.clearStorageBtn.onclick = async () => {
  const loaded = await loadCampaign()
  campaign = loaded.campaign
  rehydrateCustomArenas()
  updateStagePickOptions()
  loadLevel(currentLevelIndex < campaign.levels.length ? currentLevelIndex : 0)
  ui.saveBadge.className = 'save-badge saved-file'
  ui.saveBadge.textContent = `Reloaded (${loaded.source})`
}

ui.playLevelBtn.onclick = async () => {
  await executeSave()
  window.location.href = `./index.html?mode=authored&stage=${currentLevelIndex}`
}

ui.playCampaignBtn.onclick = async () => {
  await executeSave()
  window.location.href = `./index.html?mode=authored&stage=0`
}

ui.copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(ui.exportText.value)
    ui.copyStatus.textContent = 'Copied calibration to clipboard.'
  } catch {
    ui.copyStatus.textContent = 'Clipboard blocked — copy text manually.'
  }
  setTimeout(() => { ui.copyStatus.textContent = '' }, 3000)
}

ui.downloadBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `campaign.json`
  a.click()
  URL.revokeObjectURL(url)
}

ui.resetBtn.onclick = () => {
  draft = deepClone(original)
  setBackground(draft.background)
  syncBgPick()
  syncScaleInputs()
  syncPivotInputs()
  selected = null
  for (const el of handleEls.values()) el.classList.remove('selected')
  renderer.resize(level, draft)
  positionHandles()
  refreshPanels()
}

// ---------------------------------------------------------------------------------------------
// Render loop

function tickWolves(now) {
  if (!wolfVisuals) return
  for (const e of encounterState.enemies) {
    const snap = readEnemySnapshot(e)
    const v = wolfVisuals.get(e.id)
    if (v) wolfVisuals.set(e.id, tickEnemyVisual(v, now, snap))
  }
}

function loop(now) {
  requestAnimationFrame(loop)
  if (!draft || !level || !def) return
  if (bossVisual) bossVisual = tickBossVisual(bossVisual, now, readBossSnapshot(encounterState, def))
  tickWolves(now)
  const frameLevel = ui.toggleArrows.checked ? level : { ...level, arrows: [] }
  const showSprites = ui.toggleSprites.checked
  renderer.frame(now, {
    s: encounterState, def, level: frameLevel, assets,
    hint: null,
    boss: (bossVisual && showSprites) ? { pack: bossPack, visual: bossVisual } : null,
    wolf: (wolfVisuals && showSprites) ? { pack: wolfPack, packsBySpecies: enemyPacksBySpecies, visuals: wolfVisuals } : null,
    debug: ui.toggleGrid.checked,
  })
}
requestAnimationFrame(loop)

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (!draft || !level) return
    renderer.resize(level, draft)
    positionHandles()
  }).observe(ui.stage)
} else {
  window.addEventListener('resize', () => {
    if (!draft || !level) return
    renderer.resize(level, draft)
    positionHandles()
  })
}

// ---------------------------------------------------------------------------------------------
// Initialization

createHandles()
wireScaleEvents()
wirePivotEvents()

const loadedCampaignInfo = await loadCampaign()
campaign = loadedCampaignInfo.campaign
rehydrateCustomArenas()
updateStagePickOptions()

const hashParams = new URLSearchParams(location.hash.slice(1))
const queryParams = new URLSearchParams(location.search)
const initialStageIdx = Number(queryParams.get('stage') ?? hashParams.get('stage') ?? 0)

await loadLevel(initialStageIdx)

if (loadedCampaignInfo.source === 'file') {
  ui.saveBadge.className = 'save-badge saved-file'
  ui.saveBadge.textContent = 'Loaded from file'
} else if (loadedCampaignInfo.source === 'storage') {
  ui.saveBadge.className = 'save-badge saved-storage'
  ui.saveBadge.textContent = 'Loaded from browser storage'
} else {
  ui.saveBadge.className = 'save-badge'
  ui.saveBadge.textContent = 'New campaign'
}

// Debug hook for testing / automation
window.calibrationEditorDebug = {
  draft: () => draft,
  original: () => original,
  campaign: () => campaign,
  currentLevelIndex: () => currentLevelIndex,
  exportObject: () => buildExportObject(),
  loadLevel,
  addNewLevel: () => ui.newLevelBtn.click(),
  duplicateLevel: () => ui.btnDupLevel.click(),
  deleteLevel: () => ui.btnDelLevel.click(),
  moveLevelUp: () => ui.btnMoveUp.click(),
  moveLevelDown: () => ui.btnMoveDown.click(),
  addEnemy: () => ui.authorAddEnemyBtn.click(),
  save: executeSave,
  saveArenaDefault: () => ui.saveArenaDefaultBtn.click(),
  getLayout: () => renderer.debugLayout(),
  setArena: (idOrPath) => {
    const arena = findArena(idOrPath)
    ui.bgPick.value = arena.path
    ui.bgPick.onchange()
  },
  // BUILD-029: native file-picker dialogs can't be automated headlessly, so tests/automation
  // drive the same import path directly with a constructed File.
  importArenaFile,
}
