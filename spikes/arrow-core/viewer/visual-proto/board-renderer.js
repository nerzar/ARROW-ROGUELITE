// VIS-001: presentation-only board/target renderer. Reads EncounterState/Level/BoardTopology
// (via the same s.board.isAlive/canExit/ownerAt, s.arenaDir, s.enemies/bossSide accessors the
// EXP-008/009/010 debug viewers already use) and draws arrows exactly where Level says they are.
// It never mutates combat state and never invents rules -- game state changes are driven entirely
// by EncounterState; this module only plays back the *result* of a tap/rotate as animation.
import { DX, DY } from '../../dist/src/index.js'
import { bossSpeciesFor, resolveBossImage, resolveTargetImage, resolveWolfImage } from './assets.js'
import { BOSS_ANCHOR } from './boss-visual-state.js'
import { ENEMY_ANCHOR } from './enemy-visual-state.js'
import { speciesHudOffset, speciesHudScale, speciesPivotDelta, speciesScale, speciesShadowOffset } from './species-presentation.js'
import {
  ACTOR_BASE_CELL_FRAC,
  charSize, effectGround, faceRect,
  hudBoxes, podiumSlot, SHADOW_RX_FRAC, SHADOW_RY_CELL_FRAC, SHADOW_RY_MIN_PX, spriteMirror,
} from './arena-layout.js'
import {
  backdropCornersPx, cellToScreen, createBoardPlane, fitGrid, gridLineToScreen, localCellPx, screenToCell,
} from './board-plane.js'
// BUILD-034: filled-arrow renderer (single closed board-space shape + Muse material pack),
// projected through this renderer's own calibrated plane. The legacy stroke renderer below is
// kept intact as a debug/fallback style -- see ARROW_STYLES / setArrowStyle.
import { ARROW_INSET_PX, ARROW_SCALE, buildArrowPath, createHoverFade, materialIsAnimated, paintFilledArrow, shapeForCell } from './filled-arrow-render.js'
import { MATERIALS } from './filled-arrow-materials.js'
// VFX-003: light-hit feel (flash/sparks/squash/camera) -- pure scheduling math; painting below.
import { LIGHT_HIT, camOffset, hashStr, punch, sparkParts } from './hit-fx.js'
// BUILD-035: projectile flight trajectory (exit dir, then steer to the hit-anchor).
import { FLIGHT_MS, flightPoint, straightLen } from './projectile-flight.js'

// STORY-001: scripted-flee presentation beat, shared by every `flee` enemy. Three beats
// sequenced by gameplay, not wall-clock: taunt (starts once the hit impact lands, holds one
// full player turn) -> back slide (back pose drifting outward, holds the next full turn) ->
// leave (fast slide + fade when the following tap resolves). Missing art degrades through
// the usual resolveWolfImage pose->idle chain.
const FLEE_HIT_DELAY_MS = 260
const FLEE_EXIT_MS = 850
// Moon drift during its own turn, in screen px outward from the podium: ramps up over
// FLEE_BACK_SLIDE_MS, then holds — the turn itself lasts until the next tap.
const FLEE_BACK_DRIFT_PX = 20
const FLEE_BACK_SLIDE_MS = 1200

// FIX-023: an ARENA_CALIBRATIONS entry's {top,left,right} anchor group (either `anchors` or
// `effectAnchors`), converted into arena-layout.js's PODIUM_GROUND/EFFECT_GROUND side-number
// shape (0=N/top, 1=E/right, 3=W/left; side 2/S stays on the shared unused fallback -- no current
// encounter puts a target there). Returns undefined when there is no such group, so podiumSlot/
// effectGround then fall back to their own PODIUM_GROUND/EFFECT_GROUND default.
function anchorMapFor(anchorGroup) {
  if (!anchorGroup) return undefined
  const { top, left, right } = anchorGroup
  return { 0: top, 1: right, 3: left }
}

// CAL-001: actor foot anchor and VFX/telegraph anchor are independently calibrated (see
// arena-calibration.js's `anchors` vs `effectAnchors`) -- a calibration missing `effectAnchors`
// (shouldn't happen for a real ARENA_CALIBRATIONS entry now, but kept defensive for a hand-built
// caller) falls back to `anchors`, reproducing the pre-CAL-001 "one anchor, two uses" behaviour.
function groundOverridesFor(calibration) {
  if (!calibration) return { actor: undefined, effect: undefined }
  return {
    actor: anchorMapFor(calibration.anchors),
    effect: anchorMapFor(calibration.effectAnchors ?? calibration.anchors),
  }
}

// CAL-002: presentation-only actor scale per side (0=N/top, 1=E/right, 3=W/left; side 2/S stays
// at default 1.0). Missing keys default to 1.0 so uncalibrated or partial entries remain safe.
function actorScalesFor(calibration) {
  const s = calibration?.actorScale
  return {
    0: s?.top ?? 1.0,
    1: s?.right ?? 1.0,
    3: s?.left ?? 1.0,
    2: 1.0,
  }
}

// PLAYTEST-002: presentation-only sprite pivot/foot-offset per side (0=N/top, 1=E/right,
// 3=W/left; side 2/S has no calibration slot and stays at {dx:0,dy:0}). See arena-calibration.js's
// `spritePivot` doc comment -- this is ADDED to the asset's own per-pose ANCHOR.offsets in
// drawBossArt/drawWolfArt, not a replacement for it.
// PLAYTEST-002: on the flexible/default arena (no calibration active -- most of the canon
// Prologue's steps 2-5 carry no `presentation` block and never resolve one) a full-size actor on
// some sides clips the stage edge or, worse, pushes its own HUD plate (name/HP/countdown -- drawn
// ABOVE the character on every side but S) off the top of the screen entirely:
//  - a boss-mode target (BOSS_CHAR, 6.9 cells) can land on E (cp-e2/cp-e3/cp-e5) -- PODIUM_GROUND's
//    E/W anchors were only ever measured for an ordinary-enemy-sized (SIDE_CHAR, 6.0 cells) mob.
//  - an ordinary enemy on N (cp-e4's second, simultaneous mob) clips its own HUD plate off-stage --
//    PODIUM_GROUND[0]'s headroom was only verified for a boss-mode target (see arena-layout.js's
//    BOSS_CHAR comment), not for an enemies-mode scene with a mob standing there too.
// This default-arena-only multiplier (never applied when a calibration's own actorScale is
// present -- see the callers below) shrinks the affected side+kind combination enough to keep the
// character AND its HUD plate fully on stage at both 1920x1080 and 1366x768, verified via
// visualDebug.layout().
const DEFAULT_BOSS_SIDE_SCALE = { 0: 1.0, 1: 0.6, 2: 0.6, 3: 0.6 }
const DEFAULT_ENEMY_SIDE_SCALE = { 0: 0.6, 1: 1.0, 2: 1.0, 3: 1.0 }

const ZERO_PIVOT = { dx: 0, dy: 0 }
function spritePivotsFor(calibration) {
  const p = calibration?.spritePivot
  return {
    0: p?.top ?? ZERO_PIVOT,
    1: p?.right ?? ZERO_PIVOT,
    3: p?.left ?? ZERO_PIVOT,
    2: ZERO_PIVOT,
  }
}

const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t) => Math.max(0, Math.min(1, t))
// VFX-002: damage-number popup, ported from spike/VFX-001-combat-feel-lab's `FX.dmg`/`dmg()`
// light-hit preset (dmgDur:620, dmgSize:0.9, style 'light'). Pop-in with overshoot, drift up,
// fade out. Only the 'light' style is wired here -- see onTapResult/drawTarget's dmgText field
// for how a later lab effect (crit/heavy/magic styling, or an entirely different card like enemy
// recoil) reuses the same one-field-on-fx pattern instead of a new system.
const DMG_MS = 620
const DMG_STYLE_LIGHT = { fill: '#fff3d0', stroke: '#4a2c06' }
const easeOutCubic = (p) => 1 - (1 - p) ** 3
const easeOutBack = (p, s = 1.8) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2
const smoothstep = (p) => p * p * (3 - 2 * p)

