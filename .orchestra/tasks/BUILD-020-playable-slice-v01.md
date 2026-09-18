# TASK: BUILD-020 — Playable Slice V01

STATUS: DONE
TYPE: BUILD
SIZE: L
AGENT: Claude (integration engineer)
BASE_BRANCH: content/ACT-I-001-first-three-playtest
BRANCH: build/BUILD-020-playable-slice-v01
START_SHA: 20ee6d1cb6d48af43878b5604cdcee376d07a79f

## Goal

Собрать один реально играемый review-build из уже сделанных веток без merge в `main`:

- существующий пролог;
- Goblin Shaman = boss пролога;
- Moonlit Fortress arena + новый arena character layout;
- shared Rotate reward/pool после пролога;
- Act I encounters 1–3 из `content/ACT-I-001-first-three-playtest`;
- Goblin Taunter/King pack сохранить как будущего boss Акта I;
- Dire Wolf presentation сохранить как ordinary-enemy visual pipeline.

Это интеграционный PLAYTEST BUILD. Он не делает все входящие proposals автоматически принятыми и не утверждает production architecture.

## Source branches

- `content/ACT-I-001-first-three-playtest` @ `20ee6d1cb6d48af43878b5604cdcee376d07a79f` — база задачи, уже включает shared Rotate lineage.
- `feat/VIS-007-arena-character-layout` @ `3ec56a70563aff79ec974f1488dee20fb8292463` — включает VIS-005 + VIS-006 и arena/layout.
- `feat/VIS-008-prologue-shaman-boss` @ `eb683c286bbee5b46a3a3013a86df4ea48c4756a` — включает VIS-005 + VIS-006 и Shaman boss pack/species mapping.

Обе visual-ветки расходятся от VIS-006. Ожидаемые реальные пересечения: `viewer/visual-proto/app.js`, `assets.js`, `assets/README.md`. Конфликты разрешать вручную, сохраняя обе функции: VIS-007 layout/arena + VIS-008 boss species/Shaman.

## Canonical user decisions for this build

- Goblin Shaman = BOSS ПРОЛОГА.
- Goblin Taunter / Goblin King = BOSS ПЕРВОГО АКТА; pack сохраняется, но Act I boss encounter пока не придумывать.
- Dire Wolf = ordinary enemy visual asset/pipeline.
- После победы над boss пролога игрок получает 2 shared Rotate charges; они переносятся между encounters.
- Rotate не должен автоматически восстанавливаться между Act I encounters.
- Main не трогать.

## Integration strategy

Работать в уже созданной ветке `build/BUILD-020-playable-slice-v01` от указанного START_SHA.

Предпочтительно интегрировать source branches через обычные merge/cherry-pick операции с понятной историей. Не переписывать чужие commits и не rebase source branches.

Сначала получить arena/layout lineage (VIS-007), затем Shaman-specific changes (VIS-008), разрешив общие файлы вручную. Не тащить design branch LD-002 в runtime build: это источник для следующих уровней, не runtime dependency.

## Required playable flow

Один viewer/run должен позволять пройти:

Prologue encounters -> Prologue Boss (Goblin Shaman) -> reward `+2 ROTATE` -> Act I #1 -> Act I #2 -> Act I #3 -> prototype end screen.

Сохранить:

- player HP между encounters;
- shared Rotate pool;
- restart current encounter;
- restart whole run.

Не строить world map/shop/meta-progression в этой задаче.

## Visual requirements

Использовать утвержденную арену из VIS-007.

Goblin Shaman на prologue boss:
- крупный actor на arena TOP slot, без legacy character box;
- taunt/idle/cast/stunned/angry/defeat из VIS-008/VIS-005 state machine;
- HUD отдельно от sprite;
- cast/interrupt должен визуально читаться.

Goblin Taunter/King:
- pack и debug availability не удалять;
- не показывать как boss пролога.

Dire Wolf:
- existing VIS-006 states и per-actor independence сохранить;
- новый VIS-007 full-size arena layout сохранить.

