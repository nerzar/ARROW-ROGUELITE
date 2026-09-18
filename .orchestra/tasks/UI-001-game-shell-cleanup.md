# TASK: UI-001 — Game Shell Cleanup

STATUS: DONE
TYPE: FIX
SIZE: S/M
BASE_BRANCH: main
BRANCH: fix/UI-001-game-shell-cleanup
START_SHA: 84348adc95d4b056d221d67221b91e29d9e1565a

## Goal

Исправить три уже подтверждённые пользователем проблемы обычной игровой web-версии. Это НЕ mobile-polish задача.

## Нужно

### 1. Скрываемый административный UI

В игровой версии должна быть возможность получить чистый game view без административных/debug controls.

- скрываются служебные кнопки/ссылки/панели, не нужные игроку;
- dev/debug доступ не теряется;
- способ включить/выключить admin UI должен быть простой и явный;
- Campaign Editor / Pose Editor не ломать.

### 2. Убрать кашу в левом верхнем углу

Сейчас там конкурируют заголовок/scene info/описание/служебные элементы.

Развести их так, чтобы:
- игровой HUD читался;
- служебный текст не наслаивался;
- в clean game view лишний developer text не занимал игровое поле.

**Конкретная находка с live-проверки (18 сентября, `cp-e5` Goblin Shaman, 480×700):** `div.hint-line` (текст "Цель: ...") и кнопки `hint`/`debug` рендерятся в одной и той же области экрана (`hint-line` rect ~x:101-239 y:44-59 пересекается с rect кнопок `hint`/`debug` y:46-73) — то есть это не просто "тесно", а прямое наложение одних элементов на другие. Хорошая отправная точка для repro.

### 3. Scene dropdown показывает активную сцену

Dropdown должен отражать ФАКТИЧЕСКИ текущую runtime scene:
- после ручного выбора;
- после загрузки baked arena;
- после перехода к следующему encounter/scene;
- после restart/reset, если активная сцена изменилась.

Не держать select и runtime scene как два расходящихся источника истины.

## Boundaries

- Не делать mobile responsive/safe-area/touch работу — это отложенный MOB-001.
- Не менять gameplay.
- Не менять VFX.
- Не переделывать Campaign/Pose Editor.
- Не расширять задачу в большой redesign shell-а.

## Verify

- clean game view реально скрывает admin/debug clutter;
- dev/debug controls можно вернуть;
- левый верхний угол не наслаивается;
- scene dropdown совпадает с runtime scene на переходах;
- Prologue и текущие Act I test encounters открываются как раньше;
- tests + typecheck + build;
- browser check без page errors.

## Delivery

Коротко:
- RESULT
- VERIFY
- FOUND
- SHA
- URL
- как скрыть/вернуть admin UI

Commit + push. Не merge в main.

## RESULT

- Clean game view: `?clean=1`, кнопка ⚙ справа внизу, localStorage; `body.clean` прячет admin-only (baked arena, ссылки, debug toggle) и force-скрывает debug-панель. Editors не тронуты.
- Top-left overlap: topbar больше не врапается (nowrap + horizontal scroll, фиксированная высота) — hint-line на top:44px ничего не перекрывает.
- Scene truth: `scene-sync.js` (pure) + `syncScenePick()` в `loadActiveStep`; позиция run побеждает entry key на advance; debug-борды показывают transient option с живым названием.

## VERIFY

- tests 28 файлов / 325 OK (новый `ui-001-scene-sync.test.ts`); typecheck OK; build OK.
- Browser 11/11: clean скрывает/возвращает/персистит; ручной выбор/baked/возврат truthful; prologue + act1 открываются; 480x700 без наложений; pageerrors 0.

## FOUND

- Advance-маппинг проверен юнитом (позиция > entry key), не живым переходом: живой advance требует выигранного этапа, руками долго; кодовый путь тот же `loadActiveStep`.
- Transient debug option переиспользуется одна (`__debug__`), текст обновляется под текущий борд.
