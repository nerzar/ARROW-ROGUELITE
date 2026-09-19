import type { Dir } from './dir.js'

/**
 * ITEM-001 & ITEM-002: run items and relics — the roguelite reward loop. Every item and relic
 * is DATA (these tables), the engine processes effects based on effect kinds. Numbers follow
 * docs/BALANCE-SYSTEM.md baseline v0.1.
 *
 * Vocabulary (BALANCE-SYSTEM): `charges` per `recharge` scope (`'encounter'` = refilled on every
 * encounter entry, `'run'` = never refilled), `turnCost` (1 = using it IS a world turn: enemy timers
 * and abilities advance exactly as after a successful tap; 0 = free action).
 */

export type ItemId =
  | 'bow'
  | 'shield'
  | 'health_flask'
  | 'frost_dart'
  | 'pocket_gyro'
  | 'war_horn'

export type RelicId =
  | 'waste_conversion'
  | 'keystone_release'
  | 'safety_fuse'

export type Rarity = 'common' | 'rare'

export type ItemEffect =
  /** Direct projectile hit for `du` damage on a chosen live target side. Optional `timerBonus` adds
   * turns to the target's attack timer before world turn advancement. */
  | { kind: 'damage'; du: number; timerBonus?: number }
  /** A ward on the player: absorbs up to `absorb` HP of enemy attack damage, then breaks. Does
   * not stack — using it again while a ward is up refreshes to `absorb`. */
  | { kind: 'ward'; absorb: number }
  /** Heals `hp`, capped at the encounter's `playerMaxHp`. */
  | { kind: 'heal'; hp: number }
  /** Turn-free buff primed for the next landed puzzle arrow. */
  | { kind: 'buff'; buff: 'war_horn' }
  /** Passive inventory item (e.g. Pocket Gyro grants +1 encounter-local Rotate on entry). */
  | { kind: 'passive' }

export interface ItemDef {
  id: ItemId
  label: string
  /** Short player-facing effect line. */
  text: string
  charges: number
  recharge: 'encounter' | 'run'
  turnCost: 0 | 1
  effect: ItemEffect
  rarity: Rarity
  weight: number
}

export interface RelicDef {
  id: RelicId
  label: string
  text: string
  rarity: Rarity
  weight: number
}

export const ITEMS: Record<ItemId, ItemDef> = {
  bow: {
    id: 'bow', label: 'Лук', text: '2 урона в выбранную цель. Тратит ход.',
    charges: 1, recharge: 'encounter', turnCost: 1, effect: { kind: 'damage', du: 2 },
    rarity: 'rare', weight: 25,
  },
  shield: {
    id: 'shield', label: 'Щит', text: 'Поглощает 2 урона следующей атаки.',
    charges: 1, recharge: 'encounter', turnCost: 0, effect: { kind: 'ward', absorb: 2 },
    rarity: 'common', weight: 35,
  },
  health_flask: {
    id: 'health_flask', label: 'Фляга', text: '+3 HP. Один раз за забег.',
    charges: 1, recharge: 'run', turnCost: 0, effect: { kind: 'heal', hp: 3 },
    rarity: 'rare', weight: 20,
  },
  frost_dart: {
    id: 'frost_dart', label: 'Ледяной дротик', text: '1 урона в цель и +2 к её таймеру атаки. Тратит ход.',
    charges: 1, recharge: 'encounter', turnCost: 1, effect: { kind: 'damage', du: 1, timerBonus: 2 },
    rarity: 'common', weight: 35,
  },
  pocket_gyro: {
    id: 'pocket_gyro', label: 'Карманный гироскоп', text: '+1 поворот в каждом бою (не тратит общий запас).',
    charges: 1, recharge: 'encounter', turnCost: 0, effect: { kind: 'passive' },
    rarity: 'common', weight: 30,
  },
  war_horn: {
    id: 'war_horn', label: 'Боевой рог', text: 'Следующая попавшая стрела пазла наносит +1 урона.',
    charges: 1, recharge: 'encounter', turnCost: 0, effect: { kind: 'buff', buff: 'war_horn' },
    rarity: 'common', weight: 35,
  },
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]

export const RELICS: Record<RelicId, RelicDef> = {
  waste_conversion: {
    id: 'waste_conversion',
    label: 'Утилизация',
    text: 'Холостой выстрел в пустоту даёт +1 урона следующему попаданию (не стакается).',
    rarity: 'common',
    weight: 30,
  },
  keystone_release: {
    id: 'keystone_release',
    label: 'Замковый камень',
    text: 'Первый раз за бой, когда ход освобождает ≥2 стрел, таймер ближайшего врага +1.',
    rarity: 'rare',
    weight: 20,
  },
  safety_fuse: {
    id: 'safety_fuse',
    label: 'Предохранитель',
    text: 'Первое нажатие на заблокированную стрелу в бою не наносит урона игроку.',
    rarity: 'common',
    weight: 30,
  },
}

export const RELIC_IDS = Object.keys(RELICS) as RelicId[]

/** One owned item. `charges` is the live remaining count. */
export interface ItemInstance {
  id: ItemId
  charges: number
}

/**
 * The run inventory holder. Like `RotatePool`, it is passed BY HANDLE into encounters: spending
 * a charge mutates it directly and undo refunds it; solver clones get a private copy.
 */
export interface Inventory {
  slots: ItemInstance[]
}

export const INVENTORY_SLOTS = 3

export function itemNeedsTarget(id: ItemId): boolean {
  return ITEMS[id].effect.kind === 'damage'
}

export function itemIsPassive(id: ItemId): boolean {
  return ITEMS[id].effect.kind === 'passive'
}

/** What an item use looks like as an encounter action. `target` = arena side for targeted items. */
export interface ItemAction {
  kind: 'item'
  id: ItemId
  target?: Dir
}
