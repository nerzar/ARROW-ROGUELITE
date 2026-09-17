# TASK: EXP-015 — Board Scale / Readability Matrix

STATUS: DONE
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

## RESULT

- Проведено исследование масштабирования и читаемости полей (Square-First Policy с compatibility appendix для прямоугольников) в 16:9 композиции Moonlit Fortress (`arena-moonlit-fortress.png`, 1672x941) на 1920x1080 (1080p Desktop) и 1366x768 (768p Laptop / VK default).
- Создан канонический отчёт с матрицей и аналитикой в `docs/EXP-015-BOARD-SCALE-READABILITY.md`.
- Ответ на главный вопрос (какой квадратный диапазон даёт лучший баланс):
  * **BEST EARLY RANGE: `6x6` — `7x7`** (cell 46–65 px, идеальная ясность механики, 8–12 стрел, нулевой когнитивный шум, отличный старт для туториала/пролога).
  * **SAFE DEFAULT RANGE: `8x8` — `9x9` — `10x10` (ЗОЛОТАЯ СЕРЕДИНА)**: 14–19 стрел, пути средней длины 4.1–4.9 клеток с 1–2 чистыми поворотами, наконечники 11.6–20.4 px, кликабельная зона >= 27.6 px на 768p, идеальная симметрия в каменном постаменте, естественный поворот 90° без изменения габаритов.
  * **LARGE BUT GOOD: `12x12`**: тактический лабиринт на 22–24 стрелы (длина до 12 клеток), высокая плотность, подходит для элит, 3–4 мобов и полуфиналов.
  * **BOSS / SPECIAL ONLY: `14x14` / `16x16`**: 28–32 стрелы, длина до 16 клеток. Вход в зону лапши, мобы сжимаются, на 768p клетка падает до 17.3 px. Строго для кульминационных боссов актов.
  * **TECHNICALLY POSSIBLE BUT BAD: `20x20` и `24x24`**: визуальная каша (313 контактов параллельных линий), наконечники 4.8 px на 768p не читаются, свечение заливает соседние пути, клики 11.5 px ведут к штрафам по HP, босс съёживается до 74 px. Непригодно для боевого геймплея.
- Compatibility appendix:
  * Прямоугольники `6x7`/`7x6`, `8x10`/`10x8`, `10x12`/`12x10` технически стабильны (cell инвариантен к повороту), но уступают квадратам в симметрии заполнения центрального каменного колодца арены.
- Сгенерированы и визуально проверены скриншоты в сессионном каталоге (`scratch/`):
  * `shot_6x6_1080p.png` & `shot_6x6_768p.png` (монументальный Early)
  * `shot_8x8_1080p.png` & `shot_8x8_768p.png` (чистый боевой энкаунтер)
  * `shot_10x10_1080p.png` & `shot_10x10_768p.png` (Sweetspot: длинные пути, идеальная читаемость)
  * `shot_16x16_1080p.png` & `shot_16x16_768p.png` (Boss special, высокая плотность)
  * `shot_24x24_1080p.png` & `shot_24x24_768p.png` (Stress case: визуальная лапша / PCB)
  * `shot_10x8_compat_1080p.png` & `shot_10x8_compat_768p.png` (прямоугольный compatibility-кейс)

## VERIFY

1. `spikes/arrow-core`:
   - `npm run typecheck` — 0 errors (clean).
   - `npm test` — 18 test files, 217 passed (100%).
   - `npm run build` — compiled without warnings.
2. Property & generator checks:
   - Проверена генерация сеток 6x6, 7x7, 8x8, 9x9, 10x10, 12x12, 16x16, 20x20, 24x24 across seeds 1..10.
   - Solvability и топологические инварианты всех сгенерированных уровней подтверждены ядром `generator.ts` и `verifyLevel`.
3. Headless Chrome visual checks:
   - 12 полноэкранных скриншотов сгенерированы на 1920x1080 и 1366x768 в реальной компоновке с фоном `arena-moonlit-fortress.png` и проверены через мультимодальный визуальный осмотр.

## FOUND

1. **Жёсткая связь размера персонажей с размером клетки поля:**
   В `arena-layout.js` габариты босса (`BOSS_CHAR = 6.4`) и мобов (`SIDE_CHAR = 6.0`) умножаются на `cell`. При больших досках (16x16, 24x24) клетка сжимается, и персонажи на подиумах уменьшаются со 355 px до 74 px, что выглядит неестественно на фоне постоянного размера подиумов арены.
   *Рекомендация для будущих задач:* отвязать габариты внешних персонажей от `cell`, привязав их к высоте сцены (`stageH`) или фиксированным габаритам подиумов.
2. **Световое загрязнение (Glow overlap) при мелкой клетке:**
   В `board-renderer.js` свечение нацеленной стрелы имеет `shadowBlur = 16px`, свободной — `9px`. На сетках >= 16x16 (где на 768p cell <= 17.3 px), радиус свечения превышает зазор между соседними путями (12.6 px), подсвечивая параллельные заблокированные стрелы.
3. **Tween Rotate диагональ квадрата:**
   При повороте квадратной доски 10x10 диагональ во время вращения достигает ~550 px на 1080p, проходя в непосредственной близости от ног босса ($y = 0.445$). Фиксированная каменная плита (FIX-021 / ART-003), внутри которой вращается только puzzle-слой, предотвратит визуальное касание персонажей.
