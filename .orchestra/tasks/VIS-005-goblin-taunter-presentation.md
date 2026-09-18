# TASK: VIS-005 — Goblin Taunter Runtime Presentation

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Muse Spark (implementation agent)
BASE_BRANCH: origin/fix/PLAYTEST-001-stone-pin-and-hud
BRANCH: feat/VIS-005-goblin-taunter-presentation
START_SHA: 978edc4331b8e7278a08b249fd68697a47cd5e1b
RESULT_SHA: a207e15ed37a4e44bc8c8d6a620fda2a3575aa28 (code commit; card commits сверх — b491a47 + DONE)

## Base

`git fetch --all --prune` выполнен. Remote tip
`origin/fix/PLAYTEST-001-stone-pin-and-hud` = `978edc4` — совпал с tip из
постановки, свежий remote tip не понадобился.

WORKTREE: работа велась в отдельном worktree
`C:\Users\nerza\Projects\ARROW-ROGUELITE-VIS005` (ветка
`feat/VIS-005-goblin-taunter-presentation`), т.к. основной checkout был занят
параллельной задачей другого агента (`design/ACT-I-REV-01-first-six`).
Основной checkout не трогался; чужие untracked-файлы на месте.

## Зачем

Подключить утверждённого пользователем Goblin Taunter (первый boss) в visual
prototype как presentation state machine: pose swap + transforms, стабильный
ground anchor, debug-контролы. Gameplay остаётся source of truth, механики не
меняются.

## Source assets (approved)

Source folder (вне репозитория, не коммитить):
`C:\Users\nerza\Projects\magicarrowassets\creatures\goblin-king\`

Канонический pack (только он):
- `indle.png` → runtime `idle.png` (в source опечатка `indle`, не `idle`;
  source-файл НЕ переименовывать, переименование только runtime-копии)
- `taunt.png`
- `cast.png`
- `stuned.png` → runtime `stunned.png` (аналогично, только runtime-копия)
- `angry.png`
- `defeat.png`
- `back.png` (вспомогательная поза, не gameplay state)

НЕ использовать: `angry-with-bg-or-cast.png`,
`ChatGPT Image Sep 17, 2026, 10_30_02 AM (3).png` (промежуточные результаты).

## Arena

Approved arena asset (`moonlit fantasy fortress`) локально НЕ НАЙДЕН:
`C:\Users\nerza\Projects\magicarrowassets\` содержит только
`creatures/goblin-king/`. Замены не подставлять, не скачивать, не
генерировать. Реализован только Goblin integration на программном фоне.

FOUND: approved arena file not present locally.

## Scope

- Runtime-копии: `spikes/arrow-core/viewer/visual-proto/assets/bosses/goblin-taunter/`
- Новый модуль: `boss-visual-state.js` (чистый presentation state machine + metadata)
- `assets.js`: manifest состояний + anchor/scale metadata
- `board-renderer.js`: pose swap, стабильный ground anchor, presentation transforms
- `app.js` + `index.html`: привязка к gameplay events + prototype-only debug control
- Тесты: `spikes/arrow-core/test/vis-005-boss-visual-state.test.ts`
- НЕ трогать: combat rules, Stone Pin, Rotate, RunState, seeds, HP, timers,
  Act I content, solver, generator.

## State -> gameplay event mapping

- encounter appearance → `taunt` коротко → `idle`
- phase 1 обычное состояние → `idle`
- boss begins CAST (attackKind === 'cast', countdown armed) → `cast`
- cast interrupted / ordinary hit → `stunned` коротко → baseline (idle/angry/cast)
- phase 2 begins (phaseIndex >= 1) → `angry` (baseline; без постоянного flashing)
- boss defeated (won) → `defeat`, терминал, возврата в idle нет
- `back` — вспомогательная поза, manual/debug only
- TAUNT НЕ постоянный IDLE: только появление + debug/manual trigger

## RESULT

Goblin Taunter подключён в visual prototype как presentation state machine.
Gameplay не менялся (только чтение EncounterState + визуал).

Код:
- `spikes/arrow-core/viewer/visual-proto/boss-visual-state.js` (+ `.d.ts` для
  tsc): чистый presentation-модуль без DOM/engine-импортов — poses
  idle/taunt/cast/stunned/angry/defeat/back, hold-окна (taunt 1400ms, stunned
  650ms), `readBossSnapshot` (LIVE `attackKind` из state, не статичный def),
  `baselinePose`, `appearBossVisual`, `onBossGameplayEvent`,
  `tickBossVisual`, `manualBossPose`, `BOSS_ANCHOR`.
- `assets.js`: `BOSS_MANIFEST` (7 поз) + `loadBossPack()` + `resolveBossImage()`
  (pose -> idle -> placeholder). Старый `ASSET_MANIFEST` не тронут.
- `board-renderer.js`: boss-панель рисует pose contain-fit в ТОТ ЖЕ footprint
  панели с bottom-center ground anchor; клип панели активен — арт не может
  залезть на board/HUD. Трансформы: idle breathing, taunt anticipation+pop+
  bounce, stunned recoil+shake+flash, cast pulse (castGlow-hook сохранён),
  angry напряжённый idle без flashing, defeat impact-settle и лежит.
- `app.js`: появление -> taunt; tap: won > phase > castInterrupted > hit;
  miss пересинхронизирует истёкший hold на armed cast; frame тикает holds;
  статус-панель показывает `boss art: 7/7`, `boss pose: <pose>`; debug-панель:
  кнопки всех 7 поз (manual до следующего gameplay-события); `visualDebug`
  расширен `boss()` / `setBossPose()`.
- `index.html` + `style.css`: `#bossPoseRow` в debug-панели (prototype-only).
- `assets/README.md`: таблица pose pack.

Ассеты (runtime-копии, source не тронут):
- `spikes/arrow-core/viewer/visual-proto/assets/bosses/goblin-taunter/`
  `idle.png` (из `indle.png`), `taunt.png`, `cast.png`,
  `stunned.png` (из `stuned.png`), `angry.png`, `defeat.png`, `back.png`.
- Абсолютных Windows-путей в runtime нет; manifest содержит состояния.

State -> gameplay event mapping (реализовано и проверено):
- appearance -> taunt (1400ms) -> idle
- phase 1 baseline -> idle
- armed CAST (`attackKind === 'cast'`) -> cast
- hit / castInterrupted -> stunned (650ms) -> baseline (idle/angry/cast)
- phaseIndex >= 1 -> angry (baseline)
- won -> defeat, терминал (тики/manual до конца боя не выводят; после конца
  боя любой gameplay event держит defeat)
- back — только debug/manual

Anchor/scale model:
- `BOSS_ANCHOR = { anchorX: 0.5, anchorY: 1.0, scale: 1.0, offsets: {pose: {dx:0, dy:0}} }`.
- PNG поз разного aspect ratio (1086x1448 portrait; angry 1305x1206; defeat
  1536x1024) contain-fit в фиксированный footprint панели, низ изображения
  locked на низ панели. Смена позы не двигает anchor и не меняет размер.

Тесты (новых 14, весь сьют 151/151):
- `test/vis-005-boss-visual-state.test.ts` (11): baseline, taunt не перманентен,
  hit/interrupt -> stunned -> baseline, phase -> angry, castStart -> cast,
  defeat терминален, manual override + сброс событием, anchor-метаданные.
- `test/vis-005-boss-engine-mapping.test.ts` (3): те же переходы на РЕАЛЬНОМ
  EncounterState (phase-1 hit, phase-2 cast+interrupt->angry, killing blow->
  defeat). Поймал и исправил реальный баг: `casting` читался из статичного def
  вместо живого `attackKind` (interrupt не было бы видно).

## VERIFY

- `npm run typecheck` — чисто.
- `npm test` — 12 файлов, 151/151 PASS (в т.ч. 14 новых VIS-005).
- `npm run build` — чисто.
- Browser (headless Chromium 1228 + Python Playwright, локальный serve.mjs,
  сцена cp-e5), оба вьюпорта 1920x1080 и 1366x768, скрипт
  `C:\Users\nerza\AppData\Local\Temp\opencode\vis005-verify.py` (prototype-only,
  не коммитится) — asserts на `window.visualDebug.boss().pose`:
  - появление taunt -> idle; hit -> stunned -> idle;
  - фаза 2 -> cast; interrupt -> stunned -> angry;
  - клик по board регистрируется (msg/log), HUD не перекрыт;
  - defeat-рендеринг проверен через debug-override (реальный переход won->
    defeat покрыт engine-тестом).
- Screenshots (12, не коммитятся, лежат в
  `C:\Users\nerza\AppData\Local\Temp\opencode\`): `vis005-{1920x1080,1366x768}-
  {1-taunt,2-idle,3-stunned,4-phase2,5-angry,6-defeat}.png`. Pose swap визуально
  различим; anchor стабилен; boss стоит на верхней площадке в фазе 2.

## FOUND

- `indle.png` в source — опечатка имени для `idle.png`; runtime-копия `idle.png`.
- `stuned.png` в source — опечатка для `stunned.png`; runtime-копия `stuned.png`.
- FOUND: approved arena file not present locally (moonlit-fortress). В
  `C:\Users\nerza\Projects\magicarrowassets\` есть только
  `creatures/goblin-king/`. Замена не подставлялась; фон остался программным.
- Соседняя ветка `origin/integration/VIS-004-real-art-v01` (ccf86d6, от
  8482cc3) уже подключает V01-арт с ASSET_META/contain-fit — sibling, не база
  этой задачи. Reconciliation при merge — за интегратором, не здесь.
- Headless-артефакт (не баг приложения): в headless Chromium rAF троттлится в
  простое, поэтому presentation-holds истекают только на живых кадрах. На
  реальном дисплее 60Hz всё по wall-clock; browser-asserts это учитывают.
- Вне scope, не чинилось: дефолтная сцена base-ветки — cp-e4 (enemies mode);
  act1-*.json в base отсутствуют (они из другой ветки).
