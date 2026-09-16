# TASK: BUILD-001 — VK Market Collector Phase 2

STATUS: BLOCKED
TYPE: BUILD
SIZE: L
AGENT: Claude Opus
BASE_BRANCH: main
BRANCH: build/BUILD-001-vk-market-collector
START_SHA: TBD after accepted smoke-test commit is integrated into main
RESULT_SHA:

## Что нужно сделать

Собрать воспроизводимый безопасный сборщик публичных данных VK Games, получить первый полный snapshot каталога и подготовить данные для последующего анализа рынка Magic Arrow. На этом этапе **не делать продуктовых выводов** про аудиторию, тему или дизайн игры.

## Зависимость

Перед стартом accepted smoke-test commit `c603241` из локальной ветки `vk-api-smoke-test` должен быть доступен на remote и интегрирован в базу задачи вместе с orchestration files.

Пока `START_SHA` не заполнен архитектором — задачу не начинать.

## Что важно знать

Подтверждено smoke test:
- VK API version `5.199`;
- service token работает;
- `utils.getServerTime`, `apps.getCatalog`, `apps.get`, `users.get`, `groups.getMembers` доступны;
- сортировки `popular_today`, `popular_week`, `visitors`, `growth_rate`, `create_date`, `popular` работают;
- `apps.getCatalog extended=1` фактически не вернул MAU;
- safe collector rate пока ограничен `<= 1 req/s`;
- `apps.get` даёт `members_count`, но его смысл относительно UI-метрики «игроков» ещё не доказан;
- приложение можно связать с официальным сообществом через `author_owner_id` и `groups[]`.

Использовать `docs/VK-DATA-PLAN.md`, `docs/VK-API-SAFE-TEST.md` и результаты smoke test как источник контекста. Не перечитывать весь проект без необходимости.

## Этап 0 — калибровка метрик

До массового сбора проверить, что означает `members_count` в `apps.get`.

Нужно:
- взять разумную выборку 10–20 игр разных размеров из публичного каталога;
- для каждой записать видимую в VK карточке метрику «игроков» и `apps.get.members_count`;
- сравнить значения;
- не объявлять их одной метрикой только по сходству пары примеров;
- если точное соответствие/формула не подтверждаются — пометить `members_count` как отдельную API-метрику с неизвестной/ограниченной интерпретацией;
- сохранить краткий `metric-calibration.csv` и описание методики без персональных данных.

Если публичная карточка не позволяет надёжно автоматизировать чтение числа — допустима ручная выборка через браузер. Не строить хрупкий scraper только ради этого этапа.

## Этап 1 — discovery полного каталога

Через `apps.getCatalog` собрать выдачи всех подтверждённых сортировок:
- `popular_today`;
- `popular_week`;
- `visitors`;
- `growth_rate`;
- `create_date`;
- `popular`.

Требования:
- пагинация до конца каждой доступной выдачи;
- использовать максимально безопасный подтверждённый `count`, не превышая фактические ограничения API;
- rate `<= 1 req/s`;
- dedupe по `app_id`;
- для каждого появления хранить sort, rank, offset/page и `catalog_position`, если поле есть;
- unknown fields не терять в raw artifact;
- при ошибке запрос должен быть воспроизводим и collector должен уметь продолжить без повторного полного сбора.

Если разные sort не дают полный каталог, исследовать доступные `genre_id` / поисковые способы только настолько, насколько нужно для покрытия каталога. Не придумывать undocumented обходы и не скрейпить приватные поверхности.

## Этап 2 — детали приложений

Для каждого уникального `app_id` получить `apps.get` metadata безопасным способом.

Собирать фактически доступные поля, включая при наличии:
- id/title/type/section/genre/genre_id;
- description;
- published_date;
- catalog_position;
- members_count;
- author_owner_id / author_url;
- `groups[]` и однозначный official community id;
- support_url/webview_url;
- screen orientation/mobile support;
- icons/banners/screenshots URLs;
- relevant `is_*` flags.

Если API поддерживает безопасный batch — можно использовать его после отдельной маленькой проверки. Не предполагать batch без проверки.

## Этап 3 — хранение

Raw ответы:
- только локально под `artifacts/vk-market/<timestamp>/`;
- directory ignored by Git;
- token redaction до записи;
- не коммитить raw API dumps.

