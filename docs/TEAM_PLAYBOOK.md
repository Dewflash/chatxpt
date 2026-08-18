# ChatXPT Beginner Collaboration Playbook

This is the required operating procedure for all five contributors and their ChatGPT/Codex agents. It assumes each person works from a separate computer and repository clone.

## The four rules that prevent most team disasters

1. Never work directly on `main`.
2. Never pull, switch branches, merge, or rebase while uncommitted work exists.
3. Anyone may edit any role's files, but must preserve module boundaries, disclose cross-role scope, deconflict overlapping work with affected contributors, and notify Role 1 for integration visibility.
4. Never push secrets, `.env.local`, real viewer data, or credentials.
5. Any contributor with repository merge permission may merge an independently reviewed pull request; Role 1 is not the exclusive merger.

If a command reports a conflict or something unexpected, stop. Do not force-push, reset, delete files, or guess. Ask your role's Codex to explain the exact state and notify Role 1 if shared work is affected.

## First-time setup on each computer

At the beginning of the first Codex session, the contributor may say:

```text
I am Role <n>. Git pull.
```

Codex protects local work, performs the safe sync, and follows `docs/FIRST-PULL-WELCOME.md`. The welcome is shown once per clone using a local Git marker; it is not repeated on normal daily pulls.

1. Accept the GitHub collaborator invitation.
2. Install Git, Node.js 20.9 or later, and npm.
3. Clone and enter the repository:

```bash
git clone https://github.com/Dewflash/chatxpt.git
cd chatxpt
```

4. Check that you are on a clean `main`:

```bash
git status
git switch main
git pull --ff-only
```

5. Install the exact locked dependencies:

```bash
npm ci
```

6. Create local environment configuration only when needed:

```bash
cp .env.example .env.local
```

Never commit `.env.local`. Ask Role 1 for required development values through the agreed private team channel; do not paste secrets into GitHub Issues, pull requests, screenshots, or ChatGPT conversations.

7. Run the baseline check:

```bash
npm run check
```

8. Read, in this order:

- `AGENTS.md`
- This playbook
- `docs/FIRST-PULL-WELCOME.md` when the one-time local welcome has not yet been shown
- `docs/build-plans/INTEGRATION-CONTRACT.md`
- Your `docs/roles/ROLE-<n>.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_TODO.md`
- Your `docs/roles/ROLE-<n>-TODO.md`
- Your execution plan: `docs/build-plans/ROLE-<n>-BUILD-PLAN.md` for Roles 1-3, or the accepted Role 2-authored plan for Roles 4-5
- `changes/README.md`

## Start of every work pass

### 1. Protect existing work

Run:

```bash
git status --short
git branch --show-current
```

If `git status --short` prints anything, do not switch branches or pull. Ask Codex to inspect the changes. Finish and commit the current task, or ask Role 1 how to preserve it.

### 2. Fetch and let Codex explain incoming changes

Run:

```bash
git fetch origin
git log --oneline HEAD..origin/main
git diff --stat HEAD...origin/main
```

Ask Codex to summarise:

- What changed on `main`
- Which contracts or role files are affected
- Whether your current task needs adjustment
- Any decisions newly accepted in `docs/DECISIONS.md`

### 3. Start a new task branch

For a new task:

```bash
git switch main
git pull --ff-only
git switch -c role-<n>/<short-summary>
```

Example:

```bash
git switch -c role-3/quest-lifecycle
```

For an existing clean task branch:

```bash
git fetch origin
git merge origin/main
```

Do not reuse an old merged branch for unrelated work.

### 4. Give Codex the required start prompt

Replace `<n>` and the objective:

```text
I am Role <n>. Begin this work pass for: <objective>.

Before editing:
1. Read the root AGENTS.md, TEAM_PLAYBOOK.md, INTEGRATION-CONTRACT.md, my role guide and TODO, my execution plan, PROJECT_TODO.md, and DECISIONS.md.
2. Inspect git status and incoming main changes without discarding anything.
3. Summarise relevant changes since my branch diverged.
4. Confirm the module responsibilities involved and flag cross-role or shared-file overlap.
5. Identify the matching plan phase/pass and turn this objective into one reviewable pass with acceptance evidence.
6. List every open decision in that phase's decision gate in one batch. Separate component decisions I own from cross-role or project-owner decisions.
7. Identify dependencies, likely overlaps, and external blockers before implementation.
8. Name the public entry point and producer/consumer contract test for this pass. Contributors may edit across roles; product modules still do not import another module's private files.

Cross role boundaries whenever the coherent implementation requires it. Notify the relevant leads and Role 1, but do not wait for role-based permission. Update me briefly while working. At the end, verify, update affected records and the change fragment, review the diff, and tell me when it is ready to push and open a PR.
```

### Simpler start for Roles 4 and 5

Role 4 and Role 5 do not need to know their objective in advance. They may start with only:

```text
I am Role 4. What do I need to do?
```

or:

```text
I am Role 5. What do I need to do?
```

Codex then follows the guided execution mode in `AGENTS.md`: it finds the first ready pass, performs the technical and UX inspection, explains `We will ...`, and asks one tailored design-coaching batch for that pass. Plan questions are starter examples rather than a script; Codex adds or adapts questions to help the owner think through the actual surface. The owner may reply `Approve all recommendations`. Codex records material answers and continues. It does not push or open a pull request until the owner approves the reviewed result.

