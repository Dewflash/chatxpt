# Role 1 Resume Handoff

Use this file when Role 1 work must continue from a different ChatGPT/Codex account, clone, or thread. It is intentionally redundant with the queue so the next agent can recover the working context from the repository alone.

## Fresh-account starter prompt

Paste this into the new account:

```text
I am resuming Role 1 on ChatXPT. Start from current main and read AGENTS.md, docs/TEAM_CONTEXT.md, docs/build-plans/INTEGRATION-CONTRACT.md, docs/roles/ROLE-1.md, docs/build-plans/ROLE-1-BUILD-PLAN.md, docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md, docs/roles/ROLE-1-TODO.md, and docs/roles/ROLE-1-RESUME-HANDOFF.md before editing.

Pick up R1-025 / LD-R1-03 only after Role 3's R3-010 cue actions are available, unless docs/roles/ROLE-1-TODO.md has changed. First deconflict the canonical actions and projections with current Role 3 work. Deliver private Session Goal, Live Context, cue actions, existing recommended quests, and the compact Live Config pop-out/OBS Dock path without turning the public OBS overlay into a control or reasoning surface. Run focused producer/consumer/UI tests plus npm run check, update the Role 1 TODO, TEAM_CONTEXT, change fragment, and evidence records, then land under D-076 if no material safety/privacy/security/data-loss/external-cost/golden-workflow risk remains.
```

## Last known safe base

- Verified local branch: `main`.
- Verified upstream base when R1-024 started: `origin/main` at `ad50f56`.
- Latest completed Role 1 Live Director pass: R1-024 / LD-R1-02, implementation commit `90726e6`; verify its final merge commit on current `main` before branching.
- Evidence boundary: `E-20260819-R1-001` and `E-20260819-R1-002` are fixture-only contract/privacy/revision/context evidence. They are not real Twitch, OBS, Supabase Cloud, OpenAI provider, Role 2 real-producer, or product-value evidence.
- Current policy: D-076 removes mandatory review, branch-protection, and CODEOWNERS gates. Deconfliction, relevant checks, repository records, and material-risk escalation still apply.

Always verify `git status --short --branch`, current `origin/main`, and open branches or pull requests before trusting this snapshot.

## First pickup after R1-024

Start with R1-025 / LD-R1-03 only after Role 3 R3-010 has published the canonical cue actions, unless the Role 1 TODO has been updated after this file. In the meantime, progress non-overlapping R1-015/R1-016 or real Supabase/Twitch/OBS evidence work.

Goal:

- render the authoritative declared intent and source-separated private Live Context with honest unknown/stale/conflicting/permission states;
- dispatch only canonical Role 3 cue actions through Role 1 authentication, persistence, and realtime authority;
- preserve existing recommended-quest controls and the exactly-three validated conversion path;
- deliver the compact private Live Config pop-out/OBS Dock experience without adding public OBS reasoning or viewer-private state;
- keep viewer/overlay rendering changes for R1-026 unless a minimal public-entry wire is required and deconflicted.

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

## Completed R1-024 guardrails

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

These guardrails are covered by source commit `90726e6` and `E-20260819-R1-002`. Real Twitch-chat evidence is still required before any live-audience claim.

## Records to update at the end of the pass

- `docs/roles/ROLE-1-TODO.md`: status, next pickup, and evidence boundary.
- `docs/TEAM_CONTEXT.md`: Live Director row and any overlap/deconfliction note.
- `docs/PROJECT_TODO.md`: P-016 only if project-level status or evidence changed.
- `changes/role-1/YYYY-MM-DD-*.md`: concise change fragment.
- `docs/evidence/manifest.json`: only when a new evidence artifact exists.

Run the smallest relevant focused tests while working and `npm run check` before merge handoff or direct landing. If a check cannot run, record why and what risk remains.

## Parallel Role 1 tracks that remain open

These are real Role 1 responsibilities. They may proceed while R1-025 waits for the canonical R3-010 action seam:

- R1-004 / R1-005: Supabase Free, Vercel, safe env, realtime evidence.
- R1-006 / R1-011: Twitch developer account, app, Extension test version, 2FA.
- R1-007: OBS capture and Browser Source evidence.
- R1-008: golden workflow integration.
- R1-015 / R1-016 / R1-021: UI gateway, viewer recovery/fallbacks, and current gameplay snapshot integration.
- R1-018: problem-solution-fit and impact evidence.

## Stop and escalate only for material risk

Under D-076, missing Role 1 review, missing responsibility-lead review, absent branch protection, or an unavailable role owner is not a blocker. Stop only for unresolved material safety, security, privacy, data-loss, external-cost, or broken golden-workflow risk, or for a product-scope decision that conflicts with the accepted docs.
