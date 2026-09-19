# Проект

## Название

PROJECT: Arrow-Roguelite
WORKING_TITLE: yes

Старые упоминания `Magic Arrow` относятся к этому же проекту и считаются устаревшим рабочим названием.

## Репозиторий

REPOSITORY: nerzar/ARROW-ROGUELITE
STABLE_BRANCH: main
INTEGRATION_BRANCH: ad-hoc `integration/*` под конкретное сведение
CURRENT_PLAYABLE_BASE: main

Текущую активную задачу и ветку смотреть в `BOARD.md`.

## Текущий этап

Проект находится в стадии **сборки vertical slice Act I: все основные механики уже реализованы, их нужно допилить и собрать в единый забег**.

Состояние на 2026-09-19 (вечер):
- Prologue проходится целиком; Act I «Край гоблинов» — 18 stage'ов на плотных досках (LD-007 + ACT-I-003);
- боевой слой: multi-enemy, способности врагов (`stone_throw` / `shield` / `shift` / `heal`, несколько способностей у одного врага), волны (`arrival.afterKill` / `onTurn`), scripted flee, boss phases;
- run-слой: инвентарь 3 слота, действие `item`, reward draft 1-из-3 (золото — обычная награда, предмет — редкий), run-gold, save/load run-state;
- предметы v1: Лук, Щит, Ледяной дротик, Карманный гироскоп, Боевой рог + реликвии Утилизация / Замковый камень / Предохранитель (ITEM-002); Зелье и «Стрела» (расходники) — на ветке ITEM-001, ещё не сведены (см. INT-ITEM-001b);
- презентация: approved HUD (player/enemy card, rotate), projectile flight, light-hit VFX, damage numbers, презентация способностей (shift/heal/loot/shield/pin);
- route map: движок графа маршрута + иллюстрированная карта на пользовательской approved-картинке — в main (`e69cd10`);
- пользователь сгенерировал и одобрил референсы reward / map / merchant (персонаж + экран лавки) / level-up — `docs/visual-refs/README.md`.

Главное сейчас — не новые механики, а **сведение**: доинтегрировать потерянные куски, подключить карту и торговца, переписать Act I под предметы/волны (LD-008) и прогнать забег целиком.

## Что уже есть в текущей playable-линии

Это описание фактической текущей базы, а не обещание неизменяемой production-архитектуры:

- pure TypeScript arrow-core с deterministic generator/solver и seed/property tests (39 test files / 435 tests на main `e69cd10`);
- combat-pressure / multi-enemy runtime, concurrent enemy timers, ward (щит), `worldTurn`;
- enemy ability framework (COMBAT-001): `stone_throw`, `shield`, `shift` (timer или `trigger:'hit'`), `heal`; `EnemyDef.reward`, `expiresAfter`, `EncounterDef.winHeal`, `rewardItem`;
- волны врагов с телеграфом (WAVE-001): движок в main, в campaign ещё не использованы;
- единый playable Prologue из 5 шагов + Act I 18 stage'ов (`campaigns/campaign.json`, briefs в `campaigns/ld007-briefs/`, сборка `tools/ld007-build-campaign.mjs`);
- board-профили `short` / `mixed` / `long` (`board-profiles.js`), designer-инструменты `tools/ld007-audit.mjs` / `ld007-scan.mjs`;
- 13 species (goblin-grunt/matron/drunkard/scout/captain, wolves, shaman, king …), 36 арен (`arena-library.js`), подиумные калибровки;
- Goblin Shaman как boss пролога, Goblin King flee intro, boss phases;
- RunState: инвентарь, золото, reward draft (детерминированный от `runSeed` + step id), `RunSave v1`, restart step;
- предметы ITEM-001/002 (`src/items.ts`, data-driven, солвер видит предметы через `WinQuery.maxItems`);
- approved HUD (ART-012B/BUILD-036), item bar и reward draft (плейсхолдер), presentation способностей (PRESENT-001);
- arena calibration, Campaign Editor, Pose Editor, species presentation defaults (CAL-005), baked arena loader;
- filled-arrow renderer, 15 arrow materials, projectile flight v1, light-hit VFX, damage numbers;
- clean game view (UI-001), FIX-033 HUD fit;
- route map MAP-001: `src/route-map.ts` (граф, save/load узла в RunState) + `viewer/visual-proto/route-map-ui.js` (fullscreen иллюстрированная карта, программные подписи).

Стрелочный трек завершён. BUILD-032/033 и старые VIS/FIX arrow-ветки считаются историей/источниками отдельных идей, а не активной основой разработки.

## Сборка Act I — принятый порядок (2026-09-19)

AGREED FOR NOW. Порядок — в BOARD «Ближайшая точка сведения». Кратко:

1. **INT-ITEM-001b** — свести Зелье, «Стрелу», Матрону heal + камни детей и честность «с набором» в main (готово на ветке `099d753`, FIX-034 переписан).
2. **MAP-001** — в main (`e69cd10`); проверить вход в карту после Prologue reward в едином забеге.
3. **SHOP-001** — торговец по approved-экрану «Лавка Хрягуна»; тратит существующее run-gold.
4. **RUN-003** — решение пользователя: входит ли level-up в первый slice (референс уже есть).
5. **LD-008** — Act I поверх предметов/волн: критерий честности `baseline / booster-helpful / power-gated`, ≥4 волновых боя, 9x9 к концу акта, точки карты ↔ stage'и.
6. **Popups/presentation** (ART-011B/013/014, FIX-035/036) — по approved-референсам, одно семейство карточек.
7. Полный ручной прогон Prologue → reward → карта → бой/лавка → Король гоблинов, затем economy/balance pass.

Отдельные mobile/VK/market треки остаются DEFERRED (см. ниже).

### MOB-001 — Mobile/Game UI Polish

DEFERRED BY USER. Не запускать до явной команды пользователя. Мобильный landscape уже проверен вручную (~740×360 и крупнее). Когда вернёмся: safe-area, responsive HUD polish, touch-size/real-phone проверка, точечные viewport fixes.

AGREED FOR NOW mobile direction: одна web/TypeScript codebase; landscape-first; без отдельного Unity/React Native rewrite; standalone wrapper — только позже при реальной необходимости.

## Vertical Slice v1 — обязательный run flow

AGREED FOR NOW.

Vertical slice считается собранным не тогда, когда отдельные бои хороши, а когда работает единый цикл:

`Prologue -> reward -> Goblin Country map -> battle / merchant choice -> rewards/items -> дальнейший маршрут -> Goblin King`

Обязательные части и их состояние:
- ITEM-001/002: предметы, reward draft, inventory, run-gold — **в main** (расходники Зелье/Стрела — INT-ITEM-001b);
- WAVE-001: волновые encounters — **движок в main**, контент в LD-008;
- MAP-001: карта Страны гоблинов с выбором маршрута — **в main**;
- SHOP-001: торговец, где run-gold превращается в силу текущего забега — **референсы одобрены, код не начат**;
- LD-008: rebalance Act I уже поверх предметов/волн — **не начат, разблокирован после INT-ITEM-001b**;
- approved HUD/reward/presentation слой — **HUD в main; reward/popup/shop/map по референсам — впереди**;
- затем единый ручной playtest и economy/balance pass.

До полного run-flow цены, частота наград, heal/Rotate economy и power-gating считаются provisional.

## Дополнительные принятые направления

AGREED FOR NOW:

- friendly-fire/self-damage от столкновения стрел должно иметь отдельный понятный VFX/feedback;
- Stone Pin на уровне Матроны обязан реально блокировать стрелу — это bugfix, не новое правило;
- route map позже расширяется events / points of interest, а не остаётся только battle/shop/boss;
- reward visual должен опираться на пользовательский approved reference `C:\Users\nerza\Projects\magicarrowassets\gameplay-reference\reward-approved.png`; свободный ART-011 exploration не считать финальным стилем;
- popups (victory/reward/boss/unlock) входят в ближайший presentation layer;
- XP/Level Up — отдельный run-progression слой: возможны бонусы к Rotate/charges/HP/utility; до финального balance нужно явно решить, входит ли он в первый vertical slice;
- позже нужны расходники/умения, усиливающие сами puzzle-стрелы;
- portal/spawner — новый encounter target: создаёт монстров, пока игрок не уничтожит портал;
- classes/skill tree/удары/spawn-control — осознанно MUCH LATER, не блокируют первый vertical slice.

## Более дальний маршрут — обсуждали, но пока не активные задачи

Это направление, а не автоматически принятый backlog:

1. ACT-I-002: развить уже существующие первые три Act I encounters в короткий настоящий vertical slice;
2. RUN-002: проверить roguelite rewards/progression на коротком run;
3. интегрировать только выбранные пользователем VFX, затем добавить combat audio;
4. после приятного vertical slice — VK production:
   - VK SDK;
   - saves;
   - lifecycle/fullscreen;
   - audio rules;
   - rewarded ads;
   - analytics;
   - слабые телефоны;
5. затем расширять контент/мету.

Это согласованное направление. Конкретная task-card создаётся, когда понятен scope очередного шага; отсутствие карточки не означает, что сам согласованный план исчез.

## Игровое ядро — решения, которые нельзя терять

AGREED FOR NOW / текущий gameplay canon:

- основа — Arrow/Tap Away puzzle;
- освобождённая стрелка не исчезает, а становится projectile во внешней арене;
- внешние цели находятся по сторонам board;
- направление является/становится боевым ресурсом;
- boss rewards должны менять правила/поведение стрел, а не только цифры;
- data-driven content предпочтительнее hardcoded контента;
- concurrent enemy timers разрешены и являются частью текущего combat flow;
- `board clear while target alive` может быть валидной победой;
- обычный hit по умолчанию не сбрасывает enemy timer;
- `CAST -> hit during cast -> interrupt cancels cast -> enemy switches to normal attack`;
- Stone Pin pinned-tap: без HP damage, без world turn, timers не двигаются;
- после boss пролога игрок получает **2 shared Rotate charges**;
- shared Rotate pool переносится дальше и не восстанавливается самовольно между encounters;
- обычный encounter должен иметь осмысленную 0-Rotate линию; Rotate усиливает решение, а не обычно служит обязательным ключом;
- `board clear while alive` остаётся валидной победой, но не делает encounter хорошим, если игрок после пары символических hit'ов только face-tank'ит и дочищает board;
- будущие оружие/active abilities дают альтернативы, но не используются как оправдание слабой базовой puzzle-композиции;
- Act I развивает multi-side combat и ведёт к boss reward Ricochet;
- позже run должен раскрыть Serpent Form;
- ещё позже — Chain;
- позднее допускается управляемый power-gating: не каждый encounter обязан проходиться базовым набором без run/meta-power или помощи.

AGREED FOR NOW (пользователь, 2026-09-19, экономика и предметы):

- предметы — редкость; обычная награда за бой — золото; третья карточка драфта — редкий предмет / стрелы / большое золото;
- мгновенных «+HP» наград нет: вместо них Зелье — расходник, который игрок пьёт когда хочет;
- расходники пополняемые (заряды складываются при повторной награде/покупке); нужны расходники, которые **создают стрелы на доске** — первый такой «Стрела»: одна стрела в выбранном направлении;
- Матрона = лечение **и** бросок камня (дети на спине с камнями); у врага может быть несколько способностей на своих таймерах;
- «100 % без урона голыми руками» перестал быть критерием обычного боя; честность считается с базовым набором (Лук + Щит) — 0 урона; 15/17 обычных Act I-боёв по-прежнему проходятся в 0 без предметов;
- дальше усложняем сами головоломки и число мобов (волны, 8x8–10x10, профиль `short`), а не только цифры HP;
- run-gold тратится у торговца (SHOP-001); второй валюты нет.

## Act I / content authoring — принятый рабочий подход

AGREED FOR NOW:

- Act I строим не через ранний «универсальный» генератор контента, а через ручной выбор интересных seed'ов;
- для seed'ов смотрим direction/turn timeline и реальные branch points;
- при shortlist отдельно проверяем 0-Rotate combat agency, а не только математическую solvability;
- seed, где естественные направления дают лишь символические попадания и дальше остаётся только терпеть атаки до board-clear, для обычного encounter считаем плохим кандидатом;
- enemy encounters поверх выбранных board'ов можно скриптовать вручную;
- по мере роста Act I увеличиваем decision density самой головоломки: больше стрелок/branch points, более витиеватая topology, при необходимости больший board;
- возможное укорочение стрел ради большей плотности — рабочая гипотеза для playtest, не зафиксированная геометрия;
- generic direction quotas / infinite-generation rules — будущая работа, не текущий блокер;
- визуальное производство не откладывать до самого конца: gameplay/content и нужные для playtest арты/VFX могут развиваться параллельно;
- финальный визуальный выбор всё равно делает пользователь после просмотра.

## Зафиксированные персонажи/визуальные роли

- Goblin Shaman = boss пролога.
- Goblin Taunter / Goblin King = будущий boss первого акта; не подменять им boss пролога. В раннем сюжетном encounter он получает 2 попадания, показывает back/taunt и уходит во flee; это не смерть.
- Dire Wolf = ordinary enemy visual/pipeline, не boss.
- Generic encounter IDs не объявлять конкретным видом врага без решения пользователя.

## VFX — жёсткие границы

AGREED FOR NOW:

- VFX presentation-only и не мутирует gameplay state;
- VFX не импортирует/не меняет EncounterState;
- visual hit-stop не останавливает simulation time и enemy timers;
- board-space VFX использует ту же projection/calibration path, что и playable renderer;
- сначала визуальный выбор, потом reusable-система;
- старый VIS-014 можно использовать как visual/code reference для magic-effect, но не как активную базу.

## Mobile — жёсткие границы

AGREED FOR NOW, но реализация отложена:

- не делать отдельную portrait-версию без отдельного решения;
- не заводить вторую mobile codebase;
- не переписывать игру в Unity/React Native только ради mobile;
- реальные mobile fixes делать после ручного пользовательского просмотра.

## Стек

RESEARCH: Python + VK API + JSON/CSV/SQLite/DuckDB/Parquet при необходимости
GAME_CORE: текущая рабочая реализация — pure TypeScript
GAME_RENDERER: текущий playable renderer остаётся web/Canvas-based; production stack не фиксировать шире без необходимости
TARGET: VK Games / VK Mini Apps; возможна дальнейшая адаптация под другие web-площадки

Не превращать spike/playtest implementation автоматически в production architecture.

## Проверка game/core

Для core/runtime изменений сохранять минимум:

- generator deterministic/reproducible;
- solvability проверяется кодом;
- property/seed tests для generator/solver;
- renderer не смешивается с puzzle-логикой без необходимости;
- чужой код используется только при подтверждённой лицензии;
- gameplay canon выше не меняется молча ради интеграции или визуального фикса.

Для визуальной/UX работы автоматические проверки дополняются реальным просмотром пользователем.

## Рыночный/VK-трек

Ранее собранные market research и snapshots остаются валидной памятью проекта.

Сейчас market/VK research DEFERRED и не является блокером разработки.

Когда трек снова понадобится:
- не раскрывать `VK_SERVICE_TOKEN`;
- `.env`/tokens/raw sensitive artifacts не коммитить;
- API collector должен оставаться воспроизводимым;
- фактические поля API важнее предположений из документации;
- демографические публичные выводы должны использовать агрегированные данные.

## Как используем модели

AGREED FOR NOW:

- основная обычная работа — бесплатные/дешёвые модели;
- дорогой Claude используется экономно;
- Claude в первую очередь нужен как техлид для сложных Git-ситуаций, конфликтов, интеграции и архитектурно-рискованных мест;
- не дублировать одну простую задачу несколькими дорогими моделями;
- визуальный результат всё равно принимает пользователь глазами.

## Как сливаем задачи

MERGE_BUILD_FIX: no-ff
MERGE_EXP: squash-if-accepted
MERGE_REVIEW: no-merge-if-no-changes

## Строгие правила проекта

- STRICT RULE: проектные, архитектурные, игровые и визуальные решения не считаются принятыми без явного подтверждения пользователя.
- STRICT RULE: исполнитель не делает merge в `main` самостоятельно.
- STRICT RULE: секреты VK, `.env` и токены никогда не коммитятся и не попадают в отчёты/логи.
- AGREED FOR NOW: рабочее название — Arrow-Roguelite.
- WORKING HYPOTHESIS: magic/fantasy combat — удобная текущая упаковка, но core не должен жёстко зависеть от monster wrapper.

## Что особенно дорого

- дорогие модели без необходимости;
- повторное чтение длинной истории/task-card;
- повторное исследование уже сохранённых данных;
- несколько агентов на одной задаче;
- отдельные review/research без конкретной причины;
- производство большого количества арта до пользовательского подтверждения визуального направления;
- production-полиш до нормального ручного playtest.
