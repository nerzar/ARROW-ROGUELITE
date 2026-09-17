# TASK: ARENA-002 — Prologue / Act I Arena Pack

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Muse / asset-presentation agent
BASE_BRANCH: design/ARENA-001-runtime-candidate-pack
BRANCH: design/ARENA-002-prologue-act1-pack
START_SHA: a27e9fc65c5f9ee36c1d71173cf311940c502391

## Goal

Обновить curated arena pack под новую предполагаемую progression policy:
- Prologue: преимущественно 5x5 board wells;
- Prologue boss: преимущественно 6x6;
- Act I: базовый production size 6x6;
- Act II пока только ориентир 7x7, не проектировать здесь.

Не менять renderer/gameplay и не объявлять policy окончательно принятой.

## Source

`C:\Users\nerza\Projects\magicarrowassets\arenas\`

Пользователь уже сгенерировал много новых 5x5 и 6x6 арен, включая отдельные goblin-themed 6x6.

## Required output

Отобрать маленький runtime candidate pack:
- 3–4 лучших 5x5 арен для пролога;
- 1–2 лучших 6x6 арен для boss-пролога;
- 3–4 лучших goblin-themed 6x6 арен для Act I.

Не тащить весь каталог в repo.

Для каждой:
- source filename;
- theme/tag;
- nominal baked grid size;
- действительно ли grid 5x5 / 6x6 (пересчитать вручную/по crop, не верить имени файла);
- boardPlane / safe puzzle rect;
- TOP / LEFT / RIGHT actor anchors;
- свободное место под boss;
- визуальные риски;
- `boardSizeLocked` либо `boardSizeFlexible`.

Никаких аренных кандидатов с неправильным фактическим количеством клеток не включать.

## Visual policy

Арена сама является stone board well / frame.
Никакой второй opaque board/frame поверх неё.
Runtime позже рисует только arrows/glow/VFX непосредственно на каменной поверхности.

## Output files

Обновить/создать:
- `docs/ARENA-002-PROLOGUE-ACT1-PACK.md`
- data-only manifest для кандидатов;
- contact sheet.

Можно копировать только shortlist PNG в candidate runtime folder.
Не wiring в production background.

## Do not

- не менять renderer;
- не менять board projection;
- не менять encounters;
- не генерировать новые изображения;
- не переименовывать source assets;
- не merge main.

## Verify

- визуально пересчитать grid у каждого shortlist asset;
- проверить размеры/формат;
- проверить contact sheet;
- убедиться, что импортирован только shortlist.

## Delivery

RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.

## RESULT

Curated pack delivered (quotas met, all grids counted on source pixels):

- Prologue 5x5 (4, all TRUE 5x5): `5x5.png` violet-arch (NEW art, stair composition —
  same filename as ARENA-001 violet-ruins, different file/folder), `5x5 (2)` emerald,
  `5x5 (3)` inferno, `5x5 (4)` frost. `5x5 (5)` autumn excluded (true 5x5, daylight mood break).
- Prologue-boss 6x6 (2, TRUE 6x6): `6x6 (3)` orc-ironworks (skull-gear forge, deep arch),
  `6x6-5` shadow-moon (moonlit cathedral, statues+candles).
- Act I goblin 6x6 (4 = 2 new + 2 reuse): `6x6 (6)` swamp-skulls, `6x6 (5)` crystal-cavern
  (new copies); `6x6 (2)` fel-skull + `6x6 (4)` goblin-jungle by reference from ARENA-001
  (no re-copy).

Files: `docs/ARENA-002-PROLOGUE-ACT1-PACK.md` (per-arena source/theme/grid/boardPlane/
anchors/bossSpace/locked/risks + quota + exclusions), data-only
`spikes/arrow-core/viewer/visual-proto/arena-pack-002.js` (+ `.d.ts`, no loader),
8 PNGs (original names, untouched) + `_contact-sheet.jpg` in
`assets/arenas/prologue-act1/`. No renderer/projection/encounter/background changes,
no gameplay decisions, policy not declared final.

## VERIFY

- Grid truth (source pixels, 900px thumbs + 2x board zooms, filenames not trusted):
  5x5-family all TRUE 5x5 (5/5); 6x6 + 6x6-dash families all TRUE 6x6 (12/12);
  03_58 batch = 6x5, 04_06 batch = 5x6 (zoom-proven, excluded); 8x*/10x*/na
  spot-checked out-of-scope; no wrong-grid candidate included.
- `node --check arena-pack-002.js` OK; manifest ids/files/planes match doc.
- Contact sheet viewed: 8 labeled arenas, all correct.
- `git status`: only task files added (doc + manifest js/d.ts + 8 PNG + contact sheet);
  no loader/renderer/projection/encounter touched; only the 8 shortlist PNGs imported
  (31 source files NOT imported). Pre-existing untracked `assets/arenas/crops/` left untouched.

## FOUND

- `assets/arenas/crops/` (29 files, untracked scratch) does NOT match current sources
  (downscaled-pixel MAE 44–58): stale/mislabeled set. Nearly caused miscounts; all counts
  redone from source. Suggest architect deletes or regenerates it (not done here — чужое).
- The "new 5x5/6x6" ChatGPT batches are NOT square: 03_58 = 6x5, 04_06 = 5x6. No true
  new goblin 6x6 in them; goblin quota covered by older skull/totem files + ARENA-001 reuse.
- Filename collision: current source `5x5.png` (violet stair arena) vs ARENA-001
  `candidates/5x5.png` (violet rune-frame) — different art, same name; wiring must
  qualify by folder. Noted in doc + manifest risks.
- Follow-up (not started): wiring any of these into a background switch + projecting
  the puzzle layer over `boardPlane` (FIX-021 territory).