export function createBoardRenderer(canvas, stageEl) {
  const ctx = canvas.getContext('2d')
  let geo = null
  let shownAngle = 0
  let rotAnim = null // { from, to, t0, dur }
  let shots = [] // { cells, dir, arenaDir, hit, t0 }
  const targetFx = new Map() // key -> { hitT, deathT, attackT, interruptT }
  // EXP-013/VS-001: per-arrow one-shot fx, keyed by board arrow id -- independent of targetFx
  // (which is keyed by boss/enemy id), since a pin/unpin/denied-tap event happens to an *arrow*,
  // not a target.
  const arrowFx = new Map() // arrow id -> { pinT, unpinT, deniedT }
  let hoverId = -1
  let flash = { blocked: -1, blocker: -1 }
  // BUILD-035: projectile flight style (debug/QA + user switcher -- painting only, no
  // gameplay effect). 'standard' = amber kite; 'heavy' = thick slow-looking bolt;
  // 'needle' = thin long-trail dart; 'crit' = standard + white core + arrival ring;
  // 'lob' = standard figure on a raised arc trajectory. Trajectory sync (FLIGHT_MS hit
  // timing) is identical for every style.
  const FLIGHT_STYLES = ['standard', 'heavy', 'needle', 'crit', 'lob']
  let flightStyle = 'needle'
  // BUILD-034: how arrows are painted. 'filled' = the new single-shape board-space renderer
  // (default); 'stroke' = the legacy polyline+kite renderer, kept as debug/fallback. The material
  // only applies to 'filled'. Neither choice touches gameplay: hitTest/ownerAt/canExit are
  // independent of both.
  let arrowStyle = 'filled'
  let arrowMaterial = 'warm-bevel'
  // FIX-032: hover is eased 0..1 per arrow instead of snapping. Presentation only -- setHover()
  // still receives whatever hitTest resolved, and nothing here feeds back into gameplay.
  const hoverFade = createHoverFade()

  function fxFor(key) {
    let fx = targetFx.get(key)
    if (!fx) {
      fx = { hitT: -1e9, deathT: -1e9, attackT: -1e9, interruptT: -1e9, fleeT: -1e9, fleeBackT: -1e9, fleeExitT: -1e9, dmgText: null, hitCount: 0 }
      targetFx.set(key, fx)
    }
    return fx
  }

  function arrowFxFor(id) {
    let fx = arrowFx.get(id)
    if (!fx) {
      fx = { pinT: -1e9, unpinT: -1e9, deniedT: -1e9 }
      arrowFx.set(id, fx)
    }
    return fx
  }

  function targetKey(t) {
    return t.isBoss ? 'boss' : t.id
  }

  // -------------------------------------------------------------------------------------------
  // Geometry.
  //
  // FIX-021: the board is no longer an axis-aligned square rigidly rotated as one canvas
  // transform. It's now a fixed, non-rotating projection plane (board-plane.js's homography,
  // calibrated to the stone dais painted in the background art) that the logical cols x rows
  // grid is fit into and projected through. Rotate only spins each logical point's normalized
  // (u,v) around the plane's own center before projecting -- see board-plane.js's rotateUV --
  // so the plane/backdrop footprint never changes shape or size, only the puzzle content
  // (dots/arrows) visually turns within it. Click hit-testing goes through the exact inverse
  // (screenToCell), so it can never drift from what's drawn.
  //
  // Characters still anchor to fixed stage-fraction podiums (PODIUM_GROUND/EFFECT_GROUND in
  // arena-layout.js), independent of the board's own size/position, per FIX-021's "actor slots
  // relative to the arena, not boardRect" requirement (already true since BUILD-020).

  // VIS-007: per-frame debug layout (canvas coords) for automated checks. Reset on every
  // frame; drawTarget appends one entry per live target (key/side/char/face/plate/badge/board).
  let layoutInfo = []
  // BUILD-035: last rendered body-center anchor per target (canvas coords), for projectile
  // flight. Rebuilt every frame alongside layoutInfo, so a shot always steers to where its
  // target visibly is -- never to a stale position. Presentation only.
  let targetAnchors = new Map()
  // VFX-003: current camera impulse offset (canvas px), recomputed every frame from the live
  // per-target shakes. drawTarget subtracts it back for HUD/readouts (they must not shake).
  let frameCam = { x: 0, y: 0 }
  // BUILD-035: pending impact visuals per target: { hp, dead, until }.
  // The engine applies damage synchronously at tap, but the HP bar / 'убит' line must not
  // drop until the projectile actually arrives -- frame() shows the pre-tap values until then.
  let pendingHp = new Map()
  let boardBBox = { x: 0, y: 0, w: 0, h: 0 }

  // FIX-023: `calibration` is an optional ARENA_CALIBRATIONS entry (arena-calibration.js) for a
  // TRUE baked-grid arena -- its boardPlaneFrac replaces the flexible-arena PLANE_CORNERS_FRAC,
  // and margin 0 makes fitGrid fill that quad corner-to-corner so cell-to-cell alignment with the
  // painted grid holds by construction. Omitted (every existing caller), this reproduces exactly
  // the flexible-arena/rectangular-regression geometry resize() always computed.
  function resize(level, calibration = null) {
    const { width: w, height: h } = level
    const stageRect = stageEl.getBoundingClientRect()
    const stageW = Math.max(1, stageRect.width)
    const stageH = Math.max(1, stageRect.height)
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
    canvas.width = Math.round(stageW * dpr)
    canvas.height = Math.round(stageH * dpr)
    canvas.style.width = `${stageW}px`
    canvas.style.height = `${stageH}px`
    const cornersFrac = calibration
      ? { tl: calibration.boardPlaneFrac.tl, tr: calibration.boardPlaneFrac.tr, br: calibration.boardPlaneFrac.br, bl: calibration.boardPlaneFrac.bl }
      : undefined
    const plane = createBoardPlane(stageW, stageH, cornersFrac)
    const fit = fitGrid(w, h, calibration ? { marginU: 0, marginV: 0 } : undefined)
    // Approximate on-screen px per logical cell, for stroke widths/fonts that assume a roughly
    // uniform local scale (the true scale varies across a projected trapezoid; this is a single
    // representative value, sampled at the plane's own center -- exact per-pixel fidelity isn't
    // needed for line thickness/font size, only "not microscopic, not oversized"). Perspective-
    // sensitive drawing (arrow stroke/arrowhead/FX) uses localCellPx at the actual drawn position
    // instead -- see drawArrow/drawShot/drawPinFx.
    const backdrop = backdropCornersPx(plane, fit)
    const topW = Math.hypot(backdrop.tr.x - backdrop.tl.x, backdrop.tr.y - backdrop.tl.y)
    const botW = Math.hypot(backdrop.br.x - backdrop.bl.x, backdrop.br.y - backdrop.bl.y)
    const leftH = Math.hypot(backdrop.bl.x - backdrop.tl.x, backdrop.bl.y - backdrop.tl.y)
    const rightH = Math.hypot(backdrop.br.x - backdrop.tr.x, backdrop.br.y - backdrop.tr.y)
    const span = Math.max(w, h)
    const cell = Math.max(6, ((topW + botW) / 2 / span + (leftH + rightH) / 2 / span) / 2)
    const { actor: groundOverride, effect: effectGroundOverride } = groundOverridesFor(calibration)
    // CAL-002: calibrated actor size is decoupled from logical grid width/height (span).
    // Uses a stable stage-relative base cell magnitude (responsive across 1080p, 768p, 540p),
    // so 5x5, 6x6, 8x8, 10x10 show the exact same actor pixel footprint unless actorScale is tuned.
    const actorBaseCell = calibration
      ? stageH * (calibration.actorBaseCellFrac ?? ACTOR_BASE_CELL_FRAC)
      : cell
    const actorScaleOverride = actorScalesFor(calibration)
    const spritePivotOverride = spritePivotsFor(calibration)
    geo = {
      w, h, plane, fit, cell, stageW, stageH, calibration,
      groundOverride, effectGroundOverride,
      actorBaseCell, actorScaleOverride, spritePivotOverride,
    }
    return geo
  }

  function cellCenter(c, angleDeg) {
    const x = c % geo.w
    const col = x
    const row = (c - x) / geo.w
    const p = cellToScreen(geo.plane, geo.fit, col, row, angleDeg)
    return [p.x, p.y]
  }

  /** FIX-023: on-screen px-per-cell at a given flat cell index, for perspective-sensitive stroke
   * width/arrowhead/marker sizing -- see board-plane.js's localCellPx. A single scalar (average
   * of the cell's own u/v edge lengths) rather than geo.cell's whole-board average, so a near/
   * bottom cell draws visibly chunkier than a far/top one when the arena perspective calls for it. */
  function localScaleAt(c, angleDeg) {
    const x = c % geo.w
    const col = x
    const row = (c - x) / geo.w
    const local = localCellPx(geo.plane, geo.fit, col, row, angleDeg)
    return Math.max(6, (local.u + local.v) / 2)
  }

  function hitTest(clientX, clientY, s, level) {
    if (!geo || rotAnim) return -1
    const r = canvas.getBoundingClientRect()
    const { col, row } = screenToCell(geo.plane, geo.fit, clientX - r.left, clientY - r.top, s.rotation * 90)
    if (col < 0 || row < 0 || col >= level.width || row >= level.height) return -1
    return s.board.ownerAt(row * level.width + col)
  }

  function setHover(id) {
    hoverId = id
  }
  function setFlash(f) {
    flash = f
  }

  // -------------------------------------------------------------------------------------------
  // Event hooks: the caller (app.js) tells us *what happened*; we own *how it looks*. Called once
  // per tap()/rotate() result, never on every frame.

  function onTapResult(level, id, r, targetsBefore) {
    const now = performance.now()
    const local = level.arrows[id].dir
    // BUILD-035: resolve the hit-anchor at event time (last rendered frame -- fresh to one
    // frame). A miss (or no anchor yet) flies straight and fades, exactly like before.
    let target = null
    if (r.hit) {
      const hitTarget = targetsBefore.find((t) => t.side === r.arenaDir)
      if (hitTarget) {
        target = targetAnchors.get(targetKey(hitTarget)) ?? null
        // BUILD-035: HP/dead visuals wait for the arrival (see frame()'s pendingHp patch).
        pendingHp.set(targetKey(hitTarget), { hp: hitTarget.hp, dead: hitTarget.dead, until: now + FLIGHT_MS })
        const fx = fxFor(targetKey(hitTarget))
        fx.hitT = now + FLIGHT_MS // impact flash syncs with the projectile's arrival, not the tap
        // VFX-002: damage-number popup, arrival-synced like the impact flash above (same
        // `now + FLIGHT_MS`) -- r.hitDamage is the real HP delta the engine applied to this
        // target this tap, never a presentation-layer guess. A later lab effect (recoil, sparks,
        // ...) adds its own field here the same way, on the same fx object.
        if (r.hitDamage > 0) fx.dmgText = { value: r.hitDamage, at: now + FLIGHT_MS }
        // VFX-003: light-hit feel (flash/sparks/squash/camera) -- same arrival-synced pattern:
        // one more field each on the same fx object, all stamped `now + FLIGHT_MS`. The next
        // lab effect attaches identically. Spark parts are precomputed once (deterministic per
        // hit) so every frame replays them byte-identical; debris sprays back along incoming.
        fx.hitCount = (fx.hitCount ?? 0) + 1
        const seed = (hashStr(targetKey(hitTarget)) + fx.hitCount * 7919) >>> 0
        const backAng = Math.atan2(-DY[hitTarget.side], -DX[hitTarget.side])
        fx.sparks = { at: now + FLIGHT_MS, seed, parts: sparkParts(seed, LIGHT_HIT.sparkCount, backAng) }
        fx.squashT = { at: now + FLIGHT_MS }
        fx.shakeC = { at: now + FLIGHT_MS }
        if (r.shieldConsumed?.some((s) => s.id === hitTarget.id)) fx.shieldT = now + FLIGHT_MS
        // EXP-011/VS-001: only a genuine cast-interrupt gets the "CAST INTERRUPTED" burst -- the
        // legacy EXP-010 interruptOnHit reset (r.interrupted without r.castInterrupted) is unused
        // by any current content and isn't a cast, so it gets no burst text.
        if (r.castInterrupted) fx.interruptT = now + FLIGHT_MS
      }
    }
    // BUILD-035: 'lob' raises the steered leg into an arc (same duration/endpoints/sync);
    // every other style flies the same trajectory and differs only in figure painting.
    // The style is frozen per shot so a mid-flight switch never pops the figure.
    let arc = 0
    if (flightStyle === 'lob' && target) {
      const [ehx, ehy] = cellCenter(level.arrows[id].cells[level.arrows[id].cells.length - 1], shownAngle)
      arc = Math.min(160, Math.max(40, Math.hypot(target.x - ehx, target.y - ehy) * 0.25))
    }
    shots.push({ cells: level.arrows[id].cells, dir: local, arenaDir: r.arenaDir, hit: r.hit, target, arc, style: flightStyle, t0: now })
    if (r.enemyAttacks && r.enemyAttacks.length) {
      for (const a of r.enemyAttacks) fxFor(a.id).attackT = now
    } else if (r.enemyAttacked) {
      // Boss mode has one active target; attribute the attack to it directly.
      fxFor('boss').attackT = now
    }
    // EXP-013/VS-001: Stone Throw pin/unpin, enemies mode only. A pin created and an arrow's pin
    // expiring are independent per-arrow one-shot events, both possible on the same world turn.
    if (r.pinnedThisTurn) for (const p of r.pinnedThisTurn) arrowFxFor(p.id).pinT = now
    if (r.pinExpired) for (const arrowId of r.pinExpired) arrowFxFor(arrowId).unpinT = now
  }

  /** EXP-013/VS-001: the player tapped a currently-pinned arrow -- a no-op per the engine (no HP
   * cost, no turn spent), but it needs its own feedback so it doesn't read as a silent failure or,
   * worse, get confused with a damaging blocked tap. */
  function onPinDenied(id) {
    arrowFxFor(id).deniedT = performance.now()
  }

  function onRotateStart(fromDeg, toDeg) {
    rotAnim = { from: fromDeg, to: toDeg, t0: performance.now(), dur: 260 }
  }

  function onRotateEnemyAttack() {
    // Rotate can also trigger an attack timer tick; the API does not say which enemy, so this is a
    // board-wide cue rather than a per-target one.
    fxFor('__board__').attackT = performance.now()
  }

  function markDeaths(targetsBefore, targetsAfter) {
    const now = performance.now()
    for (const before of targetsBefore) {
      const after = targetsAfter.find((t) => targetKey(t) === targetKey(before))
      if (!before.dead && (after ? after.dead : true)) fxFor(targetKey(before)).deathT = now
    }
  }

  // STORY-001: scripted-flee counterpart of markDeaths. The engine flips `fled` synchronously
  // on the tap; this stamps the presentation beat's t0 so drawTarget can play taunt-then-exit.
  // Generic per enemy id — any future `flee` content reuses it with no new code.
  function markFled(targetsBefore, targetsAfter) {
    const now = performance.now()
    for (const before of targetsBefore) {
      const after = targetsAfter.find((t) => targetKey(t) === targetKey(before))
      if (!before.fled && after && after.fled) fxFor(targetKey(before)).fleeT = now
    }
  }

  // STORY-001: advances fled enemies one beat per tap: taunt turn over -> back slide,
  // back-slide turn over -> leave. Called on every successful tap BEFORE markFled stamps new
  // flees, so a fresh flee always plays the full taunt -> back -> leave sequence. Returns
  // { back, away } id lists so app.js can announce each beat. Generic per enemy id.
  function markFledAdvance(targetsAfter) {
    const now = performance.now()
    const advanced = { back: [], away: [] }
    for (const t of targetsAfter) {
      if (t.isBoss || !t.fled) continue
      const fx = fxFor(targetKey(t))
      if (fx.fleeT < 0) continue
      if (fx.fleeBackT < 0) {
        fx.fleeBackT = now
        advanced.back.push(t.id)
      } else if (fx.fleeExitT < 0) {
        fx.fleeExitT = now
        advanced.away.push(t.id)
      }
    }
    return advanced
  }

  function resetFx() {
    shots = []
    targetFx.clear()
    arrowFx.clear()
    rotAnim = null
    flash = { blocked: -1, blocker: -1 }
  }

  // -------------------------------------------------------------------------------------------
  // Frame

  function collectTargets(s, def) {
    if (def.enemies) {
      // ASSET-002: `species` isn't part of the engine's own EnemyDef/`s.enemies` shape (the
      // authoring tool's own catalog concept only) -- read it off the matching raw `def.enemies`
      // entry instead, so drawTarget can pick the right ordinary-enemy pose pack. Missing/unknown
      // species resolves to undefined here and falls back to Dire Wolf's pack at the call site.
      return s.enemies.map((e) => ({
        id: e.id, label: e.label, side: e.side, hp: e.hp, hpMax: e.hpMax, dead: e.dead,
        fled: e.fled,
        countdown: e.countdown, attackKind: e.attackKind, abilityCountdown: e.abilityCountdown,
        shielded: e.shielded,
        abilityKind: def.enemies.find((raw) => raw.id === e.id)?.ability?.kind ?? (def.enemies.find((raw) => raw.id === e.id)?.ability ? 'stone_throw' : undefined),
        species: def.enemies.find((raw) => raw.id === e.id)?.species,
        isBoss: false,
      }))
    }
    // FIX: encounter.ts's `bossSide` returns -1 the instant the winning hit lands (phaseIndex
    // advances past the last phase) -- the previous code took that as "no target" and returned []
    // entirely, so the boss vanished (art AND its HP plate) the very next frame, before the defeat
    // pose/fade this file draws ever had a chance to be seen. `phaseIndex` only ever runs past the
    // phase array when `s.won` (see encounter.ts's phaseAt), so falling back to the last real
    // phase's side in that case is exact, not a guess -- it's the phase the winning hit was on.
    const rawSide = s.bossSide
    const side = rawSide >= 0 ? rawSide : s.won ? def.boss.phases[def.boss.phases.length - 1].side : -1
    if (side < 0) return []
    const phase = def.boss.phases[Math.min(s.phaseIndex, def.boss.phases.length - 1)]
    return [{
      id: def.boss.id, label: phase.label ?? def.boss.id, side, hp: s.hp, hpMax: s.totalHp, dead: s.won,
      countdown: s.countdownTurns, attackKind: s.attackKind, isBoss: true,
    }]
  }

  function frame(now, view) {
    const { s, def, level, assets, hint, debug } = view
    if (!geo) resize(level)
    let animating = false

    if (rotAnim) {
      const t = clamp01((now - rotAnim.t0) / rotAnim.dur)
      shownAngle = rotAnim.from + (rotAnim.to - rotAnim.from) * EASE(t)
      if (t >= 1) {
        shownAngle = s.rotation * 90
        rotAnim = null
      } else animating = true
    } else {
      shownAngle = s.rotation * 90
    }
      shots = shots.filter((sh) => now - sh.t0 < FLIGHT_MS)
    if (shots.length) animating = true
    for (const fx of targetFx.values()) {
      if (now - fx.hitT < 260 || now - fx.attackT < 320 || now - fx.interruptT < 700 || now - fx.deathT < 550) animating = true
      // STORY-001: an exit slide is also a function of `now` — keep the loop alive until it
      // plays out. (The taunt hold needs no extra rule: a fled enemy counts as alive above.)
      if (now - fx.fleeExitT < FLEE_EXIT_MS) animating = true
      // VFX-002: damage-number popup is also a function of `now` until it fades out.
      if (fx.dmgText && now - fx.dmgText.at < DMG_MS) animating = true
    }
    for (const fx of arrowFx.values()) {
      if (now - fx.pinT < 500 || now - fx.unpinT < 550 || now - fx.deniedT < 320) animating = true
    }
    // BUILD-034: an animated material (sheen/sparks/pulse) needs a live rAF while any arrow is
    // still on the board.
    if (arrowStyle === 'filled' && materialIsAnimated(arrowMaterial) &&
        level.arrows.some((a) => s.board.isAlive(a.id))) animating = true
    // FIX-032: keep the loop alive for the length of a hover fade-in/out.
    hoverFade.set(hoverId)
    if (hoverFade.tick(now)) animating = true

    // VFX-003: camera impulse -- one world offset summed over every live per-target
    // shake (lab math: decaying oscillation, pure function of absolute time). Keeps the loop
    // alive for its own window, like every other time-based fx above.
    const liveShakes = []
    for (const fx of targetFx.values()) {
      if (fx.shakeC) liveShakes.push({ at: fx.shakeC.at, dur: LIGHT_HIT.camDur, amp: LIGHT_HIT.camAmp, freq: LIGHT_HIT.camFreq })
    }
    frameCam = camOffset(now, liveShakes)
    if (liveShakes.some((s) => now - s.at >= 0 && now - s.at < s.dur)) animating = true
    const dark = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)').matches : true
    const col = palette(dark)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const targets = collectTargets(s, def)
    // Idle bob + cast-pulse are continuous functions of `now`, not one-shot fx: keep the loop
    // alive while any target is alive so they never visibly freeze between combat events.
    if (targets.some((t) => !t.dead)) animating = true
    // VIS-005: a timed boss hold (taunt bounce, stunned recoil) is also a function of `now` --
    // keep the loop alive until it expires so the beat always plays to the baseline.
    const bossHold = view.boss?.visual
    if (bossHold && !bossHold.manual && now < bossHold.holdUntil) animating = true
    // VIS-006: same for per-actor wolf holds (attack/hit beats) -- each actor ticks independently.
    const wolfVisuals = view.wolf?.visuals
    if (wolfVisuals) {
      for (const w of wolfVisuals.values()) {
        if (!w.manual && now < w.holdUntil) { animating = true; break }
      }
    }
    // VS-001: board surface first, target panels on top -- a target panel's label plate (name/HP/
    // CAST-ATTACK-THROW text) can extend far enough toward the board on a short/wide N or S panel
    // to reach the board's own footprint (e.g. cp-e4's N-side "slow" enemy once its 3-line plate
    // grew past 2 lines), and an opaque board surface drawn afterward silently painted over that
    // text -- a real bug the old 2-line layout happened not to trip.
    // VIS-007: characters and HUD live on arena slots away from the board, so the board can
    // never paint over them; the per-frame layout record below lets automated checks prove it.
    const backdrop = backdropCornersPx(geo.plane, geo.fit)
    boardBBox = {
      x: Math.min(backdrop.tl.x, backdrop.bl.x),
      y: Math.min(backdrop.tl.y, backdrop.tr.y),
      w: Math.max(backdrop.tr.x, backdrop.br.x) - Math.min(backdrop.tl.x, backdrop.bl.x),
      h: Math.max(backdrop.bl.y, backdrop.br.y) - Math.min(backdrop.tl.y, backdrop.tr.y),
    }
    drawBoardSurface(col, backdrop)
    drawSideReadouts(col, s, def)
    layoutInfo = []
    targetAnchors = new Map()
    // VFX-003: everything inside this transform is the "world" -- the arena (board, targets,
    // projectiles) moves with the camera impulse. HUD plates/readouts subtract it back inside
    // drawTarget; layoutInfo records unshaken data truth. hitTest mismatch (<=2px, 200ms) is
    // negligible and never persists (offset decays to exactly 0).
    ctx.save()
    ctx.translate(frameCam.x, frameCam.y)
    for (const t of targets) {
      // BUILD-035: pre-impact HP presentation -- show pre-tap hp/dead until the projectile
      // arrives (pendingHp), then fall through to live state. Expired entries are dropped.
      const pend = pendingHp.get(targetKey(t))
      if (pend) {
        if (now < pend.until) {
          t.hp = pend.hp
          t.dead = pend.dead
        } else {
          pendingHp.delete(targetKey(t))
        }
      }
      drawTarget(col, t, now)
    }
    for (const a of level.arrows) drawArrow(col, s, def, a, hint)
    for (const sh of shots) drawShot(col, sh, now)
    ctx.restore()

    return animating

    function drawTarget(col, t, now) {
      const g = geo
      const key = targetKey(t)
      const fx = fxFor(key)
      const cell = g.cell
      // VIS-007: character footprint from the arena layout (cells -> px). No panel box, no
      // clip: the sprite stands directly on the arena, bottom-center grounded at the slot.
      const size = charSize(t.isBoss)
      // CAL-002: actor scale is presentation-only and independent of grid dimensions.
      // PLAYTEST-002: on the flexible/default arena (g.calibration null) a boss or ordinary enemy
      // additionally gets DEFAULT_BOSS_SIDE_SCALE/DEFAULT_ENEMY_SIDE_SCALE's per-side reduction --
      // see those constants' comment.
      const defaultArenaSideScale = g.calibration ? 1.0 : (t.isBoss ? DEFAULT_BOSS_SIDE_SCALE : DEFAULT_ENEMY_SIDE_SCALE)[t.side] ?? 1.0
      const scale = (g.actorScaleOverride?.[t.side] ?? 1.0) * defaultArenaSideScale
      const charCell = (g.actorBaseCell ?? cell) * scale
      const charW = size.w * charCell
      const charH = size.h * charCell
      const slot = podiumSlot(t.side, t.isBoss, g.stageW, g.stageH, charCell, g.groundOverride)
      // CAL-005: species default presentation -- the middle layer between the shared
      // ANCHOR.offsets and this scene's own spritePivot override (see
      // species-presentation.js's composition-order doc comment). A species with nothing saved
      // in the Pose Editor contributes {dx:0,dy:0}/1/{0,0}/{0,0}, so every line below is a
      // no-op until the user actually authors a default for it. HUD/shadow offsets are
      // footprint fractions converted to px against this target's own character footprint.
      const speciesId = t.isBoss ? bossSpeciesFor(t.id) : (t.species ?? 'dire-wolf')
      const speciesPivot = speciesPivotDelta(speciesId)
      const speciesHudFrac = speciesHudOffset(speciesId)
      const hudOffPx = { x: speciesHudFrac.x * charW, y: speciesHudFrac.y * charH }
      const speciesShadowFrac = speciesShadowOffset(speciesId)
      const shadowOffPx = { x: speciesShadowFrac.x * charW, y: speciesShadowFrac.y * charH }
      const artScale = speciesScale(speciesId)
      // CAL-005: species HUD size scales the plate's own font/bar metrics (measured and drawn
      // at the scaled size); the offset above stays a pure position shift. Default 1 = no-op.
      const hudScale = speciesHudScale(speciesId)
      const idle = Math.sin(now / 900 + t.side * 1.7) * 1.6
      const shake = now - fx.hitT >= 0 && now - fx.hitT < 200 ? Math.sin((now - fx.hitT) / 16) * 3 : 0
      const lunge = now - fx.attackT >= 0 && now - fx.attackT < 320 ? Math.sin(((now - fx.attackT) / 320) * Math.PI) * 0.28 * charCell : 0
      const deathT = now - fx.deathT
      const dying = t.dead && deathT >= 0 && deathT < 550
      // FIX: a boss is the level's final target, not a mob that should vanish -- the fade-to-
      // fully-transparent "terminal hold" below (correct for an ordinary enemy: its slot empties)
      // left the boss's podium empty for the ~150ms between the fade finishing and the win overlay
      // appearing, and its defeat pose (with the settle/squash transform below) was never actually
      // seen fully visible. A boss never fades -- it stays fully opaque, defeat pose + settle only.
      const deathP = t.isBoss ? 0 : dying ? clamp01(deathT / 550) : t.dead ? 1 : 0
      if (t.dead && deathP >= 1 && !t.isBoss) return // fully dead regular enemy: slot stays empty

      // STORY-001: scripted flee — taunt once the hit lands (one turn), back slide (next
      // turn), leave on the following tap, then the slot stays empty. The engine deliberately
      // keeps the fled enemy "alive" (never dead), so this branch alone owns the visual
      // disappearance. `fleeT` is stamped by markFled(), `fleeBackT`/`fleeExitT` by
      // markFledAdvance(). Stale stamps (undo back past the flee) are cleared here because
      // the engine reads unfled again.
      const fleeing = !t.isBoss && !!t.fled
      if (!fleeing && (fx.fleeT >= 0 || fx.fleeBackT >= 0 || fx.fleeExitT >= 0)) {
        fx.fleeT = -1e9
        fx.fleeBackT = -1e9
        fx.fleeExitT = -1e9
      }
      // Flee pose + motion are computed up-front (they feed translate/alpha below);
      // the art itself resolves later in the character-art block via `fleePose`.
      // fleeStage: null (hit traveling / normal draw) | 'taunt' | 'back' | 'away'.
      let fleePose = null
      let fleeSince = 0
      let fleeStage = null
      let fleeAlpha = 1
      let fleeOx = 0
      let fleeOy = 0
      if (fleeing) {
        if (fx.fleeT < 0) fx.fleeT = now // safety: fled without a stamp still plays the beat
        const effT = now - (fx.fleeT + FLEE_HIT_DELAY_MS)
        if (effT >= 0) {
          if (fx.fleeExitT >= 0) {
            const p = clamp01((now - fx.fleeExitT) / FLEE_EXIT_MS)
            if (p >= 1) return // fully fled: slot stays empty
            fleePose = 'back'
            fleeSince = now - fx.fleeExitT
            fleeStage = 'away'
            fleeAlpha = 1 - p
            fleeOx = DX[t.side] * p * charW * 1.2
            fleeOy = DY[t.side] * p * charW * 1.2
          } else if (fx.fleeBackT >= 0) {
            // Own turn of the moon: slow outward drift (capped), no fade yet.
            const drift = Math.min((now - fx.fleeBackT) / FLEE_BACK_SLIDE_MS, 1) * FLEE_BACK_DRIFT_PX
            fleePose = 'back'
            fleeSince = now - fx.fleeBackT
            fleeStage = 'back'
            fleeOx = DX[t.side] * drift
            fleeOy = DY[t.side] * drift
          } else {
            fleePose = 'taunt'
            fleeSince = effT
            fleeStage = 'taunt'
          }
        }
        // else: the hit is still traveling — normal draw (the hit flash covers the impact)
      }

      const towardBoard = { x: -DX[t.side], y: -DY[t.side] }
      const ox = towardBoard.x * lunge + (t.side === 0 || t.side === 2 ? shake : 0)
      const oy = towardBoard.y * lunge + (t.side === 1 || t.side === 3 ? shake : 0) + idle

      // FIX-021: the VFX ground anchor is independent of the character's own foot-contact point
      // (and of its idle bob/shake/lunge offsets) -- see arena-layout.js's EFFECT_GROUND. Computed
      // in the same absolute stage space as `slot`, then converted below to the coordinates local
      // to the character's translated origin (slot.x+ox, slot.y+oy).
      const eff = effectGround(t.side, g.stageW, g.stageH, g.effectGroundOverride)
      const effLocalX = eff.x - (slot.x + ox)
      const effLocalY = eff.y - (slot.y + oy)

      ctx.save()
      // STORY-001: the flee exit fades + slides outward on top of the regular transform.
      ctx.globalAlpha = (1 - deathP) * fleeAlpha
      ctx.translate(slot.x + ox + fleeOx, slot.y + oy + fleeOy)

      // Telegraph: a pulsing ground ellipse on the podium surface (urgency color), not a box
      // ring -- the character itself is never framed. CAST and ATTACK stay visually distinct.
      // FIX-021: anchored at effLocalX/Y (the podium's flat top), not the character's own feet,
      // so a wide cast-glow never spills past the podium's front lip into the wall/stairs below.
      // STORY-001: a fled enemy already left — no telegraph over an empty beat.
      if (Number.isFinite(t.countdown) && !t.dead && !t.fled) {
        const isCast = t.attackKind === 'cast'
        const urgency = t.countdown <= 1 ? 1 : t.countdown === 2 ? 0.55 : 0.3
        const cyc = (now / (520 - urgency * 260)) % 1
        ctx.save()
        if (isCast && assets.castGlow) {
          const s2 = charW * 1.1 * (1 + cyc * 0.3)
          ctx.globalAlpha = (1 - cyc) * 0.85 * urgency
          ctx.drawImage(assets.castGlow, effLocalX - s2 / 2, effLocalY - s2 / 2, s2, s2)
        } else {
          ctx.globalAlpha = (1 - cyc) * 0.6 * urgency + 0.08 * urgency
          ctx.strokeStyle = isCast ? col.cast : urgency >= 1 ? col.danger : col.aim
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.ellipse(effLocalX, effLocalY, charW * (0.55 + cyc * 0.25), Math.max(5, charCell * 0.14) * (1 + cyc * 0.4), 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }

      // COMBAT-001 playtest: active one-shot shield gets a simple readable aura. This is
      // intentionally presentation-only and cheap; final shield art/VFX comes later if the mechanic survives playtest.
      if (t.shielded && !t.dead && !t.fled) {
        const pulse = 0.82 + Math.sin(now / 120) * 0.08
        ctx.save()
        ctx.globalAlpha = 0.72
        ctx.strokeStyle = col.cast
        ctx.lineWidth = Math.max(3, charCell * 0.08)
        ctx.beginPath()
        ctx.ellipse(0, 0, charW * 0.56 * pulse, charH * 0.52 * pulse, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // Ground shadow: soft ellipse at the feet, keeps the actor planted on the arena. Stays on
      // the character's own foot point (not the effect anchor) -- this is "where I stand", not a
      // telegraph. CAL-005: the species shadow offset moves it independently of the art pivot --
      // pivoting/scaling the sprite never moves the shadow, only this offset does.
      ctx.save()
      ctx.globalAlpha = (1 - deathP * 0.5) * 1
      ctx.fillStyle = col.groundShadow
      ctx.beginPath()
      ctx.ellipse(shadowOffPx.x, charH / 2 + shadowOffPx.y, charW * SHADOW_RX_FRAC, Math.max(SHADOW_RY_MIN_PX, charCell * SHADOW_RY_CELL_FRAC), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Character art: pose image contain-fitted into the footprint, bottom-center
      // (ground) anchored -- a pose swap never moves the anchor or the visual size.
      // No panel, no clip: art can never be boxed in, and HUD (below) never sizes it.
      const bossPack = t.isBoss ? view.boss?.pack ?? null : null
      const bossPose = t.isBoss ? view.boss?.visual?.pose ?? 'idle' : null
      const bossImg = bossPack ? resolveBossImage(bossPack, bossPose) : null
      const wolfVisual = !t.isBoss ? view.wolf?.visuals?.get(key) ?? null : null
      const wolfPose = !t.isBoss ? wolfVisual?.pose ?? 'idle' : null
      // ASSET-002: per-enemy species pack (view.wolf.packsBySpecies, keyed by asset-catalog.js's
      // CREATURE_CATALOG species ids) takes priority over the single shared `view.wolf.pack` --
      // falls back to it (Dire Wolf, today's only pre-ASSET-002 ordinary-enemy pack) for any
      // enemy with no/unknown species, so every existing encounter renders exactly as before.
      const wolfPack = !t.isBoss ? view.wolf?.packsBySpecies?.[t.species] ?? view.wolf?.pack ?? null : null
      const wolfImg = wolfPack ? resolveWolfImage(wolfPack, wolfPose) : null
      // STORY-001: flee art overrides the actor pose — taunt beat first (bounce below), then
      // the back-turned exit sliding outward + fading. resolveWolfImage degrades pose->idle,
      // so a species without taunt/back art still plays a readable pause + fade-out.
      const fleeImg = fleePose && wolfPack ? resolveWolfImage(wolfPack, fleePose) ?? (fleePose === 'back' ? resolveWolfImage(wolfPack, 'taunt') : null) : null
      const img = bossImg ?? fleeImg ?? wolfImg ?? resolveTargetImage(assets, t)
      const bossSince = t.isBoss && view.boss?.visual ? now - view.boss.visual.startedAt : -1e9
      const wolfSince = fleePose ? fleeSince : wolfVisual ? now - wolfVisual.startedAt : -1e9
      const wolfPoseShown = fleePose ?? wolfPose
      const pivot = g.spritePivotOverride?.[t.side] ?? ZERO_PIVOT
      // TOOL-002/CAL-005: scene pivot + species default (speciesId/speciesPivot/artScale are
      // resolved once above, next to the HUD/shadow species offsets from the same entry).
      const scenePivot = { dx: pivot.dx + speciesPivot.dx, dy: pivot.dy + speciesPivot.dy }
      // VFX-003: squash/recoil -- feet planted (scale about the ground point), shove along the
      // incoming direction. punch() envelope: fast out, settle back. Wraps the art AND the hit
      // flash so they deform as one body.
      const sqK = fx.squashT ? punch((now - fx.squashT.at) / LIGHT_HIT.sqDur) : 0
      const sqDx = DX[t.side] * LIGHT_HIT.sqRecoil * sqK
      const sqDy = DY[t.side] * LIGHT_HIT.sqRecoil * sqK * 0.35
      ctx.save()
      ctx.translate(sqDx, charH / 2 + sqDy)
      ctx.scale(1 + LIGHT_HIT.sqSquash * sqK * 0.85, 1 - LIGHT_HIT.sqSquash * sqK)
      ctx.translate(0, -charH / 2)
      if (img) {
        if (bossImg) drawBossArt(img, bossPose, bossSince, t, charW, charH, scenePivot, artScale)
        else if (wolfImg || fleeImg) drawWolfArt(img, wolfPoseShown, wolfSince, t, charW, charH, scenePivot, artScale)
        if (t.dead && !t.isBoss) {
          // Same alpha-masked tint as the hit-flash below -- a dead sprite darkens, it
          // doesn't grow a translucent box around its transparent edges. FIX: a boss is kept
          // fully opaque/undarkened now (see the deathP note above) -- this 55%-black tint,
          // applied forever (not just during the fade), made its defeat pose nearly
          // indistinguishable from the arena's own dark background. Its defeat pose art already
          // reads as "defeated" without an extra tint.
          ctx.save()
          ctx.globalCompositeOperation = 'source-atop'
          ctx.fillStyle = col.deadOverlay
          ctx.fillRect(-charW / 2, -charH / 2, charW, charH)
          ctx.restore()
        }
      } else {
        // Missing art fallback: a soft radial glow, deliberately NOT a box.
        const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, Math.max(charW, charH) / 2)
        if (t.dead) {
          grad.addColorStop(0, col.deadA)
          grad.addColorStop(1, col.deadB)
        } else {
          grad.addColorStop(0, t.isBoss ? col.bossA : col.enemyA)
          grad.addColorStop(1, t.isBoss ? col.bossB : col.enemyB)
        }
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(0, 0, charW / 2, charH / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      // Hit-flash, VFX-003 lab style: expanding additive burst + hot core + lens streak
      // at the body center (flashScale-driven, not a flat fill). The pose-tied tint below is a
      // different sync point (visual state, not arrival) and stays subtle on its own.
      const hitP = (now - fx.hitT) / LIGHT_HIT.flashDur
      if (hitP >= 0 && hitP < 1) {
        const grow = easeOutCubic(hitP)
        const fade = (1 - hitP) ** 1.6
        const R = LIGHT_HIT.flashScale * Math.max(charW, charH) * 0.5 * (0.45 + 2.6 * grow)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R)
        glowGrad.addColorStop(0, 'rgba(255,170,60,0.9)')
        glowGrad.addColorStop(1, 'rgba(255,170,60,0)')
        ctx.globalAlpha = 0.75 * fade
        ctx.fillStyle = glowGrad
        ctx.beginPath()
        ctx.arc(0, 0, R, 0, Math.PI * 2)
        ctx.fill()
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.45)
        coreGrad.addColorStop(0, '#fff6d8')
        coreGrad.addColorStop(1, 'rgba(255,246,216,0)')
        ctx.globalAlpha = 0.9 * (1 - hitP) ** 2.2
        ctx.fillStyle = coreGrad
        ctx.beginPath()
        ctx.arc(0, 0, R * 0.45, 0, Math.PI * 2)
        ctx.fill()
        const sw = R * 3.4
        const sg = ctx.createLinearGradient(-sw, 0, sw, 0)
        sg.addColorStop(0, 'rgba(255,255,255,0)')
        sg.addColorStop(0.5, '#fff6d8')
        sg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.globalAlpha = 0.5 * fade * (1 - hitP)
        ctx.fillStyle = sg
        ctx.fillRect(-sw, -Math.max(1, R * 0.09), sw * 2, Math.max(2, R * 0.18))
        ctx.restore()
      }
      const poseFlash = (bossPose === 'stunned' && bossSince >= 0 && bossSince < 130) ||
        (wolfPose === 'hit' && wolfSince >= 0 && wolfSince < 130)
      if (poseFlash) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillRect(-charW / 2, -charH / 2, charW, charH)
        ctx.restore()
      }
      ctx.restore() // VFX-003 squash wrap
      // VFX-003: hit sparks -- precomputed particles with gravity, additive short streaks
      // from the body center (lab logic, charCell-scaled). Unscaled space: they trail the
      // world, not the squashed body.
      if (fx.sparks) {
        const sp = fx.sparks
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineCap = 'round'
        for (const q of sp.parts) {
          const te = clamp01((now - sp.at - q.delay * LIGHT_HIT.sparkDur) / LIGHT_HIT.sparkDur)
          if (te <= 0 || te >= 1) continue
          const e = 1 - (1 - te) ** 5
          const spread = LIGHT_HIT.sparkSpread
          const spd = q.spd * charCell * 3.4
          const x = Math.cos(q.ang) * spd * e * spread
          const y = Math.sin(q.ang) * spd * e * spread * 0.72 + q.g * charCell * 2.1 * e * e * spread * 0.9
          const a = (1 - te) ** 1.4
          const len = q.size * (1 - te * 0.6)
          ctx.globalAlpha = a * 0.9
          ctx.strokeStyle = q.hot ? '#fff6d8' : '#ffd27a'
          ctx.lineWidth = Math.max(1, len * 0.55)
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - Math.cos(q.ang) * len, y - Math.sin(q.ang) * len)
          ctx.stroke()
        }
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // VIS-007: HUD is a separate plate near the character -- HP / ATTACK-CAST / THROW
      // lines + HP bar + countdown badge, positioned by the arena layout OUTSIDE the sprite:
      // above the head everywhere except the S slot (below the feet), always away from the
      // board. It never sizes or clips the character, and two simultaneous targets (e.g.
      // cp-e4's two enemies) can never draw over each other.
      // CAL-005 follow-up: no name/label line. It only ever showed authoring-debug text
      // (enemy ids, "urgent"/"slow", boss phase labels like "Phase 1: Center/TOP (North)") --
      // gameplay decisions need HP + timers, not that. Numeric lines are never truncated.
      // Layout, not z-index: nothing belonging to the HUD may overlap the board footprint.
      const fontPx = Math.max(10, Math.floor(charCell * (t.isBoss ? 0.3 : 0.25))) * hudScale
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const lines = [
        { text: t.dead ? 'убит' : t.fled ? (fleeStage === 'away' ? 'сбежал!' : fleeStage === 'back' ? 'сбегает!' : 'дразнит!') : `HP ${t.hp}/${t.hpMax}`, bold: false, color: t.dead || t.fled ? col.muted : (t.hp / t.hpMax <= 0.25 ? col.danger : col.text) },
      ]
      const isCast = t.attackKind === 'cast'
      if (!t.dead && !t.fled && Number.isFinite(t.countdown)) {
        lines.push({ text: isCast ? `CAST IN ${t.countdown}` : `ATTACK IN ${t.countdown}`, bold: true, color: isCast ? col.cast : t.countdown <= 1 ? col.danger : col.text })
      }
      if (!t.dead && !t.fled && t.abilityCountdown !== undefined && Number.isFinite(t.abilityCountdown)) {
        if (t.abilityKind === 'shield') {
          lines.push({ text: t.shielded ? 'SHIELD UP' : `SHIELD IN ${t.abilityCountdown}`, bold: true, color: col.cast })
        } else if (t.abilityKind === 'shift') {
          // LD-007 provisional: the enemy walks to another arena side when this hits 0.
          lines.push({ text: `MOVE IN ${t.abilityCountdown}`, bold: true, color: col.cast })
        } else {
          lines.push({ text: `THROW IN ${t.abilityCountdown}`, bold: true, color: col.rock })
        }
      }
      const lineH = fontPx * 1.15
      let maxW = 0
      for (const ln of lines) {
        ctx.font = `${ln.bold ? 700 : 600} ${fontPx}px system-ui`
        maxW = Math.max(maxW, ctx.measureText(ln.text).width)
      }
      const barH = Math.max(5, charCell * 0.16) * hudScale
      const hud = hudBoxes({
        slot: { x: 0, y: 0 },
        char: { x: -charW / 2, y: -charH / 2, w: charW, h: charH },
        side: t.side, fontPx, lineH, lineCount: lines.length, barH, maxTextW: maxW, cell: charCell * hudScale,
        slotAbsX: slot.x, boardCx: boardBBox.x + boardBBox.w / 2, boardHalfPx: boardBBox.w / 2,
        offset: hudOffPx, // CAL-005: one species-level anchor moves bar + plate + badges + lines
        // FIX-033: keep the stack inside the visible stage (last resort after all offsets).
        viewport: { w: g.stageW, h: g.stageH, x: slot.x, y: slot.y },
      })
      // VFX-003: HUD/readouts subtract the camera impulse back -- a camera hit must not
      // move HP plates, badges, bursts or the damage number (lab: "HUD-ish overlays are NOT
      // shaken"). Everything above (telegraph, shadow, art, flash, sparks) is world and shakes.
      ctx.save()
      ctx.translate(-frameCam.x, -frameCam.y)
      if (!t.dead || t.isBoss) {
        const frac = t.hpMax > 0 ? Math.max(0, t.hp) / t.hpMax : 0
        ctx.fillStyle = col.hpTrack
        roundRect(hud.bar.x, hud.bar.y, hud.bar.w, hud.bar.h, hud.bar.h / 2)
        ctx.fill()
        ctx.fillStyle = frac <= 0.25 ? col.danger : col.hpFill
        roundRect(hud.bar.x, hud.bar.y, Math.max(hud.bar.h, hud.bar.w * frac), hud.bar.h, hud.bar.h / 2)
        ctx.fill()
      }
      ctx.fillStyle = col.labelBacking
      roundRect(hud.plate.x, hud.plate.y, hud.plate.w, hud.plate.h, 6)
      ctx.fill()
      lines.forEach((ln, i) => {
        ctx.font = `${ln.bold ? 700 : 600} ${fontPx}px system-ui`
        ctx.fillStyle = ln.color
        ctx.fillText(ln.text, hud.lineX, hud.lineY(i))
      })

      // ATTACK/CAST IN badge: a small numeric chip at the HUD plate's outer corner
      // (outward = away from the board on this target's own side). Colored by attack kind
      // so it matches the telegraph ellipse/text line above.
      if (Number.isFinite(t.countdown) && !t.dead) {
        const r = hud.badge.r
        const bxo = hud.badge.x
        const byo = hud.badge.y
        ctx.save()
        ctx.fillStyle = isCast ? col.cast : t.countdown <= 1 ? col.danger : col.badgeFill
        ctx.beginPath()
        ctx.arc(bxo, byo, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `800 ${Math.floor(r * 1.15)}px system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(t.countdown), bxo, byo + 1)
        ctx.restore()
      }
      // Enemy-ability badge: Stone Throw uses rock-brown; Shield uses cast-violet and "S" while up.
      if (!t.dead && t.abilityCountdown !== undefined && Number.isFinite(t.abilityCountdown)) {
        const r = hud.badge.r
        const bxo = hud.plate.x + r * 0.5
        const byo = hud.badge.y
        ctx.save()
        ctx.fillStyle = t.abilityKind === 'shield' ? col.cast : col.rock
        ctx.beginPath()
        ctx.arc(bxo, byo, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `800 ${Math.floor(r * 1.15)}px system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(t.abilityKind === 'shield' && t.shielded ? 'S' : String(t.abilityCountdown), bxo, byo + 1)
        ctx.restore()
      }

      // CAST INTERRUPTED burst, rising just above the head -- local coords again, so it always
      // reads next to its own target. Only fires for a real EXP-011 cast interrupt (see
      // onTapResult), never the legacy interruptOnHit reset.
      const sinceInterrupt = now - fx.interruptT
      const sinceShield = now - (fx.shieldT ?? -1e9)
      if (sinceShield >= 0 && sinceShield < 650) {
        const p = sinceShield / 650
        ctx.save()
        ctx.globalAlpha = 1 - p
        ctx.fillStyle = col.cast
        ctx.font = `800 ${Math.max(11, Math.floor(charCell * 0.26))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('SHIELD BLOCKED', 0, -charH / 2 - 8 - p * 10)
        ctx.restore()
      }

      if (sinceInterrupt >= 0 && sinceInterrupt < 700) {
        const p = sinceInterrupt / 700
        ctx.save()
        ctx.globalAlpha = 1 - p
        ctx.fillStyle = col.good
        ctx.font = `700 ${Math.max(10, Math.floor(charCell * 0.24))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('CAST INTERRUPTED', 0, -charH / 2 - 10 - p * 12)
        ctx.restore()
      }

      // VFX-002: damage-number popup -- pop in with overshoot, drift up, fade out. Offset to the
      // upper-right of the head (like the lab's hit-point offset) so it never sits exactly under
      // the HUD plate above. `dmgText.at` is the same `now + FLIGHT_MS` timestamp as `fx.hitT`,
      // so the number appears exactly when the projectile arrives, not when the player tapped.
      if (fx.dmgText) {
        const dmgP = (now - fx.dmgText.at) / DMG_MS
        if (dmgP >= 0 && dmgP < 1) {
          const pop = dmgP < 0.22 ? easeOutBack(dmgP / 0.22) : 1
          const rise = easeOutCubic(dmgP) * charCell * 1.1
          const fade = dmgP < 0.62 ? 1 : 1 - smoothstep(clamp01((dmgP - 0.62) / 0.38))
          const size = Math.max(10, charCell * 0.34 * 0.9) * (0.7 + 0.3 * pop)
          ctx.save()
          ctx.globalAlpha = clamp01(fade)
          ctx.translate(charW * 0.28, -charH / 2 - rise)
          ctx.scale(pop, pop)
          ctx.font = `800 ${size}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          ctx.lineWidth = Math.max(2, size * 0.14)
          ctx.strokeStyle = DMG_STYLE_LIGHT.stroke
          ctx.strokeText(String(fx.dmgText.value), 0, 0)
          ctx.fillStyle = DMG_STYLE_LIGHT.fill
          ctx.fillText(String(fx.dmgText.value), 0, 0)
          ctx.restore()
        }
      }
      ctx.restore() // VFX-003 HUD compensation (camera impulse)

      // VIS-007: debug layout record in canvas coords, for automated checks (HUD clear of
      // board/sprite-face, characters unclipped, pose swaps anchored).
      const ax = slot.x + ox
      const ay = slot.y + oy
      const charR = { x: ax - charW / 2, y: ay - charH / 2, w: charW, h: charH }
      // BUILD-035: body-center hit-anchor for projectile flight (canvas coords).
      targetAnchors.set(key, { x: ax, y: ay })
      layoutInfo.push({
        key, side: t.side, isBoss: t.isBoss,
        char: charR,
        face: faceRect(charR),
        plate: { x: ax + hud.plate.x, y: ay + hud.plate.y, w: hud.plate.w, h: hud.plate.h },
        badge: { x: ax + hud.badge.x, y: ay + hud.badge.y },
        // CAL-005: ground-shadow center in canvas coords -- for automated checks that the
        // shadow follows only its own species offset, never the art pivot.
        shadow: { x: ax + shadowOffPx.x, y: ay + charH / 2 + shadowOffPx.y },
        effectAnchor: eff,
        board: boardBBox,
      })

      ctx.restore()
    }

    // VIS-005/VIS-007: anchored pose draw + presentation-only transforms. The character
    // footprint (bw/bh) comes from the arena layout; the PNG is contain-fitted and its
    // bottom-center (ground point) is locked to the footprint's bottom-center, so a pose
    // swap never moves the anchor or the visual size. All motion here is wall-clock
    // cosmetics -- simulation timers are untouched.
    function drawBossArt(img, pose, since, t, bw, bh, pivot = ZERO_PIVOT, artScale = 1) {
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      if (!iw || !ih) return
      const fit = Math.min(bw / iw, bh / ih) * artScale
      const dw = iw * fit
      const dh = ih * fit
      const off = BOSS_ANCHOR.offsets[pose] ?? { dx: 0, dy: 0 }
      // PLAYTEST-002: calibration-level sprite pivot correction, ADDED to the asset's own per-pose
      // offset -- see arena-calibration.js's `spritePivot` doc comment.
      const gx = (off.dx + pivot.dx) * bw
      const gy = bh / 2 + (off.dy + pivot.dy) * bh
      const tr = bossPoseTransform(pose, since, t)
      ctx.save()
      ctx.translate(gx, gy)
      ctx.scale(tr.sx, tr.sy)
      ctx.translate(-gx + tr.tx, -gy + tr.ty)
      ctx.drawImage(img, gx - dw * BOSS_ANCHOR.anchorX, gy - dh * BOSS_ANCHOR.anchorY, dw, dh)
      ctx.restore()
    }

    function bossPoseTransform(pose, since, t) {
      const tr = { sx: 1, sy: 1, tx: 0, ty: 0 }
      if (pose === 'idle') {
        tr.sy = 1 + 0.012 * Math.sin(now / 1100) // breathing
        tr.ty = 1.5 * Math.sin(now / 1100 + 0.6)
      } else if (pose === 'angry') {
        tr.sy = 1 + 0.008 * Math.sin(now / 420) // tenser, faster idle; no flashing
        tr.sx = 1 - 0.006 * Math.sin(now / 420)
      } else if (pose === 'taunt' && since >= 0) {
        if (since < 150) { // anticipation crouch
          tr.sx = tr.sy = 0.94 + 0.06 * (since / 150)
        } else if (since < 400) { // pop
          const p = (since - 150) / 250
          tr.sx = tr.sy = 1 + 0.04 * Math.sin(p * Math.PI)
        }
        tr.ty = -Math.abs(Math.sin(since / 180)) * 6 * Math.max(0, 1 - since / 1400) // bounce, held
      } else if (pose === 'stunned' && since >= 0 && since < 260) {
        tr.tx = Math.sin(since / 16) * 3 // shake, decaying with the hold
        tr.ty = DY[t.side] * 6 * Math.max(0, 1 - since / 180) // recoil outward
        tr.tx += DX[t.side] * 6 * Math.max(0, 1 - since / 180)
      } else if (pose === 'cast') {
        const p = 1 + 0.03 * Math.sin(now / 300) // pulse; castGlow hook draws separately
        tr.sx = tr.sy = p
      } else if (pose === 'defeat' && since >= 0) {
        const p = clamp01(since / 350) // impact settle, then stays down
        tr.sx = tr.sy = 1 + 0.1 * (1 - p) * (1 - p)
        tr.ty = 4 * (1 - p)
      }
      return tr
    }

    // VIS-006/VIS-007: anchored wolf draw + presentation-only transforms. Same
    // ground-anchor contract as the boss (fixed character footprint, contain-fit,
    // bottom-center locked); mirroring follows the arena layout (face the board).
    function drawWolfArt(img, pose, since, t, bw, bh, pivot = ZERO_PIVOT, artScale = 1) {
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      if (!iw || !ih) return
      const fit = Math.min(bw / iw, bh / ih) * artScale
      const dw = iw * fit
      const dh = ih * fit
      const off = ENEMY_ANCHOR.offsets[pose] ?? { dx: 0, dy: 0 }
      // PLAYTEST-002: calibration-level sprite pivot correction, ADDED to the asset's own per-pose
      // offset -- see arena-calibration.js's `spritePivot` doc comment.
      const gx = (off.dx + pivot.dx) * bw
      const gy = bh / 2 + (off.dy + pivot.dy) * bh
      const mirror = spriteMirror(false, t.side) // side profiles face the board
      const tr = wolfPoseTransform(pose, since, t)
      ctx.save()
      ctx.translate(gx, gy)
      ctx.scale(mirror * tr.sx, tr.sy)
      ctx.translate(-gx + tr.tx, -gy + tr.ty)
      ctx.drawImage(img, gx - dw * ENEMY_ANCHOR.anchorX, gy - dh * ENEMY_ANCHOR.anchorY, dw, dh)
      ctx.restore()
    }

    function wolfPoseTransform(pose, since, t) {
      const tr = { sx: 1, sy: 1, tx: 0, ty: 0 }
      const toBoard = { x: -DX[t.side], y: -DY[t.side] }
      if (pose === 'idle') {
        tr.sy = 1 + 0.012 * Math.sin(now / 1000) // breathing
        tr.tx = 1.5 * Math.sin(now / 1400 + 0.9) // shifting weight
      } else if (pose === 'attackReady') {
        tr.sy = 0.96 // low stance: squash...
        tr.sx = 1.03 // ...and coil
        tr.tx = toBoard.x * 4 // forward tension toward the board
        tr.ty = toBoard.y * 4 + 0.8 * Math.sin(now / 500)
      } else if (pose === 'attack' && since >= 0) {
        // Pose swap carries the lunge; the fx lunge offset adds travel. A short pop + recoil
        // sells the strike without a skeletal rig.
        const p = Math.max(0, 1 - since / 450)
        tr.sx = tr.sy = 1 + 0.03 * p
        tr.tx = toBoard.x * 6 * p
        tr.ty = toBoard.y * 6 * p
      } else if (pose === 'hit' && since >= 0 && since < 260) {
        tr.tx = Math.sin(since / 16) * 3 // shake, decaying with the hold
        tr.ty = DY[t.side] * 6 * Math.max(0, 1 - since / 180) // recoil outward
        tr.tx += DX[t.side] * 6 * Math.max(0, 1 - since / 180)
      } else if (pose === 'taunt' && since >= 0) {
        // STORY-001: scripted-flee taunt beat only (never a baseline — ENEMY_POSES is
        // unchanged, so no actor can hold this outside the flee path). Continuous bounce
        // for the whole one-turn hold (no decay — the taunt waits for the player's next tap).
        tr.ty = -Math.abs(Math.sin(since / 300)) * 5
      }
      // defeat: static -- the death fade (globalAlpha 1-deathP) is the terminal hold/fade.
      return tr
    }

    function drawSideReadouts(col, s, def) {
      const g = geo
      const alive = s.aliveByArenaDir()
      const free = s.aliveByArenaDir(true)
      const readoutCell = g.actorBaseCell ?? g.cell
      ctx.font = `600 ${Math.max(10, Math.floor(readoutCell * 0.24))}px system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let d = 0; d < 4; d++) {
        // STORY-001: a fled enemy already left the arena — its side stops reading as a target.
        const isLive = def.enemies ? s.enemies.some((e) => e.side === d && !e.dead && !e.fled) : d === s.bossSide
        if (isLive) continue // the target panel itself already shows this side clearly
        // FIX-021/CAL-002: same arena-relative podium anchor an actor on this side would use (not a
        // board-relative radius) -- an empty side still reads its readout from a stable, real
        // point on the arena instead of one that moves with the board's own size.
        const sideScale = g.actorScaleOverride?.[d] ?? 1.0
        const sideCell = (g.actorBaseCell ?? g.cell) * sideScale
        const slot = podiumSlot(d, d === 0, g.stageW, g.stageH, sideCell, g.groundOverride)
        ctx.fillStyle = col.muted
        ctx.save()
        ctx.translate(slot.x, slot.y)
        if (d === 1 || d === 3) ctx.rotate(d === 1 ? Math.PI / 2 : -Math.PI / 2)
        ctx.fillText(`${alive[d]} (своб. ${free[d]})`, 0, 0)
        ctx.restore()
      }
    }

    // BUILD-022 course correction: the arena's own painted stone well is the board surface --
    // no drawn panel/card and no separate frame image sit on top of it (a translucent card or a
    // second masonry frame both read as a foreign object pasted over the arena; an ART-003 flat
    // square frame overlay was tried and rejected for exactly this reason -- see
    // docs/ART-003-BOARD-FRAME-OVERLAY.md). This only draws the debug alignment dots/backdrop
    // outline, gated behind the debug panel toggle so a normal playthrough shows nothing here at
    // all -- puzzle content (arrows/glow/selection/shots, drawn elsewhere in frame()) is the only
    // thing visually on the board, projected directly onto the arena art via board-plane.js.
    // FIX-023: draws the full projected grid MESH (cols+1 vertical lines x rows+1 horizontal
    // lines, e.g. 7x7 for a 6x6 board) plus their intersections as dots, using the exact same
    // gridLineToScreen the rest of this module would use for any cell boundary -- so a calibrator
    // can judge alignment directly against the baked stone grid in a screenshot, line for line.
    function drawBoardSurface(col, backdrop) {
      if (!debug) return
      const g = geo
      ctx.save()
      ctx.strokeStyle = col.boardBorder
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      quadPath(backdrop)
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = col.gridLine
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.9
      for (let c = 0; c <= g.w; c++) {
        ctx.beginPath()
        for (let row = 0; row <= g.h; row++) {
          const p = gridLineToScreen(g.plane, g.fit, c, row, shownAngle)
          if (row === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
      for (let row = 0; row <= g.h; row++) {
        ctx.beginPath()
        for (let c = 0; c <= g.w; c++) {
          const p = gridLineToScreen(g.plane, g.fit, c, row, shownAngle)
          if (c === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      ctx.fillStyle = col.dot
      for (let row = 0; row <= g.h; row++) {
        for (let c = 0; c <= g.w; c++) {
          const p = gridLineToScreen(g.plane, g.fit, c, row, shownAngle)
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    function drawArrow(col, s, def, a, hint) {
      const alive = s.board.isAlive(a.id)
      if (!alive) return
      const arena = s.arenaDir(a.id)
      const free = s.board.canExit(a.id)
      // EXP-013/VS-001: a rock-pinned arrow is geometrically free (board.canExit is unchanged) but
      // mechanically untappable -- s.isPinned is the same "playable" overlay rock-spike.js already
      // draws from, kept visually consistent here (rock-brown, dashed) so the two viewers agree.
      const pinned = s.isPinned(a.id)
      // STORY-001: fled enemies are gone — remaining arrows no longer aim at their side.
      const aims = def.enemies ? s.enemies.some((e) => e.side === arena && !e.dead && !e.fled) : arena === s.bossSide
      const pts = a.cells.map((c) => cellCenter(c, shownAngle))
      // FIX-023: perspective-sensitive scale, sampled at the arrowhead's own cell (the most
      // visually prominent point of the arrow) rather than geo.cell's whole-board average --
      // a far/top arrow reads thinner, a near/bottom one reads chunkier, matching the stone.
      const localScale = localScaleAt(a.cells[a.cells.length - 1], shownAngle)
      const lw = Math.max(3, localScale * 0.27)
      const isHint = hint && hint.kind === 'tap' && hint.id === a.id
      const isHover = a.id === hoverId
      const isBlocked = a.id === flash.blocked
      const isBlocker = a.id === flash.blocker
      const fx = arrowFxFor(a.id)
      const isDenied = now - fx.deniedT >= 0 && now - fx.deniedT < 320

      // BUILD-034: new default -- one closed filled shape (shaft + rounded bends + head) built in
      // board-space cell units and projected through the SAME plane/rotation as cellToScreen, so
      // the silhouette can never drift from screenToCell's hitbox. The legacy stroke path below
      // stays reachable via setArrowStyle('stroke').
      // `typeof Path2D` guard: the headless node test harness (cal-002-actor-scale.test.ts and
      // friends) drives frame() against a stub 2D context that has no Path2D. Those tests assert
      // actor layout, not arrow paint, so outside a browser we simply fall through to the stroke
      // path instead of shipping a fake Path2D just to satisfy them.
      if (arrowStyle === 'filled' && typeof Path2D !== 'undefined') {
        // FIX-032b: the tip/tail insets are px, so they are resolved against THIS arrow's own
        // local cell size (already perspective-aware via localScaleAt) -- the gap to the grid
        // line reads the same on a near/bottom arrow as on a far/top one.
        const built = buildArrowPath(a, { plane: geo.plane, fit: geo.fit, cols: geo.w }, shownAngle, DX, DY, shapeForCell(localScale))
        paintFilledArrow(ctx, built, {
          col, materialId: arrowMaterial, localScale, now, seed: a.id,
          free, pinned, aims, hover: hoverFade.amount(a.id), isBlocked, isBlocker, isHint, isDenied,
        })
        // Pin marker/badges keep their old anchor (the head cell's own centre), so the rock cue
        // sits exactly where the stroke renderer put it.
        const [phx, phy] = pts[pts.length - 1]
        const [pdxr, pdyr] = rotateDirPx(a.dir, shownAngle)
        drawPinFx(col, a, phx, phy, pdxr, pdyr, localScale * 0.42, pinned, s, localScale)
        return
      }

      // PLAYTEST-002: contrast outline underneath every arrow body -- a dark halo so the body reads
      // against both bright torch-lit stone and dark shadowed stone, independent of free/blocked/
      // pinned state. Solid line always (see below): a dashed round-capped stroke at this line
      // width visually degenerates into a chain of beads ("caterpillar" effect) -- reported
      // unreadable/ugly in playtest. Blocked/pinned status is conveyed by color+opacity only now.
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = free ? 0.6 : 0.45
      ctx.strokeStyle = col.arrowOutline
      ctx.lineWidth = lw + Math.max(2.5, lw * 0.55)
      polyline(pts)
      ctx.restore()

      // Body: strong + colored for a free/aimed arrow, rock-brown for a pinned one, dimmer (but
      // still clearly visible, never invisible) for a geometrically blocked one. Always a solid
      // line -- see the outline comment above for why dashing was removed.
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowBlur = pinned ? 10 : free ? (aims ? 16 : 9) : (aims ? 7 : 4)
      ctx.shadowColor = pinned ? col.rockGlow : aims ? col.aimGlow : free ? col.freeGlow : col.mutedGlow
      ctx.strokeStyle = pinned ? col.rock : aims ? col.aim : free ? col.arrow : col.arrowDim
      ctx.globalAlpha = pinned ? 0.9 : free ? 1 : 0.75
      ctx.lineWidth = lw
      polyline(pts)
      ctx.restore()

      // Inner highlight: a thin near-white core along the same path for a glossy look (free, unpinned only).
      if (free && !pinned) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.22
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = Math.max(1, lw * 0.32)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        polyline(pts)
        ctx.restore()
      }

      if (isHover || isBlocked || isBlocker || isHint || isDenied) {
        ctx.save()
        // Denied (tapped while pinned) gets its own amber ring, deliberately NOT the blocked-tap
        // red -- this never costs HP, so it must not look like a damaging mistake.
        ctx.strokeStyle = isBlocked ? '#e53935' : isBlocker ? '#fb8c00' : isDenied ? col.rock : isHint ? '#43a047' : col.muted
        ctx.lineWidth = lw + 6
        ctx.globalAlpha = 0.55
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        polyline(pts)
        ctx.restore()
      }

      // Arrowhead: a filled kite with a small highlight edge.
      const [hx, hy] = pts[pts.length - 1]
      const d = a.dir
      const rot = shownAngle
      const [dxr, dyr] = rotateDirPx(d, rot)
      const sz = localScale * 0.42
      ctx.save()
      ctx.fillStyle = col.arrowOutline
      ctx.globalAlpha = free ? 0.6 : 0.45
      const headOutlinePad = sz * 0.22
      ctx.beginPath()
      ctx.moveTo(hx + dxr * (sz + headOutlinePad), hy + dyr * (sz + headOutlinePad))
      ctx.lineTo(hx + dyr * (sz * 0.82 + headOutlinePad), hy - dxr * (sz * 0.82 + headOutlinePad))
      ctx.lineTo(hx - dyr * (sz * 0.82 + headOutlinePad), hy + dxr * (sz * 0.82 + headOutlinePad))
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.shadowBlur = pinned ? 6 : free ? 10 : 0
      ctx.shadowColor = pinned ? col.rockGlow : aims ? col.aimGlow : col.freeGlow
      ctx.fillStyle = pinned ? col.rock : aims ? col.aim : free ? col.arrow : col.arrowDim
      ctx.globalAlpha = pinned ? 0.9 : free ? 1 : 0.75
      ctx.beginPath()
      ctx.moveTo(hx + dxr * sz, hy + dyr * sz)
      ctx.lineTo(hx + dyr * sz * 0.82, hy - dxr * sz * 0.82)
      ctx.lineTo(hx - dyr * sz * 0.82, hy + dxr * sz * 0.82)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      drawPinFx(col, a, hx, hy, dxr, dyr, sz, pinned, s, localScale)
    }

    /** Direction unit vector d (board-local, DX/DY) turned by the puzzle layer's current visual
     * angle -- the arrowhead/pin marker must point along the *drawn* (rotated) segment, not the
     * logical one, since FIX-021 draws arrows via projected points rather than a canvas-level
     * rotation transform. */
    function rotateDirPx(d, angleDeg) {
      const rad = (angleDeg * Math.PI) / 180
      const cos = Math.cos(rad), sin = Math.sin(rad)
      return [DX[d] * cos - DY[d] * sin, DX[d] * sin + DY[d] * cos]
    }

    /** EXP-013/VS-001: rock marker + remaining-turns badge for the whole pin duration, plus the
     * three one-shot cues the brief asks for: a pop-in "ROCK THROWN" when the pin is created, a
     * green "UNPINNED" pulse when it expires, and a denied-tap "PINNED" popup (no HP shown lost --
     * there is none). Deliberately simple (an icon + text popup): no puppet/FX pipeline, per the
     * VS-001 brief. */
    function drawPinFx(col, a, hx, hy, dxr, dyr, sz, pinned, s, localScale) {
      const fx = arrowFxFor(a.id)
      const markerX = hx + dxr * sz * 2.2
      const markerY = hy + dyr * sz * 2.2

      if (pinned) {
        const turnsLeft = s.pinnedArrows.find((p) => p.id === a.id)?.turnsLeft ?? 0
        const sincePin = now - fx.pinT
        const pop = sincePin >= 0 && sincePin < 400 ? 1 + Math.sin(clamp01(sincePin / 400) * Math.PI) * 0.5 : 1
        ctx.save()
        ctx.translate(markerX, markerY)
        ctx.scale(pop, pop)
        const r = Math.max(9, localScale * 0.22)
        if (assets.rockProjectile) {
          ctx.drawImage(assets.rockProjectile, -r, -r, r * 2, r * 2)
        } else {
          ctx.font = `${Math.floor(r * 1.8)}px system-ui`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('\u{1FAA8}', 0, 0) // rock emoji placeholder
        }
        ctx.fillStyle = col.rock
        ctx.font = `700 ${Math.max(9, Math.floor(localScale * 0.24))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText(`${turnsLeft}t`, 0, r + 8)
        ctx.restore()
      }

      const sinceUnpin = now - fx.unpinT
      if (sinceUnpin >= 0 && sinceUnpin < 550) {
        const p = sinceUnpin / 550
        ctx.save()
        ctx.globalAlpha = 1 - p
        ctx.strokeStyle = col.good
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(hx, hy, sz * (1 + p * 1.6), 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = col.good
        ctx.font = `700 ${Math.max(9, Math.floor(localScale * 0.22))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('UNPINNED', hx, hy - sz * 2.4 - p * 10)
        ctx.restore()
      }

      const sinceDenied = now - fx.deniedT
      if (sinceDenied >= 0 && sinceDenied < 320) {
        const p = sinceDenied / 320
        ctx.save()
        ctx.globalAlpha = 1 - p
        ctx.fillStyle = col.rock
        ctx.font = `700 ${Math.max(9, Math.floor(localScale * 0.22))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('PINNED', hx, hy - sz * 2.4 - p * 8)
        ctx.restore()
      }
    }

    function drawShot(col, sh, now) {
      const t = clamp01((now - sh.t0) / FLIGHT_MS)
      const [hx, hy] = cellCenter(sh.cells[sh.cells.length - 1], shownAngle)
      const [dxr, dyr] = rotateDirPx(sh.dir, shownAngle)
      // FIX-023: stroke thickness/tail length are perspective-sensitive (localScale, sampled at
      // the exit cell); overall travel distance stays geo.cell-based -- it's an off-board flight
      // path to the podium, not a piece of the stone grid, so it doesn't need perspective scale.
      const localScale = localScaleAt(sh.cells[sh.cells.length - 1], shownAngle)
      // BUILD-035: exit along the freed direction, then steer into the hit-anchor.
      const from = { x: hx, y: hy }
      const dir = { x: dxr, y: dyr } // rotateDirPx preserves unit length
      const leg = sh.target
        ? straightLen(from, sh.target)
        : (Math.max(geo.w, geo.h) + 3.5) * geo.cell
      const p = flightPoint(t, { from, dir, target: sh.target, straightLen: leg, arc: sh.arc ?? 0 })
      // Projectile figure per flight style (frozen on the shot -- a mid-flight switch never
      // pops the figure). All styles share trajectory sync; only the painting differs.
      // standard: amber kite; heavy: 1.5x bolt, short trail; needle: 0.7x dart, long trail;
      // crit: standard + white core + arrival ring; lob: standard figure (the arc is the style).
      const style = sh.style ?? 'standard'
      const figK = style === 'heavy' ? 1.5 : style === 'needle' ? 0.7 : style === 'crit' ? 1.25 : 1
      const trailK = style === 'heavy' ? 0.6 : style === 'needle' ? 1.8 : 1
      const shaftK = style === 'heavy' ? 1.3 : style === 'needle' ? 0.7 : 1
      const sz = Math.max(4, localScale * 0.3) * figK
      const headL = sz * 2.6
      const tailL = sz * 4.5 * trailK
      const fade = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1
      // BUILD-035: a hitting projectile is emissive -- fixed vivid amber in both themes so
      // the flight reads on bright day-stone and night-stone alike. A miss stays the quiet
      // theme-aware gray (it must not blaze -- nothing happened).
      const body = sh.hit ? '#ffd76a' : col.arrowDim
      const glow = sh.hit ? 'rgba(255,190,80,0.9)' : col.mutedGlow
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      // BUILD-035: speed squeeze -- the faster the leg, the thinner and longer the figure;
      // it relaxes back into full shape as it settles into the hit. Trail stretches with it.
      const thin = Math.min(1, Math.max(0.45, 1 / (1 + 0.45 * p.speed)))
      const stretch = Math.min(1.8, Math.max(1, 1 + 0.3 * p.speed))
      ctx.scale(stretch, thin)
      ctx.globalAlpha = (sh.hit ? 1 : 0.7) * fade
      ctx.shadowBlur = 12
      ctx.shadowColor = glow
      const grad = ctx.createLinearGradient(-tailL, 0, 0, 0)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, body)
      ctx.strokeStyle = grad
      ctx.lineWidth = sz * 0.9
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-tailL, 0)
      ctx.lineTo(0, 0)
      ctx.stroke()
      ctx.strokeStyle = body
      ctx.lineWidth = sz * shaftK
      ctx.beginPath()
      ctx.moveTo(-headL * 0.9, 0)
      ctx.lineTo(headL * 0.35, 0)
      ctx.stroke()
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(headL, 0)
      ctx.lineTo(0, -sz)
      ctx.lineTo(headL * 0.35, 0)
      ctx.lineTo(0, sz)
      ctx.closePath()
      ctx.fill()
      if (style === 'crit' && sh.hit) {
        // White-hot core -- the crit reads before it even lands.
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.moveTo(headL * 0.8, 0)
        ctx.lineTo(headL * 0.1, -sz * 0.4)
        ctx.lineTo(headL * 0.35, 0)
        ctx.lineTo(headL * 0.1, sz * 0.4)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      if (style === 'crit' && sh.hit && sh.target) {
        // Arrival ring at the hit-anchor -- expands and fades right after impact.
        const sinceImpact = now - (sh.t0 + FLIGHT_MS)
        if (sinceImpact >= 0 && sinceImpact < 260) {
          const q = sinceImpact / 260
          ctx.save()
          ctx.globalAlpha = (1 - q) * 0.9
          ctx.strokeStyle = '#ffd76a'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(sh.target.x, sh.target.y, 6 + q * localScale * 3, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
  }

  function polyline(pts) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
  }

  function quadPath(q) {
    ctx.beginPath()
    ctx.moveTo(q.tl.x, q.tl.y)
    ctx.lineTo(q.tr.x, q.tr.y)
    ctx.lineTo(q.br.x, q.br.y)
    ctx.lineTo(q.bl.x, q.bl.y)
    ctx.closePath()
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function palette(dark) {
    return {
      board: dark ? '#26262a' : '#ffffff',
      // BUILD-022: debug-only alignment outline (backdrop quad no longer paints a visible panel).
      boardBorder: dark ? 'rgba(200,195,210,0.35)' : 'rgba(120,105,70,0.45)',
      dot: dark ? '#4a4a4f' : '#c9c9c6',
      // FIX-023: debug grid-line mesh, bright enough to read against any baked arena art.
      gridLine: dark ? 'rgba(120,220,255,0.75)' : 'rgba(20,120,180,0.75)',
      // PLAYTEST-002: `arrow` brightened toward a warm parchment tone (was a mid-gray that blended
      // into the stone under both themes) and `arrowDim` given real contrast in each theme (was
      // near-identical to the stone tone it sits on -- effectively invisible) instead of one flat
      // gray reused for both. `arrowOutline` is a dark halo drawn under every arrow body/head/pin
      // marker (see drawArrow) so any arrow color still reads against bright or dark stone.
      arrow: dark ? '#f3ecd9' : '#2c2013', arrowDim: dark ? '#c9c4b4' : '#5a4d3a', aim: dark ? '#ffd76a' : '#b8791a',
      arrowOutline: 'rgba(12,9,6,0.75)',
      aimGlow: dark ? 'rgba(255,215,106,0.85)' : 'rgba(184,121,26,0.6)', freeGlow: dark ? 'rgba(200,200,220,0.55)' : 'rgba(120,110,90,0.35)', mutedGlow: 'rgba(0,0,0,0)',
      // FIX-032: warm neutral so the hover halo reads on top of any material's own palette.
      hoverGlow: dark ? 'rgba(255,241,206,0.9)' : 'rgba(255,246,222,0.95)',
      text: dark ? '#eee' : '#20180f', muted: dark ? '#999' : '#777',
      bossA: dark ? '#5b4a63' : '#8d7a96', bossB: dark ? '#332a3a' : '#5c4d63', bossGlow: dark ? 'rgba(180,120,220,0.5)' : 'rgba(120,70,150,0.4)',
      enemyA: dark ? '#4a5563' : '#7c8ea0', enemyB: dark ? '#2b323c' : '#54606e', enemyGlow: dark ? 'rgba(120,170,220,0.45)' : 'rgba(70,100,140,0.35)',
      deadA: dark ? '#333336' : '#cfcac0', deadB: dark ? '#222224' : '#a8a299', deadOverlay: 'rgba(20,20,22,0.55)',
      panelBorder: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.28)',
      labelBacking: dark ? 'rgba(10,8,14,0.6)' : 'rgba(255,252,244,0.72)',
      badgeFill: dark ? '#4a4a52' : '#5c5348',
      hpTrack: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)', hpFill: dark ? '#7be08a' : '#2e8b3d',
      danger: dark ? '#ff6b6b' : '#c62828', good: dark ? '#7be08a' : '#1a7f37',
      // EXP-011/VS-001: cast telegraph is visually distinct from a plain attack (violet, matching
      // design/visual-assets-v01's "amethyst"/purple cast-glow direction) rather than reusing the
      // attack's amber/red. EXP-013/VS-001: rock-brown for anything Stone-Throw-related, matching
      // rock-spike.js's debug-viewer convention so the two viewers read consistently.
      cast: dark ? '#c9a6ff' : '#7c4dbf', castGlow: dark ? 'rgba(201,166,255,0.8)' : 'rgba(124,77,191,0.55)',
      rock: dark ? '#c49a7c' : '#8d6e63', rockGlow: dark ? 'rgba(196,154,124,0.7)' : 'rgba(141,110,99,0.5)',
      // VIS-007: soft ground shadow planting characters on the arena.
      groundShadow: dark ? 'rgba(0,0,0,0.4)' : 'rgba(40,30,20,0.28)',
    }
  }

  return {
    resize, hitTest, setHover, setFlash, onTapResult, onPinDenied, onRotateStart, onRotateEnemyAttack, markDeaths, markFled, markFledAdvance, resetFx, frame,
    get geo() { return geo },
    /** BUILD-035: live shots + last-frame hit-anchors (debug/QA only -- no gameplay effect). */
    debugShots() { return shots.map((sh) => ({ ...sh })) },
    debugAnchors() { return Object.fromEntries(targetAnchors) },
    /** BUILD-034: arrow presentation selector (debug/QA only -- no gameplay effect). */
    /** BUILD-035: projectile flight style selector (switcher UI + debug -- painting only). */
    listFlightStyles() { return [...FLIGHT_STYLES] },
    setFlightStyle(style) { if (FLIGHT_STYLES.includes(style)) flightStyle = style },
    getFlightStyle() { return flightStyle },
    setArrowStyle(style) { if (style === 'filled' || style === 'stroke') arrowStyle = style },
    getArrowStyle() { return arrowStyle },
    setArrowMaterial(id) { if (MATERIALS.some((m) => m.id === id)) arrowMaterial = id },
    /** FIX-032b: what geometry the arrows are ACTUALLY drawn with right now -- the resolved
     * cell-unit shape plus the px inset it came from, so "did that setting apply in the real
     * game?" is answerable without reading the source. */
    arrowGeometry() {
      if (!geo) return null
      const cellPx = geo.cell
      const shape = shapeForCell(cellPx)
      return {
        cellPx: Math.round(cellPx),
        scale: ARROW_SCALE,
        insetPx: { ...ARROW_INSET_PX },
        resolved: shape,
        tipGapPx: +((0.5 - shape.tipReach) * cellPx).toFixed(1),
        tailBackPx: +(shape.tailExtend * cellPx).toFixed(1),
      }
    },
    getArrowMaterial() { return arrowMaterial },
    listArrowMaterials() { return MATERIALS.map((m) => ({ id: m.id, name: m.name, vibe: m.vibe, animated: !!m.animated })) },
    collectTargets,
    /** VIS-007: per-frame arena layout (canvas coords) for automated checks. */
    debugLayout() { return layoutInfo },
    /** FIX-021: board-plane debug API (corners/logical size/fit + point projection). */
    boardPlane() {
      if (!geo) return null
      return {
        corners: geo.plane.corners,
        backdrop: backdropCornersPx(geo.plane, geo.fit),
        fit: geo.fit,
        cols: geo.w, rows: geo.h,
        angleDeg: shownAngle,
        cellPx: geo.cell,
      }
    },
    projectBoardPoint(col, row, angleDeg = shownAngle) {
      if (!geo) return null
      return cellToScreen(geo.plane, geo.fit, col, row, angleDeg)
    },
    unprojectBoardPoint(x, y, angleDeg = shownAngle) {
      if (!geo) return null
      return screenToCell(geo.plane, geo.fit, x, y, angleDeg)
    },
  }
}
