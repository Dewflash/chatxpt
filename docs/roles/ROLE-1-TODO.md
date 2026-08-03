# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next:** review/merge the implemented R1-P04 foundation, then activate the team-owned Supabase Free preview and execute its migration, pgTAP/RLS, private realtime, and two-client evidence. Keep ambiguous legacy moves deferred and leave Twitch, OBS, Vercel, AI/extraction, quest mechanics, and UI to their later passes/owners.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | P0 | DONE | Merge the beginner-safe team foundation. | None | Root/role guides, playbook, GitHub templates, CODEOWNERS, TODOs, changelog workflow, checks, and pushed PR. |
| R1-012 | P0 | DONE | Publish and operationalise the concurrent Role 1-3 build plans. | R1-001; D-017 through D-029 | Three plans define phases, decision gates, deadlines, real-data rules, acceptance evidence, ownership, onboarding links, and required reviews; `npm run check` and `git diff --check` pass. |
| R1-013 | P0 | DONE | Publish the binding cross-role integration contract and close plan-level integration gaps. | R1-012; D-030 through D-036 | Orchestrator/seams, shared-file ownership, realtime semantics, contract ladder, risk spikes, tiered game support, and synchronised Role 4/5 plan requirements are authoritative; `npm run check` and `git diff --check` pass. |
| R1-002 | P0 | IN PROGRESS | Perform the one-time public-entry ownership migration. | R1-003 skeleton; open legacy mapping decisions | Public paths, compatibility tests, dependency enforcement, and a factual legacy inventory exist; ambiguous moves remain deferred until D1-01/D1-03 are settled. |
| R1-003 | P0 | DONE | Freeze version 1 contracts, public ports, orchestrator skeleton, and capability model. | R1-001; input from Roles 2-5 | Versioned schemas/ports, non-live fixtures, all-role consumer tests, and the candidate -> engine -> atomic commit -> validated view/broadcast fixture cycle pass, including duplicate, stale, concurrent, denial, and recovery cases. |
| R1-004 | P0 | IN PROGRESS | Create Supabase Free project and minimal revisioned schema/realtime channels. | R1-003; D-037 through D-041 | Committed migrations/RLS/env validation; profiles, sessions, quests, accepted participation, events/results, and sanitised snapshots use atomic revisions, reconnect recovery, server-only writes, and an in-memory fallback. Cloud/two-browser evidence is recorded separately from local execution. |
| R1-005 | P0 | READY | Connect Vercel deployment and safe environment variables. | R1-004 | Role 1 deployment succeeds; preview/production URLs documented; no secrets in client or Git. |
| R1-006 | P0 | BLOCKED | Register Twitch app and Extension test version. | R1-011 | OAuth callback, test channel/allowlist, Viewer/Config/Live Config paths, Local or Hosted Test documented. |
| R1-007 | P0 | READY | Run the early OBS capture spike, then define/test capture and Browser Source integration. | R1-003 provisional port | Target browser selects OBS Virtual Camera and samples real frames; Browser Source contract securely supplies Role 5 visuals, hides when inactive, and reconnects. |
| R1-008 | P0 | BLOCKED | Integrate Roles 2-5 after every wave and complete the golden workflow. | R1-003 through R1-007; role deliverables | Same authoritative revision reaches Studio, two viewers, persistence, and OBS; contract ladder plus failure/fallback runs pass. |
| R1-009 | P1 | READY | Maintain GitHub issues, decisions, changelog compilation, and integration notes. | Ongoing | Every merged PR has owner review, fragment, verification, and recorded cross-role outcomes. |
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 | Required README/disclosures, deck, video, private repo access, and final checklist. |
| R1-011 | P0 | READY | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | Role 1 can access the Twitch developer console and begin app/Extension setup without committing credentials. |

## Decisions Role 1 still owns

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- Integration overrides and cross-role disputes
- Final KPIs, demo narrative, feature freeze, and submission
