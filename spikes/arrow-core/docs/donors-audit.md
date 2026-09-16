# Исследование: техническое ядро Arrow Escape / Tap Away

Код проекта не менялся. Финальная архитектура не выбирается, реализация не выполнялась.

Проверены исходники через `raw.githubusercontent.com` и `api.github.com`, а не только README.

## 1. Три обязательные реализации — глубокий разбор

### A. `AlenSarangSatheesh/Arrow-Escape-Game` — самый ценный для Magic Arrow

Vanilla TypeScript + Vite, ноль зависимостей runtime, 2010 тестов, статическая раздача.

* Board: `src/core/types.ts` — стрелка = self-avoiding ортогональный путь `cells[tail..head]`, длина ≥2, `dir` выводится из последних двух клеток.
* Blocking: `src/core/board.ts` — `rayCells()` + `blockerIndex()`. Проверяется только прямой луч от головы до края, включая собственное тело. Доказательство в README: телу при выходе нужны только клетки, уже пройденные головой или занятые самой стрелкой.
* Генерация: `src/core/generator.ts` — reverse construction. `A_n` кладётся первой на пустую доску, `A_1` последней на почти полную. Каждый кандидат требует `clearRayLength() != null`. Тело растится назад self-avoiding walk с bias прямо, запретом заходить на собственный луч, бимодальными длинами (`skew deep 0.55 / late 1.8`), `most-constrained-first` упаковкой, `ATTEMPTS=40`, `MAX_MISSES=60`, кэш `Map<level, Board>`.
* Solvability: конструктивная, без поиска. `solution = placed.reverse()`. Дополнительно property-test: 500 сидов прогоняются в записанном порядке.
* Difficulty: `src/core/levelSpec.ts` — `cols 4→11`, `rows 5→14`, `maxBodyLen 4→20`, `turnProb 0.12→0.38`, `targetFill 0.55→0.9`, `minFill 0.5→0.72`, `minBlockedRatio 0→0.7`, `requiredBlocked = ceil(n*ratio)`. Отбор lexicographic: `minFill → enoughBlocked → fill`.
* Tests: `npm run test` — правила доски + 500 уровней на легальность, contiguity, наличие стартового хода.
* Format: кода как данных нет, уровень = `Board{cols,rows,arrows,solution}`, сид = `hashLevel(N)`, прогресс только в `localStorage arrows.progress.v1`.
* Perf: генерация одного уровня миллисекунды, кэшируется, `cloneBoard()` на старт. Анимация выхода через `stroke-dasharray/dashoffset` в SVG, конкурентные выходы, константная скорость головы.
* Порт: почти 1:1. `types/rng/board/generator/levelSpec` переносятся без изменений логики.

### B. `sergev/goarrows` — лучшая инженерная гигиена генератора

Go + tcell, терминал, MIT, 40 коммитов, сильная тестовая культура.

* Board: `game/board.go` — `Board{W,H,Data []Cell}`, `Cell{R rune}`: `0` пусто, иначе wire `─│┌┐└┘` или голова `^v<>`. Портовая модель в `ports.go`, `EffectivePorts`, `linked()`.
* Blocking: `RayEscapes` + `TryFire` в `game/game.go`. Луч от головы до края по `Delta(dir)`.
* Генерация: только `grow` (`game/gen.go`, `gen_grow.go`). Seed из двухклеточных голов с bitmap-проверкой `rayHitsHeadBitmap` за O(1), затем жадное наращивание хвостов в случайном порядке с `growStraightChance10=9`, маской `fireMasks` чтобы хвост не залез на собственный луч. Приёмка только при `ValidatePartialBoard + growPlayfulEnoughHeads (fireable ≤ 50%) + verifySolvableFastBuf`.
* Solver: три уровня в `game/solvable.go`: `VerifySolvableFast` work-list + обратный индекс `cellHeadsBy` за `O(K + ray_length)` вместо `O(K²N)`, `VerifyGreedyFirstClearsBoard` для тестов, `VerifySolvable` DFS-backtracking для малых досок. Ключевая лемма: удаление только открывает лучи, поэтому greedy достаточен.
* Difficulty: размер `(k+2)x(k+2)`, число голов `N<6→N; N<10→N²/6; иначе N²/10`, кап `wh/2`, до 60000 попыток, детерминизм через `-seed`.
* Tests: `levels_test.go`, `animation_test.go`, `flags_test.go`, `Makefile`.
* Format: файлов уровней нет, `game.Levels.At(seed)` строит on-demand и кэширует.
* Perf: `genScratch` переиспользует все буферы между попытками, нет аллокаций в горячем цикле.
* Порт: переписать типы на TS, скопировать инварианты `fireMasks`, `growPlayfulEnough`, `verifySolvableFast`.

### C. `gtxPrime/arrow-escape` — масштаб и контентный пайплайн, не ядро

Flutter + Flame, 54 звезды, 9 форков, 116 коммитов, 500 предгенерированных уровней в `assets/levels.bin` 741 КБ.

