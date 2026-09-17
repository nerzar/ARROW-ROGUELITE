# TASK: CAL-004 — Full Prologue Stage Calibration

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Claude (executor)
BASE_BRANCH: fix/PLAYTEST-002-claude-prologue-polish
BRANCH: tool/CAL-004-prologue-stage-calibration
START_SHA: 7d94dea4fcdcd35d25b3daf70c2be85136c3fac7

> Renumbered from the originally-assigned CAL-003 to CAL-004 before starting work: `CAL-003` was
> already taken by a different, unrelated task ("Arena import workflow in calibration editor",
> branch `tool/CAL-003-arena-import-workflow`, base `fix/CAL-002-independent-actor-scale`, created
> the same day). User confirmed renumbering to CAL-004; `CAL-003` was left untouched.

## Goal

Сделать все 5 этапов текущего Prologue полноценно калибруемыми.

Пользователь должен иметь возможность выбрать любой этап пролога в calibration editor и отдельно настроить для него:

- арену / background;
- положение и размер board;
- actor anchors;
- размер мобов/boss;
- sprite pivot / foot offset;
- effect/VFX anchors.

После Save эти настройки должны использоваться именно соответствующим этапом обычного playable Prologue.

## Current problem (before this task)

Полноценно откалиброван был только первый этап `prologue-5x5`. Этапы 2–5 (`cp-e2`..`cp-e5`) не имели
собственного `presentation`/`calibration` в своих encounter JSON, поэтому падали на общий flexible-
arena default (старая Moonlit Fortress + `board-plane.js`'s `PLANE_CORNERS_FRAC` + `arena-layout.js`'s
`PODIUM_GROUND`/`EFFECT_GROUND`) — один и тот же default на всех четырёх, без возможности откалибровать
их независимо. Сам calibration editor тоже не показывал реальный контент этапов: он всегда генерировал
случайную доску и синтетический 3-сторонний preview-encounter, а не настоящие board/seed/боссов/мобов
каждого этапа.

## RESULT

### 1. Independent per-stage calibration data (`arena-calibration.js`)

Добавлены 4 новые независимые записи в `ARENA_CALIBRATIONS`: `prologue-2`, `prologue-3`, `prologue-4`,
`prologue-5` (Stage 1 остался как есть, на `prologue-5x5-good`). Каждая — полноценная запись со своими
`background`, `boardPlaneFrac`, `anchors`, `effectAnchors`, `actorScale`, `spritePivot`. `boss-shadow-moon`
(debug-only baked arena из FIX-023, никогда не входил в canon Prologue) не тронут.

Стартовые defaults для новых 4 записей — рабочие, а не финальное визуальное решение: переиспользуют
существующий, уже проверенный (арт Moonlit Fortress + текущие `PODIUM_GROUND`/`EFFECT_GROUND`) flexible-
default набор чисел, плюс те же per-side scale-уменьшения, что раньше применялись автоматически
(`DEFAULT_BOSS_SIDE_SCALE`/`DEFAULT_ENEMY_SIDE_SCALE` в `board-renderer.js`) — теперь явно записанные в
`actorScale` каждой калибровки, т.к. присвоение калибровки этапу отключает этот авто-fallback. Итог:
визуально ничего не "развалилось" по сравнению с тем, что уже было проверено, но теперь каждый этап можно
менять независимо.

### 2. Every Prologue encounter now carries its own `presentation` (`encounters/cp-e2..e5.json`)

Добавлен top-level блок `"presentation": { "arena": "prologue-N", "calibration": "prologue-N" }` в
`cp-e2.json`, `cp-e3.json`, `cp-e4.json`, `cp-e5.json` (тот же формат, что уже был у `prologue-5x5.json`).
Игровая логика (board/seed/boss/HP/timers/Rotate/win conditions) не тронута ни в одном файле.

### 3. Calibration editor: real per-stage content, not a synthetic preview (`calibration-editor.js` + `.html`)

- Новый общий модуль **`prologue-steps.js`** — единственный источник правды для 5 канонических шагов
  Prologue (`SEQUENCE_STEPS` + `getStep()`), вынесенный из `app.js`, чтобы playable game и calibration
  editor гарантированно смотрели на один и тот же board/seed/def.
- **`app.js`** обновлён, чтобы импортировать `SEQUENCE_STEPS`/`getStep` из `prologue-steps.js` вместо
  собственной копии (устранён риск рассинхронизации между двумя файлами). Поведение playable game не
  изменилось.
- **`calibration-editor.js`** теперь работает в двух режимах:
  - **`stage`** (основной, новый выпадающий список **Prologue stage**) — грузит настоящий board/seed/def
    выбранного этапа через `getStep()` (то же самое, что видит реальный playthrough), плюс его
    независимую калибровку. Показывает настоящего моба/босса этапа (Goblin Shaman для boss-shaped
    этапов 1/2/3/5, двух Dire Wolf для enemies-shaped этапа 4 — ровно как в реальной игре).
  - **`debug`** (второстепенный, старый выпадающий список **debug arena**, урезан до записей ВНЕ canon
    Prologue — сегодня только `boss-shadow-moon`) — старое поведение CAL-001/FIX-023 не удалено: случайно
    сгенерированная доска нужного размера + синтетический 3-сторонний preview-encounter.
