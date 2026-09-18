# TASK: LD-006 — Act I encounter shortlist (design only, no implementation)

STATUS: READY
TYPE: EXP
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: design/LD-006-act1-encounter-shortlist
START_SHA: 49871b904cd4adfa7ee7d1da89e3f1d5f1129966
RESULT_SHA:

## Что нужно сделать

Следуя роли `.orchestra/LEVEL-DESIGNER.md` целиком, подготовить shortlist 5–10 кандидатов board seed'ов для следующих Act I encounter'ов, идущих после уже существующих `act1-e1.json`/`act1-e2.json`/`act1-e3.json`, с черновой раскладкой врагов/способностей. Это **не финальный дизайн и не implementation** — только сырьё в формате `.orchestra/LEVEL-DESIGNER.md` §4, которое пользователь потом курирует и дорабатывает сам.

## Что важно знать

- Процесс и обязательный формат каждого кандидата — `.orchestra/LEVEL-DESIGNER.md`, разделы 3–5. Следовать буквально, не сокращать формат.
- Что уже есть в Act I: `spikes/arrow-core/encounters/act1-e1.json`, `act1-e2.json`, `act1-e3.json` — новый shortlist продолжает эту прогрессию, не повторяет и не переделывает их.
- Дуга Act I по дизайну — `docs/GAME-CONCEPT.md:272`: две стороны → третья сторона/temporary reward target → directional elite → Boss I → награда Ricochet.
- **Важно:** в коде на момент постановки этой задачи реально реализован только Grunt-архетип и одна способность (`stone_throw`/pin) — см. `docs/IMPLEMENTATION-STATUS.md`. Если к моменту выполнения этой задачи `RUN-002-enemy-ability-framework` ещё не сделан, раскладку строить только на том, что реально есть в коде прямо сейчас, а не на полном списке архетипов из `docs/CONTENT-SYSTEM.md`. Архетипы, которых ещё нет в движке, отметить отдельно как "ждёт RUN-002", не выдумывать их поведение.
- Первый контент делаем на отобранных seed'ах, не на автогенерации по квотам — см. `.orchestra/NOTES.md` N-018 и N-021 (пример осознанного выбора seed под конкретный обучающий момент).

## Можно менять

- ничего в production-файлах — весь результат оформляется как приложение к этому task-файлу (например `LD-006-shortlist.md` рядом), production `encounters/*.json` не трогать

## Не менять

- существующие encounters (`act1-e1/e2/e3.json` и prologue)
- puzzle/board core, solver/generator
- ничего в runtime/presentation коде

## Готово, если

- [ ] отсканировано достаточно кандидатов, явно слабые/нечестные отброшены
- [ ] 3–5 лучших разобраны подробно по формату из `LEVEL-DESIGNER.md` §4 (board, combat, fairness, learning/purpose, fun/readability)
- [ ] для каждого из них явно указано «чему учит» и «главный интересный выбор» (раздел Learning/Purpose и Fun/Readability из роли)
- [ ] solvability и минимальный неизбежный урон посчитаны инструментом (analyzer/solver), а не оценены на глаз — если инструмент не умеет посчитать поле, писать `UNKNOWN`, не придумывать
- [ ] рекомендованы 1–2 кандидата, но явно помечено `DESIGN SHORTLIST`, а не `USER APPROVED FOR IMPLEMENTATION` — выбор остаётся за пользователем

## Проверить

Все числовые/solver-поля в каждом кандидате должны быть воспроизводимы через существующий analyzer/EncounterSolver — приложить точную команду или скрипт, которым были получены числа, чтобы пользователь мог перепроверить.

## Когда остановиться

Поставить `STATUS: BLOCKED`, если для приличного shortlist на этом месте прогрессии не хватает механики, которой ещё нет в движке (например Shield-архетип, если RUN-002 ability framework ещё не готов). В этом случае: сделать shortlist только на реально доступных сейчас механиках, явно отметить, какая часть кандидатов ждёт RUN-002, и не придумывать поведение ненаписанной механики.

## Итог

RESULT:

VERIFY:

FOUND:
