# Taxonomy v0 — механики и темы VK Games (EXP-002)

Статус: **IDEA / черновик для утверждения пользователем.** Это не решение о теме или аудитории Magic Arrow.
Здесь описано, *как* размечать, а не какие механики или темы «лучше».

Три независимые оси, каждая со своим confidence:

1. **Mechanic**: `primary_mechanic` (1 значение) + `secondary_mechanics` (0–3) + `mechanic_confidence`.
2. **Theme**: `primary_theme` (1 значение) + `secondary_themes` (0–3) + `theme_confidence`.
3. **Meta**: `combat` (`none` / `cosmetic` / `core`), `roguelite` (bool), `meta_layer` (enum ниже).

Гибриды размечаются через secondary. Не нужно подгонять игру под один класс.

---

## 1. Mechanic

Primary — **ядро одного уровня**: то, что игрок делает ~80% времени. Мета-слой (ремонт дома, история, коллекция) не считается механикой.

| value | Что это | Включает | Не включает / куда |
|---|---|---|---|
| `arrow_tapaway` | Тап по элементу, он едет в своём фиксированном направлении и уходит с поля, если путь свободен. Задача — порядок ходов. | стрелки/стрелочки, «Туда-Сюда», snake escape, 3D-куб из блоков-стрелок (Tap Away 3D), unpuzzle | стрелки клавиатуры как управление; лучники/стрелялки; лабиринт с поворотом стрелки → `other_puzzle`; парковка/sliding → `other_puzzle` + tag `parking_unblock` |
| `sort` | Перекладывание однородных элементов между контейнерами, пока в каждом не окажется один цвет или тип. | water/ball sort, колбы и пробирки, goods/shelf sort («По полочкам»), hexa stack sort, сортировка птиц/верёвок/машин | tray/slot, куда собирают 3 одинаковых с поля → `tile_match` |
| `screw` | Откручивание винтов/болтов, чтобы разобрать конструкцию или освободить доски. | screw pin, «Выкрути винты», «Открути всё» | гайки по болтам по цвету — см. неоднозначность A1 |
| `bubble_shooter` | Выстрел шариком в группу, совпадение цвета лопает группу. | bubble shooter, zuma/marble (tag `marble_zuma`) | тап-лопание пузырей без выстрела → `other_puzzle`/`non_puzzle`; Lines 98 → `other_puzzle` |
| `merge` | Два и больше одинаковых объектов объединяются в объект следующего уровня. | merge-2 board («соединяй предметы»), 2048 и числовые варианты, physics merge / suika (tag `physics_drop`) | исчезновение группы без апгрейда → `match3` (collapse) |
| `match3` | Swap/тап, после которого 3+ одинаковых исчезают прямо на поле. | swap match-3, collapse/blast (tag `collapse_blast`), match-3 RPG | triple-tile в слот → `tile_match` |
| `tile_match` | Поиск и снятие пар или троек одинаковых плиток. | маджонг-пасьянс, mahjong connect, triple tile / «Найди 3», goods triple match 3D | — |
| `block_hexa` | Размещение фигур на сетке, чтобы заполнять линии или области. | block puzzle 10×10, tetris-like, hexa block | hexa stack sort → `sort` |
| `picture_reveal` | Собрать или открыть изображение. | jigsaw, раскраска по номерам, pixel art, «открой скрытую картинку» | если картинка лишь награда за другую механику → secondary, primary = та механика |
| `word` | Слова и буквы. | филворды, кроссворды, слова из слова, виселица, anagram | викторина → `quiz_trivia` |
| `tabletop` | Классические настольные и карточные игры. | пасьянсы (кроме маджонга), шахматы, шашки, нарды, дурак, домино, кости | маджонг → `tile_match` |
| `hidden_object` | Найти предметы или отличия на сцене. | поиск предметов, найди отличия, «найди котика» | — |
| `quiz_trivia` | Вопрос и ответ. | викторины, угадай по кадру, IQ-тесты | — |
| `other_puzzle` | Прочие головоломки. | tags: `parking_unblock`, `pin_pull`, `draw_line`, `pipes_connect`, `logic_grid` (судоку, нонограммы, сапёр), `physics`, `tangle_rope`, `escape_room`, `sliding` | — |
| `non_puzzle` | Не головоломка. | аркада, раннер, шутер, гонки, RPG без puzzle-ядра, стратегия, симулятор, казино, общение | — |
| `unknown` | По title+description нельзя определить. | пустые или маркетинговые описания | — |

### Неоднозначности mechanic (нужно решение пользователя до массовой разметки)

