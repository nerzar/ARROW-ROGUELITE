# Magic Arrow — варианты технической основы

> Статус: RESEARCH / ARCHITECTURE HYPOTHESIS. Ничего ниже не считается окончательно утверждённым без решения пользователя.

## 1. Не выдирать закрытую VK-игру как основу

Технически браузер отдаёт клиентский JS/ассеты, но это плохая база:

- лицензия и право на повторное использование неизвестны;
- production bundle обычно собран/минифицирован и плохо поддерживается;
- чужая архитектура не рассчитана на projectile combat, bosses, run-state и VK monetization;
- любые чужие ассеты/музыка/эффекты могут иметь отдельные права.

Закрытые игры использовать как gameplay/reference material. Код брать только из проектов с явной совместимой лицензией.

## 2. Рабочий стек-кандидат

Текущий кандидат для web/VK:

- Phaser 4;
- TypeScript;
- Vite;
- React только для сложного meta/UI слоя (shop, inventory, dailies, settings), если он действительно понадобится;
- VK Bridge за platform adapter.

Phaser 4 уже имеет современный WebGL renderer, particles, filters/effects, lighting и custom shaders. Это снижает необходимость писать собственный render/VFX слой.

## 3. Откуда брать puzzle-core

Не обязательно изобретать алгоритмы с нуля. Можно использовать открытые реализации как источник идей/кода только при явной лицензии.

### Разрешённые кандидаты для дальнейшего аудита

- `gtxPrime/arrow-escape` — MIT; Flutter/Flame; содержит deterministic procedural generation, verified solvable levels и подробную спецификацию генератора. Код напрямую не подходит стеку, но алгоритмы можно портировать в TypeScript с соблюдением MIT.
- `sergev/goarrows` — MIT; Go; есть board model, solver/validation и generation. Подходит как второй независимый источник для сверки алгоритмов.
- `SERAP-KEREM/Arrows` — MIT; Unity; полезен как reference по line/arrow architecture, но тащить Unity в VK web-проект не планируется.

### Reference only

- `AlenSarangSatheesh/Arrow-Escape-Game` — очень подходящий Vanilla TypeScript/Vite reference с reverse-construction generator и большим набором property tests, но в репозитории не найден LICENSE. До явного разрешения автора код не копировать; можно изучать публично описанные идеи и реализовать независимо.

## 4. Генерация уровней

Не делать LLM обязательным runtime-генератором.

Базовая система должна быть:

`seed -> procedural generator -> solver/validator -> difficulty scorer -> accepted level`

Причины:

- гарантированная воспроизводимость;
- отсутствие API/latency/cost dependency;
- можно математически проверять solvability;
- можно заранее генерировать тысячи уровней и тестировать их в CI.

LLM/агенты могут работать **offline**:

- придумывать shapes/themes;
- искать интересные constraints;
- собирать encounter-комбинации;
- анализировать тысячи сгенерированных уровней;
- предлагать параметры сложности.

Но финальный уровень принимает только deterministic validator.

Для Magic Arrow генератор позднее должен учитывать не только Tap Away solvability, но и encounter-state:

- распределение стрел по направлениям;
- количество нужных Rotate;
- внешние цели по сторонам;
- hit/damage budget;
- доступный run-kit игрока;
- required/optional bonus powers;
- boss rules.

## 5. "Нерешаемые без бонусов" уровни

Рабочая идея пользователя: позднее часть encounter может быть рассчитана на boosters/meta powers/run items, а получение дополнительной способности возможно через игровые активности, rewarded ad или purchase.

Это **не** означает случайно генерировать тупик. Генератор/solver должен знать loadout и помечать уровень, например:

- `baseline-solvable`;
- `booster-helpful`;
- `power-gated`;
- `challenge/optional`.

Так можно контролировать, когда игрок впервые встречает gate и какие бесплатные пути получения нужной силы уже существуют.

Монетизацию проектировать отдельно после исследования VK и retention-risk. Пролог и раннее обучение не должны неожиданно превращаться в платёжный gate.

## 6. Content data

Игровые параметры не размазывать по коду.

Рабочий вариант:

```text
content/
  enemies.json
  bosses.json
  upgrades.json
  relics.json
  arrow_forms.json
  encounters.json
  economy.json
```

JSON/TS data валидировать schema validator'ом (например Zod или аналогом). На этапе prototype отдельная SQL-БД runtime не нужна.

Серверная БД понадобится позже для вещей, которым нельзя доверять клиент:

- purchases/receipts;
- premium currency;
- authoritative inventory;
- cloud progress;
- leaderboard/anti-cheat.

## 7. Ассеты

Prototype:

- CC0 / commercial-use packs для временных мобов/UI;
- AI-generated coherent static sprites для проверки art direction;
- procedural animation: tween, squash/stretch, hit flash, trail, particles, glow, camera shake.

Final art:

- собственный единый style bible;
- AI + ручная правка/доработка;
- modular enemy sets и boss layers вместо сотен уникальных покадровых анимаций.

Для поиска временных паков пригодны OpenGameArt CC0 и itch.io commercial-use packs. Лицензию каждого конкретного asset pack фиксировать в `THIRD_PARTY_ASSETS.md`.

## 8. VFX

До покупки большого VFX bundle сначала использовать возможности Phaser 4:

- filters / glow / bloom-like effects;
- particles;
- lighting;
- custom shaders;
- additive blending;
- trails;
- camera effects.

Отдельные sprite-sheet VFX packs нужны только там, где они реально дают больше качества, чем процедурные эффекты: magic impacts, explosions, smoke, runes и т.п.

## 9. Следующее исследование

Перед окончательным выбором базы:

1. найти 15–30 open-source Arrow/Tap Away repos;
2. отсеять всё без явной лицензии;
3. сравнить generator/solver/tests/data model;
4. выбрать, что портировать/переиспользовать;
5. только после этого Claude Opus фиксирует technical foundation proposal.
