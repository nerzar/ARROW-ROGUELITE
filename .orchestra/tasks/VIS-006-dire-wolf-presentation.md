# TASK: VIS-006 — Dire Wolf Runtime Presentation

STATUS: DONE
TYPE: BUILD
SIZE: M
AGENT: Muse Spark (implementation agent)
BASE_BRANCH: origin/feat/VIS-005-goblin-taunter-presentation
BRANCH: feat/VIS-006-dire-wolf-presentation
START_SHA: bdf06b7fd8afaa5597797a51939f6d014e2cc350
RESULT_SHA: 4345011102eba36c65c22ca2031627d0a4809cb4 (code commit; card DONE сверх)

## Base

`git fetch --all --prune` выполнен. База — tip VIS-005
(`origin/feat/VIS-005-goblin-taunter-presentation` = `bdf06b7`, STATUS DONE),
чтобы переиспользовать presentation-паттерн (pose pack + holds + anchor).
Основной checkout (`design/ACT-I-REV-01-first-six`, чужая параллельная работа)
не тронут; работа ведётся в отдельном worktree
`C:\Users\nerza\Projects\ARROW-ROGUELITE-VIS006`.

## Зачем

Подключить утверждённого пользователем Dire Wolf (первый ordinary enemy
visual) в visual prototype как presentation-слой: gameplay state = source of
truth, presentation отдельный. Boss-specific state machine целиком НЕ
копируется; выделяется минимальная ordinary-модель без большого refactor.

Нужные presentation-состояния: `idle`, `attackReady`, `attack`, `hit`,
`defeat`. Никаких новых gameplay states, никакой механики rage.

## Source assets (approved)

