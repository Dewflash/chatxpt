# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next:** begin R1-023 (`LD-R1-01`) on a fresh branch from current `main`, while Role 3 begins R3-009 (`LD-R3-01`) against the proposed canonical fixtures. Keep R1-015 and the team-owned Supabase preview moving where they do not overlap. Deconflict each Live Director wave before merge; role labels remain responsibility context, not permission gates.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | P0 | DONE | Merge the beginner-safe team foundation. | None | Root/role guides, playbook, GitHub templates, CODEOWNERS, TODOs, changelog workflow, checks, and pushed PR. |
| R1-012 | P0 | DONE | Publish and operationalise the concurrent Role 1-3 build plans. | R1-001; D-017 through D-029 | Three plans define phases, decision gates, deadlines, real-data rules, acceptance evidence, responsibility, onboarding links, and review requests; `npm run check` and `git diff --check` pass. |
| R1-013 | P0 | DONE | Publish the binding cross-role integration contract and close plan-level integration gaps. | R1-012; D-030 through D-036 | Orchestrator/seams, shared-file responsibility, realtime semantics, contract ladder, risk spikes, tiered game support, and synchronised Role 4/5 plan requirements are authoritative; `npm run check` and `git diff --check` pass. |
| R1-002 | P0 | IN PROGRESS | Perform the one-time public-entry responsibility migration. | R1-003 skeleton; open legacy mapping decisions | Public paths, compatibility tests, dependency enforcement, and a factual legacy inventory exist; ambiguous moves remain deferred until D1-01/D1-03 are settled. Any contributor may perform the accepted moves. |
| R1-003 | P0 | DONE | Freeze version 1 contracts, public ports, orchestrator skeleton, and capability model. | R1-001; input from Roles 2-5 | Versioned schemas/ports, non-live fixtures, all-role consumer tests, and the candidate -> engine -> atomic commit -> validated view/broadcast fixture cycle pass, including duplicate, stale, concurrent, denial, and recovery cases. |
| R1-004 | P0 | IN PROGRESS | Create Supabase Free project and minimal revisioned schema/realtime channels. | R1-003; D-037 through D-041 | Committed migrations/RLS/env validation; profiles, sessions, quests, accepted participation, events/results, and sanitised snapshots use atomic revisions, reconnect recovery, server-only writes, and an in-memory fallback. Cloud/two-browser evidence is recorded separately from local execution. |
| R1-005 | P0 | IN PROGRESS | Connect Vercel deployment and safe environment variables. | R1-004 | Server-only deployment health route and local client-bundle secret scan are implemented; outstanding evidence still requires real Vercel preview deployment and configured environment values. |
| R1-006 | P0 | BLOCKED | Register Twitch app and Extension test version. | R1-011 | The viewer EBS verifies Twitch JWTs and the signed EventSub webhook counts pseudonymous exact `1`/`2`/`3` chat votes through the shared ledger. Remaining external work: developer-console registration, EventSub subscription creation, test channel/allowlist, Local or Hosted Test runtime evidence, later self-service OAuth automation, and recorded live proof. |
| R1-007 | P0 | IN PROGRESS | Run the early OBS capture spike, then define/test capture and Browser Source integration. | R1-003 provisional port | Studio now opens session-bound Gameplay Capture and generates a secure read-only `/obs-overlay` descriptor. Virtual Camera snapshots cross the authenticated ingress with current authority; overlay tokens stay in the URL fragment and project canonical read-only state. Focused source tests pass. Outstanding evidence still requires macOS permission, real frame sampling, and a recorded OBS Browser Source run. |
| R1-008 | P0 | BLOCKED | Integrate Roles 2-5 after every wave and complete the golden workflow. | R1-003 through R1-007; role deliverables | Same authoritative revision reaches Studio, two viewers, persistence, and OBS; contract ladder plus failure/fallback runs pass. |
| R1-009 | P1 | READY | Maintain GitHub issues, decisions, changelog compilation, and integration notes. | Ongoing | Every merged or directly landed integration has requested responsibility-lead context where useful, overlap/deconfliction evidence, fragment, verification, and recorded cross-role outcomes. Role 1 assists but is not the exclusive reviewer or merger under D-076. |
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 and explicit project-owner product-readiness declaration | Required README/disclosures, deck, video, private repo access, and final checklist. Evidence collection may continue, but final narrative/deck/video assembly does not begin before that declaration. |
| R1-011 | P0 | READY | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | Role 1 can access the Twitch developer console and begin app/Extension setup without committing credentials. |
| R1-014 | P0 | DONE | Make Role 4/5 planning beginner-safe and convert every missing UI dependency into persistent work. | PR #14; D-042/D-043 | PR #27 merged guided mode, adaptive design coaching, role-owned execution records, corrected P0/P1 tasks, feasibility issues #15/#16, UI-X issues #17-#26, owner notification, and green repository checks. Role 1 explicitly waived the pending reviewer requests before merge. |
| R1-015 | P0 | IN PROGRESS | Implement the browser-safe UI gateway, authorised command client, local multi-surface harness, and shared UI verification stack. | R1-003; UI-X01/UI-X02/UI-X05 | The Twitch viewer now mounts Role 5's canonical surface over signed EBS reads/commands; local Studio staging opens a diagnostic Role 3 voting cycle only after a verified Twitch channel arrives. Signed-token integration tests cover refresh, duplicate, concurrent revision recovery, anonymous identity, and wrong-channel denial. A real Local Test and streamer-side canonical gateway remain before completion. |
| R1-016 | P0 | IN PROGRESS | Implement private per-viewer recovery plus hosted-board discovery, Twitch-chat delivery, and authorised viewer reaction seams. | R1-003/R1-004; UI-X07/UI-X08/UI-X10; D1-06D/D1-06E | Twitch and hosted viewers recover only their own accepted vote through pseudonymous session-scoped keys; hosted room links mount the canonical viewer with HttpOnly authority; signed EventSub chat votes use the same ledger; and reactions are authoritative/idempotent. Persisted non-zero viewer rewards, outbound chat announcements, real Supabase multi-client recovery, and real Twitch delivery evidence remain open. |
| R1-017 | P0 | DONE | Establish the evidence manifest and real-test resource matrix for every role. | R1-014 / PR #27 merge | PR #32 merged the versioned manifest/schema, privacy and evidence-class validator, validator tests, PR/agent workflow hooks, and assigned broadcaster/two-viewer/OBS/desktop/mobile/recording resources. `docs/evidence/manifest.json` records the R1-017 validation entry, and `npm run check:evidence` plus `npm run test:evidence` pass. |
| R1-018 | P0 | IN PROGRESS | Gather problem-solution-fit, originality, usability, and expected-impact evidence while the build proceeds. | None | At least two relevant conversations or one streamer plus viewer observations, a truthful alternatives comparison, measurable hypotheses, and recorded product changes/limitations support the deck. |
| R1-019 | P0 | BLOCKED | Execute exact submission operations and freeze the immutable package. | R1-008/R1-010 | Team-named Drive folder contains all three deliverables and repository link; access is tested; email is sent to the brief's recipient; post-submission mutation is prohibited and recorded. |
| R1-020 | P0 | DONE | Implement accepted quest runtime seams for #36, #37, #38, recovered #48 scheduler, and #50 progress commands. | D-044 through D-047; accepted #50 command decision | Canonical tick/progress/emergency-clear commands, durable emergency latch, intervention-before-generation coordinator, vote-close scheduler, memory/Supabase due-cycle readers, migration, focused tests, and `npm run check` pass. |
| R1-021 | P0 | IN PROGRESS | Mount authenticated normalised gameplay snapshots into the shared server runtime without per-frame revision churn. | R1-003/R1-004/R1-007; Role 2 extraction public output | A server-only setup key issues short-lived session grants; memory/Supabase keep one monotonic snapshot per active session; ingestion rejects stale or cross-session/cycle/revision/evidence input; the capture UI submits only normalized facts and refreshes authority; and the sole orchestrator hydrates matching gameplay with explicit Capture Health. Focused checks pass on the finals integration branch. Full repository checks and real browser/OBS evidence remain before handoff. |
| R1-022 | P0 | DONE | Validate and scope the proposed Live Director expansion, then activate only the retained passes in its implementation plan. | P-015; D-074; research report and evidence matrix | D-075 accepts the narrow P0 loop, two bounded P1 experiments, explicit deferrals/rejections, and the five-pass Role 1 / five-pass Role 3 split. The active plan, queues, Role 3 brief, project queue, and coordination record preserve the unproven-solution-fit boundary. |
| R1-023 | P0 | READY | `LD-R1-01`: define the canonical Live Director authority, privacy, command, expiry, and three-projection spine. | R1-003; D-075; current contracts | Versioned contracts/fixtures and producer/consumer tests prove one revision, server-authorised actions, stale/duplicate failure, and structural absence of private cue/pointer/personal/provider data from viewer and OBS projections. |
| R1-024 | P0 | READY | `LD-R1-02`: compose declared intent, privacy-safe Chat Pointer aggregates, and source-separated private Live Context. | R1-023; Role 3 R3-009 input shape | Known/unknown/stale/conflict/sparse/single-viewer/spam/deleted-chat/reconnect/permission tests pass; only approved aggregates persist and no audience or streamer intent is fabricated. |
| R1-025 | P0 | READY | `LD-R1-03`: deliver Session Goal, Live Context, cue actions, existing recommended quests, and private pop-out/OBS Dock through Studio/Live Config. | R1-023/R1-024; Role 3 R3-010 actions | Accessible compact/private UI covers stale, permission, health, loading, offline, and reconnect states; it remains distinct from the public OBS Browser Source and adds no native/audio/gameplay-coach scope. |
| R1-026 | P0 | READY | `LD-R1-04`: preserve Extension Vote/Active/Result and compressed OBS payoff, with minimal Catch-up isolated as a P1 experiment. | R1-023; Role 3 lifecycle/conversion passes | Personal receipt/recovery stays private, hosted/chat fallbacks remain, OBS leaks no private fields, and responsive/accessibility/reconnect/terminal fixtures pass without client-owned lifecycle authority. |
| R1-027 | P0 | READY | `LD-R1-05`: add the P1 intervention-specific Session Brief and run golden integration plus comparative value evaluation. | R1-023 through R1-026; Role 3 R3-009 through R3-013 | Same revision reaches Studio/Live Config, two viewers, persistence, and OBS across real Minecraft/Twitch/OBS and failure/fallback cases; brief remains aggregate/non-causal; full checks and evidence manifest pass; failed hypotheses are recorded. |

## Current R1-018 evidence

- `codex/role-1-demo-runbook` adds `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`, a privacy-safe rehearsal path for memory-backed and real Twitch/OBS runs.
- `npm run check:demo-runbook` verifies the runbook keeps the required evidence resources, phases, fixture-vs-live warning, unknown-handling rule, authoritative revision gate, and secret/link guardrails.

## Current R1-010/R1-018 disclosure evidence

- `codex/role-1-third-party-disclosures` adds `docs/THIRD_PARTY_DISCLOSURES.md` and links it from the README.
- `tests/integration/disclosures.test.ts` checks the disclosure covers all current runtime/dev package dependencies and preserves explicit Twitch/OBS/cloud/provider/evidence limitations.

## Current R1-016 private viewer recovery pass

- `codex/role-1-viewer-recovery` adds the UI-X10 server-side `ViewerRecoveryReader` seam for session-scoped accepted-vote reconnect.
- Memory and Supabase readers return only the requesting viewer's accepted candidate/source/time plus `sessionPoints: 0` until the reward read model is persisted.
- Hosted-board discovery (UI-X08) and Twitch-chat delivery/acknowledgement (UI-X07) remain open under R1-016 after this pass.

## Historical finals Twitch viewer override (14 August 2026; superseded by D-071)

- The project owner explicitly authorised Role 1 to apply the D-015 integration override for the demo-critical viewer failure, mount the existing Role 5 public surface, make minimum Role 5-adjacent integration fixes, and proceed without Role 5 review for this pass.
- This pass keeps visual/interaction decisions inside the existing `@/viewer` module. Role 1 changes the thin app mount, Twitch JWT/EBS boundary, channel/session directory, canonical command composition, local diagnostic staging, upload client, tests, and setup documentation.
- This was the rule at the time. D-071 now allows cross-role contribution without an override while retaining Role 5 as the viewer-experience responsibility lead.

## Current R1-016 hosted-board access pass

- `codex/role-1-hosted-access` adds the UI-X08 server-side `HostedBoardAccessService` for room-code lookup, viewer access grants, direct path/share data, and typed invalid/not-found/inactive/unavailable states.
- Memory and Supabase adapters expose a hosted-board session directory backed by the existing session room-code records.
- `codex/role-1-hosted-board-access` adds the thin `/quest-board/[roomCode]` route shell over the accepted hosted-board access service, including the direct viewer path and QR payload display.
- Twitch-chat delivery/acknowledgement (UI-X07) and real multi-client hosted-board evidence remain open under R1-016 after this pass.

## Current R1-016 chat fallback policy pass

- `codex/role-1-chat-fallback-policy` adds the UI-X07 chat fallback formatting and receipt-policy seam for poll-open, final-result, and counted/duplicate/rejected/late/unavailable presentation.
- The seam maps authoritative visible options to `1`/`2`/`3` only when exactly three options are in the voting state.
- Real Twitch outbound sending, rate-limit handling, and live acknowledgement evidence remain open after this template/policy pass.

## Current R1-016 Twitch chat vote adapter pass

- `codex/role-1-twitch-chat-vote-adapter` adds the Role 1-owned strict `1`/`2`/`3` Twitch chat parser for fallback votes.
- Exact numeric chat messages emit canonical `viewer.vote` commands with `sourceMode: "twitch-chat"` and deterministic duplicate-delivery command IDs.
- Ordinary chat remains a raw-24h-max audience event, while chat-vote events retain only aggregate choice data.
- Bounded poll-open, final-result, and acknowledgement templates exist for future outbound Twitch chat delivery.
- Real Twitch inbound chat connection, outbound delivery, rate-limit handling, and live counted acknowledgement evidence remain open.

