// BUILD-026: Data-driven catalog of arenas and creatures for the Campaign Authoring Tool.
// Provides stable IDs, user-facing labels, default side/stats, and paths.
// Designed to cleanly merge with ASSET-001 when additional assets are prepared.

export const ARENA_CATALOG = [
  {
    id: 'prologue-5x5-good',
    label: '5x5-good (baked 5x5 grid)',
    path: 'assets/arenas/prologue-act1/5x5-good.png',
    suggestedSize: 5,
    calibrationId: 'prologue-5x5-good',
  },
  {
    id: '6x6-5',
    label: '6x6-5 / Shadow Moon (baked 6x6 grid)',
    path: 'assets/arenas/prologue-act1/6x6-5.png',
    suggestedSize: 6,
    calibrationId: 'boss-shadow-moon',
  },
  {
    id: 'moonlit-fortress',
    label: 'Moonlit Fortress (flexible dais)',
    path: 'assets/arena-moonlit-fortress.png',
    suggestedSize: 5,
    calibrationId: null,
  },
  // ASSET-002: generated arenas from magicarrowassets/arenas/, brought in project-local + given
  // their own calibration entry (arena-calibration.js) so a square5..square10 level can pick a
  // real baked-grid background instead of only the two pre-existing ones above.
  {
    id: 'grimskull-5x5',
    label: 'Grimskull Throne (baked 5x5 grid)',
    path: 'assets/arenas/prologue-act1/grimskull-5x5.png',
    suggestedSize: 5,
    calibrationId: 'grimskull-5x5',
  },
  {
    id: 'ironvow-6x6',
    label: 'Ironvow Bastion (baked 6x6 grid)',
    path: 'assets/arenas/prologue-act1/ironvow-6x6.png',
    suggestedSize: 6,
    calibrationId: 'ironvow-6x6',
  },
  {
    id: 'autumnfall-8x7',
    label: 'Autumnfall Ruins (baked 8x7 grid)',
    path: 'assets/arenas/prologue-act1/autumnfall-8x7.png',
    suggestedSize: 7,
    calibrationId: 'autumnfall-8x7',
  },
  {
    id: 'demonforge-10x8',
    label: 'Demonforge Gate (baked 10x8 grid)',
    path: 'assets/arenas/prologue-act1/demonforge-10x8.png',
    suggestedSize: 9,
    calibrationId: 'demonforge-10x8',
  },
]

export const CREATURE_CATALOG = [
  {
    id: 'goblin-shaman',
    label: 'Goblin Shaman (Boss)',
    kind: 'boss',
    species: 'goblin-shaman',
    defaultHp: 4,
    defaultSide: 0,
    hasCast: true,
    sourceFolder: 'goblin-shaman',
  },
  {
    id: 'goblin-taunter',
    label: 'Goblin Taunter / King (Boss)',
    kind: 'boss',
    species: 'goblin-taunter',
    defaultHp: 6,
    defaultSide: 0,
    hasCast: false,
    sourceFolder: 'goblin-king', // TOOL-001: catalog id != source folder name
  },
  {
    id: 'dire-wolf',
    label: 'Dire Wolf (Enemy)',
    kind: 'enemy',
    species: 'dire-wolf',
    defaultHp: 2,
    defaultSide: 0,
    defaultTimer: { interval: 3, damage: 2 },
    sourceFolder: 'dire_wolf', // TOOL-001: catalog id != source folder name (underscore)
  },
  {
    id: 'green-slime',
    label: 'Green Slime (Enemy)',
    kind: 'enemy',
    species: 'green-slime',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: null,
    sourceFolder: 'green-slime',
  },
  {
    id: 'small-goblin',
    label: 'Small Goblin (Enemy)',
    kind: 'enemy',
    species: 'small-goblin',
    defaultHp: 2,
    defaultSide: 0,
    defaultTimer: { interval: 4, damage: 1 },
    sourceFolder: 'small-goblin',
  },
  {
    id: 'spider-brute',
    label: 'Spider Brute (Enemy)',
    kind: 'enemy',
    species: 'spider-brute',
    defaultHp: 3,
    defaultSide: 0,
    defaultTimer: { interval: 4, damage: 2 },
    sourceFolder: 'spider-brute',
  },
  {
    id: 'skeleton-child',
    label: 'Skeleton Child (Enemy)',
    kind: 'enemy',
    species: 'skeleton-child',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: null,
    sourceFolder: 'skeleton-child',
  },
  // ASSET-003: complete the creature library -- these 3 source folders
  // (magicarrowassets/creatures/small-spider, toxic-demonic-spider, small-green-slime) had usable
  // isolated art but no catalog entry at all, so they were never selectable in the editor.
  {
    id: 'small-spider',
    label: 'Small Spider (Enemy)',
    kind: 'enemy',
    species: 'small-spider',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: { interval: 4, damage: 1 },
    sourceFolder: 'small-spider',
  },
  {
    id: 'toxic-demonic-spider',
    label: 'Toxic Demonic Spider (Enemy)',
    kind: 'enemy',
    species: 'toxic-demonic-spider',
    defaultHp: 3,
    defaultSide: 0,
    defaultTimer: { interval: 3, damage: 2 },
    sourceFolder: 'toxic-demonic-spider',
  },
  {
    id: 'small-green-slime',
    label: 'Small Green Slime (Enemy)',
    kind: 'enemy',
    species: 'small-green-slime',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: null,
    sourceFolder: 'small-green-slime',
  },
]

export function getArenaCatalog() {
  return ARENA_CATALOG
}

export function getCreatureCatalog() {
  return CREATURE_CATALOG
}

export function findArena(idOrPath) {
  return ARENA_CATALOG.find((a) => a.id === idOrPath || a.path === idOrPath) ?? ARENA_CATALOG[0]
}

// BUILD-029: Registers a runtime-discovered arena (e.g. imported by the user from a local file)
// into the same catalog the editor/runtime already read from, so it behaves exactly like any
// built-in entry (selectable, findArena()-able, re-selectable after reload once persisted).
export function registerArena(entry) {
  if (!entry || !entry.id || !entry.path) return null
  const existing = ARENA_CATALOG.find((a) => a.id === entry.id)
  if (existing) return existing
  ARENA_CATALOG.push(entry)
  return entry
}

export function findCreature(id) {
  return CREATURE_CATALOG.find((c) => c.id === id) ?? CREATURE_CATALOG[2]
}