- Новый выпадающий список **arena/background** — меняет `draft.background` независимо от геометрии;
  заполнен всеми тремя реально существующими в репозитории arena PNG (`arena-moonlit-fortress.png`,
  `5x5-good.png`, `6x6-5.png`). Смена сохраняется через существующий Save-to-browser/Copy/Download путь
  (поле `background` уже было частью экспортируемого объекта).
- Save/Clear/Reset работают как раньше, но теперь на калибровке КОНКРЕТНОГО этапа (`draft.id` уникален на
  каждый этап) — override одного этапа физически не может задеть другой, т.к. `localStorage`-ключ включает
  `draft.id`.
- Никакой новый art не создавался; никакие board seeds/размеры не менялись.

### 4. Test update (`test/build-025-prologue-flow.test.ts`)

Тест "resolves calibrated arena for prologue-5x5 and null for uncalibrated encounters" переписан в
"resolves an independent calibration for every Prologue step" — раньше он явно проверял, что `cp-e2`/`cp-e5`
резолвятся в `null` (это и была проблема, которую решает CAL-004). Теперь проверяет, что все 5 шагов
резолвятся в РАЗНЫЕ (`Set` уникальности) calibration id.

RESULT_SHA (code): fea3be3

## VERIFY

Прогон в браузере (свой dev-сервер на порту 5203, `.claude/launch.json` → `cal-004-prologue-stage-calibration`, т.к. другая сессия уже держала порт 5177/умолчание):

- ✅ все 5 этапов доступны в выпадающем списке **Prologue stage** и загружаются без ошибок в консоли (кроме
  заведомо ожидаемых 404 на ещё не добавленные placeholder-ассеты — тот же существующий контракт
  `assets.js`, не связано с этой задачей);
