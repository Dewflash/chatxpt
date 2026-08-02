# Contributing

## Before starting

1. Pull `main` and read `AGENTS.md` plus `docs/TEAM_CONTEXT.md`.
2. Claim or create one issue with a clear acceptance signal.
3. Create a short-lived `feature/`, `fix/`, or `docs/` branch from `main`.
4. Add your name to the issue, not to a permanent subsystem silo.

## Pull requests

- Explain the user-visible outcome and risk.
- Include screenshots or a short capture for UI changes.
- List commands actually run.
- Keep secrets and real viewer data out of code, fixtures, screenshots, and logs.
- Require one teammate review; use two for shared types or demo-critical behavior.

## Definition of done

- The happy path works in mock mode.
- Failure behavior is understandable to the producer.
- Relevant tests are updated.
- `npm run check` passes.
- Docs or decisions are updated when scope changes.
