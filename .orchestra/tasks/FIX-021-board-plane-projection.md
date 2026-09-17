# TASK: FIX-021 — Board Plane Projection + Arena Anchors

STATUS: READY
TYPE: FIX
SIZE: L
AGENT: Claude (implementation engineer)
BASE_BRANCH: build/BUILD-020-playable-slice-v01
BRANCH: fix/FIX-021-board-plane-projection
START_SHA: 19429f3f2cbdc96ddd12cd3da4ceb55b04fa623b

## Goal

Сделать доску частью арены, а не отдельным плавающим прямоугольником, и довести placement мобов/VFX до утверждённой композиции.

Пользователь утвердил направление:

- каменная плита / рамка арены неподвижна;
- вращается только внутренний puzzle-layer;
- puzzle-layer всегда fit'ится в один board plane;
- board plane визуально следует наклону/перспективе каменной плиты;
- Rotate не должен крутить весь каменный арт;
- после смены ориентации прямоугольного board внутренний слой автоматически масштабируется в тот же plane;
- gameplay geometry остаётся логической и прямоугольной; projection — только presentation/input mapping.

## User visual target

По текущему review пользователем явно указано:

1. DEFAULT board должен занимать центральную каменную плиту примерно как в согласованном референсе: широко, низко, визуально встроено в masonry, без ощущения floating card.
2. Side enemies сейчас "летают" — опустить их на реальные левый/правый каменные подиумы.
3. Prologue miniboss/Shaman — чуть увеличить и поставить по центру верхнего подиума.
4. Ground/telegraph wave под верхним мобом сейчас уходит в вертикальную стену/"землю" — поднять effect anchor на плоскость верхнего подиума.
5. При изменении позиции/размера board позиции actor slots должны оставаться согласованы с реальной ареной, а не зависеть от случайного boardRect.

## Architectural decision approved by user

Ввести маленькую projection abstraction, без большого renderer rewrite.

Ожидаемая модель:

- logical board coordinates: rectangular grid;
- visual board plane: 4 screen-space corner points (trapezoid/quadrilateral);
- `project()` переводит logical/normalized point -> screen point;
- `unproject()` переводит pointer screen point -> logical/normalized board point;
- rendering arrows/grid использует projection;
- click hit-testing продолжает работать через inverse mapping;
- stone frame/background НЕ вращается;
- puzzle-layer при Rotate вращается/меняет rows/cols и заново fit'ится в тот же board plane.

Если projective homography для текущего canvas кода окажется неоправданно сложной, допустим минимальный bilinear quad mapping при условии, что:

- визуально board совпадает с каменной плоскостью;
- inverse mapping устойчив для кликов;
- все существующие взаимодействия проходят browser test.

Не строить general-purpose scene engine.

## Suggested files

Разрешено менять только по необходимости:

- `.orchestra/tasks/FIX-021-board-plane-projection.md`
- `spikes/arrow-core/viewer/visual-proto/board-plane.js` + `.d.ts` (new, preferred)
- `spikes/arrow-core/viewer/visual-proto/board-renderer.js`
- `spikes/arrow-core/viewer/visual-proto/arena-layout.js` + `.d.ts`
- `spikes/arrow-core/viewer/visual-proto/app.js` только для минимального glue/debug
- `spikes/arrow-core/viewer/visual-proto/style.css` только если реально нужен presentation tweak
- integration/fix tests under `spikes/arrow-core/test/`

Не менять gameplay/core/encounter definitions.

## Board plane requirements

### Default composition

Board должен визуально лежать на центральной каменной плите.

Не использовать отдельную opaque panel/card за board, если это делает доску чужеродной.

Допустимы:

- лёгкая тёмная translucent подложка внутри stone plane для читаемости;
- subtle inner border/glow;
- clipping puzzle content по board plane.

Не добавлять новый decorative art самостоятельно.

Сгенерированный отдельный stone-board reference — только visual reference, не обязательный runtime asset.

### Dimensions

Проверить минимум:

- easy 6x7;
- medium 8x10;
- hard 10x12;
- rotated easy 7x6;
- rotated medium 10x8;
- rotated hard 12x10.

