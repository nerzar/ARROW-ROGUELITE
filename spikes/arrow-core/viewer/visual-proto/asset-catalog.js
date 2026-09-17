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
  },
  {
    id: 'goblin-taunter',
    label: 'Goblin Taunter / King (Boss)',
    kind: 'boss',
    species: 'goblin-taunter',
    defaultHp: 6,
    defaultSide: 0,
    hasCast: false,
  },
  {
    id: 'dire-wolf',
    label: 'Dire Wolf (Enemy)',
    kind: 'enemy',
    species: 'dire-wolf',
    defaultHp: 2,
    defaultSide: 0,
    defaultTimer: { interval: 3, damage: 2 },
  },
  {
    id: 'green-slime',
    label: 'Green Slime (Enemy)',
    kind: 'enemy',
    species: 'green-slime',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: null,
  },
  {
    id: 'small-goblin',
    label: 'Small Goblin (Enemy)',
    kind: 'enemy',
    species: 'small-goblin',
    defaultHp: 2,
    defaultSide: 0,
    defaultTimer: { interval: 4, damage: 1 },
  },
  {
    id: 'spider-brute',
    label: 'Spider Brute (Enemy)',
    kind: 'enemy',
    species: 'spider-brute',
    defaultHp: 3,
    defaultSide: 0,
    defaultTimer: { interval: 4, damage: 2 },
  },
  {
    id: 'skeleton-child',
    label: 'Skeleton Child (Enemy)',
    kind: 'enemy',
    species: 'skeleton-child',
    defaultHp: 1,
    defaultSide: 0,
    defaultTimer: null,
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

export function findCreature(id) {
  return CREATURE_CATALOG.find((c) => c.id === id) ?? CREATURE_CATALOG[2]
}
