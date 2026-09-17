# TASK: EXP-013 — Enemy Board Abilities / Stone Throw

STATUS: DONE
TYPE: EXP
SIZE: L
AGENT: Claude Sonnet 5 (direct user brief, no separate architect task-card pre-written)
BASE_BRANCH: exp/EXP-011-attack-types
START_SHA: b325ecab1d7be26ec8fde5c998b01685a07c1414
CODE_SHA: 154d2a4
RESULT_SHA: 154d2a4

## Что нужно было сделать

Проверить EXPERIMENT-идею "враги могут менять puzzle board во время боя": минимальный
event/state-механизм плюс одна конкретная способность — Stone Throw (THROW IN N, детерминированный
выбор свободной стрелки, временный PIN на N world turns, без damage, без hard/soft lock). Механика
НЕ считается принятой пользователем. Полный бриф — в истории сессии; ключевые ограничения: не
строить универсальный ability framework, не трогать topology/generator, отдельный debug encounter
(не трогать принятый prologue/Act I), deterministic targeting без RNG в combat state.

## Что важно знать

- Прочитаны перед стартом: `.orchestra/RULES.md`, `.orchestra/PROJECT.md`, `.orchestra/GIT.md`,
  `.orchestra/LEVEL-DESIGNER.md`, `docs/GAME-CONCEPT.md`, `docs/COMBAT-RULES.md`,
  `docs/BALANCE-SYSTEM.md`, `spikes/arrow-core/EXP-011-REPORT.md`.
- Задача выполнена в отдельном git worktree (`.worktrees/EXP-013`), а не в основном checkout —
  основной checkout репозитория в момент старта был занят другой, не связанной работой (`main`),
  и уже существовал отдельный worktree для базовой ветки; работать в изолированном worktree —
  сложившийся в этой цепочке задач паттерн (см. `.orchestra/tasks/EXP-011-attack-types.md`).
- Полный технический разбор — `spikes/arrow-core/EXP-013-REPORT.md`: модель pin-state, turn order
  (с обоснованным отклонением от исходного порядка из брифа — tick существующих pin ПЕРЕД
  резолвом новой способности, иначе `pinDuration: N` фактически работал бы как N-1), softlock
  safeguards, пример пути, известные ограничения.

## Можно менять

- `spikes/arrow-core/**` (расширено обратно совместимо: `BoardState`/topology/generator не
  тронуты; `EnemyAbility`/`AbilityTargetPolicy`/`EnemyDef.ability` — новые опциональные поля;
  boss-mode путь не тронут вообще)
- эта карточка

## Не менять

- `docs/**`, `research/**`, корневые `tools/**`, `.orchestra/*` кроме этой карточки
- не делать: permanent rocks, dynamic geometry mutation, новые board shapes, несколько новых
  abilities, item system, Act I content, random targeting, art/animation, physics, generalized
  scripting/ECS, большой рефакторинг, изменения в принятом prologue chain (`cp-e1..cp-e5.json`,
  `viewer/cp-prologue.js` STEPS) или Act I контенте

## Готово, если

- [x] `npm run typecheck`, `npm test` (124/124: 106 старых + 18 новых), `npm run build` зелёные;
- [x] `EnemyAbility`/`AbilityTargetPolicy`/`EnemyDef.ability` реализованы, валидируются
      (`checkAbility`), `BoardState` не тронут (pin — overlay в `EncounterState`);
- [x] pin блокирует tap (без HP-урона, без движения таймеров, не считается world turn), но не
      меняет геометрию/blocking (`canExit` пинованной стрелки остаётся true);
- [x] pin истекает детерминированно через `pinDuration` ходов и стрелка снова становится playable;
      target selection детерминирован (lowest free-and-unpinned id), без RNG;
- [x] ability никогда не запирает единственную playable arrow (softlock guard) и безопасно fizzle
      при отсутствии валидной цели — оба случая покрыты тестами;
- [x] `key()` различает состояния с одинаковым alive-set, но разным pin; `undo()` полностью
      восстанавливает pin state; solver (`findWin`/`maxHits`/`minDamageToWin`) использует
      `playableArrows()` вместо `board.freeArrows()` — иначе ломался бы undo-бухгалтерия DFS;
- [x] отдельный debug encounter `encounters/rock-spike.json` (easy seed 15) и отдельный viewer
      (`viewer/rock-spike.html/.js`), принятый prologue/Act I не тронуты;
      solver доказывает solvability и отсутствие softlock;
- [x] viewer показывает THROW IN N, rock-маркер на pinned arrow, понятный feedback (PINNED / BLOCKED
      BY ROCK, ROCK THROWN, UNPINNED) — проверено вручную в browser (реальные click-события через
      DOM, скриншоты в истории сессии);
