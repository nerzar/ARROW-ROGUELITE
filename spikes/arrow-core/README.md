# arrow-core — spike EXP-007

> Технический spike, не production. Стек игры и архитектура этим кодом **не утверждаются**.
> Результаты и выводы — в [REPORT.md](REPORT.md).

Pure TypeScript ядро Arrow / Tap Away без Phaser/React/Vue и без runtime-зависимостей:
модель доски, seeded RNG, прямой ray-blocking, reverse-construction генератор, solver/verifier,
difficulty metrics, property tests, CLI-бенчмарк и debug viewer.

## Команды

```
npm ci
npm run typecheck
npm test                                   # vitest + fast-check
npm run gen -- --preset hard --seed 42     # ASCII + метрики одного уровня
npm run bench -- --count 10000             # отчёт в bench-results/latest.json
npm run cli -- verify level.json           # проверить уровень из файла
npm run viewer                             # http://localhost:5177/viewer/#preset=medium&seed=1

# EXP-008: prologue mini-boss (см. EXP-008-REPORT.md)
npm run cli -- analyze --preset medium --seed 2908          # seed analyzer
npm run cli -- shortlist --count 3000                       # encounters/shortlist.json
npm run cli -- encounter encounters/prologue-miniboss.json  # validator
# viewer: http://localhost:5177/viewer/encounter.html

# EXP-009: gray prologue, encounters 1-4 chained (см. .orchestra/archive)
# viewer: http://localhost:5177/viewer/prologue.html

# EXP-010: combat pressure — player HP, blocked-tap damage, ATTACK IN N (см. EXP-010-REPORT.md)
npm run cli -- cp-shortlist --step 3 --count 4000            # encounters/cp-e3-shortlist.json
npm run cli -- encounter encounters/cp-e5.json --player-hp 10  # validator with a real starting HP

# EXP-010b: two simultaneous enemies (E4 redesign, см. EXP-010b-REPORT.md)
npm run cli -- encounter encounters/cp-e4.json --player-hp 10  # seed 10, grunt_e (E) + grunt_n (N)
# viewer: http://localhost:5177/viewer/cp-prologue.html  (E1-E5 chained through RunState)

# EXP-011: attack types — normal vs interruptible cast (см. EXP-011-REPORT.md)
npm run cli -- encounter encounters/cp-e5.json --player-hp 10  # mini-boss phase 2 now CAST IN N, proven 0-damage
# viewer shows CAST IN N / ATTACK IN N and "CAST ПРЕРВАН" on an interrupted cast

# EXP-013: enemy board abilities — Stone Throw pins an arrow (experiment, см. EXP-013-REPORT.md)
npm run cli -- encounter encounters/rock-spike.json --player-hp 10  # debug encounter, easy seed 15
# viewer: http://localhost:5177/viewer/rock-spike.html  (separate from the accepted prologue chain)
```

Node ≥ 20.

## Слои

```
Level            immutable: width, height, arrows[{id, cells tail→head, dir}], solution[]
  └ BoardTopology   immutable precompute: тела и лучи в typed arrays + индекс cell → лучи через неё
      └ BoardState     mutable: canExit / freeArrows / tryRemove / remove / undo / clone / key
          ├ solveBoard     work-list greedy, O(тела + лучи); peelLayers — слои зависимостей
          └ (будущий EncounterSolver — поверх BoardState, BoardSolver не трогает)

generateLevel(params, seed)  reverse construction → acceptance → независимый verifyLevel
computeMetrics(level)        базовые метрики сложности (provisional)
validateLevel / replayOrder  независимая проверка без BoardTopology/BoardState
```

