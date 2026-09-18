# TASK: VFX-001 — Combat Feel Lab

STATUS: DONE
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

## RESULT

`viewer/visual-proto/vfx-lab.html` (+ `vfx-lab.css`, `vfx-lab.js`, 1973 строки) — самостоятельный
стенд на одном URL. Игровое ядро и playable-страница не тронуты (в diff ровно 3 новых файла).

Что на стенде:

- **10 эффектов** запускаются независимо, у каждого свой `trigger` и только полезные ему контролы:
  projectile trail, impact flash, hit sparks, damage number, enemy recoil/squash, visual hit-stop,
  camera impulse, death burst/poof, boss impact (shockwave + dust), reward pop.
- **8 presets** (light hit / heavy hit / magic hit / boss hit / kill / boss kill / blocked tap /
  reward) — каждый задаёт цельную связку значений и тайминги цепочки; удар привязан к прилёту
  снаряда, так что длительность trail двигает весь момент попадания.
- **Take-контролы:** target spot (top/left/right/boss — actor всегда ВНЕ поля, снаряд летит от
  соответствующего края доски), preview speed (0.25/0.5/1x), replay/pause, `freeze at` (скраб —
  стоп-кадр в любой точке), `frame URL`, `PNG` (сохранить кадр), toggle time bars.
- **Time bars** оставлены: real vs display время + красная метка hit-stop окна. Именно они
  превращают hit-stop из «ощущения» в измеримую величину (например 60ms @ 0.10x).
- **Hit-stop** — исключительно display-time warp (`timeWarp(tRaw, hs)`): анимации замирают, камера
  продолжает двигаться. Симуляционное время не существует в lab вообще.
- Тонирование спрайта сделано `source-atop` внутри offscreen-буфера (урок BUILD-020 — никакой
  белый прямоугольник поверх силуэта), dissolve — `destination-out` в том же буфере.
- Ассеты переиспользованы как reference: арена `arena-moonlit-fortress.png`, small-goblin /
  goblin-shaman idle. Board-space часть эффектов — через `board-plane.project()`.

## VERIFY

- `npm run typecheck` — 0; `npm run build` — 0; `npm test` — **321 passed (27 files)**.
- Browser (headless Chrome, localhost serve): страница открывается по одному URL, консоль чистая
  (`--enable-logging=stderr`, 0 Uncaught/TypeError).
- Все 10 карточек проверены через `?card=<id>&at=` — каждая собирает свой take (1–4 эффекта);
  `card=boss` сам переключает spot на boss.
- Все 8 presets проверены через `?preset=<id>` — take собирается, значения применяются в панель.
- Deep-link `?preset=heavy-hit&at=300` открывается в `frozen @ 300ms`; real 300ms / display 246ms —
  расхождение ровно на съеденное hit-stop время, т.е. time-warp считается корректно.
- Пиксельная проба (яркостная статистика по кадрам, 194px downscale): baseline 15 ярких пикселей →
  trail@80ms 45 (в коридоре полёта 30) → impact@160ms 54 → damage@200ms 59 → после@340ms 14
  (вернулись к baseline). Эффекты появляются в нужном месте, в нужное время и убираются за собой.
- Playable-страница не изменилась: в diff ветки нет `index.html`/`app.js`/`board-renderer.js`.
- Кадры для просмотра: `artifacts/vfx-001/*.png` (4 шт, gitignored, локально).

## FOUND

- `stageSize()` обязан читаться из layout, а не из `canvas.width/height`: до первого кадра там
  лежат дефолтные 300x150, и take, собранный до первой отрисовки (любой deep-link), запекает
  координаты в неправильном пространстве — эффекты рисовались в левом верхнем углу, а спрайт на
  месте. Исправлено чтением `getBoundingClientRect` + `autoHeal` (пересборка того же take после
  первой отрисовки, только для нетронутого deep-link состояния).
- У `heavy-hit` и др. при t < tint.at множитель `clamp01(1 - (t-at)/dur)` даёт 1 → спрайт на мгновение
  заливается белым полностью. Сейчас это выглядит как вспышка на попадании; если не понравится —
  это один clamp в `drawTarget`, вынести в решение пользователя.
- CLI-скриншоты Chrome в PowerShell теряют `&` в URL — для проверки использован обходной путь
  (одиночный query-параметр / dump-dom). На сам lab не влияет: в браузере deep-link работает.

## SHA

Code: `eadd067` (spike/VFX-001-combat-feel-lab)

## URL lab

`http://localhost:5177/viewer/visual-proto/vfx-lab.html` (или порт любого запуска
`npm run viewer` в `spikes/arrow-core`; примеры кадров:
`.../vfx-lab.html?preset=heavy-hit&at=130`, `?preset=boss-kill&spot=boss&at=430`,
`?card=trail&at=100`)
