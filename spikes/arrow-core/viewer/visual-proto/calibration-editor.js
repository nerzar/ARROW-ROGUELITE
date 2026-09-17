// CAL-001: visual arena calibration editor. A standalone debug/tool page (never wired into the
// production HUD/index.html) so calibrating a baked-grid arena's board-plane corners and actor/
// effect anchors is a drag-and-type task instead of a hand-edit-arena-calibration.js-and-reload
// loop.
//
// GEOMETRY CONTRACT (per the CAL-001 task card): this tool must use the exact same production
// geometry every real playthrough uses, not a separate approximation. Concretely:
//  - the whole arena/grid/sprite/arrow render below is `board-renderer.js`'s own `createBoardRenderer`
//    (the same module `app.js` drives), fed a real generated board and a throwaway 3-side preview
//    encounter (TOP/LEFT/RIGHT) -- so the grid mesh comes from `board-plane.js`'s
//    project()/fitGrid()/gridLineToScreen(), and sprite placement comes from `arena-layout.js`'s
//    podiumSlot()/effectGround(), exactly as a real scene renders them.
//  - the only things this file adds are: (1) DOM drag/keyboard handles that read/write the
//    calibration draft's own stage-fraction numbers (a handle's screen position is that same
//    fraction times the stage size -- board-plane.js's own `planeCornersPx`/`podiumSlot`/
//    `effectGround` do the identical `frac * stageSize` math), and (2) the export/copy panel.
import { EncounterState, generateLevel, PRESETS } from '../../dist/src/index.js'
import { ASSET_MANIFEST, loadAssets, loadWolfPack } from './assets.js'
import { ARENA_CALIBRATIONS, getArenaCalibration } from './arena-calibration.js'
import { createBoardRenderer } from './board-renderer.js'
import { appearEnemyVisual } from './enemy-visual-state.js'

const $ = (id) => document.getElementById(id)
const ui = {
  arenaPick: $('arenaPick'), gridSizePick: $('gridSizePick'),
  toggleGrid: $('toggleGrid'), toggleArrows: $('toggleArrows'), toggleSprites: $('toggleSprites'), toggleEffect: $('toggleEffect'),
  resetBtn: $('resetBtn'), copyBtn: $('copyBtn'), downloadBtn: $('downloadBtn'),
  scaleTop: $('scaleTop'), scaleTopNum: $('scaleTopNum'),
  scaleLeft: $('scaleLeft'), scaleLeftNum: $('scaleLeftNum'),
  scaleRight: $('scaleRight'), scaleRightNum: $('scaleRightNum'),
  linkSideScale: $('linkSideScale'),
  stage: $('stage'), bgLayer: $('bgLayer'), canvas: $('arena'), handlesLayer: $('handlesLayer'),
  selectedInfo: $('selectedInfo'), valuesTable: $('valuesTable'), exportText: $('exportText'), copyStatus: $('copyStatus'),
}

// A throwaway preview encounter: three non-mandatory 1-hp "enemies" on TOP(N)/LEFT(W)/RIGHT(E) so
// board-renderer.js's real drawTarget draws a real sprite at each of the three anchor sides at
// once. Never a real encounter (not in encounters/, not reachable from app.js) -- purely a fixture
// so EncounterState has valid enemies to report through `collectTargets`.
const CAL_DEF = {
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
let encounterState = null
let wolfVisuals = null
let selected = null

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

function rebuildEncounter() {
  level = levelForSize(draft.boardSizeLocked)
  encounterState = EncounterState.fromLevel(level, CAL_DEF, 9999, null)
  wolfVisuals = new Map()
  for (const e of encounterState.enemies) wolfVisuals.set(e.id, appearEnemyVisual(performance.now()))
  renderer.resetFx()
  renderer.resize(level, draft)
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

function loadArena(id) {
  const calib = getArenaCalibration(id)
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
  draft = deepClone(original)
  ui.gridSizePick.value = String(draft.boardSizeLocked)
  ui.bgLayer.style.setProperty('--bg-image', `url(${draft.background})`)
  ui.bgLayer.classList.add('has-image')
  syncScaleInputs()
  selected = null
  rebuildEncounter()
  positionHandles()
  refreshPanels()
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
  ui.valuesTable.innerHTML = `<tr><th>handle</th><th>px (x, y)</th><th>frac / scale</th></tr>${rows}${scaleRows}`
}

const round4 = (n) => Math.round(n * 10000) / 10000

function buildExportObject() {
  const c = draft.boardPlaneFrac
  const a = draft.anchors
  const e = draft.effectAnchors
  const s = draft.actorScale
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
  }
}

/** Formats as a ready-to-paste ARENA_CALIBRATIONS entry -- same quoting/shape arena-calibration.js
 * itself uses, so the output can be pasted straight in as a `'<id>': { ... },` entry. */
function formatCalibrationEntry(o) {
  const c = o.boardPlaneFrac, a = o.anchors, e = o.effectAnchors, s = o.actorScale
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
},`
}

function updateExportText() {
  ui.exportText.value = formatCalibrationEntry(buildExportObject())
}

// ---------------------------------------------------------------------------------------------
// Toolbar wiring

for (const c of Object.values(ARENA_CALIBRATIONS)) {
  ui.arenaPick.append(new Option(`${c.id} (${c.boardSizeLocked}x${c.boardSizeLocked})`, c.id))
}
ui.arenaPick.onchange = () => loadArena(ui.arenaPick.value)

for (let n = 5; n <= 10; n++) ui.gridSizePick.append(new Option(`${n}x${n}`, String(n)))
ui.gridSizePick.onchange = () => {
  draft.boardSizeLocked = Number(ui.gridSizePick.value)
  rebuildEncounter()
  positionHandles()
  refreshPanels()
}

ui.toggleEffect.onchange = () => positionHandles()

ui.resetBtn.onclick = () => {
  draft = deepClone(original)
  ui.gridSizePick.value = String(draft.boardSizeLocked)
  syncScaleInputs()
  selected = null
  for (const el of handleEls.values()) el.classList.remove('selected')
  rebuildEncounter()
  positionHandles()
  refreshPanels()
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

function loop(now) {
  requestAnimationFrame(loop)
  if (!draft || !level) return
  const frameLevel = ui.toggleArrows.checked ? level : { ...level, arrows: [] }
  renderer.frame(now, {
    s: encounterState, def: CAL_DEF, level: frameLevel, assets,
    hint: null, boss: null,
    wolf: ui.toggleSprites.checked ? { pack: wolfPack, visuals: wolfVisuals } : null,
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
const initialId = new URLSearchParams(location.hash.slice(1)).get('arena') ?? 'prologue-5x5-good'
ui.arenaPick.value = ARENA_CALIBRATIONS[initialId] ? initialId : ui.arenaPick.options[0]?.value
loadArena(ui.arenaPick.value)

// Debug hook, same convention as app.js's window.visualDebug.
window.calibrationEditorDebug = {
  draft: () => draft,
  original: () => original,
  exportObject: () => buildExportObject(),
  loadArena,
  setActorScale: (top, left, right) => {
    if (top !== undefined) draft.actorScale.top = top
    if (left !== undefined) draft.actorScale.left = left
    if (right !== undefined) draft.actorScale.right = right
    syncScaleInputs()
    renderer.resize(level, draft)
    refreshPanels()
  },
  getLayout: () => renderer.debugLayout(),
}
