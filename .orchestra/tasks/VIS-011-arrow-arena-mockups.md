# TASK: VIS-011 — Arrow Arena Mockups

STATUS: READY
TYPE: DESIGN
SIZE: S
AGENT: Muse / visual design
BASE_BRANCH: design/VIS-010-arrow-presentation-spec
BRANCH: design/VIS-011-arrow-arena-mockups
START_SHA: a8c3294cd0bcb25ea7949706b0e048bf485d8572

## Goal

Turn the VIS-010 arrow language study into direct side-by-side mockups on the actual accepted/calibrated arena view so the user can choose a runtime visual direction before any renderer implementation.

The current runtime arrow style is not accepted. Do not modify runtime code in this task.

## Inputs

Read first:
- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/tasks/VIS-010-arrow-presentation-spec.md`
- `docs/VIS-010-ARROW-PRESENTATION.md`
- `docs/VIS-010-contact-sheet.html`

Use the latest accepted/calibrated 5x5 arena screenshot/reference available in the project or task materials. If the exact newest user-generated arena image is not in Git, use the closest accepted 5x5 calibrated scene and explicitly record that limitation. Do not invent geometry.

## Required output

Create 2 primary direct-comparison mockups using the SAME board / SAME logical arrow paths / SAME camera:

1. Variant B — Engraved Groove + running pulse
2. Variant C — Solid Core + sparse markers

Optional third mockup:
- Variant A — Segmented Rail, only if it adds a genuinely useful comparison.

Each mockup must show at least:
- one long winding free arrow;
- one blocked arrow;
- one hovered/selected arrow;
- one Stone Pin arrow;
- one firing/shot-travel cue;
- one hit/impact cue.

The arrows must visually follow the board perspective and appear embedded in / painted onto the stone, not floating as a flat UI overlay.

## Comparison criteria

For each variant, record briefly:
- instant direction readability;
- long-path readability;
- how well it sits on stone;
- free vs blocked readability;
- visual noise at 5x5 and 6x6 density;
- likely implementation complexity;
- main risk.

Do NOT pick a final winner on the user's behalf. A recommendation for playtest is allowed, but final acceptance belongs to the user.

## Output files

- `docs/VIS-011-ARROW-ARENA-MOCKUPS.md`
- one or more lightweight HTML/SVG mockups or image references suitable for direct visual review

No runtime renderer changes.
No gameplay changes.
No projection changes.
No arena calibration changes.

## Delivery

Use an isolated worktree from the start.
RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
Do not merge main.

## RESULT

- `docs/VIS-011-ARROW-ARENA-MOCKUPS.md` (new): прямое A/B на одной реальной арене.
  Зафиксированы base scene (calibration `prologue-5x5-good`, FIX-023 user-calibrated),
  честность сравнения (одни и те же 6 logical paths, одна камера/перспектива/board geometry),
  оценка B/C по 7 критериям задачи, таблица-сводка, recommendation FOR PLAYTEST
  (primary B, fallback C, A — второй финалист). Финал не выбирается: FINAL APPROVAL = USER ONLY.
  Токены — из VIS-010 §1.2–§1.3 (кайт `0.55S×0.62S`, коридор `±0.55S`, ноль `shadowBlur` вдоль тела).
- `docs/VIS-011-arena-mockups.html` (new, ~29 КБ, без сборки/зависимостей, открывается по `file://`):
  три панели B / C / A, во всех одна сцена. На каждой панели 6 стрелок:
  длинная winding free `(0,4)→(4,1)` EAST, blocked `(0,0)→(2,0)` NORTH,
  hover `(4,4)→(4,2)` NORTH, Stone Pin `(0,1)→(1,2)` EAST (2t, разрыв нити / камень),
  firing `(3,3)→(3,4)` SOUTH (снаряд уходит за нижний край), hit `(1,1)→(2,1)` EAST.
  Плюс strip плотности 6×6. Геометрия: `boardPlaneFrac tl [0.37,0.45] tr [0.63,0.45]
  br [0.655,0.818] bl [0.348,0.820]`, `fitGrid(5,5,{marginU:0,marginV:0})`, stage 960×540,
  homography Heckbert — формулы продублированы из `board-plane.js` 1:1 (файл не тронут).
  Фон — реальный `assets/arenas/prologue-act1/5x5-good.png`; при отсутствии PNG под ним
  остаётся расписанная подложка с той же трапецией (геометрия стрелок не меняется).
  Каменные бирки состояний — только навигация по мокапу, не предложение runtime-UI.
- Не тронуты: `board-renderer.js`, projection (`board-plane.js`), gameplay/combat,
  calibration (`arena-calibration.js`), арена-PNG.

