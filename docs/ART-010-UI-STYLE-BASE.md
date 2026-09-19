# ART-010 — UI Style Base / Visual Bible v1

STATUS: EXPLORATION  
VISUAL BOARD: [ART-010-UI-STYLE-BOARD.svg](./ART-010-UI-STYLE-BOARD.svg)

## От чего отталкиваемся

Главный референс — текущий playable, а не отдельный UI-kit.

Из живой игры сохраняем:
- тёмную moonlit fantasy-базу (#201a2b / почти чёрный фон);
- тёплый золотой focus (#ffd76a);
- зелёный HP / positive-state (#7be08a);
- arcane violet как магический акцент;
- объёмные материалы вокруг board: камень, бронза/металл, дерево/кожа;
- сильный контраст и минимум шума в зоне puzzle;
- UI должен ощущаться частью арены, но не забирать у board визуальное первенство.

Не берём в основу текущие полупрозрачные prototype-плашки как финальный стиль. Они полезны как layout/readability baseline, но ART-010 должен добавить материал, фаску и игровой вес.

## Общее для всех трёх направлений

Это не три разные игры. У них общий каркас:

- **premium stylized fantasy**, без flat/mobile-minimal;
- панели тёмные и достаточно плотные, чтобы текст не зависел от фона арены;
- один primary accent на компонент, а не несколько одновременно;
- glow — только focus, magic, rarity, cast/reward; не постоянная подсветка всей рамки;
- HP-green не используется как декоративный цвет;
- red/orange оставляем для danger/urgency/impact;
- названия/награды могут использовать fantasy serif, рабочие цифры и статусы — простой sans;
- цифры HP, charges, timers читаются быстрее декора;
- motion короткий: press/hover/reward feedback, без постоянного bounce.

## 01 — Moonlit Bronze

**Характер:** самый близкий к текущему playable. Тёмный камень + worn bronze + smoked crystal + тёплое золото, arcane-violet только как магическая энергия.

### Компоненты

- **Panel:** blackened stone, тонкая внутренняя бронзовая фаска, один золотой focus-edge.
- **Corners:** срезанные/фасочные углы 8–12 px, без тяжёлого орнамента.
- **Button:** тёмная бронза с тёплым центром; hover усиливает кромку, а не превращает кнопку в неон.
- **HP:** привычный green gradient внутри тяжёлой тёмной рамы.
- **Resource chip:** компактная тёмная плашка с отдельным magic socket/icon.
- **Item frame:** та же геометрия панели, но rarity считывается внутренним magic ring / edge.
- **Typography:** спокойный fantasy serif для заголовков + clean humanist sans для чисел/служебного текста.
- **Glow:** gold focus, violet magic; интенсивность локальная.
- **Motion:** press ~120 ms, hover lift ~180 ms, reward pop ~240 ms.

### Плюсы

- почти не спорит с Moonlit Fortress и текущими персонажами;
- легко расширяется на HUD, reward screen, boss popup и items;
- достаточно premium, но не перегружает маленькие HUD-компоненты;
- goblin-акценты можно добавлять локально через дерево/кожу/царапины, не меняя базовую систему.

**Рекомендация для следующего мокапа:** начать с этого направления как с наиболее естественного продолжения текущей игры. Это рекомендация для проверки, не финальный выбор.

## 02 — Runeforge

**Характер:** тяжелее и агрессивнее. Basalt/iron, hammered copper, leather, ember-runes.

### Компоненты

- **Panel:** тёмный металл/базальт, видимые 45° chamfers, редкие заклёпки.
- **Corners:** острые срезы, меньше округлений.
- **Button:** copper/ember, ощущение более тяжёлого клика.
- **HP:** та же green semantic-система, но рама угловатее.
- **Resource chip:** металл + steel-blue magic socket.
- **Item frame:** более грубая кованая рамка, rarity через внутренний glow.
- **Typography:** компактные fantasy capitals + плотный sans.
- **Glow:** ember в канавках/рунах, steel-blue для magic; danger может быстро уходить в red.
- **Motion:** 90–150 ms snap, небольшой impact kick, shake только для boss/heavy events.

### Когда полезно

Если после первых HUD/reward мокапов текущая игра покажется слишком мягкой и захочется сильнее подчеркнуть combat / Act I goblin pressure.

### Риск

Может сделать весь UI слишком «кузнечно-боевым» и уменьшить ощущение магического приключения. Поэтому roughness лучше держать в материалах и локальных goblin-деталях, а не в каждом элементе.

## 03 — Enchanted Relic

**Характер:** более приключенческий и магический. Carved stone + dark wood/leather + aged gold + emerald crystal.

### Компоненты

- **Panel:** тёмный резной камень, дерево/кожа как второй материал.
- **Corners:** мягче, 14–18 px carved arcs, но без детского round-mobile вида.
- **Button:** дерево/металл с emerald focus.
- **HP:** green semantic остаётся, форма чуть мягче.
- **Resource chip:** crystal socket и тихий rune glow.
- **Item frame:** лучше всего подходит для relic/reward presentation.
- **Typography:** более тёплый story-serif + чистый sans.
- **Glow:** emerald/teal; violet оставляем rarity/arcane.
- **Motion:** 180–260 ms ease-out, лёгкий float только в reward reveal, частицы только при событии.

### Когда полезно

Если reward/items/roguelite слой должен ощущаться сильнее, чем грубость боя, и нужен визуальный мост к forest/caves/magic актам.

### Риск

Если переборщить с округлениями, листвой и teal-glow, направление быстро уйдёт в cozy/детское fantasy. Поэтому каркас и контраст должны оставаться тяжёлыми.

## Что переносим в ART-011 / ART-012 после user review

После выбора пользователем можно проверить систему на двух anchor-экранах:

- **Reward Choice:** card family, rarity, selected/hover state, confirm button, reward reveal;
- **Player HUD:** HP, Rotate, active items/charges/statuses без перекрытия board/arena.

Пока пользователь не выбрал стиль, ни одно из направлений не считается визуальным стандартом production UI.