- **A1. Гайки по болтам по цвету** («Болты и гайки: сортировка») технически повторяют ball sort, но в выдаче и в названиях это «screw». Предложение по умолчанию: `primary=sort`, `secondary=[screw]`. Альтернатива: `primary=screw`. От выбора зависит размер кластера screw.
- **A2. Zuma/marble** внутри `bubble_shooter` (tag) или отдельный класс. Предложение: tag.
- **A3. Collapse/blast** («соединяй 2+ кубика одного цвета, чтобы уничтожить») внутри `match3` или отдельно. Предложение: tag `collapse_blast`.
- **A4. Arrow-игры с мета-картинкой или домом** («Стрелки — Открой картинку», «Стрелочки — построй дом»): `primary=arrow_tapaway`, мета уходит в `meta_layer`/`secondary`.
- **A5. Snake escape / «Распутай змей»**: предложено считать `arrow_tapaway`, потому что правило движения то же: объект уходит по своему направлению.
- **A6. Parking jam / «Пробка на дороге»**: не `arrow_tapaway` (машины двигаются по оси, выхода «за поле» нет), а `other_puzzle` + `parking_unblock`. Ближайший сосед arrow, стоит держать tag.
- **A7. Игры с SEO-списком в описании** («если вам нравятся: сортировка, 2048, три в ряд…»): ключевые слова описания не доказывают механику. LLM должна опираться на правила игры, а не на список жанров.

---

## 2. Theme

Primary — **сеттинг, который видит игрок**. Приоритет: (1) мета-история или сеттинг, если он есть; (2) если нет, то, что изображают фишки; (3) если фишки абстрактные (цвета, числа, камни) — `abstract`.

| value | Признаки |
|---|---|
| `abstract` | цвета, числа, геометрия, камни и кристаллы без сюжета |
| `magic_fantasy` | магия, волшебство, ведьмы, алхимия, зелья, драконы, эльфы, феи, фольклор (Баба Яга) |
| `monsters_combat` | монстры, враги, бои, оружие, армии, зомби, демоны |
| `romance_love` | любовь, свидания, пары, свадьба, Купидон, флирт |
| `treasure_adventure` | сокровища, пираты, экспедиции, археология, джунгли, затерянные города |
| `cute_animals` | милые животные как главные персонажи или фишки |
| `home_renovation` | дом, интерьер, ремонт, дизайн, строительство города или усадьбы |
| `food_household` | еда, сладости, кафе, кухня, продукты, уборка, бытовые предметы |
| `farm_garden` | ферма, огород, сад, урожай |
| `vehicles` | машины, поезда, парковка, транспорт |
| `space_scifi` | космос, роботы, будущее, киберпанк |
| `detective_mystery` | детектив, тайна особняка, расследование, поиск улик |
| `memes_pop_culture` | brainrot, скибиди, нубик/майнкрафт-подобные, блогеры, аниме-IP |
| `horror` | хоррор, маньяки, психушка |
| `realistic_neutral` | повседневность, спорт, СССР-ностальгия, реальные места, обучение |
| `unknown_mixed` | нельзя определить или равный микс без главного |

Secondary tags (не primary): `holiday_seasonal`, `kids`, `adult_18`, `anime`, `ussr_nostalgia`, `cozy_relax`.

### Неоднозначности theme

- **B1. Скин против сеттинга.** «Яга: Зелья судьбы» = water sort + фольклорная магия → `magic_fantasy`. «Магия Цвета» = water sort, «магия» только в названии → предложение `abstract` + secondary `magic_fantasy` с низким confidence.
- **B2. Маркетинговые слова** «приключение», «волшебный», «сокровище» (как награда), «сердца» (как жизни) не задают тему без сюжета или визуального сеттинга. В retrieval они дают основную массу ложных совпадений (см. `recall-audit.csv`).
- **B3. Пасьянс «Пирамида»** и маджонг «пирамиды» ≠ `treasure_adventure`.
- **B4. «Монстры» бывают милыми** (Candy Monster, Bubbles-Monsters). Если боя нет → `cute_animals`/`abstract` + `combat=none`.
- **B5. Hidden-object истории** часто совмещают `detective_mystery` + `home_renovation` + `treasure_adventure`. Primary — главный сюжетный крючок.

---

## 3. Meta

| field | values |
|---|---|
| `combat` | `none`; `cosmetic` (есть враги или «битва» в названии, но уровень решается как обычный puzzle); `core` (урон, HP, враги влияют на решение уровня) |
| `roguelite` | `true`, если есть забеги с рандомными апгрейдами или перками и потерей прогресса забега |
| `meta_layer` | `none`, `renovation_story`, `collection`, `rpg_progression`, `pvp_tournament`, `idle_economy`, `other` |

Candidate bucket `puzzle_combat_roguelite` из EXP-002 = `primary_mechanic ∈ puzzle-классы` И (`combat ≠ none` ИЛИ `roguelite`).

---

## 4. Соответствие candidate buckets EXP-002

| bucket | ось | целевое условие для LLM |
|---|---|---|
| `arrow_tapaway` | mechanic | primary или secondary = `arrow_tapaway` |
| `sort` | mechanic | `sort` |
| `screw` | mechanic | `screw` (с учётом A1) |
| `bubble` | mechanic | `bubble_shooter` |
| `merge` | mechanic | `merge` |
| `match3` | mechanic | `match3` |
| `puzzle_combat_roguelite` | mechanic × meta | см. §3 |
| `magic_fantasy_puzzle` | mechanic × theme | puzzle-класс × `magic_fantasy` (primary или secondary) |
| `romance_love_puzzle` | mechanic × theme | puzzle-класс × `romance_love` |
| `treasure_adventure_puzzle` | mechanic × theme | puzzle-класс × `treasure_adventure` |
| `extra_*` | mechanic | только для объяснения non-candidates в аудите recall |

Puzzle-классы: всё, кроме `non_puzzle` и `unknown`.
