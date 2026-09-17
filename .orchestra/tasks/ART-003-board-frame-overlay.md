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
- не иметь заметных чёрных/белых ореолов по alpha edge;
- нормально масштабироваться;
- не закрывать центральную игровую область;
- сохранять читаемые руны/камень на 1920x1080 и 1366x768;
- быть пригодным для fixed-frame модели: frame не вращается вместе с Rotate.

## Verify

Проверить PNG alpha визуально на тёмном и светлом checker/background.

Если возможно, сделать локальный mockup поверх текущей arena screenshot, но НЕ коммитить renderer changes.

## Delivery

Перед DONE:

1. заполнить RESULT / VERIFY / FOUND;
2. commit assets/doc/task;
3. `git push origin build/ART-003-board-frame-overlay`;
4. проверить remote RESULT_SHA;
5. STATUS: DONE.

Не merge main.
