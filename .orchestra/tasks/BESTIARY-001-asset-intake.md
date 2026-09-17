# TASK: BESTIARY-001 — Creature Asset Intake

STATUS: DONE
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

## RESULT

Audited all 10 folders in `C:\Users\nerza\Projects\magicarrowassets\creatures\`
(78 PNGs): PIL stats per file (dimensions, mode, alpha range, transparent %)
+ visual sampling of every pose/cutout. Deliverable:
`docs/BESTIARY-001-ASSET-INVENTORY.md` (per-folder files, transparency,
states, identity, missing states, suggested runtime mapping, readiness,
defects) + data-only draft manifests for the shortlist under
`spikes/arrow-core/viewer/visual-proto/assets/enemies/_candidates/`
(no PNGs copied, nothing wired into loaders).

Readiness: READY (rename-only) — `green-slime`, `small-goblin`,
`toxic-demonic-spider`, `small-spider`, `spider-brute`. NEEDS_CLEANUP —
`skeleton-child` (helmet/shield variant drift, no clean hit), `small-green-slime`
(no attack state). REFERENCE_ONLY — all 10 opaque concept/turnaround sheets.
INTEGRATED already (excluded from shortlist) — `dire_wolf`, `goblin-shaman`,
`goblin-king` (runtime packs exist via VIS-005/VIS-006/VIS-008).
SHORTLIST (readiness only, no gameplay ranking): `small-spider`,
`spider-brute`, `green-slime`; equal-cost alternates `small-goblin`,
`toxic-demonic-spider`. No gameplay roles assigned, no images generated,
no renderer/layout/mechanics changes.

## VERIFY

- `python3 -c` PIL audit over all 78 source files: dimensions/mode/alpha recorded
  in the inventory tables; one byte-duplicate found by md5
  (`goblin-king/ChatGPT …10_30_02 AM (3).png` == `stuned.png`).
- Every gameplay cutout visually sampled (thumbnails in Temp, originals untouched);
  identity/defect notes in the doc are backed by viewed pixels.
- Candidate JSONs parsed (`JSON OK`); `git status` confirms no PNGs copied and no
  loader/renderer files touched by this task.
- Pre-existing dirty `board-renderer.js` ( чужой BUILD-022 change) left untouched
  and NOT committed; only task files staged by explicit path.

## FOUND

- `goblin-king` duplicate file (delete candidate) + 2 spares with painted
  backgrounds (need bg removal if ever used) + `indle`/`stuned` typos.
- `skeleton-child` helmet/shield variant drift; only dazed cutout wears helmet.
- `small-green-slime` has no attack state; worst filename hygiene
  (`taunt. - jump -up.png`).
- Light AI-cutout edge fringe on all packs (uniform, incl. integrated ones) —
  defringe-on-import suffices.
- Suggested follow-ups (not started): skeleton variant decision, small-green-slime
  attack state, goblin-king spare bg removal.
