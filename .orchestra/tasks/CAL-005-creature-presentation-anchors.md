# TASK: CAL-005 — Creature Presentation Anchors

STATUS: READY
TYPE: TOOL/FIX
SIZE: M
BASE_BRANCH: main
BRANCH: tool/CAL-005-creature-presentation-anchors
START_SHA: a0de83d74c001cd5f98a9f556b9ca227622419a7

## Goal

Расширить существующий Pose/Calibration workflow так, чтобы presentation существа можно было нормально подогнать под арт, а HUD не уезжал за видимую область.

## Нужно

1. Добавить species-level HUD offset X/Y с live preview.
   Один общий anchor/offset должен двигать привязанные к мобу элементы presentation:
   - HP bar;
   - attack timer / ATTACK IN;
   - cast/status UI, если они используют тот же HUD anchor.

2. Проверить существующий species pivot/anchor.
   Сейчас есть подозрение, что pivot применяется не везде одинаково.
   Editor preview и playable runtime должны трактовать pivot одинаково на idle/attack/hit/defeat и для boss/обычного моба.

3. Если это не требует большого рефакторинга — добавить species-level shadow offset X/Y.
   Тень двигается независимо от art pivot.
   Если для этого нужен заметный renderer rewrite — остановиться и записать FOUND, не расширять scope молча.

4. Сохранение/reload.
   Новые presentation defaults должны сохраняться рядом с текущими species pivot/scale и после reload давать тот же результат.
   Существующие сохранённые данные должны оставаться совместимыми.

## Existing local authoring data to protect

В worktree BUILD-034 сейчас есть незакоммиченные изменения, созданные через Pose Editor:
- `creature-poses.json`: Goblin Shaman scale/pivot и Dire Wolf pose/pivot;
- `assets/enemies/dire-wolf/idle.png`.

Это НЕ считается автоматически принятым контентом CAL-005.

Перед любым cleanup:
- не откатывать и не терять эти файлы;
- сначала сохранить snapshot/отдельный commit/ref;
- при работе CAL-005 использовать их только как возможный исходный authoring data после проверки, а не тащить молча в результат.

## Boundaries

- Не менять combat/gameplay.
- Не менять arrow renderer.
- Не делать per-pose HUD/shadow настройки без отдельного решения пользователя.
- Per-scene calibration, если она уже существует для соответствующего параметра, остаётся финальным override.

## Verify

Проверить минимум:
- Goblin Shaman;
- Goblin King;
- Dire Wolf или обычный mob;
- defeat pose;
- смену poses в editor;
- save -> reload -> playable runtime;
- HUD не вылезает из видимой области после ручной настройки;
- tests + typecheck + build.

## Done

Пользователь может в editor для вида существа настроить:
- pivot X/Y;
- scale;
- HUD offset X/Y;
- shadow offset X/Y, если реализовано без крупной переделки;

сохранить и увидеть то же положение в реальной игре.

В конце коротко: RESULT / VERIFY / FOUND. Не merge в main.