* Board: `LevelModel{gridSize, arrows[path, direction, colorGroup], orphanDots, maskShape}`, сетки 10×10→40×40, Boss/God силуэты 27×27+.
* Blocking: луч с учётом дефлекторов `orphanDots (U/D/L/R)` — выход может гнуться, плюс `colorGroup` пары с запретом взаимного дедлока.
* Генерация: `LevelGeneratorV2`: reverse-placement VeryLong→Long→Medium, gap-fill стрелками длины 2, дефлекторы, color-pairing, затем greedy-sim + DFS solver. Детерминизм `seed = level*103+51`. Офлайн `bin/pregenerate_levels.dart` (3 попытки на уровень, кэш `levels_cache/*.json`), затем `--compile` в bin.
* Solver: `lib/data/level_generator/solver.dart` + `LevelSolver.solve(level, 5000)` для ≤20, greedy order для больших. `_verifyLevel` проверяет solvability, deflection loops через `visited set`, color deadlock, cycle paths.
* Difficulty: 7 бэндов, цикл `Norm,Norm,Norm,BOSS,Norm,Norm,GOD`, таймеры `God 25+10..14s/стрелка`, `Boss 30+12..16s/стрелка` с clamp-формулами.
* Tests: ~20 файлов: `binary_codec_test`, `level_generator_test`, `verify_final_bin_test`, `gen_chunk_*`, `verify_chunk_*`.
* Format: `[HEADER 8B LVLB+version+count][INDEX 500×4B][DATA delta-paths, mask bitmask, dots]`, O(1) lookup.
* Perf: рантайм дешёвый (чтение bin), генерация дорогая и вынесена в билд-тайм.
* Порт: дорого. Дефлекторы и color-пары — отдельные механики, Flame-рендер не переносится. Брать только бинарный формат уровней и двухступенчатую верификацию.

## 2. Таблица кандидатов (20 + 2 отрицательных)

| # | Репозиторий / источник | Стек | Board / blocking | Генерация / гарантия | Solver / сложность | Тесты / формат / perf |
|---|---|---|---|---|---|---|
| 1 | `gtxPrime/arrow-escape` | Flutter/Flame/Dart | path+dir+dots+color, гнущийся луч | V2 reverse + verify, 500 преген | DFS/greedy 5000, таймеры Boss/God | 20 тестов, `levels.bin` 741КБ, рантайм O(1) |
| 2 | `sergev/goarrows` | Go/tcell | rune-grid + порты, прямой луч | grow + `VerifySolvableFast`, playful ≤50% | work-list O(K+rays), DFS для малых | Go-тесты, без файлов, scratch-буферы |
| 3 | `AlenSarangSatheesh/Arrow-Escape-Game` | Vanilla TS+Vite+SVG | tail-first path, только луч головы | reverse + `clearRayLength`, 40 попыток | конструктивный + 500 replay | 2010 тестов, сид `mulberry32(hash(N))`, мгновенно |
| 4 | `keshavtiwari001/arrow-puzzle` | React+TS+Vite+Canvas+Zustand | 1 клетка=1 стрелка, `hasPathToBoundary` | reverse 1-клеточный + obstacles, early-stop | `verifySolvable` greedy + `getEscapableArrowIds` для хинтов | без тестов в репо, сейв `levelNumber+escapedIds`, быстро |
| 5 | `sabitcancoskuner/ArrowPuzzle` | Unity C# | `tail→head List<Cell>`, прямой луч | snake-DFS + sim-проверка каждого кандидата, `minLen 2, max по difficulty` | greedy-remove-any-clear | редактор `LevelBlueprintEditor`, `ScriptableObject LevelData` |
| 6 | `crudeGithub/Arrow-Escape-Game-Source-Code` + форк `BlckHrtzz` | Unity 6, C# | grid+collision+exit logic, свайп | premade + редактор,_procgen слабый | нет | sample levels, `ScriptableObject`, AdMob |
| 7 | `PanAkatsuki/ArrowsPuzzleEscape-LevelGenerator` | Unity 6000, C# | `Arrow/Tile`, click-handler | параметры `W,H,minLen 5,maxLen 10,turnChance 0.3`, path validation | нет явного | Unity-сцены, MIT |
| 8 | `HKGoyani/arrows` | Flutter CustomPainter | порт HTML-прототипа, прямой луч | pure-Dart генератор | нет | нативный порт, анимация Ticker |
| 9 | `fayzo313/arrow-escape-game` | Flutter CustomPainter | pipe/maze-шейпы, слайд до стены/выхода | свои уровни | нет | упор в рендер труб |
| 10 | `DanielPikielny/Arrow-puzzle` | JS (малый) | удаление скользящих без коллизий | ручные уровни | тривиальный | минимальный эталон правила |
| 11 | `manshihinsu/Arrow-Puzzle` | Java Android | порядок освобождения, 5 сложностей | ручные + прогрессия | AI hint, score | APK-ориентирован |
| 12 | `bashanbro/arrowPuzzleEscape` | Unity/JS | движение до препятствия/выхода | базовый | нет | учебный |
| 13 | `abbel97/Orthographic-Tap-Away-Puzzle-Game` | Unity 3D TapAway | 3D dependency chains | onion-peel baseline + hill-climbing, 40 попыток 4×4×4, high-score отбор | high-score = глубина зависимостей | лучший скоринг сложности для 3D |
| 14 | `kj-21works/Tap_Away` | OpenGL/GLFW C++ | 3D кубики | курсовой проект | нет | только рендер |
| 15 | `made2591/goarrows` | Go termbox | минимальная сетка | без уровней | счётчик ходов | исторический минимум |
| 16 | `nigulasiwang/Arrows-Puzzle-Escape` | Unity exe | китайский генератор карт | бинарь без исходников генератора | нет | только артефакты |
| 17 | `sidhant947 Arrow Escape: Infinite` (F-Droid) | Android, GPLv3 | бесконечные procgen, офлайн, zero-ads | infinite procgen заявлен | нет публичного solver | приватность как референс UX |
| 18 | `goArrow shurco.app` (коммерч.) | iOS/macOS | неон-стрелки, 3 жизни, хинты | hand-tuned + гарантия solvable, daily/рейтинг | Hint/Auto-clear, online-races same-board | референс мета-слоя, не кода |
| 19 | `wiegerw/blocks` | Python + Z3 | 2D/3D блоки текстовым форматом | SMT-сохранение | Z3-solver, `--solve/--smt/--draw` | переносимый приём для офлайн-аудита пачек |
| 20 | `Sudhir-Gomase/Arrow_Puzzle` | Flutter | клон escape | неизвестно | нет | низкий сигнал |
| 21 | `arrow-escape.infosalyx.com` | Web HTML5 | 6×6→25×25 hand-designed, single-solution | ручной дизайн, no procgen | Smart hints (safe arrow) | референс daily/streak |
| — | `aliassaf/arrow-puzzle`, `SLCLS/ARROW-SOLVER` | Python/OpenCV | LightsOut-like / Exponential Idle | неприменимо | SAT/CV-бот | отрицательные примеры, в жанр не входят |

## 3. Топ-4 источника и что конкретно брать

**1. AlenSarangSatheesh — брать первым.**
`generator.ts` целиком (deep/late фазы, `clearRayLength`, `growBody` с запретом луча, `freeNeighbours` most-constrained, lexicographic отбор), `board.ts` (`rayCells/blockerIndex`), `levelSpec.ts` кривые, `rng.ts` (`mulberry32+hashLevel+shuffle`), property-тест на 500 сидов, SVG dash-трюк для выпрямления змеи, модель `tap()` без DOM.

**2. sergev/goarrows — брать вторым.**
`verifySolvableFastBuf` с `cellHeadsBy` обратным индексом, `fireMasks` при росте, `growPlayfulEnoughHeads ≤50%`, `genScratch` переиспользование, `targetArrowCountForSide + clampArrowCount`, `ValidatePartialBoard`, разделение `game/` vs `ui/` (ядро без терминала = ядро без Phaser).

**3. keshavtiwari001/arrow-puzzle — брать третьим как TS-мост к Phaser.**
`pathfinding.ts` как единый `hasPathToBoundary`, `difficulty.ts` (`3×3→8×8 за 50 уровней, density 0.4→0.8, obstacles с 15 уровня ≤12%`), `solver.ts` (`verifySolvable` + `getEscapableArrowIds` для хинтов и подсветки), сейв `levelNumber+escapedIds` без хранения доски, Pointer Events ввод под тач/мышь.

**4. gtxPrime + abbel97 — точечно.**
У gtxPrime: формат `levels.bin (header+index+delta)`, `pregenerate/verify_levels.dart` пайплайн (кеш JSON → bin → chunk-тесты), проверки deflection-loop и color-deadlock если понадобятся дефлекторы. У abbel97: скоринг сложности через глубину dependency chains + отбор лучшего из N попыток hill-climbing — единственный готовый ответ на difficulty scoring.

## 4. Стоимость порта на Phaser 4 + TS + Vite

* AlenSarangSatheesh → S/M: чистый TS, DOM-free core отделяется за часы, заменить SVG-рендер на Phaser Graphics/Container, оставив `Board/Arrow/solution`.
* sergev → S/M: логика тривиально переписывается на TS, работу даёт только портирование `solvable_fast` и `gen_grow` с тестами-паритетами на тех же сидах.
* keshavtiwari → XS/S: уже TS+Vite, `engine/*.ts` переносятся почти дословно, Phaser заменяет только `render/`+`input/`.
* sabit/PanAkatsuki Unity → M: нужен ручной порт C#→TS плюс замена `ScriptableObject` на JSON.
* gtxPrime Flutter → L: Flame, дефлекторы, color-пары, силуэты 27×27+ и bin-кодек тянут отдельный объём; выгоден только импорт готового `levels.bin` через декодер.
* 3D Tap Away (`abbel97`, `kj-21works`) → L/XL: другая геометрия и физика, брать только идею скоринга.

Инвариант, на котором сошлись все сильные реализации: удаление только открывает лучи, поэтому greedy-remove достаточен для доказательства solvability; reverse construction делает поиск ненужным.