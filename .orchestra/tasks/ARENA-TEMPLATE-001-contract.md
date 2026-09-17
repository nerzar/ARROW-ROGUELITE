# TASK: ARENA-TEMPLATE-001 — Canonical Scene Geometry Contract

STATUS: DONE
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

## RESULT

- Created `docs/ARENA-TEMPLATE-V1-CONTRACT.md`:
  - Canonical Scene Geometry Contract for Arena Template v1.
  - Formulated the core production policy: clean stone board surface without baked grid lines/numbers, runtime rendering of grid/arrows/glow/FX, fixed scene camera and gameplay geometry, variable theme/background per biome/act, default usage of `DEFAULT_ARENA_GEOMETRY`, and exceptional overrides for special boss arenas.
  - Defined normalized 16:9 coordinate space [0.0 .. 1.0] and asset ingestion rules (strict 16:9 aspect to avoid `background-size: cover` silent cropping/shifting).
  - Specified normalized geometry points: `boardPlaneFrac.tl/tr/br/bl`, `anchors.top/left/right`, and `effectAnchors.top/left/right` (ground center vs foot baseline).
  - Formulated HUD and safe zones (top header margin y: 0.00 .. 0.12, side actor clearance corridor x: 0.05 .. 0.28 & 0.72 .. 0.95, bottom controls safe zone y: 0.88 .. 1.00).
  - Formulated tolerance rules (drift within +-1.5% for quad, +-0.5 deg keystone, +-2% for anchors) and strict REJECT criteria (baked grid on stone, perspective mismatch, missing/misplaced/clipped side podiums, 3D clutter on board, non-16:9 aspect).
  - Provided TypeScript metadata shape compatible with `arena-calibration.d.ts`, `board-plane.js`, and `arena-layout.js`.
  - Documented CAL-001 export mapping and generator / image acceptance checklists.

## VERIFY

- `docs/ARENA-TEMPLATE-V1-CONTRACT.md` created and verified.
- Checked document structure, 16:9 behavior, ASCII layout diagram, specification table, metadata definitions, and checklists.
- Verified compatibility with existing runtime contracts in `spikes/arrow-core/viewer/visual-proto/` (`boardPlaneFrac`, `anchors`, `effectAnchors`).
- Confirmed zero modifications to runtime game code, renderer, or gameplay logic.

## FOUND

- Past task FIX-023 demonstrated that baked-grid arenas lead to repetitive manual calibration and fragility when AI generators slightly warp perspective or when decorative elements confuse gradient detectors.
- Arena Template v1 policy with clean monolithic stone slabs resolves this by shifting grid rendering entirely to runtime homography projection, making any future square grid size (5x5, 6x6, 7x7, etc.) naturally fit the same background.

## Delivery

RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
