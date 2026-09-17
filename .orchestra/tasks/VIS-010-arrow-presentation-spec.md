# TASK: VIS-010 — Arrow Presentation Spec

STATUS: READY
TYPE: DESIGN
SIZE: S
AGENT: Muse / visual design
BASE_BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
BRANCH: design/VIS-010-arrow-presentation-spec
START_SHA: 5d5730a831db197f532e56bf66018902fa7c4042

## Goal

Зафиксировать визуальный язык стрел — core mechanic Magic Arrow — до следующего renderer pass.

Текущий continuous glow-line вид пользователем не принят: стрелки читаются плохо и выглядят как наложение поверх сцены.

Нужен конкретный spec/reference, НЕ runtime implementation.

## Required states

Для одного и того же arrow path показать/описать:

- blocked/inactive;
- free/clickable;
- hover/selected;
- attack-ready/targeting;
- firing/shot travel;
- hit/impact;
- disabled/dead/removing;
- Stone Pin blocked state.

## Visual requirements

- стрелка должна казаться встроенной/магически выгравированной в камень;
- перспектива поверхности сохраняется;
- направление читается моментально;
- длинные paths остаются красивыми, не превращаются в жирную светящуюся лапшу;
- arrowhead читается отдельно от линии;
- free и blocked различаются без текста;
- эффекты не закрывают соседние paths.

Исследовать 2–3 визуальных языка максимум, например:
- segmented glowing rail;
- engraved magical groove + flowing pulse;
- solid core + sparse luminous direction markers.

Не делать 20 вариантов.

## Output

`docs/VIS-010-ARROW-PRESENTATION.md`

Для каждого варианта:
- line construction;
- arrowhead;
- colors/intensity by state;
- perspective scaling rule;
- animation idea;
- pros/risks;
- recommendation FOR PLAYTEST, not final user approval.

Если возможно, сделать простой contact/mockup поверх одного screenshot/board reference, не меняя runtime renderer.

## Do not

- не менять `board-renderer.js`;
- не менять gameplay;
- не менять board projection;
- не объявлять вариант принятым;
- не merge main.

## Delivery

RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.

## RESULT

- `docs/VIS-010-ARROW-PRESENTATION.md` (new): visual spec, 3 визуальных языка
  (A Segmented Rail, B Engraved Groove + running pulse, C Solid Core + sparse
  markers), каждый в 8 состояниях (blocked / free / hover-selected /
  targeting / firing / hit / dead-removing / Stone Pin) на одном длинном path.
  Общий инвариант: залитый кайт-наконечник 0.55S x 0.62S, коридор эффектов
  +-0.55S от оси, ноль shadowBlur вдоль тела, каменная палитра, free/blocked
  различаются без текста. Правила сочетаний, сравнение, recommendation FOR
  PLAYTEST (primary B, fallback C; вариант принятым не объявляется).
- `docs/VIS-010-contact-sheet.html` (new, ~14 КБ, без сборки/зависимостей):
  сетка 3x8, все 24 ячейки рендерятся из одного master S-path, hover/pulse —
  SMIL animateMotion.
- `board-renderer.js`, gameplay, board projection не тронуты.

## VERIFY

- `node --check` извлечённого script contact sheet — SYNTAX OK.
- Статическая проверка: 8 ключей состояний x 3 вхождения (A/B/C), один master
  path (`master.getAttribute('d')`, все ячейки строятся из него).
- `git diff --stat`: только 2 новых docs + эта карточка.
- Contact sheet открывается в браузере напрямую (file://), сетка 3x8.
- Push fast-forward на `origin/design/VIS-010-arrow-presentation-spec`,
  `origin/... == RESULT_SHA` (см. ниже).

## FOUND

- Локальная ветка была сначала создана от неверной базы (c186505,
  tool/CAL-001) — remote-ветка уже существовала с официальной карточкой
  9412f03 (BASE fix/FIX-023..., START 5d5730a). Работа пересажена на
  `origin/design/VIS-010-arrow-presentation-spec` (reset --soft, replay только
  своих файлов); чужие staged-изменения в общем checkout
  (ARENA-TEMPLATE-001/CAL-001) не тронуты и в commit'ы VIS-010 не включены
  (коммиты path-limited `-- <files>`). Параллельным агентам нужен отдельный
  worktree (риск уже отмечен в BOARD.md).
- `docs/COMBAT-RULES.md` в репозитории отсутствует; семантика Stone Pin взята
  из EXP-013-REPORT.md и `src/encounter.ts:isPinned` (untappable no-op без
  HP-стоимости).

## RESULT_SHA

`PENDING_PUSH`

## STATUS

`DONE` ставится только после push + remote verify (см. Delivery).
