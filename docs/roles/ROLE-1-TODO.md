# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next:** review and publish R1-015 and the prerequisite-independent R1-016 hosted/chat seams, then compose the hosted-board exchange through the browser-safe gateway while UI-X10 remains on its reviewed vote-ledger path. Activate the team-owned Supabase preview when its external project is available. AI/extraction, quest mechanics, and detailed UI implementation remain with their owners.

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
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 and explicit project-owner product-readiness declaration | Required README/disclosures, deck, video, private repo access, and final checklist. Evidence collection may continue, but final narrative/deck/video assembly does not begin before that declaration. |
| R1-011 | P0 | READY | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | Role 1 can access the Twitch developer console and begin app/Extension setup without committing credentials. |
| R1-014 | P0 | DONE | Make Role 4/5 planning beginner-safe and convert every missing UI dependency into persistent work. | PR #14; D-042/D-043 | PR #27 merged guided mode, adaptive design coaching, role-owned execution records, corrected P0/P1 tasks, feasibility issues #15/#16, UI-X issues #17-#26, owner notification, and green repository checks. Role 1 explicitly waived the pending reviewer requests before merge. |
| R1-015 | P0 | IN PROGRESS | Implement the browser-safe UI gateway, authorised command client, local multi-surface harness, and shared UI verification stack. | R1-003; UI-X01/UI-X02/UI-X05; D-054 | Implementation and requested consumer fixes are ready for re-review: successful snapshots enforce active actor/surface invariants, token-provider rejection returns a typed dependency error, 21 focused UI/gateway tests, eight Chromium flows with screenshot, 94 full-suite tests, production build, boundary check, and production-with-flag 404 checks pass; no Role 4/5 product UI was implemented. Mark `DONE` after merge. |
| R1-016 | P0 | IN PROGRESS | Implement private per-viewer recovery plus hosted-board discovery and Twitch-chat delivery seams. | R1-003/R1-004; UI-X07/UI-X08/UI-X10; D1-06D/D1-06E | UI-X07/UI-X08 server seams are ready for review: direct-link/code/optional QR exchange yields only a short-lived authorised viewer grant, and chat delivery never reports success without Twitch confirmation. Browser route/cookie composition follows R1-015; UI-X10 personal vote/points recovery remains on the reviewed vote-ledger path and is not duplicated here. |
| R1-017 | P0 | IN PROGRESS | Establish the evidence manifest and real-test resource matrix for every role. | R1-014 / PR #27 merge | Implementation is ready for review: versioned manifest/schema, privacy and evidence-class validator, validator tests, PR/agent workflow hooks, and assigned broadcaster/two-viewer/OBS/desktop/mobile/recording resources enforce evidence class, surface/device, immutable revision, command, artifact, reviewer, and limitation records without identities, credentials, or private links. Mark `DONE` after merge. |
| R1-018 | P0 | READY | Gather problem-solution-fit, originality, usability, and expected-impact evidence while the build proceeds. | None | At least two relevant conversations or one streamer plus viewer observations, a truthful alternatives comparison, measurable hypotheses, and recorded product changes/limitations support the deck. |
| R1-019 | P0 | BLOCKED | Execute exact submission operations and freeze the immutable package. | R1-008/R1-010 | Team-named Drive folder contains all three deliverables and repository link; access is tested; email is sent to the brief's recipient; post-submission mutation is prohibited and recorded. |

## Decisions Role 1 still owns

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- UI client/harness/test-stack choices, per-viewer recovery, hosted discovery, and chat delivery policy
- Integration overrides and cross-role disputes
- Submission operations and any later changes to the accepted participation-rate KPI, owner-called freeze authority, or deferred demo-narrative scope
