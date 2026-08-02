# Contributing

Start with `docs/TEAM_PLAYBOOK.md`. It is written for contributors who have not worked in a shared codebase before and contains the exact safe Git, Codex, decision, TODO, changelog, and pull-request sequence.

## Required authority

Before planning or editing, read:

1. `AGENTS.md`
2. `docs/TEAM_PLAYBOOK.md`
3. Your `docs/roles/ROLE-<n>.md`
4. `docs/DECISIONS.md`
5. `docs/PROJECT_TODO.md`
6. Your `docs/roles/ROLE-<n>-TODO.md`

## Before starting a task

1. Confirm `git status --short` is clean. If it is not, protect the current work before pulling or switching.
2. Fetch and ask Codex to summarise relevant incoming changes.
3. Update local `main` with `git pull --ff-only`.
4. Claim or create one issue with a clear acceptance signal.
5. Create `role-<n>/<short-summary>` from current `main`.
6. Ask Codex for every material decision required by this pass in one batch.
7. Keep implementation inside the assigned role's owned directories.

## Pull requests

- Never push directly to `main` and never merge your own pull request.
- Explain the user-visible outcome and risk.
- Include screenshots or a short capture for UI changes.
- Include evaluation/test evidence for AI or quest-engine changes.
- List commands actually run.
- State what is real, mocked, simulated, fallback, or not implemented.
- Update your role TODO and add a fragment under `changes/role-<n>/`.
- Keep secrets and real viewer data out of code, fixtures, screenshots, and logs.
- Require the affected owner for cross-role files and Role 1 for integration.
- Use two reviewers for shared types, authentication, safety, or demo-critical behaviour.

## Definition of done

- The happy path works in mock mode.
- Failure behavior is understandable to the producer.
- Relevant tests are updated.
- `npm run check` passes.
- `git diff --check` passes.
- Docs or decisions are updated when scope changes.
- The pull request template, TODO, and change fragment are complete.
