# Доска Arrow-Roguelite

BOARD хранит не только одну текущую задачу, а **согласованный ближний план**: что делаем сейчас, что уже READY, что идёт следующим продуктовым шагом и что пользователь явно отложил.

Подробности конкретной READY-задачи живут в её task-card. История выполненного — в Git и `.orchestra/archive/`.

## База

`main` — текущий рабочий playable baseline.

Уже сведены и приняты:
- playable Prologue 5/5;
- Campaign Editor и Pose Editor;
- arena calibration / baked arena loader;
- Goblin King flee intro;
- Goblin Shaman defeat;
- filled-arrow renderer + 15 materials + gallery;
- shared Rotate flow;
- CAL-005: species pivot/scale, HUD offset/scale, shadow offset, editor ↔ runtime parity.

Стрелочный renderer/material трек закончен. Старые BUILD-032/033 и VIS/FIX arrow-эксперименты — история/источники отдельных идей.

## Сейчас / READY

| Task | Статус | Ветка | Смысл |
|---|---|---|---|
| VFX-002 — Damage Number Integration | READY | `build/VFX-002-damage-number-integration` | Первый из 10 эффектов VFX-001-лабы, выбранный пользователем для интеграции в реальную игру: damage number (light hit). Написан так, чтобы эффекты 5-10 добавлялись тем же паттерном (`fxFor(key)`), без отдельного fx-scheduler заранее. |
| UI-001 — Game Shell Cleanup | READY | `fix/UI-001-game-shell-cleanup` | Скрываемый admin/debug UI, убрать кашу в левом верхнем углу, scene dropdown всегда показывает фактически активную runtime scene. Это обычный game-shell fix, не mobile-задача. |
| REF-001 — Browser Combat UI / VFX References | READY | `research/REF-001-browser-combat-ui-vfx-references` | Посмотреть браузерные игры ради HUD animations, hit/damage feedback, cast/attack telegraphs, boss/death/reward presentation и собрать конкретные приёмы для вдохновения. |

Эти задачи независимы по смыслу. Не нужно запускать все одновременно: архитектор выбирает 1–2 дешёвых исполнителя по текущей загрузке, без дублирования одной задачи нескольким агентам.

## Следующий продуктовый слой

Это уже согласованное направление, но карточки создаются только когда предыдущий результат просмотрен и scope понятен.

| Task/направление | Статус | Что именно хотим |
|---|---|---|
| ACT-I-002 — Act I Vertical Slice | PLANNED | Развить уже существующие первые Act I encounters в короткий кусок настоящего акта, который интересно проходить, а не просто технически тестировать. |
| RUN-002 — Roguelite Rewards / Progression | PLANNED | Проверить короткий run: meaningful rewards между боями, расход/ценность Rotate, небольшой понятный набор апгрейдов, желание сделать ещё один забег. |
| VFX integration (остальные 9 эффектов) | WAITING FOR VFX-002 | Пользователь посмотрел лабу VFX-001 и решил забрать все 10 эффектов по одному, начиная с damage number (VFX-002, эффект 4). **Готово отдельно от VFX-002:** базовый hit-flash + shake (~110-200мс) уже есть с BUILD-035 (`fx.hitT`), не путать с полноценным impact flash / hit sparks (эффекты 2 и 3) из лабы — они НЕ интегрированы, ждут своей карточки первыми, не 5-10. Следующие карточки — по одному эффекту за раз, тем же паттерном (`fxFor(key).новое_поле`), после того как VFX-002 принят на плейтесте. |
| AUDIO-001 — Combat Audio | PLANNED LATER | После принятого визуального combat feel: hit/cast/death/reward SFX, без преждевременного большого sound-system. |
| VK production pass | PLANNED LATER | SDK, saves, lifecycle/fullscreen, audio rules, rewarded ads, analytics, слабые устройства — после приятного vertical slice. |

## Согласованное направление run

Не task queue, а продуктовый ориентир, который нельзя потерять:
- Prologue вводит направление как боевой ресурс и уже выдаёт shared Rotate reward;
- Act I развивает multi-side combat и ведёт к boss reward **Ricochet**;
- позже run должен раскрыть **Serpent Form**;
- ещё позже — **Chain**;
- boss rewards должны менять правила/поведение стрел, а не быть только +цифры.

Для Act I пока сохраняем уже выбранный рабочий подход: интересные seed'ы отбираются руками, их direction/turn timeline смотрится отдельно, а encounters скриптуются поверх. Не лезть раньше времени в generic direction quotas / «бесконечную генерацию» только ради универсальности.

Визуальное производство не откладывать «на самый конец»: gameplay/content и нужные для playtest арты/VFX могут двигаться параллельно, но визуальные решения всё равно принимает пользователь глазами.

Конкретные encounter counts, баланс и порядок внутри актов не фиксировать молча — это решается отдельными task/playtest.

## Отложено пользователем

| Task | Статус | Условие возврата |
|---|---|---|
| MOB-001 — Mobile/Game UI Polish | DEFERRED | Не запускать до явной команды пользователя. Mobile landscape уже вручную проверен как в целом рабочий. |
| Market/VK research follow-ups | DEFERRED | Возвращаться только по явному приоритету пользователя. |

Когда MOB-001 будет разморожен, там остаются только mobile-specific вещи: safe-area, responsive HUD polish, touch-size и реальный телефон. Общие admin/scene/top-left проблемы вынесены в UI-001 и не зависят от mobile.

## Правила доски

- BOARD обязан хранить согласованный ближний план, чтобы решения из чата не терялись.
- Не превращать BOARD в свалку из десятков идей.
- Для READY-задач должна быть task-card.
- PLANNED-направление может стоять без task-card, пока scope ещё не определён.
- DEFERRED не запускать без явной команды пользователя.
- DONE после принятия уходит из активной части; важный результат фиксируется в PROJECT/archive/Git.
- Для визуальной работы зависимый шаг ждёт реального просмотра пользователя.
