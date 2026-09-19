# Visual refs — канон текущей игры

Снято 2026-09-19 из playable `spikes/arrow-core/viewer/visual-proto/` (ветка main @ `927c05e`).
1280×800. Верхняя admin-плашка (scene/debug) — служебная, в игру не входит.

## Канонические скрины (`current-game/`)

| Файл | Что это | Что важно |
|---|---|---|
| `01-combat-main.png` | Пролог 1, дневной лес, Goblin Shaman | Композиция по умолчанию: арена-сцена → каменный board с золотыми стрелами → враг на подиуме над board |
| `02-combat-overlay.png` | Попап «Этап пройден» поверх затемнённой сцены | Текущий язык попапов: светлая карточка, blur/dim сцены, жёлтая primary-кнопка |
| `03-hud-player.png` | Низ экрана: player HUD + Rotate-кнопки | Плашка «ИГРОК» + HP-бар слева; две круглые Rotate-кнопки по центру (пипсы зарядов — между ними, пусты на старте) |
| `04-scene-composition.png` | Act I, ночной замок, два волка | Multi-enemy: враги на подиумах слева/справа, у каждого плашка «таймер + HP»; плотный board; Rotate-кнопки видны |

## Целевой визуальный характер

- Premium stylized fantasy: объёмная сцена, камень/бронза/дерево, тёплый свет факелов + магические акценты.
- Не sci-fi, не cyberpunk, не flat mobile-minimal.
- Board — центр игры: самый читаемый элемент, минимум шума поверх.
- Арена вокруг — богатая сцена боя (лес/замок/руины), меняется по актам.
- Враги стоят на подиумах/слотах вокруг сцены, у каждого — плашка таймера и HP.
- UI встраивается в игру (игровые материалы, объём), а не лежит отдельным flat-слоем.

## Уже утверждено (не ломать)

- Filled-arrow renderer и 15 материалов стрел — текущая база.
- Species presentation: pivot/scale, HUD offset/scale, shadow offset, editor ↔ runtime parity (CAL-005).
- Combat flow и HUD-плашки врагов (таймер + HP) — часть геймплея, не редизайнить молча.
- Goblin Shaman = boss пролога; Goblin King/Taunter — flee/taunt, не boss пролога.
- Верхняя admin-плашка — debug shell, её вид не референс (чистый вид — кнопка ⚙).

## Как пользоваться

Все visual/art-задачи (ART-010…) стартуют с этих скринов. Мокапы должны выглядеть как часть этих сцен.
Полный язык — в `docs/VISUAL-DIRECTION.md` (§1, §8).

## Исследования HUD (`hud/`, задача ART-012)

| Файл | Описание |
|---|---|
| `hud/00-hud-comparison-board.png` | Сводный сравнительный борд 3 вариантов с зумом деталей (1920×1080) |
| `hud/01-hud-moonlit-bronze.png` | Вариант 1 · Moonlit Bronze (канонический фасочный стиль, рекомендован) |
| `hud/02-hud-gilded-slate.png` | Вариант 2 · Slate & Gilded Trim (PC-first low profile, единый Rotate Dock) |
| `hud/03-hud-runeforge.png` | Вариант 3 · Arcane Runeforge (боевой тактический стиль, сегментированный HP) |
| `docs/ART-012-PLAYER-HUD-EXPLORATION.md` | Полный аналитический отчёт с разбором плюсов/минусов и рекомендацией |

## Утверждённая адаптация HUD (`hud/`, задача ART-012B)

| Файл | Описание |
|---|---|
| `approved-ui/approved-hud-reference.png` | Канонический утверждённый референс HUD-языка (из `magicarrowassets/gameplay-reference/hud-approved.png`) |
| `hud/04-hud-approved-adaptation.png` | **Финальная адаптация (1280×720)**: утверждённый HUD со sliced-скинами на каноническом live screenshot (Moonlit Fortress) |
| `hud/05-hud-sliced-frame-demo.png` | Скриншот живого интерактивного пайплайна (Sliced Frame Overlay + Dynamic Health Fill + Scalable 9-Slice) |
| `hud/skins/` | Набор чистых вырезанных рамок и элементов без запечённых цифр и полос (`enemy-hp-frame.png`, `player-hp-bar-frame.png`, и др.) |
| `docs/ART-012B-APPROVED-HUD-ADAPTATION.md` | Полный отчёт по архитектуре адаптации, компоновке, пайплайну рамок и соблюдению ограничений |



