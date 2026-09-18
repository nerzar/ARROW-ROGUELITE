// UI-001: scene dropdown shows the ACTUAL runtime scene -- one mapping, no split brain.
// Pure (no DOM, no engine imports) so vitest can pin it; app.js applies the result to the
// <select>. The dropdown must stay truthful across: manual select, baked-arena debug loads,
// next-encounter advance (run position wins over the entry key), and restart/reset.
//
// kinds: 'sequence' (canon Prologue steps in order), 'authored' (campaign levels in order),
// 'single' (standalone one-step scene), 'debug' (synthesised square/baked boards).
// Returns { key, transient }: transient means "no static option exists" (debug boards) and
// the caller should show a throwaway option labelled with what's actually running.
export function resolveActiveSceneKey({ kind, entryKey, idx, stepCount, sequenceKeys }) {
  if (kind === 'debug') return { key: '__debug__', transient: true }
  if (
    (kind === 'sequence' || kind === 'authored') &&
    stepCount > 1 &&
    Number.isInteger(idx) && idx >= 0 && idx < stepCount
  ) {
    if (kind === 'sequence' && Array.isArray(sequenceKeys) && sequenceKeys[idx]) {
      return { key: sequenceKeys[idx], transient: false }
    }
    if (kind === 'authored') return { key: `authored-${idx}`, transient: false }
  }
  return { key: entryKey, transient: false }
}
