# TASK: BUILD-035 — Projectile Flight v1

STATUS: READY
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
