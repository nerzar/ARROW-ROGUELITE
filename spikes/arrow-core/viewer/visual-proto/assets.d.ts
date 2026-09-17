// VIS-008: types for the plain-JS viewer module ./assets.js (kept as .js so the browser
// visual-proto shell can import it directly; this .d.ts only serves tsc/vitest). Covers every
// current export, not just the VIS-008 additions, so future tests importing this module typecheck
// without needing a second pass at this file.
import type { BossPose } from './boss-visual-state.js'
import type { EnemyPose } from './enemy-visual-state.js'

export declare const ASSET_MANIFEST: Record<string, string>

/** Reserved Act I boss (Goblin Taunter/King) -- see BOSS_MANIFESTS/bossSpeciesFor below. */
export declare const BOSS_PACK_BASE: string
export declare const BOSS_MANIFEST: Record<BossPose, string>

/** Prologue boss (Goblin Shaman, cp-e5's `miniboss_placeholder`). */
export declare const SHAMAN_PACK_BASE: string
export declare const SHAMAN_MANIFEST: Record<BossPose, string>

export type BossSpecies = 'goblin-shaman' | 'goblin-taunter'
export declare const BOSS_MANIFESTS: Record<BossSpecies, Record<BossPose, string>>
/** Which boss species pack backs a given `def.boss.id`. Unknown ids default to Shaman. */
export declare function bossSpeciesFor(bossId: string | undefined): BossSpecies

export declare const WOLF_PACK_BASE: string
export declare const WOLF_MANIFEST: Record<EnemyPose, string>

export type ImagePack = Record<string, HTMLImageElement | null>
export declare function loadAssets(manifest?: Record<string, string>): Promise<Record<string, HTMLImageElement | null>>
export declare function loadBossPack(manifest?: Record<string, string>): Promise<ImagePack>
export declare function loadWolfPack(manifest?: Record<string, string>): Promise<ImagePack>
export declare function resolveBossImage(pack: ImagePack | null, pose: string): HTMLImageElement | null
export declare function resolveWolfImage(pack: ImagePack | null, pose: string): HTMLImageElement | null
export declare function resolveTargetImage(
  store: Record<string, HTMLImageElement | null>,
  t: { id?: string; side: number; isBoss: boolean },
): HTMLImageElement | null
