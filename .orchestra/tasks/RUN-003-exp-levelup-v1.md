# TASK: RUN-003 — XP / Level Up v1

STATUS: PLANNED / DECISION BEFORE FINAL BALANCE
TYPE: BUILD/DESIGN
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/RUN-003-exp-levelup-v1

## Цель

Добавить progression внутри текущего run: опыт за encounters -> level up -> небольшой выбор постоянного бонуса до конца забега.

## Рабочий scope v1

- XP начисляется за завершённые encounters;
- level up не открывает отдельное большое дерево;
- при level up игрок выбирает 1 из 3 небольших бонусов;
- примеры допустимых бонусов для прототипа:
  - +1 encounter-local Rotate charge;
  - +1 max/use charge для подходящего item/ability;
  - небольшой HP/max-HP bonus;
  - небольшой arrow/combat utility bonus.

Точные бонусы и числа — provisional до playtest.

## Важно

Эта система меняет power curve, поэтому перед финальным LD/economy balance нужно явно решить, входит ли RUN-003 в первый vertical slice. Не балансировать вокруг неё молча.

## Не делать

- классы;
- skill tree;
- meta-level между run'ами;
- десятки апгрейдов.

После сдачи STOP.