// CAL-001/CAL-004: visual arena calibration editor. A standalone debug/tool page (never wired into
// the production HUD/index.html) so calibrating a baked-grid arena's board-plane corners and
// actor/effect anchors is a drag-and-type task instead of a hand-edit-arena-calibration.js-and-
// reload loop.
//
// GEOMETRY CONTRACT (per the CAL-001 task card): this tool must use the exact same production
// geometry every real playthrough uses, not a separate approximation. Concretely:
//  - the whole arena/grid/sprite/arrow render below is `board-renderer.js`'s own `createBoardRenderer`
//    (the same module `app.js` drives) -- so the grid mesh comes from `board-plane.js`'s
//    project()/fitGrid()/gridLineToScreen(), and sprite placement comes from `arena-layout.js`'s
//    podiumSlot()/effectGround(), exactly as a real scene renders them.
//  - the only things this file adds are: (1) DOM drag/keyboard handles that read/write the
//    calibration draft's own stage-fraction numbers (a handle's screen position is that same
//    fraction times the stage size -- board-plane.js's own `planeCornersPx`/`podiumSlot`/
//    `effectGround` do the identical `frac * stageSize` math), and (2) the export/copy panel.
//
// CAL-004: the editor now has two content modes (see `mode` below):
//  - 'stage' (primary, `#stagePick`): loads one of the 5 canon Prologue steps' own real board/seed
//    and def via prologue-steps.js's getStep() -- the exact same content and shape (boss vs
//    enemies) app.js's loadActiveStep() would show for that step, calibrated against its own
//    independent ARENA_CALIBRATIONS entry (see PROLOGUE_STAGE_CALIBRATION).
//  - 'debug' (secondary, `#arenaPick`): the original CAL-001/FIX-023 path -- a freshly generated
//    board of the chosen grid size plus a throwaway 3-side preview encounter (TOP/LEFT/RIGHT), for
//    calibrating a non-Prologue arena that has no real encounter yet (currently boss-shadow-moon).
import { EncounterState, generateLevel, PRESETS } from '../../dist/src/index.js'
import { ASSET_MANIFEST, BOSS_MANIFESTS, bossSpeciesFor, loadAssets, loadBossPack, loadWolfPack } from './assets.js'
import { ARENA_CALIBRATIONS, clearArenaCalibrationOverride, getArenaCalibration, hasArenaCalibrationOverride, saveArenaCalibrationOverride } from './arena-calibration.js'
import { createBoardRenderer } from './board-renderer.js'
import { appearEnemyVisual, readEnemySnapshot, tickEnemyVisual } from './enemy-visual-state.js'
import { appearBossVisual, readBossSnapshot, tickBossVisual } from './boss-visual-state.js'
import { getStep, SEQUENCE_STEPS } from './prologue-steps.js'

// CAL-004: which ARENA_CALIBRATIONS entry backs each canon Prologue step -- see that file's
// CAL-004 comment. Kept here (not in prologue-steps.js) because it's a calibration-editor-only
// concern: the production game resolves calibration from each encounter JSON's own `presentation`
// block, never from this table.
const PROLOGUE_STAGE_CALIBRATION = {
  'prologue-5x5': 'prologue-5x5-good',
  'cp-e2': 'prologue-2',
  'cp-e3': 'prologue-3',
  'cp-e4': 'prologue-4',
  'cp-e5': 'prologue-5',
}

// CAL-004: every arena background PNG that actually exists in the repo today -- the "available
// game arena assets" a stage's background can be switched to. Adding a real new arena image later
// is a one-line addition here, not a calibration-editor.js code change.
const ARENA_ASSETS = [
  { id: 'moonlit-fortress', label: 'Moonlit Fortress (flexible dais)', path: 'assets/arena-moonlit-fortress.png' },
  { id: '5x5-good', label: '5x5-good (baked 5x5 grid)', path: 'assets/arenas/prologue-act1/5x5-good.png' },
  { id: '6x6-5', label: '6x6-5 / boss-shadow-moon (baked 6x6 grid)', path: 'assets/arenas/prologue-act1/6x6-5.png' },
]

