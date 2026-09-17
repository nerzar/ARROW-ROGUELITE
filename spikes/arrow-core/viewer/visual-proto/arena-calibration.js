// FIX-023: per-arena calibration for TRUE baked-grid arenas (ARENA-002 pack). Unlike
// PLANE_CORNERS_FRAC in board-plane.js (a flexible dais with NO baked grid, calibrated once by
// eye for a generous stone margin), these corners must sit precisely on the actual painted tile
// grid's outer edge. `margin: 0` on every entry here is deliberate: the quad below already IS
// the tile grid's outer edge, not a looser dais footprint, so fitGrid() must fill it
// corner-to-corner for cell-to-cell alignment.
//
// Source-PNG gradient-edge detection (luminance derivative peaks along scanlines) was tried
// first and looked plausible in isolation, but produced a visibly wrong `boss-shadow-moon` quad
// (~60-70px off in stage space) -- this art's frame border is itself densely decorated (corner
// gem studs, skull medallions, inline diamonds along every edge), so a plain gradient/variance
// scan repeatedly locked onto a decoration's edge instead of the true frame/tile boundary,
// confidently and wrong. Screenshot-based correction (project the quad, screenshot it over the
// art, read the pixel offset against the baked corners, adjust) got close but still visibly off
// by a human eye's judgment. What actually nailed it: the user hand-tuned `prologue-5x5-good`'s
// boardPlaneFrac directly against the live debug grid-mesh overlay in the browser and confirmed
// it -- see that entry below, now the accepted base calibration for this pipeline.
//
// `anchors` are per-arena actor foot-baseline points (normalized stage fractions, same contract
// as arena-layout.js's PODIUM_GROUND) -- TOP/LEFT/RIGHT stair platforms as painted in this
// specific piece of art. They are NOT the old Moonlit Fortress PODIUM_GROUND numbers, which were
// calibrated for a different background image and would float on this one.
//
// CAL-001: `effectAnchors` is the same TOP/LEFT/RIGHT shape but for the VFX/telegraph ground
// point (arena-layout.js's EFFECT_GROUND contract) -- independent of `anchors` so a cast-glow/
// telegraph anchor can sit on a podium's flat top while the actor's own feet stay at the lip,
// without one move dragging the other.
//
// CAL-002: `actorScale` is presentation-only scale for TOP/LEFT/RIGHT actors (1.0 = base size).
// Decouples actor pixel size from board grid dimensions (level.width/height, cell size, grid
// selector), keeping mobs stable across 5x5, 6x6, 8x8, 10x10.
//
// PLAYTEST-002: `spritePivot` is a per-side (top/left/right) {dx, dy} correction, in fractions of
// the character's own footprint box, ADDED on top of the pose-level offset every asset's own
// ANCHOR.offsets already provides (enemy-visual-state.js's ENEMY_ANCHOR / boss-visual-state.js's
// BOSS_ANCHOR). It exists because a sprite's *visible* silhouette (e.g. Dire Wolf's paws) is not
// always flush with the bottom edge of its source PNG's bounding box -- transparent padding below
// the visible art means anchorY=1.0 (bottom-of-bbox) plants the ground shadow well below the
// actual paws, so the character reads as floating above its own shadow. A positive dy nudges the
// drawn image DOWN (toward the ground point) until the visible feet meet the shadow; dx corrects
// any similar horizontal padding asymmetry. Default {dx:0, dy:0} (no correction) for every side/
// arena unless tuned -- see getArenaCalibration's merge and calibration-editor.js's pivot rows.
export const ARENA_CALIBRATIONS = {
  // FIX-023: user-approved 5x5 prologue candidate (magicarrowassets/arenas/5x5-good.png,
  // explicitly named "good" by the architect -- superseded the unnamed ARENA-002
  // prologue-violet-arch candidate this task started calibrating against). Same 1672x941
  // resolution and near-exact-16:9 aspect as that candidate (negligible background-size:cover
  // crop, unlike boss-shadow-moon below), so no cover-fit correction is needed here.
  //
  // BASE CALIBRATION (user-confirmed, 2026-09-17): boardPlaneFrac below was hand-tuned by the
  // user directly in the browser (debug grid-mesh overlay vs. the baked art) after this task's
  // own automated + screenshot-corrected passes were still visibly off. Confirmed accepted --
  // treat `prologue-5x5-good` as the reference/base baked-grid calibration for this pipeline
  // going forward; any future arena calibration should be checked against how close it reads to
  // this one before being trusted.
  'prologue-5x5-good': {
    id: 'prologue-5x5-good',
    background: 'assets/arenas/prologue-act1/5x5-good.png',
    boardSizeLocked: 5,
    boardPlaneFrac: {
      tl: [0.37, 0.45], tr: [0.63, 0.45], br: [0.655, 0.818], bl: [0.348, 0.820],
    },
    // FIX-023: left/right x kept inside +-(0.5 - SIDE_CHAR.w/2/stageCols) of center so the
    // (large, ~6-cell) side sprite never clips off the canvas edge -- 0.1/0.9 first tried here
    // pushed roughly half the sprite past x=0/x=stageW; see boss-shadow-moon's comment for the
    // measured clipping check that caught it.
    anchors: {
      // PLAYTEST-002: top.y raised from 0.155 to 0.43 -- at 0.155 the boss's own footprint
      // (BOSS_CHAR.h = 6.9 cells, ~60% of stage height at this arena's actorBaseCellFrac) put the
      // sprite's head and shoulders entirely above the visible stage, clipped by the fixed topbar
      // (only the boots showed, hanging from the header -- reported in playtest as "floating
      // boots"). 0.43 plants the boss's feet just above the board's own top edge instead of on the
      // distant back platform the un-scaled anchor pointed at; actorScale.top below shrinks the
      // sprite enough that its head clears the topbar with margin at both 1920x1080 (char top
      // ~106px) and 1366x768 (char top ~24px past the topbar) -- verified via visualDebug.layout().
      top: { x: 0.5, y: 0.43 },
      left: { x: 0.17, y: 0.62 },
      right: { x: 0.83, y: 0.62 },
    },
    effectAnchors: {
      // PLAYTEST-002: kept a fixed offset above the actor anchor (same pattern as left/right's
      // anchors.y 0.62 vs effectAnchors.y 0.56 -- the telegraph anchor sits on the podium's flat
      // top, the actor's own feet at the lip) instead of the old fixed 0.155, which pointed at the
      // distant back platform the boss's feet no longer stand on.
      top: { x: 0.5, y: 0.37 },
      left: { x: 0.17, y: 0.62 },
      right: { x: 0.83, y: 0.62 },
    },
    actorScale: {
      // PLAYTEST-002: 0.55 -- see the anchors.top comment. A full 1.0 boss at this podium's
      // available headroom always clips the topbar on this specific background crop.
      top: 0.55,
      left: 1.0,
      right: 1.0,
    },
    spritePivot: {
      // PLAYTEST-002: the Dire Wolf's own transparent-padding correction now lives at the asset
      // level (enemy-visual-state.js's ENEMY_ANCHOR.offsets, measured per-pose from the source
      // PNGs) since it's a property of the asset, not this specific arena -- see that file's
      // comment. No arena-specific correction is needed on top of it here; tune per-side if this
      // arena's own anchor placement still looks off once the base fix is in.
      top: { dx: 0, dy: 0 },
      left: { dx: 0, dy: 0 },
      right: { dx: 0, dy: 0 },
    },
  },
  'boss-shadow-moon': {
    id: 'boss-shadow-moon',
    background: 'assets/arenas/prologue-act1/6x6-5.png',
    boardSizeLocked: 6,
    // FIX-023: this PNG is 1619x971 (aspect 1.667), noticeably off the stage's forced 16:9
    // (1.778) -- .bg-layer's `background-size: cover` scales it to the stage width and crops
    // the top/bottom, which is exactly why these values were calibrated directly in STAGE space
    // (via the debug-overlay screenshot method above) rather than measured on the source PNG and
    // hand-converted through the cover-fit math -- that conversion is real but easy to get subtly
    // wrong, and stage-space calibration sidesteps it entirely by construction.
    boardPlaneFrac: {
      tl: [0.3, 0.329], tr: [0.621, 0.329], br: [0.6875, 0.711], bl: [0.2125, 0.711],
    },
    // FIX-023: x=0.09/0.91 first tried here -- measured via debugLayout(), the (~6-cell, 313px
    // at 960 stage width) side sprite's char rect spanned x 717..1030 at x=0.91, clipping ~70px
    // off the right edge of a 960px-wide canvas (and symmetrically at 0.09 on the left). 0.17/0.83
    // keeps the full sprite on stage while still standing on the stair steps flanking the board.
    anchors: {
      top: { x: 0.5, y: 0.155 },
      left: { x: 0.17, y: 0.6 },
      right: { x: 0.83, y: 0.6 },
    },
    effectAnchors: {
      top: { x: 0.5, y: 0.155 },
      left: { x: 0.17, y: 0.6 },
      right: { x: 0.83, y: 0.6 },
    },
    actorScale: {
      // PLAYTEST-002: same headroom problem as prologue-5x5-good's anchors.top comment -- this
      // debug-only arena (loadBakedArenaDebug) never got a matching fix since it's off the normal
      // Prologue path, but a 1.0 boss here clips the topbar too.
      top: 0.55,
      left: 1.0,
      right: 1.0,
    },
    spritePivot: {
      top: { dx: 0, dy: 0 },
      left: { dx: 0, dy: 0.08 },
      right: { dx: 0, dy: 0.08 },
    },
  },
}

