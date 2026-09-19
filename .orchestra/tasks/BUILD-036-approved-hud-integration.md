# TASK: BUILD-036 — Approved HUD Integration

STATUS: DONE
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

- RESULT: четыре approved PNG подключены byte-for-byte как skins реального playable; name, HP fill/numbers, timer/ability state и Rotate charges читаются из gameplay state.
- FILES: runtime HUD assets; `assets.js`; `index.html`; `style.css`; `app.js`; `board-renderer.js`.
- SCENES CHECKED: `cp-e5` Goblin Shaman; `authored-0` Goblin King/Taunter; `authored-22` Goblin King boss; `authored-11` Act I multi-enemy; `authored-18` shield/ability states.
- VERIFY: `node --check`; `npm run build`; `npm test` — 37 files / 417 tests; browser gameplay checks with changing HP, Rotate 1→0, ATK/CAST/SHD/HEAL; source/runtime PNG SHA-256 pairs match.
- FOUND: в компактной admin-композиции существующий scene selector может перекрывать HUD верхнего слота; species offsets, placement и selector оставлены без изменения по scope.
- SHA: `79bb46e281f813edcf09bd9faae73827891bd307`
