# TASK: VIS-013 — Live Arrow Renderer Reference Spike

STATUS: READY
TYPE: SPIKE / VISUAL IMPLEMENTATION
SIZE: S/M
AGENT: free implementation agent
BASE_BRANCH: integration/BUILD-030-editor-shaman-tail-merge
BRANCH: spike/VIS-013-arrow-renderer-reference
START_SHA: e06e32c841750b385e9dbaba289e7b1e716333ba

## Goal

Make the current playable board render arrows close enough to the user-approved generated references that the user can judge them LIVE before any production visual rewrite.

This is intentionally a disposable/narrow renderer spike. No gameplay changes.

Approved direction:
- base arrows: warm fantasy gold / ivory, solid, readable, slightly embossed/inlaid into stone;
- clean rounded bends;
- integrated-looking arrowheads;
- dark keyline/bevel for separation from detailed arena art;
- restrained warm glow, NOT cyberpunk neon;
- blocked arrows remain clearly readable but quieter.

Special effect direction:
- on hover / selected / currently actionable-aimed arrow, allow a richer magical treatment:
  warm golden outer glow, moving highlight, a few rune/diamond accents and restrained spark particles;
- effect should feel like enchanted metal/rune magic, not a laser/neon tube;
- do not run the expensive effect on every arrow all the time.

## Current renderer context

The implementation already lives in:
`spikes/arrow-core/viewer/visual-proto/board-renderer.js`

Current drawArrow already has:
- projected polyline geometry;
- dark outline;
- main colored stroke;
- thin white core;
- shadowBlur;
- separate arrowhead;
- hover/hint/blocked state.

Build on that. Do not replace the board or combat renderer.

## Required live variants

Add a tiny developer-only style switch (query param or debug control) with 3 variants:

1. `fantasy-flat`
   - closest to reference #1;
   - warm gold active/free;
   - ivory/stone blocked;
   - dark outline;
   - minimal glow.

2. `fantasy-inlaid`
   - closest to reference #2;
   - slightly richer bevel/inlay feel;
   - warm gold edge + light core;
   - subtle rune/diamond accents;
   - still readable and not overglowing.

3. `fantasy-effect`
   - same base as inlaid;
   - ONLY hover/hint/actionable-aimed arrow gets the richer magic effect;
   - warm animated halo;
   - deterministic moving highlight/sparks/rune accents along the path;
   - no random flicker and no cyan/purple cyberpunk treatment.

The user must be able to switch variants without rebuilding/restarting.

## Geometry quality

The current visual problem is not only color/glow: some bends and heads look mechanically rough.

Improve presentation-only geometry:
- rounded 90-degree path bends rather than raw lineTo kinks;
- stable shaft thickness through corners;
- arrowhead visually joins the shaft and follows the same outline/fill language;
- keep current board projection/perspective behavior.

Do not alter logical cells, direction, hit-testing, canExit, combat, or rotation rules.

## State language

Keep semantics simple for the spike:
- blocked: quieter ivory/stone or muted warm metal, no magical effect;
- free: gold and readable;
- free + aims at a live target: stronger gold but not full VFX by default;
- hover/hint/actionable focus: full effect variant may animate;
- pinned/denied keeps its existing distinct rock feedback.

Do not introduce color-coded damage elements or future mechanics here.

## Performance constraint

Current long-arrow boards are small, but later content may contain many short arrows.

Therefore:
- static arrows should remain cheap;
- expensive shadow/spark/rune animation only for a tiny number of focused arrows;
- no full-screen postprocessing;
- keep it Canvas2D compatible.

## Verify

Browser is preferred but not mandatory for this spike executor.

At minimum:
- no gameplay behavior changes;
- all 3 styles switch live;
- Stage 1 and Stage 5 render;
- rotate still visually rotates arrow geometry;
- hover does not shift geometry/hitbox;
- current calibrated campaign remains unchanged;
- tests/typecheck/build remain green.

If browser tooling is unavailable, say so in VERIFY; the user will do the visual acceptance manually.

## Delivery

Short RESULT / VERIFY / FOUND.
Do NOT merge.
Do NOT declare a winning style.
User will choose after opening the branch.
