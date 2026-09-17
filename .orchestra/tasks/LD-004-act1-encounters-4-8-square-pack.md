# TASK: LD-004 — Act I Encounters 4–8 Square Pack

STATUS: DONE
TYPE: DESIGN
SIZE: L
AGENT: Gemini 3.8 Flash (Level / Encounter Designer)
BASE_BRANCH: design/LD-003-square-encounter-migration
BRANCH: design/LD-004-act1-encounters-4-8-square-pack
START_SHA: 72437c36bc4ae308edb75669b9dcbe47464e9db1

## Goal

Спроектировать следующие 5 квадратных encounters Act I: условные #4–#8. Это DESIGN / PLAYTEST PACK. Не менять production content, ничего автоматически не заменять. Использовать square-first прогрессию размеров (`6x6–7x7` early, `7x7–9x9` normal, `8x8–10x10` dense pre-boss). Обеспечить уникальную puzzle identity для каждого энкаунтера через паттерны LD-002, использовать только существующие боевые механики, гарантировать проходимость при Rotate x0 (0 unavoidable damage), найти минимум по 3 кандидата на каждый энкаунтер и выделить по 2 кандидата для непосредственного ручного плейтеста (с генерацией изолированных playtest JSON).

## RESULT

1. **Спроектирован полный 5-энкаунтерный пакет Act I Encounters #4–#8** на органически нарастающих квадратных полях с уникальными дидактическими целями и puzzle identity (паттерны LD-002):
   - **Encounter #4: "The Stonethrower"** (Размеры: `square6`, `square7`).  
     *Паттерн:* **BOTTLENECK**.  
     *Дидактика:* Изолированное введение механики Stone Throw / Pin. Игрок учится не паниковать при виде прикола, а находить замковый камень, вскрывающий альтернативные пути.  
     *Враги:* Thrower W (HP 3, `attackTimer`: `interval: 4`, `damage: 2`, `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2 }`).
   - **Encounter #5: "Pincer Quarry"** (Размеры: `square7`, `square8`).  
     *Паттерн:* **CHOICE OF OPENING**.  
     *Дидактика:* Координация между быстрым рукопашным фланкером и артиллерийской помехой. Анализ 4–5 свободных дебютных стрел по 3–4 направлениям, выбор правильного вектора атаки для устранения спринтера к 3-му ходу.  
     *Враги:* Grunt E (HP 2, `IN 3`, dmg 2) + Thrower N (HP 2, `IN 5`, dmg 2, `THROW IN 3`, pin 2).
   - **Encounter #6: "Arcane Siege"** (Размер: `square8`).  
     *Паттерн:* **DELAYED PAYOFF**.  
     *Дидактика:* Работа под предельным синхронным дедлайном срыва каста (`CAST IN 3`, урон 4) и осадного камня (`THROW IN 3`). Сбивающая стрела North заглублена на 2 хода, требуя выверенной подготовки.  
     *Враги:* Caster N (HP 3, `CAST IN 3` dmg 4 interruptible $\to$ normal IN 3 dmg 2) + Thrower W (HP 2, `IN 5`, dmg 2, `THROW IN 3`, pin 2).
   - **Encounter #7: "The Crossfire Triad"** (Размеры: `square8`, `square9`).  
     *Паттерн:* **DIRECTION SCARCITY / FALSE TEMPTATION**.  
     *Дидактика:* Эскалация до 3 одновременных угроз. Строгий дефицит патронов на опасном фланге West (ровно 3 стрелы), триаж приоритетов: West (ход 2–3) $\to$ East (ход 4–5) $\to$ South (ход 6–7).  
     *Враги:* Fast Grunt W (HP 2, `IN 3`, dmg 2) + Heavy Grunt E (HP 2, `IN 5`, dmg 2) + Thrower S (HP 2, `IN 7`, dmg 2, `THROW IN 3`, pin 2).
   - **Encounter #8: "The Vanguard Bastion"** (Размеры: `square9`, `square10`).  
     *Паттерн:* **LAYERED GATES / RECOVERY BOARD**.  
     *Дидактика:* Генеральная репетиция перед боссом Акта I (Goblin King). 5–7 концентрических слоёв осады цитадели, 89–95% коэффициент ветвления. Условие победы: ликвидация главных боссов (Chieftain N и Caster E) при осадном прессинге Thrower W.  
     *Враги:* Chieftain N (HP 3, `IN 5`, dmg 2, mandatory) + Caster E (HP 3, `CAST IN 3` dmg 4, mandatory) + Siege Thrower W (HP 2, `IN 6`, dmg 2, `THROW IN 3`, pin 2, optional support).