## Current Role 4 profile settings command pass

- `codex/role-1-profile-settings-current` adds the broadcaster-only `streamer.profile-settings` command for Studio-owned streamer preferences.
- Role 1 persists the profile revision, stamps the unchanged quest-cycle revision for broadcast consistency, and publishes updated role views without invoking Role 3.
- Empty nested patches such as `voting: {}` and `rewards: {}` are rejected so UI no-ops cannot create false revision history.

## Current Role 4 setup/session command pass

- `codex/role-1-setup-session-current` adds the broadcaster-only `streamer.setup` and `streamer.session` contracts for Studio setup controls.
- Setup action validation is service-specific, so Twitch-only actions cannot validate against OBS, realtime, intelligence, or session controls.
- The diagnostic UI gateway now publishes fixture-only setup/session command examples for Role 4 without claiming real Twitch, OBS, or deployment setup.

## Current UI-X06 quest-state fixture pass

- `codex/role-1-ui-x06-fixtures-current` adds canonical fixture quest states and matching role views for Role 4/5 rendering.
- The fixture catalog covers proposed, voting zero-vote, voting tie, active manual/automatic progress, terminal result/reward states, and cooldown.
- The zero-vote fixture keeps `acceptedCandidateId: null`; private viewer receipts are never fabricated from public tallies.

## Current session history read-model pass

- `codex/role-1-session-history-current` adds privacy-safe session history snapshots for terminal quest outcomes and aggregate engagement.
- Memory and Supabase readers derive history from accepted command receipts; they exclude raw chat, viewer identifiers, and private vote receipts.
- Mixed/non-live receipt evidence downgrades the snapshot to `diagnostic` rather than claiming live history.

## Current architecture and codebase guide pass

- `role-1/architecture-codebase-guide` adds `docs/CODEBASE_GUIDE.md`, a source-grounded explanation of the canonical architecture, the retained mounted prototype, end-to-end runtime flow, routes, ownership boundaries, and each major implementation file.
- The guide records only source-inspection evidence. It does not upgrade fixture tests, static SQL, or local compatibility paths into real Twitch, OBS, Supabase Cloud, or Vercel runtime claims.
- `README.md` and `docs/ARCHITECTURE.md` link to the implementation guide so contributors can move from the product overview to the detailed code map.

## Decisions Role 1 still settles or maintains

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- UI client/harness/test-stack choices, per-viewer recovery, hosted discovery, and chat delivery policy
- Cross-role deconfliction, semantic disputes, and integration order
- Submission operations and any later changes to the accepted participation-rate KPI, owner-called freeze authority, or deferred demo-narrative scope
