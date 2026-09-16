// EXP-008 mini-boss debug viewer: play one scripted encounter with grey placeholders.
// Plain JS on top of the compiled core; all rules live in dist/src (EncounterState, findWin).
import {
  analyzeSeed,
  DIR_NAMES,
  DX,
  DY,
  EncounterState,
  encounterFromJson,
  findWin,
  formatAction,
  formatEncounterReport,
  formatSeedAnalysis,
  generateLevel,
  levelHash,
  PRESET_NAMES,
  PRESETS,
  validateEncounter,
} from '../dist/src/index.js'

const $ = (id) => document.getElementById(id)
const ui = {
  pick: $('pick'), colorDirs: $('colorDirs'), showSteps: $('showSteps'), liveCheck: $('liveCheck'),
  canvas: $('arena'), msg: $('msg'), status: $('status'), log: $('log'), report: $('report'), analysis: $('analysis'),
  charges: $('charges'), rotCw: $('rotCw'), rotCcw: $('rotCcw'),
  cPreset: $('cPreset'), cSeed: $('cSeed'), cSide1: $('cSide1'), cHp1: $('cHp1'), cSide2: $('cSide2'), cHp2: $('cHp2'),
  cRot: $('cRot'), cCw: $('cCw'), cCcw: $('cCcw'),
}
const ctx = ui.canvas.getContext('2d')
const ARROWS = ['↑', '→', '↓', '←']
const SIDE_RU = ['сверху (N)', 'справа (E)', 'снизу (S)', 'слева (W)']
const DIR_HUE = [210, 25, 130, 290]

/** { key, label, raw } — raw is an arrow-core-encounter JSON object. */
let choices = []
let level = null
let def = null
let board = null
let s = null
let log = []
let hover = -1
let flash = { blocked: -1, blocker: -1 }
let live = null
let hint = null
// Animation state.
let shownAngle = 0
let rotAnim = null
let shots = []
let bossFlash = 0
let geo = null

// ---------------------------------------------------------------------------------------------
// Loading

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

async function loadChoices() {
  try {
    const prov = await fetchJson('../encounters/prologue-miniboss.json')
    choices.push({ key: 'provisional', label: `provisional · seed ${prov.board.seed}`, raw: prov })
  } catch (e) {
    console.warn(e)
  }
  try {
    const sl = await fetchJson('../encounters/shortlist.json')
    for (const c of sl.candidates) {
      const [h1, h2] = c.hp
      choices.push({ key: `cand${c.rank}`, label: `#${c.rank} · seed ${c.seed} · hp ${h1}+${h2} · score ${c.score}`, raw: c.file })
    }
  } catch (e) {
    console.warn(e)
  }
  for (const c of choices) ui.pick.append(new Option(c.label, c.key))
}

function readHash() {
  return new URLSearchParams(location.hash.slice(1))
}

function customRaw(p) {
  const preset = PRESET_NAMES.includes(p.get('preset')) ? p.get('preset') : 'medium'
  const seed = Number(p.get('seed') ?? 1) >>> 0
  const [h1, h2] = (p.get('hp') ?? '4,5').split(',').map(Number)
  const res = generateLevel(PRESETS[preset], seed)
  return {
    format: 'arrow-core-encounter',
    v: 1,
    board: { preset, seed, levelHash: res.level ? levelHash(res.level) : '' },
    encounter: {
      id: 'custom',
      title: 'Custom (hand-authored in viewer)',
      boss: {
        id: 'miniboss_placeholder',
        phases: [
          { side: p.get('side1') ?? 'E', hpUnits: h1 },
          { side: p.get('side2') ?? 'N', hpUnits: h2, grantRotate: Number(p.get('rot') ?? 1) },
        ],
      },
      rotate: { allow: (p.get('allow') ?? 'cw,ccw').split(',').filter(Boolean) },
    },
  }
}

function start(raw) {
  try {
    const parsed = encounterFromJson(raw)
    level = parsed.level
    def = parsed.file.encounter
    board = parsed.file.board
  } catch (e) {
    ui.msg.innerHTML = `<span class="bad">${e.message}</span>`
    return
  }
  fillCustomForm()
  reset()
  const t0 = performance.now()
  const rep = validateEncounter(level, def)
  ui.report.textContent = `${formatEncounterReport(rep)}\n\n(${(performance.now() - t0).toFixed(0)} ms)`
  ui.analysis.textContent = formatSeedAnalysis(analyzeSeed(level))
}

function reset() {
  s = EncounterState.fromLevel(level, def)
  log = []
  shots = []
  rotAnim = null
  shownAngle = 0
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.msg.textContent = `Босс ${SIDE_RU[s.bossSide]}. Бей стрелками, которые туда смотрят.`
  afterAction()
}

// ---------------------------------------------------------------------------------------------
// Actions

function tap(id) {
  if (s.over || rotAnim) return
  const local = level.arrows[id].dir
  const r = s.tap(id)
  hint = null
  if (!r.ok) {
    if (r.reason === 'blocked') {
      flash = { blocked: id, blocker: r.blocker }
      ui.msg.textContent = `Стрелка #${id} заблокирована стрелкой #${r.blocker}.`
    }
    render()
    return
  }
  flash = { blocked: -1, blocker: -1 }
  shots.push({ id, cells: level.arrows[id].cells, dir: local, hit: r.hit, t0: performance.now() })
  let text = `#${id} ${ARROWS[r.arenaDir]} ${r.hit ? 'попадание' : 'мимо'} · HP ${s.hp}/${s.totalHp}`
  if (r.won) text = `ПОБЕДА. ${text}`
  else if (r.phaseAfter !== r.phaseBefore) {
    text += ` · Босс переместился ${SIDE_RU[s.bossSide]}!`
    if (r.granted) text += ` Получен Rotate ×${r.granted}.`
  } else if (r.lost) text = `Поражение: стрелки кончились. ${text}`
  ui.msg.textContent = text
  log.push(`${formatAction({ kind: 'tap', id })}  ${DIR_NAMES[local]}→${DIR_NAMES[r.arenaDir]}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` +
    (r.phaseAfter !== r.phaseBefore ? (r.won ? '  WIN' : `  → phase ${r.phaseAfter + 1} (${DIR_NAMES[s.bossSide]})${r.granted ? ` +Rotate ${r.granted}` : ''}`) : ''))
  afterAction()
}

function rotate(turn) {
  if (rotAnim || !s.canRotate(turn)) return
  const from = s.rotation * 90
  s.rotate(turn)
  hint = null
  rotAnim = { from, to: from + turn * 90, t0: performance.now() }
  ui.msg.textContent = `Доска повернута ${turn === 1 ? 'по часовой' : 'против часовой'}. Все стрелки сменили сторону арены.`
  log.push(`${formatAction({ kind: 'rotate', turn })}  → ${s.rotation * 90}°`)
  afterAction()
}

function undo() {
  if (rotAnim || !s.undo()) return
  log.pop()
  shots = []
  shownAngle = s.rotation * 90
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.msg.textContent = 'undo'
  afterAction()
}

function showHint() {
  if (s.over) return
  const r = findWin(s, { nodeBudget: 500_000 })
  if (!r.win) {
    ui.msg.innerHTML = `<span class="bad">${r.proven ? 'Победа из этого состояния уже невозможна.' : 'Не удалось найти победу в пределах бюджета.'}</span>`
    return
  }
  hint = r.sequence[0]
  ui.msg.textContent = `Подсказка: ${hint.kind === 'tap' ? `стрелка #${hint.id}` : `Rotate ${hint.turn === 1 ? 'cw' : 'ccw'}`} (ведёт к победе за ${r.sequence.length} действий).`
  render()
}

function afterAction() {
  live = null
  if (ui.liveCheck.checked && !s.over) {
    const any = findWin(s, { nodeBudget: 300_000 })
    const noMore = findWin(s, { maxRotates: s.rotatesUsed, nodeBudget: 300_000 })
    live = { any, noMore }
  }
  renderPanel()
  kick()
}

// ---------------------------------------------------------------------------------------------
// Rendering

let raf = 0
function kick() {
  if (!raf) raf = requestAnimationFrame(frame)
}

function frame(now) {
  raf = 0
  let animating = false
  if (rotAnim) {
    const t = Math.min(1, (now - rotAnim.t0) / 260)
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    shownAngle = rotAnim.from + (rotAnim.to - rotAnim.from) * e
    if (t >= 1) {
      shownAngle = s.rotation * 90
      rotAnim = null
    } else animating = true
  }
  shots = shots.filter((sh) => now - sh.t0 < 360)
  for (const sh of shots) if (sh.hit && now - sh.t0 > 220 && !sh.flashed) {
    sh.flashed = true
    bossFlash = now
  }
  if (shots.length) animating = true
  if (now - bossFlash < 220) animating = true
  render(now)
  if (animating) kick()
}

function computeGeo() {
  const { width: w, height: h } = level
  const span = Math.max(w, h)
  const margin = 3.2
  const avail = Math.max(260, Math.min(ui.canvas.parentElement.clientWidth - 16, window.innerHeight - 150))
  const cell = Math.max(12, Math.floor(Math.min(avail / (span + 2 * margin), 52)))
  const size = Math.round((span + 2 * margin) * cell)
  return { w, h, cell, size, cx: size / 2, cy: size / 2, half: (span * cell) / 2, bossR: (span * cell) / 2 + 1.7 * cell }
}

function boardMatrix(angleDeg) {
  const g = geo
  return new DOMMatrix().translate(g.cx, g.cy).rotate(angleDeg).translate((-g.w * g.cell) / 2, (-g.h * g.cell) / 2)
}

function render(now = performance.now()) {
  if (!s) return
  geo = computeGeo()
  const g = geo
  const dpr = window.devicePixelRatio || 1
  ui.canvas.width = g.size * dpr
  ui.canvas.height = g.size * dpr
  ui.canvas.style.width = `${g.size}px`
  ui.canvas.style.height = `${g.size}px`
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  const col = {
    bg: dark ? '#1c1c1f' : '#f7f7f5', board: dark ? '#26262a' : '#ffffff', dot: dark ? '#4a4a4f' : '#c9c9c6',
    arrow: dark ? '#8c8c92' : '#9a9a96', arrowDim: dark ? '#55555a' : '#c4c4c0', aim: dark ? '#f2f2f2' : '#1f1f1f',
    boss: dark ? '#6d6d73' : '#8a8a86', bossDead: dark ? '#3a3a3e' : '#d6d6d2', text: dark ? '#eee' : '#111', muted: dark ? '#999' : '#777',
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = col.bg
  ctx.fillRect(0, 0, g.size, g.size)

  drawSides(col)
  drawBoss(col, now)

  ctx.save()
  ctx.setTransform(new DOMMatrix().scale(dpr, dpr).multiply(boardMatrix(shownAngle)))
  ctx.fillStyle = col.board
  ctx.fillRect(-4, -4, g.w * g.cell + 8, g.h * g.cell + 8)
  ctx.fillStyle = col.dot
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ctx.fillRect((x + 0.5) * g.cell - 1, (y + 0.5) * g.cell - 1, 2, 2)
  for (const a of level.arrows) drawArrow(a, col)
  for (const sh of shots) drawShot(sh, col, now)
  ctx.restore()

  renderPanel()
}

function drawSides(col) {
  const g = geo
  const alive = s.aliveByArenaDir()
  const free = s.aliveByArenaDir(true)
  ctx.font = `600 ${Math.max(11, Math.floor(g.cell * 0.36))}px system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let d = 0; d < 4; d++) {
    const r = g.bossR + 1.05 * g.cell
    const x = g.cx + DX[d] * r
    const y = g.cy + DY[d] * r
    const isBoss = d === s.bossSide
    ctx.fillStyle = isBoss ? col.text : col.muted
    const text = `${ARROWS[d]} ${alive[d]} (своб. ${free[d]})`
    ctx.save()
    ctx.translate(x, y)
    if (d === 1 || d === 3) ctx.rotate(d === 1 ? Math.PI / 2 : -Math.PI / 2)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
}

function drawBoss(col, now) {
  const g = geo
  const d = s.bossSide
  const deadSide = s.won ? def.boss.phases[def.boss.phases.length - 1].side : -1
  const side = d >= 0 ? d : deadSide
  if (side < 0) return
  const long = Math.min(g.half * 1.3, 5 * g.cell)
  const thick = 1.5 * g.cell
  const cx = g.cx + DX[side] * g.bossR
  const cy = g.cy + DY[side] * g.bossR
  const horizontal = side === 0 || side === 2
  const bw = horizontal ? long : thick
  const bh = horizontal ? thick : long
  const shake = now - bossFlash < 200 ? Math.sin((now - bossFlash) / 18) * 3 : 0
  ctx.save()
  ctx.translate(cx + (horizontal ? shake : DX[side] * Math.abs(shake)), cy + (horizontal ? DY[side] * Math.abs(shake) : shake))
  ctx.fillStyle = s.won ? col.bossDead : now - bossFlash < 120 ? '#ffffff' : col.boss
  roundRect(-bw / 2, -bh / 2, bw, bh, 8)
  ctx.fill()
  ctx.strokeStyle = col.text
  ctx.lineWidth = 1.5
  ctx.stroke()
  // HP pips.
  const n = s.totalHp
  const pip = Math.min((long - 16) / n, g.cell * 0.5)
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * pip
    const px = horizontal ? t : 0
    const py = horizontal ? 0 : t
    ctx.fillStyle = i < s.hp ? (dark() ? '#f2f2f2' : '#1f1f1f') : 'transparent'
    ctx.strokeStyle = dark() ? '#f2f2f2' : '#1f1f1f'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(px - pip * 0.35, py - pip * 0.35, pip * 0.7, pip * 0.7)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = col.text
  ctx.font = `600 ${Math.max(11, Math.floor(g.cell * 0.34))}px system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = s.won ? 'BOSS повержен' : `BOSS · фаза ${s.phaseIndex + 1}/${def.boss.phases.length} · HP ${s.hp}/${s.totalHp}`
  // Between the bar and the board for N/S, so it never collides with the side ammo counter.
  const ly = side === 2 ? cy - thick / 2 - 0.45 * g.cell : side === 0 ? cy + thick / 2 + 0.45 * g.cell : cy - long / 2 - 0.45 * g.cell
  const tw = ctx.measureText(label).width / 2 + 4
  ctx.fillText(label, Math.max(tw, Math.min(g.size - tw, cx)), Math.max(10, Math.min(g.size - 10, ly)))
}

const dark = () => matchMedia('(prefers-color-scheme: dark)').matches

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function center(c) {
  const x = c % geo.w
  return [(x + 0.5) * geo.cell, ((c - x) / geo.w + 0.5) * geo.cell]
}

function drawArrow(a, col) {
  const alive = s.board.isAlive(a.id)
  if (!alive) return
  const arena = s.arenaDir(a.id)
  const free = s.board.canExit(a.id)
  const aims = arena === s.bossSide
  const pts = a.cells.map(center)
  const lw = Math.max(3, geo.cell * 0.26)
  let stroke = aims ? col.aim : free ? col.arrow : col.arrowDim
  if (ui.colorDirs.checked) stroke = `hsl(${DIR_HUE[arena]} ${free ? 60 : 30}% ${dark() ? 60 : 45}%)`
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const isHint = hint && hint.kind === 'tap' && hint.id === a.id
  if (a.id === hover || a.id === flash.blocked || a.id === flash.blocker || isHint) {
    ctx.strokeStyle = a.id === flash.blocked ? '#e53935' : a.id === flash.blocker ? '#fb8c00' : isHint ? '#43a047' : col.muted
    ctx.lineWidth = lw + 7
    polyline(pts)
  }
  if (free) {
    ctx.setLineDash([])
  } else {
    ctx.setLineDash([lw * 0.9, lw * 0.9])
  }
  ctx.strokeStyle = stroke
  ctx.lineWidth = lw
  polyline(pts)
  ctx.setLineDash([])
  const [hx, hy] = pts[pts.length - 1]
  const d = a.dir
  const sz = geo.cell * 0.38
  ctx.fillStyle = stroke
  ctx.beginPath()
  ctx.moveTo(hx + DX[d] * sz, hy + DY[d] * sz)
  ctx.lineTo(hx - DY[d] * sz * 0.8, hy + DX[d] * sz * 0.8)
  ctx.lineTo(hx + DY[d] * sz * 0.8, hy - DX[d] * sz * 0.8)
  ctx.closePath()
  ctx.fill()

  if (ui.showSteps.checked) {
    const [tx, ty] = pts[0]
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate((-shownAngle * Math.PI) / 180)
    ctx.font = `600 ${Math.max(9, Math.floor(geo.cell * 0.3))}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = col.bg
    ctx.fillRect(-geo.cell * 0.28, -geo.cell * 0.2, geo.cell * 0.56, geo.cell * 0.4)
    ctx.fillStyle = col.text
    ctx.fillText(String(a.id), 0, 1)
    ctx.restore()
  }
}

function drawShot(sh, col, now) {
  const t = Math.min(1, (now - sh.t0) / 300)
  const [hx, hy] = center(sh.cells[sh.cells.length - 1])
  const dist = (Math.max(geo.w, geo.h) + 3) * geo.cell * t
  const x = hx + DX[sh.dir] * dist
  const y = hy + DY[sh.dir] * dist
  ctx.strokeStyle = sh.hit ? col.aim : col.arrowDim
  ctx.lineWidth = Math.max(3, geo.cell * 0.22)
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1 - t * 0.5
  ctx.beginPath()
  ctx.moveTo(x - DX[sh.dir] * geo.cell * 0.9, y - DY[sh.dir] * geo.cell * 0.9)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function polyline(pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function renderPanel() {
  const alive = s.aliveByArenaDir()
  const free = s.aliveByArenaDir(true)
  const state = s.won ? 'ПОБЕДА' : s.lost ? 'ПОРАЖЕНИЕ (стрелки кончились)' : 'бой'
  const lines = [
    `${def.title ?? def.id}`,
    `board ${board.preset} seed ${board.seed} (${level.width}x${level.height}, ${level.arrows.length} стрел) hash ${board.levelHash}`,
    '',
    `состояние:  ${state}`,
    `HP босса:   ${s.hp}/${s.totalHp}   ${'■'.repeat(s.hp)}${'□'.repeat(s.totalHp - s.hp)}`,
    `фаза:       ${Math.min(s.phaseIndex + 1, def.boss.phases.length)}/${def.boss.phases.length}` +
      (s.won ? '' : `  босс ${SIDE_RU[s.bossSide]}, до смены фазы ${s.phaseHpLeft} hp`),
    `Rotate:     зарядов ${s.rotateCharges}, использовано ${s.rotatesUsed}, доска ${s.rotation * 90}°`,
    '',
    'боезапас по сторонам арены (живые / свободные):',
    ...[0, 1, 2, 3].map((d) => `  ${ARROWS[d]} ${DIR_NAMES[d]}: ${String(alive[d]).padStart(2)} / ${String(free[d]).padStart(2)}${d === s.bossSide ? '   ← босс' : ''}`),
    '',
    'фазы:',
    ...def.boss.phases.map((p, i) => `  ${i === s.phaseIndex ? '▶' : ' '} ${i + 1}. ${DIR_NAMES[p.side]} ${p.hpUnits} hp${p.grantRotate ? `, Rotate +${p.grantRotate}` : ''}${p.label ? ` — ${p.label}` : ''}`),
  ]
  if (live) {
    const yn = (r) => (r.win ? 'да' : r.proven ? 'нет' : '?')
    lines.push(
      '',
      `победа достижима:               ${yn(live.any)}`,
      `…без новых Rotate:              ${yn(live.noMore)}`,
    )
  }
  ui.status.textContent = lines.join('\n')
  ui.log.textContent = log.length ? log.map((l, i) => `${String(i + 1).padStart(2)}. ${l}`).join('\n') : '—'
  ui.charges.textContent = s.rotateCharges > 0 ? `Rotate: ${s.rotateCharges}` : s.rotatesUsed ? 'Rotate использован' : 'Rotate ещё не получен'
  ui.rotCw.disabled = !s.canRotate(1)
  ui.rotCcw.disabled = !s.canRotate(-1)
  ui.rotCw.style.outline = hint && hint.kind === 'rotate' && hint.turn === 1 ? '3px solid #43a047' : ''
  ui.rotCcw.style.outline = hint && hint.kind === 'rotate' && hint.turn === -1 ? '3px solid #43a047' : ''
}

// ---------------------------------------------------------------------------------------------
// Input

function arrowAt(ev) {
  if (!geo || rotAnim) return -1
  const r = ui.canvas.getBoundingClientRect()
  const p = boardMatrix(s.rotation * 90).inverse().transformPoint(new DOMPoint(ev.clientX - r.left, ev.clientY - r.top))
  const x = Math.floor(p.x / geo.cell)
  const y = Math.floor(p.y / geo.cell)
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return -1
  return s.board.ownerAt(y * level.width + x)
}

ui.canvas.addEventListener('pointermove', (ev) => {
  const id = arrowAt(ev)
  if (id !== hover) {
    hover = id
    kick()
  }
})
ui.canvas.addEventListener('pointerleave', () => {
  hover = -1
  kick()
})
ui.canvas.addEventListener('click', (ev) => {
  const id = arrowAt(ev)
  if (id !== -1) tap(id)
})
ui.rotCw.onclick = () => rotate(1)
ui.rotCcw.onclick = () => rotate(-1)
$('undo').onclick = undo
$('reset').onclick = reset
$('hint').onclick = showHint
ui.colorDirs.onchange = kick
ui.showSteps.onchange = kick
ui.liveCheck.onchange = afterAction
window.addEventListener('resize', kick)
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === 'q') rotate(-1)
  else if (k === 'e') rotate(1)
  else if (k === 'z' || k === 'backspace') undo()
  else if (k === 'r') reset()
  else if (k === 'h') showHint()
  else return
  ev.preventDefault()
})

ui.pick.onchange = () => {
  history.replaceState(null, '', `#pick=${ui.pick.value}`)
  const c = choices.find((x) => x.key === ui.pick.value)
  if (c) start(c.raw)
}

// Hand-authoring form: any preset/seed, sides, HP split, Rotate charges.
for (const n of PRESET_NAMES) ui.cPreset.append(new Option(n, n))
for (const sel of [ui.cSide1, ui.cSide2]) for (const n of DIR_NAMES) sel.append(new Option(n, n))
function fillCustomForm() {
  ui.cPreset.value = board.preset
  ui.cSeed.value = String(board.seed)
  ui.cSide1.value = DIR_NAMES[def.boss.phases[0].side]
  ui.cHp1.value = String(def.boss.phases[0].hpUnits)
  const p2 = def.boss.phases[1] ?? def.boss.phases[0]
  ui.cSide2.value = DIR_NAMES[p2.side]
  ui.cHp2.value = String(p2.hpUnits)
  ui.cRot.value = String(p2.grantRotate ?? 0)
  ui.cCw.checked = def.rotate.allow.includes(1)
  ui.cCcw.checked = def.rotate.allow.includes(-1)
}
$('cApply').onclick = () => {
  const allow = [ui.cCw.checked && 'cw', ui.cCcw.checked && 'ccw'].filter(Boolean).join(',')
  const q = `preset=${ui.cPreset.value}&seed=${Number(ui.cSeed.value) >>> 0}&side1=${ui.cSide1.value}&side2=${ui.cSide2.value}` +
    `&hp=${ui.cHp1.value},${ui.cHp2.value}&rot=${ui.cRot.value}&allow=${allow}`
  history.replaceState(null, '', `#${q}`)
  ui.pick.value = ''
  start(customRaw(readHash()))
}

await loadChoices()
const p = readHash()
if (p.has('seed')) {
  ui.pick.value = ''
  start(customRaw(p))
} else {
  const key = p.get('pick') ?? choices[0]?.key
  ui.pick.value = key ?? ''
  const c = choices.find((x) => x.key === key) ?? choices[0]
  if (c) start(c.raw)
  else ui.msg.textContent = 'нет encounters/*.json — запустите npm run cli -- shortlist'
}

// Debug hook for automated play checks: client coordinates of an arrow's head cell.
window.encounterDebug = {
  state: () => s,
  pointOf(id) {
    const head = level.arrows[id].cells.at(-1)
    const [x, y] = center(head)
    const p = boardMatrix(s.rotation * 90).transformPoint(new DOMPoint(x, y))
    const r = ui.canvas.getBoundingClientRect()
    return { x: r.left + p.x, y: r.top + p.y }
  },
}
