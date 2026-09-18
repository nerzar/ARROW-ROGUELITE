// TOOL-001: Creature Pose/State Editor -- small standalone authoring tool. Lets the user pick a
// creature/species, see the raw PNGs in its magicarrowassets source folder, assign them to the
// pose slots the runtime actually reads (ENEMY_POSES/BOSS_POSES), preview + adjust a foot pivot
// and scale, and save a real project file (creature-poses.json) that assets.js's
// applyPoseOverrides() merges into ENEMY_MANIFESTS/BOSS_MANIFESTS at runtime -- so both this
// tool's own preview and the actual game/Campaign Editor render exactly what was assigned here.
import { getCreatureCatalog } from './asset-catalog.js'
import { ENEMY_ANCHOR, ENEMY_POSES } from './enemy-visual-state.js'
import { BOSS_ANCHOR, BOSS_POSES } from './boss-visual-state.js'
import { hudBoxes, SHADOW_RX_FRAC, SHADOW_RY_CELL_FRAC, SHADOW_RY_MIN_PX } from './arena-layout.js'
import { DEFAULT_SPECIES_PIVOT } from './species-presentation.js'

const $ = (id) => document.getElementById(id)
const ui = {
  speciesPick: $('speciesPick'), saveBtn: $('saveBtn'), saveBadge: $('saveBadge'), statusLine: $('statusLine'),
  stage: $('stage'), previewImg: $('previewImg'), pivotHandle: $('pivotHandle'),
  fpBox: $('fpBox'), groundLine: $('groundLine'), shadowMock: $('shadowMock'),
  hudBarMock: $('hudBarMock'), hudPlateMock: $('hudPlateMock'),
  scaleRange: $('scaleRange'), scaleNum: $('scaleNum'),
  hudXRange: $('hudXRange'), hudXNum: $('hudXNum'), hudYRange: $('hudYRange'), hudYNum: $('hudYNum'),
  hudSizeRange: $('hudSizeRange'), hudSizeNum: $('hudSizeNum'),
  shXRange: $('shXRange'), shXNum: $('shXNum'), shYRange: $('shYRange'), shYNum: $('shYNum'),
  resetBtn: $('resetBtn'),
  poseSlotList: $('poseSlotList'), sourceFolderHint: $('sourceFolderHint'), sourceGallery: $('sourceGallery'),
  valSpeciesId: $('valSpeciesId'), valActivePose: $('valActivePose'), valPivotX: $('valPivotX'),
  valPivotY: $('valPivotY'), valScale: $('valScale'), valAssignedCount: $('valAssignedCount'),
  valHudX: $('valHudX'), valHudY: $('valHudY'), valHudSize: $('valHudSize'), valShX: $('valShX'), valShY: $('valShY'),
}

const CATALOG = getCreatureCatalog()
// CAL-005: the editor's no-op pivot IS species-presentation.js's default by construction now
// (previously a separately-kept copy) -- a species saved at this value contributes a zero delta.
const DEFAULT_PIVOT = { ...DEFAULT_SPECIES_PIVOT }
const DEFAULT_OFFSET = { x: 0, y: 0 } // CAL-005: species HUD/shadow no-op default (footprint fractions)

let currentSpecies = null // CREATURE_CATALOG entry
let sourceFiles = []      // filenames in the species' magicarrowassets source folder
let poseNames = []        // ENEMY_POSES or BOSS_POSES, depending on species.kind
let assignment = {}       // { [poseName]: sourceFileName | null } -- working state for currentSpecies
let pivot = { ...DEFAULT_PIVOT }
let scale = 1
let hudOffset = { ...DEFAULT_OFFSET } // CAL-005: species-level HUD offset (footprint fractions)
let hudSize = 1 // CAL-005: species-level HUD size multiplier
let shadowOffset = { ...DEFAULT_OFFSET } // CAL-005: species-level shadow offset (footprint fractions)
let activePose = 'idle'
let manifest = {}         // full creature-poses.json, loaded once, updated in place on save

