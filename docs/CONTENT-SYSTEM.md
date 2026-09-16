# Magic Arrow — Content System

Актуализировано: 16 сентября 2026.

Этот документ описывает рабочую систему контента, а не финальный баланс.

## 1. Три слоя игры

### Puzzle layer

Центральная фигура со стрелками. Игрок освобождает стрелки в правильном порядке.

### Combat / target layer

После выхода стрелка продолжает полёт и взаимодействует с целью с соответствующей стороны поля.

### Run layer

После encounter/босса игрок получает новые свойства стрел, relics и rule-changing rewards. Они меняют следующие puzzle и бои.

## 2. Главный принцип контента

Контент должен масштабироваться комбинациями, а не количеством уникального кода.

Пример:

`Tank archetype × Golem visual set × Frost modifier`

может стать новым врагом без новой базовой AI-механики.

То же относится к стрелам:

`movement + targeting + on-hit + visual form`

дают большое количество вариантов из небольшого числа системных блоков.

## 3. Enemy archetypes

Стартовый набор:

| Архетип | Роль |
|---|---|
| Grunt | базовая цель |
| Swarm | много дешёвых целей |
| Tank | требует много попаданий |
| Shield | блокирует часть атак |
| Reflector | отражает/перенаправляет projectile |
| Splitter | создаёт новые цели после поражения |
| Healer | поддерживает других |
| Summoner | создаёт мелких врагов |
| Armored | уязвимость зависит от стороны/условия |
| Berserker | усиливается при низком HP |

Не все нужны в первом vertical slice.

## 4. Boss pattern library

Boss — это rule breaker.

Категории boss mechanics:

- directional vulnerability;
- rotating shield;
- projectile reflection;
- temporary board mutation;
- forced rotation;
- target spawning;
- phase transformation;
- projectile transformation;
- time/move-limited windows;
- multi-target boss body.

Хороший boss должен делать минимум одно из двух:

1. проверять уже изученную механику в новом контексте;
2. показывать механику, которую игрок после победы может получить себе.

## 5. Arrow Forms

Arrow Form — заметное изменение поведения и визуала projectile.

Рабочие формы:

| Form | Поведение |
|---|---|
| Normal | одна цель |
| Ricochet | переход на следующую цель |
| Pierce | проходит через цель |
| Split | создаёт несколько projectile |
| Explosive | область поражения |
| Frost | контроль цели |
| Chain | цепное попадание |
| Serpent | живой/самонаводящийся projectile |
| Boomerang | обратный проход |
| Phantom | игнор части защиты |
| Gold | экономическая награда |

Форма должна по возможности иметь собственную визуальную грамматику: trail, цвет, glow, движение, hit effect.

## 6. Relics и upgrades

Разделять три уровня силы.

### Minor upgrades

Небольшие улучшения уже имеющейся механики:

- +1 ricochet target;
- +1 pierce;
- дольше Frost;
- больше explosion radius;
- выше шанс Serpent transform.

### Relics

Меняют построение билда:

- Every Third Arrow Ricochets;
- First Hit Splits;
- Every Fifth Hit Chains;
- First Arrow Each Encounter Becomes Phantom;
- Rotation grants temporary bonus.

### Boss Powers

Редкие rule-changing награды:

- permanent Ricochet;
- Serpent Form;
- field Rotation;
- universal Chain;
- shield bypass.

## 7. Directional combat

На раннем этапе один враг с одной стороны.

Дальше:

- две стороны;
- три стороны;
- разные приоритеты целей;
- временные цели;
- boss body на нескольких сторонах;
- цели, которые меняют сторону.

Направление стрел — ограниченный ресурс. Это должно создавать решения ещё до выстрела.

## 8. Rotation

Rotation рассматривается как одна из потенциально ключевых механик Magic Arrow.

Возможные варианты:

- поворот всей фигуры на 90°;
- поворот одного сектора;
- один charge на encounter;
- cooldown в ходах;
- boss-only rule;
- постоянная boss reward.

До прототипа не фиксировать вариант.

## 9. Balance units

Базовая единица дизайна:

`1 normal arrow hit = 1 damage unit`.

Это позволяет описывать врага как «умирает за 2 стрелы», а не как абстрактные `137 HP`.

Runtime может использовать любые числовые значения, но content data хранит понятные hit-units и коэффициенты.

Рекомендуемые поля:

```json
{
  "id": "mob_example",
  "archetype": "tank",
  "hpUnits": 6,
  "sideRules": ["any"],
  "abilities": [],
  "visualSet": "golem"
}
```

Boss:

```json
{
  "id": "boss_snake_queen",
  "hpUnits": 40,
  "phases": ["normal", "serpent_phase"],
  "ruleChanges": ["transform_projectiles_to_serpents"],
  "rewardPool": ["serpent_form", "poison", "homing"]
}
```

Точные цифры здесь иллюстративные.

## 10. Encounter budget

Encounter описывается не только врагами, но и доступным puzzle-budget:

- сколько стрел на поле;
- распределение направлений;
- суммарное enemy HP в units;
- временные цели;
- допустимый запас ошибок;
- специальные board modifiers.

Главный вопрос баланса:

> достаточно ли у игрока потенциального урона нужных направлений, но приходится ли принимать интересные решения, чтобы этот потенциал реализовать?

## 11. Data files

Предпочтительная структура:

```text
content/
  enemies.json
  bosses.json
  arrow_forms.json
  relics.json
  upgrades.json
  encounters.json
  status_effects.json
```

Core-код должен читать эти данные, а не содержать конкретных мобов/боссов внутри системной логики.

## 12. Первый proof-of-fun набор

До массового производства ориентируемся на небольшой набор:

- 6 обычных типов врагов;
- 2 элиты;
- 3 босса;
- 6 Arrow Forms;
- 10 relics/upgrades;
- несколько encounter patterns.

Если с этим набором нет желания сыграть ещё один забег, добавление 100 новых мобов проблему не исправит.

## 13. Источники механик и границы оригинальности

Мы можем свободно использовать общие игровые паттерны вроде ricochet, pierce, poison, chain lightning, shield, draft 1-of-3, rarity и boss phases. Они давно распространены в играх.

Актуальная проверка 16.09.2026 показывает близкие продукты:

- Arrow Crypt: Roguelite Puzzle — arrow puzzle + 1-of-3 rune draft + bosses + Ricochet/Split/Pierce/Chain/Frost + rotation-like hero ability;
- arrow puzzle spiral defense — arrows/units атакуют монстров, boss fights, выбор товара после победы;
- Arrow Escape: Tap Away Puzzle — deflectors, ice, locks, portals;
- Arrows Tap Away-Escape Puzzle — snake-like arrow motion и boss grids;
- Archero — хорошо известный Ricochet как projectile-upgrade.

Поэтому отдельные элементы не считаем «уникальной фичей». Наш рабочий differentiator — их связка вокруг **вышедшей из puzzle стрелы как реального снаряда**, directional external targets, rotation и boss-driven projectile transformations.

## 14. Что можно отдавать дешёвым агентам

После фиксации схемы Muse/другой дешёвый агент может:

- генерировать 20 вариантов врагов из разрешённых archetypes;
- предлагать encounter compositions;
- искать дублирующие эффекты;
- проверять content JSON по схеме;
- классифицировать эффекты по `movement/targeting/on-hit/control/economy`;
- искать в больших массивах референсов похожие механики.

Но важные решения — core loop, boss rules, economy, сложность, monetization, итоговый набор механик — остаются за пользователем/архитектором и сильной моделью.
