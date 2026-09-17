# VIS-004 real art integration V01

Drop the contents of `arrow_visual_assets_v01.zip` into this directory and reload --
no code change needed (see `../assets.js`). Anything missing renders as a drawn
placeholder, so this directory can stay empty during development.

## Real V01 assets (from the archive, exact filenames)

| Key | Path | Used for |
|---|---|---|
| `background` | `assets/bg_arena_v01.webp` | Fullscreen arena background. CSS `cover`, anchored `center top`: boss dais top-center, stone courtyard under the program board. No gradient or overlay on top of the art. |
| `boardFrame` | `assets/board_frame_v01.png` | Decorative frame on its own DOM layer UNDER the canvas (`#boardFrameArt`, `pointer-events: none`). Scales around the real boardRect via CSS overscan; gameplay coordinates untouched. The interactive board stays 100% code-rendered. |
| `bossGoblinTaunter` | `assets/boss_taunter_v01.png` | Boss portrait, drawn aspect-preserving (contain) over the panel backdrop. **Pose: `taunt_reveal` (TAUNT, not idle)** -- visual proof for scale/composition only; a separate default pose (cloak closed) lands later and must not inherit this file as permanent idle. Metadata: `ASSET_META.bossGoblinTaunter` in `../assets.js`, mirrored to `stage.dataset.bossPose` at runtime. |

Legacy VIS-001/VS-001 placeholder paths (`assets/background.png`, `assets/board-frame.png`,
`assets/boss-goblin-taunter.png`) are still tried as fallback when the V01 file is missing.

## Reserved / future slots (unchanged)

| Key | Path | Used for |
|---|---|---|
| `enemyGoblinShaman` | `assets/enemy-goblin-shaman.png` | cp-e4 north enemy / rock-spike rockthrower portrait. |
| `enemyDireWolf` | `assets/enemy-dire-wolf.png` | cp-e4 east enemy portrait. |
| `playerPortrait` | `assets/player-portrait.png` | Player card backdrop (blend luminosity). |
| `rockProjectile` | `assets/rock-projectile.png` | Pin marker icon on rock-pinned arrows. |
| `magicProjectile` | `assets/magic-projectile.png` | Reserved. |
| `castGlow` | `assets/cast-glow.png` | CAST telegraph aura. |
| `hitFx` | `assets/hit-fx.png` | Reserved. |

Recommended size: background 1920x1080; frame ~940x600 with transparent playable interior;
portraits roughly square, at least 512x512, transparent background.
