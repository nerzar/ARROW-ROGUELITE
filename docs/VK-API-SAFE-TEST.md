# VK API Safe Smoke Test — ТЗ для агента

Дата: 2026-09-16

Цель: безопасно проверить сервисный токен VK API, доступные методы, фактические поля ответов и мягкие лимиты запросов. Никакого массового сбора данных на этом этапе.

## 0. Жёсткие ограничения

1. **Не коммитить токен ни при каких обстоятельствах.**
2. Токен брать только из переменной окружения `VK_SERVICE_TOKEN`.
3. Не печатать токен в stdout/stderr, логах, traceback, отчётах, URL или JSON.
4. Не использовать `curl -v`, shell `set -x`, debug HTTP logging или любые режимы, которые могут вывести заголовок Authorization.
5. Отправлять токен в заголовке `Authorization: Bearer <token>`, а не в query string.
6. Перед сохранением любого request metadata и error payload запускать redaction: удалить значения полей/заголовков `Authorization`, `access_token`, `token`, `VK_SERVICE_TOKEN` и любые точные совпадения со значением токена.
7. Если токен хоть один раз появился в логе/файле — немедленно остановиться, удалить артефакт, сообщить пользователю, токен считать скомпрометированным и рекомендовать перевыпуск.
8. Не вызывать методы, которые что-то меняют: никаких send/add/edit/delete/ban/request/notify и т.п.
9. Не собирать массово пользователей/сообщества. На этом этапе только smoke test.
10. Не делать выводы о доступности метода по документации בלבד — проверить фактическим API-вызовом.
11. Не пытаться обходить ограничения API, CAPTCHA, permissions, rate limit или авторизацию.
12. Не менять игровые/дизайн-документы проекта. Разрешено добавить только код smoke test, `.env.example`, `.gitignore` и отчёт о тесте.

## 1. Среда

Ожидаемые переменные:

```env
VK_SERVICE_TOKEN=...
VK_API_VERSION=5.199
VK_TEST_GROUP_ID=
```

`VK_TEST_GROUP_ID` необязателен. Если нет надёжно известного публичного сообщества игры — тест `groups.getMembers` пропустить, а не угадывать ID.

Проверить перед стартом:

- `VK_SERVICE_TOKEN` существует и не пуст;
- `VK_API_VERSION` задан, иначе использовать `5.199`;
- `.env` есть в `.gitignore`;
- `data/raw/`, `artifacts/` или эквивалентная папка с сырыми ответами тоже исключена из Git по умолчанию;
- `.env.example` содержит только пустые значения.

## 2. Формат HTTP-клиента

Базовый endpoint:

`https://api.vk.com/method/<method>`

Требования:

- HTTPS only;
- Authorization через Bearer header;
- `v=5.199` в параметрах каждого VK API-вызова;
- timeout 15 секунд;
- User-Agent вида `arrow-roguelite-vk-research/0.1`;
- retries только для сетевых ошибок/HTTP 5xx, максимум 2;
- на VK API ошибки 6/29/32 не делать агрессивный retry;
- один общий helper `vk_call(method, params)`;
- helper возвращает одновременно parsed JSON, HTTP status, elapsed_ms и sanitized request metadata.

## 3. Артефакты теста

Создать локально:

```text
artifacts/vk-api-smoke/<UTC_TIMESTAMP>/
  00-env.json
  01-server-time.json
  02-apps-catalog-basic.json
  03-apps-catalog-extended.json
  04-app-details.json
  05-users-get.json
  06-groups-members.json        # только если тест разрешён/возможен
  07-rate-limit-1rps.json
  08-rate-limit-2rps.json
  09-rate-limit-3rps.json
  field-inventory.json
  method-matrix.json
  report.md
```

Сырые ответы сохранять **полностью**, как пришли от API, но до записи прогонять секрет-redaction. Не нормализовать и не выбрасывать неизвестные поля.

Каждый JSON-файл должен иметь envelope:

```json
{
  "captured_at": "ISO-8601 UTC",
  "method": "apps.getCatalog",
  "request": {
    "params": {}
  },
  "http_status": 200,
  "elapsed_ms": 123,
  "body": {}
}
```

`request` не должен содержать токен или Authorization header.

