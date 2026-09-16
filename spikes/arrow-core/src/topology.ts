import { type Level, rayCells } from './level.js'

/**
 * Immutable, precomputed geometry of a level: every arrow's cells and escape ray as flat typed
 * arrays, plus the reverse index "cell -> arrows whose ray passes through it".
 *
 * Built once per level and shared by any number of `BoardState`s, so search-based solvers
 * (a future EncounterSolver) can clone states cheaply.
 */
export class BoardTopology {
  readonly width: number
  readonly height: number
  readonly arrowCount: number
  /** Arrow id per cell at the start, -1 for empty. */
  readonly initialOwner: Int32Array
  readonly dirs: Uint8Array
  readonly bodyStart: Int32Array
  readonly bodyCells: Int32Array
  readonly rayStart: Int32Array
  readonly rayCells: Int32Array
  /** For cell c, `rayArrows[rayByCellStart[c] .. rayByCellStart[c+1])` lists arrows whose ray crosses c. */
  readonly rayByCellStart: Int32Array
  readonly rayArrows: Int32Array

  private constructor(level: Level) {
    const { width, height, arrows } = level
    const cellCount = width * height
    const n = arrows.length
    this.width = width
    this.height = height
    this.arrowCount = n

    this.initialOwner = new Int32Array(cellCount).fill(-1)
    this.dirs = new Uint8Array(n)
    this.bodyStart = new Int32Array(n + 1)
    this.rayStart = new Int32Array(n + 1)

    const rays: number[][] = []
    let bodyTotal = 0
    let rayTotal = 0
    for (let id = 0; id < n; id++) {
      const a = arrows[id]
      if (a.id !== id) throw new Error(`arrow id ${a.id} at index ${id}`)
      this.dirs[id] = a.dir
      this.bodyStart[id] = bodyTotal
      bodyTotal += a.cells.length
      const ray = rayCells(width, height, a.cells[a.cells.length - 1], a.dir)
      rays.push(ray)
      this.rayStart[id] = rayTotal
      rayTotal += ray.length
    }
    this.bodyStart[n] = bodyTotal
    this.rayStart[n] = rayTotal

    this.bodyCells = new Int32Array(bodyTotal)
    this.rayCells = new Int32Array(rayTotal)
    const perCell = new Int32Array(cellCount + 1)
    for (let id = 0; id < n; id++) {
      const a = arrows[id]
      this.bodyCells.set(a.cells, this.bodyStart[id])
      for (const c of a.cells) this.initialOwner[c] = id
      this.rayCells.set(rays[id], this.rayStart[id])
      for (const c of rays[id]) perCell[c + 1]++
    }
    for (let c = 0; c < cellCount; c++) perCell[c + 1] += perCell[c]
    this.rayByCellStart = perCell
    this.rayArrows = new Int32Array(rayTotal)
    const fill = perCell.slice(0, cellCount)
    for (let id = 0; id < n; id++) for (const c of rays[id]) this.rayArrows[fill[c]++] = id
  }

  static fromLevel(level: Level): BoardTopology {
    return new BoardTopology(level)
  }

  head(id: number): number {
    return this.bodyCells[this.bodyStart[id + 1] - 1]
  }
}
