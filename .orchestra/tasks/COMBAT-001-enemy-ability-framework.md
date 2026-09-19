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

RESULT:
VERIFY:
FOUND:
