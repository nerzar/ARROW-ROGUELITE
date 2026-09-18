# TASK: VIS-008 — Prologue Goblin Shaman Boss Runtime

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Claude (implementation agent)
BASE_BRANCH: origin/feat/VIS-006-dire-wolf-presentation
BRANCH: feat/VIS-008-prologue-shaman-boss
START_SHA: 6bb7901352cac806f4898d71d14b5f539fc16edb
CODE_SHA: 69eaa59b0c5ef463feba127f888bd2f66060e7fd (code/assets/tests commit)
RESULT_SHA: fb0f12e58b43875a5515fdc5b2d609873e9703ae (task-card commit, pushed and verified == origin)

## Base

`git fetch --all --prune` выполнен. База — tip VIS-006
(`origin/feat/VIS-006-dire-wolf-presentation` = `6bb7901`, STATUS DONE),
как указано в постановке. Работа ведётся в отдельном worktree
`C:\Users\nerza\Projects\ARROW-ROGUELITE-VIS008`, не трогая основной checkout
(`design/ART-002-goblin-shaman`) и не пересекаясь с параллельным
`feat/VIS-007-arena-character-layout` (Muse, отдельный worktree
`ARROW-ROGUELITE-VIS007`).

## Каноническое решение пользователя (заменяет более раннюю формулировку задачи)

- **Goblin Shaman = BOSS ПРОЛОГА** (cp-e5, seed 1571, `miniboss_placeholder`,
  уже содержит CAST/interrupt phase 2 из EXP-011).
- **Goblin Taunter / Goblin King = BOSS ПЕРВОГО АКТА** (зарезервирован,
  сцены для него пока нет).
- Dire Wolf — ordinary enemy, без изменений (VIS-006 scope не тронут).

Первая формулировка этой задачи (Goblin Shaman как рядовой caster-моб,
enemies-mode) заменена пользователем ДО начала кода; ей не следовали.

## Зачем

Goblin Taunter/King's presentation state machine (VIS-005) уже полностью
species-agnostic: `boss-visual-state.js` работает только с pose-именами и
engine-снапшотом, не зная о конкретном asset-паке. Единственное место,
хардкодившее Taunter как ЕДИНСТВЕННЫЙ boss-пак, было `assets.js`
(`loadBossPack()` без параметра) + `app.js` (один глобальный `bossPack`) +
легаси-fallback `resolveTargetImage`. Задача — подключить Goblin Shaman как
второй, независимый boss-пак и переключить прологовую сцену (cp-e5) на него,
не трогая саму state-machine и не трогая VIS-007 layout scope.

## Source assets (approved пользователем)

