# TASK: LD-003 — Square Encounter Migration Shortlist

STATUS: READY
TYPE: DESIGN
SIZE: L
AGENT: Gemini 3.8 Flash (level / puzzle designer)
BASE_BRANCH: fix/FIX-021-board-plane-projection
BRANCH: design/LD-003-square-encounter-migration
START_SHA: edb56232beb3b46d322388c369cb598ccf9dccc1

## Goal

Найти квадратные кандидаты для уже обкатанных прямоугольных encounters, сохранив их игровой смысл и интересность. Ничего не заменять автоматически: пользователь потом сыграет старый и новый варианты рядом и решит.

## Context / accepted direction

Текущий production visual — square-first. Основные размеры: `6x6`, `7x7`, `8x8`, `9x9`, `10x10`. `EXP-015` подтвердил: 6–7 хороши для ранней игры, 8–10 — основной sweet spot, 12x12 допустим для больших боёв, 14–16 special/boss only.

При этом текущие одобренные/обкатанные encounters исторически прямоугольные. Их НЕ считать ошибкой и НЕ удалять: пока квадратная замена не одобрена пользователем, старый encounter остаётся каноном.

Новая arena policy: арена сама является каменным board well. Runtime рисует стрелки прямо на сцене, без второго opaque board/background. Для baked-grid 6x6 арен логический board должен реально совпадать с 6x6; нельзя насильно класть 6x7 на baked 6x6.

