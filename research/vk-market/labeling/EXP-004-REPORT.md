# EXP-004 — массовая разметка рынка под Magic Arrow: REPORT

STATUS предложения: DONE (ожидает решения архитектора/пользователя).

## 1. Корпус (воспроизводимо)

`research/vk-market/labeling/labeling-corpus.csv` — **1665 уникальных app_id**,
сборка `python -m tools.vk_labeling build-corpus` (детерминирована):

| источник | размер |
|---|---|
| A. 10 обязательных buckets EXP-002 (unique) | 1185 |
| B. top-200 growth_rate | 200 |
| C. top-200 popular_today | 200 |
| D. top-100 popular_week | 100 |
| E. top-100 members среди puzzle-like (Puzzle/Three in a row), age ≤ 365d | 100 |
| union A–E | 1465 |
| F. control вне union, стратифицированно 100 puzzle-like + 100 остальных, seed=42 | 200 |
| **итого** | **1665** |

Puzzle-like = жанры EXP-002 `PUZZLE_GENRES` (Puzzle, Three in a row).
Ожидание task (1.3–1.7k) выполнено; лимит 2k не превышен.
Колонки corpus: только `app_id,source` (без description).

## 2. Разметка (semantic, моделью)

- 67 чанков по 25 (последний 15) в `artifacts/vk-labeling/chunks/` — локально, не коммитятся.
- Модель видела только `app_id/title/genre/description≤1500`; members/ranks/buckets скрыты.
- Размечено **1665/1665** строк, checkpoint/resume через `make-chunks --labels`.
- Правила: taxonomy-v0 + временные A1 (гайки/болты→`sort`+`screw`), A2 (zuma→`bubble_shooter`),
  A3 (collapse→`match3`); без подтверждения в title/description — `unknown`.
- `needs_review=yes`: **58 строк (3.5%)** — оставлены как есть для следующего review.
- Confidence mechanic: high 1229 / medium 407 / low 29.

## 3. Контроль качества — PASS

- Schema/enum/уникальность (`validate`): **PASS** (1665 строк, 0 missing, 0 extra).
- Blind repeat: sample **100 строк, seed=1234**, переразметка вслепую отдельным проходом:
  - `primary_mechanic` **100%** (порог 90%);
  - `primary_theme` 100%, `combat` 100%, `roguelite` 100%;
  - `arrow_tapaway` **100%** (порог 95%, в sample 3 yes + 97 no).
  - Детали: `research/vk-market/labeling/quality.json`.
- Все **35 строк `arrow_tapaway=yes`** проверены отдельным проходом + keyword-recall
  по `стрел|arrow|tap away|unpuzzle|распута|туда-сюда|змей|snake` (167 хитов корпуса):
  пропусков среди хитов нет (34 yes из хитов + 1 unpuzzle без ключевых слов).
- Control: **100 строк** вне обязательных buckets — пропущенных интересных механик нет:
  единственный arrow (51871737 Разбери Кубик) размечен; combat/roguelite/bosses
  в control принадлежат только non_puzzle-играм (шутеры/RPG/стратегии).

Пороги task (90% / 95%) пройдены → выводы строить можно.

## 4. Magic Arrow neighborhood — факты

Найдено **`arrow_tapaway=yes`: 35 игр**.

| признак | да | нет/unknown |
|---|---|---|
| combat=core/cosmetic | **0** | 35 none |
| external_targets | **1** (53992911, шредеры цветов) | 34 unknown |
| external_mobs_or_enemies | 0 | 35 unknown |
| bosses | 0 | 35 unknown |
| run_upgrades / roguelite | 0 / 0 | 35 no |
| projectile_continues_outside_board | **25** | 10 unknown |
| direction_is_resource | **33** | 2 unknown |
| board_rotation_or_direction_change | **7** | 28 unknown |

Частые комбинации: arrow+projectile+direction — 19; arrow+direction — 7;
arrow+direction+rotation+projectile — 4.

**Вывод-факт (не inference): в описаниях 35 arrow-игр нет ни одной с боем,
мобами, боссами, run-апгрейдами или roguelite. Формула Magic Arrow
(arrow + внешние цели/мобы + roguelite) в корпусе по описаниям не встречается
ни разу.** Отсутствие в описании ≠ отсутствие в игре (см. §6).

Крупнейшие arrow-игры (members_count — публичная метрика VK, не MAU):

| members | app | published | growth/today/week |
|---|---|---|---|
| 91709 | 54579291 Стрелки: Очисти поле | 2026-05-25 | 145/71/70 |
| 88702 | 51871737 Разбери Кубик | 2024-03-18 | 3265/—/747 |
| 72211 | 54579195 Стрелочки | 2026-05-07 | 761/438/398 |
| 41102 | 54184211 Сортируй Плитки | 2025-10-13 | 4512/569/769 |
| 37107 | 54184191 Лабиринт Стрелок Пазл | 2026-02-24 | 8/44/179 |
| 36042 | 54579601 Разбери Кубик 2026 | 2026-05-13 | 4927/517/1023 |
| 30553 | 54531151 Arrow Escape | 2026-04-13 | 1120/300/256 |
| 21922 | 54698383 Туда-Сюда: Распутай Рисунок | 2026-08-14 | 7/40/133 |

