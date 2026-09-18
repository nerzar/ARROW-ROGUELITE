// BUILD-032 gallery, re-pointed by FIX-032 at the shared BUILD-034 modules.
//
// What changed vs the original demo: geometry, the material registry and the actual painting all
// come from ./visual-proto/ now, so this page and the playable runtime cannot drift apart. The
// page keeps what only it needs -- its own preview homography with the `tilt` slider, the geometry
// sliders and the hotkeys. Its three local warm painters (paintSolid/paintBevel/paintMagic) are
// gone: those same three live in the shared registry as warm-solid/warm-bevel/warm-magic.
//
// Original header follows.
// BUILD-032: filled-arrow renderer demo.
// Conceptual change vs stroke-based viewers: each arrow is ONE solid filled shape
// built in board-space (cell units) — shaft + rounded bends + head as a single
// outline — and the whole figure is then projected to screen with a homography.
// Gameplay/hitbox rules are untouched: BoardState.canExit / ownerAt.
// Materials (warm-solid / warm-bevel / warm-magic) all paint the SAME geometry.
import {
  BoardState,
  DX,
  DY,
  PRESET_NAMES,
  PRESETS,
  generateLevel,
} from '../dist/src/index.js'
import {
  add,
  applyH,
  buildFilledArrow,
  cellCenter,
  invertH,
  solveHomography,
} from './visual-proto/filled-arrow-geom.js'
import { MATERIALS, findMaterial } from './visual-proto/filled-arrow-materials.js'
import {
  ARROW_INSET_PX,
  ARROW_SHAPE,
  buildArrowPathWith,
  createHoverFade,
  materialIsAnimated,
  paintFilledArrow,
  shapeForCell,
} from './visual-proto/filled-arrow-render.js'

const $ = (id) => document.getElementById(id)
const ui = {
  canvas: $('board'), msg: $('msg'), info: $('info'),
  preset: $('preset'), seed: $('seed'),
  mat: $('mat'), matName: $('matName'),
  shaft: $('shaft'), shaftV: $('shaftV'),
  bend: $('bend'), bendV: $('bendV'),
  bendStyle: $('bendStyle'),
  showIds: $('showIds'),
  tilt: $('tilt'), tiltV: $('tiltV'),
  tipPx: $('tipPx'), tipPxV: $('tipPxV'),
  tailPx: $('tailPx'), tailPxV: $('tailPxV'),
}
const ctx = ui.canvas.getContext('2d')

let level = null
let board = null
let hover = -1
let flash = { blocked: -1, blocker: -1, t0: 0 }
let shots = []
let shownAngle = 0 // no rotation in this demo; homography tilt covers the projection story
let magicT0 = performance.now()

// FIX-032: geometry defaults come from the shared ARROW_SHAPE (which is filled-arrow-geom.js's
// DEFAULTS), so `tipReach`/`headLen` here are the same numbers the playable runtime uses. Only
// `tilt` is gallery-local -- it drives this page's preview homography, nothing else.
const params = {
  ...ARROW_SHAPE,
  material: 'warm-bevel', // accepted default (BUILD-033)
  tilt: 0,                // perspective amount for the homography preview
  // FIX-032b: grid clearance in px -- same knobs the playable uses, exposed here so the value can
  // be dialled in against real art before it is baked into ARROW_INSET_PX.
  tipPx: ARROW_INSET_PX.tipPx,
  tailPx: ARROW_INSET_PX.tailPx,
}

// ---------------------------------------------------------------------------
// 1–2. Geometry + homography live in ./filled-arrow-geom.js (DOM-free,
// unit-testable): buildFilledArrow (ONE closed outline in board-space cell
// units: shaft + rounded bends + head) and solveHomography/applyH/invertH.
// The whole figure is projected to screen through H below.
// ---------------------------------------------------------------------------

/** Screen quad of the board corners for the current view + tilt. */
function boardQuad(g) {
  const tl = [g.cx - (g.wpx / 2), g.cy - (g.hpx / 2)]
  const tr = [g.cx + (g.wpx / 2), g.cy - (g.hpx / 2)]
  const br = [g.cx + (g.wpx / 2), g.cy + (g.hpx / 2)]
  const bl = [g.cx - (g.wpx / 2), g.cy + (g.hpx / 2)]
  const squeeze = params.tilt * g.wpx * 0.5
  const lift = params.tilt * g.hpx * 0.28
  return [
    [tl[0] + squeeze, tl[1] + lift],
    [tr[0] - squeeze, tr[1] + lift],
    br, bl,
  ]
}

