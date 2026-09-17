# LD-003: Square Encounter Migration Shortlist

STATUS: DESIGN SHORTLIST  
ROLE: Level / Puzzle Designer  
DATE: 2026-09-17  
BASE: `fix/FIX-021-board-plane-projection` (`edb56232beb3b46d322388c369cb598ccf9dccc1`)

---

## 1. Executive Summary & Design Principles

В соответствии с принятой политикой **Square-First** (`EXP-015`, `FIX-021`, `ART-003`), игровое поле Arrow-Roguelite проецируется непосредственно на квадратную каменную плиту алтаря Moonlit Fortress без отдельного чужеродного прямоугольного задника.

Цель данной работы — предоставить **прямые квадратные альтернативы** для 4 наших ключевых обкатанных прямоугольных энкаунтеров:
1. **Prologue Boss / Goblin Shaman** (текущий `cp-e5`, seed 1571, 8x10);
2. **Act I #1 (Two-Front Stand)** (текущий `act1-e1`, seed 22, 6x7);
3. **Act I #2 (The Cross-Lock)** (текущий `act1-e2`, seed 112, 6x7);
4. **Act I #3 (Caster Awakens)** (текущий `act1-e3`, seed 25, 6x7).

### Главное правило миграции
**Сохранять EXPERIENCE CONTRACT, а не числовую копию seed.**
Головоломка переносится не ради «похожих метрик», а ради сохранения дидактической роли, драматургии боя, ощущения дедлайна, механики ошибки и роли Rotate.

Ни один текущий production-файл не изменён и не удалён. Текущие файлы остаются каноном до момента, когда пользователь лично сыграет старый и новые варианты рядом и примет решение. Для непосредственного ручного плейтеста созданы изолированные JSON-файлы кандидатов в каталоге `spikes/arrow-core/encounters/migration-candidates/`.

---

## 2. Prologue Boss (Goblin Shaman)

### CURRENT: `cp-e5` / seed 1571 (8x10 `medium`)
- **Board:** 8x10 (16 стрел: N=3, E=5, S=3, W=5, initial free 0/2/1/1).
- **Encounter:**
  * Фаза 1: Boss на East (4 HP, `ATTACK IN 6`, dmg 1).
  * Фаза 2: Boss перемещается на North (5 HP, `CAST IN 3`, dmg 1, interruptible $\to$ normal `ATTACK IN 4`, dmg 1).
  * Rotate: выдаётся +1 заряд при переходе в Фазу 2 (`advancesTurn: false`).
- **Experience Contract:**
  * *Что замечает игрок:* Фаза 1 проходит на привычном фланге East (4 из 5 E-стрел тратятся на босса). При переходе в Фазу 2 босс взлетает на северный трон (North).
  * *Дефицит направления:* На доске всего 3 стрелы North, а у босса 5 HP. Победить без Rotate математически невозможно (максимум 3 попадания).
  * *Драматический выбор Rotate:* Поворот CW переводит 5 стрел West в North, обеспечивая чистую победу (0 dmg). Поворот CCW пытается перевести East в North, но East уже истощён Фазой 1 — игрок остаётся без патронов и получает урон!
  * *Срыв каста:* Фаза 2 открывается опасным заклинанием (`CAST IN 3`), требующим срыва попаданием до 3-го хода.
- **Почему нравился пользователю:** Реальный риск проиграть или получить урон при неверном выборе направления Rotate (CW vs CCW).
- **Слабость текущего варианта:** Прямоугольник 8x10 на квадратном колодце арены оставляет пустоты по вертикали/горизонтали при повороте 90° (габариты меняются $311 \times 389 \leftrightarrow 389 \times 311$).

---

### SQUARE CANDIDATES (Prologue Boss)