const $ = (id) => document.getElementById(id)
const ui = {
  stagePick: $('stagePick'), bgPick: $('bgPick'), arenaPick: $('arenaPick'), gridSizePick: $('gridSizePick'),
  toggleGrid: $('toggleGrid'), toggleArrows: $('toggleArrows'), toggleSprites: $('toggleSprites'), toggleEffect: $('toggleEffect'),
  resetBtn: $('resetBtn'), saveStorageBtn: $('saveStorageBtn'), clearStorageBtn: $('clearStorageBtn'), copyBtn: $('copyBtn'), downloadBtn: $('downloadBtn'),
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

// CAL-001/FIX-023 legacy debug-arena preview: three non-mandatory 1-hp "enemies" on TOP(N)/
// LEFT(W)/RIGHT(E) so board-renderer.js's real drawTarget draws a real sprite at each of the three
// anchor sides at once, for calibrating an arena that has no real Prologue content of its own
// (e.g. `boss-shadow-moon`, a debug-only baked-grid arena). Never a real encounter (not in
// encounters/, not reachable from app.js) -- purely a fixture so EncounterState has valid enemies
// to report through `collectTargets`. CAL-004: Prologue stages 1-5 no longer use this -- they load
// their own real board/def via prologue-steps.js's getStep(), see loadStage() below.
const DEBUG_PREVIEW_DEF = {
  id: 'cal-001-preview',
  enemies: [
    { id: 'cal_top', side: 0, hp: 1, mandatory: false, label: 'TOP' },
    { id: 'cal_left', side: 3, hp: 1, mandatory: false, label: 'LEFT' },
    { id: 'cal_right', side: 1, hp: 1, mandatory: false, label: 'RIGHT' },
  ],
  rotate: { allow: [] },
  blockedTapDamage: 0,
}

const renderer = createBoardRenderer(ui.canvas, ui.stage)
const assets = await loadAssets(ASSET_MANIFEST)
const wolfPack = await loadWolfPack()
// CAL-004: only 'goblin-shaman' backs any current Prologue boss (cp-e5's miniboss_placeholder via
// assets.js's bossSpeciesFor), but load both packs like app.js does for the same future-proofing.
const bossPacks = {
  'goblin-shaman': await loadBossPack(BOSS_MANIFESTS['goblin-shaman']),
  'goblin-taunter': await loadBossPack(BOSS_MANIFESTS['goblin-taunter']),
}

// ---------------------------------------------------------------------------------------------
// Handle definitions: one entry per draggable point. `fmt` says whether the underlying
// arena-calibration.js field is the `[u, v]` array shape (board-plane corners) or the `{x, y}`
// object shape (anchors/effectAnchors) -- getRaw/setRaw read/write the draft in that native shape
// so the exported object round-trips byte-for-byte into arena-calibration.js's own format.

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

function fracXY(def, d) {
  const v = def.getRaw(d)
  return def.fmt === 'arr' ? { x: v[0], y: v[1] } : { x: v.x, y: v.y }
}
function writeFracXY(def, d, x, y) {
  x = clamp01(x); y = clamp01(y)
  def.setRaw(d, def.fmt === 'arr' ? [x, y] : { x, y })
}

// ---------------------------------------------------------------------------------------------
// State: `original` is the last loaded/reset snapshot (what Reset returns to); `draft` is the
// live-edited copy. Neither ever touches ARENA_CALIBRATIONS itself -- the only way a change
// reaches arena-calibration.js is the user pasting the Copy/Download output in by hand, per the
// task's "не менять prologue-5x5-good автоматически" requirement.
const deepClone = (v) => JSON.parse(JSON.stringify(v))

let draft = null
let original = null
let level = null
let def = null
let encounterState = null
let wolfVisuals = null
let bossVisual = null
let bossPack = null
let selected = null

// CAL-004: which content is currently loaded -- 'stage' (a real canon Prologue step, via
// prologue-steps.js) or 'debug' (the legacy CAL-001/FIX-023 synthetic 3-side preview on a
// non-Prologue calibration id, e.g. boss-shadow-moon). Both modes share the same draft/original/
// handle/save-load machinery below; only how level/def/actor-visuals are populated differs.
let mode = 'stage'
let currentStageKey = null
let currentDebugId = null

const levelCache = new Map()
function levelForSize(n) {
  if (levelCache.has(n)) return levelCache.get(n)
  let found = null
  for (let seed = 1; seed <= 8 && !found; seed++) {
    const gen = generateLevel({ ...PRESETS.medium, width: n, height: n, minArrows: Math.max(4, Math.round(n * n * 0.12)) }, seed)
    if (gen.ok && gen.level) found = gen.level
  }
  if (!found) throw new Error(`calibration-editor: could not generate a ${n}x${n} preview board`)
  levelCache.set(n, found)
  return found
}

/** CAL-004: (re)derive boss/wolf presentation-only visual state from whatever `def` is currently
 * active (real Prologue def in stage mode, DEBUG_PREVIEW_DEF in debug mode) -- mirrors app.js's
 * own boss-mode-vs-enemies-mode branch in loadActiveStep(). */
function setupActorVisuals() {
  bossVisual = null
  bossPack = null
  wolfVisuals = null
  if (def.boss) {
    bossPack = bossPacks[bossSpeciesFor(def.boss.id)]
    bossVisual = appearBossVisual(performance.now())
  } else if (def.enemies) {
    wolfVisuals = new Map()
    for (const e of encounterState.enemies) wolfVisuals.set(e.id, appearEnemyVisual(performance.now()))
  }
}

/** Legacy CAL-001/FIX-023 debug-arena content: a freshly generated square board of
 * `draft.boardSizeLocked` plus the synthetic 3-side DEBUG_PREVIEW_DEF. */
function rebuildDebugEncounter() {
  level = levelForSize(draft.boardSizeLocked)
  def = DEBUG_PREVIEW_DEF
  encounterState = EncounterState.fromLevel(level, def, 9999, null)
  setupActorVisuals()
  renderer.resetFx()
  renderer.resize(level, draft)
}

/** CAL-004: load a real canon Prologue step's own board/def (exactly what app.js's loadActiveStep
 * would show for the same step) plus its own independent calibration -- see
 * PROLOGUE_STAGE_CALIBRATION and arena-calibration.js's CAL-004 entries. */
async function loadStage(stepKey) {
  const sceneDef = SEQUENCE_STEPS.find((s) => s.key === stepKey)
  if (!sceneDef) return
  const step = await getStep(sceneDef)
  mode = 'stage'
  currentStageKey = stepKey
  level = step.level
  def = step.def
  encounterState = EncounterState.fromLevel(level, def, 9999, null)
  setupActorVisuals()
  renderer.resetFx()
  const calibId = PROLOGUE_STAGE_CALIBRATION[stepKey]
  applyCalibration(getArenaCalibration(calibId))
  // Keep the toolbar in sync even when loadStage() is invoked directly (URL hash, debug hook)
  // rather than through stagePick's own onchange.
  ui.stagePick.value = stepKey
  ui.arenaPick.value = ''
  ui.gridSizePick.closest('label').style.display = 'none'
  renderer.resize(level, draft)
  positionHandles()
  refreshPanels()
}

/** Legacy CAL-001/FIX-023 path: calibrate a non-Prologue debug arena (currently just
 * `boss-shadow-moon`) against the synthetic 3-side preview board, same as before CAL-004. */
function loadDebugArena(calibId) {
  const calib = getArenaCalibration(calibId)
  if (!calib) return
  mode = 'debug'
  currentDebugId = calibId
  applyCalibration(calib)
  // Same self-sync as loadStage() above.
  ui.arenaPick.value = calibId
  ui.stagePick.value = ''
  ui.gridSizePick.closest('label').style.display = ''
  ui.gridSizePick.value = String(draft.boardSizeLocked)
  rebuildDebugEncounter()
  positionHandles()
  refreshPanels()
}

/** Re-run whichever content path is currently active (stage vs debug), e.g. after Reset/Clear
 * override change `draft`/`original` underneath and need level/def/visuals refreshed too. */
function refreshActiveContent() {
  if (mode === 'stage') {
    encounterState = EncounterState.fromLevel(level, def, 9999, null)
    setupActorVisuals()
    renderer.resetFx()
    renderer.resize(level, draft)
  } else {
    ui.gridSizePick.value = String(draft.boardSizeLocked)
    rebuildDebugEncounter()
  }
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
    val = Math.max(0.5, Math.min(2.0, Math.round(val * 100) / 100))
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
  }

  ui.scaleTop.addEventListener('input', () => onScaleChange('top', Number(ui.scaleTop.value)))
  ui.scaleTopNum.addEventListener('input', () => {
    const v = Number(ui.scaleTopNum.value)
    if (Number.isFinite(v)) onScaleChange('top', v)
  })

  ui.scaleLeft.addEventListener('input', () => onScaleChange('left', Number(ui.scaleLeft.value)))
  ui.scaleLeftNum.addEventListener('input', () => {
    const v = Number(ui.scaleLeftNum.value)
    if (Number.isFinite(v)) onScaleChange('left', v)
  })

  ui.scaleRight.addEventListener('input', () => onScaleChange('right', Number(ui.scaleRight.value)))
  ui.scaleRightNum.addEventListener('input', () => {
    const v = Number(ui.scaleRightNum.value)
    if (Number.isFinite(v)) onScaleChange('right', v)
  })
}

