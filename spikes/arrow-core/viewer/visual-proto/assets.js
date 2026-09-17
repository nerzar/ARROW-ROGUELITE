// VIS-001: declarative asset manifest + graceful-placeholder loader for the visual combat shell.
// Nothing here is combat logic -- it only resolves image keys to HTMLImageElement|null so
// board-renderer.js can draw art when it exists and fall back to a drawn placeholder when it does
// not. Dropping a PNG at one of these paths later must not require touching app.js or
// board-renderer.js.
//
// VIS-004: real art integration V01. The manifest now points at the real V01 filenames from
// arrow_visual_assets_v01.zip (bg_arena_v01.webp, board_frame_v01.png, boss_taunter_v01.png).
// Drop those files into ./assets/ and reload -- no code change needed. A missing file still
// resolves to `null` and the renderer draws its gradient/vector placeholder, exactly as before.
export const ASSET_MANIFEST = {
  background: 'assets/bg_arena_v01.webp',
  boardFrame: 'assets/board_frame_v01.png',
  bossGoblinTaunter: 'assets/boss_taunter_v01.png',
  enemyGoblinShaman: 'assets/enemy-goblin-shaman.png',
  enemyDireWolf: 'assets/enemy-dire-wolf.png',
  playerPortrait: 'assets/player-portrait.png',
  rockProjectile: 'assets/rock-projectile.png',
  magicProjectile: 'assets/magic-projectile.png',
  castGlow: 'assets/cast-glow.png',
  hitFx: 'assets/hit-fx.png',
}

// Legacy VIS-001/VS-001 placeholder paths, tried only when the V01 file above is missing, so an
// older assets folder keeps working without renaming anything.
const LEGACY_FALLBACK = {
  background: 'assets/background.png',
  boardFrame: 'assets/board-frame.png',
  bossGoblinTaunter: 'assets/boss-goblin-taunter.png',
}

// VIS-004: explicit asset metadata. boss_taunter_v01.png is the TAUNT pose (`taunt_reveal`),
// used here as visual proof for scale/composition only -- it must NOT become the permanent idle
// pose in a future production model (a separate default pose with the cloak closed lands later).
export const ASSET_META = {
  bossGoblinTaunter: {
    file: 'boss_taunter_v01.png',
    pose: 'taunt_reveal',
    note: 'TAUNT pose for V01 visual proof only; not the production idle.',
  },
  background: { file: 'bg_arena_v01.webp', fit: 'cover', position: 'center top' },
  boardFrame: { file: 'board_frame_v01.png', fit: 'contain', layer: 'under-board', pointerEvents: 'none' },
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

function loadImage(primary, fallback) {
  if (!primary) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      // V01 file missing: try the legacy placeholder path once, then give up to placeholder.
      if (fallback && fallback !== primary) {
        const retry = new Image()
        retry.onload = () => resolve(retry)
        retry.onerror = () => resolve(null) // missing asset -> caller draws a placeholder, never throws
        retry.src = fallback
      } else {
        resolve(null)
      }
    }
    img.src = primary
  })
}

/** Resolves every manifest entry in parallel. A missing file resolves to `null`, never rejects. */
export async function loadAssets(manifest = ASSET_MANIFEST) {
  const keys = Object.keys(manifest)
  const imgs = await Promise.all(keys.map((k) => loadImage(manifest[k], LEGACY_FALLBACK[k])))
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
