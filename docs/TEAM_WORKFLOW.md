# Five-Person Workflow

Work within five strict areas of ownership while integrating through recorded shared contracts.

## Authoritative ownership

The canonical role definitions and project context are in `AGENTS.md`:

1. **Integrations and shared platform** — `Dewflash`, project owner and primary authority
2. **AI intelligence and data extraction** — `joelyrk`
3. **Quest engine** — `L0pch`
4. **Streamer Studio UI/UX and customisation** — `JYL1m`
5. **Viewer Quest Board UI/UX** — `drdexe`

Each contributor works only inside their assigned role. The project owner is the primary authority for direction, priorities, role assignments, and cross-role decisions. The other four role owners may independently develop ideas for their own components.

Role 1 may inspect, redirect, assist, and modify another role for integration, safety, deadline recovery, or an owner-requested fix. Notify the affected owner and request review whenever practical; urgent demo fixes must be minimal, immediately disclosed, and recorded.

If an idea or feature crosses a role boundary, the originating contributor must not implement it. Send it to the owning role for comparison against that role's approach and notify the project owner before it is adopted. Shared types and API contracts remain owned by Role 1 and require affected-owner review.

Cross-role proposals use GitHub Issues as the persistent record because contributors work from separate computers and repository clones. Mention the target owner and `@Dewflash`; the target owner adds its comparison and recommendation before implementation. The project owner may resolve issues from the primary Codex task, but Role 1 must copy the settled outcome back into the issue or decision log.

Before parallel role work begins, Role 1 performs the one-time mechanical migration from the legacy shared source layout into the role-owned directories defined in `AGENTS.md`. The migration must preserve behaviour and cannot be used to redesign another role's component.

## Daily rhythm

- **Start:** ten-minute check-in; each person states one acceptance signal for the day.
- **Claim:** update `TEAM_CONTEXT.md` before touching shared contracts or the golden demo path.
- **Midday:** merge at least once; demo current `main`, not individual branches.
- **End:** run the complete happy path and record blockers in issues.
- Keep one stable golden demo scenario that must never break.

## Branch and merge policy

- Start from current `main`.
- Use `role-<n>/<short-summary>` branches and never push directly to `main`.
- Keep branches under one day when possible.
- Sync current `main` before requesting review.
- Submit every change through a pull request; Role 1 controls final integration and merge.
- Require the affected role owner when a pull request touches another role's files.
- Require one reviewer; use two for domain contracts or demo-critical changes, and require automated checks.
- Do not force-push a branch another teammate is using without agreement.

## ChatGPT Pro collaboration

- Each teammate should open the same repository so `AGENTS.md` and the repo-local skill apply consistently.
- Every teammate and their agent must read the root `AGENTS.md` plus their mandatory `docs/roles/ROLE-<n>.md` guide.
- Follow `docs/TEAM_PLAYBOOK.md` at the start and end of every pass; it contains the required sync, change-summary, one-batch decision, TODO, changelog, push, and PR sequence.
- Give ChatGPT/Codex one issue and acceptance signal at a time.
- Ask it to inspect current files before editing; agents do not share live context or uncommitted work across five machines.
- Distill useful conclusions from private chats into `TEAM_CONTEXT.md` or `DECISIONS.md`; do not commit raw private chat exports.
- Review every diff and never paste API keys, private viewer data, or competition credentials into chats.
- ChatGPT Pro and OpenAI API usage are separate; use mock mode until the team deliberately configures runtime API access.

## AI decision boundary

- Role 2 owns provider adapters, model-ready context, signal-analysis AI, and reliability evaluation.
- Role 3 owns quest-domain AI objectives, generation instructions, quality criteria, and use inside the deterministic engine.
- Roles 2 and 3 submit one joint provider/model recommendation to Role 1 before adopting OpenRouter or another provider.

## Change and submission records

- Every pull request adds a small fragment under its owner's `changes/role-<n>/` directory.
- Role 1 compiles fragments into the root `CHANGELOG.md` before demo or submission checkpoints.
- GitHub Issues record cross-role proposals; `docs/DECISIONS.md` records accepted durable decisions.
- Role 1 assembles the final README, architecture, disclosures, deck, demo video, and private-repository submission from evidence supplied by all roles.
