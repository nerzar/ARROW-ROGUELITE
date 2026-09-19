# TASK: VFX-003 — Complete the light-hit feel (flash + sparks + squash + camera impulse)

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT:
BASE_BRANCH: main
BRANCH: build/VFX-003-light-hit-feel
START_SHA: 31657c9114d77c119f43de4010096f362ff6d2f6
RESULT_SHA:

## Что нужно сделать

Пользователь попросил "light hit" как первый эффект из `spike/VFX-001-combat-feel-lab`'s `vfx-lab.html`.
VFX-002 (уже в main) реализовал из него только всплывающую цифру урона. Это было **сужение
скоупа техлидом, не то, что просил пользователь** — в лабе пресет `light hit` это связка сразу
из семи эффектов: `trail + flash + sparks + tint + squash + dmg + camera` (см.
`vfx-lab.js`, функция `build()` пресета `light-hit`, строки ~905-921). `trail` уже есть отдельно
(BUILD-035, projectile flight) и `dmg` уже есть (VFX-002). Эта задача добирает недостающие:
**flash, sparks, squash/recoil, camera impulse** — то есть, собственно, "ощущение удара",
которого пользователю не хватило.

## Что важно знать

- **Источник в лабе** (`spike/VFX-001-combat-feel-lab`, `viewer/visual-proto/vfx-lab.js`):
  - light-hit preset params (строки ~905-911):
    ```js
    flashDur: 200, flashScale: 0.85,
    sparkCount: 14, sparkDur: 420, sparkSpread: 0.85,
    sqRecoil: 7, sqSquash: 0.10, sqDur: 260,
    camAmp: 2, camDur: 200, camFreq: 24,
    ```
  - build-последовательность (строка ~912-921): `t0 = trailDur * 0.5` (~100ms), затем
    `flash@t0`, `sparks@t0`, `tint@t0`, `squash@t0`, `camera@t0` — все синхронно в один момент
    удара, не вразнобой.
  - отрисовка: `flash(ctx, it, t)` ~строка 510, `sparks(ctx, it, t)` ~534, `squash(ctx, it, t, A)`
    ~595, `camera(take, A, at, over)` ~802 (camera — **не per-target рисование, а world-transform**,
    см. комментарий "Camera impulse: pure function of REAL time" ~строка 171 и "everything inside
    this transform is the world" ~1374 — сдвигает всю сцену, не одну цель, и НЕ должен трогать HUD
    (~1382: "HUD-ish overlays are NOT shaken").
  - Эта ветка (VFX-001) ответвилась ДО BUILD-035 — портировать саму логику эффектов, не файл
    целиком; интеграция идёт в текущий `main`-овский `board-renderer.js`.
- **Точка интеграции и то, что уже есть в main** (`spikes/arrow-core/viewer/visual-proto/board-renderer.js`):
  - `onTapResult()` уже планирует `fx.hitT = now + FLIGHT_MS` (~строка 301) и `fx.dmgText` (~306) —
    тот же `fxFor(key)` паттерн, что и раньше, продолжать его же.
  - Уже есть ПРОСТОЙ вариант flash+shake на этом же `fx.hitT`: `shake` ~строка 563 (±3px синус,
    200ms), `flashWhite` ~строка 702, применяется ~744. Это не дублировать — **заменить/обогатить**
    под значения из лабы (flashScale, а не голая заливка), не городить вторую параллельную систему
    поверх той же точки синхронизации.
  - `sparks` (частицы) и `squash` (recoil/сжатие спрайта цели) — новые поля на `fx` объекте, тем же
    паттерном, что `fx.dmgText`.
  - `camera impulse` — новое: лёгкий global offset всей сцены на время `camAmp/camDur/camFreq`,
    приложенный вокруг всего рендера, но НЕ к HUD/plate (см. предостережение из лабы выше).

## Можно менять

- `board-renderer.js` (расширение существующего `fx`-паттерна: flash/sparks/squash обогащаются
  или добавляются per-target; camera impulse — новый лёгкий global transform)
- добавить тесты на новые тайминги/state, если добавляется проверяемая логика (не визуал)

## Не менять

- puzzle/board core, damage/timers/combat-логику — это чисто presentation
- существующий `fx.dmgText` (VFX-002) и projectile flight (BUILD-035) тайминги — новые эффекты
  синхронизируются на тот же `fx.hitT`/`now + FLIGHT_MS`, не создают свой источник времени
- HUD/plate — camera impulse не должен их двигать
- остальные пресеты лабы (heavy hit, magic hit, boss hit, kill, boss kill, blocked tap, reward) —
  не в этой задаче, следующие по очереди

## Готово, если

- [ ] flash при попадании визуально ближе к лабовому (масштаб/цвет по `flashScale`/аналогу), не голая заливка
- [ ] sparks (частицы) появляются в месте попадания, количество/разброс близко к `sparkCount`/`sparkSpread`
- [ ] squash/recoil — цель заметно сжимается/дёргается при попадании (`sqSquash`/`sqRecoil`/`sqDur`)
- [ ] camera impulse — вся сцена (кроме HUD) слегка трясётся на попадании, синхронно с остальными
- [ ] всё привязано к тому же `fx.hitT`/`FLIGHT_MS` моменту, что и `dmgText` — не рассинхронизировано
- [ ] существующие тесты (353 на момент постановки) не сломаны

## Проверить

`npm test`, `npm run typecheck`, `npm run build` в `spikes/arrow-core`. Ручная проверка в браузере:
несколько попаданий подряд на `cp-e4` (два врага), скриншоты/кадры до-в момент-после удара.

## Когда остановиться

`STATUS: BLOCKED`, если camera impulse (world-transform) невозможно добавить без риска задеть HUD
или board-projection математику — тогда описать в `FOUND` минимально нужное изменение и вариант
без camera (flash+sparks+squash всё равно самостоятельно ценны), не гадать с матрицами трансформации.

## Итог

RESULT:

VERIFY:

FOUND:
