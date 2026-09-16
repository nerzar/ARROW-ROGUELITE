# TASK: EXP-010b — Multi-Enemy Combat Pressure

STATUS: DONE
TYPE: EXP
SIZE: L
AGENT: Claude Sonnet 5 (overnight, direct user request, no intermediate questions per instruction)
BASE_BRANCH: main (свежий, после docs-корректировок combat rules/balance/level-designer)
BRANCH: exp/EXP-010b-multi-enemy
START_SHA: f3ba937c63bb93292b3f325b9177b7c541510970
EXP010_SOURCE_SHA: 4881ab9e16bf55489ddf60e384087a2549efe937 (cherry-picked implementation commit only, not the EXP-010 task-record commit)
RESULT_SHA: 574067f

## Что нужно было сделать

Довести Combat Pressure prototype (EXP-010) до 5-encounter пролога с simultaneous multi-enemy
support, заменив Encounter 4 (старый seed 1638 с 6 unavoidable damage) на новый, реально
zero-damage-clean encounter с двумя одновременно живыми врагами (приоритет как новая механика, не
direction/Rotate). Полный бриф — в истории сессии; ключевые числа: E4 seed 10, enemy E (hp2,
ATTACK IN 3, dmg2) + enemy N (hp2, ATTACK IN 5, dmg2), никакого Rotate в E4, backup seed 112
(не реализован), seed 3 запрещён явно.

## Что важно знать

- Прочитаны перед стартом: `.orchestra/RULES.md`, `.orchestra/PROJECT.md`, `.orchestra/GIT.md`,
  `.orchestra/LEVEL-DESIGNER.md`, `docs/GAME-CONCEPT.md`, `docs/COMBAT-RULES.md`,
  `docs/BALANCE-SYSTEM.md`, `spikes/arrow-core/EXP-010-REPORT.md`.
- Cherry-pick сделан ИЗ EXP-010 implementation commit НА свежий `main` — конфликтов не возникло
  (свежие docs на `main` не пересекались с изменёнными файлами EXP-010 implementation-коммита).
- `EncounterDef` теперь имеет два взаимоисключающих режима: `boss.phases` (последовательный, не
  тронут, всё ещё под E1/E2/E3/E5) и новый `enemies[]` (одновременный, только под E4). Полная модель
  и обоснование — `spikes/arrow-core/EXP-010b-REPORT.md` §1.
- E5 (seed 1571) осознанно НЕ трогался и НЕ ребалансился, хотя `minDamageToWin` доказывает, что он
  всё ещё требует ровно 1 неизбежный урон даже при новом (0-damage) входе в него — см. FOUND ниже и
  EXP-010b-REPORT.md §6.

## Можно менять

- `spikes/arrow-core/**` (расширено обратно совместимо: старый `boss`-путь не переписан, только
  перемещён в отдельный метод; ни один старый encounter/test не удалён)
- эта карточка

## Не менять

- `docs/**`, `research/**`, корневые `tools/**`, `.orchestra/*` кроме этой карточки
- не делать: items/Bow/weapons/relics/economy/ads/rewards/Act I/art/Phaser/production rewrite,
  procedural encounter generation, новый targeting UI для нескольких врагов на одной стороне, caster
  archetype, скрытый ребаланс E5/boss без решения пользователя, большой рефакторинг ради красоты

## Готово, если

- [x] `npm run typecheck` и `npm test` зелёные (93/93: 78 старых не сломаны + 15 новых
      multi-enemy тестов + 1 переписанный старый EXP-010 тест под новую реальность E4);
- [x] `enemies[]` поддерживает независимые HP/timer на несколько врагов одновременно, kill одного
      не глушит другого, оба могут атаковать в один ход, board-clear-alive работает и при живых
      mandatory врагах;
- [x] E4 (seed 10) существует, `minDamageToWin = 0` доказано, ручной wrong-priority путь реально
      наносит 2 урона именно от того врага, чей таймер истёк;
- [x] E1/E2/E3/E5 не изменились (те же файлы, тот же движок boss-режима);
- [x] `viewer/cp-prologue.html` показывает нескольких врагов одновременно (своя HP-плашка, свой
      ATTACK IN N, своя позиция, своё dead-состояние), проверено вручную в браузере на чистом и на
      ошибочном пути E4, и полным прогоном E1→E5;
- [x] FOUND по E5 зафиксирован, не скрыт и не тихо исправлен.

## Проверить

```
cd spikes/arrow-core
npm ci
npm run typecheck
npm test
npm run build
npm run cli -- encounter encounters/cp-e4.json --player-hp 10
npm run cli -- encounter encounters/cp-e5.json --player-hp 10
node tools/serve.mjs 5180   # или любой свободный порт
# http://localhost:<port>/viewer/cp-prologue.html
```

## Когда остановиться

Остановиться и поставить `STATUS: BLOCKED`, если:
- нужную точку старта нельзя воспроизвести;
- задача требует выйти за разрешённые рамки;
- нужен более дорогой уровень задачи;
- правила проекта противоречат друг другу.

Ничего из этого не произошло; задача выполнена в разрешённых рамках.

## Итог

RESULT: полный разбор — `spikes/arrow-core/EXP-010b-REPORT.md`. Кратко: добавлен `enemies[]` как
второй, независимый от `boss.phases` режим `EncounterState`; E4 переделан на seed 10 с двумя
одновременными врагами (0-damage clean path, доказано); viewer показывает обоих врагов независимо
с собственными HP/ATTACK IN/dead-состоянием; 93/93 тестов зелёные; E5 не тронут, найденный 1-damage
floor зафиксирован как FOUND, не исправлен без решения пользователя. Main не тронут.

VERIFY: `npm run typecheck`, `npm test` (93/93), `npm run build`, CLI validator для cp-e4/cp-e5,
живой прогон E1→E5 в browser preview (порт 5181, локальный, не влияет на другие сессии).

FOUND:
1. `cp-e5.json` (seed 1571 mini-boss) доказанно требует минимум 1 неизбежный урон
   (`minDamageToWin.minDamage = 1`), даже после того как E4 перестал форсировать 6 урона и игрок
   входит в E5 с полным HP. Причина — таймингом: phase 2 (`ATTACK IN 3`) не даёт достаточно ходов
   на 5 попаданий сразу после смены фазы на этой конкретной доске. Варианты минимальной правки (не
   применены): interval 3→4; "свежее окно" пропускает не только сброс интервала, но и первый тик;
   hpUnits phase2 5→4; либо принять 1 урон как осознанное решение дизайна. Требует явного решения
   пользователя — не исправлено самостоятельно.
2. `tools/cp-shortlist.ts` (seed-scanning) по-прежнему понимает только одиночную `boss`-цель; для
   E4 сканирование не потребовалось (seed задан вручную в брифе), но если в будущем понадобится
   shortlist для multi-enemy encounter — это отдельная небольшая доработка инструмента.
3. Отладочный `cpDebug.jumpTo()` / выпадающий список seed-кандидатов сбрасывают HP до максимума
   при прыжке между encounter — то же самое ограничение, что было у `RunState.debugJumpTo` в
   EXP-010; не влияет на настоящее прохождение, только на debug/тестирование.
