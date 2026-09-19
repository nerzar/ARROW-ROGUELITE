# LD-006 — Act I encounter shortlist (DESIGN SHORTLIST, не user-approved)

Продолжение после `act1-e1/e2/e3.json`. Сырьё для курирования пользователем, не implementation.
Production `encounters/*.json` не тронуты; кандидаты валидировались во временных файлах.

## Метод и воспроизводимость

- Скан: `node dist/tools/cli.js analyze --preset <easy|medium> --seed <N> --json`
  (easy 1–800 с мягким фильтром, medium 1–300; всего ~1100 досок).
- Кандидаты: `node dist/tools/cli.js encounter /tmp/ld/LD-X.json`
  (win / no-damage / min unavoidable damage / example sequence — всё из валидатора).
- Точные команды дословно (preset/seed/levelHash внутри каждого блока ниже).
- Механики только из движка на сейчас: Grunt-таймеры (normal/cast/interruptible),
  `stone_throw`/pin, optional-флаг, flee, shared Rotate pool, blockedTapDamage.
  Нагруд/сундуков/временных reward-целей в движке нет — таких кандидатов нет в списке.
- `board-clear survival possible`: валидатор не считает — везде UNKNOWN (честно, не придумано).
- Rotate pool доступен везде (как в e1–e3), `min Rotates needed = 0` у всех — Rotate остаётся
  страховочным клапаном, принудительного Rotate-момента нигде нет.

## Сводная таблица (все валидированы валидатором)

| ID | Board | Арены N/E/S/W | Enemies | Win | Min dmg | Тапы/хиты |
|---|---|---|---|---|---|---|
| LD-A | easy 6x7 s428 | 2/5/1/4 | N2/IN4 + E2/IN3 + W3/IN5, dmg2 | YES | 4 | 10/7 |
| LD-B | medium 8x10 s186 | 6/6/3/4 | N3/IN3 + E2/IN4 + W3/IN5, dmg2 | YES | 4 | 8/8 |
| LD-C | easy 6x7 s723 | 3/4/2/3 | rock N4/IN5 + pin3 + E2/IN3, dmg2 | YES | 2 | 12/5 |
| LD-D | medium 8x10 s121 | 7/6/2/3 | cast N3/IN3/d4 + cast E2/IN4/d3, interruptible | YES | 0 | 7/5 |
| LD-F | medium 8x10 s97 | 4/11/1/3 | elite E6/IN3/d3 + pest W2 без таймера | YES | 3 | 17/8 |
| LD-G | easy 6x7 s564 | 2/5/3/4 | S2/IN4 + E2/IN3, dmg2 | YES | 0 | 4/4 |
| LD-H | medium 8x10 s239 | 3/6/3/7 | cast N3/IN3 + rock W4/pin + E2/IN4 | YES | 7* | — |
| LD-E | medium 8x10 s22 | 4/4/6/6 | tank E6 + swarm N2 + swarm W2 | YES | 10 | 20/8 |

`*` LD-H: `min damage 7 (not proven optimal)`, example sequence валидатор не построил
(бюджет поиска) — числа не валидированы, только направление.
LD-E: REJECTED (см. ниже), в детальный разбор не входит.

## Детально (формат LEVEL-DESIGNER.md §4)

### LD-A — Three fronts, easy triage

ID / рабочее название: LD-A / «Три фронта»
Seed: 428. Board size: easy 6x7 (12 стрел). Arrow count: 12.
Direction counts N/E/S/W: 2/5/1/4. Initially free N/E/S/W: 1/1/1/1 (free со всех сторон сразу).
Слои: L0[1,1,1,1] L1[1,0,0,3] L2[0,2,0,0] L3[0,2,0,0]; ветвлений 11; seq `ESWNWNEWWEEE`.

Enemies:
- grunt_n / N / 2 HP / IN4 / dmg2
- grunt_e / E / 2 HP / IN3 / dmg2
- grunt_w / W / 3 HP / IN5 / dmg2

Objective: убить всех (7 hp).

