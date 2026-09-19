// LD-007 (provisional playtest, not an accepted geometry decision): named generator profiles for
// authored square boards. `board.profile` in campaign JSON selects one; absent = `long`, which is
// byte-for-byte the pre-LD-007 behaviour of campaign-model.js (PRESETS.medium + square size
// override), so every existing stage keeps its exact board. The other profiles exist only to
// A/B the puzzle-density hypothesis from docs/GAME-CONCEPT.md ("Puzzle должен становиться
// глубже сам по себе") on real boards in the real viewer. `board.gen` may additionally override
// any GeneratorParams field for one-off experiments.

import { PRESETS } from '../../dist/src/index.js'

export const BOARD_PROFILES = {
  /** Current behaviour: few long snakes (maxLength 8), ~7–8 arrows on 6x6. */
  long: (n) => ({ ...PRESETS.medium, width: n, height: n, minArrows: Math.max(4, Math.round(n * n * 0.12)) }),
  /** Classic Tap-Away density: short arrows (2–4), many elements, most cells filled. */
  short: (n) => ({
    width: n, height: n, minLength: 2, maxLength: 4, turnChance: 0.15,
    targetFill: 0.9, minFill: 0.78, maxInitialFreeRatio: 0.4, minArrows: Math.max(6, Math.round(n * n * 0.22)),
    blockSeeking: 0.85, attempts: 60,
  }),
  /** A few long "structural" arrows plus many short local ones. */
  mixed: (n) => ({
    width: n, height: n, minLength: 2, maxLength: 6, turnChance: 0.2,
    targetFill: 0.9, minFill: 0.76, maxInitialFreeRatio: 0.42, minArrows: Math.max(5, Math.round(n * n * 0.18)),
    blockSeeking: 0.8, attempts: 60,
  }),
}

export const BOARD_PROFILE_NAMES = Object.keys(BOARD_PROFILES)

/** Generator params for an authored `board` block (`{ size, seed, profile?, gen? }`). */
export function boardParamsFor(board) {
  const size = Math.max(4, Math.min(12, board.size ?? 5))
  const make = BOARD_PROFILES[board.profile ?? 'long'] ?? BOARD_PROFILES.long
  return { ...make(size), ...(board.gen ?? {}) }
}
