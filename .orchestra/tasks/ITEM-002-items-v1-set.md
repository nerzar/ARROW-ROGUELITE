# TASK: ITEM-002 — Предметы v1: Frost Dart, Pocket Gyro, War Horn + первые реликвии

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Gemini / Antigravity
BASE_BRANCH: main
BRANCH: build/ITEM-002-items-v1-set

## Цель

Довести набор наград до 6 активных предметов + 3 пассивных реликвий, чтобы draft «1 из 3»
давал реальный выбор между четырьмя осями: урон / защита / время / направление.

## Контекст

`ITEM-001` даёт каркас (инвентарь, действие `item`, draft, солвер). Числа — `docs/BALANCE-SYSTEM.md`.

## Нужно

Активные (через тот же data-driven формат, что Bow/Shield/Flask):
- **Frost Dart** — 1 DU в выбранную цель + её `ATTACK IN` +2, `1/E`, Turn Cost 1;
- **Pocket Gyro** — +1 Rotate на входе в каждый бой (encounter-local, не в shared pool), пассивный;
- **War Horn** — следующая попавшая puzzle-стрела +1 DU, `1/E`, Turn Cost 0.

Реликвии (пассивные, из `docs/GAME-CONCEPT.md` §8 / BALANCE-SYSTEM):
- **Waste Conversion** — стрела ушла в пустую сторону → следующий hit +1 DU (не стакается);
- **Keystone Release** — первый раз за бой, когда один tap освободил ≥2 стрелы, ближайший enemy timer +1;
- **Safety Fuse** — первый blocked tap в бою без HP-штрафа.

Draft-пул: веса/редкость условные (`common/rare`), но в данных, не в коде.

## Готово, если

- все 9 эффектов проверены тестами, солвер учитывает Frost Dart/War Horn/Gyro;
- реликвии показываются в HUD как пассивный ряд (плейсхолдер);
- `tools/ld007-audit.mjs` умеет запускать аудит «с набором» (`--kit bow,shield`), чтобы `LD-008`
  мог балансировать уровни под предметы.

Перед сдачей запусти tests/typecheck/build и реальный viewer. Оставь локальный viewer-сервер запущенным и укажи URL для быстрой пользовательской проверки.

После сдачи STOP.

## Итог выполнения

1. **Active Items & Relics Definition (`items.ts`)**:
   - Добавлены `frost_dart`, `pocket_gyro`, `war_horn` в `ITEMS` со спецификацией из `BALANCE-SYSTEM.md` и полями `rarity` (`common`/`rare`) и `weight`.
   - Добавлены реликвии `waste_conversion`, `keystone_release`, `safety_fuse` в `RELICS` с полями `rarity` и `weight`.
   - Экспортированы `RELIC_IDS`, `itemNeedsTarget(id)`, `itemIsPassive(id)`.

2. **Core Encounter Logic (`encounter.ts`, `state.ts`)**:
   - `Pocket Gyro`: даёт +1 локальный `localBonusRotate` при входе в бой (если повороты разрешены). Тратится до shared pool, не раздувает пул при clone/undo.
   - `Frost Dart`: наносит 1 DU + добавляет +2 к таймеру цели (`ATTACK IN`/`CAST IN`), сдвигает ход мира (Turn Cost 1).
   - `War Horn`: активирует бафф `warHornActive` (Turn Cost 0), усиливающий следующую попавшую стрелу с поля на +1 DU. Промахи и выстрелы предметов не сжигают и не тратят бафф.
   - `Waste Conversion`: промах стрелы в пустую сторону взводит `wasteConversionReady`; следующее попадание наносит +1 DU (не стакается).
   - `Keystone Release`: при первом за бой освобождении ≥2 стрел одним тапом, ближайший живой враг получает +1 к таймеру (`isKeystoneTriggered`).
   - `Safety Fuse`: первый blocked tap в бою снимает 0 HP (`safetyFuseUsed = true`), последующие наносят стандартный урон.
   - Поддержка `timerSnapshot`, `restoreTimer`, `clone`, `undo`, `key` для всех новых состояний.

3. **RunState & Draft (`run-state.ts`)**:
   - Поддержка списка реликвий `run.relics`, `addRelic`, `hasRelic`, `startingRelics` в конфигурации забега.
   - Взвешенный draft на 3-й карте по `weight` среди неполученных предметов и реликвий.
   - Полная сериализация и восстановление реликвий (`toJSON`/`fromJSON`).

4. **Audit Tool (`tools/ld007-audit.mjs` & `spikes/arrow-core/tools/ld007-audit.mjs`)**:
   - Добавлен флаг `--kit <items,relics>`.
   - Создаёт инвентарь и реликвии, симулирует шаги с действиями предметов, выводит аудит с учётом кита.

5. **Visual Proto Viewer (`viewer/visual-proto/`)**:
   - `items-ui.js`: добавлена строчка `.relic-row` со статусом реликвий (`.relic-chip`, `.spent`, `.primed`), индикаторы активных баффов (`.item-buff.horn`, `.item-buff.waste`), пассивный стиль для `pocket_gyro` (`(пассив)`). Поддержка драфта карт реликвий (`.reward-relic`).
   - `app.js`: парсинг `?relics=` из URL query params в `runConfig.startingRelics`.
   - `style.css`: стили для строки реликвий, чипов, баффов и карт наград.

6. **Тесты и верификация**:
   - Добавлен специализированный набор тестов `test/item-002-items-v1.test.ts` (14 тестов, покрывающих все 9 эффектов, солвер, драфт и персистентность).
   - Все 38 тестовых файлов (431 тест) проходят чисто: `npm test` ✅.
   - `npm run build` компилируется без ошибок: `tsc -p tsconfig.json` ✅.
   - Аудит проверен: `node tools/ld007-audit.mjs --kit bow,shield,waste_conversion` ✅.
   - Локальный сервер запущен: `http://localhost:5179/viewer/visual-proto/?items=frost_dart,pocket_gyro,war_horn&relics=waste_conversion,keystone_release,safety_fuse`

