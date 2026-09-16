# TASK: BUILD-001 — VK Market Collector Phase 2

STATUS: DONE
TYPE: BUILD
SIZE: L
AGENT: Claude Opus
BASE_BRANCH: main
BRANCH: build/BUILD-001-vk-market-collector
START_SHA: 3605f86a4f5a4836a0bc5f71540964be7a24c90f
RESULT_SHA: af9ba58134c822166266177cd8145c43229cf5a9

## Что нужно сделать

Собрать воспроизводимый безопасный сборщик публичных данных VK Games, получить первый полный snapshot каталога и подготовить данные для дальнейшего анализа рынка Magic Arrow.

На этом этапе **не делать продуктовых выводов** про аудиторию, тему, roguelite или дизайн игры.

## Что уже подтверждено

Smoke test принят и влит в `main`:

- VK API `5.199`;
- service token работает;
- `utils.getServerTime`, `apps.getCatalog`, `apps.get`, `users.get`, `groups.getMembers` доступны;
- работают sort: `popular_today`, `popular_week`, `visitors`, `growth_rate`, `create_date`, `popular`;
- `apps.getCatalog extended=1` фактически не вернул MAU;
- безопасная скорость collector пока `<= 1 req/s`;
- `apps.get` возвращает `members_count`, но его смысл относительно UI-метрики «игроков» не доказан;
- официальный community id можно связать через `author_owner_id` и `groups[]`.

Контекст: `docs/VK-DATA-PLAN.md`, `docs/VK-API-SAFE-TEST.md`, `research/vk-api-smoke/**`, `tools/vk_api_smoke.py`.

## Этап 0 — калибровка `members_count`

До массового сбора взять 10–20 игр разных размеров и сравнить:

- видимое в публичной карточке VK число «игроков»;
- `apps.get.members_count`.

Сохранить `research/vk-market/metric-calibration.csv` и кратко описать методику.

Не объявлять метрики одинаковыми без устойчивого подтверждения. Если надёжно автоматизировать UI-число нельзя — допустима небольшая ручная выборка; не строить хрупкий scraper ради этого этапа.

## Этап 1 — полный discovery каталога

Через `apps.getCatalog` пройти с пагинацией все 6 подтверждённых сортировок:

- `popular_today`
- `popular_week`
- `visitors`
- `growth_rate`
- `create_date`
- `popular`

Требования:

- rate `<= 1 req/s`;
- dedupe по `app_id`;
- хранить sort, rank, offset/page и `catalog_position`, если есть;
- raw response не терять локально;
- checkpoint/resume обязателен;
- если 6 sort не дают полного покрытия, исследовать documented `genre_id` / `q` только настолько, насколько нужно для покрытия. Никаких undocumented обходов.

## Этап 2 — детали приложений

Для каждого уникального `app_id` получить `apps.get` metadata.

Сохранять фактически доступные поля, включая при наличии:

- id/title/type/section/genre/genre_id;
- description;
- published_date;
- catalog_position;
- members_count;
- author_owner_id / author_url;
- однозначный official community id из `groups[]`;
- support_url/webview_url;
- screen orientation/mobile support;
- icons/banners/screenshots URLs;
- relevant `is_*` flags.

Batch не предполагать. Если хочется использовать batch — сначала отдельный маленький безопасный тест.

## Хранение

Raw:

`artifacts/vk-market/<timestamp>/`

Только локально, ignored by Git, с redaction до записи.

Коммитимые результаты:

- `tools/vk_market/**`
- `research/vk-market/schema.md`
- `research/vk-market/metric-calibration.csv`
- `research/vk-market/snapshots/<UTC_DATE>/apps.csv`
- `research/vk-market/snapshots/<UTC_DATE>/rankings.csv`
- `research/vk-market/snapshots/<UTC_DATE>/summary.json`
- `research/vk-market/REPORT.md`

Если любой commit-ready data file >5 MB — остановиться и поставить `BLOCKED`, не выбирать новый формат самостоятельно.

## Персональные данные

В BUILD-001 **не делать массовый `groups.getMembers` и не собирать демографию пользователей**.

Разрешены только app/community-level публичные aggregate metadata. Демография будет отдельной задачей после shortlist.

## Надёжность

Collector должен:

- брать `VK_SERVICE_TOKEN` только из env;
- не выводить токен;
- использовать TLS verification через системное CA/truststore;
- timeout + bounded retry только для сетевых/5xx ошибок;
- не retry-spamить VK errors 6/29/32/HTTP 429;
- иметь rate limiter `<=1 req/s`;
- сохранять timestamp и API version;
- поддерживать resume/checkpoint;
- завершаться non-zero при фатальной ошибке.

## Можно менять

- `tools/vk_market/**`
- `research/vk-market/**`
- `.env.example` только для нового пустого параметра
- `.gitignore` только для защиты нового artifact path
- этот task-файл

## Не менять

- игровые/design документы
- `README.md`
- `.orchestra/BOARD.md`, `NOTES.md`, `RULES.md`, `PROJECT.md`
- `.env`
- unrelated files
- smoke-test raw artifacts

## Готово, если

- [x] `members_count` откалиброван осторожно;
- [x] все 6 sort пройдены с пагинацией;
- [x] unique apps сведены в snapshot;
- [x] app details собраны для discovery set либо покрытие/ошибки зафиксированы;
- [x] raw только в ignored artifacts;
- [x] нет user-level персональных данных в commit-ready files;
- [x] resume проверен;
- [x] rate <=1 req/s;
- [x] secret scan PASS;
- [x] `REPORT.md` описывает coverage, counts, missing fields, errors и ограничения без продуктовых выводов.

## Проверить