function poseNamesFor(species) {
  return species.kind === 'boss' ? BOSS_POSES : ENEMY_POSES
}

function sourceFileUrl(name) {
  return `/api/creature-source/file?species=${encodeURIComponent(currentSpecies.sourceFolder)}&name=${encodeURIComponent(name)}`
}

function setStatus(kind, text) {
  ui.statusLine.className = kind ? `import-status ${kind}` : 'import-status'
  ui.statusLine.textContent = text
}

function markUnsaved() {
  ui.saveBadge.className = 'save-badge unsaved'
  ui.saveBadge.textContent = 'Unsaved changes'
}

async function loadManifest() {
  try {
    const res = await fetch('creature-poses.json', { cache: 'no-store' })
    manifest = res.ok ? await res.json() : {}
  } catch {
    manifest = {}
  }
}

async function loadSourceFiles(species) {
  try {
    const res = await fetch(`/api/creature-source/list?species=${encodeURIComponent(species.sourceFolder)}`, { cache: 'no-store' })
    const data = await res.json()
    return res.ok && data.ok ? data.files : []
  } catch {
    return []
  }
}

function isXy(v) {
  return !!v && typeof v.x === 'number' && typeof v.y === 'number'
    && Number.isFinite(v.x) && Number.isFinite(v.y)
}

async function selectSpecies(id) {
  currentSpecies = CATALOG.find((c) => c.id === id) ?? CATALOG[0]
  ui.speciesPick.value = currentSpecies.id
  poseNames = poseNamesFor(currentSpecies)
  activePose = poseNames[0]

  const existing = manifest[currentSpecies.id]
  assignment = {}
  for (const p of poseNames) assignment[p] = existing?.sourceFiles?.[p] ?? null
  pivot = isXy(existing?.pivot) ? { ...existing.pivot } : { ...DEFAULT_PIVOT }
  scale = typeof existing?.scale === 'number' ? existing.scale : 1
  // CAL-005: entries saved before HUD/shadow offsets existed have neither key -- default {0,0}.
  hudOffset = isXy(existing?.hudOffset) ? { ...existing.hudOffset } : { ...DEFAULT_OFFSET }
  hudSize = typeof existing?.hudScale === 'number' && existing.hudScale > 0 ? existing.hudScale : 1
  shadowOffset = isXy(existing?.shadowOffset) ? { ...existing.shadowOffset } : { ...DEFAULT_OFFSET }

  ui.sourceFolderHint.textContent = `Source: magicarrowassets/creatures/${currentSpecies.sourceFolder}`
  ui.saveBadge.className = 'save-badge'
  ui.saveBadge.textContent = existing ? 'Loaded saved poses' : 'No saved poses yet'
  setStatus('', '')

  sourceFiles = await loadSourceFiles(currentSpecies)
  if (sourceFiles.length === 0) setStatus('warn', `No image files found in magicarrowassets/creatures/${currentSpecies.sourceFolder}.`)

  renderPoseSlots()
  renderGallery()
  renderScaleInputs()
  renderOffsetInputs()
  renderHudSizeInputs()
  layoutPreview()
  updatePreview()
}

function renderPoseSlots() {
  ui.poseSlotList.innerHTML = ''
  for (const pose of poseNames) {
    const file = assignment[pose]
    const row = document.createElement('div')
    row.className = `pose-slot${pose === activePose ? ' active' : ''}`

    const thumb = document.createElement('img')
    thumb.className = 'pose-thumb'
    thumb.style.visibility = file ? 'visible' : 'hidden'
    if (file) thumb.src = sourceFileUrl(file)

    const name = document.createElement('span')
    name.className = 'pose-name'
    name.textContent = pose

    const fileLabel = document.createElement('span')
    fileLabel.className = 'pose-file'
    fileLabel.textContent = file ?? '— none — (falls back to idle)'

    const clearBtn = document.createElement('button')
    clearBtn.className = 'pose-clear'
    clearBtn.textContent = '✕'
    clearBtn.title = 'Clear this pose'
    clearBtn.onclick = (ev) => {
      ev.stopPropagation()
      assignment[pose] = null
      renderPoseSlots()
      renderGallery()
      if (activePose === pose) updatePreview()
      markUnsaved()
    }

    row.append(thumb, name, fileLabel, clearBtn)
    row.onclick = () => {
      activePose = pose
      renderPoseSlots()
      renderGallery()
      updatePreview()
    }
    ui.poseSlotList.append(row)
  }
}

