# Проект

## Название

PROJECT: Arrow-Roguelite
WORKING_TITLE: yes

Старые упоминания `Magic Arrow` относятся к этому же проекту и считаются устаревшим рабочим названием.

## Репозиторий

REPOSITORY: nerzar/ARROW-ROGUELITE
STABLE_BRANCH: main
INTEGRATION_BRANCH: not-set-yet
CURRENT_PLAYABLE_BASE: build/BUILD-025-unified-prologue-playtest

Текущую активную задачу и ветку смотреть в `BOARD.md`.

## Текущий этап

Сейчас проект находится не в стадии абстрактного research/spike, а в стадии **стабилизации playable Prologue**.

Главный практический приоритет:

> пользователь должен сам открыть текущий build, удобно откалибровать сцену, пройти Prologue целиком и после этого решить, что менять дальше.

Пока это не production-MVP и не финальная архитектура. Но базовая механика уже доказана достаточно, чтобы текущий цикл строился вокруг живого playtest, а не вокруг новых исследований «на всякий случай».

Рыночный/VK-трек остаётся полезным, но не является блокером playable Prologue и не должен автоматически порождать новые задачи, пока пользователь сам не вернёт его в приоритет.

## Что уже есть в текущей playable-линии

Это описание фактической текущей базы, а не автоматическое объявление всего production-решением:

- pure TypeScript arrow-core с deterministic generator/solver и seed/property tests;
- combat-pressure / multi-enemy runtime;
- единый playable Prologue из 5 шагов;
- Goblin Shaman как boss пролога;
- arena calibration + ручной calibration editor;
- независимые board geometry, actor anchors/scale и effect anchors;
- browser/local override калибровки для ручного playtest;
- end-of-Prologue completion state и reward flow.

Текущие arrow visuals временные и пользователем как финальное визуальное решение не приняты.

## Игровое ядро — решения, которые нельзя терять

AGREED FOR NOW / текущий gameplay canon:

- основа — Arrow/Tap Away puzzle;
- освобождённая стрелка не исчезает, а становится projectile во внешней арене;
- внешние цели находятся по сторонам board;
- направление является/становится боевым ресурсом;
- это явно раскрывается в прологе/на mini-boss;
- boss rewards должны менять правила/поведение стрел, а не только цифры;
- data-driven content предпочтительнее hardcoded контента;
- позднее допускается управляемый power-gating: не каждый encounter обязан проходиться базовым набором без run/meta-power или помощи;
- concurrent enemy timers разрешены и являются частью текущего combat flow;
- `board clear while target alive` может быть валидной победой;
- обычный hit по умолчанию не сбрасывает enemy timer;
- `CAST -> hit during cast -> interrupt cancels cast -> enemy switches to normal attack`;
- Stone Pin pinned-tap: без HP damage, без world turn, timers не двигаются;
- после boss пролога игрок получает shared Rotate reward; shared pool переносится дальше и не должен самовольно восстанавливаться между encounters.

## Зафиксированные персонажи/визуальные роли

- Goblin Shaman = boss пролога.
- Goblin Taunter / Goblin King = будущий boss первого акта; не подменять им boss пролога.
- Dire Wolf = ordinary enemy visual/pipeline, не boss.
- Generic encounter IDs не объявлять конкретным видом врага без решения пользователя.
- Текущий arrow-art — временный; визуальное направление стрел пользователь должен увидеть и отдельно принять.

## Стек

RESEARCH: Python + VK API + JSON/CSV/SQLite/DuckDB/Parquet при необходимости
GAME_CORE: текущая рабочая реализация — pure TypeScript
GAME_RENDERER: production stack всё ещё не зафиксирован; Phaser 4 + TypeScript + Vite остаётся кандидатом, а не принятым решением
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

Ранее собранные market research и snapshots остаются валидной памятью проекта. Когда трек снова понадобится:

- не раскрывать `VK_SERVICE_TOKEN`;
- `.env`/tokens/raw sensitive artifacts не коммитить;
- API collector должен оставаться воспроизводимым;
- фактические поля API важнее предположений из документации;
- демографические публичные выводы должны использовать агрегированные данные.

Состояние отложенных market-задач смотреть в `BOARD.md`; не запускать их автоматически.

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