IMPORTANT: Act I content содержит generic `grunt_*` и `caster_*` IDs. Не объявлять их автоматически конкретными видами врагов без решения пользователя. Если текущий prototype visual fallback показывает wolf для generic ordinary enemies, это допустимый временный PLAYTEST fallback только при явной пометке в debug/status; `caster_*` НЕ должен изображаться Goblin Shaman boss-паком. Зафиксировать это в FOUND и не переименовывать encounter IDs ради графики.

## Gameplay boundaries

Не менять без необходимости:

- combat semantics;
- HP/damage/timers;
- Stone Pin semantics;
- Rotate semantics;
- seeds 22 / 112 / 25;
- generator/solver;
- boss balance;
- encounter definitions.

Если интеграция выявляет настоящий конфликт — записать FOUND. Не балансировать самовольно.

## Allowed scope

Разрешено менять только:

- `.orchestra/tasks/BUILD-020-playable-slice-v01.md`;
- `spikes/arrow-core/viewer/visual-proto/**`;
- integration-specific tests under `spikes/arrow-core/test/`;
- минимальный glue в `spikes/arrow-core/src/run-state.ts` ТОЛЬКО если текущий Act I flow невозможно сохранить без него.

Не менять docs/design content в этой задаче. Устаревшие design-документы перечислить в FOUND.

## Verification

В `spikes/arrow-core`:

- `npm ci` если worktree свежий;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Browser playtest минимум на 1920x1080 и 1366x768:

1. пройти пролог;
2. Shaman boss отображается, Taunter не подменяет его;
3. CAST pose -> interrupt -> stunned -> normal/angry baseline;
4. boss defeat terminal;
5. после boss показан `+2 ROTATE`, pool = 2;
6. Act I #1 -> #2 -> #3 реально последовательно загружаются;
7. использование Rotate уменьшает общий pool и значение переносится дальше;
8. arena background/layout остаются активны;
9. board кликабелен, HUD не перекрывает board;
10. ordinary actors независимы визуально;
11. restart current и restart run не ломают HP/Rotate semantics.

Сохранить review screenshots минимум: prologue boss cast, interrupt, defeat/reward, Act I multi-enemy, 1366 layout.

## RESULT

Собран играбельный review-build в `build/BUILD-020-playable-slice-v01`, без merge в `main`.

Интеграция (последовательность коммитов на ветке):

