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

Сейчас filled-arrow tip выступает примерно на 0.62 клетки за последнюю ячейку и заметно вылезает за край доски на крайних рядах.

Нужно:
- уменьшить forward reach наконечника до примерно старого масштаба (~0.42 cell) или эквивалентного визуально значения;
- сохранить цельную filled-геометрию и текущие пропорции head/shaft;
- не расширять gameplay hitbox за board;
- проверить крайние стрелы во всех 4 направлениях;
- после Rotate визуал и click/ownerAt должны оставаться согласованными.

Не менять gameplay ради компенсации геометрии.

## 2. Вернуть/подключить уже существующую страницу material gallery

Страница УЖЕ существует в BUILD-032/033:

`viewer/filled-arrow.html`

Ранее открывалась как:
`http://localhost:5177/viewer/filled-arrow.html`

Не создавать новую страницу с нуля.

Нужно:
- перенести/подключить существующие `filled-arrow.html` + нужный UI-код поверх BUILD-034;
- адаптировать страницу так, чтобы она использовала актуальные `filled-arrow-geom.js` и `filled-arrow-materials.js` BUILD-034;
- по возможности переиспользовать общий render helper BUILD-034, а не держать расходящуюся копию material logic;
- сохранить удобный material selector и geometry controls существующей страницы;
- показать все 15 текущих материалов;
- сохранить быстрые hotkeys/selector, если они уже работают;
- дать рабочий URL на новом dev server;
- при маленькой правке добавить переход между playable и gallery.

Собственную demo-homography/tilt можно оставить только там, где она нужна именно для preview-страницы; material registry и geometry должны быть общими с playable.

## Boundaries

- BASE = BUILD-034, не main.
- Не менять encounter/gameplay.
- Не выбирать финальный материал за пользователя.
- Не трогать VIS-013/014/016/FIX-030.
- Не переписывать gallery заново без необходимости.
- Не делать merge в main.

## Verify

- tip больше не выглядит чрезмерно выступающим на границах board;
- крайние стрелы N/E/S/W визуально корректны;
- Rotate не ломает геометрию;
- playable Prologue запускается;
- существующая `viewer/filled-arrow.html` снова открывается;
- gallery переключает все 15 материалов;
- gallery и playable используют один material registry / filled geometry;
- tests + typecheck + build.

## Delivery

Коротко:
- branch + SHA;
- URL playable;
- URL `viewer/filled-arrow.html`;
- какое значение/правило стало у tip reach;
- RESULT / VERIFY / FOUND.

Commit + push, без merge в main.
