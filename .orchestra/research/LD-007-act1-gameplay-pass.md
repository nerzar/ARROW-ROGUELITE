# LD-007 — Act I gameplay pass (PROVISIONAL PLAYTEST, не принято)

Ветка `design/LD-007-act1-gameplay-pass` от `origin/main a05943c`. Всё ниже — предложение геймдизайнера
и легко выбрасываемый playtest. Ничего не merge'ено, ничего не объявлено принятым.

Инструменты воспроизведения (из `spikes/arrow-core`):

```text
npm run build
node tools/ld007-audit.mjs --only act1          # метрики каждого stage текущей campaign.json
node tools/ld007-scan.mjs --stats --size 7 --profile short --count 300
node tools/ld007-scan.mjs --brief campaigns/ld007-briefs/a4-three.json --size 7 --profile short --count 160
node tools/ld007-build-campaign.mjs             # собрать provisional Act I в campaigns/campaign.json
```

---

## 1. CURRENT PROBLEMS — что не так с Act I на `main`

Всё проверено на реальных board'ах, которые генерирует viewer (не по документам).

**P1. FACT: campaign-доски — это не те доски, что анализировал LD-006.**
`campaign-model.js` генерирует board как `PRESETS.medium` (minLength 2, **maxLength 8**, targetFill 0.88)
с подменой размера на 6x6. LD-006 анализировал `easy 6x7` / `medium 8x10` по тем же номерам seed.
Seed 428 в LD-006 — 12 стрел 2/5/1/4; в campaign — 7 стрел 1/2/1/3. Все notes в stage'ах Act I
описывают доски, которых в игре нет. Пресеты `square6..square10` (maxLength 4) существуют, но
игрой не используются.

**P2. FACT: 6x6 «long» = 7–8 стрел, средняя длина 4.6, одно направление почти всегда пустое.**
Статистика 300 seed'ов 6x6: arrows 7.65, dir balance (min/max по направлениям) **0.11**.
Это и есть «несколько длинных стрел на всё поле»: не про красоту, а про то, что стрел
физически меньше, чем HP у мобов.

**P3. FACT: 6 из 8 stage'ов Act I содержат моба, которого нельзя убить без Rotate по конструкции**
(стрел его направления меньше, чем HP):

| stage | board | dirs N/E/S/W | unkillable @0R | min dmg @0R | min dmg @1R |
|---|---|---|---|---|---|
| 1 patrol | s22, 7 стрел | 2/3/1/1 | raider W (1 стрела vs 2 HP) | 4 | 0 |
| 2 cross-lock | s112, 8 | 2/3/0/3 | — | 2 | 0 |
| 3 caster | s25, 7 | 1/1/5/0 | **оба** (5 стрел из 7 — в пустую S) | 6 | 4 (2R → 0) |
| 4 rock | s723, 8 | 3/1/2/2 | — | 0 | 0 |
| 5 three-front | s428, 7 | 1/2/1/3 | grunt N | 2 | 2 |
| 6 captain | s97, 7 | 6/0/0/1 | **captain E: 0 стрел E** | 3 | 0 |
| 7 mixed exam | s239, 8 | 3/0/0/5 | grunt E: 0 стрел E | 2 | 1 |
| 8 King | s186, 7 | 1/2/3/1 | **обе фазы** (1 N на 3 HP, 2 E на 3 HP) | 2 | 0 |

**P4. FACT: цепочка Act I на `main` непроходима идеальным игроком без рестартов.**
Сумма минимального неизбежного урона при 0 Rotate = **21** при 10 HP без лечения между боями.
С двумя shared Rotate лучший расклад ≈ 15. Игрок «проходит» только потому, что `restart step`
возвращает HP на вход в stage. Rotate здесь не усилитель, а ключ от двери — ровно та проблема,
которую фиксируют новые пункты COMBAT-RULES 7.1.

**P5. Face-tank хвост.** После последнего осмысленного попадания игрок дочищает 2–6 стрел
без единого решения (stage 1: после t3 один свободный элемент, 4 forced-тапа, ещё −2 HP; stage 8:
1 попадание и 6 forced-тапов). Играл руками — ощущается как «я уже проиграл бой, теперь кликаю».

**P6. Мёртвая сторона.** Арена имеет 3 слота (N/E/W), генератор — 4 направления. ~25 % стрел
любой доски по построению не бьют никого. На 7-стрельной доске это 2 стрелы из 7.

