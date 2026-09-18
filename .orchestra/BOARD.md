# Доска Arrow-Roguelite

Здесь только работа, которая **сейчас** требует внимания. Подробности активной задачи живут в её task-card. История — в Git и `.orchestra/archive/`.

## База

`main` — текущий рабочий playable baseline.

В `main` уже сведены и приняты:
- playable Prologue из 5 этапов;
- Campaign Editor и Pose Editor;
- импорт и загрузка baked-арен;
- Goblin King flee intro;
- Goblin Shaman defeat;
- filled-arrow renderer в реальной игре;
- 15 материалов стрел + `viewer/filled-arrow.html`;
- Rotate / текущий combat flow;
- CAL-005: species pivot/scale, HUD offset/scale, shadow offset, parity editor ↔ runtime.

Стрелочный трек закончен. BUILD-032/033 и старые VIS/FIX arrow-ветки — история/источники отдельных идей, а не активная разработка.

## Сейчас

| Task | Исполнитель | Статус | Ветка | Зачем |
|---|---|---|---|---|
| VFX-001 — Combat Feel Lab | DeepSeek 4.1 Flash / дешёвый исполнитель | READY | `spike/VFX-001-combat-feel-lab` | Отдельный визуальный стенд: trail, impact, particles, damage number, hit reaction, visual hit-stop, shake, death/boss/reward FX. Сначала пользователь выбирает ощущения глазами, потом решаем архитектуру. |

## Отложено пользователем

| Task | Статус | Условие возврата |
|---|---|---|
| MOB-001 — Mobile/Game UI Polish | DEFERRED | Не запускать до явной команды пользователя. Мобильная версия уже вручную проверена как в целом рабочая; позже нужны только точечные UI/mobile фиксы. |
| Market/VK follow-ups | DEFERRED | Возвращаться только по явному приоритету пользователя. |

## После VFX-001

Не строить длинную автоматическую очередь.

Ближайшее решение после просмотра VFX Lab:
1. пользователь выбирает, какие боевые эффекты реально нравятся;
2. только выбранные эффекты интегрируются в игру;
3. reusable VFX-архитектура делается только под реальные выбранные эффекты, а не заранее.

Отдельно запланирован визуальный reference-pass по браузерным играм: HUD, damage feedback, cast/attack telegraphs, boss feedback, rewards, projectile/impact animation. Цель — вдохновение и разбор приёмов, не копирование.

## Более дальний маршрут — обсуждали, но это НЕ активные задачи

- короткий Act I vertical slice;
- проверить roguelite rewards/progression на коротком run;
- combat juice / VFX / audio;
- позже VK production: SDK, saves, lifecycle, fullscreen, ads, analytics;
- расширение контента после того, как вертикальный срез приятно играть.

Каждый следующий task создаётся только после отдельного решения пользователя.

## Правила доски

- Не использовать BOARD как большой backlog.
- Не хранить здесь DONE-задачи после принятия/архивации.
- Не создавать несколько параллельных задач вокруг одной проблемы без причины.
- Новая задача появляется только когда понятен конкретный следующий результат.
- Для визуальной работы зависимый шаг ждёт реального просмотра пользователя.
