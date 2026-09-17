# TASK: EXP-011 — Attack Types / Cast Interrupt

STATUS: DONE
TYPE: EXP
SIZE: L
AGENT: Claude Sonnet 5 (direct user brief, no separate architect task-card pre-written)
BASE_BRANCH: exp/EXP-010b-multi-enemy (финальный tip, включая доп. design-коммит после его RESULT_SHA)
BRANCH: exp/EXP-011-attack-types
START_SHA: c70ea85feba8198e07c669d922b9cdc6c36fab2c
CODE_SHA: 570aa2724a08e2fda11a9bcaacc0176a4757ac9a
RESULT_SHA: 570aa2724a08e2fda11a9bcaacc0176a4757ac9a

## Что нужно было сделать

Добавить понятие типа атаки врага (normal / cast) и реализовать принятое пользователем поведение
второй фазы mini-boss (seed 1571): cast прерывается попаданием без нанесения cast-урона, враг
переключается на normal attack, без искусственного `timer += 1` и без full reset таймера. Модель
должна быть общей для будущих обычных Caster-врагов, не только для босса. Полный бриф — в истории
сессии; ключевые запрещённые модели явно перечислены в брифе (bonus/full-reset/always-interrupt).

## Что важно знать

- Прочитаны перед стартом: `.orchestra/RULES.md`, `.orchestra/PROJECT.md`, `.orchestra/GIT.md`,
  `.orchestra/LEVEL-DESIGNER.md`, `docs/GAME-CONCEPT.md`, `docs/COMBAT-RULES.md`,
  `docs/BALANCE-SYSTEM.md`, `spikes/arrow-core/EXP-010b-REPORT.md`.
- В момент старта основной checkout репозитория (`C:\Users\nerza\Projects\ARROW-ROGUELITE`) уже
  находился на другой, параллельно выполняемой задаче (`exp/EXP-012-multi-encounter-analyzer`) —
  видно по `git reflog`. Чтобы не мешать этой сессии, задача выполнена в отдельном git worktree
  (`.worktrees/EXP-011`), а не в основном checkout.