**P7. Способности не меняют чтение поля.** Shield Captain стоит на стороне, куда нет ни одной
стрелы; Rock Thrower пинит lowest-id стрелу на доске, где и так 1 свободная. Способности
существуют, но в этих раскладах игрок их не «решает».

**P8. Дубли обучения.** Stage 1 и 2 — одно и то же (два грунта, две стороны). Stage 5 три фронта
при 7 стрелах — триаж без боеприпасов.

**P9. Бой заканчивается раньше puzzle.** Immediate-win по убийству всех mandatory: при
малом суммарном HP большая часть доски не играется вообще. На плотной доске это заметнее.

**P10 (мелкое). FOUND:** `.orchestra/research/LD-006-act1-encounter-shortlist.md` обрезан в репо —
строка 124 буквально `...[truncated 4473 chars]` (артефакт прошлого агента).

---

## 2. PROVISIONAL ACT I — цепочка на ветке

Принципы, по которым собирал (предложение, не канон):

- у каждого обычного stage есть доказанная **0-damage линия при 0 Rotate**;
- все mandatory мобы убиваемы при 0 Rotate (ammo ≥ HP на их стороне);
- «наивный» игрок (тапает любую бьющую стрелу, не планирует) теряет 2–4 HP — порядок важен;
- размер доски растёт 6 → 7 → 8, стрел 11 → 20, каждый stage вводит ровно одну новую мысль;
- Rotate везде может улучшить линию (раньше убить/сэкономить unlock-ход), нигде не обязателен.

| # | stage | board | стрел | dirs N/E/S/W | враги (side / HP / timer / ability) | что учит | 0R линия | naive dmg |
|---|---|---|---|---|---|---|---|---|
| 1 | Пограничный патруль | 6x6 short s11 | 13 | 2/6/1/4 | raider W 2hp IN3 d2; guard E 3hp IN5 d2 | «кто бьёт первым — тому первые стрелы» с реальным запасом стрел | W W E E E, 0 dmg, kills t2/t5 | 1.8 |
| 2 | Ученик шамана | 6x6 short s126 | 11 | 3/4/0/4 | apprentice N 3hp CAST IN3 d4 (→ IN3 d2); escort E 2hp IN4 d2 | interrupt как тайминг: тронуть кастера до t3, но escort бьёт на t4 | E E N N W N, 0 dmg | 3.0 |
| 3 | Камнемёт | 7x7 short s21 | 14 | 5/4/1/4 | rock N 3hp IN6 d1 + THROW/3 pin2; escort E 2hp IN3 d2 | пин убирает опцию — держи запасной путь | 0 dmg, kills t3/t6 | 2.3 |
| 4 | Гоблин-разведчик **(новая ability `shift`)** | 7x7 short s53 | 16 | 6/5/1/4 | scout E 3hp IN4 d2 + MOVE/2 (E↔W); lookout N 2hp IN5 d2 | направление как ресурс во времени: «бью на E сейчас, добиваю на W когда он придёт» | N E W W N, 0 dmg | 2.1 |
| 5 | Засада с трёх сторон | 7x7 short s50 | 16 | 2/7/1/6 | N 2hp IN5 d2; E 2hp IN3 d2; brute W 3hp IN7 d3 | триаж трёх дедлайнов; 7 попаданий за 7 ходов | 0 dmg, kills t3/t5/t7 | 3.9 |
| 6 | Капитан стражи | 7x7 **mixed** s54 | 13 | 1/9/0/3 | captain E 3hp IN5 d3 + SHIELD/2; pest W 2hp IN6 d1 | ритм щита: один E-выстрел будет съеден — заложи его в бюджет или потрать этот ход на pest | E E E(absorbed) E W W, 0 dmg | 3.0 |
| 7 | Ритуальные ворота | 8x8 short s65 | 20 | 6/5/4/5 | caster N 3hp CAST IN4 d4; rock W 3hp IN8 d1 + THROW/3; grunt E 2hp IN4 d2 | экзамен: interrupt + pin + три стороны, 8 попаданий за 8 ходов из 20 стрел | 0 dmg, kills t4/t6/t8 | 4.1 |
| 8 | Goblin King | 8x8 short s73 | 19 | 8/4/5/2 | ph1 N 3hp IN5 d2; ph2 E 4hp CAST IN3 d3 (→ IN4 d2) | босс: фаза 2 имеет ровно 4 E-стрелы на 4 HP — 0R линия есть, но без запаса; Rotate даёт запас (N8 → E) | 12 тапов, 0 dmg | 4.5 |

