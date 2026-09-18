# TASK: FIX-030 — Arrow Style Polish (live)

STATUS: DONE (awaiting user visual acceptance)
TYPE: FIX
SIZE: M
AGENT: Claude
BASE_BRANCH: integration/BUILD-030-editor-shaman-tail-merge
BRANCH: fix/FIX-030-arrow-style-polish
START_SHA: e06e32c841750b385e9dbaba289e7b1e716333ba

## Context

User rejected the current live arrow look (flat cream ribbon, hard right-angle
joints, undersized head, heavy drop shadow — confirmed live at
`prologue-5x5-good`, matches user's screenshot). User reviewed a 4-panel
Design artifact comparing directions (Current / Fletched Arrow / Ember Groove /
Rune Segments) and picked a course directly, without a separate VIS mockup
round:

- **Base state (free/blocked/pinned, at rest) = Ember Groove**: path reads as
  a carved channel in the stone (dark recess + thin gold thread when free,
  empty dark groove when blocked), not an object sitting on the plate. See
  `.worktrees/VIS-015` canvas artifact panel "02 — Ember Groove" for the
  reference look (carved channel, no shadowBlur glow, smooth rounded corners
  via quadratic joins, kite arrowhead flush with the stone).
- **hover / targeting / firing = fantasy-effect direction**, but toned down:
  - NO neon;
  - NO thick black borders/outline rings;
  - NO ugly grey inactive/blocked heads — blocked heads should read as quiet
    dull stone/iron, not flat ugly grey.
  - Reuse the *idea* of VIS-013/VIS-014's warm champagne/gold moving
    highlight + restrained halo (see `spikes/arrow-core/viewer/visual-proto/arrow-style.js`
    and `board-renderer.js` on branch `spike/VIS-014-arrow-effect-polish`,
    worktree `.worktrees/VIS-014`, for the existing implementation this can
    be adapted from), but apply the *magic* accent as a layer on TOP of the
    Ember Groove base, not as a full ribbon replacement.
- In normal gameplay, do not over-hint the solution to the player — keep
  strong glow/pulse highlighting reserved for tutorial/hint/special cases,
  not blasting on every hover in a normal encounter.
- Existing arrow geometry (`cells → cellCenter → polyline`, board plane /
  perspective from FIX-021/FIX-023) is NOT to be broken — this is a
  presentation-only change on top of it, same as VIS-010's invariant.

Real production renderer to edit: `spikes/arrow-core/viewer/visual-proto/board-renderer.js`
(this worktree's copy — same file VIS-013/014 spiked on a separate branch,
never merged). Do not touch `board-plane.js`, calibration, or gameplay/core.

## Goal

Ship a live, in-browser arrow look that:
1. At rest (free/blocked/pinned): reads as Ember Groove — carved channel,
   thin gold thread when free, empty dark channel when blocked (no flat grey
   "ugly" blocked heads — blocked head should be dull warm stone/iron, still
   legible, not neon-adjacent but not lifeless grey either).
2. On hover/targeting/firing: a restrained warm magic accent (toned-down
   fantasy-effect language) layers on top — no neon, no heavy black ring,
   default intensity low enough that normal play doesn't shout the solution;
   reserve strong versions for tutorial/hint call sites only.
3. No `shadowBlur` glow-noodle regression, no hard right-angle joints, no
   undersized head — the "criss-crooked" complaint from the original report
   must be visibly gone.
4. If time allows: 1–2 extra tuned variants of the above for the user to
   compare live (e.g. thread thickness / accent intensity / head shape
   tweaks), switchable live in the browser without rebuild.

## Constraints

- Do not change puzzle/gameplay logic, board geometry, calibration, or
  projection math.
- Work live in the browser (dev server), iterate on actual visual result —
  don't just eyeball the diff.
- Keep it short to review: no new abstractions beyond what this needs.

## Delivery

Short `RESULT / VERIFY / FOUND`. Do not merge `integration/BUILD-030-...` or
`main`. Commit on this branch; ask before pushing to origin.

### RESULT

`board-renderer.js`'s `drawArrow` repainted, geometry (`pts`/`cellCenter`/
`localScale`) untouched:

- Base (free/blocked/pinned): recess shadow + groove-wall stroke (`col.groove`/
  `col.grooveShadow`, replaces the old flat-black `arrowOutline` halo drawn
  under every body/head) render the path as a carved channel. A thin warm
  thread (`col.arrow`/`col.aim`, ~0.065×`localScale` wide, matches VIS-010's
  `0.07S` spec) lights the channel only when free+unpinned; blocked is just
  the empty dark groove, no separate blocked-body color needed. Removed the
  `shadowBlur` body/head glow and the `lighter`-composite white inner core
  (both were the reported "glow noodle").
- Arrowhead: flush kite, dark keyline stroke instead of the old black-halo
  double-draw, no `shadowBlur`. Blocked heads use new `col.headBlocked` (dull
  warm iron/stone) instead of reusing the flat beige `arrowDim` (the "ugly
  grey" complaint). Head enlarged `0.42S -> 0.48S` for faster direction read.
- Hover/targeting: new restrained `col.magicEdge` accent (toned-down
  fantasy-effect direction) — a thin warm edge-light on the body, alpha 0.24
  for an actual hover and only 0.14 for ambient "aimed at a live target" (so
  normal play never lights every arrow at once); no neon, no thick ring.
  Functional feedback (mistake/blocker/denied/hint rings) untouched, kept
  separate from this accent so the two languages never mix.
- `firing` (`drawShot`): `shadowBlur` 10 -> 6, restrained per VIS-010's
  "short one-shot flash" exception.
- 3 live-switchable variants (`?arrowFx=0|1|2`, `window.visualDebug.setArrowFx(v)`/
  `.arrowFx()`, no reload): **0** (default) quiet static edge-light; **1** adds
  a slow deterministic traveling highlight dot along the thread
  (`pointAtFraction` helper); **2** moves the "aimed" accent off the body
  entirely onto a thin ring around the head. All three share the same
  restrained alpha/no-neon language.

### VERIFY

- `npm run typecheck` (tsc, arrow-core): clean.
- `npx vitest run`: 24 files / 288 tests green (core untouched, expected).
- Live in-browser, `.worktrees/FIX-030`, `prologue-5x5-good` (launch config
  `fix-030-arrow-style-polish`, port 5209): confirmed via `getImageData`
  pixel sampling (not just screenshot-by-eye, which compresses the thin
  thread into a misleading blur at low zoom) that the free arrow renders as
  a genuine dark groove (`#241a12`) with a distinct bright thread column, not
  a solid ribbon. Hovered and confirmed the restrained warm edge-light
  appears only on the hovered/targeting arrow. Cycled `arrowFx` 0/1/2 live;
  variant 1's traveling spark and variant 2's head-only ring both render.
  Confirmed no black halo and no `shadowBlur` bloom anywhere in the base
  state; corners read as smooth carved turns, not a criss-crossed zig-zag.
- Not re-verified: rotate/multi-stage/other boss scenes, mobile viewport,
  light theme (`dark` palette branch only spot-checked) -- same geometry
  code path as before, low risk, but flag for the user's own pass.

### FOUND

- This worktree had no untracked art (`spikes/.../assets/enemies/{small-green-slime,small-spider,toxic-demonic-spider}`
  shown as untracked in the session's initial `git status` on the main
  checkout) and no `dist/`/`node_modules/` -- ran `npm install && npm run
  build` locally in the worktree first. A few enemy-pose images 404 in the
  console as a result (untracked-asset gap, not a code defect); does not
  affect the arrow-style verification, unrelated to this task's scope.
- `.claude/launch.json` (gitignored, local-only) gained a
  `fix-030-arrow-style-polish` entry (port 5209) pointing at this worktree,
  same convention as the existing `vis-014-...` entry -- not part of this
  commit, machine-local dev config only.
- Headroom for a follow-up, not done here (kept in scope): blocked-head
  tone (`headBlocked`) is warmer than the old beige but still fairly plain;
  could push it closer to a dull "cold iron" if the user wants blocked to
  read even quieter next to the free thread.