2. **Отобрано по 3 проверенных кандидата на каждый энкаунтер (всего 15), из них выделены по 2 кандидата для прямого сравнительного ручного плейтеста (10 кандидатов):**
   - **#4:** Cand A (`square6` Seed 78, hash `7ec1bdaf`) & Cand B (`square7` Seed 11, hash `69602024`)
   - **#5:** Cand A (`square7` Seed 20, hash `a8292a5e`) & Cand B (`square8` Seed 86, hash `fd25c093`)
   - **#6:** Cand A (`square8` Seed 1, hash `90254593`) & Cand B (`square8` Seed 21, hash `a572577e`)
   - **#7:** Cand A (`square8` Seed 12, hash `46cb6a1c`) & Cand B (`square9` Seed 28, hash `fe829cab`)
   - **#8:** Cand A (`square9` Seed 12, hash `96b11480`) & Cand B (`square9` Seed 40, hash `f1ba84d3`)

3. **Созданы 10 изолированных playtest JSON файлов:**
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e4-square-a.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e4-square-b.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e5-square-a.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e5-square-b.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e6-square-a.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e6-square-b.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e7-square-a.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e7-square-b.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e8-square-a.json`
   - `spikes/arrow-core/encounters/act1-square-pack/act1-e8-square-b.json`

4. **Зафиксирован канонический отчёт:**  
   `docs/LD-004-ACT1-ENCOUNTERS-4-8-SQUARE-PACK.md` с подробным разбором каждого кандидата, intended clean path, анализом ошибок, recovery и ролью Rotate.

5. **Каноническая формула последовательности:**
   - `#4 teaches` Stone Throw / Pin mechanics in isolation (reading pinned arrows without panic via bottleneck navigation).
   - `#5 combines` flank melee pressure with artillery disruption (pincer attack triage via choice of opening).
   - `#6 pressures` deadline execution under active board disruption (Caster CAST 3 deadline under artillery pin via delayed payoff).
   - `#7 escalates` multi-front directional scarcity and threat triage (asymmetrical 3-way crossfire requiring strict ammo discipline).
   - `#8 prepares player for Act I boss` with deep layered siege & attrition management (concentric fortifications, multi-target coordination, high-agency recovery).

## VERIFY

1. `spikes/arrow-core`:
   - `npm run typecheck` — 0 errors (clean).
   - `npm test` — **21 test files, 259 tests passed (100%)**.
   - `npm run build` — compiled without warnings.
2. Автоматическая верификация кандидатов (`test/ld-004-candidates.test.ts`):
   - Все 10 JSON файлов успешно распарсены через `encounterFromJson`.
   - Подтверждена строгая квадратность каждого поля (`level.width === level.height`).
   - Подтверждено совпадение хэшей всех уровней (`levelHash`).
   - Математически доказано `minDamage = 0` при `Rotate x0` для всех кандидатов.

## FOUND

1. **Комбинаторная плотность 3 врагов на досках 8x8/9x9:** При наличии 3 врагов с суммарным требованием 8–9 попаданий по разным направлениям математический солвер выявил, что интервал атаки тяжёлого врага (`interval: 5`) и осадного камнетёса (`interval: 6–7`) идеально ложится в темп разбора поля без искусственного unavoidable damage, сохраняя честное окно для победы всухую.
2. **Immediate Win на элитном бое #8:** Разделение врагов на обязательных лидеров (`mandatory: true` — Chieftain и Caster) и периферийную артиллерию (`mandatory: false` — Thrower) создаёт идеальное ощущение тактического перелома: как только игроки уничтожают командную двойку, бой мгновенно завершается победой, избавляя от рутинной зачистки остатка поля.
