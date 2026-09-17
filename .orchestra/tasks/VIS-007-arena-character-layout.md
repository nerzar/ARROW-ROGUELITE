# TASK: VIS-007 — Arena Character Layout

STATUS: IN_PROGRESS
TYPE: BUILD
SIZE: M
AGENT: Muse Spark (visual implementation agent)
BASE_BRANCH: origin/feat/VIS-006-dire-wolf-presentation
BRANCH: feat/VIS-007-arena-character-layout
START_SHA: 6bb7901352cac806f4898d71d14b5f539fc16edb

## Base

`git fetch --all --prune` выполнен. База — remote tip VIS-006 (`6bb7901`,
совпал с tip из постановки). Основной checkout (`design/ART-002-goblin-shaman`,
чужая параллельная работа) не тронут; работа в отдельном worktree
`C:\Users\nerza\Projects\ARROW-ROGUELITE-VIS007`.

## Зачем

Персонажи в legacy enemy panels выглядят иконками в HUD (contain-fit + clip),
пользователь такой layout как финальный НЕ принимает. Новая модель сцены:
CHARACTER рисуется на arena/stage (без рамки, без клипа), HUD — отдельно возле
персонажа и НЕ определяет размер спрайта.

## Scope

- Runtime-копия арены: `viewer/visual-proto/assets/arena-moonlit-fortress.png`
  (source `magicarrowassets/arenas/ChatGPT Image Sep 17, 2026, 09_24_35 AM.png`),
  manifest `background` → этот путь.
- Новый чистый модуль `arena-layout.js` (+ `.d.ts`): arena slots
  (TOP/boss, LEFT, RIGHT, board центр), visual footprints (boss крупный,
  side меньше но полноценные), HUD placement (name/HP/ATTACK IN/CAST IN/
  THROW IN отдельно, не перекрывает лицо/board, не клипует character).
  Никаких gameplay direction/side semantics не меняет — только пиксели.
- `board-renderer.js`: персонаж без panel-box и без clip (ground shadow +
  telegraph-эллипс у ног вместо box-кольца); HUD-пластина отдельно;
  E-side wolf mirror сохранён.
- `app.js`: без изменений логики; только `visualDebug.layout()` для проверки.
- Shaman: ТОЛЬКО slot/layout (manifest-резерв `assets/enemies/goblin-shaman/`,
  без state machine, без копирования PNG, без отрисовки).
- НЕ трогать: combat, RunState, Rotate, Stone Pin, seeds, timers, enemy HP,
  solver, generator, Goblin/Wolf state machines и их тесты.

## RESULT

Новая модель сцены внедрена: CHARACTER стоит на арене без рамки и клипа, HUD —
отдельная пластина возле персонажа и не определяет размер спрайта. Gameplay
(combat, timers, HP, seeds, state machines) не менялся.

Код:
- `viewer/visual-proto/arena-layout.js` (+ `.d.ts`) — чистый layout-модуль:
  footprints boss 2.8x3.6 / side 2.6x2.6 cells, slot distances boss 2.15 /
  side 1.9, `slotCenter` / `charBox` / `faceRect` / `hudBoxes` (пластина выше
  головы везде кроме S-слота; E/W пластины clamp наружу от board) /
  `spriteMirror` (R-side mirror) / `rectsOverlap` / `rotatedBoardBox`.
- `board-renderer.js`: персонаж без panel-box и без clip (тень + urgency-эллипс
  телеграфа у ног вместо box-кольца; castGlow-hook у ног сохранён); HUD
  (name/HP/ATTACK-CAST-THROW + бейджи) отдельно; длинные label усекаются с …
  до 1.8 ширины персонажа (числа не трогаются); margin считается от character
  stack отдельно для N/S; `debugLayout()` отдаёт per-frame rects для проверок.
- `app.js`: `slotStatusReserve` ({top,bottom} вместо top-only) +
  `visualDebug.layout()`; логика игры не тронута.
- `assets.js`: `background` → `assets/arena-moonlit-fortress.png`;
  `SHAMAN_MANIFEST` — только резерв слота (без загрузки/отрисовки/машины).
- `assets/README.md`: VIS-007 секции (layout + shaman slot).

Ассеты: runtime-копия арены `assets/arena-moonlit-fortress.png` (source
`magicarrowassets/arenas/ChatGPT Image Sep 17, 2026, 09_24_35 AM.png` —
Moonlit Fortress: центральный даис + боковые площадки; source не тронут).

State machines: VIS-005/VIS-006 без изменений (все их тесты зелёные);
pose swap на том же anchor — не прыгает.

Тесты (новых 13, весь сьют 182/182):
- `test/vis-007-arena-layout.test.ts`: footprints/slots, HUD выше головы
  (S — ниже ног), plate/char clear of board на всех сторонах, E/W clamp,
  baselines внутри пластины, mirror-правило, rect-хелперы.

## VERIFY

- `npm run typecheck` — чисто (в worktree сделан `npm ci`; node_modules не в git).
- `npm test` — 15 файлов, 182/182 PASS (в т.ч. 13 новых VIS-007).
- `npm run build` — чисто.
- Browser (headless Chromium 1228 + Python Playwright, serve.mjs :5184,
  скрипт `C:\Users\nerza\AppData\Local\Temp\opencode\vis007-verify.py`,
  prototype-only, не коммитится) — 28/28 PASS на 1920x1080 и 1366x768:
  - moonlit arena bg wired (`arena-moonlit-fortress.png` в bgLayer);
  - cp-e5: boss крупный (char h 94px / 61px), pose swap (cast) работает,
    фаза 2 на TOP, HUD строго выше спрайта, plate/face/board не пересекаются;
  - cp-e4: двое волков full-size (91px / 57px против ~30px иконок раньше),
    HUD clear, board кликабелен (tap в log), per-actor pose (hit/idle),
    kill → defeat у одного, второй жив;
  - rock-spike отдельно: рендерится без pageerrors (THROW-пластина, 4 строки).
- Screenshots (10, не коммитятся, `...\Temp\opencode\vis007-*`): before
  (VIS-006 иконки) vs after — персонажи стоят на платформах арены без рамок,
  HUD компактный, board читаем и кликабелен.

## FOUND

- Margin double-count (слот-дистанция считалась дважды) пойман тестами/скрином:
  на 1366 board сжимался до cell ~13px. Исправлено (need считается от края board).
- Headless-артефакт (не баг приложения): rAF идёт только по требованию, поэтому
  `visualDebug.layout()` читается после принудительного кадра (screenshot);
  pose-state чтения синхронны и в этом не нуждаются. Зафиксировано в скрипте.
- Пластина HUD: длинные boss phase-label усекаются с … (шире 1.8 персонажа не
  бывает); числа (HP/IN N) не усекаются никогда.
- E/W пластины при экстремально мелком cell теоретически могут выйти за край
  canvas наружу (защита board важнее) — на 1366/1920 не наблюдается.
- Shaman pack существует локально (`goblin-shaman/`: idle/taunt/cast/
  stunned-hit/angry/defeat/back) — зарезервирован только slot; state machine
  и интеграция — отдельная задача.
- В `goblin-king/` появились новые файлы (`11_36_42 AM.png`, `11_39_35 AM.png`
  одинакового размера, `09_41_05 AM (2).png`) — не в scope, VIS-005 pack
  не тронут.
- cp-e4 — provisional-контент EXP-010b; обе enemies-панели рисуют волка
  (Dire Wolf — единственный ordinary visual).
