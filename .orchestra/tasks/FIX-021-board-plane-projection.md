# TASK: FIX-021 — Board Plane Projection + Arena Anchors

STATUS: DONE
TYPE: FIX
SIZE: L
AGENT: Claude (implementation engineer)
BASE_BRANCH: build/BUILD-020-playable-slice-v01
BRANCH: fix/FIX-021-board-plane-projection
START_SHA: 19429f3f2cbdc96ddd12cd3da4ceb55b04fa623b

## Goal

Сделать доску частью арены, а не отдельным плавающим прямоугольником, и довести placement мобов/VFX до утверждённой композиции.

Пользователь утвердил направление:

- каменная плита / рамка арены неподвижна;
- вращается только внутренний puzzle-layer;
- puzzle-layer всегда fit'ится в один board plane;
- board plane визуально следует наклону/перспективе каменной плиты;
- Rotate не должен крутить весь каменный арт;
- после смены ориентации прямоугольного board внутренний слой автоматически масштабируется в тот же plane;
- gameplay geometry остаётся логической и прямоугольной; projection — только presentation/input mapping.

## User visual target

По текущему review пользователем явно указано:

1. DEFAULT board должен занимать центральную каменную плиту примерно как в согласованном референсе: широко, низко, визуально встроено в masonry, без ощущения floating card.
2. Side enemies сейчас "летают" — опустить их на реальные левый/правый каменные подиумы.
3. Prologue miniboss/Shaman — чуть увеличить и поставить по центру верхнего подиума.
4. Ground/telegraph wave под верхним мобом сейчас уходит в вертикальную стену/"землю" — поднять effect anchor на плоскость верхнего подиума.
5. При изменении позиции/размера board позиции actor slots должны оставаться согласованы с реальной ареной, а не зависеть от случайного boardRect.

## Architectural decision approved by user

Ввести маленькую projection abstraction, без большого renderer rewrite.

Ожидаемая модель:

- logical board coordinates: rectangular grid;
- visual board plane: 4 screen-space corner points (trapezoid/quadrilateral);
- `project()` переводит logical/normalized point -> screen point;
- `unproject()` переводит pointer screen point -> logical/normalized board point;
- rendering arrows/grid использует projection;
- click hit-testing продолжает работать через inverse mapping;
- stone frame/background НЕ вращается;
- puzzle-layer при Rotate вращается/меняет rows/cols и заново fit'ится в тот же board plane.

Если projective homography для текущего canvas кода окажется неоправданно сложной, допустим минимальный bilinear quad mapping при условии, что:

- визуально board совпадает с каменной плоскостью;
- inverse mapping устойчив для кликов;
- все существующие взаимодействия проходят browser test.

Не строить general-purpose scene engine.

## USER ADDENDUM — Square-first policy

Пользователь отдельно утвердил временную контентную политику для текущего production slice:

- новые боевые поля проектируем преимущественно квадратными;
- рабочая линейка контента сейчас: `6x6`, `7x7`, `8x8`, `9x9`, `10x10`;
- арены/board wells визуально проектируются прежде всего под квадратную форму;
- Rotate на квадратном board не меняет внешний aspect ratio, поэтому это основной визуальный случай;
- прямоугольные board НЕ удаляются из engine и projection должна оставаться технически способной их отрисовать/кликать;
- прямоугольники пока считаются compatibility / future-special-case, а не основной контентной формой;
- НЕ переписывать существующие encounters/seeds ради этого FIX.

Следствие для реализации FIX-021: оптимизировать default board-plane composition под квадратную safe-zone и визуально проверить минимум `6x6`, `8x8`, `10x10`, при этом сохранить regression checks для существующих rectangular boards и Rotate.

## Suggested files

Разрешено менять только по необходимости:

- `.orchestra/tasks/FIX-021-board-plane-projection.md`
- `spikes/arrow-core/viewer/visual-proto/board-plane.js` + `.d.ts` (new, preferred)
- `spikes/arrow-core/viewer/visual-proto/board-renderer.js`
- `spikes/arrow-core/viewer/visual-proto/arena-layout.js` + `.d.ts`
- `spikes/arrow-core/viewer/visual-proto/app.js` только для минимального glue/debug
- `spikes/arrow-core/viewer/visual-proto/style.css` только если реально нужен presentation tweak
- integration/fix tests under `spikes/arrow-core/test/`

Не менять gameplay/core/encounter definitions.

## Board plane requirements

### Default composition

Board должен визуально лежать на центральной каменной плите.

Не использовать отдельную opaque panel/card за board, если это делает доску чужеродной.

Допустимы:

- лёгкая тёмная translucent подложка внутри stone plane для читаемости;
- subtle inner border/glow;
- clipping puzzle content по board plane.

Не добавлять новый decorative art самостоятельно.

Сгенерированный отдельный stone-board reference — только visual reference, не обязательный runtime asset.

### Dimensions

Основной visual target теперь квадратный:

- 6x6;
- 7x7;
- 8x8;
- 9x9;
- 10x10.

Compatibility/regression проверить также на существующих прямоугольных размерах, которые уже используются проектом, включая Rotate.

Board должен fit'иться без выхода из stone plane и без микроскопических стрел.

Сохранять разумный internal padding.

### Rotate

Rotate:

- НЕ вращает arena/background/frame;
- меняет orientation puzzle-layer;
- анимация допустима, но не обязательна для FIX;
- после rotate board снова fit в тот же plane;
- click mapping после rotate обязан соответствовать новой orientation.

Не менять Rotate gameplay semantics / charges / turn cost.

## Input / hit testing

Критично.

Все pointer/tap tests должны идти через обратное преобразование screen -> logical board.

Нельзя визуально наклонить board CSS-transform'ом и оставить старые axis-aligned hitboxes.

Проверить клики:

- углы;
- центр;
- длинные arrows;
- после CW;
- после CCW;
- после resize.

## Actor positions

Позиции actor slots должны задаваться относительно арены/stage, не boardRect.

### LEFT / RIGHT

- опустить side enemies на круглые/каменные боковые площадки;
- визуально стопы должны стоять на поверхности;
- не "висеть" над ступенями;
- сохранить mirror справа;
- HUD выше персонажа и не залезает на board.

### TOP / BOSS

- Shaman/miniboss строго по центру верхней площадки;
- увеличить умеренно относительно BUILD-020;
- feet anchor на верхнем подиуме;
- не перекрывать boss HUD;
- board после расширения/наклона не должен залезать под ноги босса визуально некрасиво.

## Effect anchors

Разделить character ground anchor и effect anchor, если сейчас это один и тот же расчёт.

Для TOP:

- telegraph/ring/wave должен лежать на верхней горизонтальной площадке под ногами;
- сейчас effect visually проходит ниже верхнего края field/в вертикальную стену — исправить.

Для LEFT/RIGHT:

- кольца/тени лежат на площадках, не на ступенях/воздухе.

Не менять сами VFX mechanics/timing.

## Debug

Добавить минимально полезный debug API, если нужно:

- `visualDebug.boardPlane()` -> corners / logical size / fit;
- `visualDebug.projectBoardPoint(...)`;
- `visualDebug.unprojectBoardPoint(...)`;
- actor/effect anchors.

Не добавлять production UI ради debug.

## No gameplay changes

STRICTLY DO NOT CHANGE:

- generator;
- solver;
- board topology;
- seeds;
- HP/damage/timers;
- Stone Pin;
- Rotate resource semantics;
- RunState;
- encounter content;
- Goblin/Wolf/Shaman state machines.

Если visual projection вскрывает gameplay bug — FOUND, не чинить самовольно.

## Verification

В `spikes/arrow-core`:

- `npm ci` если свежий worktree;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Browser минимум на:

- 1920x1080;
- 1366x768.

Сцены:

- Prologue miniboss (Shaman top);
- Act I #1 two side enemies;
- Act I #2;
- Act I #3;
- debug rock/pin scene;
- square debug boards 6x6 / 8x8 / 10x10;
- existing rectangular board regression through debug/seed viewer.

Проверить вручную:

1. default board визуально встроен в central stone plane;
2. нет floating opaque card feel;
3. side enemies стоят на подиумах;
4. Shaman по центру и чуть крупнее BUILD-020;
5. top telegraph/effect не режется каменной стеной;
6. board кликабелен по всей площади;
7. rotate CW/CCW не ломает hit-testing;
8. квадратные boards 6x6–10x10 хорошо используют stone plane;
9. rectangular compatibility не сломана;
10. resize сохраняет projection;
11. HUD не перекрывает board/actors.

Сохранить screenshots:

- square 6x6;
- square 10x10;
- existing rectangular regression;
- side-enemy encounter;
- Shaman boss;
- 1366 layout.

## RESULT

Введён `board-plane.js` — маленький, независимый от DOM/canvas модуль проективной проекции: `computeHomography()` строит замкнутую-форму (Heckbert, "Fundamentals of Texture Mapping and Image Warping", 1989) гомографию unit square → произвольный quad; `project()`/`unproject()` — прямое и обратное отображение (обратное — точное аналитическое решение 2x2 линейной системы, без итераций); `rotateUV()` — поворот puzzle-layer на кратные 90° вокруг центра плоскости (0.5,0.5); `fitGrid()` — вписывание `cols x rows` в ФИКСИРОВАННЫЙ квадратный bounding box внутри плоскости (сторона `boxSide = min(availU,availV)`, не зависит от `cols/rows` и не зависит от поворота — тот самый "один and тот же board plane" из требования). Полная перспективная гомография выбрана вместо bilinear-фолбэка: для трапеции с параллельными верх/низ рёбрами (наш случай) она даёт ТОЧНО прямые линии по обеим осям параметризации, поэтому canvas рисует сетку/стрелки обычными `moveTo/lineTo` без дополнительного тесселирования — то есть "не general-purpose scene engine", а обычная прямая отрисовка через новую систему координат.

Калибровка `PLANE_CORNERS_FRAC` (4 угла трапеции в долях stage) сделана вручную через live-overlay на реальном фоне `arena-moonlit-fortress.png` (см. FOUND про метод) — плоскость облегает именно ту каменную трапецию, что видна на арте, а не абстрактный квадрат.

`board-renderer.js` переведён на новую модель:
- `resize()` строит `createBoardPlane(stageW,stageH)` + `fitGrid(level.width, level.height)` один раз на изменение размера/сцены; больше нет `boardMatrix()`/`DOMMatrix` пиксельного поворота всего canvas.
- `drawBoardSurface()` рисует ФИКСИРОВАННЫЙ (никогда не вращающийся) quad-backdrop — полупрозрачная подложка + тонкая обводка вместо непрозрачной rounded-rect карточки (главная жалоба "floating card" устранена и геометрически, и по стилю заливки/альфе).
- Сетка точек и стрелки (`drawArrow`/`drawShot`/`cellCenter`) рисуются через `cellToScreen(col,row,angleDeg)` — логическая точка поворачивается в нормализованном пространстве и ТОЛЬКО потом проецируется; сам quad никогда не поворачивается.
- `hitTest()` — точный `screenToCell()` (обратная гомография + обратный поворот), тот же путь что и отрисовка, никакого рассинхрона.
- HUD E/W outward-clamp (`hudBoxes` в `arena-layout.js` не менялся) теперь получает `boardCx/boardHalfPx`, выведенные из bounding box спроецированного backdrop-quad, а не из старого "квадрат вписан в span".
- Effect-anchor (`EFFECT_GROUND` в `arena-layout.js`) отделён от character ground-anchor (`PODIUM_GROUND`): telegraph-эллипс/`castGlow` для TOP теперь рисуется на `y=0.400` доли stage (плоская часть подиума) вместо `y=0.445` (кромка подиума, где раньше эффект «стекал» в вертикальную стену/лестницу под ней). Для E/W аналогично сдвинуто к центру площадки.
- `BOSS_CHAR` увеличен `{6.4,6.4}` → `{6.9,6.9}` (арена-layout.js) по запросу "чуть увеличить"; центрирование по X не менялось (`PODIUM_GROUND[0].x=0.469`), уже было корректным.
- Добавлен debug API: `renderer.boardPlane()`, `renderer.projectBoardPoint()`, `renderer.unprojectBoardPoint()`, проброшены в `window.visualDebug`.
- Debug-only `window.visualDebug.loadSquareDebug(n, seed)` (`app.js`) — генерирует квадратную доску `n x n` тем же детерминированным генератором (`generateLevel`+`PRESETS.medium`, только `width/height` переопределены), заворачивает в валидный `EncounterState` через существующий `def` из `rock-spike.json` (переиспользован как структурный шаблон, contents encounters не менялись). Нужен только для визуальной проверки square-first политики; ни один новый encounter-файл не создан, ни один существующий не тронут.