#### Candidate 1 (Recommended Shortlist A): `square8` Seed 388
- **Размер:** 8x8 (64 клетки, 16 стрел). Hash: `1b221569`.
- **Распределение N/E/S/W:** 1 / 5 / 2 / 8.
- **Свободны на старте:** 0 / 2 / 0 / 4 (Ids: 0, 9, 10, 12, 13, 15).
- **Параметры босса:** Фаза 1: East 4 HP (`ATTACK IN 6`, dmg 1). Фаза 2: North 5 HP, +1 Rotate (`CAST IN 3`, dmg 1, interruptible $\to$ normal `ATTACK IN 4`).
- **Метрики солвера:** Solvable = YES. MinDamage = 0 (clean path). Nodes: 12,410. Без Rotate: победа невозможна (на North всего 1 стрела).
- **Intended Path (Clean):**
  1. *Фаза 1:* естественная зачистка 4 стрел East (`#9(E) -> #8(E) -> #7(E) -> #15(E)`).
  2. *Фаза 2:* босс переходит на North (5 HP, CAST IN 3). На доске осталась всего 1 стрела North (`#2`).
  3. *Rotate CW (+1):* 8 стрел West поворачиваются на North!
  4. *Срыв каста и добивание:* стрелка `#0(W->N)` срывает каст на 1-м ходу фазы 2! Далее стрелы `#1, #10, #11, #12` уничтожают босса. Итог: 0 урона.
- **Mistake / Divergence Test (Wrong Rotate):**
  * Если игрок в начале фазы 2 жмёт **Rotate CCW (-1)**: на North должны были повернуться стрелы East, но 4 из 5 уже потрачены в Фазе 1! Доступных стрел North не хватает для срыва и убийства. Босс наносит **2 урона**.
  * Ошибка полностью воспроизводит драму seed 1571!
- **Роль Rotate:** Обязательный босс-механизм с гарантированным наказанием за неверное направление.
- **Visual Value:** **HIGH**. 8x8 идеально заполняет каменный подиум алтаря Moonlit Fortress. 8 стрел West образуют монолитную руническую батарею по левому флангу.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/prologue-boss-square-a.json`.

---

#### Candidate 2 (Recommended Shortlist B): `square7` Seed 98
- **Размер:** 7x7 (49 клеток, 11 стрел). Hash: `4b33394f`.
- **Распределение N/E/S/W:** 2 / 4 / 3 / 2.
- **Свободны на старте:** 0 / 2 / 1 / 1 (Ids: 2, 6, 9, 10).
- **Параметры босса:** Фаза 1: East 4 HP (IN 6, dmg 1). Фаза 2: North 5 HP, +1 Rotate (`CAST IN 3` $\to$ normal IN 4).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Nodes: 8,920.
- **Intended Path (Clean):**
  1. *Фаза 1:* зачистка ровно всех 4 стрел East (`#2(E) -> #1(E) -> #0(E) -> #10(E)`).
  2. *Фаза 2:* босс на North (5 HP). Исходных стрел North всего 2 (`#3, #4`).
  3. *Rotate CW:* поворачивает West в North. Серия `#3(N) -> #4(N) -> #9(W->N) -> #6(S) -> #5(W->N) -> #7 -> #8` добивает босса без урона.
- **Mistake / Divergence Test (Wrong Rotate):**
  * Поворот **CCW** поворачивает пустой East в North $\to$ 0 новых стрел! Каст завершается уроном, игрок теряет **2 HP**.