Source folder (вне репозитория, не коммитится):
`C:\Users\nerza\Projects\magicarrowassets\creatures\goblin-shaman\`

| Source file | Runtime | Примечание |
|---|---|---|
| `idle.png` | `idle.png` | без изменений имени |
| `taunt.png` | `taunt.png` | без изменений имени |
| `cast.png` | `cast.png` | без изменений имени |
| `stunned - hit.png` | `stunned-hit.png` | нормализация пробелов/дефиса; source-файл не переименовывался |
| `angry.png` | `angry.png` | без изменений имени |
| `defeat.png` | `defeat.png` | без изменений имени |
| `back.png` | `back.png` | без изменений имени, aux-поза |

Все 7 файлов скопированы байт-в-байт (размеры совпадают с source) в
`spikes/arrow-core/viewer/visual-proto/assets/bosses/goblin-shaman/`.

Goblin Taunter/King pack (`assets/bosses/goblin-taunter/`, из VIS-005) —
**не тронут, не удалён**, остаётся полным 7-позным паком.

## Scope

- `assets.js`:
  - `ASSET_MANIFEST`: добавлен `bossGoblinShaman` слот (легаси flat-portrait
    fallback); `bossGoblinTaunter` сохранён.
  - `SHAMAN_PACK_BASE`/`SHAMAN_MANIFEST` — новый boss-пак, тот же контракт,
    что `BOSS_MANIFEST` (Taunter), просто другой manifest для того же
    `loadBossPack()`/`resolveBossImage()`.
  - `BOSS_MANIFESTS` (registry `'goblin-shaman' | 'goblin-taunter'` -> manifest)
    + `bossSpeciesFor(bossId)` — единственное место, знающее species по
    `def.boss.id`. `boss-visual-state.js` не изменён и не должен быть изменён
    для добавления вида — только запись в этом реестре.
  - `ID_TO_SLOT.miniboss_placeholder` и `resolveTargetImage`'s `isBoss`
    fallback перенаправлены на `bossGoblinShaman` (легаси слой больше не
    показывает Taunter, если Shaman-арт не загрузился).
  - Новый `assets.d.ts` (весь текущий набор экспортов assets.js, не только
    добавленное VIS-008) — понадобился, т.к. новый тест импортирует
    `assets.js` из `.ts`, а без соседнего `.d.ts` NodeNext resolution не
    типизирует `.js`-импорт (тот же паттерн, что `boss-visual-state.d.ts`/
    `enemy-visual-state.d.ts`).
- `app.js` (минимальный data/API-диф, БЕЗ layout):
  - оба boss-пака грузятся при старте (`bossPacks = { 'goblin-shaman': ...,
    'goblin-taunter': ... }`); `bossPack`/`bossSpecies` стали `let` и
    переизбираются в `loadScene()` через `bossSpeciesFor(def.boss.id)`.
  - `renderPanel()`: строка статуса теперь показывает активный species
    (`boss art: goblin-shaman 7/7 poses loaded`).
  - `window.visualDebug`: добавлены `bossSpecies()` и `showBossPack(species)`
    (debug-only ручное переключение на Taunter-пак без UI-контрола — способ
    "не удалять возможность debug-показа Taunter", который просил пользователь).
  - board-renderer.js/style.css/index.html/arena layout/enemy footprints/HUD —
    **не тронуты вообще**. `board-renderer.js` уже был pack-agnostic (рисует
    что передаст `app.js` через `view.boss.pack`), поэтому даже минимальный
    layout-диф не понадобился.
- `boss-visual-state.js`: только док-комментарий наверху файла исправлен
  (был жёстко привязан к "Goblin Taunter presentation state machine" — теперь
  описывает машину как species-agnostic и фиксирует факт, что VIS-008
  переключил прологовую сцену без единой правки в самом файле). Логика
  состояний не изменена НИ НА СТРОКУ.
- `assets/README.md`: таблица обоих boss-паков (Shaman/prologue,
  Taunter/Act I) + явное объяснение species-реестра.
- Тесты: `test/vis-008-prologue-shaman-boss.test.ts` (12 тестов, на реальном
  `EncounterState` в boss-режиме с теми же числами, что `encounters/cp-e5.json`,
  плюс загрузка самого `cp-e5.json` для проверки `bossSpeciesFor` на реальном
  id).
- НЕ тронуто: combat/timers/Stone Pin/Rotate/RunState/solver/seeds/balance,
  `encounters/cp-e5.json` сам файл (числа/фазы не менялись), Dire Wolf
  presentation (VIS-006).

## State -> gameplay mapping (не менялся; воспроизведён на Shaman-паке)

- появление энкаунтера → `taunt` кратко → `idle`/`angry` по фазе (VIS-005,
  без изменений).
- начало/продолжение CAST (phase 2, `kind: 'cast'`, countdown конечен) →
  `cast`.
- `r.castInterrupted` → `stunned` кратко (`STUNNED_HOLD_MS`) → затем НЕ снова
  `cast` (атака сменилась на `interruptedAttack.kind === 'normal'`), а
  live-baseline (`angry` во второй фазе).
- обычное попадание/начало атаки вне каста → `stunned` кратко → baseline.
- босс побеждён (`r.won`) → `defeat`, терминально.

## RESULT

Прологовая сцена (cp-e5) визуально показывает Goblin Shaman вместо Goblin
Taunter, без единой правки combat-логики и без layout-правок. Goblin
Taunter/King остаётся полностью рабочим и загруженным — зарезервирован для
Act I, доступен через `window.visualDebug.showBossPack('goblin-taunter')`.

Проверено вручную в браузере (headless-less, встроенный browser pane,
`node tools/serve.mjs` на временном порту 5188, снесён после проверки):
- сцена `cp-e5`: `boss art: goblin-shaman 7/7 poses loaded`, все 7 PNG
  Shaman-пака и все 7 PNG Taunter-пака отдаются 200 OK сетью (оба пака
  реально загружаются, ни один не удалён/не сломан).
- `window.visualDebug.setBossPose('cast')` → пере рисовка меняется (другой
  спрайт в панели, поза `cast`, `manual: true`).
- `window.visualDebug.showBossPack('goblin-taunter')` → `bossSpecies()`
  переключается на `'goblin-taunter'`, статус-строка показывает
  `boss art: goblin-taunter 7/7 poses loaded` — Taunter реально доступен.
- `loadScene('cp-e5')` заново → снова `goblin-shaman` (дефолт сцены не
  зависит от debug-переключения).
- `loadScene('cp-e4')` (Dire Wolf сцена) → `wolf art: 5/5 poses loaded`,
  `boss: null` — VIS-006 не задет.
- Единственные 404 в консоли — легаси flat-манифест слоты
  (`background.png`, `player-portrait.png` и т.п.), которые никогда не имели
  файлов ни до, ни после этой задачи; не регрессия.

## VERIFY

- `npm ci` в свежем worktree (node_modules не в git).
- `npm run typecheck` — чисто.
- `npm test` — 15 файлов, **181/181 PASS** (12 новых VIS-008, 169
  унаследованных от VIS-001..VIS-006 без изменений и без регрессий).
- `npm run build` — чисто.
- Browser verification — см. RESULT выше.

## FOUND

- **docs/VISUAL-DIRECTION.md §5 "Первый mini-boss: Goblin Taunter"** — весь
  раздел описывает конкретный комедийный gag Taunter'а ("разворачивается
  к игроку задом", "ну давай, попади сюда стрелой"), привязанный к его
  персонажу, и именно этим gag'ом объясняется педагогический бит первого
  Rotate. Простое переименование заголовка на Shaman создало бы
  противоречие: Shaman по ART-002 — "зловещий фанатичный чернокнижник", а не
  комический персонаж, и described gag ему не подходит. Это не строка с
  фактической ошибкой, а design-контент, завязанный на старое решение —
  **не правил**, т.к. любое исправление потребовало бы придумать новый
  комедийный/обучающий бит для Rotate вместо пользователя. Нужно отдельное
  решение: либо Rotate-обучающая сцена переписывается под Shaman, либо
  прологовый mini-boss на самом деле остаётся Taunter'ом визуально (а Shaman
  занимает другую роль), либо gag сцена просто вырезается/меняется другим
  способом.
- **docs/ART-002-GOBLIN-SHAMAN.md** (принят, STATUS DONE на `main`) прямо
  описывает Goblin Shaman как **рядового Act I caster-моба** (Encounter 3,
  затем вместе с Rock Thrower в Encounter 6), а не как boss. Это прямо
  противоречит новому решению "Shaman = boss пролога". Документ **не
  правил** — это принятый design-документ, конфликт роли должен разрешить
  пользователь/архитектор (двойная роль персонажа? Act I caster-моб теперь
  другой вид? ART-002 отменяется/пересматривается?), не исполнитель.
- **.orchestra/tasks/VIS-005-goblin-taunter-presentation.md** (STATUS DONE) —
  корректно описывает, что было сделано НА МОМЕНТ VIS-005 (Taunter тогда
  действительно был прологовым боссом); это исторический отчёт, не текущая
  design-претензия, поэтому **намеренно не переписан** — правило GIT.md
  "исполнитель не переписывает чужие commit"/архив истории применимо и к
  задним числом корректировке уже сданных task-карточек.
- `board-renderer.js` уже был написан pack-agnostic (`view.boss.pack`
  приходит извне) ещё в VIS-005 — задача "минимальный data/API change, если
  renderer хардкодит Taunter" оказалась НЕ нужна для renderer вообще, только
  для `assets.js`/`app.js`.
- `node_modules` отсутствует в свежих worktree (не в git) — перед
  typecheck/test/build нужен `npm ci` в `spikes/arrow-core`.
