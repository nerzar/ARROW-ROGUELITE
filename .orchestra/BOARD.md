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
- LD-007 (принято пользователем 2026-09-19): Act I на плотных досках (`board.profile` short/mixed/long), 0-Rotate линии, ability `shift`, библиотека из 36 арен, designer-инструменты `tools/ld007-audit.mjs` / `ld007-scan.mjs`. Отчёт: `.orchestra/research/LD-007-act1-gameplay-pass.md`.
- ACT-I-003 (принято): Act I «Край гоблинов» — 18 stage'ов, species goblin-grunt/matron/drunkard, механики `heal`, `shift trigger:hit`, `reward`, `expiresAfter`, `winHeal`.
- WAVE-001: волны врагов с телеграфом (`arrival.afterKill`/`onTurn`), debug-fixture, campaign не тронута.
- ITEM-001: run-инвентарь, действие `item` (Bow/Shield/Flask), reward draft 1-из-3 (золото/heal/rotate/предмет), солвер видит предметы. UI — плейсхолдер, ждёт ART-011/012/014.
- ART-010/ART-010B: exploration визуального языка UI (docs/референсы) — принято к сведению, финальное направление ещё не выбрано пользователем.

Стрелочный renderer/material трек закончен. Старые BUILD-032/033 и VIS/FIX arrow-эксперименты — история/источники отдельных идей.

## Сейчас / READY

| Task | Статус | Ветка | Смысл |
|---|---|---|---|
| ASSET-005/007/008 — Hit/Stunned split | IN PROGRESS (внешний арт) | — | ChatGPT-в-браузере генерирует недостающие позы: 8 существующих мобов ждут `stunned`, Goblin Grunt/Matron ждут `hit`. Не код-задача, см. `.orchestra/tasks/`. |
| ART-011 — Reward Choice Screen Exploration | DONE / USER REVIEW | `art/ART-011-reward-choice-screen` | 4 варианта reward screen готовы; выбрать направление перед production-интеграцией. |
| ART-012 — Player HUD Exploration | READY | `art/ART-012-player-hud` | 2–4 варианта HUD: HP, Rotate, active items/charges/statuses. Anchor-screen, не перекрывать board/arena. |
| PRESENT-001 — Презентация способностей врагов | DONE / AWAITING REVIEW+MERGE | `build/PRESENT-001-ability-presentation` | Shift/stagger/heal/loot/shield/pin presentation готова на ветке, 392/392 зелёные; нужен живой просмотр и интеграция. |
| ASSET-009 — Иконки предметов v1 | READY (арт пользователя) | `art/ASSET-009-item-icons-v1` | 6 активных + 3 реликвии, 512 px, фиксированные пути под ITEM-001/002. |
| ASSET-010 — Спрайты лут-цели | READY (арт пользователя) | `art/ASSET-010-loot-target-sprites` | species `loot-chest`, 5 поз под текущий пайплайн; заменяет гоблина-носильщика в «Обозе». |
| ASSET-011 — Портрет героя | READY (арт пользователя) | `art/ASSET-011-hero-portrait` | portrait / portrait-hurt / full для HUD и reward-экранов. |
| ASSET-012 — HUD-элементы: плашка волны, Rotate, пипсы, слот | READY после ART-012 | `art/ASSET-012-hud-elements` | Маленькие production-элементы под WAVE-001/ITEM-001. |
| FIX-034 — Stone Pin / Matron | BLOCKED — AFTER GEMINI MERGE | `fix/FIX-034-matron-stone-pin-block` | Не запускать: нужный Matron/Stone Pin skill ещё не в main. После интеграции Gemini-ветки сначала воспроизвести баг на новом main, потом фиксить. Devin/Fable запускался на неверной базе. |
| ART-011B — Approved Reward Reference Pass | READY | `art/ART-011B-approved-reward-reference` | Взять пользовательский `reward-approved.png`, положить его в канонические refs и сделать один cleaned-up reward mockup вместо свободного exploration. |

Эти задачи независимы по смыслу. Не нужно запускать все одновременно: архитектор выбирает 1–2 дешёвых исполнителя по текущей загрузке, без дублирования одной задачи нескольким агентам.

## Следующий продуктовый слой

Это уже согласованное направление, но карточки создаются только когда предыдущий результат просмотрен и scope понятен.

