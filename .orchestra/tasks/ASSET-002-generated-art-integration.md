# TASK: ASSET-002 — Generated Art Integration

STATUS: READY
TYPE: BUILD
SIZE: M/L
AGENT: Claude / visual implementation
BASE_BRANCH: build/BUILD-026-campaign-authoring-tool
BRANCH: build/ASSET-002-generated-art-integration
START_SHA: 498cc25a88bed99b38e4bf138ea67f6cdb374f63

## Goal

Take the generated arenas and mobs from:

`C:\Users\nerza\Projects\magicarrowassets`

and make the useful ones actually usable in the current Campaign Editor and playable runtime.

This is a visual implementation task, not a research/review task.

## What matters

- Keep the source folder untouched.
- Bring the usable art into a clean project-local asset structure.
- Extend the existing data-driven `asset-catalog.js` rather than hardcoding filenames into UI code.
- Make arenas and mobs appear in the Campaign Editor selectors and preview correctly.
- For mobs, wire only states that can be inferred from the real files/filenames/structure. Do not invent animation semantics.
- Tune practical per-asset presentation defaults where needed: scale, sprite pivot / foot offset, framing/crop, shadow alignment, etc.
- Use the existing calibration/editor tools in the browser to make the imported art sit correctly in the scene.
- A mob should look grounded, not float above its shadow; an arena should be usable without obvious clipping or broken framing.
- Existing built-in assets must keep working as fallback.

You may make small renderer/catalog/editor changes needed to support the real art cleanly, but do not redesign the gameplay, arrows, or campaign model.

Do not try to calibrate every possible arena × level combination. The goal is a good reusable asset pipeline plus sensible defaults that the authoring tool can tune per level.

## Verify

In the browser prove at least:

- several imported arenas are selectable and render correctly;
- several imported mobs are selectable and render correctly;
- changing mob species updates the live preview;
- scale/pivot defaults are sane and editable;
- no broken absolute paths are stored in project data;
- existing campaign authoring still works.

Run normal typecheck/tests/build for touched code.

## Delivery

Short `RESULT / VERIFY / FOUND` plus a tiny `USER PLAYTEST` telling the user where to open the editor and what new assets to try.

Commit, push, verify remote SHA, mark DONE.
