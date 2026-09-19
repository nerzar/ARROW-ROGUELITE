# TASK: BUILD-036 — Approved HUD Integration

STATUS: IN PROGRESS
TYPE: BUILD
SIZE: M
BASE_BRANCH: art/ART-012B-approved-hud-adaptation
START_SHA: 600fcc72a6fd73a02de9239892b30c551203dfcb
BRANCH: build/BUILD-036-approved-hud-integration

## Цель

Подключить четыре утверждённых PNG HUD-assets напрямую в реальный `spikes/arrow-core/viewer/visual-proto/`, сохранив динамические gameplay-значения и существующую композицию арены.

## Входы

- approved regular enemy HUD frame;
- approved boss HUD frame;
- approved player HUD frame с портретом;
- approved Rotate button.

## Ограничения

- PNG используются byte-for-byte как skin: без кропа, перерисовки, генерации или CSS-реконструкции рамок.
- HP fill, HP numbers, name, timer/ability state и Rotate charges остаются динамическими и читают реальный gameplay state.
- Сохраняются species HUD offset/scale, boss positioning и Rotate gameplay.
- Не менять arena, board, arrows, enemy placement, combat/gameplay rules и `src/` без технической необходимости.
- Не добавлять новые controls, Level, currencies, End Turn или sidebar.

## Проверка

- Prologue: Goblin Shaman.
- Goblin King/Taunter.
- Act I multi-enemy.
- Разные HP и Rotate charges.
- Enemy timer, shield и ability HUD states.
- Build/test и визуальная проверка в настоящем playable.

## RESULT / FILES / SCENES CHECKED / VERIFY / FOUND / SHA

- RESULT: pending
- FILES: pending
- SCENES CHECKED: pending
- VERIFY: pending
- FOUND: pending
- SHA: pending
