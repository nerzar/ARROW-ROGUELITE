# TASK: FIX-032 — Arrow Tip Fit + Material Gallery

STATUS: READY
TYPE: FIX/TOOL
SIZE: S/M
BASE_BRANCH: build/BUILD-034-integrate-filled-arrows
BRANCH: fix/FIX-032-arrow-tip-and-material-gallery
START_SHA: 952d6361b5159aa0067960c1146fc4ede9d8378f

## Goal

Довести BUILD-034 до удобного пользовательского просмотра перед выбором финального материала.

## 1. Исправить выступающий наконечник

Сейчас filled-arrow tip выступает примерно на 0.62 клетки за последнюю ячейку и заметно вылезает за край доски на крайних рядах.

Нужно:
- уменьшить forward reach наконечника до примерно старого масштаба (~0.42 cell) или эквивалентного визуально значения;
- сохранить цельную filled-геометрию и текущие пропорции head/shaft;
- не расширять gameplay hitbox за board;
- проверить крайние стрелы во всех 4 направлениях;
- после Rotate визуал и click/ownerAt должны оставаться согласованными.

Не менять gameplay ради компенсации геометрии.

## 2. Подключить отдельную страницу выбора материалов

Добавить в текущую BUILD-034 отдельную страницу для быстрого сравнения всех arrow materials.

Требование:
- страница использует ТОТ ЖЕ `filled-arrow-geom.js`, `filled-arrow-materials.js` и текущий renderer path, который работает в playable;
- не держать вторую независимую копию material/render logic из старой BUILD-033 демки;
- показать все 15 текущих материалов и дать быстро переключать их;
- оставить geometry controls только если они реально полезны; главное — material comparison;
- по возможности показывать несколько реальных arrow shapes: straight, bend, multi-bend, разные направления;
- дать понятный URL из dev server;
- переход из playable/debug UI на эту страницу и обратно — если это делается маленькой правкой.

Старую BUILD-033 demo page можно использовать как UI-референс, но не возвращать её собственную homography/runtime как второй источник истины.

## Boundaries

- BASE = BUILD-034, не main.
- Не менять encounter/gameplay.
- Не выбирать финальный материал за пользователя.
- Не трогать VIS-013/014/016/FIX-030.
- Не делать merge в main.

## Verify

- tip больше не выглядит чрезмерно выступающим на границах board;
- крайние стрелы N/E/S/W визуально корректны;
- Rotate не ломает геометрию;
- playable Prologue запускается;
- material gallery открывается и переключает все 15 материалов;
- gallery и playable используют один material registry / filled geometry;
- tests + typecheck + build.

## Delivery

Коротко:
- branch + SHA;
- URL playable;
- URL material gallery;
- какое значение/правило стало у tip reach;
- список 15 materials;
- RESULT / VERIFY / FOUND.

Commit + push, без merge в main.
