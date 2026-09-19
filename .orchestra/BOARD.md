# Доска Arrow-Roguelite

BOARD хранит не только одну текущую задачу, а **согласованный ближний план**: что делаем сейчас, что уже READY, что идёт следующим продуктовым шагом и что пользователь явно отложил.

Подробности конкретной READY-задачи живут в её task-card. История выполненного — в Git и `.orchestra/archive/`.

## База

`main` — текущий рабочий playable baseline (`0e68113`, 39 test files / 435 tests зелёные после `npm run build`).

Уже сведены и приняты:
- playable Prologue 5/5; Campaign Editor и Pose Editor; arena calibration / baked arena loader; Goblin King flee intro; Goblin Shaman defeat;
- filled-arrow renderer + 15 materials + gallery; shared Rotate flow; CAL-005 species presentation;
- UI-001 clean game view; FIX-033 HUD fit; VFX-002 damage numbers; VFX-003 light-hit feel; BUILD-035 projectile flight;
- LD-006 shortlist; REF-001 браузерные референсы; ASSET-004 позы 7 врагов;
- COMBAT-001: generic enemy ability framework (`stone_throw`, `shield`).
- LD-007 (принято 2026-09-19): Act I на плотных досках (`board.profile` short/mixed/long), 0-Rotate линии, ability `shift`, библиотека из 36 арен, `tools/ld007-audit.mjs` / `ld007-scan.mjs`. Отчёт: `.orchestra/research/LD-007-act1-gameplay-pass.md`.
- ACT-I-003 (принято): Act I «Край гоблинов» — 18 stage'ов, species goblin-grunt/matron/drunkard, механики `heal`, `shift trigger:hit`, `reward`, `expiresAfter`, `winHeal`.
- WAVE-001: волны врагов с телеграфом (`arrival.afterKill`/`onTurn`), debug-fixture; в campaign пока не использованы.
- ITEM-001 (часть): run-инвентарь, действие `item`, reward draft (золото / heal|rotate / редкий предмет), run-gold, save/load. **Вторая итерация `dcbd231` (Зелье, «Стрела», Матрона heal + камни) в main НЕ попала — см. INT-ITEM-001b.**
- ITEM-002: Ледяной дротик / Карманный гироскоп / Боевой рог + 3 реликвии (Утилизация / Замковый камень / Предохранитель), веса редкости в драфте.
- PRESENT-001: презентация способностей врагов (shift/stagger/heal-искра/лут/щит/pin), presentation-only.
- ART-012B / BUILD-036: одобренный HUD (player/enemy card, rotate-кнопка) в проде.
- FIX-034 (временно): intro-текст не обещает THROW для Матроны — **будет отменён после INT-ITEM-001b**, потому что у Матроны камни есть по решению пользователя.
- Утверждённые референсы reward / map / merchant / level-up сведены в `docs/visual-refs/` (README, раздел «Утверждённые референсы vertical slice»).

Стрелочный renderer/material трек закончен. Старые BUILD-032/033 и VIS/FIX arrow-эксперименты — история/источники отдельных идей.

## Сейчас / READY

Порядок сверху вниз — это порядок сведения. Первые две строки блокируют остальное.

| Task | Статус | Ветка | Смысл |
|---|---|---|---|
| INT-ITEM-001b — свести Зелье / «Стрела» / Матрона-камни | READY (техлид / Claude) | `build/ITEM-001-inventory-reward-draft` @ `dcbd231` → main | Пробный merge даёт 5 конфликтов (`encounter.ts`, `items.ts`, `run-state.ts`, `app.js`, `board-renderer.js`) — все с ITEM-002/PRESENT-001. Заменить `health_flask` на `potion` в каталоге/весах ITEM-002, переписать `fix-034` тест под Матрону «heal + kids_rocks», вернуть intro-строку THROW для неё. Карточка: `.orchestra/tasks/INT-ITEM-001b-consumables-merge.md`. |
| MAP-001 — Иллюстрированная карта Страны гоблинов | USER REVIEW | `art/MAP-001-illustrated-map` @ `874faea` (2 коммита над main) | Движок графа (`src/route-map.ts`, тест `map-001-route-graph`) + fullscreen карта на `approvedmap.png` с программными подписями и указателем. Пользователь смотрит; при ACCEPT — no-ff в main. Старый node-map от Gemini (`build/MAP-001-goblin-country-route`) — отклонён, не мержить. |
| SHOP-001 — Лавка Хрягуна | READY (после MAP-001 ACCEPT; движок можно начинать раньше) | `build/SHOP-001-goblin-merchant` | Экран по `docs/visual-refs/trader/shop-screen-approved.png`, персонаж `merchant-character.png`. Stock data-driven, покупка item/зелье-заряд/Rotate за run-gold. |
| FIX-035 — HUD fit + dual Rotate | READY | `fix/FIX-035-hud-fit-dual-rotate` | HUD не вылезает за viewport, две Rotate-кнопки. |
| FIX-036 — HUD card overflow после BUILD-036 | READY | `fix/FIX-036-hud-card-overflow` | Карточки HUD переполняются после интеграции approved HUD. |
| ART-011B — Reward screen по approved-референсу | READY | `art/ART-011B-approved-reward-reference` | `reward-approved.png` теперь в `docs/visual-refs/approved-ui/`; один cleaned-up mockup + правила семейства карточек (reward = level-up = shop). |
| ASSET-009/010/011/012 — арт пользователя | READY (арт) | `art/ASSET-*` | Иконки предметов (теперь + Зелье, Стрела), лут-сундук, портрет героя, HUD-элементы волны/Rotate/пипсы/слот. |
| ASSET-005/007/008 — Hit/Stunned позы | IN PROGRESS (внешний арт) | — | 8 мобов ждут `stunned`, Grunt/Matron ждут `hit`. |

