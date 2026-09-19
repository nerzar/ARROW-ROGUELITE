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

- RESULT: —
- VERIFY: —
- FOUND: —
- STATUS: READY
