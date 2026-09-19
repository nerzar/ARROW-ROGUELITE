# ASSET-007 — Goblin Grunt: отдельная поза HIT

STATUS: READY
TYPE: CONTENT (image generation brief, not a code task)
SIZE: S

## Контекст

Референс-лист уже принят пользователем: `.orchestra/reference-art/goblin-grunt/reference-sheet.png`
(3/4 hero, front/right/back/left, gameplay poses: IDLE, TAUNT, SHIELD-READY, CLUB ATTACK,
SHIELD BASH, **HIT/STUNNED**, ANGRY, + face expressions, equipment/rear variants, materials).

Панель "HIT/STUNNED" на листе — гоблин сидит на земле, звёзды над головой. Это **stunned**
(дезориентация/CC), не **hit** (боль/злость от урона). Отдельной позы для обычного попадания
нет вообще — её и нужно дорисовать.

## Что нужно сгенерировать

Один дополнительный кадр в том же стиле/освещении/пропорциях, что и остальные панели листа.

## Готовый промпт для ChatGPT

```
Reference: .orchestra/reference-art/goblin-grunt/reference-sheet.png (this repo).

Add ONE more gameplay pose panel for Goblin Grunt, matching this exact reference
sheet's art style, lighting, palette and proportions:

HIT — reaction to taking damage, NOT stunned: wincing in pain and anger, teeth
bared, shield and club still held up in ready position, eyes focused forward,
slight backward flinch/recoil. No stars, no dizzy spiral, no sitting down, no
unsteady stance — that is the separate STUNNED pose already on the sheet
(currently labeled "HIT/STUNNED" — please treat that existing panel as STUNNED
only going forward).
```

## Готово, если

- [ ] Новый кадр `HIT` — боль/злость, без звёзд, без потери стойки
- [ ] Существующая панель со звёздами переосмыслена как `STUNNED` (не переделывать её)
- [ ] Стиль/пропорции/палитра совпадают с остальными панелями листа
- [ ] Результат сохранён в `magicarrowassets/creatures/goblin-grunt/`, лучший кадр скопирован
      в `.orchestra/reference-art/goblin-grunt/hit.png` для последующей нарезки на прозрачный PNG

## Когда остановиться

Если ChatGPT не может нарисовать hit без звёзд/дезориентации даже после уточнения — сохранить
как есть и явно пометить проблему, не пытаться угадывать другими словами до бесконечности.
