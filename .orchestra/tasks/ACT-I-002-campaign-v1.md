# TASK: ACT-I-002 — Act I campaign playtest v1

STATUS: PLAYTEST
TYPE: CONTENT
BASE_BRANCH: main
BRANCH: content/ACT-I-002-campaign-v1
START_SHA: 3c37748ce9a3a3a97a33562e353c97f31e29c52c

## Что сделано
- сохранены свежие пользовательские правки Prologue;
- Shaman phase 2: +1 HP (2 -> 3), после телепорта остаётся interruptible CAST IN 3; существующая presentation сама показывает cast pose + pulsing cast telegraph;
- добавлены 8 Act I stages в authored campaign;
- Goblin King возвращён как Act I boss и использует goblin-taunter art pack;
- Shield для Guard Captain пока не включён: ждёт принятия COMBAT-001;
- Ricochet reward после King пока только сюжетная точка: механики Ricochet ещё нет.

## Приёмка
Пользователь проходит новые stages в Campaign Editor/playable runtime и вручную тюнит seed/HP/timers/actors/arena. Никакие provisional числа не считать финальным балансом.

RESULT:
VERIFY: JSON/content smoke + campaign regression tests updated; ручной playtest пользователя обязателен.
FOUND:
