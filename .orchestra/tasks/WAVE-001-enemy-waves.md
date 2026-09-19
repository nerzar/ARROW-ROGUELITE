# TASK: WAVE-001 — Волны врагов («одного убил — пришёл второй») с телеграфом

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Codex
BASE_BRANCH: main
BRANCH: build/WAVE-001-enemy-waves

## Цель

Бой должен длиться столько, сколько идёт очередь врагов, а не заканчиваться на 5-м ходу, когда
доска на 20 стрел только начала играть. Враг может **появиться позже** — по смерти предшественника
или на N-м ходу — и игрок видит это заранее.

## Контекст

- Арена: 3 слота (N/E/W), один живой враг на сторону (`targetIndexAt`).
- `EncounterState` уже умеет «врага нет на арене» для fled/expired (`isGone`) — волна = то же
  состояние, только в обратную сторону (ещё не пришёл). `worldTurn` уже считается (ACT-I-003).
- Больше стрел = больше ходов: профили `short` 8x8 ≈ 18, 9x9 ≈ 23, 10x10 ≈ 28 стрел
  (`viewer/visual-proto/board-profiles.js`); арены под 10x10 есть.

## Нужно

1. `EnemyDef.arrival?: { afterKill?: string; onTurn?: number }` — враг отсутствует, пока условие не
   выполнено; появляется в конце того world turn, когда условие стало истинным. Если его сторона
   занята живым врагом — ждёт освобождения (без падения, детерминированно).
2. Пришедший враг стартует со своими таймерами «с нуля» в момент прихода (`ATTACK IN interval`),
   способности — тоже. `enemies` getter отдаёт `pending: boolean` + `arrivesIn?: number` (для
   `onTurn`) / `arrivesAfter?: id`.
3. Win: pending mandatory враг блокирует «все убиты», board-clear остаётся fail-safe.
4. Snapshot/undo/clone/key учитывают pending-состояние; солвер видит будущих врагов.
5. Viewer: над пустым подиумом плашка **«СЛЕДУЮЩИЙ: <имя> через N»** / «после <кто>» с силуэтом
   (species idle с затемнением); приход = появление + короткий импульс; лог `ARRIVED: <id>`.
6. `checkEncounter`: цикл зависимостей `afterKill` запрещён; `afterKill` на несуществующий id — ошибка.
7. Debug encounter-fixture с 2 волнами; production campaign не менять (это `LD-008`).

## Не делать

- summon как enemy ability (динамический список врагов) — отдельная тема;
- 4-й слот арены;
- баланс Act I.

## Готово, если

- волновой fixture играется, телеграф читается до прихода;
- очередь из 3 врагов на 3 сторонах проходится, солвер/аудит дают min damage;
- тесты: приход по kill, по ходу, ожидание занятой стороны, undo через приход.

После сдачи STOP.

## RESULT

- Добавлены `arrival.afterKill` / `arrival.onTurn`, pending-state, ожидание занятой стороны в порядке `enemies`, свежие attack/ability timers при приходе. При двух условиях требуются оба; `onTurn` — целый ход от 1.
- Pending учитывается в targeting, abilities, snapshot/undo/clone/key; mandatory pending блокирует раннюю победу, board-clear сохранён. Валидация запрещает неизвестные id, циклы и повторные enemy id.
- Viewer показывает следующего врага силуэтом и плашкой над свободным подиумом, при приходе — импульс; viewer/audit логируют `ARRIVED`. Fixture `encounters/wave-001.json` доступен как `Debug · WAVE-001 · Две волны`; production campaign не менялась.

## VERIFY

- `npm run build` — PASS; полный `npm test` — 402/402 PASS, затем расширенный `enemy-waves.test.ts` — 13/13 PASS (включая ещё 3 проверки blocked/pinned taps и min damage будущих врагов).
- Audit fixture: proven min damage 0 без Rotate, все 3 врага убиты за 6 ходов: `0 → 6 → 5 → 10 → 9 → 1`. Отдельный тест проверяет последовательную цепь N → E → W и undo через приход.
- Браузер: обе плашки/силуэты, countdown до прихода, свежие ATK 3/2, оба `ARRIVED`, победа с HP 10/10; console errors отсутствуют. `git diff --check` — PASS.
- Ручной просмотр: открыть viewer, выбрать `Debug · WAVE-001 · Две волны`, оценить читаемость будущих врагов и их появление.

## FOUND

- Реализация: `2170026`, ветка отправлена в `origin/build/WAVE-001-enemy-waves` с явного разрешения пользователя; наличие коммитов на remote проверено. Блокеров нет.
- Если задан `expiresAfter`, он остаётся абсолютным world-turn deadline, как в исходном runtime. Визуальное принятие остаётся за пользователем.
