# TASK: FIX-035 — HUD fit + dual Rotate controls

STATUS: READY
TYPE: FIX
SIZE: S
AGENT:
BASE_BRANCH: build/BUILD-036-approved-hud-integration
START_SHA: e6bd88a9291e219a5af14968df2b32bc7722a3b8
BRANCH: fix/FIX-035-hud-fit-dual-rotate

## Цель

Довести уже интегрированный approved HUD из BUILD-036. Не придумывать новый стиль.

## Источник ассетов

Локальная папка пользователя:
`C:\Users\nerza\Projects\magicarrowassets\gameplay-reference\huds`

Использовать готовые HUD skins и две готовые Rotate-кнопки из этой папки. Не кропать и не перерисовывать их.

## Что исправить

1. Player HUD: красный HP fill не должен выезжать за внутреннюю область рамки.
2. Enemy/Boss HUD: HP fill также должен быть строго внутри track/frame.
3. Расчёт ширины HP делать по внутренней track-area, а не по полной ширине PNG-рамки.
4. При 100%, 50%, 10%, 0% полоска не пересекает золотые/каменные края.
5. Rotate controls: две отдельные кнопки справа снизу:
   - CCW -> существующий `rotCcw` / `rotate(-1)`;
   - CW -> существующий `rotCw` / `rotate(1)`.
6. Обе кнопки сделать заметно меньше старой одиночной кнопки и визуально собрать в компактную группу.
7. Один общий счётчик `xN` для shared Rotate pool.
8. Сохранить существующие Q/E shortcuts и `rotate.allow` disabled/visibility behaviour.

## Не делать

- не менять EncounterState / gameplay rules;
- не менять arena / board / arrows / enemy placement;
- не делать отдельный demo вместо реального playable;
- не добавлять level/currency/sidebar/End Turn;
- не merge в main.

## Проверка

- Prologue / Goblin Shaman;
- обычный multi-enemy Act I;
- boss HUD;
- HP: full / partial / near-zero;
- Rotate charges: 2 / 1 / 0;
- encounter, где доступно только одно направление Rotate, если такой есть.

## Готово, если

- все HP fills физически сидят внутри рамок;
- две Rotate-кнопки читаются как left/right и не перегружают экран;
- реальные gameplay values остаются динамическими;
- tests/typecheck/build зелёные;
- живой browser check сделан.

В конце: RESULT / CHANGED FILES / SCENES CHECKED / VERIFY / FOUND / SHA. Push и STOP.