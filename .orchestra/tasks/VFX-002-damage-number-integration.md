# TASK: VFX-002 — Integrate damage number into the real game (first of 10 lab effects)

STATUS: READY
TYPE: BUILD
SIZE: S/M
AGENT:
BASE_BRANCH: main
BRANCH: build/VFX-002-damage-number-integration
START_SHA: 75f2befd95928e6ee2ffe62cf56dd6736722b52c
RESULT_SHA:

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

- [ ] при попадании стрелы по цели над целью всплывает цифра реального урона (light-hit визуал:
      значения близкие к `dmgDur:620, dmgSize:0.9` из лабы, стиль `light`)
- [ ] появление синхронизировано с `now + FLIGHT_MS` (прилёт снаряда), как и `fx.hitT`, а не с
      моментом тапа
- [ ] число на попапе — настоящий урон по этой цели, не хардкод
- [ ] эффект не ломает существующий impact flash / hit reactions BUILD-035
- [ ] добавление следующего эффекта из лабы явно возможно тем же паттерном (коротко описать в
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

VERIFY:

FOUND:
