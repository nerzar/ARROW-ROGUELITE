# TASK: ASSET-001 — Mob + Arena Asset Catalog

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: free implementation agent
BASE_BRANCH: tool/CAL-004-prologue-stage-calibration
BRANCH: build/ASSET-001-mob-arena-catalog
START_SHA: 0fbba65a1705825eca9d307dc4c49478f3e4419a

## Goal

Prepare the generated game art in `C:\Users\nerza\Projects\magicarrowassets` for practical use by the playable viewer and the new campaign/level authoring tool.

This is implementation work, not an art review/research task.

## What to do

- Inspect the local asset folder and identify the usable generated mob and arena assets.
- Keep the source folder untouched.
- Bring the usable assets into the project in a clean, predictable structure, or provide an equally practical project-local mapping if copying everything would be wasteful.
- Create a small data-driven manifest/catalog that the campaign editor can consume.
- Give stable IDs and useful human labels.
- For mobs, record only metadata that can be determined from the actual files/structure; do not invent missing animation/state semantics.
- For arenas, make them selectable/pre-viewable by the authoring tool.
- Where an asset needs obvious transparent-background cleanup/cropping/normalization to work in runtime, do the minimum practical fix and record it. Do not start a new visual redesign pass.

The catalog should make it easy for BUILD-026 to populate arena and mob selectors without hardcoding every filename in UI code.

## Coordination with BUILD-026

Avoid editing campaign-editor/runtime implementation files unless absolutely necessary. Prefer owning the asset tree + manifest/catalog only, so BUILD-026 can proceed in parallel and consume your result later.

If a tiny loader/helper is needed, keep it narrowly scoped and document the integration point.

## Verify

- catalog references resolve to real project-local assets;
- sample arena and mob assets can be loaded by the browser/runtime path;
- no broken absolute paths are committed;
- source `magicarrowassets` remains untouched;
- report any ambiguous/unusable files in FOUND rather than guessing.

## Delivery

Short `RESULT / VERIFY / FOUND`, commit, push, verify remote SHA, mark DONE.
