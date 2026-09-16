import { type Dir, DX, DY } from './dir.js'

/**
 * An arrow is a self-avoiding orthogonal path of cells, tail first, head last.
 * Cells are flat indices `y * width + x`. The head points along its last segment.
 */
export interface Arrow {
  /** Equals the arrow's index in `Level.arrows`. */
  readonly id: number
  readonly cells: readonly number[]
  readonly dir: Dir
}

/**
 * Immutable level description. Play and solving happen on a separate mutable `BoardState`,
 * so a Level can be cached, shared and serialized freely.
 */
export interface Level {
  readonly width: number
  readonly height: number
  readonly arrows: readonly Arrow[]
  /** A removal order (arrow ids) that clears the board without ever tapping a blocked arrow. */
  readonly solution: readonly number[]
  /** Seed the level was generated from, if any. */
  readonly seed?: number
}

export const cellOf = (width: number, x: number, y: number): number => y * width + x
export const xOf = (width: number, cell: number): number => cell % width
export const yOf = (width: number, cell: number): number => (cell - (cell % width)) / width
export const headOf = (a: Arrow): number => a.cells[a.cells.length - 1]

/** Interior cells swept by the head on its way out, nearest first. Excludes the head itself. */
export function rayCells(width: number, height: number, head: number, dir: Dir): number[] {
  const out: number[] = []
  let x = xOf(width, head) + DX[dir]
  let y = yOf(width, head) + DY[dir]
  while (x >= 0 && y >= 0 && x < width && y < height) {
    out.push(y * width + x)
    x += DX[dir]
    y += DY[dir]
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Serialization

export const LEVEL_FORMAT = 'arrow-core-level'
export const LEVEL_FORMAT_VERSION = 1

export interface LevelJson {
  format: typeof LEVEL_FORMAT
  v: number
  w: number
  h: number
  seed?: number
  /** Each arrow as `[dir, tailCell, ..., headCell]`. Arrow id = array index. */
  arrows: number[][]
  solution: number[]
}

export function levelToJson(level: Level): LevelJson {
  const json: LevelJson = {
    format: LEVEL_FORMAT,
    v: LEVEL_FORMAT_VERSION,
    w: level.width,
    h: level.height,
    arrows: level.arrows.map((a) => [a.dir, ...a.cells]),
    solution: [...level.solution],
  }
  if (level.seed !== undefined) json.seed = level.seed
  return json
}

/** Parses the wire shape only. Run `validateLevel` for semantic checks. */
export function levelFromJson(raw: unknown): Level {
  const j = raw as Partial<LevelJson>
  if (!j || j.format !== LEVEL_FORMAT) throw new Error('not an arrow-core level')
  if (j.v !== LEVEL_FORMAT_VERSION) throw new Error(`unsupported level version ${String(j.v)}`)
  if (!Number.isInteger(j.w) || !Number.isInteger(j.h)) throw new Error('bad dimensions')
  if (!Array.isArray(j.arrows) || !Array.isArray(j.solution)) throw new Error('bad arrows/solution')
  const arrows: Arrow[] = j.arrows.map((row, id) => {
    if (!Array.isArray(row) || row.length < 1) throw new Error(`bad arrow ${id}`)
    const [dir, ...cells] = row
    if (dir !== 0 && dir !== 1 && dir !== 2 && dir !== 3) throw new Error(`bad dir on arrow ${id}`)
    return { id, dir, cells }
  })
  return { width: j.w as number, height: j.h as number, arrows, solution: [...j.solution], seed: j.seed }
}

/** Stable 32-bit FNV-1a fingerprint of the geometry and solution, as 8 hex chars. */
export function levelHash(level: Level): string {
  let h = 0x811c9dc5
  const feed = (n: number) => {
    let v = n >>> 0
    for (let i = 0; i < 4; i++) {
      h ^= v & 0xff
      h = Math.imul(h, 0x01000193)
      v >>>= 8
    }
  }
  feed(level.width)
  feed(level.height)
  feed(level.arrows.length)
  for (const a of level.arrows) {
    feed(a.dir)
    feed(a.cells.length)
    for (const c of a.cells) feed(c)
  }
  for (const id of level.solution) feed(id)
  return (h >>> 0).toString(16).padStart(8, '0')
}
