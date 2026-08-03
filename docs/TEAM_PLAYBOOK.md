# ChatXPT Beginner Collaboration Playbook

This is the required operating procedure for all five contributors and their ChatGPT/Codex agents. It assumes each person works from a separate computer and repository clone.

## The four rules that prevent most team disasters

1. Never work directly on `main`.
2. Never pull, switch branches, merge, or rebase while uncommitted work exists.
3. Never edit another role's files without the cross-role process or Role 1 integration override.
4. Never push secrets, `.env.local`, real viewer data, or credentials.

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
4. Confirm the files my role owns and flag anything outside them.
5. Identify the matching plan phase/pass and turn this objective into one reviewable pass with acceptance evidence.
6. List every open decision in that phase's decision gate in one batch. Separate component decisions I own from cross-role or project-owner decisions.
7. Identify dependencies and blockers before implementation.
8. Name the public entry point and producer/consumer contract test for this pass. Do not import another role's private files.

Do not edit another role's files. Update me briefly while working. At the end, verify, update my TODO and change fragment, review the diff, and tell me when it is ready to push and open a PR.
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
- Keep changes inside your owned directories.
- Let your role owner decide component details; do not escalate every small choice to Role 1.
- Create a `cross-role` GitHub Issue before work that requires another role.
- If a shared contract is missing, use mocks that satisfy the last accepted contract and request the change from Role 1.
- Do not edit `src/app/`, dependency/lock/config/env files, or Supabase migrations unless you are Role 1 or have a recorded scoped grant. Request dependencies from Role 1 with purpose, version, runtime/bundle risk, and fallback.
- Merge and exercise the smallest cross-role vertical slice after each wave; do not postpone integration until every component is complete.
- Keep mock, simulated, and live behaviour visibly distinguishable.
- Run the smallest relevant checks while working.
- Do not mix refactors, new features, and unrelated fixes in one pull request.

## Decisions in one batch

Codex should inspect the current plan phase first, then present all open decisions from that phase together. For each decision it must state:

- The current recorded rule or gap
- The practical options
- Its recommendation and consequence
- Whether the role owner can decide it or a cross-role/project decision is required

The role owner answers once. For Roles 1-3, Codex records settled component decisions directly in the plan's decision table. For Roles 4/5, Role 2 retains the baseline-plan files, so Codex records the UI owner's answers in `ROLE-4-EXECUTION.md` or `ROLE-5-EXECUTION.md` and sends plan-level revisions through the feasibility issue. Every role reflects work status in its TODO. Durable product, architecture, provider, cost, safety, or ownership changes go through Role 1 and `docs/DECISIONS.md`.

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

- Update only your role's `ROLE-<n>-TODO.md`.
- Update settled decision answers and completed-pass evidence in your execution plan; Roles 4/5 use their role-owned `ROLE-<n>-EXECUTION.md` records rather than editing Role 2's baseline plan.
- Add one change fragment under `changes/role-<n>/` using `changes/README.md`.
- Update relevant technical documentation.
- Link any cross-role issue or accepted decision.
- Do not edit `CHANGELOG.md`; Role 1 compiles it.

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

After the role owner approves the reviewed diff:

```bash
git add <reviewed-files>
git commit -m "feat(role-<n>): short outcome"
git push -u origin role-<n>/<short-summary>
```

Use `fix`, `docs`, `test`, or `chore` instead of `feat` when appropriate. Never use `git add .` until Codex has shown that every untracked and modified file belongs to the task.

### 5. Open the pull request

Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`. Link the issue, request the required owner, and notify Role 1. Do not merge your own pull request.

Role 1 checks integration, required reviews, automated checks, changelog fragment, evidence, and effect on the golden Twitch flow before merging.

## Resolving conflicts safely

If `git merge origin/main` or another command reports conflicts:

1. Stop and keep the terminal output.
2. Run `git status`.
3. Ask Codex to explain each conflicted file and its owner.
4. Notify the affected owner and Role 1.
5. Resolve only your owned files. The other owner resolves or approves their files.
6. Run the full checks again.
7. Never solve a conflict by deleting the other person's work, force-pushing, or resetting shared history.

## If you are unsure

Stopping safely is better than hiding a problem. Send Role 1:

- Your branch name
- The command you ran
- The exact error
- `git status --short`
- What you were trying to achieve

Role 1 or Codex can then recover without losing work.