Суммарный «naive» урон ≈ 25 → небрежный игрок умирает к 5-му stage; аккуратный проходит с ~10 HP.
Это заведомо жёстко — см. USER DECISION про экономику HP.

Что убрал: старый stage 2 «Взаимный заслон» (дубль stage 1). Что добавил: stage 4 «Разведчик».

---

## 3. PLAYABLE CHANGES — что реально в ветке

- `viewer/visual-proto/board-profiles.js` — профили генератора `long` (= текущее поведение, байт в байт),
  `short` (стрелы 2–4, fill 0.9), `mixed` (2–6). Выбираются `board.profile` в campaign JSON;
  `board.gen` переопределяет любой параметр. Подключено в `campaign-model.js` и в Campaign Editor
  (dropdown «Arrow Profile»). Старые stage'и без `profile` не меняются.
- `src/encounter.ts` — provisional ability `kind: 'shift'` (третий case в union COMBAT-001):
  моб на своём countdown переходит на следующую сторону из списка `sides`; занятая живым мобом
  сторона пропускается. HUD `MOVE IN N`, лог/трасса `MOVED`, `key()` учитывает сторону,
  undo/clone корректны, 5 тестов `test/ld007-enemy-shift.test.ts`. Core Tap Away, BoardState,
  solver, Rotate economy, win conditions — не тронуты.
- `campaigns/campaign.json` — Prologue без изменений; Act I заменён на 8 stage'ов выше.
  Источник — `campaigns/ld007-briefs/*.json` + `tools/ld007-build-campaign.mjs`.
- `tools/ld007-audit.mjs`, `tools/ld007-scan.mjs` — designer-метрики: ammo vs HP по сторонам,
  min damage @0/1/2 Rotate, kills по ходам, choice/forced turns, forced tail, options per turn,
  unlock moves, naive-player damage/death rate. Скан ранжирует seed'ы по design-score,
  а не по solver «VALID».
- `viewer/visual-proto/arena-library.js` + `assets/arenas/library/*.jpg` — все 36 ещё не подключённых арен
  из `magicarrowassets/arenas` (дубли и 8 уже импортированных пропущены; JPEG q92 вместо PNG, чтобы репо
  не выросло на ~110 MB — при желании меняется на PNG). Видны в Campaign Editor; у каждой есть
  стартовая калибровка по одному из двух шаблонов (podium / dais). Stage 6 «Капитан стражи» переведён
  на `goblin-camp-podium` (сцена с центральным подиумом) с ручной калибровкой.
- `test/build-027-square-prologue.test.ts` — обновлён под новую цепочку + новый тест
  «у каждого Act I stage есть 0-damage линия при 0 Rotate».

Полный suite: 34 файла / 384 теста зелёные.

---

## 4. PUZZLE DENSITY TEST

300 seed'ов на профиль/размер, board-only:

| профиль / размер | стрел | avg len | max len | branch points | initial free | dir balance |
|---|---|---|---|---|---|---|
| long 6x6 (текущий) | 7.7 | 4.6 | 7.7 | 5.4 | 2.5 | **0.11** |
| long 7x7 | 10.3 | 4.6 | 7.8 | 8.1 | 3.4 | 0.16 |
| long 8x8 | 13.4 | 4.5 | 7.9 | 11.4 | 4.3 | 0.21 |
| short 6x6 | 10.9 | 3.1 | 4.2 | 8.8 | 3.3 | 0.21 |
| short 7x7 | 14.5 | 3.1 | 4.2 | 12.7 | 4.6 | 0.25 |
| short 8x8 | 18.4 | 3.2 | 4.2 | 16.7 | 5.8 | 0.31 |
| mixed 6x6 | 9.3 | 3.8 | 6.0 | 7.1 | 2.8 | 0.16 |
| mixed 7x7 | 12.1 | 3.9 | 6.1 | 10.1 | 3.8 | 0.21 |
| mixed 8x8 | 15.6 | 3.9 | 6.1 | 13.7 | 4.9 | 0.24 |

Тот же brief (три фронта, 7 HP) на 7x7 — лучшие seed'ы по профилям:

| профиль | стрел | options/turn на 0R линии | naive dmg | 0R min dmg |
|---|---|---|---|---|
| long | 13 | 4.1 | 4.3 | 0 |
| mixed | 11–12 | 4.3–5.4 | 3.2–4.2 | 0 |
| short | 16 | 4.7–5.7 | 3.5–4.9 | 0 |

