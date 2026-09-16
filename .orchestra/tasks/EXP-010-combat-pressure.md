# TASK: EXP-010 — Combat Pressure

STATUS: DONE
TYPE: EXP
SIZE: L
AGENT: Claude Sonnet 5 (по прямому запросу пользователя)
BASE_BRANCH: main (свежий, после принятия EXP-007/008/009)
BRANCH: exp/EXP-010-combat-pressure
START_SHA: 8aef7dfb7d8da2a79c172fd5ae2550d8fd412133
RESULT_SHA: 4881ab9

## Что нужно сделать

Превратить серый пролог EXP-009 (puzzle-with-targets) в первый настоящий combat loop: player HP,
blocked-tap damage, enemy `ATTACK IN N`, provisional `Rotate`-vs-turn поведение, 5 encounter'ов вместо
4 (E1 seed 3874/N, E2 tiny+blocked-tap-HP, E3 easy+timer no-damage-path, E4 easy повторно+repeated
attack cycles, E5 medium seed 1571 mini-boss с HP+timer+Direction+Rotate), с HP, переносимым между
encounter'ами через RunState, расширенным validator'ом и analyzer'ом, и viewer, показывающим всё это.

## Что важно знать

- Прочитаны перед стартом: `AGENTS.md`, `.orchestra/RULES.md`, `.orchestra/PROJECT.md`,
  `.orchestra/GIT.md`, `docs/GAME-CONCEPT.md`, `docs/COMBAT-RULES.md`, EXP-009 gray prologue.