- [x] 15 запрошенных категорий тестов покрыты в `test/enemy-abilities.test.ts` (18 тестов, включая
      2 дополнительных: Rotate-driven tick, checkEncounter-валидация).

## Проверить

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/rock-spike.json --player-hp 10
npm run cli -- encounter encounters/cp-e1.json --player-hp 10
npm run cli -- encounter encounters/cp-e2.json --player-hp 10
npm run cli -- encounter encounters/cp-e3.json --player-hp 10
npm run cli -- encounter encounters/cp-e4.json --player-hp 10
npm run cli -- encounter encounters/cp-e5.json --player-hp 10
node tools/serve.mjs 5185   # или любой свободный порт
# http://localhost:<port>/viewer/rock-spike.html
```

## Когда остановиться

Остановиться и поставить `STATUS: BLOCKED`, если:
- нужную точку старта нельзя воспроизвести;
- задача требует выйти за разрешённые рамки;
- нужен более дорогой уровень задачи;
- правила проекта противоречат друг другу.

Ничего из этого не произошло; задача выполнена в разрешённых рамках. Единственное отклонение от
буквального пути (worktree вместо основного checkout) сделано по той же причине, что и в EXP-011 —
не мешать параллельно работающим сессиям в общем репозитории.

## Итог

RESULT: полный разбор — `spikes/arrow-core/EXP-013-REPORT.md`. Кратко: `EnemyDef.ability` даёт
врагу независимый `THROW IN N` countdown; единственная реализованная способность — Stone Throw,
детерминированно пинит самую свободную-и-непинованную стрелку с наименьшим id (гарантированно не
последнюю playable), на `pinDuration` ходов. `BoardState` не тронут — pin живёт как temporary
availability overlay в `EncounterState` (`playableArrows()`), который теперь использует и solver
вместо `board.freeArrows()` (иначе портилась undo-бухгалтерия DFS на пинованных id). Turn order
осознанно тикает существующие pin ДО резолва новой способности (иначе `pinDuration` был бы off-by-one).
Отдельный debug encounter `rock-spike.json` (easy seed 15, board-clear-alive fight) и отдельный
viewer демонстрируют ровно заявленный сценарий: хорошая свободная стрелка временно выключается,
игрок вынужден на 2 хода сменить приоритет. 124/124 тестов зелёные (106 старых + 18 новых); `main`
не тронут.

VERIFY: `npm run typecheck`, `npm test` (124/124), `npm run build`, CLI-валидатор для
rock-spike.json и всех пяти прологовых encounter (exit 0 у каждого), живая проверка в browser
preview (порт 5185, реальные DOM click-события через тот же code path, что обычный клик,
скриншоты и точные сравнения текста фидбека в истории сессии).

FOUND:
1. Самоисправлено в рамках этой же задачи: первый черновик `rock-spike.json` использовал `hp: 3`
   (ровно столько, сколько нужно N-стрел для убийства) — solver находил 4-tap решение, где Stone
   Throw срабатывал ровно на ходе убийства и практически не влиял на игру. Заменено на `hp: 6`
   (вынуждает board-clear-alive, ~11 ходов), что даёт Stone Throw реально сработать дважды и
   продемонстрировать именно заявленный сценарий смены приоритета. Не оставлено как открытый FOUND
   — исправлено до сдачи.
2. `EnemyAbility` реализован только для `EnemyDef` (simultaneous enemies), не для `BossPhase` —
   не требовалось брифом ("1 обычный enemy"), но если способности понадобятся боссам, это отдельная
   небольшая доработка (per-phase pin-bookkeeping через смену фаз).
3. Softlock guard — простая локальная проверка ("оставит ли этот конкретный pin хотя бы одну
   playable arrow прямо сейчас"), не полная forward-re-проверка solvability на много ходов вперёд.
   Для одной Stone Throw с коротким `pinDuration` этого достаточно (и `rock-spike.json` отдельно
   доказан `minDamageToWin`), но будущая способность с длинным pin/несколькими одновременными pin
   могла бы в теории пройти локальную проверку и всё равно привести к позднему тупику — не
   наблюдалось ни на одном encounter в репозитории, отмечено как ограничение масштабируемости
   guard'а, а не как баг в нём.
4. `tools/cp-shortlist.ts` по-прежнему не понимает `ability`/pin — не требовалось (seed 15 подобран
   и проверен вручную), тот же паттерн ограничения уже отмечался в EXP-010b/EXP-011 для их
   собственного нового контента.