## VERIFY

- `git diff --stat`: только 2 новых docs (+ эта карточка); `git status` чистый после commit'ов.
- `node --check` извлечённого из HTML `<script>` — SYNTAX OK.
- Прогон скрипта мокапа в node с DOM-стабом (временный harness, не в репозитории),
  затем XML-парсинг всех 5 выдаваемых SVG: **56/56 PASS, 0 FAIL, XML_OK**.
  Проверено: все 5 render-целей непусты; в каждой панели ровно один `<svg>`, корректно закрыт,
  ровно 1 `<image>`, 21 линия сетки 5×5, все 6 state-тегов, **ноль** `shadowBlur`/`feGaussianBlur`/`filter=`;
  B — 8 золотых нитей, разрыв нити пина (dash), ровно 2 `animateMotion` (hover+fire), снаряд firing;
  C — 14 шевронов, hover-подложка, 0 `animateMotion` (статично по спеку), 4 кайта
  (firing/hit без головы на board — по VIS-010 §4.5–4.6);
  A — 60 сегментов, 1 марш, ровно 2 золотых звена в hover (VIS-010 A: «2–3 звена»).
- Проекция сверена в node теми же константами: квад `[[355,243],[605,243],[629,442],[334,443]]`,
  `S(2,0)=42.8 → S(2,2)=46.8 → S(3,4)=51.6` (перспектива: дальний ряд тоньше ближнего),
  21/21 занятых центров внутри stage, пересечений клеток между стрелками нет (21/25, свободны (3,0),(4,0)).
- Push fast-forward на `origin/design/VIS-011-arrow-arena-mockups`,
  `origin/... == RESULT_SHA` (см. ниже).

## FOUND

- **Arena Template v1 существует в Git, но не в моей базе.** `docs/ARENA-TEMPLATE-V1-CONTRACT.md`
  на ветке `design/ARENA-TEMPLATE-001-contract` (`e36f8bb`, STATUS DONE) отсутствует в
  `BASE_BRANCH` (design/VIS-010) и в `origin/main`, поэтому как base не брался. Сверено вручную:
  его `DEFAULT_ARENA_GEOMETRY.boardPlaneFrac` (`tl [0.370,0.450] tr [0.630,0.450]
  br [0.655,0.818] bl [0.348,0.820]`, `margin 0`) **до третьего знака совпадает** с
  `prologue-5x5-good` — контракт сам называет эту сцену источником координат. Вывод: мокап уже
  стоит на канонической геометрии Template v1 и не устареет. Зависимость не добавлялась (read-only
  cross-branch сверка); записано в `docs/VIS-011-ARROW-ARENA-MOCKUPS.md` §1.
- **Политика Template v1 меняет вид плиты.** Контракт требует генерировать камень **без baked grid**
  (сетку рисует runtime). Значит baked-сетка на `5x5-good.png` — legacy-арт, но калибровка та же.
  Мокап проецирует сетку и стрелки гомографией поверх арта, т.е. репрезентативен и для будущего вида;
  отдельно отмечено, что «новая чистая плита» — задача арт-пайплайна, не этой карточки.
- **Свежайшего отдельного user-generated arena snapshot в базе нет.** Ближайший accepted/calibrated
  5×5 — `prologue-5x5-good` (user-confirmed в FIX-023); ограничение записано в доке §1, геометрия не выдумана.
- **Scope-выбор по состояниям:** задача требует 6 конкретных (long free / blocked / hover / pin / firing / hit),
  поэтому `targeting` и `dead/removing` из VIS-010 в композицию не вводились — иначе на 5×5 не остаётся
  «воздуха» и сравнение превращается в карточки состояний, чего задача прямо не хочет. При необходимости
  добавить их — отдельная итерация мокапа.
- **Двойная проверка реальности арены недоступна.** Мокап — HTML/SVG, скриншот живого runtime-вида арены
  с наложенными стрелками агент сделать не может (нет Browser pane в этой сессии), поэтому «как лежит на камне»
  оценивается по реальному PNG-фону под точной калибровкой, а не по скриншоту рантайма. Отмечено здесь,
  чтобы пользователь знал: финальную оценку «лежит ли на камне» он делает глазами сам.
- **`docs/COMBAT-RULES.md` в этой базе присутствует** (в отличие от FOUND карточки VIS-010). На эту задачу
  combat-семантика не требовалась, файл не читался.

## RESULT_SHA

_RESULT_SHA_FILLED_IN_FINAL_COMMIT_

## STATUS

READY (RESULT/VERIFY/FOUND заполнены; финальный commit ставит STATUS и SHA).