Source folder (вне репозитория, не коммитить):
`C:\Users\nerza\Projects\magicarrowassets\creatures\dire_wolf\`

Файлы в source имеют generic-имена (`ChatGPT Image ... (N).png`), поэтому
mapping зафиксирован здесь явно (не silent-guess: позы визуально совпадают
с подписанным рядом `IDLE / ATTACK READY / RUN LUNGE / HIT STAGGER / DEFEAT`
на sheet `(1)`):

| Source file | Runtime | Почему |
|---|---|---|
| `... 11_10_59 AM (2).png` (фронтальная стойка, оскал) | `idle.png` | соответствует IDLE/COMBAT STANCE на sheet |
| `... 11_11_00 AM (3).png` (низкий присед, все лапы на земле) | `attack-ready.png` | соответствует ATTACK READY на sheet |
| `... 11_11_00 AM (4).png` (прыжок в воздухе, пыль) | `lunge.png` | соответствует RUN/LUNGE на sheet |
| `... 11_11_00 AM (5).png` (отшатнулся, слюна) | `hit.png` | соответствует HIT/STAGGER на sheet |
| `... 11_11_00 AM (6).png` (лежит, раны) | `defeat.png` | соответствует DEFEAT на sheet |
| `... 11_10_59 AM (1).png` (концепт-sheet со всеми видами) | — reference only, НЕ копируется | не чистый спрайт, только подписи для mapping |

НЕ использовать ничего кроме этих пяти PNG.

## Scope

- Runtime-копии: `spikes/arrow-core/viewer/visual-proto/assets/enemies/dire-wolf/`
- Новый модуль: `enemy-visual-state.js` (+ `.d.ts`) — минимальная ordinary
  presentation-модель, per-actor state (poses `idle|attackReady|attack|hit|defeat`,
  holds attack 450ms / hit 500ms, `ENEMY_ANCHOR` bottom-center как у boss)
- `assets.js`: `WOLF_MANIFEST` (5 поз) + `loadWolfPack()` + `resolveWolfImage()`
- `board-renderer.js`: enemies-панели рисуют wolf-арт contain-fit с тем же
  ground anchor; pose transforms (дыхание / низкая стойка / recoil / flash /
  defeat-fade); зеркалирование только для E-side (спрайт смотрит вправо)
- `app.js` + `index.html`: per-enemy visuals Map; привязка к gameplay events;
  prototype-only debug control (второй ряд кнопок)
- Тесты: `test/vis-006-enemy-visual-state.test.ts`,
  `test/vis-006-enemy-engine-mapping.test.ts` (на реальном EncounterState cp-e4)
- НЕ трогать: combat, timers, Stone Pin, Rotate, RunState, solver, seeds, balance

## State -> gameplay event mapping

- ordinary enemy appears → `idle` (без taunt — это не boss)
- attack countdown близок к 0 (finite `countdown <= 1`) → `attackReady` (baseline)
- enemy attacks (`enemyAttacks[].id`) → `attack` кратко → baseline
- enemy receives hit → `hit` кратко → baseline (`idle`/`attackReady` по live snapshot)
- enemy dies → `defeat`, терминал (виден как pose swap + fade в dying-окне,
  затем слот пустеет — как у обычных врагов сейчас)

## RESULT

Dire Wolf подключён в visual prototype как presentation-слой для ordinary
enemies. Gameplay не менялся (только чтение `EncounterState.enemies` + визуал).

Код:
- `spikes/arrow-core/viewer/visual-proto/enemy-visual-state.js` (+ `.d.ts`):
  минимальная ordinary-модель, НЕ копия boss-машины (нет фаз/cast/taunt/rage):
  poses `idle|attackReady|attack|hit|defeat`, holds (attack 450ms, hit 500ms),
  `ATTACK_READY_IN = 1` (finite `countdown <= 1`), `readEnemySnapshot`,
  `baselinePose`, `appearEnemyVisual` (сразу idle), `onEnemyGameplayEvent`
  (`hit|attack|defeated|sync`), `tickEnemyVisual`, `manualEnemyPose`,
  `ENEMY_ANCHOR` (bottom-center, общий ground-контракт с boss).
- `assets.js`: `WOLF_MANIFEST` (5 поз, runtime `attack` = `lunge.png`) +
  `loadWolfPack()` + `resolveWolfImage()` (pose -> idle -> null).
- `board-renderer.js`: enemies-панели рисуют wolf-арт contain-fit в ТОТ ЖЕ
  footprint панели с bottom-center anchor; клип панели активен. Трансформы:
  idle дыхание/shift, attackReady низкая стойка + forward tension, attack
  pop + recoil (плюс существующий fx-lunge), hit shake + flash, defeat static
  (terminal hold/fade через существующий death-fade). E-side панели
  зеркалируются около anchor x (спрайт смотрит вправо → на board); anchor
  стабилен. Цикл держится живым пока активен любой wolf-hold.
- `app.js`: `wolfVisuals: Map<enemyId, visual>` (per-actor); появление → idle;
  tap: приоритет на актора `defeated > attack > hit`, остальные только sync
  истёкшего hold на live baseline; rotate только sync; frame тикает holds и
  передаёт `wolf: { pack, visuals }` в renderer; статус-панель `wolf art: 5/5`
  + `wolf <id>: <pose>`; debug-панель: per-enemy кнопки всех 5 поз;
  `visualDebug` расширен `wolf()` / `setWolfPose(id, pose)`.
- `index.html`: `#wolfPoseRow` в debug-панели (prototype-only).
- `assets/README.md`: таблица wolf pack.
- Boss-сцена (cp-e5) не тронута: `wolfVisuals = null`, `wolf()` → null.

Ассеты (runtime-копии, source не тронут):
- `spikes/arrow-core/viewer/visual-proto/assets/enemies/dire-wolf/`
  `idle.png`, `attack-ready.png`, `lunge.png`, `hit.png`, `defeat.png`
  (mapping — см. таблицу выше; sheet `(1)` не копировался).