1. Маленький run: 1 страница каждой сортировки.
2. Проверка dedupe/ranking/redaction.
3. Проверка resume после искусственного прерывания.
4. Полный snapshot.
5. Проверка unique IDs, дублей и пропусков.
6. Проверка `.env` и `artifacts/`: ignored, not tracked.
7. Secret scan по diff, commit-ready files и local artifacts.
8. Финальный diff без токена, user-level raw data и unrelated changes.

## Когда остановиться

Поставить `STATUS: BLOCKED`, если:

- `START_SHA` нельзя воспроизвести;
- persistent auth/rate errors;
- нужен undocumented обход;
- понадобился массовый сбор пользователей;
- commit-ready файл >5 MB;
- обнаружена утечка токена;
- требуется решение пользователя о трактовке метрики.

Если найдена побочная проблема — записать в `FOUND`, но не исправлять вне задачи.

## Итог

RESULT:

- `tools/vk_market/`: сборщик `python -m tools.vk_market probe|collect|snapshot|verify|calibrate|scan`. Токен только из env, Bearer header, truststore TLS, лимитер 1.05 с между стартами запросов, retry только сеть/5xx (≤2), VK 6/29/32/429 — один cooldown-retry, затем fatal; 3/5/8/14/17/28 — fatal. Checkpoint = атомарный raw-файл на ответ, exit 3 при прерывании, exit 1 при фатальной ошибке.
- Snapshot `research/vk-market/snapshots/2026-09-16/`: 6/6 sort пройдены (по 51 странице), 29 852 строки `rankings.csv`, **4 985** уникальных app в `apps.csv` (2.12 MB), детали `apps.get` 4 985/4 985, официальное сообщество однозначно у 4 178; `summary.json`.
- Калибровка (`metric-calibration.csv`, 23 игры 1K–34M, ручная выборка с публичной https://vk.ru/games): `members_count` внутри интервала округления UI-метки «N игроков» в 23/23, ratio медиана 1.01. Совпадение с UI до округления, смысл метрики и равенство величин не доказаны; MAU в API нет.
- `REPORT.md`: coverage, counts, поля, ошибки, ограничения; `schema.md`: форматы и команды.
- Raw (локально, ignored): `artifacts/vk-market/20260916T163154Z/` (+ `probe-*`, `small-run-*`, `probe-stability-20260916`).

VERIFY:

1. Маленький run `--max-pages 1`: 6 запросов, 600 строк → 345 unique, ранги 1..100 — PASS.
2. Dedupe/ranking/redaction: `verify` — app_id уникальны, ids рейтинга ⊂ apps, ранги уникальны и внутри своей страницы, auth-ключей в raw params нет — PASS.
3. Resume: `--max-requests 40` → exit 3, сортировка не complete, повторный запуск продолжил с offset 4000; два реальных kill процесса также возобновились без `.tmp` — PASS.
4. Полный snapshot: 6/6 complete, details 4 985/4 985, missing 0 — PASS.
5. Unique/дубли/пропуски: дубли внутри сортировок (popular 1 529 строк, popular_today 906) и недостача ~45 id относительно `count` зафиксированы в `summary.json`/`REPORT.md`.
6. `.env`, `artifacts/`: ignored (`.gitignore:2`, `:7`), tracked 0 — PASS.
7. Secret scan (`python -m tools.vk_market scan` по artifacts/vk-market, artifacts/vk-api-smoke, tools/vk_market, research/vk-market, task-файл, git diff/status; 1 232 файла): SECRET SCAN: PASS.
8. Финальный diff: только `tools/vk_market/**`, `research/vk-market/**`, этот task-файл; нет `first_name/last_name/bdate/web_view_token/access_token`; все commit-ready файлы < 5 MB — PASS.
Rate: 1 146 запросов в run, min gap 1.05 с, 0 gap < 1 с, max 1 req в окне 1 с, HTTP 200 у всех, VK 6/29/32/429 — 0.

FOUND:

- `apps.get` принимает не больше 20 `app_ids` (VK error 100). Первая попытка с batch=100 ушла в одиночные запросы (202 шт.); исправлено: batch=20, ошибка batch теперь fatal.
- `apps.getCatalog genre_id` фактически не фильтрует: `count=5030` для всех 15 жанров, выдача смешанная. Первая попытка genre-pass успела сделать ~370 лишних запросов (≈7.4 прохода create_date, 0 новых id) до остановки; теперь сначала `count=1` probe.
- Покрытие 4 985 из `count` 5 029–5 030: короткие страницы (97–99 элементов) теряют ~46–54 строк на сортировку; документированного способа добрать ~45 id не найдено.
- Порядок глубоких страниц `popular`/`popular_today` меняется за минуты → повторы внутри сортировки; `rank` на глубине приблизителен.
- **Нужно решение пользователя:** полный `description` и URL изображений не помещаются в `apps.csv` (оценка >20 MB при лимите 5 MB). В commit — `description_len`, `screenshots_count`, флаги; полные данные только локально (`export/apps_full.csv`). Если тексты/URL нужны в Git для следующих задач — нужен отдельный формат/файл.
- `author_owner_id > 0` / `author_url` (807 apps) указывают на аккаунты пользователей-авторов; сохранено по списку полей задачи — на усмотрение архитектора.
- `is_in_catalog=1` только у 13 из 4 985 приложений, найденных в каталоге; `catalog_position` меняется во времени (совпадает с `apps.get` у 3 506 из 6 888 строк) — смысл полей не установлен.

Перед завершением:

1. поставить `STATUS: DONE`;
2. записать финальный commit в `RESULT_SHA`;
3. сделать финальный commit;
4. push task-ветки;
5. остановиться. Не merge в `main`.
