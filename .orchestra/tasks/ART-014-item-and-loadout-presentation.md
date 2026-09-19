# TASK: ART-014 — Item and Loadout Presentation

STATUS: READY
TYPE: ART
SIZE: S
BASE_BRANCH: main
BRANCH: art/ART-014-item-and-loadout-presentation

## Цель

Подача предметов и снаряжения: карточка предмета/оружия + компактный loadout (equipped/available). Покрывает scope BOARD ART-014 (Item/Weapon Presentation) и ART-015 (Mini-Inventory/Loadout UI) одной задачей.

## Референсы (обязательно)

- `docs/visual-refs/README.md` — индекс: что канон, что нельзя ломать;
- `docs/visual-refs/current-game/01-combat-main.png` — сцена, в языке которой живут карточки;
- `docs/visual-refs/current-game/03-hud-player.png` — текущий HUD; слоты loadout не должны спорить с ним;
- `docs/visual-refs/current-game/02-combat-overlay.png` — язык попапов, если карточка показывается поверх сцены.

Скриншоты в чат пересылать не нужно — всё уже в репозитории.

## Нужно выдать

- Карточка предмета/оружия: иконка, название, rarity, короткий эффект, charges (если есть);
- визуал лута в сцене (как предмет выглядит как награда/добыча);
- компактный loadout: equipped + available слоты, замена предмета без RPG-склада;
- rarity-логика, согласованная с Reward Screen (ART-011).

Условные предметы для проверки: Bow / Frost Dart / Flask / Shield / реликвия.

## Сохраняем из текущей игры

- Premium stylized fantasy, объёмные материалы (камень/бронза/дерево + магия);
- board остаётся главным — loadout компактный, не перекрывает puzzle;
- читаемость эффекта важнее декора.

## Можно проектировать свободно

- Форму карточек и слотов, rarity-цвета, иконки-плейсхолдеры, layout loadout, motion выбора/замены.

Не проектировать экономику и баланс предметов (см. `docs/BALANCE-SYSTEM.md`), не писать production inventory.

## Готово, если

- Карточка читается одним взглядом (что это + что делает);
- loadout компактный и понятный без обучения;
- стиль — часть сцен из референсов, а не отдельный UI-kit;
- финал выбирает пользователь.

После сдачи STOP.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: —
- VERIFY: —
- FOUND: —
- STATUS: READY
