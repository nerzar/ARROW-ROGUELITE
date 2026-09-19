# TASK: ART-011 — Reward Choice Screen Exploration

STATUS: DONE
TYPE: ART
SIZE: S
BASE_BRANCH: main
BRANCH: art/ART-011-reward-choice-screen

## Цель

Найти визуальный стиль экрана выбора награды после encounter.

## Контекст

Reward Screen — один из двух anchor-экранов всей UI-системы. Общий язык: premium stylized fantasy, объёмные рамки/материалы, тёплый металл/камень/дерево + магические акценты. Не делать generic flat mobile cards.

## Референсы (обязательно)

Канонические скрины текущей игры — `docs/visual-refs/`:

- `docs/visual-refs/README.md` — индекс: что канон, что нельзя ломать;
- `docs/visual-refs/current-game/01-combat-main.png` — сцена, поверх/рядом с которой сидит reward screen;
- `docs/visual-refs/current-game/02-combat-overlay.png` — текущий язык попапов (карточка, dim, кнопка);
- `docs/visual-refs/current-game/04-scene-composition.png` — композиция с врагами.

Скриншоты в чат пересылать не нужно — всё уже в репозитории.

## Нужно

Сделать 2–4 варианта одного и того же reward choice:
- 3 награды;
- rarity/readability;
- hover/select;
- выбранная карта;
- confirm/continue;
- место под иконку, название и короткий эффект;
- как экран сидит поверх/рядом с текущей ареной.

Можно использовать условные награды вроде Heal / Rotate / Bow / Frost Dart — только для визуальной проверки.

## Результат

Mockups/references в ветке + короткое описание плюсов/минусов вариантов.

Не проектировать экономику наград и не писать production reward-system.

## Готово, если

- варианты реально сравнимы;
- карточки читаются сразу;
- reward ощущается как payoff после боя;
- стиль не спорит с текущими аренами/монстрами;
- финальный выбор оставлен пользователю.

После сдачи STOP.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: 4 desktop-first reward-choice mockups + comparison notes in `docs/art/ART-011/`.
- VERIFY: all 4 variants show 3 rewards, rarity treatment, a clearly selected card, confirm/continue CTA, and the current arena composition retained as a dimmed background layer.
- FOUND: exploration only; no reward economy, gameplay logic, or production UI implementation added. Final style intentionally not selected.
- OUTPUT_COMMIT: `04597b159d75d95ec9879d8d3c57934ce7306fd7`
- STATUS: DONE
