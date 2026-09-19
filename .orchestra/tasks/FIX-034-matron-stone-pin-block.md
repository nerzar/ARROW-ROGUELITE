# TASK: FIX-034 — Stone Pin blocks arrow correctly in Matron encounter

STATUS: READY
TYPE: FIX
SIZE: S
AGENT:
BASE_BRANCH: main
BRANCH: fix/FIX-034-matron-stone-pin-block

## Цель

Исправить подтверждённый баг: на уровне с Матроной камень/Stone Pin визуально есть, но не блокирует стрелу как должен.

## Нужно

- воспроизвести баг именно на сцене/encounter с Matron;
- проверить, это state/gameplay bug, target/arrow id mismatch или presentation desync;
- исправить минимально, не меняя общие правила Stone Pin;
- проверить соседние encounter'ы с stone_throw, чтобы не сломать уже рабочее поведение;
- добавить узкий regression test, если проблема в gameplay/state.

## Не делать

- не ребалансить Матрону;
- не менять визуальный стиль камня;
- не расширять enemy ability framework.

## Готово, если

- pinned arrow реально не может быть выпущена до снятия pin;
- Matron scene ведёт себя так же, как остальные Stone Pin encounter'ы;
- tests/typecheck/build зелёные.

После сдачи STOP.