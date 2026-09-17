# TASK: LD-005 — Prologue 5x5 Pack

STATUS: READY
TYPE: DESIGN
SIZE: M
AGENT: Gemini 3.8 Flash (level / puzzle designer)
BASE_BRANCH: design/LD-003-square-encounter-migration
BRANCH: design/LD-005-prologue-5x5-pack
START_SHA: 72437c36bc4ae308edb75669b9dcbe47464e9db1

## Goal

Проверить новую предлагаемую прогрессию размеров доски для текущего slice:
- обычные энкаунтеры пролога: преимущественно 5x5;
- босс пролога Goblin Shaman: можно больше, в первую очередь проверить 6x6;
- Act I: базовый размер 6x6, поздние/особые бои могут быть больше отдельным решением;
- Act II: будущий базовый размер ориентировочно 7x7.

Это PLAYTEST POLICY, не окончательный production law. Ничего автоматически не заменять.

## Context

Пользователю нравится, что размер доски растёт вместе с прохождением. В прологе важно не перегрузить игрока до появления предметов. Текущие прямоугольные уровни остаются валидным каноном до явного решения пользователя.

LD-003 уже подготовил квадратные кандидаты для ключевых encounters, но prologue boss candidates там в основном 7x7/8x8. Нужно проверить, можно ли сохранить характер боя на более компактной шкале.

## Read first

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/LEVEL-DESIGNER.md`
- `docs/COMBAT-RULES.md`
- `docs/LD-003-SQUARE-ENCOUNTER-MIGRATION.md`
- current prologue encounter JSONs
- existing generator/analyzer/solver tooling

## Required work

1. Сформулировать experience contract каждого текущего прологового шага простым языком.
2. Для обычных шагов найти сильные 5x5 варианты, сохраняющие механику и темп.
3. Для Goblin Shaman boss найти в первую очередь 6x6 варианты. Если 6x6 объективно хуже по игровому смыслу, разрешено также принести 7x7 как comparison, но не объявлять его победителем.
4. Для каждого шага дать минимум 2 direct-playtest candidates.
5. Все обычные прологовые encounters должны быть проходимы без unavoidable damage при идеальной игре, если конкретный старый encounter не имеет отдельного уже утверждённого исключения.
6. Не требовать предметы: в прологе их ещё нет.
7. Для boss сохранить:
   - CAST -> INTERRUPT -> normal attack;
   - meaningful Rotate moment;
   - возможность ошибочного Rotate с наказанием;
   - immediate encounter win semantics по текущим правилам.
8. Не менять production encounter files/run order.

## A/B question

Отдельно подготовить маленькое сравнение:
- Prologue starts at 5x5;
- Prologue starts at 6x6.

Не выбирать за пользователя. Дать конкретные плюсы/минусы именно на наших boards и 1–2 пары для быстрого ручного плейтеста.

## Output

Создать:
- `docs/LD-005-PROLOGUE-5X5-PACK.md`
- изолированные playtest JSON только для финального shortlist, например `spikes/arrow-core/encounters/prologue-5x5-candidates/`

Для каждого кандидата:
- size / seed;
- puzzle pattern;
- enemy setup;
- minDamage;
- intended path;
- plausible mistake/recovery;
- visual value;
- Rotate role.

## Do not

- не менять combat rules;
- не менять generator semantics;
- не менять HP/timers/Stone Pin/Rotate;
- не объявлять новую size policy окончательно принятой;
- не merge main.

## Verify

- analyzer/solver proof;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- финальные JSON реально грузятся и проходят как заявлено.

## Delivery

Перед DONE:
1. заполнить RESULT / VERIFY / FOUND;
2. commit;
3. push `design/LD-005-prologue-5x5-pack`;
4. проверить remote RESULT_SHA;
5. только потом STATUS: DONE.

Не merge main.