function renderGallery() {
  ui.sourceGallery.innerHTML = ''
  for (const file of sourceFiles) {
    const cell = document.createElement('div')
    cell.className = `source-thumb${assignment[activePose] === file ? ' assigned' : ''}`

    const img = document.createElement('img')
    img.src = sourceFileUrl(file)
    img.loading = 'lazy'
    img.alt = file

    const label = document.createElement('div')
    label.className = 'source-thumb-label'
    label.textContent = file
    label.title = file

    cell.append(img, label)
    cell.title = `Assign to "${activePose}"`
    cell.onclick = () => {
      assignment[activePose] = file
      renderPoseSlots()
      renderGallery()
      updatePreview()
      markUnsaved()
    }
    ui.sourceGallery.append(cell)
  }
}

function updatePreview() {
  const file = assignment[activePose]
  if (file) {
    ui.previewImg.src = sourceFileUrl(file)
    ui.previewImg.classList.remove('empty')
  } else {
    ui.previewImg.removeAttribute('src')
    ui.previewImg.classList.add('empty')
  }
  layoutPreview() // overlays re-anchor to the new pose; the image rect itself re-lays out on 'load'
}

// TOOL-001: freed-up sidebar space after moving pose slots below the preview -- surfaces the
// numbers behind the handles/sliders, same idea as calibration-editor.js's "ALL VALUES" table.
function refreshValuesTable() {
  ui.valSpeciesId.textContent = currentSpecies?.id ?? '—'
  ui.valActivePose.textContent = activePose ?? '—'
  ui.valPivotX.textContent = pivot.x.toFixed(4)
  ui.valPivotY.textContent = pivot.y.toFixed(4)
  ui.valScale.textContent = scale.toFixed(2)
  ui.valHudX.textContent = hudOffset.x.toFixed(3)
  ui.valHudY.textContent = hudOffset.y.toFixed(3)
  ui.valHudSize.textContent = hudSize.toFixed(2)
  ui.valShX.textContent = shadowOffset.x.toFixed(3)
  ui.valShY.textContent = shadowOffset.y.toFixed(3)
  const assignedCount = Object.values(assignment).filter(Boolean).length
  ui.valAssignedCount.textContent = `${assignedCount} / ${poseNames.length}`
}

// CAL-005: runtime-identical preview geometry. The stage draws a representative character
// footprint (runtime boss/side footprints are both square; the absolute size varies per
// arena, but every offset below is a footprint FRACTION, so it transfers 1:1). The pose
// image is contain-fitted into the footprint and bottom-center anchored with the exact
// runtime formula (per-pose ANCHOR.offsets + (pivot - DEFAULT) species delta, scene pivot 0,
// scale multiplier) -- see board-renderer.js's drawBossArt/drawWolfArt. The pivot dot sits at
// the authored image-fraction point of the DRAWN rect, so it sticks to the art. HUD/shadow
// mocks use the real hudBoxes math / footprint fractions, so they move exactly like the game.
function footprintRect() {
  const w = ui.stage.clientWidth
  const h = ui.stage.clientHeight
  const side = Math.min(w * 0.44, h * 0.62)
  const cx = w / 2
  const bottom = h * 0.9
  return { x: cx - side / 2, y: bottom - side, w: side, h: side, cx, bottom }
}

