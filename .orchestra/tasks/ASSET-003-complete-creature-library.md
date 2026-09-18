# TASK: ASSET-003 — Complete Creature Library

STATUS: READY
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