State -> gameplay event mapping (реализовано и проверено):
- appearance → `idle`
- finite `countdown <= 1` → `attackReady` (baseline)
- `enemyAttacks[].id` → `attack` (450ms) → baseline
- hit (`r.hit && e.side === r.arenaDir`) → `hit` (500ms) → baseline
- `e.dead` → `defeat`, терминал (pose swap + fade в dying-окне 550ms)

Multi-enemy: cp-e4 (E + N) — каждый актор независим (Map + per-actor snapshot);
попадание/убийство одного не трогает второго (покрыто engine-тестом и
browser-asserts). Left/right: E-side mirror, anchor/scale стабильны.

Тесты (новых 18, весь сьют 169/169):
- `test/vis-006-enemy-visual-state.test.ts` (15): baseline/порог, snapshot,
  appear, hit/attack holds, sync, defeat terminal, независимость акторов,
  manual override, anchor-метаданные, ровно 5 поз.
- `test/vis-006-enemy-engine-mapping.test.ts` (3): на РЕАЛЬНОМ EncounterState —
  независимость двух волков + arming telegraph, kill → defeat только у убитого,
  strike → attack → attackReady (interval 1). Локальный `driveTap` зеркалит
  attribution из app.js (зафиксировано в комментарии файла); дрейф ловится
  browser-проверкой `visualDebug.wolf()`.

## VERIFY

- `npm run typecheck` — чисто (после `npm ci` в новом worktree; node_modules
  не в git).
- `npm test` — 14 файлов, 169/169 PASS (в т.ч. 18 новых VIS-006).
- `npm run build` — чисто.
- Browser (headless Chromium 1228 через executable_path + Python Playwright,
  локальный serve.mjs :5183, сцена cp-e4 + регрессия cp-e5), оба вьюпорта
  1920x1080 и 1366x768, скрипт
  `C:\Users\nerza\AppData\Local\Temp\opencode\vis006-verify.py` (prototype-only,
  не коммитится) — 24/24 PASS asserts на `window.visualDebug.wolf()`:
  - появление: оба idle; `wolf art: 5/5 poses loaded`;
  - E-hit → e=hit, n=idle (независимость); N-hit → n=hit;
  - telegraph → e=attackReady; n → idle (cd 3, порог точный);
  - S-miss → e=attack + урон игроку 10→8;
  - kill → e=defeat; won → оба defeat;
  - cp-e5: `wolf()` null, boss taunt intact (регрессии boss нет).
- Screenshots (12, не коммитятся, лежат в
  `C:\Users\nerza\AppData\Local\Temp\opencode\`): `vis006-{1920x1080,1366x768}-
  {1-idle,2-hit,3-attackready,4-attack,5-defeat,6-won}.png`. Pose swap
  различим; E-wolf mirrored лицом к board; defeat-fade + «повержен» видны;
  anchor стабилен между позами.

## FOUND

- Source-имена generic (`ChatGPT Image ... (N).png`); mapping выведен по
  визуальному соответствию подписанному ряду на sheet `(1)` и зафиксирован
  в карточке (не silent-guess). Внимание: `(3)` — это `11_11_00`, не `11_10_59`.
- Wolf-арт в enemy-панелях выглядит мелко: contain-fit в фиксированный
  footprint + активный клип не дают нарисовать крупнее без смены layout.
  Сознательно оставлено (anchor/scale стабильны — требование задачи);
  увеличение панелей — отдельный layout-scope, не здесь.
- Headless-артефакт (не баг приложения, как в VIS-005): holds истекают на
  живых кадрах; wolf-hold сам держит цикл живым до expiry, поэтому
  browser-asserts стабильны без хаков.
- Вне scope, не чинилось: cp-e4 — provisional-контент EXP-010b (не
  user-approved); обе enemies-панели рисуют волка (Dire Wolf — первый и пока
  единственный ordinary visual, shaman-слот не трогался).
- `node_modules` отсутствует в свежих worktree (не в git) — перед typecheck/
  test/build нужен `npm ci` в `spikes/arrow-core`.
