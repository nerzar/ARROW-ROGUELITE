# TASK: BUILD-020 — Playable Slice V01

STATUS: READY
TYPE: BUILD
SIZE: L
AGENT: Claude (integration engineer)
BASE_BRANCH: content/ACT-I-001-first-three-playtest
BRANCH: build/BUILD-020-playable-slice-v01
START_SHA: 20ee6d1cb6d48af43878b5604cdcee376d07a79f

## Goal

Собрать один реально играемый review-build из уже сделанных веток без merge в `main`:

- существующий пролог;
- Goblin Shaman = boss пролога;
- Moonlit Fortress arena + новый arena character layout;
- shared Rotate reward/pool после пролога;
- Act I encounters 1–3 из `content/ACT-I-001-first-three-playtest`;
- Goblin Taunter/King pack сохранить как будущего boss Акта I;
- Dire Wolf presentation сохранить как ordinary-enemy visual pipeline.

Это интеграционный PLAYTEST BUILD. Он не делает все входящие proposals автоматически принятыми и не утверждает production architecture.

## Source branches

- `content/ACT-I-001-first-three-playtest` @ `20ee6d1cb6d48af43878b5604cdcee376d07a79f` — база задачи, уже включает shared Rotate lineage.
- `feat/VIS-007-arena-character-layout` @ `3ec56a70563aff79ec974f1488dee20fb8292463` — включает VIS-005 + VIS-006 и arena/layout.
- `feat/VIS-008-prologue-shaman-boss` @ `eb683c286bbee5b46a3a3013a86df4ea48c4756a` — включает VIS-005 + VIS-006 и Shaman boss pack/species mapping.

Обе visual-ветки расходятся от VIS-006. Ожидаемые реальные пересечения: `viewer/visual-proto/app.js`, `assets.js`, `assets/README.md`. Конфликты разрешать вручную, сохраняя обе функции: VIS-007 layout/arena + VIS-008 boss species/Shaman.

## Canonical user decisions for this build

- Goblin Shaman = BOSS ПРОЛОГА.
- Goblin Taunter / Goblin King = BOSS ПЕРВОГО АКТА; pack сохраняется, но Act I boss encounter пока не придумывать.
- Dire Wolf = ordinary enemy visual asset/pipeline.
- После победы над boss пролога игрок получает 2 shared Rotate charges; они переносятся между encounters.
- Rotate не должен автоматически восстанавливаться между Act I encounters.
- Main не трогать.

## Integration strategy

Работать в уже созданной ветке `build/BUILD-020-playable-slice-v01` от указанного START_SHA.

Предпочтительно интегрировать source branches через обычные merge/cherry-pick операции с понятной историей. Не переписывать чужие commits и не rebase source branches.

Сначала получить arena/layout lineage (VIS-007), затем Shaman-specific changes (VIS-008), разрешив общие файлы вручную. Не тащить design branch LD-002 в runtime build: это источник для следующих уровней, не runtime dependency.

## Required playable flow

Один viewer/run должен позволять пройти:

Prologue encounters -> Prologue Boss (Goblin Shaman) -> reward `+2 ROTATE` -> Act I #1 -> Act I #2 -> Act I #3 -> prototype end screen.

Сохранить:

- player HP между encounters;
- shared Rotate pool;
- restart current encounter;
- restart whole run.

Не строить world map/shop/meta-progression в этой задаче.

## Visual requirements

Использовать утвержденную арену из VIS-007.

Goblin Shaman на prologue boss:
- крупный actor на arena TOP slot, без legacy character box;
- taunt/idle/cast/stunned/angry/defeat из VIS-008/VIS-005 state machine;
- HUD отдельно от sprite;
- cast/interrupt должен визуально читаться.

Goblin Taunter/King:
- pack и debug availability не удалять;
- не показывать как boss пролога.

Dire Wolf:
- existing VIS-006 states и per-actor independence сохранить;
- новый VIS-007 full-size arena layout сохранить.

IMPORTANT: Act I content содержит generic `grunt_*` и `caster_*` IDs. Не объявлять их автоматически конкретными видами врагов без решения пользователя. Если текущий prototype visual fallback показывает wolf для generic ordinary enemies, это допустимый временный PLAYTEST fallback только при явной пометке в debug/status; `caster_*` НЕ должен изображаться Goblin Shaman boss-паком. Зафиксировать это в FOUND и не переименовывать encounter IDs ради графики.

## Gameplay boundaries

Не менять без необходимости:

- combat semantics;
- HP/damage/timers;
- Stone Pin semantics;
- Rotate semantics;
- seeds 22 / 112 / 25;
- generator/solver;
- boss balance;
- encounter definitions.

Если интеграция выявляет настоящий конфликт — записать FOUND. Не балансировать самовольно.

## Allowed scope

Разрешено менять только:

- `.orchestra/tasks/BUILD-020-playable-slice-v01.md`;
- `spikes/arrow-core/viewer/visual-proto/**`;
- integration-specific tests under `spikes/arrow-core/test/`;
- минимальный glue в `spikes/arrow-core/src/run-state.ts` ТОЛЬКО если текущий Act I flow невозможно сохранить без него.

Не менять docs/design content в этой задаче. Устаревшие design-документы перечислить в FOUND.

## Verification

В `spikes/arrow-core`:

- `npm ci` если worktree свежий;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Browser playtest минимум на 1920x1080 и 1366x768:

1. пройти пролог;
2. Shaman boss отображается, Taunter не подменяет его;
3. CAST pose -> interrupt -> stunned -> normal/angry baseline;
4. boss defeat terminal;
5. после boss показан `+2 ROTATE`, pool = 2;
6. Act I #1 -> #2 -> #3 реально последовательно загружаются;
7. использование Rotate уменьшает общий pool и значение переносится дальше;
8. arena background/layout остаются активны;
9. board кликабелен, HUD не перекрывает board;
10. ordinary actors независимы визуально;
11. restart current и restart run не ломают HP/Rotate semantics.

Сохранить review screenshots минимум: prologue boss cast, interrupt, defeat/reward, Act I multi-enemy, 1366 layout.

## RESULT / VERIFY / FOUND

Исполнитель обязан заполнить эти секции перед сдачей.

Особенно в FOUND указать:

- все ручные merge-conflicts и как разрешены;
- generic grunt/caster visual fallback;
- устаревшие документы про старую роль Taunter/Shaman;
- любые сцены, которые пока остаются debug/provisional.

## Delivery

1. Сделать code commit(s).
2. Заполнить RESULT / VERIFY / FOUND.
3. Сделать report/task commit.
4. `git push origin build/BUILD-020-playable-slice-v01`.
5. Проверить remote RESULT_SHA.
6. Только после этого `STATUS: DONE` и остановиться.

НЕ merge `main`.
НЕ удалять source/task branches.
