# TASK: BUILD-022 — Projected Board + Frame Integration V01

STATUS: DONE
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

### Course correction (2026-09-17, пользователь)

В процессе интеграции пользователь остановил и отменил исходный "Required result" п.1-6
(`board-frame-overlay.png` как foreground-слой вокруг projected puzzle). Причина: собранный
review-build читался как второй объект, вставленный поверх арены (отдельная квадратная плита +
рамка на фоне уже готового каменного well арены), а не как единая сцена. Геометрически это
подтвердилось: safe inner rect ART-003-рамки (normalized 0.1992..0.8008 с обеих осей, т.е.
квадрат) не может одновременно покрыть FIX-021 board-plane trapezoid без коллизии — near/bottom
край board-plane trapezoid на экране ~2x шире far/top края (замерено на 1920x1080, 8x8: top
309px, bottom 782px, height 391px), а требуемый для полного покрытия квадратный frame либо
перекрывает часть кликабельных ближних ячеек, либо перекрывает Shaman/podium сверху. Численно
проверено в браузере (сэмплинг alpha-канала board-frame-overlay.png по каждому cell-center для
6x6/8x8/10x10 x 4 поворота): при кадрировании по высоте backdrop минимум 1 ячейка на 6x6 (col0
row3) уже полностью закрыта непрозрачным камнем рамки; безопасный размер без единой закрытой
ячейки существует (K≈1.69 от базовой высоты), но он вызывает ~300px перекрытие с Shaman-спрайтом.

**Новое утверждённое направление:** арена САМА является board frame/surface. Рендерер проецирует
только puzzle-контент (arrow paths, glow, selection, projectile/impact fx, debug-сетка только при
debug-режиме) прямо на уже нарисованный каменный well арены через FIX-021 `board-plane.js`
project()/unproject(). Никакой отдельной панели или второй рамки поверх арены.

Что сделано вместо п.1-6 исходного brief:
- `board-renderer.js`: `drawBoardSurface` больше не рисует полупрозрачную панель/подложку и
  обводку по backdrop-quad — это и был "gray/black rectangular board background", который
  пользователь отклонил. Функция теперь рисует только debug-сетку точек + пунктирный контур
  backdrop, и только когда включена debug-панель (`view.debug`); в обычной игре не рисует ничего.
  Puzzle-контент (arrows/glow/selection/shots), который и раньше рисовался через
  `cellToScreen`/`board-plane.js` независимо от панели, теперь оказывается единственным, что
  визуально стоит на доске — то есть уже лежит прямо на арт-арене.
- `app.js`: один проброс `debug: !ui.debugPanel.classList.contains('hidden')` в `renderer.frame()`.
- `board-frame-overlay.png` / `board-inner-mask.png` (ART-003) и
  `docs/ART-003-BOARD-FRAME-OVERLAY.md` — скопированы в git как committed reference/experiment
  asset (по прямому указанию пользователя), НЕ подключены ни в `assets.js`, ни в рендер-путь.
  Доп. пометка добавлена в начало `docs/ART-003-BOARD-FRAME-OVERLAY.md`, что для текущей arena
  gameplay сцены asset не используется.
- Требования п.7 (side podium anchors, Shaman top anchor, effect anchors) не затронуты — этот код
  (`arena-layout.js`) не менялся.
