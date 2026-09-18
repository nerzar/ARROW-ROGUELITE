// VIS-006: types for the plain-JS viewer module ./enemy-visual-state.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export type EnemyPose = 'idle' | 'attackReady' | 'attack' | 'hit' | 'defeat'
export declare const ENEMY_POSES: readonly EnemyPose[]
export declare const ENEMY_ATTACK_HOLD_MS: number
export declare const ENEMY_HIT_HOLD_MS: number
export declare const ATTACK_READY_IN: number
export interface EnemyPoseOffset { dx: number; dy: number }
export interface EnemyAnchor {
  anchorX: number
  anchorY: number
  scale: number
  offsets: Record<EnemyPose, EnemyPoseOffset>
}
export declare const ENEMY_ANCHOR: EnemyAnchor
export interface EnemySnapshot { dead: boolean; countdown: number; attackKind?: string }
export declare function readEnemySnapshot(enemy: any): EnemySnapshot | null
export declare function baselinePose(snap: EnemySnapshot | null): EnemyPose
export interface EnemyVisual { pose: EnemyPose; startedAt: number; holdUntil: number; manual: boolean }
export declare function createEnemyVisual(): EnemyVisual
export declare function appearEnemyVisual(now: number): EnemyVisual
export declare function manualEnemyPose(v: EnemyVisual, pose: string, now: number): EnemyVisual
export type EnemyGameplayEvent = 'hit' | 'attack' | 'defeated' | 'sync'
export declare function onEnemyGameplayEvent(v: EnemyVisual, evt: string, now: number, snap: EnemySnapshot | null): EnemyVisual
export declare function tickEnemyVisual(v: EnemyVisual, now: number, snap: EnemySnapshot | null): EnemyVisual