Выводы (мои, проверяемые):

1. **Главный эффект — не «глубина», а баланс направлений.** У long 6x6 одно направление
   почти всегда пустое (balance 0.11): именно это делает мобов неубиваемыми. Short 8x8 даёт 0.31.
   Вторая по силе мера — просто больший board (long 8x8 ≈ short 7x7 по числу стрел).
2. **Short реально читается как классический Tap Away** (скриншоты 6x6/13 стрел, 7x7/16, 8x8/19 —
   в viewer всё различимо на 1280x720; на мобильных 740x360 8x8 short надо смотреть глазами —
   это верхняя граница).
3. **Mixed — компромисс без явного выигрыша**: длинные стрелы возвращают перекос направлений
   (stage 6: 1/9/0/3), плотность ниже short. Визуально «структурнее», механически — как long
   с чуть большим числом элементов.
4. **Immediate-win ограничивает пользу плотности.** Пока бой заканчивается на t5–t8, из 16–20
   стрел играется меньше половины. Плотность даёт выбор (4–6 опций в ход вместо 2–3) и ammo,
   но не «длинную» головоломку. Чтобы puzzle играл дальше, нужны либо больший суммарный HP,
   либо цели, которые появляются позже (см. §5).
5. Гипотеза «короткие стрелы = правильно» **не подтверждена как единственно верная**, но
   short + рост board 6→8 — лучший из трёх вариантов по всем измеренным осям одновременно.
   Рекомендую short как default для Act I и mixed/long — как осознанный «стиль» отдельных stage'ов.
6. Ещё один рычаг, который не трогал (USER DECISION): `dirWeights` генератора. S-weight 0.4
   снижает мёртвые S-стрелы с 2.7 до 1.9 на 6x6 без потери генерируемости; S=0 — до нуля.

---

## 5. NEW MECHANICS PROPOSALS

Формат: что / какую проблему решает / риск / минимальный прототип. Первый — уже в ветке.

**M1. Side Shift (`shift`) — PROVISIONAL PLAYTEST, в ветке.** Моб ходит между сторонами по
таймеру. Решает P6/P3 иначе, чем Rotate: не игрок поворачивает доску, а цель приходит к
боеприпасам; появляется «ждать или бить сейчас». Риск: без анимации перехода читается как
телепорт (сейчас так). Прототип: stage 4.

**M2. Temporary reward target (сундук/кристалл на N ходов).** `mandatory:false` + `expiresAfter`
+ `onKill: {heal|rotate|...}`. Решает P9 (доска играет дольше — цель появляется на t6) и даёт
положительную дилемму из GAME-CONCEPT §11. Экономика HP (см. USER DECISION) может жить именно тут:
лечение как награда за точность, а не как бесплатный refill. Прототип: 1 поле в EnemyDef +
условие в `advancePinsAndAbilities`, S-слот арены не нужен — можно ставить на любую свободную сторону.

**M3. Warcry / buffer.** Пассивный моб, пока жив, +1 к урону остальных. Меняет priority: слабый,
но первый. Прототип: 1 проверка в `advanceEnemiesTurn`. Риск: нужна читаемая индикация буффа.

**M4. Retaliation / thorns.** Каждое не-убивающее попадание стоит 1 HP. Заставляет копить burst
(в связке с Shield — «пробей щит холостой, потом два подряд»). Прототип: 3 строки в `tapEnemies`.
Риск: конфликтует с прологовским «попадание всегда хорошо».

**M5. Directional armor (Armored из CONTENT-SYSTEM).** Уязвим только с одной стороны, сторона
меняется каждые N ходов = Shift + Shield в одном мобе. Держать как elite-версию M1, а не
отдельный код.

**M6. Enrage (Berserker).** При HP ≤ 1 interval −1. «Не начинай его, если не добьёшь».
Прототип: `currentEnemyAttackTimer` возвращает enraged timer. Дёшево.

**M7. Summoner.** Вызывает грунта на свободную сторону. Требует динамического списка enemies —
это уже архитектурное изменение EncounterState/TapResult/viewer. PROPOSAL, не прототипировать
молча.

**M8. Direction-weighted generation (`dirWeights`).** Не механика, а рычаг контента: убрать
мёртвые S-стрелы или, наоборот, сделать S «tempo-ходами» осознанно. Уже поддержано генератором.

**M9. Rotate как награда за stage, а не только за босса.** Сейчас pool 2 на весь Act — игрок
бережёт и не пользуется. Вариант: +1 Rotate за stage без урона. Это меняет Rotate economy —
USER DECISION.

