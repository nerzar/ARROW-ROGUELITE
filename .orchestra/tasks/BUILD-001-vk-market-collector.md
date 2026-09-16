# TASK: BUILD-001 — VK Market Collector Phase 2

STATUS: READY
TYPE: BUILD
SIZE: L
AGENT: Claude Opus
BASE_BRANCH: main
BRANCH: build/BUILD-001-vk-market-collector
START_SHA: 3605f86a4f5a4836a0bc5f71540964be7a24c90f
RESULT_SHA:

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

- [ ] `members_count` откалиброван осторожно;
- [ ] все 6 sort пройдены с пагинацией;
- [ ] unique apps сведены в snapshot;
- [ ] app details собраны для discovery set либо покрытие/ошибки зафиксированы;
- [ ] raw только в ignored artifacts;
- [ ] нет user-level персональных данных в commit-ready files;
- [ ] resume проверен;
- [ ] rate <=1 req/s;
- [ ] secret scan PASS;
- [ ] `REPORT.md` описывает coverage, counts, missing fields, errors и ограничения без продуктовых выводов.

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

VERIFY:

FOUND:

Перед завершением:

1. поставить `STATUS: DONE`;
2. записать финальный commit в `RESULT_SHA`;
3. сделать финальный commit;
4. push task-ветки;
5. остановиться. Не merge в `main`.
