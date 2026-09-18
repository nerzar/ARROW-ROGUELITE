# TASK: VIS-014 — Polish Fantasy Effect Arrow

STATUS: DONE
TYPE: SPIKE / VISUAL POLISH
SIZE: S
AGENT: Claude / visual polish
BASE_BRANCH: spike/VIS-013-arrow-renderer-reference
BRANCH: spike/VIS-014-arrow-effect-polish
START_SHA: 6ef85db9d0c9e0549babd2e78d2efccbc85ab4bd

## User decision

The user rejected `fantasy-flat` and `fantasy-inlaid` as visual directions.

The only promising result from VIS-013 is `fantasy-effect`.

Do not create more styles. Polish that one live.

## Problems visible in the current spike

1. Hover treatment is ugly/heavy.
2. Arrowhead is visually crooked/misaligned and too clumsy.
3. The palette/state treatment feels over-colored/overworked.
4. The moving highlight in `fantasy-effect` is too white and too opaque; it reads like a white dashed tube rather than subtle fantasy magic.
5. The arrowhead is partially transparent / visually open enough that the rounded end-cap of the shaft is visible underneath it. This makes the head look assembled from two overlapping pieces instead of one continuous arrow.

## Goal

Turn `fantasy-effect` into a restrained warm fantasy effect that the user can accept or reject in the browser.

Keep:
- rounded path geometry;
- warm fantasy direction;
- deterministic animated focus effect;
- effect only on hover/hint/focused actionable arrow.

Remove/simplify:
- extra hover outline/ring in fantasy-effect;
- unnecessary rune/diamond clutter if it hurts readability;
- white toothpaste/dashed look;
- any cyberpunk/neon feel.

## Technical fixes

### 1. Fix arrowhead alignment correctly

Do not orient the head with a flat screen-space rotated DX/DY vector.

The board is homography-projected, so the arrowhead direction must follow the ACTUAL projected tangent at the arrow end.

Use the projected final path tangent (or project a small virtual step beyond the final logical cell in `a.dir`) so the head always aligns with the shaft under perspective and rotation.

Make the head slightly smaller/narrower than the VIS-013 head and overlap it cleanly with the shaft.

Also fix the shaft/head overlap artifact:
- the shaft must terminate UNDER the head without its rounded line-cap being visible through the head;
- do not rely on partial transparency to hide it;
- preferred solutions are to trim the shaft to the head base / use a non-rounded cap for the terminal segment / clip or overpaint the shaft under the opaque head;
- the final head should read as one solid continuous piece with the shaft, with no visible rounded "stick end" inside it.

### 2. Replace white dashed highlight

Current effect uses:
- very light `#fff3d0`;
- alpha ~0.85;
- animated dashed stroke.

Replace that with a subtle warm translucent sheen:
- champagne/gold, not white;
- much lower opacity;
- one short moving continuous highlight segment (preferred) rather than repeated dashes;
- rounded ends;
- no bead/dash rhythm.

Target visual intensity: clearly visible when watching it move, but almost transparent in a still screenshot.

### 3. Tone down particles/halo

- head halo: soft warm gold, lower alpha;
- sparks: 1–2 small particles, low alpha;
- no random flicker;
- keep deterministic timing;
- no full-board expensive effects.

### 4. Simplify base state colors

For this spike:
- free/actionable: warm gold;
- blocked: quiet ivory/stone/grey;
- aimed at target: slightly stronger gold, not a different loud color family;
- pinned keeps its rock language.

No multicolor mechanics.

### 5. Remove ugly hover stroke

For `fantasy-effect`, hover itself should not add the old thick muted/grey outline.
Hover should only enable the subtle magical overlay.

Keep red/orange mistake/blocker feedback where it is actual gameplay feedback.

## Add live tuning

Add a developer-only effect intensity control:
- slider or query/debug value;
- range 0..1;
- adjusts halo/highlight/spark alpha together;
- live, no reload.

Suggested default around 0.2–0.3, but let the user tune it in browser.

Expose through `visualDebug` too if easy.

## Verify

No gameplay changes.

Check:
- Stage 1;
- Stage 5;
- rotate;
- hover;
- hint;
- head remains aligned on arrows near top/bottom/left/right of projected board;
- no rounded shaft end is visible through/inside the arrowhead at any perspective;
- effect intensity changes live;
- tests/typecheck/build green.

Do not merge. User visually accepts/rejects.

## Delivery

Short RESULT / VERIFY / FOUND.
Include exact URL/query/debug control for effect intensity.

### RESULT

- Arrowhead direction now comes from the board's actual projected tangent (`board-renderer.js`'s `headTangent`, via a new `board-plane.js` `cellPointToScreen` helper), not a flat rotated DX/DY vector — stays aligned under perspective and Rotate.
- Shaft path now trims to the head's own base point (not the logical cell center), so the rounded shaft cap never shows through/under the head on any state, including partially-transparent blocked/pinned heads. Head is also slightly smaller/narrower.
- `fantasy-effect` hover no longer draws the old thick grey ring; only the magic overlay runs on hover. Red/orange/amber/green rings (mistake/blocker/pin-denied/hint) are untouched.
- Magic highlight is now one short, rounded-cap, warm champagne (`#f0cd8c`) segment that glides the shaft length and loops off the end — no dashes/beads, no white toothpaste look.
- Halo and sparks toned down (halo alpha 0.30→0.22, sparks 3→2 particles) and everything (halo/highlight/sparks) is scaled together by a new live `effectIntensity` (0..1).
- Live effect-intensity control: query param `?fx=`, debug-panel slider ("Effect intensity (spike)"), and `window.visualDebug.effectIntensity()` / `setEffectIntensity(v)` — default `0.25`, no reload needed.
- Base state colors (free gold / aimed brighter gold / blocked quiet taupe / pinned rock) were already single-family and restrained — left untouched, no separate change needed.
- Found and fixed a real bug in `normalizeEffectIntensity`: `Number(null)`/`Number('')` are both `0`, so an unset query param silently forced the effect fully invisible instead of the intended 0.25 default — now unset explicitly falls back to the default.

### VERIFY

- `npm run build`, `npm run typecheck`, `npx vitest run` — all green (25 files / 302 tests), from a dedicated worktree (`.worktrees/VIS-014`) after the shared checkout got switched to another branch mid-task.
- Browser (`viewer/visual-proto/?arrowStyle=fantasy-effect`): baseline head reads as one clean piece (no visible shaft stub), confirmed via pixel-cropped zoom.
- Same check after `Rotate` (multiple 90° steps, `act1-e1` 6x7 board): heads on up/down/left-pointing arrows near board edges stay aligned, no crooked heads.
- Hover: no grey ring; at `fx=1` the halo/traveling highlight/spark are all visibly warm and subtle (not neon/white); at default `fx=0.25` the effect is barely-there in a still frame but the traveling highlight reads clearly once moving, per the brief's target.
- No gameplay files touched (`spikes/arrow-core/src/**` untouched) — presentation-only, confirmed via diff.

### FOUND

- The repo's shared checkout got switched to `build/BUILD-031-editor-authoring-polish` by something outside this task mid-session (uncommitted work was auto-stashed by git, not lost). Per user instruction, finished the task in a dedicated worktree (`.worktrees/VIS-014`) instead of touching the shared checkout again. New `.claude/launch.json` entry `vis-014-arrow-effect-polish` (port 5207) points at that worktree.