Эти задачи независимы по смыслу. Не запускать все одновременно: архитектор выбирает 1–2 дешёвых исполнителя, без дублирования одной задачи нескольким агентам.

## Следующий продуктовый слой

| Task/направление | Статус | Что именно хотим |
|---|---|---|
| LD-008 — Act I под предметы и волны | READY AFTER INT-ITEM-001b | Критерий честности `baseline / booster-helpful / power-gated`, ≥4 волновых боя, 9x9 в конце акта, привязка stage'ов к точкам карты (Кривой лес → Заброшенный пост → Каменное ущелье / Волчья стая → Шаманские топи → Король гоблинов). Заменяет RUN-002. |
| RUN-003 — XP / Level Up v1 | DECISION NEEDED | Референс экрана есть (`docs/visual-refs/progression/levelup-reference.png`). Пользователь решает, входит ли в первый slice; если да — до LD-008 balance. |
| ART-013 — Victory / Reward / Boss Popup Set | PLANNED / NEAR-TERM | Единое семейство по `reward-approved.png`; victory-заголовок, лента «Choose your reward», карточки. |
| ART-014 / ART-015 — Item presentation, mini-inventory | PLANNED | Карточка предмета, редкость, слоты — в языке reward/shop-карточек. |
| ART-019 — Map + Merchant visual direction | DONE BY USER (референсы одобрены) | Карточку закрыть; остаток — production-подготовка ассетов внутри MAP-001/SHOP-001. |
| MAP-002 — Events / Points of Interest | PLANNED AFTER MAP-001 | Небоевые узлы: event / POI / rest / optional challenge. |
| ITEM-003 — Arrow-boost consumables | PLANNED LATER | «Стрела» из ITEM-001b — первый такой расходник; дальше damage/element/pierce/ricochet. |
| VFX-004 — Friendly-fire feedback | PLANNED | Отдельный impact + player damage feedback. |
| PORTAL-001 — Monster Spawner Portal | PLANNED | Портал со spawn countdown, поверх WAVE-001. |
| ART-016/017/018, VFX heavy/magic/boss, AUDIO-001, VK production | PLANNED LATER | Как раньше. |

## Согласованное направление run

Не task queue, а продуктовый ориентир, который нельзя потерять:
- Prologue вводит направление как боевой ресурс и уже выдаёт shared Rotate reward;
- Act I развивает multi-side combat и ведёт к boss reward **Ricochet**;
- позже run должен раскрыть **Serpent Form**; ещё позже — **Chain**;
- boss rewards должны менять правила/поведение стрел, а не быть только +цифры.

AGREED FOR NOW (пользователь, 2026-09-19): усложняем сами головоломки и число мобов (волны, доски 8x8–10x10, профиль `short`). Честность считается с базовым набором (Лук + Щит). Предметы — редкость, золото — обычная награда, расходники пополняемые, Зелье вместо «+HP», «Стрела» создаёт стрелу на доске, Матрона лечит и кидает камни. Vertical slice = rewards/items + карта с маршрутом + торговец за run-gold. Economy/balance pass — только после единого забега.

Визуальное производство идёт параллельно, но визуальные решения принимает пользователь глазами.

## Ближайшая точка сведения / проверки

Порядок vertical slice (обновлён 2026-09-19):
1. INT-ITEM-001b → main;
2. MAP-001 ACCEPT → main; вход в карту после Prologue reward;
3. SHOP-001 (движок + экран по референсу);
4. решение по RUN-003;
5. LD-008 — Act I поверх предметов/волн, привязка к карте;
6. presentation по референсам: ART-011B → ART-013/014, FIX-035/036;
7. полный ручной прогон Prologue → reward → карта → бой/лавка → Король гоблинов;
8. economy tuning (gold/prices/heal/Rotate/item frequency/XP) и финальный balance pass.

От пользователя нужны: ACCEPT карты (шаг 2), решение по RUN-003 (шаг 4), живые ACCEPT/FIX по визуалу (шаг 6) и ощущению забега (шаг 7).

## Отложено пользователем

| Task | Статус | Условие возврата |
|---|---|---|
| MOB-001 — Mobile/Game UI Polish | DEFERRED | Не запускать до явной команды пользователя. |
| Market/VK research follow-ups | DEFERRED | Только по явному приоритету пользователя. |
| CLASS-001 — Classes and Skills | DEFERRED / MUCH LATER | После доказанного vertical slice и полного run playtest. |

## Правила доски

- BOARD обязан хранить согласованный ближний план, чтобы решения из чата не терялись.
- Не превращать BOARD в свалку из десятков идей.
- Для READY-задач должна быть task-card.
- PLANNED-направление может стоять без task-card, пока scope ещё не определён.
- DEFERRED не запускать без явной команды пользователя.
- DONE после принятия уходит из активной части; важный результат фиксируется в PROJECT/archive/Git.
- Для визуальной работы зависимый шаг ждёт реального просмотра пользователя.
