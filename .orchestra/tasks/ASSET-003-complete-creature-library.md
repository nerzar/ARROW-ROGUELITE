# TASK: ASSET-003 — Complete Creature Library

STATUS: DONE
TYPE: BUILD/FIX
SIZE: M
AGENT: Claude / visual implementation
BASE_BRANCH: integration/BUILD-030-editor-shaman-tail-merge
BRANCH: build/ASSET-003-complete-creature-library
START_SHA: 8e5906219530eabba66373d138285a215241c311

## Goal

Finish the creature integration properly.

The current Campaign Editor exposes too few creature models and several source folders from:

`C:\Users\nerza\Projects\magicarrowassets\creatures`

are missing from the creature dropdown.

The user wants the real creature library available for manual campaign authoring. Do not curate away usable models just because a folder does not contain a perfect full animation set.

## Source folders currently visible to the user

Treat every top-level creature folder as a candidate species and inspect all of them:

- `skeleton-child`
- `small-spider`
- `toxic-demonic-spider`
- `spider-brute`
- `small-goblin`
- `small-green-slime`
- `green-slime`
- `goblin-shaman`
- `goblin-king`
- `dire_wolf`

The current dropdown visibly misses at least:
- `small-spider`;
- `toxic-demonic-spider`;
- `small-green-slime`.

Do not silently collapse visually distinct folders into one species.

## Required result

### 1. One selectable catalog entry per usable creature folder

For every source folder that contains at least one usable isolated creature image:

- create/keep a stable species id;
- give it a clear human label;
- copy the needed source image(s) into the project-local creature asset tree;
- add it to the data-driven creature catalog;
- make it selectable in the Campaign Editor creature dropdown;
- make selecting it immediately change the live preview and playable runtime sprite.

The target is that all 10 source folders above appear as separate selectable models unless a folder genuinely contains no usable isolated creature art. If one is excluded, document the exact reason in FOUND with filenames/screenshots/inspection notes.

### 2. Do not require a full animation set

A folder must NOT be rejected only because it lacks named idle/hit/death poses.

Use this priority:

1. If a clean named pose set exists, wire the obvious semantic matches.
2. If only one or a few clean isolated frames exist, use the best representative clean frame as `idle`.
3. Missing hit/attack/death may gracefully fall back to idle.
4. Do not invent semantic animation names from ambiguous files.

The immediate goal is authoring availability and correct visual identity, not final animation production.

### 3. Fix wrong/rough mappings

Audit the species currently already in the catalog.

Make sure:
- each dropdown item renders the matching creature, not a fallback wolf or another species;
- `small-green-slime` and `green-slime` remain distinct if their source art is visually distinct;
- all three spider families (`small-spider`, `toxic-demonic-spider`, `spider-brute`) are represented separately if usable art exists;
- Goblin Shaman and Goblin King/Taunter still render correctly;
- Dire Wolf still works.

### 4. Presentation defaults

For every newly added species, provide sane default visual presentation:
- grounded feet/pivot;
- useful default scale;
- not clipped;
- not floating obviously above the shadow/anchor.

Do not hand-calibrate every level. Per-species defaults should just make the model usable when first selected; level calibration remains user-controlled.

## Boundaries

- No gameplay changes.
- No campaign redesign.
- No arena work.
- No new AI art generation.
- Do not redesign the editor.
- Do not remove existing working species.
- Keep the source `magicarrowassets` folder untouched.
- Work in an isolated worktree.
- No merge to main.

## Verify

In the real Campaign Editor browser UI:

1. Count the creature dropdown entries and confirm every usable top-level source folder has its own selectable species.
2. Explicitly select and visually verify:
   - Small Spider;
   - Toxic Demonic Spider;
   - Spider Brute;
   - Small Green Slime;
   - Green Slime;
   - Small Goblin;
   - Skeleton Child;
   - Dire Wolf;
   - Goblin Shaman;
   - Goblin King/Taunter.
3. Confirm each option changes the actual rendered creature immediately.
4. Confirm no species silently renders as Dire Wolf fallback when its own asset exists.
5. Confirm Save/reload preserves selected species id.
6. Confirm Play Level renders the same species as the editor.
7. Run normal tests/typecheck/build.

## Delivery

Short `RESULT / VERIFY / FOUND`.

In FOUND list any source folders not imported and the exact reason.

USER PLAYTEST:
- tell the user only where the creature dropdown is and which newly added spider/slime entries to click first.

Commit, push, verify remote SHA, mark DONE.

---

## RESULT

All 10 source folders in `magicarrowassets/creatures` are now separate, selectable
`CREATURE_CATALOG` entries. Nothing was excluded.

**3 new species added** (`asset-catalog.js`, `assets.js`, new files under
`viewer/visual-proto/assets/enemies/<species>/`):

- **`small-spider`** — source folder had no named poses at all: one concept/reference sheet
  (labelled "8 DIRECTIONS + POSES", not a usable sprite) plus 7 individually generated isolated
  frames. Identified each frame's pose by comparing it against the concept sheet's own labels: a
  clean grounded front stance -> `idle`, a rearing/threat pose -> `attackReady`, a web-spit pose
  -> `attack`, a dizzy-with-stars pose -> `hit`. No death/collapse frame exists among the 7, so
  `defeat` is deliberately left unmapped — falls back to `idle` (allowed by the task's own
  fallback rule, and safer than guessing).
- **`toxic-demonic-spider`** — source folder already had a full named pose set
  (`idle/angry/back/cast/death/stun` + 1 concept file). Mapped `idle`, `stun` -> `hit`, `death` ->
  `defeat` (same convention as the pre-existing `green-slime`/`small-goblin` packs). Visually
  distinct from both other spiders: green-glowing carapace with a venom-sac mouth, vs.
  `small-spider`'s bronze/gold coloring and `spider-brute`'s larger size + red glow.
- **`small-green-slime`** — source folder had a clean `idle`/`hit stun` (space in filename,
  renamed on copy)/`death` trio plus `back.png` and two jump-related extras (`down - jump.png`,
  `taunt. - jump -up.png`) that were skipped as ambiguous/not needed for the 5-pose contract.
  Visually distinct from `green-slime`: a small, round, big-yellow-eyed, friendly-looking slime,
  vs. `green-slime`'s taller, fanged, menacing design.

**7 existing species audited**, all confirmed rendering their own art (none fall back to Dire
Wolf): `dire-wolf`, `green-slime`, `small-goblin`, `spider-brute`, `skeleton-child`,
`goblin-shaman`, `goblin-taunter` (= Goblin King). No wrong/rough mappings found — `ENEMY_MANIFESTS`
already had a real entry for every one of them (this was a pure addition task, not a fix of any
existing wiring).

**Presentation defaults (task requirement #4)**: no per-species scale/pivot code was needed —
`board-renderer.js`'s actor placement is keyed by board *side/slot* (existing calibration), not by
species, and every new source image is already a full-body, centered, transparent-background
render at the same convention as every other species already in the catalog. Confirmed visually
grounded/not-clipped for all 3 new species in the browser (see VERIFY).

**Default HP/timer values** for the 3 new catalog entries are authoring-convenience starting
points (per the existing pattern every other species already uses), not a balance decision:
`small-spider` HP 1 + timer(4,1) (small poke-attack, matches its web-spit pose), 
`toxic-demonic-spider` HP 3 + timer(3,2) (elite/venomous, matches Dire Wolf's cadence),
`small-green-slime` HP 1, no timer (weak, matches `green-slime`'s own low-threat pattern). All
freely user-tunable per level in the editor's existing HP/Attack Timer fields.

## VERIFY

Ran in an isolated worktree (`.worktrees/ASSET-003`, own `node_modules`, dev server on a scratch
port):

- `npm run typecheck` / `npm run build` — 0 errors (asset copies + `viewer/visual-proto/*.js`
  edits are outside `tsconfig.json`'s `include`).
- `npm test` — 288/288 passed (24 files), unchanged from before this task.
- Browser (built-in Claude Browser, Chromium), against the task's own checklist:
  1. Creature dropdown now lists 10 entries (was 7); counted directly in the accessibility tree.
  2. Explicitly selected and screenshotted all 10: Small Spider, Toxic Demonic Spider, Spider
     Brute, Small Green Slime, Green Slime, Small Goblin, Skeleton Child, Dire Wolf, Goblin
     Shaman, Goblin King/Taunter — every one renders its own distinct art in the live editor
     preview (grounded, centered, correctly identified).
  3. Confirmed each selection changes the rendered creature immediately (no reload needed).
  4. Confirmed none silently renders as Dire Wolf — each of the 10 is visually distinct from Dire
     Wolf and from each other; `read_network_requests` showed every new species' `idle`/`hit`/
     `attack*`/`defeat` PNGs loading with `200 OK` under
     `viewer/visual-proto/assets/enemies/<species>/`.
  5. Save -> reload round-trip: set Level 1's enemy to `toxic-demonic-spider`, clicked Save
     (badge: "Saved to campaigns/campaign.json & storage"), fully reloaded the page (badge:
     "Loaded from file") — the species was still selected and rendering correctly. Reverted this
     test change afterwards (`git checkout -- campaigns/campaign.json`) so no unrelated content
     change is in this task's diff.
  6. Play Level: launched the actual playable Prologue runtime (`app.js`, not the editor) with
     that same level — it rendered "Toxic Demonic Spider (Enemy)" identically to the editor
     preview, confirming `app.js`'s generic `ENEMY_MANIFESTS`-driven pack loading (unchanged code)
     picks up the new species automatically.
  7. `read_console_messages`: only pre-existing missing placeholder assets (`board-frame.png`,
     `boss-goblin-*.png`, etc., already documented 404-ing since CAL-001) — no new errors.
- Cleaned up before committing: reverted the test Save to `campaigns/campaign.json`; only the
  intended catalog/manifest code + the 10 new image files are in the diff.

RESULT_SHA: 3df4fcd9c74cd316baa0c3929faa0f27764a14be (code commit).

## USER PLAYTEST

1. Open the Campaign Authoring Tool, pick any level, look at **Enemies (Center-first) -> Creature**
   dropdown.
2. Click through the 3 new entries first: **Small Spider**, **Toxic Demonic Spider**, **Small
   Green Slime** — each should immediately show a distinct creature in the live preview.
3. Everything else (HP, Attack Timer, slot, Save/Play) works exactly the same as any other
   species.

## FOUND

- No source folder was excluded — all 10 are now selectable. The only thing intentionally *not*
  wired is a `defeat` pose for `small-spider` (no death-looking frame exists among its 7
  generated images) — it gracefully falls back to `idle`, per the task's own explicit fallback
  rule, rather than guessing which ambiguous frame might be a death pose.
- `small-green-slime`'s source folder has two extra jump-related frames (`down - jump.png`,
  `taunt. - jump -up.png`) that weren't mapped to anything — they don't correspond to any of the
  5 `ENEMY_POSES` and their compound names make the intended semantics ambiguous; left unused
  rather than invented into a pose.
- `dire_wolf`'s own source folder is still 6 unnamed raw frames with no named poses — out of
  scope here since the project's Dire Wolf pack was already curated and working from a prior task
  (VIS-006); this task only touched species that were missing or needed auditing, and Dire Wolf
  was confirmed still correct (see VERIFY #4), not re-curated.
