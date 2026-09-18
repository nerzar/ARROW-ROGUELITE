# TASK: MOB-001 — Mobile/Game UI Polish

STATUS: DEFERRED
TYPE: FIX
SIZE: M
BASE_BRANCH: main
BRANCH: fix/MOB-001-mobile-game-ui-polish
START_SHA: 72b4e17eb4bbb03fb896fbc13e9b40d27e53f79b

## Deferred

Не запускать до явной команды пользователя. Пользователь решил, что сейчас для mobile polish рано.

Когда задача будет разморожена, архитектор должен сначала обновить BASE/START_SHA на свежий `main`; не начинать реализацию с текущего старого START_SHA вслепую.

## Goal

Довести текущую playable web-версию до аккуратного game/mobile landscape UI без отдельного mobile rewrite.

Пользователь уже вручную проверил landscape примерно 740×360 и более крупный размер: сама арена, board и композиция в целом работают. Нужны точечные UI/UX фиксы.

## Нужно

1. Game mode без административного UI
- В обычной игровой версии административные/debug controls должны быть скрываемыми целиком.
- Нужен явный dev/debug способ вернуть их (query/debug toggle — выбрать простой существующий подход).
- Не ломать доступ к Campaign Editor / debug для разработки.

2. Верхний левый угол
Сейчас там накладываются/смешиваются:
- заголовок Prologue Playtest / scene;
- описание/инструкции;
- служебные ссылки/controls.

Развести layout так, чтобы в game mode там не было каши.
На маленьком landscape ничего важного не должно перекрывать арену/HUD.

3. Scene dropdown
Dropdown scene должен всегда показывать ФАКТИЧЕСКИ активную сцену:
- после ручного выбора;
- после load baked arena;
- после перехода между этапами/сценами;
- после restart/reset, если активная сцена меняется.

Не держать UI select и runtime scene state как два расходящихся источника истины.

4. Mobile landscape polish
Без отдельной mobile codebase:
- проверить 932×430, 844×390, 740×360 и 1024×600;
- player HUD на самых низких landscape экранах можно слегка уменьшить через responsive clamp, если требуется;
- учесть CSS safe-area `env(safe-area-inset-*)` для screen UI;
- не растягивать/ломать arena/board;
- touch/click остаются на текущем gameplay path;
- если мелкие стрелы реально трудно нажимать, записать FOUND; не менять gameplay/hit logic молча.

5. Не дублировать CAL-005
Enemy HUD anchor/pivot/shadow — задача CAL-005.
Если MOB-001 зависит от результата CAL-005, использовать его после интеграции, а не строить второй механизм offsets.

## Boundaries

- Не менять gameplay/balance.
- Не делать отдельную portrait-версию.
- Не вводить React Native/Unity/отдельную mobile codebase.
- Не переделывать Campaign/Pose Editor.
- Не заниматься финальным VFX/audio.
- Пользователь сам делает финальную визуальную проверку на mobile viewport/реальном телефоне.

## Verify

Минимум:
- desktop обычный размер;
- 932×430;
- 844×390;
- 740×360;
- 1024×600;
- game mode без admin/debug clutter;
- dev/debug controls можно вернуть;
- scene dropdown совпадает с runtime scene после load/transition/restart;
- board/mobs/player HUD остаются видимы;
- tests + typecheck + build.

## Delivery

Коротко:
- RESULT
- VERIFY
- FOUND
- SHA
- URL для ручной проверки
- как включить/выключить admin/debug UI

Commit + push. Не merge в main.
