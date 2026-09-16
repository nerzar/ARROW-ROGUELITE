# TASK: EXP-003 — коммерческий разбор референсов и clone-кандидатов

STATUS: READY
TYPE: EXP
SIZE: L
AGENT: Muse Spark 1.3
BASE_BRANCH: main
BRANCH: exp/EXP-003-commercial-reference-audit
START_SHA: ebe10d3f1c92c22361a7b9812def0ccf048ae519
RESULT_SHA:

## Зачем

Magic Arrow уже выбран как основной продуктовый трек и параллельно разрабатывается другим агентом.

Эта задача не выбирает игру заново. Она должна помочь с коммерческой частью:

1. понять, как реально устроены лучшие/интересные Arrow / Tap Away игры в VK;
2. найти 2–3 простых механики/формулы для отдельного быстрого clone-experiment;
3. оценить не только спрос по данным, но и реальный продукт: onboarding, UX, monetization, meta, art-cost, сложность самостоятельной реализации.

Под `clone` понимается самостоятельная реализация проверенной механики/формулы: без копирования чужого кода, ассетов, текстов, брендинга или UI один-в-один.

## Входы

EXP-004 принят и влит в main.

Использовать:
- `research/vk-market/labeling/EXP-004-REPORT.md`;
- `research/vk-market/labeling/muse-labels.csv`;
- `research/vk-market/labeling/magic-arrow-neighbors.csv`;
- `research/vk-market/labeling/mechanic-market.csv`;
- `research/vk-market/snapshots/2026-09-16/apps.csv`;
- `research/vk-market/snapshots/2026-09-16/rankings.csv`;
- локальный `artifacts/vk-market/20260916T163154Z/export/apps_full.csv`, если нужен полный description / links.

`members_count` не называть MAU. Это публичная VK-метрика, совпавшая с UI-меткой «игроков» в пределах округления.

## Кого анализировать

Собрать shortlist примерно 20–25 игр с прозрачными причинами выбора.

Обязательно:

### Arrow / Tap Away — 8–10 игр

Включить:
- крупнейшие по `members_count`;
- сильные по `growth_rate` / `popular_today`;
- обязательно `app_id=51871737` — «Разбери Кубик», который keyword retrieval пропустил;
- обязательно `app_id=53992911` — единственный найденный Arrow с явной внешней целью;
- по возможности 1–2 игры с rotation / direction change.

### Clone candidates — примерно 12–15 игр

Взять лучшие свежие представители механик, где EXP-004 показал реальные свежие успехи:
- sort — 4–5;
- merge — 4–5;
- match3 — 3–4;
- screw — 1–2 как контроль/сравнение, если есть содержательные кандидаты.

При выборе учитывать одновременно:
- published <= 365 дней;
- `members_count`;
- `growth_rate` / `popular_today`;
- наличие >=50k / >=100k среди свежих;
- не брать пять почти одинаковых клонов, если они не дают новой информации.

Сохранить `shortlist.csv` с причиной включения.

## Что реально проверять

Это не повторная разметка descriptions.

Для каждой игры постараться проверить публично доступные источники в таком порядке:

1. карточка/страница игры VK;
2. screenshots / promo images;
3. если игру можно открыть безопасно и без действий, затрагивающих аккаунт/платежи — первые 2–5 минут gameplay;
4. публичные описания/страницы разработчика, если они нужны для подтверждения факта.

Никаких покупок, рекламных кликов, авторизации в чужие аккаунты, обхода ограничений или автоматизации действий внутри игр.

Если gameplay не удалось открыть — писать `NOT_TESTED`, а не додумывать по screenshot.

## Для каждой игры собрать

Минимум следующие поля.

### Факты продукта

- app_id / title / mechanic;
- published_date;
- members_count;
- snapshot ranks;
- можно ли реально запустить/проверить gameplay;
- core loop своими словами в 1–3 предложениях;
- первые 2–3 минуты: что игрок делает;
- onboarding: текстовый / hands-on / почти отсутствует;
- fail-state / lives / health / moves / energy, если подтверждено;
- meta-layer, если подтвержден;
- level map / chapters / collection / renovation / battle pass / daily loop, если подтверждено;
- rewarded ads / interstitial / IAP / subscriptions / remove ads — только если реально увидено или явно указано публично;
- session loop: уровень -> награда -> следующий уровень / meta / run и т.п.;
- визуальный уровень: простой / средний / дорогой для воспроизведения;
- animation / game-feel: какие дешёвые эффекты создают ощущение качества;
- asset burden: low / medium / high с коротким объяснением;
- техническая сложность самостоятельного веб-клона: low / medium / high с объяснением;
- что явно можно улучшить в своей реализации.

