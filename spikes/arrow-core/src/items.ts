import type { Dir } from './dir.js'

/**
 * ITEM-001: run items — the first roguelite reward loop. Every item is DATA (this table), the
 * engine only knows three effect kinds. Numbers are docs/BALANCE-SYSTEM.md baseline v0.1 and are
 * provisional, not user-approved balance.
 *
 * Vocabulary (BALANCE-SYSTEM): `charges` per `recharge` scope (`'encounter'` = refilled on every
 * encounter entry, `'run'` = never refilled), `turnCost` (1 = using it IS a world turn: enemy timers
 * and abilities advance exactly as after a successful tap; 0 = free action).
 */

export type ItemId = 'bow' | 'shield' | 'potion' | 'arrow'

export type ItemEffect =
  /** Direct projectile hit for `du` damage on a chosen live target side. Treated like an arrow
   * hit for everything downstream: a raised Shield absorbs it, an armed cast is interrupted,
   * a kill grants the enemy's `reward`, a hit-triggered shifter staggers. */
  | { kind: 'damage'; du: number }
  /** A ward on the player: absorbs up to `absorb` HP of enemy attack damage, then breaks. Does
   * not stack — using it again while a ward is up refreshes to `absorb`. */
  | { kind: 'ward'; absorb: number }
  /** Heals `hp`, capped at the encounter's `playerMaxHp`. */
  | { kind: 'heal'; hp: number }
  /** Puts a fresh, immediately free 2-cell arrow on the board pointing `target` (see
   * `EncounterState.useItem`). Ammo you conjure; releasing it is still a normal tap/turn. */
  | { kind: 'spawn_arrow' }

export interface ItemDef {
  id: ItemId
  label: string
  /** Short player-facing effect line. */
  text: string
  charges: number
  recharge: 'encounter' | 'run'
  turnCost: 0 | 1
  effect: ItemEffect
  /** Consumable: picking it up again adds charges up to `maxCharges` (never refilled by itself). */
  maxCharges?: number
}

export const ITEMS: Record<ItemId, ItemDef> = {
  bow: {
    id: 'bow', label: 'Лук', text: '2 урона в выбранную цель. Тратит ход.',
    charges: 1, recharge: 'encounter', turnCost: 1, effect: { kind: 'damage', du: 2 },
  },
  shield: {
    id: 'shield', label: 'Щит', text: 'Поглощает 2 урона следующей атаки.',
    charges: 1, recharge: 'encounter', turnCost: 0, effect: { kind: 'ward', absorb: 2 },
  },
  potion: {
    id: 'potion', label: 'Зелье', text: '+3 HP. Расходуется; пополняется наградами.',
    charges: 1, recharge: 'run', turnCost: 0, effect: { kind: 'heal', hp: 3 }, maxCharges: 3,
  },
  arrow: {
    id: 'arrow', label: 'Стрела', text: 'Кладёт на доску свободную стрелу в выбранном направлении.',
    charges: 2, recharge: 'run', turnCost: 0, effect: { kind: 'spawn_arrow' }, maxCharges: 5,
  },
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]

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
  const k = ITEMS[id].effect.kind
  return k === 'damage' || k === 'spawn_arrow'
}
export const isConsumable = (id: ItemId): boolean => ITEMS[id].maxCharges !== undefined

/** What an item use looks like as an encounter action. `target` = arena side for targeted items. */
export interface ItemAction {
  kind: 'item'
  id: ItemId
  target?: Dir
}
