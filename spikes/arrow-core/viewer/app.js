// Debug viewer. Plain JS on top of the compiled core; no framework, no styling ambitions.
import {
  BoardState,
  BoardTopology,
  computeMetrics,
  DIR_NAMES,
  DX,
  DY,
  generateLevel,
  levelHash,
  levelToJson,
  peelLayers,
  PRESET_NAMES,
  PRESETS,
} from '../dist/src/index.js'

const $ = (id) => document.getElementById(id)
const ui = {
  preset: $('preset'), seed: $('seed'), step: $('step'), stepLabel: $('stepLabel'),
  showSteps: $('showSteps'), showFree: $('showFree'), colorLayers: $('colorLayers'), showRay: $('showRay'),
  canvas: $('board'), info: $('info'), msg: $('msg'),
}
const ctx = ui.canvas.getContext('2d')

let level = null
let topo = null
let state = null
let gen = null
let layerOf = []
let stepOf = []
let hover = -1
let flash = { blocked: -1, blocker: -1 }
let cell = 32

for (const name of PRESET_NAMES) ui.preset.append(new Option(`${name} (${PRESETS[name].width}x${PRESETS[name].height})`, name))

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  ui.preset.value = PRESET_NAMES.includes(p.get('preset')) ? p.get('preset') : 'medium'
  ui.seed.value = String(Number(p.get('seed') ?? 1) >>> 0)
}

function writeHash() {
  history.replaceState(null, '', `#preset=${ui.preset.value}&seed=${ui.seed.value}`)
}

function load() {
  writeHash()
  const t0 = performance.now()
  gen = generateLevel(PRESETS[ui.preset.value], Number(ui.seed.value) >>> 0)
  gen.ms = performance.now() - t0
  level = gen.level
  if (!level) {
    ui.msg.textContent = 'генерация не удалась'
    return
  }
  topo = BoardTopology.fromLevel(level)
  layerOf = new Array(level.arrows.length).fill(-1)
  peelLayers(topo).layers.forEach((layer, k) => layer.forEach((id) => (layerOf[id] = k)))
  stepOf = new Array(level.arrows.length)
  level.solution.forEach((id, i) => (stepOf[id] = i + 1))
  ui.step.max = String(level.solution.length)
  ui.step.value = '0'
  ui.msg.textContent = ''
  applyStep()
}

function applyStep() {
  state = new BoardState(topo)
  const k = Number(ui.step.value)
  for (let i = 0; i < k; i++) state.remove(level.solution[i])
  flash = { blocked: -1, blocker: -1 }
  render()
}

function color(id) {
  if (ui.colorLayers.checked) {
    const depth = Math.max(1, ...layerOf) || 1
    return `hsl(${120 - (120 * layerOf[id]) / depth} 65% 45%)`
  }
  return `hsl(${(id * 137.508) % 360} 55% 50%)`
}

function center(c) {
  const x = c % level.width
  return [(x + 0.5) * cell, ((c - x) / level.width + 0.5) * cell]
}

function render() {
  const { width: w, height: h } = level
  const avail = Math.min(ui.canvas.parentElement.clientWidth - 16, window.innerHeight - 160)
  cell = Math.max(10, Math.floor(Math.min(avail / w, avail / h, 56)))
  const dpr = window.devicePixelRatio || 1
  ui.canvas.width = w * cell * dpr
  ui.canvas.height = h * cell * dpr
  ui.canvas.style.width = `${w * cell}px`
  ui.canvas.style.height = `${h * cell}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  ctx.fillStyle = dark ? '#202023' : '#fbfbfa'
  ctx.fillRect(0, 0, w * cell, h * cell)

  ctx.fillStyle = dark ? '#555' : '#bbb'
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ctx.fillRect((x + 0.5) * cell - 1, (y + 0.5) * cell - 1, 2, 2)

  // Hovered arrow's escape ray.
  if (ui.showRay.checked && hover !== -1 && state.isAlive(hover)) {
    const hc = topo.head(hover)
    const d = topo.dirs[hover]
    let x = (hc % w) + DX[d]
    let y = Math.floor(hc / w) + DY[d]
    while (x >= 0 && y >= 0 && x < w && y < h) {
      const blocked = state.ownerAt(y * w + x) !== -1
      ctx.fillStyle = blocked ? 'rgba(230,40,40,0.28)' : 'rgba(40,160,230,0.22)'
      ctx.fillRect(x * cell, y * cell, cell, cell)
      x += DX[d]
      y += DY[d]
    }
  }

  for (const a of level.arrows) drawArrow(a, dark)

  const k = Number(ui.step.value)
  ui.stepLabel.textContent = `ход ${k}/${level.solution.length} · осталось ${state.remaining} · свободно ${state.freeCount}`
  renderInfo()
}

function drawArrow(a, dark) {
  const alive = state.isAlive(a.id)
  const pts = a.cells.map(center)
  const lw = Math.max(3, cell * 0.28)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(alive ? [] : [3, 5])
  ctx.globalAlpha = alive ? 1 : 0.18

  const free = alive && state.canExit(a.id)
  if (alive && ((ui.showFree.checked && free) || a.id === hover || a.id === flash.blocked || a.id === flash.blocker)) {
    ctx.strokeStyle = a.id === flash.blocked ? '#e11' : a.id === flash.blocker ? '#f90' : dark ? '#fff' : '#111'
    ctx.lineWidth = lw + (a.id === hover ? 7 : 5)
    polyline(pts)
  }
  ctx.strokeStyle = color(a.id)
  ctx.lineWidth = lw
  polyline(pts)

  const [hx, hy] = pts[pts.length - 1]
  const d = a.dir
  const s = cell * 0.36
  ctx.fillStyle = color(a.id)
  ctx.beginPath()
  ctx.moveTo(hx + DX[d] * s, hy + DY[d] * s)
  ctx.lineTo(hx - DY[d] * s * 0.8, hy + DX[d] * s * 0.8)
  ctx.lineTo(hx + DY[d] * s * 0.8, hy - DX[d] * s * 0.8)
  ctx.closePath()
  ctx.fill()
  ctx.setLineDash([])

  if (ui.showSteps.checked && cell >= 16) {
    const [tx, ty] = pts[0]
    const label = String(stepOf[a.id])
    ctx.font = `600 ${Math.max(9, Math.floor(cell * 0.34))}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width + 6
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)'
    ctx.fillRect(tx - tw / 2, ty - cell * 0.22, tw, cell * 0.44)
    ctx.fillStyle = dark ? '#fff' : '#000'
    ctx.fillText(label, tx, ty + 1)
  }
  ctx.globalAlpha = 1
}

