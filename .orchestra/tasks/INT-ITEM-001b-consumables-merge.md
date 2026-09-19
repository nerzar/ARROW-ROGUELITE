# TASK: INT-ITEM-001b — свести Зелье / «Стрела» / Матрона-камни в main

STATUS: DONE ON BRANCH — `build/ITEM-001-inventory-reward-draft` @ `099d753`, ждёт разрешения пользователя на no-ff merge в main
TYPE: INTEGRATION
SIZE: M
AGENT: техлид (Claude) — знает обе стороны конфликта
BASE_BRANCH: main
BRANCH: `build/ITEM-001-inventory-reward-draft` @ `dcbd231` (merge `origin/main` в неё, затем no-ff в main)

## Цель

В main попала только первая половина ITEM-001 (`46d83f2`). Вторая итерация `dcbd231`, сделанная по прямым решениям пользователя, потеряна при сборке `integration/afternoon-batch-2`:

1. **Зелье** (`potion`) вместо Фляги: расходник, +3 HP, до 3 зарядов, награда/покупка добавляет +1;
2. **«Стрела»** (`arrow`, `spawn_arrow`): расходник, до 5 зарядов (награда +2), создаёт на доске одну стрелу в выбранном направлении (`EncounterState.spawnPlacement/spawnArrow`, одноклеточный fallback на плотных досках, undo восстанавливает board/level);
3. **несколько способностей у врага** (`EnemyDef.abilities[]`, `abilitiesOf`), Матрона = `heal` каждые 2 хода + `kids_rocks` (stone throw, pin 2) каждые 3 — в briefs b8/b9/b14/b17 и в `campaign.json`;
4. драфт: золото · зелье (если ранен и зелье не полное) | +1 Rotate · редкий предмет 30 % / стрелы ×2 35 % / золото ×2;
5. тест честности «с набором» (`build-027`): 0 урона при Лук+Щит во всех 18 stage'ах; 15/17 обычных — 0 урона и голыми руками (исключения 14 и 17).

## Что конфликтует (пробный merge 2026-09-19)

`spikes/arrow-core/src/encounter.ts`, `src/items.ts`, `src/run-state.ts`, `viewer/visual-proto/app.js`, `viewer/visual-proto/board-renderer.js` — всё против ITEM-002 (каталог, веса, реликвии) и PRESENT-001 (HUD-строки способностей).

## Нужно

- `items.ts`: каталог ITEM-002 + `potion`/`arrow` вместо `health_flask`; `weight` у новых расходников; `isConsumable`/`maxCharges` сохранить;
- `run-state.ts`: правило драфта из `dcbd231` поверх весов ITEM-002 (`relic` карточка остаётся в пуле редкой третьей карты);
- `encounter.ts`: `abilities[]`, countdown `number[][]`, `spawnArrow` — поверх WAVE-001 `enemyPending`/`arrival` (проверить, что спавн стрелы не ломает `arrival.onTurn`, а pending-враги не получают countdown до прихода);
- `board-renderer.js` / `ability-hud.js`: строки per-ability для Матроны (HEAL + THROW), intro-строка снова обещает THROW, когда у врага есть stone-способность (отменить текстовую часть FIX-034);
- `test/fix-034-matron-stone-pin.test.ts` переписать: Матрона несёт `['heal','stone_throw']`, pin реально блокирует стрелу (это и был исходный баг-репорт пользователя — проверить в браузере на stage 8 после сведения);
- `app.js`: `useItem` с `spawn_arrow` (обновление `level`/`renderer.resize`) поверх PRESENT-001 pending-safe hit check;
- иконки: ASSET-009 добавить `potion` и `arrow` (пути под `ITEMS[id].id`).

## Не делать

- не менять правила ITEM-002 предметов/реликвий;
- не трогать campaign кроме Матроны (b8/b9/b14/b17) и `campaign.json` пересборки `tools/ld007-build-campaign.mjs`;
- не мержить в main без решения пользователя.

## Готово, если

- `npm run build && npx vitest run` зелёные (ожидаемо ≥ 39 файлов);
- в браузере на stage «Акт I · 8 · Матрона»: HUD показывает HEAL и THROW, камень пинит стрелу, «Стрела» создаёт стрелу и попадает в Матрону, Зелье лечит и складывается;
- `?items=arrow,potion,bow` стартовый набор работает;
- ветка запушена, SHA в отчёте.

## RESULT (2026-09-19, Claude)

- main (`e69cd10`, включая MAP-001) влит в ветку; 5 конфликтов решены с сохранением обеих сторон.
- `items.ts`: каталог ITEM-002 + `potion`/`arrow` (`weight: 0` — не попадают в редкую карту), `health_flask` удалён.
- `run-state.ts`: драфт = золото · зелье|rotate · взвешенный редкий предмет/реликвия (30 %) → стрелы ×2 (35 %) → золото ×2.
- `encounter.ts`: `abilities[]` поверх WAVE-001 (приходящий враг получает countdown на каждую способность), `relics` + `level` в конструкторе/clone.
- `board-renderer.js`: строка и чип на каждую способность (Матрона: HEAL + THROW); `app.js`: intro собирает `ability` + `abilities[]`.
- `test/fix-034-matron-stone-pin.test.ts` переписан: Матрона = heal + stone_throw, камень реально пинит, tap по запиненной стреле отклоняется.
- Проверено в браузере (stage 8): intro «THROW … PINNED … HEAL», камень запинил #0 (`tap #0 !! pinned`), «Стрела» → #15 попала в Матрону, Зелье лечит.
- `npm run build && npx vitest run`: 40 файлов / 450 тестов зелёные.
- Осталось после merge: ASSET-009 иконки `potion` / `arrow`; воспроизвести исходный баг-репорт FIX-034 на новом main глазами пользователя.

После сдачи STOP.