Board должен fit'иться без выхода из stone plane и без микроскопических стрел.

Сохранять разумный internal padding.

### Rotate

Rotate:

- НЕ вращает arena/background/frame;
- меняет orientation puzzle-layer;
- анимация допустима, но не обязательна для FIX;
- после rotate board снова fit в тот же plane;
- click mapping после rotate обязан соответствовать новой orientation.

Не менять Rotate gameplay semantics / charges / turn cost.

## Input / hit testing

Критично.

Все pointer/tap tests должны идти через обратное преобразование screen -> logical board.

Нельзя визуально наклонить board CSS-transform'ом и оставить старые axis-aligned hitboxes.

Проверить клики:

- углы;
- центр;
- длинные arrows;
- после CW;
- после CCW;
- после resize.

## Actor positions

Позиции actor slots должны задаваться относительно арены/stage, не boardRect.

### LEFT / RIGHT

- опустить side enemies на круглые/каменные боковые площадки;
- визуально стопы должны стоять на поверхности;
- не "висеть" над ступенями;
- сохранить mirror справа;
- HUD выше персонажа и не залезает на board.

### TOP / BOSS

- Shaman/miniboss строго по центру верхней площадки;
- увеличить умеренно относительно BUILD-020;
- feet anchor на верхнем подиуме;
- не перекрывать boss HUD;
- board после расширения/наклона не должен залезать под ноги босса визуально некрасиво.

## Effect anchors

Разделить character ground anchor и effect anchor, если сейчас это один и тот же расчёт.

Для TOP:

- telegraph/ring/wave должен лежать на верхней горизонтальной площадке под ногами;
- сейчас effect visually проходит ниже верхнего края field/в вертикальную стену — исправить.

Для LEFT/RIGHT:

- кольца/тени лежат на площадках, не на ступенях/воздухе.

Не менять сами VFX mechanics/timing.

## Debug

Добавить минимально полезный debug API, если нужно:

- `visualDebug.boardPlane()` -> corners / logical size / fit;
- `visualDebug.projectBoardPoint(...)`;
- `visualDebug.unprojectBoardPoint(...)`;
- actor/effect anchors.

Не добавлять production UI ради debug.

## No gameplay changes

STRICTLY DO NOT CHANGE:

- generator;
- solver;
- board topology;
- seeds;
- HP/damage/timers;
- Stone Pin;
- Rotate resource semantics;
- RunState;
- encounter content;
- Goblin/Wolf/Shaman state machines.

Если visual projection вскрывает gameplay bug — FOUND, не чинить самовольно.

## Verification

В `spikes/arrow-core`:

- `npm ci` если свежий worktree;
- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Browser минимум на:

- 1920x1080;
- 1366x768.

Сцены:

- Prologue miniboss (Shaman top);
- Act I #1 two side enemies;
- Act I #2;
- Act I #3;
- debug rock/pin scene;
- medium/hard board через debug/seed viewer, если sequence их ещё не использует.

Проверить вручную:

1. default board визуально встроен в central stone plane;
2. нет floating opaque card feel;
3. side enemies стоят на подиумах;
4. Shaman по центру и чуть крупнее BUILD-020;
5. top telegraph/effect не режется каменной стеной;
6. board кликабелен по всей площади;
7. rotate CW/CCW не ломает hit-testing;
8. rotated rectangular board fit'ится;
9. resize сохраняет projection;
10. HUD не перекрывает board/actors.

Сохранить screenshots:

- default easy;
- rotated easy;
- side-enemy encounter;
- Shaman boss;
- 1366 layout;
- biggest tested board.

## Delivery

Перед DONE:

1. RESULT / VERIFY / FOUND;
2. code commit(s);
3. task/report commit;
4. `git push origin fix/FIX-021-board-plane-projection`;
5. проверить `origin/fix/FIX-021-board-plane-projection == RESULT_SHA`;
6. только потом STATUS: DONE.

НЕ merge main.
НЕ удалять BUILD-020 или другие source branches.
