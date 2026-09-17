# TASK: MKT-001 — демография официальных сообществ shortlist

STATUS: DONE
TYPE: MKT
SIZE: M
AGENT: Muse Spark 1.3
BASE_BRANCH: main
BRANCH: mkt/MKT-001-community-demography
START_SHA: 1e0df22e5304132ecf7b4ec9151ee63cbe13b8dd
RESULT_SHA:

## Зачем

Получить аккуратный demographic proxy по официальным VK-сообществам игр из коммерческого shortlist EXP-003.

Это **не демография игроков** и не основание автоматически выбирать аудиторию/тему. Члены официального сообщества — отдельная, самоотобранная группа. Нужно измерить её состав и coverage, чтобы понять, есть ли заметные различия между Arrow / Sort / Merge / Match-3 референсами и насколько вообще этот proxy пригоден.

## Входы

Приняты и находятся в `main`:
- `research/vk-market/reference-audit/EXP-003-REPORT.md`;
- `research/vk-market/reference-audit/shortlist.csv`;
- `research/vk-market/reference-audit/games.csv`;
- snapshot BUILD-001 / EXP-002 / EXP-004.

Shortlist сообществ из EXP-003:
1. `club236576213` — Яга: Зелья судьбы;
2. `club233302675` — Гранд Тур;
3. `club240373000` — Стрелки: Очисти поле;
4. `club225055876` — Разбери Кубик;
5. `club233439912` — Болты и гайки;
6. `club234333127` — Тропиквиль;
7. `club232830008` — Мир Слияния;
8. `club236123415` — Tap Gallery;
9. `club237611414` — Разбери Стрелочки;
10. `club235802722` — Мой Замок;
11. `club215368653` — GidKap;
12. `club240707160` — Туда-Сюда.

Перед сбором проверить связь `group_id ↔ app_id/game/mechanic` по существующим данным. Не угадывать связь по названию, если она не подтверждается.

## Безопасность / приватность

- Использовать локальный `.env`; `VK_SERVICE_TOKEN` не печатать и не коммитить.
- API version — та же, что используется текущим collector, если фактический ответ не требует другого.
- Rate limit: не быстрее 1 req/s.
- Не отключать TLS verification.
- **Не коммитить и не сохранять в research raw user IDs, имена, даты рождения или user-level rows.**
- Обрабатывать страницы потоково: получил страницу → обновил агрегаты → отбросил individual records.
- Если временный локальный checkpoint с user-level rows всё же технически необходим, он должен быть только под `artifacts/`, gitignored, и удалён до финала. Предпочтительно вообще не создавать его.
- В итогах по городам/возрастным срезам не публиковать ячейки `<20`; объединять их в `other/suppressed`.

## Что собрать

Для каждой из 12 подтверждённых групп через фактический VK API:

### База
- `group_id`;
- game/app mapping + mechanic;
- public group member count на момент capture;
- сколько membership records удалось пройти;
- timestamp UTC;
- статус: complete / partial / inaccessible;
- ошибки VK API, если были.

### Sex proxy
Поле `sex` считать только как публичное поле VK:
- female;
- male;
- unspecified/other API value;
- coverage = доля records с определённым значением.

Не интерпретировать это как пол всех игроков.

### Age proxy
Использовать `bdate` **только если присутствует год рождения**.
Возраст считать на дату capture. Не восстанавливать год по косвенным данным.

Агрегировать в buckets:
- `<18`;
- `18–24`;
- `25–34`;
- `35–44`;
- `45–54`;
- `55+`.

Обязательно отдельно показать:
- `age_year_coverage`;
- unknown/no-year;
- suppression для ячеек `<20`.

### Geography proxy
`city` использовать только как публичный city field, если он реально присутствует.
- coverage;
- top cities только при `n >= 20`;
- остальные объединять в `other/suppressed`.

`country` не ожидать: в smoke-test поле отсутствовало. Если оно внезапно появится — зафиксировать как FOUND, но не делать task зависимой от него.

## Полнота выборки

Цель — полный проход доступных public members для каждой группы, если это практически разумно.

Если конкретная группа слишком велика или API/лимиты делают полный проход неоправданным:
- не брать первые N как будто это случайная выборка;
- поставить `STATUS: PARTIAL` для этой группы;
- зафиксировать фактический метод и размер охвата;
- не смешивать partial и complete без явной метки.

Не превышать разумный объём запросов ради нескольких процентов покрытия. При необходимости остановиться и записать FOUND.

## Сравнение

После сбора построить две таблицы.

### 1. По сообществам
Минимум:
- group/game/mechanic;
- group members;
- app `members_count` из snapshot (публичная VK-метрика, **не MAU**);
- отношение `group_members / app_members_count` как описательный показатель, **не conversion rate**;
- sex shares + coverage;
- age bucket shares + year coverage;
- city coverage;
- capture completeness.

### 2. По механикам
Свести только там, где есть достаточно групп/данных:
- Arrow;
- Sort;
- Merge;
- Match-3 / hybrid, если корректно маппится.

Показывать:
- число групп;
- суммарное число доступных public members;
- pooled sex shares;
- pooled age shares;
- coverage.

Не делать вывод «механика X для женщин/мужчин/возраста Y» без оговорки, что это community proxy и группы различаются по размеру/активности/возрасту.

## Контроль качества

