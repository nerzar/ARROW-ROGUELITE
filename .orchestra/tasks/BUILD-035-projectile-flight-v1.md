# TASK: BUILD-035 — Projectile Flight v1

STATUS: DONE
TYPE: BUILD
SIZE: M
BASE_BRANCH: main
BRANCH: build/BUILD-035-projectile-flight-v1
START_SHA: 84348adc95d4b056d221d67221b91e29d9e1565a

## Goal

Сделать визуальный полёт выпущенной стрелы убедительнее:

1. сначала стрела летит по своему исходному направлению выхода из board;
2. затем плавно доворачивает к hit-anchor выбранной текущей цели;
3. попадание заканчивается в том же target/hit-anchor, который уже использует текущий combat flow.

## Важно

- Не менять target selection.
- Не менять damage, HP, enemy timers, cast/interrupt, Rotate, solver или другие gameplay rules.
- Projectile flight — presentation-only.
- Не менять сам filled-arrow renderer на board.
- Траектория должна быть устроена так, чтобы позже её можно было расширить под Ricochet/Piercing, но сейчас эти механики НЕ реализовывать.
- Использовать существующие arena/effect anchors и projection/calibration path; не заводить вторую систему координат.
- VFX-001 может идти параллельно, но BUILD-035 не должен зависеть от незавершённого VFX Lab.

## Expected feel

Не homing missile с мгновенным поворотом.
Стрела должна сначала подтвердить игроку направление, в котором она вышла из puzzle, а потом мягко довернуть к цели.

## Verify

Проверить в браузере минимум:
- вылеты во все используемые стороны board;
- обычного моба;
- boss target;
- разные arena calibration;
- projectile заканчивается на правильном hit-anchor;
- damage/combat результат до и после BUILD-035 одинаковый;
- нет page errors;
- tests + typecheck + build.

## Delivery

Коротко:
- RESULT
- VERIFY
- FOUND
- SHA
- URL для ручной проверки

Commit + push. Не merge в main.

## RESULT

- Новый pure-модуль `viewer/visual-proto/projectile-flight.js` (+ `.d.ts`): `flightPoint(t, {from, dir, target, straightLen})` — 35% straight по exit-направлению, затем quadratic bezier с control на exit-луче (C1-непрерывность, smootherstep), голова ориентируется по касательной. Промах летит прямо и гаснет. Точка расширения под Ricochet/Piercing — чейн спека на цель, без смены контракта.
- `board-renderer.js`: `targetAnchors` (body-center, пересборка каждый кадр), `onTapResult` резолвит anchor + синкает `hitT/interruptT` на `FLIGHT_MS=520` (было захардкожено 220); `drawShot` рисует снаряд (glow trail + shaft + filled kite) вдоль heading; кулл шотов `420 -> FLIGHT_MS` (снаряд гас на подлёте — баг).
- Снаряд самосветящийся в обеих темах (hit — vivid amber, miss — тихий gray).
- Engine, damage, filled-arrow board renderer не тронуты. Debug hooks `debugShots/debugAnchors` + `visualDebug.shots/anchors` (QA-only, как `debugLayout`).
- Round 2 (accepted): разгон после вылета (phase A t^2.2, phase B fast-start/soft-landing вместо smootherstep — был stall на стыке), speed-based squash/stretch фигуры (speed в px/ms из модуля, thin до 0.45 / stretch до 1.8).

## VERIFY

- tests 28 файлов / 331 OK (новый `build-035-projectile-flight.test.ts`, 10 тестов); typecheck OK; build OK.
- Browser: E/N-хиты, S/W-мимо, boss cp-e5, baked calibration (`boss-shadow-moon` + cp-e4), A/B cp-e4/cp-e5 старый vs новый код — combat-исходы побайтово одинаковы; pageerrors 0; calibration editor чисто.
- Пиксельная проверка: ~1970 amber-пикселей в точке снаряда в обеих темах (было ~19 в light).

## FOUND

- База ветки 49871b9 вместо START_SHA 84348ad: дельта — только orchestra-доки, кода не касается; оставлена как есть.
- Headless Chromium — light-палитра: старый серый streak тонул в светлом камне; поэтому хит-снаряд теперь emissive всегда.
- Hit-anchor = body-center цели (slot+idle), не effectGround podium: стрела бьёт в моба, а не в пол. Effect anchor остался у telegraph/vfx.
- TODO будущим: чейн спека для Ricochet (модуль готов), trail подлиннее при желании после глаз пользователя.