function poseAnchor() {
  const table = currentSpecies?.kind === 'boss' ? BOSS_ANCHOR : ENEMY_ANCHOR
  return table.offsets[activePose] ?? { dx: 0, dy: 0 }
}

function layoutPreview() {
  const fp = footprintRect()
  for (const [el, l, t, w, h] of [
    [ui.fpBox, fp.x, fp.y, fp.w, fp.h],
    [ui.groundLine, fp.cx - fp.w * 0.45, fp.bottom, fp.w * 0.9, 0],
  ]) {
    el.style.left = `${Math.round(l)}px`
    el.style.top = `${Math.round(t)}px`
    el.style.width = `${Math.round(w)}px`
    if (h) el.style.height = `${Math.round(h)}px`
  }
  // Shadow mock: footprint bottom + species shadow offset (independent of art pivot).
  // Same proportions as the runtime ellipse (SHADOW_* shared constants).
  const shW = fp.w * SHADOW_RX_FRAC * 2
  ui.shadowMock.style.width = `${Math.round(shW)}px`
  ui.shadowMock.style.height = `${Math.max(SHADOW_RY_MIN_PX * 2, Math.round((fp.h / 6) * SHADOW_RY_CELL_FRAC * 2))}px`
  ui.shadowMock.style.left = `${Math.round(fp.cx + shadowOffset.x * fp.w - shW / 2)}px`
  ui.shadowMock.style.top = `${Math.round(fp.bottom + shadowOffset.y * fp.h - 4)}px`
  // HUD mock: the real hudBoxes math on the footprint, slot = footprint center (stage coords).
  // HUD size scales the font/bar metrics exactly like the runtime does (see board-renderer.js).
  const fontPx = Math.max(10, Math.round(fp.h * 0.045)) * hudSize
  const hud = hudBoxes({
    slot: { x: fp.cx, y: fp.y + fp.h / 2 },
    char: { x: fp.x, y: fp.y, w: fp.w, h: fp.h },
    side: 0, fontPx, lineH: fontPx * 1.15, lineCount: 2, // HP + ATTACK IN (no name line, same as runtime)
    barH: Math.max(5, fp.h * 0.03) * hudSize, maxTextW: fp.w * 0.55 * hudSize, cell: (fp.h / 6) * hudSize,
    offset: { x: hudOffset.x * fp.w, y: hudOffset.y * fp.h },
  })
  ui.hudBarMock.style.left = `${Math.round(hud.bar.x)}px`
  ui.hudBarMock.style.top = `${Math.round(hud.bar.y)}px`
  ui.hudBarMock.style.width = `${Math.round(hud.bar.w)}px`
  ui.hudBarMock.style.height = `${Math.round(hud.bar.h)}px`
  ui.hudPlateMock.style.left = `${Math.round(hud.plate.x)}px`
  ui.hudPlateMock.style.top = `${Math.round(hud.plate.y)}px`
  ui.hudPlateMock.style.width = `${Math.round(hud.plate.w)}px`
  ui.hudPlateMock.style.height = `${Math.round(hud.plate.h)}px`
  // Pose image: runtime contain-fit + ground anchor. Needs the natural size; before the
  // image loads there is nothing to lay out (overlays above already show without art).
  const iw = ui.previewImg.naturalWidth
  const ih = ui.previewImg.naturalHeight
  if (iw && ih && !ui.previewImg.classList.contains('empty')) {
    const off = poseAnchor()
    const dx = pivot.x - DEFAULT_PIVOT.x
    const dy = pivot.y - DEFAULT_PIVOT.y
    const fit = Math.min(fp.w / iw, fp.h / ih) * scale
    const dw = iw * fit
    const dh = ih * fit
    const imgLeft = fp.cx + (off.dx + dx) * fp.w - dw / 2
    const imgTop = fp.bottom + (off.dy + dy) * fp.h - dh
    const img = ui.previewImg
    img.classList.add('laid-out')
    img.style.width = `${Math.round(dw)}px`
    img.style.height = `${Math.round(dh)}px`
    img.style.left = `${Math.round(imgLeft)}px`
    img.style.top = `${Math.round(imgTop)}px`
    ui.pivotHandle.style.left = `${Math.round(imgLeft + pivot.x * dw)}px`
    ui.pivotHandle.style.top = `${Math.round(imgTop + pivot.y * dh)}px`
  } else {
    ui.previewImg.classList.remove('laid-out')
    ui.pivotHandle.style.left = `${Math.round(fp.cx)}px`
    ui.pivotHandle.style.top = `${Math.round(fp.bottom)}px`
  }
  refreshValuesTable()
}