// PLAYTEST-002: sprite pivot/foot-offset rows -- same range+number pairing pattern as actor
// scale above, one pair per side per axis (dx/dy), no link checkbox (each side is independently
// wrong or right, unlike LEFT/RIGHT actor scale which is usually symmetric).
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
  }
  function wireRow(side, axis, rangeEl, numEl) {
    rangeEl.addEventListener('input', () => onPivotChange(side, axis, Number(rangeEl.value), rangeEl, numEl))
    numEl.addEventListener('input', () => {
      const v = Number(numEl.value)
      if (Number.isFinite(v)) onPivotChange(side, axis, v, rangeEl, numEl)
    })
  }
  wireRow('top', 'dx', ui.pivotTopX, ui.pivotTopXNum)
  wireRow('top', 'dy', ui.pivotTopY, ui.pivotTopYNum)
  wireRow('left', 'dx', ui.pivotLeftX, ui.pivotLeftXNum)
  wireRow('left', 'dy', ui.pivotLeftY, ui.pivotLeftYNum)
  wireRow('right', 'dx', ui.pivotRightX, ui.pivotRightXNum)
  wireRow('right', 'dy', ui.pivotRightY, ui.pivotRightYNum)
}

/** CAL-004: load an ARENA_CALIBRATIONS entry into `draft`/`original` and sync every side-panel
 * control to it -- shared by both loadStage() (real Prologue content) and loadDebugArena() (legacy
 * synthetic preview). Never touches which level/def/actor-visuals are active; callers do that
 * themselves before/after, since it differs by mode. */
