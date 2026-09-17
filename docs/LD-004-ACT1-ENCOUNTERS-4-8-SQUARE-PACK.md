# LD-004: Act I Encounters 4–8 Square Pack (Design & Playtest Pack)

STATUS: DESIGN SHORTLIST / PLAYTEST PACK  
ROLE: Level / Encounter Designer  
DATE: 2026-09-17  
BASE: `design/LD-003-square-encounter-migration` (`72437c36bc4ae308edb75669b9dcbe47464e9db1`)  
TARGET LOCATION: `spikes/arrow-core/encounters/act1-square-pack/`

---

## 1. Executive Summary & Design Principles

В рамках задачи **LD-004** спроектирован второй пакет квадратных боевых энкаунтеров первого акта: условные номера **#4–#8**.

Данный пакет является **дизайн- и плейтест-паком (Design / Playtest Pack)**. Нумерация encounters остаётся условной. Ни одно проектное решение не объявляется автоматически принятым: финальный выбор, баланс таймеров и утверждение семян остаются исключительной прерогативой пользователя. Ни один production-файл не затронут.

### Ключевые принципы пакета:
1. **Square-First Scale Progression:**
   - **Early (#4):** `square6` (6x6) и `square7` (7x7) — компактные поля для изолированного ввода новой механики без визуальной перегрузки.
   - **Early/Normal (#5):** `square7` (7x7) и `square8` (8x8) — простор для выбора дебюта (Choice of Opening).
   - **Normal (#6):** `square8` (8x8) — стандартный боевой размер Акта I для дуэли с кастером под обстрелом камнетёса.
   - **Normal (#7):** `square8` (8x8) и `square9` (9x9) — плотный бой на три фронта в условиях дефицита боезапаса.
   - **Pre-Boss Crucible (#8):** `square9` (9x9) и `square10` (10x10) — масштабная многослойная осада, готовящая игрока к встрече с боссом первого акта (Goblin King).
   *(Все пять энкаунтеров используют разные, органически нарастающие размеры полей).*

2. **Строгое использование существующих боевых механик:**
   - Basic timed enemy (`ATTACK IN N`);
   - Multi-enemy (одновременные враги с независимыми таймерами и дедлайнами);
   - `CAST -> INTERRUPT -> normal attack` (кастер с летальным сбиваемым заклинанием);
   - Stone Throw / Pin (`EnemyAbility`: бросок камня, прикаливающий свободную стрелку на 2 хода без софтлока);
   - Shared Rotate run pool (тактический рычаг спасения и смены приоритета);
   - Directional pressure (пространственная зависимость секторов арены).
   *Никаких новых выдуманных способностей врагов не вводилось.*

3. **Уникальная Puzzle Identity каждого энкаунтера (LD-002 Patterns):**
   - **#4:** **BOTTLENECK** (Замковый камень / Горлышко)
   - **#5:** **CHOICE OF OPENING** (Веер дебютов / Свободный старт)
   - **#6:** **DELAYED PAYOFF** (Отложенная награда / Глубокий арсенал)
   - **#7:** **DIRECTION SCARCITY / FALSE TEMPTATION** (Дефицит боезапаса и приманка жадности)
   - **#8:** **LAYERED GATES / RECOVERY BOARD** (Слоистые врата цитадели и прощающая топология)

4. **Правило честности (Fairness & Clean Path):**
   - Каждый энкаунтер математически доказан солвером: **minDamage = 0 при Rotate x0** (идеальный игрок без единого артефакта и без траты зарядов Rotate проходит бой всухую).
   - Любой получаемый урон — результат осознанной ошибки игрока (жадный дебют, неверный приоритет, пропуск срыва каста).
   - Заряды Rotate служат тактическим спасением или ускорителем темпа, но не являются костылем против нечестного дизайна.

---

## 2. Encounter #4: "The Stonethrower" (Камнетёс)

### Дидактическая цель
Впервые вводит механику **Stone Throw / Pin** в чистом, изолированном виде. Игрок видит одного врага, который не только готовит обычную атаку (`ATTACK IN 4`), но и каждые 3 хода швыряет валун (`THROW IN 3`), прикаливая одну свободную стрелку на 2 хода. Учит игрока не паниковать при виде заблокированной стрелки, понимать временный характер прикола и находить замковый камень (**Bottleneck**), освобождающий другие стрелы нужного сектора.

### Состав врагов
- **Thrower W (Запад):** HP 3, `attackTimer`: `interval: 4`, `damage: 2`; `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' }`.

---

### Кандидаты (Encounter #4)

#### Candidate A (Рекомендован для Playtest A): `square6` Seed 78
- **Размер:** 6x6 (36 клеток, 10 стрел). Hash: `7ec1bdaf`.
- **Распределение N/E/S/W:** 1 / 1 / 5 / 3.
- **Свободны на старте N/E/S/W:** 1 / 1 / 1 / **0** (на старте West полностью заперт!).
- **Топология и паттерн:** **BOTTLENECK**. Стрела `#7(S)` — критический замковый камень.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 4. Nodes: 420.
- **Intended Clean Path (4 хода, 0 dmg):**
  * *Ход 1:* `#7(S)` — выстрел вхолостую на юг! Этот выстрел выбивает замок и освобождает сразу две стрелы West: `#6(W)` и `#8(W)`!
  * *Ход 2:* `#6(W)` — первое попадание по Thrower (HP 3 $\to$ 2).
  * *Ход 3:* Наступает 3-й ход — Thrower бросает камень! По правилу `targetPolicy: 'free-arrow'` камень падает на стрелку `#0(N)`. Боезапас West (`#8, #9`) остаётся нетронутым! Игрок жмёт `#8(W)` (HP 2 $\to$ 1).
  * *Ход 4:* `#9(W)` добивает Thrower ровно на ходу 4 до его атаки! Победа без урона.
- **Plausible Mistake & Recovery:**
  * Если игрок не замечает замка `#7(S)` и кликает поверхностные стрелы `#0(N)` или `#1(E)`, он тратит темп. Thrower атакует на ходу 4 и наносит **2 урона**.
  * Восстановление возможно через трату 1 заряда Rotate: поворот CW превращает 5 стрел South в West, спасая дедлайн.
- **Visual Value:** **HIGH**. Компактный 6x6, выразительный каменный узел в нижней части поля.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e4-square-a.json`.

#### Candidate B (Рекомендован для Playtest B): `square7` Seed 11
- **Размер:** 7x7 (49 клеток, 12 стрел). Hash: `69602024`.
- **Распределение N/E/S/W:** 4 / 5 / 0 / 3.
- **Свободны на старте N/E/S/W:** 2 / 1 / 0 / 1.
- **Топология и паттерн:** **BOTTLENECK**. На старте свободна ровно 1 стрела West (`#0`).
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 4. Nodes: 860.
- **Intended Clean Path (4 хода, 0 dmg):**
  * *Ход 1:* `#0(W)` — удар по Thrower (HP 3 $\to$ 2).
  * *Ход 2:* `#1(N)` — замковый ход, отпирающий глубокие стрелы `#4(W)` и `#6(W)`.
  * *Ход 3:* Thrower бросает камень на открытую стрелку `#3(E)`. Игрок без помех жмёт `#4(W)` (HP 2 $\to$ 1).
  * *Ход 4:* `#6(W)` уничтожает врага на ходу 4. Итог: 0 урона.
- **Plausible Mistake:** Клик по соблазнительным стрелам East `#3, #2` оставляет игрока без второго выстрела West, приводя к атаке Thrower (**2 урона**).
- **Visual Value:** **HIGH**. 7x7 даёт идеальную читаемость на квадратном подиуме алтаря.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e4-square-b.json`.

#### Candidate C: `square7` Seed 24
- **Размер:** 7x7 (49 клеток, 11 стрел). Hash: `69bc4190`.
- **Распределение N/E/S/W:** 3 / 2 / 1 / 5.
- **Свободны на старте N/E/S/W:** 2 / 1 / 1 / 1.
- **Топология:** Замок через North `#0(N) -> #8(W) -> #9(W) -> #10(W)`. На 3-м ходу камень прикаливает `#1(N)`. 4 хода, 0 dmg.
- **Visual Value:** **MEDIUM-HIGH**.

---

## 3. Encounter #5: "Pincer Quarry" (Клещи каменоломни)

### Дидактическая цель
Объединяет давление ближнего боя с фланга (быстрый Grunt) и артиллерийскую помеху (Rock Thrower). Учит игрока анализировать дебютные возможности (**Choice of Opening**) и выбирать правильную ветку атаки: нейтрализовать смертоносного спринтера до его удара на 3-м ходу, игнорируя провокационные стрелы в сторону медленного камнетёса.

### Состав врагов
- **Grunt E (Восток):** HP 2, `attackTimer`: `interval: 3`, `damage: 2` (Срочная угроза ближнего боя).
- **Thrower N (Север):** HP 2, `attackTimer`: `interval: 5`, `damage: 2`; `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' }`.

---

### Кандидаты (Encounter #5)

#### Candidate A (Рекомендован для Playtest A): `square7` Seed 20
- **Размер:** 7x7 (49 клеток, 10 стрел). Hash: `a8292a5e`.
- **Распределение N/E/S/W:** 3 / 3 / 0 / 4.
- **Свободны на старте N/E/S/W:** 1 / 1 / 0 / **3** (всего 5 свободных стрел в 3 направлениях!).
- **Топология и паттерн:** **CHOICE OF OPENING**. Огромный веер стартовых ходов.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 5.
- **Intended Clean Path (5 ходов, 0 dmg):**
  * *Ход 1:* `#2(N)` — наносит 1 урон Thrower N и отпирает вторую стрелу East `#9(E)`.
  * *Ход 2:* `#3(E)` — урон по Grunt E (HP 2 $\to$ 1).
  * *Ход 3:* `#9(E)` — уничтожает Grunt E ровно на ходу 3 секунда в секунду до его удара! Thrower бросает камень на `#0(W)`.
  * *Ход 4:* `#4(W)` — холостой puzzle-ход, вскрывающий финишную стрелу `#7(N)`.
  * *Ход 5:* `#7(N)` — добивает Thrower N на ходу 5 ровно перед его атакой. Победа, 0 урона!
- **Plausible Mistake:**
  * Соблазн стартовать с кучного кластера West (3 свободные стрелы!). Если игрок кликает West — Grunt E неминуемо бьёт на ходу 3 (**2 урона**).
  * Спасение: трата 1 заряда Rotate поворачивает обильный West на East, ликвидируя Grunt E.
- **Visual Value:** **HIGH**. Чистая крестообразная геометрия.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e5-square-a.json`.

#### Candidate B (Рекомендован для Playtest B): `square8` Seed 86
- **Размер:** 8x8 (64 клетки, 12 стрел). Hash: `fd25c093`.
- **Распределение N/E/S/W:** 3 / 3 / 2 / 4.
- **Свободны на старте N/E/S/W:** **1 / 1 / 1 / 2** (все 4 направления открыты на старте!).
- **Топология и паттерн:** **CHOICE OF OPENING**. Абсолютная тактическая агентность игрока в дебюте.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 4. Nodes: 1,120.
- **Intended Clean Path (4 хода, 0 dmg):**
  * *Ход 1:* `#2(N)` — удар по Thrower (HP 2 $\to$ 1), отпирает `#5(E)`.
  * *Ход 2:* `#1(E)` — удар по Grunt E (HP 2 $\to$ 1).
  * *Ход 3:* `#5(E)` — убийство Grunt E на ходу 3. Thrower бросает камень на `#0(W)`.
  * *Ход 4:* `#4(N)` — добивание Thrower N на ходу 4. Итог: 0 урона в 4 хода!
- **Visual Value:** **HIGH**. 8x8 поле с широким охватом всех четырёх подиумов.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e5-square-b.json`.

#### Candidate C: `square7` Seed 30
- **Размер:** 7x7 (49 клеток, 13 стрел). Hash: `e77f03ec`.
- **Распределение N/E/S/W:** 6 / 3 / 3 / 1.
- **Свободны на старте:** 3 / 1 / 1 / 0 (5 стрел). Паттерн: False Temptation внутри Choice of Opening (3 открытые стрелы North манят атаковать камнетёса, обрекая игрока на удар Grunt E). Чистый путь: `#3(N) -> #2(E) -> #1(E) -> #4(N)` (4 хода, 0 dmg).
- **Visual Value:** **MEDIUM-HIGH**.

---

## 4. Encounter #6: "Arcane Siege" (Осада чародея)

### Дидактическая цель
Проверяет способность игрока работать под предельным синхронным давлением дедлайна и порчи доски. На севере стоит смертоносный Caster (`CAST IN 3`, урон 4, interruptible $\to$ normal IN 3), а на западе — артиллерист Thrower (`THROW IN 3`, pin 2, attack IN 5). Игрок обязан сорвать каст секунда в секунду на 3-м ходу, одновременно учитывая бросок камня. Паттерн **Delayed Payoff**: стрелы North не лежат на поверхности, к ним нужно пробиться за 2 предварительных хода.

### Состав врагов
- **Caster N (Север):** HP 3, `attackTimer`: `interval: 3`, `damage: 4`, `kind: 'cast'`, `interruptible: true`, `interruptedAttack: { interval: 3, damage: 2, kind: 'normal' }`.
- **Thrower W (Запад):** HP 2, `attackTimer`: `interval: 5`, `damage: 2`; `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' }`.

---

### Кандидаты (Encounter #6)

#### Candidate A (Рекомендован для Playtest A): `square8` Seed 1
- **Размер:** 8x8 (64 клетки, 15 стрел). Hash: `90254593`.
- **Распределение N/E/S/W:** 6 / 6 / 0 / 3.
- **Свободны на старте N/E/S/W:** 3 / 2 / 0 / 1.
- **Топология и паттерн:** **DELAYED PAYOFF**. Ключевая сбивающая стрела North заперта за стрелами West.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 5. Nodes: 1,840.
- **Intended Clean Path (5 ходов, 0 dmg):**
  * *Ход 1:* `#0(W)` — удар по Thrower W (HP 2 $\to$ 1), отпирает `#1(W)`.
  * *Ход 2:* `#1(W)` — уничтожает Thrower W на ходу 2! Враг погибает до своего первого броска камня! Этот же выстрел открывает стрелу `#2(N)`!
  * *Ход 3:* `#2(N)` — **Срыв кастера секунда в секунду!** Заклинание Caster сбито ровно на ходу 3, таймер переключается в normal `ATTACK IN 3` (урон 2).
  * *Ход 4:* `#3(N)` — Caster HP 2 $\to$ 1.
  * *Ход 5:* `#4(N)` — добивание Caster до его обычной атаки. Безупречная чистая победа за 5 ходов, 0 урона!
- **Plausible Mistake:**
  * Если игрок не видит цепочки через West и начинает кликать стрелы East, он физически не успевает добраться до North к 3-му ходу. Caster кастует заклинание и сносит фатальные **4 HP**.
- **Visual Value:** **HIGH**. Мощные продольные лучи по краям арены 8x8.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e6-square-a.json`.

#### Candidate B (Рекомендован для Playtest B): `square8` Seed 21
- **Размер:** 8x8 (64 клетки, 14 стрел). Hash: `a572577e`.
- **Распределение N/E/S/W:** 9 / 1 / 0 / 4.
- **Свободны на старте N/E/S/W:** 2 / 1 / 0 / 1.
- **Топология и паттерн:** **DELAYED PAYOFF**.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 5.
- **Intended Clean Path (5 ходов, 0 dmg):**
  * Последовательность аналогична шедевру Seed 1: `#0(W) -> #1(W) -> #2(N) -> #3(N) -> #4(N)`.
  * Срыв каста происходит ровно на 3-м шаге. Убийство Thrower на 2-м шаге полностью предотвращает Stone Throw.
- **Visual Value:** **HIGH**. 9 стрел North формируют массивную северную батарею, идеально контрастирующую с точным ударом на западе.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e6-square-b.json`.

#### Candidate C: `square8` Seed 46
- **Размер:** 8x8 (64 клетки, 17 стрел). Hash: `2d7a1da4`.
- **Распределение N/E/S/W:** 4 / 5 / 2 / 6.
- **Свободны на старте:** 0 / 1 / 1 / 2.
- **Топология:** Переплетённая структура: `#0(W) -> #1(W) -> #3(N)(интеррапт) -> #2(W) -> #4(N) -> #7(N)`. 6 ходов, 0 dmg.
- **Visual Value:** **MEDIUM-HIGH**.

---

## 5. Encounter #7: "The Crossfire Triad" (Трёхсторонний перекрёсток)

### Дидактическая цель
Эскалация многоцелевого боя: игрок впервые сталкивается с **тремя независимыми угрозами** на разных сторонах арены. Паттерн **Direction Scarcity** (дефицит направления): на самом опасном фланге (West) запас стрел строго ограничен (ровно 3 стрелы), а быстрый враг требует немедленного уничтожения. Учит строгой триажной дисциплине: ликвидировать Fast Grunt до хода 3, затем Heavy Grunt до хода 5, затем Thrower до хода 7. Любая ошибка в порядке действий приводит к неотвратимому урону.

### Состав врагов
- **Fast Grunt W (Запад):** HP 2, `attackTimer`: `interval: 3`, `damage: 2` (Срочный фланкер).
- **Heavy Grunt E (Восток):** HP 2, `attackTimer`: `interval: 5`, `damage: 2` (Тяжёлый пехотинец).
- **Thrower S (Юг):** HP 2, `attackTimer`: `interval: 7`, `damage: 2`; `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' }` (Артиллерия).

---

### Кандидаты (Encounter #7)

#### Candidate A (Рекомендован для Playtest A): `square8` Seed 12
- **Размер:** 8x8 (64 клетки, 13 стрел). Hash: `46cb6a1c`.
- **Распределение N/E/S/W:** 1 / 5 / 4 / **3** (дефицит West: ровно 3 стрелы на всё поле!).
- **Свободны на старте N/E/S/W:** 0 / 2 / 2 / **1** (свободна ровно 1 стрела West `#0`).
- **Топология и паттерн:** **DIRECTION SCARCITY / FALSE TEMPTATION**.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 7. Nodes: 3,450.
- **Intended Clean Path (7 ходов, 0 dmg):**
  * *Ход 1:* `#0(W)` — первый удар по Fast W (HP 2 $\to$ 1), отпирает `#1(W)`.
  * *Ход 2:* `#1(W)` — Fast W уничтожен ровно на ходу 2 до своего удара!
  * *Ход 3:* На 3-м ходу Thrower S бросает камень: приколота стрелка `#3(E)`. Игрок делает тактический отпирающий ход `#2(N)`, который освобождает `#12(E)`.
  * *Ход 4:* `#12(E)` — удар по Heavy E (HP 2 $\to$ 1).
  * *Ход 5:* `#11(E)` — уничтожает Heavy E ровно на ходу 5 до его атаки!
  * *Ходы 6–7:* `#6(S) -> #7(S)` — добивание Thrower S до хода 7. Чистая победа на трёх фронтах, 0 урона!
- **Plausible Mistake (False Temptation):**
  * На старте открыты 2 стрелы East (`#3, #5`) и 2 стрелы South (`#6, #10`). Если игрок соблазняется открытыми целями и стреляет в East или South на первых ходах, Fast W гарантированно наносит **2 урона** на ходу 3.
  * Роль Rotate: Поворот CW переводит стрелы South в West, спасая дедлайн при ошибочном старте.
- **Visual Value:** **HIGH**. Гармоничная трёхсторонняя композиция на квадратной плите.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e7-square-a.json`.

#### Candidate B (Рекомендован для Playtest B): `square9` Seed 28
- **Размер:** 9x9 (81 клетка, 12 стрел). Hash: `fe829cab`.
- **Распределение N/E/S/W:** 0 / 5 / 4 / **3** (дефицит West: ровно 3 стрелы, North отсутствует).
- **Свободны на старте N/E/S/W:** 0 / 1 / 1 / **0** (на старте West полностью заперт!).
- **Топология и паттерн:** **DIRECTION SCARCITY**. Замок West открывается через South.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 7.
- **Intended Clean Path (7 ходов, 0 dmg):**
  * *Ход 1:* `#9(S)` — выстрел на юг наносит урон Thrower S и мгновенно отпирает стрелы `#7(W)` и `#10(W)`!
  * *Ходы 2–3:* `#7(W) -> #10(W)` — ликвидация Fast W на ходу 3 секунда в секунду!
  * *Ходы 4–6:* `#8(E) -> #1(E) -> #3(E)` — ликвидация Heavy E.
  * *Ход 7:* `#6(S)` — добивание Thrower S. Итог: 0 урона.
- **Visual Value:** **HIGH**. Изящное 9x9 поле без визуального шума.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e7-square-b.json`.

#### Candidate C: `square8` Seed 78
- **Размер:** 8x8 (64 клетки, 12 стрел). Hash: `36cd30cb`.
- **Распределение N/E/S/W:** 1 / 3 / 4 / 4.
- **Специфика:** False Temptation на фланге East (`#0, #7`). Чистый путь: `#0(E) -> #10(W) -> #11(W) -> #5(S) -> #7(E) -> #3(N) -> #6(S)` (7 ходов, 0 dmg).
- **Visual Value:** **MEDIUM-HIGH**.

---

## 6. Encounter #8: "The Vanguard Bastion" (Бастион авангарда)

### Дидактическая цель
**Генеральная репетиция перед боссом Акта I (Goblin King).** Полномасштабная цитадель на поле `9x9` / `10x10`. Паттерн **Layered Gates** (5–7 глубоких концентрических слоёв) в сочетании с **Recovery Board** (высокий коэффициент ветвления $\ge 85\%$, позволяющий оправиться от неидеального хода ценой темпа, но без мгновенного фатального софтлока). Враги координируют свои усилия: элитный вождь Chieftain держит центр (`ATTACK IN 5`, урон 2), Caster готовит заклинание (`CAST IN 3`, урон 4), а осадный камнетёс Siege Thrower сковывает стрелы.
*Условие победы:* уничтожение двух главных целей (Chieftain N и Caster E) даёт немедленную победу (Immediate Win).

### Состав врагов
- **Chieftain N (Север):** HP 3, `attackTimer`: `interval: 5`, `damage: 2`, `mandatory: true` (Тяжёлый якорь).
- **Caster E (Восток):** HP 3, `attackTimer`: `interval: 3`, `damage: 4`, `kind: 'cast'`, `interruptible: true`, `interruptedAttack: { interval: 4, damage: 2, kind: 'normal' }`, `mandatory: true` (Летальная угроза).
- **Siege Thrower W (Запад):** HP 2, `attackTimer`: `interval: 6`, `damage: 2`; `ability`: `{ id: 'stone-throw', interval: 3, pinDuration: 2, targetPolicy: 'free-arrow' }`, `mandatory: false` (Осадная помеха).

---

### Кандидаты (Encounter #8)

#### Candidate A (Рекомендован для Playtest A): `square9` Seed 12
- **Размер:** 9x9 (81 клетка, 20 стрел). Hash: `96b11480`.
- **Распределение N/E/S/W:** 5 / 5 / 6 / 4.
- **Свободны на старте N/E/S/W:** 1 / 2 / 4 / 1.
- **Топология и паттерн:** **LAYERED GATES / RECOVERY BOARD**. 5 строгих концентрических слоёв, коэффициент ветвления **95%** (19 из 20 шагов дают осмысленный выбор!).
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 6. Nodes: 4,120.
- **Intended Clean Path (6 ходов, 0 dmg):**
  * *Ход 1:* `#0(N)` — урон по Chieftain (HP 3 $\to$ 2), вскрывает стрелу `#4(E)`.
  * *Ход 2:* `#4(E)` — **Превентивный срыв каста Caster на 2-м ходу!** Каст сорван с запасом в 1 ход, таймер переключается на normal `ATTACK IN 4`.
  * *Ход 3:* `#3(E)` — Caster HP 2 $\to$ 1. На 3-м ходу Thrower W швыряет камень на `#2(E)` (прикол на 2 хода).
  * *Ход 4:* `#6(N)` — Chieftain HP 2 $\to$ 1.
  * *Ход 5:* `#7(N)` — **Chieftain уничтожен ровно на ходу 5** до своего удара! На этом же ходу прикол с `#2(E)` спадает!
  * *Ход 6:* `#2(E)` — освобождённая от камня стрела добивает Caster ровно на ходу 6 до его обычной атаки!
  * **Победа:** оба обязательных босса мертвы $\to$ немедленный триумф без урона!
- **Роль Rotate:** Огромная. Использование 1 Rotate CW переводит 6 стрел South в West или East, мгновенно стирая любого из боссов при ошибке в тайминге. Идеально подготавливает мышление игрока к фазам Goblin King.
- **Visual Value:** **OUTSTANDING**. 20 стрел образуют монументальную каменную крепость на подиуме алтаря.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e8-square-a.json`.

#### Candidate B (Рекомендован для Playtest B): `square9` Seed 40
- **Размер:** 9x9 (81 клетка, 18 стрел). Hash: `f1ba84d3`.
- **Распределение N/E/S/W:** 5 / 4 / 2 / 7.
- **Свободны на старте N/E/S/W:** 3 / 1 / 0 / 1.
- **Топология и паттерн:** **LAYERED GATES**. 5 слоёв зачистки, коэффициент ветвления 89%.
- **Метрики солвера:** Solvable = YES (Rotate x0). **minDamage = 0**. Taps to win: 6.
- **Intended Clean Path (6 ходов, 0 dmg):**
  * *Ходы 1–2:* `#0(N) -> #3(N)` — осада северного вождя.
  * *Ход 3:* `#17(E)` — **Срыв кастера секунда в секунду на 3-м ходу!**
  * *Ход 4:* `#4(N)` — ликвидация Chieftain на ходу 4 до атаки.
  * *Ходы 5–6:* `#2(E) -> #16(E)` — ликвидация Caster на ходу 6 до атаки. Победа, 0 урона!
- **Visual Value:** **HIGH**. 7 стрел West создают плотный защитный вал.
- **Playtest JSON:** `spikes/arrow-core/encounters/act1-square-pack/act1-e8-square-b.json`.

#### Candidate C: `square10` Seed 23
- **Размер:** 10x10 (100 клеток, 22 стрелы). Hash: `bb38a554`.
- **Распределение N/E/S/W:** 4 / 6 / 5 / 7.
- **Специфика:** Грандиозная арена 10x10, **7 глубоких слоёв осады**, ветвление 91%. Чистый путь: `#3(N) -> #2(E) -> #1(E) -> #4(N) -> #6(N) -> #21(E)` (6 ходов, 0 dmg).
- **Visual Value:** **EPIC**. Максимальный масштаб регулярного боя.

---

## 7. Сводная таблица Design Pack (Encounters 4–8)

| № | Название | Размер | Seed / Hash | Враги | Паттерн (LD-002) | Clean Path (0 Rot) | Роль Rotate (1 заряд) |
|---|---|---|---|---|---|---|---|
| **#4** | The Stonethrower | `square6`<br>`square7` | **78** (`7ec1bdaf`)<br>**11** (`69602024`) | Thrower W (HP 3, IN 4, THROW 3 pin 2) | **BOTTLENECK** | 4 taps (0 dmg) | South $\to$ West обходит замок |
| **#5** | Pincer Quarry | `square7`<br>`square8` | **20** (`a8292a5e`)<br>**86** (`fd25c093`) | Grunt E (HP 2, IN 3)<br>Thrower N (HP 2, IN 5, THROW 3) | **CHOICE OF OPENING** | 4–5 taps (0 dmg) | Спасает дедлайн Grunt E при жадном дебюте |
| **#6** | Arcane Siege | `square8` | **1** (`90254593`)<br>**21** (`a572577e`) | Caster N (HP 3, CAST 3 dmg 4)<br>Thrower W (HP 2, IN 5, THROW 3) | **DELAYED PAYOFF** | 5 taps (0 dmg) | Экстренный срыв каста с соседнего фланга |
| **#7** | Crossfire Triad | `square8`<br>`square9` | **12** (`46cb6a1c`)<br>**28** (`fe829cab`) | Fast W (HP 2, IN 3)<br>Heavy E (HP 2, IN 5)<br>Thrower S (HP 2, IN 7, THROW 3) | **DIRECTION SCARCITY** | 7 taps (0 dmg) | Конвертирует избыточный сектор в дефицитный West |
| **#8** | Vanguard Bastion | `square9`<br>`square10` | **12** (`96b11480`)<br>**40** (`f1ba84d3`) | Chieftain N (HP 3, IN 5)<br>Caster E (HP 3, CAST 3 dmg 4)<br>Thrower W (HP 2, IN 6, THROW 3) | **LAYERED GATES** | 6 taps (0 dmg) | Репетиция босса: перестройка фронта цитадели |

---

## 8. Дидактическая последовательность (Curriculum Arc)

Короткая каноническая формула развития игрока на отрезке #4–#8:

- **#4 teaches** Stone Throw / Pin mechanics in isolation (reading pinned arrows without panic via bottleneck navigation).
- **#5 combines** flank melee pressure with artillery disruption (pincer attack triage via choice of opening).
- **#6 pressures** deadline execution under active board disruption (Caster CAST 3 deadline under artillery pin via delayed payoff).
- **#7 escalates** multi-front directional scarcity and threat triage (asymmetrical 3-way crossfire requiring strict ammo discipline).
- **#8 prepares player for Act I boss** with deep layered siege & attrition management (concentric fortifications, multi-target coordination, high-agency recovery).

---

## 9. Верификация и Playtest Artifacts

### Созданные Playtest JSON файлы:
Все 10 файлов созданы в изолированном каталоге `spikes/arrow-core/encounters/act1-square-pack/`:
- `act1-e4-square-a.json` (square6 seed 78)
- `act1-e4-square-b.json` (square7 seed 11)
- `act1-e5-square-a.json` (square7 seed 20)
- `act1-e5-square-b.json` (square8 seed 86)
- `act1-e6-square-a.json` (square8 seed 1)
- `act1-e6-square-b.json` (square8 seed 21)
- `act1-e7-square-a.json` (square8 seed 12)
- `act1-e7-square-b.json` (square9 seed 28)
- `act1-e8-square-a.json` (square9 seed 12)
- `act1-e8-square-b.json` (square9 seed 40)

### Результаты проверок:
1. **Automated Test Suite:**  
   Добавлен специализированный набор тестов `spikes/arrow-core/test/ld-004-candidates.test.ts`.  
   Итог `npm test`: **21 test files passed, 259 tests passed (100%)**.
2. **Typecheck & Build:**  
   `npm run typecheck` — 0 errors.  
   `npm run build` — 0 errors.
3. **Solver Verification:**  
   Все 10 кандидатов математически доказаны: `minDamage = 0` при Rotate x0.

Ни один production-файл игры не изменён. Решение о включении кандидатов в основной run остаётся за пользователем.
