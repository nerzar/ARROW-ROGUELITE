// VIS-013: types for the plain-JS viewer module ./arrow-style.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export type ArrowStyleName = 'fantasy-flat' | 'fantasy-inlaid' | 'fantasy-effect'
export declare const ARROW_STYLES: readonly ArrowStyleName[]
export declare const DEFAULT_ARROW_STYLE: ArrowStyleName
export declare function normalizeArrowStyle(v: unknown): ArrowStyleName
export interface ArrowPalette {
  keyline: string
  bodyFree: string
  bodyAimed: string
  bodyBlocked: string
  core: string
  glowFree: string
  glowAimed: string
  bevel: string | null
  rune: string | null
  halo: string | null
  highlight: string | null
  spark: string | null
}
export declare const ARROW_PALETTES: Record<ArrowStyleName, ArrowPalette>
export declare function arrowPalette(style: unknown): ArrowPalette
export declare const BEND_RADIUS_FAC: number
export declare function clampBendRadius(r: number, lenA: number, lenB: number): number
export interface TrimPoints {
  a: [number, number]
  b: [number, number]
}
export declare function cornerTrim(
  p0: readonly [number, number] | [number, number],
  p1: readonly [number, number] | [number, number],
  p2: readonly [number, number] | [number, number],
  r: number,
): TrimPoints | null
export type ArrowFocus = 'effect' | 'charged' | 'plain'
export interface ArrowFocusInput {
  hover?: boolean
  hint?: boolean
  aimed?: boolean
  free?: boolean
  pinned?: boolean
  blocked?: boolean
}
export declare function arrowFocus(input?: ArrowFocusInput): ArrowFocus
export declare const DEFAULT_EFFECT_INTENSITY: number
export declare function normalizeEffectIntensity(v: unknown): number
export declare const SPARK_PERIOD_MS: number
export interface SparkSlot {
  u: number
  size: number
  alpha: number
}
export declare function sparkParams(nowMs: number, arrowId: number, slotCount?: number): SparkSlot[]