function applyCalibration(calib) {
  if (!calib) return
  original = deepClone(calib)
  if (!original.effectAnchors) original.effectAnchors = deepClone(original.anchors) // defensive, see arena-calibration.d.ts
  if (!original.actorScale) original.actorScale = { top: 1.0, left: 1.0, right: 1.0 }
  else {
    original.actorScale = {
      top: original.actorScale.top ?? 1.0,
      left: original.actorScale.left ?? 1.0,
      right: original.actorScale.right ?? 1.0,
    }
  }
  // PLAYTEST-002: same defensive defaulting as actorScale above, for calibrations saved before
  // spritePivot existed.
  original.spritePivot = {
    top: { dx: original.spritePivot?.top?.dx ?? 0, dy: original.spritePivot?.top?.dy ?? 0 },
    left: { dx: original.spritePivot?.left?.dx ?? 0, dy: original.spritePivot?.left?.dy ?? 0 },
    right: { dx: original.spritePivot?.right?.dx ?? 0, dy: original.spritePivot?.right?.dy ?? 0 },
  }
  draft = deepClone(original)
  setBackground(draft.background)
  syncBgPick()
  syncScaleInputs()
  syncPivotInputs()
  selected = null
}

function setBackground(path) {
  ui.bgLayer.style.setProperty('--bg-image', `url(${path})`)
  ui.bgLayer.classList.add('has-image')
}

