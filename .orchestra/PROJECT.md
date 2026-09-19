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

Проект находится в стадии **сборки первого полноценного vertical slice: Prologue + Act I + rewards/items + route map + merchant + presentation polish**.

Базовая механика уже доказана:
- Prologue проходится целиком;
- tooling для арен/кампании/поз работает;
- стрелы сведены в новый filled renderer и считаются текущей принятой базой;
- presentation мобов через CAL-005 сведён в main;
- мобильный landscape вручную проверен пользователем и в целом работает без отдельного порта.

Текущий ближний план хранится в BOARD и сейчас состоит из нескольких уже согласованных независимых задач:
- VFX-001 — подобрать combat feel на отдельном стенде;
- BUILD-035 — Projectile Flight v1;
- UI-001 — привести game shell в порядок;
- REF-001 — собрать браузерные HUD/VFX/animation references.

Не строить заранее большую VFX-архитектуру и не превращать согласованный roadmap в бесконечный backlog. Но уже принятые пользователем планы нельзя терять только потому, что они ещё не стали RUNNING.

## Что уже есть в текущей playable-линии

Это описание фактической текущей базы, а не обещание неизменяемой production-архитектуры:

- pure TypeScript arrow-core с deterministic generator/solver и seed/property tests;
- combat-pressure / multi-enemy runtime;
- единый playable Prologue из 5 шагов;
- Goblin Shaman как boss пролога;
- Goblin King flee intro;
- arena calibration + ручной calibration editor;
- Campaign Editor: этапы, каталог существ, Arena Default, импорт арен, persistence;
- Pose Editor;
- species presentation defaults:
  - pivot X/Y;
  - scale;
  - HUD offset X/Y;
  - HUD scale;
  - shadow offset X/Y;
  - editor/runtime parity;
- baked arena loader;
- filled-arrow renderer в реальной игре;
- 15 arrow materials;
- `viewer/filled-arrow.html`;
- stroke fallback для debug;
- end-of-Prologue completion/reward flow;
- shared Rotate reward.

Стрелочный трек завершён. BUILD-032/033 и старые VIS/FIX arrow-ветки считаются историей/источниками отдельных идей, а не активной основой разработки.

## Ближайший принятый план

### 1. VFX-001 — Combat Feel Lab

AGREED FOR NOW.

Сначала отдельный визуальный стенд, без изменения gameplay:
- projectile trail;
- impact flash;
- hit sparks / particles;
- damage number;
- enemy hit squash/recoil;
- visual hit-stop;
- camera impulse/shake;
- death burst;
- boss impact;
- reward pop.

Цель — подобрать ощущения глазами.
Только после пользовательского выбора решать, какие эффекты интегрировать и какая reusable-архитектура действительно нужна.

Полная generic VFX-система со scheduler/particles/camera/etc. сейчас остаётся IDEA, а не принятой задачей.

### 2. BUILD-035 — Projectile Flight v1

ACCEPTED AND MERGED (INT-BUILD-035).

Стрела после выхода из puzzle:
- сначала продолжает исходное направление;
- затем плавно доворачивает к текущему hit-anchor цели;
- не меняет target selection, damage или combat state.

Это presentation-only задача. Траекторию держать расширяемой под будущие Ricochet/Piercing, но сами эти механики сейчас не реализовывать.

### 3. UI-001 — Game Shell Cleanup

READY.

Отдельно от mobile polish исправить уже подтверждённые проблемы обычной игровой версии:
- возможность скрыть административные/debug controls и получить clean game view;
- убрать кашу в левом верхнем углу;
- scene dropdown всегда показывает фактически активную runtime scene.

### 4. Browser game visual reference pass / REF-001

READY, task-card создан.

Пользователь хочет смотреть похожие браузерные игры как источник вдохновения для:
- HUD animations;
- damage / HP feedback;
- attack/cast telegraphs;
- boss presentation;
- projectile / impact effects;
- death feedback;
- rewards / victory presentation.

Цель — анализ приёмов и вдохновение, не копирование чужого арта/кода.

### 5. MOB-001 — Mobile/Game UI Polish

DEFERRED BY USER.

Не запускать до явной команды пользователя.

Мобильный landscape уже проверен вручную примерно на 740×360 и более крупных viewport: базовая композиция, board и арена работают.

Когда пользователь вернётся к mobile polish, там остаются только mobile-specific вещи:
- safe-area;
- небольшой responsive polish player HUD;
- touch-size/real-phone проверка;
- точечные viewport fixes по факту.

Общие admin/scene/top-left проблемы вынесены в UI-001 и не должны ждать mobile.

AGREED FOR NOW mobile direction:
- одна web/TypeScript codebase;
- landscape-first;
- без отдельного Unity/React Native rewrite;
- отдельный standalone Android/iOS wrapper рассматривать только позже, если появится реальная необходимость.

## Vertical Slice v1 — обязательный run flow

AGREED FOR NOW.

Vertical slice считается собранным не тогда, когда отдельные бои хороши, а когда работает единый цикл:

`Prologue -> reward -> Goblin Country map -> battle / merchant choice -> rewards/items -> дальнейший маршрут -> Goblin King`

Обязательные части:
- ITEM-001/002: предметы, reward draft, inventory, run-gold;
- WAVE-001: волновые encounters;
- MAP-001: карта Страны гоблинов с выбором маршрута;
- SHOP-001: торговец, где run-gold превращается в силу текущего забега;
- LD-008: rebalance Act I уже поверх предметов/волн;
- approved HUD/reward/presentation слой;
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
