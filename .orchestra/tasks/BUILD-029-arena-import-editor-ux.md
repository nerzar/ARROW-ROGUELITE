# TASK: BUILD-029 — Arena Import + Editor Dropdown UX

STATUS: READY
TYPE: BUILD/FIX
SIZE: M
AGENT: Claude / visual implementation
BASE_BRANCH: integration/BUILD-028-prologue-assets-authoring
BRANCH: build/BUILD-029-arena-import-editor-ux
START_SHA: a915678fbd226c0d42a16852386452525ce8a6f1

## Goal

Make the Campaign Editor practical for the user to choose and add their own arena scenes, instead of being limited to the current curated arena list.

Also fix the current unreadable native dropdown options in the dark UI.

This is a visual/editor workflow task. Do not redesign gameplay.

## User feedback

Current live build:
- native/select dropdown options render with a white background and very low-contrast text, so options are hard to read;
- the current imported arena set is not suitable enough for the user's final Prologue scenes;
- the user wants to choose/add arena scene images himself and then calibrate them manually with the existing controls.

## Required result

### 1. Dropdown readability

Fix select/option styling across the Campaign Editor so the dark UI remains readable when the dropdown is opened.

At minimum:
- arena selector;
- level selector;
- creature selector;
- other authoring selects in the same editor.

Use a robust browser-friendly solution. Do not rely on text becoming readable by accident on one browser.

### 2. Add/import arena scene from the editor

Add a practical `+ Arena` / `Import Arena` workflow.

The user should be able to choose an image file from disk and make it a project-local arena available in the arena dropdown, without manually editing JS source.

Preferred behavior:
- choose a local PNG/JPG/WebP from the editor;
- dev server copies/saves it into a project-local arena asset folder;
- a small project-local arena library/manifest persists the arena entry (stable id, label, relative asset path, baseline calibration metadata or calibration reference as appropriate);
- newly imported arena appears immediately in the selector;
- after selection, user can manually calibrate board corners, actor anchors, effect anchors, actor scale and sprite pivot using the existing editor;
- Save persists the chosen arena and its tuned calibration into the campaign;
- reload restores it.

Implementation details are up to the executor. Prefer a small data-driven arena-library file over rewriting `asset-catalog.js` source code at runtime.

If direct project-file import cannot work outside the local dev server, make that explicit in the UI and keep a browser-only preview fallback only if it is genuinely useful.

### 3. Existing arenas stay working

Do not break the built-in/catalog arenas from BUILD-028. Imported user arenas should coexist with them.

### 4. Calibration behavior

When a new arena is imported, give it a sensible initial calibration shell so it is immediately editable. Do not pretend it is already calibrated.

Changing to an imported arena must not retain stale geometry from the previous arena unless the user explicitly chooses to copy calibration.

## Boundaries

- No new gameplay mechanics.
- Do not alter the 5 Prologue teaching beats.
- Do not replace the existing calibration system.
- No art generation/research.
- No merge to main.
- Work in an isolated worktree; do not use the shared checkout.

## Verify

In the browser prove:

1. opened dropdown options are readable in the dark editor;
2. a new arena image can be imported from disk;
3. it becomes selectable immediately;
4. its project-local file/manifest entry is actually written;
5. calibration handles work on it;
6. Save + reload preserves the arena and its tuned calibration;
7. existing built-in arenas still work;
8. no absolute machine path is persisted in campaign/library data.

Run normal typecheck/tests/build for touched code.

## Delivery

Short `RESULT / VERIFY / FOUND` plus `USER PLAYTEST` with only the practical import/calibration steps.

Commit, push, verify remote SHA, mark DONE.
