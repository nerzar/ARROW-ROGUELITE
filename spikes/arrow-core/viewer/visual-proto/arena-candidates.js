// ARENA-001: data-only manifest of the 7 curated runtime arena candidates.
//
// Curation, not approval: nothing here is user-accepted final art. This module carries
// NO loader and NO background switching -- the production background stays
// 'assets/arena-moonlit-fortress.png' (see assets.js). A future integration task decides
// what, if anything, gets wired in.
//
// Coords are normalized image fractions, approximate (+-0.03, estimated by eye).
// `boardPlane` = TL/TR/BR/BL of the painted board slab. `anchors` = TOP boss spot,
// LEFT-W / RIGHT-E side spots. Full per-candidate notes: docs/ARENA-001-RUNTIME-CANDIDATES.md.
export const ARENA_CANDIDATE_BASE = 'assets/arenas/candidates/'

export const ARENA_CANDIDATES = [
  {
    id: 'goblin-jungle',
    file: '6x6 (4).png',
    theme: 'goblin jungle outpost',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    boardPlane: { tl: { x: 0.3, y: 0.36 }, tr: { x: 0.7, y: 0.36 }, br: { x: 0.8, y: 0.82 }, bl: { x: 0.2, y: 0.82 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.09, y: 0.55 }, right: { x: 0.91, y: 0.55 } },
    risks: 'busy side foliage; skull shields close to board rails',
  },
  {
    id: 'fel-skull',
    file: '6x6 (2).png',
    theme: 'fel skull fortress',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    boardPlane: { tl: { x: 0.29, y: 0.34 }, tr: { x: 0.71, y: 0.34 }, br: { x: 0.81, y: 0.84 }, bl: { x: 0.19, y: 0.84 } },
    anchors: { top: { x: 0.5, y: 0.12 }, left: { x: 0.09, y: 0.55 }, right: { x: 0.91, y: 0.55 } },
    risks: 'darkest well of the pack; check arrow contrast; green fire tints board edges',
  },
  {
    id: 'inferno',
    file: '6x6-2.png',
    theme: 'inferno lava citadel',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    boardPlane: { tl: { x: 0.28, y: 0.32 }, tr: { x: 0.72, y: 0.32 }, br: { x: 0.82, y: 0.86 }, bl: { x: 0.18, y: 0.86 } },
    anchors: { top: { x: 0.5, y: 0.11 }, left: { x: 0.09, y: 0.56 }, right: { x: 0.91, y: 0.56 } },
    risks: 'highest-saturation background; glare near bottom rails; warm cast over well',
  },
  {
    id: 'frost',
    file: '6x6-3.png',
    theme: 'frost aurora citadel',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    boardPlane: { tl: { x: 0.28, y: 0.33 }, tr: { x: 0.72, y: 0.33 }, br: { x: 0.82, y: 0.85 }, bl: { x: 0.18, y: 0.85 } },
    anchors: { top: { x: 0.5, y: 0.11 }, left: { x: 0.09, y: 0.56 }, right: { x: 0.91, y: 0.56 } },
    risks: 'blue arrows may lose contrast on blue marble; snow sparkle noise at rails',
  },
  {
    id: 'ocean-pearl',
    file: '6x6-4.png',
    theme: 'ocean pearl reef',
    nominalSize: 6,
    bakedGrid: { cols: 6, rows: 6 },
    boardSizeLocked: 6,
    boardSizeFlexible: false,
    boardPlane: { tl: { x: 0.26, y: 0.3 }, tr: { x: 0.74, y: 0.3 }, br: { x: 0.85, y: 0.88 }, bl: { x: 0.15, y: 0.88 } },
    anchors: { top: { x: 0.5, y: 0.1 }, left: { x: 0.07, y: 0.55 }, right: { x: 0.93, y: 0.55 } },
    risks: 'only daylight candidate (mood break); shell ornaments overlap side rails',
  },
  {
    id: 'violet-ruins',
    file: '5x5.png',
    theme: 'moonlit violet ruins',
    nominalSize: 5,
    bakedGrid: { cols: 5, rows: 5 },
    boardSizeLocked: 5,
    boardSizeFlexible: false,
    tutorialOnly: true,
    boardPlane: { tl: { x: 0.31, y: 0.36 }, tr: { x: 0.69, y: 0.36 }, br: { x: 0.78, y: 0.83 }, bl: { x: 0.22, y: 0.83 } },
    anchors: { top: { x: 0.5, y: 0.13 }, left: { x: 0.1, y: 0.56 }, right: { x: 0.9, y: 0.56 } },
    risks: 'locked to 5x5 art, unusable for 6x6+ without rework; does NOT declare 5x5 production policy',
  },
  {
    id: 'waterfall-well',
    file: 'na.png',
    theme: 'waterfall fortress courtyard',
    nominalSize: null,
    bakedGrid: null,
    boardSizeLocked: null,
    boardSizeFlexible: true,
    boardPlane: { tl: { x: 0.22, y: 0.28 }, tr: { x: 0.78, y: 0.28 }, br: { x: 0.88, y: 0.95 }, bl: { x: 0.12, y: 0.95 } },
    anchors: { top: { x: 0.5, y: 0.1 }, left: { x: 0.1, y: 0.6 }, right: { x: 0.9, y: 0.6 } },
    risks: 'irregular sloped stones, no natural cell alignment; needs projected overlay',
  },
]

/** Look up a candidate by id; returns null for unknown ids (never throws). */
export function getArenaCandidate(id) {
  return ARENA_CANDIDATES.find((c) => c.id === id) || null
}
