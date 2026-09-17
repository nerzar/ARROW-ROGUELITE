# TASK: LD-005 — Prologue 5x5 Pack

STATUS: DONE
TYPE: DESIGN
SIZE: M
AGENT: Gemini 3.8 Flash (level / puzzle designer)
BASE_BRANCH: design/LD-003-square-encounter-migration
BRANCH: design/LD-005-prologue-5x5-pack
START_SHA: 72437c36bc4ae308edb75669b9dcbe47464e9db1
RESULT_SHA: 08af076cf28f735a1f6a3b028751bd367a744dca

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

## RESULT

- Сформулирован Experience Contract каждого текущего прологового шага (E1: первый пазл-выстрел и холостой ход, E2: цена ошибки и заблокированный тап, E3: время имеет цену и дедлайн 4 хода, E4: приоритет двух независимых врагов, E5: смена фаз босса, срыв каста, обязательный Rotate и наказание за неверный поворот).
- Разработана и добавлена поддержка пресета `square5` (5x5) в `spikes/arrow-core/src/presets.ts` без нарушения генеративных инвариантов и тестов.
- Проведено сканирование тысяч семян в `square5` и `square6` с использованием точного детерминированного генератора и математического солвера (`minDamageToWin`, `findWin`, `EncounterState`).
- Сформирован shortlist из минимум 2 direct-playtest candidates на каждый шаг:
  * **E1 (First Puzzle Shot, 5x5, 1 HP N):**
    - Cand A: `square5` Seed 1107 (5 стрел, strict 1-free opener #0(E) -> #3(N), 2 taps, 0 dmg)
    - Cand B: `square5` Seed 3178 (5 стрел, strict 1-free opener #0(W) -> #3(N), 2 taps, 0 dmg)
  * **E2 (Mistake Has a Cost, 5x5, 2 HP E, blockedTapDamage 1):**
    - Cand A: `square5` Seed 1 (6 стрел, 1 free E, 1 blocked E, #0(E) -> #2(N) -> #1(E), 3 taps, 0 dmg)
    - Cand B: `square5` Seed 20 (6 стрел, 1 free E, 1 blocked E, #0(E) -> #2(W) -> #1(E), 3 taps, 0 dmg)
  * **E3 (Time Has a Cost, 5x5, 3 HP E, ATTACK IN 4 dmg 2):**
    - Cand A: `square5` Seed 132 (6 стрел, #3(S) -> #0(E) -> #5(E) -> #4(E), 4 taps, 0 dmg, отвлечение на W наказывается 2 dmg)
    - Cand B: `square5` Seed 238 (6 стрел, #3(N) -> #2(E) -> #1(E) -> #5(E), 4 taps, 0 dmg)
  * **E4 (Two Enemies / Priority, 5x5, Urgent E IN 3 vs Slow N IN 5):**
    - Cand A: `square5` Seed 119 (7 стрел, #0(E) -> #2(N) -> #1(E) -> #3(N), 4 taps, 0 dmg, ошибка приоритета наказывается 2 dmg)
    - Cand B: `square5` Seed 405 (7 стрел, #1(E) -> #2(N) -> #3(E) -> #0(N), 4 taps, 0 dmg)
  * **E5 (Goblin Shaman Boss, 6x6 primary vs 7x7 comparison):**
    - Cand A: `square6` Seed 4710 (9 стрел, Phase 1 E 4 HP IN 6; Phase 2 N 5 HP CAST IN 3 -> NORM IN 4, +1 Rotate; Rotate CW = 0 dmg, Rotate CCW = 1 dmg)
    - Cand B: `square6` Seed 4251 (10 стрел, Phase 1 E 4 HP; Phase 2 N 5 HP, Rotate CW = 0 dmg, Rotate CCW = 1 dmg)
    - Cand C (Comparison): `square7` Seed 98 (11 стрел, Rotate CW = 0 dmg, Rotate CCW = 2 dmg)
- Созданы изолированные playable JSON-файлы кандидатов:
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e1-candidate-a.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e1-candidate-b.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e2-candidate-a.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e2-candidate-b.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e3-candidate-a.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e3-candidate-b.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e4-candidate-a.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-e4-candidate-b.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-boss-candidate-a.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-boss-candidate-b.json`
  * `spikes/arrow-core/encounters/prologue-5x5-candidates/prologue-boss-candidate-7x7.json`
- Проведён подробный A/B анализ развития шкалы: Prologue starts at 5x5 vs starts at 6x6.
- Текущие production encounters (`cp-e1` – `cp-e5`) не изменены.
- Оформлен исчерпывающий дизайн-документ: `docs/LD-005-PROLOGUE-5X5-PACK.md`.

## VERIFY

1. `spikes/arrow-core`:
   - `npm run typecheck` — 0 ошибок.
   - `npm test` — 21 test files, 260 tests passed (включая 11 новых тестов в `test/ld-005-candidates.test.ts`).
   - `npm run build` — успешная компиляция TypeScript.
2. Проверка кандидатов шортлиста:
   - Все 11 файлов в `encounters/prologue-5x5-candidates/*.json` валидированы через `encounterFromJson`, хэши уровней совпадают.
   - Математически доказано `minDamageToWin = 0` для всех 11 кандидатов при безошибочной игре.
   - Добавлен автоматический регрессионный тест `test/ld-005-candidates.test.ts`.

## FOUND

1. **Идеальная плотность 5x5 для обучающего сегмента:** Поле 5x5 вмещает 5–7 стрел, что даёт кристальную ясность замысла без «мусорных» стрел, отвлекающих новичка. Механики «холостого» хода, цены ошибки и дедлайна считываются моментально.
2. **Жизнеспособность Goblin Shaman на 6x6:** На поле 6x6 (9–10 стрел) удаётся полностью воспроизвести механику босса: расход направления East в Фазе 1, срыв смертоносного каста в Фазе 2 и строгая дивергенция Rotate (CW спасает без урона, CCW наказывает уроном из-за истощения патронов). При этом 7x7 остаётся отличным альтернативным якорем для более монументального финала.

