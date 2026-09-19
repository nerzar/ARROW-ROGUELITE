# TASK: ART-010B — PC-first UI Style Pass

STATUS: READY
TYPE: ART
SIZE: S
BASE_BRANCH: docs/ART-REFS-001-visual-reference-pack
START_SHA: 5a4c3671b6a8e529f8beaae26f3f85f23b997271
BRANCH: art/ART-010B-pc-ui-style-pass

## Цель

Сделать ещё 3 сильных UI-направления для **PC/web версии**: проще, чище и спокойнее предыдущего ART-010, но всё ещё как часть текущей premium stylized fantasy игры.

Финальный стиль выбирает пользователь.

## Канонические референсы — обязательно

Сначала прочитать и посмотреть глазами:

- `docs/visual-refs/README.md`
- `docs/visual-refs/current-game/01-combat-main.png`
- `docs/visual-refs/current-game/02-combat-overlay.png`
- `docs/visual-refs/current-game/03-hud-player.png`
- `docs/visual-refs/current-game/04-scene-composition.png`
- `docs/VISUAL-DIRECTION.md`

Это главный визуальный источник. Верхняя admin/debug-плашка не является частью игрового UI.

## Новый контекст от пользователя

Нужна **desktop-first / PC-first** версия:
- дизайн заметно проще;
- меньше тяжёлых fantasy-рам, фасок и декоративных слоёв;
- без mobile-casual вида;
- без sterile flat UI;
- аккуратно, со вкусом, с хорошей иерархией;
- board и arena остаются главными;
- glow/magic — локальный акцент, не постоянный шум.

Не копировать предыдущие ART-010 варианты один-в-один. Это новый pass по пользовательской обратной связи.

## Что сделать

Подготовить **3 разных, но совместимых с текущей игрой** направления.

Для каждого на одном compact board показать:
- panel / surface;
- button + hover/focus idea;
- player HUD fragment;
- HP bar;
- Rotate/resource chip;
- enemy HUD fragment (timer + HP, не менять его смысл);
- reward/item card frame;
- popup/header;
- typography;
- palette/materials;
- glow/accent rules;
- 1–2 строки motion language.

Можно проверить такие векторы как отправную точку, но не обязан держаться названий:
- dark slate / restrained gold;
- stone & brass lite;
- graphite + restrained arcane accent.

## Ограничения

- PC-first, ориентир — канонические 1280×800 сцены.
- Не менять gameplay, combat flow и approved filled-arrow renderer.
- Не делать production UI.
- Не превращать UI в тяжёлый ornate fantasy.
- Не делать всё полупрозрачным glassmorphism.
- Не использовать glow как постоянную окантовку каждого элемента.
- Enemy timer + HP остаются частью gameplay/readability.
- Читаемость важнее декора.
- Не выбирать финальный стиль за пользователя.

## Результат

Сохранить в ветке:
- compact visual board / mockup;
- короткий markdown: чем отличаются 3 варианта, сильные/слабые стороны, какой стоит проверить первым и почему.

Результат должен быть быстро сравним глазами рядом с текущими скринами.

## Готово, если

- все 3 варианта явно PC-first и проще первого ART-010 pass;
- каждый выглядит частью канонических current-game сцен;
- board/arena визуально важнее UI;
- есть полный набор обязательных primitives;
- есть рекомендация для следующего мокапа, но нет принятого финального стиля;
- результат push'нут в `origin/art/ART-010B-pc-ui-style-pass`.

После сдачи STOP.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: —
- VERIFY: —
- FOUND: —
- STATUS: READY
