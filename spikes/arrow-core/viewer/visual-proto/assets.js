import { BOSS_POSES } from './boss-visual-state.js'
import { ENEMY_POSES } from './enemy-visual-state.js'

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
  // VIS-007: approved Moonlit Fortress arena (source:
  // magicarrowassets/arenas/ChatGPT Image Sep 17, 2026, 09_24_35 AM.png).
  background: 'assets/arena-moonlit-fortress.png',
  boardFrame: 'assets/board-frame.png',
  bossGoblinShaman: 'assets/boss-goblin-shaman.png',
  bossGoblinTaunter: 'assets/boss-goblin-taunter.png',
  enemyGoblinShaman: 'assets/enemy-goblin-shaman.png',
  enemyDireWolf: 'assets/enemy-dire-wolf.png',
  playerPortrait: 'assets/player-portrait.png',
  rockProjectile: 'assets/rock-projectile.png',
  magicProjectile: 'assets/magic-projectile.png',
  castGlow: 'assets/cast-glow.png',
  hitFx: 'assets/hit-fx.png',
}

// VIS-005: Goblin Taunter/King runtime pack -- one PNG per presentation pose (canonical source:
// magicarrowassets/creatures/goblin-king; runtime renames indle->idle, stuned->stunned).
// `back` is an auxiliary pose, never a gameplay baseline. Missing files resolve to `null`
// per pose and the renderer falls back to the idle pose, then to the legacy placeholder.
// VIS-008: the user reassigned roles -- Goblin Taunter/King is now the reserved ACT I boss, not
// the prologue boss. Its pack/state wiring stays intact (not deleted, still loadable/reachable
// via window.visualDebug.showBossPack('goblin-taunter')) for when an Act I boss scene exists.
export const BOSS_PACK_BASE = 'assets/bosses/goblin-taunter/'
export const BOSS_MANIFEST = Object.fromEntries(BOSS_POSES.map((p) => [p, `${BOSS_PACK_BASE}${p}.png`]))

// VIS-008: Goblin Shaman runtime pack -- the PROLOGUE boss (cp-e5's `miniboss_placeholder`), one
// PNG per presentation pose (canonical source: magicarrowassets/creatures/goblin-shaman; runtime
// renames "stunned - hit.png" -> stunned-hit.png, source file itself untouched). Same pose set,
// same anchor contract, same graceful-degradation rules as BOSS_MANIFEST above -- boss-visual-
// state.js's pose machine has no species knowledge at all, so this is purely a different manifest
// fed into the same `loadBossPack()`/`resolveBossImage()` pair.
const SHAMAN_RUNTIME = { idle: 'idle.png', taunt: 'taunt.png', cast: 'cast.png', stunned: 'stunned-hit.png', angry: 'angry.png', defeat: 'defeat.png', back: 'back.png' }
export const SHAMAN_PACK_BASE = 'assets/bosses/goblin-shaman/'
export const SHAMAN_MANIFEST = Object.fromEntries(BOSS_POSES.map((p) => [p, `${SHAMAN_PACK_BASE}${SHAMAN_RUNTIME[p]}`]))

/** VIS-008: which boss species pack backs a given `def.boss.id`. The ONLY place that knows
 * species -- boss-visual-state.js stays fully pack-agnostic (pose names/timing only), and adding
 * a second boss scene later (Act I) is a new entry here, not a change to the state machine.
 * Unknown ids default to Shaman, today's only boss scene. */
const BOSS_ID_TO_SPECIES = {
  miniboss_placeholder: 'goblin-shaman', // cp-e5: prologue boss (VIS-008 reassignment)
}
export const BOSS_MANIFESTS = { 'goblin-shaman': SHAMAN_MANIFEST, 'goblin-taunter': BOSS_MANIFEST }
export function bossSpeciesFor(bossId) {
  return BOSS_ID_TO_SPECIES[bossId] ?? 'goblin-shaman'
}

const WOLF_RUNTIME = { idle: 'idle.png', attackReady: 'attack-ready.png', attack: 'lunge.png', hit: 'hit.png', defeat: 'defeat.png' }
// VIS-006: Dire Wolf runtime pack -- one PNG per ordinary-enemy presentation pose (canonical
// source: magicarrowassets/creatures/dire_wolf; generic source names mapped in the VIS-006
// task card). Runtime `attack` pose lives in `lunge.png` (a lunge IS the wolf's attack).
// Missing files resolve to `null` per pose and the renderer falls back to idle, then legacy placeholder.
export const WOLF_PACK_BASE = 'assets/enemies/dire-wolf/'
export const WOLF_MANIFEST = Object.fromEntries(ENEMY_POSES.map((p) => [p, `${WOLF_PACK_BASE}${WOLF_RUNTIME[p]}`]))

