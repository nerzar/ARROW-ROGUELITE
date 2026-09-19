import { type EncounterDef, EncounterState, type RotatePool } from './encounter.js'
import { type Inventory, INVENTORY_SLOTS, type ItemId, type ItemInstance, ITEM_IDS, ITEMS } from './items.js'
import type { Level } from './level.js'
import { createRng, deriveSeed, hashString } from './rng.js'

/**
 * EXP-010: a thin run-level wrapper around the per-encounter EncounterState, needed because HP now
 * persists across encounters (docs/COMBAT-RULES.md 1) while the board/boss/timer state does not.
 * RunState owns nothing about combat rules itself — it only tracks *which* step is active, the HP
 * snapshot each step started with (for a debug restart), and swaps in a fresh EncounterState with
 * that snapshot when a step is (re)started or completed.
 *
 * RUN-001: RunState additionally owns the shared Rotate pool (`rotateCharges`, minimum
 * `playerHp`/`rotateCharges` per the task — no other run resources yet, and charges are never
 * duplicated into the presentation layer). The pool starts at 0 (pre-boss prologue has no global
 * charges), grows only via a completed step's `def.winRotateReward` (prologue boss: +2, claimed
 * exactly once by `advance()`), and is spent 1-per-Rotate by pool-backed encounters
 * (`rotate.useRunPool`). Tutorial/local boss Rotate stays encounter-local and never touches this
 * pool. Refill beyond win rewards is UNKNOWN (no regeneration here).
 */

export interface RunStep {
  /** Stable id for debug/logging and viewer selection, e.g. "e1". */
  id: string
  title?: string
  level: Level
  def: EncounterDef
}

export interface RunConfig {
  /** Data-driven, provisional (see docs/GAME-CONCEPT.md / COMBAT-RULES.md: exact numbers are OPEN). */
  playerMaxHp: number
  /** RUN-001 / ACT-I-001: starting shared Rotate charges (default 0). For runs starting post-prologue directly. */
  initialRotateCharges?: number
  /** ITEM-001: items the run starts with (debug/tests; a normal run starts empty). */
  startingItems?: ItemId[]
  /** ITEM-001: seed for the deterministic reward draft (default 1). */
  runSeed?: number
  /** ITEM-001: step ids after which no reward is offered (e.g. the first prologue tutorials). */
  noRewardAfter?: string[]
  /** ITEM-001 (user rule 2026-09-19): items are rare — chance that the draft's third card is an
   * item instead of a big gold pile (default 0.3). A step's `def.rewardItem` forces it. */
  itemChance?: number
  /** ITEM-001: gold of the common card = base + perStep * stepIndex (defaults 8 / 2). */
  goldBase?: number
  goldPerStep?: number
}

/**
 * ITEM-001: one card of the post-encounter draft. The draft is always three cards:
 *   1. gold (the ordinary reward, always present);
 *   2. +HP or +Rotate (heal only while HP is below max);
 *   3. an item (rare, `itemChance`, or forced by `def.rewardItem`) — else a bigger gold pile.
 */
export type RewardOffer =
  | { kind: 'gold'; amount: number }
  | { kind: 'item'; id: ItemId }
  | { kind: 'heal'; hp: number }
  | { kind: 'rotate'; charges: number }

export const REWARD_HEAL = 3
export const REWARD_ROTATE = 1

/** ITEM-001: what survives between sessions. */
export interface RunSave {
  v: 1
  stepIndex: number
  entryHp: number
  entryRotate: number
  inventory: ItemInstance[]
  gold?: number
}

export class RunState {
  readonly config: RunConfig
  readonly steps: readonly RunStep[]
  private idx = 0
  /** HP the player had when the *current* step began; what `restartStep()` returns to. */
  private entryHp: number
  /** Shared Rotate charges the run had when the *current* step began; what `restartStep()` returns to. */
  private entryRotate = 0
  /** The live shared Rotate pool. Passed by handle (not by value) into pool-backed encounters. */
  private readonly rotatePool: RotatePool = { charges: 0 }
  /** ITEM-001: the run inventory, passed by handle into every encounter. */
  private readonly inv: Inventory = { slots: [] }
  /** ITEM-001: inventory snapshot at step entry (charges included), what a restart returns to. */
  private entryInventory: ItemInstance[] = []
  /** ITEM-001: the draft offered after the current step's win; null until `rewardOffers()` builds
   * it. Rebuilt deterministically, so the same offers come back after a reload. */
  private offers: RewardOffer[] | null = null
  private rewardTaken = false
  /** ITEM-001: a chosen heal reward, applied to the HP the next step starts with. */
  private pendingHeal = 0
  /** ITEM-001: run gold (nothing to spend it on yet — the shop is a later task). */
  private goldValue = 0
  private entryGold = 0
  private encounterState: EncounterState

  constructor(config: RunConfig, steps: readonly RunStep[]) {
    if (steps.length === 0) throw new Error('RunState needs at least one step')
    this.config = config
    this.steps = steps
    this.entryHp = config.playerMaxHp
    this.entryRotate = config.initialRotateCharges ?? 0
    this.rotatePool.charges = this.entryRotate
    for (const id of config.startingItems ?? []) this.addItem(id)
    this.entryInventory = this.snapshotInventory()
    this.encounterState = this.buildEncounterState()
  }

  private buildEncounterState(): EncounterState {
    const step = this.steps[this.idx]
    // ITEM-001: per-encounter items refill on entry; run-scoped ones keep what is left.
    for (const it of this.inv.slots) if (ITEMS[it.id].recharge === 'encounter') it.charges = ITEMS[it.id].charges
    this.offers = null
    this.rewardTaken = false
    return EncounterState.fromLevel(step.level, step.def, this.entryHp, this.rotatePool, this.config.playerMaxHp, this.inv)
  }

  private snapshotInventory(): ItemInstance[] {
    return this.inv.slots.map((it) => ({ ...it }))
  }

  // ---- ITEM-001: inventory ----

  /** Owned items with live charges (read-only view). */
  get inventory(): readonly ItemInstance[] {
    return this.inv.slots
  }
  get inventoryFull(): boolean {
    return this.inv.slots.length >= INVENTORY_SLOTS
  }
  hasItem(id: ItemId): boolean {
    return this.inv.slots.some((it) => it.id === id)
  }
  /** Adds `id` with full charges. Returns false when the inventory is full and no `replaceSlot` is given. */
  addItem(id: ItemId, replaceSlot?: number): boolean {
    const inst: ItemInstance = { id, charges: ITEMS[id].charges }
    if (replaceSlot !== undefined) {
      if (replaceSlot < 0 || replaceSlot >= this.inv.slots.length) return false
      this.inv.slots[replaceSlot] = inst
      return true
    }
    if (this.inventoryFull) return false
    this.inv.slots.push(inst)
    return true
  }

  // ---- ITEM-001: reward draft ----

  /** Is a draft due right now (current step won, not yet taken, not excluded, not the last step)? */
  get rewardPending(): boolean {
    if (!this.encounterState.won || this.rewardTaken || this.isLastStep) return false
    return !(this.config.noRewardAfter ?? []).includes(this.steps[this.idx].id)
  }

  /**
   * The draft for the current (won) step: up to `rewardChoices` distinct offers, deterministic from
   * `runSeed` + step id. Items already owned are not offered; a full inventory still offers items
   * (the UI then asks which slot to replace). A heal is only offered when HP is below max.
   */
  rewardOffers(): RewardOffer[] {
    if (!this.rewardPending) return []
    if (this.offers) return this.offers
    const step = this.steps[this.idx]
    const rng = createRng(deriveSeed(this.config.runSeed ?? 1, hashString(step.id)))
    const gold = (this.config.goldBase ?? 8) + (this.config.goldPerStep ?? 2) * this.idx
    const offers: RewardOffer[] = [{ kind: 'gold', amount: gold }]
    // Card 2: heal while hurt, otherwise a Rotate charge.
    offers.push(this.encounterState.playerHp < this.config.playerMaxHp ? { kind: 'heal', hp: REWARD_HEAL } : { kind: 'rotate', charges: REWARD_ROTATE })
    // Card 3: a rare item — forced by the step, else by chance — from the ones not yet owned.
    const unowned = ITEM_IDS.filter((id) => !this.hasItem(id))
    const roll = rng.next()
    const wantItem = unowned.length > 0 && (step.def.rewardItem === true || roll < (this.config.itemChance ?? 0.3))
    if (wantItem) offers.push({ kind: 'item', id: unowned[rng.int(unowned.length)] })
    else offers.push({ kind: 'gold', amount: gold * 2 })
    this.offers = offers
    return this.offers
  }

  /** ITEM-001: run gold. */
  get gold(): number {
    return this.goldValue
  }

  /** Applies offer `index`. For an item with a full inventory `replaceSlot` is required (else false). */
  chooseReward(index: number, replaceSlot?: number): boolean {
    const o = this.rewardOffers()[index]
    if (!o) return false
    if (o.kind === 'gold') {
      this.goldValue += o.amount
    } else if (o.kind === 'item') {
      if (!this.addItem(o.id, this.inventoryFull ? replaceSlot : undefined)) return false
    } else if (o.kind === 'heal') {
      this.pendingHeal += o.hp
    } else {
      this.rotatePool.charges += o.charges
    }
    this.rewardTaken = true
    return true
  }
  skipReward(): void {
    this.rewardTaken = true
  }

  get stepIndex(): number {
    return this.idx
  }
  get currentStep(): RunStep {
    return this.steps[this.idx]
  }
  /** The live per-encounter combat state: tap/rotate/undo and all EXP-008/010 getters live here. */
  get encounter(): EncounterState {
    return this.encounterState
  }
  /** HP snapshot the current step started with (what a restart of this step returns to). */
  get hpAtEntry(): number {
    return this.entryHp
  }
  /** Shared Rotate charges right now (the run pool). Pre-boss prologue: 0. */
  get rotateCharges(): number {
    return this.rotatePool.charges
  }
  /** Shared Rotate charges the current step started with (what a restart of this step returns to). */
  get rotateChargesAtEntry(): number {
    return this.entryRotate
  }
  get maxHp(): number {
    return this.config.playerMaxHp
  }
  get isFirstStep(): boolean {
    return this.stepIndex === 0
  }
  get isLastStep(): boolean {
    return this.stepIndex === this.steps.length - 1
  }
  /** The whole run is cleared: the last step's encounter is won. */
  get runWon(): boolean {
    return this.isLastStep && this.encounterState.won
  }
  /** The run has failed: the active encounter ended without being won (death or empty board). */
  get runLost(): boolean {
    return this.encounterState.lost
  }

  /**
   * Moves on to the next step, carrying over the HP the player finished the current step with.
   * Also claims the completed step's `winRotateReward` (e.g. prologue boss +2) into the shared
   * pool exactly once — `advance()` is a one-way gate (no-op unless the current step is won),
   * so a reward can never be granted twice. Returns false (no-op) if the current step is not
   * won yet, or it was the last step.
   */
  advance(): boolean {
    if (!this.encounterState.won || this.isLastStep) return false
    this.rotatePool.charges += this.steps[this.idx].def.winRotateReward ?? 0
    // ACT-I-003: rest beat — heal on completion, capped at max HP. ITEM-001: plus a chosen heal reward.
    this.entryHp = Math.min(this.config.playerMaxHp, this.encounterState.playerHp + (this.steps[this.idx].def.winHeal ?? 0) + this.pendingHeal)
    this.pendingHeal = 0
    this.entryRotate = this.rotatePool.charges
    this.entryInventory = this.snapshotInventory()
    this.entryGold = this.goldValue
    this.idx++
    this.encounterState = this.buildEncounterState()
    return true
  }

  /** Restarts only the active step, HP and shared Rotate charges reset to the snapshots it began with. */
  restartStep(): void {
    this.rotatePool.charges = this.entryRotate
    this.inv.slots = this.entryInventory.map((it) => ({ ...it }))
    this.pendingHeal = 0
    this.goldValue = this.entryGold
    this.encounterState = this.buildEncounterState()
  }

  /** Restarts the whole run: back to step 0 with full max HP and starting Rotate pool. */
  restartRun(): void {
    this.idx = 0
    this.entryHp = this.config.playerMaxHp
    this.entryRotate = this.config.initialRotateCharges ?? 0
    this.rotatePool.charges = this.entryRotate
    this.inv.slots = []
    for (const id of this.config.startingItems ?? []) this.addItem(id)
    this.entryInventory = this.snapshotInventory()
    this.pendingHeal = 0
    this.goldValue = 0
    this.entryGold = 0
    this.encounterState = this.buildEncounterState()
  }

  // ---- ITEM-001: persistence (run-level only; the active encounter restarts on load) ----

  toJSON(): RunSave {
    return { v: 1, stepIndex: this.idx, entryHp: this.entryHp, entryRotate: this.entryRotate, inventory: this.entryInventory.map((it) => ({ ...it })), gold: this.entryGold }
  }

  /** Restores a save onto the same step list: the saved step restarts from its entry snapshot. */
  static fromJSON(config: RunConfig, steps: readonly RunStep[], save: RunSave): RunState {
    if (!save || save.v !== 1 || !Number.isInteger(save.stepIndex) || save.stepIndex < 0 || save.stepIndex >= steps.length) throw new Error('bad run save')
    const run = new RunState(config, steps)
    run.idx = save.stepIndex
    run.entryHp = Math.min(config.playerMaxHp, Math.max(1, save.entryHp))
    run.entryRotate = Math.max(0, save.entryRotate)
    run.rotatePool.charges = run.entryRotate
    run.inv.slots = (save.inventory ?? []).filter((it) => it && it.id in ITEMS).slice(0, INVENTORY_SLOTS).map((it) => ({ id: it.id, charges: Math.max(0, it.charges | 0) }))
    run.entryInventory = run.snapshotInventory()
    run.goldValue = Math.max(0, save.gold ?? 0)
    run.entryGold = run.goldValue
    run.encounterState = run.buildEncounterState()
    return run
  }

  /** Jumps to an arbitrary step for debugging, HP reset to max. Not part of a normal playthrough. */
  debugJumpTo(stepIndex: number, rotateCharges?: number): void {
    if (stepIndex < 0 || stepIndex >= this.steps.length) throw new Error(`bad step index ${stepIndex}`)
    this.idx = stepIndex
    this.entryHp = this.config.playerMaxHp
    if (rotateCharges !== undefined) {
      this.rotatePool.charges = rotateCharges
    }
    this.entryRotate = this.rotatePool.charges
    this.entryInventory = this.snapshotInventory()
    this.encounterState = this.buildEncounterState()
  }
}