- ✅ переключение этапов действительно грузит разный board/content/presentation — проверено программно
  (`window.calibrationEditorDebug`) и визуально: `boardSizeLocked`/`background`/`calibId` разные для
  каждого этапа; `renderer.debugLayout()` показывает настоящих мобов/боссов каждого шага (Stage 1/2/3/5 —
  Goblin Shaman на N/E/E/E соответственно, ровно как решает `def.boss.id` → `bossSpeciesFor`; Stage 4 — два
  Dire Wolf одновременно на E и N, ровно как в `cp-e4.json`'s `enemies` array);
- ✅ board position/scale (board corners TL/TR/BR/BL) работают независимо на разных этапах — проверено
  через keyboard-nudge путь (`writeFracXY`/`positionHandles`), идентичный тому, что использует
  drag-with-mouse (drag через автоматизированный браузер не сработал из-за особенностей синтетических
  pointer-событий в тестовом окружении — сама логика не менялась с CAL-001/CAL-002 и не тестировалась
  повторно на уровне мыши, только на уровне keyboard/API, что бьёт по тому же коду);
- ✅ actor anchors/scale работают отдельно (TOP anchor двинут Shift+ArrowDown — LEFT/RIGHT не тронуты);
- ✅ sprite pivot работает отдельно от anchors (RIGHT pivot изменён — anchors этапа не изменились);
- ✅ effect anchors — тот же независимый handle/API путь, что actor anchors (общий код, не менялся отдельно);
- ✅ смена arena/background сохраняется — проверено программно (`bgPick` → `draft.background` → отражается
  в `Save to browser`/`Download JSON` через уже существующий `buildExportObject()`);
- ✅ Save → playable Prologue применяет калибровку именно нужному этапу: сохранил override для `cp-e2`
  (LEFT actorScale 1.77), перезагрузил playable `index.html`, `sceneTitle` для `cp-e2` показал
  `[custom calibration applied]`, а `prologue-5x5`/`cp-e3`/`cp-e4`/`cp-e5` — нет;
- ✅ калибровка одного этапа не перетекает в другой — тот же прогон выше плюс отдельная проверка в самом
  editor (override `cp-e2`, переключение на `cp-e3` → `actorScale.left` остался 1.0 у `cp-e3`, вернулся к
  1.77 у `cp-e2` после перезагрузки);
- ✅ `Clear override` возвращает встроенные defaults — проверено (`actorScale.left` вернулся с 1.77 на 1.0);
- ✅ все 5 этапов по-прежнему запускаются и проходятся: прогнал полный `RunState` playthrough через
  `window.visualDebug` в реальном браузере, используя движковый `findWin()` для каждого этапа по очереди
  (`advance()` между ними) — все 5 этапов выиграны без ошибок (`won: true` на каждом шаге, включая финальный
  Goblin Shaman бой с CAST/interrupt).

Также:
- ✅ `npm run typecheck` — чисто;
- ✅ `npm test` — 274/274 (22 файла), включая переписанный `test/build-025-prologue-flow.test.ts`;
- ✅ `npm run build` — чисто.

Debug-режим (legacy `boss-shadow-moon`) проверен отдельно — по-прежнему грузит синтетический 3-сторонний
preview с правильной 6x6 baked-grid геометрией, ничего не сломано.

## FOUND

- Известный баг с death animation некоторых мобов (упомянутый в задаче как "особенно на этапе 2") не
  воспроизведён в рамках этой задачи: сегодняшний Stage 2 (`cp-e2`) использует `boss`-shaped def
  (`grunt_passive`), который рендерится через boss-visual-state/Goblin Shaman pack, а не через Dire Wolf —
  т.е. "мертвый wolf" сценарий на Stage 2 в текущем виде игры не воспроизводится тем путём, который я
  проверял (полный `findWin()`-прогон всех 5 этапов). Не копал глубже — не раздувать CAL-004 в отдельный
  combat/presentation fix, как и было указано.
- Boss-shaped `def.boss.id` вроде `grunt_passive`/`grunt_timed` (Stages 1/2/3) не входят в
  `assets.js`'s `BOSS_ID_TO_SPECIES`, поэтому `bossSpeciesFor()` по умолчанию возвращает `'goblin-shaman'`
  — т.е. эти этапы уже ДО этой задачи визуально показывали Goblin Shaman вместо условного "grunt"-плейсхолдера.
  Это существовавшее до CAL-004 поведение (не изменено этой задачей), но пользователю может быть неочевидно
  при первом просмотре калиброванных этапов — стоит иметь в виду при финальном arrow-art/enemy-visual
  решении (не в рамках CAL-004).
- Board-фит: ни один из существующих 3 arena PNG не является "baked grid" под реальные размеры досок
  Stage 2 (4x5 tiny), Stage 3/4 (6x7 easy) или Stage 5 (8x10 medium) — только Stage 1 (5x5) и debug
  `boss-shadow-moon` (6x6) имеют painted-grid арт под свой размер. Это не физическая проблема (в обычном
  геймплее grid mesh не рисуется, только доска/стрелки поверх арта), но финальный выбор арены/арта под
  эти размеры досок остаётся открытым пользовательским решением — калибровка каждого этапа сейчас
  независима и готова принять любую арену, которую пользователь выберет и подгонит вручную.

## USER PLAYTEST

Как открыть calibration editor:
1. Запустить дев-сервер спайка (`npm run viewer` из `spikes/arrow-core`, либо через уже настроенный
   `.claude/launch.json` конфиг).
2. Открыть `http://localhost:<port>/viewer/visual-proto/calibration-editor.html`.

Как выбрать этап 1–5:
- В шапке — выпадающий список **Prologue stage**. Выбрать нужный "Пролог 1".."Пролог 5" — сцена, board,
  моб/босс и калибровка переключатся на реальный контент этого этапа.

Как сменить арену:
- Рядом — выпадающий список **arena/background**. Выбрать любую из трёх доступных картинок арены
  (Moonlit Fortress / 5x5-good / 6x6-5) — фон сменится немедленно; геометрию (углы доски/anchors) можно
  подвинуть вручную под новый фон мышью (drag) или клавиатурой (клик/tab на маркер, стрелки — 1px,
  Shift+стрелка — 10px).

Как сохранить calibration:
- Кнопка **Save to browser** — сохраняет текущие значения выбранного этапа в browser localStorage
  (независимо от остальных 4 этапов).
- **Clear browser override** — стирает сохранённое и возвращает встроенные значения по умолчанию для
  ЭТОГО этапа.
- **Copy calibration** / **Download JSON** — если значения нужно вставить в код `arena-calibration.js`
  как постоянные (не через browser override).

Как открыть тот же этап в playable Prologue:
- Ссылка **← Playable game** в шапке ведёт на `index.html`. Там выбрать нужный шаг в выпадающем списке
  сцен (`Пролог N · ...`) — если для этого этапа есть сохранённый browser override, заголовок сцены
  покажет пометку `[custom calibration applied]`.

Что нужно оценить визуально:
- Хорошо ли выбранная арена сочетается с размером доски конкретного этапа (Stage 2 — 4x5, Stage 3/4 —
  6x7, Stage 5 — 8x10) — сейчас все 4 новых этапа временно используют один и тот же Moonlit Fortress фон
  как рабочий default, не финальное решение;
- Насколько хорошо мобы/босс каждого этапа стоят на арене (актуальный размер и позиция), не вылезает ли
  что-то за экран/HUD на 1920x1080 и 1366x768;
- Устраивает ли, что Stages 1/2/3/5 сейчас показывают Goblin Shaman (см. FOUND выше) — если нет, это
  отдельное решение вне CAL-004 (замена placeholder-моба).
