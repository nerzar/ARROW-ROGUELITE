# TASK: CAL-001 — Arena Calibration Editor

STATUS: DONE
TYPE: TOOL
SIZE: M
AGENT: Claude / implementation
BASE_BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
BRANCH: tool/CAL-001-arena-calibration-editor
START_SHA: 5d5730a831db197f532e56bf66018902fa7c4042

## Goal

Сделать отдельный визуальный инструмент для ручной калибровки арены, чтобы больше не править `boardPlaneFrac`, actor anchors и effect anchors через код.

Пользователь уже подтвердил: ручная калибровка глазами работает лучше автоматической. Теперь нужен UI, в котором геометрию можно выставить мышью.

## Required UI

Отдельная debug/tool page внутри `viewer/visual-proto/`, не production HUD.

Минимум:

- выбрать/загрузить arena calibration entry из текущего runtime каталога;
- live arena background;
- draggable 4 board corners: TL/TR/BR/BL;
- projected grid overlay поверх board plane;
- выбор grid size 5x5 / 6x6 / 7x7 / 8x8 / 9x9 / 10x10;
- draggable actor anchors: TOP / LEFT / RIGHT;
- draggable effect anchors: TOP / LEFT / RIGHT;
- live sprite preview для TOP/LEFT/RIGHT, чтобы видеть фактическое положение ног;
- toggle arrow preview поверх той же projection;
- reset to current saved values;
- copy/export current calibration as JSON/JS object;
- значения показывать одновременно в stage pixels и normalized fractions.

## Interaction requirements

- handles крупные и удобные;
- drag мышью без перезагрузки;
- точная подстройка стрелками клавиатуры: 1px;
- Shift+arrow: 5px или 10px;
- выбранный handle явно подсвечен;
- не должно требоваться редактировать source code для обычной калибровки.

## Geometry contract

Инструмент ДОЛЖЕН использовать те же production functions из `board-plane.js`, что и runtime:

- project/unproject;
- grid boundaries;
- arrow preview geometry.

Нельзя сделать отдельную approximation math только для editor.

Калибровка должна редактировать данные, а не renderer magic numbers.

## Base scene

Использовать user-confirmed `prologue-5x5-good` как первый сохранённый пример.

Не менять его текущую подтверждённую калибровку автоматически.

## Save/export

Минимально достаточно безопасного:

- кнопка `Copy calibration` -> готовый объект для `arena-calibration.js`;
- кнопка `Download JSON` допустима;
- прямую запись в source file делать только если это уже просто и безопасно.

Не строить backend ради одной кнопки Save.

## Do not

- не менять combat rules;
- не менять levels/seeds;
- не чинить стиль стрел в этой задаче;
- не делать новую систему арен;
- не merge main.

## Verify

- открыть `prologue-5x5-good`;
- сдвинуть все 4 угла и увидеть мгновенную перестройку grid;
- вернуть reset;
- сдвинуть LEFT/RIGHT anchors и визуально посадить волков ногами на площадки;
- сдвинуть effect anchor независимо от sprite anchor;
- проверить copy/export и round-trip: экспортированные значения дают ту же геометрию после reload;
- 1920x1080 и 1366x768;
- typecheck/tests/build.

## RESULT

