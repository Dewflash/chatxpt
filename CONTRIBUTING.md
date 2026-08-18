# Contributing

Start with `docs/TEAM_PLAYBOOK.md`. It is written for contributors who have not worked in a shared codebase before and contains the exact safe Git, Codex, decision, TODO, changelog, and pull-request sequence.

## Required authority

Before planning or editing, read:

1. `AGENTS.md`
2. `docs/TEAM_PLAYBOOK.md`
3. `docs/build-plans/INTEGRATION-CONTRACT.md`
4. Your `docs/roles/ROLE-<n>.md`
5. `docs/DECISIONS.md`
6. `docs/TEAM_CONTEXT.md`
7. `docs/PROJECT_TODO.md`
8. Your `docs/roles/ROLE-<n>-TODO.md`
9. Your execution plan under `docs/build-plans/` for Roles 1-3, or the accepted Role 2-authored plan for Roles 4-5

## Before starting a task

1. Confirm `git status --short` is clean. If it is not, protect the current work before pulling or switching.
2. Fetch and ask Codex to summarise relevant incoming changes.
3. Update local `main` with `git pull --ff-only`.
4. Claim or update an issue with a clear acceptance signal when durable coordination is useful; an issue is not a permission gate.
5. Create `role-<n>/<short-summary>` from current `main`.
6. Match the task to one execution-plan pass and ask Codex for every open decision in that phase in one batch.
7. Put implementation in the directory matching its runtime responsibility; any contributor may work across role directories.

## Pull requests

- Never push directly to `main`. After independent review, any contributor with repository merge permission may merge the pull request; Role 1 is not the exclusive merger.
- Explain the user-visible outcome and risk.
- Include screenshots or a short capture for UI changes.
- Include evaluation/test evidence for AI or quest-engine changes.
- List commands actually run.
- State what is real, mocked, simulated, fallback, or not implemented.
- Update your role TODO and add a fragment under `changes/role-<n>/`.
- Keep secrets and real viewer data out of code, fixtures, screenshots, and logs.
- Request affected responsibility-lead context for cross-role files and notify Role 1 for integration support; neither is a personal approval gate.
- Obtain two independent reviewers for shared types, authentication, safety, or demo-critical behaviour.

## Definition of done

- Component logic works against clearly labelled fixtures; any live or integration claim is backed by real captured input.
- The changed public seam passes both producer and consumer contract tests; a wave is not done until its smallest vertical slice is merged and exercised on `main`.
- Missing gameplay facts remain `unknown`, and algorithmic/provider/deterministic fallback state is visible.
- Failure behavior is understandable to the producer.
- Relevant tests are updated.
- `npm run check` passes.
- `git diff --check` passes.
- Docs or decisions are updated when scope changes.
- The pull request template, TODO, and change fragment are complete.
