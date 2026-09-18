// VIS-005: types for the plain-JS viewer module ./boss-visual-state.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export type BossPose = 'idle' | 'taunt' | 'cast' | 'stunned' | 'angry' | 'defeat' | 'back'
export declare const BOSS_POSES: readonly BossPose[]
export declare const TAUNT_HOLD_MS: number
export declare const STUNNED_HOLD_MS: number
export interface BossPoseOffset { dx: number; dy: number }
export interface BossAnchor {
  anchorX: number
  anchorY: number
  scale: number
  offsets: Record<BossPose, BossPoseOffset>
}
export declare const BOSS_ANCHOR: BossAnchor
export interface BossSnapshot { won: boolean; phaseIndex: number; casting: boolean }
export declare function readBossSnapshot(s: any, def: any): BossSnapshot | null
export declare function baselinePose(snap: BossSnapshot | null): BossPose
export interface BossVisual { pose: BossPose; startedAt: number; holdUntil: number; manual: boolean }
export declare function createBossVisual(): BossVisual
export declare function appearBossVisual(now: number): BossVisual
export declare function manualBossPose(v: BossVisual, pose: string, now: number): BossVisual
export type BossGameplayEvent = 'hit' | 'interrupted' | 'phase' | 'castStart' | 'won'
export declare function onBossGameplayEvent(v: BossVisual, evt: string, now: number, snap: BossSnapshot | null): BossVisual
export declare function tickBossVisual(v: BossVisual, now: number, snap: BossSnapshot | null): BossVisual
