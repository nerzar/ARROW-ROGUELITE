# Доска Magic Arrow

`BOARD.md` редактирует архитектор. Здесь только задачи, которые ещё требуют внимания; подробности живут в `.orchestra/tasks/`.

## Сейчас

| Task | Кто делает | Статус | Ветка |
|---|---|---|---|
| PRE-ORCH VK API smoke test | Claude Opus | DONE locally / waiting remote integration | `vk-api-smoke-test` |

## Дальше

| Task | Кому лучше отдать | От чего зависит |
|---|---|---|
| BUILD-001 — VK Market Collector Phase 2 | Claude Opus | smoke-test commit должен быть доступен на remote и принят в базу |
| EXP-002 — анализ рынка/аудитории по первому snapshot | Claude Opus | BUILD-001 |
| EXP-003 — разбор 2–4 Arrow/Tap Away референсов | Claude Sonnet или Opus | shortlist после первого анализа |
| EXP-004 — дешёвая массовая тематическая разметка каталога | Muse Spark 1.3 | схема данных BUILD-001 |

## Правило

Не раздувать доску. После решения пользователя завершённая задача уходит в месячный архив, task-файл и временная ветка удаляются.
