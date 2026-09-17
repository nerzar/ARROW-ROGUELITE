// VIS-001: declarative asset manifest + graceful-placeholder loader for the visual combat shell.
// Nothing here is combat logic -- it only resolves image keys to HTMLImageElement|null so
// board-renderer.js can draw a portrait when one exists and fall back to a drawn placeholder
// when it does not. Dropping a PNG at one of these paths later must not require touching app.js
// or board-renderer.js.

/** Positional fallback used when an enemy has no per-id portrait override. */
export const SIDE_SLOT = ['enemyTop', 'enemyRight', 'enemyBottom', 'enemyLeft'] // indexed by Dir (N,E,S,W)

export const ASSET_MANIFEST = {
  background: 'assets/background.png',
  boardFrame: 'assets/board-frame.png',
  boardTexture: 'assets/board-texture.png',
  boss: 'assets/boss.png',
  enemyTop: 'assets/enemy-top.png',
  enemyRight: 'assets/enemy-right.png',
  enemyBottom: 'assets/enemy-bottom.png',
  enemyLeft: 'assets/enemy-left.png',
  /** Per-enemy-id overrides, keyed by EnemyDef.id (e.g. "grunt_e"). Checked before SIDE_SLOT. */
  portraits: {},
}

function loadImage(path) {
  if (!path) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // missing asset -> caller draws a placeholder, never throws
    img.src = path
  })
}

/** Resolves every manifest entry in parallel. A missing file resolves to `null`, never rejects. */
export async function loadAssets(manifest = ASSET_MANIFEST) {
  const flatKeys = Object.keys(manifest).filter((k) => k !== 'portraits')
  const portraitKeys = Object.keys(manifest.portraits ?? {})
  const [flat, portraits] = await Promise.all([
    Promise.all(flatKeys.map((k) => loadImage(manifest[k]))),
    Promise.all(portraitKeys.map((k) => loadImage(manifest.portraits[k]))),
  ])
  const store = { portraits: {} }
  flatKeys.forEach((k, i) => (store[k] = flat[i]))
  portraitKeys.forEach((k, i) => (store.portraits[k] = portraits[i]))
  return store
}

/** Picks the best available image for a target box: per-id portrait, else the side's positional slot. */
export function resolveTargetImage(store, { id, side, isBoss }) {
  if (isBoss) return store.boss ?? null
  const byId = id ? store.portraits[id] : null
  if (byId) return byId
  const slot = SIDE_SLOT[side]
  return (slot && store[slot]) ?? null
}
