# TASK: VFX-002 — Integrate damage number into the real game (first of 10 lab effects)

STATUS: DONE
TYPE: BUILD
SIZE: S/M
AGENT: Claude Sonnet 5 (autonomous executor)
BASE_BRANCH: main
BRANCH: build/VFX-002-damage-number-integration
START_SHA: 75f2befd95928e6ee2ffe62cf56dd6736722b52c
RESULT_SHA (code): 69693e7

## Что нужно сделать

Пользователь посмотрел `spike/VFX-001-combat-feel-lab`'s `vfx-lab.html` (10 независимых боевых
эффектов) и выбрал: начать интеграцию в реальную игру с **damage number** (эффект 4 · «popup»
цифры урона над целью), в варианте **light hit** (`dmgValue:12, dmgDur:620, dmgSize:0.9,
dmgKind:'light'` — но реальное число должно быть настоящим уроном хита, не хардкодом 12, см. ниже).

Пользователь прямо сказал: планирует забрать в игру **все 10 эффектов** лабы со временем, по одному
за раз. Поэтому эту первую интеграцию нужно написать так, чтобы эффекты 5–10 (enemy recoil, hit
sparks, hit-stop, camera impulse, death burst, boss impact, reward pop) добавлялись позже **тем же
паттерном**, без переписывания этой задачи. Это не значит строить сейчас общий `fx-scheduler`/
registry заранее — значит не писать этот один эффект так, чтобы его пришлось выкидывать при добавлении следующего.

## Что важно знать

- **Источник эффекта:** `spike/VFX-001-combat-feel-lab`, файл `viewer/visual-proto/vfx-lab.js`:
  - отрисовка: функция `dmg(ctx, it, t)` (около строки 560);
  - спавн/параметры: `FX.dmg(take, A, at, over)` (около строки 764) и light-hit preset (около
    строки 908-919: `dmgValue: 12, dmgDur: 620, dmgSize: 0.9, dmgKind: 'light'`).
  - **Важно:** эта ветка ответвилась от main ДО BUILD-035 (projectile flight), поэтому
    `board-renderer.js` в ней устаревший. Портировать саму отрисовку эффекта (`dmg()`/`FX.dmg()`
    логику текста/анимации), а не пытаться слить файл целиком — интеграция идёт в **текущий**
    `main`-овский `board-renderer.js`, не в lab-овский.
- **Точка интеграции в текущем main:** `spikes/arrow-core/viewer/visual-proto/board-renderer.js`,
  функция `onTapResult()` (около строки 278-297). Там уже есть ровно тот паттерн, который нужно
  повторить для damage number:
  ```js
  const fx = fxFor(targetKey(hitTarget))
  fx.hitT = now + FLIGHT_MS // impact flash syncs with the projectile's arrival, not the tap
  ```
  `fx.hitT` — это уже существующий «arrival-synced» эффект (impact flash), добавленный в BUILD-035.
  Damage number должен планироваться **тем же способом** (`now + FLIGHT_MS`, тот же `fxFor(key)`),
  просто как новое поле на том же `fx`-объекте (например `fx.dmgText = { value, at: now + FLIGHT_MS
  }`) — это и есть тот «легко масштабируемый» паттерн: каждый следующий эффект лабы (recoil, sparks
  и т.д.) добавляется как ещё одно поле на этом же `fx`, а не новая система.
- **Реальное число урона:** найти в `r` (tap result, приходит в `onTapResult(level, id, r,
  targetsBefore)`) фактический нанесённый урон конкретной цели — не копировать placeholder `12` из
  лабы. Если в `r`/`targetsBefore` нет готового числа урона по этой цели, это нужно прокинуть
  из `encounter.ts`/`EncounterState` (см. `spikes/arrow-core/src/encounter.ts`) в результат tap'а —
  не вычислять на глаз в презентационном слое.
- Стиль числа (цвет/размер/style: light/heavy/crit/magic) в этой задаче — только `light`. Другие
  стили под другие ситуации (крит, магия, blocked tap) — не в этой задаче.

## Можно менять

- `board-renderer.js` (новый fx-паттерн для damage number)
- `src/encounter.ts`/`encounter-solver.ts` — **только** если нужно прокинуть реальное число урона
  в результат tap'а и такого поля правда ещё нет (проверить сначала, не добавлять вслепую)
- добавить тесты на новый прокинутый damage-результат, если менялся core

## Не менять

- puzzle/board core логику (generator/solver/topology) — только сам результат tap'а, если там не
  хватает поля с уроном
- существующую projectile flight (BUILD-035) — damage number добавляется рядом с `fx.hitT`, не
  заменяет и не трогает её тайминги
- не начинать эффекты 5-10 из лабы — только damage number
- не строить общий VFX-scheduler/registry/архитектуру заранее — паттерн `fxFor(key).someField`
  уже есть в коде, его достаточно повторить

