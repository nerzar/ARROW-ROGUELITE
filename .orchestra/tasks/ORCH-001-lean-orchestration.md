# TASK: ORCH-001 — Lean orchestration rules

STATUS: DONE
TYPE: BUILD
SIZE: S
AGENT: Architect
BASE_BRANCH: main
BRANCH: docs/ORCH-001-lean-orchestration

## Goal

Tighten orchestra rules around token/context discipline and task dispatch.

## RESULT

Updated `.orchestra/RULES.md` so that:
- task cards are the primary context; user dispatch prompts stay short;
- prompts do not repeat process already stored in orchestra docs;
- implementation is preferred over speculative research/review/meta-work;
- separate review/research tasks require a concrete reason;
- browser verification is requested generically as `browser`, not hard-coded to Chrome, and repeated browser loops are discouraged;
- visual work is not treated as accepted until the user has actually seen it;
- agents get freedom in implementation unless a constraint is truly required;
- duplicate agents/fan-out and repeated repo/context reads are explicitly discouraged.

## VERIFY

Rules are documentation-only and self-contained. No code/runtime changes.

## FOUND

The existing rules already contained the core principle of minimal model/context and avoiding duplicate agents/research. The missing part was explicit dispatch/prompt discipline and a stronger bias against unnecessary review/research/browser loops.

## STATUS

DONE
