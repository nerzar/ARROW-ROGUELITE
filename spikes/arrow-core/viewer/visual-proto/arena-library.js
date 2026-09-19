// LD-007: arena library — all generated arenas from magicarrowassets/arenas/ (36 unique images,
// duplicates and the 8 already-imported ones skipped), stored as JPEG q92 in
// assets/arenas/library/ to keep the repo from growing by ~110 MB of PNG (swap to PNG if the
// user wants lossless). Each entry is a normal ARENA_CATALOG entry (selectable in the Campaign
// Editor's arena picker) with an embedded `defaultCalibration` (read by campaign-model.js's
// getArenaBaseline) copied from one of two proven templates:
//   - podium: the three-podium composition (imported goblinas-na-approved numbers);
//   - dais:   the plain dais composition (prologue-5x5-good numbers).
// All source images are 1672x941 = 16:9, so stage-space and image-space fractions coincide and
// the templates land within a cell or two; fine-tune per arena in the calibration editor when
// an arena is actually assigned to a stage (goblin-camp-podium below was tuned by hand).

const PODIUM_TEMPLATE = {
  boardPlaneFrac: { tl: [0.3548, 0.4182], tr: [0.646, 0.4182], br: [0.6855, 0.8036], bl: [0.3129, 0.8036] },
  anchors: { top: { x: 0.5028, y: 0.3045 }, left: { x: 0.146, y: 0.4436 }, right: { x: 0.854, y: 0.4337 } },
  effectAnchors: { top: { x: 0.502, y: 0.3159 }, left: { x: 0.127, y: 0.4576 }, right: { x: 0.8627, y: 0.4604 } },
  actorScale: { top: 1, left: 1, right: 1 },
  spritePivot: { top: { dx: 0, dy: 0 }, left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } },
}

const DAIS_TEMPLATE = {
  boardPlaneFrac: { tl: [0.37, 0.45], tr: [0.63, 0.45], br: [0.655, 0.818], bl: [0.348, 0.82] },
  anchors: { top: { x: 0.5, y: 0.357 }, left: { x: 0.17, y: 0.62 }, right: { x: 0.83, y: 0.62 } },
  effectAnchors: { top: { x: 0.5, y: 0.37 }, left: { x: 0.17, y: 0.62 }, right: { x: 0.83, y: 0.62 } },
  actorScale: { top: 1, left: 1, right: 1 },
  spritePivot: { top: { dx: 0, dy: 0 }, left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } },
}

/** Hand-tuned overrides for library arenas that are actually used by a stage. */
const TUNED = {
  // Act I · 6 Капитан стражи. Measured on a 5% grid overlay of the source image.
  'goblin-camp-podium': {
    boardPlaneFrac: { tl: [0.356, 0.42], tr: [0.646, 0.42], br: [0.677, 0.815], bl: [0.324, 0.815] },
    anchors: { top: { x: 0.5, y: 0.31 }, left: { x: 0.145, y: 0.45 }, right: { x: 0.855, y: 0.45 } },
    effectAnchors: { top: { x: 0.5, y: 0.32 }, left: { x: 0.13, y: 0.46 }, right: { x: 0.87, y: 0.46 } },
  },
}

const LIBRARY = [
  { id: 'elven-grove', label: 'Elven Grove (green, dais)', kind: 'dais' },
  { id: 'lava-citadel', label: 'Lava Citadel (dais)', kind: 'dais' },
  { id: 'frost-falls', label: 'Frost Falls (dais)', kind: 'dais' },
  { id: 'autumn-ruins', label: 'Autumn Ruins (dais)', kind: 'dais' },
  { id: 'moonlit-shrine', label: 'Moonlit Shrine (purple, dais)', kind: 'dais' },
  { id: 'goblin-warcamp-cliffs', label: 'Goblin Warcamp Cliffs (dais)', kind: 'dais' },
  { id: 'plague-fortress', label: 'Plague Fortress (green fire, dais)', kind: 'dais' },
  { id: 'hanging-gardens', label: 'Hanging Gardens (dais)', kind: 'dais' },
  { id: 'fungal-cavern', label: 'Fungal Cavern (cyan, dais)', kind: 'dais' },
  { id: 'swamp-moon', label: 'Swamp Moon (dais)', kind: 'dais' },
  { id: 'inferno-keep', label: 'Inferno Keep (dais)', kind: 'dais' },
  { id: 'aurora-ice', label: 'Aurora Ice (dais)', kind: 'dais' },
  { id: 'coral-palace', label: 'Coral Palace (dais)', kind: 'dais' },
  { id: 'sunset-cathedral', label: 'Sunset Cathedral (dais)', kind: 'dais' },
  { id: 'moon-sanctum', label: 'Moon Sanctum (blue, dais)', kind: 'dais' },
  { id: 'jungle-temple', label: 'Jungle Temple (dais)', kind: 'dais' },
  { id: 'desert-pyramids', label: 'Desert Pyramids (dais)', kind: 'dais' },
  { id: 'glacier-hall', label: 'Glacier Hall (dais)', kind: 'dais' },
  { id: 'crystal-cavern', label: 'Crystal Cavern (dais)', kind: 'dais' },
  { id: 'celestial-court', label: 'Celestial Court (dais)', kind: 'dais' },
  { id: 'night-ruins', label: 'Night Ruins (dais)', kind: 'dais' },
  { id: 'goblin-arena-dusk', label: 'Goblin Arena Dusk (podiums)', kind: 'podium' },
  { id: 'goblin-arena-bridge', label: 'Goblin Arena Bridge (podiums)', kind: 'podium' },
  { id: 'goblin-arena-hills', label: 'Goblin Arena Hills (podiums)', kind: 'podium' },
  { id: 'moon-podium-shrine', label: 'Moon Podium Shrine (podiums)', kind: 'podium' },
  { id: 'goblin-fortress-banners', label: 'Goblin Fortress Banners (podiums)', kind: 'podium' },
  { id: 'goblin-outpost-sunset', label: 'Goblin Outpost Sunset (podiums)', kind: 'podium' },
  { id: 'elven-podiums-day', label: 'Elven Podiums Day (podiums)', kind: 'podium' },
  { id: 'night-podiums-moon', label: 'Night Podiums Moon (podiums)', kind: 'podium' },
  { id: 'goblin-camp-podium', label: 'Goblin Camp Podium (podiums)', kind: 'podium' },
  { id: 'fae-podiums', label: 'Fae Podiums (podiums)', kind: 'podium' },
  { id: 'frost-podiums', label: 'Frost Podiums (podiums)', kind: 'podium' },
  { id: 'alliance-dark', label: 'Alliance Dark (approved, podiums)', kind: 'podium' },
  { id: 'cemetery', label: 'Cemetery (approved, podiums)', kind: 'podium' },
  { id: 'elven', label: 'Elven (approved, podiums)', kind: 'podium' },
  { id: 'ice', label: 'Ice (approved, podiums)', kind: 'podium' },
]

export const ARENA_LIBRARY = LIBRARY.map((a) => {
  const path = `assets/arenas/library/${a.id}.jpg`
  const template = a.kind === 'podium' ? PODIUM_TEMPLATE : DAIS_TEMPLATE
  const defaultCalibration = {
    id: a.id,
    background: path,
    boardSizeLocked: 6,
    ...JSON.parse(JSON.stringify(template)),
    ...(TUNED[a.id] ?? {}),
  }
  return { id: a.id, label: a.label, path, suggestedSize: 6, calibrationId: null, defaultCalibration }
})
