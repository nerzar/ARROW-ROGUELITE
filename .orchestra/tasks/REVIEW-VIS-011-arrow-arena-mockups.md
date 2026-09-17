# TASK: REVIEW-VIS-011 — Review Arrow Arena Mockups

STATUS: READY
TYPE: REVIEW
SIZE: S
AGENT: new agent / independent review
BASE_BRANCH: design/VIS-011-arrow-arena-mockups
BRANCH: review/VIS-011-arrow-arena-mockups
START_SHA: ea55e0c98d06653b76dc4671c77d482742051380

## Context

VIS-011 is already marked DONE on its source branch. The goal is NOT to redo the task from scratch, but to independently inspect the actual delivered mockups, verify they satisfy the task, and fix only clear defects if needed.

## Read first

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/tasks/VIS-010-arrow-presentation-spec.md`
- `.orchestra/tasks/VIS-011-arrow-arena-mockups.md`
- `docs/VIS-010-ARROW-PRESENTATION.md`
- `docs/VIS-011-ARROW-ARENA-MOCKUPS.md`
- `docs/VIS-011-arena-mockups.html`

## Review goal

Open and inspect the VIS-011 deliverables as a visual-design review.

Check that variants B and C are genuinely comparable on the same arena / same logical paths / same camera, and that the mockups make a useful user-facing choice possible before runtime implementation.

## Required review checks

1. Same arena, board geometry and logical path layout across variants.
2. Variant B visually matches the Engraved Groove + running pulse direction from VIS-010.
3. Variant C visually matches Solid Core + sparse markers.
4. Long free path direction is immediately readable.
5. Blocked vs free is visible without text labels.
6. Hover/selected state is readable but not noisy.
7. Stone Pin state is distinct from ordinary blocked.
8. Firing/shot cue has clear travel direction.
9. Hit/impact does not cover neighboring paths.
10. Perspective scaling feels embedded in the stone rather than like a flat overlay.
11. 5x5 is readable; 6x6 density preview is not obviously unusable.
12. State labels/tags in the mockup are clearly review UI, not proposed production UI.

## What to do

- If the deliverables are sound: do NOT redesign them. Write a concise review result and mark PASS / PASS WITH NOTES.
- If there are clear visual/spec defects: fix only those defects in the HTML/docs, preserving the same comparison setup.
- Do not change runtime code.
- Do not touch board-renderer.js, board-plane.js, gameplay, calibration, or arena metadata.
- Do not choose a final visual winner for the user.

## Output

Create:
- `docs/REVIEW-VIS-011.md`

Include:
- verdict: PASS / PASS WITH NOTES / NEEDS FIX;
- concrete issues found;
- files changed, if any;
- what the user should inspect visually before approving B/C/A.

## Delivery

Use an isolated worktree from the start.
RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
Do not merge main.