- `exp/EXP-010b-multi-enemy` к моменту старта имел один коммит поверх своего же зафиксированного
  результата (`design: shortlist and detailed specifications for Act I first 3 encounters`,
  `c70ea85`) — задача стартовала от этого финального tip, как и просил бриф ("работай от финального
  exp/EXP-010b-multi-enemy"), не от более старого RESULT_SHA той задачи.
- Полный технический разбор — `spikes/arrow-core/EXP-011-REPORT.md`.

## Можно менять

- `spikes/arrow-core/**` (расширено обратно совместимо: старый `boss.phases`/`enemies` путь не
  переписан; `AttackTimer.kind`/`interruptible`/`interruptedAttack` — новые опциональные поля)
- эта карточка

## Не менять

- `docs/**`, `research/**`, корневые `tools/**`, `.orchestra/*` кроме этой карточки
- не делать: items/weapons/Act I content/economy/ads/rewards/art/Phaser/production rewrite,
  procedural encounter generation, большой рефакторинг, новые enemy archetypes сверх test fixture,
  снижение HP босса или изменение seed ради solver'а, искусственный бонус к таймеру

## Готово, если

- [x] `npm run typecheck`, `npm test` (106/106: 93 старых + 13 новых), `npm run build` зелёные;
- [x] `AttackTimer.kind`/`interruptible`/`interruptedAttack` реализованы и валидируются
      (`checkAttackTimer`), общие для `BossPhase` и `EnemyDef`;
- [x] normal attack не меняется (hit наносит damage, timer не reset, не interrupt);
- [x] cast с `interruptible: true` прерывается попаданием: cast damage не происходит, следующая
      атака — normal (со своим отдельным interval/damage), без bonus/full-reset;
      cast без `interruptible` игнорирует попадания для целей таймера (ведёт себя как normal);
- [x] mini-boss phase 2 (seed 1571) теперь начинается в CAST, прерывается попаданием, дальше живёт
      как normal attack; seed и HP босса не менялись;
- [x] `minDamageToWin` доказывает 0-damage path для всех пяти прологовых encounter (E1-E5) —
      закрывает FOUND из `EXP-010b-REPORT.md` §6;
- [x] multi-enemy (EXP-010b) не сломан — все старые enemies-mode тесты зелёные без изменений;
- [x] boss sequential phases (E1-E3) не сломаны — без изменений;
- [x] viewer различает `CAST IN N` / `ATTACK IN N` и показывает `CAST ПРЕРВАН` при interrupt,
      проверено вручную в браузере (клики через реальный UI, не только консоль);
- [x] 10 запрошенных категорий тестов покрыты в `test/attack-types.test.ts` (13 тестов) +
      обновлены 2 устаревших теста (`multi-enemy.test.ts`, `combat-pressure.test.ts`), которые
      проверяли теперь неверное поведение (1-damage floor / cw гарантированно проигрывает).

## Проверить

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/cp-e1.json --player-hp 10
npm run cli -- encounter encounters/cp-e2.json --player-hp 10
npm run cli -- encounter encounters/cp-e3.json --player-hp 10
npm run cli -- encounter encounters/cp-e4.json --player-hp 10
npm run cli -- encounter encounters/cp-e5.json --player-hp 10
node tools/serve.mjs 5183   # или любой свободный порт
# http://localhost:<port>/viewer/cp-prologue.html
```

## Когда остановиться

Остановиться и поставить `STATUS: BLOCKED`, если:
- нужную точку старта нельзя воспроизвести;
- задача требует выйти за разрешённые рамки;
- нужен более дорогой уровень задачи;
- правила проекта противоречат друг другу.

Ничего из этого не произошло; задача выполнена в разрешённых рамках. Единственное отклонение от
буквального пути (worktree вместо основного checkout) сделано для защиты параллельно работающей
сессии, а не из-за блокировки самой задачи.

## Итог

RESULT: полный разбор — `spikes/arrow-core/EXP-011-REPORT.md`. Кратко: `AttackTimer` получил
`kind: 'normal' | 'cast'` и opt-in interrupt (`interruptible` + `interruptedAttack`), общий для
boss-фаз и simultaneous enemies. Mini-boss phase 2 (seed 1571, HP и seed не менялись) теперь
начинается в CAST, попадание прерывает cast без урона и переключает на normal attack со своим
provisional interval (TUNING, см. отчёт) — `minDamageToWin` доказывает 0-damage path для всего
пролога E1-E5, закрывая FOUND из EXP-010b. Viewer и CLI-отчёты показывают `CAST IN N`/`ATTACK IN N`
и `CAST ПРЕРВАН`/`CAST INTERRUPTED`. 106/106 тестов зелёные (93 старых + 13 новых); 2 устаревших
assertion переписаны под новую проверенную реальность. `main` не тронут.

VERIFY: `npm run typecheck`, `npm test` (106/106), `npm run build`, CLI-валидатор для всех пяти
encounter-файлов (exit 0 у каждого), живая проверка в browser preview (порт 5183, реальные клики
через UI, скриншоты в истории сессии).

FOUND:
1. Устранение 1-damage floor в phase 2 попутно убрало и другой, ранее фатальный сценарий:
   `test/combat-pressure.test.ts`'s "неправильный" cw Rotate при entryHp=4 раньше гарантированно
   убивал игрока, теперь выживает (с запасом 1 HP вместо 3 у ccw). Это ожидаемое следствие того,
   что phase 2 в целом стала мягче, не скрытая правка баланса — зафиксировано в отчёте §3 и в
   переписанном тесте, решение оставлено пользователю/level designer (человеческий плейтест по
   `.orchestra/LEVEL-DESIGNER.md` §6 G).
2. Легаси `interruptOnHit`/`interruptHits` (EXP-010, full-reset-on-N-hits) оставлены нетронутыми —
   отдельный, независимый от нового `kind`/`interruptible` механизм, по-прежнему не используется
   ни одним контентом. Не убирался, так как не входил в разрешённый scope и не является механизмом
   этой задачи.
3. `tools/cp-shortlist.ts` по-прежнему не понимает `kind`/`interruptible` — не требовалось (seed/HP
   босса не менялись), но будущий поиск seed для обычного Caster-врага потребует доработки
   инструмента, как и уже отмеченное в EXP-010b ограничение для multi-enemy.
