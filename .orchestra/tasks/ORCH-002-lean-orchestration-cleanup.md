# TASK: ORCH-002 — Lean orchestration cleanup

STATUS: DONE
TYPE: BUILD/DOCS
SIZE: S
AGENT: Architect
BASE_BRANCH: fix/PLAYTEST-002-claude-prologue-polish
BRANCH: docs/ORCH-002-orchestration-cleanup

## Goal

Bring the actual orchestra docs in line with the user's approved lean process without losing gameplay/project decisions.

## RESULT

- `RULES.md`: task-card is primary; short dispatch prompts; no research/review/fan-out by default; old task history is not default context; task reports stay concise; visual work waits for user review.
- `PROJECT.md`: current stage is playable Prologue stabilization; preserved gameplay/character decisions; market research moved to secondary/paused context instead of current blocker.
- `GIT.md`: simplified delivery; removed circular final-SHA ceremony; worktree required when parallel/shared/dirty, not as universal ritual; cleanup of accepted branches remains explicit.
- `BOARD.md`: current priority is PLAYTEST-002; no prebuilt chain after it; market tasks are preserved but paused.
- `PLAYTEST-002`: same product goal and constraints, but prompt/task wording no longer hard-codes Chrome or asks for excessive browser loops/history reads.
- Archive: recorded already-integrated MKT-001 so it no longer appears as unfinished work.

No gameplay code, assets, runtime logic or user decisions were changed.

## VERIFY

Documentation-only diff. Cross-checked preserved decisions against the current playable lineage and prior task records.

## FOUND

Older branches keep the older orchestra files in their history. New work should start from/integrate this cleanup before relying on orchestra docs; do not try to rewrite historical branches just to make their old copies current.
