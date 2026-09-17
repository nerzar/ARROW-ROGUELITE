// CAL-004: single source of truth for the 5-step canon Prologue sequence (BUILD-025), shared by
// app.js (the playable game) and calibration-editor.js (per-stage calibration). Extracted out of
// app.js so both always agree on which file/seed backs "Prologue N" -- the calibration editor must
// show the exact same board/def a real playthrough sees, never a separate approximation.
import { encounterFromJson } from '../../dist/src/index.js'

// BUILD-025: unified canon Prologue sequence:
// 1. Prologue 5x5 (calibrated prologue-5x5-good, pure puzzle peeling shot, mob North, 1 HP)
// 2. Prologue 2 (cp-e2: mistakes cost HP, 2 HP mob East, introduces blockedTapDamage = 1)
// 3. Prologue 3 (cp-e3: time has a cost, 3 HP mob East, ATTACK IN 4 timer)
// 4. Prologue 4 (cp-e4: two enemies at once, priority decision: urgent East IN 3 vs slow North IN 5)
// 5. Prologue 5 (cp-e5: Goblin Shaman boss, Phase 1 East 4 HP -> Phase 2 North 5 HP CAST IN 3 -> INTERRUPT -> normal 4, +1 Rotate grant, +2 Rotate win reward).
export const SEQUENCE_STEPS = [
  { key: 'prologue-5x5', title: 'Пролог 1 · 5x5 Чистый выстрел (seed 1107)', file: '../../encounters/prologue-5x5.json' },
  { key: 'cp-e2', title: 'Пролог 2 · Ошибка стоит HP (seed 300)', file: '../../encounters/cp-e2.json' },
  { key: 'cp-e3', title: 'Пролог 3 · Время имеет цену (seed 522)', file: '../../encounters/cp-e3.json' },
  { key: 'cp-e4', title: 'Пролог 4 · Два врага одновременно (seed 10)', file: '../../encounters/cp-e4.json' },
  { key: 'cp-e5', title: 'Пролог 5 · Goblin Shaman (seed 1571)', file: '../../encounters/cp-e5.json' },
]

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

const stepCache = new Map()

/** Loads and parses one scene entry ({key, title, file}) into {id, title, level, def, board,
 * presentation}. Cached by key -- every caller (app.js, calibration-editor.js) sees the same
 * parsed step object for a given key. Works for any scene shape (SEQUENCE_STEPS or app.js's own
 * STANDALONE_SCENES), not just the Prologue sequence. */
export async function getStep(scene) {
  if (stepCache.has(scene.key)) return stepCache.get(scene.key)
  const raw = await fetchJson(scene.file)
  const parsed = encounterFromJson(raw)
  const step = {
    id: scene.key,
    title: scene.title,
    level: parsed.level,
    def: parsed.file.encounter,
    board: parsed.file.board,
    presentation: parsed.file.presentation ?? parsed.file.encounter.presentation ?? scene.presentation ?? null,
  }
  stepCache.set(scene.key, step)
  return step
}
