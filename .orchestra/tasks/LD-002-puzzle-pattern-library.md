# TASK: LD-002 — Puzzle Pattern Mining & Encounter Board Library

STATUS: IN_PROGRESS
TYPE: DESIGN
SIZE: M
AGENT: Gemini 3.8 Flash (Medium)
BASE_BRANCH: origin/main
BRANCH: design/LD-002-puzzle-pattern-library
START_SHA: 9cfd9c5029e624b801f697e3c13e20043bc4d6f1
RESULT_SHA: not-yet-completed

## Зачем

Исследовать пространство генерируемых Arrow-досок и сформировать библиотеку паттернов головоломок (Puzzle Pattern Library) и кандидатов для боевых энкаунтеров Arrow-Roguelite.
Главная цель — классифицировать доски по типам решений, которые они требуют от игрока на чистом уровне головоломки (до наложения врагов и способностей), а затем определить наиболее сильные сочетания с механиками врагов (таймеры, касты, прерывания, прикол стрел камнем, Rotate) для раннего и среднего Акта I, а также для босс-файтов.

## Что нужно сделать

1. Сформулировать и каталогизировать таксономию паттернов головоломок (Chain Unlock, Bottleneck, False Temptation, Direction Scarcity, Direction Flood, Cross-Lock, Layered Gates, Choice of Opening, Forced Opening, Delayed Payoff, Sacrifice/Setup, Direction Switch, Rotate Bait, Recovery Board, Punishing Board, Symmetric/Asymmetric, Long-Path Reveal и др.).
2. Провести автоматизированное сканирование генератора по пресетам:
   - `easy` (6x7): минимум 3,000 seeds
   - `medium` (8x10): минимум 5,000 seeds
   - `hard` (10x12): минимум 5,000 seeds
3. Собрать метрики топологии, ветвления и распределения направлений для интересных кандидатов.
4. Выполнить воспроизведение и плейтест-верификацию решений (intended path, альтернативные пути, ошибки, визуальная читаемость).
5. Разработать связки паттернов с врагами и механиками (Basic timed enemy, Multi-enemy, Caster interrupt, Stone Throw / Pin, Shared Rotate, Directional enemies).
6. Выстроить кривую сложности по паттернам (Prologue -> Early Act I -> Mid Act I -> Late Act I / Boss).
7. Сформировать Act I Candidate Pack (5–8 сильных кандидатов для следующих энкаунтеров Акта I).
8. Сформировать Boss Candidate Pack (3–5 кандидатов под босс-файты: Shaman, Goblin King / Taunter).
9. Зафиксировать каталог слабых/скучных паттернов (Weak / Boring Patterns) для последующей фильтрации в генераторе.
10. Создать документ `docs/LD-002-PUZZLE-PATTERN-LIBRARY.md`.

## Ограничения

- Это RESEARCH + LEVEL DESIGN задача.
- Никакие найденные seed'ы и паттерны НЕ считать USER APPROVED.
- Не менять gameplay engine, visual prototype, enemy implementation, RunState, Rotate rules, Stone Pin rules, items.
- Не объявлять seeds финальными.
- Не делать "AI level generator".
- Не делать merge в main.
- Не удалять ветку.

## Итог

RESULT: Создан канонический документ `docs/LD-002-PUZZLE-PATTERN-LIBRARY.md` со статусом `RESEARCH & LEVEL DESIGN PROPOSAL`. В нём:
1. Выполнено автоматизированное сканирование 30,000 семян нашего генератора: 10,000 seeds на `easy` (6x7), 10,000 seeds на `medium` (8x10) и 10,000 seeds на `hard` (10x12) за 5.03 сек. Собраны точные эмпирические частоты 17 паттернов.
2. В Разделе A каталогизированы 17 ключевых паттернов (Chain Unlock, Bottleneck, False Temptation, Direction Scarcity, Direction Flood, Cross-Lock, Layered Gates, Choice of Opening, Forced Opening, Delayed Payoff, Sacrifice/Setup, Direction Switch, Rotate Bait, Recovery Board, Punishing Board, Symmetric/Asymmetric, Long-Path Reveal) с описанием сути, мышления игрока, геймдизайнерской ценности, мест применения и 2–5 реальными семенами на каждый паттерн.
3. В Разделе B представлена сводная таблица из 28 детально верифицированных кандидатов со всеми метриками топологии, ветвления, распределения направлений, стартовых ходов и сценариев.
4. В Разделе C сформирован Act I Candidate Pack из 7 кандидатов для последующих боев Акта I (Dire Wolf, Swarm Ambush, Cross-Throwers, Armored Brute, Dual Casters, Mirror Ambush, The Great Stockpile).
5. В Разделе D сформирован Boss Candidate Pack из 5 выдающихся босс-головоломок (Goblin Shaman, Goblin Taunter, Goblin King, The Ancient Golem, The Mirror Warden).
6. В Разделе E зафиксирован каталог слабых и скучных паттернов (Trivial Peel, Linear Conveyor, Direction Mono-Flood, Dead Center Blockade, Unavoidable Damage Gap) с точными математическими правилами фильтрации в генераторе.

VERIFY:
- Сканирование 30,000 семян выполнено скриптом `spikes/arrow-core/tools/run-pattern-scan.ts`, результаты сохранены в `spikes/arrow-core/encounters/pattern-mining-results.json`.
- 34 кандидата детально верифицированы скриптом `spikes/arrow-core/tools/build-library-data.ts`, результаты сохранены в `spikes/arrow-core/encounters/playtested-candidates.json`.
- Для всех ключевых кандидатов проверен intended path, альтернативные маршруты, естественные ошибки и читаемость.
- Все существующие тесты `spikes/arrow-core` (93 теста) успешно проходят без ошибок (`npm test`).
- Код движка, вьюера, баланса и визуального прототипа не модифицировался.
- Документ `docs/LD-002-PUZZLE-PATTERN-LIBRARY.md` полностью соблюдает статус PROPOSAL / NOT USER APPROVED.

FOUND:
1. Редкость Forced Opening (детонаторов): всего 1.4% на `easy`, 0.15% на `medium` и 0.03% на `hard`. Доски с ровно 1 легальным первым ходом чрезвычайно ценны для драматических сюжетных/босс-боев и должны отбираться вручную в специальный резерв.
2. Врожденный соблазн Rotate: от 64.3% до 74.4% всех генерируемых досок имеют значительный перекос направлений, где поворот CW/CCW дает $\ge +3$ стрелы в дефицитную сторону. Это подтверждает, что Rotate органично вплетен в саму топологию генератора, а не является искусственной надстройкой.
3. Капкан жадности (False Temptation): встречается более чем в 34% досок на всех размерах. Генератор часто выставляет на край длинные стрелы (длиной 3–5 клеток), удаление которых дает 0 разблокировок, наказывая бездумный кликерский стиль игры.
