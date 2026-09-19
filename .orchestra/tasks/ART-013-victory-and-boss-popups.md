# TASK: ART-013 — Victory and Boss Popups

STATUS: READY
TYPE: ART
SIZE: S
BASE_BRANCH: main
BRANCH: art/ART-013-victory-and-boss-popups

## Цель

Единое семейство попапов: victory / reward gained / boss intro-warning / unlock. Запускать после выбора anchor-стиля (ART-010/011), либо в том же языке, если anchor ещё не выбран.

## Референсы (обязательно)

- `docs/visual-refs/README.md` — индекс: что канон, что нельзя ломать;
- `docs/visual-refs/current-game/02-combat-overlay.png` — текущий язык попапов: сохранить механику (карточка поверх dim сцены), стиль можно проектировать свободно;
- `docs/visual-refs/current-game/01-combat-main.png` — фон, поверх которого живут попапы;
- `docs/visual-refs/current-game/04-scene-composition.png` — boss/multi-enemy контекст для intro-warning.

Скриншоты в чат пересылать не нужно — всё уже в репозитории.

## Нужно выдать

Мокапы 4 попапов в одном семействе:

- victory (конец encounter);
- reward gained (получение награды, связь с языком Reward Screen);
- boss intro-warning (появление/фаза босса — тяжёлый акцент);
- unlock (новый предмет/механика).

Для каждого: рамка/материалы, заголовок, кнопка, motion (появление/уход).

## Сохраняем из текущей игры

- Попап — карточка поверх затемнённой сцены, сцена остаётся узнаваемой;
- читаемость важнее декора;
- boss-акцент тяжелее обычного victory, без истеричного bounce.

## Можно проектировать свободно

- Материалы рамок, типографику, кнопки, glow, motion — в рамках premium stylized fantasy.

Не писать production-код попапов, не менять gameplay.

## Готово, если

- 4 попапа читаются как одно семейство;
- victory ощущается как payoff, boss intro — как угроза;
- стиль не спорит с аренами/монстрами из референсов;
- финал выбирает пользователь.

После сдачи STOP.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: —
- VERIFY: —
- FOUND: —
- STATUS: READY
