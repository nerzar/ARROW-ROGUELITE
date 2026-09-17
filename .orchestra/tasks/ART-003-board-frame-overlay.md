# TASK: ART-003 — Board Frame Overlay Prep

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: Muse Spark (asset/presentation agent)
BASE_BRANCH: build/BUILD-020-playable-slice-v01
BRANCH: build/ART-003-board-frame-overlay
START_SHA: 19429f3f2cbdc96ddd12cd3da4ceb55b04fa623b

## Goal

Подготовить из уже сгенерированного отдельного stone-board reference реальный runtime-ready декоративный overlay для игрового поля: каменная рамка/руны/жаровни вокруг прозрачного центра, без запечённой puzzle-сетки и без стрелок.

Это ASSET/PRESENTATION task. Не менять projection, hit-testing, Rotate, gameplay или layout code FIX-021.

## Source

Искать пользовательский approved/reference art в:

`C:\Users\nerza\Projects\magicarrowassets\`

Нужное изображение — отдельная каменная рамка поля с жаровнями, рунами и тёмной внутренней плитой, показанная пользователем как reference для board.

Если точного source-файла несколько — не угадывать: выбрать визуально совпадающий с последним reference и записать имя в RESULT.

## USER ADDENDUM — Square-first policy

Пользователь утвердил текущую визуальную политику:

- основной combat board сейчас квадратный;
- рабочие размеры: `6x6`, `7x7`, `8x8`, `9x9`, `10x10`;
- arena board well / frame проектируется прежде всего под квадратное окно;
- Rotate вращает внутренний puzzle-layer, frame остаётся неподвижным;
- прямоугольные boards остаются технической совместимостью, но НЕ должны диктовать форму этого overlay;
- не делать несколько отдельных frame-версий под каждый размер без необходимости.

Задача overlay: дать один аккуратный квадратный декоративный frame/safe inner window, куда FIX-021 сможет fit'ить разные square boards.

## Required output

Подготовить минимум:

- `board-frame-overlay.png` — прозрачный центр, только декоративная каменная рамка/руны/внешние элементы;
- при необходимости `board-inner-mask.png` — простая прозрачная/alpha mask внутренней области, если это поможет последующей интеграции;
- короткий `docs/ART-003-BOARD-FRAME-OVERLAY.md` с размерами, safe inner rect и рекомендациями по использованию.

Runtime target folder:

`spikes/arrow-core/viewer/visual-proto/assets/board/`

## Rules

- Не генерировать новый стиль.
- Не менять approved arena background.
- Не запекать стрелы/сетку в overlay.
- Не делать прямоугольный opaque фон за puzzle.
- Центр должен быть прозрачным, чтобы FIX-021 projected puzzle-layer мог жить под рамкой.
- Не менять код renderer/layout.
- Не менять gameplay.

## Quality bar

Overlay должен:

- совпадать по стилю с Moonlit Fortress;
- иметь визуально квадратный safe inner area;
- не иметь заметных чёрных/белых ореолов по alpha edge;
- нормально масштабироваться;
- не закрывать центральную игровую область;
- сохранять читаемые руны/камень на 1920x1080 и 1366x768;
- быть пригодным для fixed-frame модели: frame не вращается вместе с Rotate;
- хорошо принимать как минимум 6x6 и 10x10 board без ощущения, что frame рассчитан только на один конкретный grid.

## Verify

Проверить PNG alpha визуально на тёмном и светлом checker/background.

Если возможно, сделать локальный mockup поверх текущей arena screenshot, но НЕ коммитить renderer changes.

Mockup желательно показать с двумя крайними square cases:
- 6x6;
- 10x10.

## Delivery

Перед DONE:

1. заполнить RESULT / VERIFY / FOUND;
2. commit assets/doc/task;
3. `git push origin build/ART-003-board-frame-overlay`;
4. проверить remote RESULT_SHA;
5. STATUS: DONE.

Не merge main.

## RESULT

Style source (no pixels copied): `magicarrowassets/gameplay-reference/board/
ChatGPT Image Sep 17, 2026, 02_25_09 PM (1).png` — единственная пустая
(Moonlit Fortress, без стрел) board-well reference; палитра сверена с approved
`assets/arena-moonlit-fortress.png` (slate ~56,54,74; rune amber ~255,157,46).

Delivered (square-first, один frame на все размеры):

- `spikes/arrow-core/viewer/visual-proto/assets/board/board-frame-overlay.png`
  (1024x1024 RGBA, 426 KB) — каменная рамка + руны + золотая окантовка,
  прозрачный квадратный центр, без стрел/сетки/opaque-подложки.
- `spikes/arrow-core/viewer/visual-proto/assets/board/board-inner-mask.png`
  (1024 L, 2 KB) — маска внутреннего окна (255 = зона puzzle).
- `docs/ART-003-BOARD-FRAME-OVERLAY.md` — размеры, safe inner rect
  (normalized 0.1992..0.8008, окно 0.1875..0.8125), alpha info, рекомендации FIX-021.
- `build/ART-003-board-frame-overlay/` — 2048-мастер, детерминированный
  генератор (`make_frame.py`, seed 1571), mockups 6x6 + 10x10 в одной и той же
  рамке на тёмной/светлой/checker и arena (`make_mockups.py`, proof only).

Renderer/layout/gameplay/projection/Rotate не тронуты. Frame статичен по
конструкции — Rotate вращает только puzzle-слой внутри safe rect (интеграция
за FIX-021: предложить `boardFrameOverlay` как невращающийся foreground-слой;
см. doc, п.3 рекомендаций).

## VERIFY

- PIL-метрики, 2048-мастер: safe rect 408..1640 — 0 ненулевых alpha;
  верхняя band — 21000/21000 alpha 255; margin снаружи — 0 ненулевых.
- PIL-метрики, 1024-runtime: safe rect — 0; band — 5425/5425 alpha 255;
  внешняя кромка — чистый AA-спад 2-3px без ореола (dust ≤12 в пределах 3px).
- Визуально: mock_dark_6x6 / mock_light_10x10 — кромки чистые на тёмном и
  светлом; mock_arena_6x6 / mock_arena_10x10 — 6x6 и 10x10 сидят в одном окне,
  руны/камень читаемы, центр прозрачный (арена просвечивает).
- `git status`: в коммит идут только файлы задачи (build/ART-003-*,
  docs/ART-003-*, assets/board/*, task-card); чужие untracked
  (`donors.md`, `encounters/multi-shortlist.json`) не staged.

## FOUND

1. PIL `ImageDraw` полупрозрачной заливкой НЕ blend'ит, а штампует alpha на
   RGBA-канвасе (первая сборка дала checkerboard-alpha). Правило: декор —
   только на opaque RGB, alpha — только из геометрических масок. Записано в
   шапку `make_frame.py`.
2. Квадратный overlay поверх перспективной arena даёт «окно» поверх
   podium-арта, а не продолжение 3D-подиума — осознанный trade-off square-first
   политики; перспективный well остался бы привязан к одному размеру.
   Если FIX-021 захочет перспективу — это отдельная задача, не FIX в этой.
3. Ветка один раз была переключена на `exp/EXP-015-board-scale-readability`
   (параллельный агент на той же машине); работа не пострадала (untracked
   файлы на месте), вернулся `checkout build/ART-003-board-frame-overlay`
   без флагов. На будущее: перед commit перепроверять `git branch --show-current`.
4. `assets.js` сейчас знает только `boardFrame -> assets/board-frame.png`
   (слой *под* canvas). Overlay спроектирован слоем *над* puzzle — wiring за
   FIX-021 одной строкой манифеста (см. doc).

STATUS: DONE
RESULT_SHA (assets): 7964037fefff309bbdcdc4f4015f414207be0ce1; this DONE/bookkeeping
commit is origin HEAD (verified via ls-remote after final push).