## Read first

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/LEVEL-DESIGNER.md`
- `docs/COMBAT-RULES.md`
- `docs/ACT-I-1-6-REVISED.md`
- `docs/LD-002-PUZZLE-PATTERN-LIBRARY.md`
- `docs/EXP-015-BOARD-SCALE-READABILITY.md`
- current encounter JSONs under `spikes/arrow-core/encounters/`
- existing analyzer / shortlist / multi-shortlist tooling under `spikes/arrow-core/tools/`

If a named doc is on another completed branch, read it there or record FOUND if unavailable. Do not invent its contents.

## Encounters to migrate

At minimum investigate square alternatives for the currently important encounters:

1. Prologue boss / Goblin Shaman boss — current directional/Rotate boss puzzle around seed 1571.
2. Act I #1 — seed 22, multi-enemy / first meaningful two-target pressure.
3. Act I #2 — seed 112, Cross-Lock / ordering puzzle.
4. Act I #3 — seed 25, Caster + escort / `CAST -> INTERRUPT -> normal attack`.

If Act I #4–#6 are already implemented/provisional in the current lineage, include them as a SECONDARY appendix, but do not let them delay the first four.

## Core rule: preserve encounter identity, not seed

For each current encounter first write its **experience contract** in plain language:

- what the player is supposed to notice;
- what the first meaningful choice is;
- what makes the puzzle non-trivial;
- what the enemy pressure adds;
- what common mistake looks like;
- whether clean/no-damage play should exist;
- whether Rotate is optional / rescue / boss-critical;
- what must NOT disappear in migration.

Then search square boards that preserve this contract.

Do NOT search for a seed merely because numeric metrics are similar.

## Square search space

Primary:
- 6x6
- 7x7
- 8x8
- 9x9
- 10x10

Use size intentionally:
- prologue / earliest teaching: prefer 6x6–7x7;
- early Act I: usually 7x7–9x9;
- dense/boss puzzle: 8x8–10x10 if it remains readable.

Do not force every encounter to the same size.

## Search / proof requirements

Use existing generator + analyzer tooling. Do not eyeball only a handful of seeds.

For each target encounter:
- scan enough seeds to obtain meaningful diversity (normally at least several thousand per relevant size if cheap);
- classify candidates using the puzzle-pattern language from LD-002;
- reject trivial lookalikes;
- produce at least 3 strong square candidates;
- actually replay / validate the intended path;
- test at least one plausible mistake / alternate path;
- record whether recovery is possible.

For combat encounters report, where tooling supports it:
- solvable/proven;
- minDamage;
- clean-path existence;
- example winning path;
- first hit timing / direction availability;
- Rotate requirement / benefit;
- node budget or proof status.

Never guess a property when the solver did not prove it.

## Special encounter contracts

### Prologue Goblin Shaman boss

Current role:
- teaches boss pressure;
- phase/cast interaction matters;
- `CAST` can be interrupted;
- interrupted cast changes to ordinary attack, it does NOT simply reset the cast;
- Rotate should create a meaningful boss moment, but do not make the replacement easier than the current approved feel;
- user liked the possibility of making the wrong Rotate and losing.

Find square boss boards with a genuine phase / directional break, not merely "many arrows point the right way".

### Act I #1 / seed 22

Preserve the feeling that the puzzle matters before the kill; avoid a board where the obvious first click instantly deletes the main threat. Multi-enemy pressure must remain readable and preferably clean-playable.

### Act I #2 / seed 112

Preserve Cross-Lock / ordering identity. The replacement should have at least two meaningful directional layers or a comparable interdependency; not just a linear chain.

### Act I #3 / seed 25

Preserve `CAST -> INTERRUPT -> normal attack` as the reason the board is interesting. The square board should make reaching the interrupt direction a puzzle under deadline, without guaranteed early damage.

## Visual suitability

For every shortlisted seed also rate:
- `VISUAL_VALUE`: LOW / MEDIUM / HIGH;
- does the board use long arrow paths nicely;
- does it form a memorable shape / hero path;
- is it readable on a square arena well;
- does it look good without a separate board background.

Avoid boards that are analytically clever but visually look like random spaghetti.

## Comparison output

Create:

`docs/LD-003-SQUARE-ENCOUNTER-MIGRATION.md`

For each target encounter include:

### CURRENT
- current seed / size;
- experience contract;
- why user liked / accepted it;
- known weakness if any.

### SQUARE CANDIDATES
At least 3:
- size;
- seed;
- puzzle pattern;
- enemy setup;
- proof metrics;
- intended path summary;
- mistake/recovery summary;
- Rotate role;
- visual value;
- why it preserves or changes the experience.

### SIDE-BY-SIDE RECOMMENDATION SET
Do NOT pick a winner for the user.
Instead name 2 candidates worth direct human playtest against the current encounter.

## Deliver playable artifacts

Do not rewrite production encounters.

But create playtest-only square encounter JSONs under a clearly isolated path, e.g.:

`spikes/arrow-core/encounters/migration-candidates/`

Naming example:
- `prologue-boss-square-a.json`
- `act1-e1-square-a.json`

Only include the final direct-playtest shortlist, not hundreds of generated files.

If the existing viewer can load them without production wiring, document the exact command/URL. Do not add runtime menu/product changes unless strictly necessary for research.

## Do NOT

- do not replace current seeds/content;
- do not modify production run order;
- do not change combat rules;
- do not change generator semantics;
- do not change Rotate / Stone Pin / timers / HP;
- do not redesign enemies;
- do not merge `main`;
- do not declare a square candidate user-approved.

If a square version is clearly worse, say so. It is acceptable to recommend keeping a rectangular encounter temporarily.

## Verify

Run the relevant analyzer/solver checks and existing test suite for any committed research artifacts.

At minimum:
- `npm run typecheck`
- `npm test`
- `npm run build`

For each direct-playtest candidate verify it loads and can be completed as claimed.

## Delivery

Before DONE:
1. fill `RESULT`, `VERIFY`, `FOUND`;
2. commit report + playtest candidates + any small research helper;
3. push `design/LD-003-square-encounter-migration`;
4. verify remote HEAD;
5. only then `STATUS: DONE`.

Do not merge main.

## RESULT

- Сформулирован подробный Experience Contract для 4 ключевых канонических энкаунтеров:
  1. Prologue Boss (Goblin Shaman): двухфазный бой (E 4 HP $\to$ N 5 HP), +1 Rotate, дефицит стрел North, смертоносный каст (`CAST IN 3`, interruptible $\to$ normal), наказание за неверный Rotate (CW побеждает, CCW наказывает уроном).
  2. Act I #1 (Two-Front Stand, seed 22): фланговый приоритет (срочный West 2 HP IN 3 vs медленный East 3 HP IN 5), защита от бездумного 2-кликового вайпа, ложная приманка на East, чистое прохождение за 5 ходов.
  3. Act I #2 (The Cross-Lock, seed 112): взаимное отпирание стрел North и East, срочный East блокирован на старте, 4 хода до победы.
  4. Act I #3 (Caster Awakens, seed 25): Caster N (3 HP, CAST IN 3 dmg 4, interruptible) + свита Grunt E (2 HP, IN 4), срыв каста секунда в секунду на ходу 3, чистое прохождение за 5 ходов.
- Проведено сканирование тысяч семян в пространстве 6x6, 7x7, 8x8, 9x9, 10x10 с использованием точного детерминированного генератора и математического солвера (`minDamageToWin`, `findWin`, `EncounterState`).
- Для каждого энкаунтера отобрано минимум 3 сильных кандидата, из которых выделен прямой шортлист из 2 кандидатов (A и B) для сравнительного ручного плейтеста:
  * **Prologue Boss:**
    - Cand A: `square8` Seed 388 (16 стрел, CW = 0 dmg, CCW = 2 dmg)
    - Cand B: `square7` Seed 98 (11 стрел, CW = 0 dmg, CCW = 2 dmg)
  * **Act I #1:**
    - Cand A: `square7` Seed 112 (10 стрел, W IN 3 + E IN 5, 5 taps, 0 dmg, false bait)
    - Cand B: `square6` Seed 57 (11 стрел, 5 taps, 0 dmg, exact dais tile)
  * **Act I #2:**
    - Cand A: `square6` Seed 41 (10 стрел, E=0 free, чистый замок N $\to$ E $\to$ E $\to$ N, 4 taps, 0 dmg)
    - Cand B: `square7` Seed 66 (12 стрел, E=0 free, просторный замок N $\to$ E $\to$ E $\to$ N, 4 taps, 0 dmg)
  * **Act I #3:**
    - Cand A: `square8` Seed 231 (13 стрел, срыв каста ровно на ходу 3, 5 taps, 0 dmg)
    - Cand B: `square7` Seed 25 (12 стрел, тот же Seed 25, срыв на ходу 3, 6 taps, 0 dmg)
- Созданы изолированные playable JSON-файлы кандидатов шортлиста:
  * `spikes/arrow-core/encounters/migration-candidates/prologue-boss-square-a.json`
  * `spikes/arrow-core/encounters/migration-candidates/prologue-boss-square-b.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e1-square-a.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e1-square-b.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e2-square-a.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e2-square-b.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e3-square-a.json`
  * `spikes/arrow-core/encounters/migration-candidates/act1-e3-square-b.json`
- Ни один production encounter file, боевое правило или порядок прохождения не затронуты.
- Создан канонический отчёт: `docs/LD-003-SQUARE-ENCOUNTER-MIGRATION.md`.

## VERIFY

1. `spikes/arrow-core`:
   - `npm run typecheck` — 0 errors (clean).
   - `npm test` — 20 test files, 249 tests passed (100%).
   - `npm run build` — compiled without warnings.
2. Проверка кандидатов шортлиста:
   - Все 8 файлов в `encounters/migration-candidates/*.json` успешно парсятся через `encounterFromJson`, хэши уровней совпадают.
   - Математически доказано `minDamageToWin = 0` для всех кандидатов при идеальной игре.
   - Добавлен автоматический тест `test/ld-003-candidates.test.ts`, подтверждающий квадратность поля и доказанную проходимость без урона для каждого кандидата.

## FOUND

1. **Естественное совпадение номеров сидов:** Кандидат Act I #3 на `square7` (Seed 25) случайно совпал по номеру сида с исходным прямоугольным энкаунтером (Seed 25), при этом в точности повторил логику срыва каста на 3-м ходу.
2. **Дивергенция Rotate на квадратах:** В квадратных полях 8x8 (Seed 388) и 7x7 (Seed 98) асимметрия расхода стрел в фазе 1 создаёт идеальную игровую дивергенцию Rotate: поворот CW даёт 0 урона, а поворот CCW наказывает игрока потерей 2 HP из-за истощения направления, полностью воспроизводя драму seed 1571.

