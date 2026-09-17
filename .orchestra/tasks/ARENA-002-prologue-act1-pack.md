# TASK: ARENA-002 — Prologue / Act I Arena Pack

STATUS: READY
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
