# TASK: FIX-033 — Combat HUD polish (mob HUD + player HUD)

STATUS: DONE
TYPE: FIX
SIZE: S/M
AGENT:
BASE_BRANCH: main
BRANCH: fix/FIX-033-combat-hud-polish
START_SHA: 75f2befd95928e6ee2ffe62cf56dd6736722b52c
RESULT_SHA:

## Что нужно сделать

Пользователь попросил поправить HUD мобов и HUD игрока в бою (два отдельных пункта, но один и тот же combat-HUD слой — CAL-005 уже задавал offset/scale для HUD, эта задача про то, что после этого всё ещё не так хорошо, как нужно). Конкретных repro-шагов пользователь не дал — начать с диагностики на нескольких encounter'ов, не гадать.

## Что важно знать

- HUD игрока и мобов рисуется в `spikes/arrow-core/viewer/visual-proto/board-renderer.js` (`hudBoxes`, `podiumSlot`), плюс DOM-элементы `.name`/`.rotate-charges` в `app.js`/`index.html`.
- CAL-005 (уже DONE, влит в main) уже делал: short HP bar, small shadow, unbounded offsets, HUD size/scale per species — читать `.orchestra/archive/2026-09.md` (поиск CAL-005) перед тем как что-то менять, чтобы не откатить уже принятые решения.
- Известный факт с live-проверки (18 сентября): при 480×700 viewport на сцене `cp-e5` (Пролог 5 · Goblin Shaman) player HUD (`div.name` "Игрок" + HP-бар) рендерится как тёмный скруглённый блок прямо поверх арт-арены, без явного обрамления — визуально сидит "на арте", а не как оформленный HUD-элемент. Проверить, воспроизводится ли это на других разрешениях/сценах.
- Мобов с не-boss HP (обычный grunt) в текущих encounter не проверял на предмет конкретных багов — начать с ручного прогона нескольких сцен (`prologue-5x5`, `cp-e4` — два врага одновременно, `authored-3` — 6x6 Приоритет целей) и явно описать, что именно не так (перекрытие? неверный anchor? не тот размер? не видно на некоторых существах?), прежде чем чинить вслепую.

## Можно менять

- `board-renderer.js` (HUD rendering path)
- `app.js`/`index.html`/`style.css` в части DOM HUD-элементов
- НЕ трогать calibration data (`arena-calibration.js`, `creature-poses.json`) — если проблема в конкретных калибровочных значениях арен, это отдельная задача (см. calibration-работу техлида на `main`), не эта

## Не менять

- combat-логику, HP/damage/timers
- puzzle/board core
- уже принятые CAL-005 offset/scale решения без явной находки нового бага (если что-то из CAL-005 выглядит некорректным — записать в `FOUND`, не тихо переигрывать)

## Готово, если

- [ ] описан конкретный список того, что было не так с mob HUD (с скриншотами/координатами, не общими словами)
- [ ] mob HUD читаем и не наслаивается на другие элементы на проверенных сценах
- [ ] player HUD выглядит как оформленный HUD-элемент, а не сырой блок поверх арта
- [ ] проверено минимум на 3 разных сценах/энкаунтерах и 2 разрешениях (1920x1080, мобильное ~480 ширины)

## Проверить

tests + typecheck + build в `spikes/arrow-core`; ручная проверка в браузере на нескольких сценах и разрешениях со скриншотами до/после.

## Когда остановиться

`STATUS: BLOCKED`, если чинить HUD невозможно без изменения calibration-данных конкретных арен — тогда это пересекается с текущей калибровочной работой на `main` и требует координации, не тихого решения.

## Итог

RESULT: viewport clamp стека HUD в `hudBoxes` (последняя инстанция после CAL-005 offsets и E/W board clamp; без viewport геометрия legacy) + проводка `viewport` из renderer + player card framing в CSS. Калибровочные данные не тронуты.

VERIFY: tests 344 OK (новый `fix-033-combat-hud.test.ts`, 6 кейсов; legacy suites зелёные); typecheck/build OK; браузер prologue-5x5/cp-e4/authored-3 на 1920 и 480: все plate/badge y>=0 (было до -35), ошибок нет; скриншоты до/после в `C:\Users\nerza\AppData\Local\Temp\opencode\cal005\d33-*.png`.

FOUND:
- Диагноз: N/top plate регулярно за верхом stage (моб: -5/-9.5/-35; fhd: -3/-8.5) — корень в layout (стек безусловно вверх), не в цифрах калибровки; починено клампом.
- E-спрайт на fhd стоит наполовину за правым краем (char до x=1934 при stage 1920) — это anchor placement (PODIUM_GROUND/калибровка арен), по границе карточки не трогал; нужно техлиду калибровки.
- Plate может сесть на лицо спрайта при сильном переполнении — осознанный lesser evil вместо невидимого HUD; CAL-005 offsets применяются первыми и не перебиваются.