### Отдельно для Arrow

Проверить, а не предполагать:
- wrong tap penalty;
- lives/health;
- arrow exits board или исчезает;
- picture reveal / house / другой meta wrapper;
- 2D / 3D;
- rotation / camera rotation / direction change;
- blockers / special arrows;
- progression;
- monetization;
- внешние цели / combat / mobs / bosses;
- насколько быстро игрок понимает правила.

Сравнить это с Magic Arrow только в конце отчёта. Не менять design docs.

## Коммерческая матрица

После individual audits сделать одну сравнительную таблицу минимум по механикам:

- Arrow / Tap Away;
- Sort;
- Merge;
- Match-3;
- Screw, если данных достаточно.

Колонки:
- число свежих игр из EXP-004;
- свежие >=50k / >=100k;
- типичный art burden;
- типичная code complexity;
- типичная meta complexity;
- насколько легко сделать заметно лучше визуально;
- насколько механика допускает дешёвое процедурное/алгоритмическое производство уровней;
- monetization surfaces, которые реально встречены в проверенных играх;
- примерный MVP scope в человеко-днях как диапазон для опытного web developer + AI; это **оценка**, явно пометить её как estimate;
- главные риски.

Не выводить «лучшую игру» автоматически только из одной метрики.

## Итоговые рекомендации

В `EXP-003-REPORT.md` в конце нужны:

1. краткий разбор состояния Arrow/Tap Away рынка;
2. что из референсов полезно перенять как абстрактный паттерн, не копируя конкретную реализацию;
3. 2–3 наиболее интересных формулы для отдельного clone-experiment с аргументами **за и против**;
4. какие 5–10 игр стоит отдать Gemini позже на независимый визуальный review;
5. какие 5–15 официальных сообществ имеют смысл брать в EXP-005 для демографии.

Рекомендации должны опираться на факты из EXP-004 + фактически просмотренный продукт. Не приписывать игре то, чего не увидел.

## Outputs

Коммитить:
- `research/vk-market/reference-audit/shortlist.csv`;
- `research/vk-market/reference-audit/games.csv` — структурированные результаты;
- `research/vk-market/reference-audit/commercial-matrix.csv`;
- `research/vk-market/reference-audit/EXP-003-REPORT.md`;
- при необходимости маленький `sources.md` со ссылками/датами просмотра;
- этот task-файл с RESULT / VERIFY / FOUND.

Не коммитить:
- скачанные большие screenshots/video;
- cookies/session data;
- secrets;
- raw browser dumps;
- чужие игровые assets.

## Можно менять

- `research/vk-market/reference-audit/**`;
- при необходимости небольшой helper под `tools/vk_reference_audit/**`;
- этот task-файл.

## Не менять

- игровой код;
- design docs;
- EXP-004 labels;
- collector/analytics;
- `.orchestra/BOARD.md`, `RULES.md`, `PROJECT.md`, `NOTES.md`;
- `.env`.

## Готово, если

- [ ] shortlist 20–25 игр собран с причинами выбора;
- [ ] Arrow представлены минимум 8 играми;
- [ ] sort / merge / match3 представлены реальными свежими кандидатами;
- [ ] для каждой игры явно разделено `OBSERVED`, `PUBLIC_INFO`, `NOT_TESTED`, `INFERENCE`;
- [ ] не выдумана monetization/gameplay там, где игра не запускалась;
- [ ] есть коммерческая матрица механик;
- [ ] есть 2–3 clone-experiment формулы с аргументами за/против;
- [ ] сформирован shortlist для будущего Gemini visual review;
- [ ] сформирован shortlist сообществ для EXP-005;
- [ ] игровые/design файлы не менялись;
- [ ] secret scan PASS.

## Когда остановиться

STATUS: BLOCKED, если:
- публичные VK страницы/скриншоты массово недоступны и невозможно проверить хотя бы 15 игр;
- для продолжения требуется логин/платёж/обход ограничений;
- источники противоречат данным так, что нельзя понять, что относится к нужному app_id.

Не блокироваться из-за 1–2 недоступных игр: отметить NOT_TESTED и заменить резервными кандидатами, сохранив причину.

## Финал

Заполнить RESULT / VERIFY / FOUND, поставить STATUS: DONE или BLOCKED, записать RESULT_SHA, commit + push этой же ветки. Не merge в main. Остановиться.
