# TASK: ARENA-001 — Runtime Arena Candidate Pack

STATUS: READY
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

## RESULT / VERIFY / FOUND

Заполнить перед сдачей.

## Delivery

Commit -> push -> verify remote RESULT_SHA -> STATUS DONE.
Не merge main.
