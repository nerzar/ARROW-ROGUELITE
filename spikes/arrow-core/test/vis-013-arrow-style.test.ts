// VIS-013: live arrow renderer reference spike — style/geo/focus/timing contracts.
// The canvas drawing itself (board-renderer.js drawArrow) is verified in the browser;
// everything testable without a canvas lives in viewer/visual-proto/arrow-style.js
// (pure data + math) and is pinned here: 3 warm variants, rounded-bend math, the
// hover/hint-only effect gate, and deterministic (flicker-free) spark timing.
import { describe, expect, it } from 'vitest'
import {
  ARROW_PALETTES,
  ARROW_STYLES,
  arrowFocus,
  arrowPalette,
  BEND_RADIUS_FAC,
  clampBendRadius,
  cornerTrim,
  DEFAULT_ARROW_STYLE,
  normalizeArrowStyle,
  SPARK_PERIOD_MS,
  sparkParams,
} from '../viewer/visual-proto/arrow-style.js'

/** Parse #rrggbb / rgba(r,g,b,a) into [r, g, b]; throws on anything else. */
function rgb(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])]
  throw new Error(`unparsable test color ${color}`)
}

describe('VIS-013 arrow styles', () => {
  it('defines exactly the three approved variants with flat as default', () => {
    expect([...ARROW_STYLES]).toEqual(['fantasy-flat', 'fantasy-inlaid', 'fantasy-effect'])
    expect(DEFAULT_ARROW_STYLE).toBe('fantasy-flat')
    expect(normalizeArrowStyle('fantasy-inlaid')).toBe('fantasy-inlaid')
    expect(normalizeArrowStyle('fantasy-effect')).toBe('fantasy-effect')
  })

  it('falls back to flat on anything unknown (never breaks the draw path)', () => {
    for (const bad of [null, undefined, '', 'neon', 42, 'FANTASY-FLAT']) {
      expect(normalizeArrowStyle(bad)).toBe('fantasy-flat')
      expect(arrowPalette(bad)).toBe(ARROW_PALETTES['fantasy-flat'])
    }
  })

  it('every arrow color role is warm metal, never neon (r >= g >= b)', () => {
    const roles = [
      'keyline', 'bodyFree', 'bodyAimed', 'bodyBlocked', 'core',
      'glowFree', 'glowAimed', 'bevel', 'rune', 'halo', 'highlight', 'spark',
    ] as const
    for (const style of ARROW_STYLES) {
      for (const role of roles) {
        const value = ARROW_PALETTES[style][role]
        if (value === null) continue // flat/inlaid simply lack the magic roles
        const [r, g, b] = rgb(value)
        expect([r, g, b], `${style}.${role} = ${value}`).toEqual([...[r, g, b]].sort((x, y) => y - x))
      }
    }
  })

  it('only the effect variant carries magic roles (halo/highlight/spark)', () => {
    expect(ARROW_PALETTES['fantasy-flat'].halo).toBeNull()
    expect(ARROW_PALETTES['fantasy-inlaid'].halo).toBeNull()
    expect(ARROW_PALETTES['fantasy-inlaid'].bevel).not.toBeNull() // inlay without magic
    const fx = ARROW_PALETTES['fantasy-effect']
    expect(fx.halo).not.toBeNull()
    expect(fx.highlight).not.toBeNull()
    expect(fx.spark).not.toBeNull()
  })
})

describe('VIS-013 rounded-bend math', () => {
  it('clamps the radius to half of either segment, collapses guards to 0', () => {
    expect(clampBendRadius(5, 10, 10)).toBe(5)
    expect(clampBendRadius(8, 10, 10)).toBe(5)
    expect(clampBendRadius(5, 4, 20)).toBe(2)
    expect(clampBendRadius(0, 10, 10)).toBe(0)
    expect(clampBendRadius(-3, 10, 10)).toBe(0)
    expect(clampBendRadius(5, 0, 10)).toBe(0)
    expect(BEND_RADIUS_FAC).toBeGreaterThan(0)
  })

  it('trims a 90-degree bend symmetrically onto both segments', () => {
    const trim = cornerTrim([0, 10], [10, 10], [10, 0], 4)!
    expect(trim).not.toBeNull()
    expect(trim.a[0]).toBeCloseTo(6, 9)
    expect(trim.a[1]).toBeCloseTo(10, 9)
    expect(trim.b[0]).toBeCloseTo(10, 9)
    expect(trim.b[1]).toBeCloseTo(6, 9)
  })

  it('keeps tangent points on their segments for a skewed bend', () => {
    const p0: [number, number] = [0, 0]
    const p1: [number, number] = [30, 5]
    const p2: [number, number] = [40, 40]
    const trim = cornerTrim(p0, p1, p2, 6)!
    expect(trim).not.toBeNull()
    const onSeg = (p: [number, number], s: [number, number], e: [number, number]) => {
      const segLen = Math.hypot(e[0] - s[0], e[1] - s[1])
      const d = Math.hypot(p[0] - s[0], p[1] - s[1]) + Math.hypot(e[0] - p[0], e[1] - p[1])
      expect(d).toBeCloseTo(segLen, 9)
    }
    onSeg(trim.a, p0, p1)
    onSeg(trim.b, p1, p2)
  })

  it('returns null when there is nothing to round', () => {
    expect(cornerTrim([0, 0], [10, 0], [20, 0], 4)).toBeNull() // straight run
    expect(cornerTrim([0, 10], [10, 10], [10, 0], 0)).toBeNull() // zero radius
    expect(cornerTrim([0, 0], [10, 0], [10, 0], 4)).toBeNull() // degenerate segment
    expect(cornerTrim([0, 0], [10, 0], [0, 0], 4)).toBeNull() // U-turn
  })
})

describe('VIS-013 effect focus gate', () => {
  it('only hover/hint run magic; blocked and pinned stay quiet', () => {
    expect(arrowFocus({})).toBe('plain')
    expect(arrowFocus({ hover: true })).toBe('effect')
    expect(arrowFocus({ hint: true })).toBe('effect')
    expect(arrowFocus({ hover: true, hint: true })).toBe('effect')
    expect(arrowFocus({ hover: true, pinned: true })).toBe('plain')
    expect(arrowFocus({ hover: true, blocked: true })).toBe('plain')
    expect(arrowFocus({ hint: true, blocked: true })).toBe('plain')
  })

  it('free + aiming at a live target charges statically, never animates', () => {
    expect(arrowFocus({ free: true, aimed: true })).toBe('charged')
    expect(arrowFocus({ free: true })).toBe('plain')
    expect(arrowFocus({ aimed: true })).toBe('plain') // not free: not actionable
  })
})

describe('VIS-013 spark timing', () => {
  it('slots live on [0,1) with sane alpha, and repeat exactly (no flicker)', () => {
    const a = sparkParams(1234, 7)
    expect(a.length).toBe(3)
    for (const sp of a) {
      expect(sp.u).toBeGreaterThanOrEqual(0)
      expect(sp.u).toBeLessThan(1)
      expect(sp.alpha).toBeGreaterThan(0)
      expect(sp.alpha).toBeLessThanOrEqual(1)
    }
    expect(sparkParams(1234, 7)).toEqual(a)
    expect(sparkParams(1234, 7, 5).length).toBe(5)
  })

  it('advances with wall-clock and phases apart per arrow id', () => {
    const u0 = sparkParams(0, 3)[0].u
    const u1 = sparkParams(SPARK_PERIOD_MS / 2, 3)[0].u
    expect(Math.abs(u1 - u0)).toBeCloseTo(0.5, 9)
    expect(sparkParams(999, 3)[0].u).not.toBeCloseTo(sparkParams(999, 4)[0].u, 3)
    // Full period loops back onto itself.
    expect(sparkParams(SPARK_PERIOD_MS, 3)[0].u).toBeCloseTo(sparkParams(0, 3)[0].u, 9)
  })
})