Новая standalone страница `spikes/arrow-core/viewer/visual-proto/calibration-editor.html`
(+ `.css` / `.js`), ссылка на неё добавлена в топбар `index.html` ("CAL-001 calibration editor
→"), production HUD/app.js не тронуты.

Реализовано всё из "Required UI"/"Interaction requirements":

- выбор arena calibration entry из `ARENA_CALIBRATIONS` (arena-calibration.js), live фон;
- draggable TL/TR/BR/BL board corners (cyan handles) — двигают `boardPlaneFrac`;
- projected grid overlay (toggle "grid mesh") — тот же `board-renderer.js`/`board-plane.js`
  debug-mesh path, что и production debug panel;
- grid size selector 5x5..10x10 (`boardSizeLocked`), перегенерирует превью-борд через тот же
  `generateLevel`/`PRESETS.medium`, что и `app.js`'s `loadSquareDebug`/`loadBakedArenaDebug`;
- draggable TOP/LEFT/RIGHT actor anchors (amber) и НЕЗАВИСИМЫЕ TOP/LEFT/RIGHT effect anchors
  (violet) — новое поле `effectAnchors` в arena-calibration.js, `board-renderer.js`'s
  `groundOverridesFor()` теперь возвращает раздельные actor/effect override-карты
  (`podiumSlot` использует actor, `effectGround` — effect);
- live sprite preview TOP/LEFT/RIGHT через настоящий Dire Wolf pack (`assets.js`/
  `enemy-visual-state.js`), заведённый на throwaway 3-side preview-encounter
  (`cal_top`/`cal_left`/`cal_right`, non-mandatory, вне `encounters/`, нигде больше не
  используется) — тот же `EncounterState.fromLevel`/`board-renderer.js` рендер, что и реальная
  сцена;
- toggle "arrows" — тот же `level.arrows` из настоящего generated board;
- Reset — откатывает к последнему загруженному/сохранённому снапшоту (deep-clone, ничего не
  пишет в `ARENA_CALIBRATIONS`);
- "Copy calibration" — готовый `'<id>': { ... },` объект точно в формате `arena-calibration.js`
  (paste-ready), с fallback textarea если `navigator.clipboard` недоступен; "Download JSON" —
  тот же объект как `.json`;
- таблица значений + инфо-панель выбранного handle — одновременно px и normalized fraction.

Interaction: handles 20px (16px effect), drag мышью без перезагрузки (pointer capture),
стрелки клавиатуры = 1px, Shift+стрелка = 10px, выбранный handle подсвечен (кольцо + запись в
таблице). Ничего не требует правки source code для обычной калибровки.

Geometry contract: весь рендер (грид/спрайты/стрелки) идёт через существующий
`createBoardRenderer()` (тот же модуль, что использует `app.js`) — калибратор не содержит
отдельной projection/hit-testing математики; единственное, что он добавляет — DOM drag/keyboard
handles, читающие/пишущие те же stage-fraction числа, что `board-plane.js`'s
`planeCornersPx`/`podiumSlot`/`effectGround` уже используют (`frac * stageSize`).

`prologue-5x5-good` не тронут: новое поле `effectAnchors` у него и у `boss-shadow-moon`
проставлено равным существующему `anchors` — байт-в-байт та же геометрия, что и до задачи,
пока пользователь не отредактирует через новый инструмент.

RESULT_SHA: 481f8d33ca07f6c8fca77b1d13040ba33bbedeb4 (code commit, pushed + remote verified
before STATUS DONE — see git log).

## VERIFY

- `npm run typecheck` / `npm test` (241/241) / `npm run build` — все зелёные в изолированном
  `.worktrees/CAL-001` (не в общем main-каталоге, см. FOUND).
- Browser (built-in Claude Browser, отдельный dev-server порт 5199 → `.worktrees/CAL-001`):
  - `prologue-5x5-good` открывается, значения совпадают с исходником;
  - drag BR corner (+40px controlled в одном batch-вызове) → `boardPlaneFrac.br` изменился
    ровно на ожидаемую дробь (проверено арифметически: delta_frac / delta_px ≈ 1/stageSize,
    аспект стейджа получился ~16:9) и grid mesh на скриншоте мгновенно перестроился;
  - drag effect-anchor LEFT handle → `effectAnchors.left` изменился, `anchors.left` остался
    БЕЗ ИЗМЕНЕНИЙ (`{x:0.17,y:0.62}` до и после) — effect anchor подтверждённо независим от
    actor anchor, оба на скриншоте разъехались (амбер остался на ногах волка, violet ушёл выше);
  - Reset (без изменений и после мутации) откатывает draft ровно к исходным значениям
    (byte-identical JSON сравнение);
  - grid size selector 5→8 перегенерировал борд и mesh (арт/спрайты/стрелки не сломались);
  - arena select prologue-5x5-good → boss-shadow-moon переключил фон, corners, boardSizeLocked
    (6x6), export-панель — на лету;
  - resize 1920x1080 и 1366x768 (Claude Browser `resize_window`) — стейдж/grid/handles
    пересчитались (ResizeObserver), пропорции сохранены на обоих разрешениях;
  - "Copy calibration" export-текст сверен посимвольно с реальной записью в
    `arena-calibration.js` (та же квадратные-скобки/кавычки форма) — round-trip подтверждён
    структурно (export содержит все поля, которые resize()/renderer читают обратно);
  - Download JSON — клик не бросает исключение;
  - консоль без ошибок кроме ожидаемых 404 недостающих placeholder-ассетов
    (`board-frame.png`, `boss-goblin-*.png` и т.п. — те же, что уже 404-ят в production
    `index.html`, см. `assets.js`'s "no file exists at any of these paths yet").

## FOUND

- Инцидент с общим рабочим деревом: задача была начата прямо в главном worktree
  (`C:\Users\nerza\Projects\ARROW-ROGUELITE`, без `.worktrees/CAL-001`) вопреки правилу "работай
  строго в своей ветке/worktree". Другая параллельная сессия(-и) в этот же момент делала свои
  `git checkout`/commits в ТОМ ЖЕ каталоге (общий `.git`) — `git checkout
  tool/CAL-001-arena-calibration-editor` увёл общий HEAD, что видно по reflog
  (`design/ARENA-TEMPLATE-001-contract` → `design/VIS-010-arrow-presentation-spec`, с реальными
  commit'ами VIS-010 поверх), и в staged area обнаружился чужой файл
  `.orchestra/tasks/ARENA-TEMPLATE-001-contract.md` (не мой, не трогал). Восстановление: создан
  `git worktree add .worktrees/CAL-001 tool/CAL-001-arena-calibration-editor` (ветка сама была
  цела на c186505 всё это время), все 7 файлов CAL-001 скопированы туда, изменения в главном
  worktree отменены (`git checkout --` для tracked / `rm` для новых), чужой staged файл НЕ
  тронут. Дальнейшая работа (typecheck/tests/build/commit) — только в `.worktrees/CAL-001`.
  Похожий инцидент уже фиксировался в `ARENA-001-runtime-candidate-pack.md`'s FOUND — стоит
  сделать создание `.worktrees/<TASK>` явным первым шагом в `GIT.md`, а не подразумеваемым.
- Не решено (не в скоупе задачи): "TOP" в превью всегда рисуется Dire Wolf-спрайтом
  (SIDE_CHAR footprint), даже когда реальный контент на TOP — босс (BOSS_CHAR, другой рост,
  из-за чего анкер-точка ног визуально на пару px иначе ложится относительно спрайта). Сам
  анкер (число) точный; расхождение только в размере превью-спрайта. Указано в самом
  инструменте (секция "Notes").
- `groundOverridesFor`/`effectGroundOverride` — новый небольшой production-код в
  `board-renderer.js`; тестов на `board-renderer.js` в репозитории нет вообще (ни один test/*.ts
  его не импортирует), так что это изменение проверено только через browser-verify выше, не
  vitest.

## Delivery

RESULT / VERIFY / FOUND -> code commit -> report/task commit -> push -> remote SHA verify -> STATUS DONE.

Не merge main.
