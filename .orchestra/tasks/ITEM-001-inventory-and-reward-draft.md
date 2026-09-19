# TASK: ITEM-001 — Run inventory + reward draft (1 of 3) + первые 3 предмета

STATUS: READY
TYPE: BUILD
SIZE: L
AGENT:
BASE_BRANCH: main
BRANCH: build/ITEM-001-inventory-reward-draft
START_SHA:

## Цель

Первая рабочая петля roguelite-наград: после боя игрок выбирает 1 из 3 наград, предметы лежат в
run-инвентаре и реально меняют следующий бой. Без золота, магазина и RPG-склада.

## Контекст

- Экономика/единицы предметов уже зафиксированы: `docs/BALANCE-SYSTEM.md` (DU / HP Saved / Turns
  Gained / Flexibility / Charges / Turn Cost). Числа брать оттуда как baseline v0.1, не придумывать.
- `RunState` (`spikes/arrow-core/src/run-state.ts`) уже держит persistent HP и shared Rotate pool и
  один раз при `advance()` начисляет `winRotateReward` / `winHeal` — награды встраивать в эту же точку.
- `EncounterState` (`src/encounter.ts`) умеет `reward {heal, rotate}` на убийство (ACT-I-003) —
  использовать те же поля для лут-целей, не дублировать.
- Действия сейчас: `tap` и `rotate` (`EncounterAction`). Солвер (`src/encounter-solver.ts`) перебирает
  их через `playableArrows()` / `canRotate()`.
- Визуальные решения по экрану награды/HUD — exploration `ART-011` / `ART-012`. Эта задача делает
  функциональные заглушки (серые карточки/слоты), арт подставляется позже.

## Нужно

### Движок
1. `RunState.inventory`: 3 слота активных предметов (`ItemInstance {id, chargesLeft}`), список пассивных
   реликвий. Charges восстанавливаются по правилу предмета (`1/E` — на входе в бой, `1/R` — никогда).
2. Новое действие `{ kind: 'item', id, target? }` в `EncounterState`: применяет эффект, тратит charge,
   при `turnCost: 1` двигает мир как обычный ход (timers/abilities), логируется, undo/clone/key корректны.
3. Предметы v1 (data-driven `content/items.json` или TS-таблица, но не хардкод в EncounterState):
   - **Bow** — 2 DU в выбранную живую цель (target = side), `1/E`, Turn Cost 1;
   - **Shield** — поглощает до 2 HP следующего enemy damage, `1/E`, Turn Cost 0;
   - **Health Flask** — +3 HP (cap max), `1/R`, Turn Cost 0.
4. Reward draft: после победы `RunState` формирует 3 предложения из пула
   (`item` / `heal +3` / `rotate +1` / позже relic), `chooseReward(i)` применяет и только потом `advance()`.
   Детерминированный RNG от seed run'а — чтобы тест/replay воспроизводились.
5. Солвер: `findWin` / `minDamageToWin` перебирают `item`-действия наравне с tap/rotate
   (`WinQuery.maxItems?`), иначе аудит уровней (`tools/ld007-audit.mjs`) ослепнет.

### Viewer (функционально, без финального арта)
6. Панель предметов: 3 слота с charges, клик = использовать (Bow — затем клик по цели/стороне).
7. Экран награды: 3 карточки, выбор, «Продолжить». Плейсхолдеры в стиле текущих overlay'ев.
8. Лог/трасса: `ITEM: Bow -> guard_e (2)`, `SHIELD absorbed 2`, `FLASK +3`.

## Не делать

- золото, магазин, продажу, перетаскивание;
- новые enemy abilities;
- финальный UI-арт (ART-011/012/014/015);
- баланс уровней под предметы (это `LD-008`).

## Готово, если

- run от пролога до Goblin King проходится с выбором награды после каждого боя;
- Bow реально спасает бой, где нет стрел нужной стороны, и стоит ход;
- Shield/Flask работают и не ломают undo/restart;
- солвер находит линии с предметами; существующие 392 теста зелёные + узкие тесты предметов;
- `RunState` сериализуем (`toJSON`/`fromJSON`) — задел под VK saves, без самого сохранения.

После сдачи STOP.
