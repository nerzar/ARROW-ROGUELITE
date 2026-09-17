// VIS-001: declarative asset manifest + graceful-placeholder loader for the visual combat shell.
// Nothing here is combat logic -- it only resolves image keys to HTMLImageElement|null so
// board-renderer.js can draw art when it exists and fall back to a drawn placeholder when it does
// not. Dropping a PNG at one of these paths later must not require touching app.js or
// board-renderer.js.
//
// VS-001: the 10 manifest keys below are the real production slots from
// docs/VISUAL-ASSET-PACK-V01.md's "Master Minimal Asset Roster" (design/visual-assets-v01, read
// for reference only -- this spike does not implement its layered-puppet animation plan, just the
// flat portrait/texture slots a placeholder-or-real single image can fill). No file exists at any
// of these paths yet; every one resolves to `null` and the renderer draws its existing gradient/
// vector placeholder instead, exactly like the pre-VS-001 manifest already did.
export const ASSET_MANIFEST = {
  background: 'assets/background.png',
  boardFrame: 'assets/board-frame.png',
  bossGoblinTaunter: 'assets/boss-goblin-taunter.png',
  enemyGoblinShaman: 'assets/enemy-goblin-shaman.png',
  enemyDireWolf: 'assets/enemy-dire-wolf.png',
  playerPortrait: 'assets/player-portrait.png',
  rockProjectile: 'assets/rock-projectile.png',
  magicProjectile: 'assets/magic-projectile.png',
  castGlow: 'assets/cast-glow.png',
  hitFx: 'assets/hit-fx.png',
}

/** Enemy/boss id -> manifest key, for the three VS-001 scenes' known cast (cp-e4, cp-e5,
 * rock-spike). A future encounter with an unlisted id still gets *a* portrait, not a blank panel,
 * via SIDE_FALLBACK_SLOT below -- this is bookkeeping for placeholder-vs-real art, not a design
 * decision about which monster is "really" a shaman or a wolf. */
const ID_TO_SLOT = {
  miniboss_placeholder: 'bossGoblinTaunter', // cp-e5
  grunt_e: 'enemyDireWolf', // cp-e4, urgent/melee-flavored timer
  grunt_n: 'enemyGoblinShaman', // cp-e4, slow/caster-flavored timer
  rockthrower: 'enemyGoblinShaman', // rock-spike -- no dedicated "throws rocks" slot in the roster
}
/** Positional fallback (indexed by Dir: N,E,S,W) when an enemy id isn't in ID_TO_SLOT above. */
const SIDE_FALLBACK_SLOT = ['enemyGoblinShaman', 'enemyDireWolf', 'enemyGoblinShaman', 'enemyDireWolf']

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
  const keys = Object.keys(manifest)
  const imgs = await Promise.all(keys.map((k) => loadImage(manifest[k])))
  const store = {}
  keys.forEach((k, i) => (store[k] = imgs[i]))
  return store
}

/** Picks the best available portrait for a target box: known id -> its slot, else the side's
 * positional fallback. Boss always resolves to bossGoblinTaunter regardless of id. */
export function resolveTargetImage(store, { id, side, isBoss }) {
  if (isBoss) return store.bossGoblinTaunter ?? null
  const slot = (id && ID_TO_SLOT[id]) ?? SIDE_FALLBACK_SLOT[side] ?? null
  return (slot && store[slot]) ?? null
}
