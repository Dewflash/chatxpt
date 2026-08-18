# Five-Person Workflow

Work through five clear areas of responsibility while allowing contributors to help anywhere and integrating through recorded shared contracts.

## Authoritative responsibilities

The canonical role definitions and project context are in `AGENTS.md`:

1. **Integrations and shared platform** — `Dewflash`, project owner and primary authority
2. **AI intelligence and data extraction** — `joelyrk`
3. **Quest engine** — `L0pch`
4. **Streamer Studio UI/UX and customisation** — `JYL1m`
5. **Viewer Quest Board UI/UX** — `drdexe`

Each contributor has an assigned coordination home, but may inspect, edit, test, implement, review, or merge across any role directory without prior role permission. The project owner is the primary authority for direction, priorities, architecture, safety, and cost. Role 1 coordinates overlapping integration order by default but is not an exclusive merge gate. Responsibility leads remain advisers and normal reviewers for their components, not edit or merge gatekeepers.

Role 1 may inspect, redirect, assist, and modify any role as ordinary integration work. Notify affected contributors and request the responsibility lead's review whenever practical, but do not wait for role-based permission to implement, push, or open a pull request.

If an idea or feature crosses a role boundary, notify the relevant lead and Role 1, inspect active work for overlap, and implement it in the directory matching its runtime responsibility. Shared types and API contracts remain maintained by Role 1, but any contributor may edit them with producer/consumer tests, migration notes, and deconfliction before merge.

Substantial or unresolved cross-role proposals use GitHub Issues as a persistent coordination record because contributors work from separate computers and repository clones. Mention the relevant leads and `@Dewflash`; their comparison may happen alongside implementation. The issue is not a permission gate. The project owner may resolve issues from the primary Codex task, and Role 1 copies the settled outcome back into the issue or decision log.

Before broad migration, Role 1 publishes the provisional public contracts/orchestrator ports and maps legacy responsibilities. Any contributor may perform the mechanical migration behind those seams, while Role 1 deconflicts the branches. Migration preserves behaviour unless a separate redesign pass is explicitly scoped.

## Daily rhythm

- **Start:** ten-minute check-in; each person states one acceptance signal for the day.
- **Claim:** update `TEAM_CONTEXT.md` before touching shared contracts or the golden demo path.
- **Midday:** merge at least once; demo current `main`, not individual branches.
- **End:** run the smallest integrated vertical slice on current `main` and record blockers in issues.
- Keep one stable golden demo scenario that must never break.

## Branch and merge policy

- Start from current `main`.
- Use `role-<n>/<short-summary>` branches and never push directly to `main`.
- Keep branches under one day when possible.
- Sync current `main` before requesting review.
- Submit every change through a pull request; after independent review, any contributor with repository merge permission may merge it.
- Request the affected responsibility leads when a pull request touches their modules; a missing response does not block branch work or pushing.
- Obtain one independent reviewer and two for domain contracts or demo-critical changes. Reviewers may be any qualified contributors; unavailable responsibility leads or Role 1 do not create a personal veto. Automated checks and actual branch-protection rules remain required.
- Before integration, fetch current `main`, identify overlapping branches/pull requests, and deconflict both textual and semantic changes. Role 1 actively assists and decides the safest landing order.
- Do not force-push a branch another teammate is using without agreement.

## ChatGPT Pro collaboration

- Each teammate should open the same repository so `AGENTS.md` and the repo-local skill apply consistently.
- Every teammate and their agent must read the root `AGENTS.md`, `docs/build-plans/INTEGRATION-CONTRACT.md`, their mandatory `docs/roles/ROLE-<n>.md` guide/TODO, and their accepted execution plan. Roles 4/5 also use their role-owned guided execution record and may begin by asking only what they need to do.
- Follow `docs/TEAM_PLAYBOOK.md` at the start and end of every pass; it contains the required sync, change-summary, one-batch decision, TODO, changelog, push, and PR sequence.
- Give ChatGPT/Codex one build-plan pass and acceptance signal at a time.
- Ask it to inspect current files before editing; agents do not share live context or uncommitted work across five machines.
- Distill useful conclusions from private chats into `TEAM_CONTEXT.md` or `DECISIONS.md`; do not commit raw private chat exports.
- Review every diff and never paste API keys, private viewer data, or competition credentials into chats.
- ChatGPT Pro and application API usage are separate. D-072 permits the approved API model only with a server-side team key and existing prepaid/promotional credit; no contributor must buy quota. Use clearly labelled fixtures for component tests and real OBS/Twitch inputs for every live or judged claim.

## AI decision boundary

- Role 2 owns provider adapters, model-ready context, signal-analysis AI, and reliability evaluation.
- Role 3 owns quest-domain AI objectives, generation instructions, quality criteria, and use inside the deterministic engine.
- D-072 settles OpenAI `gpt-5.6-terra` adoption. Roles 2 and 3 still evaluate reliability and quest quality for Role 1; a different provider/model or new spend requires a new owner decision.

## Change and submission records

- Every pull request adds a small fragment under its owner's `changes/role-<n>/` directory.
- Role 1 compiles fragments into the root `CHANGELOG.md` before demo or submission checkpoints.
- GitHub Issues record cross-role proposals; `docs/DECISIONS.md` records accepted durable decisions.
- Role 1 assembles the final README, architecture, disclosures, deck, demo video, and private-repository submission from evidence supplied by all roles.