function computeH(g) {
  const src = [[0, 0], [level.width, 0], [level.width, level.height], [0, level.height]]
  return solveHomography(src, boardQuad(g))
}

/** Project a board-space outline to a screen-space Path2D through H. */
function pathThroughH(outline, H) {
  const path = new Path2D()
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const track = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
  outline.forEach((node, i) => {
    if (node.skipped) return // consumed by the rounded-tip handler
    const [x, y] = applyH(H, node.p)
    track(x, y)
    if (i === 0) path.moveTo(x, y)
    else if (node.ctrl) {
      const [cx, cy] = applyH(H, node.ctrl)
      track(cx, cy)
      path.quadraticCurveTo(cx, cy, x, y)
    } else if (node.ctrlTip) {
      // rounded tip: two quadratics meeting at the tip point
      const prev = applyH(H, outline[i - 1].p)
      const nextNode = outline[i + 1]
      const next = applyH(H, nextNode.p)
      const c1 = [prev[0] + (x - prev[0]) * 0.55, prev[1] + (y - prev[1]) * 0.55]
      const c2 = [next[0] + (x - next[0]) * 0.55, next[1] + (y - next[1]) * 0.55]
      path.quadraticCurveTo(c1[0], c1[1], x, y)
      path.quadraticCurveTo(c2[0], c2[1], next[0], next[1])
      track(next[0], next[1])
      nextNode.skipped = true
    } else path.lineTo(x, y)
  })
  path.closePath()
  return { path, bbox: { x0, y0, x1, y1 } }
}

// ---------------------------------------------------------------------------
// 3. Materials — all paint the SAME projected Path2D.
// ---------------------------------------------------------------------------

// FIX-032: no local palette and no local painters -- every material, warm ones included, comes
// from the shared registry via paintFilledArrow(). `col` below is the small slice of the game's
// palette that the shared painter reads; the gallery has no encounter, so pinned/aims are always
// false and every alive arrow is either free or geometrically blocked.
const GALLERY_COL = {
  arrowOutline: 'rgba(38,26,10,0.85)',
  rock: '#8d7b63', rockGlow: 'rgba(140,120,90,0.6)',
  arrow: '#e09a2b', arrowDim: '#9a7d4a', aim: '#f4b942',
  aimGlow: 'rgba(255,215,106,0.85)', freeGlow: 'rgba(200,200,220,0.55)', mutedGlow: 'rgba(0,0,0,0)',
  muted: 'rgba(120,120,120,0.8)',
  hoverGlow: 'rgba(255,241,206,0.92)',
}

const hoverFade = createHoverFade()

