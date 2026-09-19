# TASK: PORTAL-001 — Monster Spawner Portal

STATUS: PLANNED
TYPE: BUILD/COMBAT
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/PORTAL-001-enemy-spawner

## Цель

Новый тип цели: портал, который продолжает выпускать монстров, пока игрок не уничтожит сам портал.

## Рабочая механика v1

- портал занимает внешний target slot / специальный arena anchor;
- имеет HP и читаемый spawn countdown;
- пока жив, по таймеру добавляет новых врагов в заранее допустимые слоты/очередь;
- после уничтожения новые spawn'ы прекращаются, уже появившиеся враги остаются;
- поведение детерминированно и учитывается save/undo/solver настолько, насколько требуется текущему encounter framework.

## Важно

WAVE-001 уже умеет delayed arrivals, но PORTAL-001 — отдельная механика: источник повторных spawn'ов живёт на поле. Не маскировать портал простой заранее прописанной волной, если игрок не может остановить её уничтожением портала.

## Не делать

- generic summoner scripting engine;
- бесконечный procedural spawn;
- новый 4-й enemy slot без отдельного решения.

После сдачи STOP.