// ASSET-002: additional ordinary-enemy species for the campaign authoring tool's enemy catalog
// (source: magicarrowassets/creatures/<species>). Unlike Dire Wolf, these were generated with the
// same idle/angry/taunt/cast/stun/death/back pose set as the BOSS roster (goblin-shaman/goblin-
// king), not Dire Wolf's own idle/attack-ready/attack/hit/defeat set -- so only `idle`, `hit`
// (<- stun/stun-hit, the literal "reaction to being hit" pose) and `defeat` (<- death) have a real
// literal filename to map here. `attackReady`/`attack` have no matching source file for these
// species and are deliberately left unmapped rather than guessed -- ENEMY_POSES's existing
// pose->idle graceful-degradation (see resolveWolfImage below) already covers it, exactly the same
// contract every other missing pose on any pack already uses.
// spider-brute/skeleton-child ship with only a single clean usable frame each (the rest of their
// source folders are either raw ungrouped batches or a labeled concept/reference sheet, not
// individually usable sprites) -- idle-only, every other pose falls back to idle.
const ENEMY_RUNTIME_GREEN_SLIME = { idle: 'idle.png', hit: 'stun-hit.png', defeat: 'death.png' }
const ENEMY_RUNTIME_SMALL_GOBLIN = { idle: 'idle.png', hit: 'stun.png', defeat: 'death.png' }
const ENEMY_RUNTIME_SPIDER_BRUTE = { idle: 'idle.png' }
const ENEMY_RUNTIME_SKELETON_CHILD = { idle: 'idle.png' }
// ASSET-003: three source folders (small-spider, toxic-demonic-spider, small-green-slime) were
// entirely missing from the catalog -- inspected every file in each folder (see FOUND in the
// ASSET-003 task-card for the full pose-by-pose read) rather than skipping any for lacking a
// complete named pose set, per the task's "don't curate away a usable model" rule.
// small-spider ships as 8 individually generated frames (no named poses, a 1-image concept/
// reference sheet plus 7 isolated sprites) -- identified by comparing each frame against the
// concept sheet's own pose labels: a clean grounded front stance -> idle, a rearing/threat pose
// -> attackReady, a web-spit pose -> attack, a dizzy-with-stars pose -> hit. No death/collapse
// frame exists among the 7, so defeat is deliberately left unmapped (falls back to idle).
const ENEMY_RUNTIME_SMALL_SPIDER = { idle: 'idle.png', attackReady: 'attack-ready.png', attack: 'attack.png', hit: 'hit.png' }
// toxic-demonic-spider ships a full named pose set (idle/angry/back/cast/death/stun) already
// distinct in identity (venom-sac mouth, green-glowing carapace) from both small-spider (bronze/
// gold, no venom sac) and spider-brute (larger, red-glow eyes) -- idle/stun->hit/death->defeat
// mapped directly, matching the same convention as green-slime's own idle/stun-hit/death set.
const ENEMY_RUNTIME_TOXIC_SPIDER = { idle: 'idle.png', hit: 'hit.png', defeat: 'defeat.png' }
// small-green-slime is a visually distinct, separate design from green-slime (a smaller, friendly
// round-eyed slime vs. green-slime's taller, fanged, menacing one) with its own clean idle/hit
// (dizzy-spiral-eyes)/defeat (collapsed) trio -- same idle/hit/defeat convention as every other
// slime/goblin pack above.
const ENEMY_RUNTIME_SMALL_GREEN_SLIME = { idle: 'idle.png', hit: 'hit.png', defeat: 'defeat.png' }

function enemyManifest(base, runtime) {
  return Object.fromEntries(ENEMY_POSES.filter((p) => runtime[p]).map((p) => [p, `${base}${runtime[p]}`]))
}
export const GREEN_SLIME_MANIFEST = enemyManifest('assets/enemies/green-slime/', ENEMY_RUNTIME_GREEN_SLIME)
export const SMALL_GOBLIN_MANIFEST = enemyManifest('assets/enemies/small-goblin/', ENEMY_RUNTIME_SMALL_GOBLIN)
export const SPIDER_BRUTE_MANIFEST = enemyManifest('assets/enemies/spider-brute/', ENEMY_RUNTIME_SPIDER_BRUTE)
export const SKELETON_CHILD_MANIFEST = enemyManifest('assets/enemies/skeleton-child/', ENEMY_RUNTIME_SKELETON_CHILD)
export const SMALL_SPIDER_MANIFEST = enemyManifest('assets/enemies/small-spider/', ENEMY_RUNTIME_SMALL_SPIDER)
export const TOXIC_SPIDER_MANIFEST = enemyManifest('assets/enemies/toxic-demonic-spider/', ENEMY_RUNTIME_TOXIC_SPIDER)
export const SMALL_GREEN_SLIME_MANIFEST = enemyManifest('assets/enemies/small-green-slime/', ENEMY_RUNTIME_SMALL_GREEN_SLIME)

