# TASK: ART-019 — Goblin Country Map + Merchant Visual Direction

STATUS: PLANNED
TYPE: ART
SIZE: S
AGENT:
BASE_BRANCH: main
BRANCH: art/ART-019-goblin-country-map-merchant

## Цель

Найти визуальную подачу двух новых экранов vertical slice:
1. карта Страны гоблинов с выбором маршрута;
2. торговец-гоблин / shop-screen.

## Референсы

Использовать канон из:
- docs/visual-refs/README.md;
- docs/visual-refs/current-game/;
- approved HUD language / актуальные approved UI assets, если уже сведены в main.

## Нужно

### Карта
- fantasy overworld / goblin frontier;
- видимые маршруты и узлы;
- battle / shop / boss должны отличаться без чтения мелкого текста;
- текущая позиция и доступные ветки читаются сразу;
- не превращать в generic parchment UI, который не похож на текущую игру.

### Торговец
- один узнаваемый goblin merchant;
- компактный shop layout;
- товары, цена, золото игрока, afford/unafford state;
- стиль должен быть частью той же игры, что arena/HUD/reward screen.

Сделать 2–3 сильных направления, но не production code.

## Готово, если

- карта читается как часть Act I «Край гоблинов»;
- route choice понятен глазами;
- shop не выглядит отдельной RPG;
- пользователь может выбрать одно направление для production.

После сдачи STOP.