/** CAL-004: reflect `draft.background` in the arena/background dropdown -- falls back to a
 * synthesized "custom" option (not persisted to ARENA_ASSETS) if the path doesn't match any known
 * asset, e.g. a hand-edited/imported calibration. */
function syncBgPick() {
  let opt = [...ui.bgPick.options].find((o) => o.value === draft.background)
  if (!opt) {
    opt = new Option(`custom (${draft.background})`, draft.background)
    ui.bgPick.append(opt)
  }
  ui.bgPick.value = draft.background
}

// ---------------------------------------------------------------------------------------------
// Handles: DOM overlay, created once; only their position/selection state changes per arena.

const handleEls = new Map()
function createHandles() {
  for (const def of HANDLE_DEFS) {
    const el = document.createElement('div')
    el.className = `handle ${def.kind}`
    el.tabIndex = 0
    el.title = `${def.label} — drag, or focus + arrow keys (1px, Shift = 10px)`
    el.textContent = def.short
    el.setAttribute('role', 'slider')
    el.setAttribute('aria-label', def.label)
    wireHandleEvents(el, def)
    ui.handlesLayer.append(el)
    handleEls.set(`${def.kind}:${def.key}`, el)
  }
}

function wireHandleEvents(el, def) {
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    selectHandle(def)
    el.setPointerCapture(ev.pointerId)
    const move = (mv) => {
      const rect = ui.stage.getBoundingClientRect()
      writeFracXY(def, draft, (mv.clientX - rect.left) / rect.width, (mv.clientY - rect.top) / rect.height)
      positionHandles()
      renderer.resize(level, draft)
      refreshPanels()
    }
    const up = (uv) => {
      el.releasePointerCapture(uv.pointerId)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  })
  el.addEventListener('focus', () => selectHandle(def))
  el.addEventListener('keydown', (ev) => {
    let dx = 0, dy = 0
    if (ev.key === 'ArrowLeft') dx = -1
    else if (ev.key === 'ArrowRight') dx = 1
    else if (ev.key === 'ArrowUp') dy = -1
    else if (ev.key === 'ArrowDown') dy = 1
    else return
    ev.preventDefault()
    const step = ev.shiftKey ? 10 : 1
    selectHandle(def)
    const rect = ui.stage.getBoundingClientRect()
    const cur = fracXY(def, draft)
    writeFracXY(def, draft, cur.x + (dx * step) / rect.width, cur.y + (dy * step) / rect.height)
    positionHandles()
    renderer.resize(level, draft)
    refreshPanels()
  })
}

function selectHandle(def) {
  selected = def
  for (const [k, el] of handleEls) el.classList.toggle('selected', k === `${def.kind}:${def.key}`)
  refreshPanels()
}

function positionHandles() {
  const rect = ui.stage.getBoundingClientRect()
  for (const def of HANDLE_DEFS) {
    const el = handleEls.get(`${def.kind}:${def.key}`)
    const xy = fracXY(def, draft)
    el.style.left = `${xy.x * rect.width}px`
    el.style.top = `${xy.y * rect.height}px`
    el.classList.toggle('hidden-toggle', def.kind === 'effect' && !ui.toggleEffect.checked)
  }
}

// ---------------------------------------------------------------------------------------------
// Side panel: selected-handle readout + full values table + live export text.

const swatchVar = (kind) => (kind === 'corner' ? 'corner' : kind === 'actor' ? 'actor' : 'effect')

function refreshPanels() {
  updateSelectedInfo()
  updateValuesTable()
  updateExportText()
}

function updateSelectedInfo() {
  if (!selected) {
    ui.selectedInfo.textContent = '— click or tab to a handle —'
    return
  }
  const xy = fracXY(selected, draft)
  const rect = ui.stage.getBoundingClientRect()
  ui.selectedInfo.innerHTML =
    `<span class="dot" style="background:var(--${swatchVar(selected.kind)})"></span><strong>${selected.label}</strong><br>` +
    `px: ${(xy.x * rect.width).toFixed(1)}, ${(xy.y * rect.height).toFixed(1)}<br>` +
    `frac: ${xy.x.toFixed(4)}, ${xy.y.toFixed(4)}`
}

