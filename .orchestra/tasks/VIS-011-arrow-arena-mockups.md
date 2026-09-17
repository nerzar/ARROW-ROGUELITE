# TASK: VIS-011 — Arrow Arena Mockups

STATUS: READY
TYPE: DESIGN
SIZE: S
AGENT: Muse / visual design
BASE_BRANCH: design/VIS-010-arrow-presentation-spec
BRANCH: design/VIS-011-arrow-arena-mockups
START_SHA: a8c3294cd0bcb25ea7949706b0e048bf485d8572

## Goal

Turn the VIS-010 arrow language study into direct side-by-side mockups on the actual accepted/calibrated arena view so the user can choose a runtime visual direction before any renderer implementation.

The current runtime arrow style is not accepted. Do not modify runtime code in this task.

## Inputs

Read first:
- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/tasks/VIS-010-arrow-presentation-spec.md`
- `docs/VIS-010-ARROW-PRESENTATION.md`
- `docs/VIS-010-contact-sheet.html`

Use the latest accepted/calibrated 5x5 arena screenshot/reference available in the project or task materials. If the exact newest user-generated arena image is not in Git, use the closest accepted 5x5 calibrated scene and explicitly record that limitation. Do not invent geometry.

## Required output

Create 2 primary direct-comparison mockups using the SAME board / SAME logical arrow paths / SAME camera:

1. Variant B — Engraved Groove + running pulse
2. Variant C — Solid Core + sparse markers

Optional third mockup:
- Variant A — Segmented Rail, only if it adds a genuinely useful comparison.

Each mockup must show at least:
- one long winding free arrow;
- one blocked arrow;
- one hovered/selected arrow;
- one Stone Pin arrow;
- one firing/shot-travel cue;
- one hit/impact cue.

The arrows must visually follow the board perspective and appear embedded in / painted onto the stone, not floating as a flat UI overlay.

## Comparison criteria

For each variant, record briefly:
- instant direction readability;
- long-path readability;
- how well it sits on stone;
- free vs blocked readability;
- visual noise at 5x5 and 6x6 density;
- likely implementation complexity;
- main risk.

Do NOT pick a final winner on the user's behalf. A recommendation for playtest is allowed, but final acceptance belongs to the user.

## Output files

- `docs/VIS-011-ARROW-ARENA-MOCKUPS.md`
- one or more lightweight HTML/SVG mockups or image references suitable for direct visual review

No runtime renderer changes.
No gameplay changes.
No projection changes.
No arena calibration changes.

## Delivery

Use an isolated worktree from the start.
RESULT / VERIFY / FOUND -> commit -> push -> remote SHA verify -> STATUS DONE.
Do not merge main.
