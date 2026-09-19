// LD-007 shared helpers for the design audit/scan tools (provisional design tooling).
const sym = ['^', '>', 'v', '<']

/** ASCII board: arrow index in base36 on each body cell, direction glyph on the head cell. */
export function ascii(level) {
  const w = level.width, h = level.height
  const grid = Array.from({ length: h }, () => Array(w).fill(' . '))
  level.arrows.forEach((a, i) => {
    a.cells.forEach((c, k) => {
      const x = c % w, y = (c - x) / w
      const lab = i.toString(36)
      grid[y][x] = k === a.cells.length - 1 ? ` ${lab}${sym[a.dir]}` : ` ${lab} `
    })
  })
  return grid.map((r) => r.join('')).join('\n')
}
