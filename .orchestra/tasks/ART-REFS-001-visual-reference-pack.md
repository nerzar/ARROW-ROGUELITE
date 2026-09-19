# TASK: ART-REFS-001 — Visual Reference Pack

STATUS: DONE
TYPE: DOCS
SIZE: S
BASE_BRANCH: main
START_SHA: 927c05e
BRANCH: docs/ART-REFS-001-visual-reference-pack

## Цель

Собрать канонические визуальные референсы текущей игры в репозиторий + индекс + task-card’ы для visual/art-агентов, чтобы раздавать задачи без пересылки скриншотов в чат. Без кода игры.

## Сделано

- `docs/visual-refs/README.md` — индекс: канонические скрины, целевой характер, что утверждено/нельзя ломать;
- `docs/visual-refs/current-game/` — 4 скриншота playable `viewer/visual-proto` (1280×800, main @ `927c05e`):
  - `01-combat-main.png` — основной бой (Пролог 1, Goblin Shaman);
  - `02-combat-overlay.png` — бой с попапом;
  - `03-hud-player.png` — player HUD + Rotate крупно;
  - `04-scene-composition.png` — композиция multi-enemy (Act I, 2 волка, плашки таймер+HP);
- скрины сняты локально через Playwright (сборка `dist/` для съёмки, в коммит не входит);
- task-card’ы ссылаются на `docs/visual-refs/`:
  - обновлены: `ART-010-ui-style-base`, `ART-011-reward-choice-screen`, `ART-012-player-hud` (добавлены разделы «Референсы» + `RESULT / VERIFY / FOUND / STATUS`);
  - созданы: `ART-013-victory-and-boss-popups`, `ART-014-item-and-loadout-presentation` (покрывает BOARD ART-014 + ART-015).

## Не делать

- Не расширять пак без команды (3–6 скринов достаточно).
- Не принимать визуальные решения за пользователя — пак только фиксирует текущее состояние.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: пак и 5 task-card’ов в ветке `docs/ART-REFS-001-visual-reference-pack`, см. `docs/visual-refs/README.md`.
- VERIFY: скрины открыты глазами (бой/попап/HUD/композиция рендерятся); `git status` чистый кроме файлов задачи; push на `origin/docs/ART-REFS-001-visual-reference-pack`.
- FOUND: старые пути ассетов (`assets/boss-*.png`, `board-frame.png` и т.д.) дают 404 в консоли, игра при этом рендерится через species-каталог — на пак не влияет, чиню не здесь. Верхняя admin-плашка перекрывает сцену — известный debug shell (чистится в UI-001, кнопка ⚙).
- STATUS: DONE