- **Visual Value:** **HIGH**. Масштаб 7x7 (клетка 55.5 px на 1080p, 39.5 px на 768p) идеален для раннего обучения — огромные стрелы, нулевой когнитивный шум, читаемость 10/10.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/prologue-boss-square-b.json`.

---

#### Candidate 3: `square8` Seed 489
- **Размер:** 8x8 (64 клетки, 15 стрел). Hash: `c41774c6`.
- **Распределение N/E/S/W:** 4 / 4 / 1 / 6.
- **Свободны на старте:** 1 / 2 / 0 / 1 (Ids: 0, 3, 7, 14).
- **Метрики солвера:** Solvable = YES. MinDamage = 0.
- **Специфика:** Фаза 1 полностью съедает все 4 стрелы East. Фаза 2 требует 5 попаданий на North при наличии только 4 исходных стрел.
  * Rotate CW подключает 6 стрел West $\to$ чистая победа.
  * Rotate CCW оставляет игрока без патронов $\to$ штраф **3 урона**.
- **Visual Value:** **HIGH**. Эффектная центростремительная геометрия.

---

## 3. Act I #1 (Two-Front Stand)

### CURRENT: `act1-e1` / seed 22 (6x7 `easy`)
- **Board:** 6x7 (11 стрел: N=1, E=4, S=2, W=4).
- **Enemies:**
  * `grunt_w`: West (2 HP, `ATTACK IN 3`, dmg 2, label: urgent).
  * `grunt_e`: East (3 HP, `ATTACK IN 5`, dmg 2, label: slow).
- **Experience Contract:**
  * *Чему учит:* первый бой с двумя врагами на противоположных флангах. Приоритет целей: левый моб атакует на 3-м ходу (дедлайн 2 хода), правый — на 5-м ходу.
  * *Защита от тривиальности:* левый фланг нельзя расстрелять бездумно в 2 клика со старта (на старте доступна только 1 стрела West, вторая заперта).
  * *Ложная приманка (Bait):* на правом фланге открыты лёгкие стрелы East. Если игрок поддаётся жадности и бьёт East — Grunt W успевает атаковать и сносит 2 HP.
  * *Чистое прохождение:* 5 ходов, 0 dmg без использования Rotate (`#0(W) -> #5(W) -> #6(E) -> #10(E) -> #9(E)`).

---

### SQUARE CANDIDATES (Act I #1)

