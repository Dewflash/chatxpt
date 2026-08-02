# ChatXPT Project To-Do

**Owner:** Role 1 (`Dewflash`)

This file tracks cross-project outcomes only. Each contributor updates their own `docs/roles/ROLE-<n>-TODO.md`; Role 1 updates this file after integration. Status values are `READY`, `IN PROGRESS`, `BLOCKED`, and `DONE`.

| ID | Priority | Status | Owner | Outcome | Dependency | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | P0 | DONE | Role 1 | Collaboration foundation is merged and available to every contributor. | None | Role guides, playbook, ownership, PR/issue templates, TODOs, changelog workflow, and passing repository checks. |
| P-002 | P0 | BLOCKED | Role 1 | Legacy source is migrated behind role-owned public entry points. | P-003 skeleton | Existing behaviour preserved; thin Role 1 routes mount modules; imports/routes work; no private cross-role or unowned shared-file edits. |
| P-003 | P0 | IN PROGRESS | Role 1 | Version-one public contracts, orchestrator skeleton, capability model, and canonical tests are frozen for the first integration slice. | P-001 plus owner review | Versioned schemas/ports, commands, view models, errors, revisions, and valid/invalid examples are implemented; role consumer tests and orchestrator fixture cycle remain. |
| P-004 | P0 | READY | Role 1 | Supabase Free and Vercel projects are configured reproducibly with safe environments and revisioned realtime. | P-003 | Committed migrations/RLS/env validation; two-browser idempotency/reconnect evidence; secrets remain server-side; local fallback works. |
| P-005 | P0 | READY | Roles 2 and 3 | Public AI and quest-engine ports produce three validated, capability-aware game-neutral candidates. | P-003 | Producer/consumer contract tests, representative evaluations, joint provider recommendation, real call path, and deterministic fallback. |
| P-006 | P0 | BLOCKED | Role 4 | Public Streamer Studio and compact Twitch modules use accepted view models/commands. | Synchronised Role 2 plan and Role 4 feasibility review; P-003 | Public module, early design-system entry, canonical state fixtures, first-time setup, persistent preferences, live controls, responsive/accessibility/contract evidence. |
| P-007 | P0 | BLOCKED | Role 5 | Public Twitch viewer, hosted fallback, chat fallback, and OBS visual modules use accepted view models/commands. | Synchronised Role 2 plan and Role 5 feasibility review; P-003 | Public modules, canonical state fixtures, same-revision multi-device voting, active quest/progress/results, fallback, responsive/accessibility/contract evidence. |
| P-008 | P0 | READY | Role 1 | Twitch developer test environment and OBS test scene are ready. | Twitch account with 2FA; P-004 | Registered app/Extension, allowlisted test channel, Local or Hosted Test, browser-source overlay instructions. |
| P-009 | P0 | BLOCKED | Role 1 | Golden Twitch workflow and integration ladder pass using real captured gameplay and real Twitch activity. | P-004 through P-008 | Same revision reaches orchestrator, Studio, two viewers, persistence, and OBS from setup -> frames -> intelligence -> three quests -> controls -> vote -> overlay -> result/reward, including failure/reconnect/idempotency and no simulated live evidence. |
| P-010 | P1 | BLOCKED | Role 1 | Submission evidence and disclosures are complete. | P-009 | README, architecture, prompts/agent config, third-party list, screenshots, evaluation results, and limitations. |
| P-011 | P1 | BLOCKED | Role 1 | Proposal deck and five-minute demo are final. | P-010 | Maximum 15-slide PDF and maximum five-minute video demonstrate complete core experience. |
| P-012 | P0 | BLOCKED | Role 1 | Private submission repository is ready for judging. | Final verification | `garena-ai-build-challenge` added as collaborator; immutable Google Drive submission package prepared. |

## Schedule gates

- **7 August 2026, 18:00 SGT:** feature freeze.
- **8 August 2026:** integration, rehearsal, evidence, deck, and recording.
- **9 August 2026:** final verification and submission.