// Image-fraction point under a stage-space pointer, mapped through a FROZEN image rect.
// (The live rect can't be used mid-drag: moving the pivot re-lays-out the image by the same
// delta, so the pointer would map to a different fraction every move event -- runaway
// feedback, the dot and the mob visibly jumping. The rect is captured at dragstart and the
// full layoutPreview() runs once on release.)
function pivotFromPointer(clientX, clientY, imgRect) {
  const stageRect = ui.stage.getBoundingClientRect()
  const dw = imgRect?.width ?? 0
  const dh = imgRect?.height ?? 0
  if (!dw || !dh) {
    return {
      x: Math.min(1, Math.max(0, (clientX - stageRect.left) / stageRect.width)),
      y: Math.min(1, Math.max(0, (clientY - stageRect.top) / stageRect.height)),
    }
  }
  return {
    x: Math.min(1, Math.max(0, (clientX - imgRect.left) / dw)),
    y: Math.min(1, Math.max(0, (clientY - imgRect.top) / dh)),
  }
}

// Position the pivot dot for an already-known image rect (stage coords). Same mapping
// layoutPreview() uses, without re-laying-out the image itself.
function positionDotForRect(imgRect) {
  const stageRect = ui.stage.getBoundingClientRect()
  ui.pivotHandle.style.left = `${Math.round(imgRect.left - stageRect.left + pivot.x * imgRect.width)}px`
  ui.pivotHandle.style.top = `${Math.round(imgRect.top - stageRect.top + pivot.y * imgRect.height)}px`
  refreshValuesTable()
}

function renderScaleInputs() {
  ui.scaleRange.value = String(scale)
  ui.scaleNum.value = scale.toFixed(2)
  ui.stage.style.setProperty('--preview-scale', String(scale))
  refreshValuesTable()
}

// CAL-005: species HUD/shadow offset inputs -- same range+number pattern as scale.
function renderOffsetInputs() {
  ui.hudXRange.value = String(hudOffset.x)
  ui.hudXNum.value = hudOffset.x.toFixed(3)
  ui.hudYRange.value = String(hudOffset.y)
  ui.hudYNum.value = hudOffset.y.toFixed(3)
  ui.shXRange.value = String(shadowOffset.x)
  ui.shXNum.value = shadowOffset.x.toFixed(3)
  ui.shYRange.value = String(shadowOffset.y)
  ui.shYNum.value = shadowOffset.y.toFixed(3)
  refreshValuesTable()
}