## 4. Последовательность smoke test

### Test A — проверка токена самым безопасным методом

Вызвать:

`utils.getServerTime`

Цель:

- подтвердить, что токен принимается;
- зафиксировать HTTP status;
- зафиксировать VK API response/error shape;
- проверить, что версия API работает.

PASS: есть поле `response` и нет `error`.

Если ошибка auth / app auth / permission — **остановить дальнейшие API-тесты**, сохранить sanitized error и написать, что токен/тип приложения/права не подходят.

### Test B — `apps.getCatalog`, минимальный

Вызвать:

- `sort=popular_today`
- `count=5`
- `offset=0`
- `extended=0`

Сохранить полный ответ.

Зафиксировать:

- верхнеуровневые ключи;
- структуру `response`;
- есть ли `count`/`items`;
- поля одного item;
- типы значений;
- реальные app IDs.

### Test C — `apps.getCatalog`, extended

Вызвать:

- `sort=popular_today`
- `count=5`
- `offset=0`
- `extended=1`

Сравнить с Test B.

Отдельно проверить фактическое наличие полей:

- `screenshots`
- `MAU` / `mau` / другое точное написание
- `catalog_position`
- `international`

**Не предполагать имя поля.** В отчёт выписать именно то, что реально пришло.

После этого сделать ещё только по одному запросу `count=5` для сортировок:

- `popular_week`
- `visitors`
- `growth_rate`
- `create_date`
- `popular`

Цель: проверить, что сортировки принимаются и меняют выдачу. Не выгружать каталог целиком.

### Test D — `apps.get`

Взять первый реальный `app_id` из Test C и вызвать `apps.get`:

- `app_id=<id>`
- `extended=1`

Если API поддерживает `app_fields`, сначала не передавать их вообще — получить максимально естественный ответ.

Сохранить поля приложения и сравнить их с `apps.getCatalog`.

Особенно отметить, есть ли:

- описание;
- жанр/тип;
- автор/группа/сообщество;
- screenshots;
- counters / MAU / users;
- даты;
- platform / international;
- links.

### Test E — `users.get`

Цель только проверить, разрешён ли метод сервисному токену и какие публичные поля реально возвращаются.

Использовать один известный публичный user ID, например `1`, и запросить:

- `sex`
- `bdate`
- `city`
- `country`

Не делать массовых batch-запросов.

Сохранить response/error как есть.

Не интерпретировать отсутствие `bdate/city/country` как проблему API: это может быть отсутствующая/закрытая информация пользователя.

### Test F — `groups.getMembers`

Запускать **только если** задан `VK_TEST_GROUP_ID` либо из `apps.get` получен однозначный ID официального публичного сообщества игры.

Сначала минимальный вызов:

- `group_id=<id>`
- `count=5`
- `offset=0`

Потом, только если первый вызов успешен, один extended-вызов с полями:

- `sex`
- `bdate`
- `city`
- `country`

Сохранить ответ/error.

Если service token не поддерживается — зафиксировать точный VK error code/message. Не получать user token автоматически и не просить дополнительные права в рамках этой задачи.

## 5. Инвентаризация полей

После тестов автоматически построить `field-inventory.json`.

Формат примерно:

```json
{
  "apps.getCatalog.extended.item": {
    "id": "integer",
    "title": "string",
    "mau": "integer|null",
    "catalog_position": "integer|null"
  }
}
```

Обязательные правила:

- использовать фактические имена полей;
- рекурсивно перечислять поля минимум до глубины 3;
- для массивов показывать `array<object>` / `array<string>` и поля первого объекта;
- отдельно список полей, которые меняются между `extended=0` и `extended=1`;
- отдельно поля, отсутствующие вопреки ожиданиям.

## 6. Проверка лимитов — только мягкая

Цель — понять безопасную рабочую частоту, а не найти абсолютный максимум.

Использовать только `utils.getServerTime` либо `apps.getCatalog count=1`.

Этапы:

1. 10 запросов с частотой ~1 req/s.
2. Если без ошибок — пауза 5 секунд.
3. 10 запросов с частотой ~2 req/s.
4. Если без ошибок — пауза 5 секунд.
5. 10 запросов с частотой ~3 req/s.
6. **На этом остановиться, даже если всё успешно.**

Для каждого этапа сохранить:

- start/end timestamp;
- requested_rps;
- total requests;
- success count;
- error count;
- HTTP statuses;
- VK error codes;
- min/median/p95/max latency.

Если появляется:

- VK error `6` — Too many requests per second;
- VK error `29` — Rate limit reached;
- VK error `32` — Need wait;
- HTTP 429;

то немедленно прекратить текущий и все более быстрые этапы. Не пытаться «нащупать предел» дальше.

Итоговый рекомендованный rate для дальнейшего research collector брать с запасом: не более 50% от максимальной безошибочной протестированной частоты; если все 1/2/3 rps чистые — всё равно рекомендовать не более `1 req/s` для первого массового сборщика до отдельного решения.

## 7. Матрица методов

Создать `method-matrix.json`:

```json
{
  "utils.getServerTime": {
    "service_token": "PASS",
    "error_code": null,
    "notes": ""
  },
  "apps.getCatalog": {},
  "apps.get": {},
  "users.get": {},
  "groups.getMembers": {}
}
```

Статусы только:

- `PASS`
- `DENIED`
- `INVALID_PARAMS`
- `NOT_TESTED`
- `ERROR`

Не смешивать `DENIED` и `ERROR`.

## 8. Проверка на утечку секрета

До завершения выполнить программный secret scan по:

- всему `artifacts/vk-api-smoke/...`;
- новым/изменённым файлам проекта;
- `git diff`;
- stdout/stderr logs, если они сохранялись.

Проверки:

1. точное значение `VK_SERVICE_TOKEN` нигде не встречается;
2. строки `Authorization: Bearer` нигде не сохранены с реальным значением;
3. `access_token=` с непустым значением отсутствует;
4. `.env` не находится под Git tracking;
5. `git status` не показывает secret-файлы.

В `report.md` обязательно написать `SECRET SCAN: PASS` или `FAIL`.

При FAIL запрещено делать commit.

## 9. Что разрешено коммитить

Можно коммитить:

- smoke-test script;
- `.env.example` без секрета;
- `.gitignore`;
- `report.md`, если в нём нет сырых персональных данных и секретов;
- `method-matrix.json`;
- `field-inventory.json`.

По умолчанию **не коммитить сырые API JSON** и `.env`. Они остаются локальными артефактами.

Если отчёт содержит response sample, использовать короткий sanitized fragment, не полный dump.

## 10. Что агент должен вернуть пользователю

Короткий итог без воды:

```text
VK API SAFE TEST

Token: PASS/FAIL
API version: ...

Methods:
- utils.getServerTime: PASS/...
- apps.getCatalog: PASS/...
- apps.get: PASS/...
- users.get: PASS/...
- groups.getMembers: PASS/DENIED/NOT_TESTED

apps.getCatalog extended actual fields:
- ...

Observed rate test:
- 1 rps: ...
- 2 rps: ...
- 3 rps: ...
Recommended collector rate: ...

Raw artifacts: <local path>
Secret scan: PASS/FAIL

Unexpected findings:
- ...

Next safe step:
- ...
```

## 11. STOP conditions

Остановить работу и ничего больше не тестировать, если:

- токен невалиден;
- приложение disabled;
- сервисный токен не имеет доступа даже к `apps.getCatalog`;
- обнаружена утечка токена;
- VK просит CAPTCHA/дополнительную авторизацию;
- появляются repeated rate-limit errors;
- API возвращает неожиданно чувствительные данные, которые не нужны задаче.

В этих случаях только сохранить sanitized диагностику и сообщить пользователю.

## 12. Критерий готовности

Тест считается завершённым только если:

- токен проверен без его вывода;
- `apps.getCatalog` проверен basic + extended;
- `apps.get` проверен на реальном app ID;
- `users.get` проверен одним публичным пользователем;
- `groups.getMembers` либо проверен, либо явно указан `NOT_TESTED/DENIED`;
- поля ответа инвентаризированы;
- мягкий rate test выполнен максимум до 3 rps;
- raw JSON сохранён локально;
- secret scan = PASS;
- есть короткий `report.md`;
- никаких массовых выгрузок пока нет.
