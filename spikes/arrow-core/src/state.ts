import type { Level } from './level.js'
import { BoardTopology } from './topology.js'

export type RemoveResult = { ok: true } | { ok: false; reason: 'gone' | 'blocked'; blocker: number }

/**
 * Mutable play state of one board.
 *
 * Blocking rule: an arrow can leave iff every cell on its straight escape ray (head exclusive,
 * up to the edge) is empty. Its own body counts as an obstacle. Nothing else needs checking: while
 * sliding out, body segments only enter cells the arrow already occupies or the head has already
 * swept.
 *
 * Maintained incrementally: `rayBlock[id]` = number of occupied cells on the ray of `id`.
 * Removing an arrow touches only the rays crossing its cells; `undo()` reverts exactly, which is
 * what a depth-first EncounterSolver needs.
 */
export class BoardState {
  readonly topo: BoardTopology
  private readonly owner: Int32Array
  private readonly rayBlock: Int32Array
  private readonly alive: Uint8Array
  private readonly history: number[] = []
  private free = 0
  private left: number

  constructor(topo: BoardTopology) {
    this.topo = topo
    this.owner = topo.initialOwner.slice()
    const n = topo.arrowCount
    this.rayBlock = new Int32Array(n)
    this.alive = new Uint8Array(n).fill(1)
    this.left = n
    for (let id = 0; id < n; id++) {
      let blocked = 0
      for (let i = topo.rayStart[id]; i < topo.rayStart[id + 1]; i++) {
        if (this.owner[topo.rayCells[i]] !== -1) blocked++
      }
      this.rayBlock[id] = blocked
      if (blocked === 0) this.free++
    }
  }

  static fromLevel(level: Level): BoardState {
    return new BoardState(BoardTopology.fromLevel(level))
  }

  clone(): BoardState {
    const c = Object.create(BoardState.prototype) as BoardState
    const w = c as unknown as {
      topo: BoardTopology
      owner: Int32Array
      rayBlock: Int32Array
      alive: Uint8Array
      history: number[]
      free: number
      left: number
    }
    w.topo = this.topo
    w.owner = this.owner.slice()
    w.rayBlock = this.rayBlock.slice()
    w.alive = this.alive.slice()
    w.history = [...this.history]
    w.free = this.free
    w.left = this.left
    return c
  }

  get remaining(): number {
    return this.left
  }

  /** Number of arrows that can leave right now. */
  get freeCount(): number {
    return this.free
  }

  get cleared(): boolean {
    return this.left === 0
  }

  /** Removal order so far. */
  get removed(): readonly number[] {
    return this.history
  }

  isAlive(id: number): boolean {
    return this.alive[id] === 1
  }

  canExit(id: number): boolean {
    return this.alive[id] === 1 && this.rayBlock[id] === 0
  }

  ownerAt(cell: number): number {
    return this.owner[cell]
  }

  /** Nearest arrow on the escape ray (may be the arrow itself), or -1 if the ray is clear. */
  firstBlocker(id: number): number {
    const t = this.topo
    for (let i = t.rayStart[id]; i < t.rayStart[id + 1]; i++) {
      const o = this.owner[t.rayCells[i]]
      if (o !== -1) return o
    }
    return -1
  }

  /** Every distinct arrow currently on the escape ray, nearest first. */
  blockers(id: number): number[] {
    const t = this.topo
    const out: number[] = []
    for (let i = t.rayStart[id]; i < t.rayStart[id + 1]; i++) {
      const o = this.owner[t.rayCells[i]]
      if (o !== -1 && !out.includes(o)) out.push(o)
    }
    return out
  }

  freeArrows(out: number[] = []): number[] {
    out.length = 0
    for (let id = 0; id < this.topo.arrowCount; id++) if (this.canExit(id)) out.push(id)
    return out
  }

  /** Player-facing move: never throws. */
  tryRemove(id: number, newlyFree?: number[]): RemoveResult {
    if (id < 0 || id >= this.topo.arrowCount || this.alive[id] === 0) return { ok: false, reason: 'gone', blocker: -1 }
    if (this.rayBlock[id] !== 0) return { ok: false, reason: 'blocked', blocker: this.firstBlocker(id) }
    this.remove(id, newlyFree)
    return { ok: true }
  }

  /**
   * Removes a free arrow. Arrows that became free are appended to `newlyFree` when given.
   * Throws on an illegal move: solvers must only call it for `canExit(id)`.
   */
  remove(id: number, newlyFree?: number[]): void {
    if (!this.canExit(id)) throw new Error(`arrow ${id} cannot exit`)
    const t = this.topo
    this.alive[id] = 0
    this.free--
    this.left--
    for (let i = t.bodyStart[id]; i < t.bodyStart[id + 1]; i++) {
      const cell = t.bodyCells[i]
      this.owner[cell] = -1
      for (let j = t.rayByCellStart[cell]; j < t.rayByCellStart[cell + 1]; j++) {
        const a = t.rayArrows[j]
        if (--this.rayBlock[a] === 0 && this.alive[a] === 1) {
          this.free++
          newlyFree?.push(a)
        }
      }
    }
    this.history.push(id)
  }

  /** Reverts the last `remove`. Returns the restored arrow id, or -1 if there is nothing to undo. */
  undo(): number {
    const id = this.history.pop()
    if (id === undefined) return -1
    const t = this.topo
    for (let i = t.bodyStart[id]; i < t.bodyStart[id + 1]; i++) {
      const cell = t.bodyCells[i]
      this.owner[cell] = id
      for (let j = t.rayByCellStart[cell]; j < t.rayByCellStart[cell + 1]; j++) {
        const a = t.rayArrows[j]
        if (this.rayBlock[a]++ === 0 && this.alive[a] === 1) this.free--
      }
    }
    this.alive[id] = 1
    this.free++
    this.left++
    return id
  }

  /** Compact key of the alive set, for memoization in search. */
  key(): string {
    let s = ''
    let word = 0
    const n = this.topo.arrowCount
    for (let id = 0; id < n; id++) {
      if (this.alive[id]) word |= 1 << id % 30
      if (id % 30 === 29 || id === n - 1) {
        s += word.toString(36) + '.'
        word = 0
      }
    }
    return s
  }
}