**M10. Boss «Rotation lock» для Goblin King.** Фаза 2: босс сам поворачивает доску на 90° при
переходе (rotate за счёт врага). Игрок впервые видит Rotate как оружие противника → мотивирует
свой. Прототип: `phase.forcedRotate: 1` в BossPhase, движок уже умеет `rotate()`.

---

## 6. KEEP / CHANGE / REMOVE

**KEEP**
- Правила core Tap Away, blocked-tap −1 без хода, ATTACK/CAST IN N телеграф, interrupt только у cast,
  immediate win / board-clear win, shared Rotate pool 2 — всё держит.
- Пролог 1–5 в текущем виде (0-damage линии есть, learning curve чистая).
- Generic ability framework COMBAT-001 — третья ability добавилась ~60 строками, это доказано.
- Campaign Editor как рабочий инструмент тюнинга.
- Arena calibration: 7x7/8x8 легли в существующие арены без правок.

**CHANGE**
- Генератор для authored boards: short-профиль по умолчанию для Act I, рост 6→7→8.
- Все 8 Act I stage'ов (см. §2). Особо: Captain — SHIELD/2 вместо /3 (иначе щит не успевает
  повлиять на оптимальную линию), Rock Thrower — урон 1 с IN6–8 (его угроза — пин, не урон).
- Отбор seed'ов: критерии `0R min dmg = 0`, `naive − optimal ≥ 2`, `unkillable = 0`, `tail = 0`
  вместо «solver VALID». Инструменты в ветке.
- Метрика в LEVEL-DESIGNER.md §4: добавить `ammo per side vs HP`, `naive damage`, `forced tail`.

**REMOVE**
- Старый stage 2 «Взаимный заслон» (дубль).
- Stage 3/6/8 на `main` в текущих seed'ах — не тюнить, заменить.
- Пресеты `square5..square10` из `presets.ts`: их никто не использует, они вводят в
  заблуждение («Authored campaign levels pick one of these» — неправда).
- Пассивный «pest» без таймера как mandatory-цель (stage 6 на main): цель без давления и
  без награды — просто лишний тап.

---

## 7. USER DECISIONS

1. **Экономика HP.** 10 HP на 13 боёв без лечения делает любой неизбежный урон недопустимым и
   любой «triage-бой с принятием удара» невозможным. Варианты: (a) heal между актами/у босса;
   (b) heal как temporary reward target (M2); (c) max HP выше; (d) оставить и держать все обычные
   stage'и в 0-damage. Я собрал ветку под (d), но (b) считаю лучшим для игры.
2. **Профиль генератора для Act I:** short как default (моя рекомендация) / mixed / оставить long
   и просто увеличить board до 8x8.
3. **Мёртвая S-сторона:** `dirWeights` S=0.4 (меньше холостых), S=0 (нет холостых), оставить 1
   (холостые = tempo-ходы). Или добавить 4-й слот арены снизу.
4. **`shift` как штатная ability** (принять/переделать/выкинуть) и нужна ли анимация перехода до
   playtest.
5. **Stage 8 King:** оставить «ровно 4 E на 4 HP» (Rotate = запас) или дать 1 стрелу слабины.
6. **Длина Act I:** 8 stage'ов, ~6–12 тапов каждый. Достаточно/много/мало — по ощущениям.
7. **Immediate-win vs плотность:** принять, что плотная доска не доигрывается, или ввести
   поздние цели (M2) чтобы puzzle жил до конца.

---

## 8. URL

Из `spikes/arrow-core` ветки LD-007 (worktree `.worktrees/LD-007`):

```text
npm run build
node tools/serve.mjs 5250
```

- Игра: `http://localhost:5250/viewer/visual-proto/index.html` — в dropdown «6. Акт I · 1 …» и
  дальше «Следующий этап»; либо пройти пролог с «1. Этап 1». Прямой выбор Act I stage даёт
  0 Rotate (0-Rotate линия проверяется честно); через пролог — 2 shared.
- Campaign Editor (профиль/seed/HP/таймеры): `http://localhost:5250/viewer/visual-proto/calibration-editor.html`.
- Для сравнения старый Act I: root checkout `main`, `npm run viewer` → порт 5177.

## 9. SHA

См. `git log design/LD-007-act1-gameplay-pass` — commit «design(LD-007): provisional Act I gameplay
pass» и следующий с этим документом. Ветка запушена на `origin`.
