# TASK: BUILD-029 — Arena Import + Editor Dropdown UX

STATUS: DONE
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

---

## RESULT

**1. Dropdown readability** (`calibration-editor.css`) — root cause: `<select>` text color was
pinned to `--ink` (near-white in dark mode) but the native options popup followed the OS
`color-scheme`, so on a light-OS machine the popup rendered a light background with near-white
text. Fixed with two generic, unscoped rules that cover every `<select>`/`<option>` in the
document (arena, level, board size, blocked-tap, creature/species, slot — including selects
created dynamically per enemy card), not just the arena picker:
```css
select { color-scheme: only dark; }
option { background-color: var(--bg-b); color: var(--ink); }
@media (prefers-color-scheme: light) { select { color-scheme: only light; } }
```
Forcing `color-scheme` on the select itself makes the native popup chrome match this tool's own
theme regardless of OS setting, and pinning `option` background/color guarantees contrast even
where a browser only partially honors `color-scheme` on the popup.

**2. Import Arena** (`calibration-editor.html/js/css`, `campaign-model.js`, `asset-catalog.js`,
`tools/serve.mjs`) — new "📥 Import Arena" button next to the arena `<select>`:
- Opens a native file picker (`accept="image/png,image/jpeg,image/webp"`).
- Picked file -> dataURL -> `POST /api/assets/import-arena` (new dev-server endpoint): validates
  extension, sanitizes the filename, writes the real file to
  `viewer/visual-proto/assets/arenas/imported/<timestamp>-<name>` (path-traversal guarded, 15MB
  cap), returns the relative path. No absolute machine path is ever produced or stored.
- On success, a new `ArenaCatalogItem` is registered at **runtime** into the same `ARENA_CATALOG`
  array the built-in arenas already live in, via a new `asset-catalog.js#registerArena()` — the
  `asset-catalog.js` *source file* is never rewritten, only its in-memory array is appended to.
- Applied to the current level through the **existing, unmodified** `changeLevelArena()` path
  (`calibrationId: null` -> resolves the `prologue-5x5-good` baseline calibration), so a freshly
  imported arena always gets a fresh, sensible calibration shell — it never inherits the
  previously-selected arena's stale corners/anchors, exactly like switching between two built-in
  arenas already worked before this task.
- Newly imported arena is auto-selected in the dropdown, so the user lands directly on the
  existing CAL-001 drag handles (board corners / actor anchors / effect anchors / scale / pivot)
  — none of that calibration code was touched or duplicated.
- Persistence: **design deviation from the task-card's stated preference**, flagged below in
  FOUND — used a `campaign.customArenas[]` array (added to `createDefaultCampaign()` and the
  `AuthoredCampaign` type) instead of a separate arena-library/manifest file. A normal Save
  writes it inside `campaigns/campaign.json` next to the rest of the authored data. On load
  (`loadCampaign()` success and "Reload file"), a new `rehydrateCustomArenas()` re-registers
  every `customArenas` entry back into `ARENA_CATALOG` + the `<select>`, so imported arenas
  survive a full page reload, not just the current session.
- Explicit dev-server-unreachable fallback (mirrors the BUILD-026 localStorage-fallback
  precedent): if the POST fails, the arena still applies for the current session via an inline
  dataURL, and the status bar + its catalog label say plainly "session only, not written to a
  project file" — that entry is deliberately **not** pushed into `customArenas`, so
  `campaign.json` never gets bloated with embedded image bytes.
- A status bar under the topbar reports success/failure in plain language with the next step
  ("now drag the board corners/anchors to calibrate, then Save").
