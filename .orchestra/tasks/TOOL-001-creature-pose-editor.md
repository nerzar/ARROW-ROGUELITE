# TASK: TOOL-001 — Creature Pose/State Editor

STATUS: DONE
TYPE: TOOL
SIZE: M
AGENT: Claude / implementation
BASE_BRANCH: build/ASSET-003-complete-creature-library
BRANCH: tool/TOOL-001-creature-pose-editor
START_SHA: 48583e451f4e4f540e7ce9a53534c126a76b98cf

## Context

Задача передана пользователем напрямую в чате (короткая постановка, без отдельной
архитекторской сессии, без предварительного task-card). Task-card создан исполнителем по
шаблону проекта, задача не относится к другому уже существующему task-card.

Базовая ветка выбрана намеренно: `build/ASSET-003-complete-creature-library` (ASSET-003, DONE,
не влит в integration), а не `integration/BUILD-030-editor-shaman-tail-merge` — потому что
именно ASSET-003 содержит полный `CREATURE_CATALOG`/`ENEMY_MANIFESTS` (10 видов, включая
`small-spider`/`toxic-demonic-spider`/`small-green-slime`), который этому инструменту нужен как
рабочая база для показа/редактирования poses. `integration/BUILD-030` с тех пор получил
отдельный content-only commit пользователя (`e06e32c "content: save calibrated Prologue"`,
ручная калибровка сцены) — этот контент в данной ветке отсутствует; это должен свести
архитектор при интеграции, не задача исполнителя.

## Goal

Маленький authoring tool: выбрать creature/species, увидеть доступные PNG из его исходной
папки (`magicarrowassets/creatures/<species>`), назначить их на состояния (idle, attack, cast,
hit/stunned, taunt, defeat, back/flee и т.п. где применимо), увидеть live preview, при
необходимости подстроить pivot/foot-offset/scale, сохранить в понятный project file/manifest.

Явное ограничение пользователя: **не монструозный редактор** — маленький рабочий инструмент,
не полноценная замена Campaign Editor.

## Required result

- отдельная страница (расширение текущего `calibration-editor.html` инструментария допустимо,
  но как отдельная простая страница/вкладка, не встраивание в основной calibration UI);
- species picker (из `CREATURE_CATALOG`, включая 3 новых вида из ASSET-003);
- список PNG-файлов из исходной папки вида в `magicarrowassets/creatures/<species>` (read-only
  источник, не трогать сам `magicarrowassets`);
- назначение файла на pose-слот (idle/attack/cast/hit/taunt/defeat/back и т.п.), сколько слотов
  реально применимо к виду — не заставлять заполнять все;
- live preview выбранной картинки на сцене (типовой фон/подиум, как в calibration-editor);
- pivot/foot-offset/scale controls для preview (per-species, не per-pose обязательно);
- Save -> реальный project-local файл (manifest), который рантайм (calibration-editor.js /
  app.js через assets.js) реально читает, а не просто UI-заглушка.

## Boundaries

- Не переделывать существующий Campaign Authoring Tool целиком.
- Не менять combat/gameplay логику.
- Не трогать исходную папку `magicarrowassets` (только читать).
- Не мержить в main.
- Работать в отдельном worktree.

## Verify

В браузере:
1. инструмент открывается;
2. переключение state (pose) реально меняет назначенную картинку;
3. сохранение работает и пишет реальный project file;
4. игра/preview (calibration-editor и/или playable runtime) использует выбранные картинки после
   сохранения и перезагрузки.

Плюс `npm run typecheck`, `npm test`, `npm run build`.

## Delivery

RESULT / VERIFY / FOUND / USER PLAYTEST -> commit -> push -> remote SHA verify -> STATUS DONE.
Не merge main.

---

## RESULT

Новая маленькая standalone-страница `viewer/visual-proto/pose-editor.html` (+ `.css`/`.js`),
ссылка на неё добавлена в топбар Campaign Editor (`🎭 Pose Editor →`). Production HUD/`app.js`
UI не тронуты — только их asset-loading добавлен один `await` (см. ниже).

**Что умеет инструмент:**

- **Species picker** — тот же `CREATURE_CATALOG` (10 видов, включая 3 новых из ASSET-003).
- **Source frames gallery** — реальные PNG из `magicarrowassets/creatures/<folder>` (read-only;
  `magicarrowassets` не тронут), картинки показаны как превью-тумбнейлы, не просто имена файлов.
