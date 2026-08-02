# Five-Person Workflow

Work in vertical, reviewable slices rather than five isolated layers.

## Suggested first-pass ownership

1. **Experience lead:** control room flow, copy, usability, and product coherence.
2. **Quest intelligence lead:** prompt, structured output, mock engine, safety, and evaluation cases.
3. **Overlay lead:** voting presentation, OBS route, timer, progress, and animation.
4. **Signals lead:** gameplay/chat simulators and later platform adapter spike.
5. **Demo and integration lead:** end-to-end reliability, deployment, deck evidence, and video runbook.

Ownership is temporary. Shared types and API contracts require coordination before edits.

## Daily rhythm

- **Start:** ten-minute check-in; each person states one acceptance signal for the day.
- **Midday:** merge at least once; demo current `main`, not individual branches.
- **End:** run the complete happy path and record blockers in issues.
- Keep one stable golden demo scenario that must never break.

## Branch and merge policy

- Start from current `main`.
- Keep branches under one day when possible.
- Sync current `main` before requesting review.
- Require one reviewer; use two for domain contracts or demo-critical changes.
- Do not force-push a branch another teammate is using without agreement.

## ChatGPT Pro collaboration

- Each teammate should open the same repository so `AGENTS.md` and the repo-local skill apply consistently.
- Give ChatGPT/Codex one issue and acceptance signal at a time.
- Ask it to inspect current files before editing; agents do not share live context or uncommitted work across five machines.
- Review every diff and never paste API keys, private viewer data, or competition credentials into chats.
- ChatGPT Pro and OpenAI API usage are separate; use mock mode until the team deliberately configures runtime API access.
