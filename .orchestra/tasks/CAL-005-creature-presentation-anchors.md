# TASK: CAL-005 — Creature Presentation Anchors

STATUS: DONE
TYPE: TOOL/FIX
SIZE: M
BASE_BRANCH: main
BRANCH: tool/CAL-005-creature-presentation-anchors
START_SHA: a0de83d74c001cd5f98a9f556b9ca227622419a7

## Goal

Расширить существующий Pose/Calibration workflow так, чтобы presentation существа можно было нормально подогнать под арт, а HUD не уезжал за видимую область.

## Нужно

1. Добавить species-level HUD offset X/Y с live preview.
   Один общий anchor/offset должен двигать привязанные к мобу элементы presentation:
   - HP bar;
   - attack timer / ATTACK IN;
   - cast/status UI, если они используют тот же HUD anchor.

2. Проверить существующий species pivot/anchor.
   Сейчас есть подозрение, что pivot применяется не везде одинаково.
   Editor preview и playable runtime должны трактовать pivot одинаково на idle/attack/hit/defeat и для boss/обычного моба.

3. Если это не требует большого рефакторинга — добавить species-level shadow offset X/Y.
   Тень двигается независимо от art pivot.
   Если для этого нужен заметный renderer rewrite — остановиться и записать FOUND, не расширять scope молча.

4. Сохранение/reload.
   Новые presentation defaults должны сохраняться рядом с текущими species pivot/scale и после reload давать тот же результат.
   Существующие сохранённые данные должны оставаться совместимыми.

## Existing local authoring data to protect

В worktree BUILD-034 сейчас есть незакоммиченные изменения, созданные через Pose Editor:
- `creature-poses.json`: Goblin Shaman scale/pivot и Dire Wolf pose/pivot;
- `assets/enemies/dire-wolf/idle.png`.

Это НЕ считается автоматически принятым контентом CAL-005.

Перед любым cleanup:
- не откатывать и не терять эти файлы;
- сначала сохранить snapshot/отдельный commit/ref;
- при работе CAL-005 использовать их только как возможный исходный authoring data после проверки, а не тащить молча в результат.

## Boundaries

- Не менять combat/gameplay.
- Не менять arrow renderer.
- Не делать per-pose HUD/shadow настройки без отдельного решения пользователя.
- Per-scene calibration, если она уже существует для соответствующего параметра, остаётся финальным override.

## Verify

Проверить минимум:
- Goblin Shaman;
- Goblin King;
- Dire Wolf или обычный mob;
- defeat pose;
- смену poses в editor;
- save -> reload -> playable runtime;
- HUD не вылезает из видимой области после ручной настройки;
- tests + typecheck + build.

## Done

Пользователь может в editor для вида существа настроить:
- pivot X/Y;
- scale;
- HUD offset X/Y;
- shadow offset X/Y, если реализовано без крупной переделки;

сохранить и увидеть то же положение в реальной игре.

В конце коротко: RESULT / VERIFY / FOUND. Не merge в main.

## RESULT

SHA: 6580e68f08a99aba9768e008eec15f71f9076dcf (code c3a888b + report; код неизменен после c3a888b)

Сделано в `spikes/arrow-core`, только presentation-слой, gameplay/arrow renderer не тронуты:

1. Species-level HUD offset X/Y (`species-presentation.js`: `speciesHudOffset`, дефолт `{0,0}`).
   Один anchor двигает всю plate: HP bar, name/HP/ATTACK IN/CAST IN/THROW IN строки и оба badge —
   через новый опциональный `offset` в `hudBoxes()` (`arena-layout.js`) + `lineX`.
2. Species-level shadow offset X/Y (`speciesShadowOffset`, дефолт `{0,0}`) — без рефакторинга
   renderer: `+2` строки в `drawTarget` (`board-renderer.js`). Тень уже была независима от pivot,
   offset добавляется поверх.
3. Pivot parity editor/runtime: Pose Editor preview переведён на точную runtime-формулу
   (contain-fit в footprint + per-pose `ANCHOR.offsets` + `(pivot - DEFAULT)` delta + scale);
   pivot-dot теперь в image fractions (липнет к арту), `DEFAULT_PIVOT` берётся из
   `species-presentation.js` (был второй рассинхронизированной копией). HUD/shadow моки в preview
   используют настоящий `hudBoxes` / footprint fractions.
