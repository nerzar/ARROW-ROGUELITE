# TASK: BUILD-022 — Projected Board + Frame Integration V01

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: Claude / Sonnet (integration engineer)
BASE_BRANCH: fix/FIX-021-board-plane-projection
BRANCH: build/BUILD-022-board-integration-v01
START_SHA: edb56232beb3b46d322388c369cb598ccf9dccc1

## Goal

Собрать один review-build, в котором принятый FIX-021 projection и готовый ART-003 board frame работают вместе в реальной игре.

Это визуальная интеграция, не новый gameplay task.

## Inputs

- `fix/FIX-021-board-plane-projection` @ `edb56232beb3b46d322388c369cb598ccf9dccc1`
- `build/ART-003-board-frame-overlay` @ `93bc64755ebd56e5d039b51cf226f56e6c5f07b6`

Из ART-003 нужны assets/doc, а не его старая runtime база целиком.

## Canonical decisions

- square-first production content;
- основной диапазон сейчас 6x6..10x10;
- frame/stone plate неподвижны;
- Rotate вращает только puzzle-layer;
- projection/input mapping из FIX-021 сохраняются source of truth;
- прямоугольники не удалять, только regression compatibility;
- gameplay/encounter rules не менять.

## Required result

1. Подключить `board-frame-overlay.png` как foreground/decorative layer вокруг projected puzzle.
2. Не закрыть кликабельную область поля.
3. Не вращать overlay при Rotate.
4. Проверить порядок слоёв: arena -> projected board content -> frame overlay -> actors/HUD/VFX по правильному z-order.
5. Frame должен визуально поддерживать квадратные 6x6, 8x8, 10x10.
6. Не возвращать ощущение floating card.
7. Сохранить side podium anchors, Shaman top anchor и effect anchors из FIX-021.

## Arena policy

Не импортировать весь пользовательский каталог арен в эту задачу.
Использовать текущую Moonlit Fortress как основной runtime proof.
Новые arenas будут отдельным task.

## Allowed scope

- `.orchestra/tasks/BUILD-022-board-integration-v01.md`
- `spikes/arrow-core/viewer/visual-proto/assets/board/**`
- `spikes/arrow-core/viewer/visual-proto/assets.js` / `.d.ts` при необходимости
- `spikes/arrow-core/viewer/visual-proto/board-renderer.js`
- минимальный `app.js` / `style.css` glue только при необходимости
- integration tests

Не менять generator/solver/encounter definitions/HP/timers/Rotate semantics/Stone Pin/RunState.

## Verify

- `npm run typecheck`
- `npm test`
- `npm run build`
- browser 1920x1080 + 1366x768
- 6x6, 8x8, 10x10
- one rectangular regression
- Rotate CW/CCW
- edge/corner click hit-testing
- Prologue Shaman scene
- Act I side-enemy scene

Сохранить screenshots минимум: 6x6 default, 10x10, rotated board, Shaman boss, side enemies.

## RESULT / VERIFY / FOUND

Заполнить перед сдачей.

## Delivery

1. code commit(s)
2. заполнить RESULT / VERIFY / FOUND
3. report/task commit
4. push `build/BUILD-022-board-integration-v01`
5. проверить remote RESULT_SHA
6. STATUS DONE только после remote verify

НЕ merge main.
НЕ удалять source branches.