function updateValuesTable() {
  const rect = ui.stage.getBoundingClientRect()
  const rows = HANDLE_DEFS.map((def) => {
    const xy = fracXY(def, draft)
    const isSel = selected === def
    return `<tr class="${isSel ? 'row-selected' : ''}">` +
      `<td><span class="swatch" style="background:var(--${swatchVar(def.kind)})"></span>${def.label}</td>` +
      `<td>${(xy.x * rect.width).toFixed(1)}, ${(xy.y * rect.height).toFixed(1)}</td>` +
      `<td>${xy.x.toFixed(4)}, ${xy.y.toFixed(4)}</td></tr>`
  }).join('')
  const s = draft?.actorScale ?? { top: 1.0, left: 1.0, right: 1.0 }
  const scaleRows = [
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>TOP actor scale</td><td>—</td><td>${s.top.toFixed(2)}x</td></tr>`,
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>LEFT actor scale</td><td>—</td><td>${s.left.toFixed(2)}x</td></tr>`,
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>RIGHT actor scale</td><td>—</td><td>${s.right.toFixed(2)}x</td></tr>`,
  ].join('')
  const p = draft?.spritePivot ?? { top: { dx: 0, dy: 0 }, left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } }
  const pivotRows = [
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>TOP sprite pivot</td><td>—</td><td>dx ${p.top.dx.toFixed(3)}, dy ${p.top.dy.toFixed(3)}</td></tr>`,
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>LEFT sprite pivot</td><td>—</td><td>dx ${p.left.dx.toFixed(3)}, dy ${p.left.dy.toFixed(3)}</td></tr>`,
    `<tr><td><span class="swatch" style="background:var(--actor)"></span>RIGHT sprite pivot</td><td>—</td><td>dx ${p.right.dx.toFixed(3)}, dy ${p.right.dy.toFixed(3)}</td></tr>`,
  ].join('')
  ui.valuesTable.innerHTML = `<tr><th>handle</th><th>px (x, y)</th><th>frac / scale</th></tr>${rows}${scaleRows}${pivotRows}`
}

const round4 = (n) => Math.round(n * 10000) / 10000

function buildExportObject() {
  const c = draft.boardPlaneFrac
  const a = draft.anchors
  const e = draft.effectAnchors
  const s = draft.actorScale
  const p = draft.spritePivot
  return {
    id: draft.id,
    background: draft.background,
    boardSizeLocked: draft.boardSizeLocked,
    boardPlaneFrac: {
      tl: [round4(c.tl[0]), round4(c.tl[1])], tr: [round4(c.tr[0]), round4(c.tr[1])],
      br: [round4(c.br[0]), round4(c.br[1])], bl: [round4(c.bl[0]), round4(c.bl[1])],
    },
    anchors: {
      top: { x: round4(a.top.x), y: round4(a.top.y) },
      left: { x: round4(a.left.x), y: round4(a.left.y) },
      right: { x: round4(a.right.x), y: round4(a.right.y) },
    },
    effectAnchors: {
      top: { x: round4(e.top.x), y: round4(e.top.y) },
      left: { x: round4(e.left.x), y: round4(e.left.y) },
      right: { x: round4(e.right.x), y: round4(e.right.y) },
    },
    actorScale: {
      top: round4(s.top),
      left: round4(s.left),
      right: round4(s.right),
    },
    spritePivot: {
      top: { dx: round4(p.top.dx), dy: round4(p.top.dy) },
      left: { dx: round4(p.left.dx), dy: round4(p.left.dy) },
      right: { dx: round4(p.right.dx), dy: round4(p.right.dy) },
    },
  }
}

/** Formats as a ready-to-paste ARENA_CALIBRATIONS entry -- same quoting/shape arena-calibration.js
 * itself uses, so the output can be pasted straight in as a `'<id>': { ... },` entry. */
function formatCalibrationEntry(o) {
  const c = o.boardPlaneFrac, a = o.anchors, e = o.effectAnchors, s = o.actorScale, p = o.spritePivot
  return `'${o.id}': {
  id: '${o.id}',
  background: '${o.background}',
  boardSizeLocked: ${o.boardSizeLocked},
  boardPlaneFrac: {
    tl: [${c.tl[0]}, ${c.tl[1]}], tr: [${c.tr[0]}, ${c.tr[1]}], br: [${c.br[0]}, ${c.br[1]}], bl: [${c.bl[0]}, ${c.bl[1]}],
  },
  anchors: {
    top: { x: ${a.top.x}, y: ${a.top.y} },
    left: { x: ${a.left.x}, y: ${a.left.y} },
    right: { x: ${a.right.x}, y: ${a.right.y} },
  },
  effectAnchors: {
    top: { x: ${e.top.x}, y: ${e.top.y} },
    left: { x: ${e.left.x}, y: ${e.left.y} },
    right: { x: ${e.right.x}, y: ${e.right.y} },
  },
  actorScale: {
    top: ${s.top},
    left: ${s.left},
    right: ${s.right},
  },
  spritePivot: {
    top: { dx: ${p.top.dx}, dy: ${p.top.dy} },
    left: { dx: ${p.left.dx}, dy: ${p.left.dy} },
    right: { dx: ${p.right.dx}, dy: ${p.right.dy} },
  },
},`
}

function updateExportText() {
  ui.exportText.value = formatCalibrationEntry(buildExportObject())
}

// ---------------------------------------------------------------------------------------------
// Toolbar wiring

// CAL-004: primary selector -- the 5 canon Prologue stages, in order.
for (const s of SEQUENCE_STEPS) ui.stagePick.append(new Option(s.title, s.key))
ui.stagePick.onchange = () => { if (ui.stagePick.value) loadStage(ui.stagePick.value) }

// CAL-004: arena/background swap -- changes only `draft.background` for whichever calibration id
// is currently active (stage or debug); geometry/anchors/scale are untouched and the user re-tunes
// them by hand against the new art, same as CAL-001's original per-arena calibration workflow.
for (const a of ARENA_ASSETS) ui.bgPick.append(new Option(a.label, a.path))
ui.bgPick.onchange = () => {
  draft.background = ui.bgPick.value
  setBackground(draft.background)
  renderer.resize(level, draft)
  refreshPanels()
}

// Legacy CAL-001/FIX-023 debug-arena picker: every ARENA_CALIBRATIONS id NOT part of the canon
// Prologue sequence (today just `boss-shadow-moon`) -- kept for calibrating a non-Prologue baked
// arena against the old synthetic 3-side preview.
const prologueCalibIds = new Set(Object.values(PROLOGUE_STAGE_CALIBRATION))
for (const c of Object.values(ARENA_CALIBRATIONS)) {
  if (prologueCalibIds.has(c.id)) continue
  ui.arenaPick.append(new Option(`${c.id} (${c.boardSizeLocked}x${c.boardSizeLocked})`, c.id))
}
ui.arenaPick.onchange = () => { if (ui.arenaPick.value) loadDebugArena(ui.arenaPick.value) }

for (let n = 5; n <= 10; n++) ui.gridSizePick.append(new Option(`${n}x${n}`, String(n)))
ui.gridSizePick.onchange = () => {
  if (mode !== 'debug') return
  draft.boardSizeLocked = Number(ui.gridSizePick.value)
  rebuildDebugEncounter()
  positionHandles()
  refreshPanels()
}

ui.toggleEffect.onchange = () => positionHandles()

ui.resetBtn.onclick = () => {
  draft = deepClone(original)
  setBackground(draft.background)
  syncBgPick()
  syncScaleInputs()
  syncPivotInputs()
  selected = null
  for (const el of handleEls.values()) el.classList.remove('selected')
  refreshActiveContent()
  positionHandles()
  refreshPanels()
}

if (ui.saveStorageBtn) {
  ui.saveStorageBtn.onclick = () => {
    const ok = saveArenaCalibrationOverride(draft.id, buildExportObject())
    ui.copyStatus.textContent = ok
      ? 'Saved override to browser! Reload game to see new layout.'
      : 'Failed to save to browser.'
    setTimeout(() => { ui.copyStatus.textContent = '' }, 4000)
  }
}

if (ui.clearStorageBtn) {
  ui.clearStorageBtn.onclick = () => {
    clearArenaCalibrationOverride(draft.id)
    draft = deepClone(ARENA_CALIBRATIONS[draft.id] ?? original)
    original = deepClone(draft)
    setBackground(draft.background)
    syncBgPick()
    syncScaleInputs()
    syncPivotInputs()
    selected = null
    for (const el of handleEls.values()) el.classList.remove('selected')
    refreshActiveContent()
    positionHandles()
    refreshPanels()
    ui.copyStatus.textContent = 'Browser override cleared. Reverted to code default.'
    setTimeout(() => { ui.copyStatus.textContent = '' }, 4000)
  }
}

ui.copyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(ui.exportText.value)
    ui.copyStatus.textContent = 'Copied to clipboard.'
  } catch {
    ui.copyStatus.textContent = 'Clipboard blocked — select the text above and copy manually.'
  }
  setTimeout(() => { ui.copyStatus.textContent = '' }, 3000)
}

ui.downloadBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(buildExportObject(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${draft.id}.calibration.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------------------------
// Render loop -- always on (idle sprite bob is a continuous function of `now`, same as app.js).

/** Mirrors app.js's tickAndSyncWolves: expire timed holds so idle bob/breathing never visibly
 * freezes. No gameplay events ever fire in the calibration editor (no tap/rotate), so this is
 * simpler than app.js's own version -- just keep ticking toward baseline. */
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
    wolf: (wolfVisuals && showSprites) ? { pack: wolfPack, visuals: wolfVisuals } : null,
    debug: ui.toggleGrid.checked,
  })
}
requestAnimationFrame(loop)

// Stage size can change from a window resize OR a layout change (sidebar, DPR) -- ResizeObserver
// catches both; the 1920x1080/1366x768 verify step just resizes the window and expects this to
// re-fit live, same contract app.js's own 'resize' listener gives production scenes.
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

createHandles()
wireScaleEvents()
wirePivotEvents()
// CAL-004: `#stage=<key>` picks a Prologue step directly (matches SEQUENCE_STEPS keys); the
// legacy `#arena=<id>` still works for a non-Prologue debug arena.
const hashParams = new URLSearchParams(location.hash.slice(1))
const initialDebugId = hashParams.get('arena')
if (initialDebugId && ARENA_CALIBRATIONS[initialDebugId] && !prologueCalibIds.has(initialDebugId)) {
  loadDebugArena(initialDebugId)
} else {
  const initialStage = hashParams.get('stage') ?? 'prologue-5x5'
  await loadStage(SEQUENCE_STEPS.some((s) => s.key === initialStage) ? initialStage : SEQUENCE_STEPS[0].key)
}

// Debug hook, same convention as app.js's window.visualDebug.
window.calibrationEditorDebug = {
  draft: () => draft,
  original: () => original,
  exportObject: () => buildExportObject(),
  loadStage,
  loadDebugArena,
  mode: () => mode,
  currentKey: () => (mode === 'stage' ? currentStageKey : currentDebugId),
  setActorScale: (top, left, right) => {
    if (top !== undefined) draft.actorScale.top = top
    if (left !== undefined) draft.actorScale.left = left
    if (right !== undefined) draft.actorScale.right = right
    syncScaleInputs()
    renderer.resize(level, draft)
    refreshPanels()
  },
  setSpritePivot: (side, dx, dy) => {
    if (!draft.spritePivot[side]) return
    if (dx !== undefined) draft.spritePivot[side].dx = dx
    if (dy !== undefined) draft.spritePivot[side].dy = dy
    syncPivotInputs()
    renderer.resize(level, draft)
    refreshPanels()
  },
  getLayout: () => renderer.debugLayout(),
}
