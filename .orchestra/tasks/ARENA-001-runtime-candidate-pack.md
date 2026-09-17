# TASK: ARENA-001 — Runtime Arena Candidate Pack

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Muse / asset-presentation agent
BASE_BRANCH: fix/FIX-021-board-plane-projection
BRANCH: design/ARENA-001-runtime-candidate-pack
START_SHA: edb56232beb3b46d322388c369cb598ccf9dccc1

## Goal

Из большого локального каталога сгенерированных арен подготовить небольшой, контролируемый runtime candidate pack для дальнейшей интеграции. Не тащить сотни PNG в repo и не менять gameplay.

## Source

Локально:
`C:\Users\nerza\Projects\magicarrowassets\arenas\`

Пользователь уже сгенерировал много square-first арен, особенно 5x5 и 6x6, включая goblin-themed 6x6.

## Rules

- Это CURATION/ASSET task, не level-design и не gameplay mapping.
- Не объявлять выбранные арены final/user-approved.
- Не менять renderer/projection/encounters.
- Не импортировать весь каталог.
- Не переименовывать source-файлы.
- Никаких новых генераций без отдельной просьбы пользователя.

## Required output

Отобрать 6–8 strongest candidate arenas с разнообразием окружения, но одинаковой композиционной логикой.

Обязательно включить:
- минимум 2 goblin-themed 6x6;
- минимум 2 других 6x6;
- максимум 1–2 5x5 как tutorial candidates, НЕ объявляя 5x5 production policy;
- по возможности разные палитры/биомы.

Для каждой записать:
- source filename;
- nominal board size по source/reference;
- theme/tag;
- есть ли baked grid;
- насколько чистый board well;
- есть ли top/left/right actor space;
- примерные normalized board-plane corners;
- примерные TOP/LEFT/RIGHT actor anchors;
- visual risks.

Скопировать только отобранные runtime-кандидаты в:
`spikes/arrow-core/viewer/visual-proto/assets/arenas/candidates/`

Создать:
`docs/ARENA-001-RUNTIME-CANDIDATES.md`

и маленький data-only manifest, например:
`spikes/arrow-core/viewer/visual-proto/arena-candidates.js`

Manifest пока НЕ должен автоматически переключать production background. Это данные для следующей integration task.

## Important

Если у арены baked 6x6 grid, пометить её как `boardSizeLocked: 6` candidate.
Если board well пустой/нейтральный — пометить `boardSizeFlexible: true`.
Не пытаться насильно использовать 6x6 art для 8x8/10x10.

## Verify

- проверить размеры/формат/альфа;
- сделать contact sheet выбранных 6–8 арен;
- убедиться, что repo не раздут сотнями source images;
- никакого runtime regression.

## RESULT

7 candidates in `spikes/arrow-core/viewer/visual-proto/assets/arenas/candidates/` (original
filenames, untouched, ~22 MB total; 20 remaining source files NOT imported):

- `6x6 (4).png` — goblin-jungle, baked 6x6 counted on 2x crop, `boardSizeLocked: 6`;
- `6x6 (2).png` — fel-skull, baked 6x6 counted, `boardSizeLocked: 6`;
- `6x6-2.png` — inferno lava, baked 6x6 counted, `boardSizeLocked: 6`;
- `6x6-3.png` — frost aurora, baked 6x6 counted, `boardSizeLocked: 6`;
- `6x6-4.png` — ocean pearl reef, baked 6x6 counted, `boardSizeLocked: 6`;
- `5x5.png` — violet ruins, baked 5x5 counted, `boardSizeLocked: 5`, tutorial candidate only
  (NOT a 5x5 production policy decision);
- `na.png` — waterfall fortress, NO baked grid (irregular stonework + mosaic platform),
  `boardSizeFlexible: true`.

Also delivered: `docs/ARENA-001-RUNTIME-CANDIDATES.md` (per-candidate theme / boardPlane /
TOP-LEFT-RIGHT anchors approx ±0.03 / risks / quota check / rejected list),
`spikes/arrow-core/viewer/visual-proto/arena-candidates.js` (ESM data-only, no loader, no
background switch) + matching `arena-candidates.d.ts`,
`candidates/_contact-sheet.jpg` (proof only, not runtime).
RESULT_SHA: fe1255bab8204001e5df68275c806ff5b0e30bd5 (code pack commit, pushed + remote
verified before STATUS DONE; task-card close is a separate docs commit — see git log).

## VERIFY

- All 27 source files listed + dimension-checked via PIL (1672x941 RGB, 6x6-2..6x6-7 1619x971
  RGB); all 7 picks visually inspected as thumbnails, baked grids counted on 2x board crops.
- `node -e import(arena-candidates.js)`: 7 entries, 5x locked6, 1x flexible, lookup ok / null ok.
- Contact sheet rendered and eyeballed (7 labeled thumbs, distinct biomes).
- `git status`: no renderer/projection/encounter/app.js changes; only pack + doc + manifest + card.
- Remote verify: `origin/design/ARENA-001-runtime-candidate-pack` == local HEAD after push.

## FOUND

- Incidental (NOT fixed, not mine): working tree carries unrelated leftovers —
  `donors.md`, `spikes/arrow-core/encounters/multi-shortlist.json` (untracked), plus ART-003
  deliverables (`docs/ART-003-BOARD-FRAME-OVERLAY.md`, `assets/board/*.png`) which were found
  STAGED in the index on arrival although byte-identical copies are already committed on
  `build/ART-003-board-frame-overlay`. Unstaged them (`git reset` on those paths only) so this
  branch's commits contain only ARENA-001 files. Owner of that residue should clean it up.
- All shortlisted arenas are RGB without alpha; any future overlay compositing must not assume
  an alpha channel in these backgrounds.
- `na.png` well is a sloped irregular ramp — integration will need a projected overlay
  (FIX-021 territory), recorded as a risk, not solved here.

## Delivery

Commit -> push -> verify remote RESULT_SHA -> STATUS DONE.
Не merge main.
