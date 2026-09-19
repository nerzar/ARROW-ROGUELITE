import { BOSS_POSES } from './boss-visual-state.js'
import { ENEMY_POSES } from './enemy-visual-state.js'
import { setSpeciesPresentation } from './species-presentation.js'

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
  'goblin-shaman': 'goblin-shaman',
  'goblin-king': 'goblin-taunter', // Act I boss: the taunter/king pack reserved by VIS-008
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

// ASSET-002/ASSET-004: additional ordinary-enemy species for the campaign authoring tool's enemy
// catalog (source: magicarrowassets/creatures/<species>). ASSET-002 originally only had a stun/
// death-style source pack for these, so attackReady/attack were left unmapped on purpose. CAL-007's
// pose calibration pass (creature-poses.json) has since added and calibrated a full canonical
// idle/attackReady/attack/hit/defeat set (real `attack.png`/`attackReady.png`/`hit.png`/`defeat.png`
// files, not the old stun/death aliases) for every species below -- wire the full set so those
// poses actually render instead of silently falling back to idle. The old stun/death-named files
// stay on disk unused (harmless leftovers, not deleted here).
const ORDINARY_ENEMY_RUNTIME_DEFAULT = { idle: 'idle.png', attackReady: 'attackReady.png', attack: 'attack.png', hit: 'hit.png', defeat: 'defeat.png' }
const ENEMY_RUNTIME_GREEN_SLIME = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_SMALL_GREEN_SLIME = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_SMALL_GOBLIN = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_SPIDER_BRUTE = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_SMALL_SPIDER = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_TOXIC_DEMONIC_SPIDER = ORDINARY_ENEMY_RUNTIME_DEFAULT
const ENEMY_RUNTIME_SKELETON_CHILD = ORDINARY_ENEMY_RUNTIME_DEFAULT

function enemyManifest(base, runtime) {
  return Object.fromEntries(ENEMY_POSES.filter((p) => runtime[p]).map((p) => [p, `${base}${runtime[p]}`]))
}
export const GREEN_SLIME_MANIFEST = enemyManifest('assets/enemies/green-slime/', ENEMY_RUNTIME_GREEN_SLIME)
export const SMALL_GREEN_SLIME_MANIFEST = enemyManifest('assets/enemies/small-green-slime/', ENEMY_RUNTIME_SMALL_GREEN_SLIME)
export const SMALL_GOBLIN_MANIFEST = enemyManifest('assets/enemies/small-goblin/', ENEMY_RUNTIME_SMALL_GOBLIN)
export const SPIDER_BRUTE_MANIFEST = enemyManifest('assets/enemies/spider-brute/', ENEMY_RUNTIME_SPIDER_BRUTE)
export const SMALL_SPIDER_MANIFEST = enemyManifest('assets/enemies/small-spider/', ENEMY_RUNTIME_SMALL_SPIDER)
export const TOXIC_DEMONIC_SPIDER_MANIFEST = enemyManifest('assets/enemies/toxic-demonic-spider/', ENEMY_RUNTIME_TOXIC_DEMONIC_SPIDER)
export const SKELETON_CHILD_MANIFEST = enemyManifest('assets/enemies/skeleton-child/', ENEMY_RUNTIME_SKELETON_CHILD)
// ACT-I-003: three goblin species from magicarrowassets/creatures (grunt = shield bearer,
// matron = support/heal, drunkard = staggers when hit). Pose files copied by the same
// idle/attackReady/attack/hit/defeat convention; pivots/scales in creature-poses.json.
export const GOBLIN_GRUNT_MANIFEST = enemyManifest('assets/enemies/goblin-grunt/', ORDINARY_ENEMY_RUNTIME_DEFAULT)
export const GOBLIN_MATRON_MANIFEST = enemyManifest('assets/enemies/goblin-matron/', ORDINARY_ENEMY_RUNTIME_DEFAULT)
export const GOBLIN_DRUNKARD_MANIFEST = enemyManifest('assets/enemies/goblin-drunkard/', ORDINARY_ENEMY_RUNTIME_DEFAULT)

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
  'small-green-slime': SMALL_GREEN_SLIME_MANIFEST,
  'small-goblin': SMALL_GOBLIN_MANIFEST,
  'spider-brute': SPIDER_BRUTE_MANIFEST,
  'small-spider': SMALL_SPIDER_MANIFEST,
  'toxic-demonic-spider': TOXIC_DEMONIC_SPIDER_MANIFEST,
  'skeleton-child': SKELETON_CHILD_MANIFEST,
  'goblin-shaman': SHAMAN_MANIFEST,
  'goblin-taunter': BOSS_MANIFEST,
  'goblin-grunt': GOBLIN_GRUNT_MANIFEST,
  'goblin-matron': GOBLIN_MATRON_MANIFEST,
  'goblin-drunkard': GOBLIN_DRUNKARD_MANIFEST,
}
export function enemyManifestFor(species) {
  return ENEMY_MANIFESTS[species] ?? WOLF_MANIFEST
}

/** TOOL-001/TOOL-002: merges the Creature Pose Editor's saved, project-local pose manifest on top
 * of the hardcoded per-species manifests above, and registers each species' saved default
 * pivot/scale (species-presentation.js) -- this is what makes the editor's Save button actually
 * change what the game renders, without requiring a code edit for every pose/pivot/scale change.
 * Same "register at runtime" shape as BUILD-029's registerArena(): mutates ENEMY_MANIFESTS/
 * BOSS_MANIFESTS in place, so every existing consumer (which already reads those objects by
 * reference) picks it up automatically. Missing/unreadable/empty file -> silent no-op, since a
 * fresh checkout with no authored overrides yet must render exactly as it did before this tool
 * existed. Callers must `await` this before building any pack from ENEMY_MANIFESTS/BOSS_MANIFESTS
 * or reading species-presentation.js's speciesPivotDelta/speciesScale. */
export async function applyPoseOverrides(url = 'creature-poses.json') {
  let data
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return
    data = await res.json()
  } catch {
    return
  }
  for (const [species, entry] of Object.entries(data ?? {})) {
    const poses = entry?.poses
    if (poses && typeof poses === 'object') {
      ENEMY_MANIFESTS[species] = { ...(ENEMY_MANIFESTS[species] ?? {}), ...poses }
      if (BOSS_MANIFESTS[species]) BOSS_MANIFESTS[species] = { ...BOSS_MANIFESTS[species], ...poses }
    }
    setSpeciesPresentation(species, { pivot: entry?.pivot, scale: entry?.scale, hudOffset: entry?.hudOffset, hudScale: entry?.hudScale, shadowOffset: entry?.shadowOffset })
  }
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
