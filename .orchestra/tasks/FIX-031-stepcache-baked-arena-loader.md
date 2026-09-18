# TASK: FIX-031 — Restore Baked Arena Loader stepCache

STATUS: DONE
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

## RESULT

Загрузчик baked-арен восстановлен. В loader path было ДВЕ поломки, вторая пряталась за первой.

1. `stepCache is not defined` — обе строки `stepCache.set(step.id, step)` в `loadSquareDebug`
   и `loadBakedArenaDebug` удалены, а не переподключены импортом. Кеш живёт в
   `prologue-steps.js` как приватный Map, ключуется по `scene.key` и читается только
   `getStep()`. Эти debug-шаги синтезируются на месте, ключуются по `step.id` и уходят прямо
   в `new RunState(...)` — прочитать их обратно было невозможно, запись только засоряла бы
   кеш сцен чужими ключами. Причина появления: CAL-004 вынес кеш в отдельный модуль, а вызовы
   в app.js остались. Рядом оставлен комментарий, чтобы строку не «восстановили» обратно.

2. `Cannot read properties of undefined (reading 'phases')` — всплыла сразу после первого
   фикса, потому что раньше loader падал до неё. В `loadBakedArenaDebug` присваивание
   `run = new RunState(...)` стояло ПЕРЕД `await loadImageEl(calib.background)`, а `def` и
   `bossVisual` обновлялись только в `loadActiveStep()` после await. На время загрузки
   картинки оставалось окно, где render loop видел новый `run` против старого `def`;
   попавший в это окно rAF падал в `readBossSnapshot`. `run = new RunState(...)` перенесён
   вплотную к `loadActiveStep()` — половинчатое состояние сцены больше не наблюдаемо.

Calibration semantics, encounter/gameplay и arrow renderer не тронуты.

## VERIFY

- воспроизведено на START_SHA до правки: клик `load` не менял арену, в консоли
  `ReferenceError: stepCache is not defined`;
- после правки прогнана последовательность из 8 переходов в браузере:
  boss-сцена → baked → обычная сцена → baked → baked → авторская сцена → baked → тот же baked
  повторно. Все загрузились (`ironvow-6x6`, `demonforge-10x8` 10x10/20 стрел,
  `grimskull-5x5`, `autumnfall-8x7`), ошибок в консоли ноль;
- смена baked-арены подряд и повторная загрузка той же арены не падают;
- возврат на обычную сцену восстанавливает фон, calibration сбрасывается;
- tests 310 passed, typecheck чисто, build чисто.

## FOUND

- Вторая поломка (`phases`) была замаскирована первой: пока loader падал на ReferenceError,
  он не доходил до окна рассогласования. Любой фикс только первой ошибки выглядел бы
  рабочим ровно до первого переключения с boss-сцены на baked-арену.
- `readBossSnapshot` защищается от enemies-режима (`def.enemies`), но не от def без `boss`
  вообще. Сейчас это не воспроизводится — окно рассогласования убрано, — но инвариант
  остаётся неявным. Отдельную защиту не добавлял: это уже не причина, а симптом.

