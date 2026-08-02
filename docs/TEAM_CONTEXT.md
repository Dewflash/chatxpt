# Shared Team Context

This file is the short, current handoff for the five-person team. Keep durable product and technical rationale in `DECISIONS.md`; keep detailed scope and design in the other documents under `docs/`.

## Current baseline

- The repository contains a single Next.js prototype with control-room and overlay routes.
- The core loop is signal input -> three quests -> producer review -> voting -> overlay -> outcome.
- Mock generation must remain credential-free and deterministic.
- Live AI is optional, server-side, runtime-validated, and must fall back safely.
- D-001 and D-004 are accepted: keep the existing single Next.js application and browser-local prototype transport. The earlier separate Vite/Node monorepo and immediate Socket.IO suggestion is superseded.
- Use the ownership areas in this file and the `feature/`, `fix/`, and `docs/` branch conventions in `AGENTS.md`; earlier role and `feat/` examples are superseded.
- Submission is due 9 August 2026. Plan for feature freeze and final recording on 8 August, followed by a clean-clone test and submission checks on 9 August.

## Coordination board

Update this table before starting work that touches shared types, API contracts, overlay transport, or the golden demo path.

| Area | Owner | Branch / issue | Intended outcome | Shared files affected | Status |
| --- | --- | --- | --- | --- | --- |
| Experience | Unassigned | - | - | - | Available |
| Quest intelligence | Unassigned | - | - | - | Available |
| Overlay | Unassigned | - | - | - | Available |
| Signals | Unassigned | - | - | - | Available |
| Demo and integration | Unassigned | - | - | - | Available |

Use `Planned`, `In progress`, `Needs review`, `Blocked`, or `Done` once an area is claimed. A row is a coordination signal, not a substitute for a branch, issue, or pull request.

## Open questions requiring team agreement

- Whether to accept, revise, or reject D-002 in `DECISIONS.md`.
- D-003 and D-005 are still marked `Proposed`, while `AGENTS.md` and the project skill already require deterministic fallback and producer approval. Either accept those decisions or deliberately relax the corresponding constraints.
- Which battle-royale-style scenario is the stable golden demo.
- Who owns shared domain/API contract review.
- Which deployment target and submission evidence format the team will use.

Add newly discovered disagreements here before implementation. Record the resolution in `DECISIONS.md`, including the date and participants, then remove the question from this list.

## Candidate golden demo from team chat

This remains a proposal until D-002 is accepted:

1. The simulated player is looting while chat becomes bored and asks for action.
2. ChatXPT generates three distinct quests using gameplay, sentiment, and streamer-profile signals.
3. Viewers vote and the winning quest appears on the overlay.
4. The operator simulates progress and completion.
5. At low health in the final circle, validation rejects an unsuitable no-healing quest and substitutes a safe fallback.

The final step should visibly demonstrate validation and failure handling, not just model generation.

## Safe handoff format

Copy this block into a pull request, issue, or teammate handoff:

```text
Outcome:
Branch / commit:
Files and contracts changed:
Interaction or route exercised:
Commands run and results:
Fallback behavior checked:
Decisions assumed or still open:
Known blockers / next owner:
```

## Context hygiene

- Do not paste private ChatGPT exports, API keys, personal viewer data, or competition credentials into the repository.
- Convert useful chat conclusions into concise, reviewable facts or proposals here or in the appropriate durable document.
- Label assumptions and proposals explicitly; another chat session cannot see private context unless it is pasted or committed.
- Fetch and inspect current `origin/main` before editing. If incoming work changes the same contract or expresses an incompatible product choice, stop and deconflict with the team before merging.
