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
| [tools/cli.ts](tools/cli.ts) | CLI `gen` / `verify` / `bench` |
| [viewer/](viewer/index.html) | debug viewer |
| [test/](test/property.test.ts) | unit + property tests |

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
