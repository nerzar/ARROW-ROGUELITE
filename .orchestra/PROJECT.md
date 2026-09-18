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

Проект находится в стадии **стабильного playable Prologue + поиск combat feel / визуального языка**.

Базовая механика уже доказана:
- Prologue проходится целиком;
- tooling для арен/кампании/поз работает;
- стрелы сведены в новый filled renderer и считаются текущей принятой базой;
- presentation мобов через CAL-005 сведён в main;
- мобильный landscape вручную проверен пользователем и в целом работает без отдельного порта.

Текущий практический приоритет:

> сначала выбрать хорошие боевые VFX/анимационные приёмы на отдельном стенде VFX-001, затем интегрировать только то, что пользователь реально принял.

Не строить заранее большую VFX-архитектуру и не раздувать roadmap автоматическими задачами.

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

### 2. Browser game visual reference pass

PLANNED, отдельный task ещё не создан.

Пользователь хочет смотреть похожие браузерные игры как источник вдохновения для:
- HUD animations;
- damage / HP feedback;
- attack/cast telegraphs;
- boss presentation;
- projectile / impact effects;
- death feedback;
- rewards / victory presentation.

Цель — анализ приёмов и вдохновение, не копирование чужого арта/кода.

### 3. MOB-001 — Mobile/Game UI Polish

DEFERRED BY USER.

Не запускать до явной команды пользователя.

Мобильный landscape уже проверен вручную примерно на 740×360 и более крупных viewport: базовая композиция, board и арена работают.

Когда пользователь вернётся к mobile polish, план уже зафиксирован:
- game mode с возможностью скрыть административные/debug controls;
- убрать кашу в левом верхнем углу;
- scene dropdown должен показывать реально активную сцену;
- safe-area;
- небольшой responsive polish player HUD;
- touch-проверка.

AGREED FOR NOW mobile direction:
- одна web/TypeScript codebase;
- landscape-first;
- без отдельного Unity/React Native rewrite;
- отдельный standalone Android/iOS wrapper рассматривать только позже, если появится реальная необходимость.

## Более дальний маршрут — обсуждали, но пока не активные задачи

Это направление, а не автоматически принятый backlog:

1. короткий Act I vertical slice;
2. проверить roguelite rewards/progression на коротком run;
3. усилить combat feel: выбранные VFX, затем audio;
4. после приятного vertical slice — VK production:
   - VK SDK;
   - saves;
   - lifecycle/fullscreen;
   - audio rules;
   - rewarded ads;
   - analytics;
   - слабые телефоны;
5. затем расширять контент/мету.

Ни один из этих пунктов не становится task без отдельного решения пользователя.

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
- после boss пролога игрок получает shared Rotate reward;
- shared Rotate pool переносится дальше и не восстанавливается самовольно между encounters;
- позднее допускается управляемый power-gating: не каждый encounter обязан проходиться базовым набором без run/meta-power или помощи.

## Зафиксированные персонажи/визуальные роли

- Goblin Shaman = boss пролога.
- Goblin Taunter / Goblin King = будущий boss первого акта; не подменять им boss пролога.
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