- **Правила боя изменились в процессе задачи, до того как контент был подобран** — пользователь
  прислал два уточнения, сославшись на обновлённый `docs/COMBAT-RULES.md` (17 сентября) и отдельно
  переданные факты/рекомендации Gemini-review (не решения):
  1. seed 3874/target N для E1 менять не нужно — двухходовая последовательность (puzzle-miss →
     kill) намеренная, это уже было подтверждено независимым `cli -- analyze` до уточнения;
  2. обычный hit **не** сбрасывает enemy attack timer (interrupt — opt-in `attackTimer.interruptOnHit`,
     off по умолчанию, не используется ни в одном из E1-E5); «нужных стрел для моба больше нет» —
     **не** поражение (игрок доигрывает board под атаками, доска расчищена живым = победа); поражение
     — только `player HP <= 0`.
  - Реализация (`EncounterState.won/lost`, `canStillWin` в validator'е) была переписана под это ДО
    подбора seed'ов E1-E5 — контент собирался уже под финальные правила. Подробности и обоснование
    каждого решения — `spikes/arrow-core/EXP-010-REPORT.md` §1.
- Числа урона/таймеров/`rotate.advancesTurn` — provisional tuning (Gemini-рекомендации через
  пользователя), явно помечены как не апрувнутые, легко меняются как данные в JSON.

## Можно менять

- `spikes/arrow-core/**` (puzzle-core EXP-007 и encounter-модель EXP-008/009 расширены обратно
  совместимо, не переписаны с нуля; старые тесты/encounter-файлы EXP-008/009 не удалялись)
- эта карточка

## Не менять

- `docs/**`, `research/**`, корневые `tools/**`, `.orchestra/*` кроме этой карточки
- не делать: multiple simultaneous enemies, мобы с разных сторон одновременно, Ricochet/Serpent/Chain,
  gear, relics, economy, ads, monetization, Phaser, production art, direction quotas в generator,
  рефакторинг puzzle-core без необходимости

## Готово, если

- [x] `npm run typecheck` и `npm test` зелёные (78/78: 52 старых EXP-007/008/009 не сломаны + 16 новых
      combat-pressure тестов, остальные — обновлённые под новое правило старые тесты);
- [x] `cli -- cp-shortlist --step 3|4` сканирует seed'ы, E3 требует доказанный no-damage path, E4 —
      доказанный ненулевой (repeated attack cycles), сохраняет 8 кандидатов каждый;
- [x] encounter-файлы E1-E5 существуют, проходят `cli -- encounter`;
- [x] E5 (seed 1571): phase1 E + attackTimer, phase2 N + Rotate×1 + attackTimer со свежим окном на
      смену фазы; неправильный Rotate ведёт к player death, правильный — к победе, **на HP входа,
      которое реально производит цепочка E1-E4** (посчитано, не угадано);
- [x] `viewer/cp-prologue.html` проходится вручную от первого тапа до победы/поражения над 1571:
      HP игрока, ATTACK IN N, damage feedback, run HP между encounter'ами, restart current/prologue,
      seed-кандидат для E3/E4;
- [x] validator отвечает: может ли выиграть живым (совпадает с обычным win под новым правилом), есть
      ли no-damage path, минимальный unavoidable damage, пример sequence, budget → UNKNOWN не false NO.

## Проверить

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run cli -- cp-shortlist --step 3 --count 4000
npm run cli -- cp-shortlist --step 4 --count 4000 --min-damage 6 --max-damage 9
npm run cli -- encounter encounters/cp-e1.json
npm run cli -- encounter encounters/cp-e2.json
npm run cli -- encounter encounters/cp-e3.json --player-hp 10
npm run cli -- encounter encounters/cp-e4.json --player-hp 10
npm run cli -- encounter encounters/cp-e5.json --player-hp 4
npm run viewer   # http://localhost:5177/viewer/cp-prologue.html
```

## Когда остановиться

Остановиться и поставить `STATUS: BLOCKED`, если:
- нужную точку старта нельзя воспроизвести;
- задача требует выйти за разрешённые рамки;
- нужен более дорогой уровень задачи;
- правила проекта противоречат друг другу.

## Итог

RESULT:

Полный разбор — `spikes/arrow-core/EXP-010-REPORT.md`. Кратко:

- **Движок** (`src/encounter.ts`): `EncounterState` получил `playerHp`, `BossPhase.attackTimer`
  (`interval`/`damage`/opt-in `interruptOnHit`/`interruptHits`), `EncounterDef.blockedTapDamage` и
  `rotate.advancesTurn`. Урон интервала тикает каждый ход независимо от hit/miss (не сбрасывается
  попаданием по умолчанию); блокированный tap наносит урон, но не тратит ход; убийство в тот же ход
  отменяет ответный удар; поражение — только `playerHp <= 0`; расчистка доски живым — тоже победа.
  Обратная совместимость: старые вызовы `EncounterState.fromLevel(level, def)` без `playerHp`
  используют `DEFAULT_PLAYER_HP=9999` (не влияет на игровые числа).
- **RunState** (`src/run-state.ts`, новый файл): HP переносится между шагами, снапшот на вход шага
  для `restartStep()`, `restartRun()` — шаг 0 и полный HP.
- **Validator** (`src/encounter-solver.ts`): новая `minDamageToWin` (exhaustive, минимизирует урон
  среди выигрышных путей; 0 = доказанный no-damage path). Устаревшая ammo-based эвристика `canStillWin`
  удалена как логически неверная под новым правилом победы (см. FOUND).
- **Timed seed analysis** (`src/analyze.ts`): `hitTiming` — быстрый пре-фильтр для E3/E4 (не
  доказательство; доказательство — `minDamageToWin` на построенном encounter'е).
- **Контент**: `encounters/cp-e1..cp-e5.json` + `cp-e3-shortlist.json`/`cp-e4-shortlist.json` (топ-8
  каждый) + `cp-run-config.json` (`playerMaxHp: 10`, provisional). Provisional seeds: E1=3874 (user),
  E2=300, E3=522, E4=1638, E5=1571 (user). Таблица чисел и обоснование E5 — REPORT §7-8.
- **Viewer** (`viewer/cp-prologue.html`+`.js`): HP игрока, ATTACK IN N, damage feedback (вспышка +
  сообщение), 5 шагов через RunState, restart current/prologue, seed-кандидат для E3/E4.
- **Тесты**: `test/combat-pressure.test.ts` (16 новых) + обновлены assertions в `encounter.test.ts`/
  `prologue.test.ts`, чьи проверки опирались на снятое правило (переформулированы через `maxHits`,
  чтобы не потерять содержательную часть — «убить босса всё ещё нужен Rotate» — при новом `win`).

VERIFY:

- `npm run typecheck` — чисто; `npm test` — **78/78** (52 старых + 16 новых combat-pressure + 10
  переформулированных под новое правило старых, ни одна старая проверка не удалена без замены).
- Прямая проверка правил на фикстуре (см. `test/combat-pressure.test.ts`): blocked tap = урон без
  хода; hit/miss одинаково двигают countdown; default hit НЕ сбрасывает countdown; opt-in
  `interruptOnHit` сбрасывает; enemy attack наносит урон и сбрасывает countdown; kill отменяет
  ответный удар даже на countdown 0; `playerHp<=0` — единственное поражение; расчистка живым — победа.
- `cli -- encounter` на всех 5 файлах — exit 0; `cp-e3` доказанный no-damage (min damage 0); `cp-e4`
  доказанный минимум 6 (2 attack cycle); `cp-e5` при entryHp=4 — win без Rotate NO (доказано), win с
  1 Rotate YES, глобальный минимум урона на любом выигрышном пути = 1.
- Полное прохождение `viewer/cp-prologue.html` воспроизведено дважды в headless Chromium через
  синтетические DOM-клики (`window.cpDebug`): (1) E1→E5 подряд с ccw на mini-boss — финиш HP 3/10,
  оверлей "Пролог пройден"; (2) тот же путь с cw на mini-boss — HP дошло до 0 на 17-м действии,
  оверлей "Поражение", `restart prologue` вернул к шагу 0 с полным HP. HP на входе в E5 в обоих
  прогонах — ровно 4/10 (10 - 6, где 6 — доказанный минимум E4), подтверждая расчёт из REPORT §7.
- Реальные пиксельные клики через `computer` tool по-прежнему ненадёжны, пока Browser pane не в
  фокусе (как в EXP-009) — использованы синтетические DOM click-события с координатами из
  `window.cpDebug.pointOf(id)`; после клика по Rotate обязательно ждать ~300мс до следующего тапа
  (анимация поворота блокирует `tap()` через `rotAnim`, иначе клики молча теряются — нашёл на
  ошибке в собственном тестовом скрипте, не в движке).
- Визуальный осмотр (цвета/адаптивность) не делался — тот же ограничитель, что в EXP-009: browser
  pane оставался скрытым/не в фокусе весь сеанс, `computer{action:"screenshot"}` не пробовался
  повторно после известного таймаута. Функциональность подтверждена текстовым/JS-осмотром, не глазами.

FOUND:

- EXP-008's эвристика `canStillWin` (upper bound «не хватит подходящих стрел на фазу = обречён»)
  стала логически неверной при новом правиле «board cleared alive = win» и была удалена целиком
  (вместе с мёртвым `reachableOffsets`/`offsetCache`), а не адаптирована — адаптация потребовала бы
  моделировать attackTimer/HP прямо в эвристике, что уже отдельная, более дорогая задача. Текущий
  `findWin`/`minDamageToWin` — честный memoized DFS без верхней оценки; для досок заметно больше
  `medium` (грубо `hard`/`expert`, 20+ стрел) может потребоваться увеличенный `--budget`.
- Ассиметрия «неправильный Rotate проигрывает» на E5 верна конкретно при HP входа ~4 (то, что
  реально производит цепочка E1-E4 при этих числах). Если пользователь позже изменит `playerMaxHp`
  или урон E2-E4 отдельным решением, E5 нужно пересчитать заново тем же способом (`minDamageToWin` +
  прямая симуляция natural-greedy фазы 1 + cw/ccw, см. REPORT §7) — не эмпирическое совпадение,
  но и не инвариант, устойчивый к любым будущим изменениям баланса.
- Полный текст Gemini review не передавался — пользователь прислал только выжимку фактов и
  рекомендаций через архитектора. Использовано так, как было явно указано: как provisional tuning
  input, не как принятые правила; ничего из выжимки не превращено в захардкоженное поведение движка.
- `docs/COMBAT-RULES.md`/`docs/GAME-CONCEPT.md` уже лежали в дереве на момент ветвления (EXP-009 к
  тому моменту принята в `main`) — в отличие от EXP-009, здесь не потребовался обходной путь через
  `git show origin/main:...`.
- Untracked `donors.md` и `research/vk-market/reference-audit/` в рабочей копии — не мои, из
  параллельной работы, не трогал.

После этого:
1. поставить `STATUS: DONE`;
2. записать финальный commit в `RESULT_SHA`;
3. сделать commit с заполненным task-файлом;
4. остановиться и ждать решения пользователя.

`DONE` означает только «исполнитель закончил». Это не означает, что работа принята.