Relevant timing:
- earliest relevant hit(s): t1 E-хит свободен сразу (пример: tap#0 E HIT).
- important gaps / deadlines: E бьёт первым (~t3), N ~t4, W ~t5; W требует 3 попаданий — его нельзя откладывать в конец.
- Rotate requirement: pool доступен, валидатор: min Rotates 0.

Solver / analyzer:
- solvable: YES. min unavoidable player damage: 4. board-clear survival possible: UNKNOWN.
- example winning sequence: `E HIT, N HIT, N HIT, (E атакует), E HIT, E miss, E miss, S miss, W HIT, W HIT, W HIT` (10 тапов).

Design:
- чему учит: триаж трёх сторон с разными дедлайнами — первый encounter после e3, где сторон три.
- главный интересный выбор: гнать E (бьёт первым) или копить W-боеприпасы заранее (3 хита).
- как игрок может ошибиться: закопаться в W (долгая цель), пропустив две атаки E.
- почему кандидат лучше обычного валидного seed: free со всех 4 сторон на старте + 11 ветвлений, нет вынужденного первого хода.
- известные риски: 4 неизбежных урона сразу после e3 могут показаться штрафом за сложность; HP-числа — черновик под тюн пользователя.

### LD-B — Three fronts, harder

ID: LD-B / «Три фронта, жёстче»
Seed: 186. Board size: medium 8x10 (19 стрел).
Direction counts: 6/6/3/4. Initially free: 2/3/2/1. Ветвлений 18. Seq `NEWNEEEWWNENSNWESSN`.

Enemies:
- grunt_n / N / 3 HP / IN3 / dmg2
- grunt_e / E / 2 HP / IN4 / dmg2
- grunt_w / W / 3 HP / IN5 / dmg2

Objective: убить всех (8 hp).

Relevant timing:
- earliest relevant hit(s): t1 W+N свободны (пример: tap#0 W HIT).
- deadlines: N IN3 при 3 HP — самый плотный фронт (нужны 3 N-попадания за ~4 хода при запасе N=6).
- Rotate requirement: нет (min Rotates 0).

Solver / analyzer:
- solvable: YES. min unavoidable player damage: 4. board-clear survival possible: UNKNOWN.
- example winning sequence (8 тапов, все хиты): `W HIT, N HIT, N HIT, (N атакует), W HIT, (E атакует), W HIT, N HIT, E HIT, E HIT`.

Design:
- чему учит: тот же триаж, что LD-A, но дольше и с настоящим дефицитом N-боеприпасов.
- главный интересный выбор: влить всё в N-срочность или разменять урон за добивание W.
- как игрок может ошибиться: ровный размен по всем (таймеры наказывают), опоздание с третьим N-хитом.
- почему лучше: все 8 тапов примера — хиты, нет пустых ходов; medium-доска даёт запас манёвра.
- известные риски: скачок easy→medium; ставить после LD-A/LD-C, не сразу после e3.

### LD-C — Pin intro (первая способность)

ID: LD-C / «Камень» (pin intro)
Seed: 723. Board size: easy 6x7 (12 стрел).
Direction counts: 3/4/2/3. Initially free: 1/3/1/1 (E Marie — 3 свободные E). Ветвлений 11. Seq `EENWSWEWNNSE`.

Enemies:
- rock_n / N / 4 HP / IN5 / dmg1 + ability stone_throw (THROW IN 3, pin 2 turns, free-arrow)
- grunt_e / E / 2 HP / IN3 / dmg2

Objective: убить обоих (6 hp).

Relevant timing:
- earliest relevant hit(s): t1 N+E свободны (пример: tap#0 N HIT).
- gaps/deadlines: THROW IN 3 (пин E#1 на 2 хода), UNPINNED ~t5; E IN3 —향을 급하다.
- Rotate requirement: нет.

Solver / analyzer:
- solvable: YES. min unavoidable player damage: 2. board-clear survival possible: UNKNOWN.
- example winning sequence (12 тапов): `N HIT, E HIT, E HIT, (ROCK THROWN #1), E miss, E miss, (rock атакует, UNPINNED), W miss, (ROCK THROWN #2), W miss, W miss, S miss, (UNPINNED), W miss, N HIT, (rock атакует), N HIT, N HIT, S miss`.

Design:
- чему учит: первая способность в игре — pin: как читать THROW IN, что делать с прибитыми стрелами (ждать 2 хода, играть другими сторонами).
- главный интересный выбор: добивать rock (4 HP, далеко) или гонять grunt под пинами.
- как игрок может ошибиться: тапать прибитую стрелку (думать, что ход пропал зря — на деле PINNED не тратит ход/HP, но новичок испугается).
- почему лучше: единственная новая механика прогресси
...[truncated 4473 chars]