| Файл | Что внутри |
|---|---|
| [src/dir.ts](src/dir.ts) | направления N/E/S/W по часовой, `rotateDir` — точка расширения для Rotate |
| [src/rng.ts](src/rng.ts) | sfc32 + splitmix32, `deriveSeed`, `hashString` |
| [src/level.ts](src/level.ts) | модель, `rayCells`, JSON-формат v1, `levelHash` |
| [src/topology.ts](src/topology.ts) | `BoardTopology` |
| [src/state.ts](src/state.ts) | `BoardState` с инкрементальным blocking и undo |
| [src/solver.ts](src/solver.ts) | `solveBoard`, `peelLayers` |
| [src/verify.ts](src/verify.ts) | `validateLevel`, `replayOrder`, `verifyLevel` |
| [src/generator.ts](src/generator.ts) | генератор |
| [src/metrics.ts](src/metrics.ts) | метрики |
| [src/presets.ts](src/presets.ts) | пресеты бенчмарка (не кривая сложности игры) |
| [tools/cli.ts](tools/cli.ts) | CLI `gen` / `verify` / `bench` / `analyze` / `encounter` / `shortlist` / `prologue` / `cp-shortlist` |
| [viewer/](viewer/index.html) | debug viewer |
| [test/](test/property.test.ts) | unit + property tests |
| [src/encounter.ts](src/encounter.ts) | `EncounterState`: boss phases OR simultaneous `enemies` (EXP-010b), Rotate, player HP / blocked-tap damage / `attackTimer` (EXP-010), `attackTimer.kind` normal/cast + interrupt (EXP-011), `EnemyDef.ability` (Stone Throw pin, EXP-013) |
| [src/encounter-solver.ts](src/encounter-solver.ts) | `findWin`, `maxHits`, `minDamageToWin` (EXP-010, both encounter shapes since EXP-010b), validator report, cast/interrupt-aware `describeAttackTimer`/`traceActions` (EXP-011), pin-aware `playableArrows()` search (EXP-013) |
| [src/run-state.ts](src/run-state.ts) | EXP-010 `RunState`: HP across chained encounters, restart-step/restart-run |
| [src/analyze.ts](src/analyze.ts) | seed analyzer; `hitTiming` (EXP-010) for timed-encounter shortlisting |
| [tools/cp-shortlist.ts](tools/cp-shortlist.ts) | seed shortlist for single-target timed encounters (EXP-010 E3; E4 is hand-authored multi-enemy content since EXP-010b) |

## Правила, на которых стоит ядро

1. **Blocking.** Стрелка может уйти ⇔ все клетки прямого луча от головы до края пусты. Собственное тело на луче — тоже препятствие. Больше ничего проверять не нужно: при выезде сегменты тела проходят только по клеткам, которые стрелка уже занимает или которые голова уже прошла.
2. **Монотонность.** Удаление стрелки только освобождает клетки, поэтому свободная стрелка остаётся свободной. Следствие: любой жадный порядок доходит до одного и того же финала, и «greedy застрял» ⇔ «уровень нерешаем». Следствие для encounter-слоя: из решаемой доски нельзя попасть в доску-тупик никаким порядком ходов.
3. **Reverse construction.** Стрелки кладутся в порядке, обратном порядку снятия; луч новой стрелки обязан быть чист от уже положенных и от её собственного тела. Обратный порядок укладки — всегда валидное решение, поиск не нужен.
4. **Дозаполнение дыр.** Хвост стрелки A можно удлинить в пустую клетку c, если все стрелки, чей луч проходит через c, положены раньше A (то есть уходят позже). Сохранённое решение остаётся валидным, а зависимостей становится больше.

## Происхождение идей

Код написан независимо, из доноров ничего не скопировано. Идеи и их источники:

- reverse construction и запрет телу заходить на свой луч — `AlenSarangSatheesh/Arrow-Escape-Game` (лицензии нет → только идея), `gtxPrime/arrow-escape`;
- work-list solver с обратным индексом «клетка → лучи», лемма монотонности, критерий «≤ N% свободных на старте» — `sergev/goarrows` (MIT);
- sfc32 / splitmix32 / fmix32 — общеизвестные public-domain алгоритмы.