Воспроизводимые/коммитимые результаты:
- `tools/vk_market/...` — collector и helpers;
- `research/vk-market/schema.md` — фактическая схема нормализованных данных;
- `research/vk-market/metric-calibration.csv`;
- `research/vk-market/snapshots/<UTC_DATE>/apps.csv` — один row на app, если размер разумный;
- `research/vk-market/snapshots/<UTC_DATE>/rankings.csv` — app × sort × rank;
- `research/vk-market/snapshots/<UTC_DATE>/summary.json`;
- `research/vk-market/REPORT.md` — методика, покрытие, ошибки/ограничения, **без продуктовых выводов**.

Если любой commit-ready data file >5 MB, остановиться перед commit и записать `BLOCKED`/`FOUND` с предложением формата хранения. Не тащить большие dumps в Git самовольно.

## Персональные данные

В BUILD-001 не делать массовый `groups.getMembers` и не собирать демографию пользователей.

Разрешено только сохранить official community id и публичные aggregate app/community metadata, которые приходят через app-level методы.

Демографию официальных сообществ будем собирать отдельной задачей после того, как появится релевантный shortlist игр. Это уменьшает объём запросов и не создаёт ненужный user-level dataset.

## Надёжность

Collector должен:
- брать `VK_SERVICE_TOKEN` только из env;
- не выводить токен;
- использовать TLS verification через системное CA/truststore;
- иметь timeout и bounded retry для сетевых/5xx ошибок;
- не retry-spamить VK errors 6/29/32/HTTP 429;
- иметь rate limiter `<= 1 req/s`;
- писать sanitized request metadata;
- сохранять timestamp и API version;
- поддерживать resume/checkpoint;
- не хранить user access tokens;
- завершаться понятным non-zero exit code при фатальной ошибке.

## Можно менять

- `tools/vk_market/**`;
- `research/vk-market/**`;
- `.env.example`, только если нужен новый пустой параметр;
- `.gitignore`, только если нужно защитить новый локальный artifact path;
- этот task-файл.

## Не менять

- игровые/design документы;
- `README.md`, кроме отдельного согласования;
- `.orchestra/BOARD.md`, `NOTES.md`, `RULES.md`, `PROJECT.md`;
- unrelated files;
- `.env`;
- smoke-test raw artifacts.

## Готово, если

- [ ] калибровка `members_count` выполнена и её интерпретация сформулирована осторожно;
- [ ] все 6 подтверждённых sort пройдены с пагинацией;
- [ ] уникальные приложения сведены в нормализованный snapshot;
- [ ] app details получены для discovery set либо чётко зафиксировано покрытие/ошибки;
- [ ] raw данные остаются только в ignored artifacts;
- [ ] commit-ready CSV/JSON не содержат user-level персональных данных;
- [ ] collector умеет resume;
- [ ] rate <=1 req/s;
- [ ] secret scan PASS;
- [ ] отчёт сообщает coverage, counts, missing fields, errors и ограничения, но не решает за пользователя тему/аудиторию Magic Arrow.

## Проверить

1. Запустить unit/small fixture tests для парсинга, dedupe, ranking и redaction, если они добавлены.
2. Выполнить маленький dry/smoke run на 1 странице каждой сортировки.
3. Проверить resume на искусственно прерванном локальном run.
4. Выполнить полный snapshot.
5. Проверить количество уникальных app ids, дублей и пропусков.
6. Проверить, что `.env` и `artifacts/` ignored и не tracked.
7. Secret scan по diff + commit-ready files + local artifacts.
8. `git diff --cached`/final diff не должен содержать токен, raw user data или unrelated changes.

## Когда остановиться

Поставить `STATUS: BLOCKED`, если:
- start SHA не совпадает;
- API начинает давать persistent rate/auth errors;
- для полного каталога нужен undocumented обход;
- задача требует массового сбора пользователей;
- commit-ready dataset превышает 5 MB и нужен выбор формата;
- обнаружена утечка токена;
- требуется решение пользователя о том, какую метрику считать «игроками».

## Итог

RESULT:

VERIFY:

FOUND:

Перед завершением поставить `STATUS: DONE`, записать `RESULT_SHA`, сделать финальный commit и остановиться. Не merge в `main`.
