# TASK: EXP-002 — локальная аналитика + taxonomy рынка VK

STATUS: DONE
TYPE: EXP
SIZE: L
AGENT: Claude Opus
BASE_BRANCH: main
BRANCH: exp/EXP-002-market-analytics-taxonomy
START_SHA: 267d404c80e1da0d61e2a0f7489a66afafd602de
RESULT_SHA: f6fddcb548b5e24db532275b787d7d0a74ffa4f4

## Что нужно сделать

Проверить, нужен ли проекту локальный аналитический слой на DuckDB + Parquet, и на его основе подготовить воспроизводимую карту первого snapshot VK Games: базовые распределения, taxonomy механик/тем, recall-oriented candidate set для последующей LLM-разметки.

Это эксперимент. Он **не утверждает** DuckDB/Parquet как постоянную архитектуру и **не должен** массово размечать все 4 985 игр моделью до утверждения taxonomy пользователем.

## Что важно знать

BUILD-001 принят. Доступно:
- `research/vk-market/snapshots/2026-09-16/apps.csv` — 4 985 приложений, компактные поля;
- `research/vk-market/snapshots/2026-09-16/rankings.csv` — позиции в 6 сортировках;
- `research/vk-market/snapshots/2026-09-16/summary.json`;
- локально на машине пользователя: `artifacts/vk-market/20260916T163154Z/export/apps_full.csv` с полными descriptions и URL;
- `members_count` совпадает с публичной UI-меткой «N игроков» в пределах округления на 23/23 тестах, но смысл метрики и MAU не установлены.

Не называть `members_count` MAU.

## Часть A — DuckDB / Parquet как локальный рабочий слой

Проверить практическую пользу для этого проекта.

Разрешённый эксперимент:
- установить/использовать `duckdb` локально, если его нет;
- загрузить committed `apps.csv`, `rankings.csv` и локальный `apps_full.csv`;
- создать локально `artifacts/vk-analytics/magic-arrow.duckdb`;
- при необходимости экспортировать таблицы в `artifacts/vk-analytics/parquet/*.parquet`;
- сравнить размер CSV vs Parquet и удобство запросов;
- подготовить воспроизводимый скрипт/SQL, который строит базу заново из исходных файлов.

`.duckdb` и `.parquet` **не коммитить**. Это локальный кеш/аналитический слой. В Git идут только скрипты/SQL и маленькие результаты.

Нужно дать рекомендацию по итогам эксперимента:
- оставить CSV как единственный формат;
- или CSV для Git + DuckDB/Parquet локально;
- или другой простой вариант.

Не превращать проект в data-platform ради 5 тысяч строк.

## Часть B — базовая карта рынка

