# Model Routing — Arrow-Roguelite

Updated: 2026-09-19.

Purpose: choose the cheapest/reliable executor that fits the task. This is routing guidance, not a ranking. Harness/provider reliability matters as much as raw model quality.

## General rule

- S/FIX: prefer cheap coding models with a narrow task-card.
- M/BUILD: use a model proven on repo-level tool use; require tests + live check.
- L/integration/architecture: reserve Claude/Codex/Gemini Pro-class capacity.
- Visual/game-feel work: prefer models with strong multimodal/visual coding, then verify in the live viewer.
- For Cline/OpenRouter: one task = one goal; avoid huge mixed-scope prompts. Provider instability can dominate model quality.

## Current pool

### Laguna via Cline/OpenRouter

Publicly documented Poolside Laguna models are Laguna S 2.1 / XS 2.1; the exact user-facing label `Laguna C2` was not found in public model docs, so confirm the exact backend before assuming S vs XS.

Public Laguna S 2.1 profile:
- agentic coding / long-horizon tool use;
- 118B total / ~8B active MoE;
- up to 1M context on official checkpoints;
- strong software-engineering benchmarks, but not frontier-best;
- OpenRouter free routing can have provider/tool-call instability.

Project-local observation:
- first Laguna session hallucinated Unreal Engine before repo recon;
- after an explicit read-only sanity-check it correctly identified TypeScript/Canvas/Vite and relevant HUD files.

Routing:
- GOOD: narrow FIX, small repo edits, tests, terminal work, constrained UI/CSS fixes after recon.
- TRY: medium coding task only after it proves stable in the current harness/provider.
- AVOID: open-ended architecture, broad visual direction, multi-front tasks, expensive long-context wandering.
- Prompt rule: force repo recon first; name exact branch/task-card; narrow files/scope; require live server URL for interactive fixes.

### Muse Spark 1.3

Meta positions Muse Spark 1.3 for long-horizon agentic coding, multimodal perception, game/web development and visual coding. It supports large context and tool use.

Project-local observation:
- solved the arrow presentation task on the first attempt after other agents struggled;
- strong candidate for geometry, visual coding, presentation/VFX and screenshot-driven implementation;
- availability has been intermittent for the user.

Routing:
- GOOD: game presentation, VFX, geometry, visual/UI coding, screenshot/reference-driven tasks, medium agentic implementation.
- TRY: larger implementation if service is stable.
- AVOID: making it the only owner of critical-path work when availability is flaky.

### Gemini / Antigravity

Google Antigravity is designed for long-running agentic workflows with filesystem/code execution and automatic context compaction. Current Antigravity supports Gemini 3.1 Pro and newer Flash models; the managed-agent default may be a Flash model unless explicitly changed.

Routing:
- GOOD: M/L feature implementation, broad repo work, repetitive multi-file changes, browser/live-game iteration.
- BEST USE HERE: substantial independent BUILD tasks such as ITEM systems, map/shop implementation, animation/presentation passes.
- CAUTION: AI Studio Git sync has already overwritten newer repo state once; never let it force-push canonical main without a safety/integration plan.
- For harder tasks, explicitly select a Pro/high-reasoning model when available instead of assuming the Antigravity default.

### Codex

OpenAI positions Codex for end-to-end engineering, complex refactors, migrations, long-running tool use and parallel worktrees.

Project-local observation:
- BUILD-036 HUD integration was technically stronger than the Gemini attempt, though it still needed visual fit fixes.

Routing:
- GOOD: precise implementation, repo-wide refactor, integration-ready code, tests, asset wiring, multi-file engineering.
- BEST USE HERE: tasks where the design is already decided and the requirement is 'implement exactly this'.
- AVOID: spending it on open-ended visual taste exploration when a cheaper visual model can produce references first.

### Claude — Opus 5 / Sonnet 5

Anthropic positions Sonnet 5 as highly agentic and close to older Opus-class capability at lower cost; Opus 5 is targeted at frontier coding/knowledge work and deep reasoning.

Project-local observation:
- Claude game designer produced the successful LD-007 Act I pass;
- Claude is already the trusted tech lead for Git/integration/risky changes.

Routing:
- Opus: tech lead, architecture, conflict resolution, difficult design synthesis, critical reviews, hard game-design passes.
- Sonnet: strong repo work/review/implementation when Opus is unnecessary.
- Preserve Claude quota for integration and high-risk decisions; do not burn it on routine S fixes.

### DeepSeek V4.1 Flash

OpenRouter describes DeepSeek V4.1 Flash as a cost-efficient model for coding, terminal/computer-use agents and long-horizon tasks, with ~1M context.

Routing:
- GOOD: routine BUILD/FIX, scripts, tests, data transformations, code audits, self-contained backend/core changes.
- TRY: longer agentic tasks when cost matters.
- Prefer over expensive models when the task has objective tests and little visual judgment.

### Qwen 3.8 Flash / Qwen Coder

Current Qwen models are positioned for multimodal agents, visual coding, computer interaction and coding-agent workflows. Qwen Coder variants are specifically optimized for tool use and repository coding.

Routing:
- GOOD: browser/UI debugging, screenshot-driven fixes, frontend implementation, cheap coding agents, repo reconnaissance.
- Coder variants: prefer for code-heavy tasks; Flash variants: useful when vision/browser interaction matters.

### GLM 5.3

GLM 5.3 is positioned for complex software engineering and long-horizon agent tasks with very large context and always-on reasoning.

Routing:
- GOOD: medium/large repo reasoning, nontrivial implementation, analysis-heavy coding tasks when Claude/Gemini quota is scarce.
- Use for tasks where long context/reasoning is useful, not trivial one-file fixes.

## Assignment checklist

Before assigning:
1. Is the task visual/taste-heavy, code-heavy, or integration/risk-heavy?
2. Does it have objective tests or require human visual acceptance?
3. Is the provider/harness currently stable and within quota?
4. Can a cheaper model do it with a tighter task-card?
5. Does the task overlap active branches? If yes, delay or route to tech lead.

After assigning:
- require RESULT / VERIFY / FOUND / SHA;
- visual/interactive work: require live viewer URL and leave server running when practical;
- do not trust self-reported DONE without Git diff/tests/live check;
- update this document when a model repeatedly succeeds or fails on a task class.

## Empirical overrides

Actual project performance beats benchmark reputation. If a model repeatedly succeeds at a task class in this repo, route similar work to it even if another model is stronger on paper. Likewise, repeated looping/hallucination in a specific harness/provider is a routing penalty.