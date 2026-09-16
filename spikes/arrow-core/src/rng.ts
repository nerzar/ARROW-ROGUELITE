/**
 * Deterministic seeded RNG.
 *
 * sfc32 (Chris Doty-Humphrey, public domain) seeded through splitmix32. Pure 32-bit integer
 * arithmetic via Math.imul / |0, so the sequence is identical on every JS engine.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, n). */
  int(n: number): number
}

/** 32-bit avalanche finalizer (murmur3 fmix32). */
export function mix32(x: number): number {
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}

/** FNV-1a 32-bit over a UTF-16 string, then mixed. Use to turn a text seed into a number. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return mix32(h)
}

/** Derives an independent sub-seed, e.g. `deriveSeed(runSeed, floor, encounter)`. */
export function deriveSeed(base: number, ...parts: number[]): number {
  let h = mix32((base >>> 0) ^ 0x9e3779b9)
  for (const p of parts) h = mix32((h ^ Math.imul((p >>> 0) + 0x632be5ab, 0x9e3779b1)) >>> 0)
  return h
}

class Sfc32 implements Rng {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor(seed: number) {
    let s = seed >>> 0
    const split = (): number => {
      s = (s + 0x9e3779b9) | 0
      let z = s
      z ^= z >>> 16
      z = Math.imul(z, 0x21f0aaad)
      z ^= z >>> 15
      z = Math.imul(z, 0x735a2d97)
      z ^= z >>> 15
      return z | 0
    }
    this.a = split()
    this.b = split()
    this.c = split()
    this.d = split()
    for (let i = 0; i < 12; i++) this.next()
  }

  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0
    this.d = (this.d + 1) | 0
    this.a = this.b ^ (this.b >>> 9)
    this.b = (this.c + (this.c << 3)) | 0
    this.c = (this.c << 21) | (this.c >>> 11)
    this.c = (this.c + t) | 0
    return (t >>> 0) / 4294967296
  }

  int(n: number): number {
    return Math.floor(this.next() * n)
  }
}

export function createRng(seed: number): Rng {
  return new Sfc32(seed)
}

export function shuffleInPlace<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}
