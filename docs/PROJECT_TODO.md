# ChatXPT Project To-Do

**Owner:** Role 1 (`Dewflash`)

This file tracks cross-project outcomes only. Each contributor updates their own `docs/roles/ROLE-<n>-TODO.md`; Role 1 updates this file after integration. Status values are `READY`, `IN PROGRESS`, `BLOCKED`, and `DONE`.

| ID | Priority | Status | Owner | Outcome | Dependency | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | P0 | DONE | Role 1 | Collaboration foundation is merged and available to every contributor. | None | Role guides, playbook, ownership, PR/issue templates, TODOs, changelog workflow, and passing repository checks. |
| P-002 | P0 | IN PROGRESS | Role 1 | Legacy source is migrated behind role-owned public entry points. | P-003 skeleton; open legacy mapping decisions | Public entrypoints, compatibility tests, boundary enforcement, and a legacy inventory exist; file moves remain blocked on D1-01/D1-03 so current behavior is untouched. |
| P-003 | P0 | DONE | Role 1 | Version-one public contracts, orchestrator skeleton, capability model, and canonical tests are frozen for the first integration slice. | P-001 plus owner review | Versioned schemas/ports, role entrypoint tests, and candidate -> engine -> atomic revision -> validated view/broadcast fixture tests pass with duplicate, stale, concurrency, denial, and recovery coverage. |
| P-004 | P0 | IN PROGRESS | Role 1 | Supabase Free and Vercel projects are configured reproducibly with safe environments and revisioned realtime. | P-003 | R1-P04 supplies committed migrations/RLS/env validation, server-only persistence, sanitised realtime, and local fallback; shared cloud and later Vercel evidence remain explicit follow-up boundaries. |
| P-005 | P0 | READY | Roles 2 and 3 | Public AI and quest-engine ports produce three validated, capability-aware game-neutral candidates. | P-003 | Producer/consumer contract tests, representative evaluations, joint provider recommendation, real call path, and deterministic fallback. |
| P-006 | P0 | BLOCKED | Role 4 | Public Streamer Studio and compact Twitch modules use accepted view models/commands. | Synchronised Role 2 plan and Role 4 feasibility review; P-003 | Public module, early design-system entry, canonical state fixtures, first-time setup, persistent preferences, live controls, responsive/accessibility/contract evidence. |
| P-007 | P0 | BLOCKED | Role 5 | Public Twitch viewer, hosted fallback, chat fallback, and OBS visual modules use accepted view models/commands. | Synchronised Role 2 plan and Role 5 feasibility review; P-003 | Public modules, canonical state fixtures, same-revision multi-device voting, active quest/progress/results, fallback, responsive/accessibility/contract evidence. |
| P-008 | P0 | READY | Role 1 | Twitch developer test environment and OBS test scene are ready. | Twitch account with 2FA; P-004 | Registered app/Extension, allowlisted test channel, Local or Hosted Test, browser-source overlay instructions. |
| P-009 | P0 | BLOCKED | Role 1 | Golden Twitch workflow and integration ladder pass using real captured gameplay and real Twitch activity. | P-004 through P-008 | Same revision reaches orchestrator, Studio, two viewers, persistence, and OBS from setup -> frames -> intelligence -> three quests -> controls -> vote -> overlay -> result/reward, including failure/reconnect/idempotency and no simulated live evidence. |
| P-010 | P1 | BLOCKED | Role 1 | Submission evidence and disclosures are complete. | P-009 | README, architecture, prompts/agent config, third-party list, screenshots, evaluation results, and limitations. |
| P-011 | P1 | BLOCKED | Role 1 | Proposal deck and five-minute demo are final. | P-010 | Maximum 15-slide PDF and maximum five-minute video demonstrate complete core experience. |
| P-012 | P0 | BLOCKED | Role 1 | Private submission repository is ready for judging. | Final verification | `garena-ai-build-challenge` added as collaborator; immutable Google Drive submission package prepared. |
| P-013 | P0 | READY | Role 1 | Problem-solution fit, originality, usability, and expected-impact claims are backed by recorded evidence. | Ongoing product access | Relevant streamer/viewer observations, truthful alternatives comparison, measurable hypotheses, and resulting priorities are available for the deck/demo. |
| P-014 | P0 | IN PROGRESS | Role 1 with Roles 2/4/5 review | UI plans are beginner-safe and every upstream seam is assigned before source implementation. | PR #14; issues #15-#26 | Guided execution records, explained design gates, corrected P0/P1 queues, persistent feasibility reviews/UI-X issues, and Role 1 integration backlog. |

## Schedule gates

- **7 August 2026, 18:00 SGT:** feature freeze.
- **8 August 2026:** integration, rehearsal, evidence, deck, and recording.
- **9 August 2026:** final verification and submission.
