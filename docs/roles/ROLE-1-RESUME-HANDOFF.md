# Role 1 Resume Handoff

Use this file when Role 1 work must continue from a different ChatGPT/Codex account, clone, or thread. It is intentionally redundant with the queue so the next agent can recover the working context from the repository alone.

## Fresh-account starter prompt

Paste this into the new account:

```text
I am resuming Role 1 on ChatXPT. Start from current main and read AGENTS.md, docs/TEAM_CONTEXT.md, docs/build-plans/INTEGRATION-CONTRACT.md, docs/roles/ROLE-1.md, docs/build-plans/ROLE-1-BUILD-PLAN.md, docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md, docs/roles/ROLE-1-TODO.md, and docs/roles/ROLE-1-RESUME-HANDOFF.md before editing.

Pick up R1-024 / LD-R1-02 unless docs/roles/ROLE-1-TODO.md has changed. Deconflict with Role 3's R3-009 / LD-R3-01 suitability seam and any overlapping Role 1 Live Director branch. Build the Role 1 declared-intent, privacy-safe Chat Pointer aggregate, and source-separated private Live Context composition behind the canonical contracts from R1-023. Run the focused producer/consumer tests plus npm run check, update the Role 1 TODO, TEAM_CONTEXT, change fragment, and evidence records, then land under D-076 if no material safety/privacy/security/data-loss/external-cost/golden-workflow risk remains.
```

## Last known safe base

- Verified local branch: `main`.
- Verified upstream state: `origin/main` at `b3464c5`.
- Latest merged Role 1 Live Director pass: R1-023 / LD-R1-01, commit `49383cc`, merged through PR #152.
- Evidence boundary: `E-20260819-R1-001` is fixture-only contract/privacy/revision evidence. It is not real Twitch, OBS, Supabase Cloud, OpenAI provider, or product-value evidence.
- Current policy: D-076 removes mandatory review, branch-protection, and CODEOWNERS gates. Deconfliction, relevant checks, repository records, and material-risk escalation still apply.

Always verify `git status --short --branch`, current `origin/main`, and open branches or pull requests before trusting this snapshot.

## First pickup

Start with R1-024 / LD-R1-02 unless the Role 1 TODO has been updated after this file.

Goal:

- compose streamer-declared intent as an authoritative, monotonic Role 1 update;
- compose one privacy-safe Chat Pointer aggregate with qualifying-message count, unique-participant count, time window, source references, sparse/ambiguous state, and expiry;
- compose private Live Context as separate source classes: `Streamer says`, `ChatXPT detects`, and `Chat suggests`;
- preserve `known`, `unknown`, `stale`, `conflict`, permission, reconnect, and capability states honestly;
- feed the Role 3 cue-input seam without giving Role 3 persistence, authentication, or projection authority.

Do not build the LD-R1-03 UI in this pass. Rendering Session Goal, Live Context, cue actions, pop-out, and OBS Dock delivery belongs to R1-025 unless the active TODO says otherwise.

## Required local orientation

Run or inspect the equivalent of:

```bash
git status --short --branch
git fetch --all --prune
git pull --ff-only
git branch -r --sort=-committerdate
```

Then inspect:

- `docs/TEAM_CONTEXT.md` for current overlap and the Live Director row;
- `docs/roles/ROLE-1-TODO.md` for the active Role 1 pickup;
- `docs/PROJECT_TODO.md` for P-016;
- `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md`, especially LD-R1-02 and LD-R3-01;
- `docs/roles/ROLE-3-TODO.md` and `docs/roles/ROLE-3-LIVE-DIRECTOR-BRIEF.md` when deconflicting the R3-009 suitability seam;
- relevant open branches or pull requests, especially Role 3 Live Director suitability and any newer Role 1 Live Director branch.

## R1-024 acceptance guardrails

Tests and fixtures must cover:

- known, unknown, stale, and conflicting context;
- sparse chat and one-viewer non-consensus;
- duplicate/spam deduplication;
- deleted or cleared chat handling;
- reconnect recovery without leaking private evidence;
- permission denied and stale command states;
- only approved aggregate retention in product history.

The implementation must not:

- fabricate streamer intent from gameplay or chat;
- label one viewer as audience consensus;
- persist raw chat, usernames, provider payloads, personal viewer fields, or ordinary chat history;
- add a full chat summary, ordinary chat panel, microphone transcription, generic AI cohost, gameplay coach, or public OBS reasoning;
- bypass the exactly-three validated quest route or Role 3's deterministic safety authority.

Real Twitch-chat evidence is still required before any live-audience claim.

## Records to update at the end of the pass

- `docs/roles/ROLE-1-TODO.md`: status, next pickup, and evidence boundary.
- `docs/TEAM_CONTEXT.md`: Live Director row and any overlap/deconfliction note.
- `docs/PROJECT_TODO.md`: P-016 only if project-level status or evidence changed.
- `changes/role-1/YYYY-MM-DD-*.md`: concise change fragment.
- `docs/evidence/manifest.json`: only when a new evidence artifact exists.

Run the smallest relevant focused tests while working and `npm run check` before merge handoff or direct landing. If a check cannot run, record why and what risk remains.

## Parallel Role 1 tracks that remain open

These are real Role 1 responsibilities, but they should not silently replace R1-024 unless the owner chooses a different priority:

- R1-004 / R1-005: Supabase Free, Vercel, safe env, realtime evidence.
- R1-006 / R1-011: Twitch developer account, app, Extension test version, 2FA.
- R1-007: OBS capture and Browser Source evidence.
- R1-008: golden workflow integration.
- R1-015 / R1-016 / R1-021: UI gateway, viewer recovery/fallbacks, and current gameplay snapshot integration.
- R1-018: problem-solution-fit and impact evidence.

## Stop and escalate only for material risk

Under D-076, missing Role 1 review, missing responsibility-lead review, absent branch protection, or an unavailable role owner is not a blocker. Stop only for unresolved material safety, security, privacy, data-loss, external-cost, or broken golden-workflow risk, or for a product-scope decision that conflicts with the accepted docs.