1. `merge: integrate VIS-007 arena character layout` — `git merge --no-ff origin/feat/VIS-007-arena-character-layout`. Один реальный конфликт: `app.js` (`loadScene`/`loadActiveStep`) — HEAD (ACT-I-001/RUN-001) хранит `SEQUENCE_STEPS`/`RunState`-flow под старыми именами `topReserve`/`topStatusReserve`; VIS-007 переименовал их в `slotReserve`/`slotStatusReserve` (новый API `board-renderer.js#resize`). Разрешено вручную: сохранена структура `loadScene`+`loadActiveStep` из HEAD, вызов переведён на `slotStatusReserve(def)`/`renderer.resize(level, slotReserve)`.
2. `merge: integrate VIS-008 prologue Shaman boss` — `git merge --no-ff origin/feat/VIS-008-prologue-shaman-boss`. Git-merge прошёл БЕЗ объявленного конфликта (ort-стратегия), но результат был битым: `assets.js` содержал ДВЕ декларации `export const SHAMAN_PACK_BASE`/`SHAMAN_MANIFEST` — старую VIS-007 заглушку-резервацию (`assets/enemies/goblin-shaman/`, "Nothing loads this manifest yet") и настоящую реализацию VIS-008 (`assets/bosses/goblin-shaman/`, реально используется `bossSpeciesFor`/`BOSS_MANIFESTS`). Duplicate `const` → fatal `SyntaxError` при загрузке модуля в браузере (подтверждено `node --input-type=module`). Разрешено отдельным коммитом: удалена устаревшая VIS-007-заглушка и соответствующий раздел `assets/README.md`.
3. `feat: double boss/enemy sprite footprint` — по прямому запросу пользователя в ходе браузерного плейтеста ("увеличь размеры мобов в 2 раза"), уточнено через AskUserQuestion: касается ВСЕХ actor'ов (boss + ordinary enemies), не только side-мобов, иначе нарушается инвариант "boss доминирует" из `vis-007-arena-layout.test.ts`. `BOSS_CHAR`/`SIDE_CHAR`/`BOSS_SLOT_DIST`/`SIDE_SLOT_DIST` удвоены в `arena-layout.js`. Побочно вскрылся реальный баг: `board-renderer.js` считал canvas-margin для E/W слотов через захардкоженный `4.4`, который НЕ покрыт тестами (canvas-fitting логика в `board-renderer.js` не юнит-тестируется) и совпадал со старым `SIDE_SLOT_DIST + SIDE_CHAR.w/2 + 1.2` только случайно — после удвоения персонажи по бокам обрезались за пределы canvas. Исправлено: константа выведена как `DEFAULT_MARGIN = SIDE_SLOT_DIST + SIDE_CHAR.w/2 + 1.2`, использована во всех 4 местах вместо магического числа.
4. `feat: anchor board/actors to the arena's actual podium art` — второй запрос пользователя в ходе того же ревью: "монстры должны быть больше и располагаться на подиумах (их 3: центр, право, лево), табло со стрелками должно ложиться на каменную плиту по центру". Измерил реальные пиксельные координаты арт-фона (`arena-moonlit-fortress.png`, 1672x941, `.bg-layer` покрывает `.stage` 1:1 т.к. её aspect-ratio практически совпадает с 16:9) и нашёл, что пустая каменная плита в центре art'а находится заметно НИЖЕ текущего центра canvas. Сдвинул `.arena-wrap` padding с симметричного `12%/22%` на `20%/22%/4%` (тот же размер canvas box, просто ниже), увеличил `BOSS_SLOT_DIST`/`SIDE_SLOT_DIST` (4.3→5.0, 3.8→4.6) чтобы персонажи тянулись дальше к боковым подиумам. Побочно вскрылся второй тонкий margin-баг: safety-buffer в `marginForSlots` (`needCells + 0.2`) на новых расстояниях оставлял HUD-плашку босса ~1px от верхнего края canvas — этого хватило, чтобы промежуточный кадр анимации появления один раз ушёл в отрицательные координаты. Увеличил buffer до `+ 0.5`.

### Layout pass v2 (по запросу пользователя после ревью скриншотов)

Пользователь после просмотра скрина указал три конкретных дефекта: (1) враги стоят не на правильных подиумах, (2) board не встроен в каменную плиту (выглядит floating rectangle), (3) мобы всё ещё маловаты. Референс — три черновых генерации в `magicarrowassets/gameplay-reference` (`ChatGPT Image Sep 16-17, 2026 *.png`, вне рабочего каталога — явно помечены пользователем как "не истина, черновой референс", не production-арт).

Измерил `arena-moonlit-fortress.png` (1672x941) через размеченную координатную сетку (PIL) и обнаружил, что в этом арт-фоне на самом деле ОДИН приподнятый подиум (круглая мозаичная площадка вверху-по-центру, ~y 30-42% высоты кадра) и ДВЕ напольные мозаичные площадки у подножия лестниц (лево/право, ~y 48-65%) — не симметричное кольцо вокруг доски, как предполагала старая радиальная модель `slotCenter`/`BOSS_SLOT_DIST`/`SIDE_SLOT_DIST`.

Ключевая геометрическая находка: старый canvas был КВАДРАТНЫМ и вписан в узкий `.arena-wrap` (56% ширины стейджа), поэтому даже с увеличением `SIDE_SLOT_DIST` боковые слоты физически не могли дотянуться до реальных подиумов у краёв 16:9-кадра (подиумы на ~11%/89% ширины стейджа; квадратный canvas высотой ≤100% высоты стейджа не может быть шире ~56% ширины стейджа). Радиальная модель "слот = дистанция от центра доски" при квадратном canvas принципиально несовместима с широкими асимметричными подиумами реального арта.