// Single draggable pivot handle -- same pointer-capture + keyboard-nudge pattern as
// calibration-editor.js's board-corner/actor-anchor handles, scaled down to one handle.
// CAL-005: the handle lives in IMAGE fractions of the drawn rect (it sticks to the art
// point), matching the runtime delta math; the preview image itself is laid out by
// layoutPreview() with the exact runtime formula.
function wirePivotHandle() {
  let dragging = false
  let dragRect = null // frozen image rect for the whole gesture (see pivotFromPointer)
  function updateFromPointer(ev) {
    pivot = pivotFromPointer(ev.clientX, ev.clientY, dragRect)
    if (dragRect) positionDotForRect(dragRect)
    else layoutPreview()
    markUnsaved()
  }
  ui.pivotHandle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    ui.pivotHandle.setPointerCapture(ev.pointerId)
    const live = ui.previewImg.getBoundingClientRect()
    dragRect = (live.width && live.height && !ui.previewImg.classList.contains('empty')) ? live : null
    dragging = true
  })
  ui.pivotHandle.addEventListener('pointermove', (ev) => { if (dragging) updateFromPointer(ev) })
  function endDrag(ev) {
    if (!dragging) return
    dragging = false
    dragRect = null
    try { ui.pivotHandle.releasePointerCapture(ev.pointerId) } catch {}
    layoutPreview() // settle the image on the final pivot once, after the gesture
  }
  ui.pivotHandle.addEventListener('pointerup', endDrag)
  ui.pivotHandle.addEventListener('pointercancel', endDrag)
  ui.pivotHandle.addEventListener('keydown', (ev) => {
    // CAL-005: nudge in drawn-image px converted to image fractions (Shift = 10px).
    const imgRect = ui.previewImg.getBoundingClientRect()
    const unitX = imgRect.width ? 1 / imgRect.width : 1 / ui.stage.clientWidth
    const unitY = imgRect.height ? 1 / imgRect.height : 1 / ui.stage.clientHeight
    const stepX = (ev.shiftKey ? 10 : 1) * unitX
    const stepY = (ev.shiftKey ? 10 : 1) * unitY
    if (ev.key === 'ArrowLeft') pivot = { ...pivot, x: Math.max(0, pivot.x - stepX) }
    else if (ev.key === 'ArrowRight') pivot = { ...pivot, x: Math.min(1, pivot.x + stepX) }
    else if (ev.key === 'ArrowUp') pivot = { ...pivot, y: Math.max(0, pivot.y - stepY) }
    else if (ev.key === 'ArrowDown') pivot = { ...pivot, y: Math.min(1, pivot.y + stepY) }
    else return
    ev.preventDefault()
    layoutPreview()
    markUnsaved()
  })
}

ui.scaleRange.addEventListener('input', () => {
  scale = Number(ui.scaleRange.value)
  renderScaleInputs()
  layoutPreview()
  markUnsaved()
})
ui.scaleNum.addEventListener('input', () => {
  scale = Number(ui.scaleNum.value) || 1
  renderScaleInputs()
  layoutPreview()
  markUnsaved()
})

// CAL-005: species HUD/shadow offset inputs -- same range+number pattern, live preview via layoutPreview.
function wireOffsetPair(rangeEl, numEl, get, set) {
  rangeEl.addEventListener('input', () => {
    set(Number(rangeEl.value))
    renderOffsetInputs()
    layoutPreview()
    markUnsaved()
  })
  numEl.addEventListener('input', () => {
    const v = Number(numEl.value)
    if (Number.isFinite(v)) set(v) // no clamp: offsets are intentionally unbounded
    renderOffsetInputs()
    layoutPreview()
    markUnsaved()
  })
}
wireOffsetPair(ui.hudXRange, ui.hudXNum, () => hudOffset.x, (v) => { hudOffset = { ...hudOffset, x: v } })
wireOffsetPair(ui.hudYRange, ui.hudYNum, () => hudOffset.y, (v) => { hudOffset = { ...hudOffset, y: v } })
wireOffsetPair(ui.shXRange, ui.shXNum, () => shadowOffset.x, (v) => { shadowOffset = { ...shadowOffset, x: v } })
wireOffsetPair(ui.shYRange, ui.shYNum, () => shadowOffset.y, (v) => { shadowOffset = { ...shadowOffset, y: v } })

// CAL-005: species HUD size multiplier (0.5..2, default 1) -- same pattern as scale.
function renderHudSizeInputs() {
  ui.hudSizeRange.value = String(hudSize)
  ui.hudSizeNum.value = hudSize.toFixed(2)
  refreshValuesTable()
}
ui.hudSizeRange.addEventListener('input', () => {
  hudSize = Number(ui.hudSizeRange.value)
  renderHudSizeInputs()
  layoutPreview()
  markUnsaved()
})
ui.hudSizeNum.addEventListener('input', () => {
  const v = Number(ui.hudSizeNum.value)
  if (Number.isFinite(v)) hudSize = Math.min(2, Math.max(0.5, v))
  renderHudSizeInputs()
  layoutPreview()
  markUnsaved()
})

