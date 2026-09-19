# ASSET-005 — Stunned pose roster (future ordinary-enemy state)

STATUS: READY
TYPE: CONTENT (image generation brief, not a code task — no branch/executor workflow)
SIZE: M

## Контекст

Обычный враг (`ENEMY_POSES` в `spikes/arrow-core/viewer/visual-proto/enemy-visual-state.js`)
сейчас использует 5 поз: `idle | attackReady | attack | hit | defeat`. `hit` — короткий флинч
от урона (500мс), не полноценная потеря хода. У боссов (`BOSS_POSES` в `boss-visual-state.js`)
`stunned` уже существует как отдельная от прочих поза. У обычных врагов такого отдельного
"стана" нет ни в коде, ни в арте — пользователь явно попросил завести его заранее, "на будущее"
(готовим почву под будущие CC-эффекты из COMBAT-001's enemy ability framework), не путая его
с обычным hit-флинчем.

Это бриф для генерации арта (ChatGPT-в-браузере), не задача на код. Код (`ENEMY_POSES` +
`enemy-visual-state.js` + `assets.js`) намеренно не трогаем сейчас — только готовим арт заранее,
чтобы когда понадобится реальный stun-эффект, оставалось подключить уже готовые калиброванные
файлы тем же паттерном, что и остальные позы.

## Ростер: кому нужен `stunned`

Все 8 обычных врагов (только они; у бустов `stunned` уже есть):

| Species | Путь | Уже есть (для референса стиля) |
|---|---|---|
| dire-wolf | `assets/enemies/dire-wolf/` | idle, attack-ready, lunge, hit, defeat |
| green-slime | `assets/enemies/green-slime/` | idle, attack, attackReady, hit, defeat |
| small-green-slime | `assets/enemies/small-green-slime/` | idle, attack, attackReady, hit, defeat |
| small-goblin | `assets/enemies/small-goblin/` | idle, attack, attackReady, hit, defeat |
| spider-brute | `assets/enemies/spider-brute/` | idle, attack, attackReady, hit, defeat |
| small-spider | `assets/enemies/small-spider/` | idle, attack, attackReady, hit, defeat |
| toxic-demonic-spider | `assets/enemies/toxic-demonic-spider/` | idle, attack, attackReady, hit, defeat |
| skeleton-child | `assets/enemies/skeleton-child/` | idle, attack, attackReady, hit, defeat |

Все пути — относительно `spikes/arrow-core/viewer/visual-proto/`.

## Правило имени файла (важно — это то, что сегодня сломалось)

Файл должен называться **строго** `stunned.png`, ничего другого. В папках уже валяются
разнобойные старые алиасы — `stun.png`, `stun-hit.png`, `hit-stun.png`, `death.png` — это
мусор от прошлого прохода генерации, из-за которого код molча не подхватывал уже нарисованный
арт (см. `ASSET-004`, коммит `bf99793`). Новый файл **не переиспользует** эти имена и **не
трогает** их — просто кладётся рядом как `stunned.png`.

## Композиция / стиль

- Тот же контракт anchor/scale, что у `hit.png`/`defeat.png` этого же вида: bottom-center
  ground anchor, тот же масштаб и пропорции кадра, что у соседних поз в той же папке — рисовать
  глядя на существующие PNG этого вида как референс палитры/пропорций/освещения.
- Отличие от `hit` по читаемости на глаз: `hit` — короткий флинч (полсекунды, "меня задело"),
  `stunned` — устоявшийся жанровый язык "выведен из строя" (кружащиеся звёзды/спираль над
  головой, пошатывание, скошенные/помутневшие глаза, руки слегка опущены) — должно читаться
  как отдельное состояние даже кадром, без анимации.
- Не создавать `angry`/`taunt`/`cast`/`back` для обычных врагов — это боссовые позы, `green-slime`
  и `small-goblin` уже случайно нахватали такие файлы, они не используются кодом и не нужны.

## Готово, если

- [ ] 8 файлов `assets/enemies/<species>/stunned.png`, по одному на вид выше
- [ ] Ни один не переиспользует старое имя (`stun*`, `death`, `hit-stun` и т.п.)
- [ ] Композиция/пропорции визуально согласованы с существующими позами того же вида
- [ ] Калибровка pivot/anchor сделана вручную в Pose Editor (`calibration-editor.html`) —
      генерация арта это не заменяет

## Когда остановиться

Если для какого-то вида непонятно, как показать "stunned" не копируя `hit` почти один в один —
пропустить этот вид и явно отметить, какой именно, не гадать с композицией.
