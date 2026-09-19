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
- UI-001: clean game view, убран overlap в левом верхнем углу, честный scene dropdown.
- FIX-033: HUD-плашки больше не вылезают за viewport, оформленный player HUD.
- VFX-002: damage number popup (light hit), синхронный с прилётом стрелы, реальный урон.
- VFX-003: light-hit feel целиком (flash + sparks + squash/recoil + camera impulse поверх dmg/trail).
- LD-006: shortlist из 7 кандидатов Act I encounter'ов (design-only, см. `.orchestra/research/LD-006-act1-encounter-shortlist.md`) — выбор конкретного кандидата ещё не сделан.
- REF-001: 12 браузерных VFX-референсов + 20 приёмов (см. `.orchestra/research/REF-001-browser-combat-ui-vfx-references.md`).
- COMBAT-001: generic enemy ability framework, Shield доказан как вторая способность поверх обобщённого `stone_throw`.
- ASSET-004: подключены уже нарисованные/откалиброванные attack/attackReady/hit/defeat позы у 7 обычных врагов (были на диске, но не в `assets.js`).

Стрелочный renderer/material трек закончен. Старые BUILD-032/033 и VIS/FIX arrow-эксперименты — история/источники отдельных идей.

## Сейчас / READY

| Task | Статус | Ветка | Смысл |
|---|---|---|---|
| ASSET-005/007/008 — Hit/Stunned split | IN PROGRESS (внешний арт) | — | ChatGPT-в-браузере генерирует недостающие позы: 8 существующих мобов ждут `stunned`, Goblin Grunt/Matron ждут `hit`. Не код-задача, см. `.orchestra/tasks/`. |

Эти задачи независимы по смыслу. Не нужно запускать все одновременно: архитектор выбирает 1–2 дешёвых исполнителя по текущей загрузке, без дублирования одной задачи нескольким агентам.

## Следующий продуктовый слой

Это уже согласованное направление, но карточки создаются только когда предыдущий результат просмотрен и scope понятен.

| Task/направление | Статус | Что именно хотим |
|---|---|---|
| ACT-I-002 — Act I Vertical Slice | PLAYTEST | В campaign добавлены 8 provisional Act I stages: патруль → cross-lock → caster → rock thrower → three-front → Shield Captain → mixed exam → Goblin King. Пользователь проходит и тюнит в Campaign Editor. |
| RUN-002 — Roguelite Rewards / Progression | PLANNED | Проверить короткий run: meaningful rewards между боями, расход/ценность Rotate, небольшой понятный набор апгрейдов, желание сделать ещё один забег. |
| VFX integration (остальные пресеты после light-hit) | PLANNED | VFX-003 принят (light-hit целиком) — дальше heavy hit / magic hit / boss hit / kill / boss kill / blocked tap / reward, тем же паттерном (`fxFor(key).новое_поле`), по одному за раз. |
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
