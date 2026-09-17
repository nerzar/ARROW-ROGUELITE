import type { GeneratorParams } from './generator.js'

/**
 * Benchmark presets. These are spike knobs for measuring the generator across board sizes, not a
 * difficulty curve for the game.
 */
export const PRESETS = {
  tiny: {
    width: 4, height: 5, minLength: 2, maxLength: 4, turnChance: 0.1,
    targetFill: 0.7, minFill: 0.5, maxInitialFreeRatio: 0.75, minArrows: 3,
    blockSeeking: 0.6, attempts: 40,
  },
  easy: {
    width: 6, height: 7, minLength: 2, maxLength: 5, turnChance: 0.15,
    targetFill: 0.8, minFill: 0.65, maxInitialFreeRatio: 0.55, minArrows: 6,
    blockSeeking: 0.7, attempts: 40,
  },
  medium: {
    width: 8, height: 10, minLength: 2, maxLength: 8, turnChance: 0.25,
    targetFill: 0.88, minFill: 0.72, maxInitialFreeRatio: 0.45, minArrows: 10,
    blockSeeking: 0.8, attempts: 40,
  },
  hard: {
    width: 10, height: 12, minLength: 2, maxLength: 12, turnChance: 0.3,
    targetFill: 0.9, minFill: 0.76, maxInitialFreeRatio: 0.35, minArrows: 14,
    blockSeeking: 0.9, attempts: 40,
  },
  expert: {
    width: 12, height: 14, minLength: 2, maxLength: 16, turnChance: 0.35,
    targetFill: 0.92, minFill: 0.78, maxInitialFreeRatio: 0.3, minArrows: 18,
    blockSeeking: 1, attempts: 40,
  },
  huge: {
    width: 24, height: 24, minLength: 2, maxLength: 24, turnChance: 0.35,
    targetFill: 0.92, minFill: 0.78, maxInitialFreeRatio: 0.3, minArrows: 40,
    blockSeeking: 1, attempts: 40,
  },
  /** Stress: gtxPrime-scale board. */
  xl: {
    width: 40, height: 40, minLength: 2, maxLength: 30, turnChance: 0.35,
    targetFill: 0.92, minFill: 0.78, maxInitialFreeRatio: 0.3, minArrows: 100,
    blockSeeking: 1, attempts: 40,
  },
  /** Stress: expert board with acceptance thresholds pushed until the generator starts failing. */
  strict: {
    width: 12, height: 14, minLength: 2, maxLength: 16, turnChance: 0.35,
    targetFill: 0.95, minFill: 0.9, maxInitialFreeRatio: 0.15, minArrows: 18,
    blockSeeking: 1, attempts: 40,
  },
  /** Square-first policy presets (BUILD-024 / LD-005): 5x5 board. */
  square5: {
    width: 5, height: 5, minLength: 2, maxLength: 4, turnChance: 0.12,
    targetFill: 0.75, minFill: 0.60, maxInitialFreeRatio: 0.65, minArrows: 4,
    blockSeeking: 0.65, attempts: 40,
  },
} satisfies Record<string, GeneratorParams>

export type PresetName = keyof typeof PRESETS
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[]
