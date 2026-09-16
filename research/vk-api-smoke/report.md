# VK API Safe Smoke Test — отчёт

Дата прогона: 2026-09-16 (UTC `20260916T155735Z`)
ТЗ: [docs/VK-API-SAFE-TEST.md](../../docs/VK-API-SAFE-TEST.md)
Скрипт: [tools/vk_api_smoke.py](../../tools/vk_api_smoke.py)
API version: `5.199`
Авторизация: сервисный токен в заголовке `Authorization: Bearer`, в URL и артефактах не встречается.

Сырые ответы — только локально в `artifacts/vk-api-smoke/20260916T155735Z/` (в Git не входят).
В этом отчёте нет персональных данных: для `users.get` и `groups.getMembers` указаны только имена и типы полей.

## Итог

Token: PASS

| Метод | Service token | Примечание |
|---|---|---|
| `utils.getServerTime` | PASS | `response` — integer |
| `apps.getCatalog` | PASS | basic, extended и 5 сортировок |
| `apps.get` | PASS | `app_id=52438621`, `extended=1` |
| `users.get` | PASS | `user_ids=1`, `fields=sex,bdate,city,country` |
| `groups.getMembers` | PASS | `group_id=227754573`, count=5, minimal + fields |

## apps.getCatalog

`response = {count: integer, items: array<object>}`; `count` = 5030 при `sort=popular_today`.

Поля item при `extended=0`:
`banner_1120, banner_560, description, genre, genre_id, icon_139, icon_150, icon_16, icon_278, icon_576, icon_75, id, international, is_in_catalog, is_installed, screen_name, section, title, type`

При `extended=1` добавляются ровно два поля, остальное совпадает (типы тоже):
- `catalog_position` — integer;
- `screenshots` — `array<object>`: `album_id, date, has_tags, id, orig_photo{height,type,url,width}, owner_id, sizes[]{height,type,url,width}, text, user_id, web_view_token`.

Верхний уровень `response` и порядок app IDs при `extended=0/1` одинаковые.

Проверка ожидаемых полей:
- `screenshots` — есть (только в extended);
- `catalog_position` — есть (только в extended);
- `international` — есть уже в basic (boolean);
- **`MAU` / `mau` / любое поле с `mau` — отсутствует** ни в basic, ни в extended, ни в `apps.get`.

### Сортировки (по одному запросу, count=5, extended=0)

| sort | Статус | Выдача отличается от `popular_today` |
|---|---|---|
| `popular_today` | PASS | — |
| `popular_week` | PASS | да |
| `visitors` | PASS | да (первые 3 позиции как у `popular_week`) |
| `growth_rate` | PASS | да |
| `create_date` | PASS | да |
| `popular` | PASS | да |

## apps.get (`app_id=52438621`, `extended=1`, без `app_fields`)

`response = {count, items: array<object>, groups: array<object>}`.

Есть в `apps.get`, нет в каталоге:
`author_owner_id, author_url, has_vk_connect, hide_tabbar, is_calls_available, is_plugin, is_splash_screen_enabled, is_vkui_internal, leaderboard_type, members_count, mini_apps_web_call_api_form_data, mobile_controls_type, mobile_view_support_type, need_policy_confirmation, published_date, screen_orientation, support_url, webview_url`

Есть в каталоге extended, нет в `apps.get`: `icon_16, icon_576, screenshots[].orig_photo`.

`groups[]`: `id, is_closed, name, photo_50, photo_100, photo_200, screen_name, type`.

Чек-лист из ТЗ:
- описание — `description`;
- жанр/тип — `genre`, `genre_id`, `type`, `section`;
- автор/сообщество — `author_owner_id` (отрицательный = сообщество), `author_url`, `groups[]`; поля `author_group` нет;
- screenshots — есть;
- counters / MAU / users — только `members_count`; MAU нет;
- даты — `published_date` (unix time); в `screenshots[].date`;
- platform / international — `international`, `mobile_view_support_type`, `mobile_controls_type`, `screen_orientation`; отдельного `platform` нет;
- links — `author_url`, `support_url`, `webview_url`, `screen_name`.

## users.get (один пользователь, `user_ids=1`)

Разрешён сервисному токену. Вернулись поля:
`id, first_name, last_name, can_access_closed, is_closed, sex, bdate, city{id,title}`.
`country` запрошен, но не вернулся (для этого пользователя; это не считается ошибкой API).

## groups.getMembers

`VK_TEST_GROUP_ID` не задан. Group id взят из `apps.get`, потому что он однозначен:
`author_owner_id = -227754573`, в `groups[]` ровно одно сообщество с `id = 227754573`, `is_closed = 0`.

- минимальный вызов (`count=5`) — PASS, `response = {count: integer, items: array<integer>, next_from: string}`;
- вызов с `fields=sex,bdate,city,country` — PASS, у item поля `id, first_name, last_name, can_access_closed, is_closed, sex, bdate, city{id,title}`; `country` не вернулся ни у одного из 5.

Сервисный токен читает участников открытого сообщества. Больше 5 участников не запрашивалось.

## Мягкий rate test (`utils.getServerTime`, по 10 запросов, пауза 5 с между этапами)

| Этап | Длительность | OK / всего | HTTP | VK errors | latency min / median / p95 / max, мс |
|---|---|---|---|---|---|
| 1 rps | 9.16 s | 10 / 10 | 200 | — | 149 / 166.5 / 230 / 230 |
| 2 rps | 4.71 s | 10 / 10 | 200 | — | 143 / 169.5 / 208 / 208 |
| 3 rps | 3.15 s | 10 / 10 | 200 | — | 153 / 167.5 / 198 / 198 |

Ошибок 6/29/32 и HTTP 429 не было. После 3 rps тест остановлен по ТЗ.

**Рекомендуемая скорость будущего сборщика: не более 1 req/s** (все этапы чистые, но ТЗ требует 1 req/s для первого массового сборщика до отдельного решения).

## Неожиданные наблюдения

- Первый запуск упал до обращения к VK: `SSL: CERTIFICATE_VERIFY_FAILED`. Цепочка `api.vk.com` валидна (Google Trust Services → GTS Root R1), но Python 3.14 на Windows не видел корень. Скрипт использует системное хранилище через `truststore` (запасной вариант — `certifi`); проверка сертификата не отключалась. Диагностика того запуска: `artifacts/vk-api-smoke/20260916T155656Z/`.
- В `screenshots[]` есть поле `web_view_token` — это токен просмотра фото от VK, а не наш сервисный токен. Значения хранятся только в локальных сырых JSON.
- В `apps.get` нет `author_group`; сообщество приложения определяется через `author_owner_id` + `groups[]`.
- Test F выполнен отдельной командой `resume-groups` поверх того же прогона, после исправления выбора group id; остальные запросы не повторялись.

## SECRET SCAN: PASS

Проверено программно (`python tools/vk_api_smoke.py scan ...`): все локальные артефакты `artifacts/vk-api-smoke/`, новые файлы проекта, `git diff`, `git status`.
Точного значения токена и его фрагментов от 12 символов нет, заголовок Bearer и параметр access_token с токеноподобным значением (от 20 символов) не найдены, `.env` не отслеживается Git, сырые артефакты в `git status` не видны.

Первый прогон сканера вернул FAIL только из-за шаблонов, совпавших с текстом описаний (docstring, исходник регулярки, фразы этого отчёта); токен и его фрагменты не находились. Шаблоны ужесточены до токеноподобных значений, после чего сканер проверен на фейковом токене (точное совпадение, фрагмент, Bearer, query-параметр — все 4 найдены; безопасная строка не помечена).