function paintArrow(a, geo, H, now) {
  if (!board.isAlive(a.id)) return
  const built = buildArrowPathWith(
    a,
    (pt) => { const [x, y] = applyH(H, pt); return { x, y } },
    DX, DY, level.width,
    shapeForCell(geo.cell, params, { tipPx: params.tipPx, tailPx: params.tailPx }),
  )
  paintFilledArrow(ctx, built, {
    col: GALLERY_COL,
    materialId: params.material,
    localScale: geo.cell,
    now,
    seed: a.id,
    free: board.canExit(a.id),
    pinned: false,
    aims: false,
    hover: hoverFade.amount(a.id),
    isBlocked: a.id === flash.blocked,
    isBlocker: a.id === flash.blocker,
    isHint: false,
    isDenied: false,
  })

  if (ui.showIds.checked) {
    const [tx, ty] = applyH(H, cellCenter(a.cells[0], level.width))
    ctx.save()
    ctx.font = `600 ${Math.max(9, Math.floor(geo.cell * 0.3))}px system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(20,12,4,0.75)'
    ctx.fillText(String(a.id), tx, ty)
    ctx.restore()
  }
}

// Path2D has no bbox API; the bbox is measured during projection (see pathThroughH).

// ---------------------------------------------------------------------------
// 4. Frame / view / input (gameplay rules unchanged).
// ---------------------------------------------------------------------------

let raf = 0
function kick() {
  if (!raf) raf = requestAnimationFrame(frame)
}

function computeGeo() {
  const { width: w, height: h } = level
  const span = Math.max(w, h)
  const margin = 3.0
  const avail = Math.max(260, Math.min(ui.canvas.parentElement.clientWidth - 16, window.innerHeight - 170))
  const cell = Math.max(12, Math.floor(Math.min(avail / (span + 2 * margin), 52)))
  const size = Math.round((span + 2 * margin) * cell)
  return { cell, size, cx: size / 2, cy: size / 2, wpx: w * cell, hpx: h * cell }
}

function frame(now) {
  raf = 0
  shots = shots.filter((s) => now - s.t0 < 380)
  const fading = hoverFade.tick(now)
  render(now)
  if (isAnimated() || shots.length || fading) kick()
}

function isAnimated() {
  return materialIsAnimated(params.material)
}

function render(now = performance.now()) {
  if (!level) return
  const g = computeGeo()
  const dpr = window.devicePixelRatio || 1
  ui.canvas.width = g.size * dpr
  ui.canvas.height = g.size * dpr
  ui.canvas.style.width = `${g.size}px`
  ui.canvas.style.height = `${g.size}px`
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = dark ? '#1c1c1f' : '#f7f7f5'
  ctx.fillRect(0, 0, g.size, g.size)

  const H = computeH(g)
  // board slab (also through H so the slab and arrows share one projection)
  const slab = new Path2D()
  const corners = [[-0.12, -0.12], [level.width + 0.12, -0.12], [level.width + 0.12, level.height + 0.12], [-0.12, level.height + 0.12]]
  corners.forEach(([x, y], i) => {
    const [sx, sy] = applyH(H, [x, y])
    if (i === 0) slab.moveTo(sx, sy); else slab.lineTo(sx, sy)
  })
  slab.closePath()
  ctx.fillStyle = dark ? '#26262a' : '#ffffff'
  ctx.fill(slab)

  // grid dots through H
  ctx.fillStyle = dark ? '#4a4a4f' : '#c9c9c6'
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const [sx, sy] = applyH(H, [x + 0.5, y + 0.5])
      ctx.fillRect(sx - 1, sy - 1, 2, 2)
    }

  for (const a of level.arrows) paintArrow(a, g, H, now)
  for (const sh of shots) drawShot(sh, g, H, now)
  renderPanel()
  ui._H = H; ui._geo = g
}

function drawShot(sh, g, H, now) {
  const t = Math.min(1, (now - sh.t0) / 320)
  const head = cellCenter(sh.cells[sh.cells.length - 1], level.width)
  const from = add(head, [DX[sh.dir] * 0.6, DY[sh.dir] * 0.6])
  const to = add(head, [DX[sh.dir] * (0.6 + 3 * t), DY[sh.dir] * (0.6 + 3 * t)])
  const [x0, y0] = applyH(H, from)
  const [x1, y1] = applyH(H, to)
  ctx.strokeStyle = '#e09a2b'
  ctx.lineWidth = Math.max(3, g.cell * params.shaftFull * 0.8)
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1 - t * 0.6
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  ctx.globalAlpha = 1
}

function materialLabel(id) {
  const m = findMaterial(id)
  return m ? `${m.name}${m.animated ? ' ✦' : ''} · ${m.vibe}` : id
}

/** FIX-032: one registry, one order -- the warm trio is just three more entries in it now. */
function allMaterialIds() {
  return MATERIALS.map((m) => m.id)
}

function renderPanel() {
  const lines = [
    `board ${ui.preset.value} seed ${ui.seed.value} (${level.width}x${level.height}, ${level.arrows.length} стрел)`,
    `осталось: ${board.remaining} · свободных: ${board.freeCount}${board.cleared ? ' · ВСЕ ВЫШЛИ' : ''}`,
    `геометрия: ONE filled path в board-space → homography на экран`,
    `материал: ${materialLabel(params.material)} · shaft ${params.shaftFull.toFixed(2)} · bend ${params.bendStyle} ${params.bend.toFixed(2)} · tilt ${params.tilt.toFixed(2)}`,
    `отступ от грида: tip ${params.tipPx}px · tail ${params.tailPx}px · cell ${Math.round(computeGeo().cell)}px`,
  ]
  ui.info.textContent = lines.join('\n')
}

function start() {
  const preset = PRESET_NAMES.includes(ui.preset.value) ? ui.preset.value : 'medium'
  const seed = Number(ui.seed.value) >>> 0
  const res = generateLevel(PRESETS[preset], seed)
  level = res.level
  board = BoardState.fromLevel(level)
  hover = -1
  shots = []
  flash = { blocked: -1, blocker: -1, t0: 0 }
  ui.msg.textContent = 'Клик по стрелке — выпустить её (правило canExit без изменений).'
  kick()
}

function tap(id) {
  if (id < 0 || board.cleared) return
  const r = board.tryRemove(id)
  if (!r.ok) {
    if (r.reason === 'blocked') {
      flash = { blocked: id, blocker: r.blocker, t0: performance.now() }
      ui.msg.textContent = `Стрелка #${id} заблокирована стрелкой #${r.blocker}.`
    }
    kick()
    return
  }
  flash = { blocked: -1, blocker: -1, t0: 0 }
  const a = level.arrows[id]
  shots.push({ cells: a.cells, dir: a.dir, t0: performance.now() })
  ui.msg.textContent = board.cleared ? 'Все стрелки вышли — board чист.' : `Стрелка #${id} вышла. Осталось ${board.remaining}.`
  kick()
}