Через SQL/DuckDB посчитать как минимум:
- количество приложений по `genre` / `genre_id`;
- распределение `members_count`: median / p75 / p90 / p95 / max по жанрам;
- новые игры по `published_date` (например 30/90/365 дней) и их `members_count`/rank distributions`;
- top / median показатели по `popular_today`, `popular_week`, `growth_rate`, `create_date`, `popular`, учитывая известную нестабильность глубоких ranks;
- пересечение жанров с верхними частями growth/popular выдач;
- долю приложений с official community.

Глубокий rank `popular/popular_today` не считать точной стабильной позицией.

## Часть C — taxonomy v0

Предложить **две независимые оси** разметки.

### Mechanics

Минимум рассмотреть:
- arrow / tap-away;
- sort / shelf / goods sorting;
- screw / nuts / bolts;
- bubble shooter;
- merge / 2048 / physics merge;
- match-3;
- block / hexa;
- picture reveal / assembly;
- word;
- tabletop;
- other puzzle;
- non-puzzle / unknown.

Не заставлять игру иметь ровно один mechanic, если реально есть hybrid. Нужны `primary_mechanic`, optional secondary tags и confidence.

### Theme

Минимум рассмотреть:
- abstract;
- magic / fantasy;
- monsters / combat;
- romance / love / Cupid;
- treasure / adventure;
- cute animals;
- home / renovation;
- food / household;
- vehicles;
- space / sci-fi;
- realistic / neutral;
- unknown / mixed.

Это только taxonomy v0. Не делать вывод «тема X лучше» до проверки данных.

## Часть D — candidate retrieval, а не полная LLM-разметка

Используя `title + description + genre + ranks`, собрать широкий candidate set для направлений, которые нас интересуют.

Цель — высокий recall, а не идеальная precision.

Использовать:
- ключевые слова RU/EN;
- простые regex / token search;
- жанр;
- top части `growth_rate`, `popular_week`, `popular_today`;
- свежесть публикации;
- при необходимости fuzzy-поиск, но без тяжёлой инфраструктуры.

Обязательно включить candidate buckets:
- Arrow / Tap Away;
- Sort;
- Screw;
- Bubble;
- Merge;
- Match-3;
- puzzle + combat / roguelite-like;
- magic/fantasy puzzle;
- romance/love puzzle;
- treasure/adventure puzzle.

Проверить recall вручную на небольшой выборке: посмотреть случайные игры вне candidate set и оценить, не пропускает ли правила очевидные совпадения.

## Часть E — план LLM-разметки

Не размечать все 4 985 игр Opus вручную.

Предложить разумную схему следующей задачи:
- что можно определить детерминированно;
- что отдавать Claude Sonnet / Muse Spark;
- какой размер batch;
- какие поля подавать модели;
- JSON schema ответа;
- confidence + `needs_review`;
- сколько примеров проверять Opus-ом;
- как оценить precision/recall на контрольной выборке.

Если candidate set оказывается небольшим, допустимо в EXP-002 вручную/Opus-ом классифицировать **небольшой sample** для проверки taxonomy, но не весь корпус.

## Можно менять

- `tools/vk_analytics/**`;
- `research/vk-market/analysis/**`;
- `.gitignore`, только для `artifacts/vk-analytics/**`, если текущего правила недостаточно;
- этот task-файл.

## Не менять

- игровой код/дизайн;
- `README.md`;
- `docs/DESIGN-HYPOTHESES.md` и другие продуктовые решения;
- `.orchestra/BOARD.md`, `NOTES.md`, `RULES.md`, `PROJECT.md`;
- BUILD-001 snapshot;
- `.env`;
- raw API artifacts.

## Готово, если

- [x] DuckDB/Parquet эксперимент воспроизводим и не тащит binary data в Git;
- [x] есть рекомендация, нужен ли такой слой дальше;
- [x] есть базовые статистики рынка из первого snapshot;
- [x] есть `taxonomy-v0.md` с правилами и неоднозначностями;
- [x] есть широкий `candidate-set.csv` / аналог с причиной попадания;
- [x] проверен recall на случайной negative sample;
- [x] есть план массовой LLM-разметки без попытки скормить 4 985 игр одной сессии;
- [x] нет продуктового решения о теме/аудитории Magic Arrow;
- [x] нет секретов и user-level данных.

## Коммитимые результаты

Ожидаемо:
- `tools/vk_analytics/build.py` или простой эквивалент;
- `tools/vk_analytics/analysis.sql`;
- `research/vk-market/analysis/taxonomy-v0.md`;
- `research/vk-market/analysis/candidate-set.csv`;
- `research/vk-market/analysis/market-baseline.json` или `.csv`;
- `research/vk-market/analysis/EXP-002-REPORT.md`.

Если нужен другой небольшой текстовый файл — допустимо.

## Проверить

1. С нуля построить локальную DuckDB из snapshot + `apps_full.csv`.
2. Повторить ключевые SQL-запросы.
3. Убедиться, что row counts совпадают с BUILD-001 (4 985 apps, 29 852 rankings), если входные файлы те же.
4. Проверить размер Parquet относительно исходных CSV.
5. Проверить candidate-set на дубли и наличие `app_id` в snapshot.
6. Сделать small manual audit positive + negative sample taxonomy/retrieval.
7. Secret scan + final diff.

## Когда остановиться

Поставить `STATUS: BLOCKED`, если:
- локального `apps_full.csv` нет и без description нельзя выполнить candidate retrieval;
- для DuckDB/Parquet требуется тяжёлая внешняя инфраструктура;
- задача начинает превращаться в массовую LLM-разметку до утверждения taxonomy;
- нужен продуктовый выбор пользователя;
- появляется необходимость коммитить большой binary dataset.

## Итог

RESULT:
- `tools/vk_analytics/` (`python -m tools.vk_analytics build|baseline|candidates|audit`): пересобираемая локальная `artifacts/vk-analytics/magic-arrow.duckdb` + `parquet/*.parquet` из snapshot `apps.csv`/`rankings.csv` и локального `apps_full.csv`; `analysis.sql` (14 именованных запросов); keyword/genre retrieval; seeded выборка для аудита.
- `research/vk-market/analysis/`: `EXP-002-REPORT.md`, `market-baseline.json`, `taxonomy-v0.md`, `candidate-set.csv` (2 681 строк `(bucket, app_id)`, 1 646 уникальных приложений; в 10 обязательных bucket — 1 185), `recall-audit.csv` (267 строк с вердиктами).
- Рекомендация (не решение): CSV в Git как канонический формат + DuckDB локально как пересобираемый кеш; Parquet отдельным слоем пока не нужен — пересмотреть при нескольких snapshot или таблице LLM-разметки.
- Размеры: CSV 21.99 MB → Parquet с теми же колонками 6.81 MB, рабочие таблицы 3.25 MB, DuckDB-файл 6.04 MB. Сборка ~0.3 с.
- Baseline: Puzzle 25.5% каталога и 29% игр за 365 дней, но в top100 popular_week/popular_today/growth_rate lift ≈ 0.75–0.79; top100 popular_week крупные и старые (median members 838k, возраст ~7 лет), growth_rate/popular_today слабо связаны с members (Spearman 0.19/0.17); official community у 83.8%.
- Buckets (всего / strong): arrow 95/34, sort 168/149, screw 35/35, bubble 91/84, merge 302/247, match3 372/221, puzzle+combat/roguelite 176/115, magic/fantasy 204/171, romance/love 38/30, treasure/adventure 212/109.
- Аудит: negative 80 puzzle-жанр → 1 явный промах (исправлен) + 3 пограничных; 40 прочих жанров → 0; 60 theme negative → 0. Positive: mechanic strong 30 TP / 3 FP / 3 unclear; weak 3/11/1; theme strong 14/7/3; weak 4/7/1.
- Схема массовой LLM-разметки: в отчёте, раздел E (весь корпус batch по 20, JSON schema, needs_review, gold set ~250 игр вслепую Opus-ом, стратифицированные precision/recall).

VERIFY:
1. `rm -rf artifacts/vk-analytics && python -m tools.vk_analytics build` → `ok: true`; apps 4 985 (уникальных 4 985), rankings 29 852, app_text 4 985; id/title расхождений 0, id рейтинга вне apps 0.
2. `baseline` 3 раза подряд и после пересборки с нуля — одинаковый md5 (`1b26a718…`); после добавления tiebreak в ORDER BY. `candidates` после пересборки байт в байт совпадает.
3. Row counts совпадают с BUILD-001 (4 985 / 29 852).
4. Parquet против CSV: 6.81 MB против 21.99 MB (те же колонки); regex по описаниям 51 ms против 208 ms.
5. candidate-set: дублей `(bucket, app_id)` 0, `app_id` вне snapshot 0.
6. Ручной аудит positive и negative — `recall-audit.csv`, итоги в отчёте, раздел D.
7. `python -m tools.vk_market scan tools/vk_analytics research/vk-market/analysis` → SECRET SCAN: PASS. В коммите только текст (11 файлов, ~0.7 MB); `.duckdb`/`.parquet` лежат под игнорируемым `artifacts/`; `.gitignore` не менялся.

FOUND:
- Решения пользователя до массовой разметки: taxonomy A1 (гайки по болтам: sort или screw), A2 (zuma), A3 (collapse/blast).
- В каталоге есть не-игры и служебные приложения: «VK Game Test Tool» (#5 growth_rate), жанр Communication (флирт и знакомства) лидирует по lift в popular-выдачах. Для игровых сравнений их стоит фильтровать отдельным правилом.
- Многие описания содержат SEO-списки жанров («если вам нравятся: сортировка, 2048…») — keyword-методы на них ошибаются.
- Python-клиент DuckDB без пакета `pytz` не отдаёт `TIMESTAMPTZ`; в коде время приводится к `TIMESTAMP`/`VARCHAR`.
- Аудит проведён на правилах до исправления merge-паттерна (+4 строки merge); повторный запуск `audit --seed 2` даст немного другую выборку.

После завершения: `STATUS: DONE`, `RESULT_SHA`, commit, push task-ветки, остановиться. Не merge в `main`.
