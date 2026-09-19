# TASK: SHOP-001 — Goblin Merchant v1

STATUS: PLANNED
TYPE: BUILD
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/SHOP-001-goblin-merchant

## Цель

Добавить торговца как полноценный roguelite-узел Act I. Игрок тратит уже существующее run-gold между боями и усиливает текущий забег.

Это обязательная часть vertical slice.

## Контекст

ITEM-001 уже даёт:
- run gold;
- inventory до 3 предметов;
- reward draft;
- Bow / Shield / Flask;
- save/load run-state.

ITEM-002 расширит набор предметов. Shop должен быть data-driven и автоматически подхватить расширенный item catalog.

## Нужно

1. Shop открывается из route node MAP-001, не как combat encounter.
2. Показывать текущее золото.
3. Stock задаётся данными и детерминированно собирается для конкретного shop node/run.
4. Поддержать покупки: item / heal / Rotate.
5. При полном inventory использовать существующий replace-slot flow, а не заводить второй инвентарь.
6. Можно уйти из магазина без покупки.
7. Покупка сразу изменяет run-state и сохраняется.
8. Цены и состав stock — provisional/data-driven, финальный economy balance позже.

Для vertical slice достаточно небольшого магазина. Не строить торговую экономику, продажу вещей, reroll или upgrade-system.

## Presentation v1

Допустим placeholder UI, но flow должен быть готов под будущий арт торговца и shop-screen в общем approved fantasy HUD language.

## Не делать

- не вводить новую валюту;
- не продавать предметы обратно;
- не менять combat rules;
- не балансировать весь Act I в этой задаче;
- не добавлять meta-shop между забегами.

## Готово, если

- gold реально списывается;
- item/heal/Rotate реально применяются;
- inventory replacement работает;
- save/load после покупки корректен;
- магазин можно пропустить;
- UI показывает stock/price/affordability;
- тесты/typecheck/build зелёные.

После сдачи STOP.