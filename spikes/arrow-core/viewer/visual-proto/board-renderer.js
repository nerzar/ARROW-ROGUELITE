// VIS-001: presentation-only board/target renderer. Reads EncounterState/Level/BoardTopology
// (via the same s.board.isAlive/canExit/ownerAt, s.arenaDir, s.enemies/bossSide accessors the
// EXP-008/009/010 debug viewers already use) and draws arrows exactly where Level says they are.
// It never mutates combat state and never invents rules -- game state changes are driven entirely
// by EncounterState; this module only plays back the *result* of a tap/rotate as animation.
import { DX, DY } from '../../dist/src/index.js'
import { resolveBossImage, resolveTargetImage, resolveWolfImage } from './assets.js'
import { BOSS_ANCHOR } from './boss-visual-state.js'
import { ENEMY_ANCHOR } from './enemy-visual-state.js'
import {
  BOARD_FIT_HEIGHT, BOSS_SLOT_DIST, charSize, faceRect,
  hudBoxes, podiumSlot, rotatedBoardBox, SLAB_CENTER, spriteMirror,
} from './arena-layout.js'

const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t) => Math.max(0, Math.min(1, t))

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

  function fxFor(key) {
    let fx = targetFx.get(key)
    if (!fx) {
      fx = { hitT: -1e9, deathT: -1e9, attackT: -1e9, interruptT: -1e9 }
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
  // BUILD-020 layout pass v2: the canvas now spans the *whole stage* (like the background
  // layer), not just a cropped square around the board -- a square canvas sized to the board's
  // own margin could never reach the side podiums painted near the stage edges (arena-moonlit-
  // fortress.png's aspect is close to 16:9, so a square inevitably falls far short of its
  // width). The board itself is drawn as a smaller square sized/centered to sit inside the
  // stone dais (SLAB_CENTER/BOARD_FIT_HEIGHT); characters anchor to the fixed stage-fraction
  // podiums (PODIUM_GROUND, in arena-layout.js) instead of a radius from the board edge.

  // VIS-007: per-frame debug layout (canvas coords) for automated checks. Reset on every
  // frame; drawTarget appends one entry per live target (key/side/char/face/plate/badge/board).
  let layoutInfo = []
  let boardBox = { x: 0, y: 0, w: 0, h: 0 }

  function resize(level) {
    const { width: w, height: h } = level
    const span = Math.max(w, h)
    const stageRect = stageEl.getBoundingClientRect()
    const stageW = Math.max(1, stageRect.width)
    const stageH = Math.max(1, stageRect.height)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(stageW * dpr)
    canvas.height = Math.round(stageH * dpr)
    canvas.style.width = `${stageW}px`
    canvas.style.height = `${stageH}px`
    const cell = Math.max(10, (BOARD_FIT_HEIGHT * stageH) / span)
    const cx = SLAB_CENTER.x * stageW
    const cy = SLAB_CENTER.y * stageH
    geo = { w, h, cell, cx, cy, half: (span * cell) / 2, stageW, stageH }
    return geo
  }

  function boardMatrix(angleDeg) {
    const g = geo
    return new DOMMatrix().translate(g.cx, g.cy).rotate(angleDeg).translate((-g.w * g.cell) / 2, (-g.h * g.cell) / 2)
  }

  function cellCenter(c) {
    const x = c % geo.w
    return [(x + 0.5) * geo.cell, ((c - x) / geo.w + 0.5) * geo.cell]
  }

  function hitTest(clientX, clientY, s, level) {
    if (!geo || rotAnim) return -1
    const r = canvas.getBoundingClientRect()
    const p = boardMatrix(s.rotation * 90).inverse().transformPoint(new DOMPoint(clientX - r.left, clientY - r.top))
    const x = Math.floor(p.x / geo.cell)
    const y = Math.floor(p.y / geo.cell)
    if (x < 0 || y < 0 || x >= level.width || y >= level.height) return -1
    return s.board.ownerAt(y * level.width + x)
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
    shots.push({ cells: level.arrows[id].cells, dir: local, arenaDir: r.arenaDir, hit: r.hit, t0: now })
    if (r.hit) {
      const hitTarget = targetsBefore.find((t) => t.side === r.arenaDir)
      if (hitTarget) {
        const fx = fxFor(targetKey(hitTarget))
        fx.hitT = now + 220 // shots already carry a ~220ms travel delay before impact
        // EXP-011/VS-001: only a genuine cast-interrupt gets the "CAST INTERRUPTED" burst -- the
        // legacy EXP-010 interruptOnHit reset (r.interrupted without r.castInterrupted) is unused
        // by any current content and isn't a cast, so it gets no burst text.
        if (r.castInterrupted) fx.interruptT = now + 220
      }
    }
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
      return s.enemies.map((e) => ({
        id: e.id, label: e.label, side: e.side, hp: e.hp, hpMax: e.hpMax, dead: e.dead,
        countdown: e.countdown, attackKind: e.attackKind, abilityCountdown: e.abilityCountdown,
        isBoss: false,
      }))
    }
    const side = s.bossSide
    if (side < 0) return []
    const phase = def.boss.phases[Math.min(s.phaseIndex, def.boss.phases.length - 1)]
    return [{
      id: def.boss.id, label: phase.label ?? def.boss.id, side, hp: s.hp, hpMax: s.totalHp, dead: s.won,
      countdown: s.countdownTurns, attackKind: s.attackKind, isBoss: true,
    }]
  }

  function frame(now, view) {
    const { s, def, level, assets, hint } = view
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
    shots = shots.filter((sh) => now - sh.t0 < 420)
    if (shots.length) animating = true
    for (const fx of targetFx.values()) {
      if (now - fx.hitT < 260 || now - fx.attackT < 320 || now - fx.interruptT < 700 || now - fx.deathT < 550) animating = true
    }
    for (const fx of arrowFx.values()) {
      if (now - fx.pinT < 500 || now - fx.unpinT < 550 || now - fx.deniedT < 320) animating = true
    }

    const dark = matchMedia('(prefers-color-scheme: dark)').matches
    const col = palette(dark)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = window.devicePixelRatio || 1
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
    drawBoardSurface(col)
    drawSideReadouts(col, s, def)
    layoutInfo = []
    boardBox = rotatedBoardBox(geo.cx, geo.cy, geo.w * geo.cell, geo.h * geo.cell, shownAngle)
    for (const t of targets) drawTarget(col, t, now)
    ctx.save()
    ctx.setTransform(new DOMMatrix().scale(dpr, dpr).multiply(boardMatrix(shownAngle)))
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
      const charW = size.w * cell
      const charH = size.h * cell
      const slot = podiumSlot(t.side, t.isBoss, g.stageW, g.stageH, cell)
      const idle = Math.sin(now / 900 + t.side * 1.7) * 1.6
      const shake = now - fx.hitT >= 0 && now - fx.hitT < 200 ? Math.sin((now - fx.hitT) / 16) * 3 : 0
      const lunge = now - fx.attackT >= 0 && now - fx.attackT < 320 ? Math.sin(((now - fx.attackT) / 320) * Math.PI) * 0.28 * g.cell : 0
      const deathT = now - fx.deathT
      const dying = t.dead && deathT >= 0 && deathT < 550
      const deathP = dying ? clamp01(deathT / 550) : t.dead ? 1 : 0
      if (t.dead && deathP >= 1 && !t.isBoss) return // fully dead regular enemy: slot stays empty

      const towardBoard = { x: -DX[t.side], y: -DY[t.side] }
      const ox = towardBoard.x * lunge + (t.side === 0 || t.side === 2 ? shake : 0)
      const oy = towardBoard.y * lunge + (t.side === 1 || t.side === 3 ? shake : 0) + idle

      ctx.save()
      ctx.globalAlpha = 1 - deathP
      ctx.translate(slot.x + ox, slot.y + oy)

      // Telegraph: a pulsing ground ellipse at the feet (urgency color), not a box ring --
      // the character itself is never framed. CAST and ATTACK stay visually distinct.
      if (Number.isFinite(t.countdown) && !t.dead) {
        const isCast = t.attackKind === 'cast'
        const urgency = t.countdown <= 1 ? 1 : t.countdown === 2 ? 0.55 : 0.3
        const cyc = (now / (520 - urgency * 260)) % 1
        ctx.save()
        if (isCast && assets.castGlow) {
          const s2 = charW * 1.1 * (1 + cyc * 0.3)
          ctx.globalAlpha = (1 - cyc) * 0.85 * urgency
          ctx.drawImage(assets.castGlow, -s2 / 2, charH / 2 - s2 / 2, s2, s2)
        } else {
          ctx.globalAlpha = (1 - cyc) * 0.6 * urgency + 0.08 * urgency
          ctx.strokeStyle = isCast ? col.cast : urgency >= 1 ? col.danger : col.aim
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.ellipse(0, charH / 2, charW * (0.55 + cyc * 0.25), Math.max(5, cell * 0.14) * (1 + cyc * 0.4), 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }

      // Ground shadow: soft ellipse at the feet, keeps the actor planted on the arena.
      ctx.save()
      ctx.globalAlpha = (1 - deathP * 0.5) * 1
      ctx.fillStyle = col.groundShadow
      ctx.beginPath()
      ctx.ellipse(0, charH / 2, charW * 0.42, Math.max(4, cell * 0.11), 0, 0, Math.PI * 2)
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
      const wolfPack = !t.isBoss ? view.wolf?.pack ?? null : null
      const wolfImg = wolfPack ? resolveWolfImage(wolfPack, wolfPose) : null
      const img = bossImg ?? wolfImg ?? resolveTargetImage(assets, t)
      const bossSince = t.isBoss && view.boss?.visual ? now - view.boss.visual.startedAt : -1e9
      const wolfSince = wolfVisual ? now - wolfVisual.startedAt : -1e9
      const flashWhite = (now - fx.hitT >= 0 && now - fx.hitT < 110) ||
        (bossPose === 'stunned' && bossSince >= 0 && bossSince < 130) ||
        (wolfPose === 'hit' && wolfSince >= 0 && wolfSince < 130)
      if (img) {
        if (bossImg) drawBossArt(img, bossPose, bossSince, t, charW, charH)
        else if (wolfImg) drawWolfArt(img, wolfPose, wolfSince, t, charW, charH)
        if (t.dead) {
          // Same alpha-masked tint as the hit-flash below -- a dead sprite darkens, it
          // doesn't grow a translucent box around its transparent edges.
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
      // Hit-flash: tint the sprite's own opaque pixels white, not a hard-edged box over
      // transparent art -- 'source-atop' masks the fill to whatever alpha the just-drawn
      // character art (or its fallback glow) already left in this rect, so on real art with
      // a non-rectangular silhouette the flash never reads as a floating translucent square.
      if (flashWhite) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(-charW / 2, -charH / 2, charW, charH)
        ctx.restore()
      }

      // VIS-007: HUD is a separate plate near the character -- same content (name / HP /
      // ATTACK-CAST / THROW lines + HP bar + countdown badge), positioned by the arena
      // layout OUTSIDE the sprite: above the head everywhere except the S slot (below the
      // feet), always away from the board. It never sizes or clips the character, and two
      // simultaneous targets (e.g. cp-e4's two enemies) can never draw over each other.
      // Layout, not z-index: nothing belonging to the HUD may overlap the board footprint.
      const fontPx = Math.max(10, Math.floor(g.cell * (t.isBoss ? 0.3 : 0.25)))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const lines = [
        { text: t.label ?? t.id, bold: true, color: col.text },
        { text: t.dead ? 'повержен' : `HP ${t.hp}/${t.hpMax}`, bold: false, color: t.dead ? col.muted : (t.hp / t.hpMax <= 0.25 ? col.danger : col.text) },
      ]
      const isCast = t.attackKind === 'cast'
      if (!t.dead && Number.isFinite(t.countdown)) {
        lines.push({ text: isCast ? `CAST IN ${t.countdown}` : `ATTACK IN ${t.countdown}`, bold: true, color: isCast ? col.cast : t.countdown <= 1 ? col.danger : col.text })
      }
      if (!t.dead && t.abilityCountdown !== undefined && Number.isFinite(t.abilityCountdown)) {
        lines.push({ text: `THROW IN ${t.abilityCountdown}`, bold: true, color: col.rock })
      }
      const lineH = fontPx * 1.15
      // VIS-007: the name/label line never stretches the plate beyond ~1.8 character
      // widths (a long boss phase label must not become a full-width bar) -- truncate
      // with an ellipsis. Numeric lines (HP/IN N) are never truncated.
      ctx.font = `700 ${fontPx}px system-ui`
      const labelMaxW = charW * 1.8
      if (ctx.measureText(lines[0].text).width > labelMaxW) {
        let label = lines[0].text
        while (label.length > 1 && ctx.measureText(`${label}…`).width > labelMaxW) {
          label = label.slice(0, -1)
        }
        lines[0].text = `${label}…`
      }
      let maxW = 0
      for (const ln of lines) {
        ctx.font = `${ln.bold ? 700 : 600} ${fontPx}px system-ui`
        maxW = Math.max(maxW, ctx.measureText(ln.text).width)
      }
      const barH = Math.max(5, g.cell * 0.16)
      const hud = hudBoxes({
        slot: { x: 0, y: 0 },
        char: { x: -charW / 2, y: -charH / 2, w: charW, h: charH },
        side: t.side, fontPx, lineH, lineCount: lines.length, barH, maxTextW: maxW, cell,
        slotAbsX: slot.x, boardCx: g.cx, boardHalfPx: g.half,
      })
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
        ctx.fillText(ln.text, 0, hud.lineY(i))
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
      // THROW IN badge (EXP-013): opposite plate corner from the attack badge, rock-brown,
      // independent countdown -- a target can carry both at once.
      if (!t.dead && t.abilityCountdown !== undefined && Number.isFinite(t.abilityCountdown)) {
        const r = hud.badge.r
        const bxo = hud.plate.x + r * 0.5
        const byo = hud.badge.y
        ctx.save()
        ctx.fillStyle = col.rock
        ctx.beginPath()
        ctx.arc(bxo, byo, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `800 ${Math.floor(r * 1.15)}px system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(t.abilityCountdown), bxo, byo + 1)
        ctx.restore()
      }

      // CAST INTERRUPTED burst, rising just above the head -- local coords again, so it always
      // reads next to its own target. Only fires for a real EXP-011 cast interrupt (see
      // onTapResult), never the legacy interruptOnHit reset.
      const sinceInterrupt = now - fx.interruptT
      if (sinceInterrupt >= 0 && sinceInterrupt < 700) {
        const p = sinceInterrupt / 700
        ctx.save()
        ctx.globalAlpha = 1 - p
        ctx.fillStyle = col.good
        ctx.font = `700 ${Math.max(10, Math.floor(g.cell * 0.24))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('CAST INTERRUPTED', 0, -charH / 2 - 10 - p * 12)
        ctx.restore()
      }

      // VIS-007: debug layout record in canvas coords, for automated checks (HUD clear of
      // board/sprite-face, characters unclipped, pose swaps anchored).
      const ax = slot.x + ox
      const ay = slot.y + oy
      const charR = { x: ax - charW / 2, y: ay - charH / 2, w: charW, h: charH }
      layoutInfo.push({
        key, side: t.side, isBoss: t.isBoss,
        char: charR,
        face: faceRect(charR),
        plate: { x: ax + hud.plate.x, y: ay + hud.plate.y, w: hud.plate.w, h: hud.plate.h },
        badge: { x: ax + hud.badge.x, y: ay + hud.badge.y },
        board: boardBox,
      })

      ctx.restore()
    }

    // VIS-005/VIS-007: anchored pose draw + presentation-only transforms. The character
    // footprint (bw/bh) comes from the arena layout; the PNG is contain-fitted and its
    // bottom-center (ground point) is locked to the footprint's bottom-center, so a pose
    // swap never moves the anchor or the visual size. All motion here is wall-clock
    // cosmetics -- simulation timers are untouched.
    function drawBossArt(img, pose, since, t, bw, bh) {
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      if (!iw || !ih) return
      const fit = Math.min(bw / iw, bh / ih)
      const dw = iw * fit
      const dh = ih * fit
      const off = BOSS_ANCHOR.offsets[pose] ?? { dx: 0, dy: 0 }
      const gx = off.dx * bw
      const gy = bh / 2 + off.dy * bh
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
    function drawWolfArt(img, pose, since, t, bw, bh) {
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      if (!iw || !ih) return
      const fit = Math.min(bw / iw, bh / ih)
      const dw = iw * fit
      const dh = ih * fit
      const off = ENEMY_ANCHOR.offsets[pose] ?? { dx: 0, dy: 0 }
      const gx = off.dx * bw
      const gy = bh / 2 + off.dy * bh
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
      }
      // defeat: static -- the death fade (globalAlpha 1-deathP) is the terminal hold/fade.
      return tr
    }

    function drawSideReadouts(col, s, def) {
      const g = geo
      const alive = s.aliveByArenaDir()
      const free = s.aliveByArenaDir(true)
      ctx.font = `600 ${Math.max(10, Math.floor(g.cell * 0.24))}px system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let d = 0; d < 4; d++) {
        const isLive = def.enemies ? s.enemies.some((e) => e.side === d && !e.dead) : d === s.bossSide
        if (isLive) continue // the target panel itself already shows this side clearly
        const r = g.half + BOSS_SLOT_DIST * g.cell + 1.05 * g.cell
        const x = g.cx + DX[d] * r
        const y = g.cy + DY[d] * r
        ctx.fillStyle = col.muted
        ctx.save()
        ctx.translate(x, y)
        if (d === 1 || d === 3) ctx.rotate(d === 1 ? Math.PI / 2 : -Math.PI / 2)
        ctx.fillText(`${alive[d]} (своб. ${free[d]})`, 0, 0)
        ctx.restore()
      }
    }

    function drawBoardSurface(col) {
      const g = geo
      ctx.save()
      ctx.setTransform(new DOMMatrix().scale(dpr, dpr).multiply(boardMatrix(shownAngle)))
      const pad = g.cell * 0.22
      ctx.save()
      ctx.shadowColor = col.boardGlow
      ctx.shadowBlur = 22
      const grad = ctx.createLinearGradient(0, -pad, 0, g.h * g.cell + pad)
      grad.addColorStop(0, col.boardTop)
      grad.addColorStop(1, col.boardBottom)
      ctx.fillStyle = grad
      roundRect(-pad, -pad, g.w * g.cell + pad * 2, g.h * g.cell + pad * 2, g.cell * 0.4)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = col.boardBorder
      ctx.lineWidth = 2
      roundRect(-pad, -pad, g.w * g.cell + pad * 2, g.h * g.cell + pad * 2, g.cell * 0.4)
      ctx.stroke()
      ctx.fillStyle = col.dot
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ctx.fillRect((x + 0.5) * g.cell - 1, (y + 0.5) * g.cell - 1, 2, 2)
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
      const aims = def.enemies ? s.enemies.some((e) => e.side === arena && !e.dead) : arena === s.bossSide
      const pts = a.cells.map(cellCenter)
      const lw = Math.max(3, geo.cell * 0.27)
      const isHint = hint && hint.kind === 'tap' && hint.id === a.id
      const isHover = a.id === hoverId
      const isBlocked = a.id === flash.blocked
      const isBlocker = a.id === flash.blocker
      const fx = arrowFxFor(a.id)
      const isDenied = now - fx.deniedT >= 0 && now - fx.deniedT < 320

      // Outer glow: strong + colored for a free/aimed arrow, rock-brown for a pinned one, faint for
      // a geometrically blocked one.
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowBlur = pinned ? 10 : free ? (aims ? 16 : 9) : 3
      ctx.shadowColor = pinned ? col.rockGlow : aims ? col.aimGlow : free ? col.freeGlow : col.mutedGlow
      ctx.strokeStyle = pinned ? col.rock : aims ? col.aim : free ? col.arrow : col.arrowDim
      ctx.globalAlpha = pinned ? 0.85 : free ? 1 : 0.55
      ctx.setLineDash(pinned ? [lw * 0.55, lw * 0.55] : free ? [] : [lw * 0.9, lw * 0.9])
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
      const sz = geo.cell * 0.42
      ctx.save()
      ctx.shadowBlur = pinned ? 6 : free ? 10 : 0
      ctx.shadowColor = pinned ? col.rockGlow : aims ? col.aimGlow : col.freeGlow
      ctx.fillStyle = pinned ? col.rock : aims ? col.aim : free ? col.arrow : col.arrowDim
      ctx.globalAlpha = pinned ? 0.85 : free ? 1 : 0.6
      ctx.beginPath()
      ctx.moveTo(hx + DX[d] * sz, hy + DY[d] * sz)
      ctx.lineTo(hx - DY[d] * sz * 0.82, hy + DX[d] * sz * 0.82)
      ctx.lineTo(hx + DY[d] * sz * 0.82, hy - DX[d] * sz * 0.82)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      drawPinFx(col, a, hx, hy, sz, pinned, s)
    }

    /** EXP-013/VS-001: rock marker + remaining-turns badge for the whole pin duration, plus the
     * three one-shot cues the brief asks for: a pop-in "ROCK THROWN" when the pin is created, a
     * green "UNPINNED" pulse when it expires, and a denied-tap "PINNED" popup (no HP shown lost --
     * there is none). Deliberately simple (an icon + text popup): no puppet/FX pipeline, per the
     * VS-001 brief. */
    function drawPinFx(col, a, hx, hy, sz, pinned, s) {
      const fx = arrowFxFor(a.id)
      const markerX = hx + DX[a.dir] * sz * 2.2
      const markerY = hy + DY[a.dir] * sz * 2.2

      if (pinned) {
        const turnsLeft = s.pinnedArrows.find((p) => p.id === a.id)?.turnsLeft ?? 0
        const sincePin = now - fx.pinT
        const pop = sincePin >= 0 && sincePin < 400 ? 1 + Math.sin(clamp01(sincePin / 400) * Math.PI) * 0.5 : 1
        ctx.save()
        ctx.translate(markerX, markerY)
        ctx.scale(pop, pop)
        const r = Math.max(9, geo.cell * 0.22)
        if (assets.rockProjectile) {
          ctx.drawImage(assets.rockProjectile, -r, -r, r * 2, r * 2)
        } else {
          ctx.font = `${Math.floor(r * 1.8)}px system-ui`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('\u{1FAA8}', 0, 0) // rock emoji placeholder
        }
        ctx.fillStyle = col.rock
        ctx.font = `700 ${Math.max(9, Math.floor(geo.cell * 0.24))}px system-ui`
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
        ctx.font = `700 ${Math.max(9, Math.floor(geo.cell * 0.22))}px system-ui`
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
        ctx.font = `700 ${Math.max(9, Math.floor(geo.cell * 0.22))}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('PINNED', hx, hy - sz * 2.4 - p * 8)
        ctx.restore()
      }
    }

    function drawShot(col, sh, now) {
      const t = clamp01((now - sh.t0) / 300)
      const [hx, hy] = cellCenter(sh.cells[sh.cells.length - 1])
      const dist = (Math.max(geo.w, geo.h) + 3.5) * geo.cell * t
      const x = hx + DX[sh.dir] * dist
      const y = hy + DY[sh.dir] * dist
      ctx.save()
      ctx.shadowBlur = 10
      ctx.shadowColor = sh.hit ? col.aimGlow : col.mutedGlow
      ctx.strokeStyle = sh.hit ? col.aim : col.arrowDim
      ctx.lineWidth = Math.max(3, geo.cell * 0.22)
      ctx.lineCap = 'round'
      ctx.globalAlpha = 1 - t * 0.5
      ctx.beginPath()
      ctx.moveTo(x - DX[sh.dir] * geo.cell * 1.1, y - DY[sh.dir] * geo.cell * 1.1)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.restore()
    }
  }

  function polyline(pts) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
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
      boardTop: dark ? '#2c2c31' : '#ffffff', boardBottom: dark ? '#1d1d20' : '#ece9e2',
      boardBorder: dark ? '#4a4a52' : '#c9c2b0', boardGlow: dark ? 'rgba(120,140,255,0.25)' : 'rgba(140,110,40,0.18)',
      dot: dark ? '#4a4a4f' : '#c9c9c6',
      arrow: dark ? '#a9a9b0' : '#8d8a80', arrowDim: dark ? '#55555a' : '#c4c4c0', aim: dark ? '#ffd76a' : '#b8791a',
      aimGlow: dark ? 'rgba(255,215,106,0.85)' : 'rgba(184,121,26,0.6)', freeGlow: dark ? 'rgba(200,200,220,0.55)' : 'rgba(120,110,90,0.35)', mutedGlow: 'rgba(0,0,0,0)',
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
    resize, hitTest, setHover, setFlash, onTapResult, onPinDenied, onRotateStart, onRotateEnemyAttack, markDeaths, resetFx, frame,
    get geo() { return geo },
    collectTargets,
    /** VIS-007: per-frame arena layout (canvas coords) for automated checks. */
    debugLayout() { return layoutInfo },
  }
}
