# TASK: MAP-001 — Goblin Country Route Map v1

STATUS: DONE
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

## Результат (RESULT)

1. **Data-driven Route Graph**:
   - `spikes/arrow-core/src/route-map.ts`: типы `RouteNodeType` (`battle` | `shop` | `boss`), `RouteNode`, `RouteGraph`, функции `validateRouteGraph` и `getAvailableRouteNodes`.
   - Авторский граф `DEFAULT_ACT1_ROUTE_GRAPH`: охватывает все 18 стадий Акта I (`act1-stage-1` .. `act1-stage-18`), 2 магазина (`node-3-shop`, `node-5-shop`), множественные ветвления/слияния и финального босса (`node-boss`). Добавлен в `campaigns/campaign.json` и экспортирован из ядра.
2. **RunState**:
   - Поддержка `routeGraph`, `currentNodeId`, `visitedNodeIds`, `routeMapPending`, `inShop`.
   - Методы `selectRouteNode(nodeId)`, `leaveShop()`, `debugJumpToNode(nodeId)`.
   - `advance()`: на победе в бою фиксирует награды, сохраняет пройденный узел и открывает карту (`routeMapPending = true`).
   - На узле босса (`boss`): завершение боя ставит `runWon = true`.
   - Полный save/load (`toJSON` / `fromJSON`) с восстановлением графа, посещенных узлов, текущего узла и экрана магазина.
   - Линейный fallback: при отсутствии `routeGraph` логика кампании на 100% сохраняет старое поведение.
3. **Route Map UI & Shop**:
   - `viewer/visual-proto/route-map-ui.js`: интерактивная карта с колонками по тирам, SVG-линиями переходов, различимыми значками архетипов (⚔️ Бой, 🛒 Лавка, 👑 Босс) и состояниями (`.state-visited`, `.state-current`, `.state-available`, `.state-locked`).
   - Placeholder-экран магазина (SHOP-001): отображение золота, реплика торговца и кнопка «Продолжить путь →» (`leaveShop()`), возвращающая на карту к выбору дальнейших узлов.
   - Кнопка `🗺️ Карта` в тулбаре и горячая клавиша `M` для просмотра карты в любой момент.
   - В селекторе сцен добавлен пункт `🗺️ Карта: Страна гоблинов (Акт I)`. Переход по победе над боссом пролога ведёт сразу на карту Акта I.
   - Автоматическое сохранение прогресса маршрута в `localStorage`.

## Верификация (VERIFY)

- `npm run typecheck`: 0 ошибок.
- `npm run build`: 0 ошибок.
- `npm test`: 39 test files, 443 теста пройдено (включая 12 тестов в `test/map-001-route-graph.test.ts`).
- End-to-end скрипт симуляции проверил полный цикл: старт на карте -> выбор развилки -> бой -> награда -> открытие карты -> выбор магазина -> выход из магазина -> продолжение маршрута -> save/load round-trip -> победа над боссом.
- Сервер запущен на порту 5179 и проверен через HTTP fetch (200 OK на всех ассетах).

**URL для проверки**:
- Прямой запуск карты Акта I: `http://localhost:5179/viewer/visual-proto/?route=1`
- Или через выбор в дропдауне сцен: `🗺️ Карта: Страна гоблинов (Акт I)`