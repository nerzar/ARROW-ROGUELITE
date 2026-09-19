import { type EncounterDef, EncounterState, type RotatePool } from './encounter.js'
import { type Inventory, INVENTORY_SLOTS, isConsumable, type ItemId, type ItemInstance, ITEM_IDS, ITEMS, type RelicId, RELIC_IDS, RELICS } from './items.js'
import type { Level } from './level.js'
import { createRng, deriveSeed, hashString } from './rng.js'
import { getAvailableRouteNodes, type RouteGraph, type RouteNode } from './route-map.js'

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
  /** ITEM-002: relics the run starts with (debug/tests). */
  startingRelics?: RelicId[]
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
  /** MAP-001: data-driven route graph for branching act traversal. If omitted, linear step-order flow is used. */
  routeGraph?: RouteGraph | null
  /** MAP-001: optional initial route node to start on. */
  initialRouteNodeId?: string | null
  /** MAP-001: whether to start on the route map awaiting initial node selection (default false, starts at initialRouteNodeId/entryNodeIds[0]). */
  startOnRouteMap?: boolean
}

/**
 * ITEM-001 / ITEM-002: one card of the post-encounter draft. The draft is always three cards:
 *   1. gold (the ordinary reward, always present);
 *   2. a potion charge while hurt (and potion not full), else +Rotate;
 *   3. a rare item or relic (`itemChance`, or forced by `def.rewardItem`) — else arrows ×2 — else a bigger gold pile.
 */
export type RewardOffer =
  | { kind: 'gold'; amount: number }
  /** A rare item, or `charges` more of a consumable (potion / arrows) you may already own. */
  | { kind: 'item'; id: ItemId; charges?: number }
  | { kind: 'relic'; id: RelicId }
  | { kind: 'rotate'; charges: number }

export const REWARD_ROTATE = 1
export const REWARD_POTIONS = 1
export const REWARD_ARROWS = 2

/** ITEM-001 / MAP-001: what survives between sessions. */
export interface RunSave {
  v: 1
  stepIndex: number
  entryHp: number
  entryRotate: number
  inventory: ItemInstance[]
  relics?: RelicId[]
  gold?: number
  /** MAP-001: route map node state */
  currentNodeId?: string | null
  visitedNodeIds?: string[]
  routeMapPending?: boolean
  inShop?: boolean
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
  /** ITEM-002: owned passive relics. */
  private relicList: RelicId[] = []
  private entryRelics: RelicId[] = []
  private encounterState: EncounterState

  // MAP-001: Route map state
  private readonly routeGraph: RouteGraph | null = null
  private currentNodeIdValue: string | null = null
  private visitedNodeIdsValue: string[] = []
  private entryCurrentNodeId: string | null = null
  private entryVisitedNodeIds: string[] = []
  private routeMapPendingValue = false
  private inShopValue = false

  constructor(config: RunConfig, steps: readonly RunStep[]) {
    if (steps.length === 0) throw new Error('RunState needs at least one step')
    this.config = config
    this.steps = steps
    this.entryHp = config.playerMaxHp
    this.entryRotate = config.initialRotateCharges ?? 0
    this.rotatePool.charges = this.entryRotate
    for (const id of config.startingItems ?? []) this.addItem(id)
    this.relicList = [...(config.startingRelics ?? [])]
    this.entryRelics = [...this.relicList]
    this.entryInventory = this.snapshotInventory()

    this.routeGraph = config.routeGraph ?? null
    if (this.routeGraph) {
      if (config.initialRouteNodeId) {
        this.currentNodeIdValue = config.initialRouteNodeId
        const node = this.routeGraph.nodes[config.initialRouteNodeId]
        if (node?.stepId) {
          const sIdx = steps.findIndex((s) => s.id === node.stepId)
          if (sIdx >= 0) this.idx = sIdx
        }
        this.routeMapPendingValue = Boolean(config.startOnRouteMap)
      } else if (config.startOnRouteMap) {
        this.currentNodeIdValue = null
        this.routeMapPendingValue = true
      } else {
        this.currentNodeIdValue = this.routeGraph.entryNodeIds[0] ?? null
        if (this.currentNodeIdValue) {
          const node = this.routeGraph.nodes[this.currentNodeIdValue]
          if (node?.stepId) {
            const sIdx = steps.findIndex((s) => s.id === node.stepId)
            if (sIdx >= 0) this.idx = sIdx
          }
        }
        this.routeMapPendingValue = false
      }
      this.entryCurrentNodeId = this.currentNodeIdValue
      this.entryVisitedNodeIds = []
    }

    this.encounterState = this.buildEncounterState()
  }

  private buildEncounterState(): EncounterState {
    const step = this.steps[this.idx]
    // ITEM-001: per-encounter items refill on entry; run-scoped ones keep what is left.
    for (const it of this.inv.slots) if (ITEMS[it.id].recharge === 'encounter') it.charges = ITEMS[it.id].charges
    this.offers = null
    this.rewardTaken = false
    return EncounterState.fromLevel(step.level, step.def, this.entryHp, this.rotatePool, this.config.playerMaxHp, this.inv, this.relicList)
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
  /** Adds `id` with full charges (a consumable already owned just gains `charges`, capped at its
   * `maxCharges`). Returns false when the inventory is full and no `replaceSlot` is given. */
  addItem(id: ItemId, replaceSlot?: number, charges = ITEMS[id].charges): boolean {
    const owned = this.inv.slots.find((it) => it.id === id)
    if (owned && isConsumable(id)) {
      owned.charges = Math.min(ITEMS[id].maxCharges!, owned.charges + charges)
      return true
    }
    const inst: ItemInstance = { id, charges: Math.min(ITEMS[id].maxCharges ?? charges, charges) }
    if (replaceSlot !== undefined) {
      if (replaceSlot < 0 || replaceSlot >= this.inv.slots.length) return false
      this.inv.slots[replaceSlot] = inst
      return true
    }
    if (this.inventoryFull) return false
    this.inv.slots.push(inst)
    return true
  }

  // ---- ITEM-002: relics ----

  get relics(): readonly RelicId[] {
    return this.relicList
  }
  hasRelic(id: RelicId): boolean {
    return this.relicList.includes(id)
  }
  addRelic(id: RelicId): boolean {
    if (this.hasRelic(id)) return false
    this.relicList.push(id)
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
    // Card 2 (user rule 2026-09-19): a potion while hurt (a consumable you carry, not an instant heal),
    // otherwise a Rotate charge.
    const potionFull = this.inv.slots.find((it) => it.id === 'potion')?.charges === ITEMS.potion.maxCharges
    offers.push(this.encounterState.playerHp < this.config.playerMaxHp && !potionFull ? { kind: 'item', id: 'potion', charges: REWARD_POTIONS } : { kind: 'rotate', charges: REWARD_ROTATE })
    // Card 3: a rare item or relic — weighted from unowned non-consumable candidates (forced by the
    // step or by chance); else arrows for the consumable; else a big gold pile.
    const unownedItems = ITEM_IDS.filter((id) => !isConsumable(id) && !this.hasItem(id) && ITEMS[id].weight > 0)
    const unownedRelics = RELIC_IDS.filter((id) => !this.hasRelic(id))
    const pool: ({ kind: 'item'; id: ItemId; weight: number } | { kind: 'relic'; id: RelicId; weight: number })[] = [
      ...unownedItems.map((id) => ({ kind: 'item' as const, id, weight: ITEMS[id].weight })),
      ...unownedRelics.map((id) => ({ kind: 'relic' as const, id, weight: RELICS[id].weight })),
    ]
    const pickWeighted = <T extends { weight: number }>(list: T[]): T => {
      const total = list.reduce((sum, e) => sum + e.weight, 0)
      let pickVal = rng.next() * total
      for (const e of list) {
        if (pickVal < e.weight) return e
        pickVal -= e.weight
      }
      return list[list.length - 1]
    }
    const roll = rng.next()
    const itemChance = this.config.itemChance ?? 0.3
    const arrowsFull = this.inv.slots.find((it) => it.id === 'arrow')?.charges === ITEMS.arrow.maxCharges
    if (step.def.rewardItem === true && unownedItems.length > 0) {
      offers.push({ kind: 'item', id: pickWeighted(unownedItems.map((id) => ({ id, weight: ITEMS[id].weight }))).id })
    } else if (pool.length > 0 && roll < itemChance) {
      const chosen = pickWeighted(pool)
      if (chosen.kind === 'item') offers.push({ kind: 'item', id: chosen.id })
      else offers.push({ kind: 'relic', id: chosen.id })
    } else if (!arrowsFull && roll < itemChance + 0.35) {
      offers.push({ kind: 'item', id: 'arrow', charges: REWARD_ARROWS })
    } else {
      offers.push({ kind: 'gold', amount: gold * 2 })
    }
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
      const needsSlot = this.inventoryFull && !(isConsumable(o.id) && this.hasItem(o.id))
      if (!this.addItem(o.id, needsSlot ? replaceSlot : undefined, o.charges)) return false
    } else if (o.kind === 'relic') {
      this.addRelic(o.id)
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
    if (this.hasRouteGraph) {
      return this.visitedNodeIdsValue.length === 0
    }
    return this.stepIndex === 0
  }
  get isLastStep(): boolean {
    if (this.hasRouteGraph) {
      if (this.currentNode?.type === 'boss') return true
      if (this.availableRouteNodes.length === 0 && !this.routeMapPendingValue) return true
      return false
    }
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

  // ---- MAP-001: route map progression ----

  get hasRouteGraph(): boolean {
    return this.routeGraph !== null
  }
  get routeGraphDef(): RouteGraph | null {
    return this.routeGraph
  }
  get currentNode(): RouteNode | null {
    if (!this.routeGraph || !this.currentNodeIdValue) return null
    return this.routeGraph.nodes[this.currentNodeIdValue] ?? null
  }
  get currentNodeId(): string | null {
    return this.currentNodeIdValue
  }
  get visitedNodeIds(): readonly string[] {
    return this.visitedNodeIdsValue
  }
  get routeMapPending(): boolean {
    return this.hasRouteGraph ? this.routeMapPendingValue : false
  }
  get inShop(): boolean {
    return this.hasRouteGraph ? this.inShopValue : false
  }
  get availableRouteNodes(): RouteNode[] {
    if (!this.routeGraph) return []
    return getAvailableRouteNodes(this.routeGraph, this.currentNodeIdValue, this.visitedNodeIdsValue)
  }
  get availableRouteNodeIds(): string[] {
    return this.availableRouteNodes.map((n) => n.id)
  }

  /**
   * Selects an available route node to progress the run.
   * If a battle or boss node is selected, switches active encounter to its step and clears map pending.
   * If a shop node is selected, sets inShop = true for SHOP-001 handling.
   */
  selectRouteNode(nodeId: string): boolean {
    if (!this.hasRouteGraph || !this.routeGraph) return false
    const targetNode = this.routeGraph.nodes[nodeId]
    if (!targetNode) return false
    const available = this.availableRouteNodeIds
    if (!available.includes(nodeId)) return false

    this.currentNodeIdValue = nodeId
    this.entryCurrentNodeId = nodeId
    this.entryVisitedNodeIds = [...this.visitedNodeIdsValue]
    this.routeMapPendingValue = false

    if (targetNode.type === 'shop') {
      this.inShopValue = true
      return true
    }

    this.inShopValue = false
    if (targetNode.stepId) {
      const sIdx = this.steps.findIndex((s) => s.id === targetNode.stepId)
      if (sIdx >= 0) {
        this.idx = sIdx
      }
    }
    this.encounterState = this.buildEncounterState()
    return true
  }

  /**
   * Completes a visit to a shop node (SHOP-001 beat) and transitions back to route map
   * so the player can pick the next node.
   */
  leaveShop(): void {
    if (!this.inShopValue) return
    if (this.currentNodeIdValue && !this.visitedNodeIdsValue.includes(this.currentNodeIdValue)) {
      this.visitedNodeIdsValue.push(this.currentNodeIdValue)
    }
    this.inShopValue = false
    this.routeMapPendingValue = true
  }

  /**
   * Moves on to the next step, carrying over the HP the player finished the current step with.
   * Also claims the completed step's `winRotateReward` (e.g. prologue boss +2) into the shared
   * pool exactly once — `advance()` is a one-way gate (no-op unless the current step is won),
   * so a reward can never be granted twice.
   * In route map mode, marks current node as visited and sets routeMapPending = true instead
   * of advancing a linear index.
   * Returns false (no-op) if the current step is not won yet, or it was the last step.
   */
  advance(): boolean {
    if (!this.encounterState.won || this.isLastStep) return false
    this.rotatePool.charges += this.steps[this.idx].def.winRotateReward ?? 0
    // ACT-I-003: rest beat — heal on completion, capped at max HP. ITEM-001: plus a chosen heal reward.
    this.entryHp = Math.min(this.config.playerMaxHp, this.encounterState.playerHp + (this.steps[this.idx].def.winHeal ?? 0) + this.pendingHeal)
    this.pendingHeal = 0
    this.entryRotate = this.rotatePool.charges
    this.entryInventory = this.snapshotInventory()
    this.entryRelics = [...this.relicList]
    this.entryGold = this.goldValue

    if (this.hasRouteGraph) {
      if (this.currentNodeIdValue && !this.visitedNodeIdsValue.includes(this.currentNodeIdValue)) {
        this.visitedNodeIdsValue.push(this.currentNodeIdValue)
      }
      this.routeMapPendingValue = true
      return true
    }

    this.idx++
    this.encounterState = this.buildEncounterState()
    return true
  }

  /** Restarts only the active step, HP and shared Rotate charges reset to the snapshots it began with. */
  restartStep(): void {
    this.rotatePool.charges = this.entryRotate
    this.inv.slots = this.entryInventory.map((it) => ({ ...it }))
    this.relicList = [...this.entryRelics]
    this.pendingHeal = 0
    this.goldValue = this.entryGold
    if (this.hasRouteGraph) {
      this.currentNodeIdValue = this.entryCurrentNodeId
      this.visitedNodeIdsValue = [...this.entryVisitedNodeIds]
      this.routeMapPendingValue = false
      this.inShopValue = false
    }
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
    this.relicList = [...(this.config.startingRelics ?? [])]
    this.entryRelics = [...this.relicList]
    this.entryInventory = this.snapshotInventory()
    this.pendingHeal = 0
    this.goldValue = 0
    this.entryGold = 0

    if (this.hasRouteGraph) {
      this.visitedNodeIdsValue = []
      this.entryVisitedNodeIds = []
      this.inShopValue = false

      if (this.config.startOnRouteMap) {
        this.currentNodeIdValue = null
        this.entryCurrentNodeId = null
        this.routeMapPendingValue = true
      } else {
        this.currentNodeIdValue = this.config.initialRouteNodeId ?? this.routeGraph!.entryNodeIds[0] ?? null
        this.entryCurrentNodeId = this.currentNodeIdValue
        this.routeMapPendingValue = false
        if (this.currentNodeIdValue && this.routeGraph!.nodes[this.currentNodeIdValue]?.stepId) {
          const sId = this.routeGraph!.nodes[this.currentNodeIdValue].stepId
          const sIdx = this.steps.findIndex((s) => s.id === sId)
          if (sIdx >= 0) this.idx = sIdx
        }
      }
    }

    this.encounterState = this.buildEncounterState()
  }

  // ---- ITEM-001 / MAP-001: persistence (run-level only; the active encounter restarts on load) ----

  toJSON(): RunSave {
    const save: RunSave = {
      v: 1,
      stepIndex: this.idx,
      entryHp: this.entryHp,
      entryRotate: this.entryRotate,
      inventory: this.entryInventory.map((it) => ({ ...it })),
      relics: [...this.entryRelics],
      gold: this.entryGold,
    }
    if (this.hasRouteGraph) {
      save.currentNodeId = this.currentNodeIdValue
      save.visitedNodeIds = [...this.visitedNodeIdsValue]
      save.routeMapPending = this.routeMapPendingValue
      save.inShop = this.inShopValue
    }
    return save
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
    run.relicList = (save.relics ?? []).filter((id) => id in RELICS)
    run.entryRelics = [...run.relicList]
    run.goldValue = Math.max(0, save.gold ?? 0)
    run.entryGold = run.goldValue

    if (run.hasRouteGraph) {
      run.currentNodeIdValue = save.currentNodeId ?? null
      run.visitedNodeIdsValue = Array.isArray(save.visitedNodeIds) ? [...save.visitedNodeIds] : []
      run.entryCurrentNodeId = run.currentNodeIdValue
      run.entryVisitedNodeIds = [...run.visitedNodeIdsValue]
      run.routeMapPendingValue = Boolean(save.routeMapPending)
      run.inShopValue = Boolean(save.inShop)
    }

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

    if (this.hasRouteGraph && this.routeGraph) {
      const targetStepId = this.steps[stepIndex].id
      const foundEntry = Object.entries(this.routeGraph.nodes).find(([, n]) => n.stepId === targetStepId)
      if (foundEntry) {
        this.currentNodeIdValue = foundEntry[0]
        this.entryCurrentNodeId = foundEntry[0]
      }
      this.routeMapPendingValue = false
      this.inShopValue = false
    }

    this.encounterState = this.buildEncounterState()
  }

  /** MAP-001: Debug jumps directly to a specific route node. */
  debugJumpToNode(nodeId: string, rotateCharges?: number): void {
    if (!this.hasRouteGraph || !this.routeGraph) throw new Error('No route graph configured')
    const node = this.routeGraph.nodes[nodeId]
    if (!node) throw new Error(`Unknown node "${nodeId}"`)
    this.currentNodeIdValue = nodeId
    this.entryCurrentNodeId = nodeId
    this.routeMapPendingValue = false
    if (node.type === 'shop') {
      this.inShopValue = true
      return
    }
    this.inShopValue = false
    if (node.stepId) {
      const sIdx = this.steps.findIndex((s) => s.id === node.stepId)
      if (sIdx >= 0) this.idx = sIdx
    }
    this.entryHp = this.config.playerMaxHp
    if (rotateCharges !== undefined) {
      this.rotatePool.charges = rotateCharges
    }
    this.entryRotate = this.rotatePool.charges
    this.entryInventory = this.snapshotInventory()
    this.encounterState = this.buildEncounterState()
  }
}
