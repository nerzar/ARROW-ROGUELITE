// BUILD-026: Campaign and Level Authoring Data Model & Persistence.
// Manages square-only authored levels, center-first enemy placement,
// and dual persistence (real project file via dev-server API + localStorage fallback).

import { generateLevel } from '../../dist/src/index.js'
import { boardParamsFor } from './board-profiles.js'
import { getArenaCalibration } from './arena-calibration.js'
import { findArena, findCreature } from './asset-catalog.js'

export const STORAGE_CAMPAIGN_KEY = 'arrow_authored_campaign'

/**
 * Creates a brand new square level.
 * Rule: Default enemy placement is center/top slot (side 0).
 */
export function createDefaultLevel(index = 1, size = 5) {
  const defaultArena = findArena('prologue-5x5-good')
  const defaultCreature = findCreature('dire-wolf')
  return {
    id: `stage-${index}`,
    title: `Этап ${index} · Квадрат ${size}x${size}`,
    board: {
      preset: `square-${size}`,
      size,
      seed: 1000 + index * 77,
    },
    presentation: {
      arena: defaultArena.id,
      background: defaultArena.path,
      calibration: null, // will use default arena calibration if null
    },
    encounter: {
      id: `enc_stage_${index}`,
      title: `Этап ${index}`,
      enemies: [
        {
          id: 'mob_top',
          species: defaultCreature.id,
          label: defaultCreature.label,
          side: 0, // STRICT RULE: center/top is default first slot
          hp: defaultCreature.defaultHp,
          attackTimer: defaultCreature.defaultTimer ? { ...defaultCreature.defaultTimer } : null,
        },
      ],
      rotate: { allow: [] },
      blockedTapDamage: 1,
      notes: `Authored square level ${size}x${size}`,
    },
  }
}

/**
 * Resolves the default/baseline calibration for a given arena.
 * Priority:
 * 1. campaign.arenaDefaults (custom default set by user for this arena)
 * 2. arena.defaultCalibration (if embedded in arena catalog entry)
 * 3. getArenaCalibration(arena.calibrationId) (built-in calibrated arena)
 * 4. getArenaCalibration('prologue-5x5-good') (safe fallback)
 */
export function getArenaBaseline(arena, campaign = null) {
  if (!arena) return getArenaCalibration('prologue-5x5-good')
  const customDefault = campaign?.arenaDefaults?.[arena.id]
    ?? campaign?.arenaDefaults?.[arena.path]
    ?? arena.defaultCalibration
  if (customDefault && typeof customDefault === 'object') {
    return JSON.parse(JSON.stringify(customDefault))
  }
  const calibId = arena.calibrationId || 'prologue-5x5-good'
  const builtIn = getArenaCalibration(calibId) || getArenaCalibration('prologue-5x5-good')
  return JSON.parse(JSON.stringify(builtIn))
}

/**
 * Changes a level's arena, immediately resolving the new arena's baseline
 * calibration/presentation so stale geometry from the previous arena is not retained.
 * Keeps gameplay/content fields intact (board seed/size, encounter, enemies, HP/timers).
 */
export function changeLevelArena(levelDef, newArenaIdOrPath, campaign = null) {
  const arena = findArena(newArenaIdOrPath)
  const baseline = getArenaBaseline(arena, campaign)
  const newCalib = {
    ...JSON.parse(JSON.stringify(baseline)),
    id: arena.id || arena.calibrationId || 'prologue-5x5-good',
    background: arena.path,
  }
  levelDef.presentation = {
    ...levelDef.presentation,
    arena: arena.id,
    background: arena.path,
    calibration: newCalib,
  }
  return newCalib
}

/**
 * Creates a default campaign containing initial playable levels.
 */
export function createDefaultCampaign() {
  return {
    format: 'arrow-campaign',
    v: 1,
    id: 'authored-campaign',
    title: 'Авторская кампания',
    levels: [
      createDefaultLevel(1, 5),
      createDefaultLevel(2, 6),
    ],
    // BUILD-029: arenas imported from a local file by the user, written to a real project
    // asset and persisted here so they round-trip through Save/Load exactly like a built-in
    // ARENA_CATALOG entry.
    customArenas: [],
    arenaDefaults: {},
  }
}

/**
 * Generates a playable board puzzle for a square level definition.
 */
export function generateBoardForLevel(levelDef) {
  const seed = Number(levelDef.board.seed ?? 1)
  // LD-007 (provisional): `board.profile` / `board.gen` pick the generator knobs; absent profile
  // = the previous PRESETS.medium + square-size behaviour, so existing stages are unchanged.
  const gen = generateLevel(boardParamsFor(levelDef.board), seed)
  return gen
}

/**
 * Resolves the next unoccupied actor slot among [TOP(0), RIGHT(1), LEFT(3)].
 * Center/TOP (0) is preferred first.
 */
export function getNextAvailableSide(existingEnemies = []) {
  const occupiedSides = new Set(existingEnemies.map((e) => Number(e.side)))
  if (!occupiedSides.has(0)) return 0 // TOP / center-first
  if (!occupiedSides.has(1)) return 1 // RIGHT
  if (!occupiedSides.has(3)) return 3 // LEFT
  return 0 // fallback
}

/**
 * Converts an authored level definition into an engine-compatible Step object
 * that RunState and EncounterState can directly consume.
 */
export function convertLevelToStep(levelDef) {
  const gen = generateBoardForLevel(levelDef)
  if (!gen.ok || !gen.level) {
    throw new Error(`Failed to generate board for level "${levelDef.id}" (seed: ${levelDef.board.seed})`)
  }

  // Ensure side numbers are integers 0, 1, 3
  const sideMap = { N: 0, E: 1, S: 2, W: 3, top: 0, right: 1, left: 3 }
  const normalizedEnemies = (levelDef.encounter.enemies ?? []).map((e) => {
    let side = e.side
    if (typeof side === 'string') side = sideMap[side] ?? 0
    return {
      ...e,
      side,
    }
  })

  const encounterData = {
    ...levelDef.encounter,
    enemies: normalizedEnemies.length > 0 ? normalizedEnemies : undefined,
  }

  // If encounter is boss-type
  if (levelDef.encounter.boss) {
    const normalizedPhases = (levelDef.encounter.boss.phases ?? []).map((p) => {
      let side = p.side
      if (typeof side === 'string') side = sideMap[side] ?? 0
      return {
        ...p,
        side,
      }
    })
    encounterData.boss = {
      ...levelDef.encounter.boss,
      phases: normalizedPhases,
    }
    delete encounterData.enemies
  }

  // Normalize rotate allow (support 'cw' / 'ccw' strings as well as 1 / -1)
  if (encounterData.rotate?.allow) {
    encounterData.rotate = {
      ...encounterData.rotate,
      allow: encounterData.rotate.allow.map((t) => (t === 'cw' ? 1 : t === 'ccw' ? -1 : t)),
    }
  }

  return {
    id: levelDef.id,
    title: levelDef.title,
    level: gen.level,
    def: encounterData,
    board: levelDef.board,
    presentation: levelDef.presentation,
  }
}

/**
 * Persistence: Save campaign to both project file and browser localStorage.
 */
export async function saveCampaign(campaign) {
  const result = {
    ok: false,
    fileSaved: false,
    storageSaved: false,
    filePath: 'campaigns/campaign.json',
    error: null,
  }

  // 1. Save to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_CAMPAIGN_KEY, JSON.stringify(campaign))
      result.storageSaved = true
    } catch (e) {
      console.warn('localStorage save failed', e)
    }
  }

  // 2. Save to real project file via dev-server API
  try {
    const res = await fetch('/api/campaign/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign, null, 2),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.ok) {
        result.fileSaved = true
        result.filePath = data.file ?? result.filePath
      }
    } else {
      result.error = `HTTP ${res.status}`
    }
  } catch (err) {
    result.error = String(err.message ?? err)
  }

  result.ok = result.fileSaved || result.storageSaved
  return result
}

/**
 * Persistence: Load campaign.
 * Source of truth order:
 * 1. Real project file via dev-server API (/api/campaign/load)
 * 2. Browser localStorage
 * 3. Default starter campaign
 */
export async function loadCampaign() {
  // 1. Try file
  try {
    const res = await fetch('/api/campaign/load', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data && Array.isArray(data.levels) && data.levels.length > 0) {
        return { source: 'file', campaign: data }
      }
    }
  } catch {}

  // 2. Try localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_CAMPAIGN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
          return { source: 'storage', campaign: parsed }
        }
      }
    } catch {}
  }

  // 3. Fallback
  return { source: 'default', campaign: createDefaultCampaign() }
}
