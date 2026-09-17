// ARENA-002: data-only manifest of the prologue / Act I arena candidate pack.
//
// Curation, not approval: nothing here is user-accepted final art. This module carries
// NO loader and NO background switching -- the production background stays
// 'assets/arena-moonlit-fortress.png' (see assets.js). A future integration task decides
// what, if anything, gets wired in. Supplements (does not replace) ARENA-001
// ('./arena-candidates.js'); Act I entries `act1-fel-skull-ref` and
// `act1-goblin-jungle-ref` point at files that already live in
// 'assets/arenas/candidates/' and are NOT re-copied here.
//
// Coords are normalized image fractions, approximate (+-0.03, estimated by eye off
// 10%-grid overlays). `boardPlane` = TL/TR/BR/BL of the painted board slab.
// `anchors` = TOP boss spot, LEFT-W / RIGHT-E side spots (stair platforms).
// `bossSpace` = free setback behind the top rail for a boss visual (fractions of
// image height). Grids were counted per-file on source pixels (see
// docs/ARENA-002-PROLOGUE-ACT1-PACK.md); the 03_58 batch (6x5) and 04_06 batch
// (5x6) were measured non-square and excluded.
export const ARENA_PACK_002_BASE = 'assets/arenas/prologue-act1/'

export const ARENA_PACK_002 = [
  {
    id: 'prologue-violet-arch',
    file: '5x5.png',
    theme: 'moonlit violet arch ruins',
    nominalSize: 5,
    bakedGrid: { cols: 5, rows: 5 },
    boardSizeLocked: 5,
    boardSizeFlexible: false,
    slot: 'prologue',
    boardPlane: { tl: { x: 0.24, y: 0.3 }, tr: { x: 0.76, y: 0.3 }, br: { x: 0.84, y: 0.78 }, bl: { x: 0.16, y: 0.78 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.08, y: 0.55 }, right: { x: 0.92, y: 0.55 } },
    bossSpace: 'arch recess y 0.12-0.30, moderate',
    risks: 'same filename as ARENA-001 violet-ruins but NEW art (stair composition); most monochrome well, arrow palette must carry readability',
  },
  {
    id: 'prologue-emerald',
    file: '5x5 (2).png',
    theme: 'emerald forest ruins',
    nominalSize: 5,
    bakedGrid: { cols: 5, rows: 5 },
    boardSizeLocked: 5,
    boardSizeFlexible: false,
    slot: 'prologue',
    boardPlane: { tl: { x: 0.26, y: 0.3 }, tr: { x: 0.74, y: 0.3 }, br: { x: 0.82, y: 0.78 }, bl: { x: 0.18, y: 0.78 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.08, y: 0.55 }, right: { x: 0.92, y: 0.55 } },
    bossSpace: 'arch recess y 0.12-0.30, moderate',
    risks: 'brightest prologue well; green banners flank the top rail at eye level',
  },
  {
    id: 'prologue-inferno',
    file: '5x5 (3).png',
    theme: 'inferno ember ruins',
    nominalSize: 5,
    bakedGrid: { cols: 5, rows: 5 },
    boardSizeLocked: 5,
    boardSizeFlexible: false,
    slot: 'prologue',
    boardPlane: { tl: { x: 0.27, y: 0.28 }, tr: { x: 0.73, y: 0.28 }, br: { x: 0.82, y: 0.78 }, bl: { x: 0.18, y: 0.78 } },
    anchors: { top: { x: 0.5, y: 0.1 }, left: { x: 0.08, y: 0.55 }, right: { x: 0.92, y: 0.55 } },
    bossSpace: 'arch recess y 0.10-0.28, moderate',
    risks: 'highest-saturation prologue background; lava glow spills near bottom rail',
  },
  {
    id: 'prologue-frost',
    file: '5x5 (4).png',
    theme: 'frost crystal ruins',
    nominalSize: 5,
    bakedGrid: { cols: 5, rows: 5 },
    boardSizeLocked: 5,
    boardSizeFlexible: false,
    slot: 'prologue',
    boardPlane: { tl: { x: 0.25, y: 0.36 }, tr: { x: 0.75, y: 0.36 }, br: { x: 0.83, y: 0.8 }, bl: { x: 0.17, y: 0.8 } },
    anchors: { top: { x: 0.5, y: 0.14 }, left: { x: 0.08, y: 0.58 }, right: { x: 0.92, y: 0.58 } },
    bossSpace: 'arch recess y 0.14-0.36, moderate',
    risks: 'blue arrows may lose contrast on the blue-grey well; snow sparkle at rails',
  },
  {
    id: 'boss-orc-ironworks',
    file: '6x6 (3).png',
    theme: 'orc ironworks forge',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'prologue-boss',
    boardPlane: { tl: { x: 0.24, y: 0.38 }, tr: { x: 0.76, y: 0.38 }, br: { x: 0.85, y: 0.84 }, bl: { x: 0.15, y: 0.84 } },
    anchors: { top: { x: 0.5, y: 0.16 }, left: { x: 0.06, y: 0.6 }, right: { x: 0.94, y: 0.6 } },
    bossSpace: 'deep forge arch behind top rail (y 0.16-0.38) with central skull medallion; good',
    risks: 'busiest top rail (gear medallions); warm glare near bottom rail',
  },
  {
    id: 'boss-shadow-moon',
    file: '6x6-5.png',
    theme: 'shadow-moon cathedral',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'prologue-boss',
    boardPlane: { tl: { x: 0.24, y: 0.4 }, tr: { x: 0.76, y: 0.4 }, br: { x: 0.85, y: 0.82 }, bl: { x: 0.15, y: 0.82 } },
    anchors: { top: { x: 0.5, y: 0.16 }, left: { x: 0.06, y: 0.58 }, right: { x: 0.94, y: 0.58 } },
    bossSpace: 'moonlit arch + statues behind top rail (y 0.16-0.40); good',
    risks: 'candles + angel statues crowd the top corners; cool palette, check warm-arrow contrast',
  },
  {
    id: 'act1-swamp-skulls',
    file: '6x6 (6).png',
    theme: 'goblin swamp outpost',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'act1-goblin',
    boardPlane: { tl: { x: 0.24, y: 0.4 }, tr: { x: 0.76, y: 0.4 }, br: { x: 0.85, y: 0.82 }, bl: { x: 0.15, y: 0.82 } },
    anchors: { top: { x: 0.5, y: 0.16 }, left: { x: 0.06, y: 0.6 }, right: { x: 0.94, y: 0.6 } },
    bossSpace: 'open moonlit lake behind top rail (y 0.16-0.40); good',
    risks: 'green wisps + war banners near side rails; brightest goblin well',
  },
  {
    id: 'act1-crystal-cavern',
    file: '6x6 (5).png',
    theme: 'goblin crystal cavern',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'act1-goblin',
    boardPlane: { tl: { x: 0.24, y: 0.42 }, tr: { x: 0.76, y: 0.42 }, br: { x: 0.85, y: 0.84 }, bl: { x: 0.15, y: 0.84 } },
    anchors: { top: { x: 0.5, y: 0.18 }, left: { x: 0.06, y: 0.62 }, right: { x: 0.94, y: 0.62 } },
    bossSpace: 'cavern bridge behind top rail (y 0.18-0.42), partially busy; moderate',
    risks: 'narrowest top clearance of the pack; glowing mushrooms compete at side rails',
  },
  {
    id: 'act1-fel-skull-ref',
    file: '6x6 (2).png',
    theme: 'fel skull fortress (reuse)',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'act1-goblin',
    reuseFrom: '../candidates/',
    boardPlane: { tl: { x: 0.29, y: 0.34 }, tr: { x: 0.71, y: 0.34 }, br: { x: 0.81, y: 0.84 }, bl: { x: 0.19, y: 0.84 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.09, y: 0.55 }, right: { x: 0.91, y: 0.55 } },
    bossSpace: 'fortress gate behind top rail; good (per ARENA-001)',
    risks: 'already curated in ARENA-001; listed here to complete the Act I set without re-copy',
  },
  {
    id: 'act1-goblin-jungle-ref',
    file: '6x6 (4).png',
    theme: 'goblin jungle outpost (reuse)',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    slot: 'act1-goblin',
    reuseFrom: '../candidates/',
    boardPlane: { tl: { x: 0.3, y: 0.36 }, tr: { x: 0.7, y: 0.36 }, br: { x: 0.8, y: 0.82 }, bl: { x: 0.2, y: 0.82 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.09, y: 0.55 }, right: { x: 0.91, y: 0.55 } },
    bossSpace: 'palisade gate behind top rail; good (per ARENA-001)',
    risks: 'already curated in ARENA-001; listed here to complete the Act I set without re-copy',
  },
]

/** Look up a pack entry by id; returns null for unknown ids (never throws). */
export function getArenaPack002(id) {
  return ARENA_PACK_002.find((c) => c.id === id) || null
}