- Existing built-in arenas (BUILD-028's generated catalog) are untouched and still selectable;
  `ensureBgPickOptions()` only *appends* missing options, it never rebuilds the list.

## VERIFY

Ran in an isolated worktree (`.worktrees/BUILD-029`, own `node_modules`, dev server on a scratch
port, never touching the shared root checkout or its uncommitted `campaign.json`):

- `npm run typecheck` / `npm run build` — 0 errors (`viewer/visual-proto/**` is outside
  `tsconfig.json`'s `include`, so these are plain-JS edits outside the TS build graph; confirmed
  clean after the changes anyway since two `.ts` test files import `asset-catalog.js`/
  `campaign-model.js` and pick up their `.d.ts`, which were updated to match).
- `npm test` — 288/288 passed (24 files), unchanged from before this task.
- Browser (built-in Claude Browser, Chromium), against the checklist above:
  1. **Dropdown readability** — read `getComputedStyle` of an `<option>` in `#bgPick` under both
     color schemes: dark mode `background: rgb(23,16,24)` / `color: rgb(239,236,228)`
     (near-black/near-white); light mode (`resize_window` colorScheme:"light")
     `background: rgb(183,166,137)` / `color: rgb(33,26,18)` (tan/near-black). Strong contrast in
     both, and the fix is a document-wide `option`/`select` rule so it applies to every select in
     the editor, not just the one checked.
  2–3. **Import + immediate selectability** — native file dialogs can't be driven by browser
     automation, so called the exact production function via a debug hook
     (`window.calibrationEditorDebug.importArenaFile`, added specifically for this) with a
     constructed `File`; `#bgPick` immediately showed and selected "Imported: test-arena.png".
  4. **Real file written** — `read_network_requests` showed
     `GET .../assets/arenas/imported/<ts>-test-arena.png -> 200`, and `ls` on disk confirmed the
     file existed (70 bytes, matching the tiny test PNG).
  5. **Calibration handles work** — dragged the TL board-corner handle with the mouse (existing
     CAL-001 drag pipeline, not import-specific code): `boardPlaneFrac.tl` changed from
     `[0.37, 0.45]` to `[0.4217, 0.5438]`, grid mesh visibly reshaped on screenshot.
  6. **Save + reload round-trip** — Save badge showed "✔ Saved to campaigns/campaign.json &
     storage"; read the written file directly and confirmed `customArenas` held the new entry and
     `levels[0].presentation.calibration.boardPlaneFrac.tl` held the dragged value. Full page
     reload afterwards showed badge "Loaded from file", arena `<select>` still selected on
     "Imported: test-arena.png", grid still showed the dragged shape.
  7. **Existing arenas still work** — the 7 built-in `ARENA_CATALOG` entries remained present and
     selectable in `#bgPick` throughout (`ensureBgPickOptions()` only appends).
  8. **No absolute path persisted** — inspected the saved JSON; `customArenas[].path` and
     `levels[].presentation.background` are both `assets/arenas/imported/...` (relative), never a
     `C:\...` path.
  - `read_console_messages` after all of the above: only pre-existing missing placeholder assets
    (`board-frame.png`, `boss-goblin-*.png`, etc. — same ones already noted 404-ing in CAL-001's
    FOUND); no new errors from this task's code.
  - Cleaned up before committing: `git checkout -- campaigns/campaign.json` (discarded the test
    Save) and deleted the throwaway `viewer/visual-proto/assets/arenas/imported/` test file —
    nothing test-related is in the commit.

RESULT_SHA: 7a73d6f74e15227ba6c1c0c89dd397f78b07f493 (code commit, directly on top of this
task's own `7335884` task-card commit).

## USER PLAYTEST

1. `cd spikes/arrow-core && node tools/serve.mjs` (or your usual port), open
   `http://localhost:<port>/viewer/visual-proto/calibration-editor.html`.
2. Open any dropdown (arena / level / creature) — options should now be clearly readable.
3. Click `📥 Import Arena`, pick a PNG/JPG/WebP from disk. It should apply to the current level
   immediately (status bar turns green: "Imported ... now drag the board corners/anchors to
   calibrate, then Save").
4. Drag the board corners / actor anchors / effect anchors to fit your new art, exactly as with
   any built-in arena.
5. Click `💾 Save` -> badge should turn green ("Saved to campaigns/campaign.json & storage").
6. Reload the page — your imported arena should still be selected with your tuned calibration.

## FOUND

- **Design deviation from the task-card's stated preference**: the card asked to "prefer a small
  data-driven arena-library file over rewriting `asset-catalog.js` source code at runtime." This
  never rewrites `asset-catalog.js`'s source (only its in-memory array, via `registerArena()`),
  but instead of a *separate* arena-library/manifest file it persists imported entries inside
  `campaign.customArenas[]` in `campaigns/campaign.json` (the file the tool already
  reads/writes on every Save/Load). Reasoning: it satisfies every functional requirement
  (immediate availability, survives reload, coexists with built-ins, no absolute paths) using the
  persistence mechanism that already exists, without introducing a second file format/source of
  truth to keep in sync. If a standalone arena-library file (shareable independently of any one
  campaign) is wanted instead, that's a follow-up, not a large change — flagging for the
  user/architect to decide rather than silently picking the closer-to-literal reading.
- Keyboard-driven handle nudging (arrow keys / Shift+arrow, pre-existing CAL-001 contract) didn't
  respond to simulated key presses after a simulated `left_click` on the handle in this
  browser-automation session — `document.activeElement` stayed `<body>` after the click. Mouse
  drag (the tool's primary documented interaction, used for the VERIFY above) worked correctly.
  Looks like an automation-only focus quirk, not something this task's changes touched — flagged
  for whoever next touches CAL-001 handle interaction, not fixed here (out of this task's scope).
- No headless way exists in this environment to drive a native `<input type=file>` picker, so
  Import Arena was verified by calling the exact production function via a debug hook instead of
  clicking the button + OS file dialog. The button's `.onclick`/`.onchange` wiring is a thin,
  directly-readable pass-through to that same function, so this is considered equivalent
  coverage — but worth a human clicking the real button once to confirm the OS dialog itself
  opens correctly on their machine.