const STORAGE_PREFIX = 'arena_calibration_override_'

/** Look up a calibration entry by id; returns null for unknown ids (never throws).
 * In a browser environment, merges any user-saved tuning override from localStorage. */
export function getArenaCalibration(id) {
  let c = ARENA_CALIBRATIONS[id]
  if (!c) return null
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          c = {
            ...c,
            ...parsed,
            boardPlaneFrac: { ...c.boardPlaneFrac, ...(parsed.boardPlaneFrac ?? {}) },
            anchors: { ...c.anchors, ...(parsed.anchors ?? {}) },
            effectAnchors: { ...c.effectAnchors, ...(parsed.effectAnchors ?? {}) },
            actorScale: { ...c.actorScale, ...(parsed.actorScale ?? {}) },
            spritePivot: {
              top: { ...c.spritePivot?.top, ...(parsed.spritePivot?.top ?? {}) },
              left: { ...c.spritePivot?.left, ...(parsed.spritePivot?.left ?? {}) },
              right: { ...c.spritePivot?.right, ...(parsed.spritePivot?.right ?? {}) },
            },
          }
        }
      }
    } catch {}
  }
  return {
    ...c,
    actorScale: {
      top: c.actorScale?.top ?? 1.0,
      left: c.actorScale?.left ?? 1.0,
      right: c.actorScale?.right ?? 1.0,
    },
    // PLAYTEST-002: sprite pivot/foot-offset correction, independent of ground anchor position and
    // actor scale -- see the ARENA_CALIBRATIONS comment above. Defaults to no correction.
    spritePivot: {
      top: { dx: c.spritePivot?.top?.dx ?? 0, dy: c.spritePivot?.top?.dy ?? 0 },
      left: { dx: c.spritePivot?.left?.dx ?? 0, dy: c.spritePivot?.left?.dy ?? 0 },
      right: { dx: c.spritePivot?.right?.dx ?? 0, dy: c.spritePivot?.right?.dy ?? 0 },
    },
  }
}

/** Save user-tuned calibration override to browser localStorage. */
export function saveArenaCalibrationOverride(id, calibration) {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(calibration))
    return true
  } catch {
    return false
  }
}

/** Clear user-tuned calibration override from browser localStorage. */
export function clearArenaCalibrationOverride(id) {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
    return true
  } catch {
    return false
  }
}

/** Check if an active calibration override exists in browser localStorage. */
export function hasArenaCalibrationOverride(id) {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) !== null
  } catch {
    return false
  }
}

/**
 * BUILD-024: Resolves an arena presentation metadata block (from EncounterDef, EncounterFile,
 * or scene) to its full calibration entry. Returns null if presentation is absent or no calibration matches.
 */
export function resolveArenaPresentation(presentation) {
  if (!presentation || typeof presentation !== 'object') return null
  const id = presentation.calibration ?? presentation.arena
  if (!id || typeof id !== 'string') return null
  return getArenaCalibration(id)
}

