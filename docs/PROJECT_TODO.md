# ChatXPT Project To-Do

**Owner:** Role 1 (`Dewflash`)

This file tracks cross-project outcomes only. Each contributor updates their own `docs/roles/ROLE-<n>-TODO.md`; Role 1 updates this file after integration. Status values are `READY`, `IN PROGRESS`, `BLOCKED`, and `DONE`.

| ID | Priority | Status | Owner | Outcome | Dependency | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | P0 | IN PROGRESS | Role 1 | Collaboration foundation is merged and available to every contributor. | None | Role guides, playbook, ownership, PR/issue templates, TODOs, changelog workflow, and passing repository checks. |
| P-002 | P0 | READY | Role 1 | Legacy source is mechanically migrated into role-owned boundaries. | P-001 | Existing behaviour preserved; imports/routes work; owners can work without file overlap. |
| P-003 | P0 | READY | Role 1 | Shared contracts and capability model are frozen for the first integration slice. | P-002 plus owner review | Versioned types cover signals, sessions, participation, quest candidates, quest state, progress, results, platform capabilities, and real/mock metadata. |
| P-004 | P0 | READY | Role 1 | Supabase Free and Vercel projects are configured with safe development and production environments. | P-003 | Studio, viewer client, and overlay share a test session across devices; secrets remain server-side; local fallback works. |
| P-005 | P0 | READY | Roles 2 and 3 | AI and quest-engine contract produces three validated, game-neutral candidates. | P-003 | Representative evaluation cases, engine tests, joint provider recommendation, real call path, and deterministic fallback. |
| P-006 | P0 | BLOCKED | Role 4 | Working Streamer Studio and compact Twitch control surface use accepted contracts. | Role 4 decision pass; P-003 | First-time setup, persistent preferences, live controls, health/errors, responsive evidence. |
| P-007 | P0 | BLOCKED | Role 5 | Working Twitch viewer, hosted fallback, chat fallback, and OBS visual surfaces use accepted contracts. | Role 5 decision pass; P-003 | Multi-device voting, active quest/progress/results, fallback evidence, responsive evidence. |
| P-008 | P0 | READY | Role 1 | Twitch developer test environment and OBS test scene are ready. | Twitch account with 2FA; P-004 | Registered app/Extension, allowlisted test channel, Local or Hosted Test, browser-source overlay instructions. |
| P-009 | P0 | BLOCKED | Role 1 | Golden Twitch workflow passes end to end. | P-004 through P-008 | Stream setup -> signals -> three quests -> streamer behaviour -> vote -> overlay -> result/reward, with real/mock labels. |
| P-010 | P1 | BLOCKED | Role 1 | Submission evidence and disclosures are complete. | P-009 | README, architecture, prompts/agent config, third-party list, screenshots, evaluation results, and limitations. |
| P-011 | P1 | BLOCKED | Role 1 | Proposal deck and five-minute demo are final. | P-010 | Maximum 15-slide PDF and maximum five-minute video demonstrate complete core experience. |
| P-012 | P0 | BLOCKED | Role 1 | Private submission repository is ready for judging. | Final verification | `garena-ai-build-challenge` added as collaborator; immutable Google Drive submission package prepared. |

## Schedule gates

- **7 August 2026, 18:00 SGT:** feature freeze.
- **8 August 2026:** integration, rehearsal, evidence, deck, and recording.
- **9 August 2026:** final verification and submission.
