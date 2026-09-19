# TASK: FIX-034 — Stone Pin blocks arrow correctly in Matron encounter

STATUS: REOPEN AFTER INT-ITEM-001b (в main влит только текстовый обход `42d0489`)
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

## Correction 2026-09-19 (архитектор)

«Skill-ветка», которой не хватало, — не Gemini, а `build/ITEM-001-inventory-reward-draft` @ `dcbd231`: там Матрона получила `abilities: [heal, kids_rocks]` (камни детей, pin 2) по решению пользователя. Влитый `42d0489` убрал у Матроны обещание THROW — это временно правильно для текущего main и **неправильно после INT-ITEM-001b**. Там же переписать `test/fix-034-matron-stone-pin.test.ts` и воспроизвести исходный баг-репорт (камень есть, но не блокирует стрелу) на реальной Матроне.
