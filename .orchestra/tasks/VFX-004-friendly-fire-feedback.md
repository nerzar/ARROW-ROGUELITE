# TASK: VFX-004 — Friendly-fire arrow collision feedback

STATUS: PLANNED (после текущего presentation/HUD integration)
TYPE: BUILD (presentation)
SIZE: S
AGENT:
BASE_BRANCH: main
BRANCH: build/VFX-004-friendly-fire-feedback

## Цель

Сделать понятный визуальный feedback, когда выпущенная стрела упирается в другую стрелу и игрок получает friendly-fire/self-damage.

## Нужно

- событие должно быть понятно без чтения лога;
- короткий impact на месте столкновения стрел;
- визуально показать, что урон получил именно игрок;
- синхронизировать hit/HP feedback с моментом столкновения;
- переиспользовать текущий VFX language (flash/sparks/recoil/camera impulse) без отдельной большой системы.

## Ограничения

- presentation only: не менять сам damage/rules;
- не мешать читаемости board;
- не делать gore/длинную катсцену.

## Готово, если

- friendly-fire читается глазами в реальном playable;
- обычный hit по врагу и blocked tap визуально не путаются с ним;
- tests/build зелёные.

После сдачи STOP.