- boardSizeLocked/boardSizeFlexible arena-каталог (упомянут пользователем как контекст) в этой
  задаче НЕ реализовывался по прямому указанию ("Do NOT automatically switch the game's arena
  catalogue in this task") — Moonlit Fortress остаётся единственной proof-сценой.

### RESULT

- `spikes/arrow-core/viewer/visual-proto/board-renderer.js`: `drawBoardSurface` перестал рисовать
  translucent panel/border поверх арены; puzzle-контент (arrows/glow/selection/shots) рисуется
  прямо через существующий `board-plane.js` projection, без изменений в проекции/hit-testing/
  Rotate-семантике. Debug alignment dots + пунктирный backdrop-контур остались, но только за
  debug-toggle.
- `spikes/arrow-core/viewer/visual-proto/app.js`: пробрасывает `debug` флаг в рендерер (1 строка).
- ART-003 assets (`board-frame-overlay.png`, `board-inner-mask.png`) + doc — в git как reference,
  не в рантайме.
- `assets.js` не менялся (не добавлял и не подключал `boardFrameOverlay` — по итогу course
  correction в этом asset нет нужды в рантайме).
- generator/solver/encounter definitions/HP/timers/Rotate semantics/Stone Pin/RunState — не
  затронуты.

### VERIFY

- `npm run typecheck` — чисто (0 ошибок).
- `npm test` — 241/241 passed, 19 test files.
- `npm run build` — чисто.
- Браузер (свой dev-сервер в изолированном `.worktrees/BUILD-022`, отдельный от других
  параллельных агентов на этой машине):
  - 5x5, 6x6, 10x10 square debug boards (1920x1080-эквивалент через 960x540 emulated viewport,
    16:9 — те же относительные пропорции) — arrows/glow нарисованы прямо на каменном well арены,
    без панели и без второй рамки.
  - 1366x768 — 10x10 square debug board, тот же результат (аспект те же 16:9-подобные пропорции,
    геометрия board-plane не зависит от абсолютного разрешения).
  - Один rectangular regression (`act1-e1`, 6x7) — не сломан, puzzle-контент по-прежнему верно
    проецируется, letterboxed внутри квадратного safe-footprint как и раньше (FIX-021 fitGrid не
    менялся).
  - Prologue Shaman scene (`cp-e5`) — boss anchor/effect anchor не сдвинуты.
  - Act I side-enemy scene (`cp-e4`) — оба enemy (N/E) на месте.
  - Rotate CW: `s.rotation` 0 -> 1, `boardPlane().angleDeg` 0 -> 90 подтверждено программно
    (`visualDebug.rotate(1)` + `visualDebug.boardPlane()`), backdrop-footprint не меняется (как и
    раньше, т.к. `board-plane.js` не трогался).
  - Edge/corner hit-testing: выбрана стрела на крайней (col0) ячейке прямоугольной доски `act1-e1`,
    реальный клик мышью по её спроецированным экранным координатам (`projectBoardPoint`) убрал
    стрелу (`board.isAlive` true -> false) — подтверждает, что screenToCell/click mapping не
    задет.
  - Debug-toggle: включение debug-панели меняет ~13 300 из 76 245 canvas-пикселей в
    board-bbox-регионе (пунктирный контур + сетка точек появляются/исчезают), подтверждено
    программным canvas diff, а не только на глаз.
- Скриншоты сохранены как inline-изображения в диалоге сессии (5x5, 6x6, act1-e1 rectangular,
  Shaman cp-e5, side-enemies cp-e4, 10x10 @ 1366x768) — отдельных файлов на диск не выгружалось;
  при необходимости архитектор может запросить повтор с сохранением в файл.

### FOUND

1. Рабочий каталог `C:\Users\nerza\Projects\ARROW-ROGUELITE` (без выделенного `.worktrees/`)
   используется параллельно НЕСКОЛЬКИМИ агентами/задачами одновременно (LD-003, LD-004, LD-005,
   ASSET-004, ARENA-001, BESTIARY-001 и т.д. в одном reflog) — первая попытка сделать BUILD-022
   прямо в этом каталоге была потеряна: другой агент переключил ветку на
   `design/ARENA-001-runtime-candidate-pack` поверх незакоммиченных изменений. Задача
   пересобрана в `.worktrees/BUILD-022` (по аналогии с уже существующими `.worktrees/FIX-021`,
   `.worktrees/VIS-001` и т.д.). Рекомендация архитектору: заводить `.worktrees/<TASK>` для КАЖДОЙ
   задачи, трогающей файлы (а не только для части), а не работать в общем root.
2. Пользователь прислал референс-изображение с другим стилем стрелок (сегментированные/
   пунктирные "рельсы" с засечками, двунаправленные наконечники) — явно отличается от текущего
   стиля (сплошная светящаяся линия) в `board-renderer.js`'s `drawArrow`. По решению пользователя
   ("Отдельная задача") в этот BUILD-022 НЕ включено; оставлено как заметка для будущей
   ART/VIS-задачи по стилю стрелок.
3. Дублирует FOUND #2 из ART-003: плоский квадратный overlay поверх board-plane's
   perspective-foreshortened trapezoid структурно не может одновременно (a) не закрывать
   кликабельные ближние ячейки и (b) не залезать на Shaman/podium — замерено численно в этой
   задаче (см. "Course correction" выше), не только предположение.

RESULT_SHA (code): 6d1589b — feat(BUILD-022): project puzzle content directly onto arena stone,
drop board panel/frame. This DONE/bookkeeping commit follows it and is origin HEAD after push
(verified below).

## Delivery

1. code commit(s)
2. заполнить RESULT / VERIFY / FOUND
3. report/task commit
4. push `build/BUILD-022-board-integration-v01`
5. проверить remote RESULT_SHA
6. STATUS DONE только после remote verify

НЕ merge main.
НЕ удалять source branches.
