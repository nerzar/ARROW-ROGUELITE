# TASK: ASSET-004 — Next Creature Runtime Packs

STATUS: DONE
TYPE: BUILD
SIZE: S
AGENT: asset preparation agent
BASE_BRANCH: origin/main
BRANCH: design/ASSET-004-next-creature-packs
START_SHA: 9cfd9c5029e624b801f697e3c13e20043bc4d6f1

## Goal

Подготовить чистые runtime asset packs для трёх уже признанных READY
(BESTIARY-001) существ — `small-spider`, `spider-brute`, `green-slime` —
НЕ назначая им gameplay-роли. Для каждого: canonical PNG, нормализованный
runtime naming, transparency check, identity check, common ground anchor,
suggested scale, manifest/data contract.

Минимальный контракт: `idle`, `attackReady`/`attack`, `hit`, `defeat`.
Хорошие дополнительные состояния сохранить как optional, механику не придумывать.

## Source

`C:\Users\nerza\Projects\magicarrowassets\creatures\`

Readiness-основание: `docs/BESTIARY-001-ASSET-INVENTORY.md` +
draft maps `assets/enemies/_candidates/*.json` (ветка
`design/BESTIARY-001-asset-intake`, в `main` не merged — маппинги
перепроверены здесь по пикселям заново).

## Rules

- НЕ подключать в app.js; НЕ менять renderer/arena layout/combat.
- НЕ назначать HP/damage/timers/способности.
- НЕ копировать concept sheets/background images как runtime poses.
- Source assets не менять (defringe только на runtime-копиях).
- Ветку и чужие незакоммиченные файлы не трогать; merge в `main` не делать.

## Runtime target

`spikes/arrow-core/viewer/visual-proto/assets/enemies/<name>/`
(на `main` каталога `visual-proto/` ещё нет — он живёт в unmerged
VIS/BESTIARY-ветках; паки самодостаточны: PNG + `manifest.json`, wiring —
отдельная будущая задача, `wired_into_loader: false`).

Нейминг: kebab-case `${pose}.png` (`attackReady` → `attack-ready.png`),
прецедент dire-wolf / boss-паков; pose vocabulary `ENEMY_POSES`.

## RESULT

Три runtime pack собраны (21 PNG + 3 `manifest.json`), mapping 1:1 повторяет
BESTIARY-001/_candidates и подтверждён визуально:

- `small-spider/`: `idle(6) / attack-ready(7, reared threat) / attack(5, web-spit) /
  hit(8, stars) / defeat(2, X-eyes)` + optional `attack-ready-alt(4, front/angry),
  back(3)`. Excluded: sheet `(1)` (labeled turnaround, REFERENCE_ONLY).
- `spider-brute/`: `idle(2) / attack-ready(4, reared) / attack(5, lunge, jaws open) /
  hit(6, spiral+stars) / defeat(8, collapsed, venom)` + optional
  `attack-ready-alt(7, angry), back(3)`. Excluded: sheet `(1)`.
- `green-slime/`: `idle / attack-ready(angry) / attack("cast  shot", goo-spit) /
  hit(stun-hit) / defeat(death, puddle)` + optional `taunt, back`.
  Excluded: `concept.png`. Double-space (`cast  shot.png`) исправлен rename.

Проверки: все cutouts RGBA 1254x1254, 40–79% transparent (genuine cutouts);
identity стабильна внутри каждого вида (contact sheets просмотрены; brute
визуально отличен от small-spider bulk/абдоменом). Anchor общий:
`{anchorX: 0.5, anchorY: 1.0}` (ENEMY_ANCHOR), per-pose `suggested_dy_fraction`
измерен от content bbox относительно idle (max +0.20 у slime defeat —
су suggestion для wiring, renderer defaults не менялись). Scale suggestion:
1.0 относительно dire-wolf footprint (contain-fit), без gameplay-смысла.
Missing required: none во всех трёх. Defringe: автоматический nearest-opaque
RGB bleed (scipy distance transform), alpha preserved exactly (проверено
побайтово); A/B-кропы 2x показывают отсутствие damage; остаточная светлая
кайма — в основном авторский rim-light, не halo. Sources не изменены
(md5 сверены с pre-build audit).

## VERIFY

- `build_packs.py`: assert size/mode всех 21 + побайтовая идентичность alpha
  runtime vs source; assert opaque-RGB неизменны.
- `verify_packs.py`: md5 всех 21 source == pre-build audit (sources untouched);
  все runtime 1254x1254 RGBA.
- Halo A/B: 2x crops (brute idle, small-spider attack) source vs runtime —
  no art damage; глобальные edge-метрики после bleed частично растут, т.к.
  соседнее арт-яркое (ivory fangs, glow, rim-light) — зафиксировано как
  ограничение метрики, не дефект.
- `manifest.json` × 3: все `source`/`file` пути резолвятся на диск.
- `git status`: только 3 новых pack-директории; app.js/renderer/layout/combat/
  loader не тронуты. Чужой untracked `spikes/arrow-core/tools/scan-act1-4-8.ts`
  оставлен как есть, НЕ коммичен.

## FOUND

- `docs/BESTIARY-001-ASSET-INVENTORY.md` отсутствует в `main` (живёт только на
  `design/BESTIARY-001-asset-intake`); карточка/инвентарь/loader тоже не merged.
  Паки намеренно самодостаточны и лягут merge-чисто поверх той ветки.
- _candidates JSON для small-spider содержит неточный timestamp у
  `attack-ready-alt (4)` (`01_53_21` vs реальный `01_53_23 PM`); в manifest
  записано реальное имя файла (md5 `9ffa8a6b97c1` совпадает).
- Slime `hit` (stun-hit) содержит 46k edge-пикселей (звёзды/эффекты) — самый
  «грязный» по метрикам файл пака, но визуально консистентен; translucency тела
  genuine (alpha untouched).
- Suggested follow-up (не начат): wiring-паков в loader (`assets.js`
  `ENEMY_MANIFESTS` по dire-wolf образцу) + применение `suggested_dy` —
  отдельная задача.