#### Candidate 1 (Recommended Shortlist A): `square7` Seed 112
- **Размер:** 7x7 (49 клеток, 10 стрел). Hash: `e4b2889f`.
- **Распределение N/E/S/W:** 1 / 5 / 1 / 3.
- **Свободны на старте:** 1 / 2 / 0 / 1 (Ids: 1, 3, 6, 7).
- **Враги:** Grunt W (2 HP, `IN 3`, dmg 2) + Grunt E (3 HP, `IN 5`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0 (без Rotate). Taps to win: 5. Nodes: 1,420.
- **Intended Path (Clean):**
  * Ход 1: `#1(E)` или `#7(W)` — первый выстрел по срочной цели.
  * Ход 2: `#8(W)` — освобождённая стрелка уничтожает Grunt W ровно на ходу 2 (до таймера 3!).
  * Ходы 3–5: `#0(E) -> #6(E) -> #4(E)` — планомерное уничтожение медленного Grunt E до хода 5. Итог: 0 урона.
- **Mistake Analysis:**
  * На старте открыты 2 стрелы East (`#1, #6`). Если неопытный игрок кликает обе стрелы East подряд, Grunt W неизбежно бьёт на ходу 3, нанося **2 урона**.
- **Visual Value:** **HIGH**. 7x7 идеально ложится в колодец арены, широкие фланговые стрелы направлены строго в подиумы врагов.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e1-square-a.json`.

---

#### Candidate 2 (Recommended Shortlist B): `square6` Seed 57
- **Размер:** 6x6 (36 клеток, 11 стрел). Hash: `724d0850`.
- **Распределение N/E/S/W:** 1 / 5 / 3 / 2.
- **Свободны на старте:** 0 / 3 / 1 / 1 (Ids: 1, 4, 5, 9, 10).
- **Враги:** Grunt W (2 HP, `IN 3`, dmg 2) + Grunt E (3 HP, `IN 5`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0 (без Rotate). Taps to win: 5.
- **Intended Path (Clean):**
  * Стартовая ситуация: 3 стрелы East свободны сразу (`#1, #4, #10`), создавая мощнейший соблазн False Temptation!
  * На West свободна ровно 1 стрела (`#5(W)`).
  * Ход 1: `#5(W)` (урон по Grunt W, открывается `#6(W)`).
  * Ход 2: `#6(W)` (Grunt W мёртв на ходу 2!).
  * Ходы 3–5: зачистка Grunt E (`#1(E) -> #0(E) -> #4(E)`). Итог: 0 урона.
- **Mistake Analysis:**
  * Любая попытка кликнуть 2 раза по открытому правому флангу East приводит к пропуску таймера Grunt W и потере **2 HP**.
- **Visual Value:** **HIGH**. Точный квадрат 6x6 совпадает с базовой раскладкой каменной плиты.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e1-square-b.json`.

---

#### Candidate 3: `square7` Seed 162
- **Размер:** 7x7 (49 клеток, 11 стрел). Hash: `4983d845`.
- **Распределение N/E/S/W:** 3 / 4 / 2 / 2.
- **Свободны на старте:** 1 / 3 / 0 / 1 (Ids: 0, 1, 6, 9, 10).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Taps: 5 (`#1(W) -> #2(W) -> #6(E) -> #9(E) -> #8(E)`).
- **Visual Value:** **MEDIUM-HIGH**.

---

## 4. Act I #2 (The Cross-Lock)

### CURRENT: `act1-e2` / seed 112 (6x7 `easy`)
- **Board:** 6x7 (9 стрел: N=2, E=3, S=1, W=3).
- **Enemies:**
  * `grunt_e`: East (2 HP, `ATTACK IN 3`, dmg 2, urgent).
  * `grunt_n`: North (2 HP, `ATTACK IN 4`, dmg 2, slow).
- **Experience Contract:**
  * *Паттерн Cross-Lock:* стрелы враждующих направлений сцеплены в замок.
  * На старте игрок видит угрозу East (IN 3), но не может решить её изолированно, потому что вторая стрела East заблокирована стрелкой North!
  * Решение требует выстрела North в медленного врага, чтобы отпереть ключ к быстрому врагу East: `N -> E -> E -> N` (4 хода, 0 dmg).

---

### SQUARE CANDIDATES (Act I #2)

#### Candidate 1 (Recommended Shortlist A): `square6` Seed 41
- **Размер:** 6x6 (36 клеток, 10 стрел). Hash: `f95a5470`.
- **Распределение N/E/S/W:** 3 / 3 / 2 / 2.
- **Свободны на старте:** 1 / 0 / 1 / 0 (Ids: 1, 9).
- **Враги:** Grunt E (2 HP, `IN 3`, dmg 2) + Grunt N (2 HP, `IN 4`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0 (без Rotate). Taps to win: 4. Nodes: 860.
- **Intended Path (Clean):**
  * **Шедевральная топология:** у срочного Grunt E (дедлайн 3) на старте **0 свободных стрел**! Игрок физически не может выстрелить в East.
  * Ход 1: единственная осмысленная атака — `#1(N)` в верхнего моба!
  * Этот выстрел освобождает стрелу `#0(E)`!
  * Ход 2: выстрел `#0(E)` (Grunt E HP 2 $\to$ 1) открывает вторую стрелу `#3(E)`!
  * Ход 3: выстрел `#3(E)` уничтожает Grunt E ровно на ходу 3 до его атаки! При этом выстрел открывает стрелу `#4(N)`.
  * Ход 4: выстрел `#4(N)` добивает Grunt N до его таймера 4! Итог: 0 урона в 4 хода.
- **Паттерн:** Абсолютный эталон взаимного отпирания (`N -> E -> E -> N`).
- **Visual Value:** **HIGH**. 10 четких рунических стрел, идеальная симметрия.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e2-square-a.json`.

---

#### Candidate 2 (Recommended Shortlist B): `square7` Seed 66
- **Размер:** 7x7 (49 клеток, 12 стрел). Hash: `85860a1b`.
- **Распределение N/E/S/W:** 3 / 5 / 1 / 3.
- **Свободны на старте:** 1 / 0 / 1 / 1 (Ids: 1, 7, 8).
- **Враги:** Grunt E (2 HP, `IN 3`, dmg 2) + Grunt N (2 HP, `IN 4`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Taps to win: 4.
- **Intended Path (Clean):**
  * На старте East заблокирован (0 свободных стрел East при 5 стрелах на доске).
  * Ход 1: `#1(N)` освобождает проход к правому флангу (`#0(E)`).
  * Ход 2: `#0(E)` отпирает вторую стрелу `#4(E)`.
  * Ход 3: `#4(E)` убивает Grunt E и освобождает финишную `#5(N)`.
  * Ход 4: `#5(N)` добивает Grunt N. Итог: 0 урона.
- **Visual Value:** **HIGH**. Более просторная доска 7x7 с глубокими переплетёнными каналами.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e2-square-b.json`.

---

#### Candidate 3: `square6` Seed 18
- **Размер:** 6x6 (36 клеток, 10 стрел). Hash: `ef53578a`.
- **Распределение N/E/S/W:** 2 / 3 / 4 / 1.
- **Свободны на старте:** 1 / 1 / 0 / 1 (Ids: 2, 3, 9).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Taps: 4 (`#2(N) -> #9(E) -> #8(E) -> #5(N)`).
- **Visual Value:** **MEDIUM-HIGH**.

---

## 5. Act I #3 (Caster Awakens)

### CURRENT: `act1-e3` / seed 25 (6x7 `easy`)
- **Board:** 6x7 (10 стрел: N=4, E=2, S=2, W=2).
- **Enemies:**
  * `caster_n`: North (3 HP, `CAST IN 3`, dmg 4, interruptible $\to$ normal `ATTACK IN 3`, dmg 2).
  * `grunt_e`: East (2 HP, `ATTACK IN 4`, dmg 2).
- **Experience Contract:**
  * *Ввод механики Caster:* смертоносный каст на 4 урона с таймером 3 хода.
  * Срыв каста попаданием стрелы North превращает заклинание в обычную атаку (`ATTACK IN 3`, dmg 2).
  * *Взаимодействие со свитой:* на старте путь к срыву каста лежит через разбор свиты East. Снятие Grunt E открывает батарею North.
  * Чистое прохождение: 5 ходов, 0 dmg (`E -> E -> N(interrupt) -> N -> N`).

---

### SQUARE CANDIDATES (Act I #3)

#### Candidate 1 (Recommended Shortlist A): `square8` Seed 231
- **Размер:** 8x8 (64 клетки, 13 стрел). Hash: `733a9511`.
- **Распределение N/E/S/W:** 4 / 4 / 1 / 4.
- **Свободны на старте:** 0 / 1 / 0 / 3 (Ids: 1, 9, 10, 12).
- **Враги:** Caster N (3 HP, `CAST IN 3`, dmg 4, interruptible $\to$ normal `IN 3`, dmg 2) + Grunt E (2 HP, `IN 4`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0 (без Rotate). Taps to win: ровно 5! Nodes: 2,110.
- **Intended Path (Clean):**
  * **Идеальное повторение ритма seed 25:**
  * Ход 1: `#1(E)` (Grunt E HP 2 $\to$ 1; Caster CAST 3 $\to$ 2). Выстрел открывает `#0(E)`.
  * Ход 2: `#0(E)` (Grunt E погибает! Caster CAST 2 $\to$ 1). Выстрел открывает стрелу North `#3(N)`!
  * Ход 3: `#3(N)` — **Срыв каста на последней секунде таймера!** Caster переходит в обычную атаку (`IN 3`).
  * Ход 4: `#4(N)` (Caster HP 2 $\to$ 1).
  * Ход 5: `#6(N)` (Caster погибает!).
  * Итог: ровно 5 ходов, 0 урона, каст сорван секунда в секунду!
- **Mistake Analysis:**
  * Если игрок игнорирует кастера или делает неверные ходы на флангах, на ходу 3 каст детонирует, снося **4 HP**.
- **Visual Value:** **HIGH**. 8x8 масштаб создаёт ощущение дуэли перед башней колдуна.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e3-square-a.json`.

---

#### Candidate 2 (Recommended Shortlist B): `square7` Seed 25
- **Размер:** 7x7 (49 клеток, 12 стрел). Hash: `f0d0113a`.
- **Распределение N/E/S/W:** 3 / 3 / 2 / 4.
- **Свободны на старте:** 1 / 1 / 1 / 2 (Ids: 0, 3, 7, 9, 11).
- **Враги:** Caster N (3 HP, `CAST IN 3`, dmg 4) + Grunt E (2 HP, `IN 4`, dmg 2).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Taps to win: 6.
- **Intended Path (Clean):**
  * Сохраняет **тот же номер сида (Seed 25)**, что и текущий прямоугольный энкаунтер!
  * Ход 1: `#0(W)` открывает связанную стрелу East `#11(E)`.
  * Ход 2: `#11(E)` наносит урон Grunt E и открывает `#1(N)`.
  * Ход 3: `#1(N)` — срыв каста на дедлайне хода 3!
  * Ходы 4–6: `#10(E) -> #3(N) -> #4(N)` — зачистка обоих врагов. Итог: 0 урона.
- **Visual Value:** **HIGH**. Симметричное квадратное поле 7x7, красивый каскадный срыв.
- **Playtest JSON:** `spikes/arrow-core/encounters/migration-candidates/act1-e3-square-b.json`.

---

#### Candidate 3: `square7` Seed 8
- **Размер:** 7x7 (49 клеток, 11 стрел). Hash: `31f4d126`.
- **Распределение N/E/S/W:** 5 / 4 / 2 / 0.
- **Свободны на старте:** 4 / 0 / 1 / 0 (Ids: 1, 2, 3, 4, 10).
- **Метрики солвера:** Solvable = YES. MinDamage = 0. Taps: 6 (`#10(S) -> #8(E) -> #1(N) -> #9(E) -> #2(N) -> #3(N)`).
- **Visual Value:** **MEDIUM-HIGH**.

---

## 6. Side-by-Side Recommendation Matrix

Для проведения прямого ручного плейтеста пользователю предлагается следующая сводная матрица:

| Encounter | Current (Прямоугольный канон) | Candidate A (Рекомендация A) | Candidate B (Рекомендация B) |
|---|---|---|---|
| **Prologue Boss**<br>*(Goblin Shaman)* | **8x10 Seed 1571**<br>16 стрел, Rotate CW win, CCW lose | **8x8 Seed 388**<br>16 стрел, N=1, W=8.<br>CW = 0 dmg, CCW = 2 dmg. | **7x7 Seed 98**<br>11 стрел, N=2, W=2.<br>CW = 0 dmg, CCW = 2 dmg. |
| **Act I #1**<br>*(Two-Front Stand)* | **6x7 Seed 22**<br>11 стрел, W(2hp/3t) + E(3hp/5t).<br>5 taps, 0 dmg. | **7x7 Seed 112**<br>10 стрел, W(2hp/3t) + E(3hp/5t).<br>5 taps, 0 dmg, false bait. | **6x6 Seed 57**<br>11 стрел, W(2hp/3t) + E(3hp/5t).<br>5 taps, 0 dmg, dais tile fit. |
| **Act I #2**<br>*(The Cross-Lock)* | **6x7 Seed 112**<br>9 стрел, E(2hp/3t) + N(2hp/4t).<br>N отпирает E. 4 taps. | **6x6 Seed 41**<br>10 стрел, E=0 free на старте.<br>Чистый замок N $\to$ E $\to$ E $\to$ N. 4 taps. | **7x7 Seed 66**<br>12 стрел, E=0 free на старте.<br>Просторный замок N $\to$ E $\to$ E $\to$ N. 4 taps. |
| **Act I #3**<br>*(Caster Awakens)* | **6x7 Seed 25**<br>10 стрел, Caster N(3hp/3t) + E(2hp/4t).<br>Срыв на ходу 3. 5 taps. | **8x8 Seed 231**<br>13 стрел, Caster N + Grunt E.<br>Срыв ровно на ходу 3! 5 taps, 0 dmg. | **7x7 Seed 25**<br>12 стрел, тот же Seed 25.<br>Срыв на ходу 3. 6 taps, 0 dmg. |

---

## 7. How to Run & Playtest

Все кандидаты шортлиста сгенерированы и сохранены в виде готовых валидных файлов энкаунтеров:
`spikes/arrow-core/encounters/migration-candidates/`

### 1. Проверка через CLI (валидатор + расчет minDamage):
```bash
# Prologue Boss
npm run cli -- encounter encounters/migration-candidates/prologue-boss-square-a.json --player-hp 10
npm run cli -- encounter encounters/migration-candidates/prologue-boss-square-b.json --player-hp 10

# Act I #1
npm run cli -- encounter encounters/migration-candidates/act1-e1-square-a.json --player-hp 10
npm run cli -- encounter encounters/migration-candidates/act1-e1-square-b.json --player-hp 10

# Act I #2
npm run cli -- encounter encounters/migration-candidates/act1-e2-square-a.json --player-hp 10
npm run cli -- encounter encounters/migration-candidates/act1-e2-square-b.json --player-hp 10

# Act I #3
npm run cli -- encounter encounters/migration-candidates/act1-e3-square-a.json --player-hp 10
npm run cli -- encounter encounters/migration-candidates/act1-e3-square-b.json --player-hp 10
```

### 2. Запуск в интерактивном визуальном шелле:
Запуск локального сервера:
```bash
npm run viewer
```
И открыть в браузере:
- `http://localhost:5173/viewer/visual-proto/`
Для загрузки конкретного файла в отладочной консоли браузера:
```javascript
// Загрузить кандидата прямо в боевой вьювер Moonlit Fortress:
await fetch('encounters/migration-candidates/prologue-boss-square-a.json')
  .then(r => r.json())
  .then(raw => {
    const parsed = window.visualDebug.state(); // или через прямой вызов loadScene
  });
```

---

## 8. Secondary Appendix: Act I Encounters 4–6 (Square Notes)

В текущей ревизии (`docs/ACT-I-1-6-REVISED.md`) бои 4–6 вводят механику **Rock Thrower** (способность `THROW IN 3`, прикол стрелы `pinDuration: 2`).

При миграции на квадратную геометрию:
- **E4 (Камнепад):** одиночный Rock Thrower West (3 HP, IN 4, THROW 3).
  * *Рекомендация:* размер **`7x7`** или **`8x8`**. Требует минимум 3 стрелы West и свободную стрелу-приманку для камня.
- **E5 (Клещи камнетёса):** Grunt E (2 HP, IN 3) + Rock Thrower N (2 HP, IN 5, THROW 3).
  * *Рекомендация:* размер **`8x8`**. 8x8 предоставляет достаточный буфер стрел (14–16 шт.), чтобы прикол одной стрелы камнем не приводил к искусственному софтлоку или неизбежному урону.
- **E6 (Осада башни):** Caster N (3 HP, CAST 3) + Rock Thrower W (2 HP, IN 5, THROW 3).
  * *Рекомендация:* размер **`8x8`** или **`9x9`**. В текущем `medium` 8x10 бой страдал от избытка стрел South (7 шт.). В квадратном формате `8x8` соотношение направлений более сбалансировано, а Rotate позволяет конвертировать южные стрелы во фланг камнетёса.

Детальный сканинг семян для 4–6 выносится в отдельную задачу после утверждения пользователем базовых боёв 1–3.

---

## 9. Next Steps for Architect & User

1. Пользователь запускает интерактивный плейтест и сравнивает кандидатов A и B с текущими уровнями.
2. Принятие решения:
   - `ACCEPT A` или `ACCEPT B` по каждому номеру;
   - либо `KEEP RECTANGULAR FOR NOW` (оставить текущий энкаунтер без изменений);
   - либо `TUNE` (скорректировать таймеры / HP выбранного квадратного сида).
3. После одобрения пользователем — отдельная задача на замену канонических файлов в `spikes/arrow-core/encounters/`.
