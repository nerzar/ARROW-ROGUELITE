# ASSET-008 — Goblin Matron: отдельная поза HIT

STATUS: READY
TYPE: CONTENT (image generation brief, not a code task)
SIZE: S

## Контекст

Референс-лист: `.orchestra/reference-art/goblin-matron/reference-sheet.png` (свежая версия,
чище листа Grunt — уже без лишних ready/shield-bash/angry дублей: IDLE, TAUNT (POINT), ATTACK
(BABIES THROW ROCKS), HIT/STUNNED, DEFEATED).

Та же проблема, что у Grunt: панель "HIT/STUNNED" — Matron сидит, звёзды над головой = stunned,
не hit. Отдельной позы для обычного попадания нет.

Matron — чистый рэнджер (её единственная атака — бросок камня руками детёнышей), поэтому
отдельный `cast` ей не нужен: `ATTACK (BABIES THROW ROCKS)` уже покрывает то, что обычно было
бы cast-ом у кастера с двумя разными атаками.

## Готовый промпт для ChatGPT

```
Reference: .orchestra/reference-art/goblin-matron/reference-sheet.png (this repo).

Add ONE more gameplay pose panel for Goblin Matron, matching this exact reference
sheet's art style, lighting, palette and proportions:

HIT — reaction to taking damage, NOT stunned: wincing in pain and anger, gritted
teeth, still standing upright and braced, babies on her back reacting startled
but still holding rocks (not thrown away), slight backward flinch/recoil. No
stars, no dizzy spiral, no sitting down — that is the separate STUNNED pose
already on the sheet (currently labeled "HIT/STUNNED" — please treat that
existing panel as STUNNED only going forward).
```

## Готово, если

- [ ] Новый кадр `HIT` — боль/злость, поза устойчивая, без звёзд
- [ ] Существующая панель со звёздами — это `STUNNED`
- [ ] Стиль/палитра/пропорции совпадают с остальными панелями листа
- [ ] Лучший кадр скопирован в `.orchestra/reference-art/goblin-matron/hit.png`

## Когда остановиться

Если ChatGPT не может нарисовать hit без звёзд/дезориентации даже после уточнения — сохранить
как есть и явно пометить проблему, не пытаться угадывать другими словами до бесконечности.
