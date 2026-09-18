# HANDOFF — VIS-016 Arrow Style Finalize

## Why this file exists

Previous Claude session hit the account/session limit while actively editing the arrow renderer.
This handoff preserves the decisions and the unfinished local-work warning so another account can
continue without rereading the old chat.

## Critical local-state warning

Before editing anything:

1. Run `git worktree list`.
2. Find any old worktree/branch for:
   - `fix/FIX-030-arrow-style-polish`
   - `spike/VIS-014-arrow-effect-polish`
   - `design/VIS-015-arrow-visual-reference`
3. In each relevant worktree run:
   - `git status`
   - `git log --oneline -n 8`
   - `git stash list`
4. Do NOT switch the shared checkout.
5. Preserve any uncommitted arrow-renderer work before starting this task.

The old FIX-030 chat reported:
- local commit `e007355` existed but was not pushed;
- after that commit, the user rejected the carved-groove result;
- Claude then started rewriting the renderer toward a solid warm filled arrow;
- the session died during that rewrite with roughly `board-renderer.js +66/-66` still local.

Do not blindly restore/reapply the old carved-groove styling. Salvage geometry fixes and any
useful newer solid-fill WIP only.

## Accepted geometry decisions

Preserve these:
- rounded bends;
- arrowhead direction/perspective fix;
- arrowhead should be built/projected consistently with the board plane, not as a naive flat
  screen-space triangle;
- shaft terminates under the head;
- rounded shaft cap must never be visible through/inside the head;
- no gameplay/hitbox changes.

## Rejected visual directions

Do NOT return to:
- black/near-black inactive arrows ("black pipes");
- grey plastic-looking inactive heads;
- white internal tube/core;
- thick black/dark borders;
- heavy hover ring;
- permanent strong neon/cyberpunk glow;
- the carved Ember Groove base when it reads as dark groove + bright thread;
- fantasy-flat / fantasy-inlaid as previously shown.

## Current approved direction

The latest user references changed the decision:

### Base arrow
Use a simple, attractive, SOLID warm fantasy arrow as the default:
- warm gold / amber / champagne family;
- clear silhouette;
- premium fantasy feel;
- readable on rich arena art;
- no thick black outline;
- no white core/tube;
- no near-black groove.

The user explicitly said the first generated reference looked "красиво и приятно" and that exact
literal adherence is not required: prioritize beauty and pleasant readability.

### Inactive / blocked
- still visible;
- muted warm stone / ash bronze / desaturated warm gold;
- NOT black;
- NOT cold grey plastic;
- normal gameplay should not strongly reveal the solution.

### Effect layer
The user likes the stronger magic look from the second generated reference, but as an OPTIONAL
layer, not the default material:
- hover / targeting / firing;
- tutorial/hint mode;
- explicit special mechanics/status effects;
- warm magic, not cyberpunk;
- subtle by default; stronger variants are okay for special use.

## Gameplay readability decision

The player can take damage by clicking an arrow that collides with another arrow.

Therefore normal gameplay should NOT always make "safe/free" vs "bad/blocked" obvious through
strong dimming or loud effects.

Strong guidance may be used for:
- tutorials;
- explicit hint mode;
- special statuses (for example the rock/pin mechanic).

Normal levels should remain visually fair without solving the puzzle for the player.

## Variants

Variants are welcome.
If useful, expose 2–3 live palette/effect variants on the SAME corrected geometry, so the user can
compare them in-browser quickly instead of waiting for separate design cycles.

## Working style

This is a live visual task.
The user prefers to watch Claude work in the browser and give immediate feedback.
Show the live result before final commit when possible.
