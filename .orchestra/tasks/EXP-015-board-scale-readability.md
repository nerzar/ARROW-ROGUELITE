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

## What to evaluate

На текущем visual prototype / screenshots / доступном debug viewer исследовать минимум:

- easy 6x7 and rotated 7x6;
- medium 8x10 and rotated 10x8;
- hard 10x12 and rotated 12x10;
- 12x14 / 14x12 если генератор позволяет;
- 16x16;
- 20x20;
- 24x24 как верхний технический предел.

Если часть размеров не поддерживается preset'ами, можно использовать debug/research-only generated boards без изменения production content.

## Metrics

Для каждого размера записать:

- approximate cell/puzzle segment size на 1920x1080;
- approximate size на 1366x768;
- можно ли различать отдельные длинные стрелы;
- удобно ли кликать мышью;
- остаются ли arrowheads/turns читаемыми;
- насколько плотным становится field;
- как выглядит после Rotate;
- сколько визуального шума;
- подходит ли размер для обычного encounter / boss / только late-game.

Отдельно оценить не только клетки, а наши длинные path-arrows: где они начинают сливаться в лапшу.

## Output

Создать:

`docs/EXP-015-BOARD-SCALE-READABILITY.md`

В документе нужна простая матрица:

BOARD SIZE | 1920 | 1366 | READABILITY | CLICKABILITY | VISUAL VALUE | USE

И три порога:

- SAFE DEFAULT RANGE;
- LARGE BUT GOOD;
- TECHNICALLY POSSIBLE BUT BAD.

Не выбирать окончательный production maximum без пользователя.

## Screenshots

Если возможно, сделать screenshots нескольких representative размеров:

- 6x7;
- 10x12;
- 16x16;
- 24x24;
- один rotated rectangular board.

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
