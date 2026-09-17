# TASK: CAL-001 — Arena Calibration Editor

STATUS: READY
TYPE: TOOL
SIZE: M
AGENT: Claude / implementation
BASE_BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
BRANCH: tool/CAL-001-arena-calibration-editor
START_SHA: 5d5730a831db197f532e56bf66018902fa7c4042

## Goal

Сделать отдельный визуальный инструмент для ручной калибровки арены, чтобы больше не править `boardPlaneFrac`, actor anchors и effect anchors через код.

Пользователь уже подтвердил: ручная калибровка глазами работает лучше автоматической. Теперь нужен UI, в котором геометрию можно выставить мышью.

## Required UI

Отдельная debug/tool page внутри `viewer/visual-proto/`, не production HUD.

Минимум:

- выбрать/загрузить arena calibration entry из текущего runtime каталога;
- live arena background;
- draggable 4 board corners: TL/TR/BR/BL;
- projected grid overlay поверх board plane;
- выбор grid size 5x5 / 6x6 / 7x7 / 8x8 / 9x9 / 10x10;
- draggable actor anchors: TOP / LEFT / RIGHT;
- draggable effect anchors: TOP / LEFT / RIGHT;
- live sprite preview для TOP/LEFT/RIGHT, чтобы видеть фактическое положение ног;
- toggle arrow preview поверх той же projection;
- reset to current saved values;
- copy/export current calibration as JSON/JS object;
- значения показывать одновременно в stage pixels и normalized fractions.

## Interaction requirements

- handles крупные и удобные;
- drag мышью без перезагрузки;
- точная подстройка стрелками клавиатуры: 1px;
- Shift+arrow: 5px или 10px;
- выбранный handle явно подсвечен;
- не должно требоваться редактировать source code для обычной калибровки.

## Geometry contract

Инструмент ДОЛЖЕН использовать те же production functions из `board-plane.js`, что и runtime:

- project/unproject;
- grid boundaries;
- arrow preview geometry.

Нельзя сделать отдельную approximation math только для editor.

Калибровка должна редактировать данные, а не renderer magic numbers.

## Base scene

Использовать user-confirmed `prologue-5x5-good` как первый сохранённый пример.

Не менять его текущую подтверждённую калибровку автоматически.

## Save/export

Минимально достаточно безопасного:

- кнопка `Copy calibration` -> готовый объект для `arena-calibration.js`;
- кнопка `Download JSON` допустима;
- прямую запись в source file делать только если это уже просто и безопасно.

Не строить backend ради одной кнопки Save.

## Do not

- не менять combat rules;
- не менять levels/seeds;
- не чинить стиль стрел в этой задаче;
- не делать новую систему арен;
- не merge main.

## Verify

- открыть `prologue-5x5-good`;
- сдвинуть все 4 угла и увидеть мгновенную перестройку grid;
- вернуть reset;
- сдвинуть LEFT/RIGHT anchors и визуально посадить волков ногами на площадки;
- сдвинуть effect anchor независимо от sprite anchor;
- проверить copy/export и round-trip: экспортированные значения дают ту же геометрию после reload;
- 1920x1080 и 1366x768;
- typecheck/tests/build.

## Delivery

RESULT / VERIFY / FOUND -> code commit -> report/task commit -> push -> remote SHA verify -> STATUS DONE.

Не merge main.