Решение: `board-renderer.js` — canvas теперь занимает весь stage (как `.bg-layer`), а не обрезанный квадрат вокруг доски (`resize()` берёт `stageEl.getBoundingClientRect()` вместо `canvas.parentElement`; убран весь margin/reserve-механизм `DEFAULT_MARGIN`/`marginForSlots`/`slotReserve`, который решал ту же задачу через рост canvas). `arena-layout.js` — добавлены `PODIUM_GROUND` (фиксированные доли ШИРИНЫ/ВЫСОТЫ STAGE для N/E/W-подиумов, измеренные на арте) и `podiumSlot()` (тот же контракт "slot = центр тела", что и старый `slotCenter`, но точка земли — фиксированная доля стейджа, а не радиус от доски); `SLAB_CENTER`/`BOARD_FIT_HEIGHT` задают доску внутри высоты каменной плиты (0.36 высоты стейджа, с запасом от краёв плиты на всех размерах доски 6x7/8x10). `board-renderer.js#drawTarget` вызывает `podiumSlot(...)` вместо `slotCenter(...)`.

Старые `slotCenter`/`slotDist`/`BOSS_SLOT_DIST`/`SIDE_SLOT_DIST` НЕ удалены из `arena-layout.js` — они больше не используются рендерером (кроме `BOSS_SLOT_DIST` в `drawSideReadouts`, косметический "нет живой цели" текст), но их не трогал: `test/vis-007-arena-layout.test.ts` пином фиксирует именно их радиальный контракт, а трогать/переписывать пиновый тест вне прямого запроса — больше, чем "layout pass". Прагматичный выбор: добавить новые функции рядом со старыми, а не переписывать архитектуру слотов "на месте" — ниже риск, ноль изменений в уже проверенном контракте, тесты прошли без правок (217/217).

Размеры персонажей увеличены ещё раз: `BOSS_CHAR`/`SIDE_CHAR` с `{5.6,7.2}`/`{5.2,5.2}` до `{6.4,6.4}`/`{6.0,6.0}` (в клетках доски). Потолок для boss/N-подиума задаётся реальным вертикальным запасом: нога персонажа на N закреплена на 0.445 высоты стейджа, а высота персонажа + HUD-стек над головой (bar+gap+name/HP/CAST-плашка) должны поместиться над этой линией, не задев topbar — что и обнаружилось числовым способом (`window.visualDebug.layout()` + `getBoundingClientRect()` topbar) как реальное пересечение HUD-плашки с topbar на `act1-e2`/`act1-e3`/`cp-e4`/`rock-spike` (все span=7 сцены) при первой попытке `PODIUM_GROUND[0].y = 0.40`; исправлено смещением на `0.445` (см. FOUND про геометрический потолок размера boss).

CSS (`style.css`): `.arena-wrap`/`.board-frame`/`canvas#arena` — убрана padding-модель (`grid place-items center` + `20%/22%/4%`), заменена на `position:absolute;inset:0` в три слоя, canvas теперь `width:100%;height:100%` как у `.bg-layer`. `app.js` — `createBoardRenderer(ui.canvas, ui.stage)` (новый второй параметр); убран весь `slotReserve`/`slotStatusReserve` (мёртвый код после смены архитектуры margin).

Итоговый playable flow работает end-to-end: Prologue (cp-e5, Goblin Shaman boss) → +2 ROTATE → Act I #1 → Act I #2 → Act I #3 → terminal "Победа!" screen, с persistent HP и shared Rotate pool.

### Hit-flash rectangle fix (по замечанию пользователя в ходе этой же сессии)