| Task/направление | Статус | Что именно хотим |
|---|---|---|
| ITEM-002 — Предметы v1: Frost Dart, Pocket Gyro, War Horn + 3 реликвии | DONE / AWAITING REVIEW+MERGE | Набор до 6 активных + 3 пассивных готов на `build/ITEM-002-items-v1-set`; 431 тест зелёный, нужен пользовательский live-check и интеграция. |
| MAP-001 — Goblin Country Route Map v1 | IN PROGRESS (Gemini / Antigravity) | Stacked после ITEM-002 на `build/MAP-001-goblin-country-route`; route graph battle/shop/boss + save/load + fallback linear flow. |
| SHOP-001 — Goblin Merchant v1 | PLANNED / VERTICAL SLICE | Торговец как shop-node: тратим уже существующее run-gold на item/heal/Rotate; stock и цены data-driven, баланс позже. |
| ART-019 — Goblin Country Map + Merchant Visual Direction | PLANNED | Визуальный язык карты маршрута и торговца в текущем premium-fantasy стиле, без generic parchment/RPG UI. |
| MAP-002 — Events / Points of Interest | PLANNED AFTER MAP-001 | Небоевые узлы на карте: event / POI / rest / optional challenge; 3–5 коротких data-driven событий для первой версии. |
| VFX-004 — Friendly-fire feedback | PLANNED AFTER CURRENT UI/PRESENT MERGE | При столкновении стрелы со стрелой и уроне игроку — отдельный читаемый impact + player damage feedback, без изменения rules. |
| PORTAL-001 — Monster Spawner Portal | PLANNED | Новый target: портал со spawn countdown, выпускает монстров пока жив; после уничтожения новые spawn'ы прекращаются. |
| RUN-003 — XP / Level Up v1 | PLANNED / DECISION BEFORE FINAL BALANCE | XP за encounters -> level-up -> маленький выбор бонуса (Rotate/charges/HP/utility). Решить, входит ли в первый slice, до финального balance pass. |
| ITEM-003 — Arrow-boost consumables / abilities | PLANNED LATER | 2–3 тестовых эффекта, усиливающих сами puzzle-projectiles: damage/element/pierce/ricochet/control. После ITEM-002. |
| LD-008 — Act I под предметы и волны | PLANNED (ITEM-001/WAVE-001 приняты, можно заводить) | Новый критерий честности (`baseline / booster-helpful / power-gated` по GAME-CONCEPT §13), ≥4 волновых боя, 9x9 в конце акта. Заменяет RUN-002. |
| ART-013 — Victory / Reward / Boss Popup Set | PLANNED / NEAR-TERM | Единое семейство Victory / reward gained / boss intro-warning / unlock popups; пользователь отдельно подтвердил popups как ближайший нужный слой. |
| ART-014 — Item / Weapon Presentation | PLANNED | Карточка предмета/оружия, rarity, свойства, визуал лута — в стиле Reward Screen. |
| ART-015 — Mini-Inventory / Loadout UI | PLANNED | Компактные equipped/available slots и замена предметов без RPG-склада. |
| ART-016 — Reward Targets on Board | PLANNED LATER | Сундук/кристалл/тотем/временная бонус-цель, хорошо читаемая на арене. |
| ART-017 — Item / Consumable / Status Icons | PLANNED LATER | Единая система мелких иконок после утверждения HUD/items. |
| ART-018 — Act I Goblin Village Presentation Polish | PLANNED LATER | Тематические goblin-акценты, декоративные UI-детали и presentation polish поверх общей системы, не отдельный стиль. |
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

AGREED FOR NOW (пользователь, 2026-09-19): дальше усложняем сами головоломки и число мобов (волны, доски 8x8–10x10, профиль `short`). «100 % без урона голым набором» перестаёт быть критерием обычного боя, как только у героя появятся оружие и предметы (ITEM-001/002); честность считается с базовым набором. Для vertical slice обязательны не только rewards/items, но и **карта Страны гоблинов с выбором маршрута + торговец**, использующий уже существующее run-gold. Полный economy/balance pass делаем только после того, как reward → map → battle/shop → следующий бой работает как единый забег.

Визуальное производство не откладывать «на самый конец»: gameplay/content и нужные для playtest арты/VFX могут двигаться параллельно, но визуальные решения всё равно принимает пользователь глазами.

Конкретные encounter counts, баланс и порядок внутри актов не фиксировать молча — это решается отдельными task/playtest.

## Ближайшая точка сведения / проверки

Не балансировать всё по кускам, пока параллельные ветки ещё не сведены.

Порядок vertical slice:
1. досвести/просмотреть текущие presentation + HUD/reward визуальные ветки;
2. ITEM-002 — полный набор предметов v1;
3. MAP-001 + SHOP-001 — run navigation и merchant;
4. решить gate по RUN-003: входит ли XP/Level Up в первый vertical slice; если да — внедрить ДО финального balance;
5. MAP-002 / PORTAL-001 — подключать только если базовый route/shop loop уже стабилен и они реально улучшают slice;
6. LD-008 — боевой rebalance Act I уже с предметами/волнами и с окончательно выбранным power curve;
7. полный ручной прогон: Prologue → reward → карта → battle/event/shop → boss;
8. только после этого — economy tuning (gold/prices/heal/Rotate/item frequency/XP, если он в slice) и финальный balance pass.

От пользователя на шагах 1/5 нужны живые ACCEPT/FIX по визуалу и ощущению забега; цифры до этого считать provisional.

## Отложено пользователем

| Task | Статус | Условие возврата |
|---|---|---|
| MOB-001 — Mobile/Game UI Polish | DEFERRED | Не запускать до явной команды пользователя. Mobile landscape уже вручную проверен как в целом рабочий. |
| Market/VK research follow-ups | DEFERRED | Возвращаться только по явному приоритету пользователя. |
| CLASS-001 — Classes and Skills | DEFERRED / MUCH LATER | Классы, удары, spawn/усиление стрел, control, skill tree — только после доказанного vertical slice и полного run playtest. |

Когда MOB-001 будет разморожен, там остаются только mobile-specific вещи: safe-area, responsive HUD polish, touch-size и реальный телефон. Общие admin/scene/top-left проблемы вынесены в UI-001 и не зависят от mobile.

## Правила доски

- BOARD обязан хранить согласованный ближний план, чтобы решения из чата не терялись.
- Не превращать BOARD в свалку из десятков идей.
- Для READY-задач должна быть task-card.
- PLANNED-направление может стоять без task-card, пока scope ещё не определён.
- DEFERRED не запускать без явной команды пользователя.
- DONE после принятия уходит из активной части; важный результат фиксируется в PROJECT/archive/Git.
- Для визуальной работы зависимый шаг ждёт реального просмотра пользователя.
