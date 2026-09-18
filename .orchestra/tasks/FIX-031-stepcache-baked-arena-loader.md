# TASK: FIX-031 — Restore Baked Arena Loader stepCache

STATUS: READY
TYPE: FIX
SIZE: S
BASE_BRANCH: main
BRANCH: fix/FIX-031-stepcache-baked-arena-loader
START_SHA: a0de83d74c001cd5f98a9f556b9ca227622419a7

## Problem

На текущем main baked-arena loader из FIX-023 падает с:

`stepCache is not defined`

Наблюдение из BUILD-034:
- ошибка в `spikes/arrow-core/viewer/visual-proto/app.js` около текущей строки 840;
- `stepCache` используется также раньше в файле, но не объявлен;
- из-за этого кнопка `load` для baked-арен не работает;
- BUILD-034 этот баг не вносил.

## Goal

Минимально восстановить загрузчик baked-арен на main.

## Required

1. Сначала воспроизвести ошибку на этой базе.
2. Найти, каким должен быть жизненный цикл/cache state у FIX-023; не вводить случайный глобал только чтобы убрать ReferenceError.
3. Исправить только причину `stepCache is not defined` и связанные с ней прямые поломки loader path.
4. Не менять calibration semantics, encounter/gameplay или arrow renderer.

## Verify

- кнопка `load` реально загружает baked arena в браузере;
- повторная загрузка/смена baked arena не падает;
- editor/playable calibration остаётся согласованной;
- tests + typecheck + build.

В конце коротко: RESULT / VERIFY / FOUND. Не merge в main.