/** ASSET-002: species -> ordinary-enemy pose manifest, for the campaign editor's per-enemy
 * `species` field (asset-catalog.js's CREATURE_CATALOG ids). Unknown/unset species falls back to
 * `dire-wolf` (today's only pre-existing ordinary-enemy pack) so an authored level with no species
 * chosen yet still renders something real instead of nothing.
 *
 * `goblin-shaman`/`goblin-taunter` are CREATURE_CATALOG's two "Boss" entries -- but the campaign
 * authoring tool always builds `def.enemies` (array shape), never `def.boss`, so a boss species
 * placed in an enemy slot goes through this same ordinary-enemy pipeline, not the boss one. Without
 * an entry here it silently fell back to Dire Wolf's sprite despite the "(Boss)" label. Reusing
 * their own BOSS_MANIFEST/SHAMAN_MANIFEST here is safe even though the pose vocabularies differ
 * (ENEMY_POSES' `attackReady`/`attack`/`hit` aren't in a boss pack) -- resolveWolfImage's existing
 * pose->idle fallback (below) already covers every pose the boss pack doesn't define, so this
 * renders a real, correctly-grounded idle portrait instead of a wrong species. */
export const ENEMY_MANIFESTS = {
  'dire-wolf': WOLF_MANIFEST,
  'green-slime': GREEN_SLIME_MANIFEST,
  'small-goblin': SMALL_GOBLIN_MANIFEST,
  'spider-brute': SPIDER_BRUTE_MANIFEST,
  'skeleton-child': SKELETON_CHILD_MANIFEST,
  'goblin-shaman': SHAMAN_MANIFEST,
  'goblin-taunter': BOSS_MANIFEST,
  // ASSET-003: complete the creature library -- previously missing entirely from both this
  // manifest map and CREATURE_CATALOG (asset-catalog.js), so selecting them wasn't possible.
  'small-spider': SMALL_SPIDER_MANIFEST,
  'toxic-demonic-spider': TOXIC_SPIDER_MANIFEST,
  'small-green-slime': SMALL_GREEN_SLIME_MANIFEST,
}
export function enemyManifestFor(species) {
  return ENEMY_MANIFESTS[species] ?? WOLF_MANIFEST
}

/** Enemy/boss id -> manifest key, for the three VS-001 scenes' known cast (cp-e4, cp-e5,
 * rock-spike). A future encounter with an unlisted id still gets *a* portrait, not a blank panel,
 * via SIDE_FALLBACK_SLOT below -- this is bookkeeping for placeholder-vs-real art, not a design
 * decision about which monster is "really" a shaman or a wolf.
 * VIS-008: `miniboss_placeholder` now points at the Shaman's flat fallback slot, matching the
 * prologue-boss reassignment -- this legacy flat-portrait layer only ever fires when the real
 * pose pack (SHAMAN_MANIFEST via BOSS_ID_TO_SPECIES) has no image loaded at all. */
const ID_TO_SLOT = {
  miniboss_placeholder: 'bossGoblinShaman', // cp-e5: prologue boss (VIS-008)
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

/** VIS-005: loads the boss pose pack in parallel; same null-on-missing contract. */
export async function loadBossPack(manifest = BOSS_MANIFEST) {
  const poses = Object.keys(manifest)
  const imgs = await Promise.all(poses.map((p) => loadImage(manifest[p])))
  const pack = {}
  poses.forEach((p, i) => (pack[p] = imgs[i]))
  return pack
}

/** VIS-006: loads the Dire Wolf pose pack in parallel; same null-on-missing contract. */
export async function loadWolfPack(manifest = WOLF_MANIFEST) {
  const poses = Object.keys(manifest)
  const imgs = await Promise.all(poses.map((p) => loadImage(manifest[p])))
  const pack = {}
  poses.forEach((p, i) => (pack[p] = imgs[i]))
  return pack
}

/** VIS-005: pose -> image with graceful degradation (pose -> idle -> null placeholder). */
export function resolveBossImage(pack, pose) {
  if (!pack) return null
  return pack[pose] ?? pack.idle ?? null
}

/** VIS-006: same contract for the wolf pack (pose -> idle -> null placeholder). */
export function resolveWolfImage(pack, pose) {
  if (!pack) return null
  return pack[pose] ?? pack.idle ?? null
}

/** Picks the best available portrait for a target box: known id -> its slot, else the side's
 * positional fallback. VIS-008: boss resolves to bossGoblinShaman (the prologue boss) regardless
 * of id -- this legacy flat-portrait layer never falls back to Taunter now that Taunter is the
 * reserved Act I boss, not today's boss scene. */
export function resolveTargetImage(store, { id, side, isBoss }) {
  if (isBoss) return store.bossGoblinShaman ?? null
  const slot = (id && ID_TO_SLOT[id]) ?? SIDE_FALLBACK_SLOT[side] ?? null
  return (slot && store[slot]) ?? null
}
