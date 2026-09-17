# TASK: EXP-015 — Board Scale / Readability Matrix

STATUS: READY
TYPE: EXP
SIZE: M
AGENT: Gemini 3.8 Flash (level/UI research)
BASE_BRANCH: build/BUILD-020-playable-slice-v01
BRANCH: exp/EXP-015-board-scale-readability
START_SHA: 19429f3f2cbdc96ddd12cd3da4ceb55b04fa623b

## Goal

Понять, какие размеры board реально читаются и удобно кликаются в утверждённой Moonlit Fortress композиции, прежде чем мы начнём строить поздние большие уровни.

Это research/playtest task. Не менять runtime renderer или gameplay.

## Context

FIX-021 параллельно внедряет fixed stone board plane + projected puzzle layer. Frame/stone plate остаются неподвижными, Rotate меняет только внутренний puzzle layer и fit'ит новую ориентацию в тот же plane.

Тебе не нужно реализовывать projection.

## USER ADDENDUM — Square-first policy

Пользователь утвердил текущую контентную политику:

- основной production-content сейчас строим на квадратных boards;
- приоритетная линейка: `6x6`, `7x7`, `8x8`, `9x9`, `10x10`;
- арены также генерируются/компонуются вокруг квадратного board well;
- Rotate на квадратном board — основной визуальный сценарий;
- прямоугольные board не запрещены технически и могут остаться future/special-case, но НЕ должны определять рекомендации по обычному контенту;
- не считать это окончательным production maximum: это AGREED FOR NOW для текущего slice.

Поэтому основной ответ EXP-015 должен быть: какой square range даёт лучший баланс читаемости, плотности, длинных arrow-paths и визуальной выразительности.

## What to evaluate

Основной набор:

- 6x6;
- 7x7;
- 8x8;
- 9x9;
- 10x10;
- 12x12;
- 16x16;
- 20x20;
- 24x24 как технический stress case.

Дополнительно для compatibility, но вторично:

- 6x7 / 7x6;
- 8x10 / 10x8;
- 10x12 / 12x10.

Если часть размеров не поддерживается preset'ами, можно использовать debug/research-only generated boards без изменения production content.

## Metrics

Для каждого размера записать:

- approximate cell/puzzle segment size на 1920x1080;
- approximate size на 1366x768;
- можно ли различать отдельные длинные стрелы;
- удобно ли кликать мышью;
- остаются ли arrowheads/turns читаемыми;
- насколько плотным становится field;
- сколько визуального шума;
- насколько board заполняет stone well эстетично;
- подходит ли размер для ordinary / elite / boss / only late-game.

Отдельно оценить не только клетки, а наши длинные path-arrows: где они начинают сливаться в лапшу.

Для square boards отдельно отметить:
- насколько естественно смотрится Rotate;
- не возникает ли ощущения пустоты на маленьких boards;
- с какого размера появляется ощущение "богатой" большой головоломки без потери читаемости.

## Output

Создать:

`docs/EXP-015-BOARD-SCALE-READABILITY.md`

В документе нужна простая матрица:

BOARD SIZE | 1920 | 1366 | READABILITY | CLICKABILITY | VISUAL VALUE | USE

И пороги именно для square-first:

- BEST EARLY RANGE;
- SAFE DEFAULT RANGE;
- LARGE BUT GOOD;
- BOSS / SPECIAL ONLY;
- TECHNICALLY POSSIBLE BUT BAD.

Прямоугольники вынести в короткий compatibility appendix.

Не выбирать окончательный production maximum без пользователя.

## Screenshots

Если возможно, сделать representative screenshots:

- 6x6;
- 8x8;
- 10x10;
- 16x16;
- 24x24;
- один rectangular compatibility case.

Можно не коммитить тяжёлые screenshots, но указать paths/observations в task-card.

## No changes

Не менять:

- generator semantics;
- combat;
- renderer/layout;
- board projection;
- Rotate rules;
- encounter content.

Если для исследования нужен маленький временный script/debug command — допустимо, но не превращать его в production feature.

## Delivery

Заполнить RESULT / VERIFY / FOUND.
Commit.
Push `exp/EXP-015-board-scale-readability`.
Проверить remote RESULT_SHA.
Только потом STATUS DONE.

Не merge main.