function polyline(pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function renderInfo() {
  const m = computeMetrics(level, topo)
  const lines = [
    `preset ${ui.preset.value}  seed ${ui.seed.value}`,
    `accepted ${gen.ok}  attempts ${gen.attempts}  ${gen.ms.toFixed(2)} ms`,
    `hash ${levelHash(level)}`,
    '',
    `solution (arrow ids): ${level.solution.join(' ')}`,
    '',
  ]
  if (hover !== -1) {
    lines.push(
      `hover arrow ${hover}: dir ${DIR_NAMES[topo.dirs[hover]]}, len ${level.arrows[hover].cells.length}, ` +
        `step #${stepOf[hover]}, layer ${layerOf[hover]}`,
      `  blockers now: [${state.isAlive(hover) ? state.blockers(hover).join(', ') : '—'}]`,
      '',
    )
  }
  const { dirCounts, ...rest } = m
  lines.push(`dirCounts N/E/S/W: ${dirCounts.join(' / ')}`)
  for (const [k, v] of Object.entries(rest)) lines.push(`${k}: ${Number.isInteger(v) ? v : v.toFixed(3)}`)
  lines.push('', 'level json:', JSON.stringify(levelToJson(level)))
  ui.info.textContent = lines.join('\n')
}

function arrowAt(ev) {
  const r = ui.canvas.getBoundingClientRect()
  const x = Math.floor((ev.clientX - r.left) / cell)
  const y = Math.floor((ev.clientY - r.top) / cell)
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return -1
  return state.ownerAt(y * level.width + x)
}

ui.canvas.addEventListener('pointermove', (ev) => {
  const id = arrowAt(ev)
  if (id !== hover) {
    hover = id
    render()
  }
})
ui.canvas.addEventListener('pointerleave', () => {
  hover = -1
  render()
})
ui.canvas.addEventListener('click', (ev) => {
  const id = arrowAt(ev)
  if (id === -1) return
  const r = state.tryRemove(id)
  const name = (i) => `шаг #${stepOf[i]} (id ${i})`
  if (r.ok) {
    flash = { blocked: -1, blocker: -1 }
    ui.msg.textContent = state.cleared ? 'поле очищено' : `стрелка ${name(id)} ушла на ${DIR_NAMES[topo.dirs[id]]}`
  } else {
    flash = { blocked: id, blocker: r.blocker }
    ui.msg.textContent = `стрелка ${name(id)} заблокирована стрелкой ${name(r.blocker)}`
  }
  hover = -1
  render()
})

const setSeed = (v) => {
  ui.seed.value = String(v >>> 0)
  load()
}
const setStep = (v) => {
  ui.step.value = String(Math.max(0, Math.min(level.solution.length, v)))
  applyStep()
}
$('prevSeed').onclick = () => setSeed(Number(ui.seed.value) - 1)
$('nextSeed').onclick = () => setSeed(Number(ui.seed.value) + 1)
$('randSeed').onclick = () => setSeed(Math.floor(Math.random() * 2 ** 32))
$('stepFirst').onclick = () => setStep(0)
$('stepPrev').onclick = () => setStep(Number(ui.step.value) - 1)
$('stepNext').onclick = () => setStep(Number(ui.step.value) + 1)
$('stepLast').onclick = () => setStep(level.solution.length)
ui.step.oninput = applyStep
ui.preset.onchange = load
ui.seed.onchange = load
for (const el of [ui.showSteps, ui.showFree, ui.colorLayers, ui.showRay]) el.onchange = render
window.addEventListener('resize', () => level && render())
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement && ev.target.type === 'number') return
  if (ev.key === 'ArrowLeft') setSeed(Number(ui.seed.value) - 1)
  else if (ev.key === 'ArrowRight') setSeed(Number(ui.seed.value) + 1)
  else if (ev.key === '[') setStep(Number(ui.step.value) - 1)
  else if (ev.key === ']') setStep(Number(ui.step.value) + 1)
  else if (ev.key === 'Home') setStep(0)
  else if (ev.key === 'End') setStep(level.solution.length)
  else if (ev.key === 'r' || ev.key === 'R') setSeed(Math.floor(Math.random() * 2 ** 32))
  else return
  ev.preventDefault()
})

readHash()
load()
