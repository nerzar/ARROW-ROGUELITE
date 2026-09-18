# TASK: FIX-032 — Arrow Tip Fit + Existing Material Gallery

STATUS: READY
TYPE: FIX/TOOL
SIZE: S
BASE_BRANCH: build/BUILD-034-integrate-filled-arrows
BRANCH: fix/FIX-032-arrow-tip-and-material-gallery
START_SHA: 952d6361b5159aa0067960c1146fc4ede9d8378f

## Goal

Довести BUILD-034 до удобного пользовательского просмотра перед выбором финального материала.

## 1. Исправить выступающий наконечник

Уточнённая геометрия:
- центр последней клетки = 4.5;
- край доски = 5.0;
- текущий tip = 5.12;
- реальный выход за board = 0.12 cell;
- старый stroke-kite заканчивался примерно на 4.92.

То есть проблема не «0.62 клетки за board». 0.62 — текущий reach от центра последней клетки.

Пользователь решил этот визуальный дефект исправить сейчас.

Нужно:
- развязать `tipReach` и `headLen`, если сейчас они фактически связаны;
- оставить длину головы `headLen ≈ 0.62`, чтобы не укорачивать принятую форму Muse;
- сделать forward reach таким, чтобы tip не вылезал за board на крайней клетке. Базовый целевой вариант: `tipReach = 0.50` от центра последней клетки;
- сохранить цельную filled-геометрию и текущие пропорции shaft/head максимально близко к BUILD-034;
- не расширять gameplay hitbox;
- проверить крайние стрелы N/E/S/W;
- после Rotate визуал и click/ownerAt должны оставаться согласованными.

Не менять gameplay ради компенсации геометрии.

## 2. Подключить существующую страницу material gallery

Страница уже существует в BUILD-032/033 как:
`viewer/filled-arrow.html`
с UI-кодом `viewer/filled-arrow.js`.

На BUILD-034 этих двух файлов нет, поэтому их нужно ПЕРЕНЕСТИ из BUILD-032/033, а не создавать новый UI с нуля.

Нужно:
- перенести существующие `filled-arrow.html` и нужную UI-логику;
- перецелить импорты на актуальные BUILD-034 модули в `viewer/visual-proto/`;
- использовать общие `filled-arrow-geom.js` и `filled-arrow-materials.js`;
- НЕ возвращать локальные копии `paintSolid` / `paintBevel` / `paintMagic` из старой демки;
- все материалы, включая warm-*, брать через общий material registry / `findMaterial`;
- сохранить удобный material selector, hotkeys и geometry controls существующей страницы;
- показать все 15 текущих материалов;
- собственную demo-homography/tilt страницы можно оставить как preview-функцию, но geometry/material registry должны быть общими с playable;
- дать рабочий URL на новом dev server;
- если это маленькая правка — добавить переход playable ↔ gallery.

Галерея нужна именно для быстрого сравнения материалов и геометрии; финальный материал пользователь выбирает сам.

## Boundaries

- BASE = BUILD-034, не main.
- Не менять encounter/gameplay.
- Не выбирать финальный материал за пользователя.
- Не трогать VIS-013/014/016/FIX-030.
- Не переписывать gallery заново без необходимости.
- Не делать merge в main.

## Verify

- tip не выходит за board на крайней клетке;
- крайние стрелы N/E/S/W визуально корректны;
- Rotate не ломает геометрию;
- playable Prologue запускается;
- `viewer/filled-arrow.html` открывается;
- gallery переключает все 15 материалов;
- warm-* в gallery идут через общий registry, без дублирующих painter-функций;
- gallery и playable используют один material registry / filled geometry;
- tests + typecheck + build.

## Delivery

Коротко:
- branch + SHA;
- URL playable;
- URL `viewer/filled-arrow.html`;
- итоговые `tipReach` и `headLen`;
- RESULT / VERIFY / FOUND.

Commit + push, без merge в main.
