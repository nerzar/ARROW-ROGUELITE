// EXP-009 gray prologue viewer: play encounters 1 -> 2 -> 3 -> mini-boss back to back.
// Rendering and rules are the same EncounterState/EncounterDef engine as encounter.js (EXP-008);
// this file only adds a persistent controller on top: step sequencing, transition, restart,
// per-step seed candidate choice. No HP/timer mechanics from docs/COMBAT-RULES.md are implemented
// here (out of EXP-009 scope) -- see the encounter files' `notes` for what each slot is reserved for.
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
  validateEncounter,
} from '../dist/src/index.js'

const $ = (id) => document.getElementById(id)
const ui = {
  steps: $('steps'), stepTitle: $('stepTitle'), pick: $('pick'),
  restartStep: $('restartStep'), restartAll: $('restartAll'), liveCheck: $('liveCheck'),
  canvas: $('arena'), msg: $('msg'), status: $('status'), log: $('log'),
  why: $('why'), report: $('report'), analysis: $('analysis'),
  charges: $('charges'), rotCw: $('rotCw'), rotCcw: $('rotCcw'),
  overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayBody: $('overlayBody'), overlayNext: $('overlayNext'),
}
const ctx = ui.canvas.getContext('2d')
const ARROWS = ['↑', '→', '↓', '←']
const SIDE_RU = ['сверху (N)', 'справа (E)', 'снизу (S)', 'слева (W)']

// Ordered prologue. Steps 1-3 offer a seed shortlist to pick from; the mini-boss seed is fixed
// (medium seed 1571, chosen by the user -- see .orchestra/tasks/EXP-009-gray-prologue.md).
const STEPS = [
  { key: 'e1', title: 'Encounter 1', provisional: '../encounters/prologue-e1.json', shortlist: '../encounters/prologue-e1-shortlist.json' },
  { key: 'e2', title: 'Encounter 2', provisional: '../encounters/prologue-e2.json', shortlist: '../encounters/prologue-e2-shortlist.json' },
  { key: 'e3', title: 'Encounter 3', provisional: '../encounters/prologue-e3.json', shortlist: '../encounters/prologue-e3-shortlist.json' },
  { key: 'e4', title: 'Encounter 4 — mini-boss', provisional: '../encounters/prologue-e4-miniboss.json', shortlist: null },
]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

// ---------------------------------------------------------------------------------------------
// Prologue controller: which step we are on, which candidate each step currently uses.

const prologue = {
  stepIndex: 0,
  /** Per step: [{ key, label, raw, why }], candidates[stepIndex][0] is the provisional pick. */
  candidates: [],
  chosen: [0, 0, 0, 0],
}

async function loadCandidates() {
  for (const step of STEPS) {
    const list = []
    try {
      const prov = await fetchJson(step.provisional)
      list.push({ key: 'provisional', label: `provisional · seed ${prov.board.seed}`, raw: prov, why: null })
    } catch (e) {
      console.warn(e)
    }
    if (step.shortlist) {
      try {
        const sl = await fetchJson(step.shortlist)
        for (const c of sl.candidates) {
          if (c.rank === 1) continue // same board as the provisional file
          list.push({ key: `cand${c.rank}`, label: `#${c.rank} · seed ${c.seed} · score ${c.score}`, raw: c.file, why: c.why })
        }
      } catch (e) {
        console.warn(e)
      }
    }
    prologue.candidates.push(list)
  }
}

function fillPickForCurrentStep() {
  ui.pick.innerHTML = ''
  const list = prologue.candidates[prologue.stepIndex]
  for (const c of list) ui.pick.append(new Option(c.label, c.key))
  ui.pick.disabled = list.length <= 1
  const idx = Math.min(prologue.chosen[prologue.stepIndex], list.length - 1)
  ui.pick.selectedIndex = Math.max(0, idx)
}

function renderStepsBar() {
  ui.steps.innerHTML = ''
  STEPS.forEach((_step, i) => {
    const span = document.createElement('span')
    span.textContent = String(i + 1)
    if (i < prologue.stepIndex) span.className = 'done'
    else if (i === prologue.stepIndex) span.className = 'now'
    ui.steps.append(span)
  })
  ui.stepTitle.textContent = STEPS[prologue.stepIndex].title
}

// ---------------------------------------------------------------------------------------------
// Single-encounter play state (same shape as EXP-008's encounter.js).

let level = null
let def = null
let board = null
let s = null
let log = []
let hover = -1
let flash = { blocked: -1, blocker: -1 }
let live = null
let hint = null
let shownAngle = 0
let rotAnim = null
let shots = []
let bossFlash = 0
let geo = null
let overlayTimer = 0