- **Pose slots** — `ENEMY_POSES` (idle/attackReady/attack/hit/defeat) для kind `enemy`,
  `BOSS_POSES` (idle/taunt/cast/stunned/angry/defeat/back) для kind `boss` — только применимые
  для вида слоты, ничего не додумывается.
- Клик по слоту делает его активным/превьюшным; клик по тумбнейлу в галерее назначает файл
  активному слоту — назначение сразу видно и в списке слотов, и в главном preview.
- **Foot pivot** — один draggable amber dot (тот же handle-паттерн, что в calibration-editor.js:
  pointer capture + стрелки клавиатуры, Shift = 10px) + **Scale** slider для preview.
- **Save** — копирует выбранные исходные кадры в реальные project-local файлы
  (`assets/enemies/<species>/<pose>.png`) и пишет/обновляет
  `viewer/visual-proto/creature-poses.json` (read-modify-write per species — сохранение одного
  вида не стирает уже сохранённые другие).

**Как это реально влияет на игру** (не просто UI-игрушка): `assets.js` получил новую функцию
`applyPoseOverrides()`, которая читает `creature-poses.json` и мёрджит его поверх существующих
`ENEMY_MANIFESTS`/`BOSS_MANIFESTS` **in place** (тот же паттерн, что `registerArena()` из
BUILD-029). И `calibration-editor.js`, и production `app.js` теперь делают
`await applyPoseOverrides()` один раз при загрузке, до построения per-species паков — так что и
Campaign Editor, и реальный playable runtime сразу видят то, что сохранил пользователь в новом
инструменте. Пустой/отсутствующий `creature-poses.json` -> no-op, поведение проекта не меняется,
пока пользователь реально что-то не сохранит через новый инструмент.

`asset-catalog.js` получил новое поле `sourceFolder` на каждой записи `CREATURE_CATALOG` (нужно
инструменту, т.к. catalog id и папка-источник не всегда совпадают: `dire-wolf` ->
`dire_wolf`, `goblin-taunter` -> `goblin-king`).

Три новых server endpoint в `tools/serve.mjs` (source по умолчанию:
`C:\Users\nerza\Projects\magicarrowassets\creatures`, переопределяется
`MAGICARROW_CREATURES_DIR`):
- `GET /api/creature-source/list?species=<folder>` — список PNG/JPG/WEBP в папке вида;
- `GET /api/creature-source/file?species=<folder>&name=<file>` — отдаёт сырой файл (лежит вне
  `root`, поэтому нужен отдельный proxy, не общий static handler);
- `POST /api/creature-poses/save` — копирует выбранные кадры + read-modify-write
  `creature-poses.json`.

RESULT_SHA: c9c8d0a46a8875e2a65650d2a49711c732965efe (code commit).

## VERIFY

Изолированный worktree (`.worktrees/TOOL-001`, свой `node_modules`, dev server на отдельном
порту):