1. Проверить все 12 group IDs и mapping evidence.
2. Row-level данных в committed files быть не должно.
3. Суммы агрегатов должны сходиться с обработанным количеством records с учётом unknown/suppressed.
4. Повторный запуск не должен дублировать агрегаты.
5. Rate-limit log: минимум интервала >=1.0 s между API requests.
6. Secret scan.
7. Проверить final diff: никакого игрового кода/design docs.

## Outputs

Коммитить только агрегаты/код:
- `tools/vk_demography/**` — collector/aggregator/verify без внешних LLM API;
- `research/vk-market/demography/community-demography.csv`;
- `research/vk-market/demography/mechanic-demography.csv`;
- `research/vk-market/demography/MKT-001-REPORT.md`;
- при необходимости маленький `method.json`/`coverage.json`.

Не коммитить:
- raw API responses с пользователями;
- user ids/names/bdates;
- `.env`;
- DuckDB с user-level rows;
- temporary checkpoints с персональными данными.

## Можно менять

- `tools/vk_demography/**`;
- `research/vk-market/demography/**`;
- этот task-файл.

## Не менять

- игровой код;
- design docs;
- BUILD-001 collector outputs;
- EXP-002/003/004 research outputs;
- `.orchestra/BOARD.md`, `RULES.md`, `PROJECT.md`, `NOTES.md`;
- `.env`.

## Готово, если

- [x] mapping 12 групп проверен и documented;
- [x] доступные memberships обработаны агрегированно;
- [x] нет committed user-level данных;
- [x] sex/age/city coverage посчитан;
- [x] small cells suppressed;
- [x] community table готова;
- [x] mechanic table готова или честно объяснено, почему aggregation слабая;
- [x] community proxy явно не назван player demographics;
- [x] rate / TLS / secrets / diff checks PASS;
- [x] RESULT / VERIFY / FOUND заполнены;
- [x] STATUS: DONE или BLOCKED;
- [ ] RESULT_SHA записан;
- [ ] commit + push этой же ветки;
- [ ] без merge в main;
- [ ] остановиться.

## Когда остановиться

Поставить `STATUS: BLOCKED`, если:
- service token перестал давать `groups.getMembers`;
- mapping official communities не удаётся подтвердить для существенной части shortlist;
- выполнение требует сохранять/коммитить user-level персональные данные;
- API ведёт себя так, что нельзя честно оценить coverage;
- задача начинает менять продуктовые решения Magic Arrow.

## RESULT

Работа велась в отдельном git worktree (общий каталог был занят другой веткой);
START_SHA `1e0df22` подтверждён как родитель коммита ветки `e0e78ea`.

Подтверждено 12/12 групп (все открытые, официальная связь доказана через
`apps.get author_owner_id == -group_id` для каждой). Memberships обработано: 2739
records в 9 группах со статусом complete; 3 мельчайшие группы (6/9/3 участника)
API-недоступны (`groups.getMembers` → VK error 15, детерминировано при повторе).
Потоковая агрегация: страница → счётчики → discard; user-level данные не писались
на диск и не коммитились.

Агрегаты (community demographic proxy, НЕ player demographics):
- sex coverage 1.0 везде; пулы: sort 80.6% F (1169/1450), merge 82.3% F (386/469),
  match3 55.2% F (403/730, в основном Гранд Тур), arrow 70.0% F (63/90, одна группа).
- age-year coverage 0.27–0.62 (пулы 0.44–0.62); ядро с годом — 25–44 (sort/match3),
  25–55+ (merge); arrow-точка 55+ 66% при n=56.
- city coverage 0.60–0.87; города n≥20 только в двух крупнейших группах
  (Moscow/SPb первые); country не встречено ни разу.
- Сообщества = 0.01–1% app-аудиторий (`group/app` описательное, не conversion).

Пригодность proxy: грубый ориентир по sex-составу активных сообществ с оговорками;
по возрасту слабый (coverage <50%); по географии почти неинформативен; arrow-lane
держится на одной группе (n=90). Для выбора аудитории/темы — вспомогательный фон,
не основание.

Outputs: `research/vk-market/demography/community-demography.csv`,
`mechanic-demography.csv`, `method.json`, `MKT-001-REPORT.md`;
код: `tools/vk_demography/collect.py`, `verify.py`.

## VERIFY

`python tools/vk_demography/verify.py` — ALL PASS (10/10): coverage-12-groups,
sums-sex-age-reconcile (12 строк), suppression-small-cells (нет ячеек 1–19),
mechanic-pool-sums (4 lane), rate-min-interval (26 запросов, min gap 1.05 s ≥ 1.0 s),
no-user-level-keys, no-player-demographics-wording, secret-scan (токен/фрагменты
отсутствуют), diff-scope (только разрешённые пути), mapping-official (12/12).
TLS verification включён (truststore), user-level rows в Git нет.

## FOUND

- F1: `groups.getMembers` → VK error 15 (access denied) для 240373000 / 215368653 /
  240707160 — все без кастомного screen_name, все мельчайшие (6/9/3).
- F2: поле `country` отсутствует полностью (n=2739) — smoke-гипотеза подтвердилась.
- F3: поле `sex` заполнено у 100% обработанных записей.
- F4: 233439912 («Фабрика игр») и 215368653 («Игры GidKap») — dev-группы, состав шире
  одной игры; учтено в отчёте, пулы не чистились.
- F5: «Сказка 2026» принадлежит группе 233460848 (вне shortlist) — зафиксировано
  в `method.json`, не покрыта.
