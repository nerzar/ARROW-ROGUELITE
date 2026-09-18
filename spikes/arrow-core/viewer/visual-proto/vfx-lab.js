// VFX-001: Combat Feel Lab.
//
// What this page is: a standalone stand (one URL) where each combat-feedback effect can be
// triggered and tuned on its own, next to the same arena art and same board-plane projection the
// real game uses. Its purpose is a USER decision -- "which of these read well, and how strong
// should they be" -- not a VFX framework. So by design:
//
//   * nothing here imports or mutates EncounterState (or anything else from src/); the lab never
//     knows about HP, timers, cast windows, Rotate or board rules;
//   * the playable renderer (board-renderer.js / app.js / index.html) is not touched at all --
//     a `?preset=` deep link is the only entry point;
//   * no scheduler/registry abstraction is built here (see the task's strict boundaries): every
//     effect is a plain pure function of (t, params) that draws itself once per frame.
//
// Hit-stop is the one genuinely subtle bit, so it is worth naming: it is implemented as a
// DISPLAY-time warp (tRaw -> tDisp), never as a change to simulation time. Effects animate on
// tDisp, so they visibly freeze; camera impulse runs on tRaw, so the shake keeps moving through
// the freeze the way a real hit reads. Nothing else in the page can be affected by it.

import { createBoardPlane, project } from './board-plane.js'

// ---------------------------------------------------------------------------------------------
// Math helpers. Kept local instead of imported: filled-arrow-materials.js has the same primitives
// (srand/sheen/sparks) but they are module-private, and the task explicitly says not to start with
// a refactor of the playable files just to share four lines of easing.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t
const easeOutCubic = (p) => 1 - (1 - p) ** 3
const easeOutQuint = (p) => 1 - (1 - p) ** 5
const smoothstep = (p) => p * p * (3 - 2 * p)
/** Overshoot curve -- drives squash settle and damage-number pop. */
const easeOutBack = (p, s = 1.8) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2

/** Same LCG the material pack uses: stable per-seed values, so a frozen frame (see the frame URL)
 * is byte-identical across reloads and screenshots stay comparable. */
function srand(s) {
  let v = (s >>> 0) || 1
  return () => (v = (v * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

/** "Punch" shape: most of the displacement happens fast, then it settles back to 0.
 * 0 at p=0, peak at p=0.3, 0 at p=1. */
function punch(p) {
  if (p <= 0 || p >= 1) return 0
  return p < 0.3 ? easeOutCubic(p / 0.3) : 1 - easeOutQuint((p - 0.3) / 0.7)
}

// ---------------------------------------------------------------------------------------------
// Palettes. Fantasy / magical / premium -- warm gold as the base, with arcane, blood and soul
// variants so light/heavy/magic/kill reads differently at a glance over the dark arena.

const PALETTES = {
  warm: { core: '#fff6d8', mid: '#f7c948', deep: '#c0791a', dark: '#4a2c06', glow: 'rgba(255,170,60,0.9)', spark: '#ffd27a', smoke: 'rgba(255,225,185,0.5)' },
  arcane: { core: '#f4e9ff', mid: '#b98cff', deep: '#6532b8', dark: '#2a1250', glow: 'rgba(180,120,255,0.9)', spark: '#dcc0ff', smoke: 'rgba(214,190,255,0.5)' },
  blood: { core: '#ffe0d6', mid: '#ff6b4a', deep: '#a02414', dark: '#400b04', glow: 'rgba(255,90,60,0.85)', spark: '#ffb199', smoke: 'rgba(255,190,175,0.45)' },
  gold: { core: '#fffbe6', mid: '#ffd76a', deep: '#c08a12', dark: '#4a3206', glow: 'rgba(255,215,106,0.95)', spark: '#fff0b8', smoke: 'rgba(255,240,190,0.5)' },
  soul: { core: '#e4fff7', mid: '#6fe8c0', deep: '#1a7f66', dark: '#062b23', glow: 'rgba(120,240,210,0.85)', spark: '#b9ffe9', smoke: 'rgba(190,255,235,0.45)' },
}

/** Damage-number styling: colour + weight only. `crit` is the loud one on purpose. */
const DMG_STYLE = {
  light: { fill: '#fff3d0', stroke: '#4a2c06', scale: 1 },
  heavy: { fill: '#ffd166', stroke: '#3d1f00', scale: 1.15 },
  crit: { fill: '#ffb347', stroke: '#4a1a00', scale: 1.35, sparkle: true },
  magic: { fill: '#dcc0ff', stroke: '#2a1250', scale: 1.1 },
  /** Blocked tap: deliberately dull and desaturated -- it must NOT compete with a real hit. */
  blocked: { fill: '#e8e2d8', stroke: '#2a2620', scale: 0.95 },
}

// ---------------------------------------------------------------------------------------------
// Parameters. One flat bag; each effect card below declares only the keys it actually uses, so
// the panel never shows a slider that does nothing (the task asks for useful controls only).

const P = {
  intensity: 1, speed: 1, spot: 'top',

  trailDur: 220, trailWidth: 9, trailKind: 'warm', trailArc: 0.10,
  flashDur: 260, flashScale: 1.2, flashKind: 'warm',
  sparkCount: 22, sparkDur: 540, sparkSpread: 1, sparkKind: 'warm',
  dmgValue: 45, dmgDur: 780, dmgSize: 1, dmgKind: 'light',
  sqRecoil: 12, sqSquash: 0.18, sqDur: 320,
  hsDur: 0, hsStrength: 0.9,
  camAmp: 4, camDur: 260, camFreq: 22,
  bossRing: 1.6, bossDust: 26, bossHs: 80, bossAmp: 12,
  poofDur: 820, poofScale: 1.25, poofCount: 34, poofKind: 'warm',
  rwDur: 1100, rwCount: 24, rwRise: 84, rwText: '+25',
}

/** Slider/field specs, so the UI is generated from data instead of hand-written per card. */
const SPEC = {
  intensity: { label: 'intensity', min: 0.2, max: 2, step: 0.05 },
  trailDur: { label: 'duration', min: 80, max: 700, step: 10, unit: 'ms' },
  trailWidth: { label: 'width', min: 2, max: 24, step: 1, unit: 'px' },
  trailKind: { label: 'material', kind: 'select', options: ['warm', 'arcane', 'blood', 'gold', 'soul'] },
  trailArc: { label: 'arc', min: -0.4, max: 0.4, step: 0.02 },
  flashDur: { label: 'duration', min: 80, max: 600, step: 10, unit: 'ms' },
  flashScale: { label: 'scale', min: 0.3, max: 3, step: 0.05, unit: 'x' },
  flashKind: { label: 'material', kind: 'select', options: ['warm', 'arcane', 'blood', 'gold', 'soul'] },
  sparkCount: { label: 'particles', min: 0, max: 90, step: 1 },
  sparkDur: { label: 'duration', min: 150, max: 1200, step: 10, unit: 'ms' },
  sparkSpread: { label: 'spread', min: 0.2, max: 1.8, step: 0.05 },
  sparkKind: { label: 'material', kind: 'select', options: ['warm', 'arcane', 'blood', 'gold', 'soul'] },
  dmgValue: { label: 'value', kind: 'number' },
  dmgDur: { label: 'duration', min: 300, max: 1800, step: 20, unit: 'ms' },
  dmgSize: { label: 'size', min: 0.5, max: 2.2, step: 0.05, unit: 'x' },
  dmgKind: { label: 'style', kind: 'select', options: ['light', 'heavy', 'crit', 'magic'] },
  sqRecoil: { label: 'recoil', min: 0, max: 40, step: 1, unit: 'px' },
  sqSquash: { label: 'squash', min: 0, max: 0.6, step: 0.02 },
  sqDur: { label: 'duration', min: 100, max: 700, step: 10, unit: 'ms' },
  hsDur: { label: 'freeze', min: 0, max: 220, step: 5, unit: 'ms' },
  hsStrength: { label: 'strength', min: 0, max: 0.98, step: 0.02 },
  camAmp: { label: 'amplitude', min: 0, max: 34, step: 1, unit: 'px' },
  camDur: { label: 'duration', min: 80, max: 900, step: 10, unit: 'ms' },
  camFreq: { label: 'frequency', min: 4, max: 40, step: 1, unit: 'Hz' },
  bossRing: { label: 'shockwave', min: 0.4, max: 3.5, step: 0.1, unit: 'x' },
  bossDust: { label: 'dust', min: 0, max: 70, step: 1 },
  bossHs: { label: 'freeze', min: 0, max: 260, step: 5, unit: 'ms' },
  bossAmp: { label: 'shake', min: 0, max: 40, step: 1, unit: 'px' },
  poofDur: { label: 'duration', min: 300, max: 1600, step: 20, unit: 'ms' },
  poofScale: { label: 'scale', min: 0.5, max: 2.4, step: 0.05, unit: 'x' },
  poofCount: { label: 'puffs', min: 0, max: 80, step: 1 },
  poofKind: { label: 'material', kind: 'select', options: ['warm', 'arcane', 'blood', 'gold', 'soul'] },
  rwDur: { label: 'duration', min: 400, max: 2000, step: 20, unit: 'ms' },
  rwCount: { label: 'sparkles', min: 0, max: 60, step: 1 },
  rwRise: { label: 'rise', min: 20, max: 220, step: 4, unit: 'px' },
  rwText: { label: 'text', kind: 'text' },
}

// ---------------------------------------------------------------------------------------------
// Take model.
//
// A "take" is one triggered combination of effects on one timeline, in REAL ms. Effect instances
// store `at`/`dur` and are pure functions of display time, so the whole take is reproducible --
// which is what makes the frame URL (?preset=...&at=...) able to freeze an exact frame.

const SLACK_MS = 80

function newTake(id) {
  return {
    id, t0: 0, items: [], hs: null, dur: 0,
    // Slots the target itself needs (a single target can only be recoiling/dissolving once).
    tgt: { squash: null, poof: null, tint: null },
  }
}

function push(take, item) {
  take.items.push(item)
  take.dur = Math.max(take.dur, item.at + item.dur)
  return item
}

/** Display-time warp: the ONLY place hit-stop exists. Inside the freeze window the display
 * timeline advances at `strength` speed (0 = fully frozen), and the time lost stays lost for the
 * rest of the take, which is exactly the "the world paused for a beat" read.
 * strength = 1 -> no hit-stop at all. */
export function timeWarp(tRaw, hs) {
  if (!hs || hs.dur <= 0 || hs.strength >= 1) return tRaw
  if (tRaw <= hs.at) return tRaw
  const inWindow = Math.min(tRaw - hs.at, hs.dur)
  const after = Math.max(0, tRaw - hs.at - hs.dur)
  return hs.at + inWindow * hs.strength + after
}

/** How long the take occupies REAL time (display duration + the beat hit-stop eats). */
function realDur(take) {
  const lost = take.hs ? take.hs.dur * (1 - take.hs.strength) : 0
  return take.dur + lost + SLACK_MS
}

/** Camera impulse: pure function of REAL time, deliberately not of display time.
 * Decaying oscillation, deterministic -> same frame at the same `at`. */
function camOffset(tRaw, shakes) {
  let x = 0, y = 0
  for (const s of shakes) {
    const p = (tRaw - s.at) / s.dur
    if (p < 0 || p >= 1) continue
    const amp = s.amp * (1 - p) ** 2
    const ph = ((tRaw - s.at) / 1000) * s.freq * 2 * Math.PI
    x += Math.sin(ph) * amp
    y += Math.cos(ph * 1.37) * amp * 0.7
  }
  return { x, y }
}

function shakesOf(take) {
  return take.items.filter((it) => it.kind === 'shake')
}

// ---------------------------------------------------------------------------------------------
// Sprite compositing.
//
// The tint for hit feedback must never bleed outside the silhouette: BUILD-020 already paid for
// that lesson in board-renderer.js ("a translucent square flashing behind the monster"), so the
// same fix is used here -- the sprite is composited into an offscreen canvas at its own natural
// size and the tint is applied with source-atop, which only touches pixels the sprite actually
// painted. The dissolve punches holes with destination-out on that same buffer.

const sprites = new Map()

function loadSprite(src) {
  if (sprites.has(src)) return sprites.get(src)
  const entry = { img: null, canvas: null, ctx: null, ready: false, failed: false }
  sprites.set(src, entry)
  const img = new Image()
  img.onload = () => {
    entry.img = img
    entry.canvas = document.createElement('canvas')
    entry.canvas.width = img.naturalWidth
    entry.canvas.height = img.naturalHeight
    entry.ctx = entry.canvas.getContext('2d')
    entry.ready = true
    kick()
  }
  img.onerror = () => { entry.failed = true; kick() }
  img.src = src
  return entry
}

/** Sprite buffer with optional white tint and dissolve holes. Returns the offscreen canvas. */
function composeSprite(entry, { tint = 0, dissolve = 0, seed = 1 } = {}) {
  const ctx = entry.ctx
  const w = entry.canvas.width
  const h = entry.canvas.height
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(entry.img, 0, 0)

  if (tint > 0.001) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = clamp01(tint) * 0.75
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
  if (dissolve > 0.001) {
    ctx.globalCompositeOperation = 'destination-out'
    const rnd = srand(seed * 7919 + 11)
    const n = 46
    for (let i = 0; i < n; i++) {
      const cx = rnd() * w
      const cy = rnd() * h
      const grow = clamp01(dissolve * 1.6 - rnd() * 0.5)
      if (grow <= 0) continue
      ctx.globalAlpha = clamp01(grow)
      ctx.beginPath()
      ctx.arc(cx, cy, (0.02 + grow * 0.09) * w, 0, 6.29)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'source-over'
  return entry.canvas
}

// ---------------------------------------------------------------------------------------------
// Anchors.
//
// The projectile's start point is derived through the SAME projection the game uses
// (board-plane.createBoardPlane + project), so the board-space half of an effect is honest about
// the game's geometry instead of a private coordinate system (a task requirement).
//
// The TARGET's screen anchor is deliberately lab-local data: in the real game an actor anchor is
// per-arena calibration (CAL-001 / CAL-004), and the lab must not pretend to have one. Three
// fixed spots are offered so the same effect can be judged over the bright dais, over a side
// terrace and over the darker masonry.

const TARGET_SRC = {
  mob: './assets/enemies/small-goblin/idle.png',
  boss: './assets/bosses/goblin-shaman/idle.png',
}

const SPOTS = {
  top: { x: 0.500, y: 0.440, kind: 'mob' },
  left: { x: 0.155, y: 0.630, kind: 'mob' },
  right: { x: 0.845, y: 0.630, kind: 'mob' },
  boss: { x: 0.500, y: 0.420, kind: 'boss' },
}

const BOARD_COLS = 6
const BOARD_ROWS = 5

/** Stage size in CSS px, from layout -- the single source of truth for both the canvas backing
 * store and every anchor. NOTE: this must NOT read ui.canvas.width/height: those still hold the
 * 300x150 defaults until the first frame runs, so any take built before first paint (every
 * deep-link load does exactly that) would bake its coordinates in the wrong space while the
 * sprite -- drawn later with fresh anchors -- lands right. That mismatch was the top-left-numbers
 * bug: effects in 300x150-space, sprite in real space. */
function stageSize() {
  const rect = ui.stage.getBoundingClientRect()
  return { w: Math.max(320, Math.round(rect.width)), h: Math.max(200, Math.round(rect.height)) }
}

function computeAnchors() {
  const { w, h } = stageSize()
  const plane = createBoardPlane(w, h)
  const fit = fitGridLocal(BOARD_COLS, BOARD_ROWS)

  // One cell, in screen px, at the board's own centre -- used for every local size (sprite
  // footprint, ring radii) so effects scale with the arena instead of with the window.
  const c0 = project(plane.H, 0.5 - fit.cell / 2, 0.5)
  const c1 = project(plane.H, 0.5 + fit.cell / 2, 0.5)
  const cellU = Math.hypot(c1.x - c0.x, c1.y - c0.y)
  const v0 = project(plane.H, 0.5, 0.5 - fit.cell / 2)
  const v1 = project(plane.H, 0.5, 0.5 + fit.cell / 2)
  const cellV = Math.hypot(v1.x - v0.x, v1.y - v0.y)

  const spot = SPOTS[P.spot] ?? SPOTS.top
  const board = project(plane.H, 0.5, 0.5)

  // Grid edges, in plane space -- the launch point is the midpoint of whichever edge faces the
  // target, which is how the real game's projectile leaves the board.
  const eu0 = 0.5 - fit.gridU / 2
  const eu1 = 0.5 + fit.gridU / 2
  const ev0 = 0.5 - fit.gridV / 2
  const ev1 = 0.5 + fit.gridV / 2
  const edgeMid = {
    top: project(plane.H, 0.5, ev0),
    bottom: project(plane.H, 0.5, ev1),
    left: project(plane.H, eu0, 0.5),
    right: project(plane.H, eu1, 0.5),
  }
  const launchEdge = P.spot === 'left' ? 'left'
    : P.spot === 'right' ? 'right'
      : 'top'
  const launch = edgeMid[launchEdge]

  // Target anchor: stage fractions, on the arena AROUND the board (an actor never stands on the
  // play field -- the projectile has to have somewhere to fly). This is presentation data, the
  // same split the real game uses (board-plane for the board, arena-layout for the actors).
  const groundPt = { x: spot.x * w, y: spot.y * h }

  const boxW = cellU * 2.8
  const boxH = cellV * (spot.kind === 'boss' ? 4.2 : 3.3)

  const hit = { x: groundPt.x, y: groundPt.y - boxH * 0.52 }

  return {
    plane, fit, cellU, cellV, board, spot,
    kind: spot.kind,
    sprite: loadSprite(TARGET_SRC[spot.kind]),
    // Ground point (bottom-centre of the sprite) and the draw box above it.
    ground: groundPt,
    box: { x: groundPt.x - boxW / 2, y: groundPt.y - boxH, w: boxW, h: boxH },
    // Where a hit reads: a bit above the feet, not on them.
    hit,
    // Where the projectile launches from (board edge facing the target) -- the board-space half of
    // an effect, so a trail has a real flight length instead of a 30px hop.
    launch,
    // Direction the projectile travels (launch -> target). Recoil and the spark spray are both
    // derived from this one angle, so a hit always pushes things away from where it came from.
    hitDir: Math.atan2(hit.y - launch.y, hit.x - launch.x),
  }
}

/** Local copy of fitGrid's uniform-spacing case: the lab always fits an even 6x5 grid, so it only
 * needs the subdivision, not the per-arena frac tables. */
function fitGridLocal(cols, rows) {
  const margin = 0.05
  const boxSide = 1 - 2 * margin
  const cell = boxSide / Math.max(cols, rows)
  return { cell, gridU: cols * cell, gridV: rows * cell }
}

// ---------------------------------------------------------------------------------------------
// Shared drawing helpers (a few lines each -- intentionally NOT extracted into a shared module;
// that abstraction is explicitly out of scope for this task).

/** Add/override the alpha of a palette colour. Palette entries are a mix of `rgba(...)` and hex
 * (`pal.core` is hex), and a radial gradient needs every stop in ONE notation -- without this the
 * hex core colour would produce a hard-edged disc instead of a soft blob. */
function withAlpha(color, a) {
  const c = String(color).trim()
  const rgb = /^rgba?\(([^)]+)\)$/.exec(c)
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((s) => s.trim())
    return `rgba(${r},${g},${b},${a})`
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(c)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }
  return c
}

/** Additive radial blob: the base of every flash, spark glow and light pool on screen. */
function blob(ctx, x, y, r, color, alpha) {
  if (r <= 0 || alpha <= 0.001) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, withAlpha(color, 1))
  g.addColorStop(0.45, withAlpha(color, 0.35))
  g.addColorStop(1, withAlpha(color, 0))
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 6.29)
  ctx.fill()
  ctx.globalAlpha = 1
}

/** Screen-space ellipse standing in for a ground ring -- ry is a fixed fraction of rx because the
 * arena's own foreshortening is a constant in this projection. */
function groundRing(ctx, x, y, rx, ry, width, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, width)
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, 6.29)
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------------------------
// Effect renderers. Each is `(ctx, item, tDisplay, anchors)` and draws ONE frame of itself.
// Particle parameters are materialised at spawn time (not randomised per frame), so a frozen
// frame is reproducible and scrubbing back and forth shows the exact same picture.

