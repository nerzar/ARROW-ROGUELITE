# TASK: ITEM-002 — Предметы v1: Frost Dart, Pocket Gyro, War Horn + первые реликвии

STATUS: PLANNED (после ITEM-001)
TYPE: BUILD
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/ITEM-002-items-v1-set

## Цель

Довести набор наград до 6 активных предметов + 3 пассивных реликвий, чтобы draft «1 из 3»
давал реальный выбор между четырьмя осями: урон / защита / время / направление.

## Контекст

`ITEM-001` даёт каркас (инвентарь, действие `item`, draft, солвер) и уже содержит Лук, Щит, Зелье (расходник), Стрелу (расходник, спавн стрелы на доске) и золото. Числа — `docs/BALANCE-SYSTEM.md`. Магазин/торговец под золото — отдельная карточка (SHOP-001, ещё не создана).

## Нужно

Активные (через тот же data-driven формат, что Bow/Shield/Flask):
- **Frost Dart** — 1 DU в выбранную цель + её `ATTACK IN` +2, `1/E`, Turn Cost 1;
- **Pocket Gyro** — +1 Rotate на входе в каждый бой (encounter-local, не в shared pool), пассивный;
- **War Horn** — следующая попавшая puzzle-стрела +1 DU, `1/E`, Turn Cost 0.

Реликвии (пассивные, из `docs/GAME-CONCEPT.md` §8 / BALANCE-SYSTEM):
- **Waste Conversion** — стрела ушла в пустую сторону → следующий hit +1 DU (не стакается);
- **Keystone Release** — первый раз за бой, когда один tap освободил ≥2 стрелы, ближайший enemy timer +1;
- **Safety Fuse** — первый blocked tap в бою без HP-штрафа.

Draft-пул: веса/редкость условные (`common/rare`), но в данных, не в коде.

## Готово, если

- все 9 эффектов проверены тестами, солвер учитывает Frost Dart/War Horn/Gyro;
- реликвии показываются в HUD как пассивный ряд (плейсхолдер);
- `tools/ld007-audit.mjs` умеет запускать аудит «с набором» (`--kit bow,shield`), чтобы `LD-008`
  мог балансировать уровни под предметы.

После сдачи STOP.