28 из 35 arrow-игр опубликованы ≤365 дней назад (молодая ниша);
среди свежих нет ни одной с ≥100k, две с ≥50k.
51871737 (2-е место) найдена только через control — keyword retrieval EXP-002 её пропустил
(в title/description нет слова «стрел»).

Ближайшие соседи (overlap ≥ 2 из 16 Magic Arrow-признаков): **53 игры** —
`research/vk-market/labeling/magic-arrow-neighbors.csv`
(overlap, members, growth/today/week, published, все 16 признаков).
Overlap 5: только 53992911 (67 members). Overlap 4: 4 arrow-игры.
19 не-arrow соседей: брейкеры с рикошетом (51523379, 52224498, 51596201),
бабл-шутеры с особыми шарами/боссами (51915770, 53582095, 54051411, 54407509, 54734586),
рикошет-шутеры (51718605, 51863326, 53339067), Love Archer (51858139),
Tank Stars (54214882), Избушка-рогалик (54174583), Synergrid-рогалик (54699415),
футбол-матчинг (54728035).

## 5. Рынок простых механик (факты по разметке корпуса)

`research/vk-market/labeling/mechanic-market.csv`:
n; median/p75/p90 members; свежие ≤365d (n, median, p90, ≥50k, ≥100k);
top100/200 growth_rate и popular_today.

| mechanic | n | median | p90 | fresh≤365 | fresh median/p90 | fresh≥50k/100k | growth200 | today200 |
|---|---|---|---|---|---|---|---|---|
| non_puzzle | 337 | 22756 | 837500 | 103 | 3389/28289 | 5/1 | 96 | 100 |
| merge | 263 | 3881 | 78091 | 89 | 1957/14031 | 3/2 | 14 | 18 |
| match3 | 226 | 11156 | 248920 | 52 | 3296/30614 | 2/2 | 13 | 24 |
| other_puzzle | 222 | 6024 | 75135 | 65 | 2682/7747 | 2/1 | 12 | 7 |
| sort | 125 | 4216 | 70871 | 49 | 3169/57962 | 5/2 | 7 | 5 |
| tile_match | 88 | 6826 | 23645 | 34 | 4001/16176 | 1/0 | 3 | 2 |
| tabletop | 73 | 45662 | 1368893 | 19 | 2059/15632 | 1/1 | 24 | 21 |
| hidden_object | 59 | 12751 | 48471 | 16 | 5604/22175 | 1/0 | 6 | 3 |
| word | 48 | 10184 | 19904 | 20 | 4300/18079 | 0/0 | 7 | 5 |
| bubble_shooter | 45 | 14074 | 52888 | 8 | 3546/5542 | 0/0 | 0 | 2 |
| picture_reveal | 37 | 5733 | 20047 | 13 | 5733/25281 | 1/0 | 4 | 2 |
| arrow_tapaway | 35 | 3514 | 41102 | 28 | 2944/41102 | 2/0 | 4 | 4 |
| quiz_trivia | 34 | 38054 | 331226 | 7 | 4403/8599 | 0/0 | 3 | 2 |
| block_hexa | 26 | 7653 | 90545 | 7 | 841/9616 | 0/0 | 4 | 0 |
| screw | 19 | 17419 | 39106 | 8 | 3128/38191 | 0/0 | 0 | 1 |
| unknown | 28 | 13036 | 79714 | 4 | — | 0/0 | 3 | 4 |

Факты без субъективных оценок: самый массовый свежий приток — merge (89) и
other_puzzle (65); свежие ≥100k есть только у merge (2), match3 (2), sort (2),
non_puzzle (1), tabletop (1). Arrow-ниша мала по members, но на 80% свежая.
Плотность конкурентов и таблицы — в CSV; «лучшая механика» здесь не выбирается.

## 6. Ограничения (факты отделены от inference)

- Разметка только по title/genre/description≤1500; скриншоты и интернет не использовались.
- `unknown` означает «не подтверждено описанием», а не «механики нет».
- members_count — публичная метрика VK («игроков» в UI), не MAU.
- ranks — лучшие (минимальные) ранги из снапшота 2026-09-16.
- 58 строк needs_review оставлены без догадок для следующего review.

## 7. Outputs

- `tools/vk_labeling/**` — build-corpus, make-chunks, validate, quality, analytics (без внешних API).
- `research/vk-market/labeling/labeling-corpus.csv` (1665; app_id+source).
- `research/vk-market/labeling/muse-labels.csv` (1665 строк, 29 колонок).
- `research/vk-market/labeling/quality.json` (agreement 100%/100%, PASS).
- `research/vk-market/labeling/magic-arrow-neighbors.csv` (53).
- `research/vk-market/labeling/mechanic-market.csv` (16).
- Этот отчёт.
- Не коммитится: chunks/descriptions, DuckDB/Parquet, checkpoints, raw API, secrets.
