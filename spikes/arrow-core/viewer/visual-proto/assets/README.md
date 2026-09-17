# VIS-001 asset manifest

Drop a PNG at any of these paths and the shell picks it up on next reload -- no code change needed
(see `../assets.js`). Anything missing renders as a drawn placeholder, so this directory can stay
empty during development.

| Key | Path | Used for |
|---|---|---|
| `background` | `assets/background.png` | Full-bleed arena background behind the board. |
| `boardFrame` | `assets/board-frame.png` | Decorative frame drawn behind the canvas (board itself stays code-rendered). |
| `boardTexture` | `assets/board-texture.png` | Reserved: stone/board surface texture overlay. Not yet wired into board-renderer.js. |
| `boss` | `assets/boss.png` | Portrait for single-target `boss` encounters. |
| `enemyTop` / `enemyRight` / `enemyBottom` / `enemyLeft` | `assets/enemy-<side>.png` | Positional fallback portrait for `enemies`-mode targets, picked by the side they currently occupy. |
| `portraits.<enemyId>` | set in `ASSET_MANIFEST.portraits` in `assets.js` | Per-enemy override, e.g. `grunt_e`, checked before the positional slot. |

Recommended size: roughly square, at least 512x512, transparent background for portraits.
