// FIX-023: per-arena calibration for TRUE baked-grid arenas (ARENA-002 pack). Unlike
// PLANE_CORNERS_FRAC in board-plane.js (a flexible dais with NO baked grid, calibrated once by
// eye for a generous stone margin), these corners are measured pixel positions of the actual
// painted tile grid's outer edge in each arena's art -- gradient-edge-detected off the source PNG
// (luminance derivative peaks along scanlines, several rows/cols, linear-fit through the cleanest
// samples), then refined by eye against the in-app debug grid-line overlay (see board-renderer.js
// `debug` mode) until projected lines visually sit on the baked lines. `margin: 0` on every entry
// here is deliberate: the quad below already IS the tile grid's outer edge, not a looser dais
// footprint, so fitGrid() must fill it corner-to-corner for cell-to-cell alignment.
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
  'prologue-5x5-good': {
    id: 'prologue-5x5-good',
    background: 'assets/arenas/prologue-act1/5x5-good.png',
    boardSizeLocked: 5,
    boardPlaneFrac: {
      tl: [0.333, 0.367], tr: [0.665, 0.367], br: [0.717, 0.820], bl: [0.282, 0.820],
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
    // (1.778) -- .bg-layer's `background-size: cover` therefore scales it to the stage WIDTH and
    // crops ~3.1% off the top and bottom equally (centered), stretching the *visible* vertical
    // range by a ~1.066 factor relative to raw image-pixel fractions. These y values are already
    // that cover-fit correction applied to the measured image-pixel corners (578,365)/(1130,365)/
    // (1110,764)/(390,764) -- see docs/FIX-023-GRID-CALIBRATED-BOARD.md's derivation. Using raw
    // imgY/imgH fractions here (as if background-size were `contain`) would misplace the plane by
    // several percent of stage height, most visible on this 6:6 arena.
    boardPlaneFrac: {
      tl: [0.357, 0.368], tr: [0.698, 0.368], br: [0.686, 0.806], bl: [0.241, 0.806],
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
