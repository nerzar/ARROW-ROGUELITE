# TASK: EXP-004 — массовая разметка рынка под Magic Arrow

STATUS: READY
TYPE: EXP
SIZE: L
AGENT: Muse Spark 1.3
BASE_BRANCH: main
BRANCH: exp/EXP-004-magic-arrow-market-labeling
START_SHA: 94aca1411204fc802645bf9cd88b00c1ab05015c
RESULT_SHA:

## Зачем

Magic Arrow сейчас основной рабочий продуктовый трек: Tap Away / Arrow puzzle, где освобождённые стрелы продолжают полёт и взаимодействуют с целями/мобами вокруг поля, поверх этого — run/roguelite слой.

Эта задача не выбирает игру заново. Она даёт количественную карту рынка для двух целей:

1. понять плотность и ближайших соседей Magic Arrow;
2. одновременно не потерять другие простые механики, которые могут оказаться хорошими кандидатами для отдельного быстрого коммерческого клона/эксперимента.

Под «клоном» здесь понимается самостоятельная реализация механики/формулы: без копирования чужого кода, ассетов, текстов, брендинга или UI один-в-один.

## Входы

EXP-002 принят и влит в main.

Главные файлы:
- `research/vk-market/analysis/candidate-set.csv`;
- `research/vk-market/analysis/taxonomy-v0.md`;
- `research/vk-market/analysis/market-baseline.json`;
- `research/vk-market/snapshots/2026-09-16/apps.csv`;
- `research/vk-market/snapshots/2026-09-16/rankings.csv`;
- локально: `artifacts/vk-market/20260916T163154Z/export/apps_full.csv`;
- локально: `artifacts/vk-analytics/magic-arrow.duckdb` (если есть; при отсутствии пересобрать существующей командой).

`members_count` не называть MAU. Это публичная метрика VK, совпавшая с UI-меткой «игроков» в пределах округления на тестовой выборке; точный смысл не установлен.

## Корпус для разметки

Не нужно размечать весь каталог только ради числа строк.

Собрать `labeling-corpus.csv` как union с dedupe по `app_id`:

1. все уникальные приложения из 10 обязательных candidate buckets EXP-002;
2. top 200 `growth_rate`;
3. top 200 `popular_today`;
4. top 100 `popular_week`;
5. 100 самых крупных по `members_count` среди puzzle-подобных игр, опубликованных за последние 365 дней;
6. контроль: 200 случайных приложений вне получившегося union, стратифицированно — 100 puzzle-подобных + 100 остальных жанров, фиксированный seed.

Ожидается примерно 1.3–1.7k уникальных приложений. Если получилось заметно больше 2k — остановиться и записать причину в FOUND, не расширять корпус дальше.

## Что видит модель при разметке

Для честной семантической разметки использовать только:
- `app_id`;
- `title`;
- `genre`;
- `description` максимум 1500 символов.

Не показывать модели:
- `members_count`;
- ranks;
- candidate bucket;
- причины keyword retrieval;
- название текущего продукта Magic Arrow как подсказку «что искать» внутри конкретной строки.

Эти поля присоединяются обратно только после разметки.

## Как работать Muse

Это именно semantic labeling моделью, а не ещё один keyword classifier.

1. Подготовить локальные chunks по 20–30 приложений в `artifacts/vk-labeling/chunks/`.
2. Обрабатывать chunks последовательно, не загружая весь корпус в контекст сразу.
3. После каждого chunk атомарно сохранять результат/checkpoint.
4. При возобновлении не переразмечать уже готовые `app_id`.
5. Не придумывать признаки, которых нет в title/description. Если данных не хватает — `unknown`.
6. Не ходить в интернет и не анализировать screenshots в этой задаче.

## Поля разметки

Для каждой игры вернуть одну строку с полями:

### Общая taxonomy

- `app_id`
- `primary_mechanic`
- `secondary_mechanics` — `|`-separated
- `primary_theme`
- `secondary_themes` — `|`-separated
- `combat` = `none|cosmetic|core|unknown`
- `roguelite` = `yes|no|unknown`
- `meta_layer` = `none|renovation_story|collection|rpg_progression|pvp_tournament|idle_economy|other|unknown`

### Признаки, важные именно для Magic Arrow

- `arrow_tapaway` = `yes|no|unknown`
- `projectile_continues_outside_board` = `yes|no|unknown`
- `external_targets` = `yes|no|unknown`
- `external_mobs_or_enemies` = `yes|no|unknown`
- `bosses` = `yes|no|unknown`
- `direction_is_resource` = `yes|no|unknown`
- `board_rotation_or_direction_change` = `yes|no|unknown`
- `temporary_targets_or_move_windows` = `yes|no|unknown`
- `run_upgrades` = `yes|no|unknown`
- `choose_one_of_three` = `yes|no|unknown`
- `projectile_modifiers` = `yes|no|unknown`
- `ricochet` = `yes|no|unknown`
- `pierce` = `yes|no|unknown`
- `split_or_multishot` = `yes|no|unknown`
- `chain_or_bounce` = `yes|no|unknown`
- `elemental_effects` = `yes|no|unknown`

### Качество вывода

- `confidence_mechanic` = `high|medium|low`
- `confidence_theme` = `high|medium|low`
- `confidence_magic_arrow_features` = `high|medium|low`
- `needs_review` = `yes|no`
- `evidence` — очень короткое основание из description/title, до 160 символов; не переписывать описание целиком.

## Taxonomy: временные правила только для этой аналитики

Чтобы задача не блокировалась на старых спорных границах:

- гайки/болты с сортировкой по цветам: `primary=sort`, `secondary` может содержать `screw`;
- Zuma/marble: `bubble_shooter`, secondary/tag `marble_zuma` если схема это позволяет;
- collapse/blast: `match3`, secondary/tag `collapse_blast` если схема это позволяет.

Это рабочая нормализация для исследования, а не принятые продуктовые решения.

## Контроль качества

После основной разметки:

1. проверить schema/enum/уникальность `app_id`;
2. случайно выбрать 100 строк из размеченного корпуса и повторно классифицировать их вслепую отдельным проходом Muse;
3. посчитать agreement по `primary_mechanic`, `primary_theme`, `combat`, `roguelite`, `arrow_tapaway`;
4. отдельно проверить все строки `arrow_tapaway=yes`;
5. все `needs_review=yes` не исправлять догадкой — оставить для следующего review;
6. проверить минимум 100 control-строк вне исходных candidate buckets на пропущенные интересные механики.

Если agreement по `primary_mechanic` < 90% или по `arrow_tapaway` < 95% — STATUS: BLOCKED и не строить окончательные выводы.

## Аналитика после разметки

Присоединить labels обратно к VK данным через DuckDB/SQL.

Собрать факты минимум по:

### Magic Arrow neighborhood

- сколько `arrow_tapaway` игр найдено;
- сколько из них имеют `combat=core/cosmetic`;
- сколько явно имеют внешние цели/мобов;
- сколько имеют bosses / run upgrades / roguelite;
- сколько подтверждают продолжение projectile за пределами board;
- какие комбинации признаков встречаются вместе;
- список всех игр, где overlap с Magic Arrow признаками >= 2, с датой публикации, `members_count`, `growth_rate`, `popular_today`, `popular_week`.

Не объявлять отсутствие поля в описании доказательством отсутствия механики — для слабого описания использовать unknown.

### Рынок простых клонов/экспериментов

По основным puzzle mechanics посчитать:
- количество игр;
- median / p75 / p90 `members_count`;
- сколько опубликовано <=365 дней;
- среди свежих: median / p90 `members_count`;
- сколько свежих имеют >=50k и >=100k `members_count`;
- присутствие в top100/top200 `growth_rate` и `popular_today`;
- плотность конкурентов.

Нужен фактический сравнительный отчёт, а не субъективное «это лучшая механика».

## Outputs

Коммитить:

- `tools/vk_labeling/**` — подготовка corpus, валидация, join/analytics; без обращения к внешнему LLM API;
- `research/vk-market/labeling/labeling-corpus.csv` — без полного description, только app_id + источник включения;
- `research/vk-market/labeling/muse-labels.csv`;
- `research/vk-market/labeling/quality.json`;
- `research/vk-market/labeling/magic-arrow-neighbors.csv`;
- `research/vk-market/labeling/mechanic-market.csv`;
- `research/vk-market/labeling/EXP-004-REPORT.md`.

Не коммитить:
- chunks с полными descriptions;
- DuckDB/Parquet;
- временные checkpoints с полным текстом;
- raw API data;
- secrets.

## Можно менять

- `tools/vk_labeling/**`
- `research/vk-market/labeling/**`
- этот task-файл

## Не менять

- игровой код;
- `docs/FIRST-RUN-HYPOTHESIS.md`;
- `docs/CONTENT-SYSTEM.md`;
- другие design docs;
- collector BUILD-001;
- analytics EXP-002;
- `.orchestra/BOARD.md`, `RULES.md`, `PROJECT.md`, `NOTES.md`;
- `.env`.

## Готово, если

- [ ] corpus воспроизводим и размер объяснён;
- [ ] все строки corpus получили label или явный error/unknown;
- [ ] checkpoint/resume работает;
- [ ] schema validation PASS;
- [ ] blind repeat quality check выполнен;
- [ ] `arrow_tapaway=yes` проверены отдельно;
- [ ] построены Magic Arrow neighbors;
- [ ] построена сравнительная таблица mechanics;
- [ ] факты отделены от inference/unknown;
- [ ] secret scan PASS;
- [ ] нет изменений design/game файлов.

## Финал

Заполнить `RESULT`, `VERIFY`, `FOUND`, поставить `STATUS: DONE` или `BLOCKED`, записать `RESULT_SHA`, commit + push этой же ветки. Не merge в main. Остановиться.

RESULT:

VERIFY:

FOUND:
