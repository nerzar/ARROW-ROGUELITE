# TASK: MAP-001 — Goblin Country Route Map v1

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: Gemini / Antigravity
BASE_BRANCH: build/ITEM-002-items-v1-set
START_SHA: 95efe0e6f8b450d3b6f86e77af405c801841ef31
BRANCH: build/MAP-001-goblin-country-route

## Цель

Добавить между боями Act I карту «Страны гоблинов», где игрок выбирает следующий путь по roguelite-схеме, а не просто идёт по линейному списку stage'ов.

Это часть vertical slice, не декоративный экран «на потом».

## Контекст

Сейчас RunState ведёт линейную campaign-цепочку. Уже есть:
- Act I «Край гоблинов»;
- reward draft;
- run HP / Rotate / inventory / gold;
- WAVE-001;
- save/load run-state.

## Нужно

1. Добавить data-driven route graph для акта.
2. После награды игрок попадает на карту и выбирает один из доступных следующих узлов.
3. Для v1 достаточно типов узлов: battle / shop / boss. Остальные типы позже.
4. Показать уже пройденные, доступные и закрытые узлы + линии маршрутов.
5. Текущий выбранный путь и visited-state должны сохраняться/восстанавливаться.
6. Battle node запускает существующий encounter без изменения его правил.
7. Shop node передаёт управление SHOP-001.
8. Boss node завершает маршрут Act I.
9. Если campaign не содержит route graph, старый линейный flow должен продолжать работать.

Топология карты и количество развилок — content data, не hardcode. Не строить procedural map generator в этой задаче.

## Presentation v1

Можно начать с аккуратного placeholder UI. Но композиция должна позволять позже заменить фон/узлы на финальную карту Страны гоблинов без переписывания run logic.

## Не делать

- не перебалансировать Act I;
- не делать meta-progression;
- не делать случайную генерацию карты;
- не добавлять новые валюты;
- не делать большой event-system.

## Готово, если

- после reward screen открывается route map;
- минимум одна реальная развилка работает;
- игрок выбирает следующий battle;
- shop/boss node различимы;
- save/load восстанавливает выбранный маршрут;
- существующая линейная campaign не ломается;
- тесты/typecheck/build зелёные.

Перед сдачей: tests/typecheck/build + реальный browser/playable check. Оставь dev/viewer сервер запущенным и дай точный URL карты для быстрой проверки пользователем.

После сдачи STOP.