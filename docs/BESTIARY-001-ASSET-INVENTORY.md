# BESTIARY-001 — Creature Asset Intake Inventory

Source: `C:\Users\nerza\Projects\magicarrowassets\creatures\` (10 folders, 78 PNG files).
Date: 2026-09-17. Method: PIL audit of every file (dimensions, mode, alpha range,
% fully-transparent pixels) + visual sampling of every pose/cutout (downscaled
copies; originals untouched). No gameplay roles assigned. No images generated.
No renderer/layout changes.

## Minimum ordinary-enemy runtime target (for grading only)

`idle`, `attackReady` or `attack`, `hit`/`stunned`, `defeat`.
Runtime pose vocabulary: `ENEMY_POSES = ['idle','attackReady','attack','hit','defeat']`
(spikes/arrow-core/viewer/visual-proto/enemy-visual-state.js:15);
runtime files use kebab-case (`attack-ready.png`).

## Global findings (apply to all folders)

- Every folder contains exactly one opaque (`RGB`, no alpha) file: a concept /
  turnaround sheet with multiple poses, labels, and backgrounds. All of these are
  `REFERENCE_ONLY` — they map poses to files but are not runtime sprites.
- All gameplay-pose cutouts are `RGBA` 1254x1254 (boss-folder portraits differ,
  see below) with 60–85% transparent pixels: genuine cutouts, importable.
- Light red/yellow edge fringe is visible on most cutouts at silhouette borders
  (typical AI background-removal halo). Uniform across packs, including the three
  already-integrated ones — standard defringe-on-import step, not a blocker.
- Filename hygiene issues (spaces, double spaces, typos, `ChatGPT Image …`
  generic names) everywhere outside the already-integrated packs. Rename-only cost.
- No gameplay-role statements below. "Attack" readings (e.g. "web-spit is the
  attack") describe what the picture shows, not what mechanics it should drive.

## Already integrated — do not re-intake

`dire_wolf`, `goblin-shaman`, `goblin-king` already live in the runtime packs
(`assets/enemies/dire-wolf/`, `assets/bosses/goblin-shaman/`,
`assets/bosses/goblin-taunter/`, see spikes/arrow-core/viewer/visual-proto/assets.js
and VIS-005/VIS-006/VIS-008 cards). Their source folders are audited here for
completeness/spares only. They are excluded from the SHORTLIST.

---

## 1. `dire_wolf` — INTEGRATED (spare: concept sheet only)

| file | size | KB | alpha / transparent % |
|---|---|---|---|
| `ChatGPT Image Sep 17, 2026, 11_10_59 AM (1).png` | 1448x1086 RGB | 2118 | NO_ALPHA — "Dire Wolf / ENEMY CHARACTER CONCEPT" sheet (FRONT/SIDE/BACK, IDLE/ATTACK READY/RUN-LUNGE/HIT-DEFEAT) |
| `(2).png` … `(6).png` | 1254x1254 RGBA | 1028–1577 | transparent 57–73% |

Transparent/opaque: 5 cutouts RGBA, sheet opaque.
States/poses: sheet labels map the set; runtime (VIS-006) already resolved generic
names to `idle / attack-ready / hit / defeat / lunge(=attack)`.
Identity: one stable wolf (spiked collar, gold paw bands, red eyes) across sheet
and cutouts (attack snarl and defeat collapse sampled).
Missing: nothing for the current enemy pose set.
Suggested mapping: already done in `WOLF_MANIFEST` (assets.js:69-75).
Readiness: **INTEGRATED**. No action.
Defects: none beyond the global fringe note.

## 2. `goblin-shaman` — INTEGRATED

| file | size | KB | transparent % |
|---|---|---|---|
| `ChatGPT Image Sep 17, 2026, 11_36_42 AM.png` | 1448x1086 RGB | 2325 | NO_ALPHA — concept sheet, REFERENCE_ONLY |
| `idle.png` | 1086x1448 RGBA | 1926 | 50.1 |
| `angry.png` | 1086x1448 RGBA | 2301 | 42.5 |
| `cast.png` | 1086x1448 RGBA | 2062 | 47.9 |
| `taunt.png` | 1086x1448 RGBA | 1976 | 49.9 |
| `stunned - hit.png` | 1086x1448 RGBA | 1837 | 53.5 |
| `back.png` | 1086x1448 RGBA | 1693 | 56.2 |
| `defeat.png` | 1448x1086 RGBA | 1421 | 64.8 |

Transparent/opaque: 7 RGBA + 1 opaque sheet.
States/poses: idle / angry / cast / taunt / stunned-hit / back / defeat (landscape).
Identity: one stable shaman (red hood, skull necklace/staff, purple crystal);
defeat (face-down with dizzy stars) sampled and consistent.
Missing: nothing — runtime already maps all 7 (`SHAMAN_RUNTIME`, assets.js:53).
Suggested mapping: already done; note source keeps the space in
`stunned - hit.png`, runtime uses `stunned-hit.png`.
Readiness: **INTEGRATED**. No action.
Defects: filename contains space + dash; otherwise clean.

## 3. `goblin-king` — INTEGRATED (spares need work)

| file | size | KB | transparent % |
|---|---|---|---|
| `indle.png` (typo for idle) | 1086x1448 RGBA | 1950 | 50.7 |
| `angry.png` | 1305x1206 RGBA | 2032 | 46.3 |
| `cast.png` | 1086x1448 RGBA | 1798 | 53.2 |
| `taunt.png` | 1086x1448 RGBA | 1848 | 45.2 |
| `stuned.png` (typo) | 1086x1448 RGBA | 1859 | 53.7 |
| `back.png` | 1086x1448 RGBA | 1768 | 55.5 |
| `defeat.png` | 1536x1024 RGBA | 2086 | 60.3 |
| `angry-with-bg-or-cast.png` | 1312x1199 RGBA | 2531 | 25.8 |
| `ChatGPT Image Sep 17, 2026, 09_41_05 AM (2).png` | 1536x1024 RGBA | 2658 | 9.5 opaque-ish |
| `ChatGPT Image Sep 17, 2026, 10_30_02 AM (3).png` | 1086x1448 RGBA | 1859 | 53.7 |

Transparent/opaque: all RGBA, but the last two rows are spares with painted /
semi-transparent smoky backgrounds (9.5% / 25.8% transparent — not cutouts).
States/poses: full boss set; defeat (landscape, crown + mace, dizzy stars) sampled
and consistent with the standing poses.
Identity: one stable king (crown, red cape, mace); runtime pack is `goblin-taunter`.
Missing: nothing for the integrated pack.
Suggested mapping: already done (`BOSS_MANIFEST`, runtime renames
`indle→idle`, `stuned→stunned`).
Readiness: **INTEGRATED**. Spares: `angry-with-bg-or-cast.png` and
`ChatGPT … 09_41_05 AM (2).png` are **NEEDS_CLEANUP** (background removal) if
ever wanted; not needed today.
Defects: `ChatGPT … 10_30_02 AM (3).png` is a byte-identical duplicate of
`stuned.png` (md5 match) — delete candidate. Two filename typos. Fringe as usual.

## 4. `green-slime` — READY (rename-only)

| file | size | KB | transparent % |
|---|---|---|---|
| `concept.png` | 1448x1086 RGB | 2154 | NO_ALPHA — REFERENCE_ONLY |
| `idle.png` | 1254x1254 RGBA | 1663 | 49.4 |
| `angry.png` | 1254x1254 RGBA | 2047 | 43.0 |
| `cast  shot.png` (double space) | 1254x1254 RGBA | 1295 | 66.4 |
| `stun-hit.png` | 1254x1254 RGBA | 1290 | 64.3 |
| `death.png` | 1254x1254 RGBA | 785 | 78.6 |
| `taunt.png` | 1254x1254 RGBA | 1785 | 49.7 |
| `back.png` | 1254x1254 RGBA | 1384 | 58.6 |

Transparent/opaque: 7 RGBA + 1 opaque concept.
States/poses (all visually sampled): idle (grin), angry (roaring splash =
attack-ready read), cast-shot (spitting goo = attack read), stun-hit (dizzy,
tongue out), death (melted puddle, X eyes), plus back and taunt.
Identity: one stable character (glossy green blob, yellow slit eyes, fangs,
drip-crest curl) across all six gameplay cutouts.
Missing minimum: none — idle / attackReady / attack / hit / defeat all present.
Suggested runtime mapping:

| source | runtime |
|---|---|
| `idle.png` | `idle.png` |
| `angry.png` | `attack-ready.png` |
| `cast  shot.png` | `attack.png` (rename also fixes double space) |
| `stun-hit.png` | `hit.png` |
| `death.png` | `defeat.png` |
| `taunt.png` / `back.png` | `taunt.png` / `back.png` (extras, same convention as boss packs) |

Readiness: **READY**. Cost = file renames + standard defringe.
Defects: double space in `cast  shot.png`; fringe on splash droplets.

## 5. `small-goblin` — READY (rename-only)

| file | size | KB | transparent % |
|---|---|---|---|
| `concept.png` | 1448x1086 RGB | 2172 | NO_ALPHA — REFERENCE_ONLY |
| `idle.png` | 1254x1254 RGBA | 1527 | 59.4 |
| `angry.png` | 1254x1254 RGBA | 1599 | 58.5 |
| `cast-end-attack.png` | 1254x1254 RGBA | 1544 | 58.5 |
| `stun.png` | 1254x1254 RGBA | 1443 | 63.3 |
| `death.png` | 1254x1254 RGBA | 1034 | 74.2 |
| `taunt.png` | 1254x1254 RGBA | 1541 | 61.7 |
| `back.png` | 1254x1254 RGBA | 1568 | 59.1 |

Transparent/opaque: 7 RGBA + 1 opaque concept.
States/poses (idle/angry/death/stun/cast-end sampled): idle (blade down),
angry (blade raised, tongue out), cast-end-attack (lunging stab), stun (seated,
spiral eye, stars), death (face-down, X eyes, dropped blade).
Identity: one stable character (green goblin, red scarf, brown leather, dagger).
Missing minimum: none.
Suggested runtime mapping:

| source | runtime |
|---|---|
| `idle.png` | `idle.png` |
| `angry.png` | `attack-ready.png` |
| `cast-end-attack.png` | `attack.png` |
| `stun.png` | `hit.png` |
| `death.png` | `defeat.png` |
| `taunt.png` / `back.png` | extras |

Readiness: **READY**. Cost = renames + defringe. One judgment call to record at
integration time: whether `angry` or `cast-end-attack` better fits
`attackReady` vs `attack` (both readings defensible; pose names, not mechanics).
Defects: fringe on scarf edges; no others.

## 6. `toxic-demonic-spider` — READY (rename-only)

| file | size | KB | transparent % |
|---|---|---|---|
| `ChatGPT Image Sep 17, 2026, 01_41_47 PM (1).png` | 1448x1086 RGB | 1632 | NO_ALPHA — concept sheet, REFERENCE_ONLY |
| `idle.png` | 1254x1254 RGBA | 717 | 82.2 |
| `angry.png` | 1254x1254 RGBA | 1448 | 62.8 |
| `cast.png` (web-spit) | 1254x1254 RGBA | 940 | 74.9 |
| `stun.png` (stars) | 1254x1254 RGBA | 855 | 78.5 |
| `death.png` (collapsed, venom drool) | 1254x1254 RGBA | 836 | 77.5 |
| `back.png` | 1254x1254 RGBA | 965 | 71.5 |

Transparent/opaque: 6 RGBA + 1 opaque sheet.
States/poses (idle/angry/death/stun/cast sampled): idle (crouched),
angry (front blades raised), cast (spitting web), stun (star ring), death
(collapsed, drooling venom).
Identity: one stable character (black armor plates, green glowing abdomen,
green eyes, venom orb in jaws).
Missing minimum: none.
Suggested runtime mapping:

| source | runtime |
|---|---|
| `idle.png` | `idle.png` |
| `angry.png` | `attack-ready.png` |
| `cast.png` | `attack.png` |
| `stun.png` | `hit.png` |
| `death.png` | `defeat.png` |
| `back.png` | `back.png` (extra) |

Readiness: **READY**. Cost = renames + defringe.
Defects: none beyond fringe.

## 7. `small-spider` — READY (rename-only; sheet disambiguates every file)

| file | size | KB | transparent % | sheet-mapped reading |
|---|---|---|---|---|
| `ChatGPT … 01_53_21 PM (1).png` | 1448x1086 RGB | 1800 | NO_ALPHA — labeled "SMALL SPIDER" sheet: IDLE/FRONT/RIGHT/BACK/LEFT, TAUNT/ATTACK READY/CAST-SPIT WEB/STUNNED/ANGRY, DEFEATED + color variants. REFERENCE_ONLY |
| `(2).png` | 1254x1254 RGBA | 740 | 80.3 | defeated (X eyes) → `defeat.png` |
| `(3).png` | 1254x1254 RGBA | 955 | 74.8 | back → `back.png` |
| `(4).png` | 1254x1254 RGBA | 1002 | 74.2 | front/angry → `attack-ready.png` alt |
| `(5).png` | 1254x1254 RGBA | 887 | 77.6 | cast/spit web → `attack.png` |
| `(6).png` | 1254x1254 RGBA | 943 | 74.6 | idle front → `idle.png` |
| `(7).png` | 1254x1254 RGBA | 973 | 74.8 | taunt/threat (reared) → `attack-ready.png` |
| `(8).png` | 1254x1254 RGBA | 797 | 80.8 | stunned (stars) → `hit.png` |

Transparent/opaque: 7 RGBA + 1 opaque sheet.
Identity: one stable character (spiky dark chitin, green eyes, ivory fangs)
across all seven cutouts; each visually sampled.
Missing minimum: none — all five `ENEMY_POSES` covered, plus cast and back.
Readiness: **READY**. Lowest mapping risk in the batch: the labeled sheet names
every pose, so renaming is mechanical.
Defects: generic `ChatGPT Image …` filenames on all 8 files; fringe only.

## 8. `spider-brute` — READY (rename-only; sheet disambiguates every file)

| file | size | KB | transparent % | sheet-mapped reading |
|---|---|---|---|---|
| `ChatGPT … 01_37_37 PM (1).png` | 1448x1086 RGB | 2040 | NO_ALPHA — labeled "SPIDER" sheet: directions + IDLE/TAUNT/ATTACK READY/LUNGE-ATTACK/STUNNED/ANGRY + DEFEATED. REFERENCE_ONLY |
| `(2).png` | 1254x1254 RGBA | 1387 | 64.0 | idle front → `idle.png` |
| `(3).png` | 1254x1254 RGBA | 1219 | 69.9 | back → `back.png` |
| `(4).png` | 1254x1254 RGBA | 1486 | 63.2 | taunt/threat (reared) → `attack-ready.png` |
| `(5).png` | 1254x1254 RGBA | 1473 | 64.8 | lunge/attack (jaws open) → `attack.png` |
| `(6).png` | 1254x1254 RGBA | 970 | 76.6 | stunned (spiral eyes, stars) → `hit.png` |
| `(7).png` | 1254x1254 RGBA | 1543 | 62.8 | angry → `attack-ready.png` alt |
| `(8).png` | 1254x1254 RGBA | 964 | 77.6 | defeated (collapsed, venom) → `defeat.png` |

Transparent/opaque: 7 RGBA + 1 opaque sheet.
Identity: one stable bulky spider (mottled green abdomen, heavy plating);
visually distinct from `small-spider` (bulkier, abdomen pattern). Each cutout sampled.
Missing minimum: none — all five poses plus explicit LUNGE/ATTACK.
Readiness: **READY**. Same mechanical-rename profile as `small-spider`.
Defects: generic filenames; sheet title says "SPIDER" while the folder says
brute — keep folder name as the species key, do not rebrand from art. Fringe only.

## 9. `skeleton-child` — NEEDS_CLEANUP (identity variants + no clean hit)

| file | size | KB | transparent % | sheet-mapped reading |
|---|---|---|---|---|
| `ChatGPT … 02_22_35 PM (1).png` | 1448x1086 RGBA | 1561 | 63.4 | labeled sheet: FRONT/BACK/ATTACK/TAUNT/ANGRY/DAZED/DEFEAT. REFERENCE (alpha but multi-pose layout — not a sprite) |
| `(2).png` | 1254x1254 RGBA | 1078 | 75.7 | idle (sword down) → `idle.png` |
| `(3).png` | 1254x1254 RGBA | 1006 | 75.1 | back — WEARS HELMET + SHIELD, no other pose does |
| `(4).png` | 1254x1254 RGBA | 909 | 77.9 | taunt (tongue out) → `taunt.png` |
| `(5).png` | 1254x1254 RGBA | 1160 | 70.4 | attack (lunging) → `attack.png` |
| `(6).png` | 1254x1254 RGBA | 1058 | 75.1 | attack-ready (sword raised, RED glowing eyes — eye color differs) |
| `(7).png` | 1254x1254 RGBA | 987 | 77.5 | dazed (spiral eyes, stars) — WEARS HELMET → `hit.png` only with variant accepted |
| `(8).png` | 1254x1254 RGBA | 822 | 77.1 | defeat (flat, eyes out) → `defeat.png` |

Transparent/opaque: all 8 RGBA; the sheet is a layout, not a sprite.
Identity: **not single-variant**. Base character (chibi skeleton, red scarf,
sword, boots) is stable, but (3) and (7) add a helmet (+shield on (3)), and (6)
changes eye glow to red. The only dazed/hit cutout wears the helmet.
Missing minimum: clean (helmet-less) `hit`; consistent `back` (only back has
helmet+shield).
Needed cleanup before runtime: one decision + max one edit — (a) accept the
helmet as part of the character and repaint/remove it nowhere (then back/hit
stay inconsistent with idle), or (b) drop helmet variants and produce a clean
hit from an existing pose, or (c) repaint helmet out of (7). No new art was
generated in this task.
Readiness: **NEEDS_CLEANUP**.
Defects: helmet/shield variant drift; red-eye variant in (6); generic filenames.

## 10. `small-green-slime` — NEEDS_CLEANUP (no attack state)

| file | size | KB | transparent % |
|---|---|---|---|
| `ChatGPT Image Sep 17, 2026, 12_46_26 PM (1).png` | 1448x1086 RGB | 1941 | NO_ALPHA — concept sheet, REFERENCE_ONLY |
| `idle.png` | 1254x1254 RGBA | 1011 | 66.8 |
| `hit stun.png` (space) | 1254x1254 RGBA | 981 | 69.9 |
| `death.png` | 1254x1254 RGBA | 544 | 85.4 |
| `down - jump.png` | 1254x1254 RGBA | 800 | 77.8 |
| `taunt. - jump -up.png` | 1254x1254 RGBA | 996 | 70.9 |
| `back.png` | 1254x1254 RGBA | 867 | 72.7 |

Transparent/opaque: 6 RGBA + 1 opaque sheet.
States/poses (all sampled): idle (happy blob), hit-stun (spiral eyes — clear hit
read), death (flat puddle, sad face — clear defeat read), down-jump (landed,
smiling), jump-up (airborne, angry face), back (faceless blob).
Identity: one stable cute-blob character, visually distinct from `green-slime`
(cute vs menacing — different design language, no confusion risk).
Missing minimum: **`attack` / `attack-ready`**. The jump pair suggests mobility,
but neither is an attack; promoting `taunt. - jump -up` to `attack-ready`
would be a design call, which this task does not make.
Suggested runtime mapping (partial): `idle.png→idle`, `hit stun.png→hit`
(rename), `death.png→defeat` (rename); `back.png` extra; jump poses held as
unmapped until the attack question is decided.
Readiness: **NEEDS_CLEANUP** (blocked on attack-state decision/generation, plus
the worst filename hygiene in the batch).
Defects: `taunt. - jump -up.png` (period + spaces + dashes); `hit stun.png`,
`down - jump.png` spacing; fringe.

---

## SHORTLIST — cheapest 3 new packs to integrate next (readiness only)

Excluded: the three already-integrated packs. No "best monster" ranking is made;
among the five READY packs any three cost the same (rename + defringe). This
order minimizes mapping ambiguity, which is the only readiness differentiator:

1. **`small-spider`** — all five `ENEMY_POSES` present plus cast/back; labeled
   concept sheet maps each generic filename to a pose mechanically. Cost: 7 renames.
2. **`spider-brute`** — same profile, plus an explicit labeled LUNGE/ATTACK pose.
   Cost: 7 renames.
3. **`green-slime`** — self-describing filenames, all five poses present.
   Cost: 7 renames (incl. double-space fix).

Equal-cost alternates, readiness-identical: `small-goblin`, `toxic-demonic-spider`
(one `attackReady`-vs-`attack` judgment call each, no missing states).
Not shortlisted for readiness reasons: `skeleton-child` (variant cleanup + clean
hit outstanding), `small-green-slime` (attack state missing).

Draft data-only manifests for the three shortlisted packs (source→runtime
filename maps, no PNGs copied, not wired into any loader) are proposed under
`spikes/arrow-core/viewer/visual-proto/assets/enemies/_candidates/`.

## Integration notes for the future task (no action taken)

- Keep source files byte-identical; do renames at copy time into
  `assets/enemies/<species>/` following the `dire-wolf` precedent
  (`idle / attack-ready / attack / hit / defeat`, extras `taunt / back / cast`).
- Reuse the graceful-degradation loader contract (missing pose → idle →
  placeholder); no loader changes needed for a rename-only pack.
- Delete candidate: `goblin-king/ChatGPT Image Sep 17, 2026, 10_30_02 AM (3).png`
  (byte-duplicate of `stuned.png`).
- Suggested follow-ups (not started): skeleton-child variant decision; attack
  state for small-green-slime; background removal for the two goblin-king spares.