/** Picking through the INVERSE homography — same board cells, same hitbox. */
function arrowAt(ev) {
  if (!level || !ui._H || !ui._geo) return -1
  const r = ui.canvas.getBoundingClientRect()
  const sx = ev.clientX - r.left
  const sy = ev.clientY - r.top
  const Hi = invertH(ui._H)
  const [bx, by] = applyH(Hi, [sx, sy])
  const x = Math.floor(bx)
  const y = Math.floor(by)
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return -1
  return board.ownerAt(y * level.width + x)
}

ui.canvas.addEventListener('pointermove', (ev) => {
  const id = arrowAt(ev)
  if (id !== hover) { hover = id; hoverFade.set(hover); kick() }
})
ui.canvas.addEventListener('pointerleave', () => { hover = -1; hoverFade.set(-1); kick() })
ui.canvas.addEventListener('click', (ev) => tap(arrowAt(ev)))

function setMaterial(m) {
  params.material = m
  ui.mat.value = m
  ui.matName.textContent = materialLabel(m)
  kick()
}
ui.mat.onchange = () => setMaterial(ui.mat.value)

function cycleMaterial(dir) {
  const ids = allMaterialIds()
  const i = ids.indexOf(params.material)
  setMaterial(ids[(i + dir + ids.length) % ids.length])
}

function syncLabels() {
  ui.shaftV.textContent = params.shaftFull.toFixed(2)
  ui.bendV.textContent = params.bend.toFixed(2)
  ui.tiltV.textContent = params.tilt.toFixed(2)
  ui.tipPxV.textContent = `${params.tipPx}px`
  ui.tailPxV.textContent = `${params.tailPx}px`
}
ui.shaft.oninput = () => { params.shaftFull = Number(ui.shaft.value); syncLabels(); kick() }
ui.bend.oninput = () => { params.bend = Number(ui.bend.value); syncLabels(); kick() }
ui.bendStyle.onchange = () => { params.bendStyle = ui.bendStyle.value; kick() }
ui.showIds.onchange = kick
ui.tilt.oninput = () => { params.tilt = Number(ui.tilt.value); syncLabels(); kick() }
ui.tipPx.oninput = () => { params.tipPx = Number(ui.tipPx.value); syncLabels(); kick() }
ui.tailPx.oninput = () => { params.tailPx = Number(ui.tailPx.value); syncLabels(); kick() }
$('undo').onclick = () => { if (board.undo() !== -1) { shots = []; ui.msg.textContent = 'undo'; kick() } }
$('reset').onclick = start
$('apply').onclick = start
window.addEventListener('resize', kick)
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === '1') setMaterial('warm-solid')
  else if (k === '2') setMaterial('warm-bevel')
  else if (k === '3') setMaterial('warm-magic')
  else if (k === '[') cycleMaterial(-1)
  else if (k === ']') cycleMaterial(1)
  else if (k === 'r') start()
  else return
  ev.preventDefault()
})

for (const n of PRESET_NAMES) ui.preset.append(new Option(n, n))
for (const id of allMaterialIds()) ui.mat.append(new Option(materialLabel(id), id))
ui.preset.value = 'medium'
ui.seed.value = '1'
ui.shaft.value = String(params.shaftFull)
ui.bend.value = String(params.bend)
ui.tilt.value = String(params.tilt)
ui.tipPx.value = String(params.tipPx)
ui.tailPx.value = String(params.tailPx)
syncLabels()
setMaterial('warm-bevel')
start()

