# TASK: ART-012 — Player HUD Exploration

STATUS: READY
TYPE: ART
SIZE: S
BASE_BRANCH: main
BRANCH: art/ART-012-player-hud

## Цель

Найти визуальный язык постоянного HUD игрока поверх текущей боевой сцены.

## Контекст

В игре уже есть живой player HUD и enemy HUD, но player HUD пока черновой. Новый вариант не должен съедать arena/board и не должен выглядеть отдельным flat UI-kit.

## Референсы (обязательно)

Канонические скрины текущей игры — `docs/visual-refs/`:

- `docs/visual-refs/README.md` — индекс: что канон, что нельзя ломать;
- `docs/visual-refs/current-game/03-hud-player.png` — текущий player HUD и Rotate-кнопки крупно (сохранить расположение и читаемость);
- `docs/visual-refs/current-game/04-scene-composition.png` — вражеские плашки (таймер + HP), board остаётся главным;
- `docs/visual-refs/current-game/01-combat-main.png` — базовая композиция.

Скриншоты в чат пересылать не нужно — всё уже в репозитории.

## Нужно

Сделать 2–4 HUD-варианта на основе текущего игрового экрана:
- HP;
- Rotate;
- 2–3 active item/weapon slots;
- charges/cooldown;
- место для статусов;
- при необходимости portrait/name, если это реально улучшает экран.

Проверить композицию на текущем landscape layout.

## Результат

Mockups/references в ветке + короткое объяснение вариантов.

Не менять gameplay, inventory rules или mobile layout целиком.

## Готово, если

- HUD хорошо читается на яркой арене;
- board остаётся главным;
- ресурсы видны одним взглядом;
- стиль согласуется с Reward Screen / visual direction;
- пользователь может выбрать направление глазами.

После сдачи STOP.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: Подготовлены 3 сильных HUD-направления поверх неизменяемой композиции live screenshot (Moonlit Fortress 1280×720), переносящие утверждённый язык ART-010/010B (Player HP, 1 Active Item Slot, Rotate chip/buttons с пипсами, компактные Enemy Plates). Создан сравнительный борд `docs/visual-refs/hud/00-hud-comparison-board.png` и отчёт `docs/ART-012-PLAYER-HUD-EXPLORATION.md` с анализом и явной рекомендацией (Вариант 1: Moonlit Bronze).
- VERIFY: Проверены глазами все 3 полноразмерных мокапа (1280×720) и сравнительный борд (1920×1080). Арена, борд, стрелки и расположение врагов сохранены на 100%. Читаемость ресурсов, контраст на ночной сцене и компактность подтверждены.
- FOUND: Объединённый Rotate Dock из Варианта 2 показал высокую эргономику для PC; при финальной имплементации можно перенять эту компоновку в бронзовом материале Варианта 1.
- STATUS: DONE