## Готово, если

- [x] при попадании стрелы по цели над целью всплывает цифра реального урона (light-hit визуал:
      значения близкие к `dmgDur:620, dmgSize:0.9` из лабы, стиль `light`)
- [x] появление синхронизировано с `now + FLIGHT_MS` (прилёт снаряда), как и `fx.hitT`, а не с
      моментом тапа
- [x] число на попапе — настоящий урон по этой цели, не хардкод
- [x] эффект не ломает существующий impact flash / hit reactions BUILD-035
- [x] добавление следующего эффекта из лабы явно возможно тем же паттерном (коротко описать в
      RESULT, как это будет выглядеть для эффекта 5 · enemy recoil, без его реализации)

## Проверить

`npm test`, `npm run typecheck`, `npm run build` в `spikes/arrow-core` — всё зелёное (включая уже
существующие 338 тестов). Ручная проверка в браузере: несколько попаданий подряд в prologue/Act I
энкаунтерах, разные враги/уровни урона, скриншоты до/после.

## Когда остановиться

`STATUS: BLOCKED`, если реального числа урона по цели физически нет нигде в цепочке `tap ->
EncounterState -> onTapResult` и прокинуть его — это более широкое изменение combat-результата,
чем one-line addition. В этом случае описать в `FOUND`, что именно нужно добавить в core, и
остановиться — не гадать число.

## Итог

RESULT:

- `encounter.ts`: `TapResult` gets `hitDamage: number` (real HP removed from the hit target this
  tap, 0 on a miss) — computed from the actual before/after HP in both `tapEnemies` (enemy hp array)
  and `tapBoss` (`this.hp` getter, which is `totalHp - hitCount`), not a hardcoded "1 hit-unit"
  constant. Both are currently always exactly 1 per landed hit (confirmed by the existing invariant),
  but the popup now reads the real delta so it stays correct if that ever changes.
- `board-renderer.js`: `onTapResult` sets `fx.dmgText = { value: r.hitDamage, at: now + FLIGHT_MS }`
  on a hit (same arrival timestamp as `fx.hitT`, so it appears exactly when the projectile lands, not
  on tap). `drawTarget` draws it in the target's own local transform (same block as the existing
  "CAST INTERRUPTED" burst): pop-in with overshoot (`easeOutBack`), rise (`easeOutCubic`), fade in the
  back 38% (`smoothstep`), ported from spike/VFX-001-combat-feel-lab's `dmg()`/`FX.dmg` light-hit
  preset (`DMG_MS = 620`, size baseline `charCell * 0.34 * 0.9` ≈ lab's `dmgSize: 0.9`). Offset to the
  upper-right of the head (`charW * 0.28`, `-charH/2`) so it never sits under the HUD plate. Added to
  the `animating` loop-keepalive check next to the other one-shot fx timers.
- Effect 5 (enemy recoil) would reuse the exact same pattern: `onTapResult` sets e.g.
  `fx.recoil = { at: now + FLIGHT_MS, dir: ... }` on the same `fx` object, and `drawTarget` reads it
  in its existing shake/lunge offset block (`ox`/`oy`, right next to `fx.hitT`'s shake) — no new
  system, no scheduler, just one more field.

VERIFY:

- `npm test` / `npm run typecheck` / `npm run build` in `spikes/arrow-core`: all green — 343 tests
  passing (338 pre-existing + 5 new in `test/vfx-002-damage-number.test.ts`, covering `hitDamage` for
  a landed hit / a miss / a blocked tap in both boss mode and enemies mode).
- Browser (dev server on the compiled `dist/`, `viewer/visual-proto/index.html`): Пролог 4 (`cp-e4`,
  two simultaneous wolves) — 4 consecutive real hits via `window.visualDebug.tap(id)`, each showing a
  "1" popup rising/fading over the hit wolf only (confirmed with screenshots at ~500-600ms after each
  tap, matching the `now+FLIGHT_MS` arrival sync); 2 blocked taps in the same run correctly produced
  no popup. A hit that killed the second wolf played its death-fade normally, undisturbed by the new
  fx field. Also checked the default boss scene (`prologue-5x5`, 1-hit-unit target) and Пролог 5
  (`cp-e5`, Goblin Shaman, hp 9) — hits landed and popped a number; both hp/isBoss branches exercised.
  No new console/page errors from this change (the run had pre-existing unrelated 404s from missing
  creature-pose-editor art assets, unrelated to this task).

FOUND:

- Pre-existing, unrelated: some creature art variants 404 in the browser console on this branch's
  base (missing files under the external `MAGICARROW_CREATURES_DIR`/asset catalog, not touched by
  this task) — not fixed here, out of scope.

VERIFY:

FOUND:
