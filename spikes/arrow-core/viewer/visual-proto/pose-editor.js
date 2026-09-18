// TOOL-001: Creature Pose/State Editor -- small standalone authoring tool. Lets the user pick a
// creature/species, see the raw PNGs in its magicarrowassets source folder, assign them to the
// pose slots the runtime actually reads (ENEMY_POSES/BOSS_POSES), preview + adjust a foot pivot
// and scale, and save a real project file (creature-poses.json) that assets.js's
// applyPoseOverrides() merges into ENEMY_MANIFESTS/BOSS_MANIFESTS at runtime -- so both this
// tool's own preview and the actual game/Campaign Editor render exactly what was assigned here.
import { getCreatureCatalog } from './asset-catalog.js'
import { ENEMY_POSES } from './enemy-visual-state.js'
import { BOSS_POSES } from './boss-visual-state.js'

const $ = (id) => document.getElementById(id)
const ui = {
  speciesPick: $('speciesPick'), saveBtn: $('saveBtn'), saveBadge: $('saveBadge'), statusLine: $('statusLine'),
  stage: $('stage'), previewImg: $('previewImg'), pivotHandle: $('pivotHandle'),
  activePoseLabel: $('activePoseLabel'), scaleRange: $('scaleRange'), scaleNum: $('scaleNum'),
  poseSlotList: $('poseSlotList'), sourceFolderHint: $('sourceFolderHint'), sourceGallery: $('sourceGallery'),
  valSpeciesId: $('valSpeciesId'), valActivePose: $('valActivePose'), valPivotX: $('valPivotX'),
  valPivotY: $('valPivotY'), valScale: $('valScale'), valAssignedCount: $('valAssignedCount'),
}

const CATALOG = getCreatureCatalog()
const DEFAULT_PIVOT = { x: 0.5, y: 0.92 }

let currentSpecies = null // CREATURE_CATALOG entry
let sourceFiles = []      // filenames in the species' magicarrowassets source folder
let poseNames = []        // ENEMY_POSES or BOSS_POSES, depending on species.kind
let assignment = {}       // { [poseName]: sourceFileName | null } -- working state for currentSpecies
let pivot = { ...DEFAULT_PIVOT }
let scale = 1
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

async function selectSpecies(id) {
  currentSpecies = CATALOG.find((c) => c.id === id) ?? CATALOG[0]
  ui.speciesPick.value = currentSpecies.id
  poseNames = poseNamesFor(currentSpecies)
  activePose = poseNames[0]

  const existing = manifest[currentSpecies.id]
  assignment = {}
  for (const p of poseNames) assignment[p] = existing?.sourceFiles?.[p] ?? null
  pivot = existing?.pivot ?? { ...DEFAULT_PIVOT }
  scale = typeof existing?.scale === 'number' ? existing.scale : 1

  ui.sourceFolderHint.textContent = `Source: magicarrowassets/creatures/${currentSpecies.sourceFolder}`
  ui.saveBadge.className = 'save-badge'
  ui.saveBadge.textContent = existing ? 'Loaded saved poses' : 'No saved poses yet'
  setStatus('', '')

  sourceFiles = await loadSourceFiles(currentSpecies)
  if (sourceFiles.length === 0) setStatus('warn', `No image files found in magicarrowassets/creatures/${currentSpecies.sourceFolder}.`)

  renderPoseSlots()
  renderGallery()
  renderScaleInputs()
  positionPivotHandle()
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
  ui.activePoseLabel.textContent = activePose
  const file = assignment[activePose]
  if (file) {
    ui.previewImg.src = sourceFileUrl(file)
    ui.previewImg.classList.remove('empty')
  } else {
    ui.previewImg.removeAttribute('src')
    ui.previewImg.classList.add('empty')
  }
  refreshValuesTable()
}

// TOOL-001: freed-up sidebar space after moving pose slots below the preview -- surfaces the
// numbers behind the handles/sliders, same idea as calibration-editor.js's "ALL VALUES" table.
function refreshValuesTable() {
  ui.valSpeciesId.textContent = currentSpecies?.id ?? '—'
  ui.valActivePose.textContent = activePose ?? '—'
  ui.valPivotX.textContent = pivot.x.toFixed(4)
  ui.valPivotY.textContent = pivot.y.toFixed(4)
  ui.valScale.textContent = scale.toFixed(2)
  const assignedCount = Object.values(assignment).filter(Boolean).length
  ui.valAssignedCount.textContent = `${assignedCount} / ${poseNames.length}`
}

function positionPivotHandle() {
  const rect = ui.stage.getBoundingClientRect()
  ui.pivotHandle.style.left = `${Math.round(pivot.x * rect.width)}px`
  ui.pivotHandle.style.top = `${Math.round(pivot.y * rect.height)}px`
  refreshValuesTable()
}

function renderScaleInputs() {
  ui.scaleRange.value = String(scale)
  ui.scaleNum.value = scale.toFixed(2)
  ui.stage.style.setProperty('--preview-scale', String(scale))
  refreshValuesTable()
}

// Single draggable pivot handle -- same pointer-capture + keyboard-nudge pattern as
// calibration-editor.js's board-corner/actor-anchor handles, scaled down to one handle.
function wirePivotHandle() {
  let dragging = false
  function updateFromPointer(ev) {
    const rect = ui.stage.getBoundingClientRect()
    pivot = {
      x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)),
    }
    positionPivotHandle()
    markUnsaved()
  }
  ui.pivotHandle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    ui.pivotHandle.setPointerCapture(ev.pointerId)
    dragging = true
  })
  ui.pivotHandle.addEventListener('pointermove', (ev) => { if (dragging) updateFromPointer(ev) })
  function endDrag(ev) {
    if (!dragging) return
    dragging = false
    try { ui.pivotHandle.releasePointerCapture(ev.pointerId) } catch {}
  }
  ui.pivotHandle.addEventListener('pointerup', endDrag)
  ui.pivotHandle.addEventListener('pointercancel', endDrag)
  ui.pivotHandle.addEventListener('keydown', (ev) => {
    const stepX = (ev.shiftKey ? 10 : 1) / ui.stage.clientWidth
    const stepY = (ev.shiftKey ? 10 : 1) / ui.stage.clientHeight
    if (ev.key === 'ArrowLeft') pivot = { ...pivot, x: Math.max(0, pivot.x - stepX) }
    else if (ev.key === 'ArrowRight') pivot = { ...pivot, x: Math.min(1, pivot.x + stepX) }
    else if (ev.key === 'ArrowUp') pivot = { ...pivot, y: Math.max(0, pivot.y - stepY) }
    else if (ev.key === 'ArrowDown') pivot = { ...pivot, y: Math.min(1, pivot.y + stepY) }
    else return
    ev.preventDefault()
    positionPivotHandle()
    markUnsaved()
  })
}

ui.scaleRange.addEventListener('input', () => {
  scale = Number(ui.scaleRange.value)
  renderScaleInputs()
  markUnsaved()
})
ui.scaleNum.addEventListener('input', () => {
  scale = Number(ui.scaleNum.value) || 1
  renderScaleInputs()
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
      body: JSON.stringify({ species: currentSpecies.id, sourceFolder: currentSpecies.sourceFolder, poses, pivot, scale }),
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
  new ResizeObserver(() => positionPivotHandle()).observe(ui.stage)
}

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
  manifestEntry: () => manifest[currentSpecies?.id],
  selectSpecies,
  setActivePose: (p) => { activePose = p; renderPoseSlots(); renderGallery(); updatePreview() },
  assignFile: (file) => { assignment[activePose] = file; renderPoseSlots(); renderGallery(); updatePreview(); markUnsaved() },
  save: () => ui.saveBtn.click(),
}
