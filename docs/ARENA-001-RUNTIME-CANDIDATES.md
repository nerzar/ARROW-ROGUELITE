# ARENA-001 — Runtime Arena Candidate Pack

Curation-only. Nothing here is user-approved final art; nothing is wired into the game.
Source pool: `C:\Users\nerza\Projects\magicarrowassets\arenas\` (27 files, none imported wholesale).
Runtime copies (original filenames, untouched): `spikes/arrow-core/viewer/visual-proto/assets/arenas/candidates/`
Data-only manifest: `spikes/arrow-core/viewer/visual-proto/arena-candidates.js` (no auto-switch of the production background).
Contact sheet: `spikes/arrow-core/viewer/visual-proto/assets/arenas/candidates/_contact-sheet.jpg` (proof only, not runtime).

All coords are normalized fractions of the image, approximate (±0.03, estimated by eye).
`boardPlane` = TL/TR/BR/BL corners of the painted board slab. `anchors` = TOP boss spot /
LEFT-W / RIGHT-E side spots. Board grids below were counted on 2x crops of the board area.

## 1. goblin-jungle — `6x6 (4).png` (1672x941 RGB, no alpha)

- Theme: goblin jungle outpost — mossy timber palisade, skull shields, waterfalls.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows, clean dark stone well.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.30,0.36) TR(0.70,0.36) BR(0.80,0.82) BL(0.20,0.82).
- Anchors: TOP(0.50,0.12) LEFT(0.09,0.55) RIGHT(0.91,0.55) — stair platforms + braziers.
- Risks: busy side foliage may fight small side-character silhouettes; skull shields sit close to board rails.

## 2. fel-skull — `6x6 (2).png` (1672x941 RGB, no alpha)

- Theme: fel/skull fortress — green fire braziers, skull totems, red war cloth.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows on riveted iron well.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.29,0.34) TR(0.71,0.34) BR(0.81,0.84) BL(0.19,0.84).
- Anchors: TOP(0.50,0.12) LEFT(0.09,0.55) RIGHT(0.91,0.55).
- Risks: darkest well of the pack — arrow contrast must be checked per palette; green fire may tint board edges.

## 3. inferno — `6x6-2.png` (1619x971 RGB, no alpha)

- Theme: inferno lava citadel — magma falls, ember rails, red banners.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.28,0.32) TR(0.72,0.32) BR(0.82,0.86) BL(0.18,0.86).
- Anchors: TOP(0.50,0.11) LEFT(0.09,0.56) RIGHT(0.91,0.56).
- Risks: highest-saturation background — glare near bottom rails; warm cast over the whole well.

## 4. frost — `6x6-3.png` (1619x971 RGB, no alpha)

- Theme: frost aurora citadel — snow rails, ice crystals, blue banners.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows on blue marble.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.28,0.33) TR(0.72,0.33) BR(0.82,0.85) BL(0.18,0.85).
- Anchors: TOP(0.50,0.11) LEFT(0.09,0.56) RIGHT(0.91,0.56).
- Risks: cold blue well — blue arrows may lose contrast; snow sparkle adds high-frequency noise at rails.

## 5. ocean-pearl — `6x6-4.png` (1619x971 RGB, no alpha)

- Theme: ocean pearl reef — shells, coral, daylight teal water.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows, brightest well of the pack.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.26,0.30) TR(0.74,0.30) BR(0.85,0.88) BL(0.15,0.88) (widest slab of the pack).
- Anchors: TOP(0.50,0.10) LEFT(0.07,0.55) RIGHT(0.93,0.55).
- Risks: only daylight candidate — mood break vs night pack; shell ornaments protrude over left/right rails.

## 6. violet-ruins — `5x5.png` (1672x941 RGB, no alpha) — TUTORIAL candidate

- Theme: moonlit violet ruins — purple creepers, rune diamonds, stone arch.
- Nominal size: 5x5. Baked grid: counted 5 cols x 5 rows.
- `boardSizeLocked: 5`. Tutorial candidate only — does NOT declare 5x5 production policy.
- boardPlane: TL(0.31,0.36) TR(0.69,0.36) BR(0.78,0.83) BL(0.22,0.83).
- Anchors: TOP(0.50,0.13) LEFT(0.10,0.56) RIGHT(0.90,0.56).
- Risks: locked to 5x5 art — unusable for 6x6+ without rework; most monochrome well, arrow palette must carry readability.

## 7. waterfall-well — `na.png` (1672x941 RGB, no alpha) — FLEXIBLE well

- Theme: waterfall fortress courtyard — statues, red banners, night water.
- Nominal size: none (no baked grid). Board area is irregular stonework ramp + round mosaic
  platform behind — a neutral well, NOT a grid.
- `boardSizeFlexible: true`.
- Well region (approx): TL(0.22,0.28) TR(0.78,0.28) BR(0.88,0.95) BL(0.12,0.95).
- Anchors: TOP(0.50,0.10) on the mosaic circle; LEFT(0.10,0.60) RIGHT(0.90,0.60) on stair platforms.
- Risks: sloped irregular stones give no natural cell alignment — needs projected overlay;
  the round mosaic behind reads as a boss podium, good for TOP but competes with a board placed high.

## Quota check

- Goblin-themed 6x6: 2 (goblin-jungle, fel-skull).
- Other 6x6: 3 (inferno, frost, ocean-pearl).
- 5x5 tutorial: 1 (violet-ruins, max 2 allowed).
- Flexible well: 1 (waterfall-well).
- Total: 7 files, ~22 MB. Remaining 20 source files NOT imported.
- Palettes: jungle-green, fel-green, lava-red, frost-blue, ocean-teal, violet-night, waterfall-night.

## Not selected (and why)

- `6x6.png` (celestial): strong art, but night-blue/gold duplicates frost's role; kept as backup.
- `6x6 (3).png` (orc ironworks): overlaps fel-skull's dark-metal read; backup goblinoid.
- `6x6 (5).png` (crystal cavern), `6x6 (6).png` (swamp skulls): third/fourth green-dark entries; backups.
- `6x6-5/6/6-7.png` (shadow-moon, autumn, crusader): fine, but palettes covered; backups.
- `5x5 (2..5).png`: other tutorial options; emerald-forest is closest to goblin-jungle (rejected for variety).
- All `8x6/8x7/10x7/10x8.png`: non-square nominal grids, out of scope for the square-first pack; untouched.

## Integration notes (for the next task, not this one)

- Locked candidates need the renderer to treat their baked grid as decoration and project the
  real puzzle layer over `boardPlane` (FIX-021 territory).
- `na.png` is the only candidate where the board rect itself is still an open decision.
- No renderer, projection, encounter, or background-switch code was touched.