4. Save/reload: `serve.mjs` валидирует и хранит `hudOffset`/`shadowOffset` рядом с pivot/scale;
   `applyPoseOverrides` прокидывает их в runtime. Старые записи без ключей читаются как `{0,0}`.
5. Per-scene `spritePivot` остаётся финальным override для арта (прибавляется последним, как раньше).
   Per-scene HUD/shadow параметра не существует — species offset единственный слой.
6. `layoutInfo` отдаёт `shadow` (canvas coords) для авточеков.

Не использовано/не потеряно: BUILD-034 WIP (stash-коммит `9eb4d40`, `creature-poses.json` diff +
`dire-wolf/idle.png` + `campaign.json`) оставлен как есть; тестовые save в браузере откачены
(`creature-poses.json` в дифф не входит, PNG побайтово идентичны). Контентных значений не шиплю —
только возможность настраивать.

## VERIFY

- `npm run typecheck` — OK; `npm run build` — OK; `npm run test` — 27 файлов / 320 тестов OK,
  включая новый `test/cal-005-creature-anchors.test.ts` (10 тестов: дефолты, merge, malformed,
  pre-CAL-005 shape, сдвиг bar/plate/badge/lines одним offset, S-side).
- Browser (Playwright/Chromium, свой сервер на :5178; :5177 занят сервером MAIN — не трогал):
  Pose Editor — shaman 7/7 поз, wolf 5/5, taunter пустое состояние без ошибок (нет authored entry,
  галерея 10 файлов); overlays laid out; save persist + reload restore offsets;
  playable cp-e4 — plate сдвинулась ровно на offset*footprint (d=(20.1,-32.4) vs exp (20.1,-32.2)),
  badge тем же anchor, тень только на shadowOffset (d=(8.1,24.0) vs exp (8.1,24.2)),
  char box неизменен (w/h точно, y в пределах idle bob);
  defeat pose — shaman, goblin-taunter (через `showBossPack`), wolf — все видимы;
  смена поз в editor; реальный tap в playable (alive 10→9, без ошибок);
  calibration editor грузится чисто; pageerrors — 0.
- Скриншоты: `C:\Users\nerza\AppData\Local\Temp\opencode\cal005\` (pose-editor-shaman, shaman-defeat,
  king-defeat, wolf-defeat, playable-after-tap).

## FOLLOW-UP (user review round, same branch)

- Sliders moved to sidebar Adjust section (Scale / HUD X / HUD Y / HUD size / Shadow X / Shadow Y + Reset).
- Removed main-screen texts (stage hint, Pose slots header/description); stage given reclaimed space.
- Fixed pivot-handle runaway: frozen image rect during drag, full layout settles on release.
- Added species-level HUD size (`hudScale`, 0.5..2, default 1): plate font/bar/badge scale around
  the same anchor; E/W board clamp still wins. Save/reload + runtime wired, tests extended.
- User's live `creature-poses.json` tuning intentionally left uncommitted.

## FOUND

1. `assets/boss-goblin-shaman.png`, `assets/boss-goblin-taunter.png` (+ ещё один legacy-слот)
   отсутствуют в репо — 404 и в MAIN без моих изменений (предсуществующее, не регрессия).
   Runtime их gracefully деградирует до pose-паков, но записи стоит почистить отдельной задачей.
2. `CAST INTERRUPTED` burst рисуется отдельным anchor (`-charH/2-10`), не едет с HUD offset.
   Если нужно чтобы и он двигался — отдельное решение (сейчас осознанно не тронут).
3. E/W clamp в `hudBoxes` может частично отыграть HUD offset в сторону борда (защита от
   перекрытия борда имеет приоритет). Для N/top — чистое 1:1.
4. Старые сохранённые pivot (авторство в stage fractions) в новом preview могут показать dot
   не на арте до первого перетаскивания; runtime-рендер этих записей не изменился (формула та же).
5. Goblin-taunter не имеет authored entry в `creature-poses.json` — в Pose Editor preview пуст
   (runtime при этом рисует его из `assets/bosses/goblin-taunter/`).