/** Quadratic curve between two points with a perpendicular `arc` bow (fraction of the distance). */
function bez(a, b, arc, s) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const nx = -(b.y - a.y)
  const ny = b.x - a.x
  const L = Math.hypot(nx, ny) || 1
  const cx = mx + (nx / L) * arc * L
  const cy = my + (ny / L) * arc * L
  const u = 1 - s
  return { x: u * u * a.x + 2 * u * s * cx + s * s * b.x, y: u * u * a.y + 2 * u * s * cy + s * s * b.y }
}

function posAt(it, s) {
  return bez(it.from, it.to, it.arc ?? 0, easeOutCubic(clamp01(s)))
}

const RENDER = {
  /** 1. Projectile trail: a dart leaving the board, with a tapering additive ribbon behind it. */
  trail(ctx, it, t) {
    const travel = it.dur * 0.5
    const p = (t - it.at) / travel
    const arrived = p >= 1
    const pal = PALETTES[it.pal]
    const head = posAt(it, clamp01(p))
    const N = 16
    const step = it.dur * 0.028

    // Ribbon: three additive passes (wide haze, body, hot core) over a tapering polyline.
    const pts = []
    for (let j = 0; j <= N; j++) {
      const tj = clamp01((t - it.at - j * step) / travel)
      pts.push(posAt(it, tj))
    }
    // How much the ribbon has left to live (it lingers briefly past impact, then goes).
    const linger = arrived ? clamp01(1 - (t - it.at - travel) / (it.dur - travel)) : 1
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    const passes = [
      { k: 2.6, color: pal.glow, a: 0.16 },
      { k: 1.35, color: pal.mid, a: 0.42 },
      { k: 0.5, color: pal.core, a: 0.9 },
    ]
    for (const pass of passes) {
      for (let j = 0; j < N; j++) {
        const taper = (1 - j / N) ** 0.65
        if (taper <= 0.02) continue
        ctx.globalAlpha = pass.a * taper * linger
        ctx.strokeStyle = pass.color
        ctx.lineWidth = Math.max(1, it.width * taper * pass.k)
        ctx.beginPath()
        ctx.moveTo(pts[j].x, pts[j].y)
        ctx.lineTo(pts[j + 1].x, pts[j + 1].y)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // Dart: a filled head aligned to the direction of travel (the game's arrows are filled shapes,
    // so a filled dart is the consistent read). It vanishes into the target on arrival.
    if (!arrived && p > 0.02) {
      const prev = posAt(it, clamp01(p - 0.06))
      const ang = Math.atan2(head.y - prev.y, head.x - prev.x)
      const len = it.width * 3.4
      const half = it.width * 1.15
      ctx.save()
      ctx.translate(head.x, head.y)
      ctx.rotate(ang)
      ctx.fillStyle = pal.mid
      ctx.strokeStyle = pal.dark
      ctx.lineWidth = Math.max(1, it.width * 0.35)
      ctx.beginPath()
      ctx.moveTo(len * 0.62, 0)
      ctx.lineTo(-len * 0.38, -half)
      ctx.lineTo(-len * 0.16, 0)
      ctx.lineTo(-len * 0.38, half)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      ctx.restore()
      ctx.globalCompositeOperation = 'lighter'
      blob(ctx, head.x, head.y, it.width * 2.6, pal.glow, 0.5)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },
  /** 2. Impact flash: expanding additive burst + hot core + a short lens streak. */
  flash(ctx, it, t) {
    const p = (t - it.at) / it.dur
    const pal = PALETTES[it.pal]
    const grow = easeOutCubic(p)
    const fade = (1 - p) ** 1.6
    const r = it.scale * it.unit * (0.45 + 2.6 * grow)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    blob(ctx, it.x, it.y, r, pal.glow, 0.75 * fade)
    blob(ctx, it.x, it.y, r * 0.45, pal.core, 0.9 * (1 - p) ** 2.2)
    // Lens streak, fading faster than the blob so it reads as a snap, not a light source.
    const sw = r * 3.4
    const sg = ctx.createLinearGradient(it.x - sw, it.y, it.x + sw, it.y)
    sg.addColorStop(0, 'rgba(255,255,255,0)')
    sg.addColorStop(0.5, pal.core)
    sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.globalAlpha = 0.5 * fade * (1 - p)
    ctx.fillStyle = sg
    ctx.fillRect(it.x - sw, it.y - Math.max(1, r * 0.09), sw * 2, Math.max(2, r * 0.18))
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 3. Hit sparks: precomputed particles with gravity, drawn as short additive streaks. */
  sparks(ctx, it, t) {
    const pal = PALETTES[it.pal]
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (const s of it.parts) {
      const te = clamp01((t - it.at - s.delay) / it.dur)
      if (te <= 0 || te >= 1) continue
      const e = easeOutQuint(te)
      const x = it.x + Math.cos(s.ang) * s.spd * e * it.spread
      const y = it.y + Math.sin(s.ang) * s.spd * e * it.spread * 0.72 + s.g * e * e * it.spread * 0.9
      const a = (1 - te) ** 1.4
      const len = s.size * (1 - te * 0.6)
      ctx.globalAlpha = a * 0.9
      ctx.strokeStyle = s.hot ? pal.core : pal.spark
      ctx.lineWidth = Math.max(1, len * 0.55)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - Math.cos(s.ang) * len, y - Math.sin(s.ang) * len)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 4. Damage number: pops in with overshoot, drifts up, fades. */
  dmg(ctx, it, t) {
    const p = (t - it.at) / it.dur
    const style = DMG_STYLE[it.style] ?? DMG_STYLE.light
    const pop = p < 0.22 ? easeOutBack(p / 0.22) : 1
    const rise = easeOutCubic(p) * it.rise
    const fade = p < 0.62 ? 1 : 1 - smoothstep(clamp01((p - 0.62) / 0.38))
    const size = it.size * 34 * (0.7 + 0.3 * pop)
    ctx.save()
    ctx.globalAlpha = clamp01(fade)
    ctx.translate(it.x, it.y - rise)
    ctx.scale(pop, pop)
    ctx.font = `800 ${size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, size * 0.14)
    ctx.strokeStyle = style.stroke
    ctx.strokeText(it.text, 0, 0)
    ctx.fillStyle = style.fill
    ctx.fillText(it.text, 0, 0)
    if (style.sparkle && p < 0.4) {
      ctx.globalCompositeOperation = 'lighter'
      const rnd = srand(it.seed * 31 + 7)
      for (let i = 0; i < 5; i++) {
        const a = rnd() * 6.28
        const d = size * (0.6 + rnd() * 0.9)
        blob(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.6, size * 0.22, 'rgba(255,220,140,0.9)', (1 - p / 0.4) * 0.8)
      }
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 5. Enemy recoil is a TARGET transform, not a drawing pass -- see drawTarget. Triggering this
   * card alone still shows something at the feet (a scuff ring), so it can be judged in isolation. */
  squash(ctx, it, t, A) {
    const k = punch((t - it.at) / it.dur)
    if (k <= 0.001) return
    const pal = PALETTES[it.pal]
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    groundRing(ctx, A.ground.x, A.ground.y, A.cellU * (0.85 + k * 0.5), A.cellU * 0.24, Math.max(1, A.cellU * 0.05), pal.glow, 0.35 * k)
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 8. Death burst / poof: expanding dust puffs + embers, plus the sprite's own dissolve
   * (drawTarget reads take.tgt.poof). Additive on purpose: this has to read over dark masonry. */
  poof(ctx, it, t) {
    const pal = PALETTES[it.pal]
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of it.puffs) {
      const te = clamp01((t - it.at - p.delay) / it.dur)
      if (te <= 0 || te >= 1) continue
      const e = easeOutCubic(te)
      const x = it.x + Math.cos(p.ang) * p.dist * e
      const y = it.y + Math.sin(p.ang) * p.dist * e * 0.62 - p.rise * e
      blob(ctx, x, y, p.size * (0.5 + e * 1.3), pal.smoke, (1 - te) ** 1.7 * 0.5)
    }
    for (const s of it.parts) {
      const te = clamp01((t - it.at - s.delay) / it.dur)
      if (te <= 0 || te >= 1) continue
      const e = easeOutQuint(te)
      const x = it.x + Math.cos(s.ang) * s.spd * e
      const y = it.y + Math.sin(s.ang) * s.spd * e * 0.6 + s.g * e * e
      ctx.globalAlpha = (1 - te) ** 1.5 * 0.9
      ctx.strokeStyle = pal.spark
      ctx.lineWidth = Math.max(1, s.size * (1 - te * 0.5))
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - Math.cos(s.ang) * s.size * 1.6, y - Math.sin(s.ang) * s.size * 1.6)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 9. Boss impact: ground shockwave ring + light pool + dust, i.e. the "heavier than a mob"
   * read. The extra weight in the real game comes from pairing this with a longer hit-stop and a
   * bigger camera impulse -- both are separate cards/preset values, so they stay independently
   * tunable instead of being welded into one effect. */
  shock(ctx, it, t, A) {
    const pal = PALETTES[it.pal]
    const p = (t - it.at) / it.dur
    const grow = easeOutCubic(p)
    const fade = (1 - p) ** 1.8
    const rx = A.cellU * (0.7 + 3.2 * grow) * it.scale
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    // Light pool on the stone, so the ring does not float.
    blob(ctx, it.x, it.y, rx * 0.9, pal.glow, 0.28 * fade)
    groundRing(ctx, it.x, it.y, rx, rx * 0.3, Math.max(1, A.cellU * 0.16 * it.scale * (1 - p * 0.7)), pal.core, 0.8 * fade)
    // Second, delayed ring: reads as a rebound rather than one clean pulse.
    const p2 = clamp01((p - 0.18) / 0.82)
    if (p2 > 0) {
      const rx2 = A.cellU * (0.5 + 2.1 * easeOutCubic(p2)) * it.scale
      groundRing(ctx, it.x, it.y, rx2, rx2 * 0.3, Math.max(1, A.cellU * 0.07 * it.scale), pal.mid, 0.55 * (1 - p2) ** 1.6)
    }
    for (const d of it.dust) {
      const te = clamp01((t - it.at - d.delay) / it.dur)
      if (te <= 0 || te >= 1) continue
      const e = easeOutCubic(te)
      const x = it.x + d.side * A.cellU * 1.2 * e * it.scale
      const y = it.y - d.rise * e
      blob(ctx, x, y, d.size * (0.5 + e), pal.smoke, (1 - te) ** 1.6 * 0.45)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  },

  /** 10. Reward pop: golden pool, expanding ring, rising twinkles and a reward label. */
  reward(ctx, it, t) {
    const pal = PALETTES.gold
    const p = (t - it.at) / it.dur
    const grow = easeOutCubic(clamp01(p / 0.7))
    const fade = p < 0.7 ? 1 : 1 - smoothstep(clamp01((p - 0.7) / 0.3))
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    blob(ctx, it.x, it.y, it.unit * (0.6 + 1.9 * grow), pal.glow, 0.3 * fade)
    groundRing(ctx, it.x, it.y, it.unit * (0.5 + 2.2 * grow), it.unit * 0.24, Math.max(1, it.unit * 0.07), pal.core, 0.7 * fade)
    for (const s of it.sparkles) {
      const te = clamp01((t - it.at - s.delay) / it.dur)
      if (te <= 0 || te >= 1) continue
      const e = easeOutCubic(te)
      const x = it.x + Math.cos(s.ang) * s.dist * e
      const y = it.y - it.rise * e - Math.sin(s.ang) * s.dist * e * 0.35
      const twinkle = 0.55 + 0.45 * Math.sin(te * 12 + s.phase)
      blob(ctx, x, y, s.size * (1 - te * 0.35), pal.spark, (1 - te) ** 1.2 * twinkle * 0.9)
    }
    // Label: pops with overshoot and then just sits there -- a reward should linger, not vanish.
    const pop = p < 0.18 ? easeOutBack(p / 0.18) : 1
    const size = it.unit * 0.62
    ctx.globalAlpha = clamp01(fade)
    ctx.translate(it.x, it.y - it.unit * 0.7 - easeOutCubic(p) * it.rise * 0.45)
    ctx.scale(pop, pop)
    ctx.font = `900 ${size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, size * 0.16)
    ctx.strokeStyle = '#4a3206'
    ctx.strokeText(it.text, 0, 0)
    ctx.fillStyle = pal.core
    ctx.fillText(it.text, 0, 0)
    ctx.restore()
    ctx.globalAlpha = 1
  },
}

// ---------------------------------------------------------------------------------------------
// Spawn layer.
//
// `FX.<x>(take, A, at, over)` appends one effect instance to a take, reading the current panel
// values unless `over` overrides them. BOTH the per-effect cards and the presets go through these
// same functions -- so a slider edit and a preset produce the exact same instance shape, and a
// preset is just "these calls, at these times". Particles are materialised here, once.

const SEED_BASE = 1337

const FX = {
  trail(take, A, at, over = {}) {
    return push(take, {
      kind: 'trail', at, dur: over.dur ?? P.trailDur,
      from: { x: A.launch.x, y: A.launch.y }, to: { x: A.hit.x, y: A.hit.y },
      arc: over.arc ?? P.trailArc,
      width: (over.width ?? P.trailWidth) * (over.intensity ?? P.intensity),
      pal: over.pal ?? P.trailKind,
    })
  },

  flash(take, A, at, over = {}) {
    return push(take, {
      kind: 'flash', at, dur: over.dur ?? P.flashDur,
      x: over.x ?? A.hit.x, y: over.y ?? A.hit.y,
      unit: over.unit ?? A.cellU,
      scale: (over.scale ?? P.flashScale) * (over.intensity ?? P.intensity),
      pal: over.pal ?? P.flashKind,
    })
  },

  sparks(take, A, at, over = {}) {
    const count = Math.round((over.count ?? P.sparkCount) * (over.intensity ?? P.intensity))
    const dur = over.dur ?? P.sparkDur
    const x = over.x ?? A.hit.x
    const y = over.y ?? A.hit.y
    // Spray away from the incoming direction: the arrow comes from A.hitDir, so debris flies back.
    const back = (over.dir ?? A.hitDir) + Math.PI
    const rnd = srand(SEED_BASE + Math.round(at) + count)
    const parts = []
    for (let i = 0; i < count; i++) {
      parts.push({
        ang: back + (rnd() * 2 - 1) * 1.25,
        spd: (0.25 + rnd() * 0.75) * A.cellU * 3.4,
        size: 2 + rnd() * 4.2,
        delay: rnd() * dur * 0.14,
        g: (0.35 + rnd() * 1.15) * A.cellU * 2.1,
        hot: rnd() < 0.3,
      })
    }
    return push(take, { kind: 'sparks', at, dur, x, y, parts, spread: over.spread ?? P.sparkSpread, pal: over.pal ?? P.sparkKind })
  },

  dmg(take, A, at, over = {}) {
    return push(take, {
      kind: 'dmg', at, dur: over.dur ?? P.dmgDur,
      x: (over.x ?? A.hit.x) + A.cellU * 0.35,
      y: (over.y ?? A.hit.y) - A.cellU * 0.4,
      unit: A.cellU,
      rise: over.rise ?? A.cellU * 1.1,
      size: (over.size ?? P.dmgSize) * (over.intensity ?? P.intensity),
      style: over.style ?? P.dmgKind,
      text: over.text ?? String(Math.round((over.value ?? P.dmgValue) * (over.intensity ?? P.intensity))),
      seed: SEED_BASE,
    })
  },

  squash(take, A, at, over = {}) {
    // Target transform: kept on the take itself because only one can be live at a time.
    take.tgt.squash = {
      at, dur: over.dur ?? P.sqDur,
      recoil: (over.recoil ?? P.sqRecoil) * (over.intensity ?? P.intensity),
      squash: (over.squash ?? P.sqSquash) * (over.intensity ?? P.intensity),
      dir: over.dir ?? A.hitDir,
    }
    return push(take, { kind: 'squash', at, dur: over.dur ?? P.sqDur, pal: 'warm' })
  },

  tint(take, A, at, over = {}) {
    take.tgt.tint = { at, dur: over.dur ?? 160, k: (over.k ?? 0.85) * (over.intensity ?? P.intensity) }
  },

  hitstop(take, A, at, over = {}) {
    const dur = over.dur ?? P.hsDur
    if (dur <= 0) return null
    // One hit-stop per take -- combining two windows would be a different (much more complex)
    // time warp, and nothing in this lab needs it.
    take.hs = { at, dur, strength: 1 - (over.strength ?? P.hsStrength) }
    return take.hs
  },

  camera(take, A, at, over = {}) {
    return push(take, {
      kind: 'shake', at,
      dur: over.dur ?? P.camDur,
      amp: (over.amp ?? P.camAmp) * (over.intensity ?? P.intensity),
      freq: over.freq ?? P.camFreq,
    })
  },

  poof(take, A, at, over = {}) {
    const dur = over.dur ?? P.poofDur
    const count = Math.round((over.count ?? P.poofCount) * (over.intensity ?? P.intensity))
    const scale = over.scale ?? P.poofScale
    const rnd = srand(SEED_BASE + 91)
    const puffs = []
    for (let i = 0; i < count; i++) {
      puffs.push({
        ang: rnd() * 6.28,
        dist: A.cellU * (1.0 + rnd() * 2.2) * scale,
        size: A.cellU * (0.32 + rnd() * 0.5) * scale,
        rise: A.cellU * (0.35 + rnd() * 1.3),
        delay: rnd() * dur * 0.2,
      })
    }
    const parts = []
    const embers = Math.round(count * 0.5)
    for (let i = 0; i < embers; i++) {
      parts.push({
        ang: rnd() * 6.28,
        spd: (0.3 + rnd() * 0.9) * A.cellU * 3,
        size: 2 + rnd() * 3.4,
        delay: rnd() * dur * 0.15,
        g: (0.2 + rnd() * 0.9) * A.cellU * 1.8,
      })
    }
    // The sprite's own dissolve is driven from here so "death" and "the body disappears" cannot
    // drift apart or be triggered independently by accident.
    take.tgt.poof = { at, dur }
    return push(take, { kind: 'poof', at, dur, x: A.hit.x, y: A.hit.y, puffs, parts, pal: over.pal ?? P.poofKind })
  },

  boss(take, A, at, over = {}) {
    const rnd = srand(SEED_BASE + 55)
    const dustN = Math.round((over.dust ?? P.bossDust) * (over.intensity ?? P.intensity))
    const dust = []
    for (let i = 0; i < dustN; i++) {
      dust.push({
        side: (rnd() * 2 - 1) * (0.4 + rnd() * 0.9),
        rise: A.cellU * (0.25 + rnd() * 1.5),
        size: A.cellU * (0.28 + rnd() * 0.5),
        delay: rnd() * 280,
      })
    }
    push(take, {
      kind: 'shock', at, dur: over.dur ?? 640,
      x: A.ground.x, y: A.ground.y,
      scale: over.ring ?? P.bossRing, dust, pal: over.pal ?? P.flashKind,
    })
    FX.flash(take, A, at, { scale: P.flashScale * 1.5, dur: P.flashDur * 1.25, pal: over.pal ?? P.flashKind })
    FX.sparks(take, A, at + 10, { count: P.sparkCount * 1.4 })
    FX.camera(take, A, at, { amp: over.amp ?? P.bossAmp, dur: 540, freq: 17 })
    FX.hitstop(take, A, at, { dur: over.hs ?? P.bossHs, strength: 0.92 })
  },

  reward(take, A, at, over = {}) {
    const dur = over.dur ?? P.rwDur
    const count = Math.round((over.count ?? P.rwCount) * (over.intensity ?? P.intensity))
    const rnd = srand(SEED_BASE + 17)
    const sparkles = []
    for (let i = 0; i < count; i++) {
      sparkles.push({
        ang: rnd() * 6.28,
        dist: A.cellU * (0.5 + rnd() * 1.9),
        size: A.cellU * (0.08 + rnd() * 0.12),
        delay: rnd() * dur * 0.35,
        phase: rnd() * 6.28,
      })
    }
    return push(take, {
      kind: 'reward', at, dur,
      x: A.hit.x, y: A.hit.y - A.cellU * 0.5,
      unit: A.cellU, sparkles,
      rise: over.rise ?? P.rwRise,
      text: over.text ?? P.rwText,
    })
  },
}

// ---------------------------------------------------------------------------------------------
// Presets.
//
// A preset is a coherent whole: it resets every effect parameter to the values below and then
// lays the effects out on one timeline. `intensity` and `speed` are user-global and are NOT reset
// -- they are the master knobs for comparing presets against each other at the same strength.
//
// Impact is timed to the projectile's arrival (trail travel is half of its duration), so the whole
// chain is driven by trailDur: change the trail and the hit follows it.

const PRESET_BASE = { ...P }

const PRESETS = [
  {
    id: 'light-hit', label: 'light hit', spot: 'top',
    params: {
      trailDur: 200, trailWidth: 7, trailArc: 0.08, trailKind: 'warm',
      flashDur: 200, flashScale: 0.85, sparkCount: 14, sparkDur: 420, sparkSpread: 0.85,
      dmgValue: 12, dmgDur: 620, dmgSize: 0.9, dmgKind: 'light',
      sqRecoil: 7, sqSquash: 0.10, sqDur: 260,
      camAmp: 2, camDur: 200, camFreq: 24, hsDur: 0,
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.flash(take, A, t0)
      FX.sparks(take, A, t0)
      FX.tint(take, A, t0, { k: 0.7 })
      FX.squash(take, A, t0)
      FX.dmg(take, A, t0 + 30)
      FX.camera(take, A, t0)
    },
  },
  {
    id: 'heavy-hit', label: 'heavy hit', spot: 'top',
    params: {
      trailDur: 260, trailWidth: 12, trailArc: 0.14, trailKind: 'warm',
      flashDur: 280, flashScale: 1.7, sparkCount: 36, sparkDur: 620, sparkSpread: 1.15,
      dmgValue: 48, dmgDur: 780, dmgSize: 1.15, dmgKind: 'heavy',
      sqRecoil: 16, sqSquash: 0.26, sqDur: 340,
      camAmp: 7, camDur: 300, camFreq: 20, hsDur: 60, hsStrength: 0.9,
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.flash(take, A, t0)
      FX.sparks(take, A, t0)
      FX.tint(take, A, t0, { k: 1 })
      FX.squash(take, A, t0)
      FX.dmg(take, A, t0 + 30)
      FX.camera(take, A, t0)
      FX.hitstop(take, A, t0)
    },
  },
  {
    id: 'magic-hit', label: 'magic hit', spot: 'top',
    params: {
      trailDur: 240, trailWidth: 10, trailArc: 0.22, trailKind: 'arcane',
      flashDur: 300, flashScale: 1.4, flashKind: 'arcane',
      sparkCount: 30, sparkDur: 700, sparkSpread: 1.2, sparkKind: 'arcane',
      dmgValue: 31, dmgDur: 900, dmgSize: 1.1, dmgKind: 'magic',
      sqRecoil: 8, sqSquash: 0.12, sqDur: 300,
      camAmp: 3, camDur: 240, camFreq: 22, hsDur: 30, hsStrength: 0.86,
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.flash(take, A, t0)
      FX.sparks(take, A, t0)
      FX.tint(take, A, t0, { k: 0.85 })
      FX.squash(take, A, t0)
      FX.dmg(take, A, t0 + 40)
      FX.camera(take, A, t0)
      FX.hitstop(take, A, t0)
    },
  },
  {
    id: 'boss-hit', label: 'boss hit', spot: 'boss',
    params: {
      trailDur: 300, trailWidth: 14, trailArc: 0.12, trailKind: 'warm',
      flashDur: 320, flashScale: 1.6, sparkCount: 30, sparkDur: 640, sparkSpread: 1.1,
      dmgValue: 120, dmgDur: 880, dmgSize: 1.2, dmgKind: 'heavy',
      sqRecoil: 10, sqSquash: 0.16, sqDur: 360,
      bossRing: 1.6, bossDust: 26, bossHs: 80, bossAmp: 12,
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.tint(take, A, t0, { k: 0.9 })
      FX.squash(take, A, t0)
      FX.dmg(take, A, t0 + 40)
      FX.boss(take, A, t0)
    },
  },
  {
    id: 'kill', label: 'kill', spot: 'top',
    params: {
      trailDur: 240, trailWidth: 11, trailArc: 0.12, trailKind: 'warm',
      flashDur: 320, flashScale: 1.8, sparkCount: 52, sparkDur: 760, sparkSpread: 1.3,
      dmgValue: 999, dmgDur: 950, dmgSize: 1.3, dmgKind: 'crit',
      sqRecoil: 18, sqSquash: 0.30, sqDur: 380,
      camAmp: 9, camDur: 360, camFreq: 19, hsDur: 90, hsStrength: 0.9,
      poofDur: 900, poofScale: 1.35, poofCount: 44, poofKind: 'warm',
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.flash(take, A, t0)
      FX.sparks(take, A, t0)
      FX.tint(take, A, t0, { k: 1 })
      FX.squash(take, A, t0, { squash: 0.34, recoil: 20 })
      FX.dmg(take, A, t0 + 40)
      FX.camera(take, A, t0)
      FX.poof(take, A, t0 + 50)
      FX.hitstop(take, A, t0)
    },
  },
  {
    id: 'boss-kill', label: 'boss kill', spot: 'boss',
    params: {
      trailDur: 320, trailWidth: 15, trailArc: 0.10, trailKind: 'warm',
      flashDur: 380, flashScale: 1.9, sparkCount: 60, sparkDur: 860, sparkSpread: 1.35,
      dmgValue: 9999, dmgDur: 1200, dmgSize: 1.5, dmgKind: 'crit',
      sqRecoil: 14, sqSquash: 0.22, sqDur: 420,
      bossRing: 3.1, bossDust: 54, bossHs: 150, bossAmp: 20,
      poofDur: 1200, poofScale: 2.0, poofCount: 64, poofKind: 'soul',
    },
    build(take, A) {
      const t0 = P.trailDur * 0.5
      FX.trail(take, A, 0)
      FX.tint(take, A, t0, { k: 1 })
      FX.squash(take, A, t0, { squash: 0.24, recoil: 16 })
      FX.dmg(take, A, t0 + 50)
      FX.boss(take, A, t0)
      FX.poof(take, A, t0 + 80)
    },
  },
  {
    id: 'blocked-tap', label: 'blocked tap', spot: 'top',
    params: {
      flashDur: 220, flashScale: 0.7, flashKind: 'blood',
      sparkCount: 0, camAmp: 2, camDur: 160, camFreq: 26, hsDur: 0,
      dmgDur: 460, dmgSize: 1.0, dmgKind: 'blocked', dmgValue: 0,
    },
    build(take, A) {
      // Deliberately reads as a rejection ON THE BOARD, not as damage to the enemy: no trail, no
      // damage number, no hit-stop, no enemy recoil. It must never compete with a real hit.
      FX.flash(take, A, 0, { x: A.board.x, y: A.board.y, scale: 0.7, pal: 'blood', dur: 200 })
      FX.dmg(take, A, 40, {
        x: A.board.x + A.cellU * 0.2, y: A.board.y - A.cellU * 0.35,
        text: '✕', style: 'blocked', size: 1.0, rise: A.cellU * 0.5,
      })
      FX.camera(take, A, 0)
    },
  },
  {
    id: 'reward', label: 'reward', spot: 'top',
    params: {
      rwDur: 1100, rwCount: 26, rwRise: 90, rwText: '+25',
      flashDur: 260, flashScale: 1.0, flashKind: 'gold',
      sparkCount: 16, sparkDur: 600, sparkSpread: 1.0, sparkKind: 'gold',
      camAmp: 1.5, camDur: 200, camFreq: 22, hsDur: 0,
    },
    build(take, A) {
      FX.reward(take, A, 0)
      FX.flash(take, A, 30, { scale: 1.0, pal: 'gold', dur: 240 })
      FX.sparks(take, A, 20, { pal: 'gold' })
      FX.camera(take, A, 0)
    },
  },
]

// ---------------------------------------------------------------------------------------------
// Effect cards: the 10 independently triggerable effects, each declaring only the parameters that
// actually do something for it (the task asks not to give every effect the same slider set).
//
// Two cards need a note:
//   * "enemy recoil" is a TARGET transform, not a drawing pass, so the card also tints the sprite
//     -- otherwise a lone recoil has nothing visible to be judged against.
//   * "hit-stop" freezes TIME, so on its own there would be nothing to watch. It therefore always
//     plays one long flash alongside: the freeze is then visible as that flash stopping mid-
//     expansion, and measurable on the time bars.

const CARDS = [
  {
    id: 'trail', name: '1 · projectile trail',
    params: ['trailDur', 'trailWidth', 'trailKind', 'trailArc', 'intensity'],
    spawn: (take, A) => FX.trail(take, A, 0),
  },
  {
    id: 'flash', name: '2 · impact flash',
    params: ['flashDur', 'flashScale', 'flashKind', 'intensity'],
    spawn: (take, A) => FX.flash(take, A, 0),
  },
  {
    id: 'sparks', name: '3 · hit sparks',
    params: ['sparkCount', 'sparkDur', 'sparkSpread', 'sparkKind', 'intensity'],
    spawn: (take, A) => FX.sparks(take, A, 0),
  },
  {
    id: 'dmg', name: '4 · damage number',
    params: ['dmgValue', 'dmgDur', 'dmgSize', 'dmgKind', 'intensity'],
    spawn: (take, A) => FX.dmg(take, A, 0),
  },
  {
    id: 'squash', name: '5 · enemy recoil',
    params: ['sqRecoil', 'sqSquash', 'sqDur', 'intensity'],
    spawn: (take, A) => { FX.tint(take, A, 0, { k: 0.8 }); FX.squash(take, A, 0) },
  },
  {
    id: 'hitstop', name: '6 · hit-stop (visual)',
    params: ['hsDur', 'hsStrength'],
    spawn: (take, A) => {
      FX.flash(take, A, 0, { dur: Math.max(420, P.hsDur + 200) })
      FX.camera(take, A, 0)
      FX.hitstop(take, A, 0)
    },
  },
  {
    id: 'camera', name: '7 · camera impulse',
    params: ['camAmp', 'camDur', 'camFreq', 'intensity'],
    spawn: (take, A) => FX.camera(take, A, 0),
  },
  {
    id: 'poof', name: '8 · death burst / poof',
    params: ['poofDur', 'poofScale', 'poofCount', 'poofKind', 'intensity'],
    spawn: (take, A) => FX.poof(take, A, 0),
  },
  {
    id: 'boss', name: '9 · boss impact', spot: 'boss',
    params: ['bossRing', 'bossDust', 'bossHs', 'bossAmp', 'intensity'],
    spawn: (take, A) => FX.boss(take, A, 0),
  },
  {
    id: 'reward', name: '10 · reward pop',
    params: ['rwDur', 'rwCount', 'rwRise', 'rwText', 'intensity'],
    spawn: (take, A) => FX.reward(take, A, 0),
  },
]

// ---------------------------------------------------------------------------------------------
// State.

const state = {
  take: null,
  presetId: null,
  cardId: null,
  // What the current take was built from -- survives clearPreset on purpose, so a take can be
  // rebuilt (new anchors, same parameters) without losing hand-tuned slider values.
  source: null,
  // True only while the take still exactly matches a ?preset=/ ?card= deep link the user has not
  // touched. Gates the auto-heal below: once the user edits anything, the lab stops second-
  // guessing them.
  fromQuery: false,
  // Non-null while paused/scrubbed: REAL time is pinned here and display time is derived from it
  // through the hit-stop warp, so a frozen frame -- and therefore a frame URL -- reproduces exactly.
  frozenAt: null,
  showBars: true,
}

const arena = loadSprite('./assets/arena-moonlit-fortress.png')

// ---------------------------------------------------------------------------------------------
// Scene rendering.

function dpr() { return window.devicePixelRatio || 1 }

/** Arena art, cover-fitted with a little zoom headroom so a camera impulse can never expose the
 * canvas edge. Drawn INSIDE the shaken transform, so a shake moves the whole scene and not just
 * the effects -- that is what a camera impulse actually looks like. */
function drawBackdrop(ctx, w, h) {
  ctx.fillStyle = '#0d0b11'
  ctx.fillRect(-60, -60, w + 120, h + 120)
  if (arena.ready) {
    const iw = arena.img.naturalWidth
    const ih = arena.img.naturalHeight
    const s = Math.max(w / iw, h / ih) * 1.05
    const dw = iw * s
    const dh = ih * s
    ctx.drawImage(arena.img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#1b1730')
    g.addColorStop(1, '#0d0b11')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

/** Faint projection of the lab's own 6x5 grid: the projectile's board-space origin stays legible,
 * and it is visible at a glance that the effects and the board share ONE projection. */
function drawBoardHint(ctx, A) {
  const H = A.plane.H
  const u0 = 0.5 - A.fit.gridU / 2
  const v0 = 0.5 - A.fit.gridV / 2
  ctx.save()
  ctx.strokeStyle = 'rgba(255,240,205,0.10)'
  ctx.lineWidth = 1
  for (let i = 0; i <= BOARD_COLS; i++) {
    const u = u0 + (i / BOARD_COLS) * A.fit.gridU
    const a = project(H, u, v0)
    const b = project(H, u, v0 + A.fit.gridV)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (let j = 0; j <= BOARD_ROWS; j++) {
    const v = v0 + (j / BOARD_ROWS) * A.fit.gridV
    const a = project(H, u0, v)
    const b = project(H, u0 + A.fit.gridU, v)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The test target: an arena-art sprite plus the recoil / dissolve transforms the effects drive.
 *
 * Two BUILD-020 lessons are honoured: the hit tint is applied with source-atop inside the sprite's
 * own offscreen buffer (so it can never bleed outside the silhouette as a translucent rectangle),
 * and the squash keeps the feet planted -- scaleY shrinks upward from the ground point instead of
 * around the sprite's middle. */
function drawTarget(ctx, A, take, t) {
  const sq = take?.tgt.squash
  const k = sq ? punch((t - sq.at) / sq.dur) : 0
  const dx = sq ? Math.cos(sq.dir) * sq.recoil * k : 0
  const dy = sq ? Math.sin(sq.dir) * sq.recoil * k * 0.35 : 0
  const sx = 1 + (sq ? sq.squash * k * 0.85 : 0)
  const sy = 1 - (sq ? sq.squash * k : 0)

  const poof = take?.tgt.poof
  const p = poof ? clamp01((t - poof.at) / poof.dur) : 0
  const tint = take?.tgt.tint
  const tk = tint ? clamp01(1 - (t - tint.at) / tint.dur) * tint.k : 0

  const w = A.box.w * sx * (1 + p * 0.08)
  const h = A.box.h * sy * (1 + p * 0.08)
  const x = A.ground.x - w / 2 + dx
  const y = A.ground.y - h + dy - easeOutCubic(p) * A.cellU * 0.35
  const alpha = 1 - smoothstep(p)

  // Ground shadow: without it the sprite reads as pasted onto the art.
  ctx.save()
  ctx.globalAlpha = 0.30 * (1 - p)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  ctx.ellipse(A.ground.x + dx * 0.5, A.ground.y + 2, A.box.w * 0.34 * sx, A.box.w * 0.09, 0, 0, 6.29)
  ctx.fill()
  ctx.restore()

  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  if (A.sprite.ready) {
    ctx.drawImage(composeSprite(A.sprite, { tint: tk, dissolve: p, seed: 4211 }), x, y, w, h)
  } else {
    // Placeholder, so the lab stays usable while the PNG loads -- or if it is missing.
    ctx.fillStyle = A.sprite.failed ? 'rgba(170,80,80,0.30)' : 'rgba(255,255,255,0.10)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    roundRect(ctx, x, y, w, h, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(A.sprite.failed ? 'sprite missing' : 'loading…', x + w / 2, y + h / 2)
  }
  ctx.restore()
}

/** Time bars. Worth keeping: hit-stop is otherwise invisible-but-felt, and these bars turn
 * "that felt heavy" into a number -- the display bar visibly stalls against the real bar for
 * exactly the freeze window, and the red marker shows where that window sits in the take. They
 * also show where a paused/scrubbed frame is, which is what makes a shared frame URL meaningful. */
function drawBars(ctx, w, h, take, tRaw, tDisp) {
  if (!state.showBars || !take) return
  const real = Math.max(1, realDur(take))
  const bw = Math.min(440, w * 0.5)
  const bx = (w - bw) / 2
  const by = h - 24
  const bh = 5

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  roundRect(ctx, bx - 8, by - 18, bw + 16, bh * 2 + 30, 9)
  ctx.fill()

  const bar = (y, frac, color) => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(bx, y, bw, bh)
    ctx.fillStyle = color
    ctx.fillRect(bx, y, bw * clamp01(frac), bh)
  }
  // Real time (dim) over display time (accent). They diverge ONLY inside a hit-stop window.
  bar(by, tRaw / real, 'rgba(255,255,255,0.45)')
  bar(by + bh + 4, tDisp / real, '#ffd76a')

  if (take.hs) {
    const a = bx + (take.hs.at / real) * bw
    const b = a + (take.hs.dur / real) * bw
    ctx.fillStyle = 'rgba(255,107,107,0.5)'
    ctx.fillRect(a, by - 3, Math.max(1, b - a), bh + 6)
  }

  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textAlign = 'left'
  ctx.fillText(`real ${Math.round(tRaw)}ms`, bx, by - 6)
  ctx.textAlign = 'right'
  ctx.fillStyle = take.hs ? '#ffb0b0' : 'rgba(255,215,106,0.85)'
  const label = take.hs
    ? `display ${Math.round(tDisp)}ms · hit-stop ${take.hs.dur}ms @ ${take.hs.strength.toFixed(2)}x`
    : `display ${Math.round(tDisp)}ms`
  ctx.fillText(label, bx + bw, by - 6)
  ctx.restore()
}

/** Draw order is fixed by KIND, not by spawn order, so layering stays stable no matter how a take
 * was assembled. The damage number is deliberately last (it is information, and must stay legible
 * on top of everything else). */
const RENDER_ORDER = ['trail', 'flash', 'shock', 'sparks', 'poof', 'squash', 'reward', 'dmg']

function drawScene(ctx, A, take, t) {
  drawTarget(ctx, A, take, t)
  if (!take) return
  for (const kind of RENDER_ORDER) {
    for (const it of take.items) {
      if (it.kind !== kind) continue
      if (t < it.at || t > it.at + it.dur) continue
      const fn = RENDER[kind]
      if (fn) fn(ctx, it, t, A)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Render + loop.

function render(now) {
  const { w, h } = stageSize()
  const scale = dpr()
  const pw = Math.round(w * scale)
  const ph = Math.round(h * scale)
  if (ui.canvas.width !== pw || ui.canvas.height !== ph) {
    ui.canvas.width = pw
    ui.canvas.height = ph
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const A = computeAnchors()
  const take = state.take

  const stageBox = stageSize()
  const dprNow = dpr()
  if (take && take.dbgOnce == null) {
    take.dbgOnce = { stageW: stageBox.w, stageH: stageBox.h, cw: ui.canvas.width, ch: ui.canvas.height, dpr: dprNow }
  }

  // `at` (and therefore frozenAt) is REAL ms. Display time is derived, never stored -- that is what
  // makes a hit-stop frame reproducible from a URL alone.
  let tRaw = 0
  if (take) {
    tRaw = state.frozenAt != null
      ? state.frozenAt
      : Math.min(Math.max(0, (now - take.t0) * P.speed), realDur(take))
  }
  const tDisp = timeWarp(tRaw, take?.hs)
  const cam = camOffset(tRaw, take ? shakesOf(take) : [])

  // Everything inside this transform is the "world": the arena moves with the camera impulse.
  ctx.save()
  ctx.translate(cam.x, cam.y)
  drawBackdrop(ctx, w, h)
  drawBoardHint(ctx, A)
  drawScene(ctx, A, take, tDisp)
  ctx.restore()

  // HUD-ish overlays are NOT shaken -- a camera impulse must not move the readouts.
  drawBars(ctx, w, h, take, tRaw, tDisp)
  updateDebug(A, take, tRaw, tDisp, stageBox, dprNow)
}

let raf = 0
function kick() {
  if (!raf) raf = requestAnimationFrame(frame)
}

function frame(now) {
  raf = 0
  render(now)
  autoHeal()
  if (isAnimating(performance.now())) kick()
}

/** First-paint rebase: if the page opened from a deep link and nothing has been touched yet, the
 * take built during module init still carries the pre-layout coordinate space (the stage had no
 * size then). Once real layout exists, respawn the SAME take through the SAME builder: parameters
 * come from the panel, so slider values and the whole setup survive -- only the baked pixel
 * positions are recomputed. Gated on state.fromQuery so any hand control (including the same
 * buttons reached by keyboard) permanently opts out of the rebuild.
 *
 * NOTE: the healed take must be REPAINTED synchronously here. kick() alone is not enough: a
 * frozen frame (?at=) never schedules another rAF, so without this the first paint -- with the
 * stale coordinates -- is what the user (and any screenshot) keeps seeing. */
function autoHeal() {
  if (!state.fromQuery) return
  if (!state.take || !state.source) return
  const { w, h } = stageSize()
  if (w <= 320 || h <= 200) return
  if (state.healed) return
  const take = newTake(state.take.id)
  buildTakeFromSource(take)
  take.t0 = state.take.t0
  state.take = take
  state.healed = true
  updateScrub()
  render(performance.now())
}

function buildTakeFromSource(take) {
  const A = computeAnchors()
  state.source.build(take, A)
  take.anchors = freshAnchors(A)
}

/** Keep the loop alive only while a take is actually running -- the same keep-alive rule the
 * playable renderer uses. Slider edits and sprite loads call kick() explicitly, and a paused frame
 * needs no frames at all. */
function isAnimating(now) {
  const take = state.take
  if (!take || state.frozenAt != null) return false
  return (now - take.t0) * P.speed < realDur(take)
}

/** Shareable frame link. `at` is real ms; `preset`/`card` say what to replay, `spot`/`speed` keep
 * the rest of the context. Everything else comes from the preset's own parameters. */
function frameUrl(tRaw) {
  const q = new URLSearchParams()
  if (state.presetId) q.set('preset', state.presetId)
  if (state.cardId) q.set('card', state.cardId)
  q.set('spot', P.spot)
  q.set('speed', String(P.speed))
  q.set('at', String(Math.round(tRaw)))
  return `${location.origin}${location.pathname}?${q.toString()}`
}

function updateDebug(A, take, tRaw, tDisp, stageBox, dprNow) {
  // One AIS line: live painter coordinates vs the take's baked ones. Equal numbers mean one
  // space; different numbers mean the take was built before layout settled (deep-link first
  // paint before autoHeal, or a window resize after the trigger). A is the painter, baked is
  // what the effects behind it use -- the user needs to see BOTH numbers, not a verdict.
  const b = take?.anchors
  const ais = !b || (A.board.x - b.board.x) ** 2 + (A.board.y - b.board.y) ** 2 + (A.ground.x - b.ground.x) ** 2 + (A.ground.y - b.ground.y) ** 2 < 4
  const lines = [
    `take    ${take ? take.id : '—'} · ${take ? take.items.length : 0} effects · ${take ? Math.round(realDur(take)) : 0}ms real`,
    `time    real ${tRaw.toFixed(0)}ms · display ${tDisp.toFixed(0)}ms${take?.hs ? ` · hit-stop ${take.hs.dur}ms @ ${take.hs.strength.toFixed(2)}x` : ''}`,
    `state   ${state.frozenAt == null ? 'playing' : `frozen @ ${Math.round(state.frozenAt)}ms`} · speed ${P.speed}x · spot ${P.spot}`,
    `live    board ${A.board.x.toFixed(0)},${A.board.y.toFixed(0)} · target ${A.ground.x.toFixed(0)},${A.ground.y.toFixed(0)} · cell ${A.cellU.toFixed(1)}px`,
    `space   stage ${stageBox.w}x${stageBox.h} · backing ${ui.canvas.width}x${ui.canvas.height} · dpr ${dprNow}`,
    `boot    ${take?.dbgOnce ? `built@${take.dbgOnce.stageW}x${take.dbgOnce.stageH}/dpr${take.dbgOnce.dpr}` : '—'}`,
    `baked   ${b ? `board ${b.board.x.toFixed(0)},${b.board.y.toFixed(0)} · target ${b.ground.x.toFixed(0)},${b.ground.y.toFixed(0)} · cell ${b.cellU.toFixed(1)}px` : '—'}${b && !ais ? ' · MISMATCH' : ''}`,
    `frame   ${frameUrl(tRaw)}`,
  ]
  ui.debug.textContent = lines.join('\n')
  ui.caption.textContent = take
    ? `${take.id} · ${take.items.length} effects · ${Math.round(realDur(take))}ms`
    : 'idle — выбери preset или trigger эффекта'
}

// ---------------------------------------------------------------------------------------------
// UI. Generated from data (SPEC / CARDS / PRESETS), so adding an effect does not mean hand-writing
// a panel block.

const $ = (id) => document.getElementById(id)

const ui = {
  stage: $('stage'), canvas: $('fx'), caption: $('caption'), statusbar: $('statusbar'),
  presets: $('presets'), take: $('take'), cards: $('cards'), debug: $('debug'), fxCount: $('fxCount'),
  spotSelect: null, speedSelect: null,
}
const ctx = ui.canvas.getContext('2d')

const inputs = new Map()

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function fmt(v, spec) {
  if (typeof v === 'number') return `${Math.round(v * 100) / 100}${spec?.unit ? ` ${spec.unit}` : ''}`
  return String(v)
}

/** One parameter row, generated from SPEC. Also registers a refresher so a preset can push its own
 * values back into the visible controls (otherwise the panel would lie after applying a preset). */
function paramRow(key) {
  const spec = SPEC[key]
  const row = el('div', 'row')
  row.append(el('label', null, spec.label))
  if (spec.kind === 'select') {
    const sel = el('select')
    for (const o of spec.options) sel.append(new Option(o, o))
    sel.value = String(P[key])
    sel.onchange = () => { P[key] = sel.value; clearPreset(); kick() }
    row.append(sel)
    inputs.set(key, (v) => { sel.value = String(v) })
    return row
  }
  if (spec.kind === 'number' || spec.kind === 'text') {
    const inp = el('input')
    inp.type = spec.kind === 'number' ? 'number' : 'text'
    inp.value = String(P[key])
    inp.oninput = () => {
      P[key] = spec.kind === 'number' ? Number(inp.value) : inp.value
      clearPreset()
      kick()
    }
    row.append(inp)
    inputs.set(key, (v) => { inp.value = String(v) })
    return row
  }
  const rng = el('input')
  rng.type = 'range'
  rng.min = String(spec.min)
  rng.max = String(spec.max)
  rng.step = String(spec.step)
  rng.value = String(P[key])
  const val = el('div', 'val')
  const show = (v) => { val.textContent = fmt(v, spec) }
  show(P[key])
  rng.oninput = () => {
    P[key] = Number(rng.value)
    show(P[key])
    clearPreset()
    kick()
  }
  row.append(rng, val)
  inputs.set(key, (v) => { rng.value = String(v); show(v) })
  return row
}

function syncInputs() {
  for (const [k, set] of inputs) set(P[k])
  if (ui.spotSelect) ui.spotSelect.value = P.spot
  if (ui.speedSelect) ui.speedSelect.value = String(P.speed)
}

/** A preset is one coherent set of values, so touching any control detaches from it -- otherwise
 * the highlighted preset button would keep claiming something the panel no longer shows. */
function clearPreset() {
  state.presetId = null
  state.cardId = null
  for (const b of ui.presets.querySelectorAll('button')) b.classList.remove('on')
}

function applyPresetParams(patch) {
  const next = { ...PRESET_BASE, ...patch }
  for (const k of Object.keys(PRESET_BASE)) {
    if (k === 'intensity' || k === 'speed') continue
    P[k] = next[k]
  }
}

function buildCards() {
  for (const card of CARDS) {
    const box = el('div', 'card')
    const head = el('div', 'card-head')
    head.append(el('strong', null, card.name))
    const btn = el('button', 'trigger', 'trigger')
    btn.onclick = () => playCard(card)
    head.append(btn)
    box.append(head)
    const body = el('div', 'card-body')
    for (const key of card.params) body.append(paramRow(key))
    box.append(body)
    ui.cards.append(box)
  }
  ui.fxCount.textContent = `(${CARDS.length})`
}

function buildTake(id, build) {
  const A = computeAnchors()
  const take = newTake(id)
  build(take, A)
  take.t0 = performance.now()
  take.anchors = freshAnchors(A)
  state.take = take
  state.frozenAt = null
  updateScrub()
  kick()
  return take
}

/** Snapshot of one take's baked coordinates, in real CSS px, for the mixed-space readout.
 * Take arrays mutate them degenerate cases aside -- here they always come from one fresh A. */
function freshAnchors(A) {
  return {
    board: { ...A.board },
    ground: { ...A.ground },
    hit: { ...A.hit },
    launch: { ...A.launch },
    cellU: A.cellU,
  }
}

function playPreset(preset) {
  applyPresetParams({ ...preset.params, spot: preset.spot })
  state.presetId = preset.id
  state.cardId = null
  state.source = { kind: 'preset', build: preset.build }
  state.fromQuery = false // user-invoked takes are never the pristine deep-link state
  for (const b of ui.presets.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.id === preset.id)
  }
  syncInputs()
  buildTake(preset.id, preset.build)
}

function playCard(card) {
  if (card.spot && P.spot !== card.spot) {
    P.spot = card.spot
    syncInputs()
  }
  state.cardId = card.id
  state.presetId = null
  state.source = { kind: 'card', build: card.spawn }
  state.fromQuery = false // user-invoked takes are never the pristine deep-link state
  for (const b of ui.presets.querySelectorAll('button')) b.classList.remove('on')
  buildTake(card.id, card.spawn)
}

// ---------------------------------------------------------------------------------------------
// Take controls.

let scrub = null
let pauseBtn = null

function updateScrub() {
  if (scrub) {
    const take = state.take
    const real = take ? realDur(take) : 0
    scrub.input.max = String(Math.round(real))
    scrub.input.value = String(Math.round(state.frozenAt ?? 0))
    scrub.label.textContent = `${Math.round(state.frozenAt ?? 0)} ms`
  }
  if (pauseBtn) pauseBtn.textContent = state.frozenAt == null ? '⏸ pause' : '▶ play'
}

function togglePause() {
  const take = state.take
  if (!take) return
  if (state.frozenAt == null) {
    state.frozenAt = Math.min(realDur(take), (performance.now() - take.t0) * P.speed)
  } else {
    // Resume by rebasing the start, so the paused span is not silently skipped.
    take.t0 = performance.now() - state.frozenAt / P.speed
    state.frozenAt = null
  }
  updateScrub()
  kick()
}

function currentT() {
  const take = state.take
  if (!take) return 0
  if (state.frozenAt != null) return state.frozenAt
  return Math.min(realDur(take), (performance.now() - take.t0) * P.speed)
}

function replayCurrent() {
  if (state.presetId) return playPreset(PRESETS.find((p) => p.id === state.presetId))
  if (state.cardId) return playCard(CARDS.find((c) => c.id === state.cardId))
}

/** Copy a link that replays this exact frame: the URL carries preset/card, spot, speed and the
 * real-ms position, which is enough to land on the same picture, hit-stop included. */
async function copyFrameUrl(btn) {
  const url = frameUrl(currentT())
  const old = btn.textContent
  try {
    await navigator.clipboard.writeText(url)
    btn.textContent = '✓ copied'
  } catch {
    btn.textContent = '↑ see debug'
  }
  setTimeout(() => { btn.textContent = old }, 1200)
}

/** Save the current frame as a PNG -- exactly the canvas, so the arena, the sprite and the effects
 * are all in it (the control panel next to it deliberately is not). */
function downloadPng() {
  const a = document.createElement('a')
  a.download = `vfx-${state.presetId ?? state.cardId ?? 'lab'}-${Math.round(currentT())}ms.png`
  a.href = ui.canvas.toDataURL('image/png')
  a.click()
}

function buildTakeControls() {
  const spotRow = el('div', 'row')
  spotRow.append(el('label', null, 'target'))
  const spotSel = el('select')
  for (const id of Object.keys(SPOTS)) spotSel.append(new Option(id, id))
  spotSel.value = P.spot
  spotSel.onchange = () => { P.spot = spotSel.value; kick() }
  spotRow.append(spotSel)
  ui.spotSelect = spotSel
  ui.take.append(spotRow)

  const speedRow = el('div', 'row')
  speedRow.append(el('label', null, 'speed'))
  const speedSel = el('select')
  for (const s of [0.25, 0.5, 1]) speedSel.append(new Option(`${s}x`, String(s)))
  speedSel.value = String(P.speed)
  speedSel.onchange = () => { P.speed = Number(speedSel.value); kick() }
  speedRow.append(speedSel)
  ui.speedSelect = speedSel
  ui.take.append(speedRow)

  const btnRow = el('div', 'presets')
  const replay = el('button', null, '↻ replay')
  replay.onclick = () => replayCurrent()
  pauseBtn = el('button', null, '⏸ pause')
  pauseBtn.onclick = () => togglePause()
  btnRow.append(replay, pauseBtn)
  ui.take.append(btnRow)

  // `freeze at` is the comparison tool: drag it to stop the take anywhere and look at the frame.
  const sRow = el('div', 'row')
  sRow.append(el('label', null, 'freeze at'))
  const sInp = el('input')
  sInp.type = 'range'
  sInp.min = '0'
  sInp.max = '1000'
  sInp.step = '5'
  sInp.value = '0'
  sInp.oninput = () => {
    state.frozenAt = Number(sInp.value)
    updateScrub()
    kick()
  }
  const sVal = el('div', 'val')
  sRow.append(sInp, sVal)
  ui.take.append(sRow)
  scrub = { input: sInp, label: sVal }

  const ioRow = el('div', 'presets')
  const urlBtn = el('button', null, '🔗 frame URL')
  urlBtn.onclick = () => copyFrameUrl(urlBtn)
  const pngBtn = el('button', null, '⬇ PNG')
  pngBtn.onclick = () => downloadPng()
  const bars = el('button', 'on', 'time bars')
  bars.onclick = () => {
    state.showBars = !state.showBars
    bars.classList.toggle('on', state.showBars)
    kick()
  }
  ioRow.append(urlBtn, pngBtn, bars)
  ui.take.append(ioRow)
}

// ---------------------------------------------------------------------------------------------
// Boot.

/** `?preset=<id>` or `?card=<id>` (plus optional `spot`, `speed`, `at`) replays a frame on load.
 * `at` is real ms; when present the page opens paused on exactly that frame. */
function applyFromQuery() {
  const q = new URLSearchParams(location.search)
  const spot = q.get('spot')

  const preset = PRESETS.find((p) => p.id === q.get('preset'))
  const card = CARDS.find((c) => c.id === q.get('card'))
  if (preset) { playPreset(preset); state.fromQuery = true }
  else if (card) { playCard(card); state.fromQuery = true }

  // URL wins over the preset's own default spot/speed: a shared frame link has to reproduce the
  // spot it was taken on, and applying the preset first is what makes that possible here.
  if (spot && SPOTS[spot]) P.spot = spot
  const speed = Number(q.get('speed'))
  if (Number.isFinite(speed) && speed > 0) P.speed = speed
  syncInputs()

  if (q.has('at')) {
    const at = Number(q.get('at'))
    if (Number.isFinite(at)) {
      state.frozenAt = Math.max(0, at)
      updateScrub()
    }
  }
}

function init() {
  for (const preset of PRESETS) {
    const b = el('button', null, preset.label)
    b.dataset.id = preset.id
    b.onclick = () => playPreset(preset)
    ui.presets.append(b)
  }
  buildTakeControls()
  buildCards()
  ui.statusbar.textContent = '1…8 — presets · R — replay · Space — pause · trigger у карточки — эффект отдельно'

  applyFromQuery()
  if (!state.presetId && !state.cardId) {
    // First paint with nothing running: the target just stands on the arena, which doubles as the
    // reference for judging whether an effect closes the screen or hides the actor.
    ui.caption.textContent = 'idle — выбери preset или trigger эффекта'
  }

  window.addEventListener('resize', kick)
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    const k = e.key.toLowerCase()
    const idx = Number(k) - 1
    if (k >= '1' && k <= '8' && PRESETS[idx]) {
      playPreset(PRESETS[idx])
      e.preventDefault()
    } else if (k === 'r') {
      replayCurrent()
      e.preventDefault()
    } else if (k === ' ') {
      togglePause()
      e.preventDefault()
    }
  })
  kick()
}

init()