// CAL-005: one-click reset of every species default this editor owns (applies on Save).
ui.resetBtn.addEventListener('click', () => {
  pivot = { ...DEFAULT_PIVOT }
  scale = 1
  hudOffset = { ...DEFAULT_OFFSET }
  hudSize = 1
  shadowOffset = { ...DEFAULT_OFFSET }
  renderScaleInputs()
  renderOffsetInputs()
  renderHudSizeInputs()
  layoutPreview()
  markUnsaved()
})

ui.speciesPick.addEventListener('change', () => selectSpecies(ui.speciesPick.value))

ui.saveBtn.addEventListener('click', async () => {
  if (!currentSpecies) return
  const poses = {}
  for (const [pose, file] of Object.entries(assignment)) if (file) poses[pose] = file
  ui.saveBadge.className = 'save-badge'
  ui.saveBadge.textContent = 'Saving…'
  try {
    const res = await fetch('/api/creature-poses/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: currentSpecies.id, sourceFolder: currentSpecies.sourceFolder, poses, pivot, scale, hudOffset, hudScale: hudSize, shadowOffset }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) {
      manifest[currentSpecies.id] = data.entry
      ui.saveBadge.className = 'save-badge saved-file'
      ui.saveBadge.textContent = `✔ Saved to ${data.file}`
      setStatus('ok', `Saved ${Object.keys(poses).length} pose(s) for "${currentSpecies.label}". The Campaign Editor and Playable game pick this up on their next load.`)
    } else {
      throw new Error(data?.error ?? `HTTP ${res.status}`)
    }
  } catch (err) {
    ui.saveBadge.className = 'save-badge unsaved'
    ui.saveBadge.textContent = '✕ Save failed'
    setStatus('warn', `Save failed: ${err.message ?? err}`)
  }
})

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => layoutPreview()).observe(ui.stage)
}
// The laid-out rect needs the natural image size -- re-layout once each pose frame arrives.
ui.previewImg.addEventListener('load', () => layoutPreview())

// ---------------------------------------------------------------------------------------------
// Initialization

CATALOG.forEach((c) => ui.speciesPick.append(new Option(c.label, c.id)))
wirePivotHandle()
await loadManifest()
await selectSpecies(CATALOG[0].id)

// Debug/automation hook -- browser automation can't drive a native file-picker, but every
// interaction here is plain DOM click/select, so no debug hook is needed for those. This is only
// for reading current state without re-deriving it from the DOM in tests.
window.poseEditorDebug = {
  currentSpecies: () => currentSpecies,
  assignment: () => assignment,
  pivot: () => pivot,
  scale: () => scale,
  hudOffset: () => hudOffset,
  hudSize: () => hudSize,
  shadowOffset: () => shadowOffset,
  manifestEntry: () => manifest[currentSpecies?.id],
  selectSpecies,
  setActivePose: (p) => { activePose = p; renderPoseSlots(); renderGallery(); updatePreview() },
  assignFile: (file) => { assignment[activePose] = file; renderPoseSlots(); renderGallery(); updatePreview(); markUnsaved() },
  setHudOffset: (x, y) => { hudOffset = { x, y }; renderOffsetInputs(); layoutPreview(); markUnsaved() },
  setHudSize: (v) => { hudSize = v; renderHudSizeInputs(); layoutPreview(); markUnsaved() },
  setShadowOffset: (x, y) => { shadowOffset = { x, y }; renderOffsetInputs(); layoutPreview(); markUnsaved() },
  reset: () => ui.resetBtn.click(),
  save: () => ui.saveBtn.click(),
}
