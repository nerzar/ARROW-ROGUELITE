# TASK: FIX-034 — Stone Pin blocks arrow correctly in Matron encounter

STATUS: BLOCKED — wait for Gemini skill branch to be merged
TYPE: FIX
SIZE: S
AGENT:
BASE_BRANCH: fresh main AFTER the Gemini branch that contains the Matron/Stone Pin behavior is integrated
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

## Dependency / correction

2026-09-19: The bug is **not reproducible on current main because the relevant Matron/Stone Pin skill is not there yet**. Do not spend another agent on this task before the Gemini branch containing that behavior is merged/integrated and the bug is reproduced on the new main. The earlier Devin/Fable attempt used the wrong baseline, so its browser reproduction is not valid evidence for FIX-034.
