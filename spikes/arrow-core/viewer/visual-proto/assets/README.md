# VIS-001 asset manifest

Drop a PNG at any of these paths and the shell picks it up on next reload -- no code change needed
(see `../assets.js`). Anything missing renders as a drawn placeholder, so this directory can stay
empty during development.

| Key | Path | Used for |
|---|---|---|
| `background` | `assets/arena-moonlit-fortress.png` | Approved Moonlit Fortress arena (source `magicarrowassets/arenas/ChatGPT Image Sep 17, 2026, 09_24_35 AM.png`), full-bleed behind the board. |
| `boardFrame` | `assets/board-frame.png` | Decorative frame drawn behind the canvas (board itself stays code-rendered). |
| `boardTexture` | `assets/board-texture.png` | Reserved: stone/board surface texture overlay. Not yet wired into board-renderer.js. |
| `boss` | `assets/boss.png` | Portrait for single-target `boss` encounters. |
| `enemyTop` / `enemyRight` / `enemyBottom` / `enemyLeft` | `assets/enemy-<side>.png` | Positional fallback portrait for `enemies`-mode targets, picked by the side they currently occupy. |
| `portraits.<enemyId>` | set in `ASSET_MANIFEST.portraits` in `assets.js` | Per-enemy override, e.g. `grunt_e`, checked before the positional slot. |

Recommended size: roughly square, at least 512x512, transparent background for portraits.

## VIS-005/VIS-008: boss pose packs (species-swappable)

The boss presentation state machine (`../boss-visual-state.js`) has no species
knowledge -- it only maps engine snapshot -> pose NAME. Which PNG pack backs
that pose name is decided per scene by `bossSpeciesFor(bossId)` in
`../assets.js`. Two packs currently exist, both full 7-pose sets, both always
loaded (`BOSS_MANIFESTS` in `assets.js`):

- **`goblin-shaman`** -- the **prologue boss** (cp-e5's `miniboss_placeholder`),
  reassigned from Goblin Taunter/King by user decision (VIS-008).
- **`goblin-taunter`** -- Goblin Taunter/King, **reserved for the Act I boss**.
  Not deleted, not the default -- still loadable and reachable from the debug
  console (`window.visualDebug.showBossPack('goblin-taunter')`) even though no
  current scene uses it.

### Goblin Shaman (`assets/bosses/goblin-shaman/`) -- prologue boss

| Pose | File | Shown when |
|---|---|---|
| `idle` | `idle.png` | phase 1 baseline |
| `taunt` | `taunt.png` | encounter appearance, briefly, then baseline |
| `cast` | `cast.png` | armed interruptible CAST telegraph |
| `stunned` | `stunned-hit.png` | hit / interrupted, briefly (runtime rename of source `stunned - hit.png`) |
| `angry` | `angry.png` | phase 2 baseline |
| `defeat` | `defeat.png` | boss defeated, terminal |
| `back` | `back.png` | auxiliary pose, debug/manual only |

Source: `magicarrowassets/creatures/goblin-shaman/`. Every other source file
name matches its pose 1:1 (`idle.png` -> `idle.png`, etc); only the
`stunned - hit.png` -> `stunned-hit.png` rename normalizes spaces/dashes for a
runtime path, per the pose-name convention `${pose}.png` the Taunter pack uses.

### Goblin Taunter/King (`assets/bosses/goblin-taunter/`) -- reserved Act I boss

| Pose | File | Shown when |
|---|---|---|
| `idle` | `idle.png` | phase 1 baseline (runtime rename of source `indle.png`) |
| `taunt` | `taunt.png` | encounter appearance, briefly, then baseline |
| `cast` | `cast.png` | armed interruptible CAST telegraph |
| `stunned` | `stunned.png` | hit / interrupted, briefly (runtime rename of source `stuned.png`) |
| `angry` | `angry.png` | phase 2 baseline |
| `defeat` | `defeat.png` | boss defeated, terminal |
| `back` | `back.png` | auxiliary pose, debug/manual only |

Both packs: all drawn contain-fitted into the same boss panel footprint with a
shared bottom-center ground anchor. A missing pose falls back to that pack's
own `idle` (never another species' pack), then to the legacy gradient
placeholder. No absolute paths are stored anywhere in runtime.

## VIS-006: Dire Wolf pose pack

`assets/enemies/dire-wolf/` holds one PNG per ordinary-enemy presentation pose,
drawn contain-fitted into the same enemy panel footprint with a shared
bottom-center ground anchor (see `../enemy-visual-state.js`). One visual state
object per actor (Map enemyId -> visual in `app.js`), so two wolves on screen
tick independently. Side-profile sprites face right; E-side panels mirror about
the anchor x so the wolf faces the board on every side.

| Pose | File | Shown when |
|---|---|---|
| `idle` | `idle.png` | baseline far from attack (source `...11_10_59 AM (2).png`) |
| `attackReady` | `attack-ready.png` | finite `countdown <= 1` telegraph (source `...11_11_00 AM (3).png`) |
| `attack` | `lunge.png` | own strike, briefly (source `...11_11_00 AM (4).png`) |
| `hit` | `hit.png` | received hit, briefly (source `...11_11_00 AM (5).png`) |
| `defeat` | `defeat.png` | enemy dead, terminal (source `...11_11_00 AM (6).png`) |

Source folder `magicarrowassets/creatures/dire_wolf/` also holds the concept
sheet `...11_10_59 AM (1).png` (reference only, not copied). Full source ->
runtime mapping lives in the VIS-006 task card.

## VIS-007: arena character layout

Characters stand directly on the arena (no panel box, no clip) with the HUD as
a separate plate (see `../arena-layout.js`):

- boss/top footprint 2.8x3.6 cells, side enemies 2.6x2.6 cells;
- ground shadow + urgency telegraph ellipse at the feet instead of a box ring;
- HUD (name/HP/ATTACK-CAST-THROW + badge) above the head, below the feet only
  on the S slot; E/W plates clamp outward so they never reach the board.