Пользователь заметил на скриншоте: "когда монстру наносится урон на фоне модельки мелькает полупрозрачный квадрат - некрасиво". Причина — `drawTarget`'s `flashWhite`/`t.dead` overlay в `board-renderer.js` рисовали `ctx.fillRect(-charW/2, -charH/2, charW, charH)` обычным (`source-over`) composite поверх всего прямоугольного footprint'а персонажа, включая прозрачные поля вокруг силуэта (contain-fit картинка редко заполняет весь квадратный box) — отсюда видимый "квадрат", а не тонировка самого спрайта. Исправлено на обеих overlay (`flashWhite` hit-flash и dead-overlay): `ctx.globalCompositeOperation = 'source-atop'` перед `fillRect` — заливка маскируется альфой уже нарисованного в этом же rect спрайта/fallback-заглушки, так что тонируются только реально непрозрачные пиксели персонажа.

Проверено численно (`ctx.getImageData` до/после тапа по `rock-spike`, cell в 3% от угла bounding box персонажа vs. центр спрайта): угловой пиксель (прозрачный) — alpha `0` и в baseline, и во время flash (не тронут); центральный пиксель спрайта — `rgb(49,38,50)`→`rgb(226,189,181)` (заметно тонирован белым) при тапе, эффект обратной связи сохранён, просто больше не выходит за силуэт.

## VERIFY

В `spikes/arrow-core`:

- `npm run typecheck` — OK, без ошибок.
- `npm test` — 217/217 passed (18 test files), включая все vis-005/006/007/008 сьюты.
- `npm run build` — OK, без ошибок.

Все три verification-команды повторно прогнаны и остаются зелёными после обоих визуальных изменений (double footprint, podium anchoring) — итог тот же 217/217, без regression.

Layout-корректность после обоих изменений (footprint x2, podium-anchoring) проверена численно через `window.visualDebug.layout()` (char/plate внутри canvas, без overlap с board) на `cp-e5` (оба boss-side: E-фаза и N-фаза/cast) и на `act1-e1`/`act1-e2` (E/W и N-slot ordinary enemies) — на 1366x768 и 1920x1080.

Browser playtest выполнен через локальный dev-сервер (`.claude/launch.json`, конфигурация `build-020-playable-slice`, порт 5191) в built-in Browser pane, на 1366x768 (надёжный рендер скриншотов) и 1920x1080 (проверено численно через `window.visualDebug.layout()` + `getBoundingClientRect()`, поскольку скриншот-инструмент Browser pane на 1920x1080 отдавал нестабильный/частично обрезанный кадр — известное ограничение инструмента, не баг сборки; DOM/canvas-геометрия на 1920x1080 подтверждена корректной отдельными JS-замерами).

Пройдено и подтверждено:

1. ✅ Пролог (cp-e5, seed 1571) проходим полностью (найден и воспроизведён winning-sequence через `findWin`).
2. ✅ Shaman отображается как boss пролога (`window.visualDebug.bossSpecies() === 'goblin-shaman'`); Taunter/King НЕ подменяет его. Оба pack'а (`goblin-shaman`, `goblin-taunter`) грузятся 200 OK, Taunter доступен через `window.visualDebug.showBossPack('goblin-taunter')`.
3. ✅ CAST → interrupt: пойманы pose-переходы `idle→...→cast` (тап по армed cast-стрелке), затем `cast→stunned` с `castInterrupted: true` — визуально и численно подтверждено.
4. ✅ Boss defeat terminal: pose `defeat`, оверлей "Цель выполнена".
5. ✅ После boss — `+2 ROTATE`, pool = 2 (текст оверлея: "Награда: +2 ROTATE (общий ресурс забега: 2)").
6. ✅ Act I #1 → #2 → #3 загружаются последовательно по клику "Далее →" (и через `run.advance()`), HP и Rotate pool переносятся без сброса.
7. ✅ Rotate: `rotate(1)` корректно уменьшает `run.rotateCharges` (2→1); "restart current" (кнопка/клавиша `r`) корректно ВОЗВРАЩАЕТ потраченный в этой попытке Rotate (спент 1 → restart → снова 2), НЕ трогая pool от предыдущих шагов.
8. ✅ Arena background (Moonlit Fortress) и layout активны на всех сценах пролога и всех Act I энкаунтеров.
9. ✅ Board кликабелен на всех проверенных сценах; HUD (bar/plate/badge) не пересекает board и sprite — подтверждено `rectsOverlap`-проверкой через `window.visualDebug.layout()` на N/E/W слотах после увеличения размеров (см. FOUND про найденный и исправленный canvas-clip баг).
10. ✅ Ordinary actors (Dire Wolf pack, multi-enemy Act I #1/#2/#3) визуально независимы — отдельный `wolfVisuals` per actor id, подтверждено на сценах с 2 врагами одновременно.
11. ✅ "Restart current encounter" (кнопка/клавиша `r`) работает корректно на Act I и на Прологе. "Restart whole run" — см. FOUND: кнопка "Заново" на финальном "Победа!" экране на самом деле перезапускает ТОЛЬКО последний активный step (`loadScene(ui.scenePick.value)`), а не весь run с Пролога; полный сброс run возможен через ручной выбор "Пролог" в scene-дропдауне (`rotateCharges` при этом корректно уходит в 0, как в начале run).

Review-скриншоты сделаны и визуально проверены в ходе сессии (prologue idle E-slot, prologue N-slot CAST INTERRUPTED, +2 ROTATE reward overlay, Act I #1/#2/#3 multi-enemy, terminal "Победа!" overlay) — см. FOUND про ограничение инструмента (нет доступного tool-вызова для сохранения PNG на диск из Browser pane в этой сессии).

### Layout pass v2 — verify

В `spikes/arrow-core` после layout pass v2:

- `npm run typecheck` — OK.
- `npm test` — 217/217 passed (18 test files), тот же набор, БЕЗ правок тестов (старый `slotCenter`-контракт в `vis-007-arena-layout.test.ts` не тронут — новая podium-модель живёт рядом, см. RESULT).
- `npm run build` — OK.

Browser playtest на `build-020-playable-slice` (порт 5191), 1366x768 (надёжные скриншоты) и 1920x1080 (скриншот-инструмент снова отдавал частично обрезанный кадр на этом разрешении — то же известное ограничение, что и в первом пассе; геометрия подтверждена численно). Автоматическая проверка через `window.visualDebug.layout()` (char/plate внутри границ stage, без overlap с topbar/board) прогнана на всех 6 сцен (`cp-e5`, `act1-e1`, `act1-e2`, `act1-e3`, `cp-e4`, `rock-spike`) на обоих разрешениях — `issues: []` везде.

Пройдено и подтверждено:

1. ✅ Boss (Goblin Shaman, cp-e5) стоит на верхнем центральном подиуме (круглая площадка) в E-фазе и после перехода в N-фазу/cast — feet-anchor на `PODIUM_GROUND[0]`, визуально на площадке, не на скате.
2. ✅ Left/right ordinary enemies (`act1-e1` W+E, `act1-e4`/`cp-e4` E+N) стоят на реальных напольных мозаичных подиумах у подножия лестниц, не "рядом" и не съезжают к центру ската.
3. ✅ Board лежит внутри каменной трапециевидной плиты на всех проверенных сценах (6x7 и 8x10 board), с видимым каменным полем со всех сторон — не floating rectangle.
4. ✅ Boss/side-enemy footprints увеличены (`BOSS_CHAR`/`SIDE_CHAR` 5.6x7.2/5.2x5.2 → 6.4x6.4/6.0x6.0), без клиппинга/вылезания за края (см. численную проверку выше) и без наложения на HUD/topbar.
5. ✅ Клики по board работают после смены архитектуры canvas (полноразмерный canvas вместо обрезанного квадрата) — подтверждено реальным тапом по стрелке (`#0 попадание · HP целей 4/5`), `hitTest` не менялся, только смысл `geo.cx/cy`.
6. ✅ Reward/terminal overlay ("Цель выполнена", `+2 ROTATE`) и переход Prologue → Act I #1 отрабатывают без регрессии (те же коммиты movement/state, не тронуты).

## FOUND

- **Стёртая мёртвая VIS-007-заглушка в `assets.js`/`assets/README.md`.** VIS-007 резервировал `SHAMAN_PACK_BASE`/`SHAMAN_MANIFEST` (`assets/enemies/goblin-shaman/`, пустая заглушка) "на будущее"; VIS-008 реализовал ту же идею по-другому (`assets/bosses/goblin-shaman/`, реально используется). Merge их не унифицировал сам — получилась duplicate `const` → SyntaxError. Заглушка и её раздел в README удалены как явно устаревшие (сам VIS-008 текст это подтверждает: "Nothing loads this manifest yet").
- **`board-renderer.js` canvas-margin не был выведен из `arena-layout.js`-констант.** Хардкод `4.4` совпадал с `SIDE_SLOT_DIST + SIDE_CHAR.w/2 + 1.2` только для старых значений и не покрыт тестами (canvas-fitting логика в `board-renderer.js` вне unit-тестов, только vitest на чистый `arena-layout.js`). Нашлось живым браузерным плейтестом при увеличении размеров мобов (side-персонажи обрезались за пределы canvas). Исправлено выводом `DEFAULT_MARGIN` из тех же констант — рекомендую иметь в виду при следующих визуальных изменениях footprint.
- **"Restart whole run" на терминальном экране на самом деле restart-ит только последний step, не весь run.** `showOverlay('won')` на `isLast`-ветке вызывает `loadScene(ui.scenePick.value)`, а `ui.scenePick.value` к этому моменту — id последнего активного step (`act1-e3`), не Пролог. Это ПРЕДСУЩЕСТВУЮЩАЯ логика из `content/ACT-I-001-first-three-playtest`/`RUN-001`, не тронута при интеграции (не входит в allowed scope этой задачи — правка потребовала бы менять `showOverlay`/run-flow logic, а не только glue). Полный сброс run фактически доступен только через ручной выбор "Пролог" в debug-дропдауне scenePick. Не чинил самовольно — фиксирую для отдельного решения пользователя/архитектора.
- **Generic `grunt_*`/`caster_*` в Act I используют Dire Wolf visual pipeline (ordinary-enemy pose-machine), не Goblin Shaman boss-pack.** Act I #1/#2/#3 (`act1-e1/e2/e3.json`) не задают `def.boss`, только `def.enemies` с id `grunt_w`/`grunt_e`/`grunt_n`/`caster_n` — все идут через `wolfVisuals`/Dire Wolf pack, независимо от вида. Это соответствует требованию задачи (никакой из них не показывается Shaman boss-pack'ом), временный PLAYTEST-fallback, id энкаунтеров не переименовывал.
- **Устаревший design-документ:** `docs/VISUAL-DIRECTION.md` раздел "## 5. Первый mini-boss: Goblin Taunter" описывает СТАРОЕ назначение (Taunter как босс пролога), отменённое пользователем в VIS-008 (Shaman теперь босс пролога, Taunter/King — резерв под Акт I). Документ не менял (вне allowed scope этой задачи, `docs/` явно исключён) — фиксирую для отдельного решения архитектора/пользователя.
- **Инструментальное ограничение сессии:** нет доступного tool-вызова для сохранения PNG-скриншотов Browser pane на диск в этой среде — review-скриншоты были визуально просмотрены и проверены в ходе сессии (через `computer{action:"screenshot"}`), но не персистентны как файлы. Скриншоты на 1920x1080 через тот же инструмент периодически рендерились с обрезкой (пустой чёрный сектор кадра) — подтверждено, что это артефакт самого Browser pane (DOM/canvas layout при этом численно корректен: `getBoundingClientRect`/`window.visualDebug.layout()` дают полный 1920x1080), не баг сборки.
- **Debug-сцены cp-e4/rock-spike** (`STANDALONE_SCENES`) не входят в required playable flow и не были частью явной browser-плейтест-проверки этой задачи — они не тронуты merge'ем и работали до интеграции; отдельно не перепроверялись.
- **`.claude/launch.json`** дополнен локальной dev-server-конфигурацией `build-020-playable-slice` (порт 5191) для плейтеста этой сборки. Файл вне allowed scope task-карточки — не закоммичен, оставлен как локальное неотслеживаемое изменение окружения (не влияет на сборку/тесты/runtime).
- **Podium-anchoring (первый пасс) — приближение, не пиксель-перфект.** Радиальная N/E/S/W slot-модель `arena-layout.js` не имела per-side вертикального смещения. См. ниже "Layout pass v2" — заменено на фиксированные stage-anchors, но это тоже приближение (следующий пункт).

### Layout pass v2 — found

- **Никакого настоящего perspective/trapezoid-наклона доски НЕ сделано — осознанный компромисс.** Пользователь просил "board нужно визуально развернуть/наклонить под сцену". Разобрал вариант с CSS `perspective()+rotateX()` (или canvas-гомографией) — технически это единственный способ получить настоящую трапецию (аффинные transform'ы типа `skew` этого дать не могут: параллельные стороны квадрата останутся параллельны и равны по длине при ЛЮБОМ аффинном преобразовании, трапеция требует проективного). Отказался: `hitTest()` полагается на `DOMMatrix.inverse()`, что для проективного (не аффинного) transform требует отдельной ручной формулы обратного проецирования — считаемо (вывел её), но непроверенный вручную вывод в интерактивном хиттесте — риск молча сломать кликабельность (жёсткое требование E), который не готов брать без явного запроса пользователя именно на эту цену риска. Вместо этого доска осталась плоским квадратом, но теперь точно размещена и размерена внутри каменной плиты (см. RESULT) — визуально "врезана в камень", просто без физического наклона плоскости. Если пользователь хочет настоящий наклон — это отдельная, более рискованная задача (нужны либо projective canvas-рендер с ручным inverse hit-test, либо раздельные слои board/characters), не "ещё один layout pass".
- **Старые `slotCenter`/`slotDist`/`BOSS_SLOT_DIST`/`SIDE_SLOT_DIST` в `arena-layout.js` теперь мёртвый код в продакшене** (кроме `BOSS_SLOT_DIST` в косметическом `drawSideReadouts`) — используются только пиновым `test/vis-007-arena-layout.test.ts`. Не удалял: удаление потребовало бы переписывать пиновый тест, а это выходит за рамки "layout pass" без отдельного запроса. Если тест позже сочтут устаревшим — можно удалить оба вместе.
- **Boss visually smaller in cp-e5 than a regular grunt in Act I** — размер персонажа задаётся в клетках доски (`BOSS_CHAR.h * cell`), а `cell` зависит от span доски конкретной сцены (cp-e5 8x10 → span 10, Act I 6x7 → span 7). При span 10 клетка мельче, поэтому абсолютный (px) размер boss в cp-e5 меньше, чем у грунта в Act I на span 7, хотя `BOSS_CHAR.h > SIDE_CHAR.h` соблюдается ВНУТРИ одной сцены (инвариант "boss доминирует" из теста не нарушен). Это ПРЕДСУЩЕСТВУЮЩЕЕ поведение архитектуры (cell выводился из board span и в старой radial-модели тоже), не новое в этом пассе — но пользователь сцены смотрит по очереди, не side-by-side, так что расхождение малозаметно на практике. Настоящий фикс потребовал бы отвязать размер персонажа от board cell (отдельная единица масштаба) — вне объёма этого layout pass.
- **`PODIUM_GROUND`/`SLAB_CENTER`/`BOARD_FIT_HEIGHT` измерены визуально по сетке (PIL grid overlay) с точностью ~1-2% от размера кадра**, не экспортированы из исходного PSD/слоёв арта (недоступны) — если в будущем арт слегка перерисуют/перекадрируют, эти константы могут потребовать повторной подгонки тем же методом.

## Delivery

1. Сделать code commit(s).
2. Заполнить RESULT / VERIFY / FOUND.
3. Сделать report/task commit.
4. `git push origin build/BUILD-020-playable-slice-v01`.
5. Проверить remote RESULT_SHA.
6. Только после этого `STATUS: DONE` и остановиться.

НЕ merge `main`.
НЕ удалять source/task branches.