## During a work pass

- Work on one issue or clearly bounded outcome.
- Put code in the directory matching its runtime responsibility, regardless of which contributor implements it.
- Use the responsibility lead as an adviser for component details; do not escalate every small choice to Role 1 or wait for role-based permission.
- Notify affected leads and Role 1 when work crosses roles. Create a `cross-role` GitHub Issue only when a durable comparison or unresolved decision needs tracking.
- If a shared contract is missing, either use a labelled fixture against the last accepted contract or implement the canonical change with producer/consumer tests and Role 1 deconfliction.
- Anyone may edit `src/app/`, dependency/lock/config/env files, or Supabase migrations. Because these are collision-prone, sync first, document dependency purpose/version/runtime risk/fallback, deconflict with affected contributors, and notify Role 1. Role 1 approval is not required to merge.
- Merge and exercise the smallest cross-role vertical slice after each wave; do not postpone integration until every component is complete.
- Keep mock, simulated, and live behaviour visibly distinguishable.
- Run the smallest relevant checks while working.
- Do not mix refactors, new features, and unrelated fixes in one pull request.

## Decisions in one batch

Codex should inspect the current plan phase first, then present all open decisions from that phase together. For each decision it must state:

- The current recorded rule or gap
- The practical options
- Its recommendation and consequence
- Whether the responsibility lead should advise or the project owner must settle a product, architecture, safety, or cost decision

The responsibility lead answers once when available. For Roles 1-3, Codex records settled component decisions directly in the plan's decision table. For Roles 4/5, normal UX answers go in `ROLE-4-EXECUTION.md` or `ROLE-5-EXECUTION.md`, while baseline-plan revisions may be made by any contributor and are coordinated with Role 2. Every affected role reflects work status in its TODO. Durable product, architecture, provider, cost, safety, or responsibility changes go through Role 1 and `docs/DECISIONS.md`. Waiting for a role response does not block source work or a branch push unless the unresolved choice would create a safety, security, cost, or destructive-action risk.

## End of every work pass

### 1. Verify the result

Run the smallest relevant checks, then before handoff run:

```bash
npm run check
git diff --check
git status --short
```

UI roles also provide screenshots or a short recording. AI/engine roles provide evaluation or test evidence. A cross-role change provides both producer and consumer contract-test evidence plus the integrated revision/flow exercised. State what is real, mocked, simulated, inspected, and actually executed.

### 2. Update team records

- Update the TODOs for every role whose tracked task changed; do not rewrite unrelated statuses.
- Update settled decision answers and completed-pass evidence in the relevant execution plan or execution record. Any contributor may make the edit and should notify the responsibility lead.
- Add one change fragment under `changes/role-<n>/` using `changes/README.md`.
- Update relevant technical documentation.
- Link any cross-role issue or accepted decision.
- Any contributor may compile `CHANGELOG.md`; check for overlap, deconflict with affected contributors, and notify Role 1 before merge.

### 3. Review before committing

Ask Codex to show:

- User-visible outcome
- Files changed and why
- Test/verification results
- Remaining limitations
- Cross-role impact
- TODO and change-fragment updates
- Any secrets, generated files, or unrelated changes that must not be committed

Read the diff. Do not approve a commit you do not understand.

### 4. Commit and push

After the contributor and Codex review the diff, request the relevant responsibility leads' review and then commit and push. Their response is useful but is not required to publish the branch:

```bash
git add <reviewed-files>
git commit -m "feat(role-<n>): short outcome"
git push -u origin role-<n>/<short-summary>
```

Use `fix`, `docs`, `test`, or `chore` instead of `feat` when appropriate. Never use `git add .` until Codex has shown that every untracked and modified file belongs to the task.

### 5. Open the pull request

Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`. Link any relevant issue, request the responsibility leads, and notify Role 1. The author does not self-approve; review may come from any qualified contributor rather than a specific role owner.

After the required independent review, any contributor with repository merge permission may merge. Confirm automated checks and branch protection, current/deconflicted `main`, the change fragment/evidence, and no unresolved material safety, security, privacy, data-loss, external-cost, or golden-workflow issue. Role 1 is the default integration helper, not a required approver. If a requested responsibility lead is unavailable, use another qualified reviewer so integration does not stall.

## Resolving conflicts safely

If `git merge origin/main` or another command reports conflicts:

1. Stop and keep the terminal output.
2. Run `git status`.
3. Ask Codex to explain each conflicted file, its responsibility, and the intent on both branches.
4. Notify the affected contributors and Role 1.
5. Resolve any conflicted file needed for the coherent change. Preserve both valid intentions; Role 1 helps settle semantic conflicts and integration order.
6. Run the affected producer/consumer checks and the full checks again.
7. Never solve a conflict by silently deleting the other person's work, force-pushing, or resetting shared history.

## If you are unsure

Stopping safely is better than hiding a problem. Send Role 1:

- Your branch name
- The command you ran
- The exact error
- `git status --short`
- What you were trying to achieve

Role 1 or Codex can then recover without losing work.