- `npm run typecheck` / `npm run build` — 0 ошибок (все правки — plain JS/`.mjs` вне
  `tsconfig.json`'s `include`, кроме `.d.ts`, которые обновлены).
- `npm test` — 288/288 passed (24 файла), без изменений.
- Браузер (Claude Browser, Chromium):
  1. **Инструмент открывается** — `pose-editor.html` грузится, species picker (10 видов),
     7 pose-слотов для Goblin Shaman (kind=boss), source gallery с реальными файлами из его
     папки (`idle.png`, `cast.png`, `angry.png`, `stunned - hit.png`, ... + concept-файл).
  2. **States реально меняются** — клик по слоту "cast" сделал его активным (пустой preview),
     клик по `cast.png` в галерее -> preview сразу показал кастующего шамана, слот "cast"
     получил тумбнейл; переключение обратно на "idle" показывает ранее назначенный `idle.png`.
     Pivot dot подтверждённо двигается drag'ом (`{x:0.37,y:0.45}` -> после drag
     `{x:0.5109,y:0.8797}`, читал напрямую через `window.poseEditorDebug.pivot()`).
  3. **Сохранение работает** — Save на Goblin Shaman -> badge "✔ Saved to
     viewer/visual-proto/creature-poses.json"; на диске реально появились
     `assets/enemies/goblin-shaman/{idle,cast}.png` и `creature-poses.json` с корректной
     структурой (`poses`/`sourceFiles`/`pivot`/`scale`). Reload страницы -> assignment/pivot
     восстановились из файла (badge "Loaded saved poses") — round-trip подтверждён.
  4. **Решающая проверка "игра использует выбранные картинки"**: специально переназначил
     `small-green-slime`'s `idle` на его же `death.png` (лежащий slime вместо весёлого) —
     заведомо другую картинку, чтобы совпадение с уже-существующим idle не смазало тест. После
     Save: (a) в Campaign Editor выбор "Small Green Slime" стал рисовать лежащего слайма вместо
     обычного; (b) нажал "Play Level" -> реальный playable runtime (`app.js`, не редактор) тоже
     показал лежащего слайма — оба потребителя `ENEMY_MANIFESTS` подтверждённо видят override.
  - `read_console_messages`/`read_network_requests`: только уже известные pre-existing 404
    placeholder-ассетов (см. CAL-001's FOUND); новых ошибок нет; все
    `/api/creature-source/*`/`/api/creature-poses/save` запросы -> `200 OK`.
  - **Очистка перед коммитом**: тестовые Save (Goblin Shaman idle/cast, Small Green Slime
    idle->death.png) отменены — `git checkout --` вернул затронутый tracked-файл
    (`assets/enemies/small-green-slime/idle.png`, который тестовый Save случайно перезаписал) и
    `campaigns/campaign.json` (тронут побочно кнопкой "Play Level", которая всегда делает
    `executeSave()`), тестовая папка `assets/enemies/goblin-shaman/` удалена,
    `creature-poses.json` возвращён к чистому `{}` — в коммите нет демо-контента, только сам
    инструмент.

## FOUND

- **Асимметрия папок для boss-видов**: инструмент всегда пишет скопированные кадры в
  `assets/enemies/<species>/`, даже для `goblin-shaman`/`goblin-taunter` (kind=boss), чьи
  pre-existing паки живут в `assets/bosses/<species>/` (`BOSS_PACK_BASE`/`SHAMAN_PACK_BASE`).
  Функционально это не ломает ничего (`applyPoseOverrides()` мёрджит по URL, не по папке), но
  создаёт вторую, отдельную от `assets/bosses/` папку для boss-видов, если инструментом
  переназначить их позы. Не стал унифицировать в этой задаче — тул нарочно маленький и путь
  копирования единый для обоих kind; если это станет реальной проблемой, легко исправить (один
  `if (kind === 'boss') destDir = .../bosses/... `).
- **Pivot/scale не подключены к реальной per-level калибровке**: как и было явно решено в
  ASSET-003's RESULT, actor-геометрия в runtime — per-side (`arena-calibration.js`), не
  per-species. Pivot/scale в этом инструменте — авторская метаинформация конкретно для preview
  внутри самого pose-editor (и сохраняется в манифесте на будущее), но не читается
  `board-renderer.js`/CAL-001 калибровкой автоматически. Это сознательное сужение скоупа под
  "не монструозный редактор"; полноценная интеграция per-species default anchor в
  calibration-editor потребовала бы более широких изменений в geometry contract, чем разумно для
  этой задачи.
- Native file-picker (для добавления файлов НЕ из `magicarrowassets`) не реализован — источник
  явно ограничен `magicarrowassets/creatures/<folder>` per задание ("увидеть доступные PNG из
  его папки"). Если понадобится импорт произвольного файла с диска (как BUILD-029's Import
  Arena) — отдельная небольшая задача, не часть этой.

## USER PLAYTEST

1. `cd spikes/arrow-core && node tools/serve.mjs`, открыть Campaign Editor
   (`http://localhost:<port>/viewer/visual-proto/calibration-editor.html`) и кликнуть
   **"🎭 Pose Editor →"** в топбаре (или сразу `pose-editor.html`).
2. Выбрать существо в **Creature**, слева — pose-слоты, справа — реальные картинки из его
   исходной папки.
3. Кликнуть на слот (например "cast"), затем на нужную картинку в галерее справа — preview в
   центре сразу обновится.
4. Подвигать янтарную точку (foot pivot) мышью или стрелками, если нужно; Scale — только для
   удобства просмотра пропорций.
5. **💾 Save** — запишет реальные файлы в проект. Открыть/перезагрузить Campaign Editor или
   Playable game — назначенная картинка сразу используется там.
