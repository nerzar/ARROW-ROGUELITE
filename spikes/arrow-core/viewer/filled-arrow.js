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
} from './filled-arrow-geom.js'

const $ = (id) => document.getElementById(id)
const ui = {
  canvas: $('board'), msg: $('msg'), info: $('info'),
  preset: $('preset'), seed: $('seed'),
  matSolid: $('mSolid'), matBevel: $('mBevel'), matMagic: $('mMagic'),
  shaft: $('shaft'), shaftV: $('shaftV'),
  bend: $('bend'), bendV: $('bendV'),
  bendStyle: $('bendStyle'),
  showIds: $('showIds'),
  tilt: $('tilt'), tiltV: $('tiltV'),
}
const ctx = ui.canvas.getContext('2d')

let level = null
let board = null
let hover = -1
let flash = { blocked: -1, blocker: -1, t0: 0 }
let shots = []
let shownAngle = 0 // no rotation in this demo; homography tilt covers the projection story
let magicT0 = performance.now()

const params = {
  material: 'solid', // solid | bevel | magic
  shaftFull: 0.35,   // full shaft width, in cell units (open question default)
  bend: 0.30,        // corner-cut radius, in cell units
  bendStyle: 'arc',  // arc (fantasy) | chamfer
  tilt: 0,           // perspective amount for the homography demo
  headLen: 0.62,
  headHalf: 0.42,
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

const WARM = {
  base: '#e09a2b', hot: '#f4b942', deep: '#8a5210', edge: '#6e3f0c',
  light: 'rgba(255,236,200,0.85)', glow: 'rgba(255,157,46,0.9)',
}

function paintArrow(a, geo, H, now) {
  const free = board.canExit(a.id)
  const alive = board.isAlive(a.id)
  if (!alive) return
  const geom = buildFilledArrow(a.cells, a.dir, level.width, params, DX, DY)
  // clear per-frame flags
  for (const n of geom.outline) delete n.skipped
  const { path, bbox } = pathThroughH(geom.outline, H)
  const isHover = a.id === hover
  const isFlash = a.id === flash.blocked || a.id === flash.blocker
  ctx.save()
  if (!free) ctx.globalAlpha = 0.45
  if (params.material === 'solid') paintSolid(path)
  else if (params.material === 'bevel') paintBevel(path, geo, bbox)
  else paintMagic(path, geo, bbox, now)
  if (isHover || isFlash) {
    ctx.strokeStyle = a.id === flash.blocked ? '#e53935' : a.id === flash.blocker ? '#fb8c00' : 'rgba(60,40,10,0.65)'
    ctx.lineWidth = Math.max(2, geo.cell * 0.06)
    ctx.stroke(path)
  }
  ctx.restore()

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

function paintSolid(path) {
  ctx.fillStyle = WARM.base
  ctx.fill(path)
}

function paintBevel(path, geo, bb) {
  // dark edge underlay
  ctx.strokeStyle = WARM.edge
  ctx.lineWidth = Math.max(3, geo.cell * 0.10)
  ctx.lineJoin = 'round'
  ctx.stroke(path)
  // warm vertical gradient body
  const g = ctx.createLinearGradient(0, bb.y0, 0, bb.y1)
  g.addColorStop(0, WARM.hot)
  g.addColorStop(0.55, WARM.base)
  g.addColorStop(1, WARM.deep)
  ctx.fillStyle = g
  ctx.fill(path)
  // top-light bevel highlight clipped to the shape
  ctx.save()
  ctx.clip(path)
  ctx.strokeStyle = WARM.light
  ctx.lineWidth = Math.max(2, geo.cell * 0.07)
  ctx.globalAlpha *= 0.8
  ctx.stroke(path)
  ctx.restore()
}

function paintMagic(path, geo, bb, now) {
  const t = (now - magicT0) / 1000
  // glow body
  ctx.save()
  ctx.shadowColor = WARM.glow
  ctx.shadowBlur = geo.cell * (0.7 + 0.25 * Math.sin(t * 3))
  ctx.fillStyle = '#c97a1e'
  ctx.fill(path)
  ctx.restore()
  // animated sheen band clipped to the shape
  ctx.save()
  ctx.clip(path)
  const x = bb.x0 + ((t * 0.35) % 1.4 - 0.2) * (bb.x1 - bb.x0)
  const g = ctx.createLinearGradient(x - geo.cell, 0, x + geo.cell, 0)
  g.addColorStop(0, 'rgba(255,220,150,0)')
  g.addColorStop(0.5, 'rgba(255,230,170,0.75)')
  g.addColorStop(1, 'rgba(255,220,150,0)')
  ctx.fillStyle = g
  ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0)
  // bright rim
  ctx.strokeStyle = 'rgba(255,214,140,0.9)'
  ctx.lineWidth = Math.max(1.5, geo.cell * 0.045)
  ctx.stroke(path)
  ctx.restore()
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
  render(now)
  if (params.material === 'magic' || shots.length) kick()
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

function renderPanel() {
  const lines = [
    `board ${ui.preset.value} seed ${ui.seed.value} (${level.width}x${level.height}, ${level.arrows.length} стрел)`,
    `осталось: ${board.remaining} · свободных: ${board.freeCount}${board.cleared ? ' · ВСЕ ВЫШЛИ' : ''}`,
    `геометрия: ONE filled path в board-space → homography на экран`,
    `материал: ${params.material} (1/2/3) · shaft ${params.shaftFull.toFixed(2)} · bend ${params.bendStyle} ${params.bend.toFixed(2)} · tilt ${params.tilt.toFixed(2)}`,
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
  if (id !== hover) { hover = id; kick() }
})
ui.canvas.addEventListener('pointerleave', () => { hover = -1; kick() })
ui.canvas.addEventListener('click', (ev) => tap(arrowAt(ev)))

function setMaterial(m) {
  params.material = m
  ui.matSolid.checked = m === 'solid'
  ui.matBevel.checked = m === 'bevel'
  ui.matMagic.checked = m === 'magic'
  kick()
}
ui.matSolid.onchange = () => setMaterial('solid')
ui.matBevel.onchange = () => setMaterial('bevel')
ui.matMagic.onchange = () => setMaterial('magic')

function syncLabels() {
  ui.shaftV.textContent = params.shaftFull.toFixed(2)
  ui.bendV.textContent = params.bend.toFixed(2)
  ui.tiltV.textContent = params.tilt.toFixed(2)
}
ui.shaft.oninput = () => { params.shaftFull = Number(ui.shaft.value); syncLabels(); kick() }
ui.bend.oninput = () => { params.bend = Number(ui.bend.value); syncLabels(); kick() }
ui.bendStyle.onchange = () => { params.bendStyle = ui.bendStyle.value; kick() }
ui.showIds.onchange = kick
ui.tilt.oninput = () => { params.tilt = Number(ui.tilt.value); syncLabels(); kick() }
$('undo').onclick = () => { if (board.undo() !== -1) { shots = []; ui.msg.textContent = 'undo'; kick() } }
$('reset').onclick = start
$('apply').onclick = start
window.addEventListener('resize', kick)
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === '1') setMaterial('solid')
  else if (k === '2') setMaterial('bevel')
  else if (k === '3') setMaterial('magic')
  else if (k === 'r') start()
  else return
  ev.preventDefault()
})

for (const n of PRESET_NAMES) ui.preset.append(new Option(n, n))
ui.preset.value = 'medium'
ui.seed.value = '1'
ui.shaft.value = String(params.shaftFull)
ui.bend.value = String(params.bend)
ui.tilt.value = String(params.tilt)
syncLabels()
setMaterial('solid')
start()

