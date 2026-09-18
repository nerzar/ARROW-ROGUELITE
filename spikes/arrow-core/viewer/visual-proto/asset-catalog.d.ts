export interface ArenaCatalogItem {
  id: string
  label: string
  path: string
  suggestedSize: number
  calibrationId: string | null
  defaultCalibration?: unknown
}

export interface CreatureCatalogItem {
  id: string
  label: string
  kind: 'enemy' | 'boss'
  species: string
  defaultHp: number
  defaultSide: number
  defaultTimer?: { interval: number; damage: number } | null
  hasCast?: boolean
}

export declare const ARENA_CATALOG: readonly ArenaCatalogItem[]
export declare const CREATURE_CATALOG: readonly CreatureCatalogItem[]

export declare function getArenaCatalog(): readonly ArenaCatalogItem[]
export declare function getCreatureCatalog(): readonly CreatureCatalogItem[]
export declare function findArena(idOrPath: string): ArenaCatalogItem
export declare function findCreature(id: string): CreatureCatalogItem
export declare function registerArena(entry: ArenaCatalogItem): ArenaCatalogItem | null