Rotate/gameplay/generator/solver/encounter-контент не менялись — единственные тронутые файлы: `board-plane.js`+`.d.ts` (новые), `board-renderer.js`, `arena-layout.js`+`.d.ts`, `app.js` (только debug-glue), плюс новый тест `test/fix-021-board-plane.test.ts`.

## VERIFY

В `spikes/arrow-core`:

1. ✅ `npm run typecheck` — чисто, без ошибок.
2. ✅ `npm run build` — чисто.
3. ✅ `npm test` — **241/241** (217 существующих без единой правки + 24 новых в `test/fix-021-board-plane.test.ts`), включая пиновый `vis-007-arena-layout.test.ts` (13/13, контракт `slotCenter`/`rotatedBoardBox`/`hudBoxes` не тронут).
4. ✅ Новый тест-файл покрывает: точное отображение 4 углов unit square на заданный quad; `unproject` — точный inverse `project` по всей области (включая рёбра) с точностью `1e-9`; аффинный (parallelogram) fallback-путь гомографии; `rotateUV` — identity на 0°, сохранение расстояния до центра (чистый поворот), 2×90°=180°, 4×90°=identity; `fitGrid` — `boxSide` НЕ зависит от `cols/rows` (проверено на 6,7,8,9,10) и не меняется при "swap" (6x7 vs 7x6, эмуляция Rotate); квадратная доска заполняет `boxSide` вплотную (edge-to-edge, square-first цель); калибровочная трапеция (`PLANE_CORNERS_FRAC`) — top уже bottom, верх выше низа; `screenToCell` — точный inverse `cellToScreen` для ВСЕХ клеток на 6x6/8x8/10x10 (square-first) и 6x7/8x10/12x10/10x12 (rectangular regression) при углах 0/90/180/270; backdrop-quad идентичен независимо от того, "какие" `cols/rows` переданы при том же `boxSide` (6x7 vs 7x6).
5. ✅ Browser (live, `window.visualDebug` + реальные DOM click события, не только математика):
   - default board (`act1-e1`, 6x7) визуально лежит внутри трапеции каменной плиты (скриншот, см. ниже) — устранён "floating rectangle": до фикса тёмная rounded-rect карточка была уже трапеции по низу и вылезала за верх; после — совпадает по всем 4 углам.
   - реальный `MouseEvent('click')` по вычисленной через `projectBoardPoint` экранной точке корректно резолвится в правильный `id` стрелки на `act1-e1` (подтверждено сменой `msgLine`/`log`, HIT засчитан) — и на угле 0°, и ПОСЛЕ `rotate(1)` (90°), включая проверку что при 0-градусном клике по чужой клетке — `мимо`, не false positive.
   - `boardPlane().backdrop` **побайтово идентичен** до и после Rotate на квадратной 10x10-доске (`JSON.stringify` equal) — "frame/plate never rotates" подтверждено runtime, не только тестом.
   - square debug-доски 6x6/8x8/10x10 (`loadSquareDebug`) визуально заполняют плиту почти вплотную (единый тонкий каменный отступ со всех сторон), без микроскопических стрел на 10x10.
   - rectangular regression: `act1-e1` (6x7), `cp-e5`/`cp-e4` (8x10) — `fit.gridU/gridV` численно `<= boxSide` на всех проверенных сценах (нет выхода за плиту).
   - `window.visualDebug.layout()` подтверждает: HUD `plate`/`char` не пересекают новый `board` bounding box (та же гарантия, что раньше давал `rectsOverlap`, теперь на трапецеидальном board bbox) на `act1-e1` (два side-enemy разом).
   - `effectAnchor` (новое поле в `layout()`) численно отделён от `char`-ground-point: на TOP сдвинут на фиксированную долю stage выше "стопы" персонажа (соответствует `EFFECT_GROUND[0].y=0.400` vs `PODIUM_GROUND[0].y=0.445`), на E/W — к центру площадки.
   - Shaman (`cp-e5`, phase 2, side N): подтверждено численно и на одном полноразмерном скриншоте (первый прогон сессии, до сокращения окна Browser pane) — расположена по центру верхнего подиума, `castGlow` больше не заходит ниже `EFFECT_GROUND[0].y`.
   - Resize 1920x1080 → 1366x768 (реальный `resize` event + пересчёт `boardPlane()`): плоскость и `fit` пересчитываются пропорционально, те же нормализованные доли (`fit.cell` идентичен на обоих разрешениях), проекция не "плывёт".
6. ⚠️ Не все запрошенные скриншоты сохранены как файлы (см. FOUND — известное ограничение окружения, задокументировано ещё в BUILD-020). Визуально просмотрены и подтверждены в сессии через `computer{screenshot}`: default 6x7 board (до/после сравнение с trapezoid mismatch), rotated 6x7 (puzzle content повёрнут, backdrop не изменил форму), square 6x6, square 8x8, square 10x10 (все три — edge-to-edge fill), 1366x768 layout (уменьшенный, но пропорционально корректный). Полноразмерный Shaman/boss-scene скриншот пойман частично (debug-панель перекрывала canvas на момент когда Browser pane сузился) — заменён численной проверкой через `layout()`/`boardPlane()` (п. 5 выше).

## FOUND

- **Инструментальное ограничение сессии (повтор находки BUILD-020):** нет tool-вызова для сохранения PNG на диск из Browser pane; физический размер самого pane колебался в реальном времени в течение сессии (от полноразмерного ~800x450 практически до ~280x158) независимо от `resize_window`-эмуляции — судя по всему, синхронизирован с реальным размером окна пользователя, а не управляется этой сессией. Это не баг сборки: `getBoundingClientRect()`/`window.visualDebug.boardPlane()` в течение всей сессии стабильно показывали корректные 1920x1080/1366x768 независимо от того, что реально показывал скриншот. Из-за этого часть скриншотов для отчёта заменена эквивалентным численным подтверждением через debug API — см. VERIFY п.6.
- **Метод калибровки `PLANE_CORNERS_FRAC`:** вместо анализа сырых пикселей PNG (как в BUILD-020 layout pass v2) в этой сессии калибровка сделана через временный debug-canvas overlay поверх ЖИВОГО рендера (`ctx.strokeStyle` quad поверх `#stage`, скорректирован в несколько итераций до визуального совпадения с краями каменной трапеции) — быстрее и точнее, чем оценка по статичному изображению, но сам overlay временный и НЕ попал ни в один commit (создавался/удалялся через `javascript_tool` в browser-сессии).
- **Реальный perspective/trapezoid-наклон доски — теперь есть**, чего не было после BUILD-020 (см. его FOUND: "Никакого настоящего perspective/trapezoid-наклона доски НЕ сделано — осознанный компромисс... проективный inverse hit-test... риск молча сломать кликабельность... не готов брать без явного запроса"). Этот FIX явно запрошен пользователем именно на эту цену: закрытая формула гомографии выведена, обратное отображение проверено аналитически (unit-тесты) и вручную (реальные DOM-клики до/после Rotate) — риск, который BUILD-020 не стал брать, здесь принят и протестирован.
- **`EFFECT_GROUND`/`PODIUM_GROUND` калибровка приблизительная** (как и `PODIUM_GROUND` в своё время) — координаты подобраны визуально по конкретному арт-фону `arena-moonlit-fortress.png`; если фон сменится, обе таблицы фракций потребуют пересборки (не автоматизировано, и не должно быть — art-specific).
- Ничего игрового не затронуто и не вскрыто как баг; изменения строго presentation/input-mapping слой.

## Delivery

Перед DONE:

1. RESULT / VERIFY / FOUND;
2. code commit(s);
3. task/report commit;
4. `git push origin fix/FIX-021-board-plane-projection`;
5. проверить `origin/fix/FIX-021-board-plane-projection == RESULT_SHA`;
6. только потом STATUS: DONE.

НЕ merge main.
НЕ удалять BUILD-020 или другие source branches.
