# ARENA-002 — Prologue / Act I Arena Pack

Curation-only. Nothing here is user-approved final art; nothing is wired into the game.
Supplements ARENA-001 (does not replace it).
Source pool: `C:\Users\nerza\Projects\magicarrowassets\arenas\` (39 files, none imported wholesale).
Runtime copies (original filenames, untouched): `spikes/arrow-core/viewer/visual-proto/assets/arenas/prologue-act1/` (8 files).
Data-only manifest: `spikes/arrow-core/viewer/visual-proto/arena-pack-002.js` (+ `.d.ts`, no loader, no background switching).
Contact sheet: `spikes/arrow-core/viewer/visual-proto/assets/arenas/prologue-act1/_contact-sheet.jpg` (proof only, not runtime).

All coords are normalized fractions of the image, approximate (±0.03, read off 10%-grid overlays).
`boardPlane` = TL/TR/BR/BL corners of the painted board slab. `anchors` = TOP boss spot /
LEFT-W / RIGHT-E side spots (stair platforms in this generation). `bossSpace` = free setback
behind the top rail. Grids below were counted per-file on source pixels at 900px thumbs plus
2x board zooms — filenames were NOT trusted.

Visual policy (per task): the arena itself is the stone board well / frame. No second opaque
board/frame is painted over it; runtime draws only arrows/glow/VFX on the stone surface.

## Prologue 5x5 (4)

### P1. prologue-violet-arch — `5x5.png` (1672x941 RGB, no alpha)

- Theme: moonlit violet arch ruins — purple banners, braziers, stair platforms.
- Nominal size: 5x5. Baked grid: counted 5 cols x 5 rows.
- `boardSizeLocked: 5`.
- boardPlane: TL(0.24,0.30) TR(0.76,0.30) BR(0.84,0.78) BL(0.16,0.78).
- Anchors: TOP(0.50,0.12) LEFT(0.08,0.55) RIGHT(0.92,0.55).
- Boss space: arch recess y 0.12–0.30, moderate.
- Risks: SAME FILENAME as ARENA-001 `violet-ruins` but NEW art (stair composition, new
  generation) — do not confuse the two packs; most monochrome well, arrow palette must
  carry readability.

### P2. prologue-emerald — `5x5 (2).png` (1672x941 RGB, no alpha)

- Theme: emerald forest ruins — green banners, waterfalls, ivy.
- Nominal size: 5x5. Baked grid: counted 5 cols x 5 rows.
- `boardSizeLocked: 5`.
- boardPlane: TL(0.26,0.30) TR(0.74,0.30) BR(0.82,0.78) BL(0.18,0.78).
- Anchors: TOP(0.50,0.12) LEFT(0.08,0.55) RIGHT(0.92,0.55).
- Boss space: arch recess y 0.12–0.30, moderate.
- Risks: brightest prologue well; green banners flank the top rail at eye level.

### P3. prologue-inferno — `5x5 (3).png` (1672x941 RGB, no alpha)

- Theme: inferno ember ruins — lava falls, red war banners.
- Nominal size: 5x5. Baked grid: counted 5 cols x 5 rows.
- `boardSizeLocked: 5`.
- boardPlane: TL(0.27,0.28) TR(0.73,0.28) BR(0.82,0.78) BL(0.18,0.78).
- Anchors: TOP(0.50,0.10) LEFT(0.08,0.55) RIGHT(0.92,0.55).
- Boss space: arch recess y 0.10–0.28, moderate.
- Risks: highest-saturation prologue background; lava glow spills near bottom rail.

### P4. prologue-frost — `5x5 (4).png` (1672x941 RGB, no alpha)

- Theme: frost crystal ruins — snow rails, blue banners, waterfalls.
- Nominal size: 5x5. Baked grid: counted 5 cols x 5 rows.
- `boardSizeLocked: 5`.
- boardPlane: TL(0.25,0.36) TR(0.75,0.36) BR(0.83,0.80) BL(0.17,0.80).
- Anchors: TOP(0.50,0.14) LEFT(0.08,0.58) RIGHT(0.92,0.58).
- Boss space: arch recess y 0.14–0.36, moderate.
- Risks: blue arrows may lose contrast on the blue-grey well; snow sparkle at rails.

## Prologue boss 6x6 (2)

### B1. boss-orc-ironworks — `6x6 (3).png` (1672x941 RGB, no alpha)

- Theme: orc ironworks forge — skull-gear medallions, red war banners, chains.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.24,0.38) TR(0.76,0.38) BR(0.85,0.84) BL(0.15,0.84).
- Anchors: TOP(0.50,0.16) under skull medallion LEFT(0.06,0.60) RIGHT(0.94,0.60).
- Boss space: deep forge arch behind top rail (y 0.16–0.38) with central skull; good.
- Risks: busiest top rail (gear medallions); warm glare near bottom rail.

### B2. boss-shadow-moon — `6x6-5.png` (1619x971 RGB, no alpha)

- Theme: shadow-moon cathedral — moon arch, angel statues, candles, skull piles.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.24,0.40) TR(0.76,0.40) BR(0.85,0.82) BL(0.15,0.82).
- Anchors: TOP(0.50,0.16) LEFT(0.06,0.58) RIGHT(0.94,0.58).
- Boss space: moonlit arch + statues behind top rail (y 0.16–0.40); good.
- Risks: candles + statues crowd the top corners; cool palette, check warm-arrow contrast.

## Act I goblin 6x6 (4 = 2 new + 2 ARENA-001 reuse, no re-copy)

### A1. act1-swamp-skulls — `6x6 (6).png` (1672x941 RGB, no alpha) [NEW]

- Theme: goblin swamp outpost — war banners, green wisps, moonlit lake.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.24,0.40) TR(0.76,0.40) BR(0.85,0.82) BL(0.15,0.82).
- Anchors: TOP(0.50,0.16) LEFT(0.06,0.60) RIGHT(0.94,0.60).
- Boss space: open moonlit lake behind top rail (y 0.16–0.40); good.
- Risks: green wisps + war banners near side rails; brightest goblin well.

### A2. act1-crystal-cavern — `6x6 (5).png` (1672x941 RGB, no alpha) [NEW]

- Theme: goblin crystal cavern — red banners, glowing mushrooms, cavern bridge.
- Nominal size: 6x6. Baked grid: counted 6 cols x 6 rows.
- `boardSizeLocked: 6`.
- boardPlane: TL(0.24,0.42) TR(0.76,0.42) BR(0.85,0.84) BL(0.15,0.84).
- Anchors: TOP(0.50,0.18) LEFT(0.06,0.62) RIGHT(0.94,0.62).
- Boss space: cavern bridge behind top rail (y 0.18–0.42), partially busy; moderate.
- Risks: narrowest top clearance of the pack; glowing mushrooms compete at side rails.

### A3/A4. act1-fel-skull-ref + act1-goblin-jungle-ref (REUSE, not copied)

- `6x6 (2).png` (fel-skull) and `6x6 (4).png` (goblin-jungle) already curated in ARENA-001
  (`assets/arenas/candidates/`); manifest carries their planes/anchors by reference so the
  Act I set reads as 4 without duplicating ~6 MB.

## Quota check

- Prologue 5x5: 4 (violet-arch, emerald, inferno, frost).
- Prologue-boss 6x6: 2 (orc-ironworks, shadow-moon).
- Act I goblin 6x6: 4 (swamp-skulls, crystal-cavern + fel-skull-ref, goblin-jungle-ref).
- New files copied: 8 PNGs, ~24 MB. Remaining 31 source files NOT imported.
- Palettes: violet-night, emerald-green, lava-red, frost-blue, forge-orange, moon-violet,
  swamp-green, cavern-purple.

## Excluded (counted, rejected, with reason)

- `5x5 (5).png` (autumn): TRUE 5x5, but daylight — mood break vs night prologue; backup.
- `6x6.png` (celestial), `6x6-2/3/4` (inferno/frost/ocean), `6x6-6/7` (autumn/crusader):
  TRUE 6x6, palettes covered or non-goblin; backups (6x6-2/3/4 already in ARENA-001).
- `ChatGPT …03_58_54…(1)` … `03_58_56…(8)` (8 files): measured **6 cols x 5 rows**
  (2x board zooms) — NOT square, excluded from all quotas despite 6-wide look.
- `ChatGPT …04_06_32…(1..3)`, `04_06_33…(4)` (4 files): measured **5 cols x 6 rows**
  (2x board zooms) — NOT square, excluded.
- `8x6/8x6 (2)/8x7…/10 x 7/10x8.png`: different scene-style compositions, non-square
  nominals; out of scope for the square-first pack (spot-checked, untouched).
- `na.png`: flexible well already in ARENA-001; not re-copied.
- `assets/arenas/crops/` (29 files, untracked scratch): pixel-compared (MAE 44–58) —
  they do NOT match current source files (stale/mislabeled set); all counts above were
  redone from source pixels, crops were NOT used and are NOT committed.

## Integration notes (for the next task, not this one)

- Locked candidates need the renderer to treat their baked grid as decoration and project
  the real puzzle layer over `boardPlane` (FIX-021 territory).
- `5x5.png` filename collides with ARENA-001 `violet-ruins` file — different art, different
  folder; a future wiring task must qualify by folder, never by bare filename.
- No renderer, projection, encounter, or background-switch code was touched.
