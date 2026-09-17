# TASK: ARENA-TEMPLATE-001 — Canonical Scene Geometry Contract

STATUS: READY
TYPE: DESIGN
SIZE: S
AGENT: Gemini / technical design
BASE_BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
BRANCH: design/ARENA-TEMPLATE-001-contract
START_SHA: 5d5730a831db197f532e56bf66018902fa7c4042

## Goal

Подготовить короткий технический контракт для будущего `Arena Template v1`, чтобы после выбора одной canonical сцены новые арены генерировались с одной геометрией и не требовали ручной перекалибровки каждый раз.

ВАЖНО: пользователь ещё не просит фиксировать конкретное изображение в production в этой задаче. Нужен контракт/чеклист и схема данных, совместимая с CAL-001.

## Required contract

Определить минимальный набор normalized geometry:

- board plane TL/TR/BR/BL;
- TOP actor anchor;
- LEFT actor anchor;
- RIGHT actor anchor;
- TOP/LEFT/RIGHT effect anchors;
- optional HUD safe zones;
- expected 16:9 canvas behavior;
- allowed tolerance for generated arena drift before image is rejected instead of recalibrated.

## Production policy to encode

- arena art has clean stone board surface;
- no baked gameplay grid required for future production template;
- runtime renders grid/arrows/glow/FX;
- background/theme may change;
- camera and gameplay geometry should stay fixed;
- exceptional arenas may override geometry, but normal arenas should use DEFAULT_ARENA_GEOMETRY.

## Output

Create:
`docs/ARENA-TEMPLATE-V1-CONTRACT.md`

Keep it practical:
- normalized coordinate diagram/table;
- generator/reference checklist;
- acceptance checklist for a new generated arena;
- recommended metadata shape;
- how CAL-001 exports values into this contract.

Do NOT guess final numbers for the canonical arena. Those are chosen/calibrated by the user/tool later.

## Do not

- no renderer changes;
- no gameplay changes;
- no new arena art;
- no automatic image analysis pipeline;
- no merge main.

## Delivery

RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
