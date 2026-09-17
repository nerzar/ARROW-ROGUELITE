# TASK: VIS-010 — Arrow Presentation Spec

STATUS: READY
TYPE: DESIGN
SIZE: S
AGENT: Muse / visual design
BASE_BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
BRANCH: design/VIS-010-arrow-presentation-spec
START_SHA: 5d5730a831db197f532e56bf66018902fa7c4042

## Goal

Зафиксировать визуальный язык стрел — core mechanic Magic Arrow — до следующего renderer pass.

Текущий continuous glow-line вид пользователем не принят: стрелки читаются плохо и выглядят как наложение поверх сцены.

Нужен конкретный spec/reference, НЕ runtime implementation.

## Required states

Для одного и того же arrow path показать/описать:

- blocked/inactive;
- free/clickable;
- hover/selected;
- attack-ready/targeting;
- firing/shot travel;
- hit/impact;
- disabled/dead/removing;
- Stone Pin blocked state.

## Visual requirements

- стрелка должна казаться встроенной/магически выгравированной в камень;
- перспектива поверхности сохраняется;
- направление читается моментально;
- длинные paths остаются красивыми, не превращаются в жирную светящуюся лапшу;
- arrowhead читается отдельно от линии;
- free и blocked различаются без текста;
- эффекты не закрывают соседние paths.

Исследовать 2–3 визуальных языка максимум, например:
- segmented glowing rail;
- engraved magical groove + flowing pulse;
- solid core + sparse luminous direction markers.

Не делать 20 вариантов.

## Output

`docs/VIS-010-ARROW-PRESENTATION.md`

Для каждого варианта:
- line construction;
- arrowhead;
- colors/intensity by state;
- perspective scaling rule;
- animation idea;
- pros/risks;
- recommendation FOR PLAYTEST, not final user approval.

Если возможно, сделать простой contact/mockup поверх одного screenshot/board reference, не меняя runtime renderer.

## Do not

- не менять `board-renderer.js`;
- не менять gameplay;
- не менять board projection;
- не объявлять вариант принятым;
- не merge main.

## Delivery

RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
