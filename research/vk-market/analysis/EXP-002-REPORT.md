# EXP-002 — локальная аналитика + taxonomy рынка VK Games

Snapshot: `2026-09-16` (BUILD-001), 4 985 приложений, 29 852 строк рейтингов.
Тип: EXP. Ничего из этого отчёта не принято как решение. Тема и аудитория Magic Arrow здесь не выбираются.

Файлы:
- `tools/vk_analytics/` — сборка DuckDB/Parquet, `analysis.sql`, retrieval, аудит;
- [market-baseline.json](market-baseline.json) — результаты всех запросов `analysis.sql`;
- [taxonomy-v0.md](taxonomy-v0.md) — оси mechanic / theme / meta и неоднозначности;
- [candidate-set.csv](candidate-set.csv) — кандидаты с причиной попадания (long format: одна строка на `(bucket, app_id)`);
- [recall-audit.csv](recall-audit.csv) — ручная проверка positive/negative выборки с вердиктами.

`members_count` ниже — это метрика API, совпадающая с UI-меткой «N игроков». **Это не MAU.**

## Воспроизведение

```text
pip install duckdb                              # проверено на duckdb 1.5.5, Python 3.14
python -m tools.vk_analytics build              # artifacts/vk-analytics/magic-arrow.duckdb + parquet/*.parquet, проверки row counts
python -m tools.vk_analytics baseline           # analysis.sql -> research/vk-market/analysis/market-baseline.json
python -m tools.vk_analytics candidates         # -> research/vk-market/analysis/candidate-set.csv
python -m tools.vk_analytics audit --neg 120 --pos-per-bucket 6 --out <scratch.csv>   # seeded выборка для ручного аудита
```

Входы: `research/vk-market/snapshots/2026-09-16/{apps,rankings}.csv` и локальный `artifacts/vk-market/20260916T163154Z/export/apps_full.csv`.
Каждый `build` удаляет базу и строит её заново. Все выходы под `artifacts/` уже закрыты правилом `.gitignore` (`artifacts/`).
Время считается от `snapshot_ref_ts` = максимальное `details_captured_at` (2026-09-16 16:49:48 UTC), а не от текущих часов. Сессия DuckDB работает в `TimeZone=UTC`.

---

## A. DuckDB / Parquet

### Проверки сборки

`apps` 4 985 (уникальных 4 985) · `rankings` 29 852 · `app_text` 4 985 · id без текста 0 · текст без id 0 · расхождений title между `apps.csv` и `apps_full.csv` 0 · id рейтинга не из `apps` 0. Сборка занимает ~0.3 с.

### Размеры

| Данные | CSV | Parquet (zstd), те же колонки | Parquet, рабочие таблицы |
|---|---|---|---|
| apps (snapshot) | 2.118 MB | 0.349 MB | 0.260 MB (`apps`, типизировано) |
| rankings | 1.914 MB | 0.147 MB | 0.149 MB |
| apps_full (описания + URL картинок) | 17.956 MB | 6.310 MB | 2.838 MB (`app_text`: description, group name, screenshot URLs) |
| **итого** | **21.99 MB** | **6.81 MB** (−69%) | **3.25 MB** (−85%) |
| DuckDB-файл (все таблицы) | — | — | 6.04 MB |

Скорость: один и тот же regex по описаниям (best of 3) — 208 ms напрямую по `apps_full.csv`, 51 ms по `app_text.parquet`. На 5 тысячах строк разница несущественна.

### Что показал эксперимент

Польза:
- одна среда для snapshot, рейтингов и полного текста: join, `quantile_disc`, оконные функции, `regexp_matches`. Весь baseline ([analysis.sql](../../../tools/vk_analytics/analysis.sql)) — ~200 строк SQL без pandas;
- DuckDB — один pip-пакет, без сервера и без данных в Git; база пересобирается из CSV за доли секунды;
- `apps_full.csv` (18 MB, не коммитится) в Parquet занимает 2.8–6.3 MB. Это удобно как компактная локальная копия текста.

Ограничения и шероховатости:
- без пакета `pytz` Python-клиент не отдаёт `TIMESTAMPTZ` — время приходится приводить к `TIMESTAMP`/`VARCHAR` в SQL (так и сделано);
- на одном snapshot Parquet не нужен для производительности: всё и так помещается в память;
- регулярки для русского (`\b`, морфология) удобнее писать в Python, поэтому retrieval сделан на Python поверх DuckDB-таблиц.

### Рекомендация (решает пользователь)

**CSV в Git как канонический формат + DuckDB локально как пересобираемый кеш.** Parquet не делать отдельным обязательным слоем. Экспорт оставлен в `build` (дешёвый), но опираться на него пока незачем.

Когда пересмотреть: когда накопится несколько snapshot (тренды members/ranks по датам) или появится таблица LLM-разметки на тысячи строк с JSON. Тогда Parquet по датам (`snapshot=YYYY-MM-DD/`) станет удобным локальным архивом. SQLite из `PROJECT.md` проще, но в ней нет quantile/regex «из коробки», и для такой аналитики она хуже.

---

## B. Базовая карта рынка (snapshot 2026-09-16)

Полные таблицы — в [market-baseline.json](market-baseline.json). Ниже только факты, без продуктовых выводов.

### Жанры и `members_count`

| genre | n | доля | median | p75 | p90 | p95 | max |
|---|---|---|---|---|---|---|---|
| Puzzle | 1 269 | 25.5% | 4 875 | 20 510 | 83 416 | 177 003 | 3.98M |
| Hyper-casual | 996 | 20.0% | 7 642 | 30 332 | 94 235 | 184 681 | 8.30M |
| Tabletop game | 391 | 7.8% | 8 574 | 69 863 | 390 676 | 809 937 | 12.6M |
| Arcade | 380 | 7.6% | 4 935 | 13 873 | 39 796 | 83 396 | 4.42M |
| Simulator | 339 | 6.8% | 12 019 | 36 704 | 144 462 | 343 500 | 18.0M |
| Three in a row | 318 | 6.4% | 13 608 | 51 642 | 163 260 | 335 062 | 26.1M |
| Word game | 218 | 4.4% | 8 676 | 33 312 | 196 203 | 478 073 | 4.00M |
| Strategy | 188 | 3.8% | 12 682 | 49 298 | 169 168 | 376 596 | 18.5M |
| 3D shooter | 165 | 3.3% | 26 159 | 63 770 | 220 986 | 360 591 | 8.21M |
| Adventure | 162 | 3.2% | 17 582 | 56 908 | 107 437 | 227 862 | 9.31M |
| Racing | 160 | 3.2% | 20 230 | 58 415 | 171 381 | 248 925 | 5.45M |
| RPG | 148 | 3.0% | 36 215 | 137 234 | 632 753 | 1.54M | 5.75M |
| Economic | 128 | 2.6% | 32 737 | 125 204 | 1.67M | 3.68M | 8.56M |
| Gambling | 95 | 1.9% | 36 382 | 217 288 | 879 135 | 1.23M | 12.0M |
| Communication | 28 | 0.6% | 263 568 | 837 500 | 13.6M | 16.9M | 33.9M |

Весь каталог: median 9 541, p90 152 615, p99 2.47M; ≥100k — 664 приложения, ≥1M — 101.

### Свежесть

| возраст | n | median members | p90 | в top100 growth | в top100 popular_week | в top100 popular_today |
|---|---|---|---|---|---|---|
| 0–30 дней | 232 | 813 | 3 876 | 16 | 0 | 1 |
| 31–90 дней | 382 | 2 363 | 6 899 | 9 | 2 | 15 |
| 91–365 дней | 736 | 3 881 | 25 281 | 12 | 8 | 22 |
| 1–3 года | 1 797 | 8 437 | 76 776 | 27 | 15 | 21 |
| > 3 лет | 1 838 | 31 686 | 497 498 | 36 | 75 | 41 |

- За 365 дней опубликовано 1 350 приложений (27% каталога). Из них Puzzle 394 (29% новых), Arcade 190, Hyper-casual 164, Simulator 117.
- Top по members среди опубликованных за 365 дней: ProjectH 354k (Simulator), Тропиквиль 184k, Болты и гайки: сортировка 177k, Гранд Тур: Гонки Матч 2 174k, ТапТап Стрелка 169k, Морской бой 2025 163k, Мир Слияния 144k, Tap Gallery 141k, Яга: Зелья судьбы 129k, Кубики Онлайн 107k. В первых 30 — ещё «Стрелки: Очисти поле» 92k, «Разбери Стрелочки» 81k, «Стрелочки» 72k, «Волшебные Бутылки» 58k (полный список — `new_games_top_members_365d`).

### Сортировки

| sort | top100: median members | median возраст, дней | новых ≤90д | Spearman(rank, members rank) в top500, >0 = крупнее → выше |
|---|---|---|---|---|
| popular_week | 837 500 | 2 546 | 2 | 0.60 |
| visitors | 697 263 | 2 094 | 3 | 0.44 |
| popular | 766 202 | 2 719 | 0 | 0.61 |
| popular_today | 124 242 | 665 | 16 | 0.17 |
| growth_rate | 170 659 | 595 | 25 | 0.19 |
| create_date | 2 208 | 492 | 17 | −0.13 |

- `popular_week` / `popular` / `visitors` в верхней части близки к размеру (`members_count`) и возрасту. `growth_rate` и `popular_today` с размером почти не связаны и чаще содержат новые игры.
- В top-10 `growth_rate` — две arrow-головоломки: «Туда-Сюда: Распутай Рисунок» (#7, 33 дня) и «Лабиринт Стрелок Пазл» (#8, 204 дня). Это факт одного snapshot, а не тренд.
- **Нестабильность рангов** (дубли `app_id` внутри одной сортировки): `popular` 503 и `popular_today` 421 повторных строк уже в рангах 1–1000; `popular_week` — 0 до ранга 2000; `growth_rate` — 0 до 1000, 83 в 1001–2000. Практически: `popular`/`popular_today` надёжны только в первых сотнях, `popular_week`/`visitors`/`growth_rate` — примерно до 1000.

### Жанры в верхних частях выдач (lift = доля в top N / доля в каталоге)

| sort, top100 | lift > 1.5 | Puzzle | Hyper-casual |
|---|---|---|---|
| popular_week | Communication 12.5, Gambling 5.8, Economic 5.1, Three in a row 2.5, Tabletop 2.2 | 20 шт., 0.79 | 1 шт., 0.05 |
| popular_today | Communication 7.1, Gambling 6.3, Economic 4.7, RPG 2.4, Strategy 2.1, Three in a row 1.9, Tabletop 1.7 | 19 шт., 0.75 | 1 шт., 0.05 |
| growth_rate | Communication 7.1, Gambling 3.2, Simulator 2.1, Three in a row 1.6 | 19 шт., 0.75 | 8 шт., 0.40 |

Puzzle — крупнейший жанр по числу игр и по числу новых игр, но в top100 всех трёх сортировок он представлен слабее своей доли в каталоге. Hyper-casual в top100 почти отсутствует.

### Официальное сообщество

Есть у 83.8% приложений (4 178). Top100 `popular_week` — 97%, top100 `growth_rate` — 86%, опубликованные за 365 дней — 74.1%. Во всех жанрах, кроме Gambling и Communication, медиана members у приложений с сообществом выше. Это корреляция, причинность не установлена.

---

## C. Taxonomy v0

См. [taxonomy-v0.md](taxonomy-v0.md): 16 значений mechanic, 16 значений theme, отдельная ось meta (combat / roguelite / meta_layer). До массовой разметки пользователю нужно решить неоднозначности A1 (гайки по болтам: sort или screw), A2 (zuma), A3 (collapse/blast).

---

## D. Candidate retrieval

Метод ([candidates.py](../../../tools/vk_analytics/candidates.py)):
- поля `title` (lower, ё→е), `description`, `genre`; ранги и свежесть — колонки контекста (`hot_top300` = ранг ≤ 300 в `growth_rate`/`popular_week`/`popular_today`), а не условие отбора;
- mechanic buckets: RU/EN regex по title (strong), специфичные фразы описания (strong), общие слова (weak — только в puzzle-жанрах или при слове «головоломка»). Для arrow из описания удаляются предложения про управление («стрелки на клавиатуре», «часовой стрелки»);
- theme buckets = puzzle-сигнал (жанр Puzzle / Three in a row, strong mechanic hit или слово «головоломка/пазл») × тематический regex. Маркетинговые слова («приключение», «сказка», «сердца») дают только weak и в основном ищутся в title;
- `extra_*` buckets (маджонг, блоки, пазлы/картинки, поиск предметов) не требовались. Они нужны, чтобы объяснить non-candidates при аудите.

### Размер candidate set

| bucket | всего | strong | weak | hot_top300 | ≤365 дней |
|---|---|---|---|---|---|
| arrow_tapaway | 95 | 34 | 61 | 11 | 53 |
| sort | 168 | 149 | 19 | 16 | 77 |
| screw | 35 | 35 | 0 | 7 | 17 |
| bubble | 91 | 84 | 7 | 12 | 18 |
| merge | 302 | 247 | 55 | 29 | 97 |
| match3 | 372 | 221 | 151 | 55 | 90 |
| puzzle_combat_roguelite | 176 | 115 | 61 | 18 | 63 |
| magic_fantasy_puzzle | 204 | 171 | 33 | 31 | 69 |
| romance_love_puzzle | 38 | 30 | 8 | 5 | 12 |
| treasure_adventure_puzzle | 212 | 109 | 103 | 32 | 61 |
| extra_tile_mahjong | 177 | 108 | 69 | 16 | 79 |
| extra_block_hexa | 345 | 246 | 99 | 24 | 112 |
| extra_picture_jigsaw | 333 | 215 | 118 | 33 | 122 |
| extra_hidden_object_differences | 133 | 133 | 0 | 20 | 36 |

Уникальных приложений: в 6 mechanic buckets — 897 (strong — 696); в 4 theme buckets — 525 (strong — 361); во всех 10 обязательных — **1 185**; со всеми extra — 1 646. В нескольких bucket одновременно — 758 приложений (гибриды и шум). CSV: 2 681 строка, дублей `(bucket, app_id)` 0, `app_id` вне snapshot 0.

### Ручной аудит ([recall-audit.csv](recall-audit.csv))

Выборка seeded (`seed=2`). Читались title, genre и первые 240 символов описания.

**Negative (recall).**

| выборка | размер | промахи | пограничные |
|---|---|---|---|
| вне mechanic buckets, жанры Puzzle / Three in a row / Hyper-casual (пул 1 782) | 80 | 1 | 3 |
| вне mechanic buckets, остальные жанры (пул 2 306) | 40 | 0 | 0 |
| вне theme buckets, puzzle-жанр или mechanic-кандидат (пул 1 406) | 60 | 0 | 0 |

- Явный промах: «Рецепт Счастья» — merge-2 («в жанре "соединяй предметы"», 513k members, #17 growth). **Исправлено после аудита**: добавлен паттерн `соединя* предмет`; игра теперь в `merge` strong. Остальная выборка построена на правилах до исправления, поэтому пул для повторного seed сдвинулся на 1 игру.
- Пограничные: тап по воздушному шарику, который улетает (tap-away-подобное, без слов «стрелк»); числовое «деление» в духе 2048; стрельба фигурами «выбивать одинаковые» (похоже на bubble).
- Оценка по puzzle-жанрам: явных промахов 1/80 = 1.3% (точный 95% CI 0.03–6.8%) → ~20 игр из пула 1 782 (верхняя граница ~120). С пограничными 4/80 = 5% (1.4–12.3%) → ~90. В остальных жанрах 0/40 (верхняя граница 8.8%). Точечная оценка recall для mechanic buckets высокая (~95%+), но интервал широкий. В разметке нужен контроль на случайных non-candidates (см. E).

**Positive (precision).**

| тип | TP | FP | неясно |
|---|---|---|---|
| mechanic strong (6 buckets × 6) | 30 | 3 | 3 |
| mechanic weak (5 × 3; у screw нет weak) | 3 | 11 | 1 |
| theme strong (4 × 6) | 14 | 7 | 3 |
| theme weak (4 × 3) | 4 | 7 | 1 |

- Mechanic strong хороши: merge 6/6, arrow/sort/screw/match3 5/6. Weak в mechanic — в основном шум (arrow weak 0/3: лабиринты, «распутать вопросы»).
- Theme — самое слабое место: в combat strong 3/6 (платформер и PvP-режим числовой игры), в romance strong 3/6 («любовь» в смысле дружбы или «романтичных мест»), в treasure strong 3/6 («сундук» как награда, детективы). Ключевые слова задают тему плохо — это задача LLM.
- Вывод для следующего шага: regex годится как фильтр и как приоритет, но не как разметка. Особенно для theme и weak.

---

## E. Схема массовой LLM-разметки (предложение)

### Что детерминированно, без LLM

`genre`, возраст, members, ранги и `hot_top300`, official community, длина описания, флаги и причины retrieval (`candidate-set.csv`), кластеры клонов по нормализованному title («2048», «Маджонг», «Сортировка»), пустое или сверхкороткое описание (< 60 символов) → сразу `needs_review` или `unknown`. Эти поля хранятся рядом с разметкой, но **не подаются модели как подсказка**: иначе модель повторит ошибки regex, и оценить recall станет нельзя.

### Что размечает модель

Оси `primary/secondary mechanic`, `primary/secondary theme`, `combat`, `roguelite`, `meta_layer`, confidence и короткая цитата-обоснование. Исполнитель — Claude Sonnet или Muse Spark (как указано в задаче). Выбор модели и бюджета — за пользователем. Точная цена по актуальному прайсу не считалась.

### Объём и порядок

1. **Весь корпус 4 985**, а не только 1 646 кандидатов. Retrieval по оценке пропускает 1–5% внутри puzzle-жанров (верхняя граница CI ~12%) и не размечает theme. Объём небольшой: ~250 запросов по 20 игр.
2. Если бюджет ограничен: сначала 1 646 кандидатов + случайные 400 non-candidates (стратифицированно по жанру) для оценки recall. Остальное позже.
3. Разметка идёт вне интерактивной сессии: скрипт + API (или Batch API) с JSONL-чекпоинтами в `artifacts/vk-analytics/labels/`, resumable, как сборщик BUILD-001.

### Batch

- 20 игр на запрос. Ответ — массив объектов с `app_id`: так ошибку легко изолировать и перезапросить.
- Taxonomy (enum + правила + неоднозначности из taxonomy-v0) — в system prompt, закешированном для всех batch.
- `temperature=0`, structured output (JSON schema / tool call). Невалидный JSON или отсутствующий `app_id` → повтор только этих игр.

### Поля на вход

`app_id`, `title`, `genre`, `description` (пробелы схлопнуты, URL и эмодзи-мусор удалены, обрезка до 1 500 символов). Ранги, members и retrieval-причины не подаются.

### JSON schema ответа (на одну игру)

```json
{
  "app_id": 0,
  "primary_mechanic": "arrow_tapaway|sort|screw|bubble_shooter|merge|match3|tile_match|block_hexa|picture_reveal|word|tabletop|hidden_object|quiz_trivia|other_puzzle|non_puzzle|unknown",
  "secondary_mechanics": ["<mechanic enum>", "..."],
  "mechanic_tags": ["marble_zuma|collapse_blast|physics_drop|merge2_board|number_2048|parking_unblock|pin_pull|draw_line|pipes_connect|logic_grid|physics|tangle_rope|escape_room|sliding"],
  "mechanic_confidence": "high|medium|low",
  "primary_theme": "abstract|magic_fantasy|monsters_combat|romance_love|treasure_adventure|cute_animals|home_renovation|food_household|farm_garden|vehicles|space_scifi|detective_mystery|memes_pop_culture|horror|realistic_neutral|unknown_mixed",
  "secondary_themes": ["<theme enum>"],
  "theme_tags": ["holiday_seasonal|kids|adult_18|anime|ussr_nostalgia|cozy_relax"],
  "theme_confidence": "high|medium|low",
  "combat": "none|cosmetic|core",
  "roguelite": false,
  "meta_layer": "none|renovation_story|collection|rpg_progression|pvp_tournament|idle_economy|other",
  "evidence": "цитата из описания ≤ 120 символов, на которой основан primary_mechanic",
  "needs_review": false,
  "review_reason": "null|low_confidence|no_rules_in_description|seo_keyword_list|hybrid_unclear|taxonomy_gap"
}
```

`secondary_*` — не больше 3 значений, без повтора primary. `evidence` должна быть дословной подстрокой описания: это проверяется детерминированно, иначе `needs_review`.

### Правило `needs_review` (модель + постпроверка)

`needs_review = true`, если выполнено хотя бы одно:
- модель сама поставила `true` или любой confidence = `low`;
- `evidence` не найдена в описании;
- strong retrieval-bucket противоречит primary/secondary (например, title «Стрелки…», а mechanic ≠ arrow);
- `primary_mechanic ∈ {unknown, other_puzzle}` и `hot_top300 = 1`.

### Проверка Opus-ом

1. **Gold set ~250 игр до основной разметки или параллельно с ней.** Opus размечает вслепую, не видя ответа Sonnet. Страты: по 15 из каждого mechanic bucket (90), по 10 из каждого theme bucket (40), 20 из hot_top300, 100 случайных non-candidates.
2. **Review queue.** Все `needs_review` из hot_top300 и ≤365 дней, остальные — выборочно, до ~150 игр.
3. Спорные случаи gold (Opus ≠ Sonnet) досматривает пользователь или архитектор, если они касаются неоднозначностей A1–A7 / B1–B5.

### Оценка качества

- Для каждого целевого класса (arrow, sort, screw, bubble, merge, match3; magic, romance, treasure, combat) по gold set: precision и recall Sonnet (primary ∪ secondary) против Opus. Recall корпуса — через веса страт (`вес = размер пула / размер выборки`), с 95% CI.
- Те же метрики для regex retrieval — это baseline, который LLM должна превзойти.
- Порог для приёмки (предложение): mechanic target-классы — precision ≥ 0.90 и recall ≥ 0.90; theme — ≥ 0.80 / ≥ 0.80. При недоборе правится prompt или taxonomy, и перезапускаются только затронутые классы.
- Результат: компактный `labels-v0.csv` в Git (`app_id` + поля без `evidence`), полный JSONL — локально в `artifacts/`.

### Что не делать

Не размечать всё в одной интерактивной сессии Opus. Не менять taxonomy во время прогона: сначала утверждение v0 пользователем, потом разметка, потом v1 по итогам gold set.

---

## Ограничения

1. Один snapshot. Все «новые» и rank-факты — состояние на 2026-09-16.
2. `members_count` не MAU, смысл метрики не установлен (BUILD-001).
3. Ранги `popular`/`popular_today` глубже нескольких сотен нестабильны. Везде используется лучший ранг на приложение.
4. Аудит — одна выборка одного исполнителя по первым 240 символам описания. Вердикты «unclear» не включены ни в TP, ни в FP. Интервалы recall широкие.
5. Retrieval-правила подобраны на этом же корпусе (утечка) — на следующем snapshot precision/recall могут быть ниже.
6. Описания часто содержат SEO-списки жанров. Это снижает precision любых keyword-методов.
