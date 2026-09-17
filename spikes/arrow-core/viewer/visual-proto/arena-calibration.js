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
      top: { x: 0.5, y: 0.155 },
      left: { x: 0.17, y: 0.62 },
      right: { x: 0.83, y: 0.62 },
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
  },
}

/** Look up a calibration entry by id; returns null for unknown ids (never throws). */
export function getArenaCalibration(id) {
  return ARENA_CALIBRATIONS[id] ?? null
}