function startStep() {
  hideOverlay()
  renderStepsBar()
  fillPickForCurrentStep()
  const cand = prologue.candidates[prologue.stepIndex][ui.pick.selectedIndex] ?? prologue.candidates[prologue.stepIndex][0]
  const raw = cand.raw
  try {
    const parsed = encounterFromJson(raw)
    level = parsed.level
    def = parsed.file.encounter
    board = parsed.file.board
  } catch (e) {
    ui.msg.innerHTML = `<span class="bad">${e.message}</span>`
    return
  }
  reset()
  const t0 = performance.now()
  const rep = validateEncounter(level, def)
  ui.report.textContent = `${formatEncounterReport(rep)}\n\n(${(performance.now() - t0).toFixed(0)} ms)`
  ui.analysis.textContent = formatSeedAnalysis(analyzeSeed(level))
  ui.why.textContent = cand.why ? cand.why.join('\n') : '(provisional pick, see encounter notes)'
}

function reset() {
  s = EncounterState.fromLevel(level, def)
  log = []
  shots = []
  rotAnim = null
  shownAngle = 0
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.canvas.style.opacity = '1'
  ui.msg.textContent = def.boss.phases.length > 1
    ? `Босс ${SIDE_RU[s.bossSide]}. Бей стрелками, которые туда смотрят.`
    : `Цель ${SIDE_RU[s.bossSide]}. Бей стрелками, которые туда смотрят.`
  afterAction()
}

function restartProlgoue() {
  prologue.stepIndex = 0
  startStep()
}

// ---------------------------------------------------------------------------------------------
// Actions

function tap(id) {
  if (s.over || rotAnim || overlayTimer) return
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
  if (r.won) text = `Цель выполнена. ${text}`
  else if (r.phaseAfter !== r.phaseBefore) {
    text += ` · Цель переместилась ${SIDE_RU[s.bossSide]}!`
    if (r.granted) text += ` Получен Rotate ×${r.granted}.`
  } else if (r.lost) text = `Поражение: стрелки кончились. ${text}`
  ui.msg.textContent = text
  log.push(`${formatAction({ kind: 'tap', id })}  ${DIR_NAMES[local]}→${DIR_NAMES[r.arenaDir]}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` +
    (r.phaseAfter !== r.phaseBefore ? (r.won ? '  WIN' : `  → phase ${r.phaseAfter + 1} (${DIR_NAMES[s.bossSide]})${r.granted ? ` +Rotate ${r.granted}` : ''}`) : ''))
  afterAction()
  if (r.won) scheduleWin()
  else if (r.lost) scheduleLoss()
}

function rotate(turn) {
  if (rotAnim || overlayTimer || !s.canRotate(turn)) return
  const from = s.rotation * 90
  s.rotate(turn)
  hint = null
  rotAnim = { from, to: from + turn * 90, t0: performance.now() }
  ui.msg.textContent = `Доска повернута ${turn === 1 ? 'по часовой' : 'против часовой'}. Все стрелки сменили сторону арены.`
  log.push(`${formatAction({ kind: 'rotate', turn })}  → ${s.rotation * 90}°`)
  afterAction()
}

function undo() {
  if (rotAnim || overlayTimer || !s.undo()) return
  log.pop()
  shots = []
  shownAngle = s.rotation * 90
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.msg.textContent = 'undo'
  afterAction()
}

