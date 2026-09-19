# TASK: MAP-002 — Map Events / Points of Interest v1

STATUS: PLANNED (после MAP-001)
TYPE: BUILD/DESIGN
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/MAP-002-events-poi

## Цель

Расширить карту Страны гоблинов небоевыми узлами, чтобы выбор пути был не только battle/shop/boss.

## v1 типы узлов

- event;
- point of interest;
- rest/heal;
- optional reward/challenge.

Конкретные тексты/награды держать data-driven. Для первого прохода достаточно 3–5 коротких событий, которые реально создают выбор.

## Нужно

- event node работает через тот же route graph MAP-001;
- выбор в событии может менять run-state (HP / gold / Rotate / reward/item) через существующие системы;
- visited/save-load работают;
- на карте типы узлов различимы;
- событие не запускает combat renderer без необходимости.

## Не делать

- большой narrative engine;
- procedural event generator;
- десятки событий;
- meta-progression.

После сдачи STOP.