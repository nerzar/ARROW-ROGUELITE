// FIX-034: types for the plain-JS viewer module ./ability-hud.js (this .d.ts only serves tsc/vitest).
import type { AbilityKind } from '../../src/index.js'

export interface AbilityHudChip {
  kind: AbilityKind
  icon: string
  word: string
  value: string
  fill: string
  stroke: string
}
export declare function abilityHud(kind: string | undefined, countdown: number | undefined, shielded?: boolean): AbilityHudChip
export declare function abilityIntroHint(kinds: (string | undefined)[] | undefined): string
