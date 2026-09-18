# TASK: VFX-001 — Combat Feel Lab

STATUS: READY
TYPE: EXP/VISUAL
SIZE: M
BASE_BRANCH: main
BRANCH: spike/VFX-001-combat-feel-lab
START_SHA: 42037e739b432c92470af61fc7e985b42f41f789

## Goal

Сделать отдельный визуальный стенд для подбора боевых эффектов и анимаций Arrow-Roguelite.

Сейчас цель НЕ строить общую VFX-архитектуру и НЕ интегрировать эффекты в игру.
Сначала пользователь должен глазами выбрать, какие эффекты вообще нравятся и насколько сильными они должны быть.

## Result

Добавить отдельную страницу:

`viewer/visual-proto/vfx-lab.html`

На ней должны независимо запускаться и настраиваться:

1. projectile trail;
2. impact flash;
3. hit sparks / particles;
4. damage number;
5. enemy hit squash / recoil;
6. короткий visual hit-stop;
7. camera impulse / shake;
8. death burst / poof;
9. boss impact;
10. reward pop.

## Controls

Для эффектов, где это имеет смысл:
- trigger/replay;
- intensity;
- duration;
- scale;
- particle amount;
- несколько понятных presets.

Минимальные presets:
- light hit;
- heavy hit;
- magic hit;
- boss hit;
- kill;
- boss kill;
- blocked tap;
- reward.

Не обязательно делать одинаковый набор слайдеров для каждого эффекта — только реально полезные настройки.

## Visual direction

- fantasy / magical / premium game feel;
- эффекты должны хорошо читаться поверх тёмной fantasy-арены;
- не cyberpunk;
- не превращать экран в постоянный glow/noise;
- эффект должен усиливать действие, а не закрывать board и моба.

Использовать нейтральную arena-like сцену и тестовую цель/моба.
Можно переиспользовать существующие project assets, если это не связывает lab с gameplay state.

## Strict boundaries

- Не менять gameplay.
- Не импортировать и не мутировать EncounterState.
- Не менять enemy timers, cast/interrupt windows, Rotate, damage или board logic.
- Hit-stop только визуальный: presentation/tween time, не simulation time.
- Не менять текущий playable renderer ради lab.
- Не строить сейчас `fx-scheduler`/полную reusable VFX-систему.
- Не интегрировать VIS-014 автоматически.
- Не добавлять звук в этой задаче.
- Не принимать визуальные решения за пользователя.

Если нужен board-space effect, использовать ту же проекцию `board-plane.project()`, а не отдельную несовместимую систему координат.

## Useful existing references in repo

Посмотреть только если это реально помогает:
- `filled-arrow-render.js` / `createHoverFade` — хороший маленький presentation-модуль;
- `filled-arrow-materials.js` — примитивы glow/sparks/sheen;
- `board-renderer.js` — существующие hit/death/attack/interrupt/shot эффекты;
- `spike/VIS-014-arrow-effect-polish` — только как визуальный reference старого magic-effect, не как обязательный код для переноса.

Не начинать с большого рефакторинга этих файлов.

## Verify

- один URL открывает lab;
- все 10 типов эффектов можно запустить отдельно;
- presets реально отличаются;
- controls меняют эффект live;
- нет page errors;
- обычная playable страница не изменилась;
- `npm run typecheck`;
- `npm run build`;
- существующие tests остаются зелёными.

## Delivery

Коротко:
- RESULT
- VERIFY
- FOUND
- SHA
- URL lab

Приложить 3–5 скриншотов/кадров самых удачных вариантов, если инструмент позволяет.

Commit + push этой ветки.
Не merge в main.
Остановиться и ждать пользовательского визуального выбора.
