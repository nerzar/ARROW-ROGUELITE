# TASK: FIX-023 — Grid-calibrated board projection + side actor anchors

STATUS: READY
TYPE: FIX
SIZE: M
AGENT: Claude / Sonnet
BASE_BRANCH: build/BUILD-022-board-integration-v01
BRANCH: fix/FIX-023-grid-calibrated-board-and-side-anchors
START_SHA: 27dff46db09e3bb971dbb309f2db026b20fedff3

## Goal

Исправить два визуальных блокера после BUILD-022:

1. Боковые мобы стоят слишком высоко и выглядят так, будто парят над пьедесталами. Центральный/top actor стоит корректно и служит эталоном посадки по ногам.
2. Puzzle arrows визуально не совпадают с размеченной каменной сеткой арены: перспектива, масштаб и привязка к клеткам неверны. Это core mechanic и приоритет №1.

## Accepted direction

- Арена САМА является board surface / frame.
- Никакого отдельного board background/frame поверх сцены.
- Для baked-grid арен использовать реально размеченную 5x5/6x6 сцену.
- Puzzle content должен ложиться прямо на существующие каменные клетки.
- Для 6x6 baked arena логический 6x6 board должен совпадать cell-to-cell с видимой 6x6 сеткой.
- Для 5x5 baked arena — то же для 5x5.
- Старые прямоугольные encounters не переделывать здесь; они могут оставаться на flexible arena regression path.

## Inputs

Read first:

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/tasks/BUILD-022-board-integration-v01.md`
- `docs/ARENA-002-PROLOGUE-ACT1-PACK.md` from `design/ARENA-002-prologue-act1-pack`
- `spikes/arrow-core/viewer/visual-proto/arena-pack-002.js` from that branch
- existing `board-plane.js`, `board-renderer.js`, `arena-layout.js`

Do not blindly merge ARENA-002. Import only the data/assets needed for one marked proof arena first.

## Proof arena first

Use one TRUE baked-grid 6x6 candidate from ARENA-002 as the primary calibration scene. Prefer a visually compatible moonlit/prologue candidate if convenient; exact filename must be recorded in RESULT.

Do NOT calibrate against the old flexible Moonlit Fortress wall by eye.

The first milestone is ONE convincing 6x6 proof scene where the runtime arrows align to the visible baked grid.

After that, verify one TRUE 5x5 arena.

## Board calibration

Current BUILD-022 projection is not visually accepted.

The renderer must align logical cell geometry to the baked arena grid.

At minimum define per-arena calibration metadata sufficient to map:

- logical cell corners / centers
- arrow path centerlines
- arrow heads
- click hit-testing
- selection/glow/VFX

onto the visible stone grid.

Do not rely only on a generic guessed trapezoid if it visibly misses the baked lines.

Preferred implementation:

- exact board/grid quad from the selected arena;
- projective/homography-style mapping from logical normalized board coordinates to that quad;
- if the generated art deviates enough that four corners are insufficient, allow small per-arena row/column calibration data rather than hardcoding renderer magic numbers.

Debug mode must be able to draw the projected 7x7 grid intersections/lines for a 6x6 board (or 6x6 intersections for 5x5) so alignment can be judged directly against the baked grid.

## Perspective-sensitive arrow rendering

Arrow visuals must feel embedded in the sloped stone plane, not pasted on top.

The same projection source of truth must drive:

- path points;
- arrowheads;
- stroke width / head size perspective scale;
- selection glow;
- hit/shot/impact FX;
- pointer hit-testing.

Far/top cells should visually read smaller than near/bottom cells when the arena perspective requires it.

Do not redesign the arrow art style in this task beyond what is necessary for correct perspective/alignment.

## Actor anchors

Current side actors/wolves visually float.

- Keep TOP/center actor anchor behavior that already looks correct.
- LEFT and RIGHT must use the selected arena's actual podium foot baselines.
- Do not fix this with one global pixel offset for every arena.
- Prefer per-arena LEFT/RIGHT anchors from arena metadata.
- Actor feet/content bbox must visually touch the platform surface.
- HUD stays independent from sprite anchor.

## Runtime scene contract

For baked-grid arena:

arena art -> baked stone grid -> projected runtime arrows/glow/VFX -> actors/HUD

There must be NO extra board panel/background/frame.

## Scope

Allowed:

- task card
- arena calibration metadata / one or two selected arena assets
- `board-plane.js` / `.d.ts`
- `board-renderer.js`
- `arena-layout.js`
- minimal loader/glue
- focused tests/debug tooling

Do NOT change:

- combat rules
- generator semantics
- encounter balance
- HP/timers
- Rotate semantics
- Stone Pin
- RunState
- production run order

## Verify

Browser verification required:

1. TRUE 6x6 marked arena + real 6x6 logical board.
2. TRUE 5x5 marked arena + real 5x5 logical board.
3. Debug projected grid lines/intersections visually align with baked grid.
4. Click first/last row and column, corners and center.
5. Rotate CW/CCW and confirm mapping remains correct.
6. Arrow glow / hit / projectile FX use the same geometry.
7. Side actors LEFT/RIGHT stand on podiums; TOP/center remains correct.
8. 1920x1080 and 1366x768.
9. One existing rectangular encounter remains functional on the flexible regression arena; do not force it onto a baked 6x6.

Run:

- `npm run typecheck`
- `npm test`
- `npm run build`

## Delivery

Before DONE:

1. fill RESULT / VERIFY / FOUND;
2. code commit separately from bookkeeping where practical;
3. push `fix/FIX-023-grid-calibrated-board-and-side-anchors`;
4. verify remote HEAD;
5. STATUS DONE only after remote verification.

Do not merge main.
