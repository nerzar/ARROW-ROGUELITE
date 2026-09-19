# TASK: COMBAT-001 — Generic enemy ability framework

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/COMBAT-001-enemy-ability-framework
START_SHA: 9da57313344b63d32c1ce5f1fb9e94f2c356783e
RESULT_SHA:

## Цель

EXP-013 уже доказал одну enemy ability — `stone_throw`, которая по независимому таймеру временно pin'ит свободную стрелу.

Сейчас не строим большой scripting engine. Нужно сделать минимальный framework, чтобы `stone_throw` перестал быть единственным hardcoded видом `EnemyAbility`, и доказать расширяемость второй способностью.

## Второй proof: Shield

Shield здесь — только debug/proof framework, НЕ утверждённый контент Акта I.

Минимальное поведение:
- способность имеет свой `interval` как Stone Throw;
- когда countdown срабатывает, враг получает активный одноразовый shield;
- следующий projectile hit по этому врагу снимает shield и НЕ уменьшает HP;
- после снятия shield способность снова живёт по своему обычному countdown;
- обычный attack timer врага продолжает жить по текущим правилам и не reset'ится от shield/hit;
- blocked/pinned taps не считаются world turn, как и сейчас.

## Что сохранить

- поведение существующего `stone_throw` и pin-state без регрессий;
- deterministic solver / undo / state key;
- no-softlock логику Stone Throw;
- boss/combat canon;
- текущие attack/cast semantics;
- отсутствие gameplay-решений для Act I в этой задаче.

## Ожидаемая форма

Предпочтение — небольшой discriminated union/handler path вроде:
- `stone_throw`
- `shield`

Не делать generic event bus, DSL, scheduler или plugin architecture, если двух способностей можно честно поддержать проще.

Добавить отдельный debug encounter/fixture для Shield, не менять production Prologue/Act I encounters.

Viewer должен иметь достаточно state/result данных, чтобы позже показать shield телеграф/состояние, но отдельный арт/VFX shield сейчас не нужен.

## Готово, если

- `stone_throw` работает как раньше;
- `shield` доказывает второй тип ability с отличающимся эффектом;
- shield активируется детерминированно по world-turn countdown;
- ровно один hit поглощается, shield снимается;
- attack timers остаются независимыми;
- solver, key/undo учитывают новый state;
- debug encounter с Shield доказан как playable;
- существующие тесты зелёные, добавлены узкие тесты нового framework/Shield;
- `npm test`, `npm run typecheck`, `npm run build` зелёные.

## Проверить

Работа в `spikes/arrow-core`.

Дополнительно вручную открыть debug encounter и убедиться:
1. виден/читается момент активации shield хотя бы через текущий debug HUD/state;
2. первый hit снимает shield без HP damage;
3. следующий hit уже наносит обычный damage.

## Не делать

- не добавлять Shield в Prologue или Act I;
- не менять balance текущих encounters;
- не делать VFX/polish shield;
- не менять правила Rotate;
- не превращать ability framework в универсальный production scripting engine;
- не брать следующую задачу.

## Итог

RESULT: Minimal enemy-ability framework done. `EnemyAbility` is now a discriminated union (`stone_throw` | `shield`, absent `kind` = legacy stone so old JSON/tests are untouched) with one tiny handler path per kind in `spikes/arrow-core/src/encounter.ts`. Shield proof: own countdown raises a one-shot shield, next hit on that enemy is absorbed (`hit:true`, `hitDamage:0`, no interrupt), shield drops, attack timers keep their rules. Shield state is in snapshot/key/undo/solver trace/`enemies[]` (`shielded`) and in the debug HUD (`SHIELD IN N` / `SHIELD UP`, `?enc=shield-spike` in rock-spike viewer). New debug fixture `encounters/shield-spike.json` (same seed-15 board as rock-spike, solver-proven winnable). No Prologue/Act I content, balance, Rotate rules, or VFX touched.
VERIFY: `npm test` — 33 files / 378 tests green (15 new in `test/enemy-shield.test.ts`: timing, absorb-one-hit, no-stack fizzle, interrupt independence, key/undo, stone+shield coexistence, validation, shield-spike winnability); `npm run typecheck` green; `npm run build` green. Manual replay of `shield-spike.json` vs built dist: SHIELD-IN 3→2→1 then SHIELD-UP readable in state; first hit absorbed (hp 4→4, shield drops); next hit deals 1 (hp→3); `findWin` proven.
FOUND: None blocking. Note: with `interval: 1` an unconsumed shield refires every turn, so every second hit is absorbed — correct per "countdown lives its own life", just intense tuning, not a bug. Viewer shows shield as text only (no art/VFX per card).
