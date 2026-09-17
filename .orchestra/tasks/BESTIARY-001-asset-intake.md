# TASK: BESTIARY-001 — Creature Asset Intake

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: asset/content agent
BASE_BRANCH: fix/FIX-021-board-plane-projection
BRANCH: design/BESTIARY-001-asset-intake
START_SHA: edb56232beb3b46d322388c369cb598ccf9dccc1

## Goal

Разобрать новый локальный бестиарий как production-input: понять, какие creature packs уже готовы к runtime, какие неполные, какие состояния есть/нет. Не назначать им gameplay-роли без решения пользователя.

## Source

`C:\Users\nerza\Projects\magicarrowassets\creatures\`

На момент постановки пользователь показал как минимум:
- skeleton-child
- small-spider
- toxic-demonic-spider
- spider-brute
- small-goblin
- small-green-slime
- green-slime
- goblin-shaman
- dire_wolf
- goblin-king

Goblin Shaman, Dire Wolf, Goblin King/Taunter уже имеют существующие project integration/history — не дублировать их вслепую.

## Rules

- Не менять combat/enemy mechanics.
- Не решать, кто grunt/caster/tank/boss, если это не уже зафиксированный персонаж.
- Не генерировать новые изображения.
- Не импортировать всё в runtime автоматически.
- Не трогать renderer/layout.

## Required output

Создать `docs/BESTIARY-001-ASSET-INVENTORY.md`.

Для каждого creature folder:
- source files;
- transparent/opaque;
- apparent states/poses;
- consistency of identity;
- missing minimum states;
- suggested runtime filename mapping;
- estimated readiness: READY / NEEDS_CLEANUP / REFERENCE_ONLY;
- obvious art defects / AI artifacts if visible.

Минимальный ordinary-enemy runtime target для оценки:
- idle
- attack-ready or attack
- hit/stunned
- defeat

Caster/special actors могут требовать дополнительные states, но не придумывать их механику.

Отдельно дать SHORTLIST из 3 новых creature packs, которые дешевле всего интегрировать следующими, с фактическим обоснованием по готовности ассетов, а не по gameplay preference.

Не делать ranking по "лучший моб" — только readiness shortlist.

## Runtime prep

Разрешено создать data-only draft manifests под:
`spikes/arrow-core/viewer/visual-proto/assets/enemies/_candidates/`

Но НЕ копировать тяжёлые PNG без необходимости и НЕ подключать manifests в production code.

## Verify

Проверить файлы локально, размеры, альфа и naming consistency.

## RESULT / VERIFY / FOUND

Заполнить перед сдачей.

## Delivery

Commit -> push -> verify remote RESULT_SHA -> STATUS DONE.
Не merge main.
