# TASK: ART-010 — UI Style Base / Visual Bible v1

STATUS: DONE
TYPE: ART
SIZE: S
BASE_BRANCH: main
BRANCH: art/ART-010-ui-style-base

## Цель

Собрать короткую визуальную основу для будущих HUD/rewards/popups/items, чтобы интерфейс не развалился на разные стили.

## Контекст

Текущий playable уже задаёт язык: stylized premium fantasy, объёмные арены/персонажи, камень/бронза/дерево, тёплый свет и магические акценты. Не уходить в flat/mobile-minimal.

Открой текущую игру и ориентируйся на живой экран, а не на абстрактный UI-kit.

## Референсы (обязательно)

Канонические скрины текущей игры — `docs/visual-refs/`:

- `docs/visual-refs/README.md` — индекс: что канон, что нельзя ломать;
- `docs/visual-refs/current-game/01-combat-main.png` — базовая композиция;
- `docs/visual-refs/current-game/04-scene-composition.png` — multi-enemy сцена;
- `docs/visual-refs/current-game/02-combat-overlay.png` — текущий язык попапов;
- `docs/visual-refs/current-game/03-hud-player.png` — текущий player HUD.

Мокапы должны выглядеть как часть этих сцен. Скриншоты в чат пересылать не нужно — всё уже в репозитории.

## Нужно

Подготовить 2–3 согласованных направления и для каждого показать:
- материалы панелей/рамок/кнопок;
- форму углов/фасок;
- цветовую логику;
- typography;
- glow/magic accents;
- пример HP bar / resource chip / button / item card frame;
- короткое описание motion language.

## Результат

Сохранить компактный visual board / mockup в ветке + короткий markdown с объяснением различий.

Не делать production UI и не менять gameplay.

## Готово, если

- варианты выглядят как часть текущей игры;
- читаемость важнее декора;
- есть 1 рекомендуемое направление, но финал выбирает пользователь;
- результат можно быстро посмотреть глазами.

После сдачи STOP.

## RESULT

- Добавлен визуальный board: `docs/ART-010-UI-STYLE-BOARD.svg`.
- Добавлено краткое объяснение: `docs/ART-010-UI-STYLE-BASE.md`.
- Показаны 3 согласованных направления: **Moonlit Bronze**, **Runeforge**, **Enchanted Relic**.
- Для каждого есть material/color, corners/bevels, typography, glow, HP bar, resource chip, button, item card frame и motion language.
- Для следующего мокапа рекомендован **Moonlit Bronze** как наиболее близкий к текущему playable; финальный стиль остаётся выбором пользователя.
- RESULT_SHA: `eda582e3932f76333de425d96befeaaf3caae769`.

## VERIFY

- Оба результата прочитаны обратно с `origin/art/ART-010-ui-style-base` через GitHub после записи.
- SVG structural check: открывающий/закрывающий SVG валиден; присутствуют все 3 направления и все обязательные component examples.
- Сверено с актуальным playable на `main`: `visual-proto/style.css`, `index.html`, `assets.js`, `filled-arrow-materials.js`; рабочая база сохранена как dark moonlit fantasy + warm gold + HP green + restrained arcane glow.
- Gameplay / production UI не менялись.

## FOUND

- Task-ветка была на 3 commits позади `main`; эти commits затрагивают только orchestration/task-файлы и не меняют playable visual baseline. Rebase не делался по `GIT.md`.
- Пользователь ещё не выбрал финальное направление; ART-010 DONE означает сдачу exploration, не ACCEPT визуального стиля.
