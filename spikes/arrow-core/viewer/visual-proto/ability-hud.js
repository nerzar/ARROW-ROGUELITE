// FIX-034: pure ability -> HUD text/colour mapping (no DOM, no engine imports) shared by
// board-renderer.js (plate line + chip) and app.js (encounter intro), so a non-rock ability
// (heal/shift/shield) is never presented as a Stone Throw. `stone_throw` stays the default
// for a kind-less ability, mirroring encounter.ts's `abilityKind`.
//
// board-renderer.js's own plate-line/chip/card drawing already differentiates these kinds
// inline (PRESENT-001) -- this module is not wired into it, to avoid touching that already-
// verified rendering. It exists for callers that don't draw a chip themselves, starting with
// app.js's encounter-intro line (FIX-034's actual bug: any ability, including heal/shift,
// still announced "THROW IN N ... PINNED").

/** @param {string|undefined} kind */
export function abilityHud(kind, countdown, shielded = false) {
  const k = kind ?? 'stone_throw'
  if (k === 'shield') {
    return {
      kind: k, icon: '🛡', word: 'SHIELD',
      value: shielded ? 'UP' : String(countdown),
      fill: 'rgba(147,51,234,0.45)', stroke: 'rgba(192,132,252,0.8)',
    }
  }
  if (k === 'heal') {
    return {
      kind: k, icon: '✚', word: 'HEAL', value: String(countdown),
      fill: 'rgba(20,120,70,0.5)', stroke: 'rgba(110,230,160,0.8)',
    }
  }
  if (k === 'shift') {
    return {
      kind: k, icon: '⇄', word: 'SHIFT', value: String(countdown),
      fill: 'rgba(45,140,160,0.45)', stroke: 'rgba(120,220,240,0.8)',
    }
  }
  return {
    kind: 'stone_throw', icon: '🪨', word: 'THROW', value: String(countdown),
    fill: 'rgba(180,83,9,0.45)', stroke: 'rgba(245,158,11,0.7)',
  }
}

/** Intro hint for the encounter message line; only Stone Throw talks about pins. */
export function abilityIntroHint(kinds) {
  const ks = new Set((kinds ?? []).map((k) => k ?? 'stone_throw'))
  const parts = []
  if (ks.has('stone_throw')) parts.push(' Следи за THROW IN N — брошенный камень временно PINNED одну стрелку.')
  if (ks.has('shield')) parts.push(' SHIELD IN N — щит поглотит следующее попадание.')
  if (ks.has('heal')) parts.push(' HEAL IN N — лекарь подлечит самого раненого союзника.')
  if (ks.has('shift')) parts.push(' SHIFT — враг меняет подиум.')
  return parts.join('')
}
