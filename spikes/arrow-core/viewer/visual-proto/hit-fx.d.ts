// VFX-003: types for the plain-JS viewer module ./hit-fx.js (kept as .js so the browser
// visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface LightHitParams {
  flashDur: number; flashScale: number; sparkCount: number; sparkDur: number; sparkSpread: number;
  sqRecoil: number; sqSquash: number; sqDur: number; camAmp: number; camDur: number; camFreq: number;
}
export declare const LIGHT_HIT: LightHitParams
export declare const clamp01: (t: number) => number
export declare const easeOutCubic: (p: number) => number
export declare function srand(seed: number): () => number
export declare function punch(p: number): number
export declare function hashStr(s: string): number
export interface SparkPart { ang: number; spd: number; size: number; delay: number; g: number; hot: boolean }
export declare function sparkParts(seed: number, count: number, baseAng: number): SparkPart[]
export interface CamShake { at: number; dur: number; amp: number; freq: number }
export interface CamOffset { x: number; y: number }
export declare function camOffset(now: number, shakes: CamShake[]): CamOffset
