// EXP-013 debug viewer: ONE fixed encounter (encounters/rock-spike.json), no RunState chaining, no
// candidate picker -- deliberately separate from cp-prologue.js so the accepted prologue/Act I content
// is untouched. Rendering is adapted from cp-prologue.js's enemies-mode path (same board-geometry
// helpers), with EXP-013 additions: THROW IN N next to ATTACK IN N, a rock marker + remaining-turns
// text on pinned arrows, and "PINNED / BLOCKED BY ROCK" / "ROCK THROWN" / "UNPINNED" feedback.
import {
  describeAbility,
  DIR_NAMES,
  DX,
  DY,
  encounterFromJson,
  EncounterState,
  findWin,
  formatAction,
  formatEncounterReport,
  validateEncounter,
} from '../dist/src/index.js'

const $ = (id) => document.getElementById(id)
const ui = {
  hpText: $('hpText'), hpPips: $('hpPips'), restart: $('restart'), liveCheck: $('liveCheck'),
  wrap: $('wrap'), canvas: $('arena'), msg: $('msg'), status: $('status'), log: $('log'),
  why: $('why'), report: $('report'),
}
const ctx = ui.canvas.getContext('2d')
const ARROWS = ['↑', '→', '↓', '←']
const SIDE_RU = ['сверху (N)', 'справа (E)', 'снизу (S)', 'слева (W)']

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

let level = null
let def = null
let board = null
let maxHp = 10
let s = null

let log = []
let hover = -1
let flash = { blocked: -1, blocker: -1 }
let hint = null
let shots = []
let bossFlash = 0
let enemyFlash = {}
let geo = null

function start() {
  s = EncounterState.fromLevel(level, def, maxHp)
  resetLocalUi()
}

function resetLocalUi() {
  log = []
  shots = []
  enemyFlash = {}
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.canvas.style.opacity = '1'
  ui.wrap.classList.remove('hit')
  const names = s.enemies.map((e) => `${e.label ?? e.id} ${SIDE_RU[e.side]}`).join(', ')
  const abs = def.enemies.filter((e) => e.ability).map((e) => `${e.label ?? e.id}: ${describeAbility(e.ability)}`).join('; ')
  ui.msg.textContent = `Враг: ${names}.${abs ? ` Способности — ${abs}.` : ''}`
  const help = $('encHelp')
  if (help) {
    help.textContent = def.enemies.some((e) => (e.ability?.kind ?? 'stone_throw') === 'shield')
      ? 'Щит поднимается по countdown и поглощает ровно одно попадание без урона, затем падает. Счётчик SHIELD IN тикает каждый world turn.'
      : 'Камень по countdown временно PINNED одну свободную стрелку.'
  }
  const title = $('encTitle')
  if (title) title.textContent = `${def.title ?? def.id} · ${encName}.json`
  document.title = def.title ?? def.id
  const rep = validateEncounter(level, def, { playerHp: maxHp })
  ui.report.textContent = formatEncounterReport(rep)
  afterAction()
}

function flashHit() {
  ui.wrap.classList.add('hit')
  setTimeout(() => ui.wrap.classList.remove('hit'), 220)
}

function tap(id) {
  if (s.over) return
  const local = level.arrows[id].dir
  const r = s.tap(id)
  hint = null
  if (!r.ok) {
    if (r.reason === 'blocked') {
      flash = { blocked: id, blocker: r.blocker }
      let text = `Стрелка #${id} заблокирована стрелкой #${r.blocker}.`
      if (r.damage > 0) {
        text += ` -${r.damage} HP (${r.playerHp}).`
        flashHit()
        log.push(`blocked #${id}  -${r.damage} hp  player ${r.playerHp}`)
      }
      ui.msg.innerHTML = r.playerDead ? `<span class="bad">${text} Игрок погиб.</span>` : text
    } else if (r.reason === 'pinned') {
      const text = `<span class="rock">Стрелка #${id} PINNED / BLOCKED BY ROCK</span> — камень держит её ещё ${r.pinTurnsLeft} ход(а). Это не ошибка игрока: HP не тратится, ход не идёт.`
      ui.msg.innerHTML = text
      log.push(`tap #${id}  !! pinned (${r.pinTurnsLeft} turn(s) left)`)
    }
    render()
    return
  }
  flash = { blocked: -1, blocker: -1 }
  shots.push({ id, cells: level.arrows[id].cells, dir: local, arenaDir: r.arenaDir, hit: r.hit, t0: performance.now() })
  let text = `#${id} ${ARROWS[r.arenaDir]} ${r.hit ? 'попадание' : 'мимо'} · HP цели ${s.hp}/${s.totalHp}`
  if (r.enemyAttacked) {
    text += ` · ВРАГ АТАКУЕТ: -${r.enemyDamage} (HP игрока ${r.playerHp})`
    flashHit()
  }
  if (r.pinnedThisTurn && r.pinnedThisTurn.length) {
    text += ` · <span class="rock">КАМЕНЬ: #${r.pinnedThisTurn.map((p) => p.id).join(', #')} pinned на ${r.pinnedThisTurn[0].turnsLeft} хода</span>`
  }
  if (r.pinExpired && r.pinExpired.length) {
    text += ` · снова доступна: #${r.pinExpired.join(', #')}`
  }
  if (r.shieldRaised && r.shieldRaised.length) {
    text += ` · <span class="rock">ЩИТ ПОДНЯТ: ${r.shieldRaised.map((sh) => sh.id).join(', ')}</span>`
  }
  if (r.shieldConsumed && r.shieldConsumed.length) {
    text += ` · щит поглотил попадание (урона нет): ${r.shieldConsumed.map((sh) => sh.id).join(', ')}`
  }
  if (r.won) text = `Победа. ${text}`
  else if (r.playerDead) text = `Поражение: HP закончилось. ${text}`
  ui.msg.innerHTML = r.playerDead ? `<span class="bad">${text}</span>` : text
  log.push(
    `${formatAction({ kind: 'tap', id })}  ${DIR_NAMES[local]}→${DIR_NAMES[r.arenaDir]}  ${r.hit ? 'HIT' : 'miss'}  hp ${s.hp}` +
      (r.enemyAttacked ? `  ENEMY -${r.enemyDamage} (player ${r.playerHp})` : '') +
      (r.pinnedThisTurn && r.pinnedThisTurn.length ? `  ROCK THROWN: #${r.pinnedThisTurn.map((p) => `${p.id}(${p.turnsLeft}t)`).join(', #')}` : '') +
      (r.pinExpired && r.pinExpired.length ? `  UNPINNED: #${r.pinExpired.join(', #')}` : '') +
      (r.shieldRaised && r.shieldRaised.length ? `  SHIELD UP: ${r.shieldRaised.map((sh) => sh.id).join(', ')}` : '') +
      (r.shieldConsumed && r.shieldConsumed.length ? `  SHIELD BLOCKED: ${r.shieldConsumed.map((sh) => sh.id).join(', ')} (no damage)` : '') +
      (r.won ? '  WIN' : ''),
  )
  afterAction()
}

function undo() {
  if (!s.undo()) return
  log.pop()
  shots = []
  flash = { blocked: -1, blocker: -1 }
  hint = null
  ui.wrap.classList.remove('hit')
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

let live = null
function afterAction() {
  live = null
  if (ui.liveCheck.checked && !s.over) {
    live = findWin(s, { nodeBudget: 300_000 })
  }
  renderPanel()
  kick()
}

let raf = 0
function kick() {
  if (!raf) raf = requestAnimationFrame(frame)
}

function frame(now) {
  raf = 0
  let animating = false
  shots = shots.filter((sh) => now - sh.t0 < 360)
  for (const sh of shots) if (sh.hit && now - sh.t0 > 220 && !sh.flashed) {
    sh.flashed = true
    bossFlash = now
    const hitEnemy = s.enemies.find((e) => e.side === sh.arenaDir)
    if (hitEnemy) enemyFlash[hitEnemy.id] = now
  }
  if (shots.length) animating = true
  if (now - bossFlash < 220) animating = true
  render(now)
  if (animating) kick()
}

function computeGeo() {
  const { width: w, height: h } = level
  const span = Math.max(w, h)
  const margin = 3.6
  const avail = Math.max(260, Math.min(ui.canvas.parentElement.clientWidth - 16, window.innerHeight - 220))
  const cell = Math.max(12, Math.floor(Math.min(avail / (span + 2 * margin), 52)))
  const size = Math.round((span + 2 * margin) * cell)
  return { w, h, cell, size, cx: size / 2, cy: size / 2, half: (span * cell) / 2, bossR: (span * cell) / 2 + 1.7 * cell }
}

function boardMatrix() {
  const g = geo
  return new DOMMatrix().translate(g.cx, g.cy).translate((-g.w * g.cell) / 2, (-g.h * g.cell) / 2)
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
    hp: dark ? '#ef6b6b' : '#c62828', rock: dark ? '#c49a7c' : '#8d6e63',
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = col.bg
  ctx.fillRect(0, 0, g.size, g.size)

  drawSides(col)
  drawEnemies(col, now)

  ctx.save()
  ctx.setTransform(new DOMMatrix().scale(dpr, dpr).multiply(boardMatrix()))
  ctx.fillStyle = col.board
  ctx.fillRect(-4, -4, g.w * g.cell + 8, g.h * g.cell + 8)
  ctx.fillStyle = col.dot
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ctx.fillRect((x + 0.5) * g.cell - 1, (y + 0.5) * g.cell - 1, 2, 2)
  for (const a of level.arrows) drawArrow(a, col)
  for (const sh of shots) drawShot(sh, col, now)
  ctx.restore()

  renderPanel()
}

function isLiveTargetSide(d) {
  return s.enemies.some((e) => e.side === d && !e.dead)
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
    ctx.fillStyle = isLiveTargetSide(d) ? col.text : col.muted
    const text = `${ARROWS[d]} ${alive[d]} (своб. ${free[d]})`
    ctx.save()
    ctx.translate(x, y)
    if (d === 1 || d === 3) ctx.rotate(d === 1 ? Math.PI / 2 : -Math.PI / 2)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
}

function drawEnemies(col, now) {
  const g = geo
  for (const en of s.enemies) {
    const side = en.side
    const long = Math.min(g.half * 1.1, 3.4 * g.cell)
    const thick = 1.3 * g.cell
    const cx = g.cx + DX[side] * g.bossR
    const cy = g.cy + DY[side] * g.bossR
    const horizontal = side === 0 || side === 2
    const bw = horizontal ? long : thick
    const bh = horizontal ? thick : long
    const flashT = enemyFlash[en.id] ?? 0
    const shake = now - flashT < 200 ? Math.sin((now - flashT) / 18) * 3 : 0
    ctx.save()
    ctx.translate(cx + (horizontal ? shake : DX[side] * Math.abs(shake)), cy + (horizontal ? DY[side] * Math.abs(shake) : shake))
    ctx.fillStyle = en.dead ? col.bossDead : now - flashT < 120 ? '#ffffff' : col.boss
    roundRect(-bw / 2, -bh / 2, bw, bh, 6)
    ctx.fill()
    ctx.strokeStyle = col.text
    ctx.lineWidth = 1.3
    ctx.stroke()
    const n = en.hpMax
    const pip = Math.min((long - 12) / n, g.cell * 0.42)
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * pip
      const px = horizontal ? t : 0
      const py = horizontal ? 0 : t
      ctx.fillStyle = i < en.hp ? (dark() ? '#f2f2f2' : '#1f1f1f') : 'transparent'
      ctx.strokeStyle = dark() ? '#f2f2f2' : '#1f1f1f'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.rect(px - pip * 0.32, py - pip * 0.32, pip * 0.64, pip * 0.64)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
    ctx.fillStyle = col.text
    ctx.font = `600 ${Math.max(10, Math.floor(g.cell * 0.3))}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const attackLabel = en.attackKind === 'cast' ? 'CAST IN' : 'ATTACK IN'
    const attackText = Number.isFinite(en.countdown) && !en.dead ? `  ${attackLabel} ${en.countdown}` : ''
    const abilityText = abilityCountdownText(en)
    const label = en.dead ? 'убит' : `HP ${en.hp}/${en.hpMax}${attackText}${abilityText}`
    const ly = side === 2 ? cy - thick / 2 - 0.4 * g.cell : side === 0 ? cy + thick / 2 + 0.4 * g.cell : cy - long / 2 - 0.4 * g.cell
    ctx.fillStyle = Number.isFinite(en.countdown) && en.countdown <= 1 && !en.dead ? col.hp : col.text
    const tw = ctx.measureText(label).width / 2 + 4
    ctx.fillText(label, Math.max(tw, Math.min(g.size - tw, cx)), Math.max(10, Math.min(g.size - 10, ly)))
  }
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

/** EXP-013: pinned arrows get a distinct rock-brown stroke plus a "🪨 Nt" remaining-turns label at
 * the head, instead of the usual aim/free/dim coloring -- a pinned arrow is neither "aiming" nor
 * really "free" from the player's point of view, even though it is geometrically free. */
function drawArrow(a, col) {
  const alive = s.board.isAlive(a.id)
  if (!alive) return
  const arena = s.arenaDir(a.id)
  const free = s.board.canExit(a.id)
  const pinned = s.isPinned(a.id)
  const aims = isLiveTargetSide(arena)
  const pts = a.cells.map(center)
  const lw = Math.max(3, geo.cell * 0.26)
  const stroke = pinned ? col.rock : aims ? col.aim : free ? col.arrow : col.arrowDim
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const isHint = hint && hint.kind === 'tap' && hint.id === a.id
  if (a.id === hover || a.id === flash.blocked || a.id === flash.blocker || isHint) {
    ctx.strokeStyle = a.id === flash.blocked ? '#e53935' : a.id === flash.blocker ? '#fb8c00' : isHint ? '#43a047' : col.muted
    ctx.lineWidth = lw + 7
    polyline(pts)
  }
  ctx.setLineDash(free && !pinned ? [] : pinned ? [lw * 0.5, lw * 0.5] : [lw * 0.9, lw * 0.9])
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
  if (pinned) {
    const turnsLeft = s.pinnedArrows.find((p) => p.id === a.id)?.turnsLeft ?? 0
    ctx.fillStyle = col.rock
    ctx.font = `700 ${Math.max(9, Math.floor(geo.cell * 0.28))}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`🪨${turnsLeft}`, hx + DX[d] * sz * 2.1, hy + DY[d] * sz * 2.1)
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

function renderHp() {
  const hp = s.playerHp
  ui.hpText.textContent = `${hp}/${maxHp}`
  ui.hpPips.innerHTML = ''
  for (let i = 0; i < maxHp; i++) {
    const span = document.createElement('span')
    span.className = 'pip' + (i < hp ? ' full' : '')
    ui.hpPips.append(span)
  }
}

function renderPanel() {
  const alive = s.aliveByArenaDir()
  const free = s.aliveByArenaDir(true)
  const state = s.playerDead ? 'ПОРАЖЕНИЕ (HP закончилось)' : s.won ? 'ПОБЕДА' : 'бой'
  const lines = [
    `${def.title ?? def.id}`,
    `board ${board.preset} seed ${board.seed} (${level.width}x${level.height}, ${level.arrows.length} стрел) hash ${board.levelHash}`,
    '',
    `состояние:  ${state}`,
    `HP игрока:  ${s.playerHp}/${maxHp}`,
    'враг:',
  ]
  for (const en of s.enemies) {
    const atLabel = en.attackKind === 'cast' ? 'CAST IN' : 'ATTACK IN'
    const at = en.dead ? '' : Number.isFinite(en.countdown) ? `, ${atLabel} ${en.countdown}` : ', пассивен'
    const ab = en.dead || en.abilityCountdown === undefined ? '' : `, ${abilityCountdownText(en).trim()}`
    const sh = !en.dead && en.shielded ? ', 🛡SHIELD UP' : ''
    lines.push(`  ${en.label ?? en.id} (${SIDE_RU[en.side]}): ${en.dead ? 'убит' : `HP ${en.hp}/${en.hpMax}${at}${ab}${sh}`}`)
  }
  const pinned = s.pinnedArrows
  lines.push('', `pinned arrows: ${pinned.length ? pinned.map((p) => `#${p.id} (${p.turnsLeft}t)`).join(', ') : '—'}`)
  lines.push(
    '',
    'боезапас (projectile budget) по сторонам арены (живые / свободные):',
    ...[0, 1, 2, 3].map((d) => `  ${ARROWS[d]} ${DIR_NAMES[d]}: ${String(alive[d]).padStart(2)} / ${String(free[d]).padStart(2)}${isLiveTargetSide(d) ? '   ← цель' : ''}`),
  )
  if (live) {
    const yn = (r) => (r.win ? 'да' : r.proven ? 'нет' : '?')
    lines.push('', `победа достижима: ${yn(live)}`)
  }
  ui.status.textContent = lines.join('\n')
  ui.log.textContent = log.length ? log.map((l, i) => `${String(i + 1).padStart(2)}. ${l}`).join('\n') : '—'
  renderHp()
}

// ---------------------------------------------------------------------------------------------
// Input

function arrowAt(ev) {
  if (!geo) return -1
  const r = ui.canvas.getBoundingClientRect()
  const p = boardMatrix().inverse().transformPoint(new DOMPoint(ev.clientX - r.left, ev.clientY - r.top))
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
$('undo').onclick = undo
$('hint').onclick = showHint
ui.restart.onclick = start
ui.liveCheck.onchange = afterAction

window.addEventListener('resize', kick)
window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase()
  if (k === 'z' || k === 'backspace') undo()
  else if (k === 'h') showHint()
  else return
  ev.preventDefault()
})

/** COMBAT-001: kind-aware ability countdown label for the debug HUD (no art, text only). */
function abilityCountdownText(en) {
  if (en.abilityCountdown === undefined || !Number.isFinite(en.abilityCountdown) || en.dead) return ''
  const dd = def.enemies.find((e) => e.id === en.id)
  const kind = dd?.ability?.kind ?? 'stone_throw'
  const base = kind === 'shield' ? `SHIELD IN ${en.abilityCountdown}` : `THROW IN ${en.abilityCountdown}`
  return `  ${base}${en.shielded ? ' 🛡SHIELD UP' : ''}`
}

// COMBAT-001: the same debug shell serves every single-ability debug fixture:
// rock-spike.html renders rock-spike.json, rock-spike.html?enc=shield-spike renders shield-spike.json.
const encName = new URLSearchParams(location.search).get('enc') || 'rock-spike'
const raw = await fetchJson(`../encounters/${encName}.json`)
const parsed = encounterFromJson(raw)
level = parsed.level
def = parsed.file.encounter
board = parsed.file.board
ui.why.textContent = def.notes ?? '(see encounter notes)'
start()

window.rsDebug = {
  state: () => s,
  pointOf(id) {
    const head = level.arrows[id].cells.at(-1)
    const [x, y] = center(head)
    const p = boardMatrix().transformPoint(new DOMPoint(x, y))
    const r = ui.canvas.getBoundingClientRect()
    return { x: r.left + p.x, y: r.top + p.y }
  },
}
