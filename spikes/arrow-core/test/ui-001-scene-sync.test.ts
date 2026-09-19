import { describe, expect, it } from 'vitest'
import { resolveActiveSceneKey } from '../viewer/visual-proto/scene-sync.js'

/**
 * UI-001: the scene dropdown must show the ACTUAL runtime scene. Pins the pure mapping
 * (run position wins over the entry key on advance; debug boards report transient).
 */
const KEYS = ['cp-e2', 'cp-e3', 'cp-e4', 'cp-e5']

describe('UI-001 scene dropdown truth', () => {
  it('manual select shows the chosen key', () => {
    expect(resolveActiveSceneKey({ kind: 'sequence', entryKey: 'cp-e4', idx: 2, stepCount: 4, sequenceKeys: KEYS }))
      .toEqual({ key: 'cp-e4', transient: false })
    expect(resolveActiveSceneKey({ kind: 'single', entryKey: 'rock-spike', idx: 0, stepCount: 1 }))
      .toEqual({ key: 'rock-spike', transient: false })
    expect(resolveActiveSceneKey({ kind: 'authored', entryKey: 'authored-0', idx: 0, stepCount: 5 }))
      .toEqual({ key: 'authored-0', transient: false })
  })

  it('advance shows the position, not the entry key', () => {
    // Entered at cp-e2 (idx 0), advanced twice: the runtime runs cp-e4 content.
    expect(resolveActiveSceneKey({ kind: 'sequence', entryKey: 'cp-e2', idx: 2, stepCount: 4, sequenceKeys: KEYS }))
      .toEqual({ key: 'cp-e4', transient: false })
    expect(resolveActiveSceneKey({ kind: 'authored', entryKey: 'authored-0', idx: 3, stepCount: 5 }))
      .toEqual({ key: 'authored-3', transient: false })
  })

  it('debug boards report transient (no static option to select)', () => {
    expect(resolveActiveSceneKey({ kind: 'debug', entryKey: null, idx: 0, stepCount: 1 }))
      .toEqual({ key: '__debug__', transient: true })
  })

  it('out-of-range positions fall back to the entry key instead of inventing one', () => {
    expect(resolveActiveSceneKey({ kind: 'sequence', entryKey: 'cp-e2', idx: 9, stepCount: 4, sequenceKeys: KEYS }))
      .toEqual({ key: 'cp-e2', transient: false })
    expect(resolveActiveSceneKey({ kind: 'sequence', entryKey: 'cp-e2', idx: 1, stepCount: 4, sequenceKeys: [] }))
      .toEqual({ key: 'cp-e2', transient: false })
  })
})