function showHint() {
  if (s.over || overlayTimer) return
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
// Transition: encounter cleared -> short pause -> next step. Plain fade, no production animation.
// Remaining arrows are not cleared by hand: the fade covers them and the next step loads fresh.

function scheduleWin() {
  const last = prologue.stepIndex === STEPS.length - 1
  ui.canvas.style.opacity = '0.18'
  overlayTimer = setTimeout(() => showOverlay(last), 550)
}

function scheduleLoss() {
  ui.canvas.style.opacity = '0.5'
}

function showOverlay(last) {
  overlayTimer = 0
  ui.overlay.classList.add('show')
  if (last) {
    ui.overlayTitle.textContent = 'Пролог пройден'
    ui.overlayBody.textContent = `Mini-boss повержен. ${STEPS.length}/${STEPS.length} encounter'ов пройдено.`
    ui.overlayNext.textContent = 'restart prologue'
    ui.overlayNext.onclick = () => { hideOverlay(); restartProlgoue() }
  } else {
    ui.overlayTitle.textContent = `Encounter ${prologue.stepIndex + 1} пройден`
    ui.overlayBody.textContent = `→ ${STEPS[prologue.stepIndex + 1].title}`
    ui.overlayNext.textContent = 'next →'
    ui.overlayNext.onclick = () => { hideOverlay(); prologue.stepIndex++; startStep() }
    // Auto-advance so a full manual playthrough needs no extra clicks; still clickable to skip the wait.
    overlayTimer = setTimeout(() => { hideOverlay(); prologue.stepIndex++; startStep() }, 1400)
  }
}

function hideOverlay() {
  if (overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = 0
  ui.overlay.classList.remove('show')
}

// ---------------------------------------------------------------------------------------------
// Rendering (same canvas geometry/drawing as EXP-008's encounter.js).

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
  const avail = Math.max(260, Math.min(ui.canvas.parentElement.clientWidth - 16, window.innerHeight - 190))
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
  const label = s.won ? 'цель выполнена' : `HP ${s.hp}/${s.totalHp}` + (def.boss.phases.length > 1 ? ` · фаза ${s.phaseIndex + 1}/${def.boss.phases.length}` : '')
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
  const stroke = aims ? col.aim : free ? col.arrow : col.arrowDim
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const isHint = hint && hint.kind === 'tap' && hint.id === a.id
  if (a.id === hover || a.id === flash.blocked || a.id === flash.blocker || isHint) {
    ctx.strokeStyle = a.id === flash.blocked ? '#e53935' : a.id === flash.blocker ? '#fb8c00' : isHint ? '#43a047' : col.muted
    ctx.lineWidth = lw + 7
    polyline(pts)
  }
  ctx.setLineDash(free ? [] : [lw * 0.9, lw * 0.9])
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
  const state = s.won ? 'ЦЕЛЬ ВЫПОЛНЕНА' : s.lost ? 'ПОРАЖЕНИЕ (стрелки кончились)' : 'бой'
  const lines = [
    `${def.title ?? def.id}`,
    `Encounter ${prologue.stepIndex + 1}/${STEPS.length}`,
    `board ${board.preset} seed ${board.seed} (${level.width}x${level.height}, ${level.arrows.length} стрел) hash ${board.levelHash}`,
    '',
    `состояние:  ${state}`,
    `HP цели:    ${s.hp}/${s.totalHp}   ${'■'.repeat(s.hp)}${'□'.repeat(s.totalHp - s.hp)}`,
    def.boss.phases.length > 1
      ? `фаза:       ${Math.min(s.phaseIndex + 1, def.boss.phases.length)}/${def.boss.phases.length}` +
        (s.won ? '' : `  цель ${SIDE_RU[s.bossSide]}, до смены фазы ${s.phaseHpLeft} hp`)
      : `сторона:    ${SIDE_RU[s.bossSide]}`,
    `Rotate:     зарядов ${s.rotateCharges}, использовано ${s.rotatesUsed}, доска ${s.rotation * 90}°`,
    '',
    'боезапас (projectile budget) по сторонам арены (живые / свободные):',
    ...[0, 1, 2, 3].map((d) => `  ${ARROWS[d]} ${DIR_NAMES[d]}: ${String(alive[d]).padStart(2)} / ${String(free[d]).padStart(2)}${d === s.bossSide ? '   ← цель' : ''}`),
  ]
  if (live) {
    const yn = (r) => (r.win ? 'да' : r.proven ? 'нет' : '?')
    lines.push('', `победа достижима:               ${yn(live.any)}`, `…без новых Rotate:              ${yn(live.noMore)}`)
  }
  ui.status.textContent = lines.join('\n')
  ui.log.textContent = log.length ? log.map((l, i) => `${String(i + 1).padStart(2)}. ${l}`).join('\n') : '—'
  ui.charges.textContent = def.rotate.allow.length === 0 ? '' : s.rotateCharges > 0 ? `Rotate: ${s.rotateCharges}` : s.rotatesUsed ? 'Rotate использован' : 'Rotate ещё не получен'
  ui.rotCw.disabled = !s.canRotate(1)
  ui.rotCcw.disabled = !s.canRotate(-1)
  ui.rotCw.style.display = def.rotate.allow.includes(1) ? '' : 'none'
  ui.rotCcw.style.display = def.rotate.allow.includes(-1) ? '' : 'none'
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
$('hint').onclick = showHint
ui.restartStep.onclick = () => { hideOverlay(); startStep() }
ui.restartAll.onclick = () => { hideOverlay(); restartProlgoue() }
ui.liveCheck.onchange = afterAction
ui.pick.onchange = () => {
  prologue.chosen[prologue.stepIndex] = ui.pick.selectedIndex
  startStep()
}
window.addEventListener('resize', kick)
window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return
  const k = ev.key.toLowerCase()
  if (k === 'q') rotate(-1)
  else if (k === 'e') rotate(1)
  else if (k === 'z' || k === 'backspace') undo()
  else if (k === 'h') showHint()
  else return
  ev.preventDefault()
})

await loadCandidates()
startStep()

// Debug hook for automated play checks: client coordinates of an arrow's head cell, and prologue nav.
window.prologueDebug = {
  state: () => s,
  stepIndex: () => prologue.stepIndex,
  pointOf(id) {
    const head = level.arrows[id].cells.at(-1)
    const [x, y] = center(head)
    const p = boardMatrix(s.rotation * 90).transformPoint(new DOMPoint(x, y))
    const r = ui.canvas.getBoundingClientRect()
    return { x: r.left + p.x, y: r.top + p.y }
  },
}
