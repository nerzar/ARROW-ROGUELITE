# TASK: FIX-036 — Одобренный HUD-кард выезжает за рамки

STATUS: DONE
TYPE: FIX
SIZE: S
AGENT: Codex
BASE_BRANCH: main
BRANCH: fix/FIX-036-hud-card-overflow

## Цель

После интеграции одобренного HUD (BUILD-036/ART-012B, уже в `main`) пользователь сообщил:
карточки (player/enemy HUD card) выезжают за рамки — как именно (за край экрана, за
рамку своей плашки, перекрывают друг друга) нужно сначала воспроизвести самому.

## Что важно знать

- Одобренный HUD рисуется в `spikes/arrow-core/viewer/visual-proto/board-renderer.js`:
  - "approved card" отрисовка примерно в районе строк 1260-1340 (имена переменных вроде
    `approvedW`, `cardX`, `nameCenter`, `chips` — искать по `approvedW`).
  - Старая (не-approved) карточка — отдельно, строки ~1160-1230 и ~1550-1600 (искать
    `hudBoxes`, `roundRect(cardX, cardY, cardW, cardH`).
- Viewport-клэмп для позиции плашек — `hudBoxes()` в `spikes/arrow-core/viewer/visual-proto/arena-layout.js`
  (`HUD_GAP_PX`, отступы от края канваса). Похожий баг уже чинился один раз в FIX-033
  (`.orchestra/archive/` или `git log --oneline -- '*combat-hud*'`) — вероятно, новый
  approved-кард используют другие размеры (`cardW`/`approvedW`) и не учтён в той же
  клэмп-логике, либо клэмп применяется к старой карточке, а не к новой.
- Подозрительные места для проверки: боссы (более длинное имя/крупная карточка), сцены с
  несколькими активными chip'ами разом (ATK + ability + HP), маленькие разрешения экрана
  (FHD 1920x1080 и ниже, например 1366x768), верхний подиум (side=N) — там раньше уже была
  похожая история с обрезанием.

## Можно менять

- `board-renderer.js` (только отрисовка/позиционирование HUD-карточки)
- `arena-layout.js` (`hudBoxes()` и связанные константы), если клэмп нужно поправить именно там

## Не менять

- puzzle/board core, combat-логику, `src/`
- MAP-001 (`route-map-ui.js` и всё, что с ним связано) — сейчас отдельно дорабатывается
- ability-hud.js / FIX-034 — уже принято, не трогать

## Готово, если

- [ ] воспроизведён конкретный сценарий, где карточка выезжает за рамки (скриншот "до")
- [ ] карточка (player и enemy, обычный и boss-размер) остаётся полностью в пределах
      видимой области на 1920x1080 и 1366x768
- [ ] существующие тесты (435 на момент постановки) остаются зелёными
- [ ] скриншот "после" на том же сценарии

## Проверить

`npm test`, `npm run typecheck`, `npm run build` в `spikes/arrow-core`. Живой браузер:
несколько сцен (обычный враг, босс, сцена с активной способностью) на 1920x1080 и 1366x768.

## Когда остановиться

`STATUS: BLOCKED`, если баг не воспроизводится ни на одном разрешении/сценарии — тогда
явно расспросить пользователя, на каком именно экране/сцене он это видел, а не гадать.

## Итог

RESULT: Approved HUD overlays now stay inside their source PNG frames: enemy/boss chips use the
safe 0.80/0.82 right anchors, and the player HP fill/text end at 80.15% of the player frame instead
of overflowing to 90.35%. Final user-guided alignment moves enemy/boss HP 2 px up and expands it
2 px per side; player HP moves 1 px down and expands 4 px left / 2 px right.

VERIFY: `npm test` (450/450), `npm run typecheck`, `npm run build`; live browser at 1366x768 and
1920x1080 on player HUD, Matron (ATK + HEAL + THR), ordinary Goblin Grunt, and Goblin King boss;
live browser rechecked after the final pixel-alignment feedback.

FOUND